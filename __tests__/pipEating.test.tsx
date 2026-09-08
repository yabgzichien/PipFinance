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
  'pip-eating-face',
  'pip-eating-eyes',
  'pip-eating-mouth',
  'pip-eating-bowl',
  'pip-eating-chopsticks',
  'pip-eating-noodle-strands',
  'pip-eating-steam',
];

describe('Pip eating pose', () => {
  it('renders every piece of the pose', () => {
    const tree = render(<Pip size={100} eating />);

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

  // Unlike the swordsman and the scientist this pose leaves the head slot alone, so a Pip eating
  // lunch inside the add-a-transaction flow keeps the straw hat that flow puts on him.
  it('still wears a hat', () => {
    const tree = render(<Pip size={100} eating hat />);

    expect(tree.root.findAllByProps({ fill: '#F0DCA4' }).length).toBeGreaterThan(0);
  });

  // The chopsticks stop at the corner of the mouth: tips inside it read as skewering Pip, and the
  // strand of noodle is what bridges the gap.
  it('stops the chopsticks short of the open mouth', () => {
    const tree = render(<Pip size={100} eating />);
    const sticks = tree.root
      .findByProps({ testID: 'pip-eating-chopsticks' })
      .findAll((n: { props: Record<string, unknown> }) => typeof n.props.x2 === 'number' && typeof n.props.y2 === 'number')
      .map((n: { props: { x2: number } }) => n.props.x2);

    // The mouth shape spans x 39.5-60.5; every tip has to land on or outside its right edge.
    expect(Math.min(...sticks)).toBeGreaterThanOrEqual(60.5);
  });

  // Everything held stays inside the 100x100 box, or it gets clipped at every call site.
  it('keeps the bowl and the steam inside the viewBox', () => {
    const tree = render(<Pip size={100} eating />);

    for (const testID of ['pip-eating-bowl', 'pip-eating-steam']) {
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
