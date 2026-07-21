const crypto = require('node:crypto');

const {
  createLearningEventsError,
  isLearningEventsError,
} = require('./learning-events-v2-store');

const REQUEST_SCHEMA_VERSION = 'learning-events.v2';
const ACK_SCHEMA_VERSION = 'learning-events-ack.v2';
const DEFAULT_BATCH_LIMIT = 9;
const MAXIMUM_ATOMIC_BATCH_LIMIT = 9;
const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_FUTURE_SKEW_SECONDS = 5 * 60;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const CHINA_OFFSET_MILLISECONDS = 8 * 60 * 60 * 1000;
const TRACKS = ['cet4', 'cet6'];
const INTERACTIONS = [
  'flip',
  'multiple_choice',
  'lock',
  'elimination',
  'swipe',
];
const PHASES = ['learning', 'review'];
const ANSWER_GRADES = ['passed', 'review_needed'];
const OUTCOMES_BY_INTERACTION = {
  flip: ['confident', 'review'],
  multiple_choice: ['correct', 'incorrect'],
  lock: ['correct', 'incorrect'],
  elimination: ['correct', 'incorrect'],
  swipe: ['correct', 'incorrect'],
};
const ANSWER_GRADE_BY_OUTCOME = {
  correct: 'passed',
  incorrect: 'review_needed',
  confident: 'passed',
  review: 'review_needed',
};
const REQUEST_FIELDS = ['schema_version', 'track', 'events'];
const EVENT_FIELDS = [
  'event_id',
  'card_id',
  'interaction_id',
  'phase',
  'outcome',
  'answer_grade',
  'used_hint',
  'used_peek',
  'client_occurred_at',
  'content_version',
  'device_cursor',
];
const DEVICE_CURSOR_FIELDS = ['device_id', 'sequence'];
const IDENTITY_FIELDS = new Set([
  'phone_number',
  'account_id',
  'account_key',
  'auth_token',
  'access_token',
  'refresh_token',
]);
const RFC3339_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;

function createLearningEventsV2Service(options) {
  const config = {
    batchLimit: options.batchLimit ?? DEFAULT_BATCH_LIMIT,
    futureSkewSeconds: options.futureSkewSeconds ?? DEFAULT_FUTURE_SKEW_SECONDS,
    now: options.now,
    retentionDays: options.retentionDays ?? DEFAULT_RETENTION_DAYS,
    runtimeMode: options.runtimeMode,
    store: options.store,
  };
  validateConfig(config);

  return {
    submit: input => submitLearningEvents(config, input),
  };
}

async function submitLearningEvents(config, input) {
  const session = requireSessionIdentity(input.session);
  assertNoQueryInput(input.request.query);
  const parsed = parseRequest(input.request.body, config.batchLimit, session);
  const now = requireClockValue(config.now());
  const acknowledgedAt = now.toISOString();

  let results;

  try {
    results = await config.store.commitLearningEvents({
      accountKey: session.accountKey,
      acknowledgedAt,
      events: parsed.events,
      phoneNumber: session.phoneNumber,
      track: parsed.track,
      validateNewEvents: (events, readContentVersion) =>
        validateNewEvents(config, events, readContentVersion, now),
    });
  } catch (error) {
    if (isLearningEventsError(error)) {
      throw error;
    }

    throw createLearningEventsError(
      503,
      'learning_events_unavailable',
      'Learning event storage is temporarily unavailable.',
    );
  }

  return {
    schema_version: ACK_SCHEMA_VERSION,
    acknowledged_at: acknowledgedAt,
    track: parsed.track,
    results,
  };
}

