export const LOCAL_BATCH_SIZE = 5;

// The cursor remains in the complete eligible deck; only the presented group is small.
export function localBatch(total, cursor, complete = false) {
  const count = Math.max(0, Math.floor(total));
  const position = Math.min(count, Math.max(0, Math.floor(cursor)));
  const anchor = complete && position > 0 ? position - 1 : position;
  const start = Math.floor(anchor / LOCAL_BATCH_SIZE) * LOCAL_BATCH_SIZE;
  const end = Math.min(count, start + LOCAL_BATCH_SIZE);
  return {start, end, size: Math.max(0, end - start), index: Math.max(0, position - start), hasMore: position < count};
}

export function endsLocalBatch(nextCursor, total) {
  return nextCursor >= total || nextCursor % LOCAL_BATCH_SIZE === 0;
}

// Sleeping or waking a card during review must not shift the return position.
export function localResumeIndex(orderedCards, eligibleCards, resumeCardId) {
  const start = orderedCards.findIndex(card => card.card_id === resumeCardId);
  if (start < 0) return eligibleCards.length;
  const eligibleIds = new Set(eligibleCards.map(card => card.card_id));
  const next = orderedCards.slice(start).find(card => eligibleIds.has(card.card_id));
  return next ? eligibleCards.findIndex(card => card.card_id === next.card_id) : eligibleCards.length;
}
