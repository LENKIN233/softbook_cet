const assert = require('node:assert/strict');
const {generateKeyPairSync} = require('node:crypto');
const {mkdtempSync, readFileSync, rmSync, writeFileSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join, resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {after, before, test} = require('node:test');

let deliveryCli;
let deploymentSafety;
let mobileRuntimeProfileContract;
const temporaryDirectories = [];
const TEST_COMMIT = 'd34ebec618d89fd92d55dcbd3ae5b924a085b6d5';

before(async () => {
  deliveryCli = await import(pathToFileURL(resolve(__dirname, '../../../deliver-release.mjs')));
  deploymentSafety = await import(
    pathToFileURL(resolve(__dirname, '../../../deployment-safety.mjs'))
  );
  mobileRuntimeProfileContract = await import(
    pathToFileURL(resolve(__dirname, '../../../../../scripts/lib/mobile_release_runtime_profile.mjs'))
  );
});

after(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, {force: true, recursive: true});
  }
});

test('unified delivery arguments keep every mutating command dry-run by default', () => {
  for (const command of ['provision', 'deploy']) {
    const parsed = deliveryCli.parseArguments([command, '--profile', 'delivery-profile.json']);
    assert.equal(parsed.apply, false);
  }
  assert.equal(
    deliveryCli.parseArguments(['publish', '--profile', 'profile.json', '--bundle', 'bundle.json'])
      .apply,
    false,
  );
  assert.equal(
    deliveryCli.parseArguments([
      'preflight',
      '--profile',
      'profile.json',
      '--mobile-runtime-profile',
      'mobile-profile.json',
    ]).mobileRuntimeProfilePath,
    'mobile-profile.json',
  );
  assert.equal(
    deliveryCli.parseArguments([
      'rollback',
      '--profile',
      'profile.json',
      '--release',
      'cet4-beta-1',
    ]).apply,
    false,
  );
  assert.throws(
    () =>
      deliveryCli.parseArguments([
        'verify',
        '--profile',
        'profile.json',
        '--bundle',
        'bundle.json',
        '--operator',
        'service:receiver-release-operator',
        '--apply',
      ]),
    /read-only/,
  );
  assert.throws(
    () =>
      deliveryCli.parseArguments([
        'deploy',
        '--profile',
        'profile.json',
        '--apply',
      ]),
    /requires --operator/,
  );
});

test('receiver runtime contains production adapters and never includes a fixed code', () => {
  const profile = profileFixture();
  const env = receiverEnvironment();
  env.SOFTBOOK_SMS_DEV_CODE = '2468';
  const backendDeploymentId = deliveryCli.buildBackendDeploymentId({
    profile,
    repositoryCommit: TEST_COMMIT,
  });
  const runtime = deliveryCli.buildReceiverRuntimeEnvironment(profile, env, {
    backendDeploymentId,
  });

  assert.equal(runtime.SOFTBOOK_RUNTIME_MODE, 'production');
  assert.equal(runtime.SOFTBOOK_BACKEND_DEPLOYMENT_ID, backendDeploymentId);
  assert.equal(runtime.SOFTBOOK_SMS_PROVIDER, 'webhook');
  assert.equal(runtime.SOFTBOOK_CONTENT_MANIFEST_KEY_ID, profile.signing_key_id);
  assert.equal(Object.hasOwn(runtime, 'SOFTBOOK_SMS_DEV_CODE'), false);
  assert.equal(Object.values(runtime).includes('2468'), false);
});

test('backend deployment identity is deterministic and receiver-profile scoped', () => {
  const profile = profileFixture();
  const first = deliveryCli.buildBackendDeploymentId({
    profile,
    repositoryCommit: TEST_COMMIT,
  });
  const repeated = deliveryCli.buildBackendDeploymentId({
    profile,
    repositoryCommit: TEST_COMMIT,
  });
  const otherCommit = deliveryCli.buildBackendDeploymentId({
    profile,
    repositoryCommit: 'c'.repeat(40),
  });
  const otherEnvironment = deliveryCli.buildBackendDeploymentId({
    profile: {...profile, environment_id: 'receiver-cet4-beta-other'},
    repositoryCommit: TEST_COMMIT,
  });

  assert.equal(first, repeated);
  assert.match(first, /^backend-deployment:sha256:[0-9a-f]{64}$/);
  assert.notEqual(first, otherCommit);
  assert.notEqual(first, otherEnvironment);
});

