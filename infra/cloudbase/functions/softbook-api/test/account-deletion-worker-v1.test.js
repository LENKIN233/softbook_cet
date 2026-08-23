const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ACCOUNT_KEY_COLLECTIONS,
  PHONE_DOCUMENT_COLLECTIONS,
  PHONE_FILTER_COLLECTIONS,
  RATE_LIMIT_COLLECTION,
  createAccountDeletionWorkerV1,
  createCloudBaseAccountDeletionRepository,
} = require('../account-deletion-worker-v1');

const ACCOUNT_KEY = 'a'.repeat(64);
const PHONE = '13800138000';
const PHONE_RATE_KEY = `phone:${'b'.repeat(64)}`;
const NOW = new Date('2026-08-01T08:00:00.000Z');

test('worker clears every current account collection and removes the login lock last', async () => {
  const repository = createRepository();
  const worker = createWorker(repository);
  const report = await worker.run();

  assert.equal(report.attempted_count, 1);
  assert.equal(report.completed_count, 1);
  assert.match(report.results[0].deletion_fingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(report).includes(PHONE), false);
  assert.equal(JSON.stringify(report).includes(ACCOUNT_KEY), false);
  assert.equal(repository.taskExists(), false);
  assert.equal(repository.remainingAccountDocuments(), 0);
  assert.match(repository.calls.at(-1), /^complete:/);
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
  const worker = createWorker(repository);
  const first = await worker.run();

  assert.equal(first.completed_count, 0);
  assert.equal(first.results[0].status, 'retry_queued');
  assert.equal(repository.taskExists(), true);
  assert.equal(repository.task().status, 'queued');
  assert.equal(
    repository.task().last_failure_code,
    'account_cleanup_incomplete',
  );
  assert.equal(repository.task().lease_id, null);

  const second = await worker.run();
  assert.equal(second.completed_count, 1);
  assert.equal(repository.taskExists(), false);
  assert.equal(repository.remainingAccountDocuments(), 0);
  assert.equal(repository.taskAttemptCount(), 2);
});

test('a lost lease cannot remove or requeue a task claimed by another worker', async () => {
  const repository = createRepository({loseLeaseBeforeComplete: true});
  const worker = createWorker(repository);
  const report = await worker.run();

  assert.equal(report.completed_count, 0);
  assert.equal(report.results[0].status, 'lease_lost');
  assert.equal(repository.taskExists(), true);
  assert.equal(repository.task().status, 'processing');
  assert.equal(repository.task().lease_id, `lease_${'z'.repeat(24)}`);
});

test('an expired processing lease is reclaimed and completed with a new owner', async () => {
  const repository = createRepository({expiredLease: true});
  const worker = createWorker(repository);
  const report = await worker.run();

  assert.equal(report.completed_count, 1);
  assert.equal(repository.taskExists(), false);
  assert.equal(repository.taskAttemptCount(), 2);
});

test('invalid deletion tasks fail closed before any account mutation', async () => {
  const repository = createRepository({invalidTask: true});
  const worker = createWorker(repository);

  await assert.rejects(() => worker.run(), /task is invalid/);
  assert.equal(repository.calls.length, 0);
  assert.equal(repository.taskExists(), true);
});

