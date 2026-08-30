const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createMemoryStore,
  createSoftbookApi,
  validateCardSourceForImport,
} = require('../index');

const NOW = new Date('2026-08-12T08:00:00.000Z');
const PHONE = '13800138000';

test('authenticated v2 card source serves a controlled-pilot release while v1 remains disabled', async () => {
  const store = createMemoryStore({
    authIndexSecret: 'controlled-pilot-index-secret-00000001',
  });
  store.kind = 'test_persistent_store';
  const cardSource = await createControlledPilotCardSource();
  store.snapshot().cardSources.set('cet4', cardSource);

  const api = createSoftbookApi({
    authV2AcknowledgementSleeper: async () => undefined,
    authV2CodeGenerator: () => '2468',
    authV2IndexSecret: 'controlled-pilot-index-secret-00000001',
    now: () => new Date(NOW),
    runtimeMode: 'controlled_pilot',
    smsProvider: {
      delivery: 'test_sms',
      kind: 'test_sms',
      sendCode: async () => undefined,
    },
    store,
    tokenSecret: 'controlled-pilot-token-secret-00000001',
  });
  const session = await authenticate(api);
  const headers = {authorization: `Bearer ${session.access_token}`};
  const response = await request(api, {
    headers,
    method: 'GET',
    path: '/v2/learning/card-source',
    query: {track: 'cet4'},
  });

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.data.card_records.length, 60);
  assert.deepEqual(
    response.body.data.card_records,
    cardSource.card_records.slice(0, 60),
  );
  assert.equal(response.body.data.content_version, cardSource.content_version);
  assert.equal(response.body.data.source.id, cardSource.source.id);
  assert.equal(response.body.data.track, 'cet4');

  const missingAuth = await request(api, {
    method: 'GET',
    path: '/v2/learning/card-source',
    query: {track: 'cet4'},
  });
  assert.equal(missingAuth.statusCode, 401);

  const injectedInput = await request(api, {
    headers,
    method: 'GET',
    path: '/v2/learning/card-source',
    query: {phone_number: PHONE, track: 'cet4'},
  });
  assert.equal(injectedInput.statusCode, 400);
  assert.equal(
    injectedInput.body.error.code,
    'learning_card_source_input_forbidden',
  );

  const legacy = await request(api, {
    headers,
    method: 'GET',
    path: '/v1/learning/card-source',
    query: {track: 'cet4'},
  });
  assert.equal(legacy.statusCode, 410);
  assert.equal(legacy.body.error.code, 'legacy_api_disabled');
});

test('card-source enforces the canonical membership prefix without leaking inaccessible answers', async () => {
  const readForStage = async stage => {
    const store = createMemoryStore();
    if (stage === 'trial') {
      await store.startTrial(PHONE, '2026-08-11T08:00:00.000Z');
    } else if (stage === 'free') {
      await store.startTrial(PHONE, '2026-08-01T08:00:00.000Z');
    } else if (stage === 'premium') {
      await store.purchase(PHONE, NOW.toISOString());
    }
    const api = createSoftbookApi({
      authV2AcknowledgementSleeper: async () => undefined,
      authV2IndexSecret: 'softbook-cloudbase-dev-secret',
      now: () => new Date(NOW),
      runtimeMode: 'development',
      smsCode: '2468',
      store,
      tokenSecret: `card-source-${stage}-secret`,
    });
    const session = await authenticate(api);
    const response = await request(api, {
      headers: {authorization: `Bearer ${session.access_token}`},
      method: 'GET',
      path: '/v2/learning/card-source',
      query: {track: 'cet4'},
    });
    assert.equal(response.statusCode, 200, JSON.stringify(response.body));
    return response.body.data;
  };

  const premium = await readForStage('premium');
  const trial = await readForStage('trial');
  const trialAvailable = await readForStage('trial_available');
  const free = await readForStage('free');
  const accessibleCount = Math.ceil(premium.card_records.length * 0.5);

  assert.deepEqual(trial.card_records, premium.card_records);
  assert.deepEqual(
    trialAvailable.card_records,
    premium.card_records.slice(0, accessibleCount),
  );
  assert.equal(free.card_records.length, accessibleCount);
  assert.deepEqual(
    free.card_records,
    premium.card_records.slice(0, accessibleCount),
  );
  assert.ok(free.card_records.length < premium.card_records.length);
  assert.equal(free.content_version, premium.content_version);
  assert.equal(trial.content_version, premium.content_version);
  assert.equal(trialAvailable.content_version, premium.content_version);
  const freeCardIds = new Set(free.card_records.map(card => card.card_id));
  for (const inaccessibleCard of premium.card_records.slice(accessibleCount)) {
    assert.equal(freeCardIds.has(inaccessibleCard.card_id), false);
  }
});

