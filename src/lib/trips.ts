/* Trip types. A trip is a second, orthogonal grouping over existing transactions — see
 * src/db/tripsRepo.ts for the repository and docs/superpowers/sdd for the design. */

/** A named trip a user can (optionally) attach transactions to. Membership is always explicit;
 *  `startDate`/`endDate` are metadata for display and candidate-finding only, never a filter
 *  that decides membership on their own. */
export interface Trip {
  id: string;
  name: string;
  createdAt: string;
  archived: boolean;
  startDate: string | null;
  endDate: string | null;
}
