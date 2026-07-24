const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createCloudBaseStore,
  createMemoryStore,
  createSoftbookApi,
  validateCardSourceForImport,
} = require('../index');
const {createLearningEventsV2Service} = require('../learning-events-v2');
const {
  createAccountLearningSessionId,
} = require('../learning-scheduler-v1');
const {
  createCardSourceVersionId,
  createLearningMigrationRevisionId,
} = require('../learning-events-v2-store');

const START_TIME = new Date('2026-04-30T12:00:00.000Z');
const DAY_KEY = '2026-04-30';
const PHONE_ONE = '13800138000';
const PHONE_TWO = '13900139000';
const CURRENT_SELECTION_ID = 'sel_current_selection_pending';

function createClock() {
  let value = new Date(START_TIME);

  return {
    advanceDays(days) {
      value = new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
    },
    now: () => new Date(value),
  };
}

function createTestApi(options = {}) {
  const clock = options.clock ?? createClock();

  return {
    api: createSoftbookApi({
      now: clock.now,
      smsCode: '2468',
      tokenSecret: 'learning-events-test-secret',
      ...options,
      clock: undefined,
    }),
    clock,
  };
}

async function request(api, options) {
  return api.handleHttpRequest({
    body: options.body,
    clientIp: options.clientIp,
    headers: options.headers ?? {},
    method: options.method,
    path: options.path,
    query: options.query ?? {},
  });
}

async function authenticatedSession(
  api,
  phoneNumber = PHONE_ONE,
  clientIp = '127.0.0.1',
) {
  const challenge = await request(api, {
    body: {phone_number: phoneNumber},
    clientIp,
    method: 'POST',
    path: '/v2/auth/request-code',
  });
  assert.equal(challenge.statusCode, 200);

  const verified = await request(api, {
    body: {
      challenge_id: challenge.body.data.challenge_id,
      phone_number: phoneNumber,
      sms_code: '2468',
    },
    clientIp,
    method: 'POST',
    path: '/v2/auth/verify-code',
  });
  assert.equal(verified.statusCode, 200);
  return verified.body.data;
}

async function cardSource(api, session, track = 'cet4') {
  const response = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v1/learning/card-source',
    query: {track},
  });
  assert.equal(response.statusCode, 200);
  return response.body.data;
}

async function submit(api, session, events, track = 'cet4', extra = {}) {
  if (events.some(event => event.selection_id === CURRENT_SELECTION_ID)) {
    await bindEventsToCurrentSelection(api, session, events, track);
  }

  return request(api, {
    body: {
      schema_version: 'learning-events.v2',
      track,
      events,
      ...(extra.body ?? {}),
    },
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'POST',
    path: '/v2/learning/events',
    query: extra.query,
  });
}

async function bindEventsToCurrentSelection(
  api,
  session,
  events,
  track = 'cet4',
) {
  const selected = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/learning/session',
    query: {track},
  });
  assert.equal(
    selected.statusCode,
    200,
    `selection preflight: ${JSON.stringify(selected.body)}`,
  );
  assert.notEqual(selected.body.data.selection, null);

  events.forEach(event => {
    if (event.selection_id === CURRENT_SELECTION_ID) {
      event.selection_id = selected.body.data.selection.selection_id;
    }
  });

  return selected.body.data.selection;
}

function eventFor(source, index = 0, overrides = {}) {
  const card = source.card_records[index];
  const outcome = card.interaction_id === 'flip' ? 'confident' : 'correct';

  return {
    event_id: `event_${String(index + 1).padStart(4, '0')}`,
    selection_id: CURRENT_SELECTION_ID,
    card_id: card.card_id,
    interaction_id: card.interaction_id,
    phase: 'learning',
    outcome,
    answer_grade: 'passed',
    used_hint: false,
    used_peek: false,
    client_occurred_at: START_TIME.toISOString(),
    content_version: source.content_version,
    device_cursor: {
      device_id: 'device_installation_0001',
      sequence: index + 1,
    },
    ...overrides,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('learning-events v2 writes canonical projections in memory and CloudBase', async () => {
  const variants = [
    ['memory', createMemoryStore()],
    ['cloudbase', createCloudBaseStore({db: createFakeCloudBaseDb()})],
  ];

  for (const [name, store] of variants) {
    const {api} = createTestApi({store});
    const session = await authenticatedSession(
      api,
      PHONE_ONE,
      name === 'memory' ? '127.0.0.10' : '127.0.0.11',
    );
    const source = await cardSource(api, session);
    const event = eventFor(source);
    const accepted = await submit(api, session, [event]);

    assert.equal(accepted.statusCode, 200, name);
    assert.deepEqual(accepted.body.data, {
      schema_version: 'learning-events-ack.v2',
      acknowledged_at: START_TIME.toISOString(),
      track: 'cet4',
      results: [
        {
          event_id: event.event_id,
          status: 'accepted',
          server_sequence: 1,
        },
      ],
    });

    const bootstrap = await request(api, {
      headers: {authorization: `Bearer ${session.access_token}`},
      method: 'GET',
      path: '/v2/bootstrap',
      query: {day_key: DAY_KEY, track: 'cet4'},
    });

    assert.equal(
      bootstrap.statusCode,
      200,
      `${name}: ${JSON.stringify(bootstrap.body)}`,
    );
    assert.equal(bootstrap.body.data.progress.learning_completed_count, 1);
    assert.equal(bootstrap.body.data.progress.review_completed_count, 0);
    assert.equal(bootstrap.body.data.progress.total_completed_count, 1);
    assert.equal(bootstrap.body.data.progress.pending_review_count, 0);
    assert.equal(bootstrap.body.data.learning.cursor, null);
    assert.deepEqual(bootstrap.body.data.learning.source, source.source);
    assert.deepEqual(bootstrap.body.data.learning.card_states, [
      {
        answer_grade: 'passed',
        card_id: event.card_id,
        completed_at: START_TIME.toISOString(),
        content_version: source.content_version,
        event_id: event.event_id,
        interaction_id: event.interaction_id,
        is_favorited: false,
        outcome: event.outcome,
        phase: 'learning',
        server_sequence: 1,
        used_hint: false,
        used_peek: false,
      },
    ]);
    assert.equal(JSON.stringify(bootstrap.body).includes(PHONE_ONE), false);
  }
});

test('learning-events v2 rejects identity input and strict-schema drift', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const valid = eventFor(source);
  const missingSelection = {...valid};
  delete missingSelection.selection_id;
  const cases = [
    {
      body: {phone_number: PHONE_TWO},
      expectedCode: 'learning_events_identity_input_forbidden',
    },
    {
      event: {...valid, total_completed_count: 1},
      expectedCode: 'invalid_learning_events_request',
    },
    {
      event: {
        ...valid,
        device_cursor: {...valid.device_cursor, account_id: 'injected'},
      },
      expectedCode: 'learning_events_identity_input_forbidden',
    },
    {
      event: {...valid, answer_grade: 'good'},
      expectedCode: 'invalid_learning_events_request',
    },
    {
      event: missingSelection,
      expectedCode: 'invalid_learning_events_request',
    },
    {
      event: {...valid, client_occurred_at: '2026-02-30T00:00:00Z'},
      expectedCode: 'invalid_learning_events_request',
    },
    {
      event: {...valid, outcome: 'review', answer_grade: 'passed'},
      expectedCode: 'invalid_learning_events_request',
    },
  ];

  for (const fixture of cases) {
    const response = await submit(
      api,
      session,
      [fixture.event ?? valid],
      'cet4',
      {body: fixture.body},
    );
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.error.code, fixture.expectedCode);
  }

  const queryIdentity = await submit(api, session, [valid], 'cet4', {
    query: {phone_number: PHONE_TWO},
  });
  assert.equal(queryIdentity.statusCode, 400);
  assert.equal(
    queryIdentity.body.error.code,
    'learning_events_identity_input_forbidden',
  );
  assert.equal(store.snapshot().learningEvents.size, 0);
});

