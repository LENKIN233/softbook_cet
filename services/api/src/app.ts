import {createHash, randomInt, randomUUID} from 'node:crypto';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, {
  type FastifyInstance,
  type FastifyRequest,
} from 'fastify';
import {z} from 'zod';

import type {
  LearningEventInput,
  LearningTrack,
  ProductionRepository,
  SessionPrincipal,
  SessionTokens,
  SmsProvider,
} from './domain.js';
import {ApiError, RepositoryConflictError} from './errors.js';
import {
  PhoneProtector,
  SecretHasher,
  createOpaqueToken,
} from './security.js';

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SMS_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SMS_RESEND_COOLDOWN_MS = 60 * 1000;
const SMS_ATTEMPT_LIMIT = 5;

const phoneSchema = z.string().regex(/^1\d{10}$/);
const trackSchema = z.enum(['cet4', 'cet6']);
const dayKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidDayKey);
const requestCodeSchema = z.object({phone_number: phoneSchema}).strict();
const verifyCodeSchema = z
  .object({
    challenge_id: z.string().uuid(),
    phone_number: phoneSchema,
    sms_code: z.string().regex(/^\d{4,8}$/),
  })
  .strict();
const refreshSchema = z
  .object({refresh_token: z.string().startsWith('sb_rt_')})
  .strict();
const eventSchema = z
  .object({
    answer_grade: z.enum(['again', 'hard', 'good', 'easy']),
    card_id: z.string().regex(/^\d{6}$/),
    client_timestamp: z.string().datetime({offset: true}),
    content_release_id: z.string().min(1).max(128),
    device_cursor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    device_id: z.string().uuid(),
    event_id: z.string().uuid(),
    interaction_id: z.enum([
      'flip',
      'multiple_choice',
      'lock',
      'elimination',
      'swipe',
    ]),
    phase: z.enum(['learning', 'review']),
    track: trackSchema,
    used_hint: z.boolean(),
    used_peek: z.boolean(),
  })
  .strict();
const eventsSchema = z.object({events: z.array(eventSchema).min(1).max(100)}).strict();

export type CreateProductionApiOptions = {
  allowedOrigins: string[];
  codeHasher: SecretHasher;
  environment: 'development' | 'test' | 'production';
  generateSmsCode?: () => string;
  logger?: boolean;
  now?: () => Date;
  phoneProtector: PhoneProtector;
  repository: ProductionRepository;
  smsProvider: SmsProvider;
  tokenHasher: SecretHasher;
};

