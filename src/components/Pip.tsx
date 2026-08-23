import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Rect, G } from 'react-native-svg';
import { useReducedMotion } from '../state/useReducedMotion';
import { duration as motionDuration } from '../theme/motion';

/** The coin palette, shared with the (now retired) CoinMascot artwork so Pip reads as one
 *  character app-wide instead of a shape that recolours per accent preset. Deliberately fixed:
 *  the accent still drives buttons, chips and progress, just not the mascot. */
const COIN_RIM = '#F5B42A';
const COIN_FACE = '#FAC438';
const COIN_BEVEL = '#D99E18';
const COIN_INK = '#7A4800';
const LEAF_LEFT = '#1c7a4e';
const LEAF_RIGHT = '#2aab68';
const LEAF_STEM = '#185e3e';
const BLUSH = '#F07828';

/** Straw-hat palette (`hat`). Paler and far less saturated than the coin it sits on — a true
 *  straw yellow would sink into the gold — and the red band does most of the separating. */
const STRAW = '#F0DCA4';
const STRAW_LINE = '#B08A3E';
const HAT_BAND = '#D6453F';

/** Propeller-hat palette (`propellerHat`) — a color-blocked party cap matched to the reference
 *  toy: yellow/red crown halves with a blue seam and brim trim, and a green brim. */
const CAP_YELLOW = '#F5C542';
const CAP_RED = '#E8453C';
const CAP_TRIM = '#3F6FD1';
const CAP_BRIM = '#2E9E5B';
const CAP_BRIM_LINE = '#1F7A44';

/** Cool-pose palette (`glasses`). The gloves are off-white with a warm brown outline rather than
 *  flat white: unoutlined pale hands disappear against a light page, and a neutral grey outline
 *  would pull them out of the coin's family. Teeth are near-white for the same reason. */
const SHADE_FRAME = '#232323';
const SHADE_LENS = '#2E2E33';
const HAND_FILL = '#FFF6E4';
const HAND_LINE = '#8A5A16';
const TEETH = '#FFFDF5';

/** Nerd-pose palette (`nerdy`). */
const PIMPLE = '#E8703A';

/** Idea-bulb palette. Warmer and lighter than the coin so the bulb still reads as a separate
 *  lit object floating above Pip rather than a third piece of his body. */
const BULB_GLASS = '#FFE49A';
const BULB_RIM = '#E7A81B';
const BULB_RAY = '#F2B024';
const BULB_COLLAR = '#D8B564';
const BULB_SCREW = '#A8842F';

// docs/ui-engagement-plan.md Step 3: 4 static poses -> 7, each tied to something that actually
// happened rather than decoration. `sheepish` is reserved for Pip's own mistakes (a bad parse,
// a wrong guess) and must never fire in response to the user's spending  see §1 of that doc.
export type PipExpr = 'idle' | 'happy' | 'think' | 'curious' | 'proud' | 'sheepish' | 'sleepy';

/** Only expressions with open, circle-drawn eyes have anything to blink. `happy`/`proud` are
 *  already closed-eye grins and `sleepy` is already half-lidded, so all three are excluded
 *  rather than made to blink shut on top of an already-shut look. */
const BLINKABLE: PipExpr[] = ['idle', 'think', 'curious', 'sheepish'];

interface EyePos {
  cx: number;
  cy: number;
  r: number;
  hx: number;
  hy: number;
  hr: number;
}

/** Circle-eye geometry, one source of truth shared by `Eyes` (what renders) and `BlinkCover`
 *  (what covers it mid-blink) so the two can never drift out of alignment. */
const EYES: Record<'idle' | 'curious' | 'think' | 'sheepish', [EyePos, EyePos]> = {
  idle: [
    { cx: 40, cy: 55, r: 4.2, hx: 41.5, hy: 53.5, hr: 1.3 },
    { cx: 60, cy: 55, r: 4.2, hx: 61.5, hy: 53.5, hr: 1.3 },
  ],
  curious: [
    { cx: 40, cy: 55, r: 4.4, hx: 41.6, hy: 53.4, hr: 1.4 },
    { cx: 60, cy: 54, r: 5.2, hx: 61.8, hy: 52.2, hr: 1.6 },
  ],
  // Narrowed and glancing up-and-off-centre rather than front-on: reads as "working the
  // problem" instead of surprised. Paired with the single raised brow in `Eyes` below.
  think: [
    { cx: 42, cy: 50, r: 3.4, hx: 43.1, hy: 48.3, hr: 1.0 },
    { cx: 62, cy: 49, r: 3.4, hx: 63.1, hy: 47.3, hr: 1.0 },
  ],
  sheepish: [
    { cx: 40, cy: 58, r: 3.6, hx: 41.1, hy: 56.9, hr: 1.0 },
    { cx: 60, cy: 58, r: 3.6, hx: 61.1, hy: 56.9, hr: 1.0 },
  ],
};

