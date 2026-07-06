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
  warningText: string;
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
    ? `${combinedResults.length} 张`
    : canCheckInToday
    ? '可收好'
    : '待学习';
  const checkInSummary = hasCheckedInToday
    ? '今天已签到，记录跟着账号保存。'
    : canCheckInToday
    ? '已完成学习，点一下收好今天。'
    : '完成 1 张后再收好今天。';
  const reviewStatus =
    reviewResults.length > 0
      ? `已回看 ${reviewResults.length} · 待回看 ${pendingReviewCount}`
      : pendingReviewCount > 0
      ? `${pendingReviewCount} 张待回看`
      : combinedResults.length > 0
      ? '首轮已收口'
      : '暂无今日进展';
  const dailyTitle = hasCheckedInToday
    ? '今天已收好'
    : hasLearningProgress
    ? '学习在推进'
    : '从第一张开始';
  const dailySummary = hasCheckedInToday
    ? `完成 ${combinedResults.length} · 回看 ${reviewResults.length}`
    : pendingReviewCount > 0
    ? `还有 ${pendingReviewCount} 张卡需要回看，统计只安静记录，不打断学习。`
    : hasLearningProgress
    ? `完成 ${combinedResults.length} · 可以收好今天`
    : '回到学习完成一张卡，这里只记录当天进度。';
  const nextStepIsReview = pendingReviewCount > 0;
  const nextStepTitle = nextStepIsReview
    ? '先处理回看'
    : hasLearningProgress
    ? '回到学习'
    : '开始第一张';
  const nextStepSummary = nextStepIsReview
    ? `${pendingReviewCount} 张卡需要再看一次，统计只提醒。`
    : hasLearningProgress
    ? '继续当前顺序，系统带你往前。'
    : '先完成第一张，进度会自动收起。';
  const nextStepButtonLabel = nextStepIsReview ? '开始回看' : '继续学习';
  const nextStepButtonTestID = nextStepIsReview
    ? 'statistics-start-review-button'
    : 'statistics-go-learning-button';
  const onPressNextStep = nextStepIsReview ? onStartReview : onGoToLearning;
  const syncLedgerDetail =
    hasCheckedInToday && syncStatusLabel === '已记录'
      ? undefined
      : syncStatusDetail;
  const dailyRailTarget = Math.max(
    combinedResults.length + pendingReviewCount,
    hasLearningProgress ? combinedResults.length : 1,
    1,
  );
  const dailyRailProgress = Math.min(
    1,
    combinedResults.length / dailyRailTarget,
  );
  const dailyRailFillPercent = hasLearningProgress
    ? Math.max(14, Math.round(dailyRailProgress * 100))
    : 8;
  const dailyRailFill = `${dailyRailFillPercent}%` as ViewStyle['width'];
  const dailyRailTone = nextStepIsReview
    ? palette.warning
    : hasCheckedInToday
    ? palette.success
    : palette.accent;
  const dailyRailLabel = nextStepIsReview
    ? `${pendingReviewCount} 张回看待处理`
    : hasCheckedInToday
    ? '节奏已收好'
    : canCheckInToday
    ? '可以收好今天'
    : '完成一张后点亮';
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
            styles.progressDock,
            {
              backgroundColor: hexToRgba(dailyRailTone, 0.055),
              borderColor: hexToRgba(dailyRailTone, 0.16),
            },
          ]}
          testID="statistics-progress-dock"
        >
          <View style={styles.progressHeader}>
            <View style={styles.progressCopy}>
              <Text style={[styles.progressEyebrow, { color: dailyRailTone }]}>
                今日节奏
              </Text>
              <Text
                style={[styles.progressTitle, { color: palette.text }]}
                testID="statistics-progress-label"
              >
                {dailyRailLabel}
              </Text>
            </View>
          </View>
          <View style={styles.progressMeter}>
            <Text
              style={[styles.progressRatio, { color: palette.text }]}
              testID="statistics-progress-ratio"
            >
              {`${combinedResults.length}/${dailyRailTarget}`}
            </Text>
            <Text
              style={[
                styles.progressMeterCaption,
                { color: palette.textMuted },
              ]}
            >
              今日完成 / 今日目标
            </Text>
          </View>
          <View
            style={[
              styles.progressTrack,
              { backgroundColor: hexToRgba(dailyRailTone, 0.12) },
            ]}
            testID="statistics-progress-rail"
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: dailyRailTone,
                  width: dailyRailFill,
                },
              ]}
              testID="statistics-progress-fill"
            />
          </View>
          <View
            style={[
              styles.metricLedger,
              {
                backgroundColor: hexToRgba(dailyRailTone, 0.045),
                borderColor: hexToRgba(dailyRailTone, 0.08),
              },
            ]}
            testID="statistics-metric-strip"
          >
            <MetricLedgerRow
              dividerAfter
              emphasis
              label="今日完成"
              palette={palette}
              testID="statistics-metric-completed"
              value={`${combinedResults.length}`}
            />
            <MetricLedgerRow
              dividerAfter
              label="首轮"
              palette={palette}
              testID="statistics-metric-learning"
              value={`${learningResults.length}`}
            />
            <MetricLedgerRow
              dividerAfter
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
                      ? palette.warningText
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
                backgroundColor: hexToRgba(palette.accent, 0.035),
                borderColor: hexToRgba(palette.accent, 0.08),
              },
              styles.checkInDockRow,
              deviceClass === 'tablet' ? styles.checkInDockRowTablet : null,
            ]}
            testID="statistics-checkin-card"
          >
            <View style={styles.checkInCopy}>
              <Text style={[styles.checkInTitle, { color: palette.text }]}>
                今日记录
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
                {hasCheckedInToday ? '今日已签到' : '收好今天'}
              </Text>
            </Pressable>
          </View>

          <View
            pointerEvents="none"
            style={[
              styles.actionDockDivider,
              {
                backgroundColor: hexToRgba(palette.textMuted, 0.1),
              },
            ]}
          />

          <View style={styles.statusLedger} testID="statistics-status-ledger">
            <View style={styles.ledgerRail} testID="statistics-ledger-rail">
              <LedgerRow
                label="回看"
                palette={palette}
                testID="statistics-review-status"
                value={reviewStatus}
              />
              <LedgerRow
                detail={syncLedgerDetail}
                detailTestID="statistics-sync-detail"
                label="记录"
                palette={palette}
                testID="statistics-sync-label"
                value={syncStatusLabel}
              />
            </View>
          </View>
        </View>
      </SurfaceCard>
    </View>
  );
}

