# Trips usability study protocol

Status: protocol for execution
Date: 2026-09-06
Source: [`2026-09-06-optional-categories-trips-and-ask-pip-prd.md`](./2026-09-06-optional-categories-trips-and-ask-pip-prd.md), Section 6.1

## 1. Purpose and the decision it feeds

Trips did not come from a user request. It surfaced during a founder discussion about categories, as a hypothesis: "a meal can count toward Food and a Singapore trip report while remaining one expense overall." The PRD records this explicitly as an **unvalidated idea** (Section 2.1) and states that "Later Trips/Ask Pip implementation is conditional, not implicitly approved by this document" (Section 9).

This protocol is how that condition gets checked. It exists to find out whether the need is real before more is committed to it — not to produce a study that confirms a decision already made. If the sessions show people cannot articulate what the trip total is for, or that they are already satisfied filtering by date, that is a valid and useful result. Section 9 of this document names what a "don't build this" answer looks like, in advance, so a negative result cannot be waved away after the fact.

**Honest framing.** The scope decision recorded alongside this protocol (see the Stage C sequencing note in the implementation plan) is to build the Trips MVP in parallel with running this study, ahead of its evidence gate, as a deliberate choice by the human partner. This document does not pretend to be a gate on work that has not started — it is not. What it can still do: shape the flow before wider release, catch confusions the founder hypothesis did not anticipate, and produce a revise-or-defer call if the evidence points that way. A protocol that claimed to block work already underway would be dishonest about its own leverage; this one says plainly what it can and cannot stop.

The gate in Section 8 and the falsification criteria in Section 9 apply to release decisions from this point forward — whether Trips ships broadly, stays behind a flag, or gets reworked — not to whether the initial build happens at all.

## 2. Recruitment

### 2.1 Target sample

Approximately 5 participants, matching Pip's existing audience: young Malaysian professionals who track personal spending without maintaining a complicated ledger.

All participants must have taken a trip (domestic or international) in the last 6 months. At least 2 of the 5 must already use an expense-tracking app or spreadsheet of some kind (Pip or otherwise) — this subgroup is the one most likely to already have an answer to "how did you work this out," and their answer is the one most worth listening to closely.

### 2.2 Screener questions

Ask these before scheduling a session:

1. Have you taken a trip (more than one night away, for leisure or work) in the last 6 months?
2. Roughly when was that trip, and how long was it?
3. Did you spend money on that trip using a mix of cash, cards, or e-wallets — not a single company-issued travel card?
4. Do you currently use an app or spreadsheet to track your everyday spending? If yes, which one?
5. After that trip, did you ever try to work out what it cost you in total? (Yes/no — do not ask *how* yet; that is the pre-task interview.)
6. Are you comfortable using either your own real spending records or a fictionalized set of numbers during a recorded session, and having your responses used internally to inform product decisions?

### 2.3 Exclusion criteria

- No trip in the last 6 months.
- Trip was fully paid by an employer or a single third party with no personal spending involved (nothing to reconstruct).
- Under 18.
- Employee or contractor of the team building Pip, or immediate family of one (too close to the hypothesis to give an untainted reaction).
- Unwilling to be recorded or to have session notes retained per Section 10.

### 2.4 Consent language

Read or send this before the session, and obtain explicit yes/no before starting:

> "Thank you for helping with this session. We're researching whether a feature idea for Pip — grouping expenses by trip — is worth building. This is not a test of you; there are no wrong answers, and if something is confusing that is useful information for us, not a failure on your part.
>
> The session will take about 30–45 minutes. We'll first ask a few questions about how you currently think about trip spending, then walk through some tasks in a prototype.
>
> You can use your own real transaction records during the session, or you can use made-up numbers if you'd rather not share real financial details — either is fine, and it will not change how we run the session. Please tell us at the start which one you're doing.
>
> We will take written notes and, with your permission, an audio or screen recording for internal review only. Nothing you share will be published externally, used for marketing, or connected to your name outside the immediate product team. You can stop at any time, skip any question, and withdraw your data by telling us within one week of the session — after that we may have already summarized it into aggregate notes.
>
> Participation is voluntary and unpaid/paid-as-agreed [fill in locally]. Do you consent to proceed on these terms?"

