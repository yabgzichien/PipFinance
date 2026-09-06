// __tests__/trips.test.ts
// The totals contract is the whole of Trips that can be wrong quietly. Every case here is one
// the spec names explicitly, and each has a way of producing a plausible-looking number that is
// not the number the user means.
import { computeTripTotals } from '../src/lib/trips';
import type { Transaction } from '../src/lib/types';

// Stand-in for useDisplayCurrency().convertTxn: MYR passes through, SGD is 3.5.
const convert = (t: { amount: number; currency: string }) => t.amount;

function txn(over: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    merchantRaw: 'Somewhere',
    merchantKey: 'somewhere',
    amount: 100,
    currency: 'MYR',
    type: 'expense',
    date: '2026-09-10',
    categoryId: 'food',
    createdAt: '2026-09-10T00:00:00.000Z',
    source: 'manual',
    tripId: 'trip-sg',
    ...over,
  };
}

describe('computeTripTotals', () => {
  it('sums only the expenses linked to this trip', () => {
    const out = computeTripTotals(
      [txn({ amount: 100 }), txn({ amount: 50 }), txn({ amount: 999, tripId: 'trip-other' }), txn({ amount: 777, tripId: null })],
      'trip-sg',
      convert
    );
    expect(out.recordedExpenses).toBe(150);
    expect(out.txnCount).toBe(2);
  });

  it('excludes transfers — they move money, they do not spend it', () => {
    const out = computeTripTotals([txn({ amount: 100 }), txn({ amount: 500, type: 'transfer', categoryId: null })], 'trip-sg', convert);
    expect(out.recordedExpenses).toBe(100);
  });

  it('excludes income, so a refund recorded as income cannot silently net the total', () => {
    const out = computeTripTotals([txn({ amount: 100 }), txn({ amount: 40, type: 'income', categoryId: 'other-income' })], 'trip-sg', convert);
    expect(out.recordedExpenses).toBe(100);
  });

  it('sums the personal share the transaction already carries (splits are not consulted here)', () => {
    // This is an assertion of interface intent, not a regression guard. The function receives only
    // Transaction[], and Transaction carries only ownShare (splits.gross lives on the separate Split
    // record), so double-counting is prevented structurally by the type, not by this assertion.
    // If the input ever widens to include split records, this test must be upgraded to a real guard.
    const out = computeTripTotals([txn({ amount: 40 })], 'trip-sg', convert);
    expect(out.recordedExpenses).toBe(40);
  });

  it('includes an advance booking dated before the trip started', () => {
    const out = computeTripTotals([txn({ amount: 600, date: '2026-07-01', categoryId: 'rental' }), txn({ amount: 100 })], 'trip-sg', convert);
    expect(out.recordedExpenses).toBe(700);
  });

  it('converts every row through the supplied rule rather than adding native amounts', () => {
    const sgdAware = (t: { amount: number; currency: string }) => (t.currency === 'SGD' ? t.amount * 3.5 : t.amount);
    const out = computeTripTotals(
      [txn({ amount: 100, currency: 'MYR' }), txn({ amount: 20, currency: 'SGD', nativeAmount: 20 })],
      'trip-sg',
      sgdAware
    );
    expect(out.recordedExpenses).toBe(170);
  });

  it('breaks down by category, largest first, with uncategorised folded into `other`', () => {
    const out = computeTripTotals(
      [txn({ amount: 30, categoryId: 'food' }), txn({ amount: 90, categoryId: 'rental' }), txn({ amount: 10, categoryId: null })],
      'trip-sg',
      convert
    );
    expect(out.byCategory).toEqual([
      { categoryId: 'rental', amount: 90 },
      { categoryId: 'food', amount: 30 },
      { categoryId: 'other', amount: 10 },
    ]);
  });

  it('an empty trip totals zero rather than throwing', () => {
    expect(computeTripTotals([], 'trip-sg', convert)).toEqual({ recordedExpenses: 0, txnCount: 0, byCategory: [] });
  });
});
