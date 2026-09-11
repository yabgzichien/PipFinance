/**
 * src/lib/sound.ts holds module-level state (the enabled flag and the lazily built player),
 * so every test loads a fresh copy of the module rather than sharing one across cases.
 */

const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockSeekTo = jest.fn(() => Promise.resolve());
const mockCreateAudioPlayer = jest.fn(() => ({
  play: mockPlay,
  pause: mockPause,
  seekTo: mockSeekTo,
  volume: 1,
}));
const mockSetAudioModeAsync = jest.fn(() => Promise.resolve());

jest.mock('expo-audio', () => ({
  createAudioPlayer: (...args: unknown[]) => mockCreateAudioPlayer(...(args as [])),
  setAudioModeAsync: (...args: unknown[]) => mockSetAudioModeAsync(...(args as [])),
}));

/** Fresh module registry per case, optionally pretending to run on another platform. */
function load(os: string = 'ios'): typeof import('../src/lib/sound') {
  let mod: typeof import('../src/lib/sound') = undefined as never;
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({ Platform: { OS: os } }));
    mod = require('../src/lib/sound');
  });
  return mod;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPlay.mockImplementation(() => undefined);
  mockPause.mockImplementation(() => undefined);
  mockSeekTo.mockImplementation(() => Promise.resolve());
  mockCreateAudioPlayer.mockImplementation(() => ({
    play: mockPlay,
    pause: mockPause,
    seekTo: mockSeekTo,
    volume: 1,
  }));
});

describe('payoff', () => {
  it('plays the chime on a save', () => {
    load().payoff();
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it('rewinds to the start first, so a second save in the same session is not silent', () => {
    const sound = load();
    sound.payoff();
    sound.payoff();
    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(mockPlay).toHaveBeenCalledTimes(2);
  });

  it('builds the player once and reuses it, rather than decoding the asset per save', () => {
    const sound = load();
    sound.payoff();
    sound.payoff();
    sound.payoff();
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
  });

  it('mixes with other audio instead of stopping the user’s music', () => {
    load().payoff();
    expect(mockSetAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ interruptionMode: 'mixWithOthers' })
    );
  });

  it('respects the iOS silent switch', () => {
    load().payoff();
    expect(mockSetAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ playsInSilentMode: false })
    );
  });

  it('stays silent on web, where the app ships no audio', () => {
    load('web').payoff();
    expect(mockCreateAudioPlayer).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
  });
});

