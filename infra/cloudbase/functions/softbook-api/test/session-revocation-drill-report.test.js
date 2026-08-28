const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { after, before, test } = require('node:test');

let drill;
const temporaryDirectories = [];

before(async () => {
  drill = await import(
    pathToFileURL(
      resolve(__dirname, '../../../run-session-revocation-drill.mjs')
    )
  );
});

after(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('session revocation drill is dry-run by default and makes no request', async () => {
  const fixture = createFixture();
  let requests = 0;
  const report = await drill.executeSessionRevocationDrill(
    drill.parseSessionRevocationDrillArguments([
      '--profile',
      fixture.profilePath,
    ]),
    {
      ...dependencies(),
      transport: { request: async () => (requests += 1) },
    }
  );
  assert.equal(report.schema_version, 'session-revocation-drill-plan.v1');
  assert.equal(report.applied, false);
  assert.equal(report.gate_eligible, false);
  assert.equal(report.remote_requests_performed, false);
  assert.equal(report.remote_writes_performed, false);
  assert.equal(requests, 0);
});

test('operator uses the exact machine-principal grammar and length bounds', () => {
  const fixture = createFixture();
  const argumentsBeforeOperator = [
    '--profile',
    fixture.profilePath,
    '--apply',
    '--operator',
  ];
  for (const operator of [
    'service:abc',
    'oidc:a.@',
    `agent:${'a'.repeat(128)}`,
  ]) {
    assert.equal(
      drill.parseSessionRevocationDrillArguments([
        ...argumentsBeforeOperator,
        operator,
      ]).operator,
      operator
    );
  }
  for (const operator of [
    'service:-',
    'service:-ab',
    'service:ab',
    `service:${'a'.repeat(129)}`,
  ]) {
    assert.throws(
      () =>
        drill.parseSessionRevocationDrillArguments([
          ...argumentsBeforeOperator,
          operator,
        ]),
      /operator must identify a model, agent, service, or OIDC operator/
    );
  }
});

test('applied drill proves refresh replay revocation, sibling isolation and logout idempotency', async () => {
  const fixture = createFixture();
  const credentials = createCredentials();
  const transport = createTransport(credentials);
  const options = drill.parseSessionRevocationDrillArguments([
    '--profile',
    fixture.profilePath,
    '--apply',
    '--operator',
    'service:auth-auditor',
  ]);
  const report = await drill.executeSessionRevocationDrill(options, {
    ...dependencies(),
    env: credentialEnv(credentials),
    transport,
  });

  assert.equal(report.schema_version, 'session-revocation-drill-report.v1');
  assert.equal(report.status, 'passed');
  assert.equal(report.gate_eligible, false);
  assert.equal(report.sessions.same_phone_claim, true);
  assert.equal(report.sessions.distinct_session_ids, true);
  assert.equal(report.sessions.token_values_reported, false);
  assert.equal(report.sessions.phone_value_reported, false);
  assert.equal(
    report.observations.old_refresh_replay_status,
    'refresh_token_reused'
  );
  assert.equal(
    report.observations.client_b_refresh_rotation_status,
    'rotated'
  );
  assert.equal(report.observations.sibling_after_replay_status, 'active');
  assert.equal(
    report.observations.rotated_client_b_session_sha256,
    report.observations.client_b_session_sha256
  );
  assert.equal(report.observations.logout_replay_status, 'idempotent');
  assert.equal(
    report.assertions.client_b_refresh_rotated_after_client_a_replay,
    true
  );
  assert.equal(
    report.assertions.client_b_access_and_refresh_rejected_after_logout,
    true
  );
  assert.deepEqual(
    transport.requests
      .filter(
        ({ accessToken }) =>
          accessToken === transport.rotatedCredentials.accessB
      )
      .map(({ requestPath }) =>
        requestPath.startsWith('/v2/bootstrap')
          ? '/v2/bootstrap'
          : requestPath
      ),
    [
      '/v2/bootstrap',
      '/v2/auth/logout',
      '/v2/auth/logout',
      '/v2/bootstrap',
    ]
  );
  assert.equal(
    transport.requests.at(-1).refreshToken,
    transport.rotatedCredentials.refreshB
  );
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes(credentials.phone), false);
  for (const value of [
    ...Object.values(credentials),
    ...Object.values(transport.rotatedCredentials),
  ].filter((item) => item.startsWith?.('softbook_'))) {
    assert.equal(serialized.includes(value), false);
  }
});

