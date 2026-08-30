const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  createCloudBaseStore,
  createMemoryStore,
  createSoftbookApi,
} = require('../index');
const {createAuthV2Service: createAuthV2ServiceRuntime} = require('../auth-v2');

const PHONE_NUMBER = '13800138000';
const SMS_CODE = '654321';
const TOKEN_SECRET = 'test-auth-v2-secret';

function createAuthV2Service(options) {
  return createAuthV2ServiceRuntime({
    acknowledgementSleeper: async () => undefined,
    ...options,
  });
}

function createClock(initial = '2026-07-20T08:00:00.000Z') {
  let current = new Date(initial);

  return {
    advanceSeconds(seconds) {
      current = new Date(current.getTime() + seconds * 1000);
    },
    now: () => new Date(current),
  };
}

function deletionTaskFixture(accountKey, overrides = {}) {
  return {
    account_instance_id: `account_${'a'.repeat(24)}`,
    account_key: accountKey,
    attempt_count: 0,
    deletion_id: 'delete_auth_v2_fixture_0001',
    last_attempt_at: null,
    last_failure_code: null,
    lease_expires_at: null,
    lease_id: null,
    origin_session_id: 'session_origin_fixture_0001',
    phone_number: PHONE_NUMBER,
    phone_rate_key: `phone:${'d'.repeat(64)}`,
    requested_at: '2026-07-20T07:59:00.000Z',
    schema_version: 'account-deletion-task.v2',
    status: 'queued',
    ...overrides,
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
    authV2AcknowledgementSleeper:
      options.useRealAcknowledgementSleeper
        ? undefined
        : options.acknowledgementSleeper ?? (async () => undefined),
    authV2CodeGenerator: () => SMS_CODE,
    authV2IndexSecret:
      options.indexSecret ?? 'softbook-cloudbase-dev-secret',
    authV2IpRequestLimit: options.ipRequestLimit,
    authV2PhoneRequestLimit: options.phoneRequestLimit,
    authV2ProviderDeliveryDeadlineMs: options.providerDeliveryDeadlineMs,
    authV2VerifyAttemptLimit: options.verifyAttemptLimit,
    now: clock.now,
    runtimeMode: options.runtimeMode ?? 'development',
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
  const persistedAccount = store.snapshot().accounts.get(
    persistedSession.account_key,
  );
  assert.equal(persistedAccount.schema_version, 'account-instance.v1');
  assert.match(persistedAccount.account_instance_id, /^account_[A-Za-z0-9_-]{24,}$/);
  assert.equal(Object.hasOwn(persistedAccount, 'phone_number'), false);
  assert.equal(
    persistedSession.account_instance_id,
    persistedAccount.account_instance_id,
  );
  assert.equal(persistedSession.refresh_token_hash.length, 64);
  assert.equal(
    JSON.stringify(persistedSession).includes(verified.body.data.refresh_token),
    false,
  );
});

test('two accountless challenges can create only one account instance', async () => {
  for (const [kind, store, snapshot] of [
    [
      'memory',
      createMemoryStore(),
      value => value.snapshot(),
    ],
    [
      'cloudbase',
      createCloudBaseStore({db: createFakeCloudBaseDb()}),
      value => value,
    ],
  ]) {
    const {api} = createV2TestApi({store});
    const firstChallenge = await issueChallenge(api, PHONE_NUMBER, '203.0.113.11');
    const secondChallenge = await issueChallenge(api, PHONE_NUMBER, '203.0.113.12');
    const verify = challenge => request(api, {
      body: {
        challenge_id: challenge.body.data.challenge_id,
        phone_number: PHONE_NUMBER,
        sms_code: SMS_CODE,
      },
      path: '/v2/auth/verify-code',
    });

    const first = await verify(firstChallenge);
    const second = await verify(secondChallenge);

    assert.equal(first.statusCode, 200, kind);
    assert.equal(second.statusCode, 409, kind);
    assert.equal(second.body.error.code, 'account_instance_changed', kind);
    if (kind === 'memory') {
      assert.equal(snapshot(store).accounts.size, 1);
      assert.equal(snapshot(store).authSessions.size, 1);
    }
  }
});

test('old session, challenge, read, and deletion request cannot cross delete and re-registration', async () => {
  const {api, store} = createV2TestApi();
  const first = await issueSession(api, {clientIp: '203.0.113.13'});
  const firstStoredSession = store.snapshot().authSessions.get(first.session_id);
  const oldChallenge = await issueChallenge(api, PHONE_NUMBER, '203.0.113.14');
  const oldChallengeRecord = structuredClone(
    store.snapshot().authChallenges.get(oldChallenge.body.data.challenge_id),
  );
  const oldHeaders = {authorization: `Bearer ${first.access_token}`};
  const deletion = await request(api, {
    body: {},
    headers: oldHeaders,
    path: '/v2/account/deletion',
  });
  assert.equal(deletion.statusCode, 202);
  const worker = await store.runAccountDeletionWorkerForTest();
  assert.equal(worker.completed_count, 1);
  const second = await issueSession(api, {clientIp: '203.0.113.15'});
  const secondStoredSession = store.snapshot().authSessions.get(second.session_id);
  assert.notEqual(
    firstStoredSession.account_instance_id,
    secondStoredSession.account_instance_id,
  );

  store.snapshot().authChallenges.set(
    oldChallenge.body.data.challenge_id,
    oldChallengeRecord,
  );
  const staleChallenge = await request(api, {
    body: {
      challenge_id: oldChallenge.body.data.challenge_id,
      phone_number: PHONE_NUMBER,
      sms_code: SMS_CODE,
    },
    path: '/v2/auth/verify-code',
  });
  assert.equal(staleChallenge.statusCode, 409);
  assert.equal(staleChallenge.body.error.code, 'account_instance_changed');

  const staleRead = await request(api, {
    headers: oldHeaders,
    method: 'GET',
    path: '/v2/membership/entitlement',
  });
  const staleWrite = await request(api, {
    body: {day_key: '2026-07-20'},
    headers: oldHeaders,
    path: '/v2/progress/check-in',
  });
  const staleDeletion = await request(api, {
    body: {},
    headers: oldHeaders,
    path: '/v2/account/deletion',
  });
  for (const response of [staleRead, staleWrite, staleDeletion]) {
    assert.equal(response.statusCode, 401);
    assert.equal(response.body.error.code, 'revoked_auth_session');
  }

  const currentWrite = await request(api, {
    body: {day_key: '2026-07-20'},
    headers: {authorization: `Bearer ${second.access_token}`},
    path: '/v2/progress/check-in',
  });
  assert.equal(currentWrite.statusCode, 200);
});

test('memory and CloudBase both fail a missing account instance as revoked session', async () => {
  const cloudDb = createFakeCloudBaseDb();
  const variants = [
    ['memory', createMemoryStore(), null],
    ['cloudbase', createCloudBaseStore({db: cloudDb}), cloudDb],
  ];
  for (const [kind, store, db] of variants) {
    const {api} = createV2TestApi({store});
    const session = await issueSession(api, {
      clientIp: kind === 'memory' ? '203.0.113.17' : '203.0.113.18',
    });
    const persisted = kind === 'memory'
      ? store.snapshot().authSessions.get(session.session_id)
      : db.snapshot().get('softbook_auth_sessions').get(session.session_id);
    if (kind === 'memory') {
      store.snapshot().accounts.delete(persisted.account_key);
    } else {
      db.snapshot().get('softbook_accounts').delete(persisted.account_key);
    }
    const response = await request(api, {
      headers: {authorization: `Bearer ${session.access_token}`},
      method: 'GET',
      path: '/v2/membership/entitlement',
    });
    assert.equal(response.statusCode, 401, kind);
    assert.equal(response.body.error.code, 'revoked_auth_session', kind);
  }
});

