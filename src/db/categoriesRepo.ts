import { getDb } from './db';
import { optionalByTemplateKey, type OptionalCategory } from '../data/optionalCategories';
import type { Category } from '../lib/types';

interface CatRow {
  id: string;
  label: string;
  icon: string;
  hue: number;
  kind: string;
  is_default: number;
  sort: number;
  is_hidden: number | null;
  template_key: string | null;
  label_override: string | null;
  icon_override: string | null;
  hue_override: number | null;
}

function toCategory(r: CatRow): Category {
  return {
    id: r.id,
    label: r.label,
    icon: r.icon,
    hue: r.hue,
    kind: r.kind === 'income' ? 'income' : 'expense',
    isDefault: !!r.is_default,
    // A row written before the 2026-09-06 migration answers NULL on every new column; every one
    // of those reads as "no opinion", which is exactly the pre-migration behaviour.
    isHidden: !!r.is_hidden,
    templateKey: r.template_key ?? null,
    labelOverride: r.label_override ?? null,
    iconOverride: r.icon_override ?? null,
    hueOverride: r.hue_override ?? null,
  };
}

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CatRow>('SELECT * FROM categories ORDER BY sort ASC, label ASC');
  return rows.map(toCategory);
}

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'cat'
  );
}

async function uniqueId(base: string): Promise<string> {
  const db = await getDb();
  let id = base;
  let n = 2;
  while (await db.getFirstAsync('SELECT 1 FROM categories WHERE id = ?', id)) {
    id = `${base}-${n++}`;
  }
  return id;
}

export async function addCategory(
  label: string,
  icon: string,
  hue: number,
  kind: Category['kind']
): Promise<Category> {
  const db = await getDb();
  const id = await uniqueId(slugify(label));
  const sortRow = await db.getFirstAsync<{ m: number }>(
    'SELECT COALESCE(MAX(sort), 0) + 1 AS m FROM categories'
  );
  await db.runAsync(
    'INSERT INTO categories (id, label, icon, hue, kind, is_default, sort) VALUES (?, ?, ?, ?, ?, 0, ?)',
    id,
    label.trim(),
    icon,
    hue,
    kind,
    sortRow?.m ?? 0
  );
  return {
    id,
    label: label.trim(),
    icon,
    hue,
    kind,
    isDefault: false,
    isHidden: false,
    templateKey: null,
    labelOverride: null,
    iconOverride: null,
    hueOverride: null,
  };
}

/** Change a category's icon/picture — a named icon (see Icon.tsx) or a data:/file:/content:/http(s):
 *  URI for a custom photo. Written as an explicit override so the startup seed cannot revert it. */
export async function updateCategoryIcon(id: string, icon: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE categories SET icon_override = ? WHERE id = ?', icon, id);
}

/** Rename a category. Blank clears the rename and restores Pip's supplied wording. */
export async function updateCategoryLabel(id: string, label: string): Promise<void> {
  const db = await getDb();
  const trimmed = label.trim();
  await db.runAsync('UPDATE categories SET label_override = ? WHERE id = ?', trimmed || null, id);
}

/** Change a category's colour. Same override contract as icon and label. */
export async function updateCategoryHue(id: string, hue: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE categories SET hue_override = ? WHERE id = ?', hue, id);
}

/** Thrown when hiding would leave an expense or income entry grid empty. */
export class LastVisibleCategoryError extends Error {
  constructor(public kind: 'expense' | 'income') {
    super(`Cannot hide the last visible ${kind} category`);
  }
}

/** How many categories of a kind are currently offered for new entries. */
export async function countVisible(kind: 'expense' | 'income'): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM categories WHERE kind = ? AND is_hidden = 0',
    kind
  );
  return row?.n ?? 0;
}

/** Hide a category from new-entry choices, or show that same historical row again. */
export async function setCategoryHidden(id: string, hidden: boolean): Promise<void> {
  const db = await getDb();
  if (!hidden) {
    await db.runAsync('UPDATE categories SET is_hidden = ? WHERE id = ?', 0, id);
    return;
  }

  // The count lives in the same statement as the state transition. Two simultaneous hide taps
  // cannot both pass this predicate: after one succeeds, the other affects zero rows.
  const result = await db.runAsync(
    `UPDATE categories SET is_hidden = 1
     WHERE id = ? AND is_hidden = 0
       AND 1 < (SELECT COUNT(*) FROM categories
                WHERE kind = (SELECT kind FROM categories WHERE id = ?) AND is_hidden = 0)`,
    id,
    id
  );
  if (result.changes > 0) return;

  // A zero-row conditional update is harmless for rows which disappeared or were already
  // hidden (including a concurrent repeat). A still-visible row means the count predicate was
  // the reason it missed, so hiding it would empty its kind.
  const row = await db.getFirstAsync<{ kind: string; is_hidden: number }>(
    'SELECT kind, is_hidden FROM categories WHERE id = ?',
    id
  );
  if (!row || row.is_hidden) return;
  throw new LastVisibleCategoryError(row.kind === 'income' ? 'income' : 'expense');
}

