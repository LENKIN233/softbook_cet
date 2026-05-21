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
  const currentCardState = createLearningCardState(currentCard);

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

  expect(output).toContain('学习进度');
  expect(output).toContain('先翻面，看完解析后选有把握或再回看。');
  expect(output).toContain('当前位置：');
  expect(output).toContain('馆 1 / 组 1 / 盒 1');
  expect(output).not.toContain(currentCard.space_metadata.library);
  expect(output).not.toContain(currentCard.space_metadata.group);
  expect(output).not.toContain(currentCard.space_metadata.box);
  expect(output).not.toContain(currentCard.space_metadata.box_ref);
  expect(output).not.toContain('训练轨道');
});
