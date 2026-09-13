import type { Account, BalanceEntry } from './types';
import { CLASS_BY_ID, RECEIVABLE_CLS } from './networth';
import { round2 } from './currency';

export interface NetWorthFreshness {
  trackedCount: number;
  currentCount: number;
  staleAccountIds: string[];
  oldestAsOf: string | null;
}

export interface ClassMover {
  cls: string;
  label: string;
  delta: number;
}

export function netWorthFreshness(
  accounts: Account[],
  entries: BalanceEntry[],
  todayIso: string,
): NetWorthFreshness {
  const tracked = accounts.filter((account) =>
    !account.archived
    && account.cls !== RECEIVABLE_CLS
    && !(account.sub && account.symbol)
  );
  const latestByAccount: Record<string, string> = {};
  for (const entry of entries) {
    const latest = latestByAccount[entry.accountId];
    if (!latest || entry.asOf > latest) latestByAccount[entry.accountId] = entry.asOf;
  }

  const today = new Date(`${todayIso}T00:00:00Z`).getTime();
  const staleAccountIds = tracked
    .filter((account) => {
      const asOf = latestByAccount[account.id];
      if (!asOf) return true;
      const ageDays = Math.floor((today - new Date(`${asOf}T00:00:00Z`).getTime()) / 86_400_000);
      return ageDays > 35;
    })
    .map((account) => account.id);
  const recordedDates = tracked.map((account) => latestByAccount[account.id]).filter(Boolean).sort();

  return {
    trackedCount: tracked.length,
    currentCount: tracked.length - staleAccountIds.length,
    staleAccountIds,
    oldestAsOf: recordedDates[0] ?? null,
  };
}

export function rankClassMovers(
  accounts: Account[],
  currentValueById: Record<string, number>,
  previousValueById: Record<string, number>,
): ClassMover[] {
  const deltaByClass: Record<string, number> = {};
  for (const account of accounts) {
    if (account.archived) continue;
    const rawDelta = (currentValueById[account.id] ?? 0) - (previousValueById[account.id] ?? 0);
    const contribution = account.kind === 'liability' ? -rawDelta : rawDelta;
    deltaByClass[account.cls] = round2((deltaByClass[account.cls] ?? 0) + contribution);
  }
  return Object.entries(deltaByClass)
    .filter(([, delta]) => delta !== 0)
    .map(([cls, delta]) => ({ cls, label: CLASS_BY_ID[cls]?.label ?? cls, delta }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
