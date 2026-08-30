#!/usr/bin/env node

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
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
const require = createRequire(import.meta.url);
const betaRuntime = require('../infra/cloudbase/functions/softbook-api/beta-entitlement-v1.js');
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

test('beta entitlement drill binds grant replay revoke replay to one candidate campaign', () => {
  const fixture = createFixture();
  const result = validateFixture(fixture);
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('beta entitlement drill rejects planned, drifted, non-idempotent and regressing phases', () => {
  const planned = createFixture();
  planned.loaded.grantReport.applied = false;
  assertInvalid(planned, /grant report\.applied/);

  const legacySchema = createFixture();
  legacySchema.loaded.grantReport.schema_version =
    'beta-entitlement-report.v2';
  assertInvalid(legacySchema, /schema_version/);

  const legacyPlanSchema = createFixture();
  legacyPlanSchema.loaded.grantReport.result.schema_version =
    'beta-entitlement-plan.v1';
  assertInvalid(legacyPlanSchema, /result\.schema_version/);

  const campaignDrift = createFixture();
  campaignDrift.loaded.revokeReport.command.campaign_id = 'another-campaign';
  campaignDrift.loaded.revokeReport.result.campaign_id = 'another-campaign';
  assertInvalid(campaignDrift, /campaign_id/);

  const eventDrift = createFixture();
  eventDrift.artifact.measurements.revoke_event_id =
    'beta-event-revoke-other';
  assertInvalid(eventDrift, /revoke event measurement/);

  const crossAccountSplice = createFixture();
  const accountAState = createRuntimeGrantState('13800138000');
  const accountBState = createRuntimeGrantState('13900139000');
  assert.notEqual(accountAState.state_sha256, accountBState.state_sha256);
  crossAccountSplice.loaded.grantReport.beta_state.state_sha256 =
    accountAState.state_sha256;
  crossAccountSplice.loaded.grantReplayReport.beta_state_before.state_sha256 =
    accountAState.state_sha256;
  crossAccountSplice.loaded.grantReplayReport.beta_state.state_sha256 =
    accountAState.state_sha256;
  crossAccountSplice.loaded.revokeReport.beta_state_before.state_sha256 =
    accountBState.state_sha256;
  assertInvalid(crossAccountSplice, /revoke input chain\.state_sha256/);

  const backendDrift = createFixture();
  backendDrift.loaded.grantReport.preflight.backend_deployment.backend_deployment_id =
    `backend-deployment:sha256:${hash('other-backend')}`;
  assertInvalid(backendDrift, /backend_deployment\.backend_deployment_id/);

  const missingRemoteSecret = createFixture();
  missingRemoteSecret.loaded.grantReport.preflight.backend_deployment.variable_names =
    missingRemoteSecret.loaded.grantReport.preflight.backend_deployment.variable_names.filter(
      name => name !== 'SOFTBOOK_BETA_OPERATOR_SECRET',
    );
  assertInvalid(missingRemoteSecret, /must bind the beta secret and release class/);

  for (const [field, value] of [
    ['actor_id', 'service:model-138-0013-8000'],
    ['actor_id', 'service:model-138a0013b8000'],
    ['actor_id', 'service:１３８００１３８０００'],
    ['campaign_id', 'campaign-138-0013-8000'],
    ['event_id', 'event-138-0013-8000'],
    ['grant_id', 'grant-138-0013-8000'],
  ]) {
    const phoneIdentifier = createFixture();
    phoneIdentifier.loaded.grantReport.command[field] = value;
    phoneIdentifier.loaded.grantReport.result[field] = value;
    assertInvalid(phoneIdentifier, /phone-number material/);
  }

  const legacyFingerprint = createFixture();
  legacyFingerprint.artifact.measurements.account_fingerprint =
    `sha256:${hash('legacy-phone-derived-value').slice(0, 16)}`;
  assertInvalid(legacyFingerprint, /contain exactly/);

  const legacyReportFingerprint = createFixture();
  legacyReportFingerprint.loaded.grantReport.command.account_fingerprint =
    `sha256:${hash('legacy-report-value').slice(0, 16)}`;
  assertInvalid(legacyReportFingerprint, /command must contain exactly/);

  const replayWrites = createFixture();
  replayWrites.loaded.grantReplayReport.result.changed = true;
  replayWrites.loaded.grantReplayReport.writes_performed = true;
  assertInvalid(replayWrites, /(changed|writes_performed)/);

  const baseDrift = createFixture();
  baseDrift.loaded.revokeReport.base_membership.before_sha256 = digest('other-base');
  baseDrift.loaded.revokeReport.base_membership.after_sha256 = digest('other-base');
  assertInvalid(baseDrift, /base membership campaign parity/);

  const revisionGap = createFixture();
  revisionGap.loaded.revokeReport.beta_state.revision += 1;
  revisionGap.loaded.revokeReport.beta_state.audit_event_count += 1;
  assertInvalid(revisionGap, /revoke revision/);

  const wrongNode = createFixture();
  wrongNode.loaded.grantReport.write_safety.node_version = '24.15.0';
  assertInvalid(wrongNode, /node_version/);
});

test('tracked beta entitlement drill validates end to end and raw tamper fails', t => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'softbook-beta-entitlement-drill-evidence-'),
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
  const artifactRelativePath =
    'docs/release/evidence/beta-entitlement-drill.json';
  const artifactPayload = `${JSON.stringify(fixture.artifact, null, 2)}\n`;
  writeFile(tempRoot, artifactRelativePath, artifactPayload);
  trackedFiles.add(artifactRelativePath);
  const contract = structuredClone(readinessState);
  contract.release_candidate = fixture.candidate;
  const gate = contract.gates.find(item => item.id === 'beta-entitlement');
  gate.status = 'in_progress';
  gate.blocked_by = [];
  gate.evidence = [
    {
      type: 'beta-entitlement-drill',
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

  const grantPath = path.join(tempRoot, fixture.rolePaths.get('grant-report'));
  fs.appendFileSync(grantPath, '{"tampered":true}\n');
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
  const commit = hash('beta-drill-commit').slice(0, 40);
  const campaignId = 'cet4-beta-campaign-001';
  const grantId = 'cet4-beta-grant-0001';
  const operator = 'service:receiver-beta-operator';
  const backendDeploymentId = `backend-deployment:sha256:${hash('backend')}`;
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
  const common = {
    commit,
    environmentId: profile.environment_id,
    profileHash,
    profileId: profile.profile_id,
    campaignId,
    backendDeploymentId,
    grantId,
    operator,
  };
  const grantReport = createPhaseReport(common, {
    action: 'grant',
    active: true,
    auditCount: 3,
    beforeActive: false,
    beforeAuditCount: 2,
    beforeRevision: 2,
    beforeStateHash: digest('pre-grant-state'),
    changed: true,
    commandHmac: hmacDigest('grant-command'),
    completedAt: '2026-08-23T09:01:00.000Z',
    eventId: 'beta-event-grant-0001',
    idempotent: false,
    previousStage: 'free',
    resultingStage: 'premium',
    revision: 3,
    startedAt: '2026-08-23T09:00:00.000Z',
    stateHash: digest('grant-state'),
    writesPerformed: true,
  });
  const grantReplayReport = createPhaseReport(common, {
    action: 'grant',
    active: true,
    auditCount: 3,
    beforeActive: true,
    beforeAuditCount: 3,
    beforeRevision: 3,
    beforeStateHash: digest('grant-state'),
    changed: false,
    commandHmac: hmacDigest('grant-command'),
    completedAt: '2026-08-23T09:03:00.000Z',
    eventId: 'beta-event-grant-0001',
    idempotent: true,
    previousStage: 'free',
    resultingStage: 'premium',
    revision: 3,
    startedAt: '2026-08-23T09:02:00.000Z',
    stateHash: digest('grant-state'),
    writesPerformed: false,
  });
  const revokeReport = createPhaseReport(common, {
    action: 'revoke',
    active: false,
    auditCount: 4,
    beforeActive: true,
    beforeAuditCount: 3,
    beforeRevision: 3,
    beforeStateHash: digest('grant-state'),
    changed: true,
    commandHmac: hmacDigest('revoke-command'),
    completedAt: '2026-08-23T09:05:00.000Z',
    eventId: 'beta-event-revoke-0001',
    idempotent: false,
    previousStage: 'premium',
    resultingStage: 'free',
    revision: 4,
    startedAt: '2026-08-23T09:04:00.000Z',
    stateHash: digest('revoke-state'),
    writesPerformed: true,
  });
  const revokeReplayReport = createPhaseReport(common, {
    action: 'revoke',
    active: false,
    auditCount: 4,
    beforeActive: false,
    beforeAuditCount: 4,
    beforeRevision: 4,
    beforeStateHash: digest('revoke-state'),
    changed: false,
    commandHmac: hmacDigest('revoke-command'),
    completedAt: '2026-08-23T09:07:00.000Z',
    eventId: 'beta-event-revoke-0001',
    idempotent: true,
    previousStage: 'premium',
    resultingStage: 'free',
    revision: 4,
    startedAt: '2026-08-23T09:06:00.000Z',
    stateHash: digest('revoke-state'),
    writesPerformed: false,
  });
  const rolePaths = new Map([
    ['profile', 'docs/release/evidence/raw/beta/profile.json'],
    ['grant-report', 'docs/release/evidence/raw/beta/grant.json'],
    ['grant-replay-report', 'docs/release/evidence/raw/beta/grant-replay.json'],
    ['revoke-report', 'docs/release/evidence/raw/beta/revoke.json'],
    ['revoke-replay-report', 'docs/release/evidence/raw/beta/revoke-replay.json'],
  ]);
  const rawValues = new Map([
    ['profile', profile],
    ['grant-report', grantReport],
    ['grant-replay-report', grantReplayReport],
    ['revoke-report', revokeReport],
    ['revoke-replay-report', revokeReplayReport],
  ]);
  const rawHashes = new Map(
    [...rawValues].map(([role, value]) => [
      role,
      hash(`${JSON.stringify(value, null, 2)}\n`),
    ]),
  );
  const candidate = createCandidate({
    backendDeploymentId,
    campaignId,
    commit,
    profile,
    profileHash,
  });
  const policyHash = hash(
    fs.readFileSync(path.join(ROOT, 'spec/cet4-closed-beta-readiness.json')),
  );
  const artifact = {
    schema_version: 'launch-gate-evidence.v1',
    campaign_id: 'beta-entitlement-drill-001',
    execution_mode: 'receiver_deployed',
    gate_eligible: true,
    result: 'passed',
    subject: {
      repository: candidate.repository,
      commit_sha: commit,
      target_release: candidate.target_release,
      gate_id: 'beta-entitlement',
      evidence_type: 'beta-entitlement-drill',
      policy_id: 'cet4-closed-beta-readiness-v1',
      policy_sha256: policyHash,
      environment: candidate.environment,
      release: candidate.release,
      client_builds: candidate.client_builds,
    },
    execution: {
      started_at: '2026-08-23T08:59:00.000Z',
      completed_at: '2026-08-23T09:08:00.000Z',
      operator,
      run_id: 'beta-entitlement-execution-run-001',
      tool: {
        name: 'softbook-evidence-runner',
        version: '1.0.0',
        config_sha256: hash('beta-drill-config'),
      },
    },
    verification: {
      verified_at: '2026-08-23T10:00:00.000Z',
      verified_by: 'model:beta-entitlement-auditor',
      run_id: 'beta-entitlement-verification-run-002',
      independent: true,
      attestation: {
        provider: 'model_run',
        id: 'beta-entitlement-attestation',
        sha256: hash('beta-entitlement-attestation'),
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
      'grant-applied-and-verified',
      'grant-replay-idempotent',
      'revoke-applied-and-verified',
      'revoke-replay-idempotent',
      'campaign-grant-event-and-base-membership-bound',
    ].map(id => ({
      id,
      status: 'passed',
      artifact_roles: [...rolePaths.keys()],
    })),
    measurements: {
      profile_role: 'profile',
      grant_report_role: 'grant-report',
      grant_replay_report_role: 'grant-replay-report',
      revoke_report_role: 'revoke-report',
      revoke_replay_report_role: 'revoke-replay-report',
      campaign_id: campaignId,
      grant_id: grantId,
      grant_event_id: 'beta-event-grant-0001',
      revoke_event_id: 'beta-event-revoke-0001',
      assertions: {
        grant_applied_and_verified: true,
        grant_replay_idempotent: true,
        revoke_applied_and_verified: true,
        revoke_replay_idempotent: true,
        base_membership_unchanged: true,
        same_campaign_grant_and_candidate: true,
      },
    },
  };
  return {
    artifact,
    candidate,
    loaded: {
      profile,
      grantReport,
      grantReplayReport,
      revokeReport,
      revokeReplayReport,
    },
    rawValues,
    rolePaths,
  };
}

function createPhaseReport(
  common,
  {
    action,
    active,
    auditCount,
    beforeActive,
    beforeAuditCount,
    beforeRevision,
    beforeStateHash,
    changed,
    commandHmac,
    completedAt,
    eventId,
    idempotent,
    previousStage,
    resultingStage,
    revision,
    startedAt,
    stateHash,
    writesPerformed,
  },
) {
  const command = {
    action,
    actor_id: common.operator,
    campaign_id: common.campaignId,
    command_hmac_sha256: commandHmac,
    event_id: eventId,
    grant_id: common.grantId,
  };
  return {
    schema_version: 'beta-entitlement-report.v3',
    applied: true,
    backend_deployment_id: common.backendDeploymentId,
    gate_eligible: false,
    repository_commit: common.commit,
    profile: {
      environment_id: common.environmentId,
      profile_id: common.profileId,
      profile_sha256: `sha256:${common.profileHash}`,
      runtime_mode: 'closed_beta',
    },
    command,
    preflight: {
      backend_deployment: {
        backend_deployment_id: common.backendDeploymentId,
        function_name: 'softbook-api',
        handler: 'index.main',
        release_class: 'closed_beta',
        runtime: 'Nodejs20.19',
        runtime_mode: 'production',
        signing_key_id: 'receiver-signing-key-v1',
        sms_provider: 'webhook',
        store_mode: 'cloudbase',
        timeout: 10,
        variable_names: [
          'SOFTBOOK_BACKEND_DEPLOYMENT_ID',
          'SOFTBOOK_BETA_OPERATOR_SECRET',
          'SOFTBOOK_RELEASE_CLASS',
        ],
      },
      backend_deployment_verified: true,
      errors: [],
      required_collections_present: true,
    },
    write_safety: {
      errors: [],
      ok: true,
      branch: 'main',
      dirty: false,
      head: common.commit,
      originMain: common.commit,
      node_version: '22.13.0',
    },
    base_membership: {
      before_sha256: digest('base-membership'),
      after_sha256: digest('base-membership'),
      unchanged: true,
    },
    beta_state_before: {
      active: beforeActive,
      active_campaign_id: beforeActive ? common.campaignId : null,
      active_grant_id: beforeActive ? common.grantId : null,
      audit_event_count: beforeAuditCount,
      revision: beforeRevision,
      state_sha256: beforeStateHash,
    },
    beta_state: {
      active,
      active_campaign_id: active ? common.campaignId : null,
      active_grant_id: active ? common.grantId : null,
      audit_event_count: auditCount,
      revision,
      state_sha256: stateHash,
    },
    result: {
      schema_version: 'beta-entitlement-plan.v2',
      action: command.action,
      actor_id: command.actor_id,
      campaign_id: command.campaign_id,
      changed,
      event_id: command.event_id,
      grant_id: command.grant_id,
      idempotent,
      previous_stage: previousStage,
      resulting_stage: resultingStage,
    },
    status: 'passed',
    writes_performed: writesPerformed,
    execution: {
      completed_at: completedAt,
      operator: common.operator,
      started_at: startedAt,
    },
  };
}

function createCandidate({
  backendDeploymentId,
  commit,
  profile,
  profileHash,
  campaignId,
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
      content_version: digest('content-version'),
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
      campaign_id: campaignId,
    },
  };
}

function validateFixture(fixture) {
  return validateGateEvidenceArtifact(fixture.artifact, {
    evidenceType: 'beta-entitlement-drill',
    expectedPolicy: {
      id: 'cet4-closed-beta-readiness-v1',
      sha256: fixture.artifact.subject.policy_sha256,
    },
    expectedSubject: fixture.candidate,
    gateId: 'beta-entitlement',
    now: NOW,
    outerEvidence: {
      type: 'beta-entitlement-drill',
      subject_commit_sha: fixture.candidate.commit_sha,
      verified_at: fixture.artifact.verification.verified_at,
      verified_by: fixture.artifact.verification.verified_by,
      verification_run_id: fixture.artifact.verification.run_id,
    },
    betaEntitlementDrillEvidence: fixture.loaded,
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
  for (const role of [
    'grant-report',
    'grant-replay-report',
    'revoke-report',
    'revoke-replay-report',
  ]) {
    fixture.rawValues.get(role).profile.profile_sha256 = `sha256:${byRole.get('profile')}`;
  }
}

function writeFile(root, relativePath, payload) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, payload);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function createRuntimeGrantState(phoneNumber) {
  const plan = betaRuntime.planBetaEntitlementMutation(
    {
      schema_version: 'beta-entitlement-command.v1',
      event_id: 'beta-event-grant-0001',
      expected_account_instance_id: `account_${'a'.repeat(24)}`,
      action: 'grant',
      phone_number: phoneNumber,
      campaign_id: 'cet4-beta-campaign-001',
      grant_id: 'cet4-beta-grant-0001',
      actor_id: 'service:receiver-beta-operator',
      reason: 'closed_beta_access',
      occurred_at: '2026-08-23T09:00:00.000Z',
    },
    null,
    {
      counted_entry_count: 1,
      last_experience_ended_by: 'trial',
      recovery_prompt_visible: true,
      stage: 'free',
      trial_duration_days: 5,
      trial_expires_at: '2026-08-20T09:00:00.000Z',
      trial_started_at: '2026-08-15T09:00:00.000Z',
      trial_started_at_entry_count: 1,
    },
  );
  return betaRuntime.publicBetaEntitlementState(plan.document);
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function digest(value) {
  return `sha256:${hash(value)}`;
}

function hmacDigest(value) {
  return `hmac-sha256:${hash(value)}`;
}
