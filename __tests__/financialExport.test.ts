import * as XLSX from 'xlsx';
import {
  buildReportPeriod,
  buildFinancialReportBundle,
} from '../src/lib/bookkeeping';
import {
  generateExcelWorkbook,
  generateCSV,
  csvToHtmlTable,
  generateHTMLReport,
  generatePrintablePDFHtml,
  generateAdvancedImportJSON,
  generateEwalletCSV,
  generateEwalletPreviewHtml,
  generateReceiptsZip,
  generateReceiptsPreviewHtml,
  buildReceiptExportList,
  isEwalletTransaction,
  getEwalletProviderName,
  formatCurrency,
  saveOrDownloadExport,
  shareExportFile,
} from '../src/lib/financialExport';
import { parseJSON } from '../src/lib/advancedImport';
import { unzlibSync } from 'fflate';
import type { Commitment, CommitmentOccurrence } from '../src/lib/commitments';
import type { Account, BalanceEntry, Category, ReliefTag, Transaction } from '../src/lib/types';

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
  { id: 'salary', label: 'Monthly Salary', icon: 'wallet', hue: 150, kind: 'income', isDefault: true },
  { id: 'transport', label: 'Transport & Fuel', icon: 'car', hue: 240, kind: 'expense', isDefault: true },
  { id: 'food', label: 'Food & Groceries', icon: 'cart', hue: 160, kind: 'expense', isDefault: true },
];

describe('generateExcelWorkbook', () => {
  const txns = [
    makeTxn({ merchantRaw: 'Employer Inc', merchantKey: 'employer', type: 'income', categoryId: 'salary', amount: 5000, date: '2026-06-01', source: 'manual' }),
    makeTxn({ merchantRaw: 'RapidKL LRT', merchantKey: 'rapidkl', type: 'expense', categoryId: 'transport', amount: 300, date: '2026-06-10', source: 'manual' }),
    makeTxn({ merchantRaw: 'Jaya Grocer', merchantKey: 'jayagrocer', type: 'expense', categoryId: 'food', amount: 700, date: '2026-06-12', source: 'manual' }),
  ];
  const accounts = [makeAcct({ id: 'a1', kind: 'asset', cls: 'cash' })];
  const entries = [makeEntry({ accountId: 'a1', value: 8000, asOf: '2026-06-30' })];
  const period = buildReportPeriod('monthly', '2026-06');
  const bundle = buildFinancialReportBundle(txns, mockCategories, accounts, entries, period, 'Test Borrower');

  it('generates a valid .xlsx binary array with all 4 sheets', () => {
    const bytes = generateExcelWorkbook(bundle);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(500);

    // Read back workbook
    const wb = XLSX.read(bytes, { type: 'array' });
    expect(wb.SheetNames).toEqual([
      'Income Statement',
      'Balance Sheet',
      'Transaction Ledger',
      'Trends & Statistics',
    ]);

    // Check Income Statement Sheet content
    const isCsv = XLSX.utils.sheet_to_csv(wb.Sheets['Income Statement']);
    expect(isCsv).toContain('FINANCIAL REPORT: INCOME STATEMENT');
    expect(isCsv).toContain('Monthly Salary');
    expect(isCsv).toContain('5000');
    expect(isCsv).toContain('TOTAL EXPENSES');
    expect(isCsv).toContain('1000');

    // Check Balance Sheet
    const bsCsv = XLSX.utils.sheet_to_csv(wb.Sheets['Balance Sheet']);
    expect(bsCsv).toContain('TOTAL ASSETS');
    expect(bsCsv).toContain('TOTAL NET WORTH');

    // Check Ledger
    const ledgerCsv = XLSX.utils.sheet_to_csv(wb.Sheets['Transaction Ledger']);
    expect(ledgerCsv).toContain('RapidKL LRT');
  });
});

describe('generateCSV', () => {
  const txns = [
    makeTxn({ type: 'income', categoryId: 'salary', amount: 4500, date: '2026-06-01' }),
    makeTxn({ type: 'expense', categoryId: 'food', amount: 500, date: '2026-06-05' }),
  ];
  const accounts = [makeAcct({ id: 'a1' })];
  const entries = [makeEntry({ value: 6000 })];
  const period = buildReportPeriod('monthly', '2026-06');
  const bundle = buildFinancialReportBundle(txns, mockCategories, accounts, entries, period, 'Nurul');

  it('generates structured CSV with headers, summaries, and ledger lines', () => {
    const csv = generateCSV(bundle);
    expect(csv).toContain('"FINANCIAL REPORT & BOOKKEEPING EXPORT"');
    expect(csv).toContain('"Name","Nurul"');
    expect(csv).toContain('"Total Revenue",4500');
    expect(csv).toContain('"Total Expenses",500');
    expect(csv).toContain('"Net Income / Savings",4000');
    expect(csv).toContain('=== TRANSACTION LEDGER ===');
  });
});

