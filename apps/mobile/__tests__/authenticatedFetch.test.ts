import {createAuthenticatedFetch} from '../src/auth/authenticatedFetch';
import type {AuthRepository} from '../src/auth/authRepository';
import {
  createAuthSessionCoordinator,
  type AuthSessionCoordinator,
} from '../src/auth/authSessionCoordinator';
import type {RemoteAuthSession} from '../src/auth/authSession';
import type {AuthSessionStore} from '../src/persistence/authSessionStore';
import {RemoteRequestLifecycleError} from '../src/runtime/remoteRequest';

function createResponse(status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
  } as Response;
}

function createCoordinator() {
  let accessToken = 'access-0';
  const coordinator: AuthSessionCoordinator = {
    establish: jest.fn(),
    forceRefresh: jest.fn(async () => {
      accessToken = 'access-1';
      return {
        accessToken,
        accessTokenExpiresAt: '2099-07-20T00:15:00.000Z',
        mode: 'remote' as const,
        phoneNumber: '13800138000',
        refreshExpiresAt: '2099-08-19T00:00:00.000Z',
        refreshToken: 'refresh-1',
        sessionId: 'session-123',
        tokenType: 'Bearer' as const,
      };
    }),
    getAccessToken: jest.fn(async () => accessToken),
    getCurrentSession: jest.fn(() => null),
    invalidate: jest.fn(async () => undefined),
    logout: jest.fn(),
    restore: jest.fn(),
    subscribeSessionScope: jest.fn(() => () => undefined),
  };

  return coordinator;
}

test('authenticated fetch replaces a stale authorization header', async () => {
  const coordinator = createCoordinator();
  const fetchImpl = jest.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      createResponse(200),
  );
  const authenticatedFetch = createAuthenticatedFetch({
    authSessionCoordinator: coordinator,
    fetchImpl: fetchImpl as typeof fetch,
  });

  await authenticatedFetch('https://api.softbook.example/resource', {
    headers: {Authorization: 'Bearer stale-token'},
  });

  const headers = new Headers(fetchImpl.mock.calls[0]?.[1]?.headers);
  expect(headers.get('authorization')).toBe('Bearer access-0');
});

test('authenticated fetch refreshes once and retries a 401 response', async () => {
  const coordinator = createCoordinator();
  const fetchImpl = jest
    .fn()
    .mockResolvedValueOnce(createResponse(401))
    .mockResolvedValueOnce(createResponse(200));
  const authenticatedFetch = createAuthenticatedFetch({
    authSessionCoordinator: coordinator,
    fetchImpl: fetchImpl as typeof fetch,
  });

  await expect(
    authenticatedFetch('https://api.softbook.example/resource'),
  ).resolves.toMatchObject({status: 200});

  expect(coordinator.forceRefresh).toHaveBeenCalledTimes(1);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  const retryHeaders = new Headers(fetchImpl.mock.calls[1]?.[1]?.headers);
  expect(retryHeaders.get('authorization')).toBe('Bearer access-1');
});

test.each([403, 401])(
  'authenticated fetch invalidates after terminal %s authorization failure',
  async status => {
    const coordinator = createCoordinator();
    const fetchImpl = jest.fn(async () => createResponse(status));
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      fetchImpl: fetchImpl as typeof fetch,
    });

    await authenticatedFetch('https://api.softbook.example/resource');

    if (status === 401) {
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    }
    expect(coordinator.invalidate).toHaveBeenCalledTimes(1);
  },
);

