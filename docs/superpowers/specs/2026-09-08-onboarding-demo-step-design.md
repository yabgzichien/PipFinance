# Onboarding demo step: scan reveal → split → share preview

Status: approved in chat 2026-09-08, spec pending user review before implementation.

## 1. Context

`docs/ui-engagement-plan.md` Step 8 ("Value in the first 60 seconds") has been the
highest-leverage unshipped item in the funnel since it was written. It calls the
current cold-start wizard the biggest churn risk in the app and prescribes a
bundled-sample demo scan so a fresh install reaches the peak moment without
supplying a screenshot of their own.

The 2026-08-21 setup-wizard spec knowingly took the opposite bet (a guided
multi-step wizard, every step individually skippable). This spec does not
overturn that bet. It adds one step inside the existing wizard rather than
replacing it, so the two can coexist and the demo can be switched off without
touching the flow that ships today.

The demo machinery Step 8 assumed is partly built already but wired elsewhere:
`SAMPLE_STATEMENTS` and `AttachScreen`'s `showSamples` prop feed the *tour's*
scan mission (`AddFlow.tsx`, `tutorialMode === 'scan'`), which runs after
onboarding, not during it.

### External evidence behind the shape

Researched 2026-09-08. Directional, not measured against Pip's own users — this
app ships no behavioural analytics (`src/state/store.tsx`, `diagnosticsEnabled`),
so there is no funnel data to check any of it against.

- Onboarding completion falls steeply with step count: ~73% median at 1-2 steps,
  38% at 3-5, 25% at 6-8, 8% at 9+.
- Finance apps retain ~26% at day 1 and ~4.5% at day 30; onboarding is the
  single highest-leverage lever on that curve.
- Apps that reach a core value action in session one see 2-3x better day-7
  retention.

## 2. Decisions taken

Four questions were settled before design:

1. **Placement** — a new step inside the existing wizard, not a parallel flow.
2. **Scope** — full beat sheet in v1: scan reveal, bill split, share preview.
3. **Persistence** — **ephemeral**. The demo never writes to the database.
4. **Act 1** — skipped. No scanning narration, no elapsed-time line.

Decisions 3 and 4 together collapse the case for reusing `ExtractScreen` and
`SavedScreen`: with nothing to save and no wait to narrate, reuse would mean
adding bypass props to production screens so they skip the work they exist to
do. The demo therefore reuses *primitives* (`Pip`, the type scale, `FadeIn`,
`motion.ts` tokens) and the real *arithmetic* (`computeSplit`,
`workingsFromReceipt`, `buildGroupMessage`), but renders its own presentation.

**Consequence: no file in the live capture path is modified.** `ExtractScreen`,
`SavedScreen`, `AttachScreen` and `AddFlow` are untouched.

## 3. Ephemerality, and why it is the safer bet

`ui-engagement-plan.md` §7 lists the demo's labelling as a ship/no-ship gate:
a user who mistakes demo rows for their own records loses trust permanently,
and trust is the whole positioning. Step 8 assumed seeded rows tagged as demo
plus a persistent "Demo data · Clear" banner.

Rendering the demo from an in-memory fixture removes that gate rather than
satisfying it. There is nothing to mislabel, nothing to clear, no demo flag in
the schema, and Home stays honestly empty. The cost is the "my Home already has
something in it" feeling, which is paid back immediately by handing the user
into a real capture.

## 4. The sample

One sample, not four. The demo is a single continuous story — scan, split,
share — and the three bundled statements (`tng`, `mae`, `grab`) are lists of
spending lines with no itemisation to split. They stay where they are, serving
the tour's scan mission.

`assets/demo/receipts/` already holds three generated receipts (Decathlon,
Gleneagles, Popular Bookstore), all chosen for LHDN tax-relief categories. None
is a shared meal, so none supports a split.

**New asset:** a restaurant bill, authored as an SVG template in
`tools/generate_synthetic_receipts.py` beside the existing three and rendered
through `cairosvg` (2.9.0, verified present).

**Merchant name is fictional.** The existing receipts use real brands, which is
defensible for internal tax fixtures but not for an asset shown to every new
install. The demo bill is issued by **"Restoran Sebelas"**, an invented name.

### The bill

Line items (subtotal derived, not asserted):

| Item | Amount (RM) |
|---|---|
| Nasi Goreng Kampung | 14.90 |
| Ayam Masak Merah | 18.50 |
| Sotong Goreng Tepung | 22.00 |
| Teh Tarik × 3 | 9.00 |
| Air Sirap Limau | 4.50 |

Surcharges are `DEFAULT_SURCHARGES` (10% service charge, 6% SST) — the shipped
constant, not a copy. **The gross is computed by `computeBillTotal(lines,
DEFAULT_SURCHARGES)` at module load, never hardcoded.** If the surcharge
defaults ever change, the fixture follows them instead of silently disagreeing
with the rest of the app.

