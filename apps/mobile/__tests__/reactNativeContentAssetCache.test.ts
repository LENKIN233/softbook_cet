const DIGEST = 'c'.repeat(64);

jest.mock('react-native-blob-util', () => {
  const cancel = jest.fn();
  const fetch = jest.fn(() => {
    const task = Promise.resolve({
      info: () => ({headers: {}, redirects: [], status: 200}),
    }) as Promise<unknown> & {cancel: typeof cancel};
    task.cancel = cancel;
    return task;
  });
  const fs = {
    dirs: {CacheDir: '/native-cache'},
    exists: jest.fn().mockResolvedValue(false),
    hash: jest.fn().mockResolvedValue('c'.repeat(64)),
    mkdir: jest.fn().mockResolvedValue(undefined),
    mv: jest.fn().mockResolvedValue(true),
    stat: jest.fn().mockResolvedValue({
      filename: `${'c'.repeat(64)}.mp3`,
      lastModified: 0,
      path: `/native-cache/${'c'.repeat(64)}.mp3`,
      size: 512,
      type: 'file',
    }),
    unlink: jest.fn().mockResolvedValue(undefined),
  };

  return {
    __esModule: true,
    default: {__cancel: cancel, config: jest.fn(() => ({fetch})), fs},
  };
});

import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  createReactNativeContentAssetCache,
  reactNativeContentAssetCache,
} from '../src/audio/reactNativeContentAssetCache';

const mockConfig = jest.mocked(ReactNativeBlobUtil.config);
const mockFs = jest.mocked(ReactNativeBlobUtil.fs);
const mockFetch = jest.mocked(mockConfig({}).fetch);
const mockCancel = (
  ReactNativeBlobUtil as typeof ReactNativeBlobUtil & {__cancel: jest.Mock}
).__cancel;

function mockNativeResponseOnce(response: unknown) {
  mockFetch.mockImplementationOnce(() => {
    const task = Promise.resolve(response) as Promise<unknown> & {
      cancel: typeof mockCancel;
    };
    task.cancel = mockCancel;
    return task as never;
  });
}

function createDeferredNativeTask() {
  let resolveTask!: (response: unknown) => void;
  let rejectTask!: (error: unknown) => void;
  let cancelCallback: (() => void) | undefined;
  const task = new Promise((resolve, reject) => {
    resolveTask = resolve;
    rejectTask = reject;
  }) as Promise<unknown> & {cancel: jest.Mock};
  task.cancel = jest.fn((callback?: () => void) => {
    cancelCallback = callback;
  });

  return {
    cancel: task.cancel,
    fireCancelCallback: () => cancelCallback?.(),
    reject: rejectTask,
    resolve: resolveTask,
    task,
  };
}

async function flushNativeDownloadStart(expectedFetchCount = 1) {
  for (
    let attempt = 0;
    attempt < 30 && mockFetch.mock.calls.length < expectedFetchCount;
    attempt += 1
  ) {
    await jest.advanceTimersByTimeAsync(0);
    await Promise.resolve();
  }
  expect(mockFetch).toHaveBeenCalledTimes(expectedFetchCount);
}

function observeFailure<T>(promise: Promise<T>) {
  return promise.then(
    () => null,
    error => error as Error,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFs.exists.mockResolvedValue(false);
  mockFs.hash.mockResolvedValue(DIGEST);
});

test('uses native direct-to-file download, stat, and SHA-256 APIs', async () => {
  const result = await reactNativeContentAssetCache.resolve({
    asset: {
      asset_id: 'cet6.152101.prompt',
      duration_ms: 1800,
      media_type: 'audio/mpeg',
      sha256: `sha256:${DIGEST}`,
      size_bytes: 512,
    },
    download: {
      asset_id: 'cet6.152101.prompt',
      expires_at: '2099-01-01T00:00:00.000Z',
      url: 'https://private-content.example/cet6.mp3?token=opaque',
    },
  });

  const targetPath =
    `/native-cache/softbook-content-v1/sha256/cc/${DIGEST}.mp3`;
  expect(result).toEqual({path: targetPath, uri: `file://${targetPath}`});
  expect(mockConfig).toHaveBeenCalledWith({
    followRedirect: false,
    overwrite: false,
    path: expect.stringMatching(/\.partial$/),
    timeout: expect.any(Number),
  });
  expect(mockFetch).toHaveBeenCalledWith(
    'GET',
    expect.stringContaining('https://'),
    {Accept: 'audio/mpeg'},
  );
  expect(mockFs.hash).toHaveBeenCalledWith(expect.any(String), 'sha256');
  expect(mockFs.mv).toHaveBeenCalledWith(
    expect.stringMatching(/\.partial$/),
    targetPath,
  );
});

