import * as notifyModule from '@/utils/notify';
import {
  loadAll, savePhotos, saveAlbums, saveProfile, saveSettings, clearAllData, getDefaultSettings, resetStorageForTests,
} from '@/utils/storage';
import { getDb, resetDbForTests, photoToRow } from '@/utils/db';
import { getNotices, resetNoticesForTests } from '@/utils/notify';
import { sqliteLog, failNextTransaction, resetSqliteForTests } from '../helpers/sqliteMock';
import type { Album, PhotoEntry, UserProfile } from '@/types';

const photo = (id: string, date: string, extra: Partial<PhotoEntry> = {}): PhotoEntry => ({
  id, albumId: 'a1', date, imageUri: `file:///document/${id}.jpg`, caption: '', capturedAt: `${date}T12:00:00.000Z`,
  cameraDirection: 'front', ...extra,
});
const album = (id: string, name = id): Album => ({
  id, name, createdAt: '2026-01-01T12:00:00.000Z', reminderEnabled: false, reminderTime: '08:00', isLocked: false,
});
const profile: UserProfile = { name: 'Ada', avatarUri: null, joinDate: '2026-01-01' };

const rows = async (table: string) => (await getDb()).getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table} ORDER BY rowid`);
const writes = (pattern: RegExp) => sqliteLog.statements.filter((s) => pattern.test(s));

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  resetSqliteForTests();
  resetDbForTests();
  resetStorageForTests();
  resetNoticesForTests();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
  resetNoticesForTests();
});

it('saves and loads every slice', async () => {
  const photos = [photo('p2', '2026-03-02'), photo('p1', '2026-03-01', { caption: 'first' })];
  const albums = [album('a1', 'daily'), album('a2', 'trips')];
  const settings = { ...getDefaultSettings(), use24hClock: true };
  await expect(Promise.all([savePhotos(photos), saveAlbums(albums), saveProfile(profile), saveSettings(settings)]))
    .resolves.toEqual([true, true, true, true]);

  resetStorageForTests();
  const loaded = await loadAll();
  expect(loaded.photos.map((p) => p.id)).toEqual(['p1', 'p2']); // date order
  expect(loaded.photos[0]).toEqual(photos[1]);
  expect(loaded.albums).toEqual(albums); // the user's order
  expect(loaded.profile).toEqual(profile);
  expect(loaded.settings).toEqual(settings);
});

it('loadAll gives defaults on an empty database', async () => {
  await expect(loadAll()).resolves.toEqual({ photos: [], albums: [], profile: null, settings: getDefaultSettings() });
});

it('settings stored before a new setting existed pick up its default', async () => {
  const db = await getDb();
  await db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?)', 'settings', JSON.stringify({ use24hClock: true }));
  expect((await loadAll()).settings).toEqual({ ...getDefaultSettings(), use24hClock: true });
});

it('unreadable profile or settings fall back to defaults', async () => {
  const db = await getDb();
  await db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?)', 'profile', '{not json');
  await db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?)', 'settings', '{not json');
  const loaded = await loadAll();
  expect(loaded.profile).toBeNull();
  expect(loaded.settings).toEqual(getDefaultSettings());
});

it('a single photo edit writes one row', async () => {
  const photos = [photo('p1', '2026-03-01'), photo('p2', '2026-03-02'), photo('p3', '2026-03-03')];
  await savePhotos(photos);
  sqliteLog.statements.length = 0;
  const edited = photos.map((p) => (p.id === 'p2' ? { ...p, caption: 'edited' } : p));
  await expect(savePhotos(edited)).resolves.toBe(true);
  expect(writes(/^INSERT INTO photos/)).toHaveLength(1);
  expect(writes(/^DELETE FROM photos/)).toHaveLength(0);
  expect((await rows('photos')).find((r) => r.id === 'p2')?.caption).toBe('edited');
});

it('saving the same photos again writes nothing', async () => {
  const photos = [photo('p1', '2026-03-01'), photo('p2', '2026-03-02')];
  await savePhotos(photos);
  sqliteLog.statements.length = 0;
  await savePhotos([...photos]);
  expect(writes(/photos/)).toHaveLength(0);
});

it('removed photos are deleted and the rest left alone', async () => {
  const photos = [photo('p1', '2026-03-01'), photo('p2', '2026-03-02'), photo('p3', '2026-03-03')];
  await savePhotos(photos);
  sqliteLog.statements.length = 0;
  await savePhotos(photos.filter((p) => p.id !== 'p2'));
  expect(writes(/^DELETE FROM photos/)).toHaveLength(1);
  expect(writes(/^INSERT INTO photos/)).toHaveLength(0);
  expect((await rows('photos')).map((r) => r.id)).toEqual(['p1', 'p3']);
});

it('reordering albums rewrites their positions', async () => {
  const albums = [album('a1'), album('a2'), album('a3')];
  await saveAlbums(albums);
  await saveAlbums([albums[2], albums[0], albums[1]]);
  resetStorageForTests();
  expect((await loadAll()).albums.map((a) => a.id)).toEqual(['a3', 'a1', 'a2']);
});

it('slices saved in the same tick commit in one transaction', async () => {
  sqliteLog.transactions = 0;
  const saved = await Promise.all([savePhotos([photo('p1', '2026-03-01')]), saveAlbums([album('a1')])]);
  expect(saved).toEqual([true, true]);
  expect(sqliteLog.transactions).toBe(1);
});

it('a failed commit rolls back, notifies once, and the next save retries the change', async () => {
  const photos = [photo('p1', '2026-03-01', { caption: 'old' })];
  await savePhotos(photos);
  const edited = [{ ...photos[0], caption: 'new' }];

  failNextTransaction(new Error('disk full'));
  await expect(savePhotos(edited)).resolves.toBe(false);
  expect((await rows('photos'))[0].caption).toBe('old');
  expect(errorSpy).toHaveBeenCalledWith('Storage write failed:', expect.any(Error));
  expect(getNotices()).toEqual([expect.objectContaining({ title: "couldn't save", tone: 'error', key: 'save-failed' })]);

  await expect(savePhotos(edited)).resolves.toBe(true);
  expect((await rows('photos'))[0].caption).toBe('new');
});

it('a save after a failed load never deletes rows it did not load', async () => {
  const db = await getDb();
  for (const p of [photo('p1', '2026-03-01'), photo('p2', '2026-03-02'), photo('p3', '2026-03-03')]) {
    const row = photoToRow(p);
    const cols = Object.keys(row);
    await db.runAsync(`INSERT INTO photos (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, ...Object.values(row));
  }
  jest.spyOn(db, 'getAllAsync').mockRejectedValueOnce(new Error('read failed'));
  await expect(loadAll()).rejects.toThrow('read failed');

  // The app shows no photos and the user takes one.
  await expect(savePhotos([photo('p4', '2026-03-04')])).resolves.toBe(true);
  expect((await rows('photos')).map((r) => r.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
});

