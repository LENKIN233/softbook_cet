const assert = require('node:assert/strict');
const test = require('node:test');
const {createCloudBaseContentAssetUrlsResolver} = require('../content-asset-urls');

const context = {issuedAt: new Date('2026-09-21T00:00:00Z'), expiresAt: new Date('2026-09-21T00:15:00Z')};
const assets = Array.from({length: 301}, (_, index) => ({asset_id: `asset-${index}`, storage_file_id: `cloud://fixture/${index}`}));

test('301 private audio URLs use seven bounded batches and retain exact asset order', async () => {
  let active = 0;
  let peak = 0;
  const sizes = [];
  const resolve = createCloudBaseContentAssetUrlsResolver({async getTempFileURL({fileList, customReqOpts}, options) {
    active += 1; peak = Math.max(peak, active); sizes.push(fileList.length);
    assert.equal(options.timeout, 5000);
    assert.equal(customReqOpts.timeout, 5000);
    assert.ok(fileList.every(item => item.maxAge === 900));
    await new Promise(done => setImmediate(done));
    active -= 1;
    return {fileList: fileList.slice().reverse().map(({fileID}) => ({code: 'SUCCESS', fileID, tempFileURL: `https://private.example/${fileID.slice(fileID.lastIndexOf('/') + 1)}`}))};
  }});
  const input = [...assets, {...assets[0], asset_id: 'alias'}];
  const urls = await resolve({assets: input, ...context});
  assert.deepEqual(sizes, [50, 50, 50, 50, 50, 50, 1]);
  assert.equal(peak, 4);
  assert.equal(active, 0);
  assert.deepEqual(urls, [...assets.map((_, i) => `https://private.example/${i}`), 'https://private.example/0']);
});

test('legacy successful records may omit the provider status', async () => {
  const resolve = createCloudBaseContentAssetUrlsResolver({async getTempFileURL({fileList}) {
    return {fileList: fileList.map(({fileID}) => ({fileID, tempFileURL: 'https://private.example/audio'}))};
  }});
  assert.deepEqual(await resolve({assets: assets.slice(0, 1), ...context}), ['https://private.example/audio']);
});

test('empty authorized prefixes do not request any private URL', async () => {
  const resolve = createCloudBaseContentAssetUrlsResolver({getTempFileURL() {throw new Error('Must not be called');}});
  assert.deepEqual(await resolve({assets: [], ...context}), []);
});

for (const kind of ['missing', 'duplicate', 'unknown', 'failed', 'throw']) {
  test(`URL batch rejects ${kind} provider output without a partial response`, async () => {
    let calls = 0;
    const resolve = createCloudBaseContentAssetUrlsResolver({async getTempFileURL({fileList}) {
      calls += 1;
      if (kind === 'throw') throw new Error('provider internal detail');
      const items = fileList.map(({fileID}) => ({fileID, tempFileURL: 'https://private.example/audio'}));
      if (kind === 'missing') items.pop();
      if (kind === 'duplicate') items[1] = items[0];
      if (kind === 'unknown') items[0].fileID = 'cloud://unrequested/asset';
      if (kind === 'failed') items[0].code = 'FAILED';
      return {fileList: items};
    }});
    await assert.rejects(resolve({assets, ...context}), error => error.code === 'content_asset_delivery_unavailable' && error.statusCode === 503);
    assert.ok(calls <= 4, 'failure must not schedule another batch');
  });
}
