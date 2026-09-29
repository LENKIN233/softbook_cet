const assert = require('node:assert/strict');
const test = require('node:test');
const {createTrackStudyStatistics} = require('../track-study-statistics');
const learning = {component_revision: {event_server_sequence: 2},
  events_by_card_id: {a: {}, b: {}}};
const event = (id, sequence, card = 'a') => ({event_id: id, track: 'cet4', activity_day: '2026-09-30',
  server_sequence: sequence, payload: {event_id: id, card_id: card, phase: 'review'}});
const input = {learning, track: 'cet4', dayKey: '2026-09-30'};

test('a concurrent later event cannot leak ahead of the learning read watermark', () => {
  const stats = createTrackStudyStatistics({...input,
    events: [event('a', 1), event('a', 1), event('b', 2), event('c', 3, 'c')]});
  assert.equal(stats.completed_card_count, 1);
  assert.equal(stats.completed_attempt_count, 2);
  assert.equal(stats.review_attempt_count, 2);
  assert.equal(stats.cumulative_learned_card_count, 2);
});

test('unavailable complete event read stays unavailable, never a zero count', () => {
  assert.equal(createTrackStudyStatistics({...input, events: null}), null);
});

test('invalid canonical event scope is not accepted as statistics', () => {
  assert.throws(() => createTrackStudyStatistics({...input,
    events: [{...event('a', 1), track: 'cet6'}]}));
});
