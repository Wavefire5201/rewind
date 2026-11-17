import { createHash } from 'node:crypto';
import * as SQLite from 'expo-sqlite';
import { BASELINE_SQL, migrate, NewerDatabaseError, type Migration } from '@/utils/migrations';
import { getDb, resetDbForTests, DB_NAME, SCHEMA_VERSION } from '@/utils/db';
import { sqliteLog, resetSqliteForTests } from '../helpers/sqliteMock';

beforeEach(() => {
  resetSqliteForTests();
  resetDbForTests();
});

const open = (name = 'm.db') => SQLite.openDatabaseAsync(name);
const version = async (db: SQLite.SQLiteDatabase) => (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version;
const schema = async (db: SQLite.SQLiteDatabase) =>
  (await db.getAllAsync<{ sql: string }>("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY name")).map((r) => r.sql);

// Test-only migrations: the app has none yet, so the runner is exercised with these.
const addExtra: Migration = async (db) => { await db.execAsync('CREATE TABLE extra (id TEXT PRIMARY KEY NOT NULL)'); };
const addNote: Migration = async (db) => { await db.execAsync('ALTER TABLE extra ADD COLUMN note TEXT'); };

it('the version 1 baseline never changes: schema changes are migrations', () => {
  // If this fails you edited BASELINE_SQL. Revert it and add a migration instead: installed apps
  // already have version 1 and would never see the edit.
  expect(createHash('sha256').update(BASELINE_SQL).digest('hex')).toBe(BASELINE_HASH);
});

it('a fresh database gets the baseline and every migration, without a safety copy', async () => {
  const db = await open();
  const backup = jest.fn();
  await expect(migrate(db, [addExtra, addNote], backup)).resolves.toEqual({ from: 0, to: 3 });
  expect(await version(db)).toBe(3);
  expect((await schema(db)).join('\n')).toMatch(/CREATE TABLE extra \(id TEXT PRIMARY KEY NOT NULL, note TEXT\)/);
  expect(backup).not.toHaveBeenCalled();
});

it('an older database runs only the pending migrations, after a safety copy of its version', async () => {
  const db = await open();
  await migrate(db, [addExtra], jest.fn());
  await db.runAsync("INSERT INTO albums (id, name, created_at, reminder_enabled, reminder_time, is_locked, position) VALUES ('a', 'daily', '2026-01-01', 0, '08:00', 0, 0)");
  const backup = jest.fn(async () => {});
  const ran = jest.fn(addNote);
  await expect(migrate(db, [addExtra, ran], backup)).resolves.toEqual({ from: 2, to: 3 });
  expect(backup).toHaveBeenCalledWith(db, 2);
  expect(ran).toHaveBeenCalledTimes(1);
  expect(await db.getAllAsync('SELECT id FROM albums')).toEqual([{ id: 'a' }]);
});

it('the default safety copy holds the data as it was before migrating', async () => {
  const db = await open(DB_NAME);
  await migrate(db, [], jest.fn());
  await db.runAsync("INSERT INTO kv (key, value) VALUES ('profile', '{}')");
  await migrate(db, [addExtra]);
  const copy = await open('rewind.pre-v1.db');
  expect(await version(copy)).toBe(1);
  expect(await copy.getAllAsync('SELECT key FROM kv')).toEqual([{ key: 'profile' }]);
  expect((await schema(copy)).join('\n')).not.toMatch(/extra/);
});

it('a failing migration rolls back and stays at the old version; the next launch retries', async () => {
  const db = await open();
  await migrate(db, [], jest.fn());
  const broken: Migration = async (d) => {
    await d.execAsync('CREATE TABLE half (id TEXT)');
    throw new Error('boom');
  };
  await expect(migrate(db, [broken], jest.fn(async () => {}))).rejects.toThrow('boom');
  expect(await version(db)).toBe(1);
  expect((await schema(db)).join('\n')).not.toMatch(/half/);
  await expect(migrate(db, [addExtra], jest.fn(async () => {}))).resolves.toEqual({ from: 1, to: 2 });
});

it('a newer database is refused and left untouched', async () => {
  const db = await open();
  await db.execAsync('PRAGMA user_version = 5');
  sqliteLog.statements.length = 0;
  const backup = jest.fn();
  const error = await migrate(db, [addExtra], backup).catch((e) => e);
  expect(error).toBeInstanceOf(NewerDatabaseError);
  expect(error).toMatchObject({ found: 5, supported: 2 });
  expect(sqliteLog.statements).toEqual([]);
  expect(backup).not.toHaveBeenCalled();
});

it('a migrated database matches a freshly created one', async () => {
  const old = await open('old.db');
  await migrate(old, [addExtra], jest.fn());
  await migrate(old, [addExtra, addNote], jest.fn(async () => {}));
  const fresh = await open('fresh.db');
  await migrate(fresh, [addExtra, addNote], jest.fn());
  expect(await schema(old)).toEqual(await schema(fresh));
});

describe('getDb', () => {
  it(`opens at the current version (${SCHEMA_VERSION})`, async () => {
    const db = await getDb();
    expect(await version(db)).toBe(SCHEMA_VERSION);
  });

  it('rejects a newer database, and a later call tries again', async () => {
    const raw = await SQLite.openDatabaseAsync(DB_NAME);
    await raw.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    await expect(getDb()).rejects.toBeInstanceOf(NewerDatabaseError);
    await raw.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    await expect(getDb()).resolves.toBeTruthy();
  });
});

const BASELINE_HASH = 'f49ed6dcf92dab9486722f48f4bd2c438a1abf2484268c07aaf2cdeb5bb2a375';
