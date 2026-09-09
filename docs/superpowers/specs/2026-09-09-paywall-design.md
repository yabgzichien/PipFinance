# Pip Pro: entitlements, paywall, and upgrade surfaces

Status: approved in chat 2026-09-09, spec pending user review before implementation.

Supersedes the monetization sections of `docs/monetization-and-marketing-plan.md`
§1.3 and `docs/growth-and-retention-strategy.md` §4 where they conflict. Those
conflicts are enumerated in §3.

Supporting research lives in two companion documents:

- `docs/paywall-pricing-psychology-research.md` (pricing benchmarks, conversion
  data, behavioural models)
- `docs/paywall-legal-compliance-research.md` (Play policy, lifetime exposure,
  Malaysian consumer law)

## 1. Context

Pip has no monetization today. `business-plan.md` §5 deliberately deferred the
paid tier ("genuinely TBD") and left the free AI-scan cap as an open number.
This spec closes both, adds a billing integration, and defines where the product
asks for money.

Three facts about the current codebase shape everything below.

**There is no backend and no account.** All data lives in local SQLite
(`src/db/`), settings in `src/settings/settingsStore.ts` and expo-secure-store.
Any entitlement system must work offline and must not introduce a Pip account,
because "no account required" is a load-bearing pillar of the positioning
(`business-plan.md` §3).

**AI capture is the only feature with a real marginal cost, and it is tiny.**
Gemini 3.1 Flash Lite runs roughly RM0.007 per scan. A heavy user at 60
scans/month costs about RM0.42/month against RM8.42 net monthly revenue. Scan
caps are therefore a fairness and abuse guard, not a margin guard. This is a
correction to the framing in `monetization-and-marketing-plan.md` §1.1, which
correctly identified the cost as small but treated free-tier *rate* limits as
the trigger for monetizing.

**Users can already supply their own API keys.** `SettingsScreen.tsx:298-308`
exposes Groq and Gemini key fields with a live test, and the in-app key wins
over the bundled one at runtime. This matters for the lifetime tier's wind-down
commitment (§11.3).

## 2. Decisions taken

Settled in chat before design:

1. **Freemium, not a hard paywall.** Pip competes against genuinely free
   trackers (Money Manager, Wallet). A hard wall converts better per-user but
   costs installs Pip cannot afford at launch.
2. **Two gating principles, named separately rather than conflated.**
   - *Ongoing cost or labour.* AI scans (per-call cost) and the LHDN relief
     schedule (`src/lib/reliefSchedule.ts` changes every budget year).
   - *Segment price discrimination.* Features with low usage among the
     beachhead persona but high willingness to pay: multi-currency FX,
     advanced import, historical net worth. These cost nothing to serve; they
     are Pro because of who wants them, not what they cost.

   Cosmetics sit outside both, deliberately, because they need no
   justification at all. Being explicit about which principle applies where
   prevents the second from being smuggled in under the first.
3. **Never gate accuracy.** Live prices stay free (§4). Gating a price feed
   would not make the free tier limited, it would make a displayed net worth
   figure wrong, which corrodes trust in the one number the screen exists to
   produce. Gate features and derived analysis, never correctness.
4. **Tax relief tracking stays free; only the export is Pro.** See §3.
5. **RevenueCat, Android first.** Required for the Shipaton entry, and it
   removes receipt validation, restore, and grace-period handling from scope.
6. **Hand-rolled paywall UI, RevenueCat Offerings for pricing.** Prices change
   remotely without a release; the screen itself stays in Pip's voice. A
   template paywall would undercut the brand differentiator in
   `business-plan.md` §4.
7. **The widget carries no upsell, ever.** It is a distribution surface that
   other people see. See §9.4.

## 3. Reconciliation with existing docs

Five documented decisions changed. Recorded here so the older documents can be
corrected rather than silently contradicted.

| Item | Previously documented | Now | Why |
|---|---|---|---|
| Annual price | RM79, ~33% off | **RM67**, 44% off | 30-40% is the band where 59% of users pick annual; the 5-7x monthly ratio converts best. RM67 is 6.8x. |
| Free scan cap | 35-40/month | **20/month** | One screenshot yields 5-10 transactions, so 20 covers 100-200 logged items. Generous per scan, still creates upgrade pressure by week three. |
| Tax relief | Free, "isn't negotiable" | **Tracking free, export Pro** | Splitting preserves `store-description.md:27` and the Malaysian moat, while monetizing at filing season. |
| Top-up credits | RM4.90 / 100 scans | **Deferred** | A consumable is a third product type and more billing surface. Revisit post-launch. |
| Tier count | "Three only, no fourth" | **Lifetime as a secondary line** | Respects the paradox-of-choice concern without giving up the anchor. Not a fourth equal-weight card. |

