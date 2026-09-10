// The streak badge. The user picks its icon and colour; its *form* is chosen by layout
// (compact pill here, expanded count+dots in QuickRecordWidget), never by a setting.
import type { BadgeIcon, BadgeColor, Notch } from './config';
import type { PartLayer } from './parts/types';
import { Z } from './parts/types';

interface BadgeTheme {
  icon: string;
  border: string;
  text: string;
  outer: string;
  middle: string;
  core: string;
}

export const BADGE_THEMES: Record<BadgeColor, BadgeTheme> = {
  amber: {
    icon: '#FAA81A',
    border: '#FED7AA',
    text: '#C2410C',
    outer: '#FAA81A',
    middle: '#F26A22',
    core: '#E2402A',
  },
  red: {
    icon: '#E2402A',
    border: '#FECACA',
    text: '#B91C1C',
    outer: '#F87171',
    middle: '#E2402A',
    core: '#7F1D1D',
  },
  green: {
    icon: '#1f8a5b',
    border: '#BBF7D0',
    text: '#166534',
    outer: '#4ADE80',
    middle: '#1f8a5b',
    core: '#14532D',
  },
  blue: {
    icon: '#2563EB',
    border: '#BFDBFE',
    text: '#1D4ED8',
    outer: '#60A5FA',
    middle: '#2563EB',
    core: '#1E3A8A',
  },
  violet: {
    icon: '#7C3AED',
    border: '#DDD6FE',
    text: '#6D28D9',
    outer: '#C084FC',
    middle: '#7C3AED',
    core: '#581C87',
  },
};

export function badgeAnimationCss(notch: Notch = 3): string {
  if (notch === 1) {
    return `
      [data-badge-anim], [databadgeanim], [dataBadgeAnim],
      [data-badge-flame-spark], [databadgeflamespark], [dataBadgeFlameSpark],
      [data-badge-flame-core], [databadgeflamecore], [dataBadgeFlameCore],
      [data-badge-sprout-left], [databadgesproutleft], [dataBadgeSproutLeft],
      [data-badge-sprout-right], [databadgesproutright], [dataBadgeSproutRight] {
        animation: none !important;
        transform: none !important;
      }
    `;
  }

  // Duration scales according to notch (1=none, 2=slow/gentle, 3=normal, 4=lively, 5=fast)
  const factor = notch === 2 ? 1.8 : notch === 4 ? 0.65 : notch === 5 ? 0.42 : 1.0;
  const flameDur = (1.5 * factor).toFixed(2);
  const sparkDur = (1.1 * factor).toFixed(2);
  const coreDur = (0.95 * factor).toFixed(2);
  const starDur = (1.8 * factor).toFixed(2);
  const leafDur = (2.4 * factor).toFixed(2);
  const sproutDur = (2.0 * factor).toFixed(2);
  const sproutLeftDur = (1.8 * factor).toFixed(2);
  const sproutRightDur = (1.8 * factor).toFixed(2);

  return `
@keyframes badge-flame-dance {
  0% { transform: scale(1) rotate(0deg); }
  20% { transform: scale(1.05, 1.08) rotate(-1.5deg); }
  45% { transform: scale(0.97, 0.95) rotate(1.2deg); }
  70% { transform: scale(1.04, 1.06) rotate(-0.8deg); }
  100% { transform: scale(1) rotate(0deg); }
}
@keyframes badge-flame-spark-float {
  0% { transform: translateY(0) scale(1); opacity: 0.85; }
  50% { transform: translateY(-3.5px) scale(1.15); opacity: 1; }
  100% { transform: translateY(1px) scale(0.88); opacity: 0.7; }
}
@keyframes badge-flame-core-pulse {
  0% { transform: scale(1) translateY(0); }
  50% { transform: scale(1.12, 1.15) translateY(-0.8px); }
  100% { transform: scale(0.94, 0.95) translateY(0.4px); }
}
@keyframes badge-star-twinkle {
  0% { transform: scale(1) rotate(0deg); }
  25% { transform: scale(1.08) rotate(4deg); }
  50% { transform: scale(0.96) rotate(-2deg); }
  75% { transform: scale(1.12) rotate(6deg); }
  100% { transform: scale(1) rotate(0deg); }
}
@keyframes badge-leaf-sway {
  0% { transform: rotate(0deg) translateY(0); }
  35% { transform: rotate(-7deg) translateY(-1.5px); }
  70% { transform: rotate(5deg) translateY(0.8px); }
  100% { transform: rotate(0deg) translateY(0); }
}
@keyframes badge-sprout-sway {
  0% { transform: rotate(0deg) scaleY(1); }
  30% { transform: rotate(-4deg) scaleY(1.04); }
  70% { transform: rotate(4deg) scaleY(1.02); }
  100% { transform: rotate(0deg) scaleY(1); }
}
@keyframes badge-sprout-left-anim {
  0% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(-7deg) scale(1.06); }
  100% { transform: rotate(0deg) scale(1); }
}
@keyframes badge-sprout-right-anim {
  0% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(7deg) scale(1.06); }
  100% { transform: rotate(0deg) scale(1); }
}

[data-badge-anim="flame"], [dataBadgeAnim="flame"], [databadgeanim="flame"] {
  transform-box: fill-box;
  transform-origin: 50% 90%;
  animation: badge-flame-dance ${flameDur}s ease-in-out infinite alternate;
}
[data-badge-flame-spark="true"], [dataBadgeFlameSpark="true"], [databadgeflamespark="true"] {
  transform-box: fill-box;
  transform-origin: 50% 50%;
  animation: badge-flame-spark-float ${sparkDur}s ease-in-out infinite alternate;
}
[data-badge-flame-core="true"], [dataBadgeFlameCore="true"], [databadgeflamecore="true"] {
  transform-box: fill-box;
  transform-origin: 50% 85%;
  animation: badge-flame-core-pulse ${coreDur}s ease-in-out infinite alternate;
}
[data-badge-anim="star"], [dataBadgeAnim="star"], [databadgeanim="star"] {
  transform-box: fill-box;
  transform-origin: 50% 50%;
  animation: badge-star-twinkle ${starDur}s ease-in-out infinite;
}
[data-badge-anim="leaf"], [dataBadgeAnim="leaf"], [databadgeanim="leaf"] {
  transform-box: fill-box;
  transform-origin: 25% 90%;
  animation: badge-leaf-sway ${leafDur}s ease-in-out infinite;
}
[data-badge-anim="sprout"], [dataBadgeAnim="sprout"], [databadgeanim="sprout"] {
  transform-box: fill-box;
  transform-origin: 50% 95%;
  animation: badge-sprout-sway ${sproutDur}s ease-in-out infinite;
}
[data-badge-sprout-left="true"], [dataBadgeSproutLeft="true"], [databadgesproutleft="true"] {
  transform-box: fill-box;
  transform-origin: 90% 80%;
  animation: badge-sprout-left-anim ${sproutLeftDur}s ease-in-out infinite alternate;
}
[data-badge-sprout-right="true"], [dataBadgeSproutRight="true"], [databadgesproutright="true"] {
  transform-box: fill-box;
  transform-origin: 10% 80%;
  animation: badge-sprout-right-anim ${sproutRightDur}s ease-in-out infinite alternate;
}
`;
}

