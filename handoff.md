# Developer Handoff & Architecture Guide

This document provides architectural orientation for developers and AI agents working on the Pip codebase.

---

## 1. Project Overview

**Pip** is a privacy-first, 100% on-device personal budgeting and expense tracking mobile application built with Expo (React Native), TypeScript, and local SQLite.

### Core Pillars:
- **100% On-Device & Private**: Zero user accounts, zero bank logins required. All data is persisted locally via SQLite.
- **Fast AI-Powered Capture**: Ingest e-wallet screenshots (Maybank, Touch 'n Go, GrabPay) and paper receipts via Groq/Gemini/Ollama vision models.
- **Adaptive Merchant Memory**: Remembers user category assignments across merchant names.
- **Complete Personal Balance Sheet**: Tracks daily cash flow alongside Net Worth (cash, crypto, stocks, gold, loans, liabilities).
- **Tax Relief Receipt Tracking**: Tracks eligible tax relief categories with receipt archiving.

---

## 2. Architecture & State Management

### 2.1 Screen Navigation State Machine
Pip uses a lightweight, hand-rolled screen navigation state machine in `App.tsx`:
- Screen union: `type Screen = 'dashboard' | 'activity' | 'networth' | 'settings' | 'budget' | 'commitments' | 'owed' | 'tax' | 'calendar' | 'export' | ...`
- Bottom Navigation (`src/components/BottomNav.tsx`) controls the primary tabs: **Home (Dashboard)**, **Activity (Transactions)**, **Net Worth**, and **Settings**, plus a floating center **Add (+)** action.

### 2.2 Central State (`src/state/store.tsx`)
The entire application state is managed by `AppDataProvider` in `src/state/store.tsx`:
- Supplies reactive data (`transactions`, `accounts`, `categories`, `commitments`, `splits`, `budgetAllocations`) via `useAppData()`.
- Exposes synchronous and asynchronous actions (`addTransaction`, `updateTransaction`, `deleteTransaction`, `payCommitment`, `settleShare`, `updateBudget`, etc.).

### 2.3 Persistence Layer (`src/db/`)
- SQLite database initialized in `src/db/db.ts` with schema migrations (`getDb()`).
- Repository modules encapsulate CRUD operations:
  - `txnRepo.ts`: Transactions and line items
  - `accountsRepo.ts`: Asset and liability balance entries & holdings
  - `budgetRepo.ts`: Monthly budget envelopes and allocations
  - `categoriesRepo.ts`: Category definitions and mappings
  - `commitmentsRepo.ts`: Recurring bills, subscriptions, and DCA rules
  - `reliefRepo.ts`: Tax relief tags and evidence
  - `splitRepo.ts`: Bill splits and receivables
  - `memoryRepo.ts`: Merchant-to-category learning memory

---

## 3. Key Modules & Subsystems

| Subsystem | Key Files | Description |
|---|---|---|
| **Vision / AI OCR** | `src/llm/`, `src/lib/parseReceipt.ts`, `src/lib/parseExtraction.ts` | Vision prompts and parsers for receipt and e-wallet screenshot extraction |
| **Net Worth & Prices**| `src/lib/networth.ts`, `src/prices/`, `src/screens/NetWorthScreen.tsx` | Asset & liability balance aggregation, live crypto/gold/FX price lookups |
| **Tax Relief (LHDN)** | `src/lib/relief.ts`, `src/lib/reliefSchedule.ts`, `src/screens/TaxScreen.tsx` | LHDN relief category management, cap enforcement, and audit exports |
| **Bill Splits & Owed**| `src/lib/split.ts`, `src/db/splitRepo.ts`, `src/screens/OwedScreen.tsx` | Itemized bill calculations (SST, service tax) and receivable tracking |
| **Streaks & Widgets** | `src/lib/streak.ts`, `src/widget/`, `src/notifications/` | Activity streak tracking, reminders, and Android home-screen widget |
| **Financial Export**  | `src/lib/financialExport.ts`, `src/screens/ExportScreen.tsx` | PDF, Excel (.xlsx), CSV, HTML, and JSON data export |

---

## 4. Development & Verification Workflow

```bash
# Typecheck
npm run typecheck

# Unit tests
npm test

# Linting & Audits
npm run audit:contrast
npm run audit:type
```

### Style Conventions
- **No em dashes in user-facing copy**: Keep copy concise and clear.
- **Luminance-separated colors**: Ensure all charts and UI elements pass contrast audits.

---

## 5. Monetization & RevenueCat Shipaton 2026

Pip is being entered into the [RevenueCat Shipaton 2026](https://revenuecat-shipaton-2026.devpost.com/) hackathon. This drives both the monetization design and the release timeline.

### 5.1 Pricing (decided)

| Plan | Price | Notes |
|---|---|---|
| Monthly | RM9.90 | Mid-price tier; `.90` ending matches local convention |
| Annual | RM67.00 | 6.8x monthly, 44% saving, RM5.58/mo equivalent. Default-selected |
| Lifetime | RM179 | Optional. Answers "why rent an app with no server?" |

Benchmarked against Malaysian anchors (Spotify RM17.50, Netflix Mobile RM18.90, YouTube Premium RM20.90, Play Pass RM10.99/mo) and competitors (Wallet ~RM25/mo, Spendee ~RM20/mo, YNAB ~RM65/mo). Sits below the RevenueCat India/SEA regional median of $3.75/mo and $18.32/yr.

### 5.2 Free vs Pro split (decided)

- **Free forever**: manual entry, budgets, net worth, split bills + Owed, commitments, streaks, working widget (good default + a few themes + milestone unlocks), CSV/JSON export, capped monthly AI scans.
- **Pro**: unlimited AI scans, tax relief tracking + audit pack, PDF/Excel reports, advanced import, multi-currency FX, full widget/mascot customizer.

Gating principle: only charge for things with a genuine ongoing cost (AI vision calls) or ongoing labour (the LHDN relief schedule in `src/lib/reliefSchedule.ts` changes every budget year). Cosmetics are the one exception, since they need no such justification.

AI cost reference: Gemini 3.1 Flash Lite runs roughly **RM0.007 per scan**, so scan caps are a fairness and abuse guard, not a margin guard.

### 5.3 Shipaton constraints

- **Eligibility**: only apps whose *first public store release* falls between 1 Aug and 30 Sep 2026 qualify. Updates to already-released apps are not eligible. Confirm Pip has never been on a public Play track before shipping.
- **Deadline**: 30 Sep 2026, 11:45pm PDT. Store submission recommended by ~23 Sep so judges can download a published (not in-review) app.
- **Judge access**: the app must offer a free trial, or ship a promo code that unlocks all premium features. A 14-day trial covers the 1-13 Oct judging window.
- **Required**: purchases must be powered by the RevenueCat SDK.
- Still-open Phase A blockers in `plan.md` that gate store submission: privacy policy, store screenshots.

### 5.4 Implementation notes

- `react-native-purchases` via its Expo config plugin. A dev build is already in use (`expo-dev-client`), so no workflow change.
- Android first. iOS is a later config addition, not a rewrite.
- Entitlement state must be readable offline. Persist the last known entitlement with a timestamp and honour it through a grace window (~7 days) when the network is unreachable, so a paying user offline is never locked out. A cold first launch with no cache resolves to free, which is safe because the free tier is fully functional.
- Free tier allowance: **20 AI scans/month**. Trial is 14 days of full Pro.
- Backup/restore interaction: a backup may carry a Pro-only mascot or widget config. On restore without entitlement, degrade silently to the free default. Never crash, and never render a locked-looking widget on the home screen.

