const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {mkdtempSync, rmSync, writeFileSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join, resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {after, before, test} = require('node:test');

let adapterModule;
let catalogModule;
let deliveryModule;
const temporaryDirectories = [];

before(async () => {
  adapterModule = await import(
    pathToFileURL(resolve(__dirname, '../../../cloudbase-receiver-adapter.mjs'))
  );
  catalogModule = await import(
    pathToFileURL(resolve(__dirname, '../../../card-source-catalog.mjs'))
  );
  deliveryModule = await import(
    pathToFileURL(resolve(__dirname, '../../../release-delivery-v1.mjs'))
  );
});

after(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, {force: true, recursive: true});
  }
});

test('receiver upload re-downloads and verifies the approved bytes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'receiver-upload-test-'));
  temporaryDirectories.push(directory);
  const bytes = Buffer.from('approved-audio-bytes');
  const absolutePath = join(directory, 'asset.mp3');
  writeFileSync(absolutePath, bytes);
  const calls = [];
  const runner = {
    async run(args) {
      calls.push(args);
      if (args.includes('upload')) {
        return [
          '- Loading data...',
          JSON.stringify({
            data: {
              cloudPath:
                'softbook/releases/cet4-beta-1/audio/' +
                `${hash(bytes).slice('sha256:'.length)}/cet4.100000.prompt.mp3`,
              failedCount: 0,
              successCount: 1,
              totalFiles: 1,
              type: 'file',
            },
          }),
          '✔ File upload successful!',
        ].join('\n');
      }
      if (args[0] === 'env' && args[1] === 'detail') {
        return JSON.stringify({
          data: {
            resources: {
              storages: [
                {
                  Bucket: 'receiver-storage-bucket-001',
                  Region: 'ap-shanghai',
                  Status: 'NORMAL',
                },
              ],
            },
          },
        });
      }
      if (args.includes('download')) {
        writeFileSync(args[args.indexOf('download') + 2], bytes);
        return JSON.stringify({data: {ok: true}});
      }
      throw new Error(`unexpected command ${args.join(' ')}`);
    },
  };
  const adapter = adapterModule.createCloudBaseReceiverAdapter({
    profile: profileFixture(),
    runner,
  });
  const fileId = await adapter.uploadAsset({
    absolutePath,
    asset: {
      asset_id: 'cet4.100000.prompt',
      duration_ms: 1000,
      sha256: hash(bytes),
      size_bytes: bytes.length,
    },
    releaseId: 'cet4-beta-1',
  });

  assert.equal(
    fileId,
    'cloud://receiver-prod-123.receiver-storage-bucket-001/' +
      `softbook/releases/cet4-beta-1/audio/${hash(bytes).slice('sha256:'.length)}/` +
      'cet4.100000.prompt.mp3',
  );
  assert.equal(calls.length, 3);
  assert.ok(calls[0].includes('upload'));
  assert.deepEqual(calls[1].slice(0, 2), ['env', 'detail']);
  assert.ok(calls[2].includes('download'));
});

test('receiver stages and verifies evidence before changing the active pointer', async () => {
  const runner = createDatabaseRunner();
  const adapter = adapterModule.createCloudBaseReceiverAdapter({
    now: () => new Date('2026-07-29T07:00:00.000Z'),
    profile: profileFixture(),
    runner,
  });
  const cardSource = createRuntimeCardSource('cet4-beta-1', null);
  const bundle = bundleFixture(cardSource, null);

  await adapter.stageContent({bundle, cardSource});
  await adapter.verifyStaged({bundle, cardSource});
  await adapter.activateRelease({bundle, cardSource});
  const active = await adapter.verifyActiveRelease({
    releaseId: bundle.release_id,
  });

  assert.equal(active.content_version, cardSource.content_version);
  const writes = runner.calls.filter(call => call.kind === 'update');
  assert.deepEqual(
    writes.map(call => call.collection),
    ['softbook_card_source_versions', 'softbook_card_source_versions', 'softbook_card_sources'],
  );
  assert.equal(writes.at(-1).collection, 'softbook_card_sources');
  assert.equal(runner.findVersion(bundle.release_id).release_verification.verified, true);
});

