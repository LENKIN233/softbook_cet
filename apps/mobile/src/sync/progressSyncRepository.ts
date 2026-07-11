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
  syncDailyProgress: (
    context: ProgressSyncContext,
    snapshot: DailyProgressSnapshot,
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
    syncDailyProgress: async (context, snapshot) => {
      const acknowledgedAt = new Date().toISOString();

      if (config.mode === 'remote') {
        if (!config.remoteConfig) {
          throw new Error('Remote progress sync requires remoteConfig.');
        }

        const fetchImpl = config.fetchImpl ?? fetch;
        const response = await fetchImpl(config.remoteConfig.endpoint, {
          body: JSON.stringify({
            checked_in_today: snapshot.checkedInToday,
            day_key: snapshot.dayKey,
            favorite_count: snapshot.favoriteCount,
            learning_completed_count: snapshot.learningCompletedCount,
            pending_review_count: snapshot.pendingReviewCount,
            phone_number: context.phoneNumber,
            review_completed_count: snapshot.reviewCompletedCount,
            sleeping_count: snapshot.sleepingCount,
            total_completed_count: snapshot.totalCompletedCount,
          }),
          headers: buildRemoteProgressSyncHeaders(config.remoteConfig, context),
          method: 'POST',
        });

        if (!response.ok) {
          throw new RemoteHttpError(
            `Remote progress sync failed with ${response.status}.`,
            response.status,
          );
        }

        return {
          acknowledgedAt,
          mode: 'remote',
        };
      }

      return {
        acknowledgedAt,
        mode: 'local',
      };
    },
  };
}

function buildRemoteProgressSyncHeaders(
  config: ProgressSyncRemoteConfig,
  context: ProgressSyncContext,
) {
  if (!context.authToken) {
    throw new RemoteHttpError('Remote progress sync requires authToken.', 401);
  }

  return {
    'content-type': 'application/json',
    Authorization: `Bearer ${context.authToken}`,
    ...config.headers,
  };
}
