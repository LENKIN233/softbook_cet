const crypto = require('node:crypto');

const REQUEST_SCHEMA_VERSION = 'space-actions.v2';
const RESPONSE_SCHEMA_VERSION = 'space-actions-ack.v2';
const STATE_SCHEMA_VERSION = 'space-state.v2';
const LEDGER_SCHEMA_VERSION = 'space-action-ledger.v2';
const DEFAULT_BATCH_LIMIT = 20;
const DEFAULT_FUTURE_SKEW_SECONDS = 5 * 60;
const TRACKS = ['cet4', 'cet6'];
const DIMENSIONS = ['favorite', 'sleep'];
const RESULT_STATUSES = ['applied', 'duplicate', 'stale'];
const ACTION_KEYS = [
  'action_id',
  'card_id',
  'client_occurred_at',
  'dimension',
  'value',
];
const STATE_KEYS = [
  'account_key',
  'acknowledged_at',
  'schema_version',
  'states_by_card_id',
];
const STATE_ITEM_KEYS = [
  'card_id',
  'favorite_action_id',
  'favorite_changed_at',
  'is_favorited',
  'is_sleeping',
  'sleep_action_id',
  'sleep_changed_at',
];
const LEDGER_KEYS = [
  'account_key',
  'acknowledged_at',
  'action',
  'action_digest',
  'action_id',
  'result',
  'schema_version',
];

function createSpaceActionsV2Service(options) {
  const config = {
    batchLimit: DEFAULT_BATCH_LIMIT,
    futureSkewSeconds: DEFAULT_FUTURE_SKEW_SECONDS,
    now: options.now,
    runtimeMode: options.runtimeMode,
    store: options.store,
  };
  validateServiceConfig(config);

  return {
    submit: async ({request, session}) => {
      const now = requireValidDate(config.now(), 'space action clock');
      const command = parseSpaceActionsCommand(request.body, {
        batchLimit: config.batchLimit,
        futureBoundary: new Date(
          now.getTime() + config.futureSkewSeconds * 1000,
        ),
      });
      const cardSource = await config.store.getCardSource(command.track, {
        allowDevelopmentDefault: config.runtimeMode !== 'production',
      });
      assertCardSourceAuthority(
        cardSource,
        command,
        config.runtimeMode,
      );
      const commit = await config.store.commitSpaceActions({
        acknowledgedAt: now.toISOString(),
        accountKey: session.accountKey,
        actions: command.actions,
        phoneNumber: session.phoneNumber,
      });

      return serializeSpaceActionsAck({
        acknowledgedAt: now.toISOString(),
        cardIds: new Set(cardSource.card_records.map(card => card.card_id)),
        commit,
        contentVersion: command.content_version,
        inputActions: command.actions,
        track: command.track,
      });
    },
  };
}

function parseSpaceActionsCommand(body, options = {}) {
  if (!isObject(body)) {
    throw invalidCommand('request body must be an object.');
  }

  assertExactKeys(
    body,
    ['actions', 'content_version', 'schema_version', 'track'],
    'request body',
  );

  if (body.schema_version !== REQUEST_SCHEMA_VERSION) {
    throw invalidCommand(
      `schema_version must be ${REQUEST_SCHEMA_VERSION}.`,
    );
  }

  const track = requireEnum(body.track, TRACKS, 'track');
  const contentVersion = requireContentVersion(body.content_version);
  const batchLimit = options.batchLimit ?? DEFAULT_BATCH_LIMIT;

  if (
    !Array.isArray(body.actions) ||
    body.actions.length === 0 ||
    body.actions.length > batchLimit
  ) {
    throw invalidCommand(`actions must contain 1-${batchLimit} items.`);
  }

  const actionIds = new Set();
  const actions = body.actions.map((value, index) => {
    const label = `actions[${index}]`;

    if (!isObject(value)) {
      throw invalidCommand(`${label} must be an object.`);
    }

    assertExactKeys(value, ACTION_KEYS, label);
    const action = {
      action_id: requireOpaqueId(value.action_id, `${label}.action_id`),
      card_id: requireOpaqueId(value.card_id, `${label}.card_id`),
      client_occurred_at: requireIsoTimestamp(
        value.client_occurred_at,
        `${label}.client_occurred_at`,
      ),
      dimension: requireEnum(
        value.dimension,
        DIMENSIONS,
        `${label}.dimension`,
      ),
      value: requireBoolean(value.value, `${label}.value`),
    };

    if (actionIds.has(action.action_id)) {
      throw invalidCommand('action_id must be unique inside one batch.');
    }

    actionIds.add(action.action_id);

    if (
      options.futureBoundary &&
      Date.parse(action.client_occurred_at) > options.futureBoundary.getTime()
    ) {
      throw invalidCommand(
        `${label}.client_occurred_at is too far in the future.`,
      );
    }

    return action;
  });

  return {
    actions,
    content_version: contentVersion,
    schema_version: REQUEST_SCHEMA_VERSION,
    track,
  };
}

