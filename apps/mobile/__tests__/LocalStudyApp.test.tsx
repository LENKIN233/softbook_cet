import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalStudyApp } from '../src/local/LocalStudyApp';
import { LearningSurface } from '../src/learning/LearningSurface';
import { NativeMotionProvider } from '../src/learning/NativeMotion';
import {USER_STATE_STORAGE_KEY} from '../src/persistence/userStateStore';
import type {LearningCard} from '../src/learning/model';

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
    loadCatalog: async (_context: unknown, track: 'cet4' | 'cet6') => ({
      ...require('./fixtures/interactionSession').createLocalLearningSession(track),
      cards: [], serverSelection: null, roundCompletion: null, membershipStage: null,
    }),
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
  if (id.startsWith('route-tab-') && !tree.root.findAllByProps({testID: id}).length) await press(tree, 'learning-pause-button');
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
  if (card.interaction_id === 'lock') {
    for (const slot of card.lock_slots) {
      await act(() => surface(tree).onSetLockSelection(slot.id, card.answer_key.lock_pattern[card.lock_slots.indexOf(slot)]));
      await settle();
    }
  } else if (card.interaction_id === 'elimination') {
    for (const id of card.answer_key.correct_items) {
      await act(() => surface(tree).onToggleEliminationItem(id));
      await settle();
    }
  } else await act(() => {
    if (card.interaction_id === 'flip') props.onSetFlipConfidence('confident');
    else if (card.interaction_id === 'swipe')
      props.onSelectSwipeState(card.answer_key.correct_state);
    else if (card.interaction_id === 'multiple_choice')
      props.onSelectOption(card.answer_key.correct_option);
  });
  await settle();
  if (card.interaction_id === 'multiple_choice' || card.interaction_id === 'elimination') {
    await act(() => surface(tree).onSubmitCurrentCard());
    await settle();
  }
  expect(surface(tree).currentResult).not.toBeNull();
  await act(() => surface(tree).onAdvanceCard());
  await settle();
}

test('local study starts from its home and preserves the task across pause and explicit Space return', async () => {
  const tree = await render();
  try {
    await press(tree, 'local-start-learning-button');
    expect(tree.root.findByProps({testID: 'learning-study-home'})).toBeTruthy();
    expect(tree.root.findAllByType(LearningSurface)).toHaveLength(0);
    expect(tree.root.findByProps({testID: 'learning-home-today-count'}).props.children).toBe('0 张');
    await press(tree, 'learning-home-start-button');
    const cardId = surface(tree).currentCard.card_id;
    await act(() => surface(tree).onToggleHint()); await settle();
    const draft = surface(tree).currentCardState;
    await press(tree, 'learning-pause-button');
    expect(tree.root.findByProps({testID: 'learning-study-home'})).toBeTruthy();
    expect(tree.root.findByProps({testID: 'learning-home-round-progress'}).props.children).toContain('已完成 0/');
    for (const route of ['learning', 'space', 'statistics', 'mine']) expect(tree.root.findByProps({testID: `route-tab-${route}`})).toBeTruthy();
    await press(tree, 'learning-home-start-button');
    expect(surface(tree).currentCard.card_id).toBe(cardId);
    expect(surface(tree).currentCardState).toEqual(draft);
    expect(tree.root.findAllByProps({testID: 'route-tab-mine'})).toHaveLength(0);
    await press(tree, 'route-tab-space');
    await press(tree, 'space-return-learning');
    expect(tree.root.findByProps({testID: 'learning-study-scene'})).toBeTruthy();
    expect(surface(tree).currentCardState).toEqual(draft);
    await press(tree, 'learning-pause-button');
    await press(tree, 'route-tab-space');
    await press(tree, 'space-return-learning');
    expect(tree.root.findByProps({testID: 'learning-study-home'})).toBeTruthy();
    expect(tree.root.findAllByType(LearningSurface)).toHaveLength(0);
    await press(tree, 'learning-home-start-button');
    expect(surface(tree).currentCard.card_id).toBe(cardId);
    expect(surface(tree).currentCardState).toEqual(draft);
  } finally {await act(() => tree.unmount());}
});

