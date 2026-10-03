const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createMemoryStore,
  createSoftbookApi,
  validateCardSourceForImport,
} = require('./fixtures/api');
const {
  SCHEDULER_ALGORITHM,
  SCHEDULER_LIBRARY,
  SCHEDULER_LIBRARY_VERSION,
  SCHEDULER_POLICY_VERSION,
  advanceSchedulerEntry,
  ratingForEvent,
} = require('../learning-scheduler-v1');
const {Rating} = require('ts-fsrs');

const START_TIME = new Date('2026-04-30T12:00:00.000Z');
const DAY_KEY = '2026-04-30';
const PHONE = '13800138000';
const CURRENT_SELECTION_ID = 'sel_current_selection_pending';

function createClock() {
  let value = new Date(START_TIME);

  return {
    advanceMinutes(minutes) {
      value = new Date(value.getTime() + minutes * 60 * 1000);
    },
    now: () => new Date(value),
  };
}

function createDeferred() {
  let resolve;
  const promise = new Promise(resolvePromise => {
    resolve = resolvePromise;
  });

  return {promise, resolve};
}

function createTestApi(options = {}) {
  const clock = options.clock ?? createClock();
  let selectionCounter = 0;

  return {
    api: createSoftbookApi({
      authV2AcknowledgementSleeper: async () => undefined,
      authV2IndexSecret: 'softbook-cloudbase-dev-secret',
      learningSchedulerRandomBytes: size => {
        selectionCounter += 1;
        return Buffer.alloc(size, selectionCounter);
      },
      now: clock.now,
      runtimeMode: 'development',
      smsCode: '2468',
      tokenSecret: 'learning-scheduler-test-secret',
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
  clientIp = '127.0.0.1',
  phoneNumber = PHONE,
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

async function submitSpaceActions(
  api,
  session,
  source,
  actions,
  track = 'cet4',
) {
  const response = await request(api, {
    body: {
      actions,
      content_version: source.content_version,
      schema_version: 'space-actions.v2',
      track,
    },
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'POST',
    path: '/v2/space/actions',
  });
  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  return response.body.data;
}

async function learningSession(api, session, extra = {}) {
  return request(api, {
    body: extra.body,
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/learning/session',
    query: {track: 'cet4', ...(extra.query ?? {})},
  });
}

async function requestReview(api, session, extra = {}) {
  return request(api, {
    headers: session ? {authorization: `Bearer ${session.access_token}`} : {},
    method: 'POST', path: '/v2/learning/review',
    body: {track: 'cet4', ...(extra.body ?? {})}, query: extra.query ?? {},
  });
}

test('explicit review authenticates and rejects selection authority from the client', async () => {
  const {api} = createTestApi();
  assert.equal((await requestReview(api, null)).statusCode, 401);
  const session = await authenticatedSession(api);
  const notStarted = await requestReview(api, session);
  assert.equal(notStarted.statusCode, 409);
  assert.equal(notStarted.body.error.code, 'review_access_unavailable');
  for (const body of [{card_id: '000001'}, {phone_number: PHONE}, {day_key: DAY_KEY}, {track: 'other'}]) {
    assert.equal((await requestReview(api, session, {body})).statusCode, 400);
  }
  assert.equal((await requestReview(api, session, {query: {track: 'cet4'}})).statusCode, 400);
  const current = await learningSession(api, session);
  const empty = await requestReview(api, session);
  assert.equal(empty.statusCode, 200, JSON.stringify(empty.body));
  assert.equal(empty.body.data.selection, null);
  const retained = await learningSession(api, session);
  assert.equal(retained.body.data.selection.selection_id, current.body.data.selection.selection_id);
});

test('explicit review replaces an unseen cursor with an uncertain card and completes exactly once', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const uncertain = eventFor(source, 0, {outcome: 'review', answer_grade: 'review_needed'});
  assert.equal((await submit(api, session, source, [uncertain])).statusCode, 200);
  const nextNew = await learningSession(api, session);
  assert.equal(nextNew.body.data.selection.card_id, source.card_records[1].card_id);
  const manual = await requestReview(api, session);
  assert.equal(manual.statusCode, 200, JSON.stringify(manual.body));
  assert.equal(manual.body.data.selection.card_id, uncertain.card_id);
  assert.equal(manual.body.data.selection.phase, 'review');
  assert.equal(manual.body.data.selection.reason, 'requested_review');
  assert.ok(Date.parse(manual.body.data.selection.due_at) > START_TIME.getTime());
  assert.notEqual(manual.body.data.selection.selection_id, nextNew.body.data.selection.selection_id);
  const resumed = await requestReview(api, session);
  assert.equal(resumed.body.data.selection.selection_id, manual.body.data.selection.selection_id);
  const completion = eventFor(source, 0, {
    event_id: 'manual_review_event_0002', phase: 'review',
    selection_id: manual.body.data.selection.selection_id,
    device_cursor: {device_id: 'scheduler_device_0001', sequence: 2},
  });
  assert.equal((await submit(api, session, source, [completion])).statusCode, 200);
  const duplicate = await submit(api, session, source, [completion]);
  assert.equal(duplicate.body.data.results[0].status, 'duplicate');
  const projection = [...store.snapshot().learningStates.values()].find(value => value.projection_version === 'learning-events.v2');
  assert.equal(projection.scheduler_by_card_id[uncertain.card_id].card.reps, 2);
  assert.equal((await requestReview(api, session)).body.data.selection, null);
  assert.equal((await learningSession(api, session)).body.data.selection.card_id, source.card_records[1].card_id);
});

test('explicit review respects sleep, track isolation and current membership', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  assert.equal((await submit(api, session, source, [eventFor(source, 0, {
    outcome: 'review', answer_grade: 'review_needed',
  })])).statusCode, 200);
  const sibling = await requestReview(api, session, {body: {track: 'cet6'}});
  assert.equal(sibling.statusCode, 200, JSON.stringify(sibling.body));
  assert.equal(sibling.body.data.selection, null);
  await submitSpaceActions(api, session, source, [{action_id: 'manual_review_sleep_001',
    card_id: source.card_records[0].card_id, client_occurred_at: START_TIME.toISOString(),
    dimension: 'sleep', value: true}]);
  assert.equal((await requestReview(api, session)).body.data.selection, null);
  const membership = await store.getMembership(PHONE);
  const {acknowledged_at: ignored, ...entitlement} = membership;
  store.snapshot().memberships.set(PHONE, {entitlement: {...entitlement, stage: 'free'}, updated_at: START_TIME.toISOString()});
  const denied = await requestReview(api, session);
  assert.equal(denied.statusCode, 409);
  assert.equal(denied.body.error.code, 'review_access_unavailable');
});

test('learning session serializes transaction-backed canonical reads', async () => {
  const baseStore = createMemoryStore();
  const store = {...baseStore};
  const observed = [];
  let activeReads = 0;
  let maximumActiveReads = 0;

  for (const method of [
    'getLearningState',
    'getMembership',
    'getSpaceState',
    'getLearningSessionCursor',
  ]) {
    store[method] = async (...args) => {
      activeReads += 1;
      maximumActiveReads = Math.max(maximumActiveReads, activeReads);
      observed.push(method);
      await Promise.resolve();
      try {
        return await baseStore[method](...args);
      } finally {
        activeReads -= 1;
      }
    };
  }
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);

  const response = await learningSession(api, session);
  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(maximumActiveReads, 1);
  assert.deepEqual(observed.slice(0, 4), [
    'getLearningState',
    'getMembership',
    'getSpaceState',
    'getLearningSessionCursor',
  ]);
});

async function submit(api, session, source, events) {
  if (events.some(event => event.selection_id === CURRENT_SELECTION_ID)) {
    const selected = await learningSession(api, session);
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
  }

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

function eventFor(source, index, overrides = {}) {
  const card = source.card_records[index];
  const outcome = card.interaction_id === 'flip' ? 'confident' : 'correct';

  return {
    event_id: `scheduler_event_${String(index + 1).padStart(4, '0')}`,
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
      device_id: 'scheduler_device_0001',
      sequence: index + 1,
    },
    ...overrides,
  };
}

for (const track of ['cet4', 'cet6']) {
  test(`${track} new cards alternate knowledge points while retaining authored order within each point`, async () => {
    const fixtures = require('./fixtures/interaction-cards')[track];
    const subjects = [fixtures[0], fixtures[1]];
    const records = subjects.flatMap(subject => Array.from({length: 3}, (_, index) => ({
      ...structuredClone(subject),
      card_id: `${subject.knowledge_ref}${String(index + 1).padStart(2, '0')}`,
    })));
    const developmentCardSource = requestedTrack => validateCardSourceForImport({
      source: {id: 'subject-block-fixture', label: '调度行为夹具'},
      track: requestedTrack,
      card_records: requestedTrack === track ? records : require('./fixtures/interaction-cards')[requestedTrack],
      release: null,
    }, requestedTrack);
    const store = createMemoryStore({developmentCardSource});
    const {api} = createTestApi({store, developmentCardSource});
    const session = await authenticatedSession(api);
    const before = await store.getCardSource(track);
    const expected = [records[0], records[3], records[1], records[4], records[2], records[5]];
    for (let index = 0; index < expected.length; index += 1) {
      const selected = await learningSession(api, session, {query: {track}});
      assert.equal(selected.statusCode, 200, JSON.stringify(selected.body));
      assert.equal(selected.body.data.selection.card_id, expected[index].card_id);
      const source = await cardSource(api, session, track);
      const recordIndex = source.card_records.findIndex(card => card.card_id === expected[index].card_id);
      assert.notEqual(recordIndex, -1, 'selection must be present in the authenticated canonical source');
      const event = eventFor(source, recordIndex, {
        event_id: `subject_block_${track}_${index + 1}`,
        selection_id: selected.body.data.selection.selection_id,
        device_cursor: {device_id: `subject_block_${track}`, sequence: index + 1},
      });
      const accepted = await request(api, {
        body: {schema_version: 'learning-events.v2', track, events: [event]},
        headers: {authorization: `Bearer ${session.access_token}`},
        method: 'POST', path: '/v2/learning/events',
      });
      assert.equal(accepted.statusCode, 200, JSON.stringify(accepted.body));
    }
    const empty = await learningSession(api, session, {query: {track}});
    assert.equal(empty.body.data.selection, null);
    assert.deepEqual(await store.getCardSource(track), before, 'ordering must not mutate source records or content version');
  });
}

for (const track of ['cet4', 'cet6']) {
  function pointFixture(pointCardCount = 2) {
    const library = require('../card-content/index.js')[track];
    const cards = library.cards;
    const first = cards[0];
    const second = cards.find(card => card.space_metadata.library === first.space_metadata.library &&
      card.space_metadata.box_ref !== first.space_metadata.box_ref);
    const records = [first, second].flatMap(point => cards.filter(card =>
      card.space_metadata.box_ref === point.space_metadata.box_ref).slice(0, pointCardCount));
    const developmentCardSource = requestedTrack => validateCardSourceForImport({
      source: {id: 'knowledge-order-fixture', label: '调度行为夹具'},
      track: requestedTrack,
      card_records: requestedTrack === track ? records : require('./fixtures/interaction-cards')[requestedTrack],
      assets: requestedTrack === track ? library.assets.filter(asset => records.some(card => card.audio?.asset_id === asset.asset_id))
        .map(({asset_path, ...asset}) => ({...asset, storage_file_id: `cloud://point-fixture.local/${asset.asset_id}.mp3`})) : [],
      release: null,
    }, requestedTrack);
    const store = createMemoryStore({developmentCardSource});
    const {api, clock} = createTestApi({store, developmentCardSource});
    return {api, clock, records, store};
  }
  function fullLibraryFixture() {
    const libraries = require('../card-content/index.js');
    const developmentCardSource = requestedTrack => validateCardSourceForImport({
      source: {id: 'full-knowledge-order-fixture', label: '完整卡库调度行为夹具'}, track: requestedTrack,
      card_records: libraries[requestedTrack].cards,
      assets: libraries[requestedTrack].assets.map(({asset_path, ...asset}) =>
        ({...asset, storage_file_id: `cloud://point-fixture.local/${asset.asset_id}.mp3`})), release: null,
    }, requestedTrack);
    const store = createMemoryStore({developmentCardSource});
    return {libraries, store, ...createTestApi({store, developmentCardSource})};
  }
  async function confirmPointSelection(api, session, selected, sequence, clock, requestedTrack = track) {
    const source = await cardSource(api, session, requestedTrack);
    const index = source.card_records.findIndex(card => card.card_id === selected.card_id);
    const accepted = await request(api, {
      headers: {authorization: `Bearer ${session.access_token}`},
      method: 'POST', path: '/v2/learning/events',
      body: {schema_version: 'learning-events.v2', track: requestedTrack, events: [eventFor(source, index, {
      event_id: `point_order_${requestedTrack}_${sequence}`,
      selection_id: selected.selection_id,
      phase: selected.phase,
      client_occurred_at: clock.now().toISOString(),
      device_cursor: {device_id: `point_order_${requestedTrack}`, sequence},
      })]},
    });
    assert.equal(accepted.statusCode, 200, JSON.stringify(accepted.body));
    assert.equal(accepted.body.data.results[0].status, 'accepted', JSON.stringify(accepted.body));
  }

  test(`${track} a five-card course group spreads across five available knowledge points`, async () => {
    const {api, clock, libraries} = fullLibraryFixture();
    const library = libraries[track];
    const session = await authenticatedSession(api);
    const selectedPoints = [];
    const confirmed = new Set();
    for (let sequence = 1; sequence <= 5; sequence++) {
      const response = await learningSession(api, session, {query: {track}});
      assert.equal(response.statusCode, 200, JSON.stringify(response.body));
      const selected = response.body.data.selection;
      const card = library.cards.find(value => value.card_id === selected.card_id);
      selectedPoints.push(card.space_metadata.box_ref);
      const authoredNext = library.cards.find(value => value.space_metadata.box_ref === card.space_metadata.box_ref && !confirmed.has(value.card_id));
      assert.equal(card.card_id, authoredNext.card_id, 'knowledge variety must preserve authored order inside each box');
      await confirmPointSelection(api, session, selected, sequence, clock);
      confirmed.add(card.card_id);
    }
    assert.equal(new Set(selectedPoints).size, 5, `Available course points must not reduce to an A/B loop: ${selectedPoints.join(',')}`);
  });

  test(`${track} knowledge-point context survives confirmations on the other course`, async () => {
    const {api, clock, libraries} = fullLibraryFixture();
    const session = await authenticatedSession(api);
    const points = [];
    let sequence = 0;
    const selectAndConfirm = async requestedTrack => {
      const response = await learningSession(api, session, {query: {track: requestedTrack}});
      assert.equal(response.statusCode, 200, JSON.stringify(response.body));
      const selected = response.body.data.selection;
      const card = libraries[requestedTrack].cards.find(value => value.card_id === selected.card_id);
      await confirmPointSelection(api, session, selected, ++sequence, clock, requestedTrack);
      return card.space_metadata.box_ref;
    };
    points.push(await selectAndConfirm(track), await selectAndConfirm(track));
    const otherTrack = track === 'cet4' ? 'cet6' : 'cet4';
    for (let index = 0; index < 5; index++) await selectAndConfirm(otherTrack);
    points.push(await selectAndConfirm(track), await selectAndConfirm(track));
    assert.equal(new Set(points).size, 4, 'Account-wide sequence gaps must not erase current-course knowledge points');
  });

  test(`${track} four concentrated review points get one new spacing point before returning to due work`, async () => {
    const {api, clock, libraries, store} = fullLibraryFixture();
    const session = await authenticatedSession(api);
    const source = await cardSource(api, session, track);
    const refs = [...new Set(libraries[track].cards.map(card => card.space_metadata.box_ref))].slice(0, 4);
    const legacyCards = refs.flatMap(ref => libraries[track].cards.filter(card => card.space_metadata.box_ref === ref).slice(0, 2));
    await store.seedLegacyLearningStateForMigrationTest(PHONE, {
      day_key: DAY_KEY, source_id: source.source.id, source_label: source.source.label, track,
      events: legacyCards.map(card => ({card_id: card.card_id, completed_at: START_TIME.toISOString(),
        interaction_id: card.interaction_id, is_favorited: false, outcome: 'confident',
        phase: 'learning', used_hint: false, used_peek: false})),
    }, START_TIME.toISOString());
    const confirmedPoints = [];
    for (let sequence = 1; sequence <= 5; sequence++) {
      const response = await learningSession(api, session, {query: {track}});
      assert.equal(response.statusCode, 200, JSON.stringify(response.body));
      const selected = response.body.data.selection;
      const card = libraries[track].cards.find(value => value.card_id === selected.card_id);
      confirmedPoints.push(card.space_metadata.box_ref);
      assert.equal(selected.phase, sequence === 5 ? 'learning' : 'review');
      await confirmPointSelection(api, session, selected, sequence, clock);
    }
    assert.equal(new Set(confirmedPoints).size, 5, 'A full recent review window must not immediately cycle back to its first point');
    const due = await learningSession(api, session, {query: {track}});
    assert.equal(due.body.data.selection.phase, 'review', 'One new spacing task must return to due work');
    assert.equal(due.body.data.selection.card_id, legacyCards[1].card_id);
  });

  test(`${track} consecutive new cards use different knowledge points even within one subject`, async () => {
    const {api, clock, records, store} = pointFixture();
    const session = await authenticatedSession(api);
    const before = await store.getCardSource(track);
    for (const [sequence, card] of [records[0], records[2], records[1], records[3]].entries()) {
      const response = await learningSession(api, session, {query: {track}});
      assert.equal(response.statusCode, 200, JSON.stringify(response.body));
      assert.equal(response.body.data.selection.card_id, card.card_id);
      await confirmPointSelection(api, session, response.body.data.selection, sequence + 1, clock);
    }
    assert.deepEqual(await store.getCardSource(track), before, 'presentation order must preserve the exported source');
  });

  test(`${track} five selections keep separating knowledge points after long reading pauses`, async () => {
    const {api, clock, records, store} = pointFixture(6);
    let session = await authenticatedSession(api);
    const before = await store.getCardSource(track);
    let previousPoint = null;
    for (let sequence = 1; sequence <= 5; sequence++) {
      if (sequence === 3) {
        const refreshed = await request(api, {
          body: {refresh_token: session.refresh_token}, method: 'POST', path: '/v2/auth/refresh',
        });
        assert.equal(refreshed.statusCode, 200, JSON.stringify(refreshed.body));
        session = refreshed.body.data;
      }
      const response = await learningSession(api, session, {query: {track}});
      assert.equal(response.statusCode, 200, JSON.stringify(response.body));
      const selected = response.body.data.selection;
      const point = records.find(card => card.card_id === selected.card_id).space_metadata.box_ref;
      assert.notEqual(point, previousPoint, 'reading for over five minutes must not erase the previous confirmed knowledge point');
      await confirmPointSelection(api, session, selected, sequence, clock);
      previousPoint = point;
      clock.advanceMinutes(6);
    }
    assert.deepEqual(await store.getCardSource(track), before, 'spacing must not change content or accessible catalog order');
  });

  test(`${track} due reviews separate recently repeated knowledge points without changing FSRS due times`, async () => {
    const {api, clock, records, store} = pointFixture();
    const session = await authenticatedSession(api);
    for (let sequence = 1; sequence <= records.length; sequence++) {
      const response = await learningSession(api, session, {query: {track}});
      await confirmPointSelection(api, session, response.body.data.selection, sequence, clock);
    }
    clock.advanceMinutes(11);
    const first = await learningSession(api, session, {query: {track}});
    assert.equal(first.body.data.selection.card_id, records[0].card_id);
    await confirmPointSelection(api, session, first.body.data.selection, 5, clock);
    const next = await learningSession(api, session, {query: {track}});
    assert.equal(next.body.data.selection.phase, 'review');
    assert.equal(next.body.data.selection.card_id, records[2].card_id);
    const projection = [...store.snapshot().learningStates.values()].find(value => value.track === track && value.projection_version === 'learning-events.v2');
    assert.equal(next.body.data.selection.due_at, projection.scheduler_by_card_id[records[2].card_id].card.due);
    const repeatedRead = await learningSession(api, session, {query: {track}});
    assert.deepEqual(repeatedRead.body.data.selection, {...next.body.data.selection, reason: 'persisted_cursor'});
  });

  test(`${track} inserts an available new knowledge point between reviews concentrated in one point`, async () => {
    const {api, clock, records} = pointFixture();
    const session = await authenticatedSession(api);
    const first = await learningSession(api, session, {query: {track}});
    const source = await cardSource(api, session, track);
    await submitSpaceActions(api, session, source, records.slice(2).map((card, index) => ({
      action_id: `point_sleep_${track}_${index}`,
      card_id: card.card_id, client_occurred_at: clock.now().toISOString(), dimension: 'sleep', value: true,
    })), track);
    await confirmPointSelection(api, session, first.body.data.selection, 1, clock);
    const second = await learningSession(api, session, {query: {track}});
    assert.equal(second.body.data.selection.card_id, records[1].card_id, 'same-point fallback remains operable when alternatives are asleep');
    await confirmPointSelection(api, session, second.body.data.selection, 2, clock);
    await submitSpaceActions(api, session, source, records.slice(2).map((card, index) => ({
      action_id: `point_wake_${track}_${index}`,
      card_id: card.card_id, client_occurred_at: clock.now().toISOString(), dimension: 'sleep', value: false,
    })), track);
    clock.advanceMinutes(11);
    const varied = await learningSession(api, session, {query: {track}});
    assert.equal(varied.body.data.selection.card_id, records[2].card_id);
    assert.equal(varied.body.data.selection.phase, 'learning');
    await confirmPointSelection(api, session, varied.body.data.selection, 3, clock);
    const review = await learningSession(api, session, {query: {track}});
    assert.equal(review.body.data.selection.card_id, records[0].card_id, 'oldest due work retains priority after one different knowledge point');
    assert.equal(review.body.data.selection.phase, 'review');
  });
}

test('learning session is authenticated, strict, starts trial, and persists one cursor', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api);
  const source = await cardSource(api, session);
  const canonicalSource = await store.getCardSource('cet4');
  assert.equal(
    source.card_records.length,
    Math.ceil(canonicalSource.card_records.length * 0.5),
  );
  assert.ok(source.card_records.length < canonicalSource.card_records.length);
  const missingAuth = await request(api, {
    method: 'GET',
    path: '/v2/learning/session',
    query: {track: 'cet4'},
  });
  const injectedIdentity = await learningSession(api, session, {
    query: {phone_number: PHONE},
  });
  const injectedBody = await learningSession(api, session, {body: {}});
  const invalidTrack = await learningSession(api, session, {
    query: {track: 'cet5'},
  });

  assert.equal(missingAuth.statusCode, 401);
  assert.equal(injectedIdentity.statusCode, 400);
  assert.equal(
    injectedIdentity.body.error.code,
    'learning_session_authority_input_forbidden',
  );
  assert.equal(injectedBody.statusCode, 400);
  assert.equal(invalidTrack.statusCode, 400);

  const first = await learningSession(api, session);
  assert.equal(first.statusCode, 200, JSON.stringify(first.body));
  assert.deepEqual(first.body.data.algorithm, {
    id: SCHEDULER_ALGORITHM,
    library: SCHEDULER_LIBRARY,
    library_version: SCHEDULER_LIBRARY_VERSION,
    policy_version: SCHEDULER_POLICY_VERSION,
  });
  assert.equal(first.body.data.schema_version, 'learning-session.v1');
  assert.equal(first.body.data.membership_stage, 'trial');
  assert.equal(first.body.data.trial_started_at, START_TIME.toISOString());
  assert.equal(
    first.body.data.trial_expires_at,
    '2026-05-05T12:00:00.000Z',
  );
  assert.equal(first.body.data.trial_remaining_seconds, 432000);
  assert.deepEqual(first.body.data.access, {
    mode: 'full',
    accessible_card_count: canonicalSource.card_records.length,
    total_card_count: canonicalSource.card_records.length,
  });
  assert.ok(
    source.card_records.some(
      card => card.card_id === first.body.data.selection.card_id,
    ),
  );
  assert.equal(first.body.data.selection.phase, 'learning');
  assert.equal(first.body.data.selection.reason, 'catalog_new');
  assert.equal(first.body.data.selection.due_at, null);
  assert.match(first.body.data.selection.selection_id, /^sel_/);

  const sourceAfterTrialActivation = await cardSource(api, session);
  assert.deepEqual(
    sourceAfterTrialActivation.card_records,
    canonicalSource.card_records,
  );

  const resumed = await learningSession(api, session);
  assert.equal(resumed.statusCode, 200);
  assert.equal(resumed.body.data.selection.reason, 'persisted_cursor');
  assert.equal(
    resumed.body.data.selection.selection_id,
    first.body.data.selection.selection_id,
  );

  const bootstrap = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: DAY_KEY, track: 'cet4'},
  });
  assert.equal(bootstrap.statusCode, 200, JSON.stringify(bootstrap.body));
  assert.deepEqual(bootstrap.body.data.learning.cursor, {
    card_id: source.card_records[0].card_id,
    source_id: source.source.id,
    track: 'cet4',
  });
  assert.equal(store.snapshot().learningSessions.size, 1);
});

