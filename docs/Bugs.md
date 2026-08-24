I've finished the audit. Here's what I did and what I found.

## What I audited

I read the money-handling core (splits, receivables, commitments/DCA, net worth, budget, relief/tax), the persistence layer (all repos, migrations, cascades), the state layer (`store.tsx`), and the date/streak logic, then verified the arithmetic findings by running probe tests against the real functions.

Baseline: `tsc --noEmit` is clean and all 740 tests across 54 suites pass. **None of the bugs below are caught by the existing suite**, which is why they're still there.

---

## 1. CRITICAL: Paying a DCA commitment corrupts the holding's units and cost basis

**Where:** [store.tsx:1354](src/state/store.tsx:1354) (`payCommitment`) and [store.tsx:1414](src/state/store.tsx:1414) (`unpayCommitment`)

`payCommitment` reads the target holding out of the `accounts` React state, writes `quantity + units` and `cost + paidAmount` straight to SQLite via `dbUpdateHoldingQuantity` / `dbUpdateHoldingCost`, and then finishes with only `setTransactions(...)` and `refreshCommitmentState()`. Neither of those reloads `accounts`. So after a tick, the DB has the new quantity but the in-memory `accounts` array still holds the pre-tick value, and the `useCallback` closure keeps handing that stale value to the next write.

**Scenario A (silent loss).** You hold 0.05 BTC, cost basis RM15,000, and a RM500/month DCA commitment. The Commitments screen shows both August and September due. You tick August: the DB correctly goes to 0.05166667 BTC / RM15,500. You then tick September without leaving the screen: the code re-reads `target.quantity` as 0.05 and `target.cost` as 15000, and writes 0.05166667 / RM15,500 again. August's RM500 contribution is gone from the holding. Both occurrences still show a green tick, so nothing tells you.

**Scenario B (negative holding).** You add a brand-new BTC holding at quantity 0, tick this month's DCA (DB goes to 0.00166667), then change your mind and untick. `unpayCommitment` reads the stale quantity 0, subtracts the recorded `unitsAdded` of 0.00166667, and writes **-0.00166667**. `updateHoldingQuantity` has no clamp, so Net Worth now shows a negative investment balance. On an existing holding, the same path leaves you one full contribution below where you started.

Both scenarios only reset when the app process is killed and relaunched.

---

## 2. HIGH: "Reset and restart setup" leaves the whole app showing deleted data

**Where:** [store.tsx:1013](src/state/store.tsx:1013)

```
const resetToOnboarding = useCallback(async () => {
  await dbResetAllData();
  await setMeta(ONBOARDING_KEY, 'false');
  setOnboardingComplete(false);
}, []);
```

`resetAllData` (the sibling right above it) calls `refreshAll()` afterwards. This one does not. `completeOnboarding` doesn't either, and I checked `App.tsx` — the only `AppState` "active" listener calls `syncStreakWidget()`, not `refreshAll`.

**Scenario.** Settings → Reset and restart setup → confirm. SQLite is genuinely wiped. You walk through the wizard, finish, and land on the Dashboard, which renders every transaction, account, balance, split and commitment from before the reset, because those arrays are still sitting in React state. The month's spend total, Net Worth, and the Owed screen all show data that no longer exists in the database. Tapping into a "transaction" and deleting it runs a `DELETE` against an id that isn't there. The Android streak widget also gets re-pushed the old streak. Only force-quitting the app clears it.

---

## 3. HIGH: Logging between midnight and 8am doesn't count toward the streak

**Where:** [streak.ts:32](src/lib/streak.ts:32) (`activeDays`), interacting with `todayKey()` at [store.tsx:159](src/state/store.tsx:159)

`todayKey()` builds the date from **local** accessors, so at 00:30 in Malaysia it writes `date: '2026-08-24'`. But `activeDays` computes its cutoff as `Math.floor(Date.now() / 86_400_000)`, which is the **UTC** day number, still on the 23rd at that moment. The freshly-saved row therefore looks future-dated and gets dropped by the `d <= today` filter.