export async function createProductionApi(
  options: CreateProductionApiOptions,
): Promise<FastifyInstance> {
  if (options.environment === 'production' && options.smsProvider.kind !== 'tencent') {
    throw new Error('Production API requires the Tencent SMS provider.');
  }

  const app = Fastify({
    logger: options.logger
      ? {
          redact: [
            'req.headers.authorization',
            'req.body.phone_number',
            'req.body.sms_code',
            'req.body.refresh_token',
          ],
        }
      : false,
    trustProxy: options.environment === 'production' ? 1 : false,
  });
  const now = options.now ?? (() => new Date());
  const generateSmsCode =
    options.generateSmsCode ?? (() => String(randomInt(100000, 1000000)));

  await app.register(helmet, {contentSecurityPolicy: false});
  await app.register(cors, {
    credentials: true,
    origin(origin, callback) {
      if (!origin || options.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new ApiError(403, 'origin_not_allowed', 'Origin is not allowed.'), false);
    },
  });
  await app.register(rateLimit, {global: false});

  app.setErrorHandler((error, request, reply) => {
    const apiError = normalizeError(error);
    if (apiError.statusCode >= 500) {
      request.log.error({err: error, requestId: request.id}, 'request failed');
    }
    void reply.status(apiError.statusCode).send({
      error: {code: apiError.code, message: apiError.message},
    });
  });

  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/v2/')) {
      void reply.header('Cache-Control', 'no-store');
    }
    return payload;
  });

  app.get('/health/live', async () => ({status: 'ok'}));
  app.get('/health/ready', async () => {
    await options.repository.ping();
    return {status: 'ready'};
  });

  app.post(
    '/v2/auth/request-code',
    {
      config: {
        rateLimit: {max: 10, timeWindow: '1 minute'},
      },
    },
    async request => {
      const body = parse(requestCodeSchema, request.body);
      const requestedAt = now();
      const challengeId = randomUUID();
      const smsCode = generateSmsCode();
      const phoneLookupHash = options.phoneProtector.lookupHash(body.phone_number);
      const expiresAt = new Date(requestedAt.getTime() + SMS_CHALLENGE_TTL_MS);
      const resendAfter = new Date(
        requestedAt.getTime() + SMS_RESEND_COOLDOWN_MS,
      );

      try {
        await options.repository.createSmsChallenge(
          {
            attemptsRemaining: SMS_ATTEMPT_LIMIT,
            codeHash: options.codeHasher.hash(`${challengeId}:${smsCode}`),
            consumedAt: null,
            expiresAt,
            id: challengeId,
            phoneLookupHash,
            resendAfter,
          },
          requestedAt,
        );
      } catch (error) {
        if (
          error instanceof RepositoryConflictError &&
          error.code === 'sms_resend_limited'
        ) {
          throw new ApiError(
            429,
            'sms_resend_limited',
            'Please wait before requesting another code.',
          );
        }
        throw error;
      }

      try {
        await options.smsProvider.sendCode(body.phone_number, smsCode);
      } catch {
        await options.repository.invalidateSmsChallenge(challengeId, now());
        throw new ApiError(
          502,
          'sms_delivery_failed',
          'SMS delivery is temporarily unavailable.',
        );
      }

      return {
        data: {
          challenge_id: challengeId,
          expires_at: expiresAt.toISOString(),
          resend_after: resendAfter.toISOString(),
        },
      };
    },
  );

  app.post('/v2/auth/verify-code', async request => {
    const body = parse(verifyCodeSchema, request.body);
    const verifiedAt = now();
    const phoneLookupHash = options.phoneProtector.lookupHash(body.phone_number);
    const verification = await options.repository.verifySmsChallenge(
      body.challenge_id,
      phoneLookupHash,
      options.codeHasher.hash(`${body.challenge_id}:${body.sms_code}`),
      verifiedAt,
    );

    if (verification.status !== 'accepted') {
      const codeByStatus = {
        expired: 'sms_code_expired',
        invalid: 'invalid_sms_code',
        not_found: 'invalid_sms_challenge',
        used: 'sms_challenge_used',
      } as const;
      throw new ApiError(
        401,
        codeByStatus[verification.status],
        'SMS challenge could not be verified.',
      );
    }

    const user = await options.repository.getOrCreateUser(
      {
        deletionRequestedAt: null,
        id: randomUUID(),
        phoneCiphertext: options.phoneProtector.encrypt(body.phone_number),
        phoneLookupHash,
      },
      verifiedAt,
    );
    if (user.deletionRequestedAt) {
      throw new ApiError(
        409,
        'account_deletion_pending',
        'Account deletion is already pending.',
      );
    }
    const issued = issueSessionTokens(user.id, verifiedAt, options.tokenHasher);
    await options.repository.createSession(issued.record, verifiedAt);

    return {data: serializeIssuedSession(issued, user.id)};
  });

  app.post('/v2/auth/refresh', async request => {
    const body = parse(refreshSchema, request.body);
    const refreshedAt = now();
    const replacement = issueSessionTokens('', refreshedAt, options.tokenHasher);
    const result = await options.repository.rotateSession(
      options.tokenHasher.hash(body.refresh_token),
      replacement.record,
      refreshedAt,
    );
    if (result.status !== 'accepted') {
      throw new ApiError(401, 'invalid_refresh_token', 'Refresh token is invalid.');
    }

    return {
      data: serializeIssuedSession(
        replacement,
        result.principal.userId,
      ),
    };
  });

  app.post('/v2/auth/logout', async request => {
    const principal = await authenticate(request, options, now());
    await options.repository.revokeSession(principal.sessionId, now());
    return {data: {revoked: true}};
  });

  app.post('/v2/account/deletion', async (request, reply) => {
    const principal = await authenticate(request, options, now());
    const requestedAt = now();
    const jobId = await options.repository.requestAccountDeletion(
      principal.userId,
      requestedAt,
    );
    return reply.status(202).send({
      data: {
        deletion_job_id: jobId,
        requested_at: requestedAt.toISOString(),
        status: 'queued',
      },
    });
  });

  app.get('/v2/bootstrap', async request => {
    const principal = await authenticate(request, options, now());
    const query = parse(
      z.object({track: trackSchema, day_key: dayKeySchema}).strict(),
      request.query,
    );
    const snapshot = await options.repository.getBootstrapSnapshot(
      principal.userId,
      query.track,
      query.day_key,
    );
    if (!snapshot.contentManifest) {
      throw new ApiError(
        503,
        'content_release_unavailable',
        'No active approved content release is available.',
      );
    }

    return {
      data: {
        user: {id: principal.userId},
        track: query.track,
        day_key: query.day_key,
        membership_entitlement: serializeMembership(snapshot.membership),
        daily_progress: snapshot.dailyProgress,
        learning_state: {
          events: snapshot.learningEvents.map(serializeLearningEvent),
        },
        space_state: {
          states: snapshot.spaceStates.map(state => ({
            card_id: state.cardId,
            is_favorited: state.isFavorited,
            is_sleeping: state.isSleeping,
            last_modified_at: state.lastModifiedAt,
          })),
        },
        content_manifest: serializeContentManifest(snapshot.contentManifest),
      },
    };
  });

  app.get('/v2/content/manifest', async request => {
    const principal = await authenticate(request, options, now());
    const query = parse(
      z.object({track: trackSchema}).strict(),
      request.query,
    );
    const dayKey = toChinaDayKey(now());
    const snapshot = await options.repository.getBootstrapSnapshot(
      principal.userId,
      query.track,
      dayKey,
    );
    if (!snapshot.contentManifest) {
      throw new ApiError(
        503,
        'content_release_unavailable',
        'No active approved content release is available.',
      );
    }
    return {data: {manifest: serializeContentManifest(snapshot.contentManifest)}};
  });

  app.get('/v2/membership/entitlement', async request => {
    const principal = await authenticate(request, options, now());
    const query = parse(
      z.object({track: trackSchema.default('cet4')}).strict(),
      request.query,
    );
    const snapshot = await options.repository.getBootstrapSnapshot(
      principal.userId,
      query.track,
      toChinaDayKey(now()),
    );
    return {data: {entitlement: serializeMembership(snapshot.membership)}};
  });

  app.post('/v2/learning/events', async request => {
    const principal = await authenticate(request, options, now());
    const body = parse(eventsSchema, request.body);
    const receivedAt = now();
    const events: LearningEventInput[] = body.events.map(event => {
      const normalized = {
        answerGrade: event.answer_grade,
        cardId: event.card_id,
        clientTimestamp: new Date(event.client_timestamp),
        contentReleaseId: event.content_release_id,
        deviceCursor: event.device_cursor,
        deviceId: event.device_id,
        eventId: event.event_id,
        interactionId: event.interaction_id,
        phase: event.phase,
        track: event.track,
        usedHint: event.used_hint,
        usedPeek: event.used_peek,
      };
      return {...normalized, payloadHash: hashLearningEvent(normalized)};
    });
    let result;
    try {
      result = await options.repository.saveLearningEvents(
        principal.userId,
        events,
        receivedAt,
      );
    } catch (error) {
      if (
        error instanceof RepositoryConflictError &&
        error.code === 'content_release_unavailable'
      ) {
        throw new ApiError(
          409,
          'content_release_unavailable',
          'Learning events reference an unavailable content release.',
        );
      }
      if (
        error instanceof RepositoryConflictError &&
        error.code === 'device_cursor_conflict'
      ) {
        throw new ApiError(
          409,
          'device_cursor_conflict',
          'Device cursor is already associated with another event.',
        );
      }
      if (
        error instanceof RepositoryConflictError &&
        error.code === 'idempotency_key_conflict'
      ) {
        throw new ApiError(
          409,
          'idempotency_key_conflict',
          'Event ID is already associated with another payload.',
        );
      }
      throw error;
    }
    return {
      data: {
        accepted_count: result.accepted,
        duplicate_count: result.duplicates,
        received_at: receivedAt.toISOString(),
      },
    };
  });

  app.addHook('onClose', async () => {
    await options.repository.close();
  });

  return app;
}

