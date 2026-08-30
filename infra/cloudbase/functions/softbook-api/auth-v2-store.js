const crypto = require('node:crypto');
const {
  normalizeAccountDeletionTask,
} = require('./account-deletion-worker-v1');
const {
  normalizeCloudBaseDocuments,
} = require('./cloudbase-documents');
const {isCloudBaseDocumentMissingError} = require('./cloudbase-errors');
const {
  accountInstanceMismatchError,
  deriveAccountKey,
  normalizeAccountInstance,
} = require('./account-write-fence');

function createMemoryAuthStateStore(options = {}) {
  const indexSecret = options.indexSecret ?? 'softbook-cloudbase-dev-secret';
  const accountDeletions = new Map();
  const accounts = new Map();
  const authChallenges = new Map();
  const authRateLimits = new Map();
  const authSessions = new Map();

  return {
    kind: 'memory',
    consumeAuthRateLimit: async input => {
      if (input.sharedIp !== true) {
        const deletionStatus = challengeDeletionFenceStatus(
          accountDeletions.get(input.accountKey) ?? null,
          input.allowAccountDeletionPending === true,
          input.accountKey,
          input.phoneNumber,
        );
        if (deletionStatus !== 'accepted') return deletionStatus;
      }

      const documentId = `${input.key}:${input.windowStartedAt}`;
      const current = authRateLimits.get(documentId) ?? {
        count: 0,
        expires_at: input.expiresAt,
        key: input.key,
        window_started_at: input.windowStartedAt,
      };

      if (current.count >= input.limit) {
        return 'rate_limited';
      }

      authRateLimits.set(documentId, {...current, count: current.count + 1});
      return 'accepted';
    },
    createAuthChallenge: async input => {
      const deletionStatus = challengeDeletionFenceStatus(
        accountDeletions.get(input.accountKey) ?? null,
        input.allowAccountDeletionPending === true,
        input.accountKey,
        input.challenge.phone_number,
      );
      if (deletionStatus !== 'accepted') return deletionStatus;

      const account = accounts.get(input.accountKey) ?? null;
      const expectedAccountInstanceId = account === null
        ? null
        : normalizeAccountInstance(account, input.accountKey)
          .account_instance_id;
      if (authChallenges.has(input.challenge.challenge_id)) {
        return 'challenge_id_conflict';
      }
      authChallenges.set(input.challenge.challenge_id, {
        ...clone(input.challenge),
        expected_account_instance_id: expectedAccountInstanceId,
      });
      return 'accepted';
    },
    getAuthChallenge: async challengeId =>
      clone(authChallenges.get(challengeId) ?? null),
    markAuthChallengeDelivery: async input => {
      const challenge = authChallenges.get(input.challengeId);

      if (!deliveryReservationMatches(challenge, input)) return false;

      authChallenges.set(
        input.challengeId,
        completedDeliveryRecord(challenge, input),
      );
      return true;
    },
    verifyAuthChallenge: async input => {
      const challenge = authChallenges.get(input.challengeId);
      const result = verifyChallengeRecord(challenge, input);

      if (result.challenge) {
        authChallenges.set(input.challengeId, result.challenge);
      }

      return {status: result.status};
    },
    verifyAuthChallengeAndCreateSession: async input => {
      const challenge = authChallenges.get(input.challengeId);
      const result = verifyChallengeRecord(challenge, input);
      if (result.status !== 'verified') {
        if (result.challenge) {
          authChallenges.set(input.challengeId, result.challenge);
        }
        return {session: null, status: result.status};
      }
      if (accountDeletions.has(input.accountKey)) {
        return {session: null, status: 'account_deletion_pending'};
      }
      const completion = completeVerifiedRegistration({
        accountCandidate: input.accountCandidate,
        challenge: result.challenge,
        currentAccount: accounts.get(input.accountKey) ?? null,
        session: input.session,
      });
      authChallenges.set(input.challengeId, completion.challenge);
      if (completion.status !== 'verified') {
        return {session: null, status: completion.status};
      }
      accounts.set(input.accountKey, clone(completion.account));
      authSessions.set(
        completion.session.session_id,
        clone(completion.session),
      );
      return {session: clone(completion.session), status: 'verified'};
    },
    getAuthSession: async sessionId =>
      clone(authSessions.get(sessionId) ?? null),
    getAccountDeletionTask: async accountKey =>
      clone(accountDeletions.get(accountKey) ?? null),
    getActiveAuthSession: async (sessionId, checkedAt) => {
      const session = authSessions.get(sessionId);

      if (!session || session.status !== 'active') {
        return null;
      }

      if (accountDeletions.has(session.account_key)) {
        authSessions.set(
          sessionId,
          revokeSessionRecord(
            session,
            checkedAt,
            'account_deletion_requested',
          ),
        );
        return null;
      }

      if (!sessionMatchesCurrentAccount(session, accounts)) {
        authSessions.set(
          sessionId,
          revokeSessionRecord(session, checkedAt, 'account_instance_changed'),
        );
        return null;
      }

      return clone(session);
    },
    rotateAuthSession: async input => {
      const session = authSessions.get(input.sessionId);

      if (session && accountDeletions.has(session.account_key)) {
        const revoked = revokeSessionRecord(
          session,
          input.now,
          'account_deletion_requested',
        );
        authSessions.set(input.sessionId, revoked);
        return {session: clone(revoked), status: 'revoked'};
      }

      if (session && !sessionMatchesCurrentAccount(session, accounts)) {
        const revoked = revokeSessionRecord(
          session,
          input.now,
          'account_instance_changed',
        );
        authSessions.set(input.sessionId, revoked);
        return {session: clone(revoked), status: 'revoked'};
      }

      const result = rotateSessionRecord(session, input);

      if (result.session) {
        authSessions.set(input.sessionId, result.session);
      }

      return clone(result);
    },
    revokeAuthSession: async (sessionId, revokedAt, reason) => {
      const session = authSessions.get(sessionId);

      if (!session) {
        return false;
      }

      authSessions.set(
        sessionId,
        revokeSessionRecord(session, revokedAt, reason),
      );
      return true;
    },
    revokeAuthSessionsByAccount: async (
      accountKey,
      deletionId,
      accountInstanceId,
      revokedAt,
      reason,
    ) => {
      const sessionIds = [...authSessions.entries()]
        .filter(([, session]) =>
          session.account_key === accountKey &&
          session.account_instance_id === accountInstanceId)
        .map(([sessionId]) => sessionId);
      let revokedCount = 0;

      for (const sessionId of sessionIds) {
        if (
          !exactQueuedDeletionTaskMatches(
            accountDeletions.get(accountKey) ?? null,
            accountKey,
            deletionId,
            accountInstanceId,
          )
        ) {
          continue;
        }
        const current = authSessions.get(sessionId);
        if (
          !current ||
          current.account_key !== accountKey ||
          current.account_instance_id !== accountInstanceId ||
          current.status !== 'active'
        ) {
          continue;
        }
        authSessions.set(
          sessionId,
          revokeSessionRecord(current, revokedAt, reason),
        );
        revokedCount += 1;
      }
      return revokedCount;
    },
    getOrCreateAccountDeletionTask: async task => {
      const normalizedTask = normalizeAccountDeletionTask(task);
      const existing = accountDeletions.get(normalizedTask.account_key);

      if (existing) {
        const normalizedExisting = normalizeAccountDeletionTask(existing);
        if (
          normalizedExisting.account_key !== normalizedTask.account_key ||
          normalizedExisting.phone_number !== normalizedTask.phone_number ||
          normalizedExisting.account_instance_id !==
            normalizedTask.account_instance_id ||
          normalizedExisting.origin_session_id !==
            normalizedTask.origin_session_id
        ) {
          throw accountInstanceMismatchError();
        }
        assertDeletionRetryCurrent(
          normalizedExisting,
          accounts,
          authSessions,
          indexSecret,
        );
        return clone(normalizedExisting);
      }

      assertDeletionOriginCurrent(
        normalizedTask,
        accounts,
        authSessions,
        indexSecret,
      );

      accountDeletions.set(
        normalizedTask.account_key,
        clone(normalizedTask),
      );
      return clone(normalizedTask);
    },
    snapshotAuth: () => ({
      accountDeletions,
      accounts,
      authChallenges,
      authRateLimits,
      authSessions,
    }),
  };
}

