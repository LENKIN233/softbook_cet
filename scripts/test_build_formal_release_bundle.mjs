#!/usr/bin/env node

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  catalogEntriesByRef,
  loadBoxCatalog,
} from '../infra/cloudbase/card-source-catalog.mjs';

import {
  FormalReleaseBundleBuildError,
  assembleFormalReleaseBundle,
  parseFormalReleaseBundleArguments,
} from './build_formal_release_bundle.mjs';
import {buildModelAcceptanceInputSha256} from './lib/model_acceptance_contract.mjs';

const REQUIRED_QC_CHECKS = [
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
];
const require = createRequire(import.meta.url);
const {validateCardSourceForReleaseBundle} = require(
  '../infra/cloudbase/functions/softbook-api',
);

test('formal bundle builder is dry-run by default and parses a retained parent', () => {
  const parsed = parseFormalReleaseBundleArguments([
    '--profile',
    'profile.json',
    '--content-payload',
    'content.json',
    '--authorization',
    'authorization.json',
    '--model-review',
    'model-review.json',
    '--audit',
    'audit.json',
    '--audio-qc-dir',
    'qc',
    '--output-dir',
    'bundle',
    '--bundle-id',
    'cet4-bundle-b',
    '--release-id',
    'cet4-release-b',
    '--parent-release-id',
    'cet4-release-a',
    '--created-at',
    '2026-08-23T10:00:00.000Z',
    '--release-at',
    '2026-08-23T11:00:00.000Z',
  ]);
  assert.equal(parsed.apply, false);
  assert.equal(parsed.parentReleaseId, 'cet4-release-a');
});

test('dry-run assembles exact 1180/108/301 scope, invokes core verifier, and retains nothing', t => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, {recursive: true, force: true}));
  let verificationCalls = 0;
  const report = assembleFormalReleaseBundle(fixture.options, {
    verify: ({bundlePath, profilePath}) => {
      verificationCalls += 1;
      assert.equal(profilePath, fixture.profilePath);
      verifyStagingBundle(bundlePath);
      return {bundle: {release_id: 'cet4-release-b'}};
    },
  });

  assert.equal(verificationCalls, 1);
  assert.equal(report.apply, false);
  assert.equal(report.schema_version, 'formal-release-bundle-build-report.v2');
  assert.equal(report.bundle_directory, null);
  assert.equal(report.card_count, 1180);
  assert.equal(report.box_count, 108);
  assert.equal(report.audio_asset_count, 301);
  assert.equal(report.audio_qc_entry_count, 301);
  assert.equal(report.unique_qc_record_count, 1);
  assert.equal(report.parent_release_id, 'cet4-release-a');
  assert.equal(report.verified, true);
  assert.equal(report.cloudbase_writes_performed, false);
  assert.equal(report.gate_eligible, false);
  assert.equal(report.execution.operator, null);
  assert.match(report.repository_commit, /^[0-9a-f]{40}$/);
  assert.match(report.profile_sha256, /^sha256:[0-9a-f]{64}$/);
  assert.match(report.authorization_sha256, /^sha256:[0-9a-f]{64}$/);
  assert.match(report.model_review_sha256, /^sha256:[0-9a-f]{64}$/);
  assert.match(report.audit_sha256, /^sha256:[0-9a-f]{64}$/);
  assert.match(report.audio_manifest_sha256, /^sha256:[0-9a-f]{64}$/);
  assert.match(report.audio_qc_index_sha256, /^sha256:[0-9a-f]{64}$/);
  assert.equal(report.write_safety.ok, false);
  assert.equal(fs.existsSync(fixture.outputDirectory), false);
});

test('dry-run records a missing origin/main ref as unsafe without failing assembly', t => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, {recursive: true, force: true}));
  const report = assembleFormalReleaseBundle(fixture.options, {
    ...safeBuildDependencies(),
    repository: {
      branch: '',
      dirty: false,
      head: 'a'.repeat(40),
      originMain: null,
    },
    verify: ({bundlePath}) => {
      verifyStagingBundle(bundlePath);
      return {ok: true};
    },
  });
  assert.equal(report.apply, false);
  assert.equal(report.repository_commit, 'a'.repeat(40));
  assert.equal(report.write_safety.ok, false);
  assert.equal(report.write_safety.origin_main, null);
  assert.deepEqual(report.write_safety.errors, [
    'apply requires branch main',
    'apply requires HEAD exactly equal to origin/main',
  ]);
});

