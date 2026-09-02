import React from 'react';
import { QuickRecordWidget, type QuickRecordWidgetProps } from './QuickRecordWidget';

export interface StreakWidgetProps {
  streak?: number;
  dots?: boolean[];
}

/**
 * StreakWidget (Legacy Provider Alias):
 * Kept to ensure existing users who added the widget prior to the Quick Record update
 * seamlessly receive the new Quick Record layout (Pip mascot + streak flame badge +
 * Income ↑ / Expense ↓ buttons) without the widget disappearing or breaking on their home screen.
 */
export function StreakWidget({ streak = 0 }: StreakWidgetProps | QuickRecordWidgetProps = {}) {
  return <QuickRecordWidget streak={streak} />;
}
