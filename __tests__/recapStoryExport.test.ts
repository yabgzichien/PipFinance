import {
  downloadOneStory,
  saveSelectedStories,
  shareOneStory,
} from '../src/lib/recapStoryExport';
import { Linking } from 'react-native';
import { recapStoryCaptureAdapter } from '../src/lib/recapStoryCapture';
import type {
  RecapStoryCaptureAdapter,
  RecapStorySceneId,
} from '../src/lib/recapStoryCapture.types';

class FakeCaptureAdapter implements RecapStoryCaptureAdapter<never> {
  readonly events: string[] = [];
  shareAvailable = true;
  permission: 'granted' | 'denied' = 'granted';
  failSaveUris = new Set<string>();
  failCleanupUris = new Set<string>();

  async capture(_ref: never): Promise<string> {
    throw new Error('The coordinator receives an injected renderAndCapture callback');
  }

  async canShare(): Promise<boolean> {
    this.events.push('canShare');
    return this.shareAvailable;
  }

  async share(uri: string): Promise<void> {
    this.events.push(`share:${uri}`);
  }

  async download(uri: string, filename: string): Promise<void> {
    this.events.push(`download:${uri}:${filename}`);
  }

  async requestSavePermission(): Promise<'granted' | 'denied'> {
    this.events.push('permission');
    return this.permission;
  }

  async save(uri: string): Promise<void> {
    this.events.push(`save:${uri}`);
    if (this.failSaveUris.has(uri)) throw new Error('save failed');
  }

  async cleanup(uri: string): Promise<void> {
    this.events.push(`cleanup:${uri}`);
    if (this.failCleanupUris.has(uri)) throw new Error('cleanup failed');
  }

  async openInstagram(): Promise<boolean> {
    this.events.push('instagram');
    return false;
  }
}

function renderer(adapter: FakeCaptureAdapter, failures: RecapStorySceneId[] = []) {
  return async (sceneId: RecapStorySceneId): Promise<string> => {
    adapter.events.push(`capture:${sceneId}`);
    if (failures.includes(sceneId)) throw new Error('capture failed');
    return `tmp://${sceneId}`;
  };
}

