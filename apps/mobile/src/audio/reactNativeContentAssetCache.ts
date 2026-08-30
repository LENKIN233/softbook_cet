import ReactNativeBlobUtil from 'react-native-blob-util';

import {
  assertContentAssetCredentialFreeHttps,
  createContentAssetCache,
  type ContentAssetCacheFileSystem,
} from './contentAssetCache';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

const fileSystem: ContentAssetCacheFileSystem = {
  cacheDirectory: ReactNativeBlobUtil.fs.dirs.CacheDir,
  createDirectory: async path => {
    if (!(await ReactNativeBlobUtil.fs.exists(path))) {
      try {
        await ReactNativeBlobUtil.fs.mkdir(path);
      } catch (error) {
        if (!(await ReactNativeBlobUtil.fs.exists(path))) {
          throw error;
        }
      }
    }
  },
  download: async ({destinationPath, timeoutMs, url}) => {
    const startedAt = Date.now();
    const redirects: string[] = [];
    let requestUrl = url;

    for (let redirectCount = 0; ; redirectCount += 1) {
      const remainingTimeoutMs = timeoutMs - (Date.now() - startedAt);

      if (remainingTimeoutMs <= 0) {
        throw new Error('Native content asset download timed out.');
      }

      const response = await ReactNativeBlobUtil.config({
        followRedirect: false,
        overwrite: false,
        path: destinationPath,
        timeout: remainingTimeoutMs,
      }).fetch('GET', requestUrl, {Accept: 'audio/mpeg'});
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

      if (await ReactNativeBlobUtil.fs.exists(destinationPath)) {
        await ReactNativeBlobUtil.fs.unlink(destinationPath);
      }
      requestUrl = redirectUrl;
    }
  },
  exists: path => ReactNativeBlobUtil.fs.exists(path),
  hashSha256: path => ReactNativeBlobUtil.fs.hash(path, 'sha256'),
  move: async (sourcePath, destinationPath) => {
    await ReactNativeBlobUtil.fs.mv(sourcePath, destinationPath);
  },
  remove: path => ReactNativeBlobUtil.fs.unlink(path),
  stat: async path => {
    const stat = await ReactNativeBlobUtil.fs.stat(path);
    const sizeBytes = Number(stat.size);

    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
      throw new Error('Native content asset stat returned an invalid size.');
    }

    return {sizeBytes, type: stat.type};
  },
};

export const reactNativeContentAssetCache = createContentAssetCache({
  fileSystem,
});

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
