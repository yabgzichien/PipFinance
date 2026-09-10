import { BADGE_ANIMATION_CSS, BADGE_THEMES, badgeAnimationCss, badgeIconSvg, badgeLayer } from '../src/widget/mascot/badge';
import type { BadgeColor, BadgeIcon } from '../src/widget/mascot/config';

describe('Badge multi-layer artwork and animation hooks', () => {
  const ICONS: Exclude<BadgeIcon, 'none'>[] = ['flame', 'star', 'leaf', 'sprout'];
  const COLORS: BadgeColor[] = ['amber', 'red', 'green', 'blue', 'violet'];

  describe('5-notch badgeAnimationCss', () => {
    it('provides BADGE_ANIMATION_CSS with default notch 3 animation rules', () => {
      expect(BADGE_ANIMATION_CSS).toContain('@keyframes badge-flame-dance');
      expect(BADGE_ANIMATION_CSS).toContain('@keyframes badge-star-twinkle');
      expect(BADGE_ANIMATION_CSS).toContain('@keyframes badge-leaf-sway');
      expect(BADGE_ANIMATION_CSS).toContain('@keyframes badge-sprout-sway');
      expect(BADGE_ANIMATION_CSS).toContain('[data-badge-anim="flame"]');
      expect(BADGE_ANIMATION_CSS).toContain('[data-badge-anim="star"]');
      expect(BADGE_ANIMATION_CSS).toContain('[data-badge-anim="leaf"]');
      expect(BADGE_ANIMATION_CSS).toContain('[data-badge-anim="sprout"]');
      expect(BADGE_ANIMATION_CSS).toContain('1.50s'); // default flame duration
    });

    it('returns animation: none !important when notch is 1 (no animation)', () => {
      const css = badgeAnimationCss(1);
      expect(css).toContain('animation: none !important;');
      expect(css).toContain('transform: none !important;');
      expect(css).not.toContain('@keyframes');
    });

    it('scales animation speed across notches 2 to 5', () => {
      const css2 = badgeAnimationCss(2); // slow
      const css3 = badgeAnimationCss(3); // default (1.0x)
      const css4 = badgeAnimationCss(4); // lively
      const css5 = badgeAnimationCss(5); // fast

      // Duration: 2 (longest) > 3 > 4 > 5 (shortest)
      expect(css2).toContain('2.70s'); // 1.5 * 1.8
      expect(css3).toContain('1.50s'); // 1.5 * 1.0
      expect(css4).toContain('0.98s'); // 1.5 * 0.65 = 0.975 -> 0.98s
      expect(css5).toContain('0.63s'); // 1.5 * 0.42 = 0.63s
    });
  });

  describe('flame badge multi-layer depth for all colors', () => {
    for (const color of COLORS) {
      it(`renders flame with 3-tier depth (outer, middle, core) for ${color}`, () => {
        const theme = BADGE_THEMES[color];
        expect(theme.outer).toBeDefined();
        expect(theme.middle).toBeDefined();
        expect(theme.core).toBeDefined();
        expect(theme.outer).not.toBe(theme.middle);
        expect(theme.middle).not.toBe(theme.core);

        const svg = badgeIconSvg('flame', color);
        expect(svg).not.toBeNull();
        expect(svg).toContain(`data-badge-anim="flame"`);
        expect(svg).toContain(`data-badge-flame-spark="true"`);
        expect(svg).toContain(`data-badge-flame-core="true"`);

        expect(svg).toContain(theme.outer);
        expect(svg).toContain(theme.middle);
        expect(theme.core).toBeDefined();
        expect(svg).toContain(theme.core);
      });
    }
  });

  describe('leaf badge multi-layer detail', () => {
    for (const color of COLORS) {
      it(`renders leaf with blade base, highlight, central spine, and branching veins for ${color}`, () => {
        const theme = BADGE_THEMES[color];
        const svg = badgeIconSvg('leaf', color);
        expect(svg).not.toBeNull();
        expect(svg).toContain(`data-badge-anim="leaf"`);
        expect(svg).toContain(theme.middle);
        expect(svg).toContain(theme.outer);
        expect(svg).toContain(theme.core);
        expect(svg).toContain('#FFFFFF');
      });
    }
  });

  describe('sprout badge organic botanical detail', () => {
    for (const color of COLORS) {
      it(`renders sprout with soil mound, curved stem, cotyledon leaves, dewdrop glint, and shoot for ${color}`, () => {
        const theme = BADGE_THEMES[color];
        const svg = badgeIconSvg('sprout', color);
        expect(svg).not.toBeNull();
        expect(svg).toContain(`data-badge-anim="sprout"`);
        expect(svg).toContain(`data-badge-sprout-left="true"`);
        expect(svg).toContain(`data-badge-sprout-right="true"`);
        expect(svg).toContain(theme.core);
        expect(svg).toContain(theme.middle);
        expect(svg).toContain(theme.outer);
        expect(svg).toContain('#FFFFFF'); // dewdrop glint and contour sheen
      });
    }
  });

  describe('star badge dimensional detail', () => {
    for (const color of COLORS) {
      it(`renders star with inner facet and glint for ${color}`, () => {
        const theme = BADGE_THEMES[color];
        const svg = badgeIconSvg('star', color);
        expect(svg).not.toBeNull();
        expect(svg).toContain(`data-badge-anim="star"`);
        expect(svg).toContain(theme.middle);
        expect(svg).toContain(theme.outer);
        expect(svg).toContain('#FFFFFF');
      });
    }
  });

  it('renders badgeLayer with animation-ready icon inside pill', () => {
    const layer = badgeLayer('flame', 'green', 5);
    expect(layer).not.toBeNull();
    expect(layer?.svg).toContain('data-part="badge"');
    expect(layer?.svg).toContain('data-badge-anim="flame"');
    expect(layer?.svg).toContain(BADGE_THEMES.green.core);
  });
});
