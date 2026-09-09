# Paywall legal and compliance: research findings

Research conducted 2026-09-09 to support `docs/superpowers/specs/2026-09-09-paywall-design.md`.

**This document is not legal advice and was not written by a lawyer.** It maps
where the risk sits and what the standard mitigations are, so that a lawyer
reviewing the terms has a shorter job. The lifetime tier in particular should
not go live without that review (§4.5).

Sources are linked inline and collected in §6.

---

## 1. Google Play policy requirements

Three requirements are hard, and failing any of them risks rejection. A
rejection inside the Shipaton submission window would be fatal to the entry, so
these are treated as build requirements rather than launch polish.

### 1.1 Disclosure at the point of purchase

The paywall itself must display **price, billing frequency, first charge date,
trial terms, and how to cancel**. These facts must appear on the purchase
surface, **not behind a linked terms page**. Google's wording is that users
"should not have to perform any additional action to review the information."

Material terms that must be explicit: cost, billing cycle, automatic renewal
terms, and whether the subscription is required to use the app.

### 1.2 In-app cancellation, two taps

A 2026 requirement: users must be able to cancel from within the app in **no
more than two taps** from the app's main subscription management screen.

RevenueCat's Customer Center provides this as a drop-in, which is why the spec
uses it rather than hand-rolling a management screen.

### 1.3 No deceptive or manipulative purchase flows

Google prohibits "deceptive or manipulative purchase experiences (including
subscriptions)". In practice this rules out the common dark patterns: a
low-contrast or undersized close control, a dismissal that silently re-opens,
or a trial whose terms are visually de-emphasised relative to the CTA.

The paywall needs a genuinely visible close button. This is also good design,
since soft paywalls out-convert hard ones in the relevant dataset.

### 1.4 Trial conversion reminders

Apps must notify users before a free trial converts to paid. Google sends these
notifications to Android users directly, so this is largely handled at platform
level, but it is worth knowing that the reminder exists and will arrive.

---

## 2. Store fees

Subscriptions carry a **10% service fee plus a separate 5% billing fee**, an
effective **15%**. The reduced 10% subscription service fee was announced for
the US, UK and EEA following the March 2026 Epic settlement. The traditional
Small Business Program charges 15% on the first $1M of annual earnings, rising
to 30% above that threshold.

**Use 15% as the planning number for Malaysia.**

This corrects `docs/monetization-and-marketing-plan.md` §1.4, which states a
"flat 10% service fee" and omits the billing fee.

---

## 3. Malaysian consumer law

The relevant statute is the **Consumer Protection Act 1999 (Act 599)**, which
applies to digital services and online purchases.

The operative prohibition is on **misleading or deceptive conduct**, defined
broadly enough to include conduct "capable of leading a consumer into error",
covering representations about the nature, characteristics, suitability and
availability of goods or services.

**What this means for the lifetime tier.** The legal exposure is not "the app
shut down". It is a gap between what the word "lifetime" led a reasonable buyer
to expect and what was actually delivered. That makes the mitigation *precision
at the point of sale*, not avoiding the offer.

One item to verify with a lawyer, outside the scope of this research: whether
selling digitally into Malaysia requires registration with Suruhanjaya Syarikat
Malaysia (SSM).

---

## 4. Lifetime purchase analysis

### 4.1 The economics favour it, which was not the expected result

| | Lifetime RM199 | Annual RM67 |
|---|---|---|
| Gross | RM199 once | RM67/year |
| Net after 15% | **RM169 today** | RM57/year |
| Expected lifespan | n/a | ~1.6 years at benchmark retention |
| **Expected net value** | **RM169** | **~RM91** |

Using the benchmark 12-month annual retention of 33.9%, an annual subscriber's
expected lifetime is roughly 1.6 years, giving about RM91 net collected slowly.
A RM199 lifetime returns roughly RM169 net immediately. Lifetime wins on both
magnitude and timing, and for a bootstrapped solo developer, cash now is worth
considerably more than cash in 2029.

RevenueCat's guidance is that lifetime pricing runs **2x to 12x annual**, and to
err high. RM199 is roughly 3x, at the conservative end of that range.

### 4.2 Serving cost is negligible

At roughly RM0.007 per AI scan, a heavy user at 60 scans/month costs about
RM0.42/month. RM169 net covers that for **around 30 years**. Unlimited scans for
life is not the open-ended liability it intuitively appears to be.

RevenueCat's own criteria say lifetime suits apps with **low ongoing cost per
user**, and warns against it for apps with high per-user cost or heavy upsell
reliance. Pip has no server, no accounts and no infrastructure, placing it close
to the ideal case.

### 4.3 What could go wrong

**The billing collision, and the most likely source of real bugs.** Lifetime is
a **non-consumable in-app purchase, not a subscription**. It does not support
free trials and does not participate in subscription upgrade paths. A user with
an active subscription who buys lifetime **will be double-charged until they
manually cancel**. RevenueCat documents this as a known source of double
charges, refunds and support load.

