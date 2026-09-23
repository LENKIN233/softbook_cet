// Only the explicit local-learning surface uses this store. It contains no credentials.
const VERSION = 1;
const BOOL_FIELDS = ['hasUsedHint', 'hasUsedPeek', 'isPeeked', 'isFavorited', 'isHintVisible', 'isFlipped'];
const RESULT_FIELDS = ['usedHint', 'usedPeek', 'isFavorited'];
export class LocalLearningStorageError extends Error {
  constructor(kind) { super(kind); this.kind = kind; }
}
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, required, optional = []) => record(value) && required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
const fail = () => { throw new LocalLearningStorageError('invalid'); };

function checkState(state, cards) {
  if (!record(state) || !['learning', 'review'].includes(state.phase) || typeof state.complete !== 'boolean') fail();
  const keys = ['phase', 'complete', 'currentCardId', 'resumeCardId', 'reviewCardIds', 'favorites', 'sleeping', 'results', 'draft', 'resolved', 'checkedInDay'];
  if (Object.keys(state).length !== keys.length || !keys.every(key => Object.hasOwn(state, key))) fail();
  const byId = new Map(cards.map(card => [card.card_id, card]));
  const id = value => value === null || (typeof value === 'string' && byId.has(value));
  const ids = values => Array.isArray(values) && values.length <= cards.length && new Set(values).size === values.length && values.every(value => typeof value === 'string' && byId.has(value));
  if (!id(state.currentCardId) || !id(state.resumeCardId) || !ids(state.reviewCardIds) || !ids(state.favorites) || !ids(state.sleeping)) fail();
  if (state.currentCardId !== null && (state.sleeping.includes(state.currentCardId) || (state.phase === 'review' && !state.reviewCardIds.includes(state.currentCardId)))) fail();
  if (!Array.isArray(state.results) || state.results.length > cards.length || new Set(state.results.map(value => value?.cardId)).size !== state.results.length) fail();
  for (const result of state.results) {
    const card = byId.get(result?.cardId);
    if (!exactKeys(result, ['cardId', 'interactionId', 'outcome', 'completedAt', ...RESULT_FIELDS]) || !card || result.interactionId !== card.interaction_id ||
      !(card.interaction_id === 'flip' ? ['confident', 'review'] : ['correct', 'incorrect']).includes(result.outcome) ||
      !RESULT_FIELDS.every(key => typeof result[key] === 'boolean') || typeof result.completedAt !== 'string' || !Number.isFinite(Date.parse(result.completedAt))) fail();
  }
  if (state.draft !== null) {
    const card = byId.get(state.currentCardId), draft = state.draft;
    if (!card || !exactKeys(draft, [...BOOL_FIELDS, 'flipConfidence', 'selectedOptionId', 'swipeSelection', 'lockSelections', 'eliminatedItemIds'], ['hasMadeLockMistake']) || !BOOL_FIELDS.every(key => typeof draft[key] === 'boolean') ||
      (draft.hasMadeLockMistake !== undefined && typeof draft.hasMadeLockMistake !== 'boolean') ||
      ![null, 'confident', 'review'].includes(draft.flipConfidence) || !record(draft.lockSelections) || !Array.isArray(draft.eliminatedItemIds)) fail();
    if (draft.selectedOptionId !== null && !card.options?.some(option => option.id === draft.selectedOptionId)) fail();
    if (draft.swipeSelection !== null && !card.swipe_states?.some(option => option.id === draft.swipeSelection)) fail();
    const slots = card.lock_slots ?? [];
    if (Object.keys(draft.lockSelections).length !== slots.length || !slots.every(slot => Object.hasOwn(draft.lockSelections, slot.id) && (draft.lockSelections[slot.id] === null || slot.options.includes(draft.lockSelections[slot.id])))) fail();
    if (new Set(draft.eliminatedItemIds).size !== draft.eliminatedItemIds.length || !draft.eliminatedItemIds.every(value => card.elimination_items?.some(item => item.id === value))) fail();
  }
  if (state.resolved !== null && (state.draft === null || state.complete || state.resolved !== state.currentCardId || !state.results.some(result => result.cardId === state.resolved))) fail();
  if (state.checkedInDay !== null && (typeof state.checkedInDay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(state.checkedInDay) || !Number.isFinite(Date.parse(state.checkedInDay)) || new Date(state.checkedInDay).toISOString().slice(0, 10) !== state.checkedInDay)) fail();
  return state;
}

export function createLocalLearningStore({getStorage, track, contentVersion, cards, withLock}) {
  if (!['cet4', 'cet6'].includes(track) || !contentVersion || !cards.length) fail();
  const key = `softbook-cet/local-learning/v1/${track}/${encodeURIComponent(contentVersion)}`;
  let expectedRaw;
  let tail = Promise.resolve();
  const read = () => {
    try { return getStorage().getItem(key); } catch { throw new LocalLearningStorageError('unavailable'); }
  };
  const decode = raw => {
    if (raw === null) return null;
    if (raw.length > 4_000_000) fail();
    let data;
    try { data = JSON.parse(raw); } catch { fail(); }
    if (!exactKeys(data, ['schemaVersion', 'track', 'contentVersion', 'state']) || data.schemaVersion !== VERSION || data.track !== track || data.contentVersion !== contentVersion) fail();
    return checkState(data.state, cards);
  };
  return {
    key,
    flush: () => tail,
    load() {
      const raw = read();
      const state = decode(raw);
      expectedRaw = raw; // A failed read cannot authorize overwriting the existing record.
      return state;
    },
    async save(state) {
      const validated = checkState(state, cards);
      const raw = JSON.stringify({schemaVersion: VERSION, track, contentVersion, state: validated});
      const operation = async () => {
        if (expectedRaw === undefined) throw new LocalLearningStorageError('not_loaded');
        const current = read();
        if (current === raw) { expectedRaw = raw; return; }
        if (current !== expectedRaw) throw new LocalLearningStorageError('conflict');
        if (raw === expectedRaw) return;
        try {
          getStorage().setItem(key, raw);
          if (read() !== raw) throw new Error('write verification failed');
        } catch { throw new LocalLearningStorageError('unavailable'); }
        expectedRaw = raw;
      };
      const result = tail.then(() => withLock(key, operation));
      tail = result.catch(() => {});
      return result;
    },
  };
}
