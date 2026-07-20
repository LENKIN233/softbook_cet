const crypto = require('node:crypto');

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const CHALLENGE_TTL_SECONDS = 5 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
const PHONE_REQUEST_LIMIT = 5;
const IP_REQUEST_LIMIT = 20;
const VERIFY_ATTEMPT_LIMIT = 5;

function createAuthV2Service(options) {
  const runtimeMode = options.runtimeMode ?? 'development';
  const now = options.now ?? (() => new Date());
  const randomBytes = options.randomBytes ?? crypto.randomBytes;
  const tokenSecret = options.tokenSecret;
  const indexSecret =
    options.indexSecret ??
    (runtimeMode === 'development' ? tokenSecret : undefined);
  const store = options.store;
  const smsProvider = options.smsProvider ?? createDevelopmentSmsProvider();
  const codeGenerator =
    options.codeGenerator ??
    (runtimeMode === 'production'
      ? generateSixDigitCode
      : () => String(options.developmentSmsCode ?? '2468'));
  const config = {
    accessTokenTtlSeconds:
      options.accessTokenTtlSeconds ?? ACCESS_TOKEN_TTL_SECONDS,
    challengeTtlSeconds:
      options.challengeTtlSeconds ?? CHALLENGE_TTL_SECONDS,
    codeGenerator,
    indexSecret,
    ipRequestLimit: options.ipRequestLimit ?? IP_REQUEST_LIMIT,
    now,
    phoneRequestLimit: options.phoneRequestLimit ?? PHONE_REQUEST_LIMIT,
    randomBytes,
    rateLimitWindowSeconds:
      options.rateLimitWindowSeconds ?? RATE_LIMIT_WINDOW_SECONDS,
    refreshTokenTtlSeconds:
      options.refreshTokenTtlSeconds ?? REFRESH_TOKEN_TTL_SECONDS,
    requireClientIp: options.requireClientIp ?? runtimeMode === 'production',
    runtimeMode,
    smsProvider,
    store,
    tokenSecret,
    verifyAttemptLimit:
      options.verifyAttemptLimit ?? VERIFY_ATTEMPT_LIMIT,
  };

  validateServiceConfig(config);

  return {
    logout: request => logout(config, request),
    refresh: request => refresh(config, request),
    requestAccountDeletion: request =>
      requestAccountDeletion(config, request),
    requestCode: request => requestCode(config, request),
    requireActiveSession: request => requireActiveSession(config, request),
    verifyCode: request => verifyCode(config, request),
  };
}

function createDevelopmentSmsProvider() {
  return {
    delivery: 'development_fixed_code',
    kind: 'development',
    sendCode: async () => undefined,
  };
}

async function requestCode(config, request) {
  const body = requireObject(request.body, 'request body');
  const phoneNumber = requirePhoneNumber(body.phone_number);
  const clientIp = resolveClientIp(config, request);
  const requestedAt = config.now();
  const windowStartedAt = new Date(
    Math.floor(requestedAt.getTime() / (config.rateLimitWindowSeconds * 1000)) *
      config.rateLimitWindowSeconds *
      1000,
  );

  await consumeRateLimit(config, {
    key: `ip:${keyedHash(config.indexSecret, 'rate-ip', clientIp)}`,
    limit: config.ipRequestLimit,
    requestedAt,
    windowStartedAt,
  });
  await consumeRateLimit(config, {
    key: `phone:${keyedHash(
      config.indexSecret,
      'rate-phone',
      phoneNumber,
    )}`,
    limit: config.phoneRequestLimit,
    requestedAt,
    windowStartedAt,
  });

  const challengeId = randomBase64Url(config.randomBytes, 24);
  const code = normalizeSmsCode(config.codeGenerator());
  const expiresAt = new Date(
    requestedAt.getTime() + config.challengeTtlSeconds * 1000,
  );
  const challenge = {
    attempts: 0,
    challenge_id: challengeId,
    code_digest: digestSmsCode(
      config.tokenSecret,
      challengeId,
      phoneNumber,
      code,
    ),
    consumed_at: null,
    created_at: requestedAt.toISOString(),
    delivery_status: 'pending',
    expires_at: expiresAt.toISOString(),
    phone_number: phoneNumber,
  };

  await config.store.createAuthChallenge(challenge);

  try {
    await config.smsProvider.sendCode({
      challengeId,
      code,
      expiresAt: expiresAt.toISOString(),
      phoneNumber,
    });
    await config.store.markAuthChallengeDelivery(
      challengeId,
      'delivered',
      requestedAt.toISOString(),
    );
  } catch {
    await config.store.markAuthChallengeDelivery(
      challengeId,
      'delivery_failed',
      requestedAt.toISOString(),
    );
    throw authError(503, 'sms_delivery_failed', 'SMS delivery failed.');
  }

  return {
    challenge_id: challengeId,
    delivery: config.smsProvider.delivery ?? 'sms',
    expires_at: expiresAt.toISOString(),
    retry_after_seconds: config.rateLimitWindowSeconds,
  };
}

