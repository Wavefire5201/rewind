import type { SQLiteDatabase } from 'expo-sqlite';
import type { PhotoEntry, UserProfile, AppSettings, Album } from '@/types';
import { getDb, photoToRow, rowToPhoto, albumToRow, rowToAlbum, type PhotoRow, type AlbumRow } from '@/utils/db';
import { notify } from '@/utils/notify';

/**
 * The persistence layer behind AppContext (read and write app data through AppContext, not here).
 *
 * Everything loads once at launch. Saves take the whole new state of a slice (photos, albums,
 * profile, settings), but write only what changed: each flush diffs the slice against the last
 * state that reached the database, by object identity (state updates are immutable, so a changed
 * photo is a new object), and upserts or deletes just those rows. Saves made in the same tick share
 * one flush and one transaction, so e.g. an album and its photos are deleted together or not at
 * all. Flushes run one at a time; saves made during one wait for the next, newest state winning.
 * A failed flush rolls back, keeps the last committed state (the next save retries the change),
 * logs, and shows a notice.
 */

export function getDefaultSettings(): AppSettings {
  return {
    photoQuality: 'high',
    cloudBackupEnabled: false,
    mirrorSelfies: true,
    use24hClock: false,
    alignFaces: true,
  };
}

export interface StoredData {
  photos: PhotoEntry[];
  albums: Album[];
  profile: UserProfile | null;
  settings: AppSettings;
}

interface Pending {
  clear?: boolean;
  photos?: readonly PhotoEntry[];
  albums?: readonly Album[];
  profile?: UserProfile;
  settings?: AppSettings;
}

// What the database holds, as the objects that were written (or loaded).
let committedPhotos = new Map<string, PhotoEntry>();
let committedAlbums = new Map<string, { album: Album; position: number }>();
let committedProfile: UserProfile | null = null;
let committedSettings: AppSettings | null = null;

let pending: Pending = {};
let waiters: ((saved: boolean) => void)[] = [];
let scheduled = false;

const PHOTO_COLUMNS: (keyof PhotoRow)[] = [
  'id', 'album_id', 'date', 'image_uri', 'thumb_uri', 'caption', 'captured_at', 'camera_direction', 'encoding', 'face_scan', 'face_landmarks',
];
const ALBUM_COLUMNS: (keyof AlbumRow)[] = [
  'id', 'name', 'created_at', 'reminder_enabled', 'reminder_time', 'is_locked', 'framing', 'position',
];
const upsertSql = (table: string, columns: string[]) =>
  `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')}) `
  + `ON CONFLICT(id) DO UPDATE SET ${columns.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')}`;
const UPSERT_PHOTO = upsertSql('photos', PHOTO_COLUMNS);
const UPSERT_ALBUM = upsertSql('albums', ALBUM_COLUMNS);
const UPSERT_KV = 'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';

function parseJson<T>(text: string | undefined, what: string): T | null {
  if (text === undefined) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error(`loadAll: unreadable ${what}, using defaults`);
    return null;
  }
}

/** Reads everything once: photos by date, albums in the user's order, profile, settings over their defaults. */
export async function loadAll(): Promise<StoredData> {
  const db = await getDb();
  const [photoRows, albumRows, kvRows] = await Promise.all([
    db.getAllAsync<PhotoRow>('SELECT * FROM photos ORDER BY date, album_id'),
    db.getAllAsync<AlbumRow>('SELECT * FROM albums ORDER BY position'),
    db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM kv'),
  ]);
  const kv = new Map(kvRows.map((r) => [r.key, r.value]));
  const photos = photoRows.map(rowToPhoto);
  const albums = albumRows.map(rowToAlbum);
  const profile = parseJson<UserProfile>(kv.get('profile'), 'profile');
  const storedSettings = parseJson<Partial<AppSettings>>(kv.get('settings'), 'settings');
  const settings = { ...getDefaultSettings(), ...storedSettings };

  committedPhotos = new Map(photos.map((p) => [p.id, p]));
  committedAlbums = new Map(albums.map((a, position) => [a.id, { album: a, position }]));
  committedProfile = profile;
  committedSettings = settings;
  return { photos, albums, profile, settings };
}

/** Saves the photos' new state, writing only changed rows. Resolves with whether it reached storage. */
export function savePhotos(photos: readonly PhotoEntry[]): Promise<boolean> {
  return request({ photos });
}

export function saveAlbums(albums: readonly Album[]): Promise<boolean> {
  return request({ albums });
}

