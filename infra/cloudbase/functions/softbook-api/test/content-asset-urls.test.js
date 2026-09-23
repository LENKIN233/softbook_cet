const assert = require('node:assert/strict');
const test = require('node:test');
const COS = require('cos-nodejs-sdk-v5');
const {createCloudBaseContentAssetUrlsResolver} = require('../content-asset-urls');

const issuedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
const expiresAt = new Date(issuedAt.getTime() + 900000);
const authority = {
  TCB_ENV: 'fixture-env', TENCENTCLOUD_REGION: 'ap-shanghai',
  TENCENTCLOUD_SECRETID: 'fixture-secret-id', TENCENTCLOUD_SECRETKEY: 'fixture-secret-key',
  TENCENTCLOUD_SESSIONTOKEN: 'fixture-session-token',
};
const asset = index => ({asset_id: `asset-${index}`, storage_file_id: `cloud://fixture-env.fixture-bucket-1234567890/audio/${index}.mp3`});
const context = {issuedAt, expiresAt, invocationContext: authority};
const options = {environment: {}, now: () => issuedAt.getTime(), readContext: value => value};

function assertUnavailable(error) {
  assert.equal(error.statusCode, 503);
  assert.equal(error.code, 'content_asset_delivery_unavailable');
  assert.ok(!error.message.includes('fixture-secret'));
  return true;
}

test('all 301 authorized assets have exact COS expiry, host/key binding and stable deduplicated order', async () => {
  const calls = [];
  const resolve = createCloudBaseContentAssetUrlsResolver({...options, createClient(config) {
    const client = new COS(config);
    return {getObjectUrl(params, callback) {calls.push(params); client.getObjectUrl(params, callback);}};
  }});
  const assets = Array.from({length: 301}, (_, i) => asset(i));
  const urls = await resolve({assets: [...assets, {...assets[0], asset_id: 'alias'}], ...context});
  assert.equal(calls.length, 301);
  assert.equal(urls.length, 302);
  assert.equal(urls[301], urls[0]);
  urls.slice(0, 301).forEach((value, index) => {
    const url = new URL(value);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'fixture-bucket-1234567890.cos.ap-shanghai.myqcloud.com');
    assert.equal(url.pathname, `/audio/${index}.mp3`);
    assert.equal(url.searchParams.get('q-sign-time'), `${issuedAt.getTime() / 1000};${expiresAt.getTime() / 1000 - 1}`);
    assert.equal(url.searchParams.get('q-header-list'), 'host');
    assert.equal(url.searchParams.get('x-cos-security-token'), authority.TENCENTCLOUD_SESSIONTOKEN);
  });
});

test('warm invocations use their own current credentials', async () => {
  const resolve = createCloudBaseContentAssetUrlsResolver(options);
  const first = new URL((await resolve({assets: [asset(0)], ...context}))[0]);
  const second = new URL((await resolve({assets: [asset(0)], ...context, invocationContext: {
    ...authority, TENCENTCLOUD_SECRETID: 'rotated-id', TENCENTCLOUD_SECRETKEY: 'rotated-key', TENCENTCLOUD_SESSIONTOKEN: 'rotated-token',
  }}))[0]);
  assert.equal(first.searchParams.get('q-ak'), authority.TENCENTCLOUD_SECRETID);
  assert.equal(second.searchParams.get('q-ak'), 'rotated-id');
  assert.equal(second.searchParams.get('x-cos-security-token'), 'rotated-token');
  assert.notEqual(second.searchParams.get('q-signature'), first.searchParams.get('q-signature'));
});

test('SCF namespace and static region are supported without caching credentials', async () => {
  const invocationContext = {...authority, TCB_ENV: undefined, TENCENTCLOUD_REGION: undefined, SCF_NAMESPACE: authority.TCB_ENV};
  const resolve = createCloudBaseContentAssetUrlsResolver({...options, environment: {TENCENTCLOUD_REGION: 'ap-shanghai'}});
  assert.equal((await resolve({assets: [asset(0)], ...context, invocationContext})).length, 1);
});

test('empty authorized prefixes do not need or issue a storage credential', async () => {
  const resolve = createCloudBaseContentAssetUrlsResolver({...options, readContext() {throw new Error('must not run');}});
  assert.deepEqual(await resolve({assets: [], ...context}), []);
});

for (const storage_file_id of [
  'cloud://foreign-env.fixture-bucket-1234567890/audio.mp3',
  'cloud://fixture-env.bad.example.com/audio.mp3',
  'cloud://fixture-env.fixture-bucket-1234567890/../secret.mp3',
  'cloud://fixture-env.fixture-bucket-1234567890/a\\secret.mp3',
]) {
  test(`invalid storage scope is rejected before signing (${storage_file_id})`, async () => {
    const resolve = createCloudBaseContentAssetUrlsResolver({...options, createClient() {assert.fail('invalid IDs must not reach the signer');}});
    await assert.rejects(resolve({assets: [{...asset(0), storage_file_id}], ...context}), assertUnavailable);
  });
}

for (const kind of ['missing_credentials', 'expired', 'fractional_expiry', 'signature_failure', 'incorrect_signature_window']) {
  test(`COS authorization fails closed for ${kind}`, async () => {
    const config = {...options};const input = {assets: [asset(0)], ...context};
    if (kind === 'missing_credentials') input.invocationContext = {...authority, TENCENTCLOUD_SECRETKEY: ''};
    if (kind === 'expired') input.expiresAt = issuedAt;
    if (kind === 'fractional_expiry') input.expiresAt = new Date(expiresAt.getTime() + 100);
    if (kind === 'signature_failure') config.createClient = () => ({getObjectUrl(_params, callback) {callback(new Error('private provider detail'));}});
    if (kind === 'incorrect_signature_window') config.createClient = init => {
      const client = new COS(init);
      return {getObjectUrl(params, callback) {client.getObjectUrl(params, (error, result) => {
        if (error) return callback(error);
        const url = new URL(result.Url);url.searchParams.set('q-sign-time', '0;9999999999');
        callback(null, {Url: url.href});
      });}};
    };
    await assert.rejects(createCloudBaseContentAssetUrlsResolver(config)(input), assertUnavailable);
  });
}
