import {
  createContentAssetCache,
  type ContentAssetCacheFileSystem,
} from '../src/audio/contentAssetCache';
import type {
  ContentAssetDownload,
  ContentManifestAsset,
} from '../src/audio/contentManifestRepository';

const DIGEST = 'a'.repeat(64);
const OTHER_DIGEST = 'b'.repeat(64);
const NOW = new Date('2026-07-28T12:00:00.000Z');
const ASSET: ContentManifestAsset = {
  asset_id: 'cet4.002001.prompt',
  duration_ms: 2100,
  media_type: 'audio/mpeg',
  sha256: `sha256:${DIGEST}`,
  size_bytes: 4096,
};
const DOWNLOAD: ContentAssetDownload = {
  asset_id: ASSET.asset_id,
  expires_at: '2026-07-28T12:15:00.000Z',
  url: 'https://private-content.example/audio.mp3?token=opaque',
};

function createFileSystem() {
  const files = new Map<string, {hash: string; sizeBytes: number}>();
  const fileSystem: ContentAssetCacheFileSystem = {
    cacheDirectory: '/cache',
    createDirectory: jest.fn().mockResolvedValue(undefined),
    download: jest.fn(async ({destinationPath}) => {
      files.set(destinationPath, {hash: DIGEST, sizeBytes: 4096});
      return {status: 200};
    }),
    exists: jest.fn(async path => files.has(path)),
    hashSha256: jest.fn(async path => files.get(path)?.hash ?? ''),
    move: jest.fn(async (sourcePath, destinationPath) => {
      const value = files.get(sourcePath);
      if (!value) {
        throw new Error('missing source');
      }
      files.delete(sourcePath);
      files.set(destinationPath, value);
    }),
    remove: jest.fn(async path => {
      files.delete(path);
    }),
    stat: jest.fn(async path => {
      const value = files.get(path);
      if (!value) {
        throw new Error('missing file');
      }
      return {sizeBytes: value.sizeBytes, type: 'file' as const};
    }),
  };

  return {fileSystem, files};
}

function targetPath(digest = DIGEST) {
  return `/cache/softbook-content-v1/sha256/${digest.slice(0, 2)}/${digest}.mp3`;
}

function createCache(fileSystem: ContentAssetCacheFileSystem) {
  return createContentAssetCache({
    fileSystem,
    now: () => NOW,
    randomId: () => 'download_0001',
  });
}

test('returns a verified content-addressed cache hit without using the signed URL', async () => {
  const {fileSystem, files} = createFileSystem();
  files.set(targetPath(), {hash: DIGEST, sizeBytes: ASSET.size_bytes});
  const expiredDownload = {...DOWNLOAD, expires_at: NOW.toISOString()};

  await expect(
    createCache(fileSystem).resolve({asset: ASSET, download: expiredDownload}),
  ).resolves.toEqual({
    path: targetPath(),
    uri: `file://${targetPath()}`,
  });
  expect(fileSystem.download).not.toHaveBeenCalled();
});

test('removes a corrupt cache entry then verifies and promotes a download', async () => {
  const {fileSystem, files} = createFileSystem();
  files.set(targetPath(), {hash: OTHER_DIGEST, sizeBytes: ASSET.size_bytes});

  const result = await createCache(fileSystem).resolve({
    asset: ASSET,
    download: DOWNLOAD,
  });

  expect(result.path).toBe(targetPath());
  expect(fileSystem.remove).toHaveBeenCalledWith(targetPath());
  expect(fileSystem.download).toHaveBeenCalledWith({
    destinationPath: `${targetPath()}.download_0001.partial`,
    timeoutMs: 15_000,
    url: DOWNLOAD.url,
  });
  expect(files.get(targetPath())).toEqual({
    hash: DIGEST,
    sizeBytes: ASSET.size_bytes,
  });
});

test.each([
  ['hash', {hash: OTHER_DIGEST, sizeBytes: ASSET.size_bytes}],
  ['size', {hash: DIGEST, sizeBytes: ASSET.size_bytes - 1}],
] as const)('deletes a downloaded file with invalid %s', async (_label, file) => {
  const {fileSystem, files} = createFileSystem();
  jest.mocked(fileSystem.download).mockImplementation(async ({destinationPath}) => {
    files.set(destinationPath, {...file});
    return {status: 200};
  });

  await expect(
    createCache(fileSystem).resolve({asset: ASSET, download: DOWNLOAD}),
  ).rejects.toThrow(/does not match/);
  expect(files.size).toBe(0);
  expect(fileSystem.move).not.toHaveBeenCalled();
});