/**
 * Turn on one or more catalogue suggestions atomically. Template keys, rather than labels,
 * preserve idempotence for repeats and distinguish catalogue categories from user-made matches.
 */
export async function activateSuggestedCategories(templateKeys: string[]): Promise<string[]> {
  const db = await getDb();
  const wanted = templateKeys
    .map((key) => optionalByTemplateKey(key))
    .filter((category): category is OptionalCategory => !!category);
  if (wanted.length === 0) return [];

  const ids: string[] = [];
  await db.withTransactionAsync(async () => {
    const sortRow = await db.getFirstAsync<{ m: number }>(
      'SELECT COALESCE(MAX(sort), 0) + 1 AS m FROM categories'
    );
    let sort = sortRow?.m ?? 0;

    for (const category of wanted) {
      const existing = await db.getFirstAsync<{ id: string; is_hidden: number }>(
        'SELECT id, is_hidden FROM categories WHERE template_key = ?',
        category.templateKey
      );
      if (existing) {
        if (existing.is_hidden) {
          await db.runAsync('UPDATE categories SET is_hidden = ? WHERE id = ?', 0, existing.id);
        }
        ids.push(existing.id);
        continue;
      }

      let id = await uniqueId(category.id);
      while (true) {
        // The partial unique index on template_key makes concurrent repeated activations
        // converge. An unrelated id collision retries a collision-safe suffix instead.
        await db.runAsync(
          `INSERT OR IGNORE INTO categories (id, label, icon, hue, kind, is_default, sort, is_hidden, template_key)
             VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?)`,
          id,
          category.label,
          category.icon,
          category.hue,
          category.kind,
          sort,
          category.templateKey
        );
        const resulting = await db.getFirstAsync<{ id: string; is_hidden: number }>(
          'SELECT id, is_hidden FROM categories WHERE template_key = ?',
          category.templateKey
        );
        if (resulting) {
          if (resulting.is_hidden) {
            await db.runAsync('UPDATE categories SET is_hidden = ? WHERE id = ?', 0, resulting.id);
          }
          ids.push(resulting.id);
          sort += 1;
          break;
        }
        id = await uniqueId(id);
      }
    }
  });
  return ids;
}

/**
 * Thrown by `deleteCategory` when the category being removed is the last one
 * of its kind (expense/income)  there would be nowhere to reassign its
 * transactions. Callers should catch this and prompt the user to add a
 * replacement category before deleting.
 */
export class NoFallbackCategoryError extends Error {
  constructor(public kind: 'expense' | 'income') {
    super(`Cannot delete the last ${kind} category`);
  }
}

/**
 * Delete any category, including the generic "Other Expenses"/"Other Income"
 * ones  nothing is permanently locked. Any transactions or learned mappings
 * pointing at it are reassigned to another category of the same kind (any
 * remaining one, preferring another default) so nothing dangles. If it's the
 * last category of its kind, deletion is refused via NoFallbackCategoryError
 * since there'd be no valid reassignment target.
 *
 * A deleted default is also tombstoned in `deleted_default_categories`, so the
 * startup reseed (`seedCategories` in db.ts) knows not to bring it back  without
 * this, deleting a default category would only last until the app is next closed
 * and reopened. Custom categories need no such tombstone: they are never seeded.
 */
export async function deleteCategory(id: string): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ kind: string; is_default: number }>(
    'SELECT kind, is_default FROM categories WHERE id = ?',
    id
  );
  if (!row) return;
  const kind = row.kind === 'income' ? 'income' : 'expense';
  const fallback = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM categories WHERE kind = ? AND id != ? ORDER BY is_default DESC, sort ASC LIMIT 1',
    row.kind,
    id
  );
  if (!fallback) {
    throw new NoFallbackCategoryError(kind);
  }
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE transactions SET category_id = ? WHERE category_id = ?', fallback.id, id);
    // Recurring bills carry a category too, and they outlive the transactions they created.
    // Left pointing at the deleted id, the next tick would write a transaction categorised
    // as something that no longer exists — invisible to every category breakdown and to
    // every budget envelope, month after month.
    await db.runAsync('UPDATE commitments SET category_id = ? WHERE category_id = ?', fallback.id, id);
    await db.runAsync('DELETE FROM merchant_memory WHERE category_id = ?', id);
    await db.runAsync('DELETE FROM budget_allocation WHERE category_id = ?', id);
    await db.runAsync('DELETE FROM categories WHERE id = ?', id);
    if (row.is_default) {
      await db.runAsync('INSERT OR IGNORE INTO deleted_default_categories (id) VALUES (?)', id);
    }
  });
}

export async function listDeletedDefaultCategories(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM deleted_default_categories');
  return rows.map((r) => r.id);
}
