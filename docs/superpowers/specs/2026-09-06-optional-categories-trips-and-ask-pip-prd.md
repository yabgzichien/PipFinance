# Pip: Optional Categories, Trips, and Ask Pip

**Product requirements document and design specification**  
**Date:** 6 September 2026  
**Status:** Proposed specification for review; application changes are not implemented  
**Priority:** Optional categories first; validate Trips; defer Ask Pip

## 1. Decision summary

Help users choose the spending detail they find useful without making everyday recording harder.

The next release should provide ready-made optional categories, dependable category customization, and a reversible way to hide categories from new-entry choices. Keep a short starting list. Users add individual categories when needed; adding a category does not require setting a budget.

The first optional catalogue should cover Car & transport and Food & drinks. The car request comes from actual user feedback. The food suggestions are a product hypothesis to check before release. Neither group becomes enabled automatically.

Trips should first undergo a small usability and demand study. If validated, implement an optional grouping of existing expenses, accessible from Activity. A transaction retains its spending category and can also belong to a trip.

Ask Pip remains a later experiment. Basic totals and filters must work well without conversation. If evidence eventually supports natural-language queries, give a brief verified answer with a link to matching records; navigate directly when the user explicitly asks to open or show a view.

## 2. PRD

### 2.1 Problem and evidence

A user requested separate Petrol, Car Maintenance, and Parking & Tolls categories because they want to monitor these expenses individually. Pip currently combines these under Travelling.

Other users may prefer broad categories. Increasing the active default list for everyone would satisfy one preference while adding choices for people who do not need them.

Evidence available from the founder interview:

- **Observed request:** A user wants separate monitoring of three car expense types.
- **Founder preference:** Preserve a simple experience while allowing more detail.
- **Agreed concept:** A meal can count toward Food and a Singapore trip report while remaining one expense overall.
- **Unvalidated idea:** Trip totals emerged during this discussion, not from a reported user request.
- **Unvalidated idea:** An LLM interface for querying spending and opening relevant screens.

There are no usage measurements or adoption estimates behind this specification. Competitor patterns support feasibility, not demand among Pip users.

### 2.2 Audience

Use Pip's existing positioning: young Malaysian professionals who want to understand spending without maintaining a complicated ledger.

Support preferences within the same person. Someone may want detailed car costs and broad Food spending. Do not assume every user belongs permanently to a simple or advanced mode.

### 2.3 Jobs to be done

1. As a driver, I can monitor petrol, maintenance, and parking/tolls separately.
2. As a user who prefers simplicity, I can keep broad categories and record expenses quickly.
3. As a user whose needs change, I can add or hide categories without rewriting my spending history.
4. As a food-conscious user, I can separate groceries from eating out if useful.
5. As a possible future trip user, I can see recorded spending for one holiday across normal categories.
6. As a possible future Ask Pip user, I can express a supported spending question and inspect the records behind the answer.

### 2.4 Goals

- Make requested car categories available without requiring users to invent labels and icons.
- Keep the initial expense list short and understandable.
- Make visibility, naming, and icon preferences persist across restarts and restores.
- Preserve transaction history, balances, and budget meaning during customization.
- Validate Trips and conversational reporting before committing to their implementation.

### 2.5 Scope and priority

| Stage | Deliverable | Commitment |
| --- | --- | --- |
| A | Optional category catalogue, visibility, customization persistence, history protection | Recommended next implementation |
| B | Trips concept and usability study | Recommended discovery work |
| C | Lightweight Trips implementation | Conditional on Stage B evidence |
| D | Ask Pip query prototype | Deferred until reporting needs justify it |

Stage A excludes a category hierarchy, automatic historical recategorization, an additional onboarding questionnaire, and automatic activation of optional categories. Stages C and D are described to guide later decisions; their inclusion here does not make them release requirements.

### 2.6 Success criteria

For Stage A, verify that a user can find and add Petrol without typing a category name, record an expense in it, and inspect its total. A user who adds nothing should encounter the same number of active choices as before, apart from the clarified Transport label on fresh installs.

In a small usability pilot, observe completion of adding a suggested category, recording an expense, hiding it, and finding its historical spending. Record wrong selections, confusion, completion time, and whether facilitation was needed. Compare ordinary expense entry with the current experience; do not invent a performance improvement target before measuring a baseline.

