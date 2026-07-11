import {
  AUTH_SESSION_REVOCATION_KEY,
  createAuthSessionStore,
  type AuthSessionRevocationStorage,
  type AuthSessionSecureStorage,
} from '../src/persistence/authSessionStore';

function createSecureStorage(
  seed: false | { password: string; username: string } = false,
) {
  let credentials = seed;
  const storage: AuthSessionSecureStorage = {
    clearCredentials: jest.fn(async () => {
      credentials = false;
      return true;
    }),
    loadCredentials: jest.fn(async () => credentials),
    saveCredentials: jest.fn(async (username, password) => {
      credentials = { password, username };
      return true;
    }),
  };

  return { storage };
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
  it('round-trips the phone number and token through secure storage', async () => {
    const { storage } = createSecureStorage();
    const store = createAuthSessionStore(storage);

    await store.save({
      authToken: 'secure-token',
      phoneNumber: '13800138000',
    });

    await expect(store.load()).resolves.toEqual({
      authToken: 'secure-token',
      phoneNumber: '13800138000',
    });
    expect(storage.saveCredentials).toHaveBeenCalledWith(
      '13800138000',
      expect.stringContaining('secure-token'),
    );
  });

  it('supports authenticated local sessions without inventing a token', async () => {
    const { storage } = createSecureStorage();
    const store = createAuthSessionStore(storage);

    await store.save({ authToken: null, phoneNumber: '13800138000' });

    await expect(store.load()).resolves.toEqual({
      authToken: null,
      phoneNumber: '13800138000',
    });
  });

  it('clears a malformed secure payload and degrades to logged out', async () => {
    const { storage } = createSecureStorage({
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
    const { storage } = createSecureStorage();
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

  it('clears the dedicated secure credential on logout', async () => {
    const { storage } = createSecureStorage({
      password: JSON.stringify({ authToken: 'token', version: 1 }),
      username: '13800138000',
    });
    const store = createAuthSessionStore(storage);

    await store.clear();

    await expect(store.load()).resolves.toBeNull();
  });

  it('keeps logout durable when secure credential cleanup fails', async () => {
    const {storage: secureStorage} = createSecureStorage({
      password: JSON.stringify({authToken: 'token', version: 1}),
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

  it('removes a logout marker only after a new secure session is saved', async () => {
    const {storage: secureStorage} = createSecureStorage();
    const {storage: revocationStorage, values} = createRevocationStorage({
      [AUTH_SESSION_REVOCATION_KEY]: 'revoked',
    });
    const store = createAuthSessionStore(secureStorage, revocationStorage);

    await store.save({
      authToken: 'new-token',
      phoneNumber: '13800138000',
    });

    expect(values[AUTH_SESSION_REVOCATION_KEY]).toBeUndefined();
    await expect(store.load()).resolves.toEqual({
      authToken: 'new-token',
      phoneNumber: '13800138000',
    });
  });
});
