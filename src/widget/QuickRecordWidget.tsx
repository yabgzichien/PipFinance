import React from 'react';
import { FlexWidget, SvgWidget } from 'react-native-android-widget';

export interface QuickRecordWidgetProps {
  streak?: number;
}

function getMascotStreakSvg(streak: number = 0): string {
  const streakStr = String(streak);
  const pillW = streakStr.length >= 3 ? 40 : streakStr.length === 2 ? 34 : 28;
  const pillX = streakStr.length >= 3 ? 34 : streakStr.length === 2 ? 38 : 42;
  const textX = streakStr.length >= 3 ? 59 : streakStr.length === 2 ? 59 : 58;
  const flameX = pillX + 3;
  const flameY = 41;

  return `
<svg width="76" height="64" viewBox="0 0 76 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Avatar Circle -->
  <circle cx="32" cy="32" r="28" fill="#FFFFFF" stroke="#EAE5DA" stroke-width="1.2" />

  <!-- Pip Mascot -->
  <g transform="translate(5, 5) scale(0.54)">
    <ellipse cx="50" cy="94" rx="22" ry="4.5" fill="rgba(16,40,28,0.14)" />
    <path d="M50 26 C50 18 50 14 50 12" stroke="#185e3e" stroke-width="3.6" fill="none" stroke-linecap="round" />
    <ellipse cx="42" cy="15" rx="8" ry="4.5" fill="#1c7a4e" transform="rotate(-32 42 15)" />
    <ellipse cx="58" cy="13" rx="9" ry="4.8" fill="#2aab68" transform="rotate(28 58 13)" />
    <circle cx="50" cy="56" r="33" fill="#F5B42A" />
    <circle cx="50" cy="56" r="26.6" fill="#FAC438" />
    <circle cx="50" cy="56" r="26.6" fill="none" stroke="#D99E18" stroke-width="2.6" />
    <ellipse cx="35" cy="42" rx="8.5" ry="4.9" fill="rgba(255,255,255,0.3)" transform="rotate(-26 35 42)" />
    <ellipse cx="31" cy="60" rx="5.5" ry="3.5" fill="#F07828" opacity="0.35" />
    <ellipse cx="69" cy="60" rx="5.5" ry="3.5" fill="#F07828" opacity="0.35" />
    <circle cx="40" cy="55" r="4.2" fill="#7A4800" />
    <circle cx="41.5" cy="53.5" r="1.3" fill="#fff" />
    <circle cx="60" cy="55" r="4.2" fill="#7A4800" />
    <circle cx="61.5" cy="53.5" r="1.3" fill="#fff" />
    <path d="M43 64 Q50 72 57 64" fill="none" stroke="#7A4800" stroke-width="3.4" stroke-linecap="round" />
  </g>

  <!-- Streak Flame Badge (Bottom-right corner) -->
  <g>
    <!-- Badge Background Pill with subtle amber border -->
    <rect x="${pillX}" y="40" width="${pillW}" height="18" rx="9" fill="#FFFFFF" stroke="#FED7AA" stroke-width="1.2" />
    <!-- Flame Icon -->
    <g transform="translate(${flameX}, ${flameY}) scale(0.16)">
      <path d="M49 12.5C53.5 22 57 32 58.6 39.6C61.1 33.2 65.4 28.9 70 26.8C73.2 33.8 79.6 47.2 80 64C80.4 82.2 62.9 99 41 99C19.1 99 1.6 82.2 2 64C2.2 56.2 4.1 51.4 7.6 46.8C9.1 39.9 17 26.7 25.2 20C26.7 27.2 30.7 36.2 36.6 42.6C40.1 46.2 43.1 42.2 44.6 35C45.7 29.6 47.2 20 49 12.5Z" fill="#FAA81A" />
      <path d="M34.5 42C38 47.5 41.5 51.5 43.5 55.5C45.5 51.5 48 48 51 45.5C55.5 52 58.5 60 58.5 67.5C58.5 78.5 50.7 88.5 41 88.5C31.3 88.5 23.5 78.5 23.5 67.5C23.5 58.5 28.5 48.5 34.5 42Z" fill="#F26A22" />
      <path d="M38.6 1C41.7 6.2 43.2 11.2 42.2 15.2C41.1 19.7 36.6 21.1 33.6 17.7C31 14.7 31.6 8.4 38.6 1Z" fill="#F26A22" />
      <path d="M42.5 61C46 67 49 72.5 49 77.5C49 82.5 46 86 42.5 86C39 86 36 82.5 36 77.5C36 72.5 39 67 42.5 61Z" fill="#E2402A" />
    </g>
    <!-- Streak Number -->
    <text x="${textX}" y="52.5" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="10.5" fill="#C2410C">${streakStr}</text>
  </g>
</svg>
`.trim();
}

const UP_ARROW_SVG = `
<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 5L6 13M14 5L22 13M14 5V23" stroke="#1f8a5b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
</svg>
`.trim();

const DOWN_ARROW_SVG = `
<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 23L6 15M14 23L22 15M14 23V5" stroke="#d6453f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
</svg>
`.trim();

export function QuickRecordWidget({ streak = 0 }: QuickRecordWidgetProps = {}) {
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#faf8f2',
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 6,
      }}
    >
      {/* 1. Left button: Mascot + Streak Flame Badge (Opens Add Transaction) */}
      <FlexWidget
        style={{
          flex: 1,
          height: 'match_parent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'pip://add' }}
        accessibilityLabel="Add Transaction"
      >
        <SvgWidget
          svg={getMascotStreakSvg(streak)}
          style={{
            width: 58,
            height: 48,
          }}
        />
      </FlexWidget>

      {/* Divider 1 */}
      <FlexWidget
        style={{
          width: 1,
          height: 32,
          backgroundColor: '#e6e0d2',
        }}
      />

      {/* 2. Middle button: Up Arrow (Record Income) */}
      <FlexWidget
        style={{
          flex: 1,
          height: 'match_parent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'pip://add?type=income' }}
        accessibilityLabel="Record Income"
      >
        <SvgWidget
          svg={UP_ARROW_SVG}
          style={{
            width: 26,
            height: 26,
          }}
        />
      </FlexWidget>

      {/* Divider 2 */}
      <FlexWidget
        style={{
          width: 1,
          height: 32,
          backgroundColor: '#e6e0d2',
        }}
      />

      {/* 3. Right button: Down Arrow (Record Expense) */}
      <FlexWidget
        style={{
          flex: 1,
          height: 'match_parent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'pip://add?type=expense' }}
        accessibilityLabel="Record Expense"
      >
        <SvgWidget
          svg={DOWN_ARROW_SVG}
          style={{
            width: 26,
            height: 26,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