test('apply keeps only a fully verified output directory', t => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, {recursive: true, force: true}));
  const report = assembleFormalReleaseBundle(
    {
      ...fixture.options,
      apply: true,
      operator: 'service:receiver-operator',
    },
    {
      ...safeBuildDependencies(),
      verify: ({bundlePath}) => {
        verifyStagingBundle(bundlePath);
        return {ok: true};
      },
    },
  );
  assert.equal(report.bundle_directory, 'cet4-bundle-b');
  assert.equal(report.execution.operator, 'service:receiver-operator');
  assert.equal(report.write_safety.ok, true);
  assert.equal(
    fs.existsSync(path.join(fixture.outputDirectory, 'release-bundle.json')),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(fixture.outputDirectory, 'audio/a000.mp3')),
    true,
  );
});

test('apply requires operator, exact Node, clean main, and origin parity', t => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, {recursive: true, force: true}));
  assert.throws(
    () =>
      assembleFormalReleaseBundle(
        {...fixture.options, apply: true},
        {...safeBuildDependencies(), verify: () => ({ok: true})},
      ),
    /apply requires an identified/,
  );
  assert.throws(
    () =>
      assembleFormalReleaseBundle(
        {
          ...fixture.options,
          apply: true,
          operator: 'service:receiver-operator',
        },
        {
          ...safeBuildDependencies(),
          repository: {
            branch: 'infra/topic',
            dirty: true,
            head: 'a'.repeat(40),
            originMain: 'b'.repeat(40),
          },
          verify: () => ({ok: true}),
        },
      ),
    /branch main; apply requires a clean worktree; apply requires HEAD exactly equal/,
  );
});

test('default core verifier accepts the fully assembled formal fixture', t => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, {recursive: true, force: true}));
  const report = assembleFormalReleaseBundle(fixture.options);
  assert.equal(report.verified, true);
  assert.equal(report.card_count, 1180);
  assert.equal(report.audio_qc_entry_count, 301);
  assert.equal(report.bundle_directory, null);
});

