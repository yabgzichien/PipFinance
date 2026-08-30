# Malaysian tax relief, receipt evidence, and what Pip should build

Research date: 22 August 2026. Sources fetched and claims extracted by the deep-research
workflow (23 sources, 5 search angles). **The adversarial verification pass did not run**
(the session hit its usage limit and all 25 verifier panels errored), so every claim below
carries a confidence rating I assigned by hand from source tier and cross-source
corroboration, not from a 3-vote refutation panel. Anything rated Medium or Low should be
re-checked against LHDN before it drives code.

Not tax advice. The numbers below are for product design; the app must never present them
as advice, and LHDN is the only authority on the current schedule.

---

## 1. How the relief system actually works

### 1.1 Self-assessment, self-declared, evidence held back

Malaysia runs a Self-Assessment System: the taxpayer's own ITRF submission *is* the
assessment. Relief amounts are typed into named fields in MyTax e-Filing (or Form BE
manually); the taxpayer submits **no receipts at all** with the return. The only exception
is Working Sheets HK-6 and HK-8/HK-9 for refund claims involving foreign tax deducted.

Evidence is produced only later, if LHDN asks.
*Confidence: High. Stated in the official LHDN Form BE Explanatory Notes for both YA 2024
and YA 2025, and corroborated by Crowe Malaysia and QuickHR.*

This is the single most important product fact. The taxpayer's real burden is not the
filing (a handful of numbers, 20 minutes), it is **holding a defensible evidence archive
for years afterwards**, plus **knowing which of their spending was claimable in the first
place**. Those are the two jobs to be done.

### 1.2 Relief limits are nested, not flat

An app cannot model reliefs as `{category: limit}`. The medical relief is a single
RM10,000 aggregate bucket containing sub-capped lines:

| YA 2025 medical bucket (RM10,000 aggregate) | Sub-cap |
|---|---|
| Serious diseases (self, spouse, child) | shares the 10k |
| Fertility treatment | shares the 10k |
| Vaccination | RM1,000 |
| Dental examination and treatment | RM1,000 |
| Complete medical exam, COVID-19 test kit, mental health consultation, self-monitoring equipment, disease detection | RM1,000 |
| Intellectual disability diagnosis / early intervention, child 18 and below | RM6,000 (was RM4,000 in YA 2024) |

Lifestyle is a second nested shape: **RM2,500 shared across four sub-types** (books and
publications; personal computer / smartphone / tablet, non-business use; monthly internet
under own name; skill improvement or personal development course fees). Sports sits
**outside** that ceiling as a separate RM1,000 relief (equipment under the Sports
Development Act 1997, facility rental and entrance fees, competition registration with a
Commissioner of Sports licensed organiser, gym membership and sports training).

*Confidence: High for the structure and the RM2,500 / RM1,000 / RM10,000 numbers. Both
official hasil.gov.my relief pages and both years of Form BE Explanatory Notes agree.*

> One extracted claim said lifestyle overflow above RM2,500 "can spill into the sports
> category". I rate that **Low confidence and probably a misreading** of the Form BE notes.
> Do not implement spillover without confirming against the notes directly.

### 1.3 The schedule is versioned by year of assessment

Numbers moved materially between YA 2024 and YA 2025:

| Relief | YA 2024 | YA 2025 |
|---|---|---|
| Disabled individual | RM6,000 | RM7,000 |
| Disabled spouse | RM5,000 | RM6,000 |
| Disabled child | RM6,000 | RM8,000 |
| Education / medical insurance premium | RM3,000 | RM4,000 |
| Intellectual disability sub-cap | RM4,000 | RM6,000 |
| "Expenses for parents" | parents | widened to parents **and grandparents** |

YA 2025 also introduced a first-home housing loan interest relief: RM7,000/year for a
property up to RM500,000, RM5,000/year for RM500,001 to RM750,000, claimable for three
consecutive years, SPA dated between 1 Jan 2025 and 31 Dec 2027, nothing above RM750,000.

*Confidence: High for the delta table (official LHDN page plus RinggitPlus). Medium-High
for the housing loan tiers (official page plus two secondary sources agree on the amounts;
the 3-year and SPA-window conditions came from fewer sources).*

**Implication: the relief table must be a versioned data structure keyed by YA, shipped as
data and updatable without an app release.** A hardcoded table goes wrong every Budget.

