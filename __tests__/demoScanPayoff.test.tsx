// __tests__/demoScanPayoff.test.tsx
// The demo's scan landing is the first reward moment a new install gets, and it is supposed to
// land as one event: the payoff haptic and the save chime together, the same pairing SavedScreen
// uses for a real save. Both are no-ops on web, so the browser preview cannot show the chime
// firing — it is pinned here instead.
import React from 'react';

jest.mock('react-native-webview', () => ({ WebView: () => null }));

jest.mock('../src/state/store', () => ({ useAppData: () => ({ catById: {} }) }));

jest.mock('../src/state/useReducedMotion', () => ({ useReducedMotion: () => true }));

jest.mock('../src/lib/haptics', () => ({
  tap: jest.fn(),
  commit: jest.fn(),
  payoff: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../src/lib/sound', () => ({ payoff: jest.fn() }));

import { DemoStep } from '../src/screens/onboarding/DemoStep';
import { DEMO_RECEIPT_LINES } from '../src/data/demoReceipt';

const haptics = jest.requireMock('../src/lib/haptics') as { payoff: jest.Mock };
const sound = jest.requireMock('../src/lib/sound') as { payoff: jest.Mock };

const TestRenderer = require('react-test-renderer');

/** Mounts the scanning beat, which starts the scripted read on an interval. */
function renderScanningBeat(onBeat: (beat: string) => void) {
  TestRenderer.act(() => {
    TestRenderer.create(
      <DemoStep
        beat="scanning"
        onBeat={onBeat as any}
        lines={DEMO_RECEIPT_LINES}
        onLines={() => {}}
        onNext={() => {}}
        onSkip={() => {}}
      />
    );
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  haptics.payoff.mockClear();
  sound.payoff.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

it('fires the chime and the haptic together when the read lands', () => {
  const onBeat = jest.fn();
  renderScanningBeat(onBeat);

  expect(haptics.payoff).not.toHaveBeenCalled();
  expect(sound.payoff).not.toHaveBeenCalled();

  // Past the scripted 800ms read.
  TestRenderer.act(() => {
    jest.advanceTimersByTime(850);
  });

  expect(haptics.payoff).toHaveBeenCalledTimes(1);
  expect(sound.payoff).toHaveBeenCalledTimes(1);
  expect(onBeat).toHaveBeenCalledWith('reveal');
});

it('stays silent while the scan is still running', () => {
  renderScanningBeat(jest.fn());

  TestRenderer.act(() => {
    jest.advanceTimersByTime(400);
  });

  expect(haptics.payoff).not.toHaveBeenCalled();
  expect(sound.payoff).not.toHaveBeenCalled();
});
