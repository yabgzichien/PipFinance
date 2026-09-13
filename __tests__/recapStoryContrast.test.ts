import { STORY_PALETTES } from '../src/lib/recapStoryTheme';

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(first: string, second: string): number {
  const brightest = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darkest = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (brightest + 0.05) / (darkest + 0.05);
}

describe('monthly recap story palettes', () => {
  test.each(Object.entries(STORY_PALETTES))('%s foreground supports meaningful small text', (_name, palette) => {
    expect(contrastRatio(palette.foreground, palette.background)).toBeGreaterThanOrEqual(4.5);
  });

  test.each(['ritual', 'identity', 'spotlight', 'habit', 'finale'] as const)(
    '%s accent supports its intentionally large meaningful label',
    (name) => {
      const palette = STORY_PALETTES[name];
      expect(contrastRatio(palette.accent, palette.background)).toBeGreaterThanOrEqual(3);
    },
  );
});
