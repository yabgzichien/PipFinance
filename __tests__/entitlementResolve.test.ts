// __tests__/entitlementResolve.test.ts
import { resolveTier } from '../src/billing/entitlement';

describe('resolveTier', () => {
  it('prefers a successful live lookup', async () => {
    const tier = await resolveTier(
      async () => 'pro',
      async () => 'free'
    );
    expect(tier).toBe('pro');
  });

  // The whole point of the cache: a network failure must not cost a payer their entitlement.
  it('falls back to the cache when the live lookup throws', async () => {
    const tier = await resolveTier(
      async () => {
        throw new Error('offline');
      },
      async () => 'pro'
    );
    expect(tier).toBe('pro');
  });

  it('resolves to free when the lookup throws and the cache is empty or stale', async () => {
    const tier = await resolveTier(
      async () => {
        throw new Error('offline');
      },
      async () => 'free'
    );
    expect(tier).toBe('free');
  });

  it('trusts a live free result over a cached pro, so a lapsed subscription downgrades', async () => {
    const tier = await resolveTier(
      async () => 'free',
      async () => 'pro'
    );
    expect(tier).toBe('free');
  });
});
