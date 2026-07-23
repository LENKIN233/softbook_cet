import {RemoteHttpError} from '../runtime/remoteHttpError';
import {
  DEFAULT_REMOTE_REQUEST_TIMEOUT_MS,
  runBoundedRemoteRequest,
  type RemoteRequestLifecycleReason,
} from '../runtime/remoteRequest';

import type {
  AuthChallenge,
  AuthSession,
  RemoteAuthChallenge,
  RemoteAuthSession,
} from './authSession';

export type AuthRepositoryMode = 'local' | 'remote';

export type VerifySmsCodeInput = {
  challenge: AuthChallenge;
  phoneNumber: string;
  smsCode: string;
};

export type AuthRequestCodePayloadParser = (
  payload: unknown,
  expectedPhoneNumber: string,
) => RemoteAuthChallenge;

export type AuthSessionPayloadParser = (
  payload: unknown,
  expectedPhoneNumber: string,
  now: Date,
  expectedSessionId?: string,
) => RemoteAuthSession;

export type AuthRemoteConfig = {
  headers?: Record<string, string>;
  logoutEndpoint: string;
  parseRequestCodePayload?: AuthRequestCodePayloadParser;
  parseSessionPayload?: AuthSessionPayloadParser;
  refreshEndpoint: string;
  requestCodeEndpoint: string;
  verifyCodeEndpoint: string;
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
    signal?: AbortSignal;
  },
) => Promise<FetchLikeResponse>;

export type AuthRepositoryRequestOptions = {
  cancellationReason?: Exclude<RemoteRequestLifecycleReason, 'timeout'>;
  signal?: AbortSignal;
};

export type AuthRepository = {
  logout: (
    session: AuthSession,
    options?: AuthRepositoryRequestOptions,
  ) => Promise<void>;
  refreshSession: (
    session: RemoteAuthSession,
    options?: AuthRepositoryRequestOptions,
  ) => Promise<RemoteAuthSession>;
  requestSmsCode: (phoneNumber: string) => Promise<AuthChallenge>;
  verifySmsCode: (input: VerifySmsCodeInput) => Promise<AuthSession>;
};

export type AuthRepositoryConfig = {
  fetchImpl?: FetchLike;
  mode: AuthRepositoryMode;
  now?: () => Date;
  requestTimeoutMs?: number;
  remoteConfig?: AuthRemoteConfig;
};

export type SoftbookRemoteAuthRuntimeConfig = {
  apiKey?: string;
  baseUrl: string;
};

