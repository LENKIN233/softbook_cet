const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const crypto = require('node:crypto');
const {
  copyFileSync,
  linkSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} = require('node:fs');
const {tmpdir} = require('node:os');
const {join, resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {after, before, test} = require('node:test');

let cli;
let beta;
let deliveryCli;
let deploymentSafety;
const temporaryDirectories = [];
const REPOSITORY_ROOT = resolve(__dirname, '../../../../..');
const TEST_CONTENT_MANIFEST_PRIVATE_KEY_PEM = String(
  crypto.generateKeyPairSync('ed25519').privateKey.export({
    format: 'pem',
    type: 'pkcs8',
  }),
);
const CANONICAL_TMPDIR = realpathSync(tmpdir());
const TEST_HEAD = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: REPOSITORY_ROOT,
  encoding: 'utf8',
}).trim();

before(async () => {
  cli = await import(
    pathToFileURL(resolve(__dirname, '../../../manage-beta-entitlement.mjs'))
  );
  beta = await import(
    pathToFileURL(resolve(__dirname, '../../../beta-entitlement-v1.mjs'))
  );
  deliveryCli = await import(
    pathToFileURL(resolve(__dirname, '../../../deliver-release.mjs'))
  );
  deploymentSafety = await import(
    pathToFileURL(resolve(__dirname, '../../../deployment-safety.mjs'))
  );
});

after(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, {force: true, recursive: true});
  }
});

test('beta entitlement CLI is dry-run by default and never reports a phone number', async () => {
  const fixture = createFixture();
  const runner = createRunner();
  const options = cli.parseBetaEntitlementArguments([
    '--profile',
    fixture.profilePath,
    '--command',
    fixture.commandPath,
    '--format',
    'json',
  ]);
  const report = await cli.executeBetaEntitlementCommand(
    options,
    dependencies(runner),
  );

  assert.equal(report.status, 'planned');
  assert.equal(report.schema_version, 'beta-entitlement-report.v3');
  assert.equal(report.gate_eligible, false);
  assert.equal(report.writes_performed, false);
  assert.equal(report.plan.resulting_stage, 'premium');
  assert.equal(report.command.campaign_id, 'cet4-beta-campaign-001');
  assert.equal(report.command.command_hmac_sha256, null);
  assert.equal(Object.hasOwn(report.command, 'command_sha256'), false);
  assert.match(report.profile.profile_sha256, /^sha256:[0-9a-f]{64}$/);
  assert.equal(report.base_membership.unchanged, true);
  assert.equal(report.beta_state.active, true);
  assert.equal(report.write_safety.node_version, '22.13.0');
  assert.equal(JSON.stringify(report).includes('13800138000'), false);
  assert.equal(Object.hasOwn(report.command, 'account_fingerprint'), false);
  assert.equal(Object.hasOwn(report.plan, 'account_fingerprint'), false);
  assert.equal(runner.updateCount(), 0);
});

test('beta entitlement CLI rejects a preregistration grant without an account instance', async () => {
  const fixture = createFixture();
  const options = cli.parseBetaEntitlementArguments([
    '--profile', fixture.profilePath, '--command', fixture.commandPath,
  ]);
  await assert.rejects(
    () => cli.executeBetaEntitlementCommand(
      options,
      dependencies(createRunner({includeAccount: false})),
    ),
    /must sign in first/,
  );
});

test('beta entitlement CLI rejects cross-phone account-instance planning', async () => {
  const fixture = createFixture();
  const options = cli.parseBetaEntitlementArguments([
    '--profile', fixture.profilePath, '--command', fixture.commandPath,
  ]);
  await assert.rejects(
    () => cli.executeBetaEntitlementCommand(
      options,
      dependencies(createRunner({sessionPhone: '13900139000'})),
    ),
    /not bound to this signed-in user/,
  );
});

test('beta entitlement CLI rejects an expired active-shaped instance session', async () => {
  const fixture = createFixture();
  const options = cli.parseBetaEntitlementArguments([
    '--profile', fixture.profilePath, '--command', fixture.commandPath,
  ]);
  await assert.rejects(
    () => cli.executeBetaEntitlementCommand(
      options,
      dependencies(createRunner({
        refreshExpiresAt: '2026-08-01T00:00:00.000Z',
      })),
    ),
    /not bound to this signed-in user/,
  );
});

