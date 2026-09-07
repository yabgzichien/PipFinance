import type { Trip } from './trips';
import type { createOpeningGuard } from './openingGuard';

type OpeningGuard = ReturnType<typeof createOpeningGuard>;

/** Finish an inline create only if the picker opening that started it is still current. */
export async function createTripForOpening(
  guard: OpeningGuard,
  createTrip: () => Promise<Trip>,
  onCreated: (tripId: string) => void,
  onSettled: () => void
): Promise<void> {
  const operation = guard.beginOperation();
  if (operation === null) return;
  try {
    const trip = await createTrip();
    if (guard.isCurrent(operation)) onCreated(trip.id);
  } finally {
    if (guard.isCurrent(operation)) onSettled();
  }
}

/**
 * Trips offered by a routine attachment picker. Archived trips stay out of the initial list
 * so completed travel does not crowd current work, but remain deliberately reachable for late
 * charges once the user expands the archived section.
 */
export function tripsForPicker(trips: Trip[], showArchived: boolean): Trip[] {
  return trips
    .filter((trip) => !trip.archived || showArchived)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
