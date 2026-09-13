// worker/test/proxy.test.ts
import worker from '../src/index';
import { createMockD1 } from './mockD1';

describe('Worker proxy endpoint', () => {
  let db: ReturnType<typeof createMockD1>;

  beforeEach(() => {
    db = createMockD1();
  });

  it('rejects requests without x-installation-id header', async () => {
    const req = new Request('https://proxy.pip.local/allowance', {
      method: 'GET',
    });
    const res = await worker.fetch(req, { DB: db });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('x-installation-id');
  });

  it('returns initial allowance for new installation on GET /allowance', async () => {
    const req = new Request('https://proxy.pip.local/allowance', {
      method: 'GET',
      headers: {
        'x-installation-id': 'device-001',
      },
    });
    const res = await worker.fetch(req, { DB: db });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      tier: 'free',
      monthUsed: 0,
      monthLimit: 20,
      dayUsed: 0,
      dayLimit: 3,
      canScan: true,
      blockedBy: null,
    });
  });

  it('returns unlimited allowance for pro on GET /allowance', async () => {
    const req = new Request('https://proxy.pip.local/allowance', {
      method: 'GET',
      headers: {
        'x-installation-id': 'device-002',
        'x-entitlement': 'pro',
      },
    });
    const res = await worker.fetch(req, { DB: db });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tier).toBe('pro');
    expect(json.canScan).toBe(true);
    expect(json.blockedBy).toBeNull();
  });

  it('handles scan request, commits quota on success, and increments usage', async () => {
    const req = new Request('https://proxy.pip.local/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-installation-id': 'device-003',
        'x-idempotency-key': 'idemp-1',
      },
      body: JSON.stringify({
        imageBase64: 'mockBase64',
        mimeType: 'image/png',
        categories: [{ id: 'food', label: 'Food' }],
      }),
    });

    const res = await worker.fetch(req, { DB: db });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.allowance.dayUsed).toBe(1);
    expect(json.allowance.monthUsed).toBe(1);
  });

  it('blocks scan request with 429 when daily quota is exhausted', async () => {
    // Perform 3 successful scans
    for (let i = 1; i <= 3; i++) {
      const r = new Request('https://proxy.pip.local/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-installation-id': 'device-004',
          'x-idempotency-key': `req-${i}`,
        },
        body: JSON.stringify({
          imageBase64: 'img',
          mimeType: 'image/jpeg',
        }),
      });
      const resp = await worker.fetch(r, { DB: db });
      expect(resp.status).toBe(200);
    }

    // 4th scan must return 429
    const fourthReq = new Request('https://proxy.pip.local/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-installation-id': 'device-004',
        'x-idempotency-key': 'req-4',
      },
      body: JSON.stringify({
        imageBase64: 'img',
        mimeType: 'image/jpeg',
      }),
    });
    const fourthRes = await worker.fetch(fourthReq, { DB: db });
    expect(fourthRes.status).toBe(429);
    const fourthJson = await fourthRes.json();
    expect(fourthJson.ok).toBe(false);
    expect(fourthJson.error).toBe('daily_limit');
    expect(fourthJson.allowance.blockedBy).toBe('daily');
  });
});