test('membership revision drift after cursor persistence retries before session authority returns', async () => {
  const store = createMemoryStore();
  const saveCursor = store.saveLearningSessionCursor;
  let driftInjected = false;
  store.saveLearningSessionCursor = async input => {
    const saved = await saveCursor(input);
    if (saved && !driftInjected) {
      driftInjected = true;
      await store.purchase(PHONE, START_TIME.toISOString());
    }
    return saved;
  };
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api, '127.0.0.28');
  const source = await cardSource(api, session);

  const response = await learningSession(api, session);
  const membership = await store.getMembership(PHONE, START_TIME.toISOString());

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.data.membership_stage, 'premium');
  assert.equal(
    response.body.data.selection.card_id,
    source.card_records[0].card_id,
  );
  assert.equal(response.body.data.selection.reason, 'persisted_cursor');
  assert.equal(membership.stage, 'premium');
  assert.equal(membership.counted_entry_count, 0);
  assert.equal(membership.trial_started_at, null);
  assert.deepEqual(membership.component_revision, {
    base_membership_revision: 1,
    beta_entitlement_revision: 0,
    pilot_entitlement_revision: 0,
  });
});

test('accepted events advance FSRS atomically and preserve due priority after one spacing task', async () => {
  const store = createMemoryStore();
  const {api, clock} = createTestApi({store});
  const session = await authenticatedSession(api, '127.0.0.2');
  const source = await cardSource(api, session);
  const selected = await learningSession(api, session);
  const event = eventFor(source, 0);
  const accepted = await submit(api, session, source, [event]);

  assert.equal(accepted.statusCode, 200, JSON.stringify(accepted.body));
  const snapshot = store.snapshot();
  const projection = [...snapshot.learningStates.values()].find(
    value => value.projection_version === 'learning-events.v2',
  );
  const entry = projection.scheduler_by_card_id[event.card_id];
  assert.equal(projection.scheduler_version, SCHEDULER_POLICY_VERSION);
  assert.equal(entry.algorithm, SCHEDULER_ALGORITHM);
  assert.equal(entry.library_version, SCHEDULER_LIBRARY_VERSION);
  assert.equal(entry.last_event_id, event.event_id);
  assert.equal(entry.last_server_sequence, 1);
  assert.equal(entry.card.due, '2026-04-30T12:10:00.000Z');
  assert.equal(entry.card.last_review, START_TIME.toISOString());
  assert.equal(entry.card.reps, 1);
  assert.equal([...snapshot.learningSessions.values()][0].cursor, null);

  const bootstrap = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: DAY_KEY, track: 'cet4'},
  });
  assert.equal(bootstrap.body.data.learning.cursor, null);

  clock.advanceMinutes(11);
  const spacing = await learningSession(api, session);
  assert.equal(spacing.statusCode, 200);
  assert.equal(spacing.body.data.selection.phase, 'learning');
  const spacedSource = await cardSource(api, session);
  const spacingIndex = spacedSource.card_records.findIndex(card => card.card_id === spacing.body.data.selection.card_id);
  assert.notEqual(spacedSource.card_records[spacingIndex].space_metadata.box_ref, source.card_records[0].space_metadata.box_ref);
  const spacingAck = await submit(api, session, spacedSource, [eventFor(spacedSource, spacingIndex, {
    event_id: 'scheduler_spacing_confirmed', selection_id: spacing.body.data.selection.selection_id,
    client_occurred_at: clock.now().toISOString(), device_cursor: {device_id: 'scheduler_device_0001', sequence: 2},
  })]);
  assert.equal(spacingAck.statusCode, 200, JSON.stringify(spacingAck.body));
  const due = await learningSession(api, session);
  assert.equal(due.statusCode, 200);
  assert.equal(due.body.data.selection.card_id, event.card_id);
  assert.equal(due.body.data.selection.phase, 'review');
  assert.equal(due.body.data.selection.reason, 'due_review');
  assert.equal(due.body.data.selection.due_at, entry.card.due);

  const scheduleBeforeDuplicate = structuredClone(entry);
  const duplicate = await submit(api, session, source, [event]);
  assert.equal(duplicate.statusCode, 200);
  assert.equal(duplicate.body.data.results[0].status, 'duplicate');
  assert.deepEqual(
    projection.scheduler_by_card_id[event.card_id],
    scheduleBeforeDuplicate,
  );
  const stillResumed = await learningSession(api, session);
  assert.equal(stillResumed.body.data.selection.reason, 'persisted_cursor');
  assert.equal(
    stillResumed.body.data.selection.selection_id,
    due.body.data.selection.selection_id,
  );
  assert.notEqual(
    selected.body.data.selection.selection_id,
    due.body.data.selection.selection_id,
  );
});

