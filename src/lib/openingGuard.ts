/**
 * Tracks one visible-sheet generation. Async work captures the generation returned by
 * `begin`; closing the sheet invalidates it so a late completion cannot affect a later open.
 */
export function createOpeningGuard() {
  let generation = 0;

  return {
    begin(): number {
      generation += 1;
      return generation;
    },
    invalidate(): void {
      generation += 1;
    },
    isCurrent(candidate: number): boolean {
      return candidate === generation;
    },
  };
}
