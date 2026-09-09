// Stub catalog for the `eyes` slot. Task 3 fills in the remaining parts. There is no `none`
// entry for this slot — Pip always has eyes.
import type { MascotPart } from './types';
import { Z } from './types';

const INK = '#7A4800';

export const EYES_PARTS: Record<string, MascotPart> = {
  /** Transcribed from Pip.tsx:221-266 (`Eyes`), the `idle` branch: neither the happy/proud,
   *  sleepy, think nor sheepish special cases apply, so only the EYES.idle pupil pair renders
   *  (Pip.tsx:161-165). */
  default: {
    id: 'default',
    slot: 'eyes',
    layers: [
      {
        z: Z.FACE,
        svg: `<g data-part="default">
    <g>
      <circle cx="40" cy="55" r="4.2" fill="${INK}" />
      <circle cx="41.5" cy="53.5" r="1.3" fill="#fff" />
    </g>
    <g>
      <circle cx="60" cy="55" r="4.2" fill="${INK}" />
      <circle cx="61.5" cy="53.5" r="1.3" fill="#fff" />
    </g>
  </g>`,
      },
    ],
  },
};
