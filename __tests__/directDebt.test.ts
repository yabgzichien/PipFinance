// __tests__/directDebt.test.ts
// Tests for direct debt creation and deletion in splitRepo.ts.
jest.mock('../src/db/db', () => {
  const actual = jest.requireActual('../src/db/db');
  return { ...actual, getDb: () => Promise.resolve((global as any).__fakeDb) };
});

import { addDirectDebt, deleteDirectDebt } from '../src/db/splitRepo';

interface Statement {
  sql: string;
  args: unknown[];
}

function fakeDb(rows: { first?: Record<string, unknown>; all?: Record<string, unknown[]> } = {}) {
  const statements: Statement[] = [];
  const pick = <T,>(table: Record<string, T> | undefined, sql: string): T | undefined => {
    if (!table) return undefined;
    const key = Object.keys(table).find((k) => sql.includes(k));
    return key === undefined ? undefined : table[key];
  };
  return {
    statements,
    sql: () => statements.map((s) => s.sql.replace(/\s+/g, ' ').trim()),
    runAsync: (sql: string, ...args: unknown[]) => {
      statements.push({ sql, args });
      return Promise.resolve({ changes: 1, lastInsertRowId: 1 });
    },
    getFirstAsync: (sql: string, ..._args: unknown[]) => Promise.resolve(pick(rows.first, sql) ?? null),
    getAllAsync: (sql: string, ..._args: unknown[]) => Promise.resolve(pick(rows.all, sql) ?? []),
    withTransactionAsync: (fn: () => Promise<void>) => fn(),
  };
}

function install(db: ReturnType<typeof fakeDb>) {
  (global as any).__fakeDb = db;
  return db;
}

describe('addDirectDebt', () => {
  it('creates person, zero-amount transaction, split, and open share', async () => {
    const db = install(fakeDb({
      first: {
        people: null, // Person doesn't exist initially
      },
    }));

    const result = await addDirectDebt('Alice', 50, 'Lunch bill');

    expect(result.shareId).toBeTruthy();
    expect(result.personId).toBeTruthy();
    expect(result.splitId).toBeTruthy();
    expect(result.txnId).toBeTruthy();

    const sqls = db.sql();
    // 1. Insert person
    expect(sqls.some((s) => s.includes('INSERT INTO people'))).toBe(true);

    // 2. Insert transaction with amount = 0
    const txnInsert = db.statements.find((s) => s.sql.includes('INSERT INTO transactions'));
    expect(txnInsert).toBeDefined();
    // Arguments: txnId, description, merchantKey, amount (0), 'MYR', 'expense', date, ...
    expect(txnInsert!.args[1]).toBe('Lunch bill');
    expect(txnInsert!.args[3]).toBe(0); // amount must be 0 so own spending isn't inflated

    // 3. Insert split with gross = 50, own_share = 0
    const splitInsert = db.statements.find((s) => s.sql.includes('INSERT INTO splits'));
    expect(splitInsert).toBeDefined();
    expect(splitInsert!.args[2]).toBe(50); // gross
    expect(splitInsert!.args[3]).toBe(0); // own_share

    // 4. Insert split_shares with owed = 50, status = 'open'
    const shareInsert = db.statements.find((s) => s.sql.includes('INSERT INTO split_shares'));
    expect(shareInsert).toBeDefined();
    expect(shareInsert!.args[3]).toBe(50); // owed
    expect(shareInsert!.args[4]).toBe(0); // paid
  });

  it('uses default description if note is omitted', async () => {
    const db = install(fakeDb({
      first: {
        people: { id: 'p1', name: 'Bob', created_at: '2026-09-01' },
      },
    }));

    await addDirectDebt('Bob', 120);

    const txnInsert = db.statements.find((s) => s.sql.includes('INSERT INTO transactions'));
    expect(txnInsert).toBeDefined();
    expect(txnInsert!.args[1]).toBe('Owed by Bob');
    expect(txnInsert!.args[3]).toBe(0);
  });
});

describe('deleteDirectDebt', () => {
  it('cascades deletion of share, split, and zero-amount transaction', async () => {
    const db = install(fakeDb({
      first: {
        split_shares: { split_id: 'split1' },
        splits: { id: 'split1', txn_id: 'txn1' },
      },
      all: {
        split_shares: [], // No remaining shares on this split
      },
    }));

    await deleteDirectDebt('share1');

    const sqls = db.sql();
    expect(sqls.some((s) => s.includes('DELETE FROM split_payments WHERE share_id = ?'))).toBe(true);
    expect(sqls.some((s) => s.includes('DELETE FROM split_shares WHERE id = ?'))).toBe(true);
    expect(sqls.some((s) => s.includes('DELETE FROM splits WHERE id = ?'))).toBe(true);
    expect(sqls.some((s) => s.includes('DELETE FROM transactions WHERE id = ? AND amount = 0'))).toBe(true);
  });
});
