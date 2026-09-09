// The in-app widget preview: the whole widget as ONE SVG string.
//
// The customizer cannot mount the real widget — QuickRecordWidget is built from
// FlexWidget/SvgWidget/TextWidget, which are Android RemoteViews components with no React Native
// renderer. Previewing only the mascot (what this screen did before) left the arrow toggles, the
// dividers, the shell and the expanded streak column invisible, so half the settings changed
// nothing on screen.
//
// This module draws the same widget with SVG primitives instead. The duplication is deliberate
// and bounded: every colour, glyph and typography value comes from chrome.ts, the mascot comes
// from composeMascotBody, and the horizontal arithmetic uses the same constants `contentWidth`
// uses. `__tests__/widgetPreviewCompose.test.ts` asserts the resulting width equals
// `contentWidth(config)` for every layout case and notch pair, so a divergence fails CI rather
// than shipping as a preview that lies.
import type { WidgetMascotConfig } from './config';
import { composeMascotBody, MASCOT_VIEW_W, MASCOT_VIEW_H } from './compose';
import { BADGE_THEMES, badgeIconSvg } from './badge';
import {
  COLUMN_GAP,
  DIVIDER,
  MASCOT_SIZES,
  STREAK_COLUMN,
  contentHeight,
  contentWidth,
  slotWidth,
} from './sizing';
import {
  DIVIDER_COLOR,
  DIVIDER_HEIGHT,
  DOTS_ROW_HEIGHT,
  DOTS_ROW_WIDTH,
  SHELL_BG,
  SHELL_PADDING_H,
  SHELL_PADDING_V,
  SHELL_RADIUS,
  STREAK_COUNT_FONT_SIZE,
  STREAK_ICON_SIZE,
  STREAK_STACK_GAP,
  dotsRowFragment,
  downArrowFragment,
  streakSlotMetrics,
  upArrowFragment,
} from './chrome';

export interface WidgetPreview {
  svg: string;
  width: number;
  height: number;
}

/**
 * One option tile's artwork: the mascot drawn through a framing viewBox, so a tab can crop to the
 * feature being chosen.
 *
 * The customizer's tiles carry no text, so the picture has to carry the whole distinction — and
 * on a whole mascot at tile size, two mouth shapes are nearly identical. Cropping to the mouth
 * makes them obvious. The badge is always suppressed here: a streak pill on every tile would sit
 * over the very features being compared.
 */
export function composeMascotThumbnail(
  config: WidgetMascotConfig,
  frame: { x: number; y: number; w: number; h: number }
): string {
  const body = composeMascotBody({ ...config, badgeIcon: 'none' }, 0);
  return `<svg viewBox="${frame.x} ${frame.y} ${frame.w} ${frame.h}" fill="none" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
${body}
</svg>`;
}

/** Approximate advance width of a digit at STREAK_COUNT_FONT_SIZE / weight 700. Only used to
 *  centre the icon+count pair as a cluster; the text itself is anchored, so a small error shifts
 *  the pair by a pixel rather than clipping it. */
const DIGIT_W = 10.5;

