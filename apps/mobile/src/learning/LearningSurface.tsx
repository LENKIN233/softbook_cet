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
          <Text style={[styles.resultExplanationTitle, { color: palette.text }]}>
            {isReviewPhase ? '回看已经收好' : '这一轮已经收好'}
          </Text>
          <Text style={[styles.resultExplanationBody, { color: palette.textMuted }]}>
            {isReviewPhase
              ? '仍不稳的点会留在后续学习里自然出现。'
              : '需要再看的卡已经收进回看，不要求你管理列表。'}
          </Text>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>下一步</Text>
          <Text style={[styles.resultExplanationBody, { color: palette.textMuted }]}>
            {isReviewPhase
              ? '回看已经结束。可以回到首轮重新开始，也可以稍后按学习节奏继续。'
              : reviewCandidateCount > 0
                ? `先回看这 ${reviewCandidateCount} 张卡，再继续新一轮学习。`
                : '这一轮已经完成，可以重新练这轮卡。'}
          </Text>
          {!isReviewPhase && reviewCandidateCount > 0 && onStartReview ? (
            <Pressable
              onPress={onStartReview}
              style={[styles.primaryButton, { backgroundColor: palette.accentStrong }]}
              testID="learning-start-review-button"
            >
              <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
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

  const tone = { accent: palette.accent, accentSoft: palette.accentSoft };
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

    if (currentCardState.isPeeked && currentCard.hint_layer?.content && currentCardState.isHintVisible) {
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
  const shouldShowContextCard =
    currentResult === null &&
    !isDenseInteraction &&
    currentCard.interaction_id === 'flip' &&
    !(currentCard.interaction_id === 'flip' && currentCardState.isFlipped);
  const shouldShowUtilityDock =
    currentCard.interaction_id === 'flip' && !isDenseInteraction;

  return (
    <View style={styles.oneScreenPage} testID="learning-one-screen-flow">
      <View
        style={[
          styles.studyCard,
          styles.studyCardOneScreen,
          styles.glassCard,
          {
            backgroundColor: palette.panel,
            borderColor: hexToRgba(tone.accent, 0.42),
            shadowColor: palette.text,
          },
        ]}
        testID="learning-current-card"
      >
        <View
          pointerEvents="none"
          style={[
            styles.paperSpine,
            { backgroundColor: hexToRgba(tone.accent, 0.18) },
          ]}
        />
        <View pointerEvents="none" style={styles.paperLineOne} />
        <View pointerEvents="none" style={styles.paperLineTwo} />
        <View pointerEvents="none" style={styles.paperLineThree} />
        <View
          style={styles.cardAddressShelf}
          testID="learning-card-address-shelf"
        >
          <View style={styles.heroChipRow}>
            <TagChip label="先做这一张" toneColor={tone.accent} />
            <TagChip
              label={isReviewPhase ? '本轮回看' : displaySessionLabel}
              toneColor={isReviewPhase ? palette.warning : palette.success}
            />
          </View>
          <View
            style={[
              styles.cardProgressCluster,
              {
                backgroundColor: palette.panelStrong,
                borderColor: hexToRgba(tone.accent, 0.18),
              },
            ]}
          >
            <Text
              style={[styles.learningFrameMeta, { color: palette.textMuted }]}
              testID="learning-progress-label"
            >
              当前练习
            </Text>
            <Text
              style={[styles.cardProgressCount, { color: palette.text }]}
              testID="learning-progress-count"
            >
              {progressCount}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.cardLocationStrip,
            {
              backgroundColor: hexToRgba(tone.accent, 0.055),
              borderColor: hexToRgba(tone.accent, 0.16),
            },
          ]}
          testID="learning-card-location-strip"
        >
          <View style={styles.cardLocationTextWrap}>
            <Text
              numberOfLines={1}
              style={[styles.cardLocationTitle, { color: palette.text }]}
            >
              当前馆 · 本轮盒
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.cardLocationMeta, { color: palette.textMuted }]}
            >
              {isReviewPhase
                ? '回看需要再看的卡，仍按一张卡推进'
                : '先完成这一张，再继续下一步'}
            </Text>
          </View>
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
        <View style={styles.studyCardTop}>
          <View style={styles.studyTitleWrap}>
            <Text style={[styles.cardEyebrow, { color: tone.accent }]}>
              当前卡 · {INTERACTION_LABELS[currentCard.interaction_id]}
            </Text>
            <Text
              numberOfLines={isDenseInteraction ? 2 : 4}
              style={[styles.cardPrompt, styles.cardPromptOneScreen, { color: palette.text }]}
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
              { backgroundColor: palette.panelStrong, borderColor: palette.border },
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
            <View style={styles.interactionTitleRow}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                {INTERACTION_LABELS[currentCard.interaction_id]}
              </Text>
              <Text style={[styles.interactionMeta, { color: palette.textMuted }]}>
                现在做
              </Text>
            </View>
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
          {currentCard.interaction_id !== 'flip' ? (
            <Pressable
              disabled={!canSubmitCurrentCard}
              onPress={onSubmitCurrentCard}
              style={[
                styles.primaryButton,
                styles.oneScreenPrimaryButton,
                {
                  backgroundColor: canSubmitCurrentCard
                    ? palette.accentStrong
                    : palette.tabIdle,
                },
              ]}
              testID="learning-submit-button"
            >
              <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
                提交这张卡
              </Text>
            </Pressable>
          ) : null}
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
                      currentCardState.isHintVisible
                        ? '收起提示'
                        : '查看提示'
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
                <Text style={[styles.addressText, { color: palette.textMuted }]}>
                  位置已收在知识空间
                </Text>
              </View>
            </>
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
  const tone = { accent: palette.accent, accentSoft: palette.accentSoft };

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
                    backgroundColor: hexToRgba(SELF_ASSESS_COLORS.confident, 0.12),
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

              return (
                <Pressable
                  key={option.id}
                  onPress={() => onSelectOption(option.id)}
                  style={[
                    styles.optionCard,
                    isSelected ? styles.optionCardSelected : null,
                    {
                      backgroundColor: isSelected
                        ? tone.accentSoft
                        : palette.panel,
                      borderColor: isCorrect
                        ? palette.success
                        : isIncorrectSelection
                        ? palette.danger
                        : isSelected
                        ? tone.accent
                        : palette.border,
                    },
                  ]}
                  testID={`learning-option-${option.id}`}
                >
                  <Text style={[styles.optionLabel, { color: tone.accent }]}>
                    {option.label}
                  </Text>
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
                      { color: isUnlocked ? palette.panel : palette.textMuted },
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
                        { color: isUnlocked ? tone.accent : palette.textMuted },
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
                                color: isSelected ? tone.accent : palette.text,
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
                      backgroundColor: isSelected ? tone.accentSoft : palette.panel,
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
                { backgroundColor: palette.panelStrong, borderColor: palette.border },
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
                    index === 0 ? styles.swipeTrailLeft : styles.swipeTrailRight,
                    {
                      backgroundColor: isSelected ? tone.accentSoft : palette.panel,
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
                  <Text style={[styles.swipeText, { color: palette.textMuted }]}>
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

export function LearningResultDetailSurface({
  card,
  isLastCard,
  onAdvanceCard,
  onBackToPractice,
  palette,
  phase,
  result,
  sessionLabel,
}: {
  card: LearningCard;
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

  return (
    <View
      style={styles.oneScreenPage}
      testID="learning-result-detail-screen"
    >
      <View
        style={[
          styles.learningFrameHeader,
          styles.glassCard,
          {
            backgroundColor: palette.panel,
            borderColor: palette.border,
            shadowColor: palette.accent,
          },
        ]}
      >
        <View style={styles.learningFrameTop}>
          <View style={styles.heroChipRow}>
            <TagChip label="解析详情" toneColor={palette.accent} />
            <TagChip
              label={phase === 'review' ? '本轮回看' : '本轮学习'}
              toneColor={phase === 'review' ? palette.warning : palette.success}
            />
          </View>
          <Pressable
            onPress={onBackToPractice}
            style={[
              styles.secondaryButton,
              {
                backgroundColor: palette.panelStrong,
                borderColor: palette.border,
              },
            ]}
            testID="learning-result-back-button"
          >
            <Text style={[styles.secondaryButtonLabel, { color: palette.text }]}>
              返回练习
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.learningFrameSummary, { color: palette.textMuted }]}>
          {displaySessionLabel} · 解析是独立一步，读完后再进入下一张。
        </Text>
      </View>

      <ResultPanel
        card={card}
        isLastCard={isLastCard}
        onAdvanceCard={onAdvanceCard}
        palette={palette}
        result={result}
      />
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
      <View
        pointerEvents="none"
        style={[
          styles.paperSpine,
          { backgroundColor: hexToRgba(borderTone, 0.18) },
        ]}
      />
      <View pointerEvents="none" style={styles.paperLineOne} />
      <View pointerEvents="none" style={styles.paperLineTwo} />
      <View style={styles.resultHeader}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          {isPositive ? '这张卡已稳住' : '这张卡需要回看'}
        </Text>
        <ResultBadge outcome={result.outcome} palette={palette} />
      </View>
      <Text style={[styles.resultExplanationTitle, { color: palette.text }]}>
        已记录本次结果
      </Text>
      <Text style={[styles.resultExplanationBody, { color: palette.textMuted }]}>
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
            { backgroundColor: palette.accent },
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
      <View
        pointerEvents="none"
        style={[
          styles.paperSpine,
          { backgroundColor: hexToRgba(borderTone, 0.18) },
        ]}
      />
      <View pointerEvents="none" style={styles.paperLineOne} />
      <View pointerEvents="none" style={styles.paperLineTwo} />
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
        style={[styles.primaryButton, { backgroundColor: palette.accent }]}
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
      <Text
        style={[
          styles.resultBadgeLabel,
          { color: badgeTone },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function TagChip({ label, toneColor }: { label: string; toneColor: string }) {
  return (
    <View
      style={[
        styles.tagChip,
        styles.tagChipBase,
        {
          borderColor: toneColor,
        },
      ]}
    >
      <Text style={[styles.tagChipLabel, { color: toneColor }]}>{label}</Text>
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
  progressTrack: {
    height: 8,
    borderWidth: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  cardProgressTrack: {
    borderRadius: 999,
    borderWidth: 1,
    height: 10,
    overflow: 'hidden',
    width: 58,
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
    borderRadius: 32,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingVertical: 22,
    gap: 16,
    position: 'relative',
  },
  studyCardOneScreen: {
    flex: 1,
    gap: 11,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  paperSpine: {
    bottom: 0,
    left: 30,
    opacity: 1,
    position: 'absolute',
    top: 0,
    width: 1,
  },
  paperLineOne: {
    backgroundColor: 'rgba(47,70,80,0.08)',
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 118,
  },
  paperLineTwo: {
    backgroundColor: 'rgba(47,70,80,0.08)',
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 222,
  },
  paperLineThree: {
    backgroundColor: 'rgba(47,70,80,0.08)',
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 326,
  },
  cardAddressShelf: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardProgressCluster: {
    alignItems: 'flex-end',
    borderRadius: 18,
    borderWidth: 1,
    minWidth: 78,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cardProgressCount: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 21,
  },
  cardLocationStrip: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardLocationTextWrap: {
    flex: 1,
    gap: 3,
  },
  cardLocationTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardLocationMeta: {
    fontSize: 12,
    fontWeight: '600',
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
    letterSpacing: 0.8,
  },
  cardPrompt: {
    fontSize: 27,
    lineHeight: 35,
    fontWeight: '800',
  },
  cardPromptOneScreen: {
    fontSize: 23,
    lineHeight: 30,
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
    gap: 10,
  },
  lightActionButton: {
    borderWidth: 1,
    borderRadius: 999,
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
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: 'center',
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
    gap: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  interactionCardEmbedded: {
    backgroundColor: 'transparent',
    borderRadius: 20,
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
    gap: 8,
  },
  optionCard: {
    borderWidth: 1,
    borderRadius: 18,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 7,
    alignItems: 'flex-start',
    minHeight: 84,
    minWidth: '47%',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  optionCardSelected: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
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
    transform: [{translateX: -22}, {translateY: 6}],
  },
  swipeGhostMid: {
    transform: [{translateX: 22}, {translateY: -2}],
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
    transform: [{translateX: -2}],
  },
  swipeTrailRight: {
    transform: [{translateX: 2}],
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
    gap: 9,
    marginTop: 'auto',
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
  tagChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tagChipBase: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  tagChipLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
