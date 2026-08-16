const assert = require('node:assert/strict');
const {mkdtempSync, rmSync, writeFileSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join, resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {after, before, test} = require('node:test');

let cli;
let deploymentSafety;
const temporaryDirectories = [];

before(async () => {
  cli = await import(
    pathToFileURL(resolve(__dirname, '../../../manage-beta-entitlement.mjs'))
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
  assert.equal(report.writes_performed, false);
  assert.equal(report.plan.resulting_stage, 'premium');
  assert.equal(JSON.stringify(report).includes('13800138000'), false);
  assert.equal(runner.updateCount(), 0);
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
  assert.equal(first.writes_performed, true);
  assert.equal(replay.status, 'passed');
  assert.equal(replay.writes_performed, false);
  assert.equal(replay.result.idempotent, true);
  assert.equal(runner.updateCount(), 1);
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
          head: 'same',
          originMain: 'same',
        },
      }),
    /writes require branch main/,
  );
  assert.equal(runner.updateCount(), 0);
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

function createFixture(runtimeMode = 'closed_beta') {
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
      grant_id: 'cet4-beta-grant-0001',
      actor_id: 'receiver-operator',
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
      head: 'same',
      originMain: 'same',
    },
    runner,
  };
}

function createRunner() {
  const collections = new Map([
    ['softbook_beta_entitlements', new Map()],
    ['softbook_memberships', new Map()],
  ]);
  let updates = 0;
  return {
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
            updates += 1;
            const update = command.updates[0];
            const id = update.q._id;
            collections
              .get(wrapper.TableName)
              .set(id, structuredClone(update.u.$set));
            return [{ok: 1, n: 1}];
          }
          throw new Error(`unexpected database command ${wrapper.CommandType}`);
        });
        return JSON.stringify({data: {results}});
      }
      throw new Error(`unexpected command ${args.join(' ')}`);
    },
  };
}
