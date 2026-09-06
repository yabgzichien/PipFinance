// Batch activation is the one write in the category system a user can trigger twice by accident
// (a double tap, a retry after a failed save). Idempotence here is not an optimisation — a
// second row carrying the same template key would be a duplicate "Petrol" the user cannot tell
// apart, and a partial batch would be worse.
jest.mock('../src/db/db', () => {
  const actual = jest.requireActual('../src/db/db');
  return { ...actual, getDb: () => Promise.resolve((global as any).__fakeDb), genId: () => 'genid1' };
});

import { activateSuggestedCategories } from '../src/db/categoriesRepo';

function fakeDb(existingByKey: Record<string, { id: string; is_hidden: number }> = {}) {
  const statements: { sql: string; args: unknown[] }[] = [];
  return {
    statements,
    sql: () => statements.map((s) => s.sql.replace(/\s+/g, ' ').trim()),
    runAsync: (sql: string, ...args: unknown[]) => {
      statements.push({ sql, args });
      return Promise.resolve({ changes: 1, lastInsertRowId: 1 });
    },
    getFirstAsync: (sql: string, ...args: unknown[]) => {
      if (sql.includes('template_key = ?')) return Promise.resolve(existingByKey[args[0] as string] ?? null);
      if (sql.includes('MAX(sort)')) return Promise.resolve({ m: 12 });
      if (sql.includes('WHERE id = ?')) return Promise.resolve(null);
      return Promise.resolve(null);
    },
    getAllAsync: () => Promise.resolve([]),
    execAsync: (sql: string) => {
      statements.push({ sql, args: [] });
      return Promise.resolve();
    },
    withTransactionAsync: (fn: () => Promise<void>) => fn(),
  };
}

const install = (db: ReturnType<typeof fakeDb>) => ((global as any).__fakeDb = db);

it('inserts a new row for a template key that is not present', async () => {
  const db = install(fakeDb());
  const ids = await activateSuggestedCategories(['optional.car.petrol.v1']);
  expect(ids).toEqual(['opt-petrol']);
  const insert = db.statements.find((s) => s.sql.includes('INSERT INTO categories'));
  expect(insert?.args).toContain('opt-petrol');
  expect(insert?.args).toContain('optional.car.petrol.v1');
});

it('never creates a second row for a template key already present', async () => {
  const db = install(fakeDb({ 'optional.car.petrol.v1': { id: 'opt-petrol', is_hidden: 0 } }));
  const ids = await activateSuggestedCategories(['optional.car.petrol.v1']);
  expect(ids).toEqual(['opt-petrol']);
  expect(db.statements.some((s) => s.sql.includes('INSERT INTO categories'))).toBe(false);
});

it('unhides rather than re-adds a previously hidden suggestion', async () => {
  const db = install(fakeDb({ 'optional.car.petrol.v1': { id: 'opt-petrol', is_hidden: 1 } }));
  const ids = await activateSuggestedCategories(['optional.car.petrol.v1']);
  expect(ids).toEqual(['opt-petrol']);
  expect(db.statements.some((s) => s.sql.includes('INSERT INTO categories'))).toBe(false);
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
  expect(db.statements.filter((s) => s.sql.includes('INSERT INTO categories'))).toHaveLength(3);
});

it('ignores a template key that is not in the catalogue', async () => {
  const db = install(fakeDb());
  const ids = await activateSuggestedCategories(['optional.car.spaceship.v1']);
  expect(ids).toEqual([]);
  expect(db.statements.some((s) => s.sql.includes('INSERT INTO categories'))).toBe(false);
});

it('never writes a budget allocation', async () => {
  const db = install(fakeDb());
  await activateSuggestedCategories(['optional.food.groceries.v1']);
  expect(db.sql().some((s) => s.includes('budget_allocation'))).toBe(false);
});
