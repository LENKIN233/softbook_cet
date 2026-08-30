const crypto = require('node:crypto');
const {createAuthV2Service} = require('./auth-v2');
const {
  createAccountDeletionWorkerV1,
  createCloudBaseAccountDeletionRepository,
  createMemoryAccountDeletionRepository,
} = require('./account-deletion-worker-v1');
const {createRuntimeSmsProvider} = require('./sms-provider');
const {
  isContentReleaseValidForRuntime,
} = require('./content-release-runtime');
const {
  normalizeCloudBaseDocuments,
} = require('./cloudbase-documents');
const {isCloudBaseDocumentMissingError} = require('./cloudbase-errors');
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
const {
  createContentManifestSigner,
  createContentManifestV1Service,
} = require('./content-manifest-v1');
const {createDailyCheckInV2Service} = require('./daily-check-in-v2');
const {
  PilotEntitlementError,
  pilotEntitlementInternals,
  planPilotEntitlementMutation,
  publicPilotEntitlementPlan,
  validatePilotEntitlementCommand,
} = require('./pilot-entitlement-v1');
const {createLearningEventsV2Service} = require('./learning-events-v2');
const {
  SCHEDULER_POLICY_VERSION,
  createAccountLearningSessionId,
  createAccountLearningSessionKey,
  createLearningSchedulerV1Service,
  maximumLearningServerSequence,
  normalizeLearningSessionState,
  normalizeSchedulerProjection,
  toBootstrapLearningCursor,
} = require('./learning-scheduler-v1');
const {
  countLegacyPendingReview,
  createAccountDailyProgressId,
  createAccountDailyProgressKey,
  createAccountLearningStateId,
  createAccountLearningStateKey,
  createCloudBaseLearningEventsCommitter,
  createLearningEventSequenceId,
  createMemoryLearningEventsCommitter,
  createSerializedTransactionRunner,
} = require('./learning-events-v2-store');
const {
  assertRecoverablePreviousWriterLedger,
  assertSpaceActionLineageAuthority,
  cloneSpaceState,
  createSpaceActionLineageId,
  createSpaceActionLedgerId,
  createSpaceActionsV2Service,
  createSpaceRevisionCheckpoint,
  createSpaceStateId,
  createSpaceStateDigest,
  createSpaceStateRevisionId,
  migrateLegacySpaceDocuments,
  normalizeStoredSpaceState,
  normalizeStoredSpaceStateRevision,
  prepareSpaceActionCommit,
  toStoredSpaceState,
} = require('./space-actions-v2');

const DEFAULT_SMS_CODE = '2468';
const FREE_CARD_ACCESS_RATIO = 0.5;
const RUNTIME_MODES = new Set([
  'controlled_pilot',
  'development',
  'production',
]);
const DEFAULT_TRIAL_DURATION_DAYS = 5;
const DEFAULT_TRIAL_DURATION_HOURS = 120;
const TRIAL_DURATION_MILLISECONDS =
  DEFAULT_TRIAL_DURATION_HOURS * 60 * 60 * 1000;
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const LEGACY_SNAPSHOT_WRITE_PATHS = new Set([
  '/v1/learning/state-sync',
  '/v1/progress/daily-sync',
]);
const LEGACY_SPACE_SNAPSHOT_PATH = '/v1/space/state-sync';
const DAILY_CHECK_IN_DOCUMENT_KEYS = [
  'account_key',
  'acknowledged_at',
  'checked_in_today',
  'day_key',
  'schema_version',
];
const LEGACY_SPACE_QUERY_PAGE_SIZE = 100;
const LEGACY_SPACE_QUERY_MAX_DOCUMENTS = 5000;
const LEGACY_LEARNING_QUERY_PAGE_SIZE = 100;
const LEGACY_LEARNING_QUERY_MAX_DOCUMENTS = 5000;
const MEMBERSHIP_REVISION_SCHEMA_VERSION = 'membership-revision.v1';
const MEMBERSHIP_REVISION_KEYS = [
  'phone_number',
  'revision',
  'schema_version',
  'state_digest',
];
const CLOUDBASE_COLLECTIONS = {
  accountDeletions: 'softbook_account_deletions',
  authChallenges: 'softbook_auth_challenges',
  authRateLimits: 'softbook_auth_rate_limits',
  authSessions: 'softbook_auth_sessions',
  betaEntitlements: 'softbook_beta_entitlements',
  cardSourceVersions: 'softbook_card_source_versions',
  cardSources: 'softbook_card_sources',
  dailyCheckIns: 'softbook_daily_check_ins',
  dailyProgress: 'softbook_daily_progress',
  learningEventCursors: 'softbook_learning_event_cursors',
  learningEvents: 'softbook_learning_events',
  learningEventSequences: 'softbook_learning_event_sequences',
  learningMigrationRevisions: 'softbook_learning_migration_revisions',
  pilotRoundContinuations: 'softbook_pilot_round_continuations',
  pilotEntitlements: 'softbook_pilot_entitlements',
  learningSessions: 'softbook_learning_sessions',
  learningStates: 'softbook_learning_states',
  memberships: 'softbook_memberships',
  membershipRevisions: 'softbook_membership_revisions',
  spaceActionLineages: 'softbook_space_action_lineages',
  spaceActions: 'softbook_space_actions',
  spaceStateRevisions: 'softbook_space_state_revisions',
  spaceStates: 'softbook_space_states',
};
const DEFAULT_CARD_SOURCE = {
  id: 'cloudbase-dev-card-source',
  label: 'CloudBase 开发卡源',
};

let defaultApi;

async function main(event, context) {
  if (event?.schema_version === 'pilot-entitlement-operator-invoke.v1') {
    return handlePilotEntitlementOperatorInvoke(event);
  }
  return getDefaultApi().handleCloudBaseEvent(event, context);
}

async function accountDeletionWorkerMain(event = {}) {
  const repository = createCloudBaseAccountDeletionRepository(
    createCloudBaseDatabase(),
    CLOUDBASE_COLLECTIONS,
  );
  return createAccountDeletionWorkerV1({repository}).run({
    limit: event.limit ?? 10,
  });
}

async function handlePilotEntitlementOperatorInvoke(event, options = {}) {
  const actualKeys = Object.keys(event ?? {}).sort();
  if (
    actualKeys.length !== 3 ||
    actualKeys[0] !== 'command' ||
    actualKeys[1] !== 'schema_version' ||
    actualKeys[2] !== 'signature'
  ) {
    throw new PilotEntitlementError('pilot entitlement operator invocation is invalid.');
  }
  const runtimeMode = resolveRuntimeMode(options.runtimeMode);
  const pilotId = options.pilotId ?? process.env.SOFTBOOK_PILOT_ID ?? null;
  const pilotExpiresAt =
    options.pilotExpiresAt ?? process.env.SOFTBOOK_PILOT_EXPIRES_AT ?? null;
  const operatorSecret =
    options.operatorSecret ?? process.env.SOFTBOOK_PILOT_OPERATOR_SECRET ?? null;
  const observedAt = (options.now ?? (() => new Date()))().toISOString();
  const command = validatePilotEntitlementCommand(event.command);
  assertPilotOperatorSignature(command, event.signature, operatorSecret);
  if (
    runtimeMode !== 'controlled_pilot' ||
    !isCanonicalIsoTimestamp(pilotExpiresAt) ||
    command.pilot_id !== pilotId ||
    Date.parse(command.occurred_at) > Date.parse(observedAt) ||
    Date.parse(command.occurred_at) >= Date.parse(pilotExpiresAt) ||
    Date.parse(observedAt) >= Date.parse(pilotExpiresAt)
  ) {
    throw new PilotEntitlementError(
      'pilot entitlement command is outside the active receiver pilot.',
    );
  }
  const store =
    options.store ?? createDefaultStore({pilotExpiresAt, pilotId, runtimeMode});
  if (typeof store.applyPilotEntitlementCommand !== 'function') {
    throw new PilotEntitlementError('pilot entitlement operator store is unavailable.');
  }
  const result = await store.applyPilotEntitlementCommand(command);
  return {
    schema_version: 'pilot-entitlement-operator-result.v1',
    gate_eligible: false,
    status: 'passed',
    writes_performed: result.changed,
    result,
  };
}

function assertPilotOperatorSignature(command, signature, secret) {
  if (
    typeof secret !== 'string' ||
    secret.length < 32 ||
    typeof signature !== 'string' ||
    !/^hmac-sha256:[a-f0-9]{64}$/.test(signature)
  ) {
    throw new PilotEntitlementError('pilot entitlement operator authentication failed.');
  }
  const expected = `hmac-sha256:${crypto
    .createHmac('sha256', secret)
    .update(pilotEntitlementInternals.stableStringify(command))
    .digest('hex')}`;
  if (
    !crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expected, 'utf8'),
    )
  ) {
    throw new PilotEntitlementError('pilot entitlement operator authentication failed.');
  }
}

function getDefaultApi() {
  if (!defaultApi) {
    defaultApi = createSoftbookApi();
  }

  return defaultApi;
}

