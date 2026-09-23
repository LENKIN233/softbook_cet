/**
 * @format
 */

import React from 'react';
import { Dimensions, StyleSheet, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { LearningAudioPlayer } from '../src/audio/LearningAudioPlayer';
import {
  LearningResultDetailSurface,
  LearningSurface,
  SWIPE_DISTANCE_THRESHOLD_RATIO,
  SWIPE_VELOCITY_THRESHOLD,
  isCompactLearningViewport,
  resolveSwipeGestureDirection,
} from '../src/learning/LearningSurface';
import type { LearningCard, LearningCardState } from '../src/learning/model';
import {
  canSubmitLearningCard,
  createLearningCardState,
  createLocalLearningSession,
} from './fixtures/interactionSession';
import { resolveLibraryTone } from '../src/visual/tokens';

const palette = {
  accent: '#7C8BFF',
  accentSoft: 'rgba(124,139,255,0.16)',
  accentStrong: '#3847B8',
  background: '#F1F0F6',
  border: 'rgba(29,31,42,0.12)',
  danger: '#D94C5C',
  panel: '#FFFFFF',
  panelStrong: '#F3F4F8',
  primaryActionMuted: 'rgba(255,255,255,0.74)',
  primaryActionSurface: '#12131A',
  primaryActionText: '#FFFFFC',
  success: '#1E9B63',
  tabIdle: 'rgba(124,139,255,0.36)',
  text: '#1E1F2A',
  textMuted: '#686B7A',
  warning: '#B77900',
};

function visibleText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(visibleText).join('');
  if (node && typeof node === 'object' && 'children' in node) return visibleText(node.children);
  return '';
}

test('a confident flip self-assessment never appears as an automatically correct answer', () => {
  const session = createLocalLearningSession('cet4');
  const card = session.cards.find(candidate => candidate.interaction_id === 'flip')!;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<LearningResultDetailSurface
      card={card}
      cardState={{...createLearningCardState(card), isFlipped: true, flipConfidence: 'confident'}}
      currentIndex={0} isLastCard={false} palette={palette} phase="learning"
      onAdvanceCard={jest.fn()} onBackToPractice={jest.fn()}
      sessionCardCount={5} sessionLabel={session.sourceLabel}
      result={{cardId: card.card_id, interactionId: 'flip', outcome: 'confident',
        completedAt: '2026-09-19T00:00:00.000Z', isFavorited: false, usedHint: false, usedPeek: false}}
    />);
  });
  const text = visibleText(tree.toJSON());
  expect(text).toContain('有把握');
  expect(text).toContain('这是你的自评结果');
  expect(text).not.toMatch(/回答正确|你的答案正确|已答对/);
});

test('learning compact mode covers 320dp and short phone viewports', () => {
  expect(isCompactLearningViewport(320, 693)).toBe(true);
  expect(isCompactLearningViewport(393, 700)).toBe(true);
  expect(isCompactLearningViewport(393, 850)).toBe(true);
  expect(isCompactLearningViewport(744, 1133)).toBe(false);
});

test('opening help does not count as using a hint or peek', () => {
  const renderErrors = jest.spyOn(console, 'error');
  const session = createLocalLearningSession('cet4');
  const card = session.cards.find(item => item.hint_layer)!;
  const onToggleHint = jest.fn();
  const onTogglePeek = jest.fn();
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<LearningSurface
      audioAttemptId={null} palette={palette} sessionCards={session.cards} sessionLabel={session.sourceLabel}
      phase="learning" currentCard={card} currentCardState={createLearningCardState(card)} currentIndex={0}
      currentResult={null} completedResults={[]} reviewCandidateCount={0}
      onToggleHint={onToggleHint} onTogglePeek={onTogglePeek} onToggleFavorite={jest.fn()}
      onFlip={jest.fn()} onSetFlipConfidence={jest.fn()} onSelectOption={jest.fn()}
      onSetLockSelection={jest.fn()} onToggleEliminationItem={jest.fn()} onSelectSwipeState={jest.fn()}
      onSubmitCurrentCard={jest.fn()} onAdvanceCard={jest.fn()} onRestartDeck={jest.fn()}
    />);
  });
  expect(tree.root.findAllByProps({testID: 'learning-hint-button'})).toHaveLength(0);
  ReactTestRenderer.act(() => tree.root.findByProps({testID: 'learning-help-button'}).props.onPress());
  expect(onToggleHint).not.toHaveBeenCalled();
  expect(onTogglePeek).not.toHaveBeenCalled();
  ReactTestRenderer.act(() => tree.root.findByProps({testID: 'learning-hint-button'}).props.onPress());
  expect(onToggleHint).toHaveBeenCalledTimes(1);
  expect(onTogglePeek).not.toHaveBeenCalled();
  ReactTestRenderer.act(() => tree.unmount());
  const duplicateKeys = renderErrors.mock.calls.filter(([message]) => String(message).includes('same key'));
  renderErrors.mockRestore();
  expect(duplicateKeys).toHaveLength(0);
});

