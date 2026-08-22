#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  EXTERNAL_ACCOUNT_DEFINITIONS,
  GATE_DEFINITIONS,
  loadLaunchEvidenceSemanticContext,
  validateExternalCapabilityEvidenceArtifact,
  validateExternalAccountReadiness,
  validateLaunchReadiness,
  verifyRepositoryEvidenceFiles,
} from './validate_launch_readiness.mjs';
import {
  REQUIRED_EVIDENCE_CHECKS,
  validateGateEvidenceArtifact,
  validateGateEvidenceCoherence,
  validateReleaseOperationalPolicy,
} from './lib/launch_evidence_contract.mjs';
import {parseStrictJson} from './lib/strict_json.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOW = new Date('2026-07-14T00:00:00.000Z');
const TEST_COMMIT_SHA = hash('repository-commit').slice(0, 40);
const TRUSTED_COMMITS = new Set([TEST_COMMIT_SHA]);
const launchContract = readJson(
  path.join(ROOT, 'docs', 'release', 'launch-readiness.v1.json'),
);
const accountsContract = readJson(
  path.join(ROOT, 'docs', 'release', 'external-account-readiness.v1.json'),
);
const semanticContext = loadLaunchEvidenceSemanticContext({root: ROOT});

test('tracked contracts are structurally valid and honestly not ready', () => {
  const launch = validateLaunchReadiness(launchContract, { now: NOW });
  const accounts = validateExternalAccountReadiness(
    accountsContract,
    launchContract,
    { now: NOW },
  );

  assert.equal(launch.ok, true, launch.errors.join('\n'));
  assert.equal(launch.ready, false);
  assert.ok(launch.summary.blocked > 0);
  assert.equal(accounts.ok, true, accounts.errors.join('\n'));
  assert.equal(accounts.ready, false);
});

test('release operational policy is valid and cannot be weakened in place', () => {
  assert.equal(semanticContext.ok, true, semanticContext.errors.join('\n'));
  const policy = structuredClone(semanticContext.releaseOperationalPolicy);
  policy.load_test.minimum_request_count = 1;
  policy.availability.minimum_availability_ratio = 0.9;
  policy.backup_restore.maximum_rto_seconds = 86400;
  policy.backup_restore.all_required_source_datasets_must_be_nonempty = false;
  policy.common_binding.require_repository_raw_artifacts_only = false;
  policy.external_capability.required_checks[
    'apple-developer'
  ]['app-store-connect'] = ['team-access-confirmed'];

  const result = validateReleaseOperationalPolicy(policy);

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /minimum_request_count must be at least 10000/);
  assert.match(
    result.errors.join('\n'),
    /minimum_availability_ratio must be at least 0.999/,
  );
  assert.match(result.errors.join('\n'), /maximum_rto_seconds must be at most 3600/);
  assert.match(
    result.errors.join('\n'),
    /all_required_source_datasets_must_be_nonempty must be true/,
  );
  assert.match(
    result.errors.join('\n'),
    /require_repository_raw_artifacts_only must be true/,
  );
  assert.match(
    result.errors.join('\n'),
    /external_capability.*app-store-connect must contain exactly/,
  );
});

test('strict JSON rejects duplicate keys, BOM, and trailing content without prototype mutation', () => {
  assert.throws(
    () => parseStrictJson('{"result":"passed","result":"failed"}', 'evidence'),
    /duplicate object key/,
  );
  assert.throws(
    () => parseStrictJson(Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]), 'evidence'),
    /must not contain a UTF-8 BOM/,
  );
  assert.deepEqual(parseStrictJson('[]', 'evidence'), []);
  const prototypeKey = parseStrictJson(
    '{"__proto__":{"gate_eligible":true}}',
    'evidence',
  );
  assert.equal(Object.getPrototypeOf(prototypeKey), Object.prototype);
  assert.equal(Object.hasOwn(prototypeKey, '__proto__'), true);
  assert.equal(prototypeKey.gate_eligible, undefined);
  assert.throws(() => parseStrictJson('{} false', 'evidence'), /trailing content/);
});

test('formal approval policy cannot be replaced by pull request metadata', () => {
  const invalid = structuredClone(launchContract);
  invalid.formal_approval.provider = 'self_declared_record';
  invalid.formal_approval.environment = 'unprotected';
  invalid.formal_approval.required_reviewer = 'github:pull-request-author';
  invalid.formal_approval.administrators_can_bypass = true;

  const result = validateLaunchReadiness(invalid, { now: NOW });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /formal_approval.provider/);
  assert.match(result.errors.join('\n'), /formal_approval.environment/);
  assert.match(result.errors.join('\n'), /formal_approval.required_reviewer/);
  assert.match(result.errors.join('\n'), /formal_approval.administrators_can_bypass/);
});

test('all fixed product scope, gates, accounts, and capabilities can be structurally ready', () => {
  const { accounts, launch } = createReadyContracts();

  const launchResult = validateLaunchReadiness(launch, { now: NOW });
  const accountResult = validateExternalAccountReadiness(accounts, launch, {
    now: NOW,
  });

  assert.equal(launchResult.ok, true, launchResult.errors.join('\n'));
  assert.equal(launchResult.ready, true);
  assert.equal(accountResult.ok, true, accountResult.errors.join('\n'));
  assert.equal(accountResult.ready, true);
  const repositoryResult = verifyRepositoryEvidenceFiles(launch, accounts);
  assert.equal(repositoryResult.ok, false);
  assert.match(
    repositoryResult.errors.join('\n'),
    /requires an explicit trusted tracked-file set/,
  );
});

test('a passed gate cannot use strings or partial evidence to fake readiness', () => {
  const invalid = structuredClone(launchContract);
  const gate = invalid.gates.find(
    candidate => candidate.id === 'production-environments',
  );
  gate.status = 'passed';
  delete gate.blocked_by;
  gate.evidence = ['passed'];

  const result = validateLaunchReadiness(invalid, { now: NOW });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /evidence\[0\] must be an object/);
  assert.match(
    result.errors.join('\n'),
    /passed without required evidence staging-deployment/,
  );
});

test('gate and capability definitions cannot be deleted to lower the bar', () => {
  const invalidLaunch = structuredClone(launchContract);
  invalidLaunch.gates = invalidLaunch.gates.filter(
    gate => gate.id !== 'audio-runtime',
  );
  const launchResult = validateLaunchReadiness(invalidLaunch, { now: NOW });

  const invalidAccounts = structuredClone(accountsContract);
  invalidAccounts.accounts[0].capabilities.pop();
  const accountResult = validateExternalAccountReadiness(
    invalidAccounts,
    launchContract,
    { now: NOW },
  );

  assert.equal(launchResult.ok, false);
  assert.match(launchResult.errors.join('\n'), /gate ids must contain exactly/);
  assert.equal(accountResult.ok, false);
  assert.match(
    accountResult.errors.join('\n'),
    /capability ids must contain exactly/,
  );
});

test('ready capabilities require structured verification evidence', () => {
  const invalid = structuredClone(accountsContract);
  const capability = invalid.accounts[0].capabilities[0];
  capability.status = 'ready';

  const result = validateExternalAccountReadiness(invalid, launchContract, {
    now: NOW,
  });

  assert.equal(result.ok, false);
  assert.match(
    result.errors.join('\n'),
    /ready status requires capability-verification evidence/,
  );
});

test('evidence rejects placeholder hashes, invalid sizes, and future verification', () => {
  const { launch } = createReadyContracts();
  const evidence = launch.gates[0].evidence[0];
  evidence.artifact_uri = 'https://example.com/mutable-report';
  evidence.artifact_sha256 = 'a'.repeat(64);
  evidence.artifact_size_bytes = 0;
  evidence.verified_at = '2027-01-01T00:00:00.000Z';

  const result = validateLaunchReadiness(launch, { now: NOW });
  const message = result.errors.join('\n');

  assert.equal(result.ok, false);
  assert.match(message, /artifact_uri must use repo/);
  assert.match(message, /must be a non-placeholder SHA-256/);
  assert.match(message, /artifact_size_bytes must be a positive integer/);
  assert.match(message, /must not be in the future/);
});

test('evidence rejects reused artifacts and oversized repository records', () => {
  const { launch } = createReadyContracts();
  const gate = launch.gates[0];
  gate.evidence[1].artifact_uri = gate.evidence[0].artifact_uri;
  gate.evidence[1].artifact_sha256 = gate.evidence[0].artifact_sha256;
  gate.evidence[2].artifact_size_bytes = 1024 * 1024 + 1;

  const result = validateLaunchReadiness(launch, { now: NOW });
  const message = result.errors.join('\n');

  assert.equal(result.ok, false);
  assert.match(message, /reuses artifact_uri/);
  assert.match(message, /reuses artifact_sha256/);
  assert.match(message, /must not exceed 1 MiB/);
});

test('evidence artifacts cannot be reused across gates or account capabilities', () => {
  const { accounts, launch } = createReadyContracts();
  const firstGateEvidence = launch.gates[0].evidence[0];
  const secondGateEvidence = launch.gates[1].evidence[0];
  secondGateEvidence.artifact_uri = firstGateEvidence.artifact_uri;
  secondGateEvidence.artifact_sha256 = firstGateEvidence.artifact_sha256;

  const firstCapabilityEvidence = accounts.accounts[0].capabilities[0].evidence[0];
  const secondCapabilityEvidence =
    accounts.accounts[1].capabilities[0].evidence[0];
  secondCapabilityEvidence.artifact_uri = firstCapabilityEvidence.artifact_uri;
  secondCapabilityEvidence.artifact_sha256 =
    firstCapabilityEvidence.artifact_sha256;

  const launchResult = validateLaunchReadiness(launch, { now: NOW });
  const accountResult = validateExternalAccountReadiness(accounts, launch, {
    now: NOW,
  });

  assert.equal(launchResult.ok, false);
  assert.match(
    launchResult.errors.join('\n'),
    /reuses artifact_uri already used by gate production-environments/,
  );
  assert.equal(accountResult.ok, false);
  assert.match(
    accountResult.errors.join('\n'),
    /reuses artifact_sha256 already used by account apple-developer/,
  );
});