Correctness gates are absolute: no changed historical totals from adding/hiding categories; no duplicate activation; no lost customization after restart or supported backup restore.

Use voluntary interviews or consented measurement. This work does not require adding remote analytics or collecting transaction contents.

## 3. Category product design

### 3.1 Three separate concepts

- **Starter categories:** Available immediately on a fresh installation.
- **Suggested categories:** Supplied by Pip in a catalogue, instantiated only when selected.
- **Custom categories:** Named and configured by the user.

An instantiated category may be visible or hidden from new-entry choices. Catalogue membership, visibility, and budget allocation are independent.

### 3.2 Starter list

For fresh installations, retain the current eight expense concepts: Food, Shopping, Entertainment, Other Expenses, Transport, Insurance, Rental, and Phone Bill. Use **Transport** as the clearer display label for the existing `travelling` identity; do not create a new `transport` ID or remap transactions just to change wording.

Keep Salary, Allowance, and Other Income as the income starters.

For existing installations, preserve stored categories, customizations, visibility, and history. A one-time upgrade may leave the existing Travelling display name in place; users can rename it. Do not silently reinterpret historical holidays as car spending or rebuild their list.

This is a conservative first release, not a claim that the current starter taxonomy is optimal. In particular, Phone Bill is narrower than several other defaults, and Healthcare and Utilities lack dedicated starters. Evaluate broader label changes separately with users.

### 3.3 Initial optional catalogue

| Catalogue group | Category | Description shown when choosing it | Evidence |
| --- | --- | --- | --- |
| Car & transport | Petrol | Fuel for your vehicle | Requested |
| Car & transport | Car Maintenance | Servicing, repairs, tyres, and parts | Requested |
| Car & transport | Parking & Tolls | Parking charges and road tolls | Requested |
| Food & drinks | Groceries | Food and ingredients bought for home | Proposed |
| Food & drinks | Eating Out | Restaurant, takeaway, and delivered meals | Proposed |
| Food & drinks | Coffee & Snacks | Drinks and small treats tracked separately | Proposed |

The catalogue has six entries, with all six off until selected. Groups organize the catalogue only. They do not become selectable expense categories, parent totals, or budget envelopes.

Users can add one category or several. Adding all three car options is a convenience, not a required preset. Optional categories have the same report and budget capabilities as existing categories.

Food overlaps need an explicit, consistent convention. If Coffee & Snacks is enabled, use it for purchases primarily consisting of drinks or snacks; a full cafe meal can remain Eating Out. Provide examples in the catalogue and respect user corrections. Do not promise item-level classification of mixed supermarket receipts.

The broad Food and Transport categories remain available for spending users have not separated further. Historical broad-category records remain broad. Catalogue activation neither creates a parent total nor backfills detail that was never recorded.

### 3.4 Other spending areas that could benefit

These are candidate additions to the optional library, not extra active defaults and not Stage A requirements.

| Area | Potential options | Reason to consider | Constraint |
| --- | --- | --- | --- |
| Bills & home | Utilities; Internet | Separates common household bills from miscellaneous spending | Phone Bill already exists; do not duplicate it. Split electricity/water only with demand. |
| Health | Healthcare; Dental; Fitness | Helps people monitor distinct health-related costs | Start with broad Healthcare if tested; distinguish care from Insurance and ordinary shopping. |
| Shopping | Clothing; Electronics; Personal Care | Makes a broad discretionary total more actionable | Do not overlap Personal Care with a second health catalogue entry. |
| Family & pets | Childcare; Education; Pet Care | Relevant recurring costs for particular households | Offer only on demand; unsuitable as universal starters. |
| Giving | Gifts; Donations; Family Support | Tracks distinct obligations and choices | Family Support must mean money given, not transfers between the user's own accounts. |
| Transport beyond cars | Public Transport; Ride-hailing | Supports users who want detail without owning a vehicle | Broad Transport is sufficient until there is a reason to separate these. |

Food is the strongest adjacent candidate because groceries and eating out serve recognizably different monitoring goals. Bills and Healthcare are also worth testing, but they partly address gaps in coverage rather than a need for more granularity. Admit new suggestions when users can describe a distinct monitoring decision, select them consistently, and benefit more than they pay in additional choice.