test('leaving local study and restarting retains the selected answer, favorites and history', async () => {
  let tree = await render();
  await press(tree, 'local-start-learning-button');
  expect(tree.root.findByProps({testID: 'learning-study-home'})).toBeTruthy();
  await press(tree, 'learning-home-start-button');
  let foundChoice = false;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    if (tree.root.findAllByProps({testID: 'local-group-complete'}).length) {
      await press(tree, 'learning-restart-button');
      continue;
    }
    if (surface(tree).currentCard.interaction_id === 'multiple_choice') {foundChoice = true; break;}
    await resolve(tree);
  }
  expect(foundChoice).toBe(true);
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
  await press(tree, 'learning-home-start-button');
  expect(surface(tree).currentCard.card_id).toBe(original.card_id);
  expect(surface(tree).currentCardState.selectedOptionId).toBe(option);
  expect(surface(tree).currentCardState.isFavorited).toBe(true);
  await act(() => tree.unmount());
  tree = await render();
  await press(tree, 'local-start-learning-button');
  expect(tree.root.findByProps({testID: 'learning-study-home'})).toBeTruthy();
  await press(tree, 'learning-home-start-button');
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
  await press(tree, 'learning-home-start-button');
  await resolve(tree);
  const original = surface(tree).currentCard.card_id;
  await press(tree, 'route-tab-mine');
  await press(tree, 'local-track-cet6');
  expect(tree.root.findByProps({testID: 'learning-study-home'})).toBeTruthy();
  await press(tree, 'learning-home-start-button');
  expect(surface(tree).currentCard.track).toBe('cet6');
  await press(tree, 'route-tab-mine');
  await press(tree, 'local-track-cet4');
  await press(tree, 'learning-home-start-button');
  expect(surface(tree).currentCard.card_id).toBe(original);
  expect(
    await AsyncStorage.getItem('softbook-cet/study/v2/cet6'),
  ).not.toBeNull();
});

test.each([2, 0])('restores legacy native sleep records with %i available cards into a usable app', async remainingCount => {
  const cards: LearningCard[] = require('./fixtures/interactionSession').createLocalLearningSession('cet4').catalogCards;
  const remaining = remainingCount ? [cards[2], cards[5]] : [];
  const current = remaining.at(-1);
  const raw = JSON.stringify({owner_phone_number: '00000000000',
    learning_cursor: current ? {track: 'cet4', card_id: current.card_id} : null,
    space_card_state_by_id: Object.fromEntries(cards.map((card: {card_id: string}) => [card.card_id, {
      is_favorited: card.card_id === (current?.card_id ?? cards[0].card_id),
      is_sleeping: !remaining.some(item => item.card_id === card.card_id),
    }]))});
  await AsyncStorage.setItem(USER_STATE_STORAGE_KEY, raw);
  const tree = await render();
  try {
    const start = tree.root.findAllByProps({testID: 'local-start-learning-button'}).find(node => typeof node.props.onPress === 'function')!;
    expect(start.props.disabled).toBe(false);
    expect(await AsyncStorage.getItem('softbook-cet/study/v2/cet4/archive/legacy-native')).toBe(raw);
    expect(await AsyncStorage.getItem(USER_STATE_STORAGE_KEY)).toBe(raw);
    await press(tree, 'local-start-learning-button');
    await press(tree, 'learning-home-start-button');
    if (current) {
      expect(surface(tree).currentCard.card_id).toBe(current.card_id);
      expect(surface(tree).currentCardState.isFavorited).toBe(true);
      await resolve(tree);
    } else {
      expect(tree.root.findByProps({testID: 'local-group-complete'})).toBeTruthy();
      expect(tree.root.findAllByType(LearningSurface)).toHaveLength(0);
    }
    const saved = JSON.parse((await AsyncStorage.getItem('softbook-cet/study/v2/cet4'))!);
    expect(saved.state.sleeping).toEqual(cards.filter((card: {card_id: string}) => !remaining.some(item => item.card_id === card.card_id)).map((card: {card_id: string}) => card.card_id));
    expect(saved.state.favorites).toContain(current?.card_id ?? cards[0].card_id);
    expect(saved.state.results).toHaveLength(current ? 1 : 0);
  } finally {await act(() => tree.unmount());}
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
