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

if (authToken) {
  ok('auth', 'using SOFTBOOK_CET_AUTH_TOKEN');
} else {
  if (useIsolatedPhone) {
    ok('auth', `using isolated generated phone ${phoneNumber}`);
  }

  await requestSmsCode();

  if (!smsCode) {
    fail(
      'SOFTBOOK_CET_TEST_CODE is required when SOFTBOOK_CET_AUTH_TOKEN is not set.',
    );
  }

  authToken = await verifySmsCode();
}

const remoteHeaders = {
  ...authHeaders,
  Authorization: `Bearer ${authToken}`,
};

const entitlement = await loadMembershipEntitlement();
const cardSource = await loadLearningCardSource();
const firstCard = cardSource.card_records[0];

if (enableWrites) {
  await syncDailyProgress();
  await syncLearningState(cardSource, firstCard);
  await syncSpaceState(firstCard);
} else {
  skip('write sync endpoints', 'set SOFTBOOK_CET_SMOKE_WRITE=1 to enable');
}

if (enableMembershipMutations) {
  await startMembershipTrial();
  await purchaseMembership();
  await dismissMembershipRecovery();
} else {
  skip(
    'membership mutations',
    'set SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS=1 to enable',
  );
}

ok('done', `baseUrl=${baseUrl}, track=${track}, stage=${entitlement.stage}`);

async function requestSmsCode() {
  const response = await postJson('/v1/auth/request-code', {
    phone_number: phoneNumber,
  });

  assertOk(response, 'request-code');
  ok('request-code', response.status);
}

async function verifySmsCode() {
  const response = await postJson('/v1/auth/verify-code', {
    phone_number: phoneNumber,
    sms_code: smsCode,
  });

  assertOk(response, 'verify-code');
  const payload = await response.json();
  const data = assertObject(payload.data, 'verify-code data');
  const token = assertString(data.auth_token, 'data.auth_token');
  const returnedPhoneNumber = assertString(data.phone_number, 'data.phone_number');

  if (returnedPhoneNumber !== phoneNumber) {
    fail(`verify-code phone mismatch: expected ${phoneNumber}, got ${returnedPhoneNumber}`);
  }

  ok('verify-code', 'token received');
  return token;
}

async function loadMembershipEntitlement() {
  const response = await get('/v1/membership/entitlement');

  assertOk(response, 'membership entitlement');
  const payload = await response.json();
  const entitlement = parseEntitlement(payload, 'membership entitlement');

  ok('membership entitlement', entitlement.stage);
  return entitlement;
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
    `${data.card_records.length} cards from ${sourceId} covering ${REQUIRED_CORE_INTERACTIONS.join(',')}`,
  );
  return {
    card_records: data.card_records,
    source: {id: sourceId, label: sourceLabel},
    track: returnedTrack,
  };
}

async function syncDailyProgress() {
  const response = await postJson(
    '/v1/progress/daily-sync',
    {
      checked_in_today: true,
      day_key: todayKey(),
      favorite_count: 1,
      learning_completed_count: 1,
      pending_review_count: 0,
      phone_number: phoneNumber,
      review_completed_count: 0,
      sleeping_count: 0,
      total_completed_count: 1,
    },
    remoteHeaders,
  );

  assertOk(response, 'daily progress sync');
  ok('daily progress sync', response.status);
}

async function syncLearningState(cardSource, card) {
  const response = await postJson(
    '/v1/learning/state-sync',
    {
      day_key: todayKey(),
      events: [
        {
          card_id: card.card_id,
          completed_at: new Date().toISOString(),
          interaction_id: card.interaction_id,
          is_favorited: false,
          outcome: card.interaction_id === 'flip' ? 'confident' : 'correct',
          phase: 'learning',
          used_hint: Boolean(card.hint_layer),
          used_peek: true,
        },
      ],
      phone_number: phoneNumber,
      source_id: cardSource.source.id,
      source_label: cardSource.source.label,
      track: cardSource.track,
    },
    remoteHeaders,
  );

  assertOk(response, 'learning state sync');
  ok('learning state sync', response.status);
}

