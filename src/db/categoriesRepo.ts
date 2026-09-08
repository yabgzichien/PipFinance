import { Platform } from 'react-native';
import type * as SQLite from 'expo-sqlite';
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

/** The subset of a database (or an exclusive transaction's own connection) activation needs. */
type ActivationTx = Pick<SQLite.SQLiteDatabase, 'getFirstAsync' | 'runAsync'>;

/**
 * Run activation's statements inside one all-or-nothing transaction.
 *
 * `withExclusiveTransactionAsync` is the stronger tool — its private connection means no other
 * async write can interleave — but expo-sqlite throws outright for it on web, where there is no
 * second connection to hand out. Web therefore falls back to `withTransactionAsync`: still a
 * single BEGIN/COMMIT, so a failed batch still leaves no half-added categories behind, which is
 * the property activation actually depends on. The weaker interleaving guarantee costs nothing
 * there: a browser tab runs one wasm database with no concurrent writer to interleave with.
 */
async function withActivationTransaction(
  db: SQLite.SQLiteDatabase,
  body: (tx: ActivationTx) => Promise<void>
): Promise<void> {
  if (Platform.OS === 'web') {
    await db.withTransactionAsync(() => body(db));
    return;
  }
  await db.withExclusiveTransactionAsync((tx) => body(tx));
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
  await withActivationTransaction(db, async (tx) => {
    // On native, the transaction provides its own connection. Every statement, including id
    // collision probing, must stay on it or Expo can interleave an outer-connection query.
    const uniqueTransactionId = async (base: string): Promise<string> => {
      let id = base;
      let n = 2;
      while (await tx.getFirstAsync('SELECT 1 FROM categories WHERE id = ?', id)) {
        id = `${base}-${n++}`;
      }
      return id;
    };
    const sortRow = await tx.getFirstAsync<{ m: number }>(
      'SELECT COALESCE(MAX(sort), 0) + 1 AS m FROM categories'
    );
    let sort = sortRow?.m ?? 0;

    for (const category of wanted) {
      const existing = await tx.getFirstAsync<{ id: string; is_hidden: number }>(
        'SELECT id, is_hidden FROM categories WHERE template_key = ?',
        category.templateKey
      );
      if (existing) {
        if (existing.is_hidden) {
          await tx.runAsync('UPDATE categories SET is_hidden = ? WHERE id = ?', 0, existing.id);
        }
        ids.push(existing.id);
        continue;
      }

      let id = await uniqueTransactionId(category.id);
      while (true) {
        // The partial unique index on template_key makes concurrent repeated activations
        // converge. An unrelated id collision retries a collision-safe suffix instead.
        await tx.runAsync(
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
        const resulting = await tx.getFirstAsync<{ id: string; is_hidden: number }>(
          'SELECT id, is_hidden FROM categories WHERE template_key = ?',
          category.templateKey
        );
        if (resulting) {
          if (resulting.is_hidden) {
            await tx.runAsync('UPDATE categories SET is_hidden = ? WHERE id = ?', 0, resulting.id);
          }
          ids.push(resulting.id);
          sort += 1;
          break;
        }
        id = await uniqueTransactionId(id);
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
 * Thrown when the replacement category a caller named cannot receive the deleted category's
 * transactions — it is gone, it is the category being deleted, or it is the other kind.
 */
export class InvalidReplacementCategoryError extends Error {
  constructor() {
    super('The chosen replacement category cannot receive these transactions');
  }
}

/**
 * Where a deleted category's transactions land.
 *
 * A named `replacementId` is the user's own answer and is used as given, once checked: it must
 * still exist, must not be the row being deleted, and must be the same kind — moving expenses
 * into an income category would corrupt every total that reads them.
 *
 * Omitting it keeps the historical automatic choice, which is right only where no user is there
 * to ask (onboarding tears down a category it just created, and nothing has been filed under it).
 */
async function resolveDeletionDestination(
  db: SQLite.SQLiteDatabase,
  id: string,
  kindColumn: string,
  replacementId?: string
): Promise<string> {
  const kind = kindColumn === 'income' ? 'income' : 'expense';
  if (replacementId !== undefined) {
    if (replacementId === id) throw new InvalidReplacementCategoryError();
    const replacement = await db.getFirstAsync<{ kind: string }>(
      'SELECT kind FROM categories WHERE id = ?',
      replacementId
    );
    if (!replacement || replacement.kind !== kindColumn) throw new InvalidReplacementCategoryError();
    return replacementId;
  }
  const fallback = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM categories WHERE kind = ? AND id != ? ORDER BY is_default DESC, sort ASC LIMIT 1',
    kindColumn,
    id
  );
  if (!fallback) throw new NoFallbackCategoryError(kind);
  return fallback.id;
}

/**
 * Delete any category, including the generic "Other Expenses"/"Other Income"
 * ones  nothing is permanently locked. Any transactions or learned mappings
 * pointing at it are reassigned to `replacementId` — the category the user chose to receive
 * them — or, when the caller names none, to any remaining category of the same kind (preferring
 * another default). If it's the last category of its kind, deletion is refused via
 * NoFallbackCategoryError since there'd be no valid reassignment target.
 *
 * A deleted default is also tombstoned in `deleted_default_categories`, so the
 * startup reseed (`seedCategories` in db.ts) knows not to bring it back  without
 * this, deleting a default category would only last until the app is next closed
 * and reopened. Custom categories need no such tombstone: they are never seeded.
 */
export async function deleteCategory(id: string, replacementId?: string): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ kind: string; is_default: number }>(
    'SELECT kind, is_default FROM categories WHERE id = ?',
    id
  );
  if (!row) return;
  const kind = row.kind === 'income' ? 'income' : 'expense';
  const destination = await resolveDeletionDestination(db, id, row.kind, replacementId);
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE transactions SET category_id = ? WHERE category_id = ?', destination, id);
    // Recurring bills carry a category too, and they outlive the transactions they created.
    // Left pointing at the deleted id, the next tick would write a transaction categorised
    // as something that no longer exists — invisible to every category breakdown and to
    // every budget envelope, month after month.
    await db.runAsync('UPDATE commitments SET category_id = ? WHERE category_id = ?', destination, id);
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