test('scheduler rating mapping uses Again, assisted Hard, and unassisted Good only', () => {
  const base = {
    card_id: '110101',
    content_version: `sha256:${'a'.repeat(64)}`,
    event_id: 'scheduler_rating_event_0001',
    used_hint: false,
    used_peek: false,
  };
  const again = {...base, answer_grade: 'review_needed'};
  const hard = {...base, answer_grade: 'passed', used_hint: true};
  const good = {...base, answer_grade: 'passed'};

  assert.equal(ratingForEvent(again), Rating.Again);
  assert.equal(ratingForEvent(hard), Rating.Hard);
  assert.equal(ratingForEvent(good), Rating.Good);

  const entries = [again, hard, good].map((event, index) =>
    advanceSchedulerEntry(null, {
      acceptedAt: START_TIME.toISOString(),
      event: {...event, event_id: `${event.event_id}_${index}`},
      serverSequence: index + 1,
    }),
  );
  assert.deepEqual(
    entries.map(entry => entry.card.due),
    [
      '2026-04-30T12:01:00.000Z',
      '2026-04-30T12:06:00.000Z',
      '2026-04-30T12:10:00.000Z',
    ],
  );
});

test('free access uses the canonical half-prefix and sleeping cards never enter selection', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api, '127.0.0.3');
  const source = await cardSource(api, session);
  const canonicalSource = await store.getCardSource('cet4');
  const initialMembership = await store.getMembership(PHONE);
  const {acknowledged_at: ignored, ...entitlement} = initialMembership;
  store.snapshot().memberships.set(PHONE, {
    entitlement: {...entitlement, stage: 'free'},
    updated_at: START_TIME.toISOString(),
  });
  await submitSpaceActions(api, session, source, [
    {
      action_id: 'space_free_sleep_0001',
      card_id: source.card_records[0].card_id,
      client_occurred_at: START_TIME.toISOString(),
      dimension: 'sleep',
      value: true,
    },
  ]);

  const first = await learningSession(api, session);
  assert.equal(first.statusCode, 200, JSON.stringify(first.body));
  assert.deepEqual(first.body.data.access, {
    mode: 'free_subset',
    accessible_card_count: source.card_records.length,
    total_card_count: canonicalSource.card_records.length,
  });
  assert.equal(
    first.body.data.selection.card_id,
    source.card_records[1].card_id,
  );

  const firstAccepted = await submit(api, session, source, [
    eventFor(source, 1),
  ]);
  const secondAccepted = await submit(api, session, source, [
    eventFor(source, 2, {
      device_cursor: {
        device_id: 'scheduler_device_0001',
        sequence: 3,
      },
    }),
  ]);
  assert.equal(
    firstAccepted.statusCode,
    200,
    JSON.stringify(firstAccepted.body),
  );
  assert.equal(
    secondAccepted.statusCode,
    200,
    JSON.stringify(secondAccepted.body),
  );

  const exhausted = await learningSession(api, session);
  assert.equal(exhausted.statusCode, 200);
  assert.equal(exhausted.body.data.selection, null);
  assert.equal(
    exhausted.body.data.next_due_at,
    '2026-04-30T12:10:00.000Z',
  );
  assert.ok(
    canonicalSource.card_records
      .slice(source.card_records.length)
      .every(card => card.card_id !== exhausted.body.data.selection?.card_id),
  );
});

