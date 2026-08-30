# Pip: monetization & marketing plan (no-budget launch)

Companion to `business-plan.md`. That document deliberately left the paid tier and the AI-scan cap undecided. This one closes both gaps, plus adds the marketing plan for launch. Written from a founder Q&A: stage is pre-launch, no fixed opinion on pricing model or payment rails going in, and all four content formats (short video, written/community, long-form/SEO, visual/static) are on the table for self-produced marketing.

---

## Part 1: When and how to charge

### 1.1 What "reaching the limit" actually means

The shared keys in `tools/limitDashboard` are on **free API tiers** right now: Gemini's free quota is 15 requests/min and 1,500 requests/day, Groq has its own RPM/TPM ceiling. Those are request-rate ceilings, not spend ceilings. The real cost of running the same calls on a **paid** tier is small:

- Gemini 2.5 Flash: $0.30 per million input tokens, $2.50 per million output tokens.
- Groq Llama 3.2 11B Vision: $0.18 per million input tokens (the 90B variant runs up to $0.90/M).

A single screenshot/receipt scan is roughly 1,500-2,000 input tokens (image + prompt) and 300-500 output tokens (the extracted JSON). That prices out to **roughly $0.001-0.005 per scan**. Even a heavy user doing 100 scans a month costs somewhere between 10 sen and 50 sen in API spend, not ringgit.

The practical takeaway: hitting the shared free-tier RPD/RPM ceiling will happen long before API *cost* becomes a real problem. So the trigger isn't "I'm worried about the bill", it's "the free tier can't carry every user's requests anymore, and I need a paid/metered key as overflow."

### 1.2 The trigger point

Use `npm run limits:watch` as the actual signal, not a guess. Concrete rule: **if the dashboard shows sustained utilization above ~70% of the shared free-tier daily quota over a rolling 7-day window, or repeated `rate_limited` status on the primary key**, that's the moment to:

1. Add a paid/metered key as the overflow tier (cheap, per §1.1).
2. Flip on the free-tier scan cap and the Pro option at the same time, since hitting that ceiling organically means there are enough users to justify monetizing anyway.

Don't wait until the free tier is fully exhausted to start charging. Ship the cap and Pro tier *before* that point so existing users don't get hit with a surprise limit mid-use.

### 1.3 Recommended model: freemium + optional top-up credits

**Free, forever, no cap:** manual entry, budgeting, net worth, tax-relief tracking, bill split, every core screen. This isn't negotiable, it's the same "free to use, no account required" pitch already in the store description, and a generous free tier is what earns word-of-mouth before anyone's asked to pay a cent (zero-price effect, mere exposure).

**Free AI-scan cap:** 40 scans/month. A screenshot batch usually captures several line items at once, and Adaptive Merchant Memory means repeat merchants need fewer re-scans over time, so 40/month covers the median user without friction while keeping the cap meaningful for the top few percent who'd otherwise run the shared key dry.

**Pip Pro subscription:**
- RM9.90/month, or RM79/year (~33% off, works out to RM6.58/month)
- Unlocks: unlimited AI scans, a dedicated key so Pro scans skip the shared-tier queue entirely (a real perceived benefit, not a fake one), scheduled/automatic report exports, a multi-device backup bundle, and a cosmetic slider for Pip's roast intensity.

**One-off credit top-ups (no subscription):**
- RM4.90 for +100 scans, no expiry, sold as a Play Billing consumable.
- Captures the user who blew through the free cap once this month but doesn't want a recurring charge. It's also a low-commitment stepping stone toward Pro later (foot-in-the-door).

This mirrors what comparable apps already do (Cleo runs free + three paid tiers, from $5.99 to $14.99/month) but priced for the Malaysian beachhead audience in §2 of `business-plan.md`, not a US wallet.

### 1.4 Payment rails

Use **Google Play Billing**, not an external/web checkout. Two reasons:

1. Google requires Play Billing for digital goods and subscriptions purchased inside an Android app; routing around it risks the app getting pulled, which is a far bigger cost than any fee percentage.
2. As of the 2026 fee restructuring, small businesses earning under $1M/year pay a flat **10% service fee**, and that rate now applies "regardless of billing method." There's no longer a real fee incentive to fight Play Billing on a fee basis, only a policy-risk reason to stay inside it.

The part worth designing around: Play Billing entitlements are tied to the Google Play account already signed into the device, and can be verified locally through the Play Billing Library, then cached as a flag in the existing local SQLite database. **No new backend, no Pip account, no login, for anyone, ever.** That means the entire "no account, 100% on-device" pillar in `business-plan.md` §3 survives monetization completely intact, and it's a genuinely good line for the eventual paywall/store copy: *"Go Pro. Still no account."*

### 1.5 Psychology notes for the pricing screen itself

