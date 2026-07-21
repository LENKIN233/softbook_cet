import {createAuthenticatedFetch} from '../src/auth/authenticatedFetch';
import type {AuthSessionCoordinator} from '../src/auth/authSessionCoordinator';
import type {RemoteAuthSession} from '../src/auth/authSession';

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

test.each([401, 403])(
  'does not let a stale session response with status %s refresh or invalidate its replacement',
  async status => {
    let currentSession = createRemoteSession('session-old');
    let resolveResponse: ((response: Response) => void) | undefined;
    const coordinator = createCoordinator();
    coordinator.getCurrentSession = jest.fn(() => currentSession);
    const fetchImpl = jest.fn(
      () =>
        new Promise<Response>(resolve => {
          resolveResponse = resolve;
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

    currentSession = createRemoteSession('session-new');
    resolveResponse?.(createResponse(status));

    await expect(request).resolves.toMatchObject({status});
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
    let currentSession = createRemoteSession('session-old');
    let resolveAccessToken: ((token: string) => void) | undefined;
    const coordinator = createCoordinator();
    coordinator.getCurrentSession = jest.fn(() => currentSession);
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
    currentSession = replacementSession as RemoteAuthSession;
    resolveAccessToken?.(replacementSession.accessToken);

    await expect(request).rejects.toThrow(
      'Authenticated request was superseded by a newer session.',
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  },
);

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