test('receiver API inspection binds exact deployment ID without exposing secret values', async () => {
  const expectedDeploymentId = deliveryCli.buildBackendDeploymentId({
    profile: profileFixture(),
    repositoryCommit: TEST_COMMIT,
  });
  const inspect = (
    deploymentId,
    signingKeyId = 'receiver-signing-key-v1',
  ) =>
    deliveryCli.inspectApiFunction({
      envId: 'receiver-cet4-beta',
      expectedDeploymentId,
      profile: profileFixture(),
      runner: {
        run: async () =>
          JSON.stringify({
            data: {
              FunctionName: 'softbook-api',
              Handler: 'index.main',
              Runtime: 'Nodejs20.19',
              Timeout: 10,
              Environment: {
                Variables: [
                  {Key: 'SOFTBOOK_BACKEND_DEPLOYMENT_ID', Value: deploymentId},
                  {
                    Key: 'SOFTBOOK_CONTENT_MANIFEST_KEY_ID',
                    Value: signingKeyId,
                  },
                  {Key: 'SOFTBOOK_RUNTIME_MODE', Value: 'production'},
                  {Key: 'SOFTBOOK_SMS_PROVIDER', Value: 'webhook'},
                  {Key: 'SOFTBOOK_STORE_MODE', Value: 'cloudbase'},
                  {Key: 'SOFTBOOK_AUTH_TOKEN_SECRET', Value: 'do-not-expose-this-secret'},
                ],
              },
            },
          }),
      },
    });

  const exact = await inspect(expectedDeploymentId);
  assert.equal(exact.ok, true);
  assert.equal(exact.public.backend_deployment_id, expectedDeploymentId);
  assert.equal(exact.public.signing_key_id, 'receiver-signing-key-v1');
  assert.equal(exact.public.runtime_mode, 'production');
  assert.equal(exact.public.sms_provider, 'webhook');
  assert.equal(JSON.stringify(exact.public).includes('do-not-expose-this-secret'), false);

  const drifted = await inspect(`backend-deployment:sha256:${'d'.repeat(64)}`);
  assert.equal(drifted.ok, false);
  assert.match(drifted.errors.join(';'), /backend deployment ID mismatch/);

  const signingDrift = await inspect(expectedDeploymentId, 'receiver-signing-key-v2');
  assert.equal(signingDrift.ok, false);
  assert.match(signingDrift.errors.join(';'), /signing key ID mismatch/);
});

test('formal verify reports only an exact verified retained rollback target', () => {
  const contentVersion = `sha256:${'e'.repeat(64)}`;
  const retained = {
    card_source: {
      content_version: contentVersion,
      release: {release_id: 'cet4-release-a'},
    },
    release_id: 'cet4-release-a',
    verified: true,
  };
  assert.deepEqual(deliveryCli.publicRetainedRollbackTarget(retained), {
    content_version: contentVersion,
    release_id: 'cet4-release-a',
    retention_status: 'retained',
    verified: true,
  });
  assert.equal(deliveryCli.publicRetainedRollbackTarget(null), null);
  assert.throws(
    () =>
      deliveryCli.publicRetainedRollbackTarget({
        ...retained,
        verified: false,
      }),
    /retained rollback target is invalid/,
  );
});

test('secret inspection exposes names and validation only, never values', () => {
  const env = receiverEnvironment();
  const inspection = deliveryCli.inspectReceiverSecrets(profileFixture(), env);
  const serialized = JSON.stringify(inspection.public);

  assert.equal(inspection.ok, true);
  assert.deepEqual(inspection.public.configured_names.sort(), [
    'SOFTBOOK_AUTH_INDEX_SECRET',
    'SOFTBOOK_AUTH_TOKEN_SECRET',
    'SOFTBOOK_CONTENT_MANIFEST_PRIVATE_KEY_PEM',
    'SOFTBOOK_SMS_PROVIDER',
    'SOFTBOOK_SMS_WEBHOOK_SECRET',
    'SOFTBOOK_SMS_WEBHOOK_URL',
  ]);
  for (const value of Object.values(env)) {
    assert.equal(serialized.includes(value), false);
  }
});

