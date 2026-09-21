import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalStudyApp } from '../src/local/LocalStudyApp';
import { LearningSurface } from '../src/learning/LearningSurface';
import { NativeMotionProvider } from '../src/learning/NativeMotion';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});
jest.mock('../src/learning/learningRepository', () => ({
  createLearningSessionRepository: () => ({
    loadSession: async (_context: unknown, track: 'cet4' | 'cet6') =>
      require('./fixtures/interactionSession').createLocalLearningSession(
        track,
      ),
  }),
}));
const palette = {
  accent: '#6047C6',
  accentSoft: '#E9E4FF',
  accentStrong: '#46309F',
  activeSurface: '#EAE7DF',
  activeText: '#20232B',
  background: '#F5F3EE',
  border: '#E4E2DD',
  danger: '#A7394D',
  panel: '#FFFFFF',
  panelStrong: '#F7F6F2',
  primaryActionSurface: '#6047C6',
  primaryActionText: '#FFFFFF',
  primaryActionMuted: '#CCC',
  success: '#167956',
  tabIdle: '#7A718C',
  text: '#20232B',
  textMuted: '#69707A',
  warning: '#F5B100',
  warningText: '#6B4A00',
};
async function settle() {
  for (let i = 0; i < 10; i++)
    await act(async () => {
      for (let n = 0; n < 20; n++) await Promise.resolve();
    });
}
async function render() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(() => {
    tree = ReactTestRenderer.create(
      <NativeMotionProvider>
        <LocalStudyApp initialTrack="cet4" palette={palette} />
      </NativeMotionProvider>,
    );
  });
  await settle();
  return tree;
}
async function press(tree: ReactTestRenderer.ReactTestRenderer, id: string) {
  await act(() => {
    tree.root
      .findAllByProps({ testID: id })
      .find(item => typeof item.props.onPress === 'function')!
      .props.onPress();
  });
  await settle();
}
function surface(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.findByType(LearningSurface).props;
}
async function resolve(tree: ReactTestRenderer.ReactTestRenderer) {
  const props = surface(tree),
    card = props.currentCard;
  await act(() => {
    if (card.interaction_id === 'flip') props.onSetFlipConfidence('confident');
    else if (card.interaction_id === 'swipe')
      props.onSelectSwipeState(card.answer_key.correct_state);
    else if (card.interaction_id === 'multiple_choice')
      props.onSelectOption(card.answer_key.correct_option);
  });
  await settle();
  if (card.interaction_id === 'multiple_choice') {
    await act(() => surface(tree).onSubmitCurrentCard());
    await settle();
  }
  await act(() => surface(tree).onAdvanceCard());
  await settle();
}

test('leaving local study and restarting retains the selected answer, favorites and history', async () => {
  let tree = await render();
  await press(tree, 'local-start-learning-button');
  while (surface(tree).currentCard.interaction_id !== 'multiple_choice')
    await resolve(tree);
  const original = surface(tree).currentCard;
  const option = original.options[0].id;
  await act(() => surface(tree).onSelectOption(option));
  await settle();
  await act(() => surface(tree).onToggleFavorite());
  await settle();
  await press(tree, 'route-tab-mine');
  await press(tree, 'mine-account-logout-button');
  expect(
    await AsyncStorage.getItem('softbook-cet/study/v2/cet4'),
  ).not.toBeNull();
  await press(tree, 'local-start-learning-button');
  expect(surface(tree).currentCard.card_id).toBe(original.card_id);
  expect(surface(tree).currentCardState.selectedOptionId).toBe(option);
  expect(surface(tree).currentCardState.isFavorited).toBe(true);
  await act(() => tree.unmount());
  tree = await render();
  await press(tree, 'local-start-learning-button');
  expect(surface(tree).currentCard.card_id).toBe(original.card_id);
  expect(surface(tree).currentCardState.selectedOptionId).toBe(option);
  const saved = JSON.parse(
    (await AsyncStorage.getItem('softbook-cet/study/v2/cet4'))!,
  );
  expect(saved.state.results.length).toBeGreaterThan(0);
});

test('switching track keeps independent records and returns to the original question', async () => {
  const tree = await render();
  await press(tree, 'local-start-learning-button');
  await resolve(tree);
  const original = surface(tree).currentCard.card_id;
  await press(tree, 'route-tab-mine');
  await press(tree, 'local-track-cet6');
  expect(surface(tree).currentCard.track).toBe('cet6');
  await press(tree, 'route-tab-mine');
  await press(tree, 'local-track-cet4');
  expect(surface(tree).currentCard.card_id).toBe(original);
  expect(
    await AsyncStorage.getItem('softbook-cet/study/v2/cet6'),
  ).not.toBeNull();
});

test('a damaged profile is retained and exposes recovery actions before learning', async () => {
  await AsyncStorage.setItem('softbook-cet/study/v2/cet4', '{broken');
  const tree = await render();
  expect(JSON.stringify(tree.toJSON())).toContain('原内容已保留');
  expect(tree.root.findByProps({ testID: 'local-export-backup' })).toBeTruthy();
  expect(tree.root.findByProps({ testID: 'local-reset-records' })).toBeTruthy();
  expect(await AsyncStorage.getItem('softbook-cet/study/v2/cet4')).toBe(
    '{broken',
  );
  expect(
    tree.root.findByProps({ testID: 'local-start-learning-button' }).props
      .disabled,
  ).toBe(true);
});
