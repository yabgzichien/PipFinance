// src/lib/relief.ts
// Pure logic for tax relief tagging: which line a transaction matches, whether a tag's
// evidence is good enough, whether its e-Invoice request window is still open, and how
// claimed amounts consume nested aggregate caps. No DB/UI imports  see reliefRepo.ts for
// persistence and TaxScreen.tsx for the UI that renders these.
import type { ScannedReceipt } from './parseReceipt';
import type { ReliefLine, ReliefSchedule } from './reliefSchedule';
import type { EvidenceState, ReliefTag, Transaction } from './types';

/** A transaction dated in a given calendar year always counts toward that same year of
 *  assessment (research doc §1.6). Dates in this app are stored as 'YYYY-MM-DD' strings, so
 *  this reads the year directly rather than going through `Date` and risking a timezone
 *  shift at a year boundary. */
export function yaForDate(isoDate: string): number {
  return Number(isoDate.slice(0, 4));
}

/**
 * Line-item keyword match takes priority over merchant memory (spec §4): it lets a mixed
 * basket tag only the matching item's amount instead of the whole receipt total. Falls back
 * to a remembered merchant -> code mapping, and to no match at all if neither hits or the
 * remembered code no longer exists in this year's schedule.
 */
export function matchRelief(
  txn: Transaction,
  receipt: ScannedReceipt | null,
  reliefMemory: Record<string, string>,
  schedule: ReliefSchedule
): { code: string; amount: number } | null {
  if (receipt) {
    for (const item of receipt.items) {
      const label = item.label.toLowerCase();
      const line = schedule.lines.find((l) => l.matchKeywords.some((kw) => label.includes(kw)));
      if (line) return { code: line.code, amount: item.amount };
    }
  }
  const memCode = reliefMemory[txn.merchantKey];
  if (memCode && schedule.lines.some((l) => l.code === memCode)) {
    return { code: memCode, amount: txn.amount };
  }
  return null;
}

/**
 * Decision order matters: no-image is checked before missing-cert (a cert photo with
 * nothing else attached still counts as having *an* image), and weak-unnamed only applies to
 * discretionary spending (`commitmentEligible: false`)  a recurring bill's own receipt is
 * already as good as evidence gets, there is no buyer-name expectation to fall short of.
 */
export function evidenceState(tag: ReliefTag, txn: Transaction, line: ReliefLine): EvidenceState {
  if (!txn.receiptUri && !tag.certImageUri) return 'no-image';
  if (line.requiresCert && !tag.certImageUri) return 'missing-cert';
  if (!line.commitmentEligible && !tag.einvoiceImageUri && !tag.certImageUri) return 'weak-unnamed';
  return 'complete';
}

/** The right to request an individual e-Invoice for a plain receipt expires at the end of
 *  the transaction's calendar month (research doc §3.4). Only ever true for weak-unnamed
 *  evidence  everything else either already has stronger proof or isn't the kind of line
 *  an e-Invoice request applies to. */
export function isRequestable(evidence: EvidenceState, txn: Transaction, today: Date): boolean {
  if (evidence !== 'weak-unnamed') return false;
  if (!txn.date) return false;
  return txn.date.slice(0, 7) === today.toISOString().slice(0, 7);
}

export interface ReliefUsage {
  code: string;
  claimed: number;
  capUsed: number;
  cap: number;
  remaining: number;
}

/**
 * Sums tags per line, then applies parent-aggregate capping: a line with `parent` set draws
 * on a shared pool bounded by the parent's own `cap`. Siblings consume that shared pool in
 * schedule-list order  a line earlier in `reliefSchedule.ts`'s array effectively has
 * priority over a later one when the aggregate runs out, which is why sibling order in the
 * schedule data is a real product decision, not cosmetic.
 */
export function computeUsage(tags: ReliefTag[], schedule: ReliefSchedule): ReliefUsage[] {
  const claimedByCode: Record<string, number> = {};
  for (const t of tags) claimedByCode[t.code] = (claimedByCode[t.code] ?? 0) + t.amount;

  const childrenByParent: Record<string, ReliefLine[]> = {};
  for (const line of schedule.lines) {
    if (!line.parent) continue;
    (childrenByParent[line.parent] ??= []).push(line);
  }

  const usageByCode: Record<string, ReliefUsage> = {};
  for (const line of schedule.lines) {
    const claimed = claimedByCode[line.code] ?? 0;
    usageByCode[line.code] = { code: line.code, claimed, capUsed: 0, cap: line.cap, remaining: line.cap };
  }

  for (const line of schedule.lines) {
    if (line.parent) continue; // resolved through the parent branch below
    const usage = usageByCode[line.code];
    const children = childrenByParent[line.code] ?? [];
    if (children.length === 0) {
      usage.capUsed = Math.min(usage.claimed, usage.cap);
      usage.remaining = usage.cap - usage.capUsed;
      continue;
    }
    let poolRemaining = line.cap;
    const parentUsed = Math.min(usage.claimed, poolRemaining);
    poolRemaining -= parentUsed;
    for (const child of children) {
      const childUsage = usageByCode[child.code];
      const childCapUsed = Math.min(childUsage.claimed, child.cap, poolRemaining);
      childUsage.capUsed = childCapUsed;
      childUsage.remaining = child.cap - childCapUsed;
      poolRemaining -= childCapUsed;
    }
    usage.capUsed = parentUsed + children.reduce((s, c) => s + usageByCode[c.code].capUsed, 0);
    usage.remaining = poolRemaining;
  }

  return schedule.lines.map((l) => usageByCode[l.code]);
}
