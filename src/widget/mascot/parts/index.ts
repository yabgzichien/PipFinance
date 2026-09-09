import type { MascotPart } from './types';
import type { SlotId } from '../config';
import { HEAD_PARTS } from './head';
import { EYES_PARTS } from './eyes';
import { MOUTH_PARTS } from './mouth';
import { HOLDING_PARTS } from './holding';

export const PART_CATALOG: Record<SlotId, Record<string, MascotPart>> = {
  head: HEAD_PARTS,
  eyes: EYES_PARTS,
  mouth: MOUTH_PARTS,
  holding: HOLDING_PARTS,
};