export const BADGE_ANIMATION_CSS = badgeAnimationCss(3);

/** Icon glyphs, each drawn inside a 100x100 box with multi-layer depth and animation hooks. */
const ICONS: Record<Exclude<BadgeIcon, 'none'>, (theme: BadgeTheme) => string> = {
  flame: (theme) => `
    <g data-badge-anim="flame">
      <path d="M49 12.5C53.5 22 57 32 58.6 39.6C61.1 33.2 65.4 28.9 70 26.8C73.2 33.8 79.6 47.2 80 64C80.4 82.2 62.9 99 41 99C19.1 99 1.6 82.2 2 64C2.2 56.2 4.1 51.4 7.6 46.8C9.1 39.9 17 26.7 25.2 20C26.7 27.2 30.7 36.2 36.6 42.6C40.1 46.2 43.1 42.2 44.6 35C45.7 29.6 47.2 20 49 12.5Z" fill="${theme.outer}" />
      <path d="M34.5 42C38 47.5 41.5 51.5 43.5 55.5C45.5 51.5 48 48 51 45.5C55.5 52 58.5 60 58.5 67.5C58.5 78.5 50.7 88.5 41 88.5C31.3 88.5 23.5 78.5 23.5 67.5C23.5 58.5 28.5 48.5 34.5 42Z" fill="${theme.middle}" />
      <path data-badge-flame-spark="true" d="M38.6 1C41.7 6.2 43.2 11.2 42.2 15.2C41.1 19.7 36.6 21.1 33.6 17.7C31 14.7 31.6 8.4 38.6 1Z" fill="${theme.middle}" />
      <path data-badge-flame-core="true" d="M42.5 61C46 67 49 72.5 49 77.5C49 82.5 46 86 42.5 86C39 86 36 82.5 36 77.5C36 72.5 39 67 42.5 61Z" fill="${theme.core}" />
    </g>`,
  star: (theme) => `
    <g data-badge-anim="star">
      <path d="M50 4L62 38H98L69 59L80 95L50 73L20 95L31 59L2 38H38Z" fill="${theme.middle}" />
      <path d="M50 18L58 40H82L62 55L70 80L50 64L30 80L38 55L18 40H42Z" fill="${theme.outer}" opacity="0.88" />
      <circle cx="50" cy="50" r="7.5" fill="#FFFFFF" opacity="0.65" />
    </g>`,
  leaf: (theme) => `
    <g data-badge-anim="leaf">
      <path d="M84 10C84 10 22 6 12 52C6 80 30 96 46 90C74 80 84 40 84 10Z" fill="${theme.middle}" />
      <path d="M84 10C84 10 36 12 24 44C18 60 26 76 38 82C46 66 62 42 84 10Z" fill="${theme.outer}" opacity="0.85" />
      <path d="M20 96C24 88 34 76 48 60C62 44 74 26 84 10" stroke="${theme.core}" stroke-width="3.5" stroke-linecap="round" fill="none" />
      <path d="M38 72C31 68 22 68 15 70" stroke="${theme.core}" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.75" />
      <path d="M48 60C53 54 64 50 73 50" stroke="${theme.core}" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.75" />
      <path d="M57 48C49 42 38 40 27 39" stroke="${theme.core}" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.75" />
      <path d="M66 36C71 31 77 27 82 25" stroke="${theme.core}" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.75" />
      <ellipse cx="46" cy="30" rx="6" ry="3" fill="#FFFFFF" opacity="0.38" transform="rotate(-30 46 30)" />
    </g>`,
  sprout: (theme) => `
    <g data-badge-anim="sprout" databadgeanim="sprout">
      <!-- Soil mound / seed base -->
      <path d="M22 93C22 88 34 85 50 85C66 85 78 88 78 93C78 96.5 66 99 50 99C34 99 22 96.5 22 93Z" fill="${theme.core}" opacity="0.85" />
      <path d="M30 92C30 89 39 87 50 87C61 87 70 89 70 92C70 95 61 97 50 97C39 97 30 95 30 92Z" fill="${theme.middle}" opacity="0.65" />
      <circle cx="26" cy="93.5" r="2.2" fill="${theme.core}" />
      <circle cx="74" cy="92.5" r="1.8" fill="${theme.core}" />

      <!-- Main curved sprout stem (tapered, organic S-curve) -->
      <path d="M50 90C49 76 43 62 47 44C48 40 50 36 50 32C47 32 44 38 41 46C38 56 42 74 46 90Z" fill="${theme.middle}" />
      <!-- Stem highlight ridge -->
      <path d="M48 88C47 75 42 63 46 45C47.5 40 48.8 35 49 32" stroke="${theme.outer}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity="0.9" />

      <!-- Left baby leaf (cotyledon) - plump, organic rounded teardrop -->
      <g data-badge-sprout-left="true" databadgesproutleft="true">
        <!-- Leaf shadow / base blade -->
        <path d="M46 48C40 49 26 53 16 46C8 40 9 26 21 21C34 16 44 28 47 40C47.5 43 47 46 46 48Z" fill="${theme.middle}" />
        <!-- Inner highlight blade -->
        <path d="M44 44C38 45 28 47 20 42C14 37 14 26 23 23C32 20 41 29 44 38Z" fill="${theme.outer}" opacity="0.9" />
        <!-- Soft top contour sheen -->
        <path d="M21 22C28 20 37 25 41 33" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.45" />
        <!-- Central leaf vein & branching rib -->
        <path d="M45 44C38 42 29 38 21 29" stroke="${theme.core}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity="0.8" />
        <path d="M33 37C28 35 25 33 23 30" stroke="${theme.core}" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="0.6" />
        <!-- Morning dewdrop -->
        <ellipse cx="26" cy="27" rx="3.5" ry="2.5" fill="#FFFFFF" opacity="0.65" transform="rotate(-20 26 27)" />
        <circle cx="25.5" cy="26" r="1.2" fill="#FFFFFF" />
      </g>

      <!-- Right baby leaf (cotyledon) - curling upward & outward -->
      <g data-badge-sprout-right="true" databadgesproutright="true">
        <!-- Leaf shadow / base blade -->
        <path d="M48 42C54 44 68 47 79 40C88 34 88 20 77 15C64 9 53 20 49 34C48 37 47.8 40 48 42Z" fill="${theme.middle}" />
        <!-- Inner highlight blade -->
        <path d="M50 39C55 40 66 42 75 37C82 32 82 21 74 17C64 13 54 22 51 33Z" fill="${theme.outer}" opacity="0.9" />
        <!-- Soft top contour sheen -->
        <path d="M76 16C68 14 59 19 54 27" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.45" />
        <!-- Central leaf vein & branching rib -->
        <path d="M49 39C56 37 66 33 75 23" stroke="${theme.core}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity="0.8" />
        <path d="M62 33C67 31 71 28 73 25" stroke="${theme.core}" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="0.6" />
      </g>

      <!-- Tender unfurling center shoot (plumule) -->
      <path d="M49 34C47 25 48 15 52 10C53 9 54 9.5 54 11C53 16 51 24 50 33Z" fill="${theme.outer}" />
      <path d="M49.5 32C48.5 24 49 16 52 11" stroke="${theme.core}" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.7" />
    </g>`,
};

export function badgeIconSvg(icon: BadgeIcon, color: BadgeColor): string | null {
  if (icon === 'none') return null;
  return ICONS[icon](BADGE_THEMES[color]);
}

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
      <g transform="translate(${contentX}, 41) scale(0.16)">${badgeIconSvg(icon, color)}</g>
      <text x="${textX}" y="52.5" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="10.5" fill="${theme.text}">${s}</text>
    </g>`,
  };
}