test('evidence artifacts cannot be reused across launch and account contracts', () => {
  const { accounts, launch } = createReadyContracts();
  const launchEvidence = launch.gates[0].evidence[0];
  const accountEvidence = accounts.accounts[0].capabilities[0].evidence[0];
  accountEvidence.artifact_uri = launchEvidence.artifact_uri;
  accountEvidence.artifact_sha256 = launchEvidence.artifact_sha256;

  const result = verifyRepositoryEvidenceFiles(launch, accounts, {
    root: ROOT,
    trackedFiles: new Set(),
    trustedCommits: TRUSTED_COMMITS,
  });

  assert.equal(result.ok, false);
  assert.match(
    result.errors.join('\n'),
    /reuses artifact_uri already used by gate production-environments/,
  );
});

test('malformed passed and ready evidence fails closed without throwing', () => {
  const { accounts, launch } = createReadyContracts();
  const contentGate = launch.gates.find(
    gate => gate.id === 'approved-production-content',
  );
  contentGate.evidence = {};
  accounts.accounts[0].capabilities[0].evidence = {};

  const launchResult = validateLaunchReadiness(launch, { now: NOW });
  const accountResult = validateExternalAccountReadiness(accounts, launch, {
    now: NOW,
  });

  assert.equal(launchResult.ok, false);
  assert.match(launchResult.errors.join('\n'), /evidence must be an array/);
  assert.equal(accountResult.ok, false);
  assert.match(accountResult.errors.join('\n'), /evidence must be an array/);
  assert.doesNotThrow(() =>
    verifyRepositoryEvidenceFiles(launch, accounts, {
      root: ROOT,
      trackedFiles: new Set(),
      trustedCommits: TRUSTED_COMMITS,
    }),
  );
});

test('evidence rejects stale verification and mutable pull request pages', () => {
  const { launch } = createReadyContracts();
  const evidence = launch.gates[0].evidence[0];
  evidence.artifact_uri = 'https://github.com/LENKIN233/softbook_cet/pull/412';
  evidence.verified_at = '2025-01-01T00:00:00.000Z';

  const result = validateLaunchReadiness(launch, { now: NOW });
  const message = result.errors.join('\n');

  assert.equal(result.ok, false);
  assert.equal(result.ready, false);
  assert.match(message, /artifact_uri must use repo/);
  assert.match(message, /within the last 180 days/);
});

test('repository evidence is re-hashed and fails after artifact mutation', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-readiness-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const fixture = writeExternalCapabilityFixture(root, {
    accountId: 'apple-developer',
    capabilityId: 'app-store-connect',
    sequence: 900,
  });

  const accounts = structuredClone(accountsContract);
  accounts.accounts[0].capabilities[0].evidence = [
    fixture.evidence,
  ];
  const first = verifyRepositoryEvidenceFiles(launchContract, accounts, {
    root,
    semanticContext,
    trackedFiles: fixture.trackedFiles,
    trustedCommits: TRUSTED_COMMITS,
    now: NOW,
  });
  assert.equal(first.ok, true, first.errors.join('\n'));

  fs.appendFileSync(fixture.reportPath, 'mutated\n');
  const second = verifyRepositoryEvidenceFiles(launchContract, accounts, {
    root,
    semanticContext,
    trackedFiles: fixture.trackedFiles,
    trustedCommits: TRUSTED_COMMITS,
    now: NOW,
  });
  assert.equal(second.ok, false);
  assert.match(second.errors.join('\n'), /SHA-256 does not match/);

  fs.writeFileSync(fixture.reportPath, fixture.reportPayload);
  fs.appendFileSync(fixture.rawPath, '{"mutated":true}\n');
  const rawMutation = verifyRepositoryEvidenceFiles(
    launchContract,
    accounts,
    {
      root,
      semanticContext,
      trackedFiles: fixture.trackedFiles,
      trustedCommits: TRUSTED_COMMITS,
      now: NOW,
    },
  );
  assert.equal(rawMutation.ok, false);
  assert.match(
    rawMutation.errors.join('\n'),
    /raw_artifacts\[0\] repository artifact (byte size|SHA-256) does not match/,
  );
});

test('repository evidence cannot escape through a symbolic link', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-readiness-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const outside = path.join(root, 'outside.json');
  const evidencePath = path.join(
    root,
    'docs',
    'release',
    'evidence',
    'linked.json',
  );
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(outside, '{"private":true}\n');
  fs.symlinkSync(outside, evidencePath);
  const accounts = structuredClone(accountsContract);
  accounts.accounts[0].capabilities[0].evidence = [
    createEvidence('capability-verification', 901, {
      artifactUri: 'repo://docs/release/evidence/linked.json',
      payload: fs.readFileSync(outside),
    }),
  ];

  const result = verifyRepositoryEvidenceFiles(launchContract, accounts, {
    root,
    semanticContext,
    trackedFiles: new Set(['docs/release/evidence/linked.json']),
    trustedCommits: TRUSTED_COMMITS,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /must be a regular file/);
});

test('repository evidence must be tracked by Git', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-readiness-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const fixture = writeExternalCapabilityFixture(root, {
    accountId: 'apple-developer',
    capabilityId: 'app-store-connect',
    sequence: 902,
  });

  const accounts = structuredClone(accountsContract);
  accounts.accounts[0].capabilities[0].evidence = [
    fixture.evidence,
  ];

  const untracked = verifyRepositoryEvidenceFiles(launchContract, accounts, {
    root,
    semanticContext,
    trackedFiles: new Set([fixture.rawRelativePath]),
    trustedCommits: TRUSTED_COMMITS,
    now: NOW,
  });
  assert.equal(untracked.ok, false);
  assert.match(untracked.errors.join('\n'), /must be tracked by Git/);

  const tracked = verifyRepositoryEvidenceFiles(launchContract, accounts, {
    root,
    semanticContext,
    trackedFiles: fixture.trackedFiles,
    trustedCommits: TRUSTED_COMMITS,
    now: NOW,
  });
  assert.equal(tracked.ok, true, tracked.errors.join('\n'));
});

test('arbitrary JSON cannot satisfy external capability evidence semantics', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-readiness-'));
  t.after(() => fs.rmSync(root, {force: true, recursive: true}));
  const relativePath = 'docs/release/evidence/external-arbitrary.json';
  const evidencePath = path.join(root, relativePath);
  const payload = '{"status":"passed"}\n';
  fs.mkdirSync(path.dirname(evidencePath), {recursive: true});
  fs.writeFileSync(evidencePath, payload);
  const accounts = structuredClone(accountsContract);
  accounts.accounts[0].capabilities[0].evidence = [
    createEvidence('capability-verification', 903, {
      artifactUri: `repo://${relativePath}`,
      payload,
    }),
  ];

  const result = verifyRepositoryEvidenceFiles(launchContract, accounts, {
    root,
    semanticContext,
    trackedFiles: new Set([relativePath]),
    trustedCommits: TRUSTED_COMMITS,
    now: NOW,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /external-capability-evidence\.v1/);
  assert.match(result.errors.join('\n'), /subject must be an object/);
  assert.match(result.errors.join('\n'), /checks must be an array/);
});

test('all external capabilities bind exact identity, policy, checks, and non-gate scope', () => {
  const policy = externalCapabilityExpectedPolicy();
  let sequence = 950;
  assert.deepEqual(
    Object.keys(policy.required_checks).sort(),
    Object.keys(EXTERNAL_ACCOUNT_DEFINITIONS).sort(),
  );
  for (const [accountId, capabilityIds] of Object.entries(
    EXTERNAL_ACCOUNT_DEFINITIONS,
  )) {
    assert.deepEqual(
      Object.keys(policy.required_checks[accountId]).sort(),
      [...capabilityIds].sort(),
    );
    for (const capabilityId of capabilityIds) {
      const outerEvidence = createEvidence(
        'capability-verification',
        sequence++,
      );
      const artifact = createExternalCapabilityArtifact(
        accountId,
        capabilityId,
      );
      const result = validateExternalCapabilityEvidenceArtifact(artifact, {
        accountId,
        capabilityId,
        expectedPolicy: policy,
        now: NOW,
        outerEvidence,
        targetRelease: '2027-Q2',
      });
      assert.equal(
        result.ok,
        true,
        `${accountId}/${capabilityId}: ${result.errors.join('\n')}`,
      );
    }
  }

  const outerEvidence = createEvidence('capability-verification', sequence++);
  const wrongCapability = createExternalCapabilityArtifact(
    'apple-developer',
    'app-store-connect',
  );
  wrongCapability.subject.capability_id = 'storekit-subscriptions';
  wrongCapability.subject.commit_sha = hash('wrong-commit').slice(0, 40);
  wrongCapability.subject.policy.sha256 = hash('wrong-policy');
  wrongCapability.gate_eligible = true;
  wrongCapability.observation.provider_subject_sha256 = '0'.repeat(64);
  wrongCapability.observation.observed_at = '2026-07-15T00:00:00.000Z';
  wrongCapability.observation.valid_until = '2026-07-13T23:30:00.000Z';
  wrongCapability.checks.pop();
  wrongCapability.checks[0].artifact_roles = ['unknown-role'];
  const invalid = validateExternalCapabilityEvidenceArtifact(wrongCapability, {
    accountId: 'apple-developer',
    capabilityId: 'app-store-connect',
    expectedPolicy: policy,
    now: NOW,
    outerEvidence,
    targetRelease: '2027-Q2',
  });
  assert.equal(invalid.ok, false);
  const message = invalid.errors.join('\n');
  assert.match(message, /subject\.capability_id/);
  assert.match(message, /subject\.commit_sha/);
  assert.match(message, /subject\.policy\.sha256/);
  assert.match(message, /gate_eligible must be false/);
  assert.match(message, /provider_subject_sha256/);
  assert.match(message, /observation\.observed_at must not be in the future/);
  assert.match(message, /observation\.valid_until must be in the future/);
  assert.match(message, /check ids must contain exactly/);
  assert.match(message, /unknown raw artifact role/);
});

