// Batch activation is the one write in the category system a user can trigger twice by accident
// (a double tap, a retry after a failed save). Idempotence here is not an optimisation — a
// second row carrying the same template key would be a duplicate "Petrol" the user cannot tell
// apart, and a partial batch would be worse.
jest.mock('../src/db/db', () => {
  const actual = jest.requireActual('../src/db/db');
  return { ...actual, getDb: () => Promise.resolve((global as any).__fakeDb), genId: () => 'genid1' };
});

import { activateSuggestedCategories } from '../src/db/categoriesRepo';

function fakeDb(
  existingByKey: Record<string, { id: string; is_hidden: number }> = {},
  options: { conflictOnInsert?: { id: string; is_hidden: number }; requireExclusive?: boolean } = {}
) {
  const statements: { sql: string; args: unknown[] }[] = [];
  const rowsByKey = { ...existingByKey };
  let transactions = 0;
  let exclusiveTransactions = 0;
  const run = (sql: string, ...args: unknown[]) => {
    statements.push({ sql, args });
    if (sql.includes('INSERT OR IGNORE INTO categories')) {
      const templateKey = args[6] as string;
      if (options.conflictOnInsert) {
        rowsByKey[templateKey] = options.conflictOnInsert;
        return Promise.resolve({ changes: 0, lastInsertRowId: 0 });
      }
      rowsByKey[templateKey] = { id: args[0] as string, is_hidden: 0 };
    }
    return Promise.resolve({ changes: 1, lastInsertRowId: 1 });
  };
  const first = (sql: string, ...args: unknown[]) => {
    if (sql.includes('template_key = ?')) return Promise.resolve(rowsByKey[args[0] as string] ?? null);
    if (sql.includes('MAX(sort)')) return Promise.resolve({ m: 12 });
    if (sql.includes('WHERE id = ?')) return Promise.resolve(null);
    return Promise.resolve(null);
  };
  const outerGuard = () => {
    if (options.requireExclusive) throw new Error('activation query used the outer database connection');
  };
  return {
    statements,
    get transactions() { return transactions; },
    get exclusiveTransactions() { return exclusiveTransactions; },
    sql: () => statements.map((s) => s.sql.replace(/\s+/g, ' ').trim()),
    runAsync: (sql: string, ...args: unknown[]) => {
      outerGuard();
      return run(sql, ...args);
    },
    getFirstAsync: (sql: string, ...args: unknown[]) => {
      outerGuard();
      return first(sql, ...args);
    },
    getAllAsync: () => Promise.resolve([]),
    execAsync: (sql: string) => {
      statements.push({ sql, args: [] });
      return Promise.resolve();
    },
    withTransactionAsync: async (fn: () => Promise<void>) => {
      transactions += 1;
      await fn();
    },
    withExclusiveTransactionAsync: async (fn: (tx: { runAsync: typeof run; getFirstAsync: typeof first }) => Promise<void>) => {
      exclusiveTransactions += 1;
      await fn({ runAsync: run, getFirstAsync: first });
    },
  };
}

const install = (db: ReturnType<typeof fakeDb>) => ((global as any).__fakeDb = db);

it('inserts a new row for a template key that is not present', async () => {
  const db = install(fakeDb());
  const ids = await activateSuggestedCategories(['optional.car.petrol.v1']);
  expect(ids).toEqual(['opt-petrol']);
  const insert = db.statements.find((s) => s.sql.includes('INSERT OR IGNORE INTO categories'));
  expect(insert?.args).toContain('opt-petrol');
  expect(insert?.args).toContain('optional.car.petrol.v1');
});

it('never creates a second row for a template key already present', async () => {
  const db = install(fakeDb({ 'optional.car.petrol.v1': { id: 'opt-petrol', is_hidden: 0 } }));
  const ids = await activateSuggestedCategories(['optional.car.petrol.v1']);
  expect(ids).toEqual(['opt-petrol']);
  expect(db.statements.some((s) => s.sql.includes('INSERT OR IGNORE INTO categories'))).toBe(false);
});

it('unhides rather than re-adds a previously hidden suggestion', async () => {
  const db = install(fakeDb({ 'optional.car.petrol.v1': { id: 'opt-petrol', is_hidden: 1 } }));
  const ids = await activateSuggestedCategories(['optional.car.petrol.v1']);
  expect(ids).toEqual(['opt-petrol']);
  expect(db.statements.some((s) => s.sql.includes('INSERT OR IGNORE INTO categories'))).toBe(false);
  const unhide = db.statements.find((s) => s.sql.includes('is_hidden'));
  expect(unhide?.args).toEqual([0, 'opt-petrol']);
});

it('activates a whole batch inside a single transaction', async () => {
  const db = install(fakeDb());
  const ids = await activateSuggestedCategories([
    'optional.car.petrol.v1',
    'optional.car.maintenance.v1',
    'optional.car.parking-tolls.v1',
  ]);
  expect(ids).toEqual(['opt-petrol', 'opt-car-maintenance', 'opt-parking-tolls']);
  expect(db.statements.filter((s) => s.sql.includes('INSERT OR IGNORE INTO categories'))).toHaveLength(3);
  expect(db.exclusiveTransactions).toBe(1);
  expect(db.transactions).toBe(0);
});

it('returns the concurrently inserted template row when its insert conflicts', async () => {
  const db = install(fakeDb({}, { conflictOnInsert: { id: 'race-winner', is_hidden: 0 } }));
  await expect(activateSuggestedCategories(['optional.car.petrol.v1'])).resolves.toEqual(['race-winner']);
  expect(db.sql()).toContain('INSERT OR IGNORE INTO categories (id, label, icon, hue, kind, is_default, sort, is_hidden, template_key) VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?)');
});

it('runs all activation queries through one exclusive transaction connection', async () => {
  const db = install(fakeDb({}, { requireExclusive: true }));
  await expect(activateSuggestedCategories(['optional.car.petrol.v1'])).resolves.toEqual(['opt-petrol']);
  expect(db.exclusiveTransactions).toBe(1);
  expect(db.transactions).toBe(0);
});

it('ignores a template key that is not in the catalogue', async () => {
  const db = install(fakeDb());
  const ids = await activateSuggestedCategories(['optional.car.spaceship.v1']);
  expect(ids).toEqual([]);
  expect(db.statements.some((s) => s.sql.includes('INSERT OR IGNORE INTO categories'))).toBe(false);
});

it('never writes a budget allocation', async () => {
  const db = install(fakeDb());
  await activateSuggestedCategories(['optional.food.groceries.v1']);
  expect(db.sql().some((s) => s.includes('budget_allocation'))).toBe(false);
});
