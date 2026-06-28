import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { LearningCardResult } from '../learning/model';
import { summarizeLearningResults } from '../learning/session';

type StatisticsPalette = {
  accent: string;
  accentSoft: string;
  accentStrong: string;
  background: string;
  border: string;
  danger: string;
  panel: string;
  panelStrong: string;
  success: string;
  tabIdle: string;
  text: string;
  textMuted: string;
  warning: string;
};

type DeviceClass = 'phone' | 'tablet';

export function StatisticsSurface({
  canCheckInToday,
  dayLabel,
  deviceClass,
  hasCheckedInToday,
  learningResults,
  onCheckIn,
  palette,
  pendingReviewCount,
  reviewResults,
  syncStatusDetail,
  syncStatusLabel,
}: {
  canCheckInToday: boolean;
  dayLabel: string;
  deviceClass: DeviceClass;
  hasCheckedInToday: boolean;
  learningResults: LearningCardResult[];
  onCheckIn: () => void;
  palette: StatisticsPalette;
  pendingReviewCount: number;
  reviewResults: LearningCardResult[];
  syncStatusDetail: string;
  syncStatusLabel: string;
}) {
  const combinedResults = [...learningResults, ...reviewResults];
  const combinedSummary = summarizeLearningResults(
    combinedResults,
    combinedResults.length,
  );
  const checkInTitle = hasCheckedInToday
    ? '今日已签到'
    : canCheckInToday
    ? '今日可签到'
    : '先完成今日学习';
  const checkInSummary = hasCheckedInToday
    ? `${dayLabel} 的连续性已经记录到今日统计里。`
    : canCheckInToday
    ? '今天已经产生有效学习进展，可以记录一次签到。'
    : '先至少完成 1 张学习或回看卡，再把今天记成一次有效签到。';
  const reviewStatus =
    reviewResults.length > 0
      ? `已完成 ${reviewResults.length} 张回看卡，当前还剩 ${pendingReviewCount} 张待回看。`
      : pendingReviewCount > 0
      ? `首轮里还有 ${pendingReviewCount} 张卡待回看，先把需要再看的卡处理完。`
      : combinedResults.length > 0
      ? '当前首轮已收口，暂时没有额外待回看卡。'
      : '今天还没有形成可展示的今日进展。';

  return (
    <View
      style={[
        styles.page,
        deviceClass === 'tablet' ? styles.pageTablet : null,
      ]}
    >
      <View
        style={[
          styles.hero,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
      >
        <Text style={[styles.eyebrow, { color: palette.accent }]}>
          今日进展
        </Text>
        <Text style={[styles.title, { color: palette.text }]}>今日统计与签到</Text>
        <Text style={[styles.summary, { color: palette.textMuted }]}>
          这里汇总今天完成的卡、待回看的卡和签到状态。
        </Text>
        <View style={styles.metricRow}>
          <MetricCard
            label="今日完成"
            palette={palette}
            testID="statistics-metric-completed"
            value={`${combinedResults.length}`}
          />
          <MetricCard
            label="首轮完成"
            palette={palette}
            testID="statistics-metric-learning"
            value={`${learningResults.length}`}
          />
          <MetricCard
            label="回看完成"
            palette={palette}
            testID="statistics-metric-review"
            value={`${reviewResults.length}`}
          />
          <MetricCard
            label="待回看"
            palette={palette}
            testID="statistics-metric-pending-review"
            tone={pendingReviewCount > 0 ? 'warning' : 'success'}
            value={`${pendingReviewCount}`}
          />
        </View>
      </View>

      <View
        style={[
          styles.sectionGrid,
          deviceClass === 'tablet' ? styles.sectionGridTablet : null,
        ]}
      >
        <SurfaceCard
          palette={palette}
          style={styles.surfaceCardHalf}
          testID="statistics-checkin-card"
        >
          <Text style={[styles.cardTitle, { color: palette.text }]}>
            {checkInTitle}
          </Text>
          <Text
            style={[styles.cardSummary, { color: palette.textMuted }]}
            testID="statistics-checkin-summary"
          >
            {checkInSummary}
          </Text>
          <Pressable
            disabled={!canCheckInToday || hasCheckedInToday}
            onPress={onCheckIn}
            style={[
              styles.primaryButton,
              {
                backgroundColor:
                  hasCheckedInToday || canCheckInToday
                    ? palette.accent
                    : palette.tabIdle,
              },
            ]}
            testID="statistics-checkin-button"
          >
            <Text
              style={[styles.primaryButtonLabel, { color: palette.panel }]}
              testID={
                hasCheckedInToday
                  ? 'statistics-checkin-complete-label'
                  : 'statistics-checkin-ready-label'
              }
            >
              {hasCheckedInToday ? '今日已签到' : '完成今日签到'}
            </Text>
          </Pressable>
        </SurfaceCard>

        <SurfaceCard
          palette={palette}
          style={styles.surfaceCardHalf}
        >
          <Text style={[styles.cardTitle, { color: palette.text }]}>
            回看状态
          </Text>
          <Text
            style={[styles.cardSummary, { color: palette.textMuted }]}
            testID="statistics-review-status"
          >
            {reviewStatus}
          </Text>
        </SurfaceCard>
      </View>

      <SurfaceCard palette={palette}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>今日同步</Text>
        <Text
          style={[styles.cardSummary, { color: palette.textMuted }]}
          testID="statistics-sync-label"
        >
          {syncStatusLabel}
        </Text>
        <Text
          style={[styles.cardSummary, { color: palette.textMuted }]}
          testID="statistics-sync-detail"
        >
          {syncStatusDetail}
        </Text>
      </SurfaceCard>

      <SurfaceCard palette={palette}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>
          今日练习信号
        </Text>
        <View style={styles.signalList}>
          <SignalRow
            label="自动判对"
            palette={palette}
            value={`${combinedSummary.autoCorrectCount}`}
          />
          <SignalRow
            label="自动判错"
            palette={palette}
            value={`${combinedSummary.autoIncorrectCount}`}
          />
          <SignalRow
            label="翻面回看"
            palette={palette}
            value={`${combinedSummary.reviewFlipCount}`}
          />
          <SignalRow
            label="收藏"
            palette={palette}
            value={`${combinedSummary.favoriteCount}`}
          />
        </View>
      </SurfaceCard>
    </View>
  );
}

function MetricCard({
  label,
  palette,
  testID,
  tone,
  value,
}: {
  label: string;
  palette: StatisticsPalette;
  testID?: string;
  tone?: 'success' | 'warning' | 'danger';
  value: string;
}) {
  const valueColor =
    tone === 'success'
      ? palette.success
      : tone === 'warning'
      ? palette.warning
      : tone === 'danger'
      ? palette.danger
      : palette.accentStrong;

  return (
    <View
      style={[
        styles.metricCard,
        { backgroundColor: palette.panelStrong, borderColor: palette.border },
      ]}
      testID={testID}
    >
      <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: palette.textMuted }]}>{label}</Text>
    </View>
  );
}

function SurfaceCard({
  children,
  palette,
  style,
  testID,
}: {
  children: React.ReactNode;
  palette: StatisticsPalette;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View
      style={[
        styles.surfaceCard,
        style,
        { backgroundColor: palette.panel, borderColor: palette.border },
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

function SignalRow({
  label,
  palette,
  value,
}: {
  label: string;
  palette: StatisticsPalette;
  value: string;
}) {
  return (
    <View style={styles.signalRow}>
      <Text style={[styles.signalLabel, { color: palette.textMuted }]}>{label}</Text>
      <Text style={[styles.signalValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  pageTablet: {
    paddingHorizontal: 24,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 9,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  summary: {
    fontSize: 13,
    lineHeight: 19,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    minWidth: 74,
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  sectionGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  surfaceCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    flexShrink: 1,
  },
  surfaceCardHalf: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSummary: {
    fontSize: 12,
    lineHeight: 18,
  },
  primaryButton: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  signalList: {
    gap: 6,
  },
  signalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  signalLabel: {
    fontSize: 12,
    lineHeight: 18,
  },
  signalValue: {
    fontSize: 14,
    fontWeight: '700',
  },
});
