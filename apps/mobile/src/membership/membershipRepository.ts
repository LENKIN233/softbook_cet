import {
  MembershipState,
  createInitialMembershipState,
  dismissMembershipRecovery,
  purchaseMembership,
  startMembershipTrial,
} from './localMembership';
import {RemoteHttpError} from '../runtime/remoteHttpError';
import {
  createSoftbookClientHeaders,
  resolveSoftbookClientKind,
  type SoftbookClientKind,
} from '../runtime/remoteClient';

export type MembershipRepositoryMode = 'local' | 'remote';

export type MembershipRemoteConfig = {
  clientKind?: SoftbookClientKind;
  dismissRecoveryEndpoint: string;
  entitlementEndpoint: string;
  headers?: Record<string, string>;
  parsePayload?: (payload: unknown) => MembershipState;
  purchaseEndpoint: string;
};

export type MembershipRepositoryContext = {
  authToken?: string;
  phoneNumber: string;
};

export type MembershipRepositoryResult = {
  acknowledgedAt: string;
  mode: MembershipRepositoryMode;
  state: MembershipState;
};

export type FetchLikeResponse = {
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
};

export type FetchLike = (
  input: string,
  init?: {
    body?: string;
    headers?: Record<string, string>;
    method?: string;
  },
) => Promise<FetchLikeResponse>;

export type MembershipRepository = {
  dismissRecovery: (
    context: MembershipRepositoryContext,
    currentState: MembershipState,
  ) => Promise<MembershipRepositoryResult>;
  loadState: (context: MembershipRepositoryContext) => Promise<MembershipState>;
  purchase: (
    context: MembershipRepositoryContext,
    currentState: MembershipState,
  ) => Promise<MembershipRepositoryResult>;
  startTrial: (
    context: MembershipRepositoryContext,
    currentState: MembershipState,
  ) => Promise<MembershipRepositoryResult>;
};

export type MembershipRepositoryConfig = {
  fetchImpl?: FetchLike;
  mode: MembershipRepositoryMode;
  remoteConfig?: MembershipRemoteConfig;
};

export type SoftbookRemoteMembershipRuntimeConfig = {
  apiKey?: string;
  baseUrl: string;
  clientKind?: SoftbookClientKind;
};

export function createMembershipRepository(
  config: MembershipRepositoryConfig,
): MembershipRepository {
  return {
    dismissRecovery: async (context, currentState) => {
      if (config.mode === 'remote') {
        return runRemoteMembershipMutation(
          config,
          context,
          config.remoteConfig?.dismissRecoveryEndpoint,
        );
      }

      return createLocalMembershipRepositoryResult(
        'local',
        dismissMembershipRecovery(currentState),
      );
    },
    loadState: async context => {
      if (config.mode === 'remote') {
        if (!config.remoteConfig) {
          throw new Error('Remote membership repository requires remoteConfig.');
        }

        const fetchImpl = config.fetchImpl ?? fetch;
        const response = await fetchImpl(config.remoteConfig.entitlementEndpoint, {
          headers: buildRemoteMembershipHeaders(config.remoteConfig, context),
          method: 'GET',
        });

        if (!response.ok) {
          throw new RemoteHttpError(
            `Remote membership entitlement request failed with ${response.status}.`,
            response.status,
          );
        }

        const payload = await response.json();
        const parsePayload =
          config.remoteConfig.parsePayload ?? parseSoftbookRemoteMembershipPayload;

        return parsePayload(payload);
      }

      return createInitialMembershipState();
    },
    purchase: async (context, currentState) => {
      if (config.mode === 'remote') {
        return runRemoteMembershipMutation(
          config,
          context,
          config.remoteConfig?.purchaseEndpoint,
        );
      }

      return createLocalMembershipRepositoryResult(
        'local',
        purchaseMembership(currentState),
      );
    },
    startTrial: async (context, currentState) => {
      if (config.mode === 'remote') {
        throw new Error(
          'Remote membership trials start only from Learning Session.',
        );
      }

      return createLocalMembershipRepositoryResult(
        'local',
        startMembershipTrial(currentState),
      );
    },
  };
}

export function createSoftbookRemoteMembershipConfig(
  config: SoftbookRemoteMembershipRuntimeConfig,
): MembershipRemoteConfig {
  const baseUrl = trimTrailingSlash(config.baseUrl);

  return {
    clientKind: resolveSoftbookClientKind(config.clientKind),
    dismissRecoveryEndpoint: `${baseUrl}/v2/membership/dismiss-recovery`,
    entitlementEndpoint: `${baseUrl}/v2/membership/entitlement`,
    headers: {
      ...createSoftbookClientHeaders(config.clientKind),
      ...(config.apiKey ? {'x-api-key': config.apiKey} : {}),
    },
    purchaseEndpoint: `${baseUrl}/v2/membership/purchase`,
  };
}

