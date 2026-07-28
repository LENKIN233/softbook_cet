import type {
  ContentAssetDownload,
  ContentManifestAsset,
} from './contentManifestRepository';

const DEFAULT_DOWNLOAD_TIMEOUT_MS = 15_000;
const CACHE_SCHEMA_DIRECTORY = 'softbook-content-v1';

export type ContentAssetCacheFile = {
  path: string;
  uri: string;
};

export type ContentAssetFileStat = {
  sizeBytes: number;
  type: 'directory' | 'file';
};

export type ContentAssetDownloadResult = {
  redirects?: readonly string[];
  status: number;
};

export type ContentAssetCacheFileSystem = {
  cacheDirectory: string;
  createDirectory: (path: string) => Promise<void>;
  download: (input: {
    destinationPath: string;
    timeoutMs: number;
    url: string;
  }) => Promise<ContentAssetDownloadResult>;
  exists: (path: string) => Promise<boolean>;
  hashSha256: (path: string) => Promise<string>;
  move: (sourcePath: string, destinationPath: string) => Promise<void>;
  remove: (path: string) => Promise<void>;
  stat: (path: string) => Promise<ContentAssetFileStat>;
};

export type ContentAssetCache = {
  resolve: (input: {
    asset: ContentManifestAsset;
    download: ContentAssetDownload;
  }) => Promise<ContentAssetCacheFile>;
};

export function createContentAssetCache(options: {
  fileSystem: ContentAssetCacheFileSystem;
  now?: () => Date;
  randomId?: () => string;
  timeoutMs?: number;
}): ContentAssetCache {
  const timeoutMs = options.timeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;
  const now = options.now ?? (() => new Date());
  const randomId = options.randomId ?? createRandomId;
  const inFlight = new Map<
    string,
    {promise: Promise<ContentAssetCacheFile>; sizeBytes: number}
  >();

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('Content asset download timeout must be positive.');
  }

  return {
    resolve: async input => {
      assertAssetDownloadMatch(input.asset, input.download);
      const digest = requireSha256(input.asset.sha256);
      const existing = inFlight.get(digest);

      if (existing) {
        if (existing.sizeBytes !== input.asset.size_bytes) {
          return Promise.reject(
            new Error(
              'Content assets sharing a SHA-256 must declare the same byte length.',
            ),
          );
        }

        return existing.promise;
      }

      const pending = resolveContentAsset({
        ...options,
        input,
        now,
        randomId,
        timeoutMs,
      }).finally(() => {
        if (inFlight.get(digest)?.promise === pending) {
          inFlight.delete(digest);
        }
      });
      inFlight.set(digest, {promise: pending, sizeBytes: input.asset.size_bytes});
      return pending;
    },
  };
}

async function resolveContentAsset(options: {
  fileSystem: ContentAssetCacheFileSystem;
  input: {
    asset: ContentManifestAsset;
    download: ContentAssetDownload;
  };
  now: () => Date;
  randomId: () => string;
  timeoutMs: number;
}): Promise<ContentAssetCacheFile> {
  const {asset, download} = options.input;
  assertAssetDownloadMatch(asset, download);
  const digest = requireSha256(asset.sha256);
  const directory = joinPath(
    options.fileSystem.cacheDirectory,
    CACHE_SCHEMA_DIRECTORY,
    'sha256',
    digest.slice(0, 2),
  );
  const targetPath = joinPath(directory, `${digest}.mp3`);

  await options.fileSystem.createDirectory(directory);

  if (await verifyCachedFile(options.fileSystem, targetPath, asset)) {
    return cachedFile(targetPath);
  }

  assertDownloadIsUsable(download, options.now());
  const temporaryPath = `${targetPath}.${requireRandomId(options.randomId())}.partial`;

  try {
    await removeIfPresent(options.fileSystem, temporaryPath);
    const result = await options.fileSystem.download({
      destinationPath: temporaryPath,
      timeoutMs: options.timeoutMs,
      url: download.url,
    });

    if (result.status !== 200) {
      throw new Error(
        `Content asset download returned unexpected status ${result.status}.`,
      );
    }
    assertRedirectsAreUsable(result.redirects ?? []);

    await requireValidFile(options.fileSystem, temporaryPath, asset);

    if (await verifyCachedFile(options.fileSystem, targetPath, asset)) {
      await removeIfPresent(options.fileSystem, temporaryPath);
      return cachedFile(targetPath);
    }

    await options.fileSystem.move(temporaryPath, targetPath);

    try {
      await requireValidFile(options.fileSystem, targetPath, asset);
    } catch (error) {
      await removeIfPresent(options.fileSystem, targetPath);
      throw error;
    }

    return cachedFile(targetPath);
  } catch (error) {
    await removeIfPresent(options.fileSystem, temporaryPath);
    throw error;
  }
}

