import type { LearningCardResult, LearningTrack } from '../learning/model';
import type { MembershipState } from '../membership/localMembership';
import { parseSoftbookRemoteMembershipPayload } from '../membership/membershipRepository';
import { RemoteHttpError } from '../runtime/remoteHttpError';
import type { SpaceStateSnapshot } from '../space/spaceStateRepository';
import { parseRemoteSpaceStateProjection } from '../space/spaceStateRepository';
import type { DailyProgressSnapshot } from '../sync/progressSyncRepository';

export type AccountBootstrapRepositoryMode = 'local' | 'remote';

export type AccountBootstrapContent = {
  cardCount: number;
  minimumClientVersion: string | null;
  parentReleaseId: string | null;
  publishedAt: string | null;
  releaseId: string | null;
  source: {
    id: string;
    label: string;
  };
  version: string;
};

export type AccountBootstrapLearningCardState = LearningCardResult & {
  phase: 'learning' | 'review';
};

export type AccountBootstrapLearningState = {
  acknowledgedAt: string | null;
  cardStates: AccountBootstrapLearningCardState[];
  cursor: {
    cardId: string;
    sourceId: string;
    track: LearningTrack;
  } | null;
  source: {
    id: string;
    label: string;
  } | null;
};

export type AccountBootstrapSnapshot = {
  content: AccountBootstrapContent;
  dayKey: string;
  generatedAt: string;
  learning: AccountBootstrapLearningState;
  membership: {
    acknowledgedAt: string | null;
    state: MembershipState;
  };
  progress: {
    acknowledgedAt: string | null;
    snapshot: DailyProgressSnapshot;
  };
  schemaVersion: 'bootstrap.v2';
  space: {
    acknowledgedAt: string | null;
    snapshot: SpaceStateSnapshot;
  };
  track: LearningTrack;
};

export type AccountBootstrapRemoteConfig = {
  endpoint: string;
  headers?: Record<string, string>;
};

export type AccountBootstrapFetch = (
  input: string,
  init?: {
    headers?: Record<string, string>;
    method?: string;
  },
) => Promise<{
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
}>;

export type AccountBootstrapRepositoryConfig = {
  fetchImpl?: AccountBootstrapFetch;
  mode: AccountBootstrapRepositoryMode;
  remoteConfig?: AccountBootstrapRemoteConfig;
};

export type AccountBootstrapRepository = {
  load: (
    track: LearningTrack,
    dayKey: string,
  ) => Promise<AccountBootstrapSnapshot | null>;
};

export type SoftbookRemoteAccountBootstrapRuntimeConfig = {
  apiKey?: string;
  baseUrl: string;
};

const CONTENT_VERSION_PATTERN = /^sha256:[0-9a-f]{64}$/;
const SEMANTIC_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function createAccountBootstrapRepository(
  config: AccountBootstrapRepositoryConfig,
): AccountBootstrapRepository {
  return {
    async load(track, dayKey) {
      assertTrack(track, 'requested track');
      assertDayKey(dayKey, 'requested day_key');

      if (config.mode === 'local') {
        return null;
      }

      if (!config.remoteConfig) {
        throw new Error('Remote account bootstrap requires remoteConfig.');
      }

      const fetchImpl = config.fetchImpl ?? fetch;
      const response = await fetchImpl(
        buildAccountBootstrapUrl(config.remoteConfig.endpoint, track, dayKey),
        {
          headers: {
            Accept: 'application/json',
            ...config.remoteConfig.headers,
          },
          method: 'GET',
        },
      );

      if (!response.ok) {
        throw new RemoteHttpError(
          `Remote account bootstrap failed with ${response.status}.`,
          response.status,
        );
      }

      return parseAccountBootstrapPayload(await response.json(), track, dayKey);
    },
  };
}

export function createSoftbookRemoteAccountBootstrapConfig(
  config: SoftbookRemoteAccountBootstrapRuntimeConfig,
): AccountBootstrapRemoteConfig {
  const baseUrl = trimTrailingSlash(config.baseUrl);

  if (baseUrl.length === 0) {
    throw new Error('Remote account bootstrap requires a non-empty baseUrl.');
  }

  return {
    endpoint: `${baseUrl}/v2/bootstrap`,
    headers: {
      'x-softbook-client': 'mobile',
      ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
    },
  };
}

