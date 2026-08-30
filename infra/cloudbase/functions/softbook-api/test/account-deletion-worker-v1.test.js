const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  ACCOUNT_KEY_COLLECTIONS,
  FINAL_CHALLENGE_COLLECTION,
  PHONE_DOCUMENT_COLLECTIONS,
  PHONE_FILTER_COLLECTIONS,
  RATE_LIMIT_COLLECTION,
  createAccountDeletionWorkerV1,
  createCloudBaseAccountDeletionRepository,
  createMemoryAccountDeletionRepository,
} = require('../account-deletion-worker-v1');
const {createMemoryAuthStateStore} = require('../auth-v2-store');
const {createAuthV2Service} = require('../auth-v2');

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
  assert.equal(
    repository.calls.at(-2),
    'where:softbook_auth_challenges:phone_number',
  );
  assert.equal(
    repository.calls.at(-3),
    `where:${RATE_LIMIT_COLLECTION}:key`,
  );
  assert.match(repository.calls.at(-5), /^finalizing:/);
  assert.match(repository.calls.at(-4), /^quiescent:/);
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

test('final sweep failure stays durably finalizing and retries only the final sweep', async () => {
  const repository = createRepository({
    failOnceWhereCollection: FINAL_CHALLENGE_COLLECTION,
  });
  const worker = createWorker(repository);
  const first = await worker.run();

  assert.equal(first.completed_count, 0);
  assert.equal(first.results[0].status, 'retry_finalizing');
  assert.equal(repository.task().status, 'finalizing');
  assert.equal(repository.task().lease_id, null);
  assert.equal(repository.task().lease_expires_at, null);
  const bulkCallsAfterFirstRun = repository.calls.filter(
    call =>
      call.startsWith('document:') ||
      (call.startsWith('where:') &&
        !call.includes(RATE_LIMIT_COLLECTION) &&
        !call.includes(FINAL_CHALLENGE_COLLECTION)),
  ).length;

  const second = await worker.run();
  assert.equal(second.completed_count, 1);
  assert.equal(repository.taskExists(), false);
  assert.equal(repository.taskAttemptCount(), 2);
  assert.equal(
    repository.calls.filter(
      call =>
        call.startsWith('document:') ||
        (call.startsWith('where:') &&
          !call.includes(RATE_LIMIT_COLLECTION) &&
          !call.includes(FINAL_CHALLENGE_COLLECTION)),
    ).length,
    bulkCallsAfterFirstRun,
  );
});

test('a lost lease cannot remove or requeue a task claimed by another worker', async () => {
  const repository = createRepository({loseLeaseBeforeComplete: true});
  const worker = createWorker(repository);
  const report = await worker.run();

  assert.equal(report.completed_count, 0);
  assert.equal(report.results[0].status, 'lease_lost');
  assert.equal(repository.taskExists(), true);
  assert.equal(repository.task().status, 'finalizing');
  assert.equal(repository.task().lease_id, `lease_${'z'.repeat(24)}`);
});

test('a stale worker cannot erase data written after a newer lease completed', async () => {
  const repository = createRepository({
    completeAndReregisterBeforeFirstMutation: true,
  });
  const worker = createWorker(repository);
  const report = await worker.run();

  assert.equal(report.completed_count, 0);
  assert.equal(report.results[0].status, 'lease_lost');
  assert.equal(repository.taskExists(), false);
  assert.equal(repository.hasReregisteredDocument(), true);
  assert.deepEqual(
    repository.calls.filter(call => call.startsWith('where:')),
    ['where:softbook_accounts:account_key'],
  );
});

test('an expired processing lease is reclaimed and completed with a new owner', async () => {
  const repository = createRepository({expiredLease: true});
  const worker = createWorker(repository);
  const report = await worker.run();

  assert.equal(report.completed_count, 1);
  assert.equal(repository.taskExists(), false);
  assert.equal(repository.taskAttemptCount(), 2);
});