function parseRequest(body, batchLimit, session) {
  const request = requireExactObject(
    body,
    REQUEST_FIELDS,
    'learning-events request',
  );

  if (request.schema_version !== REQUEST_SCHEMA_VERSION) {
    throw invalidRequest(`schema_version must be ${REQUEST_SCHEMA_VERSION}.`);
  }

  const track = requireEnum(request.track, TRACKS, 'track');

  if (!Array.isArray(request.events)) {
    throw invalidRequest('events must be an array.');
  }

  if (request.events.length === 0 || request.events.length > batchLimit) {
    throw invalidRequest(
      `events must contain between 1 and ${batchLimit} items.`,
    );
  }

  return {
    events: request.events.map((event, index) =>
      parseEvent(event, index, session, track),
    ),
    track,
  };
}

function parseEvent(value, index, session, track) {
  const label = `events[${index}]`;
  const event = requireExactObject(value, EVENT_FIELDS, label);
  const eventId = requireOpaqueId(event.event_id, `${label}.event_id`);
  const cardId = requireCardId(event.card_id, `${label}.card_id`);
  const interactionId = requireEnum(
    event.interaction_id,
    INTERACTIONS,
    `${label}.interaction_id`,
  );
  const outcome = requireEnum(
    event.outcome,
    OUTCOMES_BY_INTERACTION[interactionId],
    `${label}.outcome`,
  );
  const answerGrade = requireEnum(
    event.answer_grade,
    ANSWER_GRADES,
    `${label}.answer_grade`,
  );

  if (ANSWER_GRADE_BY_OUTCOME[outcome] !== answerGrade) {
    throw invalidRequest(
      `${label}.answer_grade does not match the submitted outcome.`,
    );
  }

  const clientTime = parseRfc3339(
    event.client_occurred_at,
    `${label}.client_occurred_at`,
  );
  const cursor = requireExactObject(
    event.device_cursor,
    DEVICE_CURSOR_FIELDS,
    `${label}.device_cursor`,
  );
  const deviceId = requireOpaqueId(
    cursor.device_id,
    `${label}.device_cursor.device_id`,
  );
  assertPseudonymousDeviceId(deviceId, session);
  const sequence = requirePositiveSafeInteger(
    cursor.sequence,
    `${label}.device_cursor.sequence`,
  );
  const payload = {
    event_id: eventId,
    card_id: cardId,
    interaction_id: interactionId,
    phase: requireEnum(event.phase, PHASES, `${label}.phase`),
    outcome,
    answer_grade: answerGrade,
    used_hint: requireBoolean(event.used_hint, `${label}.used_hint`),
    used_peek: requireBoolean(event.used_peek, `${label}.used_peek`),
    client_occurred_at: event.client_occurred_at,
    content_version: requireContentVersion(
      event.content_version,
      `${label}.content_version`,
    ),
    device_cursor: {
      device_id: deviceId,
      sequence,
    },
  };

  return {
    clientOccurredAtMs: clientTime,
    digest: sha256(stableJsonStringify({payload, track})),
    payload,
  };
}

async function validateNewEvents(config, events, readContentVersion, now) {
  const oldestAcceptedAt =
    now.getTime() - config.retentionDays * DAY_MILLISECONDS;
  const latestAcceptedAt = now.getTime() + config.futureSkewSeconds * 1000;
  const contentByVersion = new Map();

  for (const event of events) {
    if (
      event.clientOccurredAtMs < oldestAcceptedAt ||
      event.clientOccurredAtMs > latestAcceptedAt
    ) {
      throw invalidRequest(
        'client_occurred_at is outside the accepted retention or future-skew window.',
      );
    }

    const contentVersion = event.payload.content_version;

    if (!contentByVersion.has(contentVersion)) {
      const content = await readContentVersion({
        allowDevelopmentDefault: config.runtimeMode !== 'production',
        contentVersion,
        track: event.track,
      });

      contentByVersion.set(
        contentVersion,
        validateContentSnapshot(config, content, now),
      );
    }
  }

  return events.map(event => {
    const content = contentByVersion.get(event.payload.content_version);
    const card = content.cardSource.card_records.find(
      record => record.card_id === event.payload.card_id,
    );

    if (!card || card.track !== event.track) {
      throw unknownContent(
        'The card does not exist in the submitted content version.',
      );
    }

    if (card.interaction_id !== event.payload.interaction_id) {
      throw unknownContent(
        'The submitted interaction does not match the versioned card.',
      );
    }

    return {
      ...event,
      activityDay: chinaActivityDay(event.clientOccurredAtMs),
      sourceId: content.cardSource.source.id,
      sourceLabel: content.cardSource.source.label,
    };
  });
}