test.each([403, 401])(
  'returns terminal authorization status %s while a real coordinator clears the session',
  async status => {
    const session = createRemoteSession('session-old');
    const authSessionStore: AuthSessionStore = {
      clear: jest.fn(async () => undefined),
      load: jest.fn(async () => null),
      save: jest.fn(async () => undefined),
    };
    const authRepository: AuthRepository = {
      logout: jest.fn(async () => undefined),
      refreshSession: jest.fn(async () => session),
      requestSmsCode: jest.fn(),
      verifySmsCode: jest.fn(),
    };
    const coordinator = createAuthSessionCoordinator({
      authRepository,
      authSessionStore,
    });
    const fetchImpl = jest.fn(async () => createResponse(status));
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      fetchImpl: fetchImpl as typeof fetch,
    });
    await coordinator.establish(session);

    await expect(
      authenticatedFetch('https://api.softbook.example/resource'),
    ).resolves.toMatchObject({status});

    expect(fetchImpl).toHaveBeenCalledTimes(status === 401 ? 2 : 1);
    expect(authSessionStore.clear).toHaveBeenCalledTimes(1);
    expect(coordinator.getCurrentSession()).toBeNull();
  },
);

test.each([401, 403])(
  'cancels a stale session request before status %s can affect its replacement',
  async _status => {
    const coordinator = createCoordinator();
    const sessionScope = installSessionScopeHarness(
      coordinator,
      createRemoteSession('session-old'),
    );
    let requestSignal: AbortSignal | undefined;
    const fetchImpl = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>(() => {
          requestSignal = init?.signal;
        }),
    );
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      fetchImpl: fetchImpl as typeof fetch,
    });

    const request = authenticatedFetch('https://api.softbook.example/resource');

    await Promise.resolve();
    await Promise.resolve();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    sessionScope.replace(createRemoteSession('session-new'));

    await expect(request).rejects.toMatchObject<
      Partial<RemoteRequestLifecycleError>
    >({reason: 'session_superseded', retryable: false});
    expect(requestSignal?.aborted).toBe(true);
    expect(coordinator.forceRefresh).not.toHaveBeenCalled();
    expect(coordinator.invalidate).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  },
);

test.each([
  ['another account', createRemoteSession('session-new', '13900139000')],
  ['a replacement session', createRemoteSession('session-new')],
])(
  'does not send a pending request with credentials from %s',
  async (_scenario, replacementSession) => {
    let resolveAccessToken: ((token: string) => void) | undefined;
    const coordinator = createCoordinator();
    const sessionScope = installSessionScopeHarness(
      coordinator,
      createRemoteSession('session-old'),
    );
    coordinator.getAccessToken = jest.fn(
      () =>
        new Promise<string>(resolve => {
          resolveAccessToken = resolve;
        }),
    );
    const fetchImpl = jest.fn(async () => createResponse(200));
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      fetchImpl: fetchImpl as typeof fetch,
    });

    const request = authenticatedFetch('https://api.softbook.example/resource');

    await Promise.resolve();
    sessionScope.replace(replacementSession as RemoteAuthSession);
    resolveAccessToken?.(replacementSession.accessToken);

    await expect(request).rejects.toMatchObject({
      reason: 'session_superseded',
      retryable: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  },
);

test('times out one bounded pipeline while access-token acquisition is hung', async () => {
  jest.useFakeTimers();
  const coordinator = createCoordinator();
  coordinator.getAccessToken = jest.fn(() => new Promise(() => undefined));
  const fetchImpl = jest.fn(async () => createResponse(200));
  const authenticatedFetch = createAuthenticatedFetch({
    authSessionCoordinator: coordinator,
    fetchImpl: fetchImpl as typeof fetch,
    timeoutMs: 25,
  });

  const request = authenticatedFetch('https://api.softbook.example/resource');
  const outcome = request.catch(error => error);
  jest.advanceTimersByTime(25);

  await expect(outcome).resolves.toMatchObject({
    reason: 'timeout',
    retryable: true,
  });
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(coordinator.invalidate).not.toHaveBeenCalled();
  jest.useRealTimers();
});

