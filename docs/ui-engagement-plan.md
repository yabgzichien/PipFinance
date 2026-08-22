# Pip: UI engagement plan

Internal design document. Third in the set:

| Document | Question it answers |
|---|---|
| `business-plan.md` | What does Pip mean, and to whom? |
| `docs/ui-design-plan.md` | What does Pip look like, and what does it show first? |
| **this file** | What makes a user *want* to come back, and how do we build that without lying to them? |

`ui-design-plan.md` fixed legibility: one hero, five type sizes, six spacing values, a build check
that stops the 31st font size. It made Pip readable. Readable is table stakes. This document is
about the part that is not table stakes: whether opening Pip feels like anything.

Method: literature and case-study research (sources in §9), then every proposal measured against
the actual tree at `ui/home-redesign-and-type-system`. Where Pip already does the right thing,
that is recorded so nobody rebuilds it. Where a popular mechanic is a trap, that is recorded too,
with the reason it is declined.

---

## 1. The one constraint that shapes everything

Pip is not Duolingo. The gap is not size, it is *valence*.

A language app asks a user to look at something neutral and become better at it. A money app asks
a user to look at something they are actively avoiding. Behavioural economists have a name for
this: the **ostrich effect**, the documented tendency to check accounts *less* often precisely
when the news is worse, so avoidance peaks exactly when the information matters most. Financial
avoidance is driven by shame, and shame does not produce corrective action, it produces more
avoidance. Every skipped check drops anxiety for a moment, and the brain files that relief as a
win, which strengthens the avoidance next time.

This is why budgeting apps have a 30-day cliff, and it is why the naive gamification move
(surface the overspend, add a red number, add a guilt notification) is worse than doing nothing.

**The rule this constraint produces, and every step below obeys it:**

> Pip's engagement mechanics reward the act of *looking*, never the state of the *finances*.
>
> Logging a transaction is always a win. Spending money is never a loss. The streak counts days
> you looked, not days you behaved.

Pip already gets this half-right and it is worth naming, because it was clearly deliberate:
`DashboardScreen.tsx:561` carries the comment *"Spending is never styled as a failure, it's just
a fact"*, and `streak.ts` is documented as *"pure motivation, NOT a credit signal"* with gaming it
deliberately worthless. That instinct is correct and it is the foundation. The rest of this
document extends it.

The second-order version of the same rule: **separate gathering from acting.** Research on money
avoidance finds a large drop in the psychological cost of engagement when a user is explicitly
permitted to just look, with no commitment to fix anything. Pip's Home should be safe to open
when the user has no intention of doing anything about it.

---

## 2. What the research actually supports

Condensed from §9. Each finding is tagged with where it lands in the plan.

### 2.1 Emotional feedback is the largest single lever, and it is animation

Duolingo shipped a character animation system in 2022: idle motion, blinking, lip-sync, and
distinct success and failure reactions wired to a state machine. Daily active users went from
14.2M to over 34M inside two years and paid subscribers doubled. Adding the character to
notifications alone moved DAU 5% in test.

The mechanism is not "cute". It is Don Norman's visceral and behavioural layers doing feedback
work: the animation tells you the app *noticed*, instantly, before you read a word. And an
anthropomorphised interface converts an algorithmic nag into a parasocial one, which people
tolerate far better.

The threshold that matters: **5 to 10 distinct emotional states, reacting to real app state.** A
mascot with one pose is a logo. → **Steps 2, 3**

### 2.2 Completion drive beats points, badges, and leaderboards

Apple's own large-scale study (over 160,000 participants, Apple Heart and Movement Study, 2019 to
2022) found the stand nudge raised the probability of standing by **up to 49.5%**, over 60% for
participants aged 75+, and nearly tripled it among users who habitually close their Activity
rings. The rings work on the Gestalt principle of closure: a partially filled ring is an open
loop, and open loops itch.

*Note on the source video's framing:* the 49.5% figure is the effect of the **stand notification**,
not of ring closure itself. Ring-closers are the subgroup where the nudge lands hardest. The
honest reading is that the visual loop and the nudge compound, which is exactly the pairing
proposed in Steps 4 and 7.

The counter-case is just as strong. LinkedIn retired its gold Community Top Voice badges in
October 2024. Foursquare stripped out the points and badges that built it. The finding underneath
is consistent: badges and leaderboards raise engagement with *the system* while lowering
engagement with *the material*, and everyone not near the top disengages fast. → **Steps 4, 5**

### 2.3 Streaks are a loaded gun

Loss aversion works: 7-day-streak users are roughly 2.3x more likely to engage daily. It also
turns, on a predictable schedule:

| Days | What the streak is doing |
|---|---|
| 1 to 7 | Accomplishment. Pride, visible progress. Healthy. |
| 8 to 30 | Loss aversion enters and grows alongside pride. |
| 31+ | Obligation dominates. "I have to" replaces "I want to". |

Broken long streaks suppress engagement *below baseline*, and abandonment risk is highest past
60 days. The mitigations that survive scrutiny: a grace period built in from day one, protection
that is **earned, never purchased** (monetising streak anxiety reads as manipulation and users say
so), and a **graduation** where the daily counter hands off to a permanent marker once the habit
is automatic, around day 30 to 60.

Pip already has the grace period (`streak.ts` computes with `graceDays = 1`, so every-other-day
keeps the chain). It has none of the rest. → **Step 4**

### 2.4 Competence feedback outperforms achievement theatre

Gamification meta-analysis across 35 interventions finds a real but small overall effect, and the
components that carry it are **autonomy and relatedness**, with competence the weakest link to
intrinsic motivation when it is faked. The apps that hold users long-term (Chess.com's rating,
Garmin's and Peloton's performance numbers) report *actual skill*, not attendance.

Pip has a genuine competence signal sitting unused: `merchant_memory` grows every save, so the
share of a scan that arrives pre-categorised rises over time and is measurable. That is a real
capability curve, not a badge. → **Step 5**

### 2.5 Variable magnitude beats fixed reward, and Pip's peak is already shaped for it

The three-beat structure (anticipation → reveal → celebration) drives engagement harder than
loss-aversion mechanics, because the *size* of the payoff is unknown until the reveal.

Pip's core loop is already literally that structure and nobody has designed it as one:

```
AddFlow.tsx → Attach     (anticipation: you pick the screenshot)
            → Extract    (anticipation: the model is reading it)
            → Categorize
            → Saved      (reveal + celebration)
```

And the magnitude genuinely varies: a receipt yields 1 line, a monthly statement yields 40. The
user does not know which until the reveal lands. → **Step 2**

### 2.6 Winnable beats global

Strava's segments decompose one impossible global leaderboard into thousands of local ones
containing only people you could plausibly beat. Social comparison motivates against *similar
others*, not distant elites, and winnability predicts competitive motivation. Users recording in
isolation, with no comparison at all, churn hard.

Pip has no social graph and should not grow one (see §8). The winnable local comparison available
to a solo finance app is **you versus your own last month**, per category, which is both always
winnable and immune to the shame of comparing against strangers. → **Step 5**

### 2.7 More mechanics is not more engagement

Gamification benefits follow an S-curve and then bend down. The Habitica study found *every*
participant hit counterproductive effects, most commonly being punished by the game layer during
their genuinely most productive periods, and the predictor of motivation collapse was perceived
inappropriateness of the reward system. The overjustification effect is the underlying mechanism:
external reward displacing the internal reason.

