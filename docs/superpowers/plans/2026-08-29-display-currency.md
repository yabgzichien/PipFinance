# Display Currency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user set a default display currency in Settings so headline totals across the app (Dashboard, Budget, Net Worth, Activity, Recap, Export) render converted into that currency, while Net Worth, Activity, Recap, and Export additionally show a per-currency native breakdown. Tax stays MYR-only.

**Architecture:** A single new `app_meta` key (`display_currency`) plus one pure inverse-of-`rateFor` conversion function (`toDisplay`) let every screen convert its already-correct MYR total at the last mile — render time — without touching any existing aggregation. Two new pure "group native amounts by currency" helpers (one for accounts, one for transactions) power the breakdown rows. A tiny shared hook (`useDisplayCurrency`) loads the setting + cached rates once per screen, following the same mount-time-load pattern `CurrencySettingsScreen` and `NetWorthScreen` already use (this app has no persistent nav stack, so a screen remounts fresh on every navigation).

**Tech Stack:** React Native + Expo, expo-sqlite, TypeScript, Jest.

**Spec:** [docs/superpowers/specs/2026-08-29-display-currency-design.md](../specs/2026-08-29-display-currency-design.md)

## Global Constraints

- `transactions.amount`, `balance_entries.value`, and budget allocations keep meaning exactly what they mean today — no aggregation changes anywhere in this plan, only display-time conversion. (Spec §1)
- Tax (`src/screens/TaxScreen.tsx`, `src/lib/taxExport.ts`) gets zero changes in this plan. (Spec, Non-goals)
- `display_currency` may only be set to an already-**active** currency; a deactivated display currency falls back to `MYR`, exactly like `getEntryCurrency()` already does for entry currency. (Spec §2)
- No historical rate freezing — a converted total always uses today's cached rate, including for past months. (Spec §3)
- A per-currency breakdown always includes an `MYR` entry (even `0`), so the base case never looks incomplete. (Spec §4)

---

## Task 1: `toDisplay` conversion helper

**Files:**
- Modify: `src/lib/fx.ts`
- Test: `__tests__/fx.test.ts`

