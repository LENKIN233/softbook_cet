import assert from 'node:assert/strict';
import test from 'node:test';

import type {FastifyInstance} from 'fastify';

import {createProductionApi, toChinaDayKey} from '../src/app.js';
import {loadApiConfig} from '../src/config.js';
import type {ContentManifest} from '../src/domain.js';
import {MemoryProductionRepository} from '../src/memoryRepository.js';
import {PhoneProtector, SecretHasher} from '../src/security.js';
import {DevSmsProvider} from '../src/sms.js';

const FIXED_NOW = new Date('2026-07-12T08:00:00.000Z');
const PHONE = '13800138000';
const SMS_CODE = '2468';
const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
const MANIFEST: ContentManifest = {
  approvalRecordSha256: 'b'.repeat(64),
  manifestSha256: 'c'.repeat(64),
  minimumClientVersion: '1.0.0',
  packs: [
    {
      assetId: 'cos://softbook-content/cet4/0020.json',
      boxRef: '0020',
      byteSize: 1024,
      packId: 'cet4-0020-v1',
      sha256: 'a'.repeat(64),
    },
  ],
  parentReleaseId: null,
  releaseId: 'cet4-2026-07-12-v1',
  signature: Buffer.from('test-signature').toString('base64'),
  signatureKeyId: 'softbook-content-test-1',
  track: 'cet4',
};

async function createTestApp(manifests: ContentManifest[] = []) {
  const repository = new MemoryProductionRepository(manifests);
  const app = await createProductionApi({
    allowedOrigins: ['https://app.softbook.example'],
    codeHasher: new SecretHasher('test-code-secret-that-is-long-enough:sms'),
    environment: 'test',
    generateSmsCode: () => SMS_CODE,
    phoneProtector: new PhoneProtector(
      'test-phone-secret-that-is-long-enough',
      ENCRYPTION_KEY,
    ),
    repository,
    smsProvider: new DevSmsProvider(SMS_CODE),
    tokenHasher: new SecretHasher('test-token-secret-that-is-long-enough:token'),
    now: () => FIXED_NOW,
  });
  return {app, repository};
}

async function authenticate(app: FastifyInstance) {
  const requestCode = await app.inject({
    method: 'POST',
    url: '/v2/auth/request-code',
    payload: {phone_number: PHONE},
  });
  assert.equal(requestCode.statusCode, 200);
  const challengeId = requestCode.json().data.challenge_id as string;
  const verifyCode = await app.inject({
    method: 'POST',
    url: '/v2/auth/verify-code',
    payload: {
      challenge_id: challengeId,
      phone_number: PHONE,
      sms_code: SMS_CODE,
    },
  });
  assert.equal(verifyCode.statusCode, 200);
  return verifyCode.json().data as {
    access_token: string;
    refresh_token: string;
    user: {id: string};
  };
}

test('health endpoints separate process liveness from database readiness', async t => {
  const {app} = await createTestApp();
  t.after(() => app.close());

  const live = await app.inject({method: 'GET', url: '/health/live'});
  const ready = await app.inject({method: 'GET', url: '/health/ready'});

  assert.equal(live.statusCode, 200);
  assert.equal(ready.statusCode, 200);
  assert.deepEqual(live.json(), {status: 'ok'});
  assert.deepEqual(ready.json(), {status: 'ready'});
});

test('SMS auth does not return phone number or development code', async t => {
  const {app} = await createTestApp();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/v2/auth/request-code',
    payload: {phone_number: PHONE},
  });
  const text = response.body;

  assert.equal(response.statusCode, 200);
  assert.doesNotMatch(text, new RegExp(PHONE));
  assert.doesNotMatch(text, new RegExp(SMS_CODE));
  assert.match(response.json().data.challenge_id, /^[0-9a-f-]{36}$/);
});