test('unseen events require one exact current selection and fail atomically', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const valid = eventFor(source, 0);
  const selection = await bindEventsToCurrentSelection(api, session, [valid]);
  const snapshot = store.snapshot();
  const initialCursor = clone(
    [...snapshot.learningSessions.values()][0].cursor,
  );
  const retainedSource = {
    ...clone(source),
    release: null,
    retained_until: null,
    retention_status: 'retained',
  };
  snapshot.cardSourceVersions.set(
    createCardSourceVersionId('cet4', source.content_version),
    retainedSource,
  );
  const nextSource = validateCardSourceForImport(
    {
      card_records: clone(source.card_records),
      release: null,
      source: {
        ...source.source,
        label: `${source.source.label} next`,
      },
      track: 'cet4',
    },
    'cet4',
  );
  snapshot.cardSources.set('cet4', nextSource);

  const staleSelection = {
    ...valid,
    event_id: 'event_stale_selection_0001',
    selection_id: 'sel_stale_selection_pending',
  };
  const wrongCard = eventFor(source, 1, {
    device_cursor: {device_id: 'device_installation_0001', sequence: 2},
    event_id: 'event_wrong_card_0002',
    selection_id: selection.selection_id,
  });
  const wrongPhase = {
    ...valid,
    device_cursor: {device_id: 'device_installation_0001', sequence: 3},
    event_id: 'event_wrong_phase_0003',
    phase: 'review',
  };
  const wrongContentVersion = eventFor(nextSource, 0, {
    device_cursor: {device_id: 'device_installation_0001', sequence: 4},
    event_id: 'event_wrong_content_0004',
    selection_id: selection.selection_id,
  });
  const secondUnseen = eventFor(source, 1, {
    device_cursor: {device_id: 'device_installation_0001', sequence: 5},
    event_id: 'event_second_unseen_0005',
    selection_id: selection.selection_id,
  });

  for (const events of [
    [staleSelection],
    [wrongCard],
    [wrongPhase],
    [wrongContentVersion],
    [valid, secondUnseen],
  ]) {
    const rejected = await submit(api, session, events);
    assert.equal(rejected.statusCode, 409, JSON.stringify(rejected.body));
    assert.equal(
      rejected.body.error.code,
      'learning_event_selection_conflict',
    );
    assert.deepEqual(
      [...snapshot.learningSessions.values()][0].cursor,
      initialCursor,
    );
    assert.equal(snapshot.learningEvents.size, 0);
    assert.equal(snapshot.learningEventSequences.size, 0);
    assert.equal(snapshot.learningStates.size, 0);
  }

  const accepted = await submit(api, session, [valid]);
  assert.equal(accepted.statusCode, 200, JSON.stringify(accepted.body));
  assert.equal(accepted.body.data.results[0].status, 'accepted');
  assert.equal([...snapshot.learningSessions.values()][0].cursor, null);

  const replayed = await submit(api, session, [valid]);
  assert.equal(replayed.statusCode, 200, JSON.stringify(replayed.body));
  assert.equal(replayed.body.data.results[0].status, 'duplicate');
  assert.equal(snapshot.learningEvents.size, 1);
});

test('learning-events v2 requires an active session and enforces the configured batch bound', async () => {
  assert.throws(
    () => createTestApi({learningEventsBatchLimit: 10}),
    /batchLimit must be between 1 and 9/,
  );
  const store = createMemoryStore();
  const {api} = createTestApi({learningEventsBatchLimit: 1, store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const first = eventFor(source, 0);
  const second = eventFor(source, 1, {
    event_id: 'event_batch_bound_0002',
    device_cursor: {device_id: 'device_installation_0001', sequence: 2},
  });
  const missingSession = await request(api, {
    body: {
      schema_version: 'learning-events.v2',
      track: 'cet4',
      events: [first],
    },
    method: 'POST',
    path: '/v2/learning/events',
  });
  const empty = await submit(api, session, []);
  const oversized = await submit(api, session, [first, second]);

  assert.equal(missingSession.statusCode, 401);
  assert.equal(missingSession.body.error.code, 'missing_auth_token');
  assert.equal(empty.statusCode, 400);
  assert.equal(oversized.statusCode, 400);
  assert.equal(store.snapshot().learningEvents.size, 0);
});

test('selection-bound CloudBase commit retains transaction-operation headroom', async () => {
  const baseStore = createMemoryStore();
  const {api: baseApi} = createTestApi({store: baseStore});
  const baseSession = await authenticatedSession(
    baseApi,
    PHONE_TWO,
    '127.0.0.29',
  );
  const baseSource = await cardSource(baseApi, baseSession);
  const historicalSources = Array.from({length: 9}, (_, index) =>
    validateCardSourceForImport(
      {
        card_records: clone(baseSource.card_records),
        release: null,
        source: {
          id: `operation-budget-source-${index + 1}`,
          label: `Operation budget source ${index + 1}`,
        },
        track: 'cet4',
      },
      'cet4',
    ),
  );
  const db = createFakeCloudBaseDb();

  for (const source of historicalSources) {
    await db
      .collection('softbook_card_source_versions')
      .doc(createCardSourceVersionId('cet4', source.content_version))
      .set({
        ...clone(source),
        retained_until: null,
        retention_status: 'retained',
      });
  }

  const {api} = createTestApi({store: createCloudBaseStore({db})});
  const session = await authenticatedSession(api, PHONE_ONE, '127.0.0.30');
  const storedAuthSession = [
    ...db.snapshot().get('softbook_auth_sessions').values(),
  ].find(value => value.session_id === session.session_id);
  await db
    .collection('softbook_learning_sessions')
    .doc(createAccountLearningSessionId(storedAuthSession.account_key, 'cet4'))
    .set({
      account_key: storedAuthSession.account_key,
      cursor: {
        card_id: historicalSources[0].card_records[0].card_id,
        content_version: historicalSources[0].content_version,
        due_at: null,
        phase: 'learning',
        reason: 'catalog_new',
        selected_at: START_TIME.toISOString(),
        selection_id: 'sel_operation_budget_0001',
        source_id: historicalSources[0].source.id,
        track: 'cet4',
      },
      learning_acknowledged_at: null,
      learning_server_sequence: 0,
      revision: 1,
      track: 'cet4',
      updated_at: START_TIME.toISOString(),
    });
  const cet6Source = await cardSource(api, session, 'cet6');
  const cet6Card = cet6Source.card_records[0];
  const legacySibling = await request(api, {
    body: {
      day_key: DAY_KEY,
      events: [
        {
          card_id: cet6Card.card_id,
          completed_at: START_TIME.toISOString(),
          interaction_id: cet6Card.interaction_id,
          is_favorited: false,
          outcome: cet6Card.interaction_id === 'flip' ? 'confident' : 'correct',
          phase: 'learning',
          used_hint: false,
          used_peek: false,
        },
      ],
      phone_number: PHONE_ONE,
      source_id: cet6Source.source.id,
      source_label: cet6Source.source.label,
      track: 'cet6',
    },
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'POST',
    path: '/v1/learning/state-sync',
  });
  assert.equal(legacySibling.statusCode, 200);

  const event = eventFor(historicalSources[0], 0, {
    device_cursor: {
      device_id: 'device_operation_budget_0001',
      sequence: 1,
    },
    event_id: 'event_operation_budget_0001',
    selection_id: 'sel_operation_budget_0001',
  });
  const response = await submit(api, session, [event]);

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.data.results.length, 1);
  assert.ok(db.lastTransactionOperations() <= 29);
});

test('maximum replay batch with one unseen selection retains CloudBase headroom', async () => {
  const db = createFakeCloudBaseDb();
  const {api} = createTestApi({store: createCloudBaseStore({db})});
  const session = await authenticatedSession(api, PHONE_ONE, '127.0.0.31');
  const source = await cardSource(api, session);
  const acceptedEvents = [];

  for (let index = 0; index < 8; index += 1) {
    const selected = await request(api, {
      headers: {authorization: `Bearer ${session.access_token}`},
      method: 'GET',
      path: '/v2/learning/session',
      query: {track: 'cet4'},
    });
    assert.equal(selected.statusCode, 200, JSON.stringify(selected.body));
    const selection = selected.body.data.selection;
    assert.notEqual(selection, null);
    const cardIndex = source.card_records.findIndex(
      card => card.card_id === selection.card_id,
    );
    assert.notEqual(cardIndex, -1);
    const event = eventFor(source, cardIndex, {
      device_cursor: {
        device_id: 'device_operation_replay_0001',
        sequence: index + 1,
      },
      event_id: `event_operation_replay_${String(index + 1).padStart(4, '0')}`,
      phase: selection.phase,
      selection_id: selection.selection_id,
    });
    const accepted = await submit(api, session, [event]);
    assert.equal(accepted.statusCode, 200, JSON.stringify(accepted.body));
    acceptedEvents.push(event);

    const projection = [
      ...db.snapshot().get('softbook_learning_states').values(),
    ].find(value => value.projection_version === 'learning-events.v2');
    projection.scheduler_by_card_id[event.card_id].card.due =
      START_TIME.toISOString();
  }

  const selected = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/learning/session',
    query: {track: 'cet4'},
  });
  assert.equal(selected.statusCode, 200, JSON.stringify(selected.body));
  const selection = selected.body.data.selection;
  const cardIndex = source.card_records.findIndex(
    card => card.card_id === selection.card_id,
  );
  const unseen = eventFor(source, cardIndex, {
    device_cursor: {
      device_id: 'device_operation_replay_0001',
      sequence: 9,
    },
    event_id: 'event_operation_replay_0009',
    phase: selection.phase,
    selection_id: selection.selection_id,
  });

  const response = await submit(api, session, [...acceptedEvents, unseen]);

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.deepEqual(
    response.body.data.results.map(result => result.status),
    [...Array(8).fill('duplicate'), 'accepted'],
  );
  assert.equal(db.lastTransactionOperations(), 29);
});

