import { genId, getDb } from './db';
import { listFxRates } from './fxRepo';
import { currentMonthKey } from '../lib/budget';
import { occurrencesFor, type Commitment, type CommitmentKind, type CommitmentOccurrence, type OccurrenceStatus } from '../lib/commitments';
import { BASE_CURRENCY } from '../lib/currency';
import { rateFor, ratesFromCache } from '../lib/fx';

// --- Row shapes (raw SQLite columns) ---------------------------------------
interface CommitmentRow {
  id: string;
  label: string;
  merchant_key: string;
  kind: string;
  amount: number;
  category_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  due_day: number;
  start_month: string;
  end_month: string | null;
  archived: number;
  created_at: string;
  relief_code: string | null;
  currency: string;
}

interface OccurrenceRow {
  id: string;
  commitment_id: string;
  due_date: string;
  month: string;
  amount: number;
  paid_amount: number | null;
  paid_on: string | null;
  status: string;
  txn_id: string | null;
  txn_created: number;
  units_added: number | null;
  price_myr: number | null;
  created_at: string;
  fx_rate: number | null;
}

function toCommitment(r: CommitmentRow): Commitment {
  return {
    id: r.id,
    label: r.label,
    merchantKey: r.merchant_key,
    kind: r.kind === 'investment' ? 'investment' : 'expense',
    amount: r.amount,
    categoryId: r.category_id,
    fromAccountId: r.from_account_id,
    toAccountId: r.to_account_id,
    dueDay: r.due_day,
    startMonth: r.start_month,
    endMonth: r.end_month,
    archived: !!r.archived,
    createdAt: r.created_at,
    reliefCode: r.relief_code,
    currency: r.currency ?? BASE_CURRENCY,
  };
}

function toOccurrence(r: OccurrenceRow): CommitmentOccurrence {
  return {
    id: r.id,
    commitmentId: r.commitment_id,
    dueDate: r.due_date,
    month: r.month,
    amount: r.amount,
    paidAmount: r.paid_amount,
    paidOn: r.paid_on,
    status: (r.status as OccurrenceStatus) ?? 'scheduled',
    txnId: r.txn_id,
    txnCreated: !!r.txn_created,
    unitsAdded: r.units_added,
    priceMYR: r.price_myr,
    createdAt: r.created_at,
    fxRate: r.fx_rate ?? null,
  };
}

// --- Commitments ------------------------------------------------------------

export interface NewCommitment {
  label: string;
  merchantKey: string;
  kind: CommitmentKind;
  amount: number;
  categoryId: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  dueDay: number;
  startMonth: string;
  endMonth?: string | null;
  reliefCode?: string | null;
  currency?: string;
}

export async function listCommitments(): Promise<Commitment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CommitmentRow>('SELECT * FROM commitments ORDER BY created_at DESC');
  return rows.map(toCommitment);
}