function createCloudBaseAuthStateStore(db, collections, options = {}) {
  const indexSecret = options.indexSecret ?? 'softbook-cloudbase-dev-secret';
  const names = {
    accountDeletions: collections.accountDeletions,
    accounts: collections.accounts,
    authChallenges: collections.authChallenges,
    authRateLimits: collections.authRateLimits,
    authSessions: collections.authSessions,
  };

  return {
    kind: 'cloudbase',
    consumeAuthRateLimit: input =>
      db.runTransaction(async transaction => {
        if (input.sharedIp !== true) {
          const deletion = await getDocument(
            transaction.collection(names.accountDeletions),
            input.accountKey,
          );
          const deletionStatus = challengeDeletionFenceStatus(
            deletion,
            input.allowAccountDeletionPending === true,
            input.accountKey,
            input.phoneNumber,
          );
          if (deletionStatus !== 'accepted') return deletionStatus;
        }

        const collection = transaction.collection(names.authRateLimits);
        const documentId = hashValue(`${input.key}:${input.windowStartedAt}`);
        const current = (await getDocument(collection, documentId)) ?? {
          count: 0,
          expires_at: input.expiresAt,
          key: input.key,
          window_started_at: input.windowStartedAt,
        };

        if (current.count >= input.limit) {
          return 'rate_limited';
        }

        await setDocument(collection, documentId, {
          ...current,
          count: current.count + 1,
          updated_at: input.now,
        });
        return 'accepted';
      }),
    createAuthChallenge: input =>
      db.runTransaction(async transaction => {
        const deletion = await getDocument(
          transaction.collection(names.accountDeletions),
          input.accountKey,
        );
        const deletionStatus = challengeDeletionFenceStatus(
          deletion,
          input.allowAccountDeletionPending === true,
          input.accountKey,
          input.challenge.phone_number,
        );
        if (deletionStatus !== 'accepted') return deletionStatus;

        const account = await getDocument(
          transaction.collection(names.accounts),
          input.accountKey,
        );
        const expectedAccountInstanceId = account === null
          ? null
          : normalizeAccountInstance(account, input.accountKey)
            .account_instance_id;
        const challengeCollection = transaction.collection(
          names.authChallenges,
        );
        if (
          (await getDocument(
            challengeCollection,
            input.challenge.challenge_id,
          )) !== null
        ) {
          return 'challenge_id_conflict';
        }

        await setDocument(
          challengeCollection,
          input.challenge.challenge_id,
          {
            ...input.challenge,
            expected_account_instance_id: expectedAccountInstanceId,
          },
        );
        return 'accepted';
      }),
    getAuthChallenge: challengeId =>
      getDocument(db.collection(names.authChallenges), challengeId),
    markAuthChallengeDelivery: input =>
      db.runTransaction(async transaction => {
        const collection = transaction.collection(names.authChallenges);
        const challenge = await getDocument(collection, input.challengeId);

        if (!deliveryReservationMatches(challenge, input)) return false;

        await setDocument(
          collection,
          input.challengeId,
          completedDeliveryRecord(challenge, input),
        );
        return true;
      }),
    verifyAuthChallenge: input =>
      db.runTransaction(async transaction => {
        const collection = transaction.collection(names.authChallenges);
        const challenge = await getDocument(collection, input.challengeId);
        const result = verifyChallengeRecord(challenge, input);

        if (result.challenge) {
          await setDocument(collection, input.challengeId, result.challenge);
        }

        return {status: result.status};
      }),
    verifyAuthChallengeAndCreateSession: input =>
      db.runTransaction(async transaction => {
        const challengeCollection = transaction.collection(
          names.authChallenges,
        );
        const challenge = await getDocument(
          challengeCollection,
          input.challengeId,
        );
        const result = verifyChallengeRecord(challenge, input);
        if (result.status !== 'verified') {
          if (result.challenge) {
            await setDocument(
              challengeCollection,
              input.challengeId,
              result.challenge,
            );
          }
          return {session: null, status: result.status};
        }
        const deletionCollection = transaction.collection(
          names.accountDeletions,
        );
        const deletion = await getDocument(
          deletionCollection,
          input.accountKey,
        );

        if (deletion) {
          return {session: null, status: 'account_deletion_pending'};
        }
        const accountsCollection = transaction.collection(names.accounts);
        const completion = completeVerifiedRegistration({
          accountCandidate: input.accountCandidate,
          challenge: result.challenge,
          currentAccount: await getDocument(
            accountsCollection,
            input.accountKey,
          ),
          session: input.session,
        });
        await setDocument(
          challengeCollection,
          input.challengeId,
          completion.challenge,
        );
        if (completion.status !== 'verified') {
          return {session: null, status: completion.status};
        }
        await setDocument(
          accountsCollection,
          input.accountKey,
          completion.account,
        );
        await setDocument(
          transaction.collection(names.authSessions),
          completion.session.session_id,
          completion.session,
        );
        return {session: completion.session, status: 'verified'};
      }),
    getAuthSession: sessionId =>
      getDocument(db.collection(names.authSessions), sessionId),
    getAccountDeletionTask: accountKey =>
      getDocument(db.collection(names.accountDeletions), accountKey),
    getActiveAuthSession: (sessionId, checkedAt) =>
      db.runTransaction(async transaction => {
        const collection = transaction.collection(names.authSessions);
        const session = await getDocument(collection, sessionId);

        if (!session || session.status !== 'active') {
          return null;
        }

        const deletion = await getDocument(
          transaction.collection(names.accountDeletions),
          session.account_key,
        );

        if (!deletion) {
          const account = await getDocument(
            transaction.collection(names.accounts),
            session.account_key,
          );
          if (sessionMatchesAccountDocument(session, account)) {
            return session;
          }
          await setDocument(
            collection,
            sessionId,
            revokeSessionRecord(
              session,
              checkedAt,
              'account_instance_changed',
            ),
          );
          return null;
        }

        await setDocument(
          collection,
          sessionId,
          revokeSessionRecord(
            session,
            checkedAt,
            'account_deletion_requested',
          ),
        );
        return null;
      }),
    rotateAuthSession: input =>
      db.runTransaction(async transaction => {
        const collection = transaction.collection(names.authSessions);
        const session = await getDocument(collection, input.sessionId);

        if (session) {
          const deletion = await getDocument(
            transaction.collection(names.accountDeletions),
            session.account_key,
          );

          if (deletion) {
            const revoked = revokeSessionRecord(
              session,
              input.now,
              'account_deletion_requested',
            );
            await setDocument(collection, input.sessionId, revoked);
            return {session: revoked, status: 'revoked'};
          }
          const account = await getDocument(
            transaction.collection(names.accounts),
            session.account_key,
          );
          if (!sessionMatchesAccountDocument(session, account)) {
            const revoked = revokeSessionRecord(
              session,
              input.now,
              'account_instance_changed',
            );
            await setDocument(collection, input.sessionId, revoked);
            return {session: revoked, status: 'revoked'};
          }
        }

        const result = rotateSessionRecord(session, input);

        if (result.session) {
          await setDocument(collection, input.sessionId, result.session);
        }

        return result;
      }),
    revokeAuthSession: (sessionId, revokedAt, reason) =>
      db.runTransaction(async transaction => {
        const collection = transaction.collection(names.authSessions);
        const session = await getDocument(collection, sessionId);

        if (!session) {
          return false;
        }

        await setDocument(
          collection,
          sessionId,
          revokeSessionRecord(session, revokedAt, reason),
        );
        return true;
      }),
    revokeAuthSessionsByAccount: async (
      accountKey,
      deletionId,
      accountInstanceId,
      revokedAt,
      reason,
    ) => {
      const collection = db.collection(names.authSessions);
      const result = await collection.where({account_key: accountKey}).get();
      const sessions = normalizeCloudBaseDocuments(result.data);
      let revokedCount = 0;

      for (const queriedSession of sessions) {
        const sessionId = queriedSession.session_id ?? queriedSession._id;
        if (typeof sessionId !== 'string' || sessionId.length === 0) continue;
        const revoked = await db.runTransaction(async transaction => {
          const task = await getDocument(
            transaction.collection(names.accountDeletions),
            accountKey,
          );
          if (!exactQueuedDeletionTaskMatches(
            task,
            accountKey,
            deletionId,
            accountInstanceId,
          )) {
            return false;
          }

          const transactionSessions = transaction.collection(
            names.authSessions,
          );
          const current = await getDocument(transactionSessions, sessionId);
          if (
            !current ||
            current.account_key !== accountKey ||
            current.account_instance_id !== accountInstanceId ||
            current.status !== 'active'
          ) {
            return false;
          }
          await setDocument(
            transactionSessions,
            sessionId,
            revokeSessionRecord(current, revokedAt, reason),
          );
          return true;
        });
        if (revoked) revokedCount += 1;
      }
      return revokedCount;
    },
    getOrCreateAccountDeletionTask: task =>
      db.runTransaction(async transaction => {
        const normalizedTask = normalizeAccountDeletionTask(task);
        const collection = transaction.collection(names.accountDeletions);
        const documentId = normalizedTask.account_key;
        const existing = await getDocument(collection, documentId);

        if (existing) {
          const normalizedExisting = normalizeAccountDeletionTask(existing);
          if (
            normalizedExisting.account_key !== normalizedTask.account_key ||
            normalizedExisting.phone_number !== normalizedTask.phone_number ||
            normalizedExisting.account_instance_id !==
              normalizedTask.account_instance_id ||
            normalizedExisting.origin_session_id !==
              normalizedTask.origin_session_id
          ) {
            throw accountInstanceMismatchError();
          }
          const retrySession = await getDocument(
            transaction.collection(names.authSessions),
            normalizedExisting.origin_session_id,
          );
          const retryAccount = await getDocument(
            transaction.collection(names.accounts),
            normalizedExisting.account_key,
          );
          assertDeletionRetryDocuments(
            normalizedExisting,
            retryAccount,
            retrySession,
            indexSecret,
          );
          return normalizedExisting;
        }

        const session = await getDocument(
          transaction.collection(names.authSessions),
          normalizedTask.origin_session_id,
        );
        const account = await getDocument(
          transaction.collection(names.accounts),
          normalizedTask.account_key,
        );
        assertDeletionOriginDocuments(
          normalizedTask,
          account,
          session,
          indexSecret,
        );

        await setDocument(collection, documentId, normalizedTask);
        return normalizedTask;
      }),
  };
}

