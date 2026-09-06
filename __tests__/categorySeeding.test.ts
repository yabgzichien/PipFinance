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

interface StoredCategory extends Record<string, unknown> {
  id: string;
}

function fakeDb(rows: { first?: Record<string, unknown>; all?: Record<string, unknown[]> } = {}) {
  const statements: Statement[] = [];
  const initialCategories = (rows.all?.['SELECT id, label, icon, hue FROM categories'] ?? []) as unknown as StoredCategory[];
  const categories = new Map<string, StoredCategory>(
    initialCategories.map((row) => [String(row.id), { ...row, is_default: row.is_default ?? 1 }])
  );
  const meta = new Map<string, string>();
  const initialMeta = rows.first?.app_meta as { value?: string } | null | undefined;
  if (initialMeta?.value !== undefined) meta.set('cat_override_migration_v1', initialMeta.value);
  const pick = <T,>(table: Record<string, T> | undefined, sql: string): T | undefined => {
    if (!table) return undefined;
    const key = Object.keys(table).find((k) => sql.includes(k));
    return key === undefined ? undefined : table[key];
  };
  return {
    statements,
    persistedCategories: () => [...categories.values()].map((row) => ({ ...row })),
    persistedMeta: () => Object.fromEntries(meta),
    sql: () => statements.map((s) => s.sql.replace(/\s+/g, ' ').trim()),
    runAsync: (sql: string, ...args: unknown[]) => {
      statements.push({ sql, args });
      const normalized = sql.replace(/\s+/g, ' ').trim();
      if (normalized.startsWith('INSERT INTO categories')) {
        const [id, label, icon, hue, kind, sort, templateKey] = args;
        const existing = categories.get(String(id));
        if (!existing) {
          categories.set(String(id), {
            id: String(id), label, icon, hue, kind, is_default: 1, sort, template_key: templateKey,
          });
        } else if (existing.is_default === 1) {
          // Model the upsert's persisted effects, including any future presentation assignment
          // that would make the rerun test fail instead of merely comparing SQL text.
          if (/\blabel\s*=\s*excluded\.label\b/.test(normalized)) existing.label = label;
          if (/\bicon\s*=\s*excluded\.icon\b/.test(normalized)) existing.icon = icon;
          if (/\bhue\s*=\s*excluded\.hue\b/.test(normalized)) existing.hue = hue;
          existing.kind = kind;
          existing.sort = sort;
          existing.template_key ??= templateKey;
        }
      } else if (normalized.startsWith("UPDATE categories SET kind = 'income'")) {
        for (const id of args) {
          const category = categories.get(String(id));
          if (category) category.kind = 'income';
        }
      } else if (normalized.startsWith('UPDATE categories SET label_override')) {
        const [labelOverride, iconOverride, hueOverride, id] = args;
        const category = categories.get(String(id));
        if (category) {
          category.label_override ??= labelOverride;
          category.icon_override ??= iconOverride;
          category.hue_override ??= hueOverride;
        }
      } else if (normalized.startsWith('INSERT OR REPLACE INTO app_meta')) {
        meta.set(String(args[0]), String(args[1]));
      }
      return Promise.resolve({ changes: 1, lastInsertRowId: 1 });
    },
    getFirstAsync: (sql: string) => {
      if (sql.includes('FROM app_meta')) {
        const value = meta.get('cat_override_migration_v1');
        return Promise.resolve(value === undefined ? null : { value });
      }
      return Promise.resolve(pick(rows.first, sql) ?? null);
    },
    getAllAsync: (sql: string) => {
      if (sql.includes('SELECT id, label, icon, hue FROM categories')) {
        return Promise.resolve([...categories.values()].filter((row) => row.is_default === 1));
      }
      return Promise.resolve(pick(rows.all, sql) ?? []);
    },
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

  it('is idempotent against persisted rows without duplicating or changing presentation', async () => {
    const db = fakeDb({
      all: {
        deleted_default_categories: [],
        'SELECT id, label, icon, hue FROM categories': [
          {
            id: 'food', label: 'Makan', icon: 'data:image/png;base64,custom', hue: 7,
            kind: 'expense', is_default: 1, sort: 99, template_key: 'starter.food',
          },
        ],
      },
    });
    await __seedCategoriesForTest(db as any);
    const afterFirstSeed = db.persistedCategories();
    expect(afterFirstSeed).toHaveLength(11);
    await __seedCategoriesForTest(db as any);
    expect(db.persistedCategories()).toEqual(afterFirstSeed);
    expect(db.persistedCategories()).toContainEqual(expect.objectContaining({
      id: 'food', label: 'Makan', icon: 'data:image/png;base64,custom', hue: 7,
    }));
  });
});

