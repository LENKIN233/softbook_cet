import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';

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
  learningCompletedCount,
  onCheckIn,
  onGoToLearning,
  onStartReview,
  palette,
  pendingReviewCount,
  reviewCompletedCount,
  syncStatusDetail,
  syncStatusLabel,
}: {
  canCheckInToday: boolean;
  deviceClass: DeviceClass;
  hasCheckedInToday: boolean;
  learningCompletedCount: number;
  onCheckIn: () => void;
  onGoToLearning: () => void;
  onStartReview: () => void;
  palette: StatisticsPalette;
  pendingReviewCount: number;
  reviewCompletedCount: number;
  syncStatusDetail: string;
  syncStatusLabel: string;
}) {
  const { fontScale, height, width } = useWindowDimensions();
  const usesCompactLayout =
    deviceClass === 'phone' && (height < 800 || width < 370);
  const usesAccessibilityLayout = fontScale >= 1.3;
  const totalCompletedCount = learningCompletedCount + reviewCompletedCount;
  const hasLearningProgress = totalCompletedCount > 0;
  const checkInTitle = hasCheckedInToday
    ? '已签到'
    : canCheckInToday
    ? '可签到'
    : '待学习';
  const checkInSummary = hasCheckedInToday
    ? '今天已签到。'
    : canCheckInToday
    ? '完成学习后可以签到。'
    : '完成 1 张后可以签到。';
  const reviewStatus =
    reviewCompletedCount > 0
      ? `已回看 ${reviewCompletedCount} · 待回看 ${pendingReviewCount}`
      : pendingReviewCount > 0
      ? `${pendingReviewCount} 张待回看`
      : totalCompletedCount > 0
      ? '首轮完成'
      : '暂无今日进展';
  const dailyTitle = hasCheckedInToday
    ? hasLearningProgress
      ? '今天已完成'
      : '今天已签到'
    : hasLearningProgress
    ? '今天的进度'
    : '还没有学习记录';
  const dailySummary = hasCheckedInToday
    ? hasLearningProgress
      ? `完成 ${totalCompletedCount} · 回看 ${reviewCompletedCount}`
      : '还没有学习记录。'
    : pendingReviewCount > 0
    ? `还有 ${pendingReviewCount} 张卡需要回看。`
    : hasLearningProgress
    ? `完成 ${totalCompletedCount} 张`
    : '完成第一张后，这里会显示进度。';
  const nextStepIsReview = pendingReviewCount > 0;
  const nextStepTitle = nextStepIsReview
    ? '先回看'
    : hasLearningProgress
    ? '回到学习'
    : '开始第一张';
  const nextStepSummary = nextStepIsReview
    ? `还有 ${pendingReviewCount} 张卡需要回看。`
    : hasLearningProgress
    ? '按顺序继续下一张。'
    : '先完成第一张。';
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
    totalCompletedCount + pendingReviewCount,
    hasLearningProgress ? totalCompletedCount : 1,
    1,
  );
  const dailyRailProgress = Math.min(
    1,
    totalCompletedCount / dailyRailTarget,
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
    ? hasLearningProgress
      ? '今日已签到'
      : '今日已签到'
    : canCheckInToday
    ? '可以签到'
    : '完成一张后可签到';
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
    : canCheckInToday
    ? palette.primaryActionText
    : palette.panel;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.page,
        deviceClass === 'tablet' ? styles.pageTablet : null,
      ]}
      showsVerticalScrollIndicator={false}
      style={styles.pageScroll}
      testID="statistics-scroll"
    >
      <SurfaceCard
        palette={palette}
        style={[
          styles.dailyObjectCard,
          usesCompactLayout ? styles.dailyObjectCardCompact : null,
        ]}
        testID="statistics-day-object"
      >
        <View
          style={[
            styles.dailyHeader,
            usesAccessibilityLayout ? styles.dailyHeaderAccessible : null,
          ]}
        >
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
              backgroundColor: hexToRgba(dailyRailTone, 0.085),
              borderColor: 'transparent',
            },
          ]}
          testID="statistics-progress-dock"
        >
          <View style={styles.progressHeader}>
            <View style={styles.progressCopy}>
              <Text
                style={[styles.progressEyebrow, { color: dailyRailTone }]}
              >
                今日进度
              </Text>
              <Text
                numberOfLines={usesAccessibilityLayout ? undefined : 1}
                style={[styles.progressTitle, { color: palette.text }]}
                testID="statistics-progress-label"
              >
                {dailyRailLabel}
              </Text>
            </View>
            <Text
              style={[styles.progressRatio, { color: palette.text }]}
              testID="statistics-progress-ratio"
            >
              {`${totalCompletedCount}/${dailyRailTarget}`}
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
        </View>
      </SurfaceCard>

      <View
        style={[
          styles.metricLedger,
          usesAccessibilityLayout ? styles.metricLedgerAccessible : null,
        ]}
        testID="statistics-metric-strip"
      >
        <MetricLedgerRow
          detail={`首轮 ${learningCompletedCount}`}
          label="今日完成"
          palette={palette}
          testID="statistics-metric-completed"
          value={`${totalCompletedCount}`}
        />
        <MetricLedgerRow
          label="需要回看"
          palette={palette}
          testID="statistics-metric-pending-review"
          tone={pendingReviewCount > 0 ? 'warning' : 'success'}
          value={`${pendingReviewCount}`}
        />
        <MetricLedgerRow
          label="今日回看"
          palette={palette}
          testID="statistics-metric-review"
          value={`${reviewCompletedCount}`}
        />
      </View>

        <View
          style={[
            styles.actionDock,
            {
              backgroundColor: palette.panel,
              borderColor: 'transparent',
            },
          ]}
          testID="statistics-action-dock"
        >
          <View
            style={[
              styles.actionObjectRow,
              styles.nextStepRow,
              usesAccessibilityLayout ? styles.nextStepRowAccessible : null,
              {
                backgroundColor: palette.accentSoft,
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
                usesAccessibilityLayout
                  ? styles.nextStepButtonAccessible
                  : null,
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
                backgroundColor: hexToRgba(palette.success, 0.085),
                borderColor: 'transparent',
              },
              styles.checkInDockRow,
              usesAccessibilityLayout ? styles.checkInDockRowAccessible : null,
              deviceClass === 'tablet' ? styles.checkInDockRowTablet : null,
            ]}
            testID="statistics-checkin-card"
          >
            <View style={styles.checkInCopy}>
              <Text style={[styles.checkInTitle, { color: palette.text }]}>
                签到
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
                usesAccessibilityLayout
                  ? styles.dailyPrimaryButtonAccessible
                  : null,
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
                {hasCheckedInToday ? '今日已签到' : '签到'}
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
            <View
              style={[
                styles.ledgerRail,
                usesAccessibilityLayout ? styles.ledgerRailAccessible : null,
              ]}
              testID="statistics-ledger-rail"
            >
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
    </ScrollView>
  );
}