/** Fixed (start -> outward) anchor points for the `celebrate` sparkle burst, chosen to stay
 *  clear of the face (roughly x 34-66, y 50-70) so a payoff never occludes the expression that
 *  is doing the actual emotional work. */
const SPARKLES: { x0: number; y0: number; x1: number; y1: number }[] = [
  { x0: 66, y0: 28.3, x1: 74, y1: 15 },
  { x0: 34, y0: 28.3, x1: 26, y1: 15 },
  { x0: 80, y0: 67, x1: 93, y1: 72 },
  { x0: 20, y0: 45, x1: 7, y1: 40 },
];

// react-native-svg's numeric props (cx/cy/r/ry/opacity) aren't typed to accept an Animated
// value, so `createAnimatedComponent` needs a narrow local re-type rather than the library's
// own. Contained to this file; nothing downstream sees it.
type AnimNum = number | Animated.Value | Animated.AnimatedInterpolation<number>;
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse) as unknown as React.ComponentType<{
  cx: AnimNum;
  cy: AnimNum;
  rx: AnimNum;
  ry: AnimNum;
  fill?: string;
}>;
const AnimatedCircle = Animated.createAnimatedComponent(Circle) as unknown as React.ComponentType<{
  cx: AnimNum;
  cy: AnimNum;
  r: AnimNum;
  fill?: string;
  opacity?: AnimNum;
}>;
/** Multiply each RGB channel of a #rrggbb hex by `factor` (brightness shade). */
function shade(hex: string, factor: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.max(0, Math.min(255, Math.round(c * factor)))
  );
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}

function Eyes({ expr, INK }: { expr: PipExpr; INK: string }) {
  if (expr === 'happy' || expr === 'proud') {
    // Closed, grinning arcs for both, `proud` swept 2px taller so the two read as related but
    // not identical at a glance (docs/ui-engagement-plan.md Step 3 visual direction).
    const lift = expr === 'proud' ? 2 : 0;
    return (
      <G fill="none" stroke={INK} strokeWidth={3.4} strokeLinecap="round">
        <Path d={`M34 55 Q40 ${49 - lift} 46 55`} />
        <Path d={`M54 55 Q60 ${49 - lift} 66 55`} />
      </G>
    );
  }
  if (expr === 'sleepy') {
    return (
      <G fill={INK} opacity={0.85}>
        <Ellipse cx={40} cy={56} rx={5} ry={1.5} />
        <Ellipse cx={60} cy={56} rx={5} ry={1.5} />
      </G>
    );
  }
  const pair = EYES[expr as keyof typeof EYES] ?? EYES.idle;
  return (
    <G>
      {expr === 'think' && (
        // One raised brow, not two: the asymmetry is what makes it read as "thinking" rather
        // than "surprised".
        <Path d="M37 43 Q43 37 49 42" stroke={INK} strokeWidth={2.1} fill="none" strokeLinecap="round" />
      )}
      {expr === 'sheepish' && (
        <G stroke={INK} strokeWidth={2.1} strokeLinecap="round">
          <Path d="M35 50 L42 53.5" />
          <Path d="M65 50 L58 53.5" />
        </G>
      )}
      {pair.map((e, i) => (
        <G key={i}>
          <Circle cx={e.cx} cy={e.cy} r={e.r} fill={INK} />
          <Circle cx={e.hx} cy={e.hy} r={e.hr} fill="#fff" />
        </G>
      ))}
    </G>
  );
}

/** Covers a blinkable expression's eyes with the body colour, briefly, driven by `blink` going
 *  0 (open) -> 1 (shut) -> 0. A no-op render for any expression not in `BLINKABLE`. */
