---
format: 1920x1080
duration: 20.4s
fps: 30
message: "Know your money: Tap Add, Pip reads your screenshot in one pass, and tells you what's left."
arc: Home Dashboard & Add Tap → Single-Pass Scan & Categorize → Privacy & Left to Spend → Brand Lockup
audience: financially anxious young Malaysian professionals
mode: collaborative
music: calm-confident-minimal
---

# Pip — Play Store promo (20.4s)

Runtime grew from 25s to 29.5s at the real-UI pass below: Frame 2 went from one abstract
animation to a literal four-shot walkthrough of the real scan flow, and that content does
not read at 8s. Play's guidance has no hard duration ceiling — only the first 30s
autoplays — so the frame was given the ~13s it actually needs rather than compressed past
legibility. Every other frame kept its original length.

Four frames, two ideas. Governing style is the Apple product film: few subjects, long
holds, scarce colour, one thing moving at a time. The cut deliberately carries **two**
ideas rather than the three a Play Store listing usually shows, because the reference buys
its calm by holding each beat longer.

**The video must read muted.** Play Store listing videos autoplay without sound, so the
captions carry the entire message and the music bed is never load-bearing.

**Accent discipline, revised.** `#1f8a5b` used to appear exactly three times by design: the
Food chip in Frame 2, the Left to Spend figure in Frame 3, the wordmark in Frame 4. Two of
those three were an invented embellishment, not what the app actually shows a user — see
"The real-UI pass" below. `#1f8a5b` now appears once, on the wordmark, which is the only
one of the three that was ever genuinely brand-colour rather than a marketing choice
layered on top of a real screen.

## The real-UI pass

The frames below were originally hand-approximated from the app's design tokens (colours,
fonts, spacing) without checking the actual component source. That produced a video that
was recognisably *Pip-coloured* but not actually *Pip* — an invented dashboard card, an
invented category-chip shape, a screen titled "Categorize" that doesn't exist. Every frame
below was rebuilt against the real screens (`src/screens/DashboardScreen.tsx`,
`src/screens/ImportReviewScreen.tsx`) and the real shared components
(`src/components/ui.tsx`, `Icon.tsx`, `PieChart.tsx`), reading exact colours, radii,
type roles and layout order from source rather than approximating them. Two real findings
changed what the video is allowed to claim visually:

- **The Left to Spend figure is never accent green in the app.** `CashFlowView`'s hero
  color for the `left` panel is plain ink, red only if the figure goes negative. Frame 3's
  number was recoloured from `#1f8a5b` to `#16201b` to match.
- **Category colour lives on the icon badge, never on the row's label text**, and the
  "Learned" indicator is a small floating pill with a sparkle icon on the category badge
  (`ui.tsx`'s `learnedTag`), not a separate badge element sitting in the row.

## The screenshot-grounded pass

A second revision, prompted by two real screenshots of the app in hand (the extraction
result screen and a `CategorizeScreen` confirm), replaced Frame 2 entirely. The brief
changed from "show the category chip resolving" to "show the actual flow happening": tap
Scan, watch it read, see what it found, watch it get sorted. That is a different frame, not
a style pass on the old one — see Frame 2 below for the four-shot structure that replaced
"The lift".

**One substitution from the reference screenshots, deliberate.** The screenshots carried
real data from a personal test account: a real bank ("Maybank") and what read as real
people's names in the transaction list. Neither belongs in commercial creative on a public
store listing — this project's own rule for Frame 1 ("no real bank or e-wallet trademarks")
applies here too, and a real person's name is a harder line than a bank's. The screenshots
were used for **layout, chrome and anatomy only**; every merchant name, amount and account
label in the rebuilt frame comes from this project's existing fictional dataset (Kopi
Halaman, MyRide Trip, and the rest of Frame 1's own transaction list), so the video also
gains a continuity it didn't have before — Frame 2 now reads the exact screenshot Frame 1
just showed you, rather than a different, unrelated one.

## Where the reference stops governing

The Apple product film is the style reference, and it stays the style reference. It is not
the *format* reference, because the two deliverables are not the same thing: a broadcast
spot plays to a captive viewer with sound, and a listing video autoplays muted next to a
scroll. Where those pull apart, the store wins. Three consequences, each of which cost the
cut something it previously had:

1. **Runtime goes to the product, not to cards.** Play's listing guidance asks for roughly
   80% of the video to be the actual experience and warns specifically against spending it
   on title screens. Non-product runtime is only Frame 1's source phone (3.0s, deliberately
   not Pip) plus Frame 4's lockup (3.5s, branding rather than app UI) — 6.5s of 29.5, or
   **~80% product-bearing**, up from 74% before the screenshot-grounded pass. Frame 2's
   "Add transactions" tap-to-scan shot is real `AttachScreen` UI, not a pre-Pip beat, so it
   counts as product like the rest of the frame — see the runtime table below.