Record the participant's answer to "own records or fictionalized" on the observation sheet (Section 7) — it affects how literally to take specific amounts they mention, but not how the task performance is scored.

## 3. Pre-task interview

Ask these questions **before showing the participant anything** — no prototype, no screenshots, no description of the Trips feature. Showing the feature first contaminates the answer: a participant who has just seen a "trip total" screen will describe wanting one, whether or not they ever wanted one before.

Record answers verbatim (write down what they say, not a paraphrase or your interpretation).

1. "Thinking about your most recent trip — did you ever work out roughly what it cost you in total?"
2. If yes: "Walk me through exactly how you did that. What did you look at, what did you add up, what tools did you use?"
3. If no: "What stopped you, or why didn't that come up?"
4. "What did you do with that number once you had it — or what would you have used it for if you'd worked it out?" (Probe for a real downstream decision: splitting costs with someone, deciding whether to take a similar trip again, reporting an expense claim, just curiosity. "Nothing, I was just curious" is a valid and important answer — write it down as given.)
5. "Since that trip, have you ever gone looking for that number again — checked your bank app, your tracker, anything — to answer a specific question?"
6. "If you use an expense tracker already: does it have anything like tags, labels, or a 'trip' concept? Have you used it? What happened?"

Do not lead with "would you like a feature that groups your trip expenses" — that question belongs nowhere in this interview. The goal is to find out whether the need already exists in some form, not to ask if a described feature sounds nice.

## 4. Fixture ledger

Use the same fixture across all participants so runs are comparable. Present it as a pre-loaded set of transactions in the prototype (or as printed/mocked entries if the prototype is not interactive enough to seed data). Frame: a 4-day trip to Singapore, 12–15 September 2026, for the fictional "Alex."

| # | Date | Merchant | Amount | Currency | Category (pre-set) | Purpose in the fixture |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-09-01 | Agoda — Marina View Hotel | 620.00 | MYR | Rental | Accommodation booked before departure. Probes whether participants correctly include a pre-trip booking dated *before* the trip window — a naive date-range filter would exclude it. |
| 2 | 2026-09-13 | Din Tai Fung (Singapore) | 58.40 | SGD | Food | A normal in-trip meal in a foreign currency. Probes basic mixed-currency comprehension and whether the participant notices the currency at all. |
| 3 | 2026-09-13 | Grab (split with Wei Ling) | 14.00 | SGD | Transport | Split bill — Alex's personal share only, already netted. Probes whether the participant understands the total reflects their own share, not the full bill, and doesn't try to "correct" it. |
| 4 | 2026-09-14 | Maybank — car insurance renewal | 480.00 | MYR | Insurance | Unrelated payment that happens to fall inside the trip date window but has nothing to do with the trip. Probes whether the participant assumes "everything dated during the trip belongs to the trip" — this transaction should be excluded, and if a participant tries to attach it, that's a direct signal of date/membership conflation. |
| 5 | 2026-09-14 | NTUC FairPrice | 22.50 | SGD | Food | A second, smaller Food entry so the Food-spending-within-trip inspection task (Section 5c) has more than one line to look at. |
| 6 | 2026-08-20 (pre-existing, outside trip window) | Tesco | 95.00 | MYR | Food | A same-category, same-currency distractor recorded weeks before the trip. Probes whether the participant can tell it apart from in-trip Food spending when searching for expenses to attach. |

All six rows exist in the participant's transaction history before the session starts, already categorized (none pre-assigned to a trip). None should require the participant to create a new category — categorization is out of scope for this study.

## 5. Task script

Run tasks in this order for every participant. Introduce the prototype only after the pre-task interview (Section 3) is complete.

