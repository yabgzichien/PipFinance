// src/prices/fx.ts
// FX rate fetch via the same unofficial Yahoo chart endpoint the holdings pricer already
// uses (see src/prices/yahoo.ts). Network only, best-effort: null means "no rate", and
// every caller is required to treat that as "exclude", never as parity.
import { parseYahooChart } from '../lib/prices';

const CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' };

/** MYR per 1 unit of `code`, or null if the pair is unavailable. */
export async function fetchRateMYR(code: string): Promise<number | null> {
  if (code === 'MYR') return 1;
  try {
    // Encode the WHOLE symbol, matching src/prices/yahoo.ts's chart() exactly (it encodes
    // `${cur}MYR=X` as one string, which percent-escapes the `=`). Encoding only `code` and
    // appending a literal `MYR=X` produces a different, unproven URL shape for no reason.
    const symbol = `${code}MYR=X`;
    const res = await fetch(`${CHART}/${encodeURIComponent(symbol)}?range=2d&interval=1d`, { headers: HEADERS });
    if (!res.ok) return null;
    const parsed = parseYahooChart(await res.json());
    if (!parsed || !Number.isFinite(parsed.price) || parsed.price <= 0) return null;
    return parsed.price;
  } catch {
    return null;
  }
}