test('external capability subject commit must be reachable', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-readiness-'));
  t.after(() => fs.rmSync(root, {force: true, recursive: true}));
  const fixture = writeExternalCapabilityFixture(root, {
    accountId: 'apple-developer',
    capabilityId: 'app-store-connect',
    sequence: 951,
  });
  const unreachableCommit = hash('unreachable-external-commit').slice(0, 40);
  fixture.artifact.subject.commit_sha = unreachableCommit;
  fixture.evidence.subject_commit_sha = unreachableCommit;
  rewriteExternalCapabilityReport(fixture);
  const accounts = structuredClone(accountsContract);
  accounts.accounts[0].capabilities[0].evidence = [fixture.evidence];

  const result = verifyRepositoryEvidenceFiles(launchContract, accounts, {
    root,
    semanticContext,
    trackedFiles: fixture.trackedFiles,
    trustedCommits: TRUSTED_COMMITS,
    now: NOW,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /subject commit must be reachable/);
});

test('arbitrary JSON cannot satisfy formal gate evidence semantics', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-readiness-'));
  t.after(() => fs.rmSync(root, {force: true, recursive: true}));
  const relativePath =
    'docs/release/evidence/cross-device-bootstrap-test.json';
  const evidencePath = path.join(root, relativePath);
  const payload = '{"status":"passed"}\n';
  fs.mkdirSync(path.dirname(evidencePath), {recursive: true});
  fs.writeFileSync(evidencePath, payload);
  const launch = structuredClone(launchContract);
  launch.release_candidate = createReleaseCandidate();
  const gate = launch.gates.find(
    candidate =>
      candidate.id === 'canonical-bootstrap-and-idempotent-events',
  );
  gate.evidence = [
    createEvidence('cross-device-bootstrap-test', 903, {
      artifactUri: `repo://${relativePath}`,
      payload,
    }),
  ];

  const result = verifyRepositoryEvidenceFiles(launch, accountsContract, {
    root,
    semanticContext,
    trackedFiles: new Set([relativePath]),
    trustedCommits: TRUSTED_COMMITS,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /schema_version/);
  assert.match(result.errors.join('\n'), /gate_eligible must be true/);
  assert.match(result.errors.join('\n'), /measurements must be an object/);
});

test('formal gate evidence requires a reachable commit and safe raw artifact path', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-readiness-'));
  t.after(() => fs.rmSync(root, {force: true, recursive: true}));
  const gateId = 'canonical-bootstrap-and-idempotent-events';
  const evidenceType = 'cross-device-bootstrap-test';
  const artifact = createValidGateArtifact(gateId, evidenceType);
  artifact.raw_artifacts[0].artifact_uri = 'repo://../../outside.json';
  const unsafeResult = validateGateEvidenceArtifact(artifact, {
    evidenceType,
    expectedPolicy: semanticContext.expectedPolicies[gateId],
    gateId,
    now: NOW,
    outerEvidence: outerEvidenceForArtifact(evidenceType),
    releaseOperationalPolicy: semanticContext.releaseOperationalPolicy,
  });
  assert.equal(unsafeResult.ok, false);
  assert.match(unsafeResult.errors.join('\n'), /not an allowed repository evidence path/);

  artifact.raw_artifacts[0].artifact_uri = 'https://example.com/current';
  const remoteRawResult = validateGateEvidenceArtifact(artifact, {
    evidenceType,
    expectedPolicy: semanticContext.expectedPolicies[gateId],
    gateId,
    now: NOW,
    outerEvidence: outerEvidenceForArtifact(evidenceType),
    releaseOperationalPolicy: semanticContext.releaseOperationalPolicy,
  });
  assert.equal(remoteRawResult.ok, false);
  assert.match(
    remoteRawResult.errors.join('\n'),
    /must use repo:\/\/; remote evidence requires a verified repository manifest/,
  );

  artifact.raw_artifacts[0].artifact_uri =
    'repo://docs/release/evidence/raw/cross-device-bootstrap-test.json';
  const payload = `${JSON.stringify(artifact, null, 2)}\n`;
  const relativePath =
    'docs/release/evidence/cross-device-bootstrap-test-valid.json';
  const evidencePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(evidencePath), {recursive: true});
  fs.writeFileSync(evidencePath, payload);
  const launch = structuredClone(launchContract);
  launch.release_candidate = createReleaseCandidate();
  const gate = launch.gates.find(candidate => candidate.id === gateId);
  gate.evidence = [
    {
      ...outerEvidenceForArtifact(evidenceType),
      artifact_uri: `repo://${relativePath}`,
      artifact_sha256: hash(payload),
      artifact_size_bytes: Buffer.byteLength(payload),
    },
  ];
  const unreachable = verifyRepositoryEvidenceFiles(
    launch,
    accountsContract,
    {
      root,
      semanticContext,
      trackedFiles: new Set([relativePath]),
      trustedCommits: new Set(),
    },
  );
  assert.equal(unreachable.ok, false);
  assert.match(unreachable.errors.join('\n'), /subject commit must be reachable/);
});

test('tracked formal report and tracked raw artifact verify end to end', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-readiness-'));
  t.after(() => fs.rmSync(root, {force: true, recursive: true}));
  const gateId = 'release-slo-and-recovery-drill';
  const evidenceType = 'load-test-report';
  const rawRelativePath =
    'docs/release/evidence/raw/load-test-report.json';
  const rawPayload = '{"requests":10000,"errors":0}\n';
  const rawPath = path.join(root, rawRelativePath);
  fs.mkdirSync(path.dirname(rawPath), {recursive: true});
  fs.writeFileSync(rawPath, rawPayload);

  const artifact = createValidGateArtifact(gateId, evidenceType);
  artifact.raw_artifacts[0] = {
    role: `raw-${evidenceType}`,
    artifact_uri: `repo://${rawRelativePath}`,
    sha256: hash(rawPayload),
    size_bytes: Buffer.byteLength(rawPayload),
  };
  const reportPayload = `${JSON.stringify(artifact, null, 2)}\n`;
  const reportRelativePath =
    'docs/release/evidence/load-test-report.json';
  const reportPath = path.join(root, reportRelativePath);
  fs.mkdirSync(path.dirname(reportPath), {recursive: true});
  fs.writeFileSync(reportPath, reportPayload);

  const launch = structuredClone(launchContract);
  launch.release_candidate = createReleaseCandidate();
  const gate = launch.gates.find(candidate => candidate.id === gateId);
  gate.evidence = [
    {
      ...outerEvidenceForArtifact(evidenceType),
      artifact_uri: `repo://${reportRelativePath}`,
      artifact_sha256: hash(reportPayload),
      artifact_size_bytes: Buffer.byteLength(reportPayload),
    },
  ];
  const options = {
    root,
    semanticContext,
    trackedFiles: new Set([rawRelativePath, reportRelativePath]),
    trustedCommits: TRUSTED_COMMITS,
  };
  const valid = verifyRepositoryEvidenceFiles(
    launch,
    accountsContract,
    options,
  );
  assert.equal(valid.ok, true, valid.errors.join('\n'));

  const mismatchedLaunch = structuredClone(launch);
  mismatchedLaunch.release_candidate.release.backend_deployment_id =
    'backend-release-other';
  const mismatched = verifyRepositoryEvidenceFiles(
    mismatchedLaunch,
    accountsContract,
    options,
  );
  assert.equal(mismatched.ok, false);
  assert.match(
    mismatched.errors.join('\n'),
    /must match the launch-level release_candidate cohort/,
  );

  fs.appendFileSync(rawPath, '{"mutated":true}\n');
  const mutated = verifyRepositoryEvidenceFiles(
    launch,
    accountsContract,
    options,
  );
  assert.equal(mutated.ok, false);
  assert.match(
    mutated.errors.join('\n'),
    /raw_artifacts\[0\] repository artifact (byte size|SHA-256) does not match/,
  );
});

test('all learning runtime evidence types require full deployed semantic reports', () => {
  for (const evidenceType of GATE_DEFINITIONS[
    'canonical-bootstrap-and-idempotent-events'
  ].evidenceTypes.concat(GATE_DEFINITIONS['server-scheduler'].evidenceTypes)) {
    const gateId = gateIdForEvidenceType(evidenceType);
    const artifact = createValidGateArtifact(gateId, evidenceType);
    const result = validateGateEvidenceArtifact(artifact, {
      evidenceType,
      expectedPolicy: semanticContext.expectedPolicies[gateId],
      gateId,
      now: NOW,
      outerEvidence: outerEvidenceForArtifact(evidenceType),
      releaseOperationalPolicy: semanticContext.releaseOperationalPolicy,
    });
    assert.equal(
      result.ok,
      true,
      `${evidenceType}\n${result.errors.join('\n')}`,
    );
  }
});

