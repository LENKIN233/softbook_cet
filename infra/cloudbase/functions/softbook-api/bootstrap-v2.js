const crypto = require('node:crypto');

const BOOTSTRAP_SCHEMA_VERSION = 'bootstrap.v2';
const CONTENT_RELEASE_SCHEMA_VERSION = 'content-release.v1';
const TRACKS = ['cet4', 'cet6'];
const CHINA_OFFSET_MILLISECONDS = 8 * 60 * 60 * 1000;
const OUTCOMES_BY_INTERACTION = {
  flip: ['confident', 'review'],
  multiple_choice: ['correct', 'incorrect'],
  lock: ['correct', 'incorrect'],
  elimination: ['correct', 'incorrect'],
  swipe: ['correct', 'incorrect'],
};
const ANSWER_GRADE_BY_OUTCOME = {
  correct: 'passed',
  incorrect: 'review_needed',
  confident: 'passed',
  review: 'review_needed',
};

function createBootstrapV2Service(options) {
  const config = {
    now: options.now,
    runtimeMode: options.runtimeMode,
    store: options.store,
  };
  validateConfig(config);

  return {
    read: input => readBootstrap(config, input),
  };
}

async function readBootstrap(config, input) {
  const cardSource = await config.store.getCardSource(input.track, {
    allowDevelopmentDefault: config.runtimeMode !== 'production',
  });

  if (
    config.runtimeMode === 'production' &&
    (cardSource.release === null || cardSource.release === undefined)
  ) {
    throw contentReleaseUnavailableError(
      'A matching published content release is required.',
    );
  }

  const [membership, progress, learning, space] = await Promise.all([
    config.store.getMembership(input.phoneNumber),
    config.store.getDailyProgress(input.phoneNumber, input.dayKey, {
      accountKey: input.accountKey,
    }),
    config.store.getLearningState(
      input.phoneNumber,
      input.dayKey,
      input.track,
      {accountKey: input.accountKey},
    ),
    config.store.getSpaceState(input.phoneNumber, input.dayKey),
  ]);
  const normalizedSpace = normalizeSpaceState(space, input.dayKey);
  const normalizedLearning = applySpaceFavorites(
    normalizeLearningState(learning, input.dayKey, input.track),
    normalizedSpace,
  );
  const normalizedProgress = applySpaceCounts(
    normalizeDailyProgress(progress, input.dayKey),
    normalizedSpace,
  );

  return {
    schema_version: BOOTSTRAP_SCHEMA_VERSION,
    generated_at: config.now().toISOString(),
    day_key: input.dayKey,
    track: input.track,
    content: serializeContent(cardSource),
    learning: normalizedLearning,
    membership: normalizeMembership(membership),
    progress: normalizedProgress,
    space: normalizedSpace,
  };
}

function serializeContent(cardSource) {
  const release = cardSource.release;

  return {
    card_count: cardSource.card_records.length,
    release_id: release?.release_id ?? null,
    minimum_client_version: release?.minimum_client_version ?? null,
    parent_release_id: release?.parent_release_id ?? null,
    published_at: release?.published_at ?? null,
    source: {
      id: cardSource.source.id,
      label: cardSource.source.label,
    },
    version: cardSource.content_version,
  };
}

function normalizeDailyProgress(snapshot, expectedDayKey) {
  return readCanonicalState('daily progress', () => {
    const progress = requireObject(snapshot, 'daily progress');
    const dayKey = requireDayKey(progress.day_key, 'daily progress.day_key');
    const isV2Projection = progress.projection_version === 'learning-events.v2';

    if (progress.projection_version !== undefined && !isV2Projection) {
      throw new Error('daily progress projection version is invalid.');
    }

    if (dayKey !== expectedDayKey) {
      throw new Error('day_key does not match the requested day.');
    }

    const normalized = {
      acknowledged_at: optionalIsoTimestamp(
        progress.acknowledged_at,
        'daily progress.acknowledged_at',
      ),
      checked_in_today: requireBoolean(
        progress.checked_in_today,
        'daily progress.checked_in_today',
      ),
      day_key: dayKey,
      favorite_count: requireNonNegativeInteger(
        progress.favorite_count,
        'daily progress.favorite_count',
      ),
      learning_completed_count: requireNonNegativeInteger(
        progress.learning_completed_count,
        'daily progress.learning_completed_count',
      ),
      pending_review_count: requireNonNegativeInteger(
        progress.pending_review_count,
        'daily progress.pending_review_count',
      ),
      review_completed_count: requireNonNegativeInteger(
        progress.review_completed_count,
        'daily progress.review_completed_count',
      ),
      sleeping_count: requireNonNegativeInteger(
        progress.sleeping_count,
        'daily progress.sleeping_count',
      ),
      total_completed_count: requireNonNegativeInteger(
        progress.total_completed_count,
        'daily progress.total_completed_count',
      ),
    };

    if (
      isV2Projection &&
      normalized.total_completed_count !==
        normalized.learning_completed_count + normalized.review_completed_count
    ) {
      throw new Error('daily progress total is not server-derived.');
    }

    return normalized;
  });
}

