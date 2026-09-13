// __tests__/scanQuota.test.ts
import {
  FREE_DAILY_SCANS,
  FREE_MONTHLY_SCANS,
  normalizeAllowance,
  type ScanAllowance,
} from '../src/billing/scanQuota';

describe('scanQuota constants', () => {
  it('defines the approved free monthly and daily limits', () => {
    expect(FREE_MONTHLY_SCANS).toBe(20);
    expect(FREE_DAILY_SCANS).toBe(3);
  });
});

describe('normalizeAllowance', () => {
  it('normalizes a free tier response under quota', () => {
    const raw = {
      tier: 'free',
      monthUsed: 5,
      dayUsed: 1,
    };
    const allowance = normalizeAllowance(raw);
    expect(allowance).toEqual({
      tier: 'free',
      monthUsed: 5,
      monthLimit: 20,
      dayUsed: 1,
      dayLimit: 3,
      canScan: true,
      blockedBy: null,
    });
  });

  it('detects daily quota exhaustion', () => {
    const raw = {
      tier: 'free',
      monthUsed: 10,
      dayUsed: 3,
    };
    const allowance = normalizeAllowance(raw);
    expect(allowance.canScan).toBe(false);
    expect(allowance.blockedBy).toBe('daily');
  });

  it('detects monthly quota exhaustion', () => {
    const raw = {
      tier: 'free',
      monthUsed: 20,
      dayUsed: 1,
    };
    const allowance = normalizeAllowance(raw);
    expect(allowance.canScan).toBe(false);
    expect(allowance.blockedBy).toBe('monthly');
  });

  it('prefers daily if both are exhausted', () => {
    const raw = {
      tier: 'free',
      monthUsed: 20,
      dayUsed: 3,
    };
    const allowance = normalizeAllowance(raw);
    expect(allowance.canScan).toBe(false);
    expect(allowance.blockedBy).toBe('daily');
  });

  it('reports unlimited scans for pro tier', () => {
    const raw = {
      tier: 'pro',
      monthUsed: 50,
      dayUsed: 15,
    };
    const allowance = normalizeAllowance(raw);
    expect(allowance).toEqual({
      tier: 'pro',
      monthUsed: 50,
      monthLimit: Number.POSITIVE_INFINITY,
      dayUsed: 15,
      dayLimit: Number.POSITIVE_INFINITY,
      canScan: true,
      blockedBy: null,
    });
  });

  it('handles empty or malformed input with safe free fallback', () => {
    const allowance = normalizeAllowance(null);
    expect(allowance).toEqual({
      tier: 'free',
      monthUsed: 0,
      monthLimit: 20,
      dayUsed: 0,
      dayLimit: 3,
      canScan: true,
      blockedBy: null,
    });
  });
});
