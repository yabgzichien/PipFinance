# Quick Add (Natural-Language Entry) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user type `lunch 9.2` on the add hub and land on a pre-filled confirm screen with the amount, merchant, type, date and category already set.

**Architecture:** A pure offline parser (`parseQuickText`) runs first and always, feeding labels to the existing learned merchant→category memory. An LLM is called only when that comes up short, and its answer is then overridden by memory wherever memory has a hit. One parsed item routes to `ManualEntryScreen`; two or more route to the existing `CategorizeScreen`. Every LLM failure falls back to the local result.

**Tech Stack:** TypeScript, React Native (Expo 54), Jest (`jest-expo` preset), expo-sqlite. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-28-quick-add-nl-design.md`

## Global Constraints

- **No new dependencies.** Everything here uses what is already in `package.json`.
- **There is no component-testing library in this repo.** `@testing-library/react-native` is not installed. Every existing test covers pure logic in `src/lib/` or `src/llm/`. Do NOT add render tests. UI tasks are verified with `npx tsc --noEmit`, the full Jest suite, and a manual smoke test.
- **Test command:** `npx jest <path>` for one file, `npm test` for all. **Typecheck:** `npm run typecheck`.
- **`src/lib/*` must stay dependency-free of React and of the database.** Pure functions only, so they are unit-testable. The screen layer passes state in.
- **New user-facing strings go through `t()`** with keys added to all three of `src/i18n/types.ts`, `src/i18n/translations/en.ts`, and `src/i18n/translations/zh.ts`. `__tests__/i18n.test.ts` asserts key parity and non-empty Chinese values; a key missing from either file fails the suite.
- **`BASE_CURRENCY` is `'MYR'`** (`src/lib/currencies.ts`).
- **`ExtractedTxn.currency` is a required `string`**, where `'MYR'` means a plain base-currency row. It is never `null`.
- **`TxnType` is `'expense' | 'income' | 'transfer'`.** Quick add only ever produces `'expense'` or `'income'`.
- **Never invent a category id.** Any id not present in the user's own category list, or whose `kind` contradicts the item's type, resolves to `null`. This mirrors `parseCategoryGuess` in `src/llm/categoryGuessPrompt.ts`.
- **Groq and OpenRouter send `response_format: { type: 'json_object' }`**, so the model reply must be a JSON **object**. The quick-add reply shape is `{"items": [...]}`, never a bare array.
- **Commit after every task.** Message prefix `feat:`, `test:`, or `docs:` matching the existing log.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `src/lib/quickParse.ts` | Pure offline text → `QuickDraft[]`. Owns the `QuickDraft` type. No React, no DB, no network. |
| `src/lib/quickAdd.ts` | Orchestration: local parse → memory → conditional LLM → memory again. Takes its LLM and memory as injected deps so it is testable without either. |
| `src/llm/quickAddPrompt.ts` | System prompt, user-prompt builder, and reply validator. Pure; the network call lives in each provider. |
| `src/components/QuickAddField.tsx` | The single-line input, its submit affordance, and its busy/error states. |
| `__tests__/quickParse.test.ts` | Local parser. |
| `__tests__/quickAdd.test.ts` | Orchestration, including LLM failure and timeout. |
| `__tests__/quickAddPrompt.test.ts` | Prompt contents and reply validation. |

**Modified:**

| File | Change |
|---|---|
| `src/llm/types.ts` | `QuickAddInput`; `quickAdd?` on `LLMProvider`. |
| `src/llm/fallback.ts` | `'quickAdd'` in `Capability`; a `quickAdd` passthrough. |
| `src/llm/groq.ts`, `src/llm/openrouter.ts` | Implement `quickAdd`. Gemini deliberately does not. |
| `src/screens/ManualEntryScreen.tsx` | Three new optional prefill props. |
| `src/screens/AttachScreen.tsx` | Render the field; new props; rewrite the privacy caption. |
| `src/screens/AddFlow.tsx` | `'quickparse'` phase, handler, routing, batch provenance. |
| `src/i18n/types.ts`, `translations/en.ts`, `translations/zh.ts` | New strings. |
| `__tests__/groq.test.ts`, `__tests__/openrouter.test.ts`, `__tests__/fallback.test.ts` | Cover the new capability. |

Tasks 1–4 are pure logic and fully testable. Tasks 5–8 are UI and are typecheck-plus-smoke verified. Tasks 1, 2 and 5 are independent of each other; 3 depends on 2; 4 depends on 1 and 3; 8 depends on everything.

---

### Task 1: The local parser

**Files:**
- Create: `src/lib/quickParse.ts`
- Test: `__tests__/quickParse.test.ts`

**Interfaces:**
- Consumes: `TxnType` from `src/lib/types`, `BASE_CURRENCY` from `src/lib/currencies`.
- Produces:
  - `interface QuickDraft { label: string; amount: number; type: TxnType; date: string | null; currency: string | null; categoryId: string | null }` — **the canonical shape used by Tasks 2, 3, 4, 7 and 8.**
  - `interface QuickParseResult { drafts: QuickDraft[]; confident: boolean }`
  - `interface QuickParseOptions { activeCurrencies: string[]; today: string }`
  - `function parseQuickText(text: string, opts: QuickParseOptions): QuickParseResult`
  - `const MAX_SEGMENTS = 10`

- [ ] **Step 1: Write the failing test**

Create `__tests__/quickParse.test.ts`:

```ts
import { MAX_SEGMENTS, parseQuickText, type QuickParseOptions } from '../src/lib/quickParse';

const opts: QuickParseOptions = { activeCurrencies: ['MYR', 'USD'], today: '2026-08-28' };

describe('parseQuickText — amounts', () => {
  it('reads a plain decimal and keeps the label', () => {
    const r = parseQuickText('lunch 9.2', opts);
    expect(r.drafts).toHaveLength(1);
    expect(r.drafts[0].amount).toBe(9.2);
    expect(r.drafts[0].label).toBe('lunch');
    expect(r.confident).toBe(true);
  });

  it('reads a leading amount', () => {
    expect(parseQuickText('9.20 lunch', opts).drafts[0]).toMatchObject({ amount: 9.2, label: 'lunch' });
  });

  it('strips an rm prefix from the amount and the label', () => {
    expect(parseQuickText('rm9.20 lunch', opts).drafts[0]).toMatchObject({ amount: 9.2, label: 'lunch' });
  });

  it('strips a currency symbol without inferring a currency from it', () => {
    const d = parseQuickText('$20 dinner', opts).drafts[0];
    expect(d.amount).toBe(20);
    expect(d.label).toBe('dinner');
    expect(d.currency).toBeNull();
  });

  it('treats a comma before two digits as a decimal point', () => {
    expect(parseQuickText('lunch 12,50', opts).drafts[0].amount).toBe(12.5);
  });

  it('treats a comma before three digits as a thousands separator', () => {
    expect(parseQuickText('rent 1,200', opts).drafts[0].amount).toBe(1200);
    expect(parseQuickText('rent 1,200.50', opts).drafts[0].amount).toBe(1200.5);
  });

  it('returns no drafts when there is no amount at all', () => {
    expect(parseQuickText('lunch', opts).drafts).toEqual([]);
  });

  it('is not confident when a segment holds two amounts', () => {
    expect(parseQuickText('lunch 9.2 and 4', opts).confident).toBe(false);
  });

  it('is not confident when the label is empty', () => {
    const r = parseQuickText('9.2', opts);
    expect(r.drafts).toHaveLength(1);
    expect(r.drafts[0].label).toBe('');
    expect(r.confident).toBe(false);
  });
});

describe('parseQuickText — type', () => {
  it('defaults to expense', () => {
    expect(parseQuickText('lunch 9.2', opts).drafts[0].type).toBe('expense');
  });

  it('flips to income on an English keyword', () => {
    expect(parseQuickText('salary 4200', opts).drafts[0].type).toBe('income');
    expect(parseQuickText('refund 30', opts).drafts[0].type).toBe('income');
  });

  it('flips to income on a Chinese keyword', () => {
    expect(parseQuickText('工资 4200', opts).drafts[0].type).toBe('income');
  });
});

describe('parseQuickText — currency', () => {
  it('reads an active 3-letter code and drops it from the label', () => {
    const d = parseQuickText('usd 20 dinner', opts).drafts[0];
    expect(d.currency).toBe('USD');
    expect(d.label).toBe('dinner');
  });

  it('ignores a code the user has not activated', () => {
    const d = parseQuickText('jpy 900 ramen', opts).drafts[0];
    expect(d.currency).toBeNull();
  });

  it('reads rm as the base currency', () => {
    expect(parseQuickText('rm 9.20 lunch', opts).drafts[0].currency).toBe('MYR');
  });
});

describe('parseQuickText — dates', () => {
  it('leaves date null when nothing is said', () => {
    expect(parseQuickText('lunch 9.2', opts).drafts[0].date).toBeNull();
  });

  it('reads yesterday and drops it from the label', () => {
    const d = parseQuickText('lunch 9.2 yesterday', opts).drafts[0];
    expect(d.date).toBe('2026-08-27');
    expect(d.label).toBe('lunch');
  });

  it('reads today', () => {
    expect(parseQuickText('lunch 9.2 today', opts).drafts[0].date).toBe('2026-08-28');
  });

  it('reads Chinese date words', () => {
    expect(parseQuickText('午餐 9.2 昨天', opts).drafts[0].date).toBe('2026-08-27');
    expect(parseQuickText('午餐 9.2 今天', opts).drafts[0].date).toBe('2026-08-28');
  });

  it('reads a weekday name as the most recent past occurrence', () => {
    // 2026-08-28 is a Friday; the most recent Wednesday before it is 2026-08-26.
    expect(parseQuickText('lunch 9.2 wednesday', opts).drafts[0].date).toBe('2026-08-26');
  });

  it('treats a weekday naming today as today', () => {
    expect(parseQuickText('lunch 9.2 friday', opts).drafts[0].date).toBe('2026-08-28');
  });
});

describe('parseQuickText — segments', () => {
  it('splits on commas', () => {
    const r = parseQuickText('lunch 9.2, grab 12, coffee 5', opts);
    expect(r.drafts.map((d) => d.label)).toEqual(['lunch', 'grab', 'coffee']);
    expect(r.drafts.map((d) => d.amount)).toEqual([9.2, 12, 5]);
  });

  it('splits on semicolons, newlines, and Chinese punctuation', () => {
    expect(parseQuickText('lunch 9.2; grab 12', opts).drafts).toHaveLength(2);
    expect(parseQuickText('lunch 9.2\ngrab 12', opts).drafts).toHaveLength(2);
    expect(parseQuickText('午餐 9.2、打车 12', opts).drafts).toHaveLength(2);
  });

  it('does not split a decimal comma into two segments', () => {
    expect(parseQuickText('lunch 12,50', opts).drafts).toHaveLength(1);
  });

  it('caps the number of segments', () => {
    const many = Array.from({ length: MAX_SEGMENTS + 5 }, (_, i) => `item${i} ${i + 1}`).join(', ');
    expect(parseQuickText(many, opts).drafts).toHaveLength(MAX_SEGMENTS);
  });

  it('returns an empty, confident-free result for blank input', () => {
    expect(parseQuickText('   ', opts)).toEqual({ drafts: [], confident: false });
  });

  it('always leaves categoryId null — this parser never categorises', () => {
    expect(parseQuickText('lunch 9.2', opts).drafts[0].categoryId).toBeNull();
  });
});
```

Note the decimal-comma case: `lunch 12,50` must stay one segment, so segment splitting has to run **after** protecting a comma that sits between digits.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/quickParse.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/quickParse'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/quickParse.ts`:

```ts
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
const COMMA_SENTINEL = ' ';

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

  // --- amount. Every remaining number is a candidate; more than one means "not confident".
  const numbers = rest.match(/\d+(?:[.,]\d+)*/g) ?? [];
  if (numbers.length === 0) return { draft: null, confident: false };
  const amount = toNumber(numbers[0]);
  if (!Number.isFinite(amount) || amount <= 0) return { draft: null, confident: false };
  rest = rest.replace(numbers[0], ' ');

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/quickParse.test.ts`
Expected: PASS, all cases.

If the weekday loop misfires on a label containing e.g. "sat" inside another word, the `\b` anchors should already prevent it — confirm the `'lunch 9.2'` cases still produce `date: null`.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/lib/quickParse.ts __tests__/quickParse.test.ts
git commit -m "feat: offline natural-language parser for quick add"
```

