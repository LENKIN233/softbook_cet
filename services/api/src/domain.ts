export type LearningTrack = 'cet4' | 'cet6';

export type SmsChallengeRecord = {
  attemptsRemaining: number;
  codeHash: string;
  consumedAt: Date | null;
  expiresAt: Date;
  id: string;
  phoneLookupHash: string;
  resendAfter: Date;
};

export type UserRecord = {
  deletionRequestedAt: Date | null;
  id: string;
  phoneCiphertext: string;
  phoneLookupHash: string;
};

export type SessionPrincipal = {
  sessionId: string;
  userId: string;
};

export type SessionTokens = {
  accessExpiresAt: Date;
  accessHash: string;
  id: string;
  refreshExpiresAt: Date;
  refreshHash: string;
  userId: string;
};

export type LearningEventInput = {
  answerGrade: 'again' | 'hard' | 'good' | 'easy';
  cardId: string;
  clientTimestamp: Date;
  contentReleaseId: string;
  deviceCursor: number;
  deviceId: string;
  eventId: string;
  interactionId:
    | 'flip'
    | 'multiple_choice'
    | 'lock'
    | 'elimination'
    | 'swipe';
  phase: 'learning' | 'review';
  payloadHash: string;
  track: LearningTrack;
  usedHint: boolean;
  usedPeek: boolean;
};

export type MembershipEntitlement = {
  currentPeriodEndsAt: string | null;
  productId: string | null;
  provider: 'apple' | 'wechat' | 'alipay' | 'channel' | null;
  renewalState: 'none' | 'active' | 'grace' | 'cancelled' | 'refunded';
  stage: 'trial_available' | 'trial' | 'free' | 'premium';
  trialEndsAt: string | null;
  trialStartedAt: string | null;
};

export type ContentPack = {
  assetId: string;
  boxRef: string;
  byteSize: number;
  packId: string;
  sha256: string;
};

export type ContentManifest = {
  approvalRecordSha256: string;
  manifestSha256: string;
  minimumClientVersion: string;
  packs: ContentPack[];
  parentReleaseId: string | null;
  releaseId: string;
  signature: string;
  signatureKeyId: string;
  track: LearningTrack;
};

export type BootstrapSnapshot = {
  contentManifest: ContentManifest | null;
  dailyProgress: Record<string, unknown> | null;
  learningEvents: LearningEventInput[];
  membership: MembershipEntitlement;
  spaceStates: Array<{
    cardId: string;
    isFavorited: boolean;
    isSleeping: boolean;
    lastModifiedAt: string;
  }>;
};

export type ChallengeVerificationResult =
  | {status: 'accepted'}
  | {status: 'expired'}
  | {status: 'invalid'; attemptsRemaining: number}
  | {status: 'not_found'}
  | {status: 'used'};

export type SessionRotationResult =
  | {status: 'accepted'; principal: SessionPrincipal}
  | {status: 'invalid'};

export interface ProductionRepository {
  authenticateAccessToken(accessHash: string, now: Date): Promise<SessionPrincipal | null>;
  close(): Promise<void>;
  createSession(tokens: SessionTokens, now: Date): Promise<void>;
  createSmsChallenge(challenge: SmsChallengeRecord, now: Date): Promise<void>;
  getBootstrapSnapshot(
    userId: string,
    track: LearningTrack,
    dayKey: string,
  ): Promise<BootstrapSnapshot>;
  getOrCreateUser(user: UserRecord, now: Date): Promise<UserRecord>;
  invalidateSmsChallenge(challengeId: string, now: Date): Promise<void>;
  ping(): Promise<void>;
  requestAccountDeletion(userId: string, now: Date): Promise<string>;
  revokeSession(sessionId: string, now: Date): Promise<void>;
  rotateSession(
    refreshHash: string,
    replacement: SessionTokens,
    now: Date,
  ): Promise<SessionRotationResult>;
  saveLearningEvents(
    userId: string,
    events: LearningEventInput[],
    receivedAt: Date,
  ): Promise<{accepted: number; duplicates: number}>;
  verifySmsChallenge(
    challengeId: string,
    phoneLookupHash: string,
    codeHash: string,
    now: Date,
  ): Promise<ChallengeVerificationResult>;
}

export interface SmsProvider {
  readonly kind: 'development' | 'tencent';
  sendCode(phoneNumber: string, code: string): Promise<void>;
}
