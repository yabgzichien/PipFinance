import {
  DEFAULT_WIDGET_MASCOT_CONFIG,
  parseWidgetMascotConfig,
  serializeWidgetMascotConfig,
} from '../src/widget/mascot/config';

describe('widget mascot config backup round-trip', () => {
  it('survives serialize -> payload -> parse unchanged', () => {
    const original = {
      ...DEFAULT_WIDGET_MASCOT_CONFIG,
      preset: 'custom' as const,
      head: 'goggles',
      eyes: 'big',
      mascotNotch: 2 as const,
      showExpense: false,
      badgeColor: 'violet' as const,
    };
    const payloadValue = serializeWidgetMascotConfig(original);
    expect(parseWidgetMascotConfig(payloadValue)).toEqual(original);
  });

  it('a payload missing the field restores to defaults rather than failing', () => {
    const settings: Record<string, unknown> = { motionSetting: 'full' };
    const raw =
      typeof settings.widgetMascotConfig === 'string' ? settings.widgetMascotConfig : null;
    expect(parseWidgetMascotConfig(raw)).toEqual(DEFAULT_WIDGET_MASCOT_CONFIG);
  });
});
