import type {AuthRepository} from '../../mobile/src/auth/authRepository';
import {createAuthSessionCoordinator} from '../../mobile/src/auth/authSessionCoordinator';
import type {AccountBootstrapSnapshot} from '../../mobile/src/bootstrap/accountBootstrapRepository';
import type {LearningSession} from '../../mobile/src/learning/model';
import {createInitialMembershipState} from '../../mobile/src/membership/localMembership';
import {createMembershipRepository} from '../../mobile/src/membership/membershipRepository';
import {createSpaceStateRepository} from '../../mobile/src/space/spaceStateRepository';
import {
  createInMemoryMutationQueueStorage,
  MutationQueueManager,
} from '../../mobile/src/sync/mutationQueue';
import {createMutationQueueRepository} from '../../mobile/src/sync/mutationQueueRepository';
import {createProgressSyncRepository} from '../../mobile/src/sync/progressSyncRepository';
import {createMemoryOnlyAuthSessionStore} from './webStorage';
import {createWebAccountDeletionStateStore} from './webAccountDeletionState';
import {
  createWebRemoteRuntime,
  createWebRemoteRuntimeController,
} from './remoteRuntime';

const PHONE = '13800138000';

describe('authenticated Web remote orchestration', () => {
  it('sends the explicit Web client identity through the shared auth repository', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('x-softbook-client')).toBe('web');
      return new Response(
        JSON.stringify({
          data: {
            challenge_id: 'challenge-1',
            expires_at: '2026-08-29T12:05:00.000Z',
            retry_after_seconds: 0,
          },
        }),
        {headers: {'content-type': 'application/json'}, status: 200},
      );
    });
    const controller = createWebRemoteRuntime(
      {
        baseUrl: 'https://runtime.example.cn',
        clientIdentity: {platform: 'web', version: '0.1.0'},
        clientKind: 'web',
        contentManifestPublicKeys: {'release-2026': 'ab'.repeat(32)},
        mode: 'remote',
        track: 'cet4',
      },
      {fetchImpl, storage: localStorage},
    );

    await controller.requestSmsCode(PHONE);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://runtime.example.cn/v2/auth/request-code',
      expect.objectContaining({method: 'POST'}),
    );
  });

  it('replays events before bootstrap and reconciles a server-started trial', async () => {
    const operations: string[] = [];
    const membershipAvailable = createInitialMembershipState();
    const membershipTrial = {
      ...membershipAvailable,
      countedEntryCount: 1,
      stage: 'trial' as const,
      trialExpiresAt: '2026-09-03T12:00:00.000Z',
      trialRemainingSeconds: 432000,
      trialStartedAt: '2026-08-29T12:00:00.000Z',
      trialStartedAtEntryCount: 1,
    };
    const authRepository: AuthRepository = {
      logout: async () => {
        operations.push('logout');
      },
      refreshSession: async session => {
        operations.push('refresh');
        return {
          ...session,
          accessToken: 'refreshed-access-token',
          accessTokenExpiresAt: '2026-08-29T13:00:00.000Z',
        };
      },
      requestSmsCode: async phoneNumber => {
        operations.push('request-code');
        return {
          challengeId: 'challenge-1',
          expiresAt: '2026-08-29T12:05:00.000Z',
          mode: 'remote',
          phoneNumber,
          retryAfterSeconds: 0,
        };
      },
      verifySmsCode: async input => {
        operations.push('verify-code');
        return {
          accessToken: 'access-token',
          accessTokenExpiresAt: '2026-08-29T12:00:30.000Z',
          mode: 'remote',
          phoneNumber: input.phoneNumber,
          refreshExpiresAt: '2026-09-29T12:00:00.000Z',
          refreshToken: 'refresh-token',
          sessionId: 'session-1',
          tokenType: 'Bearer',
        };
      },
    };
    const authSessionCoordinator = createAuthSessionCoordinator({
      authRepository,
      authSessionStore: createMemoryOnlyAuthSessionStore(),
      now: () => new Date('2026-08-29T12:00:00.000Z'),
    });
    let bootstrapLoads = 0;
    const learningSession = createLearningSessionFixture();
    const controller = createWebRemoteRuntimeController({
      accountBootstrapRepository: {
        async load() {
          operations.push('bootstrap');
          bootstrapLoads += 1;
          return createBootstrapFixture(
            bootstrapLoads === 1 ? membershipAvailable : membershipTrial,
          );
        },
      },
      authRepository,
      authSessionCoordinator,
      learningEventSyncRepository: {
        async clearAccount(phoneNumber) {
          operations.push(`events-clear:${phoneNumber}`);
        },
        async enqueueCompletion(input) {
          operations.push('completion-persist');
          return {
            accountPhoneNumber: input.accountPhoneNumber,
            enqueuedAt: '2026-08-29T12:00:00.000Z',
            event: {
              answer_grade: 'passed',
              card_id: input.result.cardId,
              client_occurred_at: input.result.completedAt,
              content_version: input.contentVersion,
              device_cursor: {device_id: 'webdevice_12345678', sequence: 1},
              event_id: 'webdevice_12345678_1',
              interaction_id: input.result.interactionId,
              outcome: input.result.outcome,
              phase: input.phase,
              selection_id: input.selectionId,
              used_hint: input.result.usedHint,
              used_peek: input.result.usedPeek,
            },
            retryCount: 0,
            track: input.track,
          };
        },
        getPendingCount: async () => 0,
        async startReplay() {
          operations.push('events-replay');
          return {
            acknowledgements: [],
            acknowledgedEntries: [],
            pendingCount: 0,
          };
        },
      },
      learningSessionRepository: {
        continueRound: async () => undefined,
        async loadSession() {
          operations.push('learning-session');
          return learningSession;
        },
      },
      mutationQueueRepository: createMutationRepository(operations),
      now: () => new Date('2026-08-29T12:00:00.000Z'),
      playAudio: async () => 'ready',
      runtimeSessionId: 'bootstrap-runtime:web-test-session',
      track: 'cet4',
    });

    await controller.requestSmsCode(PHONE);
    const snapshot = await controller.verifySmsCode(PHONE, '123456');

    expect(operations.indexOf('events-replay')).toBeLessThan(
      operations.indexOf('bootstrap'),
    );
    expect(operations).toEqual([
      'request-code',
      'verify-code',
      'refresh',
      'events-replay',
      'bootstrap',
      'mutation-hydrate',
      'mutation-replay',
      'learning-session',
      'bootstrap',
    ]);
    expect(snapshot.membership).toEqual(membershipTrial);
    expect(snapshot.membership.stage).toBe('trial');
    expect(snapshot.spaceSync).toEqual({
      pendingActionCount: 0,
      rejectedActionCount: 0,
      rejectionCodes: [],
      status: 'confirmed',
    });

    operations.length = 0;
    await controller.completeCurrentCard({
      cardId: '000001',
      completedAt: '2026-08-29T12:01:00.000Z',
      interactionId: 'flip',
      isFavorited: false,
      outcome: 'confident',
      usedHint: false,
      usedPeek: false,
    });
    await controller.loadAuthenticatedState();
    expect(operations).toEqual([
      'completion-persist',
      'events-replay',
      'events-replay',
      'bootstrap',
      'mutation-hydrate',
      'mutation-replay',
      'learning-session',
    ]);

    operations.length = 0;
    expect(controller.isAuthenticated()).toBe(true);
    await controller.logout();
    expect(controller.isAuthenticated()).toBe(false);
    expect(operations).toEqual([
      'logout',
      `events-clear:${PHONE}`,
      'mutation-clear',
    ]);
  });

  it('blocks same-phone reauthentication until durable cleanup fully succeeds', async () => {
    const operations: string[] = [];
    let clearAttempts = 0;
    let staleEventPresent = false;
    const membership = {
      ...createInitialMembershipState(),
      stage: 'premium' as const,
    };
    const authRepository: AuthRepository = {
      logout: async () => {
        operations.push('remote-logout');
      },
      refreshSession: async session => session,
      requestSmsCode: async phoneNumber => ({
        challengeId: 'challenge-cleanup',
        expiresAt: '2026-08-29T12:05:00.000Z',
        mode: 'remote',
        phoneNumber,
        retryAfterSeconds: 0,
      }),
      verifySmsCode: async input => ({
        accessToken: `access-${operations.length}`,
        accessTokenExpiresAt: '2026-08-29T13:00:00.000Z',
        mode: 'remote',
        phoneNumber: input.phoneNumber,
        refreshExpiresAt: '2026-09-29T12:00:00.000Z',
        refreshToken: `refresh-${operations.length}`,
        sessionId: `session-${operations.length}`,
        tokenType: 'Bearer',
      }),
    };
    const authSessionCoordinator = createAuthSessionCoordinator({
      authRepository,
      authSessionStore: createMemoryOnlyAuthSessionStore(),
      now: () => new Date('2026-08-29T12:00:00.000Z'),
    });
    const controller = createWebRemoteRuntimeController({
      accountBootstrapRepository: {
        async load() {
          return createBootstrapFixture(membership);
        },
      },
      authRepository,
      authSessionCoordinator,
      learningEventSyncRepository: {
        async clearAccount(phoneNumber) {
          operations.push(`events-clear:${phoneNumber}:${clearAttempts + 1}`);
          clearAttempts += 1;
          if (clearAttempts === 1 || clearAttempts === 3) {
            throw new Error('injected event storage failure');
          }
          staleEventPresent = false;
        },
        enqueueCompletion: vi.fn(),
        getPendingCount: async () => 0,
        async startReplay(context) {
          operations.push(
            staleEventPresent
              ? `stale-replay:${context.phoneNumber}`
              : `clean-replay:${context.phoneNumber}`,
          );
          return {
            acknowledgements: [],
            acknowledgedEntries: [],
            pendingCount: 0,
          };
        },
      },
      learningSessionRepository: {
        continueRound: async () => undefined,
        async loadSession() {
          return createLearningSessionFixture('premium');
        },
      },
      mutationQueueRepository: {
        ...createMutationRepository(operations),
        async clear() {
          operations.push('mutation-clear');
        },
      },
      now: () => new Date('2026-08-29T12:00:00.000Z'),
      playAudio: async () => 'ready',
      runtimeSessionId: 'bootstrap-runtime:web-cleanup-test',
      track: 'cet4',
    });

    await controller.requestSmsCode(PHONE);
    await controller.verifySmsCode(PHONE, '123456');
    staleEventPresent = true;

    await expect(controller.logout()).rejects.toThrow(
      '本地待同步状态未能完整清理',
    );
    expect(controller.isAuthenticated()).toBe(false);
    await expect(controller.requestSmsCode(PHONE)).rejects.toThrow(
      '上一个 Web 会话',
    );
    expect(staleEventPresent).toBe(true);

    await controller.logout();
    expect(staleEventPresent).toBe(false);
    await controller.requestSmsCode(PHONE);
    const replayBoundary = operations.length;
    await controller.verifySmsCode(PHONE, '123456');
    expect(operations.slice(replayBoundary)).toContain(`clean-replay:${PHONE}`);
    expect(operations.slice(replayBoundary)).not.toContain(
      `stale-replay:${PHONE}`,
    );

    staleEventPresent = true;
    await authSessionCoordinator.invalidate();
    await expect(controller.cleanupInvalidatedSession()).rejects.toThrow(
      '本地待同步状态未能完整清理',
    );
    await expect(controller.requestSmsCode(PHONE)).rejects.toThrow(
      '上一个 Web 会话',
    );
    await controller.cleanupInvalidatedSession();
    expect(staleEventPresent).toBe(false);
  });

  it('retains a durably enqueued Learning event as queued after network ack failure', async () => {
    const membership = {
      ...createInitialMembershipState(),
      stage: 'premium' as const,
    };
    const authRepository = createSimpleAuthRepository();
    const authSessionCoordinator = createAuthSessionCoordinator({
      authRepository,
      authSessionStore: createMemoryOnlyAuthSessionStore(),
      now: () => new Date('2026-08-29T12:00:00.000Z'),
    });
    let pendingEventCount = 0;
    let networkAvailable = true;
    let enqueueCount = 0;
    const controller = createWebRemoteRuntimeController({
      accountBootstrapRepository: {
        async load() {
          return createBootstrapFixture(membership);
        },
      },
      authRepository,
      authSessionCoordinator,
      learningEventSyncRepository: {
        clearAccount: async () => undefined,
        async enqueueCompletion() {
          enqueueCount += 1;
          pendingEventCount = 1;
          return {} as never;
        },
        getPendingCount: async () => pendingEventCount,
        async startReplay() {
          if (!networkAvailable && pendingEventCount > 0) {
            throw new Error('injected acknowledgement network failure');
          }
          pendingEventCount = 0;
          return {
            acknowledgements: [],
            acknowledgedEntries: [],
            pendingCount: 0,
          };
        },
      },
      learningSessionRepository: {
        continueRound: async () => undefined,
        async loadSession() {
          return createLearningSessionFixture('premium');
        },
      },
      mutationQueueRepository: createMutationRepository([]),
      now: () => new Date('2026-08-29T12:00:00.000Z'),
      playAudio: async () => 'ready',
      runtimeSessionId: 'bootstrap-runtime:web-learning-pending',
      track: 'cet4',
    });

    await controller.requestSmsCode(PHONE);
    await controller.verifySmsCode(PHONE, '123456');
    networkAvailable = false;
    const result = createLearningResult();
    expect(await controller.completeCurrentCard(result)).toEqual({
      pendingEventCount: 1,
      status: 'queued',
    });
    expect(enqueueCount).toBe(1);
    await expect(
      controller.completeCurrentCard({...result, outcome: 'review'}),
    ).rejects.toThrow('must match the durably persisted answer');
    expect(pendingEventCount).toBe(1);
    expect(enqueueCount).toBe(1);

    networkAvailable = true;
    expect(await controller.completeCurrentCard(result)).toEqual({
      pendingEventCount: 0,
      status: 'confirmed',
    });
    expect(enqueueCount).toBe(1);
  });

  it.each(['malformed', 'network'] as const)(
    'keeps favorite and sleep overlays queued after a retryable %s Space response',
    async failureKind => {
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const membership = {
        ...createInitialMembershipState(),
        countedEntryCount: 1,
        stage: 'trial' as const,
        trialExpiresAt: '2026-09-03T12:00:00.000Z',
        trialRemainingSeconds: 432000,
        trialStartedAt: '2026-08-29T12:00:00.000Z',
        trialStartedAtEntryCount: 1,
      };
      const authRepository = createSimpleAuthRepository();
      const authSessionCoordinator = createAuthSessionCoordinator({
        authRepository,
        authSessionStore: createMemoryOnlyAuthSessionStore(),
        now: () => new Date('2026-08-29T12:00:00.000Z'),
      });
      const spaceStateRepository = createSpaceStateRepository({
        fetchImpl: async () => {
          if (failureKind === 'network') {
            throw new Error('injected network failure');
          }
          return {
            json: async () => ({data: {malformed: true}}),
            ok: true,
            status: 200,
          };
        },
        mode: 'remote',
        remoteConfig: {
          clientKind: 'web',
          endpoint: 'https://runtime.example.cn/v2/space/actions',
        },
      });
      const mutationQueueRepository = createMutationQueueRepository({
        membershipRepository: createMembershipRepository({mode: 'local'}),
        progressSyncRepository: createProgressSyncRepository({mode: 'local'}),
        queueManager: new MutationQueueManager({
          storage: createInMemoryMutationQueueStorage(),
        }),
        spaceStateRepository,
      });
      const controller = createWebRemoteRuntimeController({
        accountBootstrapRepository: {
          async load() {
            return createBootstrapFixture(membership);
          },
        },
        authRepository,
        authSessionCoordinator,
        learningEventSyncRepository: createEmptyEventSyncRepository(),
        learningSessionRepository: {
          continueRound: async () => undefined,
          async loadSession() {
            return createLearningSessionFixture('trial');
          },
        },
        mutationQueueRepository,
        now: () => new Date('2026-08-29T12:00:00.000Z'),
        playAudio: async () => 'ready',
        runtimeSessionId: `bootstrap-runtime:web-${failureKind}-test`,
        track: 'cet4',
      });

      try {
        await controller.requestSmsCode(PHONE);
        await controller.verifySmsCode(PHONE, '123456');
        const favoriteSnapshot = await controller.applySpaceState(
          '000001',
          'favorite',
          true,
        );
        expect(favoriteSnapshot.favorites).toEqual(['000001']);
        expect(favoriteSnapshot.spaceSync).toEqual({
          pendingActionCount: 1,
          rejectedActionCount: 0,
          rejectionCodes: [],
          status: 'queued',
        });

        const sleepingSnapshot = await controller.applySpaceState(
          '000001',
          'sleep',
          true,
        );
        expect(sleepingSnapshot.favorites).toEqual(['000001']);
        expect(sleepingSnapshot.sleeping).toEqual(['000001']);
        expect(sleepingSnapshot.spaceSync).toEqual({
          pendingActionCount: 2,
          rejectedActionCount: 0,
          rejectionCodes: [],
          status: 'queued',
        });
      } finally {
        warning.mockRestore();
      }
    },
  );

  it.each([
    'space_action_id_conflict',
    'space_card_not_in_content',
  ] as const)(
    'surfaces terminal Space 409 %s as rejected instead of confirmed',
    async rejectionCode => {
      const membership = {
        ...createInitialMembershipState(),
        countedEntryCount: 1,
        stage: 'trial' as const,
        trialExpiresAt: '2026-09-03T12:00:00.000Z',
        trialRemainingSeconds: 432000,
        trialStartedAt: '2026-08-29T12:00:00.000Z',
        trialStartedAtEntryCount: 1,
      };
      const authRepository = createSimpleAuthRepository();
      const authSessionCoordinator = createAuthSessionCoordinator({
        authRepository,
        authSessionStore: createMemoryOnlyAuthSessionStore(),
        now: () => new Date('2026-08-29T12:00:00.000Z'),
      });
      let spaceFailure: 'retryable' | 'terminal' = 'terminal';
      const mutationQueueRepository = createMutationQueueRepository({
        membershipRepository: createMembershipRepository({mode: 'local'}),
        progressSyncRepository: createProgressSyncRepository({mode: 'local'}),
        queueManager: new MutationQueueManager({
          storage: createInMemoryMutationQueueStorage(),
        }),
        spaceStateRepository: createSpaceStateRepository({
          fetchImpl: async () => {
            if (spaceFailure === 'retryable') {
              throw new Error('injected retryable Space network failure');
            }
            return {
              json: async () => ({error: {code: rejectionCode}}),
              ok: false,
              status: 409,
            };
          },
          mode: 'remote',
          remoteConfig: {
            clientKind: 'web',
            endpoint: 'https://runtime.example.cn/v2/space/actions',
          },
        }),
      });
      const controller = createWebRemoteRuntimeController({
        accountBootstrapRepository: {
          async load() {
            return createBootstrapFixture(membership);
          },
        },
        authRepository,
        authSessionCoordinator,
        learningEventSyncRepository: createEmptyEventSyncRepository(),
        learningSessionRepository: {
          continueRound: async () => undefined,
          async loadSession() {
            return createLearningSessionFixture('trial');
          },
        },
        mutationQueueRepository,
        now: () => new Date('2026-08-29T12:00:00.000Z'),
        playAudio: async () => 'ready',
        runtimeSessionId: `bootstrap-runtime:web-${rejectionCode}`,
        track: 'cet4',
      });

      await controller.requestSmsCode(PHONE);
      await controller.verifySmsCode(PHONE, '123456');
      const snapshot = await controller.applySpaceState(
        '000001',
        'favorite',
        true,
      );

      expect(snapshot.favorites).toEqual([]);
      expect(snapshot.spaceSync).toEqual({
        pendingActionCount: 0,
        rejectedActionCount: 1,
        rejectionCodes: [rejectionCode],
        status: 'rejected',
      });
      const reloadedSnapshot = await controller.loadAuthenticatedState();
      expect(reloadedSnapshot.spaceSync).toEqual({
        pendingActionCount: 0,
        rejectedActionCount: 1,
        rejectionCodes: [rejectionCode],
        status: 'rejected',
      });
      spaceFailure = 'retryable';
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const combinedSnapshot = await controller.applySpaceState(
          '000001',
          'sleep',
          true,
        );
        expect(combinedSnapshot.sleeping).toEqual(['000001']);
        expect(combinedSnapshot.spaceSync).toEqual({
          pendingActionCount: 1,
          rejectedActionCount: 1,
          rejectionCodes: [rejectionCode],
          status: 'queued_and_rejected',
        });
        const combinedReload = await controller.loadAuthenticatedState();
        expect(combinedReload.spaceSync).toEqual({
          pendingActionCount: 1,
          rejectedActionCount: 1,
          rejectionCodes: [rejectionCode],
          status: 'queued_and_rejected',
        });
      } finally {
        warning.mockRestore();
      }
    },
  );

  it('reports confirmed Space only after ack and a force-fresh bootstrap', async () => {
    const membership = {
      ...createInitialMembershipState(),
      countedEntryCount: 1,
      stage: 'trial' as const,
      trialExpiresAt: '2026-09-03T12:00:00.000Z',
      trialRemainingSeconds: 432000,
      trialStartedAt: '2026-08-29T12:00:00.000Z',
      trialStartedAtEntryCount: 1,
    };
    const bootstrapForceFresh: boolean[] = [];
    let canonicalFavorite = false;
    const authRepository = createSimpleAuthRepository();
    const authSessionCoordinator = createAuthSessionCoordinator({
      authRepository,
      authSessionStore: createMemoryOnlyAuthSessionStore(),
      now: () => new Date('2026-08-29T12:00:00.000Z'),
    });
    const spaceStateRepository = createSpaceStateRepository({
      async fetchImpl(_input, init) {
        const request = JSON.parse(init?.body ?? '{}');
        const action = request.actions[0];
        canonicalFavorite = action.value;
        return {
          json: async () => ({
            data: {
              acknowledged_at: '2026-08-29T12:01:00.000Z',
              content_version: request.content_version,
              results: [
                {action_id: action.action_id, status: 'applied'},
              ],
              schema_version: 'space-actions-ack.v2',
              space_state: {
                acknowledged_at: '2026-08-29T12:01:00.000Z',
                content_version: request.content_version,
                schema_version: 'space-state.v2',
                states: [
                  {
                    card_id: '000001',
                    is_favorited: canonicalFavorite,
                    is_sleeping: false,
                    last_modified_at: action.client_occurred_at,
                  },
                ],
                track: request.track,
              },
              track: request.track,
            },
          }),
          ok: true,
          status: 200,
        };
      },
      mode: 'remote',
      remoteConfig: {
        clientKind: 'web',
        endpoint: 'https://runtime.example.cn/v2/space/actions',
      },
    });
    const mutationQueueRepository = createMutationQueueRepository({
      membershipRepository: createMembershipRepository({mode: 'local'}),
      progressSyncRepository: createProgressSyncRepository({mode: 'local'}),
      queueManager: new MutationQueueManager({
        storage: createInMemoryMutationQueueStorage(),
      }),
      spaceStateRepository,
    });
    const controller = createWebRemoteRuntimeController({
      accountBootstrapRepository: {
        async load(_track, _dayKey, options) {
          bootstrapForceFresh.push(options?.forceFresh === true);
          return createBootstrapFixtureWithSpace(
            membership,
            canonicalFavorite,
          );
        },
      },
      authRepository,
      authSessionCoordinator,
      learningEventSyncRepository: createEmptyEventSyncRepository(),
      learningSessionRepository: {
        continueRound: async () => undefined,
        async loadSession() {
          return createLearningSessionFixture('trial');
        },
      },
      mutationQueueRepository,
      now: () => new Date('2026-08-29T12:00:00.000Z'),
      playAudio: async () => 'ready',
      runtimeSessionId: 'bootstrap-runtime:web-confirmed-test',
      track: 'cet4',
    });

    await controller.requestSmsCode(PHONE);
    await controller.verifySmsCode(PHONE, '123456');
    const snapshot = await controller.applySpaceState(
      '000001',
      'favorite',
      true,
    );

    expect(bootstrapForceFresh.slice(-2)).toEqual([false, true]);
    expect(snapshot.favorites).toEqual(['000001']);
    expect(snapshot.spaceSync).toEqual({
      pendingActionCount: 0,
      rejectedActionCount: 0,
      rejectionCodes: [],
      status: 'confirmed',
    });
  });

  it('preserves unknown deletion state and clears stores only after exact acceptance', async () => {
    const operations: string[] = [];
    const authRepository = createSimpleAuthRepository();
    const authSessionCoordinator = createAuthSessionCoordinator({
      authRepository,
      authSessionStore: createMemoryOnlyAuthSessionStore(),
    });
    let persistedDeletionState: {
      phase: 'accepted' | 'registration_ready' | 'requesting';
      phoneNumber: string;
    } | null = null;
    const requestDeletion = vi
      .fn()
      .mockRejectedValueOnce(new Error('lost response'))
      .mockResolvedValueOnce({
        id: 'delete_123456789012',
        requestedAt: '2026-08-29T12:00:00.000Z',
        status: 'queued',
      });
    const setAccountDeletionQuarantine = vi.fn(
      (_sessionScopeKey: string, active: boolean) => {
        operations.push(`deletion-quarantine-${String(active)}`);
      },
    );
    const controller = createWebRemoteRuntimeController({
      accountBootstrapRepository: {
        async load() {
          return createBootstrapFixture(createInitialMembershipState());
        },
      },
      accountDeletionRepository: {requestDeletion},
      accountDeletionStateStore: {
        async clear() {
          operations.push('deletion-marker-clear');
          persistedDeletionState = null;
        },
        async getRevision() {
          return 0;
        },
        async load() {
          return persistedDeletionState;
        },
        async mark(phoneNumber, phase) {
          operations.push(`deletion-marker-${phase}`);
          persistedDeletionState = {phase, phoneNumber};
        },
      },
      authRepository,
      authSessionCoordinator,
      learningEventSyncRepository: {
        ...createEmptyEventSyncRepository(),
        async clearAccount(phoneNumber) {
          operations.push(`events-clear:${phoneNumber}`);
        },
      },
      learningSessionRepository: {
        continueRound: async () => undefined,
        async loadSession() {
          return createLearningSessionFixture(null);
        },
      },
      mutationQueueRepository: createMutationRepository(operations),
      playAudio: async () => 'ready',
      setAccountDeletionQuarantine,
      track: 'cet4',
    });

    await controller.requestSmsCode(PHONE);
    await controller.verifySmsCode(PHONE, '123456');
    await expect(controller.requestAccountDeletion()).resolves.toEqual({
      status: 'unknown',
    });
    expect(controller.isAuthenticated()).toBe(true);
    expect(persistedDeletionState).toEqual({
      phase: 'requesting',
      phoneNumber: PHONE,
    });
    expect(setAccountDeletionQuarantine).toHaveBeenCalledWith(
      'remote:13800138000:session-simple',
      true,
    );
    expect(operations.indexOf('deletion-quarantine-true')).toBeLessThan(
      operations.indexOf('deletion-marker-requesting'),
    );
    expect(operations).not.toContain(`events-clear:${PHONE}`);
    await expect(controller.loadAuthenticatedState()).rejects.toThrow(
      '已暂停新的账户操作',
    );

    await expect(controller.requestAccountDeletion()).resolves.toEqual({
      status: 'accepted',
    });
    expect(controller.isAuthenticated()).toBe(false);
    expect(persistedDeletionState).toBeNull();
    expect(operations).toContain(`events-clear:${PHONE}`);
    expect(operations).toContain('mutation-clear');
    expect(operations.at(-1)).toBe('deletion-marker-clear');
  });

  it('recovers pending deletion through dedicated SMS without creating a session', async () => {
    const operations: string[] = [];
    const authRepository = createSimpleAuthRepository();
    const authRequestCode = vi.spyOn(authRepository, 'requestSmsCode');
    const authVerifyCode = vi.spyOn(authRepository, 'verifySmsCode');
    const authSessionCoordinator = createAuthSessionCoordinator({
      authRepository,
      authSessionStore: createMemoryOnlyAuthSessionStore(),
    });
    let persistedDeletionState: {
      phase: 'accepted' | 'registration_ready' | 'requesting';
      phoneNumber: string;
    } | null = {phase: 'requesting', phoneNumber: PHONE};
    const requestRecoveryCode = vi.fn(async () => ({
      challengeId: 'challenge_recovery_1234567890',
      delivery: 'sms',
      expiresAt: '2026-08-29T12:05:00.000Z',
      phoneNumber: PHONE,
      retryAfterSeconds: 0,
    }));
    const verifyRecoveryCode = vi.fn(async () => ({
      deletionRequest: {
        id: 'delete_recovered1234',
        requestedAt: '2026-08-29T12:00:00.000Z',
        status: 'processing' as const,
      },
      safeToRegister: false as const,
      state: 'pending' as const,
    }));
    const controller = createWebRemoteRuntimeController({
      accountBootstrapRepository: {
        async load() {
          throw new Error('recovery must not hydrate account data');
        },
      },
      accountDeletionRecoveryRepository: {
        requestCode: requestRecoveryCode,
        verifyCode: verifyRecoveryCode,
      },
      accountDeletionStateStore: {
        async clear() {
          operations.push('deletion-marker-clear');
          persistedDeletionState = null;
        },
        async getRevision() {
          return 0;
        },
        async load() {
          return persistedDeletionState;
        },
        async mark(phoneNumber, phase) {
          operations.push(`deletion-marker-${phase}`);
          persistedDeletionState = {phase, phoneNumber};
        },
      },
      authRepository,
      authSessionCoordinator,
      learningEventSyncRepository: {
        ...createEmptyEventSyncRepository(),
        async clearAccount(phoneNumber) {
          operations.push(`events-clear:${phoneNumber}`);
        },
      },
      learningSessionRepository: {
        continueRound: async () => undefined,
        async loadSession() {
          throw new Error('recovery must not load a learning session');
        },
      },
      mutationQueueRepository: createMutationRepository(operations),
      playAudio: async () => 'ready',
      track: 'cet4',
    });

    await expect(controller.resumeAccountDeletion()).resolves.toEqual({
      phoneNumber: PHONE,
      status: 'reauthentication_required',
    });
    await expect(controller.requestSmsCode(PHONE)).rejects.toThrow(
      '删除恢复入口',
    );
    const challenge =
      await controller.requestAccountDeletionRecoverySmsCode();
    expect(challenge.phoneNumber).toBe(PHONE);
    await expect(
      controller.verifyAccountDeletionRecoverySmsCode('123456'),
    ).resolves.toEqual({status: 'accepted'});

    expect(requestRecoveryCode).toHaveBeenCalledWith(PHONE);
    expect(verifyRecoveryCode).toHaveBeenCalledWith({
      challenge,
      smsCode: '123456',
    });
    expect(authRequestCode).not.toHaveBeenCalled();
    expect(authVerifyCode).not.toHaveBeenCalled();
    expect(operations).toEqual([
      'deletion-marker-accepted',
      `events-clear:${PHONE}`,
      'mutation-clear',
      'deletion-marker-clear',
    ]);
    expect(controller.isAuthenticated()).toBe(false);
    expect(persistedDeletionState).toBeNull();
  });

  it('maps dedicated recovery none to safe registration without accepted copy', async () => {
    const operations: string[] = [];
    let mutationClearAttempts = 0;
    const authRepository = createSimpleAuthRepository();
    const authSessionCoordinator = createAuthSessionCoordinator({
      authRepository,
      authSessionStore: createMemoryOnlyAuthSessionStore(),
    });
    let persistedDeletionState: {
      phase: 'accepted' | 'registration_ready' | 'requesting';
      phoneNumber: string;
    } | null = {phase: 'requesting', phoneNumber: PHONE};
    const controller = createWebRemoteRuntimeController({
      accountBootstrapRepository: {
        async load() {
          throw new Error('recovery must not hydrate account data');
        },
      },
      accountDeletionRecoveryRepository: {
        async requestCode(phoneNumber) {
          return {
            challengeId: 'challenge_recovery_1234567890',
            delivery: 'sms',
            expiresAt: '2026-08-29T12:05:00.000Z',
            phoneNumber,
            retryAfterSeconds: 0,
          };
        },
        async verifyCode() {
          return {
            deletionRequest: null,
            safeToRegister: true,
            state: 'none',
          };
        },
      },
      accountDeletionStateStore: {
        async clear() {
          operations.push('deletion-marker-clear');
          persistedDeletionState = null;
        },
        async getRevision() {
          return 0;
        },
        async load() {
          return persistedDeletionState;
        },
        async mark(phoneNumber, phase) {
          operations.push(`deletion-marker-${phase}`);
          persistedDeletionState = {phase, phoneNumber};
        },
      },
      authRepository,
      authSessionCoordinator,
      learningEventSyncRepository: {
        ...createEmptyEventSyncRepository(),
        async clearAccount(phoneNumber) {
          operations.push(`events-clear:${phoneNumber}`);
        },
      },
      learningSessionRepository: {
        continueRound: async () => undefined,
        async loadSession() {
          throw new Error('recovery must not load a learning session');
        },
      },
      mutationQueueRepository: {
        ...createMutationRepository(operations),
        async clear() {
          mutationClearAttempts += 1;
          operations.push('mutation-clear');
          if (mutationClearAttempts === 1) {
            throw new Error('injected local cleanup failure');
          }
        },
      },
      playAudio: async () => 'ready',
      track: 'cet4',
    });

    await controller.requestAccountDeletionRecoverySmsCode();
    await expect(
      controller.verifyAccountDeletionRecoverySmsCode('123456'),
    ).resolves.toEqual({status: 'registration_cleanup_required'});
    expect(persistedDeletionState).toEqual({
      phase: 'registration_ready',
      phoneNumber: PHONE,
    });
    await expect(controller.resumeAccountDeletion()).resolves.toEqual({
      status: 'registration_ready',
    });
    expect(operations).toEqual([
      'deletion-marker-registration_ready',
      `events-clear:${PHONE}`,
      'mutation-clear',
      `events-clear:${PHONE}`,
      'mutation-clear',
      'deletion-marker-clear',
    ]);
    expect(controller.isAuthenticated()).toBe(false);
    expect(persistedDeletionState).toBeNull();
  });

  it('quarantines an old tab after another tab completes deletion cleanup', async () => {
    localStorage.clear();
    const authRepository = createSimpleAuthRepository();
    const authSessionCoordinator = createAuthSessionCoordinator({
      authRepository,
      authSessionStore: createMemoryOnlyAuthSessionStore(),
    });
    const controllerDeletionStore =
      createWebAccountDeletionStateStore(localStorage);
    const otherTabDeletionStore =
      createWebAccountDeletionStateStore(localStorage);
    let bootstrapLoads = 0;
    const controller = createWebRemoteRuntimeController({
      accountBootstrapRepository: {
        async load() {
          bootstrapLoads += 1;
          return createBootstrapFixture(createInitialMembershipState());
        },
      },
      accountDeletionRepository: {
        async requestDeletion() {
          throw new Error('stale tab must not reach deletion transport');
        },
      },
      accountDeletionStateStore: controllerDeletionStore,
      authRepository,
      authSessionCoordinator,
      learningEventSyncRepository: createEmptyEventSyncRepository(),
      learningSessionRepository: {
        continueRound: async () => undefined,
        async loadSession() {
          return createLearningSessionFixture(null);
        },
      },
      mutationQueueRepository: createMutationRepository([]),
      playAudio: async () => 'ready',
      track: 'cet4',
    });

    await controller.requestSmsCode(PHONE);
    await controller.verifySmsCode(PHONE, '123456');
    expect(bootstrapLoads).toBe(1);
    await otherTabDeletionStore.mark(PHONE, 'requesting');
    await otherTabDeletionStore.mark(PHONE, 'accepted');
    await otherTabDeletionStore.clear();

    await expect(controller.loadAuthenticatedState()).rejects.toThrow(
      '账户隔离状态已变化',
    );
    expect(bootstrapLoads).toBe(1);
    await expect(controller.requestAccountDeletion()).rejects.toThrow(
      'changed in another tab',
    );
    await expect(controllerDeletionStore.load()).resolves.toBeNull();
  });

  it('persists explicit check-in before reporting server confirmation', async () => {
    let checkedInToday = false;
    const authRepository = createSimpleAuthRepository();
    const authSessionCoordinator = createAuthSessionCoordinator({
      authRepository,
      authSessionStore: createMemoryOnlyAuthSessionStore(),
    });
    const checkIn = vi.fn(async (_context, dayKey: string) => {
      checkedInToday = true;
      return {
        acknowledgedAt: '2026-08-29T12:01:00.000Z',
        checkedInToday: true as const,
        dayKey,
        mode: 'remote' as const,
      };
    });
    const mutationQueueRepository = createMutationQueueRepository({
      membershipRepository: createMembershipRepository({mode: 'local'}),
      progressSyncRepository: {checkIn},
      queueManager: new MutationQueueManager({
        storage: createInMemoryMutationQueueStorage(),
      }),
      spaceStateRepository: createSpaceStateRepository({mode: 'local'}),
    });
    const controller = createWebRemoteRuntimeController({
      accountBootstrapRepository: {
        async load() {
          const bootstrap = createBootstrapFixture(
            createInitialMembershipState(),
          );
          bootstrap.progress.snapshot.learningCompletedCount = 1;
          bootstrap.progress.snapshot.totalCompletedCount = 1;
          bootstrap.progress.snapshot.checkedInToday = checkedInToday;
          return bootstrap;
        },
      },
      authRepository,
      authSessionCoordinator,
      learningEventSyncRepository: createEmptyEventSyncRepository(),
      learningSessionRepository: {
        continueRound: async () => undefined,
        async loadSession() {
          return createLearningSessionFixture(null);
        },
      },
      mutationQueueRepository,
      playAudio: async () => 'ready',
      track: 'cet4',
    });

    await controller.requestSmsCode(PHONE);
    const initial = await controller.verifySmsCode(PHONE, '123456');
    expect(initial.checkInSync.status).toBe('ready');
    const confirmed = await controller.checkInToday();

    expect(checkIn).toHaveBeenCalledTimes(1);
    expect(confirmed.checkInSync).toEqual({
      checkedInToday: true,
      pending: false,
      status: 'confirmed',
    });
  });
});

