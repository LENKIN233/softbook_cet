import React from 'react';
import type { DimensionValue } from 'react-native';
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { LearningAudioPlayer } from '../audio/LearningAudioPlayer';
import {
  resolveCardAudioDownload,
  type VerifiedContentManifest,
} from '../audio/contentManifestRepository';

import {
  INTERACTION_LABELS,
  LearningCard,
  LearningCardResult,
  LearningCardState,
} from './model';
import { canSubmitLearningCard, summarizeLearningResults } from './session';
import {
  SELF_ASSESS_COLORS,
  hexToRgba,
  resolveLibraryTone,
} from '../visual/tokens';
import {
  formatLearningSessionDisplayLabel,
  formatSpaceDisplayName,
} from '../space/spaceMetadataDisplay';

export type LearningSurfacePalette = {
  background: string;
  panel: string;
  panelStrong: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentStrong: string;
  primaryActionMuted?: string;
  primaryActionSurface?: string;
  primaryActionText?: string;
  tabIdle: string;
  success: string;
  warning: string;
  danger: string;
};

type LearningSurfaceProps = {
  advanceState?: LearningAdvanceState;
  audioAttemptId: string | null;
  palette: LearningSurfacePalette;
  contentManifest?: VerifiedContentManifest | null;
  sessionCards: LearningCard[];
  sessionLabel: string;
  phase: 'learning' | 'review';
  currentCard: LearningCard | null;
  currentCardState: LearningCardState | null;
  currentIndex: number;
  currentResult: LearningCardResult | null;
  completedResults: LearningCardResult[];
  reviewCandidateCount: number;
  roundCompletion?: {
    completedCount: number;
    reviewCardCount: number;
    spaceCard: LearningCard;
  } | null;
  roundContinueError?: string | null;
  roundContinuePending?: boolean;
  onTogglePeek: () => void;
  onToggleFavorite: () => void;
  onToggleHint: () => void;
  onFlip: () => void;
  onSetFlipConfidence: (value: 'confident' | 'review') => void;
  onSelectOption: (optionId: string) => void;
  onSetLockSelection: (slotId: string, value: string) => void;
  onToggleEliminationItem: (itemId: string) => void;
  onSelectSwipeState: (stateId: string) => void;
  onSubmitCurrentCard: () => void;
  onOpenResultDetail?: () => void;
  onAdvanceCard: () => void;
  onRestartDeck: () => void;
  onContinueRound?: () => void;
  onStartReview?: () => void;
};

export type LearningAdvanceState = {
  busy: boolean;
  detail: string | null;
  needsRetry: boolean;
};

const DEFAULT_LEARNING_ADVANCE_STATE: LearningAdvanceState = {
  busy: false,
  detail: null,
  needsRetry: false,
};

function formatLearningActionCue(
  card: LearningCard,
  currentResult: LearningCardResult | null,
) {
  if (currentResult) {
    return '这张已经完成，可以继续下一张。';
  }

  if (card.interaction_id === 'flip') {
    return '翻开卡背';
  }

  const fallbackLabel = INTERACTION_LABELS[card.interaction_id];
  switch (card.interaction_id) {
    case 'multiple_choice':
      return '选一个答案';
    case 'lock':
      return '补齐锁位';
    case 'elimination':
      return '点掉干扰项';
    case 'swipe':
      return '选择判断';
    default:
      return fallbackLabel;
  }
}

function formatLearningSubmitDockCopy(
  card: LearningCard,
  cardState: LearningCardState,
) {
  switch (card.interaction_id) {
    case 'multiple_choice': {
      const selectedOption = card.options.find(
        option => option.id === cardState.selectedOptionId,
      );

      return selectedOption
        ? {
            title: `${selectedOption.label} 已选`,
            detail: '确认后看解析',
          }
        : {
            title: '先选答案',
            detail: '选定后再提交',
          };
    }
    case 'lock': {
      const unlockedCount = card.lock_slots.filter(
        (slot, index) =>
          cardState.lockSelections[slot.id] ===
          card.answer_key.lock_pattern[index],
      ).length;
      const totalCount = card.lock_slots.length;
      const hasWrongSelection = card.lock_slots.some(
        (slot, index) =>
          cardState.lockSelections[slot.id] !== null &&
          cardState.lockSelections[slot.id] !==
            card.answer_key.lock_pattern[index],
      );

      return unlockedCount === totalCount
        ? {
            title: '全部开锁',
            detail: '确认后看解析',
          }
        : {
            title: `${unlockedCount}/${totalCount} 已开`,
            detail: hasWrongSelection ? '当前锁位需要重试' : '按顺序完成锁位',
          };
    }
    case 'elimination': {
      const eliminatedCount = cardState.eliminatedItemIds.length;

      return eliminatedCount > 0
        ? {
            title: `已排除 ${eliminatedCount}`,
            detail: '确认后看解析',
          }
        : {
            title: '先排除干扰项',
            detail: '至少点掉一项',
          };
    }
    case 'swipe': {
      const selectedState = card.swipe_states.find(
        state => state.id === cardState.swipeSelection,
      );

      return selectedState
        ? {
            title: `${selectedState.label} 已选`,
            detail: '确认后看解析',
          }
        : {
            title: '先做判断',
            detail: '选定后再提交',
          };
    }
    case 'flip':
    default:
      return {
        title: '先翻面看答案',
        detail: '看完解析后自评',
      };
  }
}

function getPrimaryActionColors(palette: LearningSurfacePalette) {
  return {
    surface: palette.primaryActionSurface ?? palette.text,
    text: palette.primaryActionText ?? palette.panelStrong,
    muted: palette.primaryActionMuted ?? palette.textMuted,
  };
}

function getNeutralActionSurface(palette: LearningSurfacePalette) {
  return {
    border: hexToRgba(palette.text, 0.12),
    surface: hexToRgba(palette.text, 0.035),
  };
}

export function isCompactLearningViewport(width: number, height: number) {
  const shortEdge = Math.min(width, height);

  return shortEdge < 600 && (width <= 430 || height <= 880);
}

