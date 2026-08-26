# Handoff: `release/play-store` branch

Read this before touching code on this branch. It orients any agent (or human)
picking up the work cold.

## What this branch is for

Ship **Pip**, the financial tracker half of this project, to the Google Play
Store. Pip was originally built as one half of a lending-competition demo
("Pip Credit" — MAIC Nexus 2026, Track T3). It grew a credit-scoring / loan /
KYC feature set bolted onto a genuinely solid personal-finance tracker. None
of the lending side can ship: it's a demo (mocked bureau checks, mocked eKYC,
mocked fraud model) and shipping it publicly is a liability, not a feature.

The job on this branch is to remove the lending/credit/KYC feature set
entirely and ship the tracker on its own.

## Critical: this is a two-app monorepo

`/home/yang/Project/PipComp-playstore` is a git worktree with **two
independent apps** at its root:

- `PipComp/` — this app. Expo/React Native mobile app. **This is the only
  thing being worked on for this branch.**
- `LenderConsole/` — a separate Next.js web app (the "lender" side of the
  original demo), its own deploy on Vercel, its own `package.json`. It is
  **not bundled into the Expo build** and needs zero code changes for this
  work.

**Do not touch `LenderConsole/`.** It stays running, untouched, as its own
deployment — it's simply out of scope. The two apps only ever talked to each
other over one HTTP surface (`LENDER_API_BASE`, defaulting to
`localhost:3000`, see `src/lib/lenderDirectory.ts`), and the direction of
this work is to make `PipComp/` stop calling it, not to change it.

The top-level repo `README.md` (one level above `PipComp/`) describes both
apps and is out of scope too — it isn't shipped.

Everything below refers to paths relative to `PipComp/` unless stated
otherwise.

## Architecture facts worth knowing before editing

- **No router.** `App.tsx` is a hand-rolled screen state machine: one
  `type Screen = '...' | '...'` union (line 62) and one giant
  `{screen === 'x' && <XScreen/>}` switch. There's no `@react-navigation`.
- **One shared state context.** `src/state/store.tsx` (~2000 lines) is a
  single `AppDataProvider` holding *all* app state — tracker fields and
  credit/loan/KYC fields interleaved in the same `useState` blocks and the
  same set of callbacks. All screens read it via `useAppData()`.
- **One shared SQLite schema.** `src/db/db.ts` has one `getDb()`/migration
  function with tracker tables and credit/loan/KYC tables (`kyc`,
  `occupation`, `loan_products`, `loan_applications`, `repayments`) defined
  side by side.
- **No auth, no backend for the tracker.** Everything is local (`expo-sqlite`).
  The only backend calls at all are (a) Groq/Gemini for receipt-scan vision
  extraction, called directly from the client, and (b) the lending flows'
  calls to `LenderConsole`'s API. Removing lending removes (b) entirely.
- **Dependency direction is one-way.** The credit engine *reads* tracker data
  (transactions, accounts, balances) to compute a score; the tracker never
  reads anything from the credit/loan/KYC code. This is why the removal is
  tractable — tracker screens (Budget, NetWorth, Commitments, Owed, Split,
  Export, Calendar, Import, receipt scan) don't import credit/loan/KYC code,
  with one trivial exception (`ExportScreen.tsx` reads `kyc.fullName` purely
  as a display-name fallback).
- **The onboarding flow *is* the lending pitch**, not just gated behind it —
  title "Pip Credit," three lending-outcome demo personas, and the primary
  CTA launches a 10-act guided tour that spans both apps
  (`src/lib/tourSteps.ts` documents this explicitly). This needs a rewrite,
  not a deletion, and it's the one place a plain "delete the file" pass
  doesn't work.
- **Zero existing feature flags.** There's no compile-time or run-time switch
  to hide the lending half — it's all unconditionally reachable today.
  Removal means actually deleting code, not flipping a flag.

## Decisions already made (do not re-litigate these)

These came out of an explicit interview with the project owner
(zichienyang@gmail.com) before any code was touched. Treat them as settled:

- **Full removal, not a feature flag.** Legal/liability reasons — no plan to
  keep lending code dormant in this app.
- **No backend/PII cleanup needed.** All KYC/credit data during the
  competition was local/mock only; nothing sensitive at rest to worry about.
- **App identity needs no rename.** `app.json` already has `expo.name: "Pip"`
  and Android package `com.yabg.pipexpensestracker` — both already
  tracker-branded, not "Pip Credit" branded. No package-id migration needed.
  (The Google Play Console listing is also fresh — nothing published yet
  under any name.)
- **4th bottom-nav tab** (replacing the deleted "Loan" tab) →
  **Net Worth / Assets & Liabilities**. `NetWorthScreen.tsx` already exists
  and is already a tracker screen — this is a nav-wiring change, not new
  feature work.
- **Onboarding** → gets a **new guided tour of the real tracker features**
  (receipt scan, net worth, split bills, commitments), replacing the lending
  demo tour. This is a content/design task, scoped separately from the
  mechanical deletion pass (see `plan.md`).
- **Differentiators to build the pitch around**: AI receipt/e-wallet scan,
  assets & liabilities / net worth ("financial freedom" framing), split
  bills, recurring commitments. Also worth surfacing: the existing
  savings-streak habit tracker (`StreakWidget`) — a genuine differentiator
  versus generic Mint/YNAB-style trackers, not something to build from
  scratch. (The Belanjawanku national-reference-budget benchmark that used to
  sit alongside it was removed on 2026-08-22 at the owner's request; don't
  reintroduce it as a "differentiator" without asking.)
- **Deferred, not in scope for this branch's cleanup work**: the Groq/Gemini
  API keys for receipt scanning are called directly from the client
  (`expo-secure-store`), which means a shipped APK's embedded key is
  extractable. The project owner is aware and wants this flagged for a later
  pass, not solved now — don't block the Play Store submission on it, but
  don't let a future agent think it's been handled either.

## Where to find the actual removal plan

`plan.md` (same directory) is the ordered, file-by-file execution plan for
**Stage 1** of the cleanup: cutting all lending/credit/KYC code and getting
back to a compiling, functional, lending-free tracker app. It does **not**
cover the onboarding redesign, permission-copy/marketing polish, or the API
key issue above — those are explicitly out of scope for Stage 1 and should be
scoped as their own follow-up work once Stage 1 lands.

## Verification expectations

Per the project owner: **both** a static pass (grep sweep for dangling
imports/references after deletion, typecheck) **and** a manual run-through in
a running instance (launch the app, click through every remaining screen,
confirm no crashes / no dead nav targets) before calling any stage done.
Don't rely on the test suite alone — plenty of tests reference the
lending/demo code and need to be triaged (see `plan.md`), and passing tests
don't substitute for actually running the app per this project's standing
rule on UI changes.

## Style note

No em dashes in any user-facing copy (onboarding text, settings copy, error
messages, etc.) — house style for this project.