test('receiver stores and activates a verified pilot release without weakening formal releases', async () => {
  const runner = createDatabaseRunner();
  const adapter = adapterModule.createCloudBaseReceiverAdapter({
    now: () => new Date('2026-08-12T07:00:00.000Z'),
    profile: controlledPilotProfileFixture(),
    runner,
  });
  const cardSource = createPilotRuntimeCardSource('cet4-pilot-release-1');
  const bundle = pilotBundleFixture(cardSource);

  await adapter.stageContent({bundle, cardSource});
  await adapter.verifyStaged({bundle, cardSource});
  await adapter.activateRelease({bundle, cardSource});
  const active = await adapter.verifyActiveRelease({
    contentVersion: cardSource.content_version,
    releaseId: bundle.release_id,
  });

  assert.equal(active.release.schema_version, 'pilot-content-release.v1');
  assert.equal(active.release.gate_eligible, false);
  assert.equal(
    runner.findVersion(bundle.release_id).release_verification.schema_version,
    'pilot-stage-verification.v1',
  );
  assert.equal(
    runner.current().imported_via,
    'infra/cloudbase/deliver-controlled-pilot.mjs',
  );
});

test('receiver pilot activation refuses to replace a different active release', async () => {
  const runner = createDatabaseRunner();
  const adapter = adapterModule.createCloudBaseReceiverAdapter({
    profile: controlledPilotProfileFixture(),
    runner,
  });
  const current = createPilotRuntimeCardSource('cet4-pilot-release-current');
  runner.seedCurrent(current);
  const candidate = createPilotRuntimeCardSource('cet4-pilot-release-next');
  const bundle = pilotBundleFixture(candidate);

  await adapter.stageContent({bundle, cardSource: candidate});
  await adapter.verifyStaged({bundle, cardSource: candidate});
  await assert.rejects(
    () => adapter.activateRelease({bundle, cardSource: candidate}),
    /refuses to replace a different active release/,
  );
  assert.equal(runner.current().release.release_id, 'cet4-pilot-release-current');
});

test('receiver rejects a release whose parent is not currently active', async () => {
  const runner = createDatabaseRunner();
  const adapter = adapterModule.createCloudBaseReceiverAdapter({
    profile: profileFixture(),
    runner,
  });
  const current = createRuntimeCardSource('cet4-beta-current', null);
  runner.seedCurrent(current);
  const candidate = createRuntimeCardSource('cet4-beta-next', 'cet4-beta-unrelated');
  const bundle = bundleFixture(candidate, 'cet4-beta-unrelated');

  await adapter.stageContent({bundle, cardSource: candidate});
  await adapter.verifyStaged({bundle, cardSource: candidate});
  await assert.rejects(
    () => adapter.activateRelease({bundle, cardSource: candidate}),
    /does not match the bundle parent/,
  );
  assert.equal(runner.current().release.release_id, 'cet4-beta-current');
});

test('receiver never activates unverified environment-specific storage locators', async () => {
  const runner = createDatabaseRunner();
  const adapter = adapterModule.createCloudBaseReceiverAdapter({
    profile: profileFixture(),
    runner,
  });
  const candidate = createRuntimeCardSource('cet4-beta-locator', null);
  const bundle = bundleFixture(candidate, null);

  await adapter.stageContent({bundle, cardSource: candidate});
  runner.findVersion(bundle.release_id).assets[0].storage_file_id =
    'cloud://receiver-bucket/unverified.mp3';

  await assert.rejects(
    () => adapter.verifyStaged({bundle, cardSource: candidate}),
    /storage locators do not match/,
  );
  assert.equal(runner.current(), undefined);
});

test('rollback activates only a verified version and does not delete learning data', async () => {
  const runner = createDatabaseRunner();
  const adapter = adapterModule.createCloudBaseReceiverAdapter({
    profile: profileFixture(),
    runner,
  });
  const retained = createRuntimeCardSource('cet4-beta-retained', null);
  const retainedBundle = bundleFixture(retained, null);
  await adapter.stageContent({bundle: retainedBundle, cardSource: retained});
  await adapter.verifyStaged({bundle: retainedBundle, cardSource: retained});
  await adapter.activateRelease({bundle: retainedBundle, cardSource: retained});
  const current = createRuntimeCardSource(
    'cet4-beta-current',
    'cet4-beta-retained',
  );
  const currentBundle = bundleFixture(current, 'cet4-beta-retained');
  await adapter.stageContent({bundle: currentBundle, cardSource: current});
  await adapter.verifyStaged({bundle: currentBundle, cardSource: current});
  await adapter.activateRelease({bundle: currentBundle, cardSource: current});

  const result = await deliveryModule.rollbackToRetainedRelease('cet4-beta-retained', adapter);

  assert.equal(result.deleted_learning_data, false);
  assert.equal(runner.current().release.release_id, 'cet4-beta-retained');
  assert.equal(
    runner.calls.some(call => call.kind === 'delete'),
    false,
  );
});

