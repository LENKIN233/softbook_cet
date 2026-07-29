const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createRuntimeSmsProvider,
  createTencentCloudSmsProvider,
  createWebhookSmsProvider,
} = require('../sms-provider');

const SECRET = 'receiver-SMS-secret-0123456789-ABCDEFG';

test('development runtime keeps the in-memory fixed-code adapter boundary', () => {
  assert.equal(createRuntimeSmsProvider({runtimeMode: 'development', env: {}}), undefined);
});

test('production runtime fails closed without a configured provider', () => {
  assert.throws(
    () => createRuntimeSmsProvider({runtimeMode: 'production', env: {}}),
    /SOFTBOOK_SMS_PROVIDER=webhook or tencentcloud/,
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

  const receipt = await provider.sendCode({
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
  assert.deepEqual(receipt, {
    accepted: true,
    providerRequestId: null,
    providerStatusCode: 202,
  });
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

test('Tencent Cloud provider sends one E.164 recipient with the approved template binding', async () => {
  const calls = [];
  const provider = createRuntimeSmsProvider({
    clock: () => Date.parse('2026-07-29T07:00:00.000Z'),
    env: {
      SOFTBOOK_SMS_PROVIDER: 'tencentcloud',
      SOFTBOOK_SMS_TENCENT_REGION: 'ap-guangzhou',
      SOFTBOOK_SMS_TENCENT_SDK_APP_ID: '1400006666',
      SOFTBOOK_SMS_TENCENT_SECRET_ID: 'AKID0123456789ABCDEFGHIJKLMN',
      SOFTBOOK_SMS_TENCENT_SECRET_KEY: 'tencent-secret-key-0123456789-ABCDEFG',
      SOFTBOOK_SMS_TENCENT_SIGN_NAME: '软书四六级',
      SOFTBOOK_SMS_TENCENT_TEMPLATE_ID: '1110',
      SOFTBOOK_SMS_TENCENT_TEMPLATE_PARAMETERS: 'code,expiry_minutes',
    },
    runtimeMode: 'production',
    tencentCloudClient: {
      async SendSms(request) {
        calls.push(request);
        return {
          RequestId: 'provider-request-id',
          SendStatusSet: [{Code: 'Ok', PhoneNumber: '+8613800138000'}],
        };
      },
    },
  });

  const receipt = await provider.sendCode({
    challengeId: 'challenge-1',
    code: '482913',
    expiresAt: '2026-07-29T07:05:00.000Z',
    phoneNumber: '13800138000',
  });

  assert.equal(provider.kind, 'tencentcloud');
  assert.equal(provider.delivery, 'sms_tencentcloud');
  assert.deepEqual(calls, [
    {
      PhoneNumberSet: ['+8613800138000'],
      SignName: '软书四六级',
      SmsSdkAppId: '1400006666',
      TemplateId: '1110',
      TemplateParamSet: ['482913', '5'],
    },
  ]);
  assert.deepEqual(receipt, {
    accepted: true,
    providerRequestId: 'provider-request-id',
    providerStatusCode: null,
  });
});

test('Tencent Cloud provider accepts a code-only approved template', async () => {
  const calls = [];
  const provider = createTencentCloudSmsProvider({
    client: {
      async SendSms(request) {
        calls.push(request);
        return {
          RequestId: 'provider-request-id-code-only',
          SendStatusSet: [{Code: 'Ok', PhoneNumber: '+8613900139000'}],
        };
      },
    },
    clock: () => Date.parse('2026-07-29T07:00:00.000Z'),
    sdkAppId: '1400006666',
    signName: '软书四六级',
    templateId: '1110',
    templateParameters: ['code'],
  });

  await provider.sendCode({
    code: '482913',
    expiresAt: '2026-07-29T07:05:00.000Z',
    phoneNumber: '13900139000',
  });

  assert.deepEqual(calls[0].TemplateParamSet, ['482913']);
});

test('Tencent Cloud provider rejects a non-Ok or mismatched status without leaking it', async () => {
  for (const status of [
    {Code: 'FailedOperation.TemplateIncorrectOrUnapproved', PhoneNumber: '+8613800138000'},
    {Code: 'Ok', PhoneNumber: '+8613900139000'},
  ]) {
    const provider = createTencentCloudSmsProvider({
      client: {
        SendSms: async () => ({RequestId: 'provider-request-id', SendStatusSet: [status]}),
      },
      clock: () => Date.parse('2026-07-29T07:00:00.000Z'),
      sdkAppId: '1400006666',
      signName: '软书四六级',
      templateId: '1110',
      templateParameters: ['code'],
    });

    await assert.rejects(
      () =>
        provider.sendCode({
          code: '482913',
          expiresAt: '2026-07-29T07:05:00.000Z',
          phoneNumber: '13800138000',
        }),
      error =>
        error.message === 'Tencent Cloud SMS delivery failed.' &&
        !error.message.includes(status.Code) &&
        !error.message.includes(status.PhoneNumber),
    );
  }
});

test('Tencent Cloud provider requires the provider request ID for smoke traceability', async () => {
  const provider = createTencentCloudSmsProvider({
    client: {
      SendSms: async () => ({
        SendStatusSet: [{Code: 'Ok', PhoneNumber: '+8613800138000'}],
      }),
    },
    clock: () => Date.parse('2026-07-29T07:00:00.000Z'),
    sdkAppId: '1400006666',
    signName: '软书四六级',
    templateId: '1110',
    templateParameters: ['code'],
  });

  await assert.rejects(
    () =>
      provider.sendCode({
        code: '482913',
        expiresAt: '2026-07-29T07:05:00.000Z',
        phoneNumber: '13800138000',
      }),
    /Tencent Cloud SMS delivery failed/,
  );
});

for (const env of [
  {
    SOFTBOOK_SMS_PROVIDER: 'tencentcloud',
    SOFTBOOK_SMS_TENCENT_REGION: 'ap-guangzhou',
  },
  {
    SOFTBOOK_SMS_PROVIDER: 'tencentcloud',
    SOFTBOOK_SMS_TENCENT_REGION: 'us-west-1',
    SOFTBOOK_SMS_TENCENT_SECRET_ID: 'AKID0123456789ABCDEFGHIJKLMN',
    SOFTBOOK_SMS_TENCENT_SECRET_KEY: 'tencent-secret-key-0123456789-ABCDEFG',
  },
  {
    SOFTBOOK_SMS_PROVIDER: 'tencentcloud',
    SOFTBOOK_SMS_TENCENT_TIMEOUT_MS: '15001',
  },
  {
    SOFTBOOK_SMS_PROVIDER: 'tencentcloud',
    SOFTBOOK_SMS_TENCENT_REGION: 'ap-guangzhou',
    SOFTBOOK_SMS_TENCENT_SDK_APP_ID: '1400006666',
    SOFTBOOK_SMS_TENCENT_SECRET_ID: 'AKID0123456789ABCDEFGHIJKLMN',
    SOFTBOOK_SMS_TENCENT_SECRET_KEY: 'tencent-secret-key-0123456789-ABCDEFG',
    SOFTBOOK_SMS_TENCENT_SIGN_NAME: '软书四六级',
    SOFTBOOK_SMS_TENCENT_TEMPLATE_ID: '1110',
    SOFTBOOK_SMS_TENCENT_TEMPLATE_PARAMETERS: 'expiry_minutes,code',
  },
]) {
  test('Tencent Cloud production configuration fails closed when incomplete or unsafe', () => {
    assert.throws(
      () =>
        createRuntimeSmsProvider({
          env,
          runtimeMode: 'production',
          tencentCloudClient: {SendSms: async () => ({})},
        }),
      /SOFTBOOK_SMS_TENCENT|Tencent Cloud SMS timeout/,
    );
  });
}
