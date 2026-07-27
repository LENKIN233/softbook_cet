const assert = require('node:assert/strict');
const test = require('node:test');
const {
  isCloudBaseDocumentMissingError,
} = require('../cloudbase-errors');

test('CloudBase missing-document detection accepts structured SDK errors', () => {
  for (const code of [
    'DOCUMENT_NOT_FOUND',
    'DOCUMENT_NOT_EXIST',
    'DATABASE_DOCUMENT_NOT_FOUND',
    'DATABASE_DOCUMENT_NOT_EXIST',
  ]) {
    assert.equal(
      isCloudBaseDocumentMissingError({
        code,
        message: 'CloudBase document lookup failed.',
      }),
      true,
    );
  }

  assert.equal(
    isCloudBaseDocumentMissingError({
      errCode: 'DOCUMENT_NOT_FOUND',
      message: 'CloudBase document lookup failed.',
    }),
    true,
  );
});

test('CloudBase missing-document detection keeps unrelated failures fatal', () => {
  assert.equal(
    isCloudBaseDocumentMissingError(
      new Error('CloudBase document not found during lookup.'),
    ),
    true,
  );
  assert.equal(
    isCloudBaseDocumentMissingError({
      code: 'DATABASE_COLLECTION_NOT_EXIST',
      message: 'CloudBase collection not found.',
    }),
    false,
  );
  assert.equal(
    isCloudBaseDocumentMissingError({
      code: 'NETWORK_ERROR',
      message: 'Remote service not found.',
    }),
    false,
  );
});
