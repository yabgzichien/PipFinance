import { getAccountPriority } from '../src/components/AccountChips';
import type { Account } from '../src/lib/types';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => Promise.resolve((global as any).__fakeDb),
}));

let lastSql = '';
let lastArgs: any[] = [];

jest.mock('../src/db/db', () => ({
  getDb: () =>
    Promise.resolve({
      getFirstAsync: (sql: string) => Promise.resolve({ currency: 'MYR', fx_rate: null }),
      runAsync: (sql: string, ...args: any[]) => {
        lastSql = sql;
        lastArgs = args;
        return Promise.resolve({ changes: 1, lastInsertRowId: 1 });
      },
    }),
}));

import { updateTransactionFields } from '../src/db/txnRepo';

describe('updateTransactionFields with date', () => {
  beforeEach(() => {
    lastSql = '';
    lastArgs = [];
  });

  it('updates txn_date when date is provided', async () => {
    const patch = await updateTransactionFields('tx-1', 42.5, 'expense', 'food', 'Lunch', '2026-09-10');
    expect(lastSql).toContain('txn_date = ?');
    expect(lastArgs).toEqual([42.5, null, 'expense', 'food', 'Lunch', '2026-09-10', 'tx-1']);
    expect(patch.date).toBe('2026-09-10');
    expect(patch.amount).toBe(42.5);
  });

  it('omits txn_date when date is undefined', async () => {
    const patch = await updateTransactionFields('tx-1', 10, 'income', 'salary', 'Paycheck');
    expect(lastSql).not.toContain('txn_date = ?');
    expect(lastArgs).toEqual([10, null, 'income', 'salary', 'Paycheck', 'tx-1']);
    expect(patch.date).toBeUndefined();
  });
});

describe('getAccountPriority', () => {
  it('prioritizes cash accounts first', () => {
    const cashAcct: Account = {
      id: '1',
      name: 'Cash',
      cls: 'cash',
      currency: 'MYR',
      kind: 'asset',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    expect(getAccountPriority(cashAcct)).toBe(1);
  });

  it('prioritizes banks second and e-wallets third', () => {
    const bankAcct: Account = {
      id: '2',
      name: 'Maybank Savings',
      cls: 'cash',
      currency: 'MYR',
      kind: 'asset',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    const ewalletAcct: Account = {
      id: '3',
      name: 'TnG eWallet',
      cls: 'cash',
      currency: 'MYR',
      kind: 'asset',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    expect(getAccountPriority(bankAcct)).toBe(2);
    expect(getAccountPriority(ewalletAcct)).toBe(3);
  });
});