export function parseAccountBootstrapPayload(
  payload: unknown,
  expectedTrack: LearningTrack,
  expectedDayKey: string,
): AccountBootstrapSnapshot {
  assertTrack(expectedTrack, 'expected track');
  assertDayKey(expectedDayKey, 'expected day_key');

  const envelope = requireObject(payload, 'bootstrap payload');
  const data = requireObject(envelope.data, 'bootstrap payload.data');

  if (data.schema_version !== 'bootstrap.v2') {
    throw new Error('Bootstrap payload schema_version must be bootstrap.v2.');
  }

  const track = readTrack(data.track, 'bootstrap payload.data.track');
  const dayKey = readDayKey(data.day_key, 'bootstrap payload.data.day_key');

  if (track !== expectedTrack || dayKey !== expectedDayKey) {
    throw new Error('Bootstrap payload scope must match the request.');
  }

  const content = parseContent(data.content);
  const learning = parseLearning(data.learning, expectedTrack);
  const membership = parseMembership(data.membership);
  const progress = parseProgress(data.progress, expectedDayKey);
  const space = parseSpace(
    data.space,
    expectedDayKey,
    expectedTrack,
    content.version,
  );

  if (
    (learning.source !== null && learning.source.id !== content.source.id) ||
    (learning.cursor !== null && learning.cursor.sourceId !== content.source.id)
  ) {
    throw new Error('Bootstrap learning source must match content source.');
  }

  if (
    learning.cardStates.length > content.cardCount ||
    space.snapshot.states.length > content.cardCount
  ) {
    throw new Error('Bootstrap account state exceeds the content card count.');
  }

  return {
    content,
    dayKey,
    generatedAt: readIsoTimestamp(
      data.generated_at,
      'bootstrap payload.data.generated_at',
    ),
    learning,
    membership,
    progress,
    schemaVersion: 'bootstrap.v2',
    space,
    track,
  };
}

function parseContent(value: unknown): AccountBootstrapContent {
  const content = requireObject(value, 'bootstrap content');
  const source = requireObject(content.source, 'bootstrap content.source');
  const cardCount = readPositiveInteger(
    content.card_count,
    'bootstrap content.card_count',
  );
  const version = readString(content.version, 'bootstrap content.version');

  if (!CONTENT_VERSION_PATTERN.test(version)) {
    throw new Error('Bootstrap content.version must be a SHA-256 identifier.');
  }

  const releaseId = readOptionalString(
    content.release_id,
    'bootstrap content.release_id',
  );
  const minimumClientVersion = readOptionalString(
    content.minimum_client_version,
    'bootstrap content.minimum_client_version',
  );
  const parentReleaseId = readOptionalString(
    content.parent_release_id,
    'bootstrap content.parent_release_id',
  );
  const publishedAt = readOptionalIsoTimestamp(
    content.published_at,
    'bootstrap content.published_at',
  );

  if (
    releaseId === null &&
    (minimumClientVersion !== null ||
      parentReleaseId !== null ||
      publishedAt !== null)
  ) {
    throw new Error(
      'Bootstrap development content cannot carry release metadata.',
    );
  }

  if (
    releaseId !== null &&
    (minimumClientVersion === null || publishedAt === null)
  ) {
    throw new Error(
      'Bootstrap published content requires minimum version and publish time.',
    );
  }

  if (
    minimumClientVersion !== null &&
    !SEMANTIC_VERSION_PATTERN.test(minimumClientVersion)
  ) {
    throw new Error(
      'Bootstrap content.minimum_client_version must use semantic version form.',
    );
  }

  return {
    cardCount,
    minimumClientVersion,
    parentReleaseId,
    publishedAt,
    releaseId,
    source: {
      id: readString(source.id, 'bootstrap content.source.id'),
      label: readString(source.label, 'bootstrap content.source.label'),
    },
    version,
  };
}

