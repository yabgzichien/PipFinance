import type { Category } from '../lib/types';

type SeedCategory = Omit<Category, 'isDefault'>;

/**
 * Default EXPENSE categories (onboarding-wizard retune, 2026-08-21).
 *
 * Shrunk from the prior 12-category COICOP-aligned set to 7 plain-language buckets,
 * so a first-time user in the setup wizard picks from a short list instead of a
 * bookkeeping taxonomy. This intentionally drops COICOP division alignment: nothing
 * in the app compares these buckets against an external taxonomy any more.
 */
export const EXPENSE_CATEGORIES: SeedCategory[] = [
  { id: 'food', label: 'Food', icon: 'cart', hue: 162, kind: 'expense' },
  { id: 'entertainment', label: 'Entertainment', icon: 'play', hue: 305, kind: 'expense' },
  { id: 'other', label: 'Other Expenses', icon: 'dots', hue: 220, kind: 'expense' },
  { id: 'travelling', label: 'Travelling', icon: 'fuel', hue: 248, kind: 'expense' },
  { id: 'insurance', label: 'Insurance', icon: 'shield', hue: 286, kind: 'expense' },
  { id: 'rental', label: 'Rental', icon: 'home', hue: 200, kind: 'expense' },
  { id: 'phone-bill', label: 'Phone Bill', icon: 'signal', hue: 355, kind: 'expense' },
];

/**
 * Default INCOME (money-received) categories, split by SOURCE the way a P&L is
 * rather than by the old single generic bucket  the three demo personas are a
 * gig worker, a micro-business seller and a small trader, and a lender reads
 * those three revenue lines very differently.
 */
export const INCOME_CATEGORIES: SeedCategory[] = [
  { id: 'salary', label: 'Salary', icon: 'wallet', hue: 152, kind: 'income' },
  { id: 'allowance', label: 'Allowance', icon: 'gift', hue: 120, kind: 'income' },
  { id: 'other-income', label: 'Other Income', icon: 'dots', hue: 200, kind: 'income' },
];

/** id of the generic income category used as a fallback for income rows. */
export const DEFAULT_INCOME_ID = 'other-income';
/** id of the generic expense category used as a fallback. */
export const DEFAULT_EXPENSE_ID = 'other';

export const ALL_SEED_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

/** ids that are income categories, used by the DB migration. */
export const INCOME_SEED_IDS = INCOME_CATEGORIES.map((c) => c.id);

/**
 * Old default category id -> new default id, applied once by the DB migration in
 * db.ts so existing ledgers, learned merchant memory and budget allocations follow
 * the retune instead of dangling at ids that no longer exist.
 *
 * Every value here points directly at a category id that exists in the CURRENT
 * `ALL_SEED_CATEGORIES` (never at another key of this same table): `migrateCategoryIds`
 * runs each pair as one independent UPDATE, so a value that itself needed remapping
 * (e.g. the pre-2026-08-07 `fuel: 'transport'`) would leave rows stranded once
 * `transport` stopped being a default id, depending on iteration order. Every retune
 * flattens the table back to single-hop pairs instead of chaining through the ids
 * an earlier retune produced.
 *
 * Some of these are lossy on purpose and cannot be undone by a later migration:
 *  - `bills` (and now `housing`) land on `rental`, `dining` lands on `food`, and
 *    `communications`/`healthcare`/`education`/`household` all land on `other`  the
 *    2026-08-21 retune collapses 12 COICOP-aligned categories into 7 plain-language
 *    ones, so several distinct old categories now share one bucket.
 *  - `borrowers-return` was never income in bookkeeping terms  it is recovery of
 *    a receivable  so it lands on `other-income` rather than an earnings line.
 */
export const CATEGORY_ID_REMAP: Record<string, string> = {
  // expense (pre-2026-08-07 ids, pointed directly at their 2026-08-21 destination)
  fuel: 'travelling',
  groceries: 'food',
  coffee: 'food',
  shopping: 'other',
  health: 'other',
  fun: 'entertainment',
  bills: 'rental',
  // expense (2026-08-07..2026-08-21 ids, retired by the 2026-08-21 retune)
  housing: 'rental',
  dining: 'food',
  transport: 'travelling',
  communications: 'other',
  healthcare: 'other',
  education: 'other',
  household: 'other',
  recreation: 'entertainment',
  'debt-service': 'other',
  'car-instalment': 'other',
  // income (retuned to salary, allowance, other-income)
  'employment-income': 'salary',
  'business-income': 'other-income',
  'gig-income': 'salary',
  'transfers-in': 'allowance',
  'investment-income': 'other-income',
  income: 'salary',
  bonus: 'salary',
  dividend: 'other-income',
  interest: 'other-income',
  'borrowers-return': 'other-income',
};
