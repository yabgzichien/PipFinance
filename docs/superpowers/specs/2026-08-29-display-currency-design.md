# Display currency: design spec

Status: approved for implementation. Date: 2026-08-29.

## Problem

[2026-08-23-multi-currency-design.md](2026-08-23-multi-currency-design.md) made `transactions.amount`
and every derived total honestly MYR, and let accounts and transactions carry a native
currency alongside it. It deliberately left one thing out as a non-goal: "A display-currency
toggle... adding one later would be a separate design." This is that design.

A user who's activated USD or CNY alongside MYR currently has no way to see their totals in
anything but ringgit, and no way to see how much of a total is actually sitting in each
currency rather than folded into one converted number. Net Worth, the transaction list,
Monthly Recap, Dashboard, Budget, and Export all show MYR only.

## Goals

- A user can set a **default (display) currency** in Settings. Every headline total across
  the app — Dashboard, Budget, Net Worth, Activity, Recap, Export — renders converted into
  that currency instead of hardcoded MYR.
- Net Worth, Activity, Recap, and Export additionally show a **per-currency breakdown**: the
  native, unconverted total held in each active currency, alongside the converted headline.
- A user who never activates a second currency sees no change: default currency is MYR,
  MYR converts to MYR at 1:1, and the breakdown is a single MYR line.

## Non-goals

- **Tax relief stays MYR-only, full stop.** [TaxScreen](../../../src/screens/TaxScreen.tsx)
  and [taxExport.ts](../../../src/lib/taxExport.ts) get no conversion and no breakdown — the
  relief system is structurally Malaysian and non-MYR transactions are already excluded from
  it by the original spec.
- No change to how amounts are **stored or aggregated**. `transactions.amount`,
  `balance_entries.value`, and budget allocations keep meaning exactly what they mean today.
  This is a display-layer projection, not a new base currency.
- No historical rate freezing. A past month's converted total is not pinned to the rate that
  was current when first viewed — see §3.
- No per-transaction display-currency override. One default currency, set globally in
  Settings, same as entry currency.

## 1. Core principle

**Conversion happens once, at the last mile, on top of the existing MYR-canonical total.**

Every screen already computes its MYR totals via existing arithmetic (`t.amount` sums,
`netWorth()`, budget allocation math). None of that changes. What changes is the small set of
places that *render* a headline number: they divide the already-computed MYR figure by the
display currency's cached rate before formatting it, instead of assuming MYR.

This mirrors §1 of the multi-currency spec: the failure mode of a missed call site stays
cosmetic (wrong denomination shown) rather than corrupting a total, because the underlying
sum was never touched.

Per-currency breakdowns are a second, independent thing: a sum of **native** amounts grouped
by currency, computed from data that already carries a native amount and currency (account
balances, transaction `nativeAmount`/`currency`). They are never converted.

## 2. Data model

One new `app_meta` key, alongside the existing `active_currencies` and `entry_currency`:

- `display_currency`: string, defaults to `"MYR"`.

No schema migration. No new tables — this reuses `fx_cache` exactly as-is.

`display_currency` may only be set to an already-**active** currency, enforced the same way
`getEntryCurrency()` already enforces it for entry: if the stored value is no longer active
(the user deactivated it), reads fall back to `BASE_CURRENCY`. This guarantees a cached rate
always exists for the display currency, so rendering a headline total never touches the
network and never hits the null-rate case in practice.

`resetAllData()` resets `display_currency` to `MYR`, matching how it already resets
`entry_currency`.

## 3. Conversion helper

New pure function in [src/lib/fx.ts](../../../src/lib/fx.ts), the inverse of the existing
`rateFor` (which returns MYR per one unit of a code):

```ts
/** Project an MYR amount into a display currency, or null if the rate is unavailable. */
export function toDisplay(amountMyr: number, code: string, rates: Record<string, number>): number | null {
  const rate = rateFor(rates, code);
  return rate == null ? null : round2ForCurrency(amountMyr / rate, code);
}
```

A `null` result (display currency deactivated mid-session, before the fallback reload lands)
renders the MYR figure with the MYR prefix, the same graceful degradation
`toMyrValues`/`unconvertible` already models for accounts.

