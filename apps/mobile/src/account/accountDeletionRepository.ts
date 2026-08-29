import {RemoteHttpError} from '../runtime/remoteHttpError';
import {
  DEFAULT_REMOTE_REQUEST_TIMEOUT_MS,
  runBoundedRemoteRequest,
} from '../runtime/remoteRequest';

export type AccountDeletionRequest = {
  id: string;
  requestedAt: string;
  status: 'processing' | 'queued';
};

export type AccountDeletionFetchResponse = {
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
};

export type AccountDeletionFetch = (
  input: string,
  init?: {
    body?: string;
    headers?: Record<string, string>;
    method?: string;
    signal?: AbortSignal;
  },
) => Promise<AccountDeletionFetchResponse>;

export type AccountDeletionRepository = {
  requestDeletion: (
    context: AccountDeletionRequestContext,
  ) => Promise<AccountDeletionRequest>;
};

export type AccountDeletionRequestContext = {
  accessToken: string;
  tokenType: 'Bearer';
};

export type AccountDeletionRepositoryConfig = {
  endpoint: string;
  fetchImpl?: AccountDeletionFetch;
  headers?: Record<string, string>;
  requestTimeoutMs?: number;
};

const DELETION_REQUEST_ID_PATTERN = /^delete_[A-Za-z0-9_-]{12,}$/;

export function createAccountDeletionRepository(
  config: AccountDeletionRepositoryConfig,
): AccountDeletionRepository {
  const endpoint = config.endpoint.trim();

  if (endpoint.length === 0) {
    throw new Error('Account deletion endpoint must not be empty.');
  }

  let requestInFlight: {
    context: AccountDeletionRequestContext;
    task: Promise<AccountDeletionRequest>;
  } | null = null;

  const requestDeletion = (context: AccountDeletionRequestContext) =>
    runBoundedRemoteRequest({
      operation: async signal => {
        assertRequestContext(context);
        const response = await (config.fetchImpl ?? fetch)(endpoint, {
          body: JSON.stringify({}),
          headers: {
            Accept: 'application/json',
            'content-type': 'application/json',
            ...config.headers,
            Authorization: `${context.tokenType} ${context.accessToken}`,
          },
          method: 'POST',
          signal,
        });

        if (!response.ok || response.status !== 202) {
          throw new RemoteHttpError(
            `Account deletion request failed with ${response.status}.`,
            response.status,
          );
        }

        return parseAccountDeletionResponse(await response.json());
      },
      timeoutMs:
        config.requestTimeoutMs ?? DEFAULT_REMOTE_REQUEST_TIMEOUT_MS,
    });

  return {
    requestDeletion(context) {
      if (requestInFlight) {
        if (
          requestInFlight.context.accessToken !== context.accessToken ||
          requestInFlight.context.tokenType !== context.tokenType
        ) {
          return Promise.reject(
            new Error(
              'Account deletion request is already bound to another session.',
            ),
          );
        }

        return requestInFlight.task;
      }

      const task = requestDeletion(context);
      requestInFlight = {context: {...context}, task};
      task.then(
        () => {
          if (requestInFlight?.task === task) {
            requestInFlight = null;
          }
        },
        () => {
          if (requestInFlight?.task === task) {
            requestInFlight = null;
          }
        },
      );
      return task;
    },
  };
}

function assertRequestContext(context: AccountDeletionRequestContext) {
  if (
    context.tokenType !== 'Bearer' ||
    typeof context.accessToken !== 'string' ||
    context.accessToken.length === 0
  ) {
    throw new Error('Account deletion requires captured Bearer credentials.');
  }
}

export function createSoftbookRemoteAccountDeletionConfig(config: {
  apiKey?: string;
  baseUrl: string;
}): AccountDeletionRepositoryConfig {
  const baseUrl = config.baseUrl.trim().replace(/\/+$/, '');

  if (baseUrl.length === 0) {
    throw new Error('Remote account deletion requires a non-empty baseUrl.');
  }

  return {
    endpoint: `${baseUrl}/v2/account/deletion`,
    headers: {
      'x-softbook-client': 'mobile',
      ...(config.apiKey ? {'x-api-key': config.apiKey} : {}),
    },
  };
}

export function parseAccountDeletionResponse(
  payload: unknown,
): AccountDeletionRequest {
  const envelope = requireExactObject(
    payload,
    ['data'],
    'account deletion response',
  );
  const data = requireExactObject(
    envelope.data,
    ['deletion_request'],
    'account deletion response.data',
  );
  const deletionRequest = requireExactObject(
    data.deletion_request,
    ['id', 'requested_at', 'status'],
    'account deletion response.data.deletion_request',
  );
  const id = deletionRequest.id;
  const requestedAt = deletionRequest.requested_at;
  const status = deletionRequest.status;

  if (typeof id !== 'string' || !DELETION_REQUEST_ID_PATTERN.test(id)) {
    throw new Error('Account deletion response id is invalid.');
  }

  if (!isCanonicalIsoTimestamp(requestedAt)) {
    throw new Error('Account deletion response requested_at is invalid.');
  }

  if (status !== 'queued' && status !== 'processing') {
    throw new Error('Account deletion response status is invalid.');
  }

  return {
    id,
    requestedAt,
    status,
  };
}

function requireExactObject(
  value: unknown,
  expectedKeys: readonly string[],
  name: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }

  const objectValue = value as Record<string, unknown>;
  const actualKeys = Object.keys(objectValue).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();

  if (
    actualKeys.length !== sortedExpectedKeys.length ||
    actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
  ) {
    throw new Error(`${name} fields are invalid.`);
  }

  return objectValue;
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
