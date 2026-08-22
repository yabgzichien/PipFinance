/**
 * Format a number as a 2-decimal amount with thousands separators,
 * e.g. 2000 -> "2,000.00". Implemented manually rather than via Intl to
 * avoid locale-data gaps in the Hermes engine.
 */
export function fmt(n: number): string {
  const value = Number.isFinite(n) ? n : 0;
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (negative ? '-' : '') + grouped + '.' + decPart;
}

function trimTrailingZeros(s: string): string {
  return s.replace(/\.?0+$/, '');
}

/**
 * Like `fmt`, but abbreviates very large amounts (K from 100,000, M from 1,000,000) so a hero
 * number stays a hero number instead of overflowing its card. Ordinary transaction/budget/net
 * worth figures (well under 100K) are untouched — this only matters for the rare very-large
 * input, not everyday amounts.
 */
export function fmtCompact(n: number): string {
  const value = Number.isFinite(n) ? n : 0;
  const negative = value < 0;
  const abs = Math.abs(value);
  const sign = negative ? '-' : '';

  if (abs < 100_000) return fmt(value);

  const asM = abs / 1_000_000;
  if (asM >= 1) return `${sign}${trimTrailingZeros(asM.toFixed(1))}M`;

  // Rounding a value just under 1,000,000 to one decimal of "K" can itself round up to
  // "1000.0K"  bump to M in that case rather than printing four zeros past the decimal point.
  const asK = abs / 1_000;
  if (Number(asK.toFixed(1)) >= 1000) return `${sign}${trimTrailingZeros(asM.toFixed(1))}M`;
  return `${sign}${trimTrailingZeros(asK.toFixed(1))}K`;
}

/**
 * "Read in 6 seconds" — the Saved screen's payoff line (docs/ui-engagement-plan.md Step 2).
 * Rounds to the nearest second and floors at 1: a sub-second extraction reading "0 seconds"
 * would undercut the claim it's making rather than support it. An honest 22 beats a rounded 6.
 */
export function readTimeLabel(elapsedMs: number): string {
  const seconds = Math.max(1, Math.round(elapsedMs / 1000));
  return `Read in ${seconds} second${seconds === 1 ? '' : 's'}`;
}