async function authenticate(
  request: FastifyRequest,
  options: CreateProductionApiOptions,
  now: Date,
): Promise<SessionPrincipal> {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    throw new ApiError(401, 'missing_access_token', 'Bearer token is required.');
  }
  const token = authorization.slice('Bearer '.length).trim();
  if (!token.startsWith('sb_at_')) {
    throw new ApiError(401, 'invalid_access_token', 'Access token is invalid.');
  }
  const principal = await options.repository.authenticateAccessToken(
    options.tokenHasher.hash(token),
    now,
  );
  if (!principal) {
    throw new ApiError(401, 'invalid_access_token', 'Access token is invalid.');
  }
  return principal;
}

function issueSessionTokens(
  userId: string,
  issuedAt: Date,
  hasher: SecretHasher,
) {
  const accessToken = createOpaqueToken('sb_at');
  const refreshToken = createOpaqueToken('sb_rt');
  const record: SessionTokens = {
    accessExpiresAt: new Date(issuedAt.getTime() + ACCESS_TOKEN_TTL_MS),
    accessHash: hasher.hash(accessToken),
    id: randomUUID(),
    refreshExpiresAt: new Date(issuedAt.getTime() + REFRESH_TOKEN_TTL_MS),
    refreshHash: hasher.hash(refreshToken),
    userId,
  };
  return {accessToken, record, refreshToken};
}

