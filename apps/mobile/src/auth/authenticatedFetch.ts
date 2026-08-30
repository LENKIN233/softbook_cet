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
  protectRawResponseBody?: boolean;
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

    if (response.body === null || response.body === undefined) {
      return response;
    }

    return wrapResponseBodyWithRequestDeadline(response, {
      cancellationSources,
      deadlineAt,
      isRequestSessionCurrent,
      requestAuthority,
      requestLifetimeController,
      protectRawResponseBody: options.protectRawResponseBody === true,
      subscribeCancellation,
    });
  };
}

type ResponseBodyReader =
  | 'arrayBuffer'
  | 'blob'
  | 'bytes'
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
    protectRawResponseBody: boolean;
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
  const lifecycle = createResponseBodyAuthorityLifecycle(options);
  const wrap = (target: Response): Response => {
    const createBodyGeneration = (
      source: ReadableStream<Uint8Array> | null,
    ) => ({
      branch: lifecycle.registerBranch(() =>
        source === null ? undefined : cancelResponseStream(source),
      ),
      obsolete: false,
      source,
    });
    let bodyGeneration = createBodyGeneration(target.body);
    let protectedBody: ReadableStream<Uint8Array> | null | undefined;
    let bodyDisturbed = false;
    const markBodyDisturbed = () => {
      bodyDisturbed = true;
    };
    const refreshBodyGeneration = () => {
      const currentSource = target.body;
      if (bodyGeneration.source === currentSource) {
        return;
      }
      const obsoleteGeneration = bodyGeneration;
      bodyGeneration = createBodyGeneration(currentSource);
      obsoleteGeneration.obsolete = true;
      obsoleteGeneration.branch.finish();
      protectedBody = undefined;
    };
    const getProtectedBody = () => {
      if (!options.protectRawResponseBody) {
        return null;
      }
      refreshBodyGeneration();
      if (protectedBody === undefined) {
        const protectedGeneration = bodyGeneration;
        protectedBody = protectedGeneration.source
          ? createProtectedResponseBody(
              protectedGeneration.source,
              lifecycle,
              protectedGeneration.branch,
              markBodyDisturbed,
              supportsByobReader(protectedGeneration.source),
              () => protectedGeneration.obsolete,
            )
          : null;
        if (protectedBody === null) {
          protectedGeneration.branch.finish();
        }
      }
      return protectedBody;
    };

    return new Proxy(target, {
      get(current, property) {
        if (property === 'bodyUsed') {
          return bodyDisturbed || current.bodyUsed;
        }
        if (property === 'clone') {
          return () => {
            refreshBodyGeneration();
            lifecycle.assertCurrent();
            if (
              options.protectRawResponseBody &&
              protectedBody?.locked === true
            ) {
              throw new TypeError(
                'Response.clone: Body has already been consumed.',
              );
            }
            const cloned = current.clone();
            refreshBodyGeneration();
            return wrap(cloned);
          };
        }
        if (property === 'body') {
          return options.protectRawResponseBody
            ? getProtectedBody()
            : current.body;
        }
        if (isResponseBodyReader(property)) {
          const bodyReader = Reflect.get(current, property, current);
          if (typeof bodyReader !== 'function') {
            return bodyReader;
          }
          return () => {
            refreshBodyGeneration();
            const readerGeneration = bodyGeneration;
            return readResponseBodyWithinDeadline(
              current,
              property,
              getProtectedBody,
              lifecycle,
              readerGeneration.branch,
              markBodyDisturbed,
            );
          };
        }

        const value = Reflect.get(current, property, current);
        return typeof value === 'function' ? value.bind(current) : value;
      },
    });
  };

  return wrap(response);
}