function normalizeLearningState(snapshot, expectedDayKey, expectedTrack) {
  return readCanonicalState('learning state', () => {
    const state = requireObject(snapshot, 'learning state');
    const dayKey = requireDayKey(state.day_key, 'learning state.day_key');
    const track = requireTrack(state.track, 'learning state.track');
    const isV2Projection = state.projection_version === 'learning-events.v2';

    if (state.projection_version !== undefined && !isV2Projection) {
      throw new Error('learning state projection version is invalid.');
    }

    if (isV2Projection && typeof state.legacy_baseline_migrated !== 'boolean') {
      throw new Error('learning state migration authority is invalid.');
    }

    if (dayKey !== expectedDayKey || track !== expectedTrack) {
      throw new Error('learning state scope does not match the request.');
    }

    const eventsByCardId = requireObject(
      state.events_by_card_id,
      'learning state.events_by_card_id',
    );
    const source = normalizeLearningSource(state, eventsByCardId);
    const cardStates = Object.entries(eventsByCardId).map(
      ([storedCardId, event], index) => {
        const parsed = normalizeLearningEvent(
          event,
          `learning state.events[${index}]`,
          isV2Projection,
        );

        if (parsed.card_id !== storedCardId) {
          throw new Error('learning state card key does not match card_id.');
        }

        return parsed;
      },
    );

    return {
      acknowledged_at: optionalIsoTimestamp(
        state.acknowledged_at,
        'learning state.acknowledged_at',
      ),
      card_states: cardStates.sort((left, right) =>
        left.card_id.localeCompare(right.card_id),
      ),
      cursor: normalizeLearningCursor(state.cursor, track),
      source,
    };
  });
}

function normalizeLearningEvent(value, label, isV2Projection) {
  const event = requireObject(value, label);
  const normalized = {
    card_id: requireCardId(event.card_id, `${label}.card_id`),
    completed_at: requireIsoTimestamp(
      event.completed_at,
      `${label}.completed_at`,
    ),
    interaction_id: requireEnum(
      event.interaction_id,
      ['flip', 'multiple_choice', 'lock', 'elimination', 'swipe'],
      `${label}.interaction_id`,
    ),
    outcome: requireEnum(
      event.outcome,
      ['correct', 'incorrect', 'confident', 'review'],
      `${label}.outcome`,
    ),
    phase: requireEnum(event.phase, ['learning', 'review'], `${label}.phase`),
    used_hint: requireBoolean(event.used_hint, `${label}.used_hint`),
    used_peek: requireBoolean(event.used_peek, `${label}.used_peek`),
  };

  if (!isV2Projection) {
    return {
      ...normalized,
      is_favorited: requireBoolean(event.is_favorited, `${label}.is_favorited`),
    };
  }

  const answerGrade = requireEnum(
    event.answer_grade,
    ['passed', 'review_needed'],
    `${label}.answer_grade`,
  );
  const serverSequence = requireNonNegativeSafeInteger(
    event.server_sequence,
    `${label}.server_sequence`,
  );

  if (ANSWER_GRADE_BY_OUTCOME[normalized.outcome] !== answerGrade) {
    throw new Error(`${label}.answer_grade does not match outcome.`);
  }

  if (
    !OUTCOMES_BY_INTERACTION[normalized.interaction_id].includes(
      normalized.outcome,
    )
  ) {
    throw new Error(`${label}.outcome does not match interaction_id.`);
  }

  if (serverSequence > 0) {
    const eventId = requireString(event.event_id, `${label}.event_id`);

    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(eventId)) {
      throw new Error(`${label}.event_id is invalid.`);
    }

    if (event.is_favorited !== undefined) {
      throw new Error(`${label}.is_favorited has invalid event authority.`);
    }

    normalized.event_id = eventId;
    normalized.answer_grade = answerGrade;
    normalized.content_version = requireContentVersion(
      event.content_version,
      `${label}.content_version`,
    );
    normalized.server_sequence = serverSequence;
    const activityDay = requireDayKey(
      event.activity_day,
      `${label}.activity_day`,
    );

    if (activityDay !== chinaActivityDay(Date.parse(event.completed_at))) {
      throw new Error(`${label}.activity_day does not match completed_at.`);
    }
  } else {
    if (
      event.event_id !== undefined ||
      event.content_version !== undefined ||
      event.activity_day !== undefined
    ) {
      throw new Error(`${label} has invalid migrated-event authority.`);
    }

    normalized.is_favorited = requireBoolean(
      event.is_favorited,
      `${label}.is_favorited`,
    );
    normalized.answer_grade = answerGrade;
    normalized.server_sequence = serverSequence;
  }

  return normalized;
}

