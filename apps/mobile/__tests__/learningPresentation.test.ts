import React from 'react';
import Renderer from 'react-test-renderer';
import {Text} from 'react-native';
import {EliminationPassageText} from '../src/learning/EliminationPassageText';
import {
  answerComparison,
  eliminationPassage,
  frontMaterial,
  displayCardText,
  spaceCardPreview,
  lockAnswerText,
  cardTextBlocks,
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
  expect(answerComparison(card, state).correct).toBe(expected.split(' · ').map(text => `− ${text}`).join('\n'));
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


it('renders imported lock placeholders as blanks without changing source content or other cards', () => {
  const record = bundledCardLibrary.cet4.cards.find(card => card.card_id === '030006')!;
  const card = normalizeLearningCardRecord(record);
  expect(card.interaction_id).toBe('lock');
  const before = JSON.stringify(card);
  expect(displayCardText(card, 'Choose {{blank}} then {{blank}}.')).toBe('Choose ____ then ____.');
  expect(JSON.stringify(spaceCardPreview(card))).not.toContain('{{blank}}');
  expect(frontMaterial(card).join(' ')).not.toContain('{{blank}}');
  expect(JSON.stringify(card)).toBe(before);
  expect(displayCardText(elimination, 'Keep {{blank}} literally.')).toBe('Keep {{blank}} literally.');
});


it('fills authored lock context and never invents a sentence by joining slot answers', () => {
  const card = localLearningCardRecords.find(item => item.interaction_id === 'lock');
  if (card?.interaction_id !== 'lock') throw new Error('Missing lock sample');
  const single = {...card, lock_slots: [card.lock_slots[0]], answer_key: {lock_pattern: ['in']},
    front: {...card.front, prompt: 'Choose the preposition.', support: 'She is interested {{blank}} music.', context: ''}};
  expect(lockAnswerText(single, ['in'])).toBe('She is interested in music.');
  expect(lockAnswerText(single, [null])).toBe('She is interested ____ music.');
  expect(lockAnswerText({...single, front: {...single.front, support: 'Both {{blank}} and {{blank}}.'}}, ['in']))
    .toBe('主语：in');
  expect(lockAnswerText(card, card.answer_key.lock_pattern)).toBe('主语：The policy\n谓语：reduces\n宾语：test anxiety');
});

it.each(['030006', '050507', '050509'])('keeps the authored meaning of real lock %s in the completed answer', id => {
  const record = bundledCardLibrary.cet4.cards.find(item => item.card_id === id)!;
  const card = normalizeLearningCardRecord(record);
  if (card.interaction_id !== 'lock') throw new Error('Expected real lock');
  const output = answerComparison(card, createLearningCardState(card)).correct;
  expect(output).not.toBe(card.answer_key.lock_pattern.join(' '));
  for (const value of card.answer_key.lock_pattern) expect(output).toContain(value);
  expect(output).not.toMatch(/\{\{blank\}\}|____/);
  if (id === '030006') expect(output).toBe('锁定任务清单：对象是 first-year students；核心动作是 invite。');
});

it.each([
  ['cet4', '040011', "Rural infrastructure has been continuously improved, not only improving residents' living conditions but also driving the upgrading of rural industries."],
  ['cet6', '141011', "Public cultural platforms have been continuously improved, not only enriching people's spiritual life but also raising the level of equalized cultural services."],
] as const)('omits the standalone structure task only from the completed answer of %s %s', (track, id, expected) => {
  const record = bundledCardLibrary[track].cards.find(item => item.card_id === id)!;
  const card = normalizeLearningCardRecord(record);
  if (card.interaction_id !== 'lock') throw new Error('Expected real lock');
  const before = JSON.stringify(card);
  expect(answerComparison(card, createLearningCardState(card)).correct).toBe(expected);
  expect(displayCardText(card, card.front.prompt)).toContain('结构练习：');
  expect(displayCardText(card, card.front.prompt)).toContain('补全英文句子。');
  expect(JSON.stringify(card)).toBe(before);
});

it('keeps every other line of authored lock context when omitting an explicit structure task', () => {
  const card = localLearningCardRecords.find(item => item.interaction_id === 'lock');
  if (card?.interaction_id !== 'lock') throw new Error('Missing lock sample');
  const support = '结构练习：选择介词。\nThe student chose music.\nShe is interested\n{{blank}} music.\nHer interest has grown.';
  const single = {...card, lock_slots: [card.lock_slots[0]], answer_key: {lock_pattern: ['in']},
    front: {...card.front, prompt: 'Choose the preposition.', support, context: ''}};
  expect(lockAnswerText(single, ['in'])).toBe('The student chose music.\nShe is interested\nin music.\nHer interest has grown.');
  expect(frontMaterial(single)).toEqual([support.replace('{{blank}}', '____')]);
  for (const unchanged of [
    '结构练习：She is interested {{blank}} music.',
    '选择介词。\nShe is interested {{blank}} music.',
    '说明：结构练习：选择介词。\nShe is interested {{blank}} music.',
  ]) {
    expect(lockAnswerText({...single, front: {...single.front, support: unchanged}}, ['in']))
      .toBe(unchanged.replace('{{blank}}', 'in'));
  }
});

it('updates only verified lock choices inside their original sentence, preserving other front material', () => {
  const record = bundledCardLibrary.cet4.cards.find(item => item.card_id === '030006')!;
  const card = normalizeLearningCardRecord(record);
  if (card.interaction_id !== 'lock') throw new Error('Expected real lock');
  const state = createLearningCardState(card);
  state.lockSelections[card.lock_slots[0].id] = card.answer_key.lock_pattern[0];
  state.lockSelections[card.lock_slots[1].id] = 'complain';
  const output = displayCardText(card, card.front.prompt, state);
  expect(output).toContain('对象是 first-year students；核心动作是 ____。');
  expect(output).toContain('Write a notice');
  expect(output).toContain('词库：');
  expect(frontMaterial(card, state)).toEqual([]);
});

it('keeps authored paragraphs and only softens a separate explicit vocabulary gloss', () => {
  const text = 'Passage paragraph.\n\nWhich claim is supported?\n\nreusing：再次利用；practical：切实可行';
  expect(cardTextBlocks(text)).toEqual([
    {text: 'Passage paragraph.', gloss: false},
    {text: 'Which claim is supported?', gloss: false},
    {text: 'reusing：再次利用；practical：切实可行', gloss: true},
  ]);
  expect(cardTextBlocks('Question?\n\nWhy: is this true?')[1].gloss).toBe(false);
  expect(cardTextBlocks('practical：切实可行')[0].gloss).toBe(false);
});
