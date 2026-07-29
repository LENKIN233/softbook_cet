const DEFAULT_TIMEOUT_MS = 5000;
const MINIMUM_SECRET_LENGTH = 32;
const TENCENT_CLOUD_SMS_ENDPOINT = 'sms.tencentcloudapi.com';
const TENCENT_TEMPLATE_PARAMETER_NAMES = new Set(['code', 'expiry_minutes']);

function createRuntimeSmsProvider(options = {}) {
  const runtimeMode = options.runtimeMode ?? 'development';

  if (runtimeMode !== 'production') {
    return undefined;
  }

  const env = options.env ?? process.env;
  const provider = env.SOFTBOOK_SMS_PROVIDER;

  if (provider === 'webhook') {
    return createWebhookSmsProvider({
      endpoint: env.SOFTBOOK_SMS_WEBHOOK_URL,
      fetchImpl: options.fetchImpl ?? globalThis.fetch,
      secret: env.SOFTBOOK_SMS_WEBHOOK_SECRET,
      timeoutMs: parseTimeout(env.SOFTBOOK_SMS_WEBHOOK_TIMEOUT_MS),
    });
  }

  if (provider === 'tencentcloud') {
    const timeoutMs = requireTimeout(
      parseTimeout(env.SOFTBOOK_SMS_TENCENT_TIMEOUT_MS, 'SOFTBOOK_SMS_TENCENT_TIMEOUT_MS'),
      'Tencent Cloud SMS',
    );
    const client =
      options.tencentCloudClient ??
      createTencentCloudClient({
        region: requireTencentRegion(env.SOFTBOOK_SMS_TENCENT_REGION),
        secretId: requireTencentSecretId(env.SOFTBOOK_SMS_TENCENT_SECRET_ID),
        secretKey: requireStrongSecret(
          env.SOFTBOOK_SMS_TENCENT_SECRET_KEY,
          'SOFTBOOK_SMS_TENCENT_SECRET_KEY',
        ),
        timeoutMs,
      });
    return createTencentCloudSmsProvider({
      client,
      clock: options.clock,
      sdkAppId: requireDigits(
        env.SOFTBOOK_SMS_TENCENT_SDK_APP_ID,
        'SOFTBOOK_SMS_TENCENT_SDK_APP_ID',
        10,
        20,
      ),
      signName: requireVisibleText(
        env.SOFTBOOK_SMS_TENCENT_SIGN_NAME,
        'SOFTBOOK_SMS_TENCENT_SIGN_NAME',
        64,
      ),
      templateId: requireDigits(
        env.SOFTBOOK_SMS_TENCENT_TEMPLATE_ID,
        'SOFTBOOK_SMS_TENCENT_TEMPLATE_ID',
        1,
        20,
      ),
      templateParameters: parseTencentTemplateParameters(
        env.SOFTBOOK_SMS_TENCENT_TEMPLATE_PARAMETERS,
      ),
    });
  }

  throw new Error(
    'Production SMS requires SOFTBOOK_SMS_PROVIDER=webhook or tencentcloud.',
  );
}

