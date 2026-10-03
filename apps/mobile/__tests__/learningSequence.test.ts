import {knowledgePointOf, orderLearningCards} from '../src/learning/learningSequence';
import {normalizeLearningCardRecords} from '../src/learning/sourceContract';
import {activeStudyCard, createStudyState, pendingStudyIds, reduceStudy, studyDay} from '../src/local/studyModel';
import {createLearningCardState} from '../src/learning/sessionCore';
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

function realReviewCatalog(track: LearningTrack): LearningCard[] {
  const raw = track === 'cet4'
    ? require('../../../infra/cloudbase/functions/softbook-api/card-content/cet4-0.json')
    : require('../../../infra/cloudbase/functions/softbook-api/card-content/cet6-0.json');
  const cards = normalizeLearningCardRecords(raw);
  const first = cards[0];
  const points = [...new Set(cards.filter(card => card.space_metadata.library === first.space_metadata.library).map(knowledgePointOf))].slice(0, 3);
  return points.flatMap(point => cards.filter(card => knowledgePointOf(card) === point).slice(0, 5));
}

function correctDraft(card: LearningCard) {
  const draft = createLearningCardState(card);
  if (card.interaction_id === 'flip') return {...draft, isFlipped: true, flipConfidence: 'confident' as const};
  if (card.interaction_id === 'multiple_choice') return {...draft, selectedOptionId: card.answer_key.correct_option};
  if (card.interaction_id === 'lock') return {...draft, lockSelections: Object.fromEntries(card.lock_slots.map((slot, index) => [slot.id, card.answer_key.lock_pattern[index]]))};
  if (card.interaction_id === 'elimination') return {...draft, eliminatedItemIds: card.answer_key.correct_items};
  return {...draft, swipeSelection: card.answer_key.correct_state};
}

