// src/lib/categoryKeywords.ts
// Offline, best-effort category guess from a handful of everyday words. Learned memory and the
// LLM (see quickAdd.ts) both outrank this — it only fires when neither has an answer, so a
// fresh install with no history and no API key still lands "lunch 3.9" on Food instead of
// Uncategorised.
//
// Deliberately narrow: only words common enough that guessing wrong would be surprising.
// Anything ambiguous (e.g. "interest", "allowance" — see quickParse's INCOME_WORDS) is left out
// on purpose, because a wrong guess here is worse than no guess: it never reaches the LLM that
// could have disambiguated it.

import { OPTIONAL_CATEGORIES } from '../data/optionalCategories';
import type { Category, TxnType } from './types';

/**
 * Keyword lists for the default starter categories (data/categories.ts), keyed by their seed
 * id. Kept separate from OPTIONAL_CATEGORIES' aliases, which cover the finer-grained catalogue a
 * user can additionally switch on — those are checked first (see `guessCategoryByKeyword`) so a
 * word like "restaurant" prefers an activated "Eating Out" category over the generic "Food"
 * bucket.
 */
const STARTER_KEYWORDS: Record<string, string[]> = {
  food: [
    'lunch', 'dinner', 'breakfast', 'brunch', 'meal', 'food', 'eat', 'eating',
    'restaurant', 'cafe', 'coffee', 'tea', 'snack', 'snacks', 'takeaway', 'delivery',
    'groceries', 'grocery',
    '午餐', '晚餐', '早餐', '早午餐', '餐', '吃饭', '咖啡', '奶茶', '零食', '外卖', '外食', '杂货', '超市',
  ],
  travelling: [
    'grab', 'taxi', 'uber', 'bus', 'train', 'mrt', 'lrt', 'petrol', 'fuel', 'parking', 'toll', 'flight', 'transport',
    '打车', '出租车', '地铁', '公交', '油费', '停车', '过路费', '机票', '交通',
  ],
  entertainment: [
    'movie', 'movies', 'cinema', 'netflix', 'spotify', 'game', 'games', 'concert', 'karaoke',
    '电影', '游戏', '演唱会',
  ],
  shopping: [
    'shopee', 'lazada', 'shopping', 'clothes', 'clothing', 'mall',
    '购物', '衣服', '商场',
  ],
  rental: [
    'rent', 'rental', 'mortgage',
    '房租', '租金',
  ],
  'phone-bill': [
    'phone bill', 'mobile plan', 'data plan', 'unifi', 'broadband', 'phone', 'wifi', 'telco', 'internet',
    '话费', '电话费', '宽带', 'wifi费',
  ],
  insurance: [
    'insurance', 'premium',
    '保险',
  ],
  subscriptions: [
    'subscription', 'subscriptions', 'netflix', 'spotify', 'disney+', 'youtube premium', 'icloud', 'membership',
    '订阅', '会员',
  ],
  family: [
    'family', 'kids', 'child', 'children', 'childcare', 'baby', 'parents',
    '家庭', '孩子', '小孩', '育儿', '父母',
  ],
  medical: [
    'doctor', 'clinic', 'hospital', 'pharmacy', 'medicine', 'medical', 'dentist', 'health',
    '医院', '诊所', '药', '看病', '牙医',
  ],
  learning: [
    'tuition', 'school', 'course', 'courses', 'education', 'textbook', 'books', 'class', 'classes',
    '学费', '课程', '学校', '书本',
  ],
  utilities: [
    'electricity', 'electric', 'water bill', 'gas bill', 'utility', 'utilities', 'tnb', 'power bill',
    '电费', '水费', '煤气费', '水电',
  ],
};

const OPTIONAL_KEYWORDS_BY_ID = new Map(
  OPTIONAL_CATEGORIES.map((c) => [c.id, [...c.aliases.en, ...c.aliases.zh]])
);

/** Matches a keyword as a whole word/phrase for ASCII, and as a substring for CJK, which has no
 *  word boundaries. Mirrors quickParse's INCOME_MATCHERS. */
function keywordMatches(keyword: string, haystack: string): boolean {
  if (/^[a-z0-9 ]+$/i.test(keyword)) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(haystack);
  }
  return haystack.includes(keyword);
}

/**
 * Guess a category id for `label` from a fixed keyword list, or null when nothing matches.
 *
 * Only considers categories of the right `type` and never a hidden one — a category the user
 * switched off should not resurface through a quick-add guess. Optional-catalogue categories
 * (keyed by their aliases) are checked before the generic starter categories, so a more specific
 * activated category wins over the broad default.
 */
export function guessCategoryByKeyword(label: string, type: TxnType, categories: Category[]): string | null {
  const haystack = label.toLowerCase();
  if (!haystack.trim()) return null;

  const candidates = categories.filter((c) => c.kind === type && !c.isHidden);

  for (const c of candidates) {
    const words = OPTIONAL_KEYWORDS_BY_ID.get(c.id);
    if (words?.some((w) => keywordMatches(w, haystack))) return c.id;
  }
  for (const c of candidates) {
    const words = STARTER_KEYWORDS[c.id];
    if (words?.some((w) => keywordMatches(w, haystack))) return c.id;
  }
  return null;
}
