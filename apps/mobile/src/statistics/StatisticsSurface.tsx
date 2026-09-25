import React from 'react';
import {StudioPressable as Pressable, MotionView} from '../learning/NativeMotion';
import {STUDIO} from '../visual/studio';
import {
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
  cumulativeLearnedCount,
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
  cumulativeLearnedCount?: number;
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
  const metricGrid =
    deviceClass === 'phone' &&
    !usesAccessibilityLayout &&
    cumulativeLearnedCount !== undefined;
  const totalCompletedCount = learningCompletedCount + reviewCompletedCount;
  const hasLearningProgress = totalCompletedCount > 0;
  const checkInSummary = hasCheckedInToday
    ? '今天已签到。'
    : canCheckInToday
    ? '完成学习后可以签到。'
    : '完成 1 张后可以签到。';
  const nextStepIsReview = pendingReviewCount > 0;
  const nextStepSummary = nextStepIsReview
    ? `还有 ${pendingReviewCount} 张卡需要复习。`
    : hasLearningProgress
    ? '按顺序继续下一张。'
    : '先完成第一张。';
  const nextStepButtonLabel = nextStepIsReview ? '开始复习' : '继续学习';
  const nextStepButtonTestID = nextStepIsReview
    ? 'statistics-start-review-button'
    : 'statistics-go-learning-button';
  const onPressNextStep = nextStepIsReview ? onStartReview : onGoToLearning;
  const syncLedgerDetail =
    hasCheckedInToday && syncStatusLabel === '已记录'
      ? undefined
      : syncStatusDetail;
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
        <Text style={[styles.title, { color: palette.text }]}>学习统计</Text>
        {!hasLearningProgress ? (
          <Text style={[styles.summary, { color: palette.textMuted }]}>
            完成第一张后，这里会显示记录。
          </Text>
        ) : null}
      </SurfaceCard>

      <View
        style={[
          styles.metricLedger,
          usesAccessibilityLayout ? styles.metricLedgerAccessible : null,
          metricGrid ? styles.metricLedgerGrid : null,
        ]}
        testID="statistics-metric-strip"
      >
        <MetricLedgerRow
          grid={metricGrid}
          detail={`学习 ${learningCompletedCount} 张`}
          label="今日完成"
          palette={palette}
          testID="statistics-metric-completed"
          value={`${totalCompletedCount}`}
        />
        <MetricLedgerRow
          grid={metricGrid}
          label="待复习"
          palette={palette}
          testID="statistics-metric-pending-review"
          tone={pendingReviewCount > 0 ? 'warning' : 'success'}
          value={`${pendingReviewCount}`}
        />
        <MetricLedgerRow
          grid={metricGrid}
          label="今日复习"
          palette={palette}
          testID="statistics-metric-review"
          value={`${reviewCompletedCount}`}
        />
        {cumulativeLearnedCount !== undefined ? (
          <MetricLedgerRow
            grid={metricGrid}
            label="累计学过"
            palette={palette}
            testID="statistics-metric-cumulative"
            value={`${cumulativeLearnedCount}`}
          />
        ) : null}
      </View>

      <View
        style={[
          styles.actionDock,
          {
            backgroundColor: 'transparent',
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
              backgroundColor: 'transparent',
              borderColor: 'transparent',
            },
          ]}
          testID="statistics-next-step-card"
        >
          <View style={styles.nextStepCopy}>
            <Text style={[styles.cardSummary, { color: palette.textMuted }]}>
              {nextStepSummary}
            </Text>
          </View>
          <Pressable
            onPress={onPressNextStep}
            style={[
              styles.primaryButton,
              styles.nextStepButton,
              usesAccessibilityLayout ? styles.nextStepButtonAccessible : null,
              {
                backgroundColor: nextStepIsReview
                  ? palette.warningText
                  : palette.primaryActionSurface,
                borderColor: nextStepIsReview
                  ? palette.warningText
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

        {!['已记录', '已同步', '暂无记录', '已保存在本机'].includes(
          syncStatusLabel,
        ) ? (
          <View style={styles.statusLedger} testID="statistics-status-ledger">
            <View
              style={[
                styles.ledgerRail,
                usesAccessibilityLayout ? styles.ledgerRailAccessible : null,
              ]}
              testID="statistics-ledger-rail"
            >
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
        ) : null}
      </View>
    </ScrollView>
  );
}

function MetricLedgerRow({
  grid = false,
  detail,
  label,
  palette,
  testID,
  tone,
  value,
}: {
  grid?: boolean;
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
      ? palette.warningText
      : tone === 'danger'
      ? palette.danger
      : palette.accentStrong;

  return (
    <View
      style={[
        styles.metricLedgerRow,
        grid ? styles.metricLedgerRowGrid : null,
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
      <MotionView motionKey={value} kind="result">
      <Text
        style={[styles.metricValue, { color: valueColor }]}
        testID={testID ? `${testID}-value` : undefined}
      >
        {value}
      </Text>
      </MotionView>
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
        { backgroundColor: 'transparent', borderColor: palette.border },
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
    paddingHorizontal: STUDIO.space.phone,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 18,
  },
  pageScroll: {
    flex: 1,
  },
  pageTablet: {
    paddingHorizontal: 24,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
  },
  title: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '600',
  },
  summary: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  metricLedger: {
    flexDirection: 'row',
    gap: 10,
  },
  metricLedgerGrid: { flexWrap: 'wrap' },
  metricLedgerRowGrid: { flexBasis: '45%', flexGrow: 1, flexShrink: 1 },
  metricLedgerAccessible: {
    flexDirection: 'column',
  },
  metricLedgerRow: {
    alignItems: 'flex-start',
    borderRadius: 16,
    borderWidth: 0,
    flex: 1,
    gap: 9,
    justifyContent: 'center',
    minHeight: 104,
    minWidth: 0,
    paddingHorizontal: 17,
    paddingVertical: 18,
  },
  metricValue: {
    fontSize: 34,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    lineHeight: 41,
    minWidth: 0,
    textAlign: 'left',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
  },
  metricCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  metricDetail: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 17,
  },
  surfaceCard: {
    borderWidth: 0,
    borderRadius: 0,
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
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 24,

    borderRadius: STUDIO.radius.section,
  },
  dailyObjectCardCompact: {
    gap: 12,
    paddingVertical: 22,
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
    fontWeight: '600',
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
    fontWeight: '600',
    lineHeight: 15,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  progressRatio: {
    fontSize: 20,
    fontWeight: '600',
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
    gap: 14,
    overflow: 'hidden',
    paddingHorizontal: 0,
    paddingVertical: 0,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0,
    shadowRadius: 24,
    elevation: 0,
  },
  actionObjectRow: {
    borderRadius: 19,
    borderWidth: 0,
  },
  nextStepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 12,
    paddingTop: 12,

    paddingVertical: 20,
    borderRadius: 18,
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
    fontWeight: '600',
    letterSpacing: 0,
  },
  nextStepTitle: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 21,
  },
  checkInDockRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 72,
    paddingHorizontal: 18,
    paddingBottom: 11,
    paddingTop: 11,

    paddingVertical: 18,
    borderRadius: 18,
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
    fontWeight: '600',
    lineHeight: 16,
  },
  primaryButton: {
    borderWidth: 0,
    borderRadius: STUDIO.radius.control,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  dailyPrimaryButton: {
    borderRadius: 14,
    minWidth: 96,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  dailyPrimaryButtonAccessible: {
    alignSelf: 'stretch',
  },
  nextStepButton: {
    borderRadius: 14,
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
    fontWeight: '600',
    letterSpacing: 0,
  },
  ledgerValue: {
    fontSize: 13,
    fontWeight: '600',
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
