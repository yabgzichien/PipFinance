// src/db/checkinRepo.ts
// Mindful daily check-in storage backed by SQLite app_meta table.
// Stores zero-spend check-ins and financial review check-ins separately
// from financial transactions to keep the ledger completely clean.
import { getMeta, setMeta } from './metaRepo';

export type CheckInKind = 'no_spend' | 'review';
export type CheckInMap = Record<string, CheckInKind>;

export const DAILY_CHECKINS_KEY = 'daily_checkins';

export async function getCheckInDays(): Promise<CheckInMap> {
  try {
    const raw = await getMeta(DAILY_CHECKINS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as CheckInMap;
  } catch {
    return {};
  }
}

export async function recordCheckIn(dateStr: string, kind: CheckInKind): Promise<CheckInMap> {
  const current = await getCheckInDays();
  const updated: CheckInMap = {
    ...current,
    [dateStr]: kind,
  };
  await setMeta(DAILY_CHECKINS_KEY, JSON.stringify(updated));
  return updated;
}

export async function removeCheckIn(dateStr: string): Promise<CheckInMap> {
  const current = await getCheckInDays();
  if (!(dateStr in current)) return current;
  const updated = { ...current };
  delete updated[dateStr];
  await setMeta(DAILY_CHECKINS_KEY, JSON.stringify(updated));
  return updated;
}
