import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

export interface StreakWidgetProps {
  streak: number;
  dots: boolean[];
}

const COIN_MASCOT_SVG = `
<svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 16 C20 11,13 8,11 12.5 C9 17,15 19,20 16Z" fill="#1c7a4e" />
  <path d="M36 16 C36 11,43 8,45 12.5 C47 17,41 19,36 16Z" fill="#2aab68" />
  <line x1="28" y1="13.5" x2="28" y2="20" stroke="#185e3e" stroke-width="2.5" stroke-linecap="round" />
  <ellipse cx="28.5" cy="46" rx="12" ry="2.3" fill="rgba(8,28,14,0.15)" />
  <circle cx="28" cy="35.5" r="15.5" fill="#F5B42A" />
  <circle cx="28" cy="35.5" r="12.5" fill="#FAC438" />
  <circle cx="28" cy="35.5" r="12.5" fill="none" stroke="#D99E18" stroke-width="1.2" />
  <ellipse cx="23.5" cy="34" rx="1.9" ry="2.2" fill="#7A4800" />
  <ellipse cx="32.5" cy="34" rx="1.9" ry="2.2" fill="#7A4800" />
  <circle cx="24.3" cy="33" r="0.75" fill="white" opacity="0.82" />
  <circle cx="33.3" cy="33" r="0.75" fill="white" opacity="0.82" />
  <path d="M23.5 38.5 Q28 42.2 32.5 38.5" stroke="#7A4800" stroke-width="1.9" stroke-linecap="round" fill="none" />
  <ellipse cx="19.5" cy="37.5" rx="2.5" ry="1.6" fill="#F07828" opacity="0.3" />
  <ellipse cx="36.5" cy="37.5" rx="2.5" ry="1.6" fill="#F07828" opacity="0.3" />
  <ellipse cx="21" cy="29" rx="4" ry="2.3" fill="white" opacity="0.23" transform="rotate(-26 21 29)" />
</svg>
`.trim();

const ACTIVE_DOT_SVG = `
<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="6" cy="6" r="5.5" fill="#1f8a5b" />
  <path d="M3.2 6.2l1.9 2 3.8-4.2" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
</svg>
`.trim();

const INACTIVE_DOT_SVG = `
<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="6" cy="6" r="4.5" fill="#f6f8f6" stroke="#9aa7a0" stroke-width="1.4" />
</svg>
`.trim();

const REFRESH_SVG = `
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5d6b63" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
  <path d="M21 3v5h-5"/>
  <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
  <path d="M3 21v-5h5"/>
</svg>
`.trim();

export function StreakWidget({ streak, dots }: StreakWidgetProps) {
  // Ensure dots is always 7 items
  const safeDots = dots.length === 7 ? dots : [...Array(7)].map((_, i) => dots[i] ?? false);

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'pip://add' }}
    >
      {/* Left side: Coin mascot + Streak count */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flexGap: 8,
        }}
      >
        <FlexWidget
          style={{
            width: 32,
            height: 32,
            backgroundColor: '#faf7f2',
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SvgWidget
            svg={COIN_MASCOT_SVG}
            style={{
              width: 28,
              height: 28,
            }}
          />
        </FlexWidget>

        <FlexWidget
          style={{
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <TextWidget
            text={String(streak)}
            style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: '#16201b',
            }}
          />
          <TextWidget
            text="day streak"
            style={{
              fontSize: 10,
              fontWeight: '500',
              color: '#5d6b63',
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Divider */}
      <FlexWidget
        style={{
          width: 1,
          height: 36,
          backgroundColor: '#eef1ee',
          marginHorizontal: 10,
        }}
      />

      {/* Right side: 7-day dots + refresh button */}
      <FlexWidget
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexGap: 3,
          }}
        >
          {safeDots.map((done, idx) => (
            <SvgWidget
              key={idx}
              svg={done ? ACTIVE_DOT_SVG : INACTIVE_DOT_SVG}
              style={{
                width: 11,
                height: 11,
              }}
            />
          ))}
        </FlexWidget>

        <FlexWidget
          style={{
            width: 20,
            height: 20,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            backgroundColor: '#f6f8f6',
          }}
          clickAction="REFRESH_WIDGET"
        >
          <SvgWidget
            svg={REFRESH_SVG}
            style={{
              width: 12,
              height: 12,
            }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