async function verifyCode(config, request) {
  const body = requireObject(request.body, 'request body');
  const challengeId = requireOpaqueId(body.challenge_id, 'challenge_id');
  const phoneNumber = requirePhoneNumber(body.phone_number);
  const smsCode = normalizeSmsCode(body.sms_code);
  const verifiedAt = config.now();
  const verification = await config.store.verifyAuthChallenge({
    challengeId,
    codeDigest: digestSmsCode(
      config.tokenSecret,
      challengeId,
      phoneNumber,
      smsCode,
    ),
    maxAttempts: config.verifyAttemptLimit,
    now: verifiedAt.toISOString(),
    phoneNumber,
  });

  assertChallengeVerified(verification.status);

  const sessionId = randomBase64Url(config.randomBytes, 24);
  const refreshToken = createRefreshToken(config, sessionId, 0);
  const accessExpiresAt = new Date(
    verifiedAt.getTime() + config.accessTokenTtlSeconds * 1000,
  );
  const refreshExpiresAt = new Date(
    verifiedAt.getTime() + config.refreshTokenTtlSeconds * 1000,
  );
  const session = {
    account_key: keyedHash(config.indexSecret, 'account', phoneNumber),
    access_expires_at: accessExpiresAt.toISOString(),
    created_at: verifiedAt.toISOString(),
    device_id: optionalBoundedString(body.device_id, 'device_id', 128),
    device_name: optionalBoundedString(body.device_name, 'device_name', 128),
    phone_number: phoneNumber,
    refresh_expires_at: refreshExpiresAt.toISOString(),
    refresh_rotation: 0,
    refresh_token_hash: hashToken(refreshToken),
    revoked_at: null,
    revoked_reason: null,
    session_id: sessionId,
    status: 'active',
    updated_at: verifiedAt.toISOString(),
  };

  const sessionCreated = await config.store.createAuthSession(session);

  if (!sessionCreated) {
    throw authError(
      403,
      'account_deletion_pending',
      'Account deletion is already pending.',
    );
  }

  return sessionResponse(
    createAccessToken(config, session, verifiedAt),
    refreshToken,
    session,
    config.accessTokenTtlSeconds,
  );
}

async function refresh(config, request) {
  const body = requireObject(request.body, 'request body');
  const currentRefreshToken = requireBoundedString(
    body.refresh_token,
    'refresh_token',
    2048,
  );
  const {rotation, sessionId} = parseRefreshToken(config, currentRefreshToken);
  const refreshedAt = config.now();
  const nextRefreshToken = createRefreshToken(config, sessionId, rotation + 1);
  const accessExpiresAt = new Date(
    refreshedAt.getTime() + config.accessTokenTtlSeconds * 1000,
  );
  const rotationResult = await config.store.rotateAuthSession({
    accessExpiresAt: accessExpiresAt.toISOString(),
    currentRefreshRotation: rotation,
    currentRefreshTokenHash: hashToken(currentRefreshToken),
    nextRefreshRotation: rotation + 1,
    nextRefreshTokenHash: hashToken(nextRefreshToken),
    now: refreshedAt.toISOString(),
    sessionId,
  });

  assertRefreshRotated(rotationResult.status);

  return sessionResponse(
    createAccessToken(config, rotationResult.session, refreshedAt),
    nextRefreshToken,
    rotationResult.session,
    config.accessTokenTtlSeconds,
  );
}

async function logout(config, request) {
  const access = readSignedAccessToken(config, request);
  await config.store.revokeAuthSession(
    access.session_id,
    config.now().toISOString(),
    'logout',
  );
}

