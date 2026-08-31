import * as XLSX from 'xlsx';
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { strToU8, zipSync } from 'fflate';
import { toDisplay } from './fx';
import { currencyPrefix } from './format';
import { formatCurrencyBreakdown } from './format';
import { nativeTransactionTotalsByCurrency, type FinancialReportData, type MonthlyTrendItem } from './bookkeeping';
import { matchInstitution } from './institutions';
import { readImageBytes } from './taxExport';
import type { Commitment, CommitmentOccurrence } from './commitments';
import type { Account, Category, ReliefTag, Transaction } from './types';

export type ExportFormat = 'xlsx' | 'csv' | 'html' | 'pdf' | 'json' | 'receipts' | 'ewallet';

/** Format a number into standard currency string (e.g. RM 1,234.56 or SGD 1,234.56). */
export function formatCurrency(amount: number, code: string = 'MYR', rates?: Record<string, number>): string {
  const converted = code === 'MYR' || !rates ? amount : (toDisplay(amount, code, rates) ?? amount);
  const isNegative = converted < 0;
  const abs = Math.abs(converted).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const prefix = currencyPrefix(code);
  return isNegative ? `-${prefix} ${abs}` : `${prefix} ${abs}`;
}

/** Format percentage (e.g. 24.5%). */
export function formatPercent(val: number): string {
  return `${val.toFixed(1)}%`;
}

