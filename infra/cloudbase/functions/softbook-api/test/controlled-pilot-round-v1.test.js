const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createMemoryStore,
  createSoftbookApi,
  advanceSchedulerEntry,
  createLearningSchedulerV1Service,
} = (() => ({
  ...require('../learning-scheduler-v1'),
  ...require('../index'),
}))();

const NOW = new Date('2026-08-12T06:00:00.000Z');
const ACCOUNT_KEY = 'account-key-round-test';
const PHONE = '13800138000';
const TRACK = 'cet4';
const CONTENT_VERSION = `sha256:${'a'.repeat(64)}`;
const PILOT_ID = 'cet4-controlled-pilot-round-test';

test('controlled pilot pauses at five accepted events and resumes only after exact idempotent acknowledgement', async () => {
  const fixture = createFixture();
  const service = createLearningSchedulerV1Service({
    now: () => new Date(NOW),
    randomBytes: size => Buffer.alloc(size, 7),
    runtimeMode: 'controlled_pilot',
    store: fixture.store,
  });

  const first = await service.read({
    accountKey: ACCOUNT_KEY,
    phoneNumber: PHONE,
    track: TRACK,
  });
  assert.equal(first.selection, null);
  assert.equal(first.next_due_at, null);
  assert.deepEqual(first.round_completion, {
    schema_version: 'pilot-round-completion.v1',
    pilot_id: PILOT_ID,
    content_version: CONTENT_VERSION,
    receipt_id: first.round_completion.receipt_id,
    completed_count: 5,
    space_card_id: '000005',
    review_card_ids: ['000002', '000004'],
  });
  assert.match(first.round_completion.receipt_id, /^prc_[A-Za-z0-9_-]{43}$/);
  assert.equal(fixture.savedCursors.length, 0);

  const repeated = await service.read({
    accountKey: ACCOUNT_KEY,
    phoneNumber: PHONE,
    track: TRACK,
  });
  assert.deepEqual(repeated.round_completion, first.round_completion);

  const command = {
    schema_version: 'pilot-round-continue.v1',
    track: TRACK,
    content_version: CONTENT_VERSION,
    receipt_id: first.round_completion.receipt_id,
    completed_count: 5,
  };
  const acknowledgement = await service.continueRound({
    accountKey: ACCOUNT_KEY,
    body: command,
    phoneNumber: PHONE,
  });
  const exactReplay = await service.continueRound({
    accountKey: ACCOUNT_KEY,
    body: command,
    phoneNumber: PHONE,
  });
  assert.deepEqual(exactReplay, acknowledgement);
  assert.equal(fixture.continuations.size, 1);

  const resumed = await service.read({
    accountKey: ACCOUNT_KEY,
    phoneNumber: PHONE,
    track: TRACK,
  });
  assert.equal(resumed.round_completion, null);
  assert.equal(resumed.selection.card_id, '000006');
  assert.equal(resumed.selection.reason, 'catalog_new');
  assert.equal(fixture.savedCursors.length, 1);

  await assert.rejects(
    service.continueRound({
      accountKey: ACCOUNT_KEY,
      body: {...command, completed_count: 10},
      phoneNumber: PHONE,
    }),
    error =>
      error.statusCode === 409 && error.code === 'pilot_round_authority_drift',
  );
  await assert.rejects(
    service.continueRound({
      accountKey: ACCOUNT_KEY,
      body: {...command, extra: true},
      phoneNumber: PHONE,
    }),
    error => error.statusCode === 400 && error.code === 'invalid_request',
  );
});

test('formal runtime never applies or exposes the controlled-pilot round gate', async () => {
  const fixture = createFixture({formal: true});
  const service = createLearningSchedulerV1Service({
    now: () => new Date(NOW),
    randomBytes: size => Buffer.alloc(size, 9),
    runtimeMode: 'production',
    store: fixture.store,
  });
  const session = await service.read({
    accountKey: ACCOUNT_KEY,
    phoneNumber: PHONE,
    track: TRACK,
  });
  assert.equal(session.round_completion, null);
  assert.notEqual(session.selection, null);
  await assert.rejects(
    service.continueRound({
      accountKey: ACCOUNT_KEY,
      body: {},
      phoneNumber: PHONE,
    }),
    error => error.statusCode === 404 && error.code === 'route_not_found',
  );
});

test('HTTP route is absent outside controlled pilot', async () => {
  const production = createSoftbookApi({
    authV2IndexSecret: 'round-route-development-index-secret',
    runtimeMode: 'development',
    store: createMemoryStore(),
    tokenSecret: 'round-route-production-secret',
  });
  const hidden = await production.handleHttpRequest({
    body: {},
    headers: {},
    method: 'POST',
    path: '/v2/learning/round/continue',
    query: {},
  });
  assert.equal(hidden.statusCode, 404);
  assert.equal(hidden.body.error.code, 'route_not_found');
});

