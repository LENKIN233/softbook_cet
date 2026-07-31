const assert = require('node:assert/strict');
const {
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
const temporaryDirectories = [];
const COMMIT = 'a'.repeat(40);
const RUN_ID = 'sms-smoke-123e4567-e89b-12d3-a456-426614174000';

before(async () => {
  smoke = await import(pathToFileURL(resolve(__dirname, '../../../smoke-sms-provider.mjs')));
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

test('human confirmation publishes a strict PII-free report only after private state removal', async () => {
  const fixture = createFixture();
  await prepareFixture(fixture);
  const report = smoke.confirmSmsProviderSmoke({
    apply: true,
    clock: () => new Date('2026-07-29T07:02:00.000Z'),
    receivedCode: '482913',
    reportPath: fixture.report,
    repository: repositoryFixture(),
    repositoryRoot: fixture.root,
    statePath: fixture.state,
    verifier: 'github:LENKIN233',
  });

  assert.deepEqual(smoke.validateSmsProviderSmokeReport(report), []);
  assert.equal(require('node:fs').existsSync(fixture.state), false);
  assert.equal(require('node:fs').existsSync(fixture.report), true);
  const serialized = readFileSync(fixture.report, 'utf8');
  assert.equal(serialized.includes('13800138000'), false);
  assert.equal(serialized.includes('482913'), false);
  assert.equal(serialized.includes('provider-request-id'), false);
  assert.equal(report.private_state_removed, true);
  assert.equal(report.verifier.kind, 'human');
  assert.match(report.provider_receipt.provider_request_fingerprint, /^[0-9a-f]{64}$/);
});

test('wrong confirmation is bounded and removes private state after the third attempt', async () => {
  const fixture = createFixture();
  await prepareFixture(fixture);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    assert.throws(
      () =>
        smoke.confirmSmsProviderSmoke({
          apply: true,
          clock: () => new Date('2026-07-29T07:02:00.000Z'),
          receivedCode: '000000',
          reportPath: fixture.report,
          repository: repositoryFixture(),
          repositoryRoot: fixture.root,
          statePath: fixture.state,
          verifier: 'github:LENKIN233',
        }),
      /confirmation failed/,
    );
    assert.equal(require('node:fs').existsSync(fixture.state), true);
  }
  assert.throws(
    () =>
      smoke.confirmSmsProviderSmoke({
        apply: true,
        clock: () => new Date('2026-07-29T07:02:00.000Z'),
        receivedCode: '000000',
        reportPath: fixture.report,
        repository: repositoryFixture(),
        repositoryRoot: fixture.root,
        statePath: fixture.state,
        verifier: 'github:LENKIN233',
      }),
    /private state was removed/,
  );
  assert.equal(require('node:fs').existsSync(fixture.state), false);
  assert.equal(require('node:fs').existsSync(fixture.report), false);
});

test('expired confirmation removes private state and never creates evidence', async () => {
  const fixture = createFixture();
  await prepareFixture(fixture);
  assert.throws(
    () =>
      smoke.confirmSmsProviderSmoke({
        apply: true,
        clock: () => new Date('2026-07-29T07:05:01.000Z'),
        receivedCode: '482913',
        reportPath: fixture.report,
        repository: repositoryFixture(),
        repositoryRoot: fixture.root,
        statePath: fixture.state,
        verifier: 'github:LENKIN233',
      }),
    /expired/,
  );
  assert.equal(require('node:fs').existsSync(fixture.state), false);
  assert.equal(require('node:fs').existsSync(fixture.report), false);
});

test('agent-like verifier identities and report tampering fail closed', async () => {
  const fixture = createFixture();
  await prepareFixture(fixture);
  assert.throws(
    () =>
      smoke.confirmSmsProviderSmoke({
        apply: true,
        clock: () => new Date('2026-07-29T07:02:00.000Z'),
        receivedCode: '482913',
        reportPath: fixture.report,
        repository: repositoryFixture(),
        repositoryRoot: fixture.root,
        statePath: fixture.state,
        verifier: 'github:codex-agent',
      }),
    /human and not an agent/,
  );

  const validFixture = createFixture();
  await prepareFixture(validFixture);
  const report = smoke.confirmSmsProviderSmoke({
    apply: true,
    clock: () => new Date('2026-07-29T07:02:00.000Z'),
    receivedCode: '482913',
    reportPath: validFixture.report,
    repository: repositoryFixture(),
    repositoryRoot: validFixture.root,
    statePath: validFixture.state,
    verifier: 'github:LENKIN233',
  });
  report.phone_fingerprint = 'not-a-hash';
  report.delivery = 'sms_webhook';
  assert.match(smoke.validateSmsProviderSmokeReport(report).join(';'), /phone_fingerprint|delivery/);
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
      '--apply',
      '--format',
      'json',
    ]),
    {
      apply: true,
      command: 'confirm',
      format: 'json',
      reportPath: 'docs/release/evidence/raw/report.json',
      statePath: 'docs/agent-runs/artifacts/state.json',
    },
  );
  assert.throws(() => smoke.parseArguments(['confirm', '--state', 'state.json']), /--report/);
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
    phone_number: '13800138000',
    code: '482913',
    created_at: '2026-07-29T07:00:00.000Z',
    expires_at: '2026-07-29T07:05:00.000Z',
    sent_at: null,
    failed_confirmation_attempts: 0,
    provider_receipt: null,
  };
}
