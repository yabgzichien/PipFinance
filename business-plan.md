# Pip: business & positioning plan

Internal strategy document. Written for the founder to think from, not to paste into a store listing. Produced via a `/grill-me` interview, so most claims below were pressure-tested against a competitor or a real constraint in the codebase before being accepted, not just brainstormed.

Scope: this covers identity, audience, differentiator, brand voice, business model, and storyline for **Pip**, the standalone tracker shipping to Google Play on the `release/play-store` branch. It does not cover the lending/credit side of the original project (`Pip Credit`), which is being removed entirely and is out of scope here by design.

---

## 1. One-line identity

**Pip.** Tagline: **"Know your money."**

Backup lines in the same direction, for later A/B or store-listing use:
- "Stop guessing where it went."
- "Your money, finally making sense."
- "See it before it's gone."

All four are clarity/control-led, not mechanism-led ("AI scans your receipts") or privacy-led ("never leaves your phone"). Those become supporting lines, not the headline — see §3.

Name itself is not up for debate: `app.json` and the Android package (`com.yabg.pipexpensestracker`) are already Pip-branded, and the mascot (coin-sprout character, `src/components/Pip.tsx`) carries continuity from the pre-pivot product. The work here is entirely on what "Pip" *means* to a new user, not what it's called.

---

## 2. Who it's for

**Launch beachhead: the financially anxious young Malaysian professional.**