- **Anchoring**: show the annual plan first and larger; the monthly price then reads as the "expensive" option by contrast.
- **Paradox of choice**: three options only (Free / Pro Monthly / Pro Annual). Don't add a fourth tier.
- **Mental accounting**: frame RM9.90/month as "33 sen a day", smaller numbers feel cheaper even at identical cost.
- **Loss aversion, in Pip's own voice**: the paywall moment should read like Pip, not like a generic app upsell, e.g. leaning on streak/data-loss framing rather than "Upgrade now."
- **Contrast effect**: keep the top-up credit price such that Pro is obviously better value per scan once someone buys it twice in a month (RM4.90/100 scans vs. unlimited for RM9.90 makes the subscription the "rational" choice by comparison).

---

## Part 2: Marketing plan (RM0 budget, solo-produced)

Constraints taken as given: one founder, zero paid spend, Android/Play Store launch, Malaysia beachhead audience from `business-plan.md` §2. All four content formats (short video, written/community, long-form/SEO, visual/static) are usable, so the plan below leans on repurposing one piece of source content into all four rather than treating them as separate workstreams.

### 2.1 Phase 1: pre-launch (before the first install)

- **Build in public** on X/Threads: document the build itself, the "screenshot it, Pip reads it" mechanism, and the mascot's personality, before the app is even live. Costs nothing, compounds an audience ahead of day one.
- **Waitlist page with a referral mechanic**: "bring 2 friends, skip the line." Zero infrastructure needed beyond a static page. Leans on commitment & consistency (signing up is a small first commitment) and mimetic desire (a waitlist implies other people already want in).
- **Pre-record 5-10 short demo clips** of the screenshot-to-transaction flow so launch day isn't a cold start for content.

### 2.2 Phase 2: launch week

- **Product Hunt**: launch day, founder actively answering every comment. Line up early testers/friends to genuinely check it out and engage at launch, real engagement, not manufactured votes.
- **Reddit**: r/malaysia, r/MalaysianPF, r/personalfinance, r/androidapps. Post as a founder story ("I built this because X"), not an ad, Reddit punishes overt self-promotion and rewards transparency.
- **Local Malaysian tech/startup communities** (Discord/Telegram/Facebook groups for MY founders and Android users): direct, free, and already primed for local-market products.

### 2.3 Phase 3: the ongoing content flywheel

This is where the four approved formats live long-term, built as one source recording repurposed four ways, not four separate workstreams:

- **Short-form video** (TikTok/Reels/Shorts): Pip mascot as the on-screen character, in the same territory as Cleo's Roast Mode and Duolingo's owl already referenced in `business-plan.md` §4, both proven, not hypothetical, in this exact category. Formats: "Pip roasts your spending" using real (anonymized, user-submitted) screenshots, relatable Malaysian money memes (BNPL creep, Touch 'n Go top-up rituals, payday countdowns), and a 15-30 second screen-recording of the screenshot-to-categorized-transaction flow, showing the mechanism instead of describing it.
- **Written/community posts**: a recurring presence, not a one-off promo drop, in r/MalaysianPF and similar. Answer real questions with real advice, mention Pip only where it's actually relevant. Threads on X around Malaysian money topics (budgeting breakdowns, tax relief deadlines), timed to real calendar moments (tax season, year-end bonus, Raya spending).
- **Long-form/SEO**: target specific, low-competition Malaysian queries a global finance app has no reason to write for: "tax relief checklist 2026", "how to split a bill with SST and service charge", "best free budgeting app Malaysia no bank login." A solo founder can realistically rank for hyper-local long-tail terms that Money Manager, YNAB, and Wallet never target.
- **Visual/static**: turn the app's existing PDF/HTML export feature into shareable Instagram carousels ("here's what your spending breakdown could look like"), before/after net worth snapshots, and meme templates built around the Pip mascot for cross-posting into X and Facebook groups.

### 2.4 The built-in viral loop (product-led, already in the feature set)

Bill splitting plus the Owed dashboard is a natural k-factor mechanic: when someone splits a bill in Pip, the friends who owe them see it in whatever they share the settlement through (WhatsApp, etc.), whether or not they have the app yet. Make sure that shared settlement message carries a small "tracked with Pip" watermark or link. This needs a UX/copy tweak to an existing share action, not a new feature or any spend, and turns every split bill into a possible install.

### 2.5 A cadence that survives being solo

- 3x short video/week
- 2-3x Reddit/community engagement/week (engaging with others' threads counts, not just posting your own)
- 1 long-form piece every 2 weeks
- 2-3 visual posts/week, repurposed from the same week's video/long-form source rather than created from scratch

### 2.6 What to measure

No ad spend means no CAC to track. Instead: installs/week, Day-7 retention, and the AI-scan-to-free-cap ratio across the user base (this doubles as the monetization-readiness signal from §1.2). Play Console's default acquisition report is free and enough to see which channel each install's first open came from, no extra tooling needed.

### 2.7 Calendar hooks worth planning content around

Malaysian tax filing season (Jan-Apr, LHDN deadline April 30) is a natural, recurring, free-PR moment for the tax-relief-tracking feature specifically, worth a dedicated content push each year rather than treating tax content as evergreen filler.
