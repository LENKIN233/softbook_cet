const assert = require('node:assert/strict');
const {generateKeyPairSync} = require('node:crypto');
const {mkdtempSync, readFileSync, rmSync, writeFileSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join, resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {after, before, test} = require('node:test');

let cli;
let deploymentSafety;
const temporaryDirectories = [];
const TEST_COMMIT = 'b'.repeat(40);

before(async () => {
  cli = await import(
    pathToFileURL(resolve(__dirname, '../../../deliver-controlled-pilot.mjs'))
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

test('controlled-pilot delivery arguments are dry-run by default and omit rollback', () => {
  for (const command of ['provision', 'deploy']) {
    assert.equal(
      cli.parseControlledPilotArguments([
        command,
        '--profile',
        'controlled-pilot-profile.json',
      ]).apply,
      false,
    );
  }
  assert.equal(
    cli.parseControlledPilotArguments([
      'publish',
      '--profile',
      'profile.json',
      '--bundle',
      'bundle.json',
    ]).apply,
    false,
  );
  assert.throws(
    () =>
      cli.parseControlledPilotArguments([
        'rollback',
        '--profile',
        'profile.json',
      ]),
    /unknown controlled-pilot delivery command/,
  );
  assert.throws(
    () =>
      cli.parseControlledPilotArguments([
        'deploy',
        '--profile',
        'profile.json',
        '--apply',
      ]),
    /requires --operator/,
  );
});

test('controlled-pilot preflight is read-only and always reports gate ineligibility', async () => {
  const fixture = createProfileFile();
  const runner = createCloudRunner(deploymentSafety.REQUIRED_COLLECTIONS);
  const report = await cli.executeControlledPilotDelivery(
    {
      apply: false,
      bundlePath: null,
      command: 'preflight',
      format: 'json',
      profilePath: fixture.path,
    },
    safeDependencies(runner),
  );

  assert.equal(report.status, 'passed');
  assert.equal(report.schema_version, 'controlled-pilot-receiver-delivery-report.v2');
  assert.match(report.backend_deployment_id, /^backend-deployment:sha256:[0-9a-f]{64}$/);
  assert.equal(report.execution.operator, null);
  assert.equal(report.gate_eligible, false);
  assert.equal(report.writes_performed, false);
  assert.equal(report.profile.runtime_mode, 'controlled_pilot');
  assert.equal(runner.calls.some(args => args.includes('CreateTable')), false);
});

test('controlled-pilot deploy injects controlled_pilot without a development SMS code', async () => {
  const fixture = createProfileFile();
  const runner = createCloudRunner(deploymentSafety.REQUIRED_COLLECTIONS);
  const env = receiverEnvironment();
  env.SOFTBOOK_SMS_DEV_CODE = '2468';
  const processCalls = [];
  const report = await cli.executeControlledPilotDelivery(
    {
      apply: true,
      bundlePath: null,
      command: 'deploy',
      format: 'json',
      operator: 'github:receiver-operator',
      profilePath: fixture.path,
    },
    {
      ...safeDependencies(runner),
      env,
      processRunner: {
        async run(command, args) {
          processCalls.push([command, args[0]]);
          return '';
        },
      },
    },
  );

  assert.equal(report.status, 'passed');
  assert.equal(report.execution.operator, 'github:receiver-operator');
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
  assert.deepEqual(processCalls, [
    ['npm', 'ci'],
    ['npm', 'test'],
  ]);
  const runtime = runner.deployedConfig.functions[0].envVariables;
  assert.equal(runner.deployedConfig.functions.length, 2);
  assert.equal(
    runner.deployedConfig.functions[1].handler,
    'index.accountDeletionWorkerMain',
  );
  assert.deepEqual(
    runner.calls.find(call => call.includes('trigger')),
    [
      '-e',
      'receiver-cet4-pilot',
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
  assert.equal(runtime.SOFTBOOK_RUNTIME_MODE, 'controlled_pilot');
  assert.equal(runtime.SOFTBOOK_BACKEND_DEPLOYMENT_ID, report.backend_deployment_id);
  assert.equal(runtime.SOFTBOOK_PILOT_ID, 'cet4-pilot-2026');
  assert.equal(runtime.SOFTBOOK_PILOT_EXPIRES_AT, '2026-09-10T00:00:00.000Z');
  assert.equal(
    runtime.SOFTBOOK_PILOT_OPERATOR_SECRET,
    'pilot-operator-secret-0123456789-ABCDEFG',
  );
  assert.equal(Object.hasOwn(runtime, 'SOFTBOOK_SMS_DEV_CODE'), false);
  assert.equal(report.gate_eligible, false);
});

test('controlled-pilot apply remains exact-main only', async () => {
  const fixture = createProfileFile();
  const runner = createCloudRunner(deploymentSafety.REQUIRED_COLLECTIONS);

  await assert.rejects(
    () =>
      cli.executeControlledPilotDelivery(
        {
          apply: true,
          bundlePath: null,
          command: 'provision',
          format: 'json',
          operator: 'github:receiver-operator',
          profilePath: fixture.path,
        },
        {
          ...safeDependencies(runner),
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

function safeDependencies(runner) {
  return {
    env: receiverEnvironment(),
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

function createCloudRunner(initialCollections) {
  const collections = new Set(initialCollections);
  const calls = [];
  let deployedConfig = null;
  let workerTriggerCreated = false;
  return {
    calls,
    get deployedConfig() {
      return deployedConfig;
    },
    async run(args, options = {}) {
      calls.push(args);
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
            envId: 'receiver-cet4-pilot',
            region: 'ap-shanghai',
            status: 'NORMAL',
            resources: {
              databases: [{InstanceId: 'tnt-pilot123', Status: 'RUNNING'}],
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
        collections.add(body.TableName);
        return JSON.stringify({data: {ok: true}});
      }
      if (args.includes('deploy')) {
        deployedConfig = JSON.parse(
          readFileSync(join(options.cwd, 'cloudbaserc.json'), 'utf8'),
        );
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
  const directory = mkdtempSync(join(tmpdir(), 'controlled-pilot-profile-test-'));
  temporaryDirectories.push(directory);
  const path = join(directory, 'controlled-pilot-profile.json');
  writeFileSync(path, `${JSON.stringify(profileFixture(), null, 2)}\n`);
  return {directory, path};
}

function profileFixture() {
  return {
    schema_version: 'controlled-pilot-profile.v1',
    profile_id: 'receiver-pilot-profile',
    pilot_id: 'cet4-pilot-2026',
    environment_id: 'receiver-cet4-pilot',
    region: 'ap-shanghai',
    api_base_url: 'https://receiver.example/softbook-api',
    runtime_mode: 'controlled_pilot',
    enabled_tracks: ['cet4'],
    minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
    signing_key_id: 'receiver-pilot-signing-key-v1',
    cohort_limit: 50,
    pilot_expires_at: '2026-09-10T00:00:00.000Z',
    gate_eligible: false,
  };
}

function receiverEnvironment() {
  const {privateKey} = generateKeyPairSync('ed25519');
  return {
    SOFTBOOK_AUTH_INDEX_SECRET: 'index-secret-0123456789-ABCDEFGHIJK',
    SOFTBOOK_AUTH_TOKEN_SECRET: 'token-secret-9876543210-ZYXWVUTSRQP',
    SOFTBOOK_PILOT_OPERATOR_SECRET: 'pilot-operator-secret-0123456789-ABCDEFG',
    SOFTBOOK_CONTENT_MANIFEST_PRIVATE_KEY_PEM: privateKey.export({
      format: 'pem',
      type: 'pkcs8',
    }),
    SOFTBOOK_SMS_PROVIDER: 'webhook',
    SOFTBOOK_SMS_WEBHOOK_SECRET: 'sms-secret-1357902468-QWERTYUIOPAS',
    SOFTBOOK_SMS_WEBHOOK_URL: 'https://sms.receiver.example/v1/send',
  };
}