test('an expired finalizing lease is reclaimed without rerunning account erasure', async () => {
  const repository = createRepository({expiredFinalizingLease: true});
  const worker = createWorker(repository);
  const report = await worker.run();

  assert.equal(report.completed_count, 1);
  assert.equal(repository.taskExists(), false);
  assert.equal(repository.taskAttemptCount(), 2);
  assert.deepEqual(
    repository.calls.filter(call => call.startsWith('where:')),
    [
      `where:${RATE_LIMIT_COLLECTION}:key`,
      `where:${FINAL_CHALLENGE_COLLECTION}:phone_number`,
    ],
  );
  assert.equal(
    repository.calls.some(call => call.startsWith('document:')),
    false,
  );
});

test('a finalizing task with a missing lease TTL fails closed', async () => {
  const repository = createRepository({missingFinalizingTtl: true});
  const worker = createWorker(repository);

  await assert.rejects(() => worker.run(), /task is invalid/);
  assert.equal(repository.calls.length, 0);
  assert.equal(repository.taskExists(), true);
});

test('a lease stolen after finalizing prevents every stale final sweep mutation', async () => {
  const repository = createRepository({stealLeaseAfterFinalizing: true});
  const worker = createWorker(repository);
  const report = await worker.run();

  assert.equal(report.completed_count, 0);
  assert.equal(report.results[0].status, 'lease_lost');
  assert.equal(repository.task().status, 'finalizing');
  assert.equal(repository.task().lease_id, `lease_${'z'.repeat(24)}`);
  assert.equal(repository.hasPhoneRateLimit(), true);
  assert.equal(repository.hasPhoneChallenge(), true);
});

test('the finalizing transition linearizes before recovery can create challenge material', async () => {
  const indexSecret = 'finalizing-race-index-secret';
  const authStore = createMemoryAuthStateStore();
  const authState = authStore.snapshotAuth();
  const service = createAuthV2Service({
    codeGenerator: () => '654321',
    indexSecret,
    now: () => new Date(NOW),
    smsProvider: {
      delivery: 'test_sms',
      kind: 'test',
      sendCode: async () => undefined,
    },
    store: authStore,
    tokenSecret: 'finalizing-race-token-secret',
  });
  const accountKey = service.deriveAccountKey(PHONE);
  authState.accountDeletions.set(accountKey, {
    ...taskFixture({accountKey}),
    phone_rate_key: `phone:${crypto
      .createHmac('sha256', indexSecret)
      .update(`rate-phone:${PHONE}`)
      .digest('hex')}`,
  });
  const repository = createMemoryAccountDeletionRepository(
    createMemoryDeletionState(authState),
  );
  const beginFinalizingTask = repository.beginFinalizingTask;
  let raceObserved = false;
  repository.beginFinalizingTask = async input => {
    const transitioned = await beginFinalizingTask(input);
    assert.equal(transitioned, true);
    const rateCount = authState.authRateLimits.size;
    const challengeCount = authState.authChallenges.size;

    const ordinary = await service.requestCode({
      body: {phone_number: PHONE},
      clientIp: '203.0.113.100',
    });
    const recovery = await service.requestDeletionRecoveryCode({
      body: {phone_number: PHONE},
      clientIp: '203.0.113.101',
    });
    assert.deepEqual(Object.keys(ordinary).sort(), [
      'challenge_id',
      'delivery',
      'expires_at',
      'retry_after_seconds',
    ]);
    assert.equal(recovery.purpose, 'account_deletion_recovery');
    assert.equal(authState.authRateLimits.size, rateCount + 2);
    assert.equal(authState.authChallenges.size, challengeCount);
    raceObserved = true;
    return true;
  };
  const worker = createAccountDeletionWorkerV1({
    now: () => new Date(NOW),
    randomBytes: size => Buffer.alloc(size, 8),
    repository,
  });

  const report = await worker.run();
  assert.equal(raceObserved, true);
  assert.equal(report.completed_count, 1);
  assert.equal(authState.accountDeletions.has(accountKey), false);

  const afterCompletion = await service.requestDeletionRecoveryCode({
    body: {phone_number: PHONE},
    clientIp: '203.0.113.102',
  });
  assert.equal(afterCompletion.purpose, 'account_deletion_recovery');
  assert.equal(authState.authChallenges.size, 1);
  assert.equal(authState.authRateLimits.size, 4);
});

