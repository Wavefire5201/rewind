/** expo-sqlite stand-in that runs real SQL: Node's built-in `node:sqlite`, one in-memory database
 *  per name. Implements the async API the app uses (openDatabaseAsync, execAsync, runAsync,
 *  getAllAsync, getFirstAsync, withTransactionAsync, closeAsync), so storage tests exercise real
 *  queries, constraints and rollbacks rather than a fake.
 *
 *    jest.setup.js: jest.mock('expo-sqlite', () => require('./__tests__/helpers/sqliteMock').sqliteMock);
 *    tests:         failNextTransaction() to make the next commit fail; sqliteLog to count writes. */

type Row = Record<string, unknown>;
interface NodeStatement {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  all(...params: unknown[]): Row[];
  get(...params: unknown[]): Row | undefined;
}
interface NodeDb {
  exec(sql: string): void;
  prepare(sql: string): NodeStatement;
  close(): void;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => NodeDb };

/** Every runAsync/execAsync statement (trimmed), and how many transactions were started. */
export const sqliteLog: { statements: string[]; transactions: number } = { statements: [], transactions: 0 };

const databases = new Map<string, NodeDb>();
let pendingFailure: Error | null = null;

/** The next withTransactionAsync fails just before COMMIT, rolling back what it wrote. */
export function failNextTransaction(error: Error = new Error('simulated write failure')): void {
  pendingFailure = error;
}

export function resetSqliteForTests(): void {
  databases.forEach((db) => { try { db.close(); } catch {} });
  databases.clear();
  sqliteLog.statements.length = 0;
  sqliteLog.transactions = 0;
  pendingFailure = null;
}

// expo-sqlite takes either spread params or one array (or one named-params object).
const paramsOf = (params: unknown[]): unknown[] => (params.length === 1 && Array.isArray(params[0]) ? params[0] : params);
// node:sqlite rows have a null prototype; tests compare against plain objects.
const plain = (row: Row): Row => ({ ...row });

export interface MockDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: unknown[]): Promise<{ changes: number; lastInsertRowId: number }>;
  getAllAsync<T = Row>(sql: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T = Row>(sql: string, ...params: unknown[]): Promise<T | null>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}

function wrap(name: string, db: NodeDb): MockDb {
  return {
    async execAsync(sql) {
      sqliteLog.statements.push(sql.trim());
      db.exec(sql);
    },
    async runAsync(sql, ...params) {
      sqliteLog.statements.push(sql.trim());
      const result = db.prepare(sql).run(...paramsOf(params));
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]) {
      return db.prepare(sql).all(...paramsOf(params)).map(plain) as T[];
    },
    async getFirstAsync<T>(sql: string, ...params: unknown[]) {
      const row = db.prepare(sql).get(...paramsOf(params));
      return (row ? plain(row) : null) as T | null;
    },
    async withTransactionAsync(fn) {
      sqliteLog.transactions += 1;
      db.exec('BEGIN');
      try {
        await fn();
        if (pendingFailure) {
          const error = pendingFailure;
          pendingFailure = null;
          throw error;
        }
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    async closeAsync() {
      db.close();
      databases.delete(name);
    },
  };
}

export const sqliteMock = {
  __esModule: true,
  async openDatabaseAsync(name: string): Promise<MockDb> {
    let db = databases.get(name);
    if (!db) {
      db = new DatabaseSync(':memory:');
      databases.set(name, db);
    }
    return wrap(name, db);
  },
};