test('all five interactions keep one stable card envelope and separated support controls', () => {
  const session = createLocalLearningSession('cet4');
  const interactionIds = [
    'flip',
    'multiple_choice',
    'lock',
    'elimination',
    'swipe',
  ] as const;

  const envelopeHeights: unknown[] = [];
  for (const interactionId of interactionIds) {
    const card = session.cards.find(
      candidate => candidate.interaction_id === interactionId,
    );
    if (!card) {
      throw new Error(`Expected ${interactionId} in the local session.`);
    }

    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <LearningSurface
          audioAttemptId={null}
          completedResults={[]}
          currentCard={card}
          currentCardState={createLearningCardState(card)}
          currentIndex={0}
          currentResult={null}
          onAdvanceCard={jest.fn()}
          onFlip={jest.fn()}
          onRestartDeck={jest.fn()}
          onSelectOption={jest.fn()}
          onSelectSwipeState={jest.fn()}
          onSetFlipConfidence={jest.fn()}
          onSetLockSelection={jest.fn()}
          onSubmitCurrentCard={jest.fn()}
          onToggleEliminationItem={jest.fn()}
          onToggleFavorite={jest.fn()}
          onToggleHint={jest.fn()}
          onTogglePeek={jest.fn()}
          palette={palette}
          phase="learning"
          reviewCandidateCount={0}
          sessionCards={session.cards}
          sessionLabel={session.sourceLabel}
        />,
      );
    });

    const envelope = StyleSheet.flatten(tree!.root.findByProps({testID: 'learning-current-card'}).props.style);
    expect(envelope.height).toBeDefined();
    envelopeHeights.push(envelope.height);
    const taskRegion = tree!.root.findByProps({testID: 'learning-card-task-band'});
    expect(taskRegion.props.scrollEnabled).not.toBe(false);
    for (const target of ['learning-help-button', 'learning-favorite-button']) {
      expect(StyleSheet.flatten(tree!.root.findByProps({testID: target}).props.style).minHeight).toBeGreaterThanOrEqual(44);
    }
    const actionDock = tree!.root.findAllByProps({
      testID: 'learning-action-dock',
    });
    if (interactionId === 'swipe' || interactionId === 'lock') {
      expect(actionDock).toHaveLength(0);
    } else {
      expect(actionDock.length).toBeGreaterThan(0);
      const dock = tree!.root.findByProps({ testID: 'learning-action-dock' });
      if (interactionId === 'flip') {
        expect(
          dock.findAllByProps({ testID: 'learning-flip-button' }).length,
        ).toBeGreaterThan(0);
      } else {
        expect(
          dock.findAllByProps({ testID: 'learning-submit-button' }).length,
        ).toBeGreaterThan(0);
      }
      expect(
        dock.findAllByProps({ testID: 'learning-peek-button' }),
      ).toHaveLength(0);
      expect(
        dock.findAllByProps({ testID: 'learning-favorite-button' }),
      ).toHaveLength(0);
      expect(
        dock.findAllByProps({ testID: 'learning-hint-button' }),
      ).toHaveLength(0);
    }

    ReactTestRenderer.act(() => tree!.unmount());
  }
  expect(new Set(envelopeHeights).size).toBe(1);
});

test('long prompts, options, and flip backs remain complete inside the task scroll region', () => {
  const session = createLocalLearningSession('cet4');
  const multipleChoice = session.cards.find(
    card => card.interaction_id === 'multiple_choice',
  );
  const flip = session.cards.find(card => card.interaction_id === 'flip');
  if (
    !multipleChoice ||
    multipleChoice.interaction_id !== 'multiple_choice' ||
    !flip ||
    flip.interaction_id !== 'flip'
  ) {
    throw new Error('Expected multiple-choice and flip cards.');
  }

  const longPrompt = '长题干用于真实内容压力测试。'.repeat(36);
  const longOption = '长选项必须完整显示并由任务区滚动承载。'.repeat(18);
  const longBack = '长解析必须完整显示，不能因为外层卡片稳定而被截断。'.repeat(
    30,
  );
  const longChoiceCard = {
    ...multipleChoice,
    front: { ...multipleChoice.front, prompt: longPrompt },
    options: multipleChoice.options.map(option => ({
      ...option,
      text: longOption,
    })),
  };
  const flippedState = createLearningCardState(flip);
  flippedState.isFlipped = true;
  const longFlipCard = { ...flip, back_text: longBack };

  const render = (card: LearningCard, state: LearningCardState) => (
    <LearningSurface
      audioAttemptId={null}
      completedResults={[]}
      currentCard={card}
      currentCardState={state}
      currentIndex={0}
      currentResult={null}
      onAdvanceCard={jest.fn()}
      onFlip={jest.fn()}
      onRestartDeck={jest.fn()}
      onSelectOption={jest.fn()}
      onSelectSwipeState={jest.fn()}
      onSetFlipConfidence={jest.fn()}
      onSetLockSelection={jest.fn()}
      onSubmitCurrentCard={jest.fn()}
      onToggleEliminationItem={jest.fn()}
      onToggleFavorite={jest.fn()}
      onToggleHint={jest.fn()}
      onTogglePeek={jest.fn()}
      palette={palette}
      phase="learning"
      reviewCandidateCount={0}
      sessionCards={[card]}
      sessionLabel={session.sourceLabel}
    />
  );

  let tree: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      render(longChoiceCard, createLearningCardState(longChoiceCard)),
    );
  });
  expect(
    tree!.root.findByProps({ children: longPrompt }).props.numberOfLines,
  ).toBeUndefined();
  for (const optionText of tree!.root.findAllByProps({
    children: longOption,
  })) {
    expect(optionText.props.numberOfLines).toBeUndefined();
  }

  ReactTestRenderer.act(() => {
    tree!.update(render(longFlipCard, flippedState));
  });
  expect(
    tree!.root.findByProps({ children: longBack }).props.numberOfLines,
  ).toBeUndefined();
});

