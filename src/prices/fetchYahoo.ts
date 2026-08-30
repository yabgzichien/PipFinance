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
    // Browsers block direct Yahoo Finance calls due to CORS.
    // Try reliable CORS proxies in order:
    const candidateUrls = [
      `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
      `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(targetUrl)}`,
      targetUrl,
    ];

    for (const url of candidateUrls) {
      try {
        const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, timeoutMs);
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim().startsWith('{')) {
            return JSON.parse(text);
          }
        }
      } catch {
        // Continue to next proxy
      }
    }
    return null;
  }

  // Native / Node: direct fetch with desktop User-Agent header
  const headers = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
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