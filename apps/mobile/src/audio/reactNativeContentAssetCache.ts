import ReactNativeBlobUtil, {
  type FetchBlobResponse,
  type StatefulPromise,
} from 'react-native-blob-util';

import {
  assertContentAssetCredentialFreeHttps,
  createContentAssetCache,
  type ContentAssetCacheFileSystem,
} from './contentAssetCache';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

type NativeAssetRuntime = {
  blobUtil: typeof ReactNativeBlobUtil;
  clearDeadline: (timer: ReturnType<typeof setTimeout>) => void;
  monotonicNow: () => number;
  scheduleDeadline: (
    callback: () => void,
    timeoutMs: number,
  ) => ReturnType<typeof setTimeout>;
};

type PartialCleanupOwner = {
  cleanup: () => Promise<void>;
  didTimeOut: () => boolean;
  markTimedOut: () => void;
};

export function createReactNativeContentAssetCache(
  overrides: Partial<NativeAssetRuntime> = {},
) {
  const runtime: NativeAssetRuntime = {
    blobUtil: overrides.blobUtil ?? ReactNativeBlobUtil,
    clearDeadline: overrides.clearDeadline ?? clearTimeout,
    monotonicNow:
      overrides.monotonicNow ?? (() => globalThis.performance.now()),
    scheduleDeadline: overrides.scheduleDeadline ?? setTimeout,
  };
  const cleanupOwners = new Map<string, PartialCleanupOwner>();
  const fileSystem: ContentAssetCacheFileSystem = {
    cacheDirectory: runtime.blobUtil.fs.dirs.CacheDir,
    createDirectory: async path => {
      if (!(await runtime.blobUtil.fs.exists(path))) {
        try {
          await runtime.blobUtil.fs.mkdir(path);
        } catch (error) {
          if (!(await runtime.blobUtil.fs.exists(path))) {
            throw error;
          }
        }
      }
    },
    download: input =>
      downloadNativeAssetWithDeadline(input, runtime, cleanupOwners),
    exists: path =>
      cleanupOwners.get(path)?.didTimeOut()
        ? Promise.resolve(true)
        : runtime.blobUtil.fs.exists(path),
    hashSha256: path => runtime.blobUtil.fs.hash(path, 'sha256'),
    move: async (sourcePath, destinationPath) => {
      await runtime.blobUtil.fs.mv(sourcePath, destinationPath);
    },
    remove: async path => {
      const owner = cleanupOwners.get(path);
      if (!owner) {
        await removeNativePathIfPresent(runtime.blobUtil, path);
        return;
      }

      if (cleanupOwners.get(path) === owner) {
        cleanupOwners.delete(path);
      }
      if (owner.didTimeOut()) {
        owner.cleanup().catch(() => undefined);
        return;
      }
      await owner.cleanup();
    },
    stat: async path => {
      const stat = await runtime.blobUtil.fs.stat(path);
      const sizeBytes = Number(stat.size);

      if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
        throw new Error('Native content asset stat returned an invalid size.');
      }

      return {sizeBytes, type: stat.type};
    },
  };

  return createContentAssetCache({fileSystem});
}

export const reactNativeContentAssetCache =
  createReactNativeContentAssetCache();

