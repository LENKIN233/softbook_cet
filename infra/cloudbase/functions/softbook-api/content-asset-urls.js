// CloudBase classic getTempFileURL ignores maxAge. Use COS's enforced signature
// window instead, with fresh credentials from the trusted function invocation.
function createCloudBaseContentAssetUrlsResolver(options = {}) {
  const environment = options.environment ?? process.env;
  const now = options.now ?? Date.now;
  const readContext = options.readContext ?? (context =>
    require('@cloudbase/node-sdk').getCloudbaseContext(context));
  const createClient = options.createClient ?? (config =>
    new (require('cos-nodejs-sdk-v5'))(config));

  return async ({assets, expiresAt, issuedAt, invocationContext}) => {
    try {
      if (assets.length === 0) return [];
      const context = readContext(invocationContext);
      const envId = context.TCB_ENV ?? context.SCF_NAMESPACE ?? environment.CLOUDBASE_ENV_ID ?? environment.SCF_NAMESPACE;
      const region = context.TENCENTCLOUD_REGION ?? environment.TENCENTCLOUD_REGION;
      if (!/^[a-z0-9][a-z0-9-]{2,127}$/.test(envId ?? '') ||
          !/^[a-z]{2}-[a-z0-9-]+$/.test(region ?? '') ||
          (environment.CLOUDBASE_ENV_ID && environment.CLOUDBASE_ENV_ID !== envId)) throw deliveryError();
      const credentials = {
        TmpSecretId: context.TENCENTCLOUD_SECRETID,
        TmpSecretKey: context.TENCENTCLOUD_SECRETKEY,
        SecurityToken: context.TENCENTCLOUD_SESSIONTOKEN,
        StartTime: Math.floor(issuedAt.getTime() / 1000),
        // COS accepts the entire ending second. Stop one second before the
        // advertised exclusive boundary rather than granting past it.
        ExpiredTime: Math.floor(expiresAt.getTime() / 1000) - 1,
      };
      if (['TmpSecretId', 'TmpSecretKey', 'SecurityToken'].some(key =>
        typeof credentials[key] !== 'string' || !credentials[key]) ||
        !Number.isSafeInteger(credentials.StartTime) ||
        !Number.isSafeInteger(credentials.ExpiredTime) ||
        expiresAt.getTime() % 1000 !== 0 ||
        credentials.ExpiredTime <= Math.max(credentials.StartTime, Math.floor(now() / 1000))) throw deliveryError();

      const fileIds = [...new Set(assets.map(asset => asset.storage_file_id))];
      const objects = fileIds.map(fileID => parseStorageObject(fileID, envId, region));
      const client = createClient({
        Protocol: 'https:',
        getAuthorization(_request, callback) { callback({...credentials}); },
      });
      const urls = await Promise.all(objects.map(object => new Promise((resolve, reject) => {
        client.getObjectUrl({...object, Sign: true, ForceSignHost: true}, (error, result) => {
          if (error) return reject(deliveryError());
          try {
            const url = new URL(result?.Url);
            if (url.protocol !== 'https:' || url.username || url.password ||
                url.hostname !== `${object.Bucket}.cos.${region}.myqcloud.com` ||
                decodeURIComponent(url.pathname.slice(1)) !== object.Key ||
                url.searchParams.get('q-sign-time') !== `${credentials.StartTime};${credentials.ExpiredTime}` ||
                url.searchParams.get('q-key-time') !== `${credentials.StartTime};${credentials.ExpiredTime}` ||
                url.searchParams.get('q-ak') !== credentials.TmpSecretId ||
                url.searchParams.get('q-header-list') !== 'host' ||
                url.searchParams.get('x-cos-security-token') !== credentials.SecurityToken) throw deliveryError();
            resolve(url.href);
          } catch { reject(deliveryError()); }
        });
      })));
      const byId = new Map(fileIds.map((id, index) => [id, urls[index]]));
      return assets.map(asset => byId.get(asset.storage_file_id));
    } catch { throw deliveryError(); }
  };
}

function parseStorageObject(fileID, envId, region) {
  const prefix = `cloud://${envId}.`;
  if (typeof fileID !== 'string' || !fileID.startsWith(prefix)) throw deliveryError();
  const suffix = fileID.slice(prefix.length);
  const separator = suffix.indexOf('/');
  const bucket = suffix.slice(0, separator);
  const key = suffix.slice(separator + 1);
  if (separator < 1 || !/^[a-z0-9][a-z0-9-]{1,127}-[0-9]{5,20}$/.test(bucket) ||
      !key || Buffer.byteLength(key, 'utf8') > 1024 || /[\\\x00-\x1f\x7f]/.test(key) ||
      key.split('/').some(segment => !segment || segment === '.' || segment === '..')) throw deliveryError();
  return {Bucket: bucket, Region: region, Key: key};
}

function deliveryError() {
  const error = new Error('Private audio signing is unavailable.');
  error.statusCode = 503;
  error.code = 'content_asset_delivery_unavailable';
  return error;
}

module.exports = {createCloudBaseContentAssetUrlsResolver};
