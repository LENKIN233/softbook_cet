import { LearningSession, LearningTrack } from './model';
import {
  FetchLike,
  RemoteLearningCardSourceConfig,
  loadRemoteLearningCardSource,
} from './remoteCardSource';
import {
  RemoteLearningSessionConfig,
  loadRemoteLearningSession,
} from './remoteLearningSession';
import {
  DEFAULT_LEARNING_SESSION_CARD_COUNT,
  createLearningSession,
} from './session';
import { LearningCardSource, localLearningCardSource } from './localCardSource';

export type LearningRepositoryMode = 'local' | 'remote';

export type LearningSessionRepositoryContext = {
  authToken?: string;
  phoneNumber: string;
};

export type LearningSessionRepository = {
  loadSession: (
    context: LearningSessionRepositoryContext,
    track: LearningTrack,
  ) => Promise<LearningSession>;
};

export type LearningSessionRepositoryConfig = {
  cardCount?: number;
  fetchImpl?: FetchLike;
  localSource?: LearningCardSource;
  mode: LearningRepositoryMode;
  remoteConfig?: RemoteLearningCardSourceConfig;
  remoteSessionConfig?: RemoteLearningSessionConfig;
};

export function createLearningSessionRepository(
  config: LearningSessionRepositoryConfig,
): LearningSessionRepository {
  const cardCount = config.cardCount ?? DEFAULT_LEARNING_SESSION_CARD_COUNT;
  const localSource = config.localSource ?? localLearningCardSource;
  const createLocalSession = (track: LearningTrack) =>
    assertNonEmptySession(
      createLearningSession(
        track,
        localSource.sourceId,
        localSource.sourceLabel,
        localSource.loadCards(track),
        cardCount,
      ),
    );

  return {
    loadSession: async (context, track) => {
      if (config.mode === 'remote') {
        if (!config.remoteConfig || !config.remoteSessionConfig) {
          throw new Error(
            'Remote learning repository requires card-source and session configs.',
          );
        }

        const fetchImpl = config.fetchImpl ?? fetch;
        const source = await loadRemoteLearningCardSource(
          context,
          track,
          config.remoteConfig,
          fetchImpl,
        );
        const scheduled = await loadRemoteLearningSession(
          context,
          track,
          config.remoteSessionConfig,
          fetchImpl,
        );

        if (
          source.track !== scheduled.track ||
          source.sourceId !== scheduled.sourceId ||
          source.contentVersion === null ||
          source.contentVersion !== scheduled.contentVersion ||
          source.cards.length !== scheduled.access.totalCardCount
        ) {
          throw new Error(
            'Remote learning session does not match canonical card-source content.',
          );
        }

        const selectedCardIndex =
          scheduled.selection === null
            ? -1
            : source.cards.findIndex(
                card => card.card_id === scheduled.selection?.cardId,
              );

        if (
          scheduled.selection !== null &&
          (selectedCardIndex < 0 ||
            selectedCardIndex >= scheduled.access.accessibleCardCount)
        ) {
          throw new Error(
            'Remote learning selection is outside canonical accessible content.',
          );
        }

        return {
          cards: selectedCardIndex < 0 ? [] : [source.cards[selectedCardIndex]],
          catalogCards: source.cards,
          contentVersion: scheduled.contentVersion,
          membershipStage: scheduled.membershipStage,
          nextDueAt: scheduled.nextDueAt,
          schedulingMode: 'server',
          serverSelection: scheduled.selection,
          sourceId: source.sourceId,
          sourceLabel: source.sourceLabel,
          track: source.track,
        };
      }

      return createLocalSession(track);
    },
  };
}

function assertNonEmptySession(session: LearningSession) {
  if (session.cards.length === 0) {
    throw new Error('Learning session repository returned an empty session.');
  }

  return session;
}