function parseLearning(
  value: unknown,
  expectedTrack: LearningTrack,
): AccountBootstrapLearningState {
  const learning = requireObject(value, 'bootstrap learning');

  if (!Array.isArray(learning.card_states)) {
    throw new Error('Bootstrap learning.card_states must be an array.');
  }

  const seenCardIds = new Set<string>();
  const cardStates = learning.card_states.map((item, index) => {
    const state = requireObject(
      item,
      `bootstrap learning.card_states[${index}]`,
    );
    const cardId = readString(
      state.card_id,
      `bootstrap learning.card_states[${index}].card_id`,
    );

    if (seenCardIds.has(cardId)) {
      throw new Error(
        `Bootstrap learning contains duplicate card_id ${cardId}.`,
      );
    }
    seenCardIds.add(cardId);

    return {
      cardId,
      completedAt: readIsoTimestamp(
        state.completed_at,
        `bootstrap learning.card_states[${index}].completed_at`,
      ),
      interactionId: readEnum(
        state.interaction_id,
        ['flip', 'multiple_choice', 'lock', 'elimination', 'swipe'] as const,
        `bootstrap learning.card_states[${index}].interaction_id`,
      ),
      isFavorited: readBoolean(
        state.is_favorited,
        `bootstrap learning.card_states[${index}].is_favorited`,
      ),
      outcome: readEnum(
        state.outcome,
        ['correct', 'incorrect', 'confident', 'review'] as const,
        `bootstrap learning.card_states[${index}].outcome`,
      ),
      phase: readEnum(
        state.phase,
        ['learning', 'review'] as const,
        `bootstrap learning.card_states[${index}].phase`,
      ),
      usedHint: readBoolean(
        state.used_hint,
        `bootstrap learning.card_states[${index}].used_hint`,
      ),
      usedPeek: readBoolean(
        state.used_peek,
        `bootstrap learning.card_states[${index}].used_peek`,
      ),
    };
  });
  const source = parseOptionalSource(
    learning.source,
    'bootstrap learning.source',
  );

  if (cardStates.length > 0 && source === null) {
    throw new Error(
      'Bootstrap learning source is required when card state exists.',
    );
  }

  return {
    acknowledgedAt: readOptionalIsoTimestamp(
      learning.acknowledged_at,
      'bootstrap learning.acknowledged_at',
    ),
    cardStates: cardStates.sort((left, right) =>
      left.cardId.localeCompare(right.cardId),
    ),
    cursor: parseCursor(learning.cursor, expectedTrack),
    source,
  };
}

function parseMembership(value: unknown) {
  const membership = requireObject(value, 'bootstrap membership');

  return {
    acknowledgedAt: readOptionalIsoTimestamp(
      membership.acknowledged_at,
      'bootstrap membership.acknowledged_at',
    ),
    state: parseSoftbookRemoteMembershipPayload({
      data: {
        entitlement: membership,
      },
    }),
  };
}

function parseProgress(value: unknown, expectedDayKey: string) {
  const progress = requireObject(value, 'bootstrap progress');
  const dayKey = readDayKey(progress.day_key, 'bootstrap progress.day_key');

  if (dayKey !== expectedDayKey) {
    throw new Error('Bootstrap progress day_key must match the request.');
  }

  const learningCompletedCount = readNonNegativeInteger(
    progress.learning_completed_count,
    'bootstrap progress.learning_completed_count',
  );
  const reviewCompletedCount = readNonNegativeInteger(
    progress.review_completed_count,
    'bootstrap progress.review_completed_count',
  );
  const totalCompletedCount = readNonNegativeInteger(
    progress.total_completed_count,
    'bootstrap progress.total_completed_count',
  );

  if (totalCompletedCount !== learningCompletedCount + reviewCompletedCount) {
    throw new Error('Bootstrap progress total count is inconsistent.');
  }

  return {
    acknowledgedAt: readOptionalIsoTimestamp(
      progress.acknowledged_at,
      'bootstrap progress.acknowledged_at',
    ),
    snapshot: {
      checkedInToday: readBoolean(
        progress.checked_in_today,
        'bootstrap progress.checked_in_today',
      ),
      dayKey,
      favoriteCount: readNonNegativeInteger(
        progress.favorite_count,
        'bootstrap progress.favorite_count',
      ),
      learningCompletedCount,
      pendingReviewCount: readNonNegativeInteger(
        progress.pending_review_count,
        'bootstrap progress.pending_review_count',
      ),
      reviewCompletedCount,
      sleepingCount: readNonNegativeInteger(
        progress.sleeping_count,
        'bootstrap progress.sleeping_count',
      ),
      totalCompletedCount,
    },
  };
}

