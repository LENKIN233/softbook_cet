const crypto = require('node:crypto');
const {createAuthV2Service} = require('./auth-v2');
const {
  createCloudBaseAuthStateStore,
  createMemoryAuthStateStore,
} = require('./auth-v2-store');
const {
  contentReleaseUnavailableError,
  createBootstrapV2Service,
  createContentVersion,
  normalizeContentRelease,
} = require('./bootstrap-v2');
const {createLearningEventsV2Service} = require('./learning-events-v2');
const {
  createAccountDailyProgressId,
  createAccountDailyProgressKey,
  createAccountLearningStateId,
  createAccountLearningStateKey,
  createCloudBaseLearningEventsCommitter,
  createLearningEventSequenceId,
  createLearningMigrationRevisionId,
  createMemoryLearningEventsCommitter,
  createSerializedTransactionRunner,
} = require('./learning-events-v2-store');

const DEFAULT_SMS_CODE = '2468';
const DEFAULT_TRIAL_DURATION_DAYS = 5;
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const LEGACY_SPACE_QUERY_PAGE_SIZE = 100;
const LEGACY_SPACE_QUERY_MAX_DOCUMENTS = 5000;
const CLOUDBASE_COLLECTIONS = {
  accountDeletions: 'softbook_account_deletions',
  authChallenges: 'softbook_auth_challenges',
  authRateLimits: 'softbook_auth_rate_limits',
  authSessions: 'softbook_auth_sessions',
  cardSourceVersions: 'softbook_card_source_versions',
  cardSources: 'softbook_card_sources',
  dailyProgress: 'softbook_daily_progress',
  learningEventCursors: 'softbook_learning_event_cursors',
  learningEvents: 'softbook_learning_events',
  learningEventSequences: 'softbook_learning_event_sequences',
  learningMigrationRevisions: 'softbook_learning_migration_revisions',
  learningStates: 'softbook_learning_states',
  memberships: 'softbook_memberships',
  spaceStates: 'softbook_space_states',
};
const DEFAULT_CARD_SOURCE = {
  id: 'cloudbase-dev-card-source',
  label: 'CloudBase 开发卡源',
};

let defaultApi;

async function main(event, context) {
  return getDefaultApi().handleCloudBaseEvent(event, context);
}

function getDefaultApi() {
  if (!defaultApi) {
    defaultApi = createSoftbookApi();
  }

  return defaultApi;
}

function createSoftbookApi(options = {}) {
  const runtimeMode =
    options.runtimeMode ?? process.env.SOFTBOOK_RUNTIME_MODE ?? 'development';
  const store = options.store ?? createDefaultStore();
  const tokenSecret =
    options.tokenSecret ??
    process.env.SOFTBOOK_AUTH_TOKEN_SECRET ??
    'softbook-cloudbase-dev-secret';
  const config = {
    allowLegacyV1:
      runtimeMode === 'production' ? false : options.allowLegacyV1 ?? true,
    apiKey: options.apiKey ?? process.env.SOFTBOOK_API_KEY,
    now: options.now ?? (() => new Date()),
    runtimeMode,
    smsCode:
      options.smsCode ?? process.env.SOFTBOOK_SMS_DEV_CODE ?? DEFAULT_SMS_CODE,
    store,
    tokenSecret,
    tokenTtlSeconds: resolveTokenTtlSeconds(options.tokenTtlSeconds),
  };
  config.authV2 = createAuthV2Service({
    accessTokenTtlSeconds: options.authV2AccessTokenTtlSeconds,
    challengeTtlSeconds: options.authV2ChallengeTtlSeconds,
    codeGenerator: options.authV2CodeGenerator,
    developmentSmsCode: config.smsCode,
    ipRequestLimit: options.authV2IpRequestLimit,
    indexSecret:
      options.authV2IndexSecret ?? process.env.SOFTBOOK_AUTH_INDEX_SECRET,
    now: config.now,
    phoneRequestLimit: options.authV2PhoneRequestLimit,
    randomBytes: options.authV2RandomBytes,
    rateLimitWindowSeconds: options.authV2RateLimitWindowSeconds,
    refreshTokenTtlSeconds: options.authV2RefreshTokenTtlSeconds,
    requireClientIp: options.authV2RequireClientIp,
    runtimeMode,
    smsProvider: options.smsProvider,
    store,
    tokenSecret,
    verifyAttemptLimit: options.authV2VerifyAttemptLimit,
  });
  config.bootstrapV2 = createBootstrapV2Service({
    now: config.now,
    runtimeMode,
    store,
  });
  config.learningEventsV2 = createLearningEventsV2Service({
    batchLimit:
      options.learningEventsBatchLimit ??
      optionalPositiveIntegerEnv('SOFTBOOK_LEARNING_EVENTS_BATCH_LIMIT'),
    futureSkewSeconds:
      options.learningEventsFutureSkewSeconds ??
      optionalPositiveIntegerEnv(
        'SOFTBOOK_LEARNING_EVENTS_FUTURE_SKEW_SECONDS',
      ),
    now: config.now,
    retentionDays:
      options.learningEventsRetentionDays ??
      optionalPositiveIntegerEnv('SOFTBOOK_LEARNING_EVENTS_RETENTION_DAYS'),
    runtimeMode,
    store,
  });

  return {
    handleCloudBaseEvent: async event => {
      const request = parseCloudBaseEvent(event);
      const response = await handleHttpRequest(config, request);
      return toCloudBaseResponse(response);
    },
    handleHttpRequest: request => handleHttpRequest(config, request),
  };
}

function resolveTokenTtlSeconds(overrideValue) {
  if (overrideValue !== undefined) {
    return overrideValue;
  }

  const envValue = Number(process.env.SOFTBOOK_AUTH_TOKEN_TTL_SECONDS);

  if (Number.isInteger(envValue) && envValue > 0) {
    return envValue;
  }

  return DEFAULT_TOKEN_TTL_SECONDS;
}

function optionalPositiveIntegerEnv(name) {
  if (process.env[name] === undefined) {
    return undefined;
  }

  return Number(process.env[name]);
}