`ui-design-plan.md` §1 already established that Pip's failure mode is stacking, eight blocks on
Home with nothing emphasised. Engagement mechanics stack the same way. → **Step 9's budget rule**

### 2.8 Motion has a budget, and it is small

Nielsen Norman and Material converge: 100 to 300ms for most UI motion, up to 500ms for genuinely
complex transitions, ease-out. Over 500ms reads as sluggish, under 100ms as jarring. Every motion
needs a job (feedback, continuity, or orientation) or it is noise.

And roughly 35% of users either have reduce-motion enabled or would benefit from it. Looping
animation is the category that hurts them most. Pip currently runs **three uncapped loops**:
Pip's float (`Pip.tsx:86`), the flame flicker (`DashboardScreen.tsx:304`), and CoinMascot. None
of them check the OS reduce-motion flag. → **Steps 1, 9**

### 2.9 Notification architecture, not notification copy

Duolingo's measured wins came from structure:

- **Behaviour-inferred timing.** Fire ~30 minutes before the window the user actually used the app
  yesterday, not at a time they picked once and forgot.
- **Two classes.** *Routine* (low urgency, habit window) and *Save* (something expires soon).
  Mixing them burns the channel.
- **Hard cap of two pushes per day.**
- Named character as sender: +5% DAU. Separating streak maintenance from goal completion: +40%
  on 7-day streaks.

Pip fires at a **fixed 22:00** (`reminders.ts:23`), with the titles `'Anything to log?'` and
`'Still waiting on someone'`. Correct plumbing, no architecture, no voice. → **Step 7**

### 2.10 The first session is most of the funnel

70 to 80% of new installs are lost inside three days, the bulk of it in session one, and the
target for first meaningful value is **60 to 90 seconds**. Fintech is worse than average because
value sits behind a verification gate.

Pip's LLM keys are the developer's responsibility, not the user's: `EXPO_PUBLIC_GROQ_API_KEY` and
`EXPO_PUBLIC_GEMINI_API_KEY` are baked in from `.env.local` at build time
(`src/settings/settingsStore.ts`), and the Settings rows for editing a provider key are `__DEV__`
only, stripped from the shipped build. There is no credential wall in this app's funnel. The gap
is smaller but still real: a fresh install goes straight to an empty Home with nothing to look at,
and the peak moment (Step 2) only happens once the user finds a real screenshot of their own to
scan. Nothing shows them the payoff first. → **Step 8**

---

## 3. Where Pip stands today

Measured against the working tree, not estimated.

| Surface | State | Verdict |
|---|---|---|
| Motion primitives | `FadeIn` (340ms, ease-out cubic), `useEased` / `useEasedFrom` count-ups, spring pop on Saved | Good primitives, thinly applied |
| Press feedback | `PrimaryButton` scale 0.98, `HeaderIcon` scale 0.92 | Present but inconsistent across the app |
| Haptics | **None.** `expo-haptics` is not a dependency | Missing entirely |
| Reduce-motion | **Not read anywhere.** Three uncapped loops | Accessibility gap |
| Mascot | `Pip.tsx`: 4 expressions (`idle`/`happy`/`think`/`curious`), optional float | Below the 5 to 10 threshold, and rendered statically almost everywhere |
| Streak | 1-day grace, 7 dots, feeds the Android widget | Grace is right; no freeze, no milestone, no graduation |
| Peak moment | `SavedScreen.tsx`: spring pop, "All sorted!", learned-merchants card | The right idea at the wrong size. The payoff line is 14.5px sub-text (`SavedScreen.tsx:145`) |
| Competence signal | `merchant_memory` grows on every save | Real, unused as feedback |
| Notifications | Fixed 22:00, generic titles, no cap, no voice | Plumbing without architecture |
| Empty state | "No spending yet" + curious Pip | Plain; `business-plan.md` §4 wants voice here |
| Onboarding | One screen, straight to an empty Home | No first-value moment |
| Voice | Does not exist in the product | `business-plan.md` §4 rates it a retention lever "on par with the mechanism" |

Two things are already correct and must not regress:

- **The no-shame stance** in `DashboardScreen.tsx:561` and `streak.ts`. Everything in §1 depends
  on it.
- **The raised Add button** in `BottomNav.tsx`. Capture is the loop; it is on screen from every
  tab. `ui-design-plan.md` §1 already ruled this untouchable.

---

## 4. The plan

Nine steps, ordered so each one is shippable on its own and unblocks the next. Steps 1 to 3 are
the highest leverage per hour of work; if only three ship, ship those.

Each step lists **Goal · Why · Build · Files · Done when**.

---

### Step 1. Motion and haptics foundation

**Status: roughly done.** The tokens, the hook, the haptics wrapper, and the Settings row are
built, wired, and verified (typecheck, full test suite, both existing audits, and a live pass
in the browser across all three Motion settings). Three things were intentionally left for later,
listed after the build notes below.

**Goal.** One place that decides how long things take, how they ease, whether they play at all,
and what they feel like in the hand.

**Why.** Everything after this depends on it, and §2.8 says an unbudgeted motion system becomes
noise. Pip already has three uncapped loops running with no accessibility escape hatch.

**Build.**

1. `npx expo install expo-haptics` (Expo-managed, no config plugin needed).
2. New `src/theme/motion.ts`, alongside the existing token modules:
   ```ts
   export const duration = { micro: 120, base: 220, enter: 320, celebrate: 480 } as const;
   export const easing = { standard: Easing.out(Easing.cubic), spring: { friction: 5, tension: 120 } } as const;
   ```
   Four durations, mirroring the discipline of `type` and `spacing` in `theme.ts`. `micro` and
   `base` are routine motion inside the 100-300ms band; `enter` and `celebrate` use the wider
   up-to-500ms allowance for genuinely complex transitions, `celebrate` reserved for Step 2's
   payoff.
3. New `src/state/useReducedMotion.ts` wrapping RN's `AccessibilityInfo.isReduceMotionEnabled()`
   plus its change listener. When true: loops do not start, transforms collapse to opacity-only,
   `celebrate` collapses to `base`.
4. New `src/lib/haptics.ts`, a thin semantic wrapper so call sites never name a platform API:
   `tap()` (selection), `commit()` (medium impact), `payoff()` (success notification),
   `warn()` (warning). No-ops on web, and respects a Settings toggle.
5. Wire `useReducedMotion` into the three existing loops: `Pip.tsx:86`, the flame in
   `DashboardScreen.tsx:304`, `CoinMascot.tsx`.
6. Settings row: **Motion and haptics** with Full / Reduced / Off. Autonomy is one of the two SDT
   components that actually carries the effect (§2.4), and this is the cheapest place to give it.

**Files.** `package.json`, new `src/theme/motion.ts`, new `src/state/useReducedMotion.ts`, new
`src/lib/haptics.ts`, `src/components/Pip.tsx`, `src/components/CoinMascot.tsx`,
`src/screens/DashboardScreen.tsx`, `src/screens/SettingsScreen.tsx`.

**Performance note.** Do not add Reanimated for this. Benchmarks on Expo SDK 55 put RN `Animated`
at 3.32ms (iOS, 100 views) versus Reanimated's 3.72ms, and both are comfortably inside the
16.67ms frame budget for the short transform-and-opacity transitions Pip needs. Reanimated earns
its weight on gesture-driven and scroll-linked work, which Pip does not have. The existing
`Animated` usage stays.

