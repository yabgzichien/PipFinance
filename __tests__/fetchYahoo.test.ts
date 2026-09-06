// __tests__/fetchYahoo.test.ts
import { Platform } from 'react-native';
import { fetchYahooJson } from '../src/prices/fetchYahoo';

describe('fetchYahooJson', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete (global as any).window;
    Platform.OS = 'ios';
  });

  it('web: calls /api/yahoo local proxy first when window is available', async () => {
    Platform.OS = 'web';
    (global as any).window = { location: { origin: 'http://localhost:8081' } };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ quotes: [{ symbol: 'AAPL' }] }),
    });
    global.fetch = mockFetch;

    const result = await fetchYahooJson('https://query1.finance.yahoo.com/v1/finance/search?q=AAPL');
    expect(result).toEqual({ quotes: [{ symbol: 'AAPL' }] });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/yahoo?url='),
      expect.anything()
    );
  });

  it('web: ignores text/html responses and falls back to proxy.cors.sh', async () => {
    Platform.OS = 'web';
    (global as any).window = { location: { origin: 'http://localhost:8081' } };
    const mockFetch = jest
      .fn()
      // First call (/api/yahoo) returns SPA html
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => '<!DOCTYPE html><html>...</html>',
      })
      // Second call (proxy.cors.sh) returns valid JSON
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify({ quotes: [{ symbol: 'AAPL' }] }),
      });
    global.fetch = mockFetch;

    const result = await fetchYahooJson('https://query1.finance.yahoo.com/v1/finance/search?q=AAPL');
    expect(result).toEqual({ quotes: [{ symbol: 'AAPL' }] });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toContain('https://proxy.cors.sh/');
  });

  it('web: skips proxy errors and falls back to next candidate', async () => {
    Platform.OS = 'web';
    (global as any).window = { location: { origin: 'http://localhost:8081' } };
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify({ error: 'Proxy rate limit' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify({ quotes: [{ symbol: 'AAPL' }] }),
      });
    global.fetch = mockFetch;

    const result = await fetchYahooJson('https://query1.finance.yahoo.com/v1/finance/search?q=AAPL');
    expect(result).toEqual({ quotes: [{ symbol: 'AAPL' }] });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('native: fetches directly with Accept header', async () => {
    Platform.OS = 'ios';
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ quotes: [{ symbol: 'BTC-USD' }] }),
    });
    global.fetch = mockFetch;

    const result = await fetchYahooJson('https://query1.finance.yahoo.com/v1/finance/search?q=BTC');
    expect(result).toEqual({ quotes: [{ symbol: 'BTC-USD' }] });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://query1.finance.yahoo.com/v1/finance/search?q=BTC',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
        }),
      })
    );
  });

  it('native: falls back to query2 when query1 fails', async () => {
    Platform.OS = 'android';
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ quotes: [{ symbol: 'ETH-USD' }] }),
      });
    global.fetch = mockFetch;

    const result = await fetchYahooJson('https://query1.finance.yahoo.com/v1/finance/search?q=ETH');
    expect(result).toEqual({ quotes: [{ symbol: 'ETH-USD' }] });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toContain('query2.finance.yahoo.com');
  });
});