function assertCardSourceAuthority(cardSource, command, runtimeMode) {
  if (
    !isObject(cardSource) ||
    cardSource.track !== command.track ||
    cardSource.content_version !== command.content_version ||
    !Array.isArray(cardSource.card_records)
  ) {
    throw httpError(
      409,
      'space_content_version_mismatch',
      'Physical-space actions must match the current card source.',
    );
  }

  if (
    runtimeMode === 'production' &&
    (cardSource.release === null || cardSource.release === undefined)
  ) {
    throw httpError(
      503,
      'content_release_unavailable',
      'A matching published content release is required.',
    );
  }

  const cardIds = new Set(
    cardSource.card_records.map(card => {
      if (!isObject(card) || typeof card.card_id !== 'string') {
        throw httpError(
          500,
          'invalid_card_source',
          'The current card source is invalid.',
        );
      }
      return card.card_id;
    }),
  );

  for (const action of command.actions) {
    if (!cardIds.has(action.card_id)) {
      throw httpError(
        409,
        'space_card_not_in_content',
        'Physical-space actions must reference the current card source.',
      );
    }
  }
}

function createEmptySpaceState(accountKey) {
  return {
    account_key: requireAccountKey(accountKey),
    acknowledged_at: null,
    schema_version: STATE_SCHEMA_VERSION,
    states_by_card_id: {},
  };
}

function normalizeStoredSpaceState(value, expectedAccountKey) {
  if (value === null || value === undefined) {
    return createEmptySpaceState(expectedAccountKey);
  }

  const stored = stripCloudBaseSystemId(value);
  assertExactStoredKeys(stored, STATE_KEYS, 'canonical space state');

  if (
    stored.schema_version !== STATE_SCHEMA_VERSION ||
    stored.account_key !== expectedAccountKey
  ) {
    throw invalidStoredState('The canonical physical-space state is invalid.');
  }

  const acknowledgedAt =
    stored.acknowledged_at === null
      ? null
      : requireStoredIsoTimestamp(
          stored.acknowledged_at,
          'canonical space state.acknowledged_at',
        );
  const statesByCardId = requireStoredObject(
    stored.states_by_card_id,
    'canonical space state.states_by_card_id',
  );
  const normalizedStates = {};

  for (const [storedCardId, valueItem] of Object.entries(statesByCardId)) {
    const label = `canonical space state.states_by_card_id.${storedCardId}`;
    const item = requireStoredObject(valueItem, label);
    assertExactStoredKeys(item, STATE_ITEM_KEYS, label);
    const cardId = requireStoredOpaqueId(item.card_id, `${label}.card_id`);

    if (cardId !== storedCardId) {
      throw invalidStoredState(
        'The canonical physical-space card key is invalid.',
      );
    }

    const favorite = normalizeStoredDimension(item, 'favorite', label);
    const sleep = normalizeStoredDimension(item, 'sleep', label);

    if (
      favorite.changedAt === null &&
      sleep.changedAt === null
    ) {
      throw invalidStoredState(
        'A canonical physical-space item has no action authority.',
      );
    }

    normalizedStates[cardId] = {
      card_id: cardId,
      favorite_action_id: favorite.actionId,
      favorite_changed_at: favorite.changedAt,
      is_favorited: requireStoredBoolean(
        item.is_favorited,
        `${label}.is_favorited`,
      ),
      is_sleeping: requireStoredBoolean(
        item.is_sleeping,
        `${label}.is_sleeping`,
      ),
      sleep_action_id: sleep.actionId,
      sleep_changed_at: sleep.changedAt,
    };
  }

  return {
    account_key: stored.account_key,
    acknowledged_at: acknowledgedAt,
    schema_version: stored.schema_version,
    states_by_card_id: normalizedStates,
  };
}

