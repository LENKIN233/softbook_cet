export const DEFAULT_REMOTE_REQUEST_TIMEOUT_MS = 15_000;

export type RemoteRequestLifecycleReason =
  | 'caller_cancelled'
  | 'session_superseded'
  | 'timeout';

export class RemoteRequestLifecycleError extends Error {
  readonly reason: RemoteRequestLifecycleReason;
  readonly retryable: boolean;

  constructor(reason: RemoteRequestLifecycleReason) {
    super(getRemoteRequestLifecycleMessage(reason));
    this.name = 'RemoteRequestLifecycleError';
    this.reason = reason;
    this.retryable = reason === 'timeout';
  }
}

export function isRemoteRequestCancellationError(error: unknown): boolean {
  return (
    error instanceof RemoteRequestLifecycleError &&
    error.reason !== 'timeout'
  );
}

export type RemoteRequestCancellationSource = {
  reason: Exclude<RemoteRequestLifecycleReason, 'timeout'>;
  signal: AbortSignal;
};

export function runBoundedRemoteRequest<Result>(options: {
  cancellationSources?: readonly RemoteRequestCancellationSource[];
  operation: (signal: AbortSignal) => Promise<Result>;
  subscribeCancellation?: (
    cancel: (reason: Exclude<RemoteRequestLifecycleReason, 'timeout'>) => void,
  ) => (() => void) | void;
  timeoutMs?: number;
}): Promise<Result> {
  const timeoutMs =
    options.timeoutMs ?? DEFAULT_REMOTE_REQUEST_TIMEOUT_MS;

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('Remote request timeout must be a positive number.');
  }

  return new Promise<Result>((resolve, reject) => {
    const controller = new AbortController();
    const cleanups: Array<() => void> = [];
    let settled = false;

    const cleanup = () => {
      while (cleanups.length > 0) {
        try {
          cleanups.pop()?.();
        } catch {
          // Cleanup must not replace the request's authoritative outcome.
        }
      }
    };
    const resolveOnce = (result: Result) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(result);
    };
    const rejectOnce = (error: unknown) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error);
    };
    const cancel = (reason: RemoteRequestLifecycleReason) => {
      if (settled) {
        return;
      }

      controller.abort();
      rejectOnce(new RemoteRequestLifecycleError(reason));
    };

    const timeout = setTimeout(() => cancel('timeout'), timeoutMs);
    cleanups.push(() => clearTimeout(timeout));

    for (const source of deduplicateCancellationSources(
      options.cancellationSources ?? [],
    )) {
      if (source.signal.aborted) {
        cancel(source.reason);
        return;
      }

      const cancelFromSource = () => cancel(source.reason);
      source.signal.addEventListener('abort', cancelFromSource, {once: true});
      cleanups.push(() =>
        source.signal.removeEventListener('abort', cancelFromSource),
      );
    }

    if (options.subscribeCancellation) {
      let unsubscribe: (() => void) | void;

      try {
        unsubscribe = options.subscribeCancellation(reason => cancel(reason));
      } catch (error) {
        rejectOnce(error);
        return;
      }

      if (unsubscribe) {
        if (settled) {
          unsubscribe();
          return;
        }
        cleanups.push(unsubscribe);
      }
    }

    if (settled) {
      return;
    }

    let operation: Promise<Result>;

    try {
      operation = options.operation(controller.signal);
    } catch (error) {
      rejectOnce(error);
      return;
    }

    operation.then(resolveOnce, rejectOnce);
  });
}

function deduplicateCancellationSources(
  sources: readonly RemoteRequestCancellationSource[],
) {
  const seen = new Set<AbortSignal>();

  return sources.filter(source => {
    if (seen.has(source.signal)) {
      return false;
    }

    seen.add(source.signal);
    return true;
  });
}

function getRemoteRequestLifecycleMessage(
  reason: RemoteRequestLifecycleReason,
) {
  switch (reason) {
    case 'caller_cancelled':
      return 'Remote request was cancelled.';
    case 'session_superseded':
      return 'Remote request was superseded by a newer session.';
    case 'timeout':
      return 'Remote request timed out.';
  }
}
