const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const {tmpdir} = require('node:os');
const {dirname, join, resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {after, before, test} = require('node:test');

let catalogModule;
let simulationModule;
const temporaryDirectories = [];

before(async () => {
  catalogModule = await import(
    pathToFileURL(resolve(__dirname, '../../../card-source-catalog.mjs'))
  );
  simulationModule = await import(
    pathToFileURL(
      resolve(
        __dirname,
        '../../../release-blank-environment-simulation.mjs',
      ),
    )
  );
});

after(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, {force: true, recursive: true});
  }
});

test('blank receiver publishes A then B, verifies B, rolls back A, and reverifies A', async () => {
  const releaseA = createVerifiedRelease({
    parentReleaseId: null,
    releaseId: 'cet4-simulation-a',
    salt: 'a',
  });
  const releaseB = createVerifiedRelease({
    parentReleaseId: releaseA.bundle.release_id,
    releaseId: 'cet4-simulation-b',
    salt: 'b',
  });

  const report = await simulationModule.runReleaseBlankEnvironmentSimulation({
    gate_eligible: true,
    now: () => new Date('2026-07-31T00:00:00.000Z'),
    releaseA,
    releaseB,
    simulation: false,
  });

  assert.equal(
    report.schema_version,
    'release-blank-environment-simulation.v1',
  );
  assert.equal(report.status, 'passed');
  assert.equal(report.simulation, true);
  assert.equal(report.gate_eligible, false);
  assert.equal(report.execution_mode, 'repository_in_memory');
  assert.equal(report.credential_mode, 'none');
  assert.equal(report.network_access, false);
  assert.equal(report.environment.initially_blank, true);
  assert.deepEqual(report.sequence, [
    'assert_blank',
    'publish_a',
    'verify_a',
    'seed_user_data_sentinel',
    'publish_b',
    'verify_b',
    'rollback_a',
    'reverify_a',
  ]);
  assert.equal(report.releases.a.release_id, releaseA.bundle.release_id);
  assert.equal(report.releases.b.release_id, releaseB.bundle.release_id);
  assert.equal(
    report.releases.active_after_rollback.release_id,
    releaseA.bundle.release_id,
  );
  assert.equal(report.assertions.release_a_retained_before_rollback, true);
  assert.equal(report.assertions.release_a_publish_left_user_data_blank, true);
  assert.equal(report.assertions.release_b_retained_after_rollback, true);
  assert.equal(
    report.assertions.release_a_active_identity_reverified_after_rollback,
    true,
  );
  assert.equal(report.assertions.user_data_sentinel_unchanged, true);
  assert.match(
    report.assertions.user_data_snapshot_sha256,
    /^sha256:[a-f0-9]{64}$/,
  );
  assert.equal(report.assertions.delete_attempt_count, 0);
  assert.equal(report.assertions.forbidden_command_attempt_count, 0);
  assert.equal(report.assertions.user_data_database_update_count, 0);
  assert.equal(report.assertions.release_version_count, 2);
  assert.equal(report.assertions.retained_release_count, 2);
  assert.equal(report.assertions.storage_object_count, 2);
  assert.equal(report.operations.storage_upload, 2);
  assert.equal(report.operations.storage_download, 2);
  assert.ok(report.operations.database_update > 0);
  assert.ok(report.operations.database_query > 0);
});

test('simulation rejects a B release that is not the child of A', async () => {
  const releaseA = createVerifiedRelease({
    parentReleaseId: null,
    releaseId: 'cet4-simulation-parent-a',
    salt: 'parent-a',
  });
  const releaseB = createVerifiedRelease({
    parentReleaseId: 'cet4-unrelated-parent',
    releaseId: 'cet4-simulation-parent-b',
    salt: 'parent-b',
  });

  await assert.rejects(
    () =>
      simulationModule.runReleaseBlankEnvironmentSimulation({
        releaseA,
        releaseB,
      }),
    /must name release A as its parent/,
  );
});