describe('setSoundEnabled', () => {
  it('mutes the chime when the user turns Sounds off', () => {
    const sound = load();
    sound.setSoundEnabled(false);
    sound.payoff();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('never builds a player while muted, so an off setting costs nothing', () => {
    const sound = load();
    sound.setSoundEnabled(false);
    sound.payoff();
    expect(mockCreateAudioPlayer).not.toHaveBeenCalled();
  });

  it('plays again once the user turns Sounds back on', () => {
    const sound = load();
    sound.setSoundEnabled(false);
    sound.payoff();
    sound.setSoundEnabled(true);
    sound.payoff();
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it('defaults to on, so a first-run install hears the save land', () => {
    load().payoff();
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });
});

describe('monthly story intro', () => {
  it('lazily builds the story player at half volume, rewinds it, and plays the new asset', async () => {
    const storyAsset = require('../assets/sounds/monthly-story.wav');
    const sound = load();

    sound.storyIntro();

    expect(mockCreateAudioPlayer).toHaveBeenCalledWith(storyAsset);
    expect(mockCreateAudioPlayer.mock.results[0].value.volume).toBe(0.5);
    expect(mockSeekTo).toHaveBeenCalledWith(0);
    await Promise.resolve();
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it('does not play while the opening rewind is still pending', () => {
    const rewind = deferred();
    mockSeekTo.mockReturnValueOnce(rewind.promise);

    load().storyIntro();

    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('plays only when the opening rewind resolves', async () => {
    const rewind = deferred();
    mockSeekTo.mockReturnValueOnce(rewind.promise);
    load().storyIntro();
    mockPlay.mockClear();

    rewind.resolve();
    await rewind.promise;

    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it.each(['pause', 'stop', 'disable'] as const)(
    '%s cancels playback waiting on an older rewind',
    async (action) => {
      const rewind = deferred();
      mockSeekTo.mockReturnValueOnce(rewind.promise);
      const sound = load();
      sound.storyIntro();

      if (action === 'pause') sound.pauseStoryIntro();
      else if (action === 'stop') sound.stopStoryIntro();
      else sound.setSoundEnabled(false);

      rewind.resolve();
      await rewind.promise;

      expect(mockPlay).not.toHaveBeenCalled();
    }
  );

  it('a newer start cancels the older rewind completion and only plays the newest one', async () => {
    const olderRewind = deferred();
    const newerRewind = deferred();
    mockSeekTo
      .mockReturnValueOnce(olderRewind.promise)
      .mockReturnValueOnce(newerRewind.promise);
    const sound = load();
    sound.storyIntro();
    sound.storyIntro();

    olderRewind.resolve();
    await olderRewind.promise;
    expect(mockPlay).not.toHaveBeenCalled();

    newerRewind.resolve();
    await newerRewind.promise;
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it('pauses a playing intro without rewinding it', () => {
    const sound = load();
    sound.storyIntro();
    mockSeekTo.mockClear();

    sound.pauseStoryIntro();

    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(mockSeekTo).not.toHaveBeenCalled();
  });

  it('resumes a held intro without seeking, so it continues from its held position', () => {
    const sound = load();
    sound.storyIntro();
    sound.pauseStoryIntro();
    mockPlay.mockClear();
    mockSeekTo.mockClear();

    sound.resumeStoryIntro();

    expect(mockPlay).toHaveBeenCalledTimes(1);
    expect(mockSeekTo).not.toHaveBeenCalled();
  });

  it('stops an intro for navigation by pausing and rewinding it', () => {
    const sound = load();
    sound.storyIntro();
    mockPause.mockClear();
    mockSeekTo.mockClear();

    sound.stopStoryIntro();

    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(mockSeekTo).toHaveBeenCalledWith(0);
  });

  it('does not build a player just to pause or stop an intro that never started', () => {
    const sound = load();
    sound.pauseStoryIntro();
    sound.stopStoryIntro();

    expect(mockCreateAudioPlayer).not.toHaveBeenCalled();
  });

  it('does not play or build the story player while Sounds are off', () => {
    const sound = load();
    sound.setSoundEnabled(false);
    sound.storyIntro();
    sound.resumeStoryIntro();

    expect(mockCreateAudioPlayer).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('does not play or build the story player on web', () => {
    const sound = load('web');
    sound.storyIntro();
    sound.resumeStoryIntro();

    expect(mockCreateAudioPlayer).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('silently gives up when the story player cannot be created', () => {
    mockCreateAudioPlayer.mockImplementation(() => {
      throw new Error('story audio unavailable');
    });
    const sound = load();

    expect(() => sound.storyIntro()).not.toThrow();
    expect(() => sound.storyIntro()).not.toThrow();
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
  });

  it('swallows a rejected story rewind without an unhandled rejection', async () => {
    mockSeekTo.mockImplementation(() => Promise.reject(new Error('seek failed')));
    const sound = load();

    expect(() => sound.storyIntro()).not.toThrow();
    await Promise.resolve();
  });

  it('swallows story play and pause failures', () => {
    mockPlay.mockImplementation(() => {
      throw new Error('play denied');
    });
    mockPause.mockImplementation(() => {
      throw new Error('pause denied');
    });
    const sound = load();

    expect(() => sound.storyIntro()).not.toThrow();
    expect(() => sound.pauseStoryIntro()).not.toThrow();
    expect(() => sound.stopStoryIntro()).not.toThrow();
    expect(() => sound.resumeStoryIntro()).not.toThrow();
  });
});

describe('failure handling', () => {
  it('swallows a device that cannot build a player, rather than breaking the save screen', () => {
    mockCreateAudioPlayer.mockImplementation(() => {
      throw new Error('no audio session');
    });
    expect(() => load().payoff()).not.toThrow();
  });

  it('does not retry a player build that already failed on every later save', () => {
    mockCreateAudioPlayer.mockImplementation(() => {
      throw new Error('no audio session');
    });
    const sound = load();
    sound.payoff();
    sound.payoff();
    sound.payoff();
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
  });

  it('swallows a player that throws on play', () => {
    mockPlay.mockImplementation(() => {
      throw new Error('audio focus denied');
    });
    expect(() => load().payoff()).not.toThrow();
  });

  it('swallows a rejected seek without an unhandled rejection', () => {
    mockSeekTo.mockImplementation(() => Promise.reject(new Error('seek failed')));
    expect(() => load().payoff()).not.toThrow();
  });
});