> The YA 2024 Form BE Explanatory Notes state the child care relief (RM3,000, G12) runs
> "only until Year of Assessment 2024", while several YA 2025 guides still list RM3,000
> childcare. **Unresolved contradiction, Low confidence either way.** Verify before shipping
> a childcare relief line.

### 1.4 Some reliefs cannot be evidenced by a receipt at all

This kills the naive "OCR the receipt, tag the relief, done" design:

- Serious disease, fertility and dental claims need **written certification from a
  practitioner registered with the Malaysian Medical Council** (or Malaysian Dental
  Council), on top of the receipt.
- Childcare relief needs the centre to be **registered with the Department of Social
  Welfare or the Ministry of Education**, plus the child's birth document, plus monthly
  fee receipts. Child must be 6 or below.
- Breastfeeding equipment is claimable **once every two years**.
- SSPN relief is computed on **net deposits** (deposits minus withdrawals in the year),
  which is an account statement calculation, not a receipt.
- Disability reliefs need DSW registration evidence.

*Confidence: High. Both Form BE Explanatory Notes and the official relief page.*

Conversely, three reliefs need **no taxpayer-supplied proof** because LHDN verifies them
from official records: the RM9,000 individual relief, EPF, and SOCSO.
*Confidence: Medium. One blog source only, though it is consistent with how those figures
are already pre-filled in e-Filing.*

### 1.5 Name-matching is a hard constraint

A common cause of rejected relief claims is a receipt or invoice **that does not carry the
claimant's own name**. A supermarket till slip for a laptop has no name on it.
*Confidence: Medium (one secondary source, QuickHR), but it is consistent with the whole
e-Invoice push described below, which exists precisely to attach buyer identity to
purchases.*

This matters enormously for product: for a meaningful share of lifestyle-relief spending,
**the anonymous receipt the user photographs is weaker evidence than they assume.**

### 1.6 Timing

- Relief claims are restricted to expenses **incurred within the calendar year** of the YA.
- YA 2025 filing: 30 April 2026 for Form BE (grace to 15 May), 30 June 2026 for Form B
  (grace to 15 July). Same pattern each year.

*Confidence: High, multiple sources.*

---

## 2. Receipt retention: what LHDN actually requires

### 2.1 Seven years, clock starts at filing

The statutory duty is **section 82 of the Income Tax Act 1967**. The Form BE Explanatory
Notes state records, documents and working sheets used in computing the return must be kept
**seven years after the end of the year in which the return form is furnished**, and this
is restated separately at the head of Part G (Relief) and at item B8 (donations). So it
explicitly covers relief receipts, not just business records.

*Confidence: High on "7 years" (every source agrees, primary and secondary). High on the
clock starting from the year of furnishing, per the primary LHDN notes.*

> Two secondary sources state different clock starts: "from the end of the year to which
> the income relates" and "from the date records are created or received". **Follow the
> primary LHDN wording (year of furnishing), and design the archive to the longest of the
> readings anyway.** For a YA 2025 return filed April 2026, keep to end of 2033. An archive
> that just keeps everything for 8 years from the transaction date is safe under all three.

### 2.2 Penalties for not keeping records

- Failure to keep records: fine **RM200 to RM20,000 and/or up to 1 year imprisonment**.
  *Confidence: Medium (one source, but it matches the ITA penalty structure).*
- Practical consequence for reliefs: the claim is **disallowed** and an additional
  assessment is raised. *Confidence: High, several sources.*
- Incorrect-return penalties under the Tax Audit Framework escalate: **15% first offence,
  30% second, 45% third and subsequent, 100% for wilful default or fraud**.
  *Confidence: Medium (one specialist firm source; the widely-quoted "up to 100%" appears
  elsewhere too).*
- No proper records at all exposes the taxpayer to a **best-judgment assessment** under
  s.91 (KPHDN v Lai Keng Chong).
  *Confidence: Medium.*
- Appeal path if assessed: **Form Q within 30 days** of the notice of assessment; Form N
  for extension. From 1 June 2026, appeals can go through **e-Rayuan Taksiran** in MyTax.
  *Confidence: Medium.*

### 2.3 Acceptable proof is broader than receipts

LHDN-facing guidance and practitioner sources say acceptable proof includes receipts,
invoices, statements, **bank statements, online transaction history, e-wallet records, and
digital invoices or email confirmations**. A claim backed by partial documentation still
reduces exposure versus nothing.
*Confidence: Medium (secondary sources; treat "bank statement alone is enough" as unproven,
it is corroborating evidence, not a substitute for a named invoice).*

