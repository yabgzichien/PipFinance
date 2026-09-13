# Pip Pro: entitlements, paywall, and upgrade surfaces

Status: revised from decisions approved in chat through 2026-09-13; pending final
user review before implementation.

Supersedes the monetization sections of `docs/monetization-and-marketing-plan.md`
§1.3 and `docs/growth-and-retention-strategy.md` §4 where they conflict. Those
conflicts are enumerated in §3.

Supporting research lives in two companion documents:

- `docs/paywall-pricing-psychology-research.md` (pricing benchmarks, conversion
  data, behavioural models)
- `docs/paywall-legal-compliance-research.md` (Play policy, Malaysian consumer
  law and background analysis for the now-removed lifetime option)

## 1. Context

Pip has no monetization today. `business-plan.md` §5 deliberately deferred the
paid tier ("genuinely TBD") and left the free AI-scan cap as an open number.
This spec closes both, adds a billing integration, and defines where the product
asks for money.

Three facts about the current codebase shape everything below.

**There is no Pip account, and financial records remain local.** All product
data lives in local SQLite (`src/db/`), with settings in
`src/settings/settingsStore.ts` and expo-secure-store. A minimal Cloudflare
Worker is nevertheless required to protect provider keys and enforce shared
scan quotas. It stores only an anonymous installation identifier, quota
counters, entitlement-verification metadata and operational abuse signals. It
must never persist receipt images, extracted transactions or financial records.
This preserves the "no account required" positioning (`business-plan.md` §3)
without pretending a client-only AI quota is enforceable.

**AI capture consumes a shared, finite provider pool.** The launch configuration
uses free provider allowances where available. Their request, token and burst
limits are shared by every tenant and can change independently of Pip. Free
caps therefore protect availability as well as conversion. Pro remains
marketed and implemented as unlimited: it has no user-visible monthly or daily
scan quota, although ordinary anti-automation, concurrency and emergency global
circuit breakers still apply to protect the service.

**Developer provider keys are currently exposed to the client.** Existing Groq,
Gemini and OpenRouter settings remain in the code for possible future work, but
their UI is hidden at launch. BYOK is not offered. Production calls go through
the Worker, and no provider secret is shipped in an `EXPO_PUBLIC_*` value.

## 2. Decisions taken

Settled in chat before design:

1. **Freemium, not a hard paywall.** Pip competes against genuinely free
   trackers (Money Manager, Wallet). A hard wall converts better per-user but
   costs installs Pip cannot afford at launch.
2. **Two gating principles, named separately rather than conflated.**
   - *Ongoing cost or labour.* AI scans (shared provider capacity) and the LHDN relief
     schedule (`src/lib/reliefSchedule.ts` changes every budget year).
   - *Segment price discrimination.* Features with low usage among the
     beachhead persona but high willingness to pay: multi-currency FX,
     exports, historical net worth. These cost nothing to serve; they
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
8. **Advanced Import, full backup/restore and social sharing stay free.** Users
   can bring data in, keep a portable copy, restore it, and share generated
   recap or split-bill images without subscribing.
9. **Every financial and tax export is Pro.** Free users may preview the Export
   screen, but the final export action is the gate. Backup is a separate data
   portability operation and is never gated.

## 3. Reconciliation with existing docs

Five documented decisions changed. Recorded here so the older documents can be
corrected rather than silently contradicted.

