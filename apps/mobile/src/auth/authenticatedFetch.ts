import type {AuthSessionCoordinator} from './authSessionCoordinator';
import {getAuthSessionScopeKey} from './authSession';
import {
  DEFAULT_REMOTE_REQUEST_TIMEOUT_MS,
  RemoteRequestLifecycleError,
  runBoundedRemoteRequest,
  type RemoteRequestCancellationSource,
} from '../runtime/remoteRequest';

export function createAuthenticatedFetch(options: {
  authSessionCoordinator: AuthSessionCoordinator;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): typeof fetch {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs =
    options.timeoutMs ?? DEFAULT_REMOTE_REQUEST_TIMEOUT_MS;

  return async (input, init) => {
    const requestSessionScopeKey = getAuthSessionScopeKey(
      options.authSessionCoordinator.getCurrentSession(),
    );
    const isRequestSessionCurrent = () =>
      getAuthSessionScopeKey(
        options.authSessionCoordinator.getCurrentSession(),
      ) === requestSessionScopeKey;
    const cancellationSources = getRequestCancellationSources(input, init);

    const response = await runBoundedRemoteRequest({
      cancellationSources,
      timeoutMs,
      subscribeCancellation: cancel =>
        options.authSessionCoordinator.subscribeSessionScope(
          nextSessionScopeKey => {
            if (nextSessionScopeKey !== requestSessionScopeKey) {
              cancel('session_superseded');
            }
          },
        ),
      operation: async signal => {
        const firstResponse = await fetchWithCurrentAccessToken(
          input,
          init,
          options.authSessionCoordinator,
          fetchImpl,
          requestSessionScopeKey,
          signal,
        );

        assertRequestSessionCurrent(isRequestSessionCurrent());

        if (firstResponse.status === 403) {
          return firstResponse;
        }

        if (firstResponse.status !== 401) {
          return firstResponse;
        }

        await options.authSessionCoordinator.forceRefresh();

        assertRequestSessionCurrent(isRequestSessionCurrent());

        const retryResponse = await fetchWithCurrentAccessToken(
          input,
          init,
          options.authSessionCoordinator,
          fetchImpl,
          requestSessionScopeKey,
          signal,
        );

        assertRequestSessionCurrent(isRequestSessionCurrent());

        return retryResponse;
      },
    });

    if (response.status === 401 || response.status === 403) {
      assertRequestSessionCurrent(isRequestSessionCurrent());
      await options.authSessionCoordinator.invalidate();
    }

    return response;
  };
}

async function fetchWithCurrentAccessToken(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
  authSessionCoordinator: AuthSessionCoordinator,
  fetchImpl: typeof fetch,
  expectedSessionScopeKey: string | null,
  signal: AbortSignal,
) {
  const accessToken = await authSessionCoordinator.getAccessToken();

  if (
    getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()) !==
    expectedSessionScopeKey
  ) {
    throw new RemoteRequestLifecycleError('session_superseded');
  }

  const headers = new Headers(init?.headers);

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return fetchImpl(input, {
    ...init,
    headers,
    signal,
  });
}

function assertRequestSessionCurrent(isCurrent: boolean) {
  if (!isCurrent) {
    throw new RemoteRequestLifecycleError('session_superseded');
  }
}

function getRequestCancellationSources(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
): RemoteRequestCancellationSource[] {
  const signals = [init?.signal];

  if (typeof Request !== 'undefined' && input instanceof Request) {
    signals.push(input.signal);
  }

  return signals
    .filter((signal): signal is AbortSignal => signal !== null && signal !== undefined)
    .map(signal => ({reason: 'caller_cancelled' as const, signal}));
}
