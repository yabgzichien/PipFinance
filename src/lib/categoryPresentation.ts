// src/lib/categoryPresentation.ts
// The single shared answer to "what does this category look like right now".
//
// Precedence, in order:
//   1. an explicit user override            (labelOverride / iconOverride / hueOverride)
//   2. the supplied template's translation  (starter translations, catalogue translations)
//   3. the stored row                       (a custom category's own fields)
//
// `isDefault` deliberately plays no part. It is a legacy flag that says nothing about whether a
// label may be customised, and letting it gate translation is the bug this replaces.
import type { SupportedLanguage } from '../i18n/types';
import type { Category } from './types';
import { DEFAULT_CATEGORY_TRANSLATIONS, OPTIONAL_CATEGORY_TRANSLATIONS } from '../i18n/categoryTranslations';
import { optionalByTemplateKey } from '../data/optionalCategories';
import { SEED_BY_ID } from '../data/categoryTemplates';

export interface CategoryPresentation {
  label: string;
  icon: string;
  hue: number;
}

type ResolvableCategory = Pick<Category, 'id' | 'label' | 'icon' | 'hue'> &
  Partial<Pick<Category, 'templateKey' | 'labelOverride' | 'iconOverride' | 'hueOverride' | 'isDefault'>>;

/** The supplied name for a category, or null when Pip supplies none (a custom category). */
function suppliedLabel(cat: ResolvableCategory, lang: SupportedLanguage): string | null {
  const templateKey = cat.templateKey ?? null;
  if (templateKey) {
    const optional = OPTIONAL_CATEGORY_TRANSLATIONS[templateKey];
    if (optional) return optional[lang].name;
  }
  // Starters are still keyed by id: their ids ARE stable identities and a decade of stored rows,
  // backups and remap tables already point at them.
  const byId = DEFAULT_CATEGORY_TRANSLATIONS[cat.id];
  if (byId) return byId[lang] ?? byId.en;
  return null;
}

/** The supplied seed row for a category, or null when Pip supplies none (a custom category). */
function suppliedSeed(cat: ResolvableCategory): { icon: string; hue: number } | null {
  const templateKey = cat.templateKey ?? null;
  if (templateKey) {
    const optional = optionalByTemplateKey(templateKey);
    if (optional) return optional;
  }
  // Starters carry no template key on rows written before this migration ran; fall back to id,
  // same as suppliedLabel does.
  const byId = SEED_BY_ID.get(cat.id);
  if (byId) return byId;
  return null;
}

export function resolveCategoryPresentation(
  cat: ResolvableCategory | null | undefined,
  lang: SupportedLanguage = 'en'
): CategoryPresentation {
  if (!cat) return { label: '', icon: 'dots', hue: 220 };

  const override = cat.labelOverride?.trim();
  const supplied = suppliedLabel(cat, lang);
  const suppliedFields = suppliedSeed(cat);

  return {
    label: override || supplied || cat.label,
    // Tier 2 (supplied) sits between the override and the stored row so an upgrading install's
    // stale stored icon/hue — left behind by the pre-2026-09-06 seed that used to refresh it on
    // every launch — displays the CURRENT supplied value instead of being stuck on the old one.
    // A custom category has no supplied seed and falls straight through to its stored fields.
    icon: cat.iconOverride ?? suppliedFields?.icon ?? cat.icon,
    // A hue of 0 is a real colour (red), so only null/undefined counts as "no override".
    hue: cat.hueOverride ?? suppliedFields?.hue ?? cat.hue,
  };
}
