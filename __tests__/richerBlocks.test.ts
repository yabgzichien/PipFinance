// TDD: richer evidence libs (Brief P). Pure over Transaction[]; synthetic fixtures with known
// months/amounts so the aggregates are checkable by hand.
import { detectObligations } from '../src/lib/obligations';
import { computeSpendingProfile } from '../src/lib/spendingProfile';
import type { Transaction } from '../src/lib/types';

let seq = 0;
function tx(over: Partial<Transaction>): Transaction {
  return {
    id: `t${seq++}`,
    merchantRaw: 'Shop',
    merchantKey: 'shop',
    amount: 100,
    currency: 'MYR',
    type: 'expense',
    date: '2026-01-15',
    categoryId: 'shopping',
    createdAt: '2026-01-15T00:00:00.000Z',
    source: 'extracted',
    ...over,
  };
}

const months = ['2026-01', '2026-02', '2026-03', '2026-04'];
const income = (mk: string, amount: number, merchant = 'Employer') =>
  tx({ type: 'income', categoryId: 'income', amount, date: `${mk}-05`, merchantRaw: merchant, merchantKey: merchant.toLowerCase() });
const expense = (mk: string, amount: number, merchant: string, categoryId: string | null = 'shopping') =>
  tx({ type: 'expense', amount, date: `${mk}-10`, merchantRaw: merchant, merchantKey: merchant.toLowerCase().replace(/\s+/g, ''), categoryId });

describe('detectObligations', () => {
  it('detects a stable monthly rent and classifies it', () => {
    const txns = months.map((mk) => expense(mk, 900, 'Landlord Rent', 'rent'));
    const { obligations, evidencedMonthlyDebtService } = detectObligations(txns);
    expect(obligations).toHaveLength(1);
    expect(obligations[0].kind).toBe('rent');
    expect(obligations[0].monthlyAmount).toBe(900);
    expect(obligations[0].monthsObserved).toBe(4);
    expect(evidencedMonthlyDebtService).toBe(900);
  });

  it('classifies utilities and installments and sums them', () => {
    const txns = [
      ...months.map((mk) => expense(mk, 120, 'TNB Electric', 'bills')),
      ...months.map((mk) => expense(mk, 450, 'Car Loan Ansuran', 'transport')),
    ];
    const { obligations, evidencedMonthlyDebtService } = detectObligations(txns);
    const kinds = obligations.map((o) => o.kind).sort();
    expect(kinds).toEqual(['installment', 'utilities']);
    expect(evidencedMonthlyDebtService).toBe(570);
  });

  it('ignores one-off and irregular spend (below the recurrence floor)', () => {
    const txns = [
      expense('2026-01', 2000, 'Furniture Store'),
      expense('2026-02', 40, 'Random Cafe'),
      ...months.slice(0, 2).map((mk) => expense(mk, 900, 'Landlord Rent', 'rent')), // only 2 months
    ];
    expect(detectObligations(txns).obligations).toHaveLength(0);
  });

  it('rejects a merchant whose amount swings too much to be a fixed obligation', () => {
    const txns = [
      expense('2026-01', 300, 'Groceries Mart', 'groceries'),
      expense('2026-02', 900, 'Groceries Mart', 'groceries'),
      expense('2026-03', 150, 'Groceries Mart', 'groceries'),
      expense('2026-04', 700, 'Groceries Mart', 'groceries'),
    ];
    expect(detectObligations(txns).obligations).toHaveLength(0);
  });
});

describe('computeSpendingProfile', () => {
  it('splits essentials from discretionary and computes savings rate', () => {
    const txns = [
      ...months.map((mk) => income(mk, 3000)),
      ...months.map((mk) => expense(mk, 800, 'Groceries', 'food')), // essential
      ...months.map((mk) => expense(mk, 200, 'Boutique', 'household')), // discretionary
    ];
    const p = computeSpendingProfile(txns);
    expect(p.essentialsRatio).toBeCloseTo(800 / 1000, 6);
    expect(p.savingsRate).toBeCloseTo((3000 - 1000) / 3000, 6);
    expect(p.bufferDays).toBeGreaterThan(0);
    expect(p.expenseVolatility).toBeCloseTo(0, 6);
  });

  it('flat spend is low volatility; lumpy spend is higher', () => {
    const flat = months.map((mk) => expense(mk, 500, 'Groceries', 'groceries'));
    const lumpy = [expense('2026-01', 100, 'Groceries', 'groceries'), expense('2026-02', 100, 'Groceries', 'groceries'), expense('2026-03', 1800, 'Groceries', 'groceries'), expense('2026-04', 100, 'Groceries', 'groceries')];
    expect(computeSpendingProfile(flat).expenseVolatility).toBeLessThan(computeSpendingProfile(lumpy).expenseVolatility);
  });

  it('empty spend → all-zero', () => {
    expect(computeSpendingProfile([])).toEqual({ essentialsRatio: 0, expenseVolatility: 0, bufferDays: 0, savingsRate: 0 });
  });
});
