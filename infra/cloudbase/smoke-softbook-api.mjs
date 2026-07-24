#!/usr/bin/env node

const baseUrl = normalizeBaseUrl(process.env.SOFTBOOK_CET_REMOTE_BASE_URL);
const apiKey = process.env.SOFTBOOK_CET_REMOTE_API_KEY;
const useIsolatedPhone = process.env.SOFTBOOK_CET_SMOKE_ISOLATED_PHONE === '1';
const phoneNumber = useIsolatedPhone
  ? createIsolatedPhoneNumber()
  : process.env.SOFTBOOK_CET_TEST_PHONE;
const smsCode = process.env.SOFTBOOK_CET_TEST_CODE;
const authTokenFromEnv = process.env.SOFTBOOK_CET_AUTH_TOKEN;
const track = process.env.SOFTBOOK_CET_LEARNING_TRACK || 'cet4';
const enableWrites = process.env.SOFTBOOK_CET_SMOKE_WRITE === '1';
const enableMembershipMutations =
  process.env.SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS === '1';
const expectedInitialStage =
  process.env.SOFTBOOK_CET_EXPECT_INITIAL_STAGE ??
  (useIsolatedPhone ? 'trial_available' : undefined);
const expectedStartTrialStage =
  process.env.SOFTBOOK_CET_EXPECT_START_TRIAL_STAGE ??
  (useIsolatedPhone && enableMembershipMutations ? 'trial' : undefined);
const expectedPurchaseStage =
  process.env.SOFTBOOK_CET_EXPECT_PURCHASE_STAGE ??
  (enableMembershipMutations ? 'premium' : undefined);
const REQUIRED_CORE_INTERACTIONS = [
  'elimination',
  'flip',
  'lock',
  'multiple_choice',
  'swipe',
];

if (!baseUrl) {
  fail('SOFTBOOK_CET_REMOTE_BASE_URL is required.');
}

if (track !== 'cet4' && track !== 'cet6') {
  fail('SOFTBOOK_CET_LEARNING_TRACK must be cet4 or cet6.');
}

if (!phoneNumber) {
  fail(
    'SOFTBOOK_CET_TEST_PHONE is required unless SOFTBOOK_CET_SMOKE_ISOLATED_PHONE=1.',
  );
}

if (useIsolatedPhone && authTokenFromEnv) {
  fail(
    'SOFTBOOK_CET_SMOKE_ISOLATED_PHONE cannot be combined with SOFTBOOK_CET_AUTH_TOKEN.',
  );
}

const authHeaders = {
  'content-type': 'application/json',
  'x-softbook-client': 'mobile',
  ...(apiKey ? {'x-api-key': apiKey} : {}),
};

let authToken = authTokenFromEnv;
let createdAuthSession;

if (authToken) {
  ok('auth', 'using SOFTBOOK_CET_AUTH_TOKEN');
} else {
  if (useIsolatedPhone) {
    ok('auth', `using isolated generated phone ${phoneNumber}`);
  }

  const challengeId = await requestSmsCode();

  if (!smsCode) {
    fail(
      'SOFTBOOK_CET_TEST_CODE is required when SOFTBOOK_CET_AUTH_TOKEN is not set.',
    );
  }

  createdAuthSession = await verifySmsCode(challengeId);
  createdAuthSession = await refreshAuthSession(createdAuthSession);
  authToken = createdAuthSession.accessToken;
}

const remoteHeaders = {
  ...authHeaders,
  Authorization: `Bearer ${authToken}`,
};

const initialBootstrap = await loadBootstrap('bootstrap');
const entitlement = await loadMembershipEntitlement();
assertExpectedStage(
  entitlement,
  expectedInitialStage,
  'membership entitlement',
);

if (initialBootstrap.membership.stage !== entitlement.stage) {
  fail(
    `bootstrap membership mismatch: ${initialBootstrap.membership.stage} != ${entitlement.stage}`,
  );
}

const cardSource = await loadLearningCardSource();

if (
  initialBootstrap.content.card_count !== cardSource.card_records.length ||
  initialBootstrap.content.source.id !== cardSource.source.id ||
  initialBootstrap.content.version !== cardSource.content_version
) {
  fail('bootstrap content metadata does not match the active card source.');
}