test('learning-events v2 rejects a stored session whose account key no longer matches its phone', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const event = eventFor(source);
  await bindEventsToCurrentSelection(api, session, [event]);
  store.snapshot().authSessions.get(session.session_id).account_key =
    '0'.repeat(64);

  const response = await submit(api, session, [event]);

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error.code, 'revoked_auth_session');
  assert.equal(store.snapshot().learningEvents.size, 0);
});

test('exact replay and mixed duplicate batches preserve one immutable write', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const first = eventFor(source, 0);
  const second = eventFor(source, 1, {
    event_id: 'event_0002',
    device_cursor: {
      device_id: 'device_installation_0001',
      sequence: 2,
    },
  });

  const accepted = await submit(api, session, [first]);
  const replayed = await submit(api, session, [first]);
  const mixed = await submit(api, session, [first, second, second]);

  assert.equal(accepted.body.data.results[0].status, 'accepted');
  assert.deepEqual(replayed.body.data.results, [
    {event_id: first.event_id, status: 'duplicate', server_sequence: 1},
  ]);
  assert.deepEqual(mixed.body.data.results, [
    {event_id: first.event_id, status: 'duplicate', server_sequence: 1},
    {event_id: second.event_id, status: 'accepted', server_sequence: 2},
    {event_id: second.event_id, status: 'duplicate', server_sequence: 2},
  ]);
  assert.equal(store.snapshot().learningEvents.size, 2);

  const bootstrap = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: DAY_KEY, track: 'cet4'},
  });
  assert.equal(bootstrap.body.data.progress.learning_completed_count, 2);
  assert.equal(bootstrap.body.data.progress.total_completed_count, 2);
});

test('event-ID mutation and device-cursor forks reject the full batch', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const first = eventFor(source, 0);
  const next = eventFor(source, 1, {
    event_id: 'event_next_0002',
    device_cursor: {
      device_id: 'device_installation_0001',
      sequence: 2,
    },
  });
  await submit(api, session, [first]);

  const mutated = {
    ...first,
    outcome: first.interaction_id === 'flip' ? 'review' : 'incorrect',
    answer_grade: 'review_needed',
  };
  const eventConflict = await submit(api, session, [mutated, next]);
  assert.equal(eventConflict.statusCode, 409);
  assert.equal(eventConflict.body.error.code, 'learning_event_id_conflict');
  assert.equal(store.snapshot().learningEvents.size, 1);

  const acceptedNext = await submit(api, session, [next]);
  assert.equal(acceptedNext.body.data.results[0].server_sequence, 2);

  const cursorFork = eventFor(source, 2, {
    event_id: 'event_cursor_fork_0003',
    device_cursor: clone(next.device_cursor),
  });
  const cursorConflictResponse = await submit(api, session, [cursorFork]);
  assert.equal(cursorConflictResponse.statusCode, 409);
  assert.equal(
    cursorConflictResponse.body.error.code,
    'learning_event_cursor_conflict',
  );
  assert.equal(store.snapshot().learningEvents.size, 2);

  const crossTrackReplay = await submit(api, session, [first], 'cet6');
  assert.equal(crossTrackReplay.statusCode, 409);
  assert.equal(crossTrackReplay.body.error.code, 'learning_event_id_conflict');
});

test('device cursor gaps and out-of-order replay keep account-scoped server order', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const cet4 = await cardSource(api, session, 'cet4');
  const cet6 = await cardSource(api, session, 'cet6');
  const sequenceTen = eventFor(cet4, 0, {
    event_id: 'event_cursor_gap_0010',
    device_cursor: {device_id: 'device_installation_gap', sequence: 10},
  });
  const sequenceTwo = eventFor(cet4, 1, {
    event_id: 'event_cursor_gap_0002',
    device_cursor: {device_id: 'device_installation_gap', sequence: 2},
  });
  const otherTrack = eventFor(cet6, 0, {
    event_id: 'event_other_track_0001',
    device_cursor: {device_id: 'device_installation_cet6', sequence: 1},
  });

  const first = await submit(api, session, [sequenceTen]);
  const second = await submit(api, session, [sequenceTwo]);
  const third = await submit(api, session, [otherTrack], 'cet6');

  assert.deepEqual(
    [first, second, third].map(
      response => response.body.data.results[0].server_sequence,
    ),
    [1, 2, 3],
  );
});

