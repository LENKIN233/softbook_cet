import type {AuthSessionCoordinator} from './authSessionCoordinator';
import {getAuthSessionScopeKey} from './authSession';
import {
  DEFAULT_REMOTE_REQUEST_TIMEOUT_MS,
  RemoteRequestLifecycleError,
  runBoundedRemoteRequest,
  type RemoteRequestCancellationSource,
} from '../runtime/remoteRequest';

export type AuthenticatedTransportRequestAuthority = {
  isCurrent: () => boolean;
  runBeforeDispatch: <Result>(
    operation: () => Promise<Result>,
  ) => Promise<Result>;
  subscribeCancellation: (listener: () => void) => () => void;
};

export function createAuthenticatedFetch(options: {
  authSessionCoordinator: AuthSessionCoordinator;
  captureRequestAuthority?: () => AuthenticatedTransportRequestAuthority;
  fetchImpl?: typeof fetch;
  shouldPreserveAuthorizationRejection?: (
    sessionScopeKey: string | null,
  ) => boolean;
  shouldQuarantineSession?: (sessionScopeKey: string | null) => boolean;
  timeoutMs?: number;
}): typeof fetch {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs =
    options.timeoutMs ?? DEFAULT_REMOTE_REQUEST_TIMEOUT_MS;

  return async (input, init) => {
    const deadlineAt = Date.now() + timeoutMs;
    const requestLifetimeController = new AbortController();
    const requestSessionScopeKey = getAuthSessionScopeKey(
      options.authSessionCoordinator.getCurrentSession(),
    );
    if (options.shouldQuarantineSession?.(requestSessionScopeKey)) {
      throw new RemoteRequestLifecycleError('session_quarantined');
    }
    const requestAuthority = options.captureRequestAuthority?.();
    const isRequestSessionCurrent = () =>
      getAuthSessionScopeKey(
        options.authSessionCoordinator.getCurrentSession(),
      ) === requestSessionScopeKey;
    const cancellationSources = getRequestCancellationSources(input, init);
    const subscribeCancellation = (
      cancel: (
        reason: Exclude<
          RemoteRequestLifecycleError['reason'],
          'timeout'
        >,
      ) => void,
    ) => {
      const unsubscribeSession =
        options.authSessionCoordinator.subscribeSessionScope(
        (nextSessionScopeKey, reason) => {
          if (nextSessionScopeKey !== requestSessionScopeKey) {
            cancel(
              reason === 'authorization_invalidated'
                ? 'authorization_invalidated'
                : 'session_superseded',
            );
          }
        },
      );
      const unsubscribeAuthority = requestAuthority?.subscribeCancellation(
        () => cancel('session_quarantined'),
      );
      return () => {
        unsubscribeAuthority?.();
        unsubscribeSession();
      };
    };

    const shouldPreserveAuthorizationRejection = () =>
      options.shouldPreserveAuthorizationRejection?.(
        requestSessionScopeKey,
      ) === true;

    const response = await runBoundedRemoteRequest({
      cancellationSources,
      timeoutMs,
      subscribeCancellation,
      operation: async signal => {
        const firstResponse = await fetchWithCurrentAccessToken(
          input,
          init,
          options.authSessionCoordinator,
          fetchImpl,
          requestSessionScopeKey,
          requestAuthority,
          signal,
          requestLifetimeController,
        );

        assertRequestCurrent(isRequestSessionCurrent(), requestAuthority);

        if (
          (firstResponse.status === 401 || firstResponse.status === 403) &&
          shouldPreserveAuthorizationRejection()
        ) {
          return firstResponse;
        }

        if (firstResponse.status === 403) {
          return firstResponse;
        }

        if (firstResponse.status !== 401) {
          return firstResponse;
        }

        await options.authSessionCoordinator.forceRefresh();

        assertRequestCurrent(isRequestSessionCurrent(), requestAuthority);

        const retryResponse = await fetchWithCurrentAccessToken(
          input,
          init,
          options.authSessionCoordinator,
          fetchImpl,
          requestSessionScopeKey,
          requestAuthority,
          signal,
          requestLifetimeController,
        );

        assertRequestCurrent(isRequestSessionCurrent(), requestAuthority);

        return retryResponse;
      },
    });

    if (
      (response.status === 401 || response.status === 403) &&
      !shouldPreserveAuthorizationRejection()
    ) {
      assertRequestCurrent(isRequestSessionCurrent(), requestAuthority);
      await options.authSessionCoordinator.invalidate();
    }

    return wrapResponseBodyWithRequestDeadline(response, {
      cancellationSources,
      deadlineAt,
      isRequestSessionCurrent,
      requestAuthority,
      requestLifetimeController,
      subscribeCancellation,
    });
  };
}

type ResponseBodyReader =
  | 'arrayBuffer'
  | 'blob'
  | 'formData'
  | 'json'
  | 'text';