---

### Task 2: The prompt and the reply validator

**Files:**
- Create: `src/llm/quickAddPrompt.ts`
- Test: `__tests__/quickAddPrompt.test.ts`

**Interfaces:**
- Consumes: `QuickDraft` from `src/lib/quickParse` (Task 1), `TxnType` from `src/lib/types`.
- Produces:
  - `interface QuickAddCategoryOption { id: string; label: string; kind: TxnType }`
  - `const QUICK_ADD_SYSTEM_PROMPT: string`
  - `function buildQuickAddPrompt(text: string, categories: QuickAddCategoryOption[], today: string, activeCurrencies: string[]): string`
  - `function parseQuickAddReply(content: string, categories: QuickAddCategoryOption[], activeCurrencies: string[], today: string): QuickDraft[]`
  - `class QuickAddParseError extends Error`
  - `const MAX_ITEMS = 10`

This mirrors `src/llm/categoryGuessPrompt.ts` exactly — read that file first; this is the same pattern with a different payload.

- [ ] **Step 1: Write the failing test**

Create `__tests__/quickAddPrompt.test.ts`:

```ts
import {
  buildQuickAddPrompt,
  parseQuickAddReply,
  QUICK_ADD_SYSTEM_PROMPT,
  QuickAddParseError,
  type QuickAddCategoryOption,
} from '../src/llm/quickAddPrompt';

const categories: QuickAddCategoryOption[] = [
  { id: 'food', label: 'Food', kind: 'expense' },
  { id: 'transport', label: 'Transport', kind: 'expense' },
  { id: 'salary', label: 'Salary', kind: 'income' },
];
const active = ['MYR', 'USD'];
const today = '2026-08-28';

const reply = (items: unknown) => JSON.stringify({ items });

describe('buildQuickAddPrompt', () => {
  it('includes the raw text, every category id and label, today, and the active currencies', () => {
    const p = buildQuickAddPrompt('lunch 9.2', categories, today, active);
    expect(p).toContain('lunch 9.2');
    expect(p).toContain('food');
    expect(p).toContain('Food');
    expect(p).toContain('salary');
    expect(p).toContain('2026-08-28');
    expect(p).toContain('USD');
  });
});

describe('QUICK_ADD_SYSTEM_PROMPT', () => {
  it('forbids inventing category ids and forbids prose', () => {
    expect(QUICK_ADD_SYSTEM_PROMPT).toMatch(/not in the provided list/i);
    expect(QUICK_ADD_SYSTEM_PROMPT).toMatch(/only json/i);
  });
});

describe('parseQuickAddReply', () => {
  it('reads a well-formed reply', () => {
    const out = parseQuickAddReply(
      reply([{ label: 'lunch', amount: 9.2, type: 'expense', date: null, currency: null, categoryId: 'food' }]),
      categories, active, today
    );
    expect(out).toEqual([
      { label: 'lunch', amount: 9.2, type: 'expense', date: null, currency: null, categoryId: 'food' },
    ]);
  });

  it('tolerates a ```json fenced block', () => {
    const out = parseQuickAddReply(
      '```json\n' + reply([{ label: 'lunch', amount: 9.2, type: 'expense', categoryId: 'food' }]) + '\n```',
      categories, active, today
    );
    expect(out[0].categoryId).toBe('food');
  });

  it('nulls a category id that is not in the list — never invents one', () => {
    const out = parseQuickAddReply(
      reply([{ label: 'x', amount: 5, type: 'expense', categoryId: 'made-up' }]),
      categories, active, today
    );
    expect(out[0].categoryId).toBeNull();
  });

  it('nulls a category whose kind contradicts the item type', () => {
    const out = parseQuickAddReply(
      reply([{ label: 'x', amount: 5, type: 'expense', categoryId: 'salary' }]),
      categories, active, today
    );
    expect(out[0].categoryId).toBeNull();
  });

  it('drops an item with a non-positive, non-finite, or missing amount', () => {
    const out = parseQuickAddReply(
      reply([
        { label: 'a', amount: -5, type: 'expense' },
        { label: 'b', amount: 0, type: 'expense' },
        { label: 'c', type: 'expense' },
        { label: 'd', amount: 'lots', type: 'expense' },
        { label: 'e', amount: 5, type: 'expense' },
      ]),
      categories, active, today
    );
    expect(out.map((d) => d.label)).toEqual(['e']);
  });

  it('falls back to expense for an unknown type', () => {
    const out = parseQuickAddReply(reply([{ label: 'x', amount: 5, type: 'transfer' }]), categories, active, today);
    expect(out[0].type).toBe('expense');
  });

  it('nulls a currency the user has not activated', () => {
    const out = parseQuickAddReply(
      reply([{ label: 'x', amount: 5, type: 'expense', currency: 'JPY' }]),
      categories, active, today
    );
    expect(out[0].currency).toBeNull();
  });

  it('keeps an active currency, uppercased', () => {
    const out = parseQuickAddReply(
      reply([{ label: 'x', amount: 5, type: 'expense', currency: 'usd' }]),
      categories, active, today
    );
    expect(out[0].currency).toBe('USD');
  });

  it('nulls a malformed or absurd date', () => {
    const out = parseQuickAddReply(
      reply([
        { label: 'a', amount: 5, type: 'expense', date: 'last tuesday' },
        { label: 'b', amount: 5, type: 'expense', date: '1998-01-01' },
        { label: 'c', amount: 5, type: 'expense', date: '2026-08-27' },
      ]),
      categories, active, today
    );
    expect(out.map((d) => d.date)).toEqual([null, null, '2026-08-27']);
  });

  it('coerces a non-string label to an empty string', () => {
    const out = parseQuickAddReply(reply([{ label: 42, amount: 5, type: 'expense' }]), categories, active, today);
    expect(out[0].label).toBe('');
  });

  it('caps the number of items', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ label: `i${i}`, amount: 1, type: 'expense' }));
    expect(parseQuickAddReply(reply(many), categories, active, today)).toHaveLength(10);
  });

  it('throws on a reply that is not JSON', () => {
    expect(() => parseQuickAddReply('sure! here you go', categories, active, today)).toThrow(QuickAddParseError);
  });

  it('throws on a JSON reply with no items array', () => {
    expect(() => parseQuickAddReply('{"ok":true}', categories, active, today)).toThrow(QuickAddParseError);
  });

  it('returns an empty array for an empty items array', () => {
    expect(parseQuickAddReply(reply([]), categories, active, today)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/quickAddPrompt.test.ts`
Expected: FAIL — `Cannot find module '../src/llm/quickAddPrompt'`.

- [ ] **Step 3: Write the implementation**

Create `src/llm/quickAddPrompt.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/quickAddPrompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/llm/quickAddPrompt.ts __tests__/quickAddPrompt.test.ts
git commit -m "feat: quick-add prompt builder and reply validator"
```

---

### Task 3: Wire `quickAdd` through the provider layer

**Files:**
- Modify: `src/llm/types.ts`, `src/llm/fallback.ts`, `src/llm/groq.ts`, `src/llm/openrouter.ts`
- Test: `__tests__/groq.test.ts`, `__tests__/openrouter.test.ts`, `__tests__/fallback.test.ts`

**Interfaces:**
- Consumes: everything from Task 2, plus `QuickDraft` from Task 1.
- Produces:
  - `interface QuickAddInput { apiKey: string; model: string; text: string; categories: QuickAddCategoryOption[]; today: string; activeCurrencies: string[] }` in `src/llm/types.ts`
  - `quickAdd?(input: QuickAddInput): Promise<QuickDraft[]>` on `LLMProvider`
  - `'quickAdd'` added to the `Capability` union in `src/llm/fallback.ts`
  - `FallbackProvider.quickAdd(input: Payload<QuickAddInput>): Promise<QuickDraft[]>`

**Gemini deliberately does not implement this**, matching its existing omission of `guessCategories`. `FallbackProvider.legsFor` filters on `typeof provider[cap] === 'function'`, so it routes around Gemini with no special handling. Do not add it.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/groq.test.ts` (reuse the `mockFetchOnce` helper already at the top of that file):

```ts
describe('GroqProvider.quickAdd', () => {
  const cats = [{ id: 'food', label: 'Food', kind: 'expense' as const }];
  const args = { apiKey: 'gsk_test', model: 'qwen/qwen3.6-27b', text: 'lunch 9.2', categories: cats, today: '2026-08-28', activeCurrencies: ['MYR'] };

  it('parses a well-formed reply into drafts', async () => {
    mockFetchOnce({
      json: {
        choices: [{ message: { content: JSON.stringify({ items: [{ label: 'lunch', amount: 9.2, type: 'expense', categoryId: 'food' }] }) } }],
      },
    });
    const out = await GroqProvider.quickAdd!(args);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ label: 'lunch', amount: 9.2, categoryId: 'food' });
  });

  it('raises bad_response when the reply is not JSON', async () => {
    mockFetchOnce({ json: { choices: [{ message: { content: 'sorry, what?' } }] } });
    await expect(GroqProvider.quickAdd!(args)).rejects.toMatchObject({ code: 'bad_response' });
  });

  it('raises bad_response when the message content is missing', async () => {
    mockFetchOnce({ json: { choices: [{}] } });
    await expect(GroqProvider.quickAdd!(args)).rejects.toBeInstanceOf(LLMError);
  });
});
```

Append the identical three cases to `__tests__/openrouter.test.ts`, substituting `OpenRouterProvider` and that file's own mock helper and model id. Repeat the code rather than sharing it — the two provider test files are already independent.

Append to `__tests__/fallback.test.ts`:

```ts
describe('FallbackProvider.quickAdd', () => {
  afterEach(() => jest.restoreAllMocks());

  const cats = [{ id: 'food', label: 'Food', kind: 'expense' as const }];
  const payload = { text: 'lunch 9.2', categories: cats, today: '2026-08-28', activeCurrencies: ['MYR'] };
  const items = JSON.stringify({ items: [{ label: 'lunch', amount: 9.2, type: 'expense', categoryId: 'food' }] });

  it('reports the capability as unavailable with no keys', () => {
    const llm = new FallbackProvider({ ...allKeys, geminiKey: '', groqKey: '', openrouterKey: '' });
    expect(llm.can('quickAdd')).toBe(false);
  });

  it('skips Gemini, which does not implement quickAdd, and uses Groq', async () => {
    routeFetch({ groq: () => ({ json: groqReply(items) }) });
    const out = await new FallbackProvider(allKeys).quickAdd(payload);
    expect(out[0].label).toBe('lunch');
    const calls = (global as any).fetch.mock.calls.map((c: any[]) => String(c[0]));
    expect(calls.some((u: string) => u.includes('generativelanguage'))).toBe(false);
    expect(calls.some((u: string) => u.includes('api.groq.com'))).toBe(true);
  });

  it('falls back to OpenRouter when Groq fails', async () => {
    routeFetch({
      groq: () => ({ status: 500, json: { error: 'boom' } }),
      openrouter: () => ({ json: openrouterReply(items) }),
    });
    const out = await new FallbackProvider(allKeys).quickAdd(payload);
    expect(out[0].amount).toBe(9.2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/groq.test.ts __tests__/openrouter.test.ts __tests__/fallback.test.ts`
Expected: FAIL — `quickAdd` is not a function / not a valid `Capability`.

- [ ] **Step 3: Add the type**

In `src/llm/types.ts`, add the import and interface near `CategoryGuessInput`, and the method on `LLMProvider` next to `guessCategories`:

```ts
import type { QuickDraft } from '../lib/quickParse';
import type { QuickAddCategoryOption } from './quickAddPrompt';

export interface QuickAddInput {
  apiKey: string;
  model: string;
  /** The raw line the user typed. */
  text: string;
  categories: QuickAddCategoryOption[];
  /** ISO date, so relative words in the text can be resolved. */
  today: string;
  activeCurrencies: string[];
}
```

```ts
  /** Turn one line of typed text into transaction drafts, when the offline parser can't. */
  quickAdd?(input: QuickAddInput): Promise<QuickDraft[]>;
```

- [ ] **Step 4: Implement it on Groq**

In `src/llm/groq.ts`, add the imports and a method directly after `guessCategories`:

```ts
  async quickAdd({ apiKey, model, text, categories, today, activeCurrencies }: QuickAddInput): Promise<QuickDraft[]> {
    const body = {
      model: model || DEFAULT_MODEL,
      messages: [
        { role: 'system', content: QUICK_ADD_SYSTEM_PROMPT },
        { role: 'user', content: buildQuickAddPrompt(text, categories, today, activeCurrencies) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    };

    const res = await postChat(body, apiKey);
    let json: any;
    try {
      json = await res.json();
    } catch {
      throw new LLMError('bad_response', 'Response was not JSON.');
    }
    const content: unknown = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new LLMError('bad_response', 'Empty model response.');
    }
    try {
      return parseQuickAddReply(content, categories, activeCurrencies, today);
    } catch (e) {
      if (e instanceof QuickAddParseError) throw new LLMError('bad_response', e.message);
      throw e;
    }
  },
```

- [ ] **Step 5: Implement it on OpenRouter**

Do the same in `src/llm/openrouter.ts`, using that file's own chat-post helper and default model constant. Read its `guessCategories` first and mirror it exactly.

- [ ] **Step 6: Wire the fallback router**

In `src/llm/fallback.ts`, add `'quickAdd'` to the `Capability` union, import `QuickAddInput`, and add the passthrough next to `guessCategories`:

```ts
  quickAdd(input: Payload<QuickAddInput>) {
    return this.run<Awaited<ReturnType<NonNullable<LLMProvider['quickAdd']>>>>('quickAdd', input);
  }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx jest __tests__/groq.test.ts __tests__/openrouter.test.ts __tests__/fallback.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck and commit**

```bash
npm run typecheck
git add src/llm/types.ts src/llm/fallback.ts src/llm/groq.ts src/llm/openrouter.ts __tests__/groq.test.ts __tests__/openrouter.test.ts __tests__/fallback.test.ts
git commit -m "feat: quickAdd capability on Groq, OpenRouter, and the fallback router"
```

---

### Task 4: The orchestrator

**Files:**
- Create: `src/lib/quickAdd.ts`
- Test: `__tests__/quickAdd.test.ts`

**Interfaces:**
- Consumes: `parseQuickText`, `QuickDraft` (Task 1); `QuickAddCategoryOption` (Task 2); `suggestForMerchant` from `src/lib/recommend`; `Category`, `MemoryMap` from `src/lib/types`.
- Produces:
  - `interface QuickAddLLM { can(cap: 'quickAdd'): boolean; quickAdd(input: { text: string; categories: QuickAddCategoryOption[]; today: string; activeCurrencies: string[] }): Promise<QuickDraft[]> }` — structurally satisfied by `FallbackProvider`, declared narrowly so tests can fake it.
  - `interface QuickAddDeps { memory: MemoryMap; categories: Category[]; activeCurrencies: string[]; today: string; llm: QuickAddLLM | null }`
  - `function resolveQuickAdd(text: string, deps: QuickAddDeps, timeoutMs?: number): Promise<QuickDraft[]>`
  - `const QUICK_ADD_TIMEOUT_MS = 12000`

This is where the spec's §3 flow lives. It is a `src/lib` module, not screen code, so the whole decision tree is testable without mounting React.

- [ ] **Step 1: Write the failing test**

Create `__tests__/quickAdd.test.ts`:

```ts
import { resolveQuickAdd, type QuickAddDeps, type QuickAddLLM } from '../src/lib/quickAdd';
import type { Category, MemoryMap } from '../src/lib/types';

const categories: Category[] = [
  { id: 'food', label: 'Food', icon: 'gift', hue: 20, kind: 'expense', isDefault: true },
  { id: 'transport', label: 'Transport', icon: 'gift', hue: 40, kind: 'expense', isDefault: true },
  { id: 'salary', label: 'Salary', icon: 'wallet', hue: 140, kind: 'income', isDefault: true },
];

function deps(over: Partial<QuickAddDeps> = {}): QuickAddDeps {
  return {
    memory: {} as MemoryMap,
    categories,
    activeCurrencies: ['MYR'],
    today: '2026-08-28',
    llm: null,
    ...over,
  };
}

const fakeLLM = (impl: QuickAddLLM['quickAdd']): QuickAddLLM => ({ can: () => true, quickAdd: impl });

describe('resolveQuickAdd — local only', () => {
  it('returns a local draft with no category when memory is empty and there is no LLM', async () => {
    const out = await resolveQuickAdd('lunch 9.2', deps());
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ label: 'lunch', amount: 9.2, categoryId: null });
  });

  it('fills the category from learned memory without any LLM', async () => {
    const out = await resolveQuickAdd('lunch 9.2', deps({ memory: { lunch: 'food' } as MemoryMap }));
    expect(out[0].categoryId).toBe('food');
  });

  it('ignores a memory hit whose category kind contradicts the draft type', async () => {
    const out = await resolveQuickAdd('lunch 9.2', deps({ memory: { lunch: 'salary' } as MemoryMap }));
    expect(out[0].categoryId).toBeNull();
  });

  it('returns nothing for text with no amount', async () => {
    expect(await resolveQuickAdd('lunch', deps())).toEqual([]);
  });
});

describe('resolveQuickAdd — when the LLM is consulted', () => {
  it('is NOT called when the parse was confident and memory covered every draft', async () => {
    const quickAdd = jest.fn();
    await resolveQuickAdd('lunch 9.2', deps({ memory: { lunch: 'food' } as MemoryMap, llm: fakeLLM(quickAdd) }));
    expect(quickAdd).not.toHaveBeenCalled();
  });

  it('IS called when a draft has no category', async () => {
    const quickAdd = jest.fn().mockResolvedValue([
      { label: 'lunch', amount: 9.2, type: 'expense', date: null, currency: null, categoryId: 'food' },
    ]);
    const out = await resolveQuickAdd('lunch 9.2', deps({ llm: fakeLLM(quickAdd) }));
    expect(quickAdd).toHaveBeenCalled();
    expect(out[0].categoryId).toBe('food');
  });

  it('IS called when the parse was not confident, even if memory covered everything', async () => {
    const quickAdd = jest.fn().mockResolvedValue([
      { label: 'lunch', amount: 9.2, type: 'expense', date: null, currency: null, categoryId: 'food' },
    ]);
    await resolveQuickAdd('lunch 9.2 and 4', deps({ memory: { lunch: 'food' } as MemoryMap, llm: fakeLLM(quickAdd) }));
    expect(quickAdd).toHaveBeenCalled();
  });

  it('is not called when the provider reports the capability unavailable', async () => {
    const quickAdd = jest.fn();
    await resolveQuickAdd('lunch 9.2', deps({ llm: { can: () => false, quickAdd } }));
    expect(quickAdd).not.toHaveBeenCalled();
  });
});

describe('resolveQuickAdd — memory outranks the model', () => {
  it('overrides the model category with a learned one', async () => {
    const quickAdd = jest.fn().mockResolvedValue([
      { label: 'lunch', amount: 9.2, type: 'expense', date: null, currency: null, categoryId: 'transport' },
      { label: 'mystery', amount: 4, type: 'expense', date: null, currency: null, categoryId: 'food' },
    ]);
    const out = await resolveQuickAdd('lunch 9.2, mystery 4', deps({ memory: { lunch: 'food' } as MemoryMap, llm: fakeLLM(quickAdd) }));
    expect(out[0].categoryId).toBe('food');      // memory won
    expect(out[1].categoryId).toBe('food');      // model filled the gap
  });
});

describe('resolveQuickAdd — failure is always soft', () => {
  it('falls back to the local result when the LLM rejects', async () => {
    const out = await resolveQuickAdd('lunch 9.2', deps({ llm: fakeLLM(() => Promise.reject(new Error('offline'))) }));
    expect(out).toHaveLength(1);
    expect(out[0].amount).toBe(9.2);
    expect(out[0].categoryId).toBeNull();
  });

  it('falls back to the local result when the LLM hangs past the timeout', async () => {
    const out = await resolveQuickAdd('lunch 9.2', deps({ llm: fakeLLM(() => new Promise(() => {})) }), 10);
    expect(out[0].amount).toBe(9.2);
  });

  it('falls back to the local result when the LLM returns nothing usable', async () => {
    const out = await resolveQuickAdd('lunch 9.2', deps({ llm: fakeLLM(async () => []) }));
    expect(out[0].amount).toBe(9.2);
  });
});
```

The hanging-promise test uses a real 10ms timeout rather than fake timers, so no `jest.useFakeTimers()` is needed.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/quickAdd.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/quickAdd'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/quickAdd.ts`:

```ts
// src/lib/quickAdd.ts
// The quick-add decision tree: offline parse, then learned memory, then — only if that came up
// short — one LLM call, whose answer memory still overrides. Lives in lib/ rather than in the
// screen so the whole tree is unit-testable with a fake provider and no React.

import { parseQuickText, type QuickDraft } from './quickParse';
import { suggestForMerchant } from './recommend';
import type { Category, MemoryMap } from './types';
import type { QuickAddCategoryOption } from '../llm/quickAddPrompt';

/** The slice of FallbackProvider this module needs, declared narrowly so tests can fake it. */
export interface QuickAddLLM {
  can(cap: 'quickAdd'): boolean;
  quickAdd(input: {
    text: string;
    categories: QuickAddCategoryOption[];
    today: string;
    activeCurrencies: string[];
  }): Promise<QuickDraft[]>;
}

export interface QuickAddDeps {
  memory: MemoryMap;
  categories: Category[];
  activeCurrencies: string[];
  /** ISO date, injected so this stays pure. */
  today: string;
  /** Null when no provider is configured. */
  llm: QuickAddLLM | null;
}

export const QUICK_ADD_TIMEOUT_MS = 12000;

/** Bounds an in-flight promise so a hung request can't strand the user. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Quick add timed out.')), ms)),
  ]);
}

/**
 * Fill each draft's category from learned memory, where memory has a hit whose kind matches.
 * A draft that already carries a category keeps it unless memory disagrees — memory wins,
 * mirroring AddFlow.onExtracted, where source 'learned' beats source 'guess'.
 */
function applyMemory(drafts: QuickDraft[], memory: MemoryMap, categories: Category[]): QuickDraft[] {
  return drafts.map((d) => {
    const id = d.label ? suggestForMerchant(memory, d.label) : null;
    const cat = id ? categories.find((c) => c.id === id) : undefined;
    if (cat && cat.kind === d.type) return { ...d, categoryId: cat.id };
    return d;
  });
}

/**
 * Turn typed text into drafts. Always returns something usable: on any LLM failure — no key,
 * offline, timeout, unreadable reply, empty result — the offline result stands.
 */
export async function resolveQuickAdd(
  text: string,
  deps: QuickAddDeps,
  timeoutMs: number = QUICK_ADD_TIMEOUT_MS
): Promise<QuickDraft[]> {
  const { memory, categories, activeCurrencies, today, llm } = deps;

  const local = parseQuickText(text, { activeCurrencies, today });
  const localWithMemory = applyMemory(local.drafts, memory, categories);

  const needsHelp = !local.confident || localWithMemory.some((d) => !d.categoryId);
  if (!needsHelp || !llm || !llm.can('quickAdd')) return localWithMemory;

  try {
    const remote = await withTimeout(
      llm.quickAdd({
        text,
        categories: categories.map((c) => ({ id: c.id, label: c.label, kind: c.kind })),
        today,
        activeCurrencies,
      }),
      timeoutMs
    );
    if (remote.length === 0) return localWithMemory;
    return applyMemory(remote, memory, categories);
  } catch {
    // Enhancement-only, exactly like guessCategories: any failure degrades to what the
    // offline parser already produced, which usually includes the amount.
    return localWithMemory;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/quickAdd.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole suite, typecheck, and commit**

```bash
npm test
npm run typecheck
git add src/lib/quickAdd.ts __tests__/quickAdd.test.ts
git commit -m "feat: quick-add orchestration with memory precedence and soft LLM failure"
```

---

### Task 5: The strings

**Files:**
- Modify: `src/i18n/types.ts`, `src/i18n/translations/en.ts`, `src/i18n/translations/zh.ts`

**Interfaces:**
- Produces: the `t()` keys Tasks 7 and 8 use. Nothing else consumes this task.

`__tests__/i18n.test.ts` already asserts that `en` and `zh` have identical key sets and that every Chinese value is a non-empty string, so this task is verified by the existing suite.

- [ ] **Step 1: Run the parity test to confirm it currently passes**

Run: `npx jest __tests__/i18n.test.ts`
Expected: PASS (baseline).

- [ ] **Step 2: Add the keys to the interface**

In `src/i18n/types.ts`, add to the `Translations` interface:

```ts
  quickAddLabel: string;
  quickAddPlaceholder: string;
  quickAddThinking: string;
  quickAddNoAmount: string;
  quickAddForeignBatch: string;
```

- [ ] **Step 3: Add the English strings**

In `src/i18n/translations/en.ts`:

```ts
  quickAddLabel: 'Just type it',
  quickAddPlaceholder: 'e.g. lunch 9.2',
  quickAddThinking: 'Reading what you typed…',
  quickAddNoAmount: "I couldn't find an amount in that. Try something like “lunch 9.2”.",
  quickAddForeignBatch: 'Quick add handles one foreign-currency entry at a time — these were read as RM.',
```

- [ ] **Step 4: Add the Chinese strings**

In `src/i18n/translations/zh.ts`:

```ts
  quickAddLabel: '直接输入',
  quickAddPlaceholder: '例如：午餐 9.2',
  quickAddThinking: '正在读取您输入的内容…',
  quickAddNoAmount: '没有找到金额，请尝试输入“午餐 9.2”这样的格式。',
  quickAddForeignBatch: '快速记账一次只支持一笔外币交易，这些已按马币记录。',
```

- [ ] **Step 5: Run the parity test and commit**

Run: `npx jest __tests__/i18n.test.ts`
Expected: PASS. A key present in one file but not the other fails here.

```bash
npm run typecheck
git add src/i18n/types.ts src/i18n/translations/en.ts src/i18n/translations/zh.ts
git commit -m "feat(i18n): strings for quick add"
```

---

### Task 6: `ManualEntryScreen` prefill props

**Files:**
- Modify: `src/screens/ManualEntryScreen.tsx`

**Interfaces:**
- Produces: three new optional props consumed by Task 8 —
  - `initialType?: TxnType`
  - `initialDate?: string | null`
  - `initialCategoryId?: string | null`

All three default to today's behavior, so the three existing call sites in `AddFlow.tsx` are unaffected. There is no test for this task — the repo has no component-testing library. It is verified by typecheck plus the Task 8 smoke test.

- [ ] **Step 1: Add the props to the signature**

In the destructured parameter list, alongside `initialCurrency`:

```ts
  initialType = null,
  initialDate = null,
  initialCategoryId = null,
```

and in the type literal, next to the other `initial*` props:

```ts
  /** Prefill from a quick-add parse: the expense/income toggle, the date, and the category.
   *  All null for every other caller, which keeps today's defaults. */
  initialType?: TxnType | null;
  initialDate?: string | null;
  initialCategoryId?: string | null;
```

- [ ] **Step 2: Seed the state from them**

Change three `useState` initialisers:

```ts
  const [dateText, setDateText] = useState(initialDate ?? todayISO());
  const [type, setType] = useState<TxnType>(initialType ?? 'expense');
  const [cat, setCat] = useState<string | null>(initialCategoryId);
```

- [ ] **Step 3: Fix the amount seed for zero-decimal currencies**

The existing initialiser hardcodes two decimals, which renders `JPY 1200.00`. Since this task is already touching the prefill path, correct it:

```ts
  const [amountText, setAmountText] = useState(
    initialAmount ? initialAmount.toFixed(decimalsFor(initialCurrency ?? BASE_CURRENCY)) : ''
  );
```

`decimalsFor` and `BASE_CURRENCY` are already imported in this file.

- [ ] **Step 4: Typecheck and commit**

```bash
npm run typecheck
```

Expected: clean. Confirm no call site broke — the three existing `<ManualEntryScreen>` usages in `AddFlow.tsx` pass none of these props and must still compile.

```bash
git add src/screens/ManualEntryScreen.tsx
git commit -m "feat: type, date, and category prefill props on ManualEntryScreen"
```

---

### Task 7: The `QuickAddField` component

**Files:**
- Create: `src/components/QuickAddField.tsx`

**Interfaces:**
- Consumes: `t()` keys from Task 5; `useAccent`, `useThemeColors`, `useLanguage`; `Icon`, `Eyebrow` from the existing UI kit.
- Produces:

```ts
export function QuickAddField(props: {
  onSubmit: (text: string) => void;
  busy: boolean;
  error: string | null;
}): JSX.Element
```

Its own file because `AttachScreen.tsx` is already 377 lines. No test — no component-testing library in this repo.

- [ ] **Step 1: Write the component**

Create `src/components/QuickAddField.tsx`. Read `src/screens/ManualEntryScreen.tsx`'s `styles.amountRow` and `src/screens/AttachScreen.tsx`'s `MiniButton` first and match their look — bordered surface, `radius.sm`, `uiFont`, theme colors from `useThemeColors()`, accent from `useAccent()`.

```tsx
// src/components/QuickAddField.tsx
// The natural-language entry field on the add hub. Owns only its own text and submit gesture;
// all parsing, routing, and error text come from the parent (AddFlow), which owns the flow.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from './Icon';
import { Caption, Eyebrow } from './ui';
import { useLanguage } from '../i18n';
import { useAccent } from '../state/accent';
import { useThemeColors } from '../state/colorScheme';
import { radius, spacing, uiFont } from '../theme';

export function QuickAddField({
  onSubmit,
  busy,
  error,
}: {
  onSubmit: (text: string) => void;
  /** True while the parent is parsing. Disables submit and swaps the hint for a status line. */
  busy: boolean;
  /** A message from the parent's last attempt, e.g. no amount found. Null when clear. */
  error: string | null;
}) {
  const { t } = useLanguage();
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const [text, setText] = useState('');

  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && !busy;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(trimmed);
  };

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Eyebrow style={{ marginBottom: spacing.sm }}>{t('quickAddLabel')}</Eyebrow>
      <View style={[styles.row, { backgroundColor: colorTheme.surface, borderColor: colorTheme.line }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          returnKeyType="done"
          editable={!busy}
          placeholder={t('quickAddPlaceholder')}
          placeholderTextColor={colorTheme.ink3}
          style={[styles.input, { color: colorTheme.ink }]}
        />
        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          hitSlop={6}
          style={[
            styles.submit,
            { backgroundColor: canSubmit ? theme.accent : colorTheme.surface2 },
          ]}
        >
          <Icon name="check" size={17} color={canSubmit ? '#fff' : colorTheme.ink3} stroke={2.4} />
        </Pressable>
      </View>
      {busy ? (
        <Caption color={colorTheme.ink2} style={styles.hint}>{t('quickAddThinking')}</Caption>
      ) : error ? (
        <Caption color={colorTheme.red} style={styles.hint}>{error}</Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 12 },
  input: { flex: 1, fontFamily: uiFont(600), fontSize: 15, paddingVertical: 12 },
  submit: { width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  hint: { marginTop: 6, marginLeft: 2 },
});
```

If `Caption` does not accept a `color` prop, or `colorTheme.red` does not exist, check `src/components/ui.tsx` and `src/state/colorScheme.ts` and substitute the correct names rather than inventing them.

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
```

Expected: clean.

```bash
git add src/components/QuickAddField.tsx
git commit -m "feat: QuickAddField component"
```

---

### Task 8: Wire the flow

**Files:**
- Modify: `src/screens/AttachScreen.tsx`, `src/screens/AddFlow.tsx`

**Interfaces:**
- Consumes: `QuickAddField` (Task 7), `resolveQuickAdd` / `QuickDraft` (Tasks 4 and 1), the prefill props (Task 6), the strings (Task 5), `getLLM` from `src/llm`.
- Produces: nothing downstream. This is the last task.

- [ ] **Step 1: Add the props to `AttachScreen`**

In `src/screens/AttachScreen.tsx`, add to the destructured props and the type literal:

```ts
  /** Hands the raw typed line to AddFlow, which owns parsing and routing. */
  onQuickAdd: (text: string) => void;
  quickBusy: boolean;
  quickError: string | null;
```

Render the field immediately after the `PipSays` block and before the `{!hasKey && ...}` notice:

```tsx
        <QuickAddField onSubmit={onQuickAdd} busy={quickBusy} error={quickError} />
```

It is rendered unconditionally, including when `hasKey` is false: the offline parser works without a key, so hiding it there would remove a working feature.

- [ ] **Step 2: Rewrite the privacy caption**

The caption near the bottom of `AttachScreen.tsx` currently claims manual entries never leave the device, which stops being true once typed text can reach a provider. Replace both branches:

```tsx
          {isZh
            ? '截图仅发送至您选择的 AI 服务商以提取交易明细。快速输入的文字仅在本机无法识别时才会发送。手动记账数据仅保留在您的设备本地。'
            : 'Screenshots are sent to your chosen AI provider only to read the transactions. Quick-add text is sent only when your device can’t read it locally. Manual entries stay on your device.'}
```

- [ ] **Step 3: Add the quick-add state and handler to `AddFlow`**

In `src/screens/AddFlow.tsx`, add `'quickparse'` to the `Phase` union, pull `memory` and `categories` (already destructured from `useAppData`), and add:

```tsx
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickPrefill, setQuickPrefill] = useState<QuickDraft | null>(null);
  // A quick-add batch was typed, not read off a screenshot, so it must not be saved as
  // 'extracted' — that would mislabel typed rows in the data-confidence weighting.
  const [batchSource, setBatchSource] = useState<TxnSource>('extracted');
```

and the handler:

```tsx
  const onQuickAdd = async (text: string) => {
    setQuickError(null);
    setQuickBusy(true);
    setPhase('quickparse');

    const [llm, active] = await Promise.all([getLLM(), getActiveCurrencies()]);
    const drafts = await resolveQuickAdd(text, {
      memory,
      categories,
      activeCurrencies: active,
      today: todayISO(),
      llm,
    });

    setQuickBusy(false);

    if (drafts.length === 0) {
      setQuickError(t('quickAddNoAmount'));
      setPhase('attach');
      return;
    }

    if (drafts.length === 1) {
      setQuickPrefill(drafts[0]);
      setReceiptResult(null);
      setPhase('manual');
      return;
    }

    // Batch path: CategorizeScreen hardcodes an RM prefix, so a foreign amount would be
    // mislabelled. Force base currency and say so rather than lie about the denomination.
    if (drafts.some((d) => d.currency && d.currency !== BASE_CURRENCY)) {
      setQuickError(t('quickAddForeignBatch'));
    }
    setExtracted(
      drafts.map((d) => ({
        merchant: d.label,
        amount: d.amount,
        type: d.type,
        date: d.date ?? todayISO(),
        method: null,
        remark: null,
        currency: BASE_CURRENCY,
        fxRate: null,
      }))
    );
    setSuggestions(drafts.map((d) => (d.categoryId ? { categoryId: d.categoryId, source: 'guess' } : null)));
    setLearnedThisScan(drafts.map(() => null));
    setLinkId(null);
    setBatchSource('manual');
    setExtractElapsedMs(null);
    setPhase('categorize');
  };
```

`t` comes from `useLanguage()`, which `AddFlow` does not currently import — add it. `getActiveCurrencies` comes from `src/db/currencyRepo`, `todayISO` from `src/lib/duplicates` (already imported), and `BASE_CURRENCY` from `src/lib/currency` (already imported).

`setLearnedThisScan(drafts.map(() => null))` matters: that state feeds the auto-fill competence stat, which is supposed to count only learned-memory hits from a *scan*. A typed batch contributes none.

- [ ] **Step 4: Use the batch provenance when committing**

In `onCategorized`, change the hardcoded source:

```tsx
      const { created, newLearned: learned } = await commitCategorized(items, assignments, batchSource, splitDrafts);
```

Reset it wherever a scan starts, so a quick-add batch can't leak its provenance into a later scan. In `onPicked`, add `setBatchSource('extracted')` next to the other resets.

- [ ] **Step 5: Render the parsing phase**

Add next to the existing `'guessing'` block, reusing its shape:

```tsx
  if (phase === 'quickparse') {
    return (
      <View style={{ flex: 1, backgroundColor: colorTheme.bg, justifyContent: 'center', paddingHorizontal: 18 }}>
        <PipSays expr="think">
          <BubbleText>{t('quickAddThinking')}</BubbleText>
        </PipSays>
      </View>
    );
  }
```

Add `'quickparse'` to the `useBackHandler` fall-through so hardware back closes the flow, exactly as `'guessing'` does — it is already covered by the final `onClose()` branch, so confirm rather than change it.

- [ ] **Step 6: Pass the prefill into `ManualEntryScreen`**

In the `phase === 'manual' || phase === 'split'` block, extend the existing `initial*` props:

```tsx
        initialMerchant={phase === 'split' ? receiptResult?.merchant ?? null : quickPrefill?.label ?? null}
        initialAmount={phase === 'split' ? receiptResult?.charged ?? null : quickPrefill?.amount ?? null}
        initialCurrency={phase === 'split' ? receiptResult?.currency ?? null : quickPrefill?.currency ?? null}
        initialType={quickPrefill?.type ?? null}
        initialDate={quickPrefill?.date ?? null}
        initialCategoryId={quickPrefill?.categoryId ?? null}
```

`ManualEntryScreen` reads these only at mount, so give it a `key` that changes per prefill to force a remount when a second quick add arrives:

```tsx
        key={quickPrefill ? `quick:${quickPrefill.label}:${quickPrefill.amount}` : 'manual'}
```

Clear `quickPrefill` in `backFromManualOrSplit` and at the top of `onManualComplete`, so opening the plain manual form afterwards starts empty.

- [ ] **Step 7: Pass the new props to `AttachScreen`**

```tsx
      <AttachScreen
        hasKey={hasKey}
        onClose={onClose}
        onPicked={onPicked}
        onManual={() => { setQuickPrefill(null); setPhase('manual'); }}
        onQuickAdd={onQuickAdd}
        quickBusy={quickBusy}
        quickError={quickError}
        ...
      />
```

- [ ] **Step 8: Typecheck and run the full suite**

```bash
npm run typecheck
npm test
```

Expected: both clean. Nothing in this task has a unit test; the suite must stay green because nothing it covers changed behavior.

- [ ] **Step 9: Manual smoke test**

Run the app (`npm run android` or `npm run ios`) and confirm, in order:

1. Open the add hub. The field is visible above Scan.
2. Type `lunch 9.2`, submit. Lands on the manual form with amount `9.20`, merchant `lunch`, expense selected, today's date.
3. Save it, then quick-add `lunch 12` again. The category is now pre-selected from learned memory, and it resolves with no visible network wait.
4. Type `lunch 9.2, grab 12, coffee 5`. Lands on `CategorizeScreen` with three rows.
5. Finish that batch, then check the saved rows are `source: 'manual'`, not `'extracted'`.
6. Type `asdf` with no number. Stays on the hub, shows the no-amount message.
7. Turn on airplane mode and quick-add a known merchant. Still works, instantly.
8. Switch the app to Chinese and repeat step 2 with `午餐 9.2`.

- [ ] **Step 10: Commit**

```bash
git add src/screens/AttachScreen.tsx src/screens/AddFlow.tsx
git commit -m "feat: natural-language quick add on the add hub"
```

---

## Self-Review

**Spec coverage.** §1 core principle → Tasks 1 and 4. §2 confirmation model → Tasks 6 and 8. §3 data flow → Task 4. §4 parse scope, confidence, and the foreign-currency batch rule → Tasks 1, 2 and 8 step 3. §5 modules → all tasks; the file table matches. §6 UI surface, including batch provenance → Tasks 6, 7, 8. §7 error handling and the privacy caption → Tasks 2, 4, and 8 step 2. §8 testing → Tasks 1–5.

**Two spec corrections made here and to be applied back to the spec:** the reply is a JSON object `{"items":[...]}` rather than a bare array, because Groq and OpenRouter both send `response_format: { type: 'json_object' }`; and `CurrencyMeta` carries no symbol field, so only `RM` and 3-letter codes infer a currency while other symbols are merely stripped from the label.

**Known gap, accepted:** Tasks 6, 7 and 8 have no automated tests. The repo has no component-testing library and every existing test covers pure logic, so adding render tests would mean adding a dependency the spec rules out. The decision tree those tasks depend on is fully covered by Task 4; what is untested is the wiring, which the step 9 smoke test covers manually.
