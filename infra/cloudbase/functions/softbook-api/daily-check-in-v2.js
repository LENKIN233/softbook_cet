const RESPONSE_SCHEMA_VERSION = 'daily-check-in.v2';

function createDailyCheckInV2Service(options) {
  if (
    !options ||
    typeof options.now !== 'function' ||
    !options.store ||
    typeof options.store.checkInDailyProgress !== 'function'
  ) {
    throw new Error('Daily check-in v2 requires now and store.');
  }

  return {
    checkIn: async ({request, session}) => {
      const command = parseDailyCheckInCommand(request.body);
      const canonical = await options.store.checkInDailyProgress(
        session.phoneNumber,
        command.day_key,
        options.now().toISOString(),
        {accountKey: session.accountKey},
      );

      return serializeDailyCheckIn(canonical, command.day_key);
    },
  };
}

function parseDailyCheckInCommand(body) {
  if (!isObject(body)) {
    throw invalidCommand('request body must be an object.');
  }

  assertExactKeys(body, ['day_key'], 'request body');

  return {
    day_key: requireDayKey(body.day_key),
  };
}

function serializeDailyCheckIn(value, expectedDayKey) {
  if (
    !isObject(value) ||
    value.day_key !== expectedDayKey ||
    value.checked_in_today !== true ||
    typeof value.acknowledged_at !== 'string' ||
    !Number.isFinite(Date.parse(value.acknowledged_at))
  ) {
    throw invalidStoredState('The canonical daily check-in is invalid.');
  }

  return {
    schema_version: RESPONSE_SCHEMA_VERSION,
    acknowledged_at: value.acknowledged_at,
    checked_in_today: true,
    day_key: value.day_key,
  };
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

function requireDayKey(value) {
  if (typeof value !== 'string' || !isValidDayKey(value)) {
    throw invalidCommand('day_key must be a valid YYYY-MM-DD calendar date.');
  }

  return value;
}

function isValidDayKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function invalidCommand(message) {
  const error = new Error(message);
  error.code = 'invalid_daily_check_in';
  error.statusCode = 400;
  return error;
}

function invalidStoredState(message) {
  const error = new Error(message);
  error.code = 'invalid_stored_state';
  error.statusCode = 500;
  return error;
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

module.exports = {
  createDailyCheckInV2Service,
  parseDailyCheckInCommand,
};
