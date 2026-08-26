import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../state/useReducedMotion';

/**
 * Mount entrance: gentle fade + small upward rise. Kept short and low-offset so
 * it reads as "settling in", never as a slide-show. Native-driven (opacity +
 * transform only). Pass a changing `key` from the caller to replay it.
 *
 * Reduced motion (docs/ui-engagement-plan.md Step 1) skips the tween entirely and mounts
 * already at its resting state  a staged reveal built from several of these (SavedScreen,
 * Step 2) must still show every piece, just without the choreography.
 */
export function FadeIn({
  children,
  style,
  delay = 0,
  duration = 340,
  offset = 10,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  delay?: number;
  duration?: number;
  offset?: number;
}) {
  const reducedMotion = useReducedMotion();
  const v = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reducedMotion) {
      v.setValue(1);
      return;
    }
    const a = Animated.timing(v, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [v, delay, duration, reducedMotion]);

  return (
    <Animated.View
      style={[
        style as ViewStyle,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Drive a number from 0 → target with an ease-out curve over `duration`ms on
 * mount. Returns the current value; lands exactly on `target`. Used for the
 * gauge sweep + score count-up. rAF-based so it works on web and native.
 *
 * Starts already at `target` (never 0) so the headline number is correct even
 * before the effect runs, and carries a setTimeout backstop that forces the
 * final value if rAF stalls (e.g. a backgrounded/hidden tab, where browsers
 * throttle requestAnimationFrame) instead of leaving the count-up stuck.
 */
/**
 * Same ease-out drive as `useEased`, but between two arbitrary values  used for
 * counting a number *down* (the Attack Gallery's confidence falling from its
 * pre-check level to the capped one) or, with `delay`, staged into a larger
 * reveal (SavedScreen's transaction count, docs/ui-engagement-plan.md Step 2).
 *
 * Unlike `useEased` this starts at `from`, not at the destination: it is meant
 * to be mounted at the moment the count should begin, so showing the final
 * value first would spoil the beat. The setTimeout backstop still guarantees it
 * lands exactly on `to` if rAF stalls. Reduced motion snaps straight to `to`
 * rather than holding at `from`  the number is data, not a flourish, so it
 * must still be readable with motion off.
 */
export function useEasedFrom(from: number, to: number, duration = 900, delay = 0): number {
  const reducedMotion = useReducedMotion();
  const [val, setVal] = useState(reducedMotion ? to : from);
  useEffect(() => {
    if (reducedMotion) {
      setVal(to);
      return;
    }
    let raf = 0;
    let startTimer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;
    const settle = () => {
      settled = true;
      setVal(to);
    };
    const run = () => {
      const start = Date.now();
      const tick = () => {
        const t = Math.min(1, (Date.now() - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        setVal(from + (to - from) * eased);
        if (t < 1) raf = requestAnimationFrame(tick);
        else settle();
      };
      raf = requestAnimationFrame(tick);
    };
    setVal(from);
    startTimer = setTimeout(run, delay);
    const fallback = setTimeout(() => {
      if (!settled) settle();
    }, delay + duration + 300);
    return () => {
      if (startTimer) clearTimeout(startTimer);
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
    };
  }, [from, to, duration, delay, reducedMotion]);
  return val;
}

export function useEased(target: number, duration = 950): number {
  return useEasedFrom(0, target, duration);
}