test('beta entitlement CLI rejects a malformed active-shaped instance session', async () => {
  const fixture = createFixture();
  const options = cli.parseBetaEntitlementArguments([
    '--profile', fixture.profilePath, '--command', fixture.commandPath,
  ]);
  await assert.rejects(
    () => cli.executeBetaEntitlementCommand(
      options,
      dependencies(createRunner({malformedSession: true})),
    ),
    /not bound to this signed-in user/,
  );
});

test('beta entitlement CLI rejects impossible active-session chronology', async () => {
  const fixture = createFixture();
  const options = cli.parseBetaEntitlementArguments([
    '--profile', fixture.profilePath, '--command', fixture.commandPath,
  ]);
  await assert.rejects(
    () => cli.executeBetaEntitlementCommand(
      options,
      dependencies(createRunner({
        accessExpiresAt: '2026-08-30T08:05:00.000Z',
        sessionUpdatedAt: '2026-08-30T08:10:00.000Z',
      })),
    ),
    /not bound to this signed-in user/,
  );
});

test('CloudBase preflight subprocess receives no Softbook runtime secrets', () => {
  const sanitized =
    cli.betaEntitlementCliInternals.operatorCredentialFreeEnvironment({
      CLOUDBASE_CLI: '/opt/tcb',
      TENCENTCLOUD_SECRET_ID: 'iam-id',
      SOFTBOOK_AUTH_TOKEN_SECRET: 'auth-secret',
      SOFTBOOK_BETA_OPERATOR_SECRET: 'beta-secret',
      SOFTBOOK_CONTENT_MANIFEST_PRIVATE_KEY_PEM: 'private-key',
    });
  assert.deepEqual(sanitized, {
    CLOUDBASE_CLI: '/opt/tcb',
    TENCENTCLOUD_SECRET_ID: 'iam-id',
  });
});

test('apply writes and verifies one auditable grant while exact replay is idempotent', async () => {
  const fixture = createFixture();
  const runner = createRunner();
  const options = cli.parseBetaEntitlementArguments([
    '--profile',
    fixture.profilePath,
    '--command',
    fixture.commandPath,
    '--apply',
  ]);
  const first = await cli.executeBetaEntitlementCommand(
    options,
    dependencies(runner),
  );
  const replay = await cli.executeBetaEntitlementCommand(
    options,
    dependencies(runner),
  );

  assert.equal(first.status, 'passed');
  assert.equal(first.preflight.backend_deployment_verified, true);
  assert.equal(
    first.preflight.backend_deployment.release_class,
    'closed_beta',
  );
  assert.equal(
    first.preflight.backend_deployment.variable_names.includes(
      'SOFTBOOK_BETA_OPERATOR_SECRET',
    ),
    true,
  );
  assert.match(first.command.command_hmac_sha256, /^hmac-sha256:[0-9a-f]{64}$/);
  assert.match(
    first.backend_deployment_id,
    /^backend-deployment:sha256:[0-9a-f]{64}$/,
  );
  assert.equal(first.beta_state_before.revision, 0);
  assert.equal(first.writes_performed, true);
  assert.equal(first.repository_commit, TEST_HEAD);
  assert.equal(first.execution.operator, 'service:receiver-operator');
  assert.equal(first.beta_state.revision, 1);
  assert.equal(first.beta_state.audit_event_count, 1);
  assert.equal(first.beta_state.active_campaign_id, 'cet4-beta-campaign-001');
  assert.equal(
    first.base_membership.before_sha256,
    first.base_membership.after_sha256,
  );
  assert.equal(replay.status, 'passed');
  assert.equal(replay.writes_performed, false);
  assert.equal(replay.result.idempotent, true);
  assert.equal(runner.updateCount(), 1);
  assert.equal(runner.invokeCount(), 2);
});

test('apply refuses topic branches even when receiver preflight passes', async () => {
  const fixture = createFixture();
  const runner = createRunner();
  const options = cli.parseBetaEntitlementArguments([
    '--profile',
    fixture.profilePath,
    '--command',
    fixture.commandPath,
    '--apply',
  ]);

  await assert.rejects(
    () =>
      cli.executeBetaEntitlementCommand(options, {
        ...dependencies(runner),
        repository: {
          branch: 'infra/beta-entitlement-audit',
          dirty: false,
          head: TEST_HEAD,
          originMain: TEST_HEAD,
        },
      }),
    /writes require branch main/,
  );
  assert.equal(runner.updateCount(), 0);
});