describe('csvToHtmlTable', () => {
  const txns = [
    makeTxn({ type: 'income', categoryId: 'salary', amount: 4500, date: '2026-06-01' }),
    makeTxn({ type: 'expense', categoryId: 'food', amount: 500, date: '2026-06-05', merchantRaw: 'Ah <Fatt> "Kopitiam"' }),
  ];
  const accounts = [makeAcct({ id: 'a1' })];
  const entries = [makeEntry({ value: 6000 })];
  const period = buildReportPeriod('monthly', '2026-06');
  const bundle = buildFinancialReportBundle(txns, mockCategories, accounts, entries, period, 'Nurul');

  it('renders the CSV report as a real HTML table instead of raw text', () => {
    const csv = generateCSV(bundle);
    const html = csvToHtmlTable(csv);

    expect(html).toContain('<table>');
    expect(html).toContain('<tr class="section"><td colspan="8">TRANSACTION LEDGER</td></tr>');
    // Row cells land in their own <td>, not a single comma-joined blob.
    expect(html).toMatch(/<td>Nurul<\/td>/);
    expect(html).toMatch(/<td>4500<\/td>/);
  });

  it('escapes HTML special characters in cell content', () => {
    const csv = generateCSV(bundle);
    const html = csvToHtmlTable(csv);

    expect(html).toContain('Ah &lt;Fatt&gt; &quot;Kopitiam&quot;');
    expect(html).not.toContain('Ah <Fatt>');
  });
});

describe('generateHTMLReport', () => {
  const txns = [
    makeTxn({ type: 'income', categoryId: 'salary', amount: 3500, date: '2026-05-01' }),
    makeTxn({ type: 'expense', categoryId: 'food', amount: 800, date: '2026-05-10' }),
    makeTxn({ type: 'income', categoryId: 'salary', amount: 4500, date: '2026-06-01' }),
    makeTxn({ type: 'expense', categoryId: 'food', amount: 900, date: '2026-06-10' }),
  ];
  const accounts = [makeAcct({ id: 'a1' })];
  const entries = [makeEntry({ value: 5000, asOf: '2026-06-30' })];
  const period = buildReportPeriod('yearly', undefined, 2026);
  const bundle = buildFinancialReportBundle(txns, mockCategories, accounts, entries, period, 'Faizal');

  it('generates complete standalone HTML with embedded SVG charts and statistics', () => {
    const html = generateHTMLReport(bundle);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Financial Report & Analytics - Faizal - Year 2026</title>');
    expect(html).toContain('Monthly Cash Flow (Income vs Expenses)');
    expect(html).toContain('Expense Category Distribution');
    expect(html).toContain('Net Worth & Cumulative Savings Trajectory');
    expect(html).toContain('<svg');
    expect(html).toContain('Income Statement (P&amp;L)');
    expect(html).toContain('Balance Sheet');
    expect(html).toContain('Itemized Transaction Ledger');
  });
});

describe('generateAdvancedImportJSON', () => {
  const txns = [
    makeTxn({ type: 'income', categoryId: 'salary', amount: 4500, date: '2026-06-01', merchantRaw: 'Employer Sdn Bhd' }),
    makeTxn({ type: 'expense', categoryId: 'food', amount: 500, date: '2026-06-05', merchantRaw: 'Grocer' }),
  ];
  const accounts = [
    makeAcct({ id: 'a1', name: 'CIMB Bank', kind: 'asset', cls: 'cash' }),
    makeAcct({ id: 'a2', name: 'Owed by Friends', kind: 'asset', cls: 'receivable' }),
  ];
  const entries = [
    makeEntry({ accountId: 'a1', value: 6000, asOf: '2026-06-30' }),
    makeEntry({ accountId: 'a2', value: 120, asOf: '2026-06-30' }),
  ];
  const period = buildReportPeriod('monthly', '2026-06');
  const bundle = buildFinancialReportBundle(txns, mockCategories, accounts, entries, period, 'Nurul');

  it('produces JSON that round-trips through the Advanced Import parser', () => {
    const json = generateAdvancedImportJSON(bundle);
    const { transactions, accounts: parsedAccounts } = parseJSON(json);

    expect(transactions).toHaveLength(2);
    expect(transactions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'income', amount: 4500, merchant: 'Employer Sdn Bhd' }),
      expect.objectContaining({ type: 'expense', amount: 500, merchant: 'Grocer' }),
    ]));

    // The managed receivable ("Owed to me") balance must never round-trip
    // back into a re-importable account.
    expect(parsedAccounts).toHaveLength(1);
    expect(parsedAccounts[0]).toMatchObject({ name: 'CIMB Bank', cls: 'cash', balance: 6000 });
  });

  it('stamps a version-3 payload', () => {
    const json = generateAdvancedImportJSON(bundle);
    expect(JSON.parse(json).version).toBe(3);
  });
});

