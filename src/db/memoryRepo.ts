import { getDb } from './db';
import { getMeta, setMeta } from './metaRepo';
import type { AutoFillStats } from '../lib/recommend';
import type { MemoryMap } from '../lib/types';

interface MemRow {
  merchant_key: string;
  category_id: string;
}

/** Load the full merchantKey -> categoryId map (the learned memory). */
export async function getMemoryMap(): Promise<MemoryMap> {
  const db = await getDb();
  const rows = await db.getAllAsync<MemRow>('SELECT merchant_key, category_id FROM merchant_memory');
  const map: MemoryMap = {};
  for (const r of rows) map[r.merchant_key] = r.category_id;
  return map;
}

/** Remember (or update) the category for a merchant key. */
export async function upsertMemory(key: string, categoryId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO merchant_memory (merchant_key, category_id, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(merchant_key) DO UPDATE SET category_id = excluded.category_id, updated_at = excluded.updated_at`,
    key,
    categoryId,
    new Date().toISOString()
  );
}

/** Count of learned merchants (for Settings display). */
export async function memoryCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM merchant_memory');
  return row?.n ?? 0;
}

/** Wipe all learned mappings (Settings → reset). */
export async function clearMemory(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM merchant_memory');
}

const autoFillMetaKey = (monthKey: string) => `autofill:${monthKey}`;

/**
 * Running auto-fill total for a calendar month (docs/ui-engagement-plan.md Step 5's
 * competence feedback: "11 of 14 filled themselves. Last month it was 4 of 14."). Stored in
 * `app_meta` rather than a new column — it's a rollup of scans, not a per-transaction fact.
 * Zero if nothing was recorded for that month yet.
 */
export async function getAutoFillForMonth(monthKey: string): Promise<AutoFillStats> {
  const raw = await getMeta(autoFillMetaKey(monthKey));
  if (!raw) return { filled: 0, total: 0 };
  try {
    const parsed = JSON.parse(raw);
    return { filled: Number(parsed.filled) || 0, total: Number(parsed.total) || 0 };
  } catch {
    return { filled: 0, total: 0 };
  }
}

/** Add one scan's auto-fill stats onto the running total for its calendar month. */
export async function recordAutoFill(monthKey: string, stats: AutoFillStats): Promise<void> {
  const existing = await getAutoFillForMonth(monthKey);
  const merged: AutoFillStats = { filled: existing.filled + stats.filled, total: existing.total + stats.total };
  await setMeta(autoFillMetaKey(monthKey), JSON.stringify(merged));
}