function MetricLedgerRow({
  detail,
  label,
  palette,
  testID,
  tone,
  value,
}: {
  detail?: string;
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
        {
          backgroundColor: palette.panel,
          borderColor: 'transparent',
        },
      ]}
      testID={testID}
    >
      <View style={styles.metricCopy}>
        <Text style={[styles.metricLabel, { color: palette.textMuted }]}>
          {label}
        </Text>
        {detail ? (
          <Text style={[styles.metricDetail, { color: palette.textMuted }]}>
            {detail}
          </Text>
        ) : null}
      </View>
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
        { backgroundColor: palette.panel, borderColor: 'transparent' },
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
          backgroundColor: palette.panelStrong,
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
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 10,
  },
  pageScroll: {
    flex: 1,
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
    flexDirection: 'row',
    gap: 7,
  },
  metricLedgerAccessible: {
    flexDirection: 'column',
  },
  metricLedgerRow: {
    alignItems: 'flex-start',
    borderRadius: 20,
    borderWidth: 0,
    flex: 1,
    gap: 5,
    justifyContent: 'center',
    minHeight: 78,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    lineHeight: 28,
    minWidth: 0,
    textAlign: 'left',
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
  },
  metricCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  metricDetail: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13,
  },
  surfaceCard: {
    borderWidth: 0,
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
    gap: 10,
    paddingHorizontal: 17,
    paddingVertical: 14,
  },
  dailyObjectCardCompact: {
    gap: 8,
    paddingVertical: 12,
  },
  dailyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  dailyHeaderAccessible: {
    alignItems: 'stretch',
    flexDirection: 'column',
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
    borderRadius: 16,
    borderWidth: 0,
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  progressHeader: {
    alignItems: 'center',
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
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    lineHeight: 24,
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
    borderRadius: 24,
    borderWidth: 0,
    flexShrink: 0,
    gap: 8,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 10,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.07,
    shadowRadius: 24,
    elevation: 2,
  },
  actionObjectRow: {
    borderRadius: 19,
    borderWidth: 0,
  },
  nextStepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 12,
  },
  nextStepRowAccessible: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  actionDockDivider: {
    height: 0,
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
    paddingHorizontal: 12,
    paddingBottom: 11,
    paddingTop: 11,
  },
  checkInDockRowTablet: {
    alignItems: 'flex-start',
  },
  checkInDockRowAccessible: {
    alignItems: 'stretch',
    flexDirection: 'column',
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
    borderWidth: 0,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
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
  dailyPrimaryButtonAccessible: {
    alignSelf: 'stretch',
  },
  nextStepButton: {
    borderRadius: 999,
    minWidth: 86,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  nextStepButtonAccessible: {
    alignSelf: 'stretch',
  },
  ledgerRail: {
    flexDirection: 'row',
    gap: 6,
  },
  ledgerRailAccessible: {
    flexDirection: 'column',
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
    borderWidth: 0,
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 54,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ledgerValueStack: {
    alignItems: 'flex-start',
    gap: 1,
    minWidth: 0,
    width: '100%',
  },
  statusLedger: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
});
