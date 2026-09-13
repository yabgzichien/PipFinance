// __tests__/purchases.test.ts
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    getCustomerInfo: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
  },
  LOG_LEVEL: { ERROR: 'ERROR' },
}));

import Purchases from 'react-native-purchases';
import { PRO_ENTITLEMENT, buy, fetchTier, restore, tierFromCustomerInfo } from '../src/billing/purchases';

const withPro = { entitlements: { active: { [PRO_ENTITLEMENT]: { isActive: true } } } } as never;
const withoutPro = { entitlements: { active: {} } } as never;

describe('tierFromCustomerInfo', () => {
  it('reads pro from the active entitlement', () => {
    expect(tierFromCustomerInfo(withPro)).toBe('pro');
  });

  it('reads free when the entitlement is absent', () => {
    expect(tierFromCustomerInfo(withoutPro)).toBe('free');
  });
});

describe('fetchTier', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves the tier from a successful lookup', async () => {
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue(withPro);
    expect(await fetchTier()).toBe('pro');
  });

  // Callers distinguish "definitely free" from "could not tell" by catching, so a network
  // failure must propagate rather than silently resolving to free and downgrading a payer.
  it('rethrows when the lookup fails', async () => {
    (Purchases.getCustomerInfo as jest.Mock).mockRejectedValue(new Error('offline'));
    await expect(fetchTier()).rejects.toThrow('offline');
  });
});

describe('buy', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports success when the purchase completes', async () => {
    (Purchases.purchasePackage as jest.Mock).mockResolvedValue({ customerInfo: withPro });
    expect(await buy({} as never)).toEqual({ ok: true, cancelled: false });
  });

  // A user tapping the system "cancel" is not an error and must never raise an alert.
  it('reports a user cancellation without treating it as a failure', async () => {
    (Purchases.purchasePackage as jest.Mock).mockRejectedValue({ userCancelled: true });
    expect(await buy({} as never)).toEqual({ ok: false, cancelled: true });
  });

  it('reports a real failure as not cancelled', async () => {
    (Purchases.purchasePackage as jest.Mock).mockRejectedValue({ userCancelled: false });
    expect(await buy({} as never)).toEqual({ ok: false, cancelled: false });
  });
});

describe('restore', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the tier the store knows about', async () => {
    (Purchases.restorePurchases as jest.Mock).mockResolvedValue(withoutPro);
    expect(await restore()).toBe('free');
  });
});
