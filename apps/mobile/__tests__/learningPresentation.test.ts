import React from 'react';
import Renderer from 'react-test-renderer';
import {Text} from 'react-native';
import {EliminationPassageText} from '../src/learning/EliminationPassageText';
import {
  answerComparison,
  eliminationPassage,
  frontMaterial,
} from '../src/learning/presentation';
import { localLearningCardRecords } from './fixtures/interactionCards';
import { createLearningCardState } from '../src/learning/sessionCore';
import { bundledCardLibrary } from '../src/learning/bundledCardLibrary';
import { normalizeLearningCardRecord } from '../src/learning/sourceContract';
import type { EliminationCard } from '../src/learning/model';

const elimination = localLearningCardRecords.find(
  card => card.interaction_id === 'elimination',
) as EliminationCard;

it('keeps every distinct front material while removing exact duplicate transport text', () => {
  const card = {
    ...elimination,
    front: {
      eyebrow: 'x',
      prompt: 'Question',
      support: 'Original sentence',
      context: 'Second required paragraph',
    },
  };
  expect(frontMaterial(card)).toEqual([
    'Original sentence',
    'Second required paragraph',
  ]);
  expect(
    frontMaterial({
      ...card,
      front: { ...card.front, context: 'Original sentence' },
    }),
  ).toEqual(['Original sentence']);
  expect(
    frontMaterial({ ...card, front: { ...card.front, support: 'Question' } }),
  ).toEqual(['Second required paragraph']);
});

it('removes only an explicitly labelled verbatim repeat of the visible task', () => {
  const original = elimination.front.support;
  const card = {...elimination, front: {...elimination.front, prompt: 'Keep the core sentence.',
    support: `${original}\n\n任务：Keep the core sentence.`, context: '任务：Keep the core sentence.'}};
  expect(frontMaterial(card)).toEqual([original]);
  const passage = eliminationPassage(card)!;
  expect(passage.source).toBe(original);
  expect(passage.segments.map(segment => segment.text).join('')).toBe(original);
  const different = {...card, front: {...card.front, support: `${original}\n\n任务：Keep the condition too.`}};
  expect(frontMaterial(different)).toEqual([different.front.support]);
});

it('maps every selectable phrase once while preserving the original sentence', () => {
  const passage = eliminationPassage(elimination)!;
  expect(passage.segments.map(segment => segment.text).join('')).toBe(
    elimination.front.support,
  );
  expect(
    passage.segments
      .flatMap(segment => (segment.itemId ? [segment.itemId] : []))
      .sort(),
  ).toEqual(elimination.elimination_items.map(item => item.id).sort());
});

it('falls back without inventing spans when a phrase repeats, overlaps or is missing', () => {
  const base = {
    ...elimination,
    front: {
      eyebrow: 'x',
      prompt: 'Question',
      support: 'the old book and the old book',
      context: 'Context',
    },
  };
  expect(
    eliminationPassage({
      ...base,
      elimination_items: [{ id: 'a', text: 'old book' }],
    }),
  ).toBeNull();
  expect(
    eliminationPassage({
      ...base,
      front: { ...base.front, support: 'the old book' },
      elimination_items: [
        { id: 'a', text: 'old book' },
        { id: 'b', text: 'book' },
      ],
    }),
  ).toBeNull();
  expect(
    eliminationPassage({
      ...base,
      elimination_items: [{ id: 'a', text: 'missing' }],
    }),
  ).toBeNull();
});

it('shows the actual selected and correct option text rather than an outcome-only label', () => {
  const card = localLearningCardRecords.find(
    item => item.interaction_id === 'multiple_choice',
  )!;
  const state = {
    ...createLearningCardState(card),
    selectedOptionId: 'urgent',
  };
  expect(answerComparison(card, state)).toEqual({
    correct: 'B · unclear',
    selected: 'A · urgent',
  });
});

it.each([
  ['012103', 'with many traveling from nearby towns · only a few cycling in warm weather'],
  ['012003', 'all the messages I was getting · were that I would never be taken seriously · given raises at the same rate as men'],
  ['061203', 'the conclusion · should be interpreted · with caution'],
  ['061205', 'several variables · were measured · only once'],
])('shows only verified deletion choices for real elimination card %s', (id, expected) => {
  const record = bundledCardLibrary.cet4.cards.find(item => item.card_id === id);
  if (record?.interaction_id !== 'elimination') throw new Error(`Missing real elimination card ${id}`);
  const card = normalizeLearningCardRecord(record) as EliminationCard;
  const state = createLearningCardState(card);
  state.eliminatedItemIds = card.answer_key.correct_items;
  expect(answerComparison(card, state).correct).toBe(expected);
});

it('removes a selected clause comma from the actual passage rendering', () => {
  const record = bundledCardLibrary.cet4.cards.find(item => item.card_id === '012103');
  if (record?.interaction_id !== 'elimination') throw new Error('Missing real elimination card 012103');
  const card = normalizeLearningCardRecord(record) as EliminationCard;
  const passage = eliminationPassage(card);
  if (!passage) throw new Error('Missing real sentence mapping');
  let tree!: Renderer.ReactTestRenderer;
  Renderer.act(() => {
    tree = Renderer.create(React.createElement(EliminationPassageText, {
      segments: passage.segments,
      selectedIds: card.answer_key.correct_items,
      optionOrder: card.elimination_items.map(item => item.id),
      disabled: false,
      onToggle: jest.fn(),
      textColor: '#20232B', mutedColor: '#69707A', selectionSurface: '#FFF0E6',
    }));
  });
  const visible = tree.root.findAllByType(Text).map(node => node.props.children);
  expect(visible).toContain('private cars');
  expect(visible).not.toContain('private cars,');
  Renderer.act(() => tree.unmount());
});

it('removes an inline verbatim task repeat without dropping a different instruction', () => {
  const record = bundledCardLibrary.cet4.cards.find(item => item.card_id === '061203');
  if (record?.interaction_id !== 'elimination') throw new Error('Missing real elimination card 061203');
  const card = normalizeLearningCardRecord(record) as EliminationCard;
  expect(frontMaterial(card)).toEqual([
    '句子：Because the sample size was limited, the conclusion should be interpreted with caution.',
  ]);
  expect(eliminationPassage(card)?.source).toBe(frontMaterial(card)[0]);
});

it.each([
  ['012103', '模拟句子：Most customers choose private cars.'],
  ['012003', '阅读片段：The greatest challenge for me was continuing to believe in myself.'],
  ['061203', '句子：Because the sample size was limited.'],
  ['061205', '句子：While the dataset appears comprehensive.'],
])('deleting the actual correct spans leaves the intact source core in %s', (id, expected) => {
  const record = bundledCardLibrary.cet4.cards.find(item => item.card_id === id);
  if (record?.interaction_id !== 'elimination') throw new Error(`Missing real elimination card ${id}`);
  const card = normalizeLearningCardRecord(record) as EliminationCard;
  const passage = eliminationPassage(card);
  if (!passage) throw new Error(`No mapped sentence for ${id}`);
  expect(passage.segments.map(segment => segment.text).join('')).toBe(passage.source);
  expect(passage.segments
    .filter(segment => !segment.itemId || !card.answer_key.correct_items.includes(segment.itemId))
    .map(segment => segment.text).join('')).toBe(expected);
});
