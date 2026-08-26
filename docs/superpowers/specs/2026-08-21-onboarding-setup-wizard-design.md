# Onboarding setup wizard + category taxonomy replacement

Status: approved, implementing directly (no separate plan doc; see brainstorming session 2026-08-21)

## 1. Context

`OnboardingScreen.tsx` is currently a single "Get started" placeholder — its own
comment already flags the real guided tour as deferred follow-up work
(`docs/ui-design-plan.md` §7). That deferred plan recommends the *opposite* of what
this spec builds: a fast, zero-data-entry demo scan to reach value in under 60
seconds (`docs/ui-engagement-plan.md` Step 8), because the current "eight-step cold
start" is called out as the highest-leverage churn risk in the funnel.

This spec knowingly takes the other bet: a 5-step guided setup (Pip intro → budget →
recurring payment → notifications → widget), reconciled with the churn concern by
making every step after the intro individually skippable. No "skip all" shortcut —
a user in a hurry skips step by step, which stays honest about what didn't get set
up rather than silently marking everything done.

This does not change `ui-design-plan.md` §7 for other readers; it supersedes it for
onboarding's actual shape going forward. Worth a follow-up doc update, not blocking
here.

## 2. Category taxonomy replacement

`EXPENSE_CATEGORIES` in `src/data/categories.ts` shrinks from 12 to 7. This follows
the exact precedent already in that file (`CATEGORY_ID_REMAP`, from the 2026-08-07
bookkeeping retune): a one-way, lossy migration table so existing transactions,
budget allocations, and learned merchant memory land on a real category instead of
a dangling id.

| New id | Label | Icon | Hue | Absorbs (old id) |
|---|---|---|---|---|
| `food` | Food | `cart` | 162 | `food`, `dining` |
| `entertainment` | Entertainment | `play` | 305 | `recreation` |
| `other` | Other Expenses | `dots` | 220 | `communications`, `healthcare`, `education`, `household`, `other` |
| `travelling` | Travelling | `fuel` | 248 | `transport` |
| `insurance` | Insurance | `shield` | 286 | `insurance` |
| `rental` | Rental | `home` | 200 | `housing` |
| `car-instalment` | Car Instalment | `car` | 355 | `debt-service` |

