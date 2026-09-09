import { DEFAULT_WIDGET_MASCOT_CONFIG, type Notch, type WidgetMascotConfig } from '../src/widget/mascot/config';
import { contentWidth, MASCOT_SIZES } from '../src/widget/mascot/sizing';
import { UP_ARROW_PATH, DOWN_ARROW_PATH, SHELL_BG, DIVIDER_COLOR } from '../src/widget/mascot/chrome';
import { composeWidgetPreview } from '../src/widget/mascot/previewCompose';

const cfg = (over: Partial<WidgetMascotConfig> = {}): WidgetMascotConfig => ({
  ...DEFAULT_WIDGET_MASCOT_CONFIG,
  ...over,
});

const NOTCHES: Notch[] = [1, 2, 3, 4, 5];
const DOTS = [true, true, false, true, false, false, true];

describe('composeWidgetPreview', () => {
  it('produces a single well-formed svg root', () => {
    const { svg } = composeWidgetPreview(cfg(), 7, DOTS);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg.match(/<svg/g)).toHaveLength(1);
  });

  /** The anti-drift guard. `contentWidth` is the shared source of truth the real widget's budget
   *  is checked against; if the preview ever lays out to a different width, the two renderers
   *  have diverged and this fails. */
  it('lays out to exactly contentWidth for every layout case and notch pair', () => {
    for (const m of NOTCHES) {
      for (const b of NOTCHES) {
        for (const [showIncome, showExpense] of [
          [true, true],
          [true, false],
          [false, true],
          [false, false],
        ] as const) {
          const c = cfg({ mascotNotch: m, buttonNotch: b, showIncome, showExpense });
          expect(composeWidgetPreview(c, 7, DOTS).width).toBe(contentWidth(c));
        }
      }
    }
  });

  it('draws the widget shell, not just the mascot', () => {
    const { svg } = composeWidgetPreview(cfg(), 7, DOTS);
    expect(svg).toContain(SHELL_BG);
    expect(svg).toContain('data-preview-shell');
    expect(svg).toContain('data-part="body"');
  });

  describe('arrow visibility', () => {
    it('draws both arrows and two dividers by default', () => {
      const { svg } = composeWidgetPreview(cfg(), 7, DOTS);
      expect(svg).toContain(UP_ARROW_PATH);
      expect(svg).toContain(DOWN_ARROW_PATH);
      expect(svg.match(new RegExp(DIVIDER_COLOR, 'g'))).toHaveLength(2);
    });

    it('drops only the hidden arrow and its divider when one is off', () => {
      const income = composeWidgetPreview(cfg({ showExpense: false }), 7, DOTS).svg;
      expect(income).toContain(UP_ARROW_PATH);
      expect(income).not.toContain(DOWN_ARROW_PATH);
      expect(income.match(new RegExp(DIVIDER_COLOR, 'g'))).toHaveLength(1);

      const expense = composeWidgetPreview(cfg({ showIncome: false }), 7, DOTS).svg;
      expect(expense).toContain(DOWN_ARROW_PATH);
      expect(expense).not.toContain(UP_ARROW_PATH);
    });

    it('drops both arrows and all dividers when both are off', () => {
      const { svg } = composeWidgetPreview(cfg({ showIncome: false, showExpense: false }), 7, DOTS);
      expect(svg).not.toContain(UP_ARROW_PATH);
      expect(svg).not.toContain(DOWN_ARROW_PATH);
      expect(svg).not.toContain(DIVIDER_COLOR);
    });
  });

  describe('expanded streak column', () => {
    it('appears only when both arrows are off', () => {
      const expanded = composeWidgetPreview(cfg({ showIncome: false, showExpense: false }), 9, DOTS).svg;
      expect(expanded).toContain('data-streak-dots');
      expect(expanded).toContain('>9<');

      const compact = composeWidgetPreview(cfg(), 9, DOTS).svg;
      expect(compact).not.toContain('data-streak-dots');
    });

    it('suppresses the mascot badge so the streak is not drawn twice', () => {
      const expanded = composeWidgetPreview(cfg({ showIncome: false, showExpense: false }), 9, DOTS).svg;
      expect(expanded).not.toContain('data-part="badge"');
    });

    it('keeps the mascot badge in the compact layouts', () => {
      expect(composeWidgetPreview(cfg(), 9, DOTS).svg).toContain('data-part="badge"');
    });

    it('renders seven dots regardless of the input array length', () => {
      const { svg } = composeWidgetPreview(cfg({ showIncome: false, showExpense: false }), 3, []);
      expect(svg.match(/data-dot=/g)).toHaveLength(7);
    });
  });

  it('scales the mascot with its notch', () => {
    for (const m of NOTCHES) {
      const { svg } = composeWidgetPreview(cfg({ mascotNotch: m }), 7, DOTS);
      expect(svg).toContain(`data-mascot="${MASCOT_SIZES[m].w}x${MASCOT_SIZES[m].h}"`);
    }
  });

  it('reserves height for the tallest mascot it draws', () => {
    const small = composeWidgetPreview(cfg({ mascotNotch: 1 }), 7, DOTS).height;
    const large = composeWidgetPreview(cfg({ mascotNotch: 5 }), 7, DOTS).height;
    expect(large).toBeGreaterThanOrEqual(small);
    expect(large).toBeGreaterThanOrEqual(MASCOT_SIZES[5].h);
  });
});
