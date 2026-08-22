// src/lib/voice.ts
// Pip's personality as a named notification sender (docs/ui-engagement-plan.md Step 7, item 4).
// This is deliberately narrow: only the two title pools Step 7 needs. Step 6's fuller dosing
// table (empty states, milestones, the widget) is a separate pass that can add its own exports
// here without touching these.
//
// Titles rotate off a deterministic seed (the calendar day a rung fires on) rather than
// Math.random(), so lib/reminders.ts stays pure and testable and a given day's rung never
// flickers across a re-plan within the same session.

export type NotificationClass = 'routine' | 'save';

/** Low-urgency habit nudges: the daily "did you log anything" ping. Never shares a tone with
 *  `SAVE_TITLES` below (ui-engagement-plan.md Step 7, item 2). */
const ROUTINE_TITLES = ['Pip has a question', 'Checking in, from Pip', "Pip's just curious"];

/** Nudges with real stakes, like a debt aging further or a bill close to or past due. */
const SAVE_TITLES = ['Pip flagged something', 'Heads up from Pip', "Pip's watching a deadline"];

function pickLine(pool: string[], seed: number): string {
  return pool[((seed % pool.length) + pool.length) % pool.length];
}

/** One rotating, Pip-attributed title for the given notification class. */
export function notificationTitle(cls: NotificationClass, seed: number): string {
  return pickLine(cls === 'routine' ? ROUTINE_TITLES : SAVE_TITLES, seed);
}