test('latest accepted event owns per-card review state without changing completion history', async () => {
  const store = createMemoryStore();
  const clock = createClock();
  const {api} = createTestApi({
    authV2AccessTokenTtlSeconds: 2 * 24 * 60 * 60,
    authV2RefreshTokenTtlSeconds: 2 * 24 * 60 * 60,
    clock,
    store,
  });
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const card = source.card_records[0];
  const reviewOutcome = card.interaction_id === 'flip' ? 'review' : 'incorrect';
  const passOutcome = card.interaction_id === 'flip' ? 'confident' : 'correct';
  const review = eventFor(source, 0, {
    answer_grade: 'review_needed',
    event_id: 'event_review_state_0001',
    outcome: reviewOutcome,
  });
  const passed = eventFor(source, 0, {
    answer_grade: 'passed',
    event_id: 'event_review_state_0002',
    outcome: passOutcome,
    phase: 'review',
    device_cursor: {device_id: 'device_installation_0001', sequence: 2},
  });

  await submit(api, session, [review]);
  const pending = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: DAY_KEY, track: 'cet4'},
  });
  assert.equal(pending.body.data.progress.pending_review_count, 1);

  clock.advanceDays(1);
  await submit(api, session, [passed]);
  const reconciled = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: DAY_KEY, track: 'cet4'},
  });
  assert.equal(reconciled.body.data.progress.learning_completed_count, 1);
  assert.equal(reconciled.body.data.progress.review_completed_count, 1);
  assert.equal(reconciled.body.data.progress.total_completed_count, 2);
  assert.equal(reconciled.body.data.progress.pending_review_count, 0);
  assert.equal(reconciled.body.data.learning.card_states.length, 1);
  assert.equal(
    reconciled.body.data.learning.card_states[0].event_id,
    passed.event_id,
  );
});

test('new events enforce time bounds and exact content identity atomically', async () => {
  const store = createMemoryStore();
  const clock = createClock();
  const {api} = createTestApi({
    authV2AccessTokenTtlSeconds: 200 * 24 * 60 * 60,
    authV2RefreshTokenTtlSeconds: 200 * 24 * 60 * 60,
    clock,
    store,
  });
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const valid = eventFor(source);
  const fixtures = [
    {...valid, client_occurred_at: '2026-01-01T00:00:00.000Z'},
    {...valid, client_occurred_at: '2026-04-30T12:05:01.000Z'},
    {...valid, content_version: `sha256:${'0'.repeat(64)}`},
    {...valid, card_id: '999999'},
    {
      ...valid,
      interaction_id:
        valid.interaction_id === 'flip' ? 'multiple_choice' : 'flip',
      outcome: valid.interaction_id === 'flip' ? 'correct' : 'confident',
    },
  ];

  for (const fixture of fixtures) {
    const response = await submit(api, session, [fixture]);
    assert.ok([400, 422].includes(response.statusCode));
    assert.equal(store.snapshot().learningEvents.size, 0);
  }

  const accepted = await submit(api, session, [valid]);
  assert.equal(accepted.statusCode, 200);
  clock.advanceDays(100);
  const lateReplay = await submit(api, session, [valid]);
  assert.equal(lateReplay.statusCode, 200);
  assert.equal(lateReplay.body.data.results[0].status, 'duplicate');
  assert.equal(lateReplay.body.data.results[0].server_sequence, 1);
});

test('one invalid unseen event rejects a mixed duplicate batch before writes', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const valid = eventFor(source, 0);
  const unknown = eventFor(source, 1, {
    card_id: '999999',
    event_id: 'event_unknown_card_0002',
    device_cursor: {device_id: 'device_installation_0001', sequence: 2},
  });
  const accepted = await submit(api, session, [valid]);
  assert.equal(accepted.statusCode, 200);

  const response = await submit(api, session, [valid, unknown]);
  assert.equal(response.statusCode, 422);
  assert.equal(store.snapshot().learningEvents.size, 1);
  assert.equal(
    [...store.snapshot().learningEventSequences.values()][0]
      .last_server_sequence,
    1,
  );
});

test('activity day is derived in China time and never accepted from the client', async () => {
  const store = createMemoryStore();
  const now = new Date('2026-05-01T00:30:00.000Z');
  const {api} = createTestApi({now: () => now, store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const beforeMidnight = eventFor(source, 0, {
    client_occurred_at: '2026-04-30T15:59:59.000Z',
    event_id: 'event_china_day_0001',
  });
  const afterMidnight = eventFor(source, 1, {
    client_occurred_at: '2026-04-30T16:00:00.000Z',
    event_id: 'event_china_day_0002',
    device_cursor: {device_id: 'device_installation_0001', sequence: 2},
  });
  const acceptedBeforeMidnight = await submit(api, session, [beforeMidnight]);
  const acceptedAfterMidnight = await submit(api, session, [afterMidnight]);
  assert.equal(acceptedBeforeMidnight.statusCode, 200);
  assert.equal(acceptedAfterMidnight.statusCode, 200);

  for (const [dayKey, expectedCount] of [
    ['2026-04-30', 1],
    ['2026-05-01', 1],
  ]) {
    const bootstrap = await request(api, {
      headers: {authorization: `Bearer ${session.access_token}`},
      method: 'GET',
      path: '/v2/bootstrap',
      query: {day_key: dayKey, track: 'cet4'},
    });
    assert.equal(
      bootstrap.body.data.progress.learning_completed_count,
      expectedCount,
    );
  }

  const injectedDay = await submit(api, session, [
    {
      ...beforeMidnight,
      event_id: 'event_injected_day_0003',
      day_key: '2026-05-01',
    },
  ]);
  assert.equal(injectedDay.statusCode, 400);
});

test('retained content supports offline replay and expired versions fail closed', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const oldSource = await cardSource(api, session);
  const retainedEvent = eventFor(oldSource, 0, {
    event_id: 'event_retained_0001',
  });
  await bindEventsToCurrentSelection(api, session, [retainedEvent]);
  const snapshot = store.snapshot();
  snapshot.cardSourceVersions.set(
    createCardSourceVersionId('cet4', oldSource.content_version),
    {
      ...clone(oldSource),
      release: null,
      retained_until: null,
      retention_status: 'retained',
    },
  );
  const nextSource = validateCardSourceForImport(
    {
      card_records: [...oldSource.card_records].reverse(),
      release: null,
      source: oldSource.source,
      track: 'cet4',
    },
    'cet4',
  );
  snapshot.cardSources.set('cet4', nextSource);

  const retained = await submit(api, session, [retainedEvent]);
  assert.equal(retained.statusCode, 200);

  snapshot.cardSourceVersions.get(
    createCardSourceVersionId('cet4', oldSource.content_version),
  ).retention_status = 'expired';
  const expiredEvent = eventFor(oldSource, 1, {
    event_id: 'event_expired_0002',
    device_cursor: {
      device_id: 'device_installation_0001',
      sequence: 2,
    },
  });
  const expired = await submit(api, session, [expiredEvent]);
  assert.equal(expired.statusCode, 422);
  assert.equal(expired.body.error.code, 'invalid_learning_event_content');

  const acceptedReplay = await submit(api, session, [retainedEvent]);
  assert.equal(acceptedReplay.statusCode, 200);
  assert.equal(acceptedReplay.body.data.results[0].status, 'duplicate');
});

test('content registry corruption and an elapsed retention deadline fail closed', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const snapshot = store.snapshot();
  snapshot.cardSources.get('cet4').retention_status = 'expired';

  const corruptCurrent = await submit(api, session, [eventFor(source)]);
  assert.equal(corruptCurrent.statusCode, 503);
  assert.equal(
    corruptCurrent.body.error.code,
    'learning_events_projection_invalid',
  );

  snapshot.cardSources.set(
    'cet4',
    validateCardSourceForImport(
      {
        card_records: [...source.card_records].reverse(),
        release: null,
        source: source.source,
        track: 'cet4',
      },
      'cet4',
    ),
  );
  snapshot.cardSourceVersions.set(
    createCardSourceVersionId('cet4', source.content_version),
    {
      ...clone(source),
      retained_until: null,
      retention_status: 'active',
    },
  );
  const incorrectlyActive = await submit(api, session, [eventFor(source)]);
  assert.equal(incorrectlyActive.statusCode, 503);
  assert.equal(
    incorrectlyActive.body.error.code,
    'learning_events_projection_invalid',
  );

  snapshot.cardSourceVersions.set(
    createCardSourceVersionId('cet4', source.content_version),
    {
      ...clone(source),
      retained_until: START_TIME.toISOString(),
      retention_status: 'retained',
    },
  );
  const elapsed = await submit(api, session, [eventFor(source)]);
  assert.equal(elapsed.statusCode, 422);
  assert.equal(elapsed.body.error.code, 'invalid_learning_event_content');
  assert.equal(snapshot.learningEvents.size, 0);
});