function wrapResponseBodyWithRequestDeadline(
  response: Response,
  options: {
    cancellationSources: RemoteRequestCancellationSource[];
    deadlineAt: number;
    isRequestSessionCurrent: () => boolean;
    requestAuthority?: AuthenticatedTransportRequestAuthority;
    requestLifetimeController: AbortController;
    subscribeCancellation: (
      cancel: (
        reason: Exclude<
          RemoteRequestLifecycleError['reason'],
          'timeout'
        >,
      ) => void,
    ) => (() => void) | void;
  },
): Response {
  const wrap = (target: Response): Response =>
    new Proxy(target, {
      get(current, property) {
        if (property === 'clone') {
          return () => wrap(current.clone());
        }
        if (isResponseBodyReader(property)) {
          return () =>
            readResponseBodyWithinDeadline(current, property, options);
        }

        const value = Reflect.get(current, property, current);
        return typeof value === 'function' ? value.bind(current) : value;
      },
    });

  return wrap(response);
}

function readResponseBodyWithinDeadline(
  response: Response,
  reader: ResponseBodyReader,
  options: {
    cancellationSources: RemoteRequestCancellationSource[];
    deadlineAt: number;
    isRequestSessionCurrent: () => boolean;
    requestAuthority?: AuthenticatedTransportRequestAuthority;
    requestLifetimeController: AbortController;
    subscribeCancellation: (
      cancel: (
        reason: Exclude<
          RemoteRequestLifecycleError['reason'],
          'timeout'
        >,
      ) => void,
    ) => (() => void) | void;
  },
) {
  const cancelledSource = options.cancellationSources.find(
    source => source.signal.aborted,
  );
  if (cancelledSource !== undefined) {
    options.requestLifetimeController.abort();
    void cancelResponseBody(response);
    return Promise.reject(
      new RemoteRequestLifecycleError(cancelledSource.reason),
    );
  }
  if (!options.isRequestSessionCurrent()) {
    options.requestLifetimeController.abort();
    void cancelResponseBody(response);
    return Promise.reject(
      new RemoteRequestLifecycleError('session_superseded'),
    );
  }
  if (options.requestAuthority?.isCurrent() === false) {
    options.requestLifetimeController.abort();
    void cancelResponseBody(response);
    return Promise.reject(
      new RemoteRequestLifecycleError('session_quarantined'),
    );
  }
  const remainingMs = options.deadlineAt - Date.now();
  if (remainingMs <= 0) {
    options.requestLifetimeController.abort();
    void cancelResponseBody(response);
    return Promise.reject(new RemoteRequestLifecycleError('timeout'));
  }

  return runBoundedRemoteRequest({
    cancellationSources: options.cancellationSources,
    timeoutMs: remainingMs,
    subscribeCancellation: options.subscribeCancellation,
    operation: async signal => {
      const cancelBody = () => {
        options.requestLifetimeController.abort();
        void cancelResponseBody(response);
      };
      signal.addEventListener('abort', cancelBody, {once: true});
      try {
        const result = await response[reader]();
        assertRequestCurrent(
          options.isRequestSessionCurrent(),
          options.requestAuthority,
        );
        return result;
      } finally {
        signal.removeEventListener('abort', cancelBody);
      }
    },
  });
}

function isResponseBodyReader(value: PropertyKey): value is ResponseBodyReader {
  return (
    value === 'arrayBuffer' ||
    value === 'blob' ||
    value === 'formData' ||
    value === 'json' ||
    value === 'text'
  );
}

async function cancelResponseBody(response: Response) {
  try {
    await response.body?.cancel();
  } catch {
    // Deadline and session authority remain the request outcome.
  }
}

async function fetchWithCurrentAccessToken(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
  authSessionCoordinator: AuthSessionCoordinator,
  fetchImpl: typeof fetch,
  expectedSessionScopeKey: string | null,
  requestAuthority: AuthenticatedTransportRequestAuthority | undefined,
  signal: AbortSignal,
  requestLifetimeController: AbortController,
) {
  const abortRequestLifetime = () => requestLifetimeController.abort();
  signal.addEventListener('abort', abortRequestLifetime, {once: true});
  if (signal.aborted) {
    abortRequestLifetime();
  }

  try {
    const accessToken = await authSessionCoordinator.getAccessToken();

    if (requestLifetimeController.signal.aborted) {
      throw new RemoteRequestLifecycleError('caller_cancelled');
    }

    assertRequestCurrent(
      getAuthSessionScopeKey(authSessionCoordinator.getCurrentSession()) ===
        expectedSessionScopeKey,
      requestAuthority,
    );

    const headers = new Headers(init?.headers);

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const dispatch = () =>
      fetchImpl(input, {
        ...init,
        headers,
        signal: requestLifetimeController.signal,
      });
    return await (requestAuthority !== undefined &&
    isAuthenticatedWriteRequest(input, init)
      ? requestAuthority.runBeforeDispatch(dispatch)
      : dispatch());
  } finally {
    signal.removeEventListener('abort', abortRequestLifetime);
  }
}

function assertRequestSessionCurrent(isCurrent: boolean) {
  if (!isCurrent) {
    throw new RemoteRequestLifecycleError('session_superseded');
  }
}

function assertRequestCurrent(
  isSessionCurrent: boolean,
  requestAuthority: AuthenticatedTransportRequestAuthority | undefined,
) {
  assertRequestSessionCurrent(isSessionCurrent);
  if (requestAuthority?.isCurrent() === false) {
    throw new RemoteRequestLifecycleError('session_quarantined');
  }
}

function isAuthenticatedWriteRequest(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
) {
  const requestMethod =
    typeof Request !== 'undefined' && input instanceof Request
      ? input.method
      : undefined;
  const method = (init?.method ?? requestMethod ?? 'GET').toUpperCase();
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
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
