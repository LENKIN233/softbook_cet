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
let modelContract;
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
  modelContract = await import(
    pathToFileURL(resolve(__dirname, '../../../../../scripts/lib/model_acceptance_contract.mjs'))
  );
});

after(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, {force: true, recursive: true});
  }
});

test('delivery profile allows zero-data in-place receiver promotion and contains no secret material', () => {
  const valid = delivery.validateDeliveryProfile(profileFixture());
  assert.equal(valid.runtime_mode, 'closed_beta');
  assert.deepEqual(valid.enabled_tracks, ['cet4']);

  const production = delivery.validateDeliveryProfile(
    profileFixture('production'),
  );
  assert.equal(production.runtime_mode, 'production');
  assert.deepEqual(production.enabled_tracks, ['cet4', 'cet6']);

  const promoted = delivery.validateDeliveryProfile({
    ...profileFixture(),
    environment_id: 'test-d2gzcyxr9f7e80972',
  });
  assert.equal(
    promoted.environment_id,
    'test-d2gzcyxr9f7e80972',
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

test('delivery profile requires strict semantic client versions', () => {
  const valid = delivery.validateDeliveryProfile({
    ...profileFixture(),
    minimum_client_versions: {
      ios: '1.0.0-beta.2+receiver.7',
      android: '1.0.0',
    },
  });
  assert.equal(valid.minimum_client_versions.ios, '1.0.0-beta.2+receiver.7');

  for (const version of [
    '1.0',
    '01.0.0',
    '1.0.0-01',
    '1.0.0-alpha..1',
    '1.0.0+',
  ]) {
    assert.throws(
      () =>
        delivery.validateDeliveryProfile({
          ...profileFixture(),
          minimum_client_versions: {ios: version, android: '1.0.0'},
        }),
      /minimum_client_versions\.ios/,
    );
  }
});

test('delivery semantic-version precedence follows the official prerelease order', () => {
  const ordered = [
    '1.0.0-alpha',
    '1.0.0-alpha.1',
    '1.0.0-alpha.beta',
    '1.0.0-beta',
    '1.0.0-beta.2',
    '1.0.0-beta.11',
    '1.0.0-rc.1',
    '1.0.0',
  ];

  ordered.slice(0, -1).forEach((version, index) => {
    assert.equal(
      delivery.compareSemanticVersions(version, ordered[index + 1]),
      -1,
    );
    assert.equal(
      delivery.compareSemanticVersions(ordered[index + 1], version),
      1,
    );
  });
  assert.equal(
    delivery.compareSemanticVersions('1.0.0+build.1', '1.0.0+build.2'),
    0,
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
  assert.equal(
    verified.bundle_sha256,
    hash(readFileSync(fixture.bundlePath)).slice('sha256:'.length),
  );
  assert.equal(verified.audio_manifest.assets.length, 301);
  assert.equal(verified.audio_qc_index.assets.length, 301);
});

test('release bundle binds QC card ownership even when two assets share bytes', () => {
  const fixture = createValidBundleFixture('cet4', {
    duplicateFirstTwoAssetBytes: true,
  });
  const bundle = JSON.parse(readFileSync(fixture.bundlePath, 'utf8'));
  const qcIndexPath = join(fixture.directory, bundle.audio.qc_index_path);
  const qcIndex = JSON.parse(readFileSync(qcIndexPath, 'utf8'));
  [qcIndex.assets[0].card_ids, qcIndex.assets[1].card_ids] = [
    qcIndex.assets[1].card_ids,
    qcIndex.assets[0].card_ids,
  ];
  writeFileSync(qcIndexPath, `${JSON.stringify(qcIndex, null, 2)}\n`);
  bundle.audio.qc_index_sha256 = hash(readFileSync(qcIndexPath));
  writeFileSync(fixture.bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
  assert.throws(
    () => delivery.verifyReleaseBundleDirectory({
      bundlePath: fixture.bundlePath,
      profilePath: fixture.profilePath,
    }),
    /content card ownership/,
  );
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

test('legacy user approval cannot authorize a formal release bundle', () => {
  const fixture = createValidBundleFixture();
  const bundle = JSON.parse(readFileSync(fixture.bundlePath, 'utf8'));
  const approvalPath = join(fixture.directory, bundle.approval.record_path);
  const current = JSON.parse(readFileSync(approvalPath, 'utf8'));
  const legacy = {
    approval_id: current.authorization_id,
    approval_mode: 'full_track_final',
    approved_by_user: true,
    approved_at: current.authorized_at,
    scope: current.scope,
    summary: current.summary,
    representative_cards: current.representative_cards,
    card_quality_audit: current.card_quality_audit,
    validation: current.validation,
    approval_limits: [],
  };
  writeFileSync(approvalPath, `${JSON.stringify(legacy, null, 2)}\n`);
  bundle.approval.record_sha256 = hash(readFileSync(approvalPath));
  writeFileSync(fixture.bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
  assert.throws(
    () => delivery.verifyReleaseBundleDirectory({
      bundlePath: fixture.bundlePath,
      profilePath: fixture.profilePath,
    }),
    /model content authorization/,
  );
});

test('formal content authorization cannot reuse a corpus-only acceptance', () => {
  const fixture = createValidBundleFixture();
  const bundle = JSON.parse(readFileSync(fixture.bundlePath, 'utf8'));
  const approvalPath = join(fixture.directory, bundle.approval.record_path);
  const approval = JSON.parse(readFileSync(approvalPath, 'utf8'));
  for (const acceptance of approval.model_acceptances) {
    acceptance.evidence.input_sha256 = bundle.content.corpus_fingerprint;
  }
  writeFileSync(approvalPath, `${JSON.stringify(approval, null, 2)}\n`);
  bundle.approval.record_sha256 = hash(readFileSync(approvalPath));
  writeFileSync(fixture.bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
  assert.throws(
    () => delivery.verifyReleaseBundleDirectory({
      bundlePath: fixture.bundlePath,
      profilePath: fixture.profilePath,
    }),
    /exact expected input/,
  );
});

test('formal model review acceptance cannot reuse another input', () => {
  const fixture = createValidBundleFixture();
  const bundle = JSON.parse(readFileSync(fixture.bundlePath, 'utf8'));
  const reviewPath = join(fixture.directory, bundle.approval.model_review_path);
  const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
  review.model_acceptances[0].evidence.input_sha256 = `sha256:${'9'.repeat(64)}`;
  writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`);
  const reviewHash = hash(readFileSync(reviewPath));
  bundle.approval.model_review_sha256 = reviewHash;

  const approvalPath = join(fixture.directory, bundle.approval.record_path);
  const approval = JSON.parse(readFileSync(approvalPath, 'utf8'));
  approval.validation.model_review_sha256 = reviewHash;
  const authorizationInput = modelContract.buildModelAcceptanceInputSha256({
    decisionType: 'full_track_content_authorization',
    scope: approval.scope,
    corpusFingerprint: bundle.content.corpus_fingerprint,
    auditSha256: bundle.audit.report_sha256,
    linkedReviewIdentity: {
      path: approval.validation.model_review,
      sha256: reviewHash,
    },
    additionalBindings: {
      content_version: bundle.content.content_version,
      runtime_payload_sha256: approval.validation.runtime_payload_sha256,
    },
  });
  for (const acceptance of approval.model_acceptances) {
    acceptance.evidence.input_sha256 = authorizationInput;
  }
  writeFileSync(approvalPath, `${JSON.stringify(approval, null, 2)}\n`);
  bundle.approval.record_sha256 = hash(readFileSync(approvalPath));
  writeFileSync(fixture.bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
  assert.throws(
    () => delivery.verifyReleaseBundleDirectory({
      bundlePath: fixture.bundlePath,
      profilePath: fixture.profilePath,
    }),
    /formal full-track model review.*exact expected input/,
  );
});

test('model audio QC cannot reuse acceptance from another input', () => {
  const fixture = createValidBundleFixture();
  const bundle = JSON.parse(readFileSync(fixture.bundlePath, 'utf8'));
  const indexPath = join(fixture.directory, bundle.audio.qc_index_path);
  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  const recordPath = join(fixture.directory, index.assets[0].record_path);
  const record = JSON.parse(readFileSync(recordPath, 'utf8'));
  record.model_acceptances[0].evidence.input_sha256 = `sha256:${'b'.repeat(64)}`;
  writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
  const recordHash = hash(readFileSync(recordPath));
  for (const asset of index.assets) asset.record_sha256 = recordHash;
  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  bundle.audio.qc_index_sha256 = hash(readFileSync(indexPath));
  writeFileSync(fixture.bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
  assert.throws(
    () => delivery.verifyReleaseBundleDirectory({
      bundlePath: fixture.bundlePath,
      profilePath: fixture.profilePath,
    }),
    /exact expected input/,
  );
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

test('release bundle requires the exact retained runtime payload authorized by the model', () => {
  const fixture = createValidBundleFixture();
  const bundle = JSON.parse(readFileSync(fixture.bundlePath, 'utf8'));
  const approval = JSON.parse(readFileSync(
    join(fixture.directory, bundle.approval.record_path),
    'utf8',
  ));
  const runtimePath = join(fixture.directory, approval.validation.runtime_payload);
  writeFileSync(runtimePath, Buffer.concat([
    readFileSync(runtimePath),
    Buffer.from(' '),
  ]));
  assert.throws(
    () => delivery.verifyReleaseBundleDirectory({
      bundlePath: fixture.bundlePath,
      profilePath: fixture.profilePath,
    }),
    /authorized runtime payload SHA-256 mismatch/,
  );

  delete approval.validation.runtime_payload;
  delete approval.validation.runtime_payload_sha256;
  const approvalPath = join(fixture.directory, bundle.approval.record_path);
  writeFileSync(approvalPath, `${JSON.stringify(approval, null, 2)}\n`);
  bundle.approval.record_sha256 = hash(readFileSync(approvalPath));
  writeFileSync(fixture.bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
  assert.throws(
    () => delivery.verifyReleaseBundleDirectory({
      bundlePath: fixture.bundlePath,
      profilePath: fixture.profilePath,
    }),
    /authorization runtime payload path/,
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

test('publisher resumes an exact verified stage without repeating asset work', async () => {
  const fixture = createValidBundleFixture();
  const verified = delivery.verifyReleaseBundleDirectory({
    bundlePath: fixture.bundlePath,
    profilePath: fixture.profilePath,
  });
  let staged = null;
  await delivery.publishVerifiedRelease(verified, {
    uploadAsset: async ({asset}) =>
      `cloud://receiver-bucket/${asset.asset_id}.mp3`,
    stageContent: async ({cardSource}) => {
      staged = cardSource;
    },
    verifyStaged: async () => {},
    activateRelease: async () => {},
  });
  const calls = [];
  const resumed = await delivery.publishVerifiedRelease(verified, {
    readVerifiedStaged: async () => staged,
    uploadAsset: async () => {
      throw new Error('asset work must not repeat');
    },
    stageContent: async () => {
      throw new Error('stage work must not repeat');
    },
    verifyStaged: async () => {
      throw new Error('stage verification must not repeat');
    },
    activateRelease: async ({cardSource}) => {
      calls.push('activate');
      assert.equal(cardSource, staged);
    },
  });

  assert.equal(resumed.uploaded_asset_count, 0);
  assert.deepEqual(calls, ['activate']);
});

test('publisher selects the higher platform minimum using semantic-version precedence', async () => {
  const fixture = createValidBundleFixture();
  const minimumClientVersions = {
    ios: '1.0.0-beta.11',
    android: '1.0.0-beta.2',
  };
  const profile = JSON.parse(readFileSync(fixture.profilePath, 'utf8'));
  profile.minimum_client_versions = minimumClientVersions;
  writeFileSync(fixture.profilePath, `${JSON.stringify(profile, null, 2)}\n`);
  const bundle = JSON.parse(readFileSync(fixture.bundlePath, 'utf8'));
  bundle.minimum_client_versions = minimumClientVersions;
  writeFileSync(fixture.bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);

  const verified = delivery.verifyReleaseBundleDirectory({
    bundlePath: fixture.bundlePath,
    profilePath: fixture.profilePath,
  });
  let stagedMinimum = null;
  await delivery.publishVerifiedRelease(verified, {
    uploadAsset: async ({asset}) =>
      `cloud://receiver-bucket/${asset.asset_id}.mp3`,
    stageContent: async ({cardSource}) => {
      stagedMinimum = cardSource.release.minimum_client_version;
    },
    verifyStaged: async () => {},
    activateRelease: async () => {},
  });

  assert.equal(stagedMinimum, '1.0.0-beta.11');
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

function createValidBundleFixture(
  track = 'cet4',
  {duplicateFirstTwoAssetBytes = false} = {},
) {
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
      const bytes = Buffer.from(
        `contract-audio-${duplicateFirstTwoAssetBytes && index === 1 ? 0 : index}`,
      );
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
  const authorizedRuntimePayloadPath = `reviews/runtime_payloads/${track}-formal.json`;
  writeFixture(
    directory,
    authorizedRuntimePayloadPath,
    readFileSync(contentPath),
  );
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
  const authorizationId = `20260729-${track}-full-track-final`;
  const authorizationScope = {
    track,
    purpose: 'formal_content',
    box_prefixes: entries.map(([ref]) => ref),
    card_ids: cards.map(card => card.card_id),
  };
  const modelReview = {
    schema_version: 'model-owned-full-track-review.v2',
    review_id: `20260729-${track}-full-model-review`,
    created_at: '2026-07-29T10:30:00+08:00',
    model_acceptances: [],
    scope: {
      track,
      box_prefixes: [...authorizationScope.box_prefixes],
      card_ids: [...authorizationScope.card_ids],
    },
    specs_read: ['spec/review-workflow.json', 'spec/content-quality-contract.json'],
    coverage: {
      expected_card_count: cards.length,
      reviewed_card_ids: [...authorizationScope.card_ids],
      analysis_reference_check: {
        answer_matches_card: true,
        choice_or_bank_references_match_source: true,
        distractor_labels_match_explanations: true,
      },
      boxes: entries.map(([ref]) => ({box_prefix: ref, status: 'passed'})),
    },
    quality_audit: {
      report: 'evidence/card-quality-audit.json',
      report_sha256: auditHash,
      corpus_fingerprint: corpusDigest,
      scope_has_no_hard_blockers: true,
      scope_summary: {
        card_ids: [...authorizationScope.card_ids],
        card_count: cards.length,
        issue_count: 0,
        by_severity: {hard_blocker: 0, content_risk: 0, review_gap: 0, source_risk: 0},
        by_rule: {},
      },
    },
    representative_cards: [cards[0].card_id],
    removed_cards: [],
    batch_review: {
      status: 'ready_for_model_authorization',
      summary: 'Exact full-track fixture model review.',
      remaining_risks: [],
      next_step: 'Create exact-scope model-owned content authorization.',
    },
  };
  const modelReviewInput = modelContract.buildModelAcceptanceInputSha256({
    decisionType: 'full_track_review',
    scope: modelReview.scope,
    corpusFingerprint: `sha256:${corpusDigest}`,
    auditSha256: auditHash,
  });
  modelReview.model_acceptances = [
    modelAcceptance(
      'full-track-review-first',
      modelReviewInput,
      ['card_semantic_review', 'source_provenance_review'],
    ),
    modelAcceptance(
      'full-track-review-second',
      modelReviewInput,
      ['card_semantic_review', 'source_provenance_review'],
    ),
  ];
  const modelReviewPath = writeJson(
    directory,
    'evidence/model-review.json',
    modelReview,
  );
  const modelReviewHash = hash(readFileSync(modelReviewPath));
  const linkedModelReviewPath = `reviews/agent_self_review/${track}-full-model-review.json`;
  const authorizationInput = modelContract.buildModelAcceptanceInputSha256({
    decisionType: 'full_track_content_authorization',
    scope: authorizationScope,
    corpusFingerprint: `sha256:${corpusDigest}`,
    auditSha256: auditHash,
    linkedReviewIdentity: {
      path: linkedModelReviewPath,
      sha256: modelReviewHash,
    },
    additionalBindings: {
      content_version: content.content_version,
      runtime_payload_sha256: contentHash,
    },
  });
  const approval = {
    schema_version: 'model-owned-content-authorization.v2',
    authorization_id: authorizationId,
    authorization_mode: 'full_track',
    content_version: content.content_version,
    authorized_at: '2026-07-29T12:00:00+08:00',
    model_acceptances: [
      modelAcceptance('content-review-first', authorizationInput, 'content_authorization'),
      modelAcceptance('content-review-second', authorizationInput, 'content_authorization'),
    ],
    scope: authorizationScope,
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
    validation: {
      model_review: linkedModelReviewPath,
      model_review_sha256: modelReviewHash,
      runtime_payload: authorizedRuntimePayloadPath,
      runtime_payload_sha256: contentHash,
    },
    authorization_limits: [],
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
  const audioCards = cards.slice(0, policy.audioCount);
  const transcripts = audioCards.map(card => ({
    card_id: card.card_id,
    transcript: card.audio.transcript,
    target_signal: 'Contract target signal',
    pronunciation_notes: 'Contract pronunciation notes',
    text_review_result: 'passed',
  }));
  const generatedAssets = audioCards.map((card, index) => ({
    card_id: card.card_id,
    path: assets[index].asset_path,
    file_sha256: assets[index].sha256.slice('sha256:'.length),
    transcript_sha256: createHash('sha256').update(card.audio.transcript).digest('hex'),
  }));
  const perCardQc = audioCards.map((card, index) => ({
    card_id: card.card_id,
    asset_path: assets[index].asset_path,
    complete_asset_consumed: true,
    matches_text: true,
    target_signal: true,
    pronunciation: true,
    speed: true,
    rhythm: true,
    stress_pauses: true,
    no_noise: true,
    notes: 'Contract fixture',
  }));
  const perCardById = new Map(perCardQc.map(item => [item.card_id, item]));
  const trustedMedia = {
    receipt_path: 'reviews/trusted_media_receipts/fixture-receipt.json',
    receipt_sha256: 'a'.repeat(64),
    attestation_bundle_path:
      'reviews/trusted_media_receipts/fixture-attestation.json',
    attestation_bundle_sha256: 'b'.repeat(64),
    source_commit: 'c'.repeat(40),
    model_id: 'Qwen/Qwen2-Audio-7B-Instruct',
    model_revision: 'd'.repeat(40),
  };
  const audioIdentities = generatedAssets.map(asset => ({
    card_id: asset.card_id,
    path: asset.path,
    file_sha256: asset.file_sha256,
    transcript_sha256: asset.transcript_sha256,
    per_card_qc: {
      complete_asset_consumed: perCardById.get(asset.card_id).complete_asset_consumed,
      matches_text: perCardById.get(asset.card_id).matches_text,
      target_signal: perCardById.get(asset.card_id).target_signal,
      pronunciation: perCardById.get(asset.card_id).pronunciation,
      speed: perCardById.get(asset.card_id).speed,
      rhythm: perCardById.get(asset.card_id).rhythm,
      stress_pauses: perCardById.get(asset.card_id).stress_pauses,
      no_noise: perCardById.get(asset.card_id).no_noise,
    },
  })).sort((left, right) =>
    left.card_id.localeCompare(right.card_id) || left.path.localeCompare(right.path));
  const audioInput = hash(Buffer.from(JSON.stringify({
    assets: audioIdentities,
    trusted_media: trustedMedia,
  })));
  const qcRecord = {
    schema_version: 'model-owned-audio-qc.v2',
    scope: {card_ids: audioCards.map(card => card.card_id)},
    model_acceptances: [
      modelAcceptance(
        'audio-review-first',
        audioInput,
        'audio_perceptual_review',
        'agent:audio-review-1',
      ),
      modelAcceptance('audio-review-second', audioInput, 'audio_perceptual_review'),
    ],
    text_gate: {transcripts},
    source_records: {
      trusted_media_receipt: trustedMedia.receipt_path,
      trusted_media_receipt_sha256: trustedMedia.receipt_sha256,
      trusted_media_attestation_bundle: trustedMedia.attestation_bundle_path,
      trusted_media_attestation_bundle_sha256:
        trustedMedia.attestation_bundle_sha256,
      trusted_media_source_commit: trustedMedia.source_commit,
      trusted_media_model_id: trustedMedia.model_id,
      trusted_media_model_revision: trustedMedia.model_revision,
    },
    generated_assets: generatedAssets,
    qa_checks: qaChecks,
    per_card_qc: perCardQc,
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
      reviewed_by: 'agent:audio-review-1',
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
      approval_id: approval.authorization_id,
      model_review_path: 'evidence/model-review.json',
      model_review_sha256: modelReviewHash,
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

function modelAcceptance(runId, inputSha256, capability, agent = 'agent:fixture-model') {
  return {
    schema_version: 'model-acceptance.v2',
    actor: {
      kind: 'model_harness',
      agent,
      model: 'gpt-5.6-sol',
      run_id: runId,
    },
    evidence: {
      reviewed_at: '2026-07-29T11:00:00+08:00',
      input_sha256: inputSha256,
      capabilities: Array.isArray(capability) ? capability : [capability],
      summary: 'Reviewed exact contract fixture identity.',
      findings: [],
    },
    decision: 'accepted',
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
