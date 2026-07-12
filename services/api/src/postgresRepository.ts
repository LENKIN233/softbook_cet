import {randomUUID} from 'node:crypto';

import {Pool, type PoolClient} from 'pg';

import type {
  BootstrapSnapshot,
  ChallengeVerificationResult,
  ContentManifest,
  LearningEventInput,
  LearningTrack,
  MembershipEntitlement,
  ProductionRepository,
  SessionPrincipal,
  SessionRotationResult,
  SessionTokens,
  SmsChallengeRecord,
  UserRecord,
} from './domain.js';
import {RepositoryConflictError} from './errors.js';

export class PostgresProductionRepository implements ProductionRepository {
  constructor(private readonly pool: Pool) {}

  static fromConnectionString(
    connectionString: string,
    ssl: boolean,
  ): PostgresProductionRepository {
    return new PostgresProductionRepository(
      new Pool({
        connectionString,
        max: 20,
        ssl: ssl ? {rejectUnauthorized: true} : false,
      }),
    );
  }

  async authenticateAccessToken(
    accessHash: string,
    now: Date,
  ): Promise<SessionPrincipal | null> {
    const result = await this.pool.query<{
      id: string;
      user_id: string;
    }>(
      `SELECT sessions.id, sessions.user_id
         FROM auth_sessions sessions
         JOIN users ON users.id = sessions.user_id
        WHERE sessions.access_hash = $1
          AND sessions.revoked_at IS NULL
          AND sessions.access_expires_at > $2
          AND users.deletion_requested_at IS NULL`,
      [accessHash, now],
    );
    const row = result.rows[0];
    return row ? {sessionId: row.id, userId: row.user_id} : null;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async createSession(tokens: SessionTokens, now: Date): Promise<void> {
    await this.pool.query(
      `INSERT INTO auth_sessions (
         id, user_id, access_hash, refresh_hash, access_expires_at,
         refresh_expires_at, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        tokens.id,
        tokens.userId,
        tokens.accessHash,
        tokens.refreshHash,
        tokens.accessExpiresAt,
        tokens.refreshExpiresAt,
        now,
      ],
    );
  }

  async createSmsChallenge(
    challenge: SmsChallengeRecord,
    now: Date,
  ): Promise<void> {
    await this.transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        challenge.phoneLookupHash,
      ]);
      const active = await client.query<{resend_after: Date}>(
        `SELECT resend_after
           FROM sms_challenges
          WHERE phone_lookup_hash = $1
            AND consumed_at IS NULL
          ORDER BY created_at DESC
          LIMIT 1`,
        [challenge.phoneLookupHash],
      );
      const resendAfter = active.rows[0]?.resend_after;
      if (resendAfter && resendAfter.getTime() > now.getTime()) {
        throw new RepositoryConflictError('sms_resend_limited');
      }

      await client.query(
        `INSERT INTO sms_challenges (
           id, phone_lookup_hash, code_hash, attempts_remaining, expires_at,
           resend_after, consumed_at, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          challenge.id,
          challenge.phoneLookupHash,
          challenge.codeHash,
          challenge.attemptsRemaining,
          challenge.expiresAt,
          challenge.resendAfter,
          challenge.consumedAt,
          now,
        ],
      );
    });
  }

  async getBootstrapSnapshot(
    userId: string,
    track: LearningTrack,
    dayKey: string,
  ): Promise<BootstrapSnapshot> {
    return this.transaction(async client => {
      await client.query(
        `INSERT INTO membership_entitlements (
           user_id, stage, renewal_state, updated_at
         ) VALUES ($1, 'trial_available', 'none', now())
         ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      );

      const [
        membershipResult,
        progressResult,
        eventsResult,
        spaceResult,
        releaseResult,
      ] = await Promise.all([
        client.query<{
          current_period_ends_at: Date | null;
          product_id: string | null;
          provider: MembershipEntitlement['provider'];
          renewal_state: MembershipEntitlement['renewalState'];
          stage: MembershipEntitlement['stage'];
          trial_ends_at: Date | null;
          trial_started_at: Date | null;
        }>(
          `SELECT stage, trial_started_at, trial_ends_at, provider, product_id,
                  current_period_ends_at, renewal_state
             FROM membership_entitlements
            WHERE user_id = $1`,
          [userId],
        ),
        client.query<{snapshot: Record<string, unknown>}>(
          `SELECT snapshot FROM daily_progress WHERE user_id = $1 AND day_key = $2`,
          [userId, dayKey],
        ),
        client.query<LearningEventRow>(
          `SELECT event_id, card_id, track, phase, interaction_id, answer_grade,
                  used_hint, used_peek, device_id, device_cursor,
                  client_timestamp, content_release_id, payload_hash
             FROM learning_events
            WHERE user_id = $1
              AND track = $2
              AND client_timestamp >= ($3::date AT TIME ZONE 'Asia/Shanghai')
              AND client_timestamp < (
                ($3::date + interval '1 day') AT TIME ZONE 'Asia/Shanghai'
              )
            ORDER BY client_timestamp, device_id, device_cursor`,
          [userId, track, dayKey],
        ),
        client.query<SpaceStateRow>(
          `SELECT card_id, is_favorited, is_sleeping, last_modified_at
             FROM space_states
            WHERE user_id = $1
            ORDER BY card_id`,
          [userId],
        ),
        client.query<ContentReleaseRow>(
          `SELECT releases.id, releases.track, releases.minimum_client_version,
                  releases.parent_release_id, releases.manifest_sha256,
                  releases.signature, releases.signature_key_id,
                  releases.approval_record_sha256,
                  COALESCE(
                    json_agg(
                      json_build_object(
                        'pack_id', packs.id,
                        'box_ref', packs.box_ref,
                        'asset_id', packs.asset_id,
                        'sha256', packs.sha256,
                        'byte_size', packs.byte_size
                      ) ORDER BY packs.box_ref
                    ) FILTER (WHERE packs.id IS NOT NULL),
                    '[]'::json
                  ) AS packs
             FROM content_releases releases
             LEFT JOIN content_packs packs ON packs.release_id = releases.id
            WHERE releases.track = $1 AND releases.status = 'active'
            GROUP BY releases.id`,
          [track],
        ),
      ]);

      const membership = membershipResult.rows[0];
      if (!membership) {
        throw new Error('Membership initialization did not return a row.');
      }

      return {
        contentManifest: mapContentManifest(releaseResult.rows[0]),
        dailyProgress: progressResult.rows[0]?.snapshot ?? null,
        learningEvents: eventsResult.rows.map(mapLearningEvent),
        membership: {
          currentPeriodEndsAt:
            membership.current_period_ends_at?.toISOString() ?? null,
          productId: membership.product_id,
          provider: membership.provider,
          renewalState: membership.renewal_state,
          stage: membership.stage,
          trialEndsAt: membership.trial_ends_at?.toISOString() ?? null,
          trialStartedAt:
            membership.trial_started_at?.toISOString() ?? null,
        },
        spaceStates: spaceResult.rows.map(row => ({
          cardId: row.card_id,
          isFavorited: row.is_favorited,
          isSleeping: row.is_sleeping,
          lastModifiedAt: row.last_modified_at.toISOString(),
        })),
      };
    }, 'REPEATABLE READ');
  }

  async getOrCreateUser(user: UserRecord, now: Date): Promise<UserRecord> {
    const result = await this.pool.query<{
      deletion_requested_at: Date | null;
      id: string;
      phone_ciphertext: string;
      phone_lookup_hash: string;
    }>(
      `INSERT INTO users (
         id, phone_lookup_hash, phone_ciphertext, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT (phone_lookup_hash) DO UPDATE SET updated_at = EXCLUDED.updated_at
       RETURNING id, phone_lookup_hash, phone_ciphertext, deletion_requested_at`,
      [user.id, user.phoneLookupHash, user.phoneCiphertext, now],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('User upsert did not return a row.');
    }
    return {
      deletionRequestedAt: row.deletion_requested_at,
      id: row.id,
      phoneCiphertext: row.phone_ciphertext,
      phoneLookupHash: row.phone_lookup_hash,
    };
  }

  async invalidateSmsChallenge(challengeId: string, now: Date): Promise<void> {
    await this.pool.query(
      `UPDATE sms_challenges
          SET consumed_at = COALESCE(consumed_at, $2)
        WHERE id = $1`,
      [challengeId, now],
    );
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async requestAccountDeletion(userId: string, now: Date): Promise<string> {
    return this.transaction(async client => {
      await client.query(
        `UPDATE users
            SET deletion_requested_at = COALESCE(deletion_requested_at, $2),
                updated_at = $2
          WHERE id = $1`,
        [userId, now],
      );
      await client.query(
        `UPDATE auth_sessions
            SET revoked_at = COALESCE(revoked_at, $2)
          WHERE user_id = $1`,
        [userId, now],
      );
      const result = await client.query<{id: string}>(
        `INSERT INTO account_deletion_jobs (id, user_id, status, requested_at)
         VALUES ($1, $2, 'queued', $3)
         ON CONFLICT (user_id) DO UPDATE
           SET requested_at = LEAST(account_deletion_jobs.requested_at, EXCLUDED.requested_at)
         RETURNING id`,
        [randomUUID(), userId, now],
      );
      const row = result.rows[0];
      if (!row) {
        throw new Error('Account deletion request did not return a job.');
      }
      return row.id;
    });
  }

  async revokeSession(sessionId: string, now: Date): Promise<void> {
    await this.pool.query(
      `UPDATE auth_sessions
          SET revoked_at = COALESCE(revoked_at, $2)
        WHERE id = $1`,
      [sessionId, now],
    );
  }

  async rotateSession(
    refreshHash: string,
    replacement: SessionTokens,
    now: Date,
  ): Promise<SessionRotationResult> {
    return this.transaction(async client => {
      const result = await client.query<{id: string; user_id: string}>(
        `SELECT sessions.id, sessions.user_id
           FROM auth_sessions sessions
           JOIN users ON users.id = sessions.user_id
          WHERE sessions.refresh_hash = $1
            AND sessions.revoked_at IS NULL
            AND sessions.refresh_expires_at > $2
            AND users.deletion_requested_at IS NULL
          FOR UPDATE OF sessions`,
        [refreshHash, now],
      );
      const current = result.rows[0];
      if (!current) {
        return {status: 'invalid'};
      }

      await client.query(
        'UPDATE auth_sessions SET revoked_at = $2 WHERE id = $1',
        [current.id, now],
      );
      await client.query(
        `INSERT INTO auth_sessions (
           id, user_id, access_hash, refresh_hash, access_expires_at,
           refresh_expires_at, created_at, rotated_from
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          replacement.id,
          current.user_id,
          replacement.accessHash,
          replacement.refreshHash,
          replacement.accessExpiresAt,
          replacement.refreshExpiresAt,
          now,
          current.id,
        ],
      );
      return {
        principal: {sessionId: replacement.id, userId: current.user_id},
        status: 'accepted',
      };
    });
  }

  async saveLearningEvents(
    userId: string,
    events: LearningEventInput[],
    receivedAt: Date,
  ): Promise<{accepted: number; duplicates: number}> {
    return this.transaction(async client => {
      const releasePairs = [
        ...new Set(
          events.map(event => `${event.track}:${event.contentReleaseId}`),
        ),
      ];
      for (const pair of releasePairs) {
        const separatorIndex = pair.indexOf(':');
        const track = pair.slice(0, separatorIndex);
        const releaseId = pair.slice(separatorIndex + 1);
        const release = await client.query(
          `SELECT 1
             FROM content_releases
            WHERE id = $1
              AND track = $2
              AND status IN ('active', 'retired')`,
          [releaseId, track],
        );
        if (!release.rowCount) {
          throw new RepositoryConflictError('content_release_unavailable');
        }
      }

      let accepted = 0;
      for (const event of events) {
        let result;
        try {
          result = await client.query(
            `INSERT INTO learning_events (
               user_id, event_id, card_id, track, phase, interaction_id,
               answer_grade, used_hint, used_peek, device_id, device_cursor,
               client_timestamp, server_received_at, content_release_id,
               payload_hash
             ) VALUES (
               $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
               $14, $15
             ) ON CONFLICT (user_id, event_id) DO NOTHING`,
            [
              userId,
              event.eventId,
              event.cardId,
              event.track,
              event.phase,
              event.interactionId,
              event.answerGrade,
              event.usedHint,
              event.usedPeek,
              event.deviceId,
              event.deviceCursor,
              event.clientTimestamp,
              receivedAt,
              event.contentReleaseId,
              event.payloadHash,
            ],
          );
        } catch (error) {
          if (isPostgresUniqueViolation(error)) {
            throw new RepositoryConflictError('device_cursor_conflict');
          }
          throw error;
        }
        if (result.rowCount === 0) {
          const existing = await client.query<{payload_hash: string}>(
            `SELECT payload_hash
               FROM learning_events
              WHERE user_id = $1 AND event_id = $2`,
            [userId, event.eventId],
          );
          if (existing.rows[0]?.payload_hash !== event.payloadHash) {
            throw new RepositoryConflictError('idempotency_key_conflict');
          }
        }
        accepted += result.rowCount ?? 0;
      }
      return {accepted, duplicates: events.length - accepted};
    });
  }

  async verifySmsChallenge(
    challengeId: string,
    phoneLookupHash: string,
    codeHash: string,
    now: Date,
  ): Promise<ChallengeVerificationResult> {
    return this.transaction(async client => {
      const result = await client.query<{
        attempts_remaining: number;
        code_hash: string;
        consumed_at: Date | null;
        expires_at: Date;
        phone_lookup_hash: string;
      }>(
        `SELECT phone_lookup_hash, code_hash, attempts_remaining, expires_at, consumed_at
           FROM sms_challenges
          WHERE id = $1
          FOR UPDATE`,
        [challengeId],
      );
      const challenge = result.rows[0];
      if (!challenge || challenge.phone_lookup_hash !== phoneLookupHash) {
        return {status: 'not_found'};
      }
      if (challenge.consumed_at) {
        return {status: 'used'};
      }
      if (challenge.expires_at.getTime() <= now.getTime()) {
        await client.query(
          'UPDATE sms_challenges SET consumed_at = $2 WHERE id = $1',
          [challengeId, now],
        );
        return {status: 'expired'};
      }
      if (challenge.code_hash !== codeHash) {
        const attemptsRemaining = Math.max(
          0,
          challenge.attempts_remaining - 1,
        );
        await client.query(
          `UPDATE sms_challenges
              SET attempts_remaining = $2,
                  consumed_at = CASE WHEN $2 = 0 THEN $3 ELSE consumed_at END
            WHERE id = $1`,
          [challengeId, attemptsRemaining, now],
        );
        return {attemptsRemaining, status: 'invalid'};
      }

      await client.query(
        'UPDATE sms_challenges SET consumed_at = $2 WHERE id = $1',
        [challengeId, now],
      );
      return {status: 'accepted'};
    });
  }

  private async transaction<T>(
    operation: (client: PoolClient) => Promise<T>,
    isolationLevel: 'READ COMMITTED' | 'REPEATABLE READ' = 'READ COMMITTED',
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

type LearningEventRow = {
  answer_grade: LearningEventInput['answerGrade'];
  card_id: string;
  client_timestamp: Date;
  content_release_id: string;
  device_cursor: string | number;
  device_id: string;
  event_id: string;
  interaction_id: LearningEventInput['interactionId'];
  phase: LearningEventInput['phase'];
  payload_hash: string;
  track: LearningTrack;
  used_hint: boolean;
  used_peek: boolean;
};

type SpaceStateRow = {
  card_id: string;
  is_favorited: boolean;
  is_sleeping: boolean;
  last_modified_at: Date;
};

type ContentReleaseRow = {
  approval_record_sha256: string;
  id: string;
  manifest_sha256: string;
  minimum_client_version: string;
  packs: Array<{
    asset_id: string;
    box_ref: string;
    byte_size: string | number;
    pack_id: string;
    sha256: string;
  }>;
  parent_release_id: string | null;
  signature: string;
  signature_key_id: string;
  track: LearningTrack;
};

function mapLearningEvent(row: LearningEventRow): LearningEventInput {
  return {
    answerGrade: row.answer_grade,
    cardId: row.card_id,
    clientTimestamp: row.client_timestamp,
    contentReleaseId: row.content_release_id,
    deviceCursor: Number(row.device_cursor),
    deviceId: row.device_id,
    eventId: row.event_id,
    interactionId: row.interaction_id,
    phase: row.phase,
    payloadHash: row.payload_hash,
    track: row.track,
    usedHint: row.used_hint,
    usedPeek: row.used_peek,
  };
}

function mapContentManifest(row: ContentReleaseRow | undefined): ContentManifest | null {
  if (!row) {
    return null;
  }
  return {
    approvalRecordSha256: row.approval_record_sha256,
    manifestSha256: row.manifest_sha256,
    minimumClientVersion: row.minimum_client_version,
    packs: row.packs.map(pack => ({
      assetId: pack.asset_id,
      boxRef: pack.box_ref,
      byteSize: Number(pack.byte_size),
      packId: pack.pack_id,
      sha256: pack.sha256,
    })),
    parentReleaseId: row.parent_release_id,
    releaseId: row.id,
    signature: row.signature,
    signatureKeyId: row.signature_key_id,
    track: row.track,
  };
}

function isPostgresUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}