test('v2 delegates provider-owned SMS challenges without storing or generating the code', async () => {
  const calls = [];
  const sms = {
    provider: {
      delivery: 'sms_cloudbase_auth_default',
      kind: 'cloudbase_auth',
      async sendChallenge(input) {
        calls.push({kind: 'send', ...input});
        return {
          challengeId: 'cloudbase-verification-123456',
          expiresInSeconds: 600,
        };
      },
      async verifyChallenge(input) {
        calls.push({kind: 'verify', ...input});
        if (input.code !== SMS_CODE) throw new Error('provider rejected code');
      },
    },
  };
  const productionSecret = 'test-auth-v2-secret-0123456789-abcdef';
  const persistentStore = createMemoryStore();
  persistentStore.kind = 'cloudbase-test';
  const {api, store} = createV2TestApi({
    indexSecret: `${productionSecret}-index`,
    runtimeMode: 'production',
    sms,
    store: persistentStore,
    tokenSecret: productionSecret,
  });
  const challenge = await issueChallenge(api);

  assert.equal(challenge.statusCode, 200);
  assert.match(challenge.body.data.challenge_id, /^[A-Za-z0-9_-]{32}$/);
  assert.notEqual(
    challenge.body.data.challenge_id,
    'cloudbase-verification-123456',
  );
  assert.equal(challenge.body.data.delivery, 'sms_cloudbase_auth_default');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, 'send');
  assert.equal(calls[0].phoneNumber, PHONE_NUMBER);
  assert.equal(calls[0].signal instanceof AbortSignal, true);
  const persisted = store
    .snapshot()
    .authChallenges.get(challenge.body.data.challenge_id);
  assert.equal(persisted.code_digest.length, 64);
  assert.equal(
    persisted.provider_challenge_id,
    'cloudbase-verification-123456',
  );
  assert.equal(persisted.purpose, 'sign_in');
  assert.equal(JSON.stringify(persisted).includes(SMS_CODE), false);

  const invalid = await request(api, {
    body: {
      challenge_id: challenge.body.data.challenge_id,
      phone_number: PHONE_NUMBER,
      sms_code: '000000',
    },
    path: '/v2/auth/verify-code',
  });
  assert.equal(invalid.statusCode, 401);
  assert.equal(invalid.body.error.code, 'invalid_sms_code');
  assert.equal(
    store
      .snapshot()
      .authChallenges.get(challenge.body.data.challenge_id).attempts,
    1,
  );

  const verified = await request(api, {
    body: {
      challenge_id: challenge.body.data.challenge_id,
      phone_number: PHONE_NUMBER,
      sms_code: SMS_CODE,
    },
    path: '/v2/auth/verify-code',
  });
  assert.equal(verified.statusCode, 200);
  assert.match(verified.body.data.access_token, /^softbook_v2\./);
  assert.deepEqual(calls.slice(1), [
    {
      challengeId: 'cloudbase-verification-123456',
      code: '000000',
      kind: 'verify',
      phoneNumber: PHONE_NUMBER,
    },
    {
      challengeId: 'cloudbase-verification-123456',
      code: SMS_CODE,
      kind: 'verify',
      phoneNumber: PHONE_NUMBER,
    },
  ]);
});

test('provider-owned SMS failures consume the local attempt limit and lock the challenge', async () => {
  const sms = {
    provider: {
      delivery: 'sms_cloudbase_auth_default',
      kind: 'cloudbase_auth',
      async sendChallenge() {
        return {
          challengeId: 'cloudbase-verification-attempts',
          expiresInSeconds: 300,
        };
      },
      async verifyChallenge(input) {
        if (input.code !== SMS_CODE) throw new Error('provider rejected code');
      },
    },
  };
  const productionSecret = 'provider-attempt-secret-0123456789-abcdef';
  const persistentStore = createMemoryStore();
  persistentStore.kind = 'cloudbase-test';
  const {api, store} = createV2TestApi({
    indexSecret: `${productionSecret}-index`,
    runtimeMode: 'production',
    sms,
    store: persistentStore,
    tokenSecret: productionSecret,
    verifyAttemptLimit: 2,
  });
  const challenge = await issueChallenge(api);
  const verify = smsCode =>
    request(api, {
      body: {
        challenge_id: challenge.body.data.challenge_id,
        phone_number: PHONE_NUMBER,
        sms_code: smsCode,
      },
      path: '/v2/auth/verify-code',
    });

  const first = await verify('000000');
  assert.equal(first.statusCode, 401);
  assert.equal(first.body.error.code, 'invalid_sms_code');
  const second = await verify('111111');
  assert.equal(second.statusCode, 429);
  assert.equal(second.body.error.code, 'sms_challenge_locked');
  assert.equal(
    store
      .snapshot()
      .authChallenges.get(challenge.body.data.challenge_id).attempts,
    2,
  );

  const correctAfterLock = await verify(SMS_CODE);
  assert.equal(correctAfterLock.statusCode, 429);
  assert.equal(correctAfterLock.body.error.code, 'sms_challenge_locked');
  assert.equal(store.snapshot().authSessions.size, 0);
});

test('development v1 product routes accept only active v2 sessions', async () => {
  const {api} = createV2TestApi();
  const session = await issueSession(api);
  const headers = {authorization: `Bearer ${session.access_token}`};

  const activeResponse = await request(api, {
    headers,
    method: 'GET',
    path: '/v1/membership/entitlement',
  });
  assert.equal(activeResponse.statusCode, 200);

  const deletionResponse = await request(api, {
    headers,
    path: '/v2/account/deletion',
  });
  assert.equal(deletionResponse.statusCode, 202);

  const revokedResponse = await request(api, {
    headers,
    method: 'GET',
    path: '/v1/membership/entitlement',
  });
  assert.equal(revokedResponse.statusCode, 401);
  assert.equal(revokedResponse.body.error.code, 'revoked_auth_session');
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
  assert.equal(phoneRejected.statusCode, 200);
  assert.notEqual(
    phoneRejected.body.data.challenge_id,
    phoneLimited.sms.deliveries[0].challengeId,
  );
  assert.equal(phoneLimited.sms.deliveries.length, 1);
  assert.equal(phoneLimited.store.snapshot().authChallenges.size, 1);

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
    authV2AcknowledgementSleeper: async () => undefined,
    authV2CodeGenerator: () => SMS_CODE,
    now: createClock().now,
    runtimeMode: 'development',
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

  assert.equal(response.statusCode, 200);
  assert.deepEqual(Object.keys(response.body.data).sort(), [
    'challenge_id',
    'delivery',
    'expires_at',
    'retry_after_seconds',
  ]);
  const persisted = [...store.snapshot().authChallenges.values()][0];
  assert.equal(persisted.delivery_status, 'delivery_failed');
  assert.equal(JSON.stringify(persisted).includes(SMS_CODE), false);
});

