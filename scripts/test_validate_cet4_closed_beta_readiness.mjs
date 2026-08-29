#!/usr/bin/env node

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {
  CET4_CLOSED_BETA_DEPENDENCY_IDS,
  CET4_CLOSED_BETA_GATE_DEFINITIONS,
  CET4_CLOSED_BETA_SUPPORTED_EVIDENCE_TYPES,
  validateCet4ClosedBetaReadiness,
  verifyCet4ClosedBetaRepositoryEvidence,
} from './validate_cet4_closed_beta_readiness.mjs';
import {loadLaunchEvidenceSemanticContext} from './validate_launch_readiness.mjs';
import {
  CET4_FORMAL_CONTENT_REQUIRED_CHECKS,
  loadCet4FormalContentEvidence,
} from './lib/cet4_formal_content_evidence.mjs';
import {deriveCardMakeContentVersion} from './lib/card_make_runtime_payload.mjs';
import {validateGateEvidenceArtifact} from './lib/launch_evidence_contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOW = new Date('2026-08-24T00:00:00.000Z');
const contract = readJson(
  path.join(ROOT, 'docs/release/cet4-closed-beta-readiness.v1.json'),
);
const spec = readJson(path.join(ROOT, 'spec/cet4-closed-beta-readiness.json'));
const launchContract = readJson(
  path.join(ROOT, 'docs/release/launch-readiness.v1.json'),
);

test('tracked CET4 closed-beta baseline is valid, exact, and honestly not ready', () => {
  const result = validateCet4ClosedBetaReadiness(contract, spec, {
    launchContract,
    now: NOW,
  });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.ready, false);
  assert.deepEqual(result.summary, {
    candidate_recorded: false,
    dependencies_ready: 0,
    evidence_count: 0,
    gates_passed: 0,
    total_dependencies: 5,
    total_gates: 7,
  });
  assert.equal(contract.launch_non_replacement.launch_status_unchanged, 'not_ready');
});

test('all-required evidence semantics is a valid future implementation state', () => {
  const future = structuredClone(contract);
  future.formal_evidence_ingestion = 'all_required_types_implemented';
  const result = validateCet4ClosedBetaReadiness(future, spec, {
    launchContract,
    now: NOW,
  });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.ready, false);
});

test('closed-beta scope cannot shrink, expand, or silently drop a release target', () => {
  const changed = structuredClone(contract);
  changed.scope.card_count = 120;
  changed.scope.box_count = 14;
  changed.scope.audio_asset_count = 24;
  changed.scope.release_targets = ['ios', 'android'];
  const result = validateCet4ClosedBetaReadiness(changed, spec, {now: NOW});
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /scope\.card_count/);
  assert.match(result.errors.join('\n'), /scope\.box_count/);
  assert.match(result.errors.join('\n'), /scope\.audio_asset_count/);
  assert.match(result.errors.join('\n'), /scope\.release_targets/);
});

test('closed beta cannot replace or mutate public launch readiness', () => {
  const changed = structuredClone(contract);
  changed.launch_non_replacement.launch_readiness_path =
    'docs/release/cet4-closed-beta-readiness.v1.json';
  changed.launch_non_replacement.launch_status_unchanged = 'ready';
  changed.launch_non_replacement.closed_beta_ready_does_not_imply_public_launch_ready =
    false;
  const result = validateCet4ClosedBetaReadiness(changed, spec, {now: NOW});
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /launch_readiness_path/);
  assert.match(result.errors.join('\n'), /launch_status_unchanged/);
  assert.match(result.errors.join('\n'), /does_not_imply_public_launch_ready/);
});

