// Stub catalog for the `head` slot. Task 3 fills in the remaining parts (propellerHat,
// bandana, lab goggles, etc); this task only needs `none` and `strawHat` for its own tests.
import type { MascotPart } from './types';
import { Z } from './types';

const STRAW = '#F0DCA4';
const STRAW_LINE = '#B08A3E';
const HAT_BAND = '#D6453F';
const CAP_YELLOW = '#F5C542';
const CAP_RED = '#E8453C';
const CAP_TRIM = '#3F6FD1';
const CAP_BRIM = '#2E9E5B';
const CAP_BRIM_LINE = '#1F7A44';
const BAND = '#1F8A52';
const BAND_DARK = '#14603A';
const BAND_LIGHT = '#35B26C';
const GOGGLE_FRAME = '#2B3138';
const GOGGLE_STRAP = '#3C4650';
const GOGGLE_LENS = '#BFE7F2';

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

  /** Transcribed from Pip.tsx:448-461 (`PropellerCap`). Shares `strawHat`'s crown/brim silhouette
   *  so it lands on the same spot on the head, but the color-blocked crown halves and trim
   *  slivers are drawn as a single flat shape rather than split by z — nothing here occludes
   *  anything else in the part. */
  propellerCap: {
    id: 'propellerCap',
    slot: 'head',
    layers: [
      {
        z: Z.HEAD,
        svg: `<g data-part="propellerCap">
    <path d="M25 38 L29 27 C29.5 21 37 17.5 50 17.5 L50 38 Z" fill="${CAP_YELLOW}" />
    <path d="M75 38 L71 27 C70.5 21 63 17.5 50 17.5 L50 38 Z" fill="${CAP_RED}" />
    <path d="M25 38 L29 27 C29.5 21 33 18.5 36 18.3 L32 38 Z" fill="${CAP_TRIM}" />
    <path d="M75 38 L71 27 C70.5 21 67 18.5 64 18.3 L68 38 Z" fill="${CAP_TRIM}" />
    <line x1="50" y1="17.5" x2="50" y2="38" stroke="${CAP_TRIM}" stroke-width="1.2" opacity="0.5" />
    <ellipse cx="50" cy="40.5" rx="34" ry="7" fill="rgba(20,50,30,0.18)" />
    <ellipse cx="50" cy="38" rx="36" ry="6.5" fill="${CAP_BRIM}" stroke="${CAP_BRIM_LINE}" stroke-width="1.8" />
    <ellipse cx="50" cy="38" rx="29" ry="4.8" fill="none" stroke="${CAP_BRIM_LINE}" stroke-width="1.1" opacity="0.45" />
  </g>`,
      },
    ],
  },

  /** Transcribed from Pip.tsx:603-630 (`Bandana`). `testID`s dropped per transcription rule 5. */
  bandana: {
    id: 'bandana',
    slot: 'head',
    layers: [
      {
        z: Z.HEAD,
        svg: `<g data-part="bandana">
    <path d="M20 42.8 C12.5 40 6.5 41.2 1.5 37.2 C4 43.6 9 47.4 16 48.4 L11.8 44.6 L19.5 47 Z" fill="${BAND_DARK}" />
    <path d="M20.5 47.2 C14.5 50 9.5 54 4 57.2 C10.5 58.2 16 56 20.8 51.8 L15.6 52.6 Z" fill="${BAND}" />
    <path d="M23.75 36 A 33 33 0 0 0 18.55 46 Q 50 51.5 81.45 46 A 33 33 0 0 0 76.25 36 Q 50 41 23.75 36 Z" fill="${BAND}" />
    <path d="M27 38.6 Q50 43 73 38.6" fill="none" stroke="${BAND_LIGHT}" stroke-width="2" stroke-linecap="round" opacity="0.75" />
    <path d="M25 44.6 Q50 49.4 75 44.6" fill="none" stroke="${BAND_DARK}" stroke-width="1.6" stroke-linecap="round" opacity="0.55" />
    <path d="M17 41.5 L23.5 39.5 L24 49 L17.5 47.5 Z" fill="${BAND_LIGHT}" stroke="${BAND_DARK}" stroke-width="1.4" stroke-linejoin="round" />
  </g>`,
      },
    ],
  },

  /** Transcribed from Pip.tsx:757-787 (`LabGoggles`). The `[36, 64].map(...)` lens loop is
   *  unrolled into two literal groups per transcription rule 1 (no JSX left to map over). */
  goggles: {
    id: 'goggles',
    slot: 'head',
    layers: [
      {
        z: Z.HEAD,
        svg: `<g data-part="goggles">
    <path d="M20.9 40.5 A 33 33 0 0 0 18.1 47.6 Q 50 53 81.9 47.6 A 33 33 0 0 0 79.1 40.5 Q 50 45.6 20.9 40.5 Z" fill="${GOGGLE_STRAP}" />
    <path d="M23 42.6 Q50 47.6 77 42.6" fill="none" stroke="${GOGGLE_FRAME}" stroke-width="1.6" opacity="0.55" stroke-linecap="round" />
    <line x1="41" y1="37.5" x2="59" y2="37.5" stroke="${GOGGLE_FRAME}" stroke-width="5" stroke-linecap="round" />
    <g>
      <circle cx="36" cy="36.5" r="9.2" fill="${GOGGLE_FRAME}" />
      <circle cx="36" cy="36.5" r="6.4" fill="${GOGGLE_LENS}" />
      <path d="M31.6 36.5 A 4.6 4.6 0 0 1 35.4 32.3" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.75" />
    </g>
    <g>
      <circle cx="64" cy="36.5" r="9.2" fill="${GOGGLE_FRAME}" />
      <circle cx="64" cy="36.5" r="6.4" fill="${GOGGLE_LENS}" />
      <path d="M59.6 36.5 A 4.6 4.6 0 0 1 63.4 32.3" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.75" />
    </g>
  </g>`,
      },
    ],
  },
};