test('an initial empty selection persists a valid revision before confirmation', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api, '127.0.0.18');
  const source = await cardSource(api, session);
  const canonicalSource = await store.getCardSource('cet4');
  assert.ok(source.card_records.length < canonicalSource.card_records.length);
  await submitSpaceActions(
    api,
    session,
    source,
    source.card_records.map(card => ({
      action_id: `space_empty_${card.card_id}`,
      card_id: card.card_id,
      client_occurred_at: START_TIME.toISOString(),
      dimension: 'sleep',
      value: true,
    })),
  );

  const first = await learningSession(api, session);
  const second = await learningSession(api, session);

  assert.equal(first.statusCode, 200, JSON.stringify(first.body));
  assert.equal(first.body.data.selection, null);
  assert.equal(first.body.data.next_due_at, null);
  assert.equal(second.statusCode, 200, JSON.stringify(second.body));
  assert.equal(second.body.data.selection, null);
  const membership = await store.getMembership(PHONE, START_TIME.toISOString());
  assert.equal(membership.stage, 'trial_available');
  assert.equal(membership.trial_started_at, null);
  assert.equal(membership.trial_expires_at, null);
  assert.equal(membership.trial_remaining_seconds, 0);
  const sessionState = [...store.snapshot().learningSessions.values()][0];
  assert.equal(sessionState.revision, 1);
  assert.equal(sessionState.cursor, null);
});

