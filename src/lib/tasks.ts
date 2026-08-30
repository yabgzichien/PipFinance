// src/lib/tasks.ts
// The "explore the app" checklist surfaced by tapping the Home mascot. Each entry is a
// feature worth trying at least once; completion is sticky (see store.tsx's markTaskDone) so
// a task never un-checks itself once its condition has been met one time.
import type { IconName } from '../components/Icon';
import type { Screen } from './screenNav';
import type { Translations } from '../i18n/types';

export type ExploreTaskId =
  | 'breakdown'
  | 'account'
  | 'currency'
  | 'export'
  | 'recurringBill'
  | 'budget'
  | 'streak'
  | 'recap'
  | 'quickAdd';

export interface ExploreTask {
  id: ExploreTaskId;
  titleKey: keyof Translations;
  descriptionKey: keyof Translations;
  icon: IconName;
  /** Anchor ID for guided spotlight on Home screen / navigation. */
  anchorId: string;
  /** App.tsx screen destination (kept for reference / tests). */
  screen: Screen | null;
}

export const EXPLORE_TASKS: ExploreTask[] = [
  { id: 'breakdown', titleKey: 'exploreTaskBreakdownTitle', descriptionKey: 'exploreTaskBreakdownDesc', icon: 'chart', anchorId: 'tour_breakdown_card', screen: 'breakdown' },
  { id: 'account', titleKey: 'exploreTaskAccountTitle', descriptionKey: 'exploreTaskAccountDesc', icon: 'scale', anchorId: 'tour_networth_tab', screen: 'networth' },
  { id: 'currency', titleKey: 'exploreTaskCurrencyTitle', descriptionKey: 'exploreTaskCurrencyDesc', icon: 'sliders', anchorId: 'tour_settings_tab', screen: 'currencySettings' },
  { id: 'export', titleKey: 'exploreTaskExportTitle', descriptionKey: 'exploreTaskExportDesc', icon: 'download', anchorId: 'tour_settings_tab', screen: 'export' },
  { id: 'recurringBill', titleKey: 'exploreTaskRecurringTitle', descriptionKey: 'exploreTaskRecurringDesc', icon: 'clock', anchorId: 'tour_settings_tab', screen: 'commitments' },
  { id: 'budget', titleKey: 'exploreTaskBudgetTitle', descriptionKey: 'exploreTaskBudgetDesc', icon: 'percent', anchorId: 'tour_budget_card', screen: 'budget' },
  { id: 'streak', titleKey: 'exploreTaskStreakTitle', descriptionKey: 'exploreTaskStreakDesc', icon: 'trending', anchorId: 'tour_plus_btn', screen: null },
  { id: 'recap', titleKey: 'exploreTaskRecapTitle', descriptionKey: 'exploreTaskRecapDesc', icon: 'book', anchorId: 'tour_recap_btn', screen: 'recap' },
  { id: 'quickAdd', titleKey: 'exploreTaskQuickAddTitle', descriptionKey: 'exploreTaskQuickAddDesc', icon: 'sparkles', anchorId: 'tour_plus_btn', screen: null },
];

export interface ExploreTaskStatus {
  completedCount: number;
  totalCount: number;
  pendingCount: number;
  allDone: boolean;
}

/** Pure so it's cheap to unit test in isolation, mirroring computeTutorialStatus. */
export function computeExploreTaskStatus(tasksDone: readonly string[]): ExploreTaskStatus {
  const done = new Set(tasksDone);
  const completedCount = EXPLORE_TASKS.reduce((n, task) => (done.has(task.id) ? n + 1 : n), 0);
  const totalCount = EXPLORE_TASKS.length;
  return {
    completedCount,
    totalCount,
    pendingCount: totalCount - completedCount,
    allDone: completedCount === totalCount,
  };
}