test('provider-owned challenge intent keeps finalizing retryable until its provider ID lands', async () => {
  const indexSecret = 'provider-pause-index-secret';
  const authStore = createMemoryAuthStateStore();
  const authState = authStore.snapshotAuth();
  let releaseProvider;
  let providerStarted;
  const started = new Promise(resolve => {
    providerStarted = resolve;
  });
  const service = createAuthV2Service({
    indexSecret,
    now: () => new Date(NOW),
    providerDeliveryDeadlineMs: 1000,
    randomBytes: size => Buffer.alloc(size, 4),
    smsProvider: {
      delivery: 'provider_pause',
      kind: 'test',
      sendChallenge: async () => {
        providerStarted();
        return new Promise(resolve => {
          releaseProvider = () =>
            resolve({
              challengeId: 'provider-pause-id-0001',
              expiresInSeconds: 300,
            });
        });
      },
      verifyChallenge: async () => undefined,
    },
    store: authStore,
    tokenSecret: 'provider-pause-token-secret',
  });
  const accountKey = service.deriveAccountKey(PHONE);
  authState.accountDeletions.set(accountKey, {
    ...taskFixture({accountKey}),
    phone_rate_key: `phone:${crypto
      .createHmac('sha256', indexSecret)
      .update(`rate-phone:${PHONE}`)
      .digest('hex')}`,
  });
  const repository = createMemoryAccountDeletionRepository(
    createMemoryDeletionState(authState),
  );
  const worker = createAccountDeletionWorkerV1({
    now: () => new Date(NOW),
    randomBytes: size => Buffer.alloc(size, 5),
    repository,
  });

  const requestPromise = service.requestDeletionRecoveryCode({
    body: {phone_number: PHONE},
    clientIp: '203.0.113.130',
  });
  await started;
  const [localChallengeId, pending] = [...authState.authChallenges.entries()][0];
  assert.equal(pending.delivery_status, 'pending');
  assert.equal(pending.provider_challenge_id, null);
  assert.notEqual(localChallengeId, 'provider-pause-id-0001');

  const first = await worker.run();
  assert.equal(first.results[0].status, 'retry_finalizing');
  assert.equal(authState.accountDeletions.get(accountKey).status, 'finalizing');
  assert.equal(authState.authChallenges.has(localChallengeId), true);

  releaseProvider();
  const response = await requestPromise;
  assert.equal(response.challenge_id, localChallengeId);
  assert.equal(
    authState.authChallenges.get(localChallengeId).provider_challenge_id,
    'provider-pause-id-0001',
  );
  assert.equal(
    authState.authChallenges.get(localChallengeId).delivery_status,
    'delivered',
  );

  const second = await worker.run();
  assert.equal(second.completed_count, 1);
  assert.equal(authState.accountDeletions.has(accountKey), false);
  assert.equal(authState.authChallenges.has(localChallengeId), false);
});

