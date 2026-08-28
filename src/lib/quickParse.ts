// src/lib/quickParse.ts
// The offline half of quick add. Pure and dependency-free so it can be unit-tested and so it
// keeps working with no API key and no signal — see the spec's core principle: the LLM is an
// enhancement, never a dependency. This parser never categorises; that is the caller's job
// (learned memory first, model second).

import { BASE_CURRENCY } from './currencies';
import type { TxnType } from './types';

export interface QuickDraft {
  label: string;
  amount: number;
  type: TxnType;
  /** ISO date, or null meaning "the caller's today". */
  date: string | null;
  /** 3-letter code, or null meaning base currency. */
  currency: string | null;
  /** Always null out of this parser. */
  categoryId: string | null;
}

export interface QuickParseResult {
  drafts: QuickDraft[];
  /** True only when EVERY segment had exactly one amount and a non-empty label. */
  confident: boolean;
}

export interface QuickParseOptions {
  /** Currencies the user has switched on. A code outside this list is ignored. */
  activeCurrencies: string[];
  /** Today as ISO, injected rather than read from the clock so this stays pure. */
  today: string;
}

/** Stops a pasted paragraph from spawning a hundred drafts. Not a meaningful number. */
export const MAX_SEGMENTS = 10;

const INCOME_WORDS = [
  'salary', 'wage', 'wages', 'refund', 'refunded', 'bonus', 'payout', 'income',
  'reimbursement', 'reimbursed', 'dividend', 'interest', 'allowance',
  '工资', '薪水', '退款', '奖金', '收入', '报销', '津贴', '利息', '分红',
];

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, thurs: 4, friday: 5, fri: 5,
  saturday: 6, sat: 6,
  '星期日': 0, '周日': 0, '星期一': 1, '周一': 1, '星期二': 2, '周二': 2,
  '星期三': 3, '周三': 3, '星期四': 4, '周四': 4, '星期五': 5, '周五': 5,
  '星期六': 6, '周六': 6,
};

/** A comma between digits is a decimal or thousands mark, not a segment break. Swapped for a
 *  sentinel before splitting, then swapped back. */
const COMMA_SENTINEL = '\u0000';

function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function isoWeekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "1,200.50" -> 1200.5 ; "12,50" -> 12.5 ; "1,200" -> 1200 */
function toNumber(token: string): number {
  let t = token.replace(/,(?=\d{3}(?!\d))/g, '');
  t = t.replace(',', '.');
  return parseFloat(t);
}

function splitSegments(text: string): string[] {
  const protectedText = text.replace(/(\d),(\d)/g, `$1${COMMA_SENTINEL}$2`);
  return protectedText
    .split(/[,;\n；，、]+/)
    .map((s) => s.split(COMMA_SENTINEL).join(','))
    .map((s) => s.trim())
    .filter(Boolean);
}

interface SegmentParse {
  draft: QuickDraft | null;
  confident: boolean;
}

function parseSegment(segment: string, opts: QuickParseOptions): SegmentParse {
  let rest = ` ${segment} `;
  const active = new Set(opts.activeCurrencies.map((c) => c.toUpperCase()));

  // --- currency: an active 3-letter code, or a bare "rm" for the base currency.
  let currency: string | null = null;
  rest = rest.replace(/\b([A-Za-z]{3})\b/g, (whole, code: string) => {
    const up = code.toUpperCase();
    if (!currency && active.has(up)) {
      currency = up;
      return ' ';
    }
    return whole;
  });
  // "rm9.20" and "rm 9.20". Only strips the marker; the digits stay for the amount pass.
  rest = rest.replace(/\brm\s*(?=\d)/gi, () => {
    if (!currency && active.has(BASE_CURRENCY)) currency = BASE_CURRENCY;
    return ' ';
  });

  // --- date words.
  let date: string | null = null;
  const dateWord = (re: RegExp, resolve: () => string) => {
    rest = rest.replace(re, () => {
      if (!date) date = resolve();
      return ' ';
    });
  };
  dateWord(/\byesterday\b|昨天|昨日/gi, () => shiftIso(opts.today, -1));
  dateWord(/\btoday\b|今天|今日/gi, () => opts.today);
  for (const [word, target] of Object.entries(WEEKDAYS)) {
    const re = /^[a-z]+$/.test(word)
      ? new RegExp(`\\b${word}\\b`, 'gi')
      : new RegExp(word, 'g');
    dateWord(re, () => {
      const diff = (isoWeekday(opts.today) - target + 7) % 7;
      return shiftIso(opts.today, -diff);
    });
  }

  // --- amount. Every remaining standalone number is a candidate; more than one means "not confident".
  const numbers = rest.match(/\b\d+(?:[.,]\d+)*\b/g) ?? [];
  if (numbers.length === 0 || !numbers[0]) return { draft: null, confident: false };
  const amount = toNumber(numbers[0]);
  if (!Number.isFinite(amount) || amount <= 0) return { draft: null, confident: false };
  rest = rest.replace(/\b\d+(?:[.,]\d+)*\b/, ' ');

  // --- type.
  const lowered = rest.toLowerCase();
  const type: TxnType = INCOME_WORDS.some((w) => lowered.includes(w)) ? 'income' : 'expense';

  // --- label: whatever survives, minus currency symbols and punctuation noise.
  const label = rest
    .replace(/[$€£¥₩฿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    draft: { label, amount, type, date, currency, categoryId: null },
    confident: numbers.length === 1 && label.length > 0,
  };
}

/**
 * Parse typed text into drafts, offline. Returns every segment that yielded an amount;
 * a segment with no amount is dropped entirely rather than guessed at.
 *
 * `confident` is the gate the caller uses to decide whether to spend an LLM call: it is
 * false if any segment was ambiguous, even when every category resolved from memory,
 * because a wrong amount is worse than a wrong category.
 */
export function parseQuickText(text: string, opts: QuickParseOptions): QuickParseResult {
  const segments = splitSegments(text).slice(0, MAX_SEGMENTS);
  const drafts: QuickDraft[] = [];
  let confident = segments.length > 0;
  for (const segment of segments) {
    const { draft, confident: ok } = parseSegment(segment, opts);
    if (draft) drafts.push(draft);
    if (!ok) confident = false;
  }
  return { drafts, confident: confident && drafts.length > 0 };
}
