import {createAuthenticatedFetch} from '../src/auth/authenticatedFetch';
import type {AuthSessionCoordinator} from '../src/auth/authSessionCoordinator';

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
