const assert = require('node:assert/strict');
const {createHash, generateKeyPairSync} = require('node:crypto');
const {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} = require('node:fs');
const {tmpdir} = require('node:os');
const {join, resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {after, before, test} = require('node:test');

let smoke;
let receiverAdapter;
const temporaryDirectories = [];
const COMMIT = 'a'.repeat(40);
const RUN_ID = 'sms-smoke-123e4567-e89b-12d3-a456-426614174000';
const RECEIVER_ADAPTER_ID = 'service:sms-receiver-adapter';
const RECEIVER_KEY_ID = 'receiver-ed25519-key-v1';
const RECEIVER_KEYS = generateKeyPairSync('ed25519');
const WRONG_RECEIVER_KEYS = generateKeyPairSync('ed25519');
const RECEIVER_PRIVATE_KEY = RECEIVER_KEYS.privateKey.export({
  format: 'pem',
  type: 'pkcs8',
});
const RECEIVER_PUBLIC_KEY = RECEIVER_KEYS.publicKey.export({
  format: 'pem',
  type: 'spki',
});
const RECEIVER_PUBLIC_KEY_FINGERPRINT = createHash('sha256')
  .update(RECEIVER_KEYS.publicKey.export({format: 'der', type: 'spki'}))
  .digest('hex');
const MACHINE_CONFIRMATION = Object.freeze({
  receiverAdapterId: RECEIVER_ADAPTER_ID,
  receiverKeyId: RECEIVER_KEY_ID,
  receiverPublicKey: RECEIVER_PUBLIC_KEY,
  verifier: 'service:sms-receiver-verifier',
  verificationRunId: 'sms-receiver-run-001',
});

before(async () => {
  smoke = await import(pathToFileURL(resolve(__dirname, '../../../smoke-sms-provider.mjs')));
  receiverAdapter = await import(
    pathToFileURL(resolve(__dirname, '../../../sms-receiver-adapter.mjs'))
  );
});

after(() => {
  for (const directory of temporaryDirectories) rmSync(directory, {force: true, recursive: true});
});

test('SMS smoke dry-run validates provider configuration without sending or writing state', async () => {
  const fixture = createFixture();
  let sends = 0;
  const result = await smoke.prepareSmsProviderSmoke({
    apply: false,
    env: smokeEnvironment(),
    providerFactory: () => ({
      delivery: 'sms_tencentcloud',
      kind: 'tencentcloud',
      sendCode: async () => {
        sends += 1;
      },
    }),
    repository: {...repositoryFixture(), branch: 'infra/topic', dirty: true},
    repositoryRoot: fixture.root,
    runId: RUN_ID,
    statePath: fixture.state,
  });

  assert.equal(result.status, 'dry_run');
  assert.equal(result.repository_ready, false);
  assert.equal(sends, 0);
  assert.equal(require('node:fs').existsSync(fixture.state), false);
  assert.equal(JSON.stringify(result).includes('13800138000'), false);
});

test('SMS smoke prepare writes only private state and returns a redacted summary', async () => {
  const fixture = createFixture();
  const calls = [];
  const result = await prepareFixture(fixture, calls);
  const state = JSON.parse(readFileSync(fixture.state, 'utf8'));

  assert.equal(result.status, 'sent');
  assert.equal(result.provider, 'tencentcloud');
  assert.equal(JSON.stringify(result).includes('13800138000'), false);
  assert.equal(JSON.stringify(result).includes('482913'), false);
  assert.equal(statSync(fixture.state).mode & 0o077, 0);
  assert.equal(state.phone_number, '13800138000');
  assert.equal(state.code, '482913');
  assert.equal(state.status, 'sent');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    challengeId: RUN_ID,
    code: '482913',
    expiresAt: '2026-07-29T07:05:00.000Z',
    phoneNumber: '13800138000',
  });
});