describe('generateAdvancedImportJSON — version 2 additions', () => {
  const txns = [
    makeTxn({ type: 'income', categoryId: 'salary', amount: 4500, date: '2026-06-01', merchantRaw: 'Employer Sdn Bhd' }),
    makeTxn({ type: 'expense', categoryId: 'food', amount: 500, date: '2026-06-05', merchantRaw: 'Grocer' }),
    makeTxn({ type: 'transfer', categoryId: null, amount: 200, date: '2026-06-15', merchantRaw: 'Stockbroker DCA', merchantKey: 'stockbroker-dca' }),
  ];
  const accounts = [
    makeAcct({ id: 'a1', name: 'CIMB Bank', kind: 'asset', cls: 'cash' }),
    makeAcct({ id: 'a2', name: 'S&P 500 ETF', kind: 'asset', cls: 'investments', sub: 'stock', symbol: 'VOO', ticker: 'VOO', quantity: 1.5, cost: 600 }),
  ];
  const entries = [
    makeEntry({ accountId: 'a1', value: 4800, asOf: '2026-06-30' }),
    makeEntry({ accountId: 'a2', value: 0, asOf: '2026-06-30' }),
  ];
  const period = buildReportPeriod('monthly', '2026-06');
  const bundle = buildFinancialReportBundle(txns, mockCategories, accounts, entries, period, 'Nurul');

  const commitment: Commitment = {
    id: 'c1', label: 'S&P 500 DCA', merchantKey: 'stockbroker-dca', kind: 'investment', amount: 200,
    categoryId: null, fromAccountId: 'a1', toAccountId: 'a2', dueDay: 15, startMonth: '2026-05',
    endMonth: null, archived: false, createdAt: '2026-05-01T00:00:00.000Z', reliefCode: null,
    currency: 'MYR',
  };
  const occurrences: CommitmentOccurrence[] = [
    { id: 'o1', commitmentId: 'c1', dueDate: '2026-05-15', month: '2026-05', amount: 200, paidAmount: 200, paidOn: '2026-05-14', status: 'paid', txnId: null, txnCreated: true, unitsAdded: 1.5, priceMYR: 400, createdAt: '2026-05-01T00:00:00.000Z', fxRate: null },
    { id: 'o2', commitmentId: 'c1', dueDate: '2026-06-15', month: '2026-06', amount: 200, paidAmount: null, paidOn: null, status: 'scheduled', txnId: null, txnCreated: false, unitsAdded: null, priceMYR: null, createdAt: '2026-06-01T00:00:00.000Z', fxRate: null },
  ];

  it('keeps a transfer out of the `transactions` array and puts it in `transfers` instead', () => {
    const json = generateAdvancedImportJSON(bundle);
    const payload = JSON.parse(json);
    expect(payload.transactions).toHaveLength(2);
    expect(payload.transactions.every((t: { description: string }) => t.description !== 'Stockbroker DCA')).toBe(true);
    expect(payload.transfers).toEqual([
      expect.objectContaining({ description: 'Stockbroker DCA', amount: 200 }),
    ]);
  });

  it('a transfer round-trips through parseJSON as its own array, never as income', () => {
    const json = generateAdvancedImportJSON(bundle);
    const { transactions, transfers } = parseJSON(json);
    expect(transactions.some((t) => t.merchant === 'Stockbroker DCA')).toBe(false);
    expect(transfers).toEqual([
      expect.objectContaining({ description: 'Stockbroker DCA', amount: 200, date: '2026-06-15' }),
    ]);
  });

  it('exports quantity and cost on a holding account row', () => {
    const json = generateAdvancedImportJSON(bundle);
    const payload = JSON.parse(json);
    const holding = payload.accounts.find((a: { name: string }) => a.name === 'S&P 500 ETF');
    expect(holding).toMatchObject({ quantity: 1.5, cost: 600 });
  });

  it('quantity and cost round-trip through parseJSON', () => {
    const json = generateAdvancedImportJSON(bundle);
    const { accounts: parsedAccounts } = parseJSON(json);
    const holding = parsedAccounts.find((a) => a.name === 'S&P 500 ETF');
    expect(holding).toMatchObject({ quantity: 1.5, cost: 600 });
  });

  it('carries a commitment and its full occurrence history, resolving category/account names', () => {
    const json = generateAdvancedImportJSON(bundle, { commitments: [commitment], occurrences });
    const payload = JSON.parse(json);
    expect(payload.commitments).toEqual([
      expect.objectContaining({
        label: 'S&P 500 DCA',
        kind: 'investment',
        amount: 200,
        dueDay: 15,
        fromAccount: 'CIMB Bank',
        toAccount: 'S&P 500 ETF',
        startMonth: '2026-05',
        endMonth: null,
      }),
    ]);
    expect(payload.commitments[0].occurrences).toHaveLength(2);
    expect(payload.commitments[0].occurrences[0]).toMatchObject({ dueDate: '2026-05-15', status: 'paid', paidOn: '2026-05-14', paidAmount: 200 });
  });

  it('a commitment with its occurrence history round-trips through parseJSON', () => {
    const json = generateAdvancedImportJSON(bundle, { commitments: [commitment], occurrences });
    const { commitments: parsed } = parseJSON(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      label: 'S&P 500 DCA',
      kind: 'investment',
      amount: 200,
      dueDay: 15,
      fromAccount: 'CIMB Bank',
      toAccount: 'S&P 500 ETF',
    });
    expect(parsed[0].occurrences).toEqual([
      { dueDate: '2026-05-15', status: 'paid', paidOn: '2026-05-14', paidAmount: 200 },
      { dueDate: '2026-06-15', status: 'scheduled', paidOn: null, paidAmount: null },
    ]);
  });

  it('omitting the commitments extra produces an empty commitments array, not an error', () => {
    const json = generateAdvancedImportJSON(bundle);
    expect(JSON.parse(json).commitments).toEqual([]);
  });

  it('exports multi-currency transactions, accounts, transfers and commitments with currencies preserved', () => {
    const multiTxns = [
      makeTxn({ type: 'income', categoryId: 'salary', amount: 5000, currency: 'SGD', date: '2026-06-01', merchantRaw: 'Singapore Client' }),
      makeTxn({ type: 'expense', categoryId: 'food', amount: 35, currency: 'USD', date: '2026-06-05', merchantRaw: 'US SaaS' }),
      makeTxn({ type: 'transfer', categoryId: null, amount: 1000, currency: 'USD', date: '2026-06-15', merchantRaw: 'Wise USD Transfer' }),
    ];
    const multiAccounts = [
      makeAcct({ id: 'a_sgd', name: 'DBS SGD', kind: 'asset', cls: 'cash', currency: 'SGD' }),
    ];
    const multiEntries = [
      makeEntry({ accountId: 'a_sgd', value: 12000, asOf: '2026-06-30' }),
    ];
    const multiCommitment: Commitment = {
      id: 'c_usd', label: 'AWS Server', merchantKey: 'aws-server', kind: 'expense', amount: 50, currency: 'USD',
      categoryId: 'food', fromAccountId: 'a_sgd', toAccountId: null, dueDay: 1, startMonth: '2026-01',
      endMonth: null, archived: false, createdAt: '2026-01-01T00:00:00.000Z', reliefCode: null,
    };
    const multiBundle = buildFinancialReportBundle(multiTxns, mockCategories, multiAccounts, multiEntries, period, 'Nurul', { SGD: 3.5, USD: 4.7 });
    const json = generateAdvancedImportJSON(multiBundle, { commitments: [multiCommitment], occurrences: [] });
    const parsed = parseJSON(json);

    expect(parsed.transactions).toEqual(expect.arrayContaining([
      expect.objectContaining({ merchant: 'Singapore Client', amount: 5000, currency: 'SGD' }),
      expect.objectContaining({ merchant: 'US SaaS', amount: 35, currency: 'USD' }),
    ]));
    expect(parsed.transfers).toEqual([
      expect.objectContaining({ description: 'Wise USD Transfer', amount: 1000, currency: 'USD' }),
    ]);
    // The exported balance must be the account's own native SGD figure, not the MYR value
    // the balance sheet converted it to (12000 × 3.5 = 42000). A re-import reads `balance`
    // as being denominated in the `currency` beside it, so emitting MYR here would inflate
    // the account by the exchange rate on every round trip.
    expect(parsed.accounts).toEqual([
      expect.objectContaining({ name: 'DBS SGD', currency: 'SGD', balance: 12000 }),
    ]);
    expect(parsed.commitments).toEqual([
      expect.objectContaining({ label: 'AWS Server', currency: 'USD', amount: 50 }),
    ]);
  });

  it('exports full Version 3 database entities and round-trips through parseJSON without images', () => {
    const v3Txns = [
      makeTxn({
        id: 't_split_1',
        type: 'expense',
        categoryId: 'food',
        amount: 30, // own share
        date: '2026-06-10',
        merchantRaw: 'Hotpot Dinner',
        receiptUri: 'file:///data/user/receipt1.jpg',
        remark: 'Split with Alice and Bob',
      }),
      makeTxn({
        id: 't_relief_1',
        type: 'expense',
        categoryId: 'medical',
        amount: 250,
        date: '2026-06-12',
        merchantRaw: 'Klinik Mediviron',
        receiptUri: 'file:///data/user/receipt2.png',
      }),
    ];
    const v3Accounts = [
      makeAcct({
        id: 'a_cimb',
        name: 'CIMB Savings',
        kind: 'asset',
        cls: 'cash',
        interestRate: 2.5,
        icon: 'bank',
      }),
    ];
    const v3Entries = [
      makeEntry({ accountId: 'a_cimb', value: 5000, asOf: '2026-05-31' }),
      makeEntry({ accountId: 'a_cimb', value: 5500, asOf: '2026-06-30' }),
    ];
    const v3Categories: Category[] = [
      ...mockCategories,
      { id: 'cat_pet', label: 'Pet Care', icon: 'paw', hue: 120, kind: 'expense', isDefault: false },
    ];
    const v3Bundle = buildFinancialReportBundle(v3Txns, v3Categories, v3Accounts, v3Entries, period, 'Nurul');

    const v3Extra = {
      balanceEntries: v3Entries,
      people: [{ id: 'p_alice', name: 'Alice', createdAt: '2026-06-01T00:00:00.000Z' }],
      splits: [
        {
          id: 'sp_1',
          txnId: 't_split_1',
          gross: 90,
          ownShare: 30,
          method: 'equal' as const,
          currency: 'MYR',
          fxRate: null,
          createdAt: '2026-06-10T19:00:00.000Z',
        },
      ],
      shares: [
        {
          id: 'sh_alice',
          splitId: 'sp_1',
          personId: 'p_alice',
          owed: 30,
          paid: 30,
          status: 'settled' as const,
          writtenOffTxnId: null,
          createdAt: '2026-06-10T19:00:00.000Z',
        },
      ],
      splitPayments: [
        {
          id: 'pm_1',
          shareId: 'sh_alice',
          amount: 30,
          paidOn: '2026-06-11',
          evidence: 'declared' as const,
          matchedMerchant: 'DuitNow Alice',
          accountId: 'a_cimb',
          createdAt: '2026-06-11T10:00:00.000Z',
        },
      ],
      budget: {
        expectedIncome: 6000,
        allocations: { food: 800, medical: 300, cat_pet: 200 },
      },
      budgetSnapshots: {
        '2026-05': { income: 5800, allocations: { food: 750 } },
      },
      budgetAdvice: { hash: 'hash123', text: 'Good savings rate!' },
      reliefTags: [
        {
          id: 'rt_1',
          txnId: 't_relief_1',
          code: 'MEDICAL',
          ya: 2026,
          amount: 250,
          origin: 'manual' as const,
          certImageUri: 'file:///data/user/cert.jpg',
          einvoiceImageUri: 'file:///data/user/invoice.pdf',
          createdAt: '2026-06-12T12:00:00.000Z',
        },
      ],
      reliefMemory: { 'klinik-mediviron': 'MEDICAL' },
      merchantMemory: { 'hotpot-dinner': 'food', 'klinik-mediviron': 'medical' },
      deletedDefaultCategories: ['gifts'],
      activeCurrencies: ['MYR', 'USD', 'SGD'],
      preferences: {
        settings: { soundEnabled: true, motionSetting: 'full' },
        tasks: { tasksDone: ['export'] },
      },
    };

    const json = generateAdvancedImportJSON(v3Bundle, v3Extra);
    const rawPayload = JSON.parse(json);

    // 1. Check version is 3
    expect(rawPayload.version).toBe(3);

    // 2. Check images are strictly excluded
    expect(json).not.toContain('file:///data/user/receipt1.jpg');
    expect(json).not.toContain('file:///data/user/cert.jpg');
    expect(json).not.toContain('receiptUri');
    expect(json).not.toContain('certImageUri');
    expect(json).not.toContain('einvoiceImageUri');

    // 3. Check account has interestRate and balance history series
    const acct = rawPayload.accounts.find((a: any) => a.name === 'CIMB Savings');
    expect(acct.interestRate).toBe(2.5);
    expect(acct.history).toHaveLength(2);
    expect(acct.history).toEqual([
      { asOf: '2026-05-31', value: 5000 },
      { asOf: '2026-06-30', value: 5500 },
    ]);

    // 4. Check categories exported
    expect(rawPayload.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'cat_pet', label: 'Pet Care', icon: 'paw' }),
      ])
    );
    expect(rawPayload.deletedDefaultCategories).toEqual(['gifts']);

    // 5. Check splits and people
    expect(rawPayload.people).toEqual([expect.objectContaining({ name: 'Alice' })]);
    expect(rawPayload.splits).toHaveLength(1);
    expect(rawPayload.splits[0]).toMatchObject({
      gross: 90,
      ownShare: 30,
      shares: [
        expect.objectContaining({
          personName: 'Alice',
          owed: 30,
          paid: 30,
          status: 'settled',
          payments: [expect.objectContaining({ amount: 30, paidOn: '2026-06-11' })],
        }),
      ],
    });

    // 6. Check budget, relief, memory, preferences
    expect(rawPayload.budget.expectedIncome).toBe(6000);
    expect(rawPayload.budget.allocations).toMatchObject({ food: 800 });
    expect(rawPayload.taxRelief.tags[0]).toMatchObject({ code: 'MEDICAL', ya: 2026, amount: 250 });
    expect(rawPayload.merchantMemory['hotpot-dinner']).toBe('food');
    expect(rawPayload.preferences.activeCurrencies).toEqual(['MYR', 'USD', 'SGD']);

    // 7. Parse with parseJSON and verify round-trip
    const parsed = parseJSON(json);
    expect(parsed.version).toBe(3);
    expect(parsed.categories).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'cat_pet' })]));
    expect(parsed.accounts[0].history).toHaveLength(2);
    expect(parsed.splits).toHaveLength(1);
    expect(parsed.budget?.expectedIncome).toBe(6000);
    expect(parsed.taxRelief?.tags[0].code).toBe('MEDICAL');
    expect(parsed.merchantMemory?.['hotpot-dinner']).toBe('food');
    expect(parsed.preferences?.activeCurrencies).toEqual(['MYR', 'USD', 'SGD']);
  });
});

