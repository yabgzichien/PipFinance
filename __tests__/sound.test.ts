/**
 * src/lib/sound.ts holds module-level state (the enabled flag and the lazily built player),
 * so every test loads a fresh copy of the module rather than sharing one across cases.
 */

const mockPlay = jest.fn();
const mockSeekTo = jest.fn(() => Promise.resolve());
const mockCreateAudioPlayer = jest.fn(() => ({ play: mockPlay, seekTo: mockSeekTo, volume: 1 }));
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

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateAudioPlayer.mockImplementation(() => ({
    play: mockPlay,
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
