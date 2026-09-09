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
  BUTTON_SIZES,
  COLUMN_GAP,
  DIVIDER,
  HEIGHT_BUDGET_DP,
  MASCOT_SIZES,
  STREAK_COLUMN,
  contentWidth,
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
  upArrowFragment,
} from './chrome';

export interface WidgetPreview {
  svg: string;
  width: number;
  height: number;
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
  const button = BUTTON_SIZES[config.buttonNotch];
  const expanded = !config.showIncome && !config.showExpense;

  const width = contentWidth(config);
  const height = Math.max(HEIGHT_BUDGET_DP, mascot.h + SHELL_PADDING_V * 2);

  const body: string[] = [
    `<rect data-preview-shell x="0" y="0" width="${width}" height="${height}" rx="${SHELL_RADIUS}" fill="${SHELL_BG}" />`,
  ];

  let x = SHELL_PADDING_H;
  const mascotY = (height - mascot.h) / 2;

  // The badge is drawn into the mascot only in the compact layouts. When expanded, the count is
  // rendered beside the dots instead, so keeping the pill would show the streak twice.
  body.push(
    mascotGroup(
      expanded ? { ...config, badgeIcon: 'none' } : config,
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
    if (config.showIncome) {
      body.push(divider(x, height));
      x += DIVIDER;
      body.push(arrowGroup(upArrowFragment(), x, height, button));
      x += button;
    }
    if (config.showExpense) {
      body.push(divider(x, height));
      x += DIVIDER;
      body.push(arrowGroup(downArrowFragment(), x, height, button));
      x += button;
    }
  }

  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
${body.join('\n')}
</svg>`;

  return { svg, width, height };
}