export async function addCommitment(input: NewCommitment): Promise<Commitment> {
  const db = await getDb();
  const id = genId();
  const createdAt = new Date().toISOString();
  const currency = input.currency ?? BASE_CURRENCY;
  await db.runAsync(
    `INSERT INTO commitments
       (id, label, merchant_key, kind, amount, category_id, from_account_id, to_account_id, due_day, start_month, end_month, archived, created_at, relief_code, currency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    id,
    input.label,
    input.merchantKey,
    input.kind,
    input.amount,
    input.categoryId,
    input.fromAccountId,
    input.toAccountId,
    input.dueDay,
    input.startMonth,
    input.endMonth ?? null,
    createdAt,
    input.reliefCode ?? null,
    currency
  );
  return {
    id,
    label: input.label,
    merchantKey: input.merchantKey,
    kind: input.kind,
    amount: input.amount,
    categoryId: input.categoryId,
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    dueDay: input.dueDay,
    startMonth: input.startMonth,
    endMonth: input.endMonth ?? null,
    archived: false,
    createdAt,
    reliefCode: input.reliefCode ?? null,
    currency,
  };
}

export async function updateCommitment(
  id: string,
  patch: Partial<Pick<Commitment, 'label' | 'amount' | 'categoryId' | 'fromAccountId' | 'toAccountId' | 'dueDay' | 'endMonth' | 'reliefCode'>>
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.label !== undefined) { fields.push('label = ?'); values.push(patch.label); }
  if (patch.amount !== undefined) { fields.push('amount = ?'); values.push(patch.amount); }
  if (patch.categoryId !== undefined) { fields.push('category_id = ?'); values.push(patch.categoryId); }
  if (patch.fromAccountId !== undefined) { fields.push('from_account_id = ?'); values.push(patch.fromAccountId); }
  if (patch.toAccountId !== undefined) { fields.push('to_account_id = ?'); values.push(patch.toAccountId); }
  if (patch.dueDay !== undefined) { fields.push('due_day = ?'); values.push(patch.dueDay); }
  if (patch.endMonth !== undefined) { fields.push('end_month = ?'); values.push(patch.endMonth); }
  if (patch.reliefCode !== undefined) { fields.push('relief_code = ?'); values.push(patch.reliefCode); }
  if (fields.length === 0) return;
  values.push(id);
  await db.runAsync(`UPDATE commitments SET ${fields.join(', ')} WHERE id = ?`, ...(values as any[]));
}

/** Archiving stops future occurrence generation; past occurrences and their paid history stay
 *  intact, so a discontinued bill still counts toward the on-time record. */
export async function archiveCommitment(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE commitments SET archived = 1 WHERE id = ?', id);
}

/** Deletes the commitment and every occurrence it ever generated. Does not touch any linked
 *  transaction — the ledger row belongs to the user's Activity history regardless of whether
 *  the commitment that produced it still exists. */
export async function deleteCommitment(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM commitment_occurrences WHERE commitment_id = ?', id);
    await db.runAsync('DELETE FROM commitments WHERE id = ?', id);
  });
}

/**
 * Deletes occurrences from `fromMonth` onwards for a commitment, capping its schedule
 * to the previous month so that prior history (before `fromMonth`) is preserved intact.
 * If no prior occurrences exist, deletes the commitment entirely.
 */
export async function deleteCommitmentFromMonth(id: string, fromMonth: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const prior = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM commitment_occurrences WHERE commitment_id = ? AND month < ?',
      id,
      fromMonth
    );
    const hasPriorHistory = (prior?.count ?? 0) > 0;

    if (!hasPriorHistory) {
      await db.runAsync('DELETE FROM commitment_occurrences WHERE commitment_id = ?', id);
      await db.runAsync('DELETE FROM commitments WHERE id = ?', id);
    } else {
      const [y, m] = fromMonth.split('-').map(Number);
      const prevDate = new Date(Date.UTC(y, m - 2, 1));
      const prevMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
      
      await db.runAsync('UPDATE commitments SET end_month = ? WHERE id = ?', prevMonth, id);
      await db.runAsync('DELETE FROM commitment_occurrences WHERE commitment_id = ? AND month >= ?', id, fromMonth);
    }
  });
}

// --- Occurrences --------------------------------------------------------------

export async function listOccurrences(): Promise<CommitmentOccurrence[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<OccurrenceRow>('SELECT * FROM commitment_occurrences ORDER BY due_date ASC');
  return rows.map(toOccurrence);
}

/**
 * The occurrences (if any) that these transactions are the ledger side of.
 *
 * Read from SQLite rather than filtered out of the store's `commitmentOccurrences` array, so
 * a transaction deletion cannot miss an occurrence just because React state had not caught up.
 */
export async function listOccurrencesByTxnIds(txnIds: string[]): Promise<CommitmentOccurrence[]> {
  if (txnIds.length === 0) return [];
  const db = await getDb();
  const placeholders = txnIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<OccurrenceRow>(
    `SELECT * FROM commitment_occurrences WHERE txn_id IN (${placeholders})`,
    ...txnIds
  );
  return rows.map(toOccurrence);
}

/**
 * Materialise occurrences for every non-archived commitment from the current month through
 * `OCCURRENCE_HORIZON_MONTHS` ahead. `INSERT OR IGNORE` against the (commitment_id, due_date)
 * unique index makes this idempotent — safe to call on every foreground/refresh without
 * duplicating rows already generated by a previous call.
 */
export async function ensureOccurrences(now: Date = new Date()): Promise<void> {
  const db = await getDb();
  const commitments = await listCommitments();
  const fromMonth = currentMonthKey(now);
  const rates = ratesFromCache(await listFxRates());
  await db.withTransactionAsync(async () => {
    for (const c of commitments) {
      if (c.archived) continue;
      const currency = c.currency ?? BASE_CURRENCY;
      const fxRate = currency === BASE_CURRENCY ? null : rateFor(rates, currency);
      const start = c.startMonth && c.startMonth < fromMonth ? c.startMonth : fromMonth;
      for (const occ of occurrencesFor(c, start)) {
        const id = genId();
        const createdAt = new Date().toISOString();
        await db.runAsync(
          `INSERT OR IGNORE INTO commitment_occurrences
             (id, commitment_id, due_date, month, amount, status, created_at, fx_rate)
           VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?)`,
          id,
          occ.commitmentId,
          occ.dueDate,
          occ.month,
          occ.amount,
          createdAt,
          fxRate
        );
      }
    }
  });
}

/**
 * Insert one occurrence verbatim at whatever due date/status/history an import provides,
 * bypassing the normal forward-only materialisation window in `occurrencesFor` — a re-imported
 * commitment's on-time record depends on its past months surviving exactly as they were, not
 * being regenerated as fresh 'scheduled' rows. `INSERT OR IGNORE` against the (commitment_id,
 * due_date) unique index makes re-importing the same file a no-op the second time.
 */
export async function insertOccurrence(
  commitmentId: string,
  occ: { dueDate: string; amount: number; status: OccurrenceStatus; paidOn: string | null; paidAmount: number | null; fxRate?: number | null }
): Promise<void> {
  const db = await getDb();
  const id = genId();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    `INSERT OR IGNORE INTO commitment_occurrences
       (id, commitment_id, due_date, month, amount, status, paid_on, paid_amount, created_at, fx_rate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    commitmentId,
    occ.dueDate,
    occ.dueDate.slice(0, 7),
    occ.amount,
    occ.status,
    occ.paidOn,
    occ.paidAmount,
    createdAt,
    occ.fxRate ?? null
  );
}

