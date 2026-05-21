/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { LearningSurface } from '../src/learning/LearningSurface';
import {
  createLearningCardState,
  createLocalLearningSession,
} from '../src/learning/session';

const palette = {
  accent: '#7C8BFF',
  accentSoft: 'rgba(124,139,255,0.16)',
  accentStrong: '#3847B8',
  background: '#F1F0F6',
  border: 'rgba(29,31,42,0.12)',
  danger: '#D94C5C',
  panel: '#FFFFFF',
  panelStrong: '#F3F4F8',
  success: '#1E9B63',
  tabIdle: 'rgba(124,139,255,0.36)',
  text: '#1E1F2A',
  textMuted: '#686B7A',
  warning: '#B77900',
};

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
          palette={palette}
        sessionCards={sessionCards}
        sessionLabel={session.sourceLabel}
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

  expect(output).toContain('本组第 ');
  expect(output).not.toContain('学习进度');
  expect(output).toContain('先做这一张');
  expect(output).not.toContain('当前这一张');
  expect(output).toContain('先完成这一张，再继续下一步');
  expect(output).not.toContain('系统递给你当前这一张');
  expect(output).not.toContain('系统顺序');
  expect(output).not.toContain('系统顺序学习');
  expect(output).not.toContain('当前学习会话');
  expect(output).toContain('先翻面，看完解析后选有把握或再回看。');
  expect(output).toContain('先看这张卡的关键点');
  expect(output).toContain('先把题干里的信号抓出来，再回到选项或解析确认。');
  expect(output).not.toContain('这张卡为什么出现');
  expect(output).not.toContain('该题来自当前练习安排');
  expect(output).toContain('当前位置：');
  expect(output).toContain('馆 1 / 组 1 / 盒 1');
  expect(output).not.toContain(currentCard.space_metadata.library);
  expect(output).not.toContain(currentCard.space_metadata.group);
  expect(output).not.toContain(currentCard.space_metadata.box);
  expect(output).not.toContain(currentCard.space_metadata.box_ref);
  expect(output).not.toContain('训练轨道');
});

test('completion state keeps the next step primary instead of a metric dashboard', () => {
  const session = createLocalLearningSession('cet4');
  const completedCard = session.catalogCards[0];

  let tree: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LearningSurface
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
  expect(output).toContain('开始回看这 ');
  expect(output).toContain('1');
  expect(output).toContain(' 张卡');
  expect(output).not.toContain('完成明细');
  expect(output).not.toContain('自动判对');
  expect(output).not.toContain('自动判错');
});
