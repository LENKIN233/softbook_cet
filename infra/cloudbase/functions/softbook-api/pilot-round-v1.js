const crypto = require('node:crypto');

const {
  isContentReleaseValidForRuntime,
} = require('./content-release-runtime');

const PILOT_ROUND_COMPLETION_SCHEMA = 'pilot-round-completion.v1';
const PILOT_ROUND_CONTINUE_SCHEMA = 'pilot-round-continue.v1';
const PILOT_ROUND_ACK_SCHEMA = 'pilot-round-continue-ack.v1';
const PILOT_ROUND_RECORD_SCHEMA = 'pilot-round-continuation.v1';
const ROUND_SIZE = 5;
const CONTENT_VERSION_PATTERN = /^sha256:[a-f0-9]{64}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const RECEIPT_PATTERN = /^rnd_[A-Za-z0-9_-]{32,64}$/;
const CARD_ID_PATTERN = /^\d{6}$/;

function createPilotRoundV1Service(options) {
  const config = {
    now: options.now,
    runtimeMode: options.runtimeMode,
    store: options.store,
  };
  validateConfig(config);

  return {
    continue: input => continuePilotRound(config, input),
  };
}

async function continuePilotRound(config, input) {
  if (config.runtimeMode !== 'controlled_pilot') {
    throw pilotRoundError(
      404,
      'not_found',
      'Unsupported Softbook API route.',
    );
  }

  const command = normalizeContinueCommand(input.request?.body);
  const acknowledgedAt = canonicalTimestamp(config.now());
  const cardSource = await config.store.getCardSource(command.track, {
    allowDevelopmentDefault: false,
  });
  const release = requireActivePilotRelease(
    cardSource,
    config.runtimeMode,
    command,
    acknowledgedAt,
  );
  const expectedReceipt = createPilotRoundReceipt({
    accountKey: input.session.accountKey,
    completedCount: command.completed_count,
    contentVersion: command.content_version,
    pilotId: release.pilot_id,
  });
  if (command.receipt_id !== expectedReceipt) {
    throw pilotRoundError(
      409,
      'pilot_round_receipt_mismatch',
      'The round receipt does not match the server-derived boundary.',
    );
  }
  const existing = await config.store.getPilotRoundContinuation({
    accountKey: input.session.accountKey,
    completedCount: command.completed_count,
    contentVersion: command.content_version,
    pilotId: release.pilot_id,
    receiptId: expectedReceipt,
  });
  if (existing) {
    return serializeAcknowledgement(existing, true);
  }
  const learningState = await config.store.getLearningState(
    input.session.phoneNumber,
    chinaActivityDay(Date.parse(acknowledgedAt)),
    command.track,
    {accountKey: input.session.accountKey, includeSchedulerState: true},
  );
  const completedCount = canonicalCompletedCount(learningState);

  if (
    completedCount !== command.completed_count ||
    !isRoundBoundary(completedCount)
  ) {
    throw pilotRoundError(
      409,
      'pilot_round_boundary_changed',
      'The current server-confirmed round boundary does not match the command.',
    );
  }

  const result = await config.store.commitPilotRoundContinuation({
    acknowledgedAt,
    accountKey: input.session.accountKey,
    completedCount,
    contentVersion: command.content_version,
    pilotId: release.pilot_id,
    receiptId: expectedReceipt,
    track: command.track,
  });
  if (!result?.accepted) {
    throw pilotRoundError(
      409,
      'pilot_round_boundary_changed',
      'The learning projection changed while acknowledging the round.',
    );
  }

  return serializeAcknowledgement(result.record, result.duplicate);
}

function serializeAcknowledgement(record, duplicate) {
  return {
    schema_version: PILOT_ROUND_ACK_SCHEMA,
    acknowledged_at: record.acknowledged_at,
    completed_count: record.completed_count,
    receipt_id: record.receipt_id,
    status: duplicate ? 'duplicate' : 'acknowledged',
  };
}

function createPilotRoundCompletion(input) {
  if (!isRoundBoundary(input.completedCount)) return null;
  return {
    schema_version: PILOT_ROUND_COMPLETION_SCHEMA,
    receipt_id: createPilotRoundReceipt(input),
    completed_count: input.completedCount,
    review_card_ids: normalizeReviewCardIds(input.reviewCardIds),
  };
}