function completeVerifiedRegistration({
  accountCandidate,
  challenge,
  currentAccount,
  session,
}) {
  const consumedChallenge = clone(challenge);
  if (challenge?.account_key !== session.account_key) {
    return {
      challenge: consumedChallenge,
      session: null,
      status: 'account_instance_changed',
    };
  }
  let normalizedCurrent = null;
  try {
    if (currentAccount !== null && currentAccount !== undefined) {
      normalizedCurrent = normalizeAccountInstance(
        currentAccount,
        session.account_key,
      );
    }
  } catch {
    return {
      challenge: consumedChallenge,
      session: null,
      status: 'account_instance_changed',
    };
  }
  const expected = challenge?.expected_account_instance_id;
  if (
    (expected === null && normalizedCurrent !== null) ||
    (expected !== null &&
      (!normalizedCurrent ||
        normalizedCurrent.account_instance_id !== expected))
  ) {
    return {
      challenge: consumedChallenge,
      session: null,
      status: 'account_instance_changed',
    };
  }
  let account = normalizedCurrent;
  if (account === null) {
    account = normalizeAccountInstance(accountCandidate, session.account_key);
  }
  return {
    account,
    challenge: consumedChallenge,
    session: {
      ...clone(session),
      account_instance_id: account.account_instance_id,
    },
    status: 'verified',
  };
}

