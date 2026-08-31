// src/state/useDisplayCurrency.ts
// Shared display-currency + FX-rate loader for headline totals. Screens in this app
// remount fresh on every navigation (no persistent nav stack, see App.tsx's conditional
// screen rendering), so a mount-time load is enough — the same pattern
// CurrencySettingsScreen's own reload() and NetWorthScreen's local `rates` state already use.
import { useEffect, useState } from 'react';
import { listFxRates } from '../db/fxRepo';
import { getDisplayCurrency } from '../db/currencyRepo';
import { ratesFromCache, toDisplay, txnToDisplay } from '../lib/fx';
import { BASE_CURRENCY } from '../lib/currency';

export interface DisplayCurrency {
  /** The currency code headline totals should render in. 'MYR' until changed in Settings. */
  code: string;
  /** Cached MYR-per-unit rates, keyed by code. */
  rates: Record<string, number>;
  /** Project an MYR figure into `code`. Falls back to the MYR figure itself if the display
   *  currency's rate is unavailable (should not happen in practice: display currency can
   *  only be set to an already-active currency, which guarantees a cached rate). */
  convert: (amountMyr: number) => number;
  /** Project a transaction into `code`, preserving native amounts when currency matches. */
  convertTxn: (txn: { amount: number; currency: string; nativeAmount?: number | null }) => number;
}

export function useDisplayCurrency(): DisplayCurrency {
  const [code, setCode] = useState(BASE_CURRENCY);
  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([getDisplayCurrency(), listFxRates()]).then(([nextCode, fx]) => {
      if (cancelled) return;
      setCode(nextCode);
      setRates(ratesFromCache(fx));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const convert = (amountMyr: number): number => toDisplay(amountMyr, code, rates) ?? amountMyr;
  const convertTxn = (txn: { amount: number; currency: string; nativeAmount?: number | null }): number =>
    txnToDisplay(txn, code, rates);
  return { code, rates, convert, convertTxn };
}
