import React, { useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect, SvgXml } from 'react-native-svg';
import { useLanguage } from '../../i18n';
import type { RecapStoryScene } from '../../lib/recapStory';
import { STORY_LOGICAL_HEIGHT, STORY_LOGICAL_WIDTH, STORY_PALETTES } from '../../lib/recapStoryTheme';
import { composeMascot } from '../../widget/mascot/compose';
import type { WidgetMascotConfig } from '../../widget/mascot/config';
import { Icon, type IconName } from '../Icon';
import { Body, Display, Label, Title } from '../ui';
import { DancingCow } from './DancingCow';

export interface RecapStoryFrameProps {
  scene: RecapStoryScene;
  mode: 'animated' | 'export';
  motion: 'full' | 'reduced' | 'off';
  progress?: Animated.Value;
  mascotConfig: WidgetMascotConfig;
  monthLabel: string;
  categoryLabel: (categoryId: string) => string;
  accessibilityPositionLabel?: string;
}

const CATEGORY_ICONS: Record<string, IconName> = {
  food: 'utensils', shopping: 'bag', entertainment: 'sparkles', travelling: 'pin',
  learning: 'book', family: 'gift', medical: 'heart', utilities: 'home',
  subscriptions: 'play', rental: 'home', phoneBill: 'phone', insurance: 'shield',
};
const COMPARISON_KEYS = {
  higher: 'recapStoryComparisonHigher', lower: 'recapStoryComparisonLower', same: 'recapStoryComparisonSame',
} as const;