2. **No frame is allowed to sit completely dead.** The hold after the number resolves is
   still the emotional beat, but at 0.6s rather than 2.25s. On a muted autoplay tile a
   frozen frame reads as the video having finished.
3. **Text is timed to reading speed, not to the edit.** Every caption is legible at full
   opacity for at least 1.2s, which is what sets the floor on how far a frame can be
   trimmed.

What did **not** change: accent scarcity, one subject moving at a time, long eases, the
single mascot bounce, the flat `#eef1ee` ground, and the absence of any store badge or
install CTA.

---

## Frame 1 — Already open

- scene: A phone floats holding an e-wallet transaction list. A shutter flash. This is the thing you already have.
- duration: 3.0s
- frames: 0–90
- transition_in: cut
- status: animated
- src: compositions/frames/01-already-open.html
- poster: 2.0s
- blueprint: device-surface-showcase (static-tour variant)
- caption: "Screenshot what you already have open." (0.8s–2.95s, full opacity 1.35s–2.65s)
- asset_candidates: source-ewallet-screen, ref-add-screen (copy source only)
- handoff_out: the phone, centred, scale 1.0, opacity 1, stationary at the cut

Cold open on recognition, not on the product. The viewer sees a transaction list that
looks like the app already open on their own phone: RM amounts, local merchant names,
ordinary list chrome. **Generic look-alike, no real bank or e-wallet trademarks** — this
is commercial marketing on a paid store listing.

One beat of stillness first. Nothing moves, nothing has been explained. Then a single
frame of white shutter flash with a small scale punch, and the caption arrives at 0.8s so
the hook lands well inside the three-second window where the viewer decides.

**Trimmed 3.5s → 3.0s.** This frame is the only stretch of the video that shows a screen
that is not Pip, so it is the first place to buy time for the product. It cannot go below
3.0s: the six-word hook needs roughly 1.3s at full opacity to be readable at listing size,
and that floor is what sets the frame length. The second went to Frame 2.

The hook is the *mechanism*, not a benefit and not the brand. Nobody has to be told what
Pip is yet; they have to recognise their own phone.

**Do not** show the Pip UI in this frame. The whole cut depends on the viewer meeting the
problem surface before the product.

## Frame 2 — The scan

- scene: A literal walkthrough of the real flow — tap Scan, watch it read the screenshot, see what it found, watch it sort itself
- duration: 13.0s
- frames: 90–480
- transition_in: cut
- status: animated
- src: compositions/frames/02-the-lift.html
- poster: 8.5s (Found it, items list settled)
- blueprint: four-shot screen-recording simulation, hard cross-fades between shots, no camera move
- caption: "Pip reads it." (4.9s–11.9s) then "It sorts itself." (13.3s–16.05s)
- asset_candidates: source-ewallet-screen, capture-scan-flow (blocks a real recording of every shot below)
- handoff_in: the phone, centred, scale 1.0, opacity 1, stationary
- handoff_out: (crossfades to Frame 3, no phone in Frame 3)

The single most important frame in the video, and the one that has to be believable. It
replaced an earlier abstract concept ("rows fly off the screenshot") once real screenshots
of the app were in hand — see "The screenshot-grounded pass" above for why the concept
changed rather than just its skin.

One phone, stationary at Frame 1's exact handoff pose (centred, 440×880), for the whole
frame — no split-screen, no second phone. Four real screens play inside it, hard-cut shot
to shot:

