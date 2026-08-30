// __tests__/i18n.test.ts
import { en } from '../src/i18n/translations/en';
import { zh } from '../src/i18n/translations/zh';
import { getCategoryLabel } from '../src/i18n/categories';
import { getGlossaryEntry, ZH_GLOSSARY } from '../src/i18n/glossary';
import { GLOSSARY } from '../src/lib/glossary';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../src/data/categories';
import type { Category } from '../src/lib/types';

describe('i18n Translation Dictionary Parity', () => {
  it('has identical keys in English and Simplified Chinese translation objects', () => {
    const enKeys = Object.keys(en).sort();
    const zhKeys = Object.keys(zh).sort();

    expect(zhKeys).toEqual(enKeys);
  });

  it('all Chinese translation values are non-empty strings', () => {
    for (const [key, value] of Object.entries(zh)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe('Category Localization', () => {
  it('localizes default income categories correctly in Simplified Chinese', () => {
    const salaryCat: Category = { id: 'salary', label: 'Salary', icon: 'wallet', hue: 140, kind: 'income', isDefault: true };
    const allowanceCat: Category = { id: 'allowance', label: 'Allowance', icon: 'gift', hue: 160, kind: 'income', isDefault: true };
    const otherIncomeCat: Category = { id: 'other-income', label: 'Other Income', icon: 'plus', hue: 180, kind: 'income', isDefault: true };

    expect(getCategoryLabel(salaryCat, 'zh')).toBe('工资薪金');
    expect(getCategoryLabel(allowanceCat, 'zh')).toBe('津贴补贴');
    expect(getCategoryLabel(otherIncomeCat, 'zh')).toBe('其他收入');

    expect(getCategoryLabel(salaryCat, 'en')).toBe('Salary');
    expect(getCategoryLabel(allowanceCat, 'en')).toBe('Allowance');
    expect(getCategoryLabel(otherIncomeCat, 'en')).toBe('Other Income');
  });

  it('localizes default expense categories correctly in Simplified Chinese', () => {
    for (const cat of EXPENSE_CATEGORIES) {
      const zhLabel = getCategoryLabel(cat, 'zh');
      expect(zhLabel).toBeTruthy();
      expect(zhLabel).not.toBe(cat.label); // Translated differently from English
    }
  });

  it('preserves custom user category names unchanged regardless of language', () => {
    const customCat: Category = {
      id: 'custom_cat_123',
      label: 'My Custom Category',
      icon: 'star',
      hue: 200,
      kind: 'expense',
      isDefault: false,
    };

    expect(getCategoryLabel(customCat, 'en')).toBe('My Custom Category');
    expect(getCategoryLabel(customCat, 'zh')).toBe('My Custom Category');
  });
});

describe('Glossary Localization', () => {
  it('contains Chinese translations for all glossary entries defined in English GLOSSARY', () => {
    const glossaryKeys = Object.keys(GLOSSARY);
    for (const key of glossaryKeys) {
      const zhEntry = ZH_GLOSSARY[key];
      expect(zhEntry).toBeDefined();
      expect(zhEntry?.term.length).toBeGreaterThan(0);
      expect(zhEntry?.short.length).toBeGreaterThan(0);
      expect(zhEntry?.body.length).toBeGreaterThan(0);
    }
  });

  it('returns English glossary when language is en', () => {
    const entry = getGlossaryEntry('net_worth', 'en');
    expect(entry).toEqual(GLOSSARY['net_worth']);
  });
});