test('production validation rejects content without a published release', async () => {
  const developmentStore = createMemoryStore();
  const {api} = createTestApi({store: developmentStore});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const service = createLearningEventsV2Service({
    now: () => START_TIME,
    runtimeMode: 'production',
    store: {
      commitLearningEvents: async input => {
        await input.validateNewEvents(
          input.events.map(event => ({...event, track: input.track})),
          async () => ({
            cardSource: {
              ...source,
              release: null,
              track: 'cet4',
            },
            isCurrent: true,
            retainedUntil: null,
            retentionStatus: 'active',
          }),
        );
        return [];
      },
    },
  });

  await assert.rejects(
    () =>
      service.submit({
        request: {
          body: {
            schema_version: 'learning-events.v2',
            track: 'cet4',
            events: [eventFor(source)],
          },
          query: {},
        },
        session: {
          accountKey: 'account_key_for_production_test',
          phoneNumber: PHONE_ONE,
          sessionId: 'session_production_test',
        },
      }),
    error =>
      error.statusCode === 422 &&
      error.code === 'invalid_learning_event_content',
  );
});

test('event and cursor identities are isolated by account', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const firstSession = await authenticatedSession(api, PHONE_ONE, '127.0.0.20');
  const secondSession = await authenticatedSession(
    api,
    PHONE_TWO,
    '127.0.0.21',
  );
  const source = await cardSource(api, firstSession);
  const firstEvent = eventFor(source);
  const secondEvent = clone(firstEvent);

  const [first, second] = await Promise.all([
    submit(api, firstSession, [firstEvent]),
    submit(api, secondSession, [secondEvent]),
  ]);

  assert.equal(first.body.data.results[0].status, 'accepted');
  assert.equal(second.body.data.results[0].status, 'accepted');
  assert.equal(first.body.data.results[0].server_sequence, 1);
  assert.equal(second.body.data.results[0].server_sequence, 1);
  assert.equal(store.snapshot().learningEvents.size, 2);
  assert.equal(store.snapshot().learningEventCursors.size, 2);
});

test('CloudBase concurrent submissions converge without duplicate projection writes', async () => {
  const db = createFakeCloudBaseDb();
  const firstApi = createTestApi({store: createCloudBaseStore({db})}).api;
  const secondApi = createTestApi({store: createCloudBaseStore({db})}).api;
  const session = await authenticatedSession(firstApi, PHONE_ONE, '127.0.0.30');
  const source = await cardSource(firstApi, session);
  const event = eventFor(source);

  const duplicateRace = await Promise.all([
    submit(firstApi, session, [event]),
    submit(secondApi, session, [event]),
  ]);
  assert.deepEqual(
    duplicateRace.map(response => response.body.data.results[0].status).sort(),
    ['accepted', 'duplicate'],
  );
  assert.equal(db.snapshot().get('softbook_learning_events').size, 1);

  const second = eventFor(source, 1, {
    event_id: 'event_concurrent_0002',
    device_cursor: {device_id: 'device_installation_0001', sequence: 2},
  });
  const third = eventFor(source, 2, {
    event_id: 'event_concurrent_0003',
    device_cursor: {device_id: 'device_installation_0002', sequence: 1},
  });
  const distinctRace = await Promise.all([
    submit(firstApi, session, [second]),
    submit(secondApi, session, [third]),
  ]);
  assert.deepEqual(
    distinctRace
      .map(response => response.body.data.results[0].server_sequence)
      .sort((left, right) => left - right),
    [2, 3],
  );

  const bootstrap = await request(secondApi, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: DAY_KEY, track: 'cet4'},
  });
  assert.equal(bootstrap.body.data.progress.learning_completed_count, 3);
  assert.equal(bootstrap.body.data.learning.card_states.length, 3);
});

test('CloudBase transaction failure leaves no partial event, cursor, or projection', async () => {
  const db = createFakeCloudBaseDb();
  const {api} = createTestApi({store: createCloudBaseStore({db})});
  const session = await authenticatedSession(api, PHONE_ONE, '127.0.0.40');
  const source = await cardSource(api, session);
  const event = eventFor(source);
  const selected = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/learning/session',
    query: {track: 'cet4'},
  });
  assert.equal(selected.statusCode, 200);
  const selectedCursor = clone(
    [...db.snapshot().get('softbook_learning_sessions').values()][0].cursor,
  );
  db.failNextSetFor('softbook_learning_event_cursors');

  const failed = await submit(api, session, [event]);
  assert.equal(failed.statusCode, 503);
  assert.equal(failed.body.error.code, 'learning_events_unavailable');

  for (const collectionName of [
    'softbook_learning_events',
    'softbook_learning_event_cursors',
    'softbook_learning_event_sequences',
    'softbook_learning_migration_revisions',
    'softbook_learning_states',
    'softbook_daily_progress',
  ]) {
    assert.equal(db.snapshot().get(collectionName)?.size ?? 0, 0);
  }
  assert.deepEqual(
    [...db.snapshot().get('softbook_learning_sessions').values()][0].cursor,
    selectedCursor,
  );

  const retried = await submit(api, session, [event]);
  assert.equal(retried.statusCode, 200);
  assert.equal(retried.body.data.results[0].server_sequence, 1);
  assert.equal(
    [...db.snapshot().get('softbook_learning_sessions').values()][0].cursor,
    null,
  );
});

test('first v2 event migrates v1 learning and progress baselines without favorite authority', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const headers = {authorization: `Bearer ${session.access_token}`};
  const source = await cardSource(api, session);
  const legacyCard = source.card_records[0];
  const nextCard = source.card_records[1];

  const progress = await request(api, {
    body: {
      checked_in_today: true,
      day_key: DAY_KEY,
      favorite_count: 1,
      learning_completed_count: 1,
      pending_review_count: 0,
      phone_number: PHONE_ONE,
      review_completed_count: 0,
      sleeping_count: 0,
      total_completed_count: 1,
    },
    headers,
    method: 'POST',
    path: '/v1/progress/daily-sync',
  });
  assert.equal(progress.statusCode, 200);

  const legacyLearning = await request(api, {
    body: {
      day_key: DAY_KEY,
      events: [
        {
          card_id: legacyCard.card_id,
          completed_at: START_TIME.toISOString(),
          interaction_id: legacyCard.interaction_id,
          is_favorited: false,
          outcome:
            legacyCard.interaction_id === 'flip' ? 'confident' : 'correct',
          phase: 'learning',
          used_hint: false,
          used_peek: false,
        },
      ],
      phone_number: PHONE_ONE,
      source_id: source.source.id,
      source_label: source.source.label,
      track: 'cet4',
    },
    headers,
    method: 'POST',
    path: '/v1/learning/state-sync',
  });
  assert.equal(legacyLearning.statusCode, 200);

  const space = await request(api, {
    body: {
      day_key: DAY_KEY,
      phone_number: PHONE_ONE,
      states: [
        {
          card_id: legacyCard.card_id,
          is_favorited: true,
          is_sleeping: true,
          last_modified_at: START_TIME.toISOString(),
        },
      ],
    },
    headers,
    method: 'POST',
    path: '/v1/space/state-sync',
  });
  assert.equal(space.statusCode, 200);

  const next = eventFor(source, 1, {
    event_id: 'event_after_legacy_0002',
    card_id: nextCard.card_id,
    interaction_id: nextCard.interaction_id,
    outcome: nextCard.interaction_id === 'flip' ? 'review' : 'incorrect',
    answer_grade: 'review_needed',
    device_cursor: {device_id: 'device_installation_0001', sequence: 2},
  });
  const accepted = await submit(api, session, [next]);
  assert.equal(accepted.statusCode, 200);

  const bootstrap = await request(api, {
    headers,
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: DAY_KEY, track: 'cet4'},
  });
  assert.equal(bootstrap.statusCode, 200);
  assert.equal(bootstrap.body.data.progress.learning_completed_count, 2);
  assert.equal(bootstrap.body.data.progress.pending_review_count, 1);
  assert.equal(bootstrap.body.data.progress.total_completed_count, 2);
  assert.equal(bootstrap.body.data.learning.card_states.length, 2);
  assert.equal(
    bootstrap.body.data.learning.card_states.find(
      card => card.card_id === legacyCard.card_id,
    ).is_favorited,
    true,
  );
  assert.equal(
    bootstrap.body.data.learning.card_states.find(
      card => card.card_id === nextCard.card_id,
    ).is_favorited,
    false,
  );
});

