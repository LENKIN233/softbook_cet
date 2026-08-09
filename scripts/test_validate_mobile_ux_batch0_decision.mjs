#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  BOUND_FILES,
  DECISION_PATH,
  EXPECTED_PULL_REQUEST,
  EXPECTED_REPOSITORY,
  EXPECTED_SUBJECT_DIGEST,
  sha256,
  validateBatch0Decision,
} from './validate_mobile_ux_batch0_decision.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VALIDATOR = path.join(ROOT, 'scripts', 'validate_mobile_ux_batch0_decision.mjs');

function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function write(root, relativePath, value) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
}

function decisionText({ baseline, hashes, extra = '', body = '# Batch 0\n' }) {
  const boundFields = BOUND_FILES.flatMap(binding => [
    `${binding.pathField}: ${binding.path}`,
    `${binding.shaField}: ${hashes[binding.name]}`,
  ]);
  return [
    '---',
    'status: effective_iff_pr_484_exact_head_has_protected_product_owner_approval',
    'classification: product_owner_governance_decision',
    'decision_id: mobile-ux-checkpoint-layering-decision-v1',
    'contract_version: mobile-ux-checkpoint-contract-v1',
    'decision: accept_topology_with_fail_closed_batch_1_manifest_preparation_scope',
    'decision_owner: github:LENKIN233',
    `approval_subject_repository: ${EXPECTED_REPOSITORY}`,
    `approval_subject_pull_request: ${EXPECTED_PULL_REQUEST}`,
    `evidence_baseline_commit: ${baseline}`,
    'activation_authority: formal-product-owner-approval',
    'gate_effect: batch_0_topology_and_batch_1_manifest_preparation_only',
    ...boundFields,
    extra,
    '---',
    '',
    body,
  ]
    .filter(line => line !== '')
    .join('\n') + '\n';
}

function createFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-batch0-decision-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  git(root, 'init', '-q');
  git(root, 'config', 'user.name', 'Batch0 Test');
  git(root, 'config', 'user.email', 'batch0@example.invalid');

  write(root, 'baseline.txt', 'baseline\n');
  git(root, 'add', 'baseline.txt');
  git(root, 'commit', '-qm', 'baseline');
  const baseline = git(root, 'rev-parse', 'HEAD');

  const hashes = {};
  for (const [index, binding] of BOUND_FILES.entries()) {
    const content = `bound-${index}-${binding.name}\n`;
    write(root, binding.path, content);
    hashes[binding.name] = sha256(Buffer.from(content));
  }
  write(root, DECISION_PATH, decisionText({ baseline, hashes }));
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'decision subject');
  const head = git(root, 'rev-parse', 'HEAD');
  return { root, baseline, hashes, head };
}

function createPinnedExactSubject(t) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-batch0-pinned-'));
  t.after(() => fs.rmSync(parent, { force: true, recursive: true }));
  const root = path.join(parent, 'repository');
  const clone = spawnSync('git', ['clone', '--no-local', '-q', ROOT, root], {
    encoding: 'utf8',
  });
  assert.equal(clone.status, 0, clone.stderr);
  git(root, 'config', 'user.name', 'Batch0 Test');
  git(root, 'config', 'user.email', 'batch0@example.invalid');
  for (const relativePath of [DECISION_PATH, ...BOUND_FILES.map(item => item.path)]) {
    const source = path.join(ROOT, relativePath);
    const destination = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
  git(root, 'add', DECISION_PATH, ...BOUND_FILES.map(item => item.path));
  git(root, 'commit', '-qm', 'exact pinned Batch 0 subject');
  return { root, head: git(root, 'rev-parse', 'HEAD') };
}

function exactOptions(fixture, overrides = {}) {
  return {
    root: fixture.root,
    gitRoot: fixture.root,
    requiredSubjectDigest: null,
    repository: EXPECTED_REPOSITORY,
    pullRequest: String(EXPECTED_PULL_REQUEST),
    headSha: fixture.head,
    ...overrides,
  };
}

function staticOptions(fixture, overrides = {}) {
  return {
    root: fixture.root,
    gitRoot: fixture.root,
    requiredSubjectDigest: null,
    ...overrides,
  };
}

function replaceDecision(root, pattern, replacement) {
  const decision = path.join(root, DECISION_PATH);
  const source = fs.readFileSync(decision, 'utf8');
  assert.match(source, pattern);
  fs.writeFileSync(decision, source.replace(pattern, replacement));
}

test('valid static subject binds all five files without claiming approval', t => {
  const fixture = createFixture(t);
  const result = validateBatch0Decision(staticOptions(fixture));

  assert.equal(result.status, 'passed');
  assert.equal(result.validation_mode, 'static_worktree_subject');
  assert.equal(result.activation_eligible, false);
  assert.equal(result.head_sha, null);
  assert.equal(result.bound_files.length, 5);
  assert.match(result.subject_digest, /^[0-9a-f]{64}$/);
  assert.match(result.non_claim, /not Batch 0 approval/);
});

