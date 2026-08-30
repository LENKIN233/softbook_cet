import {RemoteHttpError} from '../../mobile/src/runtime/remoteHttpError';
import {
  DEFAULT_REMOTE_REQUEST_TIMEOUT_MS,
  runBoundedRemoteRequest,
} from '../../mobile/src/runtime/remoteRequest';
import {createSoftbookClientHeaders} from '../../mobile/src/runtime/remoteClient';

export type WebAccountDeletionRecoveryChallenge = {
  challengeId: string;
  delivery: string;
  expiresAt: string;
  phoneNumber: string;
  retryAfterSeconds: number;
};

export type WebAccountDeletionRecoveryResult =
  | {
      deletionRequest: {
        id: string;
        requestedAt: string;
        status: 'processing' | 'queued';
      };
      safeToRegister: false;
      state: 'pending';
    }
  | {
      deletionRequest: null;
      safeToRegister: true;
      state: 'none';
    };

export type WebAccountDeletionRecoveryRepository = {
  requestCode: (
    phoneNumber: string,
  ) => Promise<WebAccountDeletionRecoveryChallenge>;
  verifyCode: (input: {
    challenge: WebAccountDeletionRecoveryChallenge;
    smsCode: string;
  }) => Promise<WebAccountDeletionRecoveryResult>;
};

export function createWebAccountDeletionRecoveryRepository(options: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): WebAccountDeletionRecoveryRepository {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs =
    options.timeoutMs ?? DEFAULT_REMOTE_REQUEST_TIMEOUT_MS;
  const headers = {
    Accept: 'application/json',
    'content-type': 'application/json',
    ...createSoftbookClientHeaders('web'),
  };

  return {
    requestCode(phoneNumber) {
      assertPhoneNumber(phoneNumber);
      return runBoundedRemoteRequest({
        timeoutMs,
        operation: async signal => {
          const response = await fetchImpl(
            `${baseUrl}/v2/account/deletion/recovery/request-code`,
            {
              body: JSON.stringify({phone_number: phoneNumber}),
              credentials: 'omit',
              headers,
              method: 'POST',
              redirect: 'error',
              signal,
            },
          );
          assertExactSuccess(response, 'request-code');
          return parseRecoveryChallenge(await response.json(), phoneNumber);
        },
      });
    },

    verifyCode({challenge, smsCode}) {
      assertChallenge(challenge);
      if (!/^\d{6}$/.test(smsCode)) {
        throw new Error('Deletion recovery SMS code must contain six digits.');
      }
      return runBoundedRemoteRequest({
        timeoutMs,
        operation: async signal => {
          const response = await fetchImpl(
            `${baseUrl}/v2/account/deletion/recovery/verify-code`,
            {
              body: JSON.stringify({
                challenge_id: challenge.challengeId,
                phone_number: challenge.phoneNumber,
                sms_code: smsCode,
              }),
              credentials: 'omit',
              headers,
              method: 'POST',
              redirect: 'error',
              signal,
            },
          );
          assertExactSuccess(response, 'verify-code');
          return parseRecoveryResult(await response.json());
        },
      });
    },
  };
}

function parseRecoveryChallenge(
  payload: unknown,
  phoneNumber: string,
): WebAccountDeletionRecoveryChallenge {
  const data = readData(payload);
  assertExactKeys(data, [
    'challenge_id',
    'delivery',
    'expires_at',
    'purpose',
    'retry_after_seconds',
  ]);
  if (
    typeof data.challenge_id !== 'string' ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(data.challenge_id) ||
    typeof data.delivery !== 'string' ||
    data.delivery.trim() === '' ||
    data.purpose !== 'account_deletion_recovery' ||
    !isCanonicalUtcInstant(data.expires_at) ||
    !Number.isSafeInteger(data.retry_after_seconds) ||
    (data.retry_after_seconds as number) < 0
  ) {
    throw new Error('Deletion recovery challenge payload is invalid.');
  }
  return {
    challengeId: data.challenge_id,
    delivery: data.delivery,
    expiresAt: data.expires_at,
    phoneNumber,
    retryAfterSeconds: data.retry_after_seconds as number,
  };
}

function parseRecoveryResult(
  payload: unknown,
): WebAccountDeletionRecoveryResult {
  const data = readData(payload);
  assertExactKeys(data, [
    'deletion_request',
    'safe_to_register',
    'schema_version',
    'state',
  ]);
  if (data.schema_version !== 'account-deletion-recovery.v1') {
    throw new Error('Deletion recovery result schema is invalid.');
  }
  if (data.state === 'none') {
    if (data.safe_to_register !== true || data.deletion_request !== null) {
      throw new Error('Deletion recovery none result is invalid.');
    }
    return {deletionRequest: null, safeToRegister: true, state: 'none'};
  }
  if (
    data.state !== 'pending' ||
    data.safe_to_register !== false ||
    typeof data.deletion_request !== 'object' ||
    data.deletion_request === null ||
    Array.isArray(data.deletion_request)
  ) {
    throw new Error('Deletion recovery pending result is invalid.');
  }
  const request = data.deletion_request as Record<string, unknown>;
  assertExactKeys(request, ['id', 'requested_at', 'status']);
  if (
    typeof request.id !== 'string' ||
    !/^delete_[A-Za-z0-9_-]{12,}$/.test(request.id) ||
    !isCanonicalUtcInstant(request.requested_at) ||
    (request.status !== 'queued' && request.status !== 'processing')
  ) {
    throw new Error('Deletion recovery request projection is invalid.');
  }
  return {
    deletionRequest: {
      id: request.id,
      requestedAt: request.requested_at,
      status: request.status,
    },
    safeToRegister: false,
    state: 'pending',
  };
}

function readData(payload: unknown): Record<string, unknown> {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload) ||
    Object.keys(payload).join(',') !== 'data'
  ) {
    throw new Error('Deletion recovery response envelope is invalid.');
  }
  const data = (payload as Record<string, unknown>).data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Deletion recovery response data is invalid.');
  }
  return data as Record<string, unknown>;
}

function assertExactKeys(record: Record<string, unknown>, keys: string[]) {
  if (Object.keys(record).sort().join(',') !== [...keys].sort().join(',')) {
    throw new Error('Deletion recovery payload fields are invalid.');
  }
}

function assertExactSuccess(response: Response, operation: string) {
  if (!response.ok || response.status !== 200) {
    throw new RemoteHttpError(
      `Deletion recovery ${operation} failed with ${response.status}.`,
      response.status,
    );
  }
}

function assertChallenge(
  challenge: WebAccountDeletionRecoveryChallenge,
) {
  assertPhoneNumber(challenge.phoneNumber);
  if (
    !/^[A-Za-z0-9_-]{16,128}$/.test(challenge.challengeId) ||
    challenge.delivery.trim() === '' ||
    !isCanonicalUtcInstant(challenge.expiresAt) ||
    !Number.isSafeInteger(challenge.retryAfterSeconds) ||
    challenge.retryAfterSeconds < 0
  ) {
    throw new Error('Deletion recovery challenge is invalid.');
  }
}

function assertPhoneNumber(value: string) {
  if (!/^1\d{10}$/.test(value)) {
    throw new Error('Deletion recovery phone number is invalid.');
  }
}

function isCanonicalUtcInstant(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}