if (enableWrites) {
  const learningSelection = await loadLearningSelection(cardSource);
  const selectedCard = cardSource.card_records.find(
    card => card.card_id === learningSelection.card_id,
  );

  if (!selectedCard) {
    fail(
      `learning session selected unknown card ${learningSelection.card_id}.`,
    );
  }

  await checkInDailyProgress();
  await assertLegacySnapshotWritesDisabled();
  const learningEvent = await syncLearningEvents(
    cardSource,
    selectedCard,
    learningSelection,
  );
  await applySpaceAction(cardSource, selectedCard);
  await assertBootstrapWrites(
    initialBootstrap,
    selectedCard,
    learningEvent,
  );
} else {
  skip('write sync endpoints', 'set SOFTBOOK_CET_SMOKE_WRITE=1 to enable');
}

if (enableMembershipMutations) {
  await startMembershipTrial();
  await purchaseMembership();
  const finalEntitlement = await dismissMembershipRecovery();
  await assertBootstrapMembership(finalEntitlement);
} else {
  skip(
    'membership mutations',
    'set SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS=1 to enable',
  );
}

if (createdAuthSession) {
  await logoutAuthSession();
}

ok('done', `baseUrl=${baseUrl}, track=${track}, stage=${entitlement.stage}`);

async function requestSmsCode() {
  const response = await postJson('/v2/auth/request-code', {
    phone_number: phoneNumber,
  });

  assertOk(response, 'request-code');
  const payload = await response.json();
  const data = assertObject(payload.data, 'request-code data');
  const challengeId = assertString(data.challenge_id, 'data.challenge_id');
  assertString(data.expires_at, 'data.expires_at');
  ok('request-code', response.status);
  return challengeId;
}

async function verifySmsCode(challengeId) {
  const response = await postJson('/v2/auth/verify-code', {
    challenge_id: challengeId,
    phone_number: phoneNumber,
    sms_code: smsCode,
  });

  assertOk(response, 'verify-code');
  const payload = await response.json();
  const data = assertObject(payload.data, 'verify-code data');
  const session = parseAuthSession(data, 'verify-code data');
  const returnedPhoneNumber = assertString(
    data.phone_number,
    'data.phone_number',
  );

  if (returnedPhoneNumber !== phoneNumber) {
    fail(
      `verify-code phone mismatch: expected ${phoneNumber}, got ${returnedPhoneNumber}`,
    );
  }

  ok('verify-code', 'rotating session received');
  return session;
}

async function refreshAuthSession(session) {
  const response = await postJson('/v2/auth/refresh', {
    refresh_token: session.refreshToken,
  });
  assertOk(response, 'auth refresh');
  const payload = await response.json();
  const refreshed = parseAuthSession(
    assertObject(payload.data, 'auth refresh data'),
    'auth refresh data',
  );

  if (refreshed.sessionId !== session.sessionId) {
    fail('auth refresh changed session_id.');
  }

  if (refreshed.refreshToken === session.refreshToken) {
    fail('auth refresh did not rotate refresh_token.');
  }

  ok('auth refresh', 'credential pair rotated');
  return refreshed;
}

async function logoutAuthSession() {
  const response = await fetch(`${baseUrl}/v2/auth/logout`, {
    headers: remoteHeaders,
    method: 'POST',
  });
  assertOk(response, 'auth logout');
  ok('auth logout', response.status);
}

function parseAuthSession(data, label) {
  return {
    accessToken: assertString(data.access_token, `${label}.access_token`),
    refreshToken: assertString(data.refresh_token, `${label}.refresh_token`),
    sessionId: assertString(data.session_id, `${label}.session_id`),
  };
}

async function loadMembershipEntitlement() {
  const response = await get('/v1/membership/entitlement');

  assertOk(response, 'membership entitlement');
  const payload = await response.json();
  const entitlement = parseEntitlement(payload, 'membership entitlement');

  ok('membership entitlement', entitlement.stage);
  return entitlement;
}

