import * as Keychain from 'react-native-keychain';

export type PersistedAuthSession = {
  authToken: string | null;
  phoneNumber: string;
};

export type AuthSessionSecureStorage = {
  clearCredentials: () => Promise<boolean>;
  loadCredentials: () => Promise<
    false | { password: string; username: string }
  >;
  saveCredentials: (username: string, password: string) => Promise<boolean>;
};

export type AuthSessionStore = {
  clear: () => Promise<void>;
  load: () => Promise<PersistedAuthSession | null>;
  save: (session: PersistedAuthSession) => Promise<void>;
};

const AUTH_SESSION_SCHEMA_VERSION = 1;
const AUTH_SESSION_SERVICE = 'com.softbook.cet.auth-session.v1';

type AuthSessionPayload = {
  authToken: string | null;
  version: typeof AUTH_SESSION_SCHEMA_VERSION;
};

export function createAuthSessionStore(
  storage: AuthSessionSecureStorage = createReactNativeAuthSessionSecureStorage(),
): AuthSessionStore {
  return {
    async clear() {
      await storage.clearCredentials();
    },

    async load() {
      let credentials: Awaited<
        ReturnType<AuthSessionSecureStorage['loadCredentials']>
      >;

      try {
        credentials = await storage.loadCredentials();
      } catch (error) {
        console.warn('[AuthSessionStore] Failed to read auth session.', error);
        return null;
      }

      if (!credentials) {
        return null;
      }

      try {
        return parseAuthSession(credentials.username, credentials.password);
      } catch (error) {
        console.warn(
          '[AuthSessionStore] Discarding invalid auth session.',
          error,
        );

        try {
          await storage.clearCredentials();
        } catch (clearError) {
          console.warn(
            '[AuthSessionStore] Failed to clear invalid auth session.',
            clearError,
          );
        }

        return null;
      }
    },

    async save(session) {
      assertPhoneNumber(session.phoneNumber);
      assertAuthToken(session.authToken);

      const payload: AuthSessionPayload = {
        authToken: session.authToken,
        version: AUTH_SESSION_SCHEMA_VERSION,
      };
      const saved = await storage.saveCredentials(
        session.phoneNumber,
        JSON.stringify(payload),
      );

      if (!saved) {
        throw new Error('Keychain did not persist the auth session.');
      }
    },
  };
}

export function createReactNativeAuthSessionSecureStorage(): AuthSessionSecureStorage {
  return {
    clearCredentials: () =>
      Keychain.resetGenericPassword({ service: AUTH_SESSION_SERVICE }),
    loadCredentials: () =>
      Keychain.getGenericPassword({ service: AUTH_SESSION_SERVICE }),
    async saveCredentials(username, password) {
      const result = await Keychain.setGenericPassword(username, password, {
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        service: AUTH_SESSION_SERVICE,
      });

      return result !== false;
    },
  };
}

function parseAuthSession(
  phoneNumber: string,
  rawPayload: string,
): PersistedAuthSession {
  assertPhoneNumber(phoneNumber);

  const payload: unknown = JSON.parse(rawPayload);

  if (!isObject(payload) || payload.version !== AUTH_SESSION_SCHEMA_VERSION) {
    throw new Error('Auth session payload version is invalid.');
  }

  assertAuthToken(payload.authToken);

  return {
    authToken: payload.authToken,
    phoneNumber,
  };
}

function assertPhoneNumber(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^\d{11}$/.test(value)) {
    throw new Error('Auth session phone number must contain 11 digits.');
  }
}

function assertAuthToken(value: unknown): asserts value is string | null {
  if (
    value !== null &&
    (typeof value !== 'string' || value.trim().length === 0)
  ) {
    throw new Error('Auth session token must be a non-empty string or null.');
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
