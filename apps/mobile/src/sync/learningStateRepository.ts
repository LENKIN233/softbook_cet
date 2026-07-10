import type {LearningCardResult, LearningSession} from '../learning/model';

export type LearningStateRepositoryMode = 'local' | 'remote';
export type LearningStatePhase = 'learning' | 'review';

export type LearningStateEvent = {
  cardId: string;
  completedAt: string;
  interactionId: LearningCardResult['interactionId'];
  outcome: LearningCardResult['outcome'];
  usedHint: boolean;
  usedPeek: boolean;
  isFavorited: boolean;
  phase: LearningStatePhase;
};

export type LearningStateSnapshot = {
  dayKey: string;
  sourceId: string;
  sourceLabel: string;
  track: LearningSession['track'];
  events: LearningStateEvent[];
};

export type LearningStateSyncResult = {
  acknowledgedAt: string;
  mode: LearningStateRepositoryMode;
};

export type LearningStateContext = {
  authToken?: string;
  phoneNumber: string;
};

export type LearningStateRemoteConfig = {
  endpoint: string;
  headers?: Record<string, string>;
};

export type FetchLike = typeof fetch;

export type LearningStateRepository = {
  syncLearningState: (
    context: LearningStateContext,
    snapshot: LearningStateSnapshot,
  ) => Promise<LearningStateSyncResult>;
};

export type LearningStateRepositoryConfig = {
  fetchImpl?: FetchLike;
  mode: LearningStateRepositoryMode;
  remoteConfig?: LearningStateRemoteConfig;
};

export function createLearningStateSnapshot(input: {
  dayKey: string;
  learningSession: Pick<LearningSession, 'sourceId' | 'sourceLabel' | 'track'>;
  learningResults: LearningCardResult[];
  reviewResults: LearningCardResult[];
}): LearningStateSnapshot {
  return {
    dayKey: input.dayKey,
    events: [
      ...input.learningResults.map(result =>
        createLearningStateEvent(result, 'learning'),
      ),
      ...input.reviewResults.map(result =>
        createLearningStateEvent(result, 'review'),
      ),
    ],
    sourceId: input.learningSession.sourceId,
    sourceLabel: input.learningSession.sourceLabel,
    track: input.learningSession.track,
  };
}

export function createLearningStateRepository(
  config: LearningStateRepositoryConfig,
): LearningStateRepository {
  return {
    syncLearningState: async (context, snapshot) => {
      const acknowledgedAt = new Date().toISOString();

      if (config.mode === 'remote') {
        if (!config.remoteConfig) {
          throw new Error('Remote learning state sync requires remoteConfig.');
        }

        const fetchImpl = config.fetchImpl ?? fetch;
        const response = await fetchImpl(config.remoteConfig.endpoint, {
          body: JSON.stringify({
            day_key: snapshot.dayKey,
            events: snapshot.events.map(event => ({
              card_id: event.cardId,
              completed_at: event.completedAt,
              interaction_id: event.interactionId,
              is_favorited: event.isFavorited,
              outcome: event.outcome,
              phase: event.phase,
              used_hint: event.usedHint,
              used_peek: event.usedPeek,
            })),
            phone_number: context.phoneNumber,
            source_id: snapshot.sourceId,
            source_label: snapshot.sourceLabel,
            track: snapshot.track,
          }),
          headers: buildRemoteLearningStateHeaders(config.remoteConfig, context),
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error(
            `Remote learning state sync failed with ${response.status}.`,
          );
        }

        return {
          acknowledgedAt,
          mode: 'remote',
        };
      }

      return {
        acknowledgedAt,
        mode: 'local',
      };
    },
  };
}

function createLearningStateEvent(
  result: LearningCardResult,
  phase: LearningStatePhase,
): LearningStateEvent {
  return {
    cardId: result.cardId,
    completedAt: result.completedAt,
    interactionId: result.interactionId,
    outcome: result.outcome,
    usedHint: result.usedHint,
    usedPeek: result.usedPeek,
    isFavorited: result.isFavorited,
    phase,
  };
}

function buildRemoteLearningStateHeaders(
  config: LearningStateRemoteConfig,
  context: LearningStateContext,
) {
  if (!context.authToken) {
    throw new Error('Remote learning state sync requires authToken.');
  }

  return {
    'content-type': 'application/json',
    Authorization: `Bearer ${context.authToken}`,
    ...config.headers,
  };
}