**Two factual corrections to `monetization-and-marketing-plan.md` §1.4.** It
states Play charges "a flat 10% service fee" for small businesses. That omits
the separate 5% billing fee, making the effective rate **15%**; the 10%
subscription service fee was also announced for the US, UK and EEA, not
Malaysia. It also assumes direct Play Billing, which RevenueCat now replaces.

## 4. Pricing and tiers

| Plan | Price | Presentation |
|---|---|---|
| Monthly | RM9.90 | Secondary option |
| **Annual** | **RM67** | **Pre-selected**, labelled "RM5.58/month, save 44%" |
| Founding lifetime | RM199 | Secondary text line, launch window only, first 200 |

**Trial: 14 days, annual plan only.** Longer trials convert far better than
short ones (42.5% for 17-32 day trials against 25.5% for four days or fewer),
and restricting the trial to annual avoids acquiring low-value monthly
subscribers. A trial is also effectively mandatory for Shipaton judging.

**Free tier**

- Unlimited manual entry, budgets, category envelopes, budget wizard
- Net worth, assets and liabilities, at **live crypto, stock, gold and FX
  prices**. Never gated: `store-description.md:24` promises "cash, crypto,
  stocks, and gold at live prices", and `src/prices/` uses only free
  unauthenticated endpoints (Yahoo Finance, `open.er-api.com`, a jsdelivr
  mirror), so there is no cost to recover and no reason to let a free user's
  net worth go stale
- Bill splitting and the Owed screen
- Recurring commitments and DCA
- Streaks, notifications, and a fully working home-screen widget with a good
  default look, two to three themes, and further looks unlocked by streak
  milestones
- Tax relief tagging, cap and sub-cap validation, receipt evidence archive
- CSV and JSON export
- **20 AI scans per month**

**Pro**

- Unlimited AI scans
- Tax audit pack and PDF relief statement export
- PDF and Excel financial reports
- Advanced import
- Multi-currency display and normalization
- **Historical net worth curve and monthly trend analysis**
- Full widget and mascot customizer

Gating history rather than prices is deliberate. The current net worth figure
stays correct for everyone; only the derived trend over time is Pro. No store
copy promises the history (`store-description.md` does not mention it; only the
developer-facing `README.md:23` describes it), so nothing needs rewriting.

CSV and JSON export stay free deliberately. Locking users out of their own data
would contradict the privacy pillar the product is sold on.

## 5. Architecture

New folder `src/billing/`, self-contained so monetization is one directory that
could be removed wholesale.

| File | Responsibility |
|---|---|
| `purchases.ts` | RevenueCat SDK wrapper: configure, fetch offerings, purchase, restore |
| `entitlement.tsx` | `EntitlementProvider` and the `useEntitlement()` hook |
| `entitlementCache.ts` | Last-known tier plus timestamp, offline grace window |
| `scanQuota.ts` | Monthly counter, month-boundary reset, increment on success |
| `upsellCadence.ts` | Frequency cap and rotation for the ambient Pip line |

New screens and components:

- `src/screens/PaywallScreen.tsx`
- `src/components/ScanQuotaBadge.tsx`
- `src/components/PipUpsellCard.tsx`

Modified:

- `App.tsx`: wrap the tree in `EntitlementProvider`, add `'paywall'` to the
  `Screen` union and its routing
- `src/screens/SettingsScreen.tsx`: subscription status row, restore purchases,
  and the Customer Center entry
- `src/lib/backupRestore.ts`: degrade Pro-only widget config on restore (§12)
- The gate sites listed in §8

`react-native-purchases` is added via its Expo config plugin. A dev build is
already in use (`expo-dev-client` is a dependency), so the workflow does not
change.

## 6. Entitlement resolution

```
App launch
  └─ Purchases.configure(REVENUECAT_ANDROID_KEY)
     └─ getCustomerInfo()            // SDK-cached, resolves offline
        ├─ success → tier from active entitlements
        │            └─ write entitlementCache { tier, checkedAt }
        └─ failure → read entitlementCache
                     ├─ within 7 days of checkedAt → honour cached tier
                     └─ older, or no cache        → free
```

The 7-day grace exists so a paying user who is offline, travelling, or on a
flaky connection is never locked out of something they paid for. A cold first
launch with no cache resolves to free, which is safe because the free tier is a
complete, useful application rather than a crippled demo.

`useEntitlement()` returns:

