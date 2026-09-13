jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(),
}));

import {
  persistRecapStoryHomeHandledMonth,
  RECAP_STORY_HOME_HANDLED_MONTH_KEY,
} from '../src/state/store';
import { setMeta } from '../src/db/metaRepo';

jest.mock('../src/db/metaRepo', () => ({
  getMeta: jest.fn(async () => null),
  setMeta: jest.fn(async () => {}),
}));

describe('recapStoryStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists recap story home handled month using the dedicated meta key', async () => {
    expect(RECAP_STORY_HOME_HANDLED_MONTH_KEY).toBe('recap_story_home_handled_month');
    await persistRecapStoryHomeHandledMonth('2026-08');
    expect(setMeta).toHaveBeenCalledWith('recap_story_home_handled_month', '2026-08');
  });
});
