import { netWorthFreshness, rankClassMovers } from '../src/lib/netWorthPresentation';
import type { Account, BalanceEntry } from '../src/lib/types';

function account(overrides: Partial<Account>): Account {
  return {
    id: 'account-1',
    name: 'Cash',
    kind: 'asset',
    cls: 'cash',
    archived: false,
    createdAt: '2026-01-01',
    sub: null,
    symbol: null,
    ticker: null,
    quantity: null,
    cost: null,
    currency: 'MYR',
    ...overrides,
  };
}

function balance(accountId: string, asOf: string, value = 100): BalanceEntry {
  return { id: `${accountId}-${asOf}`, accountId, value, asOf, createdAt: `${asOf}T08:00:00.000Z` };
}

describe('net worth presentation model', () => {
  test('freshness flags missing and old manual balances without penalising managed or live-priced accounts', () => {
    const accounts = [
      account({ id: 'fresh' }),
      account({ id: 'old' }),
      account({ id: 'missing' }),
      account({ id: 'owed', cls: 'receivable' }),
      account({ id: 'btc', cls: 'investments', sub: 'crypto', symbol: 'BTC-USD', ticker: 'BTC', quantity: 0.1 }),
      account({ id: 'archived', archived: true }),
    ];
    const entries = [balance('fresh', '2026-09-01'), balance('old', '2026-06-15')];

    expect(netWorthFreshness(accounts, entries, '2026-09-13')).toEqual({
      trackedCount: 3,
      currentCount: 1,
      staleAccountIds: ['old', 'missing'],
      oldestAsOf: '2026-06-15',
    });
  });

  test('freshness treats a monthly balance as current for 35 days', () => {
    const accounts = [account({ id: 'cash' })];

    expect(netWorthFreshness(accounts, [balance('cash', '2026-08-09')], '2026-09-13').staleAccountIds).toEqual([]);
    expect(netWorthFreshness(accounts, [balance('cash', '2026-08-08')], '2026-09-13').staleAccountIds).toEqual(['cash']);
  });

  test('category movers are ranked by absolute contribution and omit unchanged categories', () => {
    const accounts = [
      account({ id: 'cash', cls: 'cash' }),
      account({ id: 'stock', cls: 'investments' }),
      account({ id: 'loan', cls: 'personal', kind: 'liability' }),
      account({ id: 'same', cls: 'illiquid' }),
    ];

    expect(rankClassMovers(
      accounts,
      { cash: 700, stock: 1300, loan: 350, same: 500 },
      { cash: 1000, stock: 1200, loan: 200, same: 500 },
    )).toEqual([
      { cls: 'cash', label: 'Cash & Bank', delta: -300 },
      { cls: 'personal', label: 'Personal Loan', delta: -150 },
      { cls: 'investments', label: 'Investments', delta: 100 },
    ]);
  });
});