I verified this numerically. Simulating a UTC+8 device at 00:30:

- `computeStreak` with the fresh log: **1**
- `computeStreak` without the fresh log: **1** (identical, the log contributed nothing)
- Logging every night at 00:30 for three consecutive nights yields a streak of **2**, not 3.

**Scenario.** You're a night owl. You log yesterday's dinner at 12:30am. The week ring lights up today's dot (it uses local dates and is correct), but the streak number refuses to move, so the two disagree on the same screen. Worse, `useReminderSync` feeds `lastActiveDay` into `planLogReminders` ([useReminderSync.ts:84](src/state/useReminderSync.ts:84)), and `lastActiveDay` returns the day *before yesterday*, so the app fires a "you haven't logged" nudge that evening. If today was the day your streak would lapse, it lapses despite you having logged.

The comment at [reminders.ts:152](src/lib/reminders.ts:152) reasons about exactly this UTC/local seam and concludes "for a row carrying a `date` the two agree exactly." The encoding does agree; the filter in `activeDays` is what breaks it.

---

## 4. HIGH: Re-opening a "Shares" split silently re-splits it equally

**Where:** [SplitSheet.tsx:71](src/components/SplitSheet.tsx:71), root cause in [types.ts:195](src/lib/types.ts:195)

`SplitDraft` and the `splits` table store only `{personId, owed}`. There is nowhere to persist per-person weights. The re-seed effect does `setWeights({})` and `setSelfWeight(1)`, so every participant comes back at weight 1.

Verified numerically on a RM120 bill where A took a double share:

- Original saved split: you RM30, A RM60, B RM30
- The instant you re-open the sheet: you RM40, A RM40, B RM40

**Scenario.** You split a RM120 dinner where your friend ordered for two. You save it. Later you tap the split to check who still owes you, or to add a fourth person. The moment the sheet opens it displays 40/40/40, and the summary shows your expense as RM40 instead of RM30. Tap "Save split" and the wrong figures are written to the receivable. There is no warning that reopening changed anything.

---

## 5. MEDIUM: Double-tapping "Mark settled" credits your bank account twice

**Where:** [store.tsx:884](src/state/store.tsx:884) (`settleShare`)

`recordPayment` correctly caps overpayment and returns early with `if (applied <= 0) return next;` — note it returns a **truthy** object. `settleShare` only checks `if (!result) return;`, then unconditionally credits the account with the raw `amount` argument rather than the delta that was actually applied.

The "Mark settled" button in `SettleSheet` is only `disabled={amount <= 0}`; there's no in-flight guard, and `setSettling(null)` happens after the `await`.

**Scenario.** A friend owes you RM30 and hands you cash. On the Owed screen you tap "Mark settled", the tap doesn't feel like it registered, so you tap again. The first call records a RM30 payment and adds RM30 to your Cash account. The second call finds nothing left to apply, records no payment row, but still adds another RM30 to Cash. The receivable is correct; your cash balance and net worth are RM30 too high, with no payment row to explain it.

Both current callers happen to pre-cap the amount, so the overpayment half of this is latent. The double-tap half is live.

---

## 6. MEDIUM: Deleting a category leaves recurring bills pointing at it

**Where:** [categoriesRepo.ts:128](src/db/categoriesRepo.ts:128)

`deleteCategory` reassigns `transactions.category_id` to a fallback and clears `merchant_memory` and `budget_allocation`, but never touches `commitments.category_id`. It also leaves the id embedded in `budget_snapshot.allocations`.

**Scenario.** You create a custom "Broadband" category and map your Unifi bill to it. Months later you tidy up and delete the category. Existing Unifi transactions are safely moved to the fallback. But the commitment still stores the dead id, so next month when you tick Unifi paid, `payCommitment` creates a transaction with `categoryId` pointing at a category that no longer exists. That row won't appear in any category breakdown or count against any budget envelope, and it repeats every month.

---

