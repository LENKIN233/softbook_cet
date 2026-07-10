import {
  createAuthSessionStore,
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
});
