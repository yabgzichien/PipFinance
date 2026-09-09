import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { FlexWidgetStyle, HexColor } from 'react-native-android-widget';
import type { BadgeColor, BadgeIcon, WidgetMascotConfig } from './mascot/config';
import { DEFAULT_WIDGET_MASCOT_CONFIG } from './mascot/config';
import { composeMascot } from './mascot/compose';
import { BADGE_THEMES, badgeIconSvg } from './mascot/badge';
import { MASCOT_SIZES, BUTTON_SIZES } from './mascot/sizing';
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
} from './mascot/chrome';

export interface QuickRecordWidgetProps {
  streak?: number;
  dots?: boolean[];
  config?: WidgetMascotConfig;
}

function expandedBadgeIconSvg(icon: BadgeIcon, color: BadgeColor): string | null {
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
    backgroundColor: SHELL_BG,
    borderRadius: SHELL_RADIUS,
    paddingHorizontal: SHELL_PADDING_H,
    paddingVertical: SHELL_PADDING_V,
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