### 2.4 The digital-copy question, unresolved and important

This is the sharpest open point in the whole research:

- One source: LHDN **accepts digital or scanned copies** rather than physical originals,
  provided they meet legibility and accessibility standards. This is the compliance basis
  for a photo-capture app.
- Another source: where **computerised systems** are used, the **original source documents
  such as invoices and receipts must still be retained**, so a digital capture *supplements*
  rather than replaces the paper.

*Confidence: Low on either reading as stated. Both are secondary. This needs a direct check
against the LHDN Public Ruling on record keeping.*

**Product consequence, and it is a big one: Pip must not tell users they can throw the
paper away.** The safe copy is "capture it now so you can find it later, and keep the
original where you already keep them". Getting this wrong is a liability, and it is also
exactly the claim a competitor (ClaimLah) is already making loosely.

---

## 3. e-Invoice / MyInvois: the thing that changes everything, slowly

### 3.1 Today, an ordinary receipt is still valid

LHDN's own e-Invoice General FAQs state taxpayers may keep claiming personal relief using
**existing documentation such as ordinary receipts, without an e-Invoice, until the
legislation is amended**. The Star (13 May 2026) reports the same: e-Invoices are
encouraged, not legally required for relief, because the tax law has not been amended.

*Confidence: High. Primary LHDN FAQ plus national press.*

And even when an e-Invoice exists, the taxpayer **can still be asked at audit to produce
supporting documents and proof of payment**. e-Invoicing does not discharge the evidence
burden. *Confidence: Medium-High.*

### 3.2 But LHDN is steering hard toward it

- LHDN is **urging individuals to request an e-Invoice for every relief-related
  expenditure** from 2026.
- A **pilot will pre-fill relief data into the ITRF for YA 2026** (filed 2027), sourced
  from e-Invoice transaction data. Pre-fill candidates named: personal computer or
  smartphone, lifestyle, insurance, childcare fees.
- Pre-filling depends on **sellers tagging each transaction with the correct item
  classification code**.

*Confidence: Medium-High (Bernama, twice, plus The Star).*

**This is the strategic clock on the whole feature.** If pre-fill works, the "which of my
spending is claimable" half of the problem starts getting solved by LHDN itself from YA
2026 onward. The half that does **not** go away is evidence retention (see 3.5) and
coverage gaps (see 3.4).

### 3.3 To get a personal e-Invoice, the user must act at the till

- The buyer must supply their **identification number or TIN at the point of transaction**.
  Individuals **do not need a TIN**: MyKad / MyTentera number alone is sufficient.
- The individual TIN prefix is now **"IG"** (replacing OG and SG).
- A validated e-Invoice can be shared as a **free-format visual (PDF, printed slip, image)
  with the IRBM QR code embedded**, not just raw XML/JSON.

*Confidence: High. LHDN e-Invoice Specific Guideline and General FAQs (both primary).*

> Two primary sources differ on whether the individual needs an IG TIN or just a MyKad
> number. The Specific Guideline says MyKad alone suffices; the FAQ describes the IG TIN.
> Safest product behaviour: **store both, surface whichever the merchant asks for.**

### 3.4 The coverage gap runs to 2028

- If the buyer does **not** request an e-Invoice, the supplier rolls the sale into a
  **monthly consolidated e-Invoice** issued to "General Public". That is the *supplier's*
  proof of income, is never shared with the buyer, and gives the taxpayer **nothing**.
- A buyer who took a normal receipt can still request a proper e-Invoice, but only
  **within the same calendar month as the transaction**. Hard deadline.
- Consolidation is **prohibited** (so an individual e-Invoice is always issued) for single
  transactions above RM10,000 and for motor vehicles, flight tickets and private charters,
  construction contracts and materials, luxury goods and jewellery, and betting payouts.
- **Interim relaxation runs to 31 December 2027** for taxpayers with turnover up to RM5
  million, during which suppliers **may lawfully decline** to issue an individual e-Invoice
  even when asked. Small merchants only start mandatory implementation 1 Jan 2026; MSMEs
  below RM1 million may be exempt until 1 July 2026.

*Confidence: High on the consolidated-invoice mechanics and the monthly request deadline
(LHDN Specific Guideline, primary, plus ClearTax). Medium-High on the relaxation dates.*

**So through 2027 at minimum, a large share of everyday Malaysian consumer spending will
still be evidenced by an ordinary paper receipt.** That is Pip's window, and it is a
real one, not a technicality.