function sessionMatchesCurrentAccount(session, accounts) {
  return sessionMatchesAccountDocument(
    session,
    accounts.get(session.account_key) ?? null,
  );
}

function sessionMatchesAccountDocument(session, accountInput) {
  try {
    const account = normalizeAccountInstance(accountInput, session.account_key);
    return (
      typeof session.account_instance_id === 'string' &&
      session.account_instance_id === account.account_instance_id
    );
  } catch {
    return false;
  }
}

function assertDeletionOriginCurrent(
  task,
  accounts,
  authSessions,
  indexSecret,
) {
  assertDeletionOriginDocuments(
    task,
    accounts.get(task.account_key) ?? null,
    authSessions.get(task.origin_session_id) ?? null,
    indexSecret,
  );
}

function assertDeletionRetryCurrent(task, accounts, authSessions, indexSecret) {
  assertDeletionRetryDocuments(
    task,
    accounts.get(task.account_key) ?? null,
    authSessions.get(task.origin_session_id) ?? null,
    indexSecret,
  );
}

function assertDeletionRetryDocuments(task, accountInput, session, indexSecret) {
  let account;
  try {
    account = normalizeAccountInstance(accountInput, task.account_key);
  } catch {
    throw accountInstanceMismatchError();
  }
  if (
    !session ||
    !['active', 'revoked'].includes(session.status) ||
    (session.status === 'revoked' &&
      session.revoked_reason !== 'account_deletion_requested') ||
    session.session_id !== task.origin_session_id ||
    session.account_key !== task.account_key ||
    session.account_instance_id !== task.account_instance_id ||
    session.phone_number !== task.phone_number ||
    account.account_instance_id !== task.account_instance_id ||
    deriveAccountKey(indexSecret, task.phone_number) !== task.account_key
  ) {
    throw accountInstanceMismatchError();
  }
}