**Rates are not historical.** `fx_cache` holds one current rate per currency, refreshed
best-effort (§4 of the multi-currency spec). A month's converted total therefore reprojects
at today's rate every time it's rendered, including for past months — it will read slightly
differently next week than it does today if the rate moves. The underlying MYR figure never
changes; only its non-MYR display wobbles. This is an accepted tradeoff, not a bug — no new
storage is introduced to freeze it.

## 4. Per-currency breakdown

Two new pure aggregation helpers, grouping **native** amounts by currency:

- `nativeTotalsByCurrency(accounts, nativeValueById)` in
  [networth.ts](../../../src/lib/networth.ts) — for Net Worth. Sums each account's native
  balance (the value before `toMyrValues` runs) keyed by `account.currency`.
- `nativeTotalsByCurrency(transactions)` (transaction-shaped overload, or a sibling function
  in the same module transactions already import) — for Activity and Recap. Sums
  `t.nativeAmount ?? t.amount` keyed by `t.currency`.

Both skip archived accounts / respect whatever filter the screen already applied to the list
being summarized, and return `Record<string, number>` ordered MYR-first for display (MYR is
always present, even if 0, so the breakdown never looks incomplete for the base case).

## 5. Settings UI

[CurrencySettingsScreen.tsx](../../../src/screens/CurrencySettingsScreen.tsx) gains a second
chip-picker row, "Show totals in," directly below the existing "Enter new expenses in" row.
Same component pattern, same `active` list, same disabled-while-only-MYR visibility rule
(`isMultiCurrency(active)`). Selecting a chip calls `setDisplayCurrency` (new function in
`currencyRepo.ts`, mirroring `setEntryCurrency`) and reloads.

Entry currency and display currency are independent: a student in China can keep entering
expenses in CNY while viewing all totals in MYR, or switch totals to CNY, or USD, or any
other active currency — no coupling between the two settings.

## 6. Per-screen behavior

| Screen | Headline conversion | Breakdown |
| --- | --- | --- |
| Dashboard | spent / income / leftover convert | — |
| Budget | envelope totals convert | — |
| Net Worth | net worth headline converts | ✅ per-currency native totals |
| Activity (all-transactions) | summary cards (`totalSpent`, `totalIncome`, `filterTotal`) convert | ✅ per-currency native totals for the filtered set |
| Monthly Recap | income/expense/net hero, net-worth strip convert | ✅ per-currency native totals for the month |
| Export ([financialExport.ts](../../../src/lib/financialExport.ts)) | every KPI/table total converts | ✅ new per-currency subtotal table |
| Tax ([taxExport.ts](../../../src/lib/taxExport.ts), [TaxScreen.tsx](../../../src/screens/TaxScreen.tsx)) | **unchanged — MYR only** | — |

A number of these screens currently render `"RM " + fmt(value)` as inline strings rather than
through the shared [`Amount`](../../../src/components/ui.tsx) component (e.g.
[RecapScreen.tsx:124](../../../src/screens/RecapScreen.tsx:124),
[AllTransactionsScreen.tsx:345](../../../src/screens/AllTransactionsScreen.tsx:345)). Those
call sites need to route through the new display-aware formatting instead of the literal
`"RM"` prefix. Exact call-site enumeration is implementation-plan work, not spec work.

## 7. Testing

- `fx.test.ts` (new or extended): `toDisplay` round-trips against `rateFor`, returns `null`
  on missing rate, MYR short-circuits to 1:1 regardless of cache contents.
- `networth.test.ts`: `nativeTotalsByCurrency` groups correctly, skips archived accounts,
  always includes MYR.
- New test for the transaction-shaped `nativeTotalsByCurrency`: groups by `currency`, uses
  `nativeAmount ?? amount`.
- `currency.test.ts` / `currencyRepo` coverage: `display_currency` defaults to MYR, falls
  back to MYR when the stored value is deactivated, `resetAllData` clears it.
- No new tests needed for tax export/screen — explicitly unchanged.

## 8. Out of scope for this pass

- Any UI for comparing currencies against each other (e.g. "USD is worth X% of your net
  worth") — just the two numbers side by side, no derived ratios.
- Animating or highlighting the value when it changes due to rate drift.