test('controlled-pilot HTTP events reach the five-card round boundary without schema-external track fields', async () => {
  const store = createMemoryStore({
    authIndexSecret: 'controlled-pilot-index-secret-00000002',
  });
  store.kind = 'test_persistent_store';
  const cardSource = await createControlledPilotCardSource();
  store.snapshot().cardSources.set('cet4', cardSource);
  let selectionCounter = 0;
  const api = createSoftbookApi({
    authV2AcknowledgementSleeper: async () => undefined,
    authV2CodeGenerator: () => '2468',
    authV2IndexSecret: 'controlled-pilot-index-secret-00000002',
    learningSchedulerRandomBytes: size => {
      selectionCounter += 1;
      return Buffer.alloc(size, selectionCounter);
    },
    now: () => new Date(NOW),
    runtimeMode: 'controlled_pilot',
    smsProvider: {
      delivery: 'test_sms',
      kind: 'test_sms',
      sendCode: async () => undefined,
    },
    store,
    tokenSecret: 'controlled-pilot-token-secret-00000002',
  });
  const session = await authenticate(api);
  const headers = {authorization: `Bearer ${session.access_token}`};
  const completedCardIds = [];

  for (let index = 0; index < 5; index += 1) {
    const selected = await request(api, {
      headers,
      method: 'GET',
      path: '/v2/learning/session',
      query: {track: 'cet4'},
    });
    assert.equal(selected.statusCode, 200, JSON.stringify(selected.body));
    const selection = selected.body.data.selection;
    assert.notEqual(selection, null);
    const card = cardSource.card_records.find(
      item => item.card_id === selection.card_id,
    );
    const event = {
      event_id: `pilot_http_event_${index + 1}`,
      selection_id: selection.selection_id,
      card_id: card.card_id,
      interaction_id: card.interaction_id,
      phase: selection.phase,
      outcome: card.interaction_id === 'flip' ? 'confident' : 'correct',
      answer_grade: 'passed',
      used_hint: false,
      used_peek: false,
      client_occurred_at: NOW.toISOString(),
      content_version: cardSource.content_version,
      device_cursor: {
        device_id: 'controlled_pilot_round_device',
        sequence: index + 1,
      },
    };
    const submitted = await request(api, {
      body: {
        schema_version: 'learning-events.v2',
        track: 'cet4',
        events: [event],
      },
      headers,
      method: 'POST',
      path: '/v2/learning/events',
    });
    assert.equal(submitted.statusCode, 200, JSON.stringify(submitted.body));
    completedCardIds.push(card.card_id);
  }

  const paused = await request(api, {
    headers,
    method: 'GET',
    path: '/v2/learning/session',
    query: {track: 'cet4'},
  });
  assert.equal(paused.statusCode, 200, JSON.stringify(paused.body));
  assert.equal(paused.body.data.selection, null);
  assert.equal(paused.body.data.round_completion.completed_count, 5);
  assert.equal(
    paused.body.data.round_completion.space_card_id,
    completedCardIds[4],
  );
});