test.each(['lock', 'elimination', 'swipe'] as const)(
  '%s keeps required material readable in the component alongside an opened hint',
  interactionId => {
    const session = createLocalLearningSession('cet4');
    const card = session.cards.find(
      candidate => candidate.interaction_id === interactionId,
    )!;
    const cardState = createLearningCardState(card);
    cardState.hasUsedHint = true;
    cardState.hasUsedPeek = true;
    cardState.isHintVisible = true;
    cardState.isPeeked = true;
    let tree: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <LearningSurface
          audioAttemptId={null}
          completedResults={[]}
          currentCard={card}
          currentCardState={cardState}
          currentIndex={0}
          currentResult={null}
          onAdvanceCard={jest.fn()}
          onFlip={jest.fn()}
          onRestartDeck={jest.fn()}
          onSelectOption={jest.fn()}
          onSelectSwipeState={jest.fn()}
          onSetFlipConfidence={jest.fn()}
          onSetLockSelection={jest.fn()}
          onSubmitCurrentCard={jest.fn()}
          onToggleEliminationItem={jest.fn()}
          onToggleFavorite={jest.fn()}
          onToggleHint={jest.fn()}
          onTogglePeek={jest.fn()}
          palette={palette}
          phase="learning"
          reviewCandidateCount={0}
          sessionCards={[card]}
          sessionLabel={session.sourceLabel}
        />,
      );
    });

    expect(
      tree!.root.findByProps({ testID: 'learning-help-content' }),
    ).toBeTruthy();
    expect(visibleText(tree!.toJSON())).toContain(card.front.support);
    expect(visibleText(tree!.toJSON())).toContain(card.front.context);
    expect(visibleText(tree!.toJSON())).toContain(card.analysis.exam_tip);
    if (card.hint_layer) {
      expect(JSON.stringify(tree!.toJSON())).toContain(card.hint_layer.content);
    }
  },
);

test('swipe gesture commits at 25% distance or the velocity threshold', () => {
  expect(SWIPE_DISTANCE_THRESHOLD_RATIO).toBe(0.25);
  expect(SWIPE_VELOCITY_THRESHOLD).toBe(0.65);
  expect(
    resolveSwipeGestureDirection({ cardWidth: 320, dx: -79, vx: -0.64 }),
  ).toBeNull();
  expect(resolveSwipeGestureDirection({ cardWidth: 320, dx: -80, vx: 0 })).toBe(
    'left',
  );
  expect(
    resolveSwipeGestureDirection({ cardWidth: 320, dx: 79, vx: 0.65 }),
  ).toBe('right');
  expect(
    resolveSwipeGestureDirection({ cardWidth: 320, dx: 10, vx: -0.7 }),
  ).toBe('left');
});

test('keeps verified audio as an explicit accessible chip attached to the card', () => {
  const session = createLocalLearningSession('cet4');
  const currentCard = {
    ...session.catalogCards[0],
    audio: {
      asset_id: 'cet4.audio.001',
      duration_ms: 2100,
      sha256: `sha256:${'a'.repeat(64)}`,
    },
  };

  let tree: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LearningSurface
        audioAttemptId="local-test-attempt-001"
        completedResults={[]}
        contentManifest={{
          access: {
            accessible_card_count: 1,
            mode: 'full',
            total_card_count: 1,
          },
          downloads: [
            {
              asset_id: currentCard.audio.asset_id,
              expires_at: '2030-01-01T00:00:00.000Z',
              url: 'https://private-content.example/audio.mp3?token=opaque',
            },
          ],
          manifest: {
            assets: [
              {
                asset_id: currentCard.audio.asset_id,
                duration_ms: currentCard.audio.duration_ms,
                media_type: 'audio/mpeg',
                sha256: currentCard.audio.sha256,
                size_bytes: 4096,
              },
            ],
            content_version: `sha256:${'b'.repeat(64)}`,
            minimum_client_version: '1.0.0',
            parent_release_id: null,
            release_id: 'cet4-release-1',
            schema_version: 'content-manifest.v1',
            track: 'cet4',
          },
          signature: {
            algorithm: 'ed25519',
            key_id: 'content-key-1',
            value: 'c'.repeat(128),
          },
        }}
        currentCard={currentCard}
        currentCardState={createLearningCardState(currentCard)}
        currentIndex={0}
        currentResult={null}
        onAdvanceCard={jest.fn()}
        onFlip={jest.fn()}
        onRestartDeck={jest.fn()}
        onSelectOption={jest.fn()}
        onSelectSwipeState={jest.fn()}
        onSetFlipConfidence={jest.fn()}
        onSetLockSelection={jest.fn()}
        onSubmitCurrentCard={jest.fn()}
        onToggleEliminationItem={jest.fn()}
        onToggleFavorite={jest.fn()}
        onToggleHint={jest.fn()}
        onTogglePeek={jest.fn()}
        palette={palette}
        phase="learning"
        reviewCandidateCount={0}
        sessionCards={[currentCard]}
        sessionLabel={session.sourceLabel}
      />,
    );
  });

  const control = tree!.root.findByProps({ testID: 'learning-audio-control' });
  expect(control.props.accessibilityRole).toBe('button');
  expect(control.props.accessibilityLabel).toBe('播放音频');
  expect(control.props.accessibilityState).toEqual({
    busy: false,
    disabled: false,
    selected: false,
  });
  expect(
    tree!.root.findByType(LearningAudioPlayer).props.selection,
  ).toMatchObject({
    authorityToken: 'local-test-attempt-001',
    cardToken: `${currentCard.card_id}:${currentCard.audio.sha256}`,
  });
  expect(JSON.stringify(tree!.toJSON())).not.toContain(
    'private-content.example',
  );
});