test('apply requires a formal actor identity and full repository commit', async () => {
  const unidentified = createFixture('closed_beta', 'receiver-operator');
  const unidentifiedRunner = createRunner();
  const unidentifiedOptions = cli.parseBetaEntitlementArguments([
    '--profile',
    unidentified.profilePath,
    '--command',
    unidentified.commandPath,
    '--apply',
  ]);
  await assert.rejects(
    () =>
      cli.executeBetaEntitlementCommand(
        unidentifiedOptions,
        dependencies(unidentifiedRunner),
      ),
    /identified model, agent, service, or OIDC actor_id/,
  );
  assert.equal(unidentifiedRunner.updateCount(), 0);

  const invalidCommit = createFixture();
  const invalidCommitRunner = createRunner();
  const invalidCommitOptions = cli.parseBetaEntitlementArguments([
    '--profile',
    invalidCommit.profilePath,
    '--command',
    invalidCommit.commandPath,
    '--apply',
  ]);
  await assert.rejects(
    () =>
      cli.executeBetaEntitlementCommand(invalidCommitOptions, {
        ...dependencies(invalidCommitRunner),
        repository: {
          branch: 'main',
          dirty: false,
          head: 'same',
          originMain: 'same',
        },
      }),
    /checked HEAD must equal repository HEAD and origin\/main/,
  );
  assert.equal(invalidCommitRunner.updateCount(), 0);
});

test('apply report remains valid when base membership changes after the receiver transaction', async () => {
  const fixture = createFixture();
  const runner = createRunner({mutateMembershipAfterInvocation: true});
  const options = cli.parseBetaEntitlementArguments([
    '--profile',
    fixture.profilePath,
    '--command',
    fixture.commandPath,
    '--apply',
  ]);
  const report = await cli.executeBetaEntitlementCommand(
    options,
    dependencies(runner),
  );

  assert.equal(report.status, 'passed');
  assert.equal(report.writes_performed, true);
  assert.equal(report.base_membership.unchanged, true);
  assert.equal(runner.updateCount(), 1);
  assert.equal(runner.invokeCount(), 1);
});

test('apply rejects a weak or missing beta operator secret before invocation', async () => {
  const fixture = createFixture();
  const runner = createRunner();
  const options = cli.parseBetaEntitlementArguments([
    '--profile',
    fixture.profilePath,
    '--command',
    fixture.commandPath,
    '--apply',
  ]);

  await assert.rejects(
    () =>
      cli.executeBetaEntitlementCommand(options, {
        ...dependencies(runner),
        operatorSecret: 'a'.repeat(32),
      }),
    /strong receiver-only secret/,
  );
  assert.equal(runner.invokeCount(), 0);
});

test('apply blocks before invocation when remote backend or beta secret drifts', async () => {
  const fixture = createFixture();
  const options = cli.parseBetaEntitlementArguments([
    '--profile',
    fixture.profilePath,
    '--command',
    fixture.commandPath,
    '--apply',
  ]);
  const backendDrift = createRunner({
    remoteBackendDeploymentId: `backend-deployment:sha256:${'d'.repeat(64)}`,
  });
  const backendReport = await cli.executeBetaEntitlementCommand(
    options,
    dependencies(backendDrift),
  );
  assert.equal(backendReport.status, 'blocked');
  assert.equal(backendReport.preflight.backend_deployment_verified, false);
  assert.match(backendReport.preflight.errors.join(';'), /backend deployment ID mismatch/);
  assert.equal(backendDrift.invokeCount(), 0);

  const missingSecret = createRunner({includeBetaSecret: false});
  const secretReport = await cli.executeBetaEntitlementCommand(
    options,
    dependencies(missingSecret),
  );
  assert.equal(secretReport.status, 'blocked');
  assert.equal(secretReport.preflight.backend_deployment_verified, false);
  assert.match(
    secretReport.preflight.errors.join(';'),
    /SOFTBOOK_BETA_OPERATOR_SECRET is missing/,
  );
  assert.equal(missingSecret.invokeCount(), 0);
});

