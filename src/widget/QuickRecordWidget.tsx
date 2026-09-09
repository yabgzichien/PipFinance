import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { FlexWidgetStyle, HexColor } from 'react-native-android-widget';
import type { BadgeColor, BadgeIcon, WidgetMascotConfig } from './mascot/config';
import { DEFAULT_WIDGET_MASCOT_CONFIG } from './mascot/config';
import { composeMascot } from './mascot/compose';
import { BADGE_THEMES, badgeIconSvg } from './mascot/badge';
import { MASCOT_SIZES, BUTTON_SIZES } from './mascot/sizing';

export interface QuickRecordWidgetProps {
  streak?: number;
  dots?: boolean[];
  config?: WidgetMascotConfig;
}

const UP_ARROW_SVG = `
<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 5L6 13M14 5L22 13M14 5V23" stroke="#1f8a5b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
</svg>`.trim();

const DOWN_ARROW_SVG = `
<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 23L6 15M14 23L22 15M14 23V5" stroke="#d6453f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
</svg>`.trim();

/** The 7-day activity row, recovered from the StreakWidget that shipped at commit f1bcbbd and
 *  fed by compute7DayDots. Only rendered in the expanded layout, where hiding both arrows has
 *  freed the room for it. */
function dotsRowSvg(dots: boolean[], color: string): string {
  const safe = dots.length === 7 ? dots : Array.from({ length: 7 }, (_, i) => dots[i] ?? false);
  const cells = safe
    .map((on, i) => {
      const cx = 4 + i * 10;
      return on
        ? `<circle cx="${cx}" cy="4" r="4" fill="${color}" />`
        : `<circle cx="${cx}" cy="4" r="3.2" fill="none" stroke="#C9C2B4" stroke-width="1.4" />`;
    })
    .join('');
  return `<svg data-streak-dots width="68" height="8" viewBox="0 0 68 8" fill="none" xmlns="http://www.w3.org/2000/svg">${cells}</svg>`;
}

function expandedBadgeIconSvg(icon: BadgeIcon, color: BadgeColor): string | null {
  const fragment = badgeIconSvg(icon, color);
  if (!fragment) return null;
  return `<svg data-streak-icon width="18" height="18" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">${fragment}</svg>`;
}

function Divider() {
  return <FlexWidget style={{ width: 1, height: 32, backgroundColor: '#e6e0d2' }} />;
}

export function QuickRecordWidget({
  streak = 0,
  dots = [],
  config = DEFAULT_WIDGET_MASCOT_CONFIG,
}: QuickRecordWidgetProps = {}) {
  const mascot = MASCOT_SIZES[config.mascotNotch];
  const button = BUTTON_SIZES[config.buttonNotch];
  const expanded = !config.showIncome && !config.showExpense;
  const badge = BADGE_THEMES[config.badgeColor];
  const expandedIcon = expandedBadgeIconSvg(config.badgeIcon, config.badgeColor);

  // The badge is drawn into the mascot svg only in the compact layouts. When expanded, the count
  // is a TextWidget beside the dots row, so the pill would duplicate it.
  const mascotSvg = composeMascot(
    expanded ? { ...config, badgeIcon: 'none' } : config,
    streak
  );

  const mascotButton = (
    <FlexWidget
      style={{ flex: 1, height: 'match_parent', alignItems: 'center', justifyContent: 'center' }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'pip://add' }}
      accessibilityLabel="Add Transaction"
    >
      <SvgWidget svg={mascotSvg} style={{ width: mascot.w, height: mascot.h }} />
    </FlexWidget>
  );

  const shell: FlexWidgetStyle = {
    width: 'match_parent',
    height: 'match_parent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#faf8f2',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 6,
  };

  if (expanded) {
    // Whole widget is one add target; the freed space carries the streak instead of arrows.
    return (
      <FlexWidget
        style={{ ...shell, justifyContent: 'flex-start' }}
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'pip://add' }}
        accessibilityLabel="Add Transaction"
      >
        <SvgWidget svg={mascotSvg} style={{ width: mascot.w, height: mascot.h }} />
        <FlexWidget style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGap: 4 }}>
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexGap: 4 }}>
            {expandedIcon && <SvgWidget svg={expandedIcon} style={{ width: 16, height: 16 }} />}
            <TextWidget
              text={String(streak)}
              style={{ fontSize: 18, fontWeight: '700', color: badge.text as HexColor }}
            />
          </FlexWidget>
          <SvgWidget svg={dotsRowSvg(dots, badge.icon)} style={{ width: 68, height: 8 }} />
        </FlexWidget>
      </FlexWidget>
    );
  }

  return (
    <FlexWidget style={shell}>
      {mascotButton}
      {config.showIncome && <Divider />}
      {config.showIncome && (
        <FlexWidget
          style={{ flex: 1, height: 'match_parent', alignItems: 'center', justifyContent: 'center' }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'pip://add?type=income' }}
          accessibilityLabel="Record Income"
        >
          <SvgWidget svg={UP_ARROW_SVG} style={{ width: button, height: button }} />
        </FlexWidget>
      )}
      {config.showExpense && <Divider />}
      {config.showExpense && (
        <FlexWidget
          style={{ flex: 1, height: 'match_parent', alignItems: 'center', justifyContent: 'center' }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'pip://add?type=expense' }}
          accessibilityLabel="Record Expense"
        >
          <SvgWidget svg={DOWN_ARROW_SVG} style={{ width: button, height: button }} />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
