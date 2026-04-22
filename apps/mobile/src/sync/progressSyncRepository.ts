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

export type ProgressSyncRemoteConfig = {
  endpoint: string;
  headers?: Record<string, string>;
};

export type FetchLike = typeof fetch;

export type ProgressSyncRepository = {
  syncDailyProgress: (
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
    syncDailyProgress: async snapshot => {
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
            review_completed_count: snapshot.reviewCompletedCount,
            sleeping_count: snapshot.sleepingCount,
            total_completed_count: snapshot.totalCompletedCount,
          }),
          headers: {
            'content-type': 'application/json',
            'x-softbook-client': 'mobile',
            ...config.remoteConfig.headers,
          },
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error(
            `Remote progress sync failed with ${response.status}.`,
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
