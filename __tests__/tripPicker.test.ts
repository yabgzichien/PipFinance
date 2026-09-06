import { tripsForPicker } from '../src/lib/tripPicker';
import type { Trip } from '../src/lib/trips';

const trip = (id: string, archived = false): Trip => ({
  id,
  name: id,
  archived,
  createdAt: `2026-09-0${id.length}T00:00:00.000Z`,
  startDate: null,
  endDate: null,
});

describe('tripsForPicker', () => {
  it('shows active trips by default and excludes archived ones', () => {
    expect(tripsForPicker([trip('older'), trip('current'), trip('past', true)], false).map((entry) => entry.id))
      .toEqual(['current', 'older']);
  });

  it('adds archived trips only after the user asks to show them', () => {
    expect(tripsForPicker([trip('active'), trip('past', true)], true).map((entry) => entry.id))
      .toEqual(['active', 'past']);
  });
});
