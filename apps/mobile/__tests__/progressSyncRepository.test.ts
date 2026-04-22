import {
  createDailyProgressSnapshot,
  createProgressSyncRepository,
} from '../src/sync/progressSyncRepository';

test('daily progress snapshot derives a total completed count', () => {
  expect(
    createDailyProgressSnapshot({
      checkedInToday: false,
      dayKey: '2026-04-22',
      favoriteCount: 2,
      learningCompletedCount: 3,
      pendingReviewCount: 1,
      reviewCompletedCount: 2,
      sleepingCount: 1,
    }),
  ).toMatchObject({
    dayKey: '2026-04-22',
    totalCompletedCount: 5,
  });
});

test('local progress sync repository acknowledges a snapshot without fetch', async () => {
  const repository = createProgressSyncRepository({
    mode: 'local',
  });

  const result = await repository.syncDailyProgress(
    createDailyProgressSnapshot({
      checkedInToday: true,
      dayKey: '2026-04-22',
      favoriteCount: 1,
      learningCompletedCount: 2,
      pendingReviewCount: 0,
      reviewCompletedCount: 1,
      sleepingCount: 0,
    }),
  );

  expect(result.mode).toBe('local');
  expect(typeof result.acknowledgedAt).toBe('string');
});

test('remote progress sync repository posts the day snapshot to the configured endpoint', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
  });
  const repository = createProgressSyncRepository({
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://example.com/v1/progress/daily-sync',
      headers: {
        Authorization: 'Bearer test-key',
      },
    },
    fetchImpl: fetchMock,
  });

  const snapshot = createDailyProgressSnapshot({
    checkedInToday: true,
    dayKey: '2026-04-22',
    favoriteCount: 3,
    learningCompletedCount: 4,
    pendingReviewCount: 1,
    reviewCompletedCount: 2,
    sleepingCount: 1,
  });

  const result = await repository.syncDailyProgress(snapshot);

  expect(result.mode).toBe('remote');
  expect(fetchMock).toHaveBeenCalledWith(
    'https://example.com/v1/progress/daily-sync',
    expect.objectContaining({
      method: 'POST',
    }),
  );
});