function BlinkCover({ expr, fill, blink }: { expr: PipExpr; fill: string; blink: Animated.Value }) {
  if (!BLINKABLE.includes(expr)) return null;
  const pair = EYES[expr as keyof typeof EYES];
  return (
    <G>
      {pair.map((e, i) => {
        const ry = blink.interpolate({ inputRange: [0, 1], outputRange: [0, e.r + 1] });
        return <AnimatedEllipse key={i} cx={e.cx} cy={e.cy} rx={e.r + 1.2} ry={ry} fill={fill} />;
      })}
    </G>
  );
}

/** Oversized shades, drawn wide enough to run most of the way across the face — the reference
 *  pose reads as smug because the glasses dominate, so a dainty pair would miss it. Bridge and
 *  temples go down first so the lenses cover the joins. */
function Sunglasses() {
  return (
    <G>
      <Path d="M47 51.5 Q50 48.6 53 51.5" stroke={SHADE_FRAME} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      <Path d="M29 50.5 L24.5 47.8" stroke={SHADE_FRAME} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      <Path d="M71 50.5 L75.5 47.8" stroke={SHADE_FRAME} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      <Rect x={29} y={47} width={18} height={12.5} rx={5.6} fill={SHADE_LENS} stroke={SHADE_FRAME} strokeWidth={1.7} />
      <Rect x={53} y={47} width={18} height={12.5} rx={5.6} fill={SHADE_LENS} stroke={SHADE_FRAME} strokeWidth={1.7} />
      <Ellipse cx={34.5} cy={50.5} rx={3} ry={1.7} fill="#fff" opacity={0.32} rotation={-20} originX={34.5} originY={50.5} />
      <Ellipse cx={58.5} cy={50.5} rx={3} ry={1.7} fill="#fff" opacity={0.32} rotation={-20} originX={58.5} originY={50.5} />
    </G>
  );
}

/** Two thick bars above the shades, inner ends dropped ~2 units. That tilt is the whole trick:
 *  level brows read blank behind sunglasses, inner-high reads worried, inner-low reads smug. */
function Brows({ INK }: { INK: string }) {
  return (
    <G stroke={INK} strokeWidth={4.2} strokeLinecap="round">
      <Line x1={32.5} y1={39.5} x2={45.5} y2={41.5} />
      <Line x1={67.5} y1={39.5} x2={54.5} y2={41.5} />
    </G>
  );
}

/** The reference pose's grin: a wide block of teeth rather than a drawn line. Vertical splits
 *  stop short of the bowl's edge so no tooth pokes through the outline, and the low arc is the
 *  lower row. Sized to sit clear of the blush above and the bevel edge below. */
function Grin({ INK }: { INK: string }) {
  return (
    <G>
      <Path
        d="M36 64 H64 Q62.5 79 50 79 Q37.5 79 36 64 Z"
        fill={TEETH}
        stroke={INK}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <G stroke={INK} strokeLinecap="round" fill="none">
        <G strokeWidth={1.3}>
          <Line x1={43} y1={64} x2={43} y2={74} />
          <Line x1={50} y1={64} x2={50} y2={76} />
          <Line x1={57} y1={64} x2={57} y2={74} />
        </G>
        <Path d="M39.5 72.6 Q50 78 60.5 72.6" strokeWidth={1.8} />
      </G>
    </G>
  );
}

/** Enlarged eyes for the `nerdy` pose — bigger than the plain-face `EYES.idle` pair so the face
 *  still reads at a glance now that nothing else (glasses, brows) fills the upper face. */
function NerdEyes({ INK }: { INK: string }) {
  return (
    <G>
      <Circle cx={39} cy={55} r={6.2} fill={INK} />
      <Circle cx={41.3} cy={52.6} r={1.8} fill="#fff" />
      <Circle cx={61} cy={55} r={6.2} fill={INK} />
      <Circle cx={63.3} cy={52.6} r={1.8} fill="#fff" />
    </G>
  );
}

/** A lollipop held up beside the face for the `nerdy` pose — a small fist (the cool pose's hand
 *  palette, so the two "held prop" ideas share a family) gripping a pale stick that runs up
 *  outside the right lens to a rainbow bullseye candy tucked beside the sprout. Five concentric
 *  bands rather than a gradient fill — react-native-svg gradients need a <Defs> registry, and
 *  flat concentric circles already match how every other fill in this file is drawn. Drawn after
 *  the glasses so the fist overlaps the coin's rim rather than butting into it, same as `Hands`. */