test('does not expose raw space metadata while learning', () => {
  const session = createLocalLearningSession('cet4');
  const currentCard = {
    ...session.catalogCards[0],
    space_metadata: {
      box: 'raw-learning-box',
      box_ref: 'raw-learning-box-ref',
      group: 'raw-learning-group',
      library: 'raw-learning-library',
    },
  };
  const sessionCards = [currentCard, ...session.catalogCards.slice(1)];
  const currentCardState = {
    ...createLearningCardState(currentCard),
    isPeeked: true,
  };

  let tree: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LearningSurface
        audioAttemptId="local-test-attempt-002"
        palette={palette}
        sessionCards={sessionCards}
        sessionLabel="LEAK_SENTINEL_INTERNAL_SOURCE_7A"
        phase="learning"
        currentCard={currentCard}
        currentCardState={currentCardState}
        currentIndex={0}
        currentResult={null}
        completedResults={[]}
        reviewCandidateCount={0}
        onTogglePeek={jest.fn()}
        onToggleFavorite={jest.fn()}
        onToggleHint={jest.fn()}
        onFlip={jest.fn()}
        onSetFlipConfidence={jest.fn()}
        onSelectOption={jest.fn()}
        onSetLockSelection={jest.fn()}
        onToggleEliminationItem={jest.fn()}
        onSelectSwipeState={jest.fn()}
        onSubmitCurrentCard={jest.fn()}
        onAdvanceCard={jest.fn()}
        onRestartDeck={jest.fn()}
      />,
    );
  });

  const output = JSON.stringify(tree!.toJSON());

  const progressLabel = tree!.root.findByProps({
    testID: 'learning-progress-label',
  });
  expect(progressLabel.props.children).toContain('当前书架');
  expect(
    tree!.root.findByProps({ testID: 'learning-card-address-shelf' }),
  ).toBeTruthy();
  expect(
    tree!.root.findAllByProps({ testID: 'learning-card-location-strip' }),
  ).toHaveLength(0);
  expect(output).not.toContain('第 1 张');
  expect(output).not.toContain('共 7 张');
  expect(output).not.toContain('本组第');
  expect(output).not.toContain('学习进度');
  expect(tree!.root.findByProps({testID: 'learning-flip-button'})).toBeTruthy();
  expect(output).not.toContain('先读题干');
  expect(output).not.toContain('先判断，再确认解析');
  expect(output).not.toContain('先做这一张');
  expect(output).not.toContain('当前这一张');
  expect(output).toContain('当前卡盒');
  expect(output).not.toContain('raw-learning');
  expect(output).not.toContain('位置保持');
  expect(output).not.toContain('位置 · 本轮盒');
  expect(output).not.toContain('当前位置 · 本轮盒');
  expect(output).not.toContain('当前馆 · 本轮盒');
  expect(output).not.toContain('位置已保持');
  expect(output).not.toContain('先完成这一张，再继续下一步');
  expect(output).not.toContain('系统递给你当前这一张');
  expect(output).toContain('当前书架');
  expect(output).not.toContain('LEAK_SENTINEL_INTERNAL_SOURCE_7A');
  expect(output).not.toContain('本组第');
  expect(output).not.toContain('这一组学习卡');
  expect(output).not.toContain('这组复习卡');
  expect(output).not.toContain('这一组已经按学习节奏走完');
  expect(output).not.toContain('再练一轮这一组');
  expect(output).not.toContain('复习这一组');
  expect(output).not.toContain('系统顺序');
  expect(output).not.toContain('系统顺序学习');
  expect(output).not.toContain('当前学习会话');
  expect(output).toContain('查看答案');
  expect(tree!.root.findByProps({testID:'learning-peek-button'}).props.accessibilityState.expanded).toBe(true);
  expect(output).not.toContain('先翻面，看完解析后选有把握或需要复习。');
  expect(output).toContain('查看提示');
  expect(output).not.toContain('要一点线索');
  expect(output).not.toContain('收起这点线索');
  expect(output).toContain('收起思路');
  expect(output).toContain(currentCard.analysis.exam_tip);
  expect(output).not.toContain('这张卡为什么出现');
  expect(output).not.toContain('该题来自当前练习安排');
  expect(output).not.toContain('同盒继续');
  expect(output).not.toContain('同盒位置保持');
  expect(output).not.toContain('同盒位置已保持');
  expect(output).not.toContain('这张在：');
  expect(output).not.toContain('当前位置：');
  expect(tree!.root.findByProps({testID:'learning-current-card'})).toBeTruthy();
  ReactTestRenderer.act(() => {const help = tree!.root.findByProps({testID: 'learning-help-button'}); if (!help.props.accessibilityState.expanded) help.props.onPress();});
  for (const target of ['learning-peek-button', 'learning-hint-button', 'learning-flip-button']) {
    expect(tree!.root.findByProps({testID:target}).props.onPress).toBeDefined();
  }
  ReactTestRenderer.act(() => tree!.unmount());
});