1. **Tap to scan** (0.0s–1.6s) — `AttachScreen`'s real "Scan" card: dashed drop-target
   border, accent icon tile, the actual sub-copy. A press-pulse on the card sells the tap.
2. **Reading** (1.6s–4.6s) — `ExtractScreen`'s `scanning` phase: the real accent scanline
   sweeping the screenshot preview, "Reading your screenshot…" with the live seconds tick
   the app actually shows.
3. **Found it** (4.6s–9.35s) — `ExtractScreen`'s `result` phase, traced directly from the
   reference screenshot: the PipSays readout ("Got it. 6 transactions…"), the account row,
   the "EXTRACTED ITEMS" list with real letter-avatar initials, a "likely Food" sparkle tag
   on the one merchant Pip already recognises, and the "Sort 6 items" button.
4. **Sort them** (9.35s–13.0s) — `CategorizeScreen`. One full confirm plays in real detail
   (transaction card, split-with-friends row, expense/income toggle, the category grid with
   Food pre-selected and checked) ending on a tap of "Confirm Food". Then five quick
   confirms whip past — counter ticking 2/6 through 6/6, merchant and amount swapping, a
   green check popping each time — the compressed-montage technique a demo video actually
   uses for "and it does this for all of them", not a claim that every tap plays at full
   detail.

All six line items are the ones Frame 1's own screenshot already showed (Kopi Halaman,
MyRide Trip, Bulan Mart, SkyFibre Bill, Nasi Kandar Seri, Warung Pak Din) — the video reads
the exact picture it put on screen a moment earlier, which is a continuity the previous cut
didn't have. Kopi Halaman is the one recognised merchant, carrying the "likely Food" tag in
shot 3 and pre-selected on entry to shot 4's full-detail confirm — the same "Pip remembers
this merchant" proof beat the earlier cut carried on a "Learned" badge, now shown as the
real product behaviour it always was.

Category badges and the selected-chip treatment use the app's real per-category colour
(`catColorsForHue`, the same OKLCH formula `src/lib/oklch.ts` uses at runtime) and do
**not** count against the accent rule.

> **Blocked until captured.** `capture-scan-flow` does not exist yet and needs a
> dev-client build, not Expo Go. This frame is now a much more literal simulation of real
> device footage than the cut it replaced, which raises the ceiling on what a genuine
> screen recording would add here — see Open items.

## Frame 3 — The number, then the promise

- scene: Everything recedes except Left to Spend. The number counts and resolves. Then the privacy claim plays over that same card.
- duration: 10.5s
- frames: 480–795
- transition_in: crossfade
- status: animated
- src: compositions/frames/03-the-number.html
- poster: 5s
- blueprint: dataviz-countup, then serial-clause reveal
- breakdown: divider + donut/category readout fade in at 14.8s–15.3s (traced from the real CashFlowView breakdown row)
- caption: "Know what's left." (15.35s–17.55s)
- belief: "No account." (18.15s) → "No cloud." (19.40s) → "It stays on your phone." (20.50s, holds to the cut)
- asset_candidates: pip-home-rebuild, ref-home-screen (layout truth)
- handoff_in: Pip Home filling frame, scale 1.0, opacity 1, settling
- handoff_out: the number, centred, scale 1.0, opacity 1, still

The payoff, and the reason the cut carries two ideas instead of three.

The camera settles on Pip Home. Every element except the Left to Spend card gives way —
the streak row, the budget list, the nav — until one number owns the frame. It counts up
and resolves in Space Grotesk, the app's real numeric face, **in plain ink, not brand
green** (see "The real-UI pass" above  `CashFlowView`'s `left` panel never colours this
figure green in the app; only a negative balance turns it red). Beneath it, a divider and a
donut-plus-category readout fade in, traced from the same panel's real breakdown row: this
is what actually sits under the number on a phone, not an invented card that stops at the
figure.

Then it is **held alone for 0.6 seconds with nothing moving at all.** That hold is the
emotional beat. It is the moment the video stops selling a mechanism and shows the viewer
the feeling they actually want, which is knowing.

