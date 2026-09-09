import { setSlot, setSlotContent } from '../src/lib/widgetCustomizer';
import { DEFAULT_WIDGET_MASCOT_CONFIG } from '../src/widget/mascot/config';
import { applyPreset } from '../src/widget/mascot/presets';

describe('setSlot', () => {
  it('changes the slot and demotes the preset to custom', () => {
    const c = setSlot(
      applyPreset(DEFAULT_WIDGET_MASCOT_CONFIG, 'nerdy'),
      'head',
      'bandana'
    );
    expect(c.head).toBe('bandana');
    expect(c.preset).toBe('custom');
  });

  it('leaves the other slots untouched', () => {
    const base = applyPreset(DEFAULT_WIDGET_MASCOT_CONFIG, 'chef');
    const c = setSlot(base, 'mouth', 'grin');
    expect(c.head).toBe(base.head);
    expect(c.eyes).toBe(base.eyes);
    expect(c.holding).toBe(base.holding);
  });

  it('does not demote when the value is unchanged', () => {
    const base = applyPreset(DEFAULT_WIDGET_MASCOT_CONFIG, 'cool');
    expect(setSlot(base, 'head', base.head).preset).toBe('cool');
  });
});

describe('setSlotContent', () => {
  const base = DEFAULT_WIDGET_MASCOT_CONFIG;

  it('sets what a slot holds', () => {
    expect(setSlotContent(base, 'slot2', 'streak').slot2).toBe('streak');
    expect(setSlotContent(base, 'slot1', 'none').slot1).toBe('none');
  });

  it('leaves the other slot alone', () => {
    expect(setSlotContent(base, 'slot2', 'none').slot1).toBe(base.slot1);
  });

  /** The parser rewrites a two-streak config on load, so the UI must never build one — otherwise
   *  a choice appears to stick and then silently changes on next launch. */
  it('moves the streak badge rather than duplicating it', () => {
    const first = setSlotContent(base, 'slot1', 'streak');
    const moved = setSlotContent(first, 'slot2', 'streak');
    expect(moved.slot2).toBe('streak');
    expect(moved.slot1).toBe('none');
  });

  it('does not clear the preset, since slots are widget layout not mascot appearance', () => {
    const themed = applyPreset(base, 'swordsman');
    expect(setSlotContent(themed, 'slot1', 'streak').preset).toBe('swordsman');
  });

  it('is a no-op when the value is unchanged', () => {
    expect(setSlotContent(base, 'slot1', base.slot1)).toBe(base);
  });
});
