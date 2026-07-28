import ReactNativeBlobUtil from 'react-native-blob-util';

import {
  createContentAssetCache,
  type ContentAssetCacheFileSystem,
} from './contentAssetCache';

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
    const response = await ReactNativeBlobUtil.config({
      overwrite: false,
      path: destinationPath,
      timeout: timeoutMs,
    }).fetch('GET', url, {Accept: 'audio/mpeg'});

    const info = response.info();
    return {redirects: info.redirects ?? [], status: info.status};
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