function serializeIssuedSession(
  issued: ReturnType<typeof issueSessionTokens>,
  userId: string,
) {
  return {
    access_token: issued.accessToken,
    access_expires_at: issued.record.accessExpiresAt.toISOString(),
    refresh_token: issued.refreshToken,
    refresh_expires_at: issued.record.refreshExpiresAt.toISOString(),
    token_type: 'Bearer',
    user: {id: userId},
  };
}

function serializeMembership(
  membership: Awaited<
    ReturnType<ProductionRepository['getBootstrapSnapshot']>
  >['membership'],
) {
  return {
    current_period_ends_at: membership.currentPeriodEndsAt,
    product_id: membership.productId,
    provider: membership.provider,
    renewal_state: membership.renewalState,
    stage: membership.stage,
    trial_ends_at: membership.trialEndsAt,
    trial_started_at: membership.trialStartedAt,
  };
}

function serializeLearningEvent(event: LearningEventInput) {
  return {
    answer_grade: event.answerGrade,
    card_id: event.cardId,
    client_timestamp: event.clientTimestamp.toISOString(),
    content_release_id: event.contentReleaseId,
    device_cursor: event.deviceCursor,
    device_id: event.deviceId,
    event_id: event.eventId,
    interaction_id: event.interactionId,
    phase: event.phase,
    track: event.track,
    used_hint: event.usedHint,
    used_peek: event.usedPeek,
  };
}

function serializeContentManifest(
  manifest: NonNullable<
    Awaited<ReturnType<ProductionRepository['getBootstrapSnapshot']>>['contentManifest']
  >,
) {
  return {
    schema_version: 'content-release.v1',
    approval_record_sha256: manifest.approvalRecordSha256,
    manifest_sha256: manifest.manifestSha256,
    minimum_client_version: manifest.minimumClientVersion,
    packs: manifest.packs.map(pack => ({
      asset_id: pack.assetId,
      box_ref: pack.boxRef,
      byte_size: pack.byteSize,
      pack_id: pack.packId,
      sha256: pack.sha256,
    })),
    parent_release_id: manifest.parentReleaseId,
    release_id: manifest.releaseId,
    signature: manifest.signature,
    signature_key_id: manifest.signatureKeyId,
    track: manifest.track,
  };
}

function hashLearningEvent(
  event: Omit<LearningEventInput, 'payloadHash'>,
): string {
  const canonicalValues = [
    event.answerGrade,
    event.cardId,
    event.clientTimestamp.toISOString(),
    event.contentReleaseId,
    String(event.deviceCursor),
    event.deviceId,
    event.eventId,
    event.interactionId,
    event.phase,
    event.track,
    String(event.usedHint),
    String(event.usedPeek),
  ];
  return createHash('sha256').update(canonicalValues.join('\u0000')).digest('hex');
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(400, 'invalid_request', 'Request payload is invalid.');
  }
  return result.data;
}

function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    if (error.statusCode === 429) {
      return new ApiError(
        429,
        'rate_limit_exceeded',
        'Too many requests. Please try again later.',
      );
    }
    if (error.statusCode === 404) {
      return new ApiError(404, 'not_found', 'Endpoint was not found.');
    }
    return new ApiError(
      error.statusCode,
      'invalid_request',
      'Request could not be processed.',
    );
  }
  return new ApiError(500, 'internal_error', 'Internal server error.');
}

function isValidDayKey(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function toChinaDayKey(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).formatToParts(value);
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}