async function verifyCachedFile(
  fileSystem: ContentAssetCacheFileSystem,
  path: string,
  asset: ContentManifestAsset,
) {
  if (!(await fileSystem.exists(path))) {
    return false;
  }

  try {
    await requireValidFile(fileSystem, path, asset);
    return true;
  } catch {
    await removeIfPresent(fileSystem, path);
    return false;
  }
}

async function requireValidFile(
  fileSystem: ContentAssetCacheFileSystem,
  path: string,
  asset: ContentManifestAsset,
) {
  const stat = await fileSystem.stat(path);

  if (stat.type !== 'file' || stat.sizeBytes !== asset.size_bytes) {
    throw new Error('Content asset byte length does not match its manifest.');
  }

  const expectedDigest = requireSha256(asset.sha256);
  const actualDigest = (await fileSystem.hashSha256(path)).toLowerCase();

  if (!/^[a-f0-9]{64}$/.test(actualDigest) || actualDigest !== expectedDigest) {
    throw new Error('Content asset SHA-256 does not match its manifest.');
  }
}

async function removeIfPresent(
  fileSystem: ContentAssetCacheFileSystem,
  path: string,
) {
  if (await fileSystem.exists(path)) {
    await fileSystem.remove(path);
  }
}

function assertAssetDownloadMatch(
  asset: ContentManifestAsset,
  download: ContentAssetDownload,
) {
  if (asset.asset_id !== download.asset_id) {
    throw new Error('Content asset download does not match its manifest asset.');
  }
}

function assertDownloadIsUsable(download: ContentAssetDownload, now: Date) {
  const expiry = Date.parse(download.expires_at);

  if (Number.isNaN(expiry) || expiry <= now.getTime()) {
    throw new Error('Content asset download URL has expired.');
  }

  assertCredentialFreeHttps(download.url, 'download URL');
}

function assertRedirectsAreUsable(redirects: readonly string[]) {
  for (const redirect of redirects) {
    assertCredentialFreeHttps(redirect, 'download redirect');
  }
}

function assertCredentialFreeHttps(value: string, label: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`Content asset ${label} is invalid.`);
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(
      `Content asset ${label} requires credential-free HTTPS.`,
    );
  }
}

function requireSha256(value: string) {
  const match = /^sha256:([a-f0-9]{64})$/.exec(value);

  if (!match) {
    throw new Error('Content asset requires a normalized SHA-256 identifier.');
  }

  return match[1];
}

function requireRandomId(value: string) {
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(value)) {
    throw new Error('Content asset temporary file ID is invalid.');
  }

  return value;
}

function createRandomId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

function joinPath(...parts: string[]) {
  return parts
    .map((part, index) =>
      index === 0 ? part.replace(/\/+$/, '') : part.replace(/^\/+|\/+$/g, ''),
    )
    .join('/');
}

function cachedFile(path: string): ContentAssetCacheFile {
  return {
    path,
    uri: path.startsWith('file://') ? path : `file://${path}`,
  };
}