test('learning evidence rejects simulation, cross-type rename, and weak binding', () => {
  const gateId = 'canonical-bootstrap-and-idempotent-events';
  const artifact = createValidGateArtifact(
    gateId,
    'cross-device-bootstrap-test',
  );
  artifact.schema_version = 'release-blank-environment-simulation.v1';
  artifact.execution_mode = 'repository_in_memory';
  artifact.gate_eligible = false;
  artifact.subject.evidence_type = 'offline-replay-test';
  artifact.subject.environment.receiver_owned = false;

  const result = validateGateEvidenceArtifact(artifact, {
    evidenceType: 'cross-device-bootstrap-test',
    expectedPolicy: semanticContext.expectedPolicies[gateId],
    gateId,
    now: NOW,
    outerEvidence: outerEvidenceForArtifact('cross-device-bootstrap-test'),
    releaseOperationalPolicy: semanticContext.releaseOperationalPolicy,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /schema_version/);
  assert.match(result.errors.join('\n'), /gate_eligible must be true/);
  assert.match(result.errors.join('\n'), /execution mode/);
  assert.match(result.errors.join('\n'), /evidence_type/);
  assert.match(result.errors.join('\n'), /receiver_owned must be true/);
});

test('learning evidence recomputes membership and clock boundary relationships', () => {
  const schedulerGate = 'server-scheduler';
  const scheduler = createValidGateArtifact(
    schedulerGate,
    'scheduler-contract-test',
  );
  scheduler.measurements.membership_stage = 'free';
  scheduler.measurements.access_mode = 'full';
  const clock = createValidGateArtifact(schedulerGate, 'clock-boundary-test');
  clock.measurements.earliest_client_time_at =
    clock.measurements.server_acceptance_at;
  clock.measurements.latest_client_time_at =
    clock.measurements.server_acceptance_at;

  const schedulerResult = validateGateEvidenceArtifact(scheduler, {
    evidenceType: 'scheduler-contract-test',
    expectedPolicy: semanticContext.expectedPolicies[schedulerGate],
    gateId: schedulerGate,
    now: NOW,
    outerEvidence: outerEvidenceForArtifact('scheduler-contract-test'),
    releaseOperationalPolicy: semanticContext.releaseOperationalPolicy,
  });
  const clockResult = validateGateEvidenceArtifact(clock, {
    evidenceType: 'clock-boundary-test',
    expectedPolicy: semanticContext.expectedPolicies[schedulerGate],
    gateId: schedulerGate,
    now: NOW,
    outerEvidence: outerEvidenceForArtifact('clock-boundary-test'),
    releaseOperationalPolicy: semanticContext.releaseOperationalPolicy,
  });

  assert.equal(schedulerResult.ok, false);
  assert.match(schedulerResult.errors.join('\n'), /access_mode membership binding/);
  assert.equal(clockResult.ok, false);
  assert.match(clockResult.errors.join('\n'), /older than the retention boundary/);
  assert.match(clockResult.errors.join('\n'), /beyond the future-skew boundary/);
});

test('formal evidence rejects self-described independence and unsupported generic semantics', () => {
  const learningGate = 'canonical-bootstrap-and-idempotent-events';
  const learning = createValidGateArtifact(
    learningGate,
    'canonical-state-test',
  );
  learning.execution.operator = learning.verification.verified_by;
  const genericGate = 'production-environments';
  const generic = createValidGateArtifact(
    genericGate,
    'staging-deployment',
  );

  const learningResult = validateGateEvidenceArtifact(learning, {
    evidenceType: 'canonical-state-test',
    expectedPolicy: semanticContext.expectedPolicies[learningGate],
    gateId: learningGate,
    now: NOW,
    outerEvidence: outerEvidenceForArtifact('canonical-state-test'),
    releaseOperationalPolicy: semanticContext.releaseOperationalPolicy,
  });
  const genericResult = validateGateEvidenceArtifact(generic, {
    evidenceType: 'staging-deployment',
    expectedPolicy: semanticContext.expectedPolicies[genericGate],
    gateId: genericGate,
    now: NOW,
    outerEvidence: outerEvidenceForArtifact('staging-deployment'),
    releaseOperationalPolicy: semanticContext.releaseOperationalPolicy,
  });

  assert.equal(learningResult.ok, false);
  assert.match(learningResult.errors.join('\n'), /must differ from the execution operator/);
  assert.equal(genericResult.ok, false);
  assert.match(genericResult.errors.join('\n'), /no type-specific semantic contract/);
});

test('all release operational reports recompute policy thresholds', () => {
  const gateId = 'release-slo-and-recovery-drill';
  for (const evidenceType of GATE_DEFINITIONS[gateId].evidenceTypes) {
    const artifact = createValidGateArtifact(gateId, evidenceType);
    const result = validateGateEvidenceArtifact(artifact, {
      evidenceType,
      expectedPolicy: semanticContext.expectedPolicies[gateId],
      gateId,
      now: NOW,
      outerEvidence: outerEvidenceForArtifact(evidenceType),
      releaseOperationalPolicy: semanticContext.releaseOperationalPolicy,
    });
    assert.equal(
      result.ok,
      true,
      `${evidenceType}\n${result.errors.join('\n')}`,
    );
  }
});

test('release evidence rejects self-declared pass when measurements fail', () => {
  const gateId = 'release-slo-and-recovery-drill';
  const load = createValidGateArtifact(gateId, 'load-test-report');
  load.measurements.request_count = 0;
  load.measurements.success_count = 0;
  load.measurements.concurrent_users = 1;
  const rollback = createValidGateArtifact(gateId, 'rollback-drill');
  rollback.measurements.learning_data_count_after += 1;
  rollback.measurements.learning_data_sha256_after = hash('mutated-learning');
  rollback.measurements.delete_operation_count = 1;

  const loadResult = validateGateEvidenceArtifact(load, {
    evidenceType: 'load-test-report',
    expectedPolicy: semanticContext.expectedPolicies[gateId],
    gateId,
    now: NOW,
    outerEvidence: outerEvidenceForArtifact('load-test-report'),
    releaseOperationalPolicy: semanticContext.releaseOperationalPolicy,
  });
  const rollbackResult = validateGateEvidenceArtifact(rollback, {
    evidenceType: 'rollback-drill',
    expectedPolicy: semanticContext.expectedPolicies[gateId],
    gateId,
    now: NOW,
    outerEvidence: outerEvidenceForArtifact('rollback-drill'),
    releaseOperationalPolicy: semanticContext.releaseOperationalPolicy,
  });

  assert.equal(loadResult.ok, false);
  assert.match(loadResult.errors.join('\n'), /request_count must be at least 10000/);
  assert.match(loadResult.errors.join('\n'), /concurrent_users must be at least 200/);
  assert.equal(rollbackResult.ok, false);
  assert.match(rollbackResult.errors.join('\n'), /learning data count/);
  assert.match(rollbackResult.errors.join('\n'), /learning data hash/);
  assert.match(rollbackResult.errors.join('\n'), /delete_operation_count must be 0/);
});

test('release evidence recomputes probe coverage, RPO, and latency ordering', () => {
  const gateId = 'release-slo-and-recovery-drill';
  const availability = createValidGateArtifact(
    gateId,
    'availability-observation',
  );
  availability.measurements.probe_interval_seconds = 0;
  availability.measurements.expected_probe_count = 1;
  availability.measurements.success_probe_count = 1;
  const concentratedAvailability = createValidGateArtifact(
    gateId,
    'availability-observation',
  );
  const [firstRoute, ...unprobedRoutes] =
    concentratedAvailability.measurements.routes;
  concentratedAvailability.measurements.route_probes[
    firstRoute
  ].expected_probe_count = 4320;
  concentratedAvailability.measurements.route_probes[
    firstRoute
  ].success_probe_count = 4320;
  for (const route of unprobedRoutes) {
    concentratedAvailability.measurements.route_probes[
      route
    ].expected_probe_count = 0;
    concentratedAvailability.measurements.route_probes[
      route
    ].success_probe_count = 0;
  }
  const backup = createValidGateArtifact(gateId, 'backup-restore-drill');
  backup.measurements.rpo_seconds = 0;
  backup.measurements.source_environment_id = 'receiver-prod-unrelated';
  for (const dataset of backup.measurements.datasets) {
    backup.measurements.source_counts[dataset] = 0;
    backup.measurements.restored_counts[dataset] = 0;
  }
  const load = createValidGateArtifact(gateId, 'load-test-report');
  load.measurements.p95_latency_ms = 700;
  load.measurements.p99_latency_ms = 600;

  const validate = (artifact, evidenceType) =>
    validateGateEvidenceArtifact(artifact, {
      evidenceType,
      expectedPolicy: semanticContext.expectedPolicies[gateId],
      gateId,
      now: NOW,
      outerEvidence: outerEvidenceForArtifact(evidenceType),
      releaseOperationalPolicy: semanticContext.releaseOperationalPolicy,
    });
  const availabilityResult = validate(
    availability,
    'availability-observation',
  );
  const concentratedAvailabilityResult = validate(
    concentratedAvailability,
    'availability-observation',
  );
  const backupResult = validate(backup, 'backup-restore-drill');
  const loadResult = validate(load, 'load-test-report');

  assert.equal(availabilityResult.ok, false);
  assert.match(
    availabilityResult.errors.join('\n'),
    /probe_interval_seconds must be a positive safe integer/,
  );
  assert.equal(concentratedAvailabilityResult.ok, false);
  assert.match(
    concentratedAvailabilityResult.errors.join('\n'),
    /route_probes\..*expected_probe_count must be a positive safe integer/,
  );
  assert.match(
    concentratedAvailabilityResult.errors.join('\n'),
    /expected_probe_count is too small for the observation window/,
  );
  assert.equal(backupResult.ok, false);
  assert.match(
    backupResult.errors.join('\n'),
    /rpo_seconds must match the recovery reference/,
  );
  assert.match(
    backupResult.errors.join('\n'),
    /source_environment_id subject binding/,
  );
  assert.match(
    backupResult.errors.join('\n'),
    /source_counts\..* must be a positive safe integer/,
  );
  assert.equal(loadResult.ok, false);
  assert.match(loadResult.errors.join('\n'), /p99_latency_ms must not be lower/);
});

test('release evidence validity follows the active policy window', () => {
  const gateId = 'release-slo-and-recovery-drill';
  const evidenceType = 'load-test-report';
  const artifact = createValidGateArtifact(gateId, evidenceType);
  const policy = structuredClone(semanticContext.releaseOperationalPolicy);
  policy.evidence_validity_days = 1;

  const result = validateGateEvidenceArtifact(artifact, {
    evidenceType,
    expectedPolicy: semanticContext.expectedPolicies[gateId],
    gateId,
    now: new Date('2026-07-16T00:00:00.000Z'),
    outerEvidence: outerEvidenceForArtifact(evidenceType),
    releaseOperationalPolicy: policy,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /exceeds the 1-day evidence validity policy/);
});

test('release evidence binds execution duration and retained nonempty rollback state', () => {
  const gateId = 'release-slo-and-recovery-drill';
  const load = createValidGateArtifact(gateId, 'load-test-report');
  load.execution.completed_at = load.execution.started_at;
  const rollback = createValidGateArtifact(gateId, 'rollback-drill');
  rollback.measurements.release_a = rollback.measurements.release_b;
  rollback.measurements.release_b_parent = rollback.measurements.release_b;
  rollback.measurements.final_active_release = rollback.measurements.release_b;
  rollback.measurements.release_a_retained_before_rollback = false;
  rollback.measurements.learning_data_count_before = 0;
  rollback.measurements.learning_data_count_after = 0;

  const validate = (artifact, evidenceType) =>
    validateGateEvidenceArtifact(artifact, {
      evidenceType,
      expectedPolicy: semanticContext.expectedPolicies[gateId],
      gateId,
      now: NOW,
      outerEvidence: outerEvidenceForArtifact(evidenceType),
      releaseOperationalPolicy: semanticContext.releaseOperationalPolicy,
    });
  const loadResult = validate(load, 'load-test-report');
  const rollbackResult = validate(rollback, 'rollback-drill');

  assert.equal(loadResult.ok, false);
  assert.match(loadResult.errors.join('\n'), /must fit within the recorded execution window/);
  assert.equal(rollbackResult.ok, false);
  assert.match(rollbackResult.errors.join('\n'), /release_a and release_b must be distinct/);
  assert.match(
    rollbackResult.errors.join('\n'),
    /release_a_retained_before_rollback must be true/,
  );
  assert.match(
    rollbackResult.errors.join('\n'),
    /learning_data_count_before must be a positive safe integer/,
  );
});

test('release campaign reports must share commit, profile, environment, bundle, and release', () => {
  const gateId = 'release-slo-and-recovery-drill';
  const reports = GATE_DEFINITIONS[gateId].evidenceTypes.map(evidenceType =>
    createValidGateArtifact(gateId, evidenceType),
  );
  reports[1].campaign_id = 'release-ops-other';
  reports[2].subject.commit_sha = '1'.repeat(40);
  reports[3].subject.environment.environment_id = 'receiver-prod-other';
  reports[4].subject.release.bundle_sha256 = hash('other-bundle');
  reports[4].subject.release.backend_deployment_id = 'backend-release-other';

  const result = validateGateEvidenceCoherence(reports, {
    gateId,
    requiredEvidenceTypes: GATE_DEFINITIONS[gateId].evidenceTypes,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /share campaign_id/);
  assert.match(result.errors.join('\n'), /share commit_sha/);
  assert.match(result.errors.join('\n'), /share environment_id/);
  assert.match(result.errors.join('\n'), /share bundle_sha256/);
  assert.match(result.errors.join('\n'), /share backend_deployment_id/);
});

test('SMS provider smoke evidence must satisfy its strict human-confirmation schema', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-readiness-sms-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const rawRelativePath =
    'docs/release/evidence/raw/sms-provider-smoke.json';
  const rawPath = path.join(root, rawRelativePath);
  const report = smsProviderSmokeReport();
  const writeRawReport = () => {
    const payload = `${JSON.stringify(report, null, 2)}\n`;
    fs.mkdirSync(path.dirname(rawPath), {recursive: true});
    fs.writeFileSync(rawPath, payload);
    return payload;
  };
  let rawPayload = writeRawReport();

  const gateId = 'production-auth-and-account-deletion';
  const evidenceType = 'sms-provider-smoke';
  const artifact = createValidGateArtifact(gateId, evidenceType);
  artifact.campaign_id = report.run_id;
  artifact.execution.started_at = report.sent_at;
  artifact.execution.completed_at = report.confirmed_at;
  artifact.raw_artifacts[0] = {
    role: artifact.measurements.report_role,
    artifact_uri: `repo://${rawRelativePath}`,
    sha256: hash(rawPayload),
    size_bytes: Buffer.byteLength(rawPayload),
  };
  const missingRawReport = validateGateEvidenceArtifact(artifact, {
    evidenceType,
    expectedPolicy: semanticContext.expectedPolicies[gateId],
    gateId,
    now: NOW,
    outerEvidence: outerEvidenceForArtifact(evidenceType),
    releaseOperationalPolicy: semanticContext.releaseOperationalPolicy,
  });
  assert.equal(missingRawReport.ok, false);
  assert.match(
    missingRawReport.errors.join('\n'),
    /must resolve to a parsed SMS provider smoke report/,
  );
  const completeArtifact = validateGateEvidenceArtifact(artifact, {
    evidenceType,
    expectedPolicy: semanticContext.expectedPolicies[gateId],
    gateId,
    now: NOW,
    outerEvidence: outerEvidenceForArtifact(evidenceType),
    releaseOperationalPolicy: semanticContext.releaseOperationalPolicy,
    smsProviderSmokeReport: report,
  });
  assert.equal(completeArtifact.ok, true, completeArtifact.errors.join('\n'));
  const misplacedArtifact = structuredClone(artifact);
  misplacedArtifact.raw_artifacts[0].artifact_uri =
    'repo://docs/release/evidence/sms-provider-smoke.json';
  const misplacedRawReport = validateGateEvidenceArtifact(misplacedArtifact, {
    evidenceType,
    expectedPolicy: semanticContext.expectedPolicies[gateId],
    gateId,
    now: NOW,
    outerEvidence: outerEvidenceForArtifact(evidenceType),
    releaseOperationalPolicy: semanticContext.releaseOperationalPolicy,
    smsProviderSmokeReport: report,
  });
  assert.equal(misplacedRawReport.ok, false);
  assert.match(
    misplacedRawReport.errors.join('\n'),
    /must be below docs\/release\/evidence\/raw/,
  );
  const reportRelativePath =
    'docs/release/evidence/sms-provider-smoke-evidence.json';
  const evidencePath = path.join(root, reportRelativePath);
  const writeFormalEvidence = () => {
    const payload = `${JSON.stringify(artifact, null, 2)}\n`;
    fs.mkdirSync(path.dirname(evidencePath), {recursive: true});
    fs.writeFileSync(evidencePath, payload);
    return payload;
  };
  let evidencePayload = writeFormalEvidence();

  const launch = structuredClone(launchContract);
  launch.release_candidate = createReleaseCandidate();
  const gate = launch.gates.find(
    candidate => candidate.id === gateId,
  );
  gate.evidence = [
    {
      ...outerEvidenceForArtifact(evidenceType),
      artifact_uri: `repo://${reportRelativePath}`,
      artifact_sha256: hash(evidencePayload),
      artifact_size_bytes: Buffer.byteLength(evidencePayload),
    },
  ];

  const valid = verifyRepositoryEvidenceFiles(launch, accountsContract, {
    root,
    semanticContext,
    trackedFiles: new Set([rawRelativePath, reportRelativePath]),
    trustedCommits: TRUSTED_COMMITS,
    now: NOW,
  });
  assert.equal(valid.ok, true, valid.errors.join('\n'));

  const directLaunch = structuredClone(launch);
  const directGate = directLaunch.gates.find(candidate => candidate.id === gateId);
  directGate.evidence[0].artifact_uri = `repo://${rawRelativePath}`;
  directGate.evidence[0].artifact_sha256 = hash(rawPayload);
  directGate.evidence[0].artifact_size_bytes = Buffer.byteLength(rawPayload);
  const direct = verifyRepositoryEvidenceFiles(
    directLaunch,
    accountsContract,
    {
      root,
      semanticContext,
      trackedFiles: new Set([rawRelativePath, reportRelativePath]),
      trustedCommits: TRUSTED_COMMITS,
      now: NOW,
    },
  );
  assert.equal(direct.ok, false);
  assert.match(
    direct.errors.join('\n'),
    /schema_version|report_role must resolve to exactly one raw artifact/,
  );

  report.confirmation_method = 'automated_api_response';
  report.verifier.id = 'github:different-reviewer';
  rawPayload = writeRawReport();
  artifact.raw_artifacts[0].sha256 = hash(rawPayload);
  artifact.raw_artifacts[0].size_bytes = Buffer.byteLength(rawPayload);
  evidencePayload = writeFormalEvidence();
  gate.evidence[0].artifact_sha256 = hash(evidencePayload);
  gate.evidence[0].artifact_size_bytes = Buffer.byteLength(evidencePayload);
  const invalid = verifyRepositoryEvidenceFiles(launch, accountsContract, {
    root,
    semanticContext,
    trackedFiles: new Set([rawRelativePath, reportRelativePath]),
    trustedCommits: TRUSTED_COMMITS,
    now: NOW,
  });
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.join('\n'), /confirmation_method is invalid/);
  assert.match(invalid.errors.join('\n'), /human verifier binding does not match/);

  report.confirmation_method = 'human_received_code_match';
  report.verifier.id = artifact.verification.verified_by;
  report.target_id = 'receiver-prod-other';
  rawPayload = writeRawReport();
  artifact.raw_artifacts[0].sha256 = hash(rawPayload);
  artifact.raw_artifacts[0].size_bytes = Buffer.byteLength(rawPayload);
  evidencePayload = writeFormalEvidence();
  gate.evidence[0].artifact_sha256 = hash(evidencePayload);
  gate.evidence[0].artifact_size_bytes = Buffer.byteLength(evidencePayload);
  const mismatchedTarget = verifyRepositoryEvidenceFiles(
    launch,
    accountsContract,
    {
      root,
      semanticContext,
      trackedFiles: new Set([rawRelativePath, reportRelativePath]),
      trustedCommits: TRUSTED_COMMITS,
      now: NOW,
    },
  );
  assert.equal(mismatchedTarget.ok, false);
  assert.match(
    mismatchedTarget.errors.join('\n'),
    /receiver environment binding does not match/,
  );
});

test('Android release-signing evidence requires the dedicated signed APK report', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-readiness-'));
  t.after(() => fs.rmSync(root, {force: true, recursive: true}));
  const fixture = writeExternalCapabilityFixture(root, {
    accountId: 'android-distribution',
    capabilityId: 'release-signing',
    sequence: 903,
  });
  const reportRelativePath =
    'docs/release/evidence/raw/android-signed-release.json';
  const reportPath = path.join(root, reportRelativePath);
  const report = createAndroidSignedReleaseReport();
  const signedReleaseRole = 'android-signed-release-report';
  const writeSignedReleaseReport = () => {
    const payload = `${JSON.stringify(report, null, 2)}\n`;
    fs.mkdirSync(path.dirname(reportPath), {recursive: true});
    fs.writeFileSync(reportPath, payload);
    const descriptor = fixture.artifact.raw_artifacts.find(
      candidate => candidate.role === signedReleaseRole,
    );
    descriptor.sha256 = hash(payload);
    descriptor.size_bytes = Buffer.byteLength(payload);
    rewriteExternalCapabilityReport(fixture);
    return payload;
  };
  fixture.artifact.observation.observed_at = report.archived_verified_at;
  fixture.artifact.observation.provider_subject_sha256 = hash(
    `android-release-target:${report.target_id}`,
  );
  fixture.artifact.raw_artifacts.push({
    role: signedReleaseRole,
    artifact_uri: `repo://${reportRelativePath}`,
    sha256: '0'.repeat(64),
    size_bytes: 1,
  });
  for (const checkId of [
    'current-state-observed',
    'certificate-fingerprint-recorded',
  ]) {
    fixture.artifact.checks.find(check => check.id === checkId).artifact_roles = [
      signedReleaseRole,
    ];
  }
  writeSignedReleaseReport();
  fixture.trackedFiles.add(reportRelativePath);
  const accounts = structuredClone(accountsContract);
  const capability = accounts.accounts
    .find(account => account.id === 'android-distribution')
    .capabilities.find(candidate => candidate.id === 'release-signing');
  capability.evidence = [fixture.evidence];

  const valid = verifyRepositoryEvidenceFiles(launchContract, accounts, {
    root,
    semanticContext,
    trackedFiles: fixture.trackedFiles,
    trustedCommits: TRUSTED_COMMITS,
    now: NOW,
  });
  assert.equal(valid.ok, true, valid.errors.join('\n'));

  report.verified_by = 'external:release-auditor';
  writeSignedReleaseReport();
  const invalid = verifyRepositoryEvidenceFiles(launchContract, accounts, {
    root,
    semanticContext,
    trackedFiles: fixture.trackedFiles,
    trustedCommits: TRUSTED_COMMITS,
    now: NOW,
  });
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.join('\n'), /signed-release verifier does not match/);

  report.verified_by = fixture.artifact.verification.verified_by;
  fixture.artifact.observation.provider_subject_sha256 = hash(
    'android-release-target:receiver-other',
  );
  writeSignedReleaseReport();
  const mismatchedTarget = verifyRepositoryEvidenceFiles(
    launchContract,
    accounts,
    {
      root,
      semanticContext,
      trackedFiles: fixture.trackedFiles,
      trustedCommits: TRUSTED_COMMITS,
      now: NOW,
    },
  );
  assert.equal(mismatchedTarget.ok, false);
  assert.match(
    mismatchedTarget.errors.join('\n'),
    /signed-release receiver target does not match/,
  );
});

