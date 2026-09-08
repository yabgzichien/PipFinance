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
  'pip-swordsman-swords',
  'pip-swordsman-bandana',
  'pip-swordsman-face',
  'pip-swordsman-brows',
  'pip-swordsman-open-eye',
  'pip-swordsman-closed-eye',
  'pip-swordsman-scar',
  'pip-swordsman-earrings',
  'pip-swordsman-mouth-katana',
];

describe('Pip swordsman pose', () => {
  it('renders every piece of the pose', () => {
    const tree = render(<Pip size={100} swordsman />);

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

  // The bite has to land on the wrapped handle, never the edge: the tsuka has to span the grin
  // (x 36-64) and the blade has to start clear of it, on the far side of the guard.
  it('puts the handle in the mouth and the blade outside it', () => {
    const tree = render(<Pip size={100} swordsman />);
    const katana = tree.root.findByProps({ testID: 'pip-swordsman-mouth-katana' });

    // The tsuka is the one wide rect in the group; the guard and pommel are narrow caps.
    const rects = katana
      .findAll((n: { props: Record<string, unknown> }) => typeof n.props.width === 'number')
      .map((n: { props: { x: number; width: number } }) => n.props);
    const handle = rects.reduce((a: { width: number }, b: { width: number }) => (b.width > a.width ? b : a));
    const handleRight = handle.x + handle.width;
    expect(handle.x).toBeLessThan(36);
    expect(handleRight).toBeGreaterThan(56);

    const blade = katana
      .findAll((n: { props: Record<string, unknown> }) => typeof n.props.d === 'string' && typeof n.props.fill === 'string')
      .map((n: { props: { d: string } }) => n.props.d)[0];
    const bladeStart = Number(/^M([\d.]+)/.exec(blade)![1]);
    expect(bladeStart).toBeGreaterThan(handleRight);
  });

  // The bandana takes the head slot, so a swordsman inside the add-a-transaction flow (which wraps
  // its screens in <PipWearsHat>) must not end up wearing both.
  it('wears the bandana instead of a hat, even when one is asked for', () => {
    const tree = render(<Pip size={100} swordsman hat propellerHat />);

    expect(tree.root.findAllByProps({ testID: 'pip-swordsman-bandana' }).length).toBeGreaterThan(0);
    // Neither hat draws a testID, so this checks for their fills instead: straw, and the propeller
    // cap's yellow/red crown.
    for (const fill of ['#F0DCA4', '#F5C542', '#E8453C']) {
      expect(tree.root.findAllByProps({ fill }).length).toBe(0);
    }
  });
});
