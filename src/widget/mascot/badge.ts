// The streak badge. The user picks its icon and colour; its *form* is chosen by layout
// (compact pill here, expanded count+dots in QuickRecordWidget), never by a setting.
import type { BadgeIcon, BadgeColor } from './config';
import type { PartLayer } from './parts/types';
import { Z } from './parts/types';

interface BadgeTheme {
  icon: string;
  border: string;
  text: string;
}

export const BADGE_THEMES: Record<BadgeColor, BadgeTheme> = {
  amber: { icon: '#FAA81A', border: '#FED7AA', text: '#C2410C' },
  red: { icon: '#E2402A', border: '#FECACA', text: '#B91C1C' },
  green: { icon: '#1f8a5b', border: '#BBF7D0', text: '#166534' },
  blue: { icon: '#2563EB', border: '#BFDBFE', text: '#1D4ED8' },
  violet: { icon: '#7C3AED', border: '#DDD6FE', text: '#6D28D9' },
};

/** Icon glyphs, each drawn inside a 100x100 box and scaled to 0.16 by the caller — the same
 *  treatment the original flame got in QuickRecordWidget.tsx:54. */
const ICONS: Record<Exclude<BadgeIcon, 'none'>, (fill: string) => string> = {
  flame: (f) => `<path d="M49 12.5C53.5 22 57 32 58.6 39.6C61.1 33.2 65.4 28.9 70 26.8C73.2 33.8 79.6 47.2 80 64C80.4 82.2 62.9 99 41 99C19.1 99 1.6 82.2 2 64C2.2 56.2 4.1 51.4 7.6 46.8C9.1 39.9 17 26.7 25.2 20C26.7 27.2 30.7 36.2 36.6 42.6C40.1 46.2 43.1 42.2 44.6 35C45.7 29.6 47.2 20 49 12.5Z" fill="${f}" />`,
  star: (f) => `<path d="M50 4L62 38H98L69 59L80 95L50 73L20 95L31 59L2 38H38Z" fill="${f}" />`,
  leaf: (f) => `<path d="M84 10C84 10 22 6 12 52C6 80 30 96 46 90C74 80 84 40 84 10Z" fill="${f}" />`,
  sprout: (f) => `<path d="M50 96V44" stroke="${f}" stroke-width="10" stroke-linecap="round" /><ellipse cx="26" cy="34" rx="24" ry="13" fill="${f}" transform="rotate(-32 26 34)" /><ellipse cx="74" cy="28" rx="26" ry="14" fill="${f}" transform="rotate(28 74 28)" />`,
};

/**
 * Geometry note carried over from QuickRecordWidget.tsx:17-23: the icon and number are centred
 * as one cluster inside the pill. Pinning the icon to a fixed offset left the pair visibly
 * left-of-centre, worst in the common one-digit case.
 *
 * Coordinates here are in the OUTER 76x64 space, not the 100-unit mascot space, so this layer
 * is emitted outside the scaled group — see composeMascot's use of Z.BADGE.
 */
export function badgeLayer(icon: BadgeIcon, color: BadgeColor, streak: number): PartLayer | null {
  if (icon === 'none') return null;

  const theme = BADGE_THEMES[color];
  const s = String(streak);
  const pillW = s.length >= 3 ? 40 : s.length === 2 ? 34 : 28;
  const pillX = s.length >= 3 ? 34 : s.length === 2 ? 38 : 42;
  const ICON_W = 12.5;
  const GAP = 2;
  const CHAR_W = 6.5;
  const textW = CHAR_W * s.length;
  const contentX = pillX + (pillW - (ICON_W + GAP + textW)) / 2;
  const textX = contentX + ICON_W + GAP + textW / 2;

  return {
    z: Z.BADGE,
    svg: `<g data-part="badge">
      <rect x="${pillX}" y="40" width="${pillW}" height="18" rx="9" fill="#FFFFFF" stroke="${theme.border}" stroke-width="1.2" />
      <g transform="translate(${contentX}, 41) scale(0.16)">${ICONS[icon](theme.icon)}</g>
      <text x="${textX}" y="52.5" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="10.5" fill="${theme.text}">${s}</text>
    </g>`,
  };
}