test('multiple choice submit is a compact action dock tied to selection state', () => {
  const session = createLocalLearningSession('cet4');
  const currentCard = session.cards.find(
    sessionCard => sessionCard.interaction_id === 'multiple_choice',
  );

  if (!currentCard || currentCard.interaction_id !== 'multiple_choice') {
    throw new Error('Expected a multiple choice card in the local session.');
  }

  const onSubmitCurrentCard = jest.fn();

  let tree: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LearningSurface
        audioAttemptId="local-test-attempt-003"
        palette={palette}
        sessionCards={session.cards}
        sessionLabel={session.sourceLabel}
        phase="learning"
        currentCard={currentCard}
        currentCardState={createLearningCardState(currentCard)}
        currentIndex={1}
        currentResult={null}
        completedResults={[]}
        reviewCandidateCount={0}
        onTogglePeek={jest.fn()}
        onToggleFavorite={jest.fn()}
        onToggleHint={jest.fn()}
        onFlip={jest.fn()}
        onSetFlipConfidence={jest.fn()}
        onSelectOption={jest.fn()}
        onSetLockSelection={jest.fn()}
        onToggleEliminationItem={jest.fn()}
        onSelectSwipeState={jest.fn()}
        onSubmitCurrentCard={onSubmitCurrentCard}
        onAdvanceCard={jest.fn()}
        onRestartDeck={jest.fn()}
      />,
    );
  });

  let output = JSON.stringify(tree!.toJSON());
  expect(
    tree!.root.findByProps({ testID: 'learning-action-dock' }),
  ).toBeTruthy();
  expect(
    StyleSheet.flatten(
      tree!.root.findByProps({ testID: 'learning-current-card' }).props.style,
    ).flexGrow,
  ).toBe(0);
  expect(
    StyleSheet.flatten(
      tree!.root.findByProps({ testID: 'learning-action-dock' }).props.style,
    ).flexShrink,
  ).toBe(0);
  const optionGridStyle = StyleSheet.flatten(
    tree!.root.findByProps({ testID: 'learning-option-grid' }).props.style,
  );
  expect(optionGridStyle.flexGrow).toBe(0);
  expect(optionGridStyle.alignContent).toBe('flex-start');
  expect(
    StyleSheet.flatten(
      tree!.root.findByProps({ testID: 'learning-option-1' }).props.style,
    ).minHeight,
  ).toBeGreaterThanOrEqual(44);
  expect(
    tree!.root.findByProps({ testID: 'learning-submit-button' }).props.disabled,
  ).toBe(true);
  expect(
    StyleSheet.flatten(
      tree!.root.findByProps({ testID: 'learning-submit-button' }).props.style,
    ).minHeight,
  ).toBeGreaterThanOrEqual(48);
  expect(output).not.toContain('先选一个答案');
  expect(output).not.toContain('完成选择后再看解析');
  expect(output).not.toContain('queue');
  expect(output).not.toContain('payload');

  ReactTestRenderer.act(() => {
    tree!.update(
      <LearningSurface
        audioAttemptId="local-test-attempt-003"
        palette={palette}
        sessionCards={session.cards}
        sessionLabel={session.sourceLabel}
        phase="learning"
        currentCard={currentCard}
        currentCardState={{
          ...createLearningCardState(currentCard),
          selectedOptionId: currentCard.options[0].id,
        }}
        currentIndex={1}
        currentResult={null}
        completedResults={[]}
        reviewCandidateCount={0}
        onTogglePeek={jest.fn()}
        onToggleFavorite={jest.fn()}
        onToggleHint={jest.fn()}
        onFlip={jest.fn()}
        onSetFlipConfidence={jest.fn()}
        onSelectOption={jest.fn()}
        onSetLockSelection={jest.fn()}
        onToggleEliminationItem={jest.fn()}
        onSelectSwipeState={jest.fn()}
        onSubmitCurrentCard={onSubmitCurrentCard}
        onAdvanceCard={jest.fn()}
        onRestartDeck={jest.fn()}
      />,
    );
  });

  output = JSON.stringify(tree!.toJSON());
  const currentTone = resolveLibraryTone(currentCard.space_metadata.library);
  const enabledSubmit = tree!.root.findByProps({
    testID: 'learning-submit-button',
  });
  expect(enabledSubmit.props.disabled).toBe(false);
  expect(StyleSheet.flatten(enabledSubmit.props.style).backgroundColor).toBe(
    currentTone.accent,
  );
  expect(tree!.root.findByProps({testID:'learning-option-1'}).props.accessibilityState.checked).toBe(true);
  ReactTestRenderer.act(() => enabledSubmit.props.onPress());
  expect(onSubmitCurrentCard).toHaveBeenCalledTimes(1);
  expect(output).not.toContain(`已选 ${currentCard.options[0].label}`);
  expect(output).not.toContain('提交后立即看解析');
  expect(output).not.toContain(currentCard.space_metadata.box_ref);
});

test('resolved cards keep analysis in the material sheet and continuation in the action rail', () => {
  const session = createLocalLearningSession('cet4');
  const card = session.cards.find(
    candidate => candidate.interaction_id === 'multiple_choice',
  );
  if (!card || card.interaction_id !== 'multiple_choice') {
    throw new Error('Expected a multiple-choice card.');
  }

  let tree: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LearningSurface
        audioAttemptId={null}
        completedResults={[]}
        currentCard={card}
        currentCardState={{
          ...createLearningCardState(card),
          selectedOptionId: card.answer_key.correct_option,
        }}
        currentIndex={1}
        currentResult={{
          cardId: card.card_id,
          completedAt: '2026-09-03T08:00:00.000Z',
          interactionId: card.interaction_id,
          isFavorited: false,
          outcome: 'correct',
          usedHint: false,
          usedPeek: false,
        }}
        onAdvanceCard={jest.fn()}
        onFlip={jest.fn()}
        onOpenResultDetail={jest.fn()}
        onRestartDeck={jest.fn()}
        onSelectOption={jest.fn()}
        onSelectSwipeState={jest.fn()}
        onSetFlipConfidence={jest.fn()}
        onSetLockSelection={jest.fn()}
        onSubmitCurrentCard={jest.fn()}
        onToggleEliminationItem={jest.fn()}
        onToggleFavorite={jest.fn()}
        onToggleHint={jest.fn()}
        onTogglePeek={jest.fn()}
        palette={palette}
        phase="learning"
        reviewCandidateCount={0}
        sessionCards={session.cards}
        sessionLabel={session.sourceLabel}
      />,
    );
  });

  const sheet = tree!.root.findByProps({ testID: 'learning-material-sheet' });
  const actionRail = tree!.root.findByProps({ testID: 'learning-action-dock' });
  expect(
    sheet.findAllByProps({ testID: 'learning-open-result-detail-button' })
      .length,
  ).toBeGreaterThan(0);
  expect(sheet.findAllByProps({ testID: 'learning-next-button' })).toHaveLength(
    0,
  );
  expect(
    actionRail.findAllByProps({ testID: 'learning-next-button' }).length,
  ).toBeGreaterThan(0);
  expect(
    actionRail.findAllByProps({ testID: 'learning-open-result-detail-button' }),
  ).toHaveLength(0);
  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain(card.analysis.summary);
  expect(tree!.root.findByProps({testID: 'learning-open-result-detail-button'}).props.onPress).toBeDefined();
  expect(output).toContain('正确答案');
  expect(output).not.toContain('解析已准备好');
});