test('controlled-pilot trial starts only from an authenticated valid Learning Session', async () => {
  const store = createMemoryStore({
    authIndexSecret: 'controlled-pilot-index-secret-00000003',
  });
  store.kind = 'test_persistent_store';
  store.snapshot().cardSources.set('cet4', await createControlledPilotCardSource());
  const api = createSoftbookApi({
    authV2AcknowledgementSleeper: async () => undefined,
    authV2CodeGenerator: () => '2468',
    authV2IndexSecret: 'controlled-pilot-index-secret-00000003',
    now: () => new Date(NOW),
    runtimeMode: 'controlled_pilot',
    smsProvider: {
      delivery: 'test_sms',
      kind: 'test_sms',
      sendCode: async () => undefined,
    },
    store,
    tokenSecret: 'controlled-pilot-token-secret-00000003',
  });
  const session = await authenticate(api);
  const headers = {authorization: `Bearer ${session.access_token}`};
  const initial = await request(api, {
    headers,
    method: 'GET',
    path: '/v2/membership/entitlement',
  });
  assert.equal(initial.statusCode, 200, JSON.stringify(initial.body));
  assert.equal(initial.body.data.entitlement.stage, 'trial_available');

  const trial = await request(api, {
    body: {},
    headers,
    method: 'POST',
    path: '/v2/membership/start-trial',
  });
  assert.equal(trial.statusCode, 404, JSON.stringify(trial.body));
  assert.equal(trial.body.error.code, 'route_not_found');

  const injectedIdentity = await request(api, {
    body: {phone_number: '13900139000'},
    headers,
    method: 'POST',
    path: '/v2/membership/start-trial',
  });
  assert.equal(injectedIdentity.statusCode, 404);

  const learning = await request(api, {
    headers,
    method: 'GET',
    path: '/v2/learning/session',
    query: {track: 'cet4'},
  });
  assert.equal(learning.statusCode, 200, JSON.stringify(learning.body));
  assert.equal(learning.body.data.membership_stage, 'trial');
  assert.equal(learning.body.data.trial_started_at, NOW.toISOString());
  assert.equal(
    learning.body.data.trial_expires_at,
    '2026-08-17T08:00:00.000Z',
  );
  assert.equal(learning.body.data.trial_remaining_seconds, 432000);

  const legacy = await request(api, {
    headers,
    method: 'GET',
    path: '/v1/membership/entitlement',
  });
  assert.equal(legacy.statusCode, 410);
  assert.equal(legacy.body.error.code, 'legacy_api_disabled');
});

async function createControlledPilotCardSource() {
  const developmentStore = createMemoryStore();
  const developmentApi = createSoftbookApi({
    authV2AcknowledgementSleeper: async () => undefined,
    authV2IndexSecret: 'softbook-cloudbase-dev-secret',
    now: () => new Date(NOW),
    runtimeMode: 'development',
    smsCode: '2468',
    store: developmentStore,
    tokenSecret: 'development-card-source-secret',
  });
  const session = await authenticate(developmentApi);
  const response = await request(developmentApi, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v1/learning/card-source',
    query: {track: 'cet4'},
  });
  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  const source = response.body.data;
  const cards = Array.from({length: 120}, (_, index) => {
    const template = source.card_records[index % source.card_records.length];
    const suffix = String(Math.floor(index / source.card_records.length) + 1)
      .padStart(2, '0');
    return {...structuredClone(template), card_id: `${template.knowledge_ref}${suffix}`};
  });
  const candidate = validateCardSourceForImport(
    {
      card_records: cards,
      source: {id: 'controlled-pilot-test-source', label: 'Controlled pilot test source'},
      track: 'cet4',
    },
    'cet4',
  );
  return validateCardSourceForImport(
    {
      ...candidate,
      release: {
        schema_version: 'pilot-content-release.v1',
        release_id: 'controlled-pilot-test-release',
        profile_id: 'controlled-pilot-test-profile',
        pilot_id: 'controlled-pilot-test',
        release_class: 'controlled_pilot',
        runtime_mode: 'controlled_pilot',
        track: 'cet4',
        content_version: candidate.content_version,
        card_count: 120,
        free_card_count: 60,
        activated_at: '2026-08-12T07:00:00.000Z',
        expires_at: '2026-09-12T07:00:00.000Z',
        minimum_client_versions: {android: '1.0.0', ios: '1.0.0'},
        gate_eligible: false,
      },
    },
    'cet4',
  );
}

async function authenticate(api) {
  const challenge = await request(api, {
    body: {phone_number: PHONE},
    clientIp: '127.0.0.1',
    method: 'POST',
    path: '/v2/auth/request-code',
  });
  assert.equal(challenge.statusCode, 200, JSON.stringify(challenge.body));
  const verified = await request(api, {
    body: {
      challenge_id: challenge.body.data.challenge_id,
      phone_number: PHONE,
      sms_code: '2468',
    },
    clientIp: '127.0.0.1',
    method: 'POST',
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
    method: options.method,
    path: options.path,
    query: options.query ?? {},
  });
}
