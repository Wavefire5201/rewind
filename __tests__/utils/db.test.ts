import { getDb, resetDbForTests, photoToRow, rowToPhoto, albumToRow, rowToAlbum, SCHEMA_VERSION } from '@/utils/db';
import { sqliteLog, resetSqliteForTests } from '../helpers/sqliteMock';
import type { PhotoEntry, Album } from '@/types';

beforeEach(() => {
  resetSqliteForTests();
  resetDbForTests();
});

const fullPhoto: PhotoEntry = {
  id: 'p1',
  albumId: 'a1',
  date: '2026-03-05',
  imageUri: 'file:///document/p1_q95.jpg',
  thumbUri: 'file:///document/p1_q95_thumb.jpg',
  caption: 'first day',
  capturedAt: '2026-03-05T12:00:00.000Z',
  cameraDirection: 'front',
  encoding: 'q95',
  faceLandmarks: {
    leftEye: { x: 0.4, y: 0.4 }, rightEye: { x: 0.6, y: 0.4 }, noseTip: { x: 0.5, y: 0.5 },
    faceBounds: { x: 0.3, y: 0.3, width: 0.4, height: 0.5 }, rollAngle: 1.5, yawAngle: -2, isMirrored: true,
  },
  faceScan: {
    v: 2,
    eyes: { left: { x: 0.41, y: 0.42 }, right: { x: 0.59, y: 0.42 } },
    width: 2448,
    height: 3264,
    measure: { ipd: 420, closeness: 0.17, jaw: 1.9, lowJaw: 1.5, cheek: 2.1, yaw: 2, pitch: -3, roll: 1, smile: 0.1, jawOpen: 0.05 },
  },
};

const minimalPhoto: PhotoEntry = {
  id: 'p2', albumId: 'a1', date: '2026-03-06', imageUri: 'file:///document/p2.jpg', caption: '',
  capturedAt: '2026-03-06T12:00:00.000Z', cameraDirection: 'back',
};

it('opens once with WAL, synchronous FULL and schema version 1', async () => {
  const db = await getDb();
  expect(await getDb()).toBe(db);
  expect(SCHEMA_VERSION).toBe(1);
  const issued = sqliteLog.statements.join('\n');
  expect(issued).toMatch(/PRAGMA journal_mode = WAL/);
  expect(issued).toMatch(/PRAGMA synchronous = FULL/);
  // In-memory databases can't use WAL; the device's file database can.
  expect(['wal', 'memory']).toContain((await db.getFirstAsync<{ journal_mode: string }>('PRAGMA journal_mode'))?.journal_mode);
  expect((await db.getFirstAsync<{ synchronous: number }>('PRAGMA synchronous'))?.synchronous).toBe(2);
  expect((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(1);
});

it('creates the photos, albums and kv tables and the album/date index', async () => {
  const db = await getDb();
  const names = (await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type IN ('table', 'index') ORDER BY name")).map((r) => r.name);
  expect(names).toEqual(expect.arrayContaining(['photos', 'albums', 'kv', 'photos_album_date']));
});

it('a photo round-trips through its row', () => {
  expect(rowToPhoto(photoToRow(fullPhoto))).toEqual(fullPhoto);
});

it('optional fields round-trip as absent, not null', () => {
  const back = rowToPhoto(photoToRow(minimalPhoto));
  expect(back).toEqual(minimalPhoto);
  for (const key of ['faceScan', 'thumbUri', 'encoding', 'faceLandmarks'] as const) {
    expect(key in back).toBe(false);
  }
});

it('a scanned photo with no face keeps its null eyes', () => {
  const noFace: PhotoEntry = { ...minimalPhoto, faceScan: { v: 2, eyes: null, width: 100, height: 133, measure: null } };
  expect(rowToPhoto(photoToRow(noFace)).faceScan).toEqual({ v: 2, eyes: null, width: 100, height: 133, measure: null });
});

it('an album round-trips with its framing', () => {
  const album: Album = {
    id: 'a1', name: 'daily', createdAt: '2026-01-01T12:00:00.000Z', reminderEnabled: true, reminderTime: '08:30',
    isLocked: false, framing: { x: 0.5, y: 0.42, dist: 0.3 },
  };
  expect(rowToAlbum(albumToRow(album, 3))).toEqual(album);
  expect(albumToRow(album, 3).position).toBe(3);
  const plainAlbum: Album = { ...album, framing: undefined };
  delete plainAlbum.framing;
  expect('framing' in rowToAlbum(albumToRow(plainAlbum, 0))).toBe(false);
});

it('photo and album rows insert into their tables', async () => {
  const db = await getDb();
  const row = photoToRow(fullPhoto);
  const cols = Object.keys(row);
  await db.runAsync(`INSERT INTO photos (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, ...Object.values(row));
  const stored = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM photos WHERE id = ?', 'p1');
  expect(rowToPhoto(stored as never)).toEqual(fullPhoto);
});

it("a JSON column that won't parse is left out, so one bad row can't stop the app loading", () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const back = rowToPhoto({ ...photoToRow(fullPhoto), face_scan: '{not json', face_landmarks: '[' });
  // A missing scan is redone by the backfill; the rest of the photo is intact.
  expect('faceScan' in back).toBe(false);
  expect('faceLandmarks' in back).toBe(false);
  expect(back.caption).toBe('first day');
  const album: Album = {
    id: 'a1', name: 'daily', createdAt: '2026-01-01T12:00:00.000Z', reminderEnabled: false, reminderTime: '08:00', isLocked: false,
  };
  expect(rowToAlbum({ ...albumToRow(album, 0), framing: 'nope' })).toEqual(album);
  warn.mockRestore();
});
