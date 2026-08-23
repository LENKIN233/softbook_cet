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

test('formal CET4 media evidence remains ineligible without trusted receipt semantics', t => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'softbook-cet4-beta-unregistered-'),
  );
  t.after(() => fs.rmSync(tempRoot, {force: true, recursive: true}));
  fs.mkdirSync(path.join(tempRoot, 'spec'), {recursive: true});
  fs.copyFileSync(
    path.join(ROOT, 'spec/cet4-closed-beta-readiness.json'),
    path.join(tempRoot, 'spec/cet4-closed-beta-readiness.json'),
  );
  const candidate = validCandidate();
  const artifactRelativePath =
    'docs/release/evidence/cet4-content-pack-integrity.json';
  const artifact = {
    schema_version: 'launch-gate-evidence.v1',
    subject: {commit_sha: candidate.commit_sha},
    raw_artifacts: [],
  };
  const payload = `${JSON.stringify(artifact, null, 2)}\n`;
  writeFile(tempRoot, artifactRelativePath, payload);
  const changed = structuredClone(contract);
  changed.release_candidate = candidate;
  const gate = changed.gates.find(item => item.id === 'approved-cet4-content');
  gate.status = 'in_progress';
  gate.blocked_by = [];
  gate.evidence = [
    {
      type: 'cet4-content-pack-integrity-report',
      artifact_uri: `repo://${artifactRelativePath}`,
      artifact_sha256: hash(payload),
      artifact_size_bytes: Buffer.byteLength(payload),
      verified_at: '2026-08-23T13:00:00.000Z',
      verified_by: 'agent:closed-beta-auditor',
      subject_commit_sha: candidate.commit_sha,
    },
  ];
  const result = verifyCet4ClosedBetaRepositoryEvidence(changed, {
    now: NOW,
    root: tempRoot,
    semanticContext: loadLaunchEvidenceSemanticContext({root: ROOT}),
    trackedFiles: new Set([artifactRelativePath]),
    trustedCommits: new Set([candidate.commit_sha]),
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /no registered CET4 closed-beta type-specific semantic contract/);
  assert.equal(
    CET4_CLOSED_BETA_SUPPORTED_EVIDENCE_TYPES.includes(
      'cet4-content-pack-integrity-report',
    ),
    false,
  );
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