test('exact PR 484 Git subject validates repository, ancestry, and head bytes', t => {
  const fixture = createFixture(t);
  const result = validateBatch0Decision(exactOptions(fixture));

  assert.equal(result.validation_mode, 'exact_pr_head_subject');
  assert.equal(result.activation_eligible, true);
  assert.equal(result.head_sha, fixture.head);
  assert.equal(result.evidence_baseline_commit, fixture.baseline);
  assert.match(result.approval_instance_digest, /^[0-9a-f]{64}$/);
  assert.match(result.non_claim, /does not replace protected environment approval/);
});

test('missing, duplicate, unknown, and legacy frontmatter fields fail closed', async t => {
  for (const mutation of [
    {
      name: 'missing pull request',
      pattern: /^approval_subject_pull_request:.*\n/m,
      replacement: '',
      error: /missing frontmatter fields: approval_subject_pull_request/,
    },
    {
      name: 'duplicate decision ID',
      pattern: /^decision_id:.*$/m,
      replacement:
        'decision_id: mobile-ux-checkpoint-layering-decision-v1\ndecision_id: mobile-ux-checkpoint-layering-decision-v1',
      error: /duplicates frontmatter field decision_id/,
    },
    {
      name: 'unknown field',
      pattern: /^gate_effect:.*$/m,
      replacement:
        'gate_effect: batch_0_topology_and_batch_1_manifest_preparation_only\nunreviewed_override: true',
      error: /unsupported frontmatter fields: unreviewed_override/,
    },
    {
      name: 'legacy baseline name',
      pattern: /^evidence_baseline_commit:/m,
      replacement: 'repository_subject_commit:',
      error: /missing frontmatter fields: evidence_baseline_commit/,
    },
  ]) {
    await t.test(mutation.name, subtest => {
      const fixture = createFixture(subtest);
      replaceDecision(fixture.root, mutation.pattern, mutation.replacement);
      assert.throws(
        () => validateBatch0Decision(staticOptions(fixture)),
        mutation.error,
      );
    });
  }
});

test('path substitution and bound-byte drift fail closed', async t => {
  await t.test('path substitution', subtest => {
    const fixture = createFixture(subtest);
    replaceDecision(
      fixture.root,
      new RegExp(`^${BOUND_FILES[0].pathField}:.*$`, 'm'),
      `${BOUND_FILES[0].pathField}: docs/design/decisions/lookalike.md`,
    );
    assert.throws(
      () => validateBatch0Decision(staticOptions(fixture)),
      /bound_checkpoint_contract_path must equal/,
    );
  });

  await t.test('byte drift', subtest => {
    const fixture = createFixture(subtest);
    fs.appendFileSync(path.join(fixture.root, BOUND_FILES[2].path), 'drift\n');
    assert.throws(
      () => validateBatch0Decision(staticOptions(fixture)),
      /browser-evidence\.md SHA-256 drift/,
    );
  });
});

test('ordinary or unrelated formal approval cannot activate Batch 0', t => {
  const fixture = createFixture(t);
  assert.throws(
    () => validateBatch0Decision(exactOptions(fixture, { pullRequest: '485' })),
    /ordinary or unrelated approval cannot activate Batch 0/,
  );
  assert.throws(
    () => validateBatch0Decision(exactOptions(fixture, { repository: 'LENKIN233/other' })),
    /approval repository must be/,
  );
});

test('exact-head mode reads committed blobs rather than mutable worktree bytes', t => {
  const fixture = createFixture(t);
  fs.appendFileSync(path.join(fixture.root, BOUND_FILES[1].path), 'uncommitted drift\n');

  assert.throws(
    () => validateBatch0Decision(staticOptions(fixture)),
    /decision-proposal\.md SHA-256 drift/,
  );
  assert.equal(validateBatch0Decision(exactOptions(fixture)).status, 'passed');
});