function createWebhookSmsProvider({endpoint, fetchImpl, secret, timeoutMs = DEFAULT_TIMEOUT_MS}) {
  const url = requireWebhookUrl(endpoint);
  const bearerSecret = requireSecret(secret);

  if (typeof fetchImpl !== 'function') {
    throw new Error('SMS webhook requires a fetch implementation.');
  }

  requireTimeout(timeoutMs, 'SMS webhook');

  return {
    delivery: 'sms_webhook',
    kind: 'webhook',
    async sendCode({challengeId, code, expiresAt, phoneNumber}) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(url, {
          body: JSON.stringify({
            schema_version: 'softbook-sms-delivery.v1',
            challenge_id: challengeId,
            code,
            expires_at: expiresAt,
            phone_number: phoneNumber,
          }),
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${bearerSecret}`,
            'content-type': 'application/json',
          },
          method: 'POST',
          redirect: 'error',
          signal: controller.signal,
        });

        if (!response || response.ok !== true) {
          throw new Error('SMS webhook rejected delivery.');
        }
        return {
          accepted: true,
          providerRequestId: null,
          providerStatusCode: Number.isInteger(response.status) ? response.status : null,
        };
      } catch {
        throw new Error('SMS webhook delivery failed.');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function createTencentCloudClient({region, secretId, secretKey, timeoutMs}) {
  const {sms} = require('tencentcloud-sdk-nodejs-sms');
  const SmsClient = sms.v20210111.Client;
  return new SmsClient({
    credential: {secretId, secretKey},
    profile: {
      httpProfile: {
        endpoint: TENCENT_CLOUD_SMS_ENDPOINT,
        reqMethod: 'POST',
        reqTimeout: Math.ceil(timeoutMs / 1000),
      },
      signMethod: 'TC3-HMAC-SHA256',
    },
    region,
  });
}

function createTencentCloudSmsProvider({
  client,
  clock = () => Date.now(),
  sdkAppId,
  signName,
  templateId,
  templateParameters,
}) {
  if (!client || typeof client.SendSms !== 'function') {
    throw new Error('Tencent Cloud SMS requires a SendSms client.');
  }
  if (typeof clock !== 'function') {
    throw new Error('Tencent Cloud SMS requires a clock.');
  }
  const validatedSdkAppId = requireDigits(
    sdkAppId,
    'SOFTBOOK_SMS_TENCENT_SDK_APP_ID',
    10,
    20,
  );
  const validatedSignName = requireVisibleText(
    signName,
    'SOFTBOOK_SMS_TENCENT_SIGN_NAME',
    64,
  );
  const validatedTemplateId = requireDigits(
    templateId,
    'SOFTBOOK_SMS_TENCENT_TEMPLATE_ID',
    1,
    20,
  );
  const validatedTemplateParameters = requireTencentTemplateParameterNames(
    templateParameters,
  );

  return {
    delivery: 'sms_tencentcloud',
    kind: 'tencentcloud',
    async sendCode({code, expiresAt, phoneNumber}) {
      const e164PhoneNumber = requireMainlandPhoneNumber(phoneNumber);
      const parameters = buildTencentTemplateParameters({
        clock,
        code,
        expiresAt,
        templateParameters: validatedTemplateParameters,
      });

      try {
        const response = await client.SendSms({
          PhoneNumberSet: [e164PhoneNumber],
          SignName: validatedSignName,
          SmsSdkAppId: validatedSdkAppId,
          TemplateId: validatedTemplateId,
          TemplateParamSet: parameters,
        });
        const statuses = response?.SendStatusSet;
        if (
          !Array.isArray(statuses) ||
          statuses.length !== 1 ||
          statuses[0]?.Code !== 'Ok' ||
          statuses[0]?.PhoneNumber !== e164PhoneNumber ||
          typeof response?.RequestId !== 'string' ||
          response.RequestId.trim() === ''
        ) {
          throw new Error('Tencent Cloud rejected delivery.');
        }
        return {
          accepted: true,
          providerRequestId: response.RequestId,
          providerStatusCode: null,
        };
      } catch {
        throw new Error('Tencent Cloud SMS delivery failed.');
      }
    },
  };
}

function buildTencentTemplateParameters({clock, code, expiresAt, templateParameters}) {
  const expiresAtMs = Date.parse(expiresAt);
  const now = Number(clock());
  if (!Number.isFinite(expiresAtMs) || !Number.isFinite(now) || expiresAtMs <= now) {
    throw new Error('Tencent Cloud SMS challenge expiry is invalid.');
  }
  const values = {
    code: requireSmsCode(code),
    expiry_minutes: String(Math.max(1, Math.ceil((expiresAtMs - now) / 60_000))),
  };
  return templateParameters.map(name => values[name]);
}

function requireWebhookUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('SOFTBOOK_SMS_WEBHOOK_URL is required.');
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('SOFTBOOK_SMS_WEBHOOK_URL must be a valid HTTPS URL.');
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    url.pathname === '/'
  ) {
    throw new Error('SOFTBOOK_SMS_WEBHOOK_URL must be a credential-free HTTPS URL with a path.');
  }

  return url.toString();
}

function requireSecret(value) {
  return requireStrongSecret(value, 'SOFTBOOK_SMS_WEBHOOK_SECRET');
}

function requireStrongSecret(value, name) {
  if (
    typeof value !== 'string' ||
    value.length < MINIMUM_SECRET_LENGTH ||
    new Set(value).size < 12
  ) {
    throw new Error(`${name} must satisfy the 32-character diversity policy.`);
  }

  return value;
}

function requireTencentSecretId(value) {
  if (typeof value !== 'string' || !/^AKID[A-Za-z0-9]{12,124}$/.test(value)) {
    throw new Error('SOFTBOOK_SMS_TENCENT_SECRET_ID must be a valid Tencent Cloud SecretId.');
  }
  return value;
}

function requireTencentRegion(value) {
  if (typeof value !== 'string' || !/^ap-[a-z]+(?:-[0-9]+)?$/.test(value)) {
    throw new Error('SOFTBOOK_SMS_TENCENT_REGION must be a valid AP region.');
  }
  return value;
}

function requireDigits(value, name, minimumLength, maximumLength) {
  if (
    typeof value !== 'string' ||
    !/^\d+$/.test(value) ||
    value.length < minimumLength ||
    value.length > maximumLength
  ) {
    throw new Error(`${name} must contain ${minimumLength}-${maximumLength} digits.`);
  }
  return value;
}

function requireVisibleText(value, name, maximumLength) {
  if (
    typeof value !== 'string' ||
    value.trim() !== value ||
    value.length === 0 ||
    value.length > maximumLength ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error(`${name} must be non-empty visible text up to ${maximumLength} characters.`);
  }
  return value;
}

function parseTencentTemplateParameters(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('SOFTBOOK_SMS_TENCENT_TEMPLATE_PARAMETERS is required.');
  }
  return requireTencentTemplateParameterNames(value.split(','));
}

function requireTencentTemplateParameterNames(names) {
  const serialized = Array.isArray(names) ? names.join(',') : '';
  if (
    (serialized !== 'code' && serialized !== 'code,expiry_minutes') ||
    names.some(name => !TENCENT_TEMPLATE_PARAMETER_NAMES.has(name))
  ) {
    throw new Error(
      'SOFTBOOK_SMS_TENCENT_TEMPLATE_PARAMETERS must be code or code,expiry_minutes.',
    );
  }
  return [...names];
}

function requireMainlandPhoneNumber(value) {
  if (typeof value !== 'string' || !/^1[3-9]\d{9}$/.test(value)) {
    throw new Error('Tencent Cloud SMS requires a mainland China mobile number.');
  }
  return `+86${value}`;
}

function requireSmsCode(value) {
  if (typeof value !== 'string' || !/^\d{4,8}$/.test(value)) {
    throw new Error('Tencent Cloud SMS code is invalid.');
  }
  return value;
}

function parseTimeout(value, name = 'SOFTBOOK_SMS_WEBHOOK_TIMEOUT_MS') {
  if (value === undefined || value === '') {
    return DEFAULT_TIMEOUT_MS;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be an integer.`);
  }

  return Number(value);
}

function requireTimeout(value, providerName) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 15000) {
    throw new Error(`${providerName} timeout must be an integer from 1 to 15000ms.`);
  }
  return value;
}

module.exports = {
  createRuntimeSmsProvider,
  createTencentCloudSmsProvider,
  createWebhookSmsProvider,
};
