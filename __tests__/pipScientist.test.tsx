import React from 'react';
import { Pip } from '../src/components/Pip';

jest.mock('../src/state/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

const TestRenderer = require('react-test-renderer');

const render = (element: React.ReactElement) => {
  let tree: ReturnType<typeof TestRenderer.create>;
  TestRenderer.act(() => {
    tree = TestRenderer.create(element);
  });
  return tree!;
};

const PIECES = [
  'pip-scientist-goggles',
  'pip-scientist-face',
  'pip-scientist-brows',
  'pip-scientist-eyes',
  'pip-scientist-mouth',
  'pip-scientist-flask',
  'pip-scientist-tube',
];

describe('Pip scientist pose', () => {
  it('renders every piece of the pose', () => {
    const tree = render(<Pip size={100} scientist />);

    for (const testID of PIECES) {
      expect(tree.root.findAllByProps({ testID }).length).toBeGreaterThan(0);
    }
  });

  it('is scoped to the pose — a plain Pip carries none of it', () => {
    const tree = render(<Pip size={100} />);

    for (const testID of PIECES) {
      expect(tree.root.findAllByProps({ testID }).length).toBe(0);
    }
  });

  // The goggles take the head slot, so a scientist inside the add-a-transaction flow (which wraps
  // its screens in <PipWearsHat>) must not end up wearing both.
  it('wears the goggles instead of a hat, even when one is asked for', () => {
    const tree = render(<Pip size={100} scientist hat propellerHat />);

    expect(tree.root.findAllByProps({ testID: 'pip-scientist-goggles' }).length).toBeGreaterThan(0);
    // Neither hat draws a testID, so this checks for their fills instead: straw, and the propeller
    // cap's yellow/red crown.
    for (const fill of ['#F0DCA4', '#F5C542', '#E8453C']) {
      expect(tree.root.findAllByProps({ fill }).length).toBe(0);
    }
  });

  // Both bubble streams still have to be visible when the animation is off — a still flask that
  // renders empty loses the only cue that a reaction is running.
  it('keeps the bubbles on screen under reduced motion', () => {
    const tree = render(<Pip size={100} scientist />);

    for (const testID of ['pip-scientist-flask-bubbles', 'pip-scientist-tube-bubbles']) {
      const group = tree.root.findByProps({ testID });
      // One <Circle> renders as several nodes (composite plus host), so count distinct heights
      // rather than nodes.
      const bubbles = group.findAll(
        (n: { props: Record<string, unknown> }) => typeof n.props.r === 'number' && typeof n.props.opacity === 'number'
      ) as { props: { cy: number; opacity: number } }[];
      expect(new Set(bubbles.map((b) => b.props.cy)).size).toBe(3);
      for (const b of bubbles) expect(b.props.opacity).toBeGreaterThan(0);
    }
  });

  // Everything held stays inside the 100x100 box, or it gets clipped at every call site.
  it('keeps the glassware inside the viewBox', () => {
    const tree = render(<Pip size={100} scientist />);

    for (const testID of ['pip-scientist-flask', 'pip-scientist-tube']) {
      const coords = tree.root
        .findByProps({ testID })
        .findAll((n: { props: Record<string, unknown> }) => typeof n.props.d === 'string')
        .flatMap((n: { props: { d: string } }) => n.props.d.match(/[\d.]+/g)!.map(Number));
      for (const c of coords) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(100);
      }
    }
  });
});
