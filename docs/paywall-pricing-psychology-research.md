# Paywall pricing and UX psychology: research findings

Research conducted 2026-09-09 to support `docs/superpowers/specs/2026-09-09-paywall-design.md`.
Everything here is sourced; the spec states decisions, this document states why.

Sources are linked inline and collected in §8.

---

## 1. Conversion benchmarks

From RevenueCat's *State of Subscription Apps 2026*, the largest public dataset
on mobile subscription performance.

**Download-to-paid conversion by price tier.** This is the finding that reversed
the initial instinct to price low:

| Price tier | Median D35 conversion | Top quartile |
|---|---|---|
| High-priced | 2.8% | above 6.1% |
| Mid-priced | 2.0% | above 4.4% |
| Low-priced | 1.4% | above 3.7% |

Median high-priced apps convert downloads roughly **twice as well** as
low-priced ones. Pricing low therefore loses twice over: fewer conversions *and*
less revenue per conversion. Finance sits inside the Utilities category, whose
global median D35 is 2.1%.

**Paywall type.** Hard paywalls show a 10.7% median conversion against 2.1% for
freemium, but this compares different populations rather than the same users.
A separate dataset puts hard paywalls at **+21% LTV** while soft paywalls
convert **~50% better**. The field is not settled. It does not change Pip's
answer, because competing against genuinely free trackers makes a hard wall an
install-killer regardless of which figure is right.

**Trial length.** Trials of 17-32 days convert to paid at **42.5%**, against
**25.5%** for trials of four days or fewer. Between **78% and 90%** of trial
starts happen on day zero, immediately after download, which is the entire
argument for an onboarding paywall.

**Experimentation.** Top-tier apps run an average of **14.7 experiments** a year
and earn up to **40x** more than non-testing competitors. Test win rates by
category are instructive about where effort pays:

| Test type | Win rate |
|---|---|
| Localization | 62.3% |
| Trial structure | 59.6% |
| Visual / copy only | 34.6% |

**Structure beats styling.** Visual-only tests are the *worst*-performing
category. This is why the spec spends its budget on placement and trial
structure rather than paywall aesthetics.

---

## 2. Price benchmarking for Malaysia

**Regional medians.** RevenueCat reports India/Southeast Asia pricing at roughly
45-50% of North American levels: **$3.75/month** (~RM15.75) and **$18.32/year**
(~RM77), against $9.99 and $39.99 in North America. Pip's RM9.90 and RM67 both
sit *below* the regional median.

**Local subscription anchors.** What Malaysians already pay monthly, and
therefore what shapes their sense of a reasonable price:

| Service | Price |
|---|---|
| Spotify Premium Individual | RM17.50 |
| Netflix Mobile | RM18.90 |
| YouTube Premium Individual | RM20.90 |
| YouTube Premium Lite | RM12.90 |
| Google Play Pass | RM10.99/mo or RM99/yr |
| Spotify Student | RM9.50 |

Every one uses a `.50`, `.90` or `.99` ending. An original proposal of RM6.70
would have read as an arbitrary number in this market; RM9.90 fits the
convention.

**Competitors.**

| App | Price | Position |
|---|---|---|
| Wallet (BudgetBakers) | ~RM25/month | Best free all-rounder globally, thin MY coverage |
| Spendee | ~RM20/month | Freemium |
| YNAB | ~RM65/month | Subscription-only, US-centric method |
| Finory | Freemium | First bank or e-wallet free, pay for more accounts |
| Money Manager | Free | Manual entry, huge install base |

RM9.90 undercuts every paid competitor while remaining above the low-price
conversion trap.

**Usable copy anchors.** RM67/year is less than four months of Spotify
Individual, and roughly three and a half months of Netflix Mobile.

---

## 3. Annual versus monthly

This is where the original RM6.70 / RM67 pairing failed, and the reasoning is
worth preserving because it is counter-intuitive.

RM67 ÷ RM6.70 = exactly **10x**, meaning an annual subscriber saves only 17%.
The evidence says that is too weak to earn the switch:

