import React from 'react';
import { Animated } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

export interface DancingCowProps {
  progress?: Animated.Value;
  motion: 'full' | 'reduced' | 'off';
  size?: number;
  exportMode?: boolean;
}

const CREAM = '#FFF4D6';
const GREEN = '#174D3A';
const PINK = '#E9A5A0';
const HOOF = '#2B332E';

/**
 * An original, compact dancing cow drawn entirely from SVG primitives. Animation is owned by
 * the story viewer: this component only maps its normalized progress onto a two-beat heel-toe
 * bounce, which keeps export and reduced-motion renders deterministic.
 */
export function DancingCow({
  progress,
  motion,
  size = 144,
  exportMode = false,
}: DancingCowProps) {
  const animate = motion === 'full' && !exportMode && progress;
  const transform = animate
    ? [
        {
          translateY: animate.interpolate({
            inputRange: [0, 0.18, 0.36, 0.55, 0.72, 1],
            outputRange: [0, -7, 0, -6, 0, -2],
          }),
        },
        {
          rotate: animate.interpolate({
            inputRange: [0, 0.18, 0.36, 0.55, 0.72, 1],
            outputRange: ['-5deg', '5deg', '-4deg', '4deg', '-3deg', '-4deg'],
          }),
        },
        {
          scaleX: animate.interpolate({
            inputRange: [0, 0.18, 0.36, 0.55, 0.72, 1],
            outputRange: [1, 0.96, 1.04, 0.97, 1.03, 1.02],
          }),
        },
      ]
    : [{ translateY: -2 }, { rotate: '-4deg' }, { scaleX: 1.02 }];

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Dancing cow"
      testID="dancing-cow-motion"
      style={{ width: size, height: size, transform }}
    >
      <Svg width={size} height={size} viewBox="0 0 144 144" fill="none">
        <Ellipse cx={73} cy={132} rx={43} ry={5} fill="#092D22" opacity={0.15} />

        {/* Raised back leg and tail sit behind the body. */}
        <G>
          <Path
            d="M96 97 C111 94 118 83 116 72 C115 67 119 65 122 69 C127 79 122 96 107 104 L101 111 Z"
            fill={CREAM}
            stroke={GREEN}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path d="M116 72 C127 66 130 58 126 53" stroke={GREEN} strokeWidth={4} strokeLinecap="round" />
          <Ellipse cx={126} cy={51} rx={5} ry={7} fill={GREEN} rotation={-35} originX={126} originY={51} />
        </G>

        {/* Rounded body with asymmetrical patches. */}
        <Path
          d="M35 58 C39 42 55 34 77 35 C102 36 116 51 113 77 C111 99 99 114 76 116 C50 118 33 103 31 81 C30 72 31 64 35 58 Z"
          fill={CREAM}
          stroke={GREEN}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <Path d="M39 59 C46 45 59 39 71 39 C70 50 64 61 52 66 C47 67 42 64 39 59 Z" fill={GREEN} />
        <Path d="M85 88 C99 82 108 87 108 99 C103 108 95 113 82 115 C78 105 79 95 85 88 Z" fill={GREEN} />
        <Ellipse cx={73} cy={75} rx={8} ry={12} fill={GREEN} rotation={24} originX={73} originY={75} />

        {/* Head, ears and small horns. */}
        <Path d="M45 42 C36 34 29 37 31 44 C33 50 39 51 47 48 Z" fill={CREAM} stroke={GREEN} strokeWidth={3} />
        <Path d="M94 42 C103 33 111 36 109 44 C107 50 101 51 93 48 Z" fill={CREAM} stroke={GREEN} strokeWidth={3} />
        <Path d="M49 37 C44 29 46 24 52 26 C56 28 56 33 55 39 Z" fill="#E7C77C" stroke={GREEN} strokeWidth={2.5} />
        <Path d="M89 38 C88 29 91 25 96 27 C100 30 97 35 94 40 Z" fill="#E7C77C" stroke={GREEN} strokeWidth={2.5} />
        <Ellipse cx={71} cy={48} rx={28} ry={23} fill={CREAM} stroke={GREEN} strokeWidth={3} />
        <Path d="M48 43 C52 32 60 27 69 27 C67 38 62 46 52 50 Z" fill={GREEN} />

        {/* Face remains legible when the whole cow is thumbnail-sized. */}
        <Circle cx={61} cy={46} r={3.2} fill={GREEN} />
        <Circle cx={81} cy={46} r={3.2} fill={GREEN} />
        <Circle cx={60} cy={45} r={0.9} fill="white" />
        <Circle cx={80} cy={45} r={0.9} fill="white" />
        <Rect x={54} y={55} width={34} height={17} rx={8.5} fill={PINK} stroke={GREEN} strokeWidth={2.5} />
        <Ellipse cx={64} cy={63} rx={2} ry={2.6} fill={GREEN} opacity={0.75} />
        <Ellipse cx={78} cy={63} rx={2} ry={2.6} fill={GREEN} opacity={0.75} />
        <Path d="M67 66 Q71 69 75 66" stroke={GREEN} strokeWidth={2} strokeLinecap="round" />

        {/* Bent forelegs: one planted, one waving across the chest. */}
        <Path
          d="M45 82 C35 84 31 95 37 102 C41 106 47 102 48 96 L51 88"
          stroke={GREEN}
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Ellipse cx={37} cy={103} rx={6} ry={4} fill={HOOF} rotation={25} originX={37} originY={103} />
        <Path
          d="M96 77 C106 70 114 75 111 84 C108 92 98 89 91 95"
          stroke={CREAM}
          strokeWidth={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path d="M110 81 C114 78 118 79 120 83" stroke={HOOF} strokeWidth={6} strokeLinecap="round" />

        {/* Heel-toe stance: one straight hoof and one forward toe. */}
        <Path d="M57 108 C57 118 55 124 52 129" stroke={CREAM} strokeWidth={12} strokeLinecap="round" />
        <Rect x={45} y={125} width={15} height={8} rx={4} fill={HOOF} rotation={-8} originX={52} originY={129} />
        <Path d="M83 109 C84 118 89 123 97 126" stroke={CREAM} strokeWidth={12} strokeLinecap="round" />
        <Path d="M94 122 C103 123 108 127 105 132 C99 135 92 132 88 128 Z" fill={HOOF} />
      </Svg>
    </Animated.View>
  );
}