async function readResponseBodyWithinDeadline(
  response: Response,
  reader: ResponseBodyReader,
  getProtectedBody: () => ReadableStream<Uint8Array> | null,
  lifecycle: ResponseBodyAuthorityLifecycle,
  branch: ResponseBodyAuthorityBranch,
  markBodyDisturbed: () => void,
) {
  lifecycle.assertCurrent();
  const protectedBody = getProtectedBody();
  if (protectedBody === null) {
    try {
      const result = await Promise.race([
        invokeResponseBodyReader(response, reader),
        lifecycle.cancellation.then(error => Promise.reject(error)),
      ]);
      lifecycle.assertCurrent();
      return result;
    } finally {
      branch.finish();
    }
  }
  const bodyRead = invokeResponseBodyReader(
    new Response(protectedBody as never, {
      headers: response.headers,
    }),
    reader,
  );
  markBodyDisturbed();
  const result = await Promise.race([
    bodyRead,
    lifecycle.cancellation.then(error => Promise.reject(error)),
  ]);
  lifecycle.assertCurrent();
  return result;
}

type ResponseBodyAuthorityBranch = {
  finish: () => void;
  setCancel: (cancel: () => Promise<unknown> | unknown) => void;
};

type ResponseBodyAuthorityLifecycle = {
  assertCurrent: () => void;
  cancellation: Promise<RemoteRequestLifecycleError>;
  getCancellationError: () => RemoteRequestLifecycleError | null;
  registerBranch: (
    cancel: () => Promise<unknown> | unknown,
  ) => ResponseBodyAuthorityBranch;
};

function createResponseBodyAuthorityLifecycle(options: {
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
}): ResponseBodyAuthorityLifecycle {
  let cancellationError: RemoteRequestLifecycleError | null = null;
  let resolveCancellation:
    | ((error: RemoteRequestLifecycleError) => void)
    | undefined;
  const cancellation = new Promise<RemoteRequestLifecycleError>(resolve => {
    resolveCancellation = resolve;
  });
  const branchCancelers = new Map<symbol, () => Promise<unknown> | unknown>();
  const sourceCleanups: Array<() => void> = [];
  let unsubscribeAuthority: (() => void) | void;
  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    if (deadlineTimer !== null) {
      clearTimeout(deadlineTimer);
      deadlineTimer = null;
    }
    unsubscribeAuthority?.();
    unsubscribeAuthority = undefined;
    while (sourceCleanups.length > 0) {
      sourceCleanups.pop()?.();
    }
  };
  const cancel = (reason: RemoteRequestLifecycleError['reason']) => {
    if (cancellationError !== null) {
      return;
    }
    cancellationError = new RemoteRequestLifecycleError(reason);
    options.requestLifetimeController.abort();
    const cancelers = [...branchCancelers.values()];
    branchCancelers.clear();
    for (const cancelBranch of cancelers) {
      safelyCancelBodyBranch(cancelBranch);
    }
    cleanup();
    resolveCancellation?.(cancellationError);
  };
  const assertCurrent = () => {
    if (cancellationError !== null) {
      throw cancellationError;
    }
    const cancelledSource = options.cancellationSources.find(
      source => source.signal.aborted,
    );
    if (cancelledSource !== undefined) {
      cancel(cancelledSource.reason);
    } else if (!options.isRequestSessionCurrent()) {
      cancel('session_superseded');
    } else if (options.requestAuthority?.isCurrent() === false) {
      cancel('session_quarantined');
    } else if (Date.now() >= options.deadlineAt) {
      cancel('timeout');
    }
    if (cancellationError !== null) {
      throw cancellationError;
    }
  };

  const observedSignals = new Set<AbortSignal>();
  for (const source of options.cancellationSources) {
    if (observedSignals.has(source.signal)) {
      continue;
    }
    observedSignals.add(source.signal);
    const cancelFromSource = () => cancel(source.reason);
    source.signal.addEventListener('abort', cancelFromSource, {once: true});
    sourceCleanups.push(() =>
      source.signal.removeEventListener('abort', cancelFromSource),
    );
  }
  const subscribedAuthority = options.subscribeCancellation(reason =>
    cancel(reason),
  );
  unsubscribeAuthority = subscribedAuthority;
  if (cleanedUp) {
    subscribedAuthority?.();
    unsubscribeAuthority = undefined;
  }
  const remainingMs = options.deadlineAt - Date.now();
  if (remainingMs <= 0) {
    cancel('timeout');
  } else if (cancellationError === null) {
    deadlineTimer = setTimeout(() => cancel('timeout'), remainingMs);
  }
  try {
    assertCurrent();
  } catch {
    // The wrapped body exposes the exact lifecycle error on first use.
  }

  return {
    assertCurrent,
    cancellation,
    getCancellationError: () => cancellationError,
    registerBranch(initialCancel) {
      if (cancellationError !== null) {
        safelyCancelBodyBranch(initialCancel);
        return {
          finish() {},
          setCancel(nextCancel) {
            safelyCancelBodyBranch(nextCancel);
          },
        };
      }
      const id = Symbol('response-body-branch');
      branchCancelers.set(id, initialCancel);
      let finished = false;
      return {
        finish() {
          if (finished) {
            return;
          }
          finished = true;
          branchCancelers.delete(id);
          if (branchCancelers.size === 0 && cancellationError === null) {
            cleanup();
          }
        },
        setCancel(nextCancel) {
          if (!finished) {
            if (cancellationError !== null) {
              finished = true;
              branchCancelers.delete(id);
              safelyCancelBodyBranch(nextCancel);
            } else {
              branchCancelers.set(id, nextCancel);
            }
          }
        },
      };
    },
  };
}

