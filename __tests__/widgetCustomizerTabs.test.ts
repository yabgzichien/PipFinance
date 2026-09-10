import { DEFAULT_WIDGET_MASCOT_CONFIG, type WidgetMascotConfig } from '../src/widget/mascot/config';
import { PART_CATALOG } from '../src/widget/mascot/parts';
import {
  CUSTOMIZER_TABS,
  SLOT_TABS,
  THUMB_FRAMES,
  isSlotTab,
  modifiedTabs,
  tabIsModified,
} from '../src/lib/widgetCustomizerTabs';

const cfg = (over: Partial<WidgetMascotConfig> = {}): WidgetMascotConfig => ({
  ...DEFAULT_WIDGET_MASCOT_CONFIG,
  ...over,
});

describe('tab structure', () => {
  it('has the six agreed tabs in order', () => {
    expect(CUSTOMIZER_TABS).toEqual(['preset', 'head', 'eyes', 'mouth', 'holding', 'badge']);
  });

  it('identifies exactly the catalog-backed tabs as slot tabs', () => {
    expect(CUSTOMIZER_TABS.filter(isSlotTab)).toEqual(SLOT_TABS);
    for (const slot of SLOT_TABS) {
      expect(PART_CATALOG[slot]).toBeDefined();
    }
  });

  it('gives every tab a thumbnail frame inside the mascot viewBox', () => {
    for (const tab of CUSTOMIZER_TABS) {
      const f = THUMB_FRAMES[tab];
      expect(f.w).toBeGreaterThan(0);
      expect(f.h).toBeGreaterThan(0);
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.x + f.w).toBeLessThanOrEqual(76);
      expect(f.y + f.h).toBeLessThanOrEqual(64);
    }
  });

  it('crops the face tabs rather than showing the whole mascot', () => {
    // The crop is what lets the tiles drop their text labels: two mouths look alike on a whole
    // mascot at 56px, and distinct when the tile is framed on the mouth.
    for (const tab of ['head', 'eyes', 'mouth'] as const) {
      const f = THUMB_FRAMES[tab];
      expect(f.w).toBeLessThan(76);
      expect(f.h).toBeLessThan(64);
    }
    expect(THUMB_FRAMES.holding).toEqual({ x: 0, y: 0, w: 76, h: 64 });
    expect(THUMB_FRAMES.preset).toEqual({ x: 0, y: 0, w: 76, h: 64 });
  });

  it('frames the mouth below the eyes', () => {
    expect(THUMB_FRAMES.mouth.y).toBeGreaterThan(THUMB_FRAMES.eyes.y);
    expect(THUMB_FRAMES.head.y).toBeLessThan(THUMB_FRAMES.eyes.y);
  });
});

describe('tabIsModified', () => {
  it('reports nothing modified for a stock config', () => {
    expect(modifiedTabs(DEFAULT_WIDGET_MASCOT_CONFIG)).toEqual([]);
  });

  it.each([
    ['preset', cfg({ preset: 'swordsman' })],
    ['head', cfg({ head: 'bandana' })],
    ['eyes', cfg({ eyes: 'shades' })],
    ['mouth', cfg({ mouth: 'grin' })],
    ['holding', cfg({ holding: 'lollipop' })],
    ['badge', cfg({ badgeColor: 'violet' })],
  ])('flags the %s tab when its own field changes', (tab, config) => {
    expect(tabIsModified(tab as never, config)).toBe(true);
    expect(modifiedTabs(config)).toEqual([tab]);
  });

  it('does not flag a tab for a change another tab owns', () => {
    const config = cfg({ head: 'strawHat' });
    expect(tabIsModified('eyes', config)).toBe(false);
    expect(tabIsModified('badge', config)).toBe(false);
  });

  it('reports several tabs at once, in display order', () => {
    const config = cfg({ badgeIcon: 'star', head: 'goggles', mascotNotch: 1 });
    expect(modifiedTabs(config)).toEqual(['head', 'badge']);
  });
});
