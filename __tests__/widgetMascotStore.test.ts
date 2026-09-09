jest.mock('../src/db/metaRepo', () => ({
  getMeta: jest.fn(),
  setMeta: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/widget/syncWidgets', () => ({
  syncAllWidgets: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/lib/sound', () => ({ setSoundEnabled: jest.fn() }));

import { setMeta } from '../src/db/metaRepo';
import { syncAllWidgets } from '../src/widget/syncWidgets';
import { persistWidgetMascotConfig } from '../src/state/store';
import {
  DEFAULT_WIDGET_MASCOT_CONFIG,
  WIDGET_MASCOT_CONFIG_KEY,
} from '../src/widget/mascot/config';

describe('persistWidgetMascotConfig', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes the serialized config under the right key', async () => {
    const c = { ...DEFAULT_WIDGET_MASCOT_CONFIG, head: 'goggles' as const };
    await persistWidgetMascotConfig(c);
    expect(setMeta).toHaveBeenCalledWith(WIDGET_MASCOT_CONFIG_KEY, JSON.stringify(c));
  });

  it('pushes the change to placed widgets after persisting', async () => {
    await persistWidgetMascotConfig(DEFAULT_WIDGET_MASCOT_CONFIG);
    expect(syncAllWidgets).toHaveBeenCalled();
  });

  it('still resolves when the widget sync fails', async () => {
    (syncAllWidgets as jest.Mock).mockRejectedValueOnce(new Error('no widget placed'));
    await expect(
      persistWidgetMascotConfig(DEFAULT_WIDGET_MASCOT_CONFIG)
    ).resolves.toBeUndefined();
  });
});