describe('monthly story export coordinator', () => {
  test('one-card share checks native availability before capturing', async () => {
    const adapter = new FakeCaptureAdapter();
    adapter.shareAvailable = false;

    await expect(shareOneStory(adapter, 'identity', renderer(adapter))).resolves.toBe(false);
    expect(adapter.events).toEqual(['canShare']);
  });

  test('one-card share captures, shares, and cleans its temporary file', async () => {
    const adapter = new FakeCaptureAdapter();

    await expect(shareOneStory(adapter, 'identity', renderer(adapter))).resolves.toBe(true);
    expect(adapter.events).toEqual([
      'canShare',
      'capture:identity',
      'share:tmp://identity',
      'cleanup:tmp://identity',
    ]);
  });

  test('one-card share cleans a captured file when the share sheet fails', async () => {
    const adapter = new FakeCaptureAdapter();
    adapter.share = async (uri) => {
      adapter.events.push(`share:${uri}`);
      throw new Error('share failed');
    };

    await expect(shareOneStory(adapter, 'identity', renderer(adapter))).rejects.toThrow('share failed');
    expect(adapter.events).toEqual([
      'canShare',
      'capture:identity',
      'share:tmp://identity',
      'cleanup:tmp://identity',
    ]);
  });

  test('web download bypasses native share availability and cleans the capture', async () => {
    const adapter = new FakeCaptureAdapter();
    adapter.shareAvailable = false;

    await downloadOneStory(adapter, 'finale', renderer(adapter));

    expect(adapter.events).toEqual([
      'capture:finale',
      'download:tmp://finale:pip-monthly-story.png',
      'cleanup:tmp://finale',
    ]);
  });

  test('permission denial is typed and prevents every batch capture', async () => {
    const adapter = new FakeCaptureAdapter();
    adapter.permission = 'denied';

    await expect(
      saveSelectedStories(adapter, ['identity', 'finale'], renderer(adapter)),
    ).resolves.toEqual({ status: 'permission-denied' });
    expect(adapter.events).toEqual(['permission']);
  });

  test('batch save captures and saves sequentially in narrative order after one permission request', async () => {
    const adapter = new FakeCaptureAdapter();

    await expect(
      saveSelectedStories(adapter, ['finale', 'identity', 'habit'], renderer(adapter)),
    ).resolves.toEqual({ savedIds: ['identity', 'habit', 'finale'], failedIds: [] });
    expect(adapter.events).toEqual([
      'permission',
      'capture:identity',
      'save:tmp://identity',
      'capture:habit',
      'save:tmp://habit',
      'capture:finale',
      'save:tmp://finale',
      'cleanup:tmp://identity',
      'cleanup:tmp://habit',
      'cleanup:tmp://finale',
    ]);
  });

  test('batch save captures spotlight scene in correct narrative order between pattern and habit', async () => {
    const adapter = new FakeCaptureAdapter();

    await expect(
      saveSelectedStories(adapter, ['finale', 'spotlight', 'identity', 'pattern'], renderer(adapter)),
    ).resolves.toEqual({ savedIds: ['identity', 'pattern', 'spotlight', 'finale'], failedIds: [] });
    expect(adapter.events).toEqual([
      'permission',
      'capture:identity',
      'save:tmp://identity',
      'capture:pattern',
      'save:tmp://pattern',
      'capture:spotlight',
      'save:tmp://spotlight',
      'capture:finale',
      'save:tmp://finale',
      'cleanup:tmp://identity',
      'cleanup:tmp://pattern',
      'cleanup:tmp://spotlight',
      'cleanup:tmp://finale',
    ]);
  });

  test('a partial save returns exact IDs and continues with later cards', async () => {
    const adapter = new FakeCaptureAdapter();
    adapter.failSaveUris.add('tmp://pattern');

    await expect(
      saveSelectedStories(adapter, ['identity', 'pattern', 'finale'], renderer(adapter)),
    ).resolves.toEqual({ savedIds: ['identity', 'finale'], failedIds: ['pattern'] });
    expect(adapter.events).toContain('save:tmp://finale');
  });

  test('a capture failure is recorded while later selected cards still save', async () => {
    const adapter = new FakeCaptureAdapter();

    await expect(
      saveSelectedStories(
        adapter,
        ['identity', 'pattern', 'habit'],
        renderer(adapter, ['pattern']),
      ),
    ).resolves.toEqual({ savedIds: ['identity', 'habit'], failedIds: ['pattern'] });
    expect(adapter.events).toEqual([
      'permission',
      'capture:identity',
      'save:tmp://identity',
      'capture:pattern',
      'capture:habit',
      'save:tmp://habit',
      'cleanup:tmp://identity',
      'cleanup:tmp://habit',
    ]);
  });

  test('retrying the returned failures captures only failed cards', async () => {
    const adapter = new FakeCaptureAdapter();
    adapter.failSaveUris.add('tmp://pattern');
    const first = await saveSelectedStories(
      adapter,
      ['identity', 'pattern', 'finale'],
      renderer(adapter),
    );
    if ('status' in first) throw new Error('permission unexpectedly denied');

    adapter.events.length = 0;
    adapter.failSaveUris.clear();
    await expect(
      saveSelectedStories(adapter, first.failedIds, renderer(adapter)),
    ).resolves.toEqual({ savedIds: ['pattern'], failedIds: [] });
    expect(adapter.events).toEqual([
      'permission',
      'capture:pattern',
      'save:tmp://pattern',
      'cleanup:tmp://pattern',
    ]);
  });

  test('cleanup attempts every created URI even when one cleanup fails', async () => {
    const adapter = new FakeCaptureAdapter();
    adapter.failSaveUris.add('tmp://habit');
    adapter.failCleanupUris.add('tmp://identity');

    await expect(
      saveSelectedStories(adapter, ['identity', 'habit', 'finale'], renderer(adapter)),
    ).resolves.toEqual({ savedIds: ['identity', 'finale'], failedIds: ['habit'] });
    expect(adapter.events.slice(-3)).toEqual([
      'cleanup:tmp://identity',
      'cleanup:tmp://habit',
      'cleanup:tmp://finale',
    ]);
  });
});

describe('native monthly story capture adapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Instagram absence returns false without trying to open it', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

    await expect(recapStoryCaptureAdapter.openInstagram()).resolves.toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  test('Instagram availability lookup failure returns false', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockRejectedValue(new Error('lookup failed'));
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

    await expect(recapStoryCaptureAdapter.openInstagram()).resolves.toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  test('Instagram launch failure returns false', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('launch failed'));

    await expect(recapStoryCaptureAdapter.openInstagram()).resolves.toBe(false);
  });

  test('successful Instagram launch returns true', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

    await expect(recapStoryCaptureAdapter.openInstagram()).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith('instagram://app');
  });
});
