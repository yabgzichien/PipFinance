import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { FlexWidgetStyle, HexColor } from 'react-native-android-widget';
import type { BadgeColor, BadgeIcon, SlotContent, WidgetMascotConfig } from './mascot/config';
import { DEFAULT_WIDGET_MASCOT_CONFIG } from './mascot/config';
import { composeMascot } from './mascot/compose';
import { BADGE_THEMES, badgeIconSvg } from './mascot/badge';
import { MASCOT_SIZES, slotWidth } from './mascot/sizing';
// Shared with the in-app preview (mascot/previewCompose.ts) so the two renderers cannot drift.
import {
  DIVIDER_COLOR,
  DIVIDER_HEIGHT,
  DOTS_ROW_HEIGHT,
  DOTS_ROW_WIDTH,
  DOWN_ARROW_SVG,
  SHELL_BG,
  SHELL_PADDING_H,
  SHELL_PADDING_V,
  SHELL_RADIUS,
  STREAK_COUNT_FONT_SIZE,
  STREAK_ICON_SIZE,
  STREAK_STACK_GAP,
  UP_ARROW_SVG,
  dotsRowSvg,
  streakSlotMetrics,
} from './mascot/chrome';

export interface QuickRecordWidgetProps {
  streak?: number;
  dots?: boolean[];
  config?: WidgetMascotConfig;
}

function badgeIconDocument(icon: BadgeIcon, color: BadgeColor): string | null {
  const fragment = badgeIconSvg(icon, color);
  if (!fragment) return null;
  return `<svg data-streak-icon width="18" height="18" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">${fragment}</svg>`;
}

function Divider() {
  return <FlexWidget style={{ width: 1, height: DIVIDER_HEIGHT, backgroundColor: DIVIDER_COLOR }} />;
}

export function QuickRecordWidget({
  streak = 0,
  dots = [],
  config = DEFAULT_WIDGET_MASCOT_CONFIG,
}: QuickRecordWidgetProps = {}) {
  const mascot = MASCOT_SIZES[config.mascotNotch];
  const badge = BADGE_THEMES[config.badgeColor];

  const expanded = config.slot1 === 'none' && config.slot2 === 'none';
  const hasStreakSlot = config.slot1 === 'streak' || config.slot2 === 'streak';

  // The mascot's own badge pill is suppressed wherever the streak is already shown elsewhere —
  // in the expanded column, or in a slot — so the count never appears twice.
  const mascotSvg = composeMascot(
    expanded || hasStreakSlot ? { ...config, badgeIcon: 'none' } : config,
    streak
  );

  const shell: FlexWidgetStyle = {
    width: 'match_parent',
    height: 'match_parent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SHELL_BG,
    borderRadius: SHELL_RADIUS,
    paddingHorizontal: SHELL_PADDING_H,
    paddingVertical: SHELL_PADDING_V,
  };

  if (expanded) {
    // Nothing beside the mascot, so the freed space carries the streak and the whole widget
    // becomes one add target.
    const expandedIcon = badgeIconDocument(config.badgeIcon, config.badgeColor);
    return (
      <FlexWidget
        style={{ ...shell, justifyContent: 'flex-start' }}
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'pip://add' }}
        accessibilityLabel="Add Transaction"
      >
        <SvgWidget svg={mascotSvg} style={{ width: mascot.w, height: mascot.h }} />
        <FlexWidget style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGap: STREAK_STACK_GAP }}>
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexGap: STREAK_STACK_GAP }}>
            {expandedIcon && <SvgWidget svg={expandedIcon} style={{ width: STREAK_ICON_SIZE, height: STREAK_ICON_SIZE }} />}
            <TextWidget
              text={String(streak)}
              style={{ fontSize: STREAK_COUNT_FONT_SIZE, fontWeight: '700', color: badge.text as HexColor }}
            />
          </FlexWidget>
          <SvgWidget svg={dotsRowSvg(dots, badge.icon)} style={{ width: DOTS_ROW_WIDTH, height: DOTS_ROW_HEIGHT }} />
        </FlexWidget>
      </FlexWidget>
    );
  }

  /** One slot's contents. Arrows are tap targets; a streak badge is a read-only indicator, so it
   *  carries no clickAction — the mascot remains the widget's add target. */
  function slot(which: 'slot1' | 'slot2') {
    const content: SlotContent = config[which];
    if (content === 'none') return null;

    const size = slotWidth(config, which);
    const column: FlexWidgetStyle = {
      flex: 1,
      height: 'match_parent',
      alignItems: 'center',
      justifyContent: 'center',
    };

    if (content === 'streak') {
      const m = streakSlotMetrics(size);
      const icon = badgeIconDocument(config.badgeIcon, config.badgeColor);
      return (
        <FlexWidget
          key={which}
          style={{ ...column, flexDirection: 'row', flexGap: m.gap }}
          accessibilityLabel={`Streak ${streak} days`}
        >
          {icon && <SvgWidget svg={icon} style={{ width: m.icon, height: m.icon }} />}
          <TextWidget
            text={String(streak)}
            style={{ fontSize: m.font, fontWeight: '700', color: badge.text as HexColor }}
          />
        </FlexWidget>
      );
    }

    const income = content === 'income';
    return (
      <FlexWidget
        key={which}
        style={column}
        clickAction="OPEN_URI"
        clickActionData={{ uri: income ? 'pip://add?type=income' : 'pip://add?type=expense' }}
        accessibilityLabel={income ? 'Record Income' : 'Record Expense'}
      >
        <SvgWidget svg={income ? UP_ARROW_SVG : DOWN_ARROW_SVG} style={{ width: size, height: size }} />
      </FlexWidget>
    );
  }

  return (
    <FlexWidget style={shell}>
      <FlexWidget
        style={{ flex: 1, height: 'match_parent', alignItems: 'center', justifyContent: 'center' }}
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'pip://add' }}
        accessibilityLabel="Add Transaction"
      >
        <SvgWidget svg={mascotSvg} style={{ width: mascot.w, height: mascot.h }} />
      </FlexWidget>
      {config.slot1 !== 'none' && <Divider />}
      {slot('slot1')}
      {config.slot2 !== 'none' && <Divider />}
      {slot('slot2')}
    </FlexWidget>
  );
}
