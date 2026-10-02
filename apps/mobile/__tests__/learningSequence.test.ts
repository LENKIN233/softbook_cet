import {knowledgePointOf, orderLearningCards} from '../src/learning/learningSequence';
import {normalizeLearningCardRecords} from '../src/learning/sourceContract';
import {createStudyState, pendingStudyIds} from '../src/local/studyModel';
import type {LearningCard, LearningTrack} from '../src/learning/model';

function pointCards(track: LearningTrack): LearningCard[] {
  const raw = track === 'cet4'
    ? require('../../../infra/cloudbase/functions/softbook-api/card-content/cet4-0.json')
    : require('../../../infra/cloudbase/functions/softbook-api/card-content/cet6-0.json');
  const cards = normalizeLearningCardRecords(raw);
  const first = cards[0];
  const second = cards.find(card => card.space_metadata.library === first.space_metadata.library && knowledgePointOf(card) !== knowledgePointOf(first))!;
  return [first, second].flatMap(point => cards.filter(card => knowledgePointOf(card) === knowledgePointOf(point)).slice(0, 3));
}

test.each(['cet4', 'cet6'] as const)('%s separates new points while keeping each point authored and the catalog intact', track => {
  const cards = pointCards(track);
  const before = JSON.stringify(cards);
  const ordered = orderLearningCards(cards);
  for (let index = 1; index < ordered.length; index++) {
    expect(knowledgePointOf(ordered[index])).not.toBe(knowledgePointOf(ordered[index - 1]));
  }
  for (const point of new Set(cards.map(knowledgePointOf))) {
    expect(ordered.filter(card => knowledgePointOf(card) === point).map(card => card.card_id))
      .toEqual(cards.filter(card => knowledgePointOf(card) === point).map(card => card.card_id));
  }
  expect(JSON.stringify(cards)).toBe(before);
  const frame = createStudyState(cards).frame;
  expect(frame.ids).toEqual(ordered.slice(0, 5).map(card => card.card_id));
});

test.each(['cet4', 'cet6'] as const)('%s local review separates available points and preserves sleep exclusion and due times', track => {
  const cards = pointCards(track);
  const now = new Date('2026-10-02T12:00:00.000Z');
  const state = createStudyState(cards);
  state.results = cards.map(card => ({cardId: card.card_id, interactionId: card.interaction_id,
    outcome: card.interaction_id === 'flip' ? 'confident' : 'correct', completedAt: now.toISOString(),
    usedHint: false, usedPeek: false, isFavorited: false}));
  state.schedule = Object.fromEntries(cards.map(card => [card.card_id, {
    dueAt: new Date(now.getTime() - 60000).toISOString(), days: 1, successes: 1,
  }]));
  const before = JSON.stringify(state.schedule);
  const byId = new Map(cards.map(card => [card.card_id, card]));
  const ids = pendingStudyIds(state, cards, now);
  expect(ids).toHaveLength(cards.length);
  for (let index = 1; index < ids.length; index++) {
    expect(knowledgePointOf(byId.get(ids[index])!)).not.toBe(knowledgePointOf(byId.get(ids[index - 1])!));
  }
  state.sleeping = cards.slice(3).map(card => card.card_id);
  expect(pendingStudyIds(state, cards, now)).toEqual(cards.slice(0, 3).map(card => card.card_id));
  expect(JSON.stringify(state.schedule)).toBe(before);
});