test('SMS challenge enforces resend cooldown and one-time verification', async t => {
  const {app} = await createTestApp();
  t.after(() => app.close());

  const first = await app.inject({
    method: 'POST',
    url: '/v2/auth/request-code',
    payload: {phone_number: PHONE},
  });
  const second = await app.inject({
    method: 'POST',
    url: '/v2/auth/request-code',
    payload: {phone_number: PHONE},
  });
  assert.equal(second.statusCode, 429);
  assert.equal(second.json().error.code, 'sms_resend_limited');

  const challengeId = first.json().data.challenge_id as string;
  const accepted = await app.inject({
    method: 'POST',
    url: '/v2/auth/verify-code',
    payload: {
      challenge_id: challengeId,
      phone_number: PHONE,
      sms_code: SMS_CODE,
    },
  });
  const replay = await app.inject({
    method: 'POST',
    url: '/v2/auth/verify-code',
    payload: {
      challenge_id: challengeId,
      phone_number: PHONE,
      sms_code: SMS_CODE,
    },
  });

  assert.equal(accepted.statusCode, 200);
  assert.match(accepted.json().data.access_token, /^sb_at_/);
  assert.match(accepted.json().data.refresh_token, /^sb_rt_/);
  assert.equal(replay.statusCode, 401);
  assert.equal(replay.json().error.code, 'sms_challenge_used');
});

test('request-code preserves the HTTP rate-limit response instead of returning 500', async t => {
  const {app} = await createTestApp();
  t.after(() => app.close());

  for (let index = 0; index < 10; index += 1) {
    const response = await app.inject({
      method: 'POST',
      url: '/v2/auth/request-code',
      payload: {phone_number: String(13800138000 + index)},
    });
    assert.equal(response.statusCode, 200);
  }

  const limited = await app.inject({
    method: 'POST',
    url: '/v2/auth/request-code',
    payload: {phone_number: '13800138010'},
  });
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.json().error.code, 'rate_limit_exceeded');
});

test('production API rejects a development SMS provider at composition time', async () => {
  const repository = new MemoryProductionRepository();
  await assert.rejects(
    createProductionApi({
      allowedOrigins: ['https://app.softbook.example'],
      codeHasher: new SecretHasher('test-code-secret-that-is-long-enough:sms'),
      environment: 'production',
      phoneProtector: new PhoneProtector(
        'test-phone-secret-that-is-long-enough',
        ENCRYPTION_KEY,
      ),
      repository,
      smsProvider: new DevSmsProvider(SMS_CODE),
      tokenHasher: new SecretHasher(
        'test-token-secret-that-is-long-enough:token',
      ),
    }),
    /requires the Tencent SMS provider/,
  );
  await repository.close();
});

test('refresh rotates the session and invalidates the previous access token', async t => {
  const {app} = await createTestApp([MANIFEST]);
  t.after(() => app.close());
  const session = await authenticate(app);

  const refresh = await app.inject({
    method: 'POST',
    url: '/v2/auth/refresh',
    payload: {refresh_token: session.refresh_token},
  });
  assert.equal(refresh.statusCode, 200);
  const replacement = refresh.json().data;
  assert.notEqual(replacement.access_token, session.access_token);

  const oldAccess = await app.inject({
    method: 'GET',
    url: '/v2/bootstrap?track=cet4&day_key=2026-07-12',
    headers: {authorization: `Bearer ${session.access_token}`},
  });
  const newAccess = await app.inject({
    method: 'GET',
    url: '/v2/bootstrap?track=cet4&day_key=2026-07-12',
    headers: {authorization: `Bearer ${replacement.access_token}`},
  });

  assert.equal(oldAccess.statusCode, 401);
  assert.equal(newAccess.statusCode, 200);
});