export function LearningSurface({
  advanceState = DEFAULT_LEARNING_ADVANCE_STATE,
  audioAttemptId,
  palette,
  contentManifest = null,
  sessionCards,
  phase,
  currentCard,
  currentCardState,
  currentIndex,
  currentResult,
  completedResults,
  reviewCandidateCount,
  roundCompletion = null,
  roundContinueError = null,
  roundContinuePending = false,
  onTogglePeek,
  onToggleFavorite,
  onToggleHint,
  onFlip,
  onSetFlipConfidence,
  onSelectOption,
  onSetLockSelection,
  onToggleEliminationItem,
  onSelectSwipeState,
  onSubmitCurrentCard,
  onOpenResultDetail,
  onAdvanceCard,
  onRestartDeck,
  onContinueRound,
  onStartReview,
}: LearningSurfaceProps) {
  const {
    fontScale,
    height: viewportHeight,
    width: viewportWidth,
  } = useWindowDimensions();
  const isAccessibilityText = fontScale >= 1.3;
  const isCompactPhone = isCompactLearningViewport(
    viewportWidth,
    viewportHeight,
  );
  const isReviewPhase = phase === 'review';
  const displaySessionLabel = formatLearningSessionDisplayLabel(phase);
  const visibleShelfName = formatSpaceDisplayName(
    currentCard?.space_metadata.library ?? '',
    '当前书架',
  );
  const visibleSectionName = formatSpaceDisplayName(
    currentCard?.space_metadata.group ?? '',
    '当前分区',
  );
  const visibleContainerName = formatSpaceDisplayName(
    currentCard?.space_metadata.box ?? '',
    '当前卡盒',
  );
  if (currentCard === null || currentCardState === null) {
    const summary = summarizeLearningResults(
      completedResults,
      sessionCards.length,
    );
    const primaryAction = getPrimaryActionColors(palette);
    const roundShelf = roundCompletion
      ? formatSpaceDisplayName(
          roundCompletion.spaceCard.space_metadata.library,
          '当前书架',
        )
      : null;
    const roundSection = roundCompletion
      ? formatSpaceDisplayName(
          roundCompletion.spaceCard.space_metadata.group,
          '当前分区',
        )
      : null;
    const roundContainer = roundCompletion
      ? formatSpaceDisplayName(
          roundCompletion.spaceCard.space_metadata.box,
          '当前卡盒',
        )
      : null;

    return (
      <View style={[styles.oneScreenPage, styles.completeScreen]}>
        <View
          style={[
            styles.heroCard,
            styles.completeHeroCard,
            styles.glassCard,
            {
              backgroundColor: palette.panel,
              borderColor: palette.border,
              shadowColor: palette.accent,
            },
          ]}
          testID="learning-complete-summary"
        >
          <Text style={[styles.heroEyebrow, { color: palette.accent }]}>
            {roundCompletion
              ? '五卡一回合'
              : isReviewPhase
              ? '回看练习'
              : '单卡学习'}
          </Text>
          <Text style={[styles.heroTitle, { color: palette.text }]}>
            {roundCompletion
              ? '这一回合已收好'
              : isReviewPhase
              ? '本轮回看已走完'
              : '本轮学习已走完'}
          </Text>
          <Text style={[styles.heroSummary, { color: palette.textMuted }]}>
            {roundCompletion
              ? '五张卡已经完成，学习位置和需要再看的卡都已由系统收好。'
              : isReviewPhase
              ? `这轮从${displaySessionLabel}里回看了 ${sessionCards.length} 张卡，把“需要回看”的部分集中处理了一遍。`
              : `这轮从${displaySessionLabel}里完成了 ${sessionCards.length} 张卡，下一次会继续从需要再看的地方开始。`}
          </Text>
          <View style={styles.metricWrap}>
            <MetricPill
              label="完成"
              value={
                roundCompletion
                  ? '5/5'
                  : `${summary.completed}/${summary.total}`
              }
              palette={palette}
            />
            <MetricPill
              label="下一步"
              value={
                roundCompletion
                  ? roundCompletion.reviewCardCount > 0
                    ? `回看 ${roundCompletion.reviewCardCount}`
                    : '已收好'
                  : !isReviewPhase && reviewCandidateCount > 0
                  ? `回看 ${reviewCandidateCount}`
                  : '已收好'
              }
              palette={palette}
              tone="success"
            />
          </View>
        </View>

        <View
          style={[
            styles.resultCard,
            styles.completeActionCard,
            {
              backgroundColor: palette.panel,
              borderColor: palette.border,
            },
          ]}
          testID="learning-complete-details"
        >
          <Text
            style={[styles.resultExplanationTitle, { color: palette.text }]}
          >
            {roundCompletion
              ? '空间位置已收好'
              : isReviewPhase
              ? '回看已经收好'
              : '这一轮已经收好'}
          </Text>
          <Text
            style={[styles.resultExplanationBody, { color: palette.textMuted }]}
          >
            {roundCompletion
              ? `${roundShelf} · ${roundSection} · ${roundContainer}`
              : isReviewPhase
              ? '仍不稳的点会留在后续学习里自然出现。'
              : '需要再看的卡已经收进回看，不要求你管理列表。'}
          </Text>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            下一步
          </Text>
          <Text
            style={[styles.resultExplanationBody, { color: palette.textMuted }]}
          >
            {roundCompletion
              ? roundCompletion.reviewCardCount > 0
                ? `系统已留下 ${roundCompletion.reviewCardCount} 张需要再看的卡。确认后继续下一轮。`
                : '这一回合没有需要再看的卡，确认后继续下一轮。'
              : isReviewPhase
              ? '回看已经结束。可以回到首轮重新开始，也可以稍后按学习节奏继续。'
              : reviewCandidateCount > 0
              ? `先回看这 ${reviewCandidateCount} 张卡，再继续新一轮学习。`
              : '这一轮已经完成，可以重新练这轮卡。'}
          </Text>
          {!roundCompletion &&
          !isReviewPhase &&
          reviewCandidateCount > 0 &&
          onStartReview ? (
            <Pressable
              onPress={onStartReview}
              style={[
                styles.primaryButton,
                { backgroundColor: palette.warning },
              ]}
              testID="learning-start-review-button"
            >
              <Text
                style={[
                  styles.primaryButtonLabel,
                  { color: primaryAction.text },
                ]}
              >
                开始回看这 {reviewCandidateCount} 张卡
              </Text>
            </Pressable>
          ) : null}
          {roundContinueError ? (
            <Text
              style={[styles.resultExplanationBody, { color: palette.danger }]}
              testID="learning-round-continue-error"
            >
              {roundContinueError}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              busy: roundCompletion ? roundContinuePending : false,
              disabled: roundCompletion ? roundContinuePending : false,
            }}
            disabled={roundCompletion ? roundContinuePending : false}
            onPress={
              roundCompletion && onContinueRound
                ? onContinueRound
                : onRestartDeck
            }
            style={[
              styles.primaryButton,
              { backgroundColor: primaryAction.surface },
            ]}
            testID={
              roundCompletion
                ? 'learning-continue-round-button'
                : 'learning-restart-button'
            }
          >
            <Text
              style={[styles.primaryButtonLabel, { color: primaryAction.text }]}
            >
              {roundCompletion
                ? roundContinuePending
                  ? '正在继续…'
                  : '继续下一轮'
                : isReviewPhase
                ? '回到首轮重新开始'
                : '重新练这轮卡'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const libraryTone = resolveLibraryTone(currentCard.space_metadata.library);
  const tone = {
    accent: libraryTone.accent,
    accentSoft: libraryTone.accentSoft,
  };
  const progressPercent = `${Math.max(
    Math.round(((currentIndex + 1) / Math.max(sessionCards.length, 1)) * 100),
    10,
  )}%` as DimensionValue;
  const progressCount = `${Math.min(
    currentIndex + 1,
    sessionCards.length,
  )}/${Math.max(sessionCards.length, 1)}`;
  const actionCue = formatLearningActionCue(currentCard, currentResult);
  const isLockInteraction = currentCard.interaction_id === 'lock';
  const isDenseInteraction =
    isLockInteraction ||
    currentCard.interaction_id === 'elimination' ||
    currentCard.interaction_id === 'swipe';
  const supportLayer = (() => {
    const peekBody = '先把题干里的信号抓出来，再回到选项或解析确认。';

    if (
      currentCardState.isPeeked &&
      currentCard.hint_layer?.content &&
      currentCardState.isHintVisible
    ) {
      return {
        title: '先看这张卡的关键点',
        body: `${peekBody} ${currentCard.hint_layer.content}`,
        tone: palette.text,
      };
    }

    if (currentCard.hint_layer && currentCardState.isHintVisible) {
      return {
        title: '提示',
        body: currentCard.hint_layer.content,
        tone: tone.accent,
      };
    }

    if (currentCardState.isPeeked) {
      return {
        title: '先看这张卡的关键点',
        body: peekBody,
        tone: palette.text,
      };
    }

    return null;
  })();
  const canSubmitCurrentCard = canSubmitLearningCard(
    currentCard,
    currentCardState,
  );
  const submitDockCopy = formatLearningSubmitDockCopy(
    currentCard,
    currentCardState,
  );
  const primaryAction = getPrimaryActionColors(palette);
  const neutralAction = getNeutralActionSurface(palette);
  const audioSelection = (() => {
    if (!currentCard.audio || !contentManifest || audioAttemptId === null) {
      return null;
    }

    try {
      const resolved = resolveCardAudioDownload(contentManifest, currentCard);
      return resolved
        ? {
            ...resolved,
            authorityToken: audioAttemptId,
            cardToken: `${currentCard.card_id}:${currentCard.audio.sha256}`,
          }
        : null;
    } catch {
      return null;
    }
  })();
  const hasCommittedChoiceSelection =
    currentCard.interaction_id === 'multiple_choice' &&
    currentCardState.selectedOptionId !== null;
  const shouldShowContextCard =
    currentResult === null && !isDenseInteraction && supportLayer !== null;
  const shouldShowUtilityDock =
    currentResult === null && !hasCommittedChoiceSelection;

  return (
    <View
      style={[
        styles.oneScreenPage,
        isCompactPhone ? styles.oneScreenPageCompact : null,
      ]}
      testID="learning-one-screen-flow"
    >
      <View
        style={[
          styles.studyCard,
          styles.studyCardOneScreen,
          isCompactPhone ? styles.studyCardOneScreenCompact : null,
          currentResult === null && currentCard.interaction_id !== 'flip'
            ? styles.studyCardWorkArea
            : null,
          styles.glassCard,
          {
            backgroundColor: palette.panel,
            borderColor: palette.border,
            borderTopColor: tone.accent,
            shadowColor: '#46309F',
          },
        ]}
        testID="learning-current-card"
      >
        <View
          style={[
            styles.cardAddressShelf,
            isCompactPhone ? styles.cardAddressShelfCompact : null,
          ]}
          testID="learning-card-address-shelf"
        >
          <View style={styles.heroChipRow}>
            <View
              pointerEvents="none"
              style={[
                styles.cardObjectAccent,
                isCompactPhone ? styles.cardObjectAccentCompact : null,
                { backgroundColor: hexToRgba(tone.accent, 0.92) },
              ]}
            />
            <View
              style={[
                styles.cardObjectHeaderText,
                isCompactPhone ? styles.cardObjectHeaderTextCompact : null,
              ]}
            >
              <Text
                style={[styles.learningFrameMeta, { color: palette.textMuted }]}
                testID="learning-progress-label"
              >
                {isCompactPhone
                  ? `${
                      isReviewPhase ? '本轮回看' : displaySessionLabel
                    } · ${visibleContainerName}`
                  : isReviewPhase
                  ? '本轮回看'
                  : displaySessionLabel}
              </Text>
              <Text
                style={[
                  styles.cardObjectLead,
                  isCompactPhone ? styles.cardObjectLeadCompact : null,
                  { color: palette.text },
                ]}
              >
                当前卡 · {INTERACTION_LABELS[currentCard.interaction_id]}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.cardProgressCluster,
              isCompactPhone ? styles.cardProgressClusterCompact : null,
              {
                backgroundColor: palette.panelStrong,
                borderColor: hexToRgba(tone.accent, 0.14),
              },
            ]}
          >
            <Text
              style={[styles.cardProgressCount, { color: palette.text }]}
              testID="learning-progress-count"
            >
              {progressCount}
            </Text>
            <View
              style={[
                styles.cardProgressTrack,
                { backgroundColor: palette.panel, borderColor: palette.border },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: tone.accent, width: progressPercent },
                ]}
              />
            </View>
          </View>
        </View>
        {!isCompactPhone ? (
          <View
            style={[
              styles.cardLocationStrip,
              styles.learningCardLocationHint,
              {
                backgroundColor: 'transparent',
                borderColor: 'transparent',
              },
            ]}
            testID="learning-card-location-strip"
          >
            <View
              pointerEvents="none"
              style={[
                styles.cardLocationDot,
                { backgroundColor: hexToRgba(tone.accent, 0.62) },
              ]}
            />
            <View style={styles.cardLocationTextWrap}>
              <Text
                numberOfLines={isAccessibilityText ? undefined : 1}
                style={[styles.cardLocationTitle, { color: palette.textMuted }]}
              >
                {visibleContainerName}
              </Text>
              <Text
                numberOfLines={isAccessibilityText ? undefined : 1}
                style={[styles.cardLocationMeta, { color: palette.textMuted }]}
              >
                {`${visibleShelfName} / ${visibleSectionName}`}
              </Text>
            </View>
          </View>
        ) : null}
        <View
          style={[
            styles.studyCardTop,
            isCompactPhone ? styles.studyCardTopCompact : null,
            {
              backgroundColor: 'transparent',
              borderColor: 'transparent',
            },
          ]}
        >
          <View style={styles.studyTitleWrap}>
            {!isCompactPhone ? (
              <Text style={[styles.cardEyebrow, { color: palette.textMuted }]}>
                先读题干
              </Text>
            ) : null}
            <Text
              numberOfLines={
                isAccessibilityText ? undefined : isDenseInteraction ? 2 : 4
              }
              style={[
                styles.cardPrompt,
                styles.cardPromptOneScreen,
                isCompactPhone ? styles.cardPromptOneScreenCompact : null,
                { color: palette.text },
              ]}
            >
              {currentCard.front.prompt}
            </Text>
          </View>
        </View>

        {audioSelection ? (
          <View style={styles.audioResourceSlot} testID="learning-audio-slot">
            <LearningAudioPlayer palette={palette} selection={audioSelection} />
          </View>
        ) : null}

        {shouldShowContextCard ? (
          <View
            style={[
              styles.contextCard,
              supportLayer ? styles.contextCardSupportActive : null,
              {
                backgroundColor: palette.panelStrong,
                borderColor: palette.border,
              },
            ]}
            testID={
              supportLayer
                ? 'learning-support-layer'
                : 'learning-current-card-context'
            }
          >
            <Text
              numberOfLines={
                isAccessibilityText ? undefined : supportLayer ? 1 : 2
              }
              style={[
                styles.cardSupport,
                { color: supportLayer?.tone ?? palette.text },
              ]}
            >
              {supportLayer?.title ?? currentCard.front.support}
            </Text>
            <Text
              numberOfLines={
                isAccessibilityText ? undefined : supportLayer ? 3 : 2
              }
              style={[styles.cardContext, { color: palette.textMuted }]}
            >
              {supportLayer?.body ?? currentCard.front.context}
            </Text>
          </View>
        ) : null}

        {currentResult ? (
          onOpenResultDetail ? (
            <ResultSummaryPanel
              advanceState={advanceState}
              card={currentCard}
              compact={isCompactPhone}
              palette={palette}
              result={currentResult}
              onAdvanceCard={onAdvanceCard}
              onOpenResultDetail={onOpenResultDetail}
              isLastCard={currentIndex === sessionCards.length - 1}
            />
          ) : (
            <ResultPanel
              advanceState={advanceState}
              card={currentCard}
              palette={palette}
              result={currentResult}
              onAdvanceCard={onAdvanceCard}
              isLastCard={currentIndex === sessionCards.length - 1}
            />
          )
        ) : (
          <View
            style={[
              styles.interactionCard,
              styles.interactionCardOneScreen,
              styles.interactionCardEmbedded,
              currentCard.interaction_id === 'flip'
                ? styles.interactionCardNaturalHeight
                : null,
              isCompactPhone ? styles.interactionCardOneScreenCompact : null,
              {
                backgroundColor: 'transparent',
                borderColor: hexToRgba(tone.accent, 0.18),
              },
            ]}
          >
            {isDenseInteraction ? (
              <View style={styles.interactionTitleRow}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>
                  {INTERACTION_LABELS[currentCard.interaction_id]}
                </Text>
                <Text
                  style={[styles.interactionMeta, { color: palette.textMuted }]}
                >
                  现在做
                </Text>
              </View>
            ) : null}
            {!isDenseInteraction ? (
              <Text
                numberOfLines={isAccessibilityText ? undefined : 2}
                style={[styles.actionCue, { color: palette.textMuted }]}
                testID="learning-action-cue"
              >
                {actionCue}
              </Text>
            ) : null}
            <InteractionBody
              card={currentCard}
              cardState={currentCardState}
              currentResult={currentResult}
              palette={palette}
              onFlip={onFlip}
              onSetFlipConfidence={onSetFlipConfidence}
              onSelectOption={onSelectOption}
              onSetLockSelection={onSetLockSelection}
              onToggleEliminationItem={onToggleEliminationItem}
              onSelectSwipeState={onSelectSwipeState}
              compact={isCompactPhone}
            />
            {isDenseInteraction && supportLayer ? (
              <View
                style={[
                  styles.denseSupportLayer,
                  {
                    backgroundColor: palette.panelStrong,
                    borderColor: palette.border,
                  },
                ]}
                testID="learning-support-layer"
              >
                <Text style={[styles.denseSupportTitle, {color: supportLayer.tone}]}>
                  {supportLayer.title}
                </Text>
                <Text style={[styles.denseSupportBody, {color: palette.textMuted}]}>
                  {supportLayer.body}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {!currentResult ? (
          <View
            style={[
              styles.oneScreenDock,
              styles.oneScreenDockAnchored,
              isLockInteraction ? styles.oneScreenDockCompact : null,
              isCompactPhone ? styles.oneScreenDockSmallViewport : null,
              currentCard.interaction_id === 'flip'
                ? styles.oneScreenDockNatural
                : null,
            ]}
            testID="learning-action-dock"
          >
            {shouldShowUtilityDock ? (
              <>
                <View
                  style={[
                    styles.actionRow,
                    isCompactPhone ? styles.actionRowCompact : null,
                  ]}
                >
                  <LightActionButton
                    compact={isCompactPhone}
                    label={currentCardState.isPeeked ? '收起线索' : '查看线索'}
                    onPress={onTogglePeek}
                    palette={palette}
                    testID="learning-peek-button"
                  />
                  {currentCard.hint_layer ? (
                    <LightActionButton
                      compact={isCompactPhone}
                      label={
                        currentCardState.isHintVisible ? '收起提示' : '查看提示'
                      }
                      onPress={onToggleHint}
                      palette={palette}
                      testID="learning-hint-button"
                    />
                  ) : null}
                  <Pressable
                    onPress={onToggleFavorite}
                    style={[
                      styles.favoriteButton,
                      isCompactPhone ? styles.favoriteButtonCompact : null,
                      {
                        backgroundColor: currentCardState.isFavorited
                          ? tone.accentSoft
                          : palette.panelStrong,
                        borderColor: currentCardState.isFavorited
                          ? tone.accent
                          : palette.border,
                      },
                    ]}
                    testID="learning-favorite-button"
                  >
                    <Text
                      style={[
                        styles.favoriteLabel,
                        {
                          color: currentCardState.isFavorited
                            ? tone.accent
                            : palette.textMuted,
                        },
                      ]}
                    >
                      {currentCardState.isFavorited ? '已收藏' : '收藏'}
                    </Text>
                  </Pressable>
                </View>
                {!isCompactPhone ? (
                  <View
                    style={[
                      styles.addressAperture,
                      {
                        backgroundColor: palette.panelStrong,
                        borderColor: palette.border,
                      },
                    ]}
                    testID="learning-address-aperture"
                  >
                    <Text
                      style={[styles.addressText, { color: palette.textMuted }]}
                    >
                      同盒继续
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}
            {currentCard.interaction_id !== 'flip' &&
            currentCard.interaction_id !== 'swipe' ? (
              <View
                style={[
                  styles.submitActionDock,
                  isCompactPhone ? styles.submitActionDockCompact : null,
                  {
                    backgroundColor: canSubmitCurrentCard
                      ? neutralAction.surface
                      : palette.panelStrong,
                    borderColor: canSubmitCurrentCard
                      ? neutralAction.border
                      : palette.border,
                  },
                ]}
                testID="learning-submit-action-dock"
              >
                <View style={styles.submitActionTextStack}>
                  <Text
                    numberOfLines={isAccessibilityText ? undefined : 1}
                    style={[
                      styles.submitActionTitle,
                      {
                        color: canSubmitCurrentCard
                          ? palette.text
                          : palette.textMuted,
                      },
                    ]}
                  >
                    {submitDockCopy.title}
                  </Text>
                  <Text
                    numberOfLines={isAccessibilityText ? undefined : 1}
                    style={[
                      styles.submitActionDetail,
                      { color: palette.textMuted },
                    ]}
                  >
                    {submitDockCopy.detail}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="提交当前答案"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canSubmitCurrentCard }}
                  disabled={!canSubmitCurrentCard}
                  onPress={onSubmitCurrentCard}
                  style={[
                    styles.submitActionButton,
                    {
                      backgroundColor: canSubmitCurrentCard
                        ? primaryAction.surface
                        : palette.tabIdle,
                      opacity: canSubmitCurrentCard ? 1 : 0.68,
                    },
                  ]}
                  testID="learning-submit-button"
                >
                  <Text
                    style={[
                      styles.submitActionButtonLabel,
                      {
                        color: canSubmitCurrentCard
                          ? primaryAction.text
                          : palette.panel,
                      },
                    ]}
                  >
                    确认答案
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function InteractionBody({
  card,
  cardState,
  compact,
  currentResult,
  palette,
  onFlip,
  onSetFlipConfidence,
  onSelectOption,
  onSetLockSelection,
  onToggleEliminationItem,
  onSelectSwipeState,
}: {
  card: LearningCard;
  cardState: LearningCardState;
  compact: boolean;
  currentResult: LearningCardResult | null;
  palette: LearningSurfacePalette;
  onFlip: () => void;
  onSetFlipConfidence: (value: 'confident' | 'review') => void;
  onSelectOption: (optionId: string) => void;
  onSetLockSelection: (slotId: string, value: string) => void;
  onToggleEliminationItem: (itemId: string) => void;
  onSelectSwipeState: (stateId: string) => void;
}) {
  const { fontScale } = useWindowDimensions();
  const isAccessibilityText = fontScale >= 1.3;
  const libraryTone = resolveLibraryTone(card.space_metadata.library);
  const tone = {
    accent: libraryTone.accent,
    accentSoft: libraryTone.accentSoft,
  };
  const primaryAction = getPrimaryActionColors(palette);
  const neutralAction = getNeutralActionSurface(palette);

  switch (card.interaction_id) {
    case 'flip':
      return (
        <View
          style={[
            styles.interactionBody,
            compact ? styles.interactionBodyCompact : null,
          ]}
        >
          {cardState.isFlipped ? (
            <View
              style={[
                styles.revealPanel,
                compact ? styles.revealPanelCompact : null,
                {
                  backgroundColor: tone.accentSoft,
                  borderColor: tone.accent,
                },
              ]}
            >
              <Text style={[styles.revealTitle, { color: tone.accent }]}>
                翻面结果
              </Text>
              <Text
                numberOfLines={
                  isAccessibilityText ? undefined : compact ? 3 : 4
                }
                style={[
                  styles.revealText,
                  compact ? styles.revealTextCompact : null,
                  { color: palette.text },
                ]}
              >
                {card.back_text}
              </Text>
            </View>
          ) : (
            <Pressable
              accessibilityLabel="翻面查看答案"
              accessibilityRole="button"
              accessibilityState={{ disabled: false }}
              onPress={onFlip}
              style={[
                styles.primaryButton,
                { backgroundColor: primaryAction.surface },
              ]}
              testID="learning-flip-button"
            >
              <Text
                style={[
                  styles.primaryButtonLabel,
                  { color: primaryAction.text },
                ]}
              >
                先翻面看答案
              </Text>
            </Pressable>
          )}

          {cardState.isFlipped && currentResult === null ? (
            <View
              style={[
                styles.confidenceRow,
                compact ? styles.confidenceRowCompact : null,
              ]}
            >
              <Pressable
                accessibilityLabel="自评有把握"
                accessibilityRole="radio"
                accessibilityState={{
                  checked: cardState.flipConfidence === 'confident',
                }}
                onPress={() => onSetFlipConfidence('confident')}
                style={[
                  styles.choicePill,
                  styles.choicePillWide,
                  compact ? styles.choicePillCompact : null,
                  {
                    backgroundColor: hexToRgba(
                      SELF_ASSESS_COLORS.confident,
                      0.12,
                    ),
                    borderColor: SELF_ASSESS_COLORS.confident,
                  },
                ]}
                testID="learning-flip-confident-button"
              >
                <Text
                  style={[
                    styles.choiceLabel,
                    { color: SELF_ASSESS_COLORS.confident },
                  ]}
                >
                  有把握
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="自评再回看"
                accessibilityRole="radio"
                accessibilityState={{
                  checked: cardState.flipConfidence === 'review',
                }}
                onPress={() => onSetFlipConfidence('review')}
                style={[
                  styles.choicePill,
                  styles.choicePillWide,
                  compact ? styles.choicePillCompact : null,
                  {
                    backgroundColor: hexToRgba(SELF_ASSESS_COLORS.review, 0.12),
                    borderColor: SELF_ASSESS_COLORS.review,
                  },
                ]}
                testID="learning-flip-review-button"
              >
                <Text
                  style={[
                    styles.choiceLabel,
                    { color: SELF_ASSESS_COLORS.review },
                  ]}
                >
                  再回看
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      );
    case 'multiple_choice':
      return (
        <View
          style={[
            styles.interactionBody,
            styles.choiceInteractionBody,
            compact ? styles.interactionBodyCompact : null,
          ]}
        >
          <View
            style={[styles.optionGrid, styles.optionGridWorkArea]}
            testID="learning-option-grid"
          >
            {card.options.map((option, optionIndex) => {
              const isSelected = cardState.selectedOptionId === option.id;
              const isCorrect =
                currentResult !== null &&
                option.id === card.answer_key.correct_option;
              const isIncorrectSelection =
                currentResult?.outcome === 'incorrect' && isSelected;
              const isResolved = currentResult !== null;
              const optionStateTint = isCorrect
                ? hexToRgba(palette.success, 0.08)
                : isIncorrectSelection
                ? hexToRgba(palette.danger, 0.075)
                : isSelected
                ? neutralAction.surface
                : palette.panel;
              const optionStateBorder = isCorrect
                ? hexToRgba(palette.success, 0.42)
                : isIncorrectSelection
                ? hexToRgba(palette.danger, 0.38)
                : isSelected
                ? neutralAction.border
                : palette.border;
              const optionStateColor = isCorrect
                ? palette.success
                : isIncorrectSelection
                ? palette.danger
                : primaryAction.surface;

              return (
                <Pressable
                  accessibilityLabel={`选项 ${option.label}，${option.text}`}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: isSelected,
                    disabled: isResolved,
                  }}
                  disabled={isResolved}
                  key={option.id}
                  onPress={() => onSelectOption(option.id)}
                  style={[
                    styles.optionCard,
                    compact ? styles.optionCardCompact : null,
                    isSelected ? styles.optionCardSelected : null,
                    {
                      backgroundColor: optionStateTint,
                      borderColor: optionStateBorder,
                    },
                  ]}
                  testID={`learning-option-${optionIndex + 1}`}
                >
                  <View style={styles.optionHeaderRow}>
                    <View
                      style={[
                        styles.optionLetterBadge,
                        {
                          backgroundColor:
                            isSelected || isResolved
                              ? optionStateColor
                              : neutralAction.surface,
                          borderColor:
                            isSelected || isResolved
                              ? optionStateColor
                              : palette.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionLabel,
                          {
                            color:
                              isSelected || isResolved
                                ? primaryAction.text
                                : palette.textMuted,
                          },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </View>
                    {isSelected && !isResolved ? (
                      <Text
                        style={[
                          styles.optionStateLabel,
                          { color: palette.textMuted },
                        ]}
                      >
                        已选
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    numberOfLines={isAccessibilityText ? undefined : 2}
                    style={[styles.optionText, { color: palette.text }]}
                  >
                    {option.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    case 'lock':
      return (
        <View
          style={[
            styles.interactionBody,
            compact ? styles.interactionBodyCompact : null,
          ]}
        >
          <View
            style={[styles.lockList, compact ? styles.lockListCompact : null]}
          >
            {card.lock_slots.map((slot, index) => {
              const selectedValue = cardState.lockSelections[slot.id];
              const expectedValue = card.answer_key.lock_pattern[index];
              const isUnlocked = selectedValue === expectedValue;
              const hasWrongSelection =
                selectedValue !== null && !isUnlocked;
              const firstLockedIndex = card.lock_slots.findIndex(
                (candidateSlot, candidateIndex) =>
                  cardState.lockSelections[candidateSlot.id] !==
                  card.answer_key.lock_pattern[candidateIndex],
              );
              const isCurrentRow = firstLockedIndex === index;
              const canChoose = currentResult === null && isCurrentRow;
              const isWaitingForPrevious =
                firstLockedIndex >= 0 && index > firstLockedIndex;

              return (
                <View
                  key={slot.id}
                  style={[
                    styles.lockRow,
                    compact ? styles.lockRowCompact : null,
                    {
                      backgroundColor: isUnlocked
                        ? neutralAction.surface
                        : palette.panel,
                      borderColor: isUnlocked
                        ? neutralAction.border
                        : palette.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.lockGlyph,
                      compact ? styles.lockGlyphCompact : null,
                      {
                        backgroundColor: isUnlocked
                          ? primaryAction.surface
                          : palette.panelStrong,
                        borderColor: isUnlocked
                          ? primaryAction.surface
                          : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.lockGlyphLabel,
                        {
                          color: isUnlocked
                            ? primaryAction.text
                            : palette.textMuted,
                        },
                      ]}
                    >
                      {isUnlocked ? '开' : '锁'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.lockBody,
                      compact ? styles.lockBodyCompact : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.lockLabelRow,
                        compact ? styles.lockLabelRowCompact : null,
                      ]}
                    >
                      <Text style={[styles.lockLabel, { color: palette.text }]}>
                        {slot.label}
                      </Text>
                      {!compact ? (
                        <Text
                          style={[
                            styles.lockStatus,
                            {
                              color: isUnlocked
                                ? palette.text
                                : palette.textMuted,
                            },
                          ]}
                        >
                          {isUnlocked
                            ? '已开锁'
                            : hasWrongSelection
                            ? '再试一次'
                            : isWaitingForPrevious
                            ? '按顺序解锁'
                            : '待选择'}
                        </Text>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.inlineWrap,
                        styles.lockChoiceWrap,
                        compact ? styles.lockChoiceWrapCompact : null,
                      ]}
                    >
                      {slot.options.map((option, optionIndex) => {
                        const isSelected = selectedValue === option;

                        return (
                          <Pressable
                            accessibilityLabel={`${slot.label}，${option}`}
                            accessibilityRole="radio"
                            accessibilityState={{
                              checked: isSelected,
                              disabled: !canChoose,
                            }}
                            disabled={!canChoose}
                            key={option}
                            onPress={() =>
                              canChoose
                                ? onSetLockSelection(slot.id, option)
                                : undefined
                            }
                            style={[
                              styles.choicePill,
                              styles.lockChoicePill,
                              compact ? styles.lockChoicePillCompact : null,
                              canChoose || isSelected
                                ? null
                                : styles.lockChoicePillDisabled,
                              {
                                backgroundColor: isSelected
                                  ? hasWrongSelection
                                    ? hexToRgba(palette.danger, 0.08)
                                    : palette.panel
                                  : palette.panelStrong,
                                borderColor: isSelected
                                  ? hasWrongSelection
                                    ? hexToRgba(palette.danger, 0.42)
                                    : neutralAction.border
                                  : palette.border,
                              },
                            ]}
                            testID={`learning-lock-${index + 1}-${
                              optionIndex + 1
                            }`}
                          >
                            <Text
                              numberOfLines={
                                isAccessibilityText ? undefined : 1
                              }
                              style={[
                                styles.choiceLabel,
                                styles.lockChoiceLabel,
                                {
                                  color: isSelected
                                    ? palette.text
                                    : palette.text,
                                },
                              ]}
                            >
                              {option}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      );
    case 'elimination':
      return (
        <View
          style={[
            styles.interactionBody,
            compact ? styles.interactionBodyCompact : null,
          ]}
        >
          <View
            style={[
              styles.eliminationGrid,
              compact ? styles.eliminationGridCompact : null,
            ]}
          >
            {card.elimination_items.map((item, itemIndex) => {
              const isSelected = cardState.eliminatedItemIds.includes(item.id);
              const isCorrect =
                currentResult !== null &&
                card.answer_key.correct_items.includes(item.id);

              return (
                <Pressable
                  accessibilityLabel={`排除候选项，${item.text}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{
                    checked: isSelected,
                    disabled: currentResult !== null,
                  }}
                  disabled={currentResult !== null}
                  key={item.id}
                  onPress={() => onToggleEliminationItem(item.id)}
                  style={[
                    styles.eliminationCard,
                    compact ? styles.eliminationCardCompact : null,
                    {
                      backgroundColor: isSelected
                        ? neutralAction.surface
                        : palette.panel,
                      borderColor: currentResult
                        ? isCorrect
                          ? palette.success
                          : isSelected
                          ? palette.danger
                          : palette.border
                        : isSelected
                        ? neutralAction.border
                        : palette.border,
                    },
                  ]}
                  testID={`learning-elimination-${itemIndex + 1}`}
                >
                  {isSelected ? (
                    <View
                      style={[
                        styles.eliminationStrikeRail,
                        { backgroundColor: primaryAction.surface },
                      ]}
                    />
                  ) : null}
                  <Text
                    style={[
                      styles.eliminationText,
                      isSelected ? styles.eliminationTextStruck : null,
                      {
                        color: palette.text,
                      },
                    ]}
                  >
                    {item.text}
                  </Text>
                  {isSelected ? (
                    <Text
                      style={[
                        styles.eliminationStateLabel,
                        { color: palette.text },
                      ]}
                    >
                      已剥离
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    case 'swipe':
      return (
        <SwipeInteraction
          card={card}
          cardState={cardState}
          compact={compact}
          onCommit={onSelectSwipeState}
          palette={palette}
        />
      );
    default:
      return null;
  }
}

export const SWIPE_DISTANCE_THRESHOLD_RATIO = 0.25;
export const SWIPE_VELOCITY_THRESHOLD = 0.65;

export type SwipeGestureDirection = 'left' | 'right' | null;

export function resolveSwipeGestureDirection(input: {
  cardWidth: number;
  dx: number;
  vx: number;
}): SwipeGestureDirection {
  const distanceThreshold =
    Math.max(input.cardWidth, 1) * SWIPE_DISTANCE_THRESHOLD_RATIO;

  if (Math.abs(input.dx) >= distanceThreshold) {
    return input.dx < 0 ? 'left' : 'right';
  }

  if (Math.abs(input.vx) >= SWIPE_VELOCITY_THRESHOLD) {
    return input.vx < 0 ? 'left' : 'right';
  }

  return null;
}

function SwipeInteraction({
  card,
  cardState,
  compact,
  onCommit,
  palette,
}: {
  card: Extract<LearningCard, { interaction_id: 'swipe' }>;
  cardState: LearningCardState;
  compact: boolean;
  onCommit: (stateId: string) => void;
  palette: LearningSurfacePalette;
}) {
  const { fontScale } = useWindowDimensions();
  const isAccessibilityText = fontScale >= 1.3;
  const libraryTone = resolveLibraryTone(card.space_metadata.library);
  const tone = { accent: libraryTone.accent };
  const dragX = React.useRef(new Animated.Value(0)).current;
  const cardWidthRef = React.useRef(280);
  const settlingRef = React.useRef(false);
  const [reduceMotionEnabled, setReduceMotionEnabled] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (mounted) {
          setReduceMotionEnabled(enabled);
        }
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const settleToCenter = React.useCallback(() => {
    settlingRef.current = true;
    if (reduceMotionEnabled) {
      dragX.setValue(0);
      settlingRef.current = false;
      return;
    }

    Animated.spring(dragX, {
      damping: 18,
      mass: 0.72,
      stiffness: 210,
      toValue: 0,
      useNativeDriver: true,
    }).start(() => {
      settlingRef.current = false;
    });
  }, [dragX, reduceMotionEnabled]);

  const commitStateAtIndex = React.useCallback(
    (index: number) => {
      const state = card.swipe_states[index];
      if (state) {
        onCommit(state.id);
      }
    },
    [card.swipe_states, onCommit],
  );

  const commitDirection = React.useCallback(
    (direction: Exclude<SwipeGestureDirection, null>) => {
      if (settlingRef.current) {
        return;
      }

      const state = card.swipe_states[direction === 'left' ? 0 : 1];
      if (!state) {
        settleToCenter();
        return;
      }

      settlingRef.current = true;
      const finish = () => {
        dragX.setValue(0);
        settlingRef.current = false;
        onCommit(state.id);
      };

      if (reduceMotionEnabled) {
        finish();
        return;
      }

      Animated.timing(dragX, {
        duration: 220,
        toValue:
          (direction === 'left' ? -1 : 1) *
          Math.max(cardWidthRef.current * 1.15, 320),
        useNativeDriver: true,
      }).start(finish);
    },
    [card.swipe_states, dragX, onCommit, reduceMotionEnabled, settleToCenter],
  );

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          !settlingRef.current &&
          Math.abs(gesture.dx) > 8 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.15,
        onPanResponderGrant: () => {
          dragX.stopAnimation();
        },
        onPanResponderMove: Animated.event([null, { dx: dragX }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_event, gesture) => {
          const direction = resolveSwipeGestureDirection({
            cardWidth: cardWidthRef.current,
            dx: gesture.dx,
            vx: gesture.vx,
          });
          if (direction) {
            commitDirection(direction);
          } else {
            settleToCenter();
          }
        },
        onPanResponderTerminate: settleToCenter,
        onPanResponderTerminationRequest: () => true,
      }),
    [commitDirection, dragX, settleToCenter],
  );

  const rotate = dragX.interpolate({
    inputRange: [
      -Math.max(cardWidthRef.current, 1),
      0,
      Math.max(cardWidthRef.current, 1),
    ],
    outputRange: ['-5deg', '0deg', '5deg'],
  });
  const selectedState = card.swipe_states.find(
    state => state.id === cardState.swipeSelection,
  );

  return (
    <View
      style={[styles.swipeColumn, compact ? styles.swipeColumnCompact : null]}
    >
      <View
        style={[styles.swipeDeck, compact ? styles.swipeDeckCompact : null]}
      >
        <View
          style={[
            styles.swipeGhostCard,
            compact ? styles.swipeGhostCardCompact : null,
            styles.swipeGhostBack,
            { backgroundColor: palette.panel, borderColor: palette.border },
          ]}
        />
        <View
          style={[
            styles.swipeGhostCard,
            compact ? styles.swipeGhostCardCompact : null,
            styles.swipeGhostMid,
            {
              backgroundColor: palette.panelStrong,
              borderColor: palette.border,
            },
          ]}
        />
        <Animated.View
          {...panResponder.panHandlers}
          accessibilityActions={[
            { label: '选择左侧判断', name: 'decrement' },
            { label: '选择右侧判断', name: 'increment' },
          ]}
          accessibilityHint="向左或向右选择对应判断"
          accessibilityLabel="滑动判断"
          accessibilityRole="adjustable"
          accessibilityValue={{ text: selectedState?.label ?? '未选择' }}
          accessible
          onLayout={event => {
            cardWidthRef.current = Math.max(event.nativeEvent.layout.width, 1);
          }}
          onAccessibilityAction={event => {
            if (event.nativeEvent.actionName === 'decrement') {
              commitStateAtIndex(0);
            } else if (event.nativeEvent.actionName === 'increment') {
              commitStateAtIndex(1);
            }
          }}
          style={[
            styles.swipeTopCard,
            compact ? styles.swipeTopCardCompact : null,
            {
              backgroundColor: palette.panel,
              borderColor: tone.accent,
              transform: [{ translateX: dragX }, { rotate }],
            },
          ]}
          testID="learning-swipe-draggable-card"
        >
          <Text style={[styles.swipePromptLabel, { color: tone.accent }]}>
            左右滑动判断
          </Text>
          <Text style={[styles.swipePromptText, { color: palette.text }]}>
            {card.front.prompt}
          </Text>
        </Animated.View>
      </View>
      <View
        style={[
          styles.swipeTrailRow,
          compact ? styles.swipeTrailRowCompact : null,
        ]}
      >
        {card.swipe_states.map((state, index) => (
          <Pressable
            accessibilityHint="点按后直接提交这一判断"
            accessibilityLabel={`${index === 0 ? '左划' : '右划'}，${
              state.label
            }`}
            accessibilityRole="radio"
            accessibilityState={{
              checked: cardState.swipeSelection === state.id,
            }}
            key={state.id}
            onPress={() => commitStateAtIndex(index)}
            style={[
              styles.swipeTrailCard,
              compact ? styles.swipeTrailCardCompact : null,
              index === 0 ? styles.swipeTrailLeft : styles.swipeTrailRight,
              {
                backgroundColor: palette.panel,
                borderColor: palette.border,
              },
            ]}
            testID={`learning-swipe-${index + 1}`}
          >
            <View style={styles.swipeTrailHeading}>
              <Text
                numberOfLines={isAccessibilityText ? undefined : 1}
                style={[styles.swipeTrailHint, { color: tone.accent }]}
              >
                {index === 0 ? '← 左划' : '右划 →'}
              </Text>
              <Text
                numberOfLines={isAccessibilityText ? undefined : 1}
                style={[styles.swipeLabel, { color: palette.text }]}
              >
                {state.label}
              </Text>
            </View>
            <Text
              numberOfLines={isAccessibilityText ? undefined : 1}
              style={[styles.swipeText, { color: palette.textMuted }]}
            >
              {state.description}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

type DetailAnswerRow = {
  label: string;
  displayText: string;
  testID: string;
  tone?: 'success' | 'warning';
};

function getResultTone(
  result: LearningCardResult,
  palette: LearningSurfacePalette,
) {
  if (result.outcome === 'review') {
    return palette.warning;
  }

  if (result.outcome === 'incorrect') {
    return palette.danger;
  }

  return palette.success;
}

function formatOptionText(option: { label: string; text: string } | undefined) {
  return option ? `${option.label} · ${option.text}` : '未选择';
}

function getResolvedAnswerRows(
  card: LearningCard,
  cardState: LearningCardState,
): DetailAnswerRow[] {
  switch (card.interaction_id) {
    case 'flip':
      return [
        {
          label: '你的判断',
          displayText:
            cardState.flipConfidence === 'review' ? '再回看' : '有把握',
          testID: 'learning-detail-selected-answer',
          tone: cardState.flipConfidence === 'review' ? 'warning' : 'success',
        },
        {
          label: '卡背要点',
          displayText: card.back_text,
          testID: 'learning-detail-correct-answer',
        },
      ];
    case 'multiple_choice': {
      const selectedOption = card.options.find(
        option => option.id === cardState.selectedOptionId,
      );
      const correctOption = card.options.find(
        option => option.id === card.answer_key.correct_option,
      );

      return [
        {
          label: '你的选择',
          displayText: formatOptionText(selectedOption),
          testID: 'learning-detail-selected-answer',
          tone:
            selectedOption?.id === correctOption?.id ? 'success' : 'warning',
        },
        {
          label: '正确答案',
          displayText: formatOptionText(correctOption),
          testID: 'learning-detail-correct-answer',
          tone: 'success',
        },
      ];
    }
    case 'lock':
      return [
        {
          label: '你的锁位',
          displayText: card.lock_slots
            .map(
              slot =>
                `${slot.label} ${cardState.lockSelections[slot.id] ?? '未选'}`,
            )
            .join(' · '),
          testID: 'learning-detail-selected-answer',
        },
        {
          label: '正确主干',
          displayText: card.lock_slots
            .map(
              (slot, index) =>
                `${slot.label} ${card.answer_key.lock_pattern[index]}`,
            )
            .join(' · '),
          testID: 'learning-detail-correct-answer',
          tone: 'success',
        },
      ];
    case 'elimination': {
      const selectedItems = card.elimination_items.filter(item =>
        cardState.eliminatedItemIds.includes(item.id),
      );
      const correctItems = card.elimination_items.filter(item =>
        card.answer_key.correct_items.includes(item.id),
      );

      return [
        {
          label: '你点掉的部分',
          displayText: selectedItems.length
            ? selectedItems.map(item => item.text).join(' · ')
            : '未点掉干扰项',
          testID: 'learning-detail-selected-answer',
        },
        {
          label: '应先剥离',
          displayText: correctItems.map(item => item.text).join(' · '),
          testID: 'learning-detail-correct-answer',
          tone: 'success',
        },
      ];
    }
    case 'swipe': {
      const selectedState = card.swipe_states.find(
        state => state.id === cardState.swipeSelection,
      );
      const correctState = card.swipe_states.find(
        state => state.id === card.answer_key.correct_state,
      );

      return [
        {
          label: '你的方向',
          displayText: selectedState
            ? `${selectedState.label} · ${selectedState.description}`
            : '未选择',
          testID: 'learning-detail-selected-answer',
          tone: selectedState?.id === correctState?.id ? 'success' : 'warning',
        },
        {
          label: '稳妥判断',
          displayText: correctState
            ? `${correctState.label} · ${correctState.description}`
            : '待确认',
          testID: 'learning-detail-correct-answer',
          tone: 'success',
        },
      ];
    }
    default:
      return [];
  }
}

export function LearningResultDetailSurface({
  advanceState = DEFAULT_LEARNING_ADVANCE_STATE,
  card,
  cardState,
  currentIndex,
  isLastCard,
  onAdvanceCard,
  onBackToPractice,
  palette,
  phase,
  result,
  sessionCardCount,
}: {
  advanceState?: LearningAdvanceState;
  card: LearningCard;
  cardState: LearningCardState;
  currentIndex: number;
  isLastCard: boolean;
  onAdvanceCard: () => void;
  onBackToPractice: () => void;
  palette: LearningSurfacePalette;
  phase: 'learning' | 'review';
  result: LearningCardResult;
  sessionCardCount: number;
  sessionLabel: string;
}) {
  const {
    fontScale,
    height: viewportHeight,
    width: viewportWidth,
  } = useWindowDimensions();
  const isAccessibilityText = fontScale >= 1.3;
  const shouldStackResolvedAnswers = viewportWidth < 600;
  const isCompactPhone = isCompactLearningViewport(
    viewportWidth,
    viewportHeight,
  );
  const displaySessionLabel = formatLearningSessionDisplayLabel(phase);
  const visibleShelfName = formatSpaceDisplayName(
    card.space_metadata.library,
    '当前书架',
  );
  const visibleSectionName = formatSpaceDisplayName(
    card.space_metadata.group,
    '当前分区',
  );
  const visibleContainerName = formatSpaceDisplayName(
    card.space_metadata.box,
    '当前卡盒',
  );
  const resultTone = getResultTone(result, palette);
  const detailLibraryTone = resolveLibraryTone(card.space_metadata.library);
  const resolvedRows = getResolvedAnswerRows(card, cardState);
  const isPositive =
    result.outcome === 'correct' || result.outcome === 'confident';
  const primaryAction = getPrimaryActionColors(palette);
  const neutralAction = getNeutralActionSurface(palette);
  const detailOutcomeTitle = isPositive ? '答案已归位' : '留到回看';
  const detailOutcomeCaption = isPositive
    ? '你的选择和正确答案已对齐'
    : '先保留判断，回看时再确认';
  const boundedSessionCardCount = Math.max(sessionCardCount, 1);
  const progressOrdinal = Math.min(currentIndex + 1, boundedSessionCardCount);
  const progressPercent = `${Math.max(
    Math.round((progressOrdinal / boundedSessionCardCount) * 100),
    10,
  )}%` as DimensionValue;
  const progressCount = `${progressOrdinal}/${boundedSessionCardCount}`;

  return (
    <View
      style={[
        styles.oneScreenPage,
        styles.detailScreen,
        isCompactPhone ? styles.oneScreenPageCompact : null,
      ]}
      testID="learning-result-detail-screen"
    >
      <ScrollView
        contentContainerStyle={[
          styles.detailResolvedCardContent,
          isCompactPhone ? styles.detailResolvedCardContentCompact : null,
        ]}
        showsVerticalScrollIndicator={false}
        style={[
          styles.detailResolvedCard,
          styles.glassCard,
          {
            backgroundColor: palette.panel,
            borderColor: palette.border,
            shadowColor: palette.text,
          },
        ]}
        testID="learning-detail-resolved-card"
      >
        <View
          style={[
            styles.cardAddressShelf,
            isCompactPhone ? styles.cardAddressShelfCompact : null,
          ]}
        >
          <View style={styles.heroChipRow}>
            <View
              pointerEvents="none"
              style={[
                styles.cardObjectAccent,
                isCompactPhone ? styles.cardObjectAccentCompact : null,
                { backgroundColor: hexToRgba(detailLibraryTone.accent, 0.92) },
              ]}
            />
            <View
              style={[
                styles.cardObjectHeaderText,
                isCompactPhone ? styles.cardObjectHeaderTextCompact : null,
              ]}
            >
              <Text
                style={[styles.learningFrameMeta, { color: palette.textMuted }]}
              >
                {isCompactPhone
                  ? `${
                      phase === 'review' ? '本轮回看' : displaySessionLabel
                    } · ${visibleContainerName}`
                  : phase === 'review'
                  ? '本轮回看'
                  : displaySessionLabel}
              </Text>
              <Text
                style={[
                  styles.cardObjectLead,
                  isCompactPhone ? styles.cardObjectLeadCompact : null,
                  { color: palette.text },
                ]}
              >
                当前卡 · {INTERACTION_LABELS[card.interaction_id]}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.cardProgressCluster,
              isCompactPhone ? styles.cardProgressClusterCompact : null,
              {
                backgroundColor: palette.panelStrong,
                borderColor: hexToRgba(detailLibraryTone.accent, 0.14),
              },
            ]}
          >
            <Text style={[styles.cardProgressCount, { color: palette.text }]}>
              {progressCount}
            </Text>
            <View
              style={[
                styles.cardProgressTrack,
                { backgroundColor: palette.panel, borderColor: palette.border },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: detailLibraryTone.accent,
                    width: progressPercent,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {!isCompactPhone ? (
          <View
            style={[
              styles.cardLocationStrip,
              {
                backgroundColor: 'transparent',
                borderColor: hexToRgba(palette.textMuted, 0.14),
              },
            ]}
          >
            <View
              pointerEvents="none"
              style={[
                styles.cardLocationDot,
                { backgroundColor: hexToRgba(detailLibraryTone.accent, 0.62) },
              ]}
            />
            <View style={styles.cardLocationTextWrap}>
              <Text
                numberOfLines={1}
                style={[styles.cardLocationTitle, { color: palette.textMuted }]}
              >
                {visibleContainerName}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.cardLocationMeta, { color: palette.textMuted }]}
              >
                {`${visibleShelfName} / ${visibleSectionName}`}
              </Text>
            </View>
            <Pressable
              onPress={onBackToPractice}
              style={[
                styles.detailCollapseButton,
                {
                  backgroundColor: palette.panel,
                  borderColor: palette.border,
                },
              ]}
              testID="learning-result-back-button"
            >
              <Text
                style={[
                  styles.detailCollapseLabel,
                  { color: palette.textMuted },
                ]}
              >
                卡面
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View
          style={[
            styles.detailResolvedHero,
            isCompactPhone ? styles.detailResolvedHeroCompact : null,
            {
              backgroundColor: palette.panelStrong,
              borderColor: palette.border,
            },
          ]}
        >
          <View style={styles.detailTitleWrap}>
            <View
              style={[
                styles.detailStatePill,
                { backgroundColor: hexToRgba(resultTone, 0.11) },
              ]}
            >
              <Text style={[styles.detailStateText, { color: resultTone }]}>
                {isPositive ? '已答对' : '待回看'}
              </Text>
            </View>
            <Text
              numberOfLines={
                isAccessibilityText ? undefined : isCompactPhone ? 2 : 3
              }
              style={[
                styles.detailPrompt,
                isCompactPhone ? styles.detailPromptCompact : null,
                { color: palette.text },
              ]}
            >
              {card.front.prompt}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.detailAnswerSlip,
            isCompactPhone ? styles.detailAnswerSlipCompact : null,
            {
              backgroundColor: neutralAction.surface,
              borderColor: neutralAction.border,
            },
          ]}
          testID="learning-detail-answer-slip"
        >
          <View style={styles.detailSlipHeader}>
            <View
              style={[styles.detailSlipDot, { backgroundColor: resultTone }]}
            />
            <View style={styles.detailSlipTitleWrap}>
              <Text style={[styles.detailOutcomeTitle, { color: resultTone }]}>
                {detailOutcomeTitle}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.detailSlipCaption, { color: palette.textMuted }]}
              >
                {detailOutcomeCaption}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.detailAnswerRail,
              shouldStackResolvedAnswers
                ? styles.detailAnswerRailStacked
                : null,
            ]}
          >
            {resolvedRows.map(row => {
              const rowTone =
                row.tone === 'success'
                  ? palette.success
                  : row.tone === 'warning'
                  ? palette.warning
                  : palette.textMuted;

              return (
                <View
                  key={row.label}
                  style={[
                    styles.detailAnswerCell,
                    isCompactPhone ? styles.detailAnswerCellCompact : null,
                    shouldStackResolvedAnswers
                      ? styles.detailAnswerCellStacked
                      : null,
                    {
                      backgroundColor: hexToRgba(rowTone, 0.075),
                      borderColor: hexToRgba(rowTone, 0.14),
                    },
                  ]}
                  testID={
                    row.testID === 'learning-detail-selected-answer'
                      ? 'learning-detail-selected-answer'
                      : 'learning-detail-correct-answer'
                  }
                >
                  <Text
                    numberOfLines={isAccessibilityText ? undefined : 1}
                    style={[
                      styles.detailAnswerLabel,
                      shouldStackResolvedAnswers
                        ? styles.detailAnswerLabelStacked
                        : null,
                      { color: rowTone },
                    ]}
                  >
                    {row.label}
                  </Text>
                  <Text
                    numberOfLines={isAccessibilityText ? undefined : 2}
                    style={[
                      styles.detailAnswerValue,
                      shouldStackResolvedAnswers
                        ? styles.detailAnswerValueStacked
                        : null,
                      { color: palette.text },
                    ]}
                  >
                    {row.displayText}
                  </Text>
                </View>
              );
            })}
          </View>

          <View
            style={[
              styles.detailExplanationSlip,
              isCompactPhone ? styles.detailExplanationSlipCompact : null,
              {
                backgroundColor: palette.panel,
                borderColor: palette.border,
              },
            ]}
          >
            <Text
              style={[styles.resultExplanationTitle, { color: palette.text }]}
              testID="learning-detail-analysis-title"
            >
              {card.analysis.title}
            </Text>
            <Text
              style={[
                styles.resultExplanationBody,
                isCompactPhone ? styles.resultExplanationBodyCompact : null,
                { color: palette.textMuted },
              ]}
              testID="learning-detail-analysis-body"
            >
              {card.analysis.summary}
            </Text>
            <Text
              style={[
                styles.detailTip,
                isCompactPhone ? styles.detailTipCompact : null,
                { color: palette.textMuted },
              ]}
              testID="learning-detail-analysis-tip"
            >
              过级提醒：{card.analysis.exam_tip}
            </Text>
          </View>
        </View>

        <Pressable
          disabled={advanceState.busy}
          onPress={onAdvanceCard}
          style={[
            styles.primaryButton,
            styles.detailPrimaryButton,
            isCompactPhone ? styles.detailPrimaryButtonCompact : null,
            { backgroundColor: primaryAction.surface },
          ]}
          testID="learning-next-button"
        >
          <Text
            style={[styles.primaryButtonLabel, { color: primaryAction.text }]}
          >
            {advanceState.busy
              ? '正在保存…'
              : advanceState.needsRetry
              ? '重试保存'
              : isLastCard
              ? '完成本轮学习'
              : '继续下一张'}
          </Text>
        </Pressable>
        {advanceState.detail ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.resultAdvanceStatus,
              {
                color: advanceState.needsRetry
                  ? palette.danger
                  : palette.textMuted,
              },
            ]}
            testID="learning-advance-status"
          >
            {advanceState.detail}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ResultSummaryPanel({
  advanceState,
  card,
  compact,
  palette,
  result,
  onAdvanceCard,
  onOpenResultDetail,
  isLastCard,
}: {
  advanceState: LearningAdvanceState;
  card: LearningCard;
  compact: boolean;
  palette: LearningSurfacePalette;
  result: LearningCardResult;
  onAdvanceCard: () => void;
  onOpenResultDetail: () => void;
  isLastCard: boolean;
}) {
  const borderTone =
    result.outcome === 'review'
      ? palette.warning
      : result.outcome === 'incorrect'
      ? palette.danger
      : palette.success;
  const isPositive =
    result.outcome === 'correct' || result.outcome === 'confident';
  const primaryAction = getPrimaryActionColors(palette);

  return (
    <View
      style={[
        styles.resultCard,
        compact ? styles.resultCardCompact : null,
        {
          backgroundColor: palette.panelStrong,
          borderColor: borderTone,
        },
      ]}
      testID="learning-result-summary"
    >
      <View style={styles.resultHeader}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          {isPositive ? '这张卡已稳住' : '这张卡需要回看'}
        </Text>
        <ResultBadge outcome={result.outcome} palette={palette} />
      </View>
      <Text style={[styles.resultExplanationTitle, { color: palette.text }]}>
        本次判断已完成
      </Text>
      <Text
        style={[styles.resultExplanationBody, { color: palette.textMuted }]}
      >
        解析已准备好：{card.analysis.title}
      </Text>
      <View style={styles.resultActionRow}>
        <Pressable
          onPress={onOpenResultDetail}
          style={[
            styles.secondaryButton,
            {
              backgroundColor: palette.panel,
              borderColor: borderTone,
            },
          ]}
          testID="learning-open-result-detail-button"
        >
          <Text style={[styles.secondaryButtonLabel, { color: borderTone }]}>
            查看解析
          </Text>
        </Pressable>
        <Pressable
          disabled={advanceState.busy}
          onPress={onAdvanceCard}
          style={[
            styles.primaryButton,
            styles.resultNextButton,
            { backgroundColor: primaryAction.surface },
          ]}
          testID="learning-next-button"
        >
          <Text
            style={[styles.primaryButtonLabel, { color: primaryAction.text }]}
          >
            {advanceState.busy
              ? '正在保存…'
              : advanceState.needsRetry
              ? '重试保存'
              : isLastCard
              ? '完成本轮学习'
              : '继续下一张'}
          </Text>
        </Pressable>
      </View>
      {advanceState.detail ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[
            styles.resultAdvanceStatus,
            {
              color: advanceState.needsRetry
                ? palette.danger
                : palette.textMuted,
            },
          ]}
          testID="learning-advance-status"
        >
          {advanceState.detail}
        </Text>
      ) : null}
    </View>
  );
}

function ResultPanel({
  advanceState,
  card,
  palette,
  result,
  onAdvanceCard,
  isLastCard,
}: {
  advanceState: LearningAdvanceState;
  card: LearningCard;
  palette: LearningSurfacePalette;
  result: LearningCardResult;
  onAdvanceCard: () => void;
  isLastCard: boolean;
}) {
  const borderTone =
    result.outcome === 'review'
      ? palette.warning
      : result.outcome === 'incorrect'
      ? palette.danger
      : palette.success;
  const isPositive =
    result.outcome === 'correct' || result.outcome === 'confident';
  const primaryAction = getPrimaryActionColors(palette);

  return (
    <View
      style={[
        styles.resultCard,
        {
          backgroundColor: palette.panelStrong,
          borderColor: borderTone,
        },
      ]}
    >
      <View style={styles.resultHeader}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          {isPositive ? '这张卡已稳住' : '这张卡需要回看'}
        </Text>
        <ResultBadge outcome={result.outcome} palette={palette} />
      </View>
      <Text style={[styles.resultExplanationTitle, { color: palette.text }]}>
        {card.analysis.title}
      </Text>
      <Text
        style={[styles.resultExplanationBody, { color: palette.textMuted }]}
      >
        {card.analysis.summary}
      </Text>
      <Text style={[styles.resultTip, { color: palette.textMuted }]}>
        过级提醒：{card.analysis.exam_tip}
      </Text>
      <View
        style={[
          styles.settlePanel,
          {
            backgroundColor: palette.panel,
            borderColor: palette.success,
          },
        ]}
        testID="learning-settle-panel"
      >
        <Text style={[styles.settleTitle, { color: palette.success }]}>
          本次判断已完成
        </Text>
        <Text style={[styles.settleText, { color: palette.textMuted }]}>
          查看解析后继续；进入下一张前会先安全保存本次答题记录。
        </Text>
      </View>
      <Pressable
        disabled={advanceState.busy}
        onPress={onAdvanceCard}
        style={[
          styles.primaryButton,
          { backgroundColor: primaryAction.surface },
        ]}
        testID="learning-next-button"
      >
        <Text
          style={[styles.primaryButtonLabel, { color: primaryAction.text }]}
        >
          {advanceState.busy
            ? '正在保存…'
            : advanceState.needsRetry
            ? '重试保存'
            : isLastCard
            ? '完成本轮学习'
            : '下一张'}
        </Text>
      </Pressable>
      {advanceState.detail ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[
            styles.resultAdvanceStatus,
            {
              color: advanceState.needsRetry
                ? palette.danger
                : palette.textMuted,
            },
          ]}
          testID="learning-advance-status"
        >
          {advanceState.detail}
        </Text>
      ) : null}
    </View>
  );
}

function MetricPill({
  label,
  value,
  palette,
  tone,
}: {
  label: string;
  value: string;
  palette: LearningSurfacePalette;
  tone?: 'success' | 'danger';
}) {
  const accentColor =
    tone === 'success'
      ? palette.success
      : tone === 'danger'
      ? palette.danger
      : palette.accent;

  return (
    <View
      style={[
        styles.metricPill,
        { backgroundColor: palette.panelStrong, borderColor: accentColor },
      ]}
    >
      <Text style={[styles.metricLabel, { color: palette.textMuted }]}>
        {label}
      </Text>
      <Text style={[styles.metricValue, { color: accentColor }]}>{value}</Text>
    </View>
  );
}

function ResultBadge({
  outcome,
  palette,
}: {
  outcome: LearningCardResult['outcome'];
  palette: LearningSurfacePalette;
}) {
  const isPositive = outcome === 'correct' || outcome === 'confident';
  const badgeTone =
    outcome === 'review'
      ? palette.warning
      : outcome === 'incorrect'
      ? palette.danger
      : palette.success;
  const label =
    outcome === 'correct'
      ? '自动判对'
      : outcome === 'incorrect'
      ? '自动判错'
      : outcome === 'confident'
      ? '翻面有把握'
      : '翻面回看';

  return (
    <View
      style={[
        styles.resultBadge,
        isPositive ? styles.resultBadgePositive : styles.resultBadgeNegative,
        {
          borderColor: badgeTone,
        },
      ]}
    >
      <Text style={[styles.resultBadgeLabel, { color: badgeTone }]}>
        {label}
      </Text>
    </View>
  );
}

function LightActionButton({
  compact,
  label,
  onPress,
  palette,
  testID,
}: {
  compact: boolean;
  label: string;
  onPress: () => void;
  palette: LearningSurfacePalette;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.lightActionButton,
        compact ? styles.lightActionButtonCompact : null,
        {
          backgroundColor: palette.panelStrong,
          borderColor: palette.border,
        },
      ]}
      testID={testID}
    >
      <Text style={[styles.lightActionLabel, { color: palette.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  audioResourceSlot: {
    alignItems: 'flex-start',
    flexShrink: 0,
  },
  oneScreenPage: {
    flex: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  oneScreenPageCompact: {
    gap: 6,
    paddingBottom: 6,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  completeScreen: {
    justifyContent: 'center',
  },
  glassCard: {
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.13,
    shadowRadius: 30,
    elevation: 6,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    gap: 14,
  },
  completeHeroCard: {
    paddingVertical: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  heroChipRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  heroSummary: {
    fontSize: 15,
    lineHeight: 23,
  },
  learningFrameHeader: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 8,
  },
  learningFrameTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  learningFrameMeta: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  learningFrameSummary: {
    fontSize: 13,
    lineHeight: 20,
  },
  detailScreen: {
    justifyContent: 'flex-start',
    paddingHorizontal: 18,
  },
  detailObjectHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  detailCollapseButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  detailCollapseLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailResolvedCard: {
    borderRadius: 30,
    borderWidth: 1,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  detailResolvedCardContent: {
    flexGrow: 1,
    gap: 6,
    justifyContent: 'space-between',
    paddingHorizontal: 17,
    paddingVertical: 12,
    position: 'relative',
  },
  detailResolvedCardContentCompact: {
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailResolvedHero: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  detailResolvedHeroCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  detailTitleWrap: {
    alignSelf: 'stretch',
    gap: 6,
  },
  detailStatePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  detailStateText: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  detailPrompt: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  detailPromptCompact: {
    fontSize: 15,
    lineHeight: 19,
  },
  detailAnswerSlip: {
    borderRadius: 22,
    borderWidth: 1,
    flexGrow: 1,
    gap: 7,
    justifyContent: 'space-between',
    minHeight: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailAnswerSlipCompact: {
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  detailSlipHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  detailSlipDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  detailSlipTitleWrap: {
    flex: 1,
    gap: 1,
  },
  detailSlipCaption: {
    fontSize: 12,
    lineHeight: 17,
  },
  detailAnswerRail: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 6,
  },
  detailAnswerRailStacked: {
    flexDirection: 'column',
    gap: 5,
  },
  detailAnswerCell: {
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minHeight: 49,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  detailAnswerCellCompact: {
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  detailAnswerCellStacked: {
    alignItems: 'center',
    flexDirection: 'row',
    flexGrow: 0,
    minHeight: 42,
  },
  detailAnswerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
  },
  detailAnswerLabelStacked: {
    flexShrink: 0,
    minWidth: 54,
  },
  detailAnswerValue: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  detailAnswerValueStacked: {
    flex: 1,
    minWidth: 0,
  },
  detailExplanationSlip: {
    borderRadius: 18,
    borderWidth: 1,
    flexGrow: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 0,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  detailExplanationSlipCompact: {
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  detailOutcomeTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  detailTip: {
    fontSize: 12,
    lineHeight: 18,
  },
  detailTipCompact: {
    lineHeight: 16,
  },
  detailPrimaryButton: {
    marginTop: 0,
    paddingVertical: 12,
  },
  detailPrimaryButtonCompact: {
    minHeight: 44,
    paddingVertical: 8,
  },
  detailCardLocationStrip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  learningCardLocationHint: {
    borderWidth: 0,
    gap: 7,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  progressTrack: {
    height: 8,
    borderWidth: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  cardProgressTrack: {
    borderRadius: 999,
    borderWidth: 1,
    height: 7,
    overflow: 'hidden',
    width: 54,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  progressCaption: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  progressFigure: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  progressNode: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  progressNodeLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  studyCard: {
    borderWidth: 1,
    borderTopWidth: 8,
    borderRadius: 30,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 14,
    position: 'relative',
  },
  studyCardOneScreen: {
    flexGrow: 0,
    flexShrink: 1,
    gap: 8,
    paddingHorizontal: 17,
    paddingVertical: 14,
  },
  studyCardOneScreenCompact: {
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  studyCardWorkArea: {
    flexGrow: 1,
  },
  cardAddressShelf: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardAddressShelfCompact: {
    gap: 8,
  },
  cardObjectAccent: {
    borderRadius: 999,
    height: 9,
    width: 9,
  },
  cardObjectAccentCompact: {
    height: 8,
    width: 8,
  },
  cardObjectHeaderText: {
    flex: 1,
    gap: 2,
  },
  cardObjectHeaderTextCompact: {
    gap: 0,
  },
  cardObjectLead: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  cardObjectLeadCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  cardProgressCluster: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    minWidth: 62,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  cardProgressClusterCompact: {
    gap: 2,
    minWidth: 56,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  cardProgressCount: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 19,
  },
  cardLocationStrip: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  cardLocationDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  cardLocationTextWrap: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardLocationTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  cardLocationMeta: {
    fontSize: 12,
    fontWeight: '700',
  },
  studyCardTop: {
    alignItems: 'flex-start',
    borderRadius: 0,
    borderWidth: 0,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingVertical: 7,
  },
  studyCardTopCompact: {
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  studyTitleWrap: {
    flex: 1,
    gap: 7,
  },
  cardEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  cardPrompt: {
    fontSize: 29,
    lineHeight: 36,
    fontWeight: '800',
  },
  cardPromptOneScreen: {
    fontSize: 23,
    lineHeight: 29,
  },
  cardPromptOneScreenCompact: {
    fontSize: 20,
    lineHeight: 25,
  },
  contextCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 14,
    gap: 8,
  },
  contextCardSupportActive: {
    borderLeftWidth: 0,
  },
  denseSupportLayer: {
    borderRadius: 14,
    borderWidth: 1,
    flexShrink: 0,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  denseSupportTitle: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  denseSupportBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  cardSupport: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  cardContext: {
    fontSize: 14,
    lineHeight: 21,
  },
  favoriteButton: {
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    flexGrow: 1,
    minWidth: 86,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  favoriteButtonCompact: {
    minHeight: 44,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  favoriteLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionRowCompact: {
    flexWrap: 'nowrap',
    gap: 6,
  },
  lightActionButton: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    flexGrow: 1,
    minWidth: 86,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  lightActionButtonCompact: {
    minHeight: 44,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  lightActionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  attachedLayerPanel: {
    borderLeftWidth: 0,
    marginTop: -8,
  },
  peekPanel: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    gap: 6,
  },
  peekTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  peekText: {
    fontSize: 13,
    lineHeight: 20,
  },
  hintPanel: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 6,
  },
  hintTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  hintText: {
    fontSize: 14,
    lineHeight: 21,
  },
  addressAperture: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addressText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  interactionCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 12,
  },
  interactionCardOneScreen: {
    flexGrow: 1,
    flexShrink: 1,
    gap: 9,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  interactionCardOneScreenCompact: {
    gap: 4,
    paddingVertical: 1,
  },
  interactionCardNaturalHeight: {
    flexGrow: 0,
    flexShrink: 0,
  },
  interactionCardEmbedded: {
    borderRadius: 22,
    borderWidth: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  interactionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  interactionMeta: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  actionCue: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  interactionBody: {
    gap: 8,
  },
  interactionBodyCompact: {
    gap: 4,
  },
  choiceInteractionBody: {
    flexGrow: 1,
  },
  revealPanel: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 6,
  },
  revealPanelCompact: {
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  revealTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  revealText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  revealTextCompact: {
    fontSize: 14,
    lineHeight: 19,
  },
  confidenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  confidenceRowCompact: {
    flexWrap: 'nowrap',
    gap: 6,
  },
  choicePill: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  choicePillWide: {
    flex: 1,
    minWidth: 132,
    alignItems: 'center',
  },
  choicePillCompact: {
    minHeight: 44,
    paddingVertical: 7,
  },
  choiceLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  optionGridWorkArea: {
    alignContent: 'stretch',
    flexGrow: 1,
  },
  optionCard: {
    borderWidth: 1.5,
    borderRadius: 17,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 8,
    alignItems: 'flex-start',
    minHeight: 76,
    minWidth: '47%',
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 11,
    position: 'relative',
    justifyContent: 'space-between',
  },
  optionCardSelected: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  optionCardCompact: {
    gap: 4,
    minHeight: 62,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  optionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    width: '100%',
  },
  optionLetterBadge: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 25,
    justifyContent: 'center',
    width: 25,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  optionStateLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  optionText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  lockGroup: {
    gap: 10,
  },
  lockList: {
    gap: 6,
  },
  lockListCompact: {
    gap: 3,
  },
  lockRow: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  lockRowCompact: {
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  lockGlyph: {
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  lockGlyphCompact: {
    height: 22,
    width: 22,
  },
  lockGlyphLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  lockBody: {
    flex: 1,
    gap: 5,
  },
  lockBodyCompact: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  lockLabelRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  lockLabelRowCompact: {
    flexShrink: 0,
    width: 28,
  },
  lockLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  lockStatus: {
    fontSize: 10,
    fontWeight: '800',
  },
  lockChoicePill: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  lockChoicePillCompact: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  lockChoicePillDisabled: {
    opacity: 0.58,
  },
  lockChoiceLabel: {
    fontSize: 11,
  },
  lockChoiceWrap: {
    flexWrap: 'nowrap',
    gap: 5,
  },
  lockChoiceWrapCompact: {
    flex: 1,
  },
  inlineWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inlineHelper: {
    fontSize: 13,
    lineHeight: 20,
  },
  eliminationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  eliminationGridCompact: {
    gap: 6,
  },
  eliminationCard: {
    flexBasis: '47%',
    minHeight: 44,
    minWidth: 44,
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 20,
    gap: 8,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  eliminationCardCompact: {
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  eliminationStrikeRail: {
    borderRadius: 999,
    height: 3,
    width: 42,
  },
  eliminationText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  eliminationTextStruck: {
    textDecorationLine: 'line-through',
  },
  eliminationStateLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  swipeColumn: {
    gap: 8,
  },
  swipeColumnCompact: {
    gap: 5,
  },
  swipeDeck: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 116,
  },
  swipeDeckCompact: {
    minHeight: 94,
  },
  swipeGhostCard: {
    borderWidth: 1,
    borderRadius: 20,
    height: 92,
    position: 'absolute',
    width: '78%',
  },
  swipeGhostCardCompact: {
    height: 72,
  },
  swipeGhostBack: {
    transform: [{ translateX: -22 }, { translateY: 6 }],
  },
  swipeGhostMid: {
    transform: [{ translateX: 22 }, { translateY: -2 }],
  },
  swipeTopCard: {
    width: '82%',
    minHeight: 98,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 13,
    justifyContent: 'center',
    gap: 6,
  },
  swipeTopCardCompact: {
    gap: 3,
    minHeight: 80,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  swipePromptLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  swipePromptText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  swipeTrailRow: {
    flexDirection: 'row',
    gap: 12,
  },
  swipeTrailRowCompact: {
    gap: 8,
  },
  swipeTrailCard: {
    flex: 1,
    minHeight: 44,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 3,
  },
  swipeTrailCardCompact: {
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  swipeTrailHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  swipeTrailLeft: {
    transform: [{ translateX: -2 }],
  },
  swipeTrailRight: {
    transform: [{ translateX: 2 }],
  },
  swipeTrailHint: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    lineHeight: 17,
  },
  swipeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  swipeStateCard: {
    flex: 1,
    minWidth: 128,
    borderWidth: 1,
    borderRadius: 18,
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  swipeLabel: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  swipeText: {
    fontSize: 13,
    lineHeight: 17,
  },
  primaryButton: {
    borderRadius: 17,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oneScreenDock: {
    gap: 7,
    marginTop: 1,
  },
  oneScreenDockAnchored: {
    marginTop: 'auto',
  },
  oneScreenDockNatural: {
    marginTop: 4,
  },
  oneScreenDockCompact: {
    gap: 0,
  },
  oneScreenDockSmallViewport: {
    gap: 4,
    marginTop: 0,
  },
  submitActionDock: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 0,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  submitActionDockCompact: {
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  submitActionTextStack: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  submitActionTitle: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  submitActionDetail: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  submitActionButton: {
    alignItems: 'center',
    borderRadius: 17,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 118,
    paddingHorizontal: 16,
  },
  submitActionButtonLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  resultCard: {
    borderWidth: 1,
    borderRadius: 26,
    overflow: 'hidden',
    paddingHorizontal: 19,
    paddingVertical: 18,
    gap: 12,
    position: 'relative',
  },
  resultCardCompact: {
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  completeActionCard: {
    paddingVertical: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  resultActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  resultAdvanceStatus: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  resultNextButton: {
    flex: 1,
    minWidth: 138,
  },
  resultExplanationTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  resultExplanationBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  resultExplanationBodyCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  resultTip: {
    fontSize: 13,
    lineHeight: 20,
  },
  settlePanel: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 5,
  },
  settleTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  settleText: {
    fontSize: 13,
    lineHeight: 20,
  },
  resultBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resultBadgePositive: {
    backgroundColor: 'rgba(39, 174, 96, 0.12)',
  },
  resultBadgeNegative: {
    backgroundColor: 'rgba(235, 87, 87, 0.12)',
  },
  resultBadgeLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricPill: {
    minWidth: 92,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  resultCopy: {
    flex: 1,
    gap: 4,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  resultMeta: {
    fontSize: 12,
  },
});
