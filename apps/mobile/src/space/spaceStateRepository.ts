export type SpaceStateRepositoryMode = 'local' | 'remote';

export type CardSpaceState = {
  cardId: string;
  isFavorited: boolean;
  isSleeping: boolean;
  lastModifiedAt: string;
};

export type SpaceStateSnapshot = {
  dayKey: string;
  states: CardSpaceState[];
};

export type SpaceStateSyncResult = {
  acknowledgedAt: string;
  mode: SpaceStateRepositoryMode;
};

export type SpaceStateContext = {
  authToken?: string;
  phoneNumber: string;
};

export type SpaceStateRemoteConfig = {
  endpoint: string;
  headers?: Record<string, string>;
};

export type FetchLike = typeof fetch;

export type SpaceStateRepository = {
  syncSpaceState: (
    context: SpaceStateContext,
    snapshot: SpaceStateSnapshot,
  ) => Promise<SpaceStateSyncResult>;
};

export type SpaceStateRepositoryConfig = {
  fetchImpl?: FetchLike;
  mode: SpaceStateRepositoryMode;
  remoteConfig?: SpaceStateRemoteConfig;
};

export function createSpaceStateSnapshot(input: {
  dayKey: string;
  spaceCardStateById: Record<string, {isFavorited: boolean; isSleeping: boolean}>;
}): SpaceStateSnapshot {
  const states: CardSpaceState[] = Object.entries(input.spaceCardStateById)
    .map(([cardId, state]) => ({
      cardId,
      isFavorited: state.isFavorited,
      isSleeping: state.isSleeping,
      lastModifiedAt: new Date().toISOString(),
    }));

  return {
    dayKey: input.dayKey,
    states,
  };
}

export function createSpaceStateRepository(
  config: SpaceStateRepositoryConfig,
): SpaceStateRepository {
  return {
    syncSpaceState: async (context, snapshot) => {
      const acknowledgedAt = new Date().toISOString();

      if (config.mode === 'remote') {
        if (!config.remoteConfig) {
          throw new Error('Remote space state sync requires remoteConfig.');
        }

        const fetchImpl = config.fetchImpl ?? fetch;
        const response = await fetchImpl(config.remoteConfig.endpoint, {
          body: JSON.stringify({
            day_key: snapshot.dayKey,
            phone_number: context.phoneNumber,
            states: snapshot.states.map(state => ({
              card_id: state.cardId,
              is_favorited: state.isFavorited,
              is_sleeping: state.isSleeping,
              last_modified_at: state.lastModifiedAt,
            })),
          }),
          headers: buildRemoteSpaceStateHeaders(config.remoteConfig, context),
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error(
            `Remote space state sync failed with ${response.status}.`,
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

function buildRemoteSpaceStateHeaders(
  config: SpaceStateRemoteConfig,
  context: SpaceStateContext,
) {
  if (!context.authToken) {
    throw new Error('Remote space state sync requires authToken.');
  }

  return {
    'content-type': 'application/json',
    Authorization: `Bearer ${context.authToken}`,
    ...config.headers,
  };
}
