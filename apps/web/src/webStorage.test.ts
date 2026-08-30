import type {RemoteAuthSession} from '../../mobile/src/auth/authSession';
import {LearningEventOutbox} from '../../mobile/src/sync/learningEventOutbox';
import {MutationQueueManager} from '../../mobile/src/sync/mutationQueue';
import {createWebAccountDeletionStateStore} from './webAccountDeletionState';
import {
  createWebAccountWriteFence,
  createMemoryOnlyAuthSessionStore,
  createWebLearningEventStorage,
  createWebMutationQueueStorage,
  runWebStorageExclusive,
  type WebAccountWriteFence,
} from './webStorage';

describe('Web persistence boundary', () => {
  it('keeps access and refresh credentials in memory only', async () => {
    const store = createMemoryOnlyAuthSessionStore();
    const session: RemoteAuthSession = {
      accessToken: 'access-secret',
      accessTokenExpiresAt: '2026-08-29T12:00:00.000Z',
      mode: 'remote',
      phoneNumber: '13800138000',
      refreshExpiresAt: '2026-09-29T12:00:00.000Z',
      refreshToken: 'refresh-secret',
      sessionId: 'session-1',
      tokenType: 'Bearer',
    };

    localStorage.clear();
    await store.save(session);
    expect(await store.load()).toEqual(session);
    expect(JSON.stringify(localStorage)).not.toContain('access-secret');
    expect(JSON.stringify(localStorage)).not.toContain('refresh-secret');

    await store.clearExactly();
    expect(await store.load()).toBeNull();
  });

  it('injects browser persistence into event and mutation cores', async () => {
    localStorage.clear();
    const accountWriteFence = createBoundAccountWriteFence();
    const eventStorage = createWebLearningEventStorage(
      localStorage,
      accountWriteFence,
    );
    const mutationStorage = createWebMutationQueueStorage(
      localStorage,
      accountWriteFence,
    );

    await eventStorage.setItem('event-key', '{"event_id":"evt_1"}');
    await mutationStorage.setItem('mutation-key', '{"type":"space"}');

    expect(await eventStorage.getItem('event-key')).toBe(
      '{"event_id":"evt_1"}',
    );
    expect(await mutationStorage.getItem('mutation-key')).toBe(
      '{"type":"space"}',
    );
    await eventStorage.removeItem('event-key');
    expect(await eventStorage.getItem('event-key')).toBeNull();
  });

  it('fails closed when native storage has no cross-tab lock authority', () => {
    const lockManager = navigator.locks;
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: undefined,
    });
    try {
      expect(() =>
        runWebStorageExclusive(localStorage, 'queue', async () => undefined),
      ).toThrow('不支持安全的多页面待同步记录');
    } finally {
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: lockManager,
      });
    }
  });

  it('strips replay credentials before a Space mutation reaches localStorage', async () => {
    localStorage.clear();
    const accountWriteFence = createBoundAccountWriteFence();
    const queue = new MutationQueueManager({
      storage: createWebMutationQueueStorage(
        localStorage,
        accountWriteFence,
      ),
    });

    await queue.enqueue('apply_space_action', {
      action: {
        actionId: 'space_web_12345678',
        cardId: '000001',
        clientOccurredAt: '2026-08-29T12:00:00.000Z',
        dimension: 'favorite',
        value: true,
      },
      contentVersion: `sha256:${'12'.repeat(32)}`,
      context: {authToken: 'must-not-persist', phoneNumber: '13800138000'},
      track: 'cet4',
    });

    expect(Object.values(localStorage).join('')).not.toContain(
      'must-not-persist',
    );
    expect(Object.values(localStorage).join('')).toContain('13800138000');
  });

  it('merges writes from two already-hydrated Web queue instances', async () => {
    localStorage.clear();
    const firstOutbox = createOutbox('webdevice_first');
    const secondOutbox = createOutbox('webdevice_second');
    const firstQueue = createMutationQueue();
    const secondQueue = createMutationQueue();
    await Promise.all([
      firstOutbox.hydrate(),
      secondOutbox.hydrate(),
      firstQueue.hydrate(),
      secondQueue.hydrate(),
    ]);

    await Promise.all([
      firstOutbox.enqueueCompletion(
        createCompletion('13800138000', '000001', 'sel_1234567890abcdef'),
      ),
      secondOutbox.enqueueCompletion(
        createCompletion('13900139000', '000002', 'sel_fedcba0987654321'),
      ),
      firstQueue.enqueue(
        'apply_space_action',
        createSpaceMutation('13800138000', '000001', 'space_web_first1'),
      ),
      secondQueue.enqueue(
        'apply_space_action',
        createSpaceMutation('13900139000', '000002', 'space_web_second'),
      ),
    ]);

    const persistedEvents = await createOutbox('webdevice_reader').getAll();
    const persistedMutations = await createMutationQueue().getAll();
    expect(persistedEvents.map(entry => entry.event.card_id).sort()).toEqual([
      '000001',
      '000002',
    ]);
    expect(
      persistedEvents.map(entry => entry.event.device_cursor.sequence).sort(),
    ).toEqual([1, 2]);
    expect(persistedMutations.map(entry => entry.id).sort()).toEqual([
      'space-action:13800138000:space_web_first1',
      'space-action:13900139000:space_web_second',
    ]);
  });

  it('does not let a stale Web instance resurrect logout-cleared queues', async () => {
    localStorage.clear();
    const staleOutbox = createOutbox('webdevice_stale');
    const cleanupOutbox = createOutbox('webdevice_cleanup');
    const staleQueue = createMutationQueue();
    const cleanupQueue = createMutationQueue();
    await Promise.all([
      staleOutbox.hydrate(),
      cleanupOutbox.hydrate(),
      staleQueue.hydrate(),
      cleanupQueue.hydrate(),
    ]);

    const event = await staleOutbox.enqueueCompletion(
      createCompletion('13800138000', '000001', 'sel_1234567890abcdef'),
    );
    const mutation = await staleQueue.enqueue(
      'apply_space_action',
      createSpaceMutation('13800138000', '000001', 'space_web_stale1'),
    );
    await Promise.all([
      cleanupOutbox.clearAccount('13800138000'),
      cleanupQueue.clear(),
    ]);

    await staleOutbox.incrementRetry('13800138000', [event.event.event_id]);
    await staleQueue.incrementRetry(mutation.id);

    expect(await createOutbox('webdevice_reader').getAll()).toEqual([]);
    expect(await createMutationQueue().getAll()).toEqual([]);
  });

  it('quarantines writes from another tab after deletion starts', async () => {
    localStorage.clear();
    const staleFence = createBoundAccountWriteFence();
    const staleOutbox = createOutbox(
      'webdevice_deletion_stale',
      staleFence,
    );
    const staleQueue = createMutationQueue(staleFence);
    await Promise.all([staleOutbox.hydrate(), staleQueue.hydrate()]);
    const deletionStore = createWebAccountDeletionStateStore(localStorage);

    await deletionStore.mark('13800138000', 'requesting');

    await expect(
      staleOutbox.enqueueCompletion(
        createCompletion('13800138000', '000001', 'sel_1234567890abcdef'),
      ),
    ).rejects.toThrow('不能写入新的学习记录');
    await expect(
      staleQueue.enqueue(
        'apply_space_action',
        createSpaceMutation('13800138000', '000001', 'space_web_blocked'),
      ),
    ).rejects.toThrow('不能写入新的账户操作');

    await deletionStore.mark('13800138000', 'accepted');
    await staleFence.runAccountCleanup(
      {
        ownerPhoneNumber: '13800138000',
        revision: await deletionStore.getRevision(),
      },
      () =>
        Promise.all([
          staleOutbox.clearAccount('13800138000'),
          staleQueue.clear(),
        ]).then(() => undefined),
    );
    await deletionStore.clear();
    expect(await createOutbox('webdevice_reader').getAll()).toEqual([]);
    expect(await createMutationQueue().getAll()).toEqual([]);
  });

  it('can clear malformed durable data while deletion quarantine is active', async () => {
    localStorage.clear();
    localStorage.setItem('__softbook_learning_event_outbox_v2', '{broken');
    localStorage.setItem('__softbook_mutation_queue', '{broken');
    localStorage.setItem('__softbook_mutation_queue:quarantine', '{broken');
    const deletionStore = createWebAccountDeletionStateStore(localStorage);
    await deletionStore.mark('13800138000', 'requesting');
    await deletionStore.mark('13800138000', 'accepted');
    const cleanupFence = createBoundAccountWriteFence();
    const outbox = createOutbox('webdevice_cleanup_corrupt', cleanupFence);
    const queue = createMutationQueue(cleanupFence);

    await cleanupFence.runAccountCleanup(
      {
        ownerPhoneNumber: '13800138000',
        revision: await deletionStore.getRevision(),
      },
      () =>
        Promise.all([
          outbox.clearAccount('13800138000'),
          queue.clear(),
        ]).then(() => undefined),
    );
    await deletionStore.clear();

    expect(await createOutbox('webdevice_reader').getAll()).toEqual([]);
    expect(await createMutationQueue().getAll()).toEqual([]);
  });

  it('fences fresh stale-tab enqueues after deletion cleanup leaves a null envelope', async () => {
    localStorage.clear();
    const staleFence = createBoundAccountWriteFence();
    const staleOutbox = createOutbox('webdevice_stale_epoch', staleFence);
    const staleQueue = createMutationQueue(staleFence);
    await Promise.all([staleOutbox.hydrate(), staleQueue.hydrate()]);

    const deletionStore = createWebAccountDeletionStateStore(localStorage);
    await deletionStore.mark('13800138000', 'requesting');
    await deletionStore.mark('13800138000', 'accepted');
    const cleanupFence = createBoundAccountWriteFence();
    const cleanupOutbox = createOutbox(
      'webdevice_cleanup_epoch',
      cleanupFence,
    );
    const cleanupQueue = createMutationQueue(cleanupFence);
    await cleanupFence.runAccountCleanup(
      {
        ownerPhoneNumber: '13800138000',
        revision: await deletionStore.getRevision(),
      },
      () =>
        Promise.all([
          cleanupOutbox.clearAccount('13800138000'),
          cleanupQueue.clear(),
        ]).then(() => undefined),
    );
    await deletionStore.clear();

    await expect(
      staleOutbox.enqueueCompletion(
        createCompletion('13800138000', '000001', 'sel_1234567890abcdef'),
      ),
    ).rejects.toThrow('账户隔离版本已变化');
    await expect(
      staleQueue.enqueue(
        'apply_space_action',
        createSpaceMutation('13800138000', '000001', 'space_web_epoch01'),
      ),
    ).rejects.toThrow('账户隔离版本已变化');
    expect(await createOutbox('webdevice_reader').getAll()).toEqual([]);
    expect(await createMutationQueue().getAll()).toEqual([]);
  });

  it('fences fresh stale-tab enqueues after terminal cleanup advances a null epoch', async () => {
    localStorage.clear();
    const staleFence = createBoundAccountWriteFence();
    const staleOutbox = createOutbox('webdevice_stale_logout', staleFence);
    const staleQueue = createMutationQueue(staleFence);
    await Promise.all([staleOutbox.hydrate(), staleQueue.hydrate()]);
    const terminalStore = createWebAccountDeletionStateStore(localStorage);

    await expect(
      terminalStore.ensureCleanupAuthority?.('13800138000', 0),
    ).resolves.toBe(1);

    await expect(
      staleOutbox.enqueueCompletion(
        createCompletion('13800138000', '000001', 'sel_1234567890abcdef'),
      ),
    ).rejects.toThrow('本机账户清理期间');
    await expect(
      staleQueue.enqueue(
        'apply_space_action',
        createSpaceMutation('13800138000', '000001', 'space_web_logout1'),
      ),
    ).rejects.toThrow('本机账户清理期间');
    const cleanupFence = createBoundAccountWriteFence();
    const cleanupOutbox = createOutbox(
      'webdevice_terminal_cleanup',
      cleanupFence,
    );
    const cleanupQueue = createMutationQueue(cleanupFence);
    await cleanupFence.runAccountCleanup(
      {ownerPhoneNumber: '13800138000', revision: 1},
      async () => {
        await Promise.all([
          cleanupOutbox.clearAccount('13800138000'),
          cleanupQueue.clear(),
        ]);
        await terminalStore.clear();
      },
    );
    await expect(
      staleQueue.enqueue(
        'apply_space_action',
        createSpaceMutation('13800138000', '000001', 'space_web_logout2'),
      ),
    ).rejects.toThrow('账户隔离版本已变化');
  });
});

