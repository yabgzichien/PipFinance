// Stub catalog for the `holding` slot. Task 3 fills in the remaining parts; this task only
// needs `none` and `crossedKatana` for its own tests.
import type { MascotPart } from './types';
import { Z } from './types';

const SAYA_DARK = '#1E2A24';
const SAYA_DARK_EDGE = '#41604E';
const SAYA_PALE = '#EDE6D6';
const SAYA_PALE_EDGE = '#93805C';
const HILT_WRAP = '#232A31';
const GUARD_GOLD = '#C8A02E';
const GUARD_GOLD_DARK = '#7C5F12';

export const HOLDING_PARTS: Record<string, MascotPart> = {
  none: { id: 'none', slot: 'holding', layers: [] },

  /** Transcribed from Pip.tsx:561-589 (`BackSwords`). Drawn at Z.BEHIND per the brief: the
   *  sheathed pair sits behind the coin body. `testID` is dropped per transcription rule 5. */
  crossedKatana: {
    id: 'crossedKatana',
    slot: 'holding',
    layers: [
      {
        z: Z.BEHIND,
        svg: `<g data-part="crossedKatana">
    <line x1="24" y1="36.8" x2="90" y2="86" stroke="${SAYA_DARK}" stroke-width="7.4" stroke-linecap="round" />
    <line x1="23" y1="38.1" x2="89" y2="87.3" stroke="${SAYA_DARK_EDGE}" stroke-width="1.5" stroke-linecap="round" />
    <line x1="76" y1="36.8" x2="10" y2="86" stroke="${SAYA_PALE}" stroke-width="7.4" stroke-linecap="round" />
    <line x1="77" y1="38.1" x2="11" y2="87.3" stroke="${SAYA_PALE_EDGE}" stroke-width="1.4" stroke-linecap="round" opacity="0.8" />
    <line x1="10" y1="26" x2="22.8" y2="35.6" stroke="${SAYA_PALE}" stroke-width="6.4" stroke-linecap="round" />
    <g stroke="${HILT_WRAP}" stroke-width="1.5" stroke-linecap="round">
      <line x1="12.2" y1="29.7" x2="15.5" y2="25.3" />
      <line x1="16.2" y1="32.7" x2="19.5" y2="28.3" />
    </g>
    <line x1="20" y1="41" x2="27.2" y2="31.4" stroke="${GUARD_GOLD}" stroke-width="3.6" stroke-linecap="round" />
    <line x1="20" y1="41" x2="27.2" y2="31.4" stroke="${GUARD_GOLD_DARK}" stroke-width="1" stroke-linecap="round" opacity="0.6" />
    <line x1="90" y1="26" x2="77.2" y2="35.6" stroke="${HILT_WRAP}" stroke-width="6.4" stroke-linecap="round" />
    <g stroke="${GUARD_GOLD}" stroke-width="1.5" stroke-linecap="round">
      <line x1="87.8" y1="29.7" x2="84.5" y2="25.3" />
      <line x1="83.8" y1="32.7" x2="80.5" y2="28.3" />
    </g>
    <line x1="80" y1="41" x2="72.8" y2="31.4" stroke="${GUARD_GOLD}" stroke-width="3.6" stroke-linecap="round" />
    <line x1="80" y1="41" x2="72.8" y2="31.4" stroke="${GUARD_GOLD_DARK}" stroke-width="1" stroke-linecap="round" opacity="0.6" />
  </g>`,
      },
    ],
  },
};