test('automated receiver confirmation publishes a strict PII-free report only after private state removal', async () => {
  const fixture = createFixture();
  await prepareFixture(fixture);
  writeReceiverEvidence(fixture);
  assert.equal(statSync(fixture.receiverEvidence).mode & 0o077, 0);
  const report = smoke.confirmSmsProviderSmoke({
    apply: true,
    clock: () => new Date('2026-07-29T07:02:00.000Z'),
    receiverEvidencePath: fixture.receiverEvidence,
    reportPath: fixture.report,
    repository: repositoryFixture(),
    repositoryRoot: fixture.root,
    statePath: fixture.state,
    ...MACHINE_CONFIRMATION,
  });

  assert.deepEqual(smoke.validateSmsProviderSmokeReport(report), []);
  assert.equal(existsSync(fixture.state), false);
  assert.equal(existsSync(fixture.receiverEvidence), false);
  assert.equal(existsSync(fixture.report), true);
  const serialized = readFileSync(fixture.report, 'utf8');
  assert.equal(serialized.includes('13800138000'), false);
  assert.equal(serialized.includes('482913'), false);
  assert.equal(serialized.includes('provider-request-id'), false);
  assert.equal(serialized.includes('device-receipt-001'), false);
  assert.equal(serialized.includes('device_sms_inbox'), false);
  assert.equal(serialized.includes(RECEIVER_ADAPTER_ID), false);
  assert.equal(report.private_state_removed, true);
  assert.equal(report.confirmation_method, 'automated_receiver_code_match');
  assert.equal(report.verifier.kind, 'machine');
  assert.equal(report.verifier.id, MACHINE_CONFIRMATION.verifier);
  assert.equal(report.verifier.run_id, MACHINE_CONFIRMATION.verificationRunId);
  assert.deepEqual(Object.keys(report.receiver_evidence).sort(), [
    'artifact_removed',
    'artifact_sha256',
    'key_fingerprint',
    'key_id',
    'received_at',
    'signature_verified',
  ]);
  assert.match(report.receiver_evidence.artifact_sha256, /^[0-9a-f]{64}$/);
  assert.match(report.receiver_evidence.key_fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(report.receiver_evidence.key_id, RECEIVER_KEY_ID);
  assert.equal(report.receiver_evidence.received_at, '2026-07-29T07:01:00.000Z');
  assert.equal(report.receiver_evidence.signature_verified, true);
  assert.equal(report.receiver_evidence.artifact_removed, true);
  assert.match(report.provider_receipt.provider_request_fingerprint, /^[0-9a-f]{64}$/);
});

test('wrong confirmation is bounded and removes private state after the third attempt', async () => {
  const fixture = createFixture();
  await prepareFixture(fixture);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    writeReceiverEvidence(fixture, {
      code: '000000',
      receiptId: `device-receipt-wrong-${attempt}`,
    });
    assert.throws(
      () =>
        smoke.confirmSmsProviderSmoke({
          apply: true,
          clock: () => new Date('2026-07-29T07:02:00.000Z'),
          receiverEvidencePath: fixture.receiverEvidence,
          reportPath: fixture.report,
          repository: repositoryFixture(),
          repositoryRoot: fixture.root,
          statePath: fixture.state,
          ...MACHINE_CONFIRMATION,
        }),
      /confirmation failed/,
    );
    assert.equal(existsSync(fixture.state), true);
    assert.equal(existsSync(fixture.receiverEvidence), false);
  }
  writeReceiverEvidence(fixture, {
    code: '000000',
    receiptId: 'device-receipt-wrong-3',
  });
  assert.throws(
    () =>
      smoke.confirmSmsProviderSmoke({
        apply: true,
        clock: () => new Date('2026-07-29T07:02:00.000Z'),
        receiverEvidencePath: fixture.receiverEvidence,
        reportPath: fixture.report,
        repository: repositoryFixture(),
        repositoryRoot: fixture.root,
        statePath: fixture.state,
        ...MACHINE_CONFIRMATION,
      }),
    /private state was removed/,
  );
  assert.equal(existsSync(fixture.state), false);
  assert.equal(existsSync(fixture.receiverEvidence), false);
  assert.equal(existsSync(fixture.report), false);
});

