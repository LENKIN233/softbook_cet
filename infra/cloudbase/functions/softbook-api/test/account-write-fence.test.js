const assert = require('node:assert/strict');
const test = require('node:test');
const {assertCloudBaseAccountSessionAuthority, deriveAccountKey} = require('../account-write-fence');

const indexSecret = 'transaction-read-fixture-secret';
const phoneNumber = '13800138000';
const accountKey = deriveAccountKey(indexSecret, phoneNumber);
const accountInstanceId = `account_${'a'.repeat(24)}`;
const sessionId = 's'.repeat(32);
const authority = {accountKey, accountInstanceId, sessionId, phoneNumber, checkedAt: '2026-09-21T00:00:00.000Z'};
const collections = {accountDeletions: 'deletions', authSessions: 'sessions', accounts: 'accounts'};

function singleOperationTransaction(kind) {
  const records = {
    deletions: kind === 'deleting' ? {account_key: accountKey} : null,
    sessions: {status: kind === 'revoked' ? 'revoked' : 'active', session_id: sessionId, account_key: accountKey, account_instance_id: accountInstanceId, phone_number: phoneNumber, refresh_expires_at: '2026-10-01T00:00:00.000Z'},
    accounts: {schema_version: 'account-instance.v1', account_key: accountKey, account_instance_id: kind === 'recreated' ? `account_${'b'.repeat(24)}` : accountInstanceId, created_at: '2026-09-20T00:00:00.000Z'},
  };
  let active = false;
  let reads = 0;
  return {
    reads: () => reads,
    collection: name => ({doc: () => ({get: async () => {
      if (active) {
        const error = new Error('Transaction is busy. Please check your request, but if the problem persists, contact us.');
        error.code = 'DATABASE_TRANSACTION_FAIL';
        throw error;
      }
      active = true;
      try {
        await new Promise(done => setImmediate(done));
        reads += 1;
        return {data: {list: records[name] ? [records[name]] : []}};
      } finally {active = false;}
    }})}),
  };
}

test('session fence accepts a valid session when the transaction supports one in-flight read', async () => {
  const transaction = singleOperationTransaction('active');
  assert.deepEqual(await assertCloudBaseAccountSessionAuthority(transaction, collections, authority, {indexSecret}), authority);
  assert.equal(transaction.reads(), 3);
});

for (const [kind, code] of [['revoked', 'revoked_auth_session'], ['recreated', 'revoked_auth_session'], ['deleting', 'account_deletion_pending']]) {
  test(`serialized session fence still rejects ${kind} authority`, async () => {
    await assert.rejects(assertCloudBaseAccountSessionAuthority(singleOperationTransaction(kind), collections, authority, {indexSecret}), error => error.code === code);
  });
}
