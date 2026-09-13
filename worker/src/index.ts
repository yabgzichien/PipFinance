// worker/src/index.ts
import {
  checkAndReserve,
  commitReservation,
  getUsage,
  getUtcKeys,
  hashInstallationId,
  rollbackReservation,
  FREE_DAILY_LIMIT,
  FREE_MONTHLY_LIMIT,
  type D1Database,
} from './quota';
import { callGeminiVision, callGroqVision } from './providers';

export interface Env {
  DB: D1Database;
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  SALT?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-installation-id, x-idempotency-key, x-entitlement',
        },
      });
    }

    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    };

    const installationId = request.headers.get('x-installation-id');
    if (!installationId) {
      return new Response(JSON.stringify({ error: 'Missing x-installation-id header' }), {
        status: 400,
        headers,
      });
    }

    const isPro = request.headers.get('x-entitlement') === 'pro';
    const hash = await hashInstallationId(installationId, env.SALT || 'pip_quota_salt_2026');
    const { dayKey, monthKey } = getUtcKeys(Date.now());

    // GET /allowance
    if (request.method === 'GET' && url.pathname === '/allowance') {
      const usage = isPro ? { dayUsed: 0, monthUsed: 0 } : await getUsage(env.DB, hash, dayKey, monthKey);
      const dayLimit = isPro ? Number.POSITIVE_INFINITY : FREE_DAILY_LIMIT;
      const monthLimit = isPro ? Number.POSITIVE_INFINITY : FREE_MONTHLY_LIMIT;

      let blockedBy: 'daily' | 'monthly' | null = null;
      let canScan = true;

      if (!isPro) {
        if (usage.dayUsed >= FREE_DAILY_LIMIT) {
          blockedBy = 'daily';
          canScan = false;
        } else if (usage.monthUsed >= FREE_MONTHLY_LIMIT) {
          blockedBy = 'monthly';
          canScan = false;
        }
      }

      return new Response(
        JSON.stringify({
          tier: isPro ? 'pro' : 'free',
          monthUsed: usage.monthUsed,
          monthLimit: isPro ? 'Infinity' : monthLimit,
          dayUsed: usage.dayUsed,
          dayLimit: isPro ? 'Infinity' : dayLimit,
          canScan,
          blockedBy,
        }),
        { status: 200, headers }
      );
    }

    // POST /scan
    if (request.method === 'POST' && url.pathname === '/scan') {
      const idempotencyKey = request.headers.get('x-idempotency-key') || crypto.randomUUID();

      let body: any;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
      }

      const { imageBase64, mimeType, categories } = body || {};
      if (!imageBase64 || !mimeType) {
        return new Response(JSON.stringify({ error: 'Missing imageBase64 or mimeType' }), { status: 400, headers });
      }

      // 1. Reserve quota
      const reservation = await checkAndReserve(env.DB, hash, idempotencyKey, isPro, Date.now());

      if (!reservation.ok) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: reservation.blockedBy === 'daily' ? 'daily_limit' : 'monthly_limit',
            allowance: {
              tier: 'free',
              monthUsed: reservation.monthUsed,
              monthLimit: FREE_MONTHLY_LIMIT,
              dayUsed: reservation.dayUsed,
              dayLimit: FREE_DAILY_LIMIT,
              canScan: false,
              blockedBy: reservation.blockedBy,
            },
          }),
          { status: 429, headers }
        );
      }

      // 2. Call provider securely
      let extractedItems: any[] = [];
      try {
        if (env.GROQ_API_KEY) {
          extractedItems = await callGroqVision(env.GROQ_API_KEY, imageBase64, mimeType, categories || []);
        } else if (env.GEMINI_API_KEY) {
          extractedItems = await callGeminiVision(env.GEMINI_API_KEY, imageBase64, mimeType, categories || []);
        } else {
          // Simulation/fallback for development if keys aren't provisioned yet
          extractedItems = [];
        }
      } catch (err) {
        // Rollback quota on provider failure - user is not charged for failed scans
        await rollbackReservation(env.DB, idempotencyKey);
        return new Response(JSON.stringify({ ok: false, error: 'Provider execution failed' }), {
          status: 502,
          headers,
        });
      }

      // 3. Commit quota slot
      await commitReservation(env.DB, idempotencyKey, isPro, Date.now());

      // Fetch fresh usage
      const freshUsage = isPro ? { dayUsed: 0, monthUsed: 0 } : await getUsage(env.DB, hash, dayKey, monthKey);

      return new Response(
        JSON.stringify({
          ok: true,
          items: extractedItems,
          allowance: {
            tier: isPro ? 'pro' : 'free',
            monthUsed: freshUsage.monthUsed,
            monthLimit: isPro ? 'Infinity' : FREE_MONTHLY_LIMIT,
            dayUsed: freshUsage.dayUsed,
            dayLimit: isPro ? 'Infinity' : FREE_DAILY_LIMIT,
            canScan: isPro || (freshUsage.dayUsed < FREE_DAILY_LIMIT && freshUsage.monthUsed < FREE_MONTHLY_LIMIT),
            blockedBy: null,
          },
        }),
        { status: 200, headers }
      );
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
  },
};