test('rejects an insecure redirect before requesting or downloading its target', async () => {
  mockNativeResponseOnce({
    info: () => ({
      headers: {Location: 'http://private-content.example/insecure.mp3'},
      redirects: [],
      status: 302,
    }),
  });

  await expect(
    reactNativeContentAssetCache.resolve({
      asset: {
        asset_id: 'cet6.152103.prompt',
        duration_ms: 1800,
        media_type: 'audio/mpeg',
        sha256: `sha256:${DIGEST}`,
        size_bytes: 512,
      },
      download: {
        asset_id: 'cet6.152103.prompt',
        expires_at: '2099-01-01T00:00:00.000Z',
        url: 'https://private-content.example/start.mp3?token=opaque',
      },
    }),
  ).rejects.toThrow('download redirect requires credential-free HTTPS');
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('validates each secure redirect before following it without native auto-follow', async () => {
  mockNativeResponseOnce({
      info: () => ({
        headers: {location: '/final.mp3?token=opaque'},
        redirects: [],
        status: 307,
      }),
    });
  mockNativeResponseOnce({
    info: () => ({headers: {}, redirects: [], status: 200}),
  });

  await expect(
    reactNativeContentAssetCache.resolve({
      asset: {
        asset_id: 'cet6.152104.prompt',
        duration_ms: 1800,
        media_type: 'audio/mpeg',
        sha256: `sha256:${DIGEST}`,
        size_bytes: 512,
      },
      download: {
        asset_id: 'cet6.152104.prompt',
        expires_at: '2099-01-01T00:00:00.000Z',
        url: 'https://private-content.example/start.mp3?token=opaque',
      },
    }),
  ).resolves.toMatchObject({
    path: expect.stringContaining(DIGEST),
  });
  expect(mockFetch).toHaveBeenNthCalledWith(
    2,
    'GET',
    'https://private-content.example/final.mp3?token=opaque',
    {Accept: 'audio/mpeg'},
  );
  expect(mockConfig).toHaveBeenCalledWith(
    expect.objectContaining({followRedirect: false}),
  );
});

test('tolerates a cache directory created by a concurrent request', async () => {
  mockFs.exists
    .mockResolvedValue(false)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  mockFs.mkdir.mockRejectedValueOnce(new Error('already exists'));

  await expect(
    reactNativeContentAssetCache.resolve({
      asset: {
        asset_id: 'cet6.152102.prompt',
        duration_ms: 1800,
        media_type: 'audio/mpeg',
        sha256: `sha256:${DIGEST}`,
        size_bytes: 512,
      },
      download: {
        asset_id: 'cet6.152102.prompt',
        expires_at: '2099-01-01T00:00:00.000Z',
        url: 'https://private-content.example/cet6.mp3?token=opaque',
      },
    }),
  ).resolves.toEqual({
    path: `/native-cache/softbook-content-v1/sha256/cc/${DIGEST}.mp3`,
    uri: `file:///native-cache/softbook-content-v1/sha256/cc/${DIGEST}.mp3`,
  });
  expect(mockFs.mkdir).toHaveBeenCalledTimes(1);
});

test('removes a partial file written by a native task that resolves after timeout', async () => {
  jest.useFakeTimers();
  let monotonicMs = 0;
  let partialExists = false;
  const deferred = createDeferredNativeTask();
  mockFetch.mockImplementationOnce(() => {
    partialExists = true;
    return deferred.task as never;
  });
  mockFs.exists.mockImplementation(async path =>
    path.endsWith('.partial') ? partialExists : false,
  );
  mockFs.unlink.mockImplementation(async path => {
    if (path.endsWith('.partial')) partialExists = false;
  });
  const cache = createReactNativeContentAssetCache({
    monotonicNow: () => monotonicMs,
  });

  try {
    const pending = cache.resolve(createAssetInput('late-resolve', 'd'));
    const failure = observeFailure(pending);
    await flushNativeDownloadStart();
    monotonicMs = 15_000;
    await jest.advanceTimersByTimeAsync(15_000);
    await expect(failure).resolves.toMatchObject({
      message: 'Native content asset download timed out.',
    });
    expect(partialExists).toBe(false);

    partialExists = true;
    deferred.resolve({
      info: () => ({headers: {}, redirects: [], status: 200}),
    });
    await jest.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    expect(partialExists).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

test('removes a partial file left by a native task that rejects after timeout', async () => {
  jest.useFakeTimers();
  let monotonicMs = 0;
  let partialExists = false;
  const deferred = createDeferredNativeTask();
  mockFetch.mockImplementationOnce(() => deferred.task as never);
  mockFs.exists.mockImplementation(async path =>
    path.endsWith('.partial') ? partialExists : false,
  );
  mockFs.unlink.mockImplementation(async path => {
    if (path.endsWith('.partial')) partialExists = false;
  });
  const cache = createReactNativeContentAssetCache({
    monotonicNow: () => monotonicMs,
  });

  try {
    const pending = cache.resolve(createAssetInput('late-reject', 'e'));
    const failure = observeFailure(pending);
    await flushNativeDownloadStart();
    monotonicMs = 15_000;
    await jest.advanceTimersByTimeAsync(15_000);
    await expect(failure).resolves.toMatchObject({
      message: 'Native content asset download timed out.',
    });

    partialExists = true;
    deferred.reject(new Error('late native failure'));
    await jest.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    expect(partialExists).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

test('coalesces timeout cleanup ownership and ignores missing-file races without masking timeout', async () => {
  jest.useFakeTimers();
  let monotonicMs = 0;
  const deferred = createDeferredNativeTask();
  mockFetch.mockImplementationOnce(() => deferred.task as never);
  mockFs.exists.mockResolvedValue(true);
  mockFs.unlink
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(Object.assign(new Error('missing'), {code: 'ENOENT'}));
  const cache = createReactNativeContentAssetCache({
    monotonicNow: () => monotonicMs,
  });

  try {
    const pending = cache.resolve(createAssetInput('double-cleanup', 'f'));
    const failure = observeFailure(pending);
    await flushNativeDownloadStart();
    monotonicMs = 15_000;
    await jest.advanceTimersByTimeAsync(15_000);
    deferred.fireCancelCallback();
    await jest.advanceTimersByTimeAsync(0);

    await expect(failure).resolves.toMatchObject({
      message: 'Native content asset download timed out.',
    });
    expect(deferred.cancel).toHaveBeenCalledTimes(1);
    expect(mockFs.unlink.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

test('outer deadline rejects while redirect-boundary filesystem cleanup is hung', async () => {
  jest.useFakeTimers();
  let monotonicMs = 0;
  let partialProbeCount = 0;
  mockNativeResponseOnce({
    info: () => ({
      headers: {location: '/next.mp3?token=opaque'},
      redirects: [],
      status: 302,
    }),
  });
  mockFs.exists.mockImplementation(async path => {
    if (!path.endsWith('.partial')) return false;
    partialProbeCount += 1;
    if (partialProbeCount === 1) return false;
    return new Promise<boolean>(() => undefined);
  });
  const cache = createReactNativeContentAssetCache({
    monotonicNow: () => monotonicMs,
  });

  try {
    const pending = cache.resolve(createAssetInput('redirect-fs-hang', 'a'));
    const failure = observeFailure(pending);
    await flushNativeDownloadStart();
    await jest.advanceTimersByTimeAsync(0);
    monotonicMs = 15_000;
    await jest.advanceTimersByTimeAsync(15_000);

    await expect(failure).resolves.toMatchObject({
      message: 'Native content asset download timed out.',
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

test('two redirect hops share one monotonic fifteen-second deadline', async () => {
  jest.useFakeTimers();
  let monotonicMs = 0;
  const first = createDeferredNativeTask();
  const second = createDeferredNativeTask();
  mockFetch
    .mockImplementationOnce(() => first.task as never)
    .mockImplementationOnce(() => second.task as never);
  const cache = createReactNativeContentAssetCache({
    monotonicNow: () => monotonicMs,
  });

  try {
    const pending = cache.resolve(createAssetInput('shared-deadline', 'b'));
    const failure = observeFailure(pending);
    await flushNativeDownloadStart();
    monotonicMs = 9_000;
    await jest.advanceTimersByTimeAsync(9_000);
    first.resolve({
      info: () => ({
        headers: {location: '/second.mp3?token=opaque'},
        redirects: [],
        status: 302,
      }),
    });
    await flushNativeDownloadStart(2);

    expect(mockConfig).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({timeout: 15_000}),
    );
    expect(mockConfig).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({timeout: 6_000}),
    );
    monotonicMs = 15_000;
    await jest.advanceTimersByTimeAsync(6_000);
    await expect(failure).resolves.toMatchObject({
      message: 'Native content asset download timed out.',
    });
    expect(second.cancel).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

test('successful and failed native downloads leave no deadline timers', async () => {
  jest.useFakeTimers();
  const successCache = createReactNativeContentAssetCache({
    monotonicNow: () => 0,
  });

  try {
    await expect(
      successCache.resolve(createAssetInput('timer-success', 'c')),
    ).resolves.toMatchObject({path: expect.stringContaining(DIGEST)});
    expect(jest.getTimerCount()).toBe(0);

    const failedTask = Promise.reject(new Error('native failed')) as Promise<
      unknown
    > & {cancel: jest.Mock};
    failedTask.cancel = jest.fn();
    mockFetch.mockImplementationOnce(() => failedTask as never);
    const failedCache = createReactNativeContentAssetCache({
      monotonicNow: () => 0,
    });
    await expect(
      failedCache.resolve(createAssetInput('timer-failure', '9')),
    ).rejects.toThrow('native failed');
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

function createAssetInput(assetSuffix: string, digestCharacter: string) {
  const digest = digestCharacter.repeat(64);
  return {
    asset: {
      asset_id: `cet6.${assetSuffix}.prompt`,
      duration_ms: 1800,
      media_type: 'audio/mpeg' as const,
      sha256: `sha256:${digest}`,
      size_bytes: 512,
    },
    download: {
      asset_id: `cet6.${assetSuffix}.prompt`,
      expires_at: '2099-01-01T00:00:00.000Z',
      url: `https://private-content.example/${assetSuffix}.mp3?token=opaque`,
    },
  };
}
