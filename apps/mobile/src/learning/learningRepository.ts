import { LearningSession, LearningTrack } from './model';
import {
  FetchLike,
  RemoteLearningCardSourceConfig,
  loadRemoteLearningCardSource,
} from './remoteCardSource';
import {
  DEFAULT_LEARNING_SESSION_CARD_COUNT,
  createLearningSession,
} from './session';
import { LearningCardSource, localLearningCardSource } from './localCardSource';
import {isRemoteAuthorizationError} from '../runtime/remoteHttpError';

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
  fallbackToLocalOnRemoteError?: boolean;
  fetchImpl?: FetchLike;
  localSource?: LearningCardSource;
  mode: LearningRepositoryMode;
  remoteConfig?: RemoteLearningCardSourceConfig;
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
        if (!config.remoteConfig) {
          throw new Error('Remote learning repository requires remoteConfig.');
        }

        try {
          const fetchImpl = config.fetchImpl ?? fetch;
          const sourceResponse = await loadRemoteLearningCardSource(
            context,
            track,
            config.remoteConfig,
            fetchImpl,
          );

          return assertNonEmptySession(
            createLearningSession(
              sourceResponse.track,
              sourceResponse.sourceId,
              sourceResponse.sourceLabel,
              sourceResponse.cards,
              cardCount,
            ),
          );
        } catch (error) {
          if (
            isRemoteAuthorizationError(error) ||
            !config.fallbackToLocalOnRemoteError
          ) {
            throw error;
          }

          return createLocalSession(track);
        }
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
