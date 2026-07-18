#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_BLOB_LIMIT = 1024 * 1024;
const REQUIRED_CHECKS = [
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
const FORMAL_APPROVAL_ENVIRONMENT = 'formal-product-owner-approval';
const FORMAL_APPROVAL_REVIEWER = 'LENKIN233';
const FORMAL_APPROVAL_PREVENT_SELF_REVIEW = false;
const FORBIDDEN_TRACKED_PREFIXES = [
  'exports/',
  'docs/agent-runs/artifacts/',
];
const MEDIA_EXTENSION = /\.(gif|jpe?g|mov|mp4|pdf|png|webp)$/i;

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function integerOption(name) {
  const value = option(name);
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return parsed;
}

function run(command, args, {allowFailure = false, cwd = ROOT} = {}) {
  const result = runResult(command, args, {cwd});
  if (result.ok) return result.stdout;
  if (allowFailure) return '';
  throw result.error;
}

function runResult(command, args, {cwd = ROOT} = {}) {
  try {
    return {
      ok: true,
      stdout: execFileSync(command, args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim(),
      stderr: '',
      exitCode: 0,
    };
  } catch (error) {
    return {
      ok: false,
      stdout: '',
      stderr: String(error?.stderr ?? '').trim(),
      exitCode: Number.isInteger(error?.status) ? error.status : null,
      error,
    };
  }
}

function runWithInput(command, args, input) {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    input,
  }).trim();
}

function git(...args) {
  return run('git', args);
}

function succeeds(command, args) {
  try {
    execFileSync(command, args, {cwd: ROOT, stdio: 'ignore'});
    return true;
  } catch {
    return false;
  }
}

function lines(value) {
  return value ? value.split('\n').map(line => line.trim()).filter(Boolean) : [];
}

function parseRemoteJson(raw, {unavailableCode, malformedCode}, errors) {
  if (!raw) {
    errors.push({code: unavailableCode});
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    errors.push({code: malformedCode});
    return null;
  }
}

function resolvesCommit(ref) {
  return Boolean(ref && succeeds('git', ['cat-file', '-e', `${ref}^{commit}`]));
}

