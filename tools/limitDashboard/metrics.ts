// tools/limitDashboard/metrics.ts
// Metric collection and provider polling for OpenRouter, Groq, and Gemini.

import * as fs from 'fs';
import * as path from 'path';

export const ENV_LOCAL_PATH = path.join(__dirname, '../../.env.local');
export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_PING_MODEL = 'qwen/qwen3.6-27b';
export const GEMINI_DEFAULT_MODEL = 'gemini-3.1-flash-lite';
export const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface OpenRouterKeyMetric {
  rawKey: string;
  maskedKey: string;
  label?: string;
  usage: number;
  limit: number | null;
  is_free_tier: boolean;
  usage_daily: number;
  usage_weekly: number;
  usage_monthly: number;
  limit_remaining: number | null;
  rate_limit?: { requests: number; interval: string };
  status: 'healthy' | 'warning' | 'rate_limited' | 'error' | 'no_key';
  errorMessage?: string;
}

export interface GroqKeyMetric {
  rawKey: string;
  maskedKey: string;
  model: string;
  rpmLimit: number;
  rpmRemaining: number;
  rpmUsed: number;
  rpmPercentUsed: number;
  tpmLimit: number;
  tpmRemaining: number;
  tpmUsed: number;
  tpmPercentUsed: number;
  resetRequests: string | null;
  resetTokens: string | null;
  resetTime: string | null;
  status: 'healthy' | 'warning' | 'rate_limited' | 'error' | 'no_key';
  errorMessage?: string;
}

export interface GeminiKeyMetric {
  rawKey: string;
  maskedKey: string;
  model: string;
  status: 'active' | 'warning' | 'rate_limited' | 'error' | 'no_key';
  standardRpm: number;
  standardRpd: number;
  standardTpm: number;
  consoleUrl: string;
  errorMessage?: string;
}

export interface DashboardMetrics {
  openrouter: OpenRouterKeyMetric[];
  groq: GroqKeyMetric[];
  gemini: GeminiKeyMetric[];
  timestamp: string;
}