export function createAuthRepository(
  config: AuthRepositoryConfig,
): AuthRepository {
  const now = config.now ?? (() => new Date());
  const requestTimeoutMs =
    config.requestTimeoutMs ?? DEFAULT_REMOTE_REQUEST_TIMEOUT_MS;
  const runRemoteAuthRequest = <Result>(
    operation: (signal: AbortSignal) => Promise<Result>,
    requestOptions?: AuthRepositoryRequestOptions,
  ) =>
    runBoundedRemoteRequest({
      cancellationSources: requestOptions?.signal
        ? [
            {
              reason:
                requestOptions.cancellationReason ?? 'caller_cancelled',
              signal: requestOptions.signal,
            },
          ]
        : [],
      operation,
      timeoutMs: requestTimeoutMs,
    });

  return {
    async requestSmsCode(phoneNumber) {
      if (config.mode === 'local') {
        return {
          mode: 'local',
          phoneNumber,
        };
      }

      const remoteConfig = requireRemoteConfig(config.remoteConfig);
      return runRemoteAuthRequest(async signal => {
        const response = await (config.fetchImpl ?? fetch)(
          remoteConfig.requestCodeEndpoint,
          {
            body: JSON.stringify({
              phone_number: phoneNumber,
            }),
            headers: createHeaders(remoteConfig),
            method: 'POST',
            signal,
          },
        );

        assertRemoteResponse(response, 'request-code');

        return (
          remoteConfig.parseRequestCodePayload ??
          parseSoftbookRemoteAuthRequestCodePayload
        )(await response.json(), phoneNumber);
      });
    },

    async verifySmsCode(input) {
      assertChallengeMatchesInput(input.challenge, input.phoneNumber);

      if (config.mode === 'local') {
        if (input.challenge.mode !== 'local') {
          throw new Error('Local auth requires a local SMS challenge.');
        }

        return {
          mode: 'local',
          phoneNumber: input.phoneNumber,
        };
      }

      if (input.challenge.mode !== 'remote') {
        throw new Error('Remote auth requires a server SMS challenge.');
      }

      const remoteChallenge = input.challenge;
      const remoteConfig = requireRemoteConfig(config.remoteConfig);
      return runRemoteAuthRequest(async signal => {
        const response = await (config.fetchImpl ?? fetch)(
          remoteConfig.verifyCodeEndpoint,
          {
            body: JSON.stringify({
              challenge_id: remoteChallenge.challengeId,
              phone_number: input.phoneNumber,
              sms_code: input.smsCode,
            }),
            headers: createHeaders(remoteConfig),
            method: 'POST',
            signal,
          },
        );

        assertRemoteResponse(response, 'verify-code');

        return (
          remoteConfig.parseSessionPayload ?? parseSoftbookRemoteAuthSession
        )(await response.json(), input.phoneNumber, now());
      });
    },

    async refreshSession(session, requestOptions) {
      if (config.mode !== 'remote') {
        throw new Error('Local auth sessions cannot be refreshed remotely.');
      }

      const remoteConfig = requireRemoteConfig(config.remoteConfig);
      const requestBody = JSON.stringify({
        refresh_token: session.refreshToken,
      });
      return runRemoteAuthRequest(async signal => {
        const response = await (config.fetchImpl ?? fetch)(
          remoteConfig.refreshEndpoint,
          {
            body: requestBody,
            headers: createHeaders(remoteConfig),
            method: 'POST',
            signal,
          },
        );

        assertRemoteResponse(response, 'refresh');

        return (
          remoteConfig.parseSessionPayload ?? parseSoftbookRemoteAuthSession
        )(
          await response.json(),
          session.phoneNumber,
          now(),
          session.sessionId,
        );
      }, requestOptions);
    },

    async logout(session, requestOptions) {
      if (config.mode === 'local' || session.mode === 'local') {
        return;
      }

      const remoteConfig = requireRemoteConfig(config.remoteConfig);
      await runRemoteAuthRequest(async signal => {
        const response = await (config.fetchImpl ?? fetch)(
          remoteConfig.logoutEndpoint,
          {
            headers: {
              ...createHeaders(remoteConfig),
              Authorization: `${session.tokenType} ${session.accessToken}`,
            },
            method: 'POST',
            signal,
          },
        );

        assertRemoteResponse(response, 'logout');
      }, requestOptions);
    },
  };
}

export function createSoftbookRemoteAuthConfig(
  config: SoftbookRemoteAuthRuntimeConfig,
): AuthRemoteConfig {
  const baseUrl = trimTrailingSlash(config.baseUrl);

  return {
    headers: {
      'x-softbook-client': 'mobile',
      ...(config.apiKey ? {'x-api-key': config.apiKey} : {}),
    },
    logoutEndpoint: `${baseUrl}/v2/auth/logout`,
    refreshEndpoint: `${baseUrl}/v2/auth/refresh`,
    requestCodeEndpoint: `${baseUrl}/v2/auth/request-code`,
    verifyCodeEndpoint: `${baseUrl}/v2/auth/verify-code`,
  };
}