async function downloadNativeAssetWithDeadline(
  {
    destinationPath,
    timeoutMs,
    url,
  }: {destinationPath: string; timeoutMs: number; url: string},
  runtime: NativeAssetRuntime,
  cleanupOwners: Map<string, PartialCleanupOwner>,
) {
  const timeoutError = new Error('Native content asset download timed out.');
  const deadline = runtime.monotonicNow() + timeoutMs;
  const owner = createPartialCleanupOwner(runtime.blobUtil, destinationPath);
  cleanupOwners.set(destinationPath, owner);
  let currentTask: StatefulPromise<FetchBlobResponse> | null = null;
  let timedOut = false;

  const expire = () => {
    if (timedOut) {
      return;
    }
    timedOut = true;
    owner.markTimedOut();
    const taskAtDeadline = currentTask;
    if (taskAtDeadline) {
      try {
        taskAtDeadline.cancel(() => {
          owner.cleanup().catch(() => undefined);
        });
      } catch {
        // The deadline rejection remains authoritative.
      }
    }
    owner.cleanup().catch(() => undefined);
  };

  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  const deadlinePromise = new Promise<never>((_resolve, reject) => {
    const remaining = Math.max(0, deadline - runtime.monotonicNow());
    deadlineTimer = runtime.scheduleDeadline(() => {
      expire();
      reject(timeoutError);
    }, remaining);
  });

  const redirectLoop = (async () => {
    const redirects: string[] = [];
    let requestUrl = url;

    for (let redirectCount = 0; ; redirectCount += 1) {
      const remainingTimeoutMs = Math.ceil(
        deadline - runtime.monotonicNow(),
      );
      if (remainingTimeoutMs <= 0 || timedOut) {
        expire();
        throw timeoutError;
      }

      const task = runtime.blobUtil.config({
        followRedirect: false,
        overwrite: false,
        path: destinationPath,
        timeout: remainingTimeoutMs,
      }).fetch('GET', requestUrl, {Accept: 'audio/mpeg'});
      currentTask = task;
      let response: FetchBlobResponse;
      try {
        response = await task;
      } finally {
        if (currentTask === task) {
          currentTask = null;
        }
      }

      if (timedOut) {
        owner.cleanup().catch(() => undefined);
        throw timeoutError;
      }
      const info = response.info();
      if (!REDIRECT_STATUSES.has(info.status)) {
        return {redirects, status: info.status};
      }
      if (redirectCount >= MAX_REDIRECTS) {
        throw new Error('Native content asset download has too many redirects.');
      }

      const location = readRedirectLocation(info.headers);
      const redirectUrl = resolveRedirectUrl(location, requestUrl);
      assertContentAssetCredentialFreeHttps(
        redirectUrl,
        'download redirect',
      );
      redirects.push(redirectUrl);
      await owner.cleanup();
      if (timedOut || runtime.monotonicNow() >= deadline) {
        expire();
        throw timeoutError;
      }
      requestUrl = redirectUrl;
    }
  })().then(
    result => {
      if (timedOut) {
        owner.cleanup().catch(() => undefined);
        throw timeoutError;
      }
      return result;
    },
    error => {
      if (timedOut) {
        owner.cleanup().catch(() => undefined);
        throw timeoutError;
      }
      throw error;
    },
  );

  try {
    const result = await Promise.race([redirectLoop, deadlinePromise]);
    if (cleanupOwners.get(destinationPath) === owner) {
      cleanupOwners.delete(destinationPath);
    }
    return result;
  } catch (error) {
    throw timedOut ? timeoutError : error;
  } finally {
    if (deadlineTimer !== null) {
      runtime.clearDeadline(deadlineTimer);
    }
  }
}

function createPartialCleanupOwner(
  blobUtil: typeof ReactNativeBlobUtil,
  path: string,
): PartialCleanupOwner {
  let timedOut = false;
  let tail = Promise.resolve();

  return {
    cleanup: () => {
      const cleanup = tail.then(() => removeNativePathIfPresent(blobUtil, path));
      tail = cleanup.catch(() => undefined);
      return cleanup.catch(error => {
        if (timedOut || isMissingNativePathError(error)) {
          return;
        }
        throw error;
      });
    },
    didTimeOut: () => timedOut,
    markTimedOut: () => {
      timedOut = true;
    },
  };
}

async function removeNativePathIfPresent(
  blobUtil: typeof ReactNativeBlobUtil,
  path: string,
) {
  try {
    if (await blobUtil.fs.exists(path)) {
      await blobUtil.fs.unlink(path);
    }
  } catch (error) {
    if (!isMissingNativePathError(error)) {
      throw error;
    }
  }
}

function isMissingNativePathError(error: unknown) {
  return (
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT') ||
    (error instanceof Error && /(?:ENOENT|no such file)/i.test(error.message))
  );
}

function readRedirectLocation(headers: unknown) {
  if (typeof headers !== 'object' || headers === null || Array.isArray(headers)) {
    throw new Error('Native content asset redirect requires a Location header.');
  }

  const entry = Object.entries(headers).find(
    ([name]) => name.toLowerCase() === 'location',
  );

  if (!entry || typeof entry[1] !== 'string' || entry[1].length === 0) {
    throw new Error('Native content asset redirect requires a Location header.');
  }

  return entry[1];
}

function resolveRedirectUrl(location: string, requestUrl: string) {
  try {
    return new URL(location, requestUrl).toString();
  } catch {
    throw new Error('Native content asset redirect Location is invalid.');
  }
}