test('candidate, pilot-like evidence strings, and passed labels cannot fake readiness', () => {
  const changed = structuredClone(contract);
  changed.release_candidate = validCandidate();
  changed.status = 'ready';
  for (const dependency of changed.external_dependencies) dependency.status = 'ready';
  for (const gate of changed.gates) {
    gate.status = 'passed';
    gate.blocked_by = [];
    gate.evidence = CET4_CLOSED_BETA_GATE_DEFINITIONS[gate.id].map(
      (evidenceType, index) => evidenceRecord(evidenceType, index),
    );
  }
  const result = validateCet4ClosedBetaReadiness(changed, spec, {now: NOW});
  assert.equal(result.ok, false);
  assert.equal(result.ready, false);
  assert.match(
    result.errors.join('\n'),
    /requires successful tracked repository semantic validation/,
  );
  assert.match(result.errors.join('\n'), /status must be not_ready/);

  const nonObject = structuredClone(contract);
  nonObject.gates[0].evidence = ['local smoke passed'];
  const nonObjectResult = validateCet4ClosedBetaReadiness(nonObject, spec, {
    now: NOW,
  });
  assert.equal(nonObjectResult.ok, false);
  assert.match(nonObjectResult.errors.join('\n'), /evidence\[0\] must be an object/);
});

test('one exact candidate may be recorded before evidence without becoming ready', () => {
  const changed = structuredClone(contract);
  changed.release_candidate = validCandidate();
  const result = validateCet4ClosedBetaReadiness(changed, spec, {now: NOW});
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.ready, false);
  assert.equal(result.summary.candidate_recorded, true);
  assert.equal(result.summary.evidence_count, 0);
  const unreachable = verifyCet4ClosedBetaRepositoryEvidence(changed, {
    trackedFiles: new Set(),
    trustedCommits: new Set(),
  });
  assert.equal(unreachable.ok, false);
  assert.match(unreachable.errors.join('\n'), /candidate commit must be reachable/);
});

test('dependency and gate registries cannot be deleted or renamed', () => {
  const changed = structuredClone(contract);
  changed.external_dependencies.pop();
  changed.gates[0].id = 'launch-ready';
  const result = validateCet4ClosedBetaReadiness(changed, spec, {now: NOW});
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /external dependency ids/);
  assert.match(result.errors.join('\n'), /gate ids/);
  assert.deepEqual(
    Object.keys(CET4_CLOSED_BETA_GATE_DEFINITIONS),
    contract.gates.map(gate => gate.id),
  );
  assert.deepEqual(
    CET4_CLOSED_BETA_DEPENDENCY_IDS,
    contract.external_dependencies.map(item => item.id),
  );
});

test('release candidate requires receiver ownership, retained parent and exact CET4 evidence scope', () => {
  const changed = structuredClone(contract);
  changed.release_candidate = validCandidate();
  changed.release_candidate.environment.environment_id =
    'test-personal-development';
  changed.release_candidate.release.parent_release_id = null;
  changed.release_candidate.content.card_count = 2414;
  changed.release_candidate.content.audio_qc_index_sha256 = '0'.repeat(64);
  const result = validateCet4ClosedBetaReadiness(changed, spec, {now: NOW});
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /must not be local or development/);
  assert.match(result.errors.join('\n'), /parent_release_id has an invalid value/);
  assert.match(result.errors.join('\n'), /content\.card_count/);
  assert.match(result.errors.join('\n'), /audio_qc_index_sha256/);
});

test('CLI validates the baseline but require-ready remains fail closed', () => {
  const valid = spawnSync(
    process.execPath,
    ['scripts/validate_cet4_closed_beta_readiness.mjs', '--format', 'json'],
    {cwd: ROOT, encoding: 'utf8'},
  );
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(JSON.parse(valid.stdout).ready, false);

  const requireReady = spawnSync(
    process.execPath,
    [
      'scripts/validate_cet4_closed_beta_readiness.mjs',
      '--format',
      'json',
      '--require-ready',
    ],
    {cwd: ROOT, encoding: 'utf8'},
  );
  assert.equal(requireReady.status, 1);
  assert.equal(JSON.parse(requireReady.stdout).ready, false);
});

