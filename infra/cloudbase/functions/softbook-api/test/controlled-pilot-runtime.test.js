const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createMemoryStore,
  createSoftbookApi,
  validateCardSourceForImport,
} = require('../index');
const {
  isContentReleaseValidForRuntime,
} = require('../content-release-runtime');

const PHONE = '13800138000';
const START = new Date('2026-08-01T00:00:00.000Z');

test('controlled pilot accepts only its 120-card release and expires trial into 60-card free access', async () => {
  const source = await createPilotCardSource();
  const store = createMemoryStore();
  store.kind = 'cloudbase';
  store.snapshot().cardSources.set('cet4', source);
  let now = new Date(START);
  const api = createSoftbookApi({
    authV2AccessTokenTtlSeconds: 121 * 60 * 60,
    authV2CodeGenerator: () => '2468',
    authV2IndexSecret: 'i'.repeat(64),
    now: () => new Date(now),
    runtimeMode: 'controlled_pilot',
    smsProvider: {
      delivery: 'sms',
      kind: 'test-sms',
      sendCode: async () => undefined,
    },
    store,
    tokenSecret: 't'.repeat(64),
  });
  const session = await authenticatedSession(api);
  const beforeLearning = await store.getMembership(PHONE);

  assert.equal(beforeLearning.stage, 'trial_available');
  const first = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/learning/session',
    query: {track: 'cet4'},
  });
  assert.equal(first.statusCode, 200, JSON.stringify(first.body));
  assert.equal(first.body.data.membership_stage, 'trial');
  assert.equal(first.body.data.access.accessible_card_count, 120);
  assert.equal(first.body.data.trial_started_at, START.toISOString());
  assert.equal(first.body.data.trial_expires_at, '2026-08-06T00:00:00.000Z');

  now = new Date('2026-08-06T00:00:00.000Z');
  const expired = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/learning/session',
    query: {track: 'cet4'},
  });
  assert.equal(expired.statusCode, 200, JSON.stringify(expired.body));
  assert.equal(expired.body.data.membership_stage, 'free');
  assert.deepEqual(expired.body.data.access, {
    mode: 'free_subset',
    accessible_card_count: 60,
    total_card_count: 120,
  });
});

test('formal runtime rejects pilot releases and pilot runtime rejects formal, expired, or ten-card content', async () => {
  const pilot = await createPilotCardSource();
  const checkedAt = new Date('2026-08-02T00:00:00.000Z');
  assert.equal(
    isContentReleaseValidForRuntime(pilot, 'controlled_pilot', checkedAt),
    true,
  );
  assert.equal(
    isContentReleaseValidForRuntime(pilot, 'production', checkedAt),
    false,
  );
  assert.equal(
    isContentReleaseValidForRuntime(
      {
        ...pilot,
        release: {...pilot.release, schema_version: 'content-release.v1'},
      },
      'controlled_pilot',
      checkedAt,
    ),
    false,
  );
  assert.equal(
    isContentReleaseValidForRuntime(
      pilot,
      'controlled_pilot',
      new Date(pilot.release.expires_at),
    ),
    false,
  );
  assert.equal(
    isContentReleaseValidForRuntime(
      {...pilot, card_records: pilot.card_records.slice(0, 10)},
      'controlled_pilot',
      checkedAt,
    ),
    false,
  );
});