function applySpaceFavorites(learning, space) {
  const favoriteByCardId = new Map(
    space.states.map(state => [state.card_id, state.is_favorited]),
  );

  return {
    ...learning,
    card_states: learning.card_states.map(state => ({
      ...state,
      is_favorited: favoriteByCardId.get(state.card_id) ?? false,
    })),
  };
}

function applySpaceCounts(progress, space) {
  return {
    ...progress,
    favorite_count: space.states.filter(state => state.is_favorited).length,
    sleeping_count: space.states.filter(state => state.is_sleeping).length,
  };
}

function normalizeLearningSource(state, eventsByCardId) {
  const hasEvents = Object.keys(eventsByCardId).length > 0;
  const hasSource = state.source_id != null || state.source_label != null;

  if (!hasEvents && !hasSource) {
    return null;
  }

  return {
    id: requireString(state.source_id, 'learning state.source_id'),
    label: requireString(state.source_label, 'learning state.source_label'),
  };
}

function normalizeLearningCursor(cursor, expectedTrack) {
  if (cursor === undefined || cursor === null) {
    return null;
  }

  const value = requireObject(cursor, 'learning state.cursor');
  const track = requireTrack(value.track, 'learning state.cursor.track');

  if (track !== expectedTrack) {
    throw new Error('learning cursor does not match the requested track.');
  }

  return {
    card_id: requireCardId(value.card_id, 'learning state.cursor.card_id'),
    source_id: requireString(
      value.source_id,
      'learning state.cursor.source_id',
    ),
    track,
  };
}

function normalizeMembership(value) {
  return readCanonicalState('membership', () => {
    const membership = requireObject(value, 'membership');
    const trialStartedAtEntryCount = membership.trial_started_at_entry_count;

    if (
      trialStartedAtEntryCount !== null &&
      (!Number.isInteger(trialStartedAtEntryCount) ||
        trialStartedAtEntryCount <= 0)
    ) {
      throw new Error('membership trial start count is invalid.');
    }

    return {
      acknowledged_at: optionalIsoTimestamp(
        membership.acknowledged_at,
        'membership.acknowledged_at',
      ),
      stage: requireEnum(
        membership.stage,
        ['trial_available', 'trial', 'free', 'premium'],
        'membership.stage',
      ),
      counted_entry_count: requireNonNegativeInteger(
        membership.counted_entry_count,
        'membership.counted_entry_count',
      ),
      last_experience_ended_by:
        membership.last_experience_ended_by === null
          ? null
          : requireEnum(
              membership.last_experience_ended_by,
              ['trial', 'premium'],
              'membership.last_experience_ended_by',
            ),
      recovery_prompt_visible: requireBoolean(
        membership.recovery_prompt_visible,
        'membership.recovery_prompt_visible',
      ),
      trial_duration_days: requirePositiveInteger(
        membership.trial_duration_days,
        'membership.trial_duration_days',
      ),
      trial_started_at_entry_count: trialStartedAtEntryCount,
    };
  });
}