/** Capture and playback share this exact tree; only caller-owned motion changes its pose. */
export function RecapStoryFrame({ scene, mode, motion, progress, mascotConfig, monthLabel,
  categoryLabel, accessibilityPositionLabel }: RecapStoryFrameProps) {
  const { t } = useLanguage();
  const palette = STORY_PALETTES[scene.type];
  const ink = palette.foreground;
  const animate = mode === 'animated' && motion === 'full' ? progress : undefined;
  const pose = animate ? {
    opacity: animate.interpolate({ inputRange: [0, 0.16, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: animate.interpolate({ inputRange: [0, 0.2, 1], outputRange: [24, 0, 0], extrapolate: 'clamp' }) }],
  } : { opacity: 1, transform: [{ translateY: 0 }] };
  const ornamentPose = animate ? {
    transform: [{ rotate: animate.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'], extrapolate: 'clamp' }) }],
  } : { transform: [{ rotate: '0deg' }] };
  const mascotXml = useMemo(() => composeMascot({ ...mascotConfig, badgeIcon: 'none' }, 0), [mascotConfig]);
  const days = 'activityDays' in scene ? t('recapStoryDays', { days: scene.activityDays }) : '';
  const weeks = scene.type === 'habit' ? t('recapStoryWeeks', { weeks: scene.activityWeeks }) : '';
  const personaTitle = scene.type === 'identity' ? t(`recapStoryPersona_${scene.persona}_title`) : '';
  const personaBody = scene.type === 'identity' ? t(`recapStoryPersona_${scene.persona}_body`, { days: scene.activityDays }) : '';
  const comparison = scene.type === 'pattern' && scene.changeDirection && scene.previousRecordedSharePercent !== undefined
    ? `${t(COMPARISON_KEYS[scene.changeDirection])} · ${scene.previousRecordedSharePercent}%` : '';
  const patternCategory = scene.type === 'pattern' ? categoryLabel(scene.categoryId) : '';
  const badges = scene.type === 'finale' ? scene.badges.map((badge) => ({
    id: badge, label: t(`recapStoryBadge_${badge}_label`), body: t(`recapStoryBadge_${badge}_body`),
  })) : [];

  let spotlightTitle = '';
  let spotlightBody = '';
  let spotlightSubtitle = '';
  if (scene.type === 'spotlight') {
    const hl = scene.highlight;
    switch (hl.kind) {
      case 'techUpgrade':
        spotlightTitle = t('recapStorySpotlight_tech_title');
        spotlightBody = t('recapStorySpotlight_tech_body', { item: hl.itemLabel || 'gear' });
        spotlightSubtitle = hl.itemLabel || '';
        break;
      case 'vehicleMilestone':
        spotlightTitle = t('recapStorySpotlight_vehicle_title');
        spotlightBody = t('recapStorySpotlight_vehicle_body');
        spotlightSubtitle = hl.itemLabel || '';
        break;
      case 'homeMilestone':
        spotlightTitle = t('recapStorySpotlight_home_title');
        spotlightBody = t('recapStorySpotlight_home_body');
        spotlightSubtitle = hl.itemLabel || '';
        break;
      case 'giftCelebration':
        spotlightTitle = t('recapStorySpotlight_gift_title');
        spotlightBody = t('recapStorySpotlight_gift_body');
        spotlightSubtitle = hl.occasion ? (hl.occasion === 'birthday' ? 'Birthday' : hl.occasion === 'wedding' ? 'Wedding' : 'Celebration') : '';
        break;
      case 'incomeBoost':
        spotlightTitle = t('recapStorySpotlight_income_title');
        spotlightBody = t('recapStorySpotlight_income_body');
        spotlightSubtitle = hl.percentChange ? t('recapStorySpotlight_income_pct', { pct: hl.percentChange }) : '';
        break;
      case 'selfCare':
        spotlightTitle = t('recapStorySpotlight_wellness_title');
        spotlightBody = t('recapStorySpotlight_wellness_body');
        spotlightSubtitle = hl.itemLabel || '';
        break;
      case 'dates':
        spotlightTitle = t('recapStorySpotlight_dates_title');
        spotlightBody = t('recapStorySpotlight_dates_body', { count: hl.count || 1 });
        break;
      case 'cafeRhythm':
        spotlightTitle = t('recapStorySpotlight_cafe_title');
        spotlightBody = t('recapStorySpotlight_cafe_body', { count: hl.count || 4 });
        break;
      case 'outlierSpend':
      default:
        spotlightTitle = t('recapStorySpotlight_outlier_title');
        spotlightBody = t('recapStorySpotlight_outlier_body', { category: categoryLabel(hl.categoryId || 'other') });
        spotlightSubtitle = categoryLabel(hl.categoryId || 'other');
        break;
    }
  }

  const summary = scene.type === 'ritual' ? t('recapStoryRitualTitle')
    : scene.type === 'identity' ? `${personaTitle}. ${personaBody}`
    : scene.type === 'pattern' ? [patternCategory, `${scene.recordedSharePercent}% ${t('recapStoryRecordedShare')}`, comparison, scene.merchantCameo].filter(Boolean).join('. ')
    : scene.type === 'spotlight' ? `${spotlightTitle}. ${spotlightBody}`
    : scene.type === 'habit' ? `${days}. ${weeks}`
    : badges.map((badge) => `${badge.label}. ${badge.body}`).join('. ');

  return (
    <View testID="recap-story-capture-frame" collapsable={false} accessible accessibilityRole="image"
      accessibilityLabel={[accessibilityPositionLabel, monthLabel, summary].filter(Boolean).join('. ')}
      style={[styles.frame, { backgroundColor: palette.background }]}>
      <View testID="story-artwork" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={styles.artwork} pointerEvents="none">
        <Animated.View style={[styles.ornaments, ornamentPose]}>
          <Svg width={360} height={640} viewBox="0 0 360 640" accessible={false}>
            {/* Accent never carries copy. Two oversized, cropped gestures frame the story. */}
            <Path d="M284 14 L306 48 L346 36 L330 76 L366 102 L320 106 L310 150 L286 114 L246 130 L260 88 L226 62 L270 60 Z"
              transform="translate(40 -100)" fill={palette.accent} />
            <Circle cx={-44} cy={548} r={124} fill="none" stroke={palette.accent} strokeWidth={32} />
          </Svg>
        </Animated.View>
        <View style={styles.month}><Label color={ink}>{monthLabel}</Label></View>
        <Animated.View testID="story-scene-motion" style={[styles.scene, pose]}>
          {scene.type === 'ritual' && <>
            <View style={styles.ritualTitle}><Display color={ink} style={styles.headline}>{t('recapStoryRitualTitle')}</Display></View>
            <View style={styles.cow}><DancingCow size={208} motion={motion} progress={progress} exportMode={mode === 'export'} /></View>
          </>}
          {scene.type === 'identity' && <>
            <View style={styles.identityCopy}>
              <Display color={ink} style={styles.headline} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.8}>{personaTitle}</Display>
              <Body color={ink} style={styles.body}>{personaBody}</Body>
            </View>
            <View style={styles.mascot}><SvgXml xml={mascotXml} width={248} height={208} accessible={false} /></View>
          </>}
          {scene.type === 'pattern' && <>
            <View style={styles.patternTitle}><Display color={ink} style={styles.headline} numberOfLines={2} adjustsFontSizeToFit>{patternCategory}</Display></View>
            <View style={styles.categoryIcon}><Icon name={CATEGORY_ICONS[scene.categoryId] ?? 'sparkles'} size={112} color={ink} stroke={1.5} /></View>
            <View style={styles.patternFacts}>
              <Display numeric color={ink} style={styles.percentage}>{`${scene.recordedSharePercent}%`}</Display>
              <Title color={ink}>{t('recapStoryRecordedShare')}</Title>
              {!!comparison && <Body color={ink} style={styles.body}>{comparison}</Body>}
              {!!scene.merchantCameo && <Label color={ink} numberOfLines={2} style={styles.cameo}>{scene.merchantCameo}</Label>}
            </View>
          </>}
          {scene.type === 'spotlight' && (
            <View style={styles.spotlightScene}>
              <View style={[styles.spotlightPill, { borderColor: ink }]}>
                <Icon name="sparkles" size={14} color={ink} />
                <Label weight={700} color={ink}>{t('recapStorySpotlightBadge')}</Label>
              </View>
              <View style={styles.spotlightIcon}>
                <Icon name={(scene.highlight.iconName as IconName) || 'sparkles'} size={96} color={ink} stroke={1.5} />
              </View>
              <View style={styles.spotlightContent}>
                <Display color={ink} style={styles.headline} numberOfLines={2} adjustsFontSizeToFit>{spotlightTitle}</Display>
                <Body color={ink} style={styles.body}>{spotlightBody}</Body>
                {!!spotlightSubtitle && (
                  <View style={[styles.spotlightTag, { borderColor: ink, borderWidth: 1 }]}>
                    <Label weight={700} color={ink}>{spotlightSubtitle}</Label>
                  </View>
                )}
              </View>
            </View>
          )}
          {scene.type === 'habit' && <>
            <View style={styles.habitCopy}>
              <Display color={ink} style={styles.headline}>{days}</Display>
              <Title color={ink} style={styles.body}>{weeks}</Title>
            </View>
            <View style={styles.calendar}>
              <Svg testID="story-calendar-motif" width={280} height={224} viewBox="0 0 280 224" accessible={false}>
                {/* An unlabelled motif, not invented dates or a chart of the user's activity. */}
                {Array.from({ length: 28 }, (_, i) => <Rect key={i} x={(i % 7) * 40 + 4} y={Math.floor(i / 7) * 48 + 16}
                  width={28} height={32} rx={8} fill="none" stroke={ink} strokeWidth={2} />)}
                <Path d="M224 168 l16 16 32-40" stroke={ink} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </View>
          </>}
          {scene.type === 'finale' && <View style={[styles.badges, badges.length < 2 && styles.singleBadge]}>
            {badges.map((badge, index) => <View key={badge.id}
              style={[styles.sticker, { borderColor: ink, backgroundColor: palette.background,
                transform: [{ rotate: index % 2 === 0 ? '-4deg' : '4deg' }], alignSelf: index % 2 === 0 ? 'flex-start' : 'flex-end' }]}>
              <View style={styles.stickerHeading}><Icon name={index === 0 ? 'sparkles' : index === 1 ? 'check' : 'calendar'} size={24} color={ink} />
                <Title color={ink} style={styles.stickerLabel}>{badge.label}</Title></View>
              <Body color={ink} style={styles.badgeBody}>{badge.body}</Body>
            </View>)}
          </View>}
        </Animated.View>
        <View style={styles.wordmark}><Label color={ink}>Pip</Label></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: STORY_LOGICAL_WIDTH, height: STORY_LOGICAL_HEIGHT, overflow: 'hidden' },
  artwork: { flex: 1 },
  ornaments: { ...StyleSheet.absoluteFillObject },
  month: { position: 'absolute', top: 48, left: 32, right: 80 },
  scene: { position: 'absolute', top: 96, left: 32, right: 32, bottom: 72 },
  headline: { lineHeight: 44, letterSpacing: -1 },
  body: { marginTop: 16, lineHeight: 24 },
  ritualTitle: { width: 280 },
  cow: { position: 'absolute', bottom: 0, right: 0 },
  identityCopy: { width: 296 },
  mascot: { position: 'absolute', bottom: 0, right: -8, width: 248, height: 208 },
  patternTitle: { width: 280 },
  categoryIcon: { position: 'absolute', top: 104, right: 0, transform: [{ rotate: '12deg' }] },
  patternFacts: { position: 'absolute', top: 244, left: 0, right: 0 },
  percentage: { lineHeight: 48, marginBottom: 8 },
  cameo: { marginTop: 16, lineHeight: 20 },
  habitCopy: { width: 256 },
  calendar: { position: 'absolute', bottom: 24, right: -8, transform: [{ rotate: '-8deg' }] },
  spotlightScene: { flex: 1, justifyContent: 'space-between', paddingBottom: 16 },
  spotlightPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 4 },
  spotlightIcon: { alignSelf: 'center', marginVertical: 20 },
  spotlightContent: { gap: 8 },
  spotlightTag: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 12 },
  badges: { flex: 1, justifyContent: 'center', gap: 24 },
  singleBadge: { justifyContent: 'center' },
  sticker: { width: 272, borderWidth: 2, borderRadius: 24, padding: 16 },
  stickerHeading: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  stickerLabel: { flex: 1, lineHeight: 28 },
  badgeBody: { marginTop: 8, lineHeight: 20 },
  wordmark: { position: 'absolute', bottom: 40, right: 32 },
});
