/** Maps a touch x within a track to a 1-indexed notch. Pure so snapping can be tested without
 *  mounting the native gesture responder. */
export function notchFromX(x: number, trackWidth: number, count: number): number {
  if (trackWidth <= 0 || count <= 1) return 1;
  const ratio = Math.max(0, Math.min(1, x / trackWidth));
  return Math.round(ratio * (count - 1)) + 1;
}

export function notchAfterAccessibilityAction(
  value: number,
  count: number,
  action: 'increment' | 'decrement'
): number {
  const delta = action === 'increment' ? 1 : -1;
  return Math.max(1, Math.min(Math.max(1, count), value + delta));
}
