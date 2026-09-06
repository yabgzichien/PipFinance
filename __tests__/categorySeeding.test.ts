// __tests__/categorySeeding.test.ts
// Startup seeding is the single most dangerous thing in the category system: it runs on every
// launch, against every install, unattended. Before this change it upserted label/icon/hue over
// any default row, so a rename survived exactly until the app was next opened. These tests pin
// the two properties that fix depends on — additive-only seeding, and idempotence.
jest.mock('../src/db/db', () => {
  const actual = jest.requireActual('../src/db/db');
  return { ...actual, getDb: () => Promise.resolve((global as any).__fakeDb) };
});

import { __seedCategoriesForTest, __migrateCategoryOverridesForTest } from '../src/db/db';

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
    getFirstAsync: (sql: string) => Promise.resolve(pick(rows.first, sql) ?? null),
    getAllAsync: (sql: string) => Promise.resolve(pick(rows.all, sql) ?? []),
    execAsync: (sql: string) => {
      statements.push({ sql, args: [] });
      return Promise.resolve();
    },
    withTransactionAsync: (fn: () => Promise<void>) => fn(),
  };
}

describe('seedCategories', () => {
  it('never updates label, icon or hue on an existing row', async () => {
    const db = fakeDb({ all: { deleted_default_categories: [] } });
    await __seedCategoriesForTest(db as any);
    const upserts = db.sql().filter((s) => s.startsWith('INSERT INTO categories'));
    expect(upserts.length).toBeGreaterThan(0);
    for (const sql of upserts) {
      expect(sql).not.toMatch(/DO UPDATE SET[^;]*\blabel\s*=/);
      expect(sql).not.toMatch(/DO UPDATE SET[^;]*\bicon\s*=/);
      expect(sql).not.toMatch(/DO UPDATE SET[^;]*\bhue\s*=/);
    }
  });

  it('stamps a template key on every seeded row', async () => {
    const db = fakeDb({ all: { deleted_default_categories: [] } });
    await __seedCategoriesForTest(db as any);
    const inserts = db.statements.filter((s) => s.sql.includes('INSERT INTO categories'));
    expect(inserts).toHaveLength(11);
    for (const s of inserts) {
      expect(s.args.some((a) => typeof a === 'string' && a.startsWith('starter.'))).toBe(true);
    }
  });

  it('never inserts an optional catalogue category', async () => {
    const db = fakeDb({ all: { deleted_default_categories: [] } });
    await __seedCategoriesForTest(db as any);
    const all = db.statements.flatMap((s) => s.args);
    expect(all.some((a) => typeof a === 'string' && a.startsWith('opt-'))).toBe(false);
    expect(all.some((a) => typeof a === 'string' && a.startsWith('optional.'))).toBe(false);
  });

  it('skips ids the user deliberately deleted', async () => {
    const db = fakeDb({ all: { deleted_default_categories: [{ id: 'insurance' }] } });
    await __seedCategoriesForTest(db as any);
    const ids = db.statements
      .filter((s) => s.sql.includes('INSERT INTO categories'))
      .map((s) => s.args[0]);
    expect(ids).not.toContain('insurance');
    expect(ids).toContain('food');
  });
});

describe('migrateCategoryOverrides', () => {
  it('is a no-op once the meta flag is set', async () => {
    const db = fakeDb({ first: { app_meta: { value: 'done' } } });
    await __migrateCategoryOverridesForTest(db as any);
    expect(db.sql().some((s) => s.startsWith('UPDATE categories SET label_override'))).toBe(false);
  });

  it('captures a renamed default as an explicit label override', async () => {
    const db = fakeDb({
      first: { app_meta: null },
      all: {
        'SELECT id, label, icon, hue FROM categories': [
          { id: 'food', label: 'Makan', icon: 'burger', hue: 162 },
        ],
      },
    });
    await __migrateCategoryOverridesForTest(db as any);
    const write = db.statements.find((s) => s.sql.includes('label_override'));
    expect(write?.args).toContain('Makan');
    expect(write?.args).toContain('food');
  });

  it('leaves an untouched supplied label alone', async () => {
    const db = fakeDb({
      first: { app_meta: null },
      all: {
        'SELECT id, label, icon, hue FROM categories': [
          { id: 'travelling', label: 'Travelling', icon: 'car', hue: 248 },
        ],
      },
    });
    await __migrateCategoryOverridesForTest(db as any);
    expect(db.statements.some((s) => s.sql.includes('label_override'))).toBe(false);
  });
});