test('apply rejects unsafe repository and mismatched account/session credentials', async () => {
  const fixture = createFixture();
  const options = drill.parseSessionRevocationDrillArguments([
    '--profile',
    fixture.profilePath,
    '--apply',
    '--operator',
    'service:auth-auditor',
  ]);
  await assert.rejects(
    () =>
      drill.executeSessionRevocationDrill(options, {
        ...dependencies(),
        repository: {
          branch: 'infra/topic',
          dirty: true,
          head: 'a'.repeat(40),
          originMain: 'b'.repeat(40),
        },
      }),
    /writes require branch main/
  );

  const differentPhone = createCredentials();
  differentPhone.accessB = makeAccess('13900139000', 'session-b-0001');
  await assert.rejects(
    () =>
      drill.executeSessionRevocationDrill(options, {
        ...dependencies(),
        env: credentialEnv(differentPhone),
      }),
    /same phone account/
  );

  const sameSession = createCredentials();
  sameSession.accessB = makeAccess(
    sameSession.phone,
    'session-a-0001',
    1700000050
  );
  sameSession.refreshB = makeRefresh('session-a-0001', 0, 'refresh-b');
  await assert.rejects(
    () =>
      drill.executeSessionRevocationDrill(options, {
        ...dependencies(),
        env: credentialEnv(sameSession),
      }),
    /two distinct server session IDs/
  );
});

test('repository execution rejects an untracked receiver profile before any request', async () => {
  const fixture = createFixture();
  let requests = 0;
  await assert.rejects(
    () =>
      drill.executeSessionRevocationDrill(
        drill.parseSessionRevocationDrillArguments(['--profile', fixture.profilePath]),
        {
          clock: createClock(),
          transport: { request: async () => (requests += 1) },
        }
      ),
    /tracked JSON file inside the repository/
  );
  assert.equal(requests, 0);
});

test('apply verifies receiver deployment identity before reading or sending session credentials', async () => {
  const fixture = createFixture();
  let requests = 0;
  const options = drill.parseSessionRevocationDrillArguments([
    '--profile',
    fixture.profilePath,
    '--apply',
    '--operator',
    'service:auth-auditor',
  ]);
  await assert.rejects(
    () =>
      drill.executeSessionRevocationDrill(options, {
        ...dependencies(),
        env: {},
        inspectDeployment: async () => ({
          errors: ['backend deployment ID mismatch'],
          ok: false,
        }),
        transport: { request: async () => (requests += 1) },
      }),
    /receiver deployment identity preflight failed: backend deployment ID mismatch/
  );
  assert.equal(requests, 0);
});

test('preflight subprocess environment strips all live session credentials', () => {
  const credentials = createCredentials();
  const source = {
    ...credentialEnv(credentials),
    CLOUDBASE_CLI: '/trusted/tcb',
    PATH: '/trusted/bin',
  };
  const sanitized = drill.credentialFreePreflightEnvironment(source);
  assert.equal(sanitized.CLOUDBASE_CLI, '/trusted/tcb');
  assert.equal(sanitized.PATH, '/trusted/bin');
  for (const name of Object.keys(credentialEnv(credentials))) {
    assert.equal(Object.hasOwn(sanitized, name), false);
  }
});

