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
import { hexToRgba } from '../visual/tokens';

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
  onGoToLearning,
  onStartReview,
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
  onGoToLearning: () => void;
  onStartReview: () => void;
  palette: StatisticsPalette;
  pendingReviewCount: number;
  reviewResults: LearningCardResult[];
  syncStatusDetail: string;
  syncStatusLabel: string;
}) {
  const combinedResults = [...learningResults, ...reviewResults];
  const hasLearningProgress = combinedResults.length > 0;
  const checkInTitle = hasCheckedInToday
    ? '今日已签到'
    : canCheckInToday
    ? '今日可签到'
    : '先完成今日学习';
  const checkInSummary = hasCheckedInToday
    ? `${dayLabel} 已计入今天的学习连续性。`
    : canCheckInToday
    ? '今天已经产生有效学习进展，可以记录一次签到。'
    : '先至少完成 1 张学习或回看卡，再把今天记成一次有效签到。';
  const reviewStatus =
    reviewResults.length > 0
      ? `已完成 ${reviewResults.length} 张回看卡，当前还剩 ${pendingReviewCount} 张待回看。`
      : pendingReviewCount > 0
      ? `首轮里还有 ${pendingReviewCount} 张卡待回看，先把需要再看的卡处理完。`
      : combinedResults.length > 0
      ? '首轮已收口，暂时没有额外待回看卡。'
      : '今天还没有形成可展示的今日进展。';
  const dailyTitle = hasCheckedInToday
    ? '今日已记录'
    : hasLearningProgress
    ? '学习手感保持中'
    : '先完成一张卡';
  const dailySummary = hasCheckedInToday
    ? '完成、回看和签到已收成一条安静进度。'
    : pendingReviewCount > 0
    ? `还有 ${pendingReviewCount} 张卡需要回看，统计只安静记录，不打断学习。`
    : hasLearningProgress
    ? '今天的完成和回看都保持在轻负担范围。'
    : '先回到学习完成一张卡，这里会记录今天的连续性。';
  const nextStepIsReview = pendingReviewCount > 0;
  const nextStepTitle = nextStepIsReview
    ? '先处理回看'
    : hasLearningProgress
    ? '继续下一张'
    : '回到第一张';
  const nextStepSummary = nextStepIsReview
    ? `${pendingReviewCount} 张卡需要再看一次，统计只提醒，不让你停在这里。`
    : hasLearningProgress
    ? '今天已经有记录，回到学习把路线继续往前推。'
    : '回到学习完成第一张，统计会自动收起当天进度。';
  const nextStepButtonLabel = nextStepIsReview ? '开始回看' : '回学习';
  const nextStepButtonTestID = nextStepIsReview
    ? 'statistics-start-review-button'
    : 'statistics-go-learning-button';
  const onPressNextStep = nextStepIsReview ? onStartReview : onGoToLearning;
  const checkInButtonBackground = hasCheckedInToday
    ? palette.panelStrong
    : canCheckInToday
    ? palette.accent
    : palette.tabIdle;
  const checkInButtonBorder = hasCheckedInToday
    ? hexToRgba(palette.accent, 0.18)
    : canCheckInToday
    ? palette.accent
    : palette.border;
  const checkInButtonLabelColor = hasCheckedInToday
    ? palette.accentStrong
    : palette.panel;

  return (
    <View
      style={[styles.page, deviceClass === 'tablet' ? styles.pageTablet : null]}
    >
      <SurfaceCard
        palette={palette}
        style={styles.dailyObjectCard}
        testID="statistics-day-object"
      >
        <View style={styles.dailyHeader}>
          <View
            style={[styles.dailyAccent, { backgroundColor: palette.accent }]}
          />
          <View style={styles.dailyHeading}>
            <Text style={[styles.eyebrow, { color: palette.accent }]}>
              今日学习
            </Text>
            <Text style={[styles.title, { color: palette.text }]}>
              {dailyTitle}
            </Text>
            <Text style={[styles.summary, { color: palette.textMuted }]}>
              {dailySummary}
            </Text>
          </View>
          <View
            style={[
              styles.checkInStatusPill,
              {
                backgroundColor: hasCheckedInToday
                  ? palette.accentSoft
                  : hexToRgba(palette.accent, 0.07),
              },
            ]}
          >
            <Text
              style={[
                styles.checkInStatusText,
                {
                  color: hasCheckedInToday
                    ? palette.accentStrong
                    : palette.accentStrong,
                },
              ]}
            >
              {checkInTitle}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.metricLedger,
            {
              backgroundColor: palette.panelStrong,
              borderColor: hexToRgba(palette.accent, 0.1),
            },
          ]}
          testID="statistics-metric-strip"
        >
          <MetricLedgerRow
            label="今日完成"
            palette={palette}
            testID="statistics-metric-completed"
            value={`${combinedResults.length}`}
          />
          <MetricLedgerRow
            label="首轮完成"
            palette={palette}
            testID="statistics-metric-learning"
            value={`${learningResults.length}`}
          />
          <MetricLedgerRow
            label="回看完成"
            palette={palette}
            testID="statistics-metric-review"
            value={`${reviewResults.length}`}
          />
          <MetricLedgerRow
            label="待回看"
            palette={palette}
            testID="statistics-metric-pending-review"
            tone={pendingReviewCount > 0 ? 'warning' : 'success'}
            value={`${pendingReviewCount}`}
          />
        </View>

        <View
          style={[
            styles.actionDock,
            {
              backgroundColor: nextStepIsReview
                ? hexToRgba(palette.warning, 0.08)
                : hexToRgba(palette.accent, 0.07),
              borderColor: nextStepIsReview
                ? hexToRgba(palette.warning, 0.18)
                : hexToRgba(palette.accent, 0.15),
            },
          ]}
          testID="statistics-action-dock"
        >
          <View style={styles.nextStepRow} testID="statistics-next-step-card">
            <View style={styles.nextStepCopy}>
              <Text
                style={[
                  styles.nextStepEyebrow,
                  {
                    color: nextStepIsReview ? palette.warning : palette.accent,
                  },
                ]}
              >
                下一步
              </Text>
              <Text style={[styles.nextStepTitle, { color: palette.text }]}>
                {nextStepTitle}
              </Text>
              <Text style={[styles.cardSummary, { color: palette.textMuted }]}>
                {nextStepSummary}
              </Text>
            </View>
            <Pressable
              onPress={onPressNextStep}
              style={[
                styles.primaryButton,
                styles.nextStepButton,
                {
                  backgroundColor: nextStepIsReview
                    ? palette.warning
                    : palette.accent,
                  borderColor: nextStepIsReview
                    ? palette.warning
                    : palette.accent,
                },
              ]}
              testID={nextStepButtonTestID}
            >
              <Text
                style={[styles.primaryButtonLabel, { color: palette.panel }]}
              >
                {nextStepButtonLabel}
              </Text>
            </Pressable>
          </View>

          <View
            style={[
              {
                backgroundColor: palette.panel,
                borderColor: hexToRgba(palette.accent, 0.12),
              },
              styles.checkInDockRow,
              deviceClass === 'tablet' ? styles.checkInDockRowTablet : null,
            ]}
            testID="statistics-checkin-card"
          >
            <View style={styles.checkInCopy}>
              <Text style={[styles.checkInTitle, { color: palette.text }]}>
                连续性
              </Text>
              <Text
                style={[styles.cardSummary, { color: palette.textMuted }]}
                testID="statistics-checkin-summary"
              >
                {checkInSummary}
              </Text>
            </View>
            <Pressable
              disabled={!canCheckInToday || hasCheckedInToday}
              onPress={onCheckIn}
              style={[
                styles.primaryButton,
                styles.dailyPrimaryButton,
                {
                  backgroundColor: checkInButtonBackground,
                  borderColor: checkInButtonBorder,
                },
              ]}
              testID="statistics-checkin-button"
            >
              <Text
                style={[
                  styles.primaryButtonLabel,
                  { color: checkInButtonLabelColor },
                ]}
                testID={
                  hasCheckedInToday
                    ? 'statistics-checkin-complete-label'
                    : 'statistics-checkin-ready-label'
                }
              >
                {hasCheckedInToday ? '已记录' : '完成签到'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.statusLedger,
            {
              borderColor: hexToRgba(palette.accent, 0.12),
            },
          ]}
        >
          <View style={styles.ledgerRail}>
            <LedgerRow
              label="回看"
              palette={palette}
              testID="statistics-review-status"
              value={reviewStatus}
            />
            <LedgerRow
              detail={syncStatusDetail}
              detailTestID="statistics-sync-detail"
              label="记录"
              palette={palette}
              testID="statistics-sync-label"
              value={syncStatusLabel}
            />
          </View>
        </View>
      </SurfaceCard>
    </View>
  );
}

