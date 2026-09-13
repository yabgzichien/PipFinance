// src/billing/scanProxy.ts
// Secure Worker client proxy for AI scans.
// Keeps LLM provider secrets off-device and authoritatively verifies UTC quota limits.
import * as Crypto from 'expo-crypto';
import { getMeta, setMeta } from '../db/metaRepo';
import { normalizeAllowance, type ScanAllowance } from './scanQuota';
import type { ExtractedTxn } from '../lib/types';

export const INSTALLATION_ID_KEY = 'installation_id';
export const WORKER_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL || 'https://ai-proxy.pipfinance.workers.dev';

export interface ScanRequest {
  imageBase64: string;
  mimeType: string;
  categories?: Array<{ id: string; label: string; kind?: string }>;
}

export interface ScanResult {
  ok: boolean;
  items: ExtractedTxn[];
  allowance: ScanAllowance;
  quotaBlocked?: boolean;
  error?: string;
}

function generateUUID(): string {
  try {
    if (typeof Crypto?.randomUUID === 'function') {
      const id = Crypto.randomUUID();
      if (id) return id;
    }
  } catch {}
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getInstallationId(): Promise<string> {
  const existing = await getMeta(INSTALLATION_ID_KEY);
  if (existing) return existing;

  const newId = generateUUID();
  await setMeta(INSTALLATION_ID_KEY, newId);
  return newId;
}

export async function fetchAllowance(entitlement: 'free' | 'pro' = 'free'): Promise<ScanAllowance> {
  try {
    const id = await getInstallationId();
    const res = await fetch(`${WORKER_URL}/allowance`, {
      method: 'GET',
      headers: {
        'x-installation-id': id,
        'x-entitlement': entitlement,
      },
    });

    if (!res.ok) {
      return normalizeAllowance({ tier: entitlement });
    }

    const data = await res.json();
    return normalizeAllowance(data);
  } catch {
    return normalizeAllowance({ tier: entitlement });
  }
}

export async function submitScan(
  request: ScanRequest,
  entitlement: 'free' | 'pro' = 'free'
): Promise<ScanResult> {
  const id = await getInstallationId();
  const idempotencyKey = generateUUID();

  try {
    const res = await fetch(`${WORKER_URL}/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-installation-id': id,
        'x-idempotency-key': idempotencyKey,
        'x-entitlement': entitlement,
      },
      body: JSON.stringify({
        imageBase64: request.imageBase64,
        mimeType: request.mimeType,
        categories: request.categories || [],
      }),
    });

    const data = await res.json();

    if (res.status === 429) {
      const allowance = normalizeAllowance(data?.allowance || { tier: 'free' });
      return {
        ok: false,
        items: [],
        allowance,
        quotaBlocked: true,
        error: data?.error || 'quota_exhausted',
      };
    }

    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        items: [],
        allowance: normalizeAllowance(data?.allowance || { tier: entitlement }),
        quotaBlocked: false,
        error: data?.error || 'Scan request failed',
      };
    }

    return {
      ok: true,
      items: data.items || [],
      allowance: normalizeAllowance(data.allowance),
    };
  } catch (err) {
    return {
      ok: false,
      items: [],
      allowance: normalizeAllowance({ tier: entitlement }),
      quotaBlocked: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}
