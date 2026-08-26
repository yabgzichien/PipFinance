# Multi-currency: design spec

Status: approved for implementation. Date: 2026-08-23.

## Problem

PipComp assumes every number is MYR. `transactions.amount`, `balance_entries.value`,
`budget_allocation.amount` and every total derived from them are unlabelled ringgit. For the
core Malaysian user that is correct and should stay correct.

It is wrong for a growing minority: Malaysians studying or working abroad. A student in
China pays CNY 128 for dinner, the app stores `128`, and the dashboard reports RM 128. The
app does not convert badly, it does not convert at all. Every foreign amount is silently
counted at parity, which corrupts the monthly total, the budget envelope, the savings
streak, and the income baseline at once.

The target user is MYR-anchored: they still think in ringgit, still file Malaysian tax, and
still want one honest RM number. They just enter and spend in another currency day to day.

## Goals

- A transaction can be entered in a non-MYR currency and roll up correctly into every
  existing MYR total.
- An account can be denominated in a non-MYR currency and convert into net worth at a
  current rate.
- Receipt scans, screenshot extraction and statement imports detect currency instead of
  assuming MYR.
- A user who never leaves Malaysia sees exactly one new row in Settings and nothing else,
  ever. No new control on the amount field, the dashboard, or any list.
- Historical months never move. March's total is the same in April as it was in March.

## Non-goals (v1)

- Tax and relief. Non-MYR transactions are structurally excluded from relief tagging and
  from the audit pack, not merely hidden. See §7.
- Holdings cost basis. `accounts.cost` stays a fixed MYR figure against a live MYR price,
  which is what makes profit computable. Unchanged.
- A display-currency toggle. Totals are always MYR. There is no "show my net worth in CNY"
  mode, and adding one later would be a separate design.
- Budget envelopes in a foreign currency. `budget_allocation.amount` stays MYR.
- Historical rate backfill. A rate is fetched once at entry and frozen; there is no
  "recompute March at March's real rates" job.
- Manual rate override on an individual transaction. Considered and cut: it is an
  affordance the target user does not need and it costs a UI surface.

## 1. Core principle

**`transactions.amount` never stops meaning MYR.**

Roughly thirty call sites sum `t.amount`: the dashboard, breakdown, category detail, budget
progress, streak, income baseline, recap, calendar, export. Redefining `amount` as "the
native amount" would require finding and changing every one, and a missed site produces a
*silently wrong total*, which is the exact bug this feature exists to fix.

Instead the native amount is additive. A missed *display* site shows the right number in the
wrong denomination, which is cosmetic. The failure mode inverts, deliberately.

The stock side inverts the rule, because it must: an account balance has no frozen MYR
value to store, since its whole point is that it converts at today's rate. Conversion
happens at read time in exactly one function.

| Data | Rate | Stored as |
| --- | --- | --- |
| Transactions, splits, commitments (flow) | Frozen at entry | MYR canonical + native alongside |
| Account balances, net worth (stock) | Live, cached | Native only, converted on read |

This mirrors what the holdings code already does: live price via `quotesMYR`, fixed `cost`
basis.

## 2. Data model

### 2.1 Supported currencies

A static table in `src/lib/currencies.ts`. MYR is the base and cannot be deactivated.

```
MYR (base)
CNY TWD HKD JPY KRW USD GBP EUR CHF AUD CAD NZD
SGD THB IDR PHP VND BND KHR LAK MMK
```

Each entry carries `{ code, label, decimals }`. `decimals` is 0 for JPY, KRW, VND, IDR, LAK
and MMK and 2 for the rest: formatting `JPY 1,200.00` is wrong and reads as a bug.

### 2.2 Transactions

The existing `currency TEXT NOT NULL DEFAULT 'MYR'` column ([db.ts:32](../../../src/db/db.ts))
is currently dead: it is read into `Transaction.currency` but
[txnRepo.ts:76](../../../src/db/txnRepo.ts) hardcodes `'MYR'` on every insert. It gets a
real job. Two columns are added by migration:

