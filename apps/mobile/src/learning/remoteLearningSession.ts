import type {
  LearningRoundCompletion,
  LearningServerSelection,
  LearningTrack,
} from './model';
import type {
  FetchLike,
  RemoteLearningCardSourceContext,
} from './remoteCardSource';
import { RemoteHttpError } from '../runtime/remoteHttpError';
import {
  createSoftbookClientHeaders,
  resolveSoftbookClientKind,
  type SoftbookClientKind,
} from '../runtime/remoteClient';
import { assertServerDerivedTrialRemainingSeconds } from '../membership/membershipRepository';

const LEARNING_SESSION_SCHEMA_VERSION = 'learning-session.v1';
const CONTENT_VERSION_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SELECTION_ID_PATTERN = /^sel_[A-Za-z0-9_-]{16,128}$/;
const CARD_ID_PATTERN = /^\d{6}$/;
const PILOT_ID_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$/;
const RECEIPT_ID_PATTERN = /^prc_[A-Za-z0-9_-]{43}$/;
const MEMBERSHIP_STAGES = ['trial', 'free', 'premium'] as const;
const SELECTION_PHASES = ['learning', 'review'] as const;
const SELECTION_REASONS = [
  'persisted_cursor',
  'due_review',
  'catalog_new',
] as const;

export type RemoteLearningSessionResponse = {
  access: {
    accessibleCardCount: number;
    mode: 'full' | 'free_subset';
    totalCardCount: number;
  };
  algorithm: {
    id: 'FSRS-6';
    library: 'ts-fsrs';
    libraryVersion: '5.4.1';
    policyVersion: 'softbook-fsrs.v1';
  };
  contentVersion: string;
  generatedAt: string;
  membershipStage: (typeof MEMBERSHIP_STAGES)[number];
  membershipTrialExpiresAt: string | null;
  membershipTrialRemainingSeconds: number;
  membershipTrialStartedAt: string | null;
  nextDueAt: string | null;
  roundCompletion: LearningRoundCompletion | null;
  selection: LearningServerSelection | null;
  sourceId: string;
  track: LearningTrack;
};

export type RemoteLearningSessionConfig = {
  clientKind?: SoftbookClientKind;
  endpoint: string;
  continueEndpoint?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  headers?: Record<string, string>;
  trackQueryParam?: string;
};

export type RemoteLearningRoundAcknowledgement = {
  acknowledgedAt: string;
  completedCount: number;
  contentVersion: string;
  pilotId: string;
  receiptId: string;
  track: 'cet4';
};

export async function continueRemoteLearningRound(
  context: RemoteLearningCardSourceContext,
  track: LearningTrack,
  completion: LearningRoundCompletion,
  config: RemoteLearningSessionConfig,
  fetchImpl: FetchLike,
): Promise<RemoteLearningRoundAcknowledgement> {
  if (!context.authToken) {
    throw new RemoteHttpError('Remote learning round requires authToken.', 401);
  }
  if (track !== 'cet4' || !config.continueEndpoint) {
    throw new Error('Remote learning round continuation is unavailable.');
  }
  const response = await fetchImpl(config.continueEndpoint, {
    method: 'POST',
    headers: {
      ...createSoftbookClientHeaders(config.clientKind, config.headers),
      Accept: 'application/json',
      Authorization: `Bearer ${context.authToken}`,
      'Content-Type': 'application/json',
      ...(config.apiKey
        ? { [config.apiKeyHeader ?? 'x-api-key']: config.apiKey }
        : {}),
    },
    body: JSON.stringify({
      schema_version: 'pilot-round-continue.v1',
      track,
      content_version: completion.contentVersion,
      receipt_id: completion.receiptId,
      completed_count: completion.completedCount,
    }),
  });
  if (!response.ok) {
    throw new RemoteHttpError(
      `Remote learning round request failed with status ${response.status}.`,
      response.status,
    );
  }
  return parseRemoteLearningRoundAcknowledgement(
    await response.json(),
    track,
    completion,
  );
}

export type SoftbookRemoteLearningSessionRuntimeConfig = {
  apiKey?: string;
  baseUrl: string;
  clientKind?: SoftbookClientKind;
};

export async function loadRemoteLearningSession(
  context: RemoteLearningCardSourceContext,
  track: LearningTrack,
  config: RemoteLearningSessionConfig,
  fetchImpl: FetchLike,
): Promise<RemoteLearningSessionResponse> {
  if (!context.authToken) {
    throw new RemoteHttpError(
      'Remote learning session requires authToken.',
      401,
    );
  }

  const response = await fetchImpl(
    appendTrack(config.endpoint, track, config.trackQueryParam),
    {
      method: 'GET',
      headers: {
        ...createSoftbookClientHeaders(config.clientKind, config.headers),
        Accept: 'application/json',
        Authorization: `Bearer ${context.authToken}`,
        ...(config.apiKey
          ? { [config.apiKeyHeader ?? 'x-api-key']: config.apiKey }
          : {}),
      },
    },
  );

  if (!response.ok) {
    throw new RemoteHttpError(
      `Remote learning session request failed with status ${response.status}.`,
      response.status,
    );
  }

  return parseRemoteLearningSessionPayload(await response.json(), track);
}