function parseSpace(
  value: unknown,
  expectedDayKey: string,
  expectedTrack: LearningTrack,
  expectedContentVersion: string,
) {
  const space = requireObject(value, 'bootstrap space');
  const expectedKeys = [
    'acknowledged_at',
    'content_version',
    'schema_version',
    'states',
    'track',
  ];
  const actualKeys = Object.keys(space).sort();

  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error('Bootstrap space has unexpected fields.');
  }

  if (
    space.schema_version !== 'space-state.v2' ||
    readTrack(space.track, 'bootstrap space.track') !== expectedTrack ||
    readString(space.content_version, 'bootstrap space.content_version') !==
      expectedContentVersion
  ) {
    throw new Error('Bootstrap space scope must match content.');
  }

  const snapshot = parseRemoteSpaceStateProjection(
    space.states,
    expectedDayKey,
  );

  snapshot.states.forEach((state, index) => {
    readIsoTimestamp(
      state.lastModifiedAt,
      `bootstrap space.states[${index}].last_modified_at`,
    );
  });

  return {
    acknowledgedAt: readOptionalIsoTimestamp(
      space.acknowledged_at,
      'bootstrap space.acknowledged_at',
    ),
    snapshot,
  };
}

function parseCursor(input: unknown, expectedTrack: LearningTrack) {
  if (input === null) {
    return null;
  }

  const cursor = requireObject(input, 'bootstrap learning.cursor');
  const track = readTrack(cursor.track, 'bootstrap learning.cursor.track');

  if (track !== expectedTrack) {
    throw new Error('Bootstrap learning cursor track must match the request.');
  }

  return {
    cardId: readString(cursor.card_id, 'bootstrap learning.cursor.card_id'),
    sourceId: readString(
      cursor.source_id,
      'bootstrap learning.cursor.source_id',
    ),
    track,
  };
}

function parseOptionalSource(value: unknown, label: string) {
  if (value === null) {
    return null;
  }

  const source = requireObject(value, label);
  return {
    id: readString(source.id, `${label}.id`),
    label: readString(source.label, `${label}.label`),
  };
}

function buildAccountBootstrapUrl(
  endpoint: string,
  track: LearningTrack,
  dayKey: string,
) {
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}track=${encodeURIComponent(
    track,
  )}&day_key=${encodeURIComponent(dayKey)}`;
}

function requireObject(input: unknown, field: string): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error(`${field} must be an object.`);
  }

  return input as Record<string, unknown>;
}

function readString(value: unknown, label: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function readOptionalString(value: unknown, label: string) {
  if (value === null) {
    return null;
  }

  return readString(value, label);
}

function readBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean.`);
  }

  return value;
}

function readNonNegativeInteger(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }

  return value;
}

function readPositiveInteger(value: unknown, label: string) {
  const parsed = readNonNegativeInteger(value, label);

  if (parsed === 0) {
    throw new Error(`${label} must be positive.`);
  }

  return parsed;
}

function readTrack(value: unknown, label: string): LearningTrack {
  assertTrack(value, label);
  return value;
}

function assertTrack(
  value: unknown,
  label: string,
): asserts value is LearningTrack {
  if (value !== 'cet4' && value !== 'cet6') {
    throw new Error(`${label} must be cet4 or cet6.`);
  }
}

function readDayKey(value: unknown, label: string) {
  assertDayKey(value, label);
  return value;
}

function assertDayKey(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD.`);
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`${label} must be a real calendar date.`);
  }
}

function readIsoTimestamp(value: unknown, label: string) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
      value,
    ) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new Error(`${label} must be an ISO timestamp.`);
  }

  try {
    assertDayKey(value.slice(0, 10), `${label} date`);
  } catch {
    throw new Error(`${label} must be an ISO timestamp.`);
  }

  return value;
}

function readOptionalIsoTimestamp(value: unknown, label: string) {
  if (value === null) {
    return null;
  }

  return readIsoTimestamp(value, label);
}

function readEnum<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  label: string,
): Values[number] {
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new Error(`${label} is invalid.`);
  }

  return value as Values[number];
}

function trimTrailingSlash(value: string) {
  return value.trim().replace(/\/+$/, '');
}
