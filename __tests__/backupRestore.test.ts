import { unzipSync, strFromU8 } from 'fflate';
import {
  buildReportPeriod,
  buildFinancialReportBundle,
} from '../src/lib/bookkeeping';
import { generateFullBackupZip, type CommitmentExportExtra } from '../src/lib/financialExport';
import { peekBackupZip, InvalidBackupError } from '../src/lib/backupRestore';
import { validateBackupPayload } from '../src/db/restoreRepo';
import { __seedCategoriesForTest } from '../src/db/db';
import type { Account, BalanceEntry, Category, Transaction } from '../src/lib/types';
import type { Commitment, CommitmentOccurrence } from '../src/lib/commitments';

/** Builds a minimal full-backup fixture and returns the parsed `backup.json` payload, mirroring
 *  the zip-reading idiom above (`unzipSync` + `strFromU8`). `extra` accepts the same pieces
 *  `generateFullBackupZip` does, plus `transactions` (Task 20/Trips will pass its own extra
 *  pieces through the same second argument, so this signature is fixed up front). */
function buildBackupPayloadForTest(
  cats: Category[],
  extra?: Partial<CommitmentExportExtra & { transactions: Transaction[] }>
): any {
  const { transactions = [], ...restExtra } = extra ?? {};
  const period = buildReportPeriod('all-time');
  const bundle = buildFinancialReportBundle(transactions, cats, [], [], period, 'Pip User', {}, 'MYR');
  const zipBytes = generateFullBackupZip(bundle, transactions, restExtra as CommitmentExportExtra);
  const zipEntries = unzipSync(zipBytes);
  return JSON.parse(strFromU8(zipEntries['backup.json']));
}

/** Minimal fake db for `seedCategories`, mirroring __tests__/categorySeeding.test.ts's idiom. */
function fakeDb(rows: { all?: Record<string, unknown[]> } = {}) {
  const statements: { sql: string; args: unknown[] }[] = [];
  return {
    statements,
    runAsync: (sql: string, ...args: unknown[]) => {
      statements.push({ sql, args });
      return Promise.resolve({ changes: 1, lastInsertRowId: 1 });
    },
    getFirstAsync: () => Promise.resolve(null),
    getAllAsync: (sql: string) => {
      const key = Object.keys(rows.all ?? {}).find((k) => sql.includes(k));
      return Promise.resolve(key !== undefined ? (rows.all as Record<string, unknown[]>)[key] : []);
    },
    execAsync: () => Promise.resolve(),
    withTransactionAsync: (fn: () => Promise<void>) => fn(),
  };
}

function makeTxn(over: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    merchantRaw: 'GrabCar',
    merchantKey: 'grabcar',
    amount: 30,
    currency: 'MYR',
    type: 'expense',
    date: '2026-06-15',
    categoryId: 'transport',
    createdAt: '2026-06-15T10:00:00.000Z',
    source: 'extracted',
    ...over,
  };
}

function makeAcct(over: Partial<Account>): Account {
  return {
    id: 'a1',
    name: 'CIMB Bank',
    kind: 'asset',
    cls: 'cash',
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    currency: 'MYR',
    sub: null,
    symbol: null,
    ticker: null,
    quantity: null,
    cost: null,
    ...over,
  };
}

function makeEntry(over: Partial<BalanceEntry>): BalanceEntry {
  return {
    id: Math.random().toString(36).slice(2),
    accountId: 'a1',
    value: 5000,
    asOf: '2026-06-30',
    createdAt: '2026-06-30T10:00:00.000Z',
    ...over,
  };
}

const mockCategories: Category[] = [
  { id: 'salary', label: 'Monthly Salary', icon: 'wallet', hue: 150, kind: 'income', isDefault: true, isHidden: false, templateKey: null, labelOverride: null, iconOverride: null, hueOverride: null },
  { id: 'transport', label: 'Transport & Fuel', icon: 'car', hue: 240, kind: 'expense', isDefault: true, isHidden: false, templateKey: null, labelOverride: null, iconOverride: null, hueOverride: null },
];