function normalizeReviewCardIds(value) {
  if (!Array.isArray(value)) {
    throw new Error('Pilot round review card ids are invalid.');
  }
  const seen = new Set();
  return value.map(cardId => {
    const normalized = requirePattern(cardId, CARD_ID_PATTERN, 'reviewCardId');
    if (seen.has(normalized)) {
      throw new Error('Pilot round review card ids contain duplicates.');
    }
    seen.add(normalized);
    return normalized;
  });
}

function createPilotRoundReceipt(input) {
  const accountKey = requirePattern(
    input.accountKey,
    /^[a-f0-9]{64}$/,
    'accountKey',
  );
  const pilotId = requirePattern(
    input.pilotId,
    IDENTIFIER_PATTERN,
    'pilotId',
  );
  const contentVersion = requirePattern(
    input.contentVersion,
    CONTENT_VERSION_PATTERN,
    'contentVersion',
  );
  const completedCount = requireBoundary(input.completedCount);
  const framed = [accountKey, pilotId, contentVersion, String(completedCount)]
    .map(value => `${Buffer.byteLength(value, 'utf8')}:${value}`)
    .join('|');
  return `rnd_${crypto
    .createHash('sha256')
    .update(`softbook-pilot-round.v1|${framed}`)
    .digest('base64url')}`;
}

function createPilotRoundContinuationId(input) {
  const receiptId = requirePattern(
    input.receiptId,
    RECEIPT_PATTERN,
    'receiptId',
  );
  return `prc_${crypto
    .createHash('sha256')
    .update(receiptId)
    .digest('hex')}`;
}

function createPilotRoundContinuationRecord(input) {
  return {
    schema_version: PILOT_ROUND_RECORD_SCHEMA,
    account_key: requirePattern(
      input.accountKey,
      /^[a-f0-9]{64}$/,
      'accountKey',
    ),
    pilot_id: requirePattern(
      input.pilotId,
      IDENTIFIER_PATTERN,
      'pilotId',
    ),
    content_version: requirePattern(
      input.contentVersion,
      CONTENT_VERSION_PATTERN,
      'contentVersion',
    ),
    completed_count: requireBoundary(input.completedCount),
    receipt_id: requirePattern(
      input.receiptId,
      RECEIPT_PATTERN,
      'receiptId',
    ),
    acknowledged_at: canonicalTimestamp(input.acknowledgedAt),
  };
}

function normalizePilotRoundContinuationRecord(value, expected = {}) {
  if (!isObject(value)) return null;
  assertExactKeys(value, [
    'schema_version',
    'account_key',
    'pilot_id',
    'content_version',
    'completed_count',
    'receipt_id',
    'acknowledged_at',
  ]);
  const record = createPilotRoundContinuationRecord({
    acknowledgedAt: value.acknowledged_at,
    accountKey: value.account_key,
    completedCount: value.completed_count,
    contentVersion: value.content_version,
    pilotId: value.pilot_id,
    receiptId: value.receipt_id,
  });
  if (value.schema_version !== PILOT_ROUND_RECORD_SCHEMA) {
    throw new Error('Pilot round continuation schema is invalid.');
  }
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (expectedValue !== undefined && record[field] !== expectedValue) {
      throw new Error(`Pilot round continuation ${field} does not match.`);
    }
  }
  const derivedReceipt = createPilotRoundReceipt({
    accountKey: record.account_key,
    completedCount: record.completed_count,
    contentVersion: record.content_version,
    pilotId: record.pilot_id,
  });
  if (record.receipt_id !== derivedReceipt) {
    throw new Error('Pilot round continuation receipt is invalid.');
  }
  return record;
}

