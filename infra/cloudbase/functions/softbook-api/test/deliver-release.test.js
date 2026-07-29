const assert = require('node:assert/strict');
const {generateKeyPairSync} = require('node:crypto');
const {mkdtempSync, readFileSync, rmSync, writeFileSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join, resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {after, before, test} = require('node:test');

let deliveryCli;
let deploymentSafety;
const temporaryDirectories = [];

before(async () => {
  deliveryCli = await import(pathToFileURL(resolve(__dirname, '../../../deliver-release.mjs')));
  deploymentSafety = await import(
    pathToFileURL(resolve(__dirname, '../../../deployment-safety.mjs'))
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
        '--apply',
      ]),
    /read-only/,
  );
});

test('receiver runtime contains production adapters and never includes a fixed code', () => {
  const profile = profileFixture();
  const env = receiverEnvironment();
  env.SOFTBOOK_SMS_DEV_CODE = '2468';
  const runtime = deliveryCli.buildReceiverRuntimeEnvironment(profile, env);

  assert.equal(runtime.SOFTBOOK_RUNTIME_MODE, 'production');
  assert.equal(runtime.SOFTBOOK_SMS_PROVIDER, 'webhook');
  assert.equal(runtime.SOFTBOOK_CONTENT_MANIFEST_KEY_ID, profile.signing_key_id);
  assert.equal(Object.hasOwn(runtime, 'SOFTBOOK_SMS_DEV_CODE'), false);
  assert.equal(Object.values(runtime).includes('2468'), false);
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
    'SOFTBOOK_SMS_WEBHOOK_SECRET',
    'SOFTBOOK_SMS_WEBHOOK_URL',
  ]);
  for (const value of Object.values(env)) {
    assert.equal(serialized.includes(value), false);
  }
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
      profilePath: fixture.path,
      releaseId: null,
    },
    safeDependencies(runner),
  );

  assert.equal(report.status, 'passed');
  assert.equal(report.preflight.environment.env_id, 'receiver-cet4-beta');
  assert.equal(report.preflight.catalog.missing_required_collections.length, 2);
  assert.equal(
    runner.calls.some(call => call.includes('CreateTable')),
    false,
  );
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
      profilePath: fixture.path,
      releaseId: null,
    },
    safeDependencies(runner),
  );

  assert.equal(report.status, 'passed');
  assert.deepEqual(report.provisioned.created, deploymentSafety.REQUIRED_COLLECTIONS.slice(-2));
  assert.equal(runner.calls.filter(call => call.includes('CreateTable')).length, 2);
});

test('receiver deploy validates an isolated artifact and injects secrets only through a temporary config', async () => {
  const fixture = createProfileFile();
  const runner = createCloudRunner(deploymentSafety.REQUIRED_COLLECTIONS);
  const processCalls = [];
  const env = receiverEnvironment();
  const report = await deliveryCli.executeDeliveryCommand(
    {
      apply: true,
      bundlePath: null,
      command: 'deploy',
      format: 'json',
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
  assert.deepEqual(
    processCalls.map(call => [call.command, call.args[0]]),
    [
      ['npm', 'ci'],
      ['npm', 'test'],
    ],
  );
  assert.equal(runner.deployedConfig.envId, 'receiver-cet4-beta');
  assert.equal(runner.deployedConfig.functions[0].envVariables.SOFTBOOK_RUNTIME_MODE, 'production');
  assert.equal(
    Object.hasOwn(runner.deployedConfig.functions[0].envVariables, 'SOFTBOOK_SMS_DEV_CODE'),
    false,
  );
  const publicReport = JSON.stringify(report);
  for (const value of Object.values(env)) {
    assert.equal(publicReport.includes(value), false);
  }
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
          profilePath: fixture.path,
          releaseId: null,
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
      throw new Error(`unexpected CloudBase command: ${args.join(' ')}`);
    },
  };
}

function createProfileFile() {
  const directory = mkdtempSync(join(tmpdir(), 'receiver-profile-test-'));
  temporaryDirectories.push(directory);
  const path = join(directory, 'delivery-profile.json');
  writeFileSync(path, `${JSON.stringify(profileFixture(), null, 2)}\n`);
  return {directory, path};
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

function receiverEnvironment() {
  const {privateKey} = generateKeyPairSync('ed25519');
  return {
    SOFTBOOK_AUTH_INDEX_SECRET: 'index-secret-0123456789-ABCDEFGHIJK',
    SOFTBOOK_AUTH_TOKEN_SECRET: 'token-secret-9876543210-ZYXWVUTSRQP',
    SOFTBOOK_CONTENT_MANIFEST_PRIVATE_KEY_PEM: privateKey.export({
      format: 'pem',
      type: 'pkcs8',
    }),
    SOFTBOOK_SMS_WEBHOOK_SECRET: 'sms-secret-1357902468-QWERTYUIOPAS',
    SOFTBOOK_SMS_WEBHOOK_URL: 'https://sms.receiver.example/v1/send',
  };
}