describe('generateFullBackupZip', () => {
  const receiptTxn = makeTxn({
    id: 'txn-receipt',
    merchantRaw: 'Starbucks Coffee',
    amount: 18.5,
    date: '2026-06-03',
    receiptUri: 'file:///data/receipts/starbucks_01.jpg',
  });
  const plainTxn = makeTxn({ id: 'txn-plain' });
  const txns = [receiptTxn, plainTxn];
  const accounts = [makeAcct({ id: 'acct-1' })];
  const entries = [makeEntry({ accountId: 'acct-1', value: 1000, asOf: '2026-06-30' })];
  const period = buildReportPeriod('all-time');
  const bundle = buildFinancialReportBundle(txns, mockCategories, accounts, entries, period, 'Pip User', {}, 'MYR');

  const commitment: Commitment = {
    id: 'c1',
    label: 'Rent',
    merchantKey: 'rent',
    kind: 'expense',
    amount: 1200,
    currency: 'MYR',
    categoryId: 'transport',
    fromAccountId: 'acct-1',
    toAccountId: null,
    dueDay: 1,
    startMonth: '2026-01',
    endMonth: null,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    reliefCode: null,
  };
  const occurrence: CommitmentOccurrence = {
    id: 'occ-1',
    commitmentId: 'c1',
    dueDate: '2026-06-01',
    month: '2026-06',
    amount: 1200,
    paidAmount: 1200,
    paidOn: '2026-06-01',
    status: 'paid',
    txnId: 'txn-plain',
    txnCreated: true,
    unitsAdded: null,
    priceMYR: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    fxRate: null,
  };

  const extra: CommitmentExportExtra = {
    commitments: [commitment],
    occurrences: [occurrence],
    allTransactions: txns,
  };

  it('produces a zip with backup.json, a receipt entry, MANIFEST.json and README.txt', () => {
    const zipBytes = generateFullBackupZip(bundle, txns, extra);
    expect(zipBytes).toBeInstanceOf(Uint8Array);
    const entries2 = unzipSync(zipBytes);
    expect(entries2['backup.json']).toBeDefined();
    expect(entries2['MANIFEST.json']).toBeDefined();
    expect(entries2['README.txt']).toBeDefined();
  });

  it('extends the JSON with id-preserving fields restore needs', () => {
    const zipBytes = generateFullBackupZip(bundle, txns, extra);
    const { payload } = peekBackupZip(zipBytes);

    const txnRow = payload.transactions!.find((t: any) => t.id === 'txn-receipt');
    expect(txnRow.categoryId).toBe('transport');
    expect(txnRow.receiptFile).toMatch(/starbucks/i);

    const acctRow = payload.accounts!.find((a: any) => a.name === 'CIMB Bank');
    expect(acctRow.id).toBe('acct-1');

    const commitmentRow = payload.commitments!.find((c: any) => c.id === 'c1');
    expect(commitmentRow.categoryId).toBe('transport');
    expect(commitmentRow.fromAccountId).toBe('acct-1');
    expect(commitmentRow.occurrences[0].id).toBe('occ-1');
    expect(commitmentRow.occurrences[0].txnId).toBe('txn-plain');
  });

  it('does not add receiptFile to the plain Advanced Import JSON export (no receiptFileByUri)', () => {
    const { generateAdvancedImportJSON } = require('../src/lib/financialExport');
    const json = JSON.parse(generateAdvancedImportJSON(bundle, extra));
    const txnRow = json.transactions.find((t: any) => t.id === 'txn-receipt');
    expect(txnRow.receiptFile).toBeUndefined();
  });
});

describe('peekBackupZip', () => {
  it('rejects a non-zip file', () => {
    expect(() => peekBackupZip(new TextEncoder().encode('not a zip'))).toThrow(InvalidBackupError);
  });

  it('rejects a zip with no backup.json', () => {
    const { zipSync, strToU8 } = require('fflate');
    const bytes = zipSync({ 'readme.txt': strToU8('hello') });
    expect(() => peekBackupZip(bytes)).toThrow(InvalidBackupError);
  });
});

describe('validateBackupPayload', () => {
  it('accepts a minimal well-shaped payload', () => {
    expect(validateBackupPayload({ transactions: [], accounts: [], categories: [] })).toBe(true);
  });

  it('rejects non-objects and malformed arrays', () => {
    expect(validateBackupPayload(null)).toBe(false);
    expect(validateBackupPayload('a string')).toBe(false);
    expect(validateBackupPayload({ transactions: 'not-an-array' })).toBe(false);
  });
});

describe('category visibility and overrides round-trip', () => {
  it('carries the new fields through the backup payload', () => {
    const cats: Category[] = [
      {
        id: 'opt-petrol', label: 'Petrol', icon: 'car', hue: 12, kind: 'expense', isDefault: false,
        isHidden: true, templateKey: 'optional.car.petrol.v1',
        labelOverride: 'Minyak', iconOverride: null, hueOverride: 42,
      },
    ];
    const payload = buildBackupPayloadForTest(cats);
    expect(payload.categories[0]).toMatchObject({
      id: 'opt-petrol',
      isHidden: true,
      templateKey: 'optional.car.petrol.v1',
      labelOverride: 'Minyak',
      hueOverride: 42,
    });
  });

  it('accepts an older backup whose categories have none of the new fields', () => {
    const legacy = { categories: [{ id: 'food', label: 'Food', icon: 'burger', hue: 162, kind: 'expense', isDefault: true }] };
    expect(validateBackupPayload(legacy)).toBe(true);
  });

  it('a restored optional category is not re-added by the next seed', async () => {
    const db = fakeDb({ all: { deleted_default_categories: [] } });
    await __seedCategoriesForTest(db as any);
    const inserted = db.statements
      .filter((s) => s.sql.includes('INSERT INTO categories'))
      .map((s) => s.args[0]);
    expect(inserted).not.toContain('opt-petrol');
  });
});