it('until a load succeeds, profile and settings saves fill missing rows but never replace stored ones', async () => {
  const db = await getDb();
  await db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?)', 'profile', JSON.stringify(profile));
  jest.spyOn(db, 'getAllAsync').mockRejectedValueOnce(new Error('read failed'));
  await expect(loadAll()).rejects.toThrow('read failed');

  // Onboarding (shown because no albums loaded) stamps a new profile; a settings change follows.
  await expect(saveProfile({ name: 'You', avatarUri: null, joinDate: '2026-10-24' })).resolves.toBe(true);
  await expect(saveSettings({ ...getDefaultSettings(), use24hClock: true })).resolves.toBe(true);
  resetStorageForTests();
  const loaded = await loadAll();
  expect(loaded.profile).toEqual(profile);
  expect(loaded.settings.use24hClock).toBe(true); // no settings row was stored, so this one fills it
});

it('a failed change is retried whole by the next save of any slice', async () => {
  const a1 = album('a1');
  const a2 = album('a2');
  const p1 = photo('p1', '2026-03-01');
  const p2 = photo('p2', '2026-03-02', { albumId: 'a2' });
  await Promise.all([saveAlbums([a1, a2]), savePhotos([p1, p2])]);

  // Deleting a2 with its photos fails...
  failNextTransaction(new Error('disk full'));
  await expect(Promise.all([saveAlbums([a1]), savePhotos([p1])])).resolves.toEqual([false, false]);
  // ...and the next save, an unrelated rename, lands the whole delete with it: no orphaned photos.
  await expect(saveAlbums([{ ...a1, name: 'renamed' }])).resolves.toBe(true);
  expect((await rows('albums')).map((r) => [r.id, r.name])).toEqual([['a1', 'renamed']]);
  expect((await rows('photos')).map((r) => r.id)).toEqual(['p1']);
});

it('a clear drops a failed change instead of retrying it', async () => {
  await savePhotos([photo('p1', '2026-03-01')]);
  failNextTransaction(new Error('disk full'));
  await expect(savePhotos([photo('p1', '2026-03-01'), photo('p2', '2026-03-02')])).resolves.toBe(false);
  await expect(clearAllData()).resolves.toBe(true);
  await expect(saveAlbums([album('a1')])).resolves.toBe(true);
  expect(await rows('photos')).toEqual([]);
});

