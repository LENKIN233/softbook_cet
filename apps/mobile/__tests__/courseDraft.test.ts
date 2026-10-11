import {rememberCourseLearningDraft, takeCourseLearningDraft, type CourseLearningDrafts} from '../src/learning/courseDraft';
import {createLearningCardState} from '../src/learning/sessionCore';
import {createLocalLearningSession} from './fixtures/interactionSession';
import type {LearningSession} from '../src/learning/model';

const local = createLocalLearningSession('cet4');
const session: LearningSession = {...local, sourceId: 'authorized-source', contentVersion: `sha256:${'a'.repeat(64)}`, schedulingMode: 'server',
  cards: [local.cards[0]], serverSelection: {selectionId: 'sel_unsubmitted_same_card', cardId: local.cards[0].card_id, phase: 'learning', reason: 'catalog_new', dueAt: null}};
const scope = 'account-session-one';
function saved() {
  const drafts: CourseLearningDrafts = new Map();
  const state = {...createLearningCardState(session.cards[0]), isFlipped: true, isHintVisible: true, hasUsedHint: true};
  rememberCourseLearningDraft(drafts, scope, session, state);
  return {drafts, state};
}
test('a home read preserves the same pending draft and restores it once for the authoritative selection', () => {
  const {drafts, state} = saved();
  expect(takeCourseLearningDraft(drafts, scope, {...session, cards: [], serverSelection: null})).toBeNull();
  expect(takeCourseLearningDraft(drafts, scope, session)).toEqual(state);
  expect(takeCourseLearningDraft(drafts, scope, session)).toBeNull();
});
test.each(['account', 'source', 'content', 'selection', 'phase', 'card'] as const)('a %s change cannot restore an old draft', drift => {
  const {drafts} = saved();
  const next = {...session, serverSelection: {...session.serverSelection!}};
  if (drift === 'source') next.sourceId = 'different-source';
  if (drift === 'content') next.contentVersion = `sha256:${'b'.repeat(64)}`;
  if (drift === 'selection') next.serverSelection.selectionId = 'sel_another_attempt';
  if (drift === 'phase') next.serverSelection.phase = 'review';
  if (drift === 'card') {next.cards = [local.cards[1]]; next.serverSelection.cardId = local.cards[1].card_id;}
  expect(takeCourseLearningDraft(drafts, drift === 'account' ? 'new-account-session' : scope, next)).toBeNull();
});
test('snapshotting assistance and selections does not alias later editing or persist a result', () => {
  const {drafts, state} = saved();
  state.lockSelections.slot = 'changed'; state.eliminatedItemIds.push('changed');
  expect(takeCourseLearningDraft(drafts, scope, session)).toMatchObject({lockSelections: {}, eliminatedItemIds: [], hasUsedHint: true});
});