Avoid payment-method categories such as Cash, Credit Card, or Touch 'n Go; payment source is separate from spending purpose. Subscriptions, holidays, and BNPL also cross spending categories. Use existing recurring-payment and account concepts where applicable instead of classifying every such payment as a new expense purpose. Do not treat repayments or transfers as expenses merely because a category name is convenient.

## 4. Category UX requirements

### 4.1 Add suggested categories

Primary route: **Settings → Categories → Add category**.

The add surface offers **Suggested** and **Create your own**. Existing New category actions in transaction entry can open the same surface, preserving the unfinished expense draft.

Suggested entries show a name, icon, concise explanation, and selection state. Use **Add 2 categories** as the confirmation label when two new entries are selected. Added entries show **Added**. Hidden entries show **Show again**, restoring the same category identity rather than creating another.

Search should match names and common local wording, including fuel/petrol, servicing/maintenance, and parking/toll. Translate supplied labels and descriptions in Pip's supported English and Chinese interfaces.

Do not add a mandatory category-preference step to onboarding. Budget setup continues to select budget allocations; make its wording clear that this does not hide other expense categories.

### 4.2 Hide and show

Place Hide in category management. Explain it as **Hide from new expenses**.

- Hide removes the category from new manual-entry choices and automatic category suggestions.
- Historical transactions, reports, existing budget allocations, and budget snapshots retain it.
- An existing transaction assigned to a hidden category displays that category and can be edited without changing it.
- Existing recurring payments retain their category and may continue creating expenses against it. Show this consequence when hiding a category used by a recurring payment; allow the user to review those payments.
- Budget management retains existing allocations for hidden categories and labels their entry visibility. Hiding does not free or redistribute budget money.
- Category management provides a Hidden section and Show again action.
- At least one visible expense category and one visible income category must remain. Explain the restriction when hiding the last visible category of a kind.

Hide is a preference, not deletion. Keep permanent deletion separate. If deleting a category with linked records, require an explicit replacement category of the same kind and describe the consequences for learning and budget allocations before confirmation. This avoids the current arbitrary fallback destination becoming the normal way to simplify a list.

### 4.3 Customization and suggestions

Renames, icon changes, and color overrides must persist and display consistently in entry, reports, category management, onboarding, and after app restart. User-entered names remain verbatim when the interface language changes.

Before creating a suggestion, match its stable template identity. For a similarly named custom category, offer to use the existing category or deliberately create a distinct one; never merge or adopt it silently.

Filter hidden categories out of LLM options and reject model responses that select them. A learned merchant mapping to a hidden category should fall through to the normal visible-category suggestion/review path without rewriting historical memory. A visible learned mapping remains authoritative even after more specific categories are added; adding Petrol does not automatically retrain past Transport decisions. Explain that corrections improve future suggestions.

No numerical budget should be created solely by adding a category. A user can monitor spending without allocating a budget.

### 4.4 Accessibility and interaction quality

Use existing category badges, typography, spacing, and sheet patterns. Provide descriptive accessibility labels and visible selected states that do not depend only on color. Maintain at least 44-by-44-point interactive targets and verify larger text, small screens, dark mode, keyboard behavior, and back navigation.

Failed saves retain selections and drafts, present a retry action, and do not create partial duplicate categories. Batch activation is atomic.

## 5. Category engineering specification

### 5.1 Existing constraints

The inspected workspace currently:

- Seeds all default categories at startup.
- Uses onboarding category selections for budget allocations, not visibility.
- Has a flat category schema with no hidden flag or hierarchy.
- Allows category edits, while startup seeding can overwrite default presentation and localization can mask edited default labels.
- Reassigns records on deletion and records deleted-default tombstones.
- Includes historical category-ID remaps, including groceries and coffee into Food.

Implementation must accommodate the current working tree rather than assume an untouched base revision.

### 5.2 Data model

Keep category IDs stable. Add metadata equivalent to:

- `is_hidden`: false by default for existing categories.
- `template_key`: nullable, unique when present; identifies a supplied starter or optional suggestion independently of its display label.
- `label_override`, `icon_override`, `hue_override`: nullable explicit presentation overrides.

