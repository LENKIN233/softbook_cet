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
    [
      'scripts/report_repo_health.mjs',
      '--profile',
      'local',
      '--base',
      base,
      '--strict',
    ],
    {cwd: tempRoot, encoding: 'utf8'},
  );
  const report = JSON.parse(result.stdout);

  assert.notEqual(result.status, 0, 'transient oversized blob must fail');
  assert.equal(report.ok, false);
  assert.equal(report.profile, 'local');
  assert.equal(report.remote, null);
  assert.equal(report.metrics.workspace_topology_checked, false);
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
if (process.env.FAIL_ON_GH === 'true') {
  process.stderr.write('gh must not run in local repository-health profile\\n');
  process.exit(97);
}
const checks = [
  'design-artifact-gate',
  'validate-harness',
  'trusted-model-review',
  'mobile-quality',
  'web-quality',
  'backend-contract',
  'dependency-security',
  'ios-release',
  'android-release',
  'repo-health',
  'evidence-archive',
];
if (process.env.MISSING_ANDROID_RELEASE === 'true') {
  checks.splice(checks.indexOf('android-release'), 1);
}
if (process.env.EXTRA_REQUIRED_CHECK === 'true') {
  checks.push('unexpected-check');
}
if (args[0] === 'repo' && args[1] === 'view') {
  process.stdout.write(JSON.stringify({nameWithOwner: 'LENKIN233/softbook_cet'}));
} else if (args[0] === 'api') {
  const endpoint = args[1];
  if (endpoint === 'graphql') {
    if (process.env.REPOSITORY_SETTINGS_MALFORMED === 'true') {
      process.stdout.write('null');
    } else {
      const repository = {
        nameWithOwner: process.env.GRAPHQL_REPOSITORY_MISMATCH === 'true'
          ? 'LENKIN233/other-repository'
          : 'LENKIN233/softbook_cet',
      };
      if (process.env.REPOSITORY_SETTINGS_MISSING !== 'true') {
        repository.defaultBranchRef = {
          name: process.env.DEFAULT_BRANCH_DRIFT === 'true'
            ? 'develop'
            : 'main',
        };
        repository.autoMergeAllowed = process.env.AUTO_MERGE_DISABLED !== 'true';
        repository.deleteBranchOnMerge = process.env.DELETE_BRANCH_DISABLED !== 'true';
        repository.squashMergeAllowed = process.env.MERGE_METHOD_DRIFT !== 'true';
        repository.mergeCommitAllowed = process.env.MERGE_METHOD_DRIFT === 'true';
        repository.rebaseMergeAllowed = false;
      }
      process.stdout.write(JSON.stringify({data: {repository}}));
    }
  } else if (endpoint === 'repos/LENKIN233/softbook_cet') {
    process.stderr.write('REST repository settings must not be used\\n');
    process.exit(1);
  } else if (endpoint.endsWith('/branches/main/protection/required_signatures')) {
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
    '--profile',
    'remote',
    '--full-tree',
    '--strict',
  ];
  const remoteEnvironment = overrides => ({
    ...process.env,
    PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
    ...overrides,
  });
  const isolatedLocal = spawnSync(
    process.execPath,
    [
      'scripts/report_repo_health.mjs',
      '--profile',
      'local',
      '--full-tree',
      '--strict',
    ],
    {
      cwd: tempRoot,
      encoding: 'utf8',
      env: remoteEnvironment({FAIL_ON_GH: 'true'}),
    },
  );
  const isolatedLocalReport = JSON.parse(isolatedLocal.stdout);
  assert.equal(
    isolatedLocal.status,
    0,
    `${isolatedLocal.stderr}\n${isolatedLocal.stdout}`,
  );
  assert.equal(isolatedLocalReport.profile, 'local');
  assert.equal(isolatedLocalReport.remote, null);
  assert.equal(isolatedLocalReport.metrics.workspace_topology_checked, false);

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
  assert.equal(healthyRemoteReport.profile, 'remote');
  assert.equal(healthyRemoteReport.metrics.workspace_topology_checked, true);
  assert.deepEqual(healthyRemoteReport.remote.merge_methods, {
    allow_squash_merge: true,
    allow_merge_commit: false,
    allow_rebase_merge: false,
  });
  assert.deepEqual(healthyRemoteReport.remote.repository_settings, {
    default_branch: 'main',
    allow_auto_merge: true,
    delete_branch_on_merge: true,
    allow_squash_merge: true,
    allow_merge_commit: false,
    allow_rebase_merge: false,
  });

  for (const [environment, expectedCode, expectedCheck] of [
    [{SIGNATURES_MISSING: 'true'}, 'required_signatures_unavailable'],
    [{REPOSITORY_SETTINGS_MISSING: 'true'}, 'remote_repository_settings_unavailable'],
    [{REPOSITORY_SETTINGS_MALFORMED: 'true'}, 'remote_repository_settings_malformed'],
    [{GRAPHQL_REPOSITORY_MISMATCH: 'true'}, 'remote_repository_settings_malformed'],
    [{DEFAULT_BRANCH_DRIFT: 'true'}, 'default_branch_not_main'],
    [{AUTO_MERGE_DISABLED: 'true'}, 'auto_merge_disabled'],
    [{DELETE_BRANCH_DISABLED: 'true'}, 'merged_branch_auto_delete_disabled'],
    [{MERGE_METHOD_DRIFT: 'true'}, 'merge_methods_not_squash_only'],
    [
      {MISSING_ANDROID_RELEASE: 'true'},
      'required_status_check_missing',
      'android-release',
    ],
    [
      {EXTRA_REQUIRED_CHECK: 'true'},
      'unexpected_required_status_check',
      'unexpected-check',
    ],
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
    if (expectedCheck) {
      const finding = driftReport.errors.find(error => error.code === expectedCode);
      assert.equal(finding.check, expectedCheck);
    }
    if (expectedCode === 'branch_protection_unavailable') {
      const finding = driftReport.errors.find(error => error.code === expectedCode);
      assert.equal(finding.http_status, 403);
      assert.equal(driftReport.remote.protected, null);
    }
    if (expectedCode === 'main_branch_unprotected') {
      assert.equal(driftReport.remote.protected, false);
    }
    if (expectedCode === 'merge_methods_not_squash_only') {
      const finding = driftReport.errors.find(error => error.code === expectedCode);
      assert.deepEqual(finding.observed, {
        allow_squash_merge: false,
        allow_merge_commit: true,
        allow_rebase_merge: false,
      });
    }
  }
  console.log('PASS: repository health fails closed on remote repository drift.');

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
      '--profile',
      'local',
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
  assert.equal(workspaceReport.metrics.workspace_topology_checked, true);
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