test('first v2 event preserves the legacy baseline for both tracks', async () => {
  const variants = [
    ['memory', createMemoryStore()],
    ['cloudbase', createCloudBaseStore({db: createFakeCloudBaseDb()})],
  ];

  for (const [name, store] of variants) {
    const {api} = createTestApi({store});
    const session = await authenticatedSession(
      api,
      PHONE_ONE,
      name === 'memory' ? '127.0.0.51' : '127.0.0.52',
    );
    const headers = {authorization: `Bearer ${session.access_token}`};
    const cet4Source = await cardSource(api, session, 'cet4');
    const cet6Source = await cardSource(api, session, 'cet6');

    for (const [track, source] of [
      ['cet4', cet4Source],
      ['cet6', cet6Source],
    ]) {
      const legacyCard = source.card_records[0];
      const legacyWrite = await request(api, {
        body: {
          day_key: DAY_KEY,
          events: [
            {
              card_id: legacyCard.card_id,
              completed_at: START_TIME.toISOString(),
              interaction_id: legacyCard.interaction_id,
              is_favorited: false,
              outcome:
                legacyCard.interaction_id === 'flip' ? 'confident' : 'correct',
              phase: 'learning',
              used_hint: false,
              used_peek: false,
            },
          ],
          phone_number: PHONE_ONE,
          source_id: source.source.id,
          source_label: source.source.label,
          track,
        },
        headers,
        method: 'POST',
        path: '/v1/learning/state-sync',
      });
      assert.equal(legacyWrite.statusCode, 200, name);
    }

    const scheduledCet6 = await request(api, {
      headers,
      method: 'GET',
      path: '/v2/learning/session',
      query: {track: 'cet6'},
    });
    assert.equal(scheduledCet6.statusCode, 200, name);

    const first = eventFor(cet4Source, 0, {
      device_cursor: {device_id: 'device_cross_track_0001', sequence: 1},
      event_id: 'event_cross_track_cet4_0001',
      phase: 'review',
    });
    const firstAccepted = await submit(api, session, [first], 'cet4');
    assert.equal(firstAccepted.statusCode, 200, name);

    const migratedCet6 = await request(api, {
      headers,
      method: 'GET',
      path: '/v2/bootstrap',
      query: {day_key: DAY_KEY, track: 'cet6'},
    });
    assert.equal(migratedCet6.statusCode, 200, name);
    assert.equal(migratedCet6.body.data.learning.card_states.length, 1, name);
    assert.equal(
      migratedCet6.body.data.learning.card_states[0].server_sequence,
      0,
      name,
    );
    const resumedCet6 = await request(api, {
      headers,
      method: 'GET',
      path: '/v2/learning/session',
      query: {track: 'cet6'},
    });
    assert.equal(resumedCet6.statusCode, 200, name);
    assert.equal(
      resumedCet6.body.data.selection.selection_id,
      scheduledCet6.body.data.selection.selection_id,
      name,
    );

    const second = eventFor(cet6Source, 0, {
      device_cursor: {device_id: 'device_cross_track_0001', sequence: 2},
      event_id: 'event_cross_track_cet6_0002',
      phase: 'review',
    });
    const secondAccepted = await submit(api, session, [second], 'cet6');
    assert.equal(secondAccepted.statusCode, 200, name);
    assert.equal(secondAccepted.body.data.results[0].server_sequence, 2, name);

    const reconciledCet6 = await request(api, {
      headers,
      method: 'GET',
      path: '/v2/bootstrap',
      query: {day_key: DAY_KEY, track: 'cet6'},
    });
    assert.equal(reconciledCet6.statusCode, 200, name);
    assert.equal(reconciledCet6.body.data.learning.card_states.length, 1, name);
    assert.equal(
      reconciledCet6.body.data.learning.card_states[0].server_sequence,
      2,
      name,
    );
  }
});

test('migrated accounts merge v1 check-in without accepting legacy learning authority', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const card = source.card_records[0];
  await submit(api, session, [eventFor(source)]);

  const space = await request(api, {
    body: {
      day_key: DAY_KEY,
      phone_number: PHONE_ONE,
      states: [
        {
          card_id: card.card_id,
          is_favorited: true,
          is_sleeping: true,
          last_modified_at: START_TIME.toISOString(),
        },
      ],
    },
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'POST',
    path: '/v1/space/state-sync',
  });
  assert.equal(space.statusCode, 200);

  const progress = await request(api, {
    body: {
      checked_in_today: true,
      day_key: DAY_KEY,
      favorite_count: 99,
      learning_completed_count: 99,
      pending_review_count: 99,
      phone_number: PHONE_ONE,
      review_completed_count: 99,
      sleeping_count: 99,
      total_completed_count: 198,
    },
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'POST',
    path: '/v1/progress/daily-sync',
  });
  assert.equal(progress.statusCode, 200);

  const staleProgress = await request(api, {
    body: {
      checked_in_today: false,
      day_key: DAY_KEY,
      favorite_count: 0,
      learning_completed_count: 0,
      pending_review_count: 0,
      phone_number: PHONE_ONE,
      review_completed_count: 0,
      sleeping_count: 0,
      total_completed_count: 0,
    },
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'POST',
    path: '/v1/progress/daily-sync',
  });
  assert.equal(staleProgress.statusCode, 200);

  await request(api, {
    body: {phone_number: PHONE_ONE},
    method: 'POST',
    path: '/v1/auth/request-code',
  });
  const legacyAuth = await request(api, {
    body: {phone_number: PHONE_ONE, sms_code: '2468'},
    method: 'POST',
    path: '/v1/auth/verify-code',
  });
  const learning = await request(api, {
    body: {
      day_key: DAY_KEY,
      events: [
        {
          card_id: card.card_id,
          completed_at: START_TIME.toISOString(),
          interaction_id: card.interaction_id,
          is_favorited: false,
          outcome: card.interaction_id === 'flip' ? 'review' : 'incorrect',
          phase: 'learning',
          used_hint: false,
          used_peek: false,
        },
      ],
      phone_number: PHONE_ONE,
      source_id: source.source.id,
      source_label: source.source.label,
      track: 'cet4',
    },
    headers: {authorization: `Bearer ${legacyAuth.body.data.auth_token}`},
    method: 'POST',
    path: '/v1/learning/state-sync',
  });
  assert.equal(learning.statusCode, 409);
  assert.equal(learning.body.error.code, 'legacy_learning_write_disabled');

  const bootstrap = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: DAY_KEY, track: 'cet4'},
  });
  assert.equal(bootstrap.body.data.progress.total_completed_count, 1);
  assert.equal(bootstrap.body.data.progress.learning_completed_count, 1);
  assert.equal(bootstrap.body.data.progress.review_completed_count, 0);
  assert.equal(bootstrap.body.data.progress.pending_review_count, 0);
  assert.equal(bootstrap.body.data.progress.checked_in_today, true);
  assert.equal(bootstrap.body.data.progress.favorite_count, 1);
  assert.equal(bootstrap.body.data.progress.sleeping_count, 1);
  assert.equal(
    bootstrap.body.data.learning.card_states[0].event_id,
    'event_0001',
  );
});

