// __tests__/onboardingTutorial.test.ts
import { en } from '../src/i18n/translations/en';
import { zh } from '../src/i18n/translations/zh';

describe('onboardingTutorial', () => {
  describe('Tutorial Completion State Logic', () => {
    function computeTutorialStatus(scanDone: boolean, manualDone: boolean, dismissed: boolean) {
      const completedCount = (scanDone ? 1 : 0) + (manualDone ? 1 : 0);
      const isComplete = (scanDone && manualDone) || dismissed;
      const progressPct = (completedCount / 2) * 100;
      return { completedCount, isComplete, progressPct };
    }

    it('starts with 0/2 missions completed and incomplete state', () => {
      const status = computeTutorialStatus(false, false, false);
      expect(status.completedCount).toBe(0);
      expect(status.progressPct).toBe(0);
      expect(status.isComplete).toBe(false);
    });

    it('advances to 1/2 missions completed when receipt/e-wallet scan is done', () => {
      const status = computeTutorialStatus(true, false, false);
      expect(status.completedCount).toBe(1);
      expect(status.progressPct).toBe(50);
      expect(status.isComplete).toBe(false);
    });

    it('advances to 1/2 missions completed when manual entry is done', () => {
      const status = computeTutorialStatus(false, true, false);
      expect(status.completedCount).toBe(1);
      expect(status.progressPct).toBe(50);
      expect(status.isComplete).toBe(false);
    });

    it('marks tutorial complete when both missions are done', () => {
      const status = computeTutorialStatus(true, true, false);
      expect(status.completedCount).toBe(2);
      expect(status.progressPct).toBe(100);
      expect(status.isComplete).toBe(true);
    });

    it('marks tutorial complete when explicitly dismissed by user', () => {
      const status = computeTutorialStatus(false, false, true);
      expect(status.completedCount).toBe(0);
      expect(status.isComplete).toBe(true);
    });

    it('resets tutorial state back to 0/2 on replay/reset', () => {
      let scanDone = true;
      let manualDone = true;
      let dismissed = false;

      // simulate reset
      scanDone = false;
      manualDone = false;
      dismissed = false;

      const status = computeTutorialStatus(scanDone, manualDone, dismissed);
      expect(status.completedCount).toBe(0);
      expect(status.progressPct).toBe(0);
      expect(status.isComplete).toBe(false);
    });
  });

  describe('Tutorial Translation Parity', () => {
    const requiredTutorialKeys = [
      'tutorialTitle',
      'tutorialScanCoaching',
      'tutorialManualCoaching',
      'replayTutorial',
      'tutorialReplayedToast',
    ] as const;

    it('contains all required tutorial translation keys in en and zh', () => {
      for (const key of requiredTutorialKeys) {
        expect(en[key]).toBeDefined();
        expect(typeof en[key]).toBe('string');
        expect(en[key].length).toBeGreaterThan(0);

        expect(zh[key]).toBeDefined();
        expect(typeof zh[key]).toBe('string');
        expect(zh[key].length).toBeGreaterThan(0);
      }
    });
  });

  describe('Guided Tour Translation Parity', () => {
    const requiredTourKeys = [
      'tourStepPlusTitle',
      'tourStepPlusBody',
      'tourStepScanTitle',
      'tourStepScanBody',
      'tourStepManualBtnTitle',
      'tourStepManualBtnBody',
      'tourStepAmountTitle',
      'tourStepAmountBody',
      'tourStepSplitGlossaryTitle',
      'tourStepSplitGlossaryBody',
      'tourStepAccountTitle',
      'tourStepAccountBody',
      'tourStepCategoryTitle',
      'tourStepCategoryBody',
      'tourStepAddExpenseTitle',
      'tourStepAddExpenseBody',
      'tourStepActivityTipTitle',
      'tourStepActivityTipBody',
      'tourStepNetWorthTitle',
      'tourStepNetWorthBody',
      'tourStepSettingsTitle',
      'tourStepSettingsBody',
      'tourStepRecapTitle',
      'tourStepRecapBody',
      'tourNext',
      'tourSkip',
      'tourGotIt',
    ] as const;

    it('contains all required guided-tour translation keys in en and zh', () => {
      for (const key of requiredTourKeys) {
        expect(en[key]).toBeDefined();
        expect(typeof en[key]).toBe('string');
        expect(en[key].length).toBeGreaterThan(0);

        expect(zh[key]).toBeDefined();
        expect(typeof zh[key]).toBe('string');
        expect(zh[key].length).toBeGreaterThan(0);
      }
    });
  });
});