test('lock rows reveal the next controls only after the current row is correct', () => {
  const session = createLocalLearningSession('cet4');
  const currentCard = session.cards.find(
    sessionCard => sessionCard.interaction_id === 'lock',
  );

  if (!currentCard || currentCard.interaction_id !== 'lock') {
    throw new Error('Expected a lock card in the local session.');
  }

  const cardState = createLearningCardState(currentCard);
  const onSubmitCurrentCard = jest.fn();
  const renderSurface = () => (
    <LearningSurface
      audioAttemptId="local-test-attempt-004"
      completedResults={[]}
      currentCard={currentCard}
      currentCardState={cardState}
      currentIndex={2}
      currentResult={null}
      onAdvanceCard={jest.fn()}
      onFlip={jest.fn()}
      onRestartDeck={jest.fn()}
      onSelectOption={jest.fn()}
      onSelectSwipeState={jest.fn()}
      onSetFlipConfidence={jest.fn()}
      onSetLockSelection={jest.fn()}
      onSubmitCurrentCard={onSubmitCurrentCard}
      onToggleEliminationItem={jest.fn()}
      onToggleFavorite={jest.fn()}
      onToggleHint={jest.fn()}
      onTogglePeek={jest.fn()}
      palette={palette}
      phase="learning"
      reviewCandidateCount={0}
      sessionCards={session.cards}
      sessionLabel={session.sourceLabel}
    />
  );
  let tree: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(renderSurface());
  });

  const firstSlot = currentCard.lock_slots[0];
  const secondSlot = currentCard.lock_slots[1];
  const firstExpected = currentCard.answer_key.lock_pattern[0];
  const firstWrong = firstSlot.options.find(
    option => option !== firstExpected,
  )!;
  const findChoice = (label: string, option: string) =>
    tree!.root.findByProps({ accessibilityLabel: `${label}，${option}` });

  expect(
    findChoice(firstSlot.label, firstExpected).props.accessibilityRole,
  ).toBe('radio');
  expect(
    findChoice(firstSlot.label, firstExpected).props.accessibilityState,
  ).toEqual({ checked: false, disabled: false });
  expect(tree!.root.findAllByProps({accessibilityLabel: `${secondSlot.label}，${secondSlot.options[0]}`})).toHaveLength(0);

  cardState.lockSelections[firstSlot.id] = firstWrong;
  ReactTestRenderer.act(() => {
    tree!.update(renderSurface());
  });

  expect(JSON.stringify(tree!.toJSON())).toContain('再试一次');
  expect(canSubmitLearningCard(currentCard, cardState)).toBe(false);
  expect(tree!.root.findAllByProps({testID: 'learning-submit-button'})).toHaveLength(0);

  cardState.lockSelections[firstSlot.id] = firstExpected;
  ReactTestRenderer.act(() => {
    tree!.update(renderSurface());
  });

  expect(tree!.root.findAllByProps({accessibilityLabel: `${firstSlot.label}，${firstExpected}`})).toHaveLength(0);
  expect(tree!.root.findByProps({testID:'learning-forming-sentence'}).props.children).toContain(firstExpected);
  expect(
    findChoice(secondSlot.label, secondSlot.options[0]).props.accessibilityState
      .disabled,
  ).toBe(false);

  currentCard.lock_slots.forEach((slot, index) => {
    cardState.lockSelections[slot.id] =
      currentCard.answer_key.lock_pattern[index];
  });
  ReactTestRenderer.act(() => {
    tree!.update(renderSurface());
  });

  expect(canSubmitLearningCard(currentCard, cardState)).toBe(true);
  expect(tree!.root.findAllByProps({testID: 'learning-submit-button'})).toHaveLength(0);
  expect(tree!.root.findByProps({testID:'learning-forming-sentence'}).props.children).toBe(currentCard.answer_key.lock_pattern.join(' '));
  expect(onSubmitCurrentCard).not.toHaveBeenCalled();
});

test('lock and elimination pressables keep 44x44 targets in standard and compact layouts', () => {
  const session = createLocalLearningSession('cet4');
  const lockCard = session.cards.find(card => card.interaction_id === 'lock');
  const eliminationCard = session.cards.find(
    card => card.interaction_id === 'elimination',
  );
  if (
    !lockCard ||
    lockCard.interaction_id !== 'lock' ||
    !eliminationCard ||
    eliminationCard.interaction_id !== 'elimination'
  ) {
    throw new Error(
      'Expected lock and elimination cards in the local session.',
    );
  }
  const renderCard = (card: typeof lockCard | typeof eliminationCard) => (
    <LearningSurface
      audioAttemptId="local-test-attempt-005"
      completedResults={[]}
      currentCard={card}
      currentCardState={createLearningCardState(card)}
      currentIndex={0}
      currentResult={null}
      onAdvanceCard={jest.fn()}
      onFlip={jest.fn()}
      onRestartDeck={jest.fn()}
      onSelectOption={jest.fn()}
      onSelectSwipeState={jest.fn()}
      onSetFlipConfidence={jest.fn()}
      onSetLockSelection={jest.fn()}
      onSubmitCurrentCard={jest.fn()}
      onToggleEliminationItem={jest.fn()}
      onToggleFavorite={jest.fn()}
      onToggleHint={jest.fn()}
      onTogglePeek={jest.fn()}
      palette={palette}
      phase="learning"
      reviewCandidateCount={0}
      sessionCards={session.cards}
      sessionLabel={session.sourceLabel}
    />
  );

  try {
    for (const viewport of [
      { height: 1133, width: 744 },
      { height: 700, width: 393 },
    ]) {
      ReactTestRenderer.act(() => {
        Dimensions.set({
          screen: { fontScale: 1, scale: 1, ...viewport },
          window: { fontScale: 1, scale: 1, ...viewport },
        });
      });
      let lockTree: ReactTestRenderer.ReactTestRenderer;
      let eliminationTree: ReactTestRenderer.ReactTestRenderer;
      ReactTestRenderer.act(() => {
        lockTree = ReactTestRenderer.create(renderCard(lockCard));
        eliminationTree = ReactTestRenderer.create(renderCard(eliminationCard));
      });

      const firstLockSlot = lockCard.lock_slots[0];
      const lockTargetStyle = StyleSheet.flatten(
        lockTree!.root.findByProps({
          accessibilityLabel: `${firstLockSlot.label}，${firstLockSlot.options[0]}`,
        }).props.style,
      );
      const eliminationTargetStyle = StyleSheet.flatten(
        eliminationTree!.root.findByProps({
          testID: 'learning-elimination-1',
        }).props.style,
      );
      expect(lockTargetStyle).toMatchObject({ minHeight: 48, minWidth: 48 });
      expect(eliminationTargetStyle.minHeight).toBeGreaterThanOrEqual(44);
      expect(eliminationTargetStyle.minWidth).toBeGreaterThanOrEqual(44);
      expect(eliminationTree!.root.findByProps({testID: 'learning-elimination-1'}).props.accessibilityRole).toBe('checkbox');

      ReactTestRenderer.act(() => {
        lockTree!.unmount();
        eliminationTree!.unmount();
      });
    }
  } finally {
    ReactTestRenderer.act(() => {
      Dimensions.set({
        screen: { fontScale: 1, height: 852, scale: 1, width: 393 },
        window: { fontScale: 1, height: 852, scale: 1, width: 393 },
      });
    });
  }
});