async function handleHttpRequest(config, request) {
  const method = request.method.toUpperCase();
  const path = normalizeApiPath(request.path);

  if (method === 'OPTIONS') {
    return jsonResponse(204, null);
  }

  if (!path.startsWith('/v1/') && !path.startsWith('/v2/')) {
    return jsonResponse(404, {
      error: {
        code: 'not_found',
        message: 'Unsupported Softbook API path.',
      },
    });
  }

  if (!isApiKeyAllowed(config, request.headers)) {
    return jsonResponse(401, {
      error: {
        code: 'invalid_api_key',
        message: 'Invalid Softbook API key.',
      },
    });
  }

  try {
    if (path.startsWith('/v1/') && !config.allowLegacyV1) {
      return jsonResponse(410, {
        error: {
          code: 'legacy_api_disabled',
          message: 'Legacy v1 API is disabled in this runtime.',
        },
      });
    }

    if (method === 'POST' && path === '/v2/auth/request-code') {
      return jsonResponse(200, {
        data: await config.authV2.requestCode(request),
      });
    }

    if (method === 'POST' && path === '/v2/auth/verify-code') {
      return jsonResponse(200, {
        data: await config.authV2.verifyCode(request),
      });
    }

    if (method === 'POST' && path === '/v2/auth/refresh') {
      return jsonResponse(200, {
        data: await config.authV2.refresh(request),
      });
    }

    if (method === 'POST' && path === '/v2/auth/logout') {
      await config.authV2.logout(request);
      return jsonResponse(204, null);
    }

    if (method === 'POST' && path === '/v2/account/deletion') {
      return jsonResponse(202, {
        data: await config.authV2.requestAccountDeletion(request),
      });
    }

    if (method === 'POST' && path === '/v2/learning/events') {
      const session = await config.authV2.requireActiveSession(request);

      return jsonResponse(200, {
        data: await config.learningEventsV2.submit({request, session}),
      });
    }

    if (method === 'GET' && path === '/v2/bootstrap') {
      const session = await config.authV2.requireActiveSession(request);
      assertBootstrapIdentityComesFromSession(request);
      const track = requireTrack(request.query.track);
      const dayKey = requireDayKey(request.query.day_key);

      return jsonResponse(200, {
        data: await config.bootstrapV2.read({
          accountKey: session.accountKey,
          dayKey,
          phoneNumber: session.phoneNumber,
          track,
        }),
      });
    }

    if (path.startsWith('/v2/')) {
      return jsonResponse(404, {
        error: {
          code: 'not_found',
          message: 'Unsupported Softbook API route.',
        },
      });
    }

    if (method === 'POST' && path === '/v1/auth/request-code') {
      return handleRequestCode(request);
    }

    if (method === 'POST' && path === '/v1/auth/verify-code') {
      return handleVerifyCode(config, request);
    }

    const session = await requireCompatibleV1Session(config, request);

    if (method === 'GET' && path === '/v1/learning/card-source') {
      return await handleLearningCardSource(config, request);
    }

    if (method === 'GET' && path === '/v1/membership/entitlement') {
      return jsonResponse(200, {
        data: {
          entitlement: serializeMembershipEntitlement(
            await config.store.getMembership(session.phoneNumber),
          ),
        },
      });
    }

    if (method === 'POST' && path === '/v1/membership/start-trial') {
      assertBodyPhoneMatchesSession(request.body, session);
      return jsonResponse(200, {
        data: {
          entitlement: serializeMembershipEntitlement(
            await config.store.startTrial(
              session.phoneNumber,
              config.now().toISOString(),
            ),
          ),
        },
      });
    }

    if (method === 'POST' && path === '/v1/membership/purchase') {
      assertBodyPhoneMatchesSession(request.body, session);
      return jsonResponse(200, {
        data: {
          entitlement: serializeMembershipEntitlement(
            await config.store.purchase(
              session.phoneNumber,
              config.now().toISOString(),
            ),
          ),
        },
      });
    }

    if (method === 'POST' && path === '/v1/membership/dismiss-recovery') {
      assertBodyPhoneMatchesSession(request.body, session);
      return jsonResponse(200, {
        data: {
          entitlement: serializeMembershipEntitlement(
            await config.store.dismissRecovery(
              session.phoneNumber,
              config.now().toISOString(),
            ),
          ),
        },
      });
    }

    if (method === 'POST' && path === '/v1/progress/daily-sync') {
      assertBodyPhoneMatchesSession(request.body, session);
      const snapshot = parseDailyProgressSnapshot(request.body);
      const acknowledgedAt = config.now().toISOString();
      await config.store.saveDailyProgress(
        session.phoneNumber,
        snapshot,
        acknowledgedAt,
        {accountKey: session.accountKey},
      );
      return acknowledgedResponse(acknowledgedAt);
    }

    if (method === 'POST' && path === '/v1/learning/state-sync') {
      assertBodyPhoneMatchesSession(request.body, session);
      const snapshot = parseLearningStateSnapshot(request.body);
      const acknowledgedAt = config.now().toISOString();
      await config.store.saveLearningState(
        session.phoneNumber,
        snapshot,
        acknowledgedAt,
        {accountKey: session.accountKey},
      );
      return acknowledgedResponse(acknowledgedAt);
    }

    if (method === 'GET' && path === '/v1/space/state-sync') {
      const dayKey = requireDayKey(request.query.day_key);
      const canonicalState = await config.store.getSpaceState(
        session.phoneNumber,
        dayKey,
      );

      return spaceStateResponse(canonicalState);
    }

    if (method === 'POST' && path === '/v1/space/state-sync') {
      assertBodyPhoneMatchesSession(request.body, session);
      const snapshot = parseSpaceStateSnapshot(request.body);
      const acknowledgedAt = config.now().toISOString();
      const canonicalState = await config.store.saveSpaceState(
        session.phoneNumber,
        snapshot,
        acknowledgedAt,
      );
      return spaceStateResponse(canonicalState, acknowledgedAt);
    }

    return jsonResponse(404, {
      error: {
        code: 'not_found',
        message: 'Unsupported Softbook API route.',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function handleRequestCode(request) {
  const body = requireObjectBody(request.body);
  const phoneNumber = requirePhoneNumber(body.phone_number);

  return jsonResponse(200, {
    data: {
      delivery: 'dev_fixed_code',
      phone_number: phoneNumber,
    },
  });
}

function handleVerifyCode(config, request) {
  const body = requireObjectBody(request.body);
  const phoneNumber = requirePhoneNumber(body.phone_number);
  const smsCode = requireNonEmptyString(body.sms_code, 'sms_code');

  if (smsCode !== config.smsCode) {
    throw httpError(401, 'invalid_sms_code', 'Invalid SMS code.');
  }

  const authToken = createAuthToken(config, phoneNumber);

  return jsonResponse(200, {
    data: {
      auth_token: authToken,
      phone_number: phoneNumber,
    },
  });
}

async function handleLearningCardSource(config, request) {
  const track = request.query.track ?? 'cet4';

  if (track !== 'cet4' && track !== 'cet6') {
    throw httpError(400, 'invalid_track', 'track must be cet4 or cet6.');
  }

  const cardSource = await config.store.getCardSource(track);

  return jsonResponse(200, {
    data: serializeCardSourceResponse(cardSource, track),
  });
}

function parseDailyProgressSnapshot(body) {
  const payload = requireObjectBody(body);

  return {
    checked_in_today: requireBoolean(
      payload.checked_in_today,
      'checked_in_today',
    ),
    day_key: requireDayKey(payload.day_key),
    favorite_count: requireNonNegativeInteger(
      payload.favorite_count,
      'favorite_count',
    ),
    learning_completed_count: requireNonNegativeInteger(
      payload.learning_completed_count,
      'learning_completed_count',
    ),
    pending_review_count: requireNonNegativeInteger(
      payload.pending_review_count,
      'pending_review_count',
    ),
    review_completed_count: requireNonNegativeInteger(
      payload.review_completed_count,
      'review_completed_count',
    ),
    sleeping_count: requireNonNegativeInteger(
      payload.sleeping_count,
      'sleeping_count',
    ),
    total_completed_count: requireNonNegativeInteger(
      payload.total_completed_count,
      'total_completed_count',
    ),
  };
}

function parseLearningStateSnapshot(body) {
  const payload = requireObjectBody(body);
  const events = requireArray(payload.events, 'events').map((event, index) => {
    const eventObject = requireObject(event, `events[${index}]`);

    return {
      card_id: requireNonEmptyString(
        eventObject.card_id,
        `events[${index}].card_id`,
      ),
      completed_at: requireIsoTimestamp(
        eventObject.completed_at,
        `events[${index}].completed_at`,
      ),
      interaction_id: requireInteractionId(
        eventObject.interaction_id,
        `events[${index}].interaction_id`,
      ),
      is_favorited: requireBoolean(
        eventObject.is_favorited,
        `events[${index}].is_favorited`,
      ),
      outcome: requireLearningOutcome(
        eventObject.outcome,
        `events[${index}].outcome`,
      ),
      phase: requireEnum(
        eventObject.phase,
        ['learning', 'review'],
        `events[${index}].phase`,
      ),
      used_hint: requireBoolean(
        eventObject.used_hint,
        `events[${index}].used_hint`,
      ),
      used_peek: requireBoolean(
        eventObject.used_peek,
        `events[${index}].used_peek`,
      ),
    };
  });

  return {
    day_key: requireDayKey(payload.day_key),
    events,
    source_id: requireNonEmptyString(payload.source_id, 'source_id'),
    source_label: requireNonEmptyString(payload.source_label, 'source_label'),
    track: requireEnum(payload.track, ['cet4', 'cet6'], 'track'),
  };
}

function parseSpaceStateSnapshot(body) {
  const payload = requireObjectBody(body);
  const states = requireArray(payload.states, 'states').map((state, index) => {
    const stateObject = requireObject(state, `states[${index}]`);

    return {
      card_id: requireNonEmptyString(
        stateObject.card_id,
        `states[${index}].card_id`,
      ),
      is_favorited: requireBoolean(
        stateObject.is_favorited,
        `states[${index}].is_favorited`,
      ),
      is_sleeping: requireBoolean(
        stateObject.is_sleeping,
        `states[${index}].is_sleeping`,
      ),
      last_modified_at: requireIsoTimestamp(
        stateObject.last_modified_at,
        `states[${index}].last_modified_at`,
      ),
    };
  });

  return {
    day_key: requireDayKey(payload.day_key),
    states,
  };
}

function acknowledgedResponse(acknowledgedAt) {
  return jsonResponse(200, {
    data: {
      acknowledged_at: acknowledgedAt,
      mode: 'remote',
    },
  });
}

function spaceStateResponse(snapshot, acknowledgedAt) {
  return jsonResponse(200, {
    data: {
      ...(acknowledgedAt
        ? {acknowledged_at: acknowledgedAt, mode: 'remote'}
        : {}),
      space_state: {
        day_key: snapshot.day_key,
        states: Object.values(snapshot.states_by_card_id).sort((left, right) =>
          left.card_id.localeCompare(right.card_id),
        ),
      },
    },
  });
}

function assertBootstrapIdentityComesFromSession(request) {
  if (request.query.phone_number !== undefined || request.body !== undefined) {
    throw httpError(
      400,
      'bootstrap_identity_input_forbidden',
      'Bootstrap account identity comes from the active session.',
    );
  }
}

function createDefaultStore() {
  const storeMode = process.env.SOFTBOOK_STORE_MODE ?? 'memory';

  if (storeMode === 'memory') {
    return createMemoryStore();
  }

  if (storeMode === 'cloudbase') {
    return createCloudBaseStore();
  }

  throw new Error(`Unsupported SOFTBOOK_STORE_MODE: ${storeMode}`);
}

function createMemoryStore() {
  const authStateStore = createMemoryAuthStateStore();
  const cardSources = new Map();
  const cardSourceVersions = new Map();
  const memberships = new Map();
  const dailyProgress = new Map();
  const learningEventCursors = new Map();
  const learningEvents = new Map();
  const learningEventSequences = new Map();
  const learningMigrationRevisions = new Map();
  const learningStates = new Map();
  const spaceStates = new Map();
  const runLearningTransaction = createSerializedTransactionRunner();
  const commitLearningEvents = createMemoryLearningEventsCommitter({
    createDefaultCardSource,
    normalizeCardSource,
    state: {
      cardSources,
      cardSourceVersions,
      dailyProgress,
      learningEventCursors,
      learningEvents,
      learningEventSequences,
      learningMigrationRevisions,
      learningStates,
    },
    runTransaction: runLearningTransaction,
  });

  return {
    ...authStateStore,
    getCardSource: (track, options = {}) => {
      if (!cardSources.has(track)) {
        if (options.allowDevelopmentDefault === false) {
          throw contentReleaseUnavailableError(
            `No published content source exists for ${track}.`,
          );
        }

        cardSources.set(track, createDefaultCardSource(track));
      }

      return cloneCardSource(cardSources.get(track));
    },
    getDailyProgress: (phoneNumber, dayKey, options = {}) => {
      const accountProgress = options.accountKey
        ? dailyProgress.get(
            createAccountDailyProgressKey(options.accountKey, dayKey),
          )
        : null;
      assertLearningProjectionMetadata(
        accountProgress,
        options.accountKey,
        'daily progress',
      );
      const progress = cloneJson(
        accountProgress ??
          dailyProgress.get(`${phoneNumber}:${dayKey}`) ??
          createEmptyDailyProgress(dayKey),
      );
      const sequence = options.accountKey
        ? learningEventSequences.get(
            createLearningEventSequenceId(options.accountKey),
          )
        : null;

      if (!sequence) {
        assertNoOrphanedLearningProjection(accountProgress, options.accountKey);
      }

      applyLearningSequencePendingReview(
        progress,
        sequence,
        options.accountKey,
      );

      return progress;
    },
    getLearningState: (phoneNumber, dayKey, track, options = {}) => {
      const accountState = options.accountKey
        ? learningStates.get(
            createAccountLearningStateKey(options.accountKey, track),
          )
        : null;
      const state = cloneJson(
        accountState ??
          learningStates.get(`${phoneNumber}:${dayKey}:${track}`) ??
          createEmptyLearningState(dayKey, track),
      );
      assertLearningProjectionMetadata(
        accountState,
        options.accountKey,
        'learning state',
      );

      const sequence = options.accountKey
        ? learningEventSequences.get(
            createLearningEventSequenceId(options.accountKey),
          )
        : null;

      if (!sequence) {
        assertNoOrphanedLearningProjection(
          accountState,
          options.accountKey,
          'learning state',
        );
      } else {
        assertLearningProjectionSequence(
          accountState,
          sequence,
          options.accountKey,
          track,
        );
      }

      return {...state, day_key: dayKey, track};
    },
    getMembership: phoneNumber => {
      const document = memberships.get(phoneNumber);

      return {
        acknowledged_at: document?.updated_at ?? null,
        ...cloneMembership(document?.entitlement ?? createInitialMembership()),
      };
    },
    startTrial: (phoneNumber, acknowledgedAt) => {
      const current = cloneMembership(
        memberships.get(phoneNumber)?.entitlement ?? createInitialMembership(),
      );

      if (current.stage === 'trial_available') {
        current.counted_entry_count += 1;
        current.last_experience_ended_by = null;
        current.recovery_prompt_visible = false;
        current.stage = 'trial';
        current.trial_started_at_entry_count = current.counted_entry_count;
      }

      memberships.set(phoneNumber, {
        entitlement: current,
        updated_at: acknowledgedAt,
      });
      return current;
    },
    purchase: (phoneNumber, acknowledgedAt) => {
      const current = cloneMembership(
        memberships.get(phoneNumber)?.entitlement ?? createInitialMembership(),
      );
      current.last_experience_ended_by = null;
      current.recovery_prompt_visible = false;
      current.stage = 'premium';
      memberships.set(phoneNumber, {
        entitlement: current,
        updated_at: acknowledgedAt,
      });
      return current;
    },
    dismissRecovery: (phoneNumber, acknowledgedAt) => {
      const current = cloneMembership(
        memberships.get(phoneNumber)?.entitlement ?? createInitialMembership(),
      );
      current.recovery_prompt_visible = false;
      memberships.set(phoneNumber, {
        entitlement: current,
        updated_at: acknowledgedAt,
      });
      return current;
    },
    saveDailyProgress: (phoneNumber, snapshot, acknowledgedAt, options = {}) =>
      runLearningTransaction(async () => {
        assertLearningWriteAccountKey(options.accountKey);
        const sequence = learningEventSequences.get(
          createLearningEventSequenceId(options.accountKey),
        );

        if (sequence) {
          const accountProgressKey = createAccountDailyProgressKey(
            options.accountKey,
            snapshot.day_key,
          );
          const accountProgress = dailyProgress.get(accountProgressKey);
          const legacyProgress = accountProgress
            ? null
            : dailyProgress.get(`${phoneNumber}:${snapshot.day_key}`);
          dailyProgress.set(
            accountProgressKey,
            mergeLegacyDailyProgressAfterV2({
              accountKey: options.accountKey,
              accountProgress,
              acknowledgedAt,
              legacyProgress,
              sequence,
              snapshot,
            }),
          );
          return;
        }

        assertNoOrphanedLearningProjection(
          dailyProgress.get(
            createAccountDailyProgressKey(options.accountKey, snapshot.day_key),
          ),
          options.accountKey,
        );
        dailyProgress.set(`${phoneNumber}:${snapshot.day_key}`, {
          acknowledged_at: acknowledgedAt,
          ...snapshot,
        });
      }),
    saveLearningState: (phoneNumber, snapshot, acknowledgedAt, options = {}) =>
      runLearningTransaction(async () => {
        assertLegacyLearningWriteAllowed(
          learningEventSequences.get(
            createLearningEventSequenceId(options.accountKey),
          ),
          options.accountKey,
        );
        const revisionId = createLearningMigrationRevisionId(
          options.accountKey,
        );
        const nextRevision = nextLearningMigrationRevision(
          learningMigrationRevisions.get(revisionId) ?? null,
          options.accountKey,
          acknowledgedAt,
        );
        const key = `${phoneNumber}:${snapshot.day_key}:${snapshot.track}`;
        const existing = learningStates.get(key) ?? {
          events_by_card_id: {},
        };

        snapshot.events.forEach((event, index) => {
          existing.events_by_card_id[event.card_id] = {
            ...event,
            server_sequence: index,
          };
        });

        learningStates.set(key, {
          ...existing,
          acknowledged_at: acknowledgedAt,
          day_key: snapshot.day_key,
          source_id: snapshot.source_id,
          source_label: snapshot.source_label,
          track: snapshot.track,
        });
        learningMigrationRevisions.set(revisionId, nextRevision);
      }),
    commitLearningEvents,
    getSpaceState: (phoneNumber, dayKey) => {
      const existing = cloneSpaceState(
        spaceStates.get(phoneNumber) ?? createEmptySpaceState(dayKey),
      );
      return {...existing, day_key: dayKey};
    },
    saveSpaceState: (phoneNumber, snapshot, acknowledgedAt) => {
      const existing = cloneSpaceState(
        spaceStates.get(phoneNumber) ?? createEmptySpaceState(snapshot.day_key),
      );

      snapshot.states.forEach(state => {
        const current = existing.states_by_card_id[state.card_id];

        if (shouldReplaceSpaceState(current, state)) {
          existing.states_by_card_id[state.card_id] = {...state};
        }
      });

      const canonicalState = {
        ...existing,
        acknowledged_at: acknowledgedAt,
        day_key: snapshot.day_key,
      };
      spaceStates.set(phoneNumber, canonicalState);
      return cloneSpaceState(canonicalState);
    },
    snapshot: () => ({
      ...authStateStore.snapshotAuth(),
      cardSourceVersions,
      cardSources,
      dailyProgress,
      learningEventCursors,
      learningEvents,
      learningEventSequences,
      learningMigrationRevisions,
      learningStates,
      memberships,
      spaceStates,
    }),
  };
}

function createCloudBaseStore(options = {}) {
  const db = options.db ?? createCloudBaseDatabase();
  const authStateStore = createCloudBaseAuthStateStore(
    db,
    CLOUDBASE_COLLECTIONS,
  );
  const cardSources = db.collection(CLOUDBASE_COLLECTIONS.cardSources);
  const memberships = db.collection(CLOUDBASE_COLLECTIONS.memberships);
  const dailyProgress = db.collection(CLOUDBASE_COLLECTIONS.dailyProgress);
  const learningEventSequences = db.collection(
    CLOUDBASE_COLLECTIONS.learningEventSequences,
  );
  const learningStates = db.collection(CLOUDBASE_COLLECTIONS.learningStates);
  const spaceStates = db.collection(CLOUDBASE_COLLECTIONS.spaceStates);
  const commitLearningEvents = createCloudBaseLearningEventsCommitter({
    collections: CLOUDBASE_COLLECTIONS,
    createDefaultCardSource,
    db,
    normalizeCardSource,
  });

  return {
    ...authStateStore,
    getCardSource: async (track, options = {}) => {
      const existing = await getCloudBaseDocument(cardSources, track);

      if (existing) {
        return normalizeCardSource(existing, track);
      }

      if (options.allowDevelopmentDefault === false) {
        throw contentReleaseUnavailableError(
          `No published content source exists for ${track}.`,
        );
      }

      const defaultCardSource = createDefaultCardSource(track);
      await setCloudBaseDocument(cardSources, track, {
        ...defaultCardSource,
        updated_at: new Date().toISOString(),
      });

      return defaultCardSource;
    },
    getDailyProgress: async (phoneNumber, dayKey, options = {}) => {
      const accountProgress = options.accountKey
        ? await getCloudBaseDocument(
            dailyProgress,
            createAccountDailyProgressId(options.accountKey, dayKey),
          )
        : null;
      assertLearningProjectionMetadata(
        accountProgress,
        options.accountKey,
        'daily progress',
      );
      const legacyProgress = accountProgress
        ? null
        : await getCloudBaseDocument(
            dailyProgress,
            createCloudBaseDocumentId(`${phoneNumber}:${dayKey}`),
          );
      const progress =
        accountProgress ?? legacyProgress ?? createEmptyDailyProgress(dayKey);
      const sequence = options.accountKey
        ? await getCloudBaseDocument(
            learningEventSequences,
            createLearningEventSequenceId(options.accountKey),
          )
        : null;

      if (!sequence) {
        assertNoOrphanedLearningProjection(accountProgress, options.accountKey);
      }

      applyLearningSequencePendingReview(
        progress,
        sequence,
        options.accountKey,
      );

      return progress;
    },
    getLearningState: async (phoneNumber, dayKey, track, options = {}) => {
      const accountState = options.accountKey
        ? await getCloudBaseDocument(
            learningStates,
            createAccountLearningStateId(options.accountKey, track),
          )
        : null;
      assertLearningProjectionMetadata(
        accountState,
        options.accountKey,
        'learning state',
      );
      const sequence = options.accountKey
        ? await getCloudBaseDocument(
            learningEventSequences,
            createLearningEventSequenceId(options.accountKey),
          )
        : null;

      if (!sequence) {
        assertNoOrphanedLearningProjection(
          accountState,
          options.accountKey,
          'learning state',
        );
      } else {
        assertLearningProjectionSequence(
          accountState,
          sequence,
          options.accountKey,
          track,
        );
      }
      const legacyState = accountState
        ? null
        : await getCloudBaseDocument(
            learningStates,
            createCloudBaseDocumentId(`${phoneNumber}:${dayKey}:${track}`),
          );
      const state =
        accountState ?? legacyState ?? createEmptyLearningState(dayKey, track);

      return {...state, day_key: dayKey, track};
    },
    getMembership: async phoneNumber => {
      const existing = await getCloudBaseDocument(memberships, phoneNumber);

      if (existing) {
        return {
          acknowledged_at: existing.updated_at ?? null,
          ...deserializeMembershipDocument(existing),
        };
      }

      return {
        acknowledged_at: null,
        ...createInitialMembership(),
      };
    },
    startTrial: async (phoneNumber, acknowledgedAt) => {
      const current = cloneMembership(
        await getCloudBaseMembership(memberships, phoneNumber),
      );

      if (current.stage === 'trial_available') {
        current.counted_entry_count += 1;
        current.last_experience_ended_by = null;
        current.recovery_prompt_visible = false;
        current.stage = 'trial';
        current.trial_started_at_entry_count = current.counted_entry_count;
      }

      await saveCloudBaseMembership(
        memberships,
        phoneNumber,
        current,
        acknowledgedAt,
      );
      return current;
    },
    purchase: async (phoneNumber, acknowledgedAt) => {
      const current = cloneMembership(
        await getCloudBaseMembership(memberships, phoneNumber),
      );
      current.last_experience_ended_by = null;
      current.recovery_prompt_visible = false;
      current.stage = 'premium';
      await saveCloudBaseMembership(
        memberships,
        phoneNumber,
        current,
        acknowledgedAt,
      );
      return current;
    },
    dismissRecovery: async (phoneNumber, acknowledgedAt) => {
      const current = cloneMembership(
        await getCloudBaseMembership(memberships, phoneNumber),
      );
      current.recovery_prompt_visible = false;
      await saveCloudBaseMembership(
        memberships,
        phoneNumber,
        current,
        acknowledgedAt,
      );
      return current;
    },
    saveDailyProgress: async (
      phoneNumber,
      snapshot,
      acknowledgedAt,
      options = {},
    ) =>
      db.runTransaction(async transaction => {
        assertLearningWriteAccountKey(options.accountKey);
        const transactionSequences = transaction.collection(
          CLOUDBASE_COLLECTIONS.learningEventSequences,
        );
        const sequence = await getCloudBaseDocument(
          transactionSequences,
          createLearningEventSequenceId(options.accountKey),
        );
        const transactionProgress = transaction.collection(
          CLOUDBASE_COLLECTIONS.dailyProgress,
        );
        const accountProgressId = createAccountDailyProgressId(
          options.accountKey,
          snapshot.day_key,
        );
        const accountProgress = await getCloudBaseDocument(
          transactionProgress,
          accountProgressId,
        );

        if (sequence) {
          const legacyProgress = accountProgress
            ? null
            : await getCloudBaseDocument(
                transactionProgress,
                createCloudBaseDocumentId(`${phoneNumber}:${snapshot.day_key}`),
              );
          await setCloudBaseDocument(
            transactionProgress,
            accountProgressId,
            mergeLegacyDailyProgressAfterV2({
              accountKey: options.accountKey,
              accountProgress,
              acknowledgedAt,
              legacyProgress,
              sequence,
              snapshot,
            }),
          );
          return;
        }

        assertNoOrphanedLearningProjection(accountProgress, options.accountKey);
        await setCloudBaseDocument(
          transactionProgress,
          createCloudBaseDocumentId(`${phoneNumber}:${snapshot.day_key}`),
          {
            acknowledged_at: acknowledgedAt,
            phone_number: phoneNumber,
            ...snapshot,
          },
        );
      }),
    saveLearningState: async (
      phoneNumber,
      snapshot,
      acknowledgedAt,
      options = {},
    ) =>
      db.runTransaction(async transaction => {
        const transactionSequences = transaction.collection(
          CLOUDBASE_COLLECTIONS.learningEventSequences,
        );
        const sequence = await getCloudBaseDocument(
          transactionSequences,
          createLearningEventSequenceId(options.accountKey),
        );
        assertLegacyLearningWriteAllowed(sequence, options.accountKey);
        const transactionMigrationRevisions = transaction.collection(
          CLOUDBASE_COLLECTIONS.learningMigrationRevisions,
        );
        const revisionId = createLearningMigrationRevisionId(
          options.accountKey,
        );
        const nextRevision = nextLearningMigrationRevision(
          await getCloudBaseDocument(transactionMigrationRevisions, revisionId),
          options.accountKey,
          acknowledgedAt,
        );
        const transactionLearningStates = transaction.collection(
          CLOUDBASE_COLLECTIONS.learningStates,
        );
        const documentId = createCloudBaseDocumentId(
          `${phoneNumber}:${snapshot.day_key}:${snapshot.track}`,
        );
        const existing = (await getCloudBaseDocument(
          transactionLearningStates,
          documentId,
        )) ?? {events_by_card_id: {}};
        const eventsByCardId = {
          ...(existing.events_by_card_id ?? {}),
        };

        snapshot.events.forEach((event, index) => {
          eventsByCardId[event.card_id] = {
            ...event,
            server_sequence: index,
          };
        });

        await setCloudBaseDocument(transactionLearningStates, documentId, {
          acknowledged_at: acknowledgedAt,
          day_key: snapshot.day_key,
          events_by_card_id: eventsByCardId,
          phone_number: phoneNumber,
          source_id: snapshot.source_id,
          source_label: snapshot.source_label,
          track: snapshot.track,
        });
        await setCloudBaseDocument(
          transactionMigrationRevisions,
          revisionId,
          nextRevision,
        );
      }),
    commitLearningEvents,
    getSpaceState: async (phoneNumber, dayKey) => {
      const documentId = createCloudBaseDocumentId(phoneNumber);
      const existing = await getCloudBaseDocument(spaceStates, documentId);

      if (existing) {
        return {...cloneSpaceState(existing), day_key: dayKey};
      }

      const legacyDocuments = await listCloudBaseDocumentsByQuery(
        spaceStates,
        {phone_number: phoneNumber},
        LEGACY_SPACE_QUERY_PAGE_SIZE,
        LEGACY_SPACE_QUERY_MAX_DOCUMENTS,
      );
      return db.runTransaction(async transaction =>
        getCloudBaseCanonicalSpaceState(
          transaction.collection(CLOUDBASE_COLLECTIONS.spaceStates),
          documentId,
          phoneNumber,
          dayKey,
          legacyDocuments,
        ),
      );
    },
    saveSpaceState: async (phoneNumber, snapshot, acknowledgedAt) => {
      const documentId = createCloudBaseDocumentId(phoneNumber);
      const canonical = await getCloudBaseDocument(spaceStates, documentId);
      const legacyDocuments = canonical
        ? []
        : await listCloudBaseDocumentsByQuery(
            spaceStates,
            {phone_number: phoneNumber},
            LEGACY_SPACE_QUERY_PAGE_SIZE,
            LEGACY_SPACE_QUERY_MAX_DOCUMENTS,
          );
      return db.runTransaction(async transaction => {
        const transactionSpaceStates = transaction.collection(
          CLOUDBASE_COLLECTIONS.spaceStates,
        );
        const existing = await getCloudBaseCanonicalSpaceState(
          transactionSpaceStates,
          documentId,
          phoneNumber,
          snapshot.day_key,
          legacyDocuments,
        );
        const statesByCardId = {
          ...(existing.states_by_card_id ?? {}),
        };

        snapshot.states.forEach(state => {
          const current = statesByCardId[state.card_id];

          if (shouldReplaceSpaceState(current, state)) {
            statesByCardId[state.card_id] = {...state};
          }
        });

        const canonicalState = {
          acknowledged_at: acknowledgedAt,
          day_key: snapshot.day_key,
          phone_number: phoneNumber,
          states_by_card_id: statesByCardId,
        };
        await setCloudBaseDocument(
          transactionSpaceStates,
          documentId,
          canonicalState,
        );
        return cloneSpaceState(canonicalState);
      });
    },
  };
}

function createEmptyDailyProgress(dayKey) {
  return {
    acknowledged_at: null,
    checked_in_today: false,
    day_key: dayKey,
    favorite_count: 0,
    learning_completed_count: 0,
    pending_review_count: 0,
    review_completed_count: 0,
    sleeping_count: 0,
    total_completed_count: 0,
  };
}

function mergeLegacyDailyProgressAfterV2({
  accountKey,
  accountProgress,
  acknowledgedAt,
  legacyProgress,
  sequence,
  snapshot,
}) {
  const progress = normalizeStoredDailyProgress(
    accountProgress ?? legacyProgress,
    snapshot.day_key,
    accountProgress ? accountKey : null,
  );
  assertLearningSequenceMetadata(sequence, accountKey);

  return {
    ...progress,
    acknowledged_at: acknowledgedAt,
    account_key: accountKey,
    checked_in_today: progress.checked_in_today || snapshot.checked_in_today,
    pending_review_count: sequence.pending_review_count,
    projection_version: 'learning-events.v2',
  };
}

function normalizeStoredDailyProgress(
  value,
  expectedDayKey,
  expectedAccountKey,
) {
  if (value === null || value === undefined) {
    return createEmptyDailyProgress(expectedDayKey);
  }

  if (
    !isObject(value) ||
    value.day_key !== expectedDayKey ||
    typeof value.checked_in_today !== 'boolean' ||
    (value.acknowledged_at !== null &&
      value.acknowledged_at !== undefined &&
      (typeof value.acknowledged_at !== 'string' ||
        !Number.isFinite(Date.parse(value.acknowledged_at)))) ||
    (expectedAccountKey !== null &&
      (value.account_key !== expectedAccountKey ||
        value.projection_version !== 'learning-events.v2'))
  ) {
    throw learningProjectionInvalidError(
      'The account daily progress projection is invalid.',
    );
  }

  for (const field of [
    'favorite_count',
    'learning_completed_count',
    'pending_review_count',
    'review_completed_count',
    'sleeping_count',
    'total_completed_count',
  ]) {
    if (!Number.isSafeInteger(value[field]) || value[field] < 0) {
      throw learningProjectionInvalidError(
        'The account daily progress projection is invalid.',
      );
    }
  }

  const derivedTotal =
    value.learning_completed_count + value.review_completed_count;

  if (
    !Number.isSafeInteger(derivedTotal) ||
    (expectedAccountKey !== null &&
      value.total_completed_count !== derivedTotal)
  ) {
    throw learningProjectionInvalidError(
      'The account daily progress projection is invalid.',
    );
  }

  return {
    acknowledged_at: value.acknowledged_at ?? null,
    checked_in_today: value.checked_in_today,
    day_key: value.day_key,
    favorite_count: value.favorite_count,
    learning_completed_count: value.learning_completed_count,
    pending_review_count: value.pending_review_count,
    review_completed_count: value.review_completed_count,
    sleeping_count: value.sleeping_count,
    total_completed_count: derivedTotal,
  };
}

function assertNoOrphanedLearningProjection(
  projection,
  expectedAccountKey,
  label = 'daily progress',
) {
  if (projection !== null && projection !== undefined) {
    assertLearningProjectionMetadata(projection, expectedAccountKey, label);
    throw learningProjectionInvalidError(
      `An account ${label} projection is missing its event sequence.`,
    );
  }
}

function assertLearningProjectionMetadata(
  projection,
  expectedAccountKey,
  label,
) {
  if (projection === null || projection === undefined) {
    return;
  }

  if (
    typeof expectedAccountKey !== 'string' ||
    projection.account_key !== expectedAccountKey ||
    projection.projection_version !== 'learning-events.v2'
  ) {
    throw httpError(
      500,
      'learning_events_projection_invalid',
      `The account ${label} projection is invalid.`,
    );
  }
}

function applyLearningSequencePendingReview(
  progress,
  sequence,
  expectedAccountKey,
) {
  if (sequence === null || sequence === undefined) {
    return;
  }

  assertLearningSequenceMetadata(sequence, expectedAccountKey);
  progress.pending_review_count = sequence.pending_review_count;
}

function assertLearningProjectionSequence(
  projection,
  sequence,
  expectedAccountKey,
  expectedTrack,
) {
  assertLearningSequenceMetadata(sequence, expectedAccountKey);

  if (projection === null || projection === undefined) {
    return;
  }

  assertLearningProjectionMetadata(
    projection,
    expectedAccountKey,
    'learning state',
  );

  if (
    projection.track !== expectedTrack ||
    projection.cursor !== null ||
    typeof projection.legacy_baseline_migrated !== 'boolean' ||
    !isObject(projection.events_by_card_id) ||
    Object.keys(projection.events_by_card_id).length === 0
  ) {
    throw learningProjectionInvalidError(
      'The account learning projection is invalid.',
    );
  }

  const acceptedSequences = new Set();
  let migratedEventCount = 0;

  for (const event of Object.values(projection.events_by_card_id)) {
    if (
      !isObject(event) ||
      !Number.isSafeInteger(event.server_sequence) ||
      event.server_sequence < 0 ||
      event.server_sequence > sequence.last_server_sequence
    ) {
      throw learningProjectionInvalidError(
        'The account learning projection sequence is invalid.',
      );
    }

    if (event.server_sequence > 0) {
      if (acceptedSequences.has(event.server_sequence)) {
        throw learningProjectionInvalidError(
          'The account learning projection sequence is duplicated.',
        );
      }
      acceptedSequences.add(event.server_sequence);
    } else {
      migratedEventCount += 1;
    }
  }

  if (
    (migratedEventCount > 0 && !projection.legacy_baseline_migrated) ||
    (acceptedSequences.size === 0 && !projection.legacy_baseline_migrated)
  ) {
    throw learningProjectionInvalidError(
      'The account learning projection has invalid migration authority.',
    );
  }
}

function assertLearningSequenceMetadata(sequence, expectedAccountKey) {
  if (
    typeof expectedAccountKey !== 'string' ||
    sequence.account_key !== expectedAccountKey ||
    !Number.isSafeInteger(sequence.last_server_sequence) ||
    sequence.last_server_sequence <= 0 ||
    !Number.isSafeInteger(sequence.pending_review_count) ||
    sequence.pending_review_count < 0
  ) {
    throw learningProjectionInvalidError(
      'The account learning-event sequence is invalid.',
    );
  }
}

function assertLegacyLearningWriteAllowed(sequence, expectedAccountKey) {
  assertLearningWriteAccountKey(expectedAccountKey);

  if (sequence !== null && sequence !== undefined) {
    assertLearningSequenceMetadata(sequence, expectedAccountKey);
    throw httpError(
      409,
      'legacy_learning_write_disabled',
      'Legacy learning snapshots are disabled after v2 event migration.',
    );
  }
}

function nextLearningMigrationRevision(
  current,
  expectedAccountKey,
  acknowledgedAt,
) {
  assertLearningWriteAccountKey(expectedAccountKey);
  let revision = 0;

  if (current !== null && current !== undefined) {
    if (
      !isObject(current) ||
      current.account_key !== expectedAccountKey ||
      !Number.isSafeInteger(current.revision) ||
      current.revision < 0 ||
      current.status !== 'open' ||
      typeof current.updated_at !== 'string' ||
      !Number.isFinite(Date.parse(current.updated_at))
    ) {
      throw learningProjectionInvalidError(
        'The legacy learning migration revision is invalid.',
      );
    }
    revision = current.revision;
  }

  if (revision === Number.MAX_SAFE_INTEGER) {
    throw learningProjectionInvalidError(
      'The legacy learning migration revision is exhausted.',
    );
  }

  return {
    account_key: expectedAccountKey,
    revision: revision + 1,
    status: 'open',
    updated_at: acknowledgedAt,
  };
}

function assertLearningWriteAccountKey(accountKey) {
  if (typeof accountKey !== 'string' || accountKey.length === 0) {
    throw httpError(
      401,
      'invalid_auth_session',
      'An account-bound session is required for learning writes.',
    );
  }
}

function learningProjectionInvalidError(message) {
  return httpError(500, 'learning_events_projection_invalid', message);
}

function createEmptyLearningState(dayKey, track) {
  return {
    acknowledged_at: null,
    cursor: null,
    day_key: dayKey,
    events_by_card_id: {},
    source_id: null,
    source_label: null,
    track,
  };
}

function createEmptySpaceState(dayKey) {
  return {
    day_key: dayKey,
    states_by_card_id: {},
  };
}

function cloneSpaceState(snapshot) {
  return {
    ...snapshot,
    states_by_card_id: Object.fromEntries(
      Object.entries(snapshot.states_by_card_id ?? {}).map(
        ([cardId, state]) => [cardId, {...state}],
      ),
    ),
  };
}

function shouldReplaceSpaceState(current, incoming) {
  if (!current) {
    return true;
  }

  const currentTimestamp = new Date(current.last_modified_at).getTime();

  return (
    Number.isNaN(currentTimestamp) ||
    new Date(incoming.last_modified_at).getTime() > currentTimestamp
  );
}

async function getCloudBaseCanonicalSpaceState(
  collection,
  documentId,
  phoneNumber,
  dayKey,
  legacyDocuments,
) {
  const existing = await getCloudBaseDocument(collection, documentId);

  if (existing) {
    return {...cloneSpaceState(existing), day_key: dayKey};
  }

  const migrated = createEmptySpaceState(dayKey);

  for (const document of legacyDocuments) {
    for (const state of Object.values(document.states_by_card_id ?? {})) {
      const current = migrated.states_by_card_id[state.card_id];
      if (shouldReplaceSpaceState(current, state)) {
        migrated.states_by_card_id[state.card_id] = {...state};
      }
    }
  }

  if (legacyDocuments.length > 0) {
    await setCloudBaseDocument(collection, documentId, {
      ...migrated,
      phone_number: phoneNumber,
    });
  }

  return migrated;
}

async function listCloudBaseDocumentsByQuery(
  collection,
  query,
  pageSize,
  maximumCount,
) {
  const documents = [];

  for (let offset = 0; ; offset += pageSize) {
    const result = await collection
      .where(query)
      .orderBy('_id', 'asc')
      .skip(offset)
      .limit(pageSize)
      .get();
    const page = Array.isArray(result.data)
      ? result.data
      : result.data
      ? [result.data]
      : [];
    documents.push(...page);

    if (documents.length > maximumCount) {
      throw httpError(
        500,
        'invalid_canonical_state',
        'Legacy physical-space migration exceeds the supported bound.',
      );
    }

    if (page.length < pageSize) {
      return documents;
    }
  }
}

function createCloudBaseDatabase() {
  const cloudbase = require('@cloudbase/node-sdk');
  const env =
    process.env.CLOUDBASE_ENV_ID ??
    process.env.TCB_ENV ??
    process.env.SCF_NAMESPACE ??
    cloudbase.SYMBOL_CURRENT_ENV;
  const app = cloudbase.init({env});

  return app.database();
}

async function getCloudBaseMembership(collection, phoneNumber) {
  const existing = await getCloudBaseDocument(collection, phoneNumber);

  return existing
    ? deserializeMembershipDocument(existing)
    : createInitialMembership();
}

async function saveCloudBaseMembership(
  collection,
  phoneNumber,
  membership,
  acknowledgedAt,
) {
  await setCloudBaseDocument(collection, phoneNumber, {
    entitlement: membership,
    phone_number: phoneNumber,
    updated_at: acknowledgedAt,
  });
}

function deserializeMembershipDocument(document) {
  return cloneMembership(document.entitlement ?? document);
}

async function getCloudBaseDocument(collection, documentId) {
  try {
    const result = await collection.doc(documentId).get();
    const data = Array.isArray(result.data) ? result.data[0] : result.data;

    return data ?? null;
  } catch (error) {
    if (isCloudBaseDocumentMissingError(error)) {
      return null;
    }

    throw error;
  }
}

async function setCloudBaseDocument(collection, documentId, data) {
  await collection.doc(documentId).set(data);
}

function isCloudBaseDocumentMissingError(error) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes('DOCUMENT_NOT_EXIST') ||
    message.includes('document not exists') ||
    message.includes('not found')
  );
}

function createCloudBaseDocumentId(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createDefaultCardSource(track) {
  return normalizeCardSource(
    {
      card_records: getCardRecordsForTrack(track),
      release: null,
      source: DEFAULT_CARD_SOURCE,
      track,
    },
    track,
  );
}

function cloneCardSource(cardSource) {
  return {
    card_records: cloneJson(cardSource.card_records),
    content_version: cardSource.content_version,
    release: cardSource.release ? cloneJson(cardSource.release) : null,
    source: {
      id: cardSource.source.id,
      label: cardSource.source.label,
    },
    track: cardSource.track,
  };
}

function serializeCardSourceResponse(cardSource, expectedTrack) {
  const normalized = normalizeCardSource(cardSource, expectedTrack);

  return {
    card_records: cloneJson(normalized.card_records),
    content_version: normalized.content_version,
    source: {
      id: normalized.source.id,
      label: normalized.source.label,
    },
    track: normalized.track,
  };
}

function validateCardSourceForImport(cardSource, expectedTrack) {
  return normalizeCardSource(cardSource, expectedTrack);
}

function normalizeCardSource(cardSource, expectedTrack) {
  const payload = requireCardSourceObject(cardSource, 'card source');
  const source = requireCardSourceObject(payload.source, 'card source.source');
  const sourceId = requireCardSourceString(source.id, 'card source.source.id');
  const sourceLabel = requireCardSourceString(
    source.label,
    'card source.source.label',
  );
  const track = requireCardSourceTrack(payload.track, 'card source.track');

  if (track !== expectedTrack) {
    throw cardSourceError(
      `card source.track must match requested track ${expectedTrack}.`,
    );
  }

  const cardRecords = requireCardSourceArray(
    payload.card_records,
    'card source.card_records',
  ).map((record, index) =>
    normalizeCardRecord(record, track, `card source.card_records[${index}]`),
  );
  assertUniqueNonEmptyCardRecords(cardRecords);
  const contentVersion = createContentVersion({
    card_records: cardRecords,
    source: {
      id: sourceId,
      label: sourceLabel,
    },
    track,
  });

  if (
    payload.content_version !== undefined &&
    requireCardSourceString(
      payload.content_version,
      'card source.content_version',
    ) !== contentVersion
  ) {
    throw cardSourceError(
      'card source.content_version must match normalized content.',
    );
  }

  return {
    card_records: cardRecords,
    content_version: contentVersion,
    release: normalizeContentRelease(payload.release, contentVersion, track),
    source: {
      id: sourceId,
      label: sourceLabel,
    },
    track,
  };
}

function assertUniqueNonEmptyCardRecords(cardRecords) {
  if (cardRecords.length === 0) {
    throw cardSourceError('card source.card_records must not be empty.');
  }

  const seenCardIds = new Set();

  for (const card of cardRecords) {
    if (seenCardIds.has(card.card_id)) {
      throw cardSourceError(
        `card source.card_records contains duplicate card_id ${card.card_id}.`,
      );
    }

    seenCardIds.add(card.card_id);
  }
}

function normalizeCardRecord(record, expectedTrack, label) {
  const card = requireCardSourceObject(record, label);
  const cardId = requireCardSourcePattern(
    card.card_id,
    /^\d{6}$/,
    `${label}.card_id`,
  );
  const knowledgeRef = requireCardSourcePattern(
    card.knowledge_ref,
    /^\d{4}$/,
    `${label}.knowledge_ref`,
  );
  const track = requireCardSourceTrack(card.track, `${label}.track`);

  if (track !== expectedTrack) {
    throw cardSourceError(`${label}.track must match card source track.`);
  }

  if (!cardId.startsWith(knowledgeRef)) {
    throw cardSourceError(`${label}.card_id must inherit knowledge_ref.`);
  }

  const front = requireCardSourceObject(card.front, `${label}.front`);
  requireCardSourceString(front.eyebrow, `${label}.front.eyebrow`);
  requireCardSourceString(front.prompt, `${label}.front.prompt`);
  requireCardSourceString(front.support, `${label}.front.support`);
  requireCardSourceString(front.context, `${label}.front.context`);

  const analysis = requireCardSourceObject(card.analysis, `${label}.analysis`);
  requireCardSourceString(analysis.title, `${label}.analysis.title`);
  requireCardSourceString(analysis.summary, `${label}.analysis.summary`);
  requireCardSourceString(analysis.exam_tip, `${label}.analysis.exam_tip`);

  const spaceMetadata = requireCardSourceObject(
    card.space_metadata,
    `${label}.space_metadata`,
  );
  const boxRef = requireCardSourcePattern(
    spaceMetadata.box_ref,
    /^\d{4}$/,
    `${label}.space_metadata.box_ref`,
  );
  requireCardSourceString(
    spaceMetadata.library,
    `${label}.space_metadata.library`,
  );
  requireCardSourceString(spaceMetadata.group, `${label}.space_metadata.group`);
  requireCardSourceString(spaceMetadata.box, `${label}.space_metadata.box`);

  if (boxRef !== knowledgeRef) {
    throw cardSourceError(
      `${label}.space_metadata.box_ref must match knowledge_ref.`,
    );
  }

  if (card.hint_layer !== undefined) {
    const hintLayer = requireCardSourceObject(
      card.hint_layer,
      `${label}.hint_layer`,
    );
    requireCardSourceString(hintLayer.content, `${label}.hint_layer.content`);

    if (hintLayer.reveal_gesture !== '下滑') {
      throw cardSourceError(`${label}.hint_layer.reveal_gesture must be 下滑.`);
    }
  }

  switch (card.interaction_id) {
    case 'flip':
      requireCardSourceString(card.back_text, `${label}.back_text`);

      if (card.auto_scoring === true) {
        throw cardSourceError(
          `${label}.flip must not claim auto_scoring true.`,
        );
      }

      return cloneJson(card);
    case 'multiple_choice': {
      const options = requireCardSourceArray(card.options, `${label}.options`);

      if (options.length !== 4) {
        throw cardSourceError(`${label}.options must contain exactly 4 items.`);
      }

      const correctOption = requireCardSourceString(
        card.answer_key?.correct_option,
        `${label}.answer_key.correct_option`,
      );
      const optionIds = new Set(
        options.map((option, index) =>
          requireCardSourceString(option?.id, `${label}.options[${index}].id`),
        ),
      );

      if (!optionIds.has(correctOption)) {
        throw cardSourceError(
          `${label}.answer_key.correct_option must exist in options.`,
        );
      }

      return cloneJson(card);
    }
    case 'lock': {
      const lockSlots = requireCardSourceArray(
        card.lock_slots,
        `${label}.lock_slots`,
      );

      if (lockSlots.length === 0) {
        throw cardSourceError(`${label}.lock_slots must not be empty.`);
      }

      const lockPattern = requireCardSourceArray(
        card.answer_key?.lock_pattern,
        `${label}.answer_key.lock_pattern`,
      );

      if (lockPattern.length !== lockSlots.length) {
        throw cardSourceError(
          `${label}.lock_pattern must align with lock_slots.`,
        );
      }

      lockSlots.forEach((slot, index) => {
        const options = requireCardSourceArray(
          slot?.options,
          `${label}.lock_slots[${index}].options`,
        );

        if (!options.includes(lockPattern[index])) {
          throw cardSourceError(
            `${label}.lock_pattern must select values from each slot.`,
          );
        }
      });

      return cloneJson(card);
    }
    case 'elimination': {
      const eliminationItems = requireCardSourceArray(
        card.elimination_items,
        `${label}.elimination_items`,
      );
      const correctItems = requireCardSourceArray(
        card.answer_key?.correct_items,
        `${label}.answer_key.correct_items`,
      );

      if (correctItems.length === 0) {
        throw cardSourceError(
          `${label}.answer_key.correct_items must not be empty.`,
        );
      }

      const itemIds = new Set(
        eliminationItems.map((item, index) =>
          requireCardSourceString(
            item?.id,
            `${label}.elimination_items[${index}].id`,
          ),
        ),
      );

      if (!correctItems.every(itemId => itemIds.has(itemId))) {
        throw cardSourceError(
          `${label}.answer_key.correct_items must exist in elimination_items.`,
        );
      }

      return cloneJson(card);
    }
    case 'swipe': {
      const swipeStates = requireCardSourceArray(
        card.swipe_states,
        `${label}.swipe_states`,
      );

      if (swipeStates.length !== 2) {
        throw cardSourceError(
          `${label}.swipe_states must contain exactly 2 items.`,
        );
      }

      const correctState = requireCardSourceString(
        card.answer_key?.correct_state,
        `${label}.answer_key.correct_state`,
      );

      if (!swipeStates.some(state => state?.id === correctState)) {
        throw cardSourceError(
          `${label}.answer_key.correct_state must exist in swipe_states.`,
        );
      }

      return cloneJson(card);
    }
    default:
      throw cardSourceError(`${label}.interaction_id is unsupported.`);
  }
}

function requireCardSourceObject(value, fieldName) {
  if (!isObject(value) || Array.isArray(value)) {
    throw cardSourceError(`${fieldName} must be an object.`);
  }

  return value;
}

function requireCardSourceArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw cardSourceError(`${fieldName} must be an array.`);
  }

  return value;
}

function requireCardSourceString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw cardSourceError(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function requireCardSourcePattern(value, pattern, fieldName) {
  const text = requireCardSourceString(value, fieldName);

  if (!pattern.test(text)) {
    throw cardSourceError(`${fieldName} must match ${pattern}.`);
  }

  return text;
}

function requireCardSourceTrack(value, fieldName) {
  const track = requireCardSourceString(value, fieldName);

  if (track !== 'cet4' && track !== 'cet6') {
    throw cardSourceError(`${fieldName} must be cet4 or cet6.`);
  }

  return track;
}

function cardSourceError(message) {
  const error = new Error(message);
  error.code = 'invalid_card_source';
  error.statusCode = 500;
  return error;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createInitialMembership() {
  return {
    counted_entry_count: 0,
    last_experience_ended_by: null,
    recovery_prompt_visible: false,
    stage: 'trial_available',
    trial_duration_days: DEFAULT_TRIAL_DURATION_DAYS,
    trial_started_at_entry_count: null,
  };
}

function cloneMembership(membership) {
  return {
    counted_entry_count: membership.counted_entry_count,
    last_experience_ended_by: membership.last_experience_ended_by,
    recovery_prompt_visible: membership.recovery_prompt_visible,
    stage: membership.stage,
    trial_duration_days: membership.trial_duration_days,
    trial_started_at_entry_count: membership.trial_started_at_entry_count,
  };
}

function serializeMembershipEntitlement(entitlement) {
  return cloneMembership(entitlement);
}

function createAuthToken(config, phoneNumber) {
  const issuedAt = Math.floor(config.now().getTime() / 1000);
  const payload = {
    exp: issuedAt + config.tokenTtlSeconds,
    iat: issuedAt,
    phone_number: phoneNumber,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signTokenPayload(config.tokenSecret, encodedPayload);

  return `softbook.${encodedPayload}.${signature}`;
}

function requireAuthSession(config, request) {
  const authorization = getHeader(request.headers, 'authorization');

  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw httpError(
      401,
      'missing_auth_token',
      'Authorization bearer token is required.',
    );
  }

  const token = authorization.slice('Bearer '.length).trim();
  const payload = verifyAuthToken(config, token);

  return {
    phoneNumber: payload.phone_number,
  };
}

async function requireCompatibleV1Session(config, request) {
  const authorization = getHeader(request.headers, 'authorization');

  if (authorization?.startsWith('Bearer softbook_v2.')) {
    return config.authV2.requireActiveSession(request);
  }

  const session = requireAuthSession(config, request);
  return {
    ...session,
    accountKey: config.authV2.deriveAccountKey(session.phoneNumber),
  };
}

function verifyAuthToken(config, token) {
  const parts = token.split('.');

  if (parts.length !== 3 || parts[0] !== 'softbook') {
    throw httpError(401, 'invalid_auth_token', 'Invalid authorization token.');
  }

  const [, encodedPayload, signature] = parts;
  const expectedSignature = signTokenPayload(
    config.tokenSecret,
    encodedPayload,
  );

  if (!safeEqual(signature, expectedSignature)) {
    throw httpError(401, 'invalid_auth_token', 'Invalid authorization token.');
  }

  const payload = parseJson(
    base64UrlDecode(encodedPayload),
    'auth token payload',
  );

  if (!isObject(payload)) {
    throw httpError(401, 'invalid_auth_token', 'Invalid authorization token.');
  }

  const phoneNumber = requirePhoneNumber(payload.phone_number);
  const exp = payload.exp;

  if (typeof exp !== 'number' || !Number.isInteger(exp)) {
    throw httpError(401, 'invalid_auth_token', 'Invalid authorization token.');
  }

  if (Math.floor(config.now().getTime() / 1000) >= exp) {
    throw httpError(
      401,
      'expired_auth_token',
      'Authorization token has expired.',
    );
  }

  return {
    phone_number: phoneNumber,
  };
}

function assertBodyPhoneMatchesSession(body, session) {
  const payload = requireObjectBody(body);
  const phoneNumber = requirePhoneNumber(payload.phone_number);

  if (phoneNumber !== session.phoneNumber) {
    throw httpError(
      403,
      'phone_number_mismatch',
      'phone_number must match auth token.',
    );
  }
}

function parseCloudBaseEvent(event = {}) {
  const headers = normalizeHeaders(event.headers ?? {});
  const path =
    event.path ??
    event.rawPath ??
    event.requestContext?.path ??
    event.requestContext?.http?.path ??
    '/';
  const method =
    event.httpMethod ??
    event.method ??
    event.requestContext?.httpMethod ??
    event.requestContext?.http?.method ??
    'GET';
  const query = normalizeQuery(
    event.queryStringParameters ??
      event.query ??
      parseQueryString(event.rawQueryString ?? event.queryString ?? ''),
  );

  return {
    body: parseEventBody(event.body, event.isBase64Encoded),
    clientIp:
      event.requestContext?.http?.sourceIp ??
      event.requestContext?.identity?.sourceIp ??
      event.requestContext?.sourceIp,
    headers,
    method,
    path,
    query,
  };
}

function parseEventBody(body, isBase64Encoded = false) {
  if (body === undefined || body === null || body === '') {
    return undefined;
  }

  if (isObject(body)) {
    return body;
  }

  const text = isBase64Encoded
    ? Buffer.from(String(body), 'base64').toString('utf8')
    : String(body);

  return parseJson(text, 'request body');
}

function normalizeApiPath(path) {
  const pathname = String(path).split('?')[0] || '/';
  const versionedPath = pathname.match(/\/v[12]\/.*$/);

  if (versionedPath) {
    return versionedPath[0];
  }

  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function normalizeHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key.toLowerCase(),
      Array.isArray(value) ? value.join(',') : String(value),
    ]),
  );
}

function normalizeQuery(query) {
  return Object.fromEntries(
    Object.entries(query ?? {}).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
}

function parseQueryString(queryString) {
  const params = new URLSearchParams(queryString);
  return Object.fromEntries(params.entries());
}

function toCloudBaseResponse(response) {
  return {
    body: response.body === null ? '' : JSON.stringify(response.body),
    headers: response.headers,
    isBase64Encoded: false,
    statusCode: response.statusCode,
  };
}

function jsonResponse(statusCode, body) {
  return {
    body,
    headers: {
      'Access-Control-Allow-Headers':
        'Authorization,Content-Type,X-Api-Key,X-Softbook-Client',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=utf-8',
    },
    statusCode,
  };
}

function errorResponse(error) {
  const statusCode = error.statusCode ?? 500;
  const code = error.code ?? 'internal_error';
  const message =
    statusCode >= 500 ? 'Internal Softbook API error.' : error.message;

  return jsonResponse(statusCode, {
    error: {
      code,
      message,
    },
  });
}

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function isApiKeyAllowed(config, headers) {
  if (!config.apiKey) {
    return true;
  }

  return getHeader(headers, 'x-api-key') === config.apiKey;
}

function getHeader(headers, name) {
  return headers[name.toLowerCase()];
}

function requireObjectBody(body) {
  return requireObject(body, 'request body');
}

function requireObject(value, fieldName) {
  if (!isObject(value) || Array.isArray(value)) {
    throw httpError(400, 'invalid_request', `${fieldName} must be an object.`);
  }

  return value;
}

function requireArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw httpError(400, 'invalid_request', `${fieldName} must be an array.`);
  }

  return value;
}