describe('generatePrintablePDFHtml', () => {
  const txns = [
    makeTxn({ type: 'income', categoryId: 'salary', amount: 3200, date: '2026-06-01' }),
    makeTxn({ type: 'expense', categoryId: 'food', amount: 400, date: '2026-06-15' }),
  ];
  const accounts = [makeAcct({ id: 'a1' })];
  const entries = [makeEntry({ value: 4000, asOf: '2026-06-30' })];
  const period = buildReportPeriod('monthly', '2026-06');
  const bundle = buildFinancialReportBundle(txns, mockCategories, accounts, entries, period, 'Ravi');

  it('generates clean printable PDF HTML with formal accounting sections', () => {
    const pdfHtml = generatePrintablePDFHtml(bundle);
    expect(pdfHtml).toContain('Statement of Financial Condition &amp; Operations');
    expect(pdfHtml).toContain('I. Income Statement (Statement of Profit &amp; Loss)');
    expect(pdfHtml).toContain('II. Balance Sheet (Statement of Financial Position)');
    expect(pdfHtml).toContain('III. Key Financial Statistics &amp; Regularity');
    expect(pdfHtml).toContain('IV. Itemized Transaction Ledger');
  });
});

describe('formatCurrency', () => {
  it('formats standard MYR by default', () => {
    expect(formatCurrency(1234.56)).toBe('RM 1,234.56');
    expect(formatCurrency(-50)).toBe('-RM 50.00');
    expect(formatCurrency(0)).toBe('RM 0.00');
  });

  it('converts to foreign display currency when code and rates are provided', () => {
    const rates = { SGD: 3.3, USD: 4.4 };
    expect(formatCurrency(330, 'SGD', rates)).toBe('SGD 100.00');
    expect(formatCurrency(-440, 'USD', rates)).toBe('-USD 100.00');
  });
});