```sql
ALTER TABLE transactions ADD COLUMN native_amount REAL;  -- NULL when currency = 'MYR'
ALTER TABLE transactions ADD COLUMN fx_rate REAL;        -- MYR per 1 native unit, frozen
```

Invariant, enforced in one place:

```ts
// currency === 'MYR'  ->  native_amount = null, fx_rate = null, amount = as entered
// currency !== 'MYR'  ->  amount = round2(native_amount * fx_rate)
```

Rounding happens once, at write. Nothing downstream re-rounds.

`NewTxn` gains `currency?: string` and `nativeAmount?: number`. `addTransactions` resolves
the rate and derives `amount` through a single `deriveMyr()` helper in
`src/lib/currency.ts`. Existing callers that pass neither field produce byte-identical rows
to today.

### 2.3 Accounts

```sql
ALTER TABLE accounts ADD COLUMN currency TEXT NOT NULL DEFAULT 'MYR';
```

`balance_entries.value` stays **native**. For a MYR account this is unchanged. `netWorth()`
in [networth.ts](../../../src/lib/networth.ts) gains a rate table parameter and multiplies
each account's value by `rates[account.currency] ?? 1`, except that a missing rate excludes
the account rather than defaulting to 1 (§4).

### 2.4 FX cache

Mirrors `price_cache` exactly:

```sql
CREATE TABLE IF NOT EXISTS fx_cache (
  code      TEXT PRIMARY KEY NOT NULL,
  rate_myr  REAL NOT NULL,
  as_of     TEXT NOT NULL
);
```

### 2.5 Splits and commitments

```sql
ALTER TABLE splits ADD COLUMN currency TEXT NOT NULL DEFAULT 'MYR';
ALTER TABLE splits ADD COLUMN fx_rate REAL;
ALTER TABLE commitments ADD COLUMN currency TEXT NOT NULL DEFAULT 'MYR';
ALTER TABLE commitment_occurrences ADD COLUMN fx_rate REAL;
```

`splits.gross`, `splits.own_share`, `split_shares.owed`, `split_shares.paid` and
`split_payments.amount` are all **native**, inherited from the parent transaction. A CNY 100
debt is a CNY 100 debt and does not move with FX.

`splits.currency` and `splits.fx_rate` are copied from the parent transaction at split
creation. They look redundant but are not: the managed receivable account balance is MYR, so
raising a CNY 100 receivable in March and settling a CNY 50 payment against it in September
must use the *same* rate, or the receivable never returns to zero. The split owns the rate
its receivable was raised at.

`commitment_occurrences.amount` stays native; each occurrence freezes its own rate when
generated, so a CNY rent commitment costs a different RM amount each month, which is true.

### 2.6 Settings state

Two `app_meta` keys:

- `active_currencies`: JSON array, defaults to `["MYR"]`.
- `entry_currency`: string, defaults to `"MYR"`.

## 3. Migration and defaults

Every migration is additive with a MYR-safe default, following the existing
try/catch `ALTER TABLE` pattern in `init()`. No backfill is needed: `native_amount` and
`fx_rate` NULL on an existing row means "this is a plain MYR row", which is true.

A fresh install and an upgraded install are both indistinguishable from today until the user
activates a second currency.

`resetAllData()` must additionally `DELETE FROM fx_cache` and reset both `app_meta` keys to
their defaults. Omitting this leaves a "reset" app still in CNY entry mode.

## 4. FX engine

`src/lib/fx.ts` (pure, tested) and `src/prices/fx.ts` (network, best-effort), matching the
existing `lib/prices.ts` + `prices/yahoo.ts` split.

**Source.** The Yahoo chart endpoint already in use at
[yahoo.ts:54](../../../src/prices/yahoo.ts): `chart(\`${code}MYR=X\`)`. No API key, no new
dependency, already returns null on failure.

**Activation is the network gate.** Turning a currency on in Settings fetches its rate and
writes `fx_cache`. If the fetch fails, activation fails with "Couldn't fetch the CNY rate.
Try again when you're online." A currency therefore cannot appear in the entry picker
without a cached rate, which means **transaction entry never blocks on the network**.

