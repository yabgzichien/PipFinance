// src/lib/recap.ts
// Pure, deterministic helpers for the monthly income-statement recap. No UI or
// database imports  everything here is unit-tested.
import { currentMonthKey, txnMonthKey, type Allocations } from './budget';
import type { Transaction } from './types';

export interface IncomeStatement {
  income: number;
  expenses: number;
  net: number;
}

export interface RecapCategory {
  catId: string;
  amount: number;
  count: number;
}

/** Presentation totals are independent of budgets. The caller supplies the same conversion
 * used for transaction drill-downs and trip totals, preserving native currency amounts. */
export function monthlyRecapSummary(
  txns: Transaction[],
  month: string,
  convert: (txn: Transaction) => number = (txn) => txn.amount,
) {
  let income = 0;
  let expenses = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  const categories = new Map<string, RecapCategory>();
  for (const txn of txns) {
    if (txnMonthKey(txn) !== month || txn.type === 'transfer') continue;
    const amount = convert(txn);
    if (txn.type === 'income') {
      income += amount;
      incomeCount++;
    } else if (txn.type === 'expense') {
      expenses += amount;
      expenseCount++;
      const catId = txn.categoryId ?? 'other';
      const row = categories.get(catId) ?? { catId, amount: 0, count: 0 };
      row.amount += amount;
      row.count++;
      categories.set(catId, row);
    }
  }
  return { income, expenses, net: income - expenses, incomeCount, expenseCount,
    categories: [...categories.values()].sort((a, b) => b.amount - a.amount || a.catId.localeCompare(b.catId)) };
}

/** Calendar-complete periods only; recorded totals do not imply complete account coverage.
 * Never interpret an empty month as a reduction in spending. */
export function completedRecapComparisons(
  txns: Transaction[], month: string, now: Date = new Date(),
  convert: (txn: Transaction) => number = (txn) => txn.amount,
): CategoryComparison[] {
  if (month >= currentMonthKey(now)) return [];
  const current = monthlyRecapSummary(txns, month, convert);
  const previous = monthlyRecapSummary(txns, prevMonthKey(month), convert);
  if (current.expenses <= 0 || previous.expenses <= 0) return [];
  const currentMap = new Map(current.categories.map((c) => [c.catId, c.amount]));
  const previousMap = new Map(previous.categories.map((c) => [c.catId, c.amount]));
  return [...new Set([...currentMap.keys(), ...previousMap.keys()])]
    .map((catId) => {
      const cur = currentMap.get(catId) ?? 0;
      const prev = previousMap.get(catId) ?? 0;
      return { catId, current: cur, previous: prev, deltaAbs: cur - prev };
    })
    .filter((c) => Math.abs(c.deltaAbs) > 0.005)
    .sort((a, b) => Math.abs(b.deltaAbs) - Math.abs(a.deltaAbs) || a.catId.localeCompare(b.catId));
}

export interface Overspend {
  catId: string;
  allocated: number;
  spent: number;
  over: number; // spent - allocated (always > 0)
  pct: number; // over as a whole-number % of allocated
}

export interface Adherence {
  withinCount: number; // budgeted categories that stayed within their allocation
  totalBudgeted: number;
  overspends: Overspend[]; // categories over target, biggest overspend first
}

/** Income, expenses, and net (income − expenses) for a single 'YYYY-MM' month. */
export function monthlyIncomeStatement(txns: Transaction[], mk: string): IncomeStatement {
  let income = 0;
  let expenses = 0;
  for (const t of txns) {
    if (txnMonthKey(t) !== mk) continue;
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expenses += t.amount;
  }
  return { income, expenses, net: income - expenses };
}

/** Expense totals per category for a single month (income ignored). */
export function spentByCategory(txns: Transaction[], mk: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of txns) {
    if (t.type !== 'expense' || txnMonthKey(t) !== mk) continue;
    const cat = t.categoryId ?? 'other';
    out[cat] = (out[cat] ?? 0) + t.amount;
  }
  return out;
}

/** The `date` when present, otherwise `createdAt`  same fallback as `txnMonthKey`, kept at
 *  the same precision (full ISO string) so same-day transactions compare stably. */
function txnDay(t: Pick<Transaction, 'date' | 'createdAt'>): string {
  return t.date ?? t.createdAt;
}

