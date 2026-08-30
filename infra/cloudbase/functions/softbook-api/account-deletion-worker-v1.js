const crypto = require('node:crypto');

const {normalizeCloudBaseDocuments} = require('./cloudbase-documents');
const {isCloudBaseDocumentMissingError} = require('./cloudbase-errors');

const ACCOUNT_KEY_COLLECTIONS = Object.freeze([
  'softbook_auth_sessions',
  'softbook_daily_check_ins',
  'softbook_daily_progress',
  'softbook_learning_event_cursors',
  'softbook_learning_events',
  'softbook_learning_event_sequences',
  'softbook_learning_migration_revisions',
  'softbook_learning_sessions',
  'softbook_learning_states',
  'softbook_pilot_round_continuations',
  'softbook_space_action_lineages',
  'softbook_space_actions',
  'softbook_space_state_revisions',
  'softbook_space_states',
]);
const PHONE_FILTER_COLLECTIONS = Object.freeze([
  'softbook_auth_challenges',
  'softbook_daily_progress',
  'softbook_learning_states',
  'softbook_space_states',
]);
const PHONE_DOCUMENT_COLLECTIONS = Object.freeze([
  'softbook_beta_entitlements',
  'softbook_memberships',
  'softbook_membership_revisions',
  'softbook_pilot_entitlements',
]);
const RATE_LIMIT_COLLECTION = 'softbook_auth_rate_limits';
const FINAL_CHALLENGE_COLLECTION = 'softbook_auth_challenges';
const TASK_COLLECTION = 'softbook_account_deletions';
const LEASE_DURATION_MS = 5 * 60 * 1000;
const TASK_KEYS = Object.freeze([
  'account_key',
  'attempt_count',
  'deletion_id',
  'last_attempt_at',
  'last_failure_code',
  'lease_expires_at',
  'lease_id',
  'phone_number',
  'phone_rate_key',
  'requested_at',
  'schema_version',
  'status',
]);

function createAccountDeletionWorkerV1(options) {
  const repository = options.repository;
  const now = options.now ?? (() => new Date());
  const randomBytes = options.randomBytes ?? crypto.randomBytes;
  if (!repository || typeof repository !== 'object') {
    throw new Error('Account deletion worker requires a repository.');
  }
  for (const method of [
    'claimTask',
    'completeTask',
    'listRunnableTasks',
    'releaseTask',
    'removeDocumentIfLease',
    'removeWhereIfLease',
  ]) {
    if (typeof repository[method] !== 'function') {
      throw new Error(`Account deletion repository is missing ${method}().`);
    }
  }
  if (typeof randomBytes !== 'function') {
    throw new Error('Account deletion worker requires a random source.');
  }

  return {
    run: async ({limit = 10} = {}) => {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
        throw new Error('Account deletion worker limit must be 1..50.');
      }
      const startedAt = canonicalTimestamp(now());
      const tasks = await repository.listRunnableTasks({limit, now: startedAt});
      const results = [];

      for (const taskInput of tasks) {
        const task = normalizeTask(taskInput);
        const leaseId = createLeaseId(randomBytes);
        const leaseExpiresAt = new Date(
          Date.parse(startedAt) + LEASE_DURATION_MS,
        ).toISOString();
        const claimed = await repository.claimTask({
          accountKey: task.account_key,
          leaseExpiresAt,
          leaseId,
          now: startedAt,
        });
        if (!claimed) continue;

        try {
          await eraseAccount(task, repository, leaseId);
          const completed = await repository.completeTask({
            accountKey: task.account_key,
            leaseId,
          });
          results.push(publicResult(task, completed ? 'completed' : 'lease_lost'));
        } catch {
          const released = await repository.releaseTask({
            accountKey: task.account_key,
            failureCode: 'account_cleanup_incomplete',
            leaseId,
            now: canonicalTimestamp(now()),
          });
          results.push(
            publicResult(task, released ? 'retry_queued' : 'lease_lost'),
          );
        }
      }

      return {
        schema_version: 'account-deletion-worker-report.v1',
        attempted_count: results.length,
        completed_count: results.filter(result => result.status === 'completed')
          .length,
        generated_at: canonicalTimestamp(now()),
        results,
      };
    },
  };
}

