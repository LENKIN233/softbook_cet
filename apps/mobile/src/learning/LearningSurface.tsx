import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  canSubmitLearningCard,
  INTERACTION_LABELS,
  LEARNING_TEST_CARDS,
  LearningCard,
  LearningCardResult,
  LearningCardState,
  summarizeLearningResults,
} from './testDeck';

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
  danger: string;
};

type LearningSurfaceProps = {
  palette: LearningSurfacePalette;
  currentCard: LearningCard | null;
  currentCardState: LearningCardState | null;
  currentIndex: number;
  currentResult: LearningCardResult | null;
  completedResults: LearningCardResult[];
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
};

type InteractionTone = {
  fill: string;
  stroke: string;
  glow: string;
};

const INTERACTION_TONES: Record<string, InteractionTone> = {
  flip: {
    fill: 'rgba(78, 138, 230, 0.15)',
    stroke: '#4E8AE6',
    glow: 'rgba(78, 138, 230, 0.20)',
  },
  multiple_choice: {
    fill: 'rgba(242, 153, 74, 0.16)',
    stroke: '#F2994A',
    glow: 'rgba(242, 153, 74, 0.22)',
  },
  lock: {
    fill: 'rgba(155, 127, 230, 0.16)',
    stroke: '#9B7FE6',
    glow: 'rgba(155, 127, 230, 0.22)',
  },
  elimination: {
    fill: 'rgba(39, 174, 96, 0.16)',
    stroke: '#27AE60',
    glow: 'rgba(39, 174, 96, 0.22)',
  },
  swipe: {
    fill: 'rgba(0, 184, 217, 0.16)',
    stroke: '#00B8D9',
    glow: 'rgba(0, 184, 217, 0.20)',
  },
};