async function loadBootstrap(label) {
  const response = await get(
    `/v2/bootstrap?track=${track}&day_key=${todayKey()}`,
  );

  assertOk(response, label);
  const payload = await response.json();
  const data = assertObject(payload.data, `${label} data`);

  if (data.schema_version !== 'bootstrap.v2') {
    fail(`${label} schema_version must be bootstrap.v2.`);
  }

  if (data.track !== track || data.day_key !== todayKey()) {
    fail(`${label} scope does not match requested track/day.`);
  }

  assertIsoTimestamp(data.generated_at, `${label}.generated_at`);
  const content = assertObject(data.content, `${label}.content`);
  const contentVersion = assertString(
    content.version,
    `${label}.content.version`,
  );

  if (!/^sha256:[a-f0-9]{64}$/.test(contentVersion)) {
    fail(`${label}.content.version must be a SHA-256 identifier.`);
  }

  const source = assertObject(content.source, `${label}.content.source`);
  const membership = assertObject(data.membership, `${label}.membership`);
  const progress = assertObject(data.progress, `${label}.progress`);
  const learning = assertObject(data.learning, `${label}.learning`);
  const space = assertObject(data.space, `${label}.space`);

  if (!Array.isArray(learning.card_states) || !Array.isArray(space.states)) {
    fail(`${label} learning.card_states and space.states must be arrays.`);
  }

  if (membership.acknowledged_at !== null) {
    assertIsoTimestamp(
      membership.acknowledged_at,
      `${label}.membership.acknowledged_at`,
    );
  }

  ok(label, `${contentVersion}; release=${content.release_id ?? 'none'}`);
  return {
    content: {
      card_count: content.card_count,
      source: {
        id: assertString(source.id, `${label}.content.source.id`),
      },
      version: contentVersion,
    },
    learning,
    membership,
    progress,
    space,
  };
}

async function assertBootstrapWrites(
  initialBootstrap,
  selectedCard,
  learningEvent,
) {
  const bootstrap = await loadBootstrap('bootstrap after writes');
  const expectedCompletedCount =
    initialBootstrap.progress.total_completed_count + 1;

  if (
    bootstrap.progress.checked_in_today !== true ||
    bootstrap.progress.total_completed_count !== expectedCompletedCount
  ) {
    fail(
      `bootstrap did not restore exactly one learning-event completion: expected ${expectedCompletedCount}, got ${bootstrap.progress.total_completed_count}.`,
    );
  }

  const restoredLearningState = bootstrap.learning.card_states.find(
    state => state.card_id === selectedCard.card_id,
  );

  if (
    restoredLearningState?.event_id !== learningEvent.event.event_id ||
    restoredLearningState?.server_sequence !== learningEvent.serverSequence
  ) {
    fail(
      'bootstrap did not restore the accepted learning-events.v2 projection.',
    );
  }

  if (
    !bootstrap.space.states.some(
      state => state.card_id === selectedCard.card_id && state.is_favorited,
    )
  ) {
    fail('bootstrap did not restore the physical-space write.');
  }
}

async function loadLearningCardSource() {
  const response = await get(`/v1/learning/card-source?track=${track}`);

  assertOk(response, 'learning card-source');
  const payload = await response.json();
  const data = assertObject(payload.data, 'learning data');
  const source = assertObject(data.source, 'learning data.source');
  const sourceId = assertString(source.id, 'data.source.id');
  const sourceLabel = assertString(source.label, 'data.source.label');
  const returnedTrack = assertString(data.track, 'data.track');
  const contentVersion = assertString(
    data.content_version,
    'data.content_version',
  );

  if (!/^sha256:[a-f0-9]{64}$/.test(contentVersion)) {
    fail('data.content_version must be a SHA-256 identifier.');
  }

  if (returnedTrack !== track) {
    fail(`card-source track mismatch: expected ${track}, got ${returnedTrack}`);
  }

  if (!Array.isArray(data.card_records) || data.card_records.length === 0) {
    fail('card-source requires non-empty data.card_records for smoke.');
  }

  for (const [index, card] of data.card_records.entries()) {
    validateCardRecord(card, `data.card_records[${index}]`);
  }

  assertCoreInteractionCoverage(data.card_records, 'data.card_records');
  ok(
    'learning card-source',
    `${
      data.card_records.length
    } cards from ${sourceId} covering ${REQUIRED_CORE_INTERACTIONS.join(',')}`,
  );
  return {
    card_records: data.card_records,
    content_version: contentVersion,
    source: {id: sourceId, label: sourceLabel},
    track: returnedTrack,
  };
}

