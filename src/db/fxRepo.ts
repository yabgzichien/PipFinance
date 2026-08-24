// src/db/fxRepo.ts
// Persistence for cached FX rates. Mirrors the price_cache repo pattern.
import { getDb } from './db';
import type { FxRate } from '../lib/fx';

interface FxRow {
  code: string;
  rate_myr: number;
  as_of: string;
}

export async function listFxRates(): Promise<FxRate[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<FxRow>('SELECT * FROM fx_cache');
  return rows.map((r) => ({ code: r.code, rateMyr: r.rate_myr, asOf: r.as_of }));
}

export async function saveFxRate(code: string, rateMyr: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO fx_cache (code, rate_myr, as_of) VALUES (?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET rate_myr = excluded.rate_myr, as_of = excluded.as_of`,
    code,
    rateMyr,
    new Date().toISOString()
  );
}
