const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const {tmpdir} = require('node:os');
const {join, relative, resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {after, before, test} = require('node:test');

const {
  createSoftbookApi,
  validateCardSourceForReleaseBundle,
} = require('../index');

let catalog;
let publisher;
let bundleBuilder;
let modelContract;
const temporaryDirectories = [];

before(async () => {
  catalog = await import(
    pathToFileURL(resolve(__dirname, '../../../card-source-catalog.mjs'))
  );
  publisher = await import(
    pathToFileURL(
      resolve(__dirname, '../../../controlled-pilot-publisher-v1.mjs'),
    )
  );
  bundleBuilder = await import(
    pathToFileURL(resolve(__dirname, '../../../../../scripts/build_controlled_pilot_bundle.mjs'))
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

test('pilot publisher verifies bound files and activates only after upload, stage, and reread', async () => {
  const fixture = await createFixture();
  const verified = publisher.verifyControlledPilotBundleDirectory({
    bundlePath: fixture.bundlePath,
    profilePath: fixture.profilePath,
  });
  const calls = [];
  let active = null;
  const adapter = {
    uploadAsset: async ({asset}) => {
      calls.push(`upload:${asset.asset_id}`);
      return `cloud://receiver-pilot/audio/${asset.asset_id}.mp3`;
    },
    stageContent: async ({cardSource}) => {
      calls.push('stage');
      assert.equal(cardSource.release.gate_eligible, false);
      assert.equal(cardSource.card_records.length, 120);
    },
    verifyStaged: async () => calls.push('verify-staged'),
    activateRelease: async ({cardSource}) => {
      calls.push('activate');
      active = structuredClone(cardSource);
    },
    verifyActiveRelease: async () => {
      calls.push('verify-active');
      return active;
    },
  };
  const report = await publisher.publishVerifiedControlledPilot(
    verified,
    adapter,
    {now: () => new Date('2026-08-10T00:00:00.000Z')},
  );

  assert.equal(report.activated, true);
  assert.equal(report.uploaded_asset_count, 24);
  assert.equal(report.gate_eligible, false);
  assert.deepEqual(calls.slice(-4), [
    'stage',
    'verify-staged',
    'activate',
    'verify-active',
  ]);
  assert.equal(
    calls.slice(0, -4).every(call => call.startsWith('upload:')),
    true,
  );
});

test('pilot verification fails closed when one approved audio byte changes', async () => {
  const fixture = await createFixture();
  writeFileSync(fixture.firstAudioPath, 'tampered-audio');

  assert.throws(
    () =>
      publisher.verifyControlledPilotBundleDirectory({
        bundlePath: fixture.bundlePath,
        profilePath: fixture.profilePath,
      }),
    /audio asset .* SHA-256 does not match/,
  );
});

test('pilot verification binds the detailed 120-card source-risk audit', async () => {
  const tampered = await createFixture();
  writeFileSync(tampered.auditPath, '{}');
  assert.throws(
    () =>
      publisher.verifyControlledPilotBundleDirectory({
        bundlePath: tampered.bundlePath,
        profilePath: tampered.profilePath,
      }),
    /audit report SHA-256 does not match/,
  );

  const missingCard = await createFixture();
  rewriteBoundAudit(missingCard, audit => {
    const cardId = audit.scope.card_ids.pop();
    audit.scope_summary.card_ids.pop();
    audit.scope_summary.card_count = 119;
    audit.scope_summary.issue_count = 119;
    audit.scope_summary.by_severity.source_risk = 119;
    audit.scope_summary.by_rule.synthetic_source = 119;
    delete audit.scoped_card_issue_index[cardId];
  });
  assert.throws(
    () =>
      publisher.verifyControlledPilotBundleDirectory({
        bundlePath: missingCard.bundlePath,
        profilePath: missingCard.profilePath,
      }),
    /model authorization or review artifact is invalid or unbound/,
  );

  const unknownRisk = await createFixture();
  rewriteBoundAudit(unknownRisk, audit => {
    audit.scope_summary.by_rule.unverified_source = 1;
  });
  assert.throws(
    () =>
      publisher.verifyControlledPilotBundleDirectory({
        bundlePath: unknownRisk.bundlePath,
        profilePath: unknownRisk.profilePath,
      }),
    /model authorization or review artifact is invalid or unbound/,
  );

  const wrongScopeDigest = await createFixture();
  rewriteBundle(wrongScopeDigest.bundlePath, bundle => {
    bundle.audit.scope_card_ids_sha256 = digestText('wrong-card-scope');
  });
  assert.throws(
    () =>
      publisher.verifyControlledPilotBundleDirectory({
        bundlePath: wrongScopeDigest.bundlePath,
        profilePath: wrongScopeDigest.profilePath,
      }),
    /audit artifact is invalid or unbound/,
  );
});

test('pilot publication never activates before release time or after expiry', async () => {
  const fixture = await createFixture();
  const verified = publisher.verifyControlledPilotBundleDirectory({
    bundlePath: fixture.bundlePath,
    profilePath: fixture.profilePath,
  });
  const adapter = new Proxy(
    {},
    {get: () => async () => assert.fail('adapter must not be called')},
  );

  await assert.rejects(
    () =>
      publisher.publishVerifiedControlledPilot(verified, adapter, {
        now: () => new Date('2026-08-09T23:59:59.000Z'),
      }),
    /outside its approved window/,
  );
  await assert.rejects(
    () =>
      publisher.publishVerifiedControlledPilot(verified, adapter, {
        now: () => new Date('2026-09-10T00:00:00.000Z'),
      }),
    /outside its approved window/,
  );
});

test('pilot publication rejects a mismatched active reread after activation', async () => {
  const fixture = await createFixture();
  const verified = publisher.verifyControlledPilotBundleDirectory({
    bundlePath: fixture.bundlePath,
    profilePath: fixture.profilePath,
  });
  let staged;
  const adapter = {
    uploadAsset: async ({asset}) =>
      `cloud://receiver-pilot/audio/${asset.asset_id}.mp3`,
    stageContent: async ({cardSource}) => {
      staged = structuredClone(cardSource);
    },
    verifyStaged: async () => {},
    activateRelease: async () => {},
    verifyActiveRelease: async () => ({
      ...staged,
      release: {...staged.release, pilot_id: 'different-pilot'},
    }),
  };

  await assert.rejects(
    () =>
      publisher.publishVerifiedControlledPilot(verified, adapter, {
        now: () => new Date('2026-08-10T00:00:00.000Z'),
      }),
    /could not be reverified/,
  );
});

test('pilot bundle builder normalizes offset evidence time and rejects incomplete dates', () => {
  assert.equal(
    bundleBuilder.normalizeEvidenceTimestamp(
      '2026-08-09T08:00:00+08:00',
      'reviewed_at',
    ),
    '2026-08-09T00:00:00.000Z',
  );
  assert.throws(
    () => bundleBuilder.normalizeEvidenceTimestamp('2026-08-09', 'reviewed_at'),
    /complete ISO-8601 timestamp with a timezone/,
  );
});

test('pilot bundle builder accepts identified model-harness perceptual QC', () => {
  const directory = mkdtempSync(join(tmpdir(), 'controlled-pilot-builder-qc-'));
  temporaryDirectories.push(directory);
  const hash = digestText('approved-audio').slice('sha256:'.length);
  const asset = {
    asset_id: 'cet4-000001-audio',
    asset_path: 'audio/cet4-000001-audio.mp3',
    sha256: `sha256:${hash}`,
  };
  const record = modelAudioQcFixture({
    assetPath: 'ai_tts/cet4/0000/000001.mp3',
    cardIds: ['000001'],
    fileHash: hash,
    runPrefix: 'direct-audio',
  });
  writeJson(join(directory, 'qc.json'), record);
  const input = {
    assets: [asset],
    cards: [{card_id: '000001', audio: {asset_id: 'cet4-000001-audio'}}],
    qcDirectory: directory,
  };
  const result = bundleBuilder.collectAudioQcBindings(input);
  assert.equal(result.bindings[0].reviewed_by, 'agent:direct-audio-a');
  assert.equal(
    result.sourcePathsByAssetId.get(asset.asset_id),
    'ai_tts/cet4/0000/000001.mp3',
  );

  record.model_acceptances[1] = structuredClone(record.model_acceptances[0]);
  writeJson(join(directory, 'qc.json'), record);
  assert.throws(
    () => bundleBuilder.collectAudioQcBindings(input),
    /run IDs must be distinct/,
  );

  record.model_acceptances[1] = modelAcceptanceFixture(
    'direct-audio-b',
    record.model_acceptances[0].evidence.input_sha256,
    'audio_perceptual_review',
  );
  record.per_card_qc[0].complete_asset_consumed = false;
  writeJson(join(directory, 'qc.json'), record);
  assert.throws(
    () => bundleBuilder.collectAudioQcBindings(input),
    /complete_asset_consumed/,
  );
});

async function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'controlled-pilot-publisher-'));
  temporaryDirectories.push(directory);
  for (const child of ['approval', 'audio/qc', 'content', 'audit']) {
    mkdirSync(join(directory, child), {recursive: true});
  }
  const development = await developmentCardSource();
  const entries = [...catalog.catalogEntriesByRef(catalog.loadBoxCatalog(), 'cet4')];
  const refsByLibrary = new Map();
  for (const [ref, metadata] of entries) {
    const list = refsByLibrary.get(metadata.library) ?? [];
    list.push({ref, metadata});
    refsByLibrary.set(metadata.library, list);
  }
  const libraries = [
    ['listening', '听力', 24, 16, 2],
    ['careful_reading', '仔细阅读', 24, 12, 2],
    ['cloze', '选词填空', 16, 8, 2],
    ['writing', '写作', 16, 8, 2],
    ['translation', '翻译', 16, 6, 2],
    ['vocabulary', '词汇', 12, 5, 2],
    ['grammar', '语法', 12, 5, 2],
  ];
  const librarySequence = [
    ...libraries.flatMap(([, name, , free]) => Array(free).fill(name)),
    ...libraries.flatMap(([, name, total, free]) =>
      Array(total - free).fill(name),
    ),
  ];
  const interactionSequence = [
    ...Array(40).fill('flip'),
    ...Array(30).fill('multiple_choice'),
    ...Array(20).fill('lock'),
    ...Array(15).fill('elimination'),
    ...Array(15).fill('swipe'),
  ];
  const templates = new Map(
    development.card_records.map(card => [card.interaction_id, card]),
  );
  const usedByLibrary = new Map();
  const usedByRef = new Map();
  const assets = [];
  let firstAudioPath = null;
  const cards = librarySequence.map((libraryName, index) => {
    const library = libraries.find(([, name]) => name === libraryName);
    const refs = refsByLibrary.get(libraryName).slice(0, library[4]);
    const libraryIndex = usedByLibrary.get(libraryName) ?? 0;
    usedByLibrary.set(libraryName, libraryIndex + 1);
    const selected = refs[libraryIndex % refs.length];
    const suffix = (usedByRef.get(selected.ref) ?? 0) + 1;
    usedByRef.set(selected.ref, suffix);
    const interactionId = interactionSequence[index];
    const card = structuredClone(templates.get(interactionId));
    delete card.audio;
    card.card_id = `${selected.ref}${String(suffix).padStart(2, '0')}`;
    card.knowledge_ref = selected.ref;
    card.space_metadata = {
      library: selected.metadata.library,
      group: selected.metadata.group,
      box: selected.metadata.box,
      box_ref: selected.ref,
    };
    if (libraryName === '听力') {
      const assetId = `pilot-audio-${String(assets.length + 1).padStart(3, '0')}`;
      const bytes = Buffer.from(`approved-audio-${assetId}`);
      const assetPath = `audio/${assetId}.mp3`;
      const absolutePath = join(directory, assetPath);
      writeFileSync(absolutePath, bytes);
      if (firstAudioPath === null) firstAudioPath = absolutePath;
      const sha256 = digestBytes(bytes);
      assets.push({
        asset_id: assetId,
        asset_path: assetPath,
        duration_ms: 1000 + assets.length,
        media_type: 'audio/mpeg',
        sha256,
        size_bytes: bytes.length,
      });
      card.audio = {
        asset_id: assetId,
        duration_ms: 1000 + assets.length - 1,
        sha256,
      };
    }
    return card;
  });
  const content = validateCardSourceForReleaseBundle(
    {
      assets,
      card_records: cards,
      source: {
        id: 'approved-controlled-pilot-payload',
        label: 'CET4 controlled pilot approved payload',
      },
      track: 'cet4',
    },
    'cet4',
  );
  const corpusFingerprint = digestText('controlled-pilot-corpus');
  const contentPath = join(directory, 'content/cet4-pilot.json');
  const contentHash = writeJson(contentPath, {
    ...content,
    corpus_fingerprint: corpusFingerprint,
  });
  const candidatePayloadPath = join(directory, 'candidate-payload.json');
  const candidatePayloadHash = writeJson(candidatePayloadPath, content);
  const auditPath = join(directory, 'audit/pilot-audit.json');
  const auditCorpusDigest = digestText('card-make-corpus').slice('sha256:'.length);
  const auditHash = writeJson(
    auditPath,
    detailedAuditFixture(content.card_records, auditCorpusDigest),
  );
  const cardIds = content.card_records.map(card => card.card_id);
  const boxPrefixes = [...new Set(content.card_records.map(card => card.knowledge_ref))];
  assert.equal(boxPrefixes.length, 14);
  const pilotReviewPath = join(directory, 'controlled-pilot-review.json');
  const pilotReview = {
    schema_version: 'controlled-pilot-review.v2',
    review_id: '20260809-cet4-controlled-pilot-120',
    created_at: '2026-08-09T08:00:00+08:00',
    pilot_id: 'cet4-pilot-2026',
    content_version: content.content_version,
    scope: {
      track: 'cet4',
      purpose: 'controlled_pilot',
      card_count: 120,
      box_prefixes: [...boxPrefixes].reverse(),
      card_ids: [...cardIds].reverse(),
    },
    source_records: {
      runtime_payload: 'exports/candidate-payload.json',
      runtime_payload_sha256: candidatePayloadHash,
      model_reviews: ['reviews/agent_self_review/pilot-model-review.json'],
      scoped_audit: 'reviews/audit_scopes/pilot-audit.json',
      scoped_audit_sha256: auditHash,
    },
    coverage: {
      reviewed_cards: 120,
      boxes: boxPrefixes.map(boxPrefix => ({
        box_prefix: boxPrefix,
        card_ids: cardIds.filter(cardId =>
          content.card_records.find(card => card.card_id === cardId).knowledge_ref === boxPrefix),
        status: 'passed',
      })),
    },
    quality: {
      corpus_fingerprint: `sha256:${auditCorpusDigest}`,
      hard_blockers: 0,
      content_risks: 0,
      review_gaps: 0,
      source_risks: 120,
      synthetic_source_cards: 120,
      source_disclosure: 'synthetic_training_content_not_true_exam',
    },
    authorization: {
      model_acceptance: null,
      authorized_at: null,
      artifact_path: null,
    },
    authorization_boundary: {
      audio_qc_required_separately: true,
      pilot_publication_required_separately: true,
      external_facts_must_not_be_inferred: true,
      gate_eligible: false,
    },
    status: 'ready_for_model_authorization',
  };
  const pilotReviewHash = writeJson(pilotReviewPath, pilotReview);
  const reviewIdentity = 'reviews/controlled_pilot_reviews/pilot-review.json';
  const authorizationInput = modelContract.buildModelAcceptanceInputSha256({
    decisionType: 'controlled_pilot_authorization',
    scope: pilotReview.scope,
    corpusFingerprint: `sha256:${auditCorpusDigest}`,
    auditSha256: auditHash,
    linkedReviewIdentity: {path: reviewIdentity, sha256: pilotReviewHash},
    additionalBindings: {
      pilot_id: pilotReview.pilot_id,
      content_version: content.content_version,
      runtime_payload_sha256: candidatePayloadHash,
    },
  });
  const approvalPath = join(directory, 'approval/pilot-authorization.json');
  const approval = {
    schema_version: 'controlled-pilot-authorization.v2',
    pilot_id: pilotReview.pilot_id,
    content_version: content.content_version,
    scope: 'controlled_pilot_120',
    status: 'authorized',
    authorized_at: '2026-08-09T08:30:00+08:00',
    model_acceptances: [
      modelAcceptanceFixture('pilot-authorization-a', authorizationInput, 'content_authorization'),
      modelAcceptanceFixture('pilot-authorization-b', authorizationInput, 'content_authorization'),
    ],
    review: reviewIdentity,
    review_sha256: pilotReviewHash,
    runtime_payload_sha256: candidatePayloadHash,
    scoped_audit_sha256: auditHash,
    card_ids: cardIds,
  };
  const approvalHash = writeJson(approvalPath, approval);
  const manifestHash = writeJson(join(directory, 'audio/manifest.json'), {
    schema_version: 'release-audio-manifest.v1',
    track: 'cet4',
    assets: assets.map(
      ({asset_id, asset_path, sha256, size_bytes, duration_ms}) => ({
        asset_id,
        asset_path,
        sha256,
        size_bytes,
        duration_ms,
      }),
    ),
  });
  const qcAssets = assets.map(asset => {
    const cardIds = content.card_records
      .filter(card => card.audio?.asset_id === asset.asset_id)
      .map(card => card.card_id);
    const recordPath = `audio/qc/${asset.asset_id}.json`;
    const record = modelAudioQcFixture({
      assetPath: asset.asset_path,
      cardIds,
      fileHash: asset.sha256.slice('sha256:'.length),
      runPrefix: asset.asset_id,
    });
    const recordHash = writeJson(join(directory, recordPath), record);
    return {
      asset_id: asset.asset_id,
      card_ids: cardIds,
      record_path: recordPath,
      record_sha256: recordHash,
      reviewed_by: record.model_acceptances[0].actor.agent,
      reviewed_at: '2026-08-09T00:00:00.000Z',
      formal_audio_ready: true,
    };
  });
  const qcHash = writeJson(join(directory, 'audio/qc-index.json'), {
    schema_version: 'audio-qc-index.v1',
    track: 'cet4',
    corpus_fingerprint: corpusFingerprint,
    assets: qcAssets,
  });
  const profilePath = join(directory, 'controlled-pilot-profile.json');
  writeJson(profilePath, {
    schema_version: 'controlled-pilot-profile.v1',
    profile_id: 'receiver-pilot-profile',
    pilot_id: 'cet4-pilot-2026',
    environment_id: 'receiver-pilot-environment',
    region: 'ap-shanghai',
    api_base_url: 'https://pilot.softbook.example/softbook-api',
    runtime_mode: 'controlled_pilot',
    enabled_tracks: ['cet4'],
    minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
    signing_key_id: 'pilot-signing-key-1',
    cohort_limit: 50,
    pilot_expires_at: '2026-09-10T00:00:00.000Z',
    gate_eligible: false,
  });
  const assembledDirectory = join(directory, 'assembled');
  bundleBuilder.assembleControlledPilotBundle({
    profilePath,
    pilotReviewPath,
    approvalPath,
    auditPath,
    candidatePayloadPath,
    audioQcDirectory: join(directory, 'audio/qc'),
    outputDirectory: assembledDirectory,
    bundleId: 'cet4-pilot-bundle-assembled',
    releaseId: 'cet4-pilot-release-assembled',
    createdAt: '2026-08-09T00:00:00.000Z',
    releaseAt: '2026-08-10T00:00:00.000Z',
    apply: true,
  });
  return {
    auditPath: join(assembledDirectory, 'audit/controlled-pilot-audit.json'),
    bundlePath: join(assembledDirectory, 'controlled-pilot-bundle.json'),
    firstAudioPath: join(assembledDirectory, relative(directory, firstAudioPath)),
    profilePath,
  };
}

function detailedAuditFixture(cards, corpusDigest) {
  const canonicalCards = [...cards].sort((left, right) =>
    left.card_id.localeCompare(right.card_id),
  );
  const cardIds = canonicalCards.map(card => card.card_id);
  const bySeverity = {
    hard_blocker: 0,
    content_risk: 0,
    review_gap: 0,
    source_risk: 120,
  };
  const byRule = Object.fromEntries(
    [
      'analysis_missing_or_too_short',
      'exact_repeated_analysis',
      'exact_repeated_front',
      'front_leaks_analysis_conclusion',
      'front_leaks_correct_answer',
      'front_missing_or_too_short',
      'generic_front_pattern',
      'missing_quality_metadata',
      'multiple_choice_answer_not_in_options',
      'multiple_choice_no_options',
      'synthetic_source',
      'template_analysis_pattern',
      'unverified_source',
    ].map(rule => [rule, rule === 'synthetic_source' ? 120 : 0]),
  );
  return {
    audit_version: 'card-make-quality-audit-v1',
    corpus_fingerprint: {
      algorithm: 'sha256',
      card_dir: 'card_boxes_json',
      file_count: 14,
      card_count: 120,
      digest: corpusDigest,
    },
    mode: 'read_only_non_blocking_for_legacy_corpus',
    ok: true,
    report_type: 'scoped_card_quality_audit',
    scope: {
      card_dir: 'card_boxes_json',
      card_ids: cardIds,
      missing_card_ids: [],
    },
    scope_summary: {
      card_ids: cardIds,
      card_count: 120,
      issue_count: 120,
      by_severity: bySeverity,
      by_rule: byRule,
    },
    scoped_card_issue_index: Object.fromEntries(
      canonicalCards.map(card => [
        card.card_id,
        {
          file: `card_boxes_seed_${card.knowledge_ref}.json`,
          card_id: card.card_id,
          track: 'cet4',
          library: card.space_metadata.library,
          group: card.space_metadata.group,
          box: card.space_metadata.box,
          box_prefix: card.knowledge_ref,
          interaction_id: card.interaction_id,
          issue_count: 1,
          by_severity: {
            hard_blocker: 0,
            content_risk: 0,
            review_gap: 0,
            source_risk: 1,
          },
          by_rule: {synthetic_source: 1},
        },
      ]),
    ),
    scoped_hard_blocker_issues: [],
  };
}

function modelAcceptanceFixture(runId, inputSha256, capability) {
  return {
    schema_version: 'model-acceptance.v2',
    actor: {
      kind: 'model_harness',
      agent: `agent:${runId}`,
      model: 'gpt-5.6-sol',
      run_id: runId,
    },
    evidence: {
      reviewed_at: '2026-08-09T00:00:00.000Z',
      input_sha256: inputSha256,
      capabilities: [capability],
      summary: `Independent ${capability} fixture review.`,
      findings: [],
    },
    decision: 'accepted',
  };
}

function modelAudioQcFixture({assetPath, cardIds, fileHash, runPrefix}) {
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
  const transcripts = cardIds.map(cardId => ({
    card_id: cardId,
    transcript: `Spoken training prompt for ${cardId}.`,
    target_signal: cardId,
    pronunciation_notes: 'Reviewed from the complete asset.',
    text_review_result: 'passed',
  }));
  const generatedAssets = transcripts.map(item => ({
    card_id: item.card_id,
    path: assetPath,
    transcript_sha256: crypto
      .createHash('sha256')
      .update(item.transcript)
      .digest('hex'),
    generated_at: '2026-08-09T00:00:00.000Z',
    generator_version: 'fixture-v1',
    file_sha256: fileHash,
    provenance_note: 'Deterministic fixture bytes.',
  }));
  const perCardQc = cardIds.map(cardId => ({
    card_id: cardId,
    asset_path: assetPath,
    complete_asset_consumed: true,
    matches_text: true,
    target_signal: true,
    pronunciation: true,
    speed: true,
    rhythm: true,
    stress_pauses: true,
    no_noise: true,
    notes: 'Complete fixture asset reviewed.',
  }));
  const perCardById = new Map(perCardQc.map(item => [item.card_id, item]));
  const identities = generatedAssets
    .map(item => {
      const result = perCardById.get(item.card_id);
      return {
        card_id: item.card_id,
        path: item.path,
        file_sha256: item.file_sha256,
        transcript_sha256: item.transcript_sha256,
        per_card_qc: {
          complete_asset_consumed: result.complete_asset_consumed,
          matches_text: result.matches_text,
          target_signal: result.target_signal,
          pronunciation: result.pronunciation,
          speed: result.speed,
          rhythm: result.rhythm,
          stress_pauses: result.stress_pauses,
          no_noise: result.no_noise,
        },
      };
    })
    .sort((left, right) =>
      left.card_id.localeCompare(right.card_id) || left.path.localeCompare(right.path));
  const inputSha256 = digestJson({
    assets: identities,
    trusted_media: trustedMedia,
  });
  return {
    schema_version: 'model-owned-audio-qc.v2',
    audio_qc_id: `${runPrefix}-audio-qc`,
    created_at: '2026-08-09T00:00:00.000Z',
    model_acceptances: [
      modelAcceptanceFixture(`${runPrefix}-a`, inputSha256, 'audio_perceptual_review'),
      modelAcceptanceFixture(`${runPrefix}-b`, inputSha256, 'audio_perceptual_review'),
    ],
    scope: {
      library: '听力',
      group: 'fixture',
      box: 'fixture',
      box_prefixes: [],
      card_ids: [...cardIds],
    },
    source_records: {
      card_files: [],
      linked_agent_self_review: 'reviews/agent_self_review/audio.json',
      linked_approved_batch: 'reviews/approved_batches/cet4.json',
      trusted_media_receipt: trustedMedia.receipt_path,
      trusted_media_receipt_sha256: trustedMedia.receipt_sha256,
      trusted_media_attestation_bundle: trustedMedia.attestation_bundle_path,
      trusted_media_attestation_bundle_sha256:
        trustedMedia.attestation_bundle_sha256,
      trusted_media_source_commit: trustedMedia.source_commit,
      trusted_media_model_id: trustedMedia.model_id,
      trusted_media_model_revision: trustedMedia.model_revision,
    },
    text_gate: {
      tts_text_reviewed: true,
      text_source_type: 'synthetic_training_content',
      transcripts,
    },
    generation_plan: {
      method: 'TTS_AI_generated',
      provider: 'fixture',
      voice_or_speaker: 'fixture',
      speed: 'normal',
      style_notes: 'fixture',
      output_dir: 'audio/',
      overwrite_existing_assets: false,
      replacement_reason: '',
    },
    legacy_adoption: {
      enabled: false,
      reviewed_at: '',
      reproducibility_status: 'reproducible',
    },
    generated_assets: generatedAssets,
    qa_checks: Object.fromEntries(
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
      ].map(check => [check, true]),
    ),
    per_card_qc: perCardQc,
    verdict: {
      candidate_audio_ok: true,
      formal_audio_ready: true,
      requires_regeneration: false,
      reason: 'Two independent model-owned QC runs passed.',
    },
    approval_boundary: {
      tts_audio_is_not_source_authenticity_evidence: true,
      current_model_owned_content_authorization_required: true,
      external_facts_must_not_be_inferred: true,
    },
    validation: {
      audio_qc: 'node scripts/validate_audio_qc.mjs',
      harness: 'node scripts/validate_harness.mjs',
    },
  };
}

