import type {RemoteAuthSession} from '../src/auth/authSession';
import * as Keychain from 'react-native-keychain';
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
  it.each(['clear', 'clearExactly', 'load'] as const)(
    'serializes a second instance save and load behind an already-dispatched %s cleanup',
    async operation => {
      const {storage: secureStorage} = createSecureStorage();
      const {storage: revocationStorage} = createRevocationStorage();
      const first = createAuthSessionStore(secureStorage, revocationStorage);
      const second = createAuthSessionStore(secureStorage, revocationStorage);
      await first.save(REMOTE_SESSION);
      if (operation === 'load') await revocationStorage.setItem(AUTH_SESSION_REVOCATION_KEY, 'revoked');
      let release!: () => void;
      let markStarted!: () => void;
      const gate = new Promise<void>(resolve => {release = resolve;});
      const started = new Promise<void>(resolve => {markStarted = resolve;});
      const originalClear = secureStorage.clearCredentials;
      jest.mocked(secureStorage.clearCredentials).mockImplementationOnce(async () => {
        markStarted();
        await gate;
        return originalClear();
      });
      const clearing = first[operation]();
      await started;
      const newSession = {...REMOTE_SESSION, accessToken: 'new-access', refreshToken: 'new-refresh', sessionId: 'new-session'};
      let saved = false;
      const saving = second.save(newSession).then(() => {saved = true;});
      const reading = second.load();
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
      const savedBeforeCleanupFinished = saved;
      release();
      await Promise.allSettled([clearing, saving, reading]);
      expect(savedBeforeCleanupFinished).toBe(false);
      await expect(saving).resolves.toBeUndefined();
      await expect(reading).resolves.toEqual(newSession);
      await expect(first.load()).resolves.toEqual(newSession);
    },
  );

  it('keeps default native stores serialized until both current and legacy credential clears settle', async () => {
    const first = createAuthSessionStore();
    const second = createAuthSessionStore();
    await first.save(REMOTE_SESSION);
    const reset = jest.mocked(Keychain.resetGenericPassword);
    const originalReset = reset.getMockImplementation()!;
    let release!: () => void;
    let markStarted!: () => void;
    const gate = new Promise<void>(resolve => {release = resolve;});
    const started = new Promise<void>(resolve => {markStarted = resolve;});
    reset.mockImplementationOnce(async options => {
      markStarted();
      await gate;
      return originalReset(options);
    }).mockRejectedValueOnce(new Error('legacy credential cleanup failed'));
    const clearing = first.clearExactly();
    const handledClear = clearing.catch(error => error);
    await started;
    const newSession = {...REMOTE_SESSION, sessionId: 'new-native-session'};
    let saved = false;
    const saving = second.save(newSession).then(() => {saved = true;});
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
    const savedBeforeCleanupFinished = saved;
    release();
    await Promise.allSettled([handledClear, saving]);
    expect(savedBeforeCleanupFinished).toBe(false);
    await expect(clearing).rejects.toThrow('legacy credential cleanup failed');
    await expect(second.load()).resolves.toEqual(newSession);
  });

  it('orders a second instance exact clear and subsequent save after an unfinished old clear', async () => {
    const {storage: secureStorage} = createSecureStorage();
    const {storage: revocationStorage} = createRevocationStorage();
    const first = createAuthSessionStore(secureStorage, revocationStorage);
    const second = createAuthSessionStore(secureStorage, revocationStorage);
    await first.save(REMOTE_SESSION);
    let release!: () => void;
    let markStarted!: () => void;
    const gate = new Promise<void>(resolve => {release = resolve;});
    const started = new Promise<void>(resolve => {markStarted = resolve;});
    const clear = jest.mocked(secureStorage.clearCredentials);
    const originalClear = clear.getMockImplementation()!;
    clear.mockImplementationOnce(async () => {
      markStarted();
      await gate;
      return originalClear();
    });
    const oldClear = first.clear();
    await started;
    const nextClear = second.clearExactly();
    const newSession = {...REMOTE_SESSION, sessionId: 'after-both-clears'};
    const saving = second.save(newSession);
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    const concurrentClearCalls = clear.mock.calls.length;
    release();
    await Promise.allSettled([oldClear, nextClear, saving]);
    expect(concurrentClearCalls).toBe(1);
    await expect(nextClear).resolves.toBeUndefined();
    await expect(second.load()).resolves.toEqual(newSession);
  });

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