export interface OccurrencePayment {
  paidAmount: number;
  paidOn: string;
  status: 'paid' | 'late';
  txnId: string | null;
  txnCreated: boolean;
  unitsAdded?: number | null;
  priceMYR?: number | null;
}

export async function markOccurrencePaid(id: string, payment: OccurrencePayment): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE commitment_occurrences
       SET paid_amount = ?, paid_on = ?, status = ?, txn_id = ?, txn_created = ?, units_added = ?, price_myr = ?
     WHERE id = ?`,
    payment.paidAmount,
    payment.paidOn,
    payment.status,
    payment.txnId,
    payment.txnCreated ? 1 : 0,
    payment.unitsAdded ?? null,
    payment.priceMYR ?? null,
    id
  );
}

/** Reset a paid/late occurrence back to scheduled — the untick half of `markOccurrencePaid`. */
export async function resetOccurrence(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE commitment_occurrences
       SET paid_amount = NULL, paid_on = NULL, status = 'scheduled', txn_id = NULL, txn_created = 0, units_added = NULL, price_myr = NULL
     WHERE id = ?`,
    id
  );
}

export async function skipOccurrence(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE commitment_occurrences SET status = 'skipped' WHERE id = ?", id);
}

/** Resolve a DCA contribution's units once a price becomes available after the tick — the
 *  holding had no cached quote yet (offline, first run), so only `cost` moved at pay time. */
export async function setOccurrenceUnits(id: string, unitsAdded: number, priceMYR: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE commitment_occurrences SET units_added = ?, price_myr = ? WHERE id = ?',
    unitsAdded,
    priceMYR,
    id
  );
}

export async function getOccurrence(id: string): Promise<CommitmentOccurrence | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<OccurrenceRow>('SELECT * FROM commitment_occurrences WHERE id = ?', id);
  return row ? toOccurrence(row) : null;
}
