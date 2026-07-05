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
  activeSurface: string;
  activeText: string;
  background: string;
  border: string;
  danger: string;
  panel: string;
  panelStrong: string;
  primaryActionSurface: string;
  primaryActionText: string;
  primaryActionMuted: string;
  success: string;
  tabIdle: string;
  text: string;
  textMuted: string;
  warning: string;
};

type DeviceClass = 'phone' | 'tablet';

export function StatisticsSurface({
  canCheckInToday,
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
    ? '今日连续性已记录。'
    : canCheckInToday
    ? '已有有效学习进展，可以记录今天。'
    : '先至少完成 1 张学习或回看卡，再把今天记成一次有效签到。';
  const reviewStatus =
    reviewResults.length > 0
      ? `已回看 ${reviewResults.length} · 待回看 ${pendingReviewCount}`
      : pendingReviewCount > 0
      ? `${pendingReviewCount} 张待回看`
      : combinedResults.length > 0
      ? '首轮已收口'
      : '暂无今日进展';
  const dailyTitle = hasCheckedInToday
    ? '今日已记录'
    : hasLearningProgress
    ? '学习手感保持中'
    : '先完成一张卡';
  const dailySummary = hasCheckedInToday
    ? `首轮 ${learningResults.length} · 回看 ${reviewResults.length} · ${syncStatusLabel}`
    : pendingReviewCount > 0
    ? `还有 ${pendingReviewCount} 张卡需要回看，统计只安静记录，不打断学习。`
    : hasLearningProgress
    ? `首轮 ${learningResults.length} · 回看 ${reviewResults.length} · 待签到`
    : '先回到学习完成一张卡，这里会记录今天的连续性。';
  const nextStepIsReview = pendingReviewCount > 0;
  const nextStepTitle = nextStepIsReview
    ? '先处理回看'
    : hasLearningProgress
    ? '继续下一张'
    : '回到第一张';
  const nextStepSummary = nextStepIsReview
    ? `${pendingReviewCount} 张卡需要再看一次，统计只提醒。`
    : hasLearningProgress
    ? '回到学习，继续往前推。'
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
          <View style={styles.dailyHeading}>
            <View style={styles.dailyEyebrowRow}>
              <View
                style={[
                  styles.dailySignal,
                  { backgroundColor: palette.accent },
                ]}
              />
              <Text style={[styles.eyebrow, { color: palette.accent }]}>
                今日学习
              </Text>
            </View>
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
              backgroundColor: 'transparent',
              borderColor: 'transparent',
            },
          ]}
          testID="statistics-metric-strip"
        >
          <MetricLedgerRow
            emphasis
            label="今日完成"
            palette={palette}
            testID="statistics-metric-completed"
            value={`${combinedResults.length}`}
          />
          <MetricLedgerRow
            label="首轮"
            palette={palette}
            testID="statistics-metric-learning"
            value={`${learningResults.length}`}
          />
          <MetricLedgerRow
            label="回看"
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
              backgroundColor: hexToRgba(palette.accent, 0.03),
              borderColor: hexToRgba(palette.accent, 0.08),
            },
          ]}
          testID="statistics-action-dock"
        >
          <View
            style={[
              styles.actionObjectRow,
              styles.nextStepRow,
              {
                backgroundColor: 'transparent',
                borderColor: 'transparent',
              },
            ]}
            testID="statistics-next-step-card"
          >
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
                    : palette.primaryActionSurface,
                  borderColor: nextStepIsReview
                    ? palette.warning
                    : palette.primaryActionSurface,
                },
              ]}
              testID={nextStepButtonTestID}
            >
              <Text
                style={[
                  styles.primaryButtonLabel,
                  {
                    color: nextStepIsReview
                      ? palette.panel
                      : palette.primaryActionText,
                  },
                ]}
              >
                {nextStepButtonLabel}
              </Text>
            </Pressable>
          </View>

          <View
            pointerEvents="none"
            style={[
              styles.actionDockDivider,
              {
                backgroundColor: hexToRgba(palette.textMuted, 0.12),
              },
            ]}
          />

          <View
            style={[
              styles.actionObjectRow,
              {
                backgroundColor: 'transparent',
                borderColor: 'transparent',
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
              borderTopColor: hexToRgba(palette.textMuted, 0.1),
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
  emphasis = false,
  label,
  palette,
  testID,
  tone,
  value,
}: {
  emphasis?: boolean;
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
        styles.metricLedgerRow,
        emphasis ? styles.metricLedgerRowEmphasis : null,
        {
          backgroundColor: emphasis
            ? hexToRgba(palette.accent, 0.07)
            : hexToRgba(palette.accent, 0.03),
          borderColor: emphasis
            ? hexToRgba(palette.accent, 0.13)
            : hexToRgba(palette.accent, 0.07),
        },
      ]}
      testID={testID}
    >
      <Text
        style={[
          styles.metricLabel,
          emphasis ? styles.metricLabelEmphasis : null,
          { color: palette.textMuted },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.metricValue,
          emphasis ? styles.metricValueEmphasis : null,
          { color: valueColor },
        ]}
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
    <View
      style={[
        styles.ledgerRow,
        {
          backgroundColor: hexToRgba(palette.accent, 0.024),
          borderColor: hexToRgba(palette.accent, 0.06),
        },
      ]}
    >
      <Text style={[styles.ledgerLabel, { color: palette.textMuted }]}>
        {label}
      </Text>
      <View style={styles.ledgerValueStack}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 8,
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
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
  },
  summary: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  metricLedger: {
    alignItems: 'stretch',
    borderRadius: 0,
    borderWidth: 0,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  metricLedgerRow: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'column',
    gap: 2,
    justifyContent: 'center',
    minHeight: 54,
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 7,
  },
  metricLedgerRowEmphasis: {
    flex: 1.18,
    minHeight: 58,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 22,
    textAlign: 'center',
  },
  metricValueEmphasis: {
    fontSize: 23,
    lineHeight: 27,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 14,
    textAlign: 'center',
  },
  metricLabelEmphasis: {
    fontSize: 10,
    lineHeight: 14,
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
    paddingHorizontal: 17,
    paddingVertical: 13,
  },
  dailyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  dailyHeading: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  dailyEyebrowRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dailySignal: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  checkInStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  checkInStatusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  actionDock: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 0,
    overflow: 'visible',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionObjectRow: {
    borderRadius: 0,
    borderWidth: 0,
  },
  nextStepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 2,
    paddingBottom: 7,
    paddingTop: 2,
  },
  actionDockDivider: {
    height: 1,
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
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  checkInDockRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 2,
    paddingBottom: 2,
    paddingTop: 7,
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
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  dailyPrimaryButton: {
    borderRadius: 999,
    minWidth: 96,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  nextStepButton: {
    borderRadius: 999,
    minWidth: 86,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  ledgerRail: {
    flexDirection: 'row',
    gap: 6,
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
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  ledgerRow: {
    alignItems: 'flex-start',
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'column',
    gap: 4,
    justifyContent: 'flex-start',
    minHeight: 58,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ledgerValueStack: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  statusLedger: {
    borderTopWidth: 1,
    marginTop: 0,
    paddingHorizontal: 0,
    paddingTop: 7,
    paddingBottom: 1,
  },
});
