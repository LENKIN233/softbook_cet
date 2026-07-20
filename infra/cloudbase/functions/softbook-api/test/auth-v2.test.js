const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  createCloudBaseStore,
  createMemoryStore,
  createSoftbookApi,
} = require('../index');
const {createAuthV2Service} = require('../auth-v2');

const PHONE_NUMBER = '13800138000';
const SMS_CODE = '654321';
const TOKEN_SECRET = 'test-auth-v2-secret';

function createClock(initial = '2026-07-20T08:00:00.000Z') {
  let current = new Date(initial);

  return {
    advanceSeconds(seconds) {
      current = new Date(current.getTime() + seconds * 1000);
    },
    now: () => new Date(current),
  };
}

function createSmsProvider() {
  const deliveries = [];

  return {
    deliveries,
    provider: {
      delivery: 'test_sms',
      kind: 'test',
      sendCode: async delivery => {
        deliveries.push({...delivery});
      },
    },
  };
}

function createV2TestApi(options = {}) {
  const clock = options.clock ?? createClock();
  const sms = options.sms ?? createSmsProvider();
  const store = options.store ?? createMemoryStore();
  const api = createSoftbookApi({
    authV2CodeGenerator: () => SMS_CODE,
    authV2IpRequestLimit: options.ipRequestLimit,
    authV2PhoneRequestLimit: options.phoneRequestLimit,
    authV2VerifyAttemptLimit: options.verifyAttemptLimit,
    now: clock.now,
    runtimeMode: options.runtimeMode,
    smsProvider: sms.provider,
    store,
    tokenSecret: options.tokenSecret ?? TOKEN_SECRET,
  });

  return {api, clock, sms, store};
}

async function request(api, options) {
  return api.handleHttpRequest({
    body: options.body,
    clientIp: options.clientIp ?? '203.0.113.10',
    headers: options.headers ?? {},
    method: options.method ?? 'POST',
    path: options.path,
    query: options.query ?? {},
  });
}

async function issueChallenge(api, phoneNumber = PHONE_NUMBER, clientIp) {
  return request(api, {
    body: {phone_number: phoneNumber},
    clientIp,
    path: '/v2/auth/request-code',
  });
}

async function issueSession(api, options = {}) {
  const phoneNumber = options.phoneNumber ?? PHONE_NUMBER;
  const challenge = await issueChallenge(
    api,
    phoneNumber,
    options.clientIp,
  );
  assert.equal(challenge.statusCode, 200);

  const verified = await request(api, {
    body: {
      challenge_id: challenge.body.data.challenge_id,
      device_id: options.deviceId ?? 'ios-test-device',
      device_name: options.deviceName ?? 'iPhone test',
      phone_number: phoneNumber,
      sms_code: SMS_CODE,
    },
    clientIp: options.clientIp,
    path: '/v2/auth/verify-code',
  });
  assert.equal(verified.statusCode, 200);
  return verified.body.data;
}

test('v2 SMS challenge stores only a digest and issues a server-backed session', async () => {
  const {api, sms, store} = createV2TestApi();
  const challenge = await issueChallenge(api);

  assert.equal(challenge.statusCode, 200);
  assert.equal(challenge.body.data.delivery, 'test_sms');
  assert.equal('sms_code' in challenge.body.data, false);
  assert.equal(sms.deliveries.length, 1);
  assert.equal(sms.deliveries[0].code, SMS_CODE);

  const persistedChallenge = store
    .snapshot()
    .authChallenges.get(challenge.body.data.challenge_id);
  assert.equal(persistedChallenge.code_digest.length, 64);
  assert.equal(JSON.stringify(persistedChallenge).includes(SMS_CODE), false);
  const rawPhoneHash = crypto
    .createHash('sha256')
    .update(PHONE_NUMBER)
    .digest('hex');
  assert.equal(
    JSON.stringify([...store.snapshot().authRateLimits.entries()]).includes(
      rawPhoneHash,
    ),
    false,
  );

  const verified = await request(api, {
    body: {
      challenge_id: challenge.body.data.challenge_id,
      device_id: 'ios-device-1',
      device_name: 'iPhone 15',
      phone_number: PHONE_NUMBER,
      sms_code: SMS_CODE,
    },
    path: '/v2/auth/verify-code',
  });

  assert.equal(verified.statusCode, 200);
  assert.match(verified.body.data.access_token, /^softbook_v2\./);
  assert.match(verified.body.data.refresh_token, /^softbook_refresh\./);
  assert.equal(verified.body.data.expires_in, 900);
  const persistedSession = store
    .snapshot()
    .authSessions.get(verified.body.data.session_id);
  assert.equal(persistedSession.device_id, 'ios-device-1');
  assert.equal(persistedSession.refresh_token_hash.length, 64);
  assert.equal(
    JSON.stringify(persistedSession).includes(verified.body.data.refresh_token),
    false,
  );
});