test('expired confirmation removes private state and never creates evidence', async () => {
  const fixture = createFixture();
  await prepareFixture(fixture);
  writeReceiverEvidence(fixture);
  assert.throws(
    () =>
      smoke.confirmSmsProviderSmoke({
        apply: true,
        clock: () => new Date('2026-07-29T07:05:01.000Z'),
        receiverEvidencePath: fixture.receiverEvidence,
        reportPath: fixture.report,
        repository: repositoryFixture(),
        repositoryRoot: fixture.root,
        statePath: fixture.state,
        ...MACHINE_CONFIRMATION,
      }),
    /expired/,
  );
  assert.equal(existsSync(fixture.state), false);
  assert.equal(existsSync(fixture.receiverEvidence), false);
  assert.equal(existsSync(fixture.report), false);
});

test('human verifier identities fail while model-harness receiver evidence and report validation remain strict', async () => {
  const fixture = createFixture();
  await prepareFixture(fixture);
  writeReceiverEvidence(fixture);
  assert.throws(
    () =>
      smoke.confirmSmsProviderSmoke({
        apply: true,
        clock: () => new Date('2026-07-29T07:02:00.000Z'),
        receiverEvidencePath: fixture.receiverEvidence,
        reportPath: fixture.report,
        repository: repositoryFixture(),
        repositoryRoot: fixture.root,
        statePath: fixture.state,
        verifier: 'github:human-reviewer',
        receiverAdapterId: RECEIVER_ADAPTER_ID,
        receiverKeyId: RECEIVER_KEY_ID,
        receiverPublicKey: RECEIVER_PUBLIC_KEY,
        verificationRunId: 'sms-receiver-run-001',
      }),
    /machine principal/,
  );

  const validFixture = createFixture();
  await prepareFixture(validFixture);
  writeReceiverEvidence(validFixture);
  const report = smoke.confirmSmsProviderSmoke({
    apply: true,
    clock: () => new Date('2026-07-29T07:02:00.000Z'),
    receiverEvidencePath: validFixture.receiverEvidence,
    reportPath: validFixture.report,
    repository: repositoryFixture(),
    repositoryRoot: validFixture.root,
    statePath: validFixture.state,
    ...MACHINE_CONFIRMATION,
  });
  report.phone_fingerprint = 'not-a-hash';
  report.delivery = 'sms_webhook';
  assert.match(smoke.validateSmsProviderSmokeReport(report).join(';'), /phone_fingerprint|delivery/);
});

test('forged, wrong-key, wrong-key-id, and tampered receiver artifacts fail before code matching', async () => {
  const cases = [
    {
      expected: /signature verification failed/,
      mutate(artifact) {
        artifact.signature = Buffer.alloc(64, 7).toString('base64');
      },
    },
    {
      expected: /public key fingerprint changed after prepare/,
      confirmation: {
        receiverPublicKey: WRONG_RECEIVER_KEYS.publicKey.export({
          format: 'pem',
          type: 'spki',
        }),
      },
    },
    {
      expected: /key_id does not match/,
      evidence: {keyId: 'receiver-ed25519-key-wrong'},
    },
    {
      expected: /signature verification failed/,
      mutate(artifact) {
        artifact.code = '482914';
      },
    },
  ];

  for (const [index, testCase] of cases.entries()) {
    const fixture = createFixture();
    await prepareFixture(fixture);
    writeReceiverEvidence(fixture, {
      receiptId: `negative-receipt-${index}`,
      ...testCase.evidence,
    });
    if (testCase.mutate) {
      const artifact = JSON.parse(readFileSync(fixture.receiverEvidence, 'utf8'));
      testCase.mutate(artifact);
      writeFileSync(
        fixture.receiverEvidence,
        `${JSON.stringify(artifact, null, 2)}\n`,
      );
      chmodSync(fixture.receiverEvidence, 0o600);
    }
    assert.throws(
      () =>
        smoke.confirmSmsProviderSmoke({
          apply: true,
          clock: () => new Date('2026-07-29T07:02:00.000Z'),
          receiverEvidencePath: fixture.receiverEvidence,
          reportPath: fixture.report,
          repository: repositoryFixture(),
          repositoryRoot: fixture.root,
          statePath: fixture.state,
          ...MACHINE_CONFIRMATION,
          ...testCase.confirmation,
        }),
      testCase.expected,
    );
    assert.equal(existsSync(fixture.state), true);
    assert.equal(existsSync(fixture.report), false);
  }
});