/** Draws the mascot body scaled into a w x h box at (x, y). */
function mascotGroup(config: WidgetMascotConfig, streak: number, x: number, y: number, w: number, h: number): string {
  const sx = w / MASCOT_VIEW_W;
  const sy = h / MASCOT_VIEW_H;
  return `<g data-mascot="${w}x${h}" transform="translate(${x}, ${y}) scale(${round(sx)}, ${round(sy)})">
${composeMascotBody(config, streak)}
</g>`;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function divider(x: number, height: number): string {
  const y = (height - DIVIDER_HEIGHT) / 2;
  return `<rect x="${round(x)}" y="${round(y)}" width="${DIVIDER}" height="${DIVIDER_HEIGHT}" fill="${DIVIDER_COLOR}" />`;
}

/** Centres a 28x28 arrow glyph in a `button`-sized cell starting at x. */
function arrowGroup(fragment: string, x: number, height: number, button: number): string {
  const scale = button / 28;
  const y = (height - button) / 2;
  return `<g transform="translate(${round(x)}, ${round(y)}) scale(${round(scale)})">${fragment}</g>`;
}

/**
 * The expanded (arrows-off) streak column: badge icon and count on one row, seven-day dots below.
 *
 * Mirrors the widget's nested FlexWidget column — same 4dp stack gap, same 16dp icon, same 18pt
 * bold count in the badge's text colour.
 */
function streakColumn(config: WidgetMascotConfig, streak: number, dots: boolean[], x: number, height: number): string {
  const theme = BADGE_THEMES[config.badgeColor];
  const icon = badgeIconSvg(config.badgeIcon, config.badgeColor);
  const count = String(streak);

  const rowH = Math.max(STREAK_ICON_SIZE, STREAK_COUNT_FONT_SIZE);
  const stackH = rowH + STREAK_STACK_GAP + DOTS_ROW_HEIGHT;
  const top = (height - stackH) / 2;

  const textW = count.length * DIGIT_W;
  const clusterW = (icon ? STREAK_ICON_SIZE + STREAK_STACK_GAP : 0) + textW;
  const clusterX = x + (STREAK_COLUMN - clusterW) / 2;

  const iconGroup = icon
    ? `<g transform="translate(${round(clusterX)}, ${round(top + (rowH - STREAK_ICON_SIZE) / 2)}) scale(${round(STREAK_ICON_SIZE / 100)})">${icon}</g>`
    : '';
  const textX = clusterX + (icon ? STREAK_ICON_SIZE + STREAK_STACK_GAP : 0) + textW / 2;

  const dotsX = x + (STREAK_COLUMN - DOTS_ROW_WIDTH) / 2;
  const dotsY = top + rowH + STREAK_STACK_GAP;

  return `${iconGroup}
<text x="${round(textX)}" y="${round(top + rowH - 2)}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="${STREAK_COUNT_FONT_SIZE}" fill="${theme.text}">${count}</text>
<g data-streak-dots transform="translate(${round(dotsX)}, ${round(dotsY)})">${dotsRowFragment(dots, theme.icon)}</g>`;
}

/**
 * A streak badge occupying one of the two slots: icon and count on a row, centred in the slot.
 *
 * Read-only in the real widget — it carries no tap target there, so the mascot stays the only
 * add action — but the preview only has to draw it.
 */
function streakSlot(
  config: WidgetMascotConfig,
  streak: number,
  x: number,
  height: number,
  size: number
): string {
  const theme = BADGE_THEMES[config.badgeColor];
  const icon = badgeIconSvg(config.badgeIcon, config.badgeColor);
  const m = streakSlotMetrics(size);
  const count = String(streak);

  const textW = count.length * m.font * 0.58;
  const clusterW = (icon ? m.icon + m.gap : 0) + textW;
  const clusterX = x + (size - clusterW) / 2;
  const centreY = height / 2;

  const iconGroup = icon
    ? `<g transform="translate(${round(clusterX)}, ${round(centreY - m.icon / 2)}) scale(${round(m.icon / 100)})">${icon}</g>`
    : '';
  const textX = clusterX + (icon ? m.icon + m.gap : 0) + textW / 2;

  return `<g data-streak-slot>${iconGroup}
<text x="${round(textX)}" y="${round(centreY + m.font * 0.36)}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="${m.font}" fill="${theme.text}">${count}</text></g>`;
}

/**
 * Compose the whole widget for preview.
 *
 * Laid out at exactly `contentWidth(config)` — the widget's tightest packing, and the width its
 * budget is checked against. On a home screen the launcher may hand the widget a wider cell and
 * the flex columns spread out; the preview deliberately shows the minimum-width case rather than
 * guessing a device's cell size.
 */
export function composeWidgetPreview(
  config: WidgetMascotConfig,
  streak: number,
  dots: boolean[]
): WidgetPreview {
  const mascot = MASCOT_SIZES[config.mascotNotch];
  const expanded = config.slot1 === 'none' && config.slot2 === 'none';
  const hasStreakSlot = config.slot1 === 'streak' || config.slot2 === 'streak';

  const width = contentWidth(config);
  const height = contentHeight(config);

  const body: string[] = [
    `<rect data-preview-shell x="0" y="0" width="${width}" height="${height}" rx="${SHELL_RADIUS}" fill="${SHELL_BG}" />`,
  ];

  let x = SHELL_PADDING_H;
  const mascotY = (height - mascot.h) / 2;

  // The mascot's own badge is suppressed wherever the streak is already shown elsewhere — in the
  // expanded column or in a slot — so the count never appears twice.
  body.push(
    mascotGroup(
      expanded || hasStreakSlot ? { ...config, badgeIcon: 'none' } : config,
      streak,
      x,
      mascotY,
      mascot.w,
      mascot.h
    )
  );
  x += mascot.w;

  if (expanded) {
    x += COLUMN_GAP;
    body.push(streakColumn(config, streak, dots, x, height));
  } else {
    for (const which of ['slot1', 'slot2'] as const) {
      const content = config[which];
      if (content === 'none') continue;
      const size = slotWidth(config, which);

      body.push(divider(x, height));
      x += DIVIDER;

      if (content === 'streak') {
        body.push(streakSlot(config, streak, x, height, size));
      } else {
        const fragment = content === 'income' ? upArrowFragment() : downArrowFragment();
        body.push(arrowGroup(fragment, x, height, size));
      }
      x += size;
    }
  }

  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
${body.join('\n')}
</svg>`;

  return { svg, width, height };
}
