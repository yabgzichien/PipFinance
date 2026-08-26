# Stage 1 plan: strip lending/credit/KYC, stabilize the tracker

Read `handoff.md` first for context and the decisions this plan assumes.

## Definition of done for Stage 1

- No credit scoring, loan marketplace, "build my score" coach, Credit
  Passport, eKYC, fraud/attack-gallery, or guided-tour-of-the-lending-demo
  code remains in `PipComp/`.
- The app **compiles, typechecks, and runs** as a pure tracker: Home,
  Activity, Net Worth, Settings tabs, plus the existing add/import/receipt
  flows, budget, commitments, split bills, owed, calendar, export.
- Onboarding no longer references lending at all, even if its replacement is
  a minimal stub rather than the final redesigned tour (that's Stage 2).
- No dangling imports, no dead nav targets, no leftover references to
  deleted modules anywhere (screens, store, db, settings copy, app.json).

## Explicitly NOT in scope for Stage 1 (do not do these now)

- Designing/building the new onboarding guided tour of real tracker features
  — Stage 1 only needs onboarding to *not reference lending* and to reach the
  tracker; a minimal "get started" stub is correct here, not the final
  experience.
- Rewriting marketing/differentiator copy (belanjawanku benchmark framing,
  "financial freedom" positioning, etc.).
- Fixing the client-side LLM API key exposure.
- Anything in `LenderConsole/` or the top-level repo `README.md`.
- Cosmetic/UI polish beyond what's needed to remove dead UI.

## Before starting

Working tree should be clean before this pass (check `git status`). This is
a large mechanical change touching a shared state file and a shared DB
schema — commit in small, reviewable chunks (e.g. one commit per phase
below) rather than one giant diff, so a bad step is easy to isolate and
revert.

---

## Phase A — Cut entry points first

Do this before deleting anything, so nothing in the app can navigate to a
screen that's about to disappear.

1. `App.tsx`
   - Trim the `Screen` union (currently line 62) down to tracker-only values.
     Remove: `credit`, `loans`, `passport`, `coach`, `attacks`, `kyc`.
     (Keep `networth` — already a tracker screen.)
   - Remove the corresponding `{screen === 'credit' && ...}` /
     `'loans'` / `'passport'` / `'coach'` / `'attacks'` / `'kyc'` branches
     from the screen switch.
   - Remove the `<ClearedLoanBanner/>` mount (it's global, not per-screen —
     search the file for `ClearedLoanBanner`).
   - Remove any `startTour`/tour-related wiring reachable from here.
2. `src/components/BottomNav.tsx`
   - Change `NavTab` (line 9) from
     `'home' | 'activity' | 'loan' | 'settings'` to
     `'home' | 'activity' | 'networth' | 'settings'`.
   - Update the `TABS` array (around line 36) to swap the `loan` entry for a
     `networth` entry (icon, label — "Net Worth" or similar).
   - Update wherever `BottomNav`'s `onNavigate` is wired in `App.tsx` so the
     new `networth` tab key maps to the existing `networth` screen state.
3. `src/screens/DashboardScreen.tsx`
   - Remove the `useCreditProfile` import/call and the `CreditCompactCard`
     render.
   - Remove the "Credit" / "Passport" quick-action buttons.
   - Remove the `useLenderSyncPoll()` call — this is what makes Home poll the
     external LenderConsole server every 8 seconds; it must go, not just stop
     being visible.

Typecheck after this phase — expect errors pointing at the files Phase B
deletes. That's expected; proceed to Phase B.

---

## Phase B — Delete dead files

These are self-contained (no tracker code imports them, confirmed during the
audit) except where noted. Delete the whole file/folder.

**Screens** (`src/screens/`):
`CreditScreen.tsx`, `LoansScreen.tsx`, `PassportScreen.tsx`,
`PassportCoachScreen.tsx`, `PassportCeremonyScreen.tsx`, `KycScreen.tsx`,
`DocumentScanScreen.tsx`, `AttackGalleryScreen.tsx`

**Lib** (`src/lib/`):
`acceptOffer.ts`, `assembleCredit.ts`, `attackGallery.ts`, `attackReveal.ts`,
`borrowingLimit.ts`, `coachPlan.ts`, `consentScopes.ts`, `coverage.ts`,
`creditScore.ts`, `dataConfidence.ts`, `directApply.ts`, `ekyc.ts`,
`fraudFeatures.ts`, `fraudModel.ts`, `fraudModelWeights.json`,
`incomeBaseline.ts`, `incomeFloor.ts`, `incomeQuality.ts`, `institutions.ts`,
`lenderCriteria.ts`, `lenderDirectory.ts`, `lenderOutcome.ts`,
`loanPurpose.ts`, `loanSummary.ts`, `loans.ts`, `mergeServicing.ts`,
`momentum.ts`, `obligations.ts`, `offers.ts`, `passport.ts`,
`repaymentStanding.ts`, `servicingSync.ts`, `spendingProfile.ts`,
`verdictStyle.ts`, `tourAnchorRect.ts`, `tourDrive.ts`, `tourSignals.ts`,
`tourSteps.ts`

> Double-check `institutions.ts` and `spendingProfile.ts` before deleting —
> names are generic enough that it's worth a quick grep
> (`grep -rn "from.*institutions'" src/` etc.) to confirm nothing in the
> tracker half imports them, since the audit classified them as
> credit-only but didn't quote line-level proof for these two specifically.

**DB** (`src/db/`): `kycRepo.ts`, `loansRepo.ts`, `occupationRepo.ts`

**State** (`src/state/`): `useCreditProfile.ts`, `useLenderSyncPoll.ts`

**Crypto** (`src/crypto/`): `issuer.ts`, `keys.ts`

**eKYC** (`src/ekyc/`): `mock.ts`, `scan.ts`, `types.ts` (delete the whole
`src/ekyc/` folder)

**LLM prompts** (`src/llm/`): `attackPrompt.ts`, `coachPrompt.ts`,
`ekycPrompt.ts`

**Components** (`src/components/`): `CreditGauge.tsx`, `ScoreBandBar.tsx`,
`LenderRequirements.tsx`, `ClearedLoanBanner.tsx`, `TourAnchor.tsx`,
`TourCard.tsx`, `TourSpotlight.tsx`

**Data** (`src/data/`): `demoPersonas.ts`, `demoProfile.ts`, `demoSeed.ts`,
`issuerKey.example.ts`

**Tools** (`tools/`, whole folders): `fraudData/`, `fraudModel/`,
`fraudRealData/`, `demoPassport/`, `issuerKey/`

**Assets**: `assets/screenshots/credit-score.png`,
`assets/screenshots/passport.png`

**Tests** (`__tests__/`) — delete anything that imports a module deleted
above. By name, these are unambiguous deletes:
`assembleCredit.test.ts`, `acceptOffer.test.ts`, `attackGallery.test.ts`,
`attackPrompt.test.ts`, `attackReveal.test.ts`, `borrowingLimit.test.ts`,
`coachPlan.test.ts`, `coachPrompt.test.ts`, `consentScopes.test.ts`,
`coverage.test.ts`, `creditGauge.test.ts`, `creditScore.test.ts`,
`dataConfidence.test.ts`, `directApply.test.ts`, `ekyc.test.ts`,
`ekycPrompt.test.ts`, `fraudFeatures.test.ts`, `fraudModel.test.ts`,
`incomeBaseline.test.ts`, `incomeFloor.test.ts`, `institutions.test.ts`,
`lenderCriteria.test.ts`, `lenderDirectory.test.ts`, `lenderOutcome.test.ts`,
`loanPurpose.test.ts`, `loanSummary.test.ts`, `loans.test.ts`,
`mergeServicing.test.ts`, `momentum.test.ts`, `passport.test.ts`,
`repaymentStanding.test.ts`, `resetSync.test.ts`, `servicingSync.test.ts`,
`tourDrive.test.ts`, `tourScanDelta.test.ts`, `tourSignals.test.ts`,
`tourSteps.test.ts`

**Verify before deleting** (names don't map 1:1 to a deleted module — grep
each for imports of anything deleted above; delete if it imports dead code,
keep and update otherwise): `demoAcceptance.test.ts`,
`demoAcceptanceFaizal.test.ts`, `demoAcceptanceRavi.test.ts`,
`demoPersonaOutcomes.test.ts`, `demoProfile.test.ts`,
`belanjawankuAcceptance.test.ts`, `categoryIntegrity.test.ts`,
`copyDoubleSpaceScars.test.ts`, `paperTables.test.ts`, `perturb.test.ts`,
`richerBlocks.test.ts`, `transfers.test.ts`, `settingsStore.test.ts`.
(`Faizal`/`Ravi` are almost certainly lending demo personas — likely deletes
— but confirm by grepping rather than assuming.)

After this phase, run the typecheck/build again and re-grep the whole
`src/` tree for the name of every file just deleted (module specifiers, not
just filenames) to catch anything the audit missed. Fix Phase C below before
expecting a clean result — `store.tsx` and `db.ts` still reference deleted
modules at this point.

---

## Phase C — Strip the shared files

1. `src/state/store.tsx` (~2000 lines, single `AppDataProvider`)
   - Remove state fields: `loanProducts`, `loanApplications`, `repayments`,
     `pendingOffers`, `kyc`, `occupation`, `activeDemoProfile`, and the
     `tour*` state block.
   - Remove every callback that only exists to serve those fields (offer
     acceptance, loan application flow, KYC submission, tour step
     transitions, etc.) — grep for the deleted lib/db module names inside
     this file to find them all; don't rely on memory of which callbacks
     exist.
   - Keep everything tracker-related untouched: `categories`, `transactions`,
     `accounts`, `balanceEntries`, `people`, `splits`, `shares`,
     `commitments`, budget fields, and their callbacks.
2. `src/db/db.ts`
   - Remove the `kyc` (line ~68), `occupation` (~76), `loan_products`
     (~114), `loan_applications` (~123), and `repayments` (~132) table
     definitions. (Line numbers will have shifted by the time you do this —
     re-grep `CREATE TABLE IF NOT EXISTS` to find current positions.)
   - Check the migration/schema-version logic in this same file — removing
     tables from a `CREATE TABLE IF NOT EXISTS` block is safe for fresh
     installs, but confirm there's no version-bump/migration step elsewhere
     that expects these tables to exist on upgrade from an older schema
     version. Per `handoff.md`, there are no real external users on the
     current build, so breaking local upgrade compatibility is acceptable —
     just don't leave a migration step that crashes on the tables' absence.
3. `src/screens/ExportScreen.tsx`
   - Remove the `kyc` read from `useAppData()` and the `kyc.fullName`
     fallback; default the export display name straight to `'Pip User'` (or
     whatever the non-KYC fallback already was).
4. `src/screens/SettingsScreen.tsx`
   - Remove the "Demo profiles" section (loads `demoPersonas`/
     `activeDemoProfile` — now-deleted).
   - Remove the disclaimer copy about mocked bureau/eKYC checks (references
     a feature that no longer exists).
5. `src/components/CashflowStructure.tsx`,
   `src/components/SavingsHabitCard.tsx`
   - These have no functional coupling to credit scoring, only code
     comments that reference it (e.g. "not a credit signal... counts
     towards your score"). Update or remove those comments so they don't
     reference a feature that no longer exists.
6. `app.json`
   - Reword the `expo-camera` plugin's `cameraPermission` string — it
     currently reads "Pip needs the camera to scan your IC or passport for
     identity verification," which is purely the KYC use case. The
     receipt-scan camera use is covered by the separate `expo-image-picker`
     permission string ("attach a transaction screenshot") and doesn't need
     this one. Reword to something accurate for whatever camera use remains,
     or remove the `expo-camera` plugin entirely if nothing else in the
     tracker uses the raw camera API directly (confirm via grep for
     `expo-camera` usage outside the now-deleted KYC screens before removing
     the plugin).
   - Leave the duplicate `RECORD_AUDIO` permission entries alone — unrelated
     to this cleanup, flagged separately, not blocking.
7. `PipComp/README.md`
   - Remove the `LenderConsole`/issuer-key setup steps from the "Run it"
     instructions — they reference deleted code paths.

---

## Phase D — Minimal onboarding stub (not the final design)

`src/screens/OnboardingScreen.tsx` currently imports `demoPersonas`
(deleted in Phase B) and calls `startTour()` (deleted in Phase B), so it
will not compile once those are gone. Stage 1 only needs this to compile and
route to the tracker — the real redesigned tour is Stage 2 work per
`handoff.md`.

- Remove the `DEMO_PROFILES` list and the three lending-persona rows.
- Remove the "Take the tour" primary CTA (it drove `startTour()`, deleted).
- Change the title/subtitle away from "Pip Credit" / "Credit for people the
  system can't see." to neutral tracker copy (no em dashes — house style).
- Keep (or promote to primary) whatever currently calls `completeOnboarding()`
  directly (the de-emphasized "Start empty instead" link) so first-run still
  reaches the app.
- Don't invest in polish here — a plain, single-screen "Welcome to Pip, get
  started" is correct for Stage 1. Flag the real tour redesign as follow-up
  work rather than doing it inline.

---

## Phase E — Verification

1. **Static pass**
   - Full typecheck (`tsc --noEmit` or the project's existing script).
   - Re-grep the entire `src/`, `App.tsx`, `tools/`, and `__tests__/` tree
     for the name of every deleted module/file (import specifiers, not just
     filenames — check for `require`/dynamic imports too) to confirm nothing
     references a deleted path.
   - Grep for residual `LENDER_API_BASE` / `EXPO_PUBLIC_LENDER_API_URL`
     usage anywhere — should be zero after `lenderDirectory.ts` and its
     callers are gone.
   - Run the remaining test suite; fix or delete anything that still
     references removed code.
2. **Manual run-through** (launch the app in the emulator/device preview)
   - First run: onboarding reaches the tracker with no lending copy visible.
   - Bottom nav: Home / Activity / Net Worth / Settings all navigate
     correctly, no crash, no "Loan" tab.
   - Home screen: loads without the credit card, without triggering any
     network call to a lender console (check network logs — should be
     silent aside from LLM calls during an actual receipt scan).
   - Add flow, receipt scan, import, categorize, budget, commitments, split
     bills, owed, calendar, export, net worth — click through each, confirm
     no dead links into deleted screens and no console errors referencing
     missing modules.
   - Settings: no demo-profile section, no bureau/eKYC disclaimer text.

Stage 1 is done when both checks pass clean. Hand off to Stage 2 (onboarding
redesign, copy/marketing polish, differentiator framing, API key hardening)
as separate, explicitly scoped work — don't let it bleed into this pass.