function trackedFiles({base, fullTree}) {
  if (!fullTree && resolvesCommit(base)) {
    return lines(git('-c', 'core.quotepath=false', 'diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`));
  }
  if (!fullTree && resolvesCommit('HEAD^')) {
    return lines(git('-c', 'core.quotepath=false', 'diff', '--name-only', '--diff-filter=ACMR', 'HEAD^', 'HEAD'));
  }
  return lines(git('-c', 'core.quotepath=false', 'ls-files'));
}

function rangeBase({base, fullTree}) {
  if (fullTree) return null;

  if (resolvesCommit(base)) {
    return git('merge-base', base, 'HEAD');
  }

  return resolvesCommit('HEAD^') ? git('rev-parse', 'HEAD^') : null;
}

function introducedPaths(commit) {
  if (!commit) return [];

  return lines(
    git(
      '-c',
      'core.quotepath=false',
      'log',
      '--format=',
      '--name-only',
      '--diff-filter=ACMR',
      `${commit}..HEAD`,
    ),
  );
}

function introducedBlobs(commit) {
  if (!commit) return [];

  const objects = lines(
    git(
      '-c',
      'core.quotepath=false',
      'rev-list',
      '--objects',
      'HEAD',
      '--not',
      commit,
    ),
  ).map(line => {
    const separator = line.indexOf(' ');
    return {
      oid: separator === -1 ? line : line.slice(0, separator),
      file: separator === -1 ? null : line.slice(separator + 1),
    };
  });

  if (objects.length === 0) return [];

  const metadata = new Map(
    lines(
      runWithInput(
        'git',
        ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
        `${objects.map(object => object.oid).join('\n')}\n`,
      ),
    ).map(line => {
      const [oid, type, size] = line.split(' ');
      return [oid, {bytes: Number(size), type}];
    }),
  );

  return objects.flatMap(object => {
    const objectMetadata = metadata.get(object.oid);
    return objectMetadata?.type === 'blob'
      ? [{...object, bytes: objectMetadata.bytes}]
      : [];
  });
}

function isForbidden(file) {
  if (FORBIDDEN_TRACKED_PREFIXES.some(prefix => file.startsWith(prefix))) return true;
  const generatedVisualPath = file.startsWith('docs/design/app-screenshots/') || file.includes('/screenshots/');
  return generatedVisualPath && MEDIA_EXTENSION.test(file);
}

function blobSize(file) {
  const output = run('git', ['cat-file', '-s', `HEAD:${file}`], {allowFailure: true});
  return output ? Number(output) : null;
}

function currentBlobs(files) {
  return files.flatMap(file => {
    const bytes = blobSize(file);
    const oid = run('git', ['rev-parse', `HEAD:${file}`], {
      allowFailure: true,
    });
    return bytes === null || !oid ? [] : [{bytes, file, oid}];
  });
}

function uniqueBlobEntries(entries) {
  return [
    ...new Map(
      entries.map(entry => [`${entry.oid}:${entry.file ?? ''}`, entry]),
    ).values(),
  ];
}

function worktreePaths() {
  return lines(git('worktree', 'list', '--porcelain'))
    .filter(line => line.startsWith('worktree '))
    .map(line => line.slice('worktree '.length));
}

function localBranches() {
  return lines(git(
    'for-each-ref',
    'refs/heads',
    '--format=%(refname:short)%09%(upstream:short)%09%(upstream:track)',
  )).map(line => {
    const [name, upstream = '', tracking = ''] = line.split('\t');
    return {name, upstream, tracking};
  });
}

function remoteSnapshot(errors, warnings) {
  const repo = run('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'], {allowFailure: true});
  if (!repo) {
    errors.push({code: 'remote_repository_unavailable'});
    return null;
  }

  const protectionResult = runResult(
    'gh',
    ['api', `repos/${repo}/branches/main/protection`],
  );
  if (!protectionResult.ok) {
    const statusMatch = protectionResult.stderr.match(/\(HTTP (\d{3})\)/);
    const httpStatus = statusMatch ? Number(statusMatch[1]) : null;
    if (httpStatus === 404) {
      errors.push({code: 'main_branch_unprotected', repo});
      return {repo, protected: false};
    }
    errors.push({
      code: 'branch_protection_unavailable',
      repo,
      http_status: httpStatus,
      exit_code: protectionResult.exitCode,
    });
    return {repo, protected: null};
  }

  let protection;
  try {
    protection = JSON.parse(protectionResult.stdout);
  } catch {
    errors.push({code: 'branch_protection_malformed', repo});
    return {repo, protected: null};
  }
  const checks = protection.required_status_checks?.contexts || [];
  if (protection.required_status_checks?.strict !== true) {
    errors.push({code: 'required_checks_not_strict'});
  }
  if (protection.enforce_admins?.enabled !== true) {
    errors.push({code: 'admins_not_enforced'});
  }
  if (protection.required_conversation_resolution?.enabled !== true) {
    errors.push({code: 'conversation_resolution_not_required'});
  }
  if (protection.required_linear_history?.enabled !== true) {
    errors.push({code: 'linear_history_not_required'});
  }
  if (!protection.required_pull_request_reviews) {
    errors.push({code: 'pull_request_not_required'});
  }
  if (protection.allow_force_pushes?.enabled === true || protection.allow_deletions?.enabled === true) {
    errors.push({code: 'destructive_main_update_allowed'});
  }
  for (const check of REQUIRED_CHECKS) {
    if (!checks.includes(check)) errors.push({code: 'required_status_check_missing', check});
  }
  for (const check of checks) {
    if (!REQUIRED_CHECKS.includes(check)) {
      errors.push({code: 'unexpected_required_status_check', check});
    }
  }
  const signatures = run('gh', ['api', `repos/${repo}/branches/main/protection/required_signatures`], {allowFailure: true});
  const signaturePolicy = parseRemoteJson(
    signatures,
    {
      unavailableCode: 'required_signatures_unavailable',
      malformedCode: 'required_signatures_malformed',
    },
    errors,
  );
  if (signaturePolicy && signaturePolicy.enabled !== true) {
    errors.push({code: 'signed_commits_not_required'});
  }
  const repositoryRaw = run('gh', ['api', `repos/${repo}`], {allowFailure: true});
  const repository = parseRemoteJson(
    repositoryRaw,
    {
      unavailableCode: 'remote_repository_settings_unavailable',
      malformedCode: 'remote_repository_settings_malformed',
    },
    errors,
  );
  if (repository) {
    if (repository.allow_squash_merge !== true || repository.allow_merge_commit !== false || repository.allow_rebase_merge !== false) {
      errors.push({code: 'merge_methods_not_squash_only'});
    }
  }

  const environmentRaw = run(
    'gh',
    ['api', `repos/${repo}/environments/${FORMAL_APPROVAL_ENVIRONMENT}`],
    {allowFailure: true},
  );
  let formalApproval = null;
  if (!environmentRaw) {
    errors.push({
      code: 'formal_approval_environment_unavailable',
      environment: FORMAL_APPROVAL_ENVIRONMENT,
    });
  } else {
    try {
      const environment = JSON.parse(environmentRaw);
      const reviewerRules = Array.isArray(environment.protection_rules)
        ? environment.protection_rules.filter(rule => rule?.type === 'required_reviewers')
        : [];
      const reviewerRule = reviewerRules.length === 1 ? reviewerRules[0] : null;
      const reviewers = reviewerRule
        ? reviewerRule.reviewers
          .filter(entry => entry?.type === 'User' && entry.reviewer?.login)
          .map(entry => entry.reviewer.login)
          .sort()
        : [];

      if (environment.name !== FORMAL_APPROVAL_ENVIRONMENT) {
        errors.push({
          code: 'formal_approval_environment_name_drift',
          expected: FORMAL_APPROVAL_ENVIRONMENT,
          actual: environment.name ?? null,
        });
      }
      if (environment.can_admins_bypass !== false) {
        errors.push({code: 'formal_approval_admin_bypass_enabled'});
      }
      if (!reviewerRule) {
        errors.push({code: 'formal_approval_reviewer_rule_missing'});
      } else {
        if (reviewerRule.prevent_self_review !== FORMAL_APPROVAL_PREVENT_SELF_REVIEW) {
          errors.push({
            code: 'formal_approval_prevent_self_review_drift',
            expected: FORMAL_APPROVAL_PREVENT_SELF_REVIEW,
            actual: reviewerRule.prevent_self_review ?? null,
          });
        }
        if (reviewers.length !== 1 || reviewers[0] !== FORMAL_APPROVAL_REVIEWER) {
          errors.push({
            code: 'formal_approval_reviewer_drift',
            expected: [FORMAL_APPROVAL_REVIEWER],
            actual: reviewers,
          });
        }
      }
      formalApproval = {
        environment: environment.name ?? null,
        can_admins_bypass: environment.can_admins_bypass ?? null,
        prevent_self_review: reviewerRule?.prevent_self_review ?? null,
        reviewers,
      };
    } catch {
      errors.push({code: 'formal_approval_environment_malformed'});
    }
  }
  return {
    repo,
    protected: true,
    required_checks: checks,
    formal_approval: formalApproval,
  };
}

const strict = process.argv.includes('--strict');
const allowDirty = process.argv.includes('--allow-dirty');
const fullTree = process.argv.includes('--full-tree');
const includeRemote = process.argv.includes('--remote');
const requireUpstreams = process.argv.includes('--require-upstreams');
const base = option('--base');
const outputPath = option('--output');
const maxWorktrees = integerOption('--expected-max-worktrees');
const maxStashes = integerOption('--expected-max-stashes');
const maxTopicBranches = integerOption('--expected-max-topic-branches');
const blobLimit = integerOption('--blob-limit-bytes') ?? DEFAULT_BLOB_LIMIT;
const errors = [];
const warnings = [];
const auditRangeBase = rangeBase({base, fullTree});
const files = trackedFiles({base, fullTree});
const historicalPaths = introducedPaths(auditRangeBase);
const introducedBlobEntries = introducedBlobs(auditRangeBase);
const auditedBlobEntries = uniqueBlobEntries([
  ...currentBlobs(files),
  ...introducedBlobEntries,
]);
const forbiddenTrackedFiles = [
  ...new Set([...files, ...historicalPaths].filter(isForbidden)),
];
const oversizedBlobs = auditedBlobEntries.filter(
  entry => entry.bytes > blobLimit,
);
const worktrees = worktreePaths();
const dirtyWorktrees = worktrees.flatMap(worktree => {
  if (!fs.existsSync(worktree)) return [{worktree, entries: ['worktree path is unavailable']}];
  const entries = lines(run('git', ['status', '--porcelain'], {cwd: worktree}));
  return entries.length > 0 ? [{worktree, entries}] : [];
});
const stashCount = lines(git('stash', 'list')).length;
const branches = localBranches();
const topicBranches = branches.filter(branch => branch.name !== 'main');
const goneBranches = branches.filter(branch => branch.tracking.includes('[gone]')).map(branch => branch.name);
const branchesWithoutUpstream = branches.filter(branch => !branch.upstream).map(branch => branch.name);

if (!allowDirty && dirtyWorktrees.length > 0) errors.push({code: 'dirty_worktree', worktrees: dirtyWorktrees});
if (forbiddenTrackedFiles.length > 0) {
  errors.push({code: 'generated_or_evidence_files_tracked', files: forbiddenTrackedFiles});
}
if (oversizedBlobs.length > 0) errors.push({code: 'ordinary_git_blob_too_large', blobs: oversizedBlobs});
if (maxWorktrees !== null && worktrees.length > maxWorktrees) {
  errors.push({code: 'worktree_limit_exceeded', expected_max: maxWorktrees, actual: worktrees.length});
}
if (maxStashes !== null && stashCount > maxStashes) {
  errors.push({code: 'stash_limit_exceeded', expected_max: maxStashes, actual: stashCount});
}
if (maxTopicBranches !== null && topicBranches.length > maxTopicBranches) {
  errors.push({code: 'topic_branch_limit_exceeded', expected_max: maxTopicBranches, actual: topicBranches.length});
}
if (goneBranches.length > 0) {
  const issue = {code: 'gone_local_branches', branches: goneBranches};
  if (requireUpstreams) errors.push(issue);
  else warnings.push(issue);
}
if (branchesWithoutUpstream.length > 0) {
  const issue = {code: 'branch_upstream_missing', branches: branchesWithoutUpstream};
  if (requireUpstreams) errors.push(issue);
  else warnings.push(issue);
}

const remote = includeRemote ? remoteSnapshot(errors, warnings) : null;
const report = {
  schema_version: 'repository-health.v1',
  generated_at: new Date().toISOString(),
  repository: path.basename(ROOT),
  head: git('rev-parse', 'HEAD'),
  base: base && resolvesCommit(base) ? git('rev-parse', base) : null,
  scope: fullTree ? 'full_tree' : 'changed_files',
  ok: errors.length === 0,
  metrics: {
    checked_files: files.length,
    checked_blobs: auditedBlobEntries.length,
    introduced_blobs: introducedBlobEntries.length,
    worktrees: worktrees.length,
    dirty_worktrees: dirtyWorktrees.length,
    stashes: stashCount,
    topic_branches: topicBranches.length,
    gone_branches: goneBranches.length,
    branches_without_upstream: branchesWithoutUpstream.length,
    oversized_blobs: oversizedBlobs.length,
  },
  remote,
  errors,
  warnings,
};

if (outputPath) {
  const resolved = path.resolve(ROOT, outputPath);
  fs.mkdirSync(path.dirname(resolved), {recursive: true});
  fs.writeFileSync(resolved, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify(report, null, 2));
if (strict && !report.ok) process.exit(1);