export function saveProfile(profile: UserProfile): Promise<boolean> {
  return request({ profile });
}

export function saveSettings(settings: AppSettings): Promise<boolean> {
  return request({ settings });
}

/** Deletes every photo, album, profile and setting; saves after it start from empty. */
export function clearAllData(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    // Anything not yet written is about to be wiped anyway.
    pending = { clear: true };
    waiters.push(resolve);
    schedule();
  });
}

function request(slice: Pending): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    pending = { ...pending, ...slice };
    waiters.push(resolve);
    schedule();
  });
}

// One flush per tick: saves made in the same synchronous run (e.g. the album and photo updaters
// of one render) land in the same transaction.
function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => { void runFlushes(); });
}

async function runFlushes(): Promise<void> {
  while (Object.keys(pending).length > 0) {
    const batch = pending;
    const batchWaiters = waiters;
    pending = {};
    waiters = [];
    const saved = await flush(batch);
    batchWaiters.forEach((resolve) => resolve(saved));
  }
  scheduled = false;
}

async function flush(batch: Pending): Promise<boolean> {
  let photos = batch.clear ? new Map<string, PhotoEntry>() : committedPhotos;
  let albums = batch.clear ? new Map<string, { album: Album; position: number }>() : committedAlbums;
  let profile = batch.clear ? null : committedProfile;
  let settings = batch.clear ? null : committedSettings;
  try {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      if (batch.clear) await db.execAsync('DELETE FROM photos; DELETE FROM albums; DELETE FROM kv;');
      if (batch.photos) photos = await writePhotos(db, photos, batch.photos);
      if (batch.albums) albums = await writeAlbums(db, albums, batch.albums);
      if (batch.profile && batch.profile !== profile) {
        await db.runAsync(UPSERT_KV, 'profile', JSON.stringify(batch.profile));
        profile = batch.profile;
      }
      if (batch.settings && batch.settings !== settings) {
        await db.runAsync(UPSERT_KV, 'settings', JSON.stringify(batch.settings));
        settings = batch.settings;
      }
    });
  } catch (e) {
    console.error('Storage write failed:', e);
    // One notice however many flushes fail.
    notify({ title: "couldn't save", message: "rewind couldn't save your latest change. try again.", tone: 'error', key: 'save-failed' });
    return false;
  }
  committedPhotos = photos;
  committedAlbums = albums;
  committedProfile = profile;
  committedSettings = settings;
  return true;
}

async function writePhotos(db: SQLiteDatabase, committed: Map<string, PhotoEntry>, photos: readonly PhotoEntry[]) {
  const next = new Map<string, PhotoEntry>();
  const changed: PhotoEntry[] = [];
  for (const p of photos) {
    next.set(p.id, p);
    if (committed.get(p.id) !== p) changed.push(p);
  }
  if (changed.length > 0) {
    const upsert = await db.prepareAsync(UPSERT_PHOTO);
    try {
      for (const p of changed) {
        const row = photoToRow(p);
        await upsert.executeAsync(PHOTO_COLUMNS.map((c) => row[c]));
      }
    } finally {
      await upsert.finalizeAsync();
    }
  }
  for (const id of committed.keys()) {
    if (!next.has(id)) await db.runAsync('DELETE FROM photos WHERE id = ?', id);
  }
  return next;
}

async function writeAlbums(db: SQLiteDatabase, committed: Map<string, { album: Album; position: number }>, albums: readonly Album[]) {
  const next = new Map<string, { album: Album; position: number }>();
  const changed: { album: Album; position: number }[] = [];
  albums.forEach((album, position) => {
    next.set(album.id, { album, position });
    const before = committed.get(album.id);
    if (before?.album !== album || before.position !== position) changed.push({ album, position });
  });
  if (changed.length > 0) {
    const upsert = await db.prepareAsync(UPSERT_ALBUM);
    try {
      for (const { album, position } of changed) {
        const row = albumToRow(album, position);
        await upsert.executeAsync(ALBUM_COLUMNS.map((c) => row[c]));
      }
    } finally {
      await upsert.finalizeAsync();
    }
  }
  for (const id of committed.keys()) {
    if (!next.has(id)) await db.runAsync('DELETE FROM albums WHERE id = ?', id);
  }
  return next;
}

export function resetStorageForTests(): void {
  committedPhotos = new Map();
  committedAlbums = new Map();
  committedProfile = null;
  committedSettings = null;
  pending = {};
  waiters = [];
  scheduled = false;
}
