// tools/limitDashboard/report.ts
// Ad-hoc usage report for the three shared LLM API keys baked into the app build
// (EXPO_PUBLIC_GEMINI_API_KEY / EXPO_PUBLIC_GROQ_API_KEY / EXPO_PUBLIC_OPENROUTER_API_KEY,
// see src/settings/settingsStore.ts). PipComp embeds one key set for every install, so each
// provider's usage against these keys IS the combined usage of the whole user base  there's
// no per-user key to aggregate separately.
//
// Coverage differs by provider, since only OpenRouter exposes a real usage-polling API:
//   - OpenRouter: GET /api/v1/key  exact daily/weekly/monthly spend and remaining credit.
//   - Groq: no usage-polling API exists. Fires one minimal ping request (same shape as
//     GroqProvider.test in src/llm/groq.ts) and reads the x-ratelimit-* response headers
//     a live RPM/TPM snapshot, NOT a daily total. Costs a sliver of real quota to run.
//   - Gemini: no usage API at all. Prints the AI Studio console URL as a manual-check reminder.
//
// Checks every failover key per provider (src/llm/fallback.ts supports comma/newline-separated
// backup keys), not just the first one, since a burned-out primary silently falling back to a
// backup is exactly what this should surface.
//
// Run: npx tsx tools/limitDashboard/report.ts

import * as fs from 'fs';
import * as path from 'path';

const ENV_LOCAL = path.join(__dirname, '../../.env.local');
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_PING_MODEL = 'qwen/qwen3.6-27b';

function readEnvLocal(): Record<string, string> {
  if (!fs.existsSync(ENV_LOCAL)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(ENV_LOCAL, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

function splitKeys(raw: string): string[] {
  return (raw || '').split(/[,\n]/).map((k) => k.trim()).filter(Boolean);
}

function keysFor(envVar: string, envLocal: Record<string, string>): string[] {
  return splitKeys(process.env[envVar] || envLocal[envVar] || '');
}

function mask(key: string): string {
  return key.length <= 10 ? '***' : `${key.slice(0, 6)}...${key.slice(-4)}`;
}

async function reportOpenRouter(keys: string[]): Promise<void> {
  console.log('\n=== OpenRouter (real usage numbers) ===');
  if (keys.length === 0) {
    console.log('  no key configured');
    return;
  }
  for (const key of keys) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/key', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        console.log(`  ${mask(key)}: HTTP ${res.status}`);
        continue;
      }
      const { data } = await res.json();
      const limit = data.limit === null ? 'unlimited' : data.limit;
      console.log(
        `  ${mask(key)}: usage=${data.usage} (today=${data.usage_daily}, week=${data.usage_weekly}, month=${data.usage_monthly}) ` +
          `limit=${limit} remaining=${data.limit_remaining ?? 'n/a'} freeTier=${data.is_free_tier}`
      );
    } catch (e: any) {
      console.log(`  ${mask(key)}: request failed  ${e.message}`);
    }
  }
}

async function reportGroq(keys: string[]): Promise<void> {
  console.log('\n=== Groq (live RPM/TPM snapshot, not a daily total) ===');
  if (keys.length === 0) {
    console.log('  no key configured');
    return;
  }
  for (const key of keys) {
    try {
      const res = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: GROQ_PING_MODEL,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
          temperature: 0,
        }),
      });
      if (!res.ok && res.status !== 429) {
        console.log(`  ${mask(key)}: HTTP ${res.status}`);
        continue;
      }
      const h = res.headers;
      console.log(
        `  ${mask(key)}: requests ${h.get('x-ratelimit-remaining-requests') ?? '?'}/${h.get('x-ratelimit-limit-requests') ?? '?'} remaining, ` +
          `tokens ${h.get('x-ratelimit-remaining-tokens') ?? '?'}/${h.get('x-ratelimit-limit-tokens') ?? '?'} remaining` +
          (res.status === 429 ? '  (rate-limited right now)' : '')
      );
    } catch (e: any) {
      console.log(`  ${mask(key)}: request failed  ${e.message}`);
    }
  }
}

function reportGemini(keys: string[]): void {
  console.log('\n=== Gemini (no usage API  check manually) ===');
  if (keys.length === 0) {
    console.log('  no key configured');
    return;
  }
  console.log('  https://aistudio.google.com/usage');
  for (const key of keys) {
    console.log(`  configured key: ${mask(key)}`);
  }
}

async function main(): Promise<void> {
  const envLocal = readEnvLocal();
  const openrouterKeys = keysFor('EXPO_PUBLIC_OPENROUTER_API_KEY', envLocal);
  const groqKeys = keysFor('EXPO_PUBLIC_GROQ_API_KEY', envLocal);
  const geminiKeys = keysFor('EXPO_PUBLIC_GEMINI_API_KEY', envLocal);

  console.log('PipComp shared-key usage report');
  console.log("Every install shares these keys, so this IS the whole user base's usage.");

  await reportOpenRouter(openrouterKeys);
  await reportGroq(groqKeys);
  reportGemini(geminiKeys);
}

main();
