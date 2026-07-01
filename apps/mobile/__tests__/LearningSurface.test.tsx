/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {
  LearningResultDetailSurface,
  LearningSurface,
} from '../src/learning/LearningSurface';
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

  const progressLabel = tree!.root.findByProps({
    testID: 'learning-progress-label',
  });
  expect(progressLabel.props.children).toBe('本轮学习卡');
  expect(
    tree!.root.findByProps({ testID: 'learning-card-address-shelf' }),
  ).toBeTruthy();
  expect(
    tree!.root.findByProps({ testID: 'learning-card-location-strip' }),
  ).toBeTruthy();
  expect(output).not.toContain('第 1 张');
  expect(output).not.toContain('共 7 张');
  expect(output).not.toContain('本组第');
  expect(output).not.toContain('学习进度');
  expect(output).toContain('当前卡');
  expect(output).toContain('先判断，再确认解析');
  expect(output).not.toContain('先做这一张');
  expect(output).not.toContain('当前这一张');
  expect(output).toContain('位置已保持');
  expect(output).not.toContain('先完成这一张，再继续下一步');
  expect(output).not.toContain('系统递给你当前这一张');
  expect(output).toContain('本轮学习卡');
  expect(output).not.toContain('本组第');
  expect(output).not.toContain('这一组学习卡');
  expect(output).not.toContain('这组回看卡');
  expect(output).not.toContain('这一组已经按学习节奏走完');
  expect(output).not.toContain('再练一轮这一组');
  expect(output).not.toContain('回看这一组');
  expect(output).not.toContain('系统顺序');
  expect(output).not.toContain('系统顺序学习');
  expect(output).not.toContain('当前学习会话');
  expect(output).toContain('先翻面，看完解析后选有把握或再回看。');
  expect(output).toContain('查看提示');
  expect(output).not.toContain('要一点线索');
  expect(output).not.toContain('收起这点线索');
  expect(output).toContain('先看这张卡的关键点');
  expect(output).toContain('先把题干里的信号抓出来，再回到选项或解析确认。');
  expect(output).not.toContain('这张卡为什么出现');
  expect(output).not.toContain('该题来自当前练习安排');
  expect(output).toContain('同盒位置已保持');
  expect(output).not.toContain('这张在：');
  expect(output).not.toContain('当前位置：');
  expect(output).not.toContain('馆 1 / 组 1 / 盒 1');
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

  let tree: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LearningResultDetailSurface
        card={card}
        cardState={cardState}
        isLastCard={false}
        onAdvanceCard={jest.fn()}
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
        sessionLabel={session.sourceLabel}
      />,
    );
  });

  const output = JSON.stringify(tree!.toJSON());

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
  expect(output).toContain('当前卡');
  expect(output).toContain('本卡答案');
  expect(output).toContain('你的选择');
  expect(output).toContain('正确答案');
  expect(output).toContain('B · unclear');
  expect(output).toContain('答对，继续保持节奏');
  expect(output).toContain('继续下一张');
  expect(
    JSON.stringify(
      tree!.root.findByProps({ testID: 'learning-next-button' }).props.style,
    ),
  ).toContain(palette.success);
  expect(output).not.toContain('knowledge_ref');
  expect(output).not.toContain('box_ref');
  expect(output).not.toContain(card.knowledge_ref);
  expect(output).not.toContain(card.space_metadata.box_ref);
});