### 3.5 The two-year vs seven-year gap

The MyInvois Portal retains transaction records **accessible to the taxpayer for only about
two years** after validation, while the s.82 duty is **seven years**. Storing data in
MyInvois does **not** relieve the taxpayer of the seven-year duty.

*Confidence: Medium-High (Bernama, attributing LHDN). Worth confirming, because it is the
strongest single argument for the product existing at all.*

**This is the durable product wedge.** Even in a fully e-invoiced, fully pre-filled 2028,
there is a five-year hole between what LHDN keeps for the taxpayer and what the taxpayer is
required to keep. A private archive fills it.

### 3.6 What the app cannot do: pull the user's e-Invoices

The MyInvois SDK is an **issuer-side** integration surface. It exposes APIs for a
taxpayer's ERP or business system to *submit* documents. It is not a consumer API for
individuals to retrieve their own purchases. Worse:

> **Intermediaries integrating with MyInvois are barred from accessing or retrieving
> e-Invoices that taxpayers submitted independently or received as buyers.**

*Confidence: High. LHDN SDK documentation, primary.*

That closes the obvious shortcut. A consumer finance app would sit on the intermediary
side and inherit that restriction. Every document submitted needs a digital signature over
TLS; credentials are role-separated (Taxpayer login vs Intermediary Client ID/Secret). Rate
limits are roughly 100 rpm for submission and 300 rpm for status polling, with a
pre-production sandbox at `preprod-api.myinvois.hasil.gov.my` (3 months data retention).
*Confidence: Medium on the specific rate limits (community-maintained docs).*

**Therefore the only viable capture path for Pip is the user-side artefact: scan the
QR code on the validated e-Invoice visual, or photograph the receipt.** Design around that
constraint, do not plan for an API that will not be granted.

---

## 4. Competitive read

Two Malaysian receipt apps surfaced. Neither does the thing:

**ReceiptLah** (receiptlah.com.my): capture via camera/gallery/upload, OCR of merchant,
date, total, payment method, then **manual** user assignment into four coarse folders
(medical, lifestyle, education, family/household). No relief limits shown anywhere. No
MyInvois. No mention of the 7-year rule. Exports totals to PDF/Excel/CSV for e-Filing or an
accountant. Explicitly disclaims tax advice.

**ClaimLah** (claimlah.com): photo plus AI OCR, claims 99% accuracy on Malaysian receipts,
automatic SST/GST detection, offline. Markets **7-year cloud retention as satisfying LHDN
record-keeping**. Free tier capped at 5 receipts/month; RM9.90/month "Plus" unlocks AI
extraction, unlimited receipts, PDF/Excel export. Framing is **business expense tracking
and employee reimbursement**, not personal relief. No MyInvois mention, no relief
categories, no e-Filing field mapping. Its stated pain points are thermal paper fading and
finding an old receipt during an audit.

Off-the-shelf OCR (Asprise and similar) returns merchant, address, phone, tax registration
number, receipt number, currency, subtotal, total and line items, with no Malaysia-specific
recognizer profile and no notion of LHDN reliefs. **The relief mapping layer does not exist
off the shelf. It has to be built.**

*Confidence: High, these are direct reads of the vendors' own pages.*

**Where Pip wins:** both competitors are receipt-only silos. Pip already holds the
transaction ledger, categories, merchant memory (`merchantKey -> categoryId`), and receipt
images attached to transactions (`Transaction.receiptUri`). Relief detection can ride on
data the user is already producing for budgeting reasons, which means the tax feature costs
the user close to zero incremental effort. That is a structural advantage neither
competitor can copy without becoming a full finance app.

---

## 5. What Pip should build

### 5.1 The core design decision: relief is a second axis, not a category

Do not add "Lifestyle relief" to the spending category list. A laptop is **Shopping** for
budgeting and **Lifestyle G9** for tax; lunch is **Food** for budgeting and nothing for
tax. Conflating them corrupts the budget model and produces bad relief math.

Add an orthogonal tag on the transaction:

```ts
// src/lib/types.ts
export interface ReliefTag {
  /** Stable code for the relief line, e.g. 'lifestyle', 'medical.dental'. Versioned lookup. */
  code: string;
  /** Claimed amount in RM. May be less than txn.amount (mixed-basket receipts). */
  amount: number;
  /** Which YA this counts toward. Derived from txn.date, overridable. */
  ya: number;
  /** How the tag arrived, drives the confidence UI and the review queue. */
  origin: 'auto' | 'suggested-accepted' | 'manual';
  /** Evidence completeness, computed, see 5.4. */
  evidence: EvidenceState;
}
```

