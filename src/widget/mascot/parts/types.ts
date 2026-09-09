import type { SlotId } from '../config';

export interface PartLayer {
  /** Draw order. Lower draws first (further back). Use the Z constants. */
  z: number;
  /** An SVG fragment in the 100-unit coordinate space Pip.tsx draws in. Must carry
   *  data-part="<id>" on its outermost element so tests can assert presence. */
  svg: string;
}

export interface MascotPart {
  id: string;
  slot: SlotId;
  layers: PartLayer[];
}

/** Fixed z bands. A part may contribute layers in several of them — the straw hat's crown must
 *  sit under its own brim (Pip.tsx:412-437), and the swordsman's sheathed katana sit behind the
 *  coin while the bitten one sits in front (Pip.tsx:555-556). That is why parts carry layers
 *  rather than a single fragment. */
export const Z = {
  BEHIND: -20,
  BODY: 0,
  FACE: 20,
  HEAD: 40,
  FRONT: 60,
  BADGE: 80,
} as const;