test('v2 SMS challenges are one-time and lock after the configured attempt limit', async () => {
  const {api} = createV2TestApi({verifyAttemptLimit: 2});
  const lockedChallenge = await issueChallenge(api);
  const invalid = body =>
    request(api, {
      body: {
        challenge_id: lockedChallenge.body.data.challenge_id,
        phone_number: PHONE_NUMBER,
        sms_code: body,
      },
      path: '/v2/auth/verify-code',
    });

  assert.equal((await invalid('000000')).body.error.code, 'invalid_sms_code');
  assert.equal((await invalid('000001')).body.error.code, 'sms_challenge_locked');
  assert.equal((await invalid(SMS_CODE)).body.error.code, 'sms_challenge_locked');

  const consumedChallenge = await issueChallenge(api, '13900139000');
  const verifyBody = {
    challenge_id: consumedChallenge.body.data.challenge_id,
    phone_number: '13900139000',
    sms_code: SMS_CODE,
  };

  assert.equal(
    (await request(api, {body: verifyBody, path: '/v2/auth/verify-code'}))
      .statusCode,
    200,
  );
  const replay = await request(api, {
    body: verifyBody,
    path: '/v2/auth/verify-code',
  });
  assert.equal(replay.statusCode, 409);
  assert.equal(replay.body.error.code, 'sms_challenge_consumed');
});

test('v2 request-code enforces independent phone and client-IP limits', async () => {
  const phoneLimited = createV2TestApi({phoneRequestLimit: 1});
  assert.equal((await issueChallenge(phoneLimited.api)).statusCode, 200);
  const phoneRejected = await issueChallenge(
    phoneLimited.api,
    PHONE_NUMBER,
    '203.0.113.11',
  );
  assert.equal(phoneRejected.statusCode, 429);
  assert.equal(phoneRejected.body.error.code, 'sms_rate_limited');

  const ipLimited = createV2TestApi({ipRequestLimit: 1});
  assert.equal((await issueChallenge(ipLimited.api)).statusCode, 200);
  const ipRejected = await issueChallenge(
    ipLimited.api,
    '13900139000',
    '203.0.113.10',
  );
  assert.equal(ipRejected.statusCode, 429);
  assert.equal(ipRejected.body.error.code, 'sms_rate_limited');
  assert.equal(
    (
      await issueChallenge(
        ipLimited.api,
        '13900139000',
        '203.0.113.12',
      )
    ).statusCode,
    200,
  );
});

test('v2 records failed SMS delivery and does not activate that challenge', async () => {
  const store = createMemoryStore();
  const api = createSoftbookApi({
    authV2CodeGenerator: () => SMS_CODE,
    now: createClock().now,
    smsProvider: {
      delivery: 'test_sms',
      kind: 'test',
      sendCode: async () => {
        throw new Error('provider detail must stay private');
      },
    },
    store,
    tokenSecret: TOKEN_SECRET,
  });
  const response = await issueChallenge(api);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error.code, 'sms_delivery_failed');
  assert.equal(response.body.error.message, 'Internal Softbook API error.');
  const persisted = [...store.snapshot().authChallenges.values()][0];
  assert.equal(persisted.delivery_status, 'delivery_failed');
  assert.equal(JSON.stringify(persisted).includes(SMS_CODE), false);
});

test('v2 refresh rotates tokens and revokes the session when an old token is replayed', async () => {
  const {api, store} = createV2TestApi();
  const session = await issueSession(api);
  const rotated = await request(api, {
    body: {refresh_token: session.refresh_token},
    path: '/v2/auth/refresh',
  });

  assert.equal(rotated.statusCode, 200);
  assert.notEqual(rotated.body.data.refresh_token, session.refresh_token);

  const replay = await request(api, {
    body: {refresh_token: session.refresh_token},
    path: '/v2/auth/refresh',
  });
  assert.equal(replay.statusCode, 401);
  assert.equal(replay.body.error.code, 'refresh_token_reused');
  assert.equal(
    store.snapshot().authSessions.get(session.session_id).revoked_reason,
    'refresh_token_reuse',
  );

  const rejectedCurrent = await request(api, {
    body: {refresh_token: rotated.body.data.refresh_token},
    path: '/v2/auth/refresh',
  });
  assert.equal(rejectedCurrent.body.error.code, 'revoked_auth_session');
});

