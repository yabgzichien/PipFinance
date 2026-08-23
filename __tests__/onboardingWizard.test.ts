// __tests__/onboardingWizard.test.ts
import {
  getPreviousWizardStep,
  getWizardNavInfo,
  type WizardStep,
} from '../src/lib/onboardingNav';

describe('onboardingWizard', () => {
  describe('getWizardNavInfo', () => {
    it('returns null for intro and advanced_import (no top progress bar on intro or external import chrome)', () => {
      expect(getWizardNavInfo('intro', false)).toBeNull();
      expect(getWizardNavInfo('intro', true)).toBeNull();
      expect(getWizardNavInfo('advanced_import', false)).toBeNull();
      expect(getWizardNavInfo('advanced_import', true)).toBeNull();
    });

    describe('Branch A: User did advanced import (hasImported = true)', () => {
      it('calculates 3 setup steps (Import -> Notifications -> Widget)', () => {
        const importInfo = getWizardNavInfo('import', true);
        expect(importInfo).toEqual({
          title: 'Import data',
          stepNumber: 1,
          totalSteps: 3,
          progressPct: (1 / 3) * 100,
        });

        const notifInfo = getWizardNavInfo('notifications', true);
        expect(notifInfo).toEqual({
          title: 'Notifications',
          stepNumber: 2,
          totalSteps: 3,
          progressPct: (2 / 3) * 100,
        });

        const widgetInfo = getWizardNavInfo('widget', true);
        expect(widgetInfo).toEqual({
          title: 'Widget',
          stepNumber: 3,
          totalSteps: 3,
          progressPct: 100,
        });
      });

      it('returns null for budget and recurring if evaluated under hasImported = true', () => {
        expect(getWizardNavInfo('budget', true)).toBeNull();
        expect(getWizardNavInfo('recurring', true)).toBeNull();
      });
    });

    describe('Branch B: User has nothing to import (hasImported = false)', () => {
      it('calculates 5 setup steps (Import -> Budget -> Recurring -> Notifications -> Widget)', () => {
        const importInfo = getWizardNavInfo('import', false);
        expect(importInfo).toEqual({
          title: 'Import data',
          stepNumber: 1,
          totalSteps: 5,
          progressPct: 20,
        });

        const budgetInfo = getWizardNavInfo('budget', false);
        expect(budgetInfo).toEqual({
          title: 'Budget',
          stepNumber: 2,
          totalSteps: 5,
          progressPct: 40,
        });

        const recurringInfo = getWizardNavInfo('recurring', false);
        expect(recurringInfo).toEqual({
          title: 'Recurring payment',
          stepNumber: 3,
          totalSteps: 5,
          progressPct: 60,
        });

        const notifInfo = getWizardNavInfo('notifications', false);
        expect(notifInfo).toEqual({
          title: 'Notifications',
          stepNumber: 4,
          totalSteps: 5,
          progressPct: 80,
        });

        const widgetInfo = getWizardNavInfo('widget', false);
        expect(widgetInfo).toEqual({
          title: 'Widget',
          stepNumber: 5,
          totalSteps: 5,
          progressPct: 100,
        });
      });
    });
  });

  describe('getPreviousWizardStep', () => {
    it('returns null for intro (root step)', () => {
      expect(getPreviousWizardStep('intro', false)).toBeNull();
      expect(getPreviousWizardStep('intro', true)).toBeNull();
    });

    it('returns intro from import step', () => {
      expect(getPreviousWizardStep('import', false)).toBe('intro');
      expect(getPreviousWizardStep('import', true)).toBe('intro');
    });

    it('returns import from advanced_import step', () => {
      expect(getPreviousWizardStep('advanced_import', false)).toBe('import');
      expect(getPreviousWizardStep('advanced_import', true)).toBe('import');
    });

    it('returns import from budget step', () => {
      expect(getPreviousWizardStep('budget', false)).toBe('import');
    });

    it('returns budget from recurring payment step', () => {
      expect(getPreviousWizardStep('recurring', false)).toBe('budget');
    });

    it('returns import from notifications if user imported, or recurring if fresh setup', () => {
      expect(getPreviousWizardStep('notifications', true)).toBe('import');
      expect(getPreviousWizardStep('notifications', false)).toBe('recurring');
    });

    it('returns notifications from widget step', () => {
      expect(getPreviousWizardStep('widget', false)).toBe('notifications');
      expect(getPreviousWizardStep('widget', true)).toBe('notifications');
    });
  });

  describe('End-to-end flow traversal simulations', () => {
    it('simulates Branch A: Intro -> Import -> Advanced Import -> Notifications -> Widget', () => {
      let currentStep: WizardStep = 'intro';
      let hasImported = false;

      // 1. Advance from Intro
      currentStep = 'import';
      expect(getWizardNavInfo(currentStep, hasImported)?.title).toBe('Import data');

      // 2. User starts advanced import
      currentStep = 'advanced_import';

      // 3. User finishes import
      hasImported = true;
      currentStep = 'notifications';
      expect(getWizardNavInfo(currentStep, hasImported)?.stepNumber).toBe(2);
      expect(getWizardNavInfo(currentStep, hasImported)?.totalSteps).toBe(3);

      // 4. User advances to widget
      currentStep = 'widget';
      expect(getWizardNavInfo(currentStep, hasImported)?.stepNumber).toBe(3);
      expect(getWizardNavInfo(currentStep, hasImported)?.totalSteps).toBe(3);

      // 5. Back navigation retraces correctly: Widget -> Notifications -> Import -> Intro
      currentStep = getPreviousWizardStep('widget', hasImported)!;
      expect(currentStep).toBe('notifications');

      currentStep = getPreviousWizardStep(currentStep, hasImported)!;
      expect(currentStep).toBe('import');

      currentStep = getPreviousWizardStep(currentStep, hasImported)!;
      expect(currentStep).toBe('intro');

      expect(getPreviousWizardStep(currentStep, hasImported)).toBeNull();
    });

    it('simulates Branch B: Intro -> Import (no data) -> Budget -> Recurring -> Notifications -> Widget', () => {
      let currentStep: WizardStep = 'intro';
      let hasImported = false;

      // 1. Advance from Intro
      currentStep = 'import';

      // 2. User chooses "I don't have anything to import"
      hasImported = false;
      currentStep = 'budget';
      expect(getWizardNavInfo(currentStep, hasImported)?.title).toBe('Budget');
      expect(getWizardNavInfo(currentStep, hasImported)?.stepNumber).toBe(2);
      expect(getWizardNavInfo(currentStep, hasImported)?.totalSteps).toBe(5);

      // 3. Advance to Recurring
      currentStep = 'recurring';
      expect(getWizardNavInfo(currentStep, hasImported)?.title).toBe('Recurring payment');
      expect(getWizardNavInfo(currentStep, hasImported)?.stepNumber).toBe(3);

      // 4. Advance to Notifications
      currentStep = 'notifications';
      expect(getWizardNavInfo(currentStep, hasImported)?.title).toBe('Notifications');
      expect(getWizardNavInfo(currentStep, hasImported)?.stepNumber).toBe(4);

      // 5. Advance to Widget
      currentStep = 'widget';
      expect(getWizardNavInfo(currentStep, hasImported)?.title).toBe('Widget');
      expect(getWizardNavInfo(currentStep, hasImported)?.stepNumber).toBe(5);

      // 6. Back navigation retraces correctly: Widget -> Notifications -> Recurring -> Budget -> Import -> Intro
      currentStep = getPreviousWizardStep('widget', hasImported)!;
      expect(currentStep).toBe('notifications');

      currentStep = getPreviousWizardStep(currentStep, hasImported)!;
      expect(currentStep).toBe('recurring');

      currentStep = getPreviousWizardStep(currentStep, hasImported)!;
      expect(currentStep).toBe('budget');

      currentStep = getPreviousWizardStep(currentStep, hasImported)!;
      expect(currentStep).toBe('import');

      currentStep = getPreviousWizardStep(currentStep, hasImported)!;
      expect(currentStep).toBe('intro');

      expect(getPreviousWizardStep(currentStep, hasImported)).toBeNull();
    });
  });
});
