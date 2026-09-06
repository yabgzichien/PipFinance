import type { Trip } from './trips';

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