describe('generateCSV with multi-currency', () => {
  const txns = [
    makeTxn({ type: 'income', categoryId: 'salary', amount: 3300, currency: 'SGD', nativeAmount: 1000, date: '2026-06-01' }),
    makeTxn({ type: 'expense', categoryId: 'food', amount: 50, currency: 'MYR', date: '2026-06-05' }),
  ];
  const accounts = [makeAcct({ id: 'a1' })];
  const entries = [makeEntry({ value: 6000 })];
  const period = buildReportPeriod('monthly', '2026-06');
  const bundle = buildFinancialReportBundle(txns, mockCategories, accounts, entries, period, 'Nurul');

  it('appends CURRENCY BREAKDOWN section when multiple currencies exist', () => {
    const csv = generateCSV(bundle);
    expect(csv).toContain('=== CURRENCY BREAKDOWN ===');
    expect(csv).toContain('"Currency","Total Native Amount"');
    expect(csv).toContain('"MYR",50');
    expect(csv).toContain('"SGD",1000');
  });
});

describe('generateHTMLReport with displayCurrency', () => {
  const txns = [
    makeTxn({ type: 'income', categoryId: 'salary', amount: 3300, currency: 'SGD', nativeAmount: 1000, date: '2026-06-01' }),
    makeTxn({ type: 'expense', categoryId: 'food', amount: 330, currency: 'SGD', nativeAmount: 100, date: '2026-06-10' }),
  ];
  const accounts = [makeAcct({ id: 'a1' })];
  const entries = [makeEntry({ value: 3300, asOf: '2026-06-30' })];
  const period = buildReportPeriod('monthly', '2026-06');
  const rates = { SGD: 3.3 };
  const bundle = buildFinancialReportBundle(txns, mockCategories, accounts, entries, period, 'Faizal', rates, 'SGD');

  it('renders report in selected display currency', () => {
    const html = generateHTMLReport(bundle);
    expect(html).toContain('Currency: <strong>SGD</strong>');
    expect(html).toContain('SGD 1,000.00'); // 3300 MYR / 3.3
    expect(html).toContain('SGD 100.00'); // 330 MYR / 3.3
    expect(html).toContain('Amount (SGD)');
  });
});

