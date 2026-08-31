// src/lib/advancedImport.ts
// Pure, deterministic helpers for advanced prompt-based LLM import.
// No UI / database / file-system imports — everything here is unit-tested.

import { BASE_CURRENCY, normalizeCurrency } from './currency';
import { ACCOUNT_CLASSES } from './networth';
import { todayISO } from './duplicates';
import type { ExtractedTxn } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildPrompt(defaultCurrency: string = BASE_CURRENCY): string {
  return `Parse every transaction AND every account balance from the uploaded file(s) into JSON. Files may be bank statements, e-wallet exports, investment reports, loan statements, Google Sheets, Excel, CSV, or any financial record.

──────────────────────────────────────
SECTION 1 — TRANSACTIONS
──────────────────────────────────────
For each transaction row found, output:
- date: YYYY-MM-DD
- description: merchant / payee name if available (clean name, remove codes, reference numbers, trailing digits), OR null if no merchant name is present (e.g. exports from personal finance apps / trackers that only record categories).
- amount: NEGATIVE for expenses / debits, POSITIVE for income / credits
- currency: 3-letter ISO code (e.g. "MYR", "USD", "SGD", "CNY", "JPY", "EUR", "GBP", etc.) read from the currency symbol, column, or statement header — use "${defaultCurrency}" if not stated
- category: describe the category freely based on what you actually see in the document.
    • If the document / tracker already labels a category, ALWAYS preserve and use that label.
    • Use plain English (e.g. "restaurant", "groceries", "petrol", "salary", "online shopping", "electricity bill").
    • If you genuinely cannot tell, write "?".
    • NEVER invent or guess a category when there is no evidence in the document.
- account: specific account name as printed on the document (e.g. "Maybank Savings", "Touch 'n Go eWallet"), or "Unknown" if not stated.

Skip ONLY: running balance lines, statement totals, opening/closing balances, disclosures, headers/footers.

MATRIX / SUMMARY TABLES
Many trackers keep an overview tab laid out as a grid, where each ROW is a category and each COLUMN is a month (e.g. rows "Allowance", "Salary", "Other Income", "Rental", "Insurance", "Car Installment", "Phone Bill", "Electricity"; columns "Jan" … "Dec"). This data is REAL and is usually recorded nowhere else, so read these tabs too, not only the row-per-transaction journals.
- Emit one transaction per filled month cell, dated the last day of that month.
- Use the ROW label as the category, and the ROW label as the description.
- Income rows (allowance, salary, scholarship, loan disbursement, angpao, claims, refunds) are POSITIVE. Cost rows are NEGATIVE.
- SKIP: any budget / target column (often the first numeric column, headed "Budget" or "Monthly Budget"), every "Total" / "Net" row and column, and any cell showing a spreadsheet error such as #REF! or #DIV/0!.
- Treat a blank cell, "-", or 0 as no transaction. Do not emit a row for it.
- NEVER double count. If a category is already itemised row-by-row on a monthly journal tab, do NOT also emit that category's cells from the summary tab. Emit summary cells ONLY for categories that appear nowhere in the journals.

──────────────────────────────────────
SECTION 2 — ACCOUNT BALANCES
──────────────────────────────────────
For each distinct account / holding in the file(s), output one entry:
- name: account name as shown in the document
- type: one of → "Cash", "Investments", "Mortgage", "Personal Loan", "Credit Card", "Pay Later", "Car Loan"
- balance: current balance as a POSITIVE number (outstanding amount for loans/cards)
- currency: 3-letter code (e.g. "MYR", "USD", "SGD", "CNY", "JPY", "EUR", "GBP", etc.) — use "${defaultCurrency}" if not stated
- as_of: YYYY-MM-DD date of the balance reading, or the statement end date
- notes: ticker symbol for investments (e.g. "AAPL", "BTC"), or null

──────────────────────────────────────
REPLY FORMAT — ONLY a JSON code block, no other text:
──────────────────────────────────────

\`\`\`json
{
  "statement": {
    "issuer": "<institution name or 'Multiple'>",
    "period": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }
  },
  "transactions": [
    { "date": "YYYY-MM-DD", "description": "...", "amount": -0.00, "currency": "${defaultCurrency}", "category": "...", "account": "..." }
  ],
  "accounts": [
    { "name": "...", "type": "Cash", "balance": 0.00, "currency": "${defaultCurrency}", "as_of": "YYYY-MM-DD", "notes": null }
  ]
}
\`\`\`

## Rules
- NEVER fabricate or hallucinate. Only output what is in the document.
- NEVER skip, truncate, or omit transactions. Read every page of every file. Output every single row.
- If importing from an existing financial tracker or spreadsheet where transactions have categories but no merchant / payee, leave description as null and capture the category label accurately.
- If multiple files are uploaded, process each fully then merge into the single arrays.
- If the statement spans a year boundary and only shows month/day, infer the year from the statement period.
- Do not ask questions, do not refuse, do not offer to split into multiple responses.
- If your output gets cut off, stop mid-JSON and I will reply 'continue' so you can finish. Do not stop early.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types for the parsed LLM output
// ─────────────────────────────────────────────────────────────────────────────

interface LLMTxn {
  id?: unknown;
  date?: unknown;
  description?: unknown;
  amount?: unknown;
  currency?: unknown;
  category?: unknown;
  account?: unknown;
  remark?: unknown;
  source?: unknown;
  nativeAmount?: unknown;
  fxRate?: unknown;
  createdAt?: unknown;
}

interface LLMAccount {
  name?: unknown;
  type?: unknown;
  cls?: unknown;
  kind?: unknown;
  balance?: unknown;
  currency?: unknown;
  as_of?: unknown;
  notes?: unknown;
  quantity?: unknown;
  cost?: unknown;
  interestRate?: unknown;
  sub?: unknown;
  symbol?: unknown;
  ticker?: unknown;
  icon?: unknown;
  archived?: unknown;
  history?: unknown;
}

interface LLMTransfer {
  id?: unknown;
  date?: unknown;
  description?: unknown;
  amount?: unknown;
  currency?: unknown;
  account?: unknown;
  createdAt?: unknown;
}

interface LLMOccurrence {
  dueDate?: unknown;
  status?: unknown;
  paidOn?: unknown;
  paidAmount?: unknown;
}

interface LLMCommitment {
  id?: unknown;
  label?: unknown;
  kind?: unknown;
  amount?: unknown;
  currency?: unknown;
  dueDay?: unknown;
  category?: unknown;
  fromAccount?: unknown;
  toAccount?: unknown;
  startMonth?: unknown;
  endMonth?: unknown;
  reliefCode?: unknown;
  archived?: unknown;
  occurrences?: LLMOccurrence[];
}

interface LLMCategory {
  id?: unknown;
  label?: unknown;
  icon?: unknown;
  hue?: unknown;
  kind?: unknown;
  isDefault?: unknown;
}

interface LLMPerson {
  id?: unknown;
  name?: unknown;
  createdAt?: unknown;
}

interface LLMSplitPayment {
  id?: unknown;
  amount?: unknown;
  paidOn?: unknown;
  evidence?: unknown;
  matchedMerchant?: unknown;
  accountId?: unknown;
  createdAt?: unknown;
}

interface LLMSplitShare {
  id?: unknown;
  personId?: unknown;
  personName?: unknown;
  person?: unknown;
  owed?: unknown;
  paid?: unknown;
  status?: unknown;
  writtenOffTxnId?: unknown;
  createdAt?: unknown;
  payments?: LLMSplitPayment[];
}

interface LLMSplit {
  id?: unknown;
  txnId?: unknown;
  gross?: unknown;
  ownShare?: unknown;
  method?: unknown;
  currency?: unknown;
  fxRate?: unknown;
  createdAt?: unknown;
  shares?: LLMSplitShare[];
}

interface LLMBudget {
  expectedIncome?: unknown;
  allocations?: unknown;
  snapshots?: unknown;
  advice?: unknown;
}

interface LLMTaxReliefTag {
  id?: unknown;
  txnId?: unknown;
  code?: unknown;
  ya?: unknown;
  amount?: unknown;
  origin?: unknown;
  createdAt?: unknown;
}

interface LLMTaxRelief {
  tags?: LLMTaxReliefTag[];
  memory?: unknown;
}

interface LLMPreferences {
  activeCurrencies?: unknown;
  settings?: unknown;
  streak?: unknown;
  tasks?: unknown;
  autoFill?: unknown;
}

interface LLMOutput {
  version?: unknown;
  transactions?: LLMTxn[];
  transfers?: LLMTransfer[];
  accounts?: LLMAccount[];
  commitments?: LLMCommitment[];
  categories?: LLMCategory[];
  deletedDefaultCategories?: string[];
  people?: LLMPerson[];
  splits?: LLMSplit[];
  budget?: LLMBudget;
  taxRelief?: LLMTaxRelief;
  merchantMemory?: Record<string, string>;
  preferences?: LLMPreferences;
}

export interface ParsedCategory {
  id: string;
  label: string;
  icon: string;
  hue: number;
  kind: 'expense' | 'income';
  isDefault: boolean;
}

export interface ParsedAccountHistory {
  asOf: string;
  value: number;
}

// Parsed account ready to commit to the DB.
export interface ParsedAccount {
  name: string;
  cls: string;       // ACCOUNT_CLASSES id
  clsLabel: string;  // human label
  kind: 'asset' | 'liability';
  balance: number;
  /** 3-letter code from the prompt's own "currency" field (SECTION 2), normalised so it is
   *  never a bad/unrecognised code. */
  currency: string;
  asOf: string;
  notes: string | null;
  include: boolean;
  /** Cost basis / units, present only on a version-2 export. Cosmetic until the account also
   *  carries a live-priced symbol (added separately, in Net Worth) — see isHolding() in
   *  lib/prices.ts, which requires both. */
  quantity: number | null;
  cost: number | null;
  interestRate?: number | null;
  sub?: string | null;
  symbol?: string | null;
  ticker?: string | null;
  icon?: string | null;
  archived?: boolean;
  history?: ParsedAccountHistory[];
}

/** A DCA/transfer contribution: neither income nor an expense (see TxnType in lib/types.ts),
 *  so it is kept out of the `transactions` array entirely rather than encoded by sign. */
export interface ParsedTransfer {
  date: string | null;
  description: string;
  amount: number; // always positive
  account: string | null;
  currency: string;
}

export interface ParsedCommitmentOccurrence {
  dueDate: string;
  status: 'scheduled' | 'paid' | 'late' | 'skipped';
  paidOn: string | null;
  paidAmount: number | null;
}

// A recurring commitment ready to commit to the DB, account/category names unresolved (the
// store resolves them against the live categories/accounts list at import time).
export interface ParsedCommitment {
  label: string;
  kind: 'expense' | 'investment';
  amount: number;
  currency: string;
  dueDay: number;
  category: string | null;
  fromAccount: string | null;
  toAccount: string | null;
  startMonth: string;
  endMonth: string | null;
  occurrences: ParsedCommitmentOccurrence[];
}

export interface ParsedPerson {
  id: string;
  name: string;
  createdAt?: string;
}

export interface ParsedSplitPayment {
  id?: string;
  amount: number;
  paidOn: string;
  evidence: 'matched' | 'declared';
  matchedMerchant?: string | null;
  accountId?: string | null;
  createdAt?: string;
}

export interface ParsedSplitShare {
  id?: string;
  personId?: string;
  personName?: string | null;
  owed: number;
  paid: number;
  status: 'open' | 'settled' | 'written_off';
  writtenOffTxnId?: string | null;
  createdAt?: string;
  payments?: ParsedSplitPayment[];
}

export interface ParsedSplit {
  id?: string;
  txnId?: string;
  gross: number;
  ownShare: number;
  method: 'equal' | 'shares' | 'exact' | 'itemized';
  currency: string;
  fxRate?: number | null;
  createdAt?: string;
  shares: ParsedSplitShare[];
}

export interface ParsedBudget {
  expectedIncome: number;
  allocations: Record<string, number>;
  snapshots?: Record<string, { income: number; allocations: Record<string, number> }>;
  advice?: { hash: string; text: string } | null;
}

export interface ParsedTaxReliefTag {
  id?: string;
  txnId?: string;
  code: string;
  ya: number;
  amount: number;
  origin: 'auto' | 'commitment' | 'manual';
  createdAt?: string;
}

export interface ParsedTaxRelief {
  tags: ParsedTaxReliefTag[];
  memory: Record<string, string>;
}

export interface ParsedAppPreferences {
  activeCurrencies?: string[];
  settings?: Record<string, unknown>;
  streak?: Record<string, unknown>;
  tasks?: Record<string, unknown>;
  autoFill?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPE → cls mapping
// ─────────────────────────────────────────────────────────────────────────────

export const TYPE_TO_CLS: Record<string, string> = {
  cash: 'cash',
  investments: 'investments',
  investment: 'investments',
  mortgage: 'mortgage',
  'personal loan': 'personal',
  personal: 'personal',
  'credit card': 'credit_card',
  creditcard: 'credit_card',
  'pay later': 'pay_later',
  paylater: 'pay_later',
  'car loan': 'car',
  car: 'car',
};

export function resolveClsId(rawType: string): string {
  const key = rawType.toLowerCase().trim();
  return TYPE_TO_CLS[key] ?? 'cash'; // default to cash if unknown
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON parser
// ─────────────────────────────────────────────────────────────────────────────

export interface ParseResult {
  version?: number;
  transactions: ExtractedTxn[];
  accounts: ParsedAccount[];
  transfers: ParsedTransfer[];
  commitments: ParsedCommitment[];
  categories?: ParsedCategory[];
  deletedDefaultCategories?: string[];
  people?: ParsedPerson[];
  splits?: ParsedSplit[];
  budget?: ParsedBudget | null;
  taxRelief?: ParsedTaxRelief | null;
  merchantMemory?: Record<string, string>;
  preferences?: ParsedAppPreferences | null;
}

const OCCURRENCE_STATUSES = new Set(['scheduled', 'paid', 'late', 'skipped']);
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

export function parseJSON(raw: string, defaultCurrency: string = BASE_CURRENCY): ParseResult {
  const stripped = raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim();

  const parsed: unknown = JSON.parse(stripped);
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Not a JSON object.');
  const obj = parsed as LLMOutput;
  const version = typeof obj.version === 'number' ? obj.version : undefined;

  // ── Transactions ──
  const txnRows = Array.isArray(obj.transactions) ? obj.transactions : [];
  const transactions: ExtractedTxn[] = txnRows.map((r): ExtractedTxn => {
    const rawAmt = typeof r.amount === 'number' ? r.amount : Number(r.amount ?? 0);
    const absAmt = Math.abs(rawAmt);
    const type = rawAmt >= 0 ? 'income' : 'expense';
    const merchant =
      typeof r.description === 'string' && r.description.trim()
        ? r.description.trim()
        : '';
    const rawDate = typeof r.date === 'string' ? r.date.trim() : '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;
    const categoryHint =
      typeof r.category === 'string' && r.category.trim() && r.category.trim() !== '?'
        ? r.category.trim()
        : null;
    const account =
      typeof r.account === 'string' && r.account.trim() && r.account.trim().toLowerCase() !== 'unknown'
        ? r.account.trim()
        : null;
    const currency = normalizeCurrency(r.currency, defaultCurrency);
    const item: ExtractedTxn = { merchant, amount: absAmt, type, date, method: null, categoryHint, account, currency };
    if (typeof r.remark === 'string' && r.remark.trim()) item.remark = r.remark.trim();
    if (typeof r.source === 'string') item.source = r.source as any;
    if (typeof r.id === 'string' && r.id.trim()) item.id = r.id.trim();
    if (typeof r.nativeAmount === 'number' && Number.isFinite(r.nativeAmount)) item.nativeAmount = r.nativeAmount;
    if (typeof r.fxRate === 'number' && Number.isFinite(r.fxRate)) item.fxRate = r.fxRate;
    if (typeof r.createdAt === 'string' && r.createdAt.trim()) item.createdAt = r.createdAt.trim();
    return item;
  });

  // ── Accounts ──
  const accRows = Array.isArray(obj.accounts) ? obj.accounts : [];
  const today = todayISO();
  const accounts: ParsedAccount[] = accRows.map((r): ParsedAccount => {
    const name =
      typeof r.name === 'string' && r.name.trim() ? r.name.trim() : 'Unnamed Account';
    const clsId = typeof r.cls === 'string' && r.cls.trim()
      ? r.cls.trim()
      : typeof r.type === 'string' ? resolveClsId(r.type) : 'cash';
    const meta = ACCOUNT_CLASSES.find((c) => c.id === clsId) ?? ACCOUNT_CLASSES[0];
    const kind = r.kind === 'liability' || clsId === 'credit_card' || clsId === 'credit_cards' || clsId === 'loans' || clsId === 'personal' || clsId === 'mortgage' || clsId === 'car'
      ? 'liability'
      : (r.kind === 'asset' ? 'asset' : meta.kind);
    const balance = Math.abs(
      typeof r.balance === 'number' ? r.balance : Number(r.balance ?? 0)
    );
    const rawDate = typeof r.as_of === 'string' ? r.as_of.trim() : '';
    const asOf = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;
    const notes =
      typeof r.notes === 'string' && r.notes.trim() ? r.notes.trim() : null;
    const quantity = typeof r.quantity === 'number' && Number.isFinite(r.quantity) ? r.quantity : null;
    const cost = typeof r.cost === 'number' && Number.isFinite(r.cost) ? r.cost : null;
    const interestRate = typeof r.interestRate === 'number' && Number.isFinite(r.interestRate) ? r.interestRate : null;
    const sub = typeof r.sub === 'string' && r.sub.trim() ? r.sub.trim() : null;
    const symbol = typeof r.symbol === 'string' && r.symbol.trim() ? r.symbol.trim() : null;
    const ticker = typeof r.ticker === 'string' && r.ticker.trim() ? r.ticker.trim() : null;
    const icon = typeof r.icon === 'string' && r.icon.trim() ? r.icon.trim() : null;
    const archived = Boolean(r.archived);
    const currency = normalizeCurrency(r.currency, defaultCurrency);

    const rawHistory = Array.isArray(r.history) ? r.history : [];
    const history: ParsedAccountHistory[] = rawHistory
      .map((h: any): ParsedAccountHistory | null => {
        if (!h || typeof h !== 'object') return null;
        const hDate = typeof h.asOf === 'string' && ISO_DATE_ONLY.test(h.asOf.trim())
          ? h.asOf.trim()
          : (typeof h.as_of === 'string' && ISO_DATE_ONLY.test(h.as_of.trim()) ? h.as_of.trim() : null);
        if (!hDate) return null;
        const val = typeof h.value === 'number' ? h.value : Number(h.value ?? 0);
        return { asOf: hDate, value: Math.abs(val) };
      })
      .filter((h): h is ParsedAccountHistory => h !== null);

    return {
      name,
      cls: clsId,
      clsLabel: meta.label,
      kind,
      balance,
      currency,
      asOf,
      notes,
      include: true,
      quantity,
      cost,
      interestRate,
      sub,
      symbol,
      ticker,
      icon,
      archived,
      history: history.length > 0 ? history : undefined,
    };
  });

  // ── Transfers (version 2) ──
  const transferRows = Array.isArray(obj.transfers) ? obj.transfers : [];
  const transfers: ParsedTransfer[] = transferRows.map((r): ParsedTransfer => {
    const amount = Math.abs(typeof r.amount === 'number' ? r.amount : Number(r.amount ?? 0));
    const description =
      typeof r.description === 'string' && r.description.trim() ? r.description.trim() : '';
    const rawDate = typeof r.date === 'string' ? r.date.trim() : '';
    const date = ISO_DATE_ONLY.test(rawDate) ? rawDate : null;
    const account =
      typeof r.account === 'string' && r.account.trim() && r.account.trim().toLowerCase() !== 'unknown'
        ? r.account.trim()
        : null;
    const currency = normalizeCurrency(r.currency, defaultCurrency);
    return { date, description, amount, account, currency };
  });

  // ── Commitments (version 2) ──
  const commitmentRows = Array.isArray(obj.commitments) ? obj.commitments : [];
  const commitments: ParsedCommitment[] = commitmentRows
    .map((r): ParsedCommitment | null => {
      const label = typeof r.label === 'string' && r.label.trim() ? r.label.trim() : '';
      if (!label) return null;
      const kind = r.kind === 'investment' ? 'investment' : 'expense';
      const amount = Math.abs(typeof r.amount === 'number' ? r.amount : Number(r.amount ?? 0));
      const rawDay = typeof r.dueDay === 'number' ? r.dueDay : Number(r.dueDay ?? NaN);
      const dueDay = Number.isFinite(rawDay) ? Math.min(31, Math.max(1, Math.round(rawDay))) : 1;
      const category = typeof r.category === 'string' && r.category.trim() ? r.category.trim() : null;
      const fromAccount = typeof r.fromAccount === 'string' && r.fromAccount.trim() ? r.fromAccount.trim() : null;
      const toAccount = typeof r.toAccount === 'string' && r.toAccount.trim() ? r.toAccount.trim() : null;
      const rawStart = typeof r.startMonth === 'string' ? r.startMonth.trim() : '';
      const startMonth = MONTH_KEY_RE.test(rawStart) ? rawStart : todayISO().slice(0, 7);
      const rawEnd = typeof r.endMonth === 'string' ? r.endMonth.trim() : '';
      const endMonth = MONTH_KEY_RE.test(rawEnd) ? rawEnd : null;
      const currency = normalizeCurrency(r.currency, defaultCurrency);
      const occRows = Array.isArray(r.occurrences) ? r.occurrences : [];
      const occurrences: ParsedCommitmentOccurrence[] = occRows
        .map((o): ParsedCommitmentOccurrence | null => {
          const rawDue = typeof o.dueDate === 'string' ? o.dueDate.trim() : '';
          if (!ISO_DATE_ONLY.test(rawDue)) return null;
          const status = typeof o.status === 'string' && OCCURRENCE_STATUSES.has(o.status) ? (o.status as ParsedCommitmentOccurrence['status']) : 'scheduled';
          const rawPaidOn = typeof o.paidOn === 'string' ? o.paidOn.trim() : '';
          const paidOn = ISO_DATE_ONLY.test(rawPaidOn) ? rawPaidOn : null;
          const paidAmount = typeof o.paidAmount === 'number' && Number.isFinite(o.paidAmount) ? o.paidAmount : null;
          return { dueDate: rawDue, status, paidOn, paidAmount };
        })
        .filter((o): o is ParsedCommitmentOccurrence => o !== null);
      return { label, kind, amount, currency, dueDay, category, fromAccount, toAccount, startMonth, endMonth, occurrences };
    })
    .filter((c): c is ParsedCommitment => c !== null);

  // ── Categories (version 3) ──
  const catRows = Array.isArray(obj.categories) ? obj.categories : [];
  const categories: ParsedCategory[] = catRows
    .map((c): ParsedCategory | null => {
      const id = typeof c.id === 'string' && c.id.trim() ? c.id.trim() : '';
      const label = typeof c.label === 'string' && c.label.trim() ? c.label.trim() : '';
      if (!id || !label) return null;
      return {
        id,
        label,
        icon: typeof c.icon === 'string' ? c.icon : 'grid',
        hue: typeof c.hue === 'number' ? c.hue : 200,
        kind: c.kind === 'income' ? 'income' : 'expense',
        isDefault: Boolean(c.isDefault),
      };
    })
    .filter((c): c is ParsedCategory => c !== null);

  const deletedDefaultCategories = Array.isArray(obj.deletedDefaultCategories)
    ? obj.deletedDefaultCategories.filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
    : undefined;

  // ── People (version 3) ──
  const peopleRows = Array.isArray(obj.people) ? obj.people : [];
  const people: ParsedPerson[] = peopleRows
    .map((p): ParsedPerson | null => {
      const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : '';
      if (!name) return null;
      return {
        id: typeof p.id === 'string' && p.id.trim() ? p.id.trim() : name.toLowerCase(),
        name,
        createdAt: typeof p.createdAt === 'string' ? p.createdAt : undefined,
      };
    })
    .filter((p): p is ParsedPerson => p !== null);

  // ── Splits (version 3) ──
  const splitRows = Array.isArray(obj.splits) ? obj.splits : [];
  const splits: ParsedSplit[] = splitRows
    .map((s): ParsedSplit | null => {
      const gross = Math.abs(typeof s.gross === 'number' ? s.gross : Number(s.gross ?? 0));
      const ownShare = Math.abs(typeof s.ownShare === 'number' ? s.ownShare : Number(s.ownShare ?? 0));
      const method = typeof s.method === 'string' ? (s.method as any) : 'equal';
      const currency = normalizeCurrency(s.currency, defaultCurrency);
      const fxRate = typeof s.fxRate === 'number' && Number.isFinite(s.fxRate) ? s.fxRate : null;
      const sharesRaw = Array.isArray(s.shares) ? s.shares : [];
      const shares: ParsedSplitShare[] = sharesRaw.map((sh): ParsedSplitShare => {
        const owed = Math.abs(typeof sh.owed === 'number' ? sh.owed : Number(sh.owed ?? 0));
        const paid = Math.abs(typeof sh.paid === 'number' ? sh.paid : Number(sh.paid ?? 0));
        const status = sh.status === 'settled' || sh.status === 'written_off' ? sh.status : 'open';
        const paymentsRaw = Array.isArray(sh.payments) ? sh.payments : [];
        const payments: ParsedSplitPayment[] = paymentsRaw.map((pm): ParsedSplitPayment => ({
          id: typeof pm.id === 'string' ? pm.id : undefined,
          amount: Math.abs(typeof pm.amount === 'number' ? pm.amount : Number(pm.amount ?? 0)),
          paidOn: typeof pm.paidOn === 'string' && ISO_DATE_ONLY.test(pm.paidOn.trim()) ? pm.paidOn.trim() : todayISO(),
          evidence: pm.evidence === 'matched' ? 'matched' : 'declared',
          matchedMerchant: typeof pm.matchedMerchant === 'string' ? pm.matchedMerchant : null,
          accountId: typeof pm.accountId === 'string' ? pm.accountId : null,
          createdAt: typeof pm.createdAt === 'string' ? pm.createdAt : undefined,
        }));
        return {
          id: typeof sh.id === 'string' ? sh.id : undefined,
          personId: typeof sh.personId === 'string' ? sh.personId : undefined,
          personName: typeof sh.personName === 'string' ? sh.personName : (typeof sh.person === 'string' ? sh.person : null),
          owed,
          paid,
          status,
          writtenOffTxnId: typeof sh.writtenOffTxnId === 'string' ? sh.writtenOffTxnId : null,
          createdAt: typeof sh.createdAt === 'string' ? sh.createdAt : undefined,
          payments,
        };
      });
      return {
        id: typeof s.id === 'string' ? s.id : undefined,
        txnId: typeof s.txnId === 'string' ? s.txnId : undefined,
        gross,
        ownShare,
        method,
        currency,
        fxRate,
        createdAt: typeof s.createdAt === 'string' ? s.createdAt : undefined,
        shares,
      };
    })
    .filter((s): s is ParsedSplit => s !== null);

  // ── Budget (version 3) ──
  let budget: ParsedBudget | null = null;
  if (obj.budget && typeof obj.budget === 'object') {
    const b = obj.budget;
    const expectedIncome = typeof b.expectedIncome === 'number' ? b.expectedIncome : Number(b.expectedIncome ?? 0);
    const allocations: Record<string, number> = {};
    if (b.allocations && typeof b.allocations === 'object') {
      for (const [k, v] of Object.entries(b.allocations)) {
        const amt = typeof v === 'number' ? v : Number(v ?? 0);
        if (amt > 0) allocations[k] = amt;
      }
    }
    const snapshots: Record<string, { income: number; allocations: Record<string, number> }> = {};
    if (b.snapshots && typeof b.snapshots === 'object') {
      for (const [m, snap] of Object.entries(b.snapshots as Record<string, any>)) {
        if (snap && typeof snap === 'object') {
          const sInc = typeof snap.income === 'number' ? snap.income : Number(snap.income ?? 0);
          const sAlloc: Record<string, number> = {};
          if (snap.allocations && typeof snap.allocations === 'object') {
            for (const [sk, sv] of Object.entries(snap.allocations)) {
              const sAmt = typeof sv === 'number' ? sv : Number(sv ?? 0);
              if (sAmt > 0) sAlloc[sk] = sAmt;
            }
          }
          snapshots[m] = { income: sInc, allocations: sAlloc };
        }
      }
    }
    const advice = b.advice && typeof b.advice === 'object' && typeof (b.advice as any).hash === 'string' && typeof (b.advice as any).text === 'string'
      ? { hash: (b.advice as any).hash, text: (b.advice as any).text }
      : null;
    budget = { expectedIncome, allocations, snapshots, advice };
  }

  // ── Tax Relief (version 3) ──
  let taxRelief: ParsedTaxRelief | null = null;
  if (obj.taxRelief && typeof obj.taxRelief === 'object') {
    const rawTags = Array.isArray(obj.taxRelief.tags) ? obj.taxRelief.tags : [];
    const tags: ParsedTaxReliefTag[] = rawTags
      .map((t): ParsedTaxReliefTag | null => {
        const code = typeof t.code === 'string' ? t.code.trim() : '';
        const ya = typeof t.ya === 'number' ? t.ya : Number(t.ya ?? NaN);
        const amount = typeof t.amount === 'number' ? t.amount : Number(t.amount ?? 0);
        if (!code || !Number.isFinite(ya)) return null;
        return {
          id: typeof t.id === 'string' ? t.id : undefined,
          txnId: typeof t.txnId === 'string' ? t.txnId : undefined,
          code,
          ya,
          amount: Math.abs(amount),
          origin: t.origin === 'manual' || t.origin === 'commitment' ? t.origin : 'auto',
          createdAt: typeof t.createdAt === 'string' ? t.createdAt : undefined,
        };
      })
      .filter((t): t is ParsedTaxReliefTag => t !== null);

    const memory: Record<string, string> = {};
    if (obj.taxRelief.memory && typeof obj.taxRelief.memory === 'object') {
      for (const [k, v] of Object.entries(obj.taxRelief.memory as Record<string, string>)) {
        if (typeof v === 'string') memory[k] = v;
      }
    }
    taxRelief = { tags, memory };
  }

  // ── Merchant Memory (version 3) ──
  const merchantMemory: Record<string, string> = {};
  if (obj.merchantMemory && typeof obj.merchantMemory === 'object') {
    for (const [k, v] of Object.entries(obj.merchantMemory)) {
      if (typeof v === 'string') merchantMemory[k] = v;
    }
  }

  // ── Preferences (version 3) ──
  let preferences: ParsedAppPreferences | null = null;
  if (obj.preferences && typeof obj.preferences === 'object') {
    const p = obj.preferences;
    preferences = {
      activeCurrencies: Array.isArray(p.activeCurrencies) ? p.activeCurrencies.filter((c): c is string => typeof c === 'string') : undefined,
      settings: p.settings && typeof p.settings === 'object' ? (p.settings as Record<string, unknown>) : undefined,
      streak: p.streak && typeof p.streak === 'object' ? (p.streak as Record<string, unknown>) : undefined,
      tasks: p.tasks && typeof p.tasks === 'object' ? (p.tasks as Record<string, unknown>) : undefined,
      autoFill: p.autoFill && typeof p.autoFill === 'object' ? (p.autoFill as Record<string, unknown>) : undefined,
    };
  }

  return {
    version,
    transactions,
    accounts,
    transfers,
    commitments,
    categories: categories.length > 0 ? categories : undefined,
    deletedDefaultCategories,
    people: people.length > 0 ? people : undefined,
    splits: splits.length > 0 ? splits : undefined,
    budget,
    taxRelief,
    merchantMemory: Object.keys(merchantMemory).length > 0 ? merchantMemory : undefined,
    preferences,
  };
}