Existing hooks it plugs into: `Transaction.receiptUri` already stores the image,
`src/lib/receiptStorage.ts` already saves it, `src/lib/scanReceipt.ts` and
`src/lib/parseReceipt.ts` already produce `ScannedReceipt` with line items. Line items are
what make mixed-basket splitting possible, and that is a real advantage over both
competitors, whose OCR stops at the total.

### 5.2 A versioned relief schedule as shippable data

```ts
interface ReliefLine {
  code: string;              // 'medical.dental'
  parent?: string;           // 'medical' -> shares the RM10,000 aggregate
  label: string;
  cap: number;               // this line's own cap
  formField: string;         // 'G6(iv)' -> what the user types into e-Filing
  requiresCert?: 'MMC' | 'MDC' | 'DSW' | 'MOE' | null;
  frequency?: 'annual' | 'every-2-years';
  notes?: string;
}
interface ReliefSchedule { ya: number; lines: ReliefLine[]; aggregates: Record<string, number>; }
```

The cap engine must compute **min(line cap, remaining parent aggregate)** and show both
numbers. Ship the schedule as a remote-updatable JSON blob with a bundled fallback, because
the numbers change every Budget and an app-store release cycle is too slow.

### 5.3 Detection: suggest, never auto-claim

Three signals, in order of reliability:

1. **Line-item match** from `ScannedReceipt.items` (a receipt line reading "LAPTOP" or
   "BUKU"). Strongest, and it enables splitting a RM380 basket into RM120 relief-eligible
   and RM260 not.
2. **Merchant memory**, reusing the existing `merchantKey` map. A gym, a clinic, a
   bookshop, an ISP: once the user confirms one, remember the merchant-to-relief mapping
   the same way categories are remembered today.
3. **Recurring commitments**, which Pip already models: internet subscription, medical
   insurance premium, SSPN standing instruction, life insurance. These are the highest
   value and lowest effort reliefs, because they repeat monthly and the user has already
   told the app about them. **This is the cheapest win in the entire feature and should
   ship first.**

Never write a relief tag without user confirmation. A wrong auto-claim is a 15% to 100%
penalty on the user's assessment, and the app carries reputational risk for it.

### 5.4 Evidence state, the differentiator

This is what neither competitor does. For every tagged transaction compute:

```ts
type EvidenceState =
  | 'complete'          // image held + name on document (or e-Invoice) + any cert attached
  | 'missing-cert'      // medical/childcare relief with no practitioner or registration doc
  | 'unnamed-document'  // receipt has no buyer name, weak under audit (see 1.5)
  | 'no-image'          // tagged from a bank line only, nothing captured
  | 'einvoice-window-open';   // still within the calendar month, can still request one
```

Then surface it. A relief dashboard that says "RM2,180 of RM2,500 lifestyle claimed, but
RM640 of it has no named document" is genuinely more useful than any competitor's export,
and it is directly derived from the audit reality in section 2.

### 5.5 The e-Invoice nudge, the highest-leverage single feature

Given 3.3 and 3.4:

- Store the user's MyKad number and IG TIN locally (never transmitted, on-device only,
  this is sensitive PII and should be behind device auth).
- On a purchase that pattern-matches a relief category, prompt at the moment of capture:
  **"Ask the merchant for an e-Invoice with your MyKad, this makes the claim
  auto-verifiable"**, with the stored number one tap from the clipboard.
- Run a **month-end sweep**: any relief-eligible purchase this calendar month without an
  e-Invoice gets a single grouped reminder before the month closes, because after month end
  the right to request one is gone.
- Capture path is **QR scan of the validated e-Invoice visual** (PDF, slip or image),
  since the IRBM QR is embedded there and the MyInvois API is closed to us. Do not build
  toward an intermediary integration.

The month-end deadline is a genuine, dated, consequential thing the user cannot track
themselves. That is exactly the shape of a notification people keep switched on.

### 5.6 The archive, the durable moat

- Keep receipt images for **8 years from transaction date** (safe under all three readings
  of the clock in 2.1), not the app's normal retention.
- Survive reinstall and device change. A local file URI does not. This is the one place a
  cloud or user-controlled backup is justified, and it is also the honest reason to charge.