describe('migrateCategoryOverrides', () => {
  it('is a no-op once the meta flag is set, even when a row looks renamed', async () => {
    // The `all` fixture below supplies a genuinely renamed row (label 'Makan' is not any
    // historical wording for 'food') so this test would fail if the `if (done) return;` guard
    // were ever deleted — a bare "no `all` rows configured" fixture would pass either way.
    const db = fakeDb({
      first: { app_meta: { value: 'done' } },
      all: {
        'SELECT id, label, icon, hue FROM categories': [
          { id: 'food', label: 'Makan', icon: 'burger', hue: 162 },
        ],
      },
    });
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

  it('captures a genuinely custom icon as an icon override', async () => {
    const db = fakeDb({
      first: { app_meta: null },
      all: {
        'SELECT id, label, icon, hue FROM categories': [
          { id: 'food', label: 'Food', icon: 'data:image/png;base64,abc', hue: 162 },
        ],
      },
    });
    await __migrateCategoryOverridesForTest(db as any);
    const write = db.statements.find((s) => s.sql.includes('icon_override'));
    expect(write?.args).toContain('data:image/png;base64,abc');
  });

  it('does not treat a historical (but not current) icon as a user edit', async () => {
    // 'cart' is food's OLD supplied icon (current is 'burger'). Before the icon/hue historical
    // tables existed, this would have been misread as a user edit and pinned as a permanent
    // override — exactly the bug this test guards against.
    const db = fakeDb({
      first: { app_meta: null },
      all: {
        'SELECT id, label, icon, hue FROM categories': [
          { id: 'food', label: 'Food', icon: 'cart', hue: 162 },
        ],
      },
    });
    await __migrateCategoryOverridesForTest(db as any);
    expect(db.statements.some((s) => s.sql.includes('icon_override'))).toBe(false);
  });

  it('captures a genuinely custom hue as a hue override', async () => {
    const db = fakeDb({
      first: { app_meta: null },
      all: {
        'SELECT id, label, icon, hue FROM categories': [
          { id: 'food', label: 'Food', icon: 'burger', hue: 7 },
        ],
      },
    });
    await __migrateCategoryOverridesForTest(db as any);
    const write = db.statements.find((s) => s.sql.includes('hue_override'));
    expect(write?.args).toContain(7);
  });

  it('does not treat a historical (but not current) hue as a user edit', async () => {
    // 330 is shopping's OLD supplied hue (current is 42).
    const db = fakeDb({
      first: { app_meta: null },
      all: {
        'SELECT id, label, icon, hue FROM categories': [
          { id: 'shopping', label: 'Shopping', icon: 'cart', hue: 330 },
        ],
      },
    });
    await __migrateCategoryOverridesForTest(db as any);
    expect(db.statements.some((s) => s.sql.includes('hue_override'))).toBe(false);
  });

  it('is idempotent against the same persisted flag and category row', async () => {
    const db = fakeDb({
      first: { app_meta: null },
      all: {
        'SELECT id, label, icon, hue FROM categories': [
          { id: 'food', label: 'Makan', icon: 'burger', hue: 162 },
        ],
      },
    });
    await __migrateCategoryOverridesForTest(db as any);
    const afterFirstMigration = db.persistedCategories();
    const afterFirstMeta = db.persistedMeta();
    const firstStatementCount = db.statements.length;
    expect(afterFirstMeta).toEqual({ cat_override_migration_v1: 'done' });
    expect(afterFirstMigration).toContainEqual(expect.objectContaining({ id: 'food', label_override: 'Makan' }));

    await __migrateCategoryOverridesForTest(db as any);
    expect(db.persistedCategories()).toEqual(afterFirstMigration);
    expect(db.persistedMeta()).toEqual(afterFirstMeta);
    expect(db.statements).toHaveLength(firstStatementCount);
  });
});