test('apply rejects a semantically inconsistent receiver result', async () => {
  const fixture = createFixture();
  const runner = createRunner({responseActionOverride: 'revoke'});
  const options = cli.parseBetaEntitlementArguments([
    '--profile',
    fixture.profilePath,
    '--command',
    fixture.commandPath,
    '--apply',
  ]);
  await assert.rejects(
    () => cli.executeBetaEntitlementCommand(options, dependencies(runner)),
    /invocation result is invalid/,
  );
});

test('beta CLI result parser rejects letter-separated phone IDs', async () => {
  const fixture = createFixture();
  const runner = createRunner({
    responseActiveCampaignOverride: 'campaign-138a0013b8000',
  });
  const options = cli.parseBetaEntitlementArguments([
    '--profile',
    fixture.profilePath,
    '--command',
    fixture.commandPath,
    '--apply',
  ]);
  await assert.rejects(
    () => cli.executeBetaEntitlementCommand(options, dependencies(runner)),
    /semantically invalid/,
  );
});

test('beta CLI result parser rejects account-instance material', async () => {
  const fixture = createFixture();
  const runner = createRunner({
    responseActiveCampaignOverride: `account_${'a'.repeat(24)}`,
  });
  const options = cli.parseBetaEntitlementArguments([
    '--profile', fixture.profilePath,
    '--command', fixture.commandPath,
    '--apply',
  ]);
  await assert.rejects(
    () => cli.executeBetaEntitlementCommand(options, dependencies(runner)),
    /semantically invalid/,
  );
});

test('apply rejects tracked, in-repository, and symlink command inputs', async () => {
  const fixture = createFixture();
  const assertRejectedPath = async (commandPath, pattern) => {
    const runner = createRunner();
    const options = cli.parseBetaEntitlementArguments([
      '--profile',
      fixture.profilePath,
      '--command',
      commandPath,
      '--apply',
    ]);
    await assert.rejects(
      () => cli.executeBetaEntitlementCommand(options, dependencies(runner)),
      pattern,
    );
    assert.equal(runner.invokeCount(), 0);
    assert.equal(runner.callCount(), 0);
  };

  await assertRejectedPath(
    resolve(REPOSITORY_ROOT, 'spec/membership.json'),
    /outside the repository and cannot be tracked at HEAD/,
  );

  const inRepositoryDirectory = mkdtempSync(
    join(REPOSITORY_ROOT, '.beta-command-test-'),
  );
  temporaryDirectories.push(inRepositoryDirectory);
  const inRepositoryPath = join(inRepositoryDirectory, 'command.json');
  writeFileSync(inRepositoryPath, readFileSync(fixture.commandPath));
  await assertRejectedPath(
    inRepositoryPath,
    /outside the repository and cannot be tracked at HEAD/,
  );

  const symlinkDirectory = mkdtempSync(
    join(CANONICAL_TMPDIR, 'beta-command-symlink-test-'),
  );
  temporaryDirectories.push(symlinkDirectory);
  const symlinkPath = join(symlinkDirectory, 'command.json');
  symlinkSync(fixture.commandPath, symlinkPath);
  await assertRejectedPath(symlinkPath, /path components must not be symbolic links/);
});

test('beta apply rejects HEAD hardlinks, byte copies, parent symlinks, and path replacement', async () => {
  const fixture = createFixture();
  const trackedPath = resolve(REPOSITORY_ROOT, 'spec/membership.json');
  const outsideDirectory = mkdtempSync(
    join(CANONICAL_TMPDIR, 'beta-command-outside-test-'),
  );
  temporaryDirectories.push(outsideDirectory);

  const assertRejected = async (commandPath, pattern, dependencyOverrides = {}) => {
    const runner = createRunner();
    const options = cli.parseBetaEntitlementArguments([
      '--profile',
      fixture.profilePath,
      '--command',
      commandPath,
      '--apply',
    ]);
    await assert.rejects(
      () =>
        cli.executeBetaEntitlementCommand(options, {
          ...dependencies(runner),
          ...dependencyOverrides,
        }),
      pattern,
    );
    assert.equal(runner.invokeCount(), 0);
    assert.equal(runner.callCount(), 0);
  };

  const hardlinkPath = join(outsideDirectory, 'tracked-hardlink.json');
  linkSync(trackedPath, hardlinkPath);
  await assertRejected(hardlinkPath, /must not be a hard link/);

  const copiedPath = join(outsideDirectory, 'tracked-copy.json');
  copyFileSync(trackedPath, copiedPath);
  await assertRejected(copiedPath, /must not equal any exact HEAD tracked blob/);

  const realParent = mkdtempSync(
    join(CANONICAL_TMPDIR, 'beta-command-real-parent-'),
  );
  temporaryDirectories.push(realParent);
  const parentCommandPath = join(realParent, 'command.json');
  copyFileSync(fixture.commandPath, parentCommandPath);
  const linkedParent = join(outsideDirectory, 'linked-parent');
  symlinkSync(realParent, linkedParent, 'dir');
  await assertRejected(
    join(linkedParent, 'command.json'),
    /path components must not be symbolic links/,
  );

  const raceFixture = createFixture();
  await assertRejected(
    raceFixture.commandPath,
    /(path|bytes) changed while (it was being validated|they were being read)/,
    {
      beforeOperatorCommandRead(path) {
        const openedPath = `${path}.opened`;
        renameSync(path, openedPath);
        copyFileSync(openedPath, path);
      },
    },
  );
});

