import * as SQLite from 'expo-sqlite';

/**
 * The database's layout over time. Version 1 is BASELINE_SQL, frozen: installed apps already have
 * it, so it must never change. Every later change is a migration appended to MIGRATIONS, and entry
 * n takes the database from version n to n + 1. `PRAGMA user_version` records how far a database
 * has got.
 *
 * To change the schema: append a migration (and update the row types and mappings in utils/db.ts),
 * never edit BASELINE_SQL. A test pins its hash.
 */

/** Takes the database from one version to the next. It runs inside a transaction. */
export type Migration = (db: SQLite.SQLiteDatabase) => Promise<void>;

// No foreign keys: integrity stays in app logic, and an album row written after its photos must
// not fail the save.
export const BASELINE_SQL = `
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
  weight_goal TEXT,
  position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS weights (
  album_id TEXT NOT NULL,
  date TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (album_id, date)
);
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

export const MIGRATIONS: Migration[] = [];

/** The data was written by a newer app: this one doesn't know its layout and mustn't write to it. */
export class NewerDatabaseError extends Error {
  constructor(readonly found: number, readonly supported: number) {
    super(`database is at version ${found}; this app supports up to ${supported}`);
    this.name = 'NewerDatabaseError';
  }
}

/** Where the safety copy taken before migrating from `version` goes, next to the database. */
export const backupName = (version: number) => `rewind.pre-v${version}.db`;

/** A consistent copy of the open database, taken before migrating it, replacing an older copy of the same version. */
export async function backupBefore(db: SQLite.SQLiteDatabase, version: number): Promise<void> {
  const name = backupName(version);
  await SQLite.deleteDatabaseAsync(name).catch(() => {});
  const dest = await SQLite.openDatabaseAsync(name);
  try {
    await SQLite.backupDatabaseAsync({ sourceDatabase: db, destDatabase: dest });
  } finally {
    await dest.closeAsync();
  }
}

/**
 * Brings `db` up to date. A fresh database (version 0) gets the baseline and then every migration,
 * so the migrations run on every install, not just upgrades. An older one gets a safety copy, then
 * each pending migration in its own transaction, which also sets the version: a failure rolls that
 * step back and stops, and the next launch retries it. A newer one is refused untouched.
 */
export async function migrate(
  db: SQLite.SQLiteDatabase,
  migrations: Migration[] = MIGRATIONS,
  backup: (db: SQLite.SQLiteDatabase, version: number) => Promise<void> = backupBefore,
): Promise<{ from: number; to: number }> {
  const latest = 1 + migrations.length;
  const from = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  if (from > latest) throw new NewerDatabaseError(from, latest);
  if (from === latest) return { from, to: latest };

  let version = from;
  if (version === 0) {
    // No transaction needed: the baseline only creates what's missing, and the version is set last,
    // so an interrupted first launch just creates the rest next time.
    await db.execAsync(BASELINE_SQL);
    await db.execAsync('PRAGMA user_version = 1');
    version = 1;
  } else {
    await backup(db, version);
  }
  while (version < latest) {
    const step = migrations[version - 1];
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await step(db);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
  return { from, to: latest };
}