test('provider completion cannot recreate a deleted local challenge intent', async () => {
  let providerStarted;
  let releaseProvider;
  const started = new Promise(resolve => {
    providerStarted = resolve;
  });
  const store = createMemoryStore();
  const service = createAuthV2Service({
    acknowledgementSleeper: async () => undefined,
    indexSecret: TOKEN_SECRET,
    now: createClock().now,
    providerDeliveryDeadlineMs: 1000,
    smsProvider: {
      delivery: 'provider_pause',
      kind: 'test',
      sendChallenge: async () => {
        providerStarted();
        return new Promise(resolve => {
          releaseProvider = () =>
            resolve({
              challengeId: 'provider-conditional-id',
              expiresInSeconds: 300,
            });
        });
      },
      verifyChallenge: async () => undefined,
    },
    store,
    tokenSecret: TOKEN_SECRET,
  });
  const requestPromise = service.requestCode({
    body: {phone_number: PHONE_NUMBER},
    clientIp: '203.0.113.140',
  });
  await started;
  const [localChallengeId] = store.snapshot().authChallenges.keys();
  assert.equal(
    store.snapshot().authChallenges.get(localChallengeId).delivery_status,
    'pending',
  );
  store.snapshot().authChallenges.delete(localChallengeId);
  releaseProvider();

  const response = await requestPromise;
  assert.equal(response.challenge_id, localChallengeId);
  assert.equal(store.snapshot().authChallenges.has(localChallengeId), false);
});

test('provider failure and timeout acknowledgements cannot enumerate deletion state', async () => {
  const states = [
    'absent',
    'queued',
    'processing',
    'finalizing',
    'malformed',
  ];
  const endpoints = [
    {
      name: 'ordinary',
      requestPath: '/v2/auth/request-code',
      verifyPath: '/v2/auth/verify-code',
    },
    {
      name: 'recovery',
      requestPath: '/v2/account/deletion/recovery/request-code',
      verifyPath: '/v2/account/deletion/recovery/verify-code',
    },
  ];
  const baselineByEndpoint = new Map();

  async function verifyMatrixCase(providerStyle, deliveryMode, endpoint, state) {
    const providerCalls = [];
    const sleeperCalls = [];
    const outbound = async input => {
      providerCalls.push(input);
      if (deliveryMode === 'failure') {
        throw new Error('provider failure must stay private');
      }
      return new Promise(() => undefined);
    };
    const provider = {
      delivery: 'test_sms',
      kind: 'test',
      ...(providerStyle === 'sendCode'
        ? {sendCode: outbound}
        : {
            sendChallenge: outbound,
            verifyChallenge: async () => undefined,
          }),
    };
    const {api, store} = createV2TestApi({
      acknowledgementSleeper: async milliseconds => {
        sleeperCalls.push(milliseconds);
      },
      ipRequestLimit: 100,
      phoneRequestLimit: 100,
      providerDeliveryDeadlineMs: 5,
      sms: {provider},
    });
    const accountKey = crypto
      .createHmac('sha256', 'softbook-cloudbase-dev-secret')
      .update(`account:${PHONE_NUMBER}`)
      .digest('hex');
    if (state !== 'absent') {
      const overrides = {
        deletion_id: `delete_provider_matrix_${state}`,
      };
      if (state === 'processing' || state === 'finalizing') {
        Object.assign(overrides, {
          attempt_count: 1,
          last_attempt_at: '2026-07-20T07:59:30.000Z',
          lease_expires_at: '2026-07-20T08:05:00.000Z',
          lease_id: `lease_${state[0].repeat(24)}`,
          status: state,
        });
      }
      if (state === 'malformed') {
        Object.assign(overrides, {
          lease_id: `lease_${'m'.repeat(24)}`,
          status: 'processing',
        });
      }
      store.snapshot().accountDeletions.set(
        accountKey,
        deletionTaskFixture(accountKey, overrides),
      );
    }

    const response = await request(api, {
      body: {phone_number: PHONE_NUMBER},
      clientIp: '203.0.113.142',
      path: endpoint.requestPath,
    });
    const caseName = `${providerStyle}/${deliveryMode}/${endpoint.name}/${state}`;
    assert.equal(response.statusCode, 200, caseName);
    assert.deepEqual(sleeperCalls, [5], caseName);
    const acknowledgement = {...response.body.data};
    const challengeId = acknowledgement.challenge_id;
    delete acknowledgement.challenge_id;
    const baselineKey = `${providerStyle}/${endpoint.name}`;
    if (!baselineByEndpoint.has(baselineKey)) {
      baselineByEndpoint.set(baselineKey, acknowledgement);
    } else {
      assert.deepEqual(
        acknowledgement,
        baselineByEndpoint.get(baselineKey),
        caseName,
      );
    }

    const deliveryPermitted =
      state === 'absent' ||
      (endpoint.name === 'recovery' &&
        (state === 'queued' || state === 'processing'));
    assert.equal(providerCalls.length, deliveryPermitted ? 1 : 0);
    assert.equal(
      store.snapshot().authChallenges.size,
      deliveryPermitted ? 1 : 0,
    );
    assert.equal(
      store.snapshot().authRateLimits.size,
      deliveryPermitted ? 2 : 1,
    );
    if (deliveryPermitted) {
      const persisted = store.snapshot().authChallenges.get(challengeId);
      assert.equal(
        persisted.delivery_status,
        deliveryMode === 'failure' ? 'delivery_failed' : 'pending',
      );
    }

    const verification = await request(api, {
      body: {
        challenge_id: challengeId,
        phone_number: PHONE_NUMBER,
        sms_code: SMS_CODE,
      },
      path: endpoint.verifyPath,
    });
    assert.equal(verification.statusCode, 401);
    assert.equal(verification.body.error.code, 'invalid_sms_code');
    assert.equal(store.snapshot().authSessions.size, 0);
  }

  for (const providerStyle of ['sendCode', 'providerOwned']) {
    for (const deliveryMode of ['failure', 'timeout']) {
      for (const endpoint of endpoints) {
        for (const state of states) {
          await verifyMatrixCase(providerStyle, deliveryMode, endpoint, state);
        }
      }
    }
  }
});

test('real 50ms acknowledgement envelope prevents absent and task suppression early returns', async () => {
  for (const testCase of [
    {name: 'ordinary/absent', path: '/v2/auth/request-code', status: null},
    {name: 'ordinary/queued', path: '/v2/auth/request-code', status: 'queued'},
    {
      name: 'recovery/absent',
      path: '/v2/account/deletion/recovery/request-code',
      status: null,
    },
    {
      name: 'recovery/finalizing',
      path: '/v2/account/deletion/recovery/request-code',
      status: 'finalizing',
    },
  ]) {
    const indexSecret = 'timing-index-secret-0123456789-ABCDEFG';
    const store = createMemoryStore({authIndexSecret: indexSecret});
    store.kind = 'cloudbase-timing-test';
    const {api, sms} = createV2TestApi({
      indexSecret,
      providerDeliveryDeadlineMs: 50,
      runtimeMode: 'production',
      store,
      tokenSecret: 'timing-token-secret-0123456789-HIJKLMN',
      useRealAcknowledgementSleeper: true,
    });
    if (testCase.status !== null) {
      const accountKey = crypto
        .createHmac('sha256', indexSecret)
        .update(`account:${PHONE_NUMBER}`)
        .digest('hex');
      const overrides = {status: testCase.status};
      if (testCase.status === 'finalizing') {
        Object.assign(overrides, {
          attempt_count: 1,
          last_attempt_at: '2026-07-20T07:59:30.000Z',
          lease_expires_at: '2026-07-20T08:05:00.000Z',
          lease_id: `lease_${'f'.repeat(24)}`,
        });
      }
      store.snapshot().accountDeletions.set(
        accountKey,
        deletionTaskFixture(accountKey, overrides),
      );
    }
    const startedAt = performance.now();
    const response = await request(api, {
      body: {phone_number: PHONE_NUMBER},
      clientIp: '203.0.113.143',
      path: testCase.path,
    });
    const elapsedMs = performance.now() - startedAt;
    assert.equal(response.statusCode, 200, testCase.name);
    assert.ok(elapsedMs >= 45, `${testCase.name}: ${elapsedMs}ms`);
    assert.ok(elapsedMs < 1000, `${testCase.name}: ${elapsedMs}ms`);
    assert.equal(
      sms.deliveries.length,
      testCase.status === null ? 1 : 0,
      testCase.name,
    );
  }
});

