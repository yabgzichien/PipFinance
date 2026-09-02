// src/lib/scanningNarration.ts
// Dynamic, stage-by-stage progressive narration and mascot state for scanning wait times.
// Provides realistic feedback as vision models process receipts, statements, and balance screenshots.

import type { PipExpr } from '../components/Pip';

export type ScanKind = 'receipt' | 'statement' | 'balance';

export interface ScanStageInfo {
  text: string;
  expr: PipExpr;
  idea: boolean;
  progress: number;
}

interface StageDef {
  minSec: number;
  expr: PipExpr;
  idea?: boolean;
  en: string | ((secs: number) => string);
  zh: string | ((secs: number) => string);
}

const RECEIPT_STAGES: StageDef[] = [
  {
    minSec: 0,
    expr: 'think',
    en: 'Scanning store name, date & layout…',
    zh: '正在识别商家名称、日期与排版…',
  },
  {
    minSec: 3,
    expr: 'think',
    en: 'Reading every item and price line by line…',
    zh: '正在逐行提取商品明细与单价…',
  },
  {
    minSec: 6,
    expr: 'curious',
    en: 'Checking for service charge, taxes & discounts…',
    zh: '正在核对服务费、税率与折扣优惠…',
  },
  {
    minSec: 9,
    expr: 'think',
    idea: true,
    en: "Pip is double-checking the math so you don't have to…",
    zh: 'Pip 正在仔细复核金额，省去您的心算功夫…',
  },
  {
    minSec: 13,
    expr: 'curious',
    idea: true,
    en: (secs) => `Deciphering small print… almost there! (${secs}s)`,
    zh: (secs) => `正在解析小字与格式… 马上就好！（已用时 ${secs} 秒）`,
  },
];

const STATEMENT_STAGES: StageDef[] = [
  {
    minSec: 0,
    expr: 'think',
    en: 'Scanning transaction lines and amounts…',
    zh: '正在扫描交易记录与金额…',
  },
  {
    minSec: 3,
    expr: 'think',
    en: 'Identifying merchants and payment methods…',
    zh: '正在识别商户名称与支付方式…',
  },
  {
    minSec: 6,
    expr: 'curious',
    en: 'Matching with your learned spending categories…',
    zh: '正在智能匹配您的消费分类…',
  },
  {
    minSec: 9,
    expr: 'think',
    idea: true,
    en: 'Pip is organizing everything into clean rows…',
    zh: 'Pip 正在整理清晰的账单列表…',
  },
  {
    minSec: 13,
    expr: 'curious',
    idea: true,
    en: (secs) => `Wrapping up the details… almost ready! (${secs}s)`,
    zh: (secs) => `正在核对最后几项… 马上呈现！（已用时 ${secs} 秒）`,
  },
];

const BALANCE_STAGES: StageDef[] = [
  {
    minSec: 0,
    expr: 'think',
    en: 'Reading account and provider details…',
    zh: '正在识别账户与机构信息…',
  },
  {
    minSec: 3,
    expr: 'think',
    en: 'Detecting balances, currencies and assets…',
    zh: '正在解析余额、币种与资产…',
  },
  {
    minSec: 6,
    expr: 'curious',
    idea: true,
    en: 'Pip is matching against your existing accounts…',
    zh: 'Pip 正在比对您的现有账户…',
  },
  {
    minSec: 10,
    expr: 'think',
    idea: true,
    en: (secs) => `Finalizing the balance snapshot… (${secs}s)`,
    zh: (secs) => `正在整理账户快照…（已用时 ${secs} 秒）`,
  },
];

const STAGE_MAP: Record<ScanKind, StageDef[]> = {
  receipt: RECEIPT_STAGES,
  statement: STATEMENT_STAGES,
  balance: BALANCE_STAGES,
};

/**
 * Calculates a natural completion percentage (0 - 100) based on elapsed seconds.
 * Starts with rapid initial momentum (15-40%), steadily advances through middle stages (40-85%),
 * and smoothly tapers towards 98% during prolonged processing, avoiding stalls at 100% until finished.
 */
export function getScanProgress(elapsedSecs: number): number {
  const secs = Math.max(0, elapsedSecs);
  if (secs === 0) return 15;
  if (secs <= 3) return Math.round(15 + (secs / 3) * 25); // 15% -> 40% (at 3s)
  if (secs <= 6) return Math.round(40 + ((secs - 3) / 3) * 25); // 40% -> 65% (at 6s)
  if (secs <= 9) return Math.round(65 + ((secs - 6) / 3) * 20); // 65% -> 85% (at 9s)
  if (secs <= 13) return Math.round(85 + ((secs - 9) / 4) * 10); // 85% -> 95% (at 13s)
  // 13s+: asymptotic approach towards 99%
  const extraSecs = secs - 13;
  return Math.min(99, Math.round(95 + (1 - Math.exp(-extraSecs / 5)) * 4));
}

/**
 * Returns the active stage narration text, Pip expression, and idea lightbulb indicator
 * based on the scan kind, elapsed seconds, and active language.
 */
export function getScanStage(kind: ScanKind, elapsedSecs: number, isZh: boolean): ScanStageInfo {
  const stages = STAGE_MAP[kind] ?? RECEIPT_STAGES;
  const secs = Math.max(0, elapsedSecs);

  let match = stages[0];
  for (const s of stages) {
    if (secs >= s.minSec) {
      match = s;
    } else {
      break;
    }
  }

  const rawText = isZh ? match.zh : match.en;
  const text = typeof rawText === 'function' ? rawText(secs) : rawText;

  return {
    text,
    expr: match.expr,
    idea: match.idea ?? false,
    progress: getScanProgress(secs),
  };
}
