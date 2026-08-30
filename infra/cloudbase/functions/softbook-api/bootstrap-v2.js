const crypto = require('node:crypto');
const {serializeSpaceState} = require('./space-actions-v2');
const {
  PILOT_RELEASE_SCHEMA,
  isContentReleaseValidForRuntime,
} = require('./content-release-runtime');

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
  const generatedAt = config.now().toISOString();
  const cardSource = await config.store.getCardSource(input.track, {
    allowDevelopmentDefault: config.runtimeMode === 'development',
  });

  if (
    !isContentReleaseValidForRuntime(
      cardSource,
      config.runtimeMode,
      generatedAt,
    )
  ) {
    throw contentReleaseUnavailableError(
      'A matching published content release is required.',
    );
  }

  const [membership, learning, space] = await Promise.all([
    config.store.getMembership(input.phoneNumber, generatedAt, {
      accountKey: input.accountKey,
      sessionAuthority: input.sessionAuthority,
    }),
    config.store.getLearningState(
      input.phoneNumber,
      input.dayKey,
      input.track,
      {
        accountKey: input.accountKey,
        sessionAuthority: input.sessionAuthority,
      },
    ),
    config.store.getSpaceState(input.phoneNumber, input.dayKey, {
      accountKey: input.accountKey,
      acknowledgedAt: generatedAt,
      sessionAuthority: input.sessionAuthority,
    }),
  ]);
  // Progress owns the account-wide accepted-event sequence. Read it after the
  // requested-track Learning projection so a concurrently committed event can
  // only make Progress newer, never causally older than Learning.
  const progress = await config.store.getDailyProgress(
    input.phoneNumber,
    input.dayKey,
    {
      accountKey: input.accountKey,
      sessionAuthority: input.sessionAuthority,
    },
  );
  const normalizedSpace = serializeSpaceState(space, {
    accountKey: input.accountKey,
    cardIds: new Set(cardSource.card_records.map(card => card.card_id)),
    contentVersion: cardSource.content_version,
    track: input.track,
  });
  const normalizedLearning = applySpaceFavorites(
    normalizeLearningState(learning, input.dayKey, input.track),
    normalizedSpace,
  );
  const normalizedProgress = applySpaceCounts(
    normalizeDailyProgress(progress, input.dayKey),
    normalizedSpace,
  );
  const componentRevisions = normalizeComponentRevisions({
    learning,
    membership,
    normalizedLearning,
    normalizedProgress,
    progress,
    runtimeMode: config.runtimeMode,
    space,
  });

  return {
    schema_version: BOOTSTRAP_SCHEMA_VERSION,
    generated_at: generatedAt,
    day_key: input.dayKey,
    track: input.track,
    component_revisions: componentRevisions,
    content: serializeContent(cardSource),
    learning: normalizedLearning,
    membership: normalizeMembership(membership),
    progress: normalizedProgress,
    space: normalizedSpace,
  };
}

