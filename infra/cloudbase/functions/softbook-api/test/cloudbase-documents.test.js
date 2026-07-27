const assert = require('node:assert/strict');
const test = require('node:test');
const {
  normalizeCloudBaseDocuments,
} = require('../cloudbase-documents');

test('normalizes direct and transactional CloudBase document results', () => {
  const document = {_id: 'challenge', delivery_status: 'delivered'};

  assert.deepEqual(normalizeCloudBaseDocuments([document]), [document]);
  assert.deepEqual(
    normalizeCloudBaseDocuments({list: [document]}),
    [document],
  );
  assert.deepEqual(normalizeCloudBaseDocuments({list: []}), []);
  assert.deepEqual(normalizeCloudBaseDocuments(null), []);
});

test('does not unwrap a business document that also owns a list field', () => {
  const document = {
    _id: 'stored-document',
    delivery_status: 'delivered',
    list: [{delivery_status: 'pending'}],
  };

  assert.deepEqual(normalizeCloudBaseDocuments(document), [document]);
  assert.deepEqual(normalizeCloudBaseDocuments([document]), [document]);
  assert.deepEqual(normalizeCloudBaseDocuments([{list: [document]}]), [
    {list: [document]},
  ]);
});