function createProtectedResponseBody<Chunk>(
  source: ReadableStream<Chunk>,
  lifecycle: ResponseBodyAuthorityLifecycle,
  branch: ResponseBodyAuthorityBranch,
  markBodyDisturbed: () => void = () => undefined,
  preserveByteStream = false,
  isObsolete: () => boolean = () => false,
): ReadableStream<Chunk> {
  let reader: ReadableStreamDefaultReader<Chunk> | null = null;
  let guardedController: {
    readonly byobRequest?: {respond: (bytesWritten: number) => void} | null;
    close: () => void;
    enqueue: (chunk: Chunk) => void;
    error: (reason?: unknown) => void;
  } | null = null;
  const cancelForAuthorityLoss = () => {
    const error =
      lifecycle.getCancellationError() ??
      new RemoteRequestLifecycleError('session_quarantined');
    try {
      guardedController?.error(error);
    } catch {
      // A terminal guarded stream already has the required outcome.
    }
    return reader === null
      ? source.cancel(error)
      : reader.cancel(error);
  };
  const requireReader = () => {
    if (reader === null) {
      reader = source.getReader();
      branch.setCancel(cancelForAuthorityLoss);
    }
    return reader;
  };

  const guardedSource = {
    start(controller: NonNullable<typeof guardedController>) {
      guardedController = controller;
      branch.setCancel(cancelForAuthorityLoss);
    },
    cancel(reason: unknown) {
      branch.finish();
      return requireReader().cancel(reason);
    },
    async pull(controller: NonNullable<typeof guardedController>) {
      try {
        lifecycle.assertCurrent();
        markBodyDisturbed();
        const result = await Promise.race([
          requireReader().read(),
          lifecycle.cancellation.then(error => Promise.reject(error)),
        ]);
        lifecycle.assertCurrent();
        if (result.done) {
          branch.finish();
          const pendingByobRequest = preserveByteStream
            ? controller.byobRequest
            : null;
          controller.close();
          if (pendingByobRequest !== null && pendingByobRequest !== undefined) {
            try {
              pendingByobRequest.respond(0);
            } catch {
              // Some runtimes resolve the pending BYOB read during close.
            }
          }
          return;
        }
        controller.enqueue(result.value);
      } catch (error) {
        branch.finish();
        controller.error(error);
        if (reader !== null) {
          safelyCancelBodyBranch(() => reader?.cancel(error));
        }
      }
    },
  };
  const guarded = preserveByteStream
    ? new ReadableStream<Chunk>(
        {...guardedSource, type: 'bytes'} as never,
        {highWaterMark: 0},
      )
    : new ReadableStream<Chunk>(guardedSource, {highWaterMark: 0});

  return new Proxy(guarded, {
    get(current, property) {
      if (property === 'locked') {
        return isObsolete() || current.locked;
      }
      if (isObsolete()) {
        if (property === 'cancel' || property === 'pipeTo') {
          return () =>
            Promise.reject(
              new TypeError('ReadableStream is locked by Response.clone().'),
            );
        }
        if (
          property === 'getReader' ||
          property === 'tee' ||
          property === 'pipeThrough' ||
          property === 'values' ||
          property === Symbol.asyncIterator
        ) {
          return () => {
            throw new TypeError(
              'ReadableStream is locked by Response.clone().',
            );
          };
        }
      }
      if (property === 'tee') {
        return () => {
          lifecycle.assertCurrent();
          const [left, right] = current.tee();
          const leftBranch = lifecycle.registerBranch(() => left.cancel());
          const rightBranch = lifecycle.registerBranch(() => right.cancel());
          return [
            createProtectedResponseBody(
              left,
              lifecycle,
              leftBranch,
              markBodyDisturbed,
              preserveByteStream,
              isObsolete,
            ),
            createProtectedResponseBody(
              right,
              lifecycle,
              rightBranch,
              markBodyDisturbed,
              preserveByteStream,
              isObsolete,
            ),
          ];
        };
      }
      if (property === 'pipeThrough') {
        return (...args: Parameters<typeof current.pipeThrough>) => {
          lifecycle.assertCurrent();
          markBodyDisturbed();
          const output = current.pipeThrough(...args);
          const outputBranch = lifecycle.registerBranch(() =>
            output.cancel(),
          );
          return createProtectedResponseBody(
            output,
            lifecycle,
            outputBranch,
            markBodyDisturbed,
            false,
            isObsolete,
          );
        };
      }
      if (property === 'getReader') {
        return (...args: unknown[]) =>
          createDisturbanceTrackingReader(
            Reflect.apply(current.getReader, current, args) as object,
            markBodyDisturbed,
          );
      }
      if (property === 'cancel' || property === 'pipeTo') {
        return (...args: unknown[]) => {
          markBodyDisturbed();
          const operation = Reflect.get(current, property, current);
          return Reflect.apply(operation, current, args);
        };
      }
      const value = Reflect.get(current, property, current);
      return typeof value === 'function' ? value.bind(current) : value;
    },
  });
}

