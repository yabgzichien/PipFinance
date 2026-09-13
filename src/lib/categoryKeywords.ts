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
    'groceries', 'grocery', 'drink', 'drinks', 'laksa', 'bakery', 'starbucks', 'mcdonalds', 'mcd', 'kfc', 'boba',
    'tealive', 'zus', 'zus coffee', 'gigi coffee', 'subway', 'marrybrown', 'foodpanda', 'grabfood',
    'familymart', 'family mart', 'mixue', 'chagee', 'nasi lemak', 'roti canai', 'cendol', 'kopitiam', 'mamak',
    '午餐', '晚餐', '早餐', '早午餐', '餐', '吃饭', '咖啡', '奶茶', '零食', '外卖', '外食', '杂货', '超市', '肯德基', '麦当劳', '星巴克', '海底捞', '喜茶', '霸王茶姬',
  ],
  travelling: [
    'grab', 'taxi', 'uber', 'bus', 'train', 'mrt', 'lrt', 'petrol', 'fuel', 'parking', 'toll', 'flight', 'transport', 'travel', 'travelling', 'trip', 'commute', 'tourism',
    'petronas', 'shell', 'caltex', 'bhp', 'petron', 'setel', 'touch n go', "touch 'n go", 'tng', 'rapidkl', 'myrapid', 'ktm', 'airasia ride', 'indriver', 'plus toll', 'touchngo',
    '打车', '出租车', '地铁', '公交', '油费', '停车', '过路费', '机票', '交通', '旅游', '出行', '加油', '油站', '捷运', '轻快铁',
  ],
  entertainment: [
    'movie', 'movies', 'cinema', 'netflix', 'spotify', 'game', 'games', 'concert', 'karaoke',
    'tgv', 'gsc', 'golden screen cinemas', 'steam', 'playstation', 'nintendo',
    '电影', '游戏', '演唱会',
  ],
  shopping: [
    'shopee', 'lazada', 'shopping', 'clothes', 'clothing', 'mall', 'shoes', 'bag', 'uniqlo', 'zara', 'h&m',
    'tiktok shop', 'taobao', 'watsons', 'guardian', 'mr diy', 'mr. diy', 'mrdiy', 'daiso', 'decathlon', 'kaison',
    'popular bookstore', 'ikea', 'aeon', 'lotus', "lotus's", 'lotuss', 'jaya grocer', 'village grocer',
    '99 speedmart', 'speedmart', 'econsave', 'giant',
    '购物', '衣服', '商场', '屈臣氏', '万宁', '淘宝',
  ],
  rental: [
    'rent', 'rental', 'mortgage',
    '房租', '租金',
  ],
  'phone-bill': [
    'phone bill', 'mobile plan', 'data plan', 'unifi', 'broadband', 'phone', 'wifi', 'telco', 'internet',
    'maxis', 'celcom', 'digi', 'u mobile', 'umobile', 'hotlink', 'xox', 'yoodo', 'yes 5g',
    '话费', '电话费', '宽带', 'wifi费',
  ],
  insurance: [
    'insurance', 'premium', 'prudential', 'great eastern', 'aia', 'allianz', 'etiqa',
    '保险',
  ],
  subscriptions: [
    'subscription', 'subscriptions', 'netflix', 'spotify', 'disney+', 'youtube premium', 'icloud', 'membership',
    'apple.com/bill', 'google storage', 'google play', 'chatgpt', 'openai', 'claude', 'prime video',
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
    'tenaga nasional', 'syabas', 'air selangor', 'indah water', 'iwk', 'sada', 'sesb', 'sarawak energy',
    '电费', '水费', '煤气费', '水电',
  ],
  other: [
    'laundry', 'dobi', 'dry clean', 'dry cleaning', 'laundromat', 'coin laundry',
    'postage', 'courier', 'parcel', 'stationery', 'printing', 'print', 'photocopy',
    'barber', 'haircut', 'salon',
    '洗衣', '干洗', '洗衣房', '自助洗衣', '快递', '邮费', '理发', '剪发', '文具', '打印',
  ],
};

const OPTIONAL_KEYWORDS_BY_ID = new Map(
  OPTIONAL_CATEGORIES.map((c) => [c.id, [...c.aliases.en, ...c.aliases.zh]])
);

/**
 * Fast Damerau-Levenshtein distance calculation between two strings.
 * Includes early-termination cutoff when distance exceeds maxDist.
 * Handles insertions, deletions, substitutions, and adjacent transpositions.
 */
export function damerauLevenshtein(a: string, b: string, maxDist: number = 2): number {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > maxDist) return maxDist + 1;
  if (a === b) return 0;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const d: number[][] = [];
  for (let i = 0; i <= la; i++) {
    d[i] = [];
    d[i][0] = i;
  }
  for (let j = 0; j <= lb; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= la; i++) {
    let minRow = d[i][0];
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
      // Adjacent transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
      if (d[i][j] < minRow) minRow = d[i][j];
    }
    if (minRow > maxDist) return maxDist + 1;
  }

  return d[la][lb];
}

/** Matches a keyword as a whole word/phrase for ASCII (including single-character typos),
 *  and as a substring for CJK, which has no word boundaries. Mirrors quickParse's INCOME_MATCHERS. */
function keywordMatches(keyword: string, haystack: string): boolean {
  if (!/^[a-z0-9 ]+$/i.test(keyword)) {
    return haystack.includes(keyword);
  }

  // Exact word/phrase boundary match
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  if (new RegExp(`\\b${escaped}\\b`, 'i').test(haystack)) {
    return true;
  }

  // Typo resilience for single-word keywords of length >= 4
  // E.g. "luch" -> "lunch", "diner" -> "dinner", "brekfast" -> "breakfast", "coffe" -> "coffee", "petro" -> "petrol"
  if (!keyword.includes(' ') && keyword.length >= 4) {
    const haystackWords = haystack
      .replace(/[^a-z0-9]/gi, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    const maxDist = keyword.length >= 7 ? 2 : 1;

    for (const hw of haystackWords) {
      if (Math.abs(hw.length - keyword.length) <= maxDist) {
        if (damerauLevenshtein(hw, keyword, maxDist) <= maxDist) {
          return true;
        }
      }
    }
  }

  return false;
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
