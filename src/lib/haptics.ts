// src/lib/haptics.ts
// Semantic haptics wrapper (docs/ui-engagement-plan.md Step 1). Call sites never name a
// platform API or an expo-haptics constant, only what just happened: tap(), commit(),
// payoff(), warn(). No-ops on web (expo-haptics has no web implementation) and no-ops
// whenever the user has turned haptics off in Settings — see `setHapticsEnabled`.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

let enabled = true;

/** Wired up from AppDataProvider whenever the `motionSetting` preference changes (`'off'`
 *  disables haptics; `'full'`/`'reduced'` both keep them  haptics aren't a motion-sickness
 *  vector, so only the explicit Off tier mutes them). */
export function setHapticsEnabled(next: boolean): void {
  enabled = next;
}

function fire(action: () => Promise<void>): void {
  if (!enabled || Platform.OS === 'web') return;
  action().catch(() => {
    // Haptics are a nicety; a device without a haptics engine (or a denied permission on some
    // OEM skins) should never surface an error to the user over it.
  });
}

/** A light selection change  toggling a pill, picking a category. */
export function tap(): void {
  fire(() => Haptics.selectionAsync());
}

/** A committed action  saving, confirming, deleting. */
export function commit(): void {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** A reward moment  a scan finished saving, a streak milestone. Reserve for genuine payoffs
 *  (docs/ui-engagement-plan.md §1: reward looking, never the state of the finances). */
export function payoff(): void {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Something needs attention but nothing failed  an overdue bill, a lapsed streak. Never
 *  fired in response to the user's spending or a negative balance. */
export function warn(): void {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
