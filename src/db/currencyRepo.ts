// src/db/currencyRepo.ts
// The two app_meta keys that drive multi-currency, plus activation.
import { getMeta, setMeta } from './metaRepo';
import { saveFxRate } from './fxRepo';
import { fetchRateMYR } from '../prices/fx';
import { BASE_CURRENCY, parseActiveCurrencies } from '../lib/currency';

const ACTIVE_KEY = 'active_currencies';
const ENTRY_KEY = 'entry_currency';

export async function getActiveCurrencies(): Promise<string[]> {
  return parseActiveCurrencies(await getMeta(ACTIVE_KEY));
}

export async function setActiveCurrencies(codes: string[]): Promise<void> {
  await setMeta(ACTIVE_KEY, JSON.stringify(parseActiveCurrencies(JSON.stringify(codes))));
}

export async function getEntryCurrency(): Promise<string> {
  const stored = await getMeta(ENTRY_KEY);
  if (!stored) return BASE_CURRENCY;
  const active = await getActiveCurrencies();
  // A currency deactivated while it was the entry default falls back to ringgit rather
  // than leaving entry pointed at a currency the picker no longer offers.
  return active.includes(stored) ? stored : BASE_CURRENCY;
}

export async function setEntryCurrency(code: string): Promise<void> {
  await setMeta(ENTRY_KEY, code);
}

/**
 * Turn a currency on. Fetching and caching its rate is part of activation, and failure
 * aborts it: this is the network gate that guarantees every activatable currency already
 * has a cached rate, which is what lets transaction entry stay fully offline.
 *
 * Returns false when the rate could not be fetched, so the caller can show a message.
 */
export async function activateCurrency(code: string): Promise<boolean> {
  if (code === BASE_CURRENCY) return true;
  const rate = await fetchRateMYR(code);
  if (rate == null) return false;
  await saveFxRate(code, rate);
  const active = await getActiveCurrencies();
  if (!active.includes(code)) await setActiveCurrencies([...active, code]);
  return true;
}

/**
 * Turn a currency off. This only removes it from the entry picker: existing transactions
 * keep their currency and keep displaying it, and the cached rate is kept so historical
 * balances still convert. Nothing is deleted or rewritten.
 */
export async function deactivateCurrency(code: string): Promise<void> {
  if (code === BASE_CURRENCY) return;
  const active = await getActiveCurrencies();
  await setActiveCurrencies(active.filter((c) => c !== code));
  if ((await getMeta(ENTRY_KEY)) === code) await setEntryCurrency(BASE_CURRENCY);
}

/**
 * Refresh every active currency's cached rate. Best-effort and non-blocking: a failed
 * fetch leaves the previous cached rate in place, which is why entry never needs the
 * network. Piggybacks the existing price refresh trigger.
 */
export async function refreshFxRates(): Promise<void> {
  const active = await getActiveCurrencies();
  await Promise.all(
    active
      .filter((code) => code !== BASE_CURRENCY)
      .map(async (code) => {
        const rate = await fetchRateMYR(code);
        if (rate != null) await saveFxRate(code, rate);
      })
  );
}