test('pilot premium overlay stays effective during session commit without consuming base trial', async () => {
  const source = await createPilotCardSource();
  const store = createMemoryStore();
  store.kind = 'cloudbase';
  store.snapshot().cardSources.set('cet4', source);
  const commandHash = `sha256:${'a'.repeat(64)}`;
  const audit = {
    schema_version: 'pilot-entitlement-audit.v1',
    action: 'grant',
    actor_id: 'receiver-operator',
    command_sha256: commandHash,
    event_id: 'pilot-event-grant-0001',
    occurred_at: '2026-08-01T00:00:00.000Z',
    pilot_id: 'cet4-pilot-2026',
    previous_stage: 'trial_available',
    reason: 'continue controlled pilot after trial',
    resulting_stage: 'pilot_premium',
  };
  store.snapshot().pilotEntitlements.set(PHONE, {
    active_grant: {
      schema_version: 'pilot-entitlement.v1',
      actor_id: audit.actor_id,
      command_sha256: commandHash,
      grant_event_id: audit.event_id,
      granted_at: audit.occurred_at,
      pilot_id: audit.pilot_id,
      reason: audit.reason,
    },
    audit: [audit],
    phone_number: PHONE,
    revision: 1,
    updated_at: audit.occurred_at,
  });
  const api = createSoftbookApi({
    authV2CodeGenerator: () => '2468',
    authV2IndexSecret: 'i'.repeat(64),
    now: () => new Date(START),
    runtimeMode: 'controlled_pilot',
    smsProvider: {
      delivery: 'sms',
      kind: 'test-sms',
      sendCode: async () => undefined,
    },
    store,
    tokenSecret: 't'.repeat(64),
  });
  const session = await authenticatedSession(api, '127.0.0.3');
  const learning = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/learning/session',
    query: {track: 'cet4'},
  });

  assert.equal(learning.statusCode, 200, JSON.stringify(learning.body));
  assert.equal(learning.body.data.membership_stage, 'pilot_premium');
  assert.equal(learning.body.data.trial_started_at, null);
  assert.equal(learning.body.data.trial_expires_at, null);
  assert.equal(store.snapshot().memberships.has(PHONE), false);
});

async function createPilotCardSource() {
  const developmentApi = createSoftbookApi({
    smsCode: '2468',
    tokenSecret: 'development-source-secret',
  });
  const session = await authenticatedSession(developmentApi, '127.0.0.2');
  const response = await request(developmentApi, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v1/learning/card-source',
    query: {track: 'cet4'},
  });
  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  const development = response.body.data;
  const cardRecords = Array.from({length: 120}, (_, index) => {
    const card = structuredClone(
      development.card_records[index % development.card_records.length],
    );
    return {
      ...card,
      card_id: `${card.knowledge_ref}${String(
        Math.floor(index / development.card_records.length) + 1,
      ).padStart(2, '0')}`,
    };
  });
  const normalized = validateCardSourceForImport(
    {
      ...development,
      card_records: cardRecords,
      content_version: undefined,
      release: null,
      source: {
        id: 'controlled-pilot-approved-payload',
        label: 'CET4 controlled pilot approved payload',
      },
    },
    'cet4',
  );
  return validateCardSourceForImport(
    {
      ...normalized,
      release: {
        schema_version: 'pilot-content-release.v1',
        release_id: 'cet4-pilot-release-2026',
        profile_id: 'receiver-controlled-pilot',
        pilot_id: 'cet4-pilot-2026',
        release_class: 'controlled_pilot',
        runtime_mode: 'controlled_pilot',
        track: 'cet4',
        content_version: normalized.content_version,
        card_count: 120,
        free_card_count: 60,
        activated_at: START.toISOString(),
        expires_at: '2026-09-10T00:00:00.000Z',
        minimum_client_versions: {android: '1.0.0', ios: '1.0.0'},
        gate_eligible: false,
      },
    },
    'cet4',
  );
}

async function authenticatedSession(api, clientIp = '127.0.0.1') {
  const challenge = await request(api, {
    body: {phone_number: PHONE},
    clientIp,
    path: '/v2/auth/request-code',
  });
  assert.equal(challenge.statusCode, 200, JSON.stringify(challenge.body));
  const verified = await request(api, {
    body: {
      challenge_id: challenge.body.data.challenge_id,
      phone_number: PHONE,
      sms_code: '2468',
    },
    clientIp,
    path: '/v2/auth/verify-code',
  });
  assert.equal(verified.statusCode, 200, JSON.stringify(verified.body));
  return verified.body.data;
}

function request(api, options) {
  return api.handleHttpRequest({
    body: options.body,
    clientIp: options.clientIp,
    headers: options.headers ?? {},
    method: options.method ?? 'POST',
    path: options.path,
    query: options.query ?? {},
  });
}