test('CloudBase migrated daily merge preserves v2 learning counts transactionally', async () => {
  const db = createFakeCloudBaseDb();
  const {api} = createTestApi({store: createCloudBaseStore({db})});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  await submit(api, session, [eventFor(source)]);

  const response = await request(api, {
    body: {
      checked_in_today: true,
      day_key: DAY_KEY,
      favorite_count: 2,
      learning_completed_count: 99,
      pending_review_count: 99,
      phone_number: PHONE_ONE,
      review_completed_count: 99,
      sleeping_count: 2,
      total_completed_count: 198,
    },
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'POST',
    path: '/v1/progress/daily-sync',
  });

  assert.equal(response.statusCode, 200);
  const progressDocuments = [
    ...db.snapshot().get('softbook_daily_progress').values(),
  ];
  assert.equal(progressDocuments.length, 1);
  assert.equal(progressDocuments[0].projection_version, 'learning-events.v2');
  assert.equal(progressDocuments[0].checked_in_today, true);
  assert.equal(progressDocuments[0].learning_completed_count, 1);
  assert.equal(progressDocuments[0].review_completed_count, 0);
  assert.equal(progressDocuments[0].pending_review_count, 0);
  assert.equal(progressDocuments[0].favorite_count, 0);
  assert.equal(progressDocuments[0].sleeping_count, 0);
  assert.equal(progressDocuments[0].total_completed_count, 1);
});

test('CloudBase migration reads every legacy learning-state page', async () => {
  const db = createFakeCloudBaseDb();
  const store = createCloudBaseStore({db});
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const legacyCard = source.card_records[0];
  const nextCard = source.card_records[1];
  const legacyStates = db.collection('softbook_learning_states');

  for (let index = 0; index < 105; index += 1) {
    const isLatest = index === 104;
    await legacyStates.doc(`legacy-${String(index).padStart(3, '0')}`).set({
      acknowledged_at: new Date(START_TIME.getTime() + index).toISOString(),
      day_key: DAY_KEY,
      events_by_card_id: {
        [legacyCard.card_id]: {
          card_id: legacyCard.card_id,
          completed_at: new Date(START_TIME.getTime() + index).toISOString(),
          interaction_id: legacyCard.interaction_id,
          is_favorited: false,
          outcome:
            legacyCard.interaction_id === 'flip'
              ? isLatest
                ? 'review'
                : 'confident'
              : isLatest
              ? 'incorrect'
              : 'correct',
          phase: 'learning',
          used_hint: false,
          used_peek: false,
        },
      },
      phone_number: PHONE_ONE,
      source_id: source.source.id,
      source_label: source.source.label,
      track: 'cet4',
    });
  }

  const sleeping = await request(api, {
    body: {
      day_key: DAY_KEY,
      phone_number: PHONE_ONE,
      states: [
        {
          card_id: legacyCard.card_id,
          is_favorited: false,
          is_sleeping: true,
          last_modified_at: START_TIME.toISOString(),
        },
      ],
    },
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'POST',
    path: '/v1/space/state-sync',
  });
  assert.equal(sleeping.statusCode, 200);

  const next = eventFor(source, 1, {
    event_id: 'event_after_paged_legacy_0001',
    card_id: nextCard.card_id,
    interaction_id: nextCard.interaction_id,
    outcome: nextCard.interaction_id === 'flip' ? 'confident' : 'correct',
  });
  const accepted = await submit(api, session, [next]);
  assert.equal(accepted.statusCode, 200);

  const bootstrap = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: DAY_KEY, track: 'cet4'},
  });
  const migrated = bootstrap.body.data.learning.card_states.find(
    state => state.card_id === legacyCard.card_id,
  );
  assert.equal(
    migrated.outcome,
    legacyCard.interaction_id === 'flip' ? 'review' : 'incorrect',
  );
  assert.equal(bootstrap.body.data.progress.pending_review_count, 1);
});

test('CloudBase migration retries when a v1 revision changes after its preflight snapshot', async () => {
  const db = createFakeCloudBaseDb();
  const store = createCloudBaseStore({db});
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const accountKey = [
    ...db.snapshot().get('softbook_auth_sessions').values(),
  ][0].account_key;
  const revisionId = createLearningMigrationRevisionId(accountKey);

  db.beforeTransaction(async () => {
    await db
      .collection('softbook_learning_migration_revisions')
      .doc(revisionId)
      .set({
        account_key: accountKey,
        revision: 1,
        status: 'open',
        updated_at: START_TIME.toISOString(),
      });
  }, 1);

  const accepted = await submit(api, session, [eventFor(source)]);
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.body.data.results[0].server_sequence, 1);
  assert.deepEqual(
    db.snapshot().get('softbook_learning_migration_revisions').get(revisionId),
    {
      account_key: accountKey,
      revision: 1,
      status: 'migrated',
      updated_at: START_TIME.toISOString(),
    },
  );
});

test('corrupted account sequence fails closed without accepting another event', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  await submit(api, session, [eventFor(source, 0)]);
  const sequence = [...store.snapshot().learningEventSequences.values()][0];
  sequence.last_server_sequence = Number.MAX_SAFE_INTEGER;
  const next = eventFor(source, 1, {
    event_id: 'event_sequence_overflow_0002',
    device_cursor: {device_id: 'device_installation_0001', sequence: 2},
  });

  const response = await submit(api, session, [next]);
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error.code, 'learning_events_projection_invalid');
  assert.equal(store.snapshot().learningEvents.size, 1);

  sequence.last_server_sequence = 1;
  sequence.pending_review_count = 'corrupt';
  const bootstrap = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: DAY_KEY, track: 'cet4'},
  });
  assert.equal(bootstrap.statusCode, 500);
  assert.equal(bootstrap.body.error.code, 'learning_events_projection_invalid');
});

test('corrupted v2 learning and daily projections fail closed on read and append', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const first = eventFor(source, 0);
  await submit(api, session, [first]);
  const projection = [...store.snapshot().learningStates.values()].find(
    state => state.projection_version === 'learning-events.v2',
  );
  const projectedEvent = Object.values(projection.events_by_card_id)[0];
  const second = eventFor(source, 1, {
    event_id: 'event_after_corrupt_projection_0002',
    device_cursor: {device_id: 'device_installation_0001', sequence: 2},
  });
  await bindEventsToCurrentSelection(api, session, [second]);
  projectedEvent.server_sequence = 2;

  const corruptSequenceRead = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: DAY_KEY, track: 'cet4'},
  });
  assert.equal(corruptSequenceRead.statusCode, 500);
  assert.equal(
    corruptSequenceRead.body.error.code,
    'learning_events_projection_invalid',
  );

  const corruptSequenceAppend = await submit(api, session, [second]);
  assert.equal(corruptSequenceAppend.statusCode, 503);
  assert.equal(
    corruptSequenceAppend.body.error.code,
    'learning_events_projection_invalid',
  );
  assert.equal(store.snapshot().learningEvents.size, 1);

  projectedEvent.server_sequence = 1;
  delete projectedEvent.event_id;
  const missingAuthorityRead = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: DAY_KEY, track: 'cet4'},
  });
  assert.equal(missingAuthorityRead.statusCode, 500);
  assert.equal(
    missingAuthorityRead.body.error.code,
    'learning_events_projection_invalid',
  );

  projectedEvent.event_id = first.event_id;
  const progress = [...store.snapshot().dailyProgress.values()].find(
    value => value.projection_version === 'learning-events.v2',
  );
  progress.acknowledged_at = 'not-an-instant';
  const corruptProgressAppend = await submit(api, session, [second]);
  assert.equal(corruptProgressAppend.statusCode, 503);
  assert.equal(
    corruptProgressAppend.body.error.code,
    'learning_events_projection_invalid',
  );
  assert.equal(store.snapshot().learningEvents.size, 1);
});

