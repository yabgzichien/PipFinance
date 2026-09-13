// src/billing/purchases.ts
// Thin wrapper over the RevenueCat SDK. Everything that can be decided without the native
// module lives in entitlementCache.ts and scanQuota.ts instead, so the bulk of the billing
// logic stays unit-testable.
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import type { Tier } from './entitlementCache';

/** Must match the entitlement identifier configured in the RevenueCat dashboard. */
export const PRO_ENTITLEMENT = 'pro';

const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

export async function configurePurchases(): Promise<void> {
  if (!ANDROID_KEY) return;
  Purchases.setLogLevel(LOG_LEVEL.ERROR);
  await Purchases.configure({ apiKey: ANDROID_KEY });
}

export function tierFromCustomerInfo(info: CustomerInfo): Tier {
  return info.entitlements.active[PRO_ENTITLEMENT] ? 'pro' : 'free';
}

/** Throws on lookup failure. Callers MUST catch and fall back to the cached tier: resolving a
 *  network error to 'free' here would silently downgrade a paying user who is offline. */
export async function fetchTier(): Promise<Tier> {
  return tierFromCustomerInfo(await Purchases.getCustomerInfo());
}

export async function fetchOfferings(): Promise<PurchasesOffering | null> {
  try {
    return (await Purchases.getOfferings()).current ?? null;
  } catch {
    return null;
  }
}

/** `cancelled` separates a user backing out from a real failure, because only the latter
 *  should ever surface an alert. */
export async function buy(pkg: PurchasesPackage): Promise<{ ok: boolean; cancelled: boolean }> {
  try {
    await Purchases.purchasePackage(pkg);
    return { ok: true, cancelled: false };
  } catch (e) {
    return { ok: false, cancelled: Boolean((e as { userCancelled?: boolean })?.userCancelled) };
  }
}

export async function restore(): Promise<Tier> {
  return tierFromCustomerInfo(await Purchases.restorePurchases());
}