function normalizeSpaceState(snapshot, expectedDayKey) {
  return readCanonicalState('space state', () => {
    const state = requireObject(snapshot, 'space state');
    const dayKey = requireDayKey(state.day_key, 'space state.day_key');
    const statesByCardId = requireObject(
      state.states_by_card_id,
      'space state.states_by_card_id',
    );

    if (dayKey !== expectedDayKey) {
      throw new Error('space state day_key does not match the request.');
    }

    const states = Object.entries(statesByCardId).map(
      ([storedCardId, value], index) => {
        const label = `space state.states[${index}]`;
        const item = requireObject(value, label);
        const parsed = {
          card_id: requireCardId(item.card_id, `${label}.card_id`),
          is_favorited: requireBoolean(
            item.is_favorited,
            `${label}.is_favorited`,
          ),
          is_sleeping: requireBoolean(item.is_sleeping, `${label}.is_sleeping`),
          last_modified_at: requireIsoTimestamp(
            item.last_modified_at,
            `${label}.last_modified_at`,
          ),
        };

        if (parsed.card_id !== storedCardId) {
          throw new Error('space state card key does not match card_id.');
        }

        return parsed;
      },
    );

    return {
      acknowledged_at: optionalIsoTimestamp(
        state.acknowledged_at,
        'space state.acknowledged_at',
      ),
      day_key: dayKey,
      states: states.sort((left, right) =>
        left.card_id.localeCompare(right.card_id),
      ),
    };
  });
}

function createContentVersion(cardSource) {
  const digest = crypto
    .createHash('sha256')
    .update(stableJsonStringify(cardSource))
    .digest('hex');

  return `sha256:${digest}`;
}

function normalizeContentRelease(value, contentVersion, expectedTrack) {
  if (value === undefined || value === null) {
    return null;
  }

  const release = requireCardSourceObject(value, 'card source.release');
  const schemaVersion = requireCardSourceString(
    release.schema_version,
    'card source.release.schema_version',
  );
  const track = requireCardSourceTrack(
    release.track,
    'card source.release.track',
  );
  const declaredContentVersion = requireCardSourceString(
    release.content_version,
    'card source.release.content_version',
  );
  const publishedAt = requireCardSourceString(
    release.published_at,
    'card source.release.published_at',
  );
  const releaseId = requireContentReleaseId(
    release.release_id,
    'card source.release.release_id',
  );
  const minimumClientVersion = requireCardSourceString(
    release.minimum_client_version,
    'card source.release.minimum_client_version',
  );
  const parentReleaseId = requireOptionalContentReleaseId(
    release.parent_release_id,
    'card source.release.parent_release_id',
  );

  if (schemaVersion !== CONTENT_RELEASE_SCHEMA_VERSION) {
    throw cardSourceError(
      `card source.release.schema_version must be ${CONTENT_RELEASE_SCHEMA_VERSION}.`,
    );
  }

  if (track !== expectedTrack) {
    throw cardSourceError(
      'card source.release.track must match card source track.',
    );
  }

  if (declaredContentVersion !== contentVersion) {
    throw cardSourceError(
      'card source.release.content_version must match normalized content.',
    );
  }

  const publishedAtTime = Date.parse(publishedAt);

  if (Number.isNaN(publishedAtTime)) {
    throw cardSourceError(
      'card source.release.published_at must be ISO timestamp.',
    );
  }

  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(minimumClientVersion)) {
    throw cardSourceError(
      'card source.release.minimum_client_version must use semantic version form.',
    );
  }

  if (parentReleaseId === releaseId) {
    throw cardSourceError(
      'card source.release.parent_release_id must differ from release_id.',
    );
  }

  return {
    schema_version: schemaVersion,
    release_id: releaseId,
    track,
    content_version: declaredContentVersion,
    minimum_client_version: minimumClientVersion,
    parent_release_id: parentReleaseId,
    published_at: new Date(publishedAtTime).toISOString(),
  };
}

function stableJsonStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(item => stableJsonStringify(item)).join(',')}]`;
  }

  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function validateConfig(config) {
  if (!['development', 'production'].includes(config.runtimeMode)) {
    throw new Error(
      `Unsupported bootstrap runtime mode: ${config.runtimeMode}`,
    );
  }

  if (typeof config.now !== 'function') {
    throw new Error('Bootstrap v2 requires a clock.');
  }

  const requiredStoreMethods = [
    'getCardSource',
    'getDailyProgress',
    'getLearningState',
    'getMembership',
    'getSpaceState',
  ];

  for (const method of requiredStoreMethods) {
    if (typeof config.store?.[method] !== 'function') {
      throw new Error(`Bootstrap v2 store is missing ${method}().`);
    }
  }
}

function readCanonicalState(label, read) {
  try {
    return read();
  } catch {
    throw httpError(
      500,
      'invalid_canonical_state',
      `Stored ${label} is invalid.`,
    );
  }
}

function requireObject(value, fieldName) {
  if (!isObject(value) || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }

  return value;
}

function requireString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function requireBoolean(value, fieldName) {
  if (typeof value !== 'boolean') {
    throw new Error(`${fieldName} must be boolean.`);
  }

  return value;
}

function requireNonNegativeInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }

  return value;
}

function requirePositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return value;
}

function requireNonNegativeSafeInteger(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative safe integer.`);
  }

  return value;
}

function requireContentVersion(value, fieldName) {
  const contentVersion = requireString(value, fieldName);

  if (!/^sha256:[a-f0-9]{64}$/.test(contentVersion)) {
    throw new Error(`${fieldName} must be a lowercase SHA-256 identifier.`);
  }

  return contentVersion;
}

function requireEnum(value, allowed, fieldName) {
  if (!allowed.includes(value)) {
    throw new Error(`${fieldName} is invalid.`);
  }

  return value;
}

function requireDayKey(value, fieldName) {
  const dayKey = requireString(value, fieldName);

  if (!isValidDayKey(dayKey)) {
    throw new Error(`${fieldName} must be a valid YYYY-MM-DD calendar date.`);
  }

  return dayKey;
}

function isValidDayKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function chinaActivityDay(timestamp) {
  return new Date(timestamp + CHINA_OFFSET_MILLISECONDS)
    .toISOString()
    .slice(0, 10);
}

function requireTrack(value, fieldName) {
  return requireEnum(value, TRACKS, fieldName);
}

function requireCardId(value, fieldName) {
  const cardId = requireString(value, fieldName);

  if (!/^\d{6}$/.test(cardId)) {
    throw new Error(`${fieldName} must contain six digits.`);
  }

  return cardId;
}

function requireIsoTimestamp(value, fieldName) {
  const timestamp = requireString(value, fieldName);
  const parsed = Date.parse(timestamp);

  if (Number.isNaN(parsed)) {
    throw new Error(`${fieldName} must be an ISO timestamp.`);
  }

  return new Date(parsed).toISOString();
}

function optionalIsoTimestamp(value, fieldName) {
  return value === undefined || value === null
    ? null
    : requireIsoTimestamp(value, fieldName);
}

function requireCardSourceObject(value, fieldName) {
  if (!isObject(value) || Array.isArray(value)) {
    throw cardSourceError(`${fieldName} must be an object.`);
  }

  return value;
}

function requireCardSourceString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw cardSourceError(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function requireCardSourceTrack(value, fieldName) {
  const track = requireCardSourceString(value, fieldName);

  if (!TRACKS.includes(track)) {
    throw cardSourceError(`${fieldName} must be cet4 or cet6.`);
  }

  return track;
}

function requireContentReleaseId(value, fieldName) {
  const releaseId = requireCardSourceString(value, fieldName);

  if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$/.test(releaseId)) {
    throw cardSourceError(
      `${fieldName} must contain 1-128 URL-safe identifier characters.`,
    );
  }

  return releaseId;
}

function requireOptionalContentReleaseId(value, fieldName) {
  if (value === undefined || value === null) {
    return null;
  }

  return requireContentReleaseId(value, fieldName);
}

function cardSourceError(message) {
  return httpError(500, 'invalid_card_source', message);
}

function contentReleaseUnavailableError(message) {
  return httpError(503, 'content_release_unavailable', message);
}

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function isObject(value) {
  return typeof value === 'object' && value !== null;
}

module.exports = {
  contentReleaseUnavailableError,
  createBootstrapV2Service,
  createContentVersion,
  normalizeContentRelease,
};
