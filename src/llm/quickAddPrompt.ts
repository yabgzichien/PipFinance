// src/llm/quickAddPrompt.ts
// Prompt + pure parser for turning one line of typed text into transaction drafts, used only
// when the offline parser in lib/quickParse.ts comes up short. Dependency-free and unit-tested;
// the network call lives in each provider, exactly as categoryGuessPrompt.ts does.
//
// The reply is a JSON OBJECT ({"items":[...]}), not a bare array, because Groq and OpenRouter
// are both called with response_format: { type: 'json_object' }.

import type { QuickDraft } from '../lib/quickParse';
import { ISO_DATE_RE, isValidIsoDate } from '../lib/dates';
import type { TxnType } from '../lib/types';

export interface QuickAddCategoryOption {
  id: string;
  label: string;
  kind: TxnType;
}

export class QuickAddParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuickAddParseError';
  }
}

/** Mirrors MAX_SEGMENTS in lib/quickParse.ts: a model reply cannot outrun the local cap. */
export const MAX_ITEMS = 10;

/** A date this far from today is a hallucination, not an entry. */
const MAX_DATE_DRIFT_DAYS = 400;

export const QUICK_ADD_SYSTEM_PROMPT =
  'You turn one line of a personal finance app user\'s typed text into transaction drafts. ' +
  'The text is terse, e.g. "lunch 9.2" or "grab ride yesterday 12". Extract each transaction\'s ' +
  'short label, positive amount, whether it is an expense or income, its date, its currency, and ' +
  'the single best-fitting category id from the user\'s own list. Use null for anything the text ' +
  'does not say — never guess a category id that is not in the provided list, and never invent an ' +
  'amount that is not in the text. Output ONLY JSON, no prose, no markdown fences.';

function categoryLines(categories: QuickAddCategoryOption[]): string {
  return categories.map((c) => `- ${c.id} (${c.kind}): ${c.label}`).join('\n');
}

/** Build the user prompt for one line of typed text. */
export function buildQuickAddPrompt(
  text: string,
  categories: QuickAddCategoryOption[],
  today: string,
  activeCurrencies: string[]
): string {
  return [
    `Today is ${today}.`,
    `Currencies the user has enabled: ${activeCurrencies.join(', ')}. Use null for anything else.`,
    '',
    'Categories:',
    categoryLines(categories),
    '',
    'User text:',
    text,
    '',
    'Return JSON exactly in this shape:',
    '{"items":[{"label":"<short label>","amount":<number>,"type":"expense"|"income",' +
      '"date":"YYYY-MM-DD"|null,"currency":"<code>"|null,"categoryId":"<id>"|null}]}',
  ].join('\n');
}

function stripFence(s: string): string {
  return s
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ms = Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd);
  return Math.abs(ms) / 86400000;
}

/**
 * Validate the model's reply into drafts. Every field is checked rather than trusted:
 * an unknown or kind-mismatched category becomes null, an unusable amount drops the whole
 * item, an inactive currency becomes null, and an invalid or far-off date becomes null.
 * Throws QuickAddParseError only when the reply is not a JSON object holding an items array.
 */
export function parseQuickAddReply(
  content: string,
  categories: QuickAddCategoryOption[],
  activeCurrencies: string[],
  today: string
): QuickDraft[] {
  let obj: unknown;
  try {
    obj = JSON.parse(stripFence(content));
  } catch {
    throw new QuickAddParseError('Model reply was not valid JSON.');
  }
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new QuickAddParseError('Model reply was not a JSON object.');
  }
  const items = (obj as Record<string, unknown>).items;
  if (!Array.isArray(items)) {
    throw new QuickAddParseError('Model reply had no items array.');
  }

  const active = new Set(activeCurrencies.map((c) => c.toUpperCase()));
  const out: QuickDraft[] = [];

  for (const raw of items.slice(0, MAX_ITEMS)) {
    if (raw === null || typeof raw !== 'object') continue;
    const it = raw as Record<string, unknown>;

    const amount = typeof it.amount === 'number' ? it.amount : NaN;
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const type: TxnType = it.type === 'income' ? 'income' : 'expense';

    const cat = typeof it.categoryId === 'string' ? categories.find((c) => c.id === it.categoryId) : undefined;
    const categoryId = cat && cat.kind === type ? cat.id : null;

    const rawCurrency = typeof it.currency === 'string' ? it.currency.toUpperCase() : null;
    const currency = rawCurrency && active.has(rawCurrency) ? rawCurrency : null;

    const rawDate = typeof it.date === 'string' ? it.date : null;
    const date =
      rawDate && ISO_DATE_RE.test(rawDate) && isValidIsoDate(rawDate) && daysBetween(rawDate, today) <= MAX_DATE_DRIFT_DAYS
        ? rawDate
        : null;

    out.push({
      label: typeof it.label === 'string' ? it.label.trim() : '',
      amount,
      type,
      date,
      currency,
      categoryId,
    });
  }

  return out;
}
