// Content sizing for the widget's interior. The widget's home-screen FOOTPRINT is resized by
// Android's long-press handles (app.json targetCellWidth/Height + the WIDGET_RESIZED action in
// widgetTask.tsx); these ladders scale what is drawn inside that footprint.
import type { WidgetMascotConfig, Notch } from './config';

export const MASCOT_SIZES: Record<Notch, { w: number; h: number }> = {
  1: { w: 38, h: 32 },
  2: { w: 43, h: 36 },
  3: { w: 48, h: 40 },
  4: { w: 53, h: 44 },
  5: { w: 58, h: 48 },
};

export const BUTTON_SIZES: Record<Notch, number> = { 1: 18, 2: 22, 3: 26, 4: 30, 5: 34 };

/** Raised from the 110dp app.json used to declare, which today's own default contents already
 *  exceeded (58 + 26 + 26 + 2 + 16 = 128dp). 150dp covers the widest combination
 *  (58 + 34 + 34 + 2 + 16 = 144dp) and is still a 2-cell widget on typical launchers. */
export const WIDTH_BUDGET_DP = 150;
export const HEIGHT_BUDGET_DP = 50;

const H_PADDING = 16;
const DIVIDER = 1;
/** Expanded streak column: a 7-dot row at 8dp with 2dp gaps, which also comfortably fits the
 *  count rendered above it. */
const STREAK_COLUMN = 68;
const COLUMN_GAP = 8;

export function contentWidth(c: WidgetMascotConfig): number {
  const mascot = MASCOT_SIZES[c.mascotNotch].w;
  const button = BUTTON_SIZES[c.buttonNotch];
  const arrows = (c.showIncome ? 1 : 0) + (c.showExpense ? 1 : 0);

  if (arrows === 0) {
    return STREAK_COLUMN;
  }
  return H_PADDING + mascot + arrows * (DIVIDER + button);
}
