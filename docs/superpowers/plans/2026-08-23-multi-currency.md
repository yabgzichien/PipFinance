# Multi-currency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a MYR-anchored user enter transactions and hold accounts in a non-MYR currency, rolling everything up into the existing ringgit totals, while staying completely invisible to a Malaysia-only user.

**Architecture:** Flow data (transactions, splits, commitments) freezes its FX rate at entry and stores a canonical MYR `amount` alongside the native figure, so no existing aggregation changes. Stock data (account balances) stays native and converts at read time against a cached live rate. Progressive disclosure is gated on `active_currencies.length > 1`.

**Tech Stack:** TypeScript, React Native (Expo 54), expo-sqlite, Jest (jest-expo preset). No new dependencies.

**Spec:** [docs/superpowers/specs/2026-08-23-multi-currency-design.md](../specs/2026-08-23-multi-currency-design.md)

## Global Constraints

- `transactions.amount` **always** means MYR. Never redefine it as a native amount. Every existing consumer of `t.amount` must keep working unchanged.
- Every schema change is additive with a MYR-safe default. Use the existing try/catch `ALTER TABLE` pattern in `init()` (see `src/db/db.ts:194-237`).
- A missing FX rate **excludes** the value from a total. It is never treated as 1:1.
- Rounding to 2dp happens exactly once, at write, via `round2`. Never re-round a stored `amount`.
- No em dashes in any user-facing copy or code comment.
- Currency is displayed as a 3-letter code (`CNY 128.00`), never a symbol. MYR displays as `RM`.
- Run tests with `npx jest <file>`. Run typecheck with `npm run typecheck`.
- Test files live in `__tests__/` at repo root and import from `../src/...`.
- Commit after each task. Never commit a failing test suite.

---

### Task 1: Currency table and derivation math

Pure logic only. No database, no UI, no network. This is the foundation every later task calls into.

**Files:**
- Create: `src/lib/currencies.ts`
- Create: `src/lib/currency.ts`
- Test: `__tests__/currency.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `BASE_CURRENCY: 'MYR'`
  - `interface CurrencyMeta { code: string; label: string; decimals: number }`
  - `SUPPORTED_CURRENCIES: CurrencyMeta[]`
  - `currencyMeta(code: string): CurrencyMeta | null`
  - `decimalsFor(code: string): number`
  - `round2(n: number): number`
  - `interface MyrDerivation { amount: number; nativeAmount: number | null; fxRate: number | null }`
  - `deriveMyr(entered: number, currency: string, rate: number | null): MyrDerivation`
  - `parseActiveCurrencies(raw: string | null): string[]`
  - `isMultiCurrency(active: string[]): boolean`

- [ ] **Step 1: Write the currency table**

Create `src/lib/currencies.ts`:

```ts
// src/lib/currencies.ts
// The fixed set of currencies the app can convert. MYR is the base and is never
// converted. `decimals` matters: rendering "JPY 1,200.00" reads as a bug, because
// the yen has no subunit in everyday use.

export interface CurrencyMeta {
  code: string;
  label: string;
  decimals: number;
}

export const BASE_CURRENCY = 'MYR';

export const SUPPORTED_CURRENCIES: CurrencyMeta[] = [
  { code: 'MYR', label: 'Malaysian Ringgit', decimals: 2 },
  { code: 'SGD', label: 'Singapore Dollar', decimals: 2 },
  { code: 'USD', label: 'US Dollar', decimals: 2 },
  { code: 'CNY', label: 'Chinese Yuan', decimals: 2 },
  { code: 'TWD', label: 'New Taiwan Dollar', decimals: 2 },
  { code: 'HKD', label: 'Hong Kong Dollar', decimals: 2 },
  { code: 'JPY', label: 'Japanese Yen', decimals: 0 },
  { code: 'KRW', label: 'South Korean Won', decimals: 0 },
  { code: 'GBP', label: 'British Pound', decimals: 2 },
  { code: 'EUR', label: 'Euro', decimals: 2 },
  { code: 'CHF', label: 'Swiss Franc', decimals: 2 },
  { code: 'AUD', label: 'Australian Dollar', decimals: 2 },
  { code: 'CAD', label: 'Canadian Dollar', decimals: 2 },
  { code: 'NZD', label: 'New Zealand Dollar', decimals: 2 },
  { code: 'THB', label: 'Thai Baht', decimals: 2 },
  { code: 'IDR', label: 'Indonesian Rupiah', decimals: 0 },
  { code: 'PHP', label: 'Philippine Peso', decimals: 2 },
  { code: 'VND', label: 'Vietnamese Dong', decimals: 0 },
  { code: 'BND', label: 'Brunei Dollar', decimals: 2 },
  { code: 'KHR', label: 'Cambodian Riel', decimals: 0 },
  { code: 'LAK', label: 'Lao Kip', decimals: 0 },
  { code: 'MMK', label: 'Myanmar Kyat', decimals: 0 },
];

const BY_CODE: Record<string, CurrencyMeta> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c])
);

export function currencyMeta(code: string): CurrencyMeta | null {
  return BY_CODE[code] ?? null;
}

/** Decimal places for a code, defaulting to 2 for anything unrecognised. */
export function decimalsFor(code: string): number {
  return BY_CODE[code]?.decimals ?? 2;
}
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/currency.test.ts`:

```ts
// __tests__/currency.test.ts
import { BASE_CURRENCY, SUPPORTED_CURRENCIES, currencyMeta, decimalsFor } from '../src/lib/currencies';
import { round2, deriveMyr, parseActiveCurrencies, isMultiCurrency } from '../src/lib/currency';