test('unauthenticated challenge probes consume shared IP first and normalize deletion states', async () => {
  const {api, sms, store} = createV2TestApi({
    ipRequestLimit: 5,
    phoneRequestLimit: 100,
  });
  const absentPhone = '13700137000';
  const queuedPhone = PHONE_NUMBER;
  const processingPhone = '13600136000';
  const finalizingPhone = '13900139000';
  const malformedPhone = '13500135000';
  const accountKey = phoneNumber =>
    crypto
      .createHmac('sha256', 'softbook-cloudbase-dev-secret')
      .update(`account:${phoneNumber}`)
      .digest('hex');
  store.snapshot().accountDeletions.set(
    accountKey(queuedPhone),
    deletionTaskFixture(accountKey(queuedPhone), {phone_number: queuedPhone}),
  );
  store.snapshot().accountDeletions.set(
    accountKey(processingPhone),
    deletionTaskFixture(accountKey(processingPhone), {
      attempt_count: 1,
      deletion_id: 'delete_auth_v2_processing',
      last_attempt_at: '2026-07-20T07:59:30.000Z',
      lease_expires_at: '2026-07-20T08:05:00.000Z',
      lease_id: `lease_${'y'.repeat(24)}`,
      phone_number: processingPhone,
      status: 'processing',
    }),
  );
  store.snapshot().accountDeletions.set(
    accountKey(finalizingPhone),
    deletionTaskFixture(accountKey(finalizingPhone), {
      attempt_count: 1,
      deletion_id: 'delete_auth_v2_finalizing',
      last_attempt_at: '2026-07-20T07:59:30.000Z',
      lease_expires_at: '2026-07-20T08:05:00.000Z',
      lease_id: `lease_${'z'.repeat(24)}`,
      phone_number: finalizingPhone,
      status: 'finalizing',
    }),
  );
  store.snapshot().accountDeletions.set(accountKey(malformedPhone), {
    ...deletionTaskFixture(accountKey(malformedPhone), {
      phone_number: malformedPhone,
    }),
    lease_id: `lease_${'m'.repeat(24)}`,
    status: 'processing',
  });
  const clientIp = '203.0.113.141';
  const absent = await issueChallenge(api, absentPhone, clientIp);
  const queued = await issueChallenge(api, queuedPhone, clientIp);
  const processing = await issueChallenge(api, processingPhone, clientIp);
  const finalizing = await issueChallenge(api, finalizingPhone, clientIp);
  const malformed = await issueChallenge(api, malformedPhone, clientIp);

  assert.equal(absent.statusCode, 200);
  assert.equal(queued.statusCode, 200);
  assert.equal(processing.statusCode, 200);
  assert.equal(finalizing.statusCode, 200);
  assert.equal(malformed.statusCode, 200);
  for (const response of [queued, processing, finalizing, malformed]) {
    assert.deepEqual(
      Object.keys(response.body.data).sort(),
      Object.keys(absent.body.data).sort(),
    );
    assert.equal(Object.hasOwn(response.body.data, 'deletion_request'), false);
    assert.equal(Object.hasOwn(response.body.data, 'state'), false);
  }
  assert.equal(sms.deliveries.length, 1);
  assert.equal(store.snapshot().authChallenges.size, 1);

  const boundedInvalidProbe = await request(api, {
    body: {phone_number: 'not-a-phone'},
    clientIp,
    path: '/v2/auth/request-code',
  });
  assert.equal(boundedInvalidProbe.statusCode, 429);
  assert.equal(boundedInvalidProbe.body.error.code, 'sms_rate_limited');
  const sharedIpCounter = [...store.snapshot().authRateLimits.values()].find(
    value => value.key.startsWith('ip:'),
  );
  assert.equal(sharedIpCounter.count, 5);
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
  assert.equal(
    [...store.snapshot().accountDeletions.values()][0].schema_version,
    'account-deletion-task.v2',
  );
  assert.deepEqual(
    {
      attempt_count: [...store.snapshot().accountDeletions.values()][0]
        .attempt_count,
      last_attempt_at: [...store.snapshot().accountDeletions.values()][0]
        .last_attempt_at,
      last_failure_code: [...store.snapshot().accountDeletions.values()][0]
        .last_failure_code,
      lease_expires_at: [...store.snapshot().accountDeletions.values()][0]
        .lease_expires_at,
      lease_id: [...store.snapshot().accountDeletions.values()][0].lease_id,
    },
    {
      attempt_count: 0,
      last_attempt_at: null,
      last_failure_code: null,
      lease_expires_at: null,
      lease_id: null,
    },
  );
  assert.match(
    [...store.snapshot().accountDeletions.values()][0].phone_rate_key,
    /^phone:[a-f0-9]{64}$/,
  );
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

  const challengeCountBeforeBlockedRequest =
    store.snapshot().authChallenges.size;
  const rateLimitCountBeforeBlockedRequest =
    store.snapshot().authRateLimits.size;
  const challengeAfterDeletion = await issueChallenge(
    api,
    PHONE_NUMBER,
    '203.0.113.23',
  );
  assert.equal(challengeAfterDeletion.statusCode, 200);
  assert.deepEqual(Object.keys(challengeAfterDeletion.body.data).sort(), [
    'challenge_id',
    'delivery',
    'expires_at',
    'retry_after_seconds',
  ]);
  assert.equal(
    store.snapshot().authChallenges.size,
    challengeCountBeforeBlockedRequest,
  );
  assert.equal(
    store.snapshot().authRateLimits.size,
    rateLimitCountBeforeBlockedRequest + 1,
  );
  assert.equal(
    [...store.snapshot().authSessions.values()].some(
      session => session.status === 'active',
    ),
    false,
  );
});

test('deletion worker clears current account data and permits clean re-registration', async () => {
  const {api, store} = createV2TestApi();
  const session = await issueSession(api, {
    clientIp: '203.0.113.70',
    deviceId: 'device-before-deletion',
  });
  const learning = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/learning/session',
    query: {track: 'cet4'},
  });
  assert.equal(learning.statusCode, 200, JSON.stringify(learning.body));
  const accountKey = store
    .snapshot()
    .authSessions.get(session.session_id).account_key;
  store.snapshot().pilotEntitlements.set(PHONE_NUMBER, {
    phone_number: PHONE_NUMBER,
  });

  const deletion = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    path: '/v2/account/deletion',
  });
  assert.equal(deletion.statusCode, 202);
  const report = await store.runAccountDeletionWorkerForTest();

  assert.equal(report.completed_count, 1);
  assert.equal(store.snapshot().accountDeletions.has(accountKey), false);
  assert.equal(store.snapshot().authSessions.size, 0);
  assert.equal(store.snapshot().learningSessions.size, 0);
  assert.equal(store.snapshot().memberships.has(PHONE_NUMBER), false);
  assert.equal(store.snapshot().membershipRevisions.has(PHONE_NUMBER), false);
  assert.equal(store.snapshot().pilotEntitlements.has(PHONE_NUMBER), false);
  assert.equal(
    [...store.snapshot().authChallenges.values()].some(
      challenge => challenge.phone_number === PHONE_NUMBER,
    ),
    false,
  );

  const registeredAgain = await issueSession(api, {
    clientIp: '203.0.113.71',
    deviceId: 'device-after-deletion',
  });
  assert.equal(typeof registeredAgain.access_token, 'string');
  assert.equal(
    store.snapshot().authSessions.get(registeredAgain.session_id).status,
    'active',
  );
});

