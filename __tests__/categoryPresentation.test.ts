// __tests__/categoryPresentation.test.ts
// One helper decides what a category looks like everywhere in the app. The precedence it
// encodes is the whole point of the change: an explicit user override must beat a supplied
// translation, which is exactly what the old getCategoryLabel got backwards — it returned the
// translation for any row flagged is_default, so renaming "Food" to "Makan" displayed "Food".
import { resolveCategoryPresentation } from '../src/lib/categoryPresentation';
import type { Category } from '../src/lib/types';

function cat(over: Partial<Category>): Category {
  return {
    id: 'food',
    label: 'Food',
    icon: 'burger',
    hue: 162,
    kind: 'expense',
    isDefault: true,
    isHidden: false,
    templateKey: 'starter.food.v1',
    labelOverride: null,
    iconOverride: null,
    hueOverride: null,
    ...over,
  };
}

describe('label resolution', () => {
  it('translates a supplied starter when there is no override', () => {
    expect(resolveCategoryPresentation(cat({}), 'en').label).toBe('Food');
    expect(resolveCategoryPresentation(cat({}), 'zh').label).toBe('餐饮美食');
  });

  it('an explicit override beats the supplied translation in every language', () => {
    const renamed = cat({ labelOverride: 'Makan' });
    expect(resolveCategoryPresentation(renamed, 'en').label).toBe('Makan');
    expect(resolveCategoryPresentation(renamed, 'zh').label).toBe('Makan');
  });

  it('translates an optional category by its template key', () => {
    const petrol = cat({ id: 'opt-petrol', label: 'Petrol', templateKey: 'optional.car.petrol.v1' });
    expect(resolveCategoryPresentation(petrol, 'en').label).toBe('Petrol');
    expect(resolveCategoryPresentation(petrol, 'zh').label).toBe('汽油');
  });

  it('keeps a custom category label verbatim when the language changes', () => {
    const custom = cat({ id: 'side-hustle', label: 'Side Hustle', isDefault: false, templateKey: null });
    expect(resolveCategoryPresentation(custom, 'en').label).toBe('Side Hustle');
    expect(resolveCategoryPresentation(custom, 'zh').label).toBe('Side Hustle');
  });

  it('translates the travelling id by its current supplied wording', () => {
    const t = cat({ id: 'travelling', label: 'Transport', templateKey: 'starter.travelling.v1' });
    expect(resolveCategoryPresentation(t, 'en').label).toBe('Travelling');
    expect(resolveCategoryPresentation(t, 'zh').label).toBe('交通出行');
  });
});

describe('icon and hue resolution', () => {
  it('falls back to the stored row when nothing is overridden', () => {
    const p = resolveCategoryPresentation(cat({}), 'en');
    expect(p.icon).toBe('burger');
    expect(p.hue).toBe(162);
  });

  it('prefers explicit overrides', () => {
    const p = resolveCategoryPresentation(cat({ iconOverride: 'utensils', hueOverride: 42 }), 'en');
    expect(p.icon).toBe('utensils');
    expect(p.hue).toBe(42);
  });

  it('treats hueOverride 0 as a real override, not as absent', () => {
    expect(resolveCategoryPresentation(cat({ hueOverride: 0 }), 'en').hue).toBe(0);
  });
});