function normalizeStoredDimension(item, dimension, label) {
  const changedAtField = `${dimension}_changed_at`;
  const actionIdField = `${dimension}_action_id`;
  const changedAt = item[changedAtField];
  const actionId = item[actionIdField];

  if (changedAt === null && actionId === null) {
    return {actionId: null, changedAt: null};
  }

  if (changedAt === null || actionId === null) {
    throw invalidStoredState(
      `${label}.${dimension} action authority is incomplete.`,
    );
  }

  return {
    actionId: requireStoredOpaqueId(actionId, `${label}.${actionIdField}`),
    changedAt: requireStoredIsoTimestamp(
      changedAt,
      `${label}.${changedAtField}`,
    ),
  };
}

function normalizeStoredSpaceAction(value, expectedAccountKey, expectedId) {
  const stored = stripCloudBaseSystemId(value);
  assertExactStoredKeys(stored, LEDGER_KEYS, 'space action ledger');

  if (
    stored.schema_version !== LEDGER_SCHEMA_VERSION ||
    stored.account_key !== expectedAccountKey ||
    stored.action_id !== expectedId
  ) {
    throw invalidStoredState('The physical-space action ledger is invalid.');
  }

  const action = normalizeStoredAction(stored.action);
  const digest = createSpaceActionDigest(action);

  if (
    action.action_id !== expectedId ||
    stored.action_digest !== digest ||
    !['applied', 'stale'].includes(stored.result)
  ) {
    throw invalidStoredState('The physical-space action ledger is invalid.');
  }

  return {
    account_key: stored.account_key,
    acknowledged_at: requireStoredIsoTimestamp(
      stored.acknowledged_at,
      'space action ledger.acknowledged_at',
    ),
    action,
    action_digest: digest,
    action_id: stored.action_id,
    result: stored.result,
    schema_version: stored.schema_version,
  };
}

function normalizeStoredAction(value) {
  const action = requireStoredObject(value, 'space action ledger.action');
  assertExactStoredKeys(action, ACTION_KEYS, 'space action ledger.action');

  return {
    action_id: requireStoredOpaqueId(
      action.action_id,
      'space action ledger.action.action_id',
    ),
    card_id: requireStoredOpaqueId(
      action.card_id,
      'space action ledger.action.card_id',
    ),
    client_occurred_at: requireStoredIsoTimestamp(
      action.client_occurred_at,
      'space action ledger.action.client_occurred_at',
    ),
    dimension: requireStoredEnum(
      action.dimension,
      DIMENSIONS,
      'space action ledger.action.dimension',
    ),
    value: requireStoredBoolean(
      action.value,
      'space action ledger.action.value',
    ),
  };
}

function prepareSpaceActionCommit(input) {
  const state = normalizeStoredSpaceState(input.state, input.accountKey);
  const results = [];
  const ledgers = [];
  let changed = false;

  input.actions.forEach(action => {
    const existingValue = input.ledgerByActionId.get(action.action_id);

    if (existingValue !== null && existingValue !== undefined) {
      const existing = normalizeStoredSpaceAction(
        existingValue,
        input.accountKey,
        action.action_id,
      );

      if (existing.action_digest !== createSpaceActionDigest(action)) {
        throw httpError(
          409,
          'space_action_id_conflict',
          'An action_id cannot be reused with different content.',
        );
      }

      results.push({action_id: action.action_id, status: 'duplicate'});
      return;
    }

    const status = applySpaceAction(state, action);
    const ledger = createSpaceActionLedger({
      acknowledgedAt: input.acknowledgedAt,
      accountKey: input.accountKey,
      action,
      result: status,
    });
    results.push({action_id: action.action_id, status});
    ledgers.push(ledger);
    changed = true;
  });

  if (changed) {
    state.acknowledged_at = requireStoredIsoTimestamp(
      input.acknowledgedAt,
      'space action acknowledgement',
    );
  }

  return {ledgers, results, state};
}