test('remote transport rejects redirects and enforces a bounded abort signal', async () => {
  let observed = null;
  const target = 'https://receiver.example/softbook-api/v2/auth/logout';
  const transport = drill.createRemoteSessionTransport({
    baseUrl: 'https://receiver.example/softbook-api',
    timeoutMs: 1000,
    fetchImpl: async (url, options) => {
      observed = { options, url };
      return { redirected: false, status: 204, url };
    },
  });
  assert.deepEqual(await transport.request('token', '/v2/auth/logout', {method: 'POST'}), {
    payload: null,
    status: 204,
  });
  assert.equal(observed.url, target);
  assert.equal(observed.options.redirect, 'error');
  assert.equal(observed.options.signal instanceof AbortSignal, true);

  const redirected = drill.createRemoteSessionTransport({
    baseUrl: 'https://receiver.example/softbook-api',
    fetchImpl: async () => ({
      redirected: true,
      status: 204,
      url: 'https://attacker.example/capture',
    }),
  });
  await assert.rejects(
    () => redirected.request('token', '/v2/auth/logout', {method: 'POST'}),
    /changed the tracked receiver URL/
  );
  const stalledBody = drill.createRemoteSessionTransport({
    baseUrl: 'https://receiver.example/softbook-api',
    timeoutMs: 1000,
    fetchImpl: async (url) => ({
      redirected: false,
      status: 200,
      url,
      json: () => new Promise(() => {}),
    }),
  });
  await assert.rejects(
    () => stalledBody.request('token', '/v2/bootstrap'),
    /timed out/
  );
  assert.throws(
    () =>
      drill.createRemoteSessionTransport({
        baseUrl: 'https://receiver.example/softbook-api',
        timeoutMs: 999,
      }),
    /timeout must be between 1000 and 30000/
  );
});

test('apply rejects operator values that could disclose phone or credential material', async () => {
  const fixture = createFixture();
  const credentials = createCredentials();
  for (const operator of [
    `service:operator-${credentials.phone}`,
    'service:operator-138-0013-8000',
    'service:softbook_refresh.token.marker',
  ]) {
    let requests = 0;
    const options = drill.parseSessionRevocationDrillArguments([
      '--profile',
      fixture.profilePath,
      '--apply',
      '--operator',
      operator,
    ]);
    await assert.rejects(
      () =>
        drill.executeSessionRevocationDrill(options, {
          ...dependencies(),
          env: credentialEnv(credentials),
          transport: { request: async () => (requests += 1) },
        }),
      /operator must not contain phone or credential material/
    );
    assert.equal(requests, 0);
  }
});

test('drill fails closed on wrong replay code or sibling revocation', async () => {
  const fixture = createFixture();
  const credentials = createCredentials();
  const options = drill.parseSessionRevocationDrillArguments([
    '--profile',
    fixture.profilePath,
    '--apply',
    '--operator',
    'service:auth-auditor',
  ]);
  await assert.rejects(
    () =>
      drill.executeSessionRevocationDrill(options, {
        ...dependencies(),
        env: credentialEnv(credentials),
        transport: createTransport(credentials, { wrongReplayCode: true }),
      }),
    /old refresh replay must return 401 refresh_token_reused/
  );
  await assert.rejects(
    () =>
      drill.executeSessionRevocationDrill(options, {
        ...dependencies(),
        env: credentialEnv(credentials),
        transport: createTransport(credentials, {
          revokeSiblingOnReplay: true,
        }),
      }),
    /client B refresh rotation returned an unexpected status/
  );
});

test('drill fails closed before logout when client B refresh is stale or invalid', async () => {
  const fixture = createFixture();
  const credentials = createCredentials();
  const options = drill.parseSessionRevocationDrillArguments([
    '--profile',
    fixture.profilePath,
    '--apply',
    '--operator',
    'service:auth-auditor',
  ]);
  for (const [transportOptions, expectedError] of [
    [
      { staleBRefresh: true },
      /client B refresh rotation returned an unexpected status/,
    ],
    [
      { invalidRotatedBRefresh: true },
      /rotated refresh token shape is invalid/,
    ],
  ]) {
    const transport = createTransport(credentials, transportOptions);
    await assert.rejects(
      () =>
        drill.executeSessionRevocationDrill(options, {
          ...dependencies(),
          env: credentialEnv(credentials),
          transport,
        }),
      expectedError
    );
    assert.equal(transport.logoutRequests, 0);
  }
});

