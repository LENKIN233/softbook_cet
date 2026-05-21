import React, { useEffect, useRef } from 'react';
import type { DimensionValue } from 'react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
import {
  formatSpaceBoxLabel,
  formatSpaceGroupLabel,
  formatSpaceLibraryLabel,
} from '../shared/uiMetadata/displayMetadata';

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
  onAdvanceCard: () => void;
  onRestartDeck: () => void;
  onStartReview?: () => void;
};

function formatLearningSpaceAddress(card: LearningCard, sessionCards: LearningCard[]) {
  const libraryNames = uniqueValues(
    sessionCards.map(sessionCard => sessionCard.space_metadata.library),
  );
  const libraryIndex = indexOrOne(libraryNames, card.space_metadata.library);
  const libraryCards = sessionCards.filter(
    sessionCard =>
      sessionCard.space_metadata.library === card.space_metadata.library,
  );
  const groupNames = uniqueValues(
    libraryCards.map(sessionCard => sessionCard.space_metadata.group),
  );
  const groupIndex = indexOrOne(groupNames, card.space_metadata.group);
  const groupCards = libraryCards.filter(
    sessionCard => sessionCard.space_metadata.group === card.space_metadata.group,
  );
  const boxRefs = uniqueValues(
    groupCards.map(sessionCard => sessionCard.space_metadata.box_ref),
  );
  const boxIndex = indexOrOne(boxRefs, card.space_metadata.box_ref);

  return `${formatSpaceLibraryLabel(libraryIndex)} / ${formatSpaceGroupLabel(
    groupIndex,
  )} / ${formatSpaceBoxLabel(boxIndex)}`;
}

