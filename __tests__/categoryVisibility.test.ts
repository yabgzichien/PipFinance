// Hiding is a new-entry preference, not a delete. The guard these tests pin is the one the spec
// makes absolute: a user must never be able to hide their way into a kind with no visible
// category at all, because every entry screen would then have an empty grid.
jest.mock('../src/db/db', () => {
  const actual = jest.requireActual('../src/db/db');
  return { ...actual, getDb: () => Promise.resolve((global as any).__fakeDb) };
});

import { setCategoryHidden, LastVisibleCategoryError, updateCategoryLabel } from '../src/db/categoriesRepo';

function fakeDb(rows: { first?: Record<string, unknown> } = {}) {
  const statements: { sql: string; args: unknown[] }[] = [];
  const pick = (sql: string) => {
    const table = rows.first;
    if (!table) return undefined;
    const key = Object.keys(table).find((k) => sql.includes(k));
    return key === undefined ? undefined : (table as any)[key];
  };
  return {
    statements,
    sql: () => statements.map((s) => s.sql.replace(/\s+/g, ' ').trim()),
    runAsync: (sql: string, ...args: unknown[]) => {
      statements.push({ sql, args });
      return Promise.resolve({ changes: 1, lastInsertRowId: 1 });
    },
    getFirstAsync: (sql: string) => Promise.resolve(pick(sql) ?? null),
    getAllAsync: () => Promise.resolve([]),
    execAsync: (sql: string) => {
      statements.push({ sql, args: [] });
      return Promise.resolve();
    },
    withTransactionAsync: (fn: () => Promise<void>) => fn(),
  };
}

const install = (db: ReturnType<typeof fakeDb>) => ((global as any).__fakeDb = db);

describe('setCategoryHidden', () => {
  it('hides a category when others of its kind stay visible', async () => {
    const db = install(
      fakeDb({ first: { 'SELECT kind FROM categories': { kind: 'expense' }, 'COUNT(*)': { n: 4 } } })
    );
    await setCategoryHidden('opt-petrol', true);
    expect(db.sql()).toContain('UPDATE categories SET is_hidden = ? WHERE id = ?');
    const write = db.statements.find((s) => s.sql.includes('is_hidden'));
    expect(write?.args).toEqual([1, 'opt-petrol']);
  });

  it('refuses to hide the last visible category of a kind', async () => {
    install(fakeDb({ first: { 'SELECT kind FROM categories': { kind: 'income' }, 'COUNT(*)': { n: 1 } } }));
    await expect(setCategoryHidden('salary', true)).rejects.toBeInstanceOf(LastVisibleCategoryError);
  });

  it('showing again never runs the last-visible guard', async () => {
    const db = install(
      fakeDb({ first: { 'SELECT kind FROM categories': { kind: 'income' }, 'COUNT(*)': { n: 0 } } })
    );
    await expect(setCategoryHidden('salary', false)).resolves.toBeUndefined();
    const write = db.statements.find((s) => s.sql.includes('is_hidden'));
    expect(write?.args).toEqual([0, 'salary']);
  });
});

describe('updateCategoryLabel', () => {
  it('writes an override rather than the base label', async () => {
    const db = install(fakeDb());
    await updateCategoryLabel('food', '  Makan  ');
    const write = db.statements.find((s) => s.sql.includes('label_override'));
    expect(write?.args).toEqual(['Makan', 'food']);
    expect(db.sql().some((s) => /SET label\s*=/.test(s))).toBe(false);
  });

  it('clears the override when the rename is emptied', async () => {
    const db = install(fakeDb());
    await updateCategoryLabel('food', '   ');
    const write = db.statements.find((s) => s.sql.includes('label_override'));
    expect(write?.args).toEqual([null, 'food']);
  });
});
