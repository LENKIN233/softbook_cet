import type { LearningCardResult, LearningSession } from '../learning/model';
import { resolveAccessibleLearningCardCount } from '../membership/localMembership';
import type { PersistedUserState } from '../persistence/userStateStore';
import { getChinaDayKey } from '../shared/chinaDay';
import {
  applySpaceActionToMap,
  spaceStateSnapshotToMap,
} from '../space/spaceStateRepository';
import type { SpaceAction } from '../space/spaceStateRepository';
import type { AccountBootstrapSnapshot } from './accountBootstrapRepository';

export type AccountBootstrapHydration = {
  learningResults: LearningCardResult[];
  persistedUserState: PersistedUserState;
  reviewResults: LearningCardResult[];
};

export function reconcileAccountBootstrap(
  persistedUserState: PersistedUserState,
  bootstrap: AccountBootstrapSnapshot,
  options: {
    pendingCheckInDayKey?: string | null;
    pendingSpaceActions?: SpaceAction[];
  } = {},
): Pick<AccountBootstrapHydration, 'persistedUserState'> {
  const remoteSpaceStateById = spaceStateSnapshotToMap(
    bootstrap.space.snapshot,
  );
  const reconciledSpaceStateById = (options.pendingSpaceActions ?? []).reduce(
    applySpaceActionToMap,
    remoteSpaceStateById,
  );

  return {
    persistedUserState: {
      checkedInDayKey: bootstrap.progress.snapshot.checkedInToday
        ? bootstrap.dayKey
        : options.pendingCheckInDayKey === bootstrap.dayKey
        ? bootstrap.dayKey
        : persistedUserState.checkedInDayKey === bootstrap.dayKey
        ? null
        : persistedUserState.checkedInDayKey,
      learningCursor: bootstrap.learning.cursor,
      spaceCardStateById: reconciledSpaceStateById,
    },
  };
}

export function resolveAccountBootstrapLearningState(
  bootstrap: AccountBootstrapSnapshot,
  learningSession: LearningSession,
  options: {catalogOnly?: boolean} = {},
): Pick<AccountBootstrapHydration, 'learningResults' | 'reviewResults'> {
  if (options.catalogOnly && (
    learningSession.cards.length !== 0 || learningSession.serverSelection !== null ||
    learningSession.roundCompletion !== null || learningSession.membershipStage !== null
  )) {
    throw new Error('A read-only catalog must not contain active learning authority.');
  }
  const expectedCatalogCardCount =
    learningSession.schedulingMode === 'server' &&
    (options.catalogOnly || learningSession.membershipStage !== null)
      ? resolveAccessibleLearningCardCount(
          bootstrap.content.cardCount,
          bootstrap.membership.state,
        )
      : bootstrap.content.cardCount;

  if (options.catalogOnly && learningSession.schedulingMode === 'server' && learningSession.contentManifest) {
    const expectedMode = bootstrap.membership.state.stage === 'trial_available' ? 'trial_not_started'
      : bootstrap.membership.state.stage === 'free' ? 'free_subset' : 'full';
    const access = learningSession.contentManifest.access;
    const expectedGrantedCount = expectedMode === 'trial_not_started' ? 0 : expectedCatalogCardCount;
    if (access.total_card_count !== bootstrap.content.cardCount || access.mode !== expectedMode ||
      access.accessible_card_count !== expectedGrantedCount) {
      throw new Error('Canonical membership does not match the read-only catalog manifest.');
    }
  }

  if (
    bootstrap.track !== learningSession.track ||
    bootstrap.content.source.id !== learningSession.sourceId ||
    (learningSession.schedulingMode === 'server' &&
      learningSession.membershipStage !== null &&
      bootstrap.membership.state.stage !== learningSession.membershipStage) ||
    expectedCatalogCardCount !== learningSession.catalogCards.length ||
    bootstrap.content.version !== learningSession.contentVersion
  ) {
    throw new Error(
      'Canonical account state does not match the loaded learning content.',
    );
  }

  const cardById = new Map(
    learningSession.catalogCards.map(card => [card.card_id, card]),
  );
  const learningSourceMatches =
    bootstrap.learning.source === null ||
    bootstrap.learning.source.id === learningSession.sourceId;

  const dailyCardStates = bootstrap.learning.cardStates.filter(state => {
    const currentCard = cardById.get(state.cardId);

    return (
      learningSourceMatches &&
      currentCard?.interaction_id === state.interactionId &&
      getChinaDayKey(new Date(state.completedAt)) === bootstrap.dayKey
    );
  });
  const learningResults = dailyCardStates
    .filter(state => state.phase === 'learning')
    .map(stripPhase);
  const reviewResults = dailyCardStates
    .filter(state => state.phase === 'review')
    .map(stripPhase);
  return {
    learningResults,
    reviewResults,
  };
}

function stripPhase(
  state: AccountBootstrapSnapshot['learning']['cardStates'][number],
): LearningCardResult {
  return {
    cardId: state.cardId,
    completedAt: state.completedAt,
    interactionId: state.interactionId,
    isFavorited: state.isFavorited,
    outcome: state.outcome,
    usedHint: state.usedHint,
    usedPeek: state.usedPeek,
  };
}