export function parseSoftbookRemoteAuthRequestCodePayload(
  payload: unknown,
  expectedPhoneNumber: string,
): RemoteAuthChallenge {
  const data = requirePayloadData(payload, 'request-code');
  const challengeId = readRequiredString(data.challenge_id, 'challenge_id');
  const expiresAt = readIsoTimestamp(data.expires_at, 'expires_at');
  const retryAfterSeconds = readNonNegativeInteger(
    data.retry_after_seconds,
    'retry_after_seconds',
  );

  return {
    challengeId,
    expiresAt,
    mode: 'remote',
    phoneNumber: expectedPhoneNumber,
    retryAfterSeconds,
  };
}

export function parseSoftbookRemoteAuthSession(
  payload: unknown,
  expectedPhoneNumber: string,
  now: Date,
  expectedSessionId?: string,
): RemoteAuthSession {
  const data = requirePayloadData(payload, 'session');
  const accessToken = readRequiredString(data.access_token, 'access_token');
  const expiresIn = readPositiveInteger(data.expires_in, 'expires_in');
  const phoneNumber = readRequiredString(data.phone_number, 'phone_number');
  const refreshExpiresAt = readIsoTimestamp(
    data.refresh_expires_at,
    'refresh_expires_at',
  );
  const refreshToken = readRequiredString(data.refresh_token, 'refresh_token');
  const sessionId = readRequiredString(data.session_id, 'session_id');
  const tokenType = readRequiredString(data.token_type, 'token_type');

  if (phoneNumber !== expectedPhoneNumber) {
    throw new Error(
      `Remote auth session phone_number must match requested phone number ${expectedPhoneNumber}.`,
    );
  }

  if (expectedSessionId !== undefined && sessionId !== expectedSessionId) {
    throw new Error(
      'Remote auth refresh changed the server session identifier.',
    );
  }

  if (tokenType !== 'Bearer') {
    throw new Error('Remote auth session token_type must be Bearer.');
  }

  if (Date.parse(refreshExpiresAt) <= now.getTime()) {
    throw new Error(
      'Remote auth session refresh_expires_at must be in the future.',
    );
  }

  return {
    accessToken,
    accessTokenExpiresAt: new Date(
      now.getTime() + expiresIn * 1000,
    ).toISOString(),
    mode: 'remote',
    phoneNumber,
    refreshExpiresAt,
    refreshToken,
    sessionId,
    tokenType: 'Bearer',
  };
}

function assertChallengeMatchesInput(
  challenge: AuthChallenge,
  phoneNumber: string,
) {
  if (challenge.phoneNumber !== phoneNumber) {
    throw new Error('SMS challenge does not match the submitted phone number.');
  }
}

function assertRemoteResponse(response: FetchLikeResponse, operation: string) {
  if (!response.ok) {
    throw new RemoteHttpError(
      `Remote auth ${operation} failed with ${response.status}.`,
      response.status,
    );
  }
}

function createHeaders(config: AuthRemoteConfig) {
  return {
    'content-type': 'application/json',
    ...config.headers,
  };
}

function requireRemoteConfig(
  remoteConfig: AuthRemoteConfig | undefined,
): AuthRemoteConfig {
  if (!remoteConfig) {
    throw new Error('Remote auth repository requires remoteConfig.');
  }

  return remoteConfig;
}

function requirePayloadData(
  payload: unknown,
  operation: string,
): Record<string, unknown> {
  if (!isObject(payload) || !isObject(payload.data)) {
    throw new Error(`Remote auth ${operation} payload.data must be an object.`);
  }

  return payload.data;
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Remote auth payload.data.${field} is required.`);
  }

  return value;
}

function readIsoTimestamp(value: unknown, field: string): string {
  const timestamp = readRequiredString(value, field);

  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new Error(
      `Remote auth payload.data.${field} must be an ISO timestamp.`,
    );
  }

  return timestamp;
}

function readNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(
      `Remote auth payload.data.${field} must be a non-negative integer.`,
    );
  }

  return value;
}

function readPositiveInteger(value: unknown, field: string): number {
  const integer = readNonNegativeInteger(value, field);

  if (integer === 0) {
    throw new Error(`Remote auth payload.data.${field} must be positive.`);
  }

  return integer;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
