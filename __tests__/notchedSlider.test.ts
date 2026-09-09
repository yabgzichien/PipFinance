import { notchFromX } from '../src/lib/notchedSlider';

describe('notchFromX', () => {
  const W = 200;

  it('snaps the extremes to the first and last notch', () => {
    expect(notchFromX(0, W, 5)).toBe(1);
    expect(notchFromX(W, W, 5)).toBe(5);
  });

  it('clamps beyond either end rather than going out of range', () => {
    expect(notchFromX(-40, W, 5)).toBe(1);
    expect(notchFromX(W + 40, W, 5)).toBe(5);
  });

  it('snaps to the nearest notch', () => {
    expect(notchFromX(W / 2, W, 5)).toBe(3);
    expect(notchFromX(W * 0.24, W, 5)).toBe(2);
    expect(notchFromX(W * 0.26, W, 5)).toBe(2);
  });

  it('always returns an integer inside 1..count', () => {
    for (let x = -10; x <= W + 10; x += 3) {
      const n = notchFromX(x, W, 5);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it('degrades safely on a zero-width track (pre-layout)', () => {
    expect(notchFromX(0, 0, 5)).toBe(1);
  });
});