**Done when.** Toggling OS reduce-motion stops every loop in the app. Every button in the app
gives the same press feedback. Nothing over 320ms exists outside Step 2's payoff.

**What still needs extra work.**

- **Button press-feedback is not unified.** `PrimaryButton` scales to 0.98, `HeaderIcon` to 0.92,
  and other `Pressable`s use their own ad hoc opacity/scale. Unifying every press interaction in
  the app is a real UI-consistency pass across many files, not a foundation task, so it was left
  out of this step rather than rushed. Worth doing as its own pass, or folded in screen-by-screen
  as Steps 2 to 7 touch each one anyway.
- **`haptics.ts` had no call sites at the time this step shipped.** Since resolved by Step 2:
  `SavedScreen.tsx` now imports `payoff()` for the save reveal, the first genuine caller.
- **`duration.celebrate` collapsing to `duration.base` under reduced motion is still not wired
  everywhere that reads it.** `ExtractScreen.tsx` checks `useReducedMotion()` and correctly
  skips its hold delay, but `SavedScreen.tsx` (Step 2) consumes `motionDuration.celebrate` for
  its `FadeIn` stagger without importing `useReducedMotion` at all, so the reveal still staggers
  at full length for a user who has motion reduced. Worth fixing when Step 2 gets its own
  device-verification pass rather than folding it back into this step.

---

### Step 2. Rebuild the peak: the scan reveal

**Status: roughly done.** Acts 2 and 3 (the staged Saved reveal, `<Display>` payoff typography,
elapsed-time line) are built, wired end to end through `AddFlow.tsx`, typechecked, covered by a
new `readTimeLabel` unit test, and verified live in the browser (manual-entry path: the count
renders at the correct 40px hero size, staged fades land, no new console errors). Act 1 (the
extraction-screen narration) is built but only verified by inspection, not a live run, listed
below. Two deliberate deviations from the build notes, both reconciliations rather than gaps:

- **Act 1 narrates two real stages, not three.** "Matching merchants" was dropped: the actual
  merchant-matching (`suggestForMerchant` against local memory) is synchronous local computation,
  not a wait state, so narrating it as a third beat would have been exactly the fabricated
  progress this step explicitly rules out. What shipped instead is "Reading your screenshot…"
  with a live ticking-seconds counter (100% real elapsed time, no fake stages) followed by a
  genuine "Found N lines…" beat held for `duration.enter` before the result list renders. Still
  a legible three-part shape (reading → found → reviewing), just built from real signal instead
  of invented narration.
- **The 120/400/560ms stagger became 120/320/480ms**, i.e. every delay now traces to a named
  `motion.ts` token (`micro`/`enter`/`celebrate`) instead of two bespoke numbers. Same shape, but
  nothing in the reveal exists outside the motion budget Step 1 set up, which is what Step 9's
  audit will need to be true anyway.

**Needs real-device verification, not done here:** the extraction-path narration (ticking
counter, the "Found N lines…" beat, and the honest "Read in Ns" line off a live LLM call) was
only checked by reading the code and typechecking it: this sandbox has no configured LLM key
and the manual-entry path used for the browser check never touches `ExtractScreen.tsx` at all.
Worth a real scan on a device before calling Act 1 done, not just roughly done.

**Goal.** Turn Attach → Extract → Saved into a deliberate three-act reveal, and make the payoff
line the biggest number on the screen.

**Why.** Highest-leverage step in this document. Peak-end says a user remembers the most intense
moment and the last one; §2.5 says variable-magnitude reveals beat loss-aversion mechanics; and
`ui-design-plan.md` §6 already identified this exact moment as Pip's unambiguous peak and
observed it is *undersold*. The structure exists. It has never been designed.

**Build.**

**Act 1, anticipation (`ExtractScreen.tsx`).** Replace the generic spinner with Pip in `think`,
plus a line that narrates real progress rather than faking it: "Reading your screenshot…" →
"Found 14 lines…" → "Matching merchants…". Do not fabricate a progress bar; narrate the stage the
request is actually in. Anticipation is only pleasurable when the wait is legible.

**Act 2, reveal (`SavedScreen.tsx`).** Stage it, do not dump it:

```
t+0ms      Pip springs in, happy            (existing spring, keep it)
t+120ms    haptics.payoff()
t+120ms    the count counts up 0 → 14       (useEased, already built, unused here)
t+400ms    the sub-line fades in
t+560ms    the learned-merchants card rises (FadeIn, staggered rows)
```

Every timing above comes from `motion.ts`. Total under 700ms.

**Act 3, the payoff typography.** `ui-design-plan.md` §4 assigns `<Display>` to "one per screen,
the hero". On Saved, the hero is the count. Today it is 14.5px sub-text at `SavedScreen.tsx:145`.

```
              [ Pip, delighted ]

              14
              transactions · RM 1,240
              read in 6 seconds
```

**"Read in 6 seconds" is the most important string in the app.** It is the line that makes the
difference against manual entry legible, and it is the sentence a user repeats to a friend. Time
the extraction call and show it. If it took 22 seconds, show 22: an honest number beats a rounded
one, and it still beats typing 14 rows.

**Variable magnitude, honestly.** The reveal already varies (1 line from a receipt, 40 from a
statement). Do not invent tiers or rarity on top of that. The variance is real; manufactured
variance is a slot machine, and a slot machine in a budgeting app is indefensible.

**Files.** `src/screens/SavedScreen.tsx`, `src/screens/ExtractScreen.tsx`,
`src/screens/AddFlow.tsx` (thread the elapsed-time measurement through), `src/components/Pip.tsx`.

**Done when.** A statement scan produces a staged reveal under 700ms, the count is `<Display>`,
and elapsed time is shown from a real measurement.

**Addendum: bounding-box capture (out of plan, shipped alongside Step 2).** Not one of the nine
steps above: a separate ask, landed in the same pass because it touches the same Attach/Receipt
capture flow this step's reveal depends on. A live-edge-detected scanner (a bounding box tracks
the document in the camera feed and crops to it on capture) now backs the "Take a photo" buttons
on `AttachScreen.tsx` and `ReceiptScanScreen.tsx`, wrapping
`react-native-document-scanner-plugin` (VisionKit on iOS, ML Kit on Android) behind
`src/lib/documentScanner.ts`.

**Status: mechanically done, needs real-device verification and a workflow decision.**
Typechecked, the pure `normalizeFileUri` helper is unit-tested, the config-plugin chain was
smoke-tested with a throwaway `expo prebuild` (plugin resolves and the build graph is valid),
and web was confirmed to fall through to the untouched plain camera picker. What's still open:

- **Nothing here has run on an actual camera.** This sandbox has no Xcode, Android SDK, or adb,
  so the live bounding box, the crop quality, and the fallback-to-plain-picker path on a genuine
  Expo Go install have only been reasoned about, not watched happen. Needs a real pass via
  `eas build --profile development` or a local `expo run:android`/`expo run:ios` before this is
  trusted in front of a user.
- **This is a standing cost, not a one-time one.** Adding the native module means Expo Go can no
  longer run this project at all (confirmed and accepted before implementing, not discovered
  after). `README.md`'s "Run it" section now documents both workflows, but every future
  contributor who doesn't read that section will hit a confusing failure the first time they try
  `npx expo start --go` and tap the camera button. Worth a loud comment at the top of the README,
  not just a section further down.