async function requestAccountDeletion(config, request) {
  const access = readSignedAccessToken(config, request);
  const persistedSession = await config.store.getAuthSession(access.session_id);

  if (
    !persistedSession ||
    persistedSession.phone_number !== access.phone_number ||
    (persistedSession.status !== 'active' &&
      persistedSession.revoked_reason !== 'account_deletion_requested')
  ) {
    throw authError(401, 'revoked_auth_session', 'Auth session is not active.');
  }

  const session = {
    accountKey: persistedSession.account_key,
    phoneNumber: persistedSession.phone_number,
    sessionId: persistedSession.session_id,
  };
  const requestedAt = config.now().toISOString();
  const deletionTask = await config.store.getOrCreateAccountDeletionTask({
    account_key: session.accountKey,
    deletion_id: `delete_${randomBase64Url(config.randomBytes, 18)}`,
    phone_number: session.phoneNumber,
    requested_at: requestedAt,
    status: 'queued',
  });

  await config.store.revokeAuthSessionsByAccount(
    session.accountKey,
    requestedAt,
    'account_deletion_requested',
  );

  return {
    deletion_request: {
      id: deletionTask.deletion_id,
      requested_at: deletionTask.requested_at,
      status: deletionTask.status,
    },
  };
}

async function requireActiveSession(config, request) {
  const access = readSignedAccessToken(config, request);
  const session = await config.store.getAuthSession(access.session_id);

  if (
    !session ||
    session.status !== 'active' ||
    session.phone_number !== access.phone_number
  ) {
    throw authError(401, 'revoked_auth_session', 'Auth session is not active.');
  }

  const refreshExpiresAt = Date.parse(session.refresh_expires_at);

  if (
    !Number.isFinite(refreshExpiresAt) ||
    refreshExpiresAt <= config.now().getTime()
  ) {
    throw authError(401, 'expired_auth_session', 'Auth session has expired.');
  }

  return {
    phoneNumber: session.phone_number,
    sessionId: session.session_id,
  };
}

function readSignedAccessToken(config, request) {
  const authorization = getHeader(request.headers, 'authorization');

  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw authError(
      401,
      'missing_auth_token',
      'Authorization bearer token is required.',
    );
  }

  return verifyAccessToken(
    config,
    authorization.slice('Bearer '.length).trim(),
  );
}

function createAccessToken(config, session, issuedAt) {
  const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);
  const payload = {
    exp: issuedAtSeconds + config.accessTokenTtlSeconds,
    iat: issuedAtSeconds,
    phone_number: session.phone_number,
    session_id: session.session_id,
    type: 'access',
    version: 2,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(config.tokenSecret, encodedPayload);

  return `softbook_v2.${encodedPayload}.${signature}`;
}

function verifyAccessToken(config, token) {
  const parts = token.split('.');

  if (parts.length !== 3 || parts[0] !== 'softbook_v2') {
    throw authError(401, 'invalid_auth_token', 'Invalid authorization token.');
  }

  const [, encodedPayload, signature] = parts;
  const expectedSignature = sign(config.tokenSecret, encodedPayload);

  if (!safeEqual(signature, expectedSignature)) {
    throw authError(401, 'invalid_auth_token', 'Invalid authorization token.');
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    throw authError(401, 'invalid_auth_token', 'Invalid authorization token.');
  }

  if (
    !isObject(payload) ||
    payload.type !== 'access' ||
    payload.version !== 2 ||
    !Number.isInteger(payload.exp)
  ) {
    throw authError(401, 'invalid_auth_token', 'Invalid authorization token.');
  }

  const phoneNumber = requirePhoneNumberAsAuth(payload.phone_number);
  const sessionId = requireOpaqueIdAsAuth(payload.session_id);

  if (Math.floor(config.now().getTime() / 1000) >= payload.exp) {
    throw authError(401, 'expired_auth_token', 'Authorization token has expired.');
  }

  return {
    phone_number: phoneNumber,
    session_id: sessionId,
  };
}