function createDisturbanceTrackingReader(
  reader: object,
  markBodyDisturbed: () => void,
) {
  return new Proxy(reader, {
    get(current, property) {
      const value = Reflect.get(current, property, current);
      if (
        (property === 'read' || property === 'cancel') &&
        typeof value === 'function'
      ) {
        return (...args: unknown[]) => {
          markBodyDisturbed();
          return Reflect.apply(value, current, args);
        };
      }
      return typeof value === 'function' ? value.bind(current) : value;
    },
  });
}

function supportsByobReader(stream: ReadableStream<unknown>) {
  try {
    const getReader = Reflect.get(stream, 'getReader', stream);
    if (typeof getReader !== 'function') {
      return false;
    }
    const reader = Reflect.apply(getReader, stream, [
      {mode: 'byob'},
    ]) as {releaseLock?: () => void};
    if (typeof reader.releaseLock !== 'function') {
      return false;
    }
    reader.releaseLock();
    return true;
  } catch {
    return false;
  }
}

function safelyCancelBodyBranch(
  cancel: () => Promise<unknown> | unknown,
) {
  Promise.resolve()
    .then(cancel)
    .catch(() => {
      // The lifecycle error remains authoritative over body cleanup.
    });
}

function isResponseBodyReader(value: PropertyKey): value is ResponseBodyReader {
  return (
    value === 'arrayBuffer' ||
    value === 'blob' ||
    value === 'bytes' ||
    value === 'formData' ||
    value === 'json' ||
    value === 'text'
  );
}

function invokeResponseBodyReader(
  response: Response,
  reader: ResponseBodyReader,
): Promise<unknown> {
  const operation = Reflect.get(response, reader, response);
  if (typeof operation !== 'function') {
    throw new TypeError(`Response.${reader} is unavailable.`);
  }
  return operation.call(response) as Promise<unknown>;
}

async function cancelResponseStream(
  stream: ReadableStream<Uint8Array>,
) {
  try {
    await stream.cancel();
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
