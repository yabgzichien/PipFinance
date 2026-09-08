// src/lib/chipRow.ts
// Which options a capped chip row actually shows.
//
// A chip row trades completeness for speed: the common choices are one tap away and the rest
// live behind a "More" picker. That trade only holds if the row can still show what is
// currently selected — a chip row whose selection is invisible reads as though nothing was
// chosen at all, so a selection from beyond the cap displaces the last chip rather than the
// user's answer disappearing behind "More".

/** Anything a chip row can render. Callers keep their own richer types. */
type Choice = { id: string };

export function visibleChoices<T extends Choice>(all: T[], selectedId: string | null, max: number): T[] {
  if (all.length <= max) return all;
  const head = all.slice(0, max);
  if (!selectedId || head.some((item) => item.id === selectedId)) return head;
  const selected = all.find((item) => item.id === selectedId);
  if (!selected) return head;
  return [...all.slice(0, max - 1), selected];
}
