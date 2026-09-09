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

  it('drops only the hidden arrow when one is turned off', () => {
    const found = byUri(QuickRecordWidget({ streak: 5, config: cfg({ showExpense: false }) }));
    expect(found['pip://add?type=income']).toBeDefined();
    expect(found['pip://add?type=expense']).toBeUndefined();
    expect(found['pip://add']).toBeDefined();
  });

  it('collapses to a single add target when both arrows are off', () => {
    const found = byUri(QuickRecordWidget({ streak: 5, config: cfg({ showIncome: false, showExpense: false }) }));
    expect(Object.keys(found)).toEqual(['pip://add']);
  });

  it('shows the expanded streak count and 7 dots only when both arrows are off', () => {
    const dots = [true, true, false, true, false, false, true];
    const expanded = QuickRecordWidget({ streak: 9, dots, config: cfg({ showIncome: false, showExpense: false }) });
    const json = JSON.stringify(expanded);
    expect(json).toContain('data-streak-dots');
    const compact = JSON.stringify(QuickRecordWidget({ streak: 9, dots, config: cfg() }));
    expect(compact).not.toContain('data-streak-dots');
  });

  it('honours the selected badge icon and colour in the expanded layout', () => {
    const expanded = QuickRecordWidget({
      streak: 9,
      config: cfg({
        showIncome: false,
        showExpense: false,
        badgeIcon: 'star',
        badgeColor: 'blue',
      }),
    });
    const json = JSON.stringify(expanded);
    expect(json).toContain('data-streak-icon');
    expect(json).toContain('#2563EB');

    const withoutIcon = JSON.stringify(
      QuickRecordWidget({
        streak: 9,
        config: cfg({ showIncome: false, showExpense: false, badgeIcon: 'none' }),
      })
    );
    expect(withoutIcon).not.toContain('data-streak-icon');
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