test('concurrent session reads converge on one persisted opaque selection', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api, '127.0.0.4');
  await cardSource(api, session);

  const [left, right] = await Promise.all([
    learningSession(api, session),
    learningSession(api, session),
  ]);

  assert.equal(left.statusCode, 200);
  assert.equal(right.statusCode, 200);
  assert.equal(
    left.body.data.selection.selection_id,
    right.body.data.selection.selection_id,
  );
  assert.equal(
    left.body.data.selection.card_id,
    right.body.data.selection.card_id,
  );
  assert.deepEqual(
    new Set([
      left.body.data.selection.reason,
      right.body.data.selection.reason,
    ]),
    new Set(['catalog_new', 'persisted_cursor']),
  );
  assert.equal(store.snapshot().learningSessions.size, 1);
});

test('a concurrent first event cannot be overwritten by a stale new-card selection', async () => {
  const baseStore = createMemoryStore();
  const learningReadCaptured = createDeferred();
  const releaseLearningRead = createDeferred();
  let blockSchedulerRead = false;
  const store = {
    ...baseStore,
    getLearningState: async (...args) => {
      const value = await baseStore.getLearningState(...args);

      if (blockSchedulerRead && args[3]?.includeSchedulerState === true) {
        blockSchedulerRead = false;
        learningReadCaptured.resolve();
        await releaseLearningRead.promise;
      }

      return value;
    },
  };
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api, '127.0.0.13');
  const source = await cardSource(api, session);
  const initial = await learningSession(api, session);
  assert.equal(initial.statusCode, 200);
  const event = eventFor(source, 0, {
    selection_id: initial.body.data.selection.selection_id,
  });
  blockSchedulerRead = true;

  const pendingSelection = learningSession(api, session);
  await learningReadCaptured.promise;
  const accepted = await submit(api, session, source, [event]);
  assert.equal(accepted.statusCode, 200, JSON.stringify(accepted.body));
  releaseLearningRead.resolve();
  const selected = await pendingSelection;

  assert.equal(selected.statusCode, 200, JSON.stringify(selected.body));
  assert.equal(
    selected.body.data.selection.card_id,
    source.card_records[1].card_id,
  );
  const sessionState = [...baseStore.snapshot().learningSessions.values()][0];
  assert.equal(sessionState.revision, 3);
  assert.equal(
    sessionState.learning_acknowledged_at,
    START_TIME.toISOString(),
  );
});

