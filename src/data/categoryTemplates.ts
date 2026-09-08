// src/data/categoryTemplates.ts
// Template identity for the supplied categories, kept separate from ALL_SEED_CATEGORIES so the
// catalogue and the starter set can evolve without either one deciding the other's shape.
//
// A template key is the STABLE identity of a supplied category: it survives renames, icon
// changes and translation edits, because none of those touch it. `is_default` used to carry
// this job and could not — it is a boolean, so it cannot tell "Food" from "Petrol", and it
// flips meaning the moment a user edits the row.
import { ALL_SEED_CATEGORIES } from './categories';

/** Seed category id -> its stable template key. */
export const STARTER_TEMPLATE_KEYS: Record<string, string> = {
  food: 'starter.food.v1',
  shopping: 'starter.shopping.v1',
  entertainment: 'starter.entertainment.v1',
  other: 'starter.other.v1',
  travelling: 'starter.travelling.v1',
  insurance: 'starter.insurance.v1',
  rental: 'starter.rental.v1',
  'phone-bill': 'starter.phone-bill.v1',
  subscriptions: 'starter.subscriptions.v1',
  family: 'starter.family.v1',
  medical: 'starter.medical.v1',
  learning: 'starter.learning.v1',
  utilities: 'starter.utilities.v1',
  salary: 'starter.salary.v1',
  allowance: 'starter.allowance.v1',
  'other-income': 'starter.other-income.v1',
};

/**
 * Every display label a default category has ever shipped with, in either language.
 *
 * The override migration uses this to answer one question: is the label stored on this row
 * something Pip put there, or something the user typed? A stored label that appears here is a
 * supplied default (possibly a stale one from an older release) and is left alone; anything
 * else is a deliberate rename and is preserved as an explicit `label_override`.
 *
 * `travelling` carries both 'Travelling' and 'Transport' because the 2026-09-06 relabel changes
 * the supplied wording — without the old entry, every upgraded install would read its untouched
 * 'Travelling' row as a user rename and pin it there forever. `phone-bill` carries both 'Phone
 * Bill' and 'Telco and WiFi' for the same reason, from the 2026-09-07 relabel.
 */
export const HISTORICAL_DEFAULT_LABELS: Record<string, string[]> = {
  food: ['Food', 'Dining', 'Food & Groceries', '餐饮美食', '餐饮'],
  shopping: ['Shopping', '购物消费', '购物'],
  entertainment: ['Entertainment', 'Recreation', '休闲娱乐', '娱乐'],
  other: ['Other Expenses', 'Other', '其他支出', '其他'],
  travelling: ['Travelling', 'Transport', 'Transportation', '交通出行', '交通'],
  insurance: ['Insurance', 'Insurance & Fees', '保险保障', '保险'],
  rental: ['Rental', 'Housing', 'Bills', '房租居住', '房租'],
  'phone-bill': ['Phone Bill', 'Communications', 'Telco and WiFi', '通讯话费', '通讯'],
  subscriptions: ['Subscriptions', '订阅服务'],
  family: ['Family', '家庭支出'],
  medical: ['Health & Medical', '医疗健康'],
  learning: ['Education', '教育支出'],
  utilities: ['Utilities', '水电杂费'],
  salary: ['Salary', 'Employment Income', '工资薪金', '工资'],
  allowance: ['Allowance', 'Transfers Received', '津贴补贴', '津贴'],
  'other-income': ['Other Income', 'Business Revenue', '其他收入'],
};

/**
 * Every icon a default category has ever shipped with.
 *
 * Exists for the same reason as `HISTORICAL_DEFAULT_LABELS`: the pre-2026-09-06 seed clobbered
 * `icon` on every launch, so an upgrading install can be carrying an OLD Pip-supplied icon rather
 * than the current one. "Differs from today's seed" is therefore not evidence of a user edit —
 * only a stored icon absent from this list is.
 */
export const HISTORICAL_DEFAULT_ICONS: Record<string, string[]> = {
  food: ['burger', 'cart'],
  shopping: ['cart', 'bag'],
  entertainment: ['play'],
  other: ['dots'],
  travelling: ['car', 'fuel'],
  insurance: ['shield'],
  rental: ['home'],
  'phone-bill': ['phone', 'signal'],
  subscriptions: ['calendar'],
  family: ['heart'],
  medical: ['plus'],
  learning: ['book'],
  utilities: ['gear'],
  salary: ['wallet'],
  allowance: ['gift'],
  'other-income': ['dots'],
};

/** Every hue a default category has ever shipped with. Same rationale as the icon table above. */
export const HISTORICAL_DEFAULT_HUES: Record<string, number[]> = {
  food: [162],
  shopping: [42, 330],
  entertainment: [305],
  other: [220],
  travelling: [248],
  insurance: [286],
  rental: [200],
  'phone-bill': [355],
  subscriptions: [265],
  family: [18],
  medical: [8],
  learning: [95],
  utilities: [235],
  salary: [152],
  allowance: [120],
  'other-income': [200],
};

/** True when `label` is a supplied default for `id` rather than something the user typed. */
export function isSuppliedDefaultLabel(id: string, label: string): boolean {
  const known = HISTORICAL_DEFAULT_LABELS[id];
  if (!known) return false;
  const trimmed = label.trim();
  return known.some((k) => k === trimmed);
}

/** True when `icon` is a supplied default for `id` rather than something the user picked. */
export function isSuppliedDefaultIcon(id: string, icon: string): boolean {
  const known = HISTORICAL_DEFAULT_ICONS[id];
  if (!known) return false;
  return known.includes(icon);
}

/** True when `hue` is a supplied default for `id` rather than something the user picked. */
export function isSuppliedDefaultHue(id: string, hue: number): boolean {
  const known = HISTORICAL_DEFAULT_HUES[id];
  if (!known) return false;
  return known.includes(hue);
}

/** The seed row for an id, used to tell an edited icon/hue from an untouched one. */
export const SEED_BY_ID = new Map(ALL_SEED_CATEGORIES.map((c) => [c.id, c]));
