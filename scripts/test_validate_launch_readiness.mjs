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
  validateExternalAccountReadiness,
  validateLaunchReadiness,
  verifyRepositoryEvidenceFiles,
} from './validate_launch_readiness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOW = new Date('2026-07-14T00:00:00.000Z');
const launchContract = readJson(
  path.join(ROOT, 'docs', 'release', 'launch-readiness.v1.json'),
);
const accountsContract = readJson(
  path.join(ROOT, 'docs', 'release', 'external-account-readiness.v1.json'),
);

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

test('all fixed product scope, gates, accounts, and capabilities can reach ready', () => {
  const { accounts, launch } = createReadyContracts();

  const launchResult = validateLaunchReadiness(launch, { now: NOW });
  const accountResult = validateExternalAccountReadiness(accounts, launch, {
    now: NOW,
  });

  assert.equal(launchResult.ok, true, launchResult.errors.join('\n'));
  assert.equal(launchResult.ready, true);
  assert.equal(accountResult.ok, true, accountResult.errors.join('\n'));
  assert.equal(accountResult.ready, true);
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
  const evidencePath = path.join(
    root,
    'docs',
    'release',
    'evidence',
    'staging-deployment.json',
  );
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, '{"status":"passed"}\n');

  const launch = structuredClone(launchContract);
  launch.gates[0].evidence = [
    createEvidence('dev-environment-isolation', 900, {
      artifactUri: 'repo://docs/release/evidence/staging-deployment.json',
      payload: fs.readFileSync(evidencePath),
    }),
  ];
  const first = verifyRepositoryEvidenceFiles(launch, accountsContract, {
    root,
  });
  assert.equal(first.ok, true, first.errors.join('\n'));

  fs.appendFileSync(evidencePath, 'mutated\n');
  const second = verifyRepositoryEvidenceFiles(launch, accountsContract, {
    root,
  });
  assert.equal(second.ok, false);
  assert.match(second.errors.join('\n'), /SHA-256 does not match/);
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
  const launch = structuredClone(launchContract);
  launch.gates[0].evidence = [
    createEvidence('dev-environment-isolation', 901, {
      artifactUri: 'repo://docs/release/evidence/linked.json',
      payload: fs.readFileSync(outside),
    }),
  ];

  const result = verifyRepositoryEvidenceFiles(launch, accountsContract, {
    root,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /must be a regular file/);
});

test('repository evidence must be tracked by Git', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-readiness-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const relativePath = 'docs/release/evidence/untracked.json';
  const evidencePath = path.join(root, relativePath);
  const payload = '{"status":"passed"}\n';
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, payload);

  const launch = structuredClone(launchContract);
  launch.gates[0].evidence = [
    createEvidence('dev-environment-isolation', 902, {
      artifactUri: `repo://${relativePath}`,
      payload,
    }),
  ];

  const untracked = verifyRepositoryEvidenceFiles(launch, accountsContract, {
    root,
    trackedFiles: new Set(),
  });
  assert.equal(untracked.ok, false);
  assert.match(untracked.errors.join('\n'), /must be tracked by Git/);

  const tracked = verifyRepositoryEvidenceFiles(launch, accountsContract, {
    root,
    trackedFiles: new Set([relativePath]),
  });
  assert.equal(tracked.ok, true, tracked.errors.join('\n'));
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

function createReadyContracts() {
  let sequence = 1;
  const launch = structuredClone(launchContract);
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
    verified_at: '2026-07-13T23:00:00.000Z',
    verified_by: 'github:LENKIN233',
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