async function eraseAccount(task, repository, leaseId) {
  const lease = {accountKey: task.account_key, leaseId};
  for (const collection of ACCOUNT_KEY_COLLECTIONS) {
    requireLeaseGuardedMutation(
      await repository.removeWhereIfLease(
        collection,
        {account_key: task.account_key},
        lease,
      ),
    );
  }
  for (const collection of PHONE_FILTER_COLLECTIONS) {
    if (collection === FINAL_CHALLENGE_COLLECTION) continue;
    requireLeaseGuardedMutation(
      await repository.removeWhereIfLease(
        collection,
        {phone_number: task.phone_number},
        lease,
      ),
    );
  }
  requireLeaseGuardedMutation(
    await repository.removeWhereIfLease(
      RATE_LIMIT_COLLECTION,
      {key: task.phone_rate_key},
      lease,
    ),
  );
  for (const collection of PHONE_DOCUMENT_COLLECTIONS) {
    requireLeaseGuardedMutation(
      await repository.removeDocumentIfLease(
        collection,
        task.phone_number,
        lease,
      ),
    );
  }
  requireLeaseGuardedMutation(
    await repository.removeWhereIfLease(
      FINAL_CHALLENGE_COLLECTION,
      {phone_number: task.phone_number},
      lease,
    ),
  );
}

function requireLeaseGuardedMutation(applied) {
  if (applied !== true) {
    throw new Error('Account deletion worker lease was lost before mutation.');
  }
}

function createCloudBaseAccountDeletionRepository(db, collections) {
  const taskCollection = collections.accountDeletions ?? TASK_COLLECTION;
  const mutateDocumentIfLease = (lease, mutation) =>
    db.runTransaction(async transaction => {
      const task = await getDocument(
        transaction.collection(taskCollection),
        lease.accountKey,
      );
      if (!leaseMatches(task, lease.leaseId)) return false;
      await mutation(transaction);
      return true;
    });
  return {
    listRunnableTasks: async ({limit, now}) => {
      if (typeof db.command?.lte !== 'function') {
        throw new Error('Account deletion repository requires db.command.lte().');
      }
      const collection = db.collection(taskCollection);
      const [queuedResult, expiredResult] = await Promise.all([
        collection
          .where({status: 'queued'})
          .orderBy('requested_at', 'asc')
          .limit(limit)
          .get(),
        collection
          .where({
            lease_expires_at: db.command.lte(now),
            status: 'processing',
          })
          .orderBy('requested_at', 'asc')
          .limit(limit)
          .get(),
      ]);
      const byAccount = new Map();
      for (const task of [
        ...normalizeCloudBaseDocuments(queuedResult.data),
        ...normalizeCloudBaseDocuments(expiredResult.data),
      ]) {
        if (isRunnableTask(task, now)) byAccount.set(task.account_key, task);
      }
      return [...byAccount.values()]
        .sort((left, right) =>
          String(left.requested_at).localeCompare(String(right.requested_at)),
        )
        .slice(0, limit);
    },
    claimTask: input =>
      db.runTransaction(async transaction => {
        const collection = transaction.collection(taskCollection);
        const task = await getDocument(collection, input.accountKey);
        if (!task || !isRunnableTask(task, input.now)) return false;
        const normalized = normalizeTask(task);
        await setDocument(collection, input.accountKey, {
          ...normalized,
          attempt_count: normalized.attempt_count + 1,
          last_attempt_at: input.now,
          last_failure_code: null,
          lease_expires_at: input.leaseExpiresAt,
          lease_id: input.leaseId,
          status: 'processing',
        });
        return true;
      }),
    removeWhereIfLease: (collection, filter, lease) =>
      removeAllMatchingIfLease(
        db,
        taskCollection,
        collection,
        filter,
        lease,
      ),
    removeDocumentIfLease: (collection, documentId, lease) =>
      mutateDocumentIfLease(lease, transaction =>
        removeDocument(transaction.collection(collection), documentId),
      ),
    completeTask: async input => {
      const removed = await db.runTransaction(async transaction => {
        const collection = transaction.collection(taskCollection);
        const task = await getDocument(collection, input.accountKey);
        if (!leaseMatches(task, input.leaseId)) return false;
        await deleteDocumentReference(collection.doc(input.accountKey));
        return true;
      });
      if (
        removed &&
        (await getDocument(
          db.collection(taskCollection),
          input.accountKey,
        )) !== null
      ) {
        throw new Error('Account deletion task removal was not verified.');
      }
      return removed;
    },
    releaseTask: input =>
      db.runTransaction(async transaction => {
        const collection = transaction.collection(taskCollection);
        const task = await getDocument(collection, input.accountKey);
        if (!leaseMatches(task, input.leaseId)) return false;
        await setDocument(collection, input.accountKey, {
          ...normalizeTask(task),
          last_attempt_at: input.now,
          last_failure_code: input.failureCode,
          lease_expires_at: null,
          lease_id: null,
          status: 'queued',
        });
        return true;
      }),
  };
}