Keep the existing presentation fields as the base representation. Resolve presentation through one shared helper: explicit user override first; supplied template translation/default second; stored custom-category fields otherwise. `is_default` alone must no longer determine whether a label may be customized.

Define the optional catalogue separately from `ALL_SEED_CATEGORIES`. Its entries supply template keys, translations, descriptions, and icon/color defaults. Materialize a category only on user activation. New optional categories can remain `is_default = false`; template identity, not that legacy flag, determines catalogue behavior.

Use template identities and new category IDs that cannot collide with retired category remaps. In particular, do not recreate an automatically remapped default `groceries`, `coffee`, or `transport` identity. Generate a safe ID and retain a stable template key such as `optional.food.groceries.v1`. Display names are never database identities.

### 5.3 Queries and startup

Maintain separate selectors for **all categories**, **visible entry categories**, and **categories needed by historical/budget views**. Do not globally filter hidden rows out of app state: historical labels and totals still need them.

Change startup behavior so catalogue updates cannot add optional categories or erase overrides. Preserve deleted-default tombstones, hidden states, template identities, and custom records. Reopening or upgrading the app must be idempotent.

On migration, preserve recognizable stored presentation edits as overrides using the known historical defaults and translations. Where an old edit was already overwritten, it cannot be recovered automatically. Do not fabricate recovery or overwrite an uncertain stored label merely because it differs from today's wording.

### 5.4 Backup and import

Round-trip category visibility, template identity, overrides, and deleted-default state through full backup and restore. Update explicit serializers and validators as well as the database schema. Treat older backups without these fields as visible categories with no explicit overrides, while preserving stored custom labels.

Reconcile template identity during import without silently merging distinct custom categories. Restore must not cause optional suggestions to reappear as duplicates on the next launch. Full reset intentionally returns to the starter set, with no optional categories activated.

### 5.5 Implementation touchpoints

| Area | Existing files to inspect/update |
| --- | --- |
| Types, starter data, catalogue | `src/lib/types.ts`, `src/data/categories.ts`; new optional catalogue module |
| Persistence, startup, deletion | `src/db/db.ts`, `src/db/categoriesRepo.ts` |
| Presentation and localization | `src/i18n/categories.ts`, English/Chinese translations, category badge helpers |
| Category management and adding | `src/screens/CategoriesScreen.tsx`, `src/components/AddCategoryModal.tsx` |
| Entry and editing | `src/screens/CategorizeScreen.tsx`, `src/components/EditTransactionModal.tsx`, manual/quick-add paths |
| State, merchant learning, suggestions | `src/state/store.tsx`, `src/screens/AddFlow.tsx`, category/quick-add prompt option builders |
| Budget and history | Onboarding BudgetStep, budget components, category detail, breakdown, filters |
| Backup and restore | `src/lib/backupBundle.ts`, `src/lib/financialExport.ts`, `src/db/restoreRepo.ts`, import validators |

### 5.6 Acceptance tests

1. A fresh install has eight expense starters and three income starters; no optional categories are active.
2. An existing installation retains IDs, transaction amounts, allocations, and deleted-default state after migration.
3. Adding Petrol twice, including repeated taps/retries, produces one category with one template identity.
4. Adding all car suggestions does not modify Food, historical Transport records, or budget amounts.
5. Adding Groceries does not trigger a legacy category remap on a later restart.
6. Hiding Petrol removes it from new-entry/LLM choices while preserving historical totals, existing allocations, and linked recurring payments.
7. Editing an old expense in a hidden category preserves its category unless the user changes it.
8. Hiding the last visible category of a kind is prevented; showing a category restores its original identity.
9. A hidden merchant-memory target cannot bypass visibility checks during new categorization.
10. A default rename/icon/color override survives restart, language changes, and full backup/restore.
11. Older backups restore successfully; an optional template and a similarly named custom category remain distinguishable.
12. Cancelling the catalogue leaves a partially entered transaction intact.
13. The same expense total is shown before and after category activation/hiding in the same report scope.
14. Existing permanent deletion remains safe and uses the replacement explicitly chosen by the user when linked records exist.

Run focused category/migration/backup tests and the project's typecheck during implementation. Verify the changed flows on-device or in an appropriate preview. This documentation task itself does not require running the app test suite.