This is the answer to the offline-entry problem, and it is why no "pending rate" state
exists. It also surfaces poor Yahoo coverage (LAK, MMK, KHR are the likely gaps) at
activation time, where the message is actionable, rather than at entry time, where it is not.

**Entry reads the cache only.** `rateFor(code)` returns the cached rate synchronously and
never awaits the network, so saving a transaction is as fast offline as online. A background
refresh may update the cache afterwards, but it does not affect a row already written. Since
activation guarantees a cache entry exists, this always resolves.

**Refresh.** Piggybacks the existing price-refresh trigger. Only active currencies are
fetched, one call each, best-effort.

**Missing rate at read time.** If `netWorth()` has no rate for an account's currency, that
account is **excluded from the total** and its row shows "rate unavailable". It is never
counted at 1:1. Silent parity is the bug being fixed here and reintroducing it in the
fallback path would be worse than the original, because it would now look deliberate.

## 5. Entry and display rules

**Rows show what you paid. Totals show what it cost you in RM.**

A list of mixed currencies is not expected to visually sum, so this needs no explanation in
the UI. Totals and section headers are always RM and always labelled.

**Code, not symbol.** `CNY 128.00`, not `¥128.00`. The yen sign is ambiguous between JPY and
CNY, and Hermes has patchy symbol font coverage. MYR keeps `RM`, which is the established
local convention.

`src/lib/format.ts` gains:

```ts
export function fmtMoney(amount: number, currency: string): string
```

`fmt()` is untouched and remains correct for every MYR total, which is why the ~178
hardcoded `RM` strings mostly stay as they are.

### 5.1 Progressive disclosure

The gate is `active_currencies.length > 1`. Below the gate, none of the following renders.

| Surface | Below gate | Above gate |
| --- | --- | --- |
| Settings | One row: "Currencies · MYR only" | Row shows active codes; opens the currency screen |
| Amount field | Plain number input, as today | `[CNY ▾] 128.00` with `≈ RM 80.64` beneath |
| Transaction rows | `RM 128.00` | Native: `CNY 128.00`. MYR rows unchanged |
| Totals and headers | RM | RM (unchanged) |
| Net worth account row | `RM 12,000.00` | `CNY 12,000.00` + `≈ RM 7,560` subtitle |

Net worth is the deliberate exception to the no-subtitle rule: those rows feed a live hero
number, and unlike a frozen transaction the conversion is genuinely current information. A
stale rate appends a quiet "rate 12 Aug".

### 5.2 Self-revealing path

When a scan or import detects a currency that is not active, the review screen offers an
inline one-tap "Add CNY" rather than routing to Settings. This is the likely discovery path
for the target user, and it means many never open the Settings row at all.

### 5.3 Settings screen

A list of the 22 supported currencies with toggles, plus an "Enter new expenses in" picker
limited to active ones.

- MYR cannot be deactivated.
- Deactivating a currency removes it from the entry picker only. Existing transactions keep
  their currency and continue to display it. Nothing is deleted or converted.
- Deactivating the current `entry_currency` resets `entry_currency` to `MYR`.

### 5.4 Where the chip never appears

Budget allocation fields, the relief and tax screens, and holdings cost. All three are MYR
by definition and a currency control there would be a lie.

## 6. Scan and import

[advancedImport.ts:48](../../../src/lib/advancedImport.ts) **already** instructs the model to
return a 3-letter currency code and already declares `currency?: unknown` on the parsed
type. The value is extracted and then discarded. Stop discarding it.

The receipt and screenshot prompts do the opposite and must be changed. They currently
hardcode currency-stripping as the worked example:

- [extractPrompt.ts:17](../../../src/llm/extractPrompt.ts) `"positive value, no currency symbol"`
- [extractPrompt.ts:73](../../../src/llm/extractPrompt.ts) `"RM 1,234.50" -> 1234.50`
- [extractPrompt.ts:115](../../../src/llm/extractPrompt.ts), [:132](../../../src/llm/extractPrompt.ts) same pattern