test('launch and external account statuses must agree', () => {
  const invalidLaunch = structuredClone(launchContract);
  invalidLaunch.external_dependencies[0].status = 'ready';

  const result = validateExternalAccountReadiness(
    accountsContract,
    invalidLaunch,
    { now: NOW },
  );

  assert.equal(result.ok, false);
  assert.match(
    result.errors.join('\n'),
    /status must match the launch contract/,
  );
});

test('external account and formal content approval evidence requires product owner verification', () => {
  const { accounts, launch } = createReadyContracts();
  accounts.accounts[0].capabilities[0].evidence[0].verified_by =
    'team:release-engineering';
  const contentGate = launch.gates.find(
    gate => gate.id === 'approved-production-content',
  );
  contentGate.evidence.find(
    evidence => evidence.type === 'approved-card-coverage-report',
  ).verified_by = 'team:content-qa';

  const accountResult = validateExternalAccountReadiness(accounts, launch, {
    now: NOW,
  });
  const launchResult = validateLaunchReadiness(launch, { now: NOW });

  assert.equal(accountResult.ok, false);
  assert.match(
    accountResult.errors.join('\n'),
    /must be verified by tracked product_owner/,
  );
  assert.equal(launchResult.ok, false);
  assert.match(
    launchResult.errors.join('\n'),
    /approved-card-coverage-report must be verified by github:LENKIN233/,
  );
});