test('beta apply rejects symlink blobs, matching LFS material, and gitlinks before remote access', async () => {
  const fixture = createFixture();
  const commandBytes = readFileSync(fixture.commandPath);
  const commandBlobId = execFileSync('git', ['hash-object', '--stdin'], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    input: commandBytes,
  }).trim();
  const commandSha256 = crypto
    .createHash('sha256')
    .update(commandBytes)
    .digest('hex');
  const options = cli.parseBetaEntitlementArguments([
    '--profile',
    fixture.profilePath,
    '--command',
    fixture.commandPath,
    '--apply',
  ]);
  const cases = [
    {
      pattern: /must not equal any exact HEAD tracked blob/,
      snapshot: {
        entries: [{mode: '120000', oid: commandBlobId, type: 'blob'}],
        lfsPointers: [],
      },
    },
    {
      pattern: /must not match exact HEAD LFS material/,
      snapshot: {
        entries: [],
        lfsPointers: [
          {oid_sha256: commandSha256, size: commandBytes.length},
        ],
      },
    },
    {
      pattern: /contains a gitlink/,
      snapshot: {
        entries: [{mode: '160000', oid: 'a'.repeat(40), type: 'commit'}],
        lfsPointers: [],
      },
    },
  ];
  for (const {pattern, snapshot} of cases) {
    const runner = createRunner();
    await assert.rejects(
      () =>
        cli.executeBetaEntitlementCommand(options, {
          ...dependencies(runner),
          operatorHeadMaterialProbe: () => snapshot,
        }),
      pattern,
    );
    assert.equal(runner.callCount(), 0);
  }

  const pointerOid = 'b'.repeat(40);
  const pointerBytes = Buffer.from(
    `version https://git-lfs.github.com/spec/v1\noid sha256:${commandSha256}\nsize ${commandBytes.length}\n`,
  );
  const lfsGit = (_file, args) => {
    if (args[0] === 'rev-parse') return `${TEST_HEAD}\n`;
    if (args[0] === 'ls-tree') {
      return `100644 blob ${pointerOid}\tcommand.lfs\0`;
    }
    if (args[0] === 'hash-object') return `${commandBlobId}\n`;
    if (args[0] === 'cat-file' && args[1].startsWith('--batch-check')) {
      return `${pointerOid} blob ${pointerBytes.length}\n`;
    }
    if (args[0] === 'cat-file' && args[1] === '--batch') {
      return Buffer.concat([
        Buffer.from(`${pointerOid} blob ${pointerBytes.length}\n`),
        pointerBytes,
        Buffer.from('\n'),
      ]);
    }
    throw new Error(`unexpected git command ${args.join(' ')}`);
  };
  const lfsRunner = createRunner();
  await assert.rejects(
    () =>
      cli.executeBetaEntitlementCommand(options, {
        ...dependencies(lfsRunner),
        operatorCommandGit: lfsGit,
      }),
    /must not match exact HEAD LFS material/,
  );
  assert.equal(lfsRunner.callCount(), 0);
});