- Ship an **audit pack export**: per YA, a PDF or ZIP containing every tagged receipt image
  plus a summary table keyed by Form BE line (G6, G9, G12), so the user can respond to an
  LHDN request in one action.
- Copy discipline: "keep your originals too" (see 2.4). Do not repeat ClaimLah's implied
  claim that the digital copy replaces the paper.

### 5.7 The filing handoff

Do not attempt to file. Produce a **single screen the user reads while typing into MyTax**:
each Form BE Part G line, the computed claimable amount, the cap, and a warning wherever
evidence is incomplete. Plus a plain "you left RM X of lifestyle relief unclaimed" figure,
which is the number that makes people care.

### 5.8 Sequencing

1. **Relief tag data model + versioned YA schedule + cap engine.** Everything depends on it.
2. **Commitments-to-relief mapping** (internet, insurance, SSPN). Highest value per unit of
   work, no OCR needed, uses data already in the app.
3. **Relief dashboard with headroom and evidence state.** The "you are leaving money on the
   table" hook.
4. **Line-item relief detection from the existing receipt scanner** + basket splitting.
5. **e-Invoice nudge and month-end sweep.** Time-sensitive, ships best before a filing season.
6. **8-year archive and audit pack export.** The retention promise, and the paywall.
7. **Watch the YA 2026 pre-fill pilot** (filed 2027). If it lands, reposition the feature
   from "find your reliefs" toward "verify LHDN's pre-fill and hold the evidence", which is
   the part pre-fill provably does not solve.

---

## 6. Open questions to resolve before building

1. **Digital copy vs paper original** (2.4). Check the LHDN Public Ruling on record keeping.
   This determines the app's core promise and its liability exposure.
2. **Childcare relief after YA 2024** (1.3). Contradiction between the Form BE notes and
   secondary guides.
3. **Retention clock start** (2.1). Primary source says year of furnishing; design to 8
   years from transaction anyway, but confirm before making a retention claim in copy.
4. **Name-matching strictness** (1.5). How often are unnamed till receipts actually rejected
   in practice? This sets how loud the `unnamed-document` warning should be.
5. **Lifestyle-to-sports overflow** (1.2). Probably false. Read the Form BE notes directly.
6. **The RM9,000 / EPF / SOCSO no-proof claim** (1.4). Single source.
7. **YA 2026 pre-fill scope.** Which relief categories, and does the taxpayer still need
   their own evidence? Section 3.5 suggests yes, and that answer is the feature's lifespan.

## Sources

Primary (LHDN / official):
- Individual tax relief schedule YA 2025: `hasil.gov.my/en/individu/pelepasan-cukai/`
- Tax reliefs (life-cycle path): `hasil.gov.my/en/individual/individual-life-cycle/income-declaration/tax-reliefs/`
- Form BE Explanatory Notes YA 2024: `hasil.gov.my/media/vvglk3ad/explanatory_notes_be2024_2.pdf`
- Form BE Explanatory Notes YA 2025: `ef.hasil.gov.my/eBE2025/Pdf/Nota_BE_e.pdf`
- IRBM e-Invoice Specific Guideline: `hasil.gov.my/media/uwwehxwq/irbm-e-invoice-specific-guideline.pdf`
- LHDNM e-Invoice General FAQs: `hasil.gov.my/media/0xqitc2t/lhdnm-e-invoice-general-faqs.pdf`
- MyInvois SDK: `hasil.gov.my/en/e-invoice/reference-for-the-implementation-of-e-invoice/e-invoice-software-development-kit-sdk/`

Secondary:
- Crowe Malaysia, personal income tax relief YA 2025 (16 Dec 2025)
- The Star, "Receipts valid for tax relief" (13 May 2026)
- Bernama (9 May 2026 and 23 Jun 2026), e-Invoice relief pre-fill
- RinggitPlus, income tax relief YA 2025 (10 Mar 2026)
- QuickHR, tax relief 2025 guide (14 Nov 2025)
- ClearTax, consolidated e-invoicing Malaysia (20 Apr 2026)
- landco.my personal tax relief 2025; htlca.my tax audit penalties; dylanchong.com record
  keeping duty; denpyo.com 7-year record keeping; blog.fincrew.my LHDN audit without receipts

Product / competitive:
- receiptlah.com.my, claimlah.com, asprise.com receipt OCR (Malaysia page),
  github.com/deadboy18/myinvois-docs (community MyInvois documentation)
