import {
  DEFAULT_WIDGET_MASCOT_CONFIG,
  parseWidgetMascotConfig,
  serializeWidgetMascotConfig,
} from '../src/widget/mascot/config';

describe('parseWidgetMascotConfig', () => {
  it('returns defaults for null (no key stored yet)', () => {
    expect(parseWidgetMascotConfig(null)).toEqual(DEFAULT_WIDGET_MASCOT_CONFIG);
  });

  it('returns defaults for unparseable JSON instead of throwing', () => {
    expect(() => parseWidgetMascotConfig('{not json')).not.toThrow();
    expect(parseWidgetMascotConfig('{not json')).toEqual(DEFAULT_WIDGET_MASCOT_CONFIG);
  });

  it('returns defaults for JSON that is not an object', () => {
    expect(parseWidgetMascotConfig('42')).toEqual(DEFAULT_WIDGET_MASCOT_CONFIG);
    expect(parseWidgetMascotConfig('null')).toEqual(DEFAULT_WIDGET_MASCOT_CONFIG);
    expect(parseWidgetMascotConfig('[]')).toEqual(DEFAULT_WIDGET_MASCOT_CONFIG);
  });

  it('keeps valid fields and defaults the invalid ones, field by field', () => {
    const raw = JSON.stringify({
      version: 1,
      preset: 'custom',
      head: 'strawHat',
      eyes: 'notAPart',
      mouth: 'grin',
      holding: 'lollipop',
      mascotNotch: 99,
      buttonNotch: 2,
      showIncome: false,
      showExpense: 'yes',
      badgeIcon: 'star',
      badgeColor: 'chartreuse',
    });
    const c = parseWidgetMascotConfig(raw);
    expect(c.head).toBe('strawHat');
    // Part ids are shape-checked here (non-empty string) but validated against the catalog at
    // compose time, so an unknown id survives parsing and is resolved to the slot default by
    // resolvePart. This keeps config.ts free of catalog imports.
    expect(c.eyes).toBe('notAPart');
    expect(c.mouth).toBe('grin');
    expect(c.mascotNotch).toBe(DEFAULT_WIDGET_MASCOT_CONFIG.mascotNotch);
    expect(c.buttonNotch).toBe(2);
    expect(c.showIncome).toBe(false);
    expect(c.showExpense).toBe(DEFAULT_WIDGET_MASCOT_CONFIG.showExpense);
    expect(c.badgeIcon).toBe('star');
    expect(c.badgeColor).toBe(DEFAULT_WIDGET_MASCOT_CONFIG.badgeColor);
  });

  it('never throws on hostile input', () => {
    const inputs = ['', ' ', '{}', '{"head":null}', '{"mascotNotch":"5"}', '{"version":"x"}'];
    for (const i of inputs) {
      expect(() => parseWidgetMascotConfig(i)).not.toThrow();
    }
  });

  it('round-trips through serialize', () => {
    const c = { ...DEFAULT_WIDGET_MASCOT_CONFIG, head: 'bandana', mascotNotch: 2 as const };
    expect(parseWidgetMascotConfig(serializeWidgetMascotConfig(c))).toEqual(c);
  });

  it("defaults reproduce today's widget", () => {
    expect(DEFAULT_WIDGET_MASCOT_CONFIG.mascotNotch).toBe(5);
    expect(DEFAULT_WIDGET_MASCOT_CONFIG.buttonNotch).toBe(3);
    expect(DEFAULT_WIDGET_MASCOT_CONFIG.showIncome).toBe(true);
    expect(DEFAULT_WIDGET_MASCOT_CONFIG.showExpense).toBe(true);
    expect(DEFAULT_WIDGET_MASCOT_CONFIG.badgeIcon).toBe('flame');
    expect(DEFAULT_WIDGET_MASCOT_CONFIG.preset).toBe('classic');
  });
});
