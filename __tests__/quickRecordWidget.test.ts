import React from 'react';
import { QuickRecordWidget } from '../src/widget/QuickRecordWidget';
import { DEFAULT_WIDGET_MASCOT_CONFIG } from '../src/widget/mascot/config';
import { MASCOT_SIZES, BUTTON_SIZES } from '../src/widget/mascot/sizing';

const cfg = (over = {}) => ({ ...DEFAULT_WIDGET_MASCOT_CONFIG, ...over });

/** Recursively collects every element carrying a clickActionData uri. */
function byUri(el: any): Record<string, any> {
  const out: Record<string, any> = {};
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    const uri = node.props?.clickActionData?.uri;
    if (uri) out[uri] = node;
    React.Children.toArray(node.props?.children ?? []).forEach(walk);
  };
  walk(el);
  return out;
}

describe('QuickRecordWidget layout', () => {
  it('renders mascot, income and expense targets by default', () => {
    const found = byUri(QuickRecordWidget({ streak: 5, config: cfg() }));
    expect(Object.keys(found).sort()).toEqual(
      ['pip://add', 'pip://add?type=expense', 'pip://add?type=income'].sort()
    );
  });

  it('drops only the emptied slot', () => {
    const found = byUri(QuickRecordWidget({ streak: 5, config: cfg({ slot2: 'none' }) }));
    expect(found['pip://add?type=income']).toBeDefined();
    expect(found['pip://add?type=expense']).toBeUndefined();
    expect(found['pip://add']).toBeDefined();
  });

  it('collapses to a single add target when both slots are empty', () => {
    const found = byUri(QuickRecordWidget({ streak: 5, config: cfg({ slot1: 'none', slot2: 'none' }) }));
    expect(Object.keys(found)).toEqual(['pip://add']);
  });

  it('shows the expanded streak count and 7 dots when fire is selected', () => {
    const dots = [true, true, false, true, false, false, true];
    const withFire = QuickRecordWidget({ streak: 9, dots, config: cfg({ slot1: 'streak', slot2: 'none' }) });
    const json = JSON.stringify(withFire);
    expect(json).toContain('data-streak-dots');
    const compact = QuickRecordWidget({ streak: 9, dots, config: cfg() });
    expect(JSON.stringify(compact)).not.toContain('data-streak-dots');
    const withNone = QuickRecordWidget({ streak: 9, dots, config: cfg({ slot1: 'none', slot2: 'none' }) });
    expect(JSON.stringify(withNone)).not.toContain('data-streak-dots');
  });

  it('scales the fire icon and count with buttonNotch when fire is selected', () => {
    const dots = [true, true, false, true, false, false, true];
    const notch1 = QuickRecordWidget({ streak: 9, dots, config: cfg({ slot1: 'streak', slot2: 'none', buttonNotch: 1 }) });
    const notch5 = QuickRecordWidget({ streak: 9, dots, config: cfg({ slot1: 'streak', slot2: 'none', buttonNotch: 5 }) });
    expect(JSON.stringify(notch1)).toContain('"width":24,"height":24');
    expect(JSON.stringify(notch5)).toContain('"width":44,"height":44');
    expect(JSON.stringify(notch1)).toContain('"fontSize":15');
    expect(JSON.stringify(notch5)).toContain('"fontSize":22');
  });

  it('honours the selected badge icon and colour when fire is selected', () => {
    const withFire = QuickRecordWidget({
      streak: 9,
      config: cfg({
        slot1: 'streak',
        slot2: 'none',
        badgeIcon: 'star',
        badgeColor: 'blue',
      }),
    });
    const json = JSON.stringify(withFire);
    expect(json).toContain('data-streak-icon');
    expect(json).toContain('#2563EB');

    const withoutIcon = JSON.stringify(
      QuickRecordWidget({
        streak: 9,
        config: cfg({ slot1: 'streak', slot2: 'none', badgeIcon: 'none' }),
      })
    );
    expect(withoutIcon).not.toContain('data-streak-icon');
  });

  it('renders a streak badge in a slot without giving it a tap target', () => {
    // The badge is an indicator, not an action — the mascot stays the widget's only add target
    // besides the arrows, so the streak slot carries no clickAction.
    const found = byUri(QuickRecordWidget({ streak: 6, config: cfg({ slot2: 'streak' }) }));
    expect(Object.keys(found).sort()).toEqual(['pip://add', 'pip://add?type=income'].sort());

    const json = JSON.stringify(QuickRecordWidget({ streak: 6, config: cfg({ slot2: 'streak' }) }));
    expect(json).toContain('data-streak-icon');
    expect(json).toContain('"text":"6"');
  });

  it('suppresses the mascot pill when a slot shows the streak', () => {
    const withSlot = JSON.stringify(QuickRecordWidget({ streak: 6, config: cfg({ slot2: 'streak' }) }));
    expect(withSlot).not.toContain('data-part=\\"badge\\"');

    const withoutSlot = JSON.stringify(QuickRecordWidget({ streak: 6, config: cfg() }));
    expect(withoutSlot).toContain('data-part=\\"badge\\"');
  });

  it('applies the mascot and button size notches', () => {
    const el = QuickRecordWidget({ streak: 1, config: cfg({ mascotNotch: 2, buttonNotch: 5 }) });
    const json = JSON.stringify(el);
    expect(json).toContain(`"width":${MASCOT_SIZES[2].w}`);
    expect(json).toContain(`"width":${BUTTON_SIZES[5]}`);
  });

  it('renders the chosen badge colour in the mascot svg', () => {
    const el = QuickRecordWidget({ streak: 4, config: cfg({ badgeColor: 'blue' }) });
    expect(JSON.stringify(el)).toContain('#2563EB');
  });

  it('renders multi-digit streaks', () => {
    for (const n of [5, 12, 128]) {
      expect(JSON.stringify(QuickRecordWidget({ streak: n, config: cfg() }))).toContain(`>${n}<`);
    }
  });

  it('falls back to defaults when no config is passed', () => {
    const found = byUri(QuickRecordWidget({ streak: 0 }));
    expect(Object.keys(found)).toHaveLength(3);
  });
});
