// src/prices/fx.ts
// FX rate fetch for non-MYR currencies with resilient multi-provider fallback.
// Network only, best-effort: null means "no rate", and every caller is required
// to treat that as "exclude", never as parity.
import { parseYahooChart } from '../lib/prices';

const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_CHART_FALLBACK = 'https://query2.finance.yahoo.com/v8/finance/chart';
const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' };

/** Helper to fetch with timeout */
async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** MYR per 1 unit of `code`, or null if unavailable across all providers. */
export async function fetchRateMYR(code: string): Promise<number | null> {
  const upper = code.trim().toUpperCase();
  if (upper === 'MYR') return 1;

  // Provider 1: Open Exchange Rates API (free, open, high availability)
  try {
    const res = await fetchWithTimeout(`https://open.er-api.com/v6/latest/${encodeURIComponent(upper)}`);
    if (res.ok) {
      const data = await res.json();
      const rate = data?.rates?.MYR;
      if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) return rate;
    }
  } catch {}

  // Provider 2: Free currency-api CDN (Cloudflare edge)
  try {
    const lower = upper.toLowerCase();
    const res = await fetchWithTimeout(`https://latest.currency-api.pages.dev/v1/currencies/${lower}.json`);
    if (res.ok) {
      const data = await res.json();
      const rate = data?.[lower]?.myr;
      if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) return rate;
    }
  } catch {}

  // Provider 3: jsDelivr currency-api fallback
  try {
    const lower = upper.toLowerCase();
    const res = await fetchWithTimeout(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${lower}.json`);
    if (res.ok) {
      const data = await res.json();
      const rate = data?.[lower]?.myr;
      if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) return rate;
    }
  } catch {}

  // Provider 4: Yahoo Finance chart endpoints
  const symbol = `${upper}MYR=X`;
  for (const base of [YAHOO_CHART, YAHOO_CHART_FALLBACK]) {
    try {
      const res = await fetchWithTimeout(`${base}/${encodeURIComponent(symbol)}?range=2d&interval=1d`, { headers: YAHOO_HEADERS });
      if (res.ok) {
        const parsed = parseYahooChart(await res.json());
        if (parsed && Number.isFinite(parsed.price) && parsed.price > 0) return parsed.price;
      }
    } catch {}
  }

  return null;
}
