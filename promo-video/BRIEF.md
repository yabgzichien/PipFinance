---
workflow: product-launch-video
flow: automation
storyboard: yes
message: "Screenshot what you already have open, and Pip tells you what's left"
angle: mechanism-first
destination: play-store
aspect: 16:9
resolution: 1920x1080
fps: 30
length: 30.0s
language: en
audience: financially anxious young Malaysian professionals
vo_mode: none
capture: no-capture
---

# Pip — Play Store promo video

## Intent

**Chosen concept: "The screenshot that logs itself," with a single-number close.**

A phone floats on a seamless backdrop holding a transaction list from an e-wallet the
viewer already uses. A shutter flash. The rows physically lift off that screenshot, sort
themselves into categories mid-air, and land inside Pip. The camera settles on the one
number that actually matters, "Left to Spend," and holds it in silence. Close on the
privacy line and the wordmark.

Executed with **Apple product-film restraint**: few subjects, long holds, scarce colour,
one thing moving at a time. This is the user's explicit reference and it governs every
later decision. It is also why the cut carries **two ideas, not three** — Play Store
convention suggests two or three features, but the reference buys its calm by showing
fewer things and holding each longer.

The sell-or-show answer is **sell**: this is a promo, not a site tour.

## Message

Pip logs your spending from a screenshot you already have, and tells you what's left.

Both halves of the positioning's twin pillar appear:

- **Fast in** — the spine of the video (Scenes A and B).
- **Safe in** — carried by one caption at the close rather than a scene of its own.

## Positioning constraints (from docs/business-plan.md)

These were settled before this video existed and are not up for relitigation here.

- Tagline is **"Know your money."**
- Do **not** lead with "AI reads your receipts." A Malaysian competitor already owns that
  framing and leading with it enters a feature race Pip did not start first.
- Do **not** lead with the feature list. "We have 8 features" is not a reason to download
  an app.
- Pip's passive-aggressive personality is a real retention lever, but it is **dosed, not
  drenched**. It earns one line at the close and nothing more in this cut.
- Beachhead audience is the financially anxious young Malaysian professional, so amounts
  are RM and merchants read as local.

## Scenes

Authoritative timings live in `STORYBOARD.md`, which is kept in sync with the composition.
This table is the shape, not the clock.

| # | Frames | Time | Beat |
|---|---|---|---|
| A | 0–90 | 0.0–3.0s | **Already open.** Phone floats holding a generic Malaysian e-wallet transaction list. One beat of stillness, then a single-frame shutter flash with a subtle scale punch. |
| B | 90–480 | 3.0–16.0s | **The scan.** A literal four-shot walkthrough of the real flow in one stationary phone: tap the real "Scan" card, watch the real scanline read the screenshot, see the real "Found it" extracted-items list, then watch `CategorizeScreen` sort one transaction in full detail before a fast whip through the rest. |
| C | 480–795 | 16.0–26.5s | **The number, then the promise.** Everything recedes except the Left to Spend card. The number counts up and resolves. Then the privacy claim plays as three clauses over that same card. |
| D | 780–885 | 26.0–29.5s | **Close.** Wordmark, one mascot micro-bounce, tagline. Nothing else. |

## Captions

The video must work muted — Play Store listing videos autoplay without sound, so type
carries the entire message and the music bed is never load-bearing.

1. `0.8–2.95s` — Screenshot what you already have open.
2. `4.9–11.9s` — Pip reads it.
3. `13.3–16.05s` — It sorts itself.
4. `20.35–22.55s` — Know what's left.
5. `23.15s` — No account. → `24.40s` — No cloud. → `25.50s` — It stays on your phone.
6. `26.3–29.5s` — **Pip** · Know your money.

Caption 5 is the one place the video uses serial text: three clauses in a single screen
position, one after another, over Pip's own card rather than over a blank ground. Every
other caption is a single held line, and each is legible at full opacity for at least 1.2s.
Frame 2 now carries two captions instead of one, matching its richer four-shot content —
still one idea at a time, just two ideas across a longer frame.

Caption 1 is lifted near-verbatim from the app's own Add screen copy ("Screenshot the app
you already have open and I'll read it"), so the ad and the product speak in one voice.

## Assets

- **App footage: hybrid, and now traced from real component source, not just tokens.**
  Real device capture for the extract-to-categorize proof moment, including the "Learned"
  tag on a remembered merchant, is still the open item (see Open items). Until captured,
  the HTML rebuild is read directly from `src/screens/DashboardScreen.tsx`,
  `ImportReviewScreen.tsx`, and `src/components/ui.tsx` / `Icon.tsx` /
  `PieChart.tsx` — exact colours, radii, type roles, icon glyphs and layout order, not an
  approximation from `theme.ts` alone. See `STORYBOARD.md` § "The real-UI pass".
- **Source screen: generic look-alike.** A plausible Malaysian e-wallet transaction list,
  RM amounts, local-sounding merchants, neutral branding. **No real bank or e-wallet
  trademarks** — this is commercial marketing on a paid store listing. This one screen is
  deliberately NOT Pip's UI and is exempt from the real-UI pass by design.
- **Mascot** from `src/components/Pip.tsx` / `assets/icon.png`.
- **Fonts** Hanken Grotesk + Space Grotesk, frozen locally. Never fetched at render time.
- **Music** one bed, must be Content ID clean (see Compliance).

## Customizations

- Apple product-film restraint as the governing style.
- Accent `#1f8a5b` appears **once**, on the wordmark. It used to appear three times (also
  the category chip resolve and the Left to Spend number), but two of those three were a
  marketing embellishment the real app does not do — see `STORYBOARD.md` § "The real-UI
  pass" for what changed and why.
- Design spec authored from `src/theme.ts` **and the real component source**
  (`ui.tsx`, screen files) rather than tokens alone, so the video and the app cannot drift
  apart visually.

## Compliance — Google Play Console

Verified against the official Play Console preview-assets help page. These are gates on
the finished asset, not style notes.

- **No minimum or maximum duration is mandated.** The widely repeated "30 seconds to 2
  minutes" is a *recommendation*. Only the first 30 seconds autoplays, so a 25s cut plays
  in full inside the autoplay window.
- Clean YouTube **video** URL. No playlist, no channel link, no shortened link, no extra
  parameters such as timecodes.
- Visibility **public or unlisted**, never private. **Embedding enabled.** Not
  age-restricted.
- **Monetization off.** Critically: if the video carries copyrighted material with an
  existing Content ID claim, disabling monetization is *not* sufficient and the content
  must be replaced. This makes the music bed a compliance decision, not a taste one.
- Captions recommended for accessibility. The cut already reads muted by design.

## Notes

- The scan flow needs a **dev-client build**, not Expo Go:
  `react-native-document-scanner-plugin` is a native module Expo Go does not compile in,
  and the app degrades to the plain picker without it.
- Seed a realistic dataset before capturing. Current dev screenshots show a single
  RM 424.00 record, which will not sell the Categorize screen or a believable Left to
  Spend figure.
- **Deferred, not in scope:** a 9:16 cut. Play Console supports portrait and it would also
  serve Shorts/TikTok. Keep captions out of the horizontal extremes so the scene structure
  survives a later reframe.
