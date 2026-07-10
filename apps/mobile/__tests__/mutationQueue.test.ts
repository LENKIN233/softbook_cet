import {
  createInMemoryMutationQueueStorage,
  MAX_MUTATION_RETRIES,
  MutationQueueManager,
} from '../src/sync/mutationQueue';

const createProgressPayload = () => ({
  context: {
    authToken: 'token-1',
    phoneNumber: '13800138000',
  },
  snapshot: {
    checkedInToday: true,
    dayKey: '2026-04-27',
    favoriteCount: 1,
    learningCompletedCount: 2,
    pendingReviewCount: 3,
    reviewCompletedCount: 4,
    sleepingCount: 0,
    totalCompletedCount: 6,
  },
});

describe('MutationQueueManager', () => {
  it('enqueues and dequeues mutations in FIFO order', async () => {
    const manager = new MutationQueueManager();

    await manager.enqueue('sync_daily_progress', createProgressPayload());
    await manager.enqueue('refresh_membership', {
      context: {authToken: 'token-2', phoneNumber: '13800138001'},
    });

    const first = await manager.dequeue();
    expect(first?.type).toBe('sync_daily_progress');

    const second = await manager.dequeue();
    expect(second?.type).toBe('refresh_membership');

    await expect(manager.dequeue()).resolves.toBeUndefined();
  });

  it('persists entries through the configured storage adapter', async () => {
    const sharedStore: Record<string, string> = {};
    const storage = createInMemoryMutationQueueStorage(sharedStore);
    const manager = new MutationQueueManager({storage});

    await manager.enqueue(
      'sync_daily_progress',
      createProgressPayload(),
      'progress-1',
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
    await expect(restoredManager.dequeue()).resolves.toMatchObject({
      id: 'progress-1',
    });
  });

  it('persists entries through the default AsyncStorage adapter', async () => {
    const manager = new MutationQueueManager();

    await manager.enqueue('sync_daily_progress', createProgressPayload(), 'persisted');

    const restoredManager = new MutationQueueManager();

    await expect(restoredManager.size()).resolves.toBe(1);
    await expect(restoredManager.peek()).resolves.toMatchObject({
      id: 'persisted',
      type: 'sync_daily_progress',
    });
  });

  it('replaces entries with the same id', async () => {
    const manager = new MutationQueueManager();

    await manager.enqueue('sync_daily_progress', createProgressPayload(), 'dup');
    await manager.enqueue(
      'refresh_membership',
      {
        context: {authToken: 'token-3', phoneNumber: '13800138002'},
      },
      'dup',
    );

    await expect(manager.size()).resolves.toBe(1);
    await expect(manager.peek()).resolves.toMatchObject({
      type: 'refresh_membership',
    });
  });

  it('keeps entries after reaching retry threshold', async () => {
    const manager = new MutationQueueManager();

    await manager.enqueue(
      'sync_daily_progress',
      createProgressPayload(),
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

    await manager.enqueue(
      'sync_daily_progress',
      createProgressPayload(),
      'peek-test',
    );

    await expect(manager.peek()).resolves.toMatchObject({id: 'peek-test'});
    await expect(manager.peek()).resolves.toMatchObject({id: 'peek-test'});
    await expect(manager.size()).resolves.toBe(1);
  });

  it('clears all entries', async () => {
    const manager = new MutationQueueManager();

    await manager.enqueue('sync_daily_progress', createProgressPayload());
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

    await manager.enqueue('sync_daily_progress', createProgressPayload());

    const after = new Date().getTime();
    const timestamp = new Date((await manager.peek())!.timestamp).getTime();

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});
