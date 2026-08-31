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

## 5. Live Operations & On-Chain Activity

- **Live Trade Executed**: `0x22955CE01D82B786207a8934430D13a0921822a8`