async function loadLearningSelection(cardSource) {
  const response = await get(`/v2/learning/session?track=${track}`);

  assertOk(response, 'learning session');
  const payload = await response.json();
  assertExactKeys(payload, ['data'], 'learning session');
  const data = assertExactKeys(
    payload.data,
    [
      'access',
      'algorithm',
      'content_version',
      'generated_at',
      'membership_stage',
      'next_due_at',
      'schema_version',
      'selection',
      'source_id',
      'track',
    ],
    'learning session.data',
  );

  if (
    data.schema_version !== 'learning-session.v1' ||
    data.track !== cardSource.track ||
    data.content_version !== cardSource.content_version ||
    data.source_id !== cardSource.source.id
  ) {
    fail('learning session does not match the active canonical card source.');
  }

  assertIsoTimestamp(data.generated_at, 'learning session.data.generated_at');
  const selection = assertExactKeys(
    data.selection,
    ['card_id', 'due_at', 'phase', 'reason', 'selection_id'],
    'learning session.data.selection',
  );

  if (
    typeof selection.selection_id !== 'string' ||
    !/^sel_[A-Za-z0-9_-]{16,128}$/.test(selection.selection_id) ||
    typeof selection.card_id !== 'string' ||
    !['learning', 'review'].includes(selection.phase)
  ) {
    fail('learning session selection does not match learning-session.v1.');
  }

  ok(
    'learning session',
    `${selection.phase}:${selection.card_id}`,
  );
  return selection;
}

async function checkInDailyProgress() {
  const response = await postJson(
    '/v2/progress/check-in',
    {day_key: todayKey()},
    remoteHeaders,
  );

  assertOk(response, 'daily check-in');
  const payload = await response.json();
  assertExactKeys(payload, ['data'], 'daily check-in');
  const data = assertExactKeys(
    payload.data,
    [
      'acknowledged_at',
      'checked_in_today',
      'day_key',
      'schema_version',
    ],
    'daily check-in.data',
  );

  if (
    data.schema_version !== 'daily-check-in.v2' ||
    data.day_key !== todayKey() ||
    data.checked_in_today !== true
  ) {
    fail('daily check-in response does not match the strict v2 contract.');
  }

  assertIsoTimestamp(data.acknowledged_at, 'daily check-in.acknowledged_at');
  ok('daily check-in', response.status);
}

async function assertLegacySnapshotWritesDisabled() {
  const requests = [
    {
      allowedCodes: [
        'legacy_api_disabled',
        'legacy_snapshot_write_disabled',
      ],
      method: 'POST',
      path: '/v1/progress/daily-sync',
    },
    {
      allowedCodes: [
        'legacy_api_disabled',
        'legacy_snapshot_write_disabled',
      ],
      method: 'POST',
      path: '/v1/learning/state-sync',
    },
    {
      allowedCodes: [
        'legacy_api_disabled',
        'legacy_space_snapshot_disabled',
      ],
      method: 'GET',
      path: '/v1/space/state-sync',
    },
    {
      allowedCodes: [
        'legacy_api_disabled',
        'legacy_space_snapshot_disabled',
      ],
      method: 'POST',
      path: '/v1/space/state-sync',
    },
  ];

  for (const request of requests) {
    const response = await fetch(`${baseUrl}${request.path}`, {
      ...(request.method === 'POST' ? {body: '{}'} : {}),
      headers: authHeaders,
      method: request.method,
    });
    const payload = await response.json();
    const error = assertObject(payload.error, `${request.path}.error`);

    if (
      response.status !== 410 ||
      !request.allowedCodes.includes(error.code)
    ) {
      fail(
        `${request.method} ${request.path} must remain globally disabled with 410.`,
      );
    }
  }

  ok('legacy snapshot APIs', 410);
}

