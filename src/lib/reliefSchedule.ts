// src/lib/reliefSchedule.ts
// The curated v1 subset of LHDN relief lines (docs/superpowers/specs/
// 2026-08-23-tax-relief-tagging-design.md §2): what a working adult's receipts and
// commitments actually touch, not the full ~20-line schedule. Ships as code, versioned by
// year of assessment: a new YA is a new exported const, never a mutation of an old one.

export interface ReliefLine {
  code: string;
  /** When set, this line's claims also draw down the parent's own `cap` as a shared pool
   *  (see `computeUsage` in `relief.ts`). */
  parent?: string;
  label: string;
  /** What the user types into e-Filing, e.g. 'G9'. */
  formField: string;
  /** This line's own cap in RM. */
  cap: number;
  requiresCert?: 'MMC' | 'MDC' | null;
  /** Lowercased line-item / merchant heuristics tried by `matchRelief`. */
  matchKeywords: string[];
  /** Whether this line can be assigned to a `Commitment` in the Tax screen. */
  commitmentEligible: boolean;
}

export interface ReliefSchedule {
  ya: number;
  lines: ReliefLine[];
}

export const RELIEF_SCHEDULE_2025: ReliefSchedule = {
  ya: 2025,
  lines: [
    {
      code: 'lifestyle', label: 'Lifestyle', formField: 'G9', cap: 2500,
      matchKeywords: ['book', 'magazine', 'newspaper', 'laptop', 'smartphone', 'tablet', 'computer', 'internet', 'broadband', 'unifi', 'course', 'skill'],
      commitmentEligible: true, requiresCert: null,
    },
    {
      code: 'sports', label: 'Sports & fitness', formField: 'G10', cap: 1000,
      matchKeywords: ['gym', 'fitness', 'sports equipment', 'racket', 'yoga', 'membership'],
      commitmentEligible: true, requiresCert: null,
    },
    {
      code: 'medical', label: 'Medical (aggregate)', formField: 'G6-G8', cap: 10000,
      matchKeywords: [], commitmentEligible: false, requiresCert: null,
    },
    {
      code: 'medical.serious', parent: 'medical', label: 'Serious diseases / fertility', formField: 'G6(i)-(ii)', cap: 10000,
      matchKeywords: ['hospital', 'clinic', 'treatment'], commitmentEligible: false, requiresCert: 'MMC',
    },
    {
      code: 'medical.vaccination', parent: 'medical', label: 'Vaccination', formField: 'G6(iii)', cap: 1000,
      matchKeywords: ['vaccine', 'vaccination', 'jab'], commitmentEligible: false, requiresCert: null,
    },
    {
      code: 'medical.dental', parent: 'medical', label: 'Dental exam & treatment', formField: 'G6(iv)', cap: 1000,
      matchKeywords: ['dental', 'dentist'], commitmentEligible: false, requiresCert: 'MDC',
    },
    {
      code: 'medical.checkup', parent: 'medical', label: 'Health screening / mental health', formField: 'G7', cap: 1000,
      matchKeywords: ['medical checkup', 'health screening', 'mental health', 'covid test'], commitmentEligible: false, requiresCert: null,
    },
    {
      code: 'insurance.education-medical', label: 'Education / medical insurance premium', formField: 'G4', cap: 4000,
      matchKeywords: ['insurance', 'takaful'], commitmentEligible: true, requiresCert: null,
    },
    {
      code: 'sspn', label: 'SSPN net deposit', formField: 'G13', cap: 8000,
      matchKeywords: ['sspn'], commitmentEligible: true, requiresCert: null,
    },
    {
      code: 'childcare', label: 'Child care centre / kindergarten', formField: 'G12', cap: 3000,
      matchKeywords: ['childcare', 'kindergarten', 'daycare', 'nursery'], commitmentEligible: true, requiresCert: null,
    },
  ],
};

export const RELIEF_SCHEDULES: Record<number, ReliefSchedule> = {
  2025: RELIEF_SCHEDULE_2025,
};

export function scheduleForYA(ya: number): ReliefSchedule | null {
  return RELIEF_SCHEDULES[ya] ?? null;
}