```ts
{
  tier: 'free' | 'pro',
  isPro: boolean,
  isInTrial: boolean,
  trialEndsAt: Date | null,
  scansUsed: number,
  scansLimit: number,        // 20 for free, Infinity for pro
  scansRemaining: number,
  canScan(): boolean,
  recordScan(): Promise<void>,
}
```

## 7. Scan quota

Stored in the existing settings store as `{ month: '2026-09', used: 7 }`. On
read, if `month` does not match the current year-month, reset to zero and write
back. No new table is needed.

**The quota burns on successful extraction only.** If the vision call fails,
times out, or returns unparseable JSON, the user keeps the scan. Charging
someone for an outage is how a free tier earns one-star reviews.

**Known limitation, accepted.** A local counter is defeatable by reinstalling
the app or changing the device clock. With no backend this is unavoidable, and
it is not worth engineering around: anyone willing to reinstall monthly to avoid
RM9.90 was never going to convert. Recorded here so it is a decision rather than
an oversight.

## 8. Gates

**Hard gates.** The action is blocked and routes to `PaywallScreen` with a
trigger identifier that selects the headline.

| Site | File | Trigger |
|---|---|---|
| Scan quota exhausted | `ScanKindScreen.tsx`, `ReceiptScanScreen.tsx`, `ExtractScreen.tsx`, `BalanceScanScreen.tsx` | `scan_quota` |
| Tax audit pack / PDF statement | `TaxScreen.tsx:157`, `:196` (`buildAuditPackPdf`, `buildEvidenceZip` from `src/lib/taxExport.ts`) | `tax_export` |
| PDF and Excel reports | `ExportScreen.tsx` via `generateExcelWorkbook`, `generatePrintablePDFHtml` (`src/lib/financialExport.ts:44`, `:1112`) | `report_export` |
| Advanced import | `AdvancedImportScreen.tsx` | `advanced_import` |
| Multi-currency display | `CurrencySettingsScreen.tsx` | `multi_currency` |
| Net worth history | `NetWorthHistoryScreen.tsx` | `networth_history` |
| Full widget customizer | `WidgetCustomizerScreen.tsx` | `widget_custom` |

`NetWorthScreen.tsx` itself is never gated, and neither is any call into
`src/prices/`. Only the historical trend screen is Pro.

Everything else on `TaxScreen` stays free: tagging, cap and sub-cap validation,
and the receipt evidence archive. Only the two export actions are gated.
`generateCSV` and `generateAdvancedImportJSON` remain free.

## 9. Upgrade surfaces

Four tiers of escalation. The ordering principle: hard gates convert intent,
contextual prompts convert goodwill, ambient signals work quietly, and a
permanent banner converts neither while costing the calm the product sells.

### 9.1 Hard gate

Full `PaywallScreen`, triggered as in §8.

### 9.2 Contextual, offers but never blocks

- **After the onboarding wizard completes.** Dismissible. Between 78% and 90% of
  all trial starts happen on day zero, so this is the highest-leverage single
  placement in the app.
- **After the first successful scan.** The peak moment, when the mechanism has
  just proven itself.
- **On hitting a 7-day streak.** Habit established, goodwill highest.
- **When tracked tax relief crosses a threshold.** For example "You have tracked
  RM1,240 of relief this year. Export the audit pack with Pro."

### 9.3 Ambient

- **Scan counter** on the Add and scan screens: "14 / 20 scans left this month."
  Always visible for free users, hidden for Pro. This is the strongest silent
  lever in the app, because a number ticking down engages loss aversion without
  any sales language.
- **An in-character Pip line**, at most once per week, dismissible, rotating, and
  never twice in a row. Shown after a success moment rather than on a timer.
  Managed by `upsellCadence.ts`.

Draft lines, calibration examples rather than final strings, matching the voice
in `business-plan.md` §4 and carrying no em dashes:

> "You have scanned 17 receipts this month. Pip's eyes are tired. Pro gives them
> unlimited stamina and me a paycheck."

> "3 scans left. Pip is rationing. It's giving austerity budget."

### 9.4 Never

**No upsell on the home-screen widget, and no permanent dashboard banner.** The
widget is a distribution surface that other people see, so an advert there taxes
Pip's own growth. A permanent banner contradicts "clarity, without a lecture"
(`business-plan.md` §6), which is the payoff the entire narrative promises.

## 10. Paywall screen

**Must fit one screen without scrolling.** This is the most consistently cited
audit item in paywall research, and it is the constraint that drives every
layout decision below.

Structure, top to bottom:

