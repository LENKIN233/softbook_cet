const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ACCOUNT_KEY_COLLECTIONS,
  PHONE_DOCUMENT_COLLECTIONS,
  PHONE_FILTER_COLLECTIONS,
  RATE_LIMIT_COLLECTION,
  createAccountDeletionWorkerV1,
} = require('../account-deletion-worker-v1');

const ACCOUNT_KEY = 'a'.repeat(64);
const PHONE = '13800138000';
const PHONE_RATE_KEY = `phone:${'b'.repeat(64)}`;
const NOW = new Date('2026-08-01T08:00:00.000Z');

test('worker clears every account collection and removes the deletion lock last', async () => {
  const repository = createRepository();
  const worker = createAccountDeletionWorkerV1({
    now: () => new Date(NOW),
    repository,
  });
  const report = await worker.run();

  assert.equal(report.attempted_count, 1);
  assert.equal(report.completed_count, 1);
  assert.equal(JSON.stringify(report).includes(PHONE), false);
  assert.equal(JSON.stringify(report).includes(ACCOUNT_KEY), false);
  assert.equal(repository.taskExists(), false);
  assert.equal(repository.remainingAccountDocuments(), 0);
  assert.equal(repository.calls.at(-1), `complete:${ACCOUNT_KEY}`);
  assert.deepEqual(
    repository.calls.filter(call => call.startsWith('where:')).sort(),
    [
      ...ACCOUNT_KEY_COLLECTIONS.map(
        collection => `where:${collection}:account_key`,
      ),
      ...PHONE_FILTER_COLLECTIONS.map(
        collection => `where:${collection}:phone_number`,
      ),
      `where:${RATE_LIMIT_COLLECTION}:key`,
    ].sort(),
  );
  assert.deepEqual(
    repository.calls.filter(call => call.startsWith('document:')).sort(),
    PHONE_DOCUMENT_COLLECTIONS.map(
      collection => `document:${collection}:${PHONE}`,
    ).sort(),
  );
});

test('partial failure keeps the login lock and a retry finishes idempotently', async () => {
  const repository = createRepository({
    failOnceCollection: 'softbook_pilot_entitlements',
  });
  const worker = createAccountDeletionWorkerV1({
    now: () => new Date(NOW),
    repository,
  });
  const first = await worker.run();

  assert.equal(first.completed_count, 0);
  assert.equal(first.results[0].status, 'retry_queued');
  assert.equal(repository.taskExists(), true);
  assert.equal(repository.task().status, 'queued');
  assert.equal(
    repository.task().last_failure_code,
    'account_cleanup_incomplete',
  );

  const second = await worker.run();
  assert.equal(second.completed_count, 1);
  assert.equal(repository.taskExists(), false);
  assert.equal(repository.remainingAccountDocuments(), 0);
});

test('invalid deletion tasks fail closed before any account mutation', async () => {
  const repository = createRepository({invalidTask: true});
  const worker = createAccountDeletionWorkerV1({
    now: () => new Date(NOW),
    repository,
  });

  await assert.rejects(() => worker.run(), /task is invalid/);
  assert.equal(repository.calls.length, 0);
  assert.equal(repository.taskExists(), true);
});

function createRepository({failOnceCollection = null, invalidTask = false} = {}) {
  const calls = [];
  let failed = false;
  let task = {
    account_key: invalidTask ? 'invalid' : ACCOUNT_KEY,
    attempt_count: 0,
    deletion_id: 'delete_account_worker_0001',
    last_attempt_at: null,
    lease_expires_at: null,
    phone_number: PHONE,
    phone_rate_key: PHONE_RATE_KEY,
    requested_at: '2026-08-01T07:59:00.000Z',
    status: 'queued',
  };
  const filters = new Map();
  for (const collection of ACCOUNT_KEY_COLLECTIONS) {
    filters.set(collection, [{account_key: ACCOUNT_KEY, id: collection}]);
  }
  for (const collection of PHONE_FILTER_COLLECTIONS) {
    filters.set(collection, [{phone_number: PHONE, id: collection}]);
  }
  filters.set(RATE_LIMIT_COLLECTION, [
    {key: PHONE_RATE_KEY, id: 'owned-phone-rate'},
    {key: `ip:${'c'.repeat(64)}`, id: 'shared-ip-rate'},
  ]);
  const documents = new Map(
    PHONE_DOCUMENT_COLLECTIONS.map(collection => [
      collection,
      new Map([[PHONE, {phone_number: PHONE}]]),
    ]),
  );

  return {
    calls,
    task: () => structuredClone(task),
    taskExists: () => task !== null,
    remainingAccountDocuments: () =>
      [...filters.values()].reduce(
        (sum, rows) =>
          sum +
          rows.filter(row => row.account_key || row.phone_number || row.key === PHONE_RATE_KEY)
            .length,
        0,
      ) +
      [...documents.values()].reduce((sum, rows) => sum + rows.size, 0),
    listRunnableTasks: async () => (task ? [structuredClone(task)] : []),
    claimTask: async input => {
      if (!task || task.status !== 'queued') return false;
      task = {
        ...task,
        attempt_count: task.attempt_count + 1,
        last_attempt_at: input.now,
        lease_expires_at: input.leaseExpiresAt,
        status: 'processing',
      };
      return true;
    },
    removeWhere: async (collection, filter) => {
      calls.push(`where:${collection}:${Object.keys(filter)[0]}`);
      const rows = filters.get(collection) ?? [];
      filters.set(
        collection,
        rows.filter(row =>
          Object.entries(filter).some(([key, value]) => row[key] !== value),
        ),
      );
    },
    removeDocument: async (collection, id) => {
      calls.push(`document:${collection}:${id}`);
      if (collection === failOnceCollection && !failed) {
        failed = true;
        throw new Error('simulated delete interruption');
      }
      documents.get(collection)?.delete(id);
    },
    completeTask: async accountKey => {
      calls.push(`complete:${accountKey}`);
      if (accountKey !== ACCOUNT_KEY) throw new Error('wrong account task');
      task = null;
    },
    releaseTask: async input => {
      if (!task) return;
      task = {
        ...task,
        last_attempt_at: input.now,
        last_failure_code: input.failureCode,
        lease_expires_at: null,
        status: 'queued',
      };
    },
  };
}