| Task | Instruction given to participant | What it probes |
| --- | --- | --- |
| Control | "Record a MYR 15 lunch at a coffee shop today, no trip involved." | Baseline: friction added to the ordinary recording path by the mere existence of Trips. Run this **first**, before the participant has seen the Trips feature at all, so it measures the unmodified normal path. |
| (a) | "Create a trip for the Singapore visit you just told us about." (Or: "for the fixture trip we've loaded," if using fixed dates.) | Whether trip creation is discoverable and whether required fields (name; dates optional) are clear. |
| (b) | "Add the existing expenses that belong to this trip." | The central grouping task. Do they find and attach rows 1, 2, 3, 5? Do they correctly leave out row 4 (unrelated, in-window) and row 6 (Food, out-of-window)? |
| (c) | "Now show me how much was spent on Food during this trip." | Whether trip + category can be inspected together, and whether the participant can find this without help. |
| (d) | "You're still on the trip. Add a new expense that happened today." | Whether adding while a trip is active is distinct from attaching a past expense, and whether the trip context carries over correctly. |
| (e) | "A few weeks have passed and the trip is over. Find that trip again and check what it cost in total." | Whether a completed/archived trip stays findable, and whether the total is legible without re-deriving it. |

Tasks (a)–(e) test the feature. The control task tests its absence — run it before task (a) so the participant has not yet seen Trips and cannot be primed to notice or avoid friction. If schedule allows, repeat a second ordinary-expense recording after task (e) to check whether exposure to Trips has changed how the participant now approaches routine entry (added caution, added steps, or no change).

## 6. Facilitation rules

The facilitator's job is to observe unaided use, not to make the participant succeed.

**What counts as a hint** (avoid unless intervening per below): naming a screen, button, or menu the participant hasn't found; confirming that a candidate action is the right one before they've committed to it; explaining what a term or icon means. Restating the task instruction in different words is not a hint and is allowed once.

**When to intervene:**
- The participant is silent and visibly stuck for more than ~45 seconds: prompt with "What are you thinking / what would you try next?" — not a suggestion, just a request for their reasoning.
- The participant explicitly asks for help: give the minimum needed to move forward (e.g., "there's a menu near the top" rather than "tap the icon on the top right"), and mark the task as facilitated.
- The participant is about to do something destructive to the fixture data unrelated to what's being tested (e.g., deleting a transaction instead of attaching it): stop them, note it as a wrong selection, and redirect.
- A task is taking materially longer than the others with no sign of progress (rule of thumb: 3+ minutes with repeated failed attempts): offer to move on rather than let one task consume the whole session. Mark it as not completed unaided.

**How to record a failure without rescuing it:** the moment any hint is given, mark that task "facilitated" on the observation sheet regardless of whether the participant then succeeds — a task completed only after a hint is not "completed unaided," and there is no partial credit. Let the participant reach a wrong or dead-end state on their own before intervening; the wrong path they take is itself data (record it verbatim in the confusion column). Never say "no, try again" as a bare correction — if intervening, ask what they expected to happen first, then give the minimal hint.

## 7. Observation sheet

One row per task, per participant. Fill in during the session, not from memory afterward.

| Participant | Task | Completed unaided (Y/N) | Facilitated? (Y/N + what was given) | Wrong selections made (what they clicked/tried instead) | Time to complete (start → end, mm:ss) | Verbatim confusion (quote) | Conflated trip with category? (Y/N) | Conflated trip with date filter? (Y/N) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | Control | | | | | | n/a | n/a |
| | (a) create trip | | | | | | | |
| | (b) attach expenses | | | | | | | |
| | (c) inspect Food-in-trip | | | | | | | |
| | (d) add during trip | | | | | | | |
| | (e) find completed trip | | | | | | | |

Notes column (free text, one per participant): pre-task interview summary of "what decision does this number feed" (Section 3, question 4); whether they used real or fictionalized records; anything said unprompted about wanting or not wanting this feature.