## 6. Trips: validation and conditional design

### 6.1 Discovery before implementation

Recruit approximately five target users who have taken a recent trip, including people who already use an expense tracker. Ask how they currently determine trip spending and what decisions they make from that number before presenting the feature.

Use a low-fidelity flow and consenting users' selected or fictionalized records. Include a meal, accommodation booked before departure, mixed currencies, a split bill, and an unrelated payment made during the trip.

Tasks: create a trip, attach existing expenses, inspect Food spending, add an expense during the trip, and find a completed trip later. Include ordinary expense entry to detect extra friction.

Proceed to a limited implementation pilot only if multiple participants independently describe a real unmet need and can use the grouping correctly. A provisional usability gate is four of five participants completing the central grouping-and-inspection task without facilitation. This is a practical pilot criterion, not statistical evidence of market demand. Record contradictions and revise the flow if people confuse trip membership with category or date filtering.

### 6.2 Conditional MVP

Entry point: a compact **Trips** action within Activity. Keep current bottom navigation. Create a trip with a name; dates are optional. Use names such as **Singapore · September 2026** to distinguish repeat visits.

The detail screen contains an expense total, category breakdown, transaction list, Add expense, and Add existing expenses. Reuse existing visual components and transaction editing. A trip opened from Activity returns there, preserving useful context.

Put an optional Trip selector in More details. Adding from a trip prefills its identity visibly; general entry has no mandatory additional step. Existing multi-selection supports attaching records in bulk. Archiving removes a trip from routine suggestions while retaining access and allowing late corrections or charges.

Membership is explicit. Dates may help find candidate records but cannot automatically include every payment or exclude advance bookings. Do not infer that every SGD transaction belongs to Singapore or learn trip assignment permanently from a merchant.

Exclude itinerary planning, bookings, maps, group travel collaboration, dedicated trip budgets, and AI from this MVP.

### 6.3 Conditional data and totals contract

- Add `trips(id, name, created_at, archived, start_date?, end_date?)` and nullable indexed `transactions.trip_id`.
- One expense belongs to at most one trip in the initial version. Moving it between trips is an explicit edit.
- Reuse the original transaction; never duplicate it or maintain a second ledger.
- A Food expense linked to Singapore appears in both relevant views but once in overall spending.
- Include all linked expense records across dates. Preserve monthly accounting by the transaction's recorded date.
- Use the existing personal-share convention for split expenses. Repayments must not be subtracted a second time.
- Label the first implementation **Recorded expenses** if it sums expense rows only. Do not claim a net trip cost until refunds, currently potentially represented as income, have explicit linkage and netting semantics.
- Preserve original currency values and use a single consistent conversion rule for the headline, breakdown, and transaction drill-down. Never add native amounts in different currencies directly.
- Transfers do not contribute to expense totals. Removing a trip clears membership and preserves transactions; archiving is preferred.
- A later split-debt write-off associated with a trip expense must inherit the trip link.
- Include trips and membership in backup, restore, reset, editing, and supported import paths. Old records default to no trip.

Trips cannot ship until tests cover double-counting, currency consistency, advance bookings, split shares, membership changes, archives, and backup round-trips. Refund presentation must be explicit in the UI and in any later AI answer.

## 7. Ask Pip: deferred experiment

### 7.1 When to revisit

Revisit after direct reporting works and users repeatedly struggle to express useful questions through the available filters. “How much this month?” alone does not justify chat: that total belongs on the screen.

Potentially useful questions include Food spending on a named trip or spending excluding one category. Begin with a fixed supported set rather than an unrestricted financial assistant. Trip queries depend on Trips existing and records having membership.

### 7.2 Interaction contract

- **Question:** “How much did I spend this month?” → verified total, explicit month/currency/scope, and View expenses.
- **Navigation request:** “Show Food expenses for Singapore” → open the supported transaction view with trip and Food filters visible.
- **Ambiguous request:** Multiple Singapore trips or unclear dates → ask for clarification before answering/navigating.
- Returning from a drill-down preserves the conversation and selected scope.

Example amounts in prototypes must be labelled illustrative. Live answers should say **recorded spending/expenses** and provide access to supporting records. Basic reporting remains available if AI is unavailable.