test('registered learning evidence validates from tracked raw bytes for the closed-beta target', t => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'softbook-cet4-beta-evidence-'),
  );
  t.after(() => fs.rmSync(tempRoot, {force: true, recursive: true}));
  fs.mkdirSync(path.join(tempRoot, 'spec'), {recursive: true});
  fs.copyFileSync(
    path.join(ROOT, 'spec/cet4-closed-beta-readiness.json'),
    path.join(tempRoot, 'spec/cet4-closed-beta-readiness.json'),
  );
  const semanticContext = loadLaunchEvidenceSemanticContext({root: ROOT});
  assert.equal(semanticContext.ok, true, semanticContext.errors.join('\n'));
  const candidate = validCandidate();
  const evidenceType = 'fsrs-version-lock';
  const rawRelativePath =
    'docs/release/evidence/raw/cet4-beta-fsrs-lock.json';
  const rawPayload = '{"lockfile":"verified"}\n';
  writeFile(tempRoot, rawRelativePath, rawPayload);
  const artifact = validFsrsEvidenceArtifact(
    candidate,
    semanticContext.expectedPolicies['server-scheduler'],
    rawRelativePath,
    rawPayload,
  );
  const artifactRelativePath =
    'docs/release/evidence/cet4-beta-fsrs-version-lock.json';
  const artifactPayload = `${JSON.stringify(artifact, null, 2)}\n`;
  writeFile(tempRoot, artifactRelativePath, artifactPayload);
  const changed = structuredClone(contract);
  changed.release_candidate = candidate;
  const gate = changed.gates.find(
    item => item.id === 'canonical-learning-and-space',
  );
  gate.status = 'in_progress';
  gate.blocked_by = [];
  gate.evidence = [
    {
      type: evidenceType,
      artifact_uri: `repo://${artifactRelativePath}`,
      artifact_sha256: hash(artifactPayload),
      artifact_size_bytes: Buffer.byteLength(artifactPayload),
      verified_at: artifact.verification.verified_at,
      verified_by: artifact.verification.verified_by,
      verification_run_id: artifact.verification.run_id,
      subject_commit_sha: candidate.commit_sha,
    },
  ];
  const trackedFiles = new Set([rawRelativePath, artifactRelativePath]);
  const repositoryResult = verifyCet4ClosedBetaRepositoryEvidence(changed, {
    now: NOW,
    root: tempRoot,
    semanticContext,
    trackedFiles,
    trustedCommits: new Set([candidate.commit_sha]),
  });
  assert.equal(repositoryResult.ok, true, repositoryResult.errors.join('\n'));
  const structural = validateCet4ClosedBetaReadiness(changed, spec, {
    launchContract,
    now: NOW,
    repositoryEvidenceValidated: repositoryResult.ok,
  });
  assert.equal(structural.ok, true, structural.errors.join('\n'));
  assert.equal(structural.ready, false);
  assert.ok(CET4_CLOSED_BETA_SUPPORTED_EVIDENCE_TYPES.includes(evidenceType));

  fs.appendFileSync(path.join(tempRoot, rawRelativePath), '{"tampered":true}\n');
  const tampered = verifyCet4ClosedBetaRepositoryEvidence(changed, {
    now: NOW,
    root: tempRoot,
    semanticContext,
    trackedFiles,
    trustedCommits: new Set([candidate.commit_sha]),
  });
  assert.equal(tampered.ok, false);
  assert.match(tampered.errors.join('\n'), /(byte size|SHA-256) does not match/);
});