test('drill fails closed before logout when rotated client B scope drifts', async () => {
  const fixture = createFixture();
  const credentials = createCredentials();
  const options = drill.parseSessionRevocationDrillArguments([
    '--profile',
    fixture.profilePath,
    '--apply',
    '--operator',
    'service:auth-auditor',
  ]);
  for (const transportOptions of [
    { rotatedBContentDrift: true },
    { rotatedBReleaseDrift: true },
  ]) {
    const transport = createTransport(credentials, transportOptions);
    await assert.rejects(
      () =>
        drill.executeSessionRevocationDrill(options, {
          ...dependencies(),
          env: credentialEnv(credentials),
          transport,
        }),
      /client B refresh-rotated content\/release scope does not match the initial sessions/
    );
    assert.equal(transport.logoutRequests, 0);
  }
});

function createFixture(runtimeMode = 'closed_beta') {
  const directory = mkdtempSync(join(tmpdir(), 'session-revocation-drill-'));
  temporaryDirectories.push(directory);
  const profilePath = join(directory, 'profile.json');
  writeFileSync(
    profilePath,
    JSON.stringify({
      schema_version: 'delivery-profile.v1',
      profile_id:
        runtimeMode === 'closed_beta'
          ? 'receiver-cet4-beta'
          : 'receiver-production',
      environment_id:
        runtimeMode === 'closed_beta'
          ? 'receiver-cet4-beta'
          : 'receiver-production',
      region: 'ap-shanghai',
      api_base_url: 'https://receiver.example/softbook-api',
      runtime_mode: runtimeMode,
      enabled_tracks:
        runtimeMode === 'closed_beta' ? ['cet4'] : ['cet4', 'cet6'],
      minimum_client_versions: { ios: '1.0.0', android: '1.0.0' },
      signing_key_id: 'receiver-signing-key-v1',
    })
  );
  return { profilePath };
}

function dependencies() {
  const credentials = createCredentials();
  return {
    clock: createClock(),
    env: credentialEnv(credentials),
    nodeVersion: '22.13.0',
    loadProfile(profilePath) {
      return { bytes: readFileSync(profilePath), relativePath: 'test/profile.json' };
    },
    inspectDeployment: async ({ expectedDeploymentId }) => ({
      errors: [],
      ok: true,
      public: { backend_deployment_id: expectedDeploymentId },
    }),
    repository: {
      branch: 'main',
      dirty: false,
      head: 'a'.repeat(40),
      originMain: 'a'.repeat(40),
    },
    transport: createTransport(credentials),
  };
}

function createCredentials() {
  const phone = '13800138000';
  return {
    phone,
    accessA: makeAccess(phone, 'session-a-0001'),
    refreshA: makeRefresh('session-a-0001', 0, 'refresh-a'),
    accessB: makeAccess(phone, 'session-b-0001'),
    refreshB: makeRefresh('session-b-0001', 0, 'refresh-b'),
  };
}

function credentialEnv(credentials) {
  return {
    SOFTBOOK_CET_SESSION_DRILL_ACCESS_A: credentials.accessA,
    SOFTBOOK_CET_SESSION_DRILL_REFRESH_A: credentials.refreshA,
    SOFTBOOK_CET_SESSION_DRILL_ACCESS_B: credentials.accessB,
    SOFTBOOK_CET_SESSION_DRILL_REFRESH_B: credentials.refreshB,
  };
}

function makeAccess(phoneNumber, sessionId, issuedAt = 1700000000) {
  return token('softbook_v2', {
    exp: issuedAt + 900,
    iat: issuedAt,
    phone_number: phoneNumber,
    session_id: sessionId,
    type: 'access',
    version: 2,
  });
}

function makeRefresh(sessionId, rotation, nonce) {
  return token('softbook_refresh', { nonce, rotation, session_id: sessionId });
}

