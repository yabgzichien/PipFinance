// src/i18n/categoryTranslations.ts
// Leaf module: translation tables only, no imports beyond ./types. Kept separate from
// categories.ts so src/lib/categoryPresentation.ts can import these tables without creating an
// import cycle (categories.ts itself imports resolveCategoryPresentation from
// categoryPresentation.ts).
import type { SupportedLanguage } from './types';

export const DEFAULT_CATEGORY_TRANSLATIONS: Record<string, Record<SupportedLanguage, string>> = {
  // Expense
  food: {
    en: 'Food',
    zh: '餐饮美食',
  },
  shopping: {
    en: 'Shopping',
    zh: '购物消费',
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
    en: 'Transport',
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
    en: 'Telco and WiFi',
    zh: '通讯话费',
  },
  subscriptions: {
    en: 'Subscriptions',
    zh: '订阅服务',
  },
  family: {
    en: 'Family',
    zh: '家庭支出',
  },
  medical: {
    en: 'Health & Medical',
    zh: '医疗健康',
  },
  learning: {
    en: 'Education',
    zh: '教育支出',
  },
  utilities: {
    en: 'Utilities',
    zh: '水电杂费',
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
 * Supplied names and one-line explanations for the optional catalogue, keyed by TEMPLATE KEY
 * rather than by category id — the id is minted per install and the label is user-editable, so
 * neither can key a translation table.
 *
 * The descriptions carry the overlap convention from the spec: Coffee & Snacks is for purchases
 * that are mostly drinks or snacks, while a full cafe meal stays Eating Out. Nothing here
 * promises item-level classification of a mixed supermarket receipt.
 */
export const OPTIONAL_CATEGORY_TRANSLATIONS: Record<
  string,
  { en: { name: string; desc: string }; zh: { name: string; desc: string } }
> = {
  'optional.car.petrol.v1': {
    en: { name: 'Petrol', desc: 'Fuel for your vehicle' },
    zh: { name: '汽油', desc: '车辆加油费用' },
  },
  'optional.car.maintenance.v1': {
    en: { name: 'Car Maintenance', desc: 'Servicing, repairs, tyres, and parts' },
    zh: { name: '汽车保养', desc: '保养、维修、轮胎与零件' },
  },
  'optional.car.parking-tolls.v1': {
    en: { name: 'Parking & Tolls', desc: 'Parking charges and road tolls' },
    zh: { name: '停车与过路费', desc: '停车费与公路收费' },
  },
  'optional.food.groceries.v1': {
    en: { name: 'Groceries', desc: 'Food and ingredients bought for home' },
    zh: { name: '杂货采购', desc: '在家烹饪的食材与日用食品' },
  },
  'optional.food.eating-out.v1': {
    en: { name: 'Eating Out', desc: 'Restaurant, takeaway, and delivered meals' },
    zh: { name: '外出用餐', desc: '餐厅、打包与外卖餐点' },
  },
  'optional.food.coffee-snacks.v1': {
    en: { name: 'Coffee & Snacks', desc: 'Drinks and small treats tracked separately' },
    zh: { name: '咖啡与零食', desc: '单独记录的饮料与小食' },
  },
};

/** Group headings shown in the Suggested tab. Groups organise the catalogue only — they are
 *  never selectable categories, parent totals, or budget envelopes. */
export const OPTIONAL_GROUP_TITLES: Record<'car' | 'food', Record<SupportedLanguage, string>> = {
  car: { en: 'Car & transport', zh: '汽车与交通' },
  food: { en: 'Food & drinks', zh: '餐饮与饮品' },
};