function createMemoryAccountDeletionRepository(state) {
  const collectionMaps = new Map([
    ['softbook_account_deletions', state.accountDeletions],
    ['softbook_auth_challenges', state.authChallenges],
    ['softbook_auth_rate_limits', state.authRateLimits],
    ['softbook_auth_sessions', state.authSessions],
    ['softbook_beta_entitlements', state.betaEntitlements],
    ['softbook_daily_check_ins', state.dailyCheckIns],
    ['softbook_daily_progress', state.dailyProgress],
    ['softbook_learning_event_cursors', state.learningEventCursors],
    ['softbook_learning_events', state.learningEvents],
    ['softbook_learning_event_sequences', state.learningEventSequences],
    ['softbook_learning_migration_revisions', state.learningMigrationRevisions],
    ['softbook_learning_sessions', state.learningSessions],
    ['softbook_learning_states', state.learningStates],
    ['softbook_memberships', state.memberships],
    ['softbook_membership_revisions', state.membershipRevisions],
    ['softbook_pilot_entitlements', state.pilotEntitlements],
    ['softbook_pilot_round_continuations', state.pilotRoundContinuations],
    ['softbook_space_action_lineages', state.spaceActionLineages],
    ['softbook_space_actions', state.spaceActions],
    ['softbook_space_state_revisions', state.spaceStateRevisions],
    ['softbook_space_states', state.spaceStates],
  ]);
  for (const [collection, map] of collectionMaps) {
    if (!(map instanceof Map)) {
      throw new Error(`Memory deletion state is missing ${collection}.`);
    }
  }
  const tasks = collectionMaps.get(TASK_COLLECTION);
  return {
    listRunnableTasks: async ({limit, now}) =>
      [...tasks.values()]
        .filter(task => isRunnableTask(task, now))
        .sort((left, right) =>
          String(left.requested_at).localeCompare(String(right.requested_at)),
        )
        .slice(0, limit)
        .map(value => structuredClone(value)),
    claimTask: async input => {
      const task = tasks.get(input.accountKey);
      if (!task || !isRunnableTask(task, input.now)) return false;
      const normalized = normalizeTask(task);
      tasks.set(input.accountKey, {
        ...normalized,
        attempt_count: normalized.attempt_count + 1,
        last_attempt_at: input.now,
        last_failure_code: null,
        lease_expires_at: input.leaseExpiresAt,
        lease_id: input.leaseId,
        status: 'processing',
      });
      return true;
    },
    removeWhereIfLease: async (collection, filter, lease) => {
      if (!leaseMatches(tasks.get(lease.accountKey), lease.leaseId)) {
        return false;
      }
      const map = collectionMaps.get(collection);
      for (const [key, value] of map.entries()) {
        if (
          Object.entries(filter).every(
            ([field, expected]) => value?.[field] === expected,
          )
        ) {
          map.delete(key);
        }
      }
      return true;
    },
    removeDocumentIfLease: async (collection, documentId, lease) => {
      if (!leaseMatches(tasks.get(lease.accountKey), lease.leaseId)) {
        return false;
      }
      collectionMaps.get(collection).delete(documentId);
      return true;
    },
    completeTask: async input => {
      const task = tasks.get(input.accountKey);
      if (!leaseMatches(task, input.leaseId)) return false;
      tasks.delete(input.accountKey);
      return true;
    },
    releaseTask: async input => {
      const task = tasks.get(input.accountKey);
      if (!leaseMatches(task, input.leaseId)) return false;
      tasks.set(input.accountKey, {
        ...normalizeTask(task),
        last_attempt_at: input.now,
        last_failure_code: input.failureCode,
        lease_expires_at: null,
        lease_id: null,
        status: 'queued',
      });
      return true;
    },
  };
}

async function removeAllMatchingIfLease(
  db,
  taskCollection,
  collectionName,
  filter,
  lease,
) {
  const collection = db.collection(collectionName);
  for (let round = 0; round < 1000; round += 1) {
    const before = normalizeCloudBaseDocuments(
      (await collection.where(filter).limit(1).get()).data,
    );
    if (before.length === 0) return true;
    const documentId = before[0]?._id;
    if (typeof documentId !== 'string' || documentId.length === 0) {
      throw new Error('Account deletion query returned an invalid document ID.');
    }
    const removed = await db.runTransaction(async transaction => {
      const task = await getDocument(
        transaction.collection(taskCollection),
        lease.accountKey,
      );
      if (!leaseMatches(task, lease.leaseId)) return false;
      const targetCollection = transaction.collection(collectionName);
      const document = await getDocument(targetCollection, documentId);
      if (document === null) return true;
      if (!documentMatches(document, filter)) return true;
      await removeDocument(targetCollection, documentId);
      return true;
    });
    if (!removed) return false;
  }
  throw new Error('Account deletion exceeded the bounded guarded removal loop.');
}