function Lollipop() {
  return (
    <G>
      <Line x1={83} y1={72} x2={75} y2={37} stroke={HAND_FILL} strokeWidth={2.6} strokeLinecap="round" />
      <Circle cx={75} cy={27} r={13} fill="#E8453C" stroke="#4A3220" strokeWidth={1.6} />
      <Circle cx={75} cy={27} r={10.4} fill="#F2954A" />
      <Circle cx={75} cy={27} r={7.8} fill="#F5D93A" />
      <Circle cx={75} cy={27} r={5.2} fill="#4FAF6D" />
      <Circle cx={75} cy={27} r={2.6} fill="#4A90D9" />
      <Ellipse cx={69.5} cy={21} rx={3.4} ry={2.1} fill="#fff" opacity={0.5} rotation={-25} originX={69.5} originY={21} />
      <Rect x={77} y={67.5} width={12} height={11} rx={5.2} fill={HAND_FILL} stroke={HAND_LINE} strokeWidth={2} />
    </G>
  );
}

/**
 * One floating thumbs-up glove — a fist with the thumb rising off its outer edge, and no arm
 * behind it, which is what the reference shows. `flip` mirrors the thumb so both hands angle up
 * and away from the coin.
 *
 * The thumb is two stacked round-capped strokes (outline width, then fill width) rather than a
 * traced outline: a capsule is exactly what a round cap gives for free. The fist then covers the
 * thumb's lower cap, and its own outline crossing there reads as the thumb crease.
 */
function Hand({ cx, cy, flip }: { cx: number; cy: number; flip?: boolean }) {
  const s = flip ? -1 : 1;
  const [tx0, ty0] = [cx + s * 2.6, cy - 3];
  const [tx1, ty1] = [cx + s * 6.4, cy - 12.6];
  const left = cx - 7;
  return (
    <G>
      <Line x1={tx0} y1={ty0} x2={tx1} y2={ty1} stroke={HAND_LINE} strokeWidth={8.8} strokeLinecap="round" />
      <Line x1={tx0} y1={ty0} x2={tx1} y2={ty1} stroke={HAND_FILL} strokeWidth={6.2} strokeLinecap="round" />
      <Rect x={left} y={cy - 6.5} width={14} height={13.5} rx={5.8} fill={HAND_FILL} stroke={HAND_LINE} strokeWidth={2.1} />
      {/* Curled-finger ridges. */}
      <G stroke={HAND_LINE} strokeWidth={1.3} strokeLinecap="round" opacity={0.75}>
        <Line x1={left + 3.6} y1={cy - 1.4} x2={left + 10.4} y2={cy - 1.4} />
        <Line x1={left + 3.6} y1={cy + 2.6} x2={left + 10.4} y2={cy + 2.6} />
      </G>
    </G>
  );
}

/**
 * A straw sun hat with a red band.
 *
 * The crown is 38 wide against a 66-wide head — a crown much narrower than that stops reading as
 * something the head could fit inside and turns into a cake perched on top. It's also deliberately
 * shallow (12 tall), both because that's the boater/sugegasa shape and because the leaves start at
 * y≈19: a taller crown would eat the sprout, which is Pip's most recognisable feature. The stub of
 * stem left showing between crown and leaves is what sells the hat as worn rather than pasted on.
 *
 * The brim's centre line sits at y=30, well inside the head's top (y=23), for the same reason — a
 * brim resting at the very top of the skull hovers. Brim first, then crown, or the crown's base
 * shows through. The band then sits inside the crown's deliberately straight-sided lower half,
 * which is the only reason a plain rect can hug it without poking out of the curve.
 */
