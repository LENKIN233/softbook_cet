import {
  createDailyProgressSnapshot,
  createProgressSyncRepository,
} from '../src/sync/progressSyncRepository';

const authenticatedContext = {
  authToken: 'user-token',
  phoneNumber: '13800138000',
};

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
    authenticatedContext,
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
        'x-api-key': 'test-key',
        'x-softbook-client': 'mobile',
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

  const result = await repository.syncDailyProgress(authenticatedContext, snapshot);

  expect(result.mode).toBe('remote');
  expect(fetchMock).toHaveBeenCalledWith(
    'https://example.com/v1/progress/daily-sync',
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer user-token',
      }),
      method: 'POST',
    }),
  );
});

test('remote progress sync repository requires auth token', async () => {
  const repository = createProgressSyncRepository({
    fetchImpl: jest.fn(),
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://example.com/v1/progress/daily-sync',
    },
  });

  await expect(
    repository.syncDailyProgress(
      {
        phoneNumber: '13800138000',
      },
      createDailyProgressSnapshot({
        checkedInToday: true,
        dayKey: '2026-04-22',
        favoriteCount: 0,
        learningCompletedCount: 1,
        pendingReviewCount: 0,
        reviewCompletedCount: 0,
        sleepingCount: 0,
      }),
    ),
  ).rejects.toThrow('Remote progress sync requires authToken.');
});
