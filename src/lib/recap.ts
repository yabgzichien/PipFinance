// src/lib/recap.ts
// Pure, deterministic helpers for the monthly income-statement recap. No UI or
// database imports  everything here is unit-tested.
import { txnMonthKey, type Allocations } from './budget';
import type { Transaction } from './types';

export interface IncomeStatement {
  income: number;
  expenses: number;
  net: number;
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
