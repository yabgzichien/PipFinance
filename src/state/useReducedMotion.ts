// src/state/useReducedMotion.ts
// docs/ui-engagement-plan.md Step 1: one hook every looping animation checks before it starts.
// Reduced whenever *either* the OS accessibility setting or the in-app "Motion and haptics"
// preference (Settings → Appearance) says so  the two are independent switches a user can
// reach for different reasons (vestibular sensitivity vs. just wanting a calmer app), and either
// one is enough to stop a loop.
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useAppData } from './store';

/** True when animation should be skipped or collapsed to opacity-only. Loops must not start,
 *  and any duration above `duration.base` (src/theme/motion.ts) should fall back to it. */
export function useReducedMotion(): boolean {
  const [osReduceMotion, setOsReduceMotion] = useState(false);
  const { motionSetting } = useAppData();

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setOsReduceMotion(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value: boolean) => {
      setOsReduceMotion(value);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return osReduceMotion || motionSetting !== 'full';
}
