import type {AuthRepository} from '../src/auth/authRepository';
import {createAuthSessionCoordinator} from '../src/auth/authSessionCoordinator';
import type {RemoteAuthSession} from '../src/auth/authSession';
import type {AuthSessionStore} from '../src/persistence/authSessionStore';
import {RemoteHttpError} from '../src/runtime/remoteHttpError';

const NOW = new Date('2026-07-20T00:00:00.000Z');

function createSession(
  overrides: Partial<RemoteAuthSession> = {},
): RemoteAuthSession {
  return {
    accessToken: 'access-0',
    accessTokenExpiresAt: '2026-07-20T00:15:00.000Z',
    mode: 'remote',
    phoneNumber: '13800138000',
    refreshExpiresAt: '2026-08-19T00:00:00.000Z',
    refreshToken: 'refresh-0',
    sessionId: 'session-123',
    tokenType: 'Bearer',
    ...overrides,
  };
}

function createHarness(restoredSession: RemoteAuthSession | null = null) {
  let persistedSession = restoredSession;
  const authSessionStore: AuthSessionStore = {
    clear: jest.fn(async () => {
      persistedSession = null;
    }),
    load: jest.fn(async () => persistedSession),
    save: jest.fn(async session => {
      persistedSession = session as RemoteAuthSession;
    }),
  };
  const authRepository: AuthRepository = {
    logout: jest.fn(async () => undefined),
    refreshSession: jest.fn(async session => session),
    requestSmsCode: jest.fn(),
    verifySmsCode: jest.fn(),
  };
  const coordinator = createAuthSessionCoordinator({
    authRepository,
    authSessionStore,
    now: () => NOW,
  });

  return {authRepository, authSessionStore, coordinator};
}

test('restore keeps a fresh secure session without refreshing it', async () => {
  const session = createSession();
  const {authRepository, coordinator} = createHarness(session);

  await expect(coordinator.restore()).resolves.toEqual(session);
  expect(authRepository.refreshSession).not.toHaveBeenCalled();
  await expect(coordinator.getAccessToken()).resolves.toBe('access-0');
});

test('concurrent access requests share one rotating refresh operation', async () => {
  const session = createSession({
    accessTokenExpiresAt: '2026-07-20T00:00:30.000Z',
  });
  const rotated = createSession({
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
  });
  const {authRepository, authSessionStore, coordinator} =
    createHarness(session);
  let resolveRefresh: ((value: RemoteAuthSession) => void) | undefined;
  jest.mocked(authRepository.refreshSession).mockImplementation(
    () =>
      new Promise(resolve => {
        resolveRefresh = resolve;
      }),
  );
  await coordinator.establish(session);

  const first = coordinator.getAccessToken();
  const second = coordinator.getAccessToken();
  resolveRefresh?.(rotated);

  await expect(Promise.all([first, second])).resolves.toEqual([
    'access-1',
    'access-1',
  ]);
  expect(authRepository.refreshSession).toHaveBeenCalledTimes(1);
  expect(authSessionStore.save).toHaveBeenCalledWith(rotated);
});

test('refresh authorization rejection clears the secure session', async () => {
  const {authRepository, authSessionStore, coordinator} = createHarness(
    createSession({accessTokenExpiresAt: '2026-07-20T00:00:30.000Z'}),
  );
  jest
    .mocked(authRepository.refreshSession)
    .mockRejectedValue(new RemoteHttpError('revoked', 401));

  await expect(coordinator.restore()).rejects.toMatchObject({status: 401});
  expect(authSessionStore.clear).toHaveBeenCalledTimes(1);
  expect(coordinator.getCurrentSession()).toBeNull();
});

test('late refresh completion cannot resurrect an invalidated session', async () => {
  const session = createSession({
    accessTokenExpiresAt: '2026-07-20T00:00:30.000Z',
  });
  const {authRepository, authSessionStore, coordinator} = createHarness();
  let resolveRefresh: ((value: RemoteAuthSession) => void) | undefined;
  jest.mocked(authRepository.refreshSession).mockImplementation(
    () =>
      new Promise(resolve => {
        resolveRefresh = resolve;
      }),
  );
  await coordinator.establish(session);
  const pendingAccess = coordinator.getAccessToken();

  await coordinator.invalidate();
  resolveRefresh?.(
    createSession({accessToken: 'late-access', refreshToken: 'late-refresh'}),
  );

  await expect(pendingAccess).rejects.toThrow('superseded');
  expect(authSessionStore.clear).toHaveBeenCalled();
  expect(coordinator.getCurrentSession()).toBeNull();
});

