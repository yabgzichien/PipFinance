import {
  DEFAULT_WIDGET_MASCOT_CONFIG,
  type Notch,
  type SlotContent,
  type WidgetMascotConfig,
} from '../src/widget/mascot/config';
import { MASCOT_SIZES } from '../src/widget/mascot/sizing';
import { UP_ARROW_PATH, DOWN_ARROW_PATH, SHELL_BG, DIVIDER_COLOR } from '../src/widget/mascot/chrome';
import { composeWidgetPreview, PREVIEW_WIDTH, PREVIEW_HEIGHT } from '../src/widget/mascot/previewCompose';

const cfg = (over: Partial<WidgetMascotConfig> = {}): WidgetMascotConfig => ({
  ...DEFAULT_WIDGET_MASCOT_CONFIG,
  ...over,
});

const NOTCHES: Notch[] = [1, 2, 3, 4, 5];
const CONTENTS: SlotContent[] = ['income', 'expense', 'streak', 'none'];
const DOTS = [true, true, false, true, false, false, true];

describe('composeWidgetPreview', () => {
  it('produces a single well-formed svg root', () => {
    const { svg } = composeWidgetPreview(cfg(), 7, DOTS);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg.match(/<svg/g)).toHaveLength(1);
  });

  it('keeps the widget container size constant across all mascot and button notch sizes', () => {
    for (const m of NOTCHES) {
      for (const b of NOTCHES) {
        for (const slot1 of CONTENTS) {
          for (const slot2 of CONTENTS) {
            if (slot1 === 'streak' && slot2 === 'streak') continue; // unreachable via the parser
            const c = cfg({ mascotNotch: m, buttonNotch: b, slot1, slot2 });
            const p = composeWidgetPreview(c, 7, DOTS);
            expect(p.width).toBe(PREVIEW_WIDTH);
            expect(p.height).toBe(PREVIEW_HEIGHT);
          }
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

  it('scales the mascot with its notch', () => {
    for (const m of NOTCHES) {
      const { svg } = composeWidgetPreview(cfg({ mascotNotch: m }), 7, DOTS);
      expect(svg).toContain(`data-mascot="${MASCOT_SIZES[m].w}x${MASCOT_SIZES[m].h}"`);
    }
  });
});

describe('slot contents', () => {
  it('draws both arrows and two dividers by default', () => {
    const { svg } = composeWidgetPreview(cfg(), 7, DOTS);
    expect(svg).toContain(UP_ARROW_PATH);
    expect(svg).toContain(DOWN_ARROW_PATH);
    expect(svg.match(new RegExp(DIVIDER_COLOR, 'g'))).toHaveLength(2);
  });

  it('draws only the content each slot holds', () => {
    const incomeOnly = composeWidgetPreview(cfg({ slot2: 'none' }), 7, DOTS).svg;
    expect(incomeOnly).toContain(UP_ARROW_PATH);
    expect(incomeOnly).not.toContain(DOWN_ARROW_PATH);
    expect(incomeOnly.match(new RegExp(DIVIDER_COLOR, 'g'))).toHaveLength(1);

    const expenseOnly = composeWidgetPreview(cfg({ slot1: 'expense', slot2: 'none' }), 7, DOTS).svg;
    expect(expenseOnly).toContain(DOWN_ARROW_PATH);
    expect(expenseOnly).not.toContain(UP_ARROW_PATH);
  });

  it('honours slot order, so the same pair can be drawn either way round', () => {
    const a = composeWidgetPreview(cfg({ slot1: 'income', slot2: 'expense' }), 7, DOTS).svg;
    const b = composeWidgetPreview(cfg({ slot1: 'expense', slot2: 'income' }), 7, DOTS).svg;
    expect(a.indexOf(UP_ARROW_PATH)).toBeLessThan(a.indexOf(DOWN_ARROW_PATH));
    expect(b.indexOf(DOWN_ARROW_PATH)).toBeLessThan(b.indexOf(UP_ARROW_PATH));
  });

  describe('streak badge in a slot', () => {
    it('draws the count in the slot and drops the mascot pill when paired with an arrow', () => {
      const { svg } = composeWidgetPreview(cfg({ slot1: 'income', slot2: 'streak' }), 9, DOTS);
      expect(svg).toContain('data-streak-slot');
      expect(svg).toContain('>9<');
      // Suppressed so the streak is not shown twice.
      expect(svg).not.toContain('data-part="badge"');
    });

    it('pairs with an arrow in the other slot', () => {
      const { svg } = composeWidgetPreview(cfg({ slot1: 'income', slot2: 'streak' }), 4, DOTS);
      expect(svg).toContain(UP_ARROW_PATH);
      expect(svg).toContain('data-streak-slot');
      expect(svg).not.toContain(DOWN_ARROW_PATH);
    });

    it('keeps the mascot pill when no slot shows the streak', () => {
      expect(composeWidgetPreview(cfg(), 9, DOTS).svg).toContain('data-part="badge"');
    });
  });
});

describe('streak layout (fire selected)', () => {
  const fireSelected = (streak = 9, dots = DOTS) =>
    composeWidgetPreview(cfg({ slot1: 'streak', slot2: 'none' }), streak, dots).svg;

  it('shows the count and the seven-day dots when fire is selected', () => {
    expect(fireSelected()).toContain('data-streak-dots');
    expect(fireSelected()).toContain('>9<');
  });

  it('drops all arrows and dividers', () => {
    expect(fireSelected()).not.toContain(UP_ARROW_PATH);
    expect(fireSelected()).not.toContain(DOWN_ARROW_PATH);
    expect(fireSelected()).not.toContain(DIVIDER_COLOR);
  });

  it('suppresses the mascot badge so the streak is not drawn twice', () => {
    expect(fireSelected()).not.toContain('data-part="badge"');
  });

  it('renders seven dots regardless of the input array length', () => {
    expect(fireSelected(3, []).match(/data-dot=/g)).toHaveLength(7);
  });

  it('leaves the right side completely empty and centers/enlarges mascot when none is selected for both slots', () => {
    const noneSvg = composeWidgetPreview(cfg({ slot1: 'none', slot2: 'none' }), 9, DOTS).svg;
    expect(noneSvg).not.toContain('data-streak-dots');
    expect(noneSvg).not.toContain('data-streak-slot');
    expect(noneSvg).not.toContain(UP_ARROW_PATH);
    expect(noneSvg).not.toContain(DOWN_ARROW_PATH);
    expect(noneSvg).not.toContain(DIVIDER_COLOR);

    // Mascot is centered horizontally and enlarged by 1.35x
    const enlargedW = Math.round(MASCOT_SIZES[3].w * 1.35);
    const enlargedH = Math.round(MASCOT_SIZES[3].h * 1.35);
    expect(noneSvg).toContain(`data-mascot="${enlargedW}x${enlargedH}"`);
    const expectedX = PREVIEW_WIDTH / 2 - enlargedW / 2;
    expect(noneSvg).toContain(`transform="translate(${expectedX},`);
  });

  it('falls back to flame icon if badgeIcon is none when fire is selected', () => {
    const svg = composeWidgetPreview(cfg({ slot1: 'streak', slot2: 'none', badgeIcon: 'none' }), 9, DOTS).svg;
    expect(svg).toContain('data-badge-anim="flame"');
  });

  it('does not show streak dots when only arrows are used', () => {
    expect(composeWidgetPreview(cfg(), 9, DOTS).svg).not.toContain('data-streak-dots');
  });

  it('scales the fire icon and count with button size notch when fire is selected', () => {
    const notch1 = composeWidgetPreview(cfg({ slot1: 'streak', slot2: 'none', buttonNotch: 1 }), 9, DOTS).svg;
    const notch5 = composeWidgetPreview(cfg({ slot1: 'streak', slot2: 'none', buttonNotch: 5 }), 9, DOTS).svg;
    expect(notch1).toContain('scale(0.24)');
    expect(notch5).toContain('scale(0.44)');
    expect(notch1).toContain('font-size="15"');
    expect(notch5).toContain('font-size="22"');
  });
});