Split: `method: 'equal'`, `includeSelf: true`, three participants — the user plus
**Aisyah** and **Wei Jie**. `SplitResult` guarantees
`ownShare + Σ owed === gross`.

Itemised per-person assignment — the differentiator named in the business plan —
is **not** interactive in v1. It surfaces instead as the workings block
(`workingsFromReceipt`) inside the share message, which is where a friend
actually reads it. Interactive itemisation is a follow-up.

## 5. The step

A single `WizardStep` holding a four-beat internal state machine. The wizard's
own progress track sees one step; the beats are internal.

| Beat | What renders |
|---|---|
| `offer` | Pip, headline, one tappable receipt card. Nothing runs until the tap. |
| `reveal` | Receipt thumbnail, count easing 0→N, `<Display>` hero, staged `FadeIn` rows, `haptics.payoff()` |
| `split` | Three rows from a real `computeSplit` call, with the service/SST workings shown |
| `share` | Real `buildGroupMessage()` output rendered as static text |

Then `onNext()` into the rest of the wizard.

**No elapsed-time line anywhere.** `ExtractScreen`'s contract already ties "Read
in Ns" to a real measurement (`elapsedMs`, null when reviewing cached results).
There is no measurement here, so the line does not appear. Nothing is
fabricated, and no new copy variant is needed.

**The tap is load-bearing.** `src/data/sampleStatements.ts` documents the
invariant that "the app never injects an image on its own." The `offer` beat
preserves it: one card, user-initiated.

### Hard constraint on the share beat

The share card renders **text only**. It must not import `src/lib/shareText.ts`,
must not open a share sheet, and must offer no send affordance. A user who
could forward a fabricated RM-80 dinner split to a real contact is a trust
event that cannot be walked back. Real sharing stays on real data.

## 6. Revert

`src/config/onboardingFlags.ts` (new; the repo has no flags module today, and
`EXPO_PUBLIC_*` is reserved for API keys) exports a single build-time constant:

```ts
export const DEMO_STEP_ENABLED = true;
```

`onboardingNav.ts` includes `'demo'` in the step table only when the flag is
set, so progress percentages and back-navigation recompute automatically.
`OnboardingScreen.tsx` gains one render branch and keeps its other five
unchanged.

Setting the flag to `false` restores exactly today's flow. Nothing else needs
reverting, because nothing else changes.

## 7. Files

| File | Change |
|---|---|
| `tools/generate_synthetic_receipts.py` | + restaurant SVG template |
| `assets/demo/receipts/*.png` | + generated bill |
| `src/config/onboardingFlags.ts` | new — `DEMO_STEP_ENABLED` |
| `src/data/demoReceipt.ts` | new — line items, participants, derived gross |
| `src/screens/onboarding/DemoStep.tsx` | new — the step |
| `src/lib/onboardingNav.ts` | + `'demo'` in `WizardStep`, flag-gated |
| `src/screens/OnboardingScreen.tsx` | + one render branch |
| `src/i18n/translations/{en,zh}.ts`, `src/i18n/types.ts` | + strings |
| `__tests__/demoReceipt.test.ts` | new |

## 8. Testing

Unit (TDD, written first) on the pure half:

- `computeSplit` over the fixture reconciles: `ownShare + Σ owed === gross`.
- **The gross is pinned to a literal expected ringgit value.** Since §4 derives
  the fixture's gross by *calling* `computeBillTotal`, asserting it equals that
  same call would be tautological. The test instead pins the number the demo is
  designed around, so a change to `DEFAULT_SURCHARGES` fails loudly and forces
  someone to re-check the demo rather than silently altering what every new user
  sees. The literal is established by running the real function when the test is
  first written, not guessed here.
- `buildGroupMessage` over the fixture produces a workings block and per-person
  lines that sum to gross, per that file's stated invariant.

The screen itself gets a browser-preview verification pass rather than a unit
test, matching how the other wizard steps are covered. Note the known local
caveat: React Native Web modals do not unmount in the web preview, so beat
transitions are verified via rendered state, not unmount.

Not verifiable in this environment: haptics, and the rendered PNG's appearance
on a real device.

## 9. Out of scope

- Interactive itemised per-person assignment (v1 shows workings, not assignment).
- Wiring the three bundled statements into the demo step.
- The rest of Flow E: merging the notifications and widget steps, deferring
  Budget, and the "Finish setting up Pip" Home checklist.
- Any change to `ExtractScreen`, `SavedScreen`, `AttachScreen`, or `AddFlow`.
- Local funnel counters (`ui-engagement-plan.md` §9), so this ships unmeasured
  against Pip's own users by explicit choice.