function StrawHat() {
  return (
    <G>
      {/* Crown and band go down FIRST so the brim can occlude their base. That order is the whole
          illusion: on a wide-brim hat seen head-on you see the brim's near edge in front of the
          crown, and the crown emerges from behind it. Drawn the other way round the crown sits on
          top as a complete box and the hat reads as a cake on a plate.
          Everything below y≈28.5 here is therefore hidden, including the straight sides — those
          exist only so a plain <Rect> band can hug the crown without poking out of a curve. */}
      {/* The base flares out to x 25/75, wider than the dome above it, because the skull keeps
          widening as it drops: a straight-sided crown lets a sliver of gold show between its side
          and the brim's top edge. All of the flare below y≈32 is hidden by the brim. */}
      <Path
        d="M25 38 L29 27 C29.5 21 37 17.5 50 17.5 C63 17.5 70.5 21 71 27 L75 38 Z"
        fill={STRAW}
        stroke={STRAW_LINE}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      {/* A trapezoid, not a rect, so it follows that flare instead of leaving bare corners where
          the crown has already widened past it. Inset 0.9 to clear the crown's own stroke. */}
      <Path d="M29.9 27 L70.1 27 L73.74 37 L26.26 37 Z" fill={HAT_BAND} />
      {/* Cast shadow, drawn just before the brim so only a crescent of it escapes below the brim's
          edge. This is what stops the hat reading as a disc hovering in front of Pip's face. */}
      <Ellipse cx={50} cy={40.5} rx={34} ry={7} fill="rgba(120,80,20,0.2)" />
      {/* ry is only 6.5 against rx 36: seen head-on a brim is a shallow band, and a deeper ellipse
          turns into a saucer that swallows the crown. */}
      <Ellipse cx={50} cy={38} rx={36} ry={6.5} fill={STRAW} stroke={STRAW_LINE} strokeWidth={1.8} />
      {/* One woven ring: the cheapest cue that the brim is straw rather than felt. */}
      <Ellipse cx={50} cy={38} rx={29} ry={4.8} fill="none" stroke={STRAW_LINE} strokeWidth={1.1} opacity={0.45} />
    </G>
  );
}

/**
 * A color-blocked propeller cap (`propellerHat`), sharing `StrawHat`'s crown/brim silhouette so
 * it sits in the same spot on Pip's head, but with a yellow/red split crown, blue edge slivers
 * (echoing the reference toy's side panels peeking past the front), and a green brim.
 */
function PropellerCap() {
  return (
    <G>
      <Path d="M25 38 L29 27 C29.5 21 37 17.5 50 17.5 L50 38 Z" fill={CAP_YELLOW} />
      <Path d="M75 38 L71 27 C70.5 21 63 17.5 50 17.5 L50 38 Z" fill={CAP_RED} />
      <Path d="M25 38 L29 27 C29.5 21 33 18.5 36 18.3 L32 38 Z" fill={CAP_TRIM} />
      <Path d="M75 38 L71 27 C70.5 21 67 18.5 64 18.3 L68 38 Z" fill={CAP_TRIM} />
      <Line x1={50} y1={17.5} x2={50} y2={38} stroke={CAP_TRIM} strokeWidth={1.2} opacity={0.5} />
      <Ellipse cx={50} cy={40.5} rx={34} ry={7} fill="rgba(20,50,30,0.18)" />
      <Ellipse cx={50} cy={38} rx={36} ry={6.5} fill={CAP_BRIM} stroke={CAP_BRIM_LINE} strokeWidth={1.8} />
      <Ellipse cx={50} cy={38} rx={29} ry={4.8} fill="none" stroke={CAP_BRIM_LINE} strokeWidth={1.1} opacity={0.45} />
    </G>
  );
}

/** Both hands, deliberately not level: the reference holds one up by the face and one low and
 *  out. Mirrored heights would read as a jumping-jack rather than a pose. */
function Hands() {
  return (
    <G>
      <Hand cx={14} cy={56} flip />
      <Hand cx={84} cy={71} />
    </G>
  );
}

function Mouth({ expr, INK }: { expr: PipExpr; INK: string }) {
  if (expr === 'happy') return <Path d="M39 63 Q50 78 61 63 Q50 71 39 63 Z" fill={INK} />;
  if (expr === 'proud') return <Path d="M37 62 Q50 80 63 62 Q50 72 37 62 Z" fill={INK} />;
  if (expr === 'think') return <Path d="M44 66 L56 66" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />;
  if (expr === 'curious')
    return <Path d="M45 66 Q50 71 55 66" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />;
  if (expr === 'sheepish')
    return (
      <Path d="M43 68 Q46.5 70.5 50 68 Q53.5 65.5 57 68" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
    );
  if (expr === 'sleepy') return <Ellipse cx={50} cy={69} rx={3.4} ry={2.6} fill={INK} opacity={0.85} />;
  return <Path d="M43 64 Q50 71 57 64" fill="none" stroke={INK} strokeWidth={3.2} strokeLinecap="round" />; // idle
}

