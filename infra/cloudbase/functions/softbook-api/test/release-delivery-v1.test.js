const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const {tmpdir} = require('node:os');
const {dirname, join, resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {after, before, test} = require('node:test');

let delivery;
let catalogModule;
let verifyCli;
const temporaryDirectories = [];

before(async () => {
  delivery = await import(
    pathToFileURL(resolve(__dirname, '../../../release-delivery-v1.mjs'))
  );
  catalogModule = await import(
    pathToFileURL(resolve(__dirname, '../../../card-source-catalog.mjs'))
  );
  verifyCli = await import(
    pathToFileURL(resolve(__dirname, '../../../verify-release-bundle.mjs'))
  );
});

after(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, {force: true, recursive: true});
  }
});

test('delivery profile is receiver-owned and contains no secret material', () => {
  const valid = delivery.validateDeliveryProfile(profileFixture());
  assert.equal(valid.runtime_mode, 'closed_beta');
  assert.deepEqual(valid.enabled_tracks, ['cet4']);

  const production = delivery.validateDeliveryProfile(
    profileFixture('production'),
  );
  assert.equal(production.runtime_mode, 'production');
  assert.deepEqual(production.enabled_tracks, ['cet4', 'cet6']);

  assert.throws(
    () =>
      delivery.validateDeliveryProfile({
        ...profileFixture(),
        environment_id: delivery.PERSONAL_DEVELOPMENT_ENVIRONMENT,
      }),
    /personal development environment/,
  );
  assert.throws(
    () =>
      delivery.validateDeliveryProfile({
        ...profileFixture(),
        api_key: 'must-not-be-here',
      }),
    /unsupported or missing fields/,
  );
});

test('delivery profiles fail closed on partial or reordered production tracks', () => {
  assert.throws(
    () =>
      delivery.validateDeliveryProfile({
        ...profileFixture('production'),
        enabled_tracks: ['cet6'],
      }),
    /enabled_tracks must be exactly/,
  );
  assert.throws(
    () =>
      delivery.validateDeliveryProfile({
        ...profileFixture('production'),
        enabled_tracks: ['cet6', 'cet4'],
      }),
    /enabled_tracks must be exactly/,
  );
});

test('content version is independent of receiver storage file IDs', () => {
  const fixture = createValidBundleFixture();
  const bundlePayload = fixture.content;
  const runtimePayload = {
    ...bundlePayload,
    assets: bundlePayload.assets.map(asset => ({
      asset_id: asset.asset_id,
      duration_ms: asset.duration_ms,
      media_type: asset.media_type,
      sha256: asset.sha256,
      size_bytes: asset.size_bytes,
      storage_file_id: `cloud://receiver-bucket/${asset.asset_id}.mp3`,
    })),
  };
  const runtime = require('../index').validateCardSourceForImport(
    runtimePayload,
    'cet4',
  );
  assert.equal(runtime.content_version, bundlePayload.content_version);
});

test('release bundle verifies all cards, boxes, approval, audio hashes, and QC', () => {
  const fixture = createValidBundleFixture();
  const verified = delivery.verifyReleaseBundleDirectory({
    bundlePath: fixture.bundlePath,
    profilePath: fixture.profilePath,
  });

  assert.equal(verified.content.card_records.length, 1180);
  assert.equal(verified.audio_manifest.assets.length, 301);
  assert.equal(verified.audio_qc_index.assets.length, 301);
});

test('production release bundle verifies the complete CET6 track', () => {
  const fixture = createValidBundleFixture('cet6');
  const verified = delivery.verifyReleaseBundleDirectory({
    bundlePath: fixture.bundlePath,
    profilePath: fixture.profilePath,
  });

  assert.equal(verified.bundle.track, 'cet6');
  assert.equal(verified.content.card_records.length, 1234);
  assert.equal(verified.audio_manifest.assets.length, 328);
  assert.equal(verified.audio_qc_index.assets.length, 328);
});

test('closed beta profile cannot publish a CET6 bundle', () => {
  const fixture = createValidBundleFixture('cet6');
  writeJson(fixture.directory, 'delivery-profile.json', profileFixture());

  assert.throws(
    () =>
      delivery.verifyReleaseBundleDirectory({
        bundlePath: fixture.bundlePath,
        profilePath: fixture.profilePath,
      }),
    /not enabled by the delivery profile/,
  );
});

