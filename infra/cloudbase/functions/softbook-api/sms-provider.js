const DEFAULT_TIMEOUT_MS = 5000;
const MINIMUM_SECRET_LENGTH = 32;

function createRuntimeSmsProvider(options = {}) {
  const runtimeMode = options.runtimeMode ?? 'development';

  if (runtimeMode !== 'production') {
    return undefined;
  }

  const env = options.env ?? process.env;
  const provider = env.SOFTBOOK_SMS_PROVIDER;

  if (provider !== 'webhook') {
    throw new Error('Production SMS requires SOFTBOOK_SMS_PROVIDER=webhook.');
  }

  return createWebhookSmsProvider({
    endpoint: env.SOFTBOOK_SMS_WEBHOOK_URL,
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    secret: env.SOFTBOOK_SMS_WEBHOOK_SECRET,
    timeoutMs: parseTimeout(env.SOFTBOOK_SMS_WEBHOOK_TIMEOUT_MS),
  });
}

function createWebhookSmsProvider({endpoint, fetchImpl, secret, timeoutMs = DEFAULT_TIMEOUT_MS}) {
  const url = requireWebhookUrl(endpoint);
  const bearerSecret = requireSecret(secret);

  if (typeof fetchImpl !== 'function') {
    throw new Error('SMS webhook requires a fetch implementation.');
  }

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 15000) {
    throw new Error('SMS webhook timeout must be an integer from 1 to 15000ms.');
  }

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
      } catch {
        throw new Error('SMS webhook delivery failed.');
      } finally {
        clearTimeout(timer);
      }
    },
  };
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
  if (
    typeof value !== 'string' ||
    value.length < MINIMUM_SECRET_LENGTH ||
    new Set(value).size < 12
  ) {
    throw new Error('SOFTBOOK_SMS_WEBHOOK_SECRET must satisfy the 32-character diversity policy.');
  }

  return value;
}

function parseTimeout(value) {
  if (value === undefined || value === '') {
    return DEFAULT_TIMEOUT_MS;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error('SOFTBOOK_SMS_WEBHOOK_TIMEOUT_MS must be an integer.');
  }

  return Number(value);
}

module.exports = {
  createRuntimeSmsProvider,
  createWebhookSmsProvider,
};