test('CET6 rollback derives the retained track instead of assuming CET4', async () => {
  const runner = createDatabaseRunner();
  const adapter = adapterModule.createCloudBaseReceiverAdapter({
    profile: profileFixture('production'),
    runner,
  });
  const retained = createRuntimeCardSource(
    'cet6-production-retained',
    null,
    'cet6',
  );
  const retainedBundle = bundleFixture(retained, null);
  await adapter.stageContent({bundle: retainedBundle, cardSource: retained});
  await adapter.verifyStaged({bundle: retainedBundle, cardSource: retained});
  await adapter.activateRelease({bundle: retainedBundle, cardSource: retained});

  const current = createRuntimeCardSource(
    'cet6-production-current',
    'cet6-production-retained',
    'cet6',
  );
  const currentBundle = bundleFixture(current, 'cet6-production-retained');
  await adapter.stageContent({bundle: currentBundle, cardSource: current});
  await adapter.verifyStaged({bundle: currentBundle, cardSource: current});
  await adapter.activateRelease({bundle: currentBundle, cardSource: current});

  const result = await deliveryModule.rollbackToRetainedRelease(
    'cet6-production-retained',
    adapter,
  );

  assert.equal(result.deleted_learning_data, false);
  assert.equal(
    runner.current('cet6').release.release_id,
    'cet6-production-retained',
  );
});

test('rollback rejects a verified release that was never retained', async () => {
  const runner = createDatabaseRunner();
  const adapter = adapterModule.createCloudBaseReceiverAdapter({
    profile: profileFixture(),
    runner,
  });
  const verifiedOnly = createRuntimeCardSource('cet4-beta-verified-only', null);
  const bundle = bundleFixture(verifiedOnly, null);
  await adapter.stageContent({bundle, cardSource: verifiedOnly});
  await adapter.verifyStaged({bundle, cardSource: verifiedOnly});

  await assert.rejects(
    () =>
      deliveryModule.rollbackToRetainedRelease(
        'cet4-beta-verified-only',
        adapter,
      ),
    /not a verified retained release/,
  );
  assert.equal(runner.current(), undefined);
});