function createRefreshToken(config, sessionId, rotation) {
  const payload = {
    nonce: randomBase64Url(config.randomBytes, 24),
    rotation,
    session_id: sessionId,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(config.tokenSecret, `refresh:${encodedPayload}`);

  return `softbook_refresh.${encodedPayload}.${signature}`;
}

function parseRefreshToken(config, token) {
  const parts = token.split('.');

  if (
    parts.length !== 3 ||
    parts[0] !== 'softbook_refresh' ||
    !/^[A-Za-z0-9_-]{32,1024}$/.test(parts[1]) ||
    !/^[A-Za-z0-9_-]{32,256}$/.test(parts[2]) ||
    !safeEqual(parts[2], sign(config.tokenSecret, `refresh:${parts[1]}`))
  ) {
    throw authError(401, 'invalid_refresh_token', 'Invalid refresh token.');
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    throw authError(401, 'invalid_refresh_token', 'Invalid refresh token.');
  }

  if (
    !isObject(payload) ||
    !Number.isSafeInteger(payload.rotation) ||
    payload.rotation < 0 ||
    payload.rotation >= Number.MAX_SAFE_INTEGER ||
    typeof payload.nonce !== 'string' ||
    !/^[A-Za-z0-9_-]{24,128}$/.test(payload.nonce)
  ) {
    throw authError(401, 'invalid_refresh_token', 'Invalid refresh token.');
  }

  let sessionId;
  try {
    sessionId = requireOpaqueId(payload.session_id, 'session_id');
  } catch {
    throw authError(401, 'invalid_refresh_token', 'Invalid refresh token.');
  }

  return {rotation: payload.rotation, sessionId};
}

function sessionResponse(accessToken, refreshToken, session, expiresIn) {
  return {
    access_token: accessToken,
    expires_in: expiresIn,
    phone_number: session.phone_number,
    refresh_expires_at: session.refresh_expires_at,
    refresh_token: refreshToken,
    session_id: session.session_id,
    token_type: 'Bearer',
  };
}

async function consumeRateLimit(
  config,
  {key, limit, requestedAt, windowStartedAt},
) {
  const accepted = await config.store.consumeAuthRateLimit({
    expiresAt: new Date(
      windowStartedAt.getTime() + config.rateLimitWindowSeconds * 1000 * 2,
    ).toISOString(),
    key,
    limit,
    now: requestedAt.toISOString(),
    windowStartedAt: windowStartedAt.toISOString(),
  });

  if (!accepted) {
    throw authError(429, 'sms_rate_limited', 'SMS request rate limit exceeded.');
  }
}

function assertChallengeVerified(status) {
  const errors = {
    consumed: [409, 'sms_challenge_consumed', 'SMS challenge was already used.'],
    expired: [401, 'expired_sms_challenge', 'SMS challenge has expired.'],
    invalid: [401, 'invalid_sms_code', 'Invalid SMS challenge or code.'],
    locked: [
      429,
      'sms_challenge_locked',
      'SMS challenge attempt limit exceeded.',
    ],
    not_found: [401, 'invalid_sms_code', 'Invalid SMS challenge or code.'],
    unavailable: [
      503,
      'sms_challenge_unavailable',
      'SMS challenge is unavailable.',
    ],
  };

  if (status === 'verified') {
    return;
  }

  const [statusCode, code, message] =
    errors[status] ??
    [500, 'auth_store_error', 'Auth store returned an invalid state.'];
  throw authError(statusCode, code, message);
}

function assertRefreshRotated(status) {
  const errors = {
    expired: [401, 'expired_refresh_token', 'Refresh token has expired.'],
    invalid: [401, 'invalid_refresh_token', 'Invalid refresh token.'],
    not_found: [401, 'invalid_refresh_token', 'Invalid refresh token.'],
    reused: [401, 'refresh_token_reused', 'Refresh token reuse was detected.'],
    revoked: [401, 'revoked_auth_session', 'Auth session is not active.'],
  };

  if (status === 'rotated') {
    return;
  }

  const [statusCode, code, message] =
    errors[status] ??
    [500, 'auth_store_error', 'Auth store returned an invalid state.'];
  throw authError(statusCode, code, message);
}

function validateServiceConfig(config) {
  if (!['development', 'production'].includes(config.runtimeMode)) {
    throw new Error(`Unsupported SOFTBOOK_RUNTIME_MODE: ${config.runtimeMode}`);
  }

  if (!config.store || typeof config.store !== 'object') {
    throw new Error('Auth v2 requires a store.');
  }

  const requiredStoreMethods = [
    'consumeAuthRateLimit',
    'createAuthChallenge',
    'markAuthChallengeDelivery',
    'verifyAuthChallenge',
    'createAuthSession',
    'getAuthSession',
    'rotateAuthSession',
    'revokeAuthSession',
    'revokeAuthSessionsByAccount',
    'getOrCreateAccountDeletionTask',
  ];

  for (const method of requiredStoreMethods) {
    if (typeof config.store[method] !== 'function') {
      throw new Error(`Auth v2 store is missing ${method}().`);
    }
  }

  if (
    !config.smsProvider ||
    typeof config.smsProvider.sendCode !== 'function'
  ) {
    throw new Error('Auth v2 requires an SMS provider.');
  }

  if (typeof config.tokenSecret !== 'string' || config.tokenSecret.length < 8) {
    throw new Error('Auth v2 token secret must contain at least 8 characters.');
  }

  if (typeof config.indexSecret !== 'string' || config.indexSecret.length < 8) {
    throw new Error('Auth v2 index secret must contain at least 8 characters.');
  }

  const positiveIntegers = [
    'accessTokenTtlSeconds',
    'challengeTtlSeconds',
    'ipRequestLimit',
    'phoneRequestLimit',
    'rateLimitWindowSeconds',
    'refreshTokenTtlSeconds',
    'verifyAttemptLimit',
  ];

  for (const key of positiveIntegers) {
    if (!Number.isInteger(config[key]) || config[key] <= 0) {
      throw new Error(`Auth v2 ${key} must be a positive integer.`);
    }
  }

  if (config.runtimeMode !== 'production') {
    return;
  }

  if (
    config.tokenSecret.length < 32 ||
    config.tokenSecret === 'softbook-cloudbase-dev-secret'
  ) {
    throw new Error('Production auth requires a non-default 32+ character secret.');
  }

  if (config.indexSecret.length < 32) {
    throw new Error('Production auth requires a 32+ character index secret.');
  }

  if (config.indexSecret === config.tokenSecret) {
    throw new Error(
      'Production auth requires separate token and index secrets.',
    );
  }

  if (!config.requireClientIp) {
    throw new Error('Production auth requires a trusted client IP.');
  }

  if (
    typeof config.store.kind !== 'string' ||
    config.store.kind.trim() === '' ||
    config.store.kind === 'memory'
  ) {
    throw new Error('Production auth requires a persistent store.');
  }

  if (
    typeof config.smsProvider.kind !== 'string' ||
    config.smsProvider.kind.trim() === '' ||
    config.smsProvider.kind === 'development'
  ) {
    throw new Error('Production auth requires a non-development SMS provider.');
  }
}

function resolveClientIp(config, request) {
  const value =
    typeof request.clientIp === 'string' ? request.clientIp.trim() : '';

  if (value) {
    return value.slice(0, 128);
  }

  if (config.requireClientIp) {
    throw authError(
      503,
      'client_ip_unavailable',
      'Trusted client IP is unavailable.',
    );
  }

  return 'development-unknown';
}

function requireObject(value, fieldName) {
  if (!isObject(value)) {
    throw authError(400, 'invalid_request', `${fieldName} must be an object.`);
  }

  return value;
}

function requirePhoneNumber(value) {
  if (typeof value !== 'string' || !/^1\d{10}$/.test(value)) {
    throw authError(
      400,
      'invalid_phone_number',
      'phone_number must be an 11-digit mainland China mobile number.',
    );
  }

  return value;
}

function requirePhoneNumberAsAuth(value) {
  try {
    return requirePhoneNumber(value);
  } catch {
    throw authError(401, 'invalid_auth_token', 'Invalid authorization token.');
  }
}

function requireOpaqueId(value, fieldName) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) {
    throw authError(400, 'invalid_request', `${fieldName} is invalid.`);
  }

  return value;
}

