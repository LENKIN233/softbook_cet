import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalLearningStore} from '../apps/web/src/localLearningStore.js';
import {localBatch, endsLocalBatch, localResumeIndex} from '../apps/mobile/src/learning/localBatch.js';

const cards = Array.from({length: 12}, (_, index) => ({card_id: String(index + 1).padStart(6, '0'), interaction_id: 'multiple_choice', options: [{id: 'a'}, {id: 'b'}]}));
const draft = () => ({hasUsedHint: false, hasUsedPeek: false, hasMadeLockMistake: false, isPeeked: false, isFavorited: false, isHintVisible: false, isFlipped: false, flipConfidence: null, selectedOptionId: 'a', lockSelections: {}, eliminatedItemIds: [], swipeSelection: null});
const snapshot = () => ({phase: 'learning', complete: false, currentCardId: '000007', resumeCardId: null, reviewCardIds: [], favorites: ['000007'], sleeping: ['000002'], results: [{cardId: '000007', interactionId: 'multiple_choice', outcome: 'correct', completedAt: '2026-09-19T00:00:00.000Z', usedHint: false, usedPeek: false, isFavorited: true}], draft: draft(), resolved: '000007', checkedInDay: '2026-09-19'});
function fixture() {
  const values = new Map();
  const storage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
  const locks = new Map();
  const withLock = (key, work) => {
    const result = (locks.get(key) ?? Promise.resolve()).then(work);
    locks.set(key, result.catch(() => {}));
    return result;
  };
  return {values, storage, create: (track = 'cet4', contentVersion = 'content-v1') => createLocalLearningStore({getStorage: () => storage, cards, track, contentVersion, withLock})};
}

test('refresh restores position, answer, draft, favorites, sleep and check-in', async () => {
  const f = fixture(), first = f.create();
  assert.equal(first.load(), null);
  await first.save(snapshot());
  assert.deepEqual(f.create().load(), snapshot());
});

test('five-card groups cover the complete deck exactly once, including a short final group', () => {
  let cursor = 0;
  const seen = [];
  while (cursor < cards.length) {
    const batch = localBatch(cards.length, cursor);
    assert.ok(batch.size <= 5 && batch.size > 0);
    assert.equal(batch.index, 0);
    seen.push(...cards.slice(batch.start, batch.end).map(card => card.card_id));
    cursor = batch.end;
    assert.ok(endsLocalBatch(cursor, cards.length));
    const complete = localBatch(cards.length, cursor, true);
    assert.equal(complete.start, batch.start);
    assert.equal(complete.size, batch.size);
  }
  assert.deepEqual(seen, cards.map(card => card.card_id));
  assert.equal(localBatch(12, 12, true).hasMore, false);
  assert.equal(localBatch(0, 0).size, 0);
});

test('a completed group restores the next group cursor without replaying the first five', async () => {
  const f = fixture(), store = f.create(); store.load();
  const state = {...snapshot(), complete: true, currentCardId: '000006', draft: {...draft(), selectedOptionId: null}, resolved: null};
  await store.save(state);
  const restored = f.create().load();
  const cursor = cards.findIndex(card => card.card_id === restored.currentCardId);
  assert.equal(localBatch(cards.length, cursor, true).start, 0);
  assert.equal(localBatch(cards.length, cursor, false).start, 5);
});

test('tracks and content versions do not overwrite each other', async () => {
  const f = fixture(), store = f.create(); store.load(); await store.save(snapshot());
  assert.equal(f.create('cet6').load(), null);
  assert.equal(f.create('cet4', 'content-v2').load(), null);
  assert.deepEqual(f.create().load(), snapshot());
});

test('review returns to the same next card even when earlier or next cards are put to sleep', () => {
  const eligible = cards.filter(card => !['000002', '000006'].includes(card.card_id));
  const index = localResumeIndex(cards, eligible, '000006');
  assert.equal(eligible[index].card_id, '000007');
  assert.equal(localResumeIndex(cards, eligible, null), eligible.length);
  assert.equal(localResumeIndex(cards, [], '000006'), 0);
});

test('malformed records remain intact and cannot authorize a new overwrite', async () => {
  const f = fixture(), store = f.create();
  f.values.set(store.key, '{broken');
  assert.throws(() => store.load(), {kind: 'invalid'});
  await assert.rejects(store.save(snapshot()), {kind: 'not_loaded'});
  assert.equal(f.values.get(store.key), '{broken');
});

test('quota failures and unconfirmed writes are errors, never saved success', async () => {
  const f = fixture(), store = f.create(); store.load();
  const write = f.storage.setItem;
  f.storage.setItem = () => { throw new Error('QuotaExceededError'); };
  await assert.rejects(store.save(snapshot()), {kind: 'unavailable'});
  f.storage.setItem = () => {};
  await assert.rejects(store.save(snapshot()), {kind: 'unavailable'});
  f.storage.setItem = write;
  await store.save(snapshot());
  assert.deepEqual(f.create().load(), snapshot());
});

test('two tabs cannot silently replace each other with stale progress', async () => {
  const f = fixture(), first = f.create(), second = f.create(); first.load(); second.load();
  await first.save(snapshot());
  await assert.rejects(second.save({...snapshot(), favorites: []}), {kind: 'conflict'});
  assert.deepEqual(f.create().load(), snapshot());
  assert.deepEqual(second.load(), snapshot());
  await second.save({...snapshot(), favorites: []});
  assert.deepEqual(f.create().load().favorites, []);
});

test('unknown cards, credentials, wrong answer kinds and mismatched drafts are rejected', async () => {
  const f = fixture(), store = f.create(); store.load();
  for (const state of [
    {...snapshot(), currentCardId: 'unknown'},
    {...snapshot(), accessToken: 'must-not-be-stored'},
    {...snapshot(), draft: {...draft(), selectedOptionId: 'unknown'}},
    {...snapshot(), sleeping: ['000007']},
    {...snapshot(), checkedInDay: '2026-02-30'},
    {...snapshot(), draft: {...draft(), accessToken: 'must-not-be-stored'}},
    {...snapshot(), results: [{...snapshot().results[0], phoneNumber: 'must-not-be-stored'}]},
    {...snapshot(), results: [{...snapshot().results[0], outcome: 'confident'}]},
  ]) await assert.rejects(store.save(state), {kind: 'invalid'});
  assert.equal(f.values.size, 0);
});
