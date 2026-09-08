export const ACCENT_SWATCH_GAP = 7;
export const MIN_ACCENT_SWATCH_SIZE = 30;
export const MAX_ACCENT_SWATCH_SIZE = 38;

/**
 * Derives one circular swatch size for a single, non-wrapping row. The 30px floor covers the
 * narrowest supported content width; at wider widths the circles stop growing at their normal
 * 38px size, leaving the row calm rather than stretched.
 */
export function accentSwatchSize(rowWidth: number, count: number): number {
  if (count <= 0) return MAX_ACCENT_SWATCH_SIZE;
  const availablePerSwatch = (rowWidth - ACCENT_SWATCH_GAP * (count - 1)) / count;
  return Math.max(MIN_ACCENT_SWATCH_SIZE, Math.min(MAX_ACCENT_SWATCH_SIZE, Math.floor(availablePerSwatch)));
}

/** Centers the normal-size row, but keeps compact swatches flush when they already fill it. */
export function accentSwatchJustifyContent(rowWidth: number, count: number): 'center' | 'flex-start' {
  if (rowWidth <= 0) return 'center';
  const usedWidth = accentSwatchSize(rowWidth, count) * count + ACCENT_SWATCH_GAP * (count - 1);
  return usedWidth < rowWidth ? 'center' : 'flex-start';
}