it('a flush that throws while reporting its failure still answers, and later saves run', async () => {
  jest.spyOn(notifyModule, 'notify').mockImplementationOnce(() => { throw new Error('notice failed'); });
  failNextTransaction(new Error('disk full'));
  const hung = new Promise((resolve) => setTimeout(() => resolve('hung'), 200));
  await expect(Promise.race([savePhotos([photo('p1', '2026-03-01')]), hung])).resolves.toBe(false);
  await expect(Promise.race([savePhotos([photo('p1', '2026-03-01')]), hung])).resolves.toBe(true);
});

it('removing many photos deletes them in one statement', async () => {
  const photos = Array.from({ length: 50 }, (_, i) => photo(`p${i}`, `2026-03-${String((i % 28) + 1).padStart(2, '0')}`));
  await savePhotos(photos);
  await saveAlbums([album('a1'), album('a2'), album('a3')]);
  sqliteLog.statements.length = 0;
  await expect(Promise.all([savePhotos(photos.slice(0, 1)), saveAlbums([album('a1')])])).resolves.toEqual([true, true]);
  expect(writes(/^DELETE FROM photos/)).toHaveLength(1);
  expect(writes(/^DELETE FROM albums/)).toHaveLength(1);
  expect((await rows('photos')).map((r) => r.id)).toEqual(['p0']);
  expect((await rows('albums')).map((r) => r.id)).toEqual(['a1']);
});

it('a row failing partway through a flush rolls back the rows before it', async () => {
  const good = [photo('p1', '2026-03-01'), photo('p2', '2026-03-02')];
  // The third row breaks a NOT NULL column, so SQLite itself fails the flush midway.
  const bad = { ...photo('p3', '2026-03-03'), caption: null } as unknown as PhotoEntry;
  await expect(savePhotos([...good, bad])).resolves.toBe(false);
  expect(await rows('photos')).toEqual([]);
  await expect(savePhotos([...good, photo('p3', '2026-03-03')])).resolves.toBe(true);
  expect((await rows('photos')).map((r) => r.id)).toEqual(['p1', 'p2', 'p3']);
});

it('saves made while a clear runs are dropped if it fails, not applied to the rows it left', async () => {
  await savePhotos([photo('p1', '2026-03-01'), photo('p2', '2026-03-02')]);
  failNextTransaction(new Error('disk full'));
  const clear = clearAllData();
  await Promise.resolve(); // the clear is under way
  const emptied = savePhotos([]); // built on the app emptied for the reset
  await expect(clear).resolves.toBe(false);
  await expect(emptied).resolves.toBe(false);
  expect((await rows('photos')).map((r) => r.id)).toEqual(['p1', 'p2']);
});

it('a clear that fails keeps the earlier failed change for the next save', async () => {
  const a1 = album('a1');
  const p1 = photo('p1', '2026-03-01');
  await Promise.all([saveAlbums([a1, album('a2')]), savePhotos([p1, photo('p2', '2026-03-02', { albumId: 'a2' })])]);
  failNextTransaction(new Error('disk full'));
  await expect(Promise.all([saveAlbums([a1]), savePhotos([p1])])).resolves.toEqual([false, false]);
  failNextTransaction(new Error('disk full'));
  await expect(clearAllData()).resolves.toBe(false);
  await expect(saveProfile(profile)).resolves.toBe(true);
  expect((await rows('albums')).map((r) => r.id)).toEqual(['a1']);
  expect((await rows('photos')).map((r) => r.id)).toEqual(['p1']);
});

it('saves during a commit coalesce into one later flush, in order', async () => {
  sqliteLog.transactions = 0;
  const a = savePhotos([photo('p1', '2026-03-01', { caption: 'A' })]);
  await Promise.resolve(); // the first flush is under way
  const b = savePhotos([photo('p1', '2026-03-01', { caption: 'B' })]);
  const c = savePhotos([photo('p1', '2026-03-01', { caption: 'C' })]);
  await expect(Promise.all([a, b, c])).resolves.toEqual([true, true, true]);
  expect(sqliteLog.transactions).toBe(2);
  expect((await rows('photos'))[0].caption).toBe('C');
});

it('clearAllData empties every table', async () => {
  await Promise.all([savePhotos([photo('p1', '2026-03-01')]), saveAlbums([album('a1')]), saveProfile(profile), saveSettings(getDefaultSettings())]);
  await expect(clearAllData()).resolves.toBe(true);
  expect(await rows('photos')).toEqual([]);
  expect(await rows('albums')).toEqual([]);
  expect(await rows('kv')).toEqual([]);
  // And saving afterwards starts from empty: nothing deleted that isn't there.
  await expect(savePhotos([photo('p2', '2026-03-02')])).resolves.toBe(true);
  expect((await rows('photos')).map((r) => r.id)).toEqual(['p2']);
});
