import {
  MAX_MUTATION_RETRIES,
  MutationQueueManager,
} from '../src/sync/mutationQueue';
import type {MembershipState} from '../src/membership/localMembership';
import {createLearningStateSnapshot} from '../src/sync/learningStateRepository';
import {createMutationQueueRepository} from '../src/sync/mutationQueueRepository';

const createProgressPayload = () => ({
  context: {
    authToken: 'token-progress',
    phoneNumber: '13800138000',
  },
  snapshot: {
    checkedInToday: true,
    dayKey: '2026-04-27',
    favoriteCount: 1,
    learningCompletedCount: 2,
    pendingReviewCount: 3,
    reviewCompletedCount: 4,
    sleepingCount: 1,
    totalCompletedCount: 6,
  },
});

const createSpacePayload = () => ({
  context: {
    authToken: 'token-space',
    phoneNumber: '13800138001',
  },
  snapshot: {
    dayKey: '2026-04-27',
    states: [
      {
        cardId: 'c1',
        isFavorited: true,
        isSleeping: false,
        lastModifiedAt: '2026-04-27T00:00:00.000Z',
      },
    ],
  },
});

const createLearningStatePayload = () => ({
  context: {
    authToken: 'token-learning',
    phoneNumber: '13800138003',
  },
  snapshot: createLearningStateSnapshot({
    dayKey: '2026-04-27',
    learningResults: [
      {
        cardId: 'c1',
        completedAt: '2026-04-27T00:00:00.000Z',
        interactionId: 'flip',
        outcome: 'confident',
        usedHint: false,
        usedPeek: false,
        isFavorited: true,
      },
    ],
    learningSession: {
      sourceId: 'session-source',
      sourceLabel: 'Session Source',
      track: 'cet4',
    },
    reviewResults: [
      {
        cardId: 'c2',
        completedAt: '2026-04-27T00:10:00.000Z',
        interactionId: 'multiple_choice',
        outcome: 'correct',
        usedHint: true,
        usedPeek: false,
        isFavorited: false,
      },
    ],
  }),
});