function applySpaceAction(state, action) {
  const current = Object.hasOwn(
    state.states_by_card_id,
    action.card_id,
  )
    ? state.states_by_card_id[action.card_id]
    : {
        card_id: action.card_id,
        favorite_action_id: null,
        favorite_changed_at: null,
        is_favorited: false,
        is_sleeping: false,
        sleep_action_id: null,
        sleep_changed_at: null,
      };
  const changedAtField = `${action.dimension}_changed_at`;
  const actionIdField = `${action.dimension}_action_id`;
  const valueField =
    action.dimension === 'favorite' ? 'is_favorited' : 'is_sleeping';
  const currentChangedAt = current[changedAtField];
  const currentActionId = current[actionIdField];
  const shouldApply =
    currentChangedAt === null ||
    Date.parse(action.client_occurred_at) > Date.parse(currentChangedAt) ||
    (action.client_occurred_at === currentChangedAt &&
      action.action_id.localeCompare(currentActionId) > 0);

  if (!shouldApply) {
    return 'stale';
  }

  state.states_by_card_id[action.card_id] = {
    ...current,
    [actionIdField]: action.action_id,
    [changedAtField]: action.client_occurred_at,
    [valueField]: action.value,
  };
  return 'applied';
}

function createSpaceActionLedger(input) {
  return {
    account_key: input.accountKey,
    acknowledged_at: input.acknowledgedAt,
    action: {...input.action},
    action_digest: createSpaceActionDigest(input.action),
    action_id: input.action.action_id,
    result: input.result,
    schema_version: LEDGER_SCHEMA_VERSION,
  };
}

function migrateLegacySpaceDocuments(
  documents,
  accountKey,
  acknowledgedAt,
) {
  const state = createEmptySpaceState(accountKey);

  for (const document of documents) {
    if (
      !isObject(document) ||
      !isObject(document.states_by_card_id)
    ) {
      continue;
    }

    for (const [storedCardId, value] of Object.entries(
      document.states_by_card_id,
    )) {
      const legacy = normalizeLegacySpaceItem(value, storedCardId);

      for (const dimension of DIMENSIONS) {
        applySpaceAction(state, {
          action_id: createLegacyActionId({
            accountKey,
            cardId: legacy.card_id,
            dimension,
            timestamp: legacy.last_modified_at,
            value:
              dimension === 'favorite'
                ? legacy.is_favorited
                : legacy.is_sleeping,
          }),
          card_id: legacy.card_id,
          client_occurred_at: legacy.last_modified_at,
          dimension,
          value:
            dimension === 'favorite'
              ? legacy.is_favorited
              : legacy.is_sleeping,
        });
      }
    }
  }

  if (Object.keys(state.states_by_card_id).length > 0) {
    state.acknowledged_at = requireStoredIsoTimestamp(
      acknowledgedAt,
      'space migration acknowledgement',
    );
  }

  return state;
}

function normalizeLegacySpaceItem(value, storedCardId) {
  if (!isObject(value)) {
    throw invalidStoredState('A legacy physical-space item is invalid.');
  }

  const cardId = requireStoredOpaqueId(
    value.card_id,
    'legacy space state.card_id',
  );

  if (cardId !== storedCardId) {
    throw invalidStoredState('A legacy physical-space card key is invalid.');
  }

  return {
    card_id: cardId,
    is_favorited: requireStoredBoolean(
      value.is_favorited,
      'legacy space state.is_favorited',
    ),
    is_sleeping: requireStoredBoolean(
      value.is_sleeping,
      'legacy space state.is_sleeping',
    ),
    last_modified_at: requireStoredIsoTimestamp(
      value.last_modified_at,
      'legacy space state.last_modified_at',
    ),
  };
}

