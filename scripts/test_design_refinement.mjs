import test from 'node:test';
import assert from 'node:assert/strict';
import {isLongQuestion, stackChoiceOptions} from '../apps/mobile/src/learning/readability.js';
import {filterSpaceCards, latestCardResults, reviewCardIds} from '../apps/mobile/src/space/cardFilters.js';

test('long real Chinese options use one column on a phone while short options remain comparable', () => {
  assert.equal(stackChoiceOptions([{text: '电动公交与柴油车队的运营成本和排放对比'}], 330), true);
  assert.equal(stackChoiceOptions([{text: 'urgent'}, {text: 'unclear'}], 330), false);
  assert.equal(stackChoiceOptions([{text: 'urgent'}], 280), true);
  assert.equal(stackChoiceOptions([{text: 'urgent'}], 620, 1.4), true);
});

test('mixed-language and multiline material is not styled as a short oversized heading', () => {
  assert.equal(isLongQuestion('一组听力题的选项反复出现 electric buses、diesel fleets、operating cost、emissions。先不播放音频：这些共同关键词最可能预告什么主题？'), true);
  assert.equal(isLongQuestion('这句话的主语是什么？'), false);
  assert.equal(isLongQuestion('Read this.\nThen answer.'), true);
});

const cards = [{card_id: 'a', space_metadata: {box_ref: 'box-1'}}, {card_id: 'b', space_metadata: {box_ref: 'box-2'}}];
test('filters stay inside the accessible catalog and preserve card identity and box ownership', () => {
  const filtered = filterSpaceCards(cards, 'favorites', ['b', 'not-accessible'], []);
  assert.deepEqual(filtered, [cards[1]]);
  assert.equal(filtered[0], cards[1]);
  assert.deepEqual(filterSpaceCards(cards, 'review', [], ['a']), [cards[0]]);
  assert.deepEqual(filterSpaceCards(cards, 'favorites', [], []), []);
});

test('a later successful review clears a prior error; paused cards are not pending practice', () => {
  const results = [
    {cardId: 'a', outcome: 'incorrect', completedAt: '2026-09-18T00:00:00Z'},
    {cardId: 'a', outcome: 'correct', completedAt: '2026-09-19T00:00:00Z'},
    {cardId: 'b', outcome: 'review', completedAt: '2026-09-19T00:00:00Z'},
  ];
  assert.deepEqual(reviewCardIds(results), ['b']);
  assert.deepEqual(reviewCardIds(results, ['b']), []);
  assert.equal(latestCardResults(results).length, 2);
});

test('remote sequence outranks device clocks when selecting the latest result', () => {
  assert.deepEqual(reviewCardIds([
    {cardId: 'a', outcome: 'correct', serverSequence: 2, completedAt: '2026-09-18T00:00:00Z'},
    {cardId: 'a', outcome: 'incorrect', serverSequence: 1, completedAt: '2026-09-19T00:00:00Z'},
  ]), []);
});