function MetricLedgerRow({
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
    <View style={styles.metricLedgerRow} testID={testID}>
      <Text style={[styles.metricLabel, { color: palette.textMuted }]}>
        {label}
      </Text>
      <Text
        style={[styles.metricValue, { color: valueColor }]}
        testID={testID ? `${testID}-value` : undefined}
      >
        {value}
      </Text>
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

function LedgerRow({
  detail,
  detailTestID,
  label,
  palette,
  testID,
  value,
}: {
  detail?: string;
  detailTestID?: string;
  label: string;
  palette: StatisticsPalette;
  testID?: string;
  value: string;
}) {
  return (
    <View style={styles.ledgerRow}>
      <Text style={[styles.ledgerLabel, { color: palette.textMuted }]}>
        {label}
      </Text>
      <Text
        numberOfLines={2}
        style={[styles.ledgerValue, { color: palette.text }]}
        testID={testID}
      >
        {value}
      </Text>
      {detail ? (
        <Text
          numberOfLines={2}
          style={[styles.ledgerDetail, { color: palette.textMuted }]}
          testID={detailTestID}
        >
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 9,
  },
  pageTablet: {
    paddingHorizontal: 24,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  title: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
  },
  summary: {
    fontSize: 13,
    lineHeight: 19,
  },
  metricLedger: {
    borderWidth: 1,
    borderRadius: 22,
    gap: 0,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  metricLedgerRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 34,
    paddingVertical: 5,
  },
  metricValue: {
    fontSize: 21,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 25,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  surfaceCard: {
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    flexShrink: 1,
  },
  cardSummary: {
    fontSize: 12,
    lineHeight: 18,
  },
  dailyObjectCard: {
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  dailyHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  dailyHeading: {
    flex: 1,
    gap: 6,
  },
  dailyAccent: {
    borderRadius: 999,
    height: 76,
    width: 6,
  },
  checkInStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  checkInStatusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  actionDock: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  nextStepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  nextStepCopy: {
    flex: 1,
    gap: 4,
  },
  nextStepEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
  },
  nextStepTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  checkInDockRow: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  checkInDockRowTablet: {
    alignItems: 'flex-start',
  },
  checkInCopy: {
    flex: 1,
    gap: 5,
  },
  checkInTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    borderWidth: 1,
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
  dailyPrimaryButton: {
    borderRadius: 999,
    minWidth: 112,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  nextStepButton: {
    borderRadius: 999,
    minWidth: 104,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  ledgerRail: {
    gap: 8,
  },
  ledgerLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
  },
  ledgerValue: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  ledgerDetail: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    textAlign: 'right',
  },
  ledgerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 29,
  },
  statusLedger: {
    borderTopWidth: 1,
    marginTop: 2,
    paddingHorizontal: 2,
    paddingTop: 9,
  },
});
