# Pip Pro Paywall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a freemium paywall for Pip, powered by the RevenueCat SDK, in time for a first public Play Store release before 23 September 2026.

**Architecture:** A self-contained `src/billing/` directory holds all monetization logic. Pure functions (scan quota, entitlement cache) are separated from the RevenueCat SDK wrapper so the bulk of the logic is unit-testable without native modules. A React context publishes entitlement state to the tree; six call sites check it before proceeding, routing to a new `paywall` screen when unentitled. Nothing touches the database schema: both persisted values use the existing `app_meta` key/value table via `src/db/metaRepo`.

**Tech Stack:** Expo SDK 54, React Native 0.81, React 19, TypeScript, `expo-sqlite`, Jest with `jest-expo`, `react-native-purchases` (RevenueCat) with its Expo config plugin.

**Spec:** `docs/superpowers/specs/2026-09-09-paywall-design.md`

Supporting research: `docs/paywall-pricing-psychology-research.md`, `docs/paywall-legal-compliance-research.md`

## Global Constraints

These apply to every task below.

- **Branch first.** The repo is on `main`. Create `feat/pip-pro-paywall` before Task 1.
- **TDD.** Write the failing test, watch it fail, implement minimally, watch it pass, commit.
- **Test command:** `npm test`. Single file: `npm test -- __tests__/<name>.test.ts`.
- **Typecheck command:** `npm run typecheck`. Must pass before every commit.
- **i18n parity is enforced by a test.** `__tests__/i18n.test.ts` asserts `Object.keys(en)` equals `Object.keys(zh)`. Every user-facing string added to `src/i18n/translations/en.ts` MUST get a Simplified Chinese counterpart in `src/i18n/translations/zh.ts` in the same commit, or the suite goes red.
- **No em dashes in user-facing copy.** House style, per `handoff.md` §4. Use commas, colons or full stops.
- **Contrast audit:** run `npm run audit:contrast` after any task that adds colours.
- **Entitlement identifier:** `pro`. Used verbatim in RevenueCat.
- **Play product IDs:** subscription `pip_pro` with base plans `monthly` and `annual`; one-time product `pip_pro_lifetime`.
- **Prices:** RM9.90/month, RM67/year, RM199 lifetime. 14-day trial on the annual base plan only.
- **Free scan cap:** 20 per calendar month.
- **Play effective fee:** 15% (10% service + 5% billing). Use this in any margin note.
- **Never gate accuracy.** `src/prices/` and `NetWorthScreen.tsx` are never entitlement-checked. Only `NetWorthHistoryScreen.tsx` is.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `src/billing/scanQuota.ts` | Monthly scan counter: parse, read, increment, month rollover |
| `src/billing/entitlementCache.ts` | Last-known tier plus timestamp, 7-day offline grace resolution |
| `src/billing/purchases.ts` | RevenueCat SDK wrapper: configure, offerings, purchase, restore |
| `src/billing/entitlement.tsx` | `EntitlementProvider` and the `useEntitlement()` hook |
| `src/billing/gates.ts` | The `GateTrigger` union and per-trigger paywall headlines |
| `src/billing/upsellCadence.ts` | Frequency cap and rotation for the ambient mascot line |
| `src/billing/moments.ts` | One-shot contextual prompts at success moments |
| `src/screens/PaywallScreen.tsx` | The paywall itself |
| `src/components/ScanQuotaBadge.tsx` | "14 / 20 scans left this month" |
| `src/components/PipUpsellCard.tsx` | Dismissible in-character upgrade card |

**Modified:**

| File | Change |
|---|---|
| `src/lib/screenNav.ts` | Add `'paywall'` to `Screen`, add `paywallOrigin` to `ScreenOrigins`, handle in `backTargetFor` |
| `App.tsx:229` | Wrap tree in `EntitlementProvider`, add paywall route and origin state |
| `src/i18n/translations/en.ts`, `zh.ts` | Paywall and upsell strings |
| `src/screens/TaxScreen.tsx:157`, `:196` | Gate `buildAuditPackPdf` and `buildEvidenceZip` |
| `src/screens/ExportScreen.tsx` | Gate PDF and Excel, leave CSV and JSON free |
| `src/screens/AdvancedImportScreen.tsx` | Gate entry |
| `src/screens/CurrencySettingsScreen.tsx` | Gate entry |
| `src/screens/NetWorthHistoryScreen.tsx` | Gate entry |
| `src/screens/WidgetCustomizerScreen.tsx` | Gate entry |
| `src/screens/ScanKindScreen.tsx` and the three scan screens | Quota check plus badge |
| `src/screens/SettingsScreen.tsx` | Subscription status row, restore, Customer Center |
| `src/db/restoreRepo.ts:438` | Degrade Pro-only mascot config on restore |
| `app.json` | `react-native-purchases` config plugin |

---

## Track A: Code

### Task 1: Scan quota

**Files:**
- Create: `src/billing/scanQuota.ts`
- Test: `__tests__/scanQuota.test.ts`

**Interfaces:**
- Consumes: `getMeta`, `setMeta` from `src/db/metaRepo`
- Produces: `SCAN_QUOTA_KEY`, `FREE_MONTHLY_SCANS`, `ScanQuota`, `monthKey(d: Date): string`, `parseScanQuota(raw: string | null, now: Date): ScanQuota`, `readScanQuota(now?: Date): Promise<ScanQuota>`, `scansRemaining(q: ScanQuota, limit?: number): number`, `recordScan(now?: Date): Promise<ScanQuota>`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/scanQuota.test.ts
jest.mock('../src/db/metaRepo', () => ({
  getMeta: jest.fn(),
  setMeta: jest.fn().mockResolvedValue(undefined),
}));

import { getMeta, setMeta } from '../src/db/metaRepo';
import {
  FREE_MONTHLY_SCANS,
  SCAN_QUOTA_KEY,
  monthKey,
  parseScanQuota,
  readScanQuota,
  recordScan,
  scansRemaining,
} from '../src/billing/scanQuota';

const SEPT = new Date('2026-09-15T10:00:00Z');
const OCT = new Date('2026-10-01T00:30:00Z');

describe('monthKey', () => {
  it('zero-pads single-digit months', () => {
    expect(monthKey(new Date('2026-03-04T00:00:00Z'))).toBe('2026-03');
  });
});

describe('parseScanQuota', () => {
  it('treats a missing value as a fresh month', () => {
    expect(parseScanQuota(null, SEPT)).toEqual({ month: '2026-09', used: 0 });
  });

  it('keeps the count inside the same month', () => {
    expect(parseScanQuota('{"month":"2026-09","used":7}', SEPT)).toEqual({
      month: '2026-09',
      used: 7,
    });
  });

  // The reset is a read-time consequence of the stored month no longer matching, so no
  // scheduled job or app-open hook is needed for the rollover to happen on time.
  it('resets to zero when the stored month has rolled over', () => {
    expect(parseScanQuota('{"month":"2026-09","used":19}', OCT)).toEqual({
      month: '2026-10',
      used: 0,
    });
  });

  it('falls back to a fresh month on corrupt JSON', () => {
    expect(parseScanQuota('not json', SEPT)).toEqual({ month: '2026-09', used: 0 });
  });

  it('falls back to a fresh month when the shape is wrong', () => {
    expect(parseScanQuota('{"month":9,"used":"x"}', SEPT)).toEqual({
      month: '2026-09',
      used: 0,
    });
  });

  it('clamps a negative stored count to zero', () => {
    expect(parseScanQuota('{"month":"2026-09","used":-3}', SEPT).used).toBe(0);
  });
});

describe('scansRemaining', () => {
  it('reports what is left against the free cap', () => {
    expect(scansRemaining({ month: '2026-09', used: 6 })).toBe(FREE_MONTHLY_SCANS - 6);
  });

  it('never reports a negative remainder', () => {
    expect(scansRemaining({ month: '2026-09', used: 999 })).toBe(0);
  });
});

describe('readScanQuota', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads from the agreed meta key', async () => {
    (getMeta as jest.Mock).mockResolvedValue('{"month":"2026-09","used":3}');
    const q = await readScanQuota(SEPT);
    expect(getMeta).toHaveBeenCalledWith(SCAN_QUOTA_KEY);
    expect(q.used).toBe(3);
  });
});

