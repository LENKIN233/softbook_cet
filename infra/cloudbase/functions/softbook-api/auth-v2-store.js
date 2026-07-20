const crypto = require('node:crypto');

function createMemoryAuthStateStore() {
  const accountDeletions = new Map();
  const authChallenges = new Map();
  const authRateLimits = new Map();
  const authSessions = new Map();

  return {
    kind: 'memory',
    consumeAuthRateLimit: async input => {
      const documentId = `${input.key}:${input.windowStartedAt}`;
      const current = authRateLimits.get(documentId) ?? {
        count: 0,
        expires_at: input.expiresAt,
        key: input.key,
        window_started_at: input.windowStartedAt,
      };

      if (current.count >= input.limit) {
        return false;
      }

      authRateLimits.set(documentId, {...current, count: current.count + 1});
      return true;
    },
    createAuthChallenge: async challenge => {
      authChallenges.set(challenge.challenge_id, clone(challenge));
    },
    markAuthChallengeDelivery: async (challengeId, status, updatedAt) => {
      const challenge = authChallenges.get(challengeId);

      if (challenge) {
        authChallenges.set(challengeId, {
          ...challenge,
          delivery_status: status,
          updated_at: updatedAt,
        });
      }
    },
    verifyAuthChallenge: async input => {
      const challenge = authChallenges.get(input.challengeId);
      const result = verifyChallengeRecord(challenge, input);

      if (result.challenge) {
        authChallenges.set(input.challengeId, result.challenge);
      }

      return {status: result.status};
    },
    createAuthSession: async session => {
      if (accountDeletions.has(session.account_key)) {
        return false;
      }

      authSessions.set(session.session_id, clone(session));
      return true;
    },
    getAuthSession: async sessionId =>
      clone(authSessions.get(sessionId) ?? null),
    rotateAuthSession: async input => {
      const result = rotateSessionRecord(
        authSessions.get(input.sessionId),
        input,
      );

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
    revokeAuthSessionsByAccount: async (accountKey, revokedAt, reason) => {
      for (const [sessionId, session] of authSessions.entries()) {
        if (session.account_key === accountKey) {
          authSessions.set(
            sessionId,
            revokeSessionRecord(session, revokedAt, reason),
          );
        }
      }
    },
    getOrCreateAccountDeletionTask: async task => {
      const existing = accountDeletions.get(task.account_key);

      if (existing) {
        return clone(existing);
      }

      accountDeletions.set(task.account_key, clone(task));
      return clone(task);
    },
    snapshotAuth: () => ({
      accountDeletions,
      authChallenges,
      authRateLimits,
      authSessions,
    }),
  };
}

function createCloudBaseAuthStateStore(db, collections) {
  const names = {
    accountDeletions: collections.accountDeletions,
    authChallenges: collections.authChallenges,
    authRateLimits: collections.authRateLimits,
    authSessions: collections.authSessions,
  };

  return {
    kind: 'cloudbase',
    consumeAuthRateLimit: input =>
      db.runTransaction(async transaction => {
        const collection = transaction.collection(names.authRateLimits);
        const documentId = hashValue(`${input.key}:${input.windowStartedAt}`);
        const current = (await getDocument(collection, documentId)) ?? {
          count: 0,
          expires_at: input.expiresAt,
          key: input.key,
          window_started_at: input.windowStartedAt,
        };

        if (current.count >= input.limit) {
          return false;
        }

        await setDocument(collection, documentId, {
          ...current,
          count: current.count + 1,
          updated_at: input.now,
        });
        return true;
      }),
    createAuthChallenge: challenge =>
      setDocument(
        db.collection(names.authChallenges),
        challenge.challenge_id,
        challenge,
      ),
    markAuthChallengeDelivery: (challengeId, status, updatedAt) =>
      db.runTransaction(async transaction => {
        const collection = transaction.collection(names.authChallenges);
        const challenge = await getDocument(collection, challengeId);

        if (challenge) {
          await setDocument(collection, challengeId, {
            ...challenge,
            delivery_status: status,
            updated_at: updatedAt,
          });
        }
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
    createAuthSession: session =>
      db.runTransaction(async transaction => {
        const deletionCollection = transaction.collection(
          names.accountDeletions,
        );
        const deletion = await getDocument(
          deletionCollection,
          session.account_key,
        );

        if (deletion) {
          return false;
        }

        await setDocument(
          transaction.collection(names.authSessions),
          session.session_id,
          session,
        );
        return true;
      }),
    getAuthSession: sessionId =>
      getDocument(db.collection(names.authSessions), sessionId),
    rotateAuthSession: input =>
      db.runTransaction(async transaction => {
        const collection = transaction.collection(names.authSessions);
        const session = await getDocument(collection, input.sessionId);
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
    revokeAuthSessionsByAccount: async (accountKey, revokedAt, reason) => {
      const collection = db.collection(names.authSessions);
      const result = await collection.where({account_key: accountKey}).get();
      const sessions = normalizeDocuments(result.data);

      await Promise.all(
        sessions.map(session =>
          setDocument(
            collection,
            session.session_id ?? session._id,
            revokeSessionRecord(session, revokedAt, reason),
          ),
        ),
      );
    },
    getOrCreateAccountDeletionTask: task =>
      db.runTransaction(async transaction => {
        const collection = transaction.collection(names.accountDeletions);
        const documentId = task.account_key;
        const existing = await getDocument(collection, documentId);

        if (existing) {
          return existing;
        }

        await setDocument(collection, documentId, task);
        return task;
      }),
  };
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
    const documents = normalizeDocuments(result.data);
    return documents[0] ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (
      message.includes('DOCUMENT_NOT_EXIST') ||
      message.includes('document not exists') ||
      message.includes('not found')
    ) {
      return null;
    }

    throw error;
  }
}

async function setDocument(collection, documentId, value) {
  await collection.doc(documentId).set(stripInternalId(value));
}

function normalizeDocuments(data) {
  if (Array.isArray(data)) {
    return data;
  }

  return data ? [data] : [];
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
