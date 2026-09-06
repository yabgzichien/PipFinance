// __tests__/optionalCategories.test.ts
// The optional catalogue is supplied data that becomes real database rows on activation, so
// the two failure modes worth guarding are structural: an id that collides with a retired
// default (which migrateCategoryIds would delete on the next launch), and a template key that
// drifts out of sync with the translations keyed on it.
import { CATEGORY_ID_REMAP, ALL_SEED_CATEGORIES } from '../src/data/categories';
import {
  OPTIONAL_CATEGORIES,
  OPTIONAL_GROUPS,
  optionalByTemplateKey,
  searchOptionalCategories,
} from '../src/data/optionalCategories';
import { STARTER_TEMPLATE_KEYS, HISTORICAL_DEFAULT_LABELS } from '../src/data/categoryTemplates';

describe('optional catalogue shape', () => {
  it('has exactly six entries across the two shipped groups', () => {
    expect(OPTIONAL_CATEGORIES).toHaveLength(6);
    expect(OPTIONAL_GROUPS).toEqual(['car', 'food']);
    expect(OPTIONAL_CATEGORIES.filter((c) => c.group === 'car')).toHaveLength(3);
    expect(OPTIONAL_CATEGORIES.filter((c) => c.group === 'food')).toHaveLength(3);
  });

  it('every entry is an expense category with unique id and template key', () => {
    expect(new Set(OPTIONAL_CATEGORIES.map((c) => c.id)).size).toBe(6);
    expect(new Set(OPTIONAL_CATEGORIES.map((c) => c.templateKey)).size).toBe(6);
    for (const c of OPTIONAL_CATEGORIES) {
      expect(c.kind).toBe('expense');
      expect(c.id).toMatch(/^opt-[a-z0-9-]+$/);
      expect(c.templateKey).toMatch(/^optional\.(car|food)\.[a-z-]+\.v1$/);
      expect(Number.isFinite(c.hue)).toBe(true);
      expect(c.icon.trim().length).toBeGreaterThan(0);
    }
  });

  it('no optional id collides with a retired default or a live seed id', () => {
    const retired = new Set(Object.keys(CATEGORY_ID_REMAP));
    const live = new Set(ALL_SEED_CATEGORIES.map((c) => c.id));
    for (const c of OPTIONAL_CATEGORIES) {
      expect(retired.has(c.id)).toBe(false);
      expect(live.has(c.id)).toBe(false);
    }
  });

  it('resolves an entry by its template key', () => {
    expect(optionalByTemplateKey('optional.car.petrol.v1')?.id).toBe('opt-petrol');
    expect(optionalByTemplateKey('optional.car.nope.v1')).toBeUndefined();
  });
});

describe('search', () => {
  it('matches local wording as well as the shipped name', () => {
    expect(searchOptionalCategories('fuel', 'en').map((c) => c.id)).toEqual(['opt-petrol']);
    expect(searchOptionalCategories('servicing', 'en').map((c) => c.id)).toEqual(['opt-car-maintenance']);
    expect(searchOptionalCategories('toll', 'en').map((c) => c.id)).toEqual(['opt-parking-tolls']);
  });

  it('matches Chinese names', () => {
    expect(searchOptionalCategories('汽油', 'zh').map((c) => c.id)).toEqual(['opt-petrol']);
  });

  it('an empty query returns the whole catalogue in catalogue order', () => {
    expect(searchOptionalCategories('  ', 'en')).toHaveLength(6);
  });
});

describe('starter templates', () => {
  it('gives every seeded category a template key', () => {
    for (const c of ALL_SEED_CATEGORIES) {
      expect(STARTER_TEMPLATE_KEYS[c.id]).toMatch(/^starter\.[a-z-]+\.v1$/);
    }
    expect(new Set(Object.values(STARTER_TEMPLATE_KEYS)).size).toBe(ALL_SEED_CATEGORIES.length);
  });

  it('lists the current label among each id historical labels', () => {
    for (const c of ALL_SEED_CATEGORIES) {
      expect(HISTORICAL_DEFAULT_LABELS[c.id]).toContain(c.label);
    }
  });

  it('remembers Travelling so the Transport relabel is not read as a user edit', () => {
    expect(HISTORICAL_DEFAULT_LABELS['travelling']).toContain('Travelling');
    expect(HISTORICAL_DEFAULT_LABELS['travelling']).toContain('Transport');
  });
});