test('receiver artifact, adapter identity, and verification key are all mandatory', async () => {
  const fixture = createFixture();
  await prepareFixture(fixture);
  writeReceiverEvidence(fixture);
  const base = {
    apply: true,
    clock: () => new Date('2026-07-29T07:02:00.000Z'),
    receiverEvidencePath: fixture.receiverEvidence,
    reportPath: fixture.report,
    repository: repositoryFixture(),
    repositoryRoot: fixture.root,
    statePath: fixture.state,
    ...MACHINE_CONFIRMATION,
  };

  assert.throws(
    () => smoke.confirmSmsProviderSmoke({...base, receiverAdapterId: undefined}),
    /trust configuration changed after prepare/,
  );
  assert.throws(
    () => smoke.confirmSmsProviderSmoke({...base, receiverPublicKey: undefined}),
    /PUBLIC_KEY/,
  );
  assert.throws(
    () => smoke.confirmSmsProviderSmoke({...base, receiverKeyId: undefined}),
    /trust configuration changed after prepare/,
  );
  assert.throws(
    () => smoke.confirmSmsProviderSmoke({...base, verifier: RECEIVER_ADAPTER_ID}),
    /independent from the receiver adapter/,
  );
  assert.throws(
    () =>
      smoke.confirmSmsProviderSmoke({
        ...base,
        receiverPrivateKey: RECEIVER_PRIVATE_KEY,
      }),
    /must not have access to the receiver private key/,
  );
  assert.throws(
    () =>
      smoke.confirmSmsProviderSmoke({
        ...base,
        receiverEvidencePath: join(
          resolve(fixture.receiverEvidence, '..'),
          'missing-receiver-evidence.json',
        ),
      }),
    /artifact is required and missing/,
  );
  assert.equal(existsSync(fixture.state), true);
  assert.equal(existsSync(fixture.report), false);
});

test('receiver evidence cannot be consumed through a symbolic link', async () => {
  const fixture = createFixture();
  await prepareFixture(fixture);
  const outside = join(fixture.root, 'outside-receiver-evidence.json');
  const artifact = receiverAdapter.createSmsReceiverEvidence({
    adapterId: RECEIVER_ADAPTER_ID,
    code: '482913',
    keyId: RECEIVER_KEY_ID,
    privateKey: RECEIVER_PRIVATE_KEY,
    receiptId: 'outside-device-receipt',
    receivedAt: '2026-07-29T07:01:00.000Z',
    runId: RUN_ID,
    source: 'device_sms_inbox',
    target: 'receiver-closed-beta',
  });
  writeFileSync(outside, `${JSON.stringify(artifact, null, 2)}\n`, {mode: 0o600});
  mkdirSync(resolve(fixture.receiverEvidence, '..'), {recursive: true});
  symlinkSync(outside, fixture.receiverEvidence);

  assert.throws(
    () =>
      smoke.confirmSmsProviderSmoke({
        apply: true,
        clock: () => new Date('2026-07-29T07:02:00.000Z'),
        receiverEvidencePath: fixture.receiverEvidence,
        reportPath: fixture.report,
        repository: repositoryFixture(),
        repositoryRoot: fixture.root,
        statePath: fixture.state,
        ...MACHINE_CONFIRMATION,
      }),
    /exact regular private artifact/,
  );
  assert.equal(readFileSync(outside, 'utf8').includes('482913'), true);
  assert.equal(existsSync(fixture.report), false);
});

