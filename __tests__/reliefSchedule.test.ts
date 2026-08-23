import { RELIEF_SCHEDULES, scheduleForYA } from '../src/lib/reliefSchedule';

describe('relief schedules', () => {
  for (const [yaKey, schedule] of Object.entries(RELIEF_SCHEDULES)) {
    describe(`YA ${yaKey}`, () => {
      it('has unique codes', () => {
        const codes = schedule.lines.map((l) => l.code);
        expect(new Set(codes).size).toBe(codes.length);
      });

      it('has every parent reference pointing at a real code in the same schedule', () => {
        const codes = new Set(schedule.lines.map((l) => l.code));
        for (const line of schedule.lines) {
          if (line.parent) expect(codes.has(line.parent)).toBe(true);
        }
      });

      it('has a positive cap on every line', () => {
        for (const line of schedule.lines) expect(line.cap).toBeGreaterThan(0);
      });

      it('has a `ya` field matching its own registry key', () => {
        expect(schedule.ya).toBe(Number(yaKey));
      });
    });
  }

  it('returns null for a year with no defined schedule', () => {
    expect(scheduleForYA(1999)).toBeNull();
  });

  it('returns the 2025 schedule by year number', () => {
    expect(scheduleForYA(2025)).toBe(RELIEF_SCHEDULES[2025]);
  });
});
