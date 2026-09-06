/**
 * Tracks committed visible-sheet generations. Async work captures the active generation;
 * closing invalidates it so a late completion cannot affect a later opening.
 */
export function createOpeningGuard() {
  let generation = 0;
  let isOpen = false;

  return {
    /** Call from a commit-safe visible=true lifecycle. */
    open(): void {
      isOpen = true;
      generation += 1;
    },
    /** Call synchronously for an explicit close and from visible=false lifecycle. */
    close(): void {
      isOpen = false;
      generation += 1;
    },
    beginOperation(): number | null {
      return isOpen ? generation : null;
    },
    isCurrent(candidate: number | null): boolean {
      return candidate !== null && isOpen && candidate === generation;
    },
  };
}
