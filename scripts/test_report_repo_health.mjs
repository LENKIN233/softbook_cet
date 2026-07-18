#!/usr/bin/env node

import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-repo-health-'));
const linkedRoot = `${tempRoot}-linked`;
const remoteRoot = `${tempRoot}-remote.git`;
const fakeBin = `${tempRoot}-fake-bin`;

try {
  fs.mkdirSync(path.join(tempRoot, 'scripts'));
  fs.copyFileSync(
    path.join(ROOT, 'scripts', 'report_repo_health.mjs'),
    path.join(tempRoot, 'scripts', 'report_repo_health.mjs'),
  );
  git('init', '-b', 'main');
  git('config', 'user.email', 'repo-health@example.invalid');
  git('config', 'user.name', 'Repository Health Test');
  fs.writeFileSync(path.join(tempRoot, 'README.md'), 'baseline\n');
  git('add', 'README.md', 'scripts/report_repo_health.mjs');
  git('commit', '-m', 'baseline');
  const base = git('rev-parse', 'HEAD');

  fs.writeFileSync(path.join(tempRoot, 'transient.bin'), Buffer.alloc(2 * 1024 * 1024));
  git('add', 'transient.bin');
  git('commit', '-m', 'introduce oversized blob');
  fs.rmSync(path.join(tempRoot, 'transient.bin'));
  git('add', '-u');
  git('commit', '-m', 'remove oversized blob');

  const result = spawnSync(
    process.execPath,
    ['scripts/report_repo_health.mjs', '--base', base, '--strict'],
    {cwd: tempRoot, encoding: 'utf8'},
  );
  const report = JSON.parse(result.stdout);

  assert.notEqual(result.status, 0, 'transient oversized blob must fail');
  assert.equal(report.ok, false);
  assert.ok(
    report.errors.some(error => error.code === 'ordinary_git_blob_too_large'),
  );
  assert.ok(report.metrics.introduced_blobs > 0);
  console.log('PASS: repository health rejects introduced-and-deleted blobs.');

  fs.mkdirSync(fakeBin);
  const fakeGh = path.join(fakeBin, 'gh');
  fs.writeFileSync(
    fakeGh,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
const checks = [
  'design-artifact-gate',
  'validate-harness',
  'agent-review',
  'mobile-quality',
  'backend-contract',
  'dependency-security',
  'ios-release',
  'repo-health',
  'evidence-archive',
  'formal-approval',
];
if (args[0] === 'repo' && args[1] === 'view') {
  process.stdout.write('LENKIN233/softbook_cet\\n');
} else if (args[0] === 'api') {
  const endpoint = args[1];
  if (endpoint.endsWith('/branches/main/protection/required_signatures')) {
    if (process.env.SIGNATURES_MISSING === 'true') process.exit(1);
    process.stdout.write(JSON.stringify({enabled: true}));
  } else if (endpoint.endsWith('/branches/main/protection')) {
    if (process.env.BRANCH_PROTECTION_FORBIDDEN === 'true') {
      process.stderr.write('gh: Resource not accessible by integration (HTTP 403)\\n');
      process.exit(1);
    }
    if (process.env.BRANCH_PROTECTION_MISSING === 'true') {
      process.stderr.write('gh: Branch not protected (HTTP 404)\\n');
      process.exit(1);
    }
    process.stdout.write(JSON.stringify({
      required_status_checks: {strict: true, contexts: checks},
      required_pull_request_reviews: {},
      enforce_admins: {enabled: true},
      required_conversation_resolution: {enabled: true},
      required_linear_history: {enabled: true},
      allow_force_pushes: {enabled: false},
      allow_deletions: {enabled: false},
    }));
  } else if (endpoint.endsWith('/environments/formal-product-owner-approval')) {
    if (process.env.FORMAL_ENV_MISSING === 'true') process.exit(1);
    const reviewers = process.env.FORMAL_REVIEWER_MISSING === 'true'
      ? []
      : [{type: 'User', reviewer: {login: 'LENKIN233'}}];
    process.stdout.write(JSON.stringify({
      name: 'formal-product-owner-approval',
      can_admins_bypass: process.env.FORMAL_ADMIN_BYPASS === 'true',
      protection_rules: [{
        type: 'required_reviewers',
        prevent_self_review: false,
        reviewers,
      }],
    }));
  } else if (endpoint === 'repos/LENKIN233/softbook_cet') {
    if (process.env.REPOSITORY_SETTINGS_MISSING === 'true') process.exit(1);
    process.stdout.write(JSON.stringify({
      allow_squash_merge: true,
      allow_merge_commit: false,
      allow_rebase_merge: false,
    }));
  } else {
    process.exit(1);
  }
} else {
  process.exit(1);
}
`,
  );
  fs.chmodSync(fakeGh, 0o755);

  const remoteArgs = [
    'scripts/report_repo_health.mjs',
    '--full-tree',
    '--remote',
    '--strict',
  ];
  const remoteEnvironment = overrides => ({
    ...process.env,
    PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
    ...overrides,
  });
  const healthyRemote = spawnSync(process.execPath, remoteArgs, {
    cwd: tempRoot,
    encoding: 'utf8',
    env: remoteEnvironment({}),
  });
  const healthyRemoteReport = JSON.parse(healthyRemote.stdout);
  assert.equal(
    healthyRemote.status,
    0,
    `${healthyRemote.stderr}\n${healthyRemote.stdout}`,
  );
  assert.equal(healthyRemoteReport.ok, true);
  assert.deepEqual(healthyRemoteReport.remote.formal_approval.reviewers, ['LENKIN233']);

  for (const [environment, expectedCode] of [
    [{FORMAL_ADMIN_BYPASS: 'true'}, 'formal_approval_admin_bypass_enabled'],
    [{FORMAL_REVIEWER_MISSING: 'true'}, 'formal_approval_reviewer_drift'],
    [{FORMAL_ENV_MISSING: 'true'}, 'formal_approval_environment_unavailable'],
    [{SIGNATURES_MISSING: 'true'}, 'required_signatures_unavailable'],
    [{REPOSITORY_SETTINGS_MISSING: 'true'}, 'remote_repository_settings_unavailable'],
    [{BRANCH_PROTECTION_FORBIDDEN: 'true'}, 'branch_protection_unavailable'],
    [{BRANCH_PROTECTION_MISSING: 'true'}, 'main_branch_unprotected'],
  ]) {
    const driftResult = spawnSync(process.execPath, remoteArgs, {
      cwd: tempRoot,
      encoding: 'utf8',
      env: remoteEnvironment(environment),
    });
    const driftReport = JSON.parse(driftResult.stdout);
    assert.notEqual(driftResult.status, 0, `${expectedCode} must fail`);
    assert.ok(driftReport.errors.some(error => error.code === expectedCode));
    if (expectedCode === 'branch_protection_unavailable') {
      const finding = driftReport.errors.find(error => error.code === expectedCode);
      assert.equal(finding.http_status, 403);
      assert.equal(driftReport.remote.protected, null);
    }
    if (expectedCode === 'main_branch_unprotected') {
      assert.equal(driftReport.remote.protected, false);
    }
  }
  console.log('PASS: repository health fails closed on formal approval environment drift.');

  execFileSync('git', ['init', '--bare', remoteRoot], {stdio: 'ignore'});
  git('remote', 'add', 'origin', remoteRoot);
  git('push', '--set-upstream', 'origin', 'main');
  git('branch', 'gone');
  git('push', '--set-upstream', 'origin', 'gone');
  git('push', 'origin', '--delete', 'gone');
  git('worktree', 'add', '-b', 'topic', linkedRoot);
  fs.writeFileSync(path.join(linkedRoot, 'dirty.txt'), 'dirty linked worktree\n');
  fs.writeFileSync(path.join(tempRoot, 'stash.txt'), 'stashed state\n');
  git('stash', 'push', '--include-untracked', '-m', 'health test stash');

  const workspaceResult = spawnSync(
    process.execPath,
    [
      'scripts/report_repo_health.mjs',
      '--full-tree',
      '--strict',
      '--expected-max-worktrees',
      '1',
      '--expected-max-stashes',
      '0',
      '--expected-max-topic-branches',
      '0',
      '--require-upstreams',
    ],
    {cwd: tempRoot, encoding: 'utf8'},
  );
  const workspaceReport = JSON.parse(workspaceResult.stdout);
  const errorCodes = new Set(workspaceReport.errors.map(error => error.code));

  assert.notEqual(workspaceResult.status, 0, 'workspace hygiene violations must fail');
  assert.ok(errorCodes.has('dirty_worktree'));
  assert.ok(errorCodes.has('worktree_limit_exceeded'));
  assert.ok(errorCodes.has('stash_limit_exceeded'));
  assert.ok(errorCodes.has('topic_branch_limit_exceeded'));
  assert.ok(errorCodes.has('branch_upstream_missing'));
  assert.ok(errorCodes.has('gone_local_branches'));
  assert.equal(workspaceReport.metrics.worktrees, 2);
  assert.equal(workspaceReport.metrics.dirty_worktrees, 1);
  assert.equal(workspaceReport.metrics.stashes, 1);
  assert.equal(workspaceReport.metrics.topic_branches, 2);
  assert.equal(workspaceReport.metrics.gone_branches, 1);
  assert.equal(workspaceReport.metrics.branches_without_upstream, 1);
  console.log('PASS: repository health checks every worktree, stash, and branch.');
} finally {
  spawnSync('git', ['worktree', 'remove', '--force', linkedRoot], {cwd: tempRoot, stdio: 'ignore'});
  fs.rmSync(linkedRoot, {force: true, recursive: true});
  fs.rmSync(fakeBin, {force: true, recursive: true});
  fs.rmSync(remoteRoot, {force: true, recursive: true});
  fs.rmSync(tempRoot, {force: true, recursive: true});
}

function git(...args) {
  return execFileSync('git', args, {cwd: tempRoot, encoding: 'utf8'}).trim();
}
