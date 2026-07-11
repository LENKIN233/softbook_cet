import {RemoteHttpError} from '../runtime/remoteHttpError';

export type SpaceStateRepositoryMode = 'local' | 'remote';

export type SpaceCardStateValue = {
  isFavorited: boolean;
  isSleeping: boolean;
  lastModifiedAt: string;
};

export type CardSpaceState = SpaceCardStateValue & {
  cardId: string;
};

export type SpaceStateSnapshot = {
  dayKey: string;
  states: CardSpaceState[];
};

export type SpaceStateSyncResult = {
  acknowledgedAt: string;
  mode: SpaceStateRepositoryMode;
  snapshot: SpaceStateSnapshot;
};

export type SpaceStateContext = {
  authToken?: string;
  phoneNumber: string;
};

export type SpaceStateRemoteConfig = {
  endpoint: string;
  headers?: Record<string, string>;
};

export type FetchLikeResponse = {
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
};

export type FetchLike = (
  input: string,
  init?: {
    body?: string;
    headers?: Record<string, string>;
    method?: string;
  },
) => Promise<FetchLikeResponse>;

export type SpaceStateRepository = {
  loadSpaceState: (
    context: SpaceStateContext,
    dayKey: string,
  ) => Promise<SpaceStateSnapshot>;
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
  spaceCardStateById: Record<string, SpaceCardStateValue>;
}): SpaceStateSnapshot {
  const states = Object.entries(input.spaceCardStateById)
    .map(([cardId, state]) => ({
      cardId,
      isFavorited: state.isFavorited,
      isSleeping: state.isSleeping,
      lastModifiedAt: state.lastModifiedAt,
    }))
    .sort((left, right) => left.cardId.localeCompare(right.cardId));

  return {
    dayKey: input.dayKey,
    states,
  };
}

export function spaceStateSnapshotToMap(
  snapshot: SpaceStateSnapshot,
): Record<string, SpaceCardStateValue> {
  return Object.fromEntries(
    snapshot.states.map(state => [
      state.cardId,
      {
        isFavorited: state.isFavorited,
        isSleeping: state.isSleeping,
        lastModifiedAt: state.lastModifiedAt,
      },
    ]),
  );
}

export function mergeSpaceStateMaps(
  localStateById: Record<string, SpaceCardStateValue>,
  remoteSnapshot: SpaceStateSnapshot,
): Record<string, SpaceCardStateValue> {
  const merged = {...localStateById};

  for (const remoteState of remoteSnapshot.states) {
    const localState = merged[remoteState.cardId];

    if (
      !localState ||
      Date.parse(remoteState.lastModifiedAt) >=
        Date.parse(localState.lastModifiedAt)
    ) {
      merged[remoteState.cardId] = {
        isFavorited: remoteState.isFavorited,
        isSleeping: remoteState.isSleeping,
        lastModifiedAt: remoteState.lastModifiedAt,
      };
    }
  }

  return merged;
}

export function createSpaceStateRepository(
  config: SpaceStateRepositoryConfig,
): SpaceStateRepository {
  return {
    async loadSpaceState(context, dayKey) {
      if (config.mode === 'local') {
        return {dayKey, states: []};
      }

      if (!config.remoteConfig) {
        throw new Error('Remote space state load requires remoteConfig.');
      }

      const fetchImpl = config.fetchImpl ?? fetch;
      const response = await fetchImpl(
        appendQuery(config.remoteConfig.endpoint, 'day_key', dayKey),
        {
          headers: buildRemoteSpaceStateHeaders(config.remoteConfig, context),
          method: 'GET',
        },
      );

      if (!response.ok) {
        throw new RemoteHttpError(
          `Remote space state load failed with ${response.status}.`,
          response.status,
        );
      }

      return parseRemoteSpaceStateSnapshot(await response.json(), dayKey);
    },

    async syncSpaceState(context, snapshot) {
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
          throw new RemoteHttpError(
            `Remote space state sync failed with ${response.status}.`,
            response.status,
          );
        }

        return {
          acknowledgedAt,
          mode: 'remote',
          snapshot: parseRemoteSpaceStateSnapshot(
            await response.json(),
            snapshot.dayKey,
          ),
        };
      }

      return {
        acknowledgedAt,
        mode: 'local',
        snapshot,
      };
    },
  };
}

export function parseRemoteSpaceStateSnapshot(
  payload: unknown,
  expectedDayKey: string,
): SpaceStateSnapshot {
  if (!isObject(payload) || !isObject(payload.data)) {
    throw new Error('Remote space state payload.data must be an object.');
  }

  const rawSnapshot = payload.data.space_state;

  if (!isObject(rawSnapshot)) {
    throw new Error('Remote space state payload.data.space_state must be an object.');
  }

  if (rawSnapshot.day_key !== expectedDayKey) {
    throw new Error('Remote space state day_key must match the requested day.');
  }

  if (!Array.isArray(rawSnapshot.states)) {
    throw new Error('Remote space state states must be an array.');
  }

  const seenCardIds = new Set<string>();
  const states = rawSnapshot.states.map((value, index) => {
    if (!isObject(value)) {
      throw new Error(`Remote space state states[${index}] must be an object.`);
    }

    const cardId = value.card_id;
    const lastModifiedAt = value.last_modified_at;

    if (typeof cardId !== 'string' || cardId.trim().length === 0) {
      throw new Error(`Remote space state states[${index}].card_id is invalid.`);
    }
    if (seenCardIds.has(cardId)) {
      throw new Error(`Remote space state contains duplicate card_id ${cardId}.`);
    }
    if (
      typeof value.is_favorited !== 'boolean' ||
      typeof value.is_sleeping !== 'boolean'
    ) {
      throw new Error(`Remote space state states[${index}] flags are invalid.`);
    }
    if (
      typeof lastModifiedAt !== 'string' ||
      Number.isNaN(Date.parse(lastModifiedAt))
    ) {
      throw new Error(
        `Remote space state states[${index}].last_modified_at is invalid.`,
      );
    }

    seenCardIds.add(cardId);
    return {
      cardId,
      isFavorited: value.is_favorited,
      isSleeping: value.is_sleeping,
      lastModifiedAt,
    };
  });

  return {
    dayKey: expectedDayKey,
    states: states.sort((left, right) => left.cardId.localeCompare(right.cardId)),
  };
}

function buildRemoteSpaceStateHeaders(
  config: SpaceStateRemoteConfig,
  context: SpaceStateContext,
) {
  if (!context.authToken) {
    throw new RemoteHttpError(
      'Remote space state sync requires authToken.',
      401,
    );
  }

  return {
    'content-type': 'application/json',
    Authorization: `Bearer ${context.authToken}`,
    ...config.headers,
  };
}

function appendQuery(endpoint: string, key: string, value: string) {
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}${key}=${encodeURIComponent(value)}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