function serializeSpaceState(stateValue, input) {
  const state = normalizeStoredSpaceState(stateValue, input.accountKey);
  const states = Object.values(state.states_by_card_id)
    .filter(item => input.cardIds.has(item.card_id))
    .map(item => ({
      card_id: item.card_id,
      is_favorited: item.is_favorited,
      is_sleeping: item.is_sleeping,
      last_modified_at: maximumTimestamp(
        item.favorite_changed_at,
        item.sleep_changed_at,
      ),
    }))
    .sort((left, right) => left.card_id.localeCompare(right.card_id));

  return {
    schema_version: STATE_SCHEMA_VERSION,
    acknowledged_at: state.acknowledged_at,
    track: input.track,
    content_version: input.contentVersion,
    states,
  };
}

function serializeSpaceActionsAck(input) {
  if (
    !isObject(input.commit) ||
    !Array.isArray(input.commit.results) ||
    input.commit.results.length !== input.inputActions.length
  ) {
    throw invalidStoredState('The physical-space action result is invalid.');
  }

  const results = input.commit.results.map((result, index) => {
    const expectedActionId = input.inputActions[index].action_id;

    if (
      !isObject(result) ||
      result.action_id !== expectedActionId ||
      !RESULT_STATUSES.includes(result.status)
    ) {
      throw invalidStoredState(
        'The physical-space action result is invalid.',
      );
    }

    return {
      action_id: expectedActionId,
      status: result.status,
    };
  });

  return {
    schema_version: RESPONSE_SCHEMA_VERSION,
    acknowledged_at: input.acknowledgedAt,
    track: input.track,
    content_version: input.contentVersion,
    results,
    space_state: serializeSpaceState(input.commit.state, {
      accountKey: input.commit.state.account_key,
      cardIds: input.cardIds,
      contentVersion: input.contentVersion,
      track: input.track,
    }),
  };
}

function createSpaceActionLedgerId(accountKey, actionId) {
  return crypto
    .createHash('sha256')
    .update(`${accountKey}\u0000${actionId}`)
    .digest('hex');
}

function createSpaceStateId(accountKey) {
  return crypto
    .createHash('sha256')
    .update(`space-state.v2\u0000${accountKey}`)
    .digest('hex');
}

function createSpaceActionDigest(action) {
  return crypto
    .createHash('sha256')
    .update(stableJsonStringify(action))
    .digest('hex');
}

function createLegacyActionId(input) {
  const digest = crypto
    .createHash('sha256')
    .update(stableJsonStringify(input))
    .digest('hex');
  return `legacy_${digest}`;
}

function maximumTimestamp(left, right) {
  if (left === null) {
    return right;
  }

  if (right === null) {
    return left;
  }

  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function cloneSpaceState(value) {
  return {
    ...value,
    states_by_card_id: Object.fromEntries(
      Object.entries(value.states_by_card_id ?? {}).map(([cardId, state]) => [
        cardId,
        {...state},
      ]),
    ),
  };
}

function validateServiceConfig(config) {
  if (
    !Number.isSafeInteger(config.batchLimit) ||
    config.batchLimit <= 0 ||
    !Number.isSafeInteger(config.futureSkewSeconds) ||
    config.futureSkewSeconds <= 0 ||
    typeof config.now !== 'function' ||
    !['development', 'production'].includes(config.runtimeMode) ||
    !config.store ||
    typeof config.store.getCardSource !== 'function' ||
    typeof config.store.commitSpaceActions !== 'function'
  ) {
    throw new Error('Space actions v2 requires valid runtime configuration.');
  }
}

function assertExactKeys(value, expectedKeys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();

  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw invalidCommand(
      `${label} must contain exactly: ${expected.join(', ')}.`,
    );
  }
}