function MetricLedgerRow({
  dividerAfter = false,
  emphasis = false,
  label,
  palette,
  testID,
  tone,
  value,
}: {
  dividerAfter?: boolean;
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
        dividerAfter ? styles.metricLedgerDivider : null,
        {
          borderRightColor: hexToRgba(palette.textMuted, 0.11),
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
          backgroundColor: 'transparent',
          borderColor: 'transparent',
        },
      ]}
    >
      <Text style={[styles.ledgerLabel, { color: palette.textMuted }]}>
        {label}
      </Text>
      <View style={styles.ledgerValueStack}>
        <Text
          numberOfLines={1}
          style={[styles.ledgerValue, { color: palette.text }]}
          testID={testID}
        >
          {value}
        </Text>
        {detail ? (
          <Text
            numberOfLines={1}
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
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 0,
    overflow: 'hidden',
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  metricLedgerRow: {
    alignItems: 'center',
    borderRadius: 0,
    borderWidth: 0,
    flex: 1,
    flexDirection: 'column',
    gap: 1,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 0,
    paddingHorizontal: 3,
    paddingVertical: 5,
  },
  metricLedgerRowEmphasis: {
    flex: 1.18,
  },
  metricLedgerDivider: {
    borderRightWidth: 1,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 18,
    textAlign: 'center',
  },
  metricValueEmphasis: {
    fontSize: 19,
    lineHeight: 22,
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
    flex: 1,
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 0,
    paddingHorizontal: 17,
    paddingVertical: 15,
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
  progressDock: {
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 0,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  progressHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  progressCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  progressEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  progressRatio: {
    fontSize: 46,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 50,
  },
  progressMeter: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minHeight: 72,
  },
  progressMeterCaption: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  progressTrack: {
    borderRadius: 999,
    height: 9,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 999,
    height: '100%',
  },
  actionDock: {
    borderRadius: 20,
    borderWidth: 1,
    flexShrink: 0,
    gap: 0,
    overflow: 'visible',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  actionObjectRow: {
    borderRadius: 16,
    borderWidth: 1,
  },
  nextStepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 2,
    paddingBottom: 8,
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
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 21,
  },
  checkInDockRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 42,
    paddingHorizontal: 10,
    paddingBottom: 8,
    paddingTop: 8,
  },
  checkInDockRowTablet: {
    alignItems: 'flex-start',
  },
  checkInCopy: {
    flex: 1,
    gap: 5,
  },
  checkInTitle: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
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
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  ledgerRow: {
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  ledgerValueStack: {
    alignItems: 'flex-start',
    gap: 1,
    minWidth: 0,
    width: '100%',
  },
  statusLedger: {
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 0,
  },
});