`food`, `other`, and `insurance` keep their existing ids (only the underlying set
or label changes); `entertainment`, `travelling`, `rental`, `car-instalment` are new
ids. Icon/hue choices reuse the old category's values where the concept carries
over, and free up `car` (previously `transport`'s icon) for `car-instalment` by
giving Travelling the otherwise-unused `fuel` icon.

Income categories (`INCOME_CATEGORIES`) are unchanged.

**Migration mechanism.** No new migration code — `db.ts`'s existing
`migrateCategoryIds` (applies `CATEGORY_ID_REMAP`) and `seedCategories` (upserts
`ALL_SEED_CATEGORIES`) already do exactly this on every app boot, idempotently.
Extending the remap table and the seed list is sufficient.

**Known, accepted breakage.** `src/lib/belanjawanku.ts` computes each benchmark
line as a sum of specific category ids (e.g. the Food line needs `food` +
`dining`). Since `dining`, `housing`, `communications`, `transport`, `healthcare`,
`education`, `household`, and `debt-service` stop existing, every benchmark line
loses some or all of its category set. Per that file's own documented contract, an
unbenchmarked category is treated as "no opinion" and never flagged over/under —
so this degrades to the guide silently having nothing to say, rather than
crashing or showing wrong numbers. Remapping the Belanjawanku baskets onto the new
7 categories is explicitly out of scope for this spec; it's a deliberate follow-up
so the remap gets designed on purpose rather than as a side effect.

## 3. Default-category delete persistence fix

Unrelated bug surfaced by this work, fixed alongside it: `ensureSeedCategories`
re-upserts every default category on **every app launch**, including ones a user
already deleted via `deleteCategory` (used today by `CategoriesScreen`, and now
also by the wizard's category management). A deleted default category currently
reappears the next time the app restarts.

Fix: a `deleted_default_categories(id TEXT PRIMARY KEY)` tombstone table.
`deleteCategory` records the id there whenever the deleted row was `is_default = 1`.
`seedCategories` skips any id present in that table when upserting
`ALL_SEED_CATEGORIES`. Custom categories are unaffected (never reseeded).

## 4. Wizard architecture

`OnboardingScreen.tsx` becomes a local 5-step state machine (`step: 0-4`), the same
pattern `BudgetWizard.tsx` already uses — not a new generic reusable "wizard shell",
since there's only one wizard and a shared abstraction would be speculative.

- Progress track (`ProgressTrack` from `ui.tsx`) + back arrow on steps 1-4.
- Every step after the intro has a **Skip** action next to its primary action.
- Skip and Next both advance `step`. No skip-all shortcut.
- Reaching the end of step 4, or skipping it, calls `completeOnboarding()` once.
- Skipped steps are never re-prompted — same as any user who's always been able to
  skip straight to an empty Home; budget/commitments/notifications/widget stay
  reachable from Settings/Budget/Commitments exactly as they are today.

## 5. Steps

**Step 1 — Pip intro.** Same content as today's screen (Pip mascot, "Know your
money." headline, mechanism copy). Button relabelled "Next" (was "Get started"). No
skip control — nothing to skip yet.

**Step 2 — Budget.** One screen: optional income input (RM; no validation gate —
"Save & continue" is always enabled), then the 7 category chips as a multi-select
grid with an inline RM amount field appearing under each selected chip. No savings-
target row, no Belanjawanku guide-fill button — both stay exclusive to the full
`BudgetWizard` reachable later from the Budget screen. Saves via the existing
`saveBudget(income, allocations)` regardless of whether income/categories were
filled in.

Category management is inline on the same screen:
- A pencil affordance on each chip opens a small inline editor: rename
  (`updateCategoryLabel`) + icon picker (`updateCategoryIcon`, same picker UI as
  `CategoriesScreen`) + Delete (`deleteCategory`; disabled on Other Expenses, the
  protected fallback bucket).
- The grid's existing "+ New" tile opens `AddCategoryModal` (same component
  `BudgetWizard` already uses).

**Step 3 — Recurring payment.** One form: label, amount, due day, category (the 7
new ones, defaulting to Other Expenses). No account linking, no investment-kind
toggle — both are `CommitmentEditorModal` features aimed at an established user
with accounts already set up, not a fresh install. "Add" saves via
`addCommitmentEntry` (kind fixed to `'expense'`) and reveals "+ Add another" /
"Continue"; "Skip for now" moves on with nothing added.

**Step 4 — Notifications.** Short explanatory copy + one primary button, "Enable
notifications," calling the existing `ensurePermission()`. On grant, sets
`reminderCadence` to `'daily'` (today's silent default is `'off'`; this is the one
place onboarding opts a user into anything, changeable in Settings same as
always). A denial shows the same inline copy Settings already uses ("Your phone is
blocking notifications…") without blocking Continue. Skip leaves cadence at
`'off'`.

**Step 5 — Widget.** Rendered on every platform, but only Android can actually pin:
there is no iOS widget target in this codebase (only `react-native-android-widget`
is configured).

- On Android: explanation + "Add widget" button calling
  `requestPinWidget({ widgetName: 'StreakWidget' })`, plus a Finish link. Since that
  call only confirms the launcher accepted the request (not that the user finished
  placing the widget), the button always leads to Finish regardless of the result.
- On iOS/web: copy that says the widget is Android-only for now, and a single Finish
  button. No "Add widget" control, because `react-native-android-widget` swaps in a
  no-op module off Android (`requestPinWidget` resolves `false`), so the button would
  look live and silently do nothing.

Either way, Finish calls `completeOnboarding()`.

*Revised 2026-08-21 (was: step auto-skipped entirely on non-Android). Skipping it
made the step unreachable in the web preview, which is where this wizard gets
reviewed, so the step now always renders and the platform difference lives inside it.
`TOTAL_STEPS` is therefore always 5.*

## 6. Data & persistence

- `EXPENSE_CATEGORIES` (7 items) + extended `CATEGORY_ID_REMAP` (7 pairs) in
  `src/data/categories.ts`.
- New `deleted_default_categories` table in `db.ts`.
- No new `AppDataProvider` methods — every step calls what already exists:
  `saveBudget`, `addCommitmentEntry`, `setReminderCadence`, `ensurePermission`,
  `completeOnboarding`, `addCategory`/`deleteCategory`/`updateCategoryLabel`/
  `updateCategoryIcon`.

## 7. Testing

- Unit: `CATEGORY_ID_REMAP` covers all 12 old ids, each mapping to one of the 7 new
  ids; tombstone behavior in `categoriesRepo` (deleted default doesn't reappear
  after a simulated reseed).
- Existing tests referencing old category ids (`recap.test.ts`,
  `recommend.test.ts`, `reminders.test.ts`, `streak.test.ts`,
  `commitmentReminders.test.ts`) updated to the new ids as part of implementation.
- Manual: fresh install through all 5 steps including every skip path, and the
  Android widget pin flow on a real device/emulator (only way to verify it).

## 8. Explicitly out of scope

- Remapping `belanjawanku.ts` benchmark lines onto the new categories (§2).
- An iOS widget (none exists in this codebase today).
- A generic reusable wizard-shell component (YAGNI — one wizard exists).
- Re-prompting for skipped steps.