## 7. MEDIUM: Deleting a transaction leaves its commitment stuck on "paid"

**Where:** [store.tsx:818](src/state/store.tsx:818) (`removeTransaction`)

The cascade covers splits and relief tags but not `commitment_occurrences.txn_id`.

**Scenario.** You tick your RM89 Astro bill paid, which creates the ledger row and deducts RM89 from your linked account. Later, tidying the Activity list, you delete that row. The Commitments screen still shows Astro ticked and paid for the month, linked to a transaction that no longer exists. The RM89 account deduction stays. If you then untick, `unpayCommitment` posts a compensating +RM89 for a row it can't find, and the on-time record still counts a payment with no evidence behind it.

---

## 8. MEDIUM: Attaching an e-Invoice photo doesn't clear the "no evidence" state

**Where:** [relief.ts:51](src/lib/relief.ts:51)

```
if (!txn.receiptUri && !tag.certImageUri) return 'no-image';
```

`einvoiceImageUri` is never consulted in that first check, even though the sheet lets you attach one ([ReliefTagEditSheet.tsx:159](src/components/ReliefTagEditSheet.tsx:159)) and an e-Invoice is the strongest proof LHDN accepts.

**Scenario.** You buy a laptop and the transaction arrives via a bank-statement import, so it has no `receiptUri` (only the receipt-scan flow saves one). You request the individual e-Invoice from the merchant, photograph it, and attach it to the relief tag. The tag still evaluates to `no-image` forever. Because `isRequestable` only fires on `weak-unnamed`, the tag also drops out of the "requestable this month" list and the Settings badge count, so the app stops reminding you about the one thing you already did.

---

## 9. LOW: A printed "before" discount is applied twice on an itemised split

**Where:** [parseReceipt.ts:133](src/lib/parseReceipt.ts:133) (`derivedSurcharges`) feeding [split.ts:261](src/lib/split.ts:261)

`derivedSurcharges` divides the printed service charge by the **pre-discount** subtotal to back out a percentage. But a receipt that applied the voucher at the till computed the service charge on the **discounted** base. `computeItemizedTotalCents` then subtracts the discount again before applying that already-understated percentage.

Verified: a RM100 subtotal with a RM20 "before" voucher, RM8 service, RM5.28 tax, RM93.28 charged. `derivedSurcharges` backs out 8% and 5%, and `computeItemized` returns `computedTotal: 90.72` against a real charge of 93.28, leaving a phantom RM2.56 "difference".

**Scenario.** Four of you use a RM20 voucher at a restaurant. You scan the receipt and itemise it. The RM2.56 gap gets treated as a tip or a missed line and split **equally**, instead of riding proportionally on what each person ordered. The person who only had a drink is overcharged by a few cents relative to the person who had the steak. The total still reconciles against the card charge, which is why nothing looks wrong.

---

## 10. LOW / latent: `genId()` is weak for bulk inserts

**Where:** [db.ts:370](src/db/db.ts:370)

`Date.now().toString(36) + Math.random().toString(36).slice(2, 6)` gives only 4 base-36 random characters (about 1.68M values) per millisecond. `addTransactions` generates ids inside a loop within one `withTransactionAsync`. A large statement import that lands many rows in the same millisecond has a real collision chance, and the failure mode is a PRIMARY KEY violation that rolls back the **entire** import, not just the one row. Worth widening to 8+ characters before a Play Store release.

---

## What I checked and found clean

`apportionCents` and the split invariants, `computeUsage`'s aggregate cap logic, `findDuplicate`, `clampToMonth` / `addMonthsClamped`, `netWorth` / `groupByClass` / `netWorthSeries`, the category id remap migration, `deleteSplitRows`'s cascade, and the settlement matching window. `recordBalanceLink` correctly re-reads from SQLite on each loop iteration, so the batch-save balance math accumulates properly.

If you want, I can start fixing these. I'd take them in order 1, 2, 3, 4 (the ones that produce wrong numbers or lost data), writing a failing test for each before the fix.