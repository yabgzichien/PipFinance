import {
  DEFAULT_WIDGET_MASCOT_CONFIG,
  parseWidgetMascotConfig,
  serializeWidgetMascotConfig,
  type SlotContent,
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
      version: 2,
      preset: 'custom',
      head: 'strawHat',
      eyes: 'notAPart',
      mouth: 'grin',
      holding: 'lollipop',
      mascotNotch: 99,
      buttonNotch: 2,
      slot1: 'streak',
      slot2: 'nonsense',
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
    expect(c.slot1).toBe('streak');
    expect(c.slot2).toBe(DEFAULT_WIDGET_MASCOT_CONFIG.slot2);
    expect(c.badgeIcon).toBe('star');
    expect(c.badgeColor).toBe(DEFAULT_WIDGET_MASCOT_CONFIG.badgeColor);
  });

  it('never throws on hostile input', () => {
    const inputs = [
      '',
      ' ',
      '{}',
      '{"head":null}',
      '{"mascotNotch":"5"}',
      '{"version":"x"}',
      '{"slot1":7}',
      '{"slot1":"streak","slot2":"streak"}',
      '{"showIncome":"maybe"}',
    ];
    for (const i of inputs) {
      expect(() => parseWidgetMascotConfig(i)).not.toThrow();
    }
  });

  it('round-trips through serialize', () => {
    const c = { ...DEFAULT_WIDGET_MASCOT_CONFIG, head: 'bandana', mascotNotch: 2 as const };
    expect(parseWidgetMascotConfig(serializeWidgetMascotConfig(c))).toEqual(c);
  });

  it('defaults to a mid-ladder mascot with both arrows', () => {
    expect(DEFAULT_WIDGET_MASCOT_CONFIG.version).toBe(2);
    expect(DEFAULT_WIDGET_MASCOT_CONFIG.mascotNotch).toBe(3);
    expect(DEFAULT_WIDGET_MASCOT_CONFIG.buttonNotch).toBe(3);
    expect(DEFAULT_WIDGET_MASCOT_CONFIG.slot1).toBe('income');
    expect(DEFAULT_WIDGET_MASCOT_CONFIG.slot2).toBe('expense');
    expect(DEFAULT_WIDGET_MASCOT_CONFIG.badgeIcon).toBe('flame');
    expect(DEFAULT_WIDGET_MASCOT_CONFIG.preset).toBe('classic');
  });
});

/**
 * Migration is the one failure in this feature that destroys real user data: a config that fails
 * to migrate silently resets someone's customized widget to stock. Every v1 arrow combination is
 * pinned here.
 */
describe('v1 -> v2 migration', () => {
  const v1 = (over: Record<string, unknown> = {}) =>
    JSON.stringify({
      version: 1,
      preset: 'custom',
      head: 'bandana',
      eyes: 'scarred',
      mouth: 'katanaBite',
      holding: 'crossedKatana',
      mascotNotch: 4,
      buttonNotch: 2,
      showIncome: true,
      showExpense: true,
      badgeIcon: 'star',
      badgeColor: 'violet',
      ...over,
    });

  it.each([
    ['both arrows on', { showIncome: true, showExpense: true }, 'income', 'expense'],
    ['income only', { showIncome: true, showExpense: false }, 'income', 'none'],
    ['expense only', { showIncome: false, showExpense: true }, 'expense', 'none'],
    ['both off', { showIncome: false, showExpense: false }, 'none', 'none'],
  ])('maps %s to the right slots', (_label, arrows, slot1, slot2) => {
    const c = parseWidgetMascotConfig(v1(arrows));
    expect(c.slot1).toBe(slot1);
    expect(c.slot2).toBe(slot2);
    expect(c.version).toBe(2);
  });

  it('preserves every non-arrow field through the migration', () => {
    const c = parseWidgetMascotConfig(v1());
    expect(c.preset).toBe('custom');
    expect(c.head).toBe('bandana');
    expect(c.eyes).toBe('scarred');
    expect(c.mouth).toBe('katanaBite');
    expect(c.holding).toBe('crossedKatana');
    expect(c.mascotNotch).toBe(4);
    expect(c.buttonNotch).toBe(2);
    expect(c.badgeIcon).toBe('star');
    expect(c.badgeColor).toBe('violet');
  });

  it('drops the v1 boolean fields rather than carrying them forward', () => {
    const c = parseWidgetMascotConfig(v1()) as unknown as Record<string, unknown>;
    expect(c.showIncome).toBeUndefined();
    expect(c.showExpense).toBeUndefined();
  });

  it('does not re-run the arrow mapping on a v2 blob', () => {
    // A v2 config carries slots and no booleans; a stray leftover boolean must not override them.
    const raw = JSON.stringify({
      ...JSON.parse(serializeWidgetMascotConfig(DEFAULT_WIDGET_MASCOT_CONFIG)),
      slot1: 'streak',
      slot2: 'expense',
      showIncome: false,
      showExpense: false,
    });
    const c = parseWidgetMascotConfig(raw);
    expect(c.slot1).toBe('streak');
    expect(c.slot2).toBe('expense');
  });

  it('treats a missing version as v1 so pre-version blobs still migrate', () => {
    const raw = JSON.stringify({ head: 'strawHat', showIncome: true, showExpense: false });
    const c = parseWidgetMascotConfig(raw);
    expect(c.head).toBe('strawHat');
    expect(c.slot1).toBe('income');
    expect(c.slot2).toBe('none');
  });
});

describe('the one-streak-slot rule', () => {
  const withSlots = (slot1: SlotContent, slot2: SlotContent) =>
    parseWidgetMascotConfig(
      JSON.stringify({ ...DEFAULT_WIDGET_MASCOT_CONFIG, slot1, slot2 })
    );

  it('keeps a single streak slot in either position', () => {
    expect(withSlots('streak', 'expense')).toMatchObject({ slot1: 'streak', slot2: 'expense' });
    expect(withSlots('income', 'streak')).toMatchObject({ slot1: 'income', slot2: 'streak' });
  });

  it('clears the second streak when both slots claim one', () => {
    // Two counts side by side is meaningless; slot1 wins and slot2 empties.
    expect(withSlots('streak', 'streak')).toMatchObject({ slot1: 'streak', slot2: 'none' });
  });

  it('allows every non-streak combination unchanged', () => {
    const contents: SlotContent[] = ['income', 'expense', 'none'];
    for (const a of contents) {
      for (const b of contents) {
        expect(withSlots(a, b)).toMatchObject({ slot1: a, slot2: b });
      }
    }
  });
});