for (const track of ['cet4', 'cet6'] as const) {
  test(`${track} a recently confirmed four-point review pool inserts one new point and returns to due work`, () => {
    const cards = normalizeLearningCardRecords(require('../../../infra/cloudbase/functions/softbook-api/card-content')[track].cards);
    const now = new Date('2026-10-03T08:00:00Z'), points = [...new Set(cards.map(knowledgePointOf))].slice(0, 4);
    const learned = points.flatMap(point => cards.filter(card => knowledgePointOf(card) === point).slice(0, 2));
    const state = createStudyState(cards);
    state.frame = {...state.frame, phase: 'review', index: state.frame.ids.length, complete: true, draft: null, resolved: null};
    state.results = learned.map((card, index) => ({cardId: card.card_id, interactionId: card.interaction_id,
      outcome: 'confident' as const, completedAt: new Date(now.getTime() - 60000 + index).toISOString(),
      usedHint: false, usedPeek: false, isFavorited: false}));
    state.schedule = Object.fromEntries(learned.map(card => [card.card_id, {dueAt: new Date(now.getTime() - 30000).toISOString(), days: 1, successes: 1}]));
    const next = reduceStudy(state, {type: 'continue'}, cards, now);
    expect(next.frame.phase).toBe('learning');
    expect(points).not.toContain(knowledgePointOf(activeStudyCard(next, cards)!));
    expect(next.frame.taskPhases?.[1]).toBe('review');
    expect(new Set(next.frame.ids.map(id => knowledgePointOf(cards.find(card => card.card_id === id)!))).size).toBe(5);
    expect(next.schedule).toEqual(state.schedule);
  });

  test(`${track} the real complete catalog confirms five distinct points per fresh round and respects the four-point window`, () => {
    const cards = normalizeLearningCardRecords(require('../../../infra/cloudbase/functions/softbook-api/card-content')[track].cards);
    const now = new Date('2026-10-03T08:00:00Z'), recent: string[] = [], selected: string[] = [];
    let state = createStudyState(cards);
    expect(new Set(state.frame.ids.map(id => knowledgePointOf(cards.find(card => card.card_id === id)!))).size).toBe(5);
    for (let index = 0; index < 10; index++) {
      const card = activeStudyCard(state, cards)!, point = knowledgePointOf(card);
      expect(recent.slice(-4)).not.toContain(point);
      selected.push(card.card_id);recent.push(point);
      state = reduceStudy(state, {type: 'answer', draft: correctDraft(card)}, cards, now);
      expect(state.frame.resolved).not.toBeNull();
      state = reduceStudy(state, {type: 'advance'}, cards, now);
      if (state.frame.complete) state = reduceStudy(state, {type: 'continue'}, cards, now);
    }
    for (const point of new Set(recent)) {
      expect(selected.filter(id => knowledgePointOf(cards.find(card => card.card_id === id)!) === point))
        .toEqual(cards.filter(card => knowledgePointOf(card) === point).slice(0, recent.filter(value => value === point).length).map(card => card.card_id));
    }
  });

  test(`${track} repeated confirmations in one point do not collapse the four-distinct-point window`, () => {
    const cards = normalizeLearningCardRecords(require('../../../infra/cloudbase/functions/softbook-api/card-content')[track].cards);
    const now = new Date('2026-10-03T08:00:00Z'), points = [...new Set(cards.map(knowledgePointOf))].slice(0, 4);
    const learned = [...points.slice(0, 3).map(point => cards.find(card => knowledgePointOf(card) === point)!),
      ...cards.filter(card => knowledgePointOf(card) === points[3]).slice(0, 5)];
    const state = createStudyState(cards);
    state.frame = {...state.frame, index: state.frame.ids.length, complete: true, draft: null, resolved: null};
    state.results = learned.map((card, index) => ({cardId: card.card_id, interactionId: card.interaction_id,
      outcome: card.interaction_id === 'flip' ? 'confident' as const : 'correct' as const,
      completedAt: new Date(now.getTime() - 60000 + index).toISOString(), usedHint: false, usedPeek: false, isFavorited: false}));
    state.schedule = Object.fromEntries(learned.map(card => [card.card_id, {dueAt: new Date(now.getTime() + 86400000).toISOString(), days: 1, successes: 1}]));
    const next = reduceStudy(state, {type: 'continue'}, cards, now);
    expect(points).not.toContain(knowledgePointOf(activeStudyCard(next, cards)!));
  });

  test(`${track} sleeping an unseen spacing card repairs the remaining queue without replacing active feedback`, () => {
    const cards = realReviewCatalog(track), now = new Date('2026-10-03T08:00:00Z');
    let state = createStudyState(cards);
    state.frame = {...state.frame, ids: [cards[0].card_id, cards[5].card_id, cards[1].card_id, cards[6].card_id, cards[2].card_id]};
    state = reduceStudy(state, {type: 'answer', draft: correctDraft(cards[0])}, cards, now);
    const active = structuredClone(state.frame), history = structuredClone(state.results);
    state = reduceStudy(state, {type: 'sleep', id: cards[5].card_id}, cards, now);
    expect(state.frame.ids[0]).toBe(active.ids[0]);expect(state.frame.index).toBe(0);
    expect(state.frame.draft).toEqual(active.draft);expect(state.frame.resolved).toEqual(active.resolved);
    expect(state.frame.results).toEqual(active.results);expect(state.results).toEqual(history);
    expect(state.frame.ids.slice(1)).not.toContain(cards[5].card_id);
    state = reduceStudy(state, {type: 'advance'}, cards, now);
    expect(knowledgePointOf(activeStudyCard(state, cards)!)).not.toBe(knowledgePointOf(cards[0]));
    state = reduceStudy(state, {type: 'patch', patch: {hasUsedPeek: true, isPeeked: true}}, cards, now);
    const current = structuredClone(state.frame);
    state = reduceStudy(state, {type: 'sleep', id: cards[5].card_id}, cards, now);
    expect(state.frame.ids.slice(0, state.frame.index + 1)).toEqual(current.ids.slice(0, current.index + 1));
    expect(state.frame.draft).toEqual(current.draft);
    for (let index = state.frame.index + 1; index < state.frame.ids.length; index++) {
      expect(knowledgePointOf(cards.find(card => card.card_id === state.frame.ids[index])!))
        .not.toBe(knowledgePointOf(cards.find(card => card.card_id === state.frame.ids[index - 1])!));
    }
  });

  test(`${track} sleeping the active unconfirmed spacing card chooses a different point before presenting its replacement`, () => {
    const cards = realReviewCatalog(track), now = new Date('2026-10-03T08:00:00Z');
    let state = createStudyState(cards);
    state.frame = {...state.frame, ids: [cards[0].card_id, cards[5].card_id, cards[1].card_id, cards[6].card_id, cards[2].card_id]};
    state = reduceStudy(state, {type: 'answer', draft: correctDraft(cards[0])}, cards, now);
    state = reduceStudy(state, {type: 'advance'}, cards, now);
    const prefix = state.frame.ids.slice(0, 2), history = structuredClone(state.results);
    state = reduceStudy(state, {type: 'sleep', id: cards[5].card_id}, cards, now);
    expect(state.frame.ids.slice(0, 2)).toEqual(prefix);expect(state.frame.index).toBe(2);
    expect(knowledgePointOf(activeStudyCard(state, cards)!)).not.toBe(knowledgePointOf(cards[0]));
    expect(state.frame.resolved).toBeNull();expect(state.results).toEqual(history);
  });

  test(`${track} a different-last due point keeps priority over a new point outside the recent window`, () => {
    const cards = realReviewCatalog(track), now = new Date('2026-10-03T08:00:00Z'), state = createStudyState(cards);
    const learned = [cards[0], cards[5], cards[1], cards[2], cards[3]];
    state.frame = {...state.frame, index: state.frame.ids.length, complete: true, draft: null, resolved: null};
    state.results = learned.map((card, index) => ({cardId: card.card_id, interactionId: card.interaction_id,
      outcome: 'confident' as const, completedAt: new Date(now.getTime() - 60000 + index).toISOString(),
      usedHint: false, usedPeek: false, isFavorited: false}));
    state.schedule = Object.fromEntries(learned.map(card => [card.card_id, {dueAt: new Date(now.getTime() - 30000).toISOString(), days: 1, successes: 1}]));
    const before = JSON.stringify(state.schedule), next = reduceStudy(state, {type: 'continue'}, cards, now);
    expect(next.frame.ids[0]).toBe(cards[5].card_id);expect(next.frame.phase).toBe('review');
    expect(JSON.stringify(next.schedule)).toBe(before);
  });

  test(`${track} normal continuation spaces five same-point due cards with accessible new points and counts each task phase`, () => {
    const cards = realReviewCatalog(track), due = cards.slice(0, 5), now = new Date('2026-10-03T08:00:00Z');
    const state = createStudyState(cards);
    state.frame = {...state.frame, index: state.frame.ids.length, complete: true, draft: null, resolved: null};
    state.results = due.map((card, index) => ({cardId: card.card_id, interactionId: card.interaction_id,
      outcome: 'confident' as const, completedAt: new Date(now.getTime() - 60000 + index).toISOString(),
      usedHint: false, usedPeek: false, isFavorited: false}));
    state.schedule = Object.fromEntries(due.map(card => [card.card_id, {dueAt: new Date(now.getTime() - 30000).toISOString(), days: 1, successes: 1}]));
    const timings = JSON.stringify(state.schedule);
    let next = reduceStudy(state, {type: 'continue'}, cards, now);
    const byId = new Map(cards.map(card => [card.card_id, card])), initialIds = next.frame.ids;
    expect(initialIds).toHaveLength(5);
    expect(knowledgePointOf(byId.get(initialIds[0])!)).not.toBe(knowledgePointOf(due[0]));
    for (let index = 1; index < initialIds.length; index++) expect(knowledgePointOf(byId.get(initialIds[index])!)).not.toBe(knowledgePointOf(byId.get(initialIds[index - 1])!));
    expect(initialIds.some(id => due.some(card => card.card_id === id))).toBe(true);
    expect(JSON.stringify(next.schedule)).toBe(timings);
    let learning = 0, review = 0;
    while (!next.frame.complete) {
      const card = activeStudyCard(next, cards)!;
      if (due.some(item => item.card_id === card.card_id)) review++; else learning++;
      next = reduceStudy(next, {type: 'answer', draft: correctDraft(card)}, cards, now);
      expect(next.frame.resolved).not.toBeNull();
      next = reduceStudy(next, {type: 'advance'}, cards, now);
    }
    expect(studyDay(next, now)).toMatchObject({learning, review});
    expect(learning).toBeGreaterThan(0);expect(review).toBeGreaterThan(0);
  });

  test(`${track} filters future reviews before spacing the normal due queue`, () => {
    const cards = realReviewCatalog(track), now = new Date('2026-10-03T08:00:00Z'), state = createStudyState(cards);
    state.frame = {...state.frame, index: state.frame.ids.length, complete: true, draft: null, resolved: null};
    state.results = cards.slice(0, 10).map((card, index) => ({cardId: card.card_id, interactionId: card.interaction_id,
      outcome: index < 5 ? 'confident' as const : 'review' as const, completedAt: now.toISOString(),
      usedHint: false, usedPeek: false, isFavorited: false}));
    state.schedule = Object.fromEntries(cards.slice(0, 10).map((card, index) => [card.card_id, {dueAt: new Date(now.getTime() + (index < 5 ? -60000 : 60000)).toISOString(), days: 1, successes: 1}]));
    const next = reduceStudy(state, {type: 'continue'}, cards, now);
    expect(next.frame.ids.some(id => cards.slice(10).some(card => card.card_id === id))).toBe(true);
    expect(next.frame.ids.some(id => cards.slice(5, 10).some(card => card.card_id === id))).toBe(false);
    for (let index = 1; index < next.frame.ids.length; index++) expect(knowledgePointOf(cards.find(card => card.card_id === next.frame.ids[index])!)).not.toBe(knowledgePointOf(cards.find(card => card.card_id === next.frame.ids[index - 1])!));
  });

  test(`${track} explicit review stays in its only eligible point even when other new points exist`, () => {
    const cards = realReviewCatalog(track), now = new Date('2026-10-03T08:00:00Z'), state = createStudyState(cards);
    state.results = cards.slice(0, 5).map(card => ({cardId: card.card_id, interactionId: card.interaction_id,
      outcome: 'confident' as const, completedAt: now.toISOString(), usedHint: false, usedPeek: false, isFavorited: false}));
    state.schedule = Object.fromEntries(cards.slice(0, 5).map(card => [card.card_id, {dueAt: new Date(now.getTime() - 60000).toISOString(), days: 1, successes: 1}]));
    const next = reduceStudy(state, {type: 'review'}, cards, now);
    expect(next.frame.phase).toBe('review');expect(next.frame.ids).toEqual(cards.slice(0, 5).map(card => card.card_id));
    expect(next.resume).toEqual(state.frame);
  });

  test(`${track} explicit review returns to a normal round whose current task is already a review`, () => {
    const cards = realReviewCatalog(track), now = new Date('2026-10-03T08:00:00Z'), state = createStudyState(cards);
    state.frame = {...state.frame, index: state.frame.ids.length, complete: true, draft: null, resolved: null};
    state.results = cards.slice(0, 5).map(card => ({cardId: card.card_id, interactionId: card.interaction_id,
      outcome: 'confident' as const, completedAt: now.toISOString(), usedHint: false, usedPeek: false, isFavorited: false}));
    state.schedule = Object.fromEntries(cards.slice(0, 5).map(card => [card.card_id, {dueAt: new Date(now.getTime() - 60000).toISOString(), days: 1, successes: 1}]));
    let normal = reduceStudy(state, {type: 'continue'}, cards, now);
    normal = reduceStudy(normal, {type: 'answer', draft: correctDraft(activeStudyCard(normal, cards)!)}, cards, now);
    normal = reduceStudy(normal, {type: 'advance'}, cards, now);
    expect(normal.frame.phase).toBe('review');
    normal = reduceStudy(normal, {type: 'patch', patch: {hasUsedPeek: true, isPeeked: true}}, cards, now);
    const saved = structuredClone(normal.frame);
    let review = reduceStudy(normal, {type: 'review'}, cards, now);
    expect(review.resume).toEqual(saved);
    while (!review.frame.complete) {
      review = reduceStudy(review, {type: 'answer', draft: correctDraft(activeStudyCard(review, cards)!)}, cards, now);
      review = reduceStudy(review, {type: 'advance'}, cards, now);
    }
    const returned = reduceStudy(review, {type: 'continue'}, cards, now);
    expect(returned.frame).toEqual(saved);expect(returned.resume).toBeNull();
  });
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
