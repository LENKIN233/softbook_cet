// Daily activity comes from immutable accepted events, never latest-per-card
// outcomes (which erase repeated attempts). The learning projection supplies
// the cumulative distinct-card set and the causal read watermark.
function createTrackStudyStatistics(input) {
  const {dayKey, events, learning, track} = input;
  if (events === null) return null;
  const sequence = learning.component_revision.event_server_sequence;
  const cards = new Set();
  const eventIds = new Set();
  let reviewAttempts = 0;
  let breakdownComplete = true;
  const answers = {correct: 0, incorrect: 0, confident: 0, review: 0, hints: 0, peeks: 0};
  for (const event of events) {
    if (
      event.track !== track || event.activity_day !== dayKey ||
      !Number.isSafeInteger(event.server_sequence) || event.server_sequence <= 0 ||
      event.event_id !== event.payload?.event_id ||
      typeof event.payload.card_id !== 'string' ||
      !['learning', 'review'].includes(event.payload.phase)
    ) {
      throw new Error('Invalid canonical study statistics event.');
    }
    if (event.server_sequence > sequence || eventIds.has(event.event_id)) continue;
    eventIds.add(event.event_id);
    cards.add(event.payload.card_id);
    reviewAttempts += Number(event.payload.phase === 'review');
    const payload = event.payload;
    const outcome = payload.outcome;
    if (!['correct', 'incorrect', 'confident', 'review'].includes(outcome) ||
        typeof payload.used_hint !== 'boolean' || typeof payload.used_peek !== 'boolean' ||
        (payload.interaction_id === 'flip' ? !['confident', 'review'].includes(outcome)
          : !['multiple_choice', 'lock', 'elimination', 'swipe'].includes(payload.interaction_id) || !['correct', 'incorrect'].includes(outcome))) {
      breakdownComplete = false;
    } else {
      answers[outcome] += 1;
      answers.hints += Number(payload.used_hint);
      answers.peeks += Number(payload.used_peek);
    }
  }
  return {
    schema_version: 'track-study-statistics.v1',
    ...(breakdownComplete ? {answer_breakdown: answers} : {}),
    day_key: dayKey,
    track,
    event_server_sequence: sequence,
    completed_card_count: cards.size,
    completed_attempt_count: eventIds.size,
    review_attempt_count: reviewAttempts,
    cumulative_learned_card_count: Object.keys(learning.events_by_card_id ?? {}).length,
  };
}

module.exports = {createTrackStudyStatistics};
