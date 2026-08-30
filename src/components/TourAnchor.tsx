// src/components/TourAnchor.tsx
// Measurement wrapper for targeted controls in the guided onboarding tutorial.
// When id === activeId, it measures its bounding box and reports to tourAnchorRect.
import React, { useEffect, useRef } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { clearTourAnchor, reportTourAnchor } from '../lib/tourAnchorRect';

const SETTLE_RETRIES_MS = [50, 200, 500, 1000];

export function TourAnchor({
  id,
  activeId,
  children,
  style,
  remeasureKey,
}: {
  id: string;
  activeId: string | null;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  remeasureKey?: string | number | null;
}) {
  const ref = useRef<View>(null);
  const active = id === activeId;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const measure = () => {
      ref.current?.measureInWindow((x, y, width, height) => {
        if (!cancelled && width > 0 && height > 0) {
          reportTourAnchor(id, { x, y, width, height });
        }
      });
    };

    measure();
    for (const ms of SETTLE_RETRIES_MS) timers.push(setTimeout(measure, ms));

    return () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
      clearTourAnchor(id);
    };
  }, [active, id, remeasureKey]);

  if (!active) return <>{children}</>;
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}