test('receiver runtime can select Tencent Cloud SMS without carrying webhook credentials', () => {
  const env = receiverEnvironment();
  delete env.SOFTBOOK_SMS_WEBHOOK_SECRET;
  delete env.SOFTBOOK_SMS_WEBHOOK_URL;
  Object.assign(env, {
    SOFTBOOK_SMS_PROVIDER: 'tencentcloud',
    SOFTBOOK_SMS_TENCENT_REGION: 'ap-guangzhou',
    SOFTBOOK_SMS_TENCENT_SDK_APP_ID: '1400006666',
    SOFTBOOK_SMS_TENCENT_SECRET_ID: 'AKID0123456789ABCDEFGHIJKLMN',
    SOFTBOOK_SMS_TENCENT_SECRET_KEY: 'tencent-secret-key-0123456789-ABCDEFG',
    SOFTBOOK_SMS_TENCENT_SIGN_NAME: '软书四六级',
    SOFTBOOK_SMS_TENCENT_TEMPLATE_ID: '1110',
    SOFTBOOK_SMS_TENCENT_TEMPLATE_PARAMETERS: 'code,expiry_minutes',
  });

  const profile = profileFixture();
  const runtime = deliveryCli.buildReceiverRuntimeEnvironment(profile, env, {
    backendDeploymentId: deliveryCli.buildBackendDeploymentId({
      profile,
      repositoryCommit: TEST_COMMIT,
    }),
  });

  assert.equal(runtime.SOFTBOOK_SMS_PROVIDER, 'tencentcloud');
  assert.equal(runtime.SOFTBOOK_SMS_TENCENT_REGION, 'ap-guangzhou');
  assert.equal(runtime.SOFTBOOK_SMS_TENCENT_SIGN_NAME, '软书四六级');
  assert.equal(Object.hasOwn(runtime, 'SOFTBOOK_SMS_WEBHOOK_SECRET'), false);
  assert.equal(Object.hasOwn(runtime, 'SOFTBOOK_SMS_WEBHOOK_URL'), false);
});

test('receiver runtime can use the receiver CloudBase default SMS provider without SMS credentials', () => {
  const env = receiverEnvironment();
  delete env.SOFTBOOK_SMS_WEBHOOK_SECRET;
  delete env.SOFTBOOK_SMS_WEBHOOK_URL;
  Object.assign(env, {
    SOFTBOOK_CLOUDBASE_AUTH_BASE_URL:
      'https://receiver-cet4-beta.api.tcloudbasegateway.com',
    SOFTBOOK_CLOUDBASE_ENV_ID: 'receiver-cet4-beta',
    SOFTBOOK_SMS_PROVIDER: 'cloudbase-auth',
  });
  const profile = profileFixture();
  const inspection = deliveryCli.inspectReceiverSecrets(profile, env);
  const runtime = deliveryCli.buildReceiverRuntimeEnvironment(profile, env, {
    backendDeploymentId: deliveryCli.buildBackendDeploymentId({
      profile,
      repositoryCommit: TEST_COMMIT,
    }),
  });

  assert.equal(inspection.ok, true, inspection.errors.join('; '));
  assert.deepEqual(inspection.public.configured_names.sort(), [
    'SOFTBOOK_AUTH_INDEX_SECRET',
    'SOFTBOOK_AUTH_TOKEN_SECRET',
    'SOFTBOOK_CLOUDBASE_AUTH_BASE_URL',
    'SOFTBOOK_CLOUDBASE_ENV_ID',
    'SOFTBOOK_CONTENT_MANIFEST_PRIVATE_KEY_PEM',
    'SOFTBOOK_SMS_PROVIDER',
  ]);
  assert.equal(runtime.SOFTBOOK_SMS_PROVIDER, 'cloudbase-auth');
  assert.equal(
    runtime.SOFTBOOK_CLOUDBASE_AUTH_BASE_URL,
    'https://receiver-cet4-beta.api.tcloudbasegateway.com',
  );
  assert.equal(runtime.SOFTBOOK_CLOUDBASE_ENV_ID, 'receiver-cet4-beta');
  assert.equal(Object.keys(runtime).some(name => name.includes('SECRET_ID')), false);
  assert.equal(Object.keys(runtime).some(name => name.includes('SDK_APP')), false);
});

