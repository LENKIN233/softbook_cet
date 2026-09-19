import {Platform} from 'react-native';
import BlobUtil from 'react-native-blob-util';
import type {ContentManifestAsset} from './contentManifestRepository';
import {requireBundledAudioAsset} from './bundledAudio';

const inFlight = new Map<string, Promise<{path: string; uri: string}>>();
export function resolveNativeBundledAudio(asset: ContentManifestAsset) {
  const descriptor = requireBundledAudioAsset(asset);
  const key = descriptor.sha256;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const task = (async () => {
    const path = `${BlobUtil.fs.dirs.CacheDir}/bundled-${key.slice(7)}.mp3`;
    async function valid() {
      return await BlobUtil.fs.exists(path) &&
        Number((await BlobUtil.fs.stat(path)).size) === descriptor.size_bytes &&
        await BlobUtil.fs.hash(path, 'sha256') === key.slice(7);
    }
    if (!(await valid())) {
      if (await BlobUtil.fs.exists(path)) await BlobUtil.fs.unlink(path);
      const relative = `card-audio/${descriptor.asset_path.slice('audio/'.length)}`;
      const source = Platform.OS === 'android'
        ? BlobUtil.fs.asset(relative)
        : `${BlobUtil.fs.dirs.MainBundleDir}/${relative}`;
      await BlobUtil.fs.cp(source, path);
      if (!(await valid())) {
        if (await BlobUtil.fs.exists(path)) await BlobUtil.fs.unlink(path);
        throw new Error('Bundled audio integrity check failed.');
      }
    }
    return {path, uri: `file://${path}`};
  })().finally(() => { inFlight.delete(key); });
  inFlight.set(key, task);
  return task;
}
