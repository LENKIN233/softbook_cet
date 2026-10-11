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

export function filterSpaceCards(cards, filter, favorites, pendingReview, sleeping = [], query = '') {
  const selected = new Set(filter === 'favorites' ? favorites : filter === 'sleeping' ? sleeping : pendingReview);
  const needle = query.trim().toLocaleLowerCase();
  return cards.filter(card => (filter === 'all' || selected.has(card.card_id)) && (!needle || [
    card.front?.prompt, card.front?.support, card.front?.context,
    ...(card.options ?? []).map(option => option.text),
    card.space_metadata?.library, card.space_metadata?.group, card.space_metadata?.box,
  ].filter(Boolean).join(' ').toLocaleLowerCase().includes(needle)));
}