export function parseRemoteLearningSessionPayload(
  payload: unknown,
  expectedTrack: LearningTrack,
): RemoteLearningSessionResponse {
  const envelope = requireExactObject(payload, ['data'], 'response');
  const data = requireExactObject(
    envelope.data,
    [
      'schema_version',
      'generated_at',
      'track',
      'content_version',
      'source_id',
      'membership_stage',
      'trial_started_at',
      'trial_expires_at',
      'trial_remaining_seconds',
      'algorithm',
      'access',
      'selection',
      'next_due_at',
      'round_completion',
    ],
    'response.data',
  );

  if (data.schema_version !== LEARNING_SESSION_SCHEMA_VERSION) {
    throw new Error(
      `Remote learning session schema must be ${LEARNING_SESSION_SCHEMA_VERSION}.`,
    );
  }

  if (data.track !== expectedTrack) {
    throw new Error(
      `Remote learning session track must match requested track ${expectedTrack}.`,
    );
  }

  const generatedAt = requireRfc3339(
    data.generated_at,
    'response.data.generated_at',
  );
  const contentVersion = requirePattern(
    data.content_version,
    CONTENT_VERSION_PATTERN,
    'response.data.content_version',
  );
  const sourceId = requirePresentString(
    data.source_id,
    'response.data.source_id',
  );
  const membershipStage = requireEnum(
    data.membership_stage,
    MEMBERSHIP_STAGES,
    'response.data.membership_stage',
  );
  const membershipTrialStartedAt = requireNullableRfc3339(
    data.trial_started_at,
    'response.data.trial_started_at',
  );
  const membershipTrialExpiresAt = requireNullableRfc3339(
    data.trial_expires_at,
    'response.data.trial_expires_at',
  );
  const membershipTrialRemainingSeconds = requireNonNegativeSafeInteger(
    data.trial_remaining_seconds,
    'response.data.trial_remaining_seconds',
  );
  if (
    (membershipTrialStartedAt === null) !==
      (membershipTrialExpiresAt === null) ||
    (membershipStage === 'trial' &&
      (membershipTrialStartedAt === null ||
        membershipTrialExpiresAt === null ||
        membershipTrialRemainingSeconds <= 0 ||
        Date.parse(membershipTrialExpiresAt) -
            Date.parse(membershipTrialStartedAt) !==
          120 * 60 * 60 * 1000 ||
        membershipTrialRemainingSeconds > 432000)) ||
    (membershipStage !== 'trial' && membershipTrialRemainingSeconds !== 0)
  ) {
    throw new Error('Remote learning session trial clock is invalid.');
  }
  assertServerDerivedTrialRemainingSeconds(
    {
      stage: membershipStage,
      trialExpiresAt: membershipTrialExpiresAt,
      trialRemainingSeconds: membershipTrialRemainingSeconds,
    },
    generatedAt,
    'Remote learning session',
  );
  const algorithm = parseAlgorithm(data.algorithm);
  const access = parseAccess(data.access);

  if (
    (membershipStage === 'free' && access.mode !== 'free_subset') ||
    (membershipStage !== 'free' && access.mode !== 'full')
  ) {
    throw new Error(
      'Remote learning session membership stage and access mode conflict.',
    );
  }

  const selection = parseSelection(data.selection);
  const nextDueAt =
    data.next_due_at === null
      ? null
      : requireRfc3339(data.next_due_at, 'response.data.next_due_at');
  const roundCompletion = parseRoundCompletion(data.round_completion);

  if (selection !== null && nextDueAt !== null) {
    throw new Error(
      'Remote learning session cannot expose next_due_at with a selection.',
    );
  }
  if (
    roundCompletion !== null &&
    (selection !== null || nextDueAt !== null || expectedTrack !== 'cet4')
  ) {
    throw new Error(
      'Remote learning round completion conflicts with session selection.',
    );
  }
  if (
    roundCompletion !== null &&
    roundCompletion.contentVersion !== contentVersion
  ) {
    throw new Error(
      'Remote learning round completion content version conflicts with session.',
    );
  }

  return {
    access,
    algorithm,
    contentVersion,
    generatedAt,
    membershipStage,
    membershipTrialExpiresAt,
    membershipTrialRemainingSeconds,
    membershipTrialStartedAt,
    nextDueAt,
    roundCompletion,
    selection,
    sourceId,
    track: expectedTrack,
  };
}