test('receiver preflight rejects an unknown provider and unsafe SMS timeout', () => {
  const unknown = receiverEnvironment();
  unknown.SOFTBOOK_SMS_PROVIDER = 'fixed-code';
  const unknownInspection = deliveryCli.inspectReceiverSecrets(profileFixture(), unknown);
  assert.equal(unknownInspection.ok, false);
  assert.match(
    unknownInspection.errors.join(';'),
    /cloudbase-auth, webhook or tencentcloud/,
  );

  const unsafeTimeout = receiverEnvironment();
  unsafeTimeout.SOFTBOOK_SMS_WEBHOOK_TIMEOUT_MS = '15001';
  const timeoutInspection = deliveryCli.inspectReceiverSecrets(profileFixture(), unsafeTimeout);
  assert.equal(timeoutInspection.ok, false);
  assert.match(timeoutInspection.errors.join(';'), /1 to 15000/);
});

test('receiver preflight reads the exact environment and reports missing collections', async () => {
  const fixture = createProfileFile();
  const runner = createCloudRunner(deploymentSafety.REQUIRED_COLLECTIONS.slice(0, -2));
  const report = await deliveryCli.executeDeliveryCommand(
    {
      apply: false,
      bundlePath: null,
      command: 'preflight',
      format: 'json',
      mobileRuntimeProfilePath: fixture.mobileRuntimeProfilePath,
      profilePath: fixture.path,
      releaseId: null,
    },
    safeDependencies(runner, fixture.env),
  );

  assert.equal(report.status, 'passed');
  assert.equal(report.schema_version, 'receiver-delivery-report.v2');
  assert.match(report.backend_deployment_id, /^backend-deployment:sha256:[0-9a-f]{64}$/);
  assert.match(report.execution.started_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(report.execution.completed_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(report.execution.operator, null);
  assert.equal(report.preflight.environment.env_id, 'receiver-cet4-beta');
  assert.equal(report.preflight.catalog.missing_required_collections.length, 2);
  assert.deepEqual(report.mobile_runtime_profile, fixture.publicBinding);
  assert.equal(
    runner.calls.some(call => call.includes('CreateTable')),
    false,
  );
});

test('CloudBase Auth preflight requires enabled phone login and the default SMS provider', async () => {
  const fixture = createProfileFile();
  delete fixture.env.SOFTBOOK_SMS_WEBHOOK_SECRET;
  delete fixture.env.SOFTBOOK_SMS_WEBHOOK_URL;
  Object.assign(fixture.env, {
    SOFTBOOK_CLOUDBASE_AUTH_BASE_URL:
      'https://receiver-cet4-beta.api.tcloudbasegateway.com',
    SOFTBOOK_CLOUDBASE_ENV_ID: 'receiver-cet4-beta',
    SOFTBOOK_SMS_PROVIDER: 'cloudbase-auth',
  });
  const enabledRunner = createCloudRunner(deploymentSafety.REQUIRED_COLLECTIONS, {
    loginConfig: {
      PhoneNumberLogin: true,
      SmsVerificationConfig: {Type: 'default'},
    },
  });
  const enabled = await deliveryCli.executeDeliveryCommand(
    {
      apply: false,
      bundlePath: null,
      command: 'preflight',
      format: 'json',
      mobileRuntimeProfilePath: fixture.mobileRuntimeProfilePath,
      profilePath: fixture.path,
      releaseId: null,
    },
    safeDependencies(enabledRunner, fixture.env),
  );
  assert.equal(enabled.status, 'passed');
  assert.deepEqual(enabled.preflight.authentication, {
    phone_number_login: true,
    provider: 'cloudbase-auth',
    ready: true,
    sms_verification_type: 'default',
  });

  const disabledRunner = createCloudRunner(deploymentSafety.REQUIRED_COLLECTIONS, {
    loginConfig: {
      PhoneNumberLogin: false,
      SmsVerificationConfig: {Type: 'default'},
    },
  });
  const disabled = await deliveryCli.executeDeliveryCommand(
    {
      apply: false,
      bundlePath: null,
      command: 'preflight',
      format: 'json',
      mobileRuntimeProfilePath: fixture.mobileRuntimeProfilePath,
      profilePath: fixture.path,
      releaseId: null,
    },
    safeDependencies(disabledRunner, fixture.env),
  );
  assert.equal(disabled.status, 'blocked');
  assert.match(disabled.preflight.errors.join('; '), /PhoneNumberLogin/);
});

test('receiver preflight rejects delivery-profile byte drift before any receiver request', async () => {
  const fixture = createProfileFile();
  const runner = createCloudRunner(deploymentSafety.REQUIRED_COLLECTIONS);
  writeFileSync(
    fixture.path,
    Buffer.concat([readFileSync(fixture.path), Buffer.from('\n')]),
  );

  await assert.rejects(
    () =>
      deliveryCli.executeDeliveryCommand(
        {
          apply: false,
          bundlePath: null,
          command: 'preflight',
          format: 'json',
          mobileRuntimeProfilePath: fixture.mobileRuntimeProfilePath,
          profilePath: fixture.path,
          releaseId: null,
        },
        safeDependencies(runner, fixture.env),
      ),
    /delivery_profile_sha256/,
  );
  assert.equal(runner.calls.length, 0);
});

test('receiver provision apply creates only missing allowlisted collections and verifies', async () => {
  const fixture = createProfileFile();
  const initial = deploymentSafety.REQUIRED_COLLECTIONS.slice(0, -2);
  const runner = createCloudRunner(initial);
  const report = await deliveryCli.executeDeliveryCommand(
    {
      apply: true,
      bundlePath: null,
      command: 'provision',
      format: 'json',
      mobileRuntimeProfilePath: fixture.mobileRuntimeProfilePath,
      operator: 'service:receiver-release-operator',
      profilePath: fixture.path,
      releaseId: null,
    },
    safeDependencies(runner, fixture.env),
  );

  assert.equal(report.status, 'passed');
  assert.equal(report.execution.operator, 'service:receiver-release-operator');
  assert.deepEqual(report.provisioned.created, deploymentSafety.REQUIRED_COLLECTIONS.slice(-2));
  assert.equal(runner.calls.filter(call => call.includes('CreateTable')).length, 2);
});

test('receiver deploy validates an isolated artifact and injects secrets only through a temporary config', async () => {
  const fixture = createProfileFile();
  const runner = createCloudRunner(deploymentSafety.REQUIRED_COLLECTIONS);
  const processCalls = [];
  const env = fixture.env;
  const report = await deliveryCli.executeDeliveryCommand(
    {
      apply: true,
      bundlePath: null,
      command: 'deploy',
      format: 'json',
      mobileRuntimeProfilePath: fixture.mobileRuntimeProfilePath,
      operator: 'service:receiver-release-operator',
      profilePath: fixture.path,
      releaseId: null,
    },
    {
      ...safeDependencies(runner),
      env,
      processRunner: {
        async run(command, args, options) {
          processCalls.push({command, args, cwd: options.cwd});
          return '';
        },
      },
    },
  );

  assert.equal(report.status, 'passed');
  assert.equal(report.deployed.backend_deployment_id, report.backend_deployment_id);
  assert.equal(
    report.deployed.api_function.backend_deployment_id,
    report.backend_deployment_id,
  );
  assert.deepEqual(report.deployed.function_names, [
    'softbook-api',
    'softbook-account-deletion-worker',
  ]);
  assert.equal(
    report.deployed.deletion_worker_trigger,
    'account-deletion-every-minute',
  );
  assert.equal(
    report.deployed.deletion_worker.handler,
    'index.accountDeletionWorkerMain',
  );
  assert.deepEqual(report.deployed.deletion_worker_runtime_variable_names, []);
  assert.deepEqual(runner.deployedConfig.functions[1].envVariables, {});
  assert.deepEqual(report.deployed.deletion_worker.trigger, {
    config: '0 */1 * * * * *',
    name: 'account-deletion-every-minute',
    type: 'timer',
  });
  assert.deepEqual(
    processCalls.map(call => [call.command, call.args[0]]),
    [
      ['npm', 'ci'],
      ['npm', 'test'],
    ],
  );
  assert.equal(runner.deployedConfig.envId, 'receiver-cet4-beta');
  assert.equal(runner.deployedConfig.functions.length, 2);
  assert.equal(runner.deployedConfig.functions[0].envVariables.SOFTBOOK_RUNTIME_MODE, 'production');
  assert.equal(
    runner.deployedConfig.functions[1].handler,
    'index.accountDeletionWorkerMain',
  );
  assert.deepEqual(runner.deployedConfig.functions[1].triggers, [
    {
      config: '0 */1 * * * * *',
      name: 'account-deletion-every-minute',
      type: 'timer',
    },
  ]);
  assert.deepEqual(
    runner.calls.find(call => call.includes('trigger')),
    [
      '-e',
      'receiver-cet4-beta',
      'fn',
      'trigger',
      'create',
      'softbook-account-deletion-worker',
      '--trigger-name',
      'account-deletion-every-minute',
      '--cron',
      '0 */1 * * * * *',
      '--json',
    ],
  );
  assert.equal(
    Object.hasOwn(runner.deployedConfig.functions[0].envVariables, 'SOFTBOOK_SMS_DEV_CODE'),
    false,
  );
  const publicReport = JSON.stringify(report);
  for (const [name, value] of Object.entries(env)) {
    if (name === 'SOFTBOOK_SMS_PROVIDER') continue;
    assert.equal(publicReport.includes(value), false);
  }
});

test('receiver deploy rejects a same-ID different Ed25519 private key before any deployment work', async () => {
  const fixture = createProfileFile();
  const runner = createCloudRunner(deploymentSafety.REQUIRED_COLLECTIONS);
  const processCalls = [];
  const mismatchedEnv = receiverEnvironment();

  await assert.rejects(
    () =>
      deliveryCli.executeDeliveryCommand(
        {
          apply: true,
          bundlePath: null,
          command: 'deploy',
          format: 'json',
          mobileRuntimeProfilePath: fixture.mobileRuntimeProfilePath,
          operator: 'service:receiver-release-operator',
          profilePath: fixture.path,
          releaseId: null,
        },
        {
          ...safeDependencies(runner, mismatchedEnv),
          processRunner: {
            async run(...args) {
              processCalls.push(args);
              return '';
            },
          },
        },
      ),
    /private key does not match the active mobile runtime public key/,
  );

  assert.equal(processCalls.length, 0);
  assert.equal(runner.calls.some(call => call.includes('deploy')), false);
});

test('account deletion worker inspection fails closed on handler or timer drift', async () => {
  const inspect = payload =>
    deliveryCli.inspectAccountDeletionWorker({
      envId: 'receiver-cet4-beta',
      runner: {
        run: async () => JSON.stringify({data: payload}),
      },
    });
  const exact = await inspect({
    FunctionName: 'softbook-account-deletion-worker',
    Handler: 'index.accountDeletionWorkerMain',
    Runtime: 'Nodejs20.19',
    Timeout: 60,
    Environment: {Variables: []},
    Triggers: [
      {
        TriggerDesc: JSON.stringify({cron: '0 */1 * * * * *'}),
        TriggerName: 'account-deletion-every-minute',
        Type: 'Timer',
      },
    ],
  });
  assert.equal(exact.ok, true);

  const drifted = await inspect({
    FunctionName: 'softbook-account-deletion-worker',
    Handler: 'index.main',
    Runtime: 'Nodejs20.19',
    Timeout: 60,
    Environment: {Variables: [{Key: 'SOFTBOOK_AUTH_TOKEN_SECRET', Value: 'x'}]},
    Triggers: [
      {
        TriggerDesc: '0 */5 * * * * *',
        TriggerName: 'account-deletion-every-minute',
        Type: 'Timer',
      },
    ],
  });
  assert.equal(drifted.ok, false);
  assert.match(drifted.errors.join(';'), /handler mismatch/);
  assert.match(drifted.errors.join(';'), /timer trigger mismatch/);
  assert.match(drifted.errors.join(';'), /must not receive API runtime secrets/);
});

test('receiver redeploy preserves an exact existing deletion timer without duplicate creation', async () => {
  const runner = createCloudRunner(deploymentSafety.REQUIRED_COLLECTIONS, {
    existingWorkerTrigger: true,
  });
  const deployed = await deliveryCli.deployReceiverFunction({
    backendDeploymentId: deliveryCli.buildBackendDeploymentId({
      profile: profileFixture(),
      repositoryCommit: TEST_COMMIT,
    }),
    env: receiverEnvironment(),
    processRunner: {
      run: async () => '',
    },
    profile: profileFixture(),
    runner,
  });

  assert.equal(deployed.deletion_worker_trigger, 'account-deletion-every-minute');
  assert.equal(runner.calls.some(call => call.includes('trigger')), false);
});

test('receiver write safety blocks topic branches even when remote preflight passes', async () => {
  const fixture = createProfileFile();
  const runner = createCloudRunner(deploymentSafety.REQUIRED_COLLECTIONS);

  await assert.rejects(
    () =>
      deliveryCli.executeDeliveryCommand(
        {
          apply: true,
          bundlePath: null,
          command: 'provision',
          format: 'json',
          mobileRuntimeProfilePath: fixture.mobileRuntimeProfilePath,
          operator: 'service:receiver-release-operator',
          profilePath: fixture.path,
          releaseId: null,
        },
        {
          ...safeDependencies(runner, fixture.env),
          repository: {
            branch: 'infra/unsafe-topic',
            dirty: false,
            head: TEST_COMMIT,
            originMain: TEST_COMMIT,
          },
        },
      ),
    /writes require branch main/,
  );
});

test('receiver user-data counts accept CloudBase Extended JSON numbers', async () => {
  const result = await deliveryCli.receiverDeliveryInternals.readUserDataCounts({
    profile: profileFixture(),
    runner: {
      async run(args) {
        const commands = JSON.parse(args[args.indexOf('--command') + 1]);
        return JSON.stringify({
          data: {
            results: commands.map(() => [
              {
                n: {$numberInt: '0'},
                ok: {$numberDouble: '1.0'},
              },
            ]),
          },
        });
      },
    },
  });

  assert.equal(result.imported_user_data_detected, false);
  assert.equal(result.total, 0);
  assert.ok(Object.keys(result.counts).length > 0);
});

function safeDependencies(runner, env = receiverEnvironment()) {
  return {
    env,
    nodeVersion: '22.13.0',
    repository: {
      branch: 'main',
      dirty: false,
      head: TEST_COMMIT,
      originMain: TEST_COMMIT,
    },
    runner,
  };
}

function createCloudRunner(
  initialCollections,
  {existingWorkerTrigger = false, loginConfig = null} = {},
) {
  const collections = new Set(initialCollections);
  const calls = [];
  let deployedConfig = null;
  let workerTriggerCreated = existingWorkerTrigger;
  return {
    calls,
    get deployedConfig() {
      return deployedConfig;
    },
    async run(args, options = {}) {
      calls.push(args);
      if (args.includes('login') && args.includes('get')) {
        if (!loginConfig) throw new Error('unexpected login configuration read');
        return JSON.stringify({data: loginConfig});
      }
      if (
        args.includes('fn') &&
        args.includes('detail') &&
        args.includes('softbook-account-deletion-worker')
      ) {
        return JSON.stringify({
          data: {
            FunctionName: 'softbook-account-deletion-worker',
            Handler: 'index.accountDeletionWorkerMain',
            Runtime: 'Nodejs20.19',
            Timeout: 60,
            Environment: {Variables: []},
            Triggers: workerTriggerCreated
              ? [
                  {
                    TriggerDesc: '0 */1 * * * * *',
                    TriggerName: 'account-deletion-every-minute',
                    Type: 'Timer',
                  },
                ]
              : [],
          },
        });
      }
      if (
        args.includes('fn') &&
        args.includes('detail') &&
        args.includes('softbook-api')
      ) {
        const runtime = deployedConfig?.functions?.[0]?.envVariables ?? {};
        return JSON.stringify({
          data: {
            FunctionName: 'softbook-api',
            Handler: 'index.main',
            Runtime: 'Nodejs20.19',
            Timeout: 10,
            Environment: {
              Variables: Object.entries(runtime).map(([Key, Value]) => ({Key, Value})),
            },
          },
        });
      }
      if (args.includes('detail')) {
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
            Tables: [...collections].map(TableName => ({TableName})),
            Pager: {Total: collections.size},
          },
        });
      }
      if (args.includes('CreateTable')) {
        const body = JSON.parse(args[args.indexOf('--body') + 1]);
        assert.ok(deploymentSafety.REQUIRED_COLLECTIONS.includes(body.TableName));
        collections.add(body.TableName);
        return JSON.stringify({data: {ok: true}});
      }
      if (args.includes('deploy')) {
        deployedConfig = JSON.parse(readFileSync(join(options.cwd, 'cloudbaserc.json'), 'utf8'));
        return JSON.stringify({data: {ok: true}});
      }
      if (args.includes('trigger')) {
        workerTriggerCreated = true;
        return JSON.stringify({data: {ok: true}});
      }
      throw new Error(`unexpected CloudBase command: ${args.join(' ')}`);
    },
  };
}