The two conflation columns exist specifically because the spec calls out this failure mode: a participant who reaches for a date range and is satisfied, or who treats "trip" as if it were another spending category, has told us something important about task (b) and (c) in particular — mark it there even if the participant does eventually complete the task.

## 8. The gate

Proceed to a limited pilot (wider internal rollout beyond this study) only if **both** of the following hold:

1. Multiple participants — not just one — **independently** describe a real unmet need in the pre-task interview (Section 3), before seeing the feature. "Independently" means the need surfaces in more than one participant's own words, not that participants agree with each other after the fact or after seeing the prototype.
2. At least 4 of 5 participants complete task (b), the central grouping-and-inspection task (attach existing expenses, then read back Food spending within the trip), **without facilitation**.

Both conditions are required. A group that loves the idea but cannot use it unaided is not a pass; a group that uses it fine but cannot say why they'd want it is not a pass either.

**This is a practical pilot criterion, not statistical evidence of demand.** Five participants cannot establish market demand for a feature, and this document does not claim otherwise. Passing the gate means: this is worth showing to more people in a controlled pilot, and the flow is not obviously broken. It does not mean the feature is validated, popular, or worth building further investment into beyond that pilot. Any summary of these results to stakeholders should repeat this distinction rather than round it up to "users want this."

## 9. What would falsify the idea

These observations, if they show up, should stop the work rather than be explained away:

- Two or more participants cannot articulate any decision the trip total feeds — not "I was just curious," but genuinely nothing changes based on knowing the number. Curiosity alone recorded consistently across participants is a weak signal but not disqualifying by itself; the disqualifying pattern is participants visibly struggling to name any use for the number at all, even when prompted.
- A participant, when asked how they currently work out trip cost, reaches for a plain date-range filter on their existing tracker or bank statement, is satisfied with that answer, and cannot articulate what a trip-scoped view would add over it.
- Participants repeatedly conflate trip membership with a spending category (treating "Singapore" as if it were a Food/Transport-style category) or with a date filter, and the confusion persists after one clarifying attempt — this suggests the mental model doesn't match how people already think about their spending, not that the UI copy needs a tweak.
- The control task (ordinary expense entry) shows measurably added friction or hesitation compared to a baseline understanding of the current flow, even though nothing about the ordinary path should have changed — this signals the feature is intruding on the core loop the spec explicitly protects (Section 9 risk: "Trips becomes a travel product").
- Fewer than 2 of 5 participants complete task (b) unaided, regardless of what they say they want — a need that real users cannot act on through this design is not evidence for this design.

If any of these show up, the honest conclusion is "defer or substantially rework," not "run one more round with clearer instructions." Record the finding plainly in the session summary; do not treat the gate in Section 8 as something to keep re-attempting until it passes.

## 10. Ethics and data handling

- **Voluntary participation.** No participant is required to complete the session; they may stop or skip any task or question at any point without needing to justify it.
- **Informed consent.** Use the language in Section 2.4 verbatim or materially equivalent, obtained before the session starts and recorded (a note of "consented, [date]" is sufficient — no signature required for this internal study).
- **No remote analytics.** This study runs on a local or facilitated prototype with a human observer taking notes. No telemetry, crash reporting, or usage analytics SDK is added to any build used for this study.
- **No collection of transaction contents beyond what the participant volunteers.** If a participant chooses to use real transaction data during the session, only what they say aloud or visibly enter into the prototype is recorded in notes — do not ask to see their bank app, statements, or any record outside the session itself. Participants using fictionalized records satisfy the same tasks without exposing real financial details, and this option must be offered, not just tolerated if requested.
- **Recording and retention.** Audio/screen recordings (if consented to) and written notes are for internal product review only, retained only as long as needed to write up the study findings, and not shared outside the immediate product team. Participants may request deletion of their session data within one week of the session.
- **No compensation contingent on outcome.** If participants are compensated, compensation is for time and is not contingent on completing tasks successfully or expressing a particular opinion.
