// src/prices/fetchYahoo.ts
// Platform-aware network helper for Yahoo Finance requests.
// On web, routes requests through CORS-friendly proxies with multi-tier fallback.
// On native/Node, makes direct HTTP calls with desktop User-Agent.
import { Platform } from 'react-native';

/** Helper to fetch with timeout */
export async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 7000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch JSON from Yahoo Finance across native and web platforms.
 * On web, automatically routes through reliable CORS proxies.
 */
export async function fetchYahooJson(targetUrl: string, timeoutMs = 7000): Promise<any | null> {
  if (Platform.OS === 'web') {
    const fallbackTarget = targetUrl.includes('query1.finance.yahoo.com')
      ? targetUrl.replace('query1.finance.yahoo.com', 'query2.finance.yahoo.com')
      : null;

    // Try endpoints in order:
    // 1. Same-origin local dev server (/api/yahoo?url=...) or production serverless proxy
    // 2. Reliable CORS proxies (proxy.cors.sh)
    // 3. Fallback direct URLs
    const candidateUrls: string[] = [];

    if (typeof window !== 'undefined' && window.location) {
      candidateUrls.push(`/api/yahoo?url=${encodeURIComponent(targetUrl)}`);
    }

    candidateUrls.push(`https://proxy.cors.sh/${targetUrl}`);
    if (fallbackTarget) {
      candidateUrls.push(`https://proxy.cors.sh/${fallbackTarget}`);
    }

    candidateUrls.push(targetUrl);
    if (fallbackTarget) {
      candidateUrls.push(fallbackTarget);
    }

    for (const url of candidateUrls) {
      try {
        const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, Math.min(timeoutMs, 4000));
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          // Ignore HTML fallback pages (e.g. SPA index.html)
          if (contentType.includes('text/html')) {
            continue;
          }
          const text = await res.text();
          if (text && text.trim().startsWith('{')) {
            const data = JSON.parse(text);
            if (!data.error) {
              return data;
            }
          }
        }
      } catch {
        // Continue to next proxy
      }
    }
    return null;
  }

  // Native / Node: direct fetch with Accept header
  const headers = { Accept: 'application/json' };
  try {
    const res = await fetchWithTimeout(targetUrl, { headers }, timeoutMs);
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  // Fallback to query2 if query1 failed
  if (targetUrl.includes('query1.finance.yahoo.com')) {
    try {
      const fallbackUrl = targetUrl.replace('query1.finance.yahoo.com', 'query2.finance.yahoo.com');
      const res = await fetchWithTimeout(fallbackUrl, { headers }, timeoutMs);
      if (res.ok) return await res.json();
    } catch {}
  }

  return null;
}