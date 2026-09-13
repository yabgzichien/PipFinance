// __tests__/scanProxy.test.ts
import {
  fetchAllowance,
  getInstallationId,
  submitScan,
  type ScanRequest,
  type ScanResult,
} from '../src/billing/scanProxy';
import { getMeta, setMeta } from '../src/db/metaRepo';

jest.mock('../src/db/metaRepo', () => ({
  getMeta: jest.fn(),
  setMeta: jest.fn().mockResolvedValue(undefined),
}));

const originalFetch = global.fetch;

describe('getInstallationId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('generates and stores an anonymous installation id on first launch', async () => {
    (getMeta as jest.Mock).mockResolvedValue(null);
    const id = await getInstallationId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(setMeta).toHaveBeenCalledWith('installation_id', id);
  });

  it('reuses existing stored installation id', async () => {
    (getMeta as jest.Mock).mockResolvedValue('existing-uuid-1234');
    const id = await getInstallationId();
    expect(id).toBe('existing-uuid-1234');
    expect(setMeta).not.toHaveBeenCalled();
  });
});

describe('fetchAllowance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getMeta as jest.Mock).mockResolvedValue('anon-install-123');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches allowance from worker and returns normalized ScanAllowance', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tier: 'free',
        monthUsed: 12,
        dayUsed: 2,
      }),
    } as never);

    const allowance = await fetchAllowance();
    expect(allowance).toEqual({
      tier: 'free',
      monthUsed: 12,
      monthLimit: 20,
      dayUsed: 2,
      dayLimit: 3,
      canScan: true,
      blockedBy: null,
    });
  });

  it('falls back to safe default if worker is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const allowance = await fetchAllowance();
    expect(allowance.canScan).toBe(true);
    expect(allowance.tier).toBe('free');
  });
});

describe('submitScan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getMeta as jest.Mock).mockResolvedValue('anon-install-123');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('submits scan payload to worker and parses extracted items and allowance', async () => {
    const mockExtracted = [
      {
        merchant: 'Jaya Grocer',
        amount: 88.5,
        type: 'expense',
        date: '2026-09-13',
        currency: 'MYR',
        method: 'tng',
      },
    ];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        items: mockExtracted,
        allowance: {
          tier: 'free',
          monthUsed: 3,
          dayUsed: 1,
        },
      }),
    } as never);

    const req: ScanRequest = {
      imageBase64: 'base64data',
      mimeType: 'image/jpeg',
      categories: [{ id: 'groceries', label: 'Groceries', kind: 'expense' }],
    };

    const res = await submitScan(req);
    expect(res.ok).toBe(true);
    expect(res.items).toEqual(mockExtracted);
    expect(res.allowance.monthUsed).toBe(3);
    expect(res.allowance.dayUsed).toBe(1);
    expect(res.allowance.canScan).toBe(true);
  });

  it('handles worker quota rejection (e.g. daily limit hit)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        ok: false,
        error: 'daily_limit',
        allowance: {
          tier: 'free',
          monthUsed: 15,
          dayUsed: 3,
        },
      }),
    } as never);

    const req: ScanRequest = {
      imageBase64: 'base64data',
      mimeType: 'image/jpeg',
      categories: [],
    };

    const res = await submitScan(req);
    expect(res.ok).toBe(false);
    expect(res.quotaBlocked).toBe(true);
    expect(res.allowance.blockedBy).toBe('daily');
    expect(res.allowance.canScan).toBe(false);
  });

  it('handles worker quota rejection for monthly limit hit', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        ok: false,
        error: 'monthly_limit',
        allowance: {
          tier: 'free',
          monthUsed: 20,
          dayUsed: 1,
        },
      }),
    } as never);

    const req: ScanRequest = {
      imageBase64: 'base64data',
      mimeType: 'image/jpeg',
      categories: [],
    };

    const res = await submitScan(req);
    expect(res.ok).toBe(false);
    expect(res.quotaBlocked).toBe(true);
    expect(res.allowance.blockedBy).toBe('monthly');
    expect(res.allowance.canScan).toBe(false);
  });
});