describe('recordScan', () => {
  beforeEach(() => jest.clearAllMocks());

  it('increments and persists', async () => {
    (getMeta as jest.Mock).mockResolvedValue('{"month":"2026-09","used":3}');
    const next = await recordScan(SEPT);
    expect(next).toEqual({ month: '2026-09', used: 4 });
    expect(setMeta).toHaveBeenCalledWith(
      SCAN_QUOTA_KEY,
      JSON.stringify({ month: '2026-09', used: 4 })
    );
  });

  it('starts a rolled-over month at one', async () => {
    (getMeta as jest.Mock).mockResolvedValue('{"month":"2026-09","used":19}');
    expect(await recordScan(OCT)).toEqual({ month: '2026-10', used: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/scanQuota.test.ts`
Expected: FAIL, "Cannot find module '../src/billing/scanQuota'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/billing/scanQuota.ts
// The free tier's monthly AI-scan allowance. Stored in the existing app_meta key/value table
// rather than a new column, because the whole value is one small JSON blob read once per scan.
//
// The reset is deliberately read-time: a stored month that no longer matches "now" reads as a
// fresh zero. That means no scheduled job, no app-open hook, and no way for the rollover to be
// missed because the app was closed at midnight on the 1st.
import { getMeta, setMeta } from '../db/metaRepo';

export const SCAN_QUOTA_KEY = 'scan_quota';
export const FREE_MONTHLY_SCANS = 20;

export interface ScanQuota {
  /** 'YYYY-MM' in device-local time. */
  month: string;
  used: number;
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function parseScanQuota(raw: string | null, now: Date): ScanQuota {
  const month = monthKey(now);
  if (!raw) return { month, used: 0 };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as ScanQuota).month !== 'string' ||
      typeof (parsed as ScanQuota).used !== 'number'
    ) {
      return { month, used: 0 };
    }
    const stored = parsed as ScanQuota;
    if (stored.month !== month) return { month, used: 0 };
    return { month, used: Math.max(0, Math.floor(stored.used)) };
  } catch {
    return { month, used: 0 };
  }
}

export async function readScanQuota(now: Date = new Date()): Promise<ScanQuota> {
  return parseScanQuota(await getMeta(SCAN_QUOTA_KEY), now);
}

export function scansRemaining(q: ScanQuota, limit: number = FREE_MONTHLY_SCANS): number {
  return Math.max(0, limit - q.used);
}

/** Call ONLY after a scan has successfully produced usable output. A failed vision call must
 *  not cost the user a scan: charging someone for an outage is how a free tier earns one-star
 *  reviews. See the spec, §7. */
export async function recordScan(now: Date = new Date()): Promise<ScanQuota> {
  const current = await readScanQuota(now);
  const next: ScanQuota = { month: current.month, used: current.used + 1 };
  await setMeta(SCAN_QUOTA_KEY, JSON.stringify(next));
  return next;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- __tests__/scanQuota.test.ts && npm run typecheck`
Expected: PASS, 10 tests. Typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/billing/scanQuota.ts __tests__/scanQuota.test.ts
git commit -m "feat(billing): monthly AI scan quota with read-time rollover"
```

---

### Task 2: Entitlement cache and offline grace

**Files:**
- Create: `src/billing/entitlementCache.ts`
- Test: `__tests__/entitlementCache.test.ts`

**Interfaces:**
- Consumes: `getMeta`, `setMeta` from `src/db/metaRepo`
- Produces: `ENTITLEMENT_CACHE_KEY`, `GRACE_MS`, `Tier` (`'free' | 'pro'`), `CachedEntitlement`, `parseCachedEntitlement(raw: string | null): CachedEntitlement | null`, `tierFromCache(cached: CachedEntitlement | null, now: number): Tier`, `readCachedTier(now?: number): Promise<Tier>`, `writeCachedTier(tier: Tier, now?: number): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/entitlementCache.test.ts
jest.mock('../src/db/metaRepo', () => ({
  getMeta: jest.fn(),
  setMeta: jest.fn().mockResolvedValue(undefined),
}));

import { getMeta, setMeta } from '../src/db/metaRepo';
import {
  ENTITLEMENT_CACHE_KEY,
  GRACE_MS,
  parseCachedEntitlement,
  readCachedTier,
  tierFromCache,
  writeCachedTier,
} from '../src/billing/entitlementCache';

const NOW = Date.parse('2026-09-15T10:00:00Z');

describe('parseCachedEntitlement', () => {
  it('returns null when nothing is stored', () => {
    expect(parseCachedEntitlement(null)).toBeNull();
  });

  it('reads a well-formed record', () => {
    expect(parseCachedEntitlement(`{"tier":"pro","checkedAt":${NOW}}`)).toEqual({
      tier: 'pro',
      checkedAt: NOW,
    });
  });

  it('returns null on corrupt JSON', () => {
    expect(parseCachedEntitlement('{{{')).toBeNull();
  });

  it('returns null on an unrecognised tier', () => {
    expect(parseCachedEntitlement(`{"tier":"platinum","checkedAt":${NOW}}`)).toBeNull();
  });
});

describe('tierFromCache', () => {
  it('resolves to free with no cache, which is the cold offline first launch', () => {
    expect(tierFromCache(null, NOW)).toBe('free');
  });

  // A paying user on a plane, or on a flaky connection, must not lose what they paid for.
  it('honours a cached pro inside the grace window', () => {
    const cached = { tier: 'pro' as const, checkedAt: NOW - GRACE_MS + 1000 };
    expect(tierFromCache(cached, NOW)).toBe('pro');
  });

  it('downgrades a cached pro once the grace window has passed', () => {
    const cached = { tier: 'pro' as const, checkedAt: NOW - GRACE_MS - 1000 };
    expect(tierFromCache(cached, NOW)).toBe('free');
  });

  it('never upgrades a cached free', () => {
    expect(tierFromCache({ tier: 'free', checkedAt: NOW }, NOW)).toBe('free');
  });
});

describe('readCachedTier / writeCachedTier', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads through the agreed meta key', async () => {
    (getMeta as jest.Mock).mockResolvedValue(`{"tier":"pro","checkedAt":${NOW}}`);
    expect(await readCachedTier(NOW)).toBe('pro');
    expect(getMeta).toHaveBeenCalledWith(ENTITLEMENT_CACHE_KEY);
  });

  it('stamps the write with the check time', async () => {
    await writeCachedTier('pro', NOW);
    expect(setMeta).toHaveBeenCalledWith(
      ENTITLEMENT_CACHE_KEY,
      JSON.stringify({ tier: 'pro', checkedAt: NOW })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/entitlementCache.test.ts`
Expected: FAIL, "Cannot find module '../src/billing/entitlementCache'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/billing/entitlementCache.ts
// The offline fallback for entitlement state. RevenueCat's SDK caches internally, but Pip is a
// no-account, fully on-device app that people open on planes and on bad connections, so the
// failure mode "paying user is locked out because a network call failed" has to be designed out
// explicitly rather than hoped away.
//
// Direction matters: a cached PRO is honoured for a week, a cached FREE is never upgraded. The
// grace window can only ever be generous to the user, never to us.
import { getMeta, setMeta } from '../db/metaRepo';

export const ENTITLEMENT_CACHE_KEY = 'entitlement_cache';
export const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export type Tier = 'free' | 'pro';

export interface CachedEntitlement {
  tier: Tier;
  /** Epoch milliseconds of the last successful RevenueCat lookup. */
  checkedAt: number;
}

export function parseCachedEntitlement(raw: string | null): CachedEntitlement | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CachedEntitlement>;
    if (parsed?.tier !== 'free' && parsed?.tier !== 'pro') return null;
    if (typeof parsed.checkedAt !== 'number' || !Number.isFinite(parsed.checkedAt)) return null;
    return { tier: parsed.tier, checkedAt: parsed.checkedAt };
  } catch {
    return null;
  }
}

export function tierFromCache(cached: CachedEntitlement | null, now: number): Tier {
  if (!cached || cached.tier !== 'pro') return 'free';
  return now - cached.checkedAt > GRACE_MS ? 'free' : 'pro';
}

export async function readCachedTier(now: number = Date.now()): Promise<Tier> {
  return tierFromCache(parseCachedEntitlement(await getMeta(ENTITLEMENT_CACHE_KEY)), now);
}

export async function writeCachedTier(tier: Tier, now: number = Date.now()): Promise<void> {
  await setMeta(ENTITLEMENT_CACHE_KEY, JSON.stringify({ tier, checkedAt: now }));
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- __tests__/entitlementCache.test.ts && npm run typecheck`
Expected: PASS, 10 tests. Typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/billing/entitlementCache.ts __tests__/entitlementCache.test.ts
git commit -m "feat(billing): entitlement cache with 7-day offline grace"
```

---

### Task 3: Add the paywall screen to navigation

**Files:**
- Modify: `src/lib/screenNav.ts`
- Test: `__tests__/screenNav.test.ts` (extend the existing file)

**Interfaces:**
- Produces: `'paywall'` as a `Screen` member; `paywallOrigin?: Screen` on `ScreenOrigins`

`backTargetFor` is an exhaustive `switch` over the `Screen` union with no `default` clause, so adding a member without handling it is a compile error. That is the intended safety net; do not add a `default`.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/screenNav.test.ts`, inside the existing `describe('backTargetFor', ...)` block:

```ts
  // The paywall is reachable from six different gates plus onboarding, so a fixed back target
  // would strand the user somewhere they never came from. It follows the same origin pattern
  // as `export` and `owed`.
  it('returns the paywall to wherever it was opened from', () => {
    expect(backTargetFor('paywall', { ...origins, paywallOrigin: 'tax' })).toBe('tax');
    expect(backTargetFor('paywall', { ...origins, paywallOrigin: 'networth' })).toBe('networth');
  });

  it('defaults the paywall back to home when no origin was recorded', () => {
    expect(backTargetFor('paywall', origins)).toBe('home');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/screenNav.test.ts`
Expected: FAIL. TypeScript rejects `'paywall'` as a `Screen`.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/screenNav.ts`, add `| 'paywall'` to the `Screen` union after `'widgetCustomizer'`:

```ts
  | 'widgetCustomizer'
  | 'paywall'
  | 'trips'
  | 'tripDetail';
```

Add to `ScreenOrigins`:

```ts
  /** Where the paywall was triggered from. Six gates plus onboarding can open it, so a fixed
   *  back target would strand the user on a screen they never visited. */
  paywallOrigin?: Screen;
```

Add to `backTargetFor`, beside the other origin-driven cases:

```ts
    case 'paywall':
      return origins.paywallOrigin ?? 'home';
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- __tests__/screenNav.test.ts && npm run typecheck`
Expected: PASS. Typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/screenNav.ts __tests__/screenNav.test.ts
git commit -m "feat(nav): add paywall screen with origin-aware back target"
```

---

### Task 4: Paywall and upsell strings, English and Chinese

**Files:**
- Modify: `src/i18n/translations/en.ts`, `src/i18n/translations/zh.ts`, `src/i18n/types.ts`
- Test: `__tests__/i18n.test.ts` (already enforces parity; no new test needed)

**Interfaces:**
- Produces: the translation keys listed below, available on the `Translations` type

`__tests__/i18n.test.ts` asserts `Object.keys(en)` equals `Object.keys(zh)` and that every `zh` value is a non-empty string. Adding a key to one file without the other turns the suite red.

- [ ] **Step 1: Run the parity test to confirm it currently passes**

Run: `npm test -- __tests__/i18n.test.ts`
Expected: PASS. This is the baseline.

- [ ] **Step 2: Add the keys to `src/i18n/types.ts`**

Add to the `Translations` interface:

```ts
  // Paywall
  proTitle: string;
  proSubtitle: string;
  proMonthly: string;
  proAnnual: string;
  proAnnualPerMonth: string;
  proAnnualSave: string;
  proLifetime: string;
  proLifetimeNote: string;
  proStartTrial: string;
  proRestore: string;
  proRestoreNothing: string;
  proManage: string;
  proActive: string;
  proTrialActive: string;
  proDisclosure: string;
  proStoreUnreachable: string;
  // Gate headlines
  gateScanQuota: string;
  gateTaxExport: string;
  gateReportExport: string;
  gateAdvancedImport: string;
  gateMultiCurrency: string;
  gateNetWorthHistory: string;
  gateWidgetCustom: string;
  // Free vs Pro comparison
  compareFree: string;
  comparePro: string;
  compareScans: string;
  compareScansFree: string;
  compareScansPro: string;
  compareTax: string;
  compareTaxFree: string;
  compareTaxPro: string;
  compareReports: string;
  compareReportsFree: string;
  compareReportsPro: string;
  // Scan counter
  scansLeft: string;
  scansNone: string;
```

- [ ] **Step 3: Add the English strings**

Append to `src/i18n/translations/en.ts`. No em dashes anywhere. The disclosure string is a Play policy requirement, not decoration; do not shorten it.

```ts
  // Paywall
  proTitle: 'Pip Pro',
  proSubtitle: 'Still no account. Still on your phone.',
  proMonthly: 'RM9.90 / month',
  proAnnual: 'RM67 / year',
  proAnnualPerMonth: 'RM5.58 a month, billed yearly',
  proAnnualSave: 'Save 44%',
  proLifetime: 'Founding supporter, RM199 once',
  proLifetimeNote: 'One-time purchase, unlocks Pro for the lifetime of the app. AI scanning depends on a third-party service.',
  proStartTrial: 'Start 14 days free',
  proRestore: 'Restore purchases',
  proRestoreNothing: 'Nothing to restore on this account yet.',
  proManage: 'Manage subscription',
  proActive: 'Pip Pro is active',
  proTrialActive: 'Free trial, {days} days left',
  proDisclosure: 'Free for 14 days, then RM67 a year. Your first charge is on {date}. Renews automatically until you cancel. Cancel any time in Settings, under Pip Pro.',
  proStoreUnreachable: "Can't reach the store right now. Please try again in a moment.",
  // Gate headlines
  gateScanQuota: "That's your 20 scans for the month. Pip's eyes need a rest. Or do they.",
  gateTaxExport: 'Tax season, sorted. Export your audit pack with Pro.',
  gateReportExport: 'PDF and Excel reports are a Pro thing. CSV stays free, always.',
  gateAdvancedImport: 'Bring everything across at once with Pro.',
  gateMultiCurrency: 'Track every currency you actually use, with Pro.',
  gateNetWorthHistory: 'See where your net worth has been, not just where it is.',
  gateWidgetCustom: 'Dress Pip up properly. The full customizer is Pro.',
  // Free vs Pro comparison
  compareFree: 'Free',
  comparePro: 'Pro',
  compareScans: 'AI scans',
  compareScansFree: '20 a month',
  compareScansPro: 'Unlimited',
  compareTax: 'Tax relief',
  compareTaxFree: 'Track and tag',
  compareTaxPro: 'Track, tag and export',
  compareReports: 'Reports',
  compareReportsFree: 'CSV and JSON',
  compareReportsPro: 'PDF, Excel, CSV, JSON',
  // Scan counter
  scansLeft: '{n} of {total} scans left this month',
  scansNone: 'No scans left this month',
```

- [ ] **Step 4: Add the Simplified Chinese strings**

Append to `src/i18n/translations/zh.ts`, in the same key order:

```ts
  // 付费墙
  proTitle: 'Pip Pro',
  proSubtitle: '依然无需账号，依然只存在你的手机里。',
  proMonthly: 'RM9.90 / 月',
  proAnnual: 'RM67 / 年',
  proAnnualPerMonth: '每月 RM5.58，按年收费',
  proAnnualSave: '省 44%',
  proLifetime: '创始支持者，一次性 RM199',
  proLifetimeNote: '一次性购买，在本应用的生命周期内解锁 Pro。AI 扫描依赖第三方服务。',
  proStartTrial: '免费试用 14 天',
  proRestore: '恢复购买',
  proRestoreNothing: '此账号暂时没有可恢复的购买。',
  proManage: '管理订阅',
  proActive: 'Pip Pro 已启用',
  proTrialActive: '免费试用，还剩 {days} 天',
  proDisclosure: '免费试用 14 天，之后每年 RM67。首次扣款日期为 {date}。到期自动续订，直到你取消。你可以随时在「设置」的 Pip Pro 中取消。',
  proStoreUnreachable: '暂时无法连接商店，请稍后再试。',
  // 功能限制标题
  gateScanQuota: '这个月的 20 次扫描用完了。Pip 的眼睛需要休息一下。也许吧。',
  gateTaxExport: '报税不慌。用 Pro 导出你的税务凭证包。',
  gateReportExport: 'PDF 和 Excel 报表属于 Pro。CSV 永远免费。',
  gateAdvancedImport: '用 Pro 一次性导入你的全部记录。',
  gateMultiCurrency: '用 Pro 追踪你真正在用的每一种货币。',
  gateNetWorthHistory: '不只看现在的净资产，还能看它走过的路。',
  gateWidgetCustom: '好好打扮一下 Pip。完整自定义属于 Pro。',
  // 免费与 Pro 对比
  compareFree: '免费',
  comparePro: 'Pro',
  compareScans: 'AI 扫描',
  compareScansFree: '每月 20 次',
  compareScansPro: '无限次',
  compareTax: '税务减免',
  compareTaxFree: '记录与标记',
  compareTaxPro: '记录、标记与导出',
  compareReports: '报表',
  compareReportsFree: 'CSV 和 JSON',
  compareReportsPro: 'PDF、Excel、CSV、JSON',
  // 扫描次数
  scansLeft: '本月还剩 {n} / {total} 次扫描',
  scansNone: '本月扫描次数已用完',
```

- [ ] **Step 5: Run the parity test and typecheck**

Run: `npm test -- __tests__/i18n.test.ts && npm run typecheck`
Expected: PASS. Key sets identical, all `zh` values non-empty.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/
git commit -m "feat(i18n): paywall and upsell strings in en and zh"
```

---

### Task 5: RevenueCat SDK wrapper

**Files:**
- Create: `src/billing/purchases.ts`
- Modify: `app.json`, `package.json`
- Test: `__tests__/purchases.test.ts`

**Interfaces:**
- Consumes: `Tier` from `src/billing/entitlementCache`
- Produces: `PRO_ENTITLEMENT`, `configurePurchases(): Promise<void>`, `fetchTier(): Promise<Tier>`, `tierFromCustomerInfo(info: CustomerInfo): Tier`, `fetchOfferings(): Promise<PurchasesOffering | null>`, `buy(pkg: PurchasesPackage): Promise<{ ok: boolean; cancelled: boolean }>`, `restore(): Promise<Tier>`

- [ ] **Step 1: Install the SDK**

```bash
npx expo install react-native-purchases
```

Add to the `plugins` array in `app.json`, after `"expo-web-browser"`:

```json
      "react-native-purchases",
```

- [ ] **Step 2: Write the failing test**

```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- __tests__/purchases.test.ts`
Expected: FAIL, "Cannot find module '../src/billing/purchases'"

- [ ] **Step 4: Write minimal implementation**

```ts
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
```

- [ ] **Step 5: Add the key to `.env.example`**

```
# RevenueCat (Android). Dashboard -> Project settings -> API keys -> Google Play.
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_your_key_here
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test -- __tests__/purchases.test.ts && npm run typecheck`
Expected: PASS, 8 tests. Typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/billing/purchases.ts __tests__/purchases.test.ts app.json package.json package-lock.json .env.example
git commit -m "feat(billing): RevenueCat SDK wrapper and Expo config plugin"
```

---

### Task 6: Entitlement provider

**Files:**
- Create: `src/billing/entitlement.tsx`
- Modify: `App.tsx`
- Test: `__tests__/entitlementResolve.test.ts`

**Interfaces:**
- Consumes: `fetchTier`, `configurePurchases` from `src/billing/purchases`; `readCachedTier`, `writeCachedTier`, `Tier` from `src/billing/entitlementCache`; `readScanQuota`, `recordScan`, `scansRemaining`, `FREE_MONTHLY_SCANS` from `src/billing/scanQuota`
- Produces: `resolveTier(fetch: () => Promise<Tier>, cached: () => Promise<Tier>): Promise<Tier>`, `EntitlementProvider`, `useEntitlement(): EntitlementState`

`EntitlementState` shape, relied on by Tasks 7 through 11:

```ts
export interface EntitlementState {
  tier: Tier;
  isPro: boolean;
  scansUsed: number;
  scansLimit: number;
  scansRemaining: number;
  canScan: boolean;
  recordSuccessfulScan: () => Promise<void>;
  refresh: () => Promise<void>;
}
```

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/entitlementResolve.test.ts`
Expected: FAIL, "Cannot find module '../src/billing/entitlement'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/billing/entitlement.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { FREE_MONTHLY_SCANS, readScanQuota, recordScan, scansRemaining } from './scanQuota';
import { readCachedTier, writeCachedTier, type Tier } from './entitlementCache';
import { configurePurchases, fetchTier } from './purchases';

/** Live result wins when we get one. Only a thrown lookup falls back to the cache, so a
 *  cancelled or lapsed subscription downgrades immediately rather than lingering for a week. */
export async function resolveTier(
  fetch: () => Promise<Tier>,
  cached: () => Promise<Tier>
): Promise<Tier> {
  try {
    return await fetch();
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
  canScan: boolean;
  recordSuccessfulScan: () => Promise<void>;
  refresh: () => Promise<void>;
}

const FALLBACK: EntitlementState = {
  tier: 'free',
  isPro: false,
  scansUsed: 0,
  scansLimit: FREE_MONTHLY_SCANS,
  scansRemaining: FREE_MONTHLY_SCANS,
  canScan: true,
  recordSuccessfulScan: async () => {},
  refresh: async () => {},
};

const Ctx = createContext<EntitlementState>(FALLBACK);

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState<Tier>('free');
  const [used, setUsed] = useState(0);

  const refresh = useCallback(async () => {
    const next = await resolveTier(fetchTier, readCachedTier);
    setTier(next);
    await writeCachedTier(next);
    setUsed((await readScanQuota()).used);
  }, []);

  useEffect(() => {
    void (async () => {
      await configurePurchases();
      await refresh();
    })();
  }, [refresh]);

  const recordSuccessfulScan = useCallback(async () => {
    if (tier === 'pro') return;
    setUsed((await recordScan()).used);
  }, [tier]);

  const value = useMemo<EntitlementState>(() => {
    const isPro = tier === 'pro';
    const limit = isPro ? Number.POSITIVE_INFINITY : FREE_MONTHLY_SCANS;
    const remaining = isPro
      ? Number.POSITIVE_INFINITY
      : scansRemaining({ month: '', used }, FREE_MONTHLY_SCANS);
    return {
      tier,
      isPro,
      scansUsed: used,
      scansLimit: limit,
      scansRemaining: remaining,
      canScan: isPro || remaining > 0,
      recordSuccessfulScan,
      refresh,
    };
  }, [tier, used, recordSuccessfulScan, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntitlement(): EntitlementState {
  return useContext(Ctx);
}
```

- [ ] **Step 4: Wire the provider into `App.tsx`**

Add the import beside the other `src/` imports:

```tsx
import { EntitlementProvider } from './src/billing/entitlement';
```

Wrap the existing root element returned by the top-level component in `<EntitlementProvider>...</EntitlementProvider>`, placing it immediately inside the existing `AppDataProvider` so billing state can read app data but not the reverse.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. The whole suite, not just the new file, because `App.tsx` changed.

- [ ] **Step 6: Commit**

```bash
git add src/billing/entitlement.tsx __tests__/entitlementResolve.test.ts App.tsx
git commit -m "feat(billing): entitlement provider with cache fallback"
```

---

### Task 7: Scan quota badge and the scan gate

**Files:**
- Create: `src/components/ScanQuotaBadge.tsx`
- Modify: `src/screens/ScanKindScreen.tsx`, `src/screens/ReceiptScanScreen.tsx`, `src/screens/ExtractScreen.tsx`, `src/screens/BalanceScanScreen.tsx`
- Test: `__tests__/scanGate.test.ts`

**Interfaces:**
- Consumes: `useEntitlement` from `src/billing/entitlement`
- Produces: `ScanQuotaBadge` (props: `{ remaining: number; total: number; t: Translations }`), `scanBadgeLabel(remaining: number, total: number, t: Translations): string`

The badge is the single most important ambient surface in the app. Per the spec §9.3, a visible countdown does the conversion work through loss aversion without any sales language. Hide it entirely for Pro users; a badge reading "unlimited" is clutter.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/scanGate.test.ts
import { en } from '../src/i18n/translations/en';
import { scanBadgeLabel } from '../src/components/ScanQuotaBadge';

describe('scanBadgeLabel', () => {
  it('interpolates the remaining and total counts', () => {
    expect(scanBadgeLabel(14, 20, en)).toBe('14 of 20 scans left this month');
  });

  // "0 of 20 scans left" reads like a bug rather than a limit, so the exhausted state gets
  // its own sentence.
  it('uses the dedicated exhausted string at zero', () => {
    expect(scanBadgeLabel(0, 20, en)).toBe('No scans left this month');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/scanGate.test.ts`
Expected: FAIL, "Cannot find module '../src/components/ScanQuotaBadge'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/ScanQuotaBadge.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Translations } from '../i18n/types';

export function scanBadgeLabel(remaining: number, total: number, t: Translations): string {
  if (remaining <= 0) return t.scansNone;
  return t.scansLeft.replace('{n}', String(remaining)).replace('{total}', String(total));
}

export function ScanQuotaBadge({
  remaining,
  total,
  t,
}: {
  remaining: number;
  total: number;
  t: Translations;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{scanBadgeLabel(remaining, total, t)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  text: { fontSize: 13, opacity: 1 },
});
```

Colour the text with the existing theme's secondary text token rather than an opacity, matching the house rule in the design system. Read `src/theme.ts` for the correct token name and run `npm run audit:contrast` afterwards.

- [ ] **Step 4: Wire the gate into the four scan screens**

In each of `ScanKindScreen.tsx`, `ReceiptScanScreen.tsx`, `ExtractScreen.tsx` and `BalanceScanScreen.tsx`:

```tsx
const { isPro, canScan, scansRemaining, scansLimit, recordSuccessfulScan } = useEntitlement();
```

Render `<ScanQuotaBadge remaining={scansRemaining} total={scansLimit} t={t} />` only when `!isPro`.

Before starting a scan:

```tsx
if (!canScan) {
  setPaywallOrigin(screen);
  setPaywallTrigger('scan_quota');
  setScreen('paywall');
  return;
}
```

After a scan returns usable extracted output, and only then:

```tsx
await recordSuccessfulScan();
```

Place this call on the success path only. A thrown or unparseable response must not reach it, per spec §7.

- [ ] **Step 5: Run the full suite, typecheck and contrast audit**

Run: `npm test && npm run typecheck && npm run audit:contrast`
Expected: PASS on all three.

- [ ] **Step 6: Commit**

```bash
git add src/components/ScanQuotaBadge.tsx __tests__/scanGate.test.ts src/screens/
git commit -m "feat(billing): scan quota badge and gate on the four scan entry points"
```

---

### Task 8: The six Pro-only gates

**Files:**
- Modify: `src/screens/TaxScreen.tsx:157`, `:196`; `src/screens/ExportScreen.tsx`; `src/screens/AdvancedImportScreen.tsx`; `src/screens/CurrencySettingsScreen.tsx`; `src/screens/NetWorthHistoryScreen.tsx`; `src/screens/WidgetCustomizerScreen.tsx`
- Test: `__tests__/proGates.test.ts`

**Interfaces:**
- Consumes: `useEntitlement` from `src/billing/entitlement`
- Produces: `GateTrigger` union and `gateHeadline(trigger: GateTrigger, t: Translations): string` in `src/billing/gates.ts`

Read the spec §8 gate table before starting. Two boundaries are easy to get wrong and both matter:

- On `TaxScreen`, **only** the two export calls are gated. Tagging, cap validation and the receipt evidence archive stay free, because `store-description.md:27` markets tax relief tracking on a free listing.
- On `ExportScreen`, **only** `generateExcelWorkbook` and `generatePrintablePDFHtml` are gated. `generateCSV` and `generateAdvancedImportJSON` stay free, because locking users out of their own data contradicts the privacy pillar.
- `NetWorthScreen.tsx` and everything in `src/prices/` are **never** gated.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/proGates.test.ts
import { en } from '../src/i18n/translations/en';
import { GATE_TRIGGERS, gateHeadline, type GateTrigger } from '../src/billing/gates';

describe('gateHeadline', () => {
  it('gives every trigger a non-empty headline', () => {
    for (const trigger of GATE_TRIGGERS) {
      expect(gateHeadline(trigger, en).length).toBeGreaterThan(0);
    }
  });

  it('maps the scan quota trigger to its own copy', () => {
    expect(gateHeadline('scan_quota', en)).toBe(en.gateScanQuota);
  });

  it('maps the tax export trigger to its own copy', () => {
    expect(gateHeadline('tax_export', en)).toBe(en.gateTaxExport);
  });

  // A generic headline on every gate wastes the highest-intent moment in the funnel, so each
  // trigger has to resolve to distinct copy.
  it('never reuses the same headline for two triggers', () => {
    const seen = GATE_TRIGGERS.map((g: GateTrigger) => gateHeadline(g, en));
    expect(new Set(seen).size).toBe(GATE_TRIGGERS.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/proGates.test.ts`
Expected: FAIL, "Cannot find module '../src/billing/gates'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/billing/gates.ts
import type { Translations } from '../i18n/types';

export const GATE_TRIGGERS = [
  'scan_quota',
  'tax_export',
  'report_export',
  'advanced_import',
  'multi_currency',
  'networth_history',
  'widget_custom',
] as const;

export type GateTrigger = (typeof GATE_TRIGGERS)[number];

/** Each gate gets its own headline. The moment a user hits a wall is the highest-intent
 *  moment in the funnel, and a generic "Upgrade to Pro" throws that away. */
export function gateHeadline(trigger: GateTrigger, t: Translations): string {
  switch (trigger) {
    case 'scan_quota':
      return t.gateScanQuota;
    case 'tax_export':
      return t.gateTaxExport;
    case 'report_export':
      return t.gateReportExport;
    case 'advanced_import':
      return t.gateAdvancedImport;
    case 'multi_currency':
      return t.gateMultiCurrency;
    case 'networth_history':
      return t.gateNetWorthHistory;
    case 'widget_custom':
      return t.gateWidgetCustom;
  }
}
```

- [ ] **Step 4: Wire each gate**

For the five whole-screen gates (`AdvancedImportScreen`, `CurrencySettingsScreen`, `NetWorthHistoryScreen`, `WidgetCustomizerScreen`, plus the two export actions), guard at the point of navigation or action rather than rendering a locked screen. In the handler that would open the screen or run the export:

```tsx
const { isPro } = useEntitlement();
// ...
if (!isPro) {
  setPaywallOrigin(screen);
  setPaywallTrigger('advanced_import'); // the matching GateTrigger for this site
  setScreen('paywall');
  return;
}
```

In `TaxScreen.tsx`, place the guard immediately before the `buildAuditPackPdf` call at line 157 and the `buildEvidenceZip` call at line 196, using trigger `'tax_export'`. Leave every other handler on that screen untouched.

In `ExportScreen.tsx`, guard only the branches calling `generateExcelWorkbook` and `generatePrintablePDFHtml`, using trigger `'report_export'`.

- [ ] **Step 5: Run the full suite, typecheck and contrast audit**

Run: `npm test && npm run typecheck && npm run audit:contrast`
Expected: PASS on all three.

- [ ] **Step 6: Manually verify the free paths still work**

Confirm by reading the diff that these remain reachable without entitlement: tax tagging and the receipt archive, CSV export, JSON export, `NetWorthScreen`, and every call into `src/prices/`.

- [ ] **Step 7: Commit**

```bash
git add src/billing/gates.ts __tests__/proGates.test.ts src/screens/
git commit -m "feat(billing): six Pro gates with per-trigger headlines"
```

---

### Task 9: Paywall screen

**Files:**
- Create: `src/screens/PaywallScreen.tsx`
- Modify: `App.tsx`
- Test: `__tests__/paywallDisclosure.test.ts`

**Interfaces:**
- Consumes: `gateHeadline`, `GateTrigger` from `src/billing/gates`; `fetchOfferings`, `buy`, `restore` from `src/billing/purchases`; `useEntitlement`
- Produces: `PaywallScreen` (props: `{ trigger: GateTrigger; onClose: () => void; t: Translations; locale: string }`), `TRIAL_DAYS`, `firstChargeDate(start: Date, trialDays: number): Date`, `disclosureText(firstCharge: Date, t: Translations, locale: string): string`

**The disclosure block is a Play policy requirement, not copy.** Per spec §11.1, the paywall itself must show price, billing frequency, first charge date, trial terms and how to cancel, at the point of purchase and not behind a link. Getting this wrong risks rejection, and a rejection inside the submission window ends the Shipaton entry.

The screen must fit one viewport without scrolling, and must have a genuinely visible close control. A small, low-contrast dismiss target is a deceptive-flow policy violation as well as bad design.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/paywallDisclosure.test.ts
import { en } from '../src/i18n/translations/en';
import { disclosureText, firstChargeDate } from '../src/screens/PaywallScreen';

describe('firstChargeDate', () => {
  it('lands 14 days after the trial starts', () => {
    const start = new Date('2026-09-15T10:00:00Z');
    expect(firstChargeDate(start, 14).toISOString().slice(0, 10)).toBe('2026-09-29');
  });

  it('crosses a month boundary correctly', () => {
    const start = new Date('2026-09-25T10:00:00Z');
    expect(firstChargeDate(start, 14).toISOString().slice(0, 10)).toBe('2026-10-09');
  });
});

describe('disclosureText', () => {
  // Google requires price, billing frequency, first charge date, trial terms and how to
  // cancel, all on the purchase surface itself. Each assertion below maps to one of those.
  it('states the trial length, the price and the renewal terms', () => {
    const text = disclosureText(new Date('2026-09-29T00:00:00Z'), en, 'en-MY');
    expect(text).toContain('14 days');
    expect(text).toContain('RM67');
    expect(text).toContain('Renews automatically');
    expect(text).toContain('Cancel any time');
  });

  it('interpolates a real first charge date, leaving no placeholder behind', () => {
    const text = disclosureText(new Date('2026-09-29T00:00:00Z'), en, 'en-MY');
    expect(text).not.toContain('{date}');
    expect(text).toMatch(/29/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/paywallDisclosure.test.ts`
Expected: FAIL, "Cannot find module '../src/screens/PaywallScreen'"

- [ ] **Step 3: Write the pure helpers plus the screen**

```tsx
// src/screens/PaywallScreen.tsx
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { gateHeadline, type GateTrigger } from '../billing/gates';
import { buy, fetchOfferings, restore } from '../billing/purchases';
import { useEntitlement } from '../billing/entitlement';
import { notify } from '../lib/platformAlert';
import type { Translations } from '../i18n/types';

export const TRIAL_DAYS = 14;

export function firstChargeDate(start: Date, trialDays: number): Date {
  const d = new Date(start.getTime());
  d.setUTCDate(d.getUTCDate() + trialDays);
  return d;
}

/** Play policy requires price, billing frequency, first charge date, trial terms and the
 *  cancellation path to appear on the purchase surface itself, not behind a link. */
export function disclosureText(firstCharge: Date, t: Translations, locale: string): string {
  const formatted = firstCharge.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return t.proDisclosure.replace('{date}', formatted);
}

export function PaywallScreen({
  trigger,
  onClose,
  t,
  locale,
}: {
  trigger: GateTrigger;
  onClose: () => void;
  t: Translations;
  locale: string;
}) {
  const { refresh, isPro } = useEntitlement();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchOfferings().then(setOffering);
  }, []);

  useEffect(() => {
    if (isPro) onClose();
  }, [isPro, onClose]);

  const onBuy = async (pkg: PurchasesPackage) => {
    setBusy(true);
    const result = await buy(pkg);
    setBusy(false);
    if (result.ok) {
      await refresh();
      return;
    }
    // A user backing out of the system sheet is not an error and must stay silent.
    if (!result.cancelled) notify(t.proStoreUnreachable);
  };

  const onRestore = async () => {
    setBusy(true);
    try {
      const tier = await restore();
      await refresh();
      if (tier === 'free') notify(t.proRestoreNothing);
    } catch {
      notify(t.proStoreUnreachable);
    } finally {
      setBusy(false);
    }
  };

  const charge = firstChargeDate(new Date(), TRIAL_DAYS);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Pressable onPress={onClose} accessibilityRole="button" style={styles.close}>
        <Text style={styles.closeText}>{t.close}</Text>
      </Pressable>

      <Text style={styles.headline}>{gateHeadline(trigger, t)}</Text>
      <Text style={styles.subtitle}>{t.proSubtitle}</Text>

      <View style={styles.compare}>
        <CompareRow label={t.compareScans} free={t.compareScansFree} pro={t.compareScansPro} />
        <CompareRow label={t.compareTax} free={t.compareTaxFree} pro={t.compareTaxPro} />
        <CompareRow label={t.compareReports} free={t.compareReportsFree} pro={t.compareReportsPro} />
      </View>

      {offering?.annual && (
        <Pressable
          disabled={busy}
          onPress={() => void onBuy(offering.annual as PurchasesPackage)}
          style={[styles.plan, styles.planSelected]}
        >
          <Text style={styles.planPrice}>{t.proAnnual}</Text>
          <Text style={styles.planNote}>{t.proAnnualPerMonth}</Text>
          <Text style={styles.planSave}>{t.proAnnualSave}</Text>
        </Pressable>
      )}

      {offering?.monthly && (
        <Pressable
          disabled={busy}
          onPress={() => void onBuy(offering.monthly as PurchasesPackage)}
          style={styles.plan}
        >
          <Text style={styles.planPrice}>{t.proMonthly}</Text>
        </Pressable>
      )}

      {offering?.lifetime && (
        <Pressable
          disabled={busy}
          onPress={() => void onBuy(offering.lifetime as PurchasesPackage)}
        >
          <Text style={styles.lifetime}>{t.proLifetime}</Text>
        </Pressable>
      )}

      {!offering && <Text style={styles.note}>{t.proStoreUnreachable}</Text>}

      <Text style={styles.disclosure}>{disclosureText(charge, t, locale)}</Text>
      {offering?.lifetime && <Text style={styles.disclosure}>{t.proLifetimeNote}</Text>}

      <Pressable onPress={() => void onRestore()} disabled={busy}>
        <Text style={styles.restore}>{t.proRestore}</Text>
      </Pressable>
    </ScrollView>
  );
}

function CompareRow({ label, free, pro }: { label: string; free: string; pro: string }) {
  return (
    <View style={styles.compareRow}>
      <Text style={styles.compareLabel}>{label}</Text>
      <Text style={styles.compareFree}>{free}</Text>
      <Text style={styles.comparePro}>{pro}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 12 },
  close: { alignSelf: 'flex-end', padding: 12, minWidth: 44, minHeight: 44 },
  closeText: { fontSize: 16 },
  headline: { fontSize: 22, fontWeight: '600' },
  subtitle: { fontSize: 15 },
  compare: { gap: 6, marginVertical: 8 },
  compareRow: { flexDirection: 'row', justifyContent: 'space-between' },
  compareLabel: { flex: 2, fontSize: 14 },
  compareFree: { flex: 1, fontSize: 14, textAlign: 'right' },
  comparePro: { flex: 1, fontSize: 14, textAlign: 'right', fontWeight: '600' },
  plan: { padding: 16, borderRadius: 12, borderWidth: 1 },
  planSelected: { borderWidth: 2 },
  planPrice: { fontSize: 18, fontWeight: '600' },
  planNote: { fontSize: 14 },
  planSave: { fontSize: 13, fontWeight: '600' },
  lifetime: { fontSize: 14, textAlign: 'center', paddingVertical: 12 },
  note: { fontSize: 14 },
  disclosure: { fontSize: 12, lineHeight: 17 },
  restore: { fontSize: 14, textAlign: 'center', paddingVertical: 12 },
});
```

Colours are omitted above deliberately: apply the existing theme tokens from `src/theme.ts` the way sibling screens do, then run the contrast audit. The `minWidth: 44, minHeight: 44` on the close control is a policy requirement, not a style preference.

- [ ] **Step 4: Route the screen in `App.tsx`**

Add state beside the existing origin state at `App.tsx:248`:

```tsx
const [paywallOrigin, setPaywallOrigin] = useState<Screen>('home');
const [paywallTrigger, setPaywallTrigger] = useState<GateTrigger>('scan_quota');
```

Add `paywallOrigin` to the origins object passed to `backTargetFor`, and render `PaywallScreen` in the screen switch when `screen === 'paywall'`, passing `onClose={() => setScreen(paywallOrigin)}`.

- [ ] **Step 5: Run the full suite, typecheck and contrast audit**

Run: `npm test && npm run typecheck && npm run audit:contrast`
Expected: PASS on all three.

- [ ] **Step 6: Commit**

```bash
git add src/screens/PaywallScreen.tsx __tests__/paywallDisclosure.test.ts App.tsx
git commit -m "feat(billing): paywall screen with Play-compliant disclosure"
```

---

### Task 10: Settings subscription row, restore and cancellation path

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`
- Test: covered by the full suite; no new unit test

**Interfaces:**
- Consumes: `useEntitlement`; `restore` from `src/billing/purchases`

**Play requires cancellation within two taps** of the subscription management screen (spec §11.2). RevenueCat's Customer Center provides this; use it rather than hand-rolling a management UI.

- [ ] **Step 1: Add the Customer Center dependency**

```bash
npx expo install react-native-purchases-ui
```

- [ ] **Step 2: Add the subscription section**

Add to `SettingsScreen.tsx`, above the existing AI provider section around line 298. Match the surrounding row components rather than the bare `Pressable` shown here.

```tsx
import RevenueCatUI from 'react-native-purchases-ui';
import { useEntitlement } from '../billing/entitlement';
import { restore } from '../billing/purchases';
import { notify } from '../lib/platformAlert';

// ...inside the component:
const { isPro, refresh } = useEntitlement();

const onRestore = async () => {
  try {
    const tier = await restore();
    await refresh();
    if (tier === 'free') notify(t.proRestoreNothing);
  } catch {
    notify(t.proStoreUnreachable);
  }
};

// ...inside the rendered settings list:
<SettingsSection title={t.proTitle}>
  {isPro ? (
    <>
      <SettingsRow label={t.proActive} />
      {/* Tap one. Cancelling inside the Customer Center is tap two, which satisfies the
          Play requirement of cancellation within two taps of this screen. */}
      <SettingsRow
        label={t.proManage}
        onPress={() => void RevenueCatUI.presentCustomerCenter()}
      />
    </>
  ) : (
    <SettingsRow
      label={t.proTitle}
      onPress={() => {
        setPaywallOrigin('settings');
        setPaywallTrigger('scan_quota');
        setScreen('paywall');
      }}
    />
  )}
  <SettingsRow label={t.proRestore} onPress={() => void onRestore()} />
</SettingsSection>
```

- [ ] **Step 3: Verify the two-tap cancellation path by counting taps**

From Settings, confirm: tap one opens the Customer Center, tap two reaches cancellation. If it takes three, the row is nested too deep; move it up a level.

- [ ] **Step 4: Run the full suite, typecheck and both audits**

Run: `npm test && npm run typecheck && npm run audit:contrast`
Expected: PASS. `__tests__/settingsSearch.test.ts` and `__tests__/widgetSettingsSearch.test.ts` both index settings rows, so confirm they still pass and add the new rows to the search index if those tests expect it.

- [ ] **Step 5: Commit**

```bash
git add src/screens/SettingsScreen.tsx package.json package-lock.json
git commit -m "feat(billing): subscription status, restore and two-tap cancellation"
```

---

### Task 11: Ambient mascot upsell

**Files:**
- Create: `src/billing/upsellCadence.ts`, `src/components/PipUpsellCard.tsx`
- Modify: `src/screens/DashboardScreen.tsx`
- Test: `__tests__/upsellCadence.test.ts`

**Interfaces:**
- Consumes: `getMeta`, `setMeta` from `src/db/metaRepo`
- Produces: `UPSELL_STATE_KEY`, `WEEKLY_MS`, `UpsellState`, `shouldShowUpsell(state: UpsellState | null, now: number): boolean`, `pickLine(lines: string[], lastIndex: number): number`

Per spec §9.3 this fires at most once a week, is dismissible, rotates, and never repeats consecutively. Per §9.4 there is no permanent banner and nothing on the widget.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/upsellCadence.test.ts
import { WEEKLY_MS, pickLine, shouldShowUpsell } from '../src/billing/upsellCadence';

const NOW = Date.parse('2026-09-15T10:00:00Z');

describe('shouldShowUpsell', () => {
  it('shows on a first run with no recorded state', () => {
    expect(shouldShowUpsell(null, NOW)).toBe(true);
  });

  it('stays quiet inside the weekly window', () => {
    expect(shouldShowUpsell({ lastShownAt: NOW - 1000, lastIndex: 0 }, NOW)).toBe(false);
  });

  it('shows again once a week has passed', () => {
    expect(shouldShowUpsell({ lastShownAt: NOW - WEEKLY_MS - 1, lastIndex: 0 }, NOW)).toBe(true);
  });
});

describe('pickLine', () => {
  const lines = ['a', 'b', 'c'];

  // Seeing the same joke twice running is how a mascot stops being charming.
  it('never returns the line that was shown last', () => {
    for (let last = 0; last < lines.length; last++) {
      expect(pickLine(lines, last)).not.toBe(last);
    }
  });

  it('returns a valid index', () => {
    const i = pickLine(lines, 0);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(lines.length);
  });

  it('handles a single-line catalog without looping forever', () => {
    expect(pickLine(['only'], 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/upsellCadence.test.ts`
Expected: FAIL, "Cannot find module '../src/billing/upsellCadence'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/billing/upsellCadence.ts
// Frequency governor for the one ambient upsell surface. Pip already comments on spending, so
// an occasional in-character line about Pro reads as content rather than an advert. That only
// holds while it stays rare and never repeats itself, which is what this file enforces.
export const UPSELL_STATE_KEY = 'upsell_state';
export const WEEKLY_MS = 7 * 24 * 60 * 60 * 1000;

export interface UpsellState {
  lastShownAt: number;
  lastIndex: number;
}

export function shouldShowUpsell(state: UpsellState | null, now: number): boolean {
  if (!state) return true;
  return now - state.lastShownAt >= WEEKLY_MS;
}

export function pickLine(lines: string[], lastIndex: number): number {
  if (lines.length <= 1) return 0;
  const offset = 1 + Math.floor(Math.random() * (lines.length - 1));
  return (lastIndex + offset) % lines.length;
}
```

- [ ] **Step 4: Build the card**

```tsx
// src/components/PipUpsellCard.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Translations } from '../i18n/types';

export function upsellLines(t: Translations): string[] {
  return [t.upsellLine1, t.upsellLine2, t.upsellLine3];
}

export function PipUpsellCard({
  line,
  onPress,
  onDismiss,
  t,
}: {
  line: string;
  onPress: () => void;
  onDismiss: () => void;
  t: Translations;
}) {
  return (
    <View style={styles.card}>
      <Pressable onPress={onPress} style={styles.body} accessibilityRole="button">
        <Text style={styles.line}>{line}</Text>
      </Pressable>
      <Pressable onPress={onDismiss} style={styles.dismiss} accessibilityRole="button">
        <Text style={styles.dismissText}>{t.close}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, gap: 10 },
  body: { flex: 1 },
  line: { fontSize: 14, lineHeight: 20 },
  dismiss: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dismissText: { fontSize: 14 },
});
```

- [ ] **Step 5: Mount it on the dashboard**

In `DashboardScreen.tsx`, beside the existing mascot:

```tsx
const { isPro } = useEntitlement();
const [upsell, setUpsell] = useState<{ line: string; index: number } | null>(null);

useEffect(() => {
  if (isPro) return;
  void (async () => {
    const raw = await getMeta(UPSELL_STATE_KEY);
    const state = raw ? (JSON.parse(raw) as UpsellState) : null;
    if (!shouldShowUpsell(state, Date.now())) return;
    const lines = upsellLines(t);
    const index = pickLine(lines, state?.lastIndex ?? 0);
    setUpsell({ line: lines[index], index });
    await setMeta(UPSELL_STATE_KEY, JSON.stringify({ lastShownAt: Date.now(), lastIndex: index }));
  })();
}, [isPro, t]);

// ...in the render tree:
{upsell && (
  <PipUpsellCard
    line={upsell.line}
    t={t}
    onDismiss={() => setUpsell(null)}
    onPress={() => {
      setPaywallOrigin('home');
      setPaywallTrigger('scan_quota');
      setScreen('paywall');
    }}
  />
)}
```

The state is written when the line is **shown**, not when it is dismissed, so closing the app without interacting still consumes the weekly slot. That is deliberate: the cap governs how often Pip brings it up, not how often the user engages.

- [ ] **Step 6: Add the three lines to both translation files**

Calibrated against `business-plan.md` §4, no em dashes. These are starting points for a copy pass, not final strings. Add `upsellLine1` through `upsellLine3` to `src/i18n/types.ts`, `en.ts` and `zh.ts`.

```ts
// en.ts
upsellLine1: "You have scanned 17 receipts this month. Pip's eyes are tired. Pro gives them unlimited stamina and me a paycheck.",
upsellLine2: '3 scans left. Pip is rationing. It is giving austerity budget.',
upsellLine3: 'Pip has been doing your admin for free all month. Just saying.',
```

```ts
// zh.ts
upsellLine1: '你这个月扫了 17 张收据。Pip 的眼睛累了。Pro 能让它们无限续航，也能让我有工资。',
upsellLine2: '还剩 3 次扫描。Pip 正在省着用。这很紧缩财政。',
upsellLine3: 'Pip 已经免费帮你做了一整个月的杂事。就说说而已。',
```

- [ ] **Step 7: Run the full suite, typecheck and contrast audit**

Run: `npm test && npm run typecheck && npm run audit:contrast`
Expected: PASS on all three, including the i18n parity test.

- [ ] **Step 8: Commit**

```bash
git add src/billing/upsellCadence.ts src/components/PipUpsellCard.tsx __tests__/upsellCadence.test.ts src/screens/DashboardScreen.tsx src/i18n/
git commit -m "feat(billing): weekly in-character upsell line on the dashboard"
```

---

### Task 12: Contextual prompts and the post-dismissal offer

**Files:**
- Create: `src/billing/moments.ts`
- Modify: `src/screens/onboarding/` (wizard completion), `src/screens/ExtractScreen.tsx`, `src/screens/DashboardScreen.tsx`, `src/screens/PaywallScreen.tsx`
- Test: `__tests__/upsellMoments.test.ts`

**Interfaces:**
- Consumes: `getMeta`, `setMeta` from `src/db/metaRepo`
- Produces: `MOMENT_KEYS`, `UpsellMoment` (`'onboarding_done' | 'first_scan' | 'streak_7' | 'relief_threshold'`), `hasFired(seen: string[], moment: UpsellMoment): boolean`, `markFired(seen: string[], moment: UpsellMoment): string[]`, `reliefThresholdCrossed(totalMyr: number): boolean`

This implements spec §9.2 and the post-dismissal offer in §10. Each moment fires **once, ever**. A prompt that reappears on every 7-day streak stops being a celebration and becomes nagging, which is exactly the failure mode §9.4 exists to prevent.

The post-dismissal offer shows only to users who closed the paywall without converting, and adds 10-15% ARPU. It is the lowest-value item in this plan: if the 23 September date is at risk, cut Step 5 and ship everything else.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/upsellMoments.test.ts
import {
  RELIEF_THRESHOLD_MYR,
  hasFired,
  markFired,
  reliefThresholdCrossed,
  type UpsellMoment,
} from '../src/billing/moments';

describe('hasFired / markFired', () => {
  it('reports an unseen moment as not yet fired', () => {
    expect(hasFired([], 'first_scan')).toBe(false);
  });

  it('reports a recorded moment as fired', () => {
    expect(hasFired(['first_scan'], 'first_scan')).toBe(true);
  });

  // Once, ever. A prompt that returns on every 7-day streak turns a celebration into nagging.
  it('is idempotent, so marking twice does not duplicate', () => {
    const once = markFired([], 'streak_7');
    expect(markFired(once, 'streak_7')).toEqual(['streak_7']);
  });

  it('preserves moments already recorded', () => {
    expect(markFired(['first_scan'], 'streak_7' as UpsellMoment)).toEqual([
      'first_scan',
      'streak_7',
    ]);
  });
});

describe('reliefThresholdCrossed', () => {
  it('is false below the threshold', () => {
    expect(reliefThresholdCrossed(RELIEF_THRESHOLD_MYR - 0.01)).toBe(false);
  });

  it('is true at the threshold', () => {
    expect(reliefThresholdCrossed(RELIEF_THRESHOLD_MYR)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/upsellMoments.test.ts`
Expected: FAIL, "Cannot find module '../src/billing/moments'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/billing/moments.ts
// One-shot upgrade prompts tied to moments where the user has just succeeded at something.
// Research is consistent that offers land best at a peak, and that between 78% and 90% of all
// trial starts happen on day zero, which is why onboarding completion is on this list.
//
// Every moment fires once and never again. That is the whole reason this file exists: without
// it, "prompt on a 7-day streak" would fire every seventh day forever.
import { getMeta, setMeta } from '../db/metaRepo';

export const MOMENT_KEYS = 'upsell_moments';
export const RELIEF_THRESHOLD_MYR = 1000;

export type UpsellMoment = 'onboarding_done' | 'first_scan' | 'streak_7' | 'relief_threshold';

export function hasFired(seen: string[], moment: UpsellMoment): boolean {
  return seen.includes(moment);
}

export function markFired(seen: string[], moment: UpsellMoment): string[] {
  return seen.includes(moment) ? seen : [...seen, moment];
}

export function reliefThresholdCrossed(totalMyr: number): boolean {
  return totalMyr >= RELIEF_THRESHOLD_MYR;
}

export async function readMoments(): Promise<string[]> {
  const raw = await getMeta(MOMENT_KEYS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function fireOnce(moment: UpsellMoment): Promise<boolean> {
  const seen = await readMoments();
  if (hasFired(seen, moment)) return false;
  await setMeta(MOMENT_KEYS, JSON.stringify(markFired(seen, moment)));
  return true;
}
```

- [ ] **Step 4: Wire the four moments**

At each site, call `fireOnce` and route to the paywall only when it returns `true`. Skip entirely when `isPro`.

```tsx
if (!isPro && (await fireOnce('first_scan'))) {
  setPaywallOrigin(screen);
  setPaywallTrigger('scan_quota');
  setScreen('paywall');
}
```

- `'onboarding_done'`: at the end of the setup wizard in `src/screens/onboarding/`, after the final step commits. This is the single highest-leverage placement in the app.
- `'first_scan'`: in `ExtractScreen.tsx`, immediately after the first scan produces usable output. Fire it **after** `recordSuccessfulScan()`, so the peak moment has actually landed.
- `'streak_7'`: on `DashboardScreen.tsx`, when the streak value from `src/lib/streak.ts` first reaches 7.
- `'relief_threshold'`: on `DashboardScreen.tsx`, when year-to-date tagged relief first satisfies `reliefThresholdCrossed`.

- [ ] **Step 5: Add the post-dismissal offer**

In `PaywallScreen.tsx`, when `onClose` fires and the user has not converted, record the dismissal and show a single time-limited follow-up on their next dashboard visit. Reuse `PipUpsellCard` rather than building a second component.

**Cut this step first if the schedule slips.** Everything above it is worth more.

- [ ] **Step 6: Run the full suite, typecheck and contrast audit**

Run: `npm test && npm run typecheck && npm run audit:contrast`
Expected: PASS on all three. `__tests__/onboardingWizard.test.ts` and `__tests__/streak.test.ts` both cover touched paths and must stay green.

- [ ] **Step 7: Commit**

```bash
git add src/billing/moments.ts __tests__/upsellMoments.test.ts src/screens/
git commit -m "feat(billing): one-shot contextual upgrade prompts at success moments"
```

---

### Task 13: Degrade Pro-only mascot config on restore

**Files:**
- Modify: `src/db/restoreRepo.ts:438`
- Test: `__tests__/widgetMascotBackup.test.ts` (extend the existing file)

**Interfaces:**
- Consumes: `DEFAULT_WIDGET_MASCOT_CONFIG`, `parseWidgetMascotConfig`, `serializeWidgetMascotConfig` from `src/widget/mascot/config`
- Produces: `mascotConfigForTier(raw: string, isPro: boolean): string` in `src/widget/mascot/config.ts`

A backup can carry a Pro mascot configuration. Restoring it as a free user must degrade **silently** to the default. Per spec §12: never crash, never surface an error, and never render a locked-looking widget on someone's home screen, because that widget is a surface other people see.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/widgetMascotBackup.test.ts`:

```ts
import {
  DEFAULT_WIDGET_MASCOT_CONFIG,
  mascotConfigForTier,
  serializeWidgetMascotConfig,
} from '../src/widget/mascot/config';

describe('mascotConfigForTier', () => {
  const custom = serializeWidgetMascotConfig({
    ...DEFAULT_WIDGET_MASCOT_CONFIG,
    head: 'goggles' as const,
  });

  it('keeps a customized config for a Pro user', () => {
    expect(mascotConfigForTier(custom, true)).toBe(custom);
  });

  // The widget lives on a home screen other people can see, so a downgrade has to look like a
  // deliberate default rather than a locked or broken widget.
  it('falls back to the default config for a free user', () => {
    expect(mascotConfigForTier(custom, false)).toBe(
      serializeWidgetMascotConfig(DEFAULT_WIDGET_MASCOT_CONFIG)
    );
  });

  it('returns the default rather than throwing on unparseable input', () => {
    expect(mascotConfigForTier('{{{', false)).toBe(
      serializeWidgetMascotConfig(DEFAULT_WIDGET_MASCOT_CONFIG)
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/widgetMascotBackup.test.ts`
Expected: FAIL, "mascotConfigForTier is not a function"

- [ ] **Step 3: Write minimal implementation**

Add to `src/widget/mascot/config.ts`:

```ts
/** A backup may carry a Pro-only look. Restoring it without entitlement degrades silently to
 *  the default: the widget sits on a home screen other people see, so a locked or broken
 *  widget there is worse than a plain one. Re-subscribing restores the stored look, because
 *  the original value stays in the backup rather than being rewritten. */
export function mascotConfigForTier(raw: string, isPro: boolean): string {
  if (isPro) return raw;
  return serializeWidgetMascotConfig(DEFAULT_WIDGET_MASCOT_CONFIG);
}
```

At `src/db/restoreRepo.ts:438`, pass the restoring user's tier through and apply it:

```ts
      if (typeof s.widgetMascotConfig === 'string') {
        meta.widget_mascot_config = mascotConfigForTier(s.widgetMascotConfig, isPro);
      }
```

`restoreFromBackupPayload` gains an `isPro: boolean` parameter, defaulting to `false`. `restoreFromBackupZip` in `src/lib/backupRestore.ts:58` forwards it, and its caller in `src/state/store.tsx` supplies the value from `useEntitlement()`.

- [ ] **Step 4: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. `__tests__/backupRestore.test.ts`, `__tests__/restoreRepo.test.ts`, `__tests__/onboardingRestore.test.ts` and `__tests__/widgetConfigLoad.test.ts` all touch this path; all four must stay green.

- [ ] **Step 5: Commit**

```bash
git add src/widget/mascot/config.ts src/db/restoreRepo.ts src/lib/backupRestore.ts src/state/store.tsx __tests__/widgetMascotBackup.test.ts
git commit -m "fix(billing): degrade Pro mascot config silently on free-tier restore"
```

---

## Track B: Store and release

Track B is mostly not code and can run in parallel with Track A. **Two of these items are hard Play submission blockers** and have been open in `plan.md` Phase A since before this feature; the app cannot ship without them.

### Task 14: Play Console and RevenueCat dashboard configuration

- [ ] **Step 1: Create the Play Console products**

Subscription `pip_pro` with two base plans:
- `monthly`, RM9.90, monthly billing, no offer
- `annual`, RM67, yearly billing, with a **14-day free trial offer**

One-time product `pip_pro_lifetime` at RM199.

- [ ] **Step 2: Verify the Malaysian price points and tax treatment**

Confirm RM9.90, RM67 and RM199 are all accepted price points for Malaysia, and check whether the listed price is SST-inclusive. Both are open items in the spec §17.

- [ ] **Step 3: Configure RevenueCat**

Create entitlement `pro`. Attach all three products. Create the `default` offering with the annual package first, then monthly, then lifetime.

- [ ] **Step 4: Hide lifetime from active subscribers**

Per spec §11.3, lifetime is a non-consumable and will double-charge a user who already has a subscription. Confirm the paywall does not render the lifetime option when `isPro` is true and the active entitlement came from a subscription.

- [ ] **Step 5: Generate a judge promo code**

Shipaton requires either a free trial or a promo code for judges. The 14-day trial covers this, but generate a Play promo code as a fallback and record it in the submission.

### Task 15: Privacy policy

- [ ] **Step 1: Write and host a privacy policy**

Google Play requires one for any app handling financial data. None exists in the repo. It must accurately describe the on-device model: no accounts, no server storage, screenshots sent once for extraction and not retained, anonymous crash reports only, and the exact transmission surface documented in `src/lib/diagnostics.ts` and `src/lib/diagnosticsScrub.ts`.

It must now also cover the RevenueCat SDK, which sends an anonymous app user ID off-device. That is a new external transmission and the README's privacy section will need updating to stay accurate.

- [ ] **Step 2: Link it from Play Console and from Settings**

### Task 16: Store listing and screenshots

- [ ] **Step 1: Produce screenshots for the current feature set**

None exist. Cover Net Worth, Commitments, Split Bills, Tax Relief and the widget, per the gap recorded in `business-plan.md` §8.

- [ ] **Step 2: Verify the listing copy still matches what ships**

`store-description.md:24` promises live prices and `:27` promises tax relief tracking. Both remain free under this plan, so the copy stands. Confirm nothing else in the listing describes a now-gated feature as free.

### Task 17: Release

- [ ] **Step 1: Build and test the purchase flow on a real device**

Use a Play licence tester account. Verify: trial start, purchase, restore on reinstall, cancellation within two taps, and the offline grace path with airplane mode enabled.

- [ ] **Step 2: Ship to production by 23 September**

The app must be **published, not in review**, for judges to download it. Shipaton closes 30 September, 11:45pm PDT.

- [ ] **Step 3: Confirm eligibility before submitting**

Only apps whose first public store release falls between 1 August and 30 September 2026 qualify. Confirm no prior public track exists.

---

## Sequencing

Tasks 1 through 4 have no dependency on the RevenueCat SDK and can be done immediately. Task 5 requires a dev build. Tasks 7 through 12 depend on Task 6.

Track B Tasks 15 and 16 are the long poles and are not code. **Start them in parallel with Task 1**, not after Task 13, because they have been open since before this feature and the app cannot be submitted without either.

Suggested split against a 23 September ship date:

| Days | Track A | Track B |
|---|---|---|
| 1 to 3 | Tasks 1 to 4 | Task 15 privacy policy drafted |
| 4 to 6 | Tasks 5, 6 | Task 14 Play and RevenueCat config |
| 7 to 9 | Tasks 7, 8 | Task 16 screenshots |
| 10 to 11 | Tasks 9, 10 | Listing copy review |
| 12 to 13 | Tasks 11, 12, 13 | Task 17 device testing |
| 14 | Buffer and release | Submit |

**If the date slips**, cut in this order: Task 12 Step 5 (the post-dismissal offer), then Task 12 entirely, then Task 11 (the ambient mascot line). Tasks 1 through 10 and Task 13 are the minimum shippable paywall, and Track B is not cuttable at all.