test('read-only verifier CLI reports publisher readiness without writing CloudBase', () => {
  const fixture = createValidBundleFixture();
  const options = verifyCli.parseArguments([
    '--profile',
    fixture.profilePath,
    '--bundle',
    fixture.bundlePath,
    '--format',
    'json',
  ]);
  const result = verifyCli.verifyFromArguments(options);

  assert.equal(result.ready_for_publisher, true);
  assert.equal(result.cloudbase_writes_performed, false);
  assert.equal(result.card_count, 1180);
  assert.equal(result.audio_qc_count, 301);
});

test('release bundle fails closed when one audio byte changes', () => {
  const fixture = createValidBundleFixture();
  writeFileSync(
    join(fixture.directory, fixture.audioManifest.assets[0].asset_path),
    'tampered',
  );

  assert.throws(
    () =>
      delivery.verifyReleaseBundleDirectory({
        bundlePath: fixture.bundlePath,
        profilePath: fixture.profilePath,
      }),
    /SHA-256 mismatch/,
  );
});

test('release bundle fails closed when exported content loses its approved corpus binding', () => {
  const fixture = createValidBundleFixture();
  const bundle = JSON.parse(readFileSync(fixture.bundlePath, 'utf8'));
  const contentPath = join(fixture.directory, bundle.content.payload_path);
  const content = JSON.parse(readFileSync(contentPath, 'utf8'));
  content.corpus_fingerprint = `sha256:${'0'.repeat(64)}`;
  writeFileSync(contentPath, `${JSON.stringify(content, null, 2)}\n`);
  bundle.content.payload_sha256 = hash(readFileSync(contentPath));
  writeFileSync(fixture.bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);

  assert.throws(
    () =>
      delivery.verifyReleaseBundleDirectory({
        bundlePath: fixture.bundlePath,
        profilePath: fixture.profilePath,
      }),
    /content payload corpus fingerprint/,
  );
});

test('publisher activates only after every upload, stage, and verification succeeds', async () => {
  const fixture = createValidBundleFixture();
  const verified = delivery.verifyReleaseBundleDirectory({
    bundlePath: fixture.bundlePath,
    profilePath: fixture.profilePath,
  });
  const calls = [];
  const result = await delivery.publishVerifiedRelease(verified, {
    uploadAsset: async ({asset}) => {
      calls.push(`upload:${asset.asset_id}`);
      return `cloud://receiver-bucket/${asset.asset_id}.mp3`;
    },
    stageContent: async ({cardSource}) => {
      calls.push('stage');
      assert.equal(
        cardSource.content_version,
        verified.bundle.content.content_version,
      );
    },
    verifyStaged: async () => calls.push('verify'),
    activateRelease: async () => calls.push('activate'),
  });

  assert.equal(result.uploaded_asset_count, 301);
  assert.deepEqual(calls.slice(-3), ['stage', 'verify', 'activate']);
  assert.equal(calls.indexOf('activate'), calls.length - 1);
});

test('publisher never activates after staged verification fails', async () => {
  const fixture = createValidBundleFixture();
  const verified = delivery.verifyReleaseBundleDirectory({
    bundlePath: fixture.bundlePath,
    profilePath: fixture.profilePath,
  });
  let activated = false;

  await assert.rejects(
    delivery.publishVerifiedRelease(verified, {
      uploadAsset: async ({asset}) =>
        `cloud://receiver-bucket/${asset.asset_id}.mp3`,
      stageContent: async () => {},
      verifyStaged: async () => {
        throw new Error('remote verification failed');
      },
      activateRelease: async () => {
        activated = true;
      },
    }),
    /remote verification failed/,
  );
  assert.equal(activated, false);
});

test('rollback switches only to a verified retained release', async () => {
  const calls = [];
  const result = await delivery.rollbackToRetainedRelease(
    'cet4-beta-previous',
    {
      verifyRetainedRelease: async releaseId => {
        calls.push(`verify:${releaseId}`);
        return {release_id: releaseId, verified: true};
      },
      activateRetainedRelease: async retained =>
        calls.push(`activate:${retained.release_id}`),
    },
  );

  assert.deepEqual(calls, [
    'verify:cet4-beta-previous',
    'activate:cet4-beta-previous',
  ]);
  assert.equal(result.deleted_learning_data, false);
});