test('server-sequence watermark rejects an equal-time split projection read', async () => {
  const baseStore = createMemoryStore();
  const learningReadCaptured = createDeferred();
  const releaseSessionRead = createDeferred();
  let gate = null;
  const store = {
    ...baseStore,
    getLearningState: async (...args) => {
      const value = await baseStore.getLearningState(...args);

      if (gate && args[3]?.includeSchedulerState === true) {
        gate.learningCaptured.resolve();
      }

      return value;
    },
    getLearningSessionCursor: async (...args) => {
      if (gate) {
        const activeGate = gate;
        await activeGate.releaseSession.promise;

        if (gate === activeGate) {
          gate = null;
        }
      }

      return baseStore.getLearningSessionCursor(...args);
    },
  };
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api, '127.0.0.16');
  const source = await cardSource(api, session);
  const firstAccepted = await submit(api, session, source, [
    eventFor(source, 0),
  ]);
  assert.equal(firstAccepted.statusCode, 200);
  const nextSelection = await learningSession(api, session);
  assert.equal(nextSelection.statusCode, 200);
  const secondEvent = eventFor(source, 1, {
    selection_id: nextSelection.body.data.selection.selection_id,
  });
  gate = {
    learningCaptured: learningReadCaptured,
    releaseSession: releaseSessionRead,
  };

  const pendingSelection = learningSession(api, session);
  await learningReadCaptured.promise;
  const secondAccepted = await submit(api, session, source, [secondEvent]);
  assert.equal(secondAccepted.statusCode, 200);
  releaseSessionRead.resolve();
  const selected = await pendingSelection;

  assert.equal(selected.statusCode, 200, JSON.stringify(selected.body));
  assert.equal(
    selected.body.data.selection.card_id,
    (await baseStore.getCardSource('cet4')).card_records[3].card_id,
  );
  const sessionState = [...baseStore.snapshot().learningSessions.values()][0];
  assert.equal(sessionState.learning_acknowledged_at, START_TIME.toISOString());
  assert.equal(sessionState.learning_server_sequence, 2);
  assert.equal(sessionState.revision, 5);
});