async function syncSpaceState(card) {
  const response = await postJson(
    '/v1/space/state-sync',
    {
      day_key: todayKey(),
      phone_number: phoneNumber,
      states: [
        {
          card_id: card.card_id,
          is_favorited: true,
          is_sleeping: false,
          last_modified_at: new Date().toISOString(),
        },
      ],
    },
    remoteHeaders,
  );

  assertOk(response, 'space state sync');
  ok('space state sync', response.status);
}

async function startMembershipTrial() {
  const entitlement = await runMembershipMutation('/v1/membership/start-trial');

  ok('membership start-trial', entitlement.stage);
}

async function purchaseMembership() {
  const entitlement = await runMembershipMutation('/v1/membership/purchase');

  ok('membership purchase', entitlement.stage);
}

async function dismissMembershipRecovery() {
  const entitlement = await runMembershipMutation(
    '/v1/membership/dismiss-recovery',
  );

  ok('membership dismiss-recovery', entitlement.stage);
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
  assertString(record.space_metadata?.library, `${label}.space_metadata.library`);
  assertString(record.space_metadata?.group, `${label}.space_metadata.group`);
  assertString(record.space_metadata?.box, `${label}.space_metadata.box`);
  assertString(record.space_metadata?.box_ref, `${label}.space_metadata.box_ref`);

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
      assertString(record.answer_key?.correct_option, `${label}.answer_key.correct_option`);
      if (!record.options.some(option => option.id === record.answer_key.correct_option)) {
        fail(`${label}.answer_key.correct_option must exist in options.`);
      }
      break;
    case 'lock':
      assertNonEmptyArray(record.lock_slots, `${label}.lock_slots`);
      assertNonEmptyArray(record.answer_key?.lock_pattern, `${label}.answer_key.lock_pattern`);
      if (record.lock_slots.length !== record.answer_key.lock_pattern.length) {
        fail(`${label}.lock_pattern must align with lock_slots.`);
      }
      record.lock_slots.forEach((slot, index) => {
        const selectedValue = record.answer_key.lock_pattern[index];

        if (!Array.isArray(slot.options) || !slot.options.includes(selectedValue)) {
          fail(`${label}.lock_pattern must select values from each slot.`);
        }
      });
      break;
    case 'elimination':
      assertNonEmptyArray(record.elimination_items, `${label}.elimination_items`);
      assertNonEmptyArray(record.answer_key?.correct_items, `${label}.answer_key.correct_items`);
      {
        const itemIds = new Set(record.elimination_items.map(item => item.id));

        if (!record.answer_key.correct_items.every(itemId => itemIds.has(itemId))) {
          fail(`${label}.answer_key.correct_items must exist in elimination_items.`);
        }
      }
      break;
    case 'swipe':
      assertArrayLength(record.swipe_states, 2, `${label}.swipe_states`);
      assertString(record.answer_key?.correct_state, `${label}.answer_key.correct_state`);
      if (!record.swipe_states.some(state => state.id === record.answer_key.correct_state)) {
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
      `${label} must cover core interactions before full visual QA: ${missingInteractions.join(',')}.`,
    );
  }
}

function parseEntitlement(payload, label) {
  const data = assertObject(payload.data, `${label}.data`);
  const entitlement = assertObject(data.entitlement, `${label}.data.entitlement`);
  const stage = assertString(entitlement.stage, `${label}.stage`);

  if (!['trial_available', 'trial', 'free', 'premium'].includes(stage)) {
    fail(`${label}.stage is invalid: ${stage}`);
  }

  assertNonNegativeInteger(entitlement.counted_entry_count, `${label}.counted_entry_count`);
  assertPositiveInteger(entitlement.trial_duration_days, `${label}.trial_duration_days`);

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

function assertString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${label} must be a non-empty string.`);
  }

  return value;
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
  return new Date().toISOString().slice(0, 10);
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