test('shares the same deadline across a 401 response and forced refresh', async () => {
  jest.useFakeTimers();
  const coordinator = createCoordinator();
  coordinator.forceRefresh = jest.fn(() => new Promise(() => undefined));
  const fetchImpl = jest.fn(async () => createResponse(401));
  const authenticatedFetch = createAuthenticatedFetch({
    authSessionCoordinator: coordinator,
    fetchImpl: fetchImpl as typeof fetch,
    timeoutMs: 25,
  });

  const request = authenticatedFetch('https://api.softbook.example/resource');
  await Promise.resolve();
  await Promise.resolve();
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  const outcome = request.catch(error => error);
  jest.advanceTimersByTime(25);

  await expect(outcome).resolves.toMatchObject({reason: 'timeout'});
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(coordinator.invalidate).not.toHaveBeenCalled();
  jest.useRealTimers();
});

test('propagates caller cancellation and aborts the active fetch', async () => {
  const coordinator = createCoordinator();
  const caller = new AbortController();
  let requestSignal: AbortSignal | undefined;
  const fetchImpl = jest.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>(() => {
        requestSignal = init?.signal;
      }),
  );
  const authenticatedFetch = createAuthenticatedFetch({
    authSessionCoordinator: coordinator,
    fetchImpl: fetchImpl as typeof fetch,
  });

  const request = authenticatedFetch('https://api.softbook.example/resource', {
    signal: caller.signal,
  });
  await Promise.resolve();
  await Promise.resolve();
  caller.abort();

  await expect(request).rejects.toMatchObject({
    reason: 'caller_cancelled',
    retryable: false,
  });
  expect(requestSignal?.aborted).toBe(true);
});

test('an already-cancelled caller cannot trigger token lookup or refresh', async () => {
  const coordinator = createCoordinator();
  const caller = new AbortController();
  caller.abort();
  const fetchImpl = jest.fn(async () => createResponse(200));
  const authenticatedFetch = createAuthenticatedFetch({
    authSessionCoordinator: coordinator,
    fetchImpl: fetchImpl as typeof fetch,
  });

  await expect(
    authenticatedFetch('https://api.softbook.example/resource', {
      signal: caller.signal,
    }),
  ).rejects.toMatchObject({reason: 'caller_cancelled'});
  expect(coordinator.getAccessToken).not.toHaveBeenCalled();
  expect(coordinator.forceRefresh).not.toHaveBeenCalled();
  expect(fetchImpl).not.toHaveBeenCalled();
});

test('unsubscribes from session changes after the request settles', async () => {
  const coordinator = createCoordinator();
  const unsubscribe = jest.fn();
  coordinator.subscribeSessionScope = jest.fn(() => unsubscribe);
  const authenticatedFetch = createAuthenticatedFetch({
    authSessionCoordinator: coordinator,
    fetchImpl: jest.fn(async () => createResponse(200)) as typeof fetch,
  });

  await authenticatedFetch('https://api.softbook.example/resource');

  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

function createRemoteSession(
  sessionId: string,
  phoneNumber = '13800138000',
): RemoteAuthSession {
  return {
    accessToken: `access-${sessionId}`,
    accessTokenExpiresAt: '2099-07-20T00:15:00.000Z',
    mode: 'remote',
    phoneNumber,
    refreshExpiresAt: '2099-08-19T00:00:00.000Z',
    refreshToken: `refresh-${sessionId}`,
    sessionId,
    tokenType: 'Bearer',
  };
}

function installSessionScopeHarness(
  coordinator: AuthSessionCoordinator,
  initialSession: RemoteAuthSession,
) {
  let currentSession = initialSession;
  const listeners = new Set<(scopeKey: string | null) => void>();
  coordinator.getCurrentSession = jest.fn(() => currentSession);
  coordinator.subscribeSessionScope = jest.fn(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  });

  return {
    replace(session: RemoteAuthSession) {
      currentSession = session;
      listeners.forEach(listener =>
        listener(`remote:${session.phoneNumber}:${session.sessionId}`),
      );
    },
  };
}