function rewriteBoundAudit(fixture, mutate) {
  const audit = JSON.parse(readFileSync(fixture.auditPath, 'utf8'));
  mutate(audit);
  const auditHash = writeJson(fixture.auditPath, audit);
  rewriteBundle(fixture.bundlePath, bundle => {
    bundle.audit.report_sha256 = auditHash;
  });
}

function rewriteBundle(bundlePath, mutate) {
  const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
  mutate(bundle);
  writeJson(bundlePath, bundle);
}

async function developmentCardSource() {
  const api = createSoftbookApi({
    smsCode: '2468',
    tokenSecret: 'publisher-fixture-secret',
  });
  const challenge = await api.handleHttpRequest({
    body: {phone_number: '13800138000'},
    clientIp: '127.0.0.1',
    headers: {},
    method: 'POST',
    path: '/v2/auth/request-code',
    query: {},
  });
  const verified = await api.handleHttpRequest({
    body: {
      challenge_id: challenge.body.data.challenge_id,
      phone_number: '13800138000',
      sms_code: '2468',
    },
    clientIp: '127.0.0.1',
    headers: {},
    method: 'POST',
    path: '/v2/auth/verify-code',
    query: {},
  });
  const response = await api.handleHttpRequest({
    headers: {authorization: `Bearer ${verified.body.data.access_token}`},
    method: 'GET',
    path: '/v1/learning/card-source',
    query: {track: 'cet4'},
  });
  return response.body.data;
}

function writeJson(path, value) {
  const bytes = Buffer.from(JSON.stringify(value));
  writeFileSync(path, bytes);
  return digestBytes(bytes);
}

function digestBytes(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function digestText(value) {
  return digestBytes(Buffer.from(value));
}

function digestJson(value) {
  return digestText(JSON.stringify(value));
}
