import React from 'react';
import type { DimensionValue } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  tabIdle: string;
  success: string;
  warning: string;
  danger: string;
};

type LearningSurfaceProps = {
  palette: LearningSurfacePalette;
  sessionCards: LearningCard[];
  sessionLabel: string;
  phase: 'learning' | 'review';
  currentCard: LearningCard | null;
  currentCardState: LearningCardState | null;
  currentIndex: number;
  currentResult: LearningCardResult | null;
  completedResults: LearningCardResult[];
  reviewCandidateCount: number;
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
  onStartReview?: () => void;
};

function formatLearningSessionLabelForDisplay(
  sessionLabel: string,
  phase: 'learning' | 'review',
) {
  const trimmedLabel = sessionLabel.trim();
  const exposesSourceMetadata = /系统顺序|卡源|catalog/i.test(trimmedLabel);

  if (!trimmedLabel || exposesSourceMetadata) {
    return phase === 'review' ? '本轮回看卡' : '本轮学习卡';
  }

  return trimmedLabel;
}

function formatLearningActionCue(
  card: LearningCard,
  currentResult: LearningCardResult | null,
) {
  if (currentResult) {
    return '这张已经完成，可以继续下一张。';
  }

  if (card.interaction_id === 'flip') {
    return '先翻面，看完解析后选有把握或再回看。';
  }

  return `先完成${INTERACTION_LABELS[card.interaction_id]}，再提交看解析。`;
}