function requirePhoneNumber(value) {
  const phoneNumber = requireNonEmptyString(value, 'phone_number');

  if (!/^1\d{10}$/.test(phoneNumber)) {
    throw httpError(
      400,
      'invalid_request',
      'phone_number must be a valid mainland China mobile number.',
    );
  }

  return phoneNumber;
}

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw httpError(400, 'invalid_request', `${fieldName} is required.`);
  }

  return value.trim();
}

function requireDayKey(value) {
  const dayKey = requireNonEmptyString(value, 'day_key');

  if (!isValidDayKey(dayKey)) {
    throw httpError(
      400,
      'invalid_request',
      'day_key must be a valid YYYY-MM-DD calendar date.',
    );
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

function requireTrack(value) {
  return requireEnum(value, ['cet4', 'cet6'], 'track');
}

function requireBoolean(value, fieldName) {
  if (typeof value !== 'boolean') {
    throw httpError(400, 'invalid_request', `${fieldName} must be boolean.`);
  }

  return value;
}

function requireNonNegativeInteger(value, fieldName) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw httpError(
      400,
      'invalid_request',
      `${fieldName} must be a non-negative integer.`,
    );
  }

  return value;
}

function requireIsoTimestamp(value, fieldName) {
  const timestamp = requireNonEmptyString(value, fieldName);

  if (Number.isNaN(new Date(timestamp).getTime())) {
    throw httpError(
      400,
      'invalid_request',
      `${fieldName} must be ISO timestamp.`,
    );
  }

  return timestamp;
}