test('simulation rejects releases with the same content identity', async () => {
  const releaseA = createVerifiedRelease({
    parentReleaseId: null,
    releaseId: 'cet4-simulation-content-a',
    salt: 'same-content',
  });
  const releaseB = createVerifiedRelease({
    parentReleaseId: releaseA.bundle.release_id,
    releaseId: 'cet4-simulation-content-b',
    salt: 'same-content',
  });

  await assert.rejects(
    () =>
      simulationModule.runReleaseBlankEnvironmentSimulation({
        releaseA,
        releaseB,
      }),
    /distinct identities and content/,
  );
});

test('in-memory receiver rejects DELETE and external command surfaces', async () => {
  const receiver = simulationModule.createInMemoryReleaseReceiver({
    environmentId: 'receiver-simulation-only',
  });
  const deleteCommand = {
    TableName: 'softbook_learning_events',
    CommandType: 'DELETE',
    Command: JSON.stringify({
      delete: 'softbook_learning_events',
      deletes: [],
    }),
  };

  await assert.rejects(
    () =>
      receiver.runner.run([
        'db',
        'nosql',
        'execute',
        '-e',
        'receiver-simulation-only',
        '--command',
        JSON.stringify([deleteCommand]),
        '--json',
      ]),
    /forbids delete operations/,
  );
  assert.equal(receiver.deleteAttemptCount, 1);

  await assert.rejects(
    () =>
      receiver.runner.run([
        '-e',
        'receiver-simulation-only',
        'api',
        'tcb',
        'DescribeEnvs',
        '--json',
      ]),
    /forbids network and external commands/,
  );
  assert.equal(receiver.forbiddenCommandAttemptCount, 1);

  await assert.rejects(
    () =>
      receiver.runner.run([
        'db',
        'nosql',
        'execute',
        'api',
        'tcb',
        'DescribeEnvs',
        '-e',
        'receiver-simulation-only',
        '--command',
        '[]',
        '--json',
      ]),
    /forbids network and external commands/,
  );
  await assert.rejects(
    () =>
      receiver.runner.run([
        '-e',
        'receiver-simulation-only',
        'storage',
        'upload',
        '/not-read',
        'not-uploaded',
        '--json',
        'api',
      ]),
    /forbids extended storage commands/,
  );
  assert.equal(receiver.forbiddenCommandAttemptCount, 3);
});

test('in-memory receiver detects DELETE fields smuggled into an UPDATE', async () => {
  const receiver = simulationModule.createInMemoryReleaseReceiver({
    environmentId: 'receiver-delete-smuggling',
  });
  receiver.seedDocument('softbook_learning_events', {
    _id: 'sentinel',
    unchanged: true,
  });
  const before = receiver.snapshotCollections(['softbook_learning_events']);
  const smuggled = {
    TableName: 'softbook_learning_events',
    CommandType: 'UPDATE',
    Command: JSON.stringify({
      delete: 'softbook_learning_events',
      update: 'softbook_learning_events',
      updates: [
        {
          q: {_id: 'sentinel'},
          u: {$set: {unchanged: false}},
          upsert: true,
        },
      ],
    }),
  };

  await assert.rejects(
    () =>
      receiver.runner.run([
        'db',
        'nosql',
        'execute',
        '-e',
        'receiver-delete-smuggling',
        '--command',
        JSON.stringify([smuggled]),
        '--json',
      ]),
    /forbids delete operations/,
  );
  assert.equal(receiver.deleteAttemptCount, 1);
  assert.equal(
    receiver.snapshotCollections(['softbook_learning_events']),
    before,
  );
});

test('in-memory receiver replacement removes stale source fields only on the active collection', async () => {
  const environmentId = 'receiver-pointer-replacement';
  const receiver = simulationModule.createInMemoryReleaseReceiver({environmentId});
  receiver.seedDocument('softbook_card_sources', {
    _id: 'cet4',
    card_records: [{card_id: 'stale'}],
    source: {id: 'stale', label: 'Stale'},
  });
  const pointer = {
    _id: 'cet4',
    content_version: `sha256:${'a'.repeat(64)}`,
    release_id: 'cet4-release-pointer',
    schema_version: 'card-source-active-pointer.v1',
    track: 'cet4',
    updated_at: '2026-08-31T02:21:25.188Z',
    version_id: 'b'.repeat(64),
  };
  const replacement = tableName => ({
    TableName: tableName,
    CommandType: 'UPDATE',
    Command: JSON.stringify({
      update: tableName,
      updates: [{q: {_id: 'cet4'}, u: pointer, upsert: true}],
    }),
  });
  const execute = command =>
    receiver.runner.run([
      'db',
      'nosql',
      'execute',
      '-e',
      environmentId,
      '--command',
      JSON.stringify([command]),
      '--json',
    ]);

  await execute(replacement('softbook_card_sources'));
  const snapshot = JSON.parse(
    receiver.snapshotCollections(['softbook_card_sources']),
  );
  assert.deepEqual(snapshot[0][1][0], pointer);
  await assert.rejects(
    () => execute(replacement('softbook_learning_events')),
    /active pointer replacement is invalid/,
  );
});