function assertExactStoredKeys(value, expectedKeys, label) {
  if (!isObject(value)) {
    throw invalidStoredState(`${label} must be an object.`);
  }

  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();

  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw invalidStoredState(`${label} has unexpected fields.`);
  }
}

function stripCloudBaseSystemId(value) {
  if (!isObject(value)) {
    throw invalidStoredState('Stored physical-space data must be an object.');
  }

  if (!Object.hasOwn(value, '_id')) {
    return value;
  }

  const normalized = {...value};
  delete normalized._id;
  return normalized;
}

function requireOpaqueId(value, label) {
  if (
    typeof value !== 'string' ||
    !/^[0-9A-Za-z][0-9A-Za-z._:-]{0,127}$/.test(value)
  ) {
    throw invalidCommand(`${label} must be a valid opaque identifier.`);
  }

  return value;
}

function requireStoredOpaqueId(value, label) {
  try {
    return requireOpaqueId(value, label);
  } catch {
    throw invalidStoredState(`${label} is invalid.`);
  }
}

function requireContentVersion(value) {
  if (
    typeof value !== 'string' ||
    !/^sha256:[0-9a-f]{64}$/.test(value)
  ) {
    throw invalidCommand(
      'content_version must be a normalized SHA-256 version.',
    );
  }

  return value;
}

function requireIsoTimestamp(value, label) {
  if (
    typeof value !== 'string' ||
    !isValidRfc3339Timestamp(value)
  ) {
    throw invalidCommand(`${label} must be an RFC3339 timestamp.`);
  }

  return new Date(value).toISOString();
}

function isValidRfc3339Timestamp(value) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );

  if (!match) {
    return false;
  }

  const [, year, month, day, hour, minute, second, zone] = match;
  const calendarDate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  const offset =
    zone === 'Z' ? [0, 0] : zone.slice(1).split(':').map(Number);

  return (
    calendarDate.getUTCFullYear() === Number(year) &&
    calendarDate.getUTCMonth() + 1 === Number(month) &&
    calendarDate.getUTCDate() === Number(day) &&
    Number(hour) <= 23 &&
    Number(minute) <= 59 &&
    Number(second) <= 59 &&
    offset[0] <= 23 &&
    offset[1] <= 59 &&
    Number.isFinite(Date.parse(value))
  );
}

function requireStoredIsoTimestamp(value, label) {
  try {
    return requireIsoTimestamp(value, label);
  } catch {
    throw invalidStoredState(`${label} is invalid.`);
  }
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw invalidCommand(`${label} must be boolean.`);
  }

  return value;
}

function requireStoredBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw invalidStoredState(`${label} must be boolean.`);
  }

  return value;
}

function requireEnum(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw invalidCommand(`${label} must be one of: ${allowed.join(', ')}.`);
  }

  return value;
}

function requireStoredEnum(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw invalidStoredState(`${label} is invalid.`);
  }

  return value;
}

function requireAccountKey(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw invalidStoredState('The physical-space account key is invalid.');
  }

  return value;
}

function requireStoredObject(value, label) {
  if (!isObject(value)) {
    throw invalidStoredState(`${label} must be an object.`);
  }

  return value;
}

function requireValidDate(value, label) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error(`${label} must be a valid Date.`);
  }

  return value;
}

function stableJsonStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJsonStringify).join(',')}]`;
  }

  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(
        key =>
          `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`,
      )
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function invalidCommand(message) {
  return httpError(400, 'invalid_space_actions', message);
}

function invalidStoredState(message) {
  return httpError(500, 'space_state_invalid', message);
}

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

module.exports = {
  cloneSpaceState,
  createEmptySpaceState,
  createSpaceActionLedgerId,
  createSpaceActionsV2Service,
  createSpaceStateId,
  migrateLegacySpaceDocuments,
  normalizeStoredSpaceAction,
  normalizeStoredSpaceState,
  parseSpaceActionsCommand,
  prepareSpaceActionCommit,
  serializeSpaceState,
};