/**
 * The "he just had an idea" light bulb that sits above Pip's head (docs/ui-engagement-plan.md
 * Step 3). Drawn in its own small Svg stacked above the character rather than inside Pip's
 * 100x100 canvas: the sprout already owns the top of that viewBox and there is no room above
 * y=0 to put a bulb, so extending the canvas would have shrunk Pip himself at every call site.
 *
 * Two beats, both skipped under reduced motion (which mounts the bulb already lit and still):
 * a delayed overshoot pop, so it lands *after* the head has settled and reads as a thought
 * arriving, and a slow glow pulse behind the glass.
 */
function IdeaBulb({ size }: { size: number }) {
  const reducedMotion = useReducedMotion();
  const pop = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      pop.setValue(1);
      return;
    }
    pop.setValue(0);
    const a = Animated.timing(pop, {
      toValue: 1,
      duration: motionDuration.celebrate,
      delay: 280,
      easing: Easing.out(Easing.back(2.4)),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [pop, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) {
      glow.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glow, reducedMotion]);

  // The glass sits at (20, 18.5) in the 40-unit viewBox below, so the halo is centred on that
  // point rather than on the box, which also carries the rays and the screw base.
  const halo = size * 0.72;
  const haloLeft = size * 0.5 - halo / 2;
  const haloTop = size * (18.5 / 40) - halo / 2;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        width: size,
        height: size,
        // Tucks the screw base down against the sprout: the bottom ~15% of the viewBox is
        // deliberately empty so the bulb can overlap that gap instead of floating away.
        marginBottom: -size * 0.14,
        opacity: pop.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
        transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }],
      }}
    >
      <Animated.View
        style={[
          styles.halo,
          {
            left: haloLeft,
            top: haloTop,
            width: halo,
            height: halo,
            borderRadius: halo / 2,
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.6] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.14] }) }],
          },
        ]}
      />
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <G stroke={BULB_RAY} strokeWidth={2.1} strokeLinecap="round">
          <Line x1={20} y1={5.3} x2={20} y2={1.5} />
          <Line x1={10.7} y1={9.2} x2={8} y2={6.5} />
          <Line x1={29.3} y1={9.2} x2={32} y2={6.5} />
          <Line x1={7.3} y1={15.1} x2={3.6} y2={14.1} />
          <Line x1={32.7} y1={15.1} x2={36.4} y2={14.1} />
        </G>
        <Circle cx={20} cy={18.5} r={10.5} fill={BULB_GLASS} stroke={BULB_RIM} strokeWidth={1.6} />
        <Ellipse cx={15.5} cy={14} rx={3.2} ry={2} fill="#fff" opacity={0.6} rotation={-35} originX={15.5} originY={14} />
        {/* Filament */}
        <Path
          d="M16.6 19.8 Q18.3 16.6 20 19.8 Q21.7 23 23.4 19.8"
          stroke={BULB_RIM}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
        />
        <Rect x={14.4} y={27} width={11.2} height={3.4} rx={1.5} fill={BULB_COLLAR} />
        <Rect x={15.4} y={30.8} width={9.2} height={3.2} rx={1.5} fill={BULB_SCREW} />
      </Svg>
    </Animated.View>
  );
}

const HatContext = createContext(false);

/**
 * Puts the straw hat on every <Pip> rendered inside, including the ones nested in <PipSays> on
 * child screens. Scoped this way because the add-a-transaction flow spans eight screens and
 * <PipSays> is shared with screens outside it (Commitments, Owed, the balance scan) — threading a
 * prop would mean touching ~30 call sites and would still put the hat on the wrong ones.
 *
 * An explicit `hat` on a Pip still wins, so a call site inside the flow can opt out.
 */
export function PipWearsHat({ children }: { children: React.ReactNode }) {
  return <HatContext.Provider value={true}>{children}</HatContext.Provider>;
}