function assertDeletionOriginDocuments(
  taskInput,
  accountInput,
  session,
  indexSecret,
) {
  const task = normalizeAccountDeletionTask(taskInput);
  let account;
  try {
    account = normalizeAccountInstance(accountInput, task.account_key);
  } catch {
    throw accountInstanceMismatchError();
  }
  if (
    !session ||
    session.status !== 'active' ||
    session.session_id !== task.origin_session_id ||
    session.account_key !== task.account_key ||
    session.account_instance_id !== task.account_instance_id ||
    session.phone_number !== task.phone_number ||
    account.account_instance_id !== task.account_instance_id ||
    deriveAccountKey(indexSecret, task.phone_number) !== task.account_key ||
    !isSessionActiveAt(session, task.requested_at)
  ) {
    throw accountInstanceMismatchError();
  }
}

function isSessionActiveAt(session, checkedAt) {
  const refreshExpiresAt = Date.parse(session?.refresh_expires_at);
  return (
    session?.status === 'active' &&
    Number.isFinite(refreshExpiresAt) &&
    refreshExpiresAt > Date.parse(checkedAt)
  );
}

function challengeDeletionFenceStatus(
  deletion,
  allowPending,
  accountKey,
  phoneNumber,
) {
  if (deletion === null || deletion === undefined) return 'accepted';
  if (!allowPending) return 'account_deletion_pending';
  if (deletion.status === 'finalizing') {
    return 'account_deletion_finalizing';
  }
  try {
    const task = normalizeAccountDeletionTask(deletion);
    if (
      task.account_key === accountKey &&
      task.phone_number === phoneNumber &&
      (task.status === 'queued' || task.status === 'processing')
    ) {
      return 'accepted';
    }
  } catch {
    return 'account_deletion_state_invalid';
  }
  return 'account_deletion_state_invalid';
}