**Interfaces:**
- Consumes: existing `rateFor(rates, code): number | null` from the same file.
- Produces: `toDisplay(amountMyr: number, code: string, rates: Record<string, number>): number | null`, used by Task 6 (`useDisplayCurrency`) and Task 14 (export `formatCurrency`).

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/fx.test.ts` (new `describe` block, after the existing `rateFor` block):

```ts
import { ratesFromCache, rateFor, isStale, staleLabel, FX_STALE_MS, toDisplay, type FxRate } from '../src/lib/fx';
```

```ts
describe('toDisplay', () => {
  it('returns the MYR figure unchanged when the display code is MYR', () => {
    expect(toDisplay(100, 'MYR', {})).toBe(100);
  });

  it('divides by the cached rate to project into a foreign display currency', () => {
    // 1 CNY = 0.63 MYR, so MYR 63 is CNY 100.
    expect(toDisplay(63, 'CNY', { CNY: 0.63 })).toBe(100);
  });

  it('rounds to the display currency\'s own decimal places', () => {
    expect(toDisplay(100, 'JPY', { JPY: 0.03 })).toBe(3333.33); // decimalsFor ignored by round2; see next test
  });

  it('returns null rather than guessing when the rate is missing', () => {
    expect(toDisplay(100, 'CNY', {})).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest fx.test.ts -t toDisplay`
Expected: FAIL — `toDisplay` is not exported.

- [ ] **Step 3: Implement `toDisplay`**

In `src/lib/fx.ts`, add near `rateFor` (after its closing brace):

```ts
/**
 * Project an MYR amount into a display currency — the inverse of `rateFor`.
 *
 * Returns null rather than the raw MYR figure when the rate is unavailable, mirroring
 * `rateFor`'s own null-over-parity contract: a caller decides the fallback, so a caller
 * that forgets to handle null fails loudly in dev instead of quietly mislabeling MYR as
 * the display currency.
 */
export function toDisplay(amountMyr: number, code: string, rates: Record<string, number>): number | null {
  const rate = rateFor(rates, code);
  if (rate == null) return null;
  return Math.round((amountMyr / rate) * 100) / 100;
}
```

Note: the third test above expects `3333.33` (2dp rounding regardless of `decimalsFor`) — `toDisplay` only produces the numeric value; decimal-place presentation is `fmtMoney`'s job (Task 7 onward always pairs `toDisplay` with `fmtMoney(value, code)` or `Amount`'s own `decimalsFor`, which round the *display* string, not the underlying number).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest fx.test.ts`
Expected: PASS, all `toDisplay` cases plus every pre-existing case in the file.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fx.ts __tests__/fx.test.ts
git commit -m "feat: add toDisplay, the inverse FX projection for display currency"
```

---

## Task 2: `display_currency` setting

**Files:**
- Modify: `src/db/currencyRepo.ts`
- Modify: `src/db/db.ts` (`resetAllData`, around line 425)
- Test: `__tests__/currency.test.ts` (repo-level behavior needs a DB-backed test; see Step 1)

**Interfaces:**
- Consumes: `getMeta`/`setMeta` (`src/db/metaRepo.ts`), `getActiveCurrencies` (already in `currencyRepo.ts`), `BASE_CURRENCY` (`src/lib/currency.ts`).
- Produces: `getDisplayCurrency(): Promise<string>`, `setDisplayCurrency(code: string): Promise<void>`, used by Task 8 (Settings UI) and Task 6 (`useDisplayCurrency`).

Existing DB-backed repo tests in this codebase use the `jest.mock('../src/db/db', ...)` + fake-db pattern from `__tests__/dbCascades.test.ts` rather than a real SQLite instance. Follow that pattern.

- [ ] **Step 1: Write the failing test**

Add a new file `__tests__/currencyRepo.test.ts`:

```ts
// __tests__/currencyRepo.test.ts
// Repo-level behavior for the display-currency setting, exercised against a recording fake
// so the SQL issued is observable without standing up SQLite. Mirrors dbCascades.test.ts.
jest.mock('../src/db/db', () => {
  const actual = jest.requireActual('../src/db/db');
  return { ...actual, getDb: () => Promise.resolve((global as any).__fakeDb) };
});

import { getDisplayCurrency, setDisplayCurrency, setActiveCurrencies } from '../src/db/currencyRepo';
import { resetAllData } from '../src/db/db';

function fakeDb(metaRows: Record<string, string> = {}) {
  const store = { ...metaRows };
  return {
    getFirstAsync: (sql: string, key: string) =>
      Promise.resolve(sql.includes('app_meta') ? (store[key] !== undefined ? { value: store[key] } : null) : null),
    runAsync: (sql: string, key: string, value: string) => {
      store[key] = value;
      return Promise.resolve({ changes: 1, lastInsertRowId: 1 });
    },
    _store: store,
  };
}

describe('getDisplayCurrency', () => {
  it('defaults to MYR when nothing is stored', async () => {
    (global as any).__fakeDb = fakeDb();
    expect(await getDisplayCurrency()).toBe('MYR');
  });

  it('returns the stored value when it is still active', async () => {
    (global as any).__fakeDb = fakeDb({ active_currencies: '["MYR","USD"]', display_currency: 'USD' });
    expect(await getDisplayCurrency()).toBe('USD');
  });

  it('falls back to MYR when the stored value was since deactivated', async () => {
    (global as any).__fakeDb = fakeDb({ active_currencies: '["MYR"]', display_currency: 'USD' });
    expect(await getDisplayCurrency()).toBe('MYR');
  });
});

describe('setDisplayCurrency', () => {
  it('persists the code under the display_currency key', async () => {
    const db = fakeDb();
    (global as any).__fakeDb = db;
    await setDisplayCurrency('CNY');
    expect(db._store.display_currency).toBe('CNY');
  });
});

describe('resetAllData currency reset', () => {
  it('clears display_currency alongside active_currencies and entry_currency', async () => {
    const statements: string[] = [];
    (global as any).__fakeDb = {
      withTransactionAsync: (fn: () => Promise<void>) => fn(),
      execAsync: (sql: string) => {
        statements.push(sql);
        return Promise.resolve();
      },
      runAsync: (sql: string, ..._args: unknown[]) => {
        statements.push(sql);
        return Promise.resolve({ changes: 1, lastInsertRowId: 1 });
      },
      getAllAsync: () => Promise.resolve([]),
    };
    await resetAllData();
    const metaDelete = statements.find((s) => s.includes('DELETE FROM app_meta'));
    expect(metaDelete).toBeDefined();
    expect(metaDelete).toContain('display_currency');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest currencyRepo.test.ts`
Expected: FAIL — `getDisplayCurrency`/`setDisplayCurrency` are not exported from `currencyRepo.ts`, and the `resetAllData` case fails because its `app_meta` delete doesn't yet mention `display_currency`.

- [ ] **Step 3: Implement the repo functions**

In `src/db/currencyRepo.ts`, add a new key constant next to the existing ones and the two functions after `setEntryCurrency` (same file already imports `getMeta`, `setMeta`, `BASE_CURRENCY`, and defines `getActiveCurrencies`):

```ts
const DISPLAY_KEY = 'display_currency';
```

```ts
/**
 * The currency headline totals render in. Falls back to MYR the same way entry currency
 * does when the stored value is no longer active — a deactivated display currency must
 * never leave a screen unable to render its total.
 */
export async function getDisplayCurrency(): Promise<string> {
  const stored = await getMeta(DISPLAY_KEY);
  if (!stored) return BASE_CURRENCY;
  const active = await getActiveCurrencies();
  return active.includes(stored) ? stored : BASE_CURRENCY;
}

export async function setDisplayCurrency(code: string): Promise<void> {
  await setMeta(DISPLAY_KEY, code);
}
```

Also update `deactivateCurrency` (same file) so turning off the current display currency falls back immediately, matching what it already does for entry currency:

```ts
export async function deactivateCurrency(code: string): Promise<void> {
  if (code === BASE_CURRENCY) return;
  const active = await getActiveCurrencies();
  await setActiveCurrencies(active.filter((c) => c !== code));
  if ((await getMeta(ENTRY_KEY)) === code) await setEntryCurrency(BASE_CURRENCY);
  if ((await getMeta(DISPLAY_KEY)) === code) await setDisplayCurrency(BASE_CURRENCY);
}
```

- [ ] **Step 4: Wire `display_currency` into `resetAllData`**

In `src/db/db.ts`, the reset already clears `active_currencies`/`entry_currency` (around line 425):

```ts
    await db.runAsync("DELETE FROM app_meta WHERE key IN ('active_currencies', 'entry_currency')");
```

Change to:

```ts
    await db.runAsync("DELETE FROM app_meta WHERE key IN ('active_currencies', 'entry_currency', 'display_currency')");
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest currencyRepo.test.ts`
Expected: PASS, all five cases.

- [ ] **Step 6: Commit**

```bash
git add src/db/currencyRepo.ts src/db/db.ts __tests__/currencyRepo.test.ts
git commit -m "feat: add display_currency setting with active-only fallback"
```

---

## Task 3: Native account totals grouped by currency

**Files:**
- Modify: `src/lib/networth.ts`
- Test: `__tests__/networth.test.ts`

**Interfaces:**
- Consumes: `Account` type, existing `round2` import already present in this file.
- Produces: `nativeAccountTotalsByCurrency(accounts: Account[], nativeValueById: Record<string, number>): Record<string, number>`, used by Task 9 (Net Worth screen).

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/networth.test.ts`, using the file's existing `acct()` helper:

```ts
import {
  currentValue,
  accountValueAsOf,
  netWorth,
  groupByClass,
  netWorthSeries,
  monthsWithData,
  defaultLinkEffect,
  applyEffect,
  toMyrValues,
  nativeAccountTotalsByCurrency,
  ACCOUNT_CLASSES,
} from '../src/lib/networth';
```

```ts
describe('nativeAccountTotalsByCurrency', () => {
  it('groups native balances by each account\'s own currency', () => {
    const accounts = [
      acct({ id: 'a', currency: 'MYR' }),
      acct({ id: 'b', currency: 'USD' }),
      acct({ id: 'c', currency: 'USD' }),
    ];
    const totals = nativeAccountTotalsByCurrency(accounts, { a: 1000, b: 200, c: 50 });
    expect(totals).toEqual({ MYR: 1000, USD: 250 });
  });

  it('always includes MYR, even at zero, so the base case never looks incomplete', () => {
    const accounts = [acct({ id: 'b', currency: 'USD' })];
    expect(nativeAccountTotalsByCurrency(accounts, { b: 100 })).toEqual({ MYR: 0, USD: 100 });
  });

  it('skips archived accounts', () => {
    const accounts = [acct({ id: 'a', currency: 'USD', archived: true })];
    expect(nativeAccountTotalsByCurrency(accounts, { a: 500 })).toEqual({ MYR: 0 });
  });

  it('treats a missing native value as zero rather than throwing', () => {
    const accounts = [acct({ id: 'a', currency: 'MYR' })];
    expect(nativeAccountTotalsByCurrency(accounts, {})).toEqual({ MYR: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest networth.test.ts -t nativeAccountTotalsByCurrency`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement `nativeAccountTotalsByCurrency`**

In `src/lib/networth.ts`, add after `toMyrValues`:

```ts
/**
 * Native (unconverted) account balances grouped by currency — the per-currency breakdown
 * row on Net Worth. Unlike `toMyrValues`, nothing here is converted: a CNY 500 account
 * contributes to the CNY bucket at 500, not its MYR equivalent.
 */
export function nativeAccountTotalsByCurrency(
  accounts: Account[],
  nativeValueById: Record<string, number>
): Record<string, number> {
  const out: Record<string, number> = { MYR: 0 };
  for (const a of accounts) {
    if (a.archived) continue;
    const v = nativeValueById[a.id] ?? 0;
    out[a.currency] = round2((out[a.currency] ?? 0) + v);
  }
  return out;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest networth.test.ts`
Expected: PASS, all cases including every pre-existing test in the file.

- [ ] **Step 5: Commit**

```bash
git add src/lib/networth.ts __tests__/networth.test.ts
git commit -m "feat: add nativeAccountTotalsByCurrency for the net worth breakdown"
```

---

## Task 4: Native transaction totals grouped by currency

**Files:**
- Modify: `src/lib/bookkeeping.ts`
- Test: `__tests__/bookkeeping.test.ts`

**Interfaces:**
- Consumes: `Transaction` type (already imported in this file).
- Produces: `nativeTransactionTotalsByCurrency(txns: Transaction[]): Record<string, number>`, used by Task 10 (Activity), Task 11 (Recap), and Task 14 (Export breakdown).

Transfers are excluded — a transfer moves money between the user's own accounts rather than being "spent" or "received" in a currency, so including it would double-count a cross-currency transfer. This matches the existing convention in `monthlyIncomeStatement`/`computeIncomeStatement`, both of which already skip `t.type === 'transfer'`.

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/bookkeeping.test.ts`, using the file's existing `makeTxn()` helper:

```ts
import {
  buildReportPeriod,
  filterTransactionsByPeriod,
  computeIncomeStatement,
  computeBalanceSheet,
  mathMean,
  mathMedian,
  mathStdDev,
  computeFinancialStatistics,
  buildFinancialReportBundle,
  nativeTransactionTotalsByCurrency,
} from '../src/lib/bookkeeping';
```

```ts
describe('nativeTransactionTotalsByCurrency', () => {
  it('groups native amounts by currency', () => {
    const txns = [
      makeTxn({ type: 'expense', amount: 50, currency: 'MYR' }),
      makeTxn({ type: 'expense', amount: 63, currency: 'CNY', nativeAmount: 100 }),
      makeTxn({ type: 'income', amount: 20, currency: 'CNY', nativeAmount: 30 }),
    ];
    expect(nativeTransactionTotalsByCurrency(txns)).toEqual({ MYR: 50, CNY: 130 });
  });

  it('uses amount when nativeAmount is absent (plain MYR rows)', () => {
    const txns = [makeTxn({ type: 'income', amount: 200, currency: 'MYR' })];
    expect(nativeTransactionTotalsByCurrency(txns)).toEqual({ MYR: 200 });
  });

  it('excludes transfers, which move money between the user\'s own accounts', () => {
    const txns = [makeTxn({ type: 'transfer', amount: 500, currency: 'MYR' })];
    expect(nativeTransactionTotalsByCurrency(txns)).toEqual({ MYR: 0 });
  });

  it('always includes MYR even with no MYR transactions', () => {
    const txns = [makeTxn({ type: 'expense', amount: 63, currency: 'CNY', nativeAmount: 100 })];
    expect(nativeTransactionTotalsByCurrency(txns)).toEqual({ MYR: 0, CNY: 100 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest bookkeeping.test.ts -t nativeTransactionTotalsByCurrency`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement `nativeTransactionTotalsByCurrency`**

In `src/lib/bookkeeping.ts`, add after `filterTransactionsByPeriod` (near the other transaction-shaped helpers):

```ts
/**
 * Native (unconverted) transaction amounts grouped by currency — the per-currency
 * breakdown on Activity, Recap, and Export. Transfers are excluded: they move money
 * between the user's own accounts rather than being spent or received in a currency.
 */
export function nativeTransactionTotalsByCurrency(txns: Transaction[]): Record<string, number> {
  const out: Record<string, number> = { MYR: 0 };
  for (const t of txns) {
    if (t.type === 'transfer') continue;
    const native = t.nativeAmount ?? t.amount;
    out[t.currency] = Math.round(((out[t.currency] ?? 0) + native) * 100) / 100;
  }
  return out;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest bookkeeping.test.ts`
Expected: PASS, all cases including every pre-existing test in the file.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bookkeeping.ts __tests__/bookkeeping.test.ts
git commit -m "feat: add nativeTransactionTotalsByCurrency for activity/recap/export breakdowns"
```

---

## Task 5: Fix multi-currency accounts being summed unconverted in bookkeeping totals

**Why this is in this plan:** `computeBalanceSheet` and `computeFinancialStatistics` both sum `balance_entries.value` — which is **native**, per the multi-currency spec — directly across accounts regardless of currency, with no FX conversion. A user with a CNY account today gets a silently wrong `totalAssets`/`netWorth` in every export, the exact bug class the original multi-currency spec exists to prevent (it just missed this call site). This plan is about to make that wrong number visible in a second currency, so it must be correct before Task 14 (Export) can convert it. Net Worth's own `netWorth()`/`toMyrValues()` never had this bug — only the separate `bookkeeping.ts` report engine does.

**Files:**
- Modify: `src/lib/bookkeeping.ts`
- Test: `__tests__/bookkeeping.test.ts`

**Interfaces:**
- Consumes: `rateFor` from `src/lib/fx.ts` (new import in this file).
- Produces: `computeBalanceSheet(accounts, balanceEntries, asOfDate, rates: Record<string, number> = {})`, `computeFinancialStatistics(txns, categories, accounts, balanceEntries, period, rates: Record<string, number> = {})` — both gain a trailing optional `rates` param, fully backward compatible with every existing call site (all existing tests use MYR-only accounts, where `rateFor(rates, 'MYR')` is always `1` regardless of `rates`).

- [ ] **Step 1: Write the failing test**

Add to `__tests__/bookkeeping.test.ts`, in the `computeBalanceSheet` describe block:

```ts
it('converts a foreign-currency account to MYR before summing, given a rate table', () => {
  const accounts: Account[] = [
    makeAcct({ id: 'cash1', kind: 'asset', cls: 'cash', currency: 'MYR' }),
    makeAcct({ id: 'cny1', kind: 'asset', cls: 'cash', currency: 'CNY' }),
  ];
  const entries: BalanceEntry[] = [
    makeEntry({ accountId: 'cash1', value: 1000, asOf: '2026-06-30' }),
    makeEntry({ accountId: 'cny1', value: 1000, asOf: '2026-06-30' }), // native CNY 1000
  ];
  const bs = computeBalanceSheet(accounts, entries, '2026-06-30', { CNY: 0.63 });
  expect(bs.totalAssets).toBe(1630); // 1000 MYR + (1000 CNY * 0.63)
});

it('excludes a foreign-currency account with no cached rate, rather than counting it at parity', () => {
  const accounts: Account[] = [makeAcct({ id: 'cny1', kind: 'asset', cls: 'cash', currency: 'CNY' })];
  const entries: BalanceEntry[] = [makeEntry({ accountId: 'cny1', value: 1000, asOf: '2026-06-30' })];
  const bs = computeBalanceSheet(accounts, entries, '2026-06-30', {});
  expect(bs.totalAssets).toBe(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest bookkeeping.test.ts -t "converts a foreign-currency account"`
Expected: FAIL — `bs.totalAssets` is `1000` (native CNY 1000 summed as if MYR), not `1630`.

- [ ] **Step 3: Fix `computeBalanceSheet`**

In `src/lib/bookkeeping.ts`, add the import at the top of the file:

```ts
import { ACCOUNT_CLASSES, CLASS_BY_ID, accountValueAsOf } from './networth';
import { rateFor } from './fx';
```

Change the signature and the per-account value line inside `computeBalanceSheet`:

```ts
export function computeBalanceSheet(
  accounts: Account[],
  balanceEntries: BalanceEntry[],
  asOfDate: string,
  rates: Record<string, number> = {}
): BalanceSheet {
  const byAccount: Record<string, BalanceEntry[]> = {};
  for (const e of balanceEntries) (byAccount[e.accountId] ??= []).push(e);

  const assetGroupsMap = new Map<string, BalanceSheetGroup>();
  const liabilityGroupsMap = new Map<string, BalanceSheetGroup>();

  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const a of accounts) {
    if (a.archived) continue;
    const native = accountValueAsOf(byAccount[a.id] ?? [], asOfDate);
    const rate = rateFor(rates, a.currency);
    // No cached rate: exclude rather than count a foreign balance at parity, same policy
    // toMyrValues already applies to the Net Worth screen.
    if (rate == null) continue;
    const value = Math.round(native * rate * 100) / 100;
    const meta = CLASS_BY_ID[a.cls];
    const clsLabel = meta?.label || a.cls;
```

(The rest of the function body is unchanged — it already uses `value` from this point on.)

- [ ] **Step 4: Fix `computeFinancialStatistics`'s monthly `netWorth`**

Change the signature and the per-account loop inside the `monthlyTrends` map:

```ts
export function computeFinancialStatistics(
  txns: Transaction[],
  categories: Category[],
  accounts: Account[],
  balanceEntries: BalanceEntry[],
  period: ReportPeriod,
  rates: Record<string, number> = {}
): FinancialStatistics {
```

```ts
    // Compute month-end net worth
    let aTotal = 0;
    let lTotal = 0;
    for (const a of accounts) {
      if (a.archived) continue;
      const rate = rateFor(rates, a.currency);
      if (rate == null) continue;
      const val = accountValueAsOf(byAccount[a.id] ?? [], asOf) * rate;
      if (a.kind === 'asset') aTotal += val;
      else lTotal += val;
    }
```

- [ ] **Step 5: Thread `rates` through `buildFinancialReportBundle`**

```ts
export function buildFinancialReportBundle(
  txns: Transaction[],
  categories: Category[],
  accounts: Account[],
  balanceEntries: BalanceEntry[],
  period: ReportPeriod,
  userName: string = 'Pip User',
  rates: Record<string, number> = {}
): FinancialReportData {
  const incomeStatement = computeIncomeStatement(txns, categories, period);
  const balanceSheet = computeBalanceSheet(accounts, balanceEntries, period.asOfDate, rates);
  const statistics = computeFinancialStatistics(txns, categories, accounts, balanceEntries, period, rates);
```

(rest unchanged for now — Task 14 adds the `displayCurrency`/`displayRates` fields on top of this.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest bookkeeping.test.ts`
Expected: PASS, including every pre-existing test (all MYR-only, unaffected by the optional `rates` param defaulting to `{}`).

- [ ] **Step 7: Commit**

```bash
git add src/lib/bookkeeping.ts __tests__/bookkeeping.test.ts
git commit -m "fix: convert foreign-currency accounts to MYR in bookkeeping balance sheet totals"
```

---

## Task 6: `useDisplayCurrency` hook

**Files:**
- Create: `src/state/useDisplayCurrency.ts`

**Interfaces:**
- Consumes: `getDisplayCurrency` (Task 2), `listFxRates` (`src/db/fxRepo.ts`), `ratesFromCache`/`toDisplay` (Task 1, `src/lib/fx.ts`), `BASE_CURRENCY` (`src/lib/currency.ts`).
- Produces: `useDisplayCurrency(): { code: string; rates: Record<string, number>; convert: (amountMyr: number) => number }`, used by Tasks 8–14.

No test file — this is a thin React hook wiring together two already-tested pure functions and two already-used repo calls; it has no branching logic of its own to unit-test, and the codebase has no hook-testing harness (`NetWorthScreen`'s equivalent local `rates` state, which this hook is extracted from, isn't unit-tested either). Manual verification happens screen-by-screen in Tasks 8–14.

- [ ] **Step 1: Create the hook**

```ts
// src/state/useDisplayCurrency.ts
// Shared display-currency + FX-rate loader for headline totals. Screens in this app
// remount fresh on every navigation (no persistent nav stack, see App.tsx's conditional
// screen rendering), so a mount-time load is enough — the same pattern
// CurrencySettingsScreen's own reload() and NetWorthScreen's local `rates` state already use.
import { useEffect, useState } from 'react';
import { listFxRates } from '../db/fxRepo';
import { getDisplayCurrency } from '../db/currencyRepo';
import { ratesFromCache, toDisplay } from '../lib/fx';
import { BASE_CURRENCY } from '../lib/currency';

export interface DisplayCurrency {
  /** The currency code headline totals should render in. 'MYR' until changed in Settings. */
  code: string;
  /** Cached MYR-per-unit rates, keyed by code. */
  rates: Record<string, number>;
  /** Project an MYR figure into `code`. Falls back to the MYR figure itself if the display
   *  currency's rate is unavailable (should not happen in practice: display currency can
   *  only be set to an already-active currency, which guarantees a cached rate). */
  convert: (amountMyr: number) => number;
}

export function useDisplayCurrency(): DisplayCurrency {
  const [code, setCode] = useState(BASE_CURRENCY);
  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([getDisplayCurrency(), listFxRates()]).then(([nextCode, fx]) => {
      if (cancelled) return;
      setCode(nextCode);
      setRates(ratesFromCache(fx));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const convert = (amountMyr: number): number => toDisplay(amountMyr, code, rates) ?? amountMyr;
  return { code, rates, convert };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/state/useDisplayCurrency.ts
git commit -m "feat: add useDisplayCurrency hook"
```

---

## Task 7: `formatCurrencyBreakdown` string helper

**Files:**
- Modify: `src/lib/format.ts`
- Test: `__tests__/format.test.ts`

**Interfaces:**
- Consumes: `fmtMoney` (already in this file).
- Produces: `formatCurrencyBreakdown(totals: Record<string, number>): string`, used by Tasks 9–11 and 14.

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/format.test.ts`:

```ts
import { fmtMoney, formatCurrencyBreakdown } from '../src/lib/format';
```

(adjust the existing import line in that file to include `formatCurrencyBreakdown` rather than adding a second import line, if `fmtMoney` is already imported there)

```ts
describe('formatCurrencyBreakdown', () => {
  it('renders each currency as "CODE amount", separated by middle dots', () => {
    expect(formatCurrencyBreakdown({ MYR: 3200, USD: 450 })).toBe('RM 3,200.00 · USD 450.00');
  });

  it('renders a single MYR-only breakdown the same as any other MYR amount', () => {
    expect(formatCurrencyBreakdown({ MYR: 128 })).toBe('RM 128.00');
  });

  it('respects each currency\'s own decimal places', () => {
    expect(formatCurrencyBreakdown({ MYR: 0, JPY: 1200 })).toBe('RM 0.00 · JPY 1,200');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest format.test.ts -t formatCurrencyBreakdown`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement `formatCurrencyBreakdown`**

In `src/lib/format.ts`, add after `fmtMoney`:

```ts
/**
 * "RM 3,200.00 · USD 450.00" — a per-currency breakdown line. Renders in the object's own
 * key order, which callers (`nativeAccountTotalsByCurrency`, `nativeTransactionTotalsByCurrency`)
 * already guarantee puts MYR first.
 */
export function formatCurrencyBreakdown(totals: Record<string, number>): string {
  return Object.entries(totals)
    .map(([code, amount]) => fmtMoney(amount, code))
    .join(' · ');
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts __tests__/format.test.ts
git commit -m "feat: add formatCurrencyBreakdown for per-currency breakdown rows"
```

---

## Task 8: Settings — "Show totals in" picker

**Files:**
- Modify: `src/screens/CurrencySettingsScreen.tsx`

**Interfaces:**
- Consumes: `getDisplayCurrency`/`setDisplayCurrency` (Task 2).

- [ ] **Step 1: Add display-currency state and load it alongside entry currency**

```ts
import { activateCurrency, deactivateCurrency, getActiveCurrencies, getDisplayCurrency, getEntryCurrency, setDisplayCurrency, setEntryCurrency } from '../db/currencyRepo';
```

```ts
  const [active, setActive] = useState<string[] | null>(null);
  const [entry, setEntry] = useState<string>(BASE_CURRENCY);
  const [display, setDisplay] = useState<string>(BASE_CURRENCY);
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [nextActive, nextEntry, nextDisplay] = await Promise.all([
      getActiveCurrencies(),
      getEntryCurrency(),
      getDisplayCurrency(),
    ]);
    setActive(nextActive);
    setEntry(nextEntry);
    setDisplay(nextDisplay);
  }, []);
```

- [ ] **Step 2: Add the picker handler**

```ts
  const pickDisplay = async (code: string) => {
    if (code === display) return;
    await setDisplayCurrency(code);
    await reload();
  };
```

- [ ] **Step 3: Render the "Show totals in" row**

Directly below the existing "Enter new expenses in" block (the `{isMultiCurrency(active) && (...)}` block containing the entry chips), add a second block with the same structure:

```tsx
        {isMultiCurrency(active) && (
          <View style={{ marginBottom: 24 }}>
            <Eyebrow style={{ marginBottom: 10 }}>{isZh ? '总计显示货币' : 'Show totals in'}</Eyebrow>
            <View style={styles.entryWrap}>
              {active.map((code) => {
                const on = display === code;
                return (
                  <Pressable
                    key={code}
                    onPress={() => pickDisplay(code)}
                    style={[styles.entryChip, { borderColor: colorTheme.line2 }, on && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.entryChipText, { color: on ? colors.onAccent : colorTheme.ink }]}>{code}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

Start the app (`npx expo start`), activate a second currency (e.g. USD) in Currency Settings, confirm a new "Show totals in" chip row appears below "Enter new expenses in" with MYR and USD chips, and that tapping USD persists across a screen re-entry (navigate away and back).

- [ ] **Step 6: Commit**

```bash
git add src/screens/CurrencySettingsScreen.tsx
git commit -m "feat: add Show totals in picker to Currency Settings"
```

---

## Task 9: Net Worth — headline conversion + breakdown

**Files:**
- Modify: `src/screens/NetWorthScreen.tsx`

**Interfaces:**
- Consumes: `useDisplayCurrency` (Task 6), `nativeAccountTotalsByCurrency` (Task 3), `formatCurrencyBreakdown` (Task 7).

**Scope:** only the `HeroCard` headline (net worth number, assets/liabilities tiles, the vs-last-month delta) converts, plus a new breakdown row under the hero tiles. Per-account and per-class-group rows further down the screen (`GroupHeader`, `ClassChip`, `AssetClassCard`, `AccountRow`, holdings) are unchanged — they already show either MYR or a foreign account's own native value (`fxSubtitle`/`fmtMoney`), which is a different, already-correct concern this plan doesn't touch.

- [ ] **Step 1: Load the hook and account-native breakdown in the screen component**

```ts
import { useDisplayCurrency } from '../state/useDisplayCurrency';
import { formatCurrencyBreakdown } from '../lib/format';
```

Inside the main screen component (the one holding `rates`, `myrValues`, `nw`), add:

```ts
  const dc = useDisplayCurrency();
  const nativeTotals = useMemo(
    () => nativeAccountTotalsByCurrency(accounts, accountValues),
    [accounts, accountValues]
  );
```

Add `nativeAccountTotalsByCurrency` to the existing `from '../lib/networth'` import.

- [ ] **Step 2: Pass `dc` and the breakdown string into `HeroCard`**

```tsx
        <HeroCard
          nw={nw}
          series={series}
          months={monthShorts}
          delta={delta}
          prevMonth={prevMonth}
          mode={profitMode}
          setMode={setProfitMode}
          onOpenHistory={onOpenHistory}
          dc={dc}
          breakdown={formatCurrencyBreakdown(nativeTotals)}
        />
```

- [ ] **Step 3: Convert the headline figures inside `HeroCard`**

Add `dc` and `breakdown` to `HeroCard`'s props type and destructure them:

```ts
function HeroCard({
  nw,
  series,
  months,
  delta,
  prevMonth,
  mode,
  setMode,
  onOpenHistory,
  dc,
  breakdown,
}: {
  nw: { net: number; assets: number; liabilities: number };
  series: number[];
  months: string[];
  delta: number | null;
  prevMonth: string;
  mode: ValueMode;
  setMode: (m: ValueMode) => void;
  onOpenHistory: () => void;
  dc: DisplayCurrency;
  breakdown: string;
}) {
```

Import the type: `import type { DisplayCurrency } from '../state/useDisplayCurrency';` and `import { fmtMoney } from '../lib/format';` (add `fmtMoney` to the existing `from '../lib/format'` import if `fmt` is already imported there).

Change the delta text:

```ts
  const deltaValText = mode === 'percent'
    ? `${pctAbs.toFixed(1)}%`
    : fmtMoney(dc.convert(Math.abs(delta ?? 0)), dc.code);
```

Change the headline number (was `<Text style={styles.heroNum}>RM {fmt(Math.abs(nw.net))}</Text>`):

```tsx
        <Text style={styles.heroNum}>{fmtMoney(dc.convert(Math.abs(nw.net)), dc.code)}</Text>
```

Change the two hero tiles:

```tsx
          <Text style={[styles.heroTileVal, { color: '#42e893' }]}>{fmtMoney(dc.convert(nw.assets), dc.code)}</Text>
          ...
          <Text style={[styles.heroTileVal, { color: '#ff8a80' }]}>{fmtMoney(dc.convert(nw.liabilities), dc.code)}</Text>
```

- [ ] **Step 4: Add the breakdown row**

Directly below the `heroTiles` `View` block (after the assets/liabilities tiles, before the `{series.length >= 2 && ...}` sparkline block), add:

```tsx
      {breakdown.length > 0 && (
        <Text style={styles.heroBreakdown}>{breakdown}</Text>
      )}
```

Add a matching style near the other `hero*` styles:

```ts
  heroBreakdown: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: uiFont(500), marginBottom: 9 },
```

(Check the top of the file for whichever font helper the other hero styles use — `numFont`/`uiFont` — and match it; the surrounding `heroTileLabel` style is the reference.)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manual verification**

With a USD account active and USD set as the display currency in Settings, open Net Worth: confirm the headline number, delta, and asset/liability tiles show a `USD` prefix and a converted figure, and a breakdown line like "RM 3,200.00 · USD 450.00" appears under the tiles. Switch display currency back to MYR and confirm the screen renders exactly as it did before this task.

- [ ] **Step 7: Commit**

```bash
git add src/screens/NetWorthScreen.tsx
git commit -m "feat: convert net worth headline to display currency, add per-currency breakdown"
```

---

## Task 10: Activity (all-transactions list) — summary conversion + breakdown

**Files:**
- Modify: `src/screens/AllTransactionsScreen.tsx`

**Interfaces:**
- Consumes: `useDisplayCurrency` (Task 6), `nativeTransactionTotalsByCurrency` (Task 4), `formatCurrencyBreakdown` (Task 7).

**Scope:** `totalSpent`, `totalIncome` (the two summary cards) and the filter-chip's `filterTotal` convert; a breakdown row is added under the summary cards for the currently-shown set. Per-row amounts (already native via `Amount value={txn.nativeAmount ?? txn.amount} currency={txn.currency}`) and `owedTotal` are unchanged — an owed balance is a managed receivable tracked in MYR by the split engine, a separate concern from this pass.

- [ ] **Step 1: Load the hook and breakdown**

```ts
import { useDisplayCurrency } from '../state/useDisplayCurrency';
import { nativeTransactionTotalsByCurrency } from '../lib/bookkeeping';
import { formatCurrencyBreakdown, fmtMoney } from '../lib/format';
```

Inside the screen component, near the existing `totalSpent`/`totalIncome`/`filterTotal` memos:

```ts
  const dc = useDisplayCurrency();
  const nativeTotals = useMemo(() => nativeTransactionTotalsByCurrency(shown), [shown]);
```

- [ ] **Step 2: Convert the summary cards**

Change:

```tsx
              <Card style={styles.summaryCard}>
                <Eyebrow>{isZh ? '支出' : 'Spent'}</Eyebrow>
                <Amount value={dc.convert(totalSpent)} currency={dc.code} size={20} weight={700} />
              </Card>
              <Card style={styles.summaryCard}>
                <Eyebrow>{isZh ? '收入' : 'Received'}</Eyebrow>
                <Amount value={dc.convert(totalIncome)} currency={dc.code} size={20} weight={700} color={theme.accent} />
              </Card>
```

- [ ] **Step 3: Convert the filter-chip total**

Change:

```tsx
            {shown.length} {filterCat ? tCat(filterCat) : ''} · {fmtMoney(dc.convert(filterTotal), dc.code)}
```

(This replaces the old `RM {filterTotal.toFixed(2)}`, which also fixes an unrelated pre-existing inconsistency — every other total on this screen goes through `fmt`'s thousands-separator formatting, but this one used a bare `.toFixed(2)`. Matching `fmtMoney` here isn't scope creep: it's required to correctly show a non-MYR prefix at all.)

- [ ] **Step 4: Add a breakdown row**

Directly below the `styles.summary` `View` (the two summary cards), inside the same `{!filtered && !advancedActive && !query.trim() && (...)}` guard:

```tsx
          {!filtered && !advancedActive && !query.trim() && (
            <>
              <View style={styles.summary}>
                <Card style={styles.summaryCard}>
                  <Eyebrow>{isZh ? '支出' : 'Spent'}</Eyebrow>
                  <Amount value={dc.convert(totalSpent)} currency={dc.code} size={20} weight={700} />
                </Card>
                <Card style={styles.summaryCard}>
                  <Eyebrow>{isZh ? '收入' : 'Received'}</Eyebrow>
                  <Amount value={dc.convert(totalIncome)} currency={dc.code} size={20} weight={700} color={theme.accent} />
                </Card>
              </View>
              {Object.keys(nativeTotals).length > 1 && (
                <Text style={[styles.breakdownText, { color: colorTheme.ink2 }]}>{formatCurrencyBreakdown(nativeTotals)}</Text>
              )}
            </>
          )}
```

Add the style near `summary`/`summaryCard`:

```ts
  breakdownText: { fontSize: 12, fontFamily: uiFont(500), marginTop: -6, marginBottom: 12, marginHorizontal: 2 },
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manual verification**

With USD active and set as display currency, open the Activity tab: confirm Spent/Received cards show `USD` amounts and a breakdown line appears beneath them only when more than one currency has activity; filter to a category and confirm the filter chip shows the converted total.

- [ ] **Step 7: Commit**

```bash
git add src/screens/AllTransactionsScreen.tsx
git commit -m "feat: convert activity summary totals to display currency, add breakdown"
```

---

## Task 11: Monthly Recap — hero conversion + breakdown

**Files:**
- Modify: `src/screens/RecapScreen.tsx`

**Interfaces:**
- Consumes: `useDisplayCurrency` (Task 6), `nativeTransactionTotalsByCurrency` (Task 4), `formatCurrencyBreakdown` (Task 7).

**Scope:** the `IncomeHero` figures (income, expenses, net cash flow, month-end net worth, vs-last-month delta) convert, plus a breakdown row for that month's transactions. The category rows (`CategoryRow`) further down stay MYR — they're driven by `spentByCat`, which is budget-category spend, a different, unconverted concern.

- [ ] **Step 1: Load the hook and month breakdown in the screen component**

```ts
import { useDisplayCurrency } from '../state/useDisplayCurrency';
import { nativeTransactionTotalsByCurrency } from '../lib/bookkeeping';
import { formatCurrencyBreakdown, fmtMoney } from '../lib/format';
```

Near where `statement` is computed (`const statement = useMemo(() => monthlyIncomeStatement(transactions, month), [transactions, month]);`):

```ts
  const dc = useDisplayCurrency();
  const monthNativeTotals = useMemo(
    () => nativeTransactionTotalsByCurrency(transactions.filter((t) => txnMonthKey(t) === month)),
    [transactions, month]
  );
```

(`txnMonthKey` is already imported in this file for `spentByCategory`'s equivalent filtering — confirm the import exists; if not, add `import { txnMonthKey } from '../lib/budget';` alongside the other `lib/budget` imports.)

- [ ] **Step 2: Pass `dc` and the breakdown into `IncomeHero`**

Find the `<IncomeHero` call site and add two props:

```tsx
          <IncomeHero
            month={month}
            income={statement.income}
            expenses={statement.expenses}
            net={statement.net}
            networth={networth}
            dc={dc}
            breakdown={formatCurrencyBreakdown(monthNativeTotals)}
          />
```

- [ ] **Step 3: Convert the figures inside `IncomeHero`**

Add `dc`/`breakdown` to its props type:

```ts
function IncomeHero({
  month,
  income,
  expenses,
  net,
  networth,
  dc,
  breakdown,
}: {
  month: string;
  income: number;
  expenses: number;
  net: number;
  networth: { net: number; delta: number } | null;
  dc: DisplayCurrency;
  breakdown: string;
}) {
```

Import `import type { DisplayCurrency } from '../state/useDisplayCurrency';` and `fmtMoney` (add to the existing `from '../lib/format'` import alongside `fmt`).

Replace each hardcoded `RM {fmt(...)}` line:

```tsx
        <Text style={styles.heroVal}>{fmtMoney(dc.convert(income), dc.code)}</Text>
...
        <Text style={[styles.heroVal, { color: 'rgba(255,255,255,0.72)' }]}>− {fmtMoney(dc.convert(expenses), dc.code)}</Text>
...
        <Text style={[styles.heroNcf, { color: positive ? TINT.ncfUp : TINT.ncfDown }]}>
          {positive ? '+' : '−'} {fmtMoney(dc.convert(Math.abs(net)), dc.code)}
        </Text>
```

And inside the `networth &&` strip:

```tsx
            <Text style={styles.nwVal}>
              {networth.net < 0 ? '− ' : ''}{fmtMoney(dc.convert(Math.abs(networth.net)), dc.code)}
            </Text>
...
              <Text style={[styles.nwDelta, { color: networth.delta >= 0 ? TINT.ncfUp : TINT.ncfDown }]}>
                {networth.delta >= 0 ? '+' : '−'}{fmtMoney(dc.convert(Math.abs(networth.delta)), dc.code)}
              </Text>
```

- [ ] **Step 4: Add the breakdown row**

Directly below the "Net Cash Flow" `heroLine` block, before the `{networth && (...)}` strip:

```tsx
      {breakdown.length > 0 && (
        <Text style={styles.heroBreakdown}>{breakdown}</Text>
      )}
```

Add the style near the other `hero*` styles (same visual treatment as Task 9's Net Worth breakdown row):

```ts
  heroBreakdown: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: uiFont(500), marginTop: -4, marginBottom: 4 },
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manual verification**

With a mix of MYR and USD transactions in the current month and USD set as display currency, open Monthly Recap: confirm income/expenses/net/net-worth figures show `USD` amounts and a breakdown line appears in the hero card.

- [ ] **Step 7: Commit**

```bash
git add src/screens/RecapScreen.tsx
git commit -m "feat: convert recap hero totals to display currency, add breakdown"
```

---

## Task 12: Dashboard — headline conversion

**Files:**
- Modify: `src/screens/DashboardScreen.tsx`

**Interfaces:**
- Consumes: `useDisplayCurrency` (Task 6).

**Scope:** the swipeable hero carousel (`CashFlowView`'s spent/cashflow/left figure and its "received" chip) and the embedded net-worth widget (`NetWorthView`'s headline, assets badge, and trend delta). The smaller bill-due/owed-to-you nudge chips (around lines 249–273) stay MYR — they're a shared micro-copy nudge sourced from commitment/split totals, not a headline total, and out of scope for this pass.

- [ ] **Step 1: Load the hook once in `SummaryCard` and pass it down**

```ts
import { useDisplayCurrency } from '../state/useDisplayCurrency';
```

In `SummaryCard` (the component that renders `CashFlowView`/`NetWorthView` for each carousel panel):

```ts
  const dc = useDisplayCurrency();
```

Pass `dc` to both `<CashFlowView ... dc={dc} />` and `<NetWorthView ... dc={dc} />` at their render call sites inside `SummaryCard`.

- [ ] **Step 2: Convert `CashFlowView`'s figures**

Add `dc: DisplayCurrency` to its props type (`import type { DisplayCurrency } from '../state/useDisplayCurrency';`, `import { fmtMoney } from '../lib/format';` alongside the existing `fmt`/`fmtCompact` import).

Change:

```ts
  const heroAmount = `${dc.code === 'MYR' ? 'RM' : dc.code} ${fmtCompact(Math.abs(dc.convert(heroValue)))}`;
```

Change the "received" chip:

```tsx
            <Label numeric color={theme.onTint}>{fmtMoney(dc.convert(received), dc.code)}</Label>
```

- [ ] **Step 3: Convert `NetWorthView`'s figures**

Add `dc: DisplayCurrency` to its props type.

Change:

```tsx
              {`${pos ? '' : '−'}${dc.code === 'MYR' ? 'RM' : dc.code} ${fmtCompact(Math.abs(dc.convert(net)))}`}
```

```tsx
          <Label numeric color={theme.onTint}>{fmtMoney(dc.convert(assets), dc.code)}</Label>
```

```tsx
                {delta === null ? (isZh ? '近6个月趋势' : '6-month trend') : `${deltaUp ? '+' : '−'}${fmtMoney(dc.convert(Math.abs(delta)), dc.code)} ${isZh ? '较上月' : 'vs last month'}`}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

With USD set as display currency, open Dashboard: swipe the hero carousel through Spent/Net cash flow/Left-to-spend panels and confirm each shows a `USD`-prefixed converted figure; open the Net Worth panel and confirm its headline and assets badge convert too.

- [ ] **Step 6: Commit**

```bash
git add src/screens/DashboardScreen.tsx
git commit -m "feat: convert dashboard hero totals to display currency"
```

---

## Task 13: Budget — envelope totals conversion

**Files:**
- Modify: `src/screens/BudgetScreen.tsx`

**Interfaces:**
- Consumes: `useDisplayCurrency` (Task 6).

**Scope:** the two `Amount` components (expected income, left-to-allocate) and the "Allocated X of Y" caption. The income-baseline card (`incomeBaseline.baseline`/`low`/`high`) is a separate stability-analysis feature, not an "envelope total," and stays MYR — out of scope for this pass.

- [ ] **Step 1: Load the hook**

```ts
import { useDisplayCurrency } from '../state/useDisplayCurrency';
```

```ts
  const dc = useDisplayCurrency();
```

- [ ] **Step 2: Convert the two `Amount` components**

Change:

```tsx
              <Amount value={dc.convert(expectedIncome)} currency={dc.code} size={22} weight={700} />
...
              <Amount value={dc.convert(Math.abs(left))} currency={dc.code} size={22} weight={700} color={left < 0 ? STATUS_COLOR.over : theme.accent} />
```

- [ ] **Step 3: Convert the "Allocated" caption**

```ts
import { fmtMoney } from '../lib/format';
```

Change:

```tsx
              {isZh
                ? `已分配 ${fmtMoney(dc.convert(allocated), dc.code)} / 计划收入 ${fmtMoney(dc.convert(expectedIncome), dc.code)}`
                : `Allocated ${fmtMoney(dc.convert(allocated), dc.code)} of ${fmtMoney(dc.convert(expectedIncome), dc.code)}`}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

With USD set as display currency, open Budget: confirm the expected-income and left-to-allocate figures, plus the "Allocated X of Y" caption, all show `USD` amounts.

- [ ] **Step 6: Commit**

```bash
git add src/screens/BudgetScreen.tsx
git commit -m "feat: convert budget envelope totals to display currency"
```

---

## Task 14: Export — converted totals + per-currency breakdown

**Files:**
- Modify: `src/lib/bookkeeping.ts` (`FinancialReportData`, `buildFinancialReportBundle`)
- Modify: `src/lib/financialExport.ts` (`formatCurrency`, `generateHTMLReport`, `generateCSV`)
- Modify: `src/screens/ExportScreen.tsx` (thread `rates`/display currency into the bundle call)
- Test: `__tests__/bookkeeping.test.ts`, a new `__tests__/financialExport.test.ts`

**Interfaces:**
- Consumes: `toDisplay` (Task 1), `useDisplayCurrency` (Task 6), `nativeTransactionTotalsByCurrency` (Task 4), `nativeAccountTotalsByCurrency` (Task 3), `formatCurrencyBreakdown` (Task 7).
- Produces: `formatCurrency(amountMyr: number, code: string, rates: Record<string, number>): string` (breaking signature change, this file's only caller is itself), `FinancialReportData.displayCurrency: string`, `FinancialReportData.displayRates: Record<string, number>`.

**Scope:** the interactive HTML report and the printable PDF-HTML report (both generated by `generateHTMLReport` — the file's header comment confirms it covers both) get every KPI/table/chart figure converted, because they all render through the single `formatCurrency` call, which is where the conversion goes. **CSV/XLSX stay MYR-only, unchanged** — they're machine-readable ledgers whose "Amount (MYR)" column headers are explicit; converting the numbers there without also relabeling headers would silently mislabel a spreadsheet import, and the deliverable this task actually needs (a per-currency breakdown) is added as its own new CSV section instead. Tax export (`src/lib/taxExport.ts`) is untouched.

- [ ] **Step 1: Write the failing test for `formatCurrency`'s new signature**

Add a new file `__tests__/financialExport.test.ts`:

```ts
// __tests__/financialExport.test.ts
import { formatCurrency } from '../src/lib/financialExport';

describe('formatCurrency', () => {
  it('renders an MYR amount with the RM prefix, unchanged from before this feature', () => {
    expect(formatCurrency(1234.5, 'MYR', {})).toBe('RM 1,234.50');
  });

  it('projects into a non-MYR display currency using the given rate before formatting', () => {
    // 1 USD = 4.4 MYR, so MYR 440 displays as USD 100.00.
    expect(formatCurrency(440, 'USD', { USD: 4.4 })).toBe('USD 100.00');
  });

  it('falls back to the raw MYR figure under the display code\'s prefix when the rate is missing', () => {
    expect(formatCurrency(100, 'USD', {})).toBe('USD 100.00');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest financialExport.test.ts`
Expected: FAIL — `formatCurrency` currently takes one argument and ignores extra ones (TS will actually fail to compile the test under `tsc --noEmit` too, since the current signature is `(amount: number) => string`).

- [ ] **Step 3: Implement the new `formatCurrency` signature**

In `src/lib/financialExport.ts`, add imports and replace the function:

```ts
import { toDisplay } from './fx';
import { fmtMoney } from './format';
```

```ts
/**
 * Format an MYR figure for the report, projected into the report's display currency.
 * Every monetary value flowing through this file is MYR-canonical by construction
 * (transaction amounts, and the incomeStatement/balanceSheet/statistics totals computed
 * from them) — conversion happens once, here, at the render boundary, per the
 * display-currency spec's "convert at the last mile" principle.
 */
export function formatCurrency(amountMyr: number, code: string, rates: Record<string, number>): string {
  return fmtMoney(toDisplay(amountMyr, code, rates) ?? amountMyr, code);
}
```

- [ ] **Step 4: Update every call site in this file**

Every existing call of the form `formatCurrency(X)` becomes `formatCurrency(X, data.displayCurrency, data.displayRates)`. Run the mechanical transform, scoped to `generateHTMLReport` (the only function using the old 1-arg calls — confirm `generateCSV` has none, per Step 8 below):

```bash
sed -i -E 's/formatCurrency\(([^()]*(\([^()]*\))?[^()]*)\)/formatCurrency(\1, data.displayCurrency, data.displayRates)/g' src/lib/financialExport.ts
```

Then verify no call site was missed or double-transformed:

```bash
grep -n "formatCurrency(" src/lib/financialExport.ts | grep -v "data.displayCurrency, data.displayRates"
```

Expected: only the `export function formatCurrency(...)` declaration line itself (and the new `formatCurrency` body's own internal call, if any — there is none) should print; every call site must show the two extra arguments. If any call site is missing them, the sed pattern didn't match it (e.g. a rare deeper nesting) — fix that line by hand using the same trailing-args form.

- [ ] **Step 5: Add `displayCurrency`/`displayRates` to `FinancialReportData` and thread through `buildFinancialReportBundle`**

In `src/lib/bookkeeping.ts`:

```ts
export interface FinancialReportData {
  userName: string;
  generatedAt: string;
  period: ReportPeriod;
  incomeStatement: IncomeStatement;
  balanceSheet: BalanceSheet;
  statistics: FinancialStatistics;
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  /** The currency every formatCurrency call in the report projects into. 'MYR' unless the
   *  user has set a different default in Settings. */
  displayCurrency: string;
  /** The same rate table used to build the balance sheet/statistics, reused so the report
   *  renderer can project MYR figures into `displayCurrency` without a second fetch. */
  displayRates: Record<string, number>;
}
```

```ts
export function buildFinancialReportBundle(
  txns: Transaction[],
  categories: Category[],
  accounts: Account[],
  balanceEntries: BalanceEntry[],
  period: ReportPeriod,
  userName: string = 'Pip User',
  rates: Record<string, number> = {},
  displayCurrency: string = 'MYR'
): FinancialReportData {
  const incomeStatement = computeIncomeStatement(txns, categories, period);
  const balanceSheet = computeBalanceSheet(accounts, balanceEntries, period.asOfDate, rates);
  const statistics = computeFinancialStatistics(txns, categories, accounts, balanceEntries, period, rates);
  const filteredTxns = filterTransactionsByPeriod(txns, period);

  return {
    userName,
    generatedAt: new Date().toISOString(),
    period,
    incomeStatement,
    balanceSheet,
    statistics,
    transactions: [...filteredTxns].sort((a, b) => ((b.date || '') < (a.date || '') ? -1 : (b.date || '') > (a.date || '') ? 1 : 0)),
    categories,
    accounts,
    displayCurrency,
    displayRates: rates,
  };
}
```

- [ ] **Step 6: Update the existing `buildFinancialReportBundle` test call and add a display-currency test**

The existing call in `__tests__/bookkeeping.test.ts` (`buildFinancialReportBundle(txns, mockCategories, accounts, entries, period, 'Ahmad Test')`) needs no change — the two new params default safely. Add a new assertion in the same `it` block:

```ts
    expect(bundle.displayCurrency).toBe('MYR');
    expect(bundle.displayRates).toEqual({});
```

Add a new test:

```ts
it('threads a non-MYR display currency and its rate table through', () => {
  const period = buildReportPeriod('yearly', undefined, 2026);
  const bundle = buildFinancialReportBundle(txns, mockCategories, accounts, entries, period, 'Ahmad Test', { USD: 4.4 }, 'USD');
  expect(bundle.displayCurrency).toBe('USD');
  expect(bundle.displayRates).toEqual({ USD: 4.4 });
});
```

- [ ] **Step 7: Add the completeness test for the HTML report**

In `__tests__/financialExport.test.ts`, add (importing `buildFinancialReportBundle`/`buildReportPeriod` from `../src/lib/bookkeeping` and `generateHTMLReport` from `../src/lib/financialExport`):

```ts
import { buildReportPeriod, buildFinancialReportBundle } from '../src/lib/bookkeeping';
import { generateHTMLReport } from '../src/lib/financialExport';

describe('generateHTMLReport display currency', () => {
  it('shows no stray MYR prefix once every formatCurrency call site converts', () => {
    const period = buildReportPeriod('yearly', undefined, 2026);
    const data = buildFinancialReportBundle([], [], [], [], period, 'Test User', { USD: 4.4 }, 'USD');
    const html = generateHTMLReport(data);
    expect(html).not.toContain('RM ');
  });
});
```

- [ ] **Step 8: Confirm `generateCSV` needs no formatCurrency changes, then add its breakdown section**

`generateCSV` does not call `formatCurrency` (verified via `grep -n "formatCurrency(" src/lib/financialExport.ts` — every match is inside `generateHTMLReport`); its numbers stay raw MYR, matching its explicit `Amount (MYR)` column headers. Add a new section using the already-tested native breakdown helpers, right after the "FINANCIAL SUMMARY" section:

```ts
import { nativeTransactionTotalsByCurrency } from './bookkeeping';
```

(`nativeAccountTotalsByCurrency` needs a native `valueById` per account as of the report date, which `computeBalanceSheet` doesn't expose — for the CSV breakdown, transactions alone are sufficient and match what the spec asks for; a native-currency accounts breakdown in the export is not required by the per-screen table, only the transaction-side one is.)

```ts
  // Currency Breakdown (native, unconverted — see the per-currency breakdown row on
  // Net Worth/Activity/Recap for the same idea applied to accounts and other periods)
  const currencyTotals = nativeTransactionTotalsByCurrency(data.transactions);
  if (Object.keys(currencyTotals).length > 1) {
    lines.push(`${csvEscape('=== CURRENCY BREAKDOWN (native, transactions this period) ===')}`);
    lines.push(`${csvEscape('Currency')},${csvEscape('Native Total')}`);
    for (const [code, amount] of Object.entries(currencyTotals)) {
      lines.push(`${csvEscape(code)},${amount}`);
    }
    lines.push('');
  }
```

- [ ] **Step 9: Wire `rates`/display currency from `ExportScreen` into the bundle call**

In `src/screens/ExportScreen.tsx`:

```ts
import { useDisplayCurrency } from '../state/useDisplayCurrency';
```

```ts
  const dc = useDisplayCurrency();
```

Change the `buildFinancialReportBundle` call (around line 168) to pass `dc.rates` and `dc.code` as the trailing two arguments, after the existing `verifiedName` argument.

- [ ] **Step 10: Run the full test suite**

Run: `npx jest bookkeeping.test.ts financialExport.test.ts`
Expected: PASS, including the new `generateHTMLReport` completeness check and every pre-existing test in both files.

- [ ] **Step 11: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 12: Manual verification**

With USD active and set as display currency, open Export, generate the HTML/PDF report, and confirm every KPI and table figure shows `USD` instead of `RM`. Generate the CSV and confirm it still reads all-MYR (matching its `(MYR)` headers) but now has a new `CURRENCY BREAKDOWN` section when more than one currency has activity in the period.

- [ ] **Step 13: Commit**

```bash
git add src/lib/bookkeeping.ts src/lib/financialExport.ts src/screens/ExportScreen.tsx __tests__/bookkeeping.test.ts __tests__/financialExport.test.ts
git commit -m "feat: convert export report totals to display currency, add CSV currency breakdown"
```

---

## Final check

After Task 14, run the entire suite once to confirm nothing upstream regressed:

```bash
npx jest && npx tsc --noEmit
```
