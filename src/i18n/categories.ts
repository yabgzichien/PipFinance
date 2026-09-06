// src/i18n/categories.ts
import type { SupportedLanguage } from './types';
import type { Category } from '../lib/types';
import { resolveCategoryPresentation } from '../lib/categoryPresentation';

export {
  DEFAULT_CATEGORY_TRANSLATIONS,
  OPTIONAL_CATEGORY_TRANSLATIONS,
  OPTIONAL_GROUP_TITLES,
} from './categoryTranslations';

/**
 * Returns the localized label for a category.
 *
 * Kept as a thin wrapper so the ~40 existing `tCat(...)` call sites keep working; the ordering
 * decision now lives in one place, `resolveCategoryPresentation`.
 */
export function getCategoryLabel(
  cat:
    | Category
    | {
        id: string;
        label: string;
        isDefault?: boolean;
        templateKey?: string | null;
        labelOverride?: string | null;
      }
    | null
    | undefined,
  lang: SupportedLanguage = 'en'
): string {
  if (!cat) return '';
  return resolveCategoryPresentation(
    { icon: 'dots', hue: 220, ...cat },
    lang
  ).label;
}
