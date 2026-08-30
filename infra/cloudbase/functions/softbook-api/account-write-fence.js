const crypto = require('node:crypto');

const {
  normalizeCloudBaseDocuments,
} = require('./cloudbase-documents');
const {isCloudBaseDocumentMissingError} = require('./cloudbase-errors');

const ACCOUNT_DELETION_PENDING_CODE = 'account_deletion_pending';
const ACCOUNT_INSTANCE_SCHEMA_VERSION = 'account-instance.v1';
const ACCOUNT_INSTANCE_ID_PATTERN = /^account_[A-Za-z0-9_-]{24,128}$/;

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

function assertMemoryAccountSessionAuthority(
  {accountDeletions, accounts, authSessions},
  authority,
  {indexSecret, write = false} = {},
) {
  const normalized = normalizeSessionAuthority(authority);
  if (
    deriveAccountKey(indexSecret, normalized.phoneNumber) !==
      normalized.accountKey
  ) {
    throw revokedAuthSessionError();
  }
  const session = authSessions?.get(normalized.sessionId) ?? null;
  const account = normalizeAccountInstance(
    accounts?.get(normalized.accountKey) ?? null,
    normalized.accountKey,
  );

  if (
    !session ||
    session.status !== 'active' ||
    session.session_id !== normalized.sessionId ||
    session.account_key !== normalized.accountKey ||
    session.account_instance_id !== normalized.accountInstanceId ||
    session.phone_number !== normalized.phoneNumber ||
    !sessionRefreshIsActive(session, normalized.checkedAt) ||
    account.account_instance_id !== normalized.accountInstanceId
  ) {
    throw revokedAuthSessionError();
  }
  // Task presence is a read and write fence. A GET authorized before the
  // deletion request must not observe a later re-registration generation.
  assertMemoryAccountWriteAllowed(
    accountDeletions,
    normalized.accountKey,
  );
  return normalized;
}

function assertMemoryOperatorAccountInstance(
  {accountDeletions, accounts},
  accountKey,
  expectedAccountInstanceId,
) {
  requireAccountInstanceId(expectedAccountInstanceId);
  const account = normalizeAccountInstance(
    accounts?.get(accountKey) ?? null,
    accountKey,
  );
  if (account.account_instance_id !== expectedAccountInstanceId) {
    throw accountInstanceMismatchError();
  }
  assertMemoryAccountWriteAllowed(accountDeletions, accountKey);
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

async function assertCloudBaseAccountSessionAuthority(
  transaction,
  collections,
  authority,
  {indexSecret, write = false} = {},
) {
  const normalized = normalizeSessionAuthority(authority);
  if (
    deriveAccountKey(indexSecret, normalized.phoneNumber) !==
      normalized.accountKey
  ) {
    throw revokedAuthSessionError();
  }
  const [session, account] = await Promise.all([
    getDocument(
      transaction.collection(collections.authSessions),
      normalized.sessionId,
    ),
    getDocument(
      transaction.collection(collections.accounts),
      normalized.accountKey,
    ),
  ]);
  let normalizedAccount;
  try {
    normalizedAccount = normalizeAccountInstance(
      account,
      normalized.accountKey,
    );
  } catch {
    throw revokedAuthSessionError();
  }
  if (
    !session ||
    session.status !== 'active' ||
    session.session_id !== normalized.sessionId ||
    session.account_key !== normalized.accountKey ||
    session.account_instance_id !== normalized.accountInstanceId ||
    session.phone_number !== normalized.phoneNumber ||
    !sessionRefreshIsActive(session, normalized.checkedAt) ||
    normalizedAccount.account_instance_id !== normalized.accountInstanceId
  ) {
    throw revokedAuthSessionError();
  }
  await assertCloudBaseAccountWriteAllowed(
    transaction,
    collections.accountDeletions,
    normalized.accountKey,
  );
  return normalized;
}

async function assertCloudBaseOperatorAccountInstance(
  transaction,
  collections,
  accountKey,
  expectedAccountInstanceId,
) {
  requireAccountInstanceId(expectedAccountInstanceId);
  const account = normalizeAccountInstance(
    await getDocument(
      transaction.collection(collections.accounts),
      accountKey,
    ),
    accountKey,
  );
  if (account.account_instance_id !== expectedAccountInstanceId) {
    throw accountInstanceMismatchError();
  }
  await assertCloudBaseAccountWriteAllowed(
    transaction,
    collections.accountDeletions,
    accountKey,
  );
}

function normalizeAccountInstance(value, expectedAccountKey) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw accountInstanceMismatchError();
  }
  const account = {...value};
  delete account._id;
  const keys = Object.keys(account).sort();
  const expectedKeys = [
    'account_instance_id',
    'account_key',
    'created_at',
    'schema_version',
  ];
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index]) ||
    account.schema_version !== ACCOUNT_INSTANCE_SCHEMA_VERSION ||
    account.account_key !== expectedAccountKey ||
    !ACCOUNT_INSTANCE_ID_PATTERN.test(account.account_instance_id ?? '') ||
    !isCanonicalIsoTimestamp(account.created_at)
  ) {
    throw accountInstanceMismatchError();
  }
  return account;
}

function normalizeSessionAuthority(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    typeof value.accountKey !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.accountKey) ||
    typeof value.sessionId !== 'string' ||
    !/^[A-Za-z0-9_-]{24,128}$/.test(value.sessionId) ||
    typeof value.phoneNumber !== 'string' ||
    !/^1\d{10}$/.test(value.phoneNumber) ||
    typeof value.accountInstanceId !== 'string' ||
    !isCanonicalIsoTimestamp(value.checkedAt)
  ) {
    throw revokedAuthSessionError();
  }
  requireAccountInstanceId(value.accountInstanceId);
  return {
    accountInstanceId: value.accountInstanceId,
    accountKey: value.accountKey,
    checkedAt: value.checkedAt,
    phoneNumber: value.phoneNumber,
    sessionId: value.sessionId,
  };
}

function sessionRefreshIsActive(session, checkedAt) {
  return (
    isCanonicalIsoTimestamp(session?.refresh_expires_at) &&
    Date.parse(session.refresh_expires_at) > Date.parse(checkedAt)
  );
}

function requireAccountInstanceId(value) {
  if (typeof value !== 'string' || !ACCOUNT_INSTANCE_ID_PATTERN.test(value)) {
    throw accountInstanceMismatchError();
  }
  return value;
}

function accountInstanceMismatchError() {
  const error = new Error(
    'The account instance is absent or no longer current. Sign in again.',
  );
  error.code = 'account_instance_mismatch';
  error.statusCode = 409;
  return error;
}

function revokedAuthSessionError() {
  const error = new Error('Auth session is not active.');
  error.code = 'revoked_auth_session';
  error.statusCode = 401;
  return error;
}

function isCanonicalIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
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
  ACCOUNT_INSTANCE_ID_PATTERN,
  ACCOUNT_INSTANCE_SCHEMA_VERSION,
  ACCOUNT_DELETION_PENDING_CODE,
  accountInstanceMismatchError,
  assertCloudBaseAccountSessionAuthority,
  assertCloudBaseAccountWriteAllowed,
  assertCloudBaseOperatorAccountInstance,
  assertMemoryAccountSessionAuthority,
  assertMemoryAccountWriteAllowed,
  assertMemoryOperatorAccountInstance,
  deriveAccountKey,
  isAccountDeletionPendingError,
  normalizeAccountInstance,
  normalizeSessionAuthority,
  requireAccountInstanceId,
  resolveAccountWriteKey,
};