**The hold was 2.25s and is now 0.6s.** This is the single biggest revision to the original
cut, and it is a concession the reference does not have to make. An Apple spot can hold a
resolved frame for two seconds because the viewer is committed and the sound is carrying
the beat. A listing tile autoplays muted beside a scrollable gallery, where two seconds of
a completely static frame is indistinguishable from the video having ended. The hold still
exists, and it still does its job; it just no longer risks the rest of the video to do it.

### The belief beat, moved here from Frame 4

The privacy claim used to be a text-only card at the top of Frame 4. It now plays **over
this card**, as three clauses that occupy the same screen position one after another rather
than three stacked lines or three cuts.

Two reasons, and they are independent:

- **It is a better sell.** A claim made while the product is on screen is evidenced by
  what the viewer is looking at. The same words on an empty ground are just an assertion,
  and a privacy assertion is exactly the kind that needs something under it.
- **It is a better asset.** Text over the real surface counts as product footage; text over
  a blank backdrop is a title card, which is the thing Play's guidance asks you not to
  spend runtime on.

The clauses occupy one position so the eye never travels between them, which is what makes
the sequence legible at listing size with the sound off. This is the **only** place in the
video that uses serial text; the other captions are single held lines, because for a lone
sentence a held line is easier to read than a sequence. Used everywhere it would be a tic.

> **Figures are placeholders until seeded.** The real screenshot currently shows
> `-RM 424.00` against a single record, which reads as broken rather than reassuring. The
> final number must come from a realistic seeded dataset and should land **positive**, not
> overspent — the payoff beat cannot be a red number.

## Frame 4 — Close

- scene: The wordmark, the mascot, the tagline. Nothing else.
- duration: 3.5s
- frames: 780–885
- transition_in: crossfade
- status: animated
- src: compositions/frames/04-close.html
- poster: 2.5s
- blueprint: logo-assemble-lockup
- caption: "Pip · Know your money." (26.3s–29.5s)
- asset_candidates: pip-mascot, app-icon
- handoff_in: the number, centred, scale 1.0, opacity 1, still

**Cut 5.5s → 3.5s.** The privacy line moved to Frame 3 (see above), which leaves this frame
as a pure lockup. That is the intended shape: 3.5s of 29.5 is about as little as a branded
close can run on, and every second above that is runtime the listing would rather spend on
the product.

The lockup: wordmark, one micro-bounce from the Pip mascot, and the tagline. The
mascot bounce is the **only** bounce anywhere in the video, which is what makes it read as
personality rather than decoration.

The brand voice is deliberately **not** deployed here. A passive-aggressive line is a
retention lever inside the app, but a 25-second first impression of a finance app should
close on trust, not on a joke. The personality is what a user meets on day two.

**No "Download on Google Play" badge or in-frame store CTA.** Verify against current Play
Console asset guidance before adding one; store badges in listing assets have historically
been discouraged, and the video already sits on the store page where the install button is.

---

## Video direction

- **One subject moves at a time.** If two things are animating, one of them is wrong.
- **Long eases, 0.9–1.4s.** Nothing bounces except the single mascot beat in Frame 4.
- **Hold before you cut.** Every beat stays on screen after it lands. Frame 2's shots are
  allowed to run longer than the other frames' beats because each one is product behaviour,
  not a caption making a claim. Holds on resolved type or a resolved number elsewhere are
  capped near 0.6s.
- **Every caption gets at least 1.2s at full opacity.** Reading speed, not the edit, sets
  the minimum length of any frame carrying text.
- **Cuts land on the music grid**, but the music can be removed entirely without the video
  stopping making sense.
- **Ground is `#eef1ee` everywhere.** The phone and the type are the only objects in the
  frame; there is no background texture, gradient wash, or decorative geometry anywhere.
- **Captions sit clear of the horizontal extremes**, so a later 9:16 reframe survives.
- **No em dashes in any on-screen copy.**

## Runtime budget

The number that governs the cut. Play's listing guidance asks for roughly 80% of the video
to be the actual app experience and warns against spending runtime on title screens.