test('sendCode reservation keeps finalizing retryable until delivery becomes terminal', async () => {
  const indexSecret = 'send-code-pause-index-secret';
  const authStore = createMemoryAuthStateStore();
  const authState = authStore.snapshotAuth();
  let releaseProvider;
  let providerStarted;
  const started = new Promise(resolve => {
    providerStarted = resolve;
  });
  const service = createAuthV2Service({
    codeGenerator: () => '654321',
    indexSecret,
    now: () => new Date(NOW),
    providerDeliveryDeadlineMs: 1000,
    randomBytes: size => Buffer.alloc(size, 6),
    smsProvider: {
      delivery: 'send_code_pause',
      kind: 'test',
      sendCode: async () => {
        providerStarted();
        return new Promise(resolve => {
          releaseProvider = resolve;
        });
      },
    },
    store: authStore,
    tokenSecret: 'send-code-pause-token-secret',
  });
  const accountKey = service.deriveAccountKey(PHONE);
  authState.accountDeletions.set(accountKey, {
    ...taskFixture({accountKey}),
    phone_rate_key: `phone:${crypto
      .createHmac('sha256', indexSecret)
      .update(`rate-phone:${PHONE}`)
      .digest('hex')}`,
  });
  const repository = createMemoryAccountDeletionRepository(
    createMemoryDeletionState(authState),
  );
  const worker = createAccountDeletionWorkerV1({
    now: () => new Date(NOW),
    randomBytes: size => Buffer.alloc(size, 7),
    repository,
  });

  const requestPromise = service.requestDeletionRecoveryCode({
    body: {phone_number: PHONE},
    clientIp: '203.0.113.131',
  });
  await started;
  const [localChallengeId, pending] = [...authState.authChallenges.entries()][0];
  assert.equal(pending.delivery_status, 'pending');
  assert.match(pending.delivery_reservation_id, /^delivery_/);

  const first = await worker.run();
  assert.equal(first.results[0].status, 'retry_finalizing');
  assert.equal(authState.authChallenges.has(localChallengeId), true);
  releaseProvider();
  await requestPromise;
  assert.equal(
    authState.authChallenges.get(localChallengeId).delivery_status,
    'delivered',
  );

  const second = await worker.run();
  assert.equal(second.completed_count, 1);
  assert.equal(authState.accountDeletions.has(accountKey), false);
  assert.equal(authState.authChallenges.has(localChallengeId), false);
});

test('a provider that ignores abort cannot make its late challenge locally usable', async () => {
  const indexSecret = 'ignored-abort-index-secret';
  const authStore = createMemoryAuthStateStore();
  const authState = authStore.snapshotAuth();
  let current = new Date(NOW);
  let providerCompleted = false;
  let providerStarted;
  let releaseProvider;
  const started = new Promise(resolve => {
    providerStarted = resolve;
  });
  const service = createAuthV2Service({
    indexSecret,
    now: () => new Date(current),
    providerDeliveryDeadlineMs: 5,
    randomBytes: size => Buffer.alloc(size, 9),
    smsProvider: {
      delivery: 'ignored_abort',
      kind: 'test',
      sendChallenge: async () => {
        providerStarted();
        await new Promise(resolve => {
          releaseProvider = resolve;
        });
        providerCompleted = true;
        return {
          challengeId: 'ignored-abort-provider-id',
          expiresInSeconds: 300,
        };
      },
      verifyChallenge: async () => undefined,
    },
    store: authStore,
    tokenSecret: 'ignored-abort-token-secret',
  });
  const accountKey = service.deriveAccountKey(PHONE);
  authState.accountDeletions.set(accountKey, {
    ...taskFixture({accountKey}),
    phone_rate_key: `phone:${crypto
      .createHmac('sha256', indexSecret)
      .update(`rate-phone:${PHONE}`)
      .digest('hex')}`,
  });
  const repository = createMemoryAccountDeletionRepository(
    createMemoryDeletionState(authState),
  );
  const worker = createAccountDeletionWorkerV1({
    now: () => new Date(current),
    randomBytes: size => Buffer.alloc(size, 10),
    repository,
  });

  const requestPromise = service.requestDeletionRecoveryCode({
    body: {phone_number: PHONE},
    clientIp: '203.0.113.132',
  });
  await started;
  await assert.rejects(
    requestPromise,
    error => error.code === 'sms_delivery_failed',
  );
  const [localChallengeId, timedOut] = [...authState.authChallenges.entries()][0];
  assert.equal(timedOut.delivery_status, 'pending');

  const beforeDeadline = await worker.run();
  assert.equal(beforeDeadline.results[0].status, 'retry_finalizing');
  assert.equal(authState.accountDeletions.has(accountKey), true);
  current = new Date(NOW.getTime() + 2000);
  const afterDeadline = await worker.run();
  assert.equal(afterDeadline.completed_count, 1);
  assert.equal(authState.accountDeletions.has(accountKey), false);
  assert.equal(authState.authChallenges.has(localChallengeId), false);

  releaseProvider();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(providerCompleted, true);
  assert.equal(authState.authChallenges.has(localChallengeId), false);
});