test('CLI require-ready mode fails closed for the tracked baseline', () => {
  const result = spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'scripts', 'validate_launch_readiness.mjs'),
      '--require-launch-ready',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).ready, false);
});

function gateIdForEvidenceType(evidenceType) {
  for (const [gateId, definition] of Object.entries(GATE_DEFINITIONS)) {
    if (definition.evidenceTypes.includes(evidenceType)) {
      if (
        evidenceType === 'audio-qc-coverage-report' &&
        gateId === 'audio-runtime'
      ) {
        return gateId;
      }
      return gateId;
    }
  }
  throw new Error(`Unknown evidence type ${evidenceType}`);
}

function outerEvidenceForArtifact(evidenceType) {
  return {
    type: evidenceType,
    subject_commit_sha: TEST_COMMIT_SHA,
    verified_at: '2026-07-13T23:00:00.000Z',
    verified_by: 'external:release-auditor',
  };
}

function createValidGateArtifact(gateId, evidenceType) {
  const expectedPolicy = semanticContext.expectedPolicies[gateId];
  const rawRole = `raw-${evidenceType}`;
  const executionModes = {
    'backup-restore-drill': 'receiver_external_apply',
    'clock-boundary-test': 'receiver_fault_injection',
    'offline-replay-test': 'receiver_fault_injection',
    'rollback-drill': 'receiver_external_apply',
  };
  return {
    schema_version: [
      'cross-device-bootstrap-test',
      'offline-replay-test',
      'canonical-state-test',
      'fsrs-version-lock',
      'scheduler-contract-test',
      'clock-boundary-test',
    ].includes(evidenceType)
      ? 'learning-runtime-evidence.v1'
      : [
            'load-test-report',
            'availability-observation',
            'backup-restore-drill',
            'penetration-test-report',
            'rollback-drill',
          ].includes(evidenceType)
        ? 'release-operational-evidence.v1'
        : 'launch-gate-evidence.v1',
    campaign_id:
      gateId === 'release-slo-and-recovery-drill'
        ? 'release-ops-campaign-001'
        : `${gateId}-campaign-001`,
    execution_mode: executionModes[evidenceType] ?? 'receiver_deployed',
    gate_eligible: true,
    result: 'passed',
    subject: {
      repository: 'LENKIN233/softbook_cet',
      commit_sha: TEST_COMMIT_SHA,
      target_release: '2027-Q2',
      gate_id: gateId,
      evidence_type: evidenceType,
      policy_id: expectedPolicy.id,
      policy_sha256: expectedPolicy.sha256,
      environment: {
        profile_id: 'receiver-profile-001',
        profile_sha256: hash('receiver-profile'),
        environment_id: 'receiver-prod-001',
        class: 'production_like_staging',
        receiver_owned: true,
      },
      release: {
        release_id: 'cet4-release-b',
        parent_release_id: 'cet4-release-a',
        content_version: `sha256:${hash('content-version')}`,
        bundle_sha256: hash('release-bundle'),
        backend_deployment_id: 'backend-release-001',
      },
      client_builds: {
        ios: 'ios-build-100',
        android: 'android-build-100',
        pc_web: 'pc-web-build-100',
      },
    },
    execution: {
      started_at: '2026-07-12T00:00:00.000Z',
      completed_at: '2026-07-13T22:00:00.000Z',
      operator: 'team:release-engineering',
      tool: {
        name: 'softbook-evidence-runner',
        version: '1.0.0',
        config_sha256: hash(`config-${evidenceType}`),
      },
    },
    verification: {
      verified_at: '2026-07-13T23:00:00.000Z',
      verified_by: 'external:release-auditor',
      independent: true,
      attestation: {
        provider: 'protected_environment',
        id: `attestation-${evidenceType}`,
        sha256: hash(`attestation-${evidenceType}`),
      },
    },
    raw_artifacts: [
      {
        role: rawRole,
        artifact_uri: `repo://docs/release/evidence/raw/${evidenceType}.json`,
        sha256: hash(`raw-${evidenceType}`),
        size_bytes: 1024,
      },
    ],
    checks: REQUIRED_EVIDENCE_CHECKS[evidenceType].map(id => ({
      id,
      status: 'passed',
      artifact_roles: [rawRole],
    })),
    measurements: createMeasurements(evidenceType, expectedPolicy),
  };
}

