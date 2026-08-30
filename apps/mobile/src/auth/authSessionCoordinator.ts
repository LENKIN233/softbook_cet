import {
  isRemoteAuthorizationError,
  RemoteHttpError,
} from '../runtime/remoteHttpError';
import type {AuthSessionStore} from '../persistence/authSessionStore';

import type {AuthRepository} from './authRepository';
import {
  getAuthSessionScopeKey,
  isRemoteAuthSession,
  type AuthSession,
  type RemoteAuthSession,
} from './authSession';

export type AuthSessionLogoutResult = {
  remoteRevocation: 'failed' | 'not_required' | 'succeeded';
};

export type AuthSessionScopeChangeReason =
  | 'authorization_invalidated'
  | 'session_changed';

export type AuthSessionCoordinator = {
  discardUnboundSessionExactly: (
    expectedSessionScopeKey: string,
  ) => Promise<boolean>;
  establish: (session: AuthSession) => Promise<void>;
  forceRefresh: () => Promise<RemoteAuthSession>;
  getAccessToken: () => Promise<string | undefined>;
  getCurrentSession: () => AuthSession | null;
  invalidate: () => Promise<void>;
  logout: () => Promise<AuthSessionLogoutResult>;
  restore: (
    observeRestoredSession?: (session: AuthSession) => void,
  ) => Promise<AuthSession | null>;
  subscribeSessionScope: (
    listener: (
      sessionScopeKey: string | null,
      reason: AuthSessionScopeChangeReason,
    ) => void,
  ) => () => void;
};

const DEFAULT_REFRESH_LEEWAY_MS = 60_000;

