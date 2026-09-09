import { createOpeningGuard } from '../src/lib/openingGuard';
import { createTripForOpening, tripsForPicker } from '../src/lib/tripPicker';
import type { Trip } from '../src/lib/trips';

const trip = (id: string, archived = false): Trip => ({
  id,
  name: id,
  archived,
  createdAt: `2026-09-0${id.length}T00:00:00.000Z`,
  startDate: null,
  endDate: null,
  icon: null,
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('createTripForOpening', () => {
  it('does not select or close after the picker is dismissed before creation resolves', async () => {
    const guard = createOpeningGuard();
    const pending = deferred<Trip>();
    const selected: string[] = [];
    let closed = 0;
    let settled = 0;
    guard.open();

    const creation = createTripForOpening(
      guard,
      () => pending.promise,
      (id) => { selected.push(id); closed += 1; },
      () => { settled += 1; }
    );
    guard.close();
    pending.resolve(trip('late'));
    await creation;

    expect(selected).toEqual([]);
    expect(closed).toBe(0);
    expect(settled).toBe(0);
  });

  it('isolates a reopened picker from an earlier creation that resolves late', async () => {
    const guard = createOpeningGuard();
    const first = deferred<Trip>();
    const second = deferred<Trip>();
    const selected: string[] = [];
    let settled = 0;

    guard.open();
    const firstCreation = createTripForOpening(
      guard,
      () => first.promise,
      (id) => { selected.push(id); },
      () => { settled += 1; }
    );
    guard.close();
    guard.open();
    const secondCreation = createTripForOpening(
      guard,
      () => second.promise,
      (id) => { selected.push(id); },
      () => { settled += 1; }
    );

    first.resolve(trip('stale'));
    await firstCreation;
    expect(selected).toEqual([]);
    expect(settled).toBe(0);

    second.resolve(trip('current'));
    await secondCreation;
    expect(selected).toEqual(['current']);
    expect(settled).toBe(1);
  });
});