- The best-converting annual-to-monthly ratio is **5x to 7x**.
- **59% of users choose annual** when the discount lands in the **30-40%** band.
- Annual subscribers retain at **33.9% after 12 months** against **13.8%** for
  monthly.
- Annual plans reduce churn by roughly **51%**.

Annual is where both retention and cash flow live, so the discount has to be
real. RM9.90 / RM67 gives a **6.8x ratio and a 44% saving**, and the annual plan
works out to **RM5.58/month**, which is cheaper per month than the originally
proposed monthly price. The affordability instinct is preserved precisely where
it matters, on the plan you want people to choose.

**Presentation.** Mojo grew ARPU 60% partly by displaying the monthly
equivalent of an annual plan rather than the annual total. The spec follows
this: "RM67/year, RM5.58/month".

**Weekly plans, rejected.** Weekly subscriptions now generate **55.6%** of
subscription revenue across the market, up from 43.3% two years earlier. This
benchmark is correct and still wrong for Pip. A weekly charge on a *budgeting*
app is tonally indefensible, since the product exists to stop people being
nickel-and-dimed, and weekly billing reads as predatory to store reviewers.

---

## 4. Unit economics

**AI scan cost.** Gemini 3.1 Flash Lite is priced at **$0.25 per million input
tokens** and **$1.50 per million output**, with an image counting as roughly
**1,120 tokens**. A scan of about 3,100 input tokens (image plus the prompt in
`src/llm/extractPrompt.ts`) and 500 output tokens costs approximately
**$0.0015, or RM0.007**.

| Monthly scans | Approximate cost |
|---|---|
| 20 (free cap) | RM0.14 |
| 100 | RM0.70 |
| 300 | RM2.10 |

Against RM8.42 net monthly revenue after Play's 15%, gross margin exceeds 90%
even for heavy users. **AI cost does not constrain pricing**, which is why the
scan cap is set for conversion pressure rather than cost recovery.

**Live price data costs nothing.** `src/prices/` uses only free unauthenticated
endpoints: Yahoo Finance, `open.er-api.com`, and a jsdelivr currency-api mirror.
No API key exists in that directory. This is the evidence behind the decision
not to gate live prices.

**Play service fee.** Subscriptions carry a **10% service fee plus a 5% billing
fee**, giving an effective **15%**. The 10% subscription rate was announced for
the US, UK and EEA following the Epic settlement; the traditional Small Business
Program rate of 15% on the first $1M applies more broadly. **15% is the correct
planning number for Malaysia.** This corrects
`monetization-and-marketing-plan.md` §1.4, which cites a flat 10% and omits the
billing fee.

---

## 5. Paywall design findings

Elements that consistently earn their place:

- **Fits one screen without scrolling.** The most frequently cited audit item.
- **Free versus Pro comparison table.** Now table stakes across categories, not
  a differentiator.
- **Annual pre-selected** when a trial is available. Standard among top apps.
- **Trial on annual only.** The 2026 pattern; removing trials from monthly plans
  avoids acquiring low-value subscribers.
- **Post-dismissal offer.** A time-limited follow-up shown *only* to
  non-converters adds **10-15% ARPU**.
- **Social proof placed before the paywall**, on a loading or transition screen,
  reduces trust friction at a high-attention moment.

Onboarding placement drove roughly **50% of trial starts** in one documented
case, consistent with the day-zero finding in §1.

**Gating ratio.** A commonly cited heuristic is 10-70-20: about 10% of features
free, 70% gated, 20% reserved for power users. Pip deliberately ignores this.
The free tier is a complete tracker because the product competes against free
alternatives and because a generous free tier is what earns the word-of-mouth
the launch depends on.

---

## 6. Behavioural models applied

Drawn from the `marketing-psychology` skill, filtered to those that actually
apply.