function uniqueValues(values: string[]) {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function indexOrOne(values: string[], value: string) {
  const index = values.indexOf(value);
  return index >= 0 ? index + 1 : 1;
}

function formatLearningSessionLabelForDisplay(
  sessionLabel: string,
  phase: 'learning' | 'review',
) {
  const trimmedLabel = sessionLabel.trim();
  const exposesSourceMetadata = /系统顺序|卡源|catalog|卡组/i.test(trimmedLabel);

  if (!trimmedLabel || exposesSourceMetadata) {
    return phase === 'review' ? '这组回看卡' : '这一组学习卡';
  }

  return trimmedLabel;
}

function formatLearningActionCue(
  card: LearningCard,
  currentResult: LearningCardResult | null,
) {
  if (currentResult) {
    return '结果已经收好，可以继续下一张。';
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
  onAdvanceCard,
  onRestartDeck,
  onStartReview,
}: LearningSurfaceProps) {
  const isReviewPhase = phase === 'review';
  const displaySessionLabel = formatLearningSessionLabelForDisplay(
    sessionLabel,
    phase,
  );
  const currentCardScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    currentCardScrollRef.current?.scrollTo({ animated: false, y: 0 });
  }, [currentCard?.card_id, currentIndex, phase]);

  if (currentCard === null || currentCardState === null) {
    const summary = summarizeLearningResults(
      completedResults,
      sessionCards.length,
    );

    return (
      <ScrollView contentContainerStyle={styles.page}>
        <View
          style={[
            styles.heroCard,
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

        <View style={styles.detailGrid}>
          <InfoGlassCard
            palette={palette}
            title={isReviewPhase ? '回看已经收好' : '这一轮已经收好'}
            lines={
              isReviewPhase
                ? [
                    '需要再看的卡已经重新过了一遍。',
                    '仍不稳的点会留在后续学习里自然出现。',
                    '现在可以回到首轮，按学习节奏继续。',
                  ]
                : [
                    '这一组已经按学习节奏走完。',
                    '需要再看的卡已经被收进回看，不要求你管理列表。',
                    '想确认位置时，再去空间查看对应知识盒。',
                  ]
            }
          />
        </View>

        <View
          style={[
            styles.resultCard,
            {
              backgroundColor: palette.panel,
              borderColor: palette.border,
            },
          ]}
          testID="learning-complete-details"
        >
          <Text style={[styles.sectionTitle, { color: palette.text }]}>下一步</Text>
          <Text style={[styles.resultExplanationBody, { color: palette.textMuted }]}>
            {isReviewPhase
              ? '回看已经结束。可以回到首轮重新开始，也可以稍后按学习节奏继续。'
              : reviewCandidateCount > 0
                ? `先回看这 ${reviewCandidateCount} 张卡，再继续新一轮学习。`
                : '这一轮已经完成，可以再练一轮这一组。'}
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
              {isReviewPhase ? '回到首轮重新开始' : '再练一轮这一组'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  const tone = { accent: palette.accent, accentSoft: palette.accentSoft };
  const progressPercent = `${Math.max(
    Math.round(((currentIndex + 1) / Math.max(sessionCards.length, 1)) * 100),
    10,
  )}%` as DimensionValue;
  const safeProgress = `${currentIndex + 1}/${sessionCards.length}`;
  const spaceAddress = formatLearningSpaceAddress(currentCard, sessionCards);
  const actionCue = formatLearningActionCue(currentCard, currentResult);

  return (
    <ScrollView ref={currentCardScrollRef} contentContainerStyle={styles.page}>
      <View
        style={[
          styles.learningFrameHeader,
          styles.glassCard,
          {
            backgroundColor: palette.panel,
            borderColor: palette.border,
            shadowColor: tone.accent,
          },
        ]}
      >
        <View style={styles.learningFrameTop}>
          <View style={styles.heroChipRow}>
            <TagChip label="先做这一张" toneColor={tone.accent} />
            {isReviewPhase ? (
              <TagChip label="回看这一组" toneColor={palette.warning} />
            ) : null}
          </View>
          <Text style={[styles.learningFrameMeta, { color: palette.textMuted }]}> 
            本组第 {safeProgress} 张
          </Text>
        </View>
        <Text style={[styles.learningFrameSummary, { color: palette.textMuted }]}>
          {displaySessionLabel} ·{' '}
          {isReviewPhase
            ? '回看需要再看的卡，仍按一张卡推进'
            : '先完成这一张，再继续下一步'}
        </Text>
        <View
          style={[
            styles.progressTrack,
            { backgroundColor: palette.panelStrong, borderColor: palette.border },
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

      <View
        style={[
          styles.studyCard,
          styles.glassCard,
          {
            backgroundColor: palette.panel,
            borderColor: tone.accent,
            shadowColor: tone.accent,
          },
        ]}
        testID="learning-current-card"
      >
        <View style={styles.studyCardTop}>
          <View style={styles.studyTitleWrap}>
            <Text style={[styles.cardEyebrow, { color: tone.accent }]}>
              这张练习 · {INTERACTION_LABELS[currentCard.interaction_id]}
            </Text>
            <Text style={[styles.cardPrompt, { color: palette.text }]}>
              {currentCard.front.prompt}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.contextCard,
            { backgroundColor: palette.panelStrong, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.cardSupport, { color: palette.text }]}>
            {currentCard.front.support}
          </Text>
          <Text style={[styles.cardContext, { color: palette.textMuted }]}>
            {currentCard.front.context}
          </Text>
        </View>

        <View
          style={[
            styles.interactionCard,
            {
              backgroundColor: palette.panelStrong,
              borderColor: palette.border,
            },
          ]}
        >
          <View style={styles.interactionTitleRow}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              {INTERACTION_LABELS[currentCard.interaction_id]}
            </Text>
            <Text style={[styles.interactionMeta, { color: palette.textMuted }]}>
              答题区
            </Text>
          </View>
          <Text
            style={[styles.actionCue, { color: palette.textMuted }]}
            testID="learning-action-cue"
          >
            {actionCue}
          </Text>
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

        {currentResult ? (
          <ResultPanel
            card={currentCard}
            palette={palette}
            result={currentResult}
            onAdvanceCard={onAdvanceCard}
            isLastCard={currentIndex === sessionCards.length - 1}
          />
        ) : currentCard.interaction_id !== 'flip' ? (
          <Pressable
            disabled={!canSubmitLearningCard(currentCard, currentCardState)}
            onPress={onSubmitCurrentCard}
            style={[
              styles.primaryButton,
              {
                backgroundColor: canSubmitLearningCard(
                  currentCard,
                  currentCardState,
                )
                  ? tone.accent
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

        {currentCardState.isPeeked ? (
          <View
            style={[
              styles.attachedLayerPanel,
              styles.peekPanel,
              {
                backgroundColor: tone.accentSoft,
                borderColor: tone.accent,
                borderLeftColor: tone.accent,
              },
            ]}
          >
            <Text style={[styles.peekTitle, { color: palette.text }]}>
              先看这张卡的关键点
            </Text>
            <Text style={[styles.peekText, { color: palette.textMuted }]}> 
              先把题干里的信号抓出来，再回到选项或解析确认。
            </Text>
          </View>
        ) : null}

        {currentCard.hint_layer && currentCardState.isHintVisible ? (
          <View
            style={[
              styles.attachedLayerPanel,
              styles.hintPanel,
              {
                backgroundColor: tone.accentSoft,
                borderColor: tone.accent,
                borderLeftColor: tone.accent,
              },
            ]}
          >
            <Text style={[styles.hintTitle, { color: tone.accent }]}>
              提示
            </Text>
            <Text style={[styles.hintText, { color: palette.textMuted }]}>
              {currentCard.hint_layer.content}
            </Text>
          </View>
        ) : null}

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
            当前位置：{spaceAddress}
          </Text>
        </View>

      </View>
    </ScrollView>
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
              <Text style={[styles.revealText, { color: palette.text }]}>
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
                  <Text style={[styles.optionText, { color: palette.text }]}>
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
          <Text style={[styles.inlineHelper, { color: palette.textMuted }]}>
            三个槽位都对，主干才算开锁。
          </Text>
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
                  <View style={styles.inlineWrap}>
                    {slot.options.map(option => {
                      const isSelected = selectedValue === option;

                      return (
                        <Pressable
                          key={option}
                          onPress={() => onSetLockSelection(slot.id, option)}
                          style={[
                            styles.choicePill,
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
                            style={[
                              styles.choiceLabel,
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
          <Text style={[styles.inlineHelper, { color: palette.textMuted }]}>
            点亮你想剥离的成分。
          </Text>
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

function InfoGlassCard({
  palette,
  title,
  lines,
}: {
  palette: LearningSurfacePalette;
  title: string;
  lines: string[];
}) {
  return (
    <View
      style={[
        styles.infoCard,
        {
          backgroundColor: palette.panel,
          borderColor: palette.border,
        },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: palette.text }]}>
        {title}
      </Text>
      {lines.map(line => (
        <View key={line} style={styles.infoLine}>
          <View style={[styles.infoDot, { backgroundColor: palette.accent }]} />
          <Text style={[styles.infoText, { color: palette.textMuted }]}>
            {line}
          </Text>
        </View>
      ))}
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
  page: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 16,
  },
  glassCard: {
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 6,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    gap: 14,
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
    borderRadius: 28,
    padding: 16,
    gap: 10,
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
    height: 10,
    borderWidth: 1,
    borderRadius: 999,
    overflow: 'hidden',
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
    padding: 20,
    gap: 18,
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
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '800',
  },
  contextCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    gap: 8,
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
    padding: 16,
    gap: 12,
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
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  interactionBody: {
    gap: 12,
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
    gap: 10,
  },
  optionCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 10,
    minWidth: '47%',
    flexGrow: 1,
    alignItems: 'flex-start',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  lockGroup: {
    gap: 10,
  },
  lockList: {
    gap: 12,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
  },
  lockGlyph: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockGlyphLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  lockBody: {
    flex: 1,
    gap: 10,
  },
  lockLabelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  lockLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  lockStatus: {
    fontSize: 12,
    fontWeight: '800',
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
    gap: 14,
  },
  swipeDeck: {
    minHeight: 176,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeGhostCard: {
    position: 'absolute',
    width: '82%',
    height: 132,
    borderWidth: 1,
    borderRadius: 24,
  },
  swipeGhostBack: {
    transform: [{translateX: -22}, {translateY: 6}],
  },
  swipeGhostMid: {
    transform: [{translateX: 22}, {translateY: -2}],
  },
  swipeTopCard: {
    width: '88%',
    minHeight: 144,
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 20,
    justifyContent: 'center',
    gap: 10,
  },
  swipePromptLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  swipePromptText: {
    fontSize: 18,
    lineHeight: 26,
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
    gap: 12,
  },
  swipeStateCard: {
    flex: 1,
    minWidth: 140,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 8,
  },
  swipeLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  swipeText: {
    fontSize: 14,
    lineHeight: 21,
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
  resultCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
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
  detailGrid: {
    gap: 12,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 10,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 6,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
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
