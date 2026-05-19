import React from 'react';
import {
  Pressable,
  ScrollView,
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
    ? '今天已经产生有效学习进展，可以把连续性落成一次轻量签到。'
    : '先至少完成 1 张学习或回看卡，再把今天记成一次有效签到。';
  const reviewStatus =
    reviewResults.length > 0
      ? `已完成 ${reviewResults.length} 张回看卡，当前还剩 ${pendingReviewCount} 张待回看。`
      : pendingReviewCount > 0
      ? `首轮里还有 ${pendingReviewCount} 张卡待回看，先别把统计做成复杂大盘。`
      : combinedResults.length > 0
      ? '当前首轮已收口，暂时没有额外待回看卡。'
      : '今天还没有形成可展示的学习摘要。';

  return (
    <ScrollView
      contentContainerStyle={[
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
        <Text style={[styles.title, { color: palette.text }]}>轻量统计与签到</Text>
        <Text style={[styles.summary, { color: palette.textMuted }]}>
          统计只用于增强信心和连续性，把今日签到、学习摘要和回看状态收成低成本页面。
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
          style={deviceClass === 'tablet' ? styles.surfaceCardHalf : null}
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
          style={deviceClass === 'tablet' ? styles.surfaceCardHalf : null}
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

      <View
        style={[
          styles.sectionGrid,
          deviceClass === 'tablet' ? styles.sectionGridTablet : null,
        ]}
      >
        <SurfaceCard
          palette={palette}
          style={deviceClass === 'tablet' ? styles.surfaceCardHalf : null}
        >
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

        <SurfaceCard
          palette={palette}
          style={deviceClass === 'tablet' ? styles.surfaceCardHalf : null}
        >
          <Text style={[styles.cardTitle, { color: palette.text }]}>
            进展如何使用
          </Text>
          <InfoLine
            palette={palette}
            text="签到只和真实学习进展挂钩，不做空转打卡。"
          />
          <InfoLine
            palette={palette}
            text="统计页先解释今天发生了什么，不抬复杂趋势系统。"
          />
          <InfoLine
            palette={palette}
            text="会员、同步和重分析不会抢占这个轻量入口。"
          />
        </SurfaceCard>
      </View>
    </ScrollView>
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

function InfoLine({
  palette,
  text,
}: {
  palette: StatisticsPalette;
  text: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View
        style={[
          styles.infoDot,
          { backgroundColor: palette.accent, borderColor: palette.border },
        ]}
      />
      <Text style={[styles.infoText, { color: palette.textMuted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 16,
  },
  pageTablet: {
    paddingHorizontal: 24,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    gap: 14,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  summary: {
    fontSize: 15,
    lineHeight: 23,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    minWidth: 92,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    gap: 12,
  },
  sectionGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  surfaceCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  surfaceCardHalf: {
    width: '48%',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardSummary: {
    fontSize: 14,
    lineHeight: 22,
  },
  primaryButton: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  signalList: {
    gap: 10,
  },
  signalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  signalLabel: {
    fontSize: 14,
    lineHeight: 21,
  },
  signalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 6,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
});