function exactQueuedDeletionTaskMatches(
  task,
  accountKey,
  deletionId,
  accountInstanceId,
) {
  try {
    const normalized = normalizeAccountDeletionTask(task);
    return (
      normalized.account_key === accountKey &&
      normalized.deletion_id === deletionId &&
      normalized.account_instance_id === accountInstanceId &&
      normalized.status === 'queued'
    );
  } catch {
    return false;
  }
}

function deliveryReservationMatches(challenge, input) {
  return (
    challenge &&
    challenge.challenge_id === input.challengeId &&
    challenge.delivery_reservation_id === input.deliveryReservationId &&
    challenge.delivery_status === 'pending' &&
    challenge.account_key === input.accountKey &&
    challenge.phone_number === input.phoneNumber &&
    challenge.purpose === input.purpose
  );
}

function completedDeliveryRecord(challenge, input) {
  const next = {
    ...clone(challenge),
    delivery_status: input.status,
    updated_at: input.updatedAt,
  };
  if (input.status === 'delivered') {
    if (input.expiresAt !== undefined) next.expires_at = input.expiresAt;
    if (input.providerChallengeId !== undefined) {
      next.provider_challenge_id = input.providerChallengeId;
    }
  }
  return next;
}

function verifyChallengeRecord(challenge, input) {
  if (!challenge) {
    return {challenge: null, status: 'not_found'};
  }

  const next = clone(challenge);

  if (next.delivery_status !== 'delivered') {
    return {challenge: next, status: 'unavailable'};
  }

  if (next.consumed_at) {
    return {challenge: next, status: 'consumed'};
  }

  const expiresAt = Date.parse(next.expires_at);

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.parse(input.now)) {
    return {challenge: next, status: 'expired'};
  }

  if (next.attempts >= input.maxAttempts) {
    return {challenge: next, status: 'locked'};
  }

  if (
    next.purpose !== input.purpose ||
    next.phone_number !== input.phoneNumber ||
    !safeEqual(next.code_digest, input.codeDigest)
  ) {
    next.attempts += 1;
    next.updated_at = input.now;
    return {
      challenge: next,
      status: next.attempts >= input.maxAttempts ? 'locked' : 'invalid',
    };
  }

  next.attempts += 1;
  next.consumed_at = input.now;
  next.updated_at = input.now;
  return {challenge: next, status: 'verified'};
}

