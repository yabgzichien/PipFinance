// Swapping the launcher alias is a PackageManager write on the app's *own* components, and the
// alias being disabled is the one the live task is running under (`dumpsys activity activities`
// reports the foreground record as `com.yabg.pip/.MainActivityRose`, not `.MainActivity`). Doing
// that while the app is in the foreground lets the platform tear the task down — the app drops to
// the home screen, with no crash recorded anywhere because nothing threw. So the contract is not
// "coalesce the writes", it is "never write while the user is looking at the app": hold the
// choice, apply it once the app has settled in the background.
jest.mock('react-native', () => {
  const listeners: Array<(state: string) => void> = [];
  const AppState = {
    currentState: 'active',
    addEventListener: jest.fn((_type: string, handler: (state: string) => void) => {
      listeners.push(handler);
      return {
        remove: jest.fn(() => {
          const at = listeners.indexOf(handler);
          if (at >= 0) listeners.splice(at, 1);
        }),
      };
    }),
    /** Test-only: drive a foreground/background transition the way the platform would. */
    __emit: (state: string) => {
      AppState.currentState = state;
      [...listeners].forEach((handler) => handler(state));
    },
  };

  return {
    Platform: {
      OS: 'android',
      select: (options: Record<string, unknown>) => options.android ?? options.default,
    },
    NativeModules: {
      AppIconModule: {
        setAppIcon: jest.fn(async () => true),
        getAppIcon: jest.fn(async () => 'green'),
      },
    },
    AppState,
  };
});

interface AppStateMock {
  currentState: string;
  __emit: (state: string) => void;
}

/** Fresh module state per test — the pending preset and the AppState subscription are both
 *  module-scoped, so tests would otherwise inherit each other's queued write. */
function load() {
  const rn = jest.requireMock('react-native') as {
    NativeModules: { AppIconModule: { setAppIcon: jest.Mock<Promise<boolean>, [string]> } };
    AppState: AppStateMock;
  };
  const { setDynamicAppIcon } = require('../src/lib/appIcon') as {
    setDynamicAppIcon: (presetId: string) => Promise<boolean>;
  };
  return { setAppIcon: rn.NativeModules.AppIconModule.setAppIcon, appState: rn.AppState, setDynamicAppIcon };
}

describe('rapid Android app-icon selection', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('never touches the launcher alias while the app is in the foreground', async () => {
    const { setAppIcon, setDynamicAppIcon } = load();

    await setDynamicAppIcon('blue');
    await setDynamicAppIcon('rose');
    await setDynamicAppIcon('teal');
    await jest.runAllTimersAsync();

    expect(setAppIcon).not.toHaveBeenCalled();
  });

  it('applies only the final selection, once, after the app settles in the background', async () => {
    const { setAppIcon, appState, setDynamicAppIcon } = load();

    await setDynamicAppIcon('blue');
    await setDynamicAppIcon('rose');
    await setDynamicAppIcon('teal');

    appState.__emit('background');
    await jest.runAllTimersAsync();

    expect(setAppIcon).toHaveBeenCalledTimes(1);
    expect(setAppIcon).toHaveBeenCalledWith('teal');
  });

  it('abandons the write when the app returns to the foreground before it settles', async () => {
    const { setAppIcon, appState, setDynamicAppIcon } = load();

    await setDynamicAppIcon('violet');
    appState.__emit('background');
    await jest.advanceTimersByTimeAsync(200);
    appState.__emit('active');
    await jest.runAllTimersAsync();

    expect(setAppIcon).not.toHaveBeenCalled();
  });

  it('re-applies the still-pending preset on the next backgrounding', async () => {
    const { setAppIcon, appState, setDynamicAppIcon } = load();

    await setDynamicAppIcon('violet');
    appState.__emit('background');
    await jest.advanceTimersByTimeAsync(200);
    appState.__emit('active');
    await jest.runAllTimersAsync();

    appState.__emit('background');
    await jest.runAllTimersAsync();

    expect(setAppIcon).toHaveBeenCalledTimes(1);
    expect(setAppIcon).toHaveBeenCalledWith('violet');
  });

  it('holds the write when the app returns to the foreground between settling and writing', async () => {
    const { setAppIcon, appState, setDynamicAppIcon } = load();

    await setDynamicAppIcon('indigo');
    appState.__emit('background');

    // Fire the settle timer synchronously so the queued write is still one microtask away, then
    // bring the app back before it runs — this is the window the settle timer alone can't cover.
    jest.advanceTimersByTime(2500);
    appState.__emit('active');
    await jest.runAllTimersAsync();

    expect(setAppIcon).not.toHaveBeenCalled();

    // Still pending, so the next real backgrounding applies it.
    appState.__emit('background');
    await jest.runAllTimersAsync();
    expect(setAppIcon).toHaveBeenCalledWith('indigo');
  });

  it('skips the write when the alias already holds the requested preset', async () => {
    const { setAppIcon, appState, setDynamicAppIcon } = load();

    // The native module reports `green`, which is what a cold start re-requests after hydration.
    await setDynamicAppIcon('green');
    appState.__emit('background');
    await jest.runAllTimersAsync();

    expect(setAppIcon).not.toHaveBeenCalled();
  });

  it('does not write again when the preset is unchanged since the last applied swap', async () => {
    const { setAppIcon, appState, setDynamicAppIcon } = load();

    await setDynamicAppIcon('slate');
    appState.__emit('background');
    await jest.runAllTimersAsync();
    expect(setAppIcon).toHaveBeenCalledTimes(1);

    appState.__emit('active');
    await setDynamicAppIcon('slate');
    appState.__emit('background');
    await jest.runAllTimersAsync();

    expect(setAppIcon).toHaveBeenCalledTimes(1);
  });
});
