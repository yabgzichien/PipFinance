import React, { useEffect, useRef } from 'react';
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

export function Pip({
  size = 96,
  expr = 'idle',
  color,
  float = false,
  celebrate = false,
  idea = false,
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
    if (reducedMotion || !BLINKABLE.includes(expr)) {
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
  }, [expr, reducedMotion, blink]);

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

        {expr === 'sheepish' && <Ellipse cx={70} cy={40} rx={2.1} ry={3} fill="rgba(140,195,255,0.85)" />}

        <Eyes expr={expr} INK={INK} />
        <BlinkCover expr={expr} fill={fill} blink={blink} />
        <Mouth expr={expr} INK={INK} />

        {expr === 'sleepy' && (
          <Path
            d="M74 20 L82 20 L74 27 L82 27"
            stroke={INK}
            strokeWidth={1.6}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.7}
          />
        )}

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