function createOutbox(
  deviceId: string,
  accountWriteFence = createBoundAccountWriteFence(),
) {
  return new LearningEventOutbox({
    createDeviceId: () => deviceId,
    now: () => '2026-08-29T12:00:00.000Z',
    storage: createWebLearningEventStorage(localStorage, accountWriteFence),
  });
}

function createMutationQueue(
  accountWriteFence = createBoundAccountWriteFence(),
) {
  return new MutationQueueManager({
    now: () => '2026-08-29T12:00:00.000Z',
    storage: createWebMutationQueueStorage(localStorage, accountWriteFence),
  });
}

function createBoundAccountWriteFence(): WebAccountWriteFence {
  const fence = createWebAccountWriteFence(localStorage);
  const rawEnvelope = localStorage.getItem(
    'softbook-cet/web-account-deletion/v1',
  );
  const revision =
    rawEnvelope === null
      ? Number(
          localStorage.getItem(
            'softbook-cet/web-account-deletion-revision/v1',
          ) ?? 0,
        )
      : (JSON.parse(rawEnvelope) as {revision?: number}).revision ?? 0;
  fence.bindSessionRevision(revision);
  return fence;
}

function createCompletion(
  accountPhoneNumber: string,
  cardId: string,
  selectionId: string,
) {
  return {
    accountPhoneNumber,
    contentVersion: `sha256:${'12'.repeat(32)}`,
    phase: 'learning' as const,
    result: {
      cardId,
      completedAt: '2026-08-29T12:00:00.000Z',
      interactionId: 'flip' as const,
      isFavorited: false,
      outcome: 'confident' as const,
      usedHint: false,
      usedPeek: false,
    },
    selectionId,
    track: 'cet4' as const,
  };
}

function createSpaceMutation(
  phoneNumber: string,
  cardId: string,
  actionId: string,
) {
  return {
    action: {
      actionId,
      cardId,
      clientOccurredAt: '2026-08-29T12:00:00.000Z',
      dimension: 'favorite' as const,
      value: true,
    },
    contentVersion: `sha256:${'12'.repeat(32)}`,
    context: {authToken: 'memory-only', phoneNumber},
    track: 'cet4' as const,
  };
}
