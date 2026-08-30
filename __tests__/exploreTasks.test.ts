import { en } from '../src/i18n/translations/en';
import { zh } from '../src/i18n/translations/zh';
import { translate } from '../src/i18n/LanguageContext';
import { EXPLORE_TASKS, computeExploreTaskStatus } from '../src/lib/tasks';

describe('exploreTasks', () => {
  describe('Explore Task Status Logic', () => {
    it('starts with 0 completed and every task pending', () => {
      const status = computeExploreTaskStatus([]);
      expect(status.completedCount).toBe(0);
      expect(status.totalCount).toBe(EXPLORE_TASKS.length);
      expect(status.pendingCount).toBe(EXPLORE_TASKS.length);
      expect(status.allDone).toBe(false);
    });

    it('counts a single completed task', () => {
      const status = computeExploreTaskStatus(['streak']);
      expect(status.completedCount).toBe(1);
      expect(status.pendingCount).toBe(EXPLORE_TASKS.length - 1);
      expect(status.allDone).toBe(false);
    });

    it('is unaffected by duplicate or unknown ids', () => {
      const status = computeExploreTaskStatus(['streak', 'streak', 'not_a_real_task']);
      expect(status.completedCount).toBe(1);
    });

    it('marks allDone once every task id is present', () => {
      const allIds = EXPLORE_TASKS.map((t) => t.id);
      const status = computeExploreTaskStatus(allIds);
      expect(status.completedCount).toBe(EXPLORE_TASKS.length);
      expect(status.pendingCount).toBe(0);
      expect(status.allDone).toBe(true);
    });

    it('never re-derives a task as pending once it is in the sticky-done list', () => {
      // Sticky-forever means completion is purely membership-based - the store never removes
      // an id from tasksDone even if the underlying signal (e.g. streak) later regresses, so
      // this pure function only needs to prove it doesn't look at anything but the list.
      const status = computeExploreTaskStatus(['budget', 'recurringBill']);
      expect(status.completedCount).toBe(2);
    });
  });

  describe('Explore Task Registry', () => {
    it('has a unique id for every task', () => {
      const ids = EXPLORE_TASKS.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('every task has a non-empty title and description in en and zh', () => {
      for (const task of EXPLORE_TASKS) {
        expect(en[task.titleKey]).toBeTruthy();
        expect(en[task.descriptionKey]).toBeTruthy();
        expect(zh[task.titleKey]).toBeTruthy();
        expect(zh[task.descriptionKey]).toBeTruthy();
      }
    });

    it('maps every task to a valid anchor ID for guiding users', () => {
      const expectedAnchors: Record<string, string> = {
        breakdown: 'tour_breakdown_card',
        account: 'tour_networth_tab',
        currency: 'tour_settings_tab',
        export: 'tour_settings_tab',
        recurringBill: 'tour_settings_tab',
        budget: 'tour_budget_card',
        streak: 'tour_plus_btn',
        recap: 'tour_recap_btn',
        quickAdd: 'tour_plus_btn',
      };
      for (const task of EXPLORE_TASKS) {
        expect(task.anchorId).toBe(expectedAnchors[task.id]);
      }
    });
  });

  describe('Explore Tasks Translation Parity', () => {
    const requiredKeys = [
      'exploreTasksSheetTitle',
      'exploreTasksSheetSub',
      'exploreTasksAllDoneTitle',
      'exploreTasksAllDoneSub',
      'exploreTasksBadgeLabel',
      'exploreGuideBadge',
      'taskCelebrationToast',
    ] as const;

    it('contains all required sheet translation keys in en and zh', () => {
      for (const key of requiredKeys) {
        expect(en[key]).toBeDefined();
        expect(typeof en[key]).toBe('string');
        expect(en[key].length).toBeGreaterThan(0);

        expect(zh[key]).toBeDefined();
        expect(typeof zh[key]).toBe('string');
        expect(zh[key].length).toBeGreaterThan(0);
      }
    });

    it('formats exploreTasksSheetSub with completed and total count', () => {
      const enSub = translate('en', 'exploreTasksSheetSub', { count: 3, total: 8 });
      expect(enSub).toBe('Here are some tasks for you: 3/8 tasks completed');

      const zhSub = translate('zh', 'exploreTasksSheetSub', { count: 3, total: 8 });
      expect(zhSub).toBe('为您准备了一些任务：已完成 3/8 个任务');
    });
  });
});
