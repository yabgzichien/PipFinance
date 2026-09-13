// src/billing/entitlement.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import Purchases from 'react-native-purchases';
import { FREE_DAILY_SCANS, FREE_MONTHLY_SCANS, type ScanAllowance } from './scanQuota';
import { fetchAllowance } from './scanProxy';
import { readCachedTier, writeCachedTier, type Tier } from './entitlementCache';
import { configurePurchases, fetchTier, tierFromCustomerInfo } from './purchases';

/** Live result wins when we get one. Only a thrown lookup falls back to the cache, so a
 *  cancelled or lapsed subscription downgrades immediately rather than lingering for a week. */
export async function resolveTier(
  fetch: () => Promise<Tier>,
  cached: () => Promise<Tier>,
  onLive: (tier: Tier) => Promise<void> = async () => {}
): Promise<Tier> {
  try {
    const tier = await fetch();
    await onLive(tier);
    return tier;
  } catch {
    return await cached();
  }
}

export interface EntitlementState {
  tier: Tier;
  isPro: boolean;
  scansUsed: number;
  scansLimit: number;
  scansRemaining: number;
  dailyScansUsed: number;
  dailyScansLimit: number;
  dailyScansRemaining: number;
  canScan: boolean;
  quotaBlockedBy: 'daily' | 'monthly' | null;
  refreshAllowance: () => Promise<void>;
  refresh: () => Promise<void>;
}

const FALLBACK: EntitlementState = {
  tier: 'free',
  isPro: false,
  scansUsed: 0,
  scansLimit: FREE_MONTHLY_SCANS,
  scansRemaining: FREE_MONTHLY_SCANS,
  dailyScansUsed: 0,
  dailyScansLimit: FREE_DAILY_SCANS,
  dailyScansRemaining: FREE_DAILY_SCANS,
  canScan: true,
  quotaBlockedBy: null,
  refreshAllowance: async () => {},
  refresh: async () => {},
};

const Ctx = createContext<EntitlementState>(FALLBACK);

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState<Tier>('free');
  const [allowance, setAllowance] = useState<ScanAllowance | null>(null);

  const refresh = useCallback(async () => {
    const next = await resolveTier(fetchTier, readCachedTier, writeCachedTier);
    setTier(next);
  }, []);

  const refreshAllowance = useCallback(async () => {
    setAllowance(await fetchAllowance(tier));
  }, [tier]);

  useEffect(() => {
    void (async () => {
      await configurePurchases();
      await refresh();
      await refreshAllowance();
    })();

    const customerInfoListener = (info: any) => {
      if (info) {
        const next = tierFromCustomerInfo(info);
        setTier(next);
        void writeCachedTier(next);
      }
    };

    Purchases.addCustomerInfoUpdateListener?.(customerInfoListener);

    const handleAppStateChange = (nextStatus: AppStateStatus) => {
      if (nextStatus === 'active') {
        void refresh();
        void refreshAllowance();
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      Purchases.removeCustomerInfoUpdateListener?.(customerInfoListener);
      sub.remove();
    };
  }, [refresh, refreshAllowance]);

  const value = useMemo<EntitlementState>(() => {
    const isPro = tier === 'pro';
    const limit = isPro ? Number.POSITIVE_INFINITY : FREE_MONTHLY_SCANS;
    const dailyLimit = isPro ? Number.POSITIVE_INFINITY : FREE_DAILY_SCANS;
    const monthUsed = isPro ? 0 : allowance?.monthUsed ?? 0;
    const dayUsed = isPro ? 0 : allowance?.dayUsed ?? 0;
    const remaining = isPro ? Number.POSITIVE_INFINITY : Math.max(0, limit - monthUsed);
    const dailyRemaining = isPro ? Number.POSITIVE_INFINITY : Math.max(0, dailyLimit - dayUsed);
    return {
      tier,
      isPro,
      scansUsed: monthUsed,
      scansLimit: limit,
      scansRemaining: remaining,
      dailyScansUsed: dayUsed,
      dailyScansLimit: dailyLimit,
      dailyScansRemaining: dailyRemaining,
      canScan: isPro || (remaining > 0 && dailyRemaining > 0),
      quotaBlockedBy: isPro ? null : allowance?.blockedBy ?? null,
      refreshAllowance,
      refresh,
    };
  }, [tier, allowance, refreshAllowance, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntitlement(): EntitlementState {
  return useContext(Ctx);
}
