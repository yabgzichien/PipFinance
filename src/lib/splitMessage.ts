// src/lib/splitMessage.ts
// Every message Pip writes about money someone owes: the breakdown a payer sends the group
// after splitting a bill (Saved screen), and the reminder they send later to chase it (Owed
// screen). Pure and deterministic: no UI, database, or platform imports, so the wording and
// the arithmetic can both be unit-tested. Delivery lives in lib/shareText.ts.
//
// The one rule this file exists to protect: every amount quoted here is an amount Pip actually
// recorded, and the per-person amounts always sum to exactly what left the payer's account.
// `computeSplit` floors each friend to whole cents and hands the payer the remainder, so a bill
// that does not divide evenly has no "each" figure that is true for everybody. Rather than
// round one into the message and have a friend check it against the receipt, the division line
// is dropped whenever the split is not actually even. A message that does not tie out argues
// against the app in front of the whole table.
import { shortDate } from './dates';
import { fmtMoney } from './format';
import type { Surcharges } from './split';
import type { SplitMethod } from './types';

/** A minus sign (U+2212), not a hyphen: it lines up with digits at the same weight. */
const MINUS = '−';

export interface SplitMessageShare {
  personId: string;
  name: string;
  owed: number;
  /** `shares` method only: how many portions this person took. */
  portions?: number;
}

/** The surcharge breakdown behind an itemized split. Never persisted, so this is only
 *  available on the save that produced it (see SavedScreen's `splitWorkings` prop). */
export interface SplitWorkings {
  subtotal: number;
  serviceChargePct: number;
  serviceCharge: number;
  taxPct: number;
  tax: number;
  /** Positive ringgit taken off the bill, or null when there was no voucher. */
  discount: number | null;
}

export interface SplitMessageInput {
  merchant: string;
  gross: number;
  currency: string;
  method: SplitMethod;
  /** What the payer kept as their own expense. Zero when they fronted a bill they were not on. */
  ownShare: number;
  shares: SplitMessageShare[];
  /** `shares` method only: how many portions the payer took. */
  selfPortions?: number;
  workings: SplitWorkings | null;
  isZh: boolean;
}


function toCents(n: number): number {
  return Math.round(n * 100);
}

function fromCents(c: number): number {
  return c / 100;
}

/**
 * The surcharge breakdown behind an itemized receipt, as figures a person can check against
 * the paper in front of them.
 *
 * Deliberately mirrors `computeItemizedTotalCents` in lib/split.ts step for step, including
 * the order the rounding lands in and the fact that a 'before' voucher moves the base that
 * service charge and tax are charged on. The two must agree: this is the arithmetic the
 * message shows, and that one is the arithmetic the ledger recorded. A test asserts that
 * subtotal + service + tax − discount reconciles to `computeBillTotal` for every surcharge
 * shape, so the two cannot drift apart unnoticed.
 */
export function workingsFromReceipt(lines: { amount: number }[], surcharges: Surcharges): SplitWorkings {
  const subtotalCents = lines.reduce((s, l) => s + Math.max(0, toCents(l.amount)), 0);
  const discount = surcharges.discount;
  const svcPct = Math.max(0, surcharges.serviceChargePct);
  const taxPct = Math.max(0, surcharges.taxPct);

  const base = (() => {
    if (!discount || discount.timing !== 'before') return subtotalCents;
    const cents =
      discount.unit === 'amount' ? toCents(discount.value) : Math.round((subtotalCents * discount.value) / 100);
    return Math.max(0, subtotalCents - cents);
  })();

  const serviceCents = Math.round((base * svcPct) / 100);
  const taxCents = Math.round(((base + serviceCents) * taxPct) / 100);

  const discountCents = (() => {
    if (!discount) return 0;
    if (discount.timing === 'before') return subtotalCents - base;
    const rawCents = base + serviceCents + taxCents;
    return discount.unit === 'amount' ? toCents(discount.value) : Math.round((rawCents * discount.value) / 100);
  })();

  return {
    subtotal: fromCents(subtotalCents),
    serviceChargePct: svcPct,
    serviceCharge: fromCents(serviceCents),
    taxPct,
    tax: fromCents(taxCents),
    discount: discountCents > 0 ? fromCents(discountCents) : null,
  };
}

/** True when every participant, payer included, came out at the same amount. */
function isEvenSplit(input: SplitMessageInput): boolean {
  if (input.shares.length === 0) return false;
  const first = toCents(input.shares[0].owed);
  if (!input.shares.every((s) => toCents(s.owed) === first)) return false;
  if (input.ownShare > 0 && toCents(input.ownShare) !== first) return false;
  return true;
}

function headCount(input: SplitMessageInput): number {
  return input.shares.length + (input.ownShare > 0 ? 1 : 0);
}

