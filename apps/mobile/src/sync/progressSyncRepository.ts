import {RemoteHttpError} from '../runtime/remoteHttpError';

export type ProgressSyncRepositoryMode = 'local' | 'remote';

export type DailyProgressSnapshot = {
  checkedInToday: boolean;
  dayKey: string;
  favoriteCount: number;
  learningCompletedCount: number;
  pendingReviewCount: number;
  reviewCompletedCount: number;
  sleepingCount: number;
  totalCompletedCount: number;
};

export type ProgressSyncResult = {
  acknowledgedAt: string;
  checkedInToday: true;
  dayKey: string;
  mode: ProgressSyncRepositoryMode;
};

export type ProgressSyncContext = {
  authToken?: string;
  phoneNumber: string;
};

export type ProgressSyncRemoteConfig = {
  endpoint: string;
  headers?: Record<string, string>;
};

export type FetchLike = typeof fetch;

export type ProgressSyncRepository = {
  checkIn: (
    context: ProgressSyncContext,
    dayKey: string,
  ) => Promise<ProgressSyncResult>;
};

export type ProgressSyncRepositoryConfig = {
  fetchImpl?: FetchLike;
  mode: ProgressSyncRepositoryMode;
  remoteConfig?: ProgressSyncRemoteConfig;
};

export function createDailyProgressSnapshot(input: {
  checkedInToday: boolean;
  dayKey: string;
  favoriteCount: number;
  learningCompletedCount: number;
  pendingReviewCount: number;
  reviewCompletedCount: number;
  sleepingCount: number;
}): DailyProgressSnapshot {
  return {
    ...input,
    totalCompletedCount: input.learningCompletedCount + input.reviewCompletedCount,
  };
}

export function createProgressSyncRepository(
  config: ProgressSyncRepositoryConfig,
): ProgressSyncRepository {
  return {
    checkIn: async (context, dayKey) => {
      assertDayKey(dayKey, 'check-in dayKey');
      const acknowledgedAt = new Date().toISOString();

      if (config.mode === 'remote') {
        if (!config.remoteConfig) {
          throw new Error('Remote daily check-in requires remoteConfig.');
        }

        const fetchImpl = config.fetchImpl ?? fetch;
        const response = await fetchImpl(config.remoteConfig.endpoint, {
          body: JSON.stringify({
            day_key: dayKey,
          }),
          headers: buildRemoteProgressSyncHeaders(config.remoteConfig, context),
          method: 'POST',
        });

        if (!response.ok) {
          throw new RemoteHttpError(
            `Remote daily check-in failed with ${response.status}.`,
            response.status,
          );
        }

        return parseRemoteDailyCheckIn(
          await response.json(),
          dayKey,
          'remote',
        );
      }

      return {
        acknowledgedAt,
        checkedInToday: true,
        dayKey,
        mode: 'local',
      };
    },
  };
}

export function parseRemoteDailyCheckIn(
  payload: unknown,
  expectedDayKey: string,
  mode: ProgressSyncRepositoryMode = 'remote',
): ProgressSyncResult {
  assertDayKey(expectedDayKey, 'expected check-in dayKey');
  const envelope = requireExactObject(payload, ['data'], 'check-in payload');
  const data = requireExactObject(
    envelope.data,
    ['acknowledged_at', 'checked_in_today', 'day_key', 'schema_version'],
    'check-in payload.data',
  );

  if (data.schema_version !== 'daily-check-in.v2') {
    throw new Error(
      'Remote check-in payload.data.schema_version must be daily-check-in.v2.',
    );
  }

  if (data.day_key !== expectedDayKey) {
    throw new Error('Remote check-in response day_key must match the request.');
  }

  if (data.checked_in_today !== true) {
    throw new Error(
      'Remote check-in payload.data.checked_in_today must be true.',
    );
  }

  if (
    typeof data.acknowledged_at !== 'string' ||
    !Number.isFinite(Date.parse(data.acknowledged_at))
  ) {
    throw new Error(
      'Remote check-in payload.data.acknowledged_at must be an ISO timestamp.',
    );
  }

  return {
    acknowledgedAt: data.acknowledged_at,
    checkedInToday: true,
    dayKey: expectedDayKey,
    mode,
  };
}

function buildRemoteProgressSyncHeaders(
  config: ProgressSyncRemoteConfig,
  context: ProgressSyncContext,
) {
  if (!context.authToken) {
    throw new RemoteHttpError('Remote daily check-in requires authToken.', 401);
  }

  return {
    'content-type': 'application/json',
    Authorization: `Bearer ${context.authToken}`,
    ...config.headers,
  };
}

function requireExactObject(
  value: unknown,
  expectedKeys: string[],
  label: string,
): Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error(`${label} must be an object.`);
  }

  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();

  if (
    actualKeys.length !== sortedExpectedKeys.length ||
    actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
  ) {
    throw new Error(
      `${label} must contain exactly: ${sortedExpectedKeys.join(', ')}.`,
    );
  }

  return value;
}

function assertDayKey(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD.`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${label} must be a valid calendar date.`);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