function requireInteractionId(value, fieldName) {
  return requireEnum(
    value,
    ['flip', 'multiple_choice', 'lock', 'elimination', 'swipe'],
    fieldName,
  );
}

function requireLearningOutcome(value, fieldName) {
  return requireEnum(
    value,
    ['correct', 'incorrect', 'confident', 'review'],
    fieldName,
  );
}

function requireEnum(value, allowedValues, fieldName) {
  if (!allowedValues.includes(value)) {
    throw httpError(
      400,
      'invalid_request',
      `${fieldName} must be one of: ${allowedValues.join(', ')}.`,
    );
  }

  return value;
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw httpError(400, 'invalid_json', `${label} must be valid JSON.`);
  }
}

function signTokenPayload(secret, encodedPayload) {
  return crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');
}

function base64UrlEncode(text) {
  return Buffer.from(text, 'utf8').toString('base64url');
}

function base64UrlDecode(text) {
  return Buffer.from(text, 'base64url').toString('utf8');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function isObject(value) {
  return typeof value === 'object' && value !== null;
}

function getCardRecordsForTrack(track) {
  return track === 'cet6' ? CET6_CARD_RECORDS : CET4_CARD_RECORDS;
}

const CET4_CARD_RECORDS = [
  {
    card_id: '002001',
    track: 'cet4',
    knowledge_ref: '0020',
    interaction_id: 'flip',
    front: {
      eyebrow: '听力 | 逻辑关系',
      prompt: '短对话里听到 however，优先盯哪一半信息？',
      support: '先抓转折，不要被前半句带跑。',
      context: 'CET 听力里真正态度和结果常压在 however 后半句。',
    },
    back_text: '优先盯转折后的半句，再回头核对前面让步或铺垫的信息。',
    analysis: {
      title: '先抓态度转向，再判断答案',
      summary: '听力里的 however 往往不是装饰词，而是把说话人真正结论往后推。',
      exam_tip: '听到转折词时先记“后半句优先”，再看选项有没有只复述前半句。',
    },
    hint_layer: {
      label: '提示层',
      content: '先问自己：说话人是在收回前面的判断，还是给出真正立场？',
      reveal_gesture: '下滑',
    },
    space_metadata: {
      box_ref: '0020',
      library: '听力',
      group: '逻辑关系',
      box: '转折关系',
    },
  },
  {
    card_id: '012101',
    track: 'cet4',
    knowledge_ref: '0121',
    interaction_id: 'lock',
    front: {
      eyebrow: '仔细阅读 | 长难句主干',
      prompt: '把句子主干锁出来，三个槽位都对才开锁。',
      support: '先抓主语，再找谓语和核心宾语。',
      context: '复杂修饰里先保住 S + V + O，读长句会轻很多。',
    },
    lock_slots: [
      {
        id: 'subject',
        label: '主语',
        options: ['The policy', 'reduces', 'test anxiety'],
      },
      {
        id: 'verb',
        label: '谓语',
        options: ['test anxiety', 'The policy', 'reduces'],
      },
      {
        id: 'object',
        label: '宾语',
        options: ['reduces', 'test anxiety', 'during revision'],
      },
    ],
    answer_key: {
      lock_pattern: ['The policy', 'reduces', 'test anxiety'],
    },
    auto_scoring: true,
    analysis: {
      title: '开锁的关键是别让修饰词抢主干',
      summary:
        '很多真题长句会把时间、方式和插入解释塞进句中。先锁主语、谓语、宾语，阅读压力会明显下降。',
      exam_tip: '如果一句话太长，先问自己“是谁做了什么”，再补其他成分。',
    },
    hint_layer: {
      label: '提示层',
      content: '遇到长句先找有限动词，主语通常会围着它出现。',
      reveal_gesture: '下滑',
    },
    space_metadata: {
      box_ref: '0121',
      library: '仔细阅读',
      group: '长难句主干',
      box: '主谓宾',
    },
  },
  {
    card_id: '052101',
    track: 'cet4',
    knowledge_ref: '0521',
    interaction_id: 'multiple_choice',
    front: {
      eyebrow: '词汇 | 阅读高频词',
      prompt:
        'The committee postponed the vote because several details were still ____.',
      support: '选出最符合句意的词。',
      context: '投票被推迟，说明关键信息还没有清楚。',
    },
    options: [
      {id: 'urgent', label: 'A', text: 'urgent'},
      {id: 'unclear', label: 'B', text: 'unclear'},
      {id: 'formal', label: 'C', text: 'formal'},
      {id: 'similar', label: 'D', text: 'similar'},
    ],
    answer_key: {
      correct_option: 'unclear',
    },
    auto_scoring: true,
    analysis: {
      title: '先顺着因果看语义',
      summary:
        '因为“细节还不清楚”才会推迟投票。urgent 和 formal 都能修饰 details，但和因果不成立。',
      exam_tip: '四选一别孤立看词，先把它塞回原句，看前后逻辑是不是闭合。',
    },
    space_metadata: {
      box_ref: '0521',
      library: '词汇',
      group: '高频词',
      box: '阅读高频词',
    },
  },
  {
    card_id: '013001',
    track: 'cet4',
    knowledge_ref: '0130',
    interaction_id: 'elimination',
    front: {
      eyebrow: '仔细阅读 | 长难句关键修饰',
      prompt: '点掉应删除的干扰成分，保留句干。',
      support:
        '目标句：The students who review in short bursts usually remember the pattern before the test.',
      context: '先把修饰成分剥掉，再回到主谓宾。',
    },
    elimination_items: [
      {id: 'relative_clause', text: 'who review in short bursts'},
      {id: 'adverb', text: 'usually'},
      {id: 'object', text: 'the pattern'},
      {id: 'time_phrase', text: 'before the test'},
    ],
    answer_key: {
      correct_items: ['relative_clause', 'adverb', 'time_phrase'],
    },
    auto_scoring: true,
    analysis: {
      title: '去干扰不是乱删，是先保骨架',
      summary:
        '这句的句干是 The students remember the pattern。定语从句、频率副词和时间状语都能先剥离，帮助你看清核心结构。',
      exam_tip: '做阅读细节题时，先保住主干，才能更快判断选项是不是偷换信息。',
    },
    hint_layer: {
      label: '提示层',
      content: '先保留主语、谓语、核心宾语，状语和定语从句可以先暂存。',
      reveal_gesture: '下滑',
    },
    space_metadata: {
      box_ref: '0130',
      library: '仔细阅读',
      group: '长难句关键修饰',
      box: '定语',
    },
  },
  {
    card_id: '050301',
    track: 'cet4',
    knowledge_ref: '0503',
    interaction_id: 'swipe',
    front: {
      eyebrow: '词汇 | 同义词替换',
      prompt: 'be likely to do 在翻译里更接近哪一侧？',
      support: '用双态判断压低进入成本。',
      context: '别把 likely 误读成“喜欢”，它更常表达概率。',
    },
    swipe_states: [
      {
        id: 'safe',
        label: '可直接套用',
        description: '表达“很可能做某事”。',
      },
      {
        id: 'risky',
        label: '容易误用',
        description: '误写成“对某事很喜欢”。',
      },
    ],
    answer_key: {
      correct_state: 'safe',
    },
    auto_scoring: true,
    analysis: {
      title: '先稳住高频句式替换的中文落点',
      summary:
        'be likely to do 先落到“很可能……”最稳。如果误解成 like，翻译会直接偏题。',
      exam_tip: '翻译高频结构时，优先记“最稳的中文落点”。',
    },
    space_metadata: {
      box_ref: '0503',
      library: '词汇',
      group: '同义词替换',
      box: '句式替换',
    },
  },
];

const CET6_CARD_RECORDS = [
  {
    card_id: '102001',
    track: 'cet6',
    knowledge_ref: '1020',
    interaction_id: 'flip',
    front: {
      eyebrow: '听力 | 逻辑关系',
      prompt: '讲座里出现 nevertheless，后面通常承担什么作用？',
      support: '先把它当作立场修正信号。',
      context: 'CET6 长听力常用让步后转折来给出真正观点。',
    },
    back_text: 'nevertheless 后面更可能是说话人要保留的核心判断。',
    analysis: {
      title: '让步后转折更接近答案位',
      summary:
        'CET6 听力会把背景、限制和真正观点拆开。听到 nevertheless，要把注意力重新落到后半句。',
      exam_tip: '选项如果只复述让步信息，通常不是最终答案。',
    },
    hint_layer: {
      label: '提示层',
      content: '先判断后半句是在补充、让步，还是改写前面的结论。',
      reveal_gesture: '下滑',
    },
    space_metadata: {
      box_ref: '1020',
      library: '听力',
      group: '逻辑关系',
      box: '转折关系',
    },
  },
  {
    card_id: '112101',
    track: 'cet6',
    knowledge_ref: '1121',
    interaction_id: 'lock',
    front: {
      eyebrow: '仔细阅读 | 长难句主干',
      prompt: '锁出学术长句的主谓宾，避免被限定语打断。',
      support: '先抓 subject / verb / object 三个槽。',
      context: 'CET6 阅读常把主干藏在多层修饰和限定语后。',
    },
    lock_slots: [
      {
        id: 'subject',
        label: '主语',
        options: [
          'The limited evidence',
          'shaped',
          'the preliminary conclusion',
        ],
      },
      {
        id: 'verb',
        label: '谓语',
        options: [
          'the preliminary conclusion',
          'The limited evidence',
          'shaped',
        ],
      },
      {
        id: 'object',
        label: '宾语',
        options: ['shaped', 'the preliminary conclusion', 'in the report'],
      },
    ],
    answer_key: {
      lock_pattern: [
        'The limited evidence',
        'shaped',
        'the preliminary conclusion',
      ],
    },
    auto_scoring: true,
    analysis: {
      title: '先抽主干，再处理限定语',
      summary:
        'CET6 长句常用限定语和插入信息拉长句子。先锁定主语、谓语和宾语，才能判断后面的限定是不是改变结论强度。',
      exam_tip: '遇到学术长句，先问“谁影响了什么”，再回头补条件、范围和态度。',
    },
    space_metadata: {
      box_ref: '1121',
      library: '仔细阅读',
      group: '长难句主干',
      box: '主谓宾',
    },
  },
  {
    card_id: '152101',
    track: 'cet6',
    knowledge_ref: '1521',
    interaction_id: 'multiple_choice',
    front: {
      eyebrow: '词汇 | 高频词',
      prompt:
        'The findings should be treated with ____ because the sample was small.',
      support: '选出最符合学术语境的词。',
      context: '样本小意味着结论需要谨慎处理。',
    },
    options: [
      {id: 'caution', label: 'A', text: 'caution'},
      {id: 'frequency', label: 'B', text: 'frequency'},
      {id: 'comfort', label: 'C', text: 'comfort'},
      {id: 'volume', label: 'D', text: 'volume'},
    ],
    answer_key: {
      correct_option: 'caution',
    },
    auto_scoring: true,
    analysis: {
      title: '小样本对应谨慎解释',
      summary: 'with caution 是学术阅读高频搭配，表示结论不能被过度推广。',
      exam_tip: '遇到 sample / evidence limited，优先寻找谨慎、限制类表达。',
    },
    space_metadata: {
      box_ref: '1521',
      library: '词汇',
      group: '高频词',
      box: '阅读高频词',
    },
  },
  {
    card_id: '113001',
    track: 'cet6',
    knowledge_ref: '1130',
    interaction_id: 'elimination',
    front: {
      eyebrow: '仔细阅读 | 长难句关键修饰',
      prompt: '点掉削弱原句论证主线的干扰信息。',
      support:
        '目标句：Researchers who relied on a narrow sample cautiously framed the result as preliminary.',
      context: 'CET6 阅读更常考限定语和结论强度，不要把修饰误当主结论。',
    },
    elimination_items: [
      {id: 'relative_clause', text: 'who relied on a narrow sample'},
      {id: 'adverb', text: 'cautiously'},
      {id: 'verb', text: 'framed'},
      {id: 'complement', text: 'the result as preliminary'},
    ],
    answer_key: {
      correct_items: ['relative_clause', 'adverb'],
    },
    auto_scoring: true,
    analysis: {
      title: '先保住研究者做出的核心判断',
      summary:
        '这句主线是 Researchers framed the result as preliminary。样本限制和 cautiously 是重要限定，但先剥离它们能帮助你看清主干。',
      exam_tip:
        'CET6 长句里，限定语常影响态度强度；先拆主干，再把限定语补回判断。',
    },
    hint_layer: {
      label: '提示层',
      content: '先保留主语、谓语和补足语，再判断限定语如何改变语气。',
      reveal_gesture: '下滑',
    },
    space_metadata: {
      box_ref: '1130',
      library: '仔细阅读',
      group: '长难句关键修饰',
      box: '定语',
    },
  },
  {
    card_id: '150301',
    track: 'cet6',
    knowledge_ref: '1503',
    interaction_id: 'swipe',
    front: {
      eyebrow: '词汇 | 同义词替换',
      prompt: '“This proves that...” 在弱证据段落里属于哪一侧？',
      support: '判断论证强度是否过满。',
      context: 'CET6 写作更需要控制 claims 的力度。',
    },
    swipe_states: [
      {
        id: 'safe',
        label: '力度合适',
        description: '证据强时才适合使用。',
      },
      {
        id: 'risky',
        label: '容易过度',
        description: '弱证据下更适合 suggests / indicates。',
      },
    ],
    answer_key: {
      correct_state: 'risky',
    },
    auto_scoring: true,
    analysis: {
      title: '证据弱时别把结论写满',
      summary:
        'proves 会把论证强度拉到很高。样本、数据或来源有限时，suggests 更稳。',
      exam_tip: '写作里先匹配证据强度，再选择 claims 的动词。',
    },
    space_metadata: {
      box_ref: '1503',
      library: '词汇',
      group: '同义词替换',
      box: '句式替换',
    },
  },
];

module.exports = {
  createCloudBaseStore,
  createMemoryStore,
  createSoftbookApi,
  get defaultApi() {
    return getDefaultApi();
  },
  main,
  validateCardSourceForImport,
};