1. Contextual headline selected by trigger, in Pip's voice
2. A compact free-versus-Pro comparison, five rows maximum
3. Plan selector with **annual pre-selected**, showing RM67/year and RM5.58/month
4. Primary CTA: "Start 14 days free"
5. Secondary line: the founding lifetime offer, while the window is open
6. Required disclosure block (§11.1)
7. Restore purchases, and a **visible, real close button**

On dismissal without converting, show a time-limited follow-up offer to
non-converters only. This pattern adds 10-15% ARPU.

Local price anchors that are usable in copy: RM67/year is less than four months
of Spotify Individual (RM17.50/month) and roughly three and a half months of
Netflix Mobile (RM18.90/month).

## 11. Compliance

### 11.1 Google Play disclosure

The paywall itself must display, at the point of purchase and not behind a
linked terms page: **price, billing frequency, first charge date, trial terms,
and how to cancel.** Failure here is a rejection risk, and a rejection inside
the submission window would be fatal to the Shipaton entry.

### 11.2 Cancellation

A 2026 Play requirement: users must be able to cancel from inside the app in **no
more than two taps** from the subscription management screen. RevenueCat's
Customer Center satisfies this and is cheap to integrate, so use it rather than
hand-rolling.

No deceptive purchase flows. In practice this means a genuinely visible close
control on the paywall, not a small low-contrast dismiss target.

### 11.3 Lifetime tier

Lifetime is a **non-consumable IAP, not a subscription**. It does not support
trials and does not participate in subscription upgrade paths. A user with an
active subscription who buys lifetime will be double-charged until they manually
cancel.

**Mitigation: hide the lifetime option entirely from anyone with an active
subscription.** This is the single most likely source of billing bugs in this
feature and it is cheapest to design out rather than support.

Wording at point of sale must be "one-time purchase, unlocks Pro for the
lifetime of the app", never bare "lifetime access", and must state that AI
scanning depends on a third-party service.

The wind-down commitment, which the code at `SettingsScreen.tsx:298-308` already
honours and which can therefore be promised truthfully:

> If Pip is ever discontinued, the final release will let you use your own API
> key so every feature keeps working. Nothing you have paid for stops.

Full reasoning and the Malaysian consumer-law analysis are in
`docs/paywall-legal-compliance-research.md`.

## 12. Backup and restore

A backup bundle may contain a Pro-only mascot or widget configuration. On
restore by a user without entitlement, degrade **silently** to the free default.
Never crash, never surface an error, and never render a locked-looking widget on
someone's home screen. If the user later subscribes, the stored configuration
should reactivate rather than having been discarded.

## 13. Error handling

| Case | Behaviour |
|---|---|
| User cancels purchase | Return silently. No toast, no error. |
| Purchase fails | Retry via the existing `platformAlert` helper |
| Offerings fail to load | Render last-known prices, disable the buy control, show "Can't reach the store right now" |
| Restore finds nothing | Friendly message, not an error state |
| Entitlement lookup fails | Grace window per §6 |
| Vision call fails | Do not decrement quota (§7) |

## 14. Testing

Jest with `jest-expo`, following the existing suite in `__tests__/`.

- `scanQuota`: increment, month rollover reset, cap enforcement at the boundary,
  and no decrement on a failed extraction
- Entitlement resolution: fresh Pro, cached Pro inside grace, cached Pro past
  grace resolving to free, and cold start while offline resolving to free
- Gate behaviour: each of the six trigger sites routes to the paywall with the
  correct trigger identifier when unentitled, and passes through when entitled
- `upsellCadence`: the weekly cap holds, and the same line never repeats
  consecutively
- Backup restore: a bundle carrying Pro mascot config, restored by a free user,
  falls back to the default without error and reactivates on later purchase

The existing suite must continue to pass.

## 15. Out of scope

- iOS. Android first; iOS is a later configuration addition, not a rewrite.
- RevenueCat Experiments and A/B testing.
- Server-side receipt validation beyond what RevenueCat performs.
- The top-up consumable (§3), deferred to post-launch.
- Any Pip account, login, or sync. Explicitly excluded, permanently.

## 16. Prerequisites

Two items in `plan.md` Phase A are hard blockers for store submission and are
**not** part of this design. They need their own slot in the schedule, because
the app cannot ship without them:

- **A privacy policy.** None exists anywhere in the repo. Google Play requires
  one for any app handling financial data.
- **Store screenshots.** None exist for the current feature set.

## 17. Open items

- Confirm RM9.90 and RM67 are valid Play price points for Malaysia, and whether
  listed prices are SST-inclusive in Play Console.
- Confirm whether selling digitally into Malaysia requires SSM registration.
- Have the lifetime terms reviewed by a lawyer before the offer goes live.
- Pick the exact streak milestones that unlock free widget looks.
