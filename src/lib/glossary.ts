export interface GlossaryEntry {
  term: string;
  short: string;
  body: string;
}

/** Glossary content for InfoButton/GlossaryModal, mirroring LenderConsole's GLOSSARY shape
 *  (LenderConsole/app/tokens.ts) so the two apps explain shared concepts consistently. */
export const GLOSSARY: Record<string, GlossaryEntry> = {
  belanjawanku: {
    term: 'Belanjawanku',
    short: "Malaysia's official reference budget: what a decent standard of living costs per month.",
    body: 'Published annually by the Social Wellbeing Research Centre at Universiti Malaya together with the EPF, with a separate figure for each household type in twelve cities. Pip compares your spending against this published figure instead of a number the app made up. The essential categories are a minimum, not a target, so spending above them only matters when the category is discretionary.',
  },
  pay_yourself_first: {
    term: 'Pay yourself first',
    short: 'Set aside savings the moment income arrives, before spending on anything else.',
    body: "The habit this app tracks: keep a fixed amount back each month, ideally as soon as you get paid. Belanjawanku's own recommendation is a starting point, but the target is yours to set and raise.",
  },
  safe_income: {
    term: 'Safe monthly income',
    short: 'A conservative floor to budget against when your earnings swing month to month.',
    body: 'Taken from the lower end of your recent months, not the average, because a budget built on the average fails in every month you earn less than that. Planning against the floor turns a good month into savings instead of turning a bad month into a shortfall.',
  },
  net_cash_flow: {
    term: 'Net cash flow',
    short: 'What is left after expenses are subtracted from income, over a period.',
    body: 'A positive number means you are taking in more than you spend. Watching this trend over time matters more than any single month.',
  },
  where_it_goes: {
    term: 'Spending breakdown',
    short: 'How your spending splits across categories.',
    body: 'Grouping transactions by category (food, transport, bills, etc.) makes it easier to spot where a budget is being overspent, and feeds the category-level detail on the Budget screen.',
  },
  net_worth: {
    term: 'Net worth',
    short: 'Everything you own minus everything you owe.',
    body: 'Assets (cash, savings, investments) minus liabilities (loans, credit cards). Watching it rise over time is a clearer picture of financial health than any single month of cash flow.',
  },
  unallocated: {
    term: 'Unallocated',
    short: 'Income you have not yet assigned to a budget category.',
    body: 'Money sitting here is not tracked against any spending limit. Allocating it to a category (including savings) is what makes the budget reflect your actual plan.',
  },
  holdings: {
    term: 'Holdings',
    short: 'The individual assets (accounts, investments, or lots) that make up your net worth.',
    body: 'Net worth is the sum of what you own (holdings) minus what you owe. Tracking holdings individually lets you see which ones are growing or shrinking your overall position.',
  },
  income_floor: {
    term: 'Income floor',
    short: 'The monthly income that held up, rather than the one an average implies.',
    body: 'Your monthly income totals are ranked and a low one is taken as the floor, so it is a level you actually reached in most months rather than a midpoint between good and bad ones. An average can be dragged around by a single unusual month; the floor is what you can rely on being there.',
  },
  committed_spend: {
    term: 'Committed, essential & flexible',
    short: 'Three tiers of spending, ordered by how much choice you have over each one.',
    body:
      'Committed: recurring outflows at a steady amount, like rent or an instalment. Fixed; cannot be cut this month.\n\n' +
      'Essential: necessary spending that still moves, like food or fuel. Can compress, but never disappears.\n\n' +
      'Flexible: everything else. The part you could genuinely redirect if a month came in weak.',
  },
};