export function readEnvLocal(): Record<string, string> {
  if (!fs.existsSync(ENV_LOCAL_PATH)) return {};
  const out: Record<string, string> = {};
  const lines = fs.readFileSync(ENV_LOCAL_PATH, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) {
      out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

export function splitKeys(raw: string): string[] {
  return (raw || '')
    .split(/[,\n]/)
    .map((k) => k.trim())
    .filter(Boolean);
}

export function maskKey(key: string): string {
  if (!key) return '(no key)';
  if (key.length <= 10) return '***';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export function keysFor(envVar: string, envLocal: Record<string, string>): string[] {
  return splitKeys(process.env[envVar] || envLocal[envVar] || '');
}

/**
 * Fetch real spend and limits from OpenRouter /api/v1/key
 */
export async function fetchOpenRouterMetrics(
  keys: string[],
  timeoutMs = 4000
): Promise<OpenRouterKeyMetric[]> {
  return Promise.all(
    keys.map(async (key) => {
      const maskedKey = maskKey(key);
      try {
        const res = await fetch('https://openrouter.ai/api/v1/key', {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!res.ok) {
          return {
            rawKey: key,
            maskedKey,
            usage: 0,
            limit: null,
            is_free_tier: true,
            usage_daily: 0,
            usage_weekly: 0,
            usage_monthly: 0,
            limit_remaining: null,
            status: res.status === 429 ? 'rate_limited' : 'error',
            errorMessage: `HTTP ${res.status} ${res.statusText}`,
          };
        }

        const json = await res.json();
        const data = json?.data || {};
        const usage = typeof data.usage === 'number' ? data.usage : 0;
        const limit = typeof data.limit === 'number' ? data.limit : null;
        const is_free_tier = Boolean(data.is_free_tier);
        const usage_daily = typeof data.usage_daily === 'number' ? data.usage_daily : 0;
        const usage_weekly = typeof data.usage_weekly === 'number' ? data.usage_weekly : 0;
        const usage_monthly = typeof data.usage_monthly === 'number' ? data.usage_monthly : 0;
        const limit_remaining = typeof data.limit_remaining === 'number' ? data.limit_remaining : null;

        let status: OpenRouterKeyMetric['status'] = 'healthy';
        if (limit !== null && limit > 0) {
          const pct = (usage / limit) * 100;
          if (pct >= 90) status = 'rate_limited';
          else if (pct >= 70) status = 'warning';
        }

        return {
          rawKey: key,
          maskedKey,
          label: data.label,
          usage,
          limit,
          is_free_tier,
          usage_daily,
          usage_weekly,
          usage_monthly,
          limit_remaining,
          rate_limit: data.rate_limit,
          status,
        };
      } catch (err: any) {
        return {
          rawKey: key,
          maskedKey,
          usage: 0,
          limit: null,
          is_free_tier: true,
          usage_daily: 0,
          usage_weekly: 0,
          usage_monthly: 0,
          limit_remaining: null,
          status: 'error',
          errorMessage: err?.message || 'Connection failed',
        };
      }
    })
  );
}

/**
 * Ping Groq endpoint to read rate-limit response headers
 */
export async function fetchGroqMetrics(
  keys: string[],
  modelOverride?: string,
  timeoutMs = 4000
): Promise<GroqKeyMetric[]> {
  const model = modelOverride || GROQ_PING_MODEL;

  return Promise.all(
    keys.map(async (key) => {
      const maskedKey = maskKey(key);
      try {
        const res = await fetch(GROQ_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
            temperature: 0,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });

        const h = res.headers;
        const limitReq = parseInt(h.get('x-ratelimit-limit-requests') || '30', 10);
        const remReq = parseInt(h.get('x-ratelimit-remaining-requests') || '30', 10);
        const limitTok = parseInt(h.get('x-ratelimit-limit-tokens') || '6000', 10);
        const remTok = parseInt(h.get('x-ratelimit-remaining-tokens') || '6000', 10);
        const resetReq = h.get('x-ratelimit-reset-requests');
        const resetTok = h.get('x-ratelimit-reset-tokens');

        const usedReq = Math.max(0, limitReq - remReq);
        const usedTok = Math.max(0, limitTok - remTok);
        const rpmPercentUsed = limitReq > 0 ? (usedReq / limitReq) * 100 : 0;
        const tpmPercentUsed = limitTok > 0 ? (usedTok / limitTok) * 100 : 0;

        let status: GroqKeyMetric['status'] = 'healthy';
        if (res.status === 429 || remReq === 0 || remTok === 0) {
          status = 'rate_limited';
        } else if (rpmPercentUsed >= 75 || tpmPercentUsed >= 75) {
          status = 'warning';
        } else if (!res.ok && res.status !== 429) {
          status = 'error';
        }

        return {
          rawKey: key,
          maskedKey,
          model,
          rpmLimit: limitReq,
          rpmRemaining: remReq,
          rpmUsed: usedReq,
          rpmPercentUsed,
          tpmLimit: limitTok,
          tpmRemaining: remTok,
          tpmUsed: usedTok,
          tpmPercentUsed,
          resetRequests: resetReq,
          resetTokens: resetTok,
          resetTime: resetReq || resetTok || null,
          status,
          errorMessage: !res.ok && res.status !== 429 ? `HTTP ${res.status}` : undefined,
        };
      } catch (err: any) {
        return {
          rawKey: key,
          maskedKey,
          model,
          rpmLimit: 30,
          rpmRemaining: 0,
          rpmUsed: 30,
          rpmPercentUsed: 100,
          tpmLimit: 6000,
          tpmRemaining: 0,
          tpmUsed: 6000,
          tpmPercentUsed: 100,
          resetRequests: null,
          resetTokens: null,
          resetTime: null,
          status: 'error',
          errorMessage: err?.message || 'Connection failed',
        };
      }
    })
  );
}

/**
 * Ping Gemini to check key validity and display standard quota
 */
export async function fetchGeminiMetrics(
  keys: string[],
  modelOverride?: string,
  timeoutMs = 4000
): Promise<GeminiKeyMetric[]> {
  const model = modelOverride || GEMINI_DEFAULT_MODEL;

  return Promise.all(
    keys.map(async (key) => {
      const maskedKey = maskKey(key);
      try {
        const url = `${GEMINI_API_URL}/${model}:generateContent?key=${encodeURIComponent(key)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
            generationConfig: { maxOutputTokens: 1, temperature: 0 },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });

        let status: GeminiKeyMetric['status'] = 'active';
        let errorMessage: string | undefined;

        if (res.status === 429) {
          status = 'rate_limited';
          errorMessage = 'Rate limited (429)';
        } else if (res.status === 401 || res.status === 403 || res.status === 400) {
          status = 'error';
          errorMessage = `Auth / Bad Request (HTTP ${res.status})`;
        } else if (!res.ok) {
          status = 'warning';
          errorMessage = `HTTP ${res.status}`;
        }

        return {
          rawKey: key,
          maskedKey,
          model,
          status,
          standardRpm: 15,
          standardRpd: 1500,
          standardTpm: 1000000,
          consoleUrl: 'https://aistudio.google.com/usage',
          errorMessage,
        };
      } catch (err: any) {
        return {
          rawKey: key,
          maskedKey,
          model,
          status: 'error',
          standardRpm: 15,
          standardRpd: 1500,
          standardTpm: 1000000,
          consoleUrl: 'https://aistudio.google.com/usage',
          errorMessage: err?.message || 'Connection failed',
        };
      }
    })
  );
}

/**
 * Load all metrics concurrently from .env.local and environment variables
 */
export async function fetchAllMetrics(): Promise<DashboardMetrics> {
  const envLocal = readEnvLocal();
  const openrouterKeys = keysFor('EXPO_PUBLIC_OPENROUTER_API_KEY', envLocal);
  const groqKeys = keysFor('EXPO_PUBLIC_GROQ_API_KEY', envLocal);
  const geminiKeys = keysFor('EXPO_PUBLIC_GEMINI_API_KEY', envLocal);

  const groqModel = process.env.EXPO_PUBLIC_GROQ_MODEL || envLocal['EXPO_PUBLIC_GROQ_MODEL'] || GROQ_PING_MODEL;
  const geminiModel = process.env.EXPO_PUBLIC_GEMINI_MODEL || envLocal['EXPO_PUBLIC_GEMINI_MODEL'] || GEMINI_DEFAULT_MODEL;

  const [openrouter, groq, gemini] = await Promise.all([
    fetchOpenRouterMetrics(openrouterKeys),
    fetchGroqMetrics(groqKeys, groqModel),
    fetchGeminiMetrics(geminiKeys, geminiModel),
  ]);

  return {
    openrouter,
    groq,
    gemini,
    timestamp: new Date().toISOString(),
  };
}
