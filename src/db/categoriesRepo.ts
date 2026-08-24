import { getDb } from './db';
import type { Category } from '../lib/types';

interface CatRow {
  id: string;
  label: string;
  icon: string;
  hue: number;
  kind: string;
  is_default: number;
  sort: number;
}

function toCategory(r: CatRow): Category {
  return {
    id: r.id,
    label: r.label,
    icon: r.icon,
    hue: r.hue,
    kind: r.kind === 'income' ? 'income' : 'expense',
    isDefault: !!r.is_default,
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
  return { id, label: label.trim(), icon, hue, kind, isDefault: false };
}

/** Change a category's icon/picture in place  a named icon (see Icon.tsx) or a
 *  data:/file:/content:/http(s): URI for a custom photo. Allowed on every category,
 *  including the protected generics: the picture is cosmetic, not the delete-guard. */
export async function updateCategoryIcon(id: string, icon: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE categories SET icon = ? WHERE id = ?', icon, id);
}

/** Rename a category. Allowed on every category, including the protected generics. */
export async function updateCategoryLabel(id: string, label: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE categories SET label = ? WHERE id = ?', label.trim(), id);
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