function createVerifiedRelease({parentReleaseId, releaseId, salt}) {
  const directory = mkdtempSync(join(tmpdir(), 'release-simulation-'));
  temporaryDirectories.push(directory);
  const catalog = catalogModule.loadBoxCatalog();
  const [knowledgeRef, metadata] = [
    ...catalogModule.catalogEntriesByRef(catalog, 'cet4').entries(),
  ][0];
  const cardId = `${knowledgeRef}00`;
  const assetId = `cet4.${cardId}.prompt`;
  const assetPath = `audio/${assetId}.mp3`;
  const bytes = Buffer.from(`simulation-audio-${salt}`);
  writeFixture(directory, assetPath, bytes);
  const assetHash = hash(bytes);
  const rawContent = {
    assets: [
      {
        asset_id: assetId,
        asset_path: assetPath,
        duration_ms: 1000,
        media_type: 'audio/mpeg',
        sha256: assetHash,
        size_bytes: bytes.length,
      },
    ],
    card_records: [
      {
        card_id: cardId,
        knowledge_ref: knowledgeRef,
        track: 'cet4',
        interaction_id: 'flip',
        front: {
          eyebrow: 'Simulation task',
          prompt: `Simulation prompt ${salt}`,
          support: 'Repository-only simulation',
          context: 'Not release evidence',
        },
        back_text: `Simulation answer ${salt}`,
        auto_scoring: false,
        audio: {
          asset_id: assetId,
          duration_ms: 1000,
          sha256: assetHash,
          transcript: `Simulation transcript ${salt}`,
        },
        analysis: {
          title: 'Simulation analysis',
          summary: `Simulation summary ${salt}`,
          exam_tip: 'Repository simulation only',
        },
        space_metadata: {
          box_ref: knowledgeRef,
          library: metadata.library,
          group: metadata.group,
          box: metadata.box,
        },
      },
    ],
    release: null,
    source: {id: 'release-simulation', label: 'Release simulation'},
    track: 'cet4',
  };
  const content = require('../index').validateCardSourceForReleaseBundle(
    rawContent,
    'cet4',
  );
  const bundle = {
    bundle_id: `bundle-${releaseId}`,
    release_id: releaseId,
    track: 'cet4',
    release_at: '2026-07-31T00:00:00.000Z',
    parent_release_id: parentReleaseId,
    content: {content_version: content.content_version},
    approval: {record_sha256: `sha256:${'a'.repeat(64)}`},
    audit: {report_sha256: `sha256:${'b'.repeat(64)}`},
    audio: {
      manifest_sha256: `sha256:${'c'.repeat(64)}`,
      qc_index_sha256: `sha256:${'d'.repeat(64)}`,
    },
    minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
  };
  return {
    profile: profileFixture(),
    bundle,
    content,
    audio_manifest: {
      assets: [
        {
          asset_id: assetId,
          asset_path: assetPath,
          duration_ms: 1000,
          sha256: assetHash,
          size_bytes: bytes.length,
        },
      ],
    },
    bundle_directory: directory,
  };
}

function profileFixture() {
  return {
    schema_version: 'delivery-profile.v1',
    profile_id: 'receiver-simulation',
    environment_id: 'receiver-simulation-only',
    region: 'ap-shanghai',
    api_base_url: 'https://simulation.invalid/softbook-api',
    runtime_mode: 'closed_beta',
    enabled_tracks: ['cet4'],
    minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
    signing_key_id: 'simulation-signing-key-v1',
  };
}

function writeFixture(root, relativePath, value) {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, value);
  return path;
}

function hash(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}
