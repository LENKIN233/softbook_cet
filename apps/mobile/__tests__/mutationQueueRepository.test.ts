import {
  MAX_MUTATION_RETRIES,
  MutationQueueManager,
} from '../src/sync/mutationQueue';
import type { MembershipState } from '../src/membership/localMembership';
import { createMutationQueueRepository } from '../src/sync/mutationQueueRepository';
import { RemoteHttpError } from '../src/runtime/remoteHttpError';
import { RemoteRequestLifecycleError } from '../src/runtime/remoteRequest';

const createCheckInPayload = () => ({
  context: {
    authToken: 'token-progress',
    phoneNumber: '13800138000',
  },
  dayKey: '2026-04-27',
});

const createSpacePayload = () => ({
  action: {
    actionId: 'space_action_0001',
    cardId: 'c1',
    clientOccurredAt: '2026-04-27T00:00:00.000Z',
    dimension: 'favorite' as const,
    value: true,
  },
  contentVersion: `sha256:${'a'.repeat(64)}`,
  context: {
    authToken: 'token-space',
    phoneNumber: '13800138001',
  },
  track: 'cet4' as const,
});

const createSpaceReplayContext = () => ({
  authToken: 'token-space',
  contentVersion: `sha256:${'a'.repeat(64)}`,
  dayKey: '2026-04-27',
  phoneNumber: '13800138001',
  track: 'cet4' as const,
});