test('a crashed pending reservation is reclaimed only after its provider deadline', async () => {
  const authStore = createMemoryAuthStateStore();
  const authState = authStore.snapshotAuth();
  authState.accountDeletions.set(ACCOUNT_KEY, taskFixture());
  authState.authChallenges.set('crashed-local-challenge', {
    challenge_id: 'crashed-local-challenge',
    delivery_deadline_at: '2026-08-01T08:00:01.000Z',
    delivery_status: 'pending',
    phone_number: PHONE,
  });
  const repository = createMemoryAccountDeletionRepository(
    createMemoryDeletionState(authState),
  );
  let current = new Date(NOW);
  const worker = createAccountDeletionWorkerV1({
    now: () => new Date(current),
    randomBytes: size => Buffer.alloc(size, 8),
    repository,
  });

  const first = await worker.run();
  assert.equal(first.results[0].status, 'retry_finalizing');
  assert.equal(authState.accountDeletions.has(ACCOUNT_KEY), true);
  assert.equal(authState.authChallenges.has('crashed-local-challenge'), true);

  current = new Date('2026-08-01T08:00:02.000Z');
  const second = await worker.run();
  assert.equal(second.completed_count, 1);
  assert.equal(authState.accountDeletions.has(ACCOUNT_KEY), false);
  assert.equal(authState.authChallenges.has('crashed-local-challenge'), false);
});

