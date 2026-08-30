const assert = require('node:assert/strict');
const {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} = require('node:fs');
const {tmpdir} = require('node:os');
const {join, resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {after, before, test} = require('node:test');
const pilotRuntime = require('../pilot-entitlement-v1');

let cli;
let deploymentSafety;
const temporaryDirectories = [];
const REPOSITORY_ROOT = resolve(__dirname, '../../../../..');

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
  const report = await cli.executePilotEntitlementCommand(options, dependencies(runner));

  assert.equal(report.status, 'planned');
  assert.equal(report.schema_version, 'pilot-entitlement-report.v2');
  assert.equal(report.gate_eligible, false);
  assert.equal(report.plan.schema_version, 'pilot-entitlement-plan.v2');
  assert.equal(report.plan.resulting_stage, 'pilot_premium');
  assert.equal(JSON.stringify(report).includes('13800138000'), false);
  assert.equal(Object.hasOwn(report.plan, 'account_fingerprint'), false);
  assert.equal(runner.updateCount(), 0);
});

test('apply writes and verifies once while exact replay is idempotent', async () => {
  const fixture = createFixture();
  const runner = createRunner();
  const options = cli.parsePilotEntitlementArguments([
    '--profile',
    fixture.profilePath,
    '--command',
    fixture.commandPath,
    '--apply',
  ]);
  const first = await cli.executePilotEntitlementCommand(options, dependencies(runner));
  const replay = await cli.executePilotEntitlementCommand(options, dependencies(runner));

  assert.equal(first.status, 'passed');
  assert.equal(first.writes_performed, true);
  assert.equal(replay.result.idempotent, true);
  assert.equal(replay.writes_performed, false);
  assert.equal(runner.updateCount(), 1);
});

test('profile pilot mismatch and topic-branch apply fail before mutation', async () => {
  const fixture = createFixture({commandPilotId: 'another-pilot'});
  const runner = createRunner();
  const options = cli.parsePilotEntitlementArguments([
    '--profile',
    fixture.profilePath,
    '--command',
    fixture.commandPath,
    '--apply',
  ]);
  await assert.rejects(
    () => cli.executePilotEntitlementCommand(options, dependencies(runner)),
    /does not match the receiver profile pilot/,
  );
  assert.equal(runner.updateCount(), 0);

  const matching = createFixture();
  const matchingOptions = cli.parsePilotEntitlementArguments([
    '--profile',
    matching.profilePath,
    '--command',
    matching.commandPath,
    '--apply',
  ]);
  await assert.rejects(
    () =>
      cli.executePilotEntitlementCommand(matchingOptions, {
        ...dependencies(runner),
        repository: {
          branch: 'module/pilot-entitlement',
          dirty: false,
          head: 'same',
          originMain: 'same',
        },
      }),
    /writes require branch main/,
  );
  assert.equal(runner.updateCount(), 0);
});

test('future commands and expired pilot profiles fail before remote reads', async () => {
  const future = createFixture({occurredAt: '2026-08-11T10:00:00.000Z'});
  const futureRunner = createRunner();
  const futureOptions = cli.parsePilotEntitlementArguments([
    '--profile',
    future.profilePath,
    '--command',
    future.commandPath,
  ]);
  await assert.rejects(
    () => cli.executePilotEntitlementCommand(futureOptions, dependencies(futureRunner)),
    /outside the active pilot window/,
  );
  assert.equal(futureRunner.callCount(), 0);

  const expired = createFixture({pilotExpiresAt: '2026-08-10T10:00:01.000Z'});
  const expiredRunner = createRunner();
  const expiredOptions = cli.parsePilotEntitlementArguments([
    '--profile',
    expired.profilePath,
    '--command',
    expired.commandPath,
  ]);
  await assert.rejects(
    () => cli.executePilotEntitlementCommand(expiredOptions, dependencies(expiredRunner)),
    /outside the active pilot window/,
  );
  assert.equal(expiredRunner.callCount(), 0);
});

test('pilot CLI result parser rejects separator-normalized phone IDs', async () => {
  const fixture = createFixture();
  const runner = createRunner({
    responseActorOverride: 'service-138-0013-8000',
  });
  const options = cli.parsePilotEntitlementArguments([
    '--profile',
    fixture.profilePath,
    '--command',
    fixture.commandPath,
    '--apply',
  ]);
  await assert.rejects(
    () => cli.executePilotEntitlementCommand(options, dependencies(runner)),
    /invocation result is invalid/,
  );
});

test('pilot apply rejects tracked, in-repository, and symlink command inputs', async () => {
  const fixture = createFixture();
  const assertRejectedPath = async (commandPath, pattern) => {
    const runner = createRunner();
    const options = cli.parsePilotEntitlementArguments([
      '--profile',
      fixture.profilePath,
      '--command',
      commandPath,
      '--apply',
    ]);
    await assert.rejects(
      () => cli.executePilotEntitlementCommand(options, dependencies(runner)),
      pattern,
    );
    assert.equal(runner.callCount(), 0);
  };

  await assertRejectedPath(
    resolve(REPOSITORY_ROOT, 'spec/membership.json'),
    /outside the repository and cannot be tracked at HEAD/,
  );

  const inRepositoryDirectory = mkdtempSync(
    join(REPOSITORY_ROOT, '.pilot-command-test-'),
  );
  temporaryDirectories.push(inRepositoryDirectory);
  const inRepositoryPath = join(inRepositoryDirectory, 'command.json');
  writeFileSync(inRepositoryPath, readFileSync(fixture.commandPath));
  await assertRejectedPath(
    inRepositoryPath,
    /outside the repository and cannot be tracked at HEAD/,
  );

  const symlinkDirectory = mkdtempSync(
    join(tmpdir(), 'pilot-command-symlink-test-'),
  );
  temporaryDirectories.push(symlinkDirectory);
  const symlinkPath = join(symlinkDirectory, 'command.json');
  symlinkSync(fixture.commandPath, symlinkPath);
  await assertRejectedPath(symlinkPath, /regular non-symlink file/);
});

