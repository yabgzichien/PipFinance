import { oklchToHex } from './oklch';

export interface CatColor {
  bg: string; // soft tint behind the icon
  fg: string; // icon stroke / accent text
  solid: string; // legend dot / segmented bar
}

/**
 * Per-category color trio:
 * - Light mode:
 *     bg:    oklch(0.95 0.045 hue)
 *     fg:    oklch(0.52 0.13  hue)
 *     solid: oklch(0.60 0.13  hue)
 * - Dark mode:
 *     bg:    oklch(0.24 0.050 hue) -- rich, deep tint blending into dark surfaces
 *     fg:    oklch(0.80 0.120 hue) -- vibrant, luminous icon stroke
 *     solid: oklch(0.68 0.140 hue) -- brighter solid for charts & indicators
 * Converted to hex (memoized by hue + mode).
 */
const cache = new Map<string, CatColor>();

export function catColorsForHue(hue: number, isDark = false): CatColor {
  const key = `${hue}:${isDark ? 'dark' : 'light'}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const color: CatColor = isDark
    ? {
        bg: oklchToHex(0.24, 0.05, hue),
        fg: oklchToHex(0.8, 0.12, hue),
        solid: oklchToHex(0.68, 0.14, hue),
      }
    : {
        bg: oklchToHex(0.95, 0.045, hue),
        fg: oklchToHex(0.52, 0.13, hue),
        solid: oklchToHex(0.6, 0.13, hue),
      };
  cache.set(key, color);
  return color;
}
