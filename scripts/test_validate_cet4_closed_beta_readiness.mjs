#!/usr/bin/env node

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {
  CET4_CLOSED_BETA_DEPENDENCY_IDS,
  CET4_CLOSED_BETA_GATE_DEFINITIONS,
  validateCet4ClosedBetaReadiness,
} from './validate_cet4_closed_beta_readiness.mjs';

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
  assert.match(result.errors.join('\n'), /formal evidence ingestion is not implemented/);
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

function validCandidate() {
  return {
    schema_version: 'cet4-closed-beta-release-candidate.v1',
    repository: 'LENKIN233/softbook_cet',
    commit_sha: hash('candidate-commit').slice(0, 40),
    target_release: 'cet4-closed-beta',
    recorded_at: '2026-08-23T12:00:00.000Z',
    recorded_by: 'github:LENKIN233',
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
      full_track_approval_sha256: hash('approval'),
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
    verified_by: 'external:closed-beta-auditor',
    subject_commit_sha: hash('candidate-commit').slice(0, 40),
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}