function createValidBundleFixture(track = 'cet4') {
  const directory = mkdtempSync(join(tmpdir(), 'softbook-release-bundle-'));
  temporaryDirectories.push(directory);
  const catalog = catalogModule.loadBoxCatalog();
  const policy =
    track === 'cet4'
      ? {cardCount: 1180, boxCount: 108, audioCount: 301}
      : {cardCount: 1234, boxCount: 110, audioCount: 328};
  const entries = [
    ...catalogModule.catalogEntriesByRef(catalog, track).entries(),
  ];
  assert.equal(entries.length, policy.boxCount);
  const cards = [];
  const assets = [];

  for (let index = 0; index < policy.cardCount; index += 1) {
    const [knowledgeRef, metadata] = entries[index % entries.length];
    const sequence = Math.floor(index / entries.length);
    const cardId = `${knowledgeRef}${String(sequence).padStart(2, '0')}`;
    const card = {
      card_id: cardId,
      knowledge_ref: knowledgeRef,
      track,
      interaction_id: 'flip',
      front: {
        eyebrow: 'Test task',
        prompt: `Contract test prompt ${index}`,
        support: 'Contract-only generated fixture',
        context: 'Not release content',
      },
      back_text: `Contract test answer ${index}`,
      auto_scoring: false,
      analysis: {
        title: 'Contract test analysis',
        summary: `Explanation ${index}`,
        exam_tip: 'Fixture only',
      },
      space_metadata: {
        box_ref: knowledgeRef,
        library: metadata.library,
        group: metadata.group,
        box: metadata.box,
      },
    };

    if (index < policy.audioCount) {
      const assetId = `${track}.${cardId}.prompt`;
      const assetPath = `audio/${assetId}.mp3`;
      const bytes = Buffer.from(`contract-audio-${index}`);
      writeFixture(directory, assetPath, bytes);
      const sha256 = hash(bytes);
      const asset = {
        asset_id: assetId,
        asset_path: assetPath,
        duration_ms: 1000 + index,
        media_type: 'audio/mpeg',
        sha256,
        size_bytes: bytes.length,
      };
      assets.push(asset);
      card.audio = {
        asset_id: assetId,
        duration_ms: asset.duration_ms,
        sha256,
        transcript: `Contract transcript ${index}`,
      };
    }
    cards.push(card);
  }

  const rawContent = {
    source: {
      id: `${track}-formal-track`,
      label: `${track.toUpperCase()} formal track`,
    },
    track,
    assets,
    card_records: cards,
    release: null,
  };
  const content = require('../index').validateCardSourceForReleaseBundle(
    rawContent,
    track,
  );
  const corpusDigest = createHash('sha256')
    .update(JSON.stringify(cards))
    .digest('hex');
  const contentPath = writeJson(directory, `content/${track}.json`, {
    ...content,
    corpus_fingerprint: `sha256:${corpusDigest}`,
  });
  const contentHash = hash(readFileSync(contentPath));
  const audit = {
    report_type: 'card-quality-audit',
    corpus_fingerprint: {algorithm: 'sha256', digest: corpusDigest},
    result: 'pass',
  };
  const auditPath = writeJson(
    directory,
    'evidence/card-quality-audit.json',
    audit,
  );
  const auditHash = hash(readFileSync(auditPath));
  const approval = {
    approval_id: `20260729-${track}-full-track-final`,
    approval_mode: 'full_track_final',
    approved_by_user: true,
    approved_at: '2026-07-29T12:00:00+08:00',
    scope: {
      track,
      box_prefixes: entries.map(([ref]) => ref),
      card_ids: cards.map(card => card.card_id),
    },
    summary: 'Unit-test approval record; not formal content.',
    representative_cards: [cards[0].card_id],
    card_quality_audit: {
      report: 'evidence/card-quality-audit.json',
      report_sha256: auditHash,
      corpus_fingerprint: corpusDigest,
      scope_has_no_hard_blockers: true,
      scope_summary: {
        card_ids: cards.map(card => card.card_id),
        card_count: cards.length,
        issue_count: 0,
        by_severity: {
          hard_blocker: 0,
          content_risk: 0,
          review_gap: 0,
          source_risk: 0,
        },
      },
    },
    validation: {},
    approval_limits: [],
  };
  const approvalPath = writeJson(
    directory,
    'evidence/final-approval.json',
    approval,
  );
  const approvalHash = hash(readFileSync(approvalPath));
  const qaChecks = Object.fromEntries(
    [
      'audio_matches_text',
      'target_signal_audible',
      'accurate_pronunciation',
      'suitable_speed',
      'natural_rhythm',
      'stress_and_pauses_do_not_mislead',
      'no_unwanted_noise_or_clipping',
      'no_autoplay_assumption',
      'front_side_no_required_subtitles',
      'tts_audio_not_used_as_source_authenticity',
    ].map(key => [key, true]),
  );
  const qcRecord = {
    qa_checks: qaChecks,
    per_card_qc: cards.slice(0, policy.audioCount).map(card => ({
      card_id: card.card_id,
      audio_matches_text: true,
      target_signal_audible: true,
      notes: 'Contract fixture',
    })),
    verdict: {formal_audio_ready: true},
  };
  const qcRecordPath = writeJson(
    directory,
    'evidence/audio-qc-record.json',
    qcRecord,
  );
  const qcRecordHash = hash(readFileSync(qcRecordPath));
  const audioManifest = {
    schema_version: 'release-audio-manifest.v1',
    track,
    assets: assets.map(asset => ({
      asset_id: asset.asset_id,
      asset_path: asset.asset_path,
      sha256: asset.sha256,
      size_bytes: asset.size_bytes,
      duration_ms: asset.duration_ms,
    })),
  };
  const audioManifestPath = writeJson(
    directory,
    'evidence/audio-manifest.json',
    audioManifest,
  );
  const audioManifestHash = hash(readFileSync(audioManifestPath));
  const qcIndex = {
    schema_version: 'audio-qc-index.v1',
    track,
    corpus_fingerprint: `sha256:${corpusDigest}`,
    assets: assets.map((asset, index) => ({
      asset_id: asset.asset_id,
      card_ids: [cards[index].card_id],
      record_path: 'evidence/audio-qc-record.json',
      record_sha256: qcRecordHash,
      reviewed_by: 'fixture-reviewer',
      reviewed_at: '2026-07-29T11:00:00+08:00',
      formal_audio_ready: true,
    })),
  };
  const qcIndexPath = writeJson(
    directory,
    'evidence/audio-qc-index.json',
    qcIndex,
  );
  const qcIndexHash = hash(readFileSync(qcIndexPath));
  const profilePath = writeJson(
    directory,
    'delivery-profile.json',
    profileFixture(track === 'cet4' ? 'closed_beta' : 'production'),
  );
  const bundle = {
    schema_version: 'release-bundle.v1',
    bundle_id: `${track}-formal-bundle-20260729`,
    release_id: `${track}-formal-20260729`,
    track,
    created_at: '2026-07-29T11:30:00+08:00',
    release_at: '2026-07-29T12:30:00+08:00',
    parent_release_id: null,
    content: {
      payload_path: `content/${track}.json`,
      payload_sha256: contentHash,
      content_version: content.content_version,
      corpus_fingerprint: `sha256:${corpusDigest}`,
      card_count: policy.cardCount,
    },
    approval: {
      record_path: 'evidence/final-approval.json',
      record_sha256: approvalHash,
      approval_id: approval.approval_id,
    },
    audit: {
      report_path: 'evidence/card-quality-audit.json',
      report_sha256: auditHash,
      unresolved_blocker_count: 0,
      unexplained_risk_count: 0,
      quality_metadata_coverage_percent: 100,
    },
    audio: {
      manifest_path: 'evidence/audio-manifest.json',
      manifest_sha256: audioManifestHash,
      qc_index_path: 'evidence/audio-qc-index.json',
      qc_index_sha256: qcIndexHash,
      asset_count: policy.audioCount,
      qc_passed_count: policy.audioCount,
    },
    minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
  };
  const bundlePath = writeJson(directory, 'release-bundle.json', bundle);
  return {
    directory,
    profilePath,
    bundlePath,
    content,
    audioManifest,
  };
}

function profileFixture(runtimeMode = 'closed_beta') {
  const production = runtimeMode === 'production';
  return {
    schema_version: 'delivery-profile.v1',
    profile_id: production ? 'receiver-formal-product' : 'receiver-closed-beta',
    environment_id: production
      ? 'receiver-formal-product'
      : 'receiver-cet4-beta',
    region: 'ap-shanghai',
    api_base_url: 'https://receiver.example.com/softbook-api',
    runtime_mode: runtimeMode,
    enabled_tracks: production ? ['cet4', 'cet6'] : ['cet4'],
    minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
    signing_key_id: 'receiver-signing-key-v1',
  };
}

function writeJson(root, relativePath, value) {
  return writeFixture(
    root,
    relativePath,
    `${JSON.stringify(value, null, 2)}\n`,
  );
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