test('corrupted legacy learning state cannot become a v2 migration baseline', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const card = source.card_records[0];
  const headers = {authorization: `Bearer ${session.access_token}`};
  const legacyWrite = await request(api, {
    body: {
      day_key: DAY_KEY,
      events: [
        {
          card_id: card.card_id,
          completed_at: START_TIME.toISOString(),
          interaction_id: card.interaction_id,
          is_favorited: false,
          outcome: card.interaction_id === 'flip' ? 'confident' : 'correct',
          phase: 'learning',
          used_hint: false,
          used_peek: false,
        },
      ],
      phone_number: PHONE_ONE,
      source_id: source.source.id,
      source_label: source.source.label,
      track: 'cet4',
    },
    headers,
    method: 'POST',
    path: '/v1/learning/state-sync',
  });
  assert.equal(legacyWrite.statusCode, 200);
  const legacyState = [...store.snapshot().learningStates.values()][0];
  Object.values(legacyState.events_by_card_id)[0].used_hint = 'false';

  const response = await submit(api, session, [
    eventFor(source, 1, {
      event_id: 'event_after_corrupt_legacy_0002',
      device_cursor: {device_id: 'device_installation_0001', sequence: 2},
    }),
  ]);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error.code, 'learning_events_projection_invalid');
  assert.equal(store.snapshot().learningEvents.size, 0);
  assert.equal(store.snapshot().learningEventSequences.size, 0);
});

test('an accepted event without its account sequence fails closed on replay and append', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const first = eventFor(source, 0);
  await submit(api, session, [first]);
  const next = eventFor(source, 1, {
    event_id: 'event_after_missing_sequence_0002',
    device_cursor: {device_id: 'device_installation_0001', sequence: 2},
  });
  await bindEventsToCurrentSelection(api, session, [next]);
  store.snapshot().learningEventSequences.clear();

  const replay = await submit(api, session, [first]);
  assert.equal(replay.statusCode, 503);
  assert.equal(replay.body.error.code, 'learning_events_projection_invalid');

  const bootstrap = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: DAY_KEY, track: 'cet4'},
  });
  assert.equal(bootstrap.statusCode, 500);
  assert.equal(bootstrap.body.error.code, 'learning_events_projection_invalid');

  const append = await submit(api, session, [first, next]);
  assert.equal(append.statusCode, 503);
  assert.equal(append.body.error.code, 'learning_events_projection_invalid');
  assert.equal(store.snapshot().learningEvents.size, 1);
});

test('an immutable event payload that no longer matches its digest fails closed', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const event = eventFor(source);
  const accepted = await submit(api, session, [event]);
  assert.equal(accepted.statusCode, 200);

  const storedEvent = [...store.snapshot().learningEvents.values()][0];
  storedEvent.payload.outcome =
    storedEvent.payload.outcome === 'confident' ? 'review' : 'incorrect';

  const replay = await submit(api, session, [event]);
  assert.equal(replay.statusCode, 503);
  assert.equal(replay.body.error.code, 'learning_events_projection_invalid');
});

function createFakeCloudBaseDb() {
  const collections = new Map();
  let transactionTail = Promise.resolve();
  let failCollection = null;
  let lastTransactionOperations = 0;
  let transactionOperations = 0;
  let transactionHook = null;

  const recordTransactionOperation = transactional => {
    if (!transactional) {
      return;
    }

    transactionOperations += 1;

    if (transactionOperations > 100) {
      throw new Error('CloudBase transaction exceeded 100 operations.');
    }
  };

  const collectionFor = (root, name, transactional) => {
    return {
      doc: documentId => ({
        get: async () => {
          recordTransactionOperation(transactional);
          const documents = getCollection(root, name);
          const document = documents.has(documentId)
            ? {_id: documentId, ...clone(documents.get(documentId))}
            : null;
          return {
            data: transactional ? document : document ? [document] : [],
          };
        },
        set: async data => {
          recordTransactionOperation(transactional);
          if (transactional && failCollection === name) {
            failCollection = null;
            throw new Error(`Injected transaction write failure for ${name}`);
          }
          const documents = getCollection(root, name);
          documents.set(documentId, clone(data));
          return {id: documentId};
        },
      }),
      where: query => {
        if (transactional) {
          throw new Error('CloudBase transactions do not support where().');
        }

        const options = {
          direction: null,
          field: null,
          limit: 100,
          offset: 0,
        };
        const builder = {
          get: async () => {
            const documents = getCollection(root, name);
            let entries = [...documents.entries()].filter(([, document]) =>
              Object.entries(query).every(
                ([key, value]) => document[key] === value,
              ),
            );

            if (options.field !== null) {
              entries.sort(([leftId], [rightId]) =>
                options.direction === 'desc'
                  ? rightId.localeCompare(leftId)
                  : leftId.localeCompare(rightId),
              );
            }

            return {
              data: entries
                .slice(options.offset, options.offset + options.limit)
                .map(([documentId, document]) => ({
                  _id: documentId,
                  ...clone(document),
                })),
            };
          },
          limit: value => {
            options.limit = value;
            return builder;
          },
          orderBy: (field, direction) => {
            options.field = field;
            options.direction = direction;
            return builder;
          },
          skip: value => {
            options.offset = value;
            return builder;
          },
        };
        return builder;
      },
    };
  };

  return {
    beforeTransaction(callback, skip = 0) {
      transactionHook = {callback, remaining: skip};
    },
    collection: name => collectionFor(collections, name, false),
    failNextSetFor(name) {
      failCollection = name;
    },
    lastTransactionOperations: () => lastTransactionOperations,
    runTransaction: callback => {
      const run = transactionTail.then(async () => {
        if (transactionHook) {
          if (transactionHook.remaining === 0) {
            const {callback: runHook} = transactionHook;
            transactionHook = null;
            await runHook();
          } else {
            transactionHook.remaining -= 1;
          }
        }
        const staged = cloneCollections(collections);
        transactionOperations = 0;

        try {
          const result = await callback({
            collection: name => collectionFor(staged, name, true),
          });
          replaceCollections(collections, staged);
          return result;
        } finally {
          lastTransactionOperations = transactionOperations;
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
  };
}

function getCollection(root, name) {
  if (!root.has(name)) {
    root.set(name, new Map());
  }
  return root.get(name);
}

function cloneCollections(source) {
  return new Map(
    [...source.entries()].map(([name, documents]) => [
      name,
      new Map(
        [...documents.entries()].map(([id, value]) => [id, clone(value)]),
      ),
    ]),
  );
}

function replaceCollections(target, source) {
  target.clear();
  for (const [name, documents] of source) {
    target.set(name, documents);
  }
}
