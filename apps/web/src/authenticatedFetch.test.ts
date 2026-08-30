import type {AuthRepository} from '../../mobile/src/auth/authRepository';
import {createAuthenticatedFetch} from '../../mobile/src/auth/authenticatedFetch';
import {createAuthSessionCoordinator} from '../../mobile/src/auth/authSessionCoordinator';
import {createMemoryOnlyAuthSessionStore} from './webStorage';

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
});

async function createCoordinator() {
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
