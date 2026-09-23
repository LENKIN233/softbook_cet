export function latestCardResults(results) {
  const latest = new Map();
  for (const result of results) {
    const previous = latest.get(result.cardId);
    const newer = !previous || (typeof result.serverSequence === 'number' && typeof previous.serverSequence === 'number'
      ? result.serverSequence >= previous.serverSequence
      : Date.parse(result.completedAt) >= Date.parse(previous.completedAt));
    if (newer) latest.set(result.cardId, result);
  }
  return [...latest.values()];
}

export function reviewCardIds(results, sleeping = []) {
  const excluded = new Set(sleeping);
  return latestCardResults(results)
    .filter(result => !excluded.has(result.cardId) && ['incorrect', 'review'].includes(result.outcome))
    .map(result => result.cardId);
}

export function filterSpaceCards(cards, filter, favorites, pendingReview) {
  if (filter === 'all') return cards;
  const selected = new Set(filter === 'favorites' ? favorites : pendingReview);
  return cards.filter(card => selected.has(card.card_id));
}