test('state and report paths cannot escape their dedicated roots', async () => {
  const fixture = createFixture();
  await assert.rejects(
    () =>
      smoke.prepareSmsProviderSmoke({
        apply: false,
        env: smokeEnvironment(),
        providerFactory: providerFactory(),
        repository: repositoryFixture(),
        repositoryRoot: fixture.root,
        runId: RUN_ID,
        statePath: join(fixture.root, 'state.json'),
      }),
    /below/,
  );
  assert.throws(
    () =>
      smoke.confirmSmsProviderSmoke({
        apply: false,
        reportPath: join(fixture.root, 'report.json'),
        repository: repositoryFixture(),
        repositoryRoot: fixture.root,
        statePath: fixture.state,
      }),
    /below/,
  );
  assert.throws(
    () =>
      smoke.confirmSmsProviderSmoke({
        apply: false,
        reportPath: join(
          fixture.root,
          'docs',
          'release',
          'evidence',
          'direct-gate-evidence.json',
        ),
        repository: repositoryFixture(),
        repositoryRoot: fixture.root,
        statePath: fixture.state,
      }),
    /raw report.*below/,
  );
});

test('private state cannot escape through a symbolic link', () => {
  const fixture = createFixture();
  const outside = join(fixture.root, 'outside-state.json');
  mkdirSync(resolve(fixture.state, '..'), {recursive: true});
  writeFileSync(outside, `${JSON.stringify(interruptedState(), null, 2)}\n`, {mode: 0o600});
  symlinkSync(outside, fixture.state);

  assert.throws(
    () =>
      smoke.discardSmsProviderSmoke({
        apply: false,
        repositoryRoot: fixture.root,
        statePath: fixture.state,
      }),
    /mode-0600 regular file/,
  );
  assert.equal(readFileSync(outside, 'utf8').includes('13800138000'), true);
});

test('discard can clean an interrupted sending state without exposing its secrets', async () => {
  const fixture = createFixture();
  mkdirSync(resolve(fixture.state, '..'), {recursive: true});
  writeFileSync(
    fixture.state,
    `${JSON.stringify(interruptedState(), null, 2)}\n`,
    {mode: 0o600},
  );

  const result = smoke.discardSmsProviderSmoke({
    apply: true,
    repositoryRoot: fixture.root,
    statePath: fixture.state,
  });

  assert.equal(result.status, 'discarded');
  assert.equal(JSON.stringify(result).includes('13800138000'), false);
  assert.equal(JSON.stringify(result).includes('482913'), false);
  assert.equal(require('node:fs').existsSync(fixture.state), false);
});

test('CLI arguments require explicit state and report destinations', () => {
  assert.deepEqual(
    smoke.parseArguments([
      'confirm',
      '--state',
      'docs/agent-runs/artifacts/state.json',
      '--report',
      'docs/release/evidence/raw/report.json',
      '--receiver-evidence',
      'docs/agent-runs/artifacts/receiver-evidence.json',
      '--apply',
      '--format',
      'json',
    ]),
    {
      apply: true,
      command: 'confirm',
      format: 'json',
      receiverEvidencePath:
        'docs/agent-runs/artifacts/receiver-evidence.json',
      reportPath: 'docs/release/evidence/raw/report.json',
      statePath: 'docs/agent-runs/artifacts/state.json',
    },
  );
  assert.throws(
    () =>
      smoke.parseArguments([
        'confirm',
        '--state',
        'state.json',
        '--report',
        'report.json',
      ]),
    /--receiver-evidence/,
  );
  assert.throws(() => smoke.parseArguments(['prepare']), /--state/);
});