| Model | Application in Pip |
|---|---|
| **Loss aversion** | The scan counter. Watching 20 become 6 does more work than any banner, because losses hurt roughly twice as much as equivalent gains feel good. Already the strongest lever available. |
| **Endowment effect** | The 14-day trial. Once a user has had Pro, losing it is a loss rather than a foregone gain. |
| **Mental accounting** | RM67/year always rendered as RM5.58/month. Identical money, different frame. |
| **Default effect** | Annual pre-selected. People accept pre-selected options. |
| **Goal-gradient** | The scan counter is visible, not buried in settings, so progress toward the limit is felt. |
| **Price relativity** | The RM199 lifetime anchors RM67/year as the sensible middle option. |
| **Paradox of choice** | Three visible options maximum. Lifetime appears as a secondary line, not a fourth equal-weight card. |
| **Peak-end rule** | Contextual prompts fire at success moments (first successful scan, 7-day streak), not at random intervals. |
| **IKEA effect** | Widget and mascot customization raises switching cost; a user who has tuned their widget has sunk personalization into the app. |
| **Zero-price effect** | The free tier stays a complete product, because "free" is psychologically distinct from "cheap". |

**Where psychology argues against a tactic.** A permanent dashboard upgrade
banner would add surface area, but it contradicts the payoff the product
narrative promises in `business-plan.md` §6: clarity without a lecture, and not
feeling judged by a spreadsheet. The mascot is used as the ambient upsell
channel instead, which converts an advert into content and is structurally
uncopyable by competitors without a character.

---

## 7. Shipaton 2026 context

Relevant because it constrains the launch, not the pricing.

- Runs 1 August to 30 September 2026, judged 1-13 October, winners 21 October.
- Only apps whose **first public store release** falls inside that window
  qualify. Updates to already-released apps are excluded.
- Purchases must be powered by the RevenueCat SDK.
- The app must offer a free trial, or ship a promo code letting judges unlock
  premium features.
- Grand Prize criteria include "Early and Effective Release" and "Growth by
  numbers", so shipping sooner is itself scored.
- Beyond the Grand Prize, Pip fits **Keep Them Coming Back** ($25k, retention
  mechanics: streaks, notifications, widget), **Most Viral** ($15k), and the
  **Design Award** ($20k).

---

## 8. Sources

- [RevenueCat, State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps)
- [RevenueCat, subscription app trends and benchmarks 2026](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- [RevenueCat, subscription pricing psychology](https://www.revenuecat.com/blog/growth/subscription-pricing-psychology-how-to-influence-purchasing-decisions)
- [Adapty, what a high-performing paywall looks like in 2026](https://adapty.io/blog/high-performing-paywall-2026/)
- [Adapty, how to design a paywall for a mobile app](https://adapty.io/blog/how-to-design-a-paywall-for-a-mobile-app/)
- [AppAgent, five paywall optimization strategies](https://appagent.com/blog/mobile-app-onboarding-5-paywall-optimization-strategies/)
- [Apphud, pricing psychology for subscription apps](https://apphud.com/blog/subscription-pricing-psychology)
- [Foundry, annual versus monthly subscriptions](https://www.builtbyfoundry.io/blog/annual-vs-monthly-subscriptions-creator-apps)
- [SmartCalc MY, best budgeting apps Malaysia 2026](https://www.smrtcalc.com/guides/best-budgeting-apps-malaysia)
- [SoyaCincau, Spotify Premium Malaysia pricing](https://soyacincau.com/2025/08/06/spotify-premium-malaysia-subscription-price-august-2025/)
- [SoyaCincau, YouTube Premium Lite Malaysia](https://soyacincau.com/2026/05/04/youtube-premium-lite-available-malaysia-rm12-90-price-features-limitations/)
- [The Star, Google Play Pass Malaysia pricing](https://www.thestar.com.my/tech/tech-news/2023/08/23/google-play-pass-appears-to-now-be-available-in-malaysia-priced-at-rm1099-a-month-and-rm99-a-year)
- [PricePerToken, Gemini 3.1 Flash Lite pricing](https://pricepertoken.com/pricing-page/model/google-gemini-3.1-flash-lite)
- [PricePush, Google Play subscription fees 2026](https://pricepush.app/blog/google-play-subscription-fees-2026-real-math)
- [RevenueCat, the 15% app store fee guide](https://www.revenuecat.com/blog/engineering/small-business-program)
- [RevenueCat Shipaton 2026 official rules](https://revenuecat-shipaton-2026.devpost.com/rules)
- [Shipaton 2026 FAQ](https://www.shipaton.com/faq)