test('beta apply binds helper HEAD to repository snapshots and rechecks before invoke', async () => {
  const fixture = createFixture();
  const options = cli.parseBetaEntitlementArguments([
    '--profile',
    fixture.profilePath,
    '--command',
    fixture.commandPath,
    '--apply',
  ]);
  const safeRepository = {
    branch: 'main',
    dirty: false,
    head: TEST_HEAD,
    originMain: TEST_HEAD,
  };
  const driftedRepository = {
    ...safeRepository,
    head: 'd'.repeat(40),
    originMain: 'd'.repeat(40),
  };

  const initialDriftRunner = createRunner();
  await assert.rejects(
    () =>
      cli.executeBetaEntitlementCommand(options, {
        ...dependencies(initialDriftRunner),
        repositoryStateReader: () => driftedRepository,
      }),
    /checked HEAD must equal repository HEAD and origin\/main/,
  );
  assert.equal(initialDriftRunner.callCount(), 0);

  let reads = 0;
  const finalDriftRunner = createRunner();
  await assert.rejects(
    () =>
      cli.executeBetaEntitlementCommand(options, {
        ...dependencies(finalDriftRunner),
        repositoryStateReader: () =>
          reads++ === 0 ? safeRepository : driftedRepository,
      }),
    /checked HEAD must equal repository HEAD and origin\/main/,
  );
  assert.equal(finalDriftRunner.invokeCount(), 0);
});

test('beta entitlement commands reject a formal production profile', async () => {
  const fixture = createFixture('production');
  const options = cli.parseBetaEntitlementArguments([
    '--profile',
    fixture.profilePath,
    '--command',
    fixture.commandPath,
  ]);

  await assert.rejects(
    () =>
      cli.executeBetaEntitlementCommand(options, dependencies(createRunner())),
    /require a closed_beta delivery profile/,
  );
});

function createFixture(
  runtimeMode = 'closed_beta',
  actorId = 'service:receiver-operator',
) {
  const directory = mkdtempSync(
    join(CANONICAL_TMPDIR, 'beta-entitlement-test-'),
  );
  temporaryDirectories.push(directory);
  const profilePath = join(directory, 'delivery-profile.json');
  const commandPath = join(directory, 'beta-command.json');
  writeFileSync(
    profilePath,
    JSON.stringify({
      schema_version: 'delivery-profile.v1',
      profile_id:
        runtimeMode === 'production'
          ? 'receiver-formal-product'
          : 'receiver-closed-beta',
      environment_id:
        runtimeMode === 'production'
          ? 'receiver-formal-product'
          : 'receiver-cet4-beta',
      region: 'ap-shanghai',
      api_base_url: 'https://receiver.example/softbook-api',
      runtime_mode: runtimeMode,
      enabled_tracks:
        runtimeMode === 'production' ? ['cet4', 'cet6'] : ['cet4'],
      minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
      signing_key_id: 'receiver-signing-key-v1',
    }),
  );
  writeFileSync(
    commandPath,
    JSON.stringify({
      schema_version: 'beta-entitlement-command.v1',
      event_id: 'beta-event-grant-0001',
      expected_account_instance_id: `account_${'a'.repeat(24)}`,
      action: 'grant',
      phone_number: '13800138000',
      campaign_id: 'cet4-beta-campaign-001',
      grant_id: 'cet4-beta-grant-0001',
      actor_id: actorId,
      reason: 'closed_beta_access',
      occurred_at: '2026-07-29T10:00:00.000Z',
    }),
  );
  return {commandPath, profilePath};
}

function dependencies(runner) {
  return {
    nodeVersion: deploymentSafety.REQUIRED_DEPLOYMENT_NODE_VERSION,
    repository: {
      branch: 'main',
      dirty: false,
      head: TEST_HEAD,
      originMain: TEST_HEAD,
    },
    operatorSecret: 'beta-operator-secret-0123456789-ABCDEFG',
    runner,
  };
}

