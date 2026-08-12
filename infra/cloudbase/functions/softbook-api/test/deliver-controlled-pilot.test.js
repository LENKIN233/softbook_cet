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
  assert.deepEqual(processCalls, [
    ['npm', 'ci'],
    ['npm', 'test'],
  ]);
  const runtime = runner.deployedConfig.functions[0].envVariables;
  assert.equal(runtime.SOFTBOOK_RUNTIME_MODE, 'controlled_pilot');
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
          profilePath: fixture.path,
        },
        {
          ...safeDependencies(runner),
          repository: {
            branch: 'infra/unsafe-topic',
            dirty: false,
            head: 'abc',
            originMain: 'abc',
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
      head: 'abc',
      originMain: 'abc',
    },
    runner,
  };
}

function createCloudRunner(initialCollections) {
  const collections = new Set(initialCollections);
  const calls = [];
  let deployedConfig = null;
  return {
    calls,
    get deployedConfig() {
      return deployedConfig;
    },
    async run(args, options = {}) {
      calls.push(args);
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
    SOFTBOOK_CONTENT_MANIFEST_PRIVATE_KEY_PEM: privateKey.export({
      format: 'pem',
      type: 'pkcs8',
    }),
    SOFTBOOK_SMS_PROVIDER: 'webhook',
    SOFTBOOK_SMS_WEBHOOK_SECRET: 'sms-secret-1357902468-QWERTYUIOPAS',
    SOFTBOOK_SMS_WEBHOOK_URL: 'https://sms.receiver.example/v1/send',
  };
}