test('claim rejects a replaced T2 task and the report fingerprints only the later exact claim', async () => {
  const authStore = createMemoryAuthStateStore();
  const authState = authStore.snapshotAuth();
  const state = createMemoryDeletionState(authState);
  const repository = createMemoryAccountDeletionRepository(state);
  const t1 = taskFixture();
  const t2 = {
    ...t1,
    deletion_id: 'delete_replacement_task_0002',
    requested_at: '2026-08-01T07:59:30.000Z',
  };
  authState.accountDeletions.set(ACCOUNT_KEY, t1);
  const [listedT1] = await repository.listRunnableTasks({
    limit: 1,
    now: NOW.toISOString(),
  });
  authState.accountDeletions.set(ACCOUNT_KEY, t2);

  const staleClaim = await repository.claimTask({
    accountKey: ACCOUNT_KEY,
    expectedAccountInstanceId: listedT1.account_instance_id,
    expectedDeletionId: listedT1.deletion_id,
    expectedRequestedAt: listedT1.requested_at,
    leaseExpiresAt: '2026-08-01T08:05:00.000Z',
    leaseId: `lease_${'q'.repeat(24)}`,
    now: NOW.toISOString(),
  });
  assert.equal(staleClaim, false);
  assert.equal(authState.accountDeletions.get(ACCOUNT_KEY).deletion_id, t2.deletion_id);
  assert.equal(authState.accountDeletions.get(ACCOUNT_KEY).status, 'queued');

  const worker = createWorker(repository);
  const report = await worker.run();
  assert.equal(report.completed_count, 1);
  assert.equal(
    report.results[0].deletion_fingerprint,
    `sha256:${crypto.createHash('sha256').update(t2.deletion_id).digest('hex')}`,
  );
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
    account_instance_id: `account_${'i'.repeat(24)}`,
    account_key: ACCOUNT_KEY,
    attempt_count: 0,
    deletion_id: 'delete_cloudbase_worker_0001',
    last_attempt_at: null,
    last_failure_code: null,
    lease_expires_at: null,
    lease_id: null,
    origin_session_id: 's'.repeat(24),
    phone_number: PHONE,
    phone_rate_key: PHONE_RATE_KEY,
    requested_at: '2026-08-01T07:59:00.000Z',
    schema_version: 'account-deletion-task.v2',
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

test('CloudBase guarded mutation rejects a stale lease before deleting new data', async () => {
  const db = createFakeCloudBaseDb();
  const tasks = db.collection('softbook_account_deletions');
  await tasks.doc(ACCOUNT_KEY).set(taskFixture());
  const repository = createCloudBaseAccountDeletionRepository(db, {
    accountDeletions: 'softbook_account_deletions',
  });
  const leaseA = `lease_${'a'.repeat(24)}`;
  assert.equal(
    (
      await repository.claimTask({
      accountKey: ACCOUNT_KEY,
      expectedAccountInstanceId: taskFixture().account_instance_id,
      expectedDeletionId: taskFixture().deletion_id,
      expectedRequestedAt: taskFixture().requested_at,
      leaseExpiresAt: '2026-08-01T08:05:00.000Z',
      leaseId: leaseA,
      now: NOW.toISOString(),
      })
    ).status,
    'processing',
  );
  await tasks.doc(ACCOUNT_KEY).remove();
  await db.collection('softbook_auth_sessions').doc('re-registered').set({
    account_key: ACCOUNT_KEY,
    generation: 'new',
  });

  assert.equal(
    await repository.removeWhereIfLease(
      'softbook_auth_sessions',
      {account_key: ACCOUNT_KEY},
      {
        accountInstanceId: `account_${'i'.repeat(24)}`,
        accountKey: ACCOUNT_KEY,
        deletionId: `delete_${ACCOUNT_KEY.slice(0, 16)}`,
        leaseId: leaseA,
        status: 'processing',
      },
    ),
    false,
  );
  assert.equal(
    (await db.collection('softbook_auth_sessions').doc('re-registered').get())
      .data.length,
    1,
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

test('CloudBase selects ready and expired finalizing work without live-lease starvation', async () => {
  const db = createFakeCloudBaseDb();
  const tasks = db.collection('softbook_account_deletions');
  for (let index = 0; index < 120; index += 1) {
    const accountKey = index.toString(16).padStart(64, '0');
    await tasks.doc(accountKey).set({
      ...taskFixture({accountKey}),
      attempt_count: 1,
      last_attempt_at: '2026-08-01T07:50:00.000Z',
      lease_expires_at: '2026-08-01T09:00:00.000Z',
      lease_id: `lease_${String(index).padStart(24, 'l')}`,
      requested_at: '2026-07-01T00:00:00.000Z',
      status: 'finalizing',
    });
  }
  const readyAccount = 'e'.repeat(64);
  const expiredAccount = 'f'.repeat(64);
  await tasks.doc(readyAccount).set({
    ...taskFixture({accountKey: readyAccount}),
    requested_at: '2026-07-02T00:00:00.000Z',
    status: 'finalizing',
  });
  await tasks.doc(expiredAccount).set({
    ...taskFixture({accountKey: expiredAccount}),
    attempt_count: 1,
    last_attempt_at: '2026-08-01T07:50:00.000Z',
    lease_expires_at: '2026-08-01T07:55:00.000Z',
    lease_id: `lease_${'x'.repeat(24)}`,
    requested_at: '2026-07-03T00:00:00.000Z',
    status: 'finalizing',
  });
  const repository = createCloudBaseAccountDeletionRepository(db, {
    accountDeletions: 'softbook_account_deletions',
  });

  const runnable = await repository.listRunnableTasks({
    limit: 2,
    now: NOW.toISOString(),
  });

  assert.deepEqual(
    runnable.map(task => task.account_key),
    [readyAccount, expiredAccount],
  );
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
    account_instance_id: `account_${'i'.repeat(24)}`,
    account_key: accountKey,
    attempt_count: 0,
    deletion_id: `delete_${accountKey.slice(0, 16)}`,
    last_attempt_at: null,
    last_failure_code: null,
    lease_expires_at: null,
    lease_id: null,
    origin_session_id: 's'.repeat(24),
    phone_number: PHONE,
    phone_rate_key: PHONE_RATE_KEY,
    requested_at: '2026-08-01T07:59:00.000Z',
    schema_version: 'account-deletion-task.v2',
    status: 'queued',
  };
}

function createMemoryDeletionState(authState) {
  return {
    ...authState,
    betaEntitlements: new Map(),
    dailyCheckIns: new Map(),
    dailyProgress: new Map(),
    learningEventCursors: new Map(),
    learningEvents: new Map(),
    learningEventSequences: new Map(),
    learningMigrationRevisions: new Map(),
    learningSessions: new Map(),
    learningStates: new Map(),
    memberships: new Map(),
    membershipRevisions: new Map(),
    pilotEntitlements: new Map(),
    pilotRoundContinuations: new Map(),
    spaceActionLineages: new Map(),
    spaceActions: new Map(),
    spaceStateRevisions: new Map(),
    spaceStates: new Map(),
  };
}

function createRepository({
  completeAndReregisterBeforeFirstMutation = false,
  expiredLease = false,
  expiredFinalizingLease = false,
  failOnceCollection = null,
  failOnceWhereCollection = null,
  invalidTask = false,
  loseLeaseBeforeComplete = false,
  missingFinalizingTtl = false,
  stealLeaseAfterFinalizing = false,
} = {}) {
  const calls = [];
  let failed = false;
  let replacedBeforeMutation = false;
  let attempts = expiredLease || expiredFinalizingLease ? 1 : 0;
  const initialFinalizing = expiredFinalizingLease || missingFinalizingTtl;
  let task = {
    account_instance_id: `account_${'i'.repeat(24)}`,
    account_key: invalidTask ? 'invalid' : ACCOUNT_KEY,
    attempt_count: expiredLease || expiredFinalizingLease ? 1 : 0,
    deletion_id: 'delete_account_worker_0001',
    last_attempt_at:
      expiredLease || expiredFinalizingLease || missingFinalizingTtl
        ? '2026-08-01T07:50:00.000Z'
        : null,
    last_failure_code: null,
    lease_expires_at:
      expiredLease || expiredFinalizingLease
        ? '2026-08-01T07:55:00.000Z'
        : null,
    lease_id:
      expiredLease || initialFinalizing ? `lease_${'x'.repeat(24)}` : null,
    origin_session_id: 's'.repeat(24),
    phone_number: PHONE,
    phone_rate_key: PHONE_RATE_KEY,
    requested_at: '2026-08-01T07:59:00.000Z',
    schema_version: 'account-deletion-task.v2',
    status: initialFinalizing
      ? 'finalizing'
      : expiredLease
        ? 'processing'
        : 'queued',
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
    hasReregisteredDocument: () =>
      (filters.get('softbook_auth_sessions') ?? []).some(
        row => row.generation === 'new',
      ),
    hasPhoneChallenge: () =>
      (filters.get(FINAL_CHALLENGE_COLLECTION) ?? []).some(
        row => row.phone_number === PHONE,
      ),
    hasPhoneRateLimit: () =>
      (filters.get(RATE_LIMIT_COLLECTION) ?? []).some(
        row => row.key === PHONE_RATE_KEY,
      ),
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
        task.deletion_id !== input.expectedDeletionId ||
        task.requested_at !== input.expectedRequestedAt ||
        !(
          task.status === 'queued' ||
          (task.status === 'processing' &&
            task.lease_expires_at <= input.now) ||
          (task.status === 'finalizing' &&
            ((task.lease_id === null && task.lease_expires_at === null) ||
              task.lease_expires_at <= input.now))
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
        status: task.status === 'finalizing' ? 'finalizing' : 'processing',
      };
      return structuredClone(task);
    },
    beginFinalizingTask: async input => {
      calls.push(`finalizing:${input.accountKey}:${input.leaseId}`);
      if (
        !task ||
        task.status !== 'processing' ||
        input.leaseId !== task.lease_id
      ) {
        return false;
      }
      task = {...task, status: 'finalizing'};
      if (stealLeaseAfterFinalizing) {
        task = {...task, lease_id: `lease_${'z'.repeat(24)}`};
      }
      return true;
    },
    challengeReservationsQuiescent: async input => {
      calls.push(`quiescent:${input.accountKey}:${input.leaseId}`);
      return Boolean(
        task &&
          task.status === 'finalizing' &&
          input.leaseId === task.lease_id,
      );
    },
    removeWhereIfLease: async (collection, filter, lease) => {
      calls.push(`where:${collection}:${Object.keys(filter)[0]}`);
      if (
        completeAndReregisterBeforeFirstMutation &&
        !replacedBeforeMutation
      ) {
        replacedBeforeMutation = true;
        for (const key of filters.keys()) filters.set(key, []);
        for (const rows of documents.values()) rows.clear();
        task = null;
        filters.get('softbook_auth_sessions').push({
          account_key: ACCOUNT_KEY,
          generation: 'new',
          id: 're-registered-session',
        });
      }
      if (
        !task ||
        task.lease_id !== lease.leaseId ||
        task.status !== lease.status
      ) {
        return false;
      }
      if (collection === failOnceWhereCollection && !failed) {
        failed = true;
        throw new Error('simulated final sweep interruption');
      }
      const rows = filters.get(collection) ?? [];
      filters.set(
        collection,
        rows.filter(row =>
          Object.entries(filter).some(([key, value]) => row[key] !== value),
        ),
      );
      return true;
    },
    removeDocumentIfLease: async (collection, id, lease) => {
      calls.push(`document:${collection}:${id}`);
      if (
        !task ||
        task.lease_id !== lease.leaseId ||
        task.status !== lease.status
      ) {
        return false;
      }
      if (collection === failOnceCollection && !failed) {
        failed = true;
        throw new Error('simulated delete interruption');
      }
      documents.get(collection)?.delete(id);
      return true;
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
        task.status !== 'finalizing' ||
        input.accountKey !== ACCOUNT_KEY ||
        input.leaseId !== task.lease_id
      ) {
        return false;
      }
      task = null;
      return true;
    },
    releaseTask: async input => {
      if (!task || input.leaseId !== task.lease_id) return null;
      const retryStatus =
        task.status === 'finalizing' ? 'retry_finalizing' : 'retry_queued';
      task = {
        ...task,
        last_attempt_at: input.now,
        last_failure_code: input.failureCode,
        lease_expires_at: null,
        lease_id: null,
        status:
          retryStatus === 'retry_finalizing' ? 'finalizing' : 'queued',
      };
      return retryStatus;
    },
  };
}

function createFakeCloudBaseDb() {
  const collections = new Map();

  function collection(name, {transactional = false} = {}) {
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
      doc: id => {
        const erase = async () => {
          documents.delete(id);
        };
        return {
          delete: erase,
          get: async () => ({
            data: documents.has(id)
              ? [{_id: id, ...structuredClone(documents.get(id))}]
              : [],
          }),
          ...(transactional ? {} : {remove: erase}),
          set: async value => {
            documents.set(id, structuredClone(value));
          },
        };
      },
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
      where: filter => {
        if (transactional) {
          throw new Error('CloudBase transactions do not support where().');
        }
        return query(filter);
      },
    };
  }

  return {
    collection: name => collection(name),
    command: {
      lte: value => ({operator: 'lte', value}),
    },
    runTransaction: callback =>
      callback({
        collection: name => collection(name, {transactional: true}),
      }),
    snapshot: () => collections,
  };
}