function createRunner({
  accessExpiresAt = '2026-08-30T08:15:00.000Z',
  includeBetaSecret = true,
  includeAccount = true,
  malformedSession = false,
  refreshExpiresAt = '2026-09-30T12:00:00.000Z',
  sessionPhone = '13800138000',
  sessionUpdatedAt = '2026-08-30T08:00:00.000Z',
  mutateMembershipAfterInvocation = false,
  remoteBackendDeploymentId = null,
  responseActionOverride = null,
  responseActiveCampaignOverride = null,
} = {}) {
  const collections = new Map([
    ['softbook_accounts', new Map(includeAccount ? [[
      'a'.repeat(64),
      {
        account_instance_id: `account_${'a'.repeat(24)}`,
        account_key: 'a'.repeat(64),
        created_at: '2026-07-29T09:00:00.000Z',
        schema_version: 'account-instance.v1',
      },
    ]] : [])],
    ['softbook_auth_sessions', new Map(includeAccount ? [[
      'session-test-beta-instance',
      {
        access_expires_at: accessExpiresAt,
        account_instance_id: `account_${'a'.repeat(24)}`,
        account_key: 'a'.repeat(64),
        created_at: '2026-08-30T08:00:00.000Z',
        device_id: null,
        device_name: null,
        phone_number: sessionPhone,
        refresh_expires_at: refreshExpiresAt,
        refresh_rotation: 0,
        refresh_token_hash: 'b'.repeat(64),
        revoked_at: null,
        revoked_reason: null,
        session_id: 'session-test-beta-instance',
        status: 'active',
        updated_at: sessionUpdatedAt,
        ...(malformedSession ? {unexpected: true} : {}),
      },
    ]] : [])],
    ['softbook_beta_entitlements', new Map()],
    ['softbook_memberships', new Map()],
  ]);
  let updates = 0;
  let invocations = 0;
  let calls = 0;
  const backendDeploymentId = deliveryCli.buildBackendDeploymentId({
    profile: {
      schema_version: 'delivery-profile.v1',
      profile_id: 'receiver-closed-beta',
      environment_id: 'receiver-cet4-beta',
      region: 'ap-shanghai',
      api_base_url: 'https://receiver.example/softbook-api',
      runtime_mode: 'closed_beta',
      enabled_tracks: ['cet4'],
      minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
      signing_key_id: 'receiver-signing-key-v1',
    },
    repositoryCommit: TEST_HEAD,
  });
  return {
    invokeCount: () => invocations,
    callCount: () => calls,
    updateCount: () => updates,
    async run(args) {
      calls += 1;
      if (args[0] === 'env') {
        return JSON.stringify({
          data: {
            envId: 'receiver-cet4-beta',
            region: 'ap-shanghai',
            status: 'NORMAL',
            resources: {
              databases: [{InstanceId: 'tnt-receiver123', Status: 'RUNNING'}],
            },
          },
        });
      }
      if (args.includes('DescribeTables')) {
        return JSON.stringify({
          data: {
            Pager: {Total: deploymentSafety.REQUIRED_COLLECTIONS.length},
            Tables: deploymentSafety.REQUIRED_COLLECTIONS.map(TableName => ({
              TableName,
            })),
          },
        });
      }
      if (args[0] === '-e' && args.includes('fn') && args.includes('detail')) {
        return JSON.stringify({
          data: {
            FunctionName: 'softbook-api',
            Handler: 'index.main',
            Runtime: 'Nodejs20.19',
            Timeout: 10,
            Environment: {
              Variables: [
                {
                  Key: 'SOFTBOOK_BACKEND_DEPLOYMENT_ID',
                  Value: remoteBackendDeploymentId ?? backendDeploymentId,
                },
                {
                  Key: 'SOFTBOOK_CONTENT_MANIFEST_KEY_ID',
                  Value: 'receiver-signing-key-v1',
                },
                {Key: 'SOFTBOOK_RUNTIME_MODE', Value: 'production'},
                {Key: 'SOFTBOOK_RELEASE_CLASS', Value: 'closed_beta'},
                {Key: 'SOFTBOOK_STORE_MODE', Value: 'cloudbase'},
                {Key: 'SOFTBOOK_SMS_PROVIDER', Value: 'webhook'},
                {
                  Key: 'SOFTBOOK_AUTH_INDEX_SECRET',
                  Value: 'index-secret-0123456789-ABCDEFGHIJK',
                },
                {
                  Key: 'SOFTBOOK_AUTH_TOKEN_SECRET',
                  Value: 'token-secret-9876543210-ZYXWVUTSRQP',
                },
                {
                  Key: 'SOFTBOOK_CONTENT_MANIFEST_PRIVATE_KEY_PEM',
                  Value: TEST_CONTENT_MANIFEST_PRIVATE_KEY_PEM,
                },
                {
                  Key: 'SOFTBOOK_SMS_WEBHOOK_SECRET',
                  Value: 'sms-webhook-secret-0123456789-ABCDEFG',
                },
                {
                  Key: 'SOFTBOOK_SMS_WEBHOOK_URL',
                  Value: 'https://sms.example/softbook/send',
                },
                ...(includeBetaSecret
                  ? [
                      {
                        Key: 'SOFTBOOK_BETA_OPERATOR_SECRET',
                        Value:
                          'beta-operator-secret-0123456789-ABCDEFG',
                      },
                    ]
                  : []),
              ],
            },
          },
        });
      }
      if (args[0] === 'db') {
        const commands = JSON.parse(args[args.indexOf('--command') + 1]);
        const results = commands.map(wrapper => {
          const command = JSON.parse(wrapper.Command);
          if (wrapper.CommandType === 'QUERY') {
            return [...(collections.get(wrapper.TableName) ?? new Map())]
              .map(([id, document]) => ({_id: id, ...structuredClone(document)}))
              .filter(document => Object.entries(command.filter).every(
                ([field, expected]) => document[field] === expected,
              ))
              .slice(0, command.limit ?? 1);
          }
          if (wrapper.CommandType === 'UPDATE') {
            throw new Error('beta apply must not issue a direct database update');
          }
          throw new Error(`unexpected database command ${wrapper.CommandType}`);
        });
        return JSON.stringify({data: {results}});
      }
      if (args[0] === 'fn' && args[1] === 'invoke') {
        invocations += 1;
        const dataArgument = args[args.indexOf('-d') + 1];
        const invocation = JSON.parse(
          readFileSync(dataArgument.slice(1), 'utf8'),
        );
        assert.deepEqual(Object.keys(invocation).sort(), [
          'backend_deployment_id',
          'command',
          'schema_version',
          'signature',
        ]);
        assert.equal(
          invocation.schema_version,
          'beta-entitlement-operator-invoke.v1',
        );
        assert.equal(invocation.backend_deployment_id, backendDeploymentId);
        const canonicalCommand = beta.validateBetaEntitlementCommand(
          invocation.command,
        );
        const expectedSignature = `hmac-sha256:${crypto
          .createHmac(
            'sha256',
            'beta-operator-secret-0123456789-ABCDEFG',
          )
          .update(
            beta.betaEntitlementInternals.stableStringify({
              schema_version: 'beta-entitlement-operator-signature.v1',
              backend_deployment_id: backendDeploymentId,
              command: canonicalCommand,
            }),
          )
          .digest('hex')}`;
        assert.equal(invocation.signature, expectedSignature);
        const current =
          collections
            .get('softbook_beta_entitlements')
            .get(canonicalCommand.phone_number) ?? null;
        const membership =
          collections
            .get('softbook_memberships')
            .get(canonicalCommand.phone_number) ?? null;
        const plan = beta.planBetaEntitlementMutation(
          canonicalCommand,
          current,
          membership?.entitlement ?? membership,
        );
        if (plan.changed) {
          updates += 1;
          collections
            .get('softbook_beta_entitlements')
            .set(canonicalCommand.phone_number, structuredClone(plan.document));
        }
        const baseMembershipSha256 = beta.betaEntitlementInternals.hashCanonical({
          entitlement: membership?.entitlement ?? membership ?? null,
          revision: 0,
        });
        const result = {
          schema_version: 'beta-entitlement-operator-result.v1',
          backend_deployment_id: backendDeploymentId,
          base_membership_sha256: baseMembershipSha256,
          beta_state_before: beta.publicBetaEntitlementState(current),
          beta_state: beta.publicBetaEntitlementState(plan.document),
          gate_eligible: false,
          result: beta.publicBetaEntitlementPlan(plan),
          status: 'passed',
          writes_performed: plan.changed,
        };
        if (responseActionOverride !== null) {
          result.result.action = responseActionOverride;
        }
        if (responseActiveCampaignOverride !== null) {
          result.beta_state.active_campaign_id =
            responseActiveCampaignOverride;
        }
        if (mutateMembershipAfterInvocation && plan.changed) {
          collections.get('softbook_memberships').set(
            canonicalCommand.phone_number,
            {
              entitlement: {
                counted_entry_count: 1,
                last_experience_ended_by: null,
                recovery_prompt_visible: false,
                stage: 'premium',
                trial_duration_days: 5,
                trial_started_at_entry_count: 1,
              },
            },
          );
        }
        return JSON.stringify({
          InvokeResult: 0,
          RetMsg: JSON.stringify(result),
        });
      }
      throw new Error(`unexpected command ${args.join(' ')}`);
    },
  };
}
