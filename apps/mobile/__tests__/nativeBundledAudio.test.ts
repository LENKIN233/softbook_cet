import BlobUtil from 'react-native-blob-util';
import {resolveNativeBundledAudio} from '../src/audio/nativeBundledAudio';
import {bundledCardLibrary} from '../src/learning/bundledCardLibrary';

const asset = bundledCardLibrary.cet4.assets[0];
test('corrupt cached audio is replaced from the app bundle and verified before playback', async () => {
  let copied = false;
  Object.assign(BlobUtil.fs, {
    exists: jest.fn(async () => true),
    stat: jest.fn(async () => ({size: asset.size_bytes})),
    hash: jest.fn(async () => copied ? asset.sha256.slice(7) : 'bad'),
    unlink: jest.fn(async () => {}),
    cp: jest.fn(async () => {copied = true;}),
  });
  BlobUtil.fs.dirs.MainBundleDir = '/application';
  const result = await resolveNativeBundledAudio(asset);
  expect(BlobUtil.fs.cp).toHaveBeenCalledWith('/application/card-audio/cet4/0000/000001.mp3', result.path);
  expect(BlobUtil.fs.unlink).toHaveBeenCalledTimes(1);
});

test('a corrupt bundled file cannot be returned as playable audio', async () => {
  Object.assign(BlobUtil.fs, {
    exists: jest.fn(async () => true),
    stat: jest.fn(async () => ({size: asset.size_bytes})),
    hash: jest.fn(async () => 'bad'),
    unlink: jest.fn(async () => {}),
    cp: jest.fn(async () => {}),
  });
  await expect(resolveNativeBundledAudio(asset)).rejects.toThrow('integrity');
  expect(BlobUtil.fs.unlink).toHaveBeenCalledTimes(2);
});