### 7.3 Technical and privacy boundaries

Use the LLM to produce a constrained query request. The application validates IDs, dates, query type, and supported filters, then executes predefined read-only functions. Do not execute arbitrary model-generated SQL or routes.

One shared query specification must power both the answer card and destination screen. Amounts are calculated and rendered by application code. The model may explain validated results, but generated prose must not contradict them or invent causal explanations.

For a small experiment, use a question-to-query call and locally rendered answer. A second model call is optional only when an explanation adds value. Cloud providers receive the question and any context explicitly supplied; minimize that context and communicate the actual data flow. Do not claim the feature is entirely on-device.

Use the current LLM provider abstraction where practical. No vector database, web search, autonomous agent, or unrestricted financial-data upload is needed for the initial supported questions.

Measure task completion, correct filter interpretation, correction rate, latency, and model cost per successful question against direct navigation. Expand only when the interaction removes enough effort to justify its cost and maintenance.

## 8. Delivery sequence

1. Review this specification and the six initial optional category labels.
2. Implement visibility and presentation persistence with migration/backup coverage.
3. Add the small suggestion catalogue and shared add-category surface.
4. Verify new-entry, learning, history, budgets, localization, and restore behavior together.
5. Pilot category selection with target users and ship when acceptance criteria pass.
6. Run Trips discovery independently; record a go/revise/defer decision before implementation.
7. Revisit Ask Pip only after evidence identifies a reporting interaction it improves.

## 9. Risks and decision boundaries

| Risk | Design response |
| --- | --- |
| Optional library grows into a second overwhelming taxonomy | Start with two catalogue groups; add entries for observed needs, not completeness. |
| Users expect new detailed categories to fix old reports | Preserve old records and explain that detail starts with newly categorized expenses. |
| Hidden categories make money disappear | Filter new-entry choices, not financial history or existing budget totals. |
| Template changes overwrite personal choices | Stable identity and explicit overrides; idempotent seed behavior. |
| Food options are interpreted inconsistently | Clear examples, user correction, and a pilot before expanding granularity. |
| Trips becomes a travel product | Keep its job limited to grouping and inspecting recorded expenses. |
| Chat disguises difficult navigation | Improve visible totals and filters first; compare task performance before expanding AI. |

No further founder input is required to understand the proposed Stage A behavior. Category wording and the decision to implement remain reviewable. Later Trips/Ask Pip implementation is conditional, not implicitly approved by this document.

## 10. Sources and grounding

Research consulted during this discussion; reviewed 6 September 2026. These sources describe patterns and capabilities, not evidence that Pip users want a feature.

- [YNAB: How Many YNAB Categories Should I Have?](https://www.ynab.com/blog/how-many-ynab-categories) — start with fewer categories and add detail as it becomes useful.
- [Monarch: Default Categories](https://help.monarch.com/hc/en-us/articles/360048883851-Default-Categories) — supplied categories can be personalized and disabled.
- [Wallet: Categories and Subcategories](https://support.budgetbakers.com/hc/en-us/articles/7077082048146-All-about-Categories-and-Subcategories) — an alternative structured taxonomy with visibility controls; not the proposed Pip architecture.
- [Nielsen Norman Group: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) — expose common options first and make additional options discoverable.
- [Monarch: Organizing Transactions with Tags](https://help.monarch.com/hc/en-us/articles/4409690120596-Organizing-Transactions-with-Tags) — cross-category grouping as a separate dimension.
- [Monarch: Using Reports](https://help.monarch.com/hc/en-us/articles/21846787088916-Using-Reports) — vacation-tag reporting as a precedent for trip breakdowns.
- [Google: Function Calling](https://ai.google.dev/gemini-api/docs/function-calling) — model-requested operations executed by application code.

Local grounding: `docs/business-plan.md`; `src/data/categories.ts`; `src/db/db.ts`; `src/db/categoriesRepo.ts`; `src/i18n/categories.ts`; `src/screens/onboarding/BudgetStep.tsx`; `src/screens/AllTransactionsScreen.tsx`; `src/screens/BreakdownScreen.tsx`; `src/lib/types.ts`; `src/lib/backupBundle.ts`; `src/db/restoreRepo.ts`; and `src/llm/types.ts`.