describe('currency table', () => {
  it('has MYR as the base and lists it first', () => {
    expect(BASE_CURRENCY).toBe('MYR');
    expect(SUPPORTED_CURRENCIES[0].code).toBe('MYR');
  });

  it('has no duplicate codes', () => {
    const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('marks the zero-subunit currencies as 0 decimals', () => {
    for (const code of ['JPY', 'KRW', 'VND', 'IDR', 'KHR', 'LAK', 'MMK']) {
      expect(decimalsFor(code)).toBe(0);
    }
  });

  it('defaults an unknown code to 2 decimals rather than throwing', () => {
    expect(decimalsFor('ZZZ')).toBe(2);
    expect(currencyMeta('ZZZ')).toBeNull();
  });
});

describe('round2', () => {
  it('rounds to two decimal places', () => {
    expect(round2(80.6412)).toBe(80.64);
    expect(round2(80.6456)).toBe(80.65);
  });

  it('kills float artifacts', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
  });

  it('returns 0 for non-finite input', () => {
    expect(round2(NaN)).toBe(0);
    expect(round2(Infinity)).toBe(0);
  });
});

describe('deriveMyr', () => {
  it('leaves a MYR amount completely alone', () => {
    expect(deriveMyr(128, 'MYR', null)).toEqual({ amount: 128, nativeAmount: null, fxRate: null });
  });

  it('ignores a supplied rate when the currency is MYR', () => {
    expect(deriveMyr(128, 'MYR', 0.63)).toEqual({ amount: 128, nativeAmount: null, fxRate: null });
  });

  it('converts a foreign amount and keeps the native figure', () => {
    expect(deriveMyr(128, 'CNY', 0.63)).toEqual({ amount: 80.64, nativeAmount: 128, fxRate: 0.63 });
  });

  it('rounds the MYR amount to 2dp exactly once', () => {
    expect(deriveMyr(21.5, 'CNY', 0.6321)).toEqual({ amount: 13.59, nativeAmount: 21.5, fxRate: 0.6321 });
  });

  it('throws on a foreign currency with no rate rather than assuming parity', () => {
    expect(() => deriveMyr(128, 'CNY', null)).toThrow(/rate/i);
  });

  it('throws on a non-positive rate', () => {
    expect(() => deriveMyr(128, 'CNY', 0)).toThrow(/rate/i);
  });
});

describe('parseActiveCurrencies', () => {
  it('defaults to MYR only when nothing is stored', () => {
    expect(parseActiveCurrencies(null)).toEqual(['MYR']);
  });

  it('defaults to MYR only on malformed JSON', () => {
    expect(parseActiveCurrencies('{not json')).toEqual(['MYR']);
  });

  it('always includes MYR even if it was somehow saved without it', () => {
    expect(parseActiveCurrencies('["CNY"]')).toEqual(['MYR', 'CNY']);
  });

  it('drops unsupported codes', () => {
    expect(parseActiveCurrencies('["MYR","CNY","ZZZ"]')).toEqual(['MYR', 'CNY']);
  });

  it('deduplicates', () => {
    expect(parseActiveCurrencies('["MYR","CNY","CNY"]')).toEqual(['MYR', 'CNY']);
  });
});

describe('isMultiCurrency', () => {
  it('is false for a MYR-only user, which is what hides the entire feature', () => {
    expect(isMultiCurrency(['MYR'])).toBe(false);
  });

  it('is true once a second currency is active', () => {
    expect(isMultiCurrency(['MYR', 'CNY'])).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest __tests__/currency.test.ts`
Expected: FAIL, `Cannot find module '../src/lib/currency'`.

- [ ] **Step 4: Write the derivation module**

Create `src/lib/currency.ts`:

```ts
// src/lib/currency.ts
// The single place a native amount becomes a MYR amount. Every write path goes
// through deriveMyr so the stored invariant can only hold or throw, never drift.
import { BASE_CURRENCY, currencyMeta } from './currencies';

export { BASE_CURRENCY };

/** Round to 2dp, killing float artifacts. Non-finite input reads as 0, matching `fmt`. */
export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface MyrDerivation {
  /** Canonical MYR value. This is what goes in transactions.amount. */
  amount: number;
  /** The figure the user actually entered, or null for a plain MYR row. */
  nativeAmount: number | null;
  /** MYR per 1 native unit, frozen. Null for a plain MYR row. */
  fxRate: number | null;
}

/**
 * Derive the canonical MYR amount from an entered amount.
 *
 * A MYR row stores null for both extra columns, so an upgraded database's existing
 * rows are already valid without any backfill.
 *
 * Throws rather than falling back to parity when a foreign rate is missing: silently
 * counting CNY at 1:1 is the exact bug this feature exists to fix, and a throw at the
 * write boundary is far cheaper to find than a wrong number in a total. Callers are
 * expected to have a cached rate already, because activating a currency fetches one.
 */
export function deriveMyr(entered: number, currency: string, rate: number | null): MyrDerivation {
  if (currency === BASE_CURRENCY) {
    return { amount: round2(entered), nativeAmount: null, fxRate: null };
  }
  if (rate == null || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`No usable FX rate for ${currency}`);
  }
  return { amount: round2(entered * rate), nativeAmount: entered, fxRate: rate };
}

/**
 * Read the `active_currencies` meta value. MYR is forced in and placed first: the base
 * currency can never be deactivated, and a stored value missing it would otherwise hide
 * ringgit from the user's own picker.
 */
export function parseActiveCurrencies(raw: string | null): string[] {
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const codes = Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : [];
  const valid = codes.filter((c) => c !== BASE_CURRENCY && currencyMeta(c) !== null);
  return [BASE_CURRENCY, ...[...new Set(valid)]];
}

/** The gate for every piece of multi-currency UI. False means the feature is invisible. */
export function isMultiCurrency(active: string[]): boolean {
  return active.length > 1;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest __tests__/currency.test.ts`
Expected: PASS, all suites green.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/currencies.ts src/lib/currency.ts __tests__/currency.test.ts
git commit -m "feat(currency): add currency table and MYR derivation math"
```

---

### Task 2: `fmtMoney` formatting

**Files:**
- Modify: `src/lib/format.ts`
- Test: `__tests__/format.test.ts`

**Interfaces:**
- Consumes: `decimalsFor` from `src/lib/currencies.ts` (Task 1).
- Produces: `fmtMoney(amount: number, currency: string): string`

- [ ] **Step 1: Write the failing test**

Append to `__tests__/format.test.ts`, and extend the existing import at line 1 to `import { fmt, fmtCompact, fmtMoney, readTimeLabel } from '../src/lib/format';`:

```ts
describe('fmtMoney', () => {
  it('uses the RM convention for ringgit rather than the code', () => {
    expect(fmtMoney(128, 'MYR')).toBe('RM 128.00');
    expect(fmtMoney(1234.5, 'MYR')).toBe('RM 1,234.50');
  });

  it('uses the 3-letter code for everything else, never a symbol', () => {
    expect(fmtMoney(128, 'CNY')).toBe('CNY 128.00');
    expect(fmtMoney(1234.5, 'USD')).toBe('USD 1,234.50');
  });

  it('drops decimals for zero-subunit currencies', () => {
    expect(fmtMoney(1200, 'JPY')).toBe('JPY 1,200');
    expect(fmtMoney(45000, 'KRW')).toBe('KRW 45,000');
  });

  it('rounds rather than truncates a zero-decimal currency', () => {
    expect(fmtMoney(1200.6, 'JPY')).toBe('JPY 1,201');
  });

  it('keeps the negative sign in front of the number, after the code', () => {
    expect(fmtMoney(-128, 'CNY')).toBe('CNY -128.00');
    expect(fmtMoney(-128, 'MYR')).toBe('RM -128.00');
  });

  it('agrees with fmt for MYR amounts, so existing RM labels stay consistent', () => {
    expect(fmtMoney(1234.5, 'MYR')).toBe(`RM ${fmt(1234.5)}`);
  });

  it('falls back to 0 for non-finite input, same as fmt', () => {
    expect(fmtMoney(NaN, 'MYR')).toBe('RM 0.00');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/format.test.ts`
Expected: FAIL, `fmtMoney is not a function`.

- [ ] **Step 3: Implement `fmtMoney`**

In `src/lib/format.ts`, add the import at the top and refactor `fmt` to delegate to a decimals-aware helper. Replace the existing `fmt` function body with this, leaving `fmtCompact` and `readTimeLabel` untouched:

```ts
import { decimalsFor } from './currencies';

/**
 * Format a number with thousands separators at a given number of decimal places.
 * Implemented manually rather than via Intl to avoid locale-data gaps in Hermes.
 */
function fmtDecimals(n: number, decimals: number): string {
  const value = Number.isFinite(n) ? n : 0;
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (negative ? '-' : '') + grouped + (decPart ? '.' + decPart : '');
}

/**
 * Format a number as a 2-decimal amount with thousands separators,
 * e.g. 2000 -> "2,000.00".
 */
export function fmt(n: number): string {
  return fmtDecimals(n, 2);
}

/**
 * Format an amount with its currency prefix. MYR keeps the local "RM" convention;
 * everything else uses the 3-letter code, because symbols are ambiguous (the yen sign
 * covers both JPY and CNY) and Hermes has patchy symbol font coverage.
 */
export function fmtMoney(amount: number, currency: string): string {
  const prefix = currency === 'MYR' ? 'RM' : currency;
  return `${prefix} ${fmtDecimals(amount, decimalsFor(currency))}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/format.test.ts`
Expected: PASS. The pre-existing `fmt` and `fmtCompact` tests must still pass, which proves the refactor is behaviour-preserving.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts __tests__/format.test.ts
git commit -m "feat(currency): add fmtMoney with per-currency decimals"
```

---

### Task 3: Schema migrations and `fx_cache`

Nothing becomes visible in this task. Every column defaults to MYR, so a fresh install and an upgraded install both behave exactly as they do today.

**Files:**
- Modify: `src/lib/types.ts` (`Transaction`, `Account`)
- Modify: `src/db/db.ts` (`init` migrations, `resetAllData`)
- Modify: `src/db/txnRepo.ts` (`TxnRow`, `toTxn`)
- Modify: `src/db/accountsRepo.ts` (`AccountRow`, `toAccount`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `Transaction` gains `nativeAmount?: number | null` and `fxRate?: number | null`
  - `Account` gains `currency: string`
  - `fx_cache` table with columns `code`, `rate_myr`, `as_of`

- [ ] **Step 1: Extend the types**

In `src/lib/types.ts`, add to the `Transaction` interface after `receiptUri`:

```ts
  /** The amount as the user entered it, in `currency`. Null for a plain MYR row, which is
   *  why no backfill is needed on upgrade. `amount` is ALWAYS the MYR value. */
  nativeAmount?: number | null;
  /** MYR per 1 unit of `currency`, frozen when the row was written. Null for MYR rows. */
  fxRate?: number | null;
```

And to the `Account` interface after `icon`:

```ts
  /** The currency this account is denominated in. Balances are stored native and
   *  converted at read time against a live cached rate. Defaults to 'MYR'. */
  currency: string;
```

- [ ] **Step 2: Add the migrations**

In `src/db/db.ts`, add `fx_cache` to the `CREATE TABLE IF NOT EXISTS` block in `init()`, immediately after the `price_cache` block (around line 97):

```sql
    CREATE TABLE IF NOT EXISTS fx_cache (
      code        TEXT PRIMARY KEY NOT NULL,
      rate_myr    REAL NOT NULL,
      as_of       TEXT NOT NULL
    );
```

Then add the column migrations after the existing `relief_code` migration (around line 237), following the same try/catch pattern:

```ts
  // Migration: multi-currency. `amount` stays canonical MYR on every row; these two
  // columns carry the figure the user actually entered and the rate frozen at entry.
  // Null on both means "a plain MYR row", so existing rows need no backfill.
  for (const col of ['native_amount REAL', 'fx_rate REAL']) {
    try {
      await db.execAsync(`ALTER TABLE transactions ADD COLUMN ${col}`);
    } catch {
      // column already present
    }
  }

  // Migration: the currency an account is denominated in. Balances stay native.
  try {
    await db.execAsync("ALTER TABLE accounts ADD COLUMN currency TEXT NOT NULL DEFAULT 'MYR'");
  } catch {
    // column already present
  }
```

- [ ] **Step 3: Clear the new state on reset**

In `src/db/db.ts`, inside `resetAllData`, add `DELETE FROM fx_cache;` to the `execAsync` block. Then, still inside the transaction and before `seedCategories(db)`, add:

```ts
    // Without this, "Reset all data" leaves the app still in CNY entry mode.
    await db.runAsync("DELETE FROM app_meta WHERE key IN ('active_currencies', 'entry_currency')");
```

- [ ] **Step 4: Read the columns through the repos**

In `src/db/txnRepo.ts`, add to `TxnRow`:

```ts
  native_amount: number | null;
  fx_rate: number | null;
```

and to the object returned by `toTxn`:

```ts
    nativeAmount: r.native_amount ?? null,
    fxRate: r.fx_rate ?? null,
```

In `src/db/accountsRepo.ts`, add `currency: string;` to `AccountRow` and `currency: r.currency ?? 'MYR',` to the object returned by `toAccount`.

- [ ] **Step 5: Fix the test fixture**

`__tests__/networth.test.ts:14-18` builds an `Account` literal that no longer typechecks. Add `currency: 'MYR',` to the `acct` helper's defaults:

```ts
function acct(over: Partial<Account>): Account {
  return {
    id: 'a1', name: 'Acct', kind: 'asset', cls: 'cash', archived: false, createdAt: '2026-01-01T00:00:00.000Z',
    sub: null, symbol: null, ticker: null, quantity: null, cost: null, currency: 'MYR', ...over,
  };
}
```

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx jest && npm run typecheck`
Expected: everything passes. Any other `Account` literal the compiler flags needs `currency: 'MYR'` added the same way. This step is the regression gate proving a MYR-only database is unaffected by the migration.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/db/db.ts src/db/txnRepo.ts src/db/accountsRepo.ts __tests__/networth.test.ts
git commit -m "feat(currency): add multi-currency schema, MYR-safe defaults throughout"
```

---

### Task 4: FX rate cache and fetch

**Files:**
- Create: `src/lib/fx.ts` (pure, tested)
- Create: `src/db/fxRepo.ts` (persistence)
- Create: `src/prices/fx.ts` (network, best-effort)
- Test: `__tests__/fx.test.ts`

**Interfaces:**
- Consumes: `BASE_CURRENCY` from `src/lib/currency.ts` (Task 1).
- Produces:
  - `interface FxRate { code: string; rateMyr: number; asOf: string }`
  - `ratesFromCache(rows: FxRate[]): Record<string, number>`
  - `rateFor(rates: Record<string, number>, code: string): number | null`
  - `isStale(asOf: string, now?: Date): boolean`
  - `staleLabel(asOf: string): string`
  - `listFxRates(): Promise<FxRate[]>` and `saveFxRate(code, rateMyr): Promise<void>` from `src/db/fxRepo.ts`
  - `fetchRateMYR(code: string): Promise<number | null>` from `src/prices/fx.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/fx.test.ts`:

```ts
// __tests__/fx.test.ts
import { ratesFromCache, rateFor, isStale, staleLabel, FX_STALE_MS, type FxRate } from '../src/lib/fx';

function rate(over: Partial<FxRate>): FxRate {
  return { code: 'CNY', rateMyr: 0.63, asOf: '2026-08-23T00:00:00.000Z', ...over };
}

describe('ratesFromCache', () => {
  it('builds a code to rate lookup', () => {
    const rows = [rate({ code: 'CNY', rateMyr: 0.63 }), rate({ code: 'USD', rateMyr: 4.4 })];
    expect(ratesFromCache(rows)).toEqual({ CNY: 0.63, USD: 4.4 });
  });

  it('drops non-positive rates, which would silently zero out a balance', () => {
    expect(ratesFromCache([rate({ code: 'CNY', rateMyr: 0 })])).toEqual({});
    expect(ratesFromCache([rate({ code: 'CNY', rateMyr: -1 })])).toEqual({});
  });

  it('returns an empty table for no rows', () => {
    expect(ratesFromCache([])).toEqual({});
  });
});

describe('rateFor', () => {
  it('always returns exactly 1 for the base currency, never a table lookup', () => {
    expect(rateFor({}, 'MYR')).toBe(1);
    expect(rateFor({ MYR: 0.5 }, 'MYR')).toBe(1);
  });

  it('returns the cached rate for a foreign currency', () => {
    expect(rateFor({ CNY: 0.63 }, 'CNY')).toBe(0.63);
  });

  it('returns null rather than 1 when the rate is missing', () => {
    expect(rateFor({}, 'CNY')).toBeNull();
  });
});

describe('isStale', () => {
  const now = new Date('2026-08-23T12:00:00.000Z');

  it('is fresh within 24 hours', () => {
    expect(isStale('2026-08-23T06:00:00.000Z', now)).toBe(false);
  });

  it('is stale past 24 hours', () => {
    expect(isStale('2026-08-21T06:00:00.000Z', now)).toBe(true);
  });

  it('treats an unparseable timestamp as stale', () => {
    expect(isStale('not a date', now)).toBe(true);
  });

  it('uses a 24 hour window', () => {
    expect(FX_STALE_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe('staleLabel', () => {
  it('renders a short human date for the net worth hint', () => {
    expect(staleLabel('2026-08-12T06:00:00.000Z')).toBe('rate 12 Aug');
  });

  it('returns an empty string for an unparseable timestamp', () => {
    expect(staleLabel('nope')).toBe('');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/fx.test.ts`
Expected: FAIL, `Cannot find module '../src/lib/fx'`.

- [ ] **Step 3: Write the pure FX module**

Create `src/lib/fx.ts`:

```ts
// src/lib/fx.ts
// Pure FX rate logic. No network, no DB. The network half lives in src/prices/fx.ts,
// mirroring the existing lib/prices.ts + prices/yahoo.ts split.
import { BASE_CURRENCY } from './currency';

export const FX_STALE_MS = 24 * 60 * 60 * 1000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A cached conversion rate: how many MYR one unit of `code` is worth. */
export interface FxRate {
  code: string;
  rateMyr: number;
  asOf: string; // ISO datetime
}

/** Build a code to rate lookup, dropping anything that would corrupt a total. */
export function ratesFromCache(rows: FxRate[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (Number.isFinite(r.rateMyr) && r.rateMyr > 0) out[r.code] = r.rateMyr;
  }
  return out;
}

/**
 * The rate for a currency, or null when it is unknown.
 *
 * Returning null rather than 1 is the whole point: a caller must decide to exclude the
 * value, because counting a foreign amount at parity is the bug this feature fixes.
 * The base currency short-circuits to 1 and is never looked up, so a corrupt cache row
 * for MYR cannot rescale the user's entire net worth.
 */
export function rateFor(rates: Record<string, number>, code: string): number | null {
  if (code === BASE_CURRENCY) return 1;
  const r = rates[code];
  return Number.isFinite(r) && r > 0 ? r : null;
}

export function isStale(asOf: string, now: Date = new Date()): boolean {
  const t = Date.parse(asOf);
  if (Number.isNaN(t)) return true;
  return now.getTime() - t > FX_STALE_MS;
}

/** "rate 12 Aug", the quiet hint shown under a converted account balance. */
export function staleLabel(asOf: string): string {
  const t = Date.parse(asOf);
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  return `rate ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/fx.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the persistence layer**

Create `src/db/fxRepo.ts`:

```ts
// src/db/fxRepo.ts
// Persistence for cached FX rates. Mirrors the price_cache repo pattern.
import { getDb } from './db';
import type { FxRate } from '../lib/fx';

interface FxRow {
  code: string;
  rate_myr: number;
  as_of: string;
}

export async function listFxRates(): Promise<FxRate[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<FxRow>('SELECT * FROM fx_cache');
  return rows.map((r) => ({ code: r.code, rateMyr: r.rate_myr, asOf: r.as_of }));
}

export async function saveFxRate(code: string, rateMyr: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO fx_cache (code, rate_myr, as_of) VALUES (?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET rate_myr = excluded.rate_myr, as_of = excluded.as_of`,
    code,
    rateMyr,
    new Date().toISOString()
  );
}
```

- [ ] **Step 6: Write the network fetch**

Create `src/prices/fx.ts`:

```ts
// src/prices/fx.ts
// FX rate fetch via the same unofficial Yahoo chart endpoint the holdings pricer already
// uses (see src/prices/yahoo.ts). Network only, best-effort: null means "no rate", and
// every caller is required to treat that as "exclude", never as parity.
import { parseYahooChart } from '../lib/prices';

const CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' };

/** MYR per 1 unit of `code`, or null if the pair is unavailable. */
export async function fetchRateMYR(code: string): Promise<number | null> {
  if (code === 'MYR') return 1;
  try {
    // Encode the WHOLE symbol, matching src/prices/yahoo.ts's chart() exactly (it encodes
    // `${cur}MYR=X` as one string, which percent-escapes the `=`). Encoding only `code` and
    // appending a literal `MYR=X` produces a different, unproven URL shape for no reason.
    const symbol = `${code}MYR=X`;
    const res = await fetch(`${CHART}/${encodeURIComponent(symbol)}?range=2d&interval=1d`, { headers: HEADERS });
    if (!res.ok) return null;
    const parsed = parseYahooChart(await res.json());
    if (!parsed || !Number.isFinite(parsed.price) || parsed.price <= 0) return null;
    return parsed.price;
  } catch {
    return null;
  }
}
```

- [ ] **Step 7: Typecheck and commit**

Run: `npx jest && npm run typecheck`
Expected: PASS.

```bash
git add src/lib/fx.ts src/db/fxRepo.ts src/prices/fx.ts __tests__/fx.test.ts
git commit -m "feat(currency): add FX rate cache, staleness rules, and Yahoo fetch"
```

---

### Task 5: Currency settings screen

After this task the feature is activatable, but nothing else in the app reads the setting yet. A MYR-only user sees exactly one new Settings row.

**Files:**
- Create: `src/db/currencyRepo.ts`
- Create: `src/screens/CurrencySettingsScreen.tsx`
- Modify: `src/screens/SettingsScreen.tsx` (add one row)
- Modify: `src/lib/screenNav.ts` (register the route)

**Interfaces:**
- Consumes: `parseActiveCurrencies`, `isMultiCurrency`, `BASE_CURRENCY` (Task 1); `SUPPORTED_CURRENCIES`, `currencyMeta` (Task 1); `saveFxRate`, `listFxRates` (Task 4); `fetchRateMYR` (Task 4).
- Produces:
  - `getActiveCurrencies(): Promise<string[]>`
  - `setActiveCurrencies(codes: string[]): Promise<void>`
  - `getEntryCurrency(): Promise<string>`
  - `setEntryCurrency(code: string): Promise<void>`
  - `activateCurrency(code: string): Promise<boolean>` (false when the rate fetch failed)
  - `deactivateCurrency(code: string): Promise<void>`

- [ ] **Step 1: Write the settings repo**

Create `src/db/currencyRepo.ts`:

```ts
// src/db/currencyRepo.ts
// The two app_meta keys that drive multi-currency, plus activation.
import { getMeta, setMeta } from './metaRepo';
import { saveFxRate } from './fxRepo';
import { fetchRateMYR } from '../prices/fx';
import { BASE_CURRENCY, parseActiveCurrencies } from '../lib/currency';

const ACTIVE_KEY = 'active_currencies';
const ENTRY_KEY = 'entry_currency';

export async function getActiveCurrencies(): Promise<string[]> {
  return parseActiveCurrencies(await getMeta(ACTIVE_KEY));
}

export async function setActiveCurrencies(codes: string[]): Promise<void> {
  await setMeta(ACTIVE_KEY, JSON.stringify(parseActiveCurrencies(JSON.stringify(codes))));
}

export async function getEntryCurrency(): Promise<string> {
  const stored = await getMeta(ENTRY_KEY);
  if (!stored) return BASE_CURRENCY;
  const active = await getActiveCurrencies();
  // A currency deactivated while it was the entry default falls back to ringgit rather
  // than leaving entry pointed at a currency the picker no longer offers.
  return active.includes(stored) ? stored : BASE_CURRENCY;
}

export async function setEntryCurrency(code: string): Promise<void> {
  await setMeta(ENTRY_KEY, code);
}

/**
 * Turn a currency on. Fetching and caching its rate is part of activation, and failure
 * aborts it: this is the network gate that guarantees every activatable currency already
 * has a cached rate, which is what lets transaction entry stay fully offline.
 *
 * Returns false when the rate could not be fetched, so the caller can show a message.
 */
export async function activateCurrency(code: string): Promise<boolean> {
  if (code === BASE_CURRENCY) return true;
  const rate = await fetchRateMYR(code);
  if (rate == null) return false;
  await saveFxRate(code, rate);
  const active = await getActiveCurrencies();
  if (!active.includes(code)) await setActiveCurrencies([...active, code]);
  return true;
}

/**
 * Turn a currency off. This only removes it from the entry picker: existing transactions
 * keep their currency and keep displaying it, and the cached rate is kept so historical
 * balances still convert. Nothing is deleted or rewritten.
 */
export async function deactivateCurrency(code: string): Promise<void> {
  if (code === BASE_CURRENCY) return;
  const active = await getActiveCurrencies();
  await setActiveCurrencies(active.filter((c) => c !== code));
  if ((await getMeta(ENTRY_KEY)) === code) await setEntryCurrency(BASE_CURRENCY);
}
```

- [ ] **Step 2: Read the surrounding conventions before writing UI**

Read `src/screens/SettingsScreen.tsx` and one existing sub-screen (for example the tax relief settings screen it links to) to copy the row component, header, back handling, and theme token usage. Do not invent a new visual pattern. Note how the screen is registered in `src/lib/screenNav.ts` and follow it exactly.

- [ ] **Step 3: Build the currency settings screen**

Create `src/screens/CurrencySettingsScreen.tsx` following the conventions found in Step 2. Required behaviour:

- Lists all of `SUPPORTED_CURRENCIES` as `CODE Label` rows with a toggle.
- The MYR row is not toggleable and is labelled `Base`.
- Toggling on calls `activateCurrency`. On `false`, show an alert via the existing `platformAlert` helper with the copy: `Couldn't fetch the CNY rate. Try again when you're online.` (substituting the code) and leave the toggle off.
- Toggling off calls `deactivateCurrency`.
- Below the list, an "Enter new expenses in" picker listing only active currencies, writing through `setEntryCurrency`. Hide this section entirely when only MYR is active.
- Reload state after every mutation so the picker and toggles stay consistent.

- [ ] **Step 4: Add the Settings row**

In `src/screens/SettingsScreen.tsx`, add one row labelled `Currencies` in the same group as the other configuration rows. Its value text is `MYR only` when `isMultiCurrency(active)` is false, otherwise the active codes joined with a comma, for example `MYR, CNY`. Tapping navigates to the new screen.

This row is the only pixel a Malaysia-only user ever sees.

- [ ] **Step 5: Verify by hand**

Run the app. Confirm:
- Settings shows `Currencies · MYR only`.
- Activating CNY while online succeeds and the row becomes `MYR, CNY`.
- Activating a currency with airplane mode on fails with the message and leaves the toggle off.
- Deactivating CNY returns the row to `MYR only`.

- [ ] **Step 6: Typecheck and commit**

Run: `npx jest && npm run typecheck`

```bash
git add src/db/currencyRepo.ts src/screens/CurrencySettingsScreen.tsx src/screens/SettingsScreen.tsx src/lib/screenNav.ts
git commit -m "feat(currency): add currency settings screen with fetch-gated activation"
```

---

### Task 6: Transaction write path

This task contains the highest-risk change in the plan: the two `txnRepo` update functions that currently write `amount` directly.

**Files:**
- Modify: `src/db/txnRepo.ts:36-46` (`NewTxn`), `:64-106` (`addTransactions`), `:108-111` (`updateTransactionAmount`), `:130-147` (`updateTransactionFields`)
- Test: `__tests__/currency.test.ts` (extend)

**Interfaces:**
- Consumes: `deriveMyr`, `BASE_CURRENCY` (Task 1); `rateFor` (Task 4).
- Produces:
  - `rederiveOnEdit(entered: number, currency: string, frozenRate: number | null): MyrDerivation`
  - `NewTxn` gains `currency?: string` and `fxRate?: number | null`
  - `updateTransactionAmount(id, entered)` and `updateTransactionFields(id, entered, type, categoryId, remark)` keep their existing signatures. They read the row's stored currency and frozen rate themselves, so no caller changes.

- [ ] **Step 1: Write the failing test for the edit hazard**

Add to `__tests__/currency.test.ts`. This tests the pure re-derivation helper that the repo will call, which is where the logic must live so it can be tested without a database:

```ts
import { rederiveOnEdit } from '../src/lib/currency';

describe('rederiveOnEdit', () => {
  it('reuses the frozen rate so correcting a typo does not reprice the row', () => {
    // A March dinner entered at 0.63. Editing it in August must not use August's rate.
    expect(rederiveOnEdit(130, 'CNY', 0.63)).toEqual({ amount: 81.9, nativeAmount: 130, fxRate: 0.63 });
  });

  it('treats the edited number as the native figure, not the MYR figure', () => {
    const result = rederiveOnEdit(130, 'CNY', 0.63);
    expect(result.nativeAmount).toBe(130);
    expect(result.amount).not.toBe(130);
  });

  it('passes a MYR row straight through', () => {
    expect(rederiveOnEdit(130, 'MYR', null)).toEqual({ amount: 130, nativeAmount: null, fxRate: null });
  });

  it('throws when a foreign row has lost its frozen rate rather than assuming parity', () => {
    expect(() => rederiveOnEdit(130, 'CNY', null)).toThrow(/rate/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/currency.test.ts`
Expected: FAIL, `rederiveOnEdit is not a function`.

- [ ] **Step 3: Add `rederiveOnEdit`**

Append to `src/lib/currency.ts`:

```ts
/**
 * Re-derive a row after the user edits its amount.
 *
 * The number coming out of an edit field is the NATIVE amount, because that is what the
 * row displays. Writing it straight into `amount` would set the MYR column to a yuan
 * figure and leave `native_amount` stale, which is the single most likely way to corrupt
 * this feature. This helper exists so no caller has to remember that.
 *
 * The frozen rate is reused deliberately: correcting a typo in March's dinner must not
 * silently reprice it at today's rate.
 */
export function rederiveOnEdit(entered: number, currency: string, frozenRate: number | null): MyrDerivation {
  return deriveMyr(entered, currency, frozenRate);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/currency.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the insert path**

In `src/db/txnRepo.ts`, add to `NewTxn`:

```ts
  /** Defaults to 'MYR'. When set to anything else, `amount` is treated as the native figure. */
  currency?: string;
  /** MYR per 1 native unit. Required when `currency` is not 'MYR'. */
  fxRate?: number | null;
```

Then in `addTransactions`, replace the hardcoded `'MYR'` literal in the SQL with a bound parameter and derive the values. The insert loop body becomes:

```ts
      const id = genId();
      const createdAt = new Date().toISOString();
      const remark = cleanRemark(it.remark);
      const receiptUri = it.receiptUri ?? null;
      const currency = it.currency ?? BASE_CURRENCY;
      // `it.amount` is the figure the caller collected, native when currency is not MYR.
      const derived = deriveMyr(it.amount, currency, it.fxRate ?? null);
      await db.runAsync(
        `INSERT INTO transactions
           (id, merchant_raw, merchant_key, amount, currency, type, txn_date, category_id, created_at, source, remark, receipt_uri, native_amount, fx_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        it.merchantRaw,
        it.merchantKey,
        derived.amount,
        currency,
        it.type,
        it.date,
        it.categoryId,
        createdAt,
        it.source ?? 'manual',
        remark,
        receiptUri,
        derived.nativeAmount,
        derived.fxRate
      );
      created.push({
        id,
        merchantRaw: it.merchantRaw,
        merchantKey: it.merchantKey,
        amount: derived.amount,
        currency,
        type: it.type,
        date: it.date,
        categoryId: it.categoryId,
        createdAt,
        source: it.source ?? 'manual',
        remark,
        receiptUri,
        nativeAmount: derived.nativeAmount,
        fxRate: derived.fxRate,
      });
```

Add the import: `import { BASE_CURRENCY, deriveMyr, rederiveOnEdit } from '../lib/currency';`

Every existing caller passes neither `currency` nor `fxRate`, so it produces a row identical to today.

- [ ] **Step 6: Fix the two edit hazards**

Still in `src/db/txnRepo.ts`, replace `updateTransactionAmount` and `updateTransactionFields`. Both now read the row's existing currency and frozen rate first, then re-derive:

```ts
/** The stored currency and frozen rate for a row, so an edit can re-derive without repricing. */
async function currencyOf(id: string): Promise<{ currency: string; fxRate: number | null }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ currency: string; fx_rate: number | null }>(
    'SELECT currency, fx_rate FROM transactions WHERE id = ?',
    id
  );
  return { currency: row?.currency ?? BASE_CURRENCY, fxRate: row?.fx_rate ?? null };
}

/** `entered` is the NATIVE amount for a foreign row, matching what the edit field shows. */
export async function updateTransactionAmount(id: string, entered: number): Promise<void> {
  const db = await getDb();
  const { currency, fxRate } = await currencyOf(id);
  const d = rederiveOnEdit(entered, currency, fxRate);
  await db.runAsync(
    'UPDATE transactions SET amount = ?, native_amount = ? WHERE id = ?',
    d.amount,
    d.nativeAmount,
    id
  );
}

/** Update amount, type, category, and remark together (used by the edit sheet).
 *  `entered` is the NATIVE amount for a foreign row. */
export async function updateTransactionFields(
  id: string,
  entered: number,
  type: TxnType,
  categoryId: string | null,
  remark?: string | null
): Promise<void> {
  const db = await getDb();
  const { currency, fxRate } = await currencyOf(id);
  const d = rederiveOnEdit(entered, currency, fxRate);
  await db.runAsync(
    'UPDATE transactions SET amount = ?, native_amount = ?, type = ?, category_id = ?, remark = ? WHERE id = ?',
    d.amount,
    d.nativeAmount,
    type,
    categoryId,
    cleanRemark(remark),
    id
  );
}
```

Both signatures are unchanged from the caller's point of view, so no screen needs editing. For a MYR row the behaviour is byte-identical to today.

- [ ] **Step 7: Run the full suite and typecheck**

Run: `npx jest && npm run typecheck`
Expected: PASS. Every existing transaction test must still pass unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/lib/currency.ts src/db/txnRepo.ts __tests__/currency.test.ts
git commit -m "fix(currency): re-derive MYR on transaction edit instead of overwriting amount"
```

---

### Task 7: Entry UI, the currency chip

**Files:**
- Create: `src/components/CurrencyChip.tsx`
- Modify: `src/screens/ManualEntryScreen.tsx`
- Modify: `src/components/EditTransactionModal.tsx`

**Interfaces:**
- Consumes: `isMultiCurrency`, `BASE_CURRENCY` (Task 1); `fmtMoney` (Task 2); `getActiveCurrencies`, `getEntryCurrency`, `setEntryCurrency` (Task 5); `rateFor` (Task 4); `listFxRates` (Task 4).
- Produces: `<CurrencyChip value={code} active={string[]} onChange={(code: string) => void} />`

- [ ] **Step 1: Build the chip**

Create `src/components/CurrencyChip.tsx`. A small bordered pill showing the code and a chevron, opening a picker limited to `active`. Copy the visual tokens from an existing pill or chip in `src/components/ui.tsx` rather than inventing one. It renders `null` when `active.length <= 1`, so callers never need their own conditional.

- [ ] **Step 2: Wire into manual entry**

In `src/screens/ManualEntryScreen.tsx`:

- Load `getActiveCurrencies()` and `getEntryCurrency()` on mount, and `listFxRates()` into a rate table.
- Render `<CurrencyChip>` to the left of the amount input, seeded with the entry currency. Changing it calls `setEntryCurrency` so the choice sticks for next time.
- Below the input, when the selected currency is not MYR, show `≈ ${fmtMoney(entered * rate, 'MYR')}` in muted text, recomputed as the user types.
- On save, pass `currency` and `fxRate: rateFor(rates, currency)` into the `NewTxn`.

The zero-decimal currencies must not force a two-decimal keypad or mask. Check `decimalsFor(currency)` where the input formats.

- [ ] **Step 3: Wire into the edit modal**

In `src/components/EditTransactionModal.tsx`, seed the amount field from `txn.nativeAmount ?? txn.amount` and show the row's currency as a read-only label. Changing a transaction's currency after the fact is out of scope for v1 (spec §Non-goals): the chip here is display only.

This is important: seeding from `txn.amount` on a foreign row would show the user a ringgit figure in a field that saves as yuan.

- [ ] **Step 4: Verify by hand**

With CNY active, add a CNY 128 expense. Confirm the entry screen shows the approximate RM value live, the saved row's dashboard total moves by the converted amount and not by 128, and reopening the edit modal shows 128 rather than the converted figure.

- [ ] **Step 5: Typecheck and commit**

Run: `npx jest && npm run typecheck`

```bash
git add src/components/CurrencyChip.tsx src/screens/ManualEntryScreen.tsx src/components/EditTransactionModal.tsx
git commit -m "feat(currency): add currency chip to transaction entry and edit"
```

---

### Task 8: Display across transaction surfaces

Rows show what you paid. Totals show what it cost in RM. Totals are already correct because they read `amount`, so this task only changes row rendering.

**Files:**
- Modify: `src/screens/AllTransactionsScreen.tsx`
- Modify: `src/screens/CategoryDetailScreen.tsx`
- Modify: `src/screens/BreakdownScreen.tsx`
- Modify: `src/screens/CalendarScreen.tsx`
- Modify: `src/screens/DashboardScreen.tsx` (recent transactions list only)

**Interfaces:**
- Consumes: `fmtMoney` (Task 2).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Establish the row rule**

In each file, find where a transaction row renders its amount. It currently reads something like `RM ${fmt(t.amount)}`. Replace with:

```tsx
fmtMoney(t.nativeAmount ?? t.amount, t.currency)
```

For a MYR row this produces `RM 128.00`, exactly what it produced before.

- [ ] **Step 2: Leave every total alone**

Do not change any section header, subtotal, month total, budget figure, or hero number. They read `t.amount`, which is MYR, and their existing `RM` prefix is correct. Changing them is a bug, not an improvement.

- [ ] **Step 3: Verify by hand**

With a mix of MYR and CNY transactions, confirm each row shows its own currency, the month total is a single RM figure, and the RM total equals the sum of the converted values rather than the sum of the raw numbers.

- [ ] **Step 4: Typecheck and commit**

Run: `npx jest && npm run typecheck`

```bash
git add src/screens/AllTransactionsScreen.tsx src/screens/CategoryDetailScreen.tsx src/screens/BreakdownScreen.tsx src/screens/CalendarScreen.tsx src/screens/DashboardScreen.tsx
git commit -m "feat(currency): show native amounts on transaction rows, totals stay MYR"
```

---

### Task 9: Accounts and net worth conversion

The stock half of the split. Balances stay native and convert at read time.

**Files:**
- Modify: `src/lib/networth.ts` (add `toMyrValues`, extend `netWorthSeries`)
- Modify: `src/db/accountsRepo.ts` (`addAccount` takes a currency)
- Modify: `src/screens/NetWorthScreen.tsx`
- Modify: `src/screens/NetWorthHistoryScreen.tsx`
- Test: `__tests__/networth.test.ts`

**Interfaces:**
- Consumes: `rateFor`, `staleLabel`, `ratesFromCache` (Task 4); `fmtMoney` (Task 2).
- Produces:
  - `interface ConvertedValues { valueById: Record<string, number>; unconvertible: string[] }`
  - `toMyrValues(accounts: Account[], valueById: Record<string, number>, rates: Record<string, number>): ConvertedValues`
  - `netWorthSeries(accounts, entries, monthKeys, rates?: Record<string, number>)`

- [ ] **Step 1: Write the failing test**

Add to `__tests__/networth.test.ts`, extending the existing import to include `toMyrValues`:

```ts
describe('toMyrValues', () => {
  it('leaves MYR accounts untouched and needs no rate table', () => {
    const accounts = [acct({ id: 'a', currency: 'MYR' })];
    const result = toMyrValues(accounts, { a: 1000 }, {});
    expect(result.valueById).toEqual({ a: 1000 });
    expect(result.unconvertible).toEqual([]);
  });

  it('converts a foreign account at the supplied rate', () => {
    const accounts = [acct({ id: 'a', currency: 'CNY' })];
    const result = toMyrValues(accounts, { a: 12000 }, { CNY: 0.63 });
    expect(result.valueById).toEqual({ a: 7560 });
    expect(result.unconvertible).toEqual([]);
  });

  it('EXCLUDES an account with no rate rather than counting it at parity', () => {
    const accounts = [acct({ id: 'a', currency: 'MYR' }), acct({ id: 'b', currency: 'CNY' })];
    const result = toMyrValues(accounts, { a: 1000, b: 12000 }, {});
    expect(result.valueById).toEqual({ a: 1000 });
    expect(result.valueById.b).toBeUndefined();
    expect(result.unconvertible).toEqual(['b']);
  });

  it('feeds netWorth a total that omits the unconvertible account', () => {
    const accounts = [acct({ id: 'a', currency: 'MYR' }), acct({ id: 'b', currency: 'CNY' })];
    const { valueById } = toMyrValues(accounts, { a: 1000, b: 12000 }, {});
    expect(netWorth(accounts, valueById).net).toBe(1000);
  });

  it('rounds converted values to 2dp', () => {
    const accounts = [acct({ id: 'a', currency: 'CNY' })];
    expect(toMyrValues(accounts, { a: 128 }, { CNY: 0.6321 }).valueById.a).toBe(80.91);
  });

  it('skips archived accounts', () => {
    const accounts = [acct({ id: 'a', currency: 'CNY', archived: true })];
    expect(toMyrValues(accounts, { a: 12000 }, {}).unconvertible).toEqual([]);
  });
});

describe('netWorthSeries with rates', () => {
  it('defaults to an empty rate table so existing MYR-only callers are unaffected', () => {
    const accounts = [acct({ id: 'a', currency: 'MYR' })];
    const entries = [entry({ accountId: 'a', value: 500, asOf: '2026-05-01' })];
    expect(netWorthSeries(accounts, entries, ['2026-05'])[0].net).toBe(500);
  });

  it('converts foreign balances in each month point', () => {
    const accounts = [acct({ id: 'a', currency: 'CNY' })];
    const entries = [entry({ accountId: 'a', value: 1000, asOf: '2026-05-01' })];
    expect(netWorthSeries(accounts, entries, ['2026-05'], { CNY: 0.63 })[0].net).toBe(630);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/networth.test.ts`
Expected: FAIL, `toMyrValues is not a function`.

- [ ] **Step 3: Implement the conversion**

In `src/lib/networth.ts`, add the imports `import { rateFor } from './fx';` and `import { round2 } from './currency';`, then add after `netWorth`:

```ts
export interface ConvertedValues {
  /** MYR values, keyed by account id. An account with no usable rate is absent. */
  valueById: Record<string, number>;
  /** Account ids that could not be converted, for the "rate unavailable" row hint. */
  unconvertible: string[];
}

/**
 * Convert native account values into MYR.
 *
 * An account with no rate is omitted from `valueById` entirely rather than defaulting to
 * its native number. `netWorth` and `groupByClass` both read `valueById[id] ?? 0`, so
 * omission excludes it from the total, which is the required behaviour: counting a foreign
 * balance at 1:1 is the bug this feature exists to fix, and doing it in a fallback path
 * would make it look deliberate.
 */
export function toMyrValues(
  accounts: Account[],
  valueById: Record<string, number>,
  rates: Record<string, number>
): ConvertedValues {
  const out: Record<string, number> = {};
  const unconvertible: string[] = [];
  for (const a of accounts) {
    if (a.archived) continue;
    const rate = rateFor(rates, a.currency);
    if (rate == null) {
      unconvertible.push(a.id);
      continue;
    }
    out[a.id] = round2((valueById[a.id] ?? 0) * rate);
  }
  return { valueById: out, unconvertible };
}
```

Then change `netWorthSeries` to accept and apply rates:

```ts
export function netWorthSeries(
  accounts: Account[],
  entries: BalanceEntry[],
  monthKeys: string[],
  rates: Record<string, number> = {}
): NetWorthPoint[] {
  const byAccount: Record<string, BalanceEntry[]> = {};
  for (const e of entries) (byAccount[e.accountId] ??= []).push(e);
  return monthKeys.map((mk) => {
    const upper = `${mk}-31`; // string upper bound for the month (safe for YYYY-MM-DD compare)
    const native: Record<string, number> = {};
    for (const a of accounts) native[a.id] = accountValueAsOf(byAccount[a.id] ?? [], upper);
    const { valueById } = toMyrValues(accounts, native, rates);
    return { monthKey: mk, ...netWorth(accounts, valueById) };
  });
}
```

The default `{}` plus `rateFor` short-circuiting MYR to 1 means every existing call site is unaffected.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/networth.test.ts`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 5: Wire the screens**

In `src/screens/NetWorthScreen.tsx`:

- Load `listFxRates()` and build the table with `ratesFromCache`.
- Pass native values through `toMyrValues` before handing them to `netWorth` and `groupByClass`.
- Render each account row's balance as `fmtMoney(nativeValue, account.currency)`.
- For a non-MYR account, add a muted subtitle `≈ ${fmtMoney(convertedValue, 'MYR')}`, appending `, ${staleLabel(asOf)}` when `isStale(asOf)`.
- For an account id in `unconvertible`, render `rate unavailable` in place of the subtitle.

In `src/screens/NetWorthHistoryScreen.tsx`, pass the same rate table as the fourth argument to `netWorthSeries`.

- [ ] **Step 6: Let accounts be created in a currency**

In `src/db/accountsRepo.ts`, add a `currency: string = 'MYR'` parameter to `addAccount` and include the column in its INSERT. Add the chip to the account-creation form, gated on `isMultiCurrency` exactly as in Task 7.

- [ ] **Step 7: Typecheck and commit**

Run: `npx jest && npm run typecheck`

```bash
git add src/lib/networth.ts src/db/accountsRepo.ts src/screens/NetWorthScreen.tsx src/screens/NetWorthHistoryScreen.tsx __tests__/networth.test.ts
git commit -m "feat(currency): convert foreign account balances into net worth at live rates"
```

---

### Task 10: Scan and import currency detection

**Files:**
- Modify: `src/llm/extractPrompt.ts:17`, `:73`, `:78`, `:82`, `:114-115`, `:132`
- Modify: `src/lib/parseExtraction.ts`, `src/lib/parseReceipt.ts`, `src/lib/parseSnapshot.ts`
- Modify: `src/lib/advancedImport.ts:97` (stop discarding `currency`)
- Modify: `src/screens/ImportReviewScreen.tsx`, `src/screens/ReceiptScanScreen.tsx`
- Test: `__tests__/parseExtraction.test.ts`, `__tests__/advancedImport.test.ts`

**Interfaces:**
- Consumes: `currencyMeta` (Task 1); `activateCurrency`, `getActiveCurrencies` (Task 5).
- Produces: `ExtractedTxn`, `ScannedReceipt`, `ScannedSnapshot` each gain `currency: string`.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/parseExtraction.test.ts`:

```ts
describe('currency extraction', () => {
  it('defaults to MYR when the model returns no currency', () => {
    const parsed = parseExtraction(JSON.stringify([{ merchant: 'Kedai', amount: 12.5, date: '2026-08-01' }]));
    expect(parsed[0].currency).toBe('MYR');
  });

  it('reads a supported currency code from the model', () => {
    const parsed = parseExtraction(JSON.stringify([{ merchant: 'Haidilao', amount: 128, date: '2026-08-01', currency: 'CNY' }]));
    expect(parsed[0].currency).toBe('CNY');
  });

  it('uppercases a lowercase code', () => {
    const parsed = parseExtraction(JSON.stringify([{ merchant: 'X', amount: 1, date: '2026-08-01', currency: 'cny' }]));
    expect(parsed[0].currency).toBe('CNY');
  });

  it('falls back to MYR for an unsupported code rather than failing the extraction', () => {
    const parsed = parseExtraction(JSON.stringify([{ merchant: 'X', amount: 1, date: '2026-08-01', currency: 'ZZZ' }]));
    expect(parsed[0].currency).toBe('MYR');
  });
});
```

Adjust the import and the exact `parseExtraction` call shape to match what the file already does. Read the existing tests in that file first and follow their conventions.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/parseExtraction.test.ts`
Expected: FAIL, `currency` is undefined.

- [ ] **Step 3: Add a shared normaliser**

Append to `src/lib/currency.ts`:

```ts
/**
 * Normalise a currency code coming out of an LLM extraction. Anything unrecognised falls
 * back to the base currency: a bad code should never fail an otherwise good extraction,
 * and MYR is the correct guess for this app's users by a wide margin.
 */
export function normalizeCurrency(raw: unknown): string {
  if (typeof raw !== 'string') return BASE_CURRENCY;
  const code = raw.trim().toUpperCase();
  return currencyMeta(code) ? code : BASE_CURRENCY;
}
```

- [ ] **Step 4: Update the prompts**

In `src/llm/extractPrompt.ts`, each schema block gains a `currency` field and each worked example stops implying MYR is the only possibility:

- Line 17: change `"amount": number  positive value, no currency symbol,` to keep that line and add on the next line: `"currency": "3-letter ISO code read from the symbol or text shown, e.g. \"MYR\", \"CNY\", \"SGD\"  use \"MYR\" if none is shown",`
- Line 73: change the example to `(e.g. "RM 1,234.50" -> 1234.50, "¥128.00" -> 128.00)` and add the same `currency` field to that schema block.
- Line 78: change `showing one main MYR amount` to `showing one main balance amount`.
- Lines 114-115 and 132: same treatment, keep the strip-the-symbol instruction but add the currency field so the symbol is reported rather than lost.

- [ ] **Step 5: Thread it through the parsers**

Add `currency: string` to `ExtractedTxn` in `src/lib/types.ts`, to `ScannedReceipt` in `src/lib/parseReceipt.ts`, and to `ScannedSnapshot` in `src/lib/parseSnapshot.ts`. In each parser, set it via `normalizeCurrency(raw.currency)`.

Adding a required field breaks every existing test fixture that builds one of these objects as a literal. Run `npm run typecheck` and add `currency: 'MYR'` to each one the compiler flags, exactly as Task 3 Step 5 did for `Account`. Do not make the field optional to dodge this: an optional currency is how a foreign amount silently becomes MYR further down the pipeline.

In `src/lib/advancedImport.ts:97`, the `currency?: unknown` field is already declared and already populated by the prompt at line 48. Stop discarding it: run it through `normalizeCurrency` and carry it onto the parsed account.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx jest __tests__/parseExtraction.test.ts __tests__/advancedImport.test.ts`
Expected: PASS.

- [ ] **Step 7: Add the self-revealing path**

In `src/screens/ImportReviewScreen.tsx` and `src/screens/ReceiptScanScreen.tsx`, when a parsed row's currency is not in `getActiveCurrencies()`, show an inline button reading `Add CNY` (substituting the code) that calls `activateCurrency`. On success the rows re-render with the detected currency. On failure show the same offline message as Task 5.

Do not route the user to Settings. This is the discovery path for the target user and it must not cost them their place in the flow.

- [ ] **Step 8: Verify by hand**

Scan a receipt in a foreign currency with only MYR active. Confirm the review screen offers `Add CNY`, that accepting it converts the row, and that saving produces a transaction whose dashboard contribution is the converted value.

- [ ] **Step 9: Typecheck and commit**

Run: `npx jest && npm run typecheck`

```bash
git add src/llm/extractPrompt.ts src/lib/parseExtraction.ts src/lib/parseReceipt.ts src/lib/parseSnapshot.ts src/lib/advancedImport.ts src/lib/currency.ts src/lib/types.ts src/screens/ImportReviewScreen.tsx src/screens/ReceiptScanScreen.tsx __tests__/parseExtraction.test.ts __tests__/advancedImport.test.ts
git commit -m "feat(currency): detect currency from scans and imports"
```

---

### Task 11: Splits in a foreign currency

A CNY 100 debt is a CNY 100 debt and never moves with FX. The managed receivable account is MYR, so the split owns the rate its receivable was raised at.

**Files:**
- Modify: `src/db/db.ts` (two `ALTER TABLE` migrations)
- Modify: `src/db/splitRepo.ts`
- Modify: `src/lib/split.ts`
- Modify: `src/components/SplitSheet.tsx`, `src/screens/OwedScreen.tsx`
- Test: `__tests__/split.test.ts`

**Interfaces:**
- Consumes: `deriveMyr`, `round2` (Task 1); `fmtMoney` (Task 2).
- Produces: `splits` rows carry `currency` and `fx_rate`.

- [ ] **Step 1: Add the migrations**

In `src/db/db.ts`, alongside the Task 3 migrations:

```ts
  // Migration: splits inherit their parent transaction's currency and frozen rate. The
  // rate is copied rather than looked up because the receivable account is MYR: a payment
  // settled months later must reduce it at the same rate it was raised at, or the balance
  // never returns to zero.
  try {
    await db.execAsync("ALTER TABLE splits ADD COLUMN currency TEXT NOT NULL DEFAULT 'MYR'");
  } catch {
    // column already present
  }
  try {
    await db.execAsync('ALTER TABLE splits ADD COLUMN fx_rate REAL');
  } catch {
    // column already present
  }
```

- [ ] **Step 2: Write the failing test**

Add to `__tests__/split.test.ts`. Match the existing helper and import conventions in that file:

```ts
describe('foreign currency splits', () => {
  it('keeps share amounts in the native currency', () => {
    // A CNY 100 bill split evenly between two people leaves CNY 50 owed, not RM 31.50.
    const shares = evenShares(100, 2);
    expect(shares).toEqual([50, 50]);
  });

  it('converts the receivable at the split rate, not at a later one', () => {
    expect(receivableMyr(50, 0.63)).toBe(31.5);
  });

  it('a payment settles the receivable at the same rate it was raised at', () => {
    // Raised at 0.63 in March, paid in September. The receivable must reach exactly zero.
    const raised = receivableMyr(50, 0.63);
    const settled = receivableMyr(50, 0.63);
    expect(raised - settled).toBe(0);
  });
});
```

Add `receivableMyr(nativeAmount: number, fxRate: number): number` to `src/lib/split.ts` as `round2(nativeAmount * fxRate)`, and reuse the file's existing even-split helper for the first test rather than inventing `evenShares` if it is already named something else.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest __tests__/split.test.ts`
Expected: FAIL, `receivableMyr is not a function`.

- [ ] **Step 4: Implement and wire**

Add `receivableMyr` to `src/lib/split.ts`. In `src/db/splitRepo.ts`, copy `currency` and `fx_rate` from the parent transaction when a split is created, and use the stored `fx_rate` for every receivable adjustment including payments and write-offs.

- [ ] **Step 5: Update the display**

In `src/components/SplitSheet.tsx` and `src/screens/OwedScreen.tsx`, render every share, payment, and owed figure with `fmtMoney(amount, split.currency)`. The receivable total in net worth stays RM.

- [ ] **Step 6: Run the suite, verify by hand, commit**

Run: `npx jest && npm run typecheck`

Then split a CNY bill, record a partial payment, and confirm the owed figure reads in CNY and the receivable account reaches exactly zero when fully settled.

```bash
git add src/db/db.ts src/db/splitRepo.ts src/lib/split.ts src/components/SplitSheet.tsx src/screens/OwedScreen.tsx __tests__/split.test.ts
git commit -m "feat(currency): denominate splits in the parent transaction's currency"
```

---

### Task 12: Commitments in a foreign currency

**Files:**
- Modify: `src/db/db.ts` (two `ALTER TABLE` migrations)
- Modify: `src/db/commitmentsRepo.ts`
- Modify: `src/lib/commitments.ts`, `src/lib/commitmentRecord.ts`
- Modify: `src/screens/CommitmentsScreen.tsx`
- Test: `__tests__/commitments.test.ts`

**Interfaces:**
- Consumes: `deriveMyr` (Task 1); `fmtMoney` (Task 2); `rateFor`, `ratesFromCache` (Task 4).
- Produces: `Commitment` gains `currency: string`; `CommitmentOccurrence` gains `fxRate: number | null`.

- [ ] **Step 1: Add the migrations**

```ts
  // Migration: a commitment can be denominated in a foreign currency (CNY rent, say).
  // Each occurrence freezes its OWN rate when generated, so the RM cost genuinely varies
  // month to month, which is what actually happens.
  try {
    await db.execAsync("ALTER TABLE commitments ADD COLUMN currency TEXT NOT NULL DEFAULT 'MYR'");
  } catch {
    // column already present
  }
  try {
    await db.execAsync('ALTER TABLE commitment_occurrences ADD COLUMN fx_rate REAL');
  } catch {
    // column already present
  }
```

- [ ] **Step 2: Write the failing test**

Add to `__tests__/commitments.test.ts`:

```ts
describe('foreign currency commitments', () => {
  it('freezes each occurrence at the rate current when it was generated', () => {
    const march = occurrenceMyr(2000, 0.63);
    const april = occurrenceMyr(2000, 0.65);
    expect(march).toBe(1260);
    expect(april).toBe(1300);
    expect(march).not.toBe(april);
  });

  it('leaves the occurrences of a MYR commitment unconverted', () => {
    expect(occurrenceMyr(2000, 1)).toBe(2000);
  });
});
```

Add `occurrenceMyr(nativeAmount: number, fxRate: number): number` to `src/lib/commitments.ts` as `round2(nativeAmount * fxRate)`.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest __tests__/commitments.test.ts`
Expected: FAIL, `occurrenceMyr is not a function`.

- [ ] **Step 4: Implement**

Add `occurrenceMyr`. When generating an occurrence, look up the current rate for the commitment's currency and store it on the row. When an occurrence creates a transaction, pass `currency` and the occurrence's frozen `fxRate` into the `NewTxn` so the transaction and the occurrence agree.

- [ ] **Step 5: Update the UI**

In `src/screens/CommitmentsScreen.tsx`, show the commitment amount with `fmtMoney(amount, commitment.currency)` and add the currency chip to the create form, gated on `isMultiCurrency`. Monthly obligation totals stay RM.

- [ ] **Step 6: Run the suite and commit**

Run: `npx jest && npm run typecheck`

```bash
git add src/db/db.ts src/db/commitmentsRepo.ts src/lib/commitments.ts src/lib/commitmentRecord.ts src/screens/CommitmentsScreen.tsx __tests__/commitments.test.ts
git commit -m "feat(currency): allow foreign-currency commitments with per-occurrence rates"
```

---

### Task 13: Tax exclusion

Non-MYR transactions are excluded from relief structurally, at the query level, not in the screens. A UI-level filter is one refactor away from leaking a converted number into a tax filing.

**Files:**
- Modify: `src/db/reliefRepo.ts`
- Modify: `src/lib/relief.ts`
- Modify: `src/screens/TaxScreen.tsx`
- Modify: `src/lib/taxExport.ts`
- Test: `__tests__/relief.test.ts`

**Interfaces:**
- Consumes: `BASE_CURRENCY` (Task 1).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/relief.test.ts`. Match the existing fixture helpers in that file:

```ts
describe('foreign currency exclusion', () => {
  it('never auto-tags a non-MYR transaction', () => {
    const txns = [
      txn({ id: 't1', merchantRaw: 'Popular Bookstore', amount: 80, currency: 'MYR' }),
      txn({ id: 't2', merchantRaw: 'Popular Bookstore', amount: 80, currency: 'CNY' }),
    ];
    const tagged = suggestReliefTags(txns);
    expect(tagged.map((t) => t.txnId)).toEqual(['t1']);
  });

  it('reports a non-MYR transaction as ineligible with a reason', () => {
    expect(reliefEligibility(txn({ currency: 'CNY' }))).toEqual({
      eligible: false,
      reason: 'Only ringgit spending can be claimed for LHDN relief.',
    });
  });

  it('reports a MYR transaction as eligible', () => {
    expect(reliefEligibility(txn({ currency: 'MYR' })).eligible).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/relief.test.ts`
Expected: FAIL, `reliefEligibility is not a function`.

- [ ] **Step 3: Implement**

Add to `src/lib/relief.ts`:

```ts
export interface ReliefEligibility {
  eligible: boolean;
  reason?: string;
}

/**
 * LHDN reliefs require Malaysian-sourced spending with local documentation, and
 * `relief_tags.amount` is a fixed figure filed against a year of assessment, so it can
 * never be a converted number. Foreign rows are excluded outright.
 */
export function reliefEligibility(txn: Transaction): ReliefEligibility {
  if (txn.currency !== BASE_CURRENCY) {
    return { eligible: false, reason: 'Only ringgit spending can be claimed for LHDN relief.' };
  }
  return { eligible: true };
}
```

Make `suggestReliefTags` skip any transaction failing `reliefEligibility`.

- [ ] **Step 4: Enforce it at the query level**

In `src/db/reliefRepo.ts`, add `AND t.currency = 'MYR'` to every query that joins transactions for tagging, listing, or export. The screens must not be the only thing standing between a yuan figure and a Form BE line.

- [ ] **Step 5: Update the screens**

In `src/screens/TaxScreen.tsx`, hide the manual relief-tagging control on a non-MYR transaction and show `reliefEligibility(txn).reason` in its place. A disabled control with no explanation is worse than an absent one.

In `src/lib/taxExport.ts`, confirm the audit pack draws only from the filtered repo queries.

- [ ] **Step 6: Run the suite and commit**

Run: `npx jest && npm run typecheck`

```bash
git add src/db/reliefRepo.ts src/lib/relief.ts src/screens/TaxScreen.tsx src/lib/taxExport.ts __tests__/relief.test.ts
git commit -m "feat(currency): exclude non-MYR transactions from LHDN relief at query level"
```

---

### Task 14: Background rate refresh and final regression pass

**Files:**
- Modify: wherever the existing price refresh is triggered (find with `grep -rn "quotesMYR" src/`)
- Test: `__tests__/currency.test.ts` (regression)

**Interfaces:**
- Consumes: `getActiveCurrencies` (Task 5); `fetchRateMYR`, `saveFxRate` (Task 4).
- Produces: `refreshFxRates(): Promise<void>`

- [ ] **Step 1: Add the refresh**

Add to `src/db/currencyRepo.ts`:

```ts
/**
 * Refresh every active currency's cached rate. Best-effort and non-blocking: a failed
 * fetch leaves the previous cached rate in place, which is why entry never needs the
 * network. Piggybacks the existing price refresh trigger.
 */
export async function refreshFxRates(): Promise<void> {
  const active = await getActiveCurrencies();
  await Promise.all(
    active
      .filter((code) => code !== BASE_CURRENCY)
      .map(async (code) => {
        const rate = await fetchRateMYR(code);
        if (rate != null) await saveFxRate(code, rate);
      })
  );
}
```

Call it alongside the existing holdings price refresh. When only MYR is active it makes zero network calls, so a Malaysia-only install is unaffected.

- [ ] **Step 2: Write the invisibility regression test**

Add to `__tests__/currency.test.ts`:

```ts
describe('MYR-only invisibility', () => {
  it('an all-MYR ledger derives amounts identical to the raw entered values', () => {
    const entered = [12.5, 128, 1234.56, 0.99, 60];
    for (const amount of entered) {
      const d = deriveMyr(amount, 'MYR', null);
      expect(d.amount).toBe(round2(amount));
      expect(d.nativeAmount).toBeNull();
      expect(d.fxRate).toBeNull();
    }
  });

  it('an all-MYR total is unchanged by the conversion path', () => {
    const entered = [12.5, 128, 1234.56];
    const sum = entered.reduce((t, a) => t + deriveMyr(a, 'MYR', null).amount, 0);
    expect(round2(sum)).toBe(1375.06);
  });

  it('keeps the feature hidden with no active currencies configured', () => {
    expect(isMultiCurrency(parseActiveCurrencies(null))).toBe(false);
  });
});
```

- [ ] **Step 3: Run everything**

Run: `npx jest && npm run typecheck`
Expected: the entire suite passes.

- [ ] **Step 4: Manual regression on a MYR-only install**

On a device with a pre-existing MYR-only database and no currency activated, confirm the dashboard total, budget progress, net worth, streak, and recap all read exactly as they did before the branch. This is the acceptance gate for the 95% of users the feature is invisible to.

- [ ] **Step 5: Commit**

```bash
git add src/db/currencyRepo.ts __tests__/currency.test.ts
git commit -m "feat(currency): refresh active rates in background, add invisibility regression"
```

---

## Coverage against the spec

| Spec section | Tasks |
| --- | --- |
| §1 Core principle | 1, 6, 9 |
| §2.1 Supported currencies | 1 |
| §2.2 Transactions | 3, 6 |
| §2.3 Accounts | 3, 9 |
| §2.4 FX cache | 3, 4 |
| §2.5 Splits and commitments | 11, 12 |
| §2.6 Settings state | 5 |
| §3 Migration and defaults | 3, 14 |
| §4 FX engine | 4, 5, 14 |
| §5 Entry and display rules | 2, 7, 8, 9 |
| §5.2 Self-revealing path | 10 |
| §5.3 Settings screen | 5 |
| §6 Scan and import | 10 |
| §7 Tax exclusion | 13 |
| §8 Hazards 1 to 3 | 6 |
| §8 Hazard 4 (rounding) | 1 |
| §8 Hazard 5 (reset) | 3 |
| §8 Hazard 6 (split receivable) | 11 |
| §8 Hazard 7 (zero decimals) | 2, 7 |
| §9 Testing | throughout, plus 14 |