export function parseSoftbookRemoteMembershipPayload(
  payload: unknown,
): MembershipState {
  if (!isObject(payload)) {
    throw new Error('Remote membership payload must be an object.');
  }

  if (!isObject(payload.data)) {
    throw new Error('Remote membership payload.data must be an object.');
  }

  if (!isObject(payload.data.entitlement)) {
    throw new Error(
      'Remote membership payload.data.entitlement must be an object.',
    );
  }

  const entitlement = payload.data.entitlement;
  const stage = entitlement.stage;

  if (
    stage !== 'trial_available' &&
    stage !== 'trial' &&
    stage !== 'free' &&
    stage !== 'premium'
  ) {
    throw new Error(
      'Remote membership payload.data.entitlement.stage must be a valid membership stage.',
    );
  }

  const countedEntryCount = entitlement.counted_entry_count;

  if (
    typeof countedEntryCount !== 'number' ||
    !Number.isInteger(countedEntryCount) ||
    countedEntryCount < 0
  ) {
    throw new Error(
      'Remote membership payload.data.entitlement.counted_entry_count must be a non-negative integer.',
    );
  }

  const lastExperienceEndedBy = entitlement.last_experience_ended_by;

  if (
    lastExperienceEndedBy !== null &&
    lastExperienceEndedBy !== 'trial' &&
    lastExperienceEndedBy !== 'premium'
  ) {
    throw new Error(
      'Remote membership payload.data.entitlement.last_experience_ended_by must be trial, premium, or null.',
    );
  }

  const recoveryPromptVisible = entitlement.recovery_prompt_visible;

  if (typeof recoveryPromptVisible !== 'boolean') {
    throw new Error(
      'Remote membership payload.data.entitlement.recovery_prompt_visible must be a boolean.',
    );
  }

  const trialDurationDays = entitlement.trial_duration_days;

  if (
    typeof trialDurationDays !== 'number' ||
    !Number.isInteger(trialDurationDays) ||
    trialDurationDays <= 0
  ) {
    throw new Error(
      'Remote membership payload.data.entitlement.trial_duration_days must be a positive integer.',
    );
  }

  const trialStartedAtEntryCount = entitlement.trial_started_at_entry_count;
  const trialStartedAt = readNullableCanonicalTimestamp(
    entitlement.trial_started_at,
    'trial_started_at',
  );
  const trialExpiresAt = readNullableCanonicalTimestamp(
    entitlement.trial_expires_at,
    'trial_expires_at',
  );
  const trialRemainingSeconds = entitlement.trial_remaining_seconds;

  if (
    trialStartedAtEntryCount !== null &&
    (typeof trialStartedAtEntryCount !== 'number' ||
      !Number.isInteger(trialStartedAtEntryCount) ||
      trialStartedAtEntryCount <= 0)
  ) {
    throw new Error(
      'Remote membership payload.data.entitlement.trial_started_at_entry_count must be a positive integer or null.',
    );
  }

  if (
    typeof trialRemainingSeconds !== 'number' ||
    !Number.isSafeInteger(trialRemainingSeconds) ||
    trialRemainingSeconds < 0 ||
    (trialStartedAt === null) !== (trialExpiresAt === null) ||
    (stage === 'trial' &&
      (trialStartedAt === null ||
        trialExpiresAt === null ||
        trialRemainingSeconds <= 0 ||
        Date.parse(trialExpiresAt) - Date.parse(trialStartedAt) !==
          120 * 60 * 60 * 1000 ||
        trialRemainingSeconds > 432000)) ||
    (stage !== 'trial' && trialRemainingSeconds !== 0)
  ) {
    throw new Error(
      'Remote membership payload.data.entitlement trial clock is invalid.',
    );
  }

  return {
    countedEntryCount,
    lastExperienceEndedBy,
    recoveryPromptVisible,
    stage,
    trialDurationDays,
    trialExpiresAt,
    trialRemainingSeconds,
    trialStartedAt,
    trialStartedAtEntryCount,
  };
}

function buildRemoteMembershipHeaders(
  config: MembershipRemoteConfig,
  context: MembershipRepositoryContext,
) {
  if (!context.authToken) {
    throw new RemoteHttpError(
      'Remote membership repository requires authToken.',
      401,
    );
  }

  return {
    ...createSoftbookClientHeaders(config.clientKind, config.headers),
    'content-type': 'application/json',
    Authorization: `Bearer ${context.authToken}`,
  };
}

async function runRemoteMembershipMutation(
  config: MembershipRepositoryConfig,
  context: MembershipRepositoryContext,
  endpoint: string | undefined,
): Promise<MembershipRepositoryResult> {
  if (!config.remoteConfig || !endpoint) {
    throw new Error('Remote membership repository requires remoteConfig.');
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(endpoint, {
    body: JSON.stringify({}),
    headers: buildRemoteMembershipHeaders(config.remoteConfig, context),
    method: 'POST',
  });

  if (!response.ok) {
    throw new RemoteHttpError(
      `Remote membership mutation failed with ${response.status}.`,
      response.status,
    );
  }

  const payload = await response.json();
  const parsePayload =
    config.remoteConfig.parsePayload ?? parseSoftbookRemoteMembershipPayload;

  return {
    acknowledgedAt: new Date().toISOString(),
    mode: 'remote',
    state: parsePayload(payload),
  };
}

function createLocalMembershipRepositoryResult(
  mode: MembershipRepositoryMode,
  state: MembershipState,
): MembershipRepositoryResult {
  return {
    acknowledgedAt: new Date().toISOString(),
    mode,
    state,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNullableCanonicalTimestamp(value: unknown, contextName: string) {
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(
      `Remote membership payload.data.entitlement.${contextName} must be a canonical UTC timestamp or null.`,
    );
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error(
      `Remote membership payload.data.entitlement.${contextName} must be a canonical UTC timestamp or null.`,
    );
  }
  return value;
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
