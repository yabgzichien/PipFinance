// src/lib/onboardingNav.ts
// Pure helper functions for setup wizard navigation, progress, and dynamic branching.

export type WizardStep =
  | 'intro'
  | 'import'
  | 'advanced_import'
  | 'budget'
  | 'recurring'
  | 'notifications'
  | 'widget';

export interface WizardNavInfo {
  title: string;
  stepNumber: number;
  totalSteps: number;
  progressPct: number;
}

export function getWizardNavInfo(step: WizardStep, hasImported: boolean): WizardNavInfo | null {
  if (step === 'intro' || step === 'advanced_import') {
    return null;
  }

  if (hasImported) {
    // Branch A: User imported from old money manager (3 setup steps: Import -> Notifications -> Widget)
    switch (step) {
      case 'import':
        return { title: 'Import data', stepNumber: 1, totalSteps: 3, progressPct: (1 / 3) * 100 };
      case 'notifications':
        return { title: 'Notifications', stepNumber: 2, totalSteps: 3, progressPct: (2 / 3) * 100 };
      case 'widget':
        return { title: 'Widget', stepNumber: 3, totalSteps: 3, progressPct: (3 / 3) * 100 };
      default:
        return null;
    }
  } else {
    // Branch B: Fresh setup (5 setup steps: Import -> Budget -> Recurring -> Notifications -> Widget)
    switch (step) {
      case 'import':
        return { title: 'Import data', stepNumber: 1, totalSteps: 5, progressPct: (1 / 5) * 100 };
      case 'budget':
        return { title: 'Budget', stepNumber: 2, totalSteps: 5, progressPct: (2 / 5) * 100 };
      case 'recurring':
        return { title: 'Recurring payment', stepNumber: 3, totalSteps: 5, progressPct: (3 / 5) * 100 };
      case 'notifications':
        return { title: 'Notifications', stepNumber: 4, totalSteps: 5, progressPct: (4 / 5) * 100 };
      case 'widget':
        return { title: 'Widget', stepNumber: 5, totalSteps: 5, progressPct: (5 / 5) * 100 };
      default:
        return null;
    }
  }
}

export function getPreviousWizardStep(step: WizardStep, hasImported: boolean): WizardStep | null {
  switch (step) {
    case 'intro':
      return null;
    case 'import':
      return 'intro';
    case 'advanced_import':
      return 'import';
    case 'budget':
      return 'import';
    case 'recurring':
      return 'budget';
    case 'notifications':
      return hasImported ? 'import' : 'recurring';
    case 'widget':
      return 'notifications';
  }
}
