import { DEFAULT_WIDGET_MASCOT_CONFIG, type Notch } from '../src/widget/mascot/config';
import { MASCOT_SIZES, BUTTON_SIZES, WIDTH_BUDGET_DP, contentWidth } from '../src/widget/mascot/sizing';

const NOTCHES: Notch[] = [1, 2, 3, 4, 5];

describe('sizing', () => {
  it('defaults reproduce the pre-customization dimensions', () => {
    expect(MASCOT_SIZES[5]).toEqual({ w: 58, h: 48 });
    expect(BUTTON_SIZES[3]).toBe(26);
  });

  it('both ladders increase monotonically', () => {
    for (let n = 2; n <= 5; n++) {
      expect(MASCOT_SIZES[n as Notch].w).toBeGreaterThan(MASCOT_SIZES[(n - 1) as Notch].w);
      expect(BUTTON_SIZES[n as Notch]).toBeGreaterThan(BUTTON_SIZES[(n - 1) as Notch]);
    }
  });

  it('every one of the 25 notch pairs fits the width budget with both arrows shown', () => {
    for (const m of NOTCHES) {
      for (const b of NOTCHES) {
        const c = { ...DEFAULT_WIDGET_MASCOT_CONFIG, mascotNotch: m, buttonNotch: b };
        expect(contentWidth(c)).toBeLessThanOrEqual(WIDTH_BUDGET_DP);
      }
    }
  });

  it('drops the divider and button width when an arrow is hidden', () => {
    const both = { ...DEFAULT_WIDGET_MASCOT_CONFIG };
    const one = { ...both, showExpense: false };
    const none = { ...both, showIncome: false, showExpense: false };
    expect(contentWidth(one)).toBeLessThan(contentWidth(both));
    expect(contentWidth(none)).toBeLessThan(contentWidth(one));
  });

  it('the expanded arrows-off layout also fits the budget', () => {
    for (const m of NOTCHES) {
      const c = { ...DEFAULT_WIDGET_MASCOT_CONFIG, mascotNotch: m, showIncome: false, showExpense: false };
      expect(contentWidth(c)).toBeLessThanOrEqual(WIDTH_BUDGET_DP);
    }
  });
});
