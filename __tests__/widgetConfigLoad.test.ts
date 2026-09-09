jest.mock('../src/db/metaRepo', () => ({ getMeta: jest.fn(), setMeta: jest.fn() }));
jest.mock('../src/db/txnRepo', () => ({ listTransactions: jest.fn().mockResolvedValue([]) }));

import { getMeta } from '../src/db/metaRepo';
import { getStreakWidgetData } from '../src/widget/syncStreakWidget';
import { DEFAULT_WIDGET_MASCOT_CONFIG } from '../src/widget/mascot/config';

describe('getStreakWidgetData config loading', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the stored config', async () => {
    (getMeta as jest.Mock).mockResolvedValue(
      JSON.stringify({ ...DEFAULT_WIDGET_MASCOT_CONFIG, head: 'bandana' })
    );
    const data = await getStreakWidgetData([]);
    expect(data.config.head).toBe('bandana');
  });

  it('falls back to defaults when the key is absent', async () => {
    (getMeta as jest.Mock).mockResolvedValue(null);
    const data = await getStreakWidgetData([]);
    expect(data.config).toEqual(DEFAULT_WIDGET_MASCOT_CONFIG);
  });

  it('falls back to defaults when the read throws, without propagating', async () => {
    (getMeta as jest.Mock).mockRejectedValue(new Error('db closed'));
    await expect(getStreakWidgetData([])).resolves.toMatchObject({
      config: DEFAULT_WIDGET_MASCOT_CONFIG,
    });
  });

  it('falls back to defaults on corrupt stored JSON', async () => {
    (getMeta as jest.Mock).mockResolvedValue('{{{');
    const data = await getStreakWidgetData([]);
    expect(data.config).toEqual(DEFAULT_WIDGET_MASCOT_CONFIG);
  });
});
