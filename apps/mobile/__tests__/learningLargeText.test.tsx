import React from 'react';
import {Dimensions} from 'react-native';
import Renderer from 'react-test-renderer';
import {LearningSurface} from '../src/learning/LearningSurface';
import {createLearningCardState, createLocalLearningSession} from './fixtures/interactionSession';

const palette = {accent: '#7C8BFF', accentSoft: '#EEEEFF', accentStrong: '#3847B8',
  background: '#F1F0F6', border: '#CCCCCC', danger: '#D94C5C', panel: '#FFFFFF',
  panelStrong: '#F3F4F8', success: '#1E9B63', tabIdle: '#777777', text: '#1E1F2A',
  textMuted: '#686B7A', warning: '#B77900'};

function setFontScale(fontScale: number) {
  Dimensions.set({window: {width: 402, height: 874, scale: 3, fontScale},
    screen: {width: 402, height: 874, scale: 3, fontScale}});
}

it('keeps the revealed card and open question while live type size changes, with actions still connected', () => {
  const original = {window: Dimensions.get('window'), screen: Dimensions.get('screen')};
  const session = createLocalLearningSession('cet4');
  const card = session.cards.find(item => item.interaction_id === 'flip')!;
  const onConfidence = jest.fn();
  let tree!: Renderer.ReactTestRenderer;
  try {
    Renderer.act(() => {
      setFontScale(1);
      tree = Renderer.create(<LearningSurface audioAttemptId="test-type-scale"
        palette={palette} sessionCards={session.cards} sessionLabel={session.sourceLabel}
        phase="learning" currentCard={card} currentCardState={{...createLearningCardState(card), isFlipped: true}}
        currentIndex={0} currentResult={null} completedResults={[]} reviewCandidateCount={0}
        onToggleHint={jest.fn()} onTogglePeek={jest.fn()} onToggleFavorite={jest.fn()}
        onFlip={jest.fn()} onSetFlipConfidence={onConfidence} onSelectOption={jest.fn()}
        onSetLockSelection={jest.fn()} onToggleEliminationItem={jest.fn()}
        onSelectSwipeState={jest.fn()} onSubmitCurrentCard={jest.fn()}
        onAdvanceCard={jest.fn()} onRestartDeck={jest.fn()} />);
    });
    const question = tree.root.findByProps({testID: 'learning-question-toggle'});
    Renderer.act(() => question.props.onPress());
    for (const fontScale of [1.2999999523162842, 1.35, 3.12, 1.35, 1]) {
      Renderer.act(() => setFontScale(fontScale));
      // Rebuilding the shell would close this disclosure and discard local reading state.
      expect(tree.root.findByProps({testID: 'learning-question-toggle'})).toBe(question);
      expect(question.props.accessibilityState.expanded).toBe(true);
      expect(JSON.stringify(tree.toJSON())).toContain(card.front.prompt);
      expect(tree.root.findByProps({testID: 'learning-correct-answer'}).props.children).toBe(card.back_text);
      expect(tree.root.findByProps({testID: 'learning-viewport-scroll'}).props.scrollEnabled).toBe(fontScale > 1.29);
    }
    Renderer.act(() => tree.root.findByProps({testID: 'learning-flip-review-button'}).props.onPress());
    expect(onConfidence).toHaveBeenCalledWith('review');
  } finally {
    Renderer.act(() => {tree?.unmount(); Dimensions.set(original);});
  }
});