function normalizeComponentRevisions(input) {
  return readCanonicalState('component revisions', () => {
    const pilotRuntime = input.runtimeMode === 'controlled_pilot';
    const membership = requireExactObject(
      input.membership.component_revision,
      [
        'base_membership_revision',
        'beta_entitlement_revision',
        'pilot_entitlement_revision',
      ],
      'membership.component_revision',
    );
    const learning = requireExactObject(
      input.learning.component_revision,
      ['event_server_sequence', 'session_revision'],
      'learning state.component_revision',
    );
    const progress = requireExactObject(
      input.progress.component_revision,
      ['check_in_revision', 'learning_server_sequence'],
      'daily progress.component_revision',
    );
    const spaceRevision = requireNonNegativeSafeInteger(
      input.space.revision,
      'space state.revision',
    );
    const eventServerSequence = requireNonNegativeSafeInteger(
      learning.event_server_sequence,
      'learning state.component_revision.event_server_sequence',
    );
    const maximumSerializedSequence = input.normalizedLearning.card_states
      .reduce(
        (maximum, state) =>
          Math.max(maximum, state.server_sequence ?? 0),
        0,
      );

    if (eventServerSequence !== maximumSerializedSequence) {
      throw new Error(
        'learning state component revision does not match its projection.',
      );
    }

    const checkInRevision = requireNonNegativeSafeInteger(
      progress.check_in_revision,
      'daily progress.component_revision.check_in_revision',
    );
    if (checkInRevision !== 0 && checkInRevision !== 1) {
      throw new Error('daily progress check-in revision is invalid.');
    }
    const learningServerSequence = requireNonNegativeSafeInteger(
      progress.learning_server_sequence,
      'daily progress.component_revision.learning_server_sequence',
    );

    const learningAuthority = input.normalizedProgress.learning_authority;
    if (
      (learningAuthority === 'account_events_v2' &&
        learningServerSequence === 0) ||
      (learningAuthority !== 'account_events_v2' &&
        learningServerSequence !== 0) ||
      (learningAuthority === 'empty' &&
        input.normalizedProgress.pending_review_count !== 0)
    ) {
      throw new Error(
        'daily progress learning authority is inconsistent.',
      );
    }

    if (learningServerSequence < eventServerSequence) {
      throw new Error(
        'daily progress component revision is older than Learning.',
      );
    }

    return {
      schema_version: 'bootstrap-component-revisions.v1',
      membership: {
        base_membership_revision: requireNonNegativeSafeInteger(
          membership.base_membership_revision,
          'membership.component_revision.base_membership_revision',
        ),
        beta_entitlement_revision: requireNonNegativeSafeInteger(
          membership.beta_entitlement_revision,
          'membership.component_revision.beta_entitlement_revision',
        ),
        ...(pilotRuntime
          ? {
              pilot_entitlement_revision: requireNonNegativeSafeInteger(
                membership.pilot_entitlement_revision,
                'membership.component_revision.pilot_entitlement_revision',
              ),
            }
          : {}),
      },
      learning: {
        event_server_sequence: eventServerSequence,
        session_revision: requireNonNegativeSafeInteger(
          learning.session_revision,
          'learning state.component_revision.session_revision',
        ),
        space_revision: spaceRevision,
      },
      progress: {
        learning_server_sequence: learningServerSequence,
        check_in_revision: checkInRevision,
        space_revision: spaceRevision,
      },
      space: {
        state_revision: spaceRevision,
      },
    };
  });
}