export function Pip({
  size = 96,
  expr = 'idle',
  color,
  float = false,
  celebrate = false,
  idea = false,
  glasses = false,
  nerdy = false,
  hat,
  propellerHat = false,
}: {
  size?: number;
  expr?: PipExpr;
  color?: string;
  float?: boolean;
  /** One-shot sparkle burst for a reward moment (docs/ui-engagement-plan.md Step 3: the Saved
   *  screen's reveal). Fires whenever this flips to true; does nothing on `false` or while it
   *  stays true. Skipped entirely under reduced motion. */
  celebrate?: boolean;
  /** Draws a lit bulb above Pip's head. Pairs with `expr="think"`, and adds roughly 38% of
   *  `size` to the rendered height, so a caller that swaps it on and off mid-screen should
   *  reserve the taller box (see NotificationsStep) rather than let the layout jump. */
  idea?: boolean;
  /** The "cool" pose (the widget step's hero): shades, brows, a toothy grin, and a floating
   *  thumbs-up either side. It replaces the whole face, so `expr` is ignored while it's on.
   *  Stays inside the same 100x100 box — the hands fill margin the coin never used — so turning
   *  it on doesn't change the rendered size. */
  glasses?: boolean;
  /** The "nerd" pose (the empty-state hero): big eyes, a simple smile, cheek freckles, and a
   *  held rainbow lollipop. Also replaces the whole face, so `expr` is ignored while it's on. */
  nerdy?: boolean;
  /** Straw hat. Leave undefined to inherit from <PipWearsHat> (which is how the whole
   *  add-a-transaction flow gets it); pass `false` to opt a single Pip out inside that flow. */
  hat?: boolean;
  /** A color-blocked party cap. Takes over the head slot from `hat`/`PipWearsHat` entirely while
   *  on — a coin only wears one hat at a time. */
  propellerHat?: boolean;
}) {
  // The body is the coin, not the accent: Pip is one fixed character everywhere rather than a
  // shape that recolours per preset. `fill` is the bevel (COIN_FACE), because that disc is what
  // the face sits on and what BlinkCover paints over the eyes mid-blink.
  const fill = color ?? COIN_FACE;
  // Eyes and mouth must always contrast against the body; the structural ink flips to near-white
  // in dark mode (unusable on gold), so use the coin's own brown, or derive one when a caller
  // overrides the body colour.
  const INK = color ? shade(color, 0.38) : COIN_INK;
  const ty = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();
  // Read unconditionally — `hat ?? useContext(...)` would short-circuit the hook away whenever the
  // prop is passed, changing hook order between renders.
  const hatFromFlow = useContext(HatContext);
  const wearsHat = hat ?? hatFromFlow;

  useEffect(() => {
    if (!float || reducedMotion) {
      ty.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ty, {
          toValue: -5,
          duration: 1700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ty, {
          toValue: 0,
          duration: 1700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float, reducedMotion, ty]);

  // Micro-idle: a blink every 4-7s, randomised so two Pips on screen never sync up. The single
  // cheapest cue that reads as "alive" (docs/ui-engagement-plan.md §2.1).
  useEffect(() => {
    if (reducedMotion || glasses || nerdy || !BLINKABLE.includes(expr)) {
      blink.setValue(0);
      return;
    }
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      timeout = setTimeout(() => {
        if (cancelled) return;
        Animated.sequence([
          Animated.timing(blink, { toValue: 1, duration: 70, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(blink, { toValue: 0, duration: 90, easing: Easing.in(Easing.quad), useNativeDriver: false }),
        ]).start(({ finished }) => {
          if (finished && !cancelled) scheduleBlink();
        });
      }, 4000 + Math.random() * 3000);
    };
    scheduleBlink();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      blink.setValue(0);
    };
  }, [expr, reducedMotion, glasses, nerdy, blink]);

  useEffect(() => {
    if (!celebrate || reducedMotion) {
      burst.setValue(0);
      return;
    }
    burst.setValue(0);
    Animated.timing(burst, {
      toValue: 1,
      duration: motionDuration.celebrate,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [celebrate, reducedMotion, burst]);

  return (
    <Animated.View style={{ alignItems: 'center', transform: [{ translateY: ty }] }}>
      {idea && <IdeaBulb size={size * 0.44} />}
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* shadow */}
        <Ellipse cx={50} cy={92} rx={22} ry={4.5} fill="rgba(16,40,28,0.12)" />

        {/* sprout — green regardless of body colour, same two-tone leaves as the coin */}
        <Path d="M50 26 C50 18 50 14 50 12" stroke={LEAF_STEM} strokeWidth={3.2} fill="none" strokeLinecap="round" />
        <Ellipse cx={42} cy={15} rx={7.5} ry={4.2} fill={LEAF_LEFT} rotation={-32} originX={42} originY={15} />
        <Ellipse cx={58} cy={13} rx={8.5} ry={4.6} fill={LEAF_RIGHT} rotation={28} originX={58} originY={13} />

        {/* body — coin rim, then the bevel disc the face sits on (coin geometry scaled by
            33/15.5 from the 56 viewBox the artwork was originally drawn in) */}
        <Circle cx={50} cy={56} r={33} fill={color ? shade(fill, 0.93) : COIN_RIM} />
        <Circle cx={50} cy={56} r={26.6} fill={fill} />
        <Circle cx={50} cy={56} r={26.6} fill="none" stroke={color ? shade(fill, 0.8) : COIN_BEVEL} strokeWidth={2.6} />
        {/* top highlight */}
        <Ellipse cx={35} cy={42} rx={8.5} ry={4.9} fill="rgba(255,255,255,0.23)" rotation={-26} originX={35} originY={42} />
        {/* blush */}
        <Ellipse cx={32} cy={60.3} rx={5.3} ry={3.4} fill={BLUSH} opacity={0.3} />
        <Ellipse cx={68} cy={60.3} rx={5.3} ry={3.4} fill={BLUSH} opacity={0.3} />

        {/* After the body so the brim sits over the head, but before the face, which it never
            reaches — the sprout above it is drawn earlier and stays clear of the crown.
            `propellerHat` takes the head slot outright — a coin only wears one hat. */}
        {propellerHat ? <PropellerCap /> : wearsHat && <StrawHat />}

        {/* The cool and nerdy poses each own the whole face, so `expr` and everything keyed off it
            (the sheepish sweat drop, the sleepy Zs, blinking) sits inside the plain branch rather
            than leaking a second mood on top of either pair of glasses. */}
        {glasses ? (
          <>
            <Brows INK={INK} />
            <Sunglasses />
            <Grin INK={INK} />
          </>
        ) : nerdy ? (
          <>
            <NerdEyes INK={INK} />
            <Path d="M41 65 Q50 73 59 65" fill="none" stroke={INK} strokeWidth={3.2} strokeLinecap="round" />
            {/* Cheek freckles, drawn over the ambient blush so they read as raised spots rather
                than smudges. */}
            <Circle cx={30.5} cy={68} r={1.3} fill={PIMPLE} opacity={0.85} />
            <Circle cx={69.5} cy={68} r={1.3} fill={PIMPLE} opacity={0.85} />
          </>
        ) : (
          <>
            {expr === 'sheepish' && <Ellipse cx={70} cy={40} rx={2.1} ry={3} fill="rgba(140,195,255,0.85)" />}
            <Eyes expr={expr} INK={INK} />
            <BlinkCover expr={expr} fill={fill} blink={blink} />
            <Mouth expr={expr} INK={INK} />
            {expr === 'sleepy' && (
              <>
                <Path
                  d="M74 26 L81 26 L74 32 L81 32"
                  stroke={INK}
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.7}
                />
                <Path
                  d="M79 18 L85.5 18 L79 23.5 L85.5 23.5"
                  stroke={INK}
                  strokeWidth={1.3}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.55}
                />
                <Path
                  d="M84 11.5 L89 11.5 L84 16 L89 16"
                  stroke={INK}
                  strokeWidth={1}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.4}
                />
              </>
            )}
          </>
        )}

        {/* After the body, so each fist overlaps the rim it sits against instead of butting into
            it. Before the sparkles, which should read over everything. */}
        {glasses && <Hands />}
        {nerdy && <Lollipop />}

        {SPARKLES.map((s, i) => {
          const cx = burst.interpolate({ inputRange: [0, 1], outputRange: [s.x0, s.x1] });
          const cy = burst.interpolate({ inputRange: [0, 1], outputRange: [s.y0, s.y1] });
          const r = burst.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 2.6, 0] });
          const opacity = burst.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 1, 0] });
          // Warm white, not gold: the burst starts at the body's edge, and gold-on-gold would
          // swallow the first frames of the payoff now that the body is a coin.
          return <AnimatedCircle key={i} cx={cx} cy={cy} r={r} opacity={opacity} fill="#FFFBEA" />;
        })}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  halo: { position: 'absolute', backgroundColor: 'rgba(255, 205, 90, 0.5)' },
});