test('formal CET4 content semantics recompute the exact corpus and reject attestation or byte drift', t => {
  const fixture = formalContentFixture(t);
  const accepted = loadCet4FormalContentEvidence(fixture.artifact, {
    root: fixture.root,
    trackedFiles: fixture.trackedFiles,
    trustedMediaVerifier: () => ({errors: [], identity_ready: true, ok: true}),
  });
  assert.equal(accepted.ok, true, accepted.errors.join('\n'));
  assert.deepEqual(accepted.evidence, {
    audio_asset_count: 301,
    audio_qc_record_count: 27,
    box_count: 108,
    card_count: 1180,
    content_version: fixture.contentVersion,
    source_commit_sha: fixture.artifact.measurements.source_commit_sha,
  });
  for (const evidenceType of [
    'cet4-approved-box-coverage-report',
    'cet4-approved-card-coverage-report',
    'cet4-audio-qc-coverage-report',
    'cet4-content-pack-integrity-report',
  ]) {
    assert.equal(CET4_CLOSED_BETA_SUPPORTED_EVIDENCE_TYPES.includes(evidenceType), true);
    const candidate = validCandidate();
    candidate.release.content_version = fixture.contentVersion;
    candidate.release.bundle_sha256 = fixture.artifact.subject.release.bundle_sha256;
    const policy = {
      id: 'cet4-closed-beta-readiness-v1',
      sha256: hash(fs.readFileSync(path.join(ROOT, 'spec/cet4-closed-beta-readiness.json'))),
    };
    const outerEvidence = {
      subject_commit_sha: candidate.commit_sha,
      verified_at: '2026-08-23T13:00:00.000Z',
      verified_by: 'agent:closed-beta-auditor',
      verification_run_id: 'closed-beta-content-verification-002',
    };
    const gateArtifact = {
      schema_version: 'launch-gate-evidence.v1',
      campaign_id: 'cet4-formal-content-fixture',
      execution_mode: 'external_assessment',
      gate_eligible: true,
      result: 'passed',
      subject: {
        repository: candidate.repository,
        commit_sha: candidate.commit_sha,
        target_release: candidate.target_release,
        gate_id: 'approved-cet4-content',
        evidence_type: evidenceType,
        policy_id: policy.id,
        policy_sha256: policy.sha256,
        environment: candidate.environment,
        release: candidate.release,
        client_builds: candidate.client_builds,
      },
      execution: {
        started_at: '2026-08-23T10:00:00.000Z',
        completed_at: '2026-08-23T10:10:00.000Z',
        operator: 'service:closed-beta-content-builder',
        run_id: 'closed-beta-content-build-001',
        tool: {name: 'cet4-content-evidence', version: '1.0.0', config_sha256: hash('content-config')},
      },
      verification: {
        verified_at: outerEvidence.verified_at,
        verified_by: outerEvidence.verified_by,
        run_id: outerEvidence.verification_run_id,
        independent: true,
        attestation: {provider: 'github_actions_oidc', id: 'cet4-content-attestation', sha256: hash('content-attestation')},
      },
      raw_artifacts: fixture.artifact.raw_artifacts,
      checks: CET4_FORMAL_CONTENT_REQUIRED_CHECKS[evidenceType].map(id => ({
        id,
        status: 'passed',
        artifact_roles: ['release-bundle'],
      })),
      measurements: fixture.artifact.measurements,
    };
    const semantic = validateGateEvidenceArtifact(gateArtifact, {
      cet4FormalContentEvidence: accepted.evidence,
      evidenceType,
      expectedPolicy: policy,
      expectedSubject: candidate,
      gateId: 'approved-cet4-content',
      now: NOW,
      outerEvidence,
      targetRelease: 'cet4-closed-beta',
    });
    assert.equal(semantic.ok, true, semantic.errors.join('\n'));
  }

  const unattested = loadCet4FormalContentEvidence(fixture.artifact, {
    root: fixture.root,
    trackedFiles: fixture.trackedFiles,
    trustedMediaVerifier: () => ({errors: ['wrong signer'], identity_ready: false, ok: false}),
  });
  assert.equal(unattested.ok, false);
  assert.match(unattested.errors.join('\n'), /attestation is not verified/);

  fs.appendFileSync(fixture.runtimeShardPath, '\n');
  const tampered = loadCet4FormalContentEvidence(fixture.artifact, {
    root: fixture.root,
    trackedFiles: fixture.trackedFiles,
    trustedMediaVerifier: () => ({errors: [], identity_ready: true, ok: true}),
  });
  assert.equal(tampered.ok, false);
  assert.match(tampered.errors.join('\n'), /byte identity does not match/);
});