test('deletion recovery challenges report strict task state without creating an auth session', async () => {
  const {api, store} = createV2TestApi({
    ipRequestLimit: 10,
    phoneRequestLimit: 10,
  });
  const signInOnlyChallenge = await issueChallenge(
    api,
    PHONE_NUMBER,
    '203.0.113.90',
  );
  const session = await issueSession(api, {
    clientIp: '203.0.113.91',
    deviceId: 'deletion-recovery-origin',
  });
  const deletion = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    path: '/v2/account/deletion',
  });
  assert.equal(deletion.statusCode, 202);
  const sessionCountAfterDeletion = store.snapshot().authSessions.size;

  const signInChallengeOnRecoveryRoute = await request(api, {
    body: {
      challenge_id: signInOnlyChallenge.body.data.challenge_id,
      phone_number: PHONE_NUMBER,
      sms_code: SMS_CODE,
    },
    path: '/v2/account/deletion/recovery/verify-code',
  });
  assert.equal(signInChallengeOnRecoveryRoute.statusCode, 401);
  assert.equal(
    signInChallengeOnRecoveryRoute.body.error.code,
    'invalid_sms_code',
  );

  const recoveryChallenge = await request(api, {
    body: {phone_number: PHONE_NUMBER},
    clientIp: '203.0.113.92',
    path: '/v2/account/deletion/recovery/request-code',
  });
  assert.equal(recoveryChallenge.statusCode, 200);
  assert.deepEqual(
    Object.keys(recoveryChallenge.body.data).sort(),
    [
      'challenge_id',
      'delivery',
      'expires_at',
      'purpose',
      'retry_after_seconds',
    ],
  );
  assert.equal(
    recoveryChallenge.body.data.purpose,
    'account_deletion_recovery',
  );
  assert.equal(
    store
      .snapshot()
      .authChallenges.get(recoveryChallenge.body.data.challenge_id).purpose,
    'account_deletion_recovery',
  );

  const recoveryChallengeOnSignInRoute = await request(api, {
    body: {
      challenge_id: recoveryChallenge.body.data.challenge_id,
      phone_number: PHONE_NUMBER,
      sms_code: SMS_CODE,
    },
    path: '/v2/auth/verify-code',
  });
  assert.equal(recoveryChallengeOnSignInRoute.statusCode, 401);
  assert.equal(
    recoveryChallengeOnSignInRoute.body.error.code,
    'invalid_sms_code',
  );
  assert.equal(store.snapshot().authSessions.size, sessionCountAfterDeletion);

  const pending = await request(api, {
    body: {
      challenge_id: recoveryChallenge.body.data.challenge_id,
      phone_number: PHONE_NUMBER,
      sms_code: SMS_CODE,
    },
    path: '/v2/account/deletion/recovery/verify-code',
  });
  assert.equal(pending.statusCode, 200, JSON.stringify(pending.body));
  assert.deepEqual(pending.body.data, {
    deletion_request: deletion.body.data.deletion_request,
    safe_to_register: false,
    schema_version: 'account-deletion-recovery.v1',
    state: 'pending',
  });
  assert.equal(store.snapshot().authSessions.size, sessionCountAfterDeletion);
  assert.equal(Object.hasOwn(pending.body.data, 'access_token'), false);
  assert.equal(Object.hasOwn(pending.body.data, 'refresh_token'), false);

  const protectedResponse = await request(api, {
    headers: {
      authorization: `Bearer ${pending.body.data.access_token ?? ''}`,
    },
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: '2026-07-20', track: 'cet4'},
  });
  assert.equal(protectedResponse.statusCode, 401);

  const report = await store.runAccountDeletionWorkerForTest();
  assert.equal(report.completed_count, 1);
  const completedChallenge = await request(api, {
    body: {phone_number: PHONE_NUMBER},
    clientIp: '203.0.113.93',
    path: '/v2/account/deletion/recovery/request-code',
  });
  assert.equal(completedChallenge.statusCode, 200);
  const none = await request(api, {
    body: {
      challenge_id: completedChallenge.body.data.challenge_id,
      phone_number: PHONE_NUMBER,
      sms_code: SMS_CODE,
    },
    path: '/v2/account/deletion/recovery/verify-code',
  });
  assert.equal(none.statusCode, 200, JSON.stringify(none.body));
  assert.deepEqual(none.body.data, {
    deletion_request: null,
    safe_to_register: true,
    schema_version: 'account-deletion-recovery.v1',
    state: 'none',
  });
  assert.equal(JSON.stringify(none.body).includes('accepted'), false);
  assert.equal(JSON.stringify(none.body).includes('completed'), false);
  assert.equal(store.snapshot().authSessions.size, 0);
});

test('deletion recovery confirms an exact processing task without minting a session', async () => {
  const {api, store} = createV2TestApi({
    ipRequestLimit: 100,
    phoneRequestLimit: 100,
  });
  const session = await issueSession(api, {clientIp: '203.0.113.108'});
  const deletion = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    path: '/v2/account/deletion',
  });
  const [accountKey, task] = [
    ...store.snapshot().accountDeletions.entries(),
  ][0];
  store.snapshot().accountDeletions.set(accountKey, {
    ...task,
    attempt_count: 1,
    last_attempt_at: '2026-07-20T08:00:00.000Z',
    lease_expires_at: '2026-07-20T08:05:00.000Z',
    lease_id: `lease_${'p'.repeat(24)}`,
    status: 'processing',
  });
  const challenge = await request(api, {
    body: {phone_number: PHONE_NUMBER},
    clientIp: '203.0.113.109',
    path: '/v2/account/deletion/recovery/request-code',
  });
  const sessionsBefore = store.snapshot().authSessions.size;
  const recovery = await request(api, {
    body: {
      challenge_id: challenge.body.data.challenge_id,
      phone_number: PHONE_NUMBER,
      sms_code: SMS_CODE,
    },
    path: '/v2/account/deletion/recovery/verify-code',
  });

  assert.equal(recovery.statusCode, 200);
  assert.deepEqual(recovery.body.data, {
    deletion_request: {
      ...deletion.body.data.deletion_request,
      status: 'processing',
    },
    safe_to_register: false,
    schema_version: 'account-deletion-recovery.v1',
    state: 'pending',
  });
  assert.equal(store.snapshot().authSessions.size, sessionsBefore);
});