async function syncLearningEvents(cardSource, card, selection) {
  const runId = `${Date.now().toString(36)}_${process.pid.toString(36)}`;
  const outcome = card.interaction_id === 'flip' ? 'confident' : 'correct';
  const event = {
    event_id: `smoke_event_${runId}`,
    card_id: card.card_id,
    interaction_id: card.interaction_id,
    selection_id: selection.selection_id,
    phase: selection.phase,
    outcome,
    answer_grade: 'passed',
    used_hint: false,
    used_peek: false,
    client_occurred_at: new Date().toISOString(),
    content_version: cardSource.content_version,
    device_cursor: {
      device_id: `smoke_installation_${runId}`,
      sequence: 1,
    },
  };
  const body = {
    schema_version: 'learning-events.v2',
    track: cardSource.track,
    events: [event],
  };
  const acceptedResponse = await postJson(
    '/v2/learning/events',
    body,
    remoteHeaders,
  );

  assertOk(acceptedResponse, 'learning-events accepted');
  const accepted = parseLearningEventAck(
    await acceptedResponse.json(),
    'learning-events accepted',
    event.event_id,
    'accepted',
  );
  const duplicateResponse = await postJson(
    '/v2/learning/events',
    body,
    remoteHeaders,
  );

  assertOk(duplicateResponse, 'learning-events duplicate');
  const duplicate = parseLearningEventAck(
    await duplicateResponse.json(),
    'learning-events duplicate',
    event.event_id,
    'duplicate',
  );

  if (duplicate.serverSequence !== accepted.serverSequence) {
    fail('learning-events exact replay changed server_sequence.');
  }

  ok(
    'learning-events v2',
    `accepted then duplicate at server_sequence=${accepted.serverSequence}`,
  );
  return {event, serverSequence: accepted.serverSequence};
}

function parseLearningEventAck(
  payload,
  label,
  expectedEventId,
  expectedStatus,
) {
  assertExactKeys(payload, ['data'], label);
  const data = assertObject(payload.data, `${label}.data`);
  assertExactKeys(
    data,
    ['acknowledged_at', 'results', 'schema_version', 'track'],
    `${label}.data`,
  );

  if (data.schema_version !== 'learning-events-ack.v2') {
    fail(`${label}.data.schema_version must be learning-events-ack.v2.`);
  }

  if (data.track !== track) {
    fail(`${label}.data.track must match ${track}.`);
  }

  assertIsoTimestamp(data.acknowledged_at, `${label}.data.acknowledged_at`);

  if (!Array.isArray(data.results) || data.results.length !== 1) {
    fail(`${label}.data.results must contain exactly one result.`);
  }

  const result = assertObject(data.results[0], `${label}.data.results[0]`);
  assertExactKeys(
    result,
    ['event_id', 'server_sequence', 'status'],
    `${label}.data.results[0]`,
  );

  if (
    result.event_id !== expectedEventId ||
    result.status !== expectedStatus ||
    !Number.isSafeInteger(result.server_sequence) ||
    result.server_sequence <= 0
  ) {
    fail(`${label}.data.results[0] does not match the strict ACK contract.`);
  }

  return {serverSequence: result.server_sequence};
}

async function applySpaceAction(cardSource, card) {
  const actionId = `smoke_space_${Date.now().toString(
    36,
  )}_${process.pid.toString(36)}`;
  const body = {
    actions: [
      {
        action_id: actionId,
        card_id: card.card_id,
        client_occurred_at: new Date().toISOString(),
        dimension: 'favorite',
        value: true,
      },
    ],
    content_version: cardSource.content_version,
    schema_version: 'space-actions.v2',
    track: cardSource.track,
  };
  const acceptedResponse = await postJson(
    '/v2/space/actions',
    body,
    remoteHeaders,
  );

  assertOk(acceptedResponse, 'space action accepted');
  parseSpaceActionAck(
    await acceptedResponse.json(),
    'space action accepted',
    actionId,
    'applied',
    cardSource,
    card.card_id,
  );
  const duplicateResponse = await postJson(
    '/v2/space/actions',
    body,
    remoteHeaders,
  );

  assertOk(duplicateResponse, 'space action duplicate');
  parseSpaceActionAck(
    await duplicateResponse.json(),
    'space action duplicate',
    actionId,
    'duplicate',
    cardSource,
    card.card_id,
  );
  ok('space-actions v2', 'applied then duplicate');
}