function parseRoundCompletion(
  candidate: unknown,
): LearningRoundCompletion | null {
  if (candidate === null) return null;
  const receipt = requireExactObject(
    candidate,
    [
      'schema_version',
      'pilot_id',
      'content_version',
      'receipt_id',
      'completed_count',
      'space_card_id',
      'review_card_ids',
    ],
    'response.data.round_completion',
  );
  if (receipt.schema_version !== 'pilot-round-completion.v1') {
    throw new Error('Remote learning round completion schema is invalid.');
  }
  const reviewCardIds = requireUniqueCardIds(
    receipt.review_card_ids,
    'response.data.round_completion.review_card_ids',
  );
  return {
    completedCount: requirePositiveSafeInteger(
      receipt.completed_count,
      'response.data.round_completion.completed_count',
    ),
    contentVersion: requirePattern(
      receipt.content_version,
      CONTENT_VERSION_PATTERN,
      'response.data.round_completion.content_version',
    ),
    pilotId: requirePattern(
      receipt.pilot_id,
      PILOT_ID_PATTERN,
      'response.data.round_completion.pilot_id',
    ),
    receiptId: requirePattern(
      receipt.receipt_id,
      RECEIPT_ID_PATTERN,
      'response.data.round_completion.receipt_id',
    ),
    reviewCardIds,
    spaceCardId: requirePattern(
      receipt.space_card_id,
      CARD_ID_PATTERN,
      'response.data.round_completion.space_card_id',
    ),
  };
}

function requireUniqueCardIds(candidate: unknown, contextName: string) {
  if (!Array.isArray(candidate)) {
    throw new Error(`${contextName} must be an array.`);
  }
  const values = candidate.map((value, index) =>
    requirePattern(value, CARD_ID_PATTERN, `${contextName}[${index}]`),
  );
  if (new Set(values).size !== values.length) {
    throw new Error(`${contextName} must contain unique card IDs.`);
  }
  return values;
}

export function createSoftbookRemoteLearningSessionConfig(
  config: SoftbookRemoteLearningSessionRuntimeConfig,
): RemoteLearningSessionConfig {
  return {
    clientKind: resolveSoftbookClientKind(config.clientKind),
    endpoint: `${trimTrailingSlash(config.baseUrl)}/v2/learning/session`,
    continueEndpoint: `${trimTrailingSlash(
      config.baseUrl,
    )}/v2/learning/round/continue`,
    apiKey: config.apiKey,
    headers: {
      ...createSoftbookClientHeaders(config.clientKind),
    },
    trackQueryParam: 'track',
  };
}

function parseRemoteLearningRoundAcknowledgement(
  payload: unknown,
  expectedTrack: 'cet4',
  expected: LearningRoundCompletion,
): RemoteLearningRoundAcknowledgement {
  const envelope = requireExactObject(payload, ['data'], 'response');
  const data = requireExactObject(
    envelope.data,
    [
      'schema_version',
      'pilot_id',
      'track',
      'content_version',
      'receipt_id',
      'completed_count',
      'acknowledged_at',
    ],
    'response.data',
  );
  if (
    data.schema_version !== 'pilot-round-continue-ack.v1' ||
    data.track !== expectedTrack ||
    data.pilot_id !== expected.pilotId ||
    data.content_version !== expected.contentVersion ||
    data.receipt_id !== expected.receiptId ||
    data.completed_count !== expected.completedCount
  ) {
    throw new Error(
      'Remote learning round acknowledgement drifted from its command.',
    );
  }
  return {
    acknowledgedAt: requireRfc3339(
      data.acknowledged_at,
      'response.data.acknowledged_at',
    ),
    completedCount: expected.completedCount,
    contentVersion: expected.contentVersion,
    pilotId: expected.pilotId,
    receiptId: expected.receiptId,
    track: expectedTrack,
  };
}

function parseAlgorithm(candidate: unknown) {
  const algorithm = requireExactObject(
    candidate,
    ['id', 'library', 'library_version', 'policy_version'],
    'response.data.algorithm',
  );

  if (
    algorithm.id !== 'FSRS-6' ||
    algorithm.library !== 'ts-fsrs' ||
    algorithm.library_version !== '5.4.1' ||
    algorithm.policy_version !== 'softbook-fsrs.v1'
  ) {
    throw new Error(
      'Remote learning session uses an unsupported scheduler version.',
    );
  }

  return {
    id: 'FSRS-6' as const,
    library: 'ts-fsrs' as const,
    libraryVersion: '5.4.1' as const,
    policyVersion: 'softbook-fsrs.v1' as const,
  };
}

