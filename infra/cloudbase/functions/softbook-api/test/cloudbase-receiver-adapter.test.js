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
        return JSON.stringify({
          data: {fileID: 'cloud://receiver-bucket/approved.mp3'},
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

  assert.equal(fileId, 'cloud://receiver-bucket/approved.mp3');
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes('upload'));
  assert.ok(calls[1].includes('download'));
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
  runner.seedCurrent(createRuntimeCardSource('cet4-beta-current', null));

  const result = await deliveryModule.rollbackToRetainedRelease('cet4-beta-retained', adapter);

  assert.equal(result.deleted_learning_data, false);
  assert.equal(runner.current().release.release_id, 'cet4-beta-retained');
  assert.equal(
    runner.calls.some(call => call.kind === 'delete'),
    false,
  );
});

function createRuntimeCardSource(releaseId, parentReleaseId) {
  const catalog = catalogModule.loadBoxCatalog();
  const [knowledgeRef, metadata] = [
    ...catalogModule.catalogEntriesByRef(catalog, 'cet4').entries(),
  ][0];
  const payload = {
    assets: [
      {
        asset_id: `cet4.${knowledgeRef}00.prompt`,
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
        track: 'cet4',
        interaction_id: 'flip',
        front: {
          eyebrow: 'Test task',
          prompt: 'Contract prompt',
          support: 'Contract support',
          context: 'Contract context',
        },
        back_text: 'Contract answer',
        auto_scoring: false,
        audio: {
          asset_id: `cet4.${knowledgeRef}00.prompt`,
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
    track: 'cet4',
  };
  const draft = require('../index').validateCardSourceForImport(payload, 'cet4');
  return require('../index').validateCardSourceForImport(
    {
      ...draft,
      release: {
        schema_version: 'content-release.v1',
        release_id: releaseId,
        track: 'cet4',
        content_version: draft.content_version,
        minimum_client_version: '1.0.0',
        parent_release_id: parentReleaseId,
        published_at: '2026-07-29T07:00:00.000Z',
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

function profileFixture() {
  return {
    schema_version: 'delivery-profile.v1',
    profile_id: 'receiver-closed-beta',
    environment_id: 'receiver-prod-123',
    region: 'ap-shanghai',
    api_base_url: 'https://receiver.example/softbook-api',
    runtime_mode: 'closed_beta',
    enabled_tracks: ['cet4'],
    minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
    signing_key_id: 'receiver-signing-key-1',
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
    current: () => collections.get('softbook_card_sources').get('cet4'),
    findVersion(releaseId) {
      return [...collections.get('softbook_card_source_versions').values()].find(
        document => document.release?.release_id === releaseId,
      );
    },
    seedCurrent(cardSource) {
      collections.get('softbook_card_sources').set('cet4', {
        _id: 'cet4',
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
