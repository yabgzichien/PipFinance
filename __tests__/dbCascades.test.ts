// Cascade and adjustment behaviour at the repo layer, exercised against a recording fake so
// the SQL each function actually issues is observable without standing up SQLite.
jest.mock('../src/db/db', () => {
  const actual = jest.requireActual('../src/db/db');
  return { ...actual, getDb: () => Promise.resolve((global as any).__fakeDb) };
});

import { adjustHoldingCost, adjustHoldingQuantity } from '../src/db/accountsRepo';
import { deleteCategory } from '../src/db/categoriesRepo';
import { listOccurrencesByTxnIds } from '../src/db/commitmentsRepo';
import { recordPayment } from '../src/db/splitRepo';

interface Statement {
  sql: string;
  args: unknown[];
}

/**
 * A stand-in for the SQLiteDatabase surface these repos use. `rows` seeds whatever
 * getFirstAsync/getAllAsync should answer with, keyed by a substring of the query.
 */
function fakeDb(rows: { first?: Record<string, unknown>; all?: Record<string, unknown[]> } = {}) {
  const statements: Statement[] = [];
  const pick = <T,>(table: Record<string, T> | undefined, sql: string): T | undefined => {
    if (!table) return undefined;
    const key = Object.keys(table).find((k) => sql.includes(k));
    return key === undefined ? undefined : table[key];
  };
  return {
    statements,
    /** Every statement issued, normalised to single spaces so assertions stay readable. */
    sql: () => statements.map((s) => s.sql.replace(/\s+/g, ' ').trim()),
    runAsync: (sql: string, ...args: unknown[]) => {
      statements.push({ sql, args });
      return Promise.resolve({ changes: 1, lastInsertRowId: 1 });
    },
    getFirstAsync: (sql: string, ..._args: unknown[]) => Promise.resolve(pick(rows.first, sql) ?? null),
    getAllAsync: (sql: string, ..._args: unknown[]) => Promise.resolve(pick(rows.all, sql) ?? []),
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

describe('adjustHoldingQuantity / adjustHoldingCost', () => {
  // A DCA tick used to read the holding out of React state and write back an absolute
  // figure. Two ticks in a row without an intervening reload both read the same pre-tick
  // value, so the second silently overwrote the first contribution.
  it('moves quantity by a delta in SQL rather than writing an absolute figure', async () => {
    const db = install(fakeDb());
    await adjustHoldingQuantity('acc1', 0.00166667);
    const [stmt] = db.statements;
    expect(stmt.sql.replace(/\s+/g, ' ')).toContain('quantity = ');
    expect(stmt.sql).toContain('quantity');
    expect(stmt.args).toEqual([0.00166667, 'acc1']);
    // The new value is derived from the column, never from a number the caller carried in.
    expect(stmt.sql).toMatch(/quantity\s*=\s*[^?]*quantity/);
  });

  it('never lets an untick drive a holding negative', async () => {
    const db = install(fakeDb());
    await adjustHoldingQuantity('acc1', -0.00166667);
    expect(db.statements[0].sql).toContain('max(0');
  });

  it('moves cost the same way, clamped at zero', async () => {
    const db = install(fakeDb());
    await adjustHoldingCost('acc1', -500);
    const [stmt] = db.statements;
    expect(stmt.sql).toMatch(/cost\s*=\s*[^?]*cost/);
    expect(stmt.sql).toContain('max(0');
    expect(stmt.args).toEqual([-500, 'acc1']);
  });
});

describe('deleteCategory', () => {
  const seeded = {
    first: {
      'SELECT kind, is_default': { kind: 'expense', is_default: 0 },
      'SELECT id FROM categories': { id: 'other' },
    },
  };

  it('reassigns recurring bills to the fallback, not just transactions', async () => {
    const db = install(fakeDb(seeded));
    await deleteCategory('broadband');
    const commitments = db.statements.find((s) => s.sql.includes('UPDATE commitments'));
    expect(commitments).toBeDefined();
    expect(commitments?.sql).toContain('category_id');
    expect(commitments?.args).toEqual(['other', 'broadband']);
  });

  it('still reassigns transactions and clears the learned mappings', async () => {
    const db = install(fakeDb(seeded));
    await deleteCategory('broadband');
    const sql = db.sql();
    expect(sql).toContain('UPDATE transactions SET category_id = ? WHERE category_id = ?');
    expect(sql).toContain('DELETE FROM merchant_memory WHERE category_id = ?');
    expect(sql).toContain('DELETE FROM budget_allocation WHERE category_id = ?');
    expect(sql).toContain('DELETE FROM categories WHERE id = ?');
  });
});

describe('listOccurrencesByTxnIds', () => {
  it('answers nothing for an empty id list without touching the database', async () => {
    const db = install(fakeDb());
    expect(await listOccurrencesByTxnIds([])).toEqual([]);
    expect(db.statements).toHaveLength(0);
  });

  it('looks the occurrences up by txn_id', async () => {
    install(
      fakeDb({
        all: {
          'FROM commitment_occurrences': [
            {
              id: 'occ1',
              commitment_id: 'c1',
              due_date: '2026-08-05',
              month: '2026-08',
              amount: 89,
              paid_amount: 89,
              paid_on: '2026-08-04',
              status: 'paid',
              txn_id: 't1',
              txn_created: 1,
              units_added: null,
              price_myr: null,
              created_at: '2026-08-01T00:00:00.000Z',
              fx_rate: null,
            },
          ],
        },
      })
    );
    const found = await listOccurrencesByTxnIds(['t1']);
    expect(found).toHaveLength(1);
    expect(found[0].txnId).toBe('t1');
    expect(found[0].txnCreated).toBe(true);
  });
});

describe('recordPayment', () => {
  const share = {
    id: 's1',
    split_id: 'sp1',
    person_id: 'p1',
    owed: 30,
    paid: 0,
    status: 'open',
    created_at: '2026-08-01T00:00:00.000Z',
    written_off_txn_id: null,
  };

  it('reports how much it actually applied', async () => {
    install(fakeDb({ first: { 'FROM split_shares': share } }));
    const result = await recordPayment('s1', 30, '2026-08-10', 'declared', null, 'cash');
    expect(result?.applied).toBe(30);
    expect(result?.paid).toBe(30);
  });

  // The double-tap: the second call finds nothing left to apply. It used to return a truthy
  // object with no `applied` on it, and the caller credited the account the full amount again.
  it('reports zero applied, and writes no payment row, when the share is already settled', async () => {
    const db = install(fakeDb({ first: { 'FROM split_shares': { ...share, paid: 30, status: 'settled' } } }));
    const result = await recordPayment('s1', 30, '2026-08-10', 'declared', null, 'cash');
    expect(result?.applied).toBe(0);
    expect(db.statements.filter((s) => s.sql.includes('INSERT INTO split_payments'))).toHaveLength(0);
  });

  it('caps an overpayment at what is still outstanding', async () => {
    install(fakeDb({ first: { 'FROM split_shares': { ...share, paid: 20 } } }));
    const result = await recordPayment('s1', 30, '2026-08-10', 'declared', null, 'cash');
    expect(result?.applied).toBe(10);
    expect(result?.paid).toBe(30);
  });

  it('is null for a share that does not exist', async () => {
    install(fakeDb());
    expect(await recordPayment('nope', 30, '2026-08-10', 'declared', null, null)).toBeNull();
  });
});
