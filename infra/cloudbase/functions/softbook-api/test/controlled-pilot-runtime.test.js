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
  assert.equal(first.body.data.trial_remaining_seconds, 120 * 60 * 60);

  now = new Date('2026-08-06T00:00:00.000Z');
  const expired = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/learning/session',
    query: {track: 'cet4'},
  });
  assert.equal(expired.statusCode, 200, JSON.stringify(expired.body));
  assert.equal(expired.body.data.membership_stage, 'free');
  assert.equal(expired.body.data.trial_remaining_seconds, 0);
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

test('five confirmed events create one durable server round gate until exact continue', async () => {
  const source = await createPilotCardSource();
  const store = createMemoryStore();
  store.kind = 'cloudbase';
  store.snapshot().cardSources.set('cet4', source);
  let now = new Date('2026-08-01T15:59:50.000Z');
  const api = createSoftbookApi({
    authV2CodeGenerator: () => '2468',
    authV2IndexSecret: 'i'.repeat(64),
    learningSchedulerRandomBytes: size => Buffer.alloc(size, 7),
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
  const session = await authenticatedSession(api, '127.0.0.4');
  let lastEvent;

  for (let index = 0; index < 5; index += 1) {
    const learning = await learningSession(api, session);
    assert.equal(learning.statusCode, 200, JSON.stringify(learning.body));
    assert.notEqual(learning.body.data.selection, null);
    lastEvent = controlledPilotEvent(
      source,
      learning.body.data.selection,
      index,
      now.toISOString(),
    );
    if (index === 4) {
      lastEvent.answer_grade = 'review_needed';
      lastEvent.outcome =
        lastEvent.interaction_id === 'flip' ? 'review' : 'incorrect';
    }
    const submitted = await submitEvents(api, session, [lastEvent]);
    assert.equal(submitted.statusCode, 200, JSON.stringify(submitted.body));
  }

  const pending = await learningSession(api, session);
  assert.equal(pending.statusCode, 200, JSON.stringify(pending.body));
  assert.equal(pending.body.data.selection, null);
  assert.equal(pending.body.data.next_due_at, null);
  assert.equal(pending.body.data.round_completion.completed_count, 5);
  assert.equal(
    pending.body.data.round_completion.schema_version,
    'pilot-round-completion.v1',
  );
  assert.match(pending.body.data.round_completion.receipt_id, /^rnd_/);
  assert.equal(
    pending.body.data.round_completion.space_card_id,
    lastEvent.card_id,
  );
  assert.deepEqual(pending.body.data.round_completion.review_card_ids, [
    lastEvent.card_id,
  ]);

  const replay = await submitEvents(api, session, [lastEvent]);
  assert.equal(replay.statusCode, 200, JSON.stringify(replay.body));
  now = new Date('2026-08-01T16:00:10.000Z');
  const afterMidnight = await learningSession(api, session);
  assert.deepEqual(
    afterMidnight.body.data.round_completion,
    pending.body.data.round_completion,
  );
  assert.equal(afterMidnight.body.data.selection, null);
  const secondDeviceSession = await authenticatedSession(api, '127.0.0.5');
  const secondDevicePending = await learningSession(api, secondDeviceSession);
  assert.deepEqual(
    secondDevicePending.body.data.round_completion,
    pending.body.data.round_completion,
  );

  const rejected = await continueRound(api, session, source.content_version, {
    ...pending.body.data.round_completion,
    completed_count: 10,
  });
  assert.equal(rejected.statusCode, 409);
  assert.equal(store.snapshot().pilotRoundContinuations.size, 0);
  const wrongReceipt = await continueRound(
    api,
    session,
    source.content_version,
    {
      ...pending.body.data.round_completion,
      receipt_id: `${pending.body.data.round_completion.receipt_id.slice(0, -1)}${
        pending.body.data.round_completion.receipt_id.endsWith('A') ? 'B' : 'A'
      }`,
    },
  );
  assert.equal(wrongReceipt.statusCode, 409);
  const injectedIdentity = await request(api, {
    body: {
      schema_version: 'pilot-round-continue.v1',
      track: 'cet4',
      content_version: source.content_version,
      receipt_id: pending.body.data.round_completion.receipt_id,
      completed_count: 5,
      pilot_id: 'client-supplied-pilot',
    },
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'POST',
    path: '/v2/learning/round/continue',
  });
  assert.equal(injectedIdentity.statusCode, 400);
  assert.equal(store.snapshot().pilotRoundContinuations.size, 0);

  const acknowledged = await continueRound(
    api,
    session,
    source.content_version,
    pending.body.data.round_completion,
  );
  assert.equal(acknowledged.statusCode, 200, JSON.stringify(acknowledged.body));
  assert.equal(acknowledged.body.data.status, 'acknowledged');
  assert.equal(store.snapshot().pilotRoundContinuations.size, 1);

  const duplicate = await continueRound(
    api,
    session,
    source.content_version,
    pending.body.data.round_completion,
  );
  assert.equal(duplicate.statusCode, 200, JSON.stringify(duplicate.body));
  assert.equal(duplicate.body.data.status, 'duplicate');
  assert.equal(
    duplicate.body.data.acknowledged_at,
    acknowledged.body.data.acknowledged_at,
  );

  const next = await learningSession(api, session);
  assert.equal(next.statusCode, 200, JSON.stringify(next.body));
  assert.notEqual(next.body.data.selection, null);
  assert.equal(next.body.data.round_completion, null);
  const secondDeviceAfterContinue = await learningSession(
    api,
    secondDeviceSession,
  );
  assert.equal(secondDeviceAfterContinue.body.data.round_completion, null);
  assert.equal(
    secondDeviceAfterContinue.body.data.selection.selection_id,
    next.body.data.selection.selection_id,
  );
  const sixth = controlledPilotEvent(
    source,
    next.body.data.selection,
    5,
    now.toISOString(),
  );
  const sixthSubmitted = await submitEvents(api, session, [sixth]);
  assert.equal(sixthSubmitted.statusCode, 200, JSON.stringify(sixthSubmitted.body));
  const lateReplay = await continueRound(
    api,
    session,
    source.content_version,
    pending.body.data.round_completion,
  );
  assert.equal(lateReplay.statusCode, 200, JSON.stringify(lateReplay.body));
  assert.equal(lateReplay.body.data.status, 'duplicate');
  assert.equal(
    lateReplay.body.data.acknowledged_at,
    acknowledged.body.data.acknowledged_at,
  );
});

test('pilot round continue route is absent outside controlled pilot', async () => {
  const api = createSoftbookApi({
    authV2IndexSecret: 'i'.repeat(64),
    runtimeMode: 'development',
    store: createMemoryStore(),
    tokenSecret: 't'.repeat(64),
  });
  const response = await request(api, {
    body: {
      schema_version: 'pilot-round-continue.v1',
      track: 'cet4',
      content_version: `sha256:${'a'.repeat(64)}`,
      receipt_id: `rnd_${'a'.repeat(43)}`,
      completed_count: 5,
    },
    method: 'POST',
    path: '/v2/learning/round/continue',
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.body.error.code, 'not_found');
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

function learningSession(api, session) {
  return request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/learning/session',
    query: {track: 'cet4'},
  });
}

function submitEvents(api, session, events) {
  return request(api, {
    body: {
      schema_version: 'learning-events.v2',
      track: 'cet4',
      events,
    },
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'POST',
    path: '/v2/learning/events',
  });
}

function continueRound(api, session, contentVersion, completion) {
  return request(api, {
    body: {
      schema_version: 'pilot-round-continue.v1',
      track: 'cet4',
      content_version: contentVersion,
      receipt_id: completion.receipt_id,
      completed_count: completion.completed_count,
    },
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'POST',
    path: '/v2/learning/round/continue',
  });
}

function controlledPilotEvent(source, selection, index, occurredAt) {
  const card = source.card_records.find(
    item => item.card_id === selection.card_id,
  );
  return {
    event_id: `pilot_round_event_${String(index + 1).padStart(4, '0')}`,
    selection_id: selection.selection_id,
    card_id: card.card_id,
    interaction_id: card.interaction_id,
    phase: selection.phase,
    outcome: card.interaction_id === 'flip' ? 'confident' : 'correct',
    answer_grade: 'passed',
    used_hint: false,
    used_peek: false,
    client_occurred_at: occurredAt,
    content_version: source.content_version,
    device_cursor: {
      device_id: 'pilot_round_device_0001',
      sequence: index + 1,
    },
  };
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
