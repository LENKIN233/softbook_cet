#!/usr/bin/env node

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {validateGateEvidenceArtifact} from './lib/launch_evidence_contract.mjs';
import {loadLaunchEvidenceSemanticContext} from './validate_launch_readiness.mjs';
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

test('Space sync evidence binds exact candidate and recomputes cross-client revision sequence', () => {
  const fixture = createFixture();
  const result = validateFixture(fixture);
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('Space sync evidence rejects plan, backend, content, revision and cleanup drift', () => {
  const planned = createFixture();
  planned.loaded.spaceReport.applied = false;
  assertInvalid(planned, /report\.applied/);

  const backend = createFixture();
  backend.loaded.spaceReport.expected_backend_deployment_id =
    `backend-deployment:sha256:${hash('wrong-backend')}`;
  assertInvalid(backend, /expected_backend_deployment_id/);

  const content = createFixture();
  content.loaded.spaceReport.scope.content_version = digest('wrong-content');
  assertInvalid(content, /content_version/);

  const replay = createFixture();
  replay.loaded.spaceReport.observations.favorite_replay_revision += 1;
  assertInvalid(replay, /favorite_replay_revision/);

  const cleanup = createFixture();
  cleanup.loaded.spaceReport.observations.final_state.favorite = true;
  assertInvalid(cleanup, /final_state.favorite/);
});

test('tracked Space sync evidence validates end to end and raw tamper fails', t => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'softbook-space-sync-evidence-'),
  );
  t.after(() => fs.rmSync(tempRoot, {recursive: true, force: true}));
  fs.mkdirSync(path.join(tempRoot, 'spec'), {recursive: true});
  fs.copyFileSync(
    path.join(ROOT, 'spec/cet4-closed-beta-readiness.json'),
    path.join(tempRoot, 'spec/cet4-closed-beta-readiness.json'),
  );
  const fixture = createFixture();
  const trackedFiles = new Set();
  for (const rawArtifact of fixture.artifact.raw_artifacts) {
    const relativePath = rawArtifact.artifact_uri.slice('repo://'.length);
    const payload = `${JSON.stringify(fixture.rawValues.get(rawArtifact.role), null, 2)}\n`;
    writeFile(tempRoot, relativePath, payload);
    rawArtifact.sha256 = hash(payload);
    rawArtifact.size_bytes = Buffer.byteLength(payload);
    trackedFiles.add(relativePath);
  }
  bindRawHashes(fixture);
  const artifactRelativePath = 'docs/release/evidence/space-sync-test.json';
  const artifactPayload = `${JSON.stringify(fixture.artifact, null, 2)}\n`;
  writeFile(tempRoot, artifactRelativePath, artifactPayload);
  trackedFiles.add(artifactRelativePath);
  const contract = structuredClone(readinessState);
  contract.release_candidate = fixture.candidate;
  const gate = contract.gates.find(
    item => item.id === 'canonical-learning-and-space',
  );
  gate.status = 'in_progress';
  gate.blocked_by = [];
  gate.evidence = [
    {
      type: 'space-sync-test',
      artifact_uri: `repo://${artifactRelativePath}`,
      artifact_sha256: hash(artifactPayload),
      artifact_size_bytes: Buffer.byteLength(artifactPayload),
      verified_at: fixture.artifact.verification.verified_at,
      verified_by: fixture.artifact.verification.verified_by,
      verification_run_id: fixture.artifact.verification.run_id,
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

  const reportPath = path.join(
    tempRoot,
    fixture.rolePaths.get('space-report'),
  );
  fs.appendFileSync(reportPath, '{"tampered":true}\n');
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

function createFixture() {
  const commit = hash('space-sync-commit').slice(0, 40);
  const contentVersion = digest('space-content');
  const backendDeploymentId =
    `backend-deployment:sha256:${hash('space-backend')}`;
  const profile = {
    schema_version: 'delivery-profile.v1',
    profile_id: 'receiver-cet4-beta',
    environment_id: 'receiver-cet4-beta',
    region: 'ap-shanghai',
    api_base_url: 'https://receiver.example/softbook-api',
    runtime_mode: 'closed_beta',
    enabled_tracks: ['cet4'],
    minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
    signing_key_id: 'receiver-signing-key-v1',
  };
  const profileHash = hash(`${JSON.stringify(profile, null, 2)}\n`);
  const candidate = createCandidate({
    backendDeploymentId,
    commit,
    contentVersion,
    profile,
    profileHash,
  });
  const spaceReport = createSpaceReport({
    backendDeploymentId,
    commit,
    contentVersion,
    profile,
    profileHash,
  });
  const rolePaths = new Map([
    ['profile', 'docs/release/evidence/raw/space/profile.json'],
    ['space-report', 'docs/release/evidence/raw/space/report.json'],
  ]);
  const rawValues = new Map([
    ['profile', profile],
    ['space-report', spaceReport],
  ]);
  const rawHashes = new Map(
    [...rawValues].map(([role, value]) => [
      role,
      hash(`${JSON.stringify(value, null, 2)}\n`),
    ]),
  );
  const policyHash = hash(
    fs.readFileSync(path.join(ROOT, 'spec/cet4-closed-beta-readiness.json')),
  );
  const artifact = {
    schema_version: 'launch-gate-evidence.v1',
    campaign_id: 'space-sync-campaign-001',
    execution_mode: 'receiver_deployed',
    gate_eligible: true,
    result: 'passed',
    subject: {
      repository: candidate.repository,
      commit_sha: commit,
      target_release: candidate.target_release,
      gate_id: 'canonical-learning-and-space',
      evidence_type: 'space-sync-test',
      policy_id: 'cet4-closed-beta-readiness-v1',
      policy_sha256: policyHash,
      environment: candidate.environment,
      release: candidate.release,
      client_builds: candidate.client_builds,
    },
    execution: {
      started_at: '2026-08-23T09:00:00.000Z',
      completed_at: '2026-08-23T09:20:00.000Z',
      operator: 'service:space-auditor',
      run_id: 'space-sync-execution-run-001',
      tool: {
        name: 'softbook-evidence-runner',
        version: '1.0.0',
        config_sha256: hash('space-sync-config'),
      },
    },
    verification: {
      verified_at: '2026-08-23T10:00:00.000Z',
      verified_by: 'model:space-auditor',
      run_id: 'space-sync-verification-run-002',
      independent: true,
      attestation: {
        provider: 'model_run',
        id: 'space-sync-attestation',
        sha256: hash('space-sync-attestation'),
      },
    },
    raw_artifacts: [...rolePaths].map(([role, relativePath]) => ({
      role,
      artifact_uri: `repo://${relativePath}`,
      sha256: rawHashes.get(role),
      size_bytes: Buffer.byteLength(
        `${JSON.stringify(rawValues.get(role), null, 2)}\n`,
      ),
    })),
    checks: [
      'two-client-canonical-convergence',
      'duplicate-and-conflict-no-commit',
      'independent-favorite-sleep-merge',
      'exact-space-revision-sequence',
      'initial-space-state-restored',
    ].map(id => ({
      id,
      status: 'passed',
      artifact_roles: [...rolePaths.keys()],
    })),
    measurements: {
      profile_role: 'profile',
      space_report_role: 'space-report',
      content_version: contentVersion,
      expected_backend_deployment_id: backendDeploymentId,
      assertions: {
        report_applied_on_receiver: true,
        same_account_distinct_clients: true,
        exact_revision_sequence: true,
        idempotency_and_conflict_no_commit: true,
        independent_dimensions: true,
        initial_state_restored: true,
        raw_report_gate_ineligible: true,
      },
    },
  };
  return {
    artifact,
    candidate,
    loaded: {profile, spaceReport},
    rawValues,
    rolePaths,
  };
}

function createSpaceReport({
  backendDeploymentId,
  commit,
  contentVersion,
  profile,
  profileHash,
}) {
  return {
    schema_version: 'space-sync-drill-report.v1',
    applied: true,
    gate_eligible: false,
    repository_commit: commit,
    expected_backend_deployment_id: backendDeploymentId,
    profile: {
      environment_id: profile.environment_id,
      profile_id: profile.profile_id,
      profile_sha256: `sha256:${profileHash}`,
      runtime_mode: 'closed_beta',
    },
    write_safety: {
      errors: [],
      ok: true,
      branch: 'main',
      dirty: false,
      head: commit,
      originMain: commit,
      node_version: '22.13.0',
    },
    scope: {
      card_id_sha256: digest('card-id'),
      content_version: contentVersion,
      track: 'cet4',
    },
    clients: {distinct_sessions: true, secret_values_reported: false},
    observations: {
      initial_revision: 10,
      favorite_applied_revision: 11,
      favorite_replay_revision: 11,
      conflict_rejected_revision: 11,
      sleep_applied_revision: 12,
      favorite_restored_revision: 13,
      final_restored_revision: 14,
      initial_state: {favorite: false, sleep: false},
      toggled_state: {favorite: true, sleep: true},
      final_state: {favorite: false, sleep: false},
      favorite_action_sha256: digest('favorite-action'),
      sleep_action_sha256: digest('sleep-action'),
      favorite_restore_action_sha256: digest('favorite-restore'),
      sleep_restore_action_sha256: digest('sleep-restore'),
      favorite_apply_status: 'applied',
      favorite_replay_status: 'duplicate',
      conflict_status: 'space_action_id_conflict',
      sleep_apply_status: 'applied',
      favorite_restore_status: 'applied',
      sleep_restore_status: 'applied',
    },
    assertions: {
      same_account_distinct_clients: true,
      canonical_revision_incremented_once_per_new_action: true,
      duplicate_did_not_increment_revision: true,
      conflicting_replay_committed_nothing: true,
      favorite_and_sleep_merged_independently: true,
      both_clients_observed_canonical_state: true,
      initial_state_restored: true,
    },
    status: 'passed',
    remote_requests_performed: true,
    remote_writes_performed: true,
    execution: {
      started_at: '2026-08-23T09:01:00.000Z',
      completed_at: '2026-08-23T09:19:00.000Z',
      operator: 'service:space-auditor',
    },
  };
}

function createCandidate({
  backendDeploymentId,
  commit,
  contentVersion,
  profile,
  profileHash,
}) {
  return {
    schema_version: 'cet4-closed-beta-release-candidate.v1',
    repository: 'LENKIN233/softbook_cet',
    commit_sha: commit,
    target_release: 'cet4-closed-beta',
    recorded_at: '2026-08-23T08:00:00.000Z',
    recorded_by: 'service:softbook-machine-harness',
    environment: {
      profile_id: profile.profile_id,
      profile_sha256: profileHash,
      environment_id: profile.environment_id,
      class: 'production_like_staging',
      receiver_owned: true,
    },
    release: {
      release_id: 'cet4-release-b',
      parent_release_id: 'cet4-release-a',
      content_version: contentVersion,
      bundle_sha256: hash('bundle'),
      backend_deployment_id: backendDeploymentId,
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
      ios: 'ios-build-1',
      android: 'android-build-1',
      pc_web: 'web-build-1',
    },
    entitlement: {
      mode: 'beta-entitlement.v1',
      campaign_id: 'beta-campaign-1',
    },
  };
}

function validateFixture(fixture) {
  return validateGateEvidenceArtifact(fixture.artifact, {
    evidenceType: 'space-sync-test',
    expectedPolicy: {
      id: 'cet4-closed-beta-readiness-v1',
      sha256: fixture.artifact.subject.policy_sha256,
    },
    expectedSubject: fixture.candidate,
    gateId: 'canonical-learning-and-space',
    now: NOW,
    outerEvidence: {
      type: 'space-sync-test',
      subject_commit_sha: fixture.candidate.commit_sha,
      verified_at: fixture.artifact.verification.verified_at,
      verified_by: fixture.artifact.verification.verified_by,
      verification_run_id: fixture.artifact.verification.run_id,
    },
    spaceSyncEvidence: fixture.loaded,
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
  fixture.rawValues.get('space-report').profile.profile_sha256 =
    `sha256:${byRole.get('profile')}`;
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

function digest(value) {
  return `sha256:${hash(value)}`;
}
