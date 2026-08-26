// src/i18n/categories.ts
import type { SupportedLanguage } from './types';
import type { Category } from '../lib/types';

export const DEFAULT_CATEGORY_TRANSLATIONS: Record<string, Record<SupportedLanguage, string>> = {
  // Expense
  food: {
    en: 'Food',
    zh: '餐饮美食',
  },
  entertainment: {
    en: 'Entertainment',
    zh: '休闲娱乐',
  },
  other: {
    en: 'Other Expenses',
    zh: '其他支出',
  },
  travelling: {
    en: 'Travelling',
    zh: '交通出行',
  },
  insurance: {
    en: 'Insurance',
    zh: '保险保障',
  },
  rental: {
    en: 'Rental',
    zh: '房租居住',
  },
  'phone-bill': {
    en: 'Phone Bill',
    zh: '通讯话费',
  },

  // Income
  salary: {
    en: 'Salary',
    zh: '工资薪金',
  },
  allowance: {
    en: 'Allowance',
    zh: '津贴补贴',
  },
  'other-income': {
    en: 'Other Income',
    zh: '其他收入',
  },

  // Legacy mappings fallback
  'employment-income': {
    en: 'Employment Income',
    zh: '工资薪金',
  },
  'transfers-in': {
    en: 'Transfers Received',
    zh: '转账收款',
  },
  'business-income': {
    en: 'Business Revenue',
    zh: '营业收入',
  },
  'gig-income': {
    en: 'Gig & Commission',
    zh: '零工副业',
  },
  'investment-income': {
    en: 'Investment Income',
    zh: '投资收益',
  },
};

/**
 * Returns the localized label for a category.
 * If the category is a default seeded category, its translated label is returned.
 * If the category is user-customized, its original user label is preserved.
 */
export function getCategoryLabel(
  cat: Category | { id: string; label: string; isDefault?: boolean } | null | undefined,
  lang: SupportedLanguage = 'en'
): string {
  if (!cat) return '';
  const translation = DEFAULT_CATEGORY_TRANSLATIONS[cat.id];
  if (translation && (cat.isDefault !== false || cat.label === translation.en || cat.label === translation.zh)) {
    return translation[lang] ?? cat.label;
  }
  return cat.label;
}
