const assert = require('node:assert/strict');
const test = require('node:test');
const {createRuntimeSmsProvider, createWebhookSmsProvider} = require('../sms-provider');

const SECRET = 'receiver-SMS-secret-0123456789-ABCDEFG';

test('development runtime keeps the in-memory fixed-code adapter boundary', () => {
  assert.equal(createRuntimeSmsProvider({runtimeMode: 'development', env: {}}), undefined);
});

test('production runtime fails closed without a configured provider', () => {
  assert.throws(
    () => createRuntimeSmsProvider({runtimeMode: 'production', env: {}}),
    /SOFTBOOK_SMS_PROVIDER=webhook/,
  );
});

test('webhook provider sends the bounded delivery contract and bearer secret', async () => {
  const calls = [];
  const provider = createRuntimeSmsProvider({
    runtimeMode: 'production',
    env: {
      SOFTBOOK_SMS_PROVIDER: 'webhook',
      SOFTBOOK_SMS_WEBHOOK_SECRET: SECRET,
      SOFTBOOK_SMS_WEBHOOK_URL: 'https://sms.receiver.example/v1/send',
    },
    fetchImpl: async (url, init) => {
      calls.push({url, init});
      return {ok: true, status: 202};
    },
  });

  await provider.sendCode({
    challengeId: 'challenge-1',
    code: '482913',
    expiresAt: '2026-07-29T07:05:00.000Z',
    phoneNumber: '13800138000',
  });

  assert.equal(provider.kind, 'webhook');
  assert.equal(provider.delivery, 'sms_webhook');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://sms.receiver.example/v1/send');
  assert.equal(calls[0].init.headers.authorization, `Bearer ${SECRET}`);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    schema_version: 'softbook-sms-delivery.v1',
    challenge_id: 'challenge-1',
    code: '482913',
    expires_at: '2026-07-29T07:05:00.000Z',
    phone_number: '13800138000',
  });
  assert.equal(calls[0].init.redirect, 'error');
});

test('webhook provider never includes remote response details in its error', async () => {
  const provider = createWebhookSmsProvider({
    endpoint: 'https://sms.receiver.example/v1/send',
    secret: SECRET,
    fetchImpl: async () => ({ok: false, status: 401}),
  });

  await assert.rejects(
    () =>
      provider.sendCode({
        challengeId: 'challenge-1',
        code: '482913',
        expiresAt: '2026-07-29T07:05:00.000Z',
        phoneNumber: '13800138000',
      }),
    error =>
      error.message === 'SMS webhook delivery failed.' &&
      !error.message.includes('401') &&
      !error.message.includes(SECRET),
  );
});

for (const configuration of [
  {endpoint: 'http://sms.example/send', secret: SECRET},
  {endpoint: 'https://user:pass@sms.example/send', secret: SECRET},
  {endpoint: 'https://sms.example/send?token=secret', secret: SECRET},
  {endpoint: 'https://sms.example/send', secret: 'too-short'},
]) {
  test(`rejects unsafe webhook configuration: ${configuration.endpoint}`, () => {
    assert.throws(
      () =>
        createWebhookSmsProvider({
          ...configuration,
          fetchImpl: async () => ({ok: true}),
        }),
      /SMS_WEBHOOK|HTTPS URL/,
    );
  });
}