export function createAuthSessionCoordinator(options: {
  authRepository: AuthRepository;
  authSessionStore: AuthSessionStore;
  beforeSessionInvalidation?: (input: {
    reason: AuthSessionScopeChangeReason;
    session: AuthSession;
  }) => Promise<void>;
  now?: () => Date;
  refreshLeewayMs?: number;
  shouldPreserveAuthorizationRejection?: (
    sessionScopeKey: string,
  ) => boolean;
}): AuthSessionCoordinator {
  const now = options.now ?? (() => new Date());
  const refreshLeewayMs = options.refreshLeewayMs ?? DEFAULT_REFRESH_LEEWAY_MS;
  let currentSession: AuthSession | null = null;
  let refreshInFlight: {
    abortController: AbortController;
    promise: Promise<RemoteAuthSession>;
    revision: number;
    session: RemoteAuthSession;
  } | null = null;
  let sessionRevision = 0;
  let storageTransition: Promise<void> = Promise.resolve();
  const sessionScopeListeners = new Set<
    (
      sessionScopeKey: string | null,
      reason: AuthSessionScopeChangeReason,
    ) => void
  >();

  const setCurrentSession = (
    session: AuthSession | null,
    reason: AuthSessionScopeChangeReason = 'session_changed',
  ) => {
    const previousScopeKey = getAuthSessionScopeKey(currentSession);
    const nextScopeKey = getAuthSessionScopeKey(session);
    currentSession = session;

    if (previousScopeKey === nextScopeKey) {
      return;
    }

    for (const listener of sessionScopeListeners) {
      try {
        listener(nextScopeKey, reason);
      } catch {
        console.warn(
          '[AuthSessionCoordinator] Session-scope listener failed.',
        );
      }
    }
  };

  const abortRefreshInFlight = () => {
    refreshInFlight?.abortController.abort();
  };

  const runStorageTransition = <Result>(
    operation: () => Promise<Result>,
  ): Promise<Result> => {
    const result = storageTransition.then(operation);
    storageTransition = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const invalidate = async (
    reason: AuthSessionScopeChangeReason = 'session_changed',
  ) => {
    const invalidatingSession = currentSession;
    const invalidatingScopeKey = getAuthSessionScopeKey(invalidatingSession);
    if (invalidatingSession !== null) {
      await options.beforeSessionInvalidation?.({
        reason,
        session: invalidatingSession,
      });
      if (
        getAuthSessionScopeKey(currentSession) !== invalidatingScopeKey
      ) {
        return;
      }
    }
    sessionRevision += 1;
    setCurrentSession(null, reason);
    abortRefreshInFlight();
    await runStorageTransition(() => options.authSessionStore.clear());
  };

  const invalidateWithoutMasking = async (
    error: unknown,
    reason: AuthSessionScopeChangeReason = 'session_changed',
  ) => {
    try {
      await invalidate(reason);
    } catch {
      console.warn(
        '[AuthSessionCoordinator] Local auth cleanup could not be confirmed.',
      );
    }

    throw error;
  };

  const refresh = async (force: boolean): Promise<RemoteAuthSession> => {
    const session = currentSession;

    if (!session || !isRemoteAuthSession(session)) {
      throw new RemoteHttpError('No remote auth session is available.', 401);
    }

    if (!force && !shouldRefresh(session, now(), refreshLeewayMs)) {
      return session;
    }

    if (
      refreshInFlight?.revision === sessionRevision &&
      refreshInFlight.session === session
    ) {
      return refreshInFlight.promise;
    }

    const refreshRevision = sessionRevision;
    const refreshAbortController = new AbortController();
    const isCurrentRefresh = () =>
      sessionRevision === refreshRevision && currentSession === session;
    const refreshTask = (async () => {
      let refreshedSession: RemoteAuthSession;

      try {
        refreshedSession = await options.authRepository.refreshSession(session, {
          cancellationReason: 'session_superseded',
          signal: refreshAbortController.signal,
        });
      } catch (error) {
        if (
          isRemoteAuthorizationError(error) &&
          isCurrentRefresh() &&
          options.shouldPreserveAuthorizationRejection?.(
            getAuthSessionScopeKey(session)!,
          ) !== true
        ) {
          await invalidateWithoutMasking(error, 'authorization_invalidated');
        }

        throw error;
      }

      try {
        await runStorageTransition(async () => {
          if (!isCurrentRefresh()) {
            throw new Error('Auth refresh was superseded by session cleanup.');
          }

          await options.authSessionStore.save(refreshedSession);

          if (!isCurrentRefresh()) {
            throw new Error('Auth refresh was superseded by session cleanup.');
          }
        });
      } catch (error) {
        if (isCurrentRefresh()) {
          await invalidateWithoutMasking(error);
        }

        throw error;
      }

      sessionRevision += 1;
      setCurrentSession(refreshedSession);
      return refreshedSession;
    })();

    refreshInFlight = {
      abortController: refreshAbortController,
      promise: refreshTask,
      revision: refreshRevision,
      session,
    };

    try {
      return await refreshTask;
    } finally {
      if (refreshInFlight?.promise === refreshTask) {
        refreshInFlight = null;
      }
    }
  };

  const getAccessToken = async () => {
    const session = currentSession;

    if (!session) {
      throw new RemoteHttpError('No auth session is available.', 401);
    }

    if (!isRemoteAuthSession(session)) {
      return undefined;
    }

    try {
      return (await refresh(false)).accessToken;
    } catch (error) {
      if (
        !isRemoteAuthorizationError(error) &&
        currentSession === session &&
        Date.parse(session.accessTokenExpiresAt) > now().getTime()
      ) {
        return session.accessToken;
      }

      throw error;
    }
  };

  return {
    async discardUnboundSessionExactly(expectedSessionScopeKey) {
      if (
        getAuthSessionScopeKey(currentSession) !== expectedSessionScopeKey
      ) {
        return false;
      }

      sessionRevision += 1;
      setCurrentSession(null);
      abortRefreshInFlight();
      await runStorageTransition(() => options.authSessionStore.clearExactly());
      return true;
    },

    async establish(session) {
      const establishRevision = sessionRevision + 1;
      sessionRevision = establishRevision;
      setCurrentSession(null);
      abortRefreshInFlight();

      try {
        await runStorageTransition(async () => {
          if (sessionRevision !== establishRevision) {
            throw new Error(
              'Auth session establishment was superseded by cleanup.',
            );
          }

          await options.authSessionStore.save(session);

          if (sessionRevision !== establishRevision) {
            throw new Error(
              'Auth session establishment was superseded by cleanup.',
            );
          }
        });
      } catch (error) {
        if (sessionRevision === establishRevision) {
          await invalidateWithoutMasking(error);
        }

        throw error;
      }

      setCurrentSession(session);
    },

    forceRefresh() {
      return refresh(true);
    },

    getAccessToken,

    getCurrentSession() {
      return currentSession;
    },

    invalidate,

    async logout() {
      const session = currentSession;
      let remoteRevocation: AuthSessionLogoutResult['remoteRevocation'] =
        session && isRemoteAuthSession(session) ? 'failed' : 'not_required';

      try {
        if (session && isRemoteAuthSession(session)) {
          const activeSession = await refresh(false);
          await options.authRepository.logout(activeSession);
          remoteRevocation = 'succeeded';
        }
      } catch {
        console.warn(
          '[AuthSessionCoordinator] Remote logout could not be confirmed.',
        );
      } finally {
        await invalidate();
      }

      return {remoteRevocation};
    },

    async restore(observeRestoredSession) {
      const restoreRevision = sessionRevision + 1;
      sessionRevision = restoreRevision;
      setCurrentSession(null);
      abortRefreshInFlight();
      const restoredSession = await runStorageTransition(() =>
        options.authSessionStore.load(),
      );

      if (sessionRevision !== restoreRevision) {
        return currentSession;
      }

      if (!restoredSession) {
        return null;
      }

      observeRestoredSession?.(restoredSession);

      if (
        isRemoteAuthSession(restoredSession) &&
        Date.parse(restoredSession.refreshExpiresAt) <= now().getTime()
      ) {
        await invalidate();
        return null;
      }

      setCurrentSession(restoredSession);

      if (!isRemoteAuthSession(restoredSession)) {
        return restoredSession;
      }

      try {
        return await refresh(false);
      } catch (error) {
        if (isRemoteAuthorizationError(error)) {
          throw error;
        }

        return currentSession;
      }
    },

    subscribeSessionScope(listener) {
      sessionScopeListeners.add(listener);
      return () => {
        sessionScopeListeners.delete(listener);
      };
    },
  };
}

function shouldRefresh(
  session: RemoteAuthSession,
  now: Date,
  refreshLeewayMs: number,
) {
  return (
    Date.parse(session.accessTokenExpiresAt) <= now.getTime() + refreshLeewayMs
  );
}