export function LearningSurface({
  palette,
  currentCard,
  currentCardState,
  currentIndex,
  currentResult,
  completedResults,
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
}: LearningSurfaceProps) {
  if (currentCard === null || currentCardState === null) {
    const summary = summarizeLearningResults(completedResults);

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
          ]}>
          <Text style={[styles.heroEyebrow, { color: palette.accent }]}>
            SINGLE CARD FLOW
          </Text>
          <Text style={[styles.heroTitle, { color: palette.text }]}>
            本轮测试卡已走完
          </Text>
          <Text style={[styles.heroSummary, { color: palette.textMuted }]}>
            当前分支用 5 张本地测试卡把学习主路径跑通，覆盖翻面、四选一、开锁、消除、滑动和提示层入口。
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
            title="这一步落实了什么"
            lines={[
              '学习入口不再是说明页，而是已登录后即可进入的单卡流。',
              '本地测试卡覆盖 5 个核心交互，提示层附着在具体卡上出现。',
              'Peek 和收藏保持轻量，不抢占答题动作。',
            ]}
          />
          <InfoGlassCard
            palette={palette}
            title="还没有做什么"
            lines={[
              '没有接学习算法、真实卡池和跨端同步。',
              '没有把音频单独拉成一类交互。',
              '没有把统计或复杂状态机抬成产品中心。',
            ]}
          />
        </View>

        <View
          style={[
            styles.resultCard,
            {
              backgroundColor: palette.panel,
              borderColor: palette.border,
            },
          ]}>
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
              ]}>
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
          <Pressable
            onPress={onRestartDeck}
            style={[styles.primaryButton, { backgroundColor: palette.accent }]}
            testID="learning-restart-button">
            <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
              再跑一轮测试卡
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  const tone = INTERACTION_TONES[currentCard.interaction_id];

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View
        style={[
          styles.heroCard,
          styles.glassCard,
          {
            backgroundColor: palette.panel,
            borderColor: palette.border,
            shadowColor: tone.stroke,
          },
        ]}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroChipRow}>
            <TagChip
              label={currentCard.track.toUpperCase()}
              toneColor={tone.stroke}
            />
            <TagChip
              label={INTERACTION_LABELS[currentCard.interaction_id]}
              toneColor={tone.stroke}
            />
            <TagChip
              label={`${currentIndex + 1} / ${LEARNING_TEST_CARDS.length}`}
              toneColor={palette.accent}
            />
          </View>
          <Text style={[styles.heroKicker, { color: palette.textMuted }]}>
            learning / single-card-flow
          </Text>
        </View>
        <Text style={[styles.heroEyebrow, { color: tone.stroke }]}>
          {currentCard.front.eyebrow}
        </Text>
        <Text style={[styles.heroTitle, { color: palette.text }]}>
          单卡推进，不把学习入口做成按钮堆
        </Text>
        <Text style={[styles.heroSummary, { color: palette.textMuted }]}>
          当前用本地测试卡验证学习主路径。每次只推进一张卡，把交互、提示层和轻量动作压在同一块面板里。
        </Text>
        <View style={styles.progressRail}>
          {LEARNING_TEST_CARDS.map((card, index) => {
            const isDone = index < completedResults.length;
            const isActive = index === currentIndex;
            const itemTone = INTERACTION_TONES[card.interaction_id];

            return (
              <View
                key={card.card_id}
                style={[
                  styles.progressNode,
                  {
                    backgroundColor: isActive
                      ? itemTone.fill
                      : palette.panelStrong,
                    borderColor: isActive || isDone ? itemTone.stroke : palette.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.progressNodeLabel,
                    { color: isActive || isDone ? palette.text : palette.textMuted },
                  ]}>
                  {INTERACTION_LABELS[card.interaction_id]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View
        style={[
          styles.studyCard,
          styles.glassCard,
          {
            backgroundColor: palette.panel,
            borderColor: tone.stroke,
            shadowColor: tone.stroke,
          },
        ]}>
        <View style={styles.studyCardTop}>
          <View style={styles.studyTitleWrap}>
            <Text style={[styles.cardEyebrow, { color: tone.stroke }]}>
              {currentCard.space_metadata.library} / {currentCard.space_metadata.group}
            </Text>
            <Text style={[styles.cardPrompt, { color: palette.text }]}>
              {currentCard.front.prompt}
            </Text>
          </View>
          <Pressable
            onPress={onToggleFavorite}
            style={[
              styles.favoriteButton,
              {
                backgroundColor: currentCardState.isFavorited
                  ? tone.fill
                  : palette.panelStrong,
                borderColor: currentCardState.isFavorited
                  ? tone.stroke
                  : palette.border,
              },
            ]}
            testID="learning-favorite-button">
            <Text
              style={[
                styles.favoriteLabel,
                { color: currentCardState.isFavorited ? tone.stroke : palette.textMuted },
              ]}>
              {currentCardState.isFavorited ? '已收藏' : '收藏'}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.cardSupport, { color: palette.textMuted }]}>
          {currentCard.front.support}
        </Text>
        <Text style={[styles.cardContext, { color: palette.textMuted }]}>
          {currentCard.front.context}
        </Text>

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
        </View>

        {currentCardState.isPeeked ? (
          <View
            style={[
              styles.peekPanel,
              {
                backgroundColor: tone.fill,
                borderColor: tone.stroke,
              },
            ]}>
            <Text style={[styles.peekTitle, { color: palette.text }]}>
              这张卡为什么出现
            </Text>
            <Text style={[styles.peekText, { color: palette.textMuted }]}>
              knowledge_ref: {currentCard.knowledge_ref}
            </Text>
            <Text style={[styles.peekText, { color: palette.textMuted }]}>
              位置: {currentCard.space_metadata.library} /{' '}
              {currentCard.space_metadata.group} / {currentCard.space_metadata.box}
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
            ]}>
            <Text style={[styles.hintTitle, { color: tone.stroke }]}>
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
            styles.interactionCard,
            {
              backgroundColor: palette.panelStrong,
              borderColor: palette.border,
            },
          ]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            {INTERACTION_LABELS[currentCard.interaction_id]}
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
            isLastCard={currentIndex === LEARNING_TEST_CARDS.length - 1}
          />
        ) : currentCard.interaction_id !== 'flip' ? (
          <Pressable
            disabled={!canSubmitLearningCard(currentCard, currentCardState)}
            onPress={onSubmitCurrentCard}
            style={[
              styles.primaryButton,
              {
                backgroundColor: canSubmitLearningCard(currentCard, currentCardState)
                  ? tone.stroke
                  : palette.tabIdle,
              },
            ]}
            testID="learning-submit-button">
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
  const tone = INTERACTION_TONES[card.interaction_id];

  switch (card.interaction_id) {
    case 'flip':
      return (
        <View style={styles.interactionBody}>
          {cardState.isFlipped ? (
            <View
              style={[
                styles.revealPanel,
                {
                  backgroundColor: tone.fill,
                  borderColor: tone.stroke,
                },
              ]}>
              <Text style={[styles.revealTitle, { color: tone.stroke }]}>
                翻面结果
              </Text>
              <Text style={[styles.revealText, { color: palette.text }]}>
                {card.back_text}
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={onFlip}
              style={[styles.primaryButton, { backgroundColor: tone.stroke }]}
              testID="learning-flip-button">
              <Text style={[styles.primaryButtonLabel, { color: palette.panel }]}>
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
                  {
                    backgroundColor: tone.fill,
                    borderColor: tone.stroke,
                  },
                ]}
                testID="learning-flip-confident-button">
                <Text style={[styles.choiceLabel, { color: palette.text }]}>
                  有把握
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onSetFlipConfidence('review')}
                style={[
                  styles.choicePill,
                  {
                    backgroundColor: palette.panel,
                    borderColor: palette.border,
                  },
                ]}
                testID="learning-flip-review-button">
                <Text style={[styles.choiceLabel, { color: palette.text }]}>
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
          {card.options.map(option => {
            const isSelected = cardState.selectedOptionId === option.id;
            const isCorrect = currentResult !== null && option.id === card.answer_key.correct_option;
            const isIncorrectSelection =
              currentResult?.outcome === 'incorrect' && isSelected;

            return (
              <Pressable
                key={option.id}
                onPress={() => onSelectOption(option.id)}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: isSelected ? tone.fill : palette.panel,
                    borderColor: isCorrect
                      ? palette.success
                      : isIncorrectSelection
                        ? palette.danger
                        : isSelected
                          ? tone.stroke
                          : palette.border,
                  },
                ]}
                testID={`learning-option-${option.id}`}>
                <Text style={[styles.optionLabel, { color: tone.stroke }]}>
                  {option.label}
                </Text>
                <Text style={[styles.optionText, { color: palette.text }]}>
                  {option.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      );
    case 'lock':
      return (
        <View style={styles.interactionBody}>
          {card.lock_slots.map(slot => (
            <View key={slot.id} style={styles.lockGroup}>
              <Text style={[styles.lockLabel, { color: palette.text }]}>
                {slot.label}
              </Text>
              <View style={styles.inlineWrap}>
                {slot.options.map(option => {
                  const isSelected = cardState.lockSelections[slot.id] === option;

                  return (
                    <Pressable
                      key={option}
                      onPress={() => onSetLockSelection(slot.id, option)}
                      style={[
                        styles.choicePill,
                        {
                          backgroundColor: isSelected ? tone.fill : palette.panel,
                          borderColor: isSelected ? tone.stroke : palette.border,
                        },
                      ]}
                      testID={`learning-lock-${slot.id}-${toTestIdSegment(option)}`}>
                      <Text style={[styles.choiceLabel, { color: palette.text }]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      );
    case 'elimination':
      return (
        <View style={styles.interactionBody}>
          <Text style={[styles.inlineHelper, { color: palette.textMuted }]}>
            点亮你想剥离的成分。
          </Text>
          <View style={styles.inlineWrap}>
            {card.elimination_items.map(item => {
              const isSelected = cardState.eliminatedItemIds.includes(item.id);
              const isCorrect =
                currentResult !== null && card.answer_key.correct_items.includes(item.id);

              return (
                <Pressable
                  key={item.id}
                  onPress={() => onToggleEliminationItem(item.id)}
                  style={[
                    styles.choicePill,
                    {
                      backgroundColor: isSelected ? tone.fill : palette.panel,
                      borderColor: currentResult
                        ? isCorrect
                          ? palette.success
                          : isSelected
                            ? palette.danger
                            : palette.border
                        : isSelected
                          ? tone.stroke
                          : palette.border,
                    },
                  ]}
                  testID={`learning-elimination-${item.id}`}>
                  <Text style={[styles.choiceLabel, { color: palette.text }]}>
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
        <View style={styles.swipeRow}>
          {card.swipe_states.map(state => {
            const isSelected = cardState.swipeSelection === state.id;
            const isCorrect =
              currentResult !== null && state.id === card.answer_key.correct_state;

            return (
              <Pressable
                key={state.id}
                onPress={() => onSelectSwipeState(state.id)}
                style={[
                  styles.swipeStateCard,
                  {
                    backgroundColor: isSelected ? tone.fill : palette.panel,
                    borderColor: isCorrect
                      ? palette.success
                      : isSelected
                        ? tone.stroke
                        : palette.border,
                  },
                ]}
                testID={`learning-swipe-${state.id}`}>
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
  const isPositive =
    result.outcome === 'correct' || result.outcome === 'confident';

  return (
    <View
      style={[
        styles.resultCard,
        {
          backgroundColor: palette.panelStrong,
          borderColor: isPositive ? palette.success : palette.danger,
        },
      ]}>
      <View style={styles.resultHeader}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          {isPositive ? '这张卡已稳住' : '这张卡需要回看'}
        </Text>
        <ResultBadge outcome={result.outcome} palette={palette} />
      </View>
      <Text style={[styles.resultExplanationTitle, { color: palette.text }]}>
        {card.analysis.title}
      </Text>
      <Text style={[styles.resultExplanationBody, { color: palette.textMuted }]}>
        {card.analysis.summary}
      </Text>
      <Text style={[styles.resultTip, { color: palette.textMuted }]}>
        过级提醒：{card.analysis.exam_tip}
      </Text>
      <Pressable
        onPress={onAdvanceCard}
        style={[styles.primaryButton, { backgroundColor: palette.accent }]}
        testID="learning-next-button">
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
      ]}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
      {lines.map(line => (
        <View key={line} style={styles.infoLine}>
          <View style={[styles.infoDot, { backgroundColor: palette.accent }]} />
          <Text style={[styles.infoText, { color: palette.textMuted }]}>{line}</Text>
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
      ]}>
      <Text style={[styles.metricLabel, { color: palette.textMuted }]}>{label}</Text>
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
          borderColor: isPositive ? palette.success : palette.danger,
        },
      ]}>
      <Text
        style={[
          styles.resultBadgeLabel,
          { color: isPositive ? palette.success : palette.danger },
        ]}>
        {label}
      </Text>
    </View>
  );
}

function TagChip({
  label,
  toneColor,
}: {
  label: string;
  toneColor: string;
}) {
  return (
    <View
      style={[
        styles.tagChip,
        styles.tagChipBase,
        {
          borderColor: toneColor,
        },
      ]}>
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
      testID={testID}>
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
    gap: 16,
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
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '800',
  },
  cardSupport: {
    fontSize: 15,
    lineHeight: 22,
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
  choiceLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionLabel: {
    width: 28,
    fontSize: 14,
    fontWeight: '800',
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  lockGroup: {
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