function parseAccess(candidate: unknown) {
  const access = requireExactObject(
    candidate,
    ['mode', 'accessible_card_count', 'total_card_count'],
    'response.data.access',
  );
  const mode = requireEnum(
    access.mode,
    ['full', 'free_subset'] as const,
    'response.data.access.mode',
  );
  const accessibleCardCount = requireNonNegativeSafeInteger(
    access.accessible_card_count,
    'response.data.access.accessible_card_count',
  );
  const totalCardCount = requirePositiveSafeInteger(
    access.total_card_count,
    'response.data.access.total_card_count',
  );
  const expectedAccessibleCount =
    mode === 'full' ? totalCardCount : Math.ceil(totalCardCount / 2);

  if (accessibleCardCount !== expectedAccessibleCount) {
    throw new Error(
      'Remote learning session access counts do not match access mode.',
    );
  }

  return { accessibleCardCount, mode, totalCardCount };
}

function parseSelection(candidate: unknown): LearningServerSelection | null {
  if (candidate === null) {
    return null;
  }

  const selection = requireExactObject(
    candidate,
    ['selection_id', 'card_id', 'phase', 'reason', 'due_at'],
    'response.data.selection',
  );
  const selectionId = requirePattern(
    selection.selection_id,
    SELECTION_ID_PATTERN,
    'response.data.selection.selection_id',
  );
  const cardId = requirePattern(
    selection.card_id,
    CARD_ID_PATTERN,
    'response.data.selection.card_id',
  );
  const phase = requireEnum(
    selection.phase,
    SELECTION_PHASES,
    'response.data.selection.phase',
  );
  const reason = requireEnum(
    selection.reason,
    SELECTION_REASONS,
    'response.data.selection.reason',
  );
  const dueAt =
    selection.due_at === null
      ? null
      : requireRfc3339(selection.due_at, 'response.data.selection.due_at');

  if (
    (reason === 'catalog_new' && (phase !== 'learning' || dueAt !== null)) ||
    (reason === 'due_review' && (phase !== 'review' || dueAt === null)) ||
    (reason === 'persisted_cursor' &&
      ((phase === 'learning' && dueAt !== null) ||
        (phase === 'review' && dueAt === null)))
  ) {
    throw new Error(
      'Remote learning session selection phase, reason, and due time conflict.',
    );
  }

  return { cardId, dueAt, phase, reason, selectionId };
}

function appendTrack(
  endpoint: string,
  track: LearningTrack,
  trackQueryParam = 'track',
) {
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}${trackQueryParam}=${track}`;
}

function requireExactObject(
  candidate: unknown,
  expectedFields: readonly string[],
  contextName: string,
): Record<string, unknown> {
  if (!isObject(candidate)) {
    throw new Error(`${contextName} must be an object.`);
  }

  const fields = Object.keys(candidate);
  if (
    fields.length !== expectedFields.length ||
    expectedFields.some(field => !fields.includes(field))
  ) {
    throw new Error(`${contextName} must contain only its documented fields.`);
  }

  return candidate;
}

function requireEnum<const Value extends string>(
  candidate: unknown,
  values: readonly Value[],
  contextName: string,
): Value {
  if (typeof candidate !== 'string' || !values.includes(candidate as Value)) {
    throw new Error(`${contextName} is invalid.`);
  }
  return candidate as Value;
}

function requirePresentString(candidate: unknown, contextName: string) {
  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    throw new Error(`${contextName} is required.`);
  }
  return candidate;
}

function requirePattern(
  candidate: unknown,
  pattern: RegExp,
  contextName: string,
) {
  if (typeof candidate !== 'string' || !pattern.test(candidate)) {
    throw new Error(`${contextName} is invalid.`);
  }
  return candidate;
}

function requireRfc3339(candidate: unknown, contextName: string) {
  if (
    typeof candidate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      candidate,
    ) ||
    !Number.isFinite(Date.parse(candidate))
  ) {
    throw new Error(`${contextName} must be an RFC3339 instant.`);
  }
  return candidate;
}

function requireNullableRfc3339(candidate: unknown, contextName: string) {
  return candidate === null ? null : requireRfc3339(candidate, contextName);
}

function requireNonNegativeSafeInteger(
  candidate: unknown,
  contextName: string,
) {
  if (!Number.isSafeInteger(candidate) || (candidate as number) < 0) {
    throw new Error(`${contextName} must be a non-negative safe integer.`);
  }
  return candidate as number;
}

function requirePositiveSafeInteger(candidate: unknown, contextName: string) {
  const value = requireNonNegativeSafeInteger(candidate, contextName);
  if (value === 0) {
    throw new Error(`${contextName} must be positive.`);
  }
  return value;
}

function isObject(candidate: unknown): candidate is Record<string, unknown> {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    !Array.isArray(candidate)
  );
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
