const crypto = require('node:crypto');

const {
  normalizeCloudBaseDocuments,
} = require('./cloudbase-documents');
const {
  isCloudBaseDocumentMissingError,
} = require('./cloudbase-errors');

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
  'softbook_space_actions',
  'softbook_space_states',
]);
const PHONE_FILTER_COLLECTIONS = Object.freeze([
  'softbook_auth_challenges',
]);
const PHONE_DOCUMENT_COLLECTIONS = Object.freeze([
  'softbook_beta_entitlements',
  'softbook_memberships',
  'softbook_pilot_entitlements',
]);
const RATE_LIMIT_COLLECTION = 'softbook_auth_rate_limits';
const TASK_COLLECTION = 'softbook_account_deletions';
const LEASE_DURATION_MS = 5 * 60 * 1000;

function createAccountDeletionWorkerV1(options) {
  const repository = options.repository;
  const now = options.now ?? (() => new Date());
  if (!repository || typeof repository !== 'object') {
    throw new Error('Account deletion worker requires a repository.');
  }
  for (const method of [
    'claimTask',
    'completeTask',
    'listRunnableTasks',
    'releaseTask',
    'removeDocument',
    'removeWhere',
  ]) {
    if (typeof repository[method] !== 'function') {
      throw new Error(`Account deletion repository is missing ${method}().`);
    }
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
        const leaseExpiresAt = new Date(
          Date.parse(startedAt) + LEASE_DURATION_MS,
        ).toISOString();
        const claimed = await repository.claimTask({
          accountKey: task.account_key,
          leaseExpiresAt,
          now: startedAt,
        });
        if (!claimed) continue;
        try {
          await eraseAccount(task, repository);
          await repository.completeTask(task.account_key);
          results.push(publicResult(task, 'completed'));
        } catch (error) {
          await repository.releaseTask({
            accountKey: task.account_key,
            failureCode: 'account_cleanup_incomplete',
            now: canonicalTimestamp(now()),
          });
          results.push(publicResult(task, 'retry_queued'));
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

async function eraseAccount(task, repository) {
  for (const collection of ACCOUNT_KEY_COLLECTIONS) {
    await repository.removeWhere(collection, {
      account_key: task.account_key,
    });
  }
  for (const collection of PHONE_FILTER_COLLECTIONS) {
    await repository.removeWhere(collection, {
      phone_number: task.phone_number,
    });
  }
  await repository.removeWhere(RATE_LIMIT_COLLECTION, {
    key: task.phone_rate_key,
  });
  for (const collection of PHONE_DOCUMENT_COLLECTIONS) {
    await repository.removeDocument(collection, task.phone_number);
  }
}

function createCloudBaseAccountDeletionRepository(db, collections) {
  const taskCollection = collections.accountDeletions ?? TASK_COLLECTION;
  return {
    listRunnableTasks: async ({limit, now}) => {
      const result = await db.collection(taskCollection).limit(100).get();
      return normalizeCloudBaseDocuments(result.data)
        .filter(
          task =>
            task.status === 'queued' ||
            (task.status === 'processing' &&
              (!isCanonicalIsoTimestamp(task.lease_expires_at) ||
                task.lease_expires_at <= now)),
        )
        .sort((left, right) =>
          String(left.requested_at).localeCompare(String(right.requested_at)),
        )
        .slice(0, limit);
    },
    claimTask: input =>
      db.runTransaction(async transaction => {
        const collection = transaction.collection(taskCollection);
        const task = await getDocument(collection, input.accountKey);
        if (
          !task ||
          !(
            task.status === 'queued' ||
            (task.status === 'processing' &&
              (!isCanonicalIsoTimestamp(task.lease_expires_at) ||
                task.lease_expires_at <= input.now))
          )
        ) {
          return false;
        }
        await setDocument(collection, input.accountKey, {
          ...task,
          attempt_count: (task.attempt_count ?? 0) + 1,
          last_attempt_at: input.now,
          last_failure_code: null,
          lease_expires_at: input.leaseExpiresAt,
          status: 'processing',
        });
        return true;
      }),
    removeWhere: (collection, filter) =>
      removeAllMatching(db.collection(collection), filter),
    removeDocument: (collection, documentId) =>
      removeDocument(db.collection(collection), documentId),
    completeTask: accountKey =>
      removeDocument(db.collection(taskCollection), accountKey),
    releaseTask: input =>
      db.runTransaction(async transaction => {
        const collection = transaction.collection(taskCollection);
        const task = await getDocument(collection, input.accountKey);
        if (!task) return;
        await setDocument(collection, input.accountKey, {
          ...task,
          last_attempt_at: input.now,
          last_failure_code: input.failureCode,
          lease_expires_at: null,
          status: 'queued',
        });
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
    ['softbook_pilot_entitlements', state.pilotEntitlements],
    ['softbook_pilot_round_continuations', state.pilotRoundContinuations],
    ['softbook_space_actions', state.spaceActions],
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
        .filter(
          task =>
            task.status === 'queued' ||
            (task.status === 'processing' &&
              (!isCanonicalIsoTimestamp(task.lease_expires_at) ||
                task.lease_expires_at <= now)),
        )
        .sort((left, right) =>
          String(left.requested_at).localeCompare(String(right.requested_at)),
        )
        .slice(0, limit)
        .map(value => structuredClone(value)),
    claimTask: async input => {
      const task = tasks.get(input.accountKey);
      if (
        !task ||
        !(
          task.status === 'queued' ||
          (task.status === 'processing' &&
            (!isCanonicalIsoTimestamp(task.lease_expires_at) ||
              task.lease_expires_at <= input.now))
        )
      ) {
        return false;
      }
      tasks.set(input.accountKey, {
        ...task,
        attempt_count: (task.attempt_count ?? 0) + 1,
        last_attempt_at: input.now,
        last_failure_code: null,
        lease_expires_at: input.leaseExpiresAt,
        status: 'processing',
      });
      return true;
    },
    removeWhere: async (collection, filter) => {
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
    },
    removeDocument: async (collection, documentId) => {
      collectionMaps.get(collection).delete(documentId);
    },
    completeTask: async accountKey => {
      tasks.delete(accountKey);
    },
    releaseTask: async input => {
      const task = tasks.get(input.accountKey);
      if (!task) return;
      tasks.set(input.accountKey, {
        ...task,
        last_attempt_at: input.now,
        last_failure_code: input.failureCode,
        lease_expires_at: null,
        status: 'queued',
      });
    },
  };
}

async function removeAllMatching(collection, filter) {
  for (let round = 0; round < 1000; round += 1) {
    const before = normalizeCloudBaseDocuments(
      (await collection.where(filter).limit(1).get()).data,
    );
    if (before.length === 0) return;
    await collection.where(filter).remove();
  }
  throw new Error('Account deletion exceeded the bounded removal loop.');
}

async function removeDocument(collection, documentId) {
  try {
    await collection.doc(documentId).remove();
  } catch (error) {
    if (!isCloudBaseDocumentMissingError(error)) throw error;
  }
  if ((await getDocument(collection, documentId)) !== null) {
    throw new Error('Account deletion document removal was not verified.');
  }
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
  if (
    !value ||
    typeof value !== 'object' ||
    !/^[a-f0-9]{64}$/.test(value.account_key ?? '') ||
    !/^delete_[A-Za-z0-9_-]{12,}$/.test(value.deletion_id ?? '') ||
    !/^1\d{10}$/.test(value.phone_number ?? '') ||
    !/^phone:[a-f0-9]{64}$/.test(value.phone_rate_key ?? '') ||
    !isCanonicalIsoTimestamp(value.requested_at) ||
    !['queued', 'processing'].includes(value.status)
  ) {
    throw new Error('Account deletion task is invalid.');
  }
  return structuredClone(value);
}

function publicResult(task, status) {
  return {
    deletion_fingerprint: `sha256:${crypto
      .createHash('sha256')
      .update(task.deletion_id)
      .digest('hex')
      .slice(0, 16)}`,
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

module.exports = {
  ACCOUNT_KEY_COLLECTIONS,
  PHONE_DOCUMENT_COLLECTIONS,
  PHONE_FILTER_COLLECTIONS,
  RATE_LIMIT_COLLECTION,
  createAccountDeletionWorkerV1,
  createCloudBaseAccountDeletionRepository,
  createMemoryAccountDeletionRepository,
};