async function prepareFixture(fixture, calls = []) {
  const times = [
    new Date('2026-07-29T07:00:00.000Z'),
    new Date('2026-07-29T07:00:01.000Z'),
  ];
  return smoke.prepareSmsProviderSmoke({
    apply: true,
    clock: () => times.shift(),
    codeGenerator: () => '482913',
    env: smokeEnvironment(),
    providerFactory: providerFactory(calls),
    repository: repositoryFixture(),
    repositoryRoot: fixture.root,
    runId: RUN_ID,
    statePath: fixture.state,
  });
}

function providerFactory(calls = []) {
  return () => ({
    delivery: 'sms_tencentcloud',
    kind: 'tencentcloud',
    async sendCode(request) {
      calls.push(request);
      return {
        accepted: true,
        providerRequestId: 'provider-request-id',
        providerStatusCode: null,
      };
    },
  });
}

function smokeEnvironment() {
  return {
    SOFTBOOK_SMS_PROVIDER: 'tencentcloud',
    SOFTBOOK_SMS_SMOKE_PHONE: '13800138000',
    SOFTBOOK_SMS_SMOKE_TARGET_ID: 'receiver-closed-beta',
    SOFTBOOK_SMS_RECEIVER_ADAPTER_ID: RECEIVER_ADAPTER_ID,
    SOFTBOOK_SMS_RECEIVER_KEY_ID: RECEIVER_KEY_ID,
    SOFTBOOK_SMS_RECEIVER_PUBLIC_KEY: RECEIVER_PUBLIC_KEY,
    SOFTBOOK_SMS_TENCENT_REGION: 'ap-guangzhou',
    SOFTBOOK_SMS_TENCENT_SDK_APP_ID: '1400006666',
    SOFTBOOK_SMS_TENCENT_SIGN_NAME: '软书四六级',
    SOFTBOOK_SMS_TENCENT_TEMPLATE_ID: '1110',
    SOFTBOOK_SMS_TENCENT_TEMPLATE_PARAMETERS: 'code,expiry_minutes',
  };
}

function repositoryFixture() {
  return {branch: 'main', dirty: false, head: COMMIT, originMain: COMMIT};
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'sms-provider-smoke-test-'));
  temporaryDirectories.push(root);
  return {
    root,
    receiverEvidence: join(
      root,
      'docs',
      'agent-runs',
      'artifacts',
      'sms-receiver-evidence.json',
    ),
    state: join(root, 'docs', 'agent-runs', 'artifacts', 'sms-state.json'),
    report: join(
      root,
      'docs',
      'release',
      'evidence',
      'raw',
      'sms-report.json',
    ),
  };
}

function writeReceiverEvidence(fixture, overrides = {}) {
  return receiverAdapter.writeSmsReceiverEvidence({
    adapterId: RECEIVER_ADAPTER_ID,
    artifactPath: fixture.receiverEvidence,
    code: '482913',
    keyId: RECEIVER_KEY_ID,
    privateKey: RECEIVER_PRIVATE_KEY,
    receiptId: 'device-receipt-001',
    receivedAt: '2026-07-29T07:01:00.000Z',
    repositoryRoot: fixture.root,
    runId: RUN_ID,
    source: 'device_sms_inbox',
    target: 'receiver-closed-beta',
    ...overrides,
  });
}

function interruptedState() {
  return {
    schema_version: 'sms-provider-smoke-state.v1',
    run_id: RUN_ID,
    status: 'sending',
    target_id: 'receiver-closed-beta',
    repository_commit: COMMIT,
    provider: 'tencentcloud',
    delivery: 'sms_tencentcloud',
    provider_configuration_fingerprint:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    receiver_trust: {
      adapter_id: RECEIVER_ADAPTER_ID,
      key_id: RECEIVER_KEY_ID,
      public_key_fingerprint: RECEIVER_PUBLIC_KEY_FINGERPRINT,
    },
    phone_number: '13800138000',
    code: '482913',
    created_at: '2026-07-29T07:00:00.000Z',
    expires_at: '2026-07-29T07:05:00.000Z',
    sent_at: null,
    failed_confirmation_attempts: 0,
    provider_receipt: null,
  };
}