/** Clean string for CSV escaping. */
function csvEscape(val: string | number | null | undefined): string {
  if (val == null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// ---------------------------------------------------------------------------
// 1. EXCEL (.XLSX) MULTI-TAB WORKBOOK GENERATION
// ---------------------------------------------------------------------------

export function generateExcelWorkbook(data: FinancialReportData): Uint8Array {
  const wb = XLSX.utils.book_new();

  // --- SHEET 1: Income Statement ---
  const isRows: (string | number)[][] = [
    ['FINANCIAL REPORT: INCOME STATEMENT (PROFIT & LOSS)'],
    ['Name:', data.userName],
    ['Period:', data.period.label],
    ['Generated At:', data.generatedAt.slice(0, 19).replace('T', ' ')],
    ['Currency:', 'MYR (Malaysian Ringgit)'],
    [],
    ['=== REVENUES / INCOME ===', 'Amount (MYR)', '% of Total Income'],
  ];

  for (const row of data.incomeStatement.incomeRows) {
    isRows.push([row.categoryLabel, row.amount, `${row.percentage}%`]);
  }
  isRows.push(['TOTAL REVENUE / INCOME', data.incomeStatement.totalIncome, '100.0%']);
  isRows.push([]);
  isRows.push(['=== OPERATING & LIVING EXPENSES ===', 'Amount (MYR)', '% of Total Expense']);

  for (const row of data.incomeStatement.expenseRows) {
    isRows.push([row.categoryLabel, row.amount, `${row.percentage}%`]);
  }
  isRows.push(['TOTAL EXPENSES', data.incomeStatement.totalExpense, '100.0%']);
  isRows.push([]);
  isRows.push(['=== NET FINANCIAL SUMMARY ===', 'Value']);
  isRows.push(['NET INCOME / SAVINGS (Revenue - Expenses)', data.incomeStatement.netIncome]);
  isRows.push(['SAVINGS RATE (%)', `${data.incomeStatement.savingsRate}%`]);
  isRows.push(['RECORDED TRANSACTIONS COUNT', data.incomeStatement.transactionCount]);

  const wsIS = XLSX.utils.aoa_to_sheet(isRows);
  wsIS['!cols'] = [{ wch: 42 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsIS, 'Income Statement');

  // --- SHEET 2: Balance Sheet ---
  const bsRows: (string | number)[][] = [
    ['FINANCIAL REPORT: BALANCE SHEET'],
    ['Name:', data.userName],
    ['As of Date:', data.balanceSheet.asOfDate],
    ['Generated At:', data.generatedAt.slice(0, 19).replace('T', ' ')],
    ['Currency:', 'MYR (Malaysian Ringgit)'],
    [],
    ['=== ASSETS ===', 'Class', 'Value (MYR)'],
  ];

  for (const g of data.balanceSheet.assetGroups) {
    for (const item of g.items) {
      const detail = item.symbol ? ` (${item.quantity ?? ''} ${item.symbol})` : '';
      bsRows.push([`  ${item.name}${detail}`, g.clsLabel, item.value]);
    }
    bsRows.push([`SUBTOTAL ${g.clsLabel.toUpperCase()}`, '', g.total]);
  }
  bsRows.push(['TOTAL ASSETS', '', data.balanceSheet.totalAssets]);
  bsRows.push([]);
  bsRows.push(['=== LIABILITIES ===', 'Class', 'Value (MYR)']);

  for (const g of data.balanceSheet.liabilityGroups) {
    for (const item of g.items) {
      bsRows.push([`  ${item.name}`, g.clsLabel, item.value]);
    }
    bsRows.push([`SUBTOTAL ${g.clsLabel.toUpperCase()}`, '', g.total]);
  }
  bsRows.push(['TOTAL LIABILITIES', '', data.balanceSheet.totalLiabilities]);
  bsRows.push([]);
  bsRows.push(['=== OWNER EQUITY / NET POSITION ===', '', 'Value (MYR)']);
  bsRows.push(['TOTAL NET WORTH (Assets - Liabilities)', '', data.balanceSheet.netWorth]);
  bsRows.push(['RETAINED FINANCIAL VALUE', '', data.balanceSheet.retainedEarnings]);
  bsRows.push(['BALANCE CHECK', '', data.balanceSheet.balanced ? 'BALANCED (Assets = Liabilities + Equity)' : 'UNBALANCED']);

  const wsBS = XLSX.utils.aoa_to_sheet(bsRows);
  wsBS['!cols'] = [{ wch: 42 }, { wch: 22 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsBS, 'Balance Sheet');

  // --- SHEET 3: Transaction Ledger ---
  const catMap = new Map<string, string>();
  for (const c of data.categories) catMap.set(c.id, c.label);

  const ledgerRows: (string | number)[][] = [
    ['Date', 'Type', 'Category', 'Merchant / Payee', 'Amount (MYR)', 'Direction', 'Source', 'Remark'],
  ];

  for (const t of data.transactions) {
    const catName = (t.categoryId ? catMap.get(t.categoryId) : null) || (t.type === 'income' ? 'Income' : 'Expense');
    ledgerRows.push([
      t.date || 'N/A',
      t.type.toUpperCase(),
      catName,
      t.merchantRaw || t.merchantKey || 'N/A',
      Math.abs(t.amount),
      t.type === 'income' ? 'IN (+)' : 'OUT (-)',
      t.source,
      t.remark || '',
    ]);
  }

  const wsLedger = XLSX.utils.aoa_to_sheet(ledgerRows);
  wsLedger['!cols'] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 24 },
    { wch: 32 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 35 },
  ];
  XLSX.utils.book_append_sheet(wb, wsLedger, 'Transaction Ledger');

  // --- SHEET 4: Monthly Trends & Statistics ---
  const statsRows: (string | number)[][] = [
    ['FINANCIAL STATISTICAL ANALYSIS & MONTHLY TRENDS'],
    ['Period:', data.period.label],
    [],
    ['=== STATISTICAL METRICS ===', 'Metric Value'],
    ['Mean (Average) Monthly Income', data.statistics.meanMonthlyIncome],
    ['Median Monthly Income', data.statistics.medianMonthlyIncome],
    ['Standard Deviation (Income Volatility)', data.statistics.stdDevMonthlyIncome],
    ['Income Coefficient of Variation (CV)', data.statistics.cvMonthlyIncome],
    ['Mean (Average) Monthly Expenses', data.statistics.meanMonthlyExpense],
    ['Median Monthly Expenses', data.statistics.medianMonthlyExpense],
    ['Standard Deviation (Expense)', data.statistics.stdDevMonthlyExpense],
    ['Minimum Monthly Income', data.statistics.minMonthlyIncome],
    ['Maximum Monthly Income', data.statistics.maxMonthlyIncome],
    ['Total Income Across Period', data.statistics.totalIncome],
    ['Total Expenses Across Period', data.statistics.totalExpense],
    ['Net Period Savings', data.statistics.netSavings],
    ['Overall Period Savings Rate (%)', `${data.statistics.overallSavingsRate}%`],
    [],
    ['=== MONTHLY TIME-SERIES BREAKDOWN ==='],
    ['Month', 'Income (MYR)', 'Expenses (MYR)', 'Net Savings (MYR)', 'Savings Rate (%)', 'Month-End Net Worth (MYR)'],
  ];

  for (const m of data.statistics.monthlyTrends) {
    statsRows.push([
      m.monthKey,
      m.income,
      m.expense,
      m.netSavings,
      `${m.savingsRate}%`,
      m.netWorth,
    ]);
  }

  const wsStats = XLSX.utils.aoa_to_sheet(statsRows);
  wsStats['!cols'] = [
    { wch: 35 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, wsStats, 'Trends & Statistics');

  // --- OPTIONAL SHEET 5: E-Wallet History ---
  const ewalletTxns = data.transactions.filter((t) => isEwalletTransaction(t, data.accounts));
  if (ewalletTxns.length > 0) {
    const ewRows: (string | number)[][] = [
      ['Date', 'E-Wallet Provider', 'Type', 'Category', 'Merchant / Payee', 'Amount (MYR)', 'Direction', 'Source', 'Remark'],
    ];
    for (const t of ewalletTxns) {
      const provider = getEwalletProviderName(t, data.accounts);
      const catName = (t.categoryId ? catMap.get(t.categoryId) : null) || (t.type === 'income' ? 'Income' : 'Expense');
      ewRows.push([
        t.date || 'N/A',
        provider,
        t.type.toUpperCase(),
        catName,
        t.merchantRaw || t.merchantKey || 'N/A',
        Math.abs(t.amount),
        t.type === 'income' ? 'IN (+)' : 'OUT (-)',
        t.source,
        t.remark || '',
      ]);
    }
    const wsEW = XLSX.utils.aoa_to_sheet(ewRows);
    wsEW['!cols'] = [
      { wch: 14 },
      { wch: 22 },
      { wch: 12 },
      { wch: 24 },
      { wch: 32 },
      { wch: 16 },
      { wch: 14 },
      { wch: 12 },
      { wch: 35 },
    ];
    XLSX.utils.book_append_sheet(wb, wsEW, 'E-Wallet History');
  }

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out);
}

// ---------------------------------------------------------------------------
// 2. CSV EXPORT GENERATION
// ---------------------------------------------------------------------------

export function generateCSV(data: FinancialReportData): string {
  const lines: string[] = [];
  const catMap = new Map<string, string>();
  for (const c of data.categories) catMap.set(c.id, c.label);

  // Metadata
  lines.push(`${csvEscape('FINANCIAL REPORT & BOOKKEEPING EXPORT')}`);
  lines.push(`${csvEscape('Name')},${csvEscape(data.userName)}`);
  lines.push(`${csvEscape('Period')},${csvEscape(data.period.label)}`);
  lines.push(`${csvEscape('Generated At')},${csvEscape(data.generatedAt)}`);
  lines.push(`${csvEscape('Currency')},${csvEscape('MYR')}`);
  lines.push('');

  // Summary Section
  lines.push(`${csvEscape('=== FINANCIAL SUMMARY ===')}`);
  lines.push(`${csvEscape('Total Revenue')},${data.incomeStatement.totalIncome}`);
  lines.push(`${csvEscape('Total Expenses')},${data.incomeStatement.totalExpense}`);
  lines.push(`${csvEscape('Net Income / Savings')},${data.incomeStatement.netIncome}`);
  lines.push(`${csvEscape('Savings Rate')},${csvEscape(`${data.incomeStatement.savingsRate}%`)}`);
  lines.push(`${csvEscape('Total Assets')},${data.balanceSheet.totalAssets}`);
  lines.push(`${csvEscape('Total Liabilities')},${data.balanceSheet.totalLiabilities}`);
  lines.push(`${csvEscape('Net Worth')},${data.balanceSheet.netWorth}`);
  lines.push('');

  // Statistics Section
  lines.push(`${csvEscape('=== STATISTICAL INDICATORS ===')}`);
  lines.push(`${csvEscape('Mean Monthly Income')},${data.statistics.meanMonthlyIncome}`);
  lines.push(`${csvEscape('Median Monthly Income')},${data.statistics.medianMonthlyIncome}`);
  lines.push(`${csvEscape('Income Standard Deviation')},${data.statistics.stdDevMonthlyIncome}`);
  lines.push(`${csvEscape('Mean Monthly Expenses')},${data.statistics.meanMonthlyExpense}`);
  lines.push(`${csvEscape('Median Monthly Expenses')},${data.statistics.medianMonthlyExpense}`);
  lines.push(`${csvEscape('Expense Standard Deviation')},${data.statistics.stdDevMonthlyExpense}`);
  lines.push('');

  // Income Statement
  lines.push(`${csvEscape('=== INCOME STATEMENT ===')}`);
  lines.push(`${csvEscape('Category')},${csvEscape('Type')},${csvEscape('Amount (MYR)')},${csvEscape('Share (%)')}`);
  for (const r of data.incomeStatement.incomeRows) {
    lines.push(`${csvEscape(r.categoryLabel)},${csvEscape('Revenue')},${r.amount},${csvEscape(`${r.percentage}%`)}`);
  }
  for (const r of data.incomeStatement.expenseRows) {
    lines.push(`${csvEscape(r.categoryLabel)},${csvEscape('Expense')},${r.amount},${csvEscape(`${r.percentage}%`)}`);
  }
  lines.push('');

  // Balance Sheet
  lines.push(`${csvEscape('=== BALANCE SHEET AS OF ' + data.balanceSheet.asOfDate + ' ===')}`);
  lines.push(`${csvEscape('Account')},${csvEscape('Class')},${csvEscape('Kind')},${csvEscape('Value (MYR)')}`);
  for (const g of data.balanceSheet.assetGroups) {
    for (const i of g.items) {
      lines.push(`${csvEscape(i.name)},${csvEscape(g.clsLabel)},${csvEscape('Asset')},${i.value}`);
    }
  }
  for (const g of data.balanceSheet.liabilityGroups) {
    for (const i of g.items) {
      lines.push(`${csvEscape(i.name)},${csvEscape(g.clsLabel)},${csvEscape('Liability')},${i.value}`);
    }
  }
  lines.push('');

  // Ledger Table
  lines.push(`${csvEscape('=== TRANSACTION LEDGER ===')}`);
  lines.push(`${csvEscape('Date')},${csvEscape('Type')},${csvEscape('Category')},${csvEscape('Merchant')},${csvEscape('Amount')},${csvEscape('Direction')},${csvEscape('Source')},${csvEscape('Remark')}`);

  for (const t of data.transactions) {
    const cat = (t.categoryId ? catMap.get(t.categoryId) : null) || t.type;
    lines.push([
      csvEscape(t.date || ''),
      csvEscape(t.type),
      csvEscape(cat),
      csvEscape(t.merchantRaw || t.merchantKey),
      Math.abs(t.amount),
      csvEscape(t.type === 'income' ? 'IN' : 'OUT'),
      csvEscape(t.source),
      csvEscape(t.remark || ''),
    ].join(','));
  }

  // Currency Breakdown Section
  const nativeTotals = nativeTransactionTotalsByCurrency(data.transactions);
  if (Object.keys(nativeTotals).length > 1) {
    lines.push('');
    lines.push(`${csvEscape('=== CURRENCY BREAKDOWN ===')}`);
    lines.push(`${csvEscape('Currency')},${csvEscape('Total Native Amount')}`);
    for (const [code, amt] of Object.entries(nativeTotals)) {
      lines.push(`${csvEscape(code)},${amt}`);
    }
  }

  return lines.join('\n');
}

/** Parse a single CSV line into cells, honoring double-quoted fields. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

/**
 * Render a generated CSV report as a self-contained, themed HTML table
 * (instead of raw comma-separated text) so it can be shown in a WebView
 * preview on native platforms that lack a spreadsheet viewer.
 */
export function csvToHtmlTable(csvText: string): string {
  const rows = csvText.split('\n').map(parseCsvLine);
  const rowsHtml = rows
    .map((cells) => {
      const isBlank = cells.length === 1 && cells[0].trim() === '';
      if (isBlank) return '<tr class="spacer"><td>&nbsp;</td></tr>';

      const isSection = cells.length === 1 && cells[0].trim().length > 0;
      if (isSection) {
        const label = cells[0].replace(/^=+\s*|\s*=+$/g, '');
        return `<tr class="section"><td colspan="8">${escapeHtml(label)}</td></tr>`;
      }

      const tds = cells.map((c) => `<td>${escapeHtml(c)}</td>`).join('');
      return `<tr>${tds}</tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      --bg: #0d1310; --card-bg: #141c17; --card-border: rgba(255,255,255,0.08);
      --ink: #f0f4f1; --ink-dim: #8fa094; --accent: #22c55e; --accent-tint: rgba(34,197,94,0.12);
      --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f5f7f5; --card-bg: #ffffff; --card-border: rgba(0,0,0,0.08);
        --ink: #141c17; --ink-dim: #5c6c60; --accent: #15803d; --accent-tint: rgba(21,128,61,0.08);
      }
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: var(--font); background: var(--bg); color: var(--ink); padding: 12px 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    td { padding: 6px 8px; border-bottom: 1px solid var(--card-border); white-space: nowrap; }
    tr:last-child td { border-bottom: none; }
    tr.section td { font-weight: 700; color: var(--accent); background: var(--accent-tint); padding-top: 10px; padding-bottom: 10px; white-space: normal; }
    tr.spacer td { padding: 2px; border-bottom: none; }
    tr:not(.section):not(.spacer):hover td { background: var(--card-bg); }
  </style>
</head>
<body>
  <table>
    ${rowsHtml}
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 2b. ADVANCED IMPORT JSON EXPORT (Version 3)
// Full user data export (excluding raw image binaries/URIs) compatible with
// Advanced Import parseJSON().
// ---------------------------------------------------------------------------

export interface CommitmentExportExtra {
  commitments?: Commitment[];
  occurrences?: CommitmentOccurrence[];
  balanceEntries?: import('./types').BalanceEntry[];
  people?: import('./types').Person[];
  splits?: import('./types').Split[];
  shares?: import('./types').SplitShare[];
  splitPayments?: import('./types').SplitPayment[];
  budget?: {
    expectedIncome: number;
    allocations: Record<string, number>;
  };
  budgetSnapshots?: Record<string, { income: number; allocations: Record<string, number> }>;
  budgetAdvice?: { hash: string; text: string } | null;
  reliefTags?: import('./types').ReliefTag[];
  reliefMemory?: Record<string, string>;
  merchantMemory?: import('./types').MemoryMap;
  deletedDefaultCategories?: string[];
  activeCurrencies?: string[];
  preferences?: Record<string, unknown>;
  allTransactions?: import('./types').Transaction[];
}

export type FullExportExtra = CommitmentExportExtra;

export function generateAdvancedImportJSON(data: FinancialReportData, extra?: CommitmentExportExtra): string {
  const catMap = new Map<string, string>();
  for (const c of data.categories) catMap.set(c.id, c.label);
  const accountMetaById = new Map(data.accounts.map((a) => [a.id, a]));
  const accountNameById = new Map(data.accounts.map((a) => [a.id, a.name]));

  const txnsToUse = extra?.allTransactions ?? data.transactions;

  const transactions = txnsToUse
    .filter((t) => t.type !== 'transfer')
    .map((t) => ({
      id: t.id,
      date: t.date || null,
      description: t.merchantRaw || t.merchantKey || null,
      amount: Math.round((t.type === 'income' ? Math.abs(t.amount) : -Math.abs(t.amount)) * 100) / 100,
      currency: t.currency ?? 'MYR',
      category: (t.categoryId ? catMap.get(t.categoryId) : null) || '?',
      account: null as string | null,
      remark: t.remark ?? null,
      source: t.source ?? 'manual',
      nativeAmount: t.nativeAmount ?? null,
      fxRate: t.fxRate ?? null,
      createdAt: t.createdAt,
    }));

  const transfers = txnsToUse
    .filter((t) => t.type === 'transfer')
    .map((t) => ({
      id: t.id,
      date: t.date || null,
      description: t.merchantRaw || t.merchantKey || null,
      amount: Math.round(Math.abs(t.amount) * 100) / 100,
      currency: t.currency ?? 'MYR',
      account: null as string | null,
      createdAt: t.createdAt,
    }));

  const entriesByAccountId = new Map<string, { asOf: string; value: number }[]>();
  for (const entry of extra?.balanceEntries ?? []) {
    const list = entriesByAccountId.get(entry.accountId) ?? [];
    list.push({ asOf: entry.asOf, value: entry.value });
    entriesByAccountId.set(entry.accountId, list);
  }
  for (const list of entriesByAccountId.values()) {
    list.sort((a, b) => a.asOf.localeCompare(b.asOf));
  }

  // "Owed to me" is a managed receivable balance kept by the split-bill engine,
  // not a real account — re-importing it would create a bogus Cash account.
  const accounts = [...data.balanceSheet.assetGroups, ...data.balanceSheet.liabilityGroups]
    .filter((g) => g.cls !== 'receivable')
    .flatMap((g) => g.items.map((item) => {
      const meta = accountMetaById.get(item.accountId);
      const history = entriesByAccountId.get(item.accountId) ?? [
        { asOf: data.balanceSheet.asOfDate, value: Math.abs(item.nativeValue) },
      ];
      // `balance` and `currency` must agree. `item.value` is MYR-converted, so pairing it
      // with the account's own currency code would re-import a foreign account inflated by
      // its exchange rate; `nativeValue` is the figure that currency actually denominates.
      return {
        name: item.name,
        type: g.clsLabel,
        cls: meta?.cls ?? undefined,
        kind: meta?.kind ?? (g.cls === 'credit_cards' || g.cls === 'loans' ? 'liability' : 'asset'),
        balance: Math.abs(item.nativeValue),
        currency: item.currency,
        as_of: data.balanceSheet.asOfDate,
        notes: item.ticker || item.symbol || null,
        quantity: meta?.quantity ?? null,
        cost: meta?.cost ?? null,
        interestRate: meta?.interestRate ?? null,
        sub: meta?.sub ?? null,
        symbol: meta?.symbol ?? null,
        ticker: meta?.ticker ?? null,
        icon: meta?.icon ?? null,
        archived: meta?.archived ?? false,
        history,
      };
    }));

  const categories = data.categories.map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    hue: c.hue,
    kind: c.kind,
    isDefault: c.isDefault,
  }));

  const commitments = (extra?.commitments ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    kind: c.kind,
    amount: c.amount,
    currency: c.currency ?? 'MYR',
    dueDay: c.dueDay,
    category: c.categoryId ? catMap.get(c.categoryId) ?? null : null,
    fromAccount: c.fromAccountId ? accountNameById.get(c.fromAccountId) ?? null : null,
    toAccount: c.toAccountId ? accountNameById.get(c.toAccountId) ?? null : null,
    startMonth: c.startMonth,
    endMonth: c.endMonth,
    reliefCode: c.reliefCode ?? null,
    archived: c.archived ?? false,
    occurrences: (extra?.occurrences ?? [])
      .filter((o) => o.commitmentId === c.id)
      .map((o) => ({
        dueDate: o.dueDate,
        month: o.month,
        amount: o.amount,
        status: o.status,
        paidOn: o.paidOn,
        paidAmount: o.paidAmount,
        unitsAdded: o.unitsAdded ?? null,
        priceMYR: o.priceMYR ?? null,
        fxRate: o.fxRate ?? null,
      })),
  }));

  const personById = new Map((extra?.people ?? []).map((p) => [p.id, p]));
  const sharesBySplitId = new Map<string, import('./types').SplitShare[]>();
  for (const s of extra?.shares ?? []) {
    const list = sharesBySplitId.get(s.splitId) ?? [];
    list.push(s);
    sharesBySplitId.set(s.splitId, list);
  }
  const paymentsByShareId = new Map<string, import('./types').SplitPayment[]>();
  for (const p of extra?.splitPayments ?? []) {
    const list = paymentsByShareId.get(p.shareId) ?? [];
    list.push(p);
    paymentsByShareId.set(p.shareId, list);
  }

  const people = (extra?.people ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
  }));

  const splits = (extra?.splits ?? []).map((s) => ({
    id: s.id,
    txnId: s.txnId,
    gross: s.gross,
    ownShare: s.ownShare,
    method: s.method,
    currency: s.currency ?? 'MYR',
    fxRate: s.fxRate ?? null,
    createdAt: s.createdAt,
    shares: (sharesBySplitId.get(s.id) ?? []).map((sh) => ({
      id: sh.id,
      personId: sh.personId,
      personName: personById.get(sh.personId)?.name ?? null,
      owed: sh.owed,
      paid: sh.paid,
      status: sh.status,
      writtenOffTxnId: sh.writtenOffTxnId,
      createdAt: sh.createdAt,
      payments: (paymentsByShareId.get(sh.id) ?? []).map((pm) => ({
        id: pm.id,
        amount: pm.amount,
        paidOn: pm.paidOn,
        evidence: pm.evidence,
        matchedMerchant: pm.matchedMerchant,
        accountId: pm.accountId,
        createdAt: pm.createdAt,
      })),
    })),
  }));

  const budget = extra?.budget
    ? {
        expectedIncome: extra.budget.expectedIncome,
        allocations: extra.budget.allocations,
        snapshots: extra.budgetSnapshots ?? {},
        advice: extra.budgetAdvice ?? null,
      }
    : undefined;

  const hasReliefTags = (extra?.reliefTags?.length ?? 0) > 0;
  const hasReliefMemory = Object.keys(extra?.reliefMemory ?? {}).length > 0;
  const taxRelief = hasReliefTags || hasReliefMemory
    ? {
        tags: (extra?.reliefTags ?? []).map((t) => ({
          id: t.id,
          txnId: t.txnId,
          code: t.code,
          ya: t.ya,
          amount: t.amount,
          origin: t.origin,
          createdAt: t.createdAt,
        })),
        memory: extra?.reliefMemory ?? {},
      }
    : undefined;

  const merchantMemory = extra?.merchantMemory && Object.keys(extra.merchantMemory).length > 0
    ? extra.merchantMemory
    : undefined;

  const preferences = extra?.preferences || extra?.activeCurrencies
    ? {
        activeCurrencies: extra.activeCurrencies,
        ...extra.preferences,
      }
    : undefined;

  const payload = {
    version: 3,
    statement: {
      issuer: data.userName,
      period: {
        start: data.period.startDate || (txnsToUse[txnsToUse.length - 1]?.date ?? data.balanceSheet.asOfDate),
        end: data.period.endDate || data.balanceSheet.asOfDate,
      },
      exportedAt: new Date().toISOString(),
    },
    categories,
    deletedDefaultCategories: extra?.deletedDefaultCategories && extra.deletedDefaultCategories.length > 0 ? extra.deletedDefaultCategories : undefined,
    accounts,
    transactions,
    transfers,
    commitments,
    people: people.length > 0 ? people : undefined,
    splits: splits.length > 0 ? splits : undefined,
    budget,
    taxRelief,
    merchantMemory,
    preferences,
  };

  return JSON.stringify(payload, null, 2);
}

// ---------------------------------------------------------------------------
// 3. STANDALONE INTERACTIVE HTML REPORT GENERATION WITH SVG CHARTS
// ---------------------------------------------------------------------------

export function generateHTMLReport(data: FinancialReportData): string {
  const displayCode = data.displayCurrency || 'MYR';
  const displayRates = data.displayRates || {};
  const fmtC = (amt: number) => formatCurrency(amt, displayCode, displayRates);
  const nativeTotals = nativeTransactionTotalsByCurrency(data.transactions);
  const multiCurrency = Object.keys(nativeTotals).length > 1;
  const breakdownStr = multiCurrency ? formatCurrencyBreakdown(nativeTotals) : '';

  const catMap = new Map<string, string>();
  for (const c of data.categories) catMap.set(c.id, c.label);

  // Generate SVG Bar Chart: Monthly Income vs Expenses
  const barChartSvg = renderMonthlyBarChartSvg(data.statistics.monthlyTrends, displayCode, displayRates);

  // Generate SVG Donut Chart: Expense Breakdown
  const donutChartSvg = renderExpenseDonutSvg(data.statistics.expenseCategoryBreakdown, displayCode, displayRates);

  // Generate SVG Area/Line Chart: Net Worth Trend
  const netWorthChartSvg = renderNetWorthTrendSvg(data.statistics.monthlyTrends, displayCode, displayRates);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Financial Report & Analytics - ${escapeHtml(data.userName)} - ${escapeHtml(data.period.label)}</title>
  <style>
    :root {
      --bg: #0d1310;
      --card-bg: #141c17;
      --card-border: rgba(255,255,255,0.08);
      --ink: #f0f4f1;
      --ink-dim: #8fa094;
      --ink-sub: #5c6c60;
      --accent: #22c55e;
      --accent-tint: rgba(34,197,94,0.12);
      --danger: #ef4444;
      --danger-tint: rgba(239,68,68,0.12);
      --warning: #f59e0b;
      --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f5f7f5;
        --card-bg: #ffffff;
        --card-border: rgba(0,0,0,0.08);
        --ink: #141c17;
        --ink-dim: #5c6c60;
        --ink-sub: #8fa094;
        --accent: #15803d;
        --accent-tint: rgba(21,128,61,0.08);
        --danger: #dc2626;
        --danger-tint: rgba(220,38,38,0.08);
        --warning: #d97706;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font);
      background-color: var(--bg);
      color: var(--ink);
      line-height: 1.5;
      padding: 24px 16px;
    }
    .container { max-width: 1040px; margin: 0 auto; }
    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 24px;
    }
    .title-group h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
    .title-group p { font-size: 14px; color: var(--ink-dim); margin-top: 4px; }
    .btn-group { display: flex; gap: 8px; }
    .btn {
      background-color: var(--accent);
      color: #fff;
      border: none;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
    }
    .btn.secondary {
      background-color: var(--card-bg);
      color: var(--ink);
      border: 1px solid var(--card-border);
    }
    .btn:hover { opacity: 0.9; }
    .grid { display: grid; gap: 16px; margin-bottom: 24px; }
    .grid-4 { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .grid-2 { grid-template-columns: repeat(auto-fit, minmax(460px, 1fr)); }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 18px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .card h2 { font-size: 16px; font-weight: 600; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; }
    .kpi-title { font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--ink-dim); letter-spacing: 0.05em; }
    .kpi-val { font-size: 24px; font-weight: 700; margin-top: 6px; }
    .kpi-sub { font-size: 12px; color: var(--ink-dim); margin-top: 4px; }
    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;
      background: var(--accent-tint);
      color: var(--accent);
    }
    .badge.danger { background: var(--danger-tint); color: var(--danger); }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
    th { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--card-border); color: var(--ink-dim); font-weight: 600; font-size: 11px; text-transform: uppercase; }
    td { padding: 9px 10px; border-bottom: 1px solid var(--card-border); }
    tr:last-child td { border-bottom: none; }
    .amount { text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; }
    .total-row { font-weight: 700; background: var(--accent-tint); }
    .chart-container { width: 100%; overflow-x: auto; margin-top: 10px; }
    .search-box {
      width: 100%;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid var(--card-border);
      background: var(--bg);
      color: var(--ink);
      font-size: 13px;
      margin-bottom: 12px;
    }
    @media print {
      body { background: #fff; color: #000; padding: 0; }
      .btn-group, .search-box { display: none !important; }
      .card { border: 1px solid #ddd; break-inside: avoid; }
      :root { --card-border: #ddd; --ink: #000; --ink-dim: #555; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="title-group">
        <h1>Financial Statement & Bookkeeping Report</h1>
        <p>Name: <strong>${escapeHtml(data.userName)}</strong> &bull; Period: <strong>${escapeHtml(data.period.label)}</strong> &bull; As of: <strong>${escapeHtml(data.balanceSheet.asOfDate)}</strong> &bull; Currency: <strong>${escapeHtml(displayCode)}</strong></p>
      </div>
      <div class="btn-group">
        <button class="btn secondary" onclick="window.print()">Print / Save PDF</button>
      </div>
    </header>

    <!-- KPI STATS CARDS -->
    <div class="grid grid-4">
      <div class="card">
        <div class="kpi-title">Total Revenue</div>
        <div class="kpi-val" style="color: var(--accent);">${fmtC(data.incomeStatement.totalIncome)}</div>
        <div class="kpi-sub">Mean: ${fmtC(data.statistics.meanMonthlyIncome)}/mo</div>
      </div>
      <div class="card">
        <div class="kpi-title">Total Expenses</div>
        <div class="kpi-val" style="color: var(--danger);">${fmtC(data.incomeStatement.totalExpense)}</div>
        <div class="kpi-sub">Mean: ${fmtC(data.statistics.meanMonthlyExpense)}/mo</div>
      </div>
      <div class="card">
        <div class="kpi-title">Net Savings & Margin</div>
        <div class="kpi-val">${fmtC(data.incomeStatement.netIncome)}</div>
        <div class="kpi-sub">Savings Rate: <span class="badge">${data.incomeStatement.savingsRate}%</span></div>
      </div>
      <div class="card">
        <div class="kpi-title">Net Worth (Balance Sheet)</div>
        <div class="kpi-val">${fmtC(data.balanceSheet.netWorth)}</div>
        <div class="kpi-sub">Assets: ${fmtC(data.balanceSheet.totalAssets)} &bull; Liab: ${fmtC(data.balanceSheet.totalLiabilities)}</div>
      </div>
    </div>

    ${breakdownStr ? `<div style="margin-top: -12px; margin-bottom: 24px; font-size: 13px; color: var(--ink-dim);">Currency breakdown (native): <strong>${escapeHtml(breakdownStr)}</strong></div>` : ''}

    <!-- STATISTICAL DISTRIBUTION METRICS -->
    <div class="card" style="margin-bottom: 24px;">
      <h2>Statistical Indicators & Income Regularity</h2>
      <div class="grid grid-4" style="margin-top: 12px; margin-bottom: 0;">
        <div>
          <div class="kpi-sub">Income Median</div>
          <div style="font-size: 16px; font-weight: 600;">${fmtC(data.statistics.medianMonthlyIncome)}</div>
        </div>
        <div>
          <div class="kpi-sub">Income Std Deviation</div>
          <div style="font-size: 16px; font-weight: 600;">${fmtC(data.statistics.stdDevMonthlyIncome)}</div>
        </div>
        <div>
          <div class="kpi-sub">Income Volatility (CV)</div>
          <div style="font-size: 16px; font-weight: 600;">${data.statistics.cvMonthlyIncome.toFixed(2)} ${data.statistics.cvMonthlyIncome > 0.2 ? '<span class="badge danger">Irregular</span>' : '<span class="badge">Stable</span>'}</div>
        </div>
        <div>
          <div class="kpi-sub">Min / Max Monthly Income</div>
          <div style="font-size: 14px; font-weight: 600;">${fmtC(data.statistics.minMonthlyIncome)} &ndash; ${fmtC(data.statistics.maxMonthlyIncome)}</div>
        </div>
      </div>
    </div>

    <!-- CHARTS ROW -->
    <div class="grid grid-2">
      <div class="card">
        <h2>Monthly Cash Flow (Income vs Expenses)</h2>
        <div class="chart-container">${barChartSvg}</div>
      </div>
      <div class="card">
        <h2>Expense Category Distribution</h2>
        <div class="chart-container">${donutChartSvg}</div>
      </div>
    </div>

    <!-- NET WORTH TRAJECTORY -->
    <div class="card" style="margin-bottom: 24px;">
      <h2>Net Worth & Cumulative Savings Trajectory</h2>
      <div class="chart-container">${netWorthChartSvg}</div>
    </div>

    <!-- TRADITIONAL BOOKKEEPING: INCOME STATEMENT & BALANCE SHEET -->
    <div class="grid grid-2">
      <!-- INCOME STATEMENT -->
      <div class="card">
        <h2>Income Statement (P&amp;L) <span class="kpi-sub">Period Total</span></h2>
        <table>
          <thead>
            <tr><th>Revenues &amp; Inflows</th><th class="amount">Share</th><th class="amount">Amount</th></tr>
          </thead>
          <tbody>
            ${data.incomeStatement.incomeRows.map((r) => `
              <tr>
                <td>${escapeHtml(r.categoryLabel)}</td>
                <td class="amount">${r.percentage}%</td>
                <td class="amount" style="color: var(--accent);">${fmtC(r.amount)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td>Total Revenue</td>
              <td class="amount">100%</td>
              <td class="amount">${fmtC(data.incomeStatement.totalIncome)}</td>
            </tr>
          </tbody>
        </table>

        <table style="margin-top: 18px;">
          <thead>
            <tr><th>Operating Expenses</th><th class="amount">Share</th><th class="amount">Amount</th></tr>
          </thead>
          <tbody>
            ${data.incomeStatement.expenseRows.map((r) => `
              <tr>
                <td>${escapeHtml(r.categoryLabel)}</td>
                <td class="amount">${r.percentage}%</td>
                <td class="amount" style="color: var(--danger);">${fmtC(r.amount)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td>Total Expenses</td>
              <td class="amount">100%</td>
              <td class="amount">${fmtC(data.incomeStatement.totalExpense)}</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 14px; padding: 10px; background: var(--bg); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700;">Net Surplus / Profit</span>
          <span style="font-weight: 700; font-size: 16px; color: ${data.incomeStatement.netIncome >= 0 ? 'var(--accent)' : 'var(--danger)'};">${fmtC(data.incomeStatement.netIncome)}</span>
        </div>
      </div>

      <!-- BALANCE SHEET -->
      <div class="card">
        <h2>Balance Sheet <span class="kpi-sub">As of ${escapeHtml(data.balanceSheet.asOfDate)}</span></h2>
        <table>
          <thead>
            <tr><th>Asset Account</th><th class="amount">Class</th><th class="amount">Value</th></tr>
          </thead>
          <tbody>
            ${data.balanceSheet.assetGroups.flatMap((g) => g.items.map((i) => `
              <tr>
                <td>${escapeHtml(i.name)}</td>
                <td class="amount" style="color: var(--ink-dim);">${escapeHtml(g.clsLabel)}</td>
                <td class="amount">${fmtC(i.value)}</td>
              </tr>
            `)).join('')}
            <tr class="total-row">
              <td>Total Assets</td>
              <td></td>
              <td class="amount">${fmtC(data.balanceSheet.totalAssets)}</td>
            </tr>
          </tbody>
        </table>

        <table style="margin-top: 18px;">
          <thead>
            <tr><th>Liability Account</th><th class="amount">Class</th><th class="amount">Value</th></tr>
          </thead>
          <tbody>
            ${data.balanceSheet.liabilityGroups.flatMap((g) => g.items.map((i) => `
              <tr>
                <td>${escapeHtml(i.name)}</td>
                <td class="amount" style="color: var(--ink-dim);">${escapeHtml(g.clsLabel)}</td>
                <td class="amount">${fmtC(i.value)}</td>
              </tr>
            `)).join('')}
            <tr class="total-row">
              <td>Total Liabilities</td>
              <td></td>
              <td class="amount">${fmtC(data.balanceSheet.totalLiabilities)}</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 14px; padding: 10px; background: var(--bg); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700;">Owner Equity (Net Worth)</span>
          <span style="font-weight: 700; font-size: 16px;">${fmtC(data.balanceSheet.netWorth)}</span>
        </div>
      </div>
    </div>

    <!-- ITEMIZED TRANSACTION LEDGER -->
    <div class="card" style="margin-top: 24px;">
      <h2>Itemized Transaction Ledger <span class="badge">${data.transactions.length} Records</span></h2>
      <input type="text" id="ledgerFilter" class="search-box" placeholder="Search merchant, category, remark, or amount..." oninput="filterLedger()" />
      <table id="ledgerTable">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Category</th>
            <th>Merchant / Payee</th>
            <th>Remark</th>
            <th class="amount">Amount (${escapeHtml(displayCode)})</th>
          </tr>
        </thead>
        <tbody>
          ${data.transactions.map((t) => {
            const catLabel = (t.categoryId ? catMap.get(t.categoryId) : null) || t.type;
            return `
              <tr>
                <td>${escapeHtml(t.date || 'N/A')}</td>
                <td><span class="badge ${t.type === 'expense' ? 'danger' : ''}">${t.type.toUpperCase()}</span></td>
                <td>${escapeHtml(catLabel)}</td>
                <td><strong>${escapeHtml(t.merchantRaw || t.merchantKey || 'N/A')}</strong></td>
                <td style="color: var(--ink-dim); font-size: 12px;">${escapeHtml(t.remark || '')}</td>
                <td class="amount" style="color: ${t.type === 'income' ? 'var(--accent)' : 'var(--ink)'}; font-weight: 600;">
                  ${t.type === 'income' ? '+' : '-'}${fmtC(Math.abs(t.amount))}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <script>
    function filterLedger() {
      const q = document.getElementById('ledgerFilter').value.toLowerCase();
      const rows = document.querySelectorAll('#ledgerTable tbody tr');
      rows.forEach(r => {
        const txt = r.textContent.toLowerCase();
        r.style.display = txt.includes(q) ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 4. PRINTABLE FORMAL PDF HTML TEMPLATE
// ---------------------------------------------------------------------------

export function generatePrintablePDFHtml(data: FinancialReportData): string {
  const catMap = new Map<string, string>();
  for (const c of data.categories) catMap.set(c.id, c.label);
  const displayCode = data.displayCurrency || 'MYR';
  const displayRates = data.displayRates || {};
  const fmtC = (amt: number) => formatCurrency(amt, displayCode, displayRates);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Financial Statement - ${escapeHtml(data.userName)}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 15mm 20mm 15mm;
    }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #111;
      font-size: 9.5pt;
      line-height: 1.35;
      background: #fff;
    }
    .header {
      border-bottom: 2pt solid #111;
      padding-bottom: 8pt;
      margin-bottom: 12pt;
    }
    .header h1 {
      font-size: 16pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0 2pt 0;
    }
    .header .sub {
      font-size: 9pt;
      color: #444;
    }
    .meta-grid {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12pt;
      font-size: 8.5pt;
      background: #f8f8f8;
      padding: 6pt 10pt;
      border: 0.5pt solid #eee;
    }
    .section-title {
      font-size: 11pt;
      font-weight: bold;
      text-transform: uppercase;
      border-bottom: 1pt solid #333;
      padding-bottom: 3pt;
      margin-top: 14pt;
      margin-bottom: 6pt;
      letter-spacing: 0.03em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10pt;
      font-size: 8.5pt;
    }
    th, td {
      padding: 4pt 6pt;
      text-align: left;
    }
    th {
      border-bottom: 1pt solid #888;
      font-weight: bold;
      font-size: 8pt;
      text-transform: uppercase;
    }
    td.amount, th.amount {
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-family: 'Courier New', Courier, monospace;
    }
    tr.subtotal td {
      border-top: 0.5pt solid #888;
      font-weight: bold;
      background: #fafafa;
    }
    tr.grand-total td {
      border-top: 1.5pt solid #111;
      border-bottom: 2pt double #111;
      font-weight: bold;
      font-size: 9.5pt;
      background: #f0f0f0;
    }
    .two-col {
      display: flex;
      gap: 14pt;
    }
    .col {
      flex: 1;
    }
    .kpi-box {
      border: 1pt solid #ccc;
      padding: 8pt;
      margin-bottom: 12pt;
      background: #fafafa;
      display: flex;
      justify-content: space-around;
      text-align: center;
      page-break-inside: avoid;
    }
    .kpi-item .label { font-size: 8pt; text-transform: uppercase; color: #555; }
    .kpi-item .val { font-size: 11pt; font-weight: bold; font-family: 'Courier New', Courier, monospace; }
    .page-break { page-break-before: always; }
    .footer {
      margin-top: 20pt;
      border-top: 1pt solid #ccc;
      padding-top: 6pt;
      font-size: 8pt;
      color: #666;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Statement of Financial Condition &amp; Operations</h1>
    <div class="sub">Traditional Double-Entry Accounting Ledger &amp; Statistics</div>
  </div>

  <div class="meta-grid">
    <div><strong>Name:</strong> ${escapeHtml(data.userName)}</div>
    <div><strong>Period:</strong> ${escapeHtml(data.period.label)}</div>
    <div><strong>As of Date:</strong> ${escapeHtml(data.balanceSheet.asOfDate)}</div>
    <div><strong>Currency:</strong> ${escapeHtml(displayCode === 'MYR' ? 'MYR (Ringgit)' : displayCode)}</div>
  </div>

  <!-- EXECUTIVE SUMMARY KPIS -->
  <div class="kpi-box">
    <div class="kpi-item">
      <div class="label">Total Revenue</div>
      <div class="val">${fmtC(data.incomeStatement.totalIncome)}</div>
    </div>
    <div class="kpi-item">
      <div class="label">Total Expenses</div>
      <div class="val">${fmtC(data.incomeStatement.totalExpense)}</div>
    </div>
    <div class="kpi-item">
      <div class="label">Net Surplus / Savings</div>
      <div class="val">${fmtC(data.incomeStatement.netIncome)}</div>
    </div>
    <div class="kpi-item">
      <div class="label">Net Worth Position</div>
      <div class="val">${fmtC(data.balanceSheet.netWorth)}</div>
    </div>
    <div class="kpi-item">
      <div class="label">Savings Margin</div>
      <div class="val">${data.incomeStatement.savingsRate}%</div>
    </div>
  </div>

  <!-- INCOME STATEMENT -->
  <div class="section-title">I. Income Statement (Statement of Profit &amp; Loss)</div>
  <table>
    <thead>
      <tr>
        <th style="width: 50%;">Account / Category Description</th>
        <th class="amount" style="width: 20%;">Share (%)</th>
        <th class="amount" style="width: 30%;">Amount (${escapeHtml(displayCode)})</th>
      </tr>
    </thead>
    <tbody>
      <tr><td colspan="3" style="font-weight: bold; background: #f0f0f0;">Revenues &amp; Inflows</td></tr>
      ${data.incomeStatement.incomeRows.map((r) => `
        <tr>
          <td style="padding-left: 12pt;">${escapeHtml(r.categoryLabel)}</td>
          <td class="amount">${r.percentage}%</td>
          <td class="amount">${fmtC(r.amount)}</td>
        </tr>
      `).join('')}
      <tr class="subtotal">
        <td>TOTAL REVENUES (A)</td>
        <td class="amount">100.0%</td>
        <td class="amount">${fmtC(data.incomeStatement.totalIncome)}</td>
      </tr>

      <tr><td colspan="3" style="font-weight: bold; background: #f0f0f0; margin-top: 6pt;">Operating &amp; Living Expenses</td></tr>
      ${data.incomeStatement.expenseRows.map((r) => `
        <tr>
          <td style="padding-left: 12pt;">${escapeHtml(r.categoryLabel)}</td>
          <td class="amount">${r.percentage}%</td>
          <td class="amount">${fmtC(r.amount)}</td>
        </tr>
      `).join('')}
      <tr class="subtotal">
        <td>TOTAL EXPENSES (B)</td>
        <td class="amount">100.0%</td>
        <td class="amount">${fmtC(data.incomeStatement.totalExpense)}</td>
      </tr>

      <tr class="grand-total">
        <td>NET INCOME / SURPLUS FOR PERIOD (A - B)</td>
        <td class="amount">${data.incomeStatement.savingsRate}%</td>
        <td class="amount">${fmtC(data.incomeStatement.netIncome)}</td>
      </tr>
    </tbody>
  </table>

  <!-- BALANCE SHEET -->
  <div class="section-title" style="margin-top: 18pt;">II. Balance Sheet (Statement of Financial Position)</div>
  <div class="two-col">
    <!-- ASSETS -->
    <div class="col">
      <table>
        <thead>
          <tr><th>Assets &amp; Holdings</th><th class="amount">Value (${escapeHtml(displayCode)})</th></tr>
        </thead>
        <tbody>
          ${data.balanceSheet.assetGroups.map((g) => `
            <tr><td colspan="2" style="font-weight: bold; background: #f5f5f5;">${escapeHtml(g.clsLabel)}</td></tr>
            ${g.items.map((i) => `
              <tr>
                <td style="padding-left: 8pt;">${escapeHtml(i.name)}</td>
                <td class="amount">${fmtC(i.value)}</td>
              </tr>
            `).join('')}
          `).join('')}
          <tr class="grand-total">
            <td>TOTAL ASSETS</td>
            <td class="amount">${fmtC(data.balanceSheet.totalAssets)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- LIABILITIES & EQUITY -->
    <div class="col">
      <table>
        <thead>
          <tr><th>Liabilities &amp; Obligations</th><th class="amount">Value (${escapeHtml(displayCode)})</th></tr>
        </thead>
        <tbody>
          ${data.balanceSheet.liabilityGroups.length === 0 ? '<tr><td colspan="2">No outstanding debt recorded</td></tr>' : ''}
          ${data.balanceSheet.liabilityGroups.map((g) => `
            <tr><td colspan="2" style="font-weight: bold; background: #f5f5f5;">${escapeHtml(g.clsLabel)}</td></tr>
            ${g.items.map((i) => `
              <tr>
                <td style="padding-left: 8pt;">${escapeHtml(i.name)}</td>
                <td class="amount">${fmtC(i.value)}</td>
              </tr>
            `).join('')}
          `).join('')}
          <tr class="subtotal">
            <td>TOTAL LIABILITIES</td>
            <td class="amount">${fmtC(data.balanceSheet.totalLiabilities)}</td>
          </tr>
          <tr><td colspan="2" style="font-weight: bold; background: #f5f5f5;">Owner Equity</td></tr>
          <tr>
            <td style="padding-left: 8pt;">Net Worth Position</td>
            <td class="amount">${fmtC(data.balanceSheet.netWorth)}</td>
          </tr>
          <tr class="grand-total">
            <td>TOTAL LIABILITIES &amp; EQUITY</td>
            <td class="amount">${fmtC(data.balanceSheet.totalLiabilities + data.balanceSheet.netWorth)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- STATISTICAL ANALYSIS -->
  <div class="section-title" style="margin-top: 18pt;">III. Key Financial Statistics &amp; Regularity</div>
  <table>
    <thead>
      <tr><th>Statistical Metric</th><th class="amount">Calculated Value</th><th>Interpretation</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>Mean (Average) Monthly Income</td>
        <td class="amount">${fmtC(data.statistics.meanMonthlyIncome)}</td>
        <td>Average monthly cash intake</td>
      </tr>
      <tr>
        <td>Median Monthly Income</td>
        <td class="amount">${fmtC(data.statistics.medianMonthlyIncome)}</td>
        <td>Central 50th percentile floor</td>
      </tr>
      <tr>
        <td>Income Standard Deviation</td>
        <td class="amount">${fmtC(data.statistics.stdDevMonthlyIncome)}</td>
        <td>Monthly earnings volatility measure</td>
      </tr>
      <tr>
        <td>Coefficient of Variation (CV)</td>
        <td class="amount">${data.statistics.cvMonthlyIncome.toFixed(2)}</td>
        <td>${data.statistics.cvMonthlyIncome > 0.2 ? 'Irregular / Gig earnings profile' : 'Highly consistent income stream'}</td>
      </tr>
      <tr>
        <td>Mean Monthly Expense</td>
        <td class="amount">${fmtC(data.statistics.meanMonthlyExpense)}</td>
        <td>Average living cost run-rate</td>
      </tr>
    </tbody>
  </table>

  <!-- ITEMIZED LEDGER (PAGE BREAK) -->
  <div class="page-break"></div>
  <div class="section-title">IV. Itemized Transaction Ledger (${data.transactions.length} Entries)</div>
  <table>
    <thead>
      <tr>
        <th style="width: 14%;">Date</th>
        <th style="width: 10%;">Type</th>
        <th style="width: 22%;">Category</th>
        <th style="width: 32%;">Merchant / Counterparty</th>
        <th class="amount" style="width: 22%;">Amount (${escapeHtml(displayCode)})</th>
      </tr>
    </thead>
    <tbody>
      ${data.transactions.slice(0, 150).map((t) => {
        const cat = (t.categoryId ? catMap.get(t.categoryId) : null) || t.type;
        return `
          <tr>
            <td>${escapeHtml(t.date || 'N/A')}</td>
            <td>${t.type.toUpperCase()}</td>
            <td>${escapeHtml(cat)}</td>
            <td>${escapeHtml(t.merchantRaw || t.merchantKey || 'N/A')}</td>
            <td class="amount">${t.type === 'income' ? '+' : '-'}${fmtC(Math.abs(t.amount))}</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>
  ${data.transactions.length > 150 ? `<p style="font-size: 8pt; color: #777; font-style: italic;">* Displaying first 150 transactions. Complete ledger available in Excel/CSV exports.</p>` : ''}

  <div class="footer">
    <div>Generated by Pip Financial OS &bull; Confidential Personal Financial Statement</div>
    <div>Document Date: ${escapeHtml(data.generatedAt.slice(0, 10))}</div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 5. SVG CHART RENDERERS (SELF-CONTAINED, ZERO EXTERNAL DEPENDENCIES)
// ---------------------------------------------------------------------------

function renderMonthlyBarChartSvg(trends: MonthlyTrendItem[], displayCode: string = 'MYR', displayRates: Record<string, number> = {}): string {
  if (trends.length === 0) {
    return `<div style="padding: 20px; text-align: center; color: var(--ink-dim);">No monthly data in this period.</div>`;
  }
  const W = 460;
  const H = 200;
  const padL = 50;
  const padR = 15;
  const padT = 20;
  const padB = 30;

  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxVal = Math.max(100, ...trends.map((t) => Math.max(t.income, t.expense))) * 1.15;
  const barGroupWidth = innerW / trends.length;
  const barWidth = Math.max(4, Math.min(14, (barGroupWidth - 8) / 2));

  let barsHtml = '';
  trends.forEach((t, i) => {
    const xCenter = padL + i * barGroupWidth + barGroupWidth / 2;
    const hInc = (t.income / maxVal) * innerH;
    const yInc = padT + innerH - hInc;
    const xInc = xCenter - barWidth - 1;

    const hExp = (t.expense / maxVal) * innerH;
    const yExp = padT + innerH - hExp;
    const xExp = xCenter + 1;

    barsHtml += `
      <rect x="${xInc.toFixed(1)}" y="${yInc.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${hInc.toFixed(1)}" rx="3" fill="#22c55e" opacity="0.9">
        <title>${t.monthLabel} Income: ${formatCurrency(t.income, displayCode, displayRates)}</title>
      </rect>
      <rect x="${xExp.toFixed(1)}" y="${yExp.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${hExp.toFixed(1)}" rx="3" fill="#ef4444" opacity="0.85">
        <title>${t.monthLabel} Expense: ${formatCurrency(t.expense, displayCode, displayRates)}</title>
      </rect>
      <text x="${xCenter.toFixed(1)}" y="${(H - 8).toFixed(1)}" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">${t.monthLabel}</text>
    `;
  });

  // Y-axis gridlines
  let gridHtml = '';
  for (let step = 0; step <= 3; step++) {
    const frac = step / 3;
    const y = padT + innerH * (1 - frac);
    const val = maxVal * frac;
    gridHtml += `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3,3" />
      <text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="currentColor" opacity="0.5">${Math.round(val)}</text>
    `;
  }

  return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="overflow: visible;">
      ${gridHtml}
      ${barsHtml}
      <!-- Legend -->
      <circle cx="${W - 120}" cy="10" r="4" fill="#22c55e" />
      <text x="${W - 110}" y="13" font-size="9" fill="currentColor" opacity="0.8">Income</text>
      <circle cx="${W - 55}" cy="10" r="4" fill="#ef4444" />
      <text x="${W - 45}" y="13" font-size="9" fill="currentColor" opacity="0.8">Expense</text>
    </svg>
  `;
}

function renderExpenseDonutSvg(categories: { label: string; amount: number; percentage: number; hue: number }[], displayCode: string = 'MYR', displayRates: Record<string, number> = {}): string {
  if (categories.length === 0) {
    return `<div style="padding: 20px; text-align: center; color: var(--ink-dim);">No expenses in this period.</div>`;
  }
  const size = 200;
  const radius = 70;
  const strokeWidth = 24;
  const cx = 100;
  const cy = 100;
  const circumference = 2 * Math.PI * radius;

  let accumulated = 0;
  const topCategories = categories.slice(0, 6);
  const total = categories.reduce((sum, c) => sum + c.amount, 0);

  let pathsHtml = '';
  let legendHtml = '';

  topCategories.forEach((c, idx) => {
    const fraction = total > 0 ? c.amount / total : 0;
    const strokeDasharray = `${(fraction * circumference).toFixed(2)} ${circumference.toFixed(2)}`;
    const strokeDashoffset = (-accumulated * circumference).toFixed(2);
    accumulated += fraction;
    const color = `hsl(${c.hue}, 70%, 50%)`;

    pathsHtml += `
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"
        stroke-dasharray="${strokeDasharray}" stroke-dashoffset="${strokeDashoffset}"
        transform="rotate(-90 ${cx} ${cy})">
        <title>${c.label}: ${formatCurrency(c.amount, displayCode, displayRates)} (${c.percentage}%)</title>
      </circle>
    `;

    legendHtml += `
      <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; margin-bottom: 4px;">
        <span style="width: 10px; height: 10px; border-radius: 2px; background: ${color}; display: inline-block;"></span>
        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(c.label)}</span>
        <span style="font-weight: 600;">${c.percentage}%</span>
      </div>
    `;
  });

  return `
    <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
      <svg viewBox="0 0 ${size} ${size}" width="160" height="160" style="flex-shrink: 0;">
        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="currentColor" stroke-opacity="0.08" stroke-width="${strokeWidth}" />
        ${pathsHtml}
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">Total Spent</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">${formatCurrency(total, displayCode, displayRates)}</text>
      </svg>
      <div style="flex: 1; min-width: 160px;">${legendHtml}</div>
    </div>
  `;
}

function renderNetWorthTrendSvg(trends: MonthlyTrendItem[], displayCode: string = 'MYR', displayRates: Record<string, number> = {}): string {
  if (trends.length <= 1) {
    return `<div style="padding: 20px; text-align: center; color: var(--ink-dim);">Requires at least 2 monthly data points for trajectory.</div>`;
  }
  const W = 600;
  const H = 160;
  const padL = 50;
  const padR = 20;
  const padT = 20;
  const padB = 30;

  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const values = trends.map((t) => t.netWorth);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(100, ...values) * 1.1;
  const range = maxVal - minVal || 1;

  const points = trends.map((t, i) => {
    const x = padL + (i / (trends.length - 1)) * innerW;
    const y = padT + innerH - ((t.netWorth - minVal) / range) * innerH;
    return { x, y, val: t.netWorth, label: t.monthLabel };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  let dotsHtml = '';
  points.forEach((p) => {
    dotsHtml += `
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#22c55e" stroke="var(--bg)" stroke-width="2">
        <title>${p.label}: ${formatCurrency(p.val, displayCode, displayRates)}</title>
      </circle>
      <text x="${p.x.toFixed(1)}" y="${(H - 8).toFixed(1)}" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.6">${p.label}</text>
    `;
  });

  return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">
      <defs>
        <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#22c55e" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#22c55e" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      <!-- Area fill -->
      <path d="${areaD}" fill="url(#nwGrad)" />
      <!-- Stroke line -->
      <path d="${pathD}" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      ${dotsHtml}
    </svg>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------------------------------------------------------------------------
// 6. E-WALLET TRANSACTION HISTORY & PROVIDER BREAKDOWN GENERATOR
// ---------------------------------------------------------------------------

/**
 * Deterministically identify whether a transaction originated from or represents
 * an e-wallet / payment app transaction (Touch 'n Go, GrabPay, Boost, ShopeePay, BigPay, MAE, DuitNow QR, etc.).
 */
export function isEwalletTransaction(t: Transaction, accounts?: Account[]): boolean {
  if (accounts && accounts.length > 0) {
    const matchedAccount = accounts.find((a) => a.id === (t as any).accountId);
    if (matchedAccount) {
      if (matchedAccount.cls === 'ewallet') return true;
      const inst = matchInstitution(matchedAccount.name);
      if (inst && inst.kind === 'ewallet') return true;
    }
  }

  const mRaw = (t.merchantRaw || '').toLowerCase();
  const mKey = (t.merchantKey || '').toLowerCase();
  const remark = (t.remark || '').toLowerCase();

  const instMatch = matchInstitution(t.merchantRaw) || matchInstitution(t.merchantKey);
  if (instMatch && instMatch.kind === 'ewallet') return true;

  const ewalletKeywords = [
    'tng',
    'touch n go',
    "touch 'n go",
    'touch & go',
    'grabpay',
    'grab',
    'boost',
    'shopeepay',
    'shopee pay',
    'bigpay',
    'big pay',
    'mae by maybank2u',
    'mae',
    'setel',
    'duitnow qr',
    'duitnow',
    'qr pay',
    'qr payment',
    'e-wallet',
    'ewallet',
    'wallet reload',
    'e-money',
  ];

  for (const kw of ewalletKeywords) {
    if (mRaw.includes(kw) || mKey.includes(kw) || remark.includes(kw)) {
      return true;
    }
  }

  if (t.source === 'extracted' && (mRaw.includes('qr') || mRaw.includes('pay') || mRaw.includes('transfer') || remark.includes('qr'))) {
    return true;
  }

  return false;
}

/**
 * Resolves the display name of the E-Wallet provider for a transaction.
 */
export function getEwalletProviderName(t: Transaction, accounts?: Account[]): string {
  if (accounts && accounts.length > 0) {
    const matchedAccount = accounts.find((a) => a.id === (t as any).accountId);
    if (matchedAccount) {
      const inst = matchInstitution(matchedAccount.name);
      if (inst && inst.kind === 'ewallet') return inst.name;
    }
  }

  const instMatch = matchInstitution(t.merchantRaw) || matchInstitution(t.merchantKey);
  if (instMatch && instMatch.kind === 'ewallet') return instMatch.name;

  const text = `${t.merchantRaw || ''} ${t.merchantKey || ''} ${t.remark || ''}`.toLowerCase();

  if (text.includes('tng') || text.includes("touch 'n go") || text.includes('touch n go') || text.includes('touch & go')) {
    return "Touch 'n Go eWallet";
  }
  if (text.includes('grabpay') || text.includes('grab')) {
    return 'GrabPay';
  }
  if (text.includes('boost')) {
    return 'Boost';
  }
  if (text.includes('shopeepay') || text.includes('shopee pay')) {
    return 'ShopeePay';
  }
  if (text.includes('bigpay') || text.includes('big pay')) {
    return 'BigPay';
  }
  if (text.includes('mae')) {
    return 'MAE by Maybank2u';
  }
  if (text.includes('setel')) {
    return 'Setel';
  }
  if (text.includes('duitnow qr') || text.includes('duitnow') || text.includes('qr pay') || text.includes('qr payment')) {
    return 'DuitNow QR';
  }

  return 'E-Wallet';
}

/**
 * Generate a dedicated, provider-itemized E-Wallet History CSV export.
 */
export function generateEwalletCSV(
  data: FinancialReportData,
  ewalletTxns?: Transaction[]
): string {
  const txns = ewalletTxns ?? data.transactions.filter((t) => isEwalletTransaction(t, data.accounts));
  const catMap = new Map<string, string>();
  for (const c of data.categories) catMap.set(c.id, c.label);

  const lines: string[] = [];

  // Metadata Header
  lines.push(`${csvEscape('E-WALLET TRANSACTION HISTORY & PROVIDER STATEMENT')}`);
  lines.push(`${csvEscape('Name')},${csvEscape(data.userName)}`);
  lines.push(`${csvEscape('Period')},${csvEscape(data.period.label)}`);
  lines.push(`${csvEscape('Generated At')},${csvEscape(data.generatedAt)}`);
  lines.push(`${csvEscape('Total E-Wallet Transactions')},${txns.length}`);
  lines.push('');

  // Provider Summaries
  const providerStats = new Map<string, { count: number; spent: number; received: number }>();
  for (const t of txns) {
    const provider = getEwalletProviderName(t, data.accounts);
    const existing = providerStats.get(provider) || { count: 0, spent: 0, received: 0 };
    existing.count += 1;
    if (t.type === 'income') {
      existing.received += Math.abs(t.amount);
    } else {
      existing.spent += Math.abs(t.amount);
    }
    providerStats.set(provider, existing);
  }

  let totalSpent = 0;
  let totalReceived = 0;
  for (const s of providerStats.values()) {
    totalSpent += s.spent;
    totalReceived += s.received;
  }

  lines.push(`${csvEscape('=== E-WALLET PROVIDER BREAKDOWN ===')}`);
  lines.push(
    `${csvEscape('E-Wallet Provider')},${csvEscape('Txn Count')},${csvEscape('Total Spent (MYR)')},${csvEscape('Total Received (MYR)')},${csvEscape('Net Outflow (MYR)')}`
  );
  for (const [provider, stats] of providerStats.entries()) {
    const net = stats.spent - stats.received;
    lines.push(
      `${csvEscape(provider)},${stats.count},${stats.spent.toFixed(2)},${stats.received.toFixed(2)},${net.toFixed(2)}`
    );
  }
  lines.push(
    `${csvEscape('TOTAL')},${txns.length},${totalSpent.toFixed(2)},${totalReceived.toFixed(2)},${(totalSpent - totalReceived).toFixed(2)}`
  );
  lines.push('');

  // Itemized Transactions
  lines.push(`${csvEscape('=== ITEMIZED E-WALLET TRANSACTIONS ===')}`);
  lines.push(
    [
      csvEscape('Date'),
      csvEscape('E-Wallet / Platform'),
      csvEscape('Type'),
      csvEscape('Category'),
      csvEscape('Merchant / Payee'),
      csvEscape('Amount (MYR)'),
      csvEscape('Direction'),
      csvEscape('Source'),
      csvEscape('Remark / Notes'),
    ].join(',')
  );

  for (const t of txns) {
    const provider = getEwalletProviderName(t, data.accounts);
    const catName = (t.categoryId ? catMap.get(t.categoryId) : null) || (t.type === 'income' ? 'Income' : 'Expense');
    lines.push(
      [
        csvEscape(t.date || 'N/A'),
        csvEscape(provider),
        csvEscape(t.type.toUpperCase()),
        csvEscape(catName),
        csvEscape(t.merchantRaw || t.merchantKey || 'N/A'),
        Math.abs(t.amount).toFixed(2),
        csvEscape(t.type === 'income' ? 'IN (+)' : 'OUT (-)'),
        csvEscape(t.source),
        csvEscape(t.remark || ''),
      ].join(',')
    );
  }

  return '\uFEFF' + lines.join('\n');
}

/**
 * Generate an interactive HTML report preview for E-Wallet transactions.
 */
export function generateEwalletPreviewHtml(
  data: FinancialReportData,
  ewalletTxns?: Transaction[]
): string {
  const txns = ewalletTxns ?? data.transactions.filter((t) => isEwalletTransaction(t, data.accounts));
  const catMap = new Map<string, string>();
  for (const c of data.categories) catMap.set(c.id, c.label);

  const providerStats = new Map<string, { count: number; spent: number; received: number }>();
  for (const t of txns) {
    const provider = getEwalletProviderName(t, data.accounts);
    const existing = providerStats.get(provider) || { count: 0, spent: 0, received: 0 };
    existing.count += 1;
    if (t.type === 'income') {
      existing.received += Math.abs(t.amount);
    } else {
      existing.spent += Math.abs(t.amount);
    }
    providerStats.set(provider, existing);
  }

  let totalSpent = 0;
  let totalReceived = 0;
  for (const s of providerStats.values()) {
    totalSpent += s.spent;
    totalReceived += s.received;
  }

  const providerCardsHtml = Array.from(providerStats.entries())
    .map(([provider, stats]) => {
      return `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; min-width: 160px; flex: 1;">
          <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">${escapeHtml(provider)}</div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">${stats.count} transactions</div>
          <div style="font-size: 14px; font-weight: 700; color: #b3261e;">Spent: RM ${stats.spent.toFixed(2)}</div>
          ${stats.received > 0 ? `<div style="font-size: 12px; font-weight: 600; color: #15803d; margin-top: 2px;">Received: RM ${stats.received.toFixed(2)}</div>` : ''}
        </div>
      `;
    })
    .join('');

  const rowsHtml = txns
    .map((t, idx) => {
      const provider = getEwalletProviderName(t, data.accounts);
      const catName = (t.categoryId ? catMap.get(t.categoryId) : null) || (t.type === 'income' ? 'Income' : 'Expense');
      const isInc = t.type === 'income';
      return `
        <tr style="background: ${idx % 2 === 1 ? '#f8fafc' : '#ffffff'}; border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 12px; font-size: 12px; color: #64748b;">${escapeHtml(t.date || '-')}</td>
          <td style="padding: 10px 12px; font-size: 12px; font-weight: 600; color: #0284c7;">
            <span style="background: #e0f2fe; padding: 2px 6px; border-radius: 4px;">${escapeHtml(provider)}</span>
          </td>
          <td style="padding: 10px 12px; font-size: 12px; font-weight: 600; color: #1e293b;">${escapeHtml(t.merchantRaw || t.merchantKey || 'E-Wallet Txn')}</td>
          <td style="padding: 10px 12px; font-size: 12px; color: #475569;">${escapeHtml(catName)}</td>
          <td style="padding: 10px 12px; font-size: 12px; font-weight: 700; text-align: right; color: ${isInc ? '#15803d' : '#1e293b'};">
            ${isInc ? '+' : '-'}RM ${Math.abs(t.amount).toFixed(2)}
          </td>
          <td style="padding: 10px 12px; font-size: 11px; color: #64748b;">${escapeHtml(t.remark || t.source)}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>E-Wallet History Statement</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; color: #0f172a; background: #ffffff; }
          .header { margin-bottom: 20px; border-bottom: 2px solid #0284c7; padding-bottom: 12px; }
          .title { font-size: 18px; font-weight: 800; color: #0f172a; }
          .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
          .grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; text-align: left; }
          th { background: #f1f5f9; padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">E-Wallet Transaction History Statement</div>
          <div class="subtitle">Period: <strong>${escapeHtml(data.period.label)}</strong> | Generated: ${escapeHtml(data.generatedAt.slice(0, 10))} | Name: ${escapeHtml(data.userName)}</div>
        </div>

        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; flex: 1;">
            <div style="font-size: 11px; color: #166534; font-weight: 700; text-transform: uppercase;">Total E-Wallet Outflow</div>
            <div style="font-size: 18px; font-weight: 800; color: #15803d; margin-top: 4px;">RM ${totalSpent.toFixed(2)}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; flex: 1;">
            <div style="font-size: 11px; color: #475569; font-weight: 700; text-transform: uppercase;">Total E-Wallet Transactions</div>
            <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px;">${txns.length} txns</div>
          </div>
        </div>

        <h3 style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px; text-transform: uppercase;">Provider Breakdown</h3>
        <div class="grid">
          ${providerCardsHtml || '<div style="color: #94a3b8; font-size: 12px;">No e-wallet transactions found in this period.</div>'}
        </div>

        <h3 style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px; text-transform: uppercase;">Itemized E-Wallet Ledger</h3>
        <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Provider</th>
                <th>Merchant / Payee</th>
                <th>Category</th>
                <th style="text-align: right;">Amount</th>
                <th>Remark / Source</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #94a3b8;">No e-wallet transactions found in this period.</td></tr>'}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;
}

// ---------------------------------------------------------------------------
// 7. RECEIPTS & INVOICES EVIDENCE ARCHIVE (.ZIP) GENERATOR
// ---------------------------------------------------------------------------

export interface ReceiptExportItem {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  remark: string;
  fileName: string;
  imageUri: string;
}

/**
 * Builds a structured list of receipt images and evidence metadata for transactions in the period.
 */
export function buildReceiptExportList(
  periodTransactions: Transaction[],
  categories: Category[],
  reliefTags?: ReliefTag[]
): ReceiptExportItem[] {
  const catMap = new Map<string, string>();
  for (const c of categories) catMap.set(c.id, c.label);

  const items: ReceiptExportItem[] = [];
  const seenUris = new Set<string>();

  for (const t of periodTransactions) {
    if (t.receiptUri && !seenUris.has(t.receiptUri)) {
      seenUris.add(t.receiptUri);
      const datePrefix = t.date ? t.date.replace(/-/g, '') : 'nodate';
      const merchantPrefix = (t.merchantRaw || 'receipt')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 30);
      const amtStr = `RM${Math.abs(t.amount).toFixed(2).replace('.', '_')}`;
      const ext = t.receiptUri.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
      const fileName = `${datePrefix}_${merchantPrefix}_${amtStr}.${ext}`;
      const catName = (t.categoryId ? catMap.get(t.categoryId) : null) || 'General';

      items.push({
        id: t.id,
        date: t.date || 'unknown',
        merchant: t.merchantRaw || 'Receipt',
        amount: Math.abs(t.amount),
        currency: t.currency || 'MYR',
        category: catName,
        remark: t.remark || '',
        fileName,
        imageUri: t.receiptUri,
      });
    }
  }

  if (reliefTags && reliefTags.length > 0) {
    for (const tag of reliefTags) {
      const txn = periodTransactions.find((x) => x.id === tag.txnId);
      if (tag.certImageUri && !seenUris.has(tag.certImageUri)) {
        seenUris.add(tag.certImageUri);
        const datePrefix = txn?.date ? txn.date.replace(/-/g, '') : 'nodate';
        const merchantPrefix = (txn?.merchantRaw || 'cert')
          .replace(/[^a-zA-Z0-9]/g, '_')
          .replace(/_+/g, '_')
          .slice(0, 30);
        const ext = tag.certImageUri.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
        items.push({
          id: tag.id,
          date: txn?.date || 'unknown',
          merchant: txn?.merchantRaw || `Tax Relief ${tag.code}`,
          amount: tag.amount,
          currency: 'MYR',
          category: `Tax Relief (${tag.code})`,
          remark: 'Medical / Certification Document',
          fileName: `${datePrefix}_${merchantPrefix}_cert.${ext}`,
          imageUri: tag.certImageUri,
        });
      }
      if (tag.einvoiceImageUri && !seenUris.has(tag.einvoiceImageUri)) {
        seenUris.add(tag.einvoiceImageUri);
        const datePrefix = txn?.date ? txn.date.replace(/-/g, '') : 'nodate';
        const merchantPrefix = (txn?.merchantRaw || 'einvoice')
          .replace(/[^a-zA-Z0-9]/g, '_')
          .replace(/_+/g, '_')
          .slice(0, 30);
        const ext = tag.einvoiceImageUri.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
        items.push({
          id: tag.id,
          date: txn?.date || 'unknown',
          merchant: txn?.merchantRaw || `e-Invoice ${tag.code}`,
          amount: tag.amount,
          currency: 'MYR',
          category: `Tax Relief (${tag.code})`,
          remark: 'Official e-Invoice',
          fileName: `${datePrefix}_${merchantPrefix}_einvoice.${ext}`,
          imageUri: tag.einvoiceImageUri,
        });
      }
    }
  }

  return items;
}

/**
 * Packages all attached receipt photos, medical certifications, and e-invoices
 * for the selected reporting period into an organized ZIP archive with manifests.
 */
export function generateReceiptsZip(
  data: FinancialReportData,
  periodTransactions: Transaction[],
  reliefTags?: ReliefTag[]
): Uint8Array {
  const items = buildReceiptExportList(periodTransactions, data.categories, reliefTags);
  const zipEntries: Record<string, Uint8Array> = {};

  const manifestRows: string[] = [
    'Index,Date,Merchant,Amount (MYR),Currency,Category,Remark,Image File Name,Attached',
  ];

  let attachedCount = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const bytes = readImageBytes(item.imageUri);
    const hasImage = bytes !== null && bytes.length > 0;
    if (hasImage) {
      zipEntries[`receipts/${item.fileName}`] = bytes;
      attachedCount += 1;
    }
    manifestRows.push(
      [
        i + 1,
        csvEscape(item.date),
        csvEscape(item.merchant),
        item.amount.toFixed(2),
        csvEscape(item.currency),
        csvEscape(item.category),
        csvEscape(item.remark),
        csvEscape(item.fileName),
        hasImage ? 'Yes' : 'Missing File',
      ].join(',')
    );
  }

  // 1. Add receipts_manifest.csv
  zipEntries['receipts_manifest.csv'] = strToU8('\uFEFF' + manifestRows.join('\n'));

  // 2. Add MANIFEST.json
  const manifestJson = {
    application: 'Pip Finance',
    exportType: 'Receipts & Evidence Archive',
    userName: data.userName,
    period: data.period.label,
    exportedAt: data.generatedAt,
    receiptCount: items.length,
    attachedFilesCount: attachedCount,
    totalReceiptValueMYR: items.reduce((sum, item) => sum + item.amount, 0),
    items: items.map((m) => ({
      date: m.date,
      merchant: m.merchant,
      amount: m.amount,
      currency: m.currency,
      category: m.category,
      remark: m.remark,
      fileName: m.fileName,
      attached: zipEntries[`receipts/${m.fileName}`] !== undefined,
    })),
  };
  zipEntries['MANIFEST.json'] = strToU8(JSON.stringify(manifestJson, null, 2));

  // 3. Add README.txt
  const totalValue = items.reduce((sum, item) => sum + item.amount, 0);
  const readmeText = [
    '================================================================================',
    'PIP FINANCE - RECEIPTS & EVIDENCE ARCHIVE',
    `Export Period: ${data.period.label}`,
    `Generated At:  ${data.generatedAt}`,
    `User:          ${data.userName}`,
    '================================================================================',
    '',
    `Total Receipts Found:  ${items.length}`,
    `Attached Image Files:  ${attachedCount}`,
    `Total Receipt Value:   RM ${totalValue.toFixed(2)}`,
    '',
    'CONTENTS:',
    '1. receipts/               Folder containing original receipt photos and documents',
    '2. receipts_manifest.csv   Spreadsheet containing complete itemized metadata',
    '3. MANIFEST.json           Structured machine-readable index for audit ingestion',
    '4. README.txt              This summary file',
    '',
    'ITEMIZED LIST:',
    ...items.map(
      (m, idx) =>
        `${idx + 1}. [${m.date}] ${m.merchant} - RM ${m.amount.toFixed(2)} (${m.category}) -> receipts/${m.fileName}`
    ),
    '',
    '================================================================================',
    'Generated by Pip Finance (https://pipfinance.app) - Offline-first personal bookkeeping',
  ].join('\n');

  zipEntries['README.txt'] = strToU8(readmeText);

  return zipSync(zipEntries);
}

/**
 * Generate an interactive HTML report preview for Receipts & Evidence.
 */
export function generateReceiptsPreviewHtml(
  data: FinancialReportData,
  periodTransactions: Transaction[],
  reliefTags?: ReliefTag[]
): string {
  const items = buildReceiptExportList(periodTransactions, data.categories, reliefTags);
  const totalVal = items.reduce((s, it) => s + it.amount, 0);

  const rowsHtml = items
    .map((item, idx) => {
      return `
        <tr style="background: ${idx % 2 === 1 ? '#f8fafc' : '#ffffff'}; border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 12px; font-size: 12px; color: #64748b;">${escapeHtml(item.date)}</td>
          <td style="padding: 10px 12px; font-size: 12px; font-weight: 700; color: #0f172a;">${escapeHtml(item.merchant)}</td>
          <td style="padding: 10px 12px; font-size: 12px; color: #0284c7;">
            <span style="background: #e0f2fe; padding: 2px 6px; border-radius: 4px;">${escapeHtml(item.category)}</span>
          </td>
          <td style="padding: 10px 12px; font-size: 12px; font-weight: 700; text-align: right; color: #0f172a;">RM ${item.amount.toFixed(2)}</td>
          <td style="padding: 10px 12px; font-size: 11px; font-family: monospace; color: #475569;">receipts/${escapeHtml(item.fileName)}</td>
          <td style="padding: 10px 12px; font-size: 11px; color: #64748b;">${escapeHtml(item.remark || '-')}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Receipts Archive Preview</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; color: #0f172a; background: #ffffff; }
          .header { margin-bottom: 20px; border-bottom: 2px solid #0891b2; padding-bottom: 12px; }
          .title { font-size: 18px; font-weight: 800; color: #0f172a; }
          .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; text-align: left; margin-top: 16px; }
          th { background: #f1f5f9; padding: 10px 12px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Receipts & Invoices Archive (.zip) Preview</div>
          <div class="subtitle">Period: <strong>${escapeHtml(data.period.label)}</strong> | Name: ${escapeHtml(data.userName)}</div>
        </div>

        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
          <div style="background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 8px; padding: 12px 16px; flex: 1;">
            <div style="font-size: 11px; color: #0e7490; font-weight: 700; text-transform: uppercase;">Total Receipts Value</div>
            <div style="font-size: 18px; font-weight: 800; color: #0891b2; margin-top: 4px;">RM ${totalVal.toFixed(2)}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; flex: 1;">
            <div style="font-size: 11px; color: #475569; font-weight: 700; text-transform: uppercase;">Receipt Photos in Archive</div>
            <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px;">${items.length} files</div>
          </div>
        </div>

        <h3 style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px; text-transform: uppercase;">Packaged Receipts & Documents</h3>
        <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Category</th>
                <th style="text-align: right;">Amount</th>
                <th>Archived File Name</th>
                <th>Remark / Document</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #94a3b8;">No receipt photos found in this period.</td></tr>'}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;
}

// ---------------------------------------------------------------------------
// 8. CROSS-PLATFORM FILE SAVE / DOWNLOAD DISPATCHER & SHARING
// ---------------------------------------------------------------------------

function computeByteSize(content: string | Uint8Array): number {
  if (typeof content === 'string') {
    try {
      if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(content).length;
      }
    } catch {}
    return content.length;
  }
  return content.byteLength;
}

export interface SaveExportResult {
  success: boolean;
  uri?: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  error?: string;
}

/**
 * Open native system share dialog so the user can save to Files / Downloads,
 * send via AirDrop / QuickShare / Drive, or open in another application.
 */
export async function shareExportFile(
  uri: string,
  mimeType?: string,
  dialogTitle?: string
): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return false;
    const isAvailable = await Sharing.isAvailableAsync().catch(() => false);
    if (!isAvailable) return false;
    await Sharing.shareAsync(uri, {
      mimeType,
      dialogTitle: dialogTitle || 'Save or Share Financial File',
      UTI: mimeType,
    });
    return true;
  } catch (err) {
    console.warn('Error sharing export file:', err);
    return false;
  }
}

export async function saveOrDownloadExport(
  fileName: string,
  content: string | Uint8Array,
  mimeType: string,
  options?: { autoShare?: boolean; dialogTitle?: string }
): Promise<SaveExportResult> {
  const fileSize = computeByteSize(content);
  try {
    if (Platform.OS === 'web') {
      const blob = new Blob([content as any], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return { success: true, fileName, mimeType, fileSize };
    } else {
      // Mobile / Native: write to app document directory (durable) or cache
      let uri = `file://${fileName}`;
      try {
        let targetDir = Paths.document;
        try {
          if (!targetDir) targetDir = Paths.cache;
        } catch {
          targetDir = Paths.cache;
        }
        const file = new File(targetDir, fileName);
        file.write(content);
        uri = file.uri;
      } catch {
        // Fallback for test / headless environments
        try {
          const fs = require('fs');
          const path = require('path');
          const os = require('os');
          const outPath = path.join(os.tmpdir(), fileName);
          fs.writeFileSync(outPath, content);
          uri = `file://${outPath}`;
        } catch {}
      }

      if (options?.autoShare) {
        await shareExportFile(uri, mimeType, options.dialogTitle);
      }

      return {
        success: true,
        uri,
        fileName,
        mimeType,
        fileSize,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to save export file',
      fileName,
      mimeType,
      fileSize,
    };
  }
}
