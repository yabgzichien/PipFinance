// Stub catalog for the `mouth` slot. Task 3 fills in the remaining parts. There is no `none`
// entry for this slot — Pip always has a mouth.
import type { MascotPart } from './types';
import { Z } from './types';

const INK = '#7A4800';

export const MOUTH_PARTS: Record<string, MascotPart> = {
  /** Transcribed from Pip.tsx:1125-1136 (`Mouth`), the `idle` branch (the final fallback
   *  return, marked `// idle`). */
  smile: {
    id: 'smile',
    slot: 'mouth',
    layers: [
      {
        z: Z.FACE,
        svg: `<g data-part="smile"><path d="M43 64 Q50 71 57 64" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" /></g>`,
      },
    ],
  },
};