test('an empty selection remains transactionally consistent during duplicate replay', async () => {
  const baseStore = createMemoryStore();
  let gate = null;
  const store = {
    ...baseStore,
    confirmLearningSessionCursor: async input => {
      if (gate) {
        const activeGate = gate;
        gate = null;
        activeGate.captured.resolve();
        await activeGate.release.promise;
      }

      return baseStore.confirmLearningSessionCursor(input);
    },
  };
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api, '127.0.0.17');
  const source = await cardSource(api, session);
  const initialMembership = await baseStore.getMembership(PHONE);
  const {acknowledged_at: ignored, ...entitlement} = initialMembership;
  baseStore.snapshot().memberships.set(PHONE, {
    entitlement: {...entitlement, stage: 'free'},
    updated_at: START_TIME.toISOString(),
  });
  const completedEvents = [
    eventFor(source, 0),
    eventFor(source, 1),
    eventFor(source, 2),
  ];
  for (const event of completedEvents) {
    const accepted = await submit(api, session, source, [event]);
    assert.equal(accepted.statusCode, 200, JSON.stringify(accepted.body));
  }
  const captured = createDeferred();
  const release = createDeferred();
  gate = {captured, release};

  const pendingEmptySelection = learningSession(api, session);
  await captured.promise;
  const repeated = await submit(api, session, source, [completedEvents[0]]);
  assert.equal(repeated.statusCode, 200, JSON.stringify(repeated.body));
  assert.equal(repeated.body.data.results[0].status, 'duplicate');
  release.resolve();
  const emptySelection = await pendingEmptySelection;
  const snapshot = baseStore.snapshot();
  const projection = [...snapshot.learningStates.values()].find(
    value => value.projection_version === 'learning-events.v2',
  );

  assert.equal(
    emptySelection.statusCode,
    200,
    JSON.stringify(emptySelection.body),
  );
  assert.equal(emptySelection.body.data.selection, null);
  assert.equal(
    emptySelection.body.data.next_due_at,
    projection.scheduler_by_card_id[source.card_records[0].card_id].card.due,
  );
  const sessionState = [...snapshot.learningSessions.values()][0];
  assert.equal(sessionState.learning_server_sequence, 3);
});

test('a concurrent completion cannot return a stale resumed cursor', async () => {
  const baseStore = createMemoryStore();
  let gate = null;
  const store = {
    ...baseStore,
    getLearningState: async (...args) => {
      const value = await baseStore.getLearningState(...args);

      if (gate && args[3]?.includeSchedulerState === true) {
        const activeGate = gate;
        gate = null;
        activeGate.captured.resolve();
        await activeGate.release.promise;
      }

      return value;
    },
  };
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api, '127.0.0.14');
  const source = await cardSource(api, session);
  const first = await learningSession(api, session);
  const completedEvent = eventFor(source, 0, {
    selection_id: first.body.data.selection.selection_id,
  });
  const captured = createDeferred();
  const release = createDeferred();
  gate = {captured, release};

  const pendingResume = learningSession(api, session);
  await captured.promise;
  const accepted = await submit(api, session, source, [completedEvent]);
  assert.equal(accepted.statusCode, 200, JSON.stringify(accepted.body));
  release.resolve();
  const replacement = await pendingResume;

  assert.equal(replacement.statusCode, 200, JSON.stringify(replacement.body));
  assert.equal(
    replacement.body.data.selection.card_id,
    source.card_records[1].card_id,
  );
  assert.notEqual(
    replacement.body.data.selection.selection_id,
    first.body.data.selection.selection_id,
  );
});

test('learning-session cursors stay isolated by account and track', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const first = await authenticatedSession(api, '127.0.0.9');
  const second = await authenticatedSession(
    api,
    '127.0.0.10',
    '13900139000',
  );
  const source = await cardSource(api, first);
  await cardSource(api, first, 'cet6');
  const firstCet4 = await learningSession(api, first);
  const firstCet6 = await learningSession(api, first, {
    query: {track: 'cet6'},
  });
  const secondCet4 = await learningSession(api, second);

  assert.equal(firstCet4.statusCode, 200);
  assert.equal(firstCet6.statusCode, 200);
  assert.equal(secondCet4.statusCode, 200);
  assert.notEqual(
    firstCet4.body.data.selection.selection_id,
    firstCet6.body.data.selection.selection_id,
  );
  assert.notEqual(
    firstCet4.body.data.selection.selection_id,
    secondCet4.body.data.selection.selection_id,
  );
  assert.equal(store.snapshot().learningSessions.size, 3);

  const accepted = await submit(api, first, source, [eventFor(source, 0)]);
  assert.equal(accepted.statusCode, 200, JSON.stringify(accepted.body));
  const sessionStates = [...store.snapshot().learningSessions.values()];
  assert.equal(
    sessionStates.find(
      value =>
        value.cursor?.selection_id ===
        firstCet4.body.data.selection.selection_id,
    ),
    undefined,
  );
  assert.equal(
    sessionStates.filter(value => value.cursor !== null).length,
    2,
  );
});

test('content-version drift replaces a stale cursor using new canonical order', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api, '127.0.0.11');
  const source = await cardSource(api, session);
  const first = await learningSession(api, session);
  const reversed = validateCardSourceForImport(
    {
      ...source,
      card_records: [...source.card_records].reverse(),
      content_version: undefined,
    },
    'cet4',
  );
  store.snapshot().cardSources.set('cet4', reversed);

  const replacement = await learningSession(api, session);

  assert.equal(replacement.statusCode, 200, JSON.stringify(replacement.body));
  assert.notEqual(
    replacement.body.data.content_version,
    first.body.data.content_version,
  );
  assert.equal(
    replacement.body.data.selection.card_id,
    reversed.card_records[0].card_id,
  );
  assert.notEqual(
    replacement.body.data.selection.selection_id,
    first.body.data.selection.selection_id,
  );
});

