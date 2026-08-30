const crypto = require('node:crypto');

const {
  normalizeCloudBaseDocuments,
} = require('./cloudbase-documents');
const {isCloudBaseDocumentMissingError} = require('./cloudbase-errors');

const ACCOUNT_DELETION_PENDING_CODE = 'account_deletion_pending';

function deriveAccountKey(indexSecret, phoneNumber) {
  if (
    typeof indexSecret !== 'string' ||
    indexSecret.length < 8 ||
    typeof phoneNumber !== 'string' ||
    !/^1\d{10}$/.test(phoneNumber)
  ) {
    throw new Error('Account write fence identity is unavailable.');
  }

  return crypto
    .createHmac('sha256', indexSecret)
    .update(`account:${phoneNumber}`)
    .digest('hex');
}

function resolveAccountWriteKey({accountKey, indexSecret, phoneNumber}) {
  if (typeof accountKey === 'string' && accountKey.length > 0) {
    return accountKey;
  }

  return deriveAccountKey(indexSecret, phoneNumber);
}

function assertMemoryAccountWriteAllowed(accountDeletions, accountKey) {
  if (!(accountDeletions instanceof Map)) {
    throw new Error('Account write fence store is unavailable.');
  }

  if (accountDeletions.has(accountKey)) {
    throw accountDeletionPendingError();
  }
}

async function assertCloudBaseAccountWriteAllowed(
  transaction,
  collectionName,
  accountKey,
) {
  if (
    !transaction ||
    typeof transaction.collection !== 'function' ||
    typeof collectionName !== 'string' ||
    collectionName.length === 0 ||
    typeof accountKey !== 'string' ||
    accountKey.length === 0
  ) {
    throw new Error('Account write fence transaction is unavailable.');
  }

  const task = await getDocument(
    transaction.collection(collectionName),
    accountKey,
  );

  // The worker removes the task last and retains no tombstone. Therefore any
  // document, including queued, processing, future finalizing, or malformed
  // state, is deletion authority and blocks recreation of account data.
  if (task !== null) {
    throw accountDeletionPendingError();
  }
}

function accountDeletionPendingError() {
  const error = new Error('Account deletion is already pending.');
  error.code = ACCOUNT_DELETION_PENDING_CODE;
  error.statusCode = 403;
  return error;
}

function isAccountDeletionPendingError(error) {
  return (
    error !== null &&
    typeof error === 'object' &&
    error.code === ACCOUNT_DELETION_PENDING_CODE &&
    error.statusCode === 403
  );
}

async function getDocument(collection, documentId) {
  try {
    const result = await collection.doc(documentId).get();
    return normalizeCloudBaseDocuments(result.data)[0] ?? null;
  } catch (error) {
    if (isCloudBaseDocumentMissingError(error)) return null;
    throw error;
  }
}

module.exports = {
  ACCOUNT_DELETION_PENDING_CODE,
  assertCloudBaseAccountWriteAllowed,
  assertMemoryAccountWriteAllowed,
  deriveAccountKey,
  isAccountDeletionPendingError,
  resolveAccountWriteKey,
};
