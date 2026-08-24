// src/lib/reliefSchedule.ts
// The full LHDN individual relief schedule (minus the handful of lines LHDN verifies
// automatically with no receipt: the base RM9,000 individual relief, EPF, and SOCSO have
// nothing for a receipt-evidence app to track). Ships as code, versioned by year of
// assessment: a new YA is a new exported const, never a mutation of an old one.
//
// Cap figures for YA 2025 confirmed against hasil.gov.my/en/individu/pelepasan-cukai/
// directly (2026-08-24) plus a cross-check against RinggitPlus's own YA2025 relief guide.
// Lines carrying a `note` are the ones where the *cap* is solid but a real-world nuance
// (a sub-cap, an eligibility condition, a price-banded tier) didn't fit this schema's plain
// number and is worth surfacing to the user rather than silently simplifying away.

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
  /** A real-world nuance this schema's plain cap/requiresCert fields can't fully capture
   *  (an eligibility condition, a sub-cap, a price-banded tier). Shown on the line's card. */
  note?: string;
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
      code: 'medical.intellectual-disability', parent: 'medical', label: 'Intellectual disability diagnosis (child)', formField: 'G8', cap: 6000,
      matchKeywords: ['assessment', 'early intervention', 'rehabilitation'], commitmentEligible: false, requiresCert: null,
      note: 'Assessment/rehab for a child under 18 with a learning disability. Needs a certified practitioner’s report, not just a receipt.',
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
    {
      code: 'disabled.individual', label: 'Disabled individual', formField: 'Item 4', cap: 7000,
      matchKeywords: [], commitmentEligible: false, requiresCert: null,
      note: 'Requires an OKU (disability) card, not a receipt — this line just tracks the claim, nothing to scan.',
    },
    {
      code: 'disabled.spouse', label: 'Disabled spouse', formField: 'Item 15', cap: 6000,
      matchKeywords: [], commitmentEligible: false, requiresCert: null,
      note: 'Requires an OKU (disability) card, not a receipt.',
    },
    {
      code: 'disabled.child', label: 'Disabled child', formField: 'Item 16c', cap: 8000,
      matchKeywords: [], commitmentEligible: false, requiresCert: null,
      note: 'A further RM8,000 on top of this applies for a child 18+ pursuing a recognised diploma or higher — not modelled separately here, check hasil.gov.my.',
    },
    {
      code: 'parents-grandparents', label: 'Parents & grandparents care (aggregate)', formField: 'Item 2', cap: 8000,
      matchKeywords: ['nursing home', 'elderly care', 'carer'], commitmentEligible: false, requiresCert: 'MMC',
    },
    {
      code: 'parents-grandparents.checkup', parent: 'parents-grandparents', label: 'Complete medical examination', formField: 'Item 2', cap: 1000,
      matchKeywords: ['medical checkup', 'health screening'], commitmentEligible: false, requiresCert: null,
    },
    {
      code: 'housing.loan-interest', label: 'First home loan interest', formField: 'Item 3', cap: 7000,
      matchKeywords: [], commitmentEligible: true, requiresCert: null,
      note: 'RM7,000/year for a home up to RM500,000, RM5,000/year for RM500,001–750,000; needs an SPA dated 2025–2027. Confirm your own tier applies.',
    },
    {
      code: 'insurance.life-epf', label: 'Life insurance premium', formField: 'Item 17', cap: 3000,
      matchKeywords: ['life insurance', 'life takaful'], commitmentEligible: true, requiresCert: null,
      note: 'Shares a combined RM7,000 cap with mandatory EPF contributions (up to RM4,000), which LHDN already knows from payroll — only the RM3,000 life-insurance portion needs tracking here.',
    },
    {
      code: 'education-fees-self', label: 'Further education fees (self)', formField: 'Item 5', cap: 7000,
      matchKeywords: ['tuition fee', 'university fee', 'degree', 'diploma programme'], commitmentEligible: false, requiresCert: null,
      note: 'A RM2,000 sub-cap inside this RM7,000 applies to general self-enhancement courses — not modelled separately here to avoid overlap with Lifestyle’s own course-fee keywords.',
    },
    {
      code: 'deferred-annuity-prs', label: 'Deferred annuity / PRS', formField: 'Item 18', cap: 3000,
      matchKeywords: ['prs', 'private retirement scheme', 'deferred annuity'], commitmentEligible: true, requiresCert: null,
    },
    {
      code: 'breastfeeding-equipment', label: 'Breastfeeding equipment', formField: 'Item 11', cap: 1000,
      matchKeywords: ['breast pump', 'breastfeeding'], commitmentEligible: false, requiresCert: null,
      note: 'Claimable only once every 2 years of assessment.',
    },
  ],
};

export const RELIEF_SCHEDULES: Record<number, ReliefSchedule> = {
  2025: RELIEF_SCHEDULE_2025,
};

/**
 * Look up a year's schedule, falling forward to the latest registered one for any year beyond
 * it. Without this, every transaction dated in a year whose real LHDN figures haven't been
 * entered yet would silently skip relief detection entirely, which reads to the user as the
 * feature being broken. The returned object keeps its own `ya` field (e.g. 2025), so anything
 * rendering that value still says honestly which year's cap figures are in force: only the
 * lookup is forgiving, not the data. A year *before* the earliest schedule still returns null,
 * since there is nothing to fall back to.
 */
export function scheduleForYA(ya: number): ReliefSchedule | null {
  if (RELIEF_SCHEDULES[ya]) return RELIEF_SCHEDULES[ya];
  const years = Object.keys(RELIEF_SCHEDULES).map(Number);
  if (years.length === 0) return null;
  const latest = Math.max(...years);
  return ya > latest ? RELIEF_SCHEDULES[latest] : null;
}