test('rejects an expired URL on cache miss before download', async () => {
  const {fileSystem} = createFileSystem();

  await expect(
    createCache(fileSystem).resolve({
      asset: ASSET,
      download: {...DOWNLOAD, expires_at: NOW.toISOString()},
    }),
  ).rejects.toThrow('download URL has expired');
  expect(fileSystem.download).not.toHaveBeenCalled();
});

test('fails closed on unexpected HTTP status and removes the partial file', async () => {
  const {fileSystem, files} = createFileSystem();
  jest.mocked(fileSystem.download).mockImplementation(async ({destinationPath}) => {
    files.set(destinationPath, {hash: DIGEST, sizeBytes: ASSET.size_bytes});
    return {status: 206};
  });

  await expect(
    createCache(fileSystem).resolve({asset: ASSET, download: DOWNLOAD}),
  ).rejects.toThrow('unexpected status 206');
  expect(files.size).toBe(0);
});

test('rejects an insecure redirect and removes the partial file', async () => {
  const {fileSystem, files} = createFileSystem();
  jest.mocked(fileSystem.download).mockImplementation(async ({destinationPath}) => {
    files.set(destinationPath, {hash: DIGEST, sizeBytes: ASSET.size_bytes});
    return {redirects: ['http://private-content.example/audio.mp3'], status: 200};
  });

  await expect(
    createCache(fileSystem).resolve({asset: ASSET, download: DOWNLOAD}),
  ).rejects.toThrow('download redirect requires credential-free HTTPS');
  expect(files.size).toBe(0);
});

test('deletes the final path when post-move verification fails', async () => {
  const {fileSystem, files} = createFileSystem();
  jest.mocked(fileSystem.move).mockImplementation(
    async (sourcePath, destinationPath) => {
      files.delete(sourcePath);
      files.set(destinationPath, {
        hash: OTHER_DIGEST,
        sizeBytes: ASSET.size_bytes,
      });
    },
  );

  await expect(
    createCache(fileSystem).resolve({asset: ASSET, download: DOWNLOAD}),
  ).rejects.toThrow('SHA-256 does not match');
  expect(files.size).toBe(0);
  expect(fileSystem.remove).toHaveBeenCalledWith(targetPath());
});

test('deduplicates concurrent requests for the same content hash', async () => {
  const {fileSystem} = createFileSystem();
  const cache = createCache(fileSystem);

  const [first, second] = await Promise.all([
    cache.resolve({asset: ASSET, download: DOWNLOAD}),
    cache.resolve({
      asset: {...ASSET, asset_id: 'cet4.002002.prompt'},
      download: {...DOWNLOAD, asset_id: 'cet4.002002.prompt'},
    }),
  ]);

  expect(first).toEqual(second);
  expect(fileSystem.download).toHaveBeenCalledTimes(1);
});

test('validates each caller before joining an in-flight content hash', async () => {
  const {fileSystem} = createFileSystem();
  const cache = createCache(fileSystem);
  const first = cache.resolve({asset: ASSET, download: DOWNLOAD});

  await expect(
    cache.resolve({
      asset: {...ASSET, asset_id: 'cet4.002002.prompt'},
      download: DOWNLOAD,
    }),
  ).rejects.toThrow('does not match its manifest asset');
  await expect(
    cache.resolve({
      asset: {...ASSET, asset_id: 'cet4.002002.prompt', size_bytes: 2048},
      download: {...DOWNLOAD, asset_id: 'cet4.002002.prompt'},
    }),
  ).rejects.toThrow('must declare the same byte length');
  await expect(first).resolves.toEqual({
    path: targetPath(),
    uri: `file://${targetPath()}`,
  });
});

test('rejects a download that does not belong to the manifest asset', async () => {
  const {fileSystem} = createFileSystem();

  await expect(
    createCache(fileSystem).resolve({
      asset: ASSET,
      download: {...DOWNLOAD, asset_id: 'cet4.002002.prompt'},
    }),
  ).rejects.toThrow('does not match its manifest asset');
});