| Item | Previously documented | Now | Why |
|---|---|---|---|
| Annual price | RM79, ~33% off | **RM67**, 44% off | 30-40% is the band where 59% of users pick annual; the 5-7x monthly ratio converts best. RM67 is 6.8x. |
| Free scan cap | 35-40/month | **20/month and 3/day** | One screenshot yields 5-10 transactions. The daily ceiling prevents one installation from exhausting shared provider capacity. |
| Tax relief | Free, "isn't negotiable" | **Tracking free, export Pro** | Splitting preserves `store-description.md:27` and the Malaysian moat, while monetizing at filing season. |
| Top-up credits | RM4.90 / 100 scans | **Deferred** | A consumable is a third product type and more billing surface. Revisit post-launch. |
| Export access | CSV/JSON free | **All financial and tax exports Pro** | Data portability remains free through full backup/restore; polished reporting is the paid outcome. |
| Advanced Import | Pro | **Free** | Users must be able to bring their data into Pip without paying. |
| Lifetime tier | RM199 launch offer | **Removed** | Avoids an indefinite service obligation for a feature dependent on third-party AI capacity. |

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
- Advanced Import
- Full data backup and restore, including portable transaction data and images
- Monthly recap images, split-bill receipt sharing and other social images
- **20 successful AI scans per UTC calendar month, with a maximum of 3 per UTC day**

**Pro**

- Unlimited AI scans
- All financial and tax exports, including PDF, Excel, CSV, JSON, audit packs,
  evidence ZIPs and relief statements
- Multi-currency display and normalization
- **Historical net worth curve and monthly trend analysis**
- Full widget and mascot customizer

Gating history rather than prices is deliberate. The current net worth figure
stays correct for everyone; only the derived trend over time is Pro. No store
copy promises the history (`store-description.md` does not mention it; only the
developer-facing `README.md:23` describes it), so nothing needs rewriting.

All report exports are Pro. This does not lock users into Pip because full data
backup and restore remain free and are presented separately from report export.

## 5. Architecture

New folder `src/billing/`, self-contained so monetization is one directory that
could be removed wholesale.

| File | Responsibility |
|---|---|
| `purchases.ts` | RevenueCat SDK wrapper: configure, fetch offerings, purchase, restore |
| `entitlement.tsx` | `EntitlementProvider` and the `useEntitlement()` hook |
| `entitlementCache.ts` | Last-known tier plus timestamp, offline grace window |
| `scanQuota.ts` | Client representation of server quota state and fail-closed gate |
| `scanProxy.ts` | Authenticated Worker client; sends scan requests without exposing provider keys |
| `upsellCadence.ts` | Frequency cap and rotation for the ambient Pip line |

New screens and components:

- `src/screens/PaywallScreen.tsx`
- `src/components/ScanQuotaBadge.tsx`
- `src/components/PipUpsellCard.tsx`

Modified:

- `App.tsx`: wrap the tree in `EntitlementProvider`, add `'paywall'` to the
  `Screen` union and its routing
- `src/screens/SettingsScreen.tsx`: subscription status row, restore purchases,
  and the Customer Center entry; hide provider-key/BYOK controls
- `src/lib/backupRestore.ts`: degrade Pro-only widget config on restore (§12)
- The gate sites listed in §8

The Worker owns provider routing, monthly and daily quota checks, idempotency,
and rate limiting. D1 stores counters keyed by a salted hash of the anonymous
installation identifier. Play Integrity is verified when available. Provider
keys live only in Worker secrets. The mobile app may cache quota state for UI,
but cached values never authorize a scan.

