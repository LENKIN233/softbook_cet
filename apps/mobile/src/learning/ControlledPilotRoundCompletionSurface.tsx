import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import type { LearningSurfacePalette } from './LearningSurface';
import type { LearningCard } from './model';

type Props = {
  completedCount: number;
  error: string | null;
  onContinue: () => void;
  onOpenSpace: () => void;
  onReview: () => void;
  palette: LearningSurfacePalette;
  pending: boolean;
  spaceAddress: string;
};

export function ControlledPilotRoundCompletionSurface({
  completedCount,
  error,
  onContinue,
  onOpenSpace,
  onReview,
  palette,
  pending,
  spaceAddress,
}: Props) {
  const { height, width } = useWindowDimensions();
  const compact = width <= 340 || height <= 720;
  const roundNumber = Math.max(1, Math.floor(completedCount / 5));

  return (
    <View
      style={[styles.screen, compact ? styles.screenCompact : null]}
      testID="controlled-pilot-round-completion"
    >
      <View
        style={[
          styles.receipt,
          compact ? styles.receiptCompact : null,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
      >
        <View style={styles.identityRow}>
          <Text style={[styles.eyebrow, { color: palette.accent }]}>
            CET4 受控试点
          </Text>
          <Text style={[styles.count, { color: palette.textMuted }]}>
            已确认 {completedCount} 张
          </Text>
        </View>
        <Text style={[styles.title, { color: palette.text }]}>
          第 {roundNumber} 轮已经收好
        </Text>
        <Text style={[styles.summary, { color: palette.textMuted }]}>
          服务端已确认本轮 5 张卡。下一张会在你明确继续后再读取。
        </Text>

        <View
          style={[
            styles.address,
            {
              backgroundColor: palette.panelStrong,
              borderColor: palette.border,
            },
          ]}
          testID="controlled-pilot-round-space-address"
        >
          <Text style={[styles.addressLabel, { color: palette.textMuted }]}>
            这轮卡片已回到 Space
          </Text>
          <Text
            numberOfLines={2}
            style={[styles.addressValue, { color: palette.text }]}
          >
            {spaceAddress}
          </Text>
        </View>

        {error ? (
          <Text
            style={[styles.error, { color: palette.danger }]}
            testID="controlled-pilot-round-error"
          >
            {error}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onReview}
            style={[styles.secondary, { borderColor: palette.border }]}
            testID="controlled-pilot-round-review"
          >
            <Text style={[styles.secondaryText, { color: palette.text }]}>
              回看待复习内容
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenSpace}
            style={[styles.secondary, { borderColor: palette.border }]}
            testID="controlled-pilot-round-space"
          >
            <Text style={[styles.secondaryText, { color: palette.text }]}>
              查看所在 Space
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: pending, disabled: pending }}
            disabled={pending}
            onPress={onContinue}
            style={[
              styles.primary,
              {
                backgroundColor: palette.primaryActionSurface ?? palette.accent,
              },
              pending ? styles.pending : null,
            ]}
            testID="controlled-pilot-round-continue"
          >
            <Text
              style={[
                styles.primaryText,
                { color: palette.primaryActionText ?? palette.panel },
              ]}
            >
              {pending ? '正在确认' : '继续下一轮'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function ControlledPilotReviewSurface({
  card,
  currentIndex,
  onBack,
  onNext,
  palette,
  totalCount,
}: {
  card: LearningCard;
  currentIndex: number;
  onBack: () => void;
  onNext: () => void;
  palette: LearningSurfacePalette;
  totalCount: number;
}) {
  const isLast = currentIndex + 1 >= totalCount;
  return (
    <View style={styles.screen} testID="controlled-pilot-round-review-surface">
      <View
        style={[
          styles.receipt,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}
      >
        <View style={styles.identityRow}>
          <Text style={[styles.eyebrow, { color: palette.accent }]}>
            待复习内容
          </Text>
          <Text style={[styles.count, { color: palette.textMuted }]}>
            {currentIndex + 1}/{totalCount}
          </Text>
        </View>
        <Text style={[styles.reviewPrompt, { color: palette.text }]}>
          {card.front.prompt}
        </Text>
        <View
          style={[
            styles.address,
            {
              backgroundColor: palette.panelStrong,
              borderColor: palette.border,
            },
          ]}
        >
          <Text style={[styles.addressLabel, { color: palette.textMuted }]}>
            {card.analysis.title}
          </Text>
          <Text style={[styles.reviewBody, { color: palette.text }]}>
            {card.analysis.summary}
          </Text>
          <Text style={[styles.reviewTip, { color: palette.accent }]}>
            {card.analysis.exam_tip}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={isLast ? onBack : onNext}
          style={[
            styles.primary,
            { backgroundColor: palette.primaryActionSurface ?? palette.accent },
          ]}
          testID="controlled-pilot-round-review-next"
        >
          <Text
            style={[
              styles.primaryText,
              { color: palette.primaryActionText ?? palette.panel },
            ]}
          >
            {isLast ? '返回本轮完成页' : '看下一张'}
          </Text>
        </Pressable>
        {!isLast ? (
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={[styles.secondary, { borderColor: palette.border }]}
            testID="controlled-pilot-round-review-back"
          >
            <Text style={[styles.secondaryText, { color: palette.text }]}>
              返回本轮完成页
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  screenCompact: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  receipt: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 16,
    padding: 24,
  },
  receiptCompact: {
    borderRadius: 22,
    gap: 11,
    padding: 17,
  },
  identityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  count: {
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  summary: {
    fontSize: 15,
    lineHeight: 23,
  },
  address: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  addressValue: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  error: {
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    gap: 10,
  },
  secondary: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '800',
  },
  primary: {
    alignItems: 'center',
    borderRadius: 16,
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '900',
  },
  pending: {
    opacity: 0.65,
  },
  reviewPrompt: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 29,
  },
  reviewBody: {
    fontSize: 15,
    lineHeight: 23,
  },
  reviewTip: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
});