Not "gig workers" (the app's original persona, still visible in category design comments, but explicitly not the launch message) and not "all Malaysians" (the eventual ambition, but too broad to be a first message). Specifically: someone with a real income who still doesn't know where it goes, because it's death by a thousand cuts, not one big problem.

A day in their financial life, roughly:
- Three or four subscriptions they forgot they're paying for.
- A BNPL installment or two, each individually small enough to not think about.
- Splitting a meal or a Grab ride with friends, and either eating the cost or awkwardly chasing it later.
- Checking their bank balance the way you check a wound: reluctantly, and only when it's bad.

This person doesn't need to be taught what a budget is. They need the friction of *starting* to track removed, and something that tells them the truth without being a spreadsheet or a lecture.

Long-term, the product should work for any Malaysian who wants a tracker that understands local banking apps and local spending benchmarks — the beachhead is a wedge, not a ceiling.

---

## 3. The differentiator

**Not this:** "Pip uses AI to read your receipts." A Malaysian competitor referenced in [SmartCalc's 2026 roundup](https://www.smrtcalc.com/guides/best-budgeting-apps-malaysia) already does AI receipt-photo scanning and cash-flow forecasting. Leading with "AI reads receipts" puts Pip in a feature race it didn't start first.

**This instead — the twin pillar:**

1. **Screenshot the apps you already live in.** Not a paper receipt, not a PDF bank statement export — a screenshot of Maybank, Touch 'n Go eWallet, GrabPay, or whatever's already open on your phone. Pip reads it and **remembers your merchants**, so categorization gets faster the more you use it. The mechanism competitors would have to copy isn't "add AI," it's "stop asking for a cleaner input than a screenshot."
2. **It never leaves your phone.** No account required, local SQLite storage on device. [Finory](https://www.finory.app/), a real Malaysian competitor, already markets hard on "no bank login credentials" — but only for credit cards. Pip can make the same privacy claim across the *entire* financial picture: spending, net worth, bills, splits.

Together: *fast in* (screenshot, not typing) and *safe in* (never leaves the device). Everything else Pip does is real, but secondary:

| Supporting feature | Why it reinforces, not replaces, the headline |
|---|---|
| Tax relief receipt tracking | Tracks eligible categories as you spend with cap validation and receipt photo archiving so tax season is hassle-free. |
| Net worth / assets & liabilities | "Financial freedom" framing beyond monthly spend — the fuller picture, not just a ledger. |
| Split bills + Owed screen | Solves the "who owes who" friction directly named in §2's day-in-the-life. |
| Recurring Commitments (bills + DCA) | One list for "what's already spoken for this month," which is exactly what the anxious-professional persona lacks visibility into. |
| Savings-streak habit widget | Turns "pay yourself first" into a habit loop, which connects directly to §4. |

**Do not lead marketing copy with the feature list.** It's real, it's a legitimate moat versus a copycat, but "we have 8 features" is not a reason to download an app. "Know your money, without typing it in, without anyone else seeing it" is.

---

## 4. Pip's personality

This is a genuine strategic addition from this interview, not a tone note — treat it as a retention and virality lever in its own right, on par with the product mechanism.

**Precedent, both real:**
- [Cleo](https://www.gventures.co/post/meet-cleo-the-ai-finance-app-that-captivated-gen-z) — a finance app, same category as Pip — built its growth on a "Roast Mode" persona. Roast Mode alone has been shared 500,000+ times on social media. This is not a hypothetical; a finance app with attitude is a proven category, not a risky experiment.
- [Duolingo's owl](https://www.marketingmag.com.au/news/duolingo-gets-massive-tiktok-following-thanks-to-passive-aggressive-owl/) — passive-aggressive, guilt-driven notification copy, varied so it doesn't go stale — is credited as a real driver of a 41% DAU/MAU ratio, and became a free marketing channel purely through memes of its own notifications.

**Pip's version: passive-aggressive, funny, occasionally in brainrot/internet-slang register.** The persona shows up in three surfaces: push notifications, the Android home-screen widget, and in-app empty/milestone states.

Draft lines (starting point for Stage 2 copywriting, not final strings; no em dashes anywhere, per house style):

*Straight passive-aggressive (Duolingo register):*
- Nudge after inactivity: "It's been 4 days. Your wallet is judging you. So is Pip."
- Streak about to break: "Your streak dies tonight. Pip is not okay with this."
- Widget, nothing logged today: "Nothing logged today. Pip is watching."
- Bill reminder: "Your electricity bill is due tomorrow. Pip already knows you'll pay it late."

*Brainrot/slang register (dosed heavier in notifications and widget, lighter inside core screens):*
- After a big impulse buy: "RM120 on bubble tea this week. Bestie, it's giving liquidity crisis."
- Good savings month: "You actually saved this month. Ok that's kind of goated ngl."
- Streak milestone: "7-day streak. Pip's aura is at an all-time high. Yours is debatable."
- Ignoring the app for a week: "You said 'I'll log it later' and never did. Certified L moment."
- Empty state, first open: "No transactions yet. Pip is so unemployed right now."

**A caveat worth stating plainly, since brand-voice decisions like this are easy to over-commit to:** slang has a short half-life and a brand trying too hard to sound current is a well-known way to become the joke instead of the joker. Two guardrails:
- **Dose it, don't drench it.** Slang belongs in the high-visibility, low-frequency surfaces (notifications, widget, milestone moments) where being *seen* matters. Core transactional UI (categorizing a transaction, checking net worth) should stay in the plainer passive-aggressive register — a joke every time you check your bank balance gets old fast.
- **Let Pip be self-aware about it**, the way Duolingo's owl is in on its own meme rather than pretending to be a serious mascot doing a bit. A line like *"Pip has been reading too much TikTok, RM45 on iced coffee this week"* self-deprecates the slang instead of just performing it, which ages better and is harder to cringe at.

Whoever does the actual copywriting pass (Stage 2, per `plan.md`) should treat the lines above as calibration examples, not a final voice guide.

---

## 5. Business model

**Free at launch.** No account required, no backend for the tracker itself, matches the existing "no cloud" privacy pillar directly — there's nothing to charge for yet that wouldn't contradict the pitch.

**Freemium, later, deliberately undecided.** What the paid tier unlocks is genuinely TBD — this is a real deferral, not an oversight, and shouldn't be forced into this document prematurely.

**One concrete constraint that does need to be decided before launch copy is written:** the AI-scan free tier should assume a **reasonable monthly cap**, not "unlimited." The Groq/Gemini API key powering receipt/screenshot extraction is currently embedded client-side and extractable (flagged, deferred in `handoff.md`) — with no rate limiting, "unlimited free AI scans" as a marketing line is a live cost and abuse liability, not just an aspirational feature. This doesn't need solving now, but the business plan should not promise something the current architecture can't safely back. Exact number (50/month? 100/month?) is an open number for Stage 2, not resolved here.

---

## 6. The storyline

**Problem-first. No origin story.** Pip's history as half of a lending-competition project (`Pip Credit`, MAIC Nexus 2026) does not appear in user-facing narrative anywhere — not the store listing, not onboarding, not marketing copy. This was an explicit call: the target user doesn't care about a hackathon pivot, they care about their own money.

The narrative arc, in order:

1. **The pain.** Tracking money by hand is tedious enough that almost nobody actually does it consistently. The apps that exist are built for someone else — a US salary, a UK bank, a neat monthly paycheck — not a Malaysian juggling e-wallets, BNPL, and splitting bills with friends.
2. **The mechanism.** Screenshot what you already have open. Pip reads it, remembers it, and never sends it anywhere.
3. **The payoff.** Clarity, without a lecture. Not a stern dashboard with red numbers and jargon. A mascot with a personality who nudges you the way a blunt friend would, not the way a bank statement does. This is where §4's brand voice does real narrative work: the "payoff" isn't just data, it's *not feeling judged by a spreadsheet*.

If a founder-facing story is ever needed later (a pitch to a partner, an investor conversation, a press ask) the hackathon/lending history is still true and still available — it's excluded from *this* narrative specifically because the target user in §2 has no reason to care about it, not because it's hidden.

---

## 7. Competitive landscape

| App | Angle | Gap versus Pip |
|---|---|---|
| Money Manager (Realbyte) | Free, simple, manual entry or CSV import, huge global install base | No AI capture, no Malaysia-specific benchmark, no personality |
| YNAB | Paid ($14.99/mo), zero-based budgeting, live financial-coaching classes | Subscription-only, US-centric methodology, not built for MY banking apps |
| Wallet by BudgetBakers | Best free all-rounder globally, some MY Open Banking support | Generic across every market it serves, thin local-bank coverage in Malaysia specifically |
| "Fin ory"-style local apps | AI receipt-photo scanning, cash-flow forecasting via emailed statements | Already commoditizing "AI reads a receipt" — the exact claim Pip is deliberately not leading with |
| Finory | Privacy-led ("no bank login credentials," local PDF parsing, PDPA-compliant) | Scoped to credit cards only, not a full tracker (spend, net worth, bills, splits) |

Pip's open lane: the only one combining screenshot-of-everyday-apps capture, full-picture tracking (not just cards), a Malaysia-specific spending benchmark, and a brand voice with actual personality.

---

## 8. Open risks / action items surfaced by this exercise

These aren't decisions made in this document — they're gaps this interview surfaced that Stage 2 (or whoever owns Play Store submission) needs to close:

- **No privacy policy exists anywhere in the repo.** Google Play requires one for any app handling financial data. This is a hard submission blocker, independent of every other decision above, and it directly backs (or undermines) the privacy pillar in §3 if it's missing or thin.
- **Free-tier AI scan cap is unresolved** (§5) — a real number needs picking before store copy can honestly say anything about "free scans."
- **Onboarding is currently a Stage 1 stub** (`src/screens/OnboardingScreen.tsx`) with no positioning copy at all — it exists only to compile and route to the tracker, per `plan.md`. Everything in this document (tagline, differentiator, voice) needs to land there eventually.
- **No screenshots exist for the current feature set.** The only screenshots ever in the repo (`credit-score.png`, `passport.png`) were for the deleted lending features. Net Worth, Commitments, and Split Bills — three of the differentiators named in §3 — have no store-listing-ready screenshots yet.
