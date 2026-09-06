// Repo-layer behaviour for trips, exercised against a recording fake so the SQL each function
// actually issues is observable without standing up SQLite. Same idiom as dbCascades.test.ts.
jest.mock('../src/db/db', () => {
  const actual = jest.requireActual('../src/db/db');
  return { ...actual, getDb: () => Promise.resolve((global as any).__fakeDb) };
});

import {
  addTrip,
  deleteTrip,
  listTrips,
  renameTrip,
  setTransactionTrip,
  setTransactionsTrip,
  setTripArchived,
} from '../src/db/tripsRepo';

interface Statement {
  sql: string;
  args: unknown[];
}

function fakeDb(rows: { first?: Record<string, unknown>; all?: Record<string, unknown[]> } = {}) {
  const statements: Statement[] = [];
  const pick = <T,>(table: Record<string, T> | undefined, sql: string): T | undefined => {
    if (!table) return undefined;
    const key = Object.keys(table).find((k) => sql.includes(k));
    return key === undefined ? undefined : table[key];
  };
  return {
    statements,
    sql: () => statements.map((s) => s.sql.replace(/\s+/g, ' ').trim()),
    runAsync: (sql: string, ...args: unknown[]) => {
      statements.push({ sql, args });
      return Promise.resolve({ changes: 1, lastInsertRowId: 1 });
    },
    getFirstAsync: (sql: string, ..._args: unknown[]) => Promise.resolve(pick(rows.first, sql) ?? null),
    getAllAsync: (sql: string, ..._args: unknown[]) => Promise.resolve(pick(rows.all, sql) ?? []),
    execAsync: (sql: string) => {
      statements.push({ sql, args: [] });
      return Promise.resolve();
    },
    withTransactionAsync: (fn: () => Promise<void>) => fn(),
  };
}

function install(db: ReturnType<typeof fakeDb>) {
  (global as any).__fakeDb = db;
  return db;
}

afterEach(() => {
  delete (global as any).__fakeDb;
});

describe('listTrips', () => {
  it('reads every trip', async () => {
    install(
      fakeDb({
        all: {
          'FROM trips': [
            {
              id: 't1',
              name: 'Singapore',
              created_at: '2026-09-01T00:00:00.000Z',
              archived: 0,
              start_date: '2026-09-10',
              end_date: '2026-09-15',
            },
          ],
        },
      })
    );
    const trips = await listTrips();
    expect(trips).toEqual([
      {
        id: 't1',
        name: 'Singapore',
        createdAt: '2026-09-01T00:00:00.000Z',
        archived: false,
        startDate: '2026-09-10',
        endDate: '2026-09-15',
      },
    ]);
  });
});

describe('addTrip', () => {
  it('inserts a new trip row with nullable dates', async () => {
    const db = install(fakeDb());
    const trip = await addTrip('Singapore');
    const insert = db.statements.find((s) => s.sql.includes('INSERT INTO trips'));
    expect(insert).toBeDefined();
    expect(trip.name).toBe('Singapore');
    expect(trip.archived).toBe(false);
    expect(trip.startDate).toBeNull();
    expect(trip.endDate).toBeNull();
  });
});

describe('renameTrip', () => {
  it('updates the name only', async () => {
    const db = install(fakeDb());
    await renameTrip('t1', 'Singapore Sept 2026');
    const update = db.statements.find((s) => s.sql.includes('UPDATE trips SET name'));
    expect(update?.args).toEqual(['Singapore Sept 2026', 't1']);
  });
});

describe('setTripArchived', () => {
  it('archiving keeps the trip and its membership', async () => {
    const db = install(fakeDb());
    await setTripArchived('t1', true);
    expect(db.sql()).toContain('UPDATE trips SET archived = ? WHERE id = ?');
    expect(db.sql().some((s) => s.includes('trip_id = NULL'))).toBe(false);
  });
});

describe('deleteTrip', () => {
  it('deleting a trip clears membership and never touches the transactions themselves', async () => {
    const db = install(fakeDb());
    await deleteTrip('t1');
    const sql = db.sql();
    expect(sql).toContain('UPDATE transactions SET trip_id = NULL WHERE trip_id = ?');
    expect(sql).toContain('DELETE FROM trips WHERE id = ?');
    expect(sql.some((s) => s.startsWith('DELETE FROM transactions'))).toBe(false);
  });
});

describe('setTransactionsTrip', () => {
  it('attaches many transactions in one transaction', async () => {
    const db = install(fakeDb());
    await setTransactionsTrip(['a', 'b', 'c'], 't1');
    const writes = db.statements.filter((s) => s.sql.includes('SET trip_id'));
    expect(writes).toHaveLength(1);
    expect(writes[0].sql).toMatch(/WHERE id IN \(\?,\?,\?\)/);
  });

  it('returns early on an empty array without touching the database', async () => {
    const db = install(fakeDb());
    await setTransactionsTrip([], 't1');
    expect(db.statements).toHaveLength(0);
  });
});

describe('setTransactionTrip', () => {
  it('moving a transaction between trips is a plain overwrite, not an insert', async () => {
    const db = install(fakeDb());
    await setTransactionTrip('a', 't2');
    const write = db.statements.find((s) => s.sql.includes('SET trip_id'));
    expect(write?.args).toEqual(['t2', 'a']);
  });
});
