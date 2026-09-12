// __tests__/scanProgressBarPsychology.test.tsx
import React from 'react';

let mockReducedMotion = true;
jest.mock('../src/state/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));

const TestRenderer = require('react-test-renderer');
import { ScanProgressBar } from '../src/components/ScanProgressBar';

describe('ScanProgressBar Psychological UI', () => {
  beforeEach(() => {
    mockReducedMotion = true;
  });

  it('renders initial endowed progress percentage correctly', () => {
    let root: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      root = TestRenderer.create(<ScanProgressBar progress={15} />);
    });
    const tree = root!.toJSON();
    expect(JSON.stringify(tree)).toContain('15%');
    expect(JSON.stringify(tree)).toContain('Scanning progress');
  });

  it('renders custom labels and clamps values safely within 0-100', () => {
    let root: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      root = TestRenderer.create(
        <ScanProgressBar progress={45} label="Reading line items…" />
      );
    });
    const tree = root!.toJSON();
    expect(JSON.stringify(tree)).toContain('45%');
    expect(JSON.stringify(tree)).toContain('Reading line items…');
  });

  it('transitions to completion state when progress reaches 100%', () => {
    let root: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      root = TestRenderer.create(
        <ScanProgressBar progress={100} label="Receipt scan progress" />
      );
    });
    const json = JSON.stringify(root!.toJSON());
    expect(json).toContain('100%');
    expect(json).toContain('Done');
  });

  it('transitions to completion state when isComplete flag is passed', () => {
    let root: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      root = TestRenderer.create(
        <ScanProgressBar
          progress={92}
          isComplete={true}
          completionLabel="Analysis ready!"
        />
      );
    });
    const json = JSON.stringify(root!.toJSON());
    expect(json).toContain('100%');
    expect(json).toContain('Analysis ready!');
  });

  it('supports hiding percentage when requested', () => {
    let root: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      root = TestRenderer.create(
        <ScanProgressBar progress={50} showPercentage={false} />
      );
    });
    const json = JSON.stringify(root!.toJSON());
    expect(json).not.toContain('50%');
  });

  it('renders with active motion animations when reduced motion is disabled', () => {
    mockReducedMotion = false;
    let root: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      root = TestRenderer.create(<ScanProgressBar progress={30} />);
    });
    const tree = root!.toJSON();
    expect(JSON.stringify(tree)).toContain('30%');
  });
});
