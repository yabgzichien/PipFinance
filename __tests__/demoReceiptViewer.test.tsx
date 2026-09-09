// __tests__/demoReceiptViewer.test.tsx
// The generated receipt is painted by a WebView canvas, so the share beat's tap-to-view target
// and its full-screen viewer only exist on native — the web build never gets a `generatedUri`
// and falls back to the natively-drawn card. That puts this beat out of reach of the browser
// preview, so it is covered here instead: drive the canvas's onMessage the way the real WebView
// does, then check the receipt became tappable and that tapping it opens the viewer.
//
// The viewer must also never turn into a share affordance — a fabricated bill reaching a real
// contact is the one thing `DemoStep`'s header forbids — so the absence of a share control is
// asserted, not assumed.
import React from 'react';

let capturedOnMessage: ((event: { nativeEvent: { data: string } }) => void) | null = null;

jest.mock('react-native-webview', () => {
  const React = require('react');
  return {
    WebView: (props: { onMessage?: (e: { nativeEvent: { data: string } }) => void }) => {
      capturedOnMessage = props.onMessage ?? null;
      return null;
    },
  };
});

jest.mock('../src/state/store', () => ({
  useAppData: () => ({ catById: {} }),
}));

jest.mock('../src/state/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

jest.mock('../src/lib/haptics', () => ({
  tap: jest.fn(),
  commit: jest.fn(),
  payoff: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../src/lib/sound', () => ({ payoff: jest.fn() }));

import { DemoStep } from '../src/screens/onboarding/DemoStep';
import { DEMO_RECEIPT_LINES } from '../src/data/demoReceipt';

const TestRenderer = require('react-test-renderer');

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

/** Renders the share beat and feeds it a painted PNG, exactly as the canvas WebView would. */
function renderSharedBeatWithPaintedReceipt() {
  let tree: any;
  TestRenderer.act(() => {
    tree = TestRenderer.create(
      <DemoStep
        beat="share"
        onBeat={() => {}}
        lines={DEMO_RECEIPT_LINES}
        onLines={() => {}}
        onNext={() => {}}
        onSkip={() => {}}
      />
    );
  });

  TestRenderer.act(() => {
    capturedOnMessage!({ nativeEvent: { data: JSON.stringify({ dataUrl: PNG }) } });
  });

  return tree;
}

/** Every node carrying the given accessibility label, at any depth. */
const byLabel = (tree: any, label: string) =>
  tree.root.findAll((n: any) => n.props?.accessibilityLabel === label, { deep: true });

beforeEach(() => {
  capturedOnMessage = null;
});

it('makes the generated receipt tappable once the canvas has painted it', () => {
  const tree = renderSharedBeatWithPaintedReceipt();

  const target = byLabel(tree, 'Share it with your friends — Tap to view');
  expect(target.length).toBeGreaterThan(0);

  const images = tree.root.findAll((n: any) => n.props?.source?.uri === PNG, { deep: true });
  expect(images.length).toBeGreaterThan(0);
});

it('opens the viewer on tap and closes it again', () => {
  const tree = renderSharedBeatWithPaintedReceipt();

  const modalBefore = tree.root.findAll((n: any) => n.props?.transparent === true, { deep: true });
  expect(modalBefore.some((m: any) => m.props.visible)).toBe(false);

  TestRenderer.act(() => {
    byLabel(tree, 'Share it with your friends — Tap to view')[0].props.onPress();
  });

  // `Modal` renders as several nested nodes that each carry the prop, so this asserts that the
  // viewer is showing at all, not how many nodes express it.
  const modalOpen = tree.root
    .findAll((n: any) => n.props?.transparent === true, { deep: true })
    .filter((m: any) => m.props.visible);
  expect(modalOpen.length).toBeGreaterThan(0);

  // Tapping the backdrop dismisses it — the same gesture the app's other sheets use.
  TestRenderer.act(() => {
    byLabel(tree, 'Close receipt')[0].props.onPress();
  });

  const modalAfter = tree.root.findAll((n: any) => n.props?.transparent === true, { deep: true });
  expect(modalAfter.some((m: any) => m.props.visible)).toBe(false);
});

it('offers no way to send the fabricated bill from the viewer', () => {
  const tree = renderSharedBeatWithPaintedReceipt();

  TestRenderer.act(() => {
    byLabel(tree, 'Share it with your friends — Tap to view')[0].props.onPress();
  });

  const labels = tree.root
    .findAll((n: any) => typeof n.props?.accessibilityLabel === 'string', { deep: true })
    .map((n: any) => n.props.accessibilityLabel.toLowerCase());

  expect(labels.some((l: string) => l.includes('send'))).toBe(false);
  expect(labels.filter((l: string) => l.includes('share')).every((l: string) =>
    l.startsWith('share it with your friends')
  )).toBe(true);
});
