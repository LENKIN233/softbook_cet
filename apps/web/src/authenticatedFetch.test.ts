import type {AuthRepository} from '../../mobile/src/auth/authRepository';
import {createAuthenticatedFetch} from '../../mobile/src/auth/authenticatedFetch';
import {createAuthSessionCoordinator} from '../../mobile/src/auth/authSessionCoordinator';
import {createMemoryOnlyAuthSessionStore} from './webStorage';
import {createWebAccountDeletionStateStore} from './webAccountDeletionState';

describe('Web authenticated fetch deadline', () => {
  it('keeps the deadline active through response body parsing', async () => {
    vi.useFakeTimers();
    try {
      const coordinator = await createCoordinator();
      let requestSignal: AbortSignal | undefined;
      const authenticatedFetch = createAuthenticatedFetch({
        authSessionCoordinator: coordinator,
        fetchImpl: async (_input, init) => {
          requestSignal = init?.signal ?? undefined;
          return new Response(
            new ReadableStream<Uint8Array>({
              start() {
                // Headers resolve immediately while the JSON body never ends.
              },
            }),
            {headers: {'content-type': 'application/json'}, status: 200},
          );
        },
        timeoutMs: 25,
      });

      const response = await authenticatedFetch('https://runtime.example.cn/v2/bootstrap');
      const assertion = expect(response.json()).rejects.toThrow(
        'Remote request timed out.',
      );
      await vi.advanceTimersByTimeAsync(26);
      await assertion;
      expect(requestSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels an unread body when its originating session changed', async () => {
    const coordinator = await createCoordinator();
    let requestSignal: AbortSignal | undefined;
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      fetchImpl: async (_input, init) => {
        requestSignal = init?.signal ?? undefined;
        return new Response(
          new ReadableStream<Uint8Array>({
            start() {
              // A stale response must not keep consuming bytes.
            },
          }),
          {headers: {'content-type': 'application/json'}, status: 200},
        );
      },
      timeoutMs: 1_000,
    });

    const response = await authenticatedFetch(
      'https://runtime.example.cn/v2/bootstrap',
    );
    await coordinator.invalidate();

    await expect(response.json()).rejects.toMatchObject({
      reason: 'session_superseded',
    });
    expect(requestSignal?.aborted).toBe(true);
  });

  it('does not start transport after cancellation while token refresh is pending', async () => {
    let markRefreshStarted: (() => void) | undefined;
    let resolveRefresh:
      | ((session: Awaited<ReturnType<AuthRepository['refreshSession']>>) => void)
      | undefined;
    const refreshStarted = new Promise<void>(resolve => {
      markRefreshStarted = resolve;
    });
    const refreshResult = new Promise<
      Awaited<ReturnType<AuthRepository['refreshSession']>>
    >(resolve => {
      resolveRefresh = resolve;
    });
    const authRepository: AuthRepository = {
      logout: async () => undefined,
      refreshSession: async () => {
        markRefreshStarted?.();
        return refreshResult;
      },
      requestSmsCode: async phoneNumber => ({
        challengeId: 'challenge-web-cancel-refresh',
        expiresAt: '2026-08-29T12:05:00.000Z',
        mode: 'remote',
        phoneNumber,
        retryAfterSeconds: 0,
      }),
      verifySmsCode: async () => {
        throw new Error('not used');
      },
    };
    const coordinator = createAuthSessionCoordinator({
      authRepository,
      authSessionStore: createMemoryOnlyAuthSessionStore(),
      now: () => new Date('2026-08-29T12:00:00.000Z'),
    });
    await coordinator.establish({
      accessToken: 'expiring-access',
      accessTokenExpiresAt: '2026-08-29T12:00:30.000Z',
      mode: 'remote',
      phoneNumber: '13800138000',
      refreshExpiresAt: '2026-09-29T12:00:00.000Z',
      refreshToken: 'refresh-before-cancel',
      sessionId: 'session-web-cancel-refresh',
      tokenType: 'Bearer',
    });
    const fetchImpl = vi.fn<typeof fetch>();
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      fetchImpl,
      timeoutMs: 1_000,
    });
    const caller = new AbortController();

    const request = authenticatedFetch('https://runtime.example.cn/v2/bootstrap', {
      signal: caller.signal,
    });
    await refreshStarted;
    caller.abort();
    await expect(request).rejects.toMatchObject({reason: 'caller_cancelled'});

    resolveRefresh?.({
      accessToken: 'refreshed-after-cancel',
      accessTokenExpiresAt: '2026-08-29T13:00:00.000Z',
      mode: 'remote',
      phoneNumber: '13800138000',
      refreshExpiresAt: '2026-09-29T12:00:00.000Z',
      refreshToken: 'rotated-after-cancel',
      sessionId: 'session-web-cancel-refresh',
      tokenType: 'Bearer',
    });
    await refreshResult;
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('preserves the Web session when a 403 cleanup marker cannot be written', async () => {
    localStorage.clear();
    const stateStore = createWebAccountDeletionStateStore(localStorage);
    const coordinator = await createCoordinator(async () => {
      throw new Error('injected marker failure');
    });
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      fetchImpl: vi.fn(async () => new Response(null, {status: 403})),
    });

    await expect(
      authenticatedFetch('https://runtime.example.cn/v2/bootstrap'),
    ).rejects.toThrow('injected marker failure');

    expect(coordinator.getCurrentSession()).not.toBeNull();
    await expect(stateStore.load()).resolves.toBeNull();
  });

  it('persists local cleanup before a terminal 401 clears the Web session', async () => {
    localStorage.clear();
    const stateStore = createWebAccountDeletionStateStore(localStorage);
    let expectedRevision = 0;
    const coordinator = await createCoordinator(async ({session}) => {
      expectedRevision =
        (
          await stateStore.ensureCleanupAuthority?.(
            session.phoneNumber,
            expectedRevision,
          )
        )?.revision ?? expectedRevision;
    });
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      fetchImpl: vi.fn(async () => new Response(null, {status: 401})),
    });

    await expect(
      authenticatedFetch('https://runtime.example.cn/v2/bootstrap'),
    ).resolves.toMatchObject({status: 401});

    expect(coordinator.getCurrentSession()).toBeNull();
    await expect(stateStore.load()).resolves.toEqual({
      phase: 'local_cleanup',
      phoneNumber: '13800138000',
    });
    await expect(stateStore.getRevision()).resolves.toBe(1);
  });

  it.each(['requesting', 'accepted', 'registration_ready'] as const)(
    'terminal invalidation observes %s deletion authority without clearing it',
    async phase => {
      localStorage.clear();
      const stateStore = createWebAccountDeletionStateStore(localStorage);
      const coordinator = await createCoordinator(async ({session}) => {
        await stateStore.ensureCleanupAuthority?.(session.phoneNumber, 0);
      });
      await stateStore.mark('13800138000', 'requesting');
      if (phase !== 'requesting') {
        await stateStore.mark('13800138000', phase);
      }
      const authenticatedFetch = createAuthenticatedFetch({
        authSessionCoordinator: coordinator,
        fetchImpl: vi.fn(async () => new Response(null, {status: 403})),
      });

      await expect(
        authenticatedFetch('https://runtime.example.cn/v2/bootstrap'),
      ).resolves.toMatchObject({status: 403});

      expect(coordinator.getCurrentSession()).toBeNull();
      await expect(stateStore.load()).resolves.toEqual({
        phase,
        phoneNumber: '13800138000',
      });
    },
  );
});

async function createCoordinator(
  beforeSessionInvalidation?: Parameters<
    typeof createAuthSessionCoordinator
  >[0]['beforeSessionInvalidation'],
) {
  const authRepository: AuthRepository = {
    logout: async () => undefined,
    refreshSession: async session => session,
    requestSmsCode: async phoneNumber => ({
      challengeId: 'challenge-web-deadline',
      expiresAt: '2099-08-29T12:05:00.000Z',
      mode: 'remote',
      phoneNumber,
      retryAfterSeconds: 0,
    }),
    verifySmsCode: async () => {
      throw new Error('not used');
    },
  };
  const coordinator = createAuthSessionCoordinator({
    authRepository,
    authSessionStore: createMemoryOnlyAuthSessionStore(),
    beforeSessionInvalidation,
  });
  await coordinator.establish({
    accessToken: 'memory-access',
    accessTokenExpiresAt: '2099-08-29T13:00:00.000Z',
    mode: 'remote',
    phoneNumber: '13800138000',
    refreshExpiresAt: '2099-09-29T12:00:00.000Z',
    refreshToken: 'memory-refresh',
    sessionId: 'session-web-deadline',
    tokenType: 'Bearer',
  });
  return coordinator;
}
