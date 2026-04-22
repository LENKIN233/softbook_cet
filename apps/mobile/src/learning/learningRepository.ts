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

export type LearningRepositoryMode = 'local' | 'remote';

export type LearningSessionRepository = {
  loadSession: (track: LearningTrack) => Promise<LearningSession>;
};

export type LearningSessionRepositoryConfig = {
  cardCount?: number;
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

  return {
    loadSession: async track => {
      if (config.mode === 'remote') {
        if (!config.remoteConfig) {
          throw new Error('Remote learning repository requires remoteConfig.');
        }

        const fetchImpl = config.fetchImpl ?? fetch;
        const sourceResponse = await loadRemoteLearningCardSource(
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
      }

      return assertNonEmptySession(
        createLearningSession(
          track,
          localSource.sourceId,
          localSource.sourceLabel,
          localSource.loadCards(track),
          cardCount,
        ),
      );
    },
  };
}

function assertNonEmptySession(session: LearningSession) {
  if (session.cards.length === 0) {
    throw new Error('Learning session repository returned an empty session.');
  }

  return session;
}
