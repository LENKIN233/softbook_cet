import type {RemoteAuthSession} from '../src/auth/authSession';
import {
  AUTH_SESSION_REVOCATION_KEY,
  createAuthSessionStore,
  type AuthSessionRevocationStorage,
  type AuthSessionSecureStorage,
} from '../src/persistence/authSessionStore';

const REMOTE_SESSION: RemoteAuthSession = {
  accessToken: 'secure-access-token',
  accessTokenExpiresAt: '2026-07-20T00:15:00.000Z',
  mode: 'remote',
  phoneNumber: '13800138000',
  refreshExpiresAt: '2026-08-19T00:00:00.000Z',
  refreshToken: 'secure-refresh-token',
  sessionId: 'session-123',
  tokenType: 'Bearer',
};

function createSecureStorage(
  seed: false | {password: string; username: string} = false,
) {
  let credentials = seed;
  const storage: AuthSessionSecureStorage = {
    clearCredentials: jest.fn(async () => {
      credentials = false;
      return true;
    }),
    loadCredentials: jest.fn(async () => credentials),
    saveCredentials: jest.fn(async (username, password) => {
      credentials = {password, username};
      return true;
    }),
  };

  return {storage};
}

function createRevocationStorage(seed: Record<string, string> = {}) {
  const values = {...seed};
  const storage: AuthSessionRevocationStorage = {
    getItem: jest.fn(async key => values[key] ?? null),
    removeItem: jest.fn(async key => {
      delete values[key];
    }),
    setItem: jest.fn(async (key, value) => {
      values[key] = value;
    }),
  };

  return {storage, values};
}

describe('AuthSessionStore', () => {
  it('round-trips the complete rotating credential pair in secure storage', async () => {
    const {storage} = createSecureStorage();
    const store = createAuthSessionStore(storage);

    await store.save(REMOTE_SESSION);

    await expect(store.load()).resolves.toEqual(REMOTE_SESSION);
    expect(storage.saveCredentials).toHaveBeenCalledWith(
      '13800138000',
      expect.stringContaining('secure-refresh-token'),
    );
  });

  it('supports authenticated local development sessions without a token', async () => {
    const {storage} = createSecureStorage();
    const store = createAuthSessionStore(storage);

    await store.save({mode: 'local', phoneNumber: '13800138000'});

    await expect(store.load()).resolves.toEqual({
      mode: 'local',
      phoneNumber: '13800138000',
    });
  });

  it('invalidates auth-session.v1 because it has no refresh credential', async () => {
    const {storage} = createSecureStorage({
      password: JSON.stringify({authToken: 'legacy-token', version: 1}),
      username: '13800138000',
    });
    const {storage: revocationStorage, values} = createRevocationStorage();
    const store = createAuthSessionStore(storage, revocationStorage);
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    await expect(store.load()).resolves.toBeNull();
    expect(storage.clearCredentials).toHaveBeenCalledTimes(1);
    expect(values[AUTH_SESSION_REVOCATION_KEY]).toBe('revoked');

    warn.mockRestore();
  });

  it('clears a malformed secure payload and degrades to logged out', async () => {
    const {storage} = createSecureStorage({
      password: '{not-json',
      username: '13800138000',
    });
    const store = createAuthSessionStore(storage);
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    await expect(store.load()).resolves.toBeNull();
    expect(storage.clearCredentials).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it('does not delete credentials after a transient secure storage read error', async () => {
    const {storage} = createSecureStorage();
    jest
      .mocked(storage.loadCredentials)
      .mockRejectedValueOnce(new Error('Keychain temporarily unavailable'));
    const store = createAuthSessionStore(storage);
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    await expect(store.load()).resolves.toBeNull();
    expect(storage.clearCredentials).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  it('keeps logout durable when secure credential cleanup fails', async () => {
    const {storage: secureStorage} = createSecureStorage({
      password: JSON.stringify({mode: 'local', version: 2}),
      username: '13800138000',
    });
    const {storage: revocationStorage, values} = createRevocationStorage();
    jest
      .mocked(secureStorage.clearCredentials)
      .mockRejectedValue(new Error('Keychain unavailable'));
    const store = createAuthSessionStore(secureStorage, revocationStorage);
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    await expect(store.clear()).resolves.toBeUndefined();
    expect(values[AUTH_SESSION_REVOCATION_KEY]).toBe('revoked');

    const relaunchedStore = createAuthSessionStore(
      secureStorage,
      revocationStorage,
    );
    await expect(relaunchedStore.load()).resolves.toBeNull();
    expect(secureStorage.loadCredentials).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  it('clears secure credentials when the revocation marker cannot be written', async () => {
    const {storage: secureStorage} = createSecureStorage({
      password: JSON.stringify({mode: 'local', version: 2}),
      username: '13800138000',
    });
    const {storage: revocationStorage} = createRevocationStorage();
    jest
      .mocked(revocationStorage.setItem)
      .mockRejectedValue(new Error('AsyncStorage unavailable'));
    const store = createAuthSessionStore(secureStorage, revocationStorage);
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    await expect(store.clear()).resolves.toBeUndefined();
    expect(secureStorage.clearCredentials).toHaveBeenCalledTimes(1);
    await expect(store.load()).resolves.toBeNull();

    warn.mockRestore();
  });

  it('reports cleanup failure only when neither revocation path succeeds', async () => {
    const {storage: secureStorage} = createSecureStorage({
      password: JSON.stringify({mode: 'local', version: 2}),
      username: '13800138000',
    });
    const {storage: revocationStorage} = createRevocationStorage();
    jest
      .mocked(revocationStorage.setItem)
      .mockRejectedValue(new Error('AsyncStorage unavailable'));
    jest
      .mocked(secureStorage.clearCredentials)
      .mockRejectedValue(new Error('Keychain unavailable'));
    const store = createAuthSessionStore(secureStorage, revocationStorage);
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    await expect(store.clear()).rejects.toThrow(
      'could not persist revocation or clear credentials',
    );

    warn.mockRestore();
  });

  it('removes a logout marker only after a new secure session is saved', async () => {
    const {storage: secureStorage} = createSecureStorage();
    const {storage: revocationStorage, values} = createRevocationStorage({
      [AUTH_SESSION_REVOCATION_KEY]: 'revoked',
    });
    const store = createAuthSessionStore(secureStorage, revocationStorage);

    await store.save(REMOTE_SESSION);

    expect(values[AUTH_SESSION_REVOCATION_KEY]).toBeUndefined();
    await expect(store.load()).resolves.toEqual(REMOTE_SESSION);
  });
});
