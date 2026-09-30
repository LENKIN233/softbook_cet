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
  }
  return {
    schema_version: 'track-study-statistics.v1',
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
