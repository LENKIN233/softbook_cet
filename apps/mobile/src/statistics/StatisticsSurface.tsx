import {ScaledText as Text} from '../visual/ScaledText';
import React, {useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {StudioPressable as Pressable} from '../learning/NativeMotion';
import {StudioActionLabel} from '../visual/StudioActionLabel';
import type {TrackStudyStatistics} from './trackStudyStatistics';

type StatisticsPalette = {
  accent: string; accentSoft: string; accentStrong: string; background: string; border: string;
  activeSurface: string; activeText: string; danger: string; primaryActionMuted: string;
  success: string; tabIdle: string; warning: string; warningText: string;
  panel: string; panelStrong: string; primaryActionSurface: string;
  primaryActionText: string; text: string; textMuted: string;
};

type Props = {
  statistics?: TrackStudyStatistics | null;
  track: 'cet4' | 'cet6';
  canCheckInToday: boolean;
  hasCheckedInToday: boolean;
  deviceClass: 'phone' | 'tablet';
  onCheckIn: () => void;
  onGoToLearning: () => void;
  palette: StatisticsPalette;
  syncStatusLabel: string;
  syncStatusDetail: string;
  // Older callers can continue supplying their progress snapshot. Its account
  // totals must never be presented as track-specific statistics.
  cumulativeLearnedCount?: number;
  learningCompletedCount?: number;
  reviewCompletedCount?: number;
  pendingReviewCount?: number;
  onStartReview?: () => void;
};

export function StatisticsSurface({statistics, track, canCheckInToday,
  pendingReviewCount = 0, onStartReview,
  hasCheckedInToday, deviceClass, onCheckIn, onGoToLearning, palette,
  syncStatusLabel, syncStatusDetail}: Props) {
  const [showExplanation, setShowExplanation] = useState(false);
  const scope = statistics?.track ?? track;
  const hasSyncNotice = !['已记录', '已同步', '暂无记录', '已保存在本机'].includes(syncStatusLabel);
  return <ScrollView testID="statistics-scroll" showsVerticalScrollIndicator={false}
    contentContainerStyle={[styles.page, deviceClass === 'tablet' && styles.tablet]}>
    <View testID="statistics-day-object" style={styles.heading}>
      <Text style={[styles.eyebrow, {color: palette.textMuted}]}>{scope === 'cet6' ? '英语六级' : '英语四级'} · 今天</Text>
      <Text style={[styles.title, {color: palette.text}]}>学习统计</Text>
    </View>
    {statistics ? <View testID="statistics-metric-strip" style={styles.metrics}>
      <View style={[styles.hero, {backgroundColor: palette.panel}]} testID="statistics-metric-completed">
        <Text style={[styles.label, {color: palette.textMuted}]}>今天练过</Text>
        <Text style={[styles.number, {color: palette.accentStrong}]} testID="statistics-metric-completed-value">{statistics.completedCardCount} 张卡</Text>
        <Text style={[styles.detail, {color: palette.text}]} testID="statistics-metric-review">共完成 {statistics.completedAttemptCount} 次练习，含 {statistics.reviewAttemptCount} 次复习</Text>
        {statistics.completedAttemptCount === 0 ? <Text style={[styles.detail, {color: palette.textMuted}]}>完成作答后，这里会显示记录。</Text> : null}
      </View>
      <View style={[styles.cumulative, {borderColor: palette.border}]} testID="statistics-metric-cumulative">
        <Text style={[styles.label, {color: palette.textMuted}]}>累计学过</Text>
        <Text style={[styles.cumulativeValue, {color: palette.text}]} testID="statistics-metric-cumulative-value">{statistics.cumulativeLearnedCardCount} 张</Text>
      </View>
    </View> : <View style={[styles.hero, {backgroundColor: palette.panel}]} testID="statistics-unavailable">
      <Text style={[styles.detail, {color: palette.text}]}>当前科目的统计暂时无法读取。</Text>
      <Text style={[styles.detail, {color: palette.textMuted}]}>你可以继续学习，记录恢复后会在这里显示。</Text>
    </View>}
    <Pressable accessibilityRole="button" testID="statistics-go-learning-button" onPress={onGoToLearning}
      style={[styles.primary, {backgroundColor: palette.primaryActionSurface}]}>
      <StudioActionLabel icon="play" color={palette.primaryActionText} size={22} textStyle={styles.buttonLabel}>继续学习</StudioActionLabel>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityState={{expanded: showExplanation}}
      testID="statistics-explanation-toggle" onPress={() => setShowExplanation(value => !value)} style={[styles.textButton, {backgroundColor: palette.panelStrong, borderColor: palette.border}]}>
      <StudioActionLabel icon={showExplanation ? 'chevronUp' : 'info'} color={palette.text} textStyle={styles.buttonLabel}>{showExplanation ? '收起统计说明' : '如何统计'}</StudioActionLabel>
    </Pressable>
    {showExplanation ? <Text style={[styles.explanation, {color: palette.textMuted}]} testID="statistics-explanation">
      完成作答后计入记录。同一张卡再次作答会增加练习次数，不重复增加当天的卡片数。这里只统计当前科目，按北京时间归入当天。自评有把握不等于客观题答对。
    </Text> : null}
    {pendingReviewCount > 0 && onStartReview ? <View style={styles.reviewEntry}>
      <Text style={[styles.detail, {color: palette.textMuted}]}>有 {pendingReviewCount} 张卡需要再练。</Text>
      <Pressable accessibilityRole="button" testID="statistics-start-review-button" onPress={onStartReview} style={[styles.textButton, {backgroundColor: palette.accentSoft, borderColor: palette.accent}]}>
        <StudioActionLabel icon="refresh" color={palette.text} textStyle={styles.buttonLabel}>开始复习</StudioActionLabel>
      </Pressable>
    </View> : null}
    <View testID="statistics-checkin-card" style={[styles.checkIn, {borderColor: palette.border}]}>
      <View style={styles.checkInCopy}>
        <Text style={[styles.label, {color: palette.text}]}>签到</Text>
        <Text testID="statistics-checkin-summary" style={[styles.detail, {color: palette.textMuted}]}>
          {hasCheckedInToday ? '今天已签到。' : canCheckInToday ? '今天的学习已记录，可以签到。' : '完成一张卡后可以签到，四六级共用签到记录。'}
        </Text>
      </View>
      <Pressable accessibilityRole="button" testID="statistics-checkin-button" disabled={!canCheckInToday || hasCheckedInToday}
        accessibilityState={{disabled: !canCheckInToday || hasCheckedInToday}}
        onPress={onCheckIn} style={[styles.secondary, {borderColor: canCheckInToday && !hasCheckedInToday ? palette.accent : palette.border,
          backgroundColor: hasCheckedInToday ? palette.panelStrong : canCheckInToday ? palette.accentSoft : palette.panel}]}>
        <StudioActionLabel icon={hasCheckedInToday ? 'checkCircle' : 'calendar'} color={hasCheckedInToday ? palette.success : canCheckInToday ? palette.text : palette.textMuted}
          textStyle={styles.buttonLabel} textTestID={hasCheckedInToday ? 'statistics-checkin-complete-label' : 'statistics-checkin-ready-label'}>{hasCheckedInToday ? '今日已签到' : '签到'}</StudioActionLabel>
      </Pressable>
    </View>
    {hasSyncNotice ? <View testID="statistics-status-ledger">
      <Text testID="statistics-sync-label" accessibilityLiveRegion="polite" style={[styles.detail, {color: palette.textMuted}]}>{syncStatusLabel}</Text>
      <Text testID="statistics-sync-detail" style={[styles.detail, {color: palette.textMuted}]}>{syncStatusDetail}</Text>
    </View> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  reviewEntry: {gap: 2},
  page: {padding: 20, paddingBottom: 28, gap: 18, flexGrow: 1},
  tablet: {paddingHorizontal: 36, maxWidth: 780, width: '100%', alignSelf: 'center'},
  heading: {gap: 8, paddingVertical: 12},
  eyebrow: {fontSize: 13, lineHeight: 20},
  title: {fontSize: 26, lineHeight: 34, fontWeight: '600'},
  metrics: {gap: 16},
  hero: {borderRadius: 24, padding: 24, gap: 12},
  label: {fontSize: 15, lineHeight: 23},
  number: {fontSize: 38, lineHeight: 48, fontWeight: '600', fontVariant: ['tabular-nums']},
  detail: {fontSize: 14, lineHeight: 23},
  cumulative: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, padding: 18, borderBottomWidth: StyleSheet.hairlineWidth},
  cumulativeValue: {fontSize: 21, lineHeight: 28, fontWeight: '500'},
  primary: {minHeight: 50, padding: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center'},
  buttonLabel: {fontSize: 15, fontWeight: '600', lineHeight: 22},
  textButton: {minHeight: 48, maxWidth: '100%', justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderRadius: 12},
  explanation: {fontSize: 13, lineHeight: 22},
  checkIn: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 18},
  checkInCopy: {flexGrow: 1, flexBasis: 180, gap: 6},
  secondary: {minHeight: 48, maxWidth: '100%', padding: 12, borderWidth: 1, borderRadius: 12, justifyContent: 'center'},
});