*Mitigation: hide the lifetime option entirely from anyone with an active
subscription.* Designing the collision out is far cheaper than supporting it.

**The price is permanent.** A subscription price can be corrected next quarter.
A lifetime price is fixed forever for everyone who bought at it.

**It sells to the wrong cohort.** Launch-window buyers are the most enthusiastic
users, and therefore the ones most likely to still be subscribed in year four.
Lifetime converts the highest-LTV customers into the least profitable ones.

**The retention benchmark is not Pip's.** The 33.9% figure in §4.1 is
cross-category. A finance app with streaks, a widget, notifications and annual
tax-season lock-in could retain considerably better, in which case RM199
underprices the best users, and that will not be knowable for six months.

**"Lifetime" means the app's life, not the buyer's.** If development stops, that
cohort becomes the loudest unhappy audience, and the representation risk in §3
attaches here.

### 4.4 Why Pip's exposure is unusually low

**The product survives its developer.** All data lives in local SQLite with no
accounts and no backend. If development stopped tomorrow, budgets, net worth,
bill splits, tax relief tracking, streaks, the widget, and CSV and JSON export
all keep working indefinitely on the user's device. There is no server to switch
off. This is the opposite of the usual lifetime-deal failure mode, where the
company folds and the app becomes a dead icon.

**Only two things degrade**: AI scanning, which runs on bundled Groq and Gemini
keys, and live price and FX lookups.

**The escape hatch already exists in the code.** `SettingsScreen.tsx:298-308`
exposes Groq and Gemini API key fields with a live connection test, and
`.env.example` confirms the in-app key wins over the bundled one at runtime.
This makes the following commitment truthful today, not aspirational:

> If Pip is ever discontinued, the final release will let you use your own API
> key so every feature keeps working. Nothing you have paid for stops.

Very few apps selling lifetime access can make that promise honestly.

**Bounded worst case.** 200 founding supporters at RM199 is **RM39,800** of
total theoretical refund exposure. Google acts as merchant of record for Play
purchases, so refund requests route through Google first. That is a buffer, not
immunity.

### 4.5 Required mitigations

1. Sell it as **"one-time purchase, unlocks Pro for the lifetime of the app"**.
   Never bare "lifetime access".
2. State on the purchase surface that AI scanning depends on a third-party
   service, and what happens if that changes.
3. Publish the wind-down commitment in §4.4.
4. Hide lifetime from users with an active subscription (§4.3).
5. Keep it a genuinely limited founding offer. The scarcity must be real, both
   because manufactured scarcity is itself a deceptive-conduct risk and because
   it preserves the option to re-price once retention data exists.
6. **Have the terms reviewed by a lawyer before the offer goes live.**

The "Founding Supporter" framing helps by setting an expectation of supporting
development rather than buying a perpetual service guarantee. Treat that as
helpful framing, not a legal shield.

---

## 5. Outstanding items to verify

- Whether RM9.90 and RM67 are valid Play price points for Malaysia.
- Whether prices listed in Play Console for Malaysia are SST-inclusive.
- Whether selling digitally into Malaysia requires SSM registration.
- Legal review of the lifetime terms and the wind-down commitment.
- A privacy policy. None exists in the repo, and Google Play requires one for
  any app handling financial data. This is a hard submission blocker tracked in
  `plan.md` Phase A.

---

## 6. Sources

- [Google Play, subscriptions (Play Console Help)](https://support.google.com/googleplay/android-developer/answer/9900533)
- [Google Play, service fees](https://support.google.com/googleplay/android-developer/answer/112622)
- [FunnelFox, 2026 compliance guide for subscription apps](https://blog.funnelfox.com/subscription-app-compliance-2026/)
- [AppTester, Google Play developer policies reference 2026](https://www.apptester.co/blog/google-play-policies)
- [RevenueCat, a guide to lifetime subscriptions](https://www.revenuecat.com/blog/growth/lifetime-subscriptions)
- [RevenueCat, the 15% app store fee guide](https://www.revenuecat.com/blog/engineering/small-business-program)
- [PricePush, Google Play subscription fees 2026](https://pricepush.app/blog/google-play-subscription-fees-2026-real-math)
- [Consumer Protection Act 1999 (Act 599), full text](https://lom.agc.gov.my/ilims/upload/portal/akta/LOM/EN/Act%20599%20-%2029.08.2016.pdf)
- [NSA Legal, overview of the Consumer Protection Act 1999](https://nsa-legal.com/posts/brief-overview-of-the-consumer-protection-act-1999-of-malaysia-)
- [Yeong & Associates, consumer protection laws and business practices in Malaysia](https://www.yeongassociates.com/post/consumer-protection-laws-and-business-practices-in-malaysia)
- [Sprintlaw, mobile app terms of service: refunds, disclosures and risks](https://www.sprintlaw.com/articles/mobile-app-terms-of-service-refunds-disclosures-and-contract-risks-to-watch/)
- [RevenueCat Shipaton 2026 official rules](https://revenuecat-shipaton-2026.devpost.com/rules)