function requireOpaqueIdAsAuth(value) {
  try {
    return requireOpaqueId(value, 'session_id');
  } catch {
    throw authError(401, 'invalid_auth_token', 'Invalid authorization token.');
  }
}

function requireBoundedString(value, fieldName, maxLength) {
  if (
    typeof value !== 'string' ||
    value.trim() === '' ||
    value.length > maxLength
  ) {
    throw authError(400, 'invalid_request', `${fieldName} is invalid.`);
  }

  return value;
}

function optionalBoundedString(value, fieldName, maxLength) {
  if (value === undefined || value === null) {
    return null;
  }

  return requireBoundedString(value, fieldName, maxLength).trim();
}

function normalizeSmsCode(value) {
  if (typeof value !== 'string' || !/^\d{4,8}$/.test(value)) {
    throw authError(400, 'invalid_sms_code_format', 'sms_code is invalid.');
  }

  return value;
}

function generateSixDigitCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function digestSmsCode(secret, challengeId, phoneNumber, code) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${challengeId}:${phoneNumber}:${code}`)
    .digest('hex');
}

function sign(secret, encodedPayload) {
  return crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');
}

function hashToken(token) {
  return hashValue(token);
}

function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function keyedHash(secret, purpose, value) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${purpose}:${value}`)
    .digest('hex');
}

function randomBase64Url(randomBytes, size) {
  return Buffer.from(randomBytes(size)).toString('base64url');
}

function base64UrlEncode(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function getHeader(headers = {}, name) {
  const expected = name.toLowerCase();
  const entry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === expected,
  );

  return entry ? String(entry[1]) : undefined;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function authError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

module.exports = {
  createAuthV2Service,
  createDevelopmentSmsProvider,
};
