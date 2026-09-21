const BATCH_SIZE = 50;
const CONCURRENCY = 4;

function createCloudBaseContentAssetUrlsResolver(app) {
  return async ({assets, expiresAt, issuedAt}) => {
    const fileIds = [...new Set(assets.map(asset => asset.storage_file_id))];
    const maxAge = Math.max(1, Math.floor((expiresAt.getTime() - issuedAt.getTime()) / 1000));
    const urls = new Map();
    let next = 0;
    let failed = false;
    async function worker() {
      while (!failed && next < fileIds.length) {
        const batch = fileIds.slice(next, next + BATCH_SIZE);
        next += BATCH_SIZE;
        let response;
        try {
          response = await app.getTempFileURL({
            fileList: batch.map(fileID => ({fileID, maxAge})),
          }, {timeout: 5000});
        } catch {
          failed = true;
          throw deliveryError();
        }
        const expected = new Set(batch);
        const returned = new Set();
        if (!Array.isArray(response?.fileList) || response.fileList.length !== batch.length) {
          failed = true;
          throw deliveryError();
        }
        for (const item of response.fileList) {
          if (!expected.has(item?.fileID) || returned.has(item.fileID) || item.code ||
              typeof item.tempFileURL !== 'string' || !item.tempFileURL) {
            failed = true;
            throw deliveryError();
          }
          returned.add(item.fileID);
          urls.set(item.fileID, item.tempFileURL);
        }
      }
    }
    const results = await Promise.allSettled(Array.from({length: Math.min(CONCURRENCY, Math.ceil(fileIds.length / BATCH_SIZE))}, worker));
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
    return assets.map(asset => urls.get(asset.storage_file_id));
  };
}

function deliveryError() {
  const error = new Error('CloudBase did not return the exact requested content asset URLs.');
  error.statusCode = 503;
  error.code = 'content_asset_delivery_unavailable';
  return error;
}

module.exports = {createCloudBaseContentAssetUrlsResolver};
