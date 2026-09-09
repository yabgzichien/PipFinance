import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { DestinationKey } from '../lib/destinations';

/**
 * Landmark silhouettes for trips, on the same 24x24 grid as `Icon` but deliberately a SEPARATE
 * set — and a separate file.
 *
 * `Icon` is monoline interface chrome: stroked, uniform weight, one shared `IconName` union that
 * every screen depends on. These are pictorial fills. Merging them would have grown a union used
 * app-wide with 36 names no UI surface will ever ask for, and forced one rendering convention
 * (stroke width) onto glyphs that do not use it.
 *
 * Filled rather than stroked because of where they live: a 38px badge, sometimes 24px. A Merlion
 * or a Colosseum drawn in 1.8px strokes at that size collapses into grey noise. Internal detail
 * uses `opacity` on the SAME fill rather than white cut-outs, so a glyph stays correct on any
 * badge colour instead of only on the light tint it was drawn against.
 */
type RenderFn = (c: string) => React.ReactNode;

const LANDMARKS: Record<DestinationKey, RenderFn> = {
  // Merlion: a spiked lion mane and profile over a scaled fish body, mid-spout above the waves.
  // The body is lighter than the scale strokes so those details survive at 22px without relying
  // on a background-coloured cut-out (the glyph is used on several different surfaces).
  sg: (c) => (
    <G fill={c}>
      <G testID="merlion-mane" opacity={0.52}>
        <Path d="M12.1 1.4l1.25 1.25 1.65-.52.36 1.58 1.66.24-.7 1.46 1.28 1.02-1.25 1 .05 1.56-1.58-.02-.82 1.34-1.32-.82-1.5.65-.52-1.42-1.62-.35.9-1.32-1.27-.94 1.4-.72-.38-1.58 1.61-.1z" />
      </G>
      <Path
        fillRule="evenodd"
        d="M13.75 3.8c-1.2-.88-3.1-.82-4.36.1A4.35 4.35 0 0 0 7.72 6.2l-2.6.72c-.46.13-.5.76-.07.95l2.47 1.08c.7 1.28 2.05 2.06 3.58 2.06 2.47 0 4.46-1.82 4.46-4.08 0-1.2-.65-2.35-1.81-3.13zM10.45 5.55a.5.5 0 1 0 1 0 .5.5 0 1 0-1 0zM5.72 7.55c.86.07 1.6.01 2.2-.18-.3.6-.94.88-1.9.82z"
      />
      <Path d="M12.65 3.5l1.5-1.28.28 2.1z" />
      <Path
        testID="merlion-water"
        d="M5.2 8.45c-1.55.45-2.78 1.35-3.65 2.72"
        stroke={c}
        strokeWidth={1.35}
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M11.45 9.35c2.82.75 4.58 3.05 4.12 5.67-.38 2.23-1.88 3.77-4.35 4.75l-2.35.93-3.48-1.25 3.15-1.55c1.7-.83 2.28-2.03 1.75-3.55-.68-1.98-.3-3.72 1.16-5z" opacity={0.64} />
      <Path d="M8.75 17.55c-1.28-.25-2.53.1-3.72 1.02l-2.2-1.02.77 2.2-1.45 1.67 2.48.08c1.75.82 3.3.72 4.68-.3z" opacity={0.78} />
      <G testID="merlion-scales" fill="none" stroke={c} strokeWidth={0.85} strokeLinecap="round">
        <Path d="M10.55 11.75c.65.55 1.28.55 1.92 0M10.72 13.75c.72.58 1.43.58 2.15 0M10.55 15.85c.72.58 1.43.58 2.15 0" />
      </G>
      <Path
        testID="merlion-waves"
        d="M2 21.45c1.38 0 2-.72 3.25-.72s1.88.72 3.25.72 2-.72 3.25-.72 1.88.72 3.25.72 2-.72 3.25-.72 1.88.72 3.25.72"
        stroke={c}
        strokeWidth={1.35}
        strokeLinecap="round"
        fill="none"
        opacity={0.68}
      />
    </G>
  ),
  // Petronas: two tapered towers, spires, and the skybridge between them.
  my: (c) => (
    <G fill={c}>
      <Path d="M6.4 3.4l.62 1.5v1.1H5.78v-1.1z" />
      <Path d="M17.6 3.4l.62 1.5v1.1h-1.24v-1.1z" />
      <Path d="M3.9 9.6l1.5-1.3h2.9l1.5 1.3v12.1H3.9z" />
      <Path d="M20.1 9.6l-1.5-1.3h-2.9l-1.5 1.3v12.1h5.9z" />
      <Rect x="10.15" y="11.4" width="3.7" height="1.5" rx="0.4" />
    </G>
  ),
  // Fuji: the concave cone with its jagged snowline, plus two cloud bars.
  jp: (c) => (
    <G fill={c}>
      <Path d="M1.4 20.4l7.5-12.7a3.6 3.6 0 0 1 6.2 0l7.5 12.7a.5.5 0 0 1-.43.75H1.83a.5.5 0 0 1-.43-.75z" />
      <Path d="M8.6 9.1a3.55 3.55 0 0 1 6.8 0l1.3 2.2-1.45-.72-1.45.87-1.45-.87-1.35.87-1.45-.87-1.45.72z" opacity={0.42} />
      <Path d="M2.6 4.8h3.1M1.4 6.7h5" stroke={c} strokeWidth={1.3} strokeLinecap="round" fill="none" opacity={0.5} />
    </G>
  ),
  // Wat Arun: the tiered prang with its stepped shoulders.
  th: (c) => (
    <G fill={c}>
      <Path d="M12 1l.75 2.3h-1.5z" />
      <Path d="M12 3.6c1.5 1.9 2.35 4.3 2.35 6.9 0 1.6-.3 3.1-.85 4.4h-3c-.55-1.3-.85-2.8-.85-4.4 0-2.6.85-5 2.35-6.9z" />
      <Path d="M8.2 15.4h7.6l1 2.1H7.2z" />
      <Path d="M6.3 18.4h11.4l1.1 3.2H5.2z" />
      <Path d="M7.9 9.6l1.2 1.5-.7 3.2H6.6zM16.1 9.6l-1.2 1.5.7 3.2h1.8z" opacity={0.5} />
    </G>
  ),
  // Mayon: the near-perfect volcanic cone, with the three flag stars above it.
  ph: (c) => (
    <G fill={c}>
      <Path d="M2 21.3l8.2-13.6a2.1 2.1 0 0 1 3.6 0L22 21.3z" />
      <Path d="M10.2 7.7a2.1 2.1 0 0 1 3.6 0l1.1 1.85-1.35-.6-1.55.75-1.55-.75-1.35.6z" opacity={0.42} />
      <Path d="M4.3 2.6l.42 1.02 1.1.09-.84.72.26 1.07-.94-.58-.94.58.26-1.07-.84-.72 1.1-.09zM19.7 2.6l.42 1.02 1.1.09-.84.72.26 1.07-.94-.58-.94.58.26-1.07-.84-.72 1.1-.09zM12 .7l.42 1.02 1.1.09-.84.72.26 1.07-.94-.58-.94.58.26-1.07-.84-.72 1.1-.09z" opacity={0.7} />
    </G>
  ),
  // Statue of Liberty: crown, torch arm, and the robe over a plinth.
  us: (c) => (
    <G fill={c}>
      <Path d="M17.4 2.1l.85 1.5-1.7.55z" />
      <Rect x="16.2" y="4.2" width="1.5" height="2.6" rx="0.45" transform="rotate(-18 16.95 5.5)" />
      <Path d="M10.4 4.9a1.85 1.85 0 1 1 3.7 0 1.85 1.85 0 0 1-3.7 0z" />
      <Path d="M9.5 4.2l.7-1.5.85 1.15 1.2-1.5 1.2 1.5.85-1.15.7 1.5z" />
      <Path d="M12.2 8c1.9 0 3.1 1.5 3.5 3.6l1 5.6H7.6l1-5.6C9 9.5 10.3 8 12.2 8z" />
      <Path d="M14.1 8.4l1.9-1.9 1.1 1.1-2.1 2z" />
      <Path d="M6.4 17.9h11.2v1.5H6.4zM5.2 19.8h13.6v1.9H5.2z" opacity={0.75} />
    </G>
  ),
  // Canada: the maple leaf reads instantly at any size; a CN Tower does not.
  ca: (c) => (
    <G fill={c}>
      <Path d="M12 1.6l1.75 3.3 1.5-.72-.6 3.2 3.05-.5-.72 1.62 3.32 2.6-1.05.6.85 2.6-3.9-.5.35 1.6-3.6-.9.55 6.4h-1.5l.55-6.4-3.6.9.35-1.6-3.9.5.85-2.6-1.05-.6 3.32-2.6L7.3 6.88l3.05.5-.6-3.2 1.5.72z" />
    </G>
  ),
  // Great Wall: a watchtower riding a wall that runs off both edges, crenellations included.
  cn: (c) => (
    <G fill={c}>
      <Path d="M8.6 6.2h6.8v1.7H8.6z" />
      <Path d="M8.6 5.1h1.3v1.4H8.6zM10.8 5.1h1.3v1.4h-1.3zM13 5.1h1.3v1.4H13zM15.2 4.6h.9v1.9h-.9z" opacity={0.85} />
      <Path d="M9 8.4h6v6.1H9z" />
      <Path d="M1.1 14.9l7.9-2.4v2.6l-7.9 3.1zM22.9 14.9L15 12.5v2.6l7.9 3.1z" />
      <Path d="M1.1 18.2l7.9-3.1v2.3l-7.9 3.4zM22.9 18.2L15 15.1v2.3l7.9 3.4z" opacity={0.55} />
      <Rect x="10.8" y="10.4" width="2.4" height="4.1" rx="0.4" opacity={0.45} />
    </G>
  ),
  // Hong Kong: harbour skyline behind a junk's battened sail.
  hk: (c) => (
    <G fill={c}>
      <Path d="M2.6 9.5h2.5v9.1H2.6zM5.9 12h2.3v6.6H5.9z" opacity={0.55} />
      <Path d="M18.9 7.4l.55 1.5h1.9v9.7h-4.9V8.9h1.9z" opacity={0.55} />
      <Path d="M9.6 5.2l4.9 2.6-4.9 2.2z" />
      <Path d="M9.6 11.1l5.9 2.4-5.9 2.1z" opacity={0.8} />
      <Rect x="8.9" y="4.4" width="1" height="12.1" rx="0.4" />
      <Path d="M1.6 18.9h20.8c-.9 1.8-2.5 2.7-4.9 2.7H6.5c-2.4 0-4-.9-4.9-2.7z" />
    </G>
  ),
  // Taipei 101: eight stacked flared modules on a wide podium.
  tw: (c) => (
    <G fill={c}>
      <Path d="M12 .8l.55 2.4h-1.1z" />
      <Rect x="11.35" y="3.4" width="1.3" height="2.4" rx="0.35" />
      <Path d="M9.9 6.1h4.2l.5 2.3H9.4zM9.6 8.9h4.8l.5 2.3H9.1zM9.3 11.7h5.4l.5 2.3H8.8zM9 14.5h6l.5 2.3H8.5z" />
      <Path d="M7.3 17.3h9.4l.7 2.2H6.6z" />
      <Path d="M5.5 20h13v1.7h-13z" opacity={0.75} />
    </G>
  ),
  // Gwanghwamun: the hanok gate with its deep upswept eaves.
  kr: (c) => (
    <G fill={c}>
      <Path d="M2.2 8.4c2.6-2.4 6-3.7 9.8-3.7s7.2 1.3 9.8 3.7c-.35.85-1 1.35-1.9 1.35H4.1c-.9 0-1.55-.5-1.9-1.35z" />
      <Path d="M12 2.6l.7 1.7h-1.4z" />
      <Path d="M4.6 10.7h14.8v1.6H4.6z" opacity={0.8} />
      <Path d="M3.6 13.6c2.4-1.7 5.3-2.6 8.4-2.6s6 .9 8.4 2.6c-.3.7-.85 1.1-1.6 1.1H5.2c-.75 0-1.3-.4-1.6-1.1z" opacity={0.6} />
      <Path d="M5.4 15.6h13.2v6.1H5.4z" />
      <Path d="M10.3 17.4h3.4v4.3h-3.4z" opacity={0.4} />
    </G>
  ),
  // St Basil's: the three onion domes that make it unmistakable.
  ru: (c) => (
    <G fill={c}>
      <Path d="M12 2.1c1.55 1.35 2.35 2.8 2.35 4.2 0 1.5-1.05 2.6-2.35 2.6S9.65 7.8 9.65 6.3c0-1.4.8-2.85 2.35-4.2z" />
      <Path d="M6.1 6.7c1.25 1.1 1.9 2.25 1.9 3.4 0 1.2-.85 2.1-1.9 2.1s-1.9-.9-1.9-2.1c0-1.15.65-2.3 1.9-3.4zM17.9 6.7c1.25 1.1 1.9 2.25 1.9 3.4 0 1.2-.85 2.1-1.9 2.1s-1.9-.9-1.9-2.1c0-1.15.65-2.3 1.9-3.4z" opacity={0.75} />
      <Path d="M10.15 9.4h3.7v2.1h-3.7zM4.6 12.6h3v2.1h-3zM16.4 12.6h3v2.1h-3z" opacity={0.5} />
      <Path d="M9.4 11.8h5.2v9.9H9.4zM3.6 15h5v6.7h-5zM15.4 15h5v6.7h-5z" />
      <Path d="M11.1 16.9h1.8v4.8h-1.8z" opacity={0.4} />
    </G>
  ),
  // Hagia Sophia: the central dome flanked by minarets.
  tr: (c) => (
    <G fill={c}>
      <Path d="M12 5.3c2.9 0 5.2 2.35 5.2 5.25 0 .6-.1 1.2-.3 1.75H7.1a5.2 5.2 0 0 1 4.9-7z" />
      <Path d="M12 3.1l.5 1.5h-1z" />
      <Path d="M6.7 12.9h10.6v8.8H6.7z" />
      <Path d="M3.3 8.6l.75 1.5h-1.5zM3 10.6h2.1v11.1H3zM20.7 8.6l.75 1.5h-1.5zM18.9 10.6H21v11.1h-2.1z" opacity={0.75} />
      <Path d="M10.6 16.4c0-.8.63-1.4 1.4-1.4s1.4.6 1.4 1.4v5.3h-2.8z" opacity={0.4} />
    </G>
  ),
  // Brandenburg Gate: six columns under the entablature and the quadriga.
  de: (c) => (
    <G fill={c}>
      <Path d="M9.9 2.6h4.2v1.5H9.9z" opacity={0.7} />
      <Path d="M8.6 4.4h6.8l.5 1.3H8.1z" opacity={0.7} />
      <Path d="M4.2 6.2h15.6v2.5H4.2z" />
      <Path d="M3.6 8.9h16.8v1.4H3.6z" opacity={0.8} />
      <Path d="M4.8 10.6h1.9v9.3H4.8zM8.1 10.6H10v9.3H8.1zM11.4 10.6h1.9v9.3h-1.9zM14.7 10.6h1.9v9.3h-1.9zM18 10.6h1.9v9.3H18z" />
      <Path d="M3.4 20.2h17.2v1.5H3.4z" />
    </G>
  ),
  // Big Ben: the Elizabeth Tower, clock face and spire.
  gb: (c) => (
    <G fill={c}>
      <Path d="M12 1l.85 1.9h-1.7z" />
      <Path d="M11.35 3.4h1.3v2h-1.3z" />
      <Path d="M9.5 5.9h5l-.85 2.4h-3.3z" />
      <Path d="M9.1 8.8h5.8v4.4H9.1z" />
      <Path d="M9.5 13.7h5v8H9.5z" />
      <Circle cx="12" cy="11" r="1.7" opacity={0.4} />
      <Path d="M4.6 17.9h4.2v3.8H4.6zM15.2 17.9h4.2v3.8h-4.2z" opacity={0.55} />
    </G>
  ),
  // Colosseum: two arcades of arches over a solid base, one side broken as it really stands.
  it: (c) => (
    <G fill={c}>
      <Path d="M3.1 8.4c0-2.5 4-4.3 8.9-4.3s8.9 1.8 8.9 4.3v11.9H3.1z" />
      <Path d="M6 9.4a1.35 1.35 0 0 1 2.7 0v2.6H6zM10.65 9.1a1.35 1.35 0 0 1 2.7 0v2.9h-2.7zM15.3 9.4a1.35 1.35 0 0 1 2.7 0v2.6h-2.7z" opacity={0.32} />
      <Path d="M6 14.5a1.35 1.35 0 0 1 2.7 0v2.6H6zM10.65 14.5a1.35 1.35 0 0 1 2.7 0v2.6h-2.7zM15.3 14.5a1.35 1.35 0 0 1 2.7 0v2.6h-2.7z" opacity={0.32} />
      <Path d="M2.2 20.2h19.6v1.5H2.2z" />
      <Path d="M17.4 4.9l3.5.9v3.1l-3.5-1z" opacity={0.25} />
    </G>
  ),
  // Eiffel: the flare of the legs is the whole silhouette.
  fr: (c) => (
    <G fill={c}>
      <Path d="M12 1l.95 2.15h-1.9z" />
      <Path d="M11.15 3.7h1.7v2.6h-1.7z" />
      <Path d="M10.4 6.8h3.2l.5 2.4h-4.2z" />
      <Path d="M9.6 10.3h4.8l1.05 4.1H8.55z" />
      <Path d="M8.15 15.5h7.7l2.6 6.2h-2.6l-1.5-3.7h-4.7l-1.5 3.7H5.55z" />
      <Rect x="9.4" y="12.3" width="5.2" height="1.3" rx="0.35" opacity={0.4} />
    </G>
  ),
  // Bran Castle: the cluster of steep conical roofs on a crag.
  ro: (c) => (
    <G fill={c}>
      <Path d="M6.6 4.9l2.5 3.6H4.1z" />
      <Path d="M12 2.2l3 4.4H9z" />
      <Path d="M17.6 5.9l2.3 3.3h-4.6z" opacity={0.8} />
      <Path d="M4.6 8.9h4v11.4h-4zM9.4 7h5.2v13.3H9.4zM15.6 9.6h4v10.7h-4z" />
      <Path d="M11.15 11.4h1.7v2.4h-1.7zM6.1 12.2h1.3v2.1H6.1zM16.9 12.6h1.3v2.1h-1.3z" opacity={0.38} />
      <Path d="M2.6 20.6h18.8v1.4H2.6z" opacity={0.7} />
    </G>
  ),
  // Giza: the two pyramids, the sun, and the desert line.
  eg: (c) => (
    <G fill={c}>
      <Path d="M9.3 4.6l7.6 14.1H1.7z" />
      <Path d="M17.5 9.4l5.1 9.3H12.4z" opacity={0.5} />
      <Circle cx="18.4" cy="4.4" r="2.3" opacity={0.45} />
      <Path d="M1 19.6h22v1.7H1z" opacity={0.8} />
    </G>
  ),
  // Hallgrímskirkja: the swept concrete wings stepping up to the tower.
  is: (c) => (
    <G fill={c}>
      <Path d="M12 1.4l1.5 3.1h-3z" />
      <Path d="M10.5 5h3v5.4h-3z" />
      <Path d="M9.9 10.1h4.2v11.6H9.9z" />
      <Path d="M7.7 12.4h2.2v9.3H7.7zM14.1 12.4h2.2v9.3h-2.2z" opacity={0.72} />
      <Path d="M5.6 14.9h2.1v6.8H5.6zM16.3 14.9h2.1v6.8h-2.1z" opacity={0.52} />
      <Path d="M3.6 17.2h2v4.5h-2zM18.4 17.2h2v4.5h-2z" opacity={0.35} />
    </G>
  ),
  // A Viking longship: the prow is the one Swedish silhouette that survives 24px.
  se: (c) => (
    <G fill={c}>
      <Path d="M3.9 14.5h16.2c-.5 3.1-2.4 4.7-5.7 4.7H9.6c-3.3 0-5.2-1.6-5.7-4.7z" />
      <Path d="M3.9 14.5c-1.5-.3-2.3-1.4-2.4-3.2 1.2.5 2 1.1 2.4 1.8zM20.1 14.5c1.5-.3 2.3-1.4 2.4-3.2-1.2.5-2 1.1-2.4 1.8z" opacity={0.8} />
      <Rect x="11.35" y="3" width="1.3" height="11" rx="0.4" />
      <Path d="M5.6 5.6h12.8v6.6H5.6z" opacity={0.55} />
      <Path d="M5.6 5.6h12.8v1.7H5.6zM5.6 9h12.8v1.7H5.6z" opacity={0.35} />
    </G>
  ),
  // The Matterhorn: the hooked summit is the entire identity.
  ch: (c) => (
    <G fill={c}>
      <Path d="M13.4 2.2l8.9 19.1H2.4l6.7-8.6 1.9 2.1z" />
      <Path d="M13.4 2.2l2.4 5.2-2 1.2-1.9-1.1-1.35 1.5-1.5-.9z" opacity={0.4} />
    </G>
  ),
  // Wawel: the arcaded hall with its twin towers.
  pl: (c) => (
    <G fill={c}>
      <Path d="M5.6 3.9l2 3.3h-4z" />
      <Path d="M18.4 3.9l2 3.3h-4z" />
      <Path d="M3.6 7.6h4v14.1h-4zM16.4 7.6h4v14.1h-4z" />
      <Path d="M8 11.1h8v10.6H8z" opacity={0.85} />
      <Path d="M9.1 13.4a1.25 1.25 0 0 1 2.5 0v2.4H9.1zM12.4 13.4a1.25 1.25 0 0 1 2.5 0v2.4h-2.5z" opacity={0.35} />
      <Path d="M4.9 10.4h1.4v2.2H4.9zM17.7 10.4h1.4v2.2h-1.4z" opacity={0.4} />
    </G>
  ),
  // Taj Mahal: the onion dome, four minarets, and the arched iwan.
  in: (c) => (
    <G fill={c}>
      <Path d="M12 3.9c1.75 1.6 2.65 3.15 2.65 4.7 0 1.6-1.2 2.75-2.65 2.75S9.35 10.2 9.35 8.6c0-1.55.9-3.1 2.65-4.7z" />
      <Path d="M12 2.1l.55 1.6h-1.1z" />
      <Path d="M8.1 11.6h7.8v10.1H8.1z" />
      <Path d="M10.4 15.1a1.6 1.6 0 0 1 3.2 0v6.6h-3.2z" opacity={0.35} />
      <Path d="M4 9.9l.6 1.3H3.4zM3.5 11.7h2.2v10H3.5zM20 9.9l.6 1.3h-1.2zM18.3 11.7h2.2v10h-2.2z" opacity={0.7} />
      <Path d="M6.6 14.2h1.4v7.5H6.6zM16 14.2h1.4v7.5H16z" opacity={0.45} />
    </G>
  ),
  // Sydney Opera House: overlapping shells on the quay.
  au: (c) => (
    <G fill={c}>
      <Path d="M3.2 18.4c0-4.2 2.1-7.5 5.4-9.2-.8 3.2-.6 6.3.6 9.2z" opacity={0.55} />
      <Path d="M7.6 18.4c0-5.2 2.6-9.3 6.8-11.3-1.1 4-.8 7.8.7 11.3z" opacity={0.78} />
      <Path d="M12.9 18.4c0-6 3-10.7 8-13-1.3 4.6-.9 9 .8 13z" />
      <Path d="M1.6 19.2h20.8v2.2H1.6z" opacity={0.8} />
    </G>
  ),
  // The silver fern: New Zealand's mountains are generic, its fern is not.
  nz: (c) => (
    <G fill={c}>
      <Path d="M11.35 21.6c-.15-4.4.35-8.6 1.5-12.6.6-2.1 1.5-4.1 2.7-6-2.5 1.5-4.4 3.6-5.6 6.2-1.3 2.8-1.8 6-1.5 9.6.15-2.6.75-4.9 1.8-6.9-.5 3.1-.6 6.3-.2 9.7z" />
      <Path d="M9.6 8.9L6.4 7.4l1.5 3.1zM8.4 12.1l-3.3-1.1 1.7 2.9zM7.9 15.3l-3.4-.7 1.9 2.7zM13.4 6.4l1.3-3.3 1.9 2.9zM15.5 9.1l2.9-1.9-.6 3.4zM16.1 12.4l3.2-1.2-1.4 3.1z" opacity={0.6} />
    </G>
  ),
  // Ha Long: the junk's battened sails against the limestone karsts.
  vn: (c) => (
    <G fill={c}>
      <Path d="M2.6 15.9c.6-3.5 1.6-5.3 3-5.3s2.4 1.8 3 5.3zM17.9 15.9c.5-2.7 1.3-4.1 2.4-4.1s1.9 1.4 2.4 4.1z" opacity={0.4} />
      <Path d="M12.3 4.1l4.4 5.2h-4.4zM12.3 10.3l5.3 5.1h-5.3z" />
      <Path d="M10.9 4.9L7.6 9.3h3.3zM10.9 10.6l-4.1 4.8h4.1z" opacity={0.72} />
      <Rect x="11.2" y="3.1" width="1.2" height="12.6" rx="0.4" />
      <Path d="M2.4 17.2h19.2c-.9 2.4-2.7 3.6-5.4 3.6H7.8c-2.7 0-4.5-1.2-5.4-3.6z" />
    </G>
  ),
  // Borobudur: the stepped terraces crowned by bell stupas.
  id: (c) => (
    <G fill={c}>
      <Path d="M12 2.6c1.15 0 2.05.95 2.05 2.1 0 1.1-.9 2-2.05 2s-2.05-.9-2.05-2c0-1.15.9-2.1 2.05-2.1z" />
      <Path d="M11.55 1.5h.9v1.3h-.9z" opacity={0.7} />
      <Path d="M8.4 7.2h7.2v2.2H8.4z" />
      <Path d="M6.4 10.9c.85 0 1.5.7 1.5 1.55v.75H4.9v-.75c0-.85.65-1.55 1.5-1.55zM17.6 10.9c.85 0 1.5.7 1.5 1.55v.75h-3v-.75c0-.85.65-1.55 1.5-1.55zM12 10.4c.9 0 1.6.75 1.6 1.65v.85h-3.2v-.85c0-.9.7-1.65 1.6-1.65z" opacity={0.62} />
      <Path d="M6.2 9.6h11.6v2h-11.6z" opacity={0.85} />
      <Path d="M4.4 13.7h15.2v2.4H4.4zM2.6 16.5h18.8v2.5H2.6zM1.2 19.4h21.6v2.3H1.2z" />
    </G>
  ),
  // A Dutch windmill: cap, stage and four sails.
  nl: (c) => (
    <G fill={c}>
      <Path d="M8.9 10.2h6.2l1.5 11.5H7.4z" />
      <Path d="M9.4 7.9h5.2l.7 2.1H8.7z" opacity={0.85} />
      <Path d="M12 5.4l2.1 2.2H9.9z" opacity={0.7} />
      <Path d="M11.5 2.1h1v4h-1zM11.5 9.6h1v3.9h-1z" opacity={0.55} />
      <Path d="M11.35 6.75h1.3v1.3h-1.3z" />
      <Path d="M12.3 6.1h5.1v1.2h-5.1zM6.6 7.5h5.1v1.2H6.6z" opacity={0.55} />
      <Path d="M11.35 6.05h1.3v1.4h-1.3z" />
      <Path d="M4.9 20.4h14.2v1.3H4.9z" opacity={0.75} />
    </G>
  ),
  // Sagrada Família: the bundle of tapering spires.
  es: (c) => (
    <G fill={c}>
      <Path d="M12 1.2l1.5 4.6c.5 1.5.75 2.9.75 4.3v11.6h-4.5V10.1c0-1.4.25-2.8.75-4.3z" />
      <Path d="M7.3 4.4l1.2 3.8c.4 1.25.6 2.4.6 3.5v10h-3.6v-10c0-1.1.2-2.25.6-3.5zM16.7 4.4l1.2 3.8c.4 1.25.6 2.4.6 3.5v10h-3.6v-10c0-1.1.2-2.25.6-3.5z" opacity={0.72} />
      <Path d="M3.4 8.1l.9 2.8c.3.95.45 1.8.45 2.6v8.2H2.05v-8.2c0-.8.15-1.65.45-2.6zM20.6 8.1l.9 2.8c.3.95.45 1.8.45 2.6v8.2h-2.7v-8.2c0-.8.15-1.65.45-2.6z" opacity={0.45} />
    </G>
  ),
  // The Parthenon: pediment on a colonnade and stylobate.
  gr: (c) => (
    <G fill={c}>
      <Path d="M12 3.4l9.4 4.4H2.6z" />
      <Path d="M2.9 8.6h18.2v1.7H2.9z" opacity={0.85} />
      <Path d="M4.2 10.9h2v7.4h-2zM8 10.9h2v7.4H8zM11.8 10.9h2v7.4h-2zM15.6 10.9h2v7.4h-2zM19 10.9h1.8v7.4H19z" />
      <Path d="M2.9 18.9h18.2v1.4H2.9zM1.9 20.7h20.2v1.3H1.9z" opacity={0.8} />
    </G>
  ),
  // Torre de Belém: the tiered keep and the battlemented bastion at the water.
  pt: (c) => (
    <G fill={c}>
      <Path d="M9.4 4.7h5.2v2h-5.2z" />
      <Path d="M9.4 3.5h1.1v1.4H9.4zM11.45 3.5h1.1v1.4h-1.1zM13.5 3.5h1.1v1.4h-1.1z" opacity={0.85} />
      <Path d="M9.9 6.9h4.2v9.4H9.9z" />
      <Path d="M7.4 9.4h2.2v6.9H7.4zM14.4 9.4h2.2v6.9h-2.2z" opacity={0.6} />
      <Path d="M11.15 11.2h1.7v2.4h-1.7z" opacity={0.35} />
      <Path d="M4.6 16.6h14.8v3.5H4.6z" opacity={0.85} />
      <Path d="M4.6 15.4h1.4v1.4H4.6zM7.1 15.4h1.4v1.4H7.1zM15.5 15.4h1.4v1.4h-1.4zM18 15.4h1.4v1.4H18z" opacity={0.6} />
      <Path d="M1.8 20.6h20.4v1.2H1.8z" opacity={0.5} />
    </G>
  ),
  // Cristo Redentor: the outstretched arms on the peak.
  br: (c) => (
    <G fill={c}>
      <Circle cx="12" cy="3.4" r="1.5" />
      <Path d="M11.1 5.4h1.8l.5 7.4h-2.8z" />
      <Path d="M3.6 6.5h16.8v1.7H3.6z" />
      <Path d="M10.5 12.4h3v2.1h-3z" opacity={0.8} />
      <Path d="M12 13.9l7.6 7.8H4.4z" opacity={0.42} />
    </G>
  ),
  // Chichén Itzá: the stepped pyramid with its central stair and temple.
  mx: (c) => (
    <G fill={c}>
      <Path d="M9.7 3.9h4.6v2.3H9.7z" />
      <Path d="M8.9 6.4h6.2l1 2.4H7.9zM7.4 9.1h9.2l1.1 2.6H6.3zM5.7 12h12.6l1.2 2.7H4.5zM3.8 15h16.4l1.3 2.8H2.5zM1.8 18.1h20.4l1.1 2.6H.7z" />
      <Path d="M10.9 6.4h2.2v14.3h-2.2z" opacity={0.32} />
    </G>
  ),
  // Burj Khalifa: the setback spiral tapering to the spire.
  ae: (c) => (
    <G fill={c}>
      <Path d="M12 .9l.5 3.4h-1z" />
      <Path d="M11.3 4.2h1.4v3.4h-1.4z" />
      <Path d="M10.3 7.4h3.4v3.3h-3.4z" />
      <Path d="M9.3 10.4h5.4v3.3H9.3z" />
      <Path d="M7.9 13.4h8.2v3.4H7.9z" />
      <Path d="M6.2 16.5h11.6v5.2H6.2z" />
      <Path d="M4.4 19.1h15.2v2.6H4.4z" opacity={0.62} />
      <Path d="M11.35 7.4h1.3v14.3h-1.3z" opacity={0.28} />
    </G>
  ),
  // A stave church: the stacked shingled gables read where a fjord would not.
  no: (c) => (
    <G fill={c}>
      <Path d="M12 1.1l.6 1.9h-1.2z" />
      <Path d="M12 3.2l2.6 3.7H9.4z" />
      <Path d="M12 6.3l4.1 4.6H7.9z" opacity={0.82} />
      <Path d="M12 9.9l5.7 5.3H6.3z" opacity={0.64} />
      <Path d="M12 13.9l7.4 5.6H4.6z" opacity={0.46} />
      <Path d="M9.3 18.4h5.4v3.3H9.3z" />
      <Path d="M2.8 20.4h18.4v1.3H2.8z" opacity={0.7} />
    </G>
  ),
};

/** The generic glyph for a trip with no matched destination and no chosen icon. */
function GenericPin(c: string) {
  return (
    <G fill={c}>
      <Path d="M12 2.2c3.5 0 6.3 2.8 6.3 6.3 0 4.4-4.6 9.6-6.3 12.7C10.3 18.1 5.7 12.9 5.7 8.5c0-3.5 2.8-6.3 6.3-6.3z" />
      <Circle cx="12" cy="8.5" r="2.4" opacity={0.35} />
    </G>
  );
}

export function DestinationIcon({
  destination,
  size = 22,
  color,
}: {
  /** A key from the destinations table, or null for the generic pin. */
  destination: DestinationKey | null;
  size?: number;
  color: string;
}) {
  const render = destination ? LANDMARKS[destination] : undefined;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {render ? render(color) : GenericPin(color)}
    </Svg>
  );
}

/** Every destination that has a landmark, in table order — the picker's grid. */
export function hasLandmark(key: string): key is DestinationKey {
  return key in LANDMARKS;
}