test('v2 logout is idempotent and account deletion queues once then revokes all sessions', async () => {
  const {api, store} = createV2TestApi();
  const loggedOut = await issueSession(api);
  const logoutRequest = {
    headers: {authorization: `Bearer ${loggedOut.access_token}`},
    path: '/v2/auth/logout',
  };

  assert.equal((await request(api, logoutRequest)).statusCode, 204);
  assert.equal((await request(api, logoutRequest)).statusCode, 204);

  const deletingSession = await issueSession(api, {
    clientIp: '203.0.113.20',
    deviceId: 'device-delete',
  });
  const siblingSession = await issueSession(api, {
    clientIp: '203.0.113.21',
    deviceId: 'device-sibling',
  });
  const deletionRequest = {
    headers: {authorization: `Bearer ${deletingSession.access_token}`},
    path: '/v2/account/deletion',
  };
  const first = await request(api, deletionRequest);
  const repeated = await request(api, deletionRequest);

  assert.equal(first.statusCode, 202);
  assert.equal(repeated.statusCode, 202);
  assert.deepEqual(repeated.body.data, first.body.data);
  assert.equal(store.snapshot().accountDeletions.size, 1);
  assert.match(first.body.data.deletion_request.id, /^delete_[A-Za-z0-9_-]+$/);
  assert.equal(
    first.body.data.deletion_request.id.includes(
      crypto.createHash('sha256').update(PHONE_NUMBER).digest('hex').slice(0, 24),
    ),
    false,
  );
  assert.equal(
    store.snapshot().authSessions.get(deletingSession.session_id).status,
    'revoked',
  );
  assert.equal(
    store.snapshot().authSessions.get(siblingSession.session_id).status,
    'revoked',
  );

  const challengeAfterDeletion = await issueChallenge(
    api,
    PHONE_NUMBER,
    '203.0.113.23',
  );
  const loginAfterDeletion = await request(api, {
    body: {
      challenge_id: challengeAfterDeletion.body.data.challenge_id,
      phone_number: PHONE_NUMBER,
      sms_code: SMS_CODE,
    },
    path: '/v2/auth/verify-code',
  });
  assert.equal(loginAfterDeletion.statusCode, 403);
  assert.equal(loginAfterDeletion.body.error.code, 'account_deletion_pending');
  assert.equal(
    [...store.snapshot().authSessions.values()].some(
      session => session.status === 'active',
    ),
    false,
  );
});

test('v2 deletion task blocks refresh even when account-wide revocation is interrupted', async () => {
  const store = createMemoryStore();
  const {api} = createV2TestApi({store});
  const session = await issueSession(api);
  store.revokeAuthSessionsByAccount = async () => {
    throw new Error('simulated revocation interruption');
  };

  const deletion = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    path: '/v2/account/deletion',
  });
  assert.equal(deletion.statusCode, 500);
  assert.equal(store.snapshot().accountDeletions.size, 1);
  assert.equal(
    store.snapshot().authSessions.get(session.session_id).status,
    'active',
  );

  const refresh = await request(api, {
    body: {refresh_token: session.refresh_token},
    path: '/v2/auth/refresh',
  });
  assert.equal(refresh.statusCode, 401);
  assert.equal(refresh.body.error.code, 'revoked_auth_session');
  assert.equal(
    store.snapshot().authSessions.get(session.session_id).revoked_reason,
    'account_deletion_requested',
  );
});

test('v2 active-session guard denies access when a deletion task exists', async () => {
  const clock = createClock();
  const sms = createSmsProvider();
  const store = createMemoryStore();
  const service = createAuthV2Service({
    codeGenerator: () => SMS_CODE,
    developmentSmsCode: SMS_CODE,
    now: clock.now,
    smsProvider: sms.provider,
    store,
    tokenSecret: TOKEN_SECRET,
  });
  const challenge = await service.requestCode({
    body: {phone_number: PHONE_NUMBER},
    clientIp: '203.0.113.30',
    headers: {},
  });
  const session = await service.verifyCode({
    body: {
      challenge_id: challenge.challenge_id,
      phone_number: PHONE_NUMBER,
      sms_code: SMS_CODE,
    },
    headers: {},
  });
  const persistedSession = store
    .snapshot()
    .authSessions.get(session.session_id);
  await store.getOrCreateAccountDeletionTask({
    account_key: persistedSession.account_key,
    deletion_id: 'delete_active_guard_test',
    phone_number: PHONE_NUMBER,
    requested_at: clock.now().toISOString(),
    status: 'queued',
  });

  await assert.rejects(
    () =>
      service.requireActiveSession({
        headers: {authorization: `Bearer ${session.access_token}`},
      }),
    error => error.code === 'revoked_auth_session',
  );
  assert.equal(
    store.snapshot().authSessions.get(session.session_id).revoked_reason,
    'account_deletion_requested',
  );
});

