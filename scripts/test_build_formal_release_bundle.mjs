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
    '--approval',
    'approval.json',
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
  assert.equal(fs.existsSync(fixture.outputDirectory), false);
});

test('apply keeps only a fully verified output directory', t => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, {recursive: true, force: true}));
  const report = assembleFormalReleaseBundle(
    {...fixture.options, apply: true},
    {
      verify: ({bundlePath}) => {
        verifyStagingBundle(bundlePath);
        return {ok: true};
      },
    },
  );
  assert.equal(report.bundle_directory, fixture.outputDirectory);
  assert.equal(
    fs.existsSync(path.join(fixture.outputDirectory, 'release-bundle.json')),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(fixture.outputDirectory, 'audio/a000.mp3')),
    true,
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

test('builder rejects missing user approval, audit drift, missing human QC, and empty verification', t => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, {recursive: true, force: true}));
  const approval = readJson(fixture.approvalPath);
  approval.approved_by_user = false;
  writeJson(fixture.approvalPath, approval);
  assert.throws(
    () => assembleFormalReleaseBundle(fixture.options, {verify: () => ({ok: true})}),
    /Full-track approval is not bound/,
  );

  approval.approved_by_user = true;
  writeJson(fixture.approvalPath, approval);
  fs.appendFileSync(fixture.auditPath, ' ');
  assert.throws(
    () => assembleFormalReleaseBundle(fixture.options, {verify: () => ({ok: true})}),
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
  const approvalPath = path.join(root, 'approval.json');
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
  const perCardQc = [];
  for (let index = 0; index < 301; index += 1) {
    const assetId = `a${String(index).padStart(3, '0')}`;
    const assetPath = `audio/${assetId}.mp3`;
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
    const target = path.join(assetsDirectory, assetPath);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, bytes);
    generatedAssets.push({
      card_id: card.card_id,
      file_sha256: sha256.slice('sha256:'.length),
    });
    perCardQc.push({card_id: card.card_id, passed: true});
  }
  const corpusDigest = hash('formal-corpus');
  const rawContent = {
    source: {id: 'cet4-formal', label: 'CET4 formal'},
    track: 'cet4',
    assets,
    card_records: cards,
    release: null,
  };
  const content = {
    ...validateCardSourceForReleaseBundle(rawContent, 'cet4'),
    corpus_fingerprint: `sha256:${corpusDigest}`,
  };
  writeJson(contentPayloadPath, content);
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
  const approval = {
    approval_id: 'cet4-full-track-final-001',
    approval_mode: 'full_track_final',
    approved_by_user: true,
    approved_at: '2026-08-23T09:00:00.000Z',
    scope: {
      track: 'cet4',
      box_prefixes: boxIds,
      card_ids: cards.map(card => card.card_id),
    },
    card_quality_audit: {
      report: 'audit/cet4-quality.json',
      report_sha256: digest(fs.readFileSync(auditPath)),
      corpus_fingerprint: corpusDigest,
      scope_has_no_hard_blockers: true,
      scope_summary: {
        card_ids: cards.map(card => card.card_id),
        card_count: cards.length,
        by_severity: bySeverity,
      },
    },
  };
  writeJson(approvalPath, approval);
  writeJson(path.join(audioQcDirectory, 'cet4-all-audio.json'), {
    verdict: {formal_audio_ready: true},
    legacy_adoption: {
      reviewer: 'external:human-audio-reviewer',
      reviewed_at: '2026-08-23T08:00:00.000Z',
    },
    qa_checks: Object.fromEntries(REQUIRED_QC_CHECKS.map(check => [check, true])),
    generated_assets: generatedAssets,
    per_card_qc: perCardQc,
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
    approvalPath,
    audioQcDirectory,
    outputDirectory,
    options: {
      profilePath,
      contentPayloadPath,
      approvalPath,
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
  assert.equal(fs.existsSync(path.join(root, bundle.audit.report_path)), true);
  assert.equal(fs.existsSync(path.join(root, bundle.audio.manifest_path)), true);
  assert.equal(fs.existsSync(path.join(root, bundle.audio.qc_index_path)), true);
  const qcIndex = readJson(path.join(root, bundle.audio.qc_index_path));
  assert.equal(qcIndex.assets.length, 301);
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