function createMeasurements(evidenceType, expectedPolicy) {
  const contentVersion = `sha256:${hash('content-version')}`;
  const learningAssertions = {
    'cross-device-bootstrap-test': {
      same_account_distinct_clients: true,
      one_new_event_committed: true,
      second_client_observed_canonical_event: true,
      server_sequence_stable: true,
      no_client_snapshot_import: true,
    },
    'offline-replay-test': {
      server_committed_before_ack_loss: true,
      byte_equivalent_retry: true,
      duplicate_after_retry: true,
      queue_cleared_only_after_strict_ack: true,
      post_ack_bootstrap_reconciled: true,
    },
    'canonical-state-test': {
      active_session_identity_only: true,
      explicit_empty_state_supported: true,
      content_release_matches: true,
      server_state_wins: true,
      post_replay_state_matches: true,
    },
    'fsrs-version-lock': {
      exact_runtime_library: true,
      exact_policy: true,
      fuzz_disabled: true,
      lockfile_matches_deployment: true,
    },
    'scheduler-contract-test': {
      due_precedes_new: true,
      sleeping_excluded: true,
      membership_access_enforced: true,
      selection_binding_enforced: true,
      duplicate_does_not_advance: true,
    },
    'clock-boundary-test': {
      server_acceptance_time_used: true,
      client_time_does_not_reorder: true,
      future_skew_limit_enforced: true,
      retention_limit_enforced: true,
      utc_plus_8_day_used: true,
    },
  };
  if (evidenceType === 'sms-provider-smoke') {
    return {report_role: 'raw-sms-provider-smoke'};
  }
  if (evidenceType === 'cross-device-bootstrap-test') {
    return {
      account_subject_sha256: hash('account-subject'),
      client_a: {
        platform: 'ios',
        build_id: 'ios-build-100',
        installation_sha256: hash('installation-a'),
      },
      client_b: {
        platform: 'android',
        build_id: 'android-build-100',
        installation_sha256: hash('installation-b'),
      },
      event_payload_sha256: hash('event-payload'),
      accepted_server_sequence: 7,
      observed_server_sequence: 7,
      assertions: learningAssertions[evidenceType],
    };
  }
  if (evidenceType === 'offline-replay-test') {
    return {
      event_id_sha256: hash('event-id'),
      event_payload_sha256: hash('event-payload'),
      retry_payload_sha256: hash('event-payload'),
      device_cursor_sha256: hash('device-cursor'),
      accepted_server_sequence: 7,
      duplicate_server_sequence: 7,
      assertions: learningAssertions[evidenceType],
    };
  }
  if (evidenceType === 'canonical-state-test') {
    return {
      bootstrap_schema_version: 'bootstrap.v2',
      account_subject_sha256: hash('account-subject'),
      content_version: contentVersion,
      canonical_state_sha256: hash('canonical-state'),
      observed_server_sequence: 7,
      assertions: learningAssertions[evidenceType],
    };
  }
  if (evidenceType === 'fsrs-version-lock') {
    return {
      algorithm_id: 'FSRS-6',
      library: 'ts-fsrs',
      library_version: '5.4.1',
      policy_version: 'softbook-fsrs.v1',
      fuzz_enabled: false,
      lockfile_sha256: expectedPolicy.lockfile_sha256,
      assertions: learningAssertions[evidenceType],
    };
  }
  if (evidenceType === 'scheduler-contract-test') {
    return {
      selection_id_sha256: hash('selection-id'),
      selected_card_id: '110101',
      phase: 'review',
      membership_stage: 'premium',
      access_mode: 'full',
      assertions: learningAssertions[evidenceType],
    };
  }
  if (evidenceType === 'clock-boundary-test') {
    return {
      server_acceptance_at: '2026-07-13T12:00:00.000Z',
      earliest_client_time_at: '2026-04-14T11:59:59.000Z',
      latest_client_time_at: '2026-07-13T12:05:01.000Z',
      maximum_future_skew_seconds: 300,
      maximum_past_age_days: 90,
      assertions: learningAssertions[evidenceType],
    };
  }

  const policy = semanticContext.releaseOperationalPolicy;
  if (evidenceType === 'load-test-report') {
    return {
      scenarios: [...policy.load_test.required_scenarios],
      duration_seconds: policy.load_test.minimum_duration_seconds,
      concurrent_users: policy.load_test.minimum_concurrent_users,
      request_count: policy.load_test.minimum_request_count,
      success_count: policy.load_test.minimum_request_count,
      error_count: 0,
      error_ratio: 0,
      p95_latency_ms: 500,
      p99_latency_ms: 800,
      data_integrity_errors: 0,
    };
  }
  if (evidenceType === 'availability-observation') {
    const routes = [...policy.availability.required_routes];
    const routeProbes = Object.fromEntries(
      routes.map(route => [
        route,
        {
          expected_probe_count: 1440,
          success_probe_count: 1440,
          failed_probe_count: 0,
          missing_probe_count: 0,
          availability_ratio: 1,
          p95_latency_ms: 500,
          maximum_single_outage_seconds: 0,
        },
      ]),
    );
    return {
      routes,
      window_started_at: '2026-07-12T00:00:00.000Z',
      window_completed_at: '2026-07-13T00:00:00.000Z',
      probe_interval_seconds: 60,
      route_probes: routeProbes,
      expected_probe_count: 4320,
      success_probe_count: 4320,
      failed_probe_count: 0,
      missing_probe_count: 0,
      availability_ratio: 1,
      p95_latency_ms: 500,
      maximum_single_outage_seconds: 0,
    };
  }
  if (evidenceType === 'backup-restore-drill') {
    const datasets = [...policy.backup_restore.required_datasets];
    return {
      datasets,
      backup_id: 'backup-20260713-001',
      source_environment_id: 'receiver-prod-001',
      restore_environment_id: 'receiver-restore-001',
      source_snapshot_at: '2026-07-13T20:55:00.000Z',
      recovery_reference_at: '2026-07-13T21:00:00.000Z',
      restore_started_at: '2026-07-13T21:00:00.000Z',
      restore_completed_at: '2026-07-13T21:10:00.000Z',
      source_counts: Object.fromEntries(
        datasets.map((dataset, index) => [dataset, index + 10]),
      ),
      restored_counts: Object.fromEntries(
        datasets.map((dataset, index) => [dataset, index + 10]),
      ),
      source_hashes: Object.fromEntries(
        datasets.map(dataset => [dataset, hash(`dataset-${dataset}`)]),
      ),
      restored_hashes: Object.fromEntries(
        datasets.map(dataset => [dataset, hash(`dataset-${dataset}`)]),
      ),
      rpo_seconds: 300,
      rto_seconds: 600,
      production_unchanged: true,
    };
  }
  if (evidenceType === 'penetration-test-report') {
    const emptySeverity = () => ({
      total: 0,
      open: 0,
      resolved: 0,
      waived: 0,
    });
    return {
      scope: [...policy.penetration_test.required_scope],
      methodology: 'OWASP ASVS, MASVS, API Security Top 10, and manual verification',
      tester: 'external:security-lab',
      findings: {
        critical: emptySeverity(),
        high: emptySeverity(),
        medium: emptySeverity(),
        low: emptySeverity(),
        informational: emptySeverity(),
      },
      retested_critical_and_high: 0,
    };
  }
  if (evidenceType === 'rollback-drill') {
    return {
      sequence: [...policy.rollback.required_sequence],
      release_a: 'cet4-release-a',
      release_b: 'cet4-release-b',
      release_b_parent: 'cet4-release-a',
      final_active_release: 'cet4-release-a',
      release_a_verified_before_upgrade: true,
      release_a_retained_before_rollback: true,
      release_b_verified_before_rollback: true,
      release_b_retained_after_rollback: true,
      rollback_started_at: '2026-07-13T21:00:00.000Z',
      rollback_completed_at: '2026-07-13T21:10:00.000Z',
      rto_seconds: 600,
      active_pointer_target_sha256: hash('active-pointer-a'),
      active_pointer_observed_sha256: hash('active-pointer-a'),
      api_content_target_sha256: hash('api-content-a'),
      api_content_observed_sha256: hash('api-content-a'),
      learning_data_count_before: 5,
      learning_data_count_after: 5,
      learning_data_sha256_before: hash('learning-data'),
      learning_data_sha256_after: hash('learning-data'),
      delete_operation_count: 0,
    };
  }
  return {
    scope: 'full release-bound scope',
    summary: 'All registered semantic checks passed.',
  };
}

