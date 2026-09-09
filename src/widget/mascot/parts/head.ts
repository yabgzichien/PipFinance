// Stub catalog for the `head` slot. Task 3 fills in the remaining parts (propellerHat,
// bandana, lab goggles, etc); this task only needs `none` and `strawHat` for its own tests.
import type { MascotPart } from './types';
import { Z } from './types';

const STRAW = '#F0DCA4';
const STRAW_LINE = '#B08A3E';
const HAT_BAND = '#D6453F';

export const HEAD_PARTS: Record<string, MascotPart> = {
  none: { id: 'none', slot: 'head', layers: [] },

  /** Transcribed from Pip.tsx:409-441 (`StrawHat`). Crown and band are drawn before the brim so
   *  the brim's near edge occludes their base — that paint order is preserved here inside a
   *  single layer rather than split across z bands. */
  strawHat: {
    id: 'strawHat',
    slot: 'head',
    layers: [
      {
        z: Z.HEAD,
        svg: `<g data-part="strawHat">
    <path d="M25 38 L29 27 C29.5 21 37 17.5 50 17.5 C63 17.5 70.5 21 71 27 L75 38 Z" fill="${STRAW}" stroke="${STRAW_LINE}" stroke-width="1.8" stroke-linejoin="round" />
    <path d="M29.9 27 L70.1 27 L73.74 37 L26.26 37 Z" fill="${HAT_BAND}" />
    <ellipse cx="50" cy="40.5" rx="34" ry="7" fill="rgba(120,80,20,0.2)" />
    <ellipse cx="50" cy="38" rx="36" ry="6.5" fill="${STRAW}" stroke="${STRAW_LINE}" stroke-width="1.8" />
    <ellipse cx="50" cy="38" rx="29" ry="4.8" fill="none" stroke="${STRAW_LINE}" stroke-width="1.1" opacity="0.45" />
  </g>`,
      },
    ],
  },
};
