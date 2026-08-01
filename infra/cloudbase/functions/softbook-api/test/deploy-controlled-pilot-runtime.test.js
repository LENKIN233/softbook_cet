const assert = require('node:assert/strict');
const {generateKeyPairSync} = require('node:crypto');
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

let deployment;
let deploymentSafety;
const temporaryDirectories = [];

before(async () => {
  deployment = await import(
    pathToFileURL(
      resolve(__dirname, '../../../deploy-controlled-pilot-runtime.mjs'),
    )
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

test('controlled pilot runtime deployment is dry-run by default', async () => {
  const profilePath = createProfile();
  const runner = createRunner();
  const options = deployment.parseControlledPilotDeployArguments([
    '--profile',
    profilePath,
  ]);
  const report = await deployment.executeControlledPilotRuntimeDeploy(
    options,
    dependencies(runner),
  );

  assert.equal(report.status, 'planned');
  assert.equal(report.writes_performed, false);
  assert.equal(report.deployment_plan.runtime_mode, 'controlled_pilot');
  assert.equal(runner.deployCount(), 0);
});

test('apply packages the API and deletion worker with controlled-pilot runtime', async () => {
  const profilePath = createProfile();
  const runner = createRunner();
  const options = deployment.parseControlledPilotDeployArguments([
    '--profile',
    profilePath,
    '--apply',
  ]);
  const report = await deployment.executeControlledPilotRuntimeDeploy(
    options,
    {
      ...dependencies(runner),
      processRunner: {run: async () => ''},
    },
  );

  assert.equal(report.status, 'passed');
  assert.equal(runner.deployCount(), 2);
  assert.deepEqual(report.deployed.function_names, [
    'softbook-api',
    'softbook-account-deletion-worker',
  ]);
  assert.deepEqual(
    runner.config().functions.map(item => [
      item.name,
      item.handler,
      item.envVariables.SOFTBOOK_RUNTIME_MODE,
    ]),
    [
      ['softbook-api', 'index.main', 'controlled_pilot'],
      [
        'softbook-account-deletion-worker',
        'index.accountDeletionWorkerMain',
        'controlled_pilot',
      ],
    ],
  );
  assert.deepEqual(runner.config().functions[1].triggers, [
    {
      config: '0 */1 * * * * *',
      name: 'account-deletion-every-minute',
      type: 'timer',
    },
  ]);
  assert.equal(
    runner.calls().some(
      args => args.includes('trigger') && args.includes('create'),
    ),
    true,
  );
  assert.equal(
    runner.calls().some(args => args.includes('/softbook-api')),
    true,
  );
});

test('controlled pilot apply refuses topic branches', async () => {
  const profilePath = createProfile();
  const runner = createRunner();
  await assert.rejects(
    () =>
      deployment.executeControlledPilotRuntimeDeploy(
        {apply: true, format: 'json', profilePath},
        {
          ...dependencies(runner),
          repository: {
            branch: 'infra/controlled-pilot-runtime',
            dirty: false,
            head: 'same',
            originMain: 'same',
          },
        },
      ),
    /writes require branch main/,
  );
  assert.equal(runner.deployCount(), 0);
});

function createProfile() {
  const directory = mkdtempSync(join(tmpdir(), 'pilot-runtime-profile-'));
  temporaryDirectories.push(directory);
  const path = join(directory, 'profile.json');
  writeFileSync(
    path,
    JSON.stringify({
      schema_version: 'controlled-pilot-profile.v1',
      profile_id: 'receiver-pilot-profile',
      pilot_id: 'cet4-pilot-2026',
      environment_id: 'receiver-pilot-environment',
      region: 'ap-shanghai',
      api_base_url: 'https://pilot.softbook.example',
      runtime_mode: 'controlled_pilot',
      enabled_tracks: ['cet4'],
      minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
      signing_key_id: 'pilot-signing-key-1',
      cohort_limit: 50,
      pilot_expires_at: '2026-09-10T00:00:00.000Z',
      gate_eligible: false,
    }),
  );
  return path;
}

function dependencies(runner) {
  return {
    env: receiverEnvironment(),
    nodeVersion: deploymentSafety.REQUIRED_DEPLOYMENT_NODE_VERSION,
    repository: {
      branch: 'main',
      dirty: false,
      head: 'same',
      originMain: 'same',
    },
    runner,
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

function createRunner() {
  const calls = [];
  let config = null;
  let deployCount = 0;
  return {
    calls: () => calls,
    config: () => config,
    deployCount: () => deployCount,
    async run(args, options = {}) {
      calls.push(args);
      if (args.includes('detail')) {
        return JSON.stringify({
          data: {
            envId: 'receiver-pilot-environment',
            region: 'ap-shanghai',
            status: 'NORMAL',
            resources: {
              databases: [
                {InstanceId: 'tnt-pilotreceiver', Status: 'RUNNING'},
              ],
            },
          },
        });
      }
      if (args.includes('DescribeTables')) {
        return JSON.stringify({
          data: {
            Tables: deploymentSafety.REQUIRED_COLLECTIONS.map(TableName => ({
              TableName,
            })),
            Pager: {Total: deploymentSafety.REQUIRED_COLLECTIONS.length},
          },
        });
      }
      if (args.includes('deploy')) {
        deployCount += 1;
        config = JSON.parse(
          readFileSync(join(options.cwd, 'cloudbaserc.json'), 'utf8'),
        );
        return JSON.stringify({data: {ok: true}});
      }
      if (args.includes('trigger') && args.includes('create')) {
        return JSON.stringify({data: {ok: true}});
      }
      throw new Error(`unexpected command: ${args.join(' ')}`);
    },
  };
}