function createBootstrapFixture(
  membership: ReturnType<typeof createInitialMembershipState>,
): AccountBootstrapSnapshot {
  return {
    componentRevisions: {
      learning: {eventServerSequence: 0, sessionRevision: 0, spaceRevision: 0},
      membership: {
        baseMembershipRevision: 1,
        betaEntitlementRevision: 0,
        pilotEntitlementRevision: 0,
      },
      progress: {checkInRevision: 0, learningServerSequence: 0, spaceRevision: 0},
      schemaVersion: 'bootstrap-component-revisions.v1',
      space: {stateRevision: 0},
    },
    content: {
      cardCount: 1,
      minimumClientVersion: '0.1.0',
      parentReleaseId: null,
      publishedAt: '2026-08-29T00:00:00.000Z',
      releaseClass: 'production',
      releaseId: 'release-2026',
      source: {id: 'source-1', label: 'CET4'},
      version: `sha256:${'12'.repeat(32)}`,
    },
    dayKey: '2026-08-29',
    generatedAt: '2026-08-29T12:00:00.000Z',
    learning: {acknowledgedAt: null, cardStates: [], cursor: null, source: null},
    membership: {acknowledgedAt: '2026-08-29T12:00:00.000Z', state: membership},
    progress: {
      acknowledgedAt: null,
      learningAuthority: 'empty',
      snapshot: {
        checkedInToday: false,
        dayKey: '2026-08-29',
        favoriteCount: 0,
        learningCompletedCount: 0,
        pendingReviewCount: 0,
        reviewCompletedCount: 0,
        sleepingCount: 0,
        totalCompletedCount: 0,
      },
    },
    schemaVersion: 'bootstrap.v2',
    space: {
      acknowledgedAt: null,
      snapshot: {dayKey: '2026-08-29', states: []},
    },
    track: 'cet4',
  };
}