/**
 * Share of a month's expenses whose merchant Pip already knew before that transaction  a
 * proxy for "categorized without the user picking a category by hand," since the category
 * source (learned/AI guess/manual) isn't persisted per transaction. A merchant counts as
 * already known if any other transaction for the same merchantKey happened earlier; the
 * transaction that first introduces a merchant never counts toward its own rate.
 * Returns null when the month has no expenses, so callers can hide the stat instead of
 * showing a meaningless 0%.
 */
export function autoCategorizedRate(txns: Transaction[], mk: string): number | null {
  const firstSeen = new Map<string, string>();
  for (const t of txns) {
    if (!t.merchantKey) continue;
    const day = txnDay(t);
    const prev = firstSeen.get(t.merchantKey);
    if (!prev || day < prev) firstSeen.set(t.merchantKey, day);
  }

  const monthExpenses = txns.filter((t) => t.type === 'expense' && txnMonthKey(t) === mk);
  if (monthExpenses.length === 0) return null;

  const known = monthExpenses.filter((t) => {
    const first = firstSeen.get(t.merchantKey);
    return !!first && first < txnDay(t);
  }).length;

  return Math.round((known / monthExpenses.length) * 100);
}

/**
 * How well spending stuck to the budget: how many budgeted categories stayed
 * within allocation, and a ranked list of those that went over.
 */
export function computeAdherence(allocations: Allocations, spentByCat: Record<string, number>): Adherence {
  const budgetedIds = Object.keys(allocations);
  const overspends: Overspend[] = [];
  let withinCount = 0;

  for (const id of budgetedIds) {
    const allocated = allocations[id];
    const spent = spentByCat[id] ?? 0;
    if (spent > allocated) {
      const over = spent - allocated;
      overspends.push({
        catId: id,
        allocated,
        spent,
        over,
        pct: allocated > 0 ? Math.round((over / allocated) * 100) : 0,
      });
    } else {
      withinCount++;
    }
  }

  overspends.sort((a, b) => b.over - a.over);
  return { withinCount, totalBudgeted: budgetedIds.length, overspends };
}

/** The 'YYYY-MM' immediately before the given one. */
export function prevMonthKey(mk: string): string {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface CategoryComparison {
  catId: string;
  current: number;
  previous: number;
  /** current − previous. Positive is "spent more", negative is "spent less" — neither is a
   *  verdict (docs/ui-engagement-plan.md §1 and Step 5: both directions read neutrally). */
  deltaAbs: number;
}

/**
 * Per-category spend for `month` next to the month before it — the winnable, shame-free
 * comparison from Step 5 (§2.6): a user versus their own last month, never another user.
 * Biggest current spend first. A category with spend in only one of the two months still
 * appears, with a zero on the other side.
 */
export function categoryComparisons(txns: Transaction[], month: string): CategoryComparison[] {
  const current = spentByCategory(txns, month);
  const previous = spentByCategory(txns, prevMonthKey(month));
  const catIds = new Set([...Object.keys(current), ...Object.keys(previous)]);
  return [...catIds]
    .map((catId) => {
      const cur = current[catId] ?? 0;
      const prev = previous[catId] ?? 0;
      return { catId, current: cur, previous: prev, deltaAbs: cur - prev };
    })
    .sort((a, b) => b.current - a.current);
}

/**
 * Whether there is enough real history to show a month-over-month comparison: the previous
 * month needs actual recorded spend, not just an empty bucket (Step 5: "renders only with at
 * least two full months of data, otherwise the comparison is noise").
 */
export function hasComparisonData(txns: Transaction[], month: string): boolean {
  const previous = spentByCategory(txns, prevMonthKey(month));
  return Object.values(previous).some((v) => v > 0);
}

/**
 * Months the recap can show: every month that has transactions or a budget
 * snapshot, plus the current month, deduped and sorted newest first.
 */
export function availableMonths(
  txns: Transaction[],
  snapshotMonths: string[],
  now: Date = new Date()
): string[] {
  const months = new Set<string>(snapshotMonths);
  months.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  for (const t of txns) {
    const mk = txnMonthKey(t);
    if (mk) months.add(mk);
  }
  return [...months].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}
