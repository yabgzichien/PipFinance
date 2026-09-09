// __tests__/destinations.test.ts
// The matcher runs on every trip name with no user confirmation, so a wrong guess is a wrong
// picture the user never asked for. Every case here is one where a plausible-looking match is
// the wrong answer, plus the boundary rules that keep short aliases from firing inside words.
import { DESTINATIONS, matchDestination, normalizeForMatch } from '../src/lib/destinations';

describe('matchDestination', () => {
  it('matches a bare country name', () => {
    expect(matchDestination('Singapore')).toBe('sg');
    expect(matchDestination('Japan')).toBe('jp');
  });

  it('matches the way people actually name trips, with dates and filler around it', () => {
    expect(matchDestination('Singapore Sep 2026')).toBe('sg');
    expect(matchDestination('Trip to Japan!')).toBe('jp');
    expect(matchDestination('  japan   ')).toBe('jp');
  });

  it('maps a city to its country, since nobody names a trip after the country', () => {
    expect(matchDestination('Osaka 2026')).toBe('jp');
    expect(matchDestination('Paris trip')).toBe('fr');
    expect(matchDestination('Bangkok with mum')).toBe('th');
    expect(matchDestination('Bali honeymoon')).toBe('id');
  });

  it('matches Chinese names, which is half of what this app is used in', () => {
    expect(matchDestination('日本 2026')).toBe('jp');
    expect(matchDestination('东京之旅')).toBe('jp');
    expect(matchDestination('新加坡')).toBe('sg');
    expect(matchDestination('去巴黎玩')).toBe('fr');
  });

  it('is case and accent insensitive', () => {
    expect(matchDestination('JAPAN')).toBe('jp');
    expect(matchDestination('züRICH')).toBe('ch');
    expect(matchDestination('SÃO PAULO')).toBe('br');
  });

  it('prefers the longest alias, so a more specific place wins', () => {
    // 'south korea' must beat 'korea', and 'new york' must not be decided by 'york' alone.
    expect(matchDestination('South Korea 2026')).toBe('kr');
    expect(matchDestination('New York in May')).toBe('us');
    // 'new zealand' contains neither country by accident, but shares a word with New York.
    expect(matchDestination('New Zealand road trip')).toBe('nz');
  });

  it('does not fire on an alias buried inside a longer word', () => {
    // Without word boundaries 'in' (India) or 'us' (USA) would match almost anything.
    expect(matchDestination('Business lunch')).toBeNull();
    expect(matchDestination('Insurance renewal')).toBeNull();
    expect(matchDestination('Chineseware shopping')).toBeNull();
  });

  it('refuses the food that shares a country name', () => {
    expect(matchDestination('Turkey dinner')).toBeNull();
    expect(matchDestination('Roast turkey')).toBeNull();
    expect(matchDestination('turkey sandwich')).toBeNull();
  });

  it('refuses a local place that merely quotes a country', () => {
    expect(matchDestination('China Town food crawl')).toBeNull();
    expect(matchDestination('Chinatown')).toBeNull();
    expect(matchDestination('Little India walk')).toBeNull();
  });

  it('still matches when the real destination appears alongside a blocked phrase', () => {
    // Blocking must disqualify the phrase, not the whole name.
    expect(matchDestination('China Town then Beijing')).toBe('cn');
    expect(matchDestination('Turkey dinner in Istanbul')).toBe('tr');
  });

  it('returns null for a trip that is not about a place', () => {
    expect(matchDestination("Mum's birthday")).toBeNull();
    expect(matchDestination('Work offsite')).toBeNull();
    expect(matchDestination('')).toBeNull();
    expect(matchDestination('   ')).toBeNull();
  });
});

describe('DESTINATIONS table', () => {
  it('has unique keys', () => {
    const keys = DESTINATIONS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('never lets the same alias resolve to two destinations', () => {
    // An alias claimed twice makes the match order-dependent, which is how a rename starts
    // silently changing the picture.
    const seen = new Map<string, string>();
    for (const d of DESTINATIONS) {
      for (const a of d.aliases) {
        const norm = normalizeForMatch(a);
        expect(seen.has(norm) ? `${norm} claimed by ${seen.get(norm)} and ${d.key}` : 'ok').toBe('ok');
        seen.set(norm, d.key);
      }
    }
  });

  it('carries a label in both languages for the picker', () => {
    for (const d of DESTINATIONS) {
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.labelZh.length).toBeGreaterThan(0);
    }
  });

  it('every destination is reachable by its own English label', () => {
    for (const d of DESTINATIONS) expect(matchDestination(d.label)).toBe(d.key);
  });
});