function serializeContent(cardSource) {
  const release = cardSource.release;

  if (release?.schema_version === PILOT_RELEASE_SCHEMA) {
    return {
      card_count: cardSource.card_records.length,
      release_id: release.release_id,
      release_class: 'controlled_pilot',
      pilot_id: release.pilot_id,
      minimum_client_versions: release.minimum_client_versions,
      expires_at: release.expires_at,
      gate_eligible: false,
      source: {
        id: cardSource.source.id,
        label: cardSource.source.label,
      },
      version: cardSource.content_version,
    };
  }

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
      learning_authority: requireEnum(
        progress.learning_authority,
        ['account_events_v2', 'legacy_account_baseline', 'empty'],
        'daily progress.learning_authority',
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
      // Legacy snapshots are a day-scoped migration baseline, not accepted
      // learning-events.v2 history. Make that authority explicit on the wire
      // so strict clients never have to infer a missing sequence.
      server_sequence: 0,
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
    const stage = requireEnum(
      membership.stage,
      ['trial_available', 'trial', 'free', 'premium'],
      'membership.stage',
    );
    const trialStartedAt = optionalIsoTimestamp(
      membership.trial_started_at,
      'membership.trial_started_at',
    );
    const trialExpiresAt = optionalIsoTimestamp(
      membership.trial_expires_at,
      'membership.trial_expires_at',
    );
    const trialRemainingSeconds = requireNonNegativeInteger(
      membership.trial_remaining_seconds,
      'membership.trial_remaining_seconds',
    );

    if (
      trialStartedAtEntryCount !== null &&
      (!Number.isInteger(trialStartedAtEntryCount) ||
        trialStartedAtEntryCount <= 0)
    ) {
      throw new Error('membership trial start count is invalid.');
    }
    if (
      (trialStartedAt === null) !== (trialExpiresAt === null) ||
      (stage === 'trial' &&
        (trialStartedAt === null ||
          trialExpiresAt === null ||
          Date.parse(trialExpiresAt) - Date.parse(trialStartedAt) !==
            120 * 60 * 60 * 1000 ||
          trialRemainingSeconds <= 0 ||
          trialRemainingSeconds > 432000)) ||
      (stage !== 'trial' && trialRemainingSeconds !== 0)
    ) {
      throw new Error('membership trial clock is invalid.');
    }

    return {
      acknowledged_at: optionalIsoTimestamp(
        membership.acknowledged_at,
        'membership.acknowledged_at',
      ),
      stage,
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
      trial_expires_at: trialExpiresAt,
      trial_remaining_seconds: trialRemainingSeconds,
      trial_started_at: trialStartedAt,
      trial_started_at_entry_count: trialStartedAtEntryCount,
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
  if (schemaVersion === PILOT_RELEASE_SCHEMA) {
    return normalizePilotContentRelease(release, contentVersion, expectedTrack);
  }
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

function normalizePilotContentRelease(release, contentVersion, expectedTrack) {
  const track = requireCardSourceTrack(
    release.track,
    'card source.release.track',
  );
  const declaredContentVersion = requireCardSourceString(
    release.content_version,
    'card source.release.content_version',
  );
  const releaseId = requireContentReleaseId(
    release.release_id,
    'card source.release.release_id',
  );
  const pilotId = requireContentReleaseId(
    release.pilot_id,
    'card source.release.pilot_id',
  );
  const profileId = requireContentReleaseId(
    release.profile_id,
    'card source.release.profile_id',
  );
  const activatedAt = requireCardSourceString(
    release.activated_at,
    'card source.release.activated_at',
  );
  const expiresAt = requireCardSourceString(
    release.expires_at,
    'card source.release.expires_at',
  );
  const minimumClientVersions = requireCardSourceObject(
    release.minimum_client_versions,
    'card source.release.minimum_client_versions',
  );
  const normalizedMinimumClients = Object.fromEntries(
    ['android', 'ios'].map(platform => {
      const version = requireCardSourceString(
        minimumClientVersions[platform],
        `card source.release.minimum_client_versions.${platform}`,
      );
      if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
        throw cardSourceError(
          `card source.release.minimum_client_versions.${platform} must use semantic version form.`,
        );
      }
      return [platform, version];
    }),
  );
  if (
    track !== expectedTrack ||
    track !== 'cet4' ||
    declaredContentVersion !== contentVersion ||
    release.runtime_mode !== 'controlled_pilot' ||
    release.release_class !== 'controlled_pilot' ||
    release.card_count !== 120 ||
    release.free_card_count !== 60 ||
    release.gate_eligible !== false ||
    !isCanonicalIsoTimestamp(activatedAt) ||
    !isCanonicalIsoTimestamp(expiresAt) ||
    activatedAt >= expiresAt
  ) {
    throw cardSourceError('card source pilot release is invalid.');
  }
  return {
    schema_version: PILOT_RELEASE_SCHEMA,
    release_id: releaseId,
    profile_id: profileId,
    pilot_id: pilotId,
    release_class: 'controlled_pilot',
    runtime_mode: 'controlled_pilot',
    track: 'cet4',
    content_version: declaredContentVersion,
    card_count: 120,
    free_card_count: 60,
    activated_at: activatedAt,
    expires_at: expiresAt,
    minimum_client_versions: normalizedMinimumClients,
    gate_eligible: false,
  };
}

function isCanonicalIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
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
  if (
    !['development', 'production', 'controlled_pilot'].includes(
      config.runtimeMode,
    )
  ) {
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

function requireExactObject(value, expectedKeys, fieldName) {
  const object = requireObject(value, fieldName);
  const actual = Object.keys(object).sort();
  const expected = [...expectedKeys].sort();

  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${fieldName} has unexpected fields.`);
  }

  return object;
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