test('builder rejects stale model authorization, audit drift, missing model QC, and empty verification', t => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, {recursive: true, force: true}));
  const authorization = readJson(fixture.authorizationPath);
  authorization.model_acceptances[1] = structuredClone(
    authorization.model_acceptances[0],
  );
  writeJson(fixture.authorizationPath, authorization);
  assert.throws(
    () => assembleFormalReleaseBundle(fixture.options, {verify: () => ({ok: true})}),
    /run IDs must be distinct/,
  );

  const drifted = createFixture();
  t.after(() => fs.rmSync(drifted.root, {recursive: true, force: true}));
  fs.appendFileSync(drifted.auditPath, ' ');
  assert.throws(
    () => assembleFormalReleaseBundle(drifted.options, {verify: () => ({ok: true})}),
    /Quality audit bytes/,
  );

  const repaired = createFixture();
  t.after(() => fs.rmSync(repaired.root, {recursive: true, force: true}));
  fs.rmSync(repaired.audioQcDirectory, {recursive: true, force: true});
  assert.throws(
    () => assembleFormalReleaseBundle(repaired.options, {verify: () => ({ok: true})}),
    /Audio QC directory does not exist/,
  );

  const noVerify = createFixture();
  t.after(() => fs.rmSync(noVerify.root, {recursive: true, force: true}));
  assert.throws(
    () => assembleFormalReleaseBundle(noVerify.options, {verify: () => null}),
    /verification returned no result/,
  );
});

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'formal-release-builder-'));
  const assetsDirectory = path.join(root, 'source');
  const audioQcDirectory = path.join(root, 'qc');
  const profilePath = path.join(root, 'profile.json');
  const contentPayloadPath = path.join(assetsDirectory, 'cet4.json');
  const auditPath = path.join(root, 'quality-audit.json');
  const authorizationPath = path.join(root, 'authorization.json');
  const modelReviewPath = path.join(root, 'model-review.json');
  const outputDirectory = path.join(root, 'output', 'cet4-bundle-b');
  fs.mkdirSync(assetsDirectory, {recursive: true});
  fs.mkdirSync(audioQcDirectory, {recursive: true});
  const catalogEntries = [
    ...catalogEntriesByRef(loadBoxCatalog(), 'cet4').entries(),
  ];
  assert.equal(catalogEntries.length, 108);
  const boxIds = catalogEntries.map(([knowledgeRef]) => knowledgeRef);
  const cards = Array.from({length: 1180}, (_, index) => {
    const [knowledgeRef, metadata] =
      catalogEntries[index % catalogEntries.length];
    const sequence = Math.floor(index / catalogEntries.length);
    return {
      card_id: `${knowledgeRef}${String(sequence).padStart(2, '0')}`,
      knowledge_ref: knowledgeRef,
      track: 'cet4',
      interaction_id: 'flip',
      front: {
        eyebrow: 'Formal builder test',
        prompt: `Formal contract prompt ${index}`,
        support: 'Generated test fixture',
        context: 'Not release content',
      },
      back_text: `Formal contract answer ${index}`,
      auto_scoring: false,
      analysis: {
        title: 'Formal contract analysis',
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
  });
  const assets = [];
  const generatedAssets = [];
  const transcripts = [];
  const perCardQc = [];
  for (let index = 0; index < 301; index += 1) {
    const assetId = `a${String(index).padStart(3, '0')}`;
    const assetPath = `audio/${assetId}.mp3`;
    const sourceAssetPath = `ai_tts/${assetId}.mp3`;
    const bytes = Buffer.from(`formal-audio-${index}`);
    const sha256 = digest(bytes);
    const card = cards[index];
    card.audio = {
      asset_id: assetId,
      duration_ms: 1000 + index,
      sha256,
      transcript: `Formal transcript ${index}`,
    };
    assets.push({
      asset_id: assetId,
      asset_path: assetPath,
      sha256,
      size_bytes: bytes.length,
      duration_ms: 1000 + index,
      media_type: 'audio/mpeg',
    });
    const target = path.join(assetsDirectory, sourceAssetPath);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, bytes);
    generatedAssets.push({
      card_id: card.card_id,
      path: sourceAssetPath,
      file_sha256: sha256.slice('sha256:'.length),
      transcript_sha256: hash(card.audio.transcript),
    });
    transcripts.push({
      card_id: card.card_id,
      transcript: card.audio.transcript,
      target_signal: 'Formal target signal',
      pronunciation_notes: 'Complete model-owned fixture review.',
      text_review_result: 'passed',
    });
    perCardQc.push({
      card_id: card.card_id,
      asset_path: sourceAssetPath,
      complete_asset_consumed: true,
      matches_text: true,
      target_signal: true,
      pronunciation: true,
      speed: true,
      rhythm: true,
      stress_pauses: true,
      no_noise: true,
      notes: 'Complete model-owned fixture review.',
    });
  }
  const corpusDigest = hash('formal-corpus');
  const rawContent = {
    source: {id: 'cet4-formal', label: 'CET4 formal'},
    track: 'cet4',
    assets,
    card_records: cards,
    release: null,
  };
  const content = validateCardSourceForReleaseBundle(rawContent, 'cet4');
  writeJson(contentPayloadPath, content);
  const runtimePayloadSha256 = `sha256:${hash(fs.readFileSync(contentPayloadPath))}`;
  const bySeverity = {
    hard_blocker: 0,
    content_risk: 0,
    review_gap: 0,
    source_risk: 1180,
  };
  const audit = {
    report_type: 'card-quality-audit',
    corpus_fingerprint: {algorithm: 'sha256', digest: corpusDigest},
    scope: {missing_card_ids: []},
    scope_summary: {
      card_ids: cards.map(card => card.card_id),
      card_count: cards.length,
      by_severity: bySeverity,
      by_rule: {synthetic_source: 1180},
    },
  };
  writeJson(auditPath, audit);
  const auditSha256 = digest(fs.readFileSync(auditPath));
  const cardIds = cards.map(card => card.card_id);
  const reviewScope = {track: 'cet4', box_prefixes: boxIds, card_ids: cardIds};
  const reviewInput = buildModelAcceptanceInputSha256({
    decisionType: 'full_track_review',
    scope: reviewScope,
    corpusFingerprint: `sha256:${corpusDigest}`,
    auditSha256,
  });
  const modelReview = {
    schema_version: 'model-owned-full-track-review.v2',
    review_id: 'cet4-full-track-model-review-001',
    created_at: '2026-08-23T08:30:00.000Z',
    model_acceptances: [
      modelAcceptance('formal-review-a', reviewInput, [
        'card_semantic_review',
        'source_provenance_review',
      ]),
      modelAcceptance('formal-review-b', reviewInput, [
        'card_semantic_review',
        'source_provenance_review',
      ]),
    ],
    scope: reviewScope,
    specs_read: ['spec/review-workflow.json', 'spec/content-quality-contract.json'],
    coverage: {
      expected_card_count: 1180,
      reviewed_card_ids: cardIds,
      analysis_reference_check: {
        answer_matches_card: true,
        choice_or_bank_references_match_source: true,
        distractor_labels_match_explanations: true,
      },
      boxes: boxIds.map(boxPrefix => ({box_prefix: boxPrefix, status: 'pass'})),
    },
    quality_audit: {
      report: 'audit/cet4-quality.json',
      report_sha256: auditSha256,
      corpus_fingerprint: corpusDigest,
      scope_has_no_hard_blockers: true,
      scope_summary: {
        card_ids: cardIds,
        card_count: 1180,
        issue_count: 1180,
        by_severity: bySeverity,
        by_rule: {synthetic_source: 1180},
      },
    },
    representative_cards: [cardIds[0]],
    removed_cards: [],
    batch_review: {
      status: 'ready_for_model_authorization',
      summary: 'Exact full-track fixture review passed.',
      remaining_risks: [],
      next_step: 'Create exact-scope model authorization.',
    },
  };
  writeJson(modelReviewPath, modelReview);
  const modelReviewSha256 = digest(fs.readFileSync(modelReviewPath));
  const authorizationScope = {
    track: 'cet4',
    purpose: 'formal_content',
    box_prefixes: boxIds,
    card_ids: cardIds,
  };
  const linkedModelReview = 'reviews/agent_self_review/cet4-full-model-review.json';
  const authorizationInput = buildModelAcceptanceInputSha256({
    decisionType: 'full_track_content_authorization',
    scope: authorizationScope,
    corpusFingerprint: `sha256:${corpusDigest}`,
    auditSha256,
    linkedReviewIdentity: {
      path: linkedModelReview,
      sha256: modelReviewSha256,
    },
    additionalBindings: {
      content_version: content.content_version,
      runtime_payload_sha256: runtimePayloadSha256,
    },
  });
  const authorization = {
    schema_version: 'model-owned-content-authorization.v2',
    authorization_id: 'cet4-full-track-authorization-001',
    authorization_mode: 'full_track',
    content_version: content.content_version,
    authorized_at: '2026-08-23T09:00:00.000Z',
    model_acceptances: [
      modelAcceptance('formal-authorization-a', authorizationInput, [
        'content_authorization',
      ]),
      modelAcceptance('formal-authorization-b', authorizationInput, [
        'content_authorization',
      ]),
    ],
    scope: authorizationScope,
    summary: 'Exact full-track model authorization fixture.',
    representative_cards: [cardIds[0]],
    card_quality_audit: {
      report: 'audit/cet4-quality.json',
      report_sha256: auditSha256,
      corpus_fingerprint: corpusDigest,
      scope_has_no_hard_blockers: true,
      scope_summary: {
        card_ids: cardIds,
        card_count: cards.length,
        issue_count: 1180,
        by_severity: bySeverity,
        by_rule: {synthetic_source: 1180},
      },
    },
    validation: {
      model_review: linkedModelReview,
      model_review_sha256: modelReviewSha256,
      runtime_payload: 'reviews/runtime_payloads/cet4-formal.json',
      runtime_payload_sha256: runtimePayloadSha256,
    },
    authorization_limits: ['Exact immutable fixture scope only.'],
  };
  writeJson(authorizationPath, authorization);
  const perCardById = new Map(perCardQc.map(item => [item.card_id, item]));
  const trustedMedia = {
    receipt_path: 'reviews/trusted_media_receipts/fixture-receipt.json',
    receipt_sha256: hash('trusted-media-receipt'),
    attestation_bundle_path: 'reviews/trusted_media_receipts/fixture-bundle.jsonl',
    attestation_bundle_sha256: hash('trusted-media-bundle'),
    source_commit: 'a'.repeat(40),
    model_id: 'mlx-community/Qwen2-Audio-7B-Instruct-4bit',
    model_revision: 'b'.repeat(40),
  };
  const audioIdentities = generatedAssets.map(asset => {
    const result = perCardById.get(asset.card_id);
    return {
      card_id: asset.card_id,
      path: asset.path,
      file_sha256: asset.file_sha256,
      transcript_sha256: asset.transcript_sha256,
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
  }).sort((left, right) =>
    left.card_id.localeCompare(right.card_id) || left.path.localeCompare(right.path));
  const audioInput = digest(Buffer.from(JSON.stringify({
    assets: audioIdentities,
    trusted_media: trustedMedia,
  })));
  writeJson(path.join(audioQcDirectory, 'cet4-all-audio.json'), {
    schema_version: 'model-owned-audio-qc.v2',
    model_acceptances: [
      modelAcceptance('formal-audio-a', audioInput, ['audio_perceptual_review']),
      modelAcceptance('formal-audio-b', audioInput, ['audio_perceptual_review']),
    ],
    scope: {card_ids: generatedAssets.map(asset => asset.card_id)},
    source_records: {
      trusted_media_receipt: trustedMedia.receipt_path,
      trusted_media_receipt_sha256: trustedMedia.receipt_sha256,
      trusted_media_attestation_bundle: trustedMedia.attestation_bundle_path,
      trusted_media_attestation_bundle_sha256: trustedMedia.attestation_bundle_sha256,
      trusted_media_source_commit: trustedMedia.source_commit,
      trusted_media_model_id: trustedMedia.model_id,
      trusted_media_model_revision: trustedMedia.model_revision,
    },
    text_gate: {transcripts},
    qa_checks: Object.fromEntries(REQUIRED_QC_CHECKS.map(check => [check, true])),
    generated_assets: generatedAssets,
    per_card_qc: perCardQc,
    verdict: {
      candidate_audio_ok: true,
      formal_audio_ready: true,
      requires_regeneration: false,
      reason: 'Two exact-input model audio reviews passed.',
    },
    approval_boundary: {
      current_model_owned_content_authorization_required: true,
      external_facts_must_not_be_inferred: true,
    },
  });
  writeJson(profilePath, {
    schema_version: 'delivery-profile.v1',
    profile_id: 'receiver-cet4-beta',
    environment_id: 'receiver-cet4-beta',
    region: 'ap-shanghai',
    api_base_url: 'https://receiver.example.com/softbook-api',
    runtime_mode: 'closed_beta',
    enabled_tracks: ['cet4'],
    minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
    signing_key_id: 'receiver-signing-key-v1',
  });
  return {
    root,
    profilePath,
    contentPayloadPath,
    auditPath,
    authorizationPath,
    modelReviewPath,
    audioQcDirectory,
    outputDirectory,
    options: {
      profilePath,
      contentPayloadPath,
      authorizationPath,
      modelReviewPath,
      auditPath,
      audioQcDirectory,
      assetRoot: assetsDirectory,
      outputDirectory,
      bundleId: 'cet4-bundle-b',
      releaseId: 'cet4-release-b',
      parentReleaseId: 'cet4-release-a',
      createdAt: '2026-08-23T10:00:00.000Z',
      releaseAt: '2026-08-23T11:00:00.000Z',
      apply: false,
    },
  };
}

function modelAcceptance(runId, inputSha256, capabilities) {
  return {
    schema_version: 'model-acceptance.v2',
    actor: {
      kind: 'model_harness',
      agent: `agent:${runId}`,
      model: 'gpt-5.6-sol',
      run_id: runId,
    },
    evidence: {
      reviewed_at: '2026-08-23T08:00:00.000Z',
      input_sha256: inputSha256,
      capabilities,
      summary: `Independent ${runId} fixture pass.`,
      findings: [],
    },
    decision: 'accepted',
  };
}

function verifyStagingBundle(bundlePath) {
  const root = path.dirname(bundlePath);
  const bundle = readJson(bundlePath);
  assert.equal(bundle.schema_version, 'release-bundle.v1');
  assert.equal(bundle.content.card_count, 1180);
  assert.equal(bundle.audio.asset_count, 301);
  assert.equal(bundle.audio.qc_passed_count, 301);
  assert.equal(bundle.parent_release_id, 'cet4-release-a');
  assert.equal(fs.existsSync(path.join(root, bundle.content.payload_path)), true);
  assert.equal(fs.existsSync(path.join(root, bundle.approval.record_path)), true);
  assert.equal(
    fs.existsSync(path.join(root, bundle.approval.model_review_path)),
    true,
  );
  assert.equal(fs.existsSync(path.join(root, bundle.audit.report_path)), true);
  assert.equal(fs.existsSync(path.join(root, bundle.audio.manifest_path)), true);
  assert.equal(fs.existsSync(path.join(root, bundle.audio.qc_index_path)), true);
  const qcIndex = readJson(path.join(root, bundle.audio.qc_index_path));
  assert.equal(qcIndex.assets.length, 301);
}

function safeBuildDependencies() {
  const timestamps = [
    new Date('2026-08-23T10:00:00.000Z'),
    new Date('2026-08-23T10:05:00.000Z'),
  ];
  return {
    clock: () => timestamps.shift(),
    nodeVersion: '22.13.0',
    repository: {
      branch: 'main',
      dirty: false,
      head: 'a'.repeat(40),
      originMain: 'a'.repeat(40),
    },
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function digest(value) {
  return `sha256:${hash(value)}`;
}
