import type {LearningCardState, LearningSession, LearningTrack} from './model';

export type CourseLearningDraft = {identity: string; state: LearningCardState};
export type CourseLearningDrafts = Map<LearningTrack, CourseLearningDraft>;

// Drafts describe presentation only. A fresh authoritative selection must still
// agree before anything is restored; no result, event or audio state is cached.
export function courseDraftIdentity(accountScope: string | null, session: LearningSession | null): string | null {
  const selection = session?.serverSelection;
  const card = session?.cards[0];
  if (!accountScope || !session?.sourceId || session.schedulingMode !== 'server' || !session.contentVersion || !selection || !card || selection.cardId !== card.card_id) return null;
  return JSON.stringify([accountScope, session.track, session.sourceId, session.contentVersion, selection.selectionId, selection.phase, card.card_id, card.interaction_id]);
}

export function rememberCourseLearningDraft(drafts: CourseLearningDrafts, accountScope: string | null, session: LearningSession | null, state: LearningCardState | null) {
  const identity = courseDraftIdentity(accountScope, session);
  if (!identity || !session || !state) return;
  drafts.set(session.track, {identity, state: {...state, lockSelections: {...state.lockSelections}, eliminatedItemIds: [...state.eliminatedItemIds]}});
}

export function takeCourseLearningDraft(drafts: CourseLearningDrafts, accountScope: string | null, session: LearningSession): LearningCardState | null {
  const identity = courseDraftIdentity(accountScope, session);
  if (!identity) return null; // A catalog/home read must not consume the draft.
  const draft = drafts.get(session.track);
  drafts.delete(session.track);
  return draft?.identity === identity ? draft.state : null;
}