function normalizeContinueCommand(value) {
  if (!isObject(value)) {
    throw pilotRoundError(400, 'invalid_pilot_round_command', 'A JSON command is required.');
  }
  try {
    assertExactKeys(value, [
      'schema_version',
      'track',
      'content_version',
      'receipt_id',
      'completed_count',
    ]);
    if (value.schema_version !== PILOT_ROUND_CONTINUE_SCHEMA) {
      throw new Error('schema_version is invalid');
    }
    if (value.track !== 'cet4') throw new Error('track is invalid');
    return {
      schema_version: PILOT_ROUND_CONTINUE_SCHEMA,
      track: 'cet4',
      content_version: requirePattern(
        value.content_version,
        CONTENT_VERSION_PATTERN,
        'content_version',
      ),
      receipt_id: requirePattern(
        value.receipt_id,
        RECEIPT_PATTERN,
        'receipt_id',
      ),
      completed_count: requireBoundary(value.completed_count),
    };
  } catch (error) {
    throw pilotRoundError(400, 'invalid_pilot_round_command', error.message);
  }
}

function requireActivePilotRelease(cardSource, runtimeMode, command, nowIso) {
  const release = cardSource?.release;
  if (
    !isContentReleaseValidForRuntime(cardSource, runtimeMode, new Date(nowIso)) ||
    release?.schema_version !== 'pilot-content-release.v1' ||
    release?.runtime_mode !== 'controlled_pilot' ||
    release?.release_class !== 'controlled_pilot' ||
    release?.track !== 'cet4' ||
    release?.content_version !== command.content_version ||
    cardSource?.content_version !== command.content_version
  ) {
    throw pilotRoundError(
      409,
      'pilot_round_release_mismatch',
      'The command does not match the active controlled-pilot release.',
    );
  }
  requirePattern(release.pilot_id, IDENTIFIER_PATTERN, 'release.pilot_id');
  return release;
}

function canonicalCompletedCount(learningState) {
  if (!isObject(learningState) || learningState.projection_version !== 'learning-events.v2') {
    throw pilotRoundError(
      409,
      'pilot_round_projection_unavailable',
      'The canonical learning projection is unavailable.',
    );
  }
  return maximumLearningServerSequence(learningState.events_by_card_id ?? {});
}

function maximumLearningServerSequence(eventsByCardId) {
  if (!isObject(eventsByCardId)) {
    throw new Error('Learning projection events are invalid.');
  }
  let maximum = 0;
  for (const event of Object.values(eventsByCardId)) {
    if (
      !isObject(event) ||
      !Number.isSafeInteger(event.server_sequence) ||
      event.server_sequence < 0
    ) {
      throw new Error('Learning projection event sequence is invalid.');
    }
    maximum = Math.max(maximum, event.server_sequence);
  }
  return maximum;
}

function isRoundBoundary(value) {
  return Number.isSafeInteger(value) && value > 0 && value % ROUND_SIZE === 0;
}

function requireBoundary(value) {
  if (!isRoundBoundary(value)) {
    throw new Error('completed_count must be a positive multiple of five');
  }
  return value;
}

function validateConfig(config) {
  if (
    typeof config.now !== 'function' ||
    !['development', 'production', 'controlled_pilot'].includes(config.runtimeMode) ||
    typeof config.store?.getCardSource !== 'function' ||
    typeof config.store?.getLearningState !== 'function' ||
    typeof config.store?.getPilotRoundContinuation !== 'function' ||
    typeof config.store?.commitPilotRoundContinuation !== 'function'
  ) {
    throw new Error('Pilot round service configuration is invalid.');
  }
}

function assertExactKeys(value, keys) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error('Pilot round object fields are invalid.');
  }
}

function requirePattern(value, pattern, label) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function canonicalTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Pilot round clock is invalid.');
  return date.toISOString();
}

function chinaActivityDay(timestamp) {
  return new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pilotRoundError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

module.exports = {
  PILOT_ROUND_ACK_SCHEMA,
  PILOT_ROUND_COMPLETION_SCHEMA,
  PILOT_ROUND_CONTINUE_SCHEMA,
  PILOT_ROUND_RECORD_SCHEMA,
  ROUND_SIZE,
  canonicalCompletedCount,
  createPilotRoundCompletion,
  createPilotRoundContinuationId,
  createPilotRoundContinuationRecord,
  createPilotRoundReceipt,
  createPilotRoundV1Service,
  isRoundBoundary,
  normalizePilotRoundContinuationRecord,
};
