import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {Pool} from 'pg';

import {createProductionApi} from '../src/app.js';
import {PostgresProductionRepository} from '../src/postgresRepository.js';
import {PhoneProtector, SecretHasher} from '../src/security.js';
import {DevSmsProvider} from '../src/sms.js';

const databaseUrl = process.env.TEST_DATABASE_URL;

test(
  'PostgreSQL repository preserves auth, idempotency, bootstrap, and deletion contracts',
  {skip: !databaseUrl},
  async t => {
    const pool = new Pool({connectionString: databaseUrl});
    let app: Awaited<ReturnType<typeof createProductionApi>> | null = null;
    t.after(async () => {
      if (app) {
        await app.close();
      } else {
        await pool.end();
      }
    });
    const migration = await fs.readFile(
      path.resolve(process.cwd(), 'migrations/001_initial.sql'),
      'utf8',
    );
    await pool.query(migration);
    await pool.query(
      `TRUNCATE TABLE
         audit_events,
         account_deletion_jobs,
         content_packs,
         content_releases,
         space_states,
         review_schedule_states,
         learning_events,
         daily_progress,
         subscription_transactions,
         payment_orders,
         membership_entitlements,
         device_installations,
         auth_sessions,
         sms_challenges,
         users
       CASCADE`,
    );
    await pool.query(
      `INSERT INTO content_releases (
         id, track, minimum_client_version, manifest_sha256, signature,
         signature_key_id, approval_record_sha256, status, activated_at
       ) VALUES (
         'approved-cet4-v1', 'cet4', '1.0.0', repeat('c', 64),
         'dGVzdC1zaWduYXR1cmU=', 'softbook-content-test-1', repeat('b', 64),
         'active', now()
       )`,
    );

    const repository = new PostgresProductionRepository(pool);
    app = await createProductionApi({
      allowedOrigins: ['https://app.softbook.example'],
      codeHasher: new SecretHasher('postgres-code-secret-that-is-long-enough'),
      environment: 'test',
      generateSmsCode: () => '2468',
      phoneProtector: new PhoneProtector(
        'postgres-phone-secret-that-is-long-enough',
        Buffer.alloc(32, 9).toString('base64'),
      ),
      repository,
      smsProvider: new DevSmsProvider('2468'),
      tokenHasher: new SecretHasher('postgres-token-secret-that-is-long-enough'),
      now: () => new Date('2026-07-12T08:00:00.000Z'),
    });

    const codeResponse = await app.inject({
      method: 'POST',
      url: '/v2/auth/request-code',
      payload: {phone_number: '13800138000'},
    });
    const verifyResponse = await app.inject({
      method: 'POST',
      url: '/v2/auth/verify-code',
      payload: {
        challenge_id: codeResponse.json().data.challenge_id,
        phone_number: '13800138000',
        sms_code: '2468',
      },
    });
    assert.equal(verifyResponse.statusCode, 200);
    const accessToken = verifyResponse.json().data.access_token as string;
    const headers = {authorization: `Bearer ${accessToken}`};
    const event = {
      answer_grade: 'good',
      card_id: '002001',
      client_timestamp: '2026-07-12T08:00:00.000Z',
      content_release_id: 'approved-cet4-v1',
      device_cursor: 1,
      device_id: 'e79b8c93-7ca6-46cf-a2de-542b3c927fd1',
      event_id: '1a2e9966-5f47-49e8-ae94-9ecb89694793',
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
    const duplicate = await app.inject({
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
    const deletion = await app.inject({
      method: 'POST',
      url: '/v2/account/deletion',
      headers,
    });

    assert.equal(accepted.json().data.accepted_count, 1);
    assert.equal(duplicate.json().data.duplicate_count, 1);
    assert.equal(bootstrap.statusCode, 200);
    assert.equal(bootstrap.json().data.learning_state.events.length, 1);
    assert.equal(deletion.statusCode, 202);

    const rows = await pool.query<{
      phone_ciphertext: string;
      phone_lookup_hash: string;
    }>('SELECT phone_ciphertext, phone_lookup_hash FROM users');
    assert.equal(rows.rowCount, 1);
    assert.doesNotMatch(rows.rows[0]!.phone_ciphertext, /13800138000/);
    assert.equal(rows.rows[0]!.phone_lookup_hash.length, 64);
  },
);