function createProfileFile() {
  const directory = mkdtempSync(join(tmpdir(), 'receiver-profile-test-'));
  temporaryDirectories.push(directory);
  const path = join(directory, 'delivery-profile.json');
  const profile = profileFixture();
  const deliveryProfileBytes = Buffer.from(`${JSON.stringify(profile, null, 2)}\n`);
  writeFileSync(path, deliveryProfileBytes);
  const {privateKey} = generateKeyPairSync('ed25519');
  const publicKeyHex = deliveryCli.deriveEd25519PublicKeyHex(privateKey);
  const publicKeyring = {
    schema_version: 'content-manifest-public-keyring.v1',
    keys: [
      {
        algorithm: 'ed25519',
        key_id: profile.signing_key_id,
        public_key_hex: publicKeyHex,
      },
    ],
  };
  const publicKeyringBytes = mobileRuntimeProfileContract.canonicalJsonBytes(publicKeyring);
  const runtimeProfile = mobileRuntimeProfileContract.createMobileReleaseRuntimeProfile({
    commitSha: TEST_COMMIT,
    deliveryProfile: profile,
    deliveryProfileBytes,
    publicKeyring,
    publicKeyringBytes,
  });
  const runtimeProfileBytes = mobileRuntimeProfileContract.canonicalJsonBytes(runtimeProfile);
  const mobileRuntimeProfilePath = join(directory, 'mobile-runtime-profile.json');
  writeFileSync(mobileRuntimeProfilePath, runtimeProfileBytes);
  return {
    directory,
    env: receiverEnvironment(privateKey),
    mobileRuntimeProfilePath,
    path,
    publicBinding: {
      profile_sha256: mobileRuntimeProfileContract.sha256(runtimeProfileBytes),
      delivery_profile_sha256: runtimeProfile.delivery_profile_sha256,
      public_keyring_sha256: runtimeProfile.public_keyring_sha256,
      profile_id: runtimeProfile.profile_id,
      environment_id: runtimeProfile.environment_id,
      signing_key_id: runtimeProfile.signing_key_id,
      key_ids: runtimeProfile.content_manifest_public_keys.map(item => item.key_id),
    },
  };
}