function validateContentSnapshot(config, content, now) {
  if (!content) {
    throw unknownContent('The submitted content version is not retained.');
  }

  if (!content.isCurrent) {
    if (!['active', 'retained'].includes(content.retentionStatus)) {
      throw unknownContent('The submitted content version is not retained.');
    }

    if (content.retainedUntil !== null) {
      const retainedUntil = Date.parse(content.retainedUntil);

      if (!Number.isFinite(retainedUntil)) {
        throw createLearningEventsError(
          503,
          'learning_events_content_registry_invalid',
          'The content version registry is invalid.',
        );
      }

      if (retainedUntil <= now.getTime()) {
        throw unknownContent(
          'The submitted content version is no longer retained.',
        );
      }
    }
  }

  if (
    config.runtimeMode === 'production' &&
    (content.cardSource.release === null ||
      content.cardSource.release === undefined)
  ) {
    throw unknownContent(
      'Production learning events require published content.',
    );
  }

  return content;
}

function requireSessionIdentity(value) {
  if (
    !isObject(value) ||
    typeof value.accountKey !== 'string' ||
    value.accountKey.length === 0 ||
    typeof value.phoneNumber !== 'string' ||
    value.phoneNumber.length === 0
  ) {
    throw createLearningEventsError(
      401,
      'invalid_auth_session',
      'An active v2 session is required.',
    );
  }

  return value;
}

function assertNoQueryInput(query) {
  if (query && Object.keys(query).length > 0) {
    if (Object.keys(query).some(field => IDENTITY_FIELDS.has(field))) {
      throw createLearningEventsError(
        400,
        'learning_events_identity_input_forbidden',
        'Learning event account identity comes from the active session.',
      );
    }

    throw invalidRequest('Learning event requests do not accept query fields.');
  }
}

function requireExactObject(value, expectedFields, label) {
  if (!isObject(value)) {
    throw invalidRequest(`${label} must be an object.`);
  }

  const actualFields = Object.keys(value);
  const missing = expectedFields.filter(field => !actualFields.includes(field));
  const unknown = actualFields.filter(field => !expectedFields.includes(field));

  if (unknown.some(field => IDENTITY_FIELDS.has(field))) {
    throw createLearningEventsError(
      400,
      'learning_events_identity_input_forbidden',
      'Learning event account identity comes from the active session.',
    );
  }

  if (missing.length > 0 || unknown.length > 0) {
    throw invalidRequest(`${label} must contain only its documented fields.`);
  }

  return value;
}

function requireOpaqueId(value, label) {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(value)
  ) {
    throw invalidRequest(`${label} must be an opaque identifier.`);
  }

  return value;
}

function requireCardId(value, label) {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/.test(value)
  ) {
    throw invalidRequest(`${label} must be a valid card identifier.`);
  }

  return value;
}

function requireContentVersion(value, label) {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value)) {
    throw invalidRequest(`${label} must be a lowercase SHA-256 identifier.`);
  }

  return value;
}

function requireEnum(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw invalidRequest(`${label} is invalid.`);
  }

  return value;
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw invalidRequest(`${label} must be boolean.`);
  }

  return value;
}

function requirePositiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw invalidRequest(`${label} must be a positive safe integer.`);
  }

  return value;
}