test('finalizing deletion blocks ordinary and recovery request material until clean registration', async () => {
  const {api, sms, store} = createV2TestApi({
    ipRequestLimit: 100,
    phoneRequestLimit: 100,
  });
  const session = await issueSession(api, {
    clientIp: '203.0.113.110',
    deviceId: 'finalizing-origin',
  });
  const deletion = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    path: '/v2/account/deletion',
  });
  assert.equal(deletion.statusCode, 202);
  const queuedRecovery = await request(api, {
    body: {phone_number: PHONE_NUMBER},
    clientIp: '203.0.113.111',
    path: '/v2/account/deletion/recovery/request-code',
  });
  assert.equal(queuedRecovery.statusCode, 200);

  const [accountKey, task] = [
    ...store.snapshot().accountDeletions.entries(),
  ][0];
  store.snapshot().accountDeletions.set(accountKey, {
    ...task,
    attempt_count: 1,
    last_attempt_at: '2026-07-20T08:00:00.000Z',
    lease_expires_at: '2026-07-20T08:05:00.000Z',
    lease_id: `lease_${'f'.repeat(24)}`,
    status: 'finalizing',
  });
  const materialBefore = {
    challenges: store.snapshot().authChallenges.size,
    deliveries: sms.deliveries.length,
    rateLimits: store.snapshot().authRateLimits.size,
    sessions: store.snapshot().authSessions.size,
  };

  const repeatedDeletion = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    path: '/v2/account/deletion',
  });
  assert.equal(repeatedDeletion.statusCode, 202);
  assert.deepEqual(repeatedDeletion.body.data.deletion_request, {
    ...deletion.body.data.deletion_request,
    status: 'processing',
  });

  const ordinary = await issueChallenge(
    api,
    PHONE_NUMBER,
    '203.0.113.112',
  );
  assert.equal(ordinary.statusCode, 200);
  const recovery = await request(api, {
    body: {phone_number: PHONE_NUMBER},
    clientIp: '203.0.113.113',
    path: '/v2/account/deletion/recovery/request-code',
  });
  assert.equal(recovery.statusCode, 200);
  assert.equal(
    recovery.body.data.purpose,
    'account_deletion_recovery',
  );
  assert.deepEqual(
    {
      challenges: store.snapshot().authChallenges.size,
      deliveries: sms.deliveries.length,
      rateLimits: store.snapshot().authRateLimits.size - 2,
      sessions: store.snapshot().authSessions.size,
    },
    materialBefore,
  );

  const verifyDuringFinalizing = await request(api, {
    body: {
      challenge_id: queuedRecovery.body.data.challenge_id,
      phone_number: PHONE_NUMBER,
      sms_code: SMS_CODE,
    },
    path: '/v2/account/deletion/recovery/verify-code',
  });
  assert.equal(verifyDuringFinalizing.statusCode, 409);
  assert.equal(
    verifyDuringFinalizing.body.error.code,
    'account_deletion_finalizing',
  );
  assert.equal(store.snapshot().authChallenges.size, materialBefore.challenges);
  assert.equal(
    store.snapshot().authRateLimits.size,
    materialBefore.rateLimits + 2,
  );
  assert.equal(store.snapshot().authSessions.size, materialBefore.sessions);

  store.snapshot().accountDeletions.delete(accountKey);
  const afterCompletion = await request(api, {
    body: {phone_number: PHONE_NUMBER},
    clientIp: '203.0.113.114',
    path: '/v2/account/deletion/recovery/request-code',
  });
  assert.equal(afterCompletion.statusCode, 200);
  const none = await request(api, {
    body: {
      challenge_id: afterCompletion.body.data.challenge_id,
      phone_number: PHONE_NUMBER,
      sms_code: SMS_CODE,
    },
    path: '/v2/account/deletion/recovery/verify-code',
  });
  assert.deepEqual(none.body.data, {
    deletion_request: null,
    safe_to_register: true,
    schema_version: 'account-deletion-recovery.v1',
    state: 'none',
  });
  const registered = await issueSession(api, {
    clientIp: '203.0.113.115',
    deviceId: 'after-finalizing',
  });
  assert.equal(typeof registered.access_token, 'string');
});

test('lost deletion acknowledgement retries survive erased origin session until task completion', async () => {
  const {api, store} = createV2TestApi();
  const session = await issueSession(api, {clientIp: '203.0.113.116'});
  const headers = {authorization: `Bearer ${session.access_token}`};
  const first = await request(api, {headers, path: '/v2/account/deletion'});
  assert.equal(first.statusCode, 202);
  const [accountKey, queued] = [...store.snapshot().accountDeletions.entries()][0];
  store.snapshot().accounts.delete(accountKey);
  store.snapshot().authSessions.delete(session.session_id);

  for (const status of ['processing', 'finalizing']) {
    store.snapshot().accountDeletions.set(accountKey, {
      ...queued,
      attempt_count: 1,
      last_attempt_at: '2026-07-20T08:00:00.000Z',
      lease_expires_at: '2026-07-20T08:05:00.000Z',
      lease_id: `lease_${'l'.repeat(24)}`,
      status,
    });
    const retry = await request(api, {headers, path: '/v2/account/deletion'});
    assert.equal(retry.statusCode, 202, status);
    assert.equal(retry.body.data.deletion_request.id,
      first.body.data.deletion_request.id, status);
    assert.equal(retry.body.data.deletion_request.status, 'processing', status);
  }
  assert.equal(store.snapshot().accounts.size, 0);
  assert.equal(store.snapshot().authSessions.size, 0);
});

test('Memory and CloudBase converge an empty-read deletion race after origin erasure', async () => {
  for (const kind of ['memory', 'cloudbase']) {
    const db = kind === 'cloudbase' ? createFakeCloudBaseDb() : null;
    const store = kind === 'memory'
      ? createMemoryStore()
      : createCloudBaseStore({db});
    const {api} = createV2TestApi({store});
    const session = await issueSession(api, {
      clientIp: kind === 'memory' ? '203.0.113.121' : '203.0.113.122',
    });
    const original = store.getOrCreateAccountDeletionTask;
    let captured;
    let release;
    let markEntered;
    const entered = new Promise(resolve => {
      markEntered = resolve;
    });
    const released = new Promise(resolve => {
      release = resolve;
    });
    store.getOrCreateAccountDeletionTask = async input => {
      captured = structuredClone(input);
      markEntered();
      await released;
      return original(input);
    };
    const pending = request(api, {
      headers: {authorization: `Bearer ${session.access_token}`},
      path: '/v2/account/deletion',
    });
    await entered;
    const competing = {
      ...captured,
      attempt_count: 1,
      deletion_id: `delete_competing_${kind}_0001`,
      last_attempt_at: '2026-07-20T08:00:00.000Z',
      lease_expires_at: '2026-07-20T08:05:00.000Z',
      lease_id: `lease_${kind[0].repeat(24)}`,
      status: 'processing',
    };
    if (kind === 'memory') {
      store.snapshot().accountDeletions.set(captured.account_key, competing);
      store.snapshot().accounts.delete(captured.account_key);
      store.snapshot().authSessions.delete(captured.origin_session_id);
    } else {
      db.snapshot().get('softbook_account_deletions')
        .set(captured.account_key, competing);
      db.snapshot().get('softbook_accounts').delete(captured.account_key);
      db.snapshot().get('softbook_auth_sessions')
        .delete(captured.origin_session_id);
    }
    release();
    const response = await pending;
    assert.equal(response.statusCode, 202, kind);
    assert.equal(
      response.body.data.deletion_request.id,
      competing.deletion_id,
      kind,
    );

    const taskMap = kind === 'memory'
      ? store.snapshot().accountDeletions
      : db.snapshot().get('softbook_account_deletions');
    taskMap.set(captured.account_key, {
      ...competing,
      origin_session_id: 'different_origin_session_0001',
    });
    await assert.rejects(
      () => original(captured),
      error => error.code === 'account_instance_mismatch',
      kind,
    );
    taskMap.set(captured.account_key, {
      ...competing,
      lease_expires_at: null,
    });
    await assert.rejects(() => original(captured), /task is invalid/, kind);
  }
});