test('swipe choices stay compact enough for the one-screen phone action plane', () => {
  const session = createLocalLearningSession('cet4');
  const currentCard = session.cards.find(
    sessionCard => sessionCard.interaction_id === 'swipe',
  );

  if (!currentCard || currentCard.interaction_id !== 'swipe') {
    throw new Error('Expected a swipe card in the local session.');
  }

  let tree: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LearningSurface
        audioAttemptId="local-test-attempt-006"
        palette={palette}
        sessionCards={session.cards}
        sessionLabel={session.sourceLabel}
        phase="learning"
        currentCard={currentCard}
        currentCardState={createLearningCardState(currentCard)}
        currentIndex={4}
        currentResult={null}
        completedResults={[]}
        reviewCandidateCount={0}
        onTogglePeek={jest.fn()}
        onToggleFavorite={jest.fn()}
        onToggleHint={jest.fn()}
        onFlip={jest.fn()}
        onSetFlipConfidence={jest.fn()}
        onSelectOption={jest.fn()}
        onSetLockSelection={jest.fn()}
        onToggleEliminationItem={jest.fn()}
        onSelectSwipeState={jest.fn()}
        onSubmitCurrentCard={jest.fn()}
        onAdvanceCard={jest.fn()}
        onRestartDeck={jest.fn()}
      />,
    );
  });

  const safeChoice = tree!.root.findByProps({ testID: 'learning-swipe-1' });
  const draggableCard = tree!.root.findByProps({
    testID: 'learning-swipe-draggable-card',
  });
  const safeChoiceStyle = StyleSheet.flatten(safeChoice.props.style);
  const safeChoiceText = safeChoice.findAllByType(Text);
  const safeChoiceLabelStyle = StyleSheet.flatten(
    safeChoiceText[1].props.style,
  );
  const safeChoiceDescriptionStyle = StyleSheet.flatten(
    safeChoiceText[2].props.style,
  );

  expect(safeChoiceStyle.minWidth).toBe(0);
  expect(safeChoiceStyle.minHeight).toBe(48);
  expect(safeChoiceStyle.paddingVertical).toBe(4);
  expect(safeChoiceStyle.gap).toBe(3);
  expect(safeChoiceText).toHaveLength(3);
  expect(safeChoiceLabelStyle.fontSize).toBeGreaterThanOrEqual(13);
  expect(safeChoiceDescriptionStyle.fontSize).toBeGreaterThanOrEqual(13);
  expect(safeChoiceText[2].props.numberOfLines).toBeUndefined();
  expect(draggableCard.props.accessibilityRole).toBe('adjustable');
  expect(draggableCard.props.onResponderRelease).toEqual(expect.any(Function));
  expect(
    tree!.root.findAllByProps({ testID: 'learning-submit-button' }),
  ).toHaveLength(0);
});

test('completion state keeps the next step primary instead of a metric dashboard', () => {
  const session = createLocalLearningSession('cet4');
  const completedCard = session.catalogCards[0];

  let tree: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LearningSurface
        audioAttemptId="local-test-attempt-007"
        palette={palette}
        sessionCards={session.cards}
        sessionLabel={session.sourceLabel}
        phase="learning"
        currentCard={null}
        currentCardState={null}
        currentIndex={session.cards.length}
        currentResult={null}
        completedResults={[
          {
            cardId: completedCard.card_id,
            completedAt: '2026-05-21T12:00:00.000Z',
            interactionId: completedCard.interaction_id,
            isFavorited: false,
            outcome: 'review',
            usedHint: false,
            usedPeek: false,
          },
        ]}
        reviewCandidateCount={1}
        onTogglePeek={jest.fn()}
        onToggleFavorite={jest.fn()}
        onToggleHint={jest.fn()}
        onFlip={jest.fn()}
        onSetFlipConfidence={jest.fn()}
        onSelectOption={jest.fn()}
        onSetLockSelection={jest.fn()}
        onToggleEliminationItem={jest.fn()}
        onSelectSwipeState={jest.fn()}
        onSubmitCurrentCard={jest.fn()}
        onAdvanceCard={jest.fn()}
        onRestartDeck={jest.fn()}
        onStartReview={jest.fn()}
      />,
    );
  });

  const output = JSON.stringify(tree!.toJSON());

  expect(output).toContain('下一步');
  expect(output).toContain('开始复习这 ');
  expect(output).toContain('1');
  expect(output).toContain(' 张卡');
  expect(output).not.toContain('完成明细');
  expect(output).not.toContain('回答正确');
  expect(output).not.toContain('回答错误');
});