test('v2 rejects expired challenges, access tokens, and refresh tokens', async () => {
  const clock = createClock();
  const {api} = createV2TestApi({clock});
  const challenge = await issueChallenge(api);
  clock.advanceSeconds(301);

  const expiredChallenge = await request(api, {
    body: {
      challenge_id: challenge.body.data.challenge_id,
      phone_number: PHONE_NUMBER,
      sms_code: SMS_CODE,
    },
    path: '/v2/auth/verify-code',
  });
  assert.equal(expiredChallenge.body.error.code, 'expired_sms_challenge');

  const session = await issueSession(api, {clientIp: '203.0.113.22'});
  clock.advanceSeconds(901);
  const expiredAccess = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    path: '/v2/account/deletion',
  });
  assert.equal(expiredAccess.body.error.code, 'expired_auth_token');

  clock.advanceSeconds(30 * 24 * 60 * 60);
  const expiredRefresh = await request(api, {
    body: {refresh_token: session.refresh_token},
    path: '/v2/auth/refresh',
  });
  assert.equal(expiredRefresh.body.error.code, 'expired_refresh_token');
});

test('v2 auth state survives separate CloudBase function instances', async () => {
  const db = createFakeCloudBaseDb();
  const sms = createSmsProvider();
  const first = createV2TestApi({
    sms,
    store: createCloudBaseStore({db}),
  });
  const second = createV2TestApi({
    sms,
    store: createCloudBaseStore({db}),
  });
  const challenge = await issueChallenge(first.api);
  const verified = await request(second.api, {
    body: {
      challenge_id: challenge.body.data.challenge_id,
      phone_number: PHONE_NUMBER,
      sms_code: SMS_CODE,
    },
    path: '/v2/auth/verify-code',
  });
  const refreshed = await request(first.api, {
    body: {refresh_token: verified.body.data.refresh_token},
    path: '/v2/auth/refresh',
  });

  assert.equal(verified.statusCode, 200);
  assert.equal(refreshed.statusCode, 200);
  assert.equal(db.snapshot().get('softbook_auth_challenges').size, 1);
  assert.equal(db.snapshot().get('softbook_auth_sessions').size, 1);
  assert.equal(
    JSON.stringify(
      [...db.snapshot().get('softbook_auth_sessions').values()],
    ).includes(refreshed.body.data.refresh_token),
    false,
  );

  const siblingSession = await issueSession(second.api, {
    clientIp: '203.0.113.31',
    deviceId: 'cloudbase-refresh-boundary',
  });

  const persistedSession = db
    .snapshot()
    .get('softbook_auth_sessions')
    .get(verified.body.data.session_id);
  await first.store.getOrCreateAccountDeletionTask({
    account_key: persistedSession.account_key,
    deletion_id: 'delete_cloudbase_test',
    phone_number: PHONE_NUMBER,
    requested_at: '2026-07-20T08:00:00.000Z',
    status: 'queued',
  });
  assert.equal(
    await first.store.getActiveAuthSession(
      verified.body.data.session_id,
      '2026-07-20T08:00:01.000Z',
    ),
    null,
  );
  const blockedRefresh = await request(second.api, {
    body: {refresh_token: siblingSession.refresh_token},
    path: '/v2/auth/refresh',
  });
  assert.equal(blockedRefresh.statusCode, 401);
  assert.equal(blockedRefresh.body.error.code, 'revoked_auth_session');
  assert.equal(
    db
      .snapshot()
      .get('softbook_auth_sessions')
      .get(siblingSession.session_id).revoked_reason,
    'account_deletion_requested',
  );
});

