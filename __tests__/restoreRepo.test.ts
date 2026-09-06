// Verifies restoreFromBackupPayload's SQL orchestration against a recording fake, same pattern
// as dbCascades.test.ts, since standing up real SQLite in Jest isn't set up in this repo.
jest.mock('../src/db/db', () => {
  const actual = jest.requireActual('../src/db/db');
  return { ...actual, getDb: () => Promise.resolve((global as any).__fakeDb) };
});

import { restoreFromBackupPayload, validateBackupPayload } from '../src/db/restoreRepo';

interface Statement {
  sql: string;
  args: unknown[];
}

function fakeDb() {
  const statements: Statement[] = [];
  return {
    statements,
    sql: () => statements.map((s) => s.sql.replace(/\s+/g, ' ').trim()),
    runAsync: (sql: string, ...args: unknown[]) => {
      statements.push({ sql, args });
      return Promise.resolve({ changes: 1, lastInsertRowId: 1 });
    },
    execAsync: (sql: string) => {
      statements.push({ sql, args: [] });
      return Promise.resolve();
    },
    withTransactionAsync: (fn: () => Promise<void>) => fn(),
  };
}

function install(db: ReturnType<typeof fakeDb>) {
  (global as any).__fakeDb = db;
  return db;
}

afterEach(() => {
  delete (global as any).__fakeDb;
});

describe('restoreFromBackupPayload', () => {
  it('wipes every user table before inserting anything', async () => {
    const db = install(fakeDb());
    await restoreFromBackupPayload({ transactions: [] }, new Map());
    const wipe = db.statements[0];
    expect(wipe.sql).toContain('DELETE FROM transactions');
    expect(wipe.sql).toContain('DELETE FROM categories');
    expect(wipe.sql).toContain('DELETE FROM commitments');
  });

  it('resolves a transaction receiptFile through the filename→URI map', async () => {
    const db = install(fakeDb());
    await restoreFromBackupPayload(
      {
        transactions: [
          { id: 't1', description: 'Starbucks', amount: -18.5, currency: 'MYR', categoryId: 'food', receiptFile: '20260603_starbucks.jpg' },
        ],
      },
      new Map([['20260603_starbucks.jpg', 'file:///restored/receipts/abc123.jpg']])
    );
    const insert = db.statements.find((s) => s.sql.includes('INSERT INTO transactions'));
    expect(insert).toBeDefined();
    expect(insert!.args).toContain('file:///restored/receipts/abc123.jpg');
    // Negative amount restores as an expense row.
    expect(insert!.args).toContain('expense');
    // The `amount` column itself must stay positive — sign is carried by `type` alone,
    // matching every other write path (see Transaction/ExtractedTxn's "always positive"
    // contract). Storing the signed backup value verbatim corrupts every downstream sum
    // (recap totals, category breakdowns) for restored expense rows.
    expect(insert!.args[3]).toBe(18.5);
  });

  it('restores a positive-amount row as income', async () => {
    const db = install(fakeDb());
    await restoreFromBackupPayload(
      { transactions: [{ id: 't2', description: 'Salary', amount: 5000, currency: 'MYR' }] },
      new Map()
    );
    const insert = db.statements.find((s) => s.sql.includes('INSERT INTO transactions'));
    expect(insert!.args).toContain('income');
  });

  it('leaves a transaction with no receiptFile with a null receipt_uri', async () => {
    const db = install(fakeDb());
    await restoreFromBackupPayload(
      { transactions: [{ id: 't3', description: 'Mamak', amount: -12 }] },
      new Map()
    );
    const insert = db.statements.find((s) => s.sql.includes('INSERT INTO transactions'));
    // id, merchant_raw, merchant_key, amount, currency, type, txn_date, category_id, created_at,
    // source, remark, receipt_uri, native_amount, fx_rate — receipt_uri is index 11.
    expect(insert!.args[11]).toBeNull();
  });

  it('inserts commitments with the original id and merchant_key derived from the label', async () => {
    const db = install(fakeDb());
    await restoreFromBackupPayload(
      { commitments: [{ id: 'c1', label: 'Rent', amount: 1200, dueDay: 1, startMonth: '2026-01', occurrences: [] }] },
      new Map()
    );
    const insert = db.statements.find((s) => s.sql.includes('INSERT INTO commitments'));
    expect(insert!.args[0]).toBe('c1');
    expect(insert!.args).toContain('rent');
  });

  it('skips malformed rows without an id rather than throwing', async () => {
    const db = install(fakeDb());
    await expect(
      restoreFromBackupPayload({ transactions: [{ description: 'no id here' }] }, new Map())
    ).resolves.toBeUndefined();
    expect(db.statements.some((s) => s.sql.includes('INSERT INTO transactions'))).toBe(false);
  });
});

describe('validateBackupPayload', () => {
  it('accepts undefined optional arrays', () => {
    expect(validateBackupPayload({})).toBe(true);
  });
});
