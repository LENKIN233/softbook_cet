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

test('local progress sync repository acknowledges an explicit check-in without fetch', async () => {
  const repository = createProgressSyncRepository({
    mode: 'local',
  });

  const result = await repository.checkIn(authenticatedContext, '2026-04-22');

  expect(result).toMatchObject({
    checkedInToday: true,
    dayKey: '2026-04-22',
    mode: 'local',
  });
  expect(Date.parse(result.acknowledgedAt)).not.toBeNaN();
});

test('remote progress sync posts only day_key and accepts the strict check-in response', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    json: async () => ({
      data: {
        acknowledged_at: '2026-04-22T12:00:00.000Z',
        checked_in_today: true,
        day_key: '2026-04-22',
        schema_version: 'daily-check-in.v2',
      },
    }),
    ok: true,
    status: 200,
  });
  const repository = createProgressSyncRepository({
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://example.com/v2/progress/check-in',
      headers: {
        'x-api-key': 'test-key',
        'x-softbook-client': 'mobile',
      },
    },
    fetchImpl: fetchMock,
  });

  const result = await repository.checkIn(
    authenticatedContext,
    '2026-04-22',
  );

  expect(result).toEqual({
    acknowledgedAt: '2026-04-22T12:00:00.000Z',
    checkedInToday: true,
    dayKey: '2026-04-22',
    mode: 'remote',
  });
  expect(fetchMock).toHaveBeenCalledWith(
    'https://example.com/v2/progress/check-in',
    expect.objectContaining({
      body: JSON.stringify({day_key: '2026-04-22'}),
      headers: expect.objectContaining({
        Authorization: 'Bearer user-token',
      }),
      method: 'POST',
    }),
  );
});

test.each([
  [
    'an extra envelope field',
    {
      data: {
        acknowledged_at: '2026-04-22T12:00:00.000Z',
        checked_in_today: true,
        day_key: '2026-04-22',
        schema_version: 'daily-check-in.v2',
      },
      metadata: {},
    },
  ],
  [
    'an extra response field',
    {
      data: {
        acknowledged_at: '2026-04-22T12:00:00.000Z',
        checked_in_today: true,
        day_key: '2026-04-22',
        favorite_count: 9,
        schema_version: 'daily-check-in.v2',
      },
    },
  ],
  [
    'a mismatched day',
    {
      data: {
        acknowledged_at: '2026-04-22T12:00:00.000Z',
        checked_in_today: true,
        day_key: '2026-04-21',
        schema_version: 'daily-check-in.v2',
      },
    },
  ],
  [
    'a false acknowledgement',
    {
      data: {
        acknowledged_at: '2026-04-22T12:00:00.000Z',
        checked_in_today: false,
        day_key: '2026-04-22',
        schema_version: 'daily-check-in.v2',
      },
    },
  ],
  [
    'a different schema version',
    {
      data: {
        acknowledged_at: '2026-04-22T12:00:00.000Z',
        checked_in_today: true,
        day_key: '2026-04-22',
        schema_version: 'daily-check-in.v1',
      },
    },
  ],
  [
    'an invalid acknowledgement timestamp',
    {
      data: {
        acknowledged_at: 'not-a-timestamp',
        checked_in_today: true,
        day_key: '2026-04-22',
        schema_version: 'daily-check-in.v2',
      },
    },
  ],
])('remote progress sync rejects %s', async (_label, payload) => {
  const repository = createProgressSyncRepository({
    fetchImpl: jest.fn().mockResolvedValue({
      json: async () => payload,
      ok: true,
      status: 200,
    }),
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://example.com/v2/progress/check-in',
    },
  });

  await expect(
    repository.checkIn(authenticatedContext, '2026-04-22'),
  ).rejects.toThrow();
});

test('remote progress sync requires auth token', async () => {
  const repository = createProgressSyncRepository({
    fetchImpl: jest.fn(),
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://example.com/v2/progress/check-in',
    },
  });

  await expect(
    repository.checkIn({phoneNumber: '13800138000'}, '2026-04-22'),
  ).rejects.toThrow('Remote daily check-in requires authToken.');
});

test('progress sync rejects invalid calendar dates before making a request', async () => {
  const fetchMock = jest.fn();
  const repository = createProgressSyncRepository({
    fetchImpl: fetchMock,
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://example.com/v2/progress/check-in',
    },
  });

  await expect(
    repository.checkIn(authenticatedContext, '2026-02-30'),
  ).rejects.toThrow('valid calendar date');
  expect(fetchMock).not.toHaveBeenCalled();
});