function parseSpaceActionAck(
  payload,
  label,
  expectedActionId,
  expectedStatus,
  cardSource,
  cardId,
) {
  assertExactKeys(payload, ['data'], label);
  const data = assertExactKeys(
    payload.data,
    [
      'acknowledged_at',
      'content_version',
      'results',
      'schema_version',
      'space_state',
      'track',
    ],
    `${label}.data`,
  );

  if (
    data.schema_version !== 'space-actions-ack.v2' ||
    data.track !== cardSource.track ||
    data.content_version !== cardSource.content_version
  ) {
    fail(`${label}.data does not match the submitted content scope.`);
  }

  assertIsoTimestamp(data.acknowledged_at, `${label}.data.acknowledged_at`);

  if (!Array.isArray(data.results) || data.results.length !== 1) {
    fail(`${label}.data.results must contain exactly one result.`);
  }

  const result = assertExactKeys(
    data.results[0],
    ['action_id', 'status'],
    `${label}.data.results[0]`,
  );

  if (
    result.action_id !== expectedActionId ||
    result.status !== expectedStatus
  ) {
    fail(`${label}.data.results[0] does not match the strict ACK contract.`);
  }

  const state = assertExactKeys(
    data.space_state,
    [
      'acknowledged_at',
      'content_version',
      'schema_version',
      'states',
      'track',
    ],
    `${label}.data.space_state`,
  );

  if (
    state.schema_version !== 'space-state.v2' ||
    state.track !== cardSource.track ||
    state.content_version !== cardSource.content_version ||
    !Array.isArray(state.states) ||
    !state.states.some(
      item => item.card_id === cardId && item.is_favorited === true,
    )
  ) {
    fail(`${label}.data.space_state is not the canonical favorite state.`);
  }
}

async function startMembershipTrial() {
  const entitlement = await runMembershipMutation('/v1/membership/start-trial');

  assertExpectedStage(
    entitlement,
    expectedStartTrialStage,
    'membership start-trial',
  );
  ok('membership start-trial', entitlement.stage);
}

async function purchaseMembership() {
  const entitlement = await runMembershipMutation('/v1/membership/purchase');

  assertExpectedStage(
    entitlement,
    expectedPurchaseStage,
    'membership purchase',
  );
  ok('membership purchase', entitlement.stage);
}

async function dismissMembershipRecovery() {
  const entitlement = await runMembershipMutation(
    '/v1/membership/dismiss-recovery',
  );

  ok('membership dismiss-recovery', entitlement.stage);
  return entitlement;
}

async function assertBootstrapMembership(expectedEntitlement) {
  const bootstrap = await loadBootstrap('bootstrap after membership mutations');

  if (bootstrap.membership.stage !== expectedEntitlement.stage) {
    fail(
      `bootstrap membership stage mismatch: ${bootstrap.membership.stage} != ${expectedEntitlement.stage}`,
    );
  }

  assertIsoTimestamp(
    bootstrap.membership.acknowledged_at,
    'bootstrap membership acknowledged_at',
  );
}

async function runMembershipMutation(path) {
  const response = await postJson(
    path,
    {phone_number: phoneNumber},
    remoteHeaders,
  );

  assertOk(response, path);
  const payload = await response.json();
  return parseEntitlement(payload, path);
}

