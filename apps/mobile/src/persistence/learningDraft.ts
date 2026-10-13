import {sha256} from '@noble/hashes/sha2.js';
import {utf8ToBytes} from '@noble/hashes/utils.js';
import {CORE_INTERACTION_ORDER, type LearningCard, type LearningCardState, type LearningSession, type LearningTrack} from '../learning/model';

export type LearningDraft = {
  version: 1;
  track: LearningTrack;
  sourceId: string;
  contentVersion: string | null;
  cardId: string;
  interactionId: LearningCard['interaction_id'];
  cardFingerprint: string;
  phase: 'learning' | 'review';
  selectionId: string | null;
  state: LearningCardState;
};
const fingerprint = (card: LearningCard) => Array.from(sha256(utf8ToBytes(JSON.stringify(card))), byte => byte.toString(16).padStart(2, '0')).join('');
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256;
const nullableText = (value: unknown) => value === null || text(value);

// The enclosing user-state owner supplies account isolation. Neither credentials,
// results nor submitted events belong in this presentation-only draft.
export function parseLearningDraft(value: unknown): LearningDraft | null {
  if (value == null) return null;
  if (!object(value) || value.version !== 1 || !['cet4', 'cet6'].includes(String(value.track)) ||
      !text(value.sourceId) || !nullableText(value.contentVersion) || !text(value.cardId) ||
      !CORE_INTERACTION_ORDER.includes(value.interactionId as LearningCard['interaction_id']) ||
      typeof value.cardFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(value.cardFingerprint) ||
      !['learning', 'review'].includes(String(value.phase)) || !nullableText(value.selectionId) || !object(value.state)) {
    throw new Error('Invalid learning draft scope.');
  }
  const state = value.state;
  const booleans = ['isPeeked', 'isHintVisible', 'isFlipped'] as const;
  const optionalBooleans = ['hasUsedHint', 'hasUsedPeek', 'hasMadeLockMistake'] as const;
  if (booleans.some(key => typeof state[key] !== 'boolean') ||
      optionalBooleans.some(key => state[key] !== undefined && typeof state[key] !== 'boolean') ||
      state.flipConfidence !== null || !nullableText(state.selectedOptionId) || !nullableText(state.swipeSelection) ||
      !object(state.lockSelections) || Object.keys(state.lockSelections).length > 100 ||
      Object.entries(state.lockSelections).some(([key, entry]) => !text(key) || !nullableText(entry)) ||
      !Array.isArray(state.eliminatedItemIds) || state.eliminatedItemIds.length > 100 ||
      state.eliminatedItemIds.some(id => !text(id)) || new Set(state.eliminatedItemIds).size !== state.eliminatedItemIds.length) {
    throw new Error('Invalid learning draft state.');
  }
  return {
    version: 1, track: value.track as LearningTrack, sourceId: value.sourceId,
    contentVersion: value.contentVersion as string | null, cardId: value.cardId,
    interactionId: value.interactionId as LearningCard['interaction_id'], cardFingerprint: value.cardFingerprint,
    phase: value.phase as LearningDraft['phase'], selectionId: value.selectionId as string | null,
    state: {isPeeked: state.isPeeked as boolean, isHintVisible: state.isHintVisible as boolean,
      isFlipped: state.isFlipped as boolean, isFavorited: false, flipConfidence: null,
      hasUsedHint: state.hasUsedHint === true, hasUsedPeek: state.hasUsedPeek === true,
      hasMadeLockMistake: state.hasMadeLockMistake === true,
      selectedOptionId: state.selectedOptionId as string | null, swipeSelection: state.swipeSelection as string | null,
      lockSelections: {...state.lockSelections} as Record<string, string | null>, eliminatedItemIds: [...state.eliminatedItemIds] as string[]},
  };
}

export function captureLearningDraft(session: LearningSession | null, card: LearningCard | null,
  state: LearningCardState | null, phase: LearningDraft['phase']): LearningDraft | null {
  if (!session || !card || !state || state.flipConfidence !== null ||
      (session.schedulingMode === 'server' && (!session.contentVersion ||
        session.serverSelection?.cardId !== card.card_id || session.serverSelection.phase !== phase))) return null;
  return parseLearningDraft({version: 1, track: session.track, sourceId: session.sourceId,
    contentVersion: session.contentVersion, cardId: card.card_id, interactionId: card.interaction_id,
    cardFingerprint: fingerprint(card), phase,
    selectionId: session.schedulingMode === 'server' ? session.serverSelection!.selectionId : null, state});
}

export function restoreLearningDraft(draft: LearningDraft | null, session: LearningSession,
  card: LearningCard | undefined, phase: LearningDraft['phase']): LearningCardState | null {
  if (!draft || !card || draft.track !== session.track || draft.sourceId !== session.sourceId ||
      draft.contentVersion !== session.contentVersion || draft.cardId !== card.card_id ||
      draft.interactionId !== card.interaction_id || draft.cardFingerprint !== fingerprint(card) || draft.phase !== phase ||
      (session.schedulingMode === 'server' ? !session.serverSelection || draft.selectionId !== session.serverSelection.selectionId ||
        session.serverSelection.cardId !== card.card_id || session.serverSelection.phase !== phase : draft.selectionId !== null)) return null;
  const state = parseLearningDraft(draft)!.state;
  if (state.selectedOptionId !== null && (card.interaction_id !== 'multiple_choice' || !card.options.some(option => option.id === state.selectedOptionId))) return null;
  if (state.swipeSelection !== null && (card.interaction_id !== 'swipe' || !card.swipe_states.some(item => item.id === state.swipeSelection))) return null;
  if (Object.entries(state.lockSelections).some(([key, value]) => card.interaction_id !== 'lock' ||
    !card.lock_slots.some(slot => slot.id === key && (value === null || slot.options.includes(value))))) return null;
  if (state.eliminatedItemIds.some(id => card.interaction_id !== 'elimination' || !card.elimination_items.some(item => item.id === id))) return null;
  return state;
}
