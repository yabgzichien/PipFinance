import React from 'react';
import { Animated } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { DancingCow } from '../src/components/recap/DancingCow';

const TestRenderer = require('react-test-renderer');

function renderCow(props: React.ComponentProps<typeof DancingCow>) {
  let tree: ReturnType<typeof TestRenderer.create>;
  TestRenderer.act(() => {
    tree = TestRenderer.create(<DancingCow {...props} />);
  });
  return tree!;
}

describe('DancingCow', () => {
  it('renders an accessible original vector pose without scheduling motion when motion is off', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const tree = renderCow({ motion: 'off', size: 96 });

    expect(tree.root.findByProps({ accessibilityLabel: 'Dancing cow' })).toBeTruthy();
    expect(tree.root.findAllByType(Svg as never)).toHaveLength(1);
    expect(tree.root.findAllByType(G as never).length).toBeGreaterThan(0);
    expect(tree.root.findAllByType(Path as never).length).toBeGreaterThan(0);
    expect(tree.root.findAllByType(Ellipse as never).length).toBeGreaterThan(0);
    expect(tree.root.findAllByType(Circle as never).length).toBeGreaterThan(0);
    expect(tree.root.findAllByType(Rect as never).length).toBeGreaterThan(0);
    expect(timing).not.toHaveBeenCalled();

    timing.mockRestore();
  });

  it('maps caller-owned normalized progress into the full-motion root transform', () => {
    const progress = new Animated.Value(0);
    const tree = renderCow({ motion: 'full', progress });
    const root = tree.root.findByProps({ testID: 'dancing-cow-motion' });
    const transform = root.props.style.transform as Array<Record<string, { __getValue(): number | string }>>;
    const values = () => transform.map((entry) => Object.values(entry)[0].__getValue());

    const atStart = values();
    TestRenderer.act(() => progress.setValue(0.5));
    const atSecondBeat = values();

    expect(atSecondBeat).not.toEqual(atStart);
  });

  it.each([
    { motion: 'reduced' as const, exportMode: false },
    { motion: 'full' as const, exportMode: true },
  ])('uses the settled celebratory pose for $motion motion with exportMode=$exportMode', ({ motion, exportMode }) => {
    const progress = new Animated.Value(0.2);
    const tree = renderCow({ motion, exportMode, progress });
    const root = tree.root.findByProps({ testID: 'dancing-cow-motion' });

    expect(root.props.style.transform).toEqual([
      { translateY: -2 },
      { rotate: '-4deg' },
      { scaleX: 1.02 },
    ]);
  });
});
