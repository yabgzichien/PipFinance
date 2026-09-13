import { Platform } from 'react-native';
import type { Transaction } from '../lib/types';
import { syncStreakWidget } from './syncStreakWidget';
import { syncQuickRecordWidget } from './syncQuickRecordWidget';
import type { CheckInMap } from '../db/checkinRepo';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs the StreakWidget and QuickRecordWidget syncs one after another instead of
 * concurrently. Both widgets render the same set of SvgWidget elements (mascot,
 * up arrow, down arrow) through react-native-android-widget's bundled androidsvg
 * parser, which has a known thread-safety bug (BigBadaboom/androidsvg#46) that
 * intermittently drops an SVG element when two parses race on separate threads.
 * Firing these back-to-back (as before) reliably created that race on every
 * transaction change; spacing them out avoids it.
 */
export async function syncAllWidgets(txns?: Transaction[], checkIns?: CheckInMap): Promise<void> {
  if (Platform.OS !== 'android') return;

  await syncStreakWidget(txns, checkIns).catch(() => {});
  await wait(300);
  await syncQuickRecordWidget(txns).catch(() => {});
}