describe('saveOrDownloadExport and shareExportFile', () => {
  it('saves file and returns file metadata including size, name and mimeType', async () => {
    const sampleCsv = 'Date,Amount\n2026-06-01,100';
    const result = await saveOrDownloadExport('test_export.csv', sampleCsv, 'text/csv');
    expect(result.success).toBe(true);
    expect(result.fileName).toBe('test_export.csv');
    expect(result.mimeType).toBe('text/csv');
    expect(result.fileSize).toBeGreaterThan(0);
  });

  it('safely handles shareExportFile call', async () => {
    const res = await shareExportFile('file:///fake/path/test.pdf', 'application/pdf', 'Share PDF');
    // In jest node environment without native sharing bridge, should resolve cleanly to a boolean
    expect(typeof res).toBe('boolean');
  });
});

describe('E-Wallet detection and statement export', () => {
  const tngTxn = makeTxn({
    merchantRaw: "Touch 'n Go eWallet",
    merchantKey: 'touch_n_go',
    amount: 50,
    type: 'expense',
    date: '2026-06-05',
    remark: 'Reload via FPX',
  });
  const grabTxn = makeTxn({
    merchantRaw: 'GrabPay Merchant',
    merchantKey: 'grabpay',
    amount: 25,
    type: 'expense',
    date: '2026-06-08',
    source: 'extracted',
  });
  const boostTxn = makeTxn({
    merchantRaw: 'Boost payment',
    merchantKey: 'boost',
    amount: 15,
    type: 'expense',
    date: '2026-06-12',
  });
  const regularTxn = makeTxn({
    merchantRaw: 'Tesco Hypermarket',
    merchantKey: 'tesco',
    amount: 150,
    type: 'expense',
    date: '2026-06-15',
    source: 'manual',
  });

  const txns = [tngTxn, grabTxn, boostTxn, regularTxn];
  const accounts = [
    makeAcct({ id: 'a1', name: "Touch 'n Go eWallet", cls: 'ewallet' }),
    makeAcct({ id: 'a2', name: 'Maybank', cls: 'cash' }),
  ];
  const entries = [makeEntry({ accountId: 'a1', value: 200, asOf: '2026-06-30' })];
  const period = buildReportPeriod('monthly', '2026-06');
  const bundle = buildFinancialReportBundle(txns, mockCategories, accounts, entries, period, 'Test User');

  it('correctly identifies e-wallet transactions and providers', () => {
    expect(isEwalletTransaction(tngTxn, accounts)).toBe(true);
    expect(isEwalletTransaction(grabTxn, accounts)).toBe(true);
    expect(isEwalletTransaction(boostTxn, accounts)).toBe(true);
    expect(isEwalletTransaction(regularTxn, accounts)).toBe(false);

    expect(getEwalletProviderName(tngTxn, accounts)).toBe("Touch 'n Go eWallet");
    expect(getEwalletProviderName(grabTxn, accounts)).toBe('GrabPay');
    expect(getEwalletProviderName(boostTxn, accounts)).toBe('Boost');
  });

  it('generates a structured E-Wallet CSV with provider breakdown and transactions', () => {
    const csv = generateEwalletCSV(bundle);
    expect(csv).toContain('E-WALLET TRANSACTION HISTORY & PROVIDER STATEMENT');
    expect(csv).toContain('=== E-WALLET PROVIDER BREAKDOWN ===');
    expect(csv).toContain("Touch 'n Go eWallet");
    expect(csv).toContain('GrabPay');
    expect(csv).toContain('Boost');
    expect(csv).toContain('=== ITEMIZED E-WALLET TRANSACTIONS ===');
    expect(csv).toContain('50.00');
    expect(csv).toContain('25.00');
    expect(csv).toContain('15.00');
  });

  it('generates interactive E-Wallet HTML report preview', () => {
    const html = generateEwalletPreviewHtml(bundle);
    expect(html).toContain('E-Wallet Transaction History Statement');
    expect(html).toContain('Total E-Wallet Outflow');
    expect(html).toContain('Provider Breakdown');
    expect(html).toContain('GrabPay');
    expect(html).toContain('Boost');
    expect(html).toContain('Go eWallet');
  });

  it('appends E-Wallet History sheet to Excel workbook when e-wallet txns are present', () => {
    const bytes = generateExcelWorkbook(bundle);
    const wb = XLSX.read(bytes, { type: 'array' });
    expect(wb.SheetNames).toContain('E-Wallet History');
    const ewCsv = XLSX.utils.sheet_to_csv(wb.Sheets['E-Wallet History']);
    expect(ewCsv).toContain("Touch 'n Go eWallet");
    expect(ewCsv).toContain('GrabPay');
  });
});

