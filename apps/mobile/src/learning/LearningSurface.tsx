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
  onAdvanceCard: () => void;
  onRestartDeck: () => void;
  onStartReview?: () => void;
};

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
            {isReviewPhase ? 'REVIEW FLOW' : 'SINGLE CARD FLOW'}
          </Text>
          <Text style={[styles.heroTitle, { color: palette.text }]}>
            {isReviewPhase ? '本轮回看已走完' : '本轮卡源已走完'}
          </Text>
          <Text style={[styles.heroSummary, { color: palette.textMuted }]}>
            {isReviewPhase
              ? `这轮从${sessionLabel}里回看了 ${sessionCards.length} 张卡，把“需要回看”的部分收成一次低成本复习。`
              : `当前分支从${sessionLabel}首轮抽出 ${sessionCards.length} 张卡，把学习主路径、核心交互和最小出卡规则串起来。`}
          </Text>
          <View style={styles.metricWrap}>
            <MetricPill
              label="完成"
              value={`${summary.completed}/${summary.total}`}
              palette={palette}
            />
            <MetricPill
              label="自动判对"
              value={`${summary.autoCorrectCount}`}
              palette={palette}
              tone="success"
            />
            <MetricPill
              label="自动判错"
              value={`${summary.autoIncorrectCount}`}
              palette={palette}
              tone="danger"
            />
            <MetricPill
              label="翻面有把握"
              value={`${summary.confidentFlipCount}`}
              palette={palette}
            />
            <MetricPill
              label="翻面回看"
              value={`${summary.reviewFlipCount}`}
              palette={palette}
            />
            <MetricPill
              label="提示层"
              value={`${summary.hintUseCount}`}
              palette={palette}
            />
            <MetricPill
              label="Peek"
              value={`${summary.peekUseCount}`}
              palette={palette}
            />
            <MetricPill
              label="收藏"
              value={`${summary.favoriteCount}`}
              palette={palette}
            />
          </View>
        </View>

        <View style={styles.detailGrid}>
          <InfoGlassCard
            palette={palette}
            title={isReviewPhase ? '这轮回看落实了什么' : '这一步落实了什么'}
            lines={
              isReviewPhase
                ? [
                    '首轮里自动判错和翻面回看的卡，被收成一轮独立回看。',
                    '复习仍然沿用单卡推进，不改成高成本列表管理。',
                    '已有交互、提示层和轻量动作会完整保留到回看阶段。',
                  ]
                : [
                    '学习入口不再是说明页，而是已登录后即可进入的单卡流。',
                    '本地测试卡覆盖 5 个核心交互，提示层附着在具体卡上出现。',
                    'Peek 和收藏保持轻量，不抢占答题动作。',
                  ]
            }
          />
          <InfoGlassCard
            palette={palette}
            title={isReviewPhase ? '这轮回看仍没做什么' : '还没有做什么'}
            lines={
              isReviewPhase
                ? [
                    '没有接真实调度算法，只用了本地 review 队列。',
                    '没有把回看扩成独立顶层入口或复杂进度面板。',
                    '没有把同步、会员或统计合同提前带进来。',
                  ]
                : [
                    '没有接学习算法、真实卡池和跨端同步。',
                    '没有把音频单独拉成一类交互。',
                    '没有把统计或复杂状态机抬成产品中心。',
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
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            完成明细
          </Text>
          {completedResults.map(result => (
            <View
              key={result.cardId}
              style={[
                styles.resultRow,
                {
                  borderBottomColor: palette.border,
                },
              ]}
            >
              <View style={styles.resultCopy}>
                <Text style={[styles.resultTitle, { color: palette.text }]}>
                  {INTERACTION_LABELS[result.interactionId]}
                </Text>
                <Text style={[styles.resultMeta, { color: palette.textMuted }]}>
                  {result.cardId}
                </Text>
              </View>
            <ResultBadge outcome={result.outcome} palette={palette} />
          </View>
        ))}
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
              {isReviewPhase ? '回到首轮重新开始' : '再跑一轮当前卡源'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  const tone = resolveLibraryTone(currentCard.space_metadata.library);
  const progressPercent = `${Math.max(
    Math.round(((currentIndex + 1) / Math.max(sessionCards.length, 1)) * 100),
    10,
  )}%` as DimensionValue;

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
            <TagChip
              label={`${currentCard.space_metadata.library} · ${currentCard.space_metadata.group}`}
              toneColor={tone.accent}
            />
            {isReviewPhase ? (
              <TagChip label="回看队列" toneColor={palette.warning} />
            ) : null}
          </View>
          <Text style={[styles.learningFrameMeta, { color: palette.textMuted }]}>
            {currentCard.track.toUpperCase()} · {currentIndex + 1}/
            {sessionCards.length}
          </Text>
        </View>
        <Text style={[styles.learningFrameSummary, { color: palette.textMuted }]}>
          {sessionLabel} ·{' '}
          {isReviewPhase
            ? '把需要回看的卡单独再刷一轮'
            : '单卡推进，不把学习入口做成按钮堆'}
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
              当前卡 · {currentCard.card_id} ·{' '}
              {INTERACTION_LABELS[currentCard.interaction_id]}
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
              action plane
            </Text>
          </View>
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

        <View style={styles.actionRow}>
          <LightActionButton
            label={currentCardState.isPeeked ? '收起 Peek' : 'Peek 卡位'}
            onPress={onTogglePeek}
            palette={palette}
            testID="learning-peek-button"
          />
          {currentCard.hint_layer ? (
            <LightActionButton
              label={
                currentCardState.isHintVisible
                  ? '收起提示层'
                  : currentCard.hint_layer.label
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
              {currentCardState.isFavorited ? '已收藏' : 'favorite'}
            </Text>
          </Pressable>
        </View>

        {currentCardState.isPeeked ? (
          <View
            style={[
              styles.peekPanel,
              {
                backgroundColor: tone.accentSoft,
                borderColor: tone.accent,
              },
            ]}
          >
            <Text style={[styles.peekTitle, { color: palette.text }]}>
              这张卡为什么出现
            </Text>
            <Text style={[styles.peekText, { color: palette.textMuted }]}>
              knowledge_ref: {currentCard.knowledge_ref}
            </Text>
            <Text style={[styles.peekText, { color: palette.textMuted }]}>
              位置: {currentCard.space_metadata.library} /{' '}
              {currentCard.space_metadata.group} /{' '}
              {currentCard.space_metadata.box}
            </Text>
          </View>
        ) : null}

        {currentCard.hint_layer && currentCardState.isHintVisible ? (
          <View
            style={[
              styles.hintPanel,
              {
                backgroundColor: palette.panelStrong,
                borderColor: palette.border,
              },
            ]}
          >
            <Text style={[styles.hintTitle, { color: tone.accent }]}>
              {currentCard.hint_layer.reveal_gesture}
              出提示层
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
            {currentCard.track.toUpperCase()} /{' '}
            {currentCard.space_metadata.library} /{' '}
            {currentCard.space_metadata.group} /{' '}
            {currentCard.space_metadata.box}
          </Text>
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
  const tone = resolveLibraryTone(card.space_metadata.library);

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
          {card.lock_slots.map(slot => (
            <View
              key={slot.id}
              style={[
                styles.lockRow,
                { backgroundColor: palette.panel, borderColor: palette.border },
              ]}
            >
              <View
                style={[
                  styles.lockGlyph,
                  {
                    backgroundColor: cardState.lockSelections[slot.id]
                      ? tone.accentSoft
                      : palette.panelStrong,
                    borderColor: cardState.lockSelections[slot.id]
                      ? tone.accent
                      : palette.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.lockGlyphLabel,
                    {
                      color: cardState.lockSelections[slot.id]
                        ? tone.accent
                        : palette.textMuted,
                    },
                  ]}
                >
                  锁
                </Text>
              </View>
              <View style={styles.lockBody}>
                <Text style={[styles.lockLabel, { color: palette.text }]}>
                  {slot.label}
                </Text>
                <View style={styles.inlineWrap}>
                  {slot.options.map(option => {
                    const isSelected =
                      cardState.lockSelections[slot.id] === option;

                    return (
                      <Pressable
                        key={option}
                        onPress={() => onSetLockSelection(slot.id, option)}
                        style={[
                          styles.choicePill,
                          {
                            backgroundColor: isSelected
                              ? tone.accentSoft
                              : palette.panel,
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
                          style={[styles.choiceLabel, { color: palette.text }]}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          ))}
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
      <Pressable
        onPress={onAdvanceCard}
        style={[styles.primaryButton, { backgroundColor: palette.accent }]}
        testID="learning-next-button"
      >
        <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
          {isLastCard ? '完成测试卡' : '下一张'}
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
  lockLabel: {
    fontSize: 14,
    fontWeight: '700',
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
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  eliminationText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  eliminationTextStruck: {
    textDecorationLine: 'line-through',
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