function validateCardRecord(card, label) {
  const record = assertObject(card, label);
  assertPattern(record.card_id, /^\d{6}$/, `${label}.card_id`);
  assertPattern(record.knowledge_ref, /^\d{4}$/, `${label}.knowledge_ref`);

  if (!record.card_id.startsWith(record.knowledge_ref)) {
    fail(`${label}.card_id must start with knowledge_ref.`);
  }

  assertTrack(record.track, `${label}.track`);
  assertString(record.interaction_id, `${label}.interaction_id`);
  assertString(record.front?.eyebrow, `${label}.front.eyebrow`);
  assertString(record.front?.prompt, `${label}.front.prompt`);
  assertString(record.front?.support, `${label}.front.support`);
  assertString(record.front?.context, `${label}.front.context`);
  assertString(record.analysis?.title, `${label}.analysis.title`);
  assertString(record.analysis?.summary, `${label}.analysis.summary`);
  assertString(record.analysis?.exam_tip, `${label}.analysis.exam_tip`);
  assertString(
    record.space_metadata?.library,
    `${label}.space_metadata.library`,
  );
  assertString(record.space_metadata?.group, `${label}.space_metadata.group`);
  assertString(record.space_metadata?.box, `${label}.space_metadata.box`);
  assertString(
    record.space_metadata?.box_ref,
    `${label}.space_metadata.box_ref`,
  );

  if (record.space_metadata.box_ref !== record.knowledge_ref) {
    fail(`${label}.space_metadata.box_ref must match knowledge_ref.`);
  }

  if (record.hint_layer) {
    assertString(record.hint_layer.content, `${label}.hint_layer.content`);
    if (record.hint_layer.reveal_gesture !== '下滑') {
      fail(`${label}.hint_layer.reveal_gesture must be 下滑.`);
    }
  }

  switch (record.interaction_id) {
    case 'flip':
      assertString(record.back_text, `${label}.back_text`);
      if (record.auto_scoring === true) {
        fail(`${label}.flip must not claim auto_scoring true.`);
      }
      break;
    case 'multiple_choice':
      assertArrayLength(record.options, 4, `${label}.options`);
      assertString(
        record.answer_key?.correct_option,
        `${label}.answer_key.correct_option`,
      );
      if (
        !record.options.some(
          option => option.id === record.answer_key.correct_option,
        )
      ) {
        fail(`${label}.answer_key.correct_option must exist in options.`);
      }
      break;
    case 'lock':
      assertNonEmptyArray(record.lock_slots, `${label}.lock_slots`);
      assertNonEmptyArray(
        record.answer_key?.lock_pattern,
        `${label}.answer_key.lock_pattern`,
      );
      if (record.lock_slots.length !== record.answer_key.lock_pattern.length) {
        fail(`${label}.lock_pattern must align with lock_slots.`);
      }
      record.lock_slots.forEach((slot, index) => {
        const selectedValue = record.answer_key.lock_pattern[index];

        if (
          !Array.isArray(slot.options) ||
          !slot.options.includes(selectedValue)
        ) {
          fail(`${label}.lock_pattern must select values from each slot.`);
        }
      });
      break;
    case 'elimination':
      assertNonEmptyArray(
        record.elimination_items,
        `${label}.elimination_items`,
      );
      assertNonEmptyArray(
        record.answer_key?.correct_items,
        `${label}.answer_key.correct_items`,
      );
      {
        const itemIds = new Set(record.elimination_items.map(item => item.id));

        if (
          !record.answer_key.correct_items.every(itemId => itemIds.has(itemId))
        ) {
          fail(
            `${label}.answer_key.correct_items must exist in elimination_items.`,
          );
        }
      }
      break;
    case 'swipe':
      assertArrayLength(record.swipe_states, 2, `${label}.swipe_states`);
      assertString(
        record.answer_key?.correct_state,
        `${label}.answer_key.correct_state`,
      );
      if (
        !record.swipe_states.some(
          state => state.id === record.answer_key.correct_state,
        )
      ) {
        fail(`${label}.answer_key.correct_state must exist in swipe_states.`);
      }
      break;
    default:
      fail(`${label}.interaction_id is unsupported: ${record.interaction_id}`);
  }
}

function assertCoreInteractionCoverage(records, label) {
  const interactions = new Set(records.map(record => record.interaction_id));
  const missingInteractions = REQUIRED_CORE_INTERACTIONS.filter(
    interaction => !interactions.has(interaction),
  );

  if (missingInteractions.length > 0) {
    fail(
      `${label} must cover core interactions before full visual QA: ${missingInteractions.join(
        ',',
      )}.`,
    );
  }
}

