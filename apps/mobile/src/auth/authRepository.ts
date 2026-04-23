export type AuthRepositoryMode = 'local' | 'remote';

export type AuthSession = {
  authToken?: string;
  phoneNumber: string;
};

export type VerifySmsCodeInput = {
  phoneNumber: string;
  smsCode: string;
};

export type AuthVerifyPayloadParser = (
  payload: unknown,
  expectedPhoneNumber: string,
) => AuthSession;

export type AuthRemoteConfig = {
  headers?: Record<string, string>;
  parseVerifyPayload?: AuthVerifyPayloadParser;
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
  },
) => Promise<FetchLikeResponse>;

export type AuthRepository = {
  requestSmsCode: (phoneNumber: string) => Promise<void>;
  verifySmsCode: (input: VerifySmsCodeInput) => Promise<AuthSession>;
};

export type AuthRepositoryConfig = {
  fetchImpl?: FetchLike;
  mode: AuthRepositoryMode;
  remoteConfig?: AuthRemoteConfig;
};

export type SoftbookRemoteAuthRuntimeConfig = {
  apiKey?: string;
  baseUrl: string;
};

export function createAuthRepository(
  config: AuthRepositoryConfig,
): AuthRepository {
  return {
    requestSmsCode: async phoneNumber => {
      if (config.mode === 'remote') {
        if (!config.remoteConfig) {
          throw new Error('Remote auth repository requires remoteConfig.');
        }

        const fetchImpl = config.fetchImpl ?? fetch;
        const response = await fetchImpl(config.remoteConfig.requestCodeEndpoint, {
          body: JSON.stringify({
            phone_number: phoneNumber,
          }),
          headers: {
            'content-type': 'application/json',
            ...config.remoteConfig.headers,
          },
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error(
            `Remote auth request-code failed with ${response.status}.`,
          );
        }
      }
    },
    verifySmsCode: async input => {
      if (config.mode === 'remote') {
        if (!config.remoteConfig) {
          throw new Error('Remote auth repository requires remoteConfig.');
        }

        const fetchImpl = config.fetchImpl ?? fetch;
        const response = await fetchImpl(config.remoteConfig.verifyCodeEndpoint, {
          body: JSON.stringify({
            phone_number: input.phoneNumber,
            sms_code: input.smsCode,
          }),
          headers: {
            'content-type': 'application/json',
            ...config.remoteConfig.headers,
          },
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error(`Remote auth verify-code failed with ${response.status}.`);
        }

        const payload = await response.json();
        const parseVerifyPayload =
          config.remoteConfig.parseVerifyPayload ??
          parseSoftbookRemoteAuthVerifyPayload;

        return parseVerifyPayload(payload, input.phoneNumber);
      }

      return {
        phoneNumber: input.phoneNumber,
      };
    },
  };
}

export function createSoftbookRemoteAuthConfig(
  config: SoftbookRemoteAuthRuntimeConfig,
): AuthRemoteConfig {
  return {
    headers: {
      'x-softbook-client': 'mobile',
      ...(config.apiKey ? {'x-api-key': config.apiKey} : {}),
    },
    requestCodeEndpoint: `${trimTrailingSlash(config.baseUrl)}/v1/auth/request-code`,
    verifyCodeEndpoint: `${trimTrailingSlash(config.baseUrl)}/v1/auth/verify-code`,
  };
}

export function parseSoftbookRemoteAuthVerifyPayload(
  payload: unknown,
  expectedPhoneNumber: string,
): AuthSession {
  if (!isObject(payload)) {
    throw new Error('Remote auth verify payload must be an object.');
  }

  if (!isObject(payload.data)) {
    throw new Error('Remote auth verify payload.data must be an object.');
  }

  const {auth_token, phone_number} = payload.data;

  if (typeof phone_number !== 'string' || phone_number.trim().length === 0) {
    throw new Error(
      'Remote auth verify payload.data.phone_number is required.',
    );
  }

  if (phone_number !== expectedPhoneNumber) {
    throw new Error(
      `Remote auth verify payload.data.phone_number must match requested phone number ${expectedPhoneNumber}.`,
    );
  }

  if (typeof auth_token !== 'string' || auth_token.trim().length === 0) {
    throw new Error(
      'Remote auth verify payload.data.auth_token is required.',
    );
  }

  return {
    authToken: auth_token,
    phoneNumber: phone_number,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