function createFixture({
  commandPilotId = 'cet4-pilot-2026',
  occurredAt = '2026-08-10T10:00:00.000Z',
  pilotExpiresAt = '2026-09-01T00:00:00.000Z',
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
      api_base_url: 'https://receiver.example/softbook-api',
      runtime_mode: 'controlled_pilot',
      enabled_tracks: ['cet4'],
      minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
      signing_key_id: 'receiver-signing-key-v1',
      cohort_limit: 40,
      pilot_expires_at: pilotExpiresAt,
      gate_eligible: false,
    }),
  );
  writeFileSync(
    commandPath,
    JSON.stringify({
      schema_version: 'pilot-entitlement-command.v1',
      event_id: 'pilot-event-grant-0001',
      pilot_id: commandPilotId,
      phone_number: '13800138000',
      action: 'grant',
      actor: 'receiver-operator',
      reason: 'controlled_pilot_continued_access',
      occurred_at: occurredAt,
      previous_stage: 'trial_available',
      resulting_stage: 'pilot_premium',
    }),
  );
  return {commandPath, profilePath};
}

function dependencies(runner) {
  return {
    now: new Date('2026-08-10T10:00:01.000Z'),
    nodeVersion: deploymentSafety.REQUIRED_DEPLOYMENT_NODE_VERSION,
    operatorSecret: 'pilot-operator-secret-0123456789-ABCDEFG',
    repository: {branch: 'main', dirty: false, head: 'same', originMain: 'same'},
    runner,
  };
}

function createRunner({responseActorOverride = null} = {}) {
  const collections = new Map([
    ['softbook_beta_entitlements', new Map()],
    ['softbook_pilot_entitlements', new Map()],
    ['softbook_memberships', new Map()],
  ]);
  let updates = 0;
  let calls = 0;
  let invocations = 0;
  return {
    callCount: () => calls,
    updateCount: () => updates,
    async run(args) {
      calls += 1;
      if (args[0] === 'env') {
        return JSON.stringify({
          data: {
            envId: 'receiver-cet4-pilot',
            region: 'ap-shanghai',
            status: 'NORMAL',
            resources: {databases: [{InstanceId: 'tnt-receiver123', Status: 'RUNNING'}]},
          },
        });
      }
      if (args.includes('DescribeTables')) {
        return JSON.stringify({
          data: {
            Pager: {Total: deploymentSafety.REQUIRED_COLLECTIONS.length},
            Tables: deploymentSafety.REQUIRED_COLLECTIONS.map(TableName => ({TableName})),
          },
        });
      }
      if (args[0] === 'db') {
        const commands = JSON.parse(args[args.indexOf('--command') + 1]);
        const results = commands.map(wrapper => {
          const command = JSON.parse(wrapper.Command);
          if (wrapper.CommandType === 'QUERY') {
            const document = collections.get(wrapper.TableName)?.get(command.filter._id);
            return document ? [{_id: command.filter._id, ...structuredClone(document)}] : [];
          }
          if (wrapper.CommandType === 'UPDATE') {
            updates += 1;
            const update = command.updates[0];
            const id = update.q._id;
            collections.get(wrapper.TableName).set(id, structuredClone(update.u.$set));
            return [{ok: 1, n: 1}];
          }
          throw new Error(`unexpected database command ${wrapper.CommandType}`);
        });
        return JSON.stringify({data: {results}});
      }
      if (args[0] === 'fn' && args[1] === 'invoke') {
        invocations += 1;
        const dataArgument = args[args.indexOf('-d') + 1];
        assert.equal(dataArgument.startsWith('@'), true);
        const input = JSON.parse(readFileSync(dataArgument.slice(1), 'utf8'));
        assert.match(input.signature, /^hmac-sha256:[a-f0-9]{64}$/);
        const phoneNumber = input.command.phone_number;
        const current = collections
          .get('softbook_pilot_entitlements')
          .get(phoneNumber);
        const plan = pilotRuntime.planPilotEntitlementMutation(
          input.command,
          current,
          {
            counted_entry_count: 0,
            last_experience_ended_by: null,
            recovery_prompt_visible: false,
            stage: 'trial_available',
            trial_duration_days: 5,
            trial_expires_at: null,
            trial_started_at: null,
            trial_started_at_entry_count: null,
          },
        );
        if (plan.changed) {
          collections
            .get('softbook_pilot_entitlements')
            .set(phoneNumber, structuredClone(plan.document));
          updates += 1;
        }
        const result = {
          schema_version: 'pilot-entitlement-operator-result.v1',
          gate_eligible: false,
          status: 'passed',
          writes_performed: plan.changed,
          result: pilotRuntime.publicPilotEntitlementPlan(plan),
        };
        if (responseActorOverride !== null) {
          result.result.actor = responseActorOverride;
        }
        return JSON.stringify({
          functionType: 'Event',
          InvokeResult: 0,
          RetMsg: JSON.stringify(result),
        });
      }
      throw new Error(`unexpected command ${args.join(' ')}`);
    },
  };
}
