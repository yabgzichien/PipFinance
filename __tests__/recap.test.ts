// __tests__/recap.test.ts
import {
  autoCategorizedRate,
  availableMonths,
  categoryComparisons,
  computeAdherence,
  hasComparisonData,
  monthlyIncomeStatement,
  monthlyRecapSummary,
  completedRecapComparisons,
  prevMonthKey,
  spentByCategory,
} from '../src/lib/recap';
import type { Transaction } from '../src/lib/types';

function txn(over: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    merchantRaw: 'X', merchantKey: 'x', amount: 10, currency: 'MYR',
    type: 'expense', date: '2026-06-10', categoryId: 'dining',
    createdAt: '2026-06-10T10:00:00.000Z', source: 'manual', ...over,
  };
}

describe('monthlyRecapSummary', () => {
  it('provides spending rows without any budget and separates missing income from recorded income', () => {
    const summary = monthlyRecapSummary([
      txn({ amount: 33, categoryId: null }),
      txn({ amount: 12, categoryId: 'dining' }),
      txn({ type: 'transfer', amount: 1000 }),
      txn({ amount: 999, date: '2026-05-01' }),
    ], '2026-06');
    expect(summary).toMatchObject({ income: 0, expenses: 45, net: -45, incomeCount: 0, expenseCount: 2 });
    expect(summary.categories).toEqual([
      { catId: 'other', amount: 33, count: 1 },
      { catId: 'dining', amount: 12, count: 1 },
    ]);
  });

  it('uses the same transaction conversion for totals and category rows', () => {
    const summary = monthlyRecapSummary([
      txn({ amount: 45, nativeAmount: 10, currency: 'USD' }),
      txn({ type: 'income', amount: 450, nativeAmount: 100, currency: 'USD' }),
    ], '2026-06', (t) => t.nativeAmount ?? t.amount);
    expect(summary).toMatchObject({ income: 100, expenses: 10, net: 90, incomeCount: 1, expenseCount: 1 });
    expect(summary.categories).toEqual([{ catId: 'dining', amount: 10, count: 1 }]);
  });

  it('handles empty and income-only months without invented spending categories', () => {
    expect(monthlyRecapSummary([], '2026-06')).toMatchObject({ incomeCount: 0, expenseCount: 0, categories: [] });
    expect(monthlyRecapSummary([txn({ type: 'income', date: null, amount: 100 })], '2026-06'))
      .toMatchObject({ income: 100, expenses: 0, incomeCount: 1, expenseCount: 0, categories: [] });
  });
});

describe('completedRecapComparisons', () => {
  const records = [
    txn({ date: '2026-05-05', amount: 100 }),
    txn({ date: '2026-06-05', amount: 40 }),
    txn({ date: '2026-06-05', amount: 90, categoryId: 'fuel' }),
  ];
  it('does not compare an unfinished or future month with a full previous month', () => {
    expect(completedRecapComparisons(records, '2026-06', new Date(2026, 5, 20))).toEqual([]);
    expect(completedRecapComparisons(records, '2026-06', new Date(2026, 4, 20))).toEqual([]);
  });
  it('requires recorded expenses in both completed months and ranks the largest changes', () => {
    expect(completedRecapComparisons(records, '2026-06', new Date(2026, 6, 1))).toEqual([
      { catId: 'fuel', current: 90, previous: 0, deltaAbs: 90 },
      { catId: 'dining', current: 40, previous: 100, deltaAbs: -60 },
    ]);
    expect(completedRecapComparisons(records, '2026-07', new Date(2026, 7, 1))).toEqual([]);
    expect(completedRecapComparisons(records, '2026-05', new Date(2026, 7, 1))).toEqual([]);
  });
});

describe('monthlyIncomeStatement', () => {
  it('sums income and expenses for the given month and nets them', () => {
    const txns = [
      txn({ type: 'income', amount: 5000, date: '2026-06-01' }),
      txn({ type: 'expense', amount: 1200, date: '2026-06-05' }),
      txn({ type: 'expense', amount: 300, date: '2026-06-09' }),
      txn({ type: 'expense', amount: 999, date: '2026-05-30' }), // other month, ignored
    ];
    expect(monthlyIncomeStatement(txns, '2026-06')).toEqual({
      income: 5000,
      expenses: 1500,
      net: 3500,
    });
  });

  it('falls back to createdAt month when date is null', () => {
    const txns = [txn({ type: 'income', amount: 100, date: null, createdAt: '2026-06-02T00:00:00.000Z' })];
    expect(monthlyIncomeStatement(txns, '2026-06').income).toBe(100);
  });

  it('returns zeros for an empty month', () => {
    expect(monthlyIncomeStatement([], '2026-06')).toEqual({ income: 0, expenses: 0, net: 0 });
  });
});

describe('spentByCategory', () => {
  it('totals expenses per category for the month, ignoring income', () => {
    const txns = [
      txn({ categoryId: 'dining', amount: 100, date: '2026-06-01' }),
      txn({ categoryId: 'dining', amount: 50, date: '2026-06-02' }),
      txn({ categoryId: 'fuel', amount: 80, date: '2026-06-03' }),
      txn({ type: 'income', categoryId: 'salary', amount: 5000, date: '2026-06-01' }),
    ];
    expect(spentByCategory(txns, '2026-06')).toEqual({ dining: 150, fuel: 80 });
  });

  it('buckets a null category under "other"', () => {
    const txns = [txn({ categoryId: null, amount: 40, date: '2026-06-01' })];
    expect(spentByCategory(txns, '2026-06')).toEqual({ other: 40 });
  });
});

