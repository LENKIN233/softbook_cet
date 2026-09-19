const api = require('../../index');
const cards = require('./interaction-cards');
const source = {
  id: 'cloudbase-dev-card-source',
  label: 'CloudBase 开发卡源',
};
const developmentCardSource = track => api.validateCardSourceForImport({source, track, card_records: cards[track], release: null}, track);
module.exports = Object.assign(Object.defineProperties({}, Object.getOwnPropertyDescriptors(api)), Object.fromEntries(['createSoftbookApi', 'createMemoryStore', 'createCloudBaseStore'].map(name => [name, (options = {}) => api[name]({developmentCardSource, ...options})])));