test('canonical sleep drift invalidates an existing cursor without deleting learning state', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api, '127.0.0.8');
  const source = await cardSource(api, session);
  const first = await learningSession(api, session);
  await submitSpaceActions(api, session, source, [
    {
      action_id: 'space_cursor_sleep_0001',
      card_id: first.body.data.selection.card_id,
      client_occurred_at: START_TIME.toISOString(),
      dimension: 'sleep',
      value: true,
    },
  ]);

  const replacement = await learningSession(api, session);
  const sessionDocument = [...store.snapshot().learningSessions.values()][0];

  assert.equal(replacement.statusCode, 200);
  assert.equal(
    replacement.body.data.selection.card_id,
    source.card_records[1].card_id,
  );
  assert.equal(replacement.body.data.selection.reason, 'catalog_new');
  assert.notEqual(
    replacement.body.data.selection.selection_id,
    first.body.data.selection.selection_id,
  );
  assert.equal(sessionDocument.revision, 2);
  assert.equal(sessionDocument.cursor.card_id, source.card_records[1].card_id);
  assert.equal(store.snapshot().learningStates.size, 0);
});

test('invalid canonical content fails before an available trial is consumed', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api, '127.0.0.6');
  await cardSource(api, session);
  store.snapshot().cardSources.get('cet4').card_records = [];

  const failed = await learningSession(api, session);
  const membership = await store.getMembership(PHONE);

  assert.equal(failed.statusCode, 503);
  assert.equal(
    failed.body.error.code,
    'learning_scheduler_unavailable',
  );
  assert.equal(membership.stage, 'trial_available');
  assert.equal(membership.counted_entry_count, 0);
  assert.equal(membership.trial_started_at_entry_count, null);
  assert.equal(store.snapshot().learningSessions.size, 0);
});

test('selection ID failure does not consume an available trial or persist a cursor', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({
    learningSchedulerRandomBytes: () => {
      throw new Error('entropy unavailable');
    },
    store,
  });
  const session = await authenticatedSession(api, '127.0.0.12');
  await cardSource(api, session);

  const failed = await learningSession(api, session);
  const membership = await store.getMembership(PHONE);

  assert.equal(failed.statusCode, 503);
  assert.equal(failed.body.error.code, 'learning_scheduler_unavailable');
  assert.equal(membership.stage, 'trial_available');
  assert.equal(membership.counted_entry_count, 0);
  assert.equal(store.snapshot().learningSessions.size, 0);
});

test('a sequence-zero legacy card is immediately review-eligible without invented FSRS history', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api, '127.0.0.7');
  const source = await cardSource(api, session);
  const card = source.card_records[0];
  await store.seedLegacyLearningStateForMigrationTest(
    PHONE,
    {
      day_key: DAY_KEY,
      events: [
        {
          card_id: card.card_id,
          completed_at: new Date(
            START_TIME.getTime() + 24 * 60 * 60 * 1000,
          ).toISOString(),
          interaction_id: card.interaction_id,
          is_favorited: false,
          outcome: card.interaction_id === 'flip' ? 'confident' : 'correct',
          phase: 'learning',
          used_hint: false,
          used_peek: false,
        },
      ],
      source_id: source.source.id,
      source_label: source.source.label,
      track: 'cet4',
    },
    START_TIME.toISOString(),
  );

  const selected = await learningSession(api, session);
  assert.equal(selected.statusCode, 200, JSON.stringify(selected.body));
  assert.equal(selected.body.data.selection.card_id, card.card_id);
  assert.equal(selected.body.data.selection.phase, 'review');
  assert.equal(selected.body.data.selection.reason, 'due_review');
  assert.equal(
    selected.body.data.selection.due_at,
    START_TIME.toISOString(),
  );
  assert.equal(
    store.snapshot().learningStates.get(`${PHONE}:${DAY_KEY}:cet4`)
      .scheduler_by_card_id,
    undefined,
  );
});

test('scheduler projection corruption fails closed on session and bootstrap reads', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api, '127.0.0.5');
  const source = await cardSource(api, session);
  const event = eventFor(source, 0);
  const accepted = await submit(api, session, source, [event]);
  assert.equal(accepted.statusCode, 200);
  const projection = [...store.snapshot().learningStates.values()].find(
    value => value.projection_version === 'learning-events.v2',
  );
  delete projection.scheduler_by_card_id[event.card_id];

  const schedulerRead = await learningSession(api, session);
  const bootstrapRead = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: DAY_KEY, track: 'cet4'},
  });

  assert.equal(schedulerRead.statusCode, 500);
  assert.equal(
    schedulerRead.body.error.code,
    'learning_events_projection_invalid',
  );
  assert.equal(bootstrapRead.statusCode, 500);
  assert.equal(
    bootstrapRead.body.error.code,
    'learning_events_projection_invalid',
  );
});

test('learning-session projection sequence watermark drift fails closed', async () => {
  const store = createMemoryStore();
  const {api} = createTestApi({store});
  const session = await authenticatedSession(api, '127.0.0.15');
  const source = await cardSource(api, session);
  const completedEvent = eventFor(source, 0);
  const accepted = await submit(api, session, source, [completedEvent]);
  assert.equal(accepted.statusCode, 200, JSON.stringify(accepted.body));
  const sessionState = [...store.snapshot().learningSessions.values()][0];
  sessionState.learning_server_sequence = 0;

  const bootstrapRead = await request(api, {
    headers: {authorization: `Bearer ${session.access_token}`},
    method: 'GET',
    path: '/v2/bootstrap',
    query: {day_key: DAY_KEY, track: 'cet4'},
  });
  const schedulerRead = await learningSession(api, session);
  const duplicateEvent = await submit(api, session, source, [completedEvent]);
  const newEvent = await submit(api, session, source, [
    eventFor(source, 1, {
      device_cursor: {
        device_id: 'scheduler_device_0001',
        sequence: 2,
      },
      event_id: 'scheduler_event_0002',
      selection_id: 'sel_stale_projection_pending',
    }),
  ]);
  const membership = await store.getMembership(PHONE);

  assert.equal(bootstrapRead.statusCode, 500);
  assert.equal(
    bootstrapRead.body.error.code,
    'learning_events_projection_invalid',
  );
  assert.equal(schedulerRead.statusCode, 409);
  assert.equal(schedulerRead.body.error.code, 'learning_session_conflict');
  assert.equal(duplicateEvent.statusCode, 503);
  assert.equal(
    duplicateEvent.body.error.code,
    'learning_events_projection_invalid',
  );
  assert.equal(newEvent.statusCode, 503);
  assert.equal(newEvent.body.error.code, 'learning_events_projection_invalid');
  assert.equal(store.snapshot().learningEvents.size, 1);
  assert.equal(membership.stage, 'trial');
});