test('CloudBase repository claims, verifies, and erases the current collection set', async () => {
  const db = createFakeCloudBaseDb();
  const taskCollection = db.collection('softbook_account_deletions');
  await taskCollection.doc(ACCOUNT_KEY).set({
    account_key: ACCOUNT_KEY,
    attempt_count: 0,
    deletion_id: 'delete_cloudbase_worker_0001',
    last_attempt_at: null,
    last_failure_code: null,
    lease_expires_at: null,
    lease_id: null,
    phone_number: PHONE,
    phone_rate_key: PHONE_RATE_KEY,
    requested_at: '2026-08-01T07:59:00.000Z',
    schema_version: 'account-deletion-task.v1',
    status: 'queued',
  });
  for (const collection of ACCOUNT_KEY_COLLECTIONS) {
    await db.collection(collection).doc(`owned-${collection}`).set({
      account_key: ACCOUNT_KEY,
    });
  }
  for (const collection of PHONE_FILTER_COLLECTIONS) {
    await db.collection(collection).doc(`owned-${collection}`).set({
      phone_number: PHONE,
    });
  }
  await db.collection(RATE_LIMIT_COLLECTION).doc('owned-phone-rate').set({
    key: PHONE_RATE_KEY,
  });
  await db.collection(RATE_LIMIT_COLLECTION).doc('shared-ip-rate').set({
    key: `ip:${'c'.repeat(64)}`,
  });
  for (const collection of PHONE_DOCUMENT_COLLECTIONS) {
    await db.collection(collection).doc(PHONE).set({phone_number: PHONE});
  }

  const worker = createAccountDeletionWorkerV1({
    now: () => new Date(NOW),
    randomBytes: size => Buffer.alloc(size, 9),
    repository: createCloudBaseAccountDeletionRepository(db, {
      accountDeletions: 'softbook_account_deletions',
    }),
  });
  const report = await worker.run();

  assert.equal(report.completed_count, 1);
  assert.equal(
    (await taskCollection.doc(ACCOUNT_KEY).get()).data.length,
    0,
  );
  for (const collection of ACCOUNT_KEY_COLLECTIONS) {
    assert.equal(db.snapshot().get(collection).size, 0);
  }
  for (const collection of PHONE_FILTER_COLLECTIONS) {
    assert.equal(db.snapshot().get(collection).size, 0);
  }
  for (const collection of PHONE_DOCUMENT_COLLECTIONS) {
    assert.equal(db.snapshot().get(collection).size, 0);
  }
  assert.deepEqual(
    [...db.snapshot().get(RATE_LIMIT_COLLECTION).values()],
    [{key: `ip:${'c'.repeat(64)}`}],
  );
});

test('queued CloudBase tasks are not starved by older live processing leases', async () => {
  const db = createFakeCloudBaseDb();
  const tasks = db.collection('softbook_account_deletions');
  for (let index = 0; index < 120; index += 1) {
    const accountKey = index.toString(16).padStart(64, '0');
    await tasks.doc(accountKey).set({
      ...taskFixture({accountKey}),
      attempt_count: 1,
      last_attempt_at: '2026-08-01T07:50:00.000Z',
      lease_expires_at: '2026-08-01T09:00:00.000Z',
      lease_id: `lease_${String(index).padStart(24, 'x')}`,
      requested_at: '2026-07-01T00:00:00.000Z',
      status: 'processing',
    });
  }
  const queuedAccount = 'f'.repeat(64);
  await tasks.doc(queuedAccount).set(taskFixture({accountKey: queuedAccount}));
  const repository = createCloudBaseAccountDeletionRepository(db, {
    accountDeletions: 'softbook_account_deletions',
  });

  const runnable = await repository.listRunnableTasks({
    limit: 1,
    now: NOW.toISOString(),
  });

  assert.equal(runnable.length, 1);
  assert.equal(runnable[0].account_key, queuedAccount);
});

function createWorker(repository) {
  return createAccountDeletionWorkerV1({
    now: () => new Date(NOW),
    randomBytes: size => Buffer.alloc(size, 7),
    repository,
  });
}

function taskFixture({accountKey = ACCOUNT_KEY} = {}) {
  return {
    account_key: accountKey,
    attempt_count: 0,
    deletion_id: `delete_${accountKey.slice(0, 16)}`,
    last_attempt_at: null,
    last_failure_code: null,
    lease_expires_at: null,
    lease_id: null,
    phone_number: PHONE,
    phone_rate_key: PHONE_RATE_KEY,
    requested_at: '2026-08-01T07:59:00.000Z',
    schema_version: 'account-deletion-task.v1',
    status: 'queued',
  };
}