test('decision and re-bound source changes cannot inherit an earlier subject digest', async t => {
  await t.test('decision bytes', subtest => {
    const fixture = createFixture(subtest);
    const original = validateBatch0Decision(exactOptions(fixture));
    replaceDecision(fixture.root, /# Batch 0/, '# Batch 0 changed');
    git(fixture.root, 'add', DECISION_PATH);
    git(fixture.root, 'commit', '-qm', 'change decision bytes');
    fixture.head = git(fixture.root, 'rev-parse', 'HEAD');

    const changed = validateBatch0Decision(exactOptions(fixture));
    assert.notEqual(changed.subject_digest, original.subject_digest);
    assert.throws(
      () =>
        validateBatch0Decision(
          exactOptions(fixture, { inheritSubjectDigest: original.subject_digest }),
        ),
      /Batch 0 inheritance subject drift/,
    );
  });

  await t.test('bound bytes with refreshed hash', subtest => {
    const fixture = createFixture(subtest);
    const original = validateBatch0Decision(exactOptions(fixture));
    const binding = BOUND_FILES[4];
    const changedBytes = Buffer.from('new pc web mapping bytes\n');
    write(fixture.root, binding.path, changedBytes);
    replaceDecision(
      fixture.root,
      new RegExp(`^${binding.shaField}: [0-9a-f]{64}$`, 'm'),
      `${binding.shaField}: ${sha256(changedBytes)}`,
    );
    git(fixture.root, 'add', binding.path, DECISION_PATH);
    git(fixture.root, 'commit', '-qm', 'rebind source bytes');
    fixture.head = git(fixture.root, 'rev-parse', 'HEAD');

    const changed = validateBatch0Decision(exactOptions(fixture));
    assert.notEqual(changed.subject_digest, original.subject_digest);
    assert.throws(
      () =>
        validateBatch0Decision(
          exactOptions(fixture, { inheritSubjectDigest: original.subject_digest }),
        ),
      /Batch 0 inheritance subject drift/,
    );
  });
});

test('missing head, malformed baseline, and non-ancestor baseline fail closed', async t => {
  await t.test('partial runtime arguments', subtest => {
    const fixture = createFixture(subtest);
    assert.throws(
      () =>
        validateBatch0Decision({
          ...staticOptions(fixture),
          repository: EXPECTED_REPOSITORY,
        }),
      /must be supplied together/,
    );
  });

  await t.test('malformed baseline', subtest => {
    const fixture = createFixture(subtest);
    replaceDecision(
      fixture.root,
      /^evidence_baseline_commit:.*$/m,
      'evidence_baseline_commit: HEAD',
    );
    assert.throws(
      () => validateBatch0Decision(staticOptions(fixture)),
      /must be a lowercase full Git SHA-1/,
    );
  });

  await t.test('non-ancestor baseline', subtest => {
    const fixture = createFixture(subtest);
    git(fixture.root, 'checkout', '--orphan', 'unrelated');
    for (const entry of fs.readdirSync(fixture.root)) {
      if (entry !== '.git') fs.rmSync(path.join(fixture.root, entry), { force: true, recursive: true });
    }
    for (const [index, binding] of BOUND_FILES.entries()) {
      write(fixture.root, binding.path, `bound-${index}-${binding.name}\n`);
    }
    write(
      fixture.root,
      DECISION_PATH,
      decisionText({ baseline: fixture.baseline, hashes: fixture.hashes }),
    );
    git(fixture.root, 'add', '.');
    git(fixture.root, 'commit', '-qm', 'unrelated head');
    const unrelatedHead = git(fixture.root, 'rev-parse', 'HEAD');
    assert.throws(
      () =>
        validateBatch0Decision(
          exactOptions(fixture, { headSha: unrelatedHead }),
        ),
      /is not an ancestor of exact approval head/,
    );
  });
});

test('CLI pins the repository subject and never treats fixture approval as Batch 0', t => {
  const fixture = createFixture(t);
  const output = path.join(fixture.root, 'github-output.txt');
  const unrelated = spawnSync(
    process.execPath,
    [
      VALIDATOR,
      '--git-root',
      fixture.root,
      '--repository',
      EXPECTED_REPOSITORY,
      '--pull-request',
      String(EXPECTED_PULL_REQUEST),
      '--head-sha',
      fixture.head,
      '--github-output',
      output,
      '--json',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.equal(unrelated.status, 1);
  assert.match(unrelated.stderr, /pinned Batch 0 subject drift/);

  const pinned = createPinnedExactSubject(t);
  const result = spawnSync(
    process.execPath,
    [
      VALIDATOR,
      '--git-root',
      pinned.root,
      '--repository',
      EXPECTED_REPOSITORY,
      '--pull-request',
      String(EXPECTED_PULL_REQUEST),
      '--head-sha',
      pinned.head,
      '--github-output',
      output,
      '--json',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.validation_mode, 'exact_pr_head_subject');
  assert.equal(payload.subject_digest, EXPECTED_SUBJECT_DIGEST);
  assert.equal(payload.pinned_subject_digest, EXPECTED_SUBJECT_DIGEST);
  assert.match(payload.non_claim, /does not replace protected environment approval/);
  const githubOutput = fs.readFileSync(output, 'utf8');
  assert.match(githubOutput, new RegExp(`^subject_digest=${EXPECTED_SUBJECT_DIGEST}$`, 'm'));
  assert.match(githubOutput, /^approval_instance_digest=[0-9a-f]{64}$/m);
  assert.match(githubOutput, /^activation_eligible=true$/m);
});
