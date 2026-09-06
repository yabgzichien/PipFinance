// src/data/optionalCategories.ts
// The supplied catalogue of categories a user can switch ON. Nothing here is seeded: a row only
// reaches the database when the user selects it (see `activateSuggestedCategories`).
//
// Ids are `opt-` prefixed on purpose. Two of these concepts — groceries and coffee — were once
// real default ids and are now keys of CATEGORY_ID_REMAP, which db.ts runs as a hard DELETE of
// any default row carrying them. Reusing the bare name would mean the category the user just
// added disappears the next time the app opens. The template key keeps the concept's identity;
// the id merely has to be safe and stable.
import type { TxnType } from '../lib/types';

export const OPTIONAL_GROUPS = ['car', 'food'] as const;
export type OptionalGroup = (typeof OPTIONAL_GROUPS)[number];

export interface OptionalCategory {
  /** The database id minted on activation. Never a CATEGORY_ID_REMAP key. */
  id: string;
  /** Stable identity, independent of display label. Unique across the catalogue. */
  templateKey: string;
  group: OptionalGroup;
  kind: TxnType;
  icon: string;
  hue: number;
  /** Fallback English name, used when no translation is loaded. */
  label: string;
  /** Lowercased search terms, including local wording the shipped name does not contain. */
  aliases: { en: string[]; zh: string[] };
}

export const OPTIONAL_CATEGORIES: OptionalCategory[] = [
  {
    id: 'opt-petrol',
    templateKey: 'optional.car.petrol.v1',
    group: 'car',
    kind: 'expense',
    icon: 'car',
    hue: 12,
    label: 'Petrol',
    aliases: { en: ['petrol', 'fuel', 'gas', 'diesel', 'ron95', 'ron97', 'pump'], zh: ['汽油', '油费', '加油', '柴油'] },
  },
  {
    id: 'opt-car-maintenance',
    templateKey: 'optional.car.maintenance.v1',
    group: 'car',
    kind: 'expense',
    icon: 'cash',
    hue: 42,
    label: 'Car Maintenance',
    aliases: { en: ['car maintenance', 'servicing', 'service', 'repair', 'repairs', 'tyre', 'tyres', 'workshop', 'parts'], zh: ['汽车保养', '维修', '保养', '轮胎', '修车'] },
  },
  {
    id: 'opt-parking-tolls',
    templateKey: 'optional.car.parking-tolls.v1',
    group: 'car',
    kind: 'expense',
    icon: 'receipt',
    hue: 200,
    label: 'Parking & Tolls',
    aliases: { en: ['parking', 'toll', 'tolls', 'touch n go', 'smarttag', 'plus'], zh: ['停车', '过路费', '收费站', '泊车'] },
  },
  {
    id: 'opt-groceries',
    templateKey: 'optional.food.groceries.v1',
    group: 'food',
    kind: 'expense',
    icon: 'cart',
    hue: 120,
    label: 'Groceries',
    aliases: { en: ['groceries', 'grocery', 'supermarket', 'market', 'wet market', 'mydin', 'tesco', 'lotus'], zh: ['杂货', '超市', '菜市场', '买菜'] },
  },
  {
    id: 'opt-eating-out',
    templateKey: 'optional.food.eating-out.v1',
    group: 'food',
    kind: 'expense',
    icon: 'utensils',
    hue: 162,
    label: 'Eating Out',
    aliases: { en: ['eating out', 'restaurant', 'dining', 'takeaway', 'delivery', 'mamak', 'kopitiam'], zh: ['外食', '餐厅', '外卖', '打包'] },
  },
  {
    id: 'opt-coffee-snacks',
    templateKey: 'optional.food.coffee-snacks.v1',
    group: 'food',
    kind: 'expense',
    icon: 'burger',
    hue: 330,
    label: 'Coffee & Snacks',
    aliases: { en: ['coffee', 'snack', 'snacks', 'drinks', 'tea', 'bubble tea', 'cafe', 'kopi'], zh: ['咖啡', '零食', '饮料', '奶茶', '下午茶'] },
  },
];

const BY_TEMPLATE_KEY = new Map(OPTIONAL_CATEGORIES.map((c) => [c.templateKey, c]));
const BY_ID = new Map(OPTIONAL_CATEGORIES.map((c) => [c.id, c]));

export function optionalByTemplateKey(key: string): OptionalCategory | undefined {
  return BY_TEMPLATE_KEY.get(key);
}

export function optionalById(id: string): OptionalCategory | undefined {
  return BY_ID.get(id);
}

/**
 * Catalogue search across shipped names and local wording, in catalogue order.
 * A blank query returns everything, which is what the sheet shows on open.
 */
export function searchOptionalCategories(query: string, lang: 'en' | 'zh'): OptionalCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...OPTIONAL_CATEGORIES];
  return OPTIONAL_CATEGORIES.filter((c) => {
    if (c.label.toLowerCase().includes(q)) return true;
    // Both alias lists are searched regardless of interface language: a user typing pinyin-free
    // English into a Chinese interface (or a brand like "SmartTag") should still find the row.
    return [...c.aliases.en, ...c.aliases.zh].some((a) => a.includes(q));
  });
}