test('bootstrap fails closed when no approved content release is active', async t => {
  const {app} = await createTestApp();
  t.after(() => app.close());
  const session = await authenticate(app);

  const response = await app.inject({
    method: 'GET',
    url: '/v2/bootstrap?track=cet4&day_key=2026-07-12',
    headers: {authorization: `Bearer ${session.access_token}`},
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, 'content_release_unavailable');
});

test('bootstrap is canonical and learning event replay is idempotent', async t => {
  const {app} = await createTestApp([MANIFEST]);
  t.after(() => app.close());
  const session = await authenticate(app);
  const event = {
    answer_grade: 'good',
    card_id: '002001',
    client_timestamp: '2026-07-12T08:00:00.000Z',
    content_release_id: MANIFEST.releaseId,
    device_cursor: 1,
    device_id: 'e79b8c93-7ca6-46cf-a2de-542b3c927fd1',
    event_id: '79e15e75-0a78-4fd1-9c04-08d95f804567',
    interaction_id: 'flip',
    phase: 'learning',
    track: 'cet4',
    used_hint: false,
    used_peek: false,
  };
  const headers = {authorization: `Bearer ${session.access_token}`};

  const first = await app.inject({
    method: 'POST',
    url: '/v2/learning/events',
    headers,
    payload: {events: [event]},
  });
  const replay = await app.inject({
    method: 'POST',
    url: '/v2/learning/events',
    headers,
    payload: {events: [event]},
  });
  const bootstrap = await app.inject({
    method: 'GET',
    url: '/v2/bootstrap?track=cet4&day_key=2026-07-12',
    headers,
  });

  assert.deepEqual(first.json().data, {
    accepted_count: 1,
    duplicate_count: 0,
    received_at: FIXED_NOW.toISOString(),
  });
  assert.equal(replay.json().data.accepted_count, 0);
  assert.equal(replay.json().data.duplicate_count, 1);
  assert.equal(bootstrap.json().data.learning_state.events.length, 1);
  assert.equal(
    bootstrap.json().data.content_manifest.release_id,
    MANIFEST.releaseId,
  );
  assert.equal(
    bootstrap.json().data.content_manifest.manifest_sha256,
    MANIFEST.manifestSha256,
  );
  assert.equal(
    bootstrap.json().data.content_manifest.approval_record_sha256,
    MANIFEST.approvalRecordSha256,
  );
  assert.equal(
    bootstrap.json().data.membership_entitlement.stage,
    'trial_available',
  );
});

test('event idempotency keys and device cursors reject conflicting payloads', async t => {
  const {app} = await createTestApp([MANIFEST]);
  t.after(() => app.close());
  const session = await authenticate(app);
  const headers = {authorization: `Bearer ${session.access_token}`};
  const event = {
    answer_grade: 'good',
    card_id: '002001',
    client_timestamp: FIXED_NOW.toISOString(),
    content_release_id: MANIFEST.releaseId,
    device_cursor: 42,
    device_id: 'e79b8c93-7ca6-46cf-a2de-542b3c927fd1',
    event_id: '79e15e75-0a78-4fd1-9c04-08d95f804567',
    interaction_id: 'flip',
    phase: 'learning',
    track: 'cet4',
    used_hint: false,
    used_peek: false,
  };

  const accepted = await app.inject({
    method: 'POST',
    url: '/v2/learning/events',
    headers,
    payload: {events: [event]},
  });
  const reusedEventId = await app.inject({
    method: 'POST',
    url: '/v2/learning/events',
    headers,
    payload: {events: [{...event, answer_grade: 'easy'}]},
  });
  const reusedCursor = await app.inject({
    method: 'POST',
    url: '/v2/learning/events',
    headers,
    payload: {
      events: [
        {...event, event_id: '9b282ae5-a663-4b22-980d-dff20d0d0202'},
      ],
    },
  });

  assert.equal(accepted.statusCode, 200);
  assert.equal(reusedEventId.statusCode, 409);
  assert.equal(reusedEventId.json().error.code, 'idempotency_key_conflict');
  assert.equal(reusedCursor.statusCode, 409);
  assert.equal(reusedCursor.json().error.code, 'device_cursor_conflict');
});

test('content endpoint fails closed when no approved release is active', async t => {
  const {app} = await createTestApp();
  t.after(() => app.close());
  const session = await authenticate(app);

  const response = await app.inject({
    method: 'GET',
    url: '/v2/content/manifest?track=cet4',
    headers: {authorization: `Bearer ${session.access_token}`},
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, 'content_release_unavailable');
});

test('learning events fail closed for an unknown or unapproved content release', async t => {
  const {app} = await createTestApp();
  t.after(() => app.close());
  const session = await authenticate(app);

  const response = await app.inject({
    method: 'POST',
    url: '/v2/learning/events',
    headers: {authorization: `Bearer ${session.access_token}`},
    payload: {
      events: [
        {
          answer_grade: 'good',
          card_id: '002001',
          client_timestamp: FIXED_NOW.toISOString(),
          content_release_id: 'unapproved-release',
          device_cursor: 1,
          device_id: 'e79b8c93-7ca6-46cf-a2de-542b3c927fd1',
          event_id: 'af6001ed-407b-4a6b-b084-453329a59a66',
          interaction_id: 'flip',
          phase: 'learning',
          track: 'cet4',
          used_hint: false,
          used_peek: false,
        },
      ],
    },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, 'content_release_unavailable');
});

test('account deletion queues work and revokes all current access', async t => {
  const {app} = await createTestApp();
  t.after(() => app.close());
  const session = await authenticate(app);
  const headers = {authorization: `Bearer ${session.access_token}`};

  const deletion = await app.inject({
    method: 'POST',
    url: '/v2/account/deletion',
    headers,
  });
  const afterDeletion = await app.inject({
    method: 'GET',
    url: '/v2/bootstrap?track=cet4&day_key=2026-07-12',
    headers,
  });

  assert.equal(deletion.statusCode, 202);
  assert.equal(deletion.json().data.status, 'queued');
  assert.equal(afterDeletion.statusCode, 401);

  const nextChallenge = await app.inject({
    method: 'POST',
    url: '/v2/auth/request-code',
    payload: {phone_number: PHONE},
  });
  const relogin = await app.inject({
    method: 'POST',
    url: '/v2/auth/verify-code',
    payload: {
      challenge_id: nextChallenge.json().data.challenge_id,
      phone_number: PHONE,
      sms_code: SMS_CODE,
    },
  });
  assert.equal(relogin.statusCode, 409);
  assert.equal(relogin.json().error.code, 'account_deletion_pending');
});

test('bootstrap rejects impossible calendar day keys as invalid requests', async t => {
  const {app} = await createTestApp();
  t.after(() => app.close());
  const session = await authenticate(app);

  const response = await app.inject({
    method: 'GET',
    url: '/v2/bootstrap?track=cet4&day_key=2026-02-31',
    headers: {authorization: `Bearer ${session.access_token}`},
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'invalid_request');
  assert.equal(response.headers['cache-control'], 'no-store');
});

test('production configuration rejects development SMS and wildcard CORS', () => {
  assert.throws(
    () =>
      loadApiConfig({
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '8080',
        DATABASE_URL: 'postgresql://softbook:secret@db/softbook',
        DATABASE_SSL: 'true',
        ALLOWED_ORIGINS: '*',
        PHONE_LOOKUP_SECRET: 'a'.repeat(32),
        PHONE_ENCRYPTION_KEY_BASE64: ENCRYPTION_KEY,
        TOKEN_HASH_SECRET: 'b'.repeat(32),
        SMS_PROVIDER: 'dev',
        SMS_DEV_CODE: SMS_CODE,
      }),
    /Production requires SMS_PROVIDER=tencent/,
  );
});

test('phone protection supports lookup without storing plaintext', () => {
  const protector = new PhoneProtector('lookup-secret-that-is-long-enough', ENCRYPTION_KEY);
  const ciphertext = protector.encrypt(PHONE);

  assert.doesNotMatch(ciphertext, new RegExp(PHONE));
  assert.equal(protector.decrypt(ciphertext), PHONE);
  assert.equal(protector.lookupHash(PHONE).length, 64);
});

test('canonical day keys roll over at midnight in China, not UTC', () => {
  assert.equal(
    toChinaDayKey(new Date('2026-07-11T15:59:59.999Z')),
    '2026-07-11',
  );
  assert.equal(
    toChinaDayKey(new Date('2026-07-11T16:00:00.000Z')),
    '2026-07-12',
  );
});
