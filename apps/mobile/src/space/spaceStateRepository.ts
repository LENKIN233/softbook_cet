import { RemoteHttpError } from '../runtime/remoteHttpError';
import type { LearningTrack } from '../learning/model';

export type SpaceStateRepositoryMode = 'local' | 'remote';
export type SpaceActionDimension = 'favorite' | 'sleep';
export type SpaceActionResultStatus = 'applied' | 'duplicate' | 'stale';

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

export type SpaceAction = {
  actionId: string;
  cardId: string;
  clientOccurredAt: string;
  dimension: SpaceActionDimension;
  value: boolean;
};

export type SpaceActionCommand = {
  actions: SpaceAction[];
  contentVersion: string;
  track: LearningTrack;
};

export type SpaceActionAck = {
  acknowledgedAt: string;
  contentVersion: string;
  results: Array<{
    actionId: string;
    status: SpaceActionResultStatus;
  }>;
  snapshot: SpaceStateSnapshot;
  track: LearningTrack;
};

export type SpaceStateContext = {
  authToken?: string;
  dayKey?: string;
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
  applyActions: (
    context: SpaceStateContext,
    command: SpaceActionCommand,
    dayKey: string,
  ) => Promise<SpaceActionAck>;
};

export type SpaceStateRepositoryConfig = {
  fetchImpl?: FetchLike;
  mode: SpaceStateRepositoryMode;
  remoteConfig?: SpaceStateRemoteConfig;
};

const CONTENT_VERSION_PATTERN = /^sha256:[0-9a-f]{64}$/;
const OPAQUE_ID_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._:-]{0,127}$/;

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

export function applySpaceActionToMap(
  current: Record<string, SpaceCardStateValue>,
  action: SpaceAction,
): Record<string, SpaceCardStateValue> {
  const existing = Object.hasOwn(current, action.cardId)
    ? current[action.cardId]
    : {
        isFavorited: false,
        isSleeping: false,
        lastModifiedAt: action.clientOccurredAt,
      };

  return {
    ...current,
    [action.cardId]: {
      ...existing,
      ...(action.dimension === 'favorite'
        ? { isFavorited: action.value }
        : { isSleeping: action.value }),
      lastModifiedAt: action.clientOccurredAt,
    },
  };
}

export function createSpaceAction(input: {
  cardId: string;
  dimension: SpaceActionDimension;
  now?: () => Date;
  random?: () => number;
  value: boolean;
}): SpaceAction {
  const now = input.now?.() ?? new Date();
  const random = input.random?.() ?? Math.random();
  const timestamp = now.toISOString();
  const randomPart = Math.floor(random * Number.MAX_SAFE_INTEGER)
    .toString(36)
    .padStart(11, '0');

  return validateSpaceAction({
    actionId: `space_${now.getTime().toString(36)}_${randomPart}`,
    cardId: input.cardId,
    clientOccurredAt: timestamp,
    dimension: input.dimension,
    value: input.value,
  });
}

export function createSpaceStateRepository(
  config: SpaceStateRepositoryConfig,
): SpaceStateRepository {
  return {
    async applyActions(context, command, dayKey) {
      const validated = validateSpaceActionCommand(command);

      if (config.mode === 'local') {
        const snapshot = validated.actions.reduce(
          (current, action) => applySpaceActionToMap(current, action),
          {} as Record<string, SpaceCardStateValue>,
        );
        const acknowledgedAt = new Date().toISOString();

        return {
          acknowledgedAt,
          contentVersion: validated.contentVersion,
          results: validated.actions.map(action => ({
            actionId: action.actionId,
            status: 'applied' as const,
          })),
          snapshot: createSpaceStateSnapshot({
            dayKey,
            spaceCardStateById: snapshot,
          }),
          track: validated.track,
        };
      }

      if (!config.remoteConfig) {
        throw new Error('Remote space actions require remoteConfig.');
      }

      const fetchImpl = config.fetchImpl ?? fetch;
      const response = await fetchImpl(config.remoteConfig.endpoint, {
        body: JSON.stringify({
          schema_version: 'space-actions.v2',
          track: validated.track,
          content_version: validated.contentVersion,
          actions: validated.actions.map(action => ({
            action_id: action.actionId,
            card_id: action.cardId,
            dimension: action.dimension,
            value: action.value,
            client_occurred_at: action.clientOccurredAt,
          })),
        }),
        headers: buildRemoteSpaceStateHeaders(config.remoteConfig, context),
        method: 'POST',
      });

      if (!response.ok) {
        throw new RemoteHttpError(
          `Remote space action failed with ${response.status}.`,
          response.status,
        );
      }

      return parseRemoteSpaceActionAck(await response.json(), {
        command: validated,
        dayKey,
      });
    },
  };
}