test('production auth fails closed on weak configuration and missing trusted client IP', async () => {
  assert.throws(
    () =>
      createSoftbookApi({
        authV2IndexSecret: 'b'.repeat(32),
        runtimeMode: 'production',
        tokenSecret: 'short-secret',
      }),
    /32\+ character secret/,
  );
  assert.throws(
    () =>
      createSoftbookApi({
        runtimeMode: 'production',
        tokenSecret: 'a'.repeat(32),
      }),
    /index secret/,
  );
  assert.throws(
    () =>
      createSoftbookApi({
        authV2IndexSecret: 'b'.repeat(32),
        runtimeMode: 'production',
        tokenSecret: 'a'.repeat(32),
      }),
    /persistent store/,
  );

  const persistentStore = createMemoryStore();
  persistentStore.kind = 'test-persistent';
  assert.throws(
    () =>
      createSoftbookApi({
        authV2IndexSecret: 'b'.repeat(32),
        runtimeMode: 'production',
        store: persistentStore,
        tokenSecret: 'a'.repeat(32),
      }),
    /non-development SMS provider/,
  );

  const sms = createSmsProvider();
  assert.throws(
    () =>
      createSoftbookApi({
        authV2IndexSecret: 'a'.repeat(32),
        runtimeMode: 'production',
        smsProvider: sms.provider,
        store: persistentStore,
        tokenSecret: 'a'.repeat(32),
      }),
    /separate token and index secrets/,
  );
  assert.throws(
    () =>
      createSoftbookApi({
        authV2IndexSecret: 'b'.repeat(32),
        authV2RequireClientIp: false,
        runtimeMode: 'production',
        smsProvider: sms.provider,
        store: persistentStore,
        tokenSecret: 'a'.repeat(32),
      }),
    /trusted client IP/,
  );
  const api = createSoftbookApi({
    allowLegacyV1: true,
    authV2CodeGenerator: () => SMS_CODE,
    authV2IndexSecret: 'b'.repeat(32),
    runtimeMode: 'production',
    smsProvider: sms.provider,
    store: persistentStore,
    tokenSecret: 'a'.repeat(32),
  });
  const response = await api.handleHttpRequest({
    body: {phone_number: PHONE_NUMBER},
    headers: {},
    method: 'POST',
    path: '/v2/auth/request-code',
    query: {},
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error.code, 'client_ip_unavailable');

  const legacyResponse = await api.handleHttpRequest({
    body: {phone_number: PHONE_NUMBER},
    clientIp: '203.0.113.99',
    headers: {},
    method: 'POST',
    path: '/v1/auth/request-code',
    query: {},
  });
  assert.equal(legacyResponse.statusCode, 410);
  assert.equal(legacyResponse.body.error.code, 'legacy_api_disabled');
});

test('unknown v2 routes return not-found without falling through to v1 auth', async () => {
  const {api} = createV2TestApi();
  const response = await request(api, {
    method: 'GET',
    path: '/v2/not-a-route',
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.error.code, 'not_found');
});

test('CloudBase adapter discovers v2 paths and trusted gateway source IP', async () => {
  const sms = createSmsProvider();
  const {api} = createV2TestApi({sms});
  const response = await api.handleCloudBaseEvent({
    body: JSON.stringify({phone_number: PHONE_NUMBER}),
    headers: {'content-type': 'application/json'},
    requestContext: {
      http: {
        method: 'POST',
        path: '/softbook-api/v2/auth/request-code',
        sourceIp: '203.0.113.55',
      },
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).data.delivery, 'test_sms');
});

function createFakeCloudBaseDb() {
  const collections = new Map();
  let transactionTail = Promise.resolve();

  const collection = name => {
    if (!collections.has(name)) {
      collections.set(name, new Map());
    }

    const documents = collections.get(name);

    return {
      doc: documentId => ({
        get: async () => ({
          data: documents.has(documentId)
            ? [{_id: documentId, ...cloneJson(documents.get(documentId))}]
            : [],
        }),
        set: async data => {
          documents.set(documentId, cloneJson(data));
          return {id: documentId};
        },
      }),
      where: query => ({
        get: async () => ({
          data: [...documents.entries()]
            .filter(([, document]) =>
              Object.entries(query).every(
                ([key, value]) => document[key] === value,
              ),
            )
            .map(([documentId, document]) => ({
              _id: documentId,
              ...cloneJson(document),
            })),
        }),
      }),
    };
  };

  return {
    collection,
    runTransaction: callback => {
      const run = transactionTail.then(() => callback({collection}));
      transactionTail = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    snapshot: () => collections,
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