describe('computeAdherence', () => {
  it('counts categories within budget and ranks overspends by amount', () => {
    const allocations = { dining: 200, fuel: 100, groceries: 300 };
    const spent = { dining: 250, fuel: 60, groceries: 500 };
    const a = computeAdherence(allocations, spent);
    expect(a.totalBudgeted).toBe(3);
    expect(a.withinCount).toBe(1); // only fuel stayed within
    expect(a.overspends.map((o) => o.catId)).toEqual(['groceries', 'dining']);
    expect(a.overspends[0]).toEqual({ catId: 'groceries', allocated: 300, spent: 500, over: 200, pct: 67 });
    expect(a.overspends[1]).toEqual({ catId: 'dining', allocated: 200, spent: 250, over: 50, pct: 25 });
  });

  it('treats a category exactly on budget as within', () => {
    const a = computeAdherence({ dining: 200 }, { dining: 200 });
    expect(a.withinCount).toBe(1);
    expect(a.overspends).toEqual([]);
  });

  it('counts an unspent budgeted category as within', () => {
    const a = computeAdherence({ dining: 200 }, {});
    expect(a.withinCount).toBe(1);
    expect(a.overspends).toEqual([]);
  });

  it('handles no budget at all', () => {
    expect(computeAdherence({}, { dining: 50 })).toEqual({ withinCount: 0, totalBudgeted: 0, overspends: [] });
  });
});

describe('availableMonths', () => {
  const now = new Date(2026, 5, 15); // June 2026

  it('merges transaction months, snapshot months, and the current month, newest first, deduped', () => {
    const txns = [
      txn({ date: '2026-04-10' }),
      txn({ date: '2026-04-12' }),
      txn({ date: null, createdAt: '2026-03-01T00:00:00.000Z' }),
    ];
    expect(availableMonths(txns, ['2026-05', '2026-04'], now)).toEqual([
      '2026-06', // current month always present
      '2026-05', // from snapshots
      '2026-04', // from txns + snapshots (deduped)
      '2026-03', // from createdAt fallback
    ]);
  });

  it('always includes the current month even with no data', () => {
    expect(availableMonths([], [], now)).toEqual(['2026-06']);
  });
});

describe('prevMonthKey', () => {
  it('steps back one month within a year', () => {
    expect(prevMonthKey('2026-06')).toBe('2026-05');
  });

  it('wraps back across a year boundary', () => {
    expect(prevMonthKey('2026-01')).toBe('2025-12');
  });
});

describe('categoryComparisons', () => {
  it('pairs this month and last month spend per category, biggest current spend first', () => {
    const txns = [
      txn({ categoryId: 'dining', amount: 150, date: '2026-06-01' }),
      txn({ categoryId: 'dining', amount: 100, date: '2026-05-01' }),
      txn({ categoryId: 'fuel', amount: 80, date: '2026-06-02' }),
    ];
    expect(categoryComparisons(txns, '2026-06')).toEqual([
      { catId: 'dining', current: 150, previous: 100, deltaAbs: 50 },
      { catId: 'fuel', current: 80, previous: 0, deltaAbs: 80 },
    ]);
  });

  it('includes a category that had spend last month but none this month', () => {
    const txns = [txn({ categoryId: 'travel', amount: 200, date: '2026-05-01' })];
    expect(categoryComparisons(txns, '2026-06')).toEqual([
      { catId: 'travel', current: 0, previous: 200, deltaAbs: -200 },
    ]);
  });

  it('returns nothing for two empty months', () => {
    expect(categoryComparisons([], '2026-06')).toEqual([]);
  });
});

describe('autoCategorizedRate', () => {
  it('counts an expense as auto-categorized when its merchant has an earlier transaction', () => {
    const txns = [
      txn({ merchantKey: 'starbucks', date: '2026-05-01' }), // first seen last month
      txn({ merchantKey: 'starbucks', date: '2026-06-05' }), // repeat this month -> known
      txn({ merchantKey: 'new-cafe', date: '2026-06-06' }), // first time ever -> not known
    ];
    expect(autoCategorizedRate(txns, '2026-06')).toBe(50);
  });

  it('does not count same-day first occurrences as known', () => {
    const txns = [txn({ merchantKey: 'new-cafe', date: '2026-06-06' })];
    expect(autoCategorizedRate(txns, '2026-06')).toBe(0);
  });

  it('ignores income when computing the rate', () => {
    const txns = [
      txn({ merchantKey: 'employer', type: 'income', date: '2026-05-01' }),
      txn({ merchantKey: 'employer', type: 'income', date: '2026-06-01' }),
      txn({ merchantKey: 'new-cafe', type: 'expense', date: '2026-06-06' }),
    ];
    expect(autoCategorizedRate(txns, '2026-06')).toBe(0);
  });

  it('returns null when the month has no expenses', () => {
    expect(autoCategorizedRate([], '2026-06')).toBeNull();
  });
});

describe('hasComparisonData', () => {
  it('is false when the previous month has no spend at all', () => {
    const txns = [txn({ categoryId: 'dining', amount: 50, date: '2026-06-01' })];
    expect(hasComparisonData(txns, '2026-06')).toBe(false);
  });

  it('is true once the previous month has real spend', () => {
    const txns = [
      txn({ categoryId: 'dining', amount: 50, date: '2026-06-01' }),
      txn({ categoryId: 'dining', amount: 30, date: '2026-05-01' }),
    ];
    expect(hasComparisonData(txns, '2026-06')).toBe(true);
  });
});