`react-native-purchases` is installed as a native dependency without adding a
nonexistent Expo config-plugin entry. A development-client rebuild is required.

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
  dailyScansUsed: number,
  dailyScansLimit: number,   // 3 for free, Infinity for pro
  dailyScansRemaining: number,
  canScan(): boolean,
  submitScan(request: ScanRequest): Promise<ScanResult>, // always through Worker
}
```

## 7. Scan quota

The authoritative quota is stored in D1 by the Worker. Each anonymous
installation has a UTC calendar-month counter and a UTC calendar-day counter.
Free users may complete at most **20 successful scans per month and 3 successful
scans per day**. Pro users have no monthly or daily product quota.

**The quota burns on successful extraction only.** If the vision call fails,
times out, or returns unparseable JSON, the user keeps the scan. Charging
someone for an outage is how a free tier earns one-star reviews.

The Worker reserves a quota slot before calling a provider and commits it only
after receiving a valid extraction. Every request carries an idempotency key so
retries cannot consume multiple slots. Reservations expire automatically. UTC
boundaries come from the server clock, not the device clock.

The anonymous identifier plus Play Integrity makes casual clock changes, API-key
extraction and direct-provider calls ineffective. Reinstall abuse cannot be
eliminated completely without an account, but per-IP/device signals and global
rate controls make it materially harder. These controls must never convert into
a hidden quota for legitimate Pro use: Pro scans bypass daily/monthly quota
checks and are restricted only for clear automation, unsafe concurrency or a
temporary provider-wide outage.

## 8. Gates

**Hard gates.** The action is blocked and routes to `PaywallScreen` with a
trigger identifier that selects the headline.

| Site | File | Trigger |
|---|---|---|
| Scan quota exhausted | `ScanKindScreen.tsx`, `ReceiptScanScreen.tsx`, `ExtractScreen.tsx`, `BalanceScanScreen.tsx` | `scan_quota` |
| Tax audit pack / PDF statement | `TaxScreen.tsx:157`, `:196` (`buildAuditPackPdf`, `buildEvidenceZip` from `src/lib/taxExport.ts`) | `tax_export` |
| Any financial report export | `ExportScreen.tsx`; gate the final Export action after free preview | `report_export` |
| Multi-currency display | `CurrencySettingsScreen.tsx` | `multi_currency` |
| Net worth history | `NetWorthHistoryScreen.tsx` | `networth_history` |
| Full widget customizer | `WidgetCustomizerScreen.tsx` | `widget_custom` |

`NetWorthScreen.tsx` itself is never gated, and neither is any call into
`src/prices/`. Only the historical trend screen is Pro.

Everything else on `TaxScreen` stays free: tagging, cap and sub-cap validation,
and the receipt evidence archive. Only export actions are gated. Advanced
Import, full backup/restore and social-image sharing remain reachable without
entitlement.

## 9. Upgrade surfaces

Four tiers of escalation. The ordering principle: hard gates convert intent,
contextual prompts convert goodwill, ambient signals work quietly, and a
permanent banner converts neither while costing the calm the product sells.

### 9.1 Hard gate

Full `PaywallScreen`, triggered as in §8.

### 9.2 Contextual, offers but never blocks

There is no paywall or Pro card after onboarding.

After the first successful scan, a 7-day streak, or a tax-relief milestone,
show a small dismissible Pro card in context. The card never opens the paywall
automatically; only its explicit CTA does. Example: "You have tracked RM1,240
of relief this year. Export the audit pack with Pro."

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
5. Required disclosure block (§11.1)
6. Restore purchases, and a **visible, real close button**

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

### 11.3 Provider privacy and service wording

There is no lifetime product and no BYOK promise. Store and in-app disclosures
must state that AI scanning uses third-party providers, requires network access,
and may be temporarily unavailable when a provider is down. Before production,
confirm that the selected provider tier and data-retention terms are suitable
for financial images; do not silently route sensitive scans through a free tier
that may use submitted content for model improvement.

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

- Worker quota: monthly and daily UTC rollover, 20/month and 3/day boundaries,
  successful-scan commit, failed-call rollback, idempotent retries, concurrent
  reservations, free enforcement and Pro bypass
- Entitlement resolution: fresh Pro, cached Pro inside grace, cached Pro past
  grace resolving to free, and cold start while offline resolving to free
- Gate behaviour: each trigger site routes to the paywall with the
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
- BYOK UI or user-supplied provider keys. Existing settings code is hidden, not
  deleted, for possible later reconsideration.
- A lifetime purchase.

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
- Pick the exact streak milestones that unlock free widget looks.
- Record the active Gemini project quotas and privacy terms before launch; the
  public free-tier limits are not a capacity guarantee.
