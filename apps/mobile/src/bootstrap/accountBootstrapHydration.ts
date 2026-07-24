import type { LearningCardResult, LearningSession } from '../learning/model';
import type { PersistedUserState } from '../persistence/userStateStore';
import {
  mergeSpaceStateMaps,
  spaceStateSnapshotToMap,
} from '../space/spaceStateRepository';
import type { AccountBootstrapSnapshot } from './accountBootstrapRepository';

export type AccountBootstrapHydration = {
  learningResults: LearningCardResult[];
  persistedUserState: PersistedUserState;
  reviewResults: LearningCardResult[];
  spaceStateSyncKey: string;
};

export function reconcileAccountBootstrap(
  persistedUserState: PersistedUserState,
  bootstrap: AccountBootstrapSnapshot,
  options: {pendingCheckInDayKey?: string | null} = {},
): Pick<
  AccountBootstrapHydration,
  'persistedUserState' | 'spaceStateSyncKey'
> {
  const remoteSpaceStateById = spaceStateSnapshotToMap(
    bootstrap.space.snapshot,
  );
  const mergedSpaceStateById = mergeSpaceStateMaps(
    persistedUserState.spaceCardStateById,
    bootstrap.space.snapshot,
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
      spaceCardStateById: mergedSpaceStateById,
    },
    spaceStateSyncKey: JSON.stringify({
      dayKey: bootstrap.dayKey,
      states: Object.entries(remoteSpaceStateById)
        .map(([cardId, state]) => ({ cardId, ...state }))
        .sort((left, right) => left.cardId.localeCompare(right.cardId)),
    }),
  };
}

export function resolveAccountBootstrapLearningState(
  bootstrap: AccountBootstrapSnapshot,
  learningSession: LearningSession,
): Pick<AccountBootstrapHydration, 'learningResults' | 'reviewResults'> {
  if (
    bootstrap.track !== learningSession.track ||
    bootstrap.content.source.id !== learningSession.sourceId ||
    bootstrap.content.cardCount !== learningSession.catalogCards.length ||
    bootstrap.content.version !== learningSession.contentVersion
  ) {
    throw new Error(
      'Canonical account state does not match the loaded learning content.',
    );
  }

  if (
    bootstrap.learning.source !== null &&
    bootstrap.learning.source.id !== learningSession.sourceId
  ) {
    throw new Error(
      'Canonical learning state does not match the loaded learning source.',
    );
  }

  const cardById = new Map(
    learningSession.catalogCards.map(card => [card.card_id, card]),
  );

  for (const state of bootstrap.learning.cardStates) {
    const card = cardById.get(state.cardId);

    if (!card || card.interaction_id !== state.interactionId) {
      throw new Error(
        `Canonical learning card ${state.cardId} does not match loaded content.`,
      );
    }
  }

  for (const state of bootstrap.space.snapshot.states) {
    if (!cardById.has(state.cardId)) {
      throw new Error(
        `Canonical space card ${state.cardId} does not match loaded content.`,
      );
    }
  }

  if (
    bootstrap.learning.cursor !== null &&
    (bootstrap.learning.cursor.sourceId !== learningSession.sourceId ||
      !cardById.has(bootstrap.learning.cursor.cardId))
  ) {
    throw new Error(
      'Canonical learning cursor does not match the loaded learning content.',
    );
  }

  const learningResults = bootstrap.learning.cardStates
    .filter(state => state.phase === 'learning')
    .map(stripPhase);
  const reviewResults = bootstrap.learning.cardStates
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