export function LearningSurface({
  palette,
  sessionCards,
  sessionLabel,
  phase,
  currentCard,
  currentCardState,
  currentIndex,
  currentResult,
  completedResults,
  reviewCandidateCount,
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
  onStartReview,
}: LearningSurfaceProps) {
  const isReviewPhase = phase === 'review';
  const displaySessionLabel = formatLearningSessionLabelForDisplay(
    sessionLabel,
    phase,
  );
  if (currentCard === null || currentCardState === null) {
    const summary = summarizeLearningResults(
      completedResults,
      sessionCards.length,
    );

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
            {isReviewPhase ? '回看练习' : '单卡学习'}
          </Text>
          <Text style={[styles.heroTitle, { color: palette.text }]}>
            {isReviewPhase ? '本轮回看已走完' : '本轮学习已走完'}
          </Text>
          <Text style={[styles.heroSummary, { color: palette.textMuted }]}>
            {isReviewPhase
              ? `这轮从${displaySessionLabel}里回看了 ${sessionCards.length} 张卡，把“需要回看”的部分集中处理了一遍。`
              : `这轮从${displaySessionLabel}里完成了 ${sessionCards.length} 张卡，下一次会继续从需要再看的地方开始。`}
          </Text>
          <View style={styles.metricWrap}>
            <MetricPill
              label="完成"
              value={`${summary.completed}/${summary.total}`}
              palette={palette}
            />
            <MetricPill
              label="下一步"
              value={
                !isReviewPhase && reviewCandidateCount > 0
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
            {isReviewPhase ? '回看已经收好' : '这一轮已经收好'}
          </Text>
          <Text
            style={[styles.resultExplanationBody, { color: palette.textMuted }]}
          >
            {isReviewPhase
              ? '仍不稳的点会留在后续学习里自然出现。'
              : '需要再看的卡已经收进回看，不要求你管理列表。'}
          </Text>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            下一步
          </Text>
          <Text
            style={[styles.resultExplanationBody, { color: palette.textMuted }]}
          >
            {isReviewPhase
              ? '回看已经结束。可以回到首轮重新开始，也可以稍后按学习节奏继续。'
              : reviewCandidateCount > 0
              ? `先回看这 ${reviewCandidateCount} 张卡，再继续新一轮学习。`
              : '这一轮已经完成，可以重新练这轮卡。'}
          </Text>
          {!isReviewPhase && reviewCandidateCount > 0 && onStartReview ? (
            <Pressable
              onPress={onStartReview}
              style={[
                styles.primaryButton,
                { backgroundColor: palette.accentStrong },
              ]}
              testID="learning-start-review-button"
            >
              <Text
                style={[styles.primaryButtonLabel, { color: palette.panel }]}
              >
                开始回看这 {reviewCandidateCount} 张卡
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onRestartDeck}
            style={[styles.primaryButton, { backgroundColor: palette.accent }]}
            testID="learning-restart-button"
          >
            <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
              {isReviewPhase ? '回到首轮重新开始' : '重新练这轮卡'}
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
  const hasCommittedChoiceSelection =
    currentCard.interaction_id === 'multiple_choice' &&
    currentCardState.selectedOptionId !== null;
  const shouldShowContextCard =
    currentResult === null && !isDenseInteraction && supportLayer !== null;
  const shouldShowUtilityDock =
    currentResult === null && !hasCommittedChoiceSelection;

  return (
    <View style={styles.oneScreenPage} testID="learning-one-screen-flow">
      <View
        style={[
          styles.studyCard,
          styles.studyCardOneScreen,
          styles.glassCard,
          {
            backgroundColor: palette.panel,
            borderColor: palette.border,
            shadowColor: palette.text,
          },
        ]}
        testID="learning-current-card"
      >
        <View
          style={styles.cardAddressShelf}
          testID="learning-card-address-shelf"
        >
          <View style={styles.heroChipRow}>
            <View
              pointerEvents="none"
              style={[
                styles.cardObjectAccent,
                { backgroundColor: tone.accent },
              ]}
            />
            <View style={styles.cardObjectHeaderText}>
              <Text
                style={[styles.learningFrameMeta, { color: palette.textMuted }]}
                testID="learning-progress-label"
              >
                {isReviewPhase ? '本轮回看' : displaySessionLabel}
              </Text>
              <Text style={[styles.cardObjectLead, { color: palette.text }]}>
                当前卡 · {INTERACTION_LABELS[currentCard.interaction_id]}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.cardProgressCluster,
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
        <View
          style={[
            styles.cardLocationStrip,
            {
              backgroundColor: hexToRgba(tone.accent, 0.028),
              borderColor: hexToRgba(tone.accent, 0.1),
            },
          ]}
          testID="learning-card-location-strip"
        >
          <View style={styles.cardLocationTextWrap}>
            <Text
              numberOfLines={1}
              style={[styles.cardLocationTitle, { color: palette.textMuted }]}
            >
              当前馆 · 本轮盒
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.cardLocationMeta, { color: palette.textMuted }]}
            >
              {isReviewPhase ? '需要再看的卡已放到眼前' : '位置已保持'}
            </Text>
          </View>
        </View>
        <View style={styles.studyCardTop}>
          <View style={styles.studyTitleWrap}>
            <Text style={[styles.cardEyebrow, { color: palette.textMuted }]}>
              先判断，再确认解析
            </Text>
            <Text
              numberOfLines={isDenseInteraction ? 2 : 4}
              style={[
                styles.cardPrompt,
                styles.cardPromptOneScreen,
                { color: palette.text },
              ]}
            >
              {currentCard.front.prompt}
            </Text>
          </View>
        </View>

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
              numberOfLines={supportLayer ? 1 : 2}
              style={[
                styles.cardSupport,
                { color: supportLayer?.tone ?? palette.text },
              ]}
            >
              {supportLayer?.title ?? currentCard.front.support}
            </Text>
            <Text
              numberOfLines={supportLayer ? 3 : 2}
              style={[styles.cardContext, { color: palette.textMuted }]}
            >
              {supportLayer?.body ?? currentCard.front.context}
            </Text>
          </View>
        ) : null}

        {currentResult ? (
          onOpenResultDetail ? (
            <ResultSummaryPanel
              card={currentCard}
              palette={palette}
              result={currentResult}
              onAdvanceCard={onAdvanceCard}
              onOpenResultDetail={onOpenResultDetail}
              isLastCard={currentIndex === sessionCards.length - 1}
            />
          ) : (
            <ResultPanel
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
              {
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
                numberOfLines={2}
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
            />
          </View>
        )}

        {!currentResult ? (
          <View
            style={[
              styles.oneScreenDock,
              isLockInteraction ? styles.oneScreenDockCompact : null,
            ]}
          >
            {shouldShowUtilityDock ? (
              <>
                <View style={styles.actionRow}>
                  <LightActionButton
                    label={currentCardState.isPeeked ? '收起线索' : '查看线索'}
                    onPress={onTogglePeek}
                    palette={palette}
                    testID="learning-peek-button"
                  />
                  {currentCard.hint_layer ? (
                    <LightActionButton
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
                    同盒位置已保持
                  </Text>
                </View>
              </>
            ) : null}
            {currentCard.interaction_id !== 'flip' ? (
              <Pressable
                disabled={!canSubmitCurrentCard}
                onPress={onSubmitCurrentCard}
                style={[
                  styles.primaryButton,
                  styles.oneScreenPrimaryButton,
                  {
                    backgroundColor: canSubmitCurrentCard
                      ? tone.accent
                      : palette.tabIdle,
                  },
                ]}
                testID="learning-submit-button"
              >
                <Text
                  style={[styles.primaryButtonLabel, { color: palette.panel }]}
                >
                  提交这张卡
                </Text>
              </Pressable>
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
  currentResult: LearningCardResult | null;
  palette: LearningSurfacePalette;
  onFlip: () => void;
  onSetFlipConfidence: (value: 'confident' | 'review') => void;
  onSelectOption: (optionId: string) => void;
  onSetLockSelection: (slotId: string, value: string) => void;
  onToggleEliminationItem: (itemId: string) => void;
  onSelectSwipeState: (stateId: string) => void;
}) {
  const libraryTone = resolveLibraryTone(card.space_metadata.library);
  const tone = {
    accent: libraryTone.accent,
    accentSoft: libraryTone.accentSoft,
  };

  switch (card.interaction_id) {
    case 'flip':
      return (
        <View style={styles.interactionBody}>
          {cardState.isFlipped ? (
            <View
              style={[
                styles.revealPanel,
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
                numberOfLines={4}
                style={[styles.revealText, { color: palette.text }]}
              >
                {card.back_text}
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={onFlip}
              style={[styles.primaryButton, { backgroundColor: tone.accent }]}
              testID="learning-flip-button"
            >
              <Text
                style={[styles.primaryButtonLabel, { color: palette.panel }]}
              >
                先翻面看答案
              </Text>
            </Pressable>
          )}

          {cardState.isFlipped && currentResult === null ? (
            <View style={styles.confidenceRow}>
              <Pressable
                onPress={() => onSetFlipConfidence('confident')}
                style={[
                  styles.choicePill,
                  styles.choicePillWide,
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
                onPress={() => onSetFlipConfidence('review')}
                style={[
                  styles.choicePill,
                  styles.choicePillWide,
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
        <View style={styles.interactionBody}>
          <View style={styles.optionGrid}>
            {card.options.map(option => {
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
                ? hexToRgba(tone.accent, 0.055)
                : palette.panel;
              const optionStateBorder = isCorrect
                ? hexToRgba(palette.success, 0.42)
                : isIncorrectSelection
                ? hexToRgba(palette.danger, 0.38)
                : isSelected
                ? hexToRgba(tone.accent, 0.42)
                : palette.border;
              const optionStateColor = isCorrect
                ? palette.success
                : isIncorrectSelection
                ? palette.danger
                : tone.accent;

              return (
                <Pressable
                  key={option.id}
                  onPress={() => onSelectOption(option.id)}
                  style={[
                    styles.optionCard,
                    isSelected ? styles.optionCardSelected : null,
                    {
                      backgroundColor: optionStateTint,
                      borderColor: optionStateBorder,
                    },
                  ]}
                  testID={`learning-option-${option.id}`}
                >
                  {isSelected ? (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.optionSelectedRail,
                        { backgroundColor: optionStateColor },
                      ]}
                    />
                  ) : null}
                  <View style={styles.optionHeaderRow}>
                    <View
                      style={[
                        styles.optionLetterBadge,
                        {
                          backgroundColor:
                            isSelected || isResolved
                              ? optionStateColor
                              : hexToRgba(tone.accent, 0.09),
                          borderColor:
                            isSelected || isResolved
                              ? optionStateColor
                              : hexToRgba(tone.accent, 0.18),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionLabel,
                          {
                            color:
                              isSelected || isResolved
                                ? palette.panel
                                : tone.accent,
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
                        已选择
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    numberOfLines={2}
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
        <View style={styles.interactionBody}>
          <View style={styles.lockList}>
            {card.lock_slots.map(slot => {
              const selectedValue = cardState.lockSelections[slot.id];
              const isUnlocked = Boolean(selectedValue);

              return (
                <View
                  key={slot.id}
                  style={[
                    styles.lockRow,
                    {
                      backgroundColor: isUnlocked
                        ? tone.accentSoft
                        : palette.panel,
                      borderColor: isUnlocked ? tone.accent : palette.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.lockGlyph,
                      {
                        backgroundColor: isUnlocked
                          ? tone.accent
                          : palette.panelStrong,
                        borderColor: isUnlocked ? tone.accent : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.lockGlyphLabel,
                        {
                          color: isUnlocked ? palette.panel : palette.textMuted,
                        },
                      ]}
                    >
                      {isUnlocked ? '开' : '锁'}
                    </Text>
                  </View>
                  <View style={styles.lockBody}>
                    <View style={styles.lockLabelRow}>
                      <Text style={[styles.lockLabel, { color: palette.text }]}>
                        {slot.label}
                      </Text>
                      <Text
                        style={[
                          styles.lockStatus,
                          {
                            color: isUnlocked ? tone.accent : palette.textMuted,
                          },
                        ]}
                      >
                        {isUnlocked ? '已开锁' : '待选择'}
                      </Text>
                    </View>
                    <View style={[styles.inlineWrap, styles.lockChoiceWrap]}>
                      {slot.options.map(option => {
                        const isSelected = selectedValue === option;

                        return (
                          <Pressable
                            key={option}
                            onPress={() => onSetLockSelection(slot.id, option)}
                            style={[
                              styles.choicePill,
                              styles.lockChoicePill,
                              {
                                backgroundColor: isSelected
                                  ? palette.panel
                                  : palette.panelStrong,
                                borderColor: isSelected
                                  ? tone.accent
                                  : palette.border,
                              },
                            ]}
                            testID={`learning-lock-${slot.id}-${toTestIdSegment(
                              option,
                            )}`}
                          >
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.choiceLabel,
                                styles.lockChoiceLabel,
                                {
                                  color: isSelected
                                    ? tone.accent
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
        <View style={styles.interactionBody}>
          <View style={styles.eliminationGrid}>
            {card.elimination_items.map(item => {
              const isSelected = cardState.eliminatedItemIds.includes(item.id);
              const isCorrect =
                currentResult !== null &&
                card.answer_key.correct_items.includes(item.id);

              return (
                <Pressable
                  key={item.id}
                  onPress={() => onToggleEliminationItem(item.id)}
                  style={[
                    styles.eliminationCard,
                    {
                      backgroundColor: isSelected
                        ? tone.accentSoft
                        : palette.panel,
                      borderColor: currentResult
                        ? isCorrect
                          ? palette.success
                          : isSelected
                          ? palette.danger
                          : palette.border
                        : isSelected
                        ? tone.accent
                        : palette.border,
                    },
                  ]}
                  testID={`learning-elimination-${item.id}`}
                >
                  {isSelected ? (
                    <View
                      style={[
                        styles.eliminationStrikeRail,
                        { backgroundColor: tone.accent },
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
                        { color: tone.accent },
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
        <View style={styles.swipeColumn}>
          <View style={styles.swipeDeck}>
            <View
              style={[
                styles.swipeGhostCard,
                styles.swipeGhostBack,
                { backgroundColor: palette.panel, borderColor: palette.border },
              ]}
            />
            <View
              style={[
                styles.swipeGhostCard,
                styles.swipeGhostMid,
                {
                  backgroundColor: palette.panelStrong,
                  borderColor: palette.border,
                },
              ]}
            />
            <View
              style={[
                styles.swipeTopCard,
                { backgroundColor: palette.panel, borderColor: tone.accent },
              ]}
            >
              <Text style={[styles.swipePromptLabel, { color: tone.accent }]}>
                当前判断
              </Text>
              <Text style={[styles.swipePromptText, { color: palette.text }]}>
                {card.front.prompt}
              </Text>
            </View>
          </View>
          <View style={styles.swipeTrailRow}>
            {card.swipe_states.map((state, index) => {
              const isSelected = cardState.swipeSelection === state.id;
              const isCorrect =
                currentResult !== null &&
                state.id === card.answer_key.correct_state;

              return (
                <Pressable
                  key={state.id}
                  onPress={() => onSelectSwipeState(state.id)}
                  style={[
                    styles.swipeTrailCard,
                    index === 0
                      ? styles.swipeTrailLeft
                      : styles.swipeTrailRight,
                    {
                      backgroundColor: isSelected
                        ? tone.accentSoft
                        : palette.panel,
                      borderColor: isCorrect
                        ? palette.success
                        : isSelected
                        ? tone.accent
                        : palette.border,
                    },
                  ]}
                  testID={`learning-swipe-${state.id}`}
                >
                  <Text style={[styles.swipeTrailHint, { color: tone.accent }]}>
                    {index === 0 ? '← 左划' : '右划 →'}
                  </Text>
                  <Text style={[styles.swipeLabel, { color: palette.text }]}>
                    {state.label}
                  </Text>
                  <Text
                    style={[styles.swipeText, { color: palette.textMuted }]}
                  >
                    {state.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    default:
      return null;
  }
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
  card,
  cardState,
  isLastCard,
  onAdvanceCard,
  onBackToPractice,
  palette,
  phase,
  result,
  sessionLabel,
}: {
  card: LearningCard;
  cardState: LearningCardState;
  isLastCard: boolean;
  onAdvanceCard: () => void;
  onBackToPractice: () => void;
  palette: LearningSurfacePalette;
  phase: 'learning' | 'review';
  result: LearningCardResult;
  sessionLabel: string;
}) {
  const displaySessionLabel = formatLearningSessionLabelForDisplay(
    sessionLabel,
    phase,
  );
  const resultTone = getResultTone(result, palette);
  const detailLibraryTone = resolveLibraryTone(card.space_metadata.library);
  const resolvedRows = getResolvedAnswerRows(card, cardState);
  const isPositive =
    result.outcome === 'correct' || result.outcome === 'confident';
  const detailActionTone = resultTone;
  const selectedAnswerRow = resolvedRows.find(
    row => row.testID === 'learning-detail-selected-answer',
  );

  return (
    <View
      style={[styles.oneScreenPage, styles.detailScreen]}
      testID="learning-result-detail-screen"
    >
      <View
        style={[
          styles.detailResolvedCard,
          styles.glassCard,
          {
            backgroundColor: palette.panel,
            borderColor: hexToRgba(resultTone, 0.18),
            shadowColor: resultTone,
          },
        ]}
      >
        <View style={styles.detailObjectHeader}>
          <View style={styles.heroChipRow}>
            <View
              pointerEvents="none"
              style={[
                styles.cardObjectAccent,
                { backgroundColor: detailLibraryTone.accent },
              ]}
            />
            <View style={styles.cardObjectHeaderText}>
              <Text
                style={[styles.learningFrameMeta, { color: palette.textMuted }]}
              >
                {phase === 'review' ? '回看答案' : '本卡答案'}
              </Text>
              <Text style={[styles.cardObjectLead, { color: palette.text }]}>
                当前卡 · {INTERACTION_LABELS[card.interaction_id]}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={onBackToPractice}
            style={[
              styles.detailCollapseButton,
              {
                backgroundColor: palette.panelStrong,
                borderColor: palette.border,
              },
            ]}
            testID="learning-result-back-button"
          >
            <Text
              style={[styles.detailCollapseLabel, { color: palette.textMuted }]}
            >
              卡面
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.detailResolvedHero,
            {
              backgroundColor: hexToRgba(resultTone, 0.035),
              borderColor: hexToRgba(resultTone, 0.12),
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
                {isPositive ? '答对，继续保持节奏' : '这张先收进回看'}
              </Text>
            </View>
            <Text
              numberOfLines={3}
              style={[styles.detailPrompt, { color: palette.text }]}
            >
              {card.front.prompt}
            </Text>
            {selectedAnswerRow ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.detailSelectedLine,
                  { color: palette.textMuted },
                ]}
              >
                {selectedAnswerRow.label}：{selectedAnswerRow.displayText}
              </Text>
            ) : null}
          </View>
        </View>

        <View
          style={[
            styles.detailAnswerSlip,
            {
              backgroundColor: palette.panelStrong,
              borderColor: hexToRgba(resultTone, 0.18),
              borderTopColor: resultTone,
            },
          ]}
        >
          <View style={styles.detailSlipHeader}>
            <View
              style={[styles.detailSlipDot, { backgroundColor: resultTone }]}
            />
            <View style={styles.detailSlipTitleWrap}>
              <Text style={[styles.detailOutcomeTitle, { color: resultTone }]}>
                {isPositive ? '答对' : '回看'}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.detailSlipCaption, { color: palette.textMuted }]}
              >
                解析贴在刚完成的卡后面
              </Text>
            </View>
          </View>

          <View style={styles.detailAnswerGrid}>
            {resolvedRows.map(row => (
              <View
                key={row.label}
                style={[
                  styles.detailAnswerCell,
                  {
                    backgroundColor:
                      row.tone === 'success'
                        ? hexToRgba(palette.success, 0.045)
                        : row.tone === 'warning'
                        ? hexToRgba(palette.warning, 0.065)
                        : palette.panel,
                    borderColor:
                      row.tone === 'success'
                        ? hexToRgba(palette.success, 0.15)
                        : row.tone === 'warning'
                        ? hexToRgba(palette.warning, 0.18)
                        : palette.border,
                  },
                ]}
                testID={
                  row.testID === 'learning-detail-selected-answer'
                    ? 'learning-detail-selected-answer'
                    : 'learning-detail-correct-answer'
                }
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.detailAnswerLabel,
                    { color: palette.textMuted },
                  ]}
                >
                  {row.label}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[styles.detailAnswerValue, { color: palette.text }]}
                >
                  {row.displayText}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={[
              styles.detailExplanationSlip,
              {
                backgroundColor: palette.panel,
                borderColor: palette.border,
              },
            ]}
          >
            <Text
              style={[styles.resultExplanationTitle, { color: palette.text }]}
            >
              {card.analysis.title}
            </Text>
            <Text
              numberOfLines={2}
              style={[
                styles.resultExplanationBody,
                { color: palette.textMuted },
              ]}
            >
              {card.analysis.summary}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.detailTip, { color: palette.textMuted }]}
            >
              过级提醒：{card.analysis.exam_tip}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.detailLocationShelf,
            {
              backgroundColor: hexToRgba(detailLibraryTone.accent, 0.03),
              borderColor: hexToRgba(detailLibraryTone.accent, 0.1),
            },
          ]}
        >
          <Text
            numberOfLines={1}
            style={[styles.detailLocationTitle, { color: palette.text }]}
          >
            已回到当前学习位置
          </Text>
          <View style={styles.detailNextHintRow}>
            <Text style={[styles.detailNextHint, { color: palette.textMuted }]}>
              {displaySessionLabel}里的位置已更新
            </Text>
            <Text style={[styles.detailNextHint, { color: palette.textMuted }]}>
              {isLastCard ? '本轮即将收束' : '下一张仍在本轮盒'}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onAdvanceCard}
          style={[
            styles.primaryButton,
            styles.detailPrimaryButton,
            { backgroundColor: detailActionTone },
          ]}
          testID="learning-next-button"
        >
          <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
            {isLastCard ? '完成本轮学习' : '继续下一张'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ResultSummaryPanel({
  card,
  palette,
  result,
  onAdvanceCard,
  onOpenResultDetail,
  isLastCard,
}: {
  card: LearningCard;
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
  const cardTone = resolveLibraryTone(card.space_metadata.library);
  const isPositive =
    result.outcome === 'correct' || result.outcome === 'confident';

  return (
    <View
      style={[
        styles.resultCard,
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
        已记录本次结果
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
          onPress={onAdvanceCard}
          style={[
            styles.primaryButton,
            styles.resultNextButton,
            { backgroundColor: cardTone.accent },
          ]}
          testID="learning-next-button"
        >
          <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
            {isLastCard ? '完成本轮学习' : '继续下一张'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ResultPanel({
  card,
  palette,
  result,
  onAdvanceCard,
  isLastCard,
}: {
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
  const cardTone = resolveLibraryTone(card.space_metadata.library);
  const isPositive =
    result.outcome === 'correct' || result.outcome === 'confident';

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
          已记录本次结果
        </Text>
        <Text style={[styles.settleText, { color: palette.textMuted }]}>
          你可以继续下一张；学习位置会跟着本轮节奏安静更新。
        </Text>
      </View>
      <Pressable
        onPress={onAdvanceCard}
        style={[styles.primaryButton, { backgroundColor: cardTone.accent }]}
        testID="learning-next-button"
      >
        <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
          {isLastCard ? '完成本轮学习' : '下一张'}
        </Text>
      </Pressable>
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
  label,
  onPress,
  palette,
  testID,
}: {
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

function toTestIdSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

const styles = StyleSheet.create({
  oneScreenPage: {
    flex: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  completeScreen: {
    justifyContent: 'center',
  },
  glassCard: {
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.14,
    shadowRadius: 34,
    elevation: 7,
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
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  detailCollapseLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailResolvedCard: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 9,
    overflow: 'hidden',
    paddingHorizontal: 15,
    paddingVertical: 15,
    position: 'relative',
  },
  detailResolvedHero: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 27,
  },
  detailSelectedLine: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  detailAnswerSlip: {
    borderRadius: 24,
    borderTopWidth: 3,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 13,
  },
  detailSlipHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  detailSlipDot: {
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  detailSlipTitleWrap: {
    flex: 1,
    gap: 1,
  },
  detailSlipCaption: {
    fontSize: 12,
    lineHeight: 17,
  },
  detailAnswerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  detailAnswerCell: {
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    minWidth: 138,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  detailAnswerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  detailAnswerValue: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  detailExplanationSlip: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 5,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 11,
    position: 'relative',
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
  detailLocationShelf: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  detailLocationTitle: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  detailNextHintRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  detailNextHint: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  detailPrimaryButton: {
    marginTop: 2,
    paddingVertical: 14,
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
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardAddressShelf: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardObjectAccent: {
    borderRadius: 999,
    height: 34,
    width: 5,
  },
  cardObjectHeaderText: {
    flex: 1,
    gap: 2,
  },
  cardObjectLead: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  cardProgressCluster: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    minWidth: 66,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  cardProgressCount: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 19,
  },
  cardLocationStrip: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 0,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    paddingVertical: 9,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  studyTitleWrap: {
    flex: 1,
    gap: 8,
  },
  cardEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  cardPrompt: {
    fontSize: 27,
    lineHeight: 35,
    fontWeight: '800',
  },
  cardPromptOneScreen: {
    fontSize: 20,
    lineHeight: 26,
  },
  contextCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 14,
    gap: 8,
  },
  contextCardSupportActive: {
    borderLeftWidth: 4,
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
  favoriteLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  lightActionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  attachedLayerPanel: {
    borderLeftWidth: 4,
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
    flexShrink: 1,
    gap: 10,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  interactionCardEmbedded: {
    backgroundColor: 'transparent',
    borderRadius: 18,
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
  revealPanel: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 6,
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
  confidenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  choiceLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  optionCard: {
    borderWidth: 1,
    borderRadius: 18,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 8,
    alignItems: 'flex-start',
    minHeight: 76,
    minWidth: '47%',
    overflow: 'hidden',
    paddingHorizontal: 13,
    paddingVertical: 11,
    position: 'relative',
  },
  optionCardSelected: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  optionSelectedRail: {
    bottom: 10,
    borderRadius: 999,
    left: 7,
    position: 'absolute',
    top: 10,
    width: 3,
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
  lockRow: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  lockGlyph: {
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  lockGlyphLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  lockBody: {
    flex: 1,
    gap: 5,
  },
  lockLabelRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
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
    borderRadius: 14,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  lockChoiceLabel: {
    fontSize: 11,
  },
  lockChoiceWrap: {
    flexWrap: 'nowrap',
    gap: 5,
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
  eliminationCard: {
    minWidth: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 20,
    gap: 8,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 16,
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
  swipeDeck: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 116,
  },
  swipeGhostCard: {
    borderWidth: 1,
    borderRadius: 20,
    height: 92,
    position: 'absolute',
    width: '78%',
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
  swipeTrailCard: {
    flex: 1,
    minWidth: 140,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 8,
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
    letterSpacing: 0.7,
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
    fontSize: 14,
    fontWeight: '700',
  },
  swipeText: {
    fontSize: 12,
    lineHeight: 17,
  },
  primaryButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oneScreenDock: {
    gap: 8,
    marginTop: 1,
  },
  oneScreenDockCompact: {
    gap: 0,
  },
  oneScreenPrimaryButton: {
    paddingVertical: 13,
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