- **`npm install` reported 29 audit vulnerabilities** (12 moderate, 16 high, 1 critical) across
  the tree after adding this dependency and `expo-dev-client`. Not run through `audit fix
  --force` (that rewrites versions without asking), so this is flagged rather than resolved.
  Worth a `npm audit` read before shipping, to separate real exposure from the usual RN
  transitive-dependency noise.
- **The plugin's exact return format was taken from its docs, not observed.** Specifically
  whether `imageFilePath` responses always carry the `file://` scheme, and what
  `maxNumDocuments` does when left unset versus pinned to 1 as done here. `normalizeFileUri`
  defends against the documented ambiguity, but a real device is the only way to confirm which
  branch it actually takes.

---

### Step 3. Pip reacts

**Goal.** Take Pip from 4 static poses to a small state machine that reacts to what just happened.

**Why.** §2.1. This is the mechanism behind the largest documented result in the research, and
Pip's mascot is currently a 40px decoration in the header (`DashboardScreen.tsx:187`) plus a
static illustration on three screens.

**Build.**

1. Extend `PipExpr` from 4 to **7**: `idle` · `happy` · `think` · `curious` · `proud` · `sheepish`
   · `sleepy`. Seven sits inside the 5-to-10 band from §2.1 and each one has a job:

   | Expression | Fires when |
   |---|---|
   | `think` | extraction in flight |
   | `happy` | a save lands |
   | `proud` | a milestone: streak graduation, budget month closed, 50th merchant learned |
   | `sheepish` | **Pip's own failure only.** A miscategorised merchant, a bad parse. Never the user's spending. |
   | `curious` | empty states |
   | `sleepy` | nothing logged for 4+ days |
   | `idle` | default |

   `sheepish` is the one that earns the most trust and it is the one most likely to get misused.
   §1 is absolute here: Pip is sheepish about **Pip's** mistakes. When the user overspends, Pip
   stays neutral.

   **Visual direction per expression** (art direction from the human partner, translated to what
   a limbless SVG sprite can actually draw):

   - **`happy`.** Push past the current closed-eye smile toward genuine, big-grin delight: wider
     mouth curve, eyes squeezed into the happy arcs `Pip.tsx` already has, plus a couple of small
     sparkle/confetti particles animating outward from the body on the save-reaction bounce
     (Step 3.3). The reference is a dog mid-grin with a party hat and lollipop: Pip can't wear
     props without breaking its silhouette across every other screen, so the joy has to live
     entirely in the face and the burst of motion around it, not in an accessory.
   - **`think`.** Einstein-coded, not sleepy-coded: one eyebrow line raised higher than the other
     (a short curved stroke above one eye, new geometry not in the current `Eyes` component),
     eyes narrowed and glancing slightly up-and-off-centre rather than centred, mouth as a small
     flat line. Reads as "working the problem," which is the right register for extraction being
     in flight, closer to a raised eyebrow than the current wide-eyed `curious` look it's easy to
     confuse it with.
   - **`proud`.** The thumbs-up read needs a hand, and Pip has none today: `Pip.tsx`'s only limbs
     are the two sprout leaves at the top. Two ways to get the gesture without a full limb
     redesign: (a) grow one sprout leaf into a small stem-and-thumb shape for this expression
     only, cheap and reversible since it is not shared with the other six; or (b) skip the literal
     thumbs-up and carry pride in the face alone, wide closed-eye grin plus the sparkle motion
     from `happy` but bigger and slower, paired with a subtle upward tilt of the whole body. (b)
     stays inside the existing rig and ships with zero new geometry; (a) reads closer to the
     reference but is a small scope add. Recommend (a) given how load-bearing milestones are
     (streak graduation, 50th merchant): a body-language cue this specific is worth the extra
     path, and one added limb doesn't force redesigning the other expressions.

2. Add micro-idle to the existing float loop: a blink every 4 to 7 seconds, randomised.
   `Pip.tsx` already builds the eyes as SVG `Circle`s, so a blink is an animated `ry` on those
   two nodes. Cheap, native-driven, and it is the single cue that reads as "alive". Gated on
   `useReducedMotion`.

3. Reaction, not just pose. On a save, Pip does a small scale bounce (`duration.base`, existing
   spring config) as it flips to `happy`. That is the emotional feedback loop from §2.1: the app
   visibly *noticed*.

4. Put Pip where the emotion is. Today it renders on Onboarding, Saved, and the Home empty state.
   Add: Extract (thinking), the Recap screen (proud), and the 4-day-lapsed Home state (sleepy).

**Deliberately not doing: Rive or Lottie.** Both are the standard answer for this (Duolingo uses
Rive), and both are wrong for Pip right now. `Pip.tsx` is 132 lines of `react-native-svg` that
already themes off the accent colour and shades its own ink. A Rive runtime is a new native
dependency, a new asset pipeline, and a designer dependency, to animate a shape that is six
circles and two paths. Revisit if Pip ever needs lip-sync. It does not.

**Files.** `src/components/Pip.tsx`, `src/components/CoinMascot.tsx`,
`src/screens/ExtractScreen.tsx`, `src/screens/SavedScreen.tsx`, `src/screens/RecapScreen.tsx`,
`src/screens/DashboardScreen.tsx`.

**Done when.** Seven expressions ship, Pip blinks, a save produces a visible reaction, and no
expression fires in response to the user's spending.

---

### Step 4. Turn the streak into a closure loop with an exit

**Goal.** Keep the 2.3x engagement effect, defuse the day-31 obligation flip.

**Why.** §2.3. Pip's streak today is the shape that turns: uncapped, unprotected, no graduation,
counting up forever. It also duplicates work with the 7 dots beside it (`DashboardScreen.tsx:340`),
which are already a closure object nobody has treated as one.

**Build.**

1. **Make the week the loop, not the counter.** The seven dots become a **ring of seven
   segments**, filling as the week fills, resetting Monday. That is Gestalt closure (§2.2) on a
   window short enough to always be winnable, which is exactly the Strava lesson (§2.6) applied to
   a solo app. The number keeps its place, smaller, beside the ring. `compute7DayDots` already
   returns the array; only the rendering changes.

2. **Earned protection, never sold.** One **streak freeze** granted per calendar month, auto-spent
   on the first missed day. Shown as a small shield on the ring. It is never purchasable, and
   nothing in the app ever tells a user to buy their way out of anxiety. Pip has no IAP today and
   this is a reason to keep it that way in this area specifically.

3. **Graduation at 30 days.** Past 30, the daily count stops being the headline. It becomes
   "Logging since March" plus a permanent marker, and the ring keeps running underneath. The
   research (§2.3) is explicit: escalating pressure should be temporary, matched to a temporary
   goal. Once the habit is automatic, the scaffolding comes down instead of compounding.

4. **A pause the user controls.** A "Pause streak" row (travelling, hospital, whatever). Agency is
   the SDT component that carries the effect (§2.4), and a streak you can pause is one you never
   have to lie to.

5. **Copy audit.** Nothing in this feature is allowed to shame. Never "you broke your streak" or
   "don't lose it". The freeze copy is "Pip covered you" (`business-plan.md` §4 register), and a
   lapse is "Back at it" rather than a funeral.

**Files.** `src/lib/streak.ts` (freeze ledger, graduation threshold, week-window helper),
`src/screens/DashboardScreen.tsx` (`StreakCard` becomes `WeekRing`), `src/db/metaRepo.ts` (freeze
grants and spends), `src/widget/StreakWidget.tsx` (mirror the ring), plus tests in
`__tests__/`.

