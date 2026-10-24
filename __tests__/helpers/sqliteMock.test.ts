import { sqliteMock, sqliteLog, failNextTransaction, resetSqliteForTests } from './sqliteMock';

beforeEach(() => resetSqliteForTests());

async function freshDb() {
  const db = await sqliteMock.openDatabaseAsync('test.db');
  await db.execAsync('CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER)');
  return db;
}

it('runs real SQL', async () => {
  const db = await freshDb();
  await db.runAsync('INSERT INTO t (id, n) VALUES (?, ?)', 'a', 1);
  await db.runAsync('INSERT INTO t (id, n) VALUES (?, ?)', ['b', 2]);
  expect(await db.getAllAsync('SELECT id, n FROM t ORDER BY id')).toEqual([{ id: 'a', n: 1 }, { id: 'b', n: 2 }]);
  expect(await db.getFirstAsync('SELECT n FROM t WHERE id = ?', 'b')).toEqual({ n: 2 });
  expect(await db.getFirstAsync('SELECT n FROM t WHERE id = ?', 'zzz')).toBeNull();
});

it('shares one database per name until reset', async () => {
  const db = await freshDb();
  await db.runAsync('INSERT INTO t (id, n) VALUES (?, ?)', 'a', 1);
  const again = await sqliteMock.openDatabaseAsync('test.db');
  expect(await again.getAllAsync('SELECT id FROM t')).toEqual([{ id: 'a' }]);
  resetSqliteForTests();
  const fresh = await sqliteMock.openDatabaseAsync('test.db');
  await expect(fresh.getAllAsync('SELECT id FROM t')).rejects.toThrow(/no such table/);
});

it('a failed transaction rolls back', async () => {
  const db = await freshDb();
  await expect(db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO t (id, n) VALUES (?, ?)', 'a', 1);
    throw new Error('boom');
  })).rejects.toThrow('boom');
  expect(await db.getAllAsync('SELECT id FROM t')).toEqual([]);
});

it('failNextTransaction rolls back the next commit only', async () => {
  const db = await freshDb();
  failNextTransaction(new Error('disk full'));
  await expect(db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO t (id, n) VALUES (?, ?)', 'a', 1);
  })).rejects.toThrow('disk full');
  expect(await db.getAllAsync('SELECT id FROM t')).toEqual([]);
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO t (id, n) VALUES (?, ?)', 'b', 2);
  });
  expect(await db.getAllAsync('SELECT id FROM t')).toEqual([{ id: 'b' }]);
});

it('logs statements and transactions', async () => {
  const db = await freshDb();
  sqliteLog.statements.length = 0;
  sqliteLog.transactions = 0;
  await db.withTransactionAsync(async () => {
    await db.runAsync('  INSERT INTO t (id, n) VALUES (?, ?)', 'a', 1);
  });
  expect(sqliteLog.transactions).toBe(1);
  expect(sqliteLog.statements).toEqual(['INSERT INTO t (id, n) VALUES (?, ?)']);
});

it('prepared statements run with params and log each execution', async () => {
  const db = await freshDb();
  sqliteLog.statements.length = 0;
  const statement = await db.prepareAsync('INSERT INTO t (id, n) VALUES (?, ?)');
  await statement.executeAsync('a', 1);
  await statement.executeAsync(['b', 2]);
  await statement.finalizeAsync();
  expect(await db.getAllAsync('SELECT id, n FROM t ORDER BY id')).toEqual([{ id: 'a', n: 1 }, { id: 'b', n: 2 }]);
  expect(sqliteLog.statements).toEqual(['INSERT INTO t (id, n) VALUES (?, ?)', 'INSERT INTO t (id, n) VALUES (?, ?)']);
});