test('missing finalizing lease TTL remains a material-creation fence', async () => {
  const {api, sms, store} = createV2TestApi({
    ipRequestLimit: 100,
    phoneRequestLimit: 100,
  });
  const session = await issueSession(api, {clientIp: '203.0.113.116'});
  await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    path: '/v2/account/deletion',
  });
  const [accountKey, task] = [
    ...store.snapshot().accountDeletions.entries(),
  ][0];
  store.snapshot().accountDeletions.set(accountKey, {
    ...task,
    attempt_count: 1,
    last_attempt_at: '2026-07-20T08:00:00.000Z',
    lease_expires_at: null,
    lease_id: `lease_${'m'.repeat(24)}`,
    status: 'finalizing',
  });
  const before = {
    challenges: store.snapshot().authChallenges.size,
    deliveries: sms.deliveries.length,
    rateLimits: store.snapshot().authRateLimits.size,
  };

  const response = await request(api, {
    body: {phone_number: PHONE_NUMBER},
    clientIp: '203.0.113.117',
    path: '/v2/account/deletion/recovery/request-code',
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    {
      challenges: store.snapshot().authChallenges.size,
      deliveries: sms.deliveries.length,
      rateLimits: store.snapshot().authRateLimits.size - 1,
    },
    before,
  );
});

test('missing processing lease TTL fails recovery closed before material creation', async () => {
  const {api, sms, store} = createV2TestApi({
    ipRequestLimit: 100,
    phoneRequestLimit: 100,
  });
  const session = await issueSession(api, {clientIp: '203.0.113.120'});
  await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    path: '/v2/account/deletion',
  });
  const [accountKey, task] = [
    ...store.snapshot().accountDeletions.entries(),
  ][0];
  store.snapshot().accountDeletions.set(accountKey, {
    ...task,
    attempt_count: 1,
    last_attempt_at: '2026-07-20T08:00:00.000Z',
    lease_expires_at: null,
    lease_id: `lease_${'t'.repeat(24)}`,
    status: 'processing',
  });
  const before = {
    challenges: store.snapshot().authChallenges.size,
    deliveries: sms.deliveries.length,
    rateLimits: store.snapshot().authRateLimits.size,
  };

  const response = await request(api, {
    body: {phone_number: PHONE_NUMBER},
    clientIp: '203.0.113.121',
    path: '/v2/account/deletion/recovery/request-code',
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    {
      challenges: store.snapshot().authChallenges.size,
      deliveries: sms.deliveries.length,
      rateLimits: store.snapshot().authRateLimits.size - 1,
    },
    before,
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
    indexSecret: 'softbook-cloudbase-dev-secret',
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
    account_instance_id: persistedSession.account_instance_id,
    account_key: persistedSession.account_key,
    attempt_count: 0,
    deletion_id: 'delete_active_guard_test',
    last_attempt_at: null,
    last_failure_code: null,
    lease_expires_at: null,
    lease_id: null,
    origin_session_id: persistedSession.session_id,
    phone_number: PHONE_NUMBER,
    phone_rate_key: `phone:${'d'.repeat(64)}`,
    requested_at: clock.now().toISOString(),
    schema_version: 'account-deletion-task.v2',
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
    account_instance_id: persistedSession.account_instance_id,
    account_key: persistedSession.account_key,
    attempt_count: 0,
    deletion_id: 'delete_cloudbase_test',
    last_attempt_at: null,
    last_failure_code: null,
    lease_expires_at: null,
    lease_id: null,
    origin_session_id: persistedSession.session_id,
    phone_number: PHONE_NUMBER,
    phone_rate_key: `phone:${'d'.repeat(64)}`,
    requested_at: '2026-07-20T08:00:00.000Z',
    schema_version: 'account-deletion-task.v2',
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
  const challengeCountBeforeBlockedRequest = db
    .snapshot()
    .get('softbook_auth_challenges').size;
  const blockedChallenge = await issueChallenge(
    second.api,
    PHONE_NUMBER,
    '203.0.113.32',
  );
  assert.equal(blockedChallenge.statusCode, 200);
  assert.equal(
    db.snapshot().get('softbook_auth_challenges').size,
    challengeCountBeforeBlockedRequest,
  );
});

test('CloudBase challenge reservation uses exactly four transaction operations', async () => {
  const db = createFakeCloudBaseDb();
  const {api} = createV2TestApi({store: createCloudBaseStore({db})});
  const response = await issueChallenge(api);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(db.transactionOperationCounts(), [2, 3, 4, 2]);
});

test('CloudBase account revocation rechecks the exact queued task and current session query-set', async () => {
  let mutateAfterQuery = false;
  let db;
  db = createFakeCloudBaseDb({
    onWhereGet: ({collectionName, query}) => {
      if (
        !mutateAfterQuery ||
        collectionName !== 'softbook_auth_sessions' ||
        query.account_key === undefined
      ) {
        return;
      }
      mutateAfterQuery = false;
      db.snapshot().get('softbook_auth_sessions').delete('session-deleted');
      db.snapshot().get('softbook_auth_sessions').set('session-replaced', {
        account_instance_id: `account_${'a'.repeat(24)}`,
        account_key: 'b'.repeat(64),
        session_id: 'session-replaced',
        status: 'active',
      });
      const task = db
        .snapshot()
        .get('softbook_account_deletions')
        .get('a'.repeat(64));
      db.snapshot().get('softbook_account_deletions').set('a'.repeat(64), {
        ...task,
        status: 'processing',
        attempt_count: 1,
        last_attempt_at: '2026-07-20T08:00:00.000Z',
        lease_expires_at: '2026-07-20T08:05:00.000Z',
        lease_id: `lease_${'r'.repeat(24)}`,
      });
    },
  });
  const store = createCloudBaseStore({db});
  const accountKey = 'a'.repeat(64);
  const deletionId = 'delete_cloudbase_revoke_exact';
  await db
    .collection('softbook_account_deletions')
    .doc(accountKey)
    .set(deletionTaskFixture(accountKey, {deletion_id: deletionId}));
  for (const sessionId of ['session-deleted', 'session-replaced']) {
    await db.collection('softbook_auth_sessions').doc(sessionId).set({
      account_instance_id: `account_${'a'.repeat(24)}`,
      account_key: accountKey,
      session_id: sessionId,
      status: 'active',
    });
  }
  mutateAfterQuery = true;

  const interrupted = await store.revokeAuthSessionsByAccount(
    accountKey,
    deletionId,
    `account_${'a'.repeat(24)}`,
    '2026-07-20T08:00:00.000Z',
    'account_deletion_requested',
  );
  assert.equal(interrupted, 0);
  assert.equal(
    db.snapshot().get('softbook_auth_sessions').has('session-deleted'),
    false,
  );
  assert.deepEqual(
    db.snapshot().get('softbook_auth_sessions').get('session-replaced'),
    {
      account_instance_id: `account_${'a'.repeat(24)}`,
      account_key: 'b'.repeat(64),
      session_id: 'session-replaced',
      status: 'active',
    },
  );

  await db
    .collection('softbook_account_deletions')
    .doc(accountKey)
    .set(
      deletionTaskFixture(accountKey, {
        deletion_id: 'delete_cloudbase_revoke_t2',
      }),
    );
  await db.collection('softbook_auth_sessions').doc('session-current').set({
    account_instance_id: `account_${'a'.repeat(24)}`,
    account_key: accountKey,
    session_id: 'session-current',
    status: 'active',
  });
  assert.equal(
    await store.revokeAuthSessionsByAccount(
      accountKey,
      deletionId,
      `account_${'a'.repeat(24)}`,
      '2026-07-20T08:00:01.000Z',
      'account_deletion_requested',
    ),
    0,
  );
  assert.equal(
    db
      .snapshot()
      .get('softbook_auth_sessions')
      .get('session-current').status,
    'active',
  );

  await db
    .collection('softbook_account_deletions')
    .doc(accountKey)
    .set(deletionTaskFixture(accountKey, {deletion_id: deletionId}));
  assert.equal(
    await store.revokeAuthSessionsByAccount(
      accountKey,
      deletionId,
      `account_${'a'.repeat(24)}`,
      '2026-07-20T08:00:02.000Z',
      'account_deletion_requested',
    ),
    1,
  );
  assert.equal(
    db
      .snapshot()
      .get('softbook_auth_sessions')
      .get('session-current').status,
    'revoked',
  );
  assert.equal(db.transactionOperationCounts().at(-1), 3);
});