function token(prefix, payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${prefix}.${encoded}.${'s'.repeat(48)}`;
}

function createClock() {
  let second = 0;
  return () => new Date(Date.UTC(2026, 7, 23, 13, 0, second++));
}

function createTransport(
  credentials,
  {
    invalidRotatedBRefresh = false,
    revokeSiblingOnReplay = false,
    rotatedBContentDrift = false,
    rotatedBReleaseDrift = false,
    staleBRefresh = false,
    wrongReplayCode = false,
  } = {}
) {
  const active = new Map([
    ['session-a-0001', true],
    ['session-b-0001', true],
  ]);
  const currentRefresh = new Map([
    ['session-a-0001', credentials.refreshA],
    ['session-b-0001', credentials.refreshB],
  ]);
  if (staleBRefresh) {
    currentRefresh.set(
      'session-b-0001',
      makeRefresh('session-b-0001', 1, 'refresh-b-newer')
    );
  }
  const oldRefresh = new Set();
  const requests = [];
  let logoutRequests = 0;
  const rotatedAccessA = makeAccess(
    credentials.phone,
    'session-a-0001',
    1700000100
  );
  const rotatedRefreshA = makeRefresh('session-a-0001', 1, 'refresh-a-rotated');
  const rotatedAccessB = makeAccess(
    credentials.phone,
    'session-b-0001',
    1700000200
  );
  const rotatedRefreshB = invalidRotatedBRefresh
    ? 'invalid-rotated-refresh-token'
    : makeRefresh('session-b-0001', 1, 'refresh-b-rotated');
  return {
    get logoutRequests() {
      return logoutRequests;
    },
    requests,
    rotatedCredentials: {
      accessA: rotatedAccessA,
      accessB: rotatedAccessB,
      refreshA: rotatedRefreshA,
      refreshB: rotatedRefreshB,
    },
    async request(accessToken, requestPath, options = {}) {
      requests.push({
        accessToken,
        refreshToken: options.body?.refresh_token ?? null,
        requestPath,
      });
      if (requestPath.startsWith('/v2/bootstrap')) {
        const sessionId = decodePayload(accessToken).session_id;
        if (!active.get(sessionId)) return authError('revoked_auth_session');
        const isRotatedB = accessToken === rotatedAccessB;
        return {
          status: 200,
          payload: {
            data: {
              schema_version: 'bootstrap.v2',
              track: 'cet4',
              content: {
                version:
                  isRotatedB && rotatedBContentDrift
                    ? `sha256:${'d'.repeat(64)}`
                    : `sha256:${'c'.repeat(64)}`,
                release_id:
                  isRotatedB && rotatedBReleaseDrift
                    ? 'cet4-release-c'
                    : 'cet4-release-b',
              },
            },
          },
        };
      }
      if (requestPath === '/v2/auth/refresh') {
        const refresh = options.body.refresh_token;
        const sessionId = decodePayload(refresh).session_id;
        if (!active.get(sessionId)) return authError('revoked_auth_session');
        if (oldRefresh.has(refresh)) {
          active.set(sessionId, false);
          if (revokeSiblingOnReplay) active.set('session-b-0001', false);
          return authError(
            wrongReplayCode ? 'invalid_refresh_token' : 'refresh_token_reused'
          );
        }
        if (currentRefresh.get(sessionId) !== refresh) {
          return authError('invalid_refresh_token');
        }
        oldRefresh.add(refresh);
        if (sessionId === 'session-a-0001') {
          currentRefresh.set(sessionId, rotatedRefreshA);
          return {
            status: 200,
            payload: {
              data: {
                access_token: rotatedAccessA,
                refresh_token: rotatedRefreshA,
                session_id: sessionId,
              },
            },
          };
        }
        currentRefresh.set(sessionId, rotatedRefreshB);
        return {
          status: 200,
          payload: {
            data: {
              access_token: rotatedAccessB,
              refresh_token: rotatedRefreshB,
              session_id: sessionId,
            },
          },
        };
      }
      if (requestPath === '/v2/auth/logout') {
        logoutRequests += 1;
        const sessionId = decodePayload(accessToken).session_id;
        active.set(sessionId, false);
        return { status: 204, payload: null };
      }
      throw new Error(`unexpected request ${requestPath}`);
    },
  };
}

function authError(code) {
  return { status: 401, payload: { error: { code, message: 'rejected' } } };
}

function decodePayload(value) {
  const parts = value.split('.');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}
