import {randomUUID} from 'node:crypto';

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

const INITIAL_MEMBERSHIP: MembershipEntitlement = {
  currentPeriodEndsAt: null,
  productId: null,
  provider: null,
  renewalState: 'none',
  stage: 'trial_available',
  trialEndsAt: null,
  trialStartedAt: null,
};

export class MemoryProductionRepository implements ProductionRepository {
  private readonly challenges = new Map<string, SmsChallengeRecord>();
  private readonly usersByLookupHash = new Map<string, UserRecord>();
  private readonly sessions = new Map<string, SessionTokens & {revokedAt: Date | null}>();
  private readonly learningEvents = new Map<string, LearningEventInput>();
  private readonly eventIdsByDeviceCursor = new Map<string, string>();
  private readonly deletionJobs = new Map<string, string>();
  private readonly deletionRequestedAt = new Map<string, Date>();
  private readonly manifests = new Map<LearningTrack, ContentManifest>();

  constructor(manifests: ContentManifest[] = []) {
    manifests.forEach(manifest => this.manifests.set(manifest.track, manifest));
  }

  async authenticateAccessToken(
    accessHash: string,
    now: Date,
  ): Promise<SessionPrincipal | null> {
    const session = [...this.sessions.values()].find(
      candidate => candidate.accessHash === accessHash,
    );

    if (
      !session ||
      session.revokedAt ||
      session.accessExpiresAt.getTime() <= now.getTime()
    ) {
      return null;
    }

    return {sessionId: session.id, userId: session.userId};
  }

  async close(): Promise<void> {}

  async createSession(tokens: SessionTokens): Promise<void> {
    this.sessions.set(tokens.id, {...tokens, revokedAt: null});
  }

  async createSmsChallenge(
    challenge: SmsChallengeRecord,
    now: Date,
  ): Promise<void> {
    const active = [...this.challenges.values()].find(
      candidate =>
        candidate.phoneLookupHash === challenge.phoneLookupHash &&
        !candidate.consumedAt &&
        candidate.resendAfter.getTime() > now.getTime(),
    );
    if (active) {
      throw new RepositoryConflictError('sms_resend_limited');
    }

    this.challenges.set(challenge.id, {...challenge});
  }

  async getBootstrapSnapshot(
    userId: string,
    track: LearningTrack,
    dayKey: string,
  ): Promise<BootstrapSnapshot> {
    const dayStart = new Date(`${dayKey}T00:00:00.000+08:00`).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const learningEvents = [...this.learningEvents.entries()]
      .filter(([key, event]) => {
        const [eventUserId] = key.split(':');
        const timestamp = event.clientTimestamp.getTime();
        return (
          eventUserId === userId &&
          event.track === track &&
          timestamp >= dayStart &&
          timestamp < dayEnd
        );
      })
      .map(([, event]) => structuredClone(event));

    return {
      contentManifest: this.manifests.get(track) ?? null,
      dailyProgress: null,
      learningEvents,
      membership: {...INITIAL_MEMBERSHIP},
      spaceStates: [],
    };
  }

  async getOrCreateUser(user: UserRecord): Promise<UserRecord> {
    const existing = this.usersByLookupHash.get(user.phoneLookupHash);
    if (existing) {
      return {
        ...existing,
        deletionRequestedAt: this.deletionRequestedAt.get(existing.id) ?? null,
      };
    }

    this.usersByLookupHash.set(user.phoneLookupHash, {...user});
    return {...user};
  }

  async invalidateSmsChallenge(challengeId: string, now: Date): Promise<void> {
    const challenge = this.challenges.get(challengeId);
    if (challenge) {
      challenge.consumedAt = now;
    }
  }

  async ping(): Promise<void> {}

  async requestAccountDeletion(userId: string, now: Date): Promise<string> {
    const existing = this.deletionJobs.get(userId);
    if (existing) {
      return existing;
    }
    const jobId = randomUUID();
    this.deletionJobs.set(userId, jobId);
    this.deletionRequestedAt.set(userId, now);
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        session.revokedAt = now;
      }
    }
    return jobId;
  }

  async revokeSession(sessionId: string, now: Date): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.revokedAt = now;
    }
  }

  async rotateSession(
    refreshHash: string,
    replacement: SessionTokens,
    now: Date,
  ): Promise<SessionRotationResult> {
    const session = [...this.sessions.values()].find(
      candidate => candidate.refreshHash === refreshHash,
    );
    if (
      !session ||
      session.revokedAt ||
      session.refreshExpiresAt.getTime() <= now.getTime()
    ) {
      return {status: 'invalid'};
    }

    session.revokedAt = now;
    this.sessions.set(replacement.id, {
      ...replacement,
      revokedAt: null,
      userId: session.userId,
    });
    return {
      principal: {sessionId: replacement.id, userId: session.userId},
      status: 'accepted',
    };
  }

  async saveLearningEvents(
    userId: string,
    events: LearningEventInput[],
  ): Promise<{accepted: number; duplicates: number}> {
    const hasUnknownRelease = events.some(event => {
      const manifest = this.manifests.get(event.track);
      return manifest?.releaseId !== event.contentReleaseId;
    });
    if (hasUnknownRelease) {
      throw new RepositoryConflictError('content_release_unavailable');
    }

    let accepted = 0;
    for (const event of events) {
      const key = `${userId}:${event.eventId}`;
      const existing = this.learningEvents.get(key);
      if (existing) {
        if (existing.payloadHash !== event.payloadHash) {
          throw new RepositoryConflictError('idempotency_key_conflict');
        }
        continue;
      }

      const cursorKey = `${userId}:${event.deviceId}:${event.deviceCursor}`;
      const cursorEventId = this.eventIdsByDeviceCursor.get(cursorKey);
      if (cursorEventId && cursorEventId !== event.eventId) {
        throw new RepositoryConflictError('device_cursor_conflict');
      }

      this.learningEvents.set(key, structuredClone(event));
      this.eventIdsByDeviceCursor.set(cursorKey, event.eventId);
      accepted += 1;
    }
    return {accepted, duplicates: events.length - accepted};
  }

  async verifySmsChallenge(
    challengeId: string,
    phoneLookupHash: string,
    codeHash: string,
    now: Date,
  ): Promise<ChallengeVerificationResult> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge || challenge.phoneLookupHash !== phoneLookupHash) {
      return {status: 'not_found'};
    }
    if (challenge.consumedAt) {
      return {status: 'used'};
    }
    if (challenge.expiresAt.getTime() <= now.getTime()) {
      challenge.consumedAt = now;
      return {status: 'expired'};
    }
    if (challenge.codeHash !== codeHash) {
      challenge.attemptsRemaining -= 1;
      if (challenge.attemptsRemaining <= 0) {
        challenge.consumedAt = now;
      }
      return {
        attemptsRemaining: Math.max(0, challenge.attemptsRemaining),
        status: 'invalid',
      };
    }

    challenge.consumedAt = now;
    return {status: 'accepted'};
  }
}