/**
 * The "how this splits" block, or null when there is nothing honest to show.
 *
 * Returns null for an exact-amount split with no surcharges (the payer typed the figures, so
 * there is no derivation to display) and for any uneven division (see the file header).
 */
function workingsLines(input: SplitMessageInput): string[] | null {
  const { currency, gross, isZh, method, workings } = input;
  const money = (n: number) => fmtMoney(n, currency);

  if (method === 'itemized' && workings) {
    const lines: string[] = [];
    lines.push(`${isZh ? '项目' : 'Items'}: ${money(workings.subtotal)}`);
    if (workings.serviceChargePct > 0 || workings.serviceCharge > 0) {
      lines.push(
        `${isZh ? '服务费' : 'Service charge'} ${workings.serviceChargePct}%: +${money(workings.serviceCharge)}`
      );
    }
    if (workings.taxPct > 0 || workings.tax > 0) {
      lines.push(`${isZh ? '销售税' : 'SST'} ${workings.taxPct}%: +${money(workings.tax)}`);
    }
    if (workings.discount && workings.discount > 0) {
      lines.push(`${isZh ? '折扣' : 'Discount'}: ${MINUS}${money(workings.discount)}`);
    }
    lines.push(`${isZh ? '合计' : 'Total'}: ${money(gross)}`);
    return lines;
  }

  if (method === 'exact') {
    return [isZh ? '金额为手动输入' : 'Amounts entered by hand'];
  }

  if (method === 'shares') {
    // Portions are not persisted; they are recovered by replay (`sharesFromSplit`), which
    // returns nothing when the ratio cannot be reproduced to the cent. Defaulting to one each
    // would print a portion count the table never agreed to, so an unrecovered split simply
    // lists its amounts with no rate line.
    if (!input.shares.some((s) => s.portions != null)) return null;
    const total =
      input.shares.reduce((s, x) => s + Math.max(0, Math.round(x.portions ?? 1)), 0) +
      Math.max(0, Math.round(input.selfPortions ?? (input.ownShare > 0 ? 1 : 0)));
    if (total <= 0) return null;
    const per = gross / total;
    return [
      isZh
        ? `${money(gross)} 分为 ${total} 份 = 每份 ${money(per)}`
        : `${money(gross)} across ${total} portions = ${money(per)} per portion`,
    ];
  }

  // 'equal'
  const heads = headCount(input);
  if (heads <= 0 || !isEvenSplit(input)) return null;
  const each = input.shares[0].owed;
  return [
    isZh
      ? `${money(gross)} ÷ ${heads} 人 = 每人 ${money(each)}`
      : `${money(gross)} ÷ ${heads} people = ${money(each)} each`,
  ];
}

function personLine(share: SplitMessageShare, currency: string, isZh: boolean): string {
  const amount = fmtMoney(share.owed, currency);
  const portions =
    share.portions && share.portions > 1
      ? isZh
        ? `（${share.portions} 份）`
        : ` (${share.portions} portions)`
      : '';
  return `${share.name}: ${amount}${portions}`;
}

/**
 * The message for the group chat: the bill, how it was cut, and what each person owes.
 *
 * Contains this one bill and nothing else. No balance, no budget, no other spending ever
 * reaches it, because the payer is pasting it somewhere they do not control.
 */
export function buildGroupMessage(input: SplitMessageInput): string {
  const { currency, gross, isZh, merchant, ownShare, shares } = input;
  const blocks: string[] = [];

  blocks.push(
    [merchant, isZh ? `已付 ${fmtMoney(gross, currency)}` : `${fmtMoney(gross, currency)} paid`]
      .filter(Boolean)
      .join('\n')
  );

  const workings = workingsLines(input);
  if (workings) blocks.push([isZh ? '分摊方式' : 'How this splits', ...workings].join('\n'));

  const people = shares.map((s) => personLine(s, currency, isZh));
  if (ownShare > 0) {
    people.push(`${isZh ? '我（已付）' : 'Me (paid)'}: ${fmtMoney(ownShare, currency)}`);
  }
  blocks.push(people.join('\n'));

  return blocks.join('\n\n');
}

/**
 * The message for one person: their share and how it was arrived at, with nobody else named.
 *
 * Returns null when the id is not in the split, so a caller cannot accidentally send a
 * message with a blank name in it.
 */
