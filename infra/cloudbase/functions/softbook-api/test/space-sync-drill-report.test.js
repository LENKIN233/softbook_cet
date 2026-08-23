const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { after, before, test } = require('node:test');

let drill;
const temporaryDirectories = [];

before(async () => {
  drill = await import(
    pathToFileURL(resolve(__dirname, '../../../run-space-sync-drill.mjs'))
  );
});

after(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('space sync drill is dry-run by default and performs no remote request', async () => {
  const fixture = createFixture();
  let requests = 0;
  const options = drill.parseSpaceSyncDrillArguments([
    '--profile',
    fixture.profilePath,
  ]);
  const report = await drill.executeSpaceSyncDrill(options, {
    ...dependencies(),
    transport: { request: async () => (requests += 1) },
  });
  assert.equal(report.schema_version, 'space-sync-drill-plan.v1');
  assert.equal(report.applied, false);
  assert.equal(report.gate_eligible, false);
  assert.equal(report.remote_requests_performed, false);
  assert.equal(report.remote_writes_performed, false);
  assert.match(
    report.expected_backend_deployment_id,
    /^backend-deployment:sha256:[0-9a-f]{64}$/
  );
  assert.equal(requests, 0);
});

test('applied drill proves cross-client revision, replay, conflict, merge and cleanup', async () => {
  const fixture = createFixture();
  const transport = createTransport();
  const options = drill.parseSpaceSyncDrillArguments([
    '--profile',
    fixture.profilePath,
    '--card-id',
    'card-0000',
    '--apply',
    '--operator',
    'team:space-auditor',
  ]);
  const report = await drill.executeSpaceSyncDrill(options, {
    ...dependencies(),
    clock: createClock(),
    env: tokens(),
    idFactory: createIdFactory(),
    transport,
  });

  assert.equal(report.schema_version, 'space-sync-drill-report.v1');
  assert.equal(report.status, 'passed');
  assert.equal(report.gate_eligible, false);
  assert.equal(report.observations.initial_revision, 0);
  assert.equal(report.observations.favorite_applied_revision, 1);
  assert.equal(report.observations.favorite_replay_revision, 1);
  assert.equal(report.observations.conflict_rejected_revision, 1);
  assert.equal(report.observations.sleep_applied_revision, 2);
  assert.equal(report.observations.favorite_restored_revision, 3);
  assert.equal(report.observations.final_restored_revision, 4);
  assert.deepEqual(report.observations.initial_state, {
    favorite: false,
    sleep: false,
  });
  assert.deepEqual(
    report.observations.final_state,
    report.observations.initial_state
  );
  assert.equal(report.assertions.favorite_and_sleep_merged_independently, true);
  assert.equal(report.clients.distinct_sessions, true);
  assert.equal(report.clients.secret_values_reported, false);
  assert.equal(report.execution.operator, 'team:space-auditor');
  const serialized = JSON.stringify(report);
  assert.equal(
    serialized.includes(tokens().SOFTBOOK_CET_SPACE_DRILL_TOKEN_A),
    false
  );
  assert.equal(
    serialized.includes(tokens().SOFTBOOK_CET_SPACE_DRILL_TOKEN_B),
    false
  );
  assert.equal(transport.revision(), 4);
  assert.deepEqual(transport.state(), { favorite: false, sleep: false });
});

test('apply rejects unsafe identity, same token, and production profile', async () => {
  const fixture = createFixture();
  const applyArgs = [
    '--profile',
    fixture.profilePath,
    '--apply',
    '--operator',
    'team:space-auditor',
  ];
  await assert.rejects(
    () =>
      drill.executeSpaceSyncDrill(
        drill.parseSpaceSyncDrillArguments(applyArgs),
        {
          ...dependencies(),
          repository: {
            branch: 'infra/topic',
            dirty: true,
            head: 'a'.repeat(40),
            originMain: 'b'.repeat(40),
          },
        }
      ),
    /writes require branch main/
  );
  const same = 'same-token-value-long-enough';
  await assert.rejects(
    () =>
      drill.executeSpaceSyncDrill(
        drill.parseSpaceSyncDrillArguments(applyArgs),
        {
          ...dependencies(),
          env: {
            SOFTBOOK_CET_SPACE_DRILL_TOKEN_A: same,
            SOFTBOOK_CET_SPACE_DRILL_TOKEN_B: same,
          },
        }
      ),
    /two distinct client sessions/
  );
  const production = createFixture('production');
  await assert.rejects(
    () =>
      drill.executeSpaceSyncDrill(
        { profilePath: production.profilePath, apply: false, operator: null },
        dependencies()
      ),
    /requires a closed_beta delivery profile/
  );
});

test('drill fails closed when duplicate or conflict changes canonical revision', async () => {
  const fixture = createFixture();
  const options = drill.parseSpaceSyncDrillArguments([
    '--profile',
    fixture.profilePath,
    '--apply',
    '--operator',
    'team:space-auditor',
  ]);
  await assert.rejects(
    () =>
      drill.executeSpaceSyncDrill(options, {
        ...dependencies(),
        clock: createClock(),
        env: tokens(),
        idFactory: createIdFactory(),
        transport: createTransport({ duplicateIncrements: true }),
      }),
    /favorite duplicate revision/
  );
  await assert.rejects(
    () =>
      drill.executeSpaceSyncDrill(options, {
        ...dependencies(),
        clock: createClock(),
        env: tokens(),
        idFactory: createIdFactory(),
        transport: createTransport({ conflictIncrements: true }),
      }),
    /conflict rejection revision/
  );
});

function createFixture(runtimeMode = 'closed_beta') {
  const directory = mkdtempSync(join(tmpdir(), 'space-sync-drill-test-'));
  temporaryDirectories.push(directory);
  const profilePath = join(directory, 'profile.json');
  writeFileSync(
    profilePath,
    JSON.stringify({
      schema_version: 'delivery-profile.v1',
      profile_id:
        runtimeMode === 'closed_beta'
          ? 'receiver-cet4-beta'
          : 'receiver-production',
      environment_id:
        runtimeMode === 'closed_beta'
          ? 'receiver-cet4-beta'
          : 'receiver-production',
      region: 'ap-shanghai',
      api_base_url: 'https://receiver.example/softbook-api',
      runtime_mode: runtimeMode,
      enabled_tracks:
        runtimeMode === 'closed_beta' ? ['cet4'] : ['cet4', 'cet6'],
      minimum_client_versions: { ios: '1.0.0', android: '1.0.0' },
      signing_key_id: 'receiver-signing-key-v1',
    })
  );
  return { profilePath };
}

function dependencies() {
  return {
    clock: createClock(),
    env: tokens(),
    idFactory: createIdFactory(),
    nodeVersion: '22.13.0',
    repository: {
      branch: 'main',
      dirty: false,
      head: 'a'.repeat(40),
      originMain: 'a'.repeat(40),
    },
    transport: createTransport(),
  };
}

function tokens() {
  return {
    SOFTBOOK_CET_SPACE_DRILL_TOKEN_A: 'client-a-secret-token-value',
    SOFTBOOK_CET_SPACE_DRILL_TOKEN_B: 'client-b-secret-token-value',
  };
}

function createClock() {
  let second = 0;
  return () => new Date(Date.UTC(2026, 7, 23, 13, 0, second++));
}

function createIdFactory() {
  let id = 0;
  return () => `id_${++id}`;
}

function createTransport({
  duplicateIncrements = false,
  conflictIncrements = false,
} = {}) {
  const contentVersion = `sha256:${'c'.repeat(64)}`;
  const ledgers = new Map();
  const stateValue = { favorite: false, sleep: false };
  let revisionValue = 0;
  return {
    revision: () => revisionValue,
    state: () => structuredClone(stateValue),
    async request(_token, requestPath, options = {}) {
      if (requestPath.startsWith('/v2/learning/card-source')) {
        return {
          status: 200,
          payload: {
            data: {
              track: 'cet4',
              content_version: contentVersion,
              card_records: Array.from({ length: 1180 }, (_, index) => ({
                card_id: `card-${String(index).padStart(4, '0')}`,
              })),
            },
          },
        };
      }
      if (requestPath.startsWith('/v2/bootstrap')) {
        return bootstrapResponse(contentVersion, revisionValue, stateValue);
      }
      if (requestPath === '/v2/space/actions' && options.method === 'POST') {
        const action = options.body.actions[0];
        const canonical = JSON.stringify(action);
        const previous = ledgers.get(action.action_id);
        if (previous && previous !== canonical) {
          if (conflictIncrements) revisionValue += 1;
          return {
            status: 409,
            payload: {
              error: {
                code: 'space_action_id_conflict',
                message: 'conflict',
              },
            },
          };
        }
        let status = 'duplicate';
        if (!previous) {
          ledgers.set(action.action_id, canonical);
          stateValue[action.dimension] = action.value;
          revisionValue += 1;
          status = 'applied';
        } else if (duplicateIncrements) {
          revisionValue += 1;
        }
        return {
          status: 200,
          payload: {
            data: {
              schema_version: 'space-actions-ack.v2',
              track: 'cet4',
              content_version: contentVersion,
              acknowledged_at: '2026-08-23T13:00:00.000Z',
              results: [{ action_id: action.action_id, status }],
              space_state: {
                schema_version: 'space-state.v2',
                track: 'cet4',
                content_version: contentVersion,
                acknowledged_at: '2026-08-23T13:00:00.000Z',
                states: [
                  {
                    card_id: action.card_id,
                    is_favorited: stateValue.favorite,
                    is_sleeping: stateValue.sleep,
                    last_modified_at: '2026-08-23T13:00:00.000Z',
                  },
                ],
              },
            },
          },
        };
      }
      throw new Error(`unexpected request ${requestPath}`);
    },
  };
}

function bootstrapResponse(contentVersion, revision, state) {
  return {
    status: 200,
    payload: {
      data: {
        schema_version: 'bootstrap.v2',
        track: 'cet4',
        content: { version: contentVersion },
        component_revisions: {
          space: { state_revision: revision },
          learning: { space_revision: revision },
          progress: { space_revision: revision },
        },
        space: {
          states:
            revision === 0
              ? []
              : [
                  {
                    card_id: 'card-0000',
                    is_favorited: state.favorite,
                    is_sleeping: state.sleep,
                  },
                ],
        },
      },
    },
  };
}
