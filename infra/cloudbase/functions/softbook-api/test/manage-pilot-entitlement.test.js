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
    pathToFileURL(resolve(__dirname, '../../../manage-pilot-entitlement.mjs'))
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

test('pilot entitlement CLI is dry-run by default and redacts the phone', async () => {
  const fixture = createFixture();
  const runner = createRunner();
  const options = cli.parsePilotEntitlementArguments([
    '--profile',
    fixture.profilePath,
    '--command',
    fixture.commandPath,
    '--format',
    'json',
  ]);
  const report = await cli.executePilotEntitlementCommand(
    options,
    dependencies(runner),
  );

  assert.equal(report.status, 'planned');
  assert.equal(report.writes_performed, false);
  assert.equal(report.plan.resulting_stage, 'pilot_premium');
  assert.equal(JSON.stringify(report).includes('13800138000'), false);
  assert.equal(runner.updateCount(), 0);
});

test('apply writes and verifies one grant while exact replay is idempotent', async () => {
  const fixture = createFixture();
  const runner = createRunner();
  const options = cli.parsePilotEntitlementArguments([
    '--profile',
    fixture.profilePath,
    '--command',
    fixture.commandPath,
    '--apply',
  ]);
  const first = await cli.executePilotEntitlementCommand(
    options,
    dependencies(runner),
  );
  const replay = await cli.executePilotEntitlementCommand(
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

test('command must bind the exact profile pilot and active window', async () => {
  const mismatched = createFixture({pilotId: 'different-pilot'});
  const late = createFixture({occurredAt: '2026-09-11T00:00:00.000Z'});

  await assert.rejects(
    () =>
      cli.executePilotEntitlementCommand(
        cli.parsePilotEntitlementArguments([
          '--profile',
          mismatched.profilePath,
          '--command',
          mismatched.commandPath,
        ]),
        dependencies(createRunner()),
      ),
    /pilot_id does not match/,
  );
  await assert.rejects(
    () =>
      cli.executePilotEntitlementCommand(
        cli.parsePilotEntitlementArguments([
          '--profile',
          late.profilePath,
          '--command',
          late.commandPath,
        ]),
        dependencies(createRunner()),
      ),
    /after the controlled pilot expiry/,
  );
});

test('apply refuses topic branches after a successful receiver preflight', async () => {
  const fixture = createFixture();
  const runner = createRunner();
  const options = cli.parsePilotEntitlementArguments([
    '--profile',
    fixture.profilePath,
    '--command',
    fixture.commandPath,
    '--apply',
  ]);

  await assert.rejects(
    () =>
      cli.executePilotEntitlementCommand(options, {
        ...dependencies(runner),
        repository: {
          branch: 'infra/controlled-pilot-runtime',
          dirty: false,
          head: 'same',
          originMain: 'same',
        },
      }),
    /writes require branch main/,
  );
  assert.equal(runner.updateCount(), 0);
});

function createFixture({
  occurredAt = '2026-08-15T00:00:00.000Z',
  pilotId = 'cet4-pilot-2026',
} = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'pilot-entitlement-test-'));
  temporaryDirectories.push(directory);
  const profilePath = join(directory, 'controlled-pilot-profile.json');
  const commandPath = join(directory, 'pilot-command.json');
  writeFileSync(
    profilePath,
    JSON.stringify({
      schema_version: 'controlled-pilot-profile.v1',
      profile_id: 'receiver-controlled-pilot',
      pilot_id: 'cet4-pilot-2026',
      environment_id: 'receiver-cet4-pilot',
      region: 'ap-shanghai',
      api_base_url: 'https://receiver.example',
      runtime_mode: 'controlled_pilot',
      enabled_tracks: ['cet4'],
      minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
      signing_key_id: 'receiver-signing-key-v1',
      cohort_limit: 50,
      pilot_expires_at: '2026-09-10T00:00:00.000Z',
      gate_eligible: false,
    }),
  );
  writeFileSync(
    commandPath,
    JSON.stringify({
      schema_version: 'pilot-entitlement-command.v1',
      event_id: 'pilot-event-grant-0001',
      pilot_id: pilotId,
      phone_number: '13800138000',
      action: 'grant',
      actor: 'receiver-operator',
      reason: 'continue controlled pilot after trial',
      occurred_at: occurredAt,
      previous_stage: 'free',
      resulting_stage: 'pilot_premium',
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
    [
      'softbook_memberships',
      new Map([
        [
          '13800138000',
          {
            entitlement: {
              counted_entry_count: 1,
              last_experience_ended_by: 'trial',
              recovery_prompt_visible: true,
              stage: 'free',
              trial_duration_days: 5,
              trial_expires_at: '2026-08-06T00:00:00.000Z',
              trial_started_at: '2026-08-01T00:00:00.000Z',
              trial_started_at_entry_count: 1,
            },
          },
        ],
      ]),
    ],
    ['softbook_pilot_entitlements', new Map()],
  ]);
  let updates = 0;
  return {
    updateCount: () => updates,
    async run(args) {
      if (args[0] === 'env') {
        return JSON.stringify({
          data: {
            envId: 'receiver-cet4-pilot',
            region: 'ap-shanghai',
            status: 'NORMAL',
            resources: {
              databases: [
                {InstanceId: 'tnt-receiver123', Status: 'RUNNING'},
              ],
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
          throw new Error(
            `unexpected database command ${wrapper.CommandType}`,
          );
        });
        return JSON.stringify({data: {results}});
      }
      throw new Error(`unexpected command ${args.join(' ')}`);
    },
  };
}
