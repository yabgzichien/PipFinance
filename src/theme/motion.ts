// src/theme/motion.ts
// Motion tokens (docs/ui-engagement-plan.md Step 1): the one place that decides how long
// things take and how they ease, same discipline as `type`/`spacing` in ../theme.ts. A motion
// duration that isn't drawn from here is the 5th uncontrolled value the audit in Step 9 exists
// to catch.
import { Easing } from 'react-native';

/**
 * Four durations, in ms. `micro` and `base` are routine UI motion and stay inside the
 * 100-300ms band docs/ui-engagement-plan.md §2.8 backs. `enter` and `celebrate` are the two
 * tiers reserved for genuinely complex transitions (a screen entrance, the Saved-screen payoff
 * in Step 2) and use the wider up-to-500ms allowance that same research gives that case.
 */
export const duration = {
  micro: 120,
  base: 220,
  enter: 320,
  celebrate: 480,
} as const;

export const easing = {
  standard: Easing.out(Easing.cubic),
  spring: { friction: 5, tension: 120 } as const,
} as const;

/** Per-item delay offset for a staggered list reveal (e.g. the learned-merchants rows on
 *  Saved, docs/ui-engagement-plan.md Step 2): `baseDelay + i * stagger`. Not a duration
 *  itself, so it lives beside the tiers above rather than inside them. */
export const stagger = 60;

/** User-facing motion/haptics preference, persisted via app_meta (src/state/store.tsx). */
export type MotionSetting = 'full' | 'reduced' | 'off';

/** Every accepted setting, in the order the Settings pills render them. */
export const MOTION_SETTINGS: MotionSetting[] = ['full', 'reduced', 'off'];

/** Human label for the Settings pills. */
export function motionSettingLabel(setting: MotionSetting): string {
  switch (setting) {
    case 'full':
      return 'Full';
    case 'reduced':
      return 'Reduced';
    default:
      return 'Off';
  }
}

/** True when `value` is a setting this build understands. Guards what comes back out of app_meta. */
export function isMotionSetting(value: unknown): value is MotionSetting {
  return typeof value === 'string' && (MOTION_SETTINGS as string[]).includes(value);
}