export function buildPersonMessage(input: SplitMessageInput, personId: string): string | null {
  const share = input.shares.find((s) => s.personId === personId);
  if (!share) return null;

  const { currency, gross, isZh, merchant, workings } = input;
  const blocks: string[] = [];

  blocks.push(isZh ? `${share.name} 您好` : `Hi ${share.name}`);

  blocks.push(
    isZh
      ? `${merchant} 共 ${fmtMoney(gross, currency)}。\n您应付 ${fmtMoney(share.owed, currency)}。`
      : `${merchant} came to ${fmtMoney(gross, currency)}.\nYour share is ${fmtMoney(share.owed, currency)}.`
  );

  if (input.method === 'itemized' && workings) {
    const parts: string[] = [];
    if (workings.serviceChargePct > 0 || workings.serviceCharge > 0) {
      parts.push(`${isZh ? '服务费' : 'Service charge'} ${workings.serviceChargePct}%`);
    }
    if (workings.taxPct > 0 || workings.tax > 0) {
      parts.push(`${isZh ? '销售税' : 'SST'} ${workings.taxPct}%`);
    }
    if (workings.discount && workings.discount > 0) {
      parts.push(isZh ? '折扣' : 'discount');
    }
    if (parts.length > 0) {
      blocks.push(
        isZh
          ? `已包含${parts.join('、')}。`
          : `${parts.join(' and ')} included.`
      );
    }
  } else if (share.portions && share.portions > 1) {
    blocks.push(
      isZh ? `您占 ${share.portions} 份。` : `You took ${share.portions} portions.`
    );
  }

  return blocks.join('\n\n');
}

/* --- Chasing what you are owed ------------------------------------------- */

/** One unsettled bill, as the Owed screen already has it. */
export interface OwedBill {
  shareId: string;
  /** What the row calls the bill: the merchant, or the category when there is no merchant. */
  merchant: string;
  billDate: string | null;
  /** What is STILL owed, not the original share. Already converted to `currency`. */
  outstanding: number;
  /** Anything already repaid against this bill, so a part-paid row can say so. */
  paid?: number;
  remark?: string | null;
  categoryId?: string | null;
  gross?: number;
  owed?: number;
  splitMethod?: string;
  participantCount?: number;
  workingsCalculation?: string;
}

export interface OwedReminderInput {
  personName: string;
  /** The display currency the Owed screen is showing, which every amount here is already in. */
  currency: string;
  /** The person's total across every open bill, as shown on screen. */
  total: number;
  bills: OwedBill[];
  isZh: boolean;
}

/** "Food, 3 Sep: RM 10.00", with the date dropped when the bill never carried one. */
function billLine(bill: OwedBill, currency: string, isZh: boolean): string {
  const when = shortDate(bill.billDate);
  const head = when ? `${bill.merchant}, ${when}` : bill.merchant;
  const partPaid = bill.paid && bill.paid > 0 ? (isZh ? '（已部分支付）' : ' (part-paid)') : '';
  const calc = bill.workingsCalculation ? ` (${bill.workingsCalculation})` : '';
  return `${head}: ${fmtMoney(bill.outstanding, currency)}${partPaid}${calc}`;
}

/**
 * A reminder covering everything one person still owes.
 * The detailed itemized breakdown is provided in the accompanying Pip Receipt Image.
 */
export function buildOwedReminder(input: OwedReminderInput): string {
  const { bills, currency, isZh, personName, total } = input;

  if (bills.length === 1) {
    return buildBillReminder(input, bills[0].shareId) ?? '';
  }

  const blocks: string[] = [];
  blocks.push(isZh ? `${personName} 您好` : `Hi ${personName}`);

  const n = bills.length;
  blocks.push(
    isZh
      ? `您有 ${n} 笔账单尚未结清，合计 ${fmtMoney(total, currency)}。`
      : `You have ${n} open bill${n === 1 ? '' : 's'} with me, ${fmtMoney(total, currency)} in total.`
  );

  blocks.push(bills.map((b) => billLine(b, currency, isZh)).join('\n'));

  return blocks.join('\n\n');
}

/**
 * A reminder for a single bill.
 * The detailed itemized breakdown is provided in the accompanying Pip Receipt Image.
 */
export function buildBillReminder(input: OwedReminderInput, shareId: string): string | null {
  const bill = input.bills.find((b) => b.shareId === shareId);
  if (!bill) return null;

  const { currency, isZh, personName } = input;
  const when = shortDate(bill.billDate);
  const partPaid = bill.paid && bill.paid > 0;
  const calc = bill.workingsCalculation ? ` (${bill.workingsCalculation})` : '';

  const blocks: string[] = [];
  blocks.push(isZh ? `${personName} 您好` : `Hi ${personName}`);

  const where = isZh
    ? when
      ? `${bill.merchant}（${when}）。`
      : `${bill.merchant}。`
    : when
      ? `${bill.merchant} on ${when}.`
      : `${bill.merchant}.`;
  const amount = isZh
    ? `您尚欠 ${fmtMoney(bill.outstanding, currency)}${partPaid ? '（已部分支付）' : ''}${calc}。`
    : `You still owe ${fmtMoney(bill.outstanding, currency)}${partPaid ? ', after what you have already paid' : ''}${calc}.`;
  blocks.push(`${where}\n${amount}`);

  return blocks.join('\n\n');
}
