import {isLongQuestion, stackChoiceOptions} from './readability';
import {resultFeedback} from './resultFeedback';
import {EliminationPassageText} from './EliminationPassageText';
import {answerComparison, eliminationPassage, frontMaterial, spaceCardPreview} from './presentation';
import {useCardMotion, useReducedMotion, MotionView, MotionPressable, LockMotionGlyph, StrikeText} from './NativeMotion';
import React from 'react';
import type { DimensionValue } from 'react-native';
import {
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
import {bundledAudioSelection} from '../audio/bundledAudio';
import type {RefreshLearningAudioDownload} from '../audio/learningAudioController';
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
  onContinueLocalBatch?: () => void;
  resumeLocalLearning?: boolean;
  allowBundledAudio?: boolean;
  showCardProgress?: boolean;
  palette: LearningSurfacePalette;
  contentManifest?: VerifiedContentManifest | null;
  refreshAudioDownload?: RefreshLearningAudioDownload;
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
  emptySession?: {
    nextDueAt: string | null;
    pendingSleep: boolean;
    pendingSync: boolean;
    onRefresh: () => void;
    onOpenSpace: () => void;
  } | null;
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




function getPrimaryActionColors(palette: LearningSurfacePalette) {
  return {
    surface: palette.primaryActionSurface ?? palette.text,
    text: palette.primaryActionText ?? palette.panelStrong,
    muted: palette.primaryActionMuted ?? palette.textMuted,
  };
}

function getLibraryActionColors(
  accent: string,
  palette: LearningSurfacePalette,
) {
  const normalized = accent.replace('#', '');
  const channels = [0, 2, 4].map(
    offset => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255,
  );
  const luminance = channels
    .map(channel =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (sum, channel, index) =>
        sum + channel * ([0.2126, 0.7152, 0.0722][index] ?? 0),
      0,
    );
  const contrastWithWhite = 1.05 / (luminance + 0.05);

  return {
    muted: palette.textMuted,
    surface: accent,
    text: contrastWithWhite >= 4.5 ? '#FFFFFF' : '#0B0B14',
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
  onContinueLocalBatch,
  resumeLocalLearning = false,
  allowBundledAudio = false,
  showCardProgress = true,
  palette,
  contentManifest = null,
  refreshAudioDownload,
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
  emptySession = null,
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
  const readingScroll = React.useRef<ScrollView>(null);
  React.useEffect(() => {
    readingScroll.current?.scrollTo({y: 0, animated: false});
  }, [currentCard?.card_id, currentResult, currentCardState?.isFlipped]);
  const cardMotion = useCardMotion(currentCard ? `${currentCard.card_id}:${audioAttemptId ?? phase}` : null);
  const isCompactPhone = isCompactLearningViewport(
    viewportWidth,
    viewportHeight,
  );
  const isReviewPhase = phase === 'review';
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
    if (emptySession && !roundCompletion) {
      const due = emptySession.nextDueAt
        ? new Date(Date.parse(emptySession.nextDueAt) + 8 * 60 * 60 * 1000)
        : null;
      const dueLabel = due && Number.isFinite(due.getTime())
        ? `${due.getUTCMonth() + 1}月${due.getUTCDate()}日 ${String(due.getUTCHours()).padStart(2, '0')}:${String(due.getUTCMinutes()).padStart(2, '0')}（北京时间）`
        : null;
      const action = getPrimaryActionColors(palette);
      return (
        <ScrollView style={styles.emptySessionScroll} contentContainerStyle={styles.emptySessionContent}
          showsVerticalScrollIndicator={false} testID="learning-empty-session">
          <View style={[styles.heroCard, styles.completeHeroCard, {backgroundColor: palette.panel, borderColor: palette.border}]}>
            <Text style={[styles.heroTitle, {color: palette.text}]}>
              {emptySession.pendingSleep ? '这张卡已暂停学习' : emptySession.pendingSync ? '正在更新学习安排' : dueLabel ? '暂时没有需要复习的卡片' : '当前没有可学习的卡片'}
            </Text>
            <Text style={[styles.heroSummary, {color: palette.textMuted}]}>
              {emptySession.pendingSleep
                ? '休眠中的卡不会继续出题。同步完成后会更新学习安排，也可以回空间恢复学习。'
                : emptySession.pendingSync
                ? '本次答案已保留，确认后会更新学习安排。'
                : dueLabel
                ? '下次复习时间会显示在下方。'
                : '可以到空间查看卡片，或刷新学习进度。'}
            </Text>
            {dueLabel && !emptySession.pendingSleep && !emptySession.pendingSync ? (
              <Text style={[styles.resultExplanationBody, {color: palette.text}]} testID="learning-next-due-at">
                下一次复习：{dueLabel}
              </Text>
            ) : null}
          </View>
          <View style={[styles.resultCard, styles.completeActionCard, {backgroundColor: palette.panel, borderColor: palette.border}]}>
            <Pressable accessibilityRole="button" onPress={emptySession.onRefresh}
              style={[styles.primaryButton, {backgroundColor: action.surface}]}
              testID="learning-refresh-session-button">
              <Text style={[styles.primaryButtonLabel, {color: action.text}]}>
                {emptySession.pendingSleep || emptySession.pendingSync ? '重试同步' : '刷新学习进度'}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={emptySession.onOpenSpace}
              style={[styles.primaryButton, {backgroundColor: palette.panelStrong}]}
              testID="learning-empty-open-space-button">
              <Text style={[styles.primaryButtonLabel, {color: palette.text}]}>查看空间</Text>
            </Pressable>
          </View>
        </ScrollView>
      );
    }
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
          <Text style={[styles.heroTitle, { color: palette.text }]}>
            {roundCompletion
              ? '本轮完成'
              : isReviewPhase
              ? '复习完成'
              : '本组完成'}
          </Text>
          <Text style={[styles.heroSummary, { color: palette.textMuted }]}>
            {roundCompletion
              ? roundCompletion.reviewCardCount > 0
                ? `完成 ${roundCompletion.completedCount} 张卡，${roundCompletion.reviewCardCount} 张需要复习。`
                : `完成 ${roundCompletion.completedCount} 张卡，没有需要复习的卡。`
              : isReviewPhase
              ? `完成 ${sessionCards.length} 张复习。`
              : `完成 ${sessionCards.length} 张卡。`}
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
                    ? `复习 ${roundCompletion.reviewCardCount}`
                    : '无'
                  : !isReviewPhase && reviewCandidateCount > 0
                  ? `复习 ${reviewCandidateCount}`
                  : '无'
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
            style={[styles.resultExplanationBody, { color: palette.textMuted }]}
          >
            {roundCompletion
              ? `${roundShelf} · ${roundSection} · ${roundContainer}`
              : isReviewPhase
              ? '之后还会继续练习不熟的内容。'
              : '需要再看的卡已加入复习。'}
          </Text>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            下一步
          </Text>
          <Text
            style={[styles.resultExplanationBody, { color: palette.textMuted }]}
          >
            {roundCompletion
              ? roundCompletion.reviewCardCount > 0
                ? `有 ${roundCompletion.reviewCardCount} 张需要复习。`
                : '这一轮没有需要复习的卡片。'
              : isReviewPhase
              ? '本组复习完成。'
              : reviewCandidateCount > 0
              ? `先复习这 ${reviewCandidateCount} 张卡，再继续新一轮学习。`
              : '可以再练一遍。'}
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
                  { color: '#0B0B14' },
                ]}
              >
                开始复习这 {reviewCandidateCount} 张卡
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
                : onContinueLocalBatch ?? onRestartDeck
            }
            style={[
              styles.primaryButton,
              { backgroundColor: !roundCompletion && !isReviewPhase && reviewCandidateCount > 0 && onStartReview ? palette.panelStrong : primaryAction.surface },
            ]}
            testID={
              roundCompletion
                ? 'learning-continue-round-button'
                : 'learning-restart-button'
            }
          >
            <Text
              style={[styles.primaryButtonLabel, { color: !roundCompletion && !isReviewPhase && reviewCandidateCount > 0 && onStartReview ? palette.textMuted : primaryAction.text }]}
            >
              {roundCompletion
                ? roundContinuePending
                  ? '正在继续…'
                  : '继续下一轮'
                : onContinueLocalBatch ? '继续下一组'
                : resumeLocalLearning ? '继续学习'
                : isReviewPhase
                ? '重新开始学习'
                : '再练一遍'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const courseName = currentCard.track === 'cet6' ? '英语六级' : '英语四级';
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
  const canSubmitCurrentCard = canSubmitLearningCard(
    currentCard,
    currentCardState,
  );
  const submissionLabel = '提交答案';
  const primaryAction = getLibraryActionColors(tone.accent, palette);
  const audioSelection = (() => {
    if (!currentCard.audio || audioAttemptId === null) {
      return null;
    }

    try {
      if (allowBundledAudio) return bundledAudioSelection(currentCard, audioAttemptId);
      if (!contentManifest) return null;
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
  const passage = currentCard.interaction_id === 'elimination' ? eliminationPassage(currentCard) : null;
  const material = frontMaterial(currentCard).filter(text => !passage || text !== passage.source);
  const shouldShowContextCard = currentResult === null && material.length > 0;
  const shouldCenterShortFlip = false;
  const minimumSheetHeight = 0;

  return (
    <View
      style={[
        styles.oneScreenPage,
        isCompactPhone ? styles.oneScreenPageCompact : null,
      ]}
      testID="learning-one-screen-flow"
    >
      <Animated.View
        style={[
          cardMotion.cardStyle,
          styles.studyCard,
          styles.studyCardOneScreen,
          isCompactPhone ? styles.studyCardOneScreenCompact : null,
          styles.glassCard,
          {
            backgroundColor: palette.panel,
            borderColor: palette.border,
            borderTopColor: palette.border,
            shadowColor: palette.text,
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
                {`${courseName} · ${isReviewPhase ? '复习 · ' : ''}${visibleShelfName} / ${visibleSectionName}`}
              </Text>
              <Text
                style={[
                  styles.cardObjectLead,
                  isCompactPhone ? styles.cardObjectLeadCompact : null,
                  { color: palette.text },
                ]}
              >
                {visibleContainerName}
              </Text>
            </View>
          </View>
          {showCardProgress ? <View
            style={[
              styles.cardProgressCluster,
              isCompactPhone ? styles.cardProgressClusterCompact : null,
              {
                backgroundColor: 'transparent',
                borderColor: 'transparent',
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
          </View> : null}
          <View
            style={[
              styles.cardIdentityTools,
              isCompactPhone ? styles.cardIdentityToolsCompact : null,
            ]}
          >
            <Pressable
              accessibilityLabel={
                currentCardState.isFavorited ? '取消收藏' : '收藏当前卡'
              }
              accessibilityRole="button"
              accessibilityState={{ selected: currentCardState.isFavorited }}
              onPress={onToggleFavorite}
              style={[
                styles.cardIdentityTool,
                {
                  backgroundColor: currentCardState.isFavorited
                    ? tone.accentSoft
                    : 'transparent',
                  borderColor: currentCardState.isFavorited
                    ? tone.accent
                    : 'transparent',
                },
              ]}
              testID="learning-favorite-button"
            >
              <Text
                style={[
                  styles.cardIdentityToolLabel,
                  styles.favoriteTagGlyph,
                  {
                    color: currentCardState.isFavorited
                      ? tone.accent
                      : palette.textMuted,
                  },
                ]}
              >
                {currentCardState.isFavorited ? '★' : '☆'}
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.cardStageBody}>
          <Animated.View
            style={[
              styles.cardMaterialSheetFrame,
              cardMotion.flipStyle,
            ]}
            testID="learning-material-sheet"
          >
            <ScrollView
              ref={readingScroll}
              contentContainerStyle={[
                styles.cardTaskBandContent,
                isCompactPhone ? styles.cardTaskBandContentCompact : null,
                currentResult && onOpenResultDetail ? styles.cardTaskBandWithResultDock : null,
                shouldCenterShortFlip
                  ? styles.cardTaskBandContentCentered
                  : null,
                { minHeight: minimumSheetHeight },
                currentCard.hint_layer && currentResult === null
                  ? styles.cardTaskBandWithHint
                  : null,
              ]}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              style={[
                styles.cardTaskBand,
                {
                  backgroundColor: palette.panel,
                  borderColor: palette.border,
                  shadowColor: tone.accent,
                },
              ]}
              testID="learning-card-task-band"
            >
              {currentResult === null && currentCard.interaction_id !== 'swipe' && !(currentCard.interaction_id === 'flip' && currentCardState.isFlipped) && !(passage && passage.source === currentCard.front.prompt) ? (
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
                    <Text
                      style={[styles.cardEyebrow, { color: palette.textMuted }]}
                    >
                      先读题干
                    </Text>
                  ) : null}
                  <Text
                    style={[
                      styles.cardPrompt,
                      styles.cardPromptOneScreen,
                      isCompactPhone ? styles.cardPromptOneScreenCompact : null,
                      (isAccessibilityText || isLongQuestion(currentCard.front.prompt)) ? styles.longQuestion : null,
                      { color: palette.text },
                    ]}
                  >
                    {currentCard.front.prompt}
                  </Text>
                </View>
              </View>

              ) : null}

              {audioSelection ? (
                <View
                  style={styles.audioResourceSlot}
                  testID="learning-audio-slot"
                >
                  <LearningAudioPlayer
                    palette={palette}
                    selection={audioSelection}
                    refreshDownload={refreshAudioDownload}
                  />
                </View>
              ) : null}

              {shouldShowContextCard ? <View style={styles.contextCard} testID="learning-current-card-context">{material.map(text => <Text key={text} style={[styles.cardSupport, {color: palette.text}]}>{text}</Text>)}</View> : null}

              {currentResult ? (
                onOpenResultDetail ? (
                  <MotionView motionKey={currentResult.outcome} kind="result" enter><ResultSummaryPanel
                    card={currentCard}
                    cardState={currentCardState}
                    compact={isCompactPhone}
                    palette={palette}
                    result={currentResult}
                    onOpenResultDetail={onOpenResultDetail}
                  /></MotionView>
                ) : (
                  <ResultPanel
                    advanceState={advanceState}
                    card={currentCard}
                    palette={palette}
                    result={currentResult}
                    onAdvanceCard={() => cardMotion.perform('advance', onAdvanceCard)}
                    isLastCard={!emptySession && currentIndex === sessionCards.length - 1}
                  />
                )
              ) : (
                <View
                  style={[
                    styles.interactionCard,
                    styles.interactionCardOneScreen,
                    styles.interactionCardEmbedded,
                    shouldCenterShortFlip
                      ? styles.interactionCardNaturalHeight
                      : null,
                    isCompactPhone
                      ? styles.interactionCardOneScreenCompact
                      : null,
                    {
                      backgroundColor: 'transparent',
                      borderColor: hexToRgba(tone.accent, 0.18),
                    },
                  ]}
                >
                  <InteractionBody
                    key={`interaction:${currentCard.card_id}:${audioAttemptId ?? phase}`}
                    card={currentCard}
                    cardState={currentCardState}
                    currentResult={currentResult}
                    palette={palette}
                    onSelectOption={onSelectOption}
                    onSetLockSelection={onSetLockSelection}
                    onToggleEliminationItem={onToggleEliminationItem}
                    onSelectSwipeState={onSelectSwipeState}
                    compact={isCompactPhone}
                  />
                  <LearningHelp
                    key={`help:${currentCard.card_id}:${audioAttemptId ?? phase}`}
                    card={currentCard} state={currentCardState} palette={palette}
                    onToggleHint={onToggleHint} onTogglePeek={onTogglePeek}
                  />
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>

        {currentResult && onOpenResultDetail ? (
          <View
            style={[styles.oneScreenDock, styles.resultActionRail]}
            testID="learning-action-dock"
          >
            <Pressable
              disabled={advanceState.busy || cardMotion.busy}
              onPress={() => cardMotion.perform('advance', onAdvanceCard)}
              style={[
                styles.primaryButton,
                { backgroundColor: primaryAction.surface },
              ]}
              testID="learning-next-button"
            >
              <Text
                style={[
                  styles.primaryButtonLabel,
                  { color: primaryAction.text },
                ]}
              >
                {advanceState.busy
                  ? '正在保存…'
                  : advanceState.needsRetry
                  ? '重试保存'
                  : !emptySession && currentIndex === sessionCards.length - 1
                  ? '完成本组'
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
        ) : null}

        {!currentResult && currentCard.interaction_id === 'flip' ? (
          <View
            style={[
              styles.oneScreenDock,
              styles.flipActionRail,
              isCompactPhone ? styles.oneScreenDockSmallViewport : null,
            ]}
            testID="learning-action-dock"
          >
            {!currentCardState.isFlipped ? (
              <Pressable
                accessibilityLabel="查看答案"
                accessibilityRole="button"
                disabled={cardMotion.busy}
                onPress={() => cardMotion.perform('flip', onFlip)}
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
                  查看答案
                </Text>
              </Pressable>
            ) : (
              <View
                style={[
                  styles.confidenceRow,
                  isCompactPhone ? styles.confidenceRowCompact : null,
                ]}
              >
                <Pressable
                  accessibilityLabel="自评有把握"
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: currentCardState.flipConfidence === 'confident',
                  }}
                  onPress={() => onSetFlipConfidence('confident')}
                  style={[
                    styles.choicePill,
                    styles.choicePillWide,
                    isCompactPhone ? styles.choicePillCompact : null,
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
                      { color: '#146047' },
                    ]}
                  >
                    有把握
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="自评需要复习"
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: currentCardState.flipConfidence === 'review',
                  }}
                  onPress={() => onSetFlipConfidence('review')}
                  style={[
                    styles.choicePill,
                    styles.choicePillWide,
                    isCompactPhone ? styles.choicePillCompact : null,
                    {
                      backgroundColor: hexToRgba(
                        SELF_ASSESS_COLORS.review,
                        0.12,
                      ),
                      borderColor: SELF_ASSESS_COLORS.review,
                    },
                  ]}
                  testID="learning-flip-review-button"
                >
                  <Text
                    style={[
                      styles.choiceLabel,
                      { color: '#72530D' },
                    ]}
                  >
                    需要复习
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        {!currentResult && (currentCard.interaction_id === 'multiple_choice' || currentCard.interaction_id === 'elimination') ? <View style={[styles.oneScreenDock,styles.simpleActionDock,{borderColor:palette.border}]} testID="learning-action-dock">
          <Pressable accessibilityLabel="提交当前答案" accessibilityRole="button" accessibilityState={{disabled:!canSubmitCurrentCard}} disabled={!canSubmitCurrentCard} onPress={onSubmitCurrentCard} style={[styles.primaryButton,{backgroundColor:canSubmitCurrentCard?primaryAction.surface:palette.panelStrong}]} testID="learning-submit-button"><Text style={[styles.primaryButtonLabel,{color:canSubmitCurrentCard?primaryAction.text:palette.textMuted}]}>{submissionLabel}</Text></Pressable>
        </View> : null}

      </Animated.View>
    </View>
  );
}

function LearningHelp({card, state, palette, onToggleHint, onTogglePeek}: {
  card: LearningCard; state: LearningCardState; palette: LearningSurfacePalette;
  onToggleHint: () => void; onTogglePeek: () => void;
}) {
  const [open, setOpen] = React.useState(state.isHintVisible || state.isPeeked);
  return <View style={styles.learningHelpTools}>
    <Pressable accessibilityRole="button" accessibilityState={{expanded: open}}
      onPress={() => {
        if (open) {if (state.isHintVisible) onToggleHint(); if (state.isPeeked) onTogglePeek();}
        setOpen(value => !value);
      }} style={styles.helpTextButton} testID="learning-help-button">
      <Text style={[styles.helpTextLabel, {color: palette.textMuted}]}>{open ? '收起帮助' : '需要帮助'}</Text>
    </Pressable>
    {open ? <View style={[styles.helpContents, {borderLeftColor: palette.border}]} testID="learning-help-content">
      {card.hint_layer ? <View>
        <Pressable accessibilityRole="button" accessibilityState={{expanded: state.isHintVisible}}
          onPress={onToggleHint} style={styles.helpTextButton} testID="learning-hint-button">
          <Text style={[styles.helpTextLabel, {color: palette.text}]}>{state.isHintVisible ? '收起提示' : '查看提示'}</Text>
        </Pressable>
        {state.isHintVisible ? <Text style={[styles.cardSupport, {color: palette.textMuted}]}>{card.hint_layer.content}</Text> : null}
      </View> : null}
      <View>
        <Pressable accessibilityRole="button" accessibilityState={{expanded: state.isPeeked}}
          onPress={onTogglePeek} style={styles.helpTextButton} testID="learning-peek-button">
          <Text style={[styles.helpTextLabel, {color: palette.text}]}>{state.isPeeked ? '收起思路' : '解题思路'}</Text>
        </Pressable>
        {state.isPeeked ? <Text style={[styles.cardSupport, {color: palette.textMuted}]}>{card.analysis.exam_tip}</Text> : null}
      </View>
    </View> : null}
  </View>;
}

function InteractionBody({
  card,
  cardState,
  compact,
  currentResult,
  palette,
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
  onSelectOption: (optionId: string) => void;
  onSetLockSelection: (slotId: string, value: string) => void;
  onToggleEliminationItem: (itemId: string) => void;
  onSelectSwipeState: (stateId: string) => void;
}) {
  const {fontScale, width} = useWindowDimensions();
  const [optionsWidth, setOptionsWidth] = React.useState<number | null>(null);
  const stackOptions = card.interaction_id === 'multiple_choice' && stackChoiceOptions(card.options, optionsWidth ?? width - 64, fontScale);
  const libraryTone = resolveLibraryTone(card.space_metadata.library);
  const tone = {
    accent: libraryTone.accent,
    accentSoft: libraryTone.accentSoft,
  };
  const primaryAction = getLibraryActionColors(tone.accent, palette);
  const neutralAction = getNeutralActionSurface(palette);

  switch (card.interaction_id) {
    case 'flip':
      return cardState.isFlipped ? (
        <View
          style={[
            styles.interactionBody,
            compact ? styles.interactionBodyCompact : null,
          ]}
        >
          <View
            style={[
              styles.revealPanel,
              compact ? styles.revealPanelCompact : null,
              {
                backgroundColor: 'transparent',
                borderColor: 'transparent',
              },
            ]}
          >
            <Text style={[styles.revealTitle, { color: tone.accent }]}>
              核对答案
            </Text>
            <Text
              style={[
                styles.revealText,
                compact ? styles.revealTextCompact : null,
                isLongQuestion(card.back_text) ? styles.longQuestion : null,
                { color: palette.text },
              ]}
            >
              {card.back_text}
            </Text>
            <Text style={[styles.answerQuestion, {color:palette.textMuted,borderColor:palette.border}]}>{card.front.prompt}</Text>
          </View>
        </View>
      ) : null;
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
            onLayout={event => setOptionsWidth(event.nativeEvent.layout.width)}
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
                <MotionPressable motionKey={`${isSelected}:${isCorrect}:${isIncorrectSelection}`}
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
                    stackOptions ? styles.optionCardAccessible : null,
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
                  </View>
                  <Text style={[styles.optionText, { color: palette.text }]}>
                    {option.text}
                  </Text>
                </MotionPressable>
              );
            })}
          </View>
        </View>
      );
    case 'lock':
      const formingSentence = card.lock_slots.map((slot,index) => cardState.lockSelections[slot.id] === card.answer_key.lock_pattern[index] ? cardState.lockSelections[slot.id] : '____').join(' ');
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
            <Text style={[styles.formingSentence,{color:palette.text,borderColor:palette.border}]} accessibilityLabel={`已填写的内容：${formingSentence}`} testID="learning-forming-sentence">{formingSentence}</Text>
          {card.lock_slots.map((slot, index) => {
              const selectedValue = cardState.lockSelections[slot.id];
              const expectedValue = card.answer_key.lock_pattern[index];
              const isUnlocked = selectedValue === expectedValue;
              const hasWrongSelection = selectedValue !== null && !isUnlocked;
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
                    accessible
                    accessibilityRole="image"
                    accessibilityLabel={`${slot.label}，${isUnlocked ? '已开锁' : isCurrentRow ? '当前锁位' : '等待上一行'}`}
                    style={[
                      styles.lockGlyph,
                      compact ? styles.lockGlyphCompact : null,
                      {
                        backgroundColor: 'transparent',
                        borderColor: 'transparent',
                      },
                    ]}
                  >
                    <LockMotionGlyph open={isUnlocked} color={isUnlocked ? primaryAction.surface : palette.textMuted} />
                  </View>
                  <MotionView motionKey={isUnlocked} kind="reveal"
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
                      {hasWrongSelection || !compact ? (
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
                      {isCurrentRow ? slot.options.map((option, optionIndex) => {
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
                      }) : <Text style={[styles.lockSettledText,{color:isUnlocked?palette.text:palette.textMuted}]}>{isUnlocked ? selectedValue : '完成上一锁位后继续'}</Text>}
                    </View>
                  </MotionView>
                </View>
              );
            })}
          </View>
        </View>
      );
    case 'elimination': {
      const passage = eliminationPassage(card);
      const optionOrder = card.elimination_items.map(item => item.id);
      if (passage) return <EliminationPassageText segments={passage.segments} selectedIds={cardState.eliminatedItemIds} optionOrder={optionOrder} disabled={currentResult !== null} onToggle={onToggleEliminationItem} textColor={palette.text} mutedColor={palette.textMuted} selectionSurface={tone.accentSoft} />;

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
                <MotionPressable motionKey={isSelected}
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
                  <StrikeText struck={isSelected} color={primaryAction.surface}
                    style={[
                      styles.eliminationText,
                      {opacity: isSelected ? 0.66 : 1},
                      {
                        color: palette.text,
                      },
                    ]}
                  >
                    {item.text}
                  </StrikeText>
                  {isSelected ? (
                    <Text
                      style={[
                        styles.eliminationStateLabel,
                        { color: palette.text },
                      ]}
                    >
                      已删除
                    </Text>
                  ) : null}
                </MotionPressable>
              );
            })}
          </View>
        </View>
      );
    }
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
  const {fontScale} = useWindowDimensions();
  const isAccessibilityText = fontScale >= 1.3;
  const libraryTone = resolveLibraryTone(card.space_metadata.library);
  const tone = { accent: libraryTone.accent };
  const dragX = React.useRef(new Animated.Value(0)).current;
  const cardWidthRef = React.useRef(280);
  const settlingRef = React.useRef(false);
  const reduceMotionEnabled = useReducedMotion();
  const mountedRef = React.useRef(true);
  const pendingSwipe = React.useRef<string | null>(null);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {mountedRef.current = false; pendingSwipe.current = null; dragX.stopAnimation();};
  }, [dragX]);

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
      pendingSwipe.current = state.id;
      const finish = () => {
        if (!mountedRef.current) return;
        dragX.setValue(0);
        settlingRef.current = false;
        const selectedId = pendingSwipe.current; pendingSwipe.current = null;
        if (selectedId) onCommit(selectedId);
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
      }).start(({finished}) => {if (finished) finish();});
    },
    [card.swipe_states, dragX, onCommit, reduceMotionEnabled, settleToCenter],
  );

  React.useEffect(() => {
    if (!reduceMotionEnabled) return;
    dragX.stopAnimation(); dragX.setValue(0); settlingRef.current = false;
    const selectedId = pendingSwipe.current; pendingSwipe.current = null;
    if (selectedId && mountedRef.current) onCommit(selectedId);
  }, [dragX, onCommit, reduceMotionEnabled]);

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
        onPanResponderMove: (_event, gesture) => {
          if (!reduceMotionEnabled) dragX.setValue(gesture.dx);
        },
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
    [commitDirection, dragX, reduceMotionEnabled, settleToCenter],
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
          accessibilityLabel={`滑动判断，${card.front.prompt}`}
          accessibilityRole="adjustable"
          accessibilityValue={{ text: selectedState?.label ?? '未选择' }}
          accessible
          onLayout={event => {
            cardWidthRef.current = Math.max(event.nativeEvent.layout.width, 1);
          }}
          onAccessibilityAction={event => {
            if (event.nativeEvent.actionName === 'decrement') {
              commitDirection('left');
            } else if (event.nativeEvent.actionName === 'increment') {
              commitDirection('right');
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
            onPress={() => commitDirection(index === 0 ? 'left' : 'right')}
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
              <Text style={[styles.swipeLabel, { color: palette.text }]}>
                {state.label}
              </Text>
            </View>
            <Text style={[styles.swipeText, { color: palette.textMuted }]}>
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
    return result.interactionId === 'lock' ? palette.warning : palette.danger;
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
            cardState.flipConfidence === 'review' ? '需要复习' : '有把握',
          testID: 'learning-detail-selected-answer',
          tone: cardState.flipConfidence === 'review' ? 'warning' : 'success',
        },
        {
          label: '答案要点',
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
          label: '你的答案',
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
          label: '你删除的部分',
          displayText: selectedItems.length
            ? selectedItems.map(item => item.text).join(' · ')
            : '未删除任何内容',
          testID: 'learning-detail-selected-answer',
        },
        {
          label: '应删除的部分',
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
          label: '正确判断',
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
  const isReviewPhase = phase === 'review';
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
  const courseName = card.track === 'cet6' ? '英语六级' : '英语四级';
  const detailLibraryTone = resolveLibraryTone(card.space_metadata.library);
  const resolvedRows = getResolvedAnswerRows(card, cardState);
  const primaryAction = getLibraryActionColors(detailLibraryTone.accent, palette);
  const neutralAction = getNeutralActionSurface(palette);
  const feedback = resultFeedback(result.outcome);
  const detailOutcomeTitle = feedback.title;
  const detailOutcomeCaption = feedback.caption;
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
                      phase === 'review' ? '本轮复习' : displaySessionLabel
                    } · ${visibleContainerName}`
                  : phase === 'review'
                  ? '本轮复习'
                  : displaySessionLabel}
              </Text>
              <Text
                style={[
                  styles.cardObjectLead,
                  isCompactPhone ? styles.cardObjectLeadCompact : null,
                  { color: palette.text },
                ]}
              >
                {INTERACTION_LABELS[card.interaction_id]}
              </Text>
            </View>
          </View>
          {sessionCardCount > 1 ? <View
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
          </View> : null}
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
                {`${courseName} · ${isReviewPhase ? '复习 · ' : ''}${visibleShelfName} / ${visibleSectionName}`}
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
                {feedback.badge}
              </Text>
            </View>
            <Text
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
              考试提示：{card.analysis.exam_tip}
            </Text>
            <AudioTranscript key={card.card_id} card={card} palette={palette} />
          </View>
        </View>

      </ScrollView>
      <View style={styles.oneScreenDock} testID="learning-detail-action-dock">
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
              ? '完成本组'
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
    </View>
  );
}

function ResultSummaryPanel({card, cardState, palette, result, onOpenResultDetail}: {
  card: LearningCard; cardState: LearningCardState; compact: boolean;
  palette: LearningSurfacePalette; result: LearningCardResult; onOpenResultDetail: () => void;
}) {
  const comparison = answerComparison(card, cardState);
  const answerLabel = card.interaction_id === 'flip' ? '核对答案' : '正确答案';
  const questionContext = spaceCardPreview(card);
  return <View style={styles.answerSummary} testID="learning-result-summary">
    <Text style={[styles.answerEyebrow, {color: palette.success}]}>{answerLabel}</Text>
    <Text style={[styles.answerHeadline, isLongQuestion(comparison.correct) ? styles.longQuestion : null, {color: palette.text}]} testID="learning-correct-answer">{comparison.correct}</Text>
    {comparison.selected && comparison.selected !== comparison.correct ? <View style={styles.answerSelectionRow}>
      <Text style={[styles.answerEyebrow, {color: palette.textMuted}]}>你的选择</Text>
      <Text style={[styles.answerSelection, {color: palette.danger}]}>{comparison.selected}</Text>
    </View> : null}
    {result.outcome === 'confident' || result.outcome === 'review' ? <Text style={[styles.answerEyebrow, {color: palette.textMuted}]}>{result.outcome === 'confident' ? '有把握' : '需要复习'}</Text> : null}
    {card.interaction_id === 'lock' && result.outcome === 'incorrect' ? (
      <Text style={[styles.answerEyebrow, {color: palette.warning}]}>
        已解锁，稍后复习
      </Text>
    ) : null}
    <Text style={[styles.answerQuestion, {color: palette.textMuted, borderColor: palette.border}]}>{[questionContext.title, ...questionContext.detail].join('\n\n')}</Text>
    <Text style={[styles.answerReason, {color: palette.text}]}>{card.analysis.summary}</Text>
    <AudioTranscript key={card.card_id} card={card} palette={palette} />
    <Pressable accessibilityRole="button" onPress={onOpenResultDetail} style={styles.analysisLink} testID="learning-open-result-detail-button"><Text style={[styles.analysisLinkText, {color: palette.textMuted}]}>展开完整解析 →</Text></Pressable>
  </View>;
}

function AudioTranscript({card, palette}: {card: LearningCard; palette: LearningSurfacePalette}) {
  const [open, setOpen] = React.useState(false);
  const transcript = card.audio?.transcript?.trim();
  if (!transcript) return null;
  return <View>
    <Pressable
      accessibilityRole="button"
      accessibilityState={{expanded: open}}
      onPress={() => setOpen(value => !value)}
      style={styles.analysisLink}
      testID="learning-transcript-toggle"
    ><Text style={[styles.analysisLinkText, {color: palette.textMuted}]}>{open ? '收起听力原文' : '查看听力原文'}</Text></Pressable>
    {open ? <Text style={[styles.answerReason, {color: palette.text}]} testID="learning-transcript-text">{transcript}</Text> : null}
  </View>;
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
  const borderTone = getResultTone(result, palette);
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
          {resultFeedback(result.outcome).title}
        </Text>
        <ResultBadge result={result} palette={palette} />
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
        考试提示：{card.analysis.exam_tip}
      </Text>
      <AudioTranscript key={card.card_id} card={card} palette={palette} />
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
          已作答
        </Text>
        <Text style={[styles.settleText, { color: palette.textMuted }]}>
          看完解析后，下一张。
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
            ? '完成本组'
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
  result,
  palette,
}: {
  result: LearningCardResult;
  palette: LearningSurfacePalette;
}) {
  const {outcome} = result;
  const isPositive = outcome === 'correct' || outcome === 'confident';
  const badgeTone = getResultTone(result, palette);
  const label =
    result.interactionId === 'lock' && outcome === 'incorrect'
      ? '已解锁，稍后复习'
      : outcome === 'correct'
      ? '回答正确'
      : outcome === 'incorrect'
      ? '回答错误'
      : outcome === 'confident'
      ? '有把握'
      : '需要复习';

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

const styles = StyleSheet.create({
  emptySessionScroll: {flex: 1},
  emptySessionContent: {flexGrow: 1, justifyContent: 'center', gap: 10, padding: 16},
  lockSettledText: {fontSize: 16, lineHeight: 24, paddingVertical: 8},
  simpleActionDock: {borderTopWidth: 1, paddingTop: 12},

  answerSummary: {gap: 12},
  answerEyebrow: {fontSize: 12, lineHeight: 18, fontWeight: '500'},
  helpContents: {width: '100%', gap: 12, paddingLeft: 12, borderLeftWidth: 1},
  longQuestion: {fontSize: 18, lineHeight: 29, fontWeight: '500'},
  answerHeadline: {fontSize: 27, lineHeight: 36, fontWeight: '600'},
  answerSelectionRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', marginBottom: 8},
  answerSelection: {fontSize: 16, lineHeight: 24, flexShrink: 1},
  answerQuestion: {fontSize: 15, lineHeight: 24, borderTopWidth: 1, paddingTop: 16, marginTop: 8},
  answerReason: {fontSize: 16, lineHeight: 27, fontWeight: '400'},
  analysisLink: {minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingVertical: 8},
  analysisLinkText: {fontSize: 13, lineHeight: 21},
  learningHelpTools: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 20, marginTop: 8},
  helpTextButton: {minHeight: 44, minWidth: 44, justifyContent: 'center', paddingVertical: 8},
  helpTextLabel: {fontSize: 13, lineHeight: 20},
  formingSentence: {fontSize: 21, lineHeight: 32, borderBottomWidth: 1, paddingVertical: 12, marginBottom: 8},
  passageArea: {gap: 14},
  passageText: {fontSize: 19, lineHeight: 44, fontWeight: '400'},
  passageCandidate: {fontSize: 19, lineHeight: 44},
  passageGuidance: {fontSize: 12, lineHeight: 20},

  audioResourceSlot: {
    alignItems: 'flex-start',
    flexShrink: 0,
  },
  oneScreenPage: {
    flex: 1,
    gap: 10,
    justifyContent: 'center',
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
    minHeight: 48,
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
    justifyContent: 'flex-start',
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
    flexGrow: 0,
    gap: 7,
    justifyContent: 'flex-start',
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
    flex: 0,
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
    borderRadius: 0, borderWidth: 0, flexGrow: 0, gap: 10, justifyContent: 'flex-start', minHeight: 0, paddingHorizontal: 0, paddingVertical: 14,
  },
  detailExplanationSlipCompact: {
    gap: 10, paddingHorizontal: 0, paddingVertical: 10,
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
    flexShrink: 0,
    paddingVertical: 12,
  },
  detailPrimaryButtonCompact: {
    minHeight: 48,
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
    borderRadius: 2, borderWidth: 0, height: 2, overflow: 'hidden', width: 30,
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
    borderWidth: 1, borderRadius: 20, overflow: 'hidden', paddingHorizontal: 18, paddingVertical: 16, gap: 12, position: 'relative',
  },
  cardStageAtmosphere: {
    borderRadius: 999,
    bottom: -120,
    height: 280,
    opacity: 0.42,
    position: 'absolute',
    right: -130,
    width: 280,
  },
  studyCardOneScreen: {
    flexGrow: 0, flexShrink: 1, gap: 12, height: '100%', minHeight: 0, paddingHorizontal: 20, paddingVertical: 14,
  },
  studyCardOneScreenCompact: {
    gap: 10, paddingHorizontal: 18, paddingVertical: 10,
  },
  cardAddressShelf: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 8,
    justifyContent: 'space-between',
    zIndex: 3,
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
  cardIdentityTools: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 6,
  },
  cardIdentityToolsCompact: {
    gap: 4,
  },
  cardIdentityTool: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 5,
  },
  cardIdentityToolLabel: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 16,
  },
  favoriteTagGlyph: {
    fontSize: 20,
    lineHeight: 24,
  },
  cardEdgeHint: {
    alignItems: 'flex-start', borderWidth: 0, minHeight: 44, minWidth: 44, justifyContent: 'center', paddingVertical: 8,
  },
  cardEdgeHintCompact: {
    minHeight: 44,
  },
  cardEdgeHintLabel: {
    fontSize: 13, fontWeight: '400', lineHeight: 20,
  },
  cardStageBody: {
    flex: 1, justifyContent: 'flex-start', minHeight: 0, zIndex: 1,
  },
  cardMaterialSheetFrame: {
    alignSelf: 'stretch', flex: 1, minHeight: 0,
  },
  cardTaskBand: {
    borderRadius: 0, borderWidth: 0, flex: 1, minHeight: 0, shadowOpacity: 0, elevation: 0,
  },
  cardTaskBandContent: {
    flexGrow: 0, gap: 16, padding: 0, paddingBottom: 16,
  },
  cardTaskBandContentCompact: {
    gap: 12, padding: 0, paddingBottom: 12,
  },
  cardTaskBandWithResultDock: {
    paddingBottom: 112,
  },
  cardTaskBandContentCentered: {
    gap: 16, justifyContent: 'flex-start',
  },
  cardTaskBandWithHint: {
    paddingRight: 0,
  },
  cardObjectLead: {
    fontSize: 15, fontWeight: '500', lineHeight: 22,
  },
  cardObjectLeadCompact: {
    fontSize: 14, lineHeight: 20,
  },
  cardProgressCluster: {
    alignItems: 'center', borderRadius: 0, borderWidth: 0, gap: 4, minWidth: 36, paddingHorizontal: 0, paddingVertical: 4,
  },
  cardProgressClusterCompact: {
    gap: 4, minWidth: 36, paddingHorizontal: 0, paddingVertical: 4,
  },
  cardProgressCount: {
    fontSize: 12, fontWeight: '500', lineHeight: 18,
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
    fontSize: 26, lineHeight: 36, fontWeight: '600',
  },
  cardPromptOneScreen: {
    fontSize: 25, lineHeight: 34,
  },
  cardPromptOneScreenCompact: {
    fontSize: 23, lineHeight: 32,
  },
  contextCard: {
    borderWidth: 0, borderRadius: 0, paddingHorizontal: 0, paddingVertical: 0, gap: 12,
  },
  contextCardSupportActive: {
    borderLeftWidth: 0,
  },
  denseSupportLayer: {
    borderRadius: 8, borderWidth: 0, borderLeftWidth: 2, paddingHorizontal: 14, paddingVertical: 12, gap: 5,
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
    fontSize: 17, fontWeight: '400', lineHeight: 28,
  },
  cardContext: {
    fontSize: 15, fontWeight: '400', lineHeight: 25,
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
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  interactionCardOneScreenCompact: {
    gap: 4,
    paddingVertical: 1,
  },
  interactionCardEmbedded: {
    borderRadius: 22,
    borderWidth: 0,
  },
  interactionCardNaturalHeight: {
    flexGrow: 0,
    flexShrink: 0,
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
    flexGrow: 0,
  },
  revealPanel: {
    borderRadius: 0, borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0, gap: 10,
  },
  revealPanelCompact: {
    gap: 10, paddingHorizontal: 0, paddingVertical: 0,
  },
  revealTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  revealText: {
    fontSize: 25, fontWeight: '600', lineHeight: 35,
  },
  revealTextCompact: {
    fontSize: 24, lineHeight: 33,
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
    minHeight: 48,
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
    alignContent: 'flex-start',
    flexGrow: 0,
  },
  optionCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, minHeight: 68, minWidth: 0, paddingHorizontal: 12, paddingVertical: 14, gap: 12, width: '48%',
  },
  optionCardAccessible: {width: '100%'},
  optionCardSelected: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  optionCardCompact: {
    minHeight: 64, paddingHorizontal: 10, paddingVertical: 12, gap: 10,
  },
  optionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
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
    flex: 1, minWidth: 0, fontSize: 16, fontWeight: '500', lineHeight: 23,
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
  lockBodyCompact: {gap: 6},
  lockLabelRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  lockLabelRowCompact: {flexShrink: 0, flexWrap: 'wrap'},
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
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  lockChoicePillCompact: {
    flex: 1,
    minWidth: 48,
    maxWidth: '100%',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  lockChoicePillDisabled: {
    opacity: 0.58,
  },
  lockChoiceLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  lockChoiceWrap: {
    flexWrap: 'wrap',
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
    minHeight: 48,
    minWidth: 48,
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
    fontSize: 23, fontWeight: '600', lineHeight: 33,
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
    minHeight: 48,
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
    alignItems: 'center', justifyContent: 'center', borderRadius: 12, minHeight: 48, paddingHorizontal: 16, paddingVertical: 12,
  },
  oneScreenDock: {
    flexShrink: 0,
    gap: 7,
    marginTop: 1,
    zIndex: 3,
  },
  flipActionRail: {
    paddingTop: 4,
  },
  resultActionRail: {
    paddingTop: 4,
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
    minHeight: 48,
    minWidth: 118,
    paddingHorizontal: 16,
  },
  submitActionButtonLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButtonLabel: {
    fontSize: 16, fontWeight: '600', lineHeight: 24,
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
    borderRadius: 0, borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0, gap: 12,
  },
  resultCardCompact: {
    gap: 10, paddingHorizontal: 0, paddingVertical: 0,
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
