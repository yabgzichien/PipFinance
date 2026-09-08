import React from 'react';
import { Animated } from 'react-native';
import { PIP_WEB_FLOAT_STYLE, Pip, shouldUsePipJsFloat } from '../src/components/Pip';

let mockReducedMotion = true;
jest.mock('../src/state/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));

const TestRenderer = require('react-test-renderer');

describe('Pip sassy pose', () => {
  it('renders open eyes, eyelashes and glossy lips with no manicure hands', () => {
    let tree: ReturnType<typeof TestRenderer.create>;

    TestRenderer.act(() => {
      tree = TestRenderer.create(<Pip size={100} sassy />);
    });

    expect(tree!.root.findAllByProps({ testID: 'pip-sassy-face' }).length).toBeGreaterThan(0);
    expect(tree!.root.findAllByProps({ testID: 'pip-sassy-glow' }).length).toBeGreaterThan(0);
    expect(tree!.root.findAllByProps({ testID: 'pip-sassy-eyes' }).length).toBeGreaterThan(0);
    expect(tree!.root.findAllByProps({ testID: 'pip-sassy-eyelashes' }).length).toBeGreaterThan(0);
    expect(tree!.root.findAllByProps({ testID: 'pip-sassy-lips' }).length).toBeGreaterThan(0);
    for (const testID of [
      'pip-sassy-hand-left',
      'pip-sassy-hand-right',
      'pip-sassy-hand-left-clip',
      'pip-sassy-hand-right-clip',
      'pip-sassy-manicure',
      'pip-sassy-fingers',
    ]) {
      expect(tree!.root.findAllByProps({ testID }).length).toBe(0);
    }
  });

  it('keeps the glow scoped to the sassy pose', () => {
    let tree: ReturnType<typeof TestRenderer.create>;

    TestRenderer.act(() => {
      tree = TestRenderer.create(<Pip size={100} />);
    });

    expect(tree!.root.findAllByProps({ testID: 'pip-sassy-glow' }).length).toBe(0);
  });

  it('runs the float as a non-interactive native-driver animation', () => {
    mockReducedMotion = false;
    const timing = jest.spyOn(Animated, 'timing');
    let tree: ReturnType<typeof TestRenderer.create>;

    TestRenderer.act(() => {
      tree = TestRenderer.create(<Pip size={100} sassy float />);
    });

    const floatCalls = timing.mock.calls.slice(0, 2).map(([, config]) => config);
    expect(floatCalls).toHaveLength(2);
    expect(floatCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ toValue: -4, duration: 2200, useNativeDriver: true, isInteraction: false }),
      expect.objectContaining({ toValue: 0, duration: 2200, useNativeDriver: true, isInteraction: false }),
    ]));

    TestRenderer.act(() => tree!.unmount());
    timing.mockRestore();
    mockReducedMotion = true;
  });

  it('moves the web float to compositor keyframes instead of a JavaScript frame loop', () => {
    expect(shouldUsePipJsFloat).toBeDefined();
    expect(shouldUsePipJsFloat('web', true, false)).toBe(false);
    expect(shouldUsePipJsFloat('ios', true, false)).toBe(true);
    expect(PIP_WEB_FLOAT_STYLE).toMatchObject({
      animationDuration: '4.4s',
      animationIterationCount: 'infinite',
      animationTimingFunction: 'ease-in-out',
      willChange: 'transform',
    });
  });
});