function profileFixture() {
  return {
    schema_version: 'delivery-profile.v1',
    profile_id: 'receiver-closed-beta',
    environment_id: 'receiver-cet4-beta',
    region: 'ap-shanghai',
    api_base_url: 'https://receiver.example/softbook-api',
    runtime_mode: 'closed_beta',
    enabled_tracks: ['cet4'],
    minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
    signing_key_id: 'receiver-signing-key-v1',
  };
}

function receiverEnvironment(privateKey = generateKeyPairSync('ed25519').privateKey) {
  return {
    SOFTBOOK_AUTH_INDEX_SECRET: 'index-secret-0123456789-ABCDEFGHIJK',
    SOFTBOOK_AUTH_TOKEN_SECRET: 'token-secret-9876543210-ZYXWVUTSRQP',
    SOFTBOOK_CONTENT_MANIFEST_PRIVATE_KEY_PEM: privateKey.export({
      format: 'pem',
      type: 'pkcs8',
    }),
    SOFTBOOK_SMS_PROVIDER: 'webhook',
    SOFTBOOK_SMS_WEBHOOK_SECRET: 'sms-secret-1357902468-QWERTYUIOPAS',
    SOFTBOOK_SMS_WEBHOOK_URL: 'https://sms.receiver.example/v1/send',
  };
}
