import React from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { computeStreak, compute7DayDots, type StreakInput } from '../lib/streak';
import type { Transaction } from '../lib/types';
import { listTransactions } from '../db/txnRepo';
import { getMeta } from '../db/metaRepo';
import { getCheckInDays, type CheckInMap } from '../db/checkinRepo';
import { StreakWidget } from './StreakWidget';
import {
  DEFAULT_WIDGET_MASCOT_CONFIG,
  parseWidgetMascotConfig,
  WIDGET_MASCOT_CONFIG_KEY,
} from './mascot/config';

export { compute7DayDots };

export async function getStreakWidgetData(providedTxns?: Transaction[], providedCheckIns?: CheckInMap) {
  let txns: Transaction[];
  if (providedTxns) {
    txns = providedTxns;
  } else {
    try {
      txns = await listTransactions();
    } catch {
      txns = [];
    }
  }

  let checkIns: CheckInMap;
  if (providedCheckIns) {
    checkIns = providedCheckIns;
  } else {
    try {
      checkIns = await getCheckInDays();
    } catch {
      checkIns = {};
    }
  }

  // A failed read must not break the render: this runs headless from widgetTask.tsx, where a
  // throw fails a home-screen widget with no UI to report it.
  let config = DEFAULT_WIDGET_MASCOT_CONFIG;
  try {
    config = parseWidgetMascotConfig(await getMeta(WIDGET_MASCOT_CONFIG_KEY));
  } catch {
    // Keep defaults.
  }

  const now = new Date();
  return { streak: computeStreak(txns, now, 1, checkIns), dots: compute7DayDots(txns, now, checkIns), config };
}

export async function syncStreakWidget(txns?: Transaction[], checkIns?: CheckInMap): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const data = await getStreakWidgetData(txns, checkIns);
    await requestWidgetUpdate({
      widgetName: 'StreakWidget',
      renderWidget: () => (
        <StreakWidget
          streak={data.streak}
          dots={data.dots}
          config={data.config}
        />
      ),
    });
  } catch {
    // Graceful fallback if widget is not placed, running in Expo Go, or native module is not ready
  }
}
