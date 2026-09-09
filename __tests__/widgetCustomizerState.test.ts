import { setSlot } from '../src/lib/widgetCustomizer';
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