**Done when.** The ring closes and resets weekly, a missed day burns a freeze silently, day 31
changes the headline instead of raising the stakes, and no string in the feature blames anyone.

---

### Step 5. Competence feedback, not achievement theatre

**Status: built, needs a live device/app pass.** All four build items are wired end to end,
typechecked, and covered by new unit tests for every pure calculation involved (`autoFillStats`
in `recommend.test.ts`; `prevMonthKey`, `categoryComparisons`, `hasComparisonData` in
`recap.test.ts`  18 cases total, all TDD'd: written failing, watched fail for the right reason,
then made to pass). Full suite (631 tests, 48 files) is green, `tsc --noEmit` is clean, and
`audit:contrast` / `audit:type` show no new violations (`SavedScreen.tsx`, `RecapScreen.tsx`,
`BreakdownScreen.tsx`, `AddFlow.tsx` are all still on the pre-migration allowlist in
`tools/typeAudit/audit.js`, so their raw fontSize/spacing literals are exempt by design, same as
Steps 1-2 left them).

**What shipped, against the four build items below:**

1. **Auto-fill rate.** `autoFillStats()` (new, in `src/lib/recommend.ts`) counts how many of a
   scan's lines matched `source: 'learned'` versus a guess or nothing. `AddFlow.tsx` captures
   the memory-matched suggestions at extraction time (before the user edits anything in
   Categorize, so the number reflects what Pip actually knew), and on save persists the running
   monthly total via two new functions on `memoryRepo.ts` (`recordAutoFill` /
   `getAutoFillForMonth`, backed by the existing generic `app_meta` table through `metaRepo.ts`
    no schema migration needed). `SavedScreen.tsx` renders "11 of 14 filled themselves. Last
   month it was 4 of 14." beneath the payoff line, and honestly drops the second sentence when
   there is no prior-month data yet rather than showing a fabricated "0 of 0."
2. **"Pip knows N merchants."** Landed on `RecapScreen.tsx` inside a new competence card,
   computed as `Object.keys(memory).length`  the memory map was already loaded in app state for
   the Add flow, so this is a free read, not a new query.