| Segment | Time | Counts as |
|---|---|---|
| Frame 1, source phone | 3.0s | not Pip |
| Frame 2, the full scan-to-sort walkthrough | 13.0s | product |
| Frame 3, the number and the promise | 10.5s | product |
| Frame 4, lockup | 3.5s | title card |
| **Product-bearing** | **23.5s of 30.0s nominal** | **~80%** |

Essentially at target, up from 64% at the original cut and 74% after the first real-UI pass.
The gain came from two places at once: the accuracy pass made Frames 2 and 3 true to the
real app, and the screenshot-grounded pass turned Frame 2 from one mechanism shot into four
real screens back to back. **The video is HTML throughout, not device capture.** That is a
different gap than the runtime split — see open item 1.

## Decisions taken at the plan gate

- **Frame 1 shortened 4.5s → 3.5s.** The freed second went to Frame 2, not Frame 3: the
  lift is the proof beat and was tight at 7.0s. Pip's own UI now appears a second sooner,
  which was the point of the change. Total holds at exactly 25.0s.
- **Sketches before motion.** Layouts get confirmed on the board before anything is
  animated.
- **Figures come from a seeded dataset**, authored at `data/seed.json` in this project so
  the HTML rebuild and the device capture show the same numbers.
- **Music from the HeyGen library**, subject to the Content ID constraint.

## Decisions taken at the listing-conformance pass

Applied after researching how Apple and Samsung actually build spots, and what Play's own
preview-asset guidance requires. Where the two disagreed, the store won. Total holds at
exactly 25.0s.

- **Frame 1: 3.5s → 3.0s.** Least product-bearing frame, trimmed to the reading floor.
- **Frame 2: 7.5s → 8.0s.** The freed second went entirely to the badge dwell.
- **Frame 3: 8.5s → 10.5s.** Absorbed the belief beat; the dead hold went 2.25s → 0.6s.
- **Frame 4: 5.5s → 3.5s.** Reduced to a pure lockup once the privacy line moved out.
- **Serial-clause text introduced, once.** Only for the belief beat in Frame 3.
- **Structure now reads hook → proof → payoff → belief → brand**, which is the shape the
  research found underneath both references' short-form work, rather than hook → proof →
  payoff → card.

## Decisions taken at the screenshot-grounded pass

Applied after two real screenshots of the app (an `ExtractScreen` result and a
`CategorizeScreen` confirm) made clear that Frame 2's abstract "rows fly and resolve"
concept, however accurately coloured, was not what the app actually does. Total now holds
at exactly 29.5s.

- **Frame 2 replaced, not restyled: 8.0s → 13.0s.** Four real shots (tap Scan, reading,
  found it, sort them) instead of one abstract animation. Runtime grew because the content
  is real and does not compress past legibility, not because the frame needed padding.
- **Total video: 25s → 29.5s**, by explicit choice (see the runtime-question note at the
  top of this document) rather than by drift — Play has no hard duration ceiling, and every
  added second went to showing more of the real product.
- **Reference-screenshot data was not used verbatim.** Real bank name and what read as real
  people's names were swapped for this project's own fictional dataset; see "The
  screenshot-grounded pass" above.
- **The "Learned" proof beat moved from an isolated badge to the real product moment it was
  standing in for**: a recognised merchant (Kopi Halaman) carrying a "likely Food" tag in
  the extracted-items list, then arriving pre-selected in the categorize confirm.
- **The Pip mascot face was added to the small avatar circle** in each of Frame 2's PipSays
  bubbles, traced from the same geometry Frame 4's lockup already used. It was rendering as
  a blank tinted circle before this pass.

## Open items

1. **`capture-scan-flow` not yet recorded** (dev-client build required). Frame 2 is now a
   much more literal simulation of the real flow than the cut it replaced, which raises the
   ceiling on what a genuine screen recording would add — the runtime split already reads
   as ~80% product-bearing on paper, but the video is HTML throughout, not device capture.
2. Poster/feature graphic (1024×500) not yet authored. It has to carry the value on its own
   for viewers who never play the video.
3. A 9:16 cut remains deferred. Play supports portrait and the scene structure survives a
   reframe by design.