function parseRfc3339(value, label) {
  if (typeof value !== 'string') {
    throw invalidRequest(`${label} must be an RFC3339 timestamp.`);
  }

  const match = RFC3339_PATTERN.exec(value);

  if (!match) {
    throw invalidRequest(`${label} must be an RFC3339 timestamp.`);
  }

  const [
    ,
    year,
    month,
    day,
    hour,
    minute,
    second,
    ,
    zone,
    sign,
    zoneHour,
    zoneMinute,
  ] = match;
  const numeric = [year, month, day, hour, minute, second].map(Number);
  const [yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue] =
    numeric;
  const calendar = new Date(
    Date.UTC(
      yearValue,
      monthValue - 1,
      dayValue,
      hourValue,
      minuteValue,
      secondValue,
    ),
  );

  if (
    calendar.getUTCFullYear() !== yearValue ||
    calendar.getUTCMonth() !== monthValue - 1 ||
    calendar.getUTCDate() !== dayValue ||
    hourValue > 23 ||
    minuteValue > 59 ||
    secondValue > 59
  ) {
    throw invalidRequest(`${label} must be a real RFC3339 instant.`);
  }

  if (zone !== 'Z') {
    const offsetHour = Number(zoneHour);
    const offsetMinute = Number(zoneMinute);

    if (
      offsetHour > 14 ||
      offsetMinute > 59 ||
      (offsetHour === 14 && offsetMinute !== 0) ||
      (sign !== '+' && sign !== '-')
    ) {
      throw invalidRequest(`${label} has an invalid RFC3339 offset.`);
    }
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw invalidRequest(`${label} must be an RFC3339 timestamp.`);
  }

  return timestamp;
}

function assertPseudonymousDeviceId(deviceId, session) {
  if (
    /1[3-9]\d{9}/.test(deviceId) ||
    deviceId.includes(session.phoneNumber) ||
    deviceId.includes(session.accountKey) ||
    (session.sessionId && deviceId.includes(session.sessionId))
  ) {
    throw invalidRequest(
      'device_id must be a pseudonymous installation identifier.',
    );
  }
}

function chinaActivityDay(timestamp) {
  return new Date(timestamp + CHINA_OFFSET_MILLISECONDS)
    .toISOString()
    .slice(0, 10);
}

function stableJsonStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(item => stableJsonStringify(item)).join(',')}]`;
  }

  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function invalidRequest(message) {
  return createLearningEventsError(
    400,
    'invalid_learning_events_request',
    message,
  );
}

function unknownContent(message) {
  return createLearningEventsError(
    422,
    'invalid_learning_event_content',
    message,
  );
}

function requireClockValue(value) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error('Learning events v2 clock returned an invalid date.');
  }

  return value;
}

function validateConfig(config) {
  if (!['development', 'production'].includes(config.runtimeMode)) {
    throw new Error(
      `Unsupported learning-events runtime mode: ${config.runtimeMode}`,
    );
  }

  if (typeof config.now !== 'function') {
    throw new Error('Learning events v2 requires a clock.');
  }

  if (
    !config.store ||
    typeof config.store.commitLearningEvents !== 'function'
  ) {
    throw new Error(
      'Learning events v2 store is missing commitLearningEvents().',
    );
  }

  for (const [label, value] of [
    ['batchLimit', config.batchLimit],
    ['retentionDays', config.retentionDays],
    ['futureSkewSeconds', config.futureSkewSeconds],
  ]) {
    if (
      !Number.isSafeInteger(value) ||
      value <= 0 ||
      (label === 'batchLimit' && value > MAXIMUM_ATOMIC_BATCH_LIMIT)
    ) {
      throw new Error(
        label === 'batchLimit'
          ? `Learning events v2 batchLimit must be between 1 and ${MAXIMUM_ATOMIC_BATCH_LIMIT}.`
          : `Learning events v2 ${label} must be a positive integer.`,
      );
    }
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

module.exports = {
  ACK_SCHEMA_VERSION,
  DEFAULT_BATCH_LIMIT,
  DEFAULT_FUTURE_SKEW_SECONDS,
  DEFAULT_RETENTION_DAYS,
  REQUEST_SCHEMA_VERSION,
  createLearningEventsV2Service,
};