function createSoftbookApi(options = {}) {
  const runtimeMode = resolveRuntimeMode(options.runtimeMode);
  const pilotId = options.pilotId ?? process.env.SOFTBOOK_PILOT_ID ?? null;
  const pilotExpiresAt =
    options.pilotExpiresAt ?? process.env.SOFTBOOK_PILOT_EXPIRES_AT ?? null;
  const store =
    options.store ?? createDefaultStore({pilotExpiresAt, pilotId, runtimeMode});
  const tokenSecret =
    options.tokenSecret ??
    process.env.SOFTBOOK_AUTH_TOKEN_SECRET ??
    'softbook-cloudbase-dev-secret';
  const config = {
    allowLegacyV1:
      runtimeMode === 'development' ? options.allowLegacyV1 ?? true : false,
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
    smsProvider:
      options.smsProvider ??
      (process.env.SOFTBOOK_SMS_PROVIDER
        ? createRuntimeSmsProvider({
            env: process.env,
            fetchImpl: options.smsFetch,
            runtimeMode,
          })
        : undefined),
    store,
    tokenSecret,
    verifyAttemptLimit: options.authV2VerifyAttemptLimit,
  });
  config.bootstrapV2 = createBootstrapV2Service({
    now: config.now,
    runtimeMode,
    store,
  });
  config.contentManifestV1 = createContentManifestV1Service({
    downloadTtlSeconds: options.contentManifestDownloadTtlSeconds,
    now: config.now,
    runtimeMode,
    resolveDownloadUrl:
      options.contentAssetUrlResolver ?? createDefaultContentAssetUrlResolver(),
    signer:
      options.contentManifestSigner ?? readContentManifestSignerFromEnv(),
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
  config.dailyCheckInV2 = createDailyCheckInV2Service({
    now: config.now,
    store,
  });
  config.spaceActionsV2 = createSpaceActionsV2Service({
    now: config.now,
    runtimeMode,
    store,
  });
  config.learningSchedulerV1 = createLearningSchedulerV1Service({
    now: config.now,
    randomBytes: options.learningSchedulerRandomBytes,
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

    if (
      method === 'POST' &&
      LEGACY_SNAPSHOT_WRITE_PATHS.has(path)
    ) {
      return jsonResponse(410, {
        error: {
          code: 'legacy_snapshot_write_disabled',
          message: 'Legacy daily and learning snapshot writes are disabled.',
        },
      });
    }

    if (path === LEGACY_SPACE_SNAPSHOT_PATH) {
      return jsonResponse(410, {
        error: {
          code: 'legacy_space_snapshot_disabled',
          message: 'Legacy physical-space snapshot APIs are disabled.',
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

    if (method === 'GET' && path === '/v2/learning/card-source') {
      const session = await config.authV2.requireActiveSession(request);
      assertLearningCardSourceRequest(request);
      return await handleLearningCardSource(
        config,
        request,
        session.phoneNumber,
      );
    }

    if (method === 'GET' && path === '/v2/membership/entitlement') {
      const session = await config.authV2.requireActiveSession(request);
      assertSessionOwnedMembershipRequest(request, false);
      return jsonResponse(200, {
        data: {
          entitlement: serializeMembershipEntitlement(
            await readCanonicalMembership(config, session.phoneNumber),
          ),
        },
      });
    }

    if (method === 'POST' && path === '/v2/membership/start-trial') {
      throw httpError(
        404,
        'route_not_found',
        'Remote trials start only from Learning Session.',
      );
    }

    if (method === 'POST' && path === '/v2/membership/purchase') {
      if (config.runtimeMode !== 'development') {
        throw httpError(
          404,
          'route_not_found',
          'Client-owned membership purchase is unavailable.',
        );
      }
      const session = await config.authV2.requireActiveSession(request);
      assertSessionOwnedMembershipRequest(request, true);
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

    if (method === 'POST' && path === '/v2/membership/dismiss-recovery') {
      const session = await config.authV2.requireActiveSession(request);
      assertSessionOwnedMembershipRequest(request, true);
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

    if (method === 'POST' && path === '/v2/learning/events') {
      const session = await config.authV2.requireActiveSession(request);

      return jsonResponse(200, {
        data: await config.learningEventsV2.submit({request, session}),
      });
    }

    if (method === 'POST' && path === '/v2/learning/round/continue') {
      if (config.runtimeMode !== 'controlled_pilot') {
        throw httpError(404, 'route_not_found', 'Route not found.');
      }
      const session = await config.authV2.requireActiveSession(request);
      assertPilotRoundContinueRequest(request);
      return jsonResponse(200, {
        data: await config.learningSchedulerV1.continueRound({
          accountKey: session.accountKey,
          body: request.body,
          phoneNumber: session.phoneNumber,
        }),
      });
    }

    if (method === 'POST' && path === '/v2/progress/check-in') {
      const session = await config.authV2.requireActiveSession(request);

      return jsonResponse(200, {
        data: await config.dailyCheckInV2.checkIn({request, session}),
      });
    }

    if (method === 'POST' && path === '/v2/space/actions') {
      const session = await config.authV2.requireActiveSession(request);

      return jsonResponse(200, {
        data: await config.spaceActionsV2.submit({request, session}),
      });
    }

    if (method === 'GET' && path === '/v2/learning/session') {
      const session = await config.authV2.requireActiveSession(request);
      assertLearningSessionIdentityComesFromSession(request);
      const track = requireTrack(request.query.track);

      return jsonResponse(200, {
        data: await config.learningSchedulerV1.read({
          accountKey: session.accountKey,
          phoneNumber: session.phoneNumber,
          track,
        }),
      });
    }

    if (method === 'GET' && path === '/v2/content/manifest') {
      const session = await config.authV2.requireActiveSession(request);
      assertContentManifestRequest(request);

      return jsonResponse(200, {
        data: await config.contentManifestV1.read({
          contentVersion: request.query.content_version,
          phoneNumber: session.phoneNumber,
          track: request.query.track,
        }),
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
      return await handleLearningCardSource(
        config,
        request,
        session.phoneNumber,
      );
    }

    if (method === 'GET' && path === '/v1/membership/entitlement') {
      return jsonResponse(200, {
        data: {
          entitlement: serializeMembershipEntitlement(
            await readCanonicalMembership(config, session.phoneNumber),
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

function readCanonicalMembership(config, phoneNumber) {
  const observedAt = config.now().toISOString();
  return config.store.getMembership(phoneNumber, observedAt);
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

async function handleLearningCardSource(config, request, phoneNumber) {
  const track = request.query.track ?? 'cet4';

  if (track !== 'cet4' && track !== 'cet6') {
    throw httpError(400, 'invalid_track', 'track must be cet4 or cet6.');
  }

  const cardSource = await config.store.getCardSource(track, {
    allowDevelopmentDefault: config.runtimeMode === 'development',
  });

  if (
    !isContentReleaseValidForRuntime(
      cardSource,
      config.runtimeMode,
      config.now(),
    )
  ) {
    throw contentReleaseUnavailableError(
      'A matching published content release is required.',
    );
  }

  const membership = await readCanonicalMembership(config, phoneNumber);

  return jsonResponse(200, {
    data: serializeCardSourceResponse(
      cardSource,
      track,
      membership.stage,
    ),
  });
}

function resolveRuntimeMode(overrideValue) {
  const runtimeMode = overrideValue ?? process.env.SOFTBOOK_RUNTIME_MODE;

  if (typeof runtimeMode !== 'string' || runtimeMode.trim() === '') {
    throw new Error(
      'SOFTBOOK_RUNTIME_MODE must be explicitly configured as development, production, or controlled_pilot.',
    );
  }

  if (!RUNTIME_MODES.has(runtimeMode)) {
    throw new Error(`Unsupported SOFTBOOK_RUNTIME_MODE: ${runtimeMode}`);
  }

  return runtimeMode;
}

function acknowledgedResponse(acknowledgedAt) {
  return jsonResponse(200, {
    data: {
      acknowledged_at: acknowledgedAt,
      mode: 'remote',
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

function assertLearningSessionIdentityComesFromSession(request) {
  const allowedQueryFields = new Set(['track']);
  const hasForbiddenQuery = Object.keys(request.query).some(
    field => !allowedQueryFields.has(field),
  );

  if (hasForbiddenQuery || request.body !== undefined) {
    throw httpError(
      400,
      'learning_session_authority_input_forbidden',
      'Learning session authority comes from the active session and server.',
    );
  }
}

function assertLearningCardSourceRequest(request) {
  const allowedQueryFields = new Set(['track']);
  const hasForbiddenQuery = Object.keys(request.query).some(
    field => !allowedQueryFields.has(field),
  );

  if (hasForbiddenQuery || request.body !== undefined) {
    throw httpError(
      400,
      'learning_card_source_input_forbidden',
      'Learning card source accepts only its track query.',
    );
  }

  requireTrack(request.query.track);
}

function assertSessionOwnedMembershipRequest(request, expectsBody) {
  const bodyIsValid = expectsBody
    ? isObject(request.body) && Object.keys(request.body).length === 0
    : request.body === undefined;
  if (Object.keys(request.query).length > 0 || !bodyIsValid) {
    throw httpError(
      400,
      'membership_identity_input_forbidden',
      'Membership authority comes from the active session.',
    );
  }
}

function assertPilotRoundContinueRequest(request) {
  if (Object.keys(request.query).length > 0 || request.body === undefined) {
    throw httpError(
      400,
      'pilot_round_authority_input_forbidden',
      'Pilot round continuation accepts only its exact command body.',
    );
  }
}

function assertContentManifestRequest(request) {
  const allowedQueryFields = new Set(['content_version', 'track']);
  const hasForbiddenQuery = Object.keys(request.query).some(
    field => !allowedQueryFields.has(field),
  );

  if (hasForbiddenQuery || request.body !== undefined) {
    throw httpError(
      400,
      'content_manifest_input_forbidden',
      'Content manifest accepts only track and content_version query fields.',
    );
  }
}

function createDefaultStore({pilotExpiresAt, pilotId, runtimeMode}) {
  const storeMode = process.env.SOFTBOOK_STORE_MODE ?? 'memory';

  if (storeMode === 'memory') {
    return createMemoryStore();
  }

  if (storeMode === 'cloudbase') {
    return createCloudBaseStore({pilotExpiresAt, pilotId, runtimeMode});
  }

  throw new Error(`Unsupported SOFTBOOK_STORE_MODE: ${storeMode}`);
}

function readContentManifestSignerFromEnv() {
  const keyId = process.env.SOFTBOOK_CONTENT_MANIFEST_KEY_ID;
  const privateKeyPem = process.env.SOFTBOOK_CONTENT_MANIFEST_PRIVATE_KEY_PEM;

  if (!keyId && !privateKeyPem) {
    return null;
  }

  if (!keyId || !privateKeyPem) {
    throw new Error(
      'Content manifest signing requires both key ID and Ed25519 private key.',
    );
  }

  return createContentManifestSigner(keyId, privateKeyPem);
}

function createDefaultContentAssetUrlResolver() {
  if ((process.env.SOFTBOOK_STORE_MODE ?? 'memory') !== 'cloudbase') {
    return null;
  }

  const app = createCloudBaseApp();

  return async ({asset, expiresAt, issuedAt}) => {
    const maxAge = Math.max(
      1,
      Math.floor((expiresAt.getTime() - issuedAt.getTime()) / 1000),
    );
    const result = await app.getTempFileURL({
      fileList: [{fileID: asset.storage_file_id, maxAge}],
    });
    const item = result.fileList?.[0];

    if (
      result.fileList?.length !== 1 ||
      item?.fileID !== asset.storage_file_id ||
      item.code ||
      !item.tempFileURL
    ) {
      throw httpError(
        503,
        'content_asset_delivery_unavailable',
        'CloudBase did not return the requested content asset URL.',
      );
    }

    return item.tempFileURL;
  };
}

function createMemoryStore() {
  const authStateStore = createMemoryAuthStateStore();
  const cardSources = new Map();
  const cardSourceVersions = new Map();
  const betaEntitlements = new Map();
  const memberships = new Map();
  const membershipRevisions = new Map();
  const dailyCheckIns = new Map();
  const dailyProgress = new Map();
  const learningEventCursors = new Map();
  const learningEvents = new Map();
  const learningEventSequences = new Map();
  const learningMigrationRevisions = new Map();
  const pilotRoundContinuations = new Map();
  const pilotEntitlements = new Map();
  const learningSessions = new Map();
  const learningStates = new Map();
  const spaceActionLineages = new Map();
  const spaceActions = new Map();
  const spaceStateRevisions = new Map();
  const spaceStates = new Map();
  const runLearningTransaction = createSerializedTransactionRunner();
  const runSpaceTransaction = createSerializedTransactionRunner();
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
      learningSessions,
      learningStates,
    },
    runTransaction: runLearningTransaction,
  });
  const accountDeletionWorker = createAccountDeletionWorkerV1({
    repository: createMemoryAccountDeletionRepository({
      ...authStateStore.snapshotAuth(),
      betaEntitlements,
      dailyCheckIns,
      dailyProgress,
      learningEventCursors,
      learningEvents,
      learningEventSequences,
      learningMigrationRevisions,
      learningSessions,
      learningStates,
      memberships,
      membershipRevisions,
      pilotEntitlements,
      pilotRoundContinuations,
      spaceActionLineages,
      spaceActions,
      spaceStateRevisions,
      spaceStates,
    }),
  });

  return {
    ...authStateStore,
    runAccountDeletionWorkerForTest: options =>
      accountDeletionWorker.run(options),
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
      const dailyCheckIn = options.accountKey
        ? normalizeStoredDailyCheckIn(
            dailyCheckIns.get(
              createAccountDailyProgressKey(options.accountKey, dayKey),
            ) ?? null,
            options.accountKey,
            dayKey,
          )
        : null;
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
      const legacyProgress = accountProgress
        ? null
        : dailyProgress.get(`${phoneNumber}:${dayKey}`) ?? null;
      const progress = cloneJson(
        accountProgress ?? legacyProgress ?? createEmptyDailyProgress(dayKey),
      );
      const sequence = options.accountKey
        ? learningEventSequences.get(
            createLearningEventSequenceId(options.accountKey),
          )
        : null;
      const legacyBaseline = deriveLegacyPendingReviewBaseline(
        [...dailyProgress.entries()]
          .filter(([key]) => key.startsWith(`${phoneNumber}:`))
          .map(([, value]) => value),
        [...learningStates.entries()]
          .filter(([key]) => key.startsWith(`${phoneNumber}:`))
          .map(([, value]) => value),
      );

      if (!sequence) {
        assertNoOrphanedLearningProjection(accountProgress, options.accountKey);
      }

      applyLearningSequencePendingReview(
        progress,
        sequence,
        options.accountKey,
        legacyBaseline.pendingReviewCount,
      );

      return {
        ...overlayDailyCheckIn(progress, dailyCheckIn),
        learning_authority: sequence
          ? 'account_events_v2'
          : legacyBaseline.hasLegacyAuthority
            ? 'legacy_account_baseline'
            : 'empty',
        component_revision: {
          check_in_revision: dailyCheckIn === null ? 0 : 1,
          learning_server_sequence:
            sequence?.last_server_sequence ?? 0,
        },
      };
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

      const sessionState =
        options.includeSchedulerState === true || !options.accountKey
          ? null
          : normalizeStoreLearningSession(
              learningSessions.get(
                createAccountLearningSessionKey(options.accountKey, track),
              ) ?? null,
              options.accountKey,
              track,
            );
      assertLearningSessionProjectionWatermark(sessionState, accountState);

      return {
        ...state,
        component_revision: {
          event_server_sequence:
            accountState?.projection_version === 'learning-events.v2'
              ? maximumLearningServerSequence(
                  accountState.events_by_card_id,
                )
              : 0,
          session_revision: sessionState?.revision ?? 0,
        },
        cursor:
          sessionState === null
            ? state.cursor ?? null
            : toBootstrapLearningCursor(sessionState),
        day_key: dayKey,
        track,
      };
    },
    getLearningSessionCursor: (accountKey, track) =>
      cloneJson(
        learningSessions.get(
          createAccountLearningSessionKey(accountKey, track),
        ) ?? null,
      ),
    confirmLearningSessionCursor: input =>
      runLearningTransaction(async () => {
        const key = createAccountLearningSessionKey(
          input.accountKey,
          input.track,
        );
        const current = normalizeStoreLearningSession(
          learningSessions.get(key) ?? null,
          input.accountKey,
          input.track,
        );

        return (
          current.revision === input.expectedRevision &&
          current.learning_acknowledged_at ===
            input.expectedLearningAcknowledgedAt &&
          current.learning_server_sequence ===
            input.expectedLearningServerSequence
        );
      }),
    getMembership: (phoneNumber, observedAt) => {
      const base = reconcileMemoryMembershipRevision(
        memberships,
        membershipRevisions,
        phoneNumber,
      );
      const normalized = expireMembershipIfNeeded(
        base.entitlement,
        observedAt,
      );
      if (normalized.changed) {
        saveMemoryMembership(
          memberships,
          membershipRevisions,
          phoneNumber,
          normalized.entitlement,
          normalized.observedAt,
          base.revision,
        );
      }

      return createCanonicalMembershipProjection({
        base: {
          entitlement: normalized.entitlement,
          observedAt: normalized.observedAt,
          revision: normalized.changed
            ? nextBaseMembershipRevision(base.revision)
            : base.revision,
          updatedAt: normalized.changed
            ? normalized.observedAt
            : base.document?.updated_at ?? null,
        },
        betaEntitlement: null,
        phoneNumber,
        pilotEntitlement: null,
        pilotExpiresAt: null,
        pilotId: null,
      });
    },
    startTrial: (phoneNumber, acknowledgedAt) => {
      const base = reconcileMemoryMembershipRevision(
        memberships,
        membershipRevisions,
        phoneNumber,
      );
      const current = cloneMembership(base.entitlement);

      if (current.stage === 'trial_available') {
        startCanonicalTrial(current, acknowledgedAt);
      }

      saveMemoryMembership(
        memberships,
        membershipRevisions,
        phoneNumber,
        current,
        acknowledgedAt,
        base.revision,
      );
      return serializeMembershipAt(current, acknowledgedAt);
    },
    activateTrialForLearningSession: input =>
      runLearningTransaction(async () => {
        const session = normalizeStoreLearningSession(
          learningSessions.get(
            createAccountLearningSessionKey(input.accountKey, input.track),
          ) ?? null,
          input.accountKey,
          input.track,
        );
        if (session.cursor?.selection_id !== input.selectionId) return null;
        const base = reconcileMemoryMembershipRevision(
          memberships,
          membershipRevisions,
          input.phoneNumber,
        );
        const current = cloneMembership(base.entitlement);
        const projection = createCanonicalMembershipProjection({
          base: {
            entitlement: current,
            observedAt: input.acknowledgedAt,
            revision: base.revision,
            updatedAt: base.document?.updated_at ?? null,
          },
          betaEntitlement: null,
          phoneNumber: input.phoneNumber,
          pilotEntitlement: null,
          pilotExpiresAt: null,
          pilotId: null,
        });
        if (
          !membershipProjectionMatchesExpected(
            projection,
            input.expectedMembership,
          )
        ) {
          return null;
        }
        const trialStarted = current.stage === 'trial_available';
        if (trialStarted) {
          startCanonicalTrial(current, input.acknowledgedAt);
          saveMemoryMembership(
            memberships,
            membershipRevisions,
            input.phoneNumber,
            current,
            input.acknowledgedAt,
            base.revision,
          );
        }
        return createCanonicalMembershipProjection({
          base: {
            entitlement: current,
            observedAt: input.acknowledgedAt,
            revision: trialStarted
              ? nextBaseMembershipRevision(base.revision)
              : base.revision,
            updatedAt: trialStarted
              ? input.acknowledgedAt
              : base.document?.updated_at ?? null,
          },
          betaEntitlement: null,
          phoneNumber: input.phoneNumber,
          pilotEntitlement: null,
          pilotExpiresAt: null,
          pilotId: null,
        });
      }),
    purchase: (phoneNumber, acknowledgedAt) => {
      const base = reconcileMemoryMembershipRevision(
        memberships,
        membershipRevisions,
        phoneNumber,
      );
      const current = cloneMembership(base.entitlement);
      current.last_experience_ended_by = null;
      current.recovery_prompt_visible = false;
      current.stage = 'premium';
      saveMemoryMembership(
        memberships,
        membershipRevisions,
        phoneNumber,
        current,
        acknowledgedAt,
        base.revision,
      );
      return serializeMembershipAt(current, acknowledgedAt);
    },
    dismissRecovery: (phoneNumber, acknowledgedAt) => {
      const base = reconcileMemoryMembershipRevision(
        memberships,
        membershipRevisions,
        phoneNumber,
      );
      const current = cloneMembership(base.entitlement);
      current.recovery_prompt_visible = false;
      saveMemoryMembership(
        memberships,
        membershipRevisions,
        phoneNumber,
        current,
        acknowledgedAt,
        base.revision,
      );
      return serializeMembershipAt(current, acknowledgedAt);
    },
    seedLegacyDailyProgressForMigrationTest: (
      phoneNumber,
      snapshot,
      acknowledgedAt,
    ) =>
      runLearningTransaction(async () => {
        dailyProgress.set(`${phoneNumber}:${snapshot.day_key}`, {
          acknowledged_at: acknowledgedAt,
          ...cloneJson(snapshot),
        });
      }),
    checkInDailyProgress: (
      _phoneNumber,
      dayKey,
      acknowledgedAt,
      options = {},
    ) =>
      runLearningTransaction(async () => {
        assertLearningWriteAccountKey(options.accountKey);
        const key = createAccountDailyProgressKey(
          options.accountKey,
          dayKey,
        );
        const current = normalizeStoredDailyCheckIn(
          dailyCheckIns.get(key) ?? null,
          options.accountKey,
          dayKey,
        );

        if (current) {
          return current;
        }

        const canonical = createDailyCheckInRecord(
          options.accountKey,
          dayKey,
          acknowledgedAt,
        );
        dailyCheckIns.set(key, canonical);
        return canonical;
      }),
    seedLegacyLearningStateForMigrationTest: (
      phoneNumber,
      snapshot,
      acknowledgedAt,
    ) =>
      runLearningTransaction(async () => {
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
      }),
    saveLearningSessionCursor: input =>
      runLearningTransaction(async () => {
        const key = createAccountLearningSessionKey(
          input.accountKey,
          input.track,
        );
        const current = normalizeStoreLearningSession(
          learningSessions.get(key) ?? null,
          input.accountKey,
          input.track,
        );

        if (
          current.revision !== input.expectedRevision ||
          current.learning_acknowledged_at !==
            input.learningAcknowledgedAt ||
          current.learning_server_sequence !== input.learningServerSequence
        ) {
          return false;
        }

        learningSessions.set(
          key,
          createNextLearningSessionState(current, input),
        );
        return true;
      }),
    getPilotRoundContinuation: input =>
      runLearningTransaction(async () =>
        cloneJson(
          pilotRoundContinuations.get(
            createPilotRoundContinuationKey(input),
          ) ?? null,
        ),
      ),
    savePilotRoundContinuation: input =>
      runLearningTransaction(async () => {
        const key = createPilotRoundContinuationKey(input);
        const existing = pilotRoundContinuations.get(key);
        if (existing) return cloneJson(existing);
        const acknowledgement = createStoredPilotRoundContinuation(input);
        pilotRoundContinuations.set(key, acknowledgement);
        return cloneJson(acknowledgement);
      }),
    commitLearningEvents,
    getSpaceState: (phoneNumber, dayKey, options = {}) =>
      runSpaceTransaction(async () => {
        assertLearningWriteAccountKey(options.accountKey);
        const stateKey = createSpaceStateId(options.accountKey);
        const revisionKey = createSpaceStateRevisionId(options.accountKey);
        const stored = spaceStates.get(stateKey);
        let state;
        let shouldStoreState = false;

        if (stored) {
          state = normalizeStoredSpaceState(stored, options.accountKey);
          shouldStoreState = Object.hasOwn(stored, 'revision');
        } else {
          const legacy = spaceStates.get(phoneNumber);
          state = migrateLegacySpaceDocuments(
            legacy ? [legacy] : [],
            options.accountKey,
            options.acknowledgedAt ?? new Date().toISOString(),
          );
          shouldStoreState = hasPersistedSpaceState(state);
        }

        const snapshot = inspectSpaceRevisionSnapshot({
          accountKey: options.accountKey,
          needsStateRewrite:
            stored !== undefined
              ? Object.hasOwn(stored, 'revision')
              : shouldStoreState,
          revision: spaceStateRevisions.get(revisionKey) ?? null,
          state,
          stateExists: stored !== undefined || shouldStoreState,
        });
        if (snapshot.needsCheckpoint) {
          const checkpoint = createSpaceRevisionCheckpoint({
            accountKey: options.accountKey,
            ledgers: [],
            previousActionBindings:
              snapshot.revision?.action_bindings ?? [],
            previousLineageDigest:
              snapshot.revision?.lineage_digest ?? null,
            revision: snapshot.nextRevision,
            state: snapshot.state,
          });
          snapshot.state.revision = checkpoint.head.revision;
          spaceStateRevisions.set(revisionKey, checkpoint.head);
          shouldStoreState = true;
        }
        if (shouldStoreState) {
          spaceStates.set(
            stateKey,
            toStoredSpaceState(snapshot.state, options.accountKey),
          );
        }

        return cloneSpaceState(snapshot.state);
      }),
    commitSpaceActions: input =>
      runSpaceTransaction(async () => {
        assertLearningWriteAccountKey(input.accountKey);
        const stateKey = createSpaceStateId(input.accountKey);
        const revisionKey = createSpaceStateRevisionId(input.accountKey);
        const stored = spaceStates.get(stateKey);
        const migrated =
          stored === undefined
            ? migrateLegacySpaceDocuments(
                spaceStates.has(input.phoneNumber)
                  ? [spaceStates.get(input.phoneNumber)]
                  : [],
                input.accountKey,
                input.acknowledgedAt,
              )
            : null;
        const snapshot = inspectSpaceRevisionSnapshot({
          accountKey: input.accountKey,
          needsStateRewrite:
            stored !== undefined
              ? Object.hasOwn(stored, 'revision')
              : hasPersistedSpaceState(migrated),
          revision: spaceStateRevisions.get(revisionKey) ?? null,
          state: stored ?? migrated,
          stateExists: stored !== undefined || hasPersistedSpaceState(migrated),
        });
        const ledgerByActionId = new Map(
          input.actions.map(action => [
            action.action_id,
            spaceActions.get(
              createSpaceActionLedgerId(
                input.accountKey,
                action.action_id,
              ),
            ) ?? null,
          ]),
        );
        const verifiedDuplicateActionIds = new Set();
        const recoveredLedgers = [];

        for (const action of input.actions) {
          const ledger = ledgerByActionId.get(action.action_id);
          if (ledger === null || ledger === undefined) continue;
          const lineage = spaceActionLineages.get(
            createSpaceActionLineageId(input.accountKey, action.action_id),
          );
          if (lineage) {
            assertSpaceActionLineageAuthority({
              accountKey: input.accountKey,
              actionId: action.action_id,
              ledger,
              lineage,
              revision: snapshot.revision,
            });
          } else {
            recoveredLedgers.push(
              assertRecoverablePreviousWriterLedger(
                ledger,
                snapshot.state,
                {accountKey: input.accountKey, actionId: action.action_id},
              ),
            );
          }
          verifiedDuplicateActionIds.add(action.action_id);
        }
        const prepared = prepareSpaceActionCommit({
          acknowledgedAt: input.acknowledgedAt,
          accountKey: input.accountKey,
          actions: input.actions,
          ledgerByActionId,
          state: snapshot.state,
          verifiedDuplicateActionIds,
        });

        const checkpointLedgers = [...recoveredLedgers, ...prepared.ledgers];
        const needsCheckpoint =
          snapshot.needsCheckpoint || checkpointLedgers.length > 0;
        if (needsCheckpoint) {
          prepared.state.revision = resolveSpaceCommitRevision({
            hasNewLedgers: prepared.ledgers.length > 0,
            recoveredLedgerCount: recoveredLedgers.length,
            snapshot,
          });
          const checkpoint = createSpaceRevisionCheckpoint({
            accountKey: input.accountKey,
            ledgers: checkpointLedgers,
            previousActionBindings:
              snapshot.revision?.action_bindings ?? [],
            previousLineageDigest:
              snapshot.revision?.lineage_digest ?? null,
            revision: prepared.state.revision,
            state: prepared.state,
          });
          spaceStateRevisions.set(revisionKey, checkpoint.head);
          checkpoint.lineages.forEach(lineage => {
            spaceActionLineages.set(
              createSpaceActionLineageId(
                input.accountKey,
                lineage.action_id,
              ),
              lineage,
            );
          });
        }

        prepared.ledgers.forEach(ledger => {
          spaceActions.set(
            createSpaceActionLedgerId(
              input.accountKey,
              ledger.action_id,
            ),
            ledger,
          );
        });

        if (
          prepared.ledgers.length > 0 ||
          snapshot.needsStateRewrite ||
          snapshot.needsCheckpoint
        ) {
          spaceStates.set(
            stateKey,
            toStoredSpaceState(prepared.state, input.accountKey),
          );
        }

        return {
          results: cloneJson(prepared.results),
          state: cloneSpaceState(prepared.state),
        };
      }),
    seedLegacySpaceStateForMigrationTest: (
      phoneNumber,
      snapshot,
      acknowledgedAt,
    ) =>
      runSpaceTransaction(async () => {
        spaceStates.set(phoneNumber, {
          acknowledged_at: acknowledgedAt,
          day_key: snapshot.day_key,
          phone_number: phoneNumber,
          states_by_card_id: Object.fromEntries(
            snapshot.states.map(state => [state.card_id, {...state}]),
          ),
        });
      }),
    snapshot: () => ({
      ...authStateStore.snapshotAuth(),
      betaEntitlements,
      cardSourceVersions,
      cardSources,
      dailyCheckIns,
      dailyProgress,
      learningEventCursors,
      learningEvents,
      learningEventSequences,
      learningMigrationRevisions,
      pilotRoundContinuations,
      pilotEntitlements,
      learningSessions,
      learningStates,
      memberships,
      membershipRevisions,
      spaceActionLineages,
      spaceActions,
      spaceStateRevisions,
      spaceStates,
    }),
  };
}

function createCloudBaseStore(options = {}) {
  const db = options.db ?? createCloudBaseDatabase();
  const runtimeMode = options.runtimeMode ?? 'development';
  const pilotId = options.pilotId ?? null;
  const pilotExpiresAt = options.pilotExpiresAt ?? null;
  const authStateStore = createCloudBaseAuthStateStore(
    db,
    CLOUDBASE_COLLECTIONS,
  );
  const cardSources = db.collection(CLOUDBASE_COLLECTIONS.cardSources);
  const betaEntitlements = db.collection(CLOUDBASE_COLLECTIONS.betaEntitlements);
  const pilotEntitlements = db.collection(CLOUDBASE_COLLECTIONS.pilotEntitlements);
  const memberships = db.collection(CLOUDBASE_COLLECTIONS.memberships);
  const membershipRevisions = db.collection(
    CLOUDBASE_COLLECTIONS.membershipRevisions,
  );
  const dailyCheckIns = db.collection(CLOUDBASE_COLLECTIONS.dailyCheckIns);
  const dailyProgress = db.collection(CLOUDBASE_COLLECTIONS.dailyProgress);
  const learningEventSequences = db.collection(
    CLOUDBASE_COLLECTIONS.learningEventSequences,
  );
  const pilotRoundContinuations = db.collection(
    CLOUDBASE_COLLECTIONS.pilotRoundContinuations,
  );
  const learningSessions = db.collection(CLOUDBASE_COLLECTIONS.learningSessions);
  const learningStates = db.collection(CLOUDBASE_COLLECTIONS.learningStates);
  const spaceActionLineages = db.collection(
    CLOUDBASE_COLLECTIONS.spaceActionLineages,
  );
  const spaceActions = db.collection(CLOUDBASE_COLLECTIONS.spaceActions);
  const spaceStateRevisions = db.collection(
    CLOUDBASE_COLLECTIONS.spaceStateRevisions,
  );
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
      const [legacyProgressDocuments, legacyLearningStates] =
        await Promise.all([
          listCloudBaseDocumentsByQuery(
            dailyProgress,
            {phone_number: phoneNumber},
            LEGACY_LEARNING_QUERY_PAGE_SIZE,
            LEGACY_LEARNING_QUERY_MAX_DOCUMENTS,
          ),
          listCloudBaseDocumentsByQuery(
            learningStates,
            {phone_number: phoneNumber},
            LEGACY_LEARNING_QUERY_PAGE_SIZE,
            LEGACY_LEARNING_QUERY_MAX_DOCUMENTS,
          ),
        ]);
      const legacyBaseline = deriveLegacyPendingReviewBaseline(
        legacyProgressDocuments,
        legacyLearningStates,
      );

      return db.runTransaction(async transaction => {
        const transactionDailyCheckIns = transaction.collection(
          CLOUDBASE_COLLECTIONS.dailyCheckIns,
        );
        const transactionDailyProgress = transaction.collection(
          CLOUDBASE_COLLECTIONS.dailyProgress,
        );
        const transactionLearningEventSequences = transaction.collection(
          CLOUDBASE_COLLECTIONS.learningEventSequences,
        );
        const dailyCheckIn = options.accountKey
          ? normalizeStoredDailyCheckIn(
              await getCloudBaseDocument(
                transactionDailyCheckIns,
                createAccountDailyProgressId(options.accountKey, dayKey),
              ),
              options.accountKey,
              dayKey,
            )
          : null;
        const accountProgress = options.accountKey
          ? await getCloudBaseDocument(
              transactionDailyProgress,
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
              transactionDailyProgress,
              createCloudBaseDocumentId(`${phoneNumber}:${dayKey}`),
            );
        const progress =
          accountProgress ??
          legacyProgress ??
          createEmptyDailyProgress(dayKey);
        const sequence = options.accountKey
          ? await getCloudBaseDocument(
              transactionLearningEventSequences,
              createLearningEventSequenceId(options.accountKey),
            )
          : null;

        if (!sequence) {
          assertNoOrphanedLearningProjection(
            accountProgress,
            options.accountKey,
          );
        }

        applyLearningSequencePendingReview(
          progress,
          sequence,
          options.accountKey,
          legacyBaseline.pendingReviewCount,
        );

        return {
          ...overlayDailyCheckIn(progress, dailyCheckIn),
          learning_authority: sequence
            ? 'account_events_v2'
            : legacyBaseline.hasLegacyAuthority
              ? 'legacy_account_baseline'
              : 'empty',
          component_revision: {
            check_in_revision: dailyCheckIn === null ? 0 : 1,
            learning_server_sequence:
              sequence?.last_server_sequence ?? 0,
          },
        };
      });
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
      const sessionDocument =
        options.includeSchedulerState !== true && options.accountKey
        ? await getCloudBaseDocument(
            learningSessions,
            createAccountLearningSessionId(options.accountKey, track),
          )
        : null;
      const sessionState =
        options.includeSchedulerState === true || !options.accountKey
          ? null
          : normalizeStoreLearningSession(
              sessionDocument,
              options.accountKey,
              track,
            );
      assertLearningSessionProjectionWatermark(sessionState, accountState);

      return {
        ...state,
        component_revision: {
          event_server_sequence:
            accountState?.projection_version === 'learning-events.v2'
              ? maximumLearningServerSequence(
                  accountState.events_by_card_id,
                )
              : 0,
          session_revision: sessionState?.revision ?? 0,
        },
        cursor:
          sessionState === null
            ? state.cursor ?? null
            : toBootstrapLearningCursor(sessionState),
        day_key: dayKey,
        track,
      };
    },
    getLearningSessionCursor: async (accountKey, track) => {
      const document = await getCloudBaseDocument(
        learningSessions,
        createAccountLearningSessionId(accountKey, track),
      );

      if (!isObject(document) || !Object.hasOwn(document, '_id')) {
        return document;
      }

      const value = {...document};
      delete value._id;
      return value;
    },
    confirmLearningSessionCursor: input =>
      db.runTransaction(async transaction => {
        const transactionSessions = transaction.collection(
          CLOUDBASE_COLLECTIONS.learningSessions,
        );
        const documentId = createAccountLearningSessionId(
          input.accountKey,
          input.track,
        );
        const current = normalizeStoreLearningSession(
          await getCloudBaseDocument(transactionSessions, documentId),
          input.accountKey,
          input.track,
        );

        if (
          current.revision !== input.expectedRevision ||
          current.learning_acknowledged_at !==
            input.expectedLearningAcknowledgedAt ||
          current.learning_server_sequence !==
            input.expectedLearningServerSequence
        ) {
          return false;
        }

        await setCloudBaseDocument(
          transactionSessions,
          documentId,
          current,
        );
        return true;
      }),
    applyPilotEntitlementCommand: command =>
      db.runTransaction(async transaction => {
        if (runtimeMode !== 'controlled_pilot' || command.pilot_id !== pilotId) {
          throw new PilotEntitlementError(
            'pilot entitlement command does not match this runtime.',
          );
        }
        const transactionMemberships = transaction.collection(
          CLOUDBASE_COLLECTIONS.memberships,
        );
        const transactionBetaEntitlements = transaction.collection(
          CLOUDBASE_COLLECTIONS.betaEntitlements,
        );
        const transactionPilotEntitlements = transaction.collection(
          CLOUDBASE_COLLECTIONS.pilotEntitlements,
        );
        const membershipDocument = await getCloudBaseDocument(
          transactionMemberships,
          command.phone_number,
        );
        const betaEntitlement = await getCloudBaseDocument(
          transactionBetaEntitlements,
          command.phone_number,
        );
        const pilotEntitlement = await getCloudBaseDocument(
          transactionPilotEntitlements,
          command.phone_number,
        );
        const baseMembership = membershipDocument
          ? deserializeMembershipDocument(membershipDocument)
          : createInitialMembership();
        const canonicalMembership = applyBetaEntitlement(
          baseMembership,
          betaEntitlement,
          command.phone_number,
        );
        const plan = planPilotEntitlementMutation(
          command,
          pilotEntitlement,
          canonicalMembership,
        );
        if (plan.changed) {
          await setCloudBaseDocument(
            transactionPilotEntitlements,
            command.phone_number,
            plan.document,
          );
        }
        return publicPilotEntitlementPlan(plan);
      }),
    getMembership: async (phoneNumber, observedAt) => {
      const [base, betaEntitlement, pilotEntitlement] = await Promise.all([
        db.runTransaction(async transaction => {
          const transactionMemberships = transaction.collection(
            CLOUDBASE_COLLECTIONS.memberships,
          );
          const transactionMembershipRevisions = transaction.collection(
            CLOUDBASE_COLLECTIONS.membershipRevisions,
          );
          const current = await getCloudBaseMembershipRecord(
            transactionMemberships,
            transactionMembershipRevisions,
            phoneNumber,
          );
          const normalized = expireMembershipIfNeeded(
            current.entitlement,
            observedAt,
          );
          if (normalized.changed) {
            await saveCloudBaseMembership(
              transactionMemberships,
              transactionMembershipRevisions,
              phoneNumber,
              normalized.entitlement,
              normalized.observedAt,
              current.revision,
            );
          }
          return {
            ...current,
            entitlement: normalized.entitlement,
            observedAt: normalized.observedAt,
            revision: normalized.changed
              ? nextBaseMembershipRevision(current.revision)
              : current.revision,
            updatedAt: normalized.changed
              ? normalized.observedAt
              : current.document?.updated_at ?? null,
          };
        }),
        getCloudBaseDocument(betaEntitlements, phoneNumber),
        runtimeMode === 'controlled_pilot'
          ? getCloudBaseDocument(pilotEntitlements, phoneNumber)
          : null,
      ]);

      return createCanonicalMembershipProjection({
        base,
        betaEntitlement,
        phoneNumber,
        pilotEntitlement,
        pilotExpiresAt,
        pilotId,
      });
    },
    startTrial: (phoneNumber, acknowledgedAt) =>
      db.runTransaction(async transaction => {
        const transactionMemberships = transaction.collection(
          CLOUDBASE_COLLECTIONS.memberships,
        );
        const transactionMembershipRevisions = transaction.collection(
          CLOUDBASE_COLLECTIONS.membershipRevisions,
        );
        const base = await getCloudBaseMembershipRecord(
          transactionMemberships,
          transactionMembershipRevisions,
          phoneNumber,
        );
        const current = cloneMembership(base.entitlement);

        if (current.stage === 'trial_available') {
          startCanonicalTrial(current, acknowledgedAt);
        }

        await saveCloudBaseMembership(
          transactionMemberships,
          transactionMembershipRevisions,
          phoneNumber,
          current,
          acknowledgedAt,
          base.revision,
        );
        return serializeMembershipAt(current, acknowledgedAt);
      }),
    activateTrialForLearningSession: input =>
      db.runTransaction(async transaction => {
        const transactionSessions = transaction.collection(
          CLOUDBASE_COLLECTIONS.learningSessions,
        );
        const session = normalizeStoreLearningSession(
          await getCloudBaseDocument(
            transactionSessions,
            createAccountLearningSessionId(input.accountKey, input.track),
          ),
          input.accountKey,
          input.track,
        );
        if (session.cursor?.selection_id !== input.selectionId) return null;
        const transactionBetaEntitlements = transaction.collection(
          CLOUDBASE_COLLECTIONS.betaEntitlements,
        );
        const transactionPilotEntitlements = transaction.collection(
          CLOUDBASE_COLLECTIONS.pilotEntitlements,
        );
        const [betaEntitlement, pilotEntitlement] = await Promise.all([
          getCloudBaseDocument(
            transactionBetaEntitlements,
            input.phoneNumber,
          ),
          runtimeMode === 'controlled_pilot'
            ? getCloudBaseDocument(
                transactionPilotEntitlements,
                input.phoneNumber,
              )
            : null,
        ]);
        const transactionMemberships = transaction.collection(
          CLOUDBASE_COLLECTIONS.memberships,
        );
        const transactionMembershipRevisions = transaction.collection(
          CLOUDBASE_COLLECTIONS.membershipRevisions,
        );
        const base = await getCloudBaseMembershipRecord(
          transactionMemberships,
          transactionMembershipRevisions,
          input.phoneNumber,
        );
        const current = cloneMembership(base.entitlement);
        const projection = createCanonicalMembershipProjection({
          base: {
            ...base,
            observedAt: input.acknowledgedAt,
            updatedAt: base.document?.updated_at ?? null,
          },
          betaEntitlement,
          phoneNumber: input.phoneNumber,
          pilotEntitlement,
          pilotExpiresAt,
          pilotId,
        });
        if (
          !membershipProjectionMatchesExpected(
            projection,
            input.expectedMembership,
          )
        ) {
          return null;
        }
        const trialStarted = current.stage === 'trial_available';
        if (trialStarted) {
          startCanonicalTrial(current, input.acknowledgedAt);
          await saveCloudBaseMembership(
            transactionMemberships,
            transactionMembershipRevisions,
            input.phoneNumber,
            current,
            input.acknowledgedAt,
            base.revision,
          );
        }
        return createCanonicalMembershipProjection({
          base: {
            ...base,
            entitlement: current,
            observedAt: input.acknowledgedAt,
            revision: trialStarted
              ? nextBaseMembershipRevision(base.revision)
              : base.revision,
            updatedAt: trialStarted
              ? input.acknowledgedAt
              : base.document?.updated_at ?? null,
          },
          betaEntitlement,
          phoneNumber: input.phoneNumber,
          pilotEntitlement,
          pilotExpiresAt,
          pilotId,
        });
      }),
    purchase: (phoneNumber, acknowledgedAt) =>
      db.runTransaction(async transaction => {
        const transactionMemberships = transaction.collection(
          CLOUDBASE_COLLECTIONS.memberships,
        );
        const transactionMembershipRevisions = transaction.collection(
          CLOUDBASE_COLLECTIONS.membershipRevisions,
        );
        const base = await getCloudBaseMembershipRecord(
          transactionMemberships,
          transactionMembershipRevisions,
          phoneNumber,
        );
        const current = cloneMembership(base.entitlement);
        current.last_experience_ended_by = null;
        current.recovery_prompt_visible = false;
        current.stage = 'premium';
        await saveCloudBaseMembership(
          transactionMemberships,
          transactionMembershipRevisions,
          phoneNumber,
          current,
          acknowledgedAt,
          base.revision,
        );
        return serializeMembershipAt(current, acknowledgedAt);
      }),
    dismissRecovery: (phoneNumber, acknowledgedAt) =>
      db.runTransaction(async transaction => {
        const transactionMemberships = transaction.collection(
          CLOUDBASE_COLLECTIONS.memberships,
        );
        const transactionMembershipRevisions = transaction.collection(
          CLOUDBASE_COLLECTIONS.membershipRevisions,
        );
        const base = await getCloudBaseMembershipRecord(
          transactionMemberships,
          transactionMembershipRevisions,
          phoneNumber,
        );
        const current = cloneMembership(base.entitlement);
        current.recovery_prompt_visible = false;
        await saveCloudBaseMembership(
          transactionMemberships,
          transactionMembershipRevisions,
          phoneNumber,
          current,
          acknowledgedAt,
          base.revision,
        );
        return serializeMembershipAt(current, acknowledgedAt);
      }),
    seedLegacyDailyProgressForMigrationTest: (
      phoneNumber,
      snapshot,
      acknowledgedAt,
    ) =>
      setCloudBaseDocument(
        dailyProgress,
        createCloudBaseDocumentId(`${phoneNumber}:${snapshot.day_key}`),
        {
          acknowledged_at: acknowledgedAt,
          phone_number: phoneNumber,
          ...cloneJson(snapshot),
        },
      ),
    checkInDailyProgress: async (
      _phoneNumber,
      dayKey,
      acknowledgedAt,
      options = {},
    ) =>
      db.runTransaction(async transaction => {
        assertLearningWriteAccountKey(options.accountKey);
        const transactionCheckIns = transaction.collection(
          CLOUDBASE_COLLECTIONS.dailyCheckIns,
        );
        const documentId = createAccountDailyProgressId(
          options.accountKey,
          dayKey,
        );
        const current = normalizeStoredDailyCheckIn(
          await getCloudBaseDocument(transactionCheckIns, documentId),
          options.accountKey,
          dayKey,
        );

        if (current) {
          return current;
        }

        const canonical = createDailyCheckInRecord(
          options.accountKey,
          dayKey,
          acknowledgedAt,
        );
        await setCloudBaseDocument(
          transactionCheckIns,
          documentId,
          canonical,
        );
        return canonical;
      }),
    seedLegacyLearningStateForMigrationTest: async (
      phoneNumber,
      snapshot,
      acknowledgedAt,
    ) =>
      db.runTransaction(async transaction => {
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
      }),
    saveLearningSessionCursor: input =>
      db.runTransaction(async transaction => {
        const transactionSessions = transaction.collection(
          CLOUDBASE_COLLECTIONS.learningSessions,
        );
        const documentId = createAccountLearningSessionId(
          input.accountKey,
          input.track,
        );
        const current = normalizeStoreLearningSession(
          await getCloudBaseDocument(transactionSessions, documentId),
          input.accountKey,
          input.track,
        );

        if (
          current.revision !== input.expectedRevision ||
          current.learning_acknowledged_at !==
            input.learningAcknowledgedAt ||
          current.learning_server_sequence !== input.learningServerSequence
        ) {
          return false;
        }

        await setCloudBaseDocument(
          transactionSessions,
          documentId,
          createNextLearningSessionState(current, input),
        );
        return true;
      }),
    getPilotRoundContinuation: async input => {
      const document = await getCloudBaseDocument(
        pilotRoundContinuations,
        createPilotRoundContinuationId(input),
      );
      if (!isObject(document) || !Object.hasOwn(document, '_id')) {
        return document;
      }
      const value = {...document};
      delete value._id;
      return value;
    },
    savePilotRoundContinuation: input =>
      db.runTransaction(async transaction => {
        const collection = transaction.collection(
          CLOUDBASE_COLLECTIONS.pilotRoundContinuations,
        );
        const documentId = createPilotRoundContinuationId(input);
        const existing = await getCloudBaseDocument(collection, documentId);
        if (existing) {
          const value = {...existing};
          delete value._id;
          return value;
        }
        const acknowledgement = createStoredPilotRoundContinuation(input);
        await setCloudBaseDocument(collection, documentId, acknowledgement);
        return acknowledgement;
      }),
    commitLearningEvents,
    getSpaceState: async (phoneNumber, dayKey, options = {}) => {
      assertLearningWriteAccountKey(options.accountKey);
      const stateId = createSpaceStateId(options.accountKey);
      const revisionId = createSpaceStateRevisionId(options.accountKey);
      const existing = await getCloudBaseDocument(spaceStates, stateId);
      const legacyDocuments = existing
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
        const transactionSpaceStateRevisions = transaction.collection(
          CLOUDBASE_COLLECTIONS.spaceStateRevisions,
        );
        const storedState = await getCloudBaseDocument(
          transactionSpaceStates,
          stateId,
        );
        const storedRevision = await getCloudBaseDocument(
          transactionSpaceStateRevisions,
          revisionId,
        );
        const state = storedState
          ? normalizeStoredSpaceState(
              storedState,
              options.accountKey,
            )
          : migrateLegacySpaceDocuments(
              legacyDocuments,
              options.accountKey,
              options.acknowledgedAt ?? new Date().toISOString(),
            );
        const stateExists =
          storedState !== null || hasPersistedSpaceState(state);
        const snapshot = inspectSpaceRevisionSnapshot({
          accountKey: options.accountKey,
          needsStateRewrite:
            storedState !== null
              ? Object.hasOwn(storedState, 'revision')
              : stateExists,
          revision: storedRevision,
          state,
          stateExists,
        });
        let shouldStoreState =
          (storedState !== null && Object.hasOwn(storedState, 'revision')) ||
          (storedState === null && stateExists);

        if (snapshot.needsCheckpoint) {
          const checkpoint = createSpaceRevisionCheckpoint({
            accountKey: options.accountKey,
            ledgers: [],
            previousActionBindings:
              snapshot.revision?.action_bindings ?? [],
            previousLineageDigest:
              snapshot.revision?.lineage_digest ?? null,
            revision: snapshot.nextRevision,
            state: snapshot.state,
          });
          snapshot.state.revision = checkpoint.head.revision;
          await setCloudBaseDocument(
            transactionSpaceStateRevisions,
            revisionId,
            checkpoint.head,
          );
          shouldStoreState = true;
        }
        if (shouldStoreState) {
          await setCloudBaseDocument(
            transactionSpaceStates,
            stateId,
            toStoredSpaceState(snapshot.state, options.accountKey),
          );
        }

        return cloneSpaceState(snapshot.state);
      });
    },
    commitSpaceActions: async input => {
      assertLearningWriteAccountKey(input.accountKey);
      const stateId = createSpaceStateId(input.accountKey);
      const canonical = await getCloudBaseDocument(spaceStates, stateId);
      const legacyDocuments = canonical
        ? []
        : await listCloudBaseDocumentsByQuery(
            spaceStates,
            {phone_number: input.phoneNumber},
            LEGACY_SPACE_QUERY_PAGE_SIZE,
            LEGACY_SPACE_QUERY_MAX_DOCUMENTS,
          );

      return db.runTransaction(async transaction => {
        const transactionSpaceActionLineages = transaction.collection(
          CLOUDBASE_COLLECTIONS.spaceActionLineages,
        );
        const transactionSpaceActions = transaction.collection(
          CLOUDBASE_COLLECTIONS.spaceActions,
        );
        const transactionSpaceStateRevisions = transaction.collection(
          CLOUDBASE_COLLECTIONS.spaceStateRevisions,
        );
        const transactionSpaceStates = transaction.collection(
          CLOUDBASE_COLLECTIONS.spaceStates,
        );
        const storedState = await getCloudBaseDocument(
          transactionSpaceStates,
          stateId,
        );
        const revisionId = createSpaceStateRevisionId(input.accountKey);
        const storedRevision = await getCloudBaseDocument(
          transactionSpaceStateRevisions,
          revisionId,
        );
        const state =
          storedState ??
          migrateLegacySpaceDocuments(
            legacyDocuments,
            input.accountKey,
            input.acknowledgedAt,
          );
        const snapshot = inspectSpaceRevisionSnapshot({
          accountKey: input.accountKey,
          needsStateRewrite:
            storedState !== null
              ? Object.hasOwn(storedState, 'revision')
              : hasPersistedSpaceState(state),
          revision: storedRevision,
          state,
          stateExists:
            storedState !== null || hasPersistedSpaceState(state),
        });
        const ledgerByActionId = new Map();
        const verifiedDuplicateActionIds = new Set();
        const recoveredLedgers = [];

        for (const action of input.actions) {
          const ledger = await getCloudBaseDocument(
            transactionSpaceActions,
            createSpaceActionLedgerId(
              input.accountKey,
              action.action_id,
            ),
          );
          ledgerByActionId.set(action.action_id, ledger);
          if (ledger === null) continue;
          const lineage = await getCloudBaseDocument(
            transactionSpaceActionLineages,
            createSpaceActionLineageId(
              input.accountKey,
              action.action_id,
            ),
          );
          if (lineage) {
            assertSpaceActionLineageAuthority({
              accountKey: input.accountKey,
              actionId: action.action_id,
              ledger,
              lineage,
              revision: snapshot.revision,
            });
          } else {
            recoveredLedgers.push(
              assertRecoverablePreviousWriterLedger(
                ledger,
                snapshot.state,
                {accountKey: input.accountKey, actionId: action.action_id},
              ),
            );
          }
          verifiedDuplicateActionIds.add(action.action_id);
        }

        const prepared = prepareSpaceActionCommit({
          acknowledgedAt: input.acknowledgedAt,
          accountKey: input.accountKey,
          actions: input.actions,
          ledgerByActionId,
          state: snapshot.state,
          verifiedDuplicateActionIds,
        });

        const checkpointLedgers = [...recoveredLedgers, ...prepared.ledgers];
        const needsCheckpoint =
          snapshot.needsCheckpoint || checkpointLedgers.length > 0;
        if (needsCheckpoint) {
          prepared.state.revision = resolveSpaceCommitRevision({
            hasNewLedgers: prepared.ledgers.length > 0,
            recoveredLedgerCount: recoveredLedgers.length,
            snapshot,
          });
          const checkpoint = createSpaceRevisionCheckpoint({
            accountKey: input.accountKey,
            ledgers: checkpointLedgers,
            previousActionBindings:
              snapshot.revision?.action_bindings ?? [],
            previousLineageDigest:
              snapshot.revision?.lineage_digest ?? null,
            revision: prepared.state.revision,
            state: prepared.state,
          });
          await setCloudBaseDocument(
            transactionSpaceStateRevisions,
            revisionId,
            checkpoint.head,
          );
          for (const lineage of checkpoint.lineages) {
            await setCloudBaseDocument(
              transactionSpaceActionLineages,
              createSpaceActionLineageId(
                input.accountKey,
                lineage.action_id,
              ),
              lineage,
            );
          }
        }

        for (const ledger of prepared.ledgers) {
          await setCloudBaseDocument(
            transactionSpaceActions,
            createSpaceActionLedgerId(
              input.accountKey,
              ledger.action_id,
            ),
            ledger,
          );
        }

        if (
          prepared.ledgers.length > 0 ||
          snapshot.needsStateRewrite ||
          snapshot.needsCheckpoint
        ) {
          await setCloudBaseDocument(
            transactionSpaceStates,
            stateId,
            toStoredSpaceState(prepared.state, input.accountKey),
          );
        }

        return {
          results: cloneJson(prepared.results),
          state: cloneSpaceState(prepared.state),
        };
      });
    },
    seedLegacySpaceStateForMigrationTest: (
      phoneNumber,
      snapshot,
      acknowledgedAt,
    ) =>
      setCloudBaseDocument(
        spaceStates,
        createCloudBaseDocumentId(
          `${phoneNumber}:${snapshot.day_key}`,
        ),
        {
          acknowledged_at: acknowledgedAt,
          day_key: snapshot.day_key,
          phone_number: phoneNumber,
          states_by_card_id: Object.fromEntries(
            snapshot.states.map(state => [state.card_id, {...state}]),
          ),
        },
      ),
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

function createDailyCheckInRecord(accountKey, dayKey, acknowledgedAt) {
  return {
    acknowledged_at: requireIsoTimestamp(
      acknowledgedAt,
      'daily check-in acknowledged_at',
    ),
    account_key: accountKey,
    checked_in_today: true,
    day_key: dayKey,
    schema_version: 'daily-check-in.v2',
  };
}

function normalizeStoredDailyCheckIn(value, expectedAccountKey, expectedDayKey) {
  if (value === null || value === undefined) {
    return null;
  }

  let storedValue = value;

  if (isObject(value) && Object.hasOwn(value, '_id')) {
    storedValue = {...value};
    delete storedValue._id;
  }

  const keys = isObject(storedValue)
    ? Object.keys(storedValue).sort()
    : [];

  if (
    !isObject(storedValue) ||
    keys.length !== DAILY_CHECK_IN_DOCUMENT_KEYS.length ||
    keys.some(
      (key, index) => key !== DAILY_CHECK_IN_DOCUMENT_KEYS[index],
    ) ||
    storedValue.schema_version !== 'daily-check-in.v2' ||
    storedValue.account_key !== expectedAccountKey ||
    storedValue.day_key !== expectedDayKey ||
    storedValue.checked_in_today !== true ||
    typeof storedValue.acknowledged_at !== 'string' ||
    !Number.isFinite(Date.parse(storedValue.acknowledged_at))
  ) {
    throw dailyCheckInProjectionInvalidError(
      'The canonical daily check-in is invalid.',
    );
  }

  return {
    acknowledged_at: storedValue.acknowledged_at,
    account_key: storedValue.account_key,
    checked_in_today: true,
    day_key: storedValue.day_key,
    schema_version: storedValue.schema_version,
  };
}

function overlayDailyCheckIn(progress, dailyCheckIn) {
  if (dailyCheckIn === null) {
    return progress;
  }

  const acknowledgedAt =
    progress.acknowledged_at === null ||
    Date.parse(dailyCheckIn.acknowledged_at) >
      Date.parse(progress.acknowledged_at)
      ? dailyCheckIn.acknowledged_at
      : progress.acknowledged_at;

  return {
    ...progress,
    acknowledged_at: acknowledgedAt,
    checked_in_today: true,
  };
}

function dailyCheckInProjectionInvalidError(message) {
  return httpError(500, 'daily_check_in_projection_invalid', message);
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
  legacyPendingReviewCount = 0,
) {
  if (sequence === null || sequence === undefined) {
    if (
      !Number.isSafeInteger(legacyPendingReviewCount) ||
      legacyPendingReviewCount < 0
    ) {
      throw learningProjectionInvalidError(
        'The legacy pending-review baseline is invalid.',
      );
    }
    progress.pending_review_count = legacyPendingReviewCount;
    return;
  }

  assertLearningSequenceMetadata(sequence, expectedAccountKey);
  progress.pending_review_count = sequence.pending_review_count;
}

function deriveLegacyPendingReviewBaseline(
  legacyProgressDocuments,
  legacyLearningStates,
) {
  try {
    return deriveLegacyPendingReviewBaselineUnchecked(
      legacyProgressDocuments,
      legacyLearningStates,
    );
  } catch (_error) {
    throw httpError(
      500,
      'invalid_canonical_state',
      'The legacy pending-review baseline is invalid.',
    );
  }
}

function deriveLegacyPendingReviewBaselineUnchecked(
  legacyProgressDocuments,
  legacyLearningStates,
) {
  let latestProgress = null;
  let latestOrderKey = null;

  for (const value of legacyProgressDocuments) {
    if (!isObject(value) || !isValidDayKey(value.day_key)) {
      throw learningProjectionInvalidError(
        'A legacy daily progress baseline is invalid.',
      );
    }

    const progress = normalizeStoredDailyProgress(value, value.day_key, null);
    const observedAt =
      progress.acknowledged_at ?? `${progress.day_key}T00:00:00.000Z`;
    const orderKey = `${observedAt}:${progress.day_key}`;
    if (latestOrderKey === null || orderKey > latestOrderKey) {
      latestOrderKey = orderKey;
      latestProgress = progress;
    }
  }

  return {
    hasLegacyAuthority:
      legacyProgressDocuments.length > 0 || legacyLearningStates.length > 0,
    pendingReviewCount:
      latestProgress?.pending_review_count ??
      countLegacyPendingReview(legacyLearningStates),
  };
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
    projection.scheduler_version !== SCHEDULER_POLICY_VERSION ||
    !isObject(projection.scheduler_by_card_id) ||
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

  try {
    normalizeSchedulerProjection(projection);
  } catch (error) {
    throw learningProjectionInvalidError(
      `The account scheduler projection is invalid: ${error.message}`,
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

function normalizeStoreLearningSession(value, accountKey, track) {
  try {
    let storedValue = value;

    if (isObject(value) && Object.hasOwn(value, '_id')) {
      storedValue = {...value};
      delete storedValue._id;
    }

    return normalizeLearningSessionState(storedValue, {accountKey, track});
  } catch (error) {
    throw learningProjectionInvalidError(
      `The account learning session is invalid: ${error.message}`,
    );
  }
}

function assertLearningSessionProjectionWatermark(
  sessionState,
  learningProjection,
) {
  if (sessionState === null) {
    return;
  }

  const expectedAcknowledgedAt =
    learningProjection?.projection_version === 'learning-events.v2'
      ? learningProjection.acknowledged_at
      : null;
  const expectedServerSequence =
    learningProjection?.projection_version === 'learning-events.v2'
      ? maximumLearningServerSequence(learningProjection.events_by_card_id)
      : 0;

  if (
    sessionState.learning_acknowledged_at !== expectedAcknowledgedAt ||
    sessionState.learning_server_sequence !== expectedServerSequence
  ) {
    throw learningProjectionInvalidError(
      'The account learning session projection watermark is stale.',
    );
  }
}

function createNextLearningSessionState(current, input) {
  if (current.revision === Number.MAX_SAFE_INTEGER) {
    throw learningProjectionInvalidError(
      'The account learning session revision is exhausted.',
    );
  }

  return normalizeStoreLearningSession(
    {
      account_key: input.accountKey,
      cursor: input.cursor === null ? null : cloneJson(input.cursor),
      learning_acknowledged_at: input.learningAcknowledgedAt,
      learning_server_sequence: input.learningServerSequence,
      revision: current.revision + 1,
      track: input.track,
      updated_at: input.updatedAt,
    },
    input.accountKey,
    input.track,
  );
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
    const page = normalizeCloudBaseDocuments(result.data);
    documents.push(...page);

    if (documents.length > maximumCount) {
      throw httpError(
        500,
        'invalid_canonical_state',
        'Legacy migration exceeds the supported bound.',
      );
    }

    if (page.length < pageSize) {
      return documents;
    }
  }
}

function createCloudBaseDatabase() {
  return createCloudBaseApp().database();
}

function createCloudBaseApp() {
  const cloudbase = require('@cloudbase/node-sdk');
  const env =
    process.env.CLOUDBASE_ENV_ID ??
    process.env.TCB_ENV ??
    process.env.SCF_NAMESPACE ??
    cloudbase.SYMBOL_CURRENT_ENV;

  return cloudbase.init({env});
}

async function getCloudBaseMembershipRecord(
  membershipCollection,
  revisionCollection,
  phoneNumber,
) {
  const existing = await getCloudBaseDocument(
    membershipCollection,
    phoneNumber,
  );
  const storedRevision = await getCloudBaseDocument(
    revisionCollection,
    phoneNumber,
  );
  const reconciled = reconcileBaseMembershipRevision(
    existing,
    storedRevision,
    phoneNumber,
  );

  if (reconciled.sidecarToWrite) {
    await setCloudBaseDocument(
      revisionCollection,
      phoneNumber,
      reconciled.sidecarToWrite,
    );
  }

  return reconciled;
}

async function saveCloudBaseMembership(
  membershipCollection,
  revisionCollection,
  phoneNumber,
  membership,
  acknowledgedAt,
  currentRevision,
) {
  const document = {
    entitlement: membership,
    phone_number: phoneNumber,
    updated_at: acknowledgedAt,
  };
  const revision = nextBaseMembershipRevision(currentRevision);

  await setCloudBaseDocument(membershipCollection, phoneNumber, document);
  await setCloudBaseDocument(
    revisionCollection,
    phoneNumber,
    createMembershipRevisionSidecar(phoneNumber, revision, document),
  );
}

function reconcileMemoryMembershipRevision(
  memberships,
  membershipRevisions,
  phoneNumber,
) {
  const reconciled = reconcileBaseMembershipRevision(
    memberships.get(phoneNumber) ?? null,
    membershipRevisions.get(phoneNumber) ?? null,
    phoneNumber,
  );
  if (reconciled.sidecarToWrite) {
    membershipRevisions.set(phoneNumber, reconciled.sidecarToWrite);
  }
  return reconciled;
}

function saveMemoryMembership(
  memberships,
  membershipRevisions,
  phoneNumber,
  membership,
  acknowledgedAt,
  currentRevision,
) {
  const document = {
    entitlement: membership,
    phone_number: phoneNumber,
    updated_at: acknowledgedAt,
  };
  const revision = nextBaseMembershipRevision(currentRevision);
  memberships.set(phoneNumber, document);
  membershipRevisions.set(
    phoneNumber,
    createMembershipRevisionSidecar(phoneNumber, revision, document),
  );
}

function reconcileBaseMembershipRevision(
  document,
  sidecarValue,
  phoneNumber,
) {
  const sidecar = normalizeMembershipRevisionSidecar(
    sidecarValue,
    phoneNumber,
  );
  if (document === null || document === undefined) {
    if (sidecar !== null) {
      throw httpError(
        500,
        'invalid_membership_revision',
        'A base membership revision cannot outlive its business state.',
      );
    }
    return {
      document: null,
      entitlement: createInitialMembership(),
      revision: 0,
      sidecarToWrite: null,
    };
  }

  assertMembershipDocumentOwner(document, phoneNumber);

  const legacyRevisionFloor = Object.hasOwn(document, 'revision')
    ? requirePositiveBaseMembershipRevision(document.revision)
    : 1;
  const stateDigest = createMembershipStateDigest(document, phoneNumber);
  let revision;

  if (sidecar === null) {
    revision = legacyRevisionFloor;
  } else if (sidecar.state_digest === stateDigest) {
    revision = Math.max(sidecar.revision, legacyRevisionFloor);
  } else {
    revision = Math.max(
      legacyRevisionFloor,
      nextBaseMembershipRevision(sidecar.revision),
    );
  }

  const sidecarToWrite =
    sidecar === null ||
    sidecar.revision !== revision ||
    sidecar.state_digest !== stateDigest
      ? createMembershipRevisionSidecar(
          phoneNumber,
          revision,
          document,
        )
      : null;

  return {
    document,
    entitlement: deserializeMembershipDocument(document),
    revision,
    sidecarToWrite,
  };
}

function normalizeMembershipRevisionSidecar(value, phoneNumber) {
  if (value === null || value === undefined) return null;
  const stored = {...value};
  delete stored._id;
  const actualKeys = Object.keys(stored).sort();
  const expectedKeys = [...MEMBERSHIP_REVISION_KEYS].sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index]) ||
    stored.schema_version !== MEMBERSHIP_REVISION_SCHEMA_VERSION ||
    stored.phone_number !== phoneNumber ||
    typeof stored.state_digest !== 'string' ||
    !/^[0-9a-f]{64}$/.test(stored.state_digest)
  ) {
    throw httpError(
      500,
      'invalid_membership_revision',
      'The base membership revision sidecar is invalid.',
    );
  }
  requirePositiveBaseMembershipRevision(stored.revision);
  return stored;
}

function createMembershipRevisionSidecar(phoneNumber, revision, document) {
  return {
    phone_number: phoneNumber,
    revision: requirePositiveBaseMembershipRevision(revision),
    schema_version: MEMBERSHIP_REVISION_SCHEMA_VERSION,
    state_digest: createMembershipStateDigest(document, phoneNumber),
  };
}

function createMembershipStateDigest(document, phoneNumber) {
  assertMembershipDocumentOwner(document, phoneNumber);
  const canonical = {
    entitlement: deserializeMembershipDocument(document),
    phone_number: phoneNumber,
    updated_at: document.updated_at ?? null,
  };
  return crypto
    .createHash('sha256')
    .update(stableDigestJson(canonical))
    .digest('hex');
}

function assertMembershipDocumentOwner(document, phoneNumber) {
  if (
    Object.hasOwn(document, 'phone_number') &&
    document.phone_number !== phoneNumber
  ) {
    throw httpError(
      500,
      'invalid_membership_revision',
      'The base membership business state owner is invalid.',
    );
  }
}

function deserializeMembershipDocument(document) {
  const entitlement = {...(document.entitlement ?? document)};
  if (
    entitlement.stage === 'trial' &&
    entitlement.trial_started_at === undefined &&
    entitlement.trial_expires_at === undefined &&
    isCanonicalIsoTimestamp(document.updated_at)
  ) {
    entitlement.trial_started_at = document.updated_at;
    entitlement.trial_expires_at = new Date(
      Date.parse(document.updated_at) + TRIAL_DURATION_MILLISECONDS,
    ).toISOString();
  }
  return cloneMembership(entitlement);
}

function requirePositiveBaseMembershipRevision(value) {
  const revision = requireNonNegativeSafeInteger(
    value,
    'base membership revision',
  );
  if (revision === 0) {
    throw httpError(
      500,
      'invalid_membership_revision',
      'A stored base membership revision must be positive.',
    );
  }
  return revision;
}

function inspectSpaceRevisionSnapshot(input) {
  const state = normalizeStoredSpaceState(input.state, input.accountKey);
  const revision = normalizeStoredSpaceStateRevision(
    input.revision,
    input.accountKey,
  );
  const stateExists = input.stateExists === true;

  if (!stateExists) {
    if (revision !== null) {
      throw httpError(
        500,
        'space_state_invalid',
        'A physical-space revision sidecar cannot outlive canonical state.',
      );
    }
    state.revision = 0;
    return {
      baseRevision: 0,
      needsCheckpoint: false,
      needsStateRewrite: input.needsStateRewrite === true,
      nextRevision: 0,
      revision: null,
      state,
      stateExists: false,
    };
  }

  const legacyRevisionFloor = Math.max(state.revision, 1);
  const stateDigest = createSpaceStateDigest(state, input.accountKey);
  if (revision === null) {
    state.revision = legacyRevisionFloor;
    return {
      baseRevision: legacyRevisionFloor,
      needsCheckpoint: true,
      needsStateRewrite: input.needsStateRewrite === true,
      nextRevision: legacyRevisionFloor,
      revision: null,
      state,
      stateExists: true,
    };
  }

  const baseRevision = Math.max(revision.revision, legacyRevisionFloor);
  const needsCheckpoint =
    revision.state_digest !== stateDigest ||
    legacyRevisionFloor > revision.revision;
  const nextRevision = needsCheckpoint
    ? Math.max(
        legacyRevisionFloor,
        nextSpaceStateRevision(revision.revision),
      )
    : revision.revision;
  state.revision = baseRevision;
  return {
    baseRevision,
    needsCheckpoint,
    needsStateRewrite: input.needsStateRewrite === true,
    nextRevision,
    revision,
    state,
    stateExists: true,
  };
}

function resolveSpaceCommitRevision(input) {
  if (input.hasNewLedgers) {
    return nextSpaceStateRevision(input.snapshot.baseRevision);
  }
  if (input.snapshot.needsCheckpoint) {
    return input.snapshot.nextRevision;
  }
  if (input.recoveredLedgerCount > 0) {
    return nextSpaceStateRevision(input.snapshot.baseRevision);
  }
  return input.snapshot.baseRevision;
}

function nextSpaceStateRevision(value) {
  const revision = requireNonNegativeSafeInteger(
    value,
    'physical-space state revision',
  );
  if (revision === Number.MAX_SAFE_INTEGER) {
    throw httpError(
      500,
      'space_state_invalid',
      'The physical-space state revision is exhausted.',
    );
  }
  return revision + 1;
}

function hasPersistedSpaceState(value) {
  return (
    value !== null &&
    value !== undefined &&
    (value.acknowledged_at !== null ||
      Object.keys(value.states_by_card_id ?? {}).length > 0)
  );
}

function stableDigestJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableDigestJson).join(',')}]`;
  }
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(
        key => `${JSON.stringify(key)}:${stableDigestJson(value[key])}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function nextBaseMembershipRevision(currentRevision) {
  const revision = requireNonNegativeSafeInteger(
    currentRevision,
    'base membership revision',
  );

  if (revision === Number.MAX_SAFE_INTEGER) {
    throw httpError(
      500,
      'membership_revision_exhausted',
      'The base membership revision is exhausted.',
    );
  }

  return revision + 1;
}

function requireNonNegativeSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw httpError(
      500,
      'invalid_canonical_revision',
      `${label} must be a non-negative safe integer.`,
    );
  }

  return value;
}

function createCanonicalMembershipProjection({
  base,
  betaEntitlement,
  phoneNumber,
  pilotEntitlement,
  pilotExpiresAt,
  pilotId,
}) {
  const betaMembership = applyBetaEntitlement(
    base.entitlement,
    betaEntitlement,
    phoneNumber,
  );
  const entitlement = applyPilotEntitlement(
    betaMembership,
    pilotEntitlement,
    phoneNumber,
    pilotId,
    pilotExpiresAt,
    base.observedAt,
  );
  return {
    acknowledged_at: latestAcknowledgedAt(
      base.updatedAt,
      betaEntitlement?.updated_at,
      pilotEntitlement?.updated_at,
    ),
    component_revision: {
      base_membership_revision: base.revision,
      beta_entitlement_revision: betaEntitlement?.revision ?? 0,
      pilot_entitlement_revision: derivePilotEntitlementComponentRevision(
        pilotEntitlement,
        pilotExpiresAt,
        base.observedAt,
      ),
    },
    ...serializeMembershipAt(entitlement, base.observedAt),
  };
}

function membershipProjectionMatchesExpected(projection, expected) {
  const revision = projection.component_revision;
  return (
    isObject(expected) &&
    projection.acknowledged_at === expected.acknowledgedAt &&
    projection.stage === expected.stage &&
    revision.base_membership_revision ===
      expected.baseMembershipRevision &&
    revision.beta_entitlement_revision ===
      expected.betaEntitlementRevision &&
    revision.pilot_entitlement_revision ===
      expected.pilotEntitlementRevision
  );
}

function applyBetaEntitlement(membership, document, phoneNumber) {
  if (document === null || document === undefined) {
    return membership;
  }
  assertBetaEntitlementDocument(document, phoneNumber);
  const active = document.active_grant ?? null;
  if (active === null) return membership;
  return {
    ...membership,
    last_experience_ended_by: null,
    recovery_prompt_visible: false,
    stage: 'premium',
  };
}

function applyPilotEntitlement(
  membership,
  document,
  phoneNumber,
  pilotId,
  pilotExpiresAt,
  observedAt,
) {
  if (document === null || document === undefined) return membership;
  assertPilotEntitlementDocument(document, phoneNumber, pilotId);
  if ((document.active_grant ?? null) === null) return membership;
  if (!isCanonicalIsoTimestamp(pilotExpiresAt)) {
    throw httpError(
      500,
      'invalid_pilot_entitlement',
      'Controlled-pilot expiry is invalid.',
    );
  }
  if (Date.parse(observedAt) >= Date.parse(pilotExpiresAt)) {
    return membership;
  }
  return {
    ...membership,
    last_experience_ended_by: null,
    recovery_prompt_visible: false,
    stage: 'premium',
  };
}

function derivePilotEntitlementComponentRevision(
  document,
  pilotExpiresAt,
  observedAt,
) {
  if (document === null || document === undefined) return 0;
  const auditRevision = requireNonNegativeSafeInteger(
    document.revision,
    'pilot entitlement audit revision',
  );
  const active = (document.active_grant ?? null) !== null;
  const expired =
    active &&
    isCanonicalIsoTimestamp(pilotExpiresAt) &&
    isCanonicalIsoTimestamp(observedAt) &&
    Date.parse(observedAt) >= Date.parse(pilotExpiresAt);
  return auditRevision * 2 + (expired ? 1 : 0);
}

function assertPilotEntitlementDocument(document, phoneNumber, pilotId) {
  const invalid = () =>
    httpError(
      500,
      'invalid_pilot_entitlement',
      'Canonical pilot entitlement is invalid.',
    );
  let normalized;
  try {
    normalized =
      pilotEntitlementInternals.normalizePilotEntitlementDocument(document);
  } catch {
    throw invalid();
  }
  if (
    normalized.phone_number !== phoneNumber ||
    (normalized.active_grant !== null &&
      normalized.active_grant.pilot_id !== pilotId)
  ) {
    throw invalid();
  }
}

function assertBetaEntitlementDocument(document, phoneNumber) {
  const audit = document.audit;
  const active = document.active_grant ?? null;
  const invalid = () =>
    httpError(
      500,
      'invalid_beta_entitlement',
      'Canonical beta entitlement is invalid.',
    );
  if (
    document.phone_number !== phoneNumber ||
    !Number.isSafeInteger(document.revision) ||
    document.revision <= 0 ||
    !Array.isArray(audit) ||
    audit.length !== document.revision ||
    document.updated_at !== audit.at(-1)?.occurred_at
  ) {
    throw invalid();
  }
  let openGrantId = null;
  let previousTimestamp = null;
  for (const event of audit) {
    if (
      event?.schema_version !== 'beta-entitlement-audit.v1' ||
      !['grant', 'revoke'].includes(event.action) ||
      typeof event.actor_id !== 'string' ||
      !/^sha256:[a-f0-9]{64}$/.test(event.command_sha256 ?? '') ||
      typeof event.event_id !== 'string' ||
      typeof event.grant_id !== 'string' ||
      !isCanonicalIsoTimestamp(event.occurred_at) ||
      typeof event.reason !== 'string' ||
      !['trial_available', 'trial', 'free', 'premium'].includes(
        event.previous_stage,
      ) ||
      !['trial_available', 'trial', 'free', 'premium'].includes(
        event.resulting_stage,
      ) ||
      (previousTimestamp !== null && event.occurred_at < previousTimestamp)
    ) {
      throw invalid();
    }
    if (event.action === 'grant') {
      if (openGrantId !== null || event.resulting_stage !== 'premium') {
        throw invalid();
      }
      openGrantId = event.grant_id;
    } else {
      if (
        openGrantId !== event.grant_id ||
        event.previous_stage !== 'premium'
      ) {
        throw invalid();
      }
      openGrantId = null;
    }
    previousTimestamp = event.occurred_at;
  }
  const latest = audit.at(-1);
  if (active === null) {
    if (openGrantId !== null || latest.action !== 'revoke') throw invalid();
    return;
  }
  if (
    latest.action !== 'grant' ||
    openGrantId !== latest.grant_id ||
    active.schema_version !== 'beta-entitlement.v1' ||
    active.actor_id !== latest.actor_id ||
    active.command_sha256 !== latest.command_sha256 ||
    active.grant_event_id !== latest.event_id ||
    active.grant_id !== latest.grant_id ||
    active.granted_at !== latest.occurred_at ||
    active.reason !== latest.reason
  ) {
    throw invalid();
  }
}

function isCanonicalIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function latestAcknowledgedAt(...values) {
  const timestamps = values.filter(isCanonicalIsoTimestamp).sort();
  return timestamps.at(-1) ?? null;
}

async function getCloudBaseDocument(collection, documentId) {
  try {
    const result = await collection.doc(documentId).get();
    const data = normalizeCloudBaseDocuments(result.data)[0];

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

function createCloudBaseDocumentId(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createPilotRoundContinuationKey(input) {
  return `${input.accountKey}:${input.track}:${input.completedCount}`;
}

function createPilotRoundContinuationId(input) {
  return createCloudBaseDocumentId(createPilotRoundContinuationKey(input));
}

function createStoredPilotRoundContinuation(input) {
  return {
    account_key: input.accountKey,
    acknowledged_at: input.acknowledgedAt,
    completed_count: input.completedCount,
    content_version: input.contentVersion,
    pilot_id: input.pilotId,
    receipt_id: input.receiptId,
    schema_version: 'pilot-round-continue-ack.v1',
    track: input.track,
  };
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
    assets: cloneJson(cardSource.assets),
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

function serializeCardSourceResponse(
  cardSource,
  expectedTrack,
  membershipStage,
) {
  const normalized = normalizeCardSource(cardSource, expectedTrack);
  const accessibleCardCount = resolveAccessibleCardCount(
    membershipStage,
    normalized.card_records.length,
  );

  return {
    card_records: cloneJson(
      normalized.card_records.slice(0, accessibleCardCount),
    ),
    content_version: normalized.content_version,
    source: {
      id: normalized.source.id,
      label: normalized.source.label,
    },
    track: normalized.track,
  };
}

function resolveAccessibleCardCount(membershipStage, totalCardCount) {
  switch (membershipStage) {
    case 'trial_available':
    case 'trial':
    case 'premium':
      return totalCardCount;
    case 'free':
      return Math.ceil(totalCardCount * FREE_CARD_ACCESS_RATIO);
    default:
      throw httpError(
        500,
        'content_access_invalid',
        'Canonical membership stage is invalid.',
      );
  }
}

function validateCardSourceForImport(cardSource, expectedTrack) {
  return normalizeCardSource(cardSource, expectedTrack, {
    assetLocator: 'storage_file_id',
  });
}

function validateCardSourceForReleaseBundle(cardSource, expectedTrack) {
  return normalizeCardSource(cardSource, expectedTrack, {
    assetLocator: 'asset_path',
  });
}

function normalizeCardSource(
  cardSource,
  expectedTrack,
  {assetLocator = 'storage_file_id'} = {},
) {
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

  const assets = normalizeContentAssets(payload.assets ?? [], assetLocator);

  const cardRecords = requireCardSourceArray(
    payload.card_records,
    'card source.card_records',
  ).map((record, index) =>
    normalizeCardRecord(record, track, `card source.card_records[${index}]`),
  );
  assertUniqueNonEmptyCardRecords(cardRecords);
  assertCardAudioAssets(cardRecords, assets);
  const versionedContent = {
    card_records: cardRecords,
    source: {
      id: sourceId,
      label: sourceLabel,
    },
    track,
  };

  if (assets.length > 0) {
    versionedContent.assets = assets.map(asset => ({
      asset_id: asset.asset_id,
      duration_ms: asset.duration_ms,
      media_type: asset.media_type,
      sha256: asset.sha256,
      size_bytes: asset.size_bytes,
    }));
  }

  const contentVersion = createContentVersion(versionedContent);

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
    assets,
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

  const normalizedCard = cloneJson(card);

  if (card.audio !== undefined) {
    normalizedCard.audio = normalizeCardAudio(card.audio, `${label}.audio`);
  }

  switch (card.interaction_id) {
    case 'flip':
      requireCardSourceString(card.back_text, `${label}.back_text`);

      if (card.auto_scoring === true) {
        throw cardSourceError(
          `${label}.flip must not claim auto_scoring true.`,
        );
      }

      return normalizedCard;
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

      return normalizedCard;
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

      return normalizedCard;
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

      return normalizedCard;
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

      return normalizedCard;
    }
    default:
      throw cardSourceError(`${label}.interaction_id is unsupported.`);
  }
}

function normalizeContentAssets(value, assetLocator) {
  if (!['asset_path', 'storage_file_id'].includes(assetLocator)) {
    throw cardSourceError('card source asset locator is unsupported.');
  }

  const assets = requireCardSourceArray(value, 'card source.assets').map(
    (asset, index) => {
      const label = `card source.assets[${index}]`;
      const record = requireCardSourceObject(asset, label);
      assertExactCardSourceKeys(
        record,
        [
          'asset_id',
          'duration_ms',
          'media_type',
          'sha256',
          'size_bytes',
          assetLocator,
        ],
        label,
      );

      return {
        asset_id: requireContentAssetId(
          record.asset_id,
          `${label}.asset_id`,
        ),
        duration_ms: requirePositiveSafeInteger(
          record.duration_ms,
          `${label}.duration_ms`,
        ),
        media_type: requireExactString(
          record.media_type,
          'audio/mpeg',
          `${label}.media_type`,
        ),
        sha256: requireSha256(record.sha256, `${label}.sha256`),
        size_bytes: requirePositiveSafeInteger(
          record.size_bytes,
          `${label}.size_bytes`,
        ),
        [assetLocator]:
          assetLocator === 'storage_file_id'
            ? requireCloudBaseFileId(
                record.storage_file_id,
                `${label}.storage_file_id`,
              )
            : requireBundleAssetPath(
                record.asset_path,
                `${label}.asset_path`,
              ),
      };
    },
  );
  const ids = new Set();

  for (const asset of assets) {
    if (ids.has(asset.asset_id)) {
      throw cardSourceError(
        `card source.assets contains duplicate asset_id ${asset.asset_id}.`,
      );
    }
    ids.add(asset.asset_id);
  }

  return assets.sort((left, right) =>
    left.asset_id.localeCompare(right.asset_id),
  );
}

function normalizeCardAudio(value, label) {
  const audio = requireCardSourceObject(value, label);
  assertExactCardSourceKeys(
    audio,
    audio.transcript === undefined
      ? ['asset_id', 'duration_ms', 'sha256']
      : ['asset_id', 'duration_ms', 'sha256', 'transcript'],
    label,
  );
  const normalized = {
    asset_id: requireContentAssetId(audio.asset_id, `${label}.asset_id`),
    duration_ms: requirePositiveSafeInteger(
      audio.duration_ms,
      `${label}.duration_ms`,
    ),
    sha256: requireSha256(audio.sha256, `${label}.sha256`),
  };

  if (audio.transcript !== undefined) {
    normalized.transcript = requireCardSourceString(
      audio.transcript,
      `${label}.transcript`,
    );
  }

  return normalized;
}

function assertCardAudioAssets(cardRecords, assets) {
  const assetsById = new Map(assets.map(asset => [asset.asset_id, asset]));
  const referencedAssetIds = new Set();

  for (const card of cardRecords) {
    if (card.audio === undefined) {
      continue;
    }

    const audio = normalizeCardAudio(card.audio, `card ${card.card_id}.audio`);
    const asset = assetsById.get(audio.asset_id);

    if (!asset) {
      throw cardSourceError(
        `card ${card.card_id}.audio references missing asset ${audio.asset_id}.`,
      );
    }

    if (
      asset.sha256 !== audio.sha256 ||
      asset.duration_ms !== audio.duration_ms
    ) {
      throw cardSourceError(
        `card ${card.card_id}.audio must match its asset hash and duration.`,
      );
    }

    referencedAssetIds.add(audio.asset_id);
  }

  for (const asset of assets) {
    if (!referencedAssetIds.has(asset.asset_id)) {
      throw cardSourceError(
        `card source asset ${asset.asset_id} is not referenced by any card.`,
      );
    }
  }
}

function requireContentAssetId(value, fieldName) {
  return requireCardSourcePattern(
    value,
    /^[a-z0-9][a-z0-9._-]{2,127}$/,
    fieldName,
  );
}

function requireSha256(value, fieldName) {
  return requireCardSourcePattern(
    value,
    /^sha256:[a-f0-9]{64}$/,
    fieldName,
  );
}

function requirePositiveSafeInteger(value, fieldName) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw cardSourceError(`${fieldName} must be a positive safe integer.`);
  }

  return value;
}

function requireExactString(value, expected, fieldName) {
  const normalized = requireCardSourceString(value, fieldName);

  if (normalized !== expected) {
    throw cardSourceError(`${fieldName} must be ${expected}.`);
  }

  return normalized;
}

function requireCloudBaseFileId(value, fieldName) {
  const fileId = requireCardSourceString(value, fieldName);

  if (!/^cloud:\/\/[^\s?#]+$/.test(fileId)) {
    throw cardSourceError(`${fieldName} must be a CloudBase file ID.`);
  }

  return fileId;
}

function requireBundleAssetPath(value, fieldName) {
  const assetPath = requireCardSourceString(value, fieldName);

  if (
    assetPath.startsWith('/') ||
    assetPath.includes('\\') ||
    assetPath.split('/').some(segment => segment === '' || segment === '.' || segment === '..') ||
    !assetPath.toLowerCase().endsWith('.mp3')
  ) {
    throw cardSourceError(
      `${fieldName} must be a relative in-bundle MP3 path without traversal.`,
    );
  }

  return assetPath;
}

function assertExactCardSourceKeys(value, expectedKeys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw cardSourceError(`${label} has unsupported or missing fields.`);
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
    trial_expires_at: null,
    trial_started_at: null,
    trial_started_at_entry_count: null,
  };
}

function startCanonicalTrial(membership, startedAt) {
  if (!isCanonicalIsoTimestamp(startedAt)) {
    throw httpError(
      500,
      'invalid_membership_clock',
      'Trial start time must be canonical UTC.',
    );
  }
  membership.counted_entry_count += 1;
  membership.last_experience_ended_by = null;
  membership.recovery_prompt_visible = false;
  membership.stage = 'trial';
  membership.trial_started_at_entry_count = membership.counted_entry_count;
  membership.trial_started_at = startedAt;
  membership.trial_expires_at = new Date(
    Date.parse(startedAt) + TRIAL_DURATION_MILLISECONDS,
  ).toISOString();
}

function cloneMembership(membership) {
  const cloned = {
    counted_entry_count: membership.counted_entry_count,
    last_experience_ended_by: membership.last_experience_ended_by,
    recovery_prompt_visible: membership.recovery_prompt_visible,
    stage: membership.stage,
    trial_duration_days: membership.trial_duration_days,
    trial_expires_at: membership.trial_expires_at ?? null,
    trial_started_at: membership.trial_started_at ?? null,
    trial_started_at_entry_count: membership.trial_started_at_entry_count,
  };
  assertMembershipTrialClock(cloned);
  return cloned;
}

function serializeMembershipEntitlement(entitlement, observedAt) {
  const membership = cloneMembership(entitlement);
  const serialized = serializeMembershipAt(membership, observedAt);
  if (
    observedAt === undefined &&
    Number.isSafeInteger(entitlement.trial_remaining_seconds) &&
    entitlement.trial_remaining_seconds >= 0
  ) {
    serialized.trial_remaining_seconds = entitlement.trial_remaining_seconds;
  }
  return serialized;
}

function serializeMembershipAt(membership, observedAt) {
  const canonical = cloneMembership(membership);
  const observed = resolveMembershipObservation(observedAt, canonical);
  return {
    ...canonical,
    trial_remaining_seconds: deriveTrialRemainingSeconds(canonical, observed),
  };
}

function resolveMembershipObservation(observedAt, membership) {
  const fallback = membership.trial_started_at ?? '1970-01-01T00:00:00.000Z';
  const value = observedAt ?? fallback;
  if (!isCanonicalIsoTimestamp(value)) {
    throw httpError(
      500,
      'invalid_membership_clock',
      'Membership observation time must be canonical UTC.',
    );
  }
  return value;
}

function deriveTrialRemainingSeconds(membership, observedAt) {
  if (membership.stage !== 'trial') return 0;
  return Math.max(
    0,
    Math.ceil(
      (Date.parse(membership.trial_expires_at) - Date.parse(observedAt)) / 1000,
    ),
  );
}

function expireMembershipIfNeeded(membership, observedAt) {
  const entitlement = cloneMembership(membership);
  const canonicalObservedAt = resolveMembershipObservation(observedAt, entitlement);
  if (
    entitlement.stage !== 'trial' ||
    Date.parse(canonicalObservedAt) < Date.parse(entitlement.trial_expires_at)
  ) {
    return {changed: false, entitlement, observedAt: canonicalObservedAt};
  }
  entitlement.last_experience_ended_by = 'trial';
  entitlement.recovery_prompt_visible = true;
  entitlement.stage = 'free';
  return {changed: true, entitlement, observedAt: canonicalObservedAt};
}

function assertMembershipTrialClock(membership) {
  const startedAt = membership.trial_started_at;
  const expiresAt = membership.trial_expires_at;
  if (startedAt === null && expiresAt === null) {
    if (membership.stage === 'trial') {
      throw httpError(
        500,
        'invalid_membership_clock',
        'An active trial requires canonical timestamps.',
      );
    }
    return;
  }
  if (
    !isCanonicalIsoTimestamp(startedAt) ||
    !isCanonicalIsoTimestamp(expiresAt) ||
    Date.parse(expiresAt) - Date.parse(startedAt) !==
      TRIAL_DURATION_MILLISECONDS ||
    membership.trial_started_at_entry_count === null
  ) {
    throw httpError(
      500,
      'invalid_membership_clock',
      'Canonical trial timestamps are invalid.',
    );
  }
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
  accountDeletionWorkerMain,
  createCloudBaseStore,
  createMemoryStore,
  createSoftbookApi,
  handlePilotEntitlementOperatorInvoke,
  get defaultApi() {
    return getDefaultApi();
  },
  main,
  validateCardSourceForImport,
  validateCardSourceForReleaseBundle,
};