function createReadyContracts() {
  let sequence = 1;
  const launch = structuredClone(launchContract);
  launch.release_candidate = createReleaseCandidate();
  for (const gate of launch.gates) {
    gate.status = 'passed';
    delete gate.blocked_by;
    gate.evidence = GATE_DEFINITIONS[gate.id].evidenceTypes.map(type =>
      createEvidence(type, sequence++),
    );
  }
  for (const dependency of launch.external_dependencies) {
    dependency.status = 'ready';
  }
  launch.status = 'ready';

  const accounts = structuredClone(accountsContract);
  for (const account of accounts.accounts) {
    assert.deepEqual(
      account.capabilities.map(capability => capability.id),
      EXTERNAL_ACCOUNT_DEFINITIONS[account.id],
    );
    account.status = 'ready';
    for (const capability of account.capabilities) {
      capability.status = 'ready';
      capability.evidence = [
        createEvidence('capability-verification', sequence++),
      ];
    }
  }
  accounts.overall_status = 'ready';
  accounts.last_verified_at = '2026-07-13T23:30:00.000Z';
  return { accounts, launch };
}

function externalCapabilityExpectedPolicy() {
  return {
    ...semanticContext.releaseOperationalPolicy.external_capability,
    evidence_validity_days:
      semanticContext.releaseOperationalPolicy.evidence_validity_days,
    policy_id: semanticContext.releaseOperationalPolicy.policy_id,
    policy_sha256: semanticContext.releasePolicySha256,
  };
}

function createExternalCapabilityArtifact(accountId, capabilityId) {
  const policy = externalCapabilityExpectedPolicy();
  const rawRole = 'provider-observation';
  const rawPayload = externalCapabilityRawPayload(accountId, capabilityId);
  const rawRelativePath = externalCapabilityRawRelativePath(
    accountId,
    capabilityId,
  );
  const requiredChecks = [
    ...policy.common_required_checks,
    ...policy.required_checks[accountId][capabilityId],
  ];
  return {
    schema_version: 'external-capability-evidence.v1',
    capability_eligible: true,
    gate_eligible: false,
    result: 'verified',
    subject: {
      repository: 'LENKIN233/softbook_cet',
      commit_sha: TEST_COMMIT_SHA,
      target_release: '2027-Q2',
      account_id: accountId,
      capability_id: capabilityId,
      policy: {
        id: policy.policy_id,
        sha256: policy.policy_sha256,
      },
    },
    observation: {
      provider_id: accountId,
      provider_subject_sha256: hash(
        `provider-subject:${accountId}:${capabilityId}`,
      ),
      mode:
        accountId === 'china-compliance'
          ? capabilityId === 'privacy-policy-public-url' ||
            capabilityId === 'customer-support-contact'
            ? 'public_endpoint'
            : 'official_registry'
          : 'provider_control_plane',
      observed_at: '2026-07-13T22:55:00.000Z',
      valid_until: null,
    },
    verification: {
      verified_at: '2026-07-13T23:00:00.000Z',
      verified_by: 'github:LENKIN233',
    },
    checks: requiredChecks.map(id => ({
      id,
      result: 'passed',
      artifact_roles: [rawRole],
    })),
    raw_artifacts: [
      {
        role: rawRole,
        artifact_uri: `repo://${rawRelativePath}`,
        sha256: hash(rawPayload),
        size_bytes: Buffer.byteLength(rawPayload),
      },
    ],
  };
}

function writeExternalCapabilityFixture(
  root,
  {accountId, capabilityId, sequence},
) {
  const artifact = createExternalCapabilityArtifact(accountId, capabilityId);
  const rawRelativePath = externalCapabilityRawRelativePath(
    accountId,
    capabilityId,
  );
  const rawPath = path.join(root, rawRelativePath);
  fs.mkdirSync(path.dirname(rawPath), {recursive: true});
  fs.writeFileSync(
    rawPath,
    externalCapabilityRawPayload(accountId, capabilityId),
  );
  const reportRelativePath =
    `docs/release/evidence/external-${accountId}-${capabilityId}-${sequence}.json`;
  const reportPath = path.join(root, reportRelativePath);
  const fixture = {
    artifact,
    evidence: createEvidence('capability-verification', sequence, {
      artifactUri: `repo://${reportRelativePath}`,
    }),
    rawPath,
    rawRelativePath,
    reportPath,
    reportRelativePath,
  };
  rewriteExternalCapabilityReport(fixture);
  fixture.trackedFiles = new Set([rawRelativePath, reportRelativePath]);
  return fixture;
}

function rewriteExternalCapabilityReport(fixture) {
  fixture.reportPayload = `${JSON.stringify(fixture.artifact, null, 2)}\n`;
  fs.mkdirSync(path.dirname(fixture.reportPath), {recursive: true});
  fs.writeFileSync(fixture.reportPath, fixture.reportPayload);
  fixture.evidence.artifact_sha256 = hash(fixture.reportPayload);
  fixture.evidence.artifact_size_bytes = Buffer.byteLength(
    fixture.reportPayload,
  );
}

function externalCapabilityRawRelativePath(accountId, capabilityId) {
  return `docs/release/evidence/raw/external-${accountId}-${capabilityId}.json`;
}

function externalCapabilityRawPayload(accountId, capabilityId) {
  return `${JSON.stringify({
    account_id: accountId,
    capability_id: capabilityId,
    observation: 'redacted-provider-control-plane-record',
  })}\n`;
}

function createReleaseCandidate() {
  return {
    schema_version: 'launch-release-candidate.v1',
    repository: 'LENKIN233/softbook_cet',
    commit_sha: TEST_COMMIT_SHA,
    target_release: '2027-Q2',
    environment: {
      profile_id: 'receiver-profile-001',
      profile_sha256: hash('receiver-profile'),
      environment_id: 'receiver-prod-001',
      class: 'production_like_staging',
      receiver_owned: true,
    },
    release: {
      release_id: 'cet4-release-b',
      parent_release_id: 'cet4-release-a',
      content_version: `sha256:${hash('content-version')}`,
      bundle_sha256: hash('release-bundle'),
      backend_deployment_id: 'backend-release-001',
    },
    client_builds: {
      ios: 'ios-build-100',
      android: 'android-build-100',
      pc_web: 'pc-web-build-100',
    },
    recorded_at: '2026-07-13T23:00:00.000Z',
    recorded_by: 'github:LENKIN233',
  };
}

function createEvidence(type, sequence, { artifactUri, payload } = {}) {
  const body = payload ?? `softbook-readiness-evidence:${type}:${sequence}`;
  const sizeBytes = Buffer.isBuffer(body)
    ? body.length
    : Buffer.byteLength(body, 'utf8');
  return {
    type,
    artifact_uri:
      artifactUri ?? `repo://docs/release/evidence/evidence-${sequence}.json`,
    artifact_sha256: createHash('sha256').update(body).digest('hex'),
    artifact_size_bytes: sizeBytes,
    subject_commit_sha: TEST_COMMIT_SHA,
    verified_at: '2026-07-13T23:00:00.000Z',
    verified_by: 'github:LENKIN233',
  };
}

function smsProviderSmokeReport() {
  return {
    schema_version: 'sms-provider-smoke.v1',
    run_id: 'sms-smoke-123e4567-e89b-12d3-a456-426614174000',
    status: 'passed',
    target_id: 'receiver-prod-001',
    repository_commit: TEST_COMMIT_SHA,
    provider: 'tencentcloud',
    delivery: 'sms_tencentcloud',
    provider_configuration_fingerprint:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    provider_receipt: {
      provider_request_fingerprint:
        'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      provider_status_code: null,
    },
    phone_fingerprint:
      '123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0',
    sent_at: '2026-07-13T22:58:00.000Z',
    confirmed_at: '2026-07-13T23:00:00.000Z',
    expires_at: '2026-07-13T23:03:00.000Z',
    confirmation_method: 'human_received_code_match',
    verifier: { kind: 'human', id: 'external:release-auditor' },
    private_state_removed: true,
    generated_at: '2026-07-13T23:00:00.000Z',
  };
}

function createAndroidSignedReleaseReport() {
  return {
    schema_version: 'android-signed-release.v1',
    status: 'passed',
    platform: 'android',
    target_id: 'receiver-beta',
    repository_commit: TEST_COMMIT_SHA,
    application_id: 'com.softbook.cet',
    version_code: 1,
    version_name: '1.0.0',
    artifact: {
      filename: 'app-release.apk',
      sha256: '0123456789abcdef'.repeat(4),
      size_bytes: 123456,
      archive_url:
        'https://github.com/LENKIN233/softbook_cet/releases/download/android-beta-1/app-release.apk',
    },
    signing: {
      certificate_sha256: 'abcdef0123456789'.repeat(4),
      signature_schemes: {
        v1: true,
        v2: true,
        v3: false,
        v3_1: false,
        v4: false,
      },
      verifier: 'android-sdk-apksigner',
      verifier_version: '35.0.0',
    },
    built_at: '2026-07-13T22:00:00.000Z',
    archived_verified_at: '2026-07-13T23:00:00.000Z',
    verified_by: 'github:LENKIN233',
    private_state_removed: true,
    generated_at: '2026-07-13T23:00:00.000Z',
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}
