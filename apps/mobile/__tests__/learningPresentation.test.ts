import {
  answerComparison,
  eliminationPassage,
  frontMaterial,
  survivingPassage,
} from '../src/learning/presentation';
import { localLearningCardRecords } from './fixtures/interactionCards';
import { createLearningCardState } from '../src/learning/sessionCore';
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

it('maps every selectable phrase once and reconstructs the original without loss', () => {
  const passage = eliminationPassage(elimination)!;
  expect(passage.segments.map(segment => segment.text).join('')).toBe(
    elimination.front.support,
  );
  expect(
    passage.segments
      .flatMap(segment => (segment.itemId ? [segment.itemId] : []))
      .sort(),
  ).toEqual(elimination.elimination_items.map(item => item.id).sort());
  expect(survivingPassage(passage, elimination.answer_key.correct_items)).toBe(
    '目标句：The students remember the pattern.',
  );
  expect(survivingPassage(passage, [])).toBe(elimination.front.support);
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
