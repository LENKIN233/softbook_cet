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
const {join, resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {after, before, test} = require('node:test');

const {
  createSoftbookApi,
  validateCardSourceForReleaseBundle,
} = require('../index');

let catalog;
let publisher;
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
    /audit scope does not match the content payload/,
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
    /rule unverified_source is not allowed/,
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
    ['listening', '听力', 24, 16, 4],
    ['careful_reading', '仔细阅读', 24, 12, 4],
    ['cloze', '选词填空', 16, 8, 3],
    ['writing', '写作', 16, 8, 3],
    ['translation', '翻译', 16, 6, 3],
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
  const approvalHash = writeJson(join(directory, 'approval/pilot-approval.json'), {
    schema_version: 'controlled-pilot-approval.v1',
    pilot_id: 'cet4-pilot-2026',
    content_version: content.content_version,
    scope: 'controlled_pilot_120',
    status: 'approved',
    approved_by_user: true,
    approved_at: '2026-08-09T00:00:00.000Z',
    card_ids: content.card_records.map(card => card.card_id),
  });
  const auditPath = join(directory, 'audit/pilot-audit.json');
  const auditCorpusDigest = digestText('card-make-corpus').slice('sha256:'.length);
  const auditHash = writeJson(
    auditPath,
    detailedAuditFixture(content.card_records, auditCorpusDigest),
  );
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
    const recordHash = writeJson(join(directory, recordPath), {
      verdict: {formal_audio_ready: true},
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
      per_card_qc: cardIds.map(cardId => ({card_id: cardId})),
    });
    return {
      asset_id: asset.asset_id,
      card_ids: cardIds,
      record_path: recordPath,
      record_sha256: recordHash,
      reviewed_by: 'human-reviewer',
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
    api_base_url: 'https://pilot.softbook.example',
    runtime_mode: 'controlled_pilot',
    enabled_tracks: ['cet4'],
    minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
    signing_key_id: 'pilot-signing-key-1',
    cohort_limit: 50,
    pilot_expires_at: '2026-09-10T00:00:00.000Z',
    gate_eligible: false,
  });
  const bundlePath = join(directory, 'controlled-pilot-bundle.json');
  writeJson(bundlePath, {
    schema_version: 'controlled-pilot-bundle.v1',
    bundle_id: 'cet4-pilot-bundle-001',
    profile_id: 'receiver-pilot-profile',
    pilot_id: 'cet4-pilot-2026',
    release_id: 'cet4-pilot-release-001',
    track: 'cet4',
    runtime_mode: 'controlled_pilot',
    created_at: '2026-08-09T00:00:00.000Z',
    release_at: '2026-08-10T00:00:00.000Z',
    pilot_expires_at: '2026-09-10T00:00:00.000Z',
    content: {
      payload_path: 'content/cet4-pilot.json',
      payload_sha256: contentHash,
      content_version: content.content_version,
      corpus_fingerprint: corpusFingerprint,
      card_count: 120,
      free_card_count: 60,
      library_card_counts: Object.fromEntries(
        libraries.map(([key, , total]) => [key, total]),
      ),
      free_library_card_counts: Object.fromEntries(
        libraries.map(([key, , , free]) => [key, free]),
      ),
      library_box_counts: Object.fromEntries(
        libraries.map(([key, , , , boxes]) => [key, boxes]),
      ),
      interaction_card_counts: {
        flip: 40,
        multiple_choice: 30,
        lock: 20,
        elimination: 15,
        swipe: 15,
      },
      mapped_card_count: 120,
      unmapped_card_count: 0,
      duplicate_card_id_count: 0,
    },
    approval: {
      record_path: 'approval/pilot-approval.json',
      record_sha256: approvalHash,
      scope: 'controlled_pilot_120',
      status: 'approved',
      approved_at: '2026-08-09T00:00:00.000Z',
    },
    audit: {
      report_path: 'audit/pilot-audit.json',
      report_sha256: auditHash,
      audit_version: 'card-make-quality-audit-v1',
      report_type: 'scoped_card_quality_audit',
      scope_card_count: 120,
      scope_card_ids_sha256: digestJson(
        content.card_records
          .map(card => card.card_id)
          .sort((left, right) => left.localeCompare(right)),
      ),
      corpus_sha256: `sha256:${auditCorpusDigest}`,
      unresolved_blockers: 0,
      unexplained_risks: 0,
      metadata_coverage: 1,
      explained_risks: [
        {
          rule_id: 'synthetic_source',
          severity: 'source_risk',
          card_count: 120,
          disclosure: 'synthetic_training_content_not_true_exam',
        },
      ],
    },
    audio: {
      manifest_path: 'audio/manifest.json',
      manifest_sha256: manifestHash,
      qc_index_path: 'audio/qc-index.json',
      qc_index_sha256: qcHash,
      referenced_asset_count: 24,
      qc_asset_count: 24,
    },
    minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
    gate_eligible: false,
  });
  return {auditPath, bundlePath, firstAudioPath, profilePath};
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
