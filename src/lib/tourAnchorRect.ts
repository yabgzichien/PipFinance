// src/lib/tourAnchorRect.ts
// Module-level anchor rect bridge for the guided onboarding tour.
// The active TourAnchor measures itself in window coordinates and reports here.
// The TourSpotlight overlay subscribes and draws the darkened background cutout + halo.
import type { SpotlightRect } from './spotlight';

export interface AnchorReport {
  id: string;
  rect: SpotlightRect;
}

type Listener = (report: AnchorReport | null) => void;

let current: AnchorReport | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of [...listeners]) listener(current);
}

/** Report (or refresh) the active anchor's measured window rect. No-ops on unchanged rect. */
export function reportTourAnchor(id: string, rect: SpotlightRect): void {
  const r = {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
  if (
    current &&
    current.id === id &&
    current.rect.x === r.x &&
    current.rect.y === r.y &&
    current.rect.width === r.width &&
    current.rect.height === r.height
  ) {
    return;
  }
  current = { id, rect: r };
  notify();
}

/** Clear the report if id matches. */
export function clearTourAnchor(id: string): void {
  if (current?.id !== id) return;
  current = null;
  notify();
}

export function getTourAnchor(): AnchorReport | null {
  return current;
}

export function onTourAnchor(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