function validCandidate() {
  return {
    schema_version: 'cet4-closed-beta-release-candidate.v1',
    repository: 'LENKIN233/softbook_cet',
    commit_sha: hash('candidate-commit').slice(0, 40),
    target_release: 'cet4-closed-beta',
    recorded_at: '2026-08-23T12:00:00.000Z',
    recorded_by: 'service:softbook-machine-harness',
    environment: {
      profile_id: 'receiver-cet4-beta-profile',
      profile_sha256: hash('profile'),
      environment_id: 'receiver-cet4-beta',
      class: 'production_like_staging',
      receiver_owned: true,
    },
    release: {
      release_id: 'cet4-beta-b',
      parent_release_id: 'cet4-beta-a',
      content_version: `sha256:${hash('content')}`,
      bundle_sha256: hash('bundle'),
      backend_deployment_id: `backend-deployment:sha256:${hash('backend')}`,
    },
    content: {
      track: 'cet4',
      card_count: 1180,
      box_count: 108,
      audio_asset_count: 301,
      full_track_authorization_sha256: hash('authorization'),
      audio_qc_index_sha256: hash('audio-qc'),
    },
    client_builds: {
      ios: 'ios-private-beta-100',
      android: 'android-private-beta-100',
      pc_web: 'pc-web-closed-beta-100',
    },
    entitlement: {
      mode: 'beta-entitlement.v1',
      campaign_id: 'cet4-beta-entitlement-001',
    },
  };
}

function evidenceRecord(type, index) {
  return {
    type,
    artifact_uri: `repo://docs/release/evidence/cet4-beta-${index}.json`,
    artifact_sha256: hash(`artifact-${type}`),
    artifact_size_bytes: 1024 + index,
    verified_at: '2026-08-23T13:00:00.000Z',
    verified_by: 'agent:closed-beta-auditor',
    verification_run_id: 'closed-beta-verification-run-002',
    subject_commit_sha: hash('candidate-commit').slice(0, 40),
  };
}

function validFsrsEvidenceArtifact(
  candidate,
  expectedPolicy,
  rawRelativePath,
  rawPayload,
) {
  const rawRole = 'raw-fsrs-lock';
  return {
    schema_version: 'learning-runtime-evidence.v1',
    campaign_id: 'cet4-beta-runtime-campaign-001',
    execution_mode: 'receiver_deployed',
    gate_eligible: true,
    result: 'passed',
    subject: {
      repository: candidate.repository,
      commit_sha: candidate.commit_sha,
      target_release: candidate.target_release,
      gate_id: 'canonical-learning-and-space',
      evidence_type: 'fsrs-version-lock',
      policy_id: expectedPolicy.id,
      policy_sha256: expectedPolicy.sha256,
      environment: candidate.environment,
      release: candidate.release,
      client_builds: candidate.client_builds,
    },
    execution: {
      started_at: '2026-08-23T10:00:00.000Z',
      completed_at: '2026-08-23T10:05:00.000Z',
      operator: 'service:closed-beta-release',
      run_id: 'closed-beta-execution-run-001',
      tool: {
        name: 'softbook-evidence-runner',
        version: '1.0.0',
        config_sha256: hash('fsrs-config'),
      },
    },
    verification: {
      verified_at: '2026-08-23T11:00:00.000Z',
      verified_by: 'agent:closed-beta-auditor',
      run_id: 'closed-beta-verification-run-002',
      independent: true,
      attestation: {
        provider: 'model_run',
        id: 'cet4-beta-fsrs-attestation',
        sha256: hash('fsrs-attestation'),
      },
    },
    raw_artifacts: [
      {
        role: rawRole,
        artifact_uri: `repo://${rawRelativePath}`,
        sha256: hash(rawPayload),
        size_bytes: Buffer.byteLength(rawPayload),
      },
    ],
    checks: [
      'exact-library-version',
      'exact-policy-version',
      'fuzz-disabled',
      'lockfile-bound',
    ].map(id => ({id, status: 'passed', artifact_roles: [rawRole]})),
    measurements: {
      algorithm_id: 'FSRS-6',
      library: 'ts-fsrs',
      library_version: '5.4.1',
      policy_version: 'softbook-fsrs.v1',
      fuzz_enabled: false,
      lockfile_sha256: expectedPolicy.lockfile_sha256,
      assertions: {
        exact_runtime_library: true,
        exact_policy: true,
        fuzz_disabled: true,
        lockfile_matches_deployment: true,
      },
    },
  };
}

function formalContentFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-cet4-formal-content-'));
  t.after(() => fs.rmSync(root, {force: true, recursive: true}));
  const trackedFiles = new Set();
  const base = 'docs/release/evidence/raw/cet4-formal-content';
  const cards = Array.from({length: 1180}, (_, index) => {
    const cardId = String(index + 1).padStart(6, '0');
    const box = String(index % 108).padStart(4, '0');
    return {
      card_id: cardId,
      track: 'cet4',
      knowledge_ref: box,
      interaction_id: 'reveal',
      front: {prompt: `Prompt ${cardId}`},
      analysis: {summary: `Analysis ${cardId}`},
      space_metadata: {box_ref: box},
    };
  });
  const assets = Array.from({length: 301}, (_, index) => {
    const cardId = cards[index].card_id;
    const assetId = `cet4-${cardId}-audio`;
    const digest = `sha256:${hash(`audio-${cardId}`)}`;
    cards[index].audio = {
      asset_id: assetId,
      duration_ms: 1000 + index,
      sha256: digest,
      transcript: `Audio transcript ${cardId}`,
    };
    return {
      asset_id: assetId,
      asset_path: `audio/cet4/${cardId.slice(0, 4)}/${cardId}.mp3`,
      duration_ms: 1000 + index,
      media_type: 'audio/mpeg',
      sha256: digest,
      size_bytes: 2000 + index,
    };
  });
  const runtimePayload = {
    source: {id: 'card-make-cet4-formal-candidate', label: 'Card Make CET4 formal candidate'},
    track: 'cet4',
    card_records: cards,
    assets,
    release: null,
  };
  const contentVersion = deriveCardMakeContentVersion(runtimePayload);
  runtimePayload.content_version = contentVersion;
  const shardSlices = [cards.slice(0, 394), cards.slice(394, 787), cards.slice(787)];
  const shardFiles = shardSlices.map((cardRecords, index) =>
    writeEvidence(root, trackedFiles, `${base}/runtime-${index + 1}.json`, {
      schema_version: 'card-make-runtime-card-shard.v1',
      track: 'cet4',
      card_records: cardRecords,
    }, `runtime-shard-${index + 1}`),
  );
  const runtimeManifest = writeEvidence(root, trackedFiles, `${base}/runtime-manifest.json`, {
    schema_version: 'card-make-runtime-payload-manifest.v1',
    source: runtimePayload.source,
    track: 'cet4',
    content_version: contentVersion,
    card_record_shards: shardFiles.map((file, index) => ({
      path: `fixture/runtime-${index + 1}.json`,
      sha256: `sha256:${file.sha256}`,
      card_count: shardSlices[index].length,
      first_card_id: shardSlices[index][0].card_id,
      last_card_id: shardSlices[index].at(-1).card_id,
    })),
    assets,
    release: null,
  }, 'runtime-manifest');
  const content = writeEvidence(root, trackedFiles, `${base}/content.json`, {
    source: runtimePayload.source,
    track: 'cet4',
    card_records: cards,
    assets,
    release: null,
    content_version: contentVersion,
    corpus_fingerprint: `sha256:${hash('corpus')}`,
  }, 'content-payload');
  const cardIds = cards.map(card => card.card_id);
  const boxIds = [...new Set(cards.map(card => card.knowledge_ref))];
  const audit = writeEvidence(root, trackedFiles, `${base}/audit.json`, {
    audit_version: 'card-make-quality-audit-v1',
    report_type: 'scoped_card_quality_audit',
    mode: 'read_only_non_blocking_for_legacy_corpus',
    ok: true,
    corpus_fingerprint: {algorithm: 'sha256', card_count: 2414, digest: hash('corpus')},
    scope: {track: 'cet4', card_ids: cardIds},
    scope_summary: {card_ids: cardIds, card_count: 1180},
    scoped_card_issue_index: {},
    scoped_hard_blocker_issues: [],
  }, 'quality-audit');
  const review = writeEvidence(root, trackedFiles, `${base}/review.json`, {
    schema_version: 'model-owned-full-track-review.v2',
    review_id: 'fixture-full-track-review',
    created_at: '2026-08-29T00:00:00.000Z',
    specs_read: [],
    scope: {track: 'cet4', card_ids: cardIds, box_prefixes: boxIds},
    coverage: {expected_card_count: 1180, reviewed_card_ids: cardIds},
    representative_cards: [],
    quality_audit: {sha256: `sha256:${audit.sha256}`},
    removed_cards: [],
    model_acceptances: perturbationAcceptances([
      'card_semantic_review',
      'source_provenance_review',
    ]),
    batch_review: {
      status: 'ready_for_model_authorization',
      summary: 'Fixture exact scope accepted.',
      remaining_risks: [],
      next_step: 'Authorize exact runtime.',
    },
  }, 'full-track-review');
  const authorization = writeEvidence(root, trackedFiles, `${base}/authorization.json`, {
    schema_version: 'model-owned-content-authorization.v2',
    authorization_id: 'fixture-full-track-authorization',
    authorization_mode: 'full_track',
    authorized_at: '2026-08-29T00:01:00.000Z',
    content_version: contentVersion,
    scope: {track: 'cet4', purpose: 'formal closed beta', card_ids: cardIds, box_prefixes: boxIds},
    summary: 'Fixture exact formal authorization.',
    representative_cards: [],
    card_quality_audit: {
      report: 'fixture/audit.json',
      report_sha256: `sha256:${audit.sha256}`,
      corpus_fingerprint: hash('corpus'),
      scope_has_no_hard_blockers: true,
      scope_summary: {card_count: 1180},
    },
    validation: {
      model_review_sha256: `sha256:${review.sha256}`,
      runtime_payload_sha256: `sha256:${runtimeManifest.sha256}`,
    },
    model_acceptances: perturbationAcceptances(['content_authorization']),
    authorization_limits: ['Exact fixture only.'],
  }, 'content-authorization');
  const sourceCommit = hash('card-make-finalizer').slice(0, 40);
  const receipt = writeEvidence(root, trackedFiles, `${base}/receipt.json`, {
    schema_version: 'trusted-media-run-receipt.v2',
    receipt_id: 'fixture-trusted-media-receipt',
    source: {repository: 'LENKIN233/card-make', commit_sha: hash('execution').slice(0, 40)},
    finalization: {repository: 'LENKIN233/card-make', commit_sha: sourceCommit},
    candidate: {
      track: 'cet4',
      card_count: 1180,
      box_count: 108,
      audio_asset_count: 301,
      content_version: contentVersion,
      content_authorization_sha256: authorization.sha256,
      full_track_review_sha256: review.sha256,
      quality_audit_sha256: audit.sha256,
    },
  }, 'trusted-media-receipt');
  const attestation = writeRawEvidence(
    root,
    trackedFiles,
    `${base}/receipt.attestation.jsonl`,
    `${JSON.stringify({subject: receipt.sha256})}\n`,
    'trusted-media-attestation-bundle',
  );
  const qcFiles = Array.from({length: 27}, (_, index) => {
    const assigned = assets.filter((_, assetIndex) => assetIndex % 27 === index);
    return writeEvidence(root, trackedFiles, `${base}/qc-${index + 1}.json`, {
      schema_version: 'model-owned-audio-qc.v2',
      scope: {card_ids: assigned.map(asset => asset.asset_id.slice(5, 11))},
      verdict: {formal_audio_ready: true, requires_regeneration: false},
      source_records: {
        trusted_media_receipt_sha256: receipt.sha256,
        trusted_media_attestation_bundle_sha256: attestation.sha256,
        trusted_media_source_commit: sourceCommit,
      },
    }, `audio-qc-record-${String(index + 1).padStart(2, '0')}`);
  });
  const audioManifest = writeEvidence(root, trackedFiles, `${base}/audio-manifest.json`, {
    schema_version: 'release-audio-manifest.v1',
    track: 'cet4',
    assets,
  }, 'audio-manifest');
  const audioQcIndex = writeEvidence(root, trackedFiles, `${base}/audio-qc-index.json`, {
    schema_version: 'audio-qc-index.v1',
    track: 'cet4',
    corpus_fingerprint: `sha256:${hash('corpus')}`,
    assets: assets.map((asset, index) => ({
      asset_id: asset.asset_id,
      card_ids: [asset.asset_id.slice(5, 11)],
      record_path: `fixture/qc-${(index % 27) + 1}.json`,
      record_sha256: `sha256:${qcFiles[index % 27].sha256}`,
      reviewed_by: 'agent:fixture-audio-review',
      reviewed_at: '2026-08-29T00:02:00.000Z',
      formal_audio_ready: true,
    })),
  }, 'audio-qc-index');
  const bundle = writeEvidence(root, trackedFiles, `${base}/release-bundle.json`, {
    schema_version: 'release-bundle.v1',
    bundle_id: 'fixture-cet4-bundle',
    release_id: 'fixture-cet4-release',
    track: 'cet4',
    content: {
      payload_sha256: `sha256:${content.sha256}`,
      content_version: contentVersion,
      card_count: 1180,
    },
    approval: {
      record_sha256: `sha256:${authorization.sha256}`,
      model_review_sha256: `sha256:${review.sha256}`,
    },
    audit: {report_sha256: `sha256:${audit.sha256}`},
    audio: {
      manifest_sha256: `sha256:${audioManifest.sha256}`,
      qc_index_sha256: `sha256:${audioQcIndex.sha256}`,
      asset_count: 301,
      qc_passed_count: 301,
    },
  }, 'release-bundle');
  const allFiles = [
    bundle,
    content,
    authorization,
    review,
    audit,
    runtimeManifest,
    ...shardFiles,
    audioManifest,
    audioQcIndex,
    ...qcFiles,
    receipt,
    attestation,
  ];
  const artifact = {
    subject: {release: {content_version: contentVersion, bundle_sha256: bundle.sha256}},
    raw_artifacts: allFiles.map(file => file.artifact),
    measurements: {
      release_bundle_role: bundle.role,
      content_payload_role: content.role,
      authorization_role: authorization.role,
      model_review_role: review.role,
      quality_audit_role: audit.role,
      runtime_manifest_role: runtimeManifest.role,
      runtime_shard_roles: shardFiles.map(file => file.role),
      audio_manifest_role: audioManifest.role,
      audio_qc_index_role: audioQcIndex.role,
      audio_qc_record_roles: qcFiles.map(file => file.role),
      trusted_media_receipt_role: receipt.role,
      trusted_media_attestation_bundle_role: attestation.role,
      source_repository: 'LENKIN233/card-make',
      source_commit_sha: sourceCommit,
      card_count: 1180,
      box_count: 108,
      audio_asset_count: 301,
      audio_qc_record_count: 27,
      assertions: {
        exact_card_scope: true,
        exact_box_scope: true,
        exact_audio_scope: true,
        dual_perturbation_authorization: true,
        trusted_media_attestation: true,
        qc_records_formally_ready: true,
        content_version_recomputed: true,
        bundle_inputs_rehashed: true,
      },
    },
  };
  return {
    artifact,
    contentVersion,
    root,
    runtimeShardPath: shardFiles[0].path,
    trackedFiles,
  };
}

function perturbationAcceptances(capabilities) {
  const input = `sha256:${hash(capabilities.join(':'))}`;
  return ['assumption-inversion', 'failure-projection'].map(pass => ({
    schema_version: 'model-acceptance.v2',
    actor: {kind: 'model_harness', agent: `model:${pass}`, model: 'fixture-model', run_id: `${capabilities[0]}-${pass}`},
    evidence: {reviewed_at: '2026-08-29T00:00:00.000Z', input_sha256: input, capabilities, summary: 'Fixture pass.', findings: []},
    decision: 'accepted',
  }));
}

function writeEvidence(root, trackedFiles, relativePath, value, role) {
  return writeRawEvidence(root, trackedFiles, relativePath, `${JSON.stringify(value, null, 2)}\n`, role, value);
}

function writeRawEvidence(root, trackedFiles, relativePath, payload, role, json = null) {
  writeFile(root, relativePath, payload);
  trackedFiles.add(relativePath);
  const sha256 = hash(payload);
  return {
    artifact: {
      role,
      artifact_uri: `repo://${relativePath}`,
      sha256,
      size_bytes: Buffer.byteLength(payload),
    },
    json,
    path: path.join(root, relativePath),
    role,
    sha256,
  };
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