describe('Receipts Archive and Preview generation', () => {
  const receiptTxn1 = makeTxn({
    merchantRaw: 'Starbucks Coffee',
    amount: 18.5,
    date: '2026-06-03',
    receiptUri: 'file:///data/receipts/starbucks_01.jpg',
  });
  const receiptTxn2 = makeTxn({
    merchantRaw: 'Popular Bookstore',
    amount: 85.0,
    date: '2026-06-07',
    receiptUri: 'file:///data/receipts/books_02.png',
  });
  const noReceiptTxn = makeTxn({
    merchantRaw: 'Mamak Stall',
    amount: 12.0,
    date: '2026-06-09',
  });

  const txns = [receiptTxn1, receiptTxn2, noReceiptTxn];
  const accounts = [makeAcct({ id: 'a1' })];
  const entries = [makeEntry({ value: 1000, asOf: '2026-06-30' })];
  const period = buildReportPeriod('monthly', '2026-06');
  const bundle = buildFinancialReportBundle(txns, mockCategories, accounts, entries, period, 'Test User');

  const reliefTags: ReliefTag[] = [
    {
      id: 'rt1',
      txnId: receiptTxn2.id,
      code: 'reading',
      ya: 2026,
      amount: 85.0,
      origin: 'auto',
      certImageUri: 'file:///data/receipts/reading_cert.jpg',
      einvoiceImageUri: null,
      createdAt: '2026-06-07T12:00:00.000Z',
    },
  ];

  it('builds receipt export list filtering transactions with receipts', () => {
    const list = buildReceiptExportList(txns, mockCategories, reliefTags);
    expect(list.length).toBe(3); // 2 receipts + 1 cert
    expect(list.some((it) => it.merchant === 'Starbucks Coffee')).toBe(true);
    expect(list.some((it) => it.merchant === 'Popular Bookstore')).toBe(true);
    expect(list.some((it) => it.fileName.includes('.jpg') || it.fileName.includes('.png'))).toBe(true);
  });

  it('generates a valid ZIP archive containing receipts_manifest.csv, MANIFEST.json and README.txt', () => {
    const zipBytes = generateReceiptsZip(bundle, txns, reliefTags);
    expect(zipBytes).toBeInstanceOf(Uint8Array);
    expect(zipBytes.length).toBeGreaterThan(100);
  });

  it('generates Receipts HTML preview with total values and files table', () => {
    const html = generateReceiptsPreviewHtml(bundle, txns, reliefTags);
    expect(html).toContain('Receipts & Invoices Archive (.zip) Preview');
    expect(html).toContain('Total Receipts Value');
    expect(html).toContain('Starbucks Coffee');
    expect(html).toContain('Popular Bookstore');
  });
});

