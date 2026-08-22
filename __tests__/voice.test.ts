import { notificationTitle } from '../src/lib/voice';

describe('notificationTitle', () => {
  it('names Pip as the sender for the routine class', () => {
    expect(notificationTitle('routine', 0)).toContain('Pip');
  });

  it('names Pip as the sender for the save class', () => {
    expect(notificationTitle('save', 0)).toContain('Pip');
  });

  it('picks deterministically off the seed, not randomly', () => {
    expect(notificationTitle('routine', 3)).toBe(notificationTitle('routine', 3));
  });

  it('rotates rather than always returning the same line', () => {
    const seen = new Set(Array.from({ length: 6 }, (_, i) => notificationTitle('routine', i)));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('keeps the two classes on separate pools', () => {
    const routine = new Set(Array.from({ length: 6 }, (_, i) => notificationTitle('routine', i)));
    const save = new Set(Array.from({ length: 6 }, (_, i) => notificationTitle('save', i)));
    for (const line of routine) expect(save.has(line)).toBe(false);
  });
});