function createBootstrapFixtureWithSpace(
  membership: ReturnType<typeof createInitialMembershipState>,
  isFavorited: boolean,
): AccountBootstrapSnapshot {
  const bootstrap = createBootstrapFixture(membership);
  if (!isFavorited) {
    return bootstrap;
  }
  return {
    ...bootstrap,
    componentRevisions: {
      ...bootstrap.componentRevisions,
      learning: {
        ...bootstrap.componentRevisions.learning,
        spaceRevision: 1,
      },
      progress: {
        ...bootstrap.componentRevisions.progress,
        spaceRevision: 1,
      },
      space: {stateRevision: 1},
    },
    progress: {
      ...bootstrap.progress,
      snapshot: {...bootstrap.progress.snapshot, favoriteCount: 1},
    },
    space: {
      acknowledgedAt: '2026-08-29T12:01:00.000Z',
      snapshot: {
        dayKey: '2026-08-29',
        states: [
          {
            cardId: '000001',
            isFavorited: true,
            isSleeping: false,
            lastModifiedAt: '2026-08-29T12:01:00.000Z',
          },
        ],
      },
    },
  };
}

function createLearningSessionFixture(
  membershipStage: LearningSession['membershipStage'] = 'trial',
): LearningSession {
  return {
    cards: [card],
    catalogCards: [card],
    contentManifest: null,
    contentVersion: `sha256:${'12'.repeat(32)}`,
    membershipStage,
    membershipTrialExpiresAt: null,
    membershipTrialRemainingSeconds: 0,
    membershipTrialStartedAt: null,
    nextDueAt: null,
    roundCompletion: null,
    schedulingMode: 'server',
    serverSelection: {
      cardId: '000001',
      dueAt: null,
      phase: 'learning',
      reason: 'catalog_new',
      selectionId: 'sel_1234567890abcdef',
    },
    sourceId: 'source-1',
    sourceLabel: 'CET4',
    track: 'cet4',
  };
}

