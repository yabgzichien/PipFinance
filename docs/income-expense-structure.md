# Architecture Spec: Income Baseline & Expense Structure

This document details the cash-flow modeling engine in Pip (`src/lib/incomeFloor.ts`, `incomeBaseline.ts`, `spendingProfile.ts`, and `obligations.ts`), which powers Pip's monthly budgeting forecasts and the **Monthly Recap** analytics (`src/screens/RecapScreen.tsx`).

---

## 1. Overview: The Problem with Simple Averages

Standard budgeting apps calculate monthly income and expenses using simple arithmetic averages (e.g. total income divided by months). For users with irregular incomes (gig workers, freelancers, commission earners, or individuals with periodic bonuses), simple averaging creates dangerous distortions:

1. **One outlier month inflates the baseline**: A single RM10,000 bonus in January creates an artificially high average that causes overspending in February and March.
2. **One down month pulls the mean below standard reality**: A month with missed or delayed payment drags the average below a user's typical earning capacity.
3. **Fails to distinguish fixed commitments from flexible spend**: A user spending RM3,000 with RM2,500 in fixed rent/loan commitments has far less spending flexibility than someone spending RM3,000 with RM500 in fixed commitments.

To solve this, Pip implements:
- **Income Baseline & Income Floor** (`incomeBaseline.ts`, `incomeFloor.ts`)
- **Committed vs. Flexible Expense Structure** (`spendingProfile.ts`)
- **Automated Recurring Obligation Detection** (`obligations.ts`)

---

## 2. Income Modeling

### 2.1 Baseline Income (`computeBaselineIncome`)
Located in `src/lib/incomeBaseline.ts`.
- **Purpose**: Establishes the typical monthly earnings for realistic monthly budgeting envelope sizing.
- **Algorithm**: Uses the median of monthly historical totals rather than the mean. When sufficient history exists (≥3 months), it dampens extreme positive outliers while preserving recurring trends.

### 2.2 Income Floor (`computeIncomeFloor`)
Located in `src/lib/incomeFloor.ts`.
- **Purpose**: Defines the conservative, dependable monthly income that a user can reliably count on even in lower-earning months.
- **Algorithm**:
  - Calculates the 25th percentile (or lowest historical non-zero month, damped against extreme anomalies).
  - Provides a baseline for safety-buffer calculations: `dependableSurplus` (income floor minus total average expenses) and `serviceableCapacity` (income floor minus unavoidable fixed commitments).

---

## 3. Expense Modeling: Committed vs. Flexible

Located in `src/lib/spendingProfile.ts`.

### 3.1 Three Spending Layers
Pip categorizes monthly expenses into three structural layers:

1. **Committed Outflows (Fixed Obligations)**:
   - Contractual or recurring non-negotiable expenses (rent, mortgage, car installments, insurance, utilities, active subscriptions).
   - Detected automatically via `detectObligations()` or manually defined via Commitments (`src/lib/commitments.ts`).
2. **Essential Variable Outflows**:
   - Necessities that fluctuate in amount (groceries, daily commute, basic medical).
3. **Flexible / Discretionary Outflows**:
   - Elastic spending that can be reduced or eliminated on demand (entertainment, dining out, shopping, hobbies).

### 3.2 Recurring Obligation Detection (`detectObligations`)
Located in `src/lib/obligations.ts`.
- Scans transaction history for regular interval patterns (e.g. monthly cadence, low variance in amount, repeated merchant name).
- Identifies commitments even before the user explicitly registers them in the Commitments screen.

---

## 4. In-App Integration: Monthly Recap

The primary UI consumer of this engine is `src/screens/RecapScreen.tsx` via the `MonthVsNormalCard` component.

### Visual Components:
1. **Income vs. Normal Benchmark**:
   - Compares the selected month's total income against the user's historical baseline and dependable floor (e.g., *"RM 3,200 (▲ RM 400 above your typical RM 2,800)"*).
2. **Expense Breakdown Bar**:
   - A multi-segment horizontal bar depicting Committed Outflows vs. Flexible Outflows.
   - Distinct luminance-separated colors (`ink` for committed, `accentInk` for essentials, `#3ab07a` for flexible) ensure clear legibility across all display types.
3. **Actionable Insights**:
   - Highlights how much of this month's spending was discretionary, giving users clarity on where their budget flexibility actually lies.

---

## 5. Verification & Testing

The income and expense modeling logic is purely deterministic and covered by unit test suites:
- `__tests__/incomeFloor.test.ts`
- `__tests__/spendingProfile.test.ts`
- `__tests__/obligations.test.ts`
- `__tests__/recap.test.ts`

Run test suite:
```bash
npm test -- __tests__/incomeFloor.test.ts __tests__/spendingProfile.test.ts
```
