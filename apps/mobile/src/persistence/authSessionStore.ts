import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

import type {AuthSession, RemoteAuthSession} from '../auth/authSession';

export type PersistedAuthSession = AuthSession;

export type AuthSessionSecureStorage = {
  clearCredentials: () => Promise<boolean>;
  loadCredentials: () => Promise<false | {password: string; username: string}>;
  saveCredentials: (username: string, password: string) => Promise<boolean>;
};

export type AuthSessionRevocationStorage = {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

export type AuthSessionStore = {
  clear: () => Promise<void>;
  load: () => Promise<PersistedAuthSession | null>;
  save: (session: PersistedAuthSession) => Promise<void>;
};

const AUTH_SESSION_SCHEMA_VERSION = 2;
const AUTH_SESSION_SERVICE = 'com.softbook.cet.auth-session.v2';
const LEGACY_AUTH_SESSION_SERVICE = 'com.softbook.cet.auth-session.v1';
export const AUTH_SESSION_REVOCATION_KEY =
  'softbook-cet/auth-session/revoked.v1';

type LocalAuthSessionPayload = {
  mode: 'local';
  version: typeof AUTH_SESSION_SCHEMA_VERSION;
};

type RemoteAuthSessionPayload = Omit<RemoteAuthSession, 'phoneNumber'> & {
  version: typeof AUTH_SESSION_SCHEMA_VERSION;
};

type AuthSessionPayload = LocalAuthSessionPayload | RemoteAuthSessionPayload;

export function createAuthSessionStore(
  storage: AuthSessionSecureStorage = createReactNativeAuthSessionSecureStorage(),
  revocationStorage: AuthSessionRevocationStorage = AsyncStorage,
): AuthSessionStore {
  return {
    async clear() {
      let markerPersisted = false;
      let credentialsCleanupCompleted = false;

      try {
        await revocationStorage.setItem(AUTH_SESSION_REVOCATION_KEY, 'revoked');
        markerPersisted = true;
      } catch {
        console.warn(
          '[AuthSessionStore] Failed to persist the auth revocation marker.',
        );
      }

      try {
        await storage.clearCredentials();
        credentialsCleanupCompleted = true;
      } catch {
        console.warn(
          markerPersisted
            ? '[AuthSessionStore] Secure credentials remain covered by the revocation marker.'
            : '[AuthSessionStore] Failed to clear secure credentials.',
        );
      }

      if (!markerPersisted && !credentialsCleanupCompleted) {
        throw new Error(
          'Auth session cleanup could not persist revocation or clear credentials.',
        );
      }
    },

    async load() {
      let revoked: string | null;

      try {
        revoked = await revocationStorage.getItem(AUTH_SESSION_REVOCATION_KEY);
      } catch (error) {
        console.warn(
          '[AuthSessionStore] Failed to read the auth revocation marker.',
          error,
        );
        return null;
      }

      if (revoked !== null) {
        try {
          await storage.clearCredentials();
        } catch (error) {
          console.warn(
            '[AuthSessionStore] Failed to retry revoked credential cleanup.',
            error,
          );
        }

        return null;
      }

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
          await revocationStorage.setItem(
            AUTH_SESSION_REVOCATION_KEY,
            'revoked',
          );
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
      const payload = createAuthSessionPayload(session);
      const saved = await storage.saveCredentials(
        session.phoneNumber,
        JSON.stringify(payload),
      );

      if (!saved) {
        throw new Error('Keychain did not persist the auth session.');
      }

      try {
        await revocationStorage.removeItem(AUTH_SESSION_REVOCATION_KEY);
      } catch (error) {
        try {
          await storage.clearCredentials();
        } catch (clearError) {
          console.warn(
            '[AuthSessionStore] Failed to roll back credentials after revocation reset failed.',
            clearError,
          );
        }

        throw error;
      }
    },
  };
}

export function createReactNativeAuthSessionSecureStorage(): AuthSessionSecureStorage {
  return {
    async clearCredentials() {
      const [current, legacy] = await Promise.all([
        Keychain.resetGenericPassword({service: AUTH_SESSION_SERVICE}),
        Keychain.resetGenericPassword({service: LEGACY_AUTH_SESSION_SERVICE}),
      ]);

      return current !== false && legacy !== false;
    },
    async loadCredentials() {
      const current = await Keychain.getGenericPassword({
        service: AUTH_SESSION_SERVICE,
      });

      if (current) {
        return current;
      }

      return Keychain.getGenericPassword({
        service: LEGACY_AUTH_SESSION_SERVICE,
      });
    },
    async saveCredentials(username, password) {
      await Keychain.resetGenericPassword({
        service: LEGACY_AUTH_SESSION_SERVICE,
      });
      const result = await Keychain.setGenericPassword(username, password, {
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        service: AUTH_SESSION_SERVICE,
      });

      return result !== false;
    },
  };
}

function createAuthSessionPayload(session: AuthSession): AuthSessionPayload {
  if (session.mode === 'local') {
    return {
      mode: 'local',
      version: AUTH_SESSION_SCHEMA_VERSION,
    };
  }

  assertRemoteAuthSession(session);

  return {
    accessToken: session.accessToken,
    accessTokenExpiresAt: session.accessTokenExpiresAt,
    mode: 'remote',
    refreshExpiresAt: session.refreshExpiresAt,
    refreshToken: session.refreshToken,
    sessionId: session.sessionId,
    tokenType: session.tokenType,
    version: AUTH_SESSION_SCHEMA_VERSION,
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

  if (payload.mode === 'local') {
    return {
      mode: 'local',
      phoneNumber,
    };
  }

  const session: RemoteAuthSession = {
    accessToken: payload.accessToken as string,
    accessTokenExpiresAt: payload.accessTokenExpiresAt as string,
    mode: payload.mode as 'remote',
    phoneNumber,
    refreshExpiresAt: payload.refreshExpiresAt as string,
    refreshToken: payload.refreshToken as string,
    sessionId: payload.sessionId as string,
    tokenType: payload.tokenType as 'Bearer',
  };
  assertRemoteAuthSession(session);

  return session;
}

function assertPhoneNumber(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^\d{11}$/.test(value)) {
    throw new Error('Auth session phone number must contain 11 digits.');
  }
}

function assertRemoteAuthSession(
  session: RemoteAuthSession,
): asserts session is RemoteAuthSession {
  if (session.mode !== 'remote') {
    throw new Error('Remote auth session mode is invalid.');
  }

  assertNonEmptyString(session.accessToken, 'accessToken');
  assertIsoTimestamp(session.accessTokenExpiresAt, 'accessTokenExpiresAt');
  assertIsoTimestamp(session.refreshExpiresAt, 'refreshExpiresAt');
  assertNonEmptyString(session.refreshToken, 'refreshToken');
  assertNonEmptyString(session.sessionId, 'sessionId');

  if (session.tokenType !== 'Bearer') {
    throw new Error('Auth session tokenType must be Bearer.');
  }
}

function assertNonEmptyString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Auth session ${field} must be a non-empty string.`);
  }
}

function assertIsoTimestamp(value: unknown, field: string) {
  assertNonEmptyString(value, field);

  if (!Number.isFinite(Date.parse(value as string))) {
    throw new Error(`Auth session ${field} must be an ISO timestamp.`);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