function createRepository({
  expiredLease = false,
  failOnceCollection = null,
  invalidTask = false,
  loseLeaseBeforeComplete = false,
} = {}) {
  const calls = [];
  let failed = false;
  let attempts = expiredLease ? 1 : 0;
  let task = {
    account_key: invalidTask ? 'invalid' : ACCOUNT_KEY,
    attempt_count: expiredLease ? 1 : 0,
    deletion_id: 'delete_account_worker_0001',
    last_attempt_at: expiredLease ? '2026-08-01T07:50:00.000Z' : null,
    last_failure_code: null,
    lease_expires_at: expiredLease ? '2026-08-01T07:55:00.000Z' : null,
    lease_id: expiredLease ? `lease_${'x'.repeat(24)}` : null,
    phone_number: PHONE,
    phone_rate_key: PHONE_RATE_KEY,
    requested_at: '2026-08-01T07:59:00.000Z',
    schema_version: 'account-deletion-task.v1',
    status: expiredLease ? 'processing' : 'queued',
  };
  const filters = new Map();
  for (const collection of ACCOUNT_KEY_COLLECTIONS) {
    filters.set(collection, [{account_key: ACCOUNT_KEY, id: collection}]);
  }
  for (const collection of PHONE_FILTER_COLLECTIONS) {
    filters.set(collection, [
      ...(filters.get(collection) ?? []),
      {phone_number: PHONE, id: `legacy-${collection}`},
    ]);
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
    taskAttemptCount: () => attempts,
    taskExists: () => task !== null,
    remainingAccountDocuments: () =>
      [...filters.values()].reduce(
        (sum, rows) =>
          sum +
          rows.filter(
            row =>
              row.account_key ||
              row.phone_number ||
              row.key === PHONE_RATE_KEY,
          ).length,
        0,
      ) + [...documents.values()].reduce((sum, rows) => sum + rows.size, 0),
    listRunnableTasks: async () => (task ? [structuredClone(task)] : []),
    claimTask: async input => {
      if (
        !task ||
        !(
          task.status === 'queued' ||
          (task.status === 'processing' &&
            task.lease_expires_at <= input.now)
        )
      ) {
        return false;
      }
      attempts += 1;
      task = {
        ...task,
        attempt_count: attempts,
        last_attempt_at: input.now,
        last_failure_code: null,
        lease_expires_at: input.leaseExpiresAt,
        lease_id: input.leaseId,
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
    completeTask: async input => {
      calls.push(`complete:${input.accountKey}:${input.leaseId}`);
      if (loseLeaseBeforeComplete) {
        task = {
          ...task,
          lease_id: `lease_${'z'.repeat(24)}`,
        };
      }
      if (
        !task ||
        input.accountKey !== ACCOUNT_KEY ||
        input.leaseId !== task.lease_id
      ) {
        return false;
      }
      task = null;
      return true;
    },
    releaseTask: async input => {
      if (!task || input.leaseId !== task.lease_id) return false;
      task = {
        ...task,
        last_attempt_at: input.now,
        last_failure_code: input.failureCode,
        lease_expires_at: null,
        lease_id: null,
        status: 'queued',
      };
      return true;
    },
  };
}

function createFakeCloudBaseDb() {
  const collections = new Map();

  function collection(name) {
    if (!collections.has(name)) collections.set(name, new Map());
    const documents = collections.get(name);

    function matching(filter) {
      return [...documents.entries()].filter(([, document]) =>
        Object.entries(filter).every(
          ([field, expected]) =>
            expected?.operator === 'lte'
              ? document[field] <= expected.value
              : document[field] === expected,
        ),
      );
    }

    function query(filter) {
      let limit = Number.MAX_SAFE_INTEGER;
      let order = null;
      const builder = {
        get: async () => ({
          data: [...matching(filter)]
            .sort(([, left], [, right]) => {
              if (!order) return 0;
              const compared = String(left[order.field]).localeCompare(
                String(right[order.field]),
              );
              return order.direction === 'desc' ? -compared : compared;
            })
            .slice(0, limit)
            .map(([id, document]) => ({_id: id, ...structuredClone(document)})),
        }),
        limit(value) {
          limit = value;
          return builder;
        },
        orderBy(field, direction) {
          order = {direction, field};
          return builder;
        },
        remove: async () => {
          for (const [id] of matching(filter)) documents.delete(id);
        },
      };
      return builder;
    }

    return {
      doc: id => ({
        get: async () => ({
          data: documents.has(id)
            ? [{_id: id, ...structuredClone(documents.get(id))}]
            : [],
        }),
        remove: async () => {
          documents.delete(id);
        },
        set: async value => {
          documents.set(id, structuredClone(value));
        },
      }),
      orderBy(field, direction) {
        let limit = Number.MAX_SAFE_INTEGER;
        const builder = {
          get: async () => ({
            data: [...documents.entries()]
              .sort(([, left], [, right]) => {
                const compared = String(left[field]).localeCompare(
                  String(right[field]),
                );
                return direction === 'desc' ? -compared : compared;
              })
              .slice(0, limit)
              .map(([id, document]) => ({
                _id: id,
                ...structuredClone(document),
              })),
          }),
          limit(value) {
            limit = value;
            return builder;
          },
        };
        return builder;
      },
      where: query,
    };
  }

  return {
    collection,
    command: {
      lte: value => ({operator: 'lte', value}),
    },
    runTransaction: callback => callback({collection}),
    snapshot: () => collections,
  };
}
