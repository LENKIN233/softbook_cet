import React from 'react';
import {Text} from 'react-native';
import Renderer from 'react-test-renderer';
import {LearningResultDetailSurface, LearningSurface, type LearningSurfacePalette} from '../src/learning/LearningSurface';
import {createLearningCardState, createLocalLearningSession, evaluateLearningCard} from './fixtures/interactionSession';

const palette: LearningSurfacePalette = {
  background: '#F5F3EE', panel: '#FFFFFF', panelStrong: '#F3F4F8', border: '#E4E2DD',
  text: '#20232B', textMuted: '#69707A', accent: '#5B6DF5', accentSoft: '#EBECFF',
  accentStrong: '#3847B8', tabIdle: '#69707A', success: '#167956', warning: '#795500', danger: '#A7394D',
};
const card = {
  ...createLocalLearningSession('cet4').cards[0],
  audio: {asset_id: 'listening-original', duration_ms: 1000, sha256: `sha256:${'a'.repeat(64)}`, transcript: 'The original listening passage.\nIts final line must remain readable.'},
};
const props = (overrides: Partial<React.ComponentProps<typeof LearningSurface>> = {}): React.ComponentProps<typeof LearningSurface> => ({
  audioAttemptId: null, palette, sessionCards: [card], sessionLabel: 'CET4', phase: 'learning',
  currentCard: card, currentCardState: createLearningCardState(card), currentIndex: 0, currentResult: null,
  completedResults: [], reviewCandidateCount: 0, onTogglePeek: jest.fn(), onToggleFavorite: jest.fn(),
  onToggleHint: jest.fn(), onFlip: jest.fn(), onSetFlipConfidence: jest.fn(), onSelectOption: jest.fn(),
  onSetLockSelection: jest.fn(), onToggleEliminationItem: jest.fn(), onSelectSwipeState: jest.fn(),
  onSubmitCurrentCard: jest.fn(), onOpenResultDetail: jest.fn(), onAdvanceCard: jest.fn(), onRestartDeck: jest.fn(),
  ...overrides,
});

test('the supplied listening original is hidden before answering and can be expanded after resolution', () => {
  let tree!: Renderer.ReactTestRenderer;
  Renderer.act(() => {tree = Renderer.create(<LearningSurface {...props()} />);});
  expect(tree.root.findAllByProps({testID: 'learning-transcript-toggle'})).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).not.toContain(card.audio.transcript);
  const state = {...createLearningCardState(card), isFlipped: true, flipConfidence: 'confident' as const};
  Renderer.act(() => {tree.update(<LearningSurface {...props({currentCardState: state, currentResult: evaluateLearningCard(card, state)})} />);});
  expect(tree.root.findAllByProps({testID: 'learning-transcript-text'})).toHaveLength(0);
  Renderer.act(() => {tree.root.findByProps({testID: 'learning-transcript-toggle'}).props.onPress();});
  expect(tree.root.findByProps({testID: 'learning-transcript-text'}).props.children).toBe(card.audio.transcript);
  expect(tree.root.findByProps({testID: 'learning-transcript-toggle'}).props.accessibilityState.expanded).toBe(true);
  Renderer.act(() => {tree.update(<LearningSurface {...props({currentCard: {...card, card_id: 'next-card'}})} />);});
  expect(tree.root.findAllByProps({testID: 'learning-transcript-text'})).toHaveLength(0);
  Renderer.act(() => tree.unmount());
});

test('complete analysis preserves a long answer and the optional original at ordinary text size', () => {
  if (card.interaction_id !== 'flip') throw new Error('Expected flip');
  const longCard = {...card, front: {...card.front, prompt: `${'Read the full question. '.repeat(25)}FINAL_QUESTION_LINE`}, back_text: `${'A complete explanation. '.repeat(40)}FINAL_ANSWER_LINE`};
  const state = {...createLearningCardState(longCard), isFlipped: true, flipConfidence: 'confident' as const};
  let tree!: Renderer.ReactTestRenderer;
  Renderer.act(() => {tree = Renderer.create(<LearningResultDetailSurface card={longCard} cardState={state} result={evaluateLearningCard(longCard, state)!}
    currentIndex={0} isLastCard palette={palette} phase="learning" sessionCardCount={1} sessionLabel="CET4" onAdvanceCard={jest.fn()} onBackToPractice={jest.fn()} />);});
  const answer = tree.root.findAllByType(Text).find(node => node.props.children === longCard.back_text)!;
  expect(answer.props.numberOfLines).toBeUndefined();
  expect(answer.props.children).toContain('FINAL_ANSWER_LINE');
  const question = tree.root.findAllByType(Text).find(node => node.props.children === longCard.front.prompt)!;
  expect(question.props.numberOfLines).toBeUndefined();
  Renderer.act(() => {tree.root.findByProps({testID: 'learning-transcript-toggle'}).props.onPress();});
  expect(tree.root.findByProps({testID: 'learning-transcript-text'}).props.children).toBe(card.audio.transcript);
  Renderer.act(() => tree.unmount());
});

test('the accessible swipe object names the actual question', () => {
  const swipe = createLocalLearningSession('cet4').cards.find(item => item.interaction_id === 'swipe')!;
  let tree!: Renderer.ReactTestRenderer;
  Renderer.act(() => {tree = Renderer.create(<LearningSurface {...props({currentCard: swipe, currentCardState: createLearningCardState(swipe), sessionCards: [swipe]})} />);});
  expect(tree.root.findByProps({testID: 'learning-swipe-draggable-card'}).props.accessibilityLabel).toContain(swipe.front.prompt);
  Renderer.act(() => tree.unmount());
});
