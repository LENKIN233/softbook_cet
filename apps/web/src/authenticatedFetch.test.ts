import type {AuthRepository} from '../../mobile/src/auth/authRepository';
import {createAuthenticatedFetch as createSharedAuthenticatedFetch} from '../../mobile/src/auth/authenticatedFetch';
import {createAuthSessionCoordinator} from '../../mobile/src/auth/authSessionCoordinator';
import {createMemoryOnlyAuthSessionStore} from './webStorage';
import {createWebAccountDeletionStateStore} from './webAccountDeletionState';
import {RemoteRequestLifecycleError} from '../../mobile/src/runtime/remoteRequest';

function createAuthenticatedFetch(
  options: Parameters<typeof createSharedAuthenticatedFetch>[0],
) {
  return createSharedAuthenticatedFetch({
    ...options,
    protectRawResponseBody: true,
  });
}

describe('Web authenticated fetch deadline', () => {
  it.each(
    ['arrayBuffer', 'blob', 'bytes', 'formData', 'json', 'text'].filter(
      reader =>
        typeof Reflect.get(Response.prototype, reader) === 'function',
    ),
  )('guards the standard Response.%s body consumer', async reader => {
    const coordinator = await createCoordinator();
    let epochListener: (() => void) | null = null;
    let epochCurrent = true;
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      captureRequestAuthority: () => ({
        isCurrent: () => epochCurrent,
        runBeforeDispatch: operation => operation(),
        subscribeCancellation(listener) {
          epochListener = listener;
          return () => {
            epochListener = null;
          };
        },
      }),
      fetchImpl: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('stale-secret'));
            },
          }),
          {headers: {'content-type': 'application/json'}},
        ),
      timeoutMs: 1_000,
    });
    const response = await authenticatedFetch(
      'https://runtime.example.cn/v2/bootstrap',
    );
    const bodyReader = Reflect.get(response, reader);
    expect(typeof bodyReader).toBe('function');
    const result = bodyReader.call(response) as Promise<unknown>;
    await Promise.resolve();
    epochCurrent = false;
    expect(epochListener).not.toBeNull();
    (epochListener as unknown as () => void)();

    await expect(result).rejects.toMatchObject({
      reason: 'session_quarantined',
    });
    expect(epochListener).toBeNull();
  });

  it('mirrors native bodyUsed timing for convenience and raw stream consumers', async () => {
    const coordinator = await createCoordinator();
    const createResponse = () =>
      createAuthenticatedFetch({
        authSessionCoordinator: coordinator,
        fetchImpl: async () => new Response('body-used'),
      })('https://runtime.example.cn/v2/bootstrap');

    const convenience = await createResponse();
    const convenienceRead = convenience.text();
    expect(convenience.bodyUsed).toBe(true);
    await convenienceRead;

    const lockedOnly = await createResponse();
    const lockedReader = lockedOnly.body!.getReader();
    expect(lockedOnly.bodyUsed).toBe(false);
    lockedReader.releaseLock();
    await lockedOnly.text();

    const rawReadResponse = await createResponse();
    const rawReader = rawReadResponse.body!.getReader();
    const rawRead = rawReader.read();
    expect(rawReadResponse.bodyUsed).toBe(true);
    await rawRead;
    await rawReader.cancel();

    const teeResponse = await createResponse();
    const [left, right] = teeResponse.body!.tee();
    expect(teeResponse.bodyUsed).toBe(false);
    await Promise.all([
      new Response(left).text(),
      new Response(right).text(),
    ]);
    expect(teeResponse.bodyUsed).toBe(true);

    const pipeResponse = await createResponse();
    const transformed = pipeResponse.body!.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>(),
    );
    expect(pipeResponse.bodyUsed).toBe(true);
    await new Response(transformed).text();

    const cancelled = await createResponse();
    const cancellation = cancelled.body!.cancel();
    expect(cancelled.bodyUsed).toBe(true);
    await cancellation;
  });

  it('preserves BYOB byte-stream reads and cancels them on epoch loss', async () => {
    const coordinator = await createCoordinator();
    let epochListener: (() => void) | null = null;
    let epochCurrent = true;
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      captureRequestAuthority: () => ({
        isCurrent: () => epochCurrent,
        runBeforeDispatch: operation => operation(),
        subscribeCancellation(listener) {
          epochListener = listener;
          return () => {
            epochListener = null;
          };
        },
      }),
      fetchImpl: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            type: 'bytes',
            start(controller) {
              controller.enqueue(Uint8Array.of(7));
            },
          }),
        ),
      timeoutMs: 1_000,
    });
    const response = await authenticatedFetch(
      'https://runtime.example.cn/v2/bootstrap',
    );
    const reader = response.body!.getReader({mode: 'byob'});
    expect(response.bodyUsed).toBe(false);
    const firstRead = reader.read(new Uint8Array(1));
    expect(response.bodyUsed).toBe(true);
    await expect(firstRead).resolves.toMatchObject({
      done: false,
      value: Uint8Array.of(7),
    });

    epochCurrent = false;
    expect(epochListener).not.toBeNull();
    (epochListener as unknown as () => void)();

    await expect(reader.read(new Uint8Array(1))).rejects.toMatchObject({
      reason: 'session_quarantined',
    });
    expect(epochListener).toBeNull();
  });

  it('resolves normal BYOB EOF and releases its authority listener', async () => {
    const coordinator = await createCoordinator();
    const activeEpochListeners = new Set<() => void>();
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      captureRequestAuthority: () => ({
        isCurrent: () => true,
        runBeforeDispatch: operation => operation(),
        subscribeCancellation(listener) {
          activeEpochListeners.add(listener);
          return () => activeEpochListeners.delete(listener);
        },
      }),
      fetchImpl: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            type: 'bytes',
            start(controller) {
              controller.enqueue(Uint8Array.of(7));
              controller.close();
            },
          }),
        ),
      timeoutMs: 1_000,
    });
    const response = await authenticatedFetch(
      'https://runtime.example.cn/v2/bootstrap',
    );
    const reader = response.body!.getReader({mode: 'byob'});

    await expect(reader.read(new Uint8Array(1))).resolves.toMatchObject({
      done: false,
      value: Uint8Array.of(7),
    });
    await expect(reader.read(new Uint8Array(1))).resolves.toEqual({
      done: true,
      value: new Uint8Array(0),
    });
    expect(activeEpochListeners.size).toBe(0);
  });

  it('aborts an in-flight authenticated transport as soon as its account epoch changes', async () => {
    const coordinator = await createCoordinator();
    let epochListener: (() => void) | null = null;
    let requestSignal: AbortSignal | undefined;
    let epochCurrent = true;
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      captureRequestAuthority: () => ({
        isCurrent: () => epochCurrent,
        runBeforeDispatch: operation => operation(),
        subscribeCancellation(listener) {
          epochListener = listener;
          return () => {
            epochListener = null;
          };
        },
      }),
      fetchImpl: (_input, init) =>
        new Promise<Response>(() => {
          requestSignal = init?.signal ?? undefined;
        }),
      timeoutMs: 1_000,
    });

    const request = authenticatedFetch(
      'https://runtime.example.cn/v2/bootstrap',
    );
    await vi.waitFor(() => expect(requestSignal).toBeDefined());
    epochCurrent = false;
    expect(epochListener).not.toBeNull();
    (epochListener as unknown as () => void)();

    await expect(request).rejects.toMatchObject({
      reason: 'session_quarantined',
    });
    expect(requestSignal?.aborted).toBe(true);
    expect(epochListener).toBeNull();
  });

  it('runs every authenticated write through its exact pre-dispatch authority', async () => {
    const coordinator = await createCoordinator();
    const fetchImpl = vi.fn(async () => new Response(null, {status: 204}));
    const runBeforeDispatch = vi.fn(async () => {
      throw new RemoteRequestLifecycleError('session_quarantined');
    });
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      captureRequestAuthority: () => ({
        isCurrent: () => true,
        runBeforeDispatch,
        subscribeCancellation: () => () => undefined,
      }),
      fetchImpl,
    });

    await expect(
      authenticatedFetch('https://runtime.example.cn/v2/learning/events', {
        body: '{}',
        method: 'POST',
      }),
    ).rejects.toMatchObject({reason: 'session_quarantined'});
    expect(runBeforeDispatch).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('keeps the deadline active through response body parsing', async () => {
    vi.useFakeTimers();
    try {
      const coordinator = await createCoordinator();
      let requestSignal: AbortSignal | undefined;
      const authenticatedFetch = createAuthenticatedFetch({
        authSessionCoordinator: coordinator,
        fetchImpl: async (_input, init) => {
          requestSignal = init?.signal ?? undefined;
          return new Response(
            new ReadableStream<Uint8Array>({
              start() {
                // Headers resolve immediately while the JSON body never ends.
              },
            }),
            {headers: {'content-type': 'application/json'}, status: 200},
          );
        },
        timeoutMs: 25,
      });

      const response = await authenticatedFetch('https://runtime.example.cn/v2/bootstrap');
      const assertion = expect(response.json()).rejects.toThrow(
        'Remote request timed out.',
      );
      await vi.advanceTimersByTimeAsync(26);
      await assertion;
      expect(requestSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps epoch listeners active through raw and cloned response-body readers', async () => {
    const coordinator = await createCoordinator();
    let epochListener: (() => void) | null = null;
    let epochCurrent = true;
    let requestSignal: AbortSignal | undefined;
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      captureRequestAuthority: () => ({
        isCurrent: () => epochCurrent,
        runBeforeDispatch: operation => operation(),
        subscribeCancellation(listener) {
          epochListener = listener;
          return () => {
            epochListener = null;
          };
        },
      }),
      fetchImpl: async (_input, init) => {
        requestSignal = init?.signal ?? undefined;
        return new Response(
          new ReadableStream<Uint8Array>({
            start() {
              // Both tee branches remain pending until authority is lost.
            },
          }),
          {status: 200},
        );
      },
      timeoutMs: 1_000,
    });

    const response = await authenticatedFetch(
      'https://runtime.example.cn/v2/bootstrap',
    );
    const clonedResponse = response.clone();
    const originalRead = response.body!.getReader().read();
    const clonedRead = clonedResponse.body!.getReader().read();

    expect(epochListener).not.toBeNull();
    epochCurrent = false;
    (epochListener as unknown as () => void)();

    await expect(originalRead).rejects.toMatchObject({
      reason: 'session_quarantined',
    });
    await expect(clonedRead).rejects.toMatchObject({
      reason: 'session_quarantined',
    });
    expect(requestSignal?.aborted).toBe(true);
    expect(epochListener).toBeNull();
    expect(() => response.clone()).toThrow(RemoteRequestLifecycleError);
  });

  it('keeps caller cancellation bound after headers until a raw body terminates', async () => {
    const coordinator = await createCoordinator();
    const caller = new AbortController();
    let requestSignal: AbortSignal | undefined;
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      fetchImpl: async (_input, init) => {
        requestSignal = init?.signal ?? undefined;
        return new Response(
          new ReadableStream<Uint8Array>({
            start() {
              // Raw bytes remain pending until the caller cancels.
            },
          }),
          {status: 200},
        );
      },
      timeoutMs: 1_000,
    });

    const response = await authenticatedFetch(
      'https://runtime.example.cn/v2/bootstrap',
      {signal: caller.signal},
    );
    const rawRead = response.body!.getReader().read();
    caller.abort();

    await expect(rawRead).rejects.toMatchObject({
      reason: 'caller_cancelled',
    });
    expect(requestSignal?.aborted).toBe(true);
  });

  it('keeps authority alive when a competing convenience reader fails on a locked raw body', async () => {
    const coordinator = await createCoordinator();
    const activeEpochListeners = new Set<() => void>();
    let epochCurrent = true;
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      captureRequestAuthority: () => ({
        isCurrent: () => epochCurrent,
        runBeforeDispatch: operation => operation(),
        subscribeCancellation(listener) {
          activeEpochListeners.add(listener);
          return () => activeEpochListeners.delete(listener);
        },
      }),
      fetchImpl: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start() {
              // The raw read remains pending until authority is lost.
            },
          }),
        ),
      timeoutMs: 1_000,
    });
    const response = await authenticatedFetch(
      'https://runtime.example.cn/v2/bootstrap',
    );
    const rawRead = response.body!.getReader().read();

    await expect(response.text()).rejects.toThrow(TypeError);
    expect(activeEpochListeners.size).toBe(1);
    epochCurrent = false;
    for (const listener of activeEpochListeners) listener();

    await expect(rawRead).rejects.toMatchObject({
      reason: 'session_quarantined',
    });
    expect(activeEpochListeners.size).toBe(0);
  });

  it('rejects bytes buffered by a slow clone after the fast branch reaches EOF', async () => {
    const coordinator = await createCoordinator();
    const activeEpochListeners = new Set<() => void>();
    let epochCurrent = true;
    let requestSignal: AbortSignal | undefined;
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      captureRequestAuthority: () => ({
        isCurrent: () => epochCurrent,
        runBeforeDispatch: operation => operation(),
        subscribeCancellation(listener) {
          activeEpochListeners.add(listener);
          return () => activeEpochListeners.delete(listener);
        },
      }),
      fetchImpl: async (_input, init) => {
        requestSignal = init?.signal ?? undefined;
        return new Response('buffered-clone-bytes', {status: 200});
      },
      timeoutMs: 1_000,
    });

    const response = await authenticatedFetch(
      'https://runtime.example.cn/v2/bootstrap',
    );
    const slowClone = response.clone();
    const nestedClone = slowClone.clone();
    await expect(response.text()).resolves.toBe('buffered-clone-bytes');
    expect(activeEpochListeners.size).toBe(1);

    epochCurrent = false;
    for (const listener of activeEpochListeners) listener();

    await expect(slowClone.text()).rejects.toMatchObject({
      reason: 'session_quarantined',
    });
    await expect(nestedClone.text()).rejects.toMatchObject({
      reason: 'session_quarantined',
    });
    expect(requestSignal?.aborted).toBe(true);
    expect(activeEpochListeners.size).toBe(0);
  });

  it('preserves native clone semantics after body access without allowing a guard bypass', async () => {
    const coordinator = await createCoordinator();
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      fetchImpl: async () => new Response('clone-after-body-access'),
    });

    const response = await authenticatedFetch(
      'https://runtime.example.cn/v2/bootstrap',
    );
    const accessedBody = response.body;
    expect(accessedBody?.locked).toBe(false);
    const cloned = response.clone();

    expect(accessedBody?.locked).toBe(true);
    expect(response.body).not.toBe(accessedBody);
    await expect(response.text()).resolves.toBe('clone-after-body-access');
    await expect(cloned.text()).resolves.toBe('clone-after-body-access');
  });

  it.each(['epoch', 'deadline'] as const)(
    'isolates an obsolete held body from the current clone generation under %s cancellation',
    async cancellationKind => {
      if (cancellationKind === 'deadline') {
        vi.useFakeTimers();
      }
      try {
        const coordinator = await createCoordinator();
        const activeEpochListeners = new Set<() => void>();
        let epochCurrent = true;
        const authenticatedFetch = createAuthenticatedFetch({
          authSessionCoordinator: coordinator,
          captureRequestAuthority: () => ({
            isCurrent: () => epochCurrent,
            runBeforeDispatch: operation => operation(),
            subscribeCancellation(listener) {
              activeEpochListeners.add(listener);
              return () => activeEpochListeners.delete(listener);
            },
          }),
          fetchImpl: async () =>
            new Response(
              new ReadableStream<Uint8Array>({
                start() {
                  // Current response-body reading remains pending.
                },
              }),
            ),
          timeoutMs: 25,
        });
        const response = await authenticatedFetch(
          'https://runtime.example.cn/v2/bootstrap',
        );
        const heldBeforeClone = response.body!;
        const cloned = response.clone();

        expect(heldBeforeClone.locked).toBe(true);
        expect(() => heldBeforeClone.getReader()).toThrow(TypeError);
        const cloneCancellation = cloned.body!.cancel();
        cloneCancellation.catch(() => undefined);
        await Promise.resolve();

        const currentRead = response.body!.getReader().read();
        expect(activeEpochListeners.size).toBe(1);
        const currentReadAssertion = expect(currentRead).rejects.toMatchObject({
          reason:
            cancellationKind === 'epoch'
              ? 'session_quarantined'
              : 'timeout',
        });
        if (cancellationKind === 'epoch') {
          epochCurrent = false;
          for (const listener of activeEpochListeners) listener();
        } else {
          await vi.advanceTimersByTimeAsync(26);
        }

        await currentReadAssertion;
        await cloneCancellation.catch(() => undefined);
        expect(activeEpochListeners.size).toBe(0);
      } finally {
        if (cancellationKind === 'deadline') {
          vi.useRealTimers();
        }
      }
    },
  );

  it('rejects clone while the guarded body is locked and permits it after an unread release', async () => {
    const coordinator = await createCoordinator();
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      fetchImpl: async () => new Response('locked-body'),
    });
    const response = await authenticatedFetch(
      'https://runtime.example.cn/v2/bootstrap',
    );
    const reader = response.body!.getReader();

    expect(response.bodyUsed).toBe(false);
    expect(() => response.clone()).toThrow(TypeError);
    reader.releaseLock();

    const clone = response.clone();
    await expect(response.text()).resolves.toBe('locked-body');
    await expect(clone.text()).resolves.toBe('locked-body');
  });

  it('does not enqueue a byte delivered in the same turn that invalidates authority', async () => {
    const coordinator = await createCoordinator();
    let epochListener: (() => void) | null = null;
    let epochCurrent = true;
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      captureRequestAuthority: () => ({
        isCurrent: () => epochCurrent,
        runBeforeDispatch: operation => operation(),
        subscribeCancellation(listener) {
          epochListener = listener;
          return () => {
            epochListener = null;
          };
        },
      }),
      fetchImpl: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              controller.enqueue(Uint8Array.of(99));
              epochCurrent = false;
              epochListener?.();
            },
          }, {highWaterMark: 0}),
        ),
    });

    const response = await authenticatedFetch(
      'https://runtime.example.cn/v2/bootstrap',
    );
    await expect(response.body!.getReader().read()).rejects.toMatchObject({
      reason: 'session_quarantined',
    });
    expect(epochListener).toBeNull();
  });

  it('rejects the next raw chunk after a partial read loses epoch authority', async () => {
    const coordinator = await createCoordinator();
    const activeEpochListeners = new Set<() => void>();
    let epochCurrent = true;
    let enqueueSecond: () => void = () => {
      throw new Error('source controller is unavailable');
    };
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      captureRequestAuthority: () => ({
        isCurrent: () => epochCurrent,
        runBeforeDispatch: operation => operation(),
        subscribeCancellation(listener) {
          activeEpochListeners.add(listener);
          return () => activeEpochListeners.delete(listener);
        },
      }),
      fetchImpl: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              enqueueSecond = () => controller.enqueue(Uint8Array.of(2));
              controller.enqueue(Uint8Array.of(1));
            },
          }),
        ),
      timeoutMs: 1_000,
    });

    const response = await authenticatedFetch(
      'https://runtime.example.cn/v2/bootstrap',
    );
    const reader = response.body!.getReader();
    await expect(reader.read()).resolves.toMatchObject({
      done: false,
      value: Uint8Array.of(1),
    });
    epochCurrent = false;
    for (const listener of activeEpochListeners) listener();
    enqueueSecond();

    await expect(reader.read()).rejects.toMatchObject({
      reason: 'session_quarantined',
    });
    expect(activeEpochListeners.size).toBe(0);
  });

  it('guards both tee outputs after their source has buffered to EOF', async () => {
    const coordinator = await createCoordinator();
    const activeEpochListeners = new Set<() => void>();
    let epochCurrent = true;
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      captureRequestAuthority: () => ({
        isCurrent: () => epochCurrent,
        runBeforeDispatch: operation => operation(),
        subscribeCancellation(listener) {
          activeEpochListeners.add(listener);
          return () => activeEpochListeners.delete(listener);
        },
      }),
      fetchImpl: async () => new Response('tee-buffered-bytes'),
      timeoutMs: 1_000,
    });

    const response = await authenticatedFetch(
      'https://runtime.example.cn/v2/bootstrap',
    );
    const [left, right] = response.body!.tee();
    await Promise.resolve();
    await Promise.resolve();
    epochCurrent = false;
    for (const listener of activeEpochListeners) listener();

    await expect(new Response(left).text()).rejects.toMatchObject({
      reason: 'session_quarantined',
    });
    await expect(new Response(right).text()).rejects.toMatchObject({
      reason: 'session_quarantined',
    });
    expect(activeEpochListeners.size).toBe(0);
  });

  it('guards pipeThrough output that outlives its response-body source', async () => {
    const coordinator = await createCoordinator();
    const activeEpochListeners = new Set<() => void>();
    let epochCurrent = true;
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      captureRequestAuthority: () => ({
        isCurrent: () => epochCurrent,
        runBeforeDispatch: operation => operation(),
        subscribeCancellation(listener) {
          activeEpochListeners.add(listener);
          return () => activeEpochListeners.delete(listener);
        },
      }),
      fetchImpl: async () => new Response('pipe-buffered-bytes'),
      timeoutMs: 1_000,
    });
    const response = await authenticatedFetch(
      'https://runtime.example.cn/v2/bootstrap',
    );
    const transformed = response.body!.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          controller.enqueue(chunk);
        },
      }),
    );
    await Promise.resolve();
    await Promise.resolve();
    epochCurrent = false;
    for (const listener of activeEpochListeners) listener();

    await expect(new Response(transformed).text()).rejects.toMatchObject({
      reason: 'session_quarantined',
    });
    expect(activeEpochListeners.size).toBe(0);
  });

  it('errors a partially consumed pipeThrough reader when authority is lost', async () => {
    const coordinator = await createCoordinator();
    const activeEpochListeners = new Set<() => void>();
    let epochCurrent = true;
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      captureRequestAuthority: () => ({
        isCurrent: () => epochCurrent,
        runBeforeDispatch: operation => operation(),
        subscribeCancellation(listener) {
          activeEpochListeners.add(listener);
          return () => activeEpochListeners.delete(listener);
        },
      }),
      fetchImpl: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(Uint8Array.of(7));
            },
          }),
        ),
      timeoutMs: 1_000,
    });
    const response = await authenticatedFetch(
      'https://runtime.example.cn/v2/bootstrap',
    );
    const reader = response.body!
      .pipeThrough(new TransformStream<Uint8Array, Uint8Array>())
      .getReader();

    await expect(reader.read()).resolves.toEqual({
      done: false,
      value: Uint8Array.of(7),
    });
    epochCurrent = false;
    for (const listener of activeEpochListeners) listener();

    await expect(reader.read()).rejects.toMatchObject({
      reason: 'session_quarantined',
    });
    expect(activeEpochListeners.size).toBe(0);
  });

  it.each(['done', 'cancel', 'error', 'deadline', 'null_body'] as const)(
    'releases post-header authority listeners on body %s terminal state',
    async terminalState => {
      if (terminalState === 'deadline') {
        vi.useFakeTimers();
      }
      try {
        const coordinator = await createCoordinator();
        const activeEpochListeners = new Set<() => void>();
        let requestSignal: AbortSignal | undefined;
        const authenticatedFetch = createAuthenticatedFetch({
          authSessionCoordinator: coordinator,
          captureRequestAuthority: () => ({
            isCurrent: () => true,
            runBeforeDispatch: operation => operation(),
            subscribeCancellation(listener) {
              activeEpochListeners.add(listener);
              return () => activeEpochListeners.delete(listener);
            },
          }),
          fetchImpl: async (_input, init) => {
            requestSignal = init?.signal ?? undefined;
            if (terminalState === 'null_body') {
              return new Response(null, {status: 204});
            }
            return new Response(
              new ReadableStream<Uint8Array>({
                pull(controller) {
                  if (terminalState === 'error') {
                    controller.error(new Error('injected body failure'));
                  } else if (terminalState === 'done') {
                    controller.close();
                  }
                },
              }),
            );
          },
          timeoutMs: 25,
        });

        const response = await authenticatedFetch(
          'https://runtime.example.cn/v2/bootstrap',
        );
        if (terminalState === 'cancel') {
          await response.body?.cancel();
        } else if (terminalState === 'done') {
          await expect(response.body!.getReader().read()).resolves.toEqual({
            done: true,
            value: undefined,
          });
        } else if (terminalState === 'error') {
          await expect(response.body!.getReader().read()).rejects.toThrow(
            'injected body failure',
          );
        } else if (terminalState === 'deadline') {
          expect(activeEpochListeners.size).toBe(1);
          await vi.advanceTimersByTimeAsync(26);
          expect(requestSignal?.aborted).toBe(true);
        }

        expect(activeEpochListeners.size).toBe(0);
      } finally {
        if (terminalState === 'deadline') {
          vi.useRealTimers();
        }
      }
    },
  );

  it('releases authority before waiting on a source cancel that never settles', async () => {
    const coordinator = await createCoordinator();
    const activeEpochListeners = new Set<() => void>();
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      captureRequestAuthority: () => ({
        isCurrent: () => true,
        runBeforeDispatch: operation => operation(),
        subscribeCancellation(listener) {
          activeEpochListeners.add(listener);
          return () => activeEpochListeners.delete(listener);
        },
      }),
      fetchImpl: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            cancel: () => new Promise<void>(() => undefined),
          }),
        ),
    });

    const response = await authenticatedFetch(
      'https://runtime.example.cn/v2/bootstrap',
    );
    void response.body!.cancel();
    await Promise.resolve();

    expect(activeEpochListeners.size).toBe(0);
  });

  it('cancels an unread body when its originating session changed', async () => {
    const coordinator = await createCoordinator();
    let requestSignal: AbortSignal | undefined;
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      fetchImpl: async (_input, init) => {
        requestSignal = init?.signal ?? undefined;
        return new Response(
          new ReadableStream<Uint8Array>({
            start() {
              // A stale response must not keep consuming bytes.
            },
          }),
          {headers: {'content-type': 'application/json'}, status: 200},
        );
      },
      timeoutMs: 1_000,
    });

    const response = await authenticatedFetch(
      'https://runtime.example.cn/v2/bootstrap',
    );
    await coordinator.invalidate();

    await expect(response.json()).rejects.toMatchObject({
      reason: 'session_superseded',
    });
    expect(requestSignal?.aborted).toBe(true);
  });

  it('does not start transport after cancellation while token refresh is pending', async () => {
    let markRefreshStarted: (() => void) | undefined;
    let resolveRefresh:
      | ((session: Awaited<ReturnType<AuthRepository['refreshSession']>>) => void)
      | undefined;
    const refreshStarted = new Promise<void>(resolve => {
      markRefreshStarted = resolve;
    });
    const refreshResult = new Promise<
      Awaited<ReturnType<AuthRepository['refreshSession']>>
    >(resolve => {
      resolveRefresh = resolve;
    });
    const authRepository: AuthRepository = {
      logout: async () => undefined,
      refreshSession: async () => {
        markRefreshStarted?.();
        return refreshResult;
      },
      requestSmsCode: async phoneNumber => ({
        challengeId: 'challenge-web-cancel-refresh',
        expiresAt: '2026-08-29T12:05:00.000Z',
        mode: 'remote',
        phoneNumber,
        retryAfterSeconds: 0,
      }),
      verifySmsCode: async () => {
        throw new Error('not used');
      },
    };
    const coordinator = createAuthSessionCoordinator({
      authRepository,
      authSessionStore: createMemoryOnlyAuthSessionStore(),
      now: () => new Date('2026-08-29T12:00:00.000Z'),
    });
    await coordinator.establish({
      accessToken: 'expiring-access',
      accessTokenExpiresAt: '2026-08-29T12:00:30.000Z',
      mode: 'remote',
      phoneNumber: '13800138000',
      refreshExpiresAt: '2026-09-29T12:00:00.000Z',
      refreshToken: 'refresh-before-cancel',
      sessionId: 'session-web-cancel-refresh',
      tokenType: 'Bearer',
    });
    const fetchImpl = vi.fn<typeof fetch>();
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      fetchImpl,
      timeoutMs: 1_000,
    });
    const caller = new AbortController();

    const request = authenticatedFetch('https://runtime.example.cn/v2/bootstrap', {
      signal: caller.signal,
    });
    await refreshStarted;
    caller.abort();
    await expect(request).rejects.toMatchObject({reason: 'caller_cancelled'});

    resolveRefresh?.({
      accessToken: 'refreshed-after-cancel',
      accessTokenExpiresAt: '2026-08-29T13:00:00.000Z',
      mode: 'remote',
      phoneNumber: '13800138000',
      refreshExpiresAt: '2026-09-29T12:00:00.000Z',
      refreshToken: 'rotated-after-cancel',
      sessionId: 'session-web-cancel-refresh',
      tokenType: 'Bearer',
    });
    await refreshResult;
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not wait for a discarded 401 body cancellation before retrying', async () => {
    const coordinator = await createCoordinator();
    const cancelFirstBody = vi.fn(
      () => new Promise<void>(() => undefined),
    );
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream<Uint8Array>({
            cancel: cancelFirstBody,
            start() {
              // The rejected response body never produces bytes.
            },
          }),
          {status: 401},
        ),
      )
      .mockResolvedValueOnce(new Response(null, {status: 204}));
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      fetchImpl,
      timeoutMs: 1_000,
    });

    await expect(
      authenticatedFetch('https://runtime.example.cn/v2/bootstrap'),
    ).resolves.toMatchObject({status: 204});

    expect(cancelFirstBody).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('cancels a normal discarded 401 body without disturbing the retry body', async () => {
    const coordinator = await createCoordinator();
    const cancelFirstBody = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream<Uint8Array>({
            cancel: cancelFirstBody,
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode('discarded-authorization-body'),
              );
            },
          }),
          {status: 401},
        ),
      )
      .mockResolvedValueOnce(new Response('current-response-body'));
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      fetchImpl,
      timeoutMs: 1_000,
    });

    const response = await authenticatedFetch(
      'https://runtime.example.cn/v2/bootstrap',
    );

    await expect(response.text()).resolves.toBe('current-response-body');
    expect(cancelFirstBody).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('preserves the Web session when a 403 cleanup marker cannot be written', async () => {
    localStorage.clear();
    const stateStore = createWebAccountDeletionStateStore(localStorage);
    const coordinator = await createCoordinator(async () => {
      throw new Error('injected marker failure');
    });
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      fetchImpl: vi.fn(async () => new Response(null, {status: 403})),
    });

    await expect(
      authenticatedFetch('https://runtime.example.cn/v2/bootstrap'),
    ).rejects.toThrow('injected marker failure');

    expect(coordinator.getCurrentSession()).not.toBeNull();
    await expect(stateStore.load()).resolves.toBeNull();
  });

  it('persists local cleanup before a terminal 401 clears the Web session', async () => {
    localStorage.clear();
    const stateStore = createWebAccountDeletionStateStore(localStorage);
    let expectedRevision = 0;
    const coordinator = await createCoordinator(async ({session}) => {
      expectedRevision =
        (
          await stateStore.ensureCleanupAuthority?.(
            session.phoneNumber,
            expectedRevision,
          )
        )?.revision ?? expectedRevision;
    });
    const invalidationReasons: string[] = [];
    coordinator.subscribeSessionScope((_sessionScopeKey, reason) => {
      invalidationReasons.push(reason);
    });
    const authenticatedFetch = createAuthenticatedFetch({
      authSessionCoordinator: coordinator,
      fetchImpl: vi.fn(async () => new Response(null, {status: 401})),
    });

    await expect(
      authenticatedFetch('https://runtime.example.cn/v2/bootstrap'),
    ).resolves.toMatchObject({status: 401});

    expect(coordinator.getCurrentSession()).toBeNull();
    expect(invalidationReasons).toEqual(['authorization_invalidated']);
    await expect(stateStore.load()).resolves.toEqual({
      phase: 'local_cleanup',
      phoneNumber: '13800138000',
    });
    await expect(stateStore.getRevision()).resolves.toBe(1);
  });

  it.each(['requesting', 'accepted', 'registration_ready'] as const)(
    'terminal invalidation observes %s deletion authority without clearing it',
    async phase => {
      localStorage.clear();
      const stateStore = createWebAccountDeletionStateStore(localStorage);
      const coordinator = await createCoordinator(async ({session}) => {
        await stateStore.ensureCleanupAuthority?.(session.phoneNumber, 0);
      });
      const requestingAuthority = await stateStore.beginRequesting?.(
        '13800138000',
        0,
      );
      if (phase !== 'requesting') {
        await stateStore.resolveRequesting?.(requestingAuthority!, phase);
      }
      const authenticatedFetch = createAuthenticatedFetch({
        authSessionCoordinator: coordinator,
        fetchImpl: vi.fn(async () => new Response(null, {status: 403})),
      });

      await expect(
        authenticatedFetch('https://runtime.example.cn/v2/bootstrap'),
      ).resolves.toMatchObject({status: 403});

      expect(coordinator.getCurrentSession()).toBeNull();
      await expect(stateStore.load()).resolves.toEqual({
        phase,
        phoneNumber: '13800138000',
      });
    },
  );
});

async function createCoordinator(
  beforeSessionInvalidation?: Parameters<
    typeof createAuthSessionCoordinator
  >[0]['beforeSessionInvalidation'],
) {
  const authRepository: AuthRepository = {
    logout: async () => undefined,
    refreshSession: async session => session,
    requestSmsCode: async phoneNumber => ({
      challengeId: 'challenge-web-deadline',
      expiresAt: '2099-08-29T12:05:00.000Z',
      mode: 'remote',
      phoneNumber,
      retryAfterSeconds: 0,
    }),
    verifySmsCode: async () => {
      throw new Error('not used');
    },
  };
  const coordinator = createAuthSessionCoordinator({
    authRepository,
    authSessionStore: createMemoryOnlyAuthSessionStore(),
    beforeSessionInvalidation,
  });
  await coordinator.establish({
    accessToken: 'memory-access',
    accessTokenExpiresAt: '2099-08-29T13:00:00.000Z',
    mode: 'remote',
    phoneNumber: '13800138000',
    refreshExpiresAt: '2099-09-29T12:00:00.000Z',
    refreshToken: 'memory-refresh',
    sessionId: 'session-web-deadline',
    tokenType: 'Bearer',
  });
  return coordinator;
}
