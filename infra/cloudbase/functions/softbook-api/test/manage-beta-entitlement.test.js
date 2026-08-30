const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  mkdtempSync,
  readFileSync,
  rmSync,
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
  assert.equal(first.repository_commit, 'a'.repeat(40));
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
          head: 'a'.repeat(40),
          originMain: 'a'.repeat(40),
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
    /full lowercase repository commit SHA-1/,
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
    /beta operator secret is missing or weak/,
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
  const directory = mkdtempSync(join(tmpdir(), 'beta-entitlement-test-'));
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
      head: 'a'.repeat(40),
      originMain: 'a'.repeat(40),
    },
    operatorSecret: 'beta-operator-secret-0123456789-ABCDEFG',
    runner,
  };
}

function createRunner({
  includeBetaSecret = true,
  mutateMembershipAfterInvocation = false,
  remoteBackendDeploymentId = null,
  responseActionOverride = null,
} = {}) {
  const collections = new Map([
    ['softbook_beta_entitlements', new Map()],
    ['softbook_memberships', new Map()],
  ]);
  let updates = 0;
  let invocations = 0;
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
    repositoryCommit: 'a'.repeat(40),
  });
  return {
    invokeCount: () => invocations,
    updateCount: () => updates,
    async run(args) {
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
            const document = collections
              .get(wrapper.TableName)
              ?.get(command.filter._id);
            return document
              ? [{_id: command.filter._id, ...structuredClone(document)}]
              : [];
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