test('late refresh completion cannot erase a replacement session', async () => {
  const session = createSession({
    accessTokenExpiresAt: '2026-07-20T00:00:30.000Z',
  });
  const replacement = createSession({
    accessToken: 'replacement-access',
    phoneNumber: '13900139000',
    refreshToken: 'replacement-refresh',
    sessionId: 'replacement-session',
  });
  const {authRepository, authSessionStore, coordinator} = createHarness();
  let resolveRefresh: ((value: RemoteAuthSession) => void) | undefined;
  jest.mocked(authRepository.refreshSession).mockImplementation(
    () =>
      new Promise(resolve => {
        resolveRefresh = resolve;
      }),
  );
  await coordinator.establish(session);
  const pendingAccess = coordinator.getAccessToken();

  await coordinator.establish(replacement);
  resolveRefresh?.(
    createSession({accessToken: 'late-access', refreshToken: 'late-refresh'}),
  );

  await expect(pendingAccess).rejects.toThrow('superseded');
  expect(authSessionStore.save).toHaveBeenCalledTimes(2);
  expect(authSessionStore.save).toHaveBeenLastCalledWith(replacement);
  expect(authSessionStore.clear).not.toHaveBeenCalled();
  expect(coordinator.getCurrentSession()).toEqual(replacement);
});

test('late rejected refresh cannot invalidate a replacement session', async () => {
  const session = createSession({
    accessTokenExpiresAt: '2026-07-20T00:00:30.000Z',
  });
  const replacement = createSession({
    accessToken: 'replacement-access',
    phoneNumber: '13900139000',
    refreshToken: 'replacement-refresh',
    sessionId: 'replacement-session',
  });
  const {authRepository, authSessionStore, coordinator} = createHarness();
  let rejectRefresh: ((reason: unknown) => void) | undefined;
  jest.mocked(authRepository.refreshSession).mockImplementation(
    () =>
      new Promise((_, reject) => {
        rejectRefresh = reject;
      }),
  );
  await coordinator.establish(session);
  const pendingAccess = coordinator.getAccessToken();

  await coordinator.establish(replacement);
  rejectRefresh?.(new RemoteHttpError('old session revoked', 401));

  await expect(pendingAccess).rejects.toMatchObject({status: 401});
  expect(authSessionStore.clear).not.toHaveBeenCalled();
  expect(coordinator.getCurrentSession()).toEqual(replacement);
});

test('rotated credentials fail closed when secure persistence fails', async () => {
  const session = createSession({
    accessTokenExpiresAt: '2026-07-20T00:00:30.000Z',
  });
  const {authRepository, authSessionStore, coordinator} = createHarness();
  await coordinator.establish(session);
  jest
    .mocked(authRepository.refreshSession)
    .mockResolvedValue(
      createSession({accessToken: 'access-1', refreshToken: 'refresh-1'}),
    );
  jest
    .mocked(authSessionStore.save)
    .mockRejectedValueOnce(new Error('Keychain unavailable'));

  await expect(coordinator.getAccessToken()).rejects.toThrow(
    'Keychain unavailable',
  );
  expect(authSessionStore.clear).toHaveBeenCalled();
  expect(coordinator.getCurrentSession()).toBeNull();
});

test('temporary refresh failure keeps a still-valid access token', async () => {
  const {authRepository, coordinator} = createHarness(
    createSession({accessTokenExpiresAt: '2026-07-20T00:00:30.000Z'}),
  );
  jest
    .mocked(authRepository.refreshSession)
    .mockRejectedValue(new Error('network unavailable'));

  await expect(coordinator.restore()).resolves.toMatchObject({
    accessToken: 'access-0',
  });
  await expect(coordinator.getAccessToken()).resolves.toBe('access-0');
  expect(coordinator.getCurrentSession()).not.toBeNull();
});

test('logout clears local state even when server revocation is unavailable', async () => {
  const {authRepository, authSessionStore, coordinator} = createHarness();
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  await coordinator.establish(createSession());
  jest
    .mocked(authRepository.logout)
    .mockRejectedValue(new Error('network unavailable'));

  await expect(coordinator.logout()).resolves.toEqual({
    remoteRevocation: 'failed',
  });
  expect(authSessionStore.clear).toHaveBeenCalledTimes(1);
  expect(coordinator.getCurrentSession()).toBeNull();

  warn.mockRestore();
});