function createFixture({formal = false} = {}) {
  const eventsByCardId = {};
  const schedulerByCardId = {};
  for (let sequence = 1; sequence <= 5; sequence += 1) {
    const cardId = String(sequence).padStart(6, '0');
    const event = {
      answer_grade:
        sequence === 2 || sequence === 4 ? 'review_needed' : 'passed',
      card_id: cardId,
      content_version: CONTENT_VERSION,
      event_id: `round_event_${sequence}`,
      server_sequence: sequence,
      track: TRACK,
      used_hint: false,
      used_peek: false,
    };
    eventsByCardId[cardId] = event;
    schedulerByCardId[cardId] = advanceSchedulerEntry(null, {
      acceptedAt: new Date(NOW.getTime() - (6 - sequence) * 1000).toISOString(),
      event,
      serverSequence: sequence,
    });
  }
  const release = formal
    ? {
        schema_version: 'content-release.v1',
        content_version: CONTENT_VERSION,
        track: TRACK,
      }
    : {
        schema_version: 'pilot-content-release.v1',
        activated_at: '2026-08-01T00:00:00.000Z',
        card_count: 120,
        content_version: CONTENT_VERSION,
        expires_at: '2026-09-01T00:00:00.000Z',
        free_card_count: 60,
        gate_eligible: false,
        minimum_client_versions: {android: '1.0.0', ios: '1.0.0'},
        pilot_id: PILOT_ID,
        profile_id: 'receiver-controlled-pilot-round-profile',
        release_id: 'cet4-controlled-pilot-round-release',
        release_class: 'controlled_pilot',
        runtime_mode: 'controlled_pilot',
        track: TRACK,
      };
  const cardSource = {
    card_records: Array.from({length: 120}, (_, index) => ({
      card_id: String(index + 1).padStart(6, '0'),
    })),
    content_version: CONTENT_VERSION,
    release,
    source: {id: 'round-source', label: 'Round source'},
    track: TRACK,
  };
  const learningState = {
    acknowledged_at: NOW.toISOString(),
    events_by_card_id: eventsByCardId,
    projection_version: 'learning-events.v2',
    scheduler_by_card_id: schedulerByCardId,
    scheduler_version: 'softbook-fsrs.v1',
    track: TRACK,
  };
  let sessionState = {
    account_key: ACCOUNT_KEY,
    cursor: null,
    learning_acknowledged_at: NOW.toISOString(),
    learning_server_sequence: 5,
    revision: 1,
    track: TRACK,
    updated_at: NOW.toISOString(),
  };
  const continuations = new Map();
  const savedCursors = [];
  const continuationKey = input =>
    `${input.accountKey}:${input.track}:${input.completedCount}`;
  const membershipProjection = {
    acknowledged_at: NOW.toISOString(),
    component_revision: {
      base_membership_revision: 1,
      beta_entitlement_revision: 0,
      pilot_entitlement_revision: 0,
    },
    stage: 'trial',
    trial_expires_at: '2026-08-17T06:00:00.000Z',
    trial_remaining_seconds: 432000,
    trial_started_at: '2026-08-12T06:00:00.000Z',
  };
  const store = {
    activateTrialForLearningSession: async () => ({...membershipProjection}),
    confirmLearningSessionCursor: async input =>
      input.expectedRevision === sessionState.revision &&
      input.expectedLearningAcknowledgedAt ===
        sessionState.learning_acknowledged_at &&
      input.expectedLearningServerSequence ===
        sessionState.learning_server_sequence,
    getCardSource: async () => cardSource,
    getLearningSessionCursor: async () => sessionState,
    getLearningState: async () => learningState,
    getMembership: async () => ({...membershipProjection}),
    getPilotRoundContinuation: async input =>
      continuations.get(continuationKey(input)) ?? null,
    getSpaceState: async () => ({states_by_card_id: {}}),
    saveLearningSessionCursor: async input => {
      savedCursors.push(input.cursor);
      sessionState = {
        account_key: input.accountKey,
        cursor: input.cursor,
        learning_acknowledged_at: input.learningAcknowledgedAt,
        learning_server_sequence: input.learningServerSequence,
        revision: sessionState.revision + 1,
        track: input.track,
        updated_at: input.updatedAt,
      };
      return true;
    },
    savePilotRoundContinuation: async input => {
      const key = continuationKey(input);
      const existing = continuations.get(key);
      if (existing) return existing;
      const value = {
        account_key: input.accountKey,
        acknowledged_at: input.acknowledgedAt,
        completed_count: input.completedCount,
        content_version: input.contentVersion,
        pilot_id: input.pilotId,
        receipt_id: input.receiptId,
        schema_version: 'pilot-round-continue-ack.v1',
        track: input.track,
      };
      continuations.set(key, value);
      return value;
    },
    startTrial: async () => ({stage: 'trial'}),
  };
  return {continuations, savedCursors, store};
}