const card = {
  analysis: {exam_tip: 'tip', summary: 'summary', title: 'title'},
  back_text: 'answer',
  card_id: '000001',
  front: {
    context: 'context',
    eyebrow: 'eyebrow',
    prompt: 'prompt',
    support: 'support',
  },
  interaction_id: 'flip',
  knowledge_ref: 'knowledge',
  space_metadata: {
    box: 'box',
    box_ref: 'box-ref',
    group: 'group',
    library: 'library',
  },
  track: 'cet4',
} as const;

function createLearningResult() {
  return {
    cardId: '000001',
    completedAt: '2026-08-29T12:01:00.000Z',
    interactionId: 'flip' as const,
    isFavorited: false,
    outcome: 'confident' as const,
    usedHint: false,
    usedPeek: false,
  };
}

function createSimpleAuthRepository(): AuthRepository {
  return {
    logout: async () => undefined,
    refreshSession: async session => session,
    requestSmsCode: async phoneNumber => ({
      challengeId: 'challenge-simple',
      expiresAt: '2026-08-29T12:05:00.000Z',
      mode: 'remote',
      phoneNumber,
      retryAfterSeconds: 0,
    }),
    verifySmsCode: async input => ({
      accessToken: 'access-simple',
      accessTokenExpiresAt: '2026-08-29T13:00:00.000Z',
      mode: 'remote',
      phoneNumber: input.phoneNumber,
      refreshExpiresAt: '2026-09-29T12:00:00.000Z',
      refreshToken: 'refresh-simple',
      sessionId: 'session-simple',
      tokenType: 'Bearer',
    }),
  };
}

function createEmptyEventSyncRepository() {
  return {
    clearAccount: async () => undefined,
    enqueueCompletion: vi.fn(),
    getPendingCount: async () => 0,
    async startReplay() {
      return {
        acknowledgements: [],
        acknowledgedEntries: [],
        pendingCount: 0,
      };
    },
  };
}

function createMutationRepository(operations: string[]) {
  return {
    async clear() {
      operations.push('mutation-clear');
    },
    enqueueMutation: vi.fn(),
    getPendingCheckIn: vi.fn(),
    getPendingSpaceActions: async () => [],
    getQuarantinedSpaceActions: async () => [],
    getQueueSize: async () => 0,
    hasPendingCheckIn: async () => false,
    async hydrate() {
      operations.push('mutation-hydrate');
    },
    isReplaying: () => false,
    async startReplay() {
      operations.push('mutation-replay');
      return [];
    },
  };
}
