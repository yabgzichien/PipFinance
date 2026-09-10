# Monthly recap implementation

Approved direction: a personal, scrollable review with a compact money summary, spending independent of budgets, useful recorded-data comparisons, and quieter tools. Keep Pip's existing palette, type primitives, English/Chinese copy, display currency, and native affordances. Wrapped sharing remains future work. Do not run an Android emulator.

- [x] Add tested recap presentation data: transaction counts, category totals, native-aware display conversion, and comparisons restricted to completed calendar months with recorded expenses in both periods.
- [x] Replace the statement hero and duplicate controls with a personal opening, compact financial summary, tappable spending rows, optional comparisons/trips, tracking feedback, expandable budget/net-worth details, and labeled calendar/export actions. Include empty, income-only, sparse, and current-month states.
- [x] Add a month-scoped transaction sheet and preserve month selection across navigation. Wire the empty-state Add action back to recap.
- [x] Add a restrained Home entry for the previous calendar month's recorded activity, opening that exact month.
- [x] Verify behavior with focused Jest tests, TypeScript, existing type/contrast audits, a web build, and bounded browser inspection if available. Preserve unrelated app/package edits.


Verification: 95 focused Jest tests passed (recap calculations, screen interactions, Home entry, existing navigation, trips and transfers); TypeScript passed; production web export passed. Browser checked the empty state, Add → save → recap return, the RM33/no-income/no-budget case, the category sheet, and the final 320px phone layout. No Android emulator was used.

The recap's 126 text/background combinations across seven accent presets and light/dark themes passed WCAG AA. Impeccable's mechanical detector reported no findings. RecapScreen now uses the shared type/spacing primitives and was removed from the type audit's legacy allowlist. The global type audit still reports the same 148 unrelated violations. The global contrast audit cannot run because it references missing sibling PipComp/LenderConsole paths; those scripts and unrelated screens were not repaired in this task.

## Minimalist refinement — September 10

At the user's request, removed the greeting/observation paragraphs, the progress card, repeated category percentages/counts, and tool descriptions. The main view now leads with one recorded total and a small Pip, followed by category amounts/bars. Income-only months lead with recorded income; expense-only months retain the missing-income label while cash flow moves under Details. The Details disclosure retains transaction context, native currencies, merchant memory, budgets and net worth. Calendar and Export are compact labeled actions. Preserved the newer Trips-before-spending order and all transaction drill-downs.

Validation: 39 focused tests passed, including a new disclosure regression test; production web export passed; 126 theme text/background pairs passed. Browser checked the sparse-data view, Details interaction, and narrow phone layout. No emulator used.
