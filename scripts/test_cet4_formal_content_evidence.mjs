#!/usr/bin/env node

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {validateGateEvidenceArtifact} from './lib/launch_evidence_contract.mjs';
import {
  loadLaunchEvidenceSemanticContext,
} from './validate_launch_readiness.mjs';
import {
  validateCet4ClosedBetaReadiness,
  verifyCet4ClosedBetaRepositoryEvidence,
} from './validate_cet4_closed_beta_readiness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOW = new Date('2026-08-24T00:00:00.000Z');
const readinessSpec = readJson(
  path.join(ROOT, 'spec/cet4-closed-beta-readiness.json'),
);
const readinessState = readJson(
  path.join(ROOT, 'docs/release/cet4-closed-beta-readiness.v1.json'),
);
const launchState = readJson(
  path.join(ROOT, 'docs/release/launch-readiness.v1.json'),
);

test('CET4 content-pack evidence binds exact bundle, approval, audit and 301 QC entries', () => {
  const fixture = createFormalContentFixture();
  const result = validateFixture(fixture);
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('all four CET4 content evidence types use registered exact check sets', () => {
  const checksByType = {
    'cet4-approved-box-coverage-report': [
      'all-108-boxes-covered',
      'whole-scope-approval-bound',
      'zero-unapproved-boxes',
    ],
    'cet4-approved-card-coverage-report': [
      'all-1180-cards-covered',
      'whole-scope-approval-bound',
      'zero-unapproved-cards',
    ],
    'cet4-audio-qc-coverage-report': [
      'all-301-assets-covered',
      'all-qc-records-formally-ready',
      'asset-hashes-match-content-release',
    ],
    'cet4-content-pack-integrity-report': [
      'content-version-and-corpus-bound',
      'bundle-evidence-hashes-match',
      'private-assets-hash-bound',
      'source-integrity-complete',
    ],
  };
  for (const [evidenceType, checkIds] of Object.entries(checksByType)) {
    const fixture = createFormalContentFixture();
    fixture.evidenceType = evidenceType;
    fixture.artifact.subject.evidence_type = evidenceType;
    fixture.artifact.checks = checkIds.map(id => ({
      id,
      status: 'passed',
      artifact_roles: [...fixture.rolePaths.keys()],
    }));
    const result = validateFixture(fixture);
    assert.equal(result.ok, true, `${evidenceType}\n${result.errors.join('\n')}`);
  }
});

test('CET4 content evidence rejects dry-run report, approval drift, QC gap and bundle hash mismatch', () => {
  const dryRun = createFormalContentFixture();
  dryRun.loaded.buildReport.apply = false;
  assertInvalid(dryRun, /build report\.apply/);

  const approvalDrift = createFormalContentFixture();
  approvalDrift.loaded.approval.approved_by_user = false;
  assertInvalid(approvalDrift, /approved_by_user/);

  const qcGap = createFormalContentFixture();
  qcGap.loaded.audioQcIndex.assets[0].formal_audio_ready = false;
  assertInvalid(qcGap, /formal_audio_ready/);

  const hashDrift = createFormalContentFixture();
  hashDrift.loaded.bundle.content.payload_sha256 = `sha256:${hash('wrong-content')}`;
  assertInvalid(hashDrift, /payload_sha256/);

  const perAssetDrift = createFormalContentFixture();
  const firstCardIds = perAssetDrift.loaded.audioQcIndex.assets[0].card_ids;
  perAssetDrift.loaded.audioQcIndex.assets[0].card_ids =
    perAssetDrift.loaded.audioQcIndex.assets[1].card_ids;
  perAssetDrift.loaded.audioQcIndex.assets[1].card_ids = firstCardIds;
  assertInvalid(perAssetDrift, /card_ids sets do not match/);

  const approvalSummaryDrift = createFormalContentFixture();
  approvalSummaryDrift.loaded.approval.card_quality_audit.scope_summary.card_count = 1179;
  assertInvalid(approvalSummaryDrift, /scope_summary.card_count/);
});

test('tracked formal content evidence validates end to end and raw tamper fails', t => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'softbook-cet4-content-evidence-'),
  );
  t.after(() => fs.rmSync(tempRoot, {recursive: true, force: true}));
  fs.mkdirSync(path.join(tempRoot, 'spec'), {recursive: true});
  fs.copyFileSync(
    path.join(ROOT, 'spec/cet4-closed-beta-readiness.json'),
    path.join(tempRoot, 'spec/cet4-closed-beta-readiness.json'),
  );
  const fixture = createFormalContentFixture();
  const trackedFiles = new Set();
  for (const rawArtifact of fixture.artifact.raw_artifacts) {
    const relativePath = rawArtifact.artifact_uri.slice('repo://'.length);
    const value = fixture.rawValues.get(rawArtifact.role);
    const payload = `${JSON.stringify(value, null, 2)}\n`;
    writeFile(tempRoot, relativePath, payload);
    rawArtifact.sha256 = hash(payload);
    rawArtifact.size_bytes = Buffer.byteLength(payload);
    trackedFiles.add(relativePath);
  }
  bindRawHashes(fixture);
  const artifactRelativePath =
    'docs/release/evidence/cet4-content-pack-integrity.json';
  const artifactPayload = `${JSON.stringify(fixture.artifact, null, 2)}\n`;
  writeFile(tempRoot, artifactRelativePath, artifactPayload);
  trackedFiles.add(artifactRelativePath);
  const contract = structuredClone(readinessState);
  contract.release_candidate = fixture.candidate;
  const gate = contract.gates.find(item => item.id === 'approved-cet4-content');
  gate.status = 'in_progress';
  gate.blocked_by = [];
  gate.evidence = [
    {
      type: fixture.evidenceType,
      artifact_uri: `repo://${artifactRelativePath}`,
      artifact_sha256: hash(artifactPayload),
      artifact_size_bytes: Buffer.byteLength(artifactPayload),
      verified_at: fixture.artifact.verification.verified_at,
      verified_by: fixture.artifact.verification.verified_by,
      subject_commit_sha: fixture.candidate.commit_sha,
    },
  ];
  const semanticContext = loadLaunchEvidenceSemanticContext({root: ROOT});
  const repositoryResult = verifyCet4ClosedBetaRepositoryEvidence(contract, {
    now: NOW,
    root: tempRoot,
    semanticContext,
    trackedFiles,
    trustedCommits: new Set([fixture.candidate.commit_sha]),
  });
  assert.equal(repositoryResult.ok, true, repositoryResult.errors.join('\n'));
  const structural = validateCet4ClosedBetaReadiness(
    contract,
    readinessSpec,
    {
      launchContract: launchState,
      now: NOW,
      repositoryEvidenceValidated: repositoryResult.ok,
    },
  );
  assert.equal(structural.ok, true, structural.errors.join('\n'));
  assert.equal(structural.ready, false);

  const auditPath = path.join(
    tempRoot,
    fixture.rolePaths.get('audit'),
  );
  fs.appendFileSync(auditPath, '{"tampered":true}\n');
  const tampered = verifyCet4ClosedBetaRepositoryEvidence(contract, {
    now: NOW,
    root: tempRoot,
    semanticContext,
    trackedFiles,
    trustedCommits: new Set([fixture.candidate.commit_sha]),
  });
  assert.equal(tampered.ok, false);
  assert.match(tampered.errors.join('\n'), /(byte size|SHA-256) does not match/);
});

