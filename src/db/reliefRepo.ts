// src/db/reliefRepo.ts
import { genId, getDb } from './db';
import type { ReliefOrigin, ReliefTag } from '../lib/types';

interface ReliefTagRow {
  id: string;
  txn_id: string;
  code: string;
  ya: number;
  amount: number;
  origin: string;
  cert_image_uri: string | null;
  einvoice_image_uri: string | null;
  created_at: string;
}

function toReliefTag(r: ReliefTagRow): ReliefTag {
  return {
    id: r.id,
    txnId: r.txn_id,
    code: r.code,
    ya: r.ya,
    amount: r.amount,
    origin: (r.origin as ReliefOrigin) ?? 'auto',
    certImageUri: r.cert_image_uri,
    einvoiceImageUri: r.einvoice_image_uri,
    createdAt: r.created_at,
  };
}

export interface NewReliefTag {
  txnId: string;
  code: string;
  ya: number;
  amount: number;
  origin: ReliefOrigin;
}

export async function listReliefTags(ya: number): Promise<ReliefTag[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ReliefTagRow>('SELECT * FROM relief_tags WHERE ya = ? ORDER BY created_at DESC', ya);
  return rows.map(toReliefTag);
}

export async function getReliefTagsForTxn(txnId: string): Promise<ReliefTag[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ReliefTagRow>('SELECT * FROM relief_tags WHERE txn_id = ? ORDER BY created_at DESC', txnId);
  return rows.map(toReliefTag);
}

export async function addReliefTag(input: NewReliefTag): Promise<ReliefTag> {
  const db = await getDb();
  const id = genId();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO relief_tags (id, txn_id, code, ya, amount, origin, cert_image_uri, einvoice_image_uri, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
    id,
    input.txnId,
    input.code,
    input.ya,
    input.amount,
    input.origin,
    createdAt
  );
  return {
    id,
    txnId: input.txnId,
    code: input.code,
    ya: input.ya,
    amount: input.amount,
    origin: input.origin,
    certImageUri: null,
    einvoiceImageUri: null,
    createdAt,
  };
}

export async function updateReliefTag(
  id: string,
  patch: Partial<Pick<ReliefTag, 'code' | 'amount' | 'certImageUri' | 'einvoiceImageUri'>>
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.code !== undefined) { fields.push('code = ?'); values.push(patch.code); }
  if (patch.amount !== undefined) { fields.push('amount = ?'); values.push(patch.amount); }
  if (patch.certImageUri !== undefined) { fields.push('cert_image_uri = ?'); values.push(patch.certImageUri); }
  if (patch.einvoiceImageUri !== undefined) { fields.push('einvoice_image_uri = ?'); values.push(patch.einvoiceImageUri); }
  if (fields.length === 0) return;
  values.push(id);
  await db.runAsync(`UPDATE relief_tags SET ${fields.join(', ')} WHERE id = ?`, ...(values as any[]));
}

export async function deleteReliefTag(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM relief_tags WHERE id = ?', id);
}

/**
 * Drop the relief tags belonging to these transactions. There are no foreign keys in this
 * database, so deleting a transaction has to cascade by hand (same as `deleteSplitsForTxns`):
 * an orphaned tag would keep inflating a year's claimed total for spending that no longer
 * exists, with no row in the Tax screen left to remove it from.
 */
export async function deleteReliefTagsForTxns(txnIds: string[]): Promise<void> {
  if (txnIds.length === 0) return;
  const db = await getDb();
  const placeholders = txnIds.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM relief_tags WHERE txn_id IN (${placeholders})`, ...txnIds);
}

// --- Relief memory: merchantKey -> reliefCode, same shape as merchant_memory but its own
// table so relief learning can be cleared independently of category learning in Settings.

export async function getReliefMemoryMap(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ merchant_key: string; relief_code: string }>(
    'SELECT merchant_key, relief_code FROM relief_memory'
  );
  const map: Record<string, string> = {};
  for (const r of rows) map[r.merchant_key] = r.relief_code;
  return map;
}

export async function upsertReliefMemory(merchantKey: string, code: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO relief_memory (merchant_key, relief_code, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(merchant_key) DO UPDATE SET relief_code = excluded.relief_code, updated_at = excluded.updated_at`,
    merchantKey,
    code,
    new Date().toISOString()
  );
}
