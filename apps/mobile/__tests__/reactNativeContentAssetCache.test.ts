const DIGEST = 'c'.repeat(64);

jest.mock('react-native-blob-util', () => {
  const fetch = jest.fn().mockResolvedValue({
    info: () => ({headers: {}, redirects: [], status: 200}),
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
    default: {config: jest.fn(() => ({fetch})), fs},
  };
});

import ReactNativeBlobUtil from 'react-native-blob-util';
import {reactNativeContentAssetCache} from '../src/audio/reactNativeContentAssetCache';

const mockConfig = jest.mocked(ReactNativeBlobUtil.config);
const mockFs = jest.mocked(ReactNativeBlobUtil.fs);
const mockFetch = jest.mocked(mockConfig({}).fetch);

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
  mockFetch.mockResolvedValueOnce({
    info: () => ({
      headers: {Location: 'http://private-content.example/insecure.mp3'},
      redirects: [],
      status: 302,
    }),
  } as never);

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
  mockFetch
    .mockResolvedValueOnce({
      info: () => ({
        headers: {location: '/final.mp3?token=opaque'},
        redirects: [],
        status: 307,
      }),
    } as never)
    .mockResolvedValueOnce({
      info: () => ({headers: {}, redirects: [], status: 200}),
    } as never);

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