function createFormalContentFixture() {
  const evidenceType = 'cet4-content-pack-integrity-report';
  const commit = hash('content-evidence-commit').slice(0, 40);
  const cardIds = Array.from({length: 1180}, (_, index) =>
    `card-${String(index).padStart(4, '0')}`,
  );
  const boxIds = Array.from({length: 108}, (_, index) =>
    `box-${String(index).padStart(3, '0')}`,
  );
  const cards = cardIds.map((cardId, index) => ({
    card_id: cardId,
    knowledge_ref: boxIds[index % boxIds.length],
    ...(index < 301 ? {audio: {asset_id: `a${String(index).padStart(3, '0')}`}} : {}),
  }));
  const assets = Array.from({length: 301}, (_, index) => ({
    asset_id: `a${String(index).padStart(3, '0')}`,
    asset_path: `audio/a${String(index).padStart(3, '0')}.mp3`,
    sha256: `sha256:${hash(`audio-${index}`)}`,
    size_bytes: 100 + index,
    duration_ms: 1000 + index,
  }));
  const contentVersion = `sha256:${hash('content-version')}`;
  const corpusFingerprint = `sha256:${hash('corpus')}`;
  const profile = {
    schema_version: 'delivery-profile.v1',
    profile_id: 'receiver-cet4-beta',
    environment_id: 'receiver-cet4-beta',
    runtime_mode: 'closed_beta',
    enabled_tracks: ['cet4'],
  };
  const content = {
    track: 'cet4',
    content_version: contentVersion,
    corpus_fingerprint: corpusFingerprint,
    card_records: cards,
    assets,
  };
  const approvalId = 'cet4-full-track-final-001';
  const audit = {
    corpus_fingerprint: {digest: corpusFingerprint.slice('sha256:'.length)},
    scope: {missing_card_ids: []},
    scope_summary: {
      card_count: 1180,
      card_ids: cardIds,
      by_severity: {
        hard_blocker: 0,
        content_risk: 0,
        review_gap: 0,
        source_risk: 1180,
      },
    },
  };
  const approval = {
    approval_id: approvalId,
    approval_mode: 'full_track_final',
    approved_by_user: true,
    approved_at: '2026-08-23T07:00:00.000Z',
    scope: {track: 'cet4', card_ids: cardIds, box_prefixes: boxIds},
    card_quality_audit: {
      corpus_fingerprint: corpusFingerprint.slice('sha256:'.length),
      scope_has_no_hard_blockers: true,
      report: 'audit/cet4-quality.json',
      report_sha256: null,
      scope_summary: audit.scope_summary,
    },
  };
  const audioManifest = {
    schema_version: 'release-audio-manifest.v1',
    track: 'cet4',
    assets,
  };
  const audioQcIndex = {
    schema_version: 'audio-qc-index.v1',
    track: 'cet4',
    corpus_fingerprint: corpusFingerprint,
    assets: assets.map((asset, index) => {
      const recordHash = hash(`qc-${index}`);
      return {
        asset_id: asset.asset_id,
        card_ids: [cardIds[index]],
        record_path: `audio/qc/${recordHash}.json`,
        record_sha256: `sha256:${recordHash}`,
        reviewed_by: 'external:human-audio-reviewer',
        reviewed_at: '2026-08-23T08:00:00.000Z',
        formal_audio_ready: true,
      };
    }),
  };
  const rolePaths = new Map([
    ['build-report', 'docs/release/evidence/raw/cet4/build-report.json'],
    ['profile', 'docs/release/evidence/raw/cet4/profile.json'],
    ['bundle', 'docs/release/evidence/raw/cet4/release-bundle.json'],
    ['content', 'docs/release/evidence/raw/cet4/content/cet4.json'],
    ['approval', 'docs/release/evidence/raw/cet4/approval/final.json'],
    ['audit', 'docs/release/evidence/raw/cet4/audit/cet4-quality.json'],
    ['manifest', 'docs/release/evidence/raw/cet4/audio/manifest.json'],
    ['qc-index', 'docs/release/evidence/raw/cet4/audio/qc-index.json'],
  ]);
  const rawValues = new Map([
    ['profile', profile],
    ['content', content],
    ['approval', approval],
    ['audit', audit],
    ['manifest', audioManifest],
    ['qc-index', audioQcIndex],
  ]);
  const rawHashes = new Map();
  for (const [role, value] of rawValues) {
    rawHashes.set(role, hash(`${JSON.stringify(value, null, 2)}\n`));
  }
  approval.card_quality_audit.report_sha256 = `sha256:${rawHashes.get('audit')}`;
  rawHashes.set('approval', hash(`${JSON.stringify(approval, null, 2)}\n`));
  const bundle = {
    schema_version: 'release-bundle.v1',
    bundle_id: 'cet4-bundle-b',
    release_id: 'cet4-release-b',
    parent_release_id: 'cet4-release-a',
    track: 'cet4',
    content: {
      payload_sha256: `sha256:${rawHashes.get('content')}`,
      content_version: contentVersion,
      corpus_fingerprint: corpusFingerprint,
      card_count: 1180,
    },
    approval: {
      record_sha256: `sha256:${rawHashes.get('approval')}`,
      approval_id: approvalId,
    },
    audit: {
      report_path: approval.card_quality_audit.report,
      report_sha256: `sha256:${rawHashes.get('audit')}`,
    },
    audio: {
      manifest_sha256: `sha256:${rawHashes.get('manifest')}`,
      qc_index_sha256: `sha256:${rawHashes.get('qc-index')}`,
      asset_count: 301,
      qc_passed_count: 301,
    },
  };
  rawValues.set('bundle', bundle);
  rawHashes.set('bundle', hash(`${JSON.stringify(bundle, null, 2)}\n`));
  const candidate = {
    schema_version: 'cet4-closed-beta-release-candidate.v1',
    repository: 'LENKIN233/softbook_cet',
    commit_sha: commit,
    target_release: 'cet4-closed-beta',
    recorded_at: '2026-08-23T12:00:00.000Z',
    recorded_by: 'github:LENKIN233',
    environment: {
      profile_id: profile.profile_id,
      profile_sha256: rawHashes.get('profile'),
      environment_id: profile.environment_id,
      class: 'production_like_staging',
      receiver_owned: true,
    },
    release: {
      release_id: bundle.release_id,
      parent_release_id: bundle.parent_release_id,
      content_version: contentVersion,
      bundle_sha256: rawHashes.get('bundle'),
      backend_deployment_id: `backend-deployment:sha256:${hash('backend')}`,
    },
    content: {
      track: 'cet4',
      card_count: 1180,
      box_count: 108,
      audio_asset_count: 301,
      full_track_approval_sha256: rawHashes.get('approval'),
      audio_qc_index_sha256: rawHashes.get('qc-index'),
    },
    client_builds: {ios: 'ios-build-1', android: 'android-build-1', pc_web: 'web-build-1'},
    entitlement: {mode: 'beta-entitlement.v1', campaign_id: 'beta-campaign-1'},
  };
  const buildReport = {
    schema_version: 'formal-release-bundle-build-report.v2',
    apply: true,
    bundle_directory: 'cet4-bundle-b',
    repository_commit: commit,
    profile_id: profile.profile_id,
    profile_sha256: `sha256:${rawHashes.get('profile')}`,
    bundle_id: bundle.bundle_id,
    bundle_sha256: `sha256:${rawHashes.get('bundle')}`,
    release_id: bundle.release_id,
    parent_release_id: bundle.parent_release_id,
    content_version: contentVersion,
    card_count: 1180,
    box_count: 108,
    audio_asset_count: 301,
    audio_qc_entry_count: 301,
    unique_qc_record_count: 301,
    approval_id: approvalId,
    approval_sha256: `sha256:${rawHashes.get('approval')}`,
    audit_sha256: `sha256:${rawHashes.get('audit')}`,
    audio_manifest_sha256: `sha256:${rawHashes.get('manifest')}`,
    audio_qc_index_sha256: `sha256:${rawHashes.get('qc-index')}`,
    verified: true,
    execution: {
      started_at: '2026-08-23T09:00:00.000Z',
      completed_at: '2026-08-23T09:05:00.000Z',
      operator: 'team:closed-beta-release',
    },
    write_safety: {
      errors: [],
      ok: true,
      branch: 'main',
      dirty: false,
      head: commit,
      origin_main: commit,
      node_version: '22.13.0',
    },
    cloudbase_writes_performed: false,
    gate_eligible: false,
  };
  rawValues.set('build-report', buildReport);
  rawHashes.set('build-report', hash(`${JSON.stringify(buildReport, null, 2)}\n`));
  const measurements = {
    build_report_role: 'build-report',
    profile_role: 'profile',
    bundle_role: 'bundle',
    content_role: 'content',
    approval_role: 'approval',
    audit_role: 'audit',
    audio_manifest_role: 'manifest',
    audio_qc_index_role: 'qc-index',
    content_version: contentVersion,
    corpus_fingerprint: corpusFingerprint,
    bundle_id: bundle.bundle_id,
    approval_id: approvalId,
    card_count: 1180,
    box_count: 108,
    audio_asset_count: 301,
    assertions: {
      exact_cet4_scope: true,
      full_track_final_approval_bound: true,
      quality_audit_bound: true,
      complete_formal_audio_qc: true,
      bundle_hashes_match: true,
      core_verification_passed: true,
    },
  };
  const specHash = hash(fs.readFileSync(path.join(ROOT, 'spec/cet4-closed-beta-readiness.json')));
  const artifact = {
    schema_version: 'launch-gate-evidence.v1',
    campaign_id: 'cet4-content-campaign-001',
    execution_mode: 'receiver_deployed',
    gate_eligible: true,
    result: 'passed',
    subject: {
      repository: candidate.repository,
      commit_sha: commit,
      target_release: candidate.target_release,
      gate_id: 'approved-cet4-content',
      evidence_type: evidenceType,
      policy_id: 'cet4-closed-beta-readiness-v1',
      policy_sha256: specHash,
      environment: candidate.environment,
      release: candidate.release,
      client_builds: candidate.client_builds,
    },
    execution: {
      started_at: '2026-08-23T08:55:00.000Z',
      completed_at: '2026-08-23T09:10:00.000Z',
      operator: 'team:closed-beta-release',
      tool: {name: 'softbook-evidence-runner', version: '1.0.0', config_sha256: hash('content-config')},
    },
    verification: {
      verified_at: '2026-08-23T10:00:00.000Z',
      verified_by: 'external:content-auditor',
      independent: true,
      attestation: {provider: 'protected_environment', id: 'content-attestation', sha256: hash('attestation')},
    },
    raw_artifacts: [...rolePaths].map(([role, relativePath]) => ({
      role,
      artifact_uri: `repo://${relativePath}`,
      sha256: rawHashes.get(role),
      size_bytes: Buffer.byteLength(`${JSON.stringify(rawValues.get(role), null, 2)}\n`),
    })),
    checks: [
      'content-version-and-corpus-bound',
      'bundle-evidence-hashes-match',
      'private-assets-hash-bound',
      'source-integrity-complete',
    ].map(id => ({id, status: 'passed', artifact_roles: [...rolePaths.keys()]})),
    measurements,
  };
  return {
    artifact,
    candidate,
    evidenceType,
    loaded: {buildReport, profile, bundle, content, approval, audit, audioManifest, audioQcIndex},
    rawValues,
    rolePaths,
  };
}

