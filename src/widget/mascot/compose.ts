import type { WidgetMascotConfig, SlotId } from './config';
import { DEFAULT_WIDGET_MASCOT_CONFIG } from './config';
import type { MascotPart, PartLayer } from './parts/types';
import { Z } from './parts/types';
import { PART_CATALOG } from './parts';
import { badgeLayer } from './badge';

/** The coin, sprout and shadow — not customizable. Pip is one fixed character rather than a
 *  shape that recolours (Pip.tsx:8); everything else layers onto this.
 *  Transcribed from QuickRecordWidget's original mascot block. */
const BODY_LAYER: PartLayer = {
  z: Z.BODY,
  svg: `<g data-part="body">
    <ellipse cx="50" cy="94" rx="22" ry="4.5" fill="rgba(16,40,28,0.14)" />
    <path d="M50 26 C50 18 50 14 50 12" stroke="#185e3e" stroke-width="3.6" fill="none" stroke-linecap="round" />
    <ellipse cx="42" cy="15" rx="8" ry="4.5" fill="#1c7a4e" transform="rotate(-32 42 15)" />
    <ellipse cx="58" cy="13" rx="9" ry="4.8" fill="#2aab68" transform="rotate(28 58 13)" />
    <circle cx="50" cy="56" r="33" fill="#F5B42A" />
    <circle cx="50" cy="56" r="26.6" fill="#FAC438" />
    <circle cx="50" cy="56" r="26.6" fill="none" stroke="#D99E18" stroke-width="2.6" />
    <ellipse cx="35" cy="42" rx="8.5" ry="4.9" fill="rgba(255,255,255,0.3)" transform="rotate(-26 35 42)" />
    <ellipse cx="31" cy="60" rx="5.5" ry="3.5" fill="#F07828" opacity="0.35" />
    <ellipse cx="69" cy="60" rx="5.5" ry="3.5" fill="#F07828" opacity="0.35" />
  </g>`,
};

/** Unknown ids resolve to the slot's default rather than throwing or rendering nothing. Config
 *  is validated for shape at parse time; validity against the catalog is checked here, because
 *  this is where the catalog lives. */
export function resolvePart(slot: SlotId, id: string): MascotPart | null {
  const forSlot = PART_CATALOG[slot];
  const hit = forSlot[id];
  if (hit) return hit;
  const fallbackId = DEFAULT_WIDGET_MASCOT_CONFIG[slot];
  return forSlot[fallbackId] ?? null;
}

export function composeMascot(config: WidgetMascotConfig, streak: number): string {
  const layers: PartLayer[] = [BODY_LAYER];

  for (const slot of ['head', 'eyes', 'mouth', 'holding'] as SlotId[]) {
    const part = resolvePart(slot, config[slot]);
    if (part) layers.push(...part.layers);
  }

  const badge = badgeLayer(config.badgeIcon, config.badgeColor, streak);
  if (badge) layers.push(badge);

  // Stable sort by z: parts within a band keep catalog order, which is what makes a hat's
  // crown/brim pair reliable.
  const ordered = layers.map((l, i) => ({ l, i })).sort((a, b) => a.l.z - b.l.z || a.i - b.i);

  // The badge is drawn in the OUTER 76x64 space, not the 100-unit mascot space that the rest of
  // the layers share, so it cannot be joined inside the scaled <g> below — it must be emitted
  // after that group closes. Partition on Z.BADGE to split the two coordinate spaces apart.
  const inner = ordered.filter(({ l }) => l.z < Z.BADGE).map(({ l }) => l.svg);
  const outer = ordered.filter(({ l }) => l.z >= Z.BADGE).map(({ l }) => l.svg);

  return `<svg width="76" height="64" viewBox="0 0 76 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="28" fill="#FFFFFF" stroke="#EAE5DA" stroke-width="1.2" />
  <g transform="translate(5, 5) scale(0.54)">
${inner.join('\n')}
  </g>
${outer.join('\n')}
</svg>`;
}