test('controlled-pilot round completion reuses the completion card with one canonical continue action', () => {
  const session = createLocalLearningSession('cet4');
  const onContinueRound = jest.fn();
  let tree: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LearningSurface
        audioAttemptId="local-test-attempt-008"
        palette={palette}
        sessionCards={[]}
        sessionLabel={session.sourceLabel}
        phase="learning"
        currentCard={null}
        currentCardState={null}
        currentIndex={0}
        currentResult={null}
        completedResults={[]}
        reviewCandidateCount={0}
        roundCompletion={{
          completedCount: 5,
          reviewCardCount: 2,
          spaceCard: session.catalogCards[0],
        }}
        onTogglePeek={jest.fn()}
        onToggleFavorite={jest.fn()}
        onToggleHint={jest.fn()}
        onFlip={jest.fn()}
        onSetFlipConfidence={jest.fn()}
        onSelectOption={jest.fn()}
        onSetLockSelection={jest.fn()}
        onToggleEliminationItem={jest.fn()}
        onSelectSwipeState={jest.fn()}
        onSubmitCurrentCard={jest.fn()}
        onAdvanceCard={jest.fn()}
        onRestartDeck={jest.fn()}
        onContinueRound={onContinueRound}
      />,
    );
  });
  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('完成 5 张卡');
  expect(output).toContain('5/5');
  expect(output).toContain('复习 2');
  expect(output).not.toContain('卡源');
  expect(output).toContain(session.catalogCards[0].space_metadata.library);
  expect(
    tree!.root.findAllByProps({ testID: 'learning-restart-button' }),
  ).toHaveLength(0);
  const button = tree!.root.findByProps({
    testID: 'learning-continue-round-button',
  });
  ReactTestRenderer.act(() => button.props.onPress());
  expect(onContinueRound).toHaveBeenCalledTimes(1);
});

test('result detail reads as a resolved card without raw metadata', () => {
  const session = createLocalLearningSession('cet4');
  const card = session.cards.find(
    sessionCard => sessionCard.interaction_id === 'multiple_choice',
  );

  if (!card || card.interaction_id !== 'multiple_choice') {
    throw new Error('Expected a multiple choice card in the local session.');
  }

  const cardState = {
    ...createLearningCardState(card),
    selectedOptionId: 'unclear',
  };

  const onAdvanceCard = jest.fn();
  let tree: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LearningResultDetailSurface
        card={card}
        cardState={cardState}
        currentIndex={1}
        isLastCard={false}
        onAdvanceCard={onAdvanceCard}
        onBackToPractice={jest.fn()}
        palette={palette}
        phase="learning"
        result={{
          cardId: card.card_id,
          completedAt: '2026-05-21T12:00:00.000Z',
          interactionId: card.interaction_id,
          isFavorited: false,
          outcome: 'correct',
          usedHint: false,
          usedPeek: false,
        }}
        sessionCardCount={3}
        sessionLabel={session.sourceLabel}
      />,
    );
  });

  const output = JSON.stringify(tree!.toJSON());
  const explanationScroll = tree!.root.findByProps({testID: 'learning-detail-resolved-card'});
  expect(explanationScroll.findAllByProps({testID: 'learning-next-button'})).toHaveLength(0);
  const dock = tree!.root.findByProps({testID: 'learning-detail-action-dock'});
  ReactTestRenderer.act(() => dock.findByProps({testID: 'learning-next-button'}).props.onPress());
  expect(onAdvanceCard).toHaveBeenCalledTimes(1);


  expect(
    tree!.root.findByProps({
      testID: 'learning-result-detail-screen',
    }),
  ).toBeTruthy();
  expect(
    tree!.root.findByProps({
      testID: 'learning-detail-selected-answer',
    }),
  ).toBeTruthy();
  expect(
    tree!.root.findByProps({
      testID: 'learning-detail-correct-answer',
    }),
  ).toBeTruthy();
  expect(
    tree!.root.findByProps({ testID: 'learning-detail-analysis-title' }).props
      .numberOfLines,
  ).toBeUndefined();
  expect(
    tree!.root.findByProps({ testID: 'learning-detail-analysis-body' }).props
      .numberOfLines,
  ).toBeUndefined();
  expect(
    tree!.root.findByProps({ testID: 'learning-detail-analysis-tip' }).props
      .numberOfLines,
  ).toBeUndefined();
  expect(output).toContain('2/3');
  expect(output).toContain(card.space_metadata.box);
  expect(output).toContain(card.space_metadata.group);
  expect(output).not.toContain('结果在当前卡');
  expect(output).toContain('四选一');
  expect(output).toContain('回答正确');
  expect(output).toContain('你的答案正确');
  expect(output).toContain('你的选择');
  expect(output).toContain('正确答案');
  expect(output).toContain('B · unclear');
  expect(output).toContain('已答对');
  expect(output).not.toContain('已作答 · 答对');
  expect(output).not.toContain('选择、答案和解释都在当前卡里');
  expect(output).not.toContain('位置保持');
  expect(output).not.toContain('本轮盒节奏保持');
  expect(output).not.toContain('下一张仍按本轮盒继续');
  expect(output).toContain('下一张');
  expect(output).not.toContain('knowledge_ref');
  expect(output).not.toContain('box_ref');
  expect(output).not.toContain(card.knowledge_ref);
  expect(output).not.toContain(card.space_metadata.box_ref);
});