test('CloudBase finalizing fence rejects request-code before any durable material write', async () => {
  const db = createFakeCloudBaseDb();
  const sms = createSmsProvider();
  const store = createCloudBaseStore({db});
  const {api} = createV2TestApi({sms, store});
  const accountKey = crypto
    .createHmac('sha256', 'softbook-cloudbase-dev-secret')
    .update(`account:${PHONE_NUMBER}`)
    .digest('hex');
  await db.collection('softbook_account_deletions').doc(accountKey).set({
    account_instance_id: `account_${'a'.repeat(24)}`,
    account_key: accountKey,
    attempt_count: 1,
    deletion_id: 'delete_cloudbase_finalizing',
    last_attempt_at: '2026-07-20T08:00:00.000Z',
    last_failure_code: null,
    lease_expires_at: '2026-07-20T08:05:00.000Z',
    lease_id: `lease_${'c'.repeat(24)}`,
    origin_session_id: 's'.repeat(24),
    phone_number: PHONE_NUMBER,
    phone_rate_key: `phone:${'d'.repeat(64)}`,
    requested_at: '2026-07-20T07:59:00.000Z',
    schema_version: 'account-deletion-task.v2',
    status: 'finalizing',
  });

  const recovery = await request(api, {
    body: {phone_number: PHONE_NUMBER},
    clientIp: '203.0.113.118',
    path: '/v2/account/deletion/recovery/request-code',
  });
  const ordinary = await issueChallenge(
    api,
    PHONE_NUMBER,
    '203.0.113.119',
  );

  assert.equal(recovery.statusCode, 200);
  assert.equal(ordinary.statusCode, 200);
  assert.equal(sms.deliveries.length, 0);
  assert.equal(db.snapshot().get('softbook_auth_rate_limits').size, 2);
  assert.equal(db.snapshot().has('softbook_auth_challenges'), false);
});

test('non-development runtimes do not expose an unaudited client purchase grant', async () => {
  for (const runtimeMode of ['production', 'controlled_pilot']) {
    const store = createMemoryStore();
    store.kind = 'test-persistent';
    const tokenSecret = `${runtimeMode}-purchase-token-secret-0123456789`;
    const {api} = createV2TestApi({
      indexSecret: `${runtimeMode}-purchase-index-secret-0123456789`,
      runtimeMode,
      sms: createSmsProvider(),
      store,
      tokenSecret,
    });
    const session = await issueSession(api, {
      clientIp: runtimeMode === 'production' ? '203.0.113.80' : '203.0.113.81',
    });
    const response = await request(api, {
      body: {},
      headers: {authorization: `Bearer ${session.access_token}`},
      path: '/v2/membership/purchase',
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.body.error.code, 'route_not_found');
    const membership = await store.getMembership(
      PHONE_NUMBER,
      createClock().now().toISOString(),
    );
    assert.equal(
      membership.stage,
      'trial_available',
    );
  }
});

test('v2 request-code treats the CloudBase DOCUMENT_NOT_FOUND code as an empty document', async () => {
  const db = createFakeCloudBaseDb({
    missingDocumentErrorCode: 'DOCUMENT_NOT_FOUND',
  });
  const {api} = createV2TestApi({
    store: createCloudBaseStore({db}),
  });
  const response = await request(api, {
    body: {phone_number: PHONE_NUMBER},
    path: '/v2/auth/request-code',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.delivery, 'test_sms');
  assert.equal(db.snapshot().get('softbook_auth_rate_limits').size, 2);
  assert.equal(db.snapshot().get('softbook_auth_challenges').size, 1);
});

test('v2 request-code keeps CloudBase collection failures fatal', async () => {
  const db = createFakeCloudBaseDb({
    missingDocumentErrorCode: 'DATABASE_COLLECTION_NOT_EXIST',
  });
  const {api} = createV2TestApi({
    store: createCloudBaseStore({db}),
  });
  const response = await request(api, {
    body: {phone_number: PHONE_NUMBER},
    path: '/v2/auth/request-code',
  });

  assert.equal(response.statusCode, 500);
  assert.equal(
    response.body.error.code,
    'DATABASE_COLLECTION_NOT_EXIST',
  );
  assert.equal(
    db.snapshot().get('softbook_auth_rate_limits')?.size ?? 0,
    0,
  );
  assert.equal(db.snapshot().has('softbook_auth_challenges'), false);
});

test('production auth fails closed on weak configuration and missing trusted client IP', async () => {
  assert.throws(
    () => createV2TestApi({providerDeliveryDeadlineMs: 10001}),
    /must not exceed 10000ms/,
  );
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

function createFakeCloudBaseDb({
  missingDocumentErrorCode = null,
  onWhereGet = null,
} = {}) {
  const collections = new Map();
  let transactionTail = Promise.resolve();
  let transactionOperations = 0;
  const transactionOperationCounts = [];

  const collection = (name, transactional = false) => {
    if (!collections.has(name)) {
      collections.set(name, new Map());
    }

    const documents = collections.get(name);

    return {
      doc: documentId => ({
        get: async () => {
          if (transactional) transactionOperations += 1;
          if (missingDocumentErrorCode && !documents.has(documentId)) {
            const error = new Error('CloudBase document lookup failed.');
            error.code = missingDocumentErrorCode;
            throw error;
          }

          return {
            data: documents.has(documentId)
              ? transactional
                ? {
                    list: [
                      {
                        _id: documentId,
                        ...cloneJson(documents.get(documentId)),
                      },
                    ],
                  }
                : [
                    {
                      _id: documentId,
                      ...cloneJson(documents.get(documentId)),
                    },
                  ]
              : transactional
              ? {list: []}
              : [],
          };
        },
        set: async data => {
          if (transactional) transactionOperations += 1;
          documents.set(documentId, cloneJson(data));
          return {id: documentId};
        },
      }),
      where: query => ({
        get: async () => {
          const data = [...documents.entries()]
            .filter(([, document]) =>
              Object.entries(query).every(
                ([key, value]) => document[key] === value,
              ),
            )
            .map(([documentId, document]) => ({
              _id: documentId,
              ...cloneJson(document),
            }));
          await onWhereGet?.({collectionName: name, data, query});
          return {data};
        },
      }),
    };
  };

  return {
    collection,
    runTransaction: callback => {
      const run = transactionTail.then(async () => {
        transactionOperations = 0;
        try {
          return await callback({collection: name => collection(name, true)});
        } finally {
          transactionOperationCounts.push(transactionOperations);
          transactionOperations = 0;
        }
      });
      transactionTail = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    snapshot: () => collections,
    transactionOperationCounts: () => [...transactionOperationCounts],
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
