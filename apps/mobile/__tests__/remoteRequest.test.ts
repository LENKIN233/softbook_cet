import {
  RemoteRequestLifecycleError,
  runBoundedRemoteRequest,
} from '../src/runtime/remoteRequest';

afterEach(() => {
  jest.useRealTimers();
});

test('times out and aborts an operation that never settles', async () => {
  jest.useFakeTimers();
  let operationSignal: AbortSignal | undefined;
  const request = runBoundedRemoteRequest({
    operation: signal =>
      new Promise<string>(() => {
        operationSignal = signal;
      }),
    timeoutMs: 20,
  });
  const outcome = request.catch(error => error);

  jest.advanceTimersByTime(20);

  await expect(outcome).resolves.toEqual(
    expect.objectContaining<Partial<RemoteRequestLifecycleError>>({
      reason: 'timeout',
      retryable: true,
    }),
  );
  expect(operationSignal?.aborted).toBe(true);
});

test('does not start an operation when its caller signal is already aborted', async () => {
  const caller = new AbortController();
  caller.abort();
  const operation = jest.fn(async () => 'unexpected');

  await expect(
    runBoundedRemoteRequest({
      cancellationSources: [
        {reason: 'caller_cancelled', signal: caller.signal},
      ],
      operation,
    }),
  ).rejects.toMatchObject({reason: 'caller_cancelled', retryable: false});
  expect(operation).not.toHaveBeenCalled();
});

test('subscription cancellation settles even when the operation ignores abort', async () => {
  let cancelSession: (() => void) | undefined;
  const unsubscribe = jest.fn();
  const request = runBoundedRemoteRequest({
    operation: () => new Promise(() => undefined),
    subscribeCancellation: cancel => {
      cancelSession = () => cancel('session_superseded');
      return unsubscribe;
    },
  });

  cancelSession?.();

  await expect(request).rejects.toMatchObject({
    reason: 'session_superseded',
    retryable: false,
  });
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test('rejects invalid timeout configuration before starting the operation', () => {
  const operation = jest.fn(async () => 'unexpected');

  expect(() =>
    runBoundedRemoteRequest({operation, timeoutMs: 0}),
  ).toThrow('positive number');
  expect(operation).not.toHaveBeenCalled();
});

test('cleanup failure cannot replace a successful request outcome', async () => {
  await expect(
    runBoundedRemoteRequest({
      operation: async () => 'completed',
      subscribeCancellation: () => () => {
        throw new Error('cleanup failed');
      },
    }),
  ).resolves.toBe('completed');
});
