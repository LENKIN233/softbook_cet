import {captureLearningDraft, parseLearningDraft, restoreLearningDraft} from '../src/persistence/learningDraft';
import {createEmptyPersistedUserState, createUserStateStore, USER_STATE_STORAGE_KEY} from '../src/persistence/userStateStore';
import {createLocalLearningSession} from './fixtures/interactionSession';
import {createLearningCardState} from '../src/learning/sessionCore';
import type {LearningSession} from '../src/learning/model';

const local = createLocalLearningSession('cet4');
const session: LearningSession = {...local, contentVersion: `sha256:${'a'.repeat(64)}`, schedulingMode: 'server',
  cards: [local.cards[0]], serverSelection: {cardId: local.cards[0].card_id, phase: 'learning', reason: 'catalog_new', dueAt: null, selectionId: 'sel_durable_draft'}};
const state = {...createLearningCardState(session.cards[0]), isFlipped: true, isHintVisible: true, hasUsedHint: true};
const draft = () => captureLearningDraft(session, session.cards[0], state, 'learning')!;
function storage() {
  const values = new Map<string, string>();
  return {values, getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {values.set(key, value);}),
    removeItem: jest.fn(async (key: string) => {values.delete(key);})};
}

test('a draft survives a new store instance only for its account and keeps sticky assistance', async () => {
  const disk = storage();
  const saved = {...createEmptyPersistedUserState(), learningDraft: draft()};
  await createUserStateStore(disk).save('13800138000', saved, {verify: true});
  const loaded = await createUserStateStore(disk).load('13800138000');
  expect(restoreLearningDraft(loaded.learningDraft!, session, session.cards[0], 'learning')).toEqual(state);
  expect((await createUserStateStore(disk).load('13900139000')).learningDraft).toBeUndefined();
  await createUserStateStore(disk).clear();
  expect((await createUserStateStore(disk).load('13800138000')).learningDraft).toBeUndefined();
});

test.each(['track', 'card', 'source', 'content', 'selection', 'phase', 'fingerprint'] as const)('does not restore after %s identity changes', drift => {
  const next = {...session, serverSelection: {...session.serverSelection!}};
  let card = session.cards[0];
  if (drift === 'track') next.track = 'cet6';
  if (drift === 'card') {card = local.cards[1]; next.serverSelection.cardId = card.card_id;}
  if (drift === 'source') next.sourceId = 'new-source';
  if (drift === 'content') next.contentVersion = `sha256:${'b'.repeat(64)}`;
  if (drift === 'selection') next.serverSelection.selectionId = 'sel_replaced';
  if (drift === 'phase') next.serverSelection.phase = 'review';
  if (drift === 'fingerprint') card = {...card, front: {...card.front, prompt: 'changed question'}};
  expect(restoreLearningDraft(draft(), next, card, 'learning')).toBeNull();
});

test('serializes whitelisted presentation fields and never credentials, scores or events', async () => {
  const disk = storage();
  const unsafe = {...draft(), accessToken: 'secret', outcome: 'correct', event: {event_id: 'submitted'},
    state: {...state, refreshToken: 'secret-refresh', serverSequence: 12}};
  await createUserStateStore(disk).save('13800138000', {...createEmptyPersistedUserState(), learningDraft: unsafe});
  expect(disk.values.get(USER_STATE_STORAGE_KEY)).not.toMatch(/secret|Token|outcome|event|serverSequence/);
  expect(captureLearningDraft(session, session.cards[0], {...state, flipConfidence: 'confident'}, 'learning')).toBeNull();
  expect(() => parseLearningDraft({...draft(), state: {...state, flipConfidence: 'confident'}})).toThrow();
});

test('old records without drafts remain readable and a corrupt optional draft cannot discard check-in or space', async () => {
  const disk = storage(); const store = createUserStateStore(disk);
  const old = {...createEmptyPersistedUserState(), checkedInDayKey: '2026-10-13'};
  await store.save('13800138000', old);
  expect(await store.load('13800138000')).toEqual(old);
  const payload = JSON.parse(disk.values.get(USER_STATE_STORAGE_KEY)!);
  payload.learning_draft = {...draft(), state: {selectedOptionId: 'damaged'}};
  disk.values.set(USER_STATE_STORAGE_KEY, JSON.stringify(payload));
  expect(await store.load('13800138000')).toEqual({...old, learningDraft: null});
  expect(disk.removeItem).not.toHaveBeenCalled();
});

test('verified pause saves fail when storage acknowledges but does not retain the bytes', async () => {
  const disk = storage(); disk.setItem.mockImplementation(async () => undefined);
  await expect(createUserStateStore(disk).save('13800138000', {...createEmptyPersistedUserState(), learningDraft: draft()}, {verify: true})).rejects.toThrow('verified');
});

test('partial lock choices are copied without inventing a score and unknown options are rejected', () => {
  const card = local.catalogCards.find(item => item.interaction_id === 'lock')!;
  if (card.interaction_id !== 'lock') throw new Error('Expected a lock fixture.');
  const lockSession = {...session, cards: [card], serverSelection: {...session.serverSelection!, cardId: card.card_id}};
  const answer = {...createLearningCardState(card), hasMadeLockMistake: true,
    lockSelections: {[card.lock_slots[0].id]: card.lock_slots[0].options[0]}};
  const saved = captureLearningDraft(lockSession, card, answer, 'learning')!;
  expect(restoreLearningDraft(saved, lockSession, card, 'learning')).toMatchObject(answer);
  saved.state.lockSelections[card.lock_slots[0].id] = 'not-an-option';
  expect(restoreLearningDraft(saved, lockSession, card, 'learning')).toBeNull();
});

test('pending self-assessment is restored as input and cannot become a submitted outcome', () => {
  const pending = {...state, pendingFlipConfidence: 'confident' as const};
  const saved = captureLearningDraft(session, session.cards[0], pending, 'learning')!;
  expect(restoreLearningDraft(saved, session, session.cards[0], 'learning')).toMatchObject({pendingFlipConfidence: 'confident', flipConfidence: null});
  const objective = local.catalogCards.find(card => card.interaction_id === 'multiple_choice')!;
  const objectiveSession = {...session, cards: [objective], serverSelection: {...session.serverSelection!, cardId: objective.card_id}};
  expect(captureLearningDraft(objectiveSession, objective, {...createLearningCardState(objective), isFlipped: true, pendingFlipConfidence: 'confident'}, 'learning')).toBeNull();
  expect(captureLearningDraft(session, session.cards[0], {...pending, isFlipped: false}, 'learning')).toBeNull();
  expect(() => parseLearningDraft({...saved, state: {...pending, pendingFlipConfidence: 'automatic_correct'}})).toThrow();
});

test('local study accepts durable pending flip input but rejects it on an objective card', () => {
  const {createStudyState, reduceStudy, validateStudyState} = require('../src/local/studyModel');
  const flip = session.cards[0];
  const before = createStudyState([flip]);
  const pending = reduceStudy(before, {type: 'patch', patch: {isFlipped: true, pendingFlipConfidence: 'review'}}, [flip]);
  expect(() => validateStudyState(pending, [flip])).not.toThrow();
  expect(pending.frame.resolved).toBeNull();
  const card = local.catalogCards.find(item => item.interaction_id === 'multiple_choice')!;
  const invalid = reduceStudy(createStudyState([card]), {type: 'patch', patch: {isFlipped: true, pendingFlipConfidence: 'review'}}, [card]);
  expect(() => validateStudyState(invalid, [card])).toThrow();
});
