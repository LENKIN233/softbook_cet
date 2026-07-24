import {
  createInMemoryMutationQueueStorage,
  MAX_MUTATION_RETRIES,
  MutationQueueManager,
} from '../src/sync/mutationQueue';

const createCheckInPayload = () => ({
  context: {
    authToken: 'token-1',
    phoneNumber: '13800138000',
  },
  dayKey: '2026-04-27',
});

const createSpacePayload = (dayKey = '2026-04-27') => ({
  context: {
    authToken: 'token-1',
    phoneNumber: '13800138000',
  },
  snapshot: {
    dayKey,
    states: [],
  },
});

const createLegacyProgressSnapshot = (checkedInToday = true) => ({
  checkedInToday,
  dayKey: '2026-04-27',
  favoriteCount: 1,
  learningCompletedCount: 2,
  pendingReviewCount: 3,
  reviewCompletedCount: 4,
  sleepingCount: 5,
  totalCompletedCount: 6,
});

describe('MutationQueueManager', () => {
  it('enqueues and dequeues mutations in FIFO order', async () => {
    const manager = new MutationQueueManager();

    await manager.enqueue('check_in_daily_progress', createCheckInPayload());
    await manager.enqueue('refresh_membership', {
      context: {authToken: 'token-2', phoneNumber: '13800138001'},
    });

    const first = await manager.dequeue();
    expect(first?.type).toBe('check_in_daily_progress');

    const second = await manager.dequeue();
    expect(second?.type).toBe('refresh_membership');

    await expect(manager.dequeue()).resolves.toBeUndefined();
  });

  it('persists a counter-free check-in under a deterministic credential-free id', async () => {
    const sharedStore: Record<string, string> = {};
    const storage = createInMemoryMutationQueueStorage(sharedStore);
    const manager = new MutationQueueManager({storage});

    await manager.enqueue(
      'check_in_daily_progress',
      createCheckInPayload(),
      'caller-id-with-token-1',
    );
    await manager.enqueue(
      'refresh_membership',
      {
        context: {authToken: 'token-2', phoneNumber: '13800138001'},
      },
      'membership-1',
    );

    const restoredManager = new MutationQueueManager({storage});
    await expect(restoredManager.size()).resolves.toBe(2);
    await expect(restoredManager.dequeue()).resolves.toEqual(
      expect.objectContaining({
        id: 'check-in:13800138000:2026-04-27',
        payload: {
          context: {phoneNumber: '13800138000'},
          dayKey: '2026-04-27',
        },
        type: 'check_in_daily_progress',
      }),
    );
    expect(JSON.stringify(sharedStore)).not.toContain('token-1');
    expect(JSON.stringify(sharedStore)).not.toContain('token-2');
    expect(JSON.stringify(sharedStore)).not.toMatch(
      /favoriteCount|learningCompletedCount|totalCompletedCount/,
    );
  });

  it('does not report success or mutate memory when persistence fails', async () => {
    let shouldFail = true;
    const values: Record<string, string> = {};
    const manager = new MutationQueueManager({
      storage: {
        getItem: async key => values[key] ?? null,
        setItem: async (key, value) => {
          if (shouldFail) {
            throw new Error('storage unavailable');
          }
          values[key] = value;
        },
      },
    });

    await expect(
      manager.enqueue('check_in_daily_progress', createCheckInPayload()),
    ).rejects.toThrow('storage unavailable');
    await expect(manager.size()).resolves.toBe(0);

    shouldFail = false;
    await expect(
      manager.enqueue('check_in_daily_progress', createCheckInPayload()),
    ).resolves.toMatchObject({
      id: 'check-in:13800138000:2026-04-27',
    });
    await expect(manager.size()).resolves.toBe(1);
  });

  it('migrates only a valid checked-in legacy snapshot and strips counters and credentials', async () => {
    const sharedStore = {
      __softbook_mutation_queue: JSON.stringify([
        {
          id: 'legacy-entry-with-secret',
          payload: {
            context: {
              accessToken: 'legacy-access',
              authToken: 'legacy-auth',
              phoneNumber: '13800138000',
              refreshToken: 'legacy-refresh',
            },
            snapshot: createLegacyProgressSnapshot(true),
          },
          retryCount: 2,
          timestamp: '2026-07-20T00:00:00.000Z',
          type: 'sync_daily_progress',
        },
        {
          id: 'membership:softbook.legacy-token.signature:restore',
          payload: {
            context: {
              authToken: 'softbook.legacy-token.signature',
              phoneNumber: '13800138000',
            },
          },
          retryCount: 0,
          timestamp: '2026-07-20T00:00:00.000Z',
          type: 'refresh_membership',
        },
        {
          id: 'membership-trial:13800138000',
          payload: {
            context: {phoneNumber: '13800138000'},
            currentState: {stage: 'trial_available'},
          },
          retryCount: 0,
          timestamp: '2026-07-20T00:00:00.000Z',
          type: 'start_membership_trial',
        },
      ]),
    };
    const manager = new MutationQueueManager({
      storage: createInMemoryMutationQueueStorage(sharedStore),
    });

    await manager.hydrate();

    const serialized = sharedStore.__softbook_mutation_queue;
    expect(serialized).not.toMatch(/legacy-(?:access|auth|refresh)/);
    expect(serialized).not.toContain('softbook.legacy-token.signature');
    expect(serialized).not.toMatch(
      /favoriteCount|learningCompletedCount|totalCompletedCount/,
    );
    expect(
      JSON.parse(serialized).map((entry: {id: string}) => entry.id),
    ).toEqual([
      'check-in:13800138000:2026-04-27',
      'membership:replay',
      'membership-trial:replay',
    ]);
    await expect(manager.peek()).resolves.toMatchObject({
      id: 'check-in:13800138000:2026-04-27',
      payload: {
        context: {phoneNumber: '13800138000'},
        dayKey: '2026-04-27',
      },
      retryCount: 2,
      type: 'check_in_daily_progress',
    });
  });

  it('drops unchecked legacy daily snapshots and v1 learning snapshots', async () => {
    const sharedStore = {
      __softbook_mutation_queue: JSON.stringify([
        {
          id: 'learning:legacy-snapshot',
          payload: {
            context: {phoneNumber: '13800138000'},
            snapshot: {
              dayKey: '2026-07-20',
              events: [],
              sourceId: 'legacy-source',
              track: 'cet4',
            },
          },
          retryCount: 2,
          timestamp: '2026-07-20T00:00:00.000Z',
          type: 'sync_learning_state',
        },
        {
          id: 'progress:unchecked',
          payload: {
            context: {phoneNumber: '13800138000'},
            snapshot: createLegacyProgressSnapshot(false),
          },
          retryCount: 0,
          timestamp: '2026-07-20T00:01:00.000Z',
          type: 'sync_daily_progress',
        },
        {
          id: 'progress:partial',
          payload: {
            context: {phoneNumber: '13800138000'},
            snapshot: {
              checkedInToday: true,
              dayKey: '2026-04-27',
            },
          },
          retryCount: 0,
          timestamp: '2026-07-20T00:02:00.000Z',
          type: 'sync_daily_progress',
        },
        {
          id: 'progress:inconsistent-total',
          payload: {
            context: {phoneNumber: '13800138000'},
            snapshot: {
              ...createLegacyProgressSnapshot(true),
              totalCompletedCount: 99,
            },
          },
          retryCount: 0,
          timestamp: '2026-07-20T00:03:00.000Z',
          type: 'sync_daily_progress',
        },
      ]),
    };
    const manager = new MutationQueueManager({
      storage: createInMemoryMutationQueueStorage(sharedStore),
    });

    await manager.hydrate();

    await expect(manager.size()).resolves.toBe(0);
    expect(sharedStore.__softbook_mutation_queue).toBe('[]');
  });

  it('normalizes arbitrary persisted check-in ids from sanitized payload data', async () => {
    const sharedStore = {
      __softbook_mutation_queue: JSON.stringify([
        {
          id: 'check-in:embedded-sensitive-history',
          payload: {
            context: {
              authToken: 'not-persisted',
              phoneNumber: '13800138000',
            },
            dayKey: '2026-04-27',
          },
          retryCount: 0,
          timestamp: '2026-07-20T00:00:00.000Z',
          type: 'check_in_daily_progress',
        },
      ]),
    };
    const manager = new MutationQueueManager({
      storage: createInMemoryMutationQueueStorage(sharedStore),
    });

    await manager.hydrate();

    await expect(manager.peek()).resolves.toMatchObject({
      id: 'check-in:13800138000:2026-04-27',
    });
    expect(sharedStore.__softbook_mutation_queue).not.toContain(
      'embedded-sensitive-history',
    );
    expect(sharedStore.__softbook_mutation_queue).not.toContain('not-persisted');
  });

  it('does not retain caller-owned payload objects after enqueue', async () => {
    const sharedStore: Record<string, string> = {};
    const manager = new MutationQueueManager({
      storage: createInMemoryMutationQueueStorage(sharedStore),
    });
    const payload = createSpacePayload();

    await manager.enqueue('sync_space_state', payload, 'detached-entry');
    Object.assign(payload.snapshot, {accessToken: 'late-injected-token'});
    await manager.incrementRetry('detached-entry');

    expect(JSON.stringify(sharedStore)).not.toContain('late-injected-token');
  });

  it('rejects credential fields outside the account context', async () => {
    const manager = new MutationQueueManager();
    const payload = createSpacePayload();
    Object.assign(payload.snapshot, {refreshToken: 'nested-secret'});

    await expect(
      manager.enqueue('sync_space_state', payload),
    ).rejects.toThrow('forbidden credential field');
    await expect(manager.size()).resolves.toBe(0);
  });

  it('rejects invalid check-in calendar dates', async () => {
    const manager = new MutationQueueManager();

    await expect(
      manager.enqueue('check_in_daily_progress', {
        context: {phoneNumber: '13800138000'},
        dayKey: '2026-02-30',
      }),
    ).rejects.toThrow('valid YYYY-MM-DD dayKey');
    await expect(manager.size()).resolves.toBe(0);
  });

  it('persists entries through the default AsyncStorage adapter', async () => {
    const manager = new MutationQueueManager();

    await manager.enqueue('check_in_daily_progress', createCheckInPayload());
    const restoredManager = new MutationQueueManager();

    await expect(restoredManager.size()).resolves.toBe(1);
    await expect(restoredManager.peek()).resolves.toMatchObject({
      id: 'check-in:13800138000:2026-04-27',
      type: 'check_in_daily_progress',
    });
  });

  it('replaces entries with the same id', async () => {
    const manager = new MutationQueueManager();

    await manager.enqueue(
      'sync_space_state',
      createSpacePayload('2026-04-27'),
      'space:current',
    );
    await manager.enqueue(
      'sync_space_state',
      createSpacePayload('2026-04-28'),
      'space:current',
    );

    await expect(manager.size()).resolves.toBe(1);
    await expect(manager.peek()).resolves.toMatchObject({
      id: 'space:current',
      payload: {snapshot: {dayKey: '2026-04-28'}},
    });
  });

  it('does not let an old replay result consume or retry a replacement entry', async () => {
    const manager = new MutationQueueManager({
      now: () => '2026-07-21T00:00:00.000Z',
    });
    await manager.enqueue(
      'sync_space_state',
      createSpacePayload('2026-04-27'),
      'shared-id',
    );
    const replayedEntry = await manager.peek();

    await manager.enqueue(
      'sync_space_state',
      createSpacePayload('2026-04-28'),
      'shared-id',
    );

    await expect(manager.removeIfUnchanged(replayedEntry!)).resolves.toBe(
      false,
    );
    await expect(
      manager.incrementRetryIfUnchanged(replayedEntry!),
    ).resolves.toBe(false);
    await expect(manager.peek()).resolves.toMatchObject({
      payload: {snapshot: {dayKey: '2026-04-28'}},
      retryCount: 0,
    });
  });

  it('keeps entries after reaching retry threshold', async () => {
    const manager = new MutationQueueManager();

    await manager.enqueue(
      'sync_space_state',
      createSpacePayload(),
      'retry-test',
    );

    for (let index = 0; index <= MAX_MUTATION_RETRIES; index += 1) {
      await manager.incrementRetry('retry-test');
    }

    await expect(manager.size()).resolves.toBe(1);
    await expect(manager.peek()).resolves.toMatchObject({
      id: 'retry-test',
      retryCount: MAX_MUTATION_RETRIES + 1,
    });
  });

  it('returns peek without dequeuing', async () => {
    const manager = new MutationQueueManager();

    await manager.enqueue('sync_space_state', createSpacePayload(), 'peek-test');

    await expect(manager.peek()).resolves.toMatchObject({id: 'peek-test'});
    await expect(manager.peek()).resolves.toMatchObject({id: 'peek-test'});
    await expect(manager.size()).resolves.toBe(1);
  });

  it('clears all entries', async () => {
    const manager = new MutationQueueManager();

    await manager.enqueue('check_in_daily_progress', createCheckInPayload());
    await manager.enqueue('refresh_membership', {
      context: {authToken: 'token-2', phoneNumber: '13800138001'},
    });

    await manager.clear();

    await expect(manager.size()).resolves.toBe(0);
    await expect(manager.peek()).resolves.toBeUndefined();
  });

  it('includes timestamp on enqueue', async () => {
    const manager = new MutationQueueManager();
    const before = new Date().getTime();

    await manager.enqueue('check_in_daily_progress', createCheckInPayload());

    const after = new Date().getTime();
    const timestamp = new Date((await manager.peek())!.timestamp).getTime();

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});