function rotateSessionRecord(session, input) {
  if (!session) {
    return {session: null, status: 'not_found'};
  }

  const next = clone(session);

  if (next.status !== 'active') {
    return {session: next, status: 'revoked'};
  }

  const refreshExpiresAt = Date.parse(next.refresh_expires_at);

  if (
    !Number.isFinite(refreshExpiresAt) ||
    refreshExpiresAt <= Date.parse(input.now)
  ) {
    return {
      session: revokeSessionRecord(next, input.now, 'refresh_expired'),
      status: 'expired',
    };
  }

  if (input.currentRefreshRotation < next.refresh_rotation) {
    return {
      session: revokeSessionRecord(next, input.now, 'refresh_token_reuse'),
      status: 'reused',
    };
  }

  if (
    input.currentRefreshRotation !== next.refresh_rotation ||
    !safeEqual(next.refresh_token_hash, input.currentRefreshTokenHash)
  ) {
    return {session: next, status: 'invalid'};
  }

  next.access_expires_at = input.accessExpiresAt;
  next.refresh_rotation = input.nextRefreshRotation;
  next.refresh_token_hash = input.nextRefreshTokenHash;
  next.updated_at = input.now;
  return {session: next, status: 'rotated'};
}

function revokeSessionRecord(session, revokedAt, reason) {
  if (session.status !== 'active') {
    return clone(session);
  }

  return {
    ...clone(session),
    revoked_at: revokedAt,
    revoked_reason: reason,
    status: 'revoked',
    updated_at: revokedAt,
  };
}

async function getDocument(collection, documentId) {
  try {
    const result = await collection.doc(documentId).get();
    const documents = normalizeCloudBaseDocuments(result.data);
    return documents[0] ?? null;
  } catch (error) {
    if (isCloudBaseDocumentMissingError(error)) {
      return null;
    }

    throw error;
  }
}

async function setDocument(collection, documentId, value) {
  await collection.doc(documentId).set(stripInternalId(value));
}

function stripInternalId(value) {
  const cloned = clone(value);
  delete cloned._id;
  return cloned;
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function clone(value) {
  if (value === null || value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  createCloudBaseAuthStateStore,
  createMemoryAuthStateStore,
};