function validateFixture(fixture) {
  return validateGateEvidenceArtifact(fixture.artifact, {
    evidenceType: fixture.evidenceType,
    expectedPolicy: {
      id: 'cet4-closed-beta-readiness-v1',
      sha256: fixture.artifact.subject.policy_sha256,
    },
    expectedSubject: fixture.candidate,
    gateId: 'approved-cet4-content',
    now: NOW,
    outerEvidence: {
      type: fixture.evidenceType,
      subject_commit_sha: fixture.candidate.commit_sha,
      verified_at: fixture.artifact.verification.verified_at,
      verified_by: fixture.artifact.verification.verified_by,
    },
    cet4FormalContentEvidence: fixture.loaded,
    targetRelease: 'cet4-closed-beta',
  });
}

function assertInvalid(fixture, pattern) {
  const result = validateFixture(fixture);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), pattern);
}

function bindRawHashes(fixture) {
  const byRole = new Map(
    fixture.artifact.raw_artifacts.map(item => [item.role, item.sha256]),
  );
  fixture.artifact.subject.environment.profile_sha256 = byRole.get('profile');
  fixture.artifact.subject.release.bundle_sha256 = byRole.get('bundle');
  fixture.artifact.measurements.bundle_id = fixture.loaded.bundle.bundle_id;
}

function writeFile(root, relativePath, payload) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, payload);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}