describe('MutationQueueRepository', () => {
  const mockProgressSyncRepository = {
    syncDailyProgress: jest.fn<Promise<unknown>, [unknown, unknown]>(),
  };
  const mockLearningStateRepository = {
    syncLearningState: jest.fn<Promise<unknown>, [unknown, unknown]>(),
  };
  const mockSpaceStateRepository = {
    syncSpaceState: jest.fn<Promise<unknown>, [unknown, unknown]>(),
  };
  const mockMembershipRepository = {
    loadState: jest.fn<Promise<unknown>, [unknown]>(),
    startTrial: jest.fn<Promise<unknown>, [unknown, unknown]>(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockProgressSyncRepository.syncDailyProgress.mockResolvedValue({
      acknowledgedAt: '2026-04-27T00:00:00.000Z',
      mode: 'remote',
    });
    mockLearningStateRepository.syncLearningState.mockResolvedValue({
      acknowledgedAt: '2026-04-27T00:00:00.000Z',
      mode: 'remote',
    });
    mockSpaceStateRepository.syncSpaceState.mockResolvedValue({
      acknowledgedAt: '2026-04-27T00:00:00.000Z',
      mode: 'remote',
    });
    mockMembershipRepository.loadState.mockResolvedValue({
      countedEntryCount: 2,
      lastExperienceEndedBy: null,
      recoveryPromptVisible: false,
      stage: 'free',
      trialDurationDays: 5,
      trialStartedAtEntryCount: 1,
    });
    mockMembershipRepository.startTrial.mockResolvedValue({
      mode: 'remote',
      state: {
        countedEntryCount: 1,
        lastExperienceEndedBy: null,
        recoveryPromptVisible: false,
        stage: 'trial',
        trialDurationDays: 5,
        trialStartedAtEntryCount: 1,
      },
    });
  });

  it('enqueues mutations', () => {
    const repository = createMutationQueueRepository({
      learningStateRepository: mockLearningStateRepository as never,
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });

    return expect(
      repository.enqueueMutation('sync_daily_progress', createProgressPayload()),
    ).resolves.toMatchObject({
      type: 'sync_daily_progress',
    });
  });

  it('reports queue size after enqueue', async () => {
    const repository = createMutationQueueRepository({
      learningStateRepository: mockLearningStateRepository as never,
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });

    await repository.enqueueMutation('sync_daily_progress', createProgressPayload());

    await expect(repository.getQueueSize()).resolves.toBe(1);
  });

  it('replays daily progress snapshots', async () => {
    const repository = createMutationQueueRepository({
      learningStateRepository: mockLearningStateRepository as never,
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });
    const payload = createProgressPayload();

    await repository.enqueueMutation('sync_daily_progress', payload);
    await expect(repository.startReplay()).resolves.toMatchObject([
      {
        entry: {
          type: 'sync_daily_progress',
        },
      },
    ]);

    expect(mockProgressSyncRepository.syncDailyProgress).toHaveBeenCalledWith(
      payload.context,
      payload.snapshot,
    );
    await expect(repository.getQueueSize()).resolves.toBe(0);
  });

  it('replays space state snapshots', async () => {
    const repository = createMutationQueueRepository({
      learningStateRepository: mockLearningStateRepository as never,
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });
    const payload = createSpacePayload();

    await repository.enqueueMutation('sync_space_state', payload);
    await expect(repository.startReplay()).resolves.toMatchObject([
      {
        entry: {
          type: 'sync_space_state',
        },
      },
    ]);

    expect(mockSpaceStateRepository.syncSpaceState).toHaveBeenCalledWith(
      payload.context,
      payload.snapshot,
    );
    await expect(repository.getQueueSize()).resolves.toBe(0);
  });

  it('replays learning state snapshots', async () => {
    const repository = createMutationQueueRepository({
      learningStateRepository: mockLearningStateRepository as never,
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });
    const payload = createLearningStatePayload();

    await repository.enqueueMutation('sync_learning_state', payload);
    await expect(repository.startReplay()).resolves.toMatchObject([
      {
        entry: {
          type: 'sync_learning_state',
        },
      },
    ]);

    expect(mockLearningStateRepository.syncLearningState).toHaveBeenCalledWith(
      payload.context,
      payload.snapshot,
    );
    await expect(repository.getQueueSize()).resolves.toBe(0);
  });

  it('replays membership refreshes through loadState', async () => {
    const repository = createMutationQueueRepository({
      learningStateRepository: mockLearningStateRepository as never,
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });
    const payload = {
      context: {
        authToken: 'token-membership',
        phoneNumber: '13800138002',
      },
    };

    await repository.enqueueMutation('refresh_membership', payload);
    await expect(repository.startReplay()).resolves.toMatchObject([
      {
        entry: {
          type: 'refresh_membership',
        },
        membershipState: {
          stage: 'free',
        },
      },
    ]);

    expect(mockMembershipRepository.loadState).toHaveBeenCalledWith(
      payload.context,
    );
    await expect(repository.getQueueSize()).resolves.toBe(0);
  });

  it('replays queued membership trial starts through startTrial', async () => {
    const repository = createMutationQueueRepository({
      learningStateRepository: mockLearningStateRepository as never,
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });
    const currentState: MembershipState = {
      countedEntryCount: 0,
      lastExperienceEndedBy: null,
      recoveryPromptVisible: false,
      stage: 'trial_available',
      trialDurationDays: 5,
      trialStartedAtEntryCount: null,
    };
    const payload = {
      context: {
        authToken: 'token-membership',
        phoneNumber: '13800138002',
      },
      currentState,
    };

    await repository.enqueueMutation('start_membership_trial', payload);
    await expect(repository.startReplay()).resolves.toMatchObject([
      {
        entry: {
          type: 'start_membership_trial',
        },
        membershipState: {
          stage: 'trial',
        },
      },
    ]);

    expect(mockMembershipRepository.startTrial).toHaveBeenCalledWith(
      payload.context,
      payload.currentState,
    );
    await expect(repository.getQueueSize()).resolves.toBe(0);
  });

  it('keeps failed entries after retries reach the warning threshold', async () => {
    const repository = createMutationQueueRepository({
      learningStateRepository: mockLearningStateRepository as never,
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });

    mockProgressSyncRepository.syncDailyProgress.mockRejectedValue(
      new Error('Network error'),
    );

    await repository.enqueueMutation('sync_daily_progress', createProgressPayload());

    for (let index = 0; index <= MAX_MUTATION_RETRIES; index += 1) {
      await repository.startReplay();
      await expect(repository.getQueueSize()).resolves.toBe(1);
    }

    expect(mockProgressSyncRepository.syncDailyProgress).toHaveBeenCalledTimes(
      MAX_MUTATION_RETRIES + 1,
    );
  });

  it('drops stale entries for a different auth context before replaying current user mutations', async () => {
    const repository = createMutationQueueRepository({
      learningStateRepository: mockLearningStateRepository as never,
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });
    const stalePayload = createProgressPayload();
    const currentPayload = {
      ...createProgressPayload(),
      context: {
        authToken: 'token-current',
        phoneNumber: '13800138888',
      },
    };

    await repository.enqueueMutation(
      'sync_daily_progress',
      stalePayload,
      'stale-progress',
    );
    await repository.enqueueMutation(
      'sync_daily_progress',
      currentPayload,
      'current-progress',
    );

    await expect(
      repository.startReplay(currentPayload.context),
    ).resolves.toMatchObject([
      {
        entry: {
          id: 'current-progress',
          type: 'sync_daily_progress',
        },
      },
    ]);

    expect(mockProgressSyncRepository.syncDailyProgress).toHaveBeenCalledWith(
      currentPayload.context,
      currentPayload.snapshot,
    );
    expect(mockProgressSyncRepository.syncDailyProgress).not.toHaveBeenCalledWith(
      stalePayload.context,
      stalePayload.snapshot,
    );
    await expect(repository.getQueueSize()).resolves.toBe(0);
  });

  it('replays same phone mutations with the current auth token', async () => {
    const repository = createMutationQueueRepository({
      learningStateRepository: mockLearningStateRepository as never,
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });
    const payload = {
      ...createProgressPayload(),
      context: {
        authToken: 'old-token',
        phoneNumber: '13800138000',
      },
    };
    const currentContext = {
      authToken: 'fresh-token',
      phoneNumber: '13800138000',
    };

    await repository.enqueueMutation('sync_daily_progress', payload);
    await repository.startReplay(currentContext);

    expect(mockProgressSyncRepository.syncDailyProgress).toHaveBeenCalledWith(
      currentContext,
      payload.snapshot,
    );
    await expect(repository.getQueueSize()).resolves.toBe(0);
  });

  it('prevents concurrent replay of the same queue head', async () => {
    let resolveReplay: (() => void) | undefined;
    let markReplayStarted: (() => void) | undefined;
    const replayStarted = new Promise<void>(resolve => {
      markReplayStarted = resolve;
    });
    mockSpaceStateRepository.syncSpaceState.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveReplay = () => resolve(undefined);
          markReplayStarted?.();
        }),
    );

    const repository = createMutationQueueRepository({
      learningStateRepository: mockLearningStateRepository as never,
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });

    await repository.enqueueMutation('sync_space_state', createSpacePayload());

    const firstReplay = repository.startReplay();
    await replayStarted;
    const secondReplay = repository.startReplay();

    resolveReplay?.();
    await Promise.all([firstReplay, secondReplay]);

    expect(mockSpaceStateRepository.syncSpaceState).toHaveBeenCalledTimes(1);
  });

  it('can clear the queue', async () => {
    const repository = createMutationQueueRepository({
      learningStateRepository: mockLearningStateRepository as never,
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });

    await repository.enqueueMutation('sync_daily_progress', createProgressPayload());
    await repository.enqueueMutation('sync_space_state', createSpacePayload());

    await repository.clear();

    await expect(repository.getQueueSize()).resolves.toBe(0);
  });

  it('supports injecting a prebuilt queue manager', async () => {
    const queueManager = new MutationQueueManager();
    const repository = createMutationQueueRepository({
      learningStateRepository: mockLearningStateRepository as never,
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      queueManager,
      spaceStateRepository: mockSpaceStateRepository as never,
    });
    const payload = createProgressPayload();

    await repository.enqueueMutation('sync_daily_progress', payload);
    await repository.startReplay();

    expect(mockProgressSyncRepository.syncDailyProgress).toHaveBeenCalledTimes(1);
    await expect(queueManager.size()).resolves.toBe(0);
  });
});