describe('MutationQueueRepository', () => {
  const mockProgressSyncRepository = {
    checkIn: jest.fn<Promise<unknown>, [unknown, string]>(),
  };
  const mockSpaceStateRepository = {
    applyActions: jest.fn<Promise<unknown>, [unknown, unknown, string]>(),
  };
  const mockMembershipRepository = {
    loadState: jest.fn<Promise<unknown>, [unknown]>(),
    startTrial: jest.fn<Promise<unknown>, [unknown, unknown]>(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockProgressSyncRepository.checkIn.mockResolvedValue({
      acknowledgedAt: '2026-04-27T00:00:00.000Z',
      checkedInToday: true,
      dayKey: '2026-04-27',
      mode: 'remote',
    });
    mockSpaceStateRepository.applyActions.mockResolvedValue({
      acknowledgedAt: '2026-04-27T00:00:00.000Z',
      contentVersion: `sha256:${'a'.repeat(64)}`,
      results: [{ actionId: 'space_action_0001', status: 'applied' }],
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
      track: 'cet4',
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
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });

    return expect(
      repository.enqueueMutation(
        'check_in_daily_progress',
        createCheckInPayload(),
      ),
    ).resolves.toMatchObject({
      type: 'check_in_daily_progress',
    });
  });

  it('reports queue size after enqueue', async () => {
    const repository = createMutationQueueRepository({
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });

    await repository.enqueueMutation(
      'check_in_daily_progress',
      createCheckInPayload(),
    );

    await expect(repository.getQueueSize()).resolves.toBe(1);
  });

  it('reports only an exact account-and-day pending check-in', async () => {
    const repository = createMutationQueueRepository({
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });

    await repository.enqueueMutation(
      'check_in_daily_progress',
      createCheckInPayload(),
    );

    await expect(
      repository.hasPendingCheckIn('13800138000', '2026-04-27'),
    ).resolves.toBe(true);
    await expect(
      repository.hasPendingCheckIn('13800138001', '2026-04-27'),
    ).resolves.toBe(false);
    await expect(
      repository.hasPendingCheckIn('13800138000', '2026-04-28'),
    ).resolves.toBe(false);
  });

  it('returns pending space actions for the matching account and track across a content update', async () => {
    const repository = createMutationQueueRepository({
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });
    const payload = createSpacePayload();

    await repository.enqueueMutation('apply_space_action', payload);

    await expect(
      repository.getPendingSpaceActions('13800138001', {
        contentVersion: payload.contentVersion,
        track: payload.track,
      }),
    ).resolves.toEqual([payload.action]);
    await expect(
      repository.getPendingSpaceActions('13800138000'),
    ).resolves.toEqual([]);
    await expect(
      repository.getPendingSpaceActions('13800138001', {
        contentVersion: `sha256:${'b'.repeat(64)}`,
        track: 'cet4',
      }),
    ).resolves.toEqual([payload.action]);
    await expect(
      repository.getPendingSpaceActions('13800138001', {
        contentVersion: payload.contentVersion,
        track: 'cet6',
      }),
    ).resolves.toEqual([]);
  });

  it('replays explicit daily check-ins without counters', async () => {
    const repository = createMutationQueueRepository({
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });
    const payload = createCheckInPayload();

    await repository.enqueueMutation('check_in_daily_progress', payload);
    await expect(
      repository.startReplay(payload.context),
    ).resolves.toMatchObject([
      {
        entry: {
          type: 'check_in_daily_progress',
        },
      },
    ]);

    expect(mockProgressSyncRepository.checkIn).toHaveBeenCalledWith(
      payload.context,
      payload.dayKey,
    );
    await expect(repository.getQueueSize()).resolves.toBe(0);
  });

  it('replays one immutable space action with current auth and day context', async () => {
    const repository = createMutationQueueRepository({
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });
    const payload = createSpacePayload();

    await repository.enqueueMutation('apply_space_action', payload);
    await expect(
      repository.startReplay(createSpaceReplayContext()),
    ).resolves.toMatchObject([
      {
        entry: {
          type: 'apply_space_action',
        },
        spaceActionAck: {
          results: [{ actionId: 'space_action_0001', status: 'applied' }],
        },
      },
    ]);

    expect(mockSpaceStateRepository.applyActions).toHaveBeenCalledWith(
      {
        authToken: 'token-space',
        dayKey: '2026-04-27',
        phoneNumber: '13800138001',
      },
      {
        actions: [payload.action],
        contentVersion: payload.contentVersion,
        track: payload.track,
      },
      '2026-04-27',
    );
    await expect(repository.getQueueSize()).resolves.toBe(0);
  });

  it('rebinds a same-track pending action to the current content version', async () => {
    const repository = createMutationQueueRepository({
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });
    const payload = createSpacePayload();
    const currentContentVersion = `sha256:${'b'.repeat(64)}`;

    await repository.enqueueMutation('apply_space_action', payload);
    await repository.startReplay({
      ...createSpaceReplayContext(),
      contentVersion: currentContentVersion,
    });

    expect(mockSpaceStateRepository.applyActions).toHaveBeenCalledWith(
      expect.objectContaining({
        authToken: 'token-space',
        phoneNumber: '13800138001',
      }),
      {
        actions: [payload.action],
        contentVersion: currentContentVersion,
        track: 'cet4',
      },
      '2026-04-27',
    );
    await expect(repository.getQueueSize()).resolves.toBe(0);
  });

  it('replays membership refreshes through loadState', async () => {
    const repository = createMutationQueueRepository({
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
    await expect(
      repository.startReplay(payload.context),
    ).resolves.toMatchObject([
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
    await expect(
      repository.startReplay(payload.context),
    ).resolves.toMatchObject([
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
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });

    mockProgressSyncRepository.checkIn.mockRejectedValue(
      new Error('Network error'),
    );

    await repository.enqueueMutation(
      'check_in_daily_progress',
      createCheckInPayload(),
    );

    for (let index = 0; index <= MAX_MUTATION_RETRIES; index += 1) {
      await repository.startReplay();
      await expect(repository.getQueueSize()).resolves.toBe(1);
    }

    expect(mockProgressSyncRepository.checkIn).toHaveBeenCalledTimes(
      MAX_MUTATION_RETRIES + 1,
    );
  });

  it('surfaces authorization failures so the app can revoke the session', async () => {
    const repository = createMutationQueueRepository({
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });
    mockMembershipRepository.loadState.mockRejectedValue(
      new RemoteHttpError('Unauthorized', 401),
    );
    await repository.enqueueMutation('refresh_membership', {
      context: {
        authToken: 'expired-token',
        phoneNumber: '13800138002',
      },
    });

    await expect(repository.startReplay()).rejects.toMatchObject({
      status: 401,
    });
    await expect(repository.getQueueSize()).resolves.toBe(1);
  });

  it('surfaces session cancellation without incrementing generic queue retry state', async () => {
    const queueManager = new MutationQueueManager();
    const repository = createMutationQueueRepository({
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      queueManager,
      spaceStateRepository: mockSpaceStateRepository as never,
    });
    mockProgressSyncRepository.checkIn.mockRejectedValue(
      new RemoteRequestLifecycleError('session_superseded'),
    );
    const entry = await repository.enqueueMutation(
      'check_in_daily_progress',
      createCheckInPayload(),
    );

    await expect(repository.startReplay()).rejects.toMatchObject({
      reason: 'session_superseded',
    });

    await expect(queueManager.getAll()).resolves.toEqual([entry]);
  });

  it('drops stale entries for a different auth context before replaying current user mutations', async () => {
    const repository = createMutationQueueRepository({
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });
    const stalePayload = createCheckInPayload();
    const currentPayload = {
      ...createCheckInPayload(),
      context: {
        authToken: 'token-current',
        phoneNumber: '13800138888',
      },
    };

    await repository.enqueueMutation(
      'check_in_daily_progress',
      stalePayload,
      'stale-progress',
    );
    await repository.enqueueMutation(
      'check_in_daily_progress',
      currentPayload,
      'current-progress',
    );

    await expect(
      repository.startReplay(currentPayload.context),
    ).resolves.toMatchObject([
      {
        entry: {
          id: 'check-in:13800138888:2026-04-27',
          type: 'check_in_daily_progress',
        },
      },
    ]);

    expect(mockProgressSyncRepository.checkIn).toHaveBeenCalledWith(
      currentPayload.context,
      currentPayload.dayKey,
    );
    expect(mockProgressSyncRepository.checkIn).not.toHaveBeenCalledWith(
      stalePayload.context,
      stalePayload.dayKey,
    );
    await expect(repository.getQueueSize()).resolves.toBe(0);
  });

  it('replays same phone mutations with the current auth token', async () => {
    const repository = createMutationQueueRepository({
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });
    const payload = {
      ...createCheckInPayload(),
      context: {
        authToken: 'old-token',
        phoneNumber: '13800138000',
      },
    };
    const currentContext = {
      authToken: 'fresh-token',
      phoneNumber: '13800138000',
    };

    await repository.enqueueMutation('check_in_daily_progress', payload);
    await repository.startReplay(currentContext);

    expect(mockProgressSyncRepository.checkIn).toHaveBeenCalledWith(
      currentContext,
      payload.dayKey,
    );
    await expect(repository.getQueueSize()).resolves.toBe(0);
  });

  it('prevents concurrent replay of the same queue head', async () => {
    let resolveReplay: (() => void) | undefined;
    let markReplayStarted: (() => void) | undefined;
    const replayStarted = new Promise<void>(resolve => {
      markReplayStarted = resolve;
    });
    mockSpaceStateRepository.applyActions.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveReplay = () =>
            resolve({
              acknowledgedAt: '2026-04-27T00:00:00.000Z',
              contentVersion: `sha256:${'a'.repeat(64)}`,
              results: [{ actionId: 'space_action_0001', status: 'applied' }],
              snapshot: {
                dayKey: '2026-04-27',
                states: [],
              },
              track: 'cet4',
            });
          markReplayStarted?.();
        }),
    );

    const repository = createMutationQueueRepository({
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });

    await repository.enqueueMutation(
      'apply_space_action',
      createSpacePayload(),
    );

    const firstReplay = repository.startReplay(createSpaceReplayContext());
    await replayStarted;
    const secondReplay = repository.startReplay(createSpaceReplayContext());

    resolveReplay?.();
    await Promise.all([firstReplay, secondReplay]);

    expect(mockSpaceStateRepository.applyActions).toHaveBeenCalledTimes(1);
  });

  it('can clear the queue', async () => {
    const repository = createMutationQueueRepository({
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      spaceStateRepository: mockSpaceStateRepository as never,
    });

    await repository.enqueueMutation(
      'check_in_daily_progress',
      createCheckInPayload(),
    );
    await repository.enqueueMutation(
      'apply_space_action',
      createSpacePayload(),
    );

    await repository.clear();

    await expect(repository.getQueueSize()).resolves.toBe(0);
  });

  it('supports injecting a prebuilt queue manager', async () => {
    const queueManager = new MutationQueueManager();
    const repository = createMutationQueueRepository({
      membershipRepository: mockMembershipRepository as never,
      progressSyncRepository: mockProgressSyncRepository as never,
      queueManager,
      spaceStateRepository: mockSpaceStateRepository as never,
    });
    const payload = createCheckInPayload();

    await repository.enqueueMutation('check_in_daily_progress', payload);
    await repository.startReplay();

    expect(mockProgressSyncRepository.checkIn).toHaveBeenCalledTimes(1);
    await expect(queueManager.size()).resolves.toBe(0);
  });
});