export function parseRemoteSpaceActionAck(
  payload: unknown,
  expected: { command: SpaceActionCommand; dayKey: string },
): SpaceActionAck {
  const root = requireExactObject(payload, ['data'], 'response');
  const data = requireExactObject(
    root.data,
    [
      'acknowledged_at',
      'content_version',
      'results',
      'schema_version',
      'space_state',
      'track',
    ],
    'response.data',
  );

  if (data.schema_version !== 'space-actions-ack.v2') {
    throw new Error(
      'Remote space action response schema_version must be space-actions-ack.v2.',
    );
  }

  const acknowledgedAt = requireIsoTimestamp(
    data.acknowledged_at,
    'response.data.acknowledged_at',
  );
  const track = requireTrack(data.track, 'response.data.track');
  const contentVersion = requireContentVersion(
    data.content_version,
    'response.data.content_version',
  );

  if (
    track !== expected.command.track ||
    contentVersion !== expected.command.contentVersion
  ) {
    throw new Error('Remote space action acknowledgement scope is invalid.');
  }

  if (
    !Array.isArray(data.results) ||
    data.results.length !== expected.command.actions.length
  ) {
    throw new Error(
      'Remote space action results must match the submitted actions.',
    );
  }

  const results = data.results.map((value, index) => {
    const result = requireExactObject(
      value,
      ['action_id', 'status'],
      `response.data.results[${index}]`,
    );
    const expectedAction = expected.command.actions[index];

    if (
      result.action_id !== expectedAction.actionId ||
      (result.status !== 'applied' &&
        result.status !== 'duplicate' &&
        result.status !== 'stale')
    ) {
      throw new Error(
        `Remote space action results[${index}] does not match its command.`,
      );
    }

    return {
      actionId: result.action_id,
      status: result.status as SpaceActionResultStatus,
    };
  });
  const rawState = requireExactObject(
    data.space_state,
    ['acknowledged_at', 'content_version', 'schema_version', 'states', 'track'],
    'response.data.space_state',
  );

  if (
    rawState.schema_version !== 'space-state.v2' ||
    rawState.track !== track ||
    rawState.content_version !== contentVersion
  ) {
    throw new Error('Remote canonical space state scope is invalid.');
  }

  requireIsoTimestamp(
    rawState.acknowledged_at,
    'response.data.space_state.acknowledged_at',
  );

  return {
    acknowledgedAt,
    contentVersion,
    results,
    snapshot: parseRemoteSpaceStateProjection(rawState.states, expected.dayKey),
    track,
  };
}

export function parseRemoteSpaceStateProjection(
  value: unknown,
  dayKey: string,
): SpaceStateSnapshot {
  if (!Array.isArray(value)) {
    throw new Error('Remote canonical space states must be an array.');
  }

  const seenCardIds = new Set<string>();
  let previousCardId: string | null = null;
  const states = value.map((itemValue, index) => {
    const item = requireExactObject(
      itemValue,
      ['card_id', 'is_favorited', 'is_sleeping', 'last_modified_at'],
      `space states[${index}]`,
    );
    const cardId = requireOpaqueId(
      item.card_id,
      `space states[${index}].card_id`,
    );

    if (seenCardIds.has(cardId)) {
      throw new Error(
        `Remote space state contains duplicate card_id ${cardId}.`,
      );
    }

    if (previousCardId !== null && previousCardId.localeCompare(cardId) >= 0) {
      throw new Error(
        'Remote canonical space states must be sorted by card_id.',
      );
    }

    if (
      typeof item.is_favorited !== 'boolean' ||
      typeof item.is_sleeping !== 'boolean'
    ) {
      throw new Error(`Remote space state states[${index}] flags are invalid.`);
    }

    seenCardIds.add(cardId);
    previousCardId = cardId;
    return {
      cardId,
      isFavorited: item.is_favorited,
      isSleeping: item.is_sleeping,
      lastModifiedAt: requireIsoTimestamp(
        item.last_modified_at,
        `space states[${index}].last_modified_at`,
      ),
    };
  });

  return {
    dayKey,
    states,
  };
}