Each gains a `"currency"` field returning an ISO code, defaulting to `MYR` when the document
shows no symbol. `ExtractedTxn`, `ScannedReceipt` and `ScannedSnapshot` carry it through.
An unrecognised or unsupported code falls back to MYR rather than failing the extraction.

`extractBalance` currently documents itself as returning "a single MYR balance". It returns
the amount plus a currency, feeding `accounts.currency` on the balance-scan path.

## 7. Tax exclusion

Non-MYR transactions are excluded from relief **structurally, not visually**.

`relief_tags.amount` is a fixed figure filed against a specific year of assessment. It can
never be a converted number, and LHDN reliefs require Malaysian-sourced spending with local
documentation. Foreign-sourced income is separately outside the scope of what this app
should be tallying into a Form BE line.

Therefore:

- The auto-tag pass skips rows where `currency != 'MYR'`, at the query level.
- Manual relief tagging is unavailable on a non-MYR transaction, with a one-line reason
  rather than a disabled control with no explanation.
- The audit pack export filters non-MYR rows out.

The filter belongs in `reliefRepo` queries, not in the screens. A UI-level filter would be
one refactor away from leaking a converted number into a tax filing.

## 8. Hazards

These are the places where a careless change breaks the invariant. Each needs a test.

1. **`updateTransactionAmount` and `updateTransactionFields`
   ([txnRepo.ts:110](../../../src/db/txnRepo.ts), [:140](../../../src/db/txnRepo.ts)) write
   `amount` directly.** On a foreign transaction the user is editing the *native* amount, so
   these must rewrite `native_amount` and recompute `amount` through `deriveMyr()`. Writing
   `amount` straight through leaves the row internally inconsistent and the displayed native
   figure stale. This is the single most likely regression in the whole feature.
2. **Editing must reuse the frozen rate, not fetch a new one.** Correcting a typo in March's
   dinner must not silently reprice it at August's rate.
3. **Changing a transaction's currency** is a rate re-fetch, which means an edit can change
   the MYR value. Allowed, but it must go through the same helper.
4. **Rounding once.** `round2` at write only. Re-rounding a stored `amount` on display
   drifts totals.
5. **`resetAllData`** must clear `fx_cache` and both `app_meta` keys (§3).
6. **Split receivable.** The managed receivable account is MYR while `split_shares.owed` is
   native. The conversion happens at write using the parent's frozen rate.
7. **Zero-decimal currencies.** `fmtMoney` must consult `decimals`, and the amount input
   must not force two decimal places for JPY or KRW.

## 9. Testing

Pure logic, following the existing `__tests__` pattern:

- `currency.test.ts`: `deriveMyr` invariant across MYR and non-MYR, rounding, zero-decimal
  currencies, `fmtMoney` output per currency.
- `fx.test.ts`: cache staleness, missing-rate exclusion, rate parsing.
- `networth.test.ts` additions: mixed-currency net worth, an account with no rate excluded
  from the total rather than counted at 1:1.
- `split.test.ts` additions: a CNY split's share amounts stay native, the receivable
  converts at the frozen rate.
- A regression test that a MYR-only database produces identical totals before and after the
  migration. This is the test that protects the 95% of users this feature is invisible to.

## 10. Implementation order

1. `currencies.ts`, `currency.ts`, `fmtMoney`, plus tests. No UI, no schema.
2. Schema migrations and `fx_cache`. Everything still MYR, nothing visible.
3. `fx.ts` rate fetch and cache, reusing the Yahoo adapter.
4. Settings currency screen and the two `app_meta` keys. The feature becomes activatable but
   nothing else reads it yet.
5. Transaction entry: chip, `deriveMyr` on write, the `txnRepo` edit hazards in §8.
6. Display: transaction rows and `fmtMoney` across the ~13 native-amount surfaces.
7. Accounts and net worth conversion.
8. Scan and import detection, plus the inline "Add CNY" path.
9. Splits and commitments.
10. Tax exclusion at the `reliefRepo` query level.

Steps 1 to 4 ship no user-visible change beyond one Settings row and can land independently.