3. **You versus your own last month.** `categoryComparisons()` and its guard
   `hasComparisonData()` (new, in `src/lib/recap.ts`, alongside a `prevMonthKey()` promoted out
   of a local helper that used to live only in `RecapScreen.tsx`) pair this month's and last
   month's spend per category. Rendered on `RecapScreen.tsx` as a "You vs. last month" card (top
   5 by current spend) and on `BreakdownScreen.tsx` as a small line under each category's
   numbers, expense-only (matching `spentByCategory`'s scope) and only once real spend exists in
   the prior month. Both directions state the number plainly ("RM 420. Last month RM 510.")
   with no color-coded up/down and no "over/under" language, per §1.
4. **The coverage line finds its home.** The competence card also surfaces
   `coverage.daysCovered`/`coverage.windowDays` (already computed in `store.tsx`, unused since
   `ui-design-plan.md` §3 evicted it from Home) next to the merchant count.

**Live-checked in the browser (web, manual-entry path):** added a real transaction, watched
Saved render correctly (no auto-fill line, correctly, since manual entry has no scan to
measure), then reached Recap (competence card showing "1 merchant Pip knows" / "0/90 days
covered", "You vs. last month" correctly absent with no prior-month history yet) and Breakdown
(category row renders cleanly, no "Last month" line yet, same guard). No new console errors
beyond the pre-existing react-native-web warnings. **Not checked:** the extraction path itself
(this sandbox has no configured LLM key, so the `learned`-suggestion → auto-fill-line path on
Saved, and a real "Last month it was 4 of 14" second sentence once two months of data exist,
have been reasoned through and unit-tested but not watched on screen) — same caveat Step 2 left
for its Act 1. Worth a real scan on a device, across a month boundary, before calling this fully
done.

**Goal.** Show the user a number that goes up because they and Pip are genuinely getting better,
and never award a badge.

**Why.** §2.4 and §2.2. Pip already computes the honest signal and shows it once, in passing, in
the learned-merchants card on Saved. Badges are explicitly declined (§8).

**Build.**

1. **The auto-fill rate.** `merchant_memory` makes this computable today: of the lines in the last
   scan, what share arrived already categorised? Surface it on Saved beneath the payoff:
   *"11 of 14 filled themselves. Last month it was 4 of 14."* That is a capability curve, it is
   true, and it is the thing that actually improves with use.

2. **"Pip knows N merchants."** One line on the Recap screen, monotonically rising, tied to real
   stored rows. It is Chess.com's rating for a budgeting app: a number that means something
   because it was earned.

3. **You versus your own last month.** The winnable local comparison from §2.6, per category, on
   Recap and Breakdown: *"Food, RM 420. Last month, RM 510."* Two hard rules:
   - Both directions are stated **neutrally**. Up is not failure. "RM 90 more than last month" is
     information; "you overspent by RM 90" is a verdict, and §1 forbids verdicts.
   - It renders only with at least two full months of data, otherwise the comparison is noise.

4. **The coverage line finds its home.** `ui-design-plan.md` §3 evicted "Covered 62/90 days" from
   Home for being an unexplained data-confidence metric in the wrong unit. On Recap, with room to
   explain it, it is exactly the competence feedback this step is about. Land it there.

**Files.** `src/screens/SavedScreen.tsx`, `src/screens/RecapScreen.tsx`, `src/lib/recap.ts`,
`src/lib/coverage.ts`, `src/db/memoryRepo.ts`, `src/screens/BreakdownScreen.tsx`.

**Done when.** Every progress number in the app traces to a stored row, none of them is a badge,
and every month-over-month comparison reads neutrally in both directions.

---

### Step 6. Give the rare screens a voice

**Goal.** Ship Pip's personality where it belongs, and nowhere else.

**Why.** `business-plan.md` §4 rates voice a retention lever on par with the mechanism, citing
Cleo (Roast Mode, 500,000+ social shares, a finance app in Pip's exact category) and Duolingo's
owl (a 41% DAU/MAU ratio and a free marketing channel built out of memes of its own
notifications). In the shipped app it does not exist. `ui-design-plan.md` §6 wrote the dosing
table; this step executes it.

**Build.** The dosing table is the spec, and the reason for it is §2.7: a joke on a screen you see
forty times a month is not a joke by week two.

| Surface | Register | Frequency |
|---|---|---|
| Push notifications | passive-aggressive, occasional slang | rare, high visibility |
| Android widget | same | same |
| Empty states | passive-aggressive, self-aware | seen once or twice ever |
| Milestones (streak graduation, 50th merchant, month closed) | warm, proud | rare by construction |
| Saved screen | warm, light | it is the reward, not the punchline |
| **Hero number, categorise, net worth, budget** | **plain** | **every single day** |

Strings to change first, because they are the ones a new user meets:

- Home empty state, today `"No spending yet"` (`DashboardScreen.tsx:680`).
- Budget CTA, today `"Plan income and allocate spend per category."`
  (`DashboardScreen.tsx:259`). Plain, but human.
- `SavedScreen`'s `"All sorted!"` stays. It is already right.

**Rotation is mandatory.** A voice line that repeats verbatim is worse than a plain one, because
the second viewing exposes it as a canned string. Build a small `src/lib/voice.ts` returning one
of N lines per (surface, state), seeded so it does not flicker inside a session.

**The half-life caveat, from `business-plan.md` §4.** Slang dates fast and a brand trying to sound
current is a known way to become the joke. Two guardrails carried forward: dose it in the
low-frequency surfaces only, and let Pip be in on its own joke rather than performing one.

**Files.** New `src/lib/voice.ts`, `src/screens/DashboardScreen.tsx`, `src/lib/reminders.ts`,
`src/widget/StreakWidget.tsx`.

**Done when.** Every string in the app is classifiable against the table above, no core
transactional screen carries a joke, and no voice line can appear twice in a row.

---

### Step 7. Notification architecture

**Status: built, needs a real-device pass.** All five build items are wired end to end and
covered by new unit tests (TDD'd: written failing, watched fail for the right reason, then made
to pass): `inferredFireHour`, `reminderClass`, and `capDailyReminders` in `reminders.test.ts`;
kind-tagging and the no-verdict regression guard split across `reminders.test.ts` and
`commitmentReminders.test.ts`; the title-rotation pool in the new `voice.test.ts`. Full suite (658
tests, 49 files) is green, `tsc --noEmit` is clean, and both existing audits (`audit:type`,
`audit:contrast`) show no new violations from this step.

**What shipped, against the five build items:**

1. **Behaviour-inferred timing.** `inferredFireHour()` (new, in `reminders.ts`) takes the hours
   transactions were created at, returns the modal hour minus 30 minutes, and falls back to
   `REMINDER_HOUR` (22:00) below `MIN_HISTORY_FOR_INFERRED_HOUR` (5) samples. `planLogReminders`
   takes an optional `fireHour`/`fireMinute` now instead of hardcoding `REMINDER_HOUR`, so every
   existing test that didn't pass one keeps its old behaviour unchanged. `useReminderSync.ts`
   computes it from `transactions` each sync and resolves a new `reminderHourOverride` setting
   (`store.tsx`, `app_meta`-backed, survives resets the same way the other reminder prefs do)
   over it when the user has picked one. Settings gained a Reminder time row (Auto / 9 PM / 10 PM
   / 11 PM), shown only while the log reminder itself is on.
2. **Split routine from save.** `reminderClass(kind)` maps `log → routine`, `owed`/`commitment →
   save`. Every `ReminderPlanEntry` now carries its own `kind`, set by the planner that created it.
3. **Hard cap two per day.** `capDailyReminders()` (new, in `reminders.ts`) merges all three
   planners' output, groups by calendar day, and keeps at most `DAILY_REMINDER_CAP` (2),
   preferring `save` over `routine` and earliest-firing within a tie. `useReminderSync.ts` runs it
   once over the merged queue before splitting back out by kind for the notification adapter.
4. **Pip is the sender.** New `src/lib/voice.ts` exports `notificationTitle(cls, seed)`, a
   deterministic (seeded off the firing day, not `Math.random()`) rotation over a small
   Pip-attributed title pool per class. Wired into the log and owed planners, replacing the two
   frozen title constants named in the brief. Deliberately narrow: the commitment (bill) titles
   ("Bills this month" / "Overdue") were left as-is, since the brief named only the log/owed
   constants and commitment's own copy already carries its own escalating voice in the body.
5. **Never notify about a number.** No code change: read through every tier of
   `logReminderBody`/`owedReminderBody`/`commitmentDigestBody`/`overdueBillBody` and confirmed
   none of them verdict the user's own spending already. Locked that in with a characterization
   test scanning the full tier range of each for forbidden phrases ("over budget", "overspent",
   etc.) so a future tier addition can't regress it silently.

**Not checked, and needs a real device:** the entire Reminders section of Settings (including the
new Reminder time row) is hidden on web (`Platform.OS !== 'web'`, since `expo-notifications` has
no web support), so this sandbox's browser preview cannot render it at all. Confirmed the rest
of Settings still renders cleanly and picked up no new console errors, but the new picker itself
was only verified by inspection and by matching the exact pill pattern (`styles.modeToggle`/
`modeBtn`) already proven live by the Theme/Motion/Streak pickers on the same screen. Also
unverified live: whether a real notification actually arrives at the behaviour-inferred hour, and
whether the daily cap is visible correctly in the OS notification shade rather than just in the
scheduling math. Same caveat Steps 2 and 5 left for their own device-only paths.

**Goal.** Replace one fixed hour with the structure that produced Duolingo's measured wins.

**Why.** §2.9. `reminders.ts` is well-built plumbing (pure, `now` injected, fully unit-tested,
re-armed on foreground) pointed at a fixed 22:00 with generic copy. The architecture is the gap,
not the code quality.

**Build.**

1. **Behaviour-inferred timing.** Replace the `REMINDER_HOUR = 22` constant
   (`reminders.ts:23`) with a per-user window derived from when they actually open and log.
   Transaction `createdAt` is already stored, so the modal logging hour is computable from data
   Pip has. Fire ~30 minutes before it. Keep 22:00 as the fallback until enough history exists,
   and keep it overridable in Settings (autonomy again).

2. **Split routine from save.** Two classes, never mixed:
   - *Routine*: "Anything to log?" in the habit window. Low urgency, skippable, suppressed when
     the user already logged today (`reminders.ts` already does this suppression correctly).
   - *Save*: something genuinely expires. A bill due tomorrow, a week ring one segment short on
     Sunday evening. Urgent tone only when there is real urgency.

   Mixing them is what burns a notification channel: if everything is urgent, nothing is.

3. **Hard cap two per day**, enforced in the planner, not by convention. `PLAN_HORIZON` already
   emits a queue; add the cap there so it is testable.

4. **Pip is the sender.** Named-character sending moved Duolingo's DAU 5%. Titles come from
   `voice.ts` (Step 6), not from the two frozen constants at `reminders.ts:34`.

5. **Never notify about a number.** A push saying "You are RM 400 over budget" is the ostrich
   effect's ignition switch (§1). Notify about *actions* (log, tick off a bill, chase a debt) and
   never about a verdict.

**Files.** `src/lib/reminders.ts`, `src/state/useReminderSync.ts`, `src/notifications/index.ts`,
`src/lib/voice.ts`, `src/screens/SettingsScreen.tsx`, `__tests__/reminders.test.ts`,
`__tests__/commitmentReminders.test.ts`.

**Done when.** Reminder time is derived from behaviour, the two classes never share a tone, the
cap is enforced in the planner with a test, and no notification body contains a judgement.

---

### Step 8. Value in the first 60 seconds

**Goal.** Show the peak (Step 2) before the user has to go find a real screenshot of their own.

**Why.** §2.10. 70 to 80% of installs are lost in three days, mostly in session one. There is no
credential wall to remove (LLM keys are the developer's responsibility, baked in at build time,
never asked of the user), but a fresh install still lands on an empty Home with nothing to look
at, and the peak moment does not happen until the user supplies their own statement. Every step
above raises the ceiling for users who get there. This step decides how many get there.

**Build.**

1. **Onboarding is the first scan, run on a bundled sample.** `ui-design-plan.md` §7 already
   identified this as the strongest first-run option and deferred it. The assets are already in
   the bundle: `SAMPLE_STATEMENTS` ships real Touch 'n Go, Maybank MAE and Grab payout
   screenshots, generated by `tools/demoKit`, behind a `showSamples` prop that defaults to false
   and is passed `true` from nowhere. Dead code, live need.

   A tap on "See how it works" runs the full three-act reveal from Step 2 against a bundled
   sample, with a **pre-parsed fixture** rather than a live API call. No network, no latency, no
   failure mode. The peak happens at roughly second 20.

2. **Honesty is non-negotiable, per `ui-design-plan.md` §7.** The demo data is visibly labelled a
   demo throughout and clearable in one tap. Silently seeding fake transactions into a user's
   records would be dishonest and would poison the trust the privacy positioning depends on. A
   persistent "Demo data · Clear" banner until cleared.

3. **Straight into the real flow after.** Once the demo lands, the next tap is "Try it with your
   own screenshot" into the real Attach flow. Nothing to unblock in between: the app is already
   fully configured, so this is a straight handoff from demo to real use, not a signup.

4. **The elapsed-time line does double duty.** "Read in 6 seconds" on the demo is the value
   proposition and the peak in one string.

**Files.** `src/screens/OnboardingScreen.tsx`, `src/data/sampleStatements.ts`,
`src/screens/AddFlow.tsx`, `src/screens/AttachScreen.tsx`, `src/state/store.tsx` (demo flag and
one-tap clear).

**Done when.** A fresh install reaches a completed scan reveal in under 60 seconds using only the
bundled sample (no network call, no real screenshot needed yet), the demo state is unmistakable,
and one tap removes it.

---

### Step 9. Guardrails, budget, and the review gate

**Goal.** Stop Step 10 from being "add three more mechanics".

**Why.** §2.7. The S-curve bends down, and `ui-design-plan.md` §1 already documented that Pip's
native failure mode is stacking things nobody removes.

**Build.**

1. **The engagement budget, as a rule with a number.** Extending the discipline already proven in
   this repo by `tools/contrastAudit/audit.js` and `tools/typeAudit/audit.js`:

   > **At most two engagement mechanics may be visible on any one screen at any one time.**

   Home's two are the **week ring** and the **hero number**. That is the budget, spent. A new
   mechanic on Home displaces an existing one; it does not join it.

2. **The valence check, as a review question.** Every new engagement surface answers, in its PR:
   *Does this reward looking, or does it judge the finances?* If it judges, it does not ship. This
   is §1 made into a gate rather than a principle.

3. **Motion audit extension.** `tools/typeAudit/audit.js` already fails the build on a raw
   `fontSize` outside `ui.tsx`. Extend it, or add a sibling, to fail on:
   - an animation `duration` literal not drawn from `motion.ts`
   - an `Animated.loop` with no `useReducedMotion` guard in the same file

   Same allowlist pattern as the existing audits, so every exception is visible and countable.

4. **Instrument before believing.** Local-only counters, nothing leaves the device (the privacy
   pillar in `business-plan.md` §3 and `ui-design-plan.md` §5 governs this absolutely):
   - days from install to first completed scan
   - scans per active week
   - week rings closed
   - auto-fill rate over time
   - notification open rate by class (routine vs save)

   These exist to *kill* mechanics that do not earn their screen space, not just to celebrate the
   ones that do.

**Files.** `tools/typeAudit/audit.js` (or a new `tools/motionAudit/`), `docs/ui-engagement-plan.md`
(this file, as the reviewer's checklist), `src/lib/` local counters.

**Done when.** The budget rule is enforceable in review, the motion audit runs in CI beside the
other two, and there is a local number for every claim this document makes.

---

## 5. Sequencing

| Step | Effort | Leverage | Depends on |
|---|---|---|---|
| 1 Motion + haptics foundation | S | enabling | none |
| 2 Rebuild the peak | M | **highest** | 1 |
| 3 Pip reacts | M | **high** | 1 |
| 4 Week ring + streak agency | M | high | 1 |
| 5 Competence feedback | M | medium | none |
| 6 Voice | S | medium | none |
| 7 Notification architecture | M | medium | 6 |
| 8 First 60 seconds | L | **highest at the funnel** | 2 |
| 9 Guardrails | S | protective | 1 |

If only three ship: **1, 2, 3.** Foundation, then the peak, then the face that reacts to it.
That is the Duolingo mechanism (§2.1) applied to the moment Pip already owns (§2.5).

If a fourth: **8**, because everything above it only matters for users who survive session one.

---

## 6. Interaction with `ui-design-plan.md`

The type migration in `ui-design-plan.md` §4 is 507 call sites across 25 screens and is the
largest piece of work either document describes. Two collisions worth stating now:

- **Step 2 depends on `<Display>` existing on Saved.** `SavedScreen.tsx` should be migrated to the
  type scale as part of Step 2 rather than waiting its turn in the queue, since the payoff
  typography *is* the step.
- **Step 4 replaces `StreakCard` wholesale.** Do not spend a migration commit on the current
  streak card; migrate the ring when it lands. The other 23 screens are unaffected.

Everything else in this document composes cleanly with that migration.

---

## 7. Risks

- **Voice is unwritten and this document does not write it.** §6 gives the dosing table and the
  rotation requirement. The actual strings are a copywriting pass, and `business-plan.md` §4's
  half-life caveat applies to every one of them.
- **The demo-scan first run (Step 8) can go badly wrong if the labelling is weak.** A user who
  thinks demo rows are their real records loses trust permanently, and trust is the entire
  positioning. If the labelling cannot be made unmistakable, Step 8 does not ship.
- **Haptics are a battery and annoyance surface.** The Settings toggle from Step 1 is not
  optional, and haptics fire on payoffs and commits, never on scroll or navigation.
- **Nothing here changes the privacy position.** `ui-design-plan.md` §5 stands unchanged:
  screenshots are still transmitted to a third party, the disclosure is still owed, and the
  privacy policy is still a hard Play Store blocker. **No engagement work substitutes for that,
  and no step above should be prioritised over it.**
- **Every number in §2 is someone else's.** They justify a direction, not an outcome. Step 9's
  local instrumentation exists because Pip's own numbers are the only ones that can validate any
  of this.

---

## 8. Declined, with reasons

Recorded so nobody re-opens them by accident.

| Mechanic | Why not |
|---|---|
| **Points, badges, achievements** | §2.2. LinkedIn retired gold Top Voice badges in Oct 2024; Foursquare stripped the badges that built it. Badges raise engagement with the system and lower it with the material. Step 5 is the replacement. |
| **Leaderboards, social feed, friends** | §2.6. Winnability is the predictor, and a global money leaderboard is unwinnable *and* a privacy catastrophe for an app whose pillar is "no account, no cloud". Self-comparison is the winnable version. |
| **Purchasable streak freezes / any anxiety IAP** | §2.3. Monetising streak anxiety works short-term and is described by users as manipulative. Step 4's freeze is earned monthly and never sold. |
| **Loot boxes, mystery rewards, rarity tiers** | §2.5. The variance in Pip's reveal is real (1 line or 40). Manufactured variance in a budgeting app is a slot machine. |
| **Rive / Lottie runtime** | Step 3. A native dependency and an asset pipeline to animate six circles and two paths. `react-native-svg` already does it. |
| **Reanimated migration** | Step 1. Benchmarks show no meaningful gap at Pip's scale, and Pip has no gesture-driven animation. |
| **Guilt notifications about amounts** | §1 and Step 7. This is the ostrich effect's ignition switch, and it is the single fastest way to make a finance app uninstallable. |
| **Levels, XP, avatar progression** | §2.7. Habitica's finding was that every participant hit counterproductive effects, most often being punished by the game layer during their most productive periods. |

---

## 9. Sources

**Emotional design and character animation**
- [Duolingo case study, LottieFiles](https://lottiefiles.com/case-studies/duolingo). the 2022 animation system, state machine, lip-sync
- [The Duolingo Effect: Mascots Drive +40% Engagement](https://ziggle.art/the-duolingo-effect). 5-to-10-state threshold, parasocial framing
- [Duolingo's Habit-Forming Reminders: A UX Breakdown, Digia](https://www.digia.tech/post/duolingo-habit-forming-reminders-retention-architecture/). behaviour-inferred timing, routine vs save, 2/day cap, +5% DAU from character sender, +40% on 7-day streaks
- [How Does Duolingo Integrate Emotional Design (PDF)](https://francis-press.com/uploads/papers/fLOKyZsNCeymAF2NmWktDXHkh3OYG2DJGaApTr7k.pdf). Norman's three levels applied

**Completion drive**
- [A Large-Scale Observational Study of the Causal Effects of a Behavioral Health Nudge, Apple ML Research](https://machinelearning.apple.com/research/large-scale-observational). 160,000+ participants, stand nudge raises standing probability up to 49.5%, 60%+ for ages 75+, nearly triples among ring-closers
- [Get active with Apple Watch, Apple Newsroom (2025)](https://www.apple.com/newsroom/2025/04/get-active-with-apple-watch/). 140,000+ participants on ring closure and health outcomes
- [The Psychology of Apple Watch's "Close Your Rings", Trophy](https://trophy.so/blog/the-psychology-of-apple-watchs-close-your-rings). Gestalt closure, 24-hour reset, three-goal decomposition

**Streaks**
- [Streak Design: Motivation Without Burnout, Yu-kai Chou](https://yukaichou.com/gamification-analysis/streak-design-gamification-motivation-burnout/). the 1-7 / 8-30 / 31+ phase model, earned-not-purchased protection, graduation at day 30-60, grace period from day one
- [Master the Art of Streak Design, Yu-kai Chou](https://yukaichou.com/gamification-study/master-the-art-of-streak-design-for-short-term-engagement-and-long-term-success/)
- [Streaks and Milestones for Gamification in Mobile Apps, Plotline](https://www.plotline.so/blog/streaks-for-gamification-in-mobile-apps). the 2.3x figure
- [From immersion to burnout: anxiety mechanisms in gamified health education, PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12913498/)

**Points, badges, leaderboards**
- [Points, Badges & Leaderboards: The PBL Gamification Fallacy, Yu-kai Chou](https://yukaichou.com/gamification-study/points-badges-and-leaderboards-the-gamification-fallacy/)
- [LinkedIn Removes Its Top Voice Badges, Social Media Today](https://www.socialmediatoday.com/news/linkedins-removing-top-voice-badges-collaborative-articles/728247/). retired Oct 2024
- [Why Foursquare Failed, Yu-kai Chou](https://yukaichou.com/behavioral-analysis/why-foursquare-failed-hint-the-same-reason-as-pokemon-go/)

**Motivation theory and overload**
- [Gamification enhances intrinsic motivation, autonomy and relatedness, but minimal impact on competency: meta-analysis, Springer](https://link.springer.com/article/10.1007/s11423-023-10337-7). 35 interventions, ~2500 participants, small overall effect; autonomy and relatedness carry it
- [Counterproductive effects of gamification: Habitica, IJHCS](https://www.sciencedirect.com/science/article/abs/pii/S1071581918305135). all participants affected; perceived inappropriateness predicts motivation collapse
- [Gamification-induced feelings and continued mHealth use, SDT model, PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8391751/)

**Winnable competition**
- [Strava Segmented Leaderboards, Trophy](https://trophy.so/blog/how-strava-uses-segmented-leaderboards-to-drive-engagement). local decomposition, social comparison against similar others
- [Kudos make you run! Runners' influence on Strava, ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0378873322000909). social support effects, and the distress counter-finding

**Financial psychology (the §1 constraint)**
- [The Ostrich Effect, Darden Ideas to Action](https://ideas.darden.virginia.edu/behavior-ostrich-effect)
- [Financial Avoidance: Why People Avoid Looking at Their Money, Simply Psychology](https://www.simplypsychology.com/articles/financial-avoidance-psychology)
- [Overcoming Money Avoidance, Simply Psychology](https://www.simplypsychology.com/articles/money-avoidance-anxiety-strategies). graduated exposure, self-compassion, separating gathering from acting
- [Why People Quit Budgeting Apps in 30 Days, SpendTrak](https://spendtrak.app/blog/why-people-quit-budgeting-apps). shame activation on budget-vs-actual
- [Dopamine Banking, UXDA](https://theuxda.com/blog/rise-dopamine-banking-how-fintechs-and-neobanks-are-redefining-customer-experience)
- [Designing for Financial Behavior, Eleven Space](https://www.elevenspace.co/blog/designing-for-financial-behavior-ux-that-builds-better-money-habits)

**Motion, haptics, accessibility, performance**
- [Executing UX Animations: Duration and Motion Characteristics, NN/g](https://www.nngroup.com/articles/animation-duration/). 100-300ms, up to 500ms for complex
- [Easing and duration, Material Design 3](https://m3.material.io/styles/motion/easing-and-duration)
- [Accessibility Animation: Designing Motion for Inclusion](https://educationalvoice.co.uk/accessibility-animation/). ~35% benefit from reduced motion
- [The real cost of React Native animations: benchmarking every approach, Expo](https://expo.dev/blog/the-real-cost-of-react-native-animations-benchmarking-every-approach). RN Animated 3.32ms vs Reanimated 3.72ms (iOS, 100 views, release); debug builds mislead
- [Animation, Expo Documentation](https://docs.expo.dev/develop/user-interface/animation/)

**Onboarding and the funnel**
- [App Onboarding Flow Benchmarks: Where Users Drop Off in 2026, SEM Nexus](https://semnexus.com/app-onboarding-flow-benchmarks-where-users-drop-off-2026). 70-80% lost in three days
- [2026 Customer Onboarding Benchmark Report, Perspective AI](https://getperspective.ai/blog/2026-customer-onboarding-benchmark-activation-rates-by-industry). fintech activation, value gated behind verification
- [Time to Value: 2026 Onboarding Metrics Framework](https://www.digitalapplied.com/blog/customer-onboarding-time-to-value-2026-saas-metrics-framework). 60-90 second first-value target

**Peak-end**
- [Peak-End Rule: The Kahneman Bias That Distorts Memory, Yu-kai Chou](https://yukaichou.com/behavioral-analysis/peak-end-rule-kahneman-experience-design/)

**Fintech voice precedent (via `business-plan.md` §4)**
- [Meet Cleo, the AI finance app that captivated Gen Z](https://www.gventures.co/post/meet-cleo-the-ai-finance-app-that-captivated-gen-z). Roast Mode, 500,000+ shares
- [Duolingo gets massive TikTok following thanks to passive-aggressive owl](https://www.marketingmag.com.au/news/duolingo-gets-massive-tiktok-following-thanks-to-passive-aggressive-owl/). 41% DAU/MAU

**Primary source for this document's brief**
- `~/Downloads/App Design_ Emotion, Psychology, Gamification.md`, summarising Tim Gabe's
  [The Secret Behind Weirdly Addictive Apps](https://www.youtube.com/watch?v=Du2lkZ_cux8) and
  [I Studied 500+ Gamified Apps](https://www.youtube.com/watch?v=LXX_qOA5D8E). Claims in that
  summary were checked against primary sources before use; the one correction found is noted in
  §2.2 (the 49.5% figure belongs to the stand nudge, not to ring closure).