function validateSpaceActionCommand(
  value: SpaceActionCommand,
): SpaceActionCommand {
  const track = requireTrack(value.track, 'track');
  const contentVersion = requireContentVersion(
    value.contentVersion,
    'contentVersion',
  );

  if (
    !Array.isArray(value.actions) ||
    value.actions.length === 0 ||
    value.actions.length > 20
  ) {
    throw new Error('Space action command must contain 1-20 actions.');
  }

  const actionIds = new Set<string>();
  const actions = value.actions.map(action => {
    const validated = validateSpaceAction(action);

    if (actionIds.has(validated.actionId)) {
      throw new Error('Space action IDs must be unique in one command.');
    }

    actionIds.add(validated.actionId);
    return validated;
  });

  return { actions, contentVersion, track };
}

function validateSpaceAction(value: SpaceAction): SpaceAction {
  const actionId = requireOpaqueId(value.actionId, 'actionId');
  const cardId = requireOpaqueId(value.cardId, 'cardId');
  const clientOccurredAt = requireIsoTimestamp(
    value.clientOccurredAt,
    'clientOccurredAt',
  );

  if (value.dimension !== 'favorite' && value.dimension !== 'sleep') {
    throw new Error('Space action dimension must be favorite or sleep.');
  }

  if (typeof value.value !== 'boolean') {
    throw new Error('Space action value must be boolean.');
  }

  return {
    actionId,
    cardId,
    clientOccurredAt,
    dimension: value.dimension,
    value: value.value,
  };
}

function buildRemoteSpaceStateHeaders(
  config: SpaceStateRemoteConfig,
  context: SpaceStateContext,
) {
  if (!context.authToken) {
    throw new RemoteHttpError('Remote space action requires authToken.', 401);
  }

  return {
    'content-type': 'application/json',
    Authorization: `Bearer ${context.authToken}`,
    ...config.headers,
  };
}

function requireExactObject(
  input: unknown,
  expectedKeys: string[],
  contextName: string,
): Record<string, unknown> {
  if (!isObject(input)) {
    throw new Error(`${contextName} must be an object.`);
  }

  const actual = Object.keys(input).sort();
  const expected = [...expectedKeys].sort();

  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${contextName} has unexpected fields.`);
  }

  return input;
}

function requireOpaqueId(input: unknown, contextName: string): string {
  if (typeof input !== 'string' || !OPAQUE_ID_PATTERN.test(input)) {
    throw new Error(`${contextName} must be a valid opaque identifier.`);
  }

  return input;
}

function requireContentVersion(input: unknown, contextName: string): string {
  if (typeof input !== 'string' || !CONTENT_VERSION_PATTERN.test(input)) {
    throw new Error(`${contextName} must be a SHA-256 content version.`);
  }

  return input;
}

function requireTrack(input: unknown, contextName: string): LearningTrack {
  if (input !== 'cet4' && input !== 'cet6') {
    throw new Error(`${contextName} must be cet4 or cet6.`);
  }

  return input;
}

function requireIsoTimestamp(input: unknown, contextName: string): string {
  if (typeof input !== 'string' || !isValidRfc3339Timestamp(input)) {
    throw new Error(`${contextName} must be an RFC3339 timestamp.`);
  }

  return new Date(input).toISOString();
}

export function isValidRfc3339Timestamp(input: string) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(
      input,
    );

  if (!match) {
    return false;
  }

  const [, year, month, day, hour, minute, second, zone] = match;
  const calendarDate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  const offset = zone === 'Z' ? [0, 0] : zone.slice(1).split(':').map(Number);

  return (
    calendarDate.getUTCFullYear() === Number(year) &&
    calendarDate.getUTCMonth() + 1 === Number(month) &&
    calendarDate.getUTCDate() === Number(day) &&
    Number(hour) <= 23 &&
    Number(minute) <= 59 &&
    Number(second) <= 59 &&
    offset[0] <= 23 &&
    offset[1] <= 59 &&
    Number.isFinite(Date.parse(input))
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