function documentMatches(document, filter) {
  return Object.entries(filter).every(
    ([field, expected]) => document?.[field] === expected,
  );
}

async function removeDocument(collection, documentId) {
  try {
    await deleteDocumentReference(collection.doc(documentId));
  } catch (error) {
    if (!isCloudBaseDocumentMissingError(error)) throw error;
  }
  if ((await getDocument(collection, documentId)) !== null) {
    throw new Error('Account deletion document removal was not verified.');
  }
}

async function deleteDocumentReference(reference) {
  if (typeof reference?.delete === 'function') {
    await reference.delete();
    return;
  }
  if (typeof reference?.remove === 'function') {
    await reference.remove();
    return;
  }
  throw new Error('Account deletion document reference cannot delete.');
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

async function setDocument(collection, documentId, value) {
  const next = structuredClone(value);
  delete next._id;
  await collection.doc(documentId).set(next);
}

function normalizeTask(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('Account deletion task is invalid.');
  }
  const task = {...value};
  delete task._id;
  const keys = Object.keys(task).sort();
  if (
    keys.length !== TASK_KEYS.length ||
    keys.some((key, index) => key !== TASK_KEYS[index]) ||
    !/^[a-f0-9]{64}$/.test(task.account_key ?? '') ||
    !Number.isSafeInteger(task.attempt_count) ||
    task.attempt_count < 0 ||
    !/^delete_[A-Za-z0-9_-]{12,}$/.test(task.deletion_id ?? '') ||
    !nullableTimestamp(task.last_attempt_at) ||
    !nullableFailureCode(task.last_failure_code) ||
    !nullableTimestamp(task.lease_expires_at) ||
    !nullableLeaseId(task.lease_id) ||
    !/^1\d{10}$/.test(task.phone_number ?? '') ||
    !/^phone:[a-f0-9]{64}$/.test(task.phone_rate_key ?? '') ||
    !isCanonicalIsoTimestamp(task.requested_at) ||
    task.schema_version !== 'account-deletion-task.v1' ||
    !['queued', 'processing'].includes(task.status) ||
    (task.status === 'queued' &&
      (task.lease_id !== null || task.lease_expires_at !== null)) ||
    (task.status === 'processing' &&
      (task.lease_id === null || task.lease_expires_at === null))
  ) {
    throw new Error('Account deletion task is invalid.');
  }
  return structuredClone(task);
}

function isRunnableTask(value, now) {
  return (
    value &&
    typeof value === 'object' &&
    (value.status === 'queued' ||
      (value.status === 'processing' &&
        (!isCanonicalIsoTimestamp(value.lease_expires_at) ||
          value.lease_expires_at <= now)))
  );
}

function leaseMatches(task, leaseId) {
  try {
    const normalized = normalizeTask(task);
    return (
      normalized.status === 'processing' && normalized.lease_id === leaseId
    );
  } catch {
    return false;
  }
}

function createLeaseId(randomBytes) {
  const bytes = randomBytes(18);
  if (!Buffer.isBuffer(bytes) || bytes.length !== 18) {
    throw new Error('Account deletion worker lease source is invalid.');
  }
  return `lease_${bytes.toString('base64url')}`;
}

function publicResult(task, status) {
  return {
    deletion_fingerprint: `sha256:${crypto
      .createHash('sha256')
      .update(task.deletion_id)
      .digest('hex')}`,
    status,
  };
}

function canonicalTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('Account deletion worker clock is invalid.');
  }
  return date.toISOString();
}

function isCanonicalIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function nullableTimestamp(value) {
  return value === null || isCanonicalIsoTimestamp(value);
}

function nullableFailureCode(value) {
  return value === null || value === 'account_cleanup_incomplete';
}

function nullableLeaseId(value) {
  return value === null || /^lease_[A-Za-z0-9_-]{24}$/.test(value);
}

module.exports = {
  ACCOUNT_KEY_COLLECTIONS,
  PHONE_DOCUMENT_COLLECTIONS,
  PHONE_FILTER_COLLECTIONS,
  RATE_LIMIT_COLLECTION,
  createAccountDeletionWorkerV1,
  createCloudBaseAccountDeletionRepository,
  createMemoryAccountDeletionRepository,
};