function createRuntimeCardSource(releaseId, parentReleaseId, track = 'cet4') {
  const catalog = catalogModule.loadBoxCatalog();
  const [knowledgeRef, metadata] = [
    ...catalogModule.catalogEntriesByRef(catalog, track).entries(),
  ][0];
  const payload = {
    assets: [
      {
        asset_id: `${track}.${knowledgeRef}00.prompt`,
        duration_ms: 1000,
        media_type: 'audio/mpeg',
        sha256: `sha256:${'e'.repeat(64)}`,
        size_bytes: 20,
        storage_file_id: `cloud://receiver-bucket/${releaseId}.mp3`,
      },
    ],
    card_records: [
      {
        card_id: `${knowledgeRef}00`,
        knowledge_ref: knowledgeRef,
        track,
        interaction_id: 'flip',
        front: {
          eyebrow: 'Test task',
          prompt: `Contract prompt ${releaseId}`,
          support: 'Contract support',
          context: 'Contract context',
        },
        back_text: 'Contract answer',
        auto_scoring: false,
        audio: {
          asset_id: `${track}.${knowledgeRef}00.prompt`,
          duration_ms: 1000,
          sha256: `sha256:${'e'.repeat(64)}`,
          transcript: 'Contract transcript',
        },
        analysis: {
          title: 'Contract analysis',
          summary: 'Contract summary',
          exam_tip: 'Contract only',
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
    source: {id: 'receiver-contract', label: 'Receiver contract'},
    track,
  };
  const draft = require('../index').validateCardSourceForImport(payload, track);
  return require('../index').validateCardSourceForImport(
    {
      ...draft,
      release: {
        schema_version: 'content-release.v1',
        release_id: releaseId,
        track,
        content_version: draft.content_version,
        minimum_client_version: '1.0.0',
        parent_release_id: parentReleaseId,
        published_at: '2026-07-29T07:00:00.000Z',
      },
    },
    track,
  );
}

function createPilotRuntimeCardSource(releaseId) {
  const formal = createRuntimeCardSource(releaseId, null);
  return require('../index').validateCardSourceForImport(
    {
      ...formal,
      release: {
        schema_version: 'pilot-content-release.v1',
        pilot_id: 'cet4-pilot-2026',
        profile_id: 'receiver-pilot-profile',
        release_id: releaseId,
        release_class: 'controlled_pilot',
        runtime_mode: 'controlled_pilot',
        track: 'cet4',
        content_version: formal.content_version,
        card_count: 120,
        free_card_count: 60,
        activated_at: '2026-08-12T07:00:00.000Z',
        expires_at: '2026-09-10T00:00:00.000Z',
        minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
        gate_eligible: false,
      },
    },
    'cet4',
  );
}

function bundleFixture(cardSource, parentReleaseId) {
  return {
    bundle_id: `bundle-${cardSource.release.release_id}`,
    release_id: cardSource.release.release_id,
    parent_release_id: parentReleaseId,
    approval: {record_sha256: `sha256:${'a'.repeat(64)}`},
    audit: {report_sha256: `sha256:${'b'.repeat(64)}`},
    audio: {
      manifest_sha256: `sha256:${'c'.repeat(64)}`,
      qc_index_sha256: `sha256:${'d'.repeat(64)}`,
    },
  };
}

function pilotBundleFixture(cardSource) {
  return {
    schema_version: 'controlled-pilot-bundle.v1',
    bundle_id: `bundle-${cardSource.release.release_id}`,
    pilot_id: cardSource.release.pilot_id,
    release_id: cardSource.release.release_id,
    approval: {record_sha256: `sha256:${'a'.repeat(64)}`},
    audit: {report_sha256: `sha256:${'b'.repeat(64)}`},
    audio: {
      manifest_sha256: `sha256:${'c'.repeat(64)}`,
      qc_index_sha256: `sha256:${'d'.repeat(64)}`,
    },
  };
}

function profileFixture(runtimeMode = 'closed_beta') {
  const production = runtimeMode === 'production';
  return {
    schema_version: 'delivery-profile.v1',
    profile_id: production ? 'receiver-production' : 'receiver-closed-beta',
    environment_id: 'receiver-prod-123',
    region: 'ap-shanghai',
    api_base_url: 'https://receiver.example/softbook-api',
    runtime_mode: runtimeMode,
    enabled_tracks: production ? ['cet4', 'cet6'] : ['cet4'],
    minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
    signing_key_id: 'receiver-signing-key-1',
  };
}

function controlledPilotProfileFixture() {
  return {
    schema_version: 'controlled-pilot-profile.v1',
    profile_id: 'receiver-pilot-profile',
    pilot_id: 'cet4-pilot-2026',
    environment_id: 'receiver-pilot-123',
    region: 'ap-shanghai',
    api_base_url: 'https://pilot.receiver.example/softbook-api',
    runtime_mode: 'controlled_pilot',
    enabled_tracks: ['cet4'],
    minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
    signing_key_id: 'receiver-pilot-signing-key-1',
    cohort_limit: 50,
    pilot_expires_at: '2026-09-10T00:00:00.000Z',
    gate_eligible: false,
  };
}

function createDatabaseRunner() {
  const collections = new Map([
    ['softbook_card_sources', new Map()],
    ['softbook_card_source_versions', new Map()],
  ]);
  const calls = [];

  return {
    calls,
    current: (track = 'cet4') =>
      collections.get('softbook_card_sources').get(track),
    findVersion(releaseId) {
      return [...collections.get('softbook_card_source_versions').values()].find(
        document => document.release?.release_id === releaseId,
      );
    },
    seedCurrent(cardSource) {
      collections.get('softbook_card_sources').set(cardSource.track, {
        _id: cardSource.track,
        ...cardSource,
      });
    },
    async run(args) {
      const commandIndex = args.indexOf('--command');
      assert.notEqual(commandIndex, -1);
      const commands = JSON.parse(args[commandIndex + 1]);
      const results = [];

      for (const command of commands) {
        const body = JSON.parse(command.Command);
        const collection = collections.get(command.TableName);
        if (command.CommandType === 'QUERY') {
          const matches = [...collection.values()].filter(document =>
            matchesFilter(document, body.filter),
          );
          calls.push({kind: 'query', collection: command.TableName});
          results.push(matches.slice(0, body.limit));
        } else if (command.CommandType === 'UPDATE') {
          const update = body.updates[0];
          const existing = [...collection.values()].find(document =>
            matchesFilter(document, update.q),
          );
          const id = existing?._id ?? update.q._id;
          assert.ok(id);
          collection.set(id, {
            ...(existing ?? {_id: id}),
            ...update.u.$set,
          });
          calls.push({kind: 'update', collection: command.TableName});
          results.push({ok: 1, n: 1});
        } else {
          calls.push({kind: 'delete', collection: command.TableName});
          throw new Error(`unsupported command ${command.CommandType}`);
        }
      }

      return JSON.stringify({data: {results}});
    },
  };
}

function matchesFilter(document, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = key.split('.').reduce((value, segment) => value?.[segment], document);
    return actual === expected;
  });
}

function hash(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}
