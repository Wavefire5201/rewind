import * as SQLite from 'expo-sqlite';
import type { Album, PhotoEntry } from '@/types';

/**
 * Rewind's database: photos, albums, and a key/value table for the profile and settings. One
 * connection for the app's life. utils/storage.ts is the only reader and writer; everything else
 * goes through AppContext.
 */

export const DB_NAME = 'rewind.db';
export const SCHEMA_VERSION = 1;

// WAL for concurrent reads during a write; synchronous FULL because callers delete files once a
// save resolves, so a committed transaction must survive a power loss (NORMAL can roll one back).
// No foreign keys: integrity stays in app logic, and an album row written after its photos must
// not fail the save.
const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY NOT NULL,
  album_id TEXT NOT NULL,
  date TEXT NOT NULL,
  image_uri TEXT NOT NULL,
  thumb_uri TEXT,
  caption TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  camera_direction TEXT NOT NULL,
  encoding TEXT,
  face_scan TEXT,
  face_landmarks TEXT
);
CREATE INDEX IF NOT EXISTS photos_album_date ON photos (album_id, date);
CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reminder_enabled INTEGER NOT NULL,
  reminder_time TEXT NOT NULL,
  is_locked INTEGER NOT NULL,
  framing TEXT,
  position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
PRAGMA user_version = ${SCHEMA_VERSION};
`;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** The app's database, opened and set up on first use. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(SCHEMA);
      return db;
    })().catch((e) => {
      // Let the next call try again rather than caching the failure.
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

export function resetDbForTests(): void {
  dbPromise = null;
}

export interface PhotoRow {
  id: string;
  album_id: string;
  date: string;
  image_uri: string;
  thumb_uri: string | null;
  caption: string;
  captured_at: string;
  camera_direction: string;
  encoding: string | null;
  face_scan: string | null;
  face_landmarks: string | null;
}

export interface AlbumRow {
  id: string;
  name: string;
  created_at: string;
  reminder_enabled: number;
  reminder_time: string;
  is_locked: number;
  framing: string | null;
  position: number;
}

const json = (value: unknown): string | null => (value === undefined ? null : JSON.stringify(value));

// A JSON column that won't parse is left out (a missing scan is redone, a missing framing falls back
// to the default), so one bad row can't stop the app loading.
function parseColumn<T>(text: string | null, what: string): T | undefined {
  if (text === null) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    console.warn(`unreadable ${what}, left out`);
    return undefined;
  }
}

export function photoToRow(p: PhotoEntry): PhotoRow {
  return {
    id: p.id,
    album_id: p.albumId,
    date: p.date,
    image_uri: p.imageUri,
    thumb_uri: p.thumbUri ?? null,
    caption: p.caption,
    captured_at: p.capturedAt,
    camera_direction: p.cameraDirection,
    encoding: p.encoding ?? null,
    face_scan: json(p.faceScan),
    face_landmarks: json(p.faceLandmarks),
  };
}

/** Optional fields come back absent (not null), so `photo.faceScan === undefined` still means unscanned. */
export function rowToPhoto(r: PhotoRow): PhotoEntry {
  const photo: PhotoEntry = {
    id: r.id,
    albumId: r.album_id,
    date: r.date,
    imageUri: r.image_uri,
    caption: r.caption,
    capturedAt: r.captured_at,
    cameraDirection: r.camera_direction as PhotoEntry['cameraDirection'],
  };
  if (r.thumb_uri !== null) photo.thumbUri = r.thumb_uri;
  if (r.encoding !== null) photo.encoding = r.encoding as PhotoEntry['encoding'];
  const faceScan = parseColumn<PhotoEntry['faceScan']>(r.face_scan, `face scan of ${r.id}`);
  if (faceScan !== undefined) photo.faceScan = faceScan;
  const faceLandmarks = parseColumn<PhotoEntry['faceLandmarks']>(r.face_landmarks, `face landmarks of ${r.id}`);
  if (faceLandmarks !== undefined) photo.faceLandmarks = faceLandmarks;
  return photo;
}

/** `position` is the album's place in the user's list. */
export function albumToRow(a: Album, position: number): AlbumRow {
  return {
    id: a.id,
    name: a.name,
    created_at: a.createdAt,
    reminder_enabled: a.reminderEnabled ? 1 : 0,
    reminder_time: a.reminderTime,
    is_locked: a.isLocked ? 1 : 0,
    framing: json(a.framing),
    position,
  };
}

export function rowToAlbum(r: AlbumRow): Album {
  const album: Album = {
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    reminderEnabled: r.reminder_enabled === 1,
    reminderTime: r.reminder_time,
    isLocked: r.is_locked === 1,
  };
  const framing = parseColumn<Album['framing']>(r.framing, `framing of ${r.id}`);
  if (framing !== undefined) album.framing = framing;
  return album;
}