function parseEntitlement(payload, label) {
  const data = assertObject(payload.data, `${label}.data`);
  const entitlement = assertObject(
    data.entitlement,
    `${label}.data.entitlement`,
  );
  const stage = assertString(entitlement.stage, `${label}.stage`);

  if (!['trial_available', 'trial', 'free', 'premium'].includes(stage)) {
    fail(`${label}.stage is invalid: ${stage}`);
  }

  assertNonNegativeInteger(
    entitlement.counted_entry_count,
    `${label}.counted_entry_count`,
  );
  assertPositiveInteger(
    entitlement.trial_duration_days,
    `${label}.trial_duration_days`,
  );

  if (
    entitlement.trial_started_at_entry_count !== null &&
    entitlement.trial_started_at_entry_count !== undefined
  ) {
    assertPositiveInteger(
      entitlement.trial_started_at_entry_count,
      `${label}.trial_started_at_entry_count`,
    );
  }

  if (
    entitlement.last_experience_ended_by !== null &&
    !['trial', 'premium'].includes(entitlement.last_experience_ended_by)
  ) {
    fail(`${label}.last_experience_ended_by must be trial, premium, or null.`);
  }

  if (typeof entitlement.recovery_prompt_visible !== 'boolean') {
    fail(`${label}.recovery_prompt_visible must be boolean.`);
  }

  return entitlement;
}

async function get(path) {
  return fetch(`${baseUrl}${path}`, {
    headers: remoteHeaders,
    method: 'GET',
  });
}

async function postJson(path, body, headers = authHeaders) {
  return fetch(`${baseUrl}${path}`, {
    body: JSON.stringify(body),
    headers,
    method: 'POST',
  });
}

function assertOk(response, label) {
  if (!response.ok) {
    fail(`${label} failed with ${response.status}.`);
  }
}

function assertObject(value, label) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }

  return value;
}

function assertExactKeys(value, expectedKeys, label) {
  const object = assertObject(value, label);
  const actualKeys = Object.keys(object).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();

  if (JSON.stringify(actualKeys) !== JSON.stringify(sortedExpectedKeys)) {
    fail(
      `${label} keys must be ${sortedExpectedKeys.join(
        ',',
      )}; got ${actualKeys.join(',')}.`,
    );
  }

  return object;
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${label} must be a non-empty string.`);
  }

  return value;
}

function assertIsoTimestamp(value, label) {
  const timestamp = assertString(value, label);

  if (Number.isNaN(Date.parse(timestamp))) {
    fail(`${label} must be an ISO timestamp.`);
  }

  return timestamp;
}

function assertPattern(value, pattern, label) {
  const text = assertString(value, label);

  if (!pattern.test(text)) {
    fail(`${label} does not match ${pattern}.`);
  }
}

function assertTrack(value, label) {
  const text = assertString(value, label);

  if (text !== 'cet4' && text !== 'cet6') {
    fail(`${label} must be cet4 or cet6.`);
  }
}

function assertArrayLength(value, length, label) {
  if (!Array.isArray(value) || value.length !== length) {
    fail(`${label} must be an array of length ${length}.`);
  }
}

function assertNonEmptyArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${label} must be a non-empty array.`);
  }
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    fail(`${label} must be a non-negative integer.`);
  }
}

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    fail(`${label} must be a positive integer.`);
  }
}

function normalizeBaseUrl(value) {
  if (!value || value.trim().length === 0) {
    return null;
  }

  return value.trim().replace(/\/+$/, '');
}

function todayKey() {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  })
    .formatToParts(new Date())
    .reduce((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function assertExpectedStage(entitlement, expectedStage, label) {
  if (!expectedStage) {
    return;
  }

  if (entitlement.stage !== expectedStage) {
    fail(`${label} expected stage ${expectedStage}, got ${entitlement.stage}.`);
  }
}

function createIsolatedPhoneNumber() {
  const suffix = String(Date.now() % 1_000_000_000).padStart(9, '0');

  return `19${suffix}`;
}

function ok(step, detail) {
  console.log(`[ok] ${step}: ${detail}`);
}

function skip(step, detail) {
  console.log(`[skip] ${step}: ${detail}`);
}

function fail(message) {
  console.error(`[fail] ${message}`);
  process.exit(1);
}
