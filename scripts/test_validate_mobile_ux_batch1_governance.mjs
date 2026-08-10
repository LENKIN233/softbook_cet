#!/usr/bin/env node

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';

import {
  TRUSTED_CODE_CLOSURE,
  createEvidenceContext,
  exactGitClassificationPaths,
  parseCommandArgs,
  validateFoundationDocManifestTransition,
  validateIntent,
  validatePullRequest,
  validateReceiptMaterialization,
  validateSubjectChange,
  verifyCurrentRunApproval,
} from './validate_mobile_ux_batch1_governance.mjs';
import {
  ARTIFACT_PATHS,
  BATCH1_SUBJECT_PATHS,
  HISTORICAL_PREPARATION,
  INVALIDATION_CONDITIONS_BY_KIND,
  TRUSTED_IDENTITY,
  authorityMaskFor,
  buildLegacyPreparationParentTuple,
  computeApprovalInstanceDigest,
  computeDesignatedCohortDigest,
  computeHistoricalPreparationApprovalInstanceDigest,
  computeLegacyPreparationReceiptDigest,
  computeSubjectDigest,
  projectGitHubApprovalEvent,
  sha256Hex,
} from './lib/mobile_ux_batch1_governance_contract.mjs';
import {
  ALL_FALSE_AUTHORITY,
  POST_DESIGNATION_REQUIREMENT_IDS,
  SCHEMA_SUBJECT_DIGEST,
  SUBJECT_DIGEST_DOMAINS,
  domainDigest,
} from './lib/mobile_ux_batch1_successor_contract.mjs';
import {
  ABSENT_ARTIFACT_SNAPSHOT,
  BOOTSTRAP_RUN_RECORD,
  BOOTSTRAP_TRUSTED_BASE_SHA,
  RECOVERY_NON_CLAIMS,
  RECOVERY_SCHEMA_VERSION,
  REQUIRED_CURRENT_RUN_GATE,
  ZERO_AUTHORITY,
  activeAgentsLines,
  AGENTS_GOVERNANCE_HEADING,
  artifactSnapshotFromBytes,
  buildActiveGovernanceDomain,
  buildActiveHarnessPolicy,
  buildActiveHarnessReadPaths,
  buildRevocationAnchorTransition,
  buildChangedArtifactRecord,
} from './lib/mobile_ux_batch1_governance_recovery_contract.mjs';
import {
  EXACT_BYTE_FIXTURES,
  decodeExactFixturePayload,
  exactFixtureBytes,
} from './fixtures/mobile-ux-batch1-foundation-activation-v1/exact_bytes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BOOTSTRAP_PROBE_FILES = [
  'docs/release/mobile-ux-batch1-governance-bootstrap-probe.json',
  'bootstrap-probe.txt',
];
const INACTIVE_GOVERNANCE_ANCHOR_FILES = Object.freeze([
  'AGENTS.md',
  'spec/authority-map.json',
  'spec/agent-harness.json',
  'spec/doc-manifest.json',
]);

function runGit(root, args) {
  const result = spawnSync('git', args, {cwd: root, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function writeFromRepository(tempRoot, relativePath) {
  const target = path.join(tempRoot, relativePath);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.copyFileSync(path.join(ROOT, relativePath), target);
}

function makeRepository(t) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-batch1-governance-'));
  t.after(() => fs.rmSync(tempRoot, {recursive: true, force: true}));
  runGit(tempRoot, ['init', '-b', 'main']);
  runGit(tempRoot, ['config', 'user.name', 'Fixture']);
  runGit(tempRoot, ['config', 'user.email', 'fixture@example.invalid']);
  runGit(tempRoot, ['remote', 'add', 'origin', 'https://github.com/LENKIN233/softbook_cet.git']);
  for (const relativePath of [
    ...TRUSTED_CODE_CLOSURE,
    ...INACTIVE_GOVERNANCE_ANCHOR_FILES,
  ]) {
    writeFromRepository(tempRoot, relativePath);
  }
  fs.writeFileSync(path.join(tempRoot, 'README.md'), 'trusted base\n');
  runGit(tempRoot, [
    'add',
    'README.md',
    ...TRUSTED_CODE_CLOSURE,
    ...INACTIVE_GOVERNANCE_ANCHOR_FILES,
  ]);
  runGit(tempRoot, ['commit', '-m', 'base']);
  return {tempRoot, baseSha: runGit(tempRoot, ['rev-parse', 'HEAD'])};
}

function makeBootstrapInstalledRepository(t) {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'softbook-batch1-bootstrap-installed-'),
  );
  t.after(() => fs.rmSync(tempRoot, {recursive: true, force: true}));
  runGit(tempRoot, ['init', '-b', 'main']);
  runGit(tempRoot, ['config', 'user.name', 'Fixture']);
  runGit(tempRoot, ['config', 'user.email', 'fixture@example.invalid']);
  runGit(tempRoot, ['remote', 'add', 'source', ROOT]);
  runGit(tempRoot, ['fetch', '--no-tags', 'source', BOOTSTRAP_TRUSTED_BASE_SHA]);
  runGit(tempRoot, ['checkout', '-B', 'main', BOOTSTRAP_TRUSTED_BASE_SHA]);
  runGit(tempRoot, ['remote', 'remove', 'source']);
  runGit(tempRoot, ['remote', 'add', 'origin', 'https://github.com/LENKIN233/softbook_cet.git']);
  for (const relativePath of [...TRUSTED_CODE_CLOSURE, BOOTSTRAP_RUN_RECORD]) {
    writeFromRepository(tempRoot, relativePath);
  }
  runGit(tempRoot, ['add', ...TRUSTED_CODE_CLOSURE, BOOTSTRAP_RUN_RECORD]);
  runGit(tempRoot, ['commit', '-m', 'materialize trusted governance bootstrap']);
  const bootstrapSha = runGit(tempRoot, ['rev-parse', 'HEAD']);
  return {
    tempRoot,
    bootstrapSha,
    bootstrapLanding: Object.freeze({
      repository_full_name: TRUSTED_IDENTITY.repository,
      repository_id: TRUSTED_IDENTITY.repositoryId,
      pull_request_number: 998,
      pull_request_base_sha: BOOTSTRAP_TRUSTED_BASE_SHA,
      approval_target_head_sha: bootstrapSha,
      merge_commit_sha: bootstrapSha,
      complete_tree_sha: runGit(tempRoot, ['rev-parse', `${bootstrapSha}^{tree}`]),
      associated_pull_request_count: 1,
      merged_at: '2026-08-10T01:00:00Z',
      provider_observed_at: '2026-08-10T01:00:01Z',
    }),
  };
}

function makeBootstrapWithDeferredClosureRepository(t, deferredClosurePath) {
  assert(TRUSTED_CODE_CLOSURE.includes(deferredClosurePath));
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'softbook-batch1-bootstrap-deferred-closure-'),
  );
  t.after(() => fs.rmSync(tempRoot, {recursive: true, force: true}));
  runGit(tempRoot, ['init', '-b', 'main']);
  runGit(tempRoot, ['config', 'user.name', 'Fixture']);
  runGit(tempRoot, ['config', 'user.email', 'fixture@example.invalid']);
  runGit(tempRoot, ['remote', 'add', 'source', ROOT]);
  runGit(tempRoot, ['fetch', '--no-tags', 'source', BOOTSTRAP_TRUSTED_BASE_SHA]);
  runGit(tempRoot, ['checkout', '-B', 'main', BOOTSTRAP_TRUSTED_BASE_SHA]);
  runGit(tempRoot, ['remote', 'remove', 'source']);
  runGit(tempRoot, ['remote', 'add', 'origin', 'https://github.com/LENKIN233/softbook_cet.git']);
  const bootstrapPaths = [
    ...TRUSTED_CODE_CLOSURE.filter(
      (relativePath) => relativePath !== deferredClosurePath,
    ),
    BOOTSTRAP_RUN_RECORD,
  ];
  for (const relativePath of bootstrapPaths) {
    writeFromRepository(tempRoot, relativePath);
  }
  runGit(tempRoot, ['add', ...bootstrapPaths]);
  runGit(tempRoot, ['commit', '-m', 'materialize incomplete bootstrap closure']);
  const bootstrapMergeSha = runGit(tempRoot, ['rev-parse', 'HEAD']);
  const bootstrapLanding = Object.freeze({
    repository_full_name: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    pull_request_number: 998,
    pull_request_base_sha: BOOTSTRAP_TRUSTED_BASE_SHA,
    approval_target_head_sha: bootstrapMergeSha,
    merge_commit_sha: bootstrapMergeSha,
    complete_tree_sha: runGit(tempRoot, ['rev-parse', `${bootstrapMergeSha}^{tree}`]),
    associated_pull_request_count: 1,
    merged_at: '2026-08-10T01:00:00Z',
    provider_observed_at: '2026-08-10T01:00:01Z',
  });
  writeFromRepository(tempRoot, deferredClosurePath);
  const trustedBaseSha = commitPaths(
    tempRoot,
    'add omitted kernel only after bootstrap merge',
    [deferredClosurePath],
  );
  return {tempRoot, trustedBaseSha, bootstrapMergeSha, bootstrapLanding};
}

function commitBootstrapProbe(tempRoot) {
  const releaseProbe = path.join(tempRoot, BOOTSTRAP_PROBE_FILES[0]);
  fs.mkdirSync(path.dirname(releaseProbe), {recursive: true});
  fs.writeFileSync(releaseProbe, '{"gate_effect":"none"}\n');
  fs.writeFileSync(path.join(tempRoot, BOOTSTRAP_PROBE_FILES[1]), 'untrusted head data\n');
  runGit(tempRoot, ['add', ...BOOTSTRAP_PROBE_FILES]);
  runGit(tempRoot, ['commit', '-m', 'generic sensitive probe']);
  return runGit(tempRoot, ['rev-parse', 'HEAD']);
}

function githubFiles(t, tempRoot, paths, entryOverrides = {}) {
  const file = path.join(tempRoot, `github-files-${Math.random().toString(16).slice(2)}.json`);
  fs.writeFileSync(file, JSON.stringify([paths.map((filename) => ({
    filename,
    status: /^docs\/agent-runs\/\d{4}-\d{2}-\d{2}-mobile-ux-batch1-/.test(filename)
      ? 'added'
      : 'modified',
    ...(entryOverrides[filename] ?? {}),
  }))]));
  t.after(() => fs.rmSync(file, {force: true}));
  return file;
}

function validationOptions(
  tempRoot,
  baseSha,
  headSha,
  file,
  decisionClass,
  pullRequest = '999',
) {
  return {
    root: tempRoot,
    repository: 'LENKIN233/softbook_cet',
    repositoryId: '1216764160',
    origin: 'https://github.com/LENKIN233/softbook_cet.git',
    pullRequest: String(pullRequest),
    baseRef: 'refs/heads/main',
    baseSha,
    headSha,
    decisionClass,
    githubFiles: file,
    expectedCount: String(JSON.parse(fs.readFileSync(file, 'utf8'))[0].length),
  };
}

function writeJson(tempRoot, relativePath, value) {
  const target = path.join(tempRoot, relativePath);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(tempRoot, relativePath, value) {
  const target = path.join(tempRoot, relativePath);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, value);
}

function commitPaths(tempRoot, message, paths) {
  runGit(tempRoot, ['add', ...paths]);
  runGit(tempRoot, ['commit', '-m', message]);
  return runGit(tempRoot, ['rev-parse', 'HEAD']);
}

function recoverySnapshotAt(tempRoot, commit, relativePath) {
  const result = spawnSync(
    'git',
    ['show', `${commit}:${relativePath}`],
    {cwd: tempRoot, encoding: null},
  );
  if (result.status !== 0) return structuredClone(ABSENT_ARTIFACT_SNAPSHOT);
  return artifactSnapshotFromBytes(Buffer.from(result.stdout));
}

function addBootstrapMaintenanceHead(
  tempRoot,
  bootstrapSha,
  {
    slug = 'repair-envelope',
    payloadPath =
      'scripts/fixtures/mobile-ux-batch1-foundation-activation-v1/recovery-envelope-probe.txt',
    payloadBytes = Buffer.from('recovery envelope probe\n', 'utf8'),
  } = {},
) {
  const pullRequest = 999;
  const decisionPath =
    `docs/design/decisions/mobile-ux-batch1-governance-maintenance-v1/` +
    `pr-${pullRequest}-${slug}.json`;
  const runRecordPath =
    `docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-maintenance-` +
    `pr-${pullRequest}-${slug}.md`;
  writeText(tempRoot, runRecordPath, `# ${slug}\n`);
  const payloadTarget = path.join(tempRoot, payloadPath);
  fs.mkdirSync(path.dirname(payloadTarget), {recursive: true});
  fs.writeFileSync(payloadTarget, payloadBytes);
  const records = [runRecordPath, payloadPath]
    .sort()
    .map((relativePath) =>
      buildChangedArtifactRecord(
        relativePath,
        recoverySnapshotAt(tempRoot, bootstrapSha, relativePath),
        artifactSnapshotFromBytes(
          fs.readFileSync(path.join(tempRoot, relativePath)),
        ),
      ),
    );
  const decision = {
    schema_version: RECOVERY_SCHEMA_VERSION,
    decision_id:
      `mobile-ux-batch1-governance-maintenance-pr-${pullRequest}-${slug}`,
    decision_class: 'governance_maintenance',
    operation: 'bootstrap_maintenance',
    repository: {
      full_name: TRUSTED_IDENTITY.repository,
      repository_id: TRUSTED_IDENTITY.repositoryId,
      base_ref: TRUSTED_IDENTITY.protectedBaseRef,
    },
    pull_request: pullRequest,
    trusted_base_sha: bootstrapSha,
    decision_path: decisionPath,
    run_record_path: runRecordPath,
    state_transition: {
      from: 'inactive_bootstrap_installed',
      to: 'inactive_bootstrap_installed',
    },
    revocation_context: null,
    policy_selection: null,
    changed_artifacts: records,
    current_run_gate: structuredClone(REQUIRED_CURRENT_RUN_GATE),
    authority: structuredClone(ZERO_AUTHORITY),
    non_claims: [...RECOVERY_NON_CLAIMS],
  };
  writeJson(tempRoot, decisionPath, decision);
  const changedPaths = [decisionPath, runRecordPath, payloadPath].sort();
  const headSha = commitPaths(
    tempRoot,
    `bootstrap maintenance ${slug}`,
    changedPaths,
  );
  return {decisionPath, runRecordPath, payloadPath, changedPaths, headSha};
}

function insertLinesAfter(source, anchor, additions) {
  const finalNewline = source.endsWith('\n');
  const lines = source.split('\n');
  if (finalNewline) lines.pop();
  const indexes = lines
    .map((line, index) => (line === anchor ? index : -1))
    .filter((index) => index >= 0);
  assert.equal(indexes.length, 1, `fixture anchor must be unique: ${anchor}`);
  lines.splice(indexes[0] + 1, 0, ...additions);
  return `${lines.join('\n')}${finalNewline ? '\n' : ''}`;
}

function addFoundationActivationHead(tempRoot, baseSha) {
  const policyPath = ARTIFACT_PATHS.governancePolicy;
  const activationPath =
    'docs/design/decisions/mobile-ux-batch1-governance-foundation-v1.md';
  const runRecordPath =
    'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-foundation-v1.md';
  const schemaPath = 'spec/mobile-ux-batch1-resolved-requirement.schema.json';
  for (const relativePath of [
    policyPath,
    activationPath,
    schemaPath,
    runRecordPath,
  ]) {
    const target = path.join(tempRoot, relativePath);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, exactFixtureBytes(relativePath));
  }

  const authorityPath = 'spec/authority-map.json';
  const authority = JSON.parse(
    fs.readFileSync(path.join(tempRoot, authorityPath), 'utf8'),
  );
  authority.version = `vnext-${Number(authority.version.slice(6)) + 1}`;
  authority.domains.mobile_ux_batch1_governance =
    buildActiveGovernanceDomain(policyPath, activationPath);
  writeJson(tempRoot, authorityPath, authority);

  const harnessPath = 'spec/agent-harness.json';
  const harness = JSON.parse(
    fs.readFileSync(path.join(tempRoot, harnessPath), 'utf8'),
  );
  harness.version = `vnext-${Number(harness.version.slice(6)) + 1}`;
  harness.read_paths.mobile_ux_batch1_governance =
    buildActiveHarnessReadPaths(policyPath);
  harness.governance.mobile_ux_batch1_governance_policy =
    buildActiveHarnessPolicy(policyPath, activationPath);
  harness.compaction_keep.push('mobile_ux_batch1_governance_state');
  writeJson(tempRoot, harnessPath, harness);

  const manifestPath = 'spec/doc-manifest.json';
  const manifest = JSON.parse(
    fs.readFileSync(path.join(tempRoot, manifestPath), 'utf8'),
  );
  manifest.version = `vnext-${Number(manifest.version.slice(6)) + 1}`;
  const authorityIndex = manifest.active_specs.indexOf(authorityPath);
  assert.notEqual(authorityIndex, -1);
  manifest.active_specs.splice(authorityIndex + 1, 0, policyPath);
  writeJson(tempRoot, manifestPath, manifest);

  const agentsPath = 'AGENTS.md';
  const lines = activeAgentsLines(policyPath);
  let agents = fs.readFileSync(path.join(tempRoot, agentsPath), 'utf8');
  agents = insertLinesAfter(agents, '- `spec/doc-manifest.json`', [lines[0]]);
  agents = insertLinesAfter(
    agents,
    '- 交付 / PR / CI：`authority-map -> agent-harness -> repo-delivery-contract -> evals`（涉及接收方环境、正式内容发布或回滚时追加 `runtime-boundaries -> infra/cloudbase/release-bundle-v1-runtime-contract.md`）',
    [lines[1]],
  );
  agents = insertLinesAfter(
    agents,
    '- 不要把 `scripts/run_local_gates` 的本地报告当作 GitHub required checks、Agent review、正式内容批准或 launch readiness；`dev` / `pr` / `release` profile 与 `local-gate-report.v1` 以 `spec/harness-architecture.json#local_gate_runner_contract` 为准',
    lines.slice(2),
  );
  writeText(tempRoot, agentsPath, agents);

  const changedPaths = [
    agentsPath,
    runRecordPath,
    activationPath,
    harnessPath,
    authorityPath,
    manifestPath,
    policyPath,
    schemaPath,
  ].sort();
  const headSha = commitPaths(
    tempRoot,
    'activate Mobile UX Batch 1 governance foundation',
    changedPaths,
  );
  return {headSha, changedPaths, runRecordPath, activationPath, policyPath, schemaPath};
}

function anchorInputAtWorktree(tempRoot, activationRecordPath) {
  return {
    authorityMap: JSON.parse(
      fs.readFileSync(path.join(tempRoot, 'spec/authority-map.json'), 'utf8'),
    ),
    agentHarness: JSON.parse(
      fs.readFileSync(path.join(tempRoot, 'spec/agent-harness.json'), 'utf8'),
    ),
    docManifest: JSON.parse(
      fs.readFileSync(path.join(tempRoot, 'spec/doc-manifest.json'), 'utf8'),
    ),
    agentsText: fs.readFileSync(path.join(tempRoot, 'AGENTS.md'), 'utf8'),
    policyPath: ARTIFACT_PATHS.governancePolicy,
    activationRecordPath,
  };
}

function addRecoveryTransitionHead(
  tempRoot,
  baseSha,
  {
    decisionClass,
    pullRequest,
    slug,
    activationRecordPath,
    revocationContext = null,
    revokedPolicyRawSha256,
  },
) {
  const kind = decisionClass.replace(/^governance_/, '');
  const decisionPath =
    `docs/design/decisions/mobile-ux-batch1-governance-${kind}-v1/` +
    `pr-${pullRequest}-${slug}.json`;
  const runRecordPath =
    `docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-${kind}-` +
    `pr-${pullRequest}-${slug}.md`;
  writeText(tempRoot, runRecordPath, `# ${kind} ${pullRequest}\n`);
  const current = anchorInputAtWorktree(tempRoot, activationRecordPath);
  let next;
  if (decisionClass === 'governance_revocation') {
    next = buildRevocationAnchorTransition(current);
  } else {
    const authorityMap = structuredClone(current.authorityMap);
    const agentHarness = structuredClone(current.agentHarness);
    const docManifest = structuredClone(current.docManifest);
    authorityMap.version = `vnext-${Number(authorityMap.version.slice(6)) + 1}`;
    authorityMap.domains.mobile_ux_batch1_governance =
      buildActiveGovernanceDomain(current.policyPath, decisionPath);
    agentHarness.version = `vnext-${Number(agentHarness.version.slice(6)) + 1}`;
    agentHarness.read_paths.mobile_ux_batch1_governance =
      buildActiveHarnessReadPaths(current.policyPath);
    agentHarness.governance.mobile_ux_batch1_governance_policy =
      buildActiveHarnessPolicy(current.policyPath, decisionPath);
    agentHarness.compaction_keep.push('mobile_ux_batch1_governance_state');
    docManifest.version = `vnext-${Number(docManifest.version.slice(6)) + 1}`;
    const authorityIndex = docManifest.active_specs.indexOf('spec/authority-map.json');
    assert.notEqual(authorityIndex, -1);
    docManifest.active_specs.splice(authorityIndex + 1, 0, current.policyPath);
    const finalNewline = current.agentsText.endsWith('\n');
    const baseText = finalNewline
      ? current.agentsText.slice(0, -1)
      : current.agentsText;
    const agentsText =
      `${baseText}\n\n${AGENTS_GOVERNANCE_HEADING}\n\n` +
      `${activeAgentsLines(current.policyPath).join('\n')}` +
      `${finalNewline ? '\n' : ''}`;
    next = {authorityMap, agentHarness, docManifest, agentsText};
  }
  writeJson(tempRoot, 'spec/authority-map.json', next.authorityMap);
  writeJson(tempRoot, 'spec/agent-harness.json', next.agentHarness);
  writeJson(tempRoot, 'spec/doc-manifest.json', next.docManifest);
  writeText(tempRoot, 'AGENTS.md', next.agentsText);
  const anchorPaths = [
    'AGENTS.md',
    'spec/agent-harness.json',
    'spec/authority-map.json',
    'spec/doc-manifest.json',
  ];
  const records = [runRecordPath, ...anchorPaths]
    .sort()
    .map((relativePath) =>
      buildChangedArtifactRecord(
        relativePath,
        recoverySnapshotAt(tempRoot, baseSha, relativePath),
        artifactSnapshotFromBytes(
          fs.readFileSync(path.join(tempRoot, relativePath)),
        ),
      ),
    );
  const operation =
    decisionClass === 'governance_revocation'
      ? 'revoke_active_governance'
      : 'rebootstrap_same_policy';
  const decision = {
    schema_version: RECOVERY_SCHEMA_VERSION,
    decision_id:
      `mobile-ux-batch1-governance-${kind}-pr-${pullRequest}-${slug}`,
    decision_class: decisionClass,
    operation,
    repository: {
      full_name: TRUSTED_IDENTITY.repository,
      repository_id: TRUSTED_IDENTITY.repositoryId,
      base_ref: TRUSTED_IDENTITY.protectedBaseRef,
    },
    pull_request: pullRequest,
    trusted_base_sha: baseSha,
    decision_path: decisionPath,
    run_record_path: runRecordPath,
    state_transition:
      decisionClass === 'governance_revocation'
        ? {from: 'active', to: 'revoked'}
        : {from: 'revoked', to: 'active'},
    revocation_context: revocationContext,
    policy_selection: {
      mode:
        decisionClass === 'governance_revocation'
          ? 'revoked_policy'
          : 'reuse_revoked_policy',
      path: ARTIFACT_PATHS.governancePolicy,
      raw_sha256: revokedPolicyRawSha256,
    },
    changed_artifacts: records,
    current_run_gate: structuredClone(REQUIRED_CURRENT_RUN_GATE),
    authority: structuredClone(ZERO_AUTHORITY),
    non_claims: [...RECOVERY_NON_CLAIMS],
  };
  if (decisionClass === 'governance_rebootstrap') {
    writeText(tempRoot, decisionPath, `${JSON.stringify(decision)}\n`);
  } else {
    writeJson(tempRoot, decisionPath, decision);
  }
  const changedPaths = [decisionPath, runRecordPath, ...anchorPaths].sort();
  const headSha = commitPaths(
    tempRoot,
    `${kind} governance`,
    changedPaths,
  );
  return {decisionPath, runRecordPath, changedPaths, headSha, decision};
}

function landingForCommit(tempRoot, baseSha, mergeCommitSha, pullRequest) {
  return Object.freeze({
    repository_full_name: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    pull_request_number: pullRequest,
    pull_request_base_sha: baseSha,
    approval_target_head_sha: mergeCommitSha,
    merge_commit_sha: mergeCommitSha,
    complete_tree_sha: runGit(tempRoot, ['rev-parse', `${mergeCommitSha}^{tree}`]),
    associated_pull_request_count: 1,
    merged_at: '2026-08-10T02:00:00Z',
    provider_observed_at: '2026-08-10T02:00:01Z',
  });
}

function fileRecord(tempRoot, relativePath) {
  const bytes = fs.readFileSync(path.join(tempRoot, relativePath));
  return {
    path: relativePath,
    git_mode: '100644',
    byte_length: bytes.length,
    raw_sha256: sha256Hex(bytes),
  };
}

function historicalEventProjection() {
  return {
    event: {
      repository_full_name: TRUSTED_IDENTITY.repository,
      repository_id: TRUSTED_IDENTITY.repositoryId,
      pull_request_number: HISTORICAL_PREPARATION.pullRequest,
      pull_request_base_ref: TRUSTED_IDENTITY.protectedBaseRef,
      pull_request_base_sha: '7960ebd29d0eec4a5139a38c7e5eb8bde00d6e47',
      approval_target_head_sha: HISTORICAL_PREPARATION.approvalTargetHeadSha,
      workflow_path: TRUSTED_IDENTITY.workflowPath,
      workflow_id: TRUSTED_IDENTITY.workflowId,
      workflow_run_id: HISTORICAL_PREPARATION.workflowRunId,
      run_attempt: 1,
      workflow_conclusion: 'success',
      deployment_id: HISTORICAL_PREPARATION.deploymentId,
      deployment_waiting_status_id: HISTORICAL_PREPARATION.deploymentWaitingStatusId,
      deployment_success_status_id: HISTORICAL_PREPARATION.deploymentSuccessStatusId,
      environment_id: TRUSTED_IDENTITY.environmentId,
      environment_name: TRUSTED_IDENTITY.environmentName,
      reviewer_immutable_id: TRUSTED_IDENTITY.reviewerImmutableId,
      approval_review_sha256: HISTORICAL_PREPARATION.approvalReviewSha256,
      validity_anchor_at: '2026-08-09T17:28:06Z',
      success_observed_at: '2026-08-09T17:30:24Z',
    },
    authority_event_sha256: HISTORICAL_PREPARATION.authorityEventSha256,
    provider_observed_at: '2026-08-10T00:00:10Z',
  };
}

function migrationEventEvidence({baseSha, approvedHeadSha}) {
  return {
    origin: 'https://github.com/LENKIN233/softbook_cet.git',
    repository: {id: TRUSTED_IDENTITY.repositoryId, full_name: TRUSTED_IDENTITY.repository},
    pull_request: {
      number: 585,
      base_ref: TRUSTED_IDENTITY.protectedBaseRef,
      base_sha: baseSha,
      base_repository_id: TRUSTED_IDENTITY.repositoryId,
      head_repository_id: TRUSTED_IDENTITY.repositoryId,
    },
    workflow_run: {
      id: 31337114199,
      run_attempt: 1,
      workflow_id: TRUSTED_IDENTITY.workflowId,
      event: 'pull_request_target',
      path: TRUSTED_IDENTITY.workflowPath,
      head_sha: approvedHeadSha,
      conclusion: 'success',
      repository_id: TRUSTED_IDENTITY.repositoryId,
    },
    deployment: {
      id: 5823098843,
      sha: approvedHeadSha,
      environment_id: TRUSTED_IDENTITY.environmentId,
      environment_name: TRUSTED_IDENTITY.environmentName,
    },
    environment: {
      id: TRUSTED_IDENTITY.environmentId,
      name: TRUSTED_IDENTITY.environmentName,
      can_admins_bypass: false,
      required_reviewer_ids: [TRUSTED_IDENTITY.reviewerDatabaseId],
    },
    approval_reviews: [{
      state: 'approved',
      comment: 'Approve the exact legacy migration intent.',
      environments: [{id: TRUSTED_IDENTITY.environmentId, name: TRUSTED_IDENTITY.environmentName}],
      user: {id: TRUSTED_IDENTITY.reviewerDatabaseId, login: TRUSTED_IDENTITY.reviewerLogin},
    }],
    deployment_statuses: [
      {id: 16590000004, state: 'success', created_at: '2026-08-10T00:00:04Z', environment: TRUSTED_IDENTITY.environmentName},
      {id: 16590000003, state: 'in_progress', created_at: '2026-08-10T00:00:03Z', environment: TRUSTED_IDENTITY.environmentName},
      {id: 16590000002, state: 'queued', created_at: '2026-08-10T00:00:02Z', environment: TRUSTED_IDENTITY.environmentName},
      {id: 16590000001, state: 'waiting', created_at: '2026-08-10T00:00:00Z', environment: TRUSTED_IDENTITY.environmentName},
    ],
  };
}

function stageEventProjection({
  pullRequest,
  baseSha,
  approvedHeadSha,
  serial,
  minute,
}) {
  const minuteText = String(minute).padStart(2, '0');
  const waitingAt = `2026-08-10T00:${minuteText}:00Z`;
  const successAt = `2026-08-10T00:${minuteText}:04Z`;
  const evidence = {
    origin: 'https://github.com/LENKIN233/softbook_cet.git',
    repository: {id: TRUSTED_IDENTITY.repositoryId, full_name: TRUSTED_IDENTITY.repository},
    pull_request: {
      number: pullRequest,
      base_ref: TRUSTED_IDENTITY.protectedBaseRef,
      base_sha: baseSha,
      base_repository_id: TRUSTED_IDENTITY.repositoryId,
      head_repository_id: TRUSTED_IDENTITY.repositoryId,
    },
    workflow_run: {
      id: 31338000000 + serial,
      run_attempt: 1,
      workflow_id: TRUSTED_IDENTITY.workflowId,
      event: 'pull_request_target',
      path: TRUSTED_IDENTITY.workflowPath,
      head_sha: approvedHeadSha,
      conclusion: 'success',
      repository_id: TRUSTED_IDENTITY.repositoryId,
    },
    deployment: {
      id: 5824000000 + serial,
      sha: approvedHeadSha,
      environment_id: TRUSTED_IDENTITY.environmentId,
      environment_name: TRUSTED_IDENTITY.environmentName,
    },
    environment: {
      id: TRUSTED_IDENTITY.environmentId,
      name: TRUSTED_IDENTITY.environmentName,
      can_admins_bypass: false,
      required_reviewer_ids: [TRUSTED_IDENTITY.reviewerDatabaseId],
    },
    approval_reviews: [{
      state: 'approved',
      comment: `Approve exact Batch 1 stage PR ${pullRequest}.`,
      environments: [{id: TRUSTED_IDENTITY.environmentId, name: TRUSTED_IDENTITY.environmentName}],
      user: {id: TRUSTED_IDENTITY.reviewerDatabaseId, login: TRUSTED_IDENTITY.reviewerLogin},
    }],
    deployment_statuses: [
      {id: 16600000004 + serial * 10, state: 'success', created_at: successAt, environment: TRUSTED_IDENTITY.environmentName},
      {id: 16600000003 + serial * 10, state: 'in_progress', created_at: `2026-08-10T00:${minuteText}:03Z`, environment: TRUSTED_IDENTITY.environmentName},
      {id: 16600000002 + serial * 10, state: 'queued', created_at: `2026-08-10T00:${minuteText}:02Z`, environment: TRUSTED_IDENTITY.environmentName},
      {id: 16600000001 + serial * 10, state: 'waiting', created_at: waitingAt, environment: TRUSTED_IDENTITY.environmentName},
    ],
  };
  return {
    ...projectGitHubApprovalEvent(evidence),
    provider_observed_at: `2026-08-10T00:${minuteText}:10Z`,
  };
}

function legacyIntent(policyRecord) {
  const historicalApprovalInstanceDigest = computeHistoricalPreparationApprovalInstanceDigest({
    decision_id: HISTORICAL_PREPARATION.decisionId,
    decision_class: HISTORICAL_PREPARATION.decisionClass,
    approval_target_head_sha: HISTORICAL_PREPARATION.approvalTargetHeadSha,
    subject_digest_domain: HISTORICAL_PREPARATION.subjectDigestDomain,
    subject_digest: HISTORICAL_PREPARATION.subjectDigest,
    authority_event_sha256: HISTORICAL_PREPARATION.authorityEventSha256,
    gate_effect: HISTORICAL_PREPARATION.gateEffect,
    authority: authorityMaskFor('legacy_receipt_migration'),
    allowed_next_action: HISTORICAL_PREPARATION.allowedNextAction,
  });
  return {
    schema_version: 'mobile-ux-batch1-decision-intent.v1',
    decision_id: 'mobile-ux-batch1-legacy-preparation-receipt-migration-v1',
    decision_class: 'schema_definition',
    contract_version: 'v1',
    repository: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    pull_request: 585,
    intent_artifact_path: ARTIFACT_PATHS.legacyMigrationIntent,
    validity_policy_artifact_record: policyRecord,
    gate_effect: 'none',
    authority: authorityMaskFor('legacy_receipt_migration'),
    allowed_next_action: 'materialize_legacy_preparation_receipt_only',
    non_claims: [
      'cohort_designation', 'manifest_freeze', 'manifest_creation',
      'reservation_activation', 'provisioning', 'execution', 'evidence_collection',
      'data_manifest_population', 'aggregation', 'promotion', 'architecture_acceptance',
      'checkpoint_coverage_or_pass', 'visual_authority', 'implementation',
      'native_acceptance', 'release', 'leadership_readiness',
    ],
    expires_at: '2026-08-16T00:00:00Z',
    invalidation_conditions: [...INVALIDATION_CONDITIONS_BY_KIND.legacy_receipt_migration],
    decision_subclass: 'legacy_preparation_receipt_migration',
    historical_subject_commit: HISTORICAL_PREPARATION.approvalTargetHeadSha,
    historical_subject_digest_domain: HISTORICAL_PREPARATION.subjectDigestDomain,
    historical_subject_digest: HISTORICAL_PREPARATION.subjectDigest,
    historical_subject_artifact_records: [{
      path: HISTORICAL_PREPARATION.subjectPath,
      git_mode: '100644',
      byte_length: HISTORICAL_PREPARATION.subjectByteLength,
      raw_sha256: HISTORICAL_PREPARATION.subjectRawSha256,
    }],
    historical_approval_instance_digest: historicalApprovalInstanceDigest,
    materialized_preparation_receipt_path: ARTIFACT_PATHS.legacyPreparationReceipt,
  };
}

function standardLegacyReceipt(intent, eventProjection, intentRawSha256) {
  const event = eventProjection.event;
  const receipt = {
    schema_version: 'mobile-ux-batch1-approval-receipt.v2',
    decision_id: intent.decision_id,
    decision_class: intent.decision_class,
    contract_version: intent.contract_version,
    repository: intent.repository,
    repository_id: intent.repository_id,
    pull_request: intent.pull_request,
    receipt_materialization_pull_request: 586,
    approval_target_head_sha: event.approval_target_head_sha,
    decision_artifact_path: intent.intent_artifact_path,
    decision_artifact_raw_sha256: intentRawSha256,
    subject_commit: intent.historical_subject_commit,
    subject_digest_domain: intent.historical_subject_digest_domain,
    subject_digest: intent.historical_subject_digest,
    validity_policy_artifact_record: intent.validity_policy_artifact_record,
    workflow_path: event.workflow_path,
    workflow_id: event.workflow_id,
    trusted_base_sha: event.pull_request_base_sha,
    workflow_run_id: event.workflow_run_id,
    run_attempt: event.run_attempt,
    workflow_conclusion: event.workflow_conclusion,
    deployment_id: event.deployment_id,
    deployment_waiting_status_id: event.deployment_waiting_status_id,
    deployment_success_status_id: event.deployment_success_status_id,
    environment_id: event.environment_id,
    environment_name: event.environment_name,
    approval_review_sha256: event.approval_review_sha256,
    reviewer_immutable_id: event.reviewer_immutable_id,
    validity_anchor_at: event.validity_anchor_at,
    success_observed_at: event.success_observed_at,
    protected_authority_event_ref: eventProjection.protected_authority_event_ref,
    authority_event_sha256: eventProjection.authority_event_sha256,
    parent_approval_tuple: null,
    gate_effect: intent.gate_effect,
    authority: intent.authority,
    allowed_next_action: intent.allowed_next_action,
    non_claims: intent.non_claims,
    expires_at: intent.expires_at,
    invalidation_conditions: intent.invalidation_conditions,
    decision_subclass: intent.decision_subclass,
    historical_approval_instance_digest: intent.historical_approval_instance_digest,
    materialized_preparation_receipt_path: intent.materialized_preparation_receipt_path,
    approval_instance_digest: '0'.repeat(64),
  };
  receipt.approval_instance_digest = computeApprovalInstanceDigest(receipt);
  return receipt;
}

function legacyPreparationReceipt(migrationReceiptRecord, migrationCommit, migrationReceipt) {
  const receipt = {
    schema_version: 'mobile-ux-batch1-legacy-preparation-approval-receipt.v1',
    decision_id: HISTORICAL_PREPARATION.decisionId,
    decision_class: HISTORICAL_PREPARATION.decisionClass,
    contract_version: 'v1',
    repository: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    receipt_materialization_pull_request: 587,
    receipt_path: ARTIFACT_PATHS.legacyPreparationReceipt,
    historical_preapproval_intent_status: HISTORICAL_PREPARATION.preapprovalIntentStatus,
    historical_approval_target_head_sha: HISTORICAL_PREPARATION.approvalTargetHeadSha,
    subject_commit: HISTORICAL_PREPARATION.approvalTargetHeadSha,
    subject_digest_domain: HISTORICAL_PREPARATION.subjectDigestDomain,
    subject_digest: HISTORICAL_PREPARATION.subjectDigest,
    historical_authority_event_sha256: HISTORICAL_PREPARATION.authorityEventSha256,
    historical_approval_instance_digest: migrationReceipt.historical_approval_instance_digest,
    migration_approval_receipt_artifact_record: migrationReceiptRecord,
    migration_receipt_materialization_commit_sha: migrationCommit,
    migration_approval_instance_digest: migrationReceipt.approval_instance_digest,
    parent_approval_tuple: null,
    gate_effect: HISTORICAL_PREPARATION.gateEffect,
    authority: authorityMaskFor('legacy_receipt_migration'),
    allowed_next_action: HISTORICAL_PREPARATION.allowedNextAction,
    expires_at: migrationReceipt.expires_at,
    approval_instance_digest: '0'.repeat(64),
  };
  receipt.approval_instance_digest = computeLegacyPreparationReceiptDigest(receipt);
  return receipt;
}

function repositoryBlobBytes(commit, relativePath) {
  const fixture = EXACT_BYTE_FIXTURES[relativePath];
  assert.ok(fixture, `missing exact-byte fixture for ${relativePath}`);
  assert.equal(fixture.source_commit, commit);
  const bytes = exactFixtureBytes(relativePath);
  assert.equal(bytes.length, fixture.byte_length);
  assert.equal(sha256Hex(bytes), fixture.raw_sha256);
  return bytes;
}

function historicalBytes() {
  return repositoryBlobBytes(
    HISTORICAL_PREPARATION.approvalTargetHeadSha,
    HISTORICAL_PREPARATION.subjectPath,
  );
}

function artifactRecordAtCommit(tempRoot, commit, relativePath) {
  const treeLine = runGit(tempRoot, ['ls-tree', commit, '--', relativePath]);
  const match = treeLine.match(/^([0-7]{6}) blob [0-9a-f]{40}\t(.+)$/);
  assert.ok(match, `missing fixture artifact ${commit}:${relativePath}`);
  const bytes = spawnSync(
    'git',
    ['show', `${commit}:${relativePath}`],
    {cwd: tempRoot, encoding: null, maxBuffer: 4 * 1024 * 1024},
  );
  assert.equal(bytes.status, 0, bytes.stderr?.toString('utf8'));
  return {
    path: relativePath,
    git_mode: match[1],
    byte_length: bytes.stdout.length,
    raw_sha256: sha256Hex(bytes.stdout),
  };
}

function importReferenceBatch1Subject(tempRoot) {
  const referenceCommit = '641d33c7ccb320f2e410718129e895993ce425ad';
  for (const relativePath of BATCH1_SUBJECT_PATHS) {
    const target = path.join(tempRoot, relativePath);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, repositoryBlobBytes(referenceCommit, relativePath));
  }
  return commitPaths(
    tempRoot,
    'import exact Batch 1 schema subject',
    BATCH1_SUBJECT_PATHS,
  );
}

function decisionValidityPolicyFixture() {
  return {
    schema_version: 'mobile-ux-batch1-decision-validity-policy.v1',
    policy_owner: TRUSTED_IDENTITY.reviewerImmutableId,
    validity_anchor_field: 'validity_anchor_at',
    validity_anchor_source: 'verified_deployment_waiting_status.created_at',
    global_max_validity_seconds: 90 * 24 * 60 * 60,
    global_max_validity_days: 90,
    expires_at_required: true,
    expires_at_must_be_after_success_observed_at: true,
    expires_at_must_not_exceed_validity_anchor_plus_class_max_validity_seconds: true,
    use_time_must_be_strictly_before_expires_at: true,
    unknown_or_unimplemented_invalidation_condition_fails_closed: true,
    class_policies: {
      legacy_preparation_receipt_migration: {
        max_validity_seconds: 7 * 24 * 60 * 60,
        max_validity_days: 7,
        ordered_invalidation_condition_ids:
          [...INVALIDATION_CONDITIONS_BY_KIND.legacy_receipt_migration],
      },
      cohort_designation: {
        max_validity_seconds: 30 * 24 * 60 * 60,
        max_validity_days: 30,
        ordered_invalidation_condition_ids:
          [...INVALIDATION_CONDITIONS_BY_KIND.cohort_designation],
      },
      manifest_freeze: {
        max_validity_seconds: 14 * 24 * 60 * 60,
        max_validity_days: 14,
        ordered_invalidation_condition_ids:
          [...INVALIDATION_CONDITIONS_BY_KIND.manifest_freeze],
      },
    },
    all_class_maxima_must_be_at_most_global_maximum: true,
    invalidation_conditions_must_exactly_equal_class_ordered_list: true,
    later_inactive_deployment_status_alone_does_not_invalidate: true,
  };
}

function buildLegacyPreparationChain(t, {mutatePreparation} = {}) {
  const {tempRoot, baseSha: initialBaseSha} = makeRepository(t);
  writeJson(tempRoot, ARTIFACT_PATHS.governancePolicy, {
    decision_validity_policy: decisionValidityPolicyFixture(),
  });
  const policyCommit = commitPaths(tempRoot, 'add governance policy fixture', [ARTIFACT_PATHS.governancePolicy]);
  const policyRecord = fileRecord(tempRoot, ARTIFACT_PATHS.governancePolicy);
  const intent = legacyIntent(policyRecord);
  const intentRunRecord = 'docs/agent-runs/2026-08-10-mobile-ux-batch1-legacy-intent.md';

  runGit(tempRoot, ['checkout', '-b', 'approved-head', policyCommit]);
  writeJson(tempRoot, ARTIFACT_PATHS.legacyMigrationIntent, intent);
  writeText(tempRoot, intentRunRecord, '# exact migration intent approval\n');
  const approvedHeadSha = commitPaths(
    tempRoot,
    'approved migration intent head',
    [ARTIFACT_PATHS.legacyMigrationIntent, intentRunRecord],
  );

  runGit(tempRoot, ['checkout', 'main']);
  writeJson(tempRoot, ARTIFACT_PATHS.legacyMigrationIntent, intent);
  writeText(tempRoot, intentRunRecord, '# exact migration intent approval\n');
  const landingCommitSha = commitPaths(
    tempRoot,
    'squash land migration intent',
    [ARTIFACT_PATHS.legacyMigrationIntent, intentRunRecord],
  );
  assert.notEqual(approvedHeadSha, landingCommitSha);
  assert.equal(
    runGit(tempRoot, ['rev-parse', `${approvedHeadSha}^{tree}`]),
    runGit(tempRoot, ['rev-parse', `${landingCommitSha}^{tree}`]),
  );

  const migrationEvent = {
    ...projectGitHubApprovalEvent(
      migrationEventEvidence({baseSha: policyCommit, approvedHeadSha}),
    ),
    provider_observed_at: '2026-08-10T00:00:10Z',
  };
  const migrationReceipt = standardLegacyReceipt(
    intent,
    migrationEvent,
    fileRecord(tempRoot, ARTIFACT_PATHS.legacyMigrationIntent).raw_sha256,
  );
  const migrationRunRecord =
    'docs/agent-runs/2026-08-10-mobile-ux-batch1-legacy-receipt.md';
  writeJson(tempRoot, ARTIFACT_PATHS.legacyMigrationReceipt, migrationReceipt);
  writeText(tempRoot, migrationRunRecord, '# migration receipt materialization\n');
  const migrationMaterializationCommitSha = commitPaths(
    tempRoot,
    'materialize migration receipt',
    [ARTIFACT_PATHS.legacyMigrationReceipt, migrationRunRecord],
  );
  const migrationReceiptRecord = fileRecord(tempRoot, ARTIFACT_PATHS.legacyMigrationReceipt);

  writeText(tempRoot, 'prep-base-marker.txt', 'separate protected stage\n');
  const prepBaseSha = commitPaths(tempRoot, 'separate preparation base', ['prep-base-marker.txt']);
  const preparationReceipt = legacyPreparationReceipt(
    migrationReceiptRecord,
    migrationMaterializationCommitSha,
    migrationReceipt,
  );
  if (mutatePreparation) {
    mutatePreparation(preparationReceipt, {
      landingCommitSha,
      migrationMaterializationCommitSha,
    });
  }
  const preparationRunRecord =
    'docs/agent-runs/2026-08-10-mobile-ux-batch1-preparation-receipt.md';
  writeJson(tempRoot, ARTIFACT_PATHS.legacyPreparationReceipt, preparationReceipt);
  writeText(tempRoot, preparationRunRecord, '# legacy preparation receipt\n');
  const prepHeadSha = commitPaths(
    tempRoot,
    'materialize preparation receipt',
    [ARTIFACT_PATHS.legacyPreparationReceipt, preparationRunRecord],
  );

  const exactHistoricalBytes = historicalBytes();
  const historical = historicalEventProjection();
  const approvalEvents = new Map([
    [HISTORICAL_PREPARATION.pullRequest, historical],
    [intent.pull_request, migrationEvent],
  ]);
  const mergeEnvelopes = new Map([
    [intent.pull_request, {
      repository_full_name: TRUSTED_IDENTITY.repository,
      repository_id: TRUSTED_IDENTITY.repositoryId,
      pull_request_number: intent.pull_request,
      pull_request_base_sha: policyCommit,
      approval_target_head_sha: approvedHeadSha,
      merge_commit_sha: landingCommitSha,
      complete_tree_sha: runGit(tempRoot, ['rev-parse', `${landingCommitSha}^{tree}`]),
      merged_at: '2026-08-10T00:00:05Z',
      provider_observed_at: '2026-08-10T00:00:10Z',
    }],
    [migrationReceipt.receipt_materialization_pull_request, {
      repository_full_name: TRUSTED_IDENTITY.repository,
      repository_id: TRUSTED_IDENTITY.repositoryId,
      pull_request_number: migrationReceipt.receipt_materialization_pull_request,
      pull_request_base_sha: landingCommitSha,
      approval_target_head_sha: migrationMaterializationCommitSha,
      merge_commit_sha: migrationMaterializationCommitSha,
      complete_tree_sha: runGit(
        tempRoot,
        ['rev-parse', `${migrationMaterializationCommitSha}^{tree}`],
      ),
      merged_at: '2026-08-10T00:00:08Z',
      provider_observed_at: '2026-08-10T00:00:10Z',
    }],
    [preparationReceipt.receipt_materialization_pull_request, {
      repository_full_name: TRUSTED_IDENTITY.repository,
      repository_id: TRUSTED_IDENTITY.repositoryId,
      pull_request_number: preparationReceipt.receipt_materialization_pull_request,
      pull_request_base_sha: prepBaseSha,
      approval_target_head_sha: prepHeadSha,
      merge_commit_sha: prepHeadSha,
      complete_tree_sha: runGit(tempRoot, ['rev-parse', `${prepHeadSha}^{tree}`]),
      merged_at: '2026-08-10T00:00:09Z',
      provider_observed_at: '2026-08-10T00:00:10Z',
    }],
  ]);
  const readers = {
    readGitHubArtifact: async () => ({
      commit: HISTORICAL_PREPARATION.approvalTargetHeadSha,
      object_id: '9'.repeat(40),
      record: {
        path: HISTORICAL_PREPARATION.subjectPath,
        git_mode: '100644',
        byte_length: exactHistoricalBytes.length,
        raw_sha256: sha256Hex(exactHistoricalBytes),
      },
      bytes: Buffer.from(exactHistoricalBytes),
      provider_observed_at: '2026-08-10T00:00:10Z',
    }),
    readApprovalEvent: async ({pullRequestNumber}) => {
      if (approvalEvents.has(pullRequestNumber)) {
        return structuredClone(approvalEvents.get(pullRequestNumber));
      }
      throw new Error(`unexpected approval event PR ${pullRequestNumber}`);
    },
    readPullRequestMerge: async ({pullRequestNumber}) => {
      if (mergeEnvelopes.has(pullRequestNumber)) {
        return structuredClone(mergeEnvelopes.get(pullRequestNumber));
      }
      throw new Error(`unexpected merge PR ${pullRequestNumber}`);
    },
  };
  return {
    tempRoot,
    initialBaseSha,
    policyCommit,
    policyRecord,
    intent,
    approvedHeadSha,
    landingCommitSha,
    migrationEvent,
    migrationReceipt,
    migrationMaterializationCommitSha,
    migrationReceiptRecord,
    prepBaseSha,
    prepHeadSha,
    preparationReceipt,
    preparationRunRecord,
    historical,
    approvalEvents,
    mergeEnvelopes,
    readers,
  };
}

async function validatePreparationFixture(fixture, readerOverrides = {}) {
  const readers = {...fixture.readers, ...readerOverrides};
  const context = createEvidenceContext(
    'https://github.com/LENKIN233/softbook_cet.git',
    readers,
  );
  return validateReceiptMaterialization(
    fixture.tempRoot,
    fixture.prepBaseSha,
    fixture.prepHeadSha,
    [ARTIFACT_PATHS.legacyPreparationReceipt, fixture.preparationRunRecord],
    587,
    context,
  );
}

function fixtureBlobBytes(tempRoot, commit, relativePath) {
  const result = spawnSync(
    'git',
    ['show', `${commit}:${relativePath}`],
    {cwd: tempRoot, encoding: null, maxBuffer: 4 * 1024 * 1024},
  );
  assert.equal(result.status, 0, result.stderr?.toString('utf8'));
  return Buffer.from(result.stdout);
}

function writeArtifactsFromCommit(tempRoot, commit, relativePaths) {
  for (const relativePath of relativePaths) {
    const target = path.join(tempRoot, relativePath);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, fixtureBlobBytes(tempRoot, commit, relativePath));
  }
}

function privacyAttestationFor({subjectCommit, subjectDigestDomain, subjectDigest, cohortId, cohortDigest}) {
  return {
    schema_version: 'mobile-ux-batch1-non-pii-attestation.v1',
    designation_subject_commit: subjectCommit,
    designation_subject_digest_domain: subjectDigestDomain,
    designation_subject_digest: subjectDigest,
    designated_cohort_id: cohortId,
    designated_cohort_sha256: cohortDigest,
    classification: 'opaque_campaign_identifier_non_pii',
    identifier_derivation:
      'cryptographically_random_at_least_128_bits_not_derived_from_participant_data',
    minimum_entropy_bits: 128,
    participant_attributes_used: [],
    repository_contains_participant_mapping: false,
    participant_mapping_location: 'off_repository_protected_control_plane',
    embedded_direct_identifier_fields: [],
    embedded_quasi_identifier_fields: [],
  };
}

function standardApprovalReceipt({
  kind,
  intent,
  eventProjection,
  parentTuple,
  decisionArtifactRawSha256,
  receiptMaterializationPullRequest,
}) {
  const event = eventProjection.event;
  const subject = kind === 'cohort_designation'
    ? {
        commit: intent.designation_subject_commit,
        domain: intent.designation_subject_digest_domain,
        digest: intent.designation_subject_digest,
      }
    : {
        commit: intent.final_freeze_subject_commit,
        domain: intent.final_freeze_subject_digest_domain,
        digest: intent.final_freeze_subject_digest,
      };
  const receipt = {
    schema_version: 'mobile-ux-batch1-approval-receipt.v2',
    decision_id: intent.decision_id,
    decision_class: intent.decision_class,
    contract_version: intent.contract_version,
    repository: intent.repository,
    repository_id: intent.repository_id,
    pull_request: intent.pull_request,
    receipt_materialization_pull_request: receiptMaterializationPullRequest,
    approval_target_head_sha: event.approval_target_head_sha,
    decision_artifact_path: intent.intent_artifact_path,
    decision_artifact_raw_sha256: decisionArtifactRawSha256,
    subject_commit: subject.commit,
    subject_digest_domain: subject.domain,
    subject_digest: subject.digest,
    validity_policy_artifact_record: intent.validity_policy_artifact_record,
    workflow_path: event.workflow_path,
    workflow_id: event.workflow_id,
    trusted_base_sha: event.pull_request_base_sha,
    workflow_run_id: event.workflow_run_id,
    run_attempt: event.run_attempt,
    workflow_conclusion: event.workflow_conclusion,
    deployment_id: event.deployment_id,
    deployment_waiting_status_id: event.deployment_waiting_status_id,
    deployment_success_status_id: event.deployment_success_status_id,
    environment_id: event.environment_id,
    environment_name: event.environment_name,
    approval_review_sha256: event.approval_review_sha256,
    reviewer_immutable_id: event.reviewer_immutable_id,
    validity_anchor_at: event.validity_anchor_at,
    success_observed_at: event.success_observed_at,
    protected_authority_event_ref: eventProjection.protected_authority_event_ref,
    authority_event_sha256: eventProjection.authority_event_sha256,
    parent_approval_tuple: structuredClone(parentTuple),
    gate_effect: intent.gate_effect,
    authority: intent.authority,
    allowed_next_action: intent.allowed_next_action,
    non_claims: intent.non_claims,
    expires_at: intent.expires_at,
    invalidation_conditions: intent.invalidation_conditions,
  };
  if (kind === 'cohort_designation') {
    Object.assign(receipt, {
      designated_cohort_id: intent.designated_cohort_id,
      designated_cohort_sha256: intent.designated_cohort_sha256,
      privacy_attestation_artifact_record: intent.privacy_attestation_artifact_record,
      privacy_attestation_authority_event_sha256: eventProjection.authority_event_sha256,
      parent_preparation_approval_instance_digest:
        intent.parent_preparation_approval_instance_digest,
    });
  } else {
    receipt.parent_designation_approval_instance_digest =
      intent.parent_designation_approval_instance_digest;
  }
  receipt.approval_instance_digest = '0'.repeat(64);
  receipt.approval_instance_digest = computeApprovalInstanceDigest(receipt);
  return receipt;
}

function standardParentTuple({receipt, receiptPath, receiptCommit, eventProjection, tempRoot}) {
  const event = eventProjection.event;
  return {
    parent_decision_id: receipt.decision_id,
    parent_decision_class: receipt.decision_class,
    parent_approval_target_head_sha: receipt.approval_target_head_sha,
    parent_receipt_materialization_commit_sha: receiptCommit,
    parent_receipt_materialization_pull_request:
      receipt.receipt_materialization_pull_request,
    parent_decision_artifact_path: receipt.decision_artifact_path,
    parent_decision_artifact_raw_sha256: receipt.decision_artifact_raw_sha256,
    parent_receipt_path: receiptPath,
    parent_receipt_raw_sha256:
      artifactRecordAtCommit(tempRoot, receiptCommit, receiptPath).raw_sha256,
    parent_subject_commit: receipt.subject_commit,
    parent_subject_digest_domain: receipt.subject_digest_domain,
    parent_subject_digest: receipt.subject_digest,
    parent_repository_id: event.repository_id,
    parent_workflow_id: event.workflow_id,
    parent_workflow_run_id: event.workflow_run_id,
    parent_run_attempt: event.run_attempt,
    parent_deployment_id: event.deployment_id,
    parent_deployment_waiting_status_id: event.deployment_waiting_status_id,
    parent_deployment_success_status_id: event.deployment_success_status_id,
    parent_environment_id: event.environment_id,
    parent_environment_name: event.environment_name,
    parent_approval_review_sha256: event.approval_review_sha256,
    parent_reviewer_immutable_id: event.reviewer_immutable_id,
    parent_validity_anchor_at: event.validity_anchor_at,
    parent_success_observed_at: event.success_observed_at,
    parent_approval_instance_digest: receipt.approval_instance_digest,
  };
}

function buildSchemaSubjectChain(t) {
  const chain = buildLegacyPreparationChain(t);
  const {tempRoot} = chain;
  runGit(tempRoot, ['checkout', 'main']);
  const supportPaths = [
    'docs/source.json',
    'apps/mobile/package-lock.json',
    'scripts/build_mobile_ux_batch1_cp_ba_browser_documents.mjs',
    'artifacts/mobile-ux-batch1/cp-ba-browser-documents.tar',
  ];
  writeText(tempRoot, supportPaths[0], '{"source":true}\n');
  writeText(tempRoot, supportPaths[1], '{"lockfileVersion":3}\n');
  writeText(tempRoot, supportPaths[2], 'deterministic build fixture\n');
  writeText(tempRoot, supportPaths[3], 'deterministic tar fixture\n');
  const supportCommit = commitPaths(tempRoot, 'add trusted R0/B2 fixture sources', supportPaths);
  const schemaCommit = importReferenceBatch1Subject(tempRoot);
  return {...chain, supportPaths, supportCommit, schemaCommit};
}

function resolvedValue(valueClass, value) {
  return {
    schema_version: 'mobile-ux-batch1-resolved-value.v1',
    value_class: valueClass,
    value,
    value_sha256: domainDigest(
      'softbook-cet/mobile-ux-batch1-resolved-value/v1',
      value,
    ),
  };
}

function fixtureResolutionValue(requirement) {
  if (requirement.allowed_value_class === 'human_role_confirmation_contract') {
    return {
      role_requirement_id: requirement.requirement_id,
      campaign_scoped_principal_pseudonym: `hmac-sha256:${'8'.repeat(64)}`,
      confirmation_event_sha256: '9'.repeat(64),
      real_identity_persisted: false,
    };
  }
  if (
    requirement.allowed_value_class === 'owner_exact_obligation_id_set' ||
    requirement.allowed_value_class === 'owner_exact_tier2_obligation_id_set'
  ) {
    return [`${requirement.requirement_id}-fixture-obligation`];
  }
  if (
    requirement.allowed_value_class ===
    'owner_selected_membership_stage_set_or_owner_backed_not_applicable'
  ) {
    return ['free'];
  }
  if (
    requirement.allowed_value_class ===
    'owner_selected_safe_origin_descriptor_or_owner_backed_not_applicable'
  ) {
    return {
      origin_kind: 'application_route',
      route_id: 'learning',
      parameter_schema: {version: 1},
    };
  }
  return {fixture_requirement_id: requirement.requirement_id};
}

function fixtureResolutionProvenance(requirement, sourceRecord) {
  let sourceClass = 'repository_artifact';
  if (requirement.allowed_value_class === 'human_role_confirmation_contract') {
    sourceClass = 'protected_human_confirmation';
  } else if (['account', 'content', 'environment'].includes(requirement.requirement_kind)) {
    sourceClass = 'verified_external_resource';
  }
  const local = sourceClass === 'repository_artifact';
  return {
    schema_version: 'mobile-ux-batch1-resolution-provenance.v1',
    source_class: sourceClass,
    source_ref: local
      ? 'repo://docs/source.json'
      : `github://LENKIN233/softbook_cet/fixture/${requirement.requirement_id}`,
    source_event_sha256: local ? null : 'a'.repeat(64),
    source_artifact_records: local ? [sourceRecord] : [],
    resolver_role: local
      ? 'repository_semantic_resolver'
      : sourceClass === 'protected_human_confirmation'
        ? 'confirmed_operator'
        : 'external_resource_verifier',
    effective_at: '2026-08-10T00:00:00Z',
    expires_at: '2026-09-01T00:00:00Z',
    gate_eligible: false,
  };
}

function resolveR0Requirement(requirement, sourceRecord) {
  const resolved = structuredClone(requirement);
  resolved.status = 'typed_value_resolved';
  resolved.authority = structuredClone(ALL_FALSE_AUTHORITY);
  resolved.resolved_value = resolvedValue(
    requirement.allowed_value_class,
    fixtureResolutionValue(requirement),
  );
  resolved.resolution_provenance = fixtureResolutionProvenance(
    requirement,
    sourceRecord,
  );
  return resolved;
}

function recalculateRegistryInventory(registry) {
  registry.inventory_digest = sha256Hex(
    Buffer.from(
      `${registry.inventory_digest_domain_separator}\0${JSON.stringify(registry.requirements_by_id)}`,
    ),
  );
}

function buildR0Registry(baseline, baselineCommit, sourceRecord) {
  const successor = structuredClone(baseline);
  successor.candidate_status = 'resolution_successor_candidate_incomplete';
  successor.global_blockers = [
    'protected_cohort_designation_missing',
    'post_designation_build_windows_and_compatibility_bindings_missing',
    'future_manifest_freeze_decision_missing',
    'exact_compatibility_keys_missing',
    'execution_manifest_subtree_must_remain_absent',
  ];
  successor.blocker_accounting.current_v2_typed_requirements = {
    pending_requirement_count: 9,
    resolved_requirement_count: 136,
    source_ref: '#/current_requirement_registry',
    separate_from_historical_migration: true,
  };
  successor.authority = structuredClone(ALL_FALSE_AUTHORITY);
  successor.materialization = {
    schema_version: 'mobile-ux-batch1-materialization.v1',
    stage_id: 'R0_resolution_successor',
    baseline_commit: baselineCommit,
    baseline_subject_digest: SCHEMA_SUBJECT_DIGEST,
    resolved_requirement_count: 136,
    pending_requirement_count: 9,
    gate_effect: 'none',
    authority: structuredClone(ALL_FALSE_AUTHORITY),
  };
  const registry = successor.current_requirement_registry;
  registry.status = 'typed_requirements_partially_resolved_pre_designation';
  registry.pending_requirement_count = 9;
  registry.authority = structuredClone(ALL_FALSE_AUTHORITY);
  for (const [requirementId, requirement] of Object.entries(registry.requirements_by_id)) {
    if (POST_DESIGNATION_REQUIREMENT_IDS.includes(requirementId)) {
      requirement.authority = structuredClone(ALL_FALSE_AUTHORITY);
    } else {
      registry.requirements_by_id[requirementId] = resolveR0Requirement(
        requirement,
        sourceRecord,
      );
    }
  }
  recalculateRegistryInventory(registry);
  return successor;
}

function buildR0SubjectChain(t, {mutateR0} = {}) {
  const chain = buildSchemaSubjectChain(t);
  const {tempRoot, schemaCommit} = chain;
  const registryPath = BATCH1_SUBJECT_PATHS[0];
  const baseline = JSON.parse(
    fixtureBlobBytes(tempRoot, schemaCommit, registryPath).toString('utf8'),
  );
  const sourceRecord = artifactRecordAtCommit(tempRoot, schemaCommit, 'docs/source.json');
  const r0 = buildR0Registry(baseline, schemaCommit, sourceRecord);
  if (mutateR0) mutateR0(r0);
  writeJson(tempRoot, registryPath, r0);
  const r0RunRecord = 'docs/agent-runs/2026-08-10-mobile-ux-batch1-r0-successor.md';
  writeText(tempRoot, r0RunRecord, '# exact R0 resolution successor\n');
  const r0Commit = commitPaths(
    tempRoot,
    'materialize exact R0 successor',
    [registryPath, r0RunRecord],
  );
  return {
    ...chain,
    baselineRegistry: baseline,
    r0Registry: r0,
    r0RunRecord,
    r0Commit,
  };
}

function buildCohortIntentChain(t, {touchAndRevertSubject = false} = {}) {
  const chain = buildR0SubjectChain(t);
  const {tempRoot} = chain;
  runGit(tempRoot, ['checkout', 'main']);
  const subjectCommit = chain.r0Commit;
  const subjectRecords = BATCH1_SUBJECT_PATHS.map((relativePath) =>
    artifactRecordAtCommit(tempRoot, subjectCommit, relativePath));
  const subjectDigestDomain = 'softbook-cet/mobile-ux-batch1-designation-subject/v1';
  const subjectDigest = computeSubjectDigest(subjectDigestDomain, subjectRecords);
  const cohortId = `cet4-${'a'.repeat(26)}`;
  const cohortDigest = computeDesignatedCohortDigest({
    subject_commit: subjectCommit,
    subject_digest_domain: subjectDigestDomain,
    subject_digest: subjectDigest,
    designated_cohort_id: cohortId,
  });
  const privacyAttestation = privacyAttestationFor({
    subjectCommit,
    subjectDigestDomain,
    subjectDigest,
    cohortId,
    cohortDigest,
  });
  const pullRequest = 588;
  const runRecord = 'docs/agent-runs/2026-08-10-mobile-ux-batch1-cohort-designation.md';
  runGit(tempRoot, ['checkout', '-b', `cohort-approved-${Math.random().toString(16).slice(2)}`, subjectCommit]);
  if (touchAndRevertSubject) {
    const protectedPath = BATCH1_SUBJECT_PATHS[0];
    const exactBytes = fixtureBlobBytes(tempRoot, subjectCommit, protectedPath);
    fs.appendFileSync(path.join(tempRoot, protectedPath), '\n');
    commitPaths(tempRoot, 'touch protected designation subject', [protectedPath]);
    fs.writeFileSync(path.join(tempRoot, protectedPath), exactBytes);
    commitPaths(tempRoot, 'revert protected designation subject bytes', [protectedPath]);
  }
  writeJson(tempRoot, ARTIFACT_PATHS.cohortNonPiiAttestation, privacyAttestation);
  const privacyAttestationRecord = fileRecord(
    tempRoot,
    ARTIFACT_PATHS.cohortNonPiiAttestation,
  );
  const intent = {
    schema_version: 'mobile-ux-batch1-decision-intent.v1',
    decision_id: 'mobile-ux-batch1-cohort-designation-v1',
    decision_class: 'cohort_designation',
    contract_version: 'v1',
    repository: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    pull_request: pullRequest,
    intent_artifact_path: ARTIFACT_PATHS.cohortDesignationIntent,
    validity_policy_artifact_record:
      artifactRecordAtCommit(tempRoot, subjectCommit, ARTIFACT_PATHS.governancePolicy),
    gate_effect: 'none',
    authority: authorityMaskFor('cohort_designation'),
    allowed_next_action: 'produce_B2_designation_bound_binding_successor_only',
    non_claims: [
      'manifest_creation', 'reservation_activation', 'provisioning', 'execution',
      'evidence_collection', 'data_manifest_population', 'aggregation', 'promotion',
      'architecture_acceptance', 'checkpoint_coverage_or_pass', 'visual_authority',
      'implementation', 'native_acceptance', 'release', 'leadership_readiness',
      'final_manifest_freeze',
    ],
    expires_at: '2026-09-01T00:00:00Z',
    invalidation_conditions: [...INVALIDATION_CONDITIONS_BY_KIND.cohort_designation],
    designation_subject_commit: subjectCommit,
    designation_subject_digest_domain: subjectDigestDomain,
    designation_subject_digest: subjectDigest,
    designation_subject_artifact_records: subjectRecords,
    designated_cohort_id: cohortId,
    designated_cohort_sha256: cohortDigest,
    privacy_attestation_artifact_record: privacyAttestationRecord,
    parent_preparation_approval_instance_digest:
      chain.preparationReceipt.approval_instance_digest,
  };
  writeJson(tempRoot, ARTIFACT_PATHS.cohortDesignationIntent, intent);
  writeText(tempRoot, runRecord, '# exact D1 cohort designation intent\n');
  const approvedHeadSha = commitPaths(
    tempRoot,
    'approve exact D1 cohort designation intent head',
    [ARTIFACT_PATHS.cohortDesignationIntent, ARTIFACT_PATHS.cohortNonPiiAttestation, runRecord],
  );
  return {
    ...chain,
    subjectCommit,
    subjectRecords,
    subjectDigestDomain,
    subjectDigest,
    cohortId,
    cohortDigest,
    privacyAttestation,
    privacyAttestationRecord,
    intent,
    intentPullRequest: pullRequest,
    intentRunRecord: runRecord,
    intentApprovedHeadSha: approvedHeadSha,
  };
}

function buildCohortReceiptChain(t, {mutateReceipt} = {}) {
  const chain = buildCohortIntentChain(t);
  const {tempRoot} = chain;
  runGit(tempRoot, ['checkout', 'main']);
  writeArtifactsFromCommit(tempRoot, chain.intentApprovedHeadSha, [
    ARTIFACT_PATHS.cohortDesignationIntent,
    ARTIFACT_PATHS.cohortNonPiiAttestation,
    chain.intentRunRecord,
  ]);
  const landingCommitSha = commitPaths(
    tempRoot,
    'squash land D1 cohort designation intent',
    [ARTIFACT_PATHS.cohortDesignationIntent, ARTIFACT_PATHS.cohortNonPiiAttestation, chain.intentRunRecord],
  );
  assert.equal(
    runGit(tempRoot, ['rev-parse', `${chain.intentApprovedHeadSha}^{tree}`]),
    runGit(tempRoot, ['rev-parse', `${landingCommitSha}^{tree}`]),
  );
  const event = stageEventProjection({
    pullRequest: chain.intentPullRequest,
    baseSha: chain.subjectCommit,
    approvedHeadSha: chain.intentApprovedHeadSha,
    serial: 1,
    minute: 10,
  });
  const preparationRecord = artifactRecordAtCommit(
    tempRoot,
    chain.prepHeadSha,
    ARTIFACT_PATHS.legacyPreparationReceipt,
  );
  const parentTuple = buildLegacyPreparationParentTuple({
    receipt: chain.preparationReceipt,
    migrationApprovalReceipt: chain.migrationReceipt,
    historicalEventProjection: chain.historical,
    preparationReceiptArtifactRecord: preparationRecord,
    observedPreparationReceiptArtifactRecord: preparationRecord,
    preparationReceiptMaterializationCommitSha: chain.prepHeadSha,
  });
  const receiptMaterializationPullRequest = 589;
  const receipt = standardApprovalReceipt({
    kind: 'cohort_designation',
    intent: chain.intent,
    eventProjection: event,
    parentTuple,
    decisionArtifactRawSha256: artifactRecordAtCommit(
      tempRoot,
      chain.intentApprovedHeadSha,
      ARTIFACT_PATHS.cohortDesignationIntent,
    ).raw_sha256,
    receiptMaterializationPullRequest,
  });
  if (mutateReceipt) {
    mutateReceipt(receipt);
    receipt.approval_instance_digest = computeApprovalInstanceDigest(receipt);
  }
  const receiptRunRecord =
    'docs/agent-runs/2026-08-10-mobile-ux-batch1-cohort-designation-receipt.md';
  writeJson(tempRoot, ARTIFACT_PATHS.cohortDesignationReceipt, receipt);
  writeText(tempRoot, receiptRunRecord, '# exact D1 approval receipt materialization\n');
  const receiptCommit = commitPaths(
    tempRoot,
    'materialize exact D1 approval receipt',
    [ARTIFACT_PATHS.cohortDesignationReceipt, receiptRunRecord],
  );
  chain.approvalEvents.set(chain.intentPullRequest, event);
  chain.mergeEnvelopes.set(chain.intentPullRequest, {
    repository_full_name: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    pull_request_number: chain.intentPullRequest,
    pull_request_base_sha: chain.subjectCommit,
    approval_target_head_sha: chain.intentApprovedHeadSha,
    merge_commit_sha: landingCommitSha,
    complete_tree_sha: runGit(tempRoot, ['rev-parse', `${landingCommitSha}^{tree}`]),
    merged_at: '2026-08-10T00:10:05Z',
    provider_observed_at: '2026-08-10T00:10:10Z',
  });
  chain.mergeEnvelopes.set(receiptMaterializationPullRequest, {
    repository_full_name: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    pull_request_number: receiptMaterializationPullRequest,
    pull_request_base_sha: landingCommitSha,
    approval_target_head_sha: receiptCommit,
    merge_commit_sha: receiptCommit,
    complete_tree_sha: runGit(tempRoot, ['rev-parse', `${receiptCommit}^{tree}`]),
    merged_at: '2026-08-10T00:10:08Z',
    provider_observed_at: '2026-08-10T00:10:10Z',
  });
  return {
    ...chain,
    designationEvent: event,
    designationLandingCommitSha: landingCommitSha,
    designationParentTuple: parentTuple,
    designationReceipt: receipt,
    designationReceiptPullRequest: receiptMaterializationPullRequest,
    designationReceiptRunRecord: receiptRunRecord,
    designationReceiptCommit: receiptCommit,
  };
}

function b2ArtifactRecord(tempRoot, commit, relativePath) {
  return artifactRecordAtCommit(tempRoot, commit, relativePath);
}

function designationBindingFromFixture(chain) {
  const receipt = chain.designationReceipt;
  return {
    decision_artifact_path: receipt.decision_artifact_path,
    receipt_path: ARTIFACT_PATHS.cohortDesignationReceipt,
    approval_target_head_sha: receipt.approval_target_head_sha,
    receipt_materialization_commit_sha: chain.designationReceiptCommit,
    receipt_materialization_pull_request:
      receipt.receipt_materialization_pull_request,
    subject_commit: receipt.subject_commit,
    subject_digest_domain: receipt.subject_digest_domain,
    subject_digest: receipt.subject_digest,
    designated_cohort_id: receipt.designated_cohort_id,
    designated_cohort_sha256: receipt.designated_cohort_sha256,
    approval_instance_digest: receipt.approval_instance_digest,
  };
}

function b2BuildValue(chain, designation) {
  const sourceRecords = [
    b2ArtifactRecord(chain.tempRoot, chain.designationReceiptCommit, 'apps/mobile/package-lock.json'),
    b2ArtifactRecord(
      chain.tempRoot,
      chain.designationReceiptCommit,
      'scripts/build_mobile_ux_batch1_cp_ba_browser_documents.mjs',
    ),
  ].sort((left, right) => left.path.localeCompare(right.path));
  const sourceClosureDigest = domainDigest(
    'softbook-cet/mobile-ux-batch1-build-source-closure/v1',
    sourceRecords.map((record) => [
      ['path', record.path],
      ['git_mode', record.git_mode],
      ['byte_length', record.byte_length],
      ['raw_sha256', record.raw_sha256],
    ]),
  );
  return {
    designation_subject_commit: designation.subject_commit,
    designation_subject_digest_domain: designation.subject_digest_domain,
    designation_subject_digest: designation.subject_digest,
    designated_cohort_id: designation.designated_cohort_id,
    designated_cohort_sha256: designation.designated_cohort_sha256,
    designation_approval_instance_digest: designation.approval_instance_digest,
    build_recipe_id: 'cp-ba-browser-documents-hermetic-build-v1',
    build_recipe_raw_sha256: b2ArtifactRecord(
      chain.tempRoot,
      chain.designationReceiptCommit,
      'scripts/build_mobile_ux_batch1_cp_ba_browser_documents.mjs',
    ).raw_sha256,
    toolchain_lock_raw_sha256: b2ArtifactRecord(
      chain.tempRoot,
      chain.designationReceiptCommit,
      'apps/mobile/package-lock.json',
    ).raw_sha256,
    build_output_role: 'cp-ba-browser-documents',
    source_closure_records: sourceRecords,
    source_closure_digest: sourceClosureDigest,
    builder_runtime_identity: {
      builder_image_digest: `sha256:${'7'.repeat(64)}`,
      runtime_version: 'node-v22.13.0',
      operating_system: 'linux',
      architecture: 'x86_64',
      locale: 'C.UTF-8',
      timezone: 'UTC',
    },
    archive_metadata_normalization_profile: {
      profile_id: 'ustar-portable-zero-metadata-v1',
      entry_order: 'normalized_path_utf8_ascending',
      mtime_epoch_seconds: 0,
      uid: 0,
      gid: 0,
      uname: '',
      gname: '',
      file_mode: '0644',
      directory_mode: '0755',
    },
    build_output_artifact: b2ArtifactRecord(
      chain.tempRoot,
      chain.designationReceiptCommit,
      'artifacts/mobile-ux-batch1/cp-ba-browser-documents.tar',
    ),
  };
}

function b2WindowValue(requirementId, offsetHours) {
  const day = 11 + offsetHours;
  const value = {
    window_requirement_id: requirementId,
    start_at_utc: `2026-08-${String(day).padStart(2, '0')}T01:00:00Z`,
    end_at_utc: `2026-08-${String(day).padStart(2, '0')}T02:00:00Z`,
    expires_at_utc: `2026-08-${String(day).padStart(2, '0')}T03:00:00Z`,
    schedule_issuer_authority_ref: 'github://LENKIN233/softbook_cet/owner-schedule',
    schedule_issuer_principal_pseudonym:
      `hmac-sha256:${String(offsetHours + 8).repeat(64).slice(0, 64)}`,
    schedule_issued_at_utc: '2026-08-10T00:00:00Z',
    schedule_event_ref: `github://LENKIN233/softbook_cet/schedule/${requirementId}`,
    schedule_event_sha256: '',
  };
  value.schedule_event_sha256 = domainDigest(
    'softbook-cet/mobile-ux-batch1-protected-schedule-event/v1',
    [
      ['window_requirement_id', value.window_requirement_id],
      ['start_at_utc', value.start_at_utc],
      ['end_at_utc', value.end_at_utc],
      ['expires_at_utc', value.expires_at_utc],
      ['schedule_issuer_authority_ref', value.schedule_issuer_authority_ref],
      ['schedule_issuer_principal_pseudonym', value.schedule_issuer_principal_pseudonym],
      ['schedule_issued_at_utc', value.schedule_issued_at_utc],
      ['schedule_event_ref', value.schedule_event_ref],
    ],
  );
  return value;
}

function resolveB2Requirement(chain, requirement, value, sourceClass) {
  const resolved = structuredClone(requirement);
  resolved.status = 'typed_value_resolved';
  resolved.authority = structuredClone(ALL_FALSE_AUTHORITY);
  resolved.resolved_value = resolvedValue(requirement.allowed_value_class, value);
  const deterministic = sourceClass === 'deterministic_derivation';
  resolved.resolution_provenance = {
    schema_version: 'mobile-ux-batch1-resolution-provenance.v1',
    source_class: sourceClass,
    source_ref: deterministic
      ? 'repo://deterministic-build'
      : 'github://LENKIN233/softbook_cet/schedule/verified',
    source_event_sha256: deterministic ? null : 'b'.repeat(64),
    source_artifact_records: deterministic
      ? [
          b2ArtifactRecord(chain.tempRoot, chain.designationReceiptCommit, 'apps/mobile/package-lock.json'),
          b2ArtifactRecord(
            chain.tempRoot,
            chain.designationReceiptCommit,
            'scripts/build_mobile_ux_batch1_cp_ba_browser_documents.mjs',
          ),
          b2ArtifactRecord(
            chain.tempRoot,
            chain.designationReceiptCommit,
            'artifacts/mobile-ux-batch1/cp-ba-browser-documents.tar',
          ),
        ]
      : [],
    resolver_role: deterministic ? 'deterministic_builder' : 'protected_product_owner',
    effective_at: '2026-08-10T00:00:00Z',
    expires_at: '2026-09-01T00:00:00Z',
    gate_eligible: false,
  };
  return resolved;
}

function buildB2Registry(chain) {
  const b2 = structuredClone(chain.r0Registry);
  b2.candidate_status = 'complete_candidate_pending_final_manifest_freeze';
  b2.global_blockers = [
    'future_manifest_freeze_decision_missing',
    'execution_manifest_subtree_must_remain_absent',
  ];
  b2.blocker_accounting.current_v2_typed_requirements = {
    pending_requirement_count: 0,
    resolved_requirement_count: 145,
    source_ref: '#/current_requirement_registry',
    separate_from_historical_migration: true,
  };
  b2.materialization = {
    schema_version: 'mobile-ux-batch1-materialization.v1',
    stage_id: 'B2_post_designation_binding_successor',
    baseline_commit: chain.r0Commit,
    baseline_subject_digest: chain.subjectDigest,
    resolved_requirement_count: 145,
    pending_requirement_count: 0,
    gate_effect: 'none',
    authority: structuredClone(ALL_FALSE_AUTHORITY),
  };
  const designation = designationBindingFromFixture(chain);
  b2.designation_decision_binding = designation;
  const registry = b2.current_requirement_registry;
  registry.status = 'typed_requirements_resolved_pending_manifest_freeze';
  registry.pending_requirement_count = 0;
  const build = b2BuildValue(chain, designation);
  registry.requirements_by_id['build-cp-ba-browser-documents'] = resolveB2Requirement(
    chain,
    registry.requirements_by_id['build-cp-ba-browser-documents'],
    build,
    'deterministic_derivation',
  );
  const windows = {};
  for (const [index, requirementId] of ['window-cp-ba', 'window-cp-cs', 'window-cp-web'].entries()) {
    windows[requirementId] = b2WindowValue(requirementId, index);
    registry.requirements_by_id[requirementId] = resolveB2Requirement(
      chain,
      registry.requirements_by_id[requirementId],
      windows[requirementId],
      'protected_owner_decision',
    );
  }
  const bindingBundleDigest = domainDigest(
    'softbook-cet/mobile-ux-batch1-binding-bundle/v1',
    [
      ['designation_subject_commit', designation.subject_commit],
      ['designation_subject_digest_domain', designation.subject_digest_domain],
      ['designation_subject_digest', designation.subject_digest],
      ['designated_cohort_id', designation.designated_cohort_id],
      ['designated_cohort_sha256', designation.designated_cohort_sha256],
      ['designation_approval_instance_digest', designation.approval_instance_digest],
      ['build-cp-ba-browser-documents', build],
      ['window-cp-ba', windows['window-cp-ba']],
      ['window-cp-cs', windows['window-cp-cs']],
      ['window-cp-web', windows['window-cp-web']],
    ],
  );
  const compatibilityDomains = {
    'compatibility-cp-ba-platform-browser':
      'softbook-cet/mobile-ux-batch1-compatibility/cp-ba-platform-browser/v1',
    'compatibility-cp-ba-shared-formal':
      'softbook-cet/mobile-ux-batch1-compatibility/cp-ba-shared-formal/v1',
    'compatibility-cp-ba-shared-managed':
      'softbook-cet/mobile-ux-batch1-compatibility/cp-ba-shared-managed/v1',
    'compatibility-cp-cs-aggregate':
      'softbook-cet/mobile-ux-batch1-compatibility/cp-cs-aggregate/v1',
    'compatibility-cp-web-aggregate':
      'softbook-cet/mobile-ux-batch1-compatibility/cp-web-aggregate/v1',
  };
  const compatibility = {};
  for (const [requirementId, digestDomain] of Object.entries(compatibilityDomains)) {
    compatibility[requirementId] = domainDigest(digestDomain, [
      ['designation_subject_commit', designation.subject_commit],
      ['designation_subject_digest_domain', designation.subject_digest_domain],
      ['designation_subject_digest', designation.subject_digest],
      ['binding_bundle_digest', bindingBundleDigest],
      ['compatibility_requirement_id', requirementId],
    ]);
    registry.requirements_by_id[requirementId] = resolveB2Requirement(
      chain,
      registry.requirements_by_id[requirementId],
      compatibility[requirementId],
      'deterministic_derivation',
    );
  }
  const cpBaCompatibilityDigest = domainDigest(
    'softbook-cet/mobile-ux-batch1-compatibility-map/cp-ba/v1',
    [
      ['compatibility-cp-ba-platform-browser', compatibility['compatibility-cp-ba-platform-browser']],
      ['compatibility-cp-ba-shared-formal', compatibility['compatibility-cp-ba-shared-formal']],
      ['compatibility-cp-ba-shared-managed', compatibility['compatibility-cp-ba-shared-managed']],
    ],
  );
  b2.binding_metadata = {
    designation_subject_commit: designation.subject_commit,
    designation_subject_digest_domain: designation.subject_digest_domain,
    designation_subject_digest: designation.subject_digest,
    designated_cohort_id: designation.designated_cohort_id,
    designated_cohort_sha256: designation.designated_cohort_sha256,
    designation_approval_instance_digest: designation.approval_instance_digest,
    build_source_closure_digest: build.source_closure_digest,
    binding_bundle_digest: bindingBundleDigest,
    cp_ba_compatibility_map_digest: cpBaCompatibilityDigest,
  };
  recalculateRegistryInventory(registry);
  return b2;
}

function buildB2SubjectChain(t, {mutateB2} = {}) {
  const chain = buildCohortReceiptChain(t);
  const b2 = buildB2Registry(chain);
  if (mutateB2) {
    mutateB2(b2);
    recalculateRegistryInventory(b2.current_requirement_registry);
  }
  writeJson(chain.tempRoot, BATCH1_SUBJECT_PATHS[0], b2);
  const runRecord = 'docs/agent-runs/2026-08-10-mobile-ux-batch1-b2-successor.md';
  writeText(chain.tempRoot, runRecord, '# exact B2 designation-bound successor\n');
  const b2Commit = commitPaths(
    chain.tempRoot,
    'materialize exact B2 successor',
    [BATCH1_SUBJECT_PATHS[0], runRecord],
  );
  const subjectRecords = BATCH1_SUBJECT_PATHS.map((relativePath) =>
    artifactRecordAtCommit(chain.tempRoot, b2Commit, relativePath));
  const subjectDigest = computeSubjectDigest(SUBJECT_DIGEST_DOMAINS.b2, subjectRecords);
  return {
    ...chain,
    b2Registry: b2,
    b2RunRecord: runRecord,
    b2Commit,
    b2SubjectRecords: subjectRecords,
    b2SubjectDigest: subjectDigest,
  };
}

function buildManifestIntentChain(t, {mutateB2} = {}) {
  const chain = buildB2SubjectChain(t, {mutateB2});
  const {tempRoot} = chain;
  const pullRequest = 590;
  const intent = {
    schema_version: 'mobile-ux-batch1-decision-intent.v1',
    decision_id: 'mobile-ux-batch1-manifest-freeze-v1',
    decision_class: 'manifest_freeze',
    contract_version: 'v1',
    repository: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    pull_request: pullRequest,
    intent_artifact_path: ARTIFACT_PATHS.manifestFreezeIntent,
    validity_policy_artifact_record:
      artifactRecordAtCommit(tempRoot, chain.b2Commit, ARTIFACT_PATHS.governancePolicy),
    gate_effect: 'batch1_exact_manifest_freeze_and_reservation_activation_only',
    authority: authorityMaskFor('manifest_freeze'),
    allowed_next_action:
      'mark_exact_catalog_reservations_active_for_later_separate_authorization_without_manifest_creation_population_execution_or_evidence',
    non_claims: [
      'manifest_creation', 'provisioning', 'execution', 'evidence_collection',
      'data_manifest_population', 'aggregation', 'promotion',
      'architecture_acceptance', 'checkpoint_coverage_or_pass', 'visual_authority',
      'implementation', 'native_acceptance', 'release', 'leadership_readiness',
    ],
    expires_at: '2026-08-20T00:00:00Z',
    invalidation_conditions: [...INVALIDATION_CONDITIONS_BY_KIND.manifest_freeze],
    final_freeze_subject_commit: chain.b2Commit,
    final_freeze_subject_digest_domain: SUBJECT_DIGEST_DOMAINS.b2,
    final_freeze_subject_digest: chain.b2SubjectDigest,
    final_freeze_subject_artifact_records: chain.b2SubjectRecords,
    parent_designation_approval_instance_digest:
      chain.designationReceipt.approval_instance_digest,
  };
  const runRecord = 'docs/agent-runs/2026-08-10-mobile-ux-batch1-manifest-freeze.md';
  runGit(tempRoot, [
    'checkout',
    '-b',
    `manifest-approved-${Math.random().toString(16).slice(2)}`,
    chain.b2Commit,
  ]);
  writeJson(tempRoot, ARTIFACT_PATHS.manifestFreezeIntent, intent);
  writeText(tempRoot, runRecord, '# exact F3 manifest freeze intent\n');
  const approvedHeadSha = commitPaths(
    tempRoot,
    'approve exact F3 manifest freeze intent head',
    [ARTIFACT_PATHS.manifestFreezeIntent, runRecord],
  );
  return {
    ...chain,
    manifestIntent: intent,
    manifestIntentPullRequest: pullRequest,
    manifestIntentRunRecord: runRecord,
    manifestIntentApprovedHeadSha: approvedHeadSha,
  };
}

function buildManifestReceiptChain(t, {mutateB2, mutateReceipt} = {}) {
  const chain = buildManifestIntentChain(t, {mutateB2});
  const {tempRoot} = chain;
  runGit(tempRoot, ['checkout', 'main']);
  writeArtifactsFromCommit(tempRoot, chain.manifestIntentApprovedHeadSha, [
    ARTIFACT_PATHS.manifestFreezeIntent,
    chain.manifestIntentRunRecord,
  ]);
  const landingCommitSha = commitPaths(
    tempRoot,
    'squash land F3 manifest freeze intent',
    [ARTIFACT_PATHS.manifestFreezeIntent, chain.manifestIntentRunRecord],
  );
  assert.equal(
    runGit(tempRoot, ['rev-parse', `${chain.manifestIntentApprovedHeadSha}^{tree}`]),
    runGit(tempRoot, ['rev-parse', `${landingCommitSha}^{tree}`]),
  );
  const event = stageEventProjection({
    pullRequest: chain.manifestIntentPullRequest,
    baseSha: chain.b2Commit,
    approvedHeadSha: chain.manifestIntentApprovedHeadSha,
    serial: 2,
    minute: 20,
  });
  const parentTuple = standardParentTuple({
    receipt: chain.designationReceipt,
    receiptPath: ARTIFACT_PATHS.cohortDesignationReceipt,
    receiptCommit: chain.designationReceiptCommit,
    eventProjection: chain.designationEvent,
    tempRoot,
  });
  const receiptPullRequest = 591;
  const receipt = standardApprovalReceipt({
    kind: 'manifest_freeze',
    intent: chain.manifestIntent,
    eventProjection: event,
    parentTuple,
    decisionArtifactRawSha256: artifactRecordAtCommit(
      tempRoot,
      chain.manifestIntentApprovedHeadSha,
      ARTIFACT_PATHS.manifestFreezeIntent,
    ).raw_sha256,
    receiptMaterializationPullRequest: receiptPullRequest,
  });
  if (mutateReceipt) {
    mutateReceipt(receipt);
    receipt.approval_instance_digest = computeApprovalInstanceDigest(receipt);
  }
  const receiptRunRecord =
    'docs/agent-runs/2026-08-10-mobile-ux-batch1-manifest-freeze-receipt.md';
  writeJson(tempRoot, ARTIFACT_PATHS.manifestFreezeReceipt, receipt);
  writeText(tempRoot, receiptRunRecord, '# exact F3 approval receipt materialization\n');
  const receiptCommit = commitPaths(
    tempRoot,
    'materialize exact F3 approval receipt',
    [ARTIFACT_PATHS.manifestFreezeReceipt, receiptRunRecord],
  );
  chain.approvalEvents.set(chain.manifestIntentPullRequest, event);
  chain.mergeEnvelopes.set(chain.manifestIntentPullRequest, {
    repository_full_name: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    pull_request_number: chain.manifestIntentPullRequest,
    pull_request_base_sha: chain.b2Commit,
    approval_target_head_sha: chain.manifestIntentApprovedHeadSha,
    merge_commit_sha: landingCommitSha,
    complete_tree_sha: runGit(tempRoot, ['rev-parse', `${landingCommitSha}^{tree}`]),
    merged_at: '2026-08-10T00:20:05Z',
    provider_observed_at: '2026-08-10T00:20:10Z',
  });
  chain.mergeEnvelopes.set(receiptPullRequest, {
    repository_full_name: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    pull_request_number: receiptPullRequest,
    pull_request_base_sha: landingCommitSha,
    approval_target_head_sha: receiptCommit,
    merge_commit_sha: receiptCommit,
    complete_tree_sha: runGit(tempRoot, ['rev-parse', `${receiptCommit}^{tree}`]),
    merged_at: '2026-08-10T00:20:08Z',
    provider_observed_at: '2026-08-10T00:20:10Z',
  });
  return {
    ...chain,
    manifestEvent: event,
    manifestLandingCommitSha: landingCommitSha,
    manifestParentTuple: parentTuple,
    manifestReceipt: receipt,
    manifestReceiptPullRequest: receiptPullRequest,
    manifestReceiptRunRecord: receiptRunRecord,
    manifestReceiptCommit: receiptCommit,
  };
}

test('trusted base code validates a generic-sensitive head strictly as Git data', async (t) => {
  const {tempRoot, baseSha} = makeRepository(t);
  const headSha = commitBootstrapProbe(tempRoot);
  runGit(tempRoot, ['checkout', '--detach', baseSha]);
  const file = githubFiles(t, tempRoot, BOOTSTRAP_PROBE_FILES);

  const result = await validatePullRequest(
    validationOptions(tempRoot, baseSha, headSha, file, 'generic_sensitive'),
  );
  assert.equal(result.status, 'passed');
  assert.equal(result.stage, 'generic_sensitive');
  assert.equal(result.head_sha, headSha);
});

test('live Files API rename metadata cannot replace exact event-head Git classification truth', async (t) => {
  const {tempRoot, baseSha} = makeRepository(t);
  const headSha = commitBootstrapProbe(tempRoot);
  runGit(tempRoot, ['checkout', '--detach', baseSha]);
  const file = githubFiles(t, tempRoot, BOOTSTRAP_PROBE_FILES, {
    [BOOTSTRAP_PROBE_FILES[0]]: {
      status: 'renamed',
      previous_filename: ARTIFACT_PATHS.cohortDesignationIntent,
    },
  });

  const result = await validatePullRequest(
    validationOptions(tempRoot, baseSha, headSha, file, 'generic_sensitive'),
  );
  assert.equal(result.status, 'passed');
  assert.equal(result.stage, 'generic_sensitive');
});

test('historical replay classification paths retain both sides of exact Git renames and copies', async (t) => {
  await t.test('rename', () => {
    const {tempRoot} = makeRepository(t);
    const sourcePath = 'docs/release/historical-replay-rename-source.json';
    const targetPath = 'docs/release/historical-replay-rename-target.json';
    writeText(tempRoot, sourcePath, '{"stable":"rename"}\n');
    const baseSha = commitPaths(tempRoot, 'add historical rename source', [sourcePath]);
    fs.renameSync(path.join(tempRoot, sourcePath), path.join(tempRoot, targetPath));
    const headSha = commitPaths(
      tempRoot,
      'rename historical recovery artifact',
      [sourcePath, targetPath],
    );
    assert.deepEqual(
      [...exactGitClassificationPaths(tempRoot, baseSha, headSha)].sort(),
      [sourcePath, targetPath].sort(),
    );
  });

  await t.test('copy', () => {
    const {tempRoot} = makeRepository(t);
    const sourcePath = 'docs/release/historical-replay-copy-source.json';
    const targetPath = 'docs/release/historical-replay-copy-target.json';
    writeText(tempRoot, sourcePath, '{"stable":"copy"}\n');
    const baseSha = commitPaths(tempRoot, 'add historical copy source', [sourcePath]);
    fs.copyFileSync(path.join(tempRoot, sourcePath), path.join(tempRoot, targetPath));
    const headSha = commitPaths(
      tempRoot,
      'copy historical recovery artifact',
      [targetPath],
    );
    assert.deepEqual(
      [...exactGitClassificationPaths(tempRoot, baseSha, headSha)].sort(),
      [sourcePath, targetPath].sort(),
    );
  });
});

test('bootstrap-installed recovery is end-to-end, add-only, and never executes head code', async (t) => {
  async function runFixture(t, fixtureOptions, entryOverrides = {}) {
    const {tempRoot, bootstrapSha, bootstrapLanding} =
      makeBootstrapInstalledRepository(t);
    const fixture = addBootstrapMaintenanceHead(
      tempRoot,
      bootstrapSha,
      fixtureOptions,
    );
    runGit(tempRoot, ['checkout', '--detach', bootstrapSha]);
    const payloadWasPresent =
      recoverySnapshotAt(tempRoot, bootstrapSha, fixture.payloadPath).present;
    const file = githubFiles(t, tempRoot, fixture.changedPaths, {
      [fixture.decisionPath]: {status: 'added'},
      [fixture.runRecordPath]: {status: 'added'},
      [fixture.payloadPath]: {status: payloadWasPresent ? 'modified' : 'added'},
      ...entryOverrides,
    });
    const promise = validatePullRequest(
      validationOptions(
        tempRoot,
        bootstrapSha,
        fixture.headSha,
        file,
        'governance_maintenance',
      ),
      {
        readCommitPullRequestAssociation: async () => bootstrapLanding,
      },
    );
    return {promise, fixture, tempRoot, bootstrapSha};
  }

  await t.test('valid bootstrap maintenance envelope', async (t) => {
    const {promise} = await runFixture(t);
    const result = await promise;
    assert.equal(result.status, 'passed');
    assert.equal(result.governance_base_state, 'inactive_bootstrap_installed');
    assert.equal(result.stage, 'governance_maintenance');
  });

  await t.test('kernel added only after the bootstrap merge cannot prove installation', async (t) => {
    const deferredClosurePath =
      'scripts/lib/mobile_ux_batch1_governance_recovery_contract.mjs';
    const {
      tempRoot,
      trustedBaseSha,
      bootstrapLanding,
    } = makeBootstrapWithDeferredClosureRepository(t, deferredClosurePath);
    const fixture = addBootstrapMaintenanceHead(tempRoot, trustedBaseSha, {
      slug: 'deferred-kernel-is-not-bootstrap',
    });
    runGit(tempRoot, ['checkout', '--detach', trustedBaseSha]);
    const file = githubFiles(t, tempRoot, fixture.changedPaths, {
      [fixture.decisionPath]: {status: 'added'},
      [fixture.runRecordPath]: {status: 'added'},
      [fixture.payloadPath]: {status: 'added'},
    });
    await assert.rejects(
      validatePullRequest(
        validationOptions(
          tempRoot,
          trustedBaseSha,
          fixture.headSha,
          file,
          'governance_maintenance',
        ),
        {readCommitPullRequestAssociation: async () => bootstrapLanding},
      ),
      new RegExp(
        `required artifact is missing at .*: ${deferredClosurePath.replaceAll('/', '\\/')}`,
      ),
    );
  });

  await t.test('syntax-invalid candidate validator remains unexecuted head data', async (t) => {
    const {promise, fixture, tempRoot} = await runFixture(t, {
      slug: 'invalid-head-code-data',
      payloadPath: 'scripts/validate_mobile_ux_batch1_governance.mjs',
      payloadBytes: Buffer.from('this is deliberately invalid JavaScript !!!\n', 'utf8'),
    });
    const result = await promise;
    assert.equal(result.status, 'passed');
    const headCheck = spawnSync(
      process.execPath,
      ['--check', `/dev/stdin`],
      {
        input: spawnSync(
          'git',
          ['show', `${fixture.headSha}:${fixture.payloadPath}`],
          {cwd: tempRoot, encoding: null},
        ).stdout,
        encoding: 'utf8',
      },
    );
    assert.notEqual(headCheck.status, 0);
  });

  for (const [label, target, apiEntry] of [
    [
      'modified API status',
      'decision',
      {status: 'modified'},
    ],
    [
      'renamed API shape',
      'decision',
      {
        status: 'renamed',
        previous_filename:
          'scripts/fixtures/mobile-ux-batch1-foundation-activation-v1/old-recovery-source.txt',
      },
    ],
    [
      'copied API shape',
      'decision',
      {
        status: 'copied',
        previous_filename:
          'scripts/fixtures/mobile-ux-batch1-foundation-activation-v1/copied-recovery-source.txt',
      },
    ],
    [
      'run-record API status and previous filename drift',
      'run_record',
      {
        status: 'renamed',
        previous_filename:
          'docs/agent-runs/2026-08-10-unrelated-run-record.md',
      },
    ],
  ]) {
    await t.test(label, async (t) => {
      const {tempRoot, bootstrapSha, bootstrapLanding} =
        makeBootstrapInstalledRepository(t);
      const altered = addBootstrapMaintenanceHead(
        tempRoot,
        bootstrapSha,
        {slug: `api-${label.toLowerCase().replaceAll(' ', '-')}`},
      );
      runGit(tempRoot, ['checkout', '--detach', bootstrapSha]);
      const file = githubFiles(t, tempRoot, altered.changedPaths, {
        [altered.decisionPath]:
          target === 'decision' ? apiEntry : {status: 'added'},
        [altered.runRecordPath]:
          target === 'run_record' ? apiEntry : {status: 'added'},
        [altered.payloadPath]: {status: 'added'},
      });
      const result = await validatePullRequest(
        validationOptions(
          tempRoot,
          bootstrapSha,
          altered.headSha,
          file,
          'governance_maintenance',
        ),
        {readCommitPullRequestAssociation: async () => bootstrapLanding},
      );
      assert.equal(result.status, 'passed');
    });
  }

  await t.test('unchanged outside source copied to the current run record is rejected by Git', async (t) => {
    const {tempRoot, bootstrapSha, bootstrapLanding} =
      makeBootstrapInstalledRepository(t);
    const slug = 'current-run-record-copy';
    const outsidePath =
      'scripts/fixtures/mobile-ux-batch1-foundation-activation-v1/current-run-record-copy-source.md';
    writeText(tempRoot, outsidePath, `# ${slug}\n`);
    const baseSha = commitPaths(
      tempRoot,
      'add unchanged outside run-record copy source',
      [outsidePath],
    );
    const fixture = addBootstrapMaintenanceHead(tempRoot, baseSha, {slug});
    const copyDiff = runGit(tempRoot, [
      'diff',
      '--name-status',
      '-M',
      '-C',
      '--find-copies-harder',
      '-l0',
      baseSha,
      fixture.headSha,
    ]);
    assert.match(
      copyDiff,
      new RegExp(`C100\\t${outsidePath.replaceAll('/', '\\/')}\\t${fixture.runRecordPath.replaceAll('/', '\\/')}`),
    );
    runGit(tempRoot, ['checkout', '--detach', baseSha]);
    const file = githubFiles(t, tempRoot, fixture.changedPaths, {
      [fixture.decisionPath]: {status: 'added'},
      [fixture.runRecordPath]: {status: 'added'},
      [fixture.payloadPath]: {status: 'added'},
    });
    await assert.rejects(
      validatePullRequest(
        validationOptions(
          tempRoot,
          baseSha,
          fixture.headSha,
          file,
          'governance_maintenance',
        ),
        {readCommitPullRequestAssociation: async () => bootstrapLanding},
      ),
      /specialized agent run record must be an exact Git add, not a rename or copy/,
    );
  });

  await t.test('outside source renamed to the current recovery decision is rejected by Git', async (t) => {
    const {tempRoot, bootstrapSha, bootstrapLanding} =
      makeBootstrapInstalledRepository(t);
    const slug = 'current-decision-rename';
    const template = addBootstrapMaintenanceHead(tempRoot, bootstrapSha, {slug});
    const templateBytes = fs.readFileSync(
      path.join(tempRoot, template.decisionPath),
    );
    runGit(tempRoot, ['checkout', '-B', 'decision-rename-attack', bootstrapSha]);
    const outsidePath =
      'scripts/fixtures/mobile-ux-batch1-foundation-activation-v1/current-decision-rename-source.json';
    const outsideTarget = path.join(tempRoot, outsidePath);
    fs.mkdirSync(path.dirname(outsideTarget), {recursive: true});
    fs.writeFileSync(outsideTarget, templateBytes);
    const baseSha = commitPaths(
      tempRoot,
      'add outside recovery-decision rename source',
      [outsidePath],
    );
    const fixture = addBootstrapMaintenanceHead(tempRoot, baseSha, {slug});
    fs.rmSync(outsideTarget);
    const decision = JSON.parse(
      fs.readFileSync(path.join(tempRoot, fixture.decisionPath), 'utf8'),
    );
    decision.changed_artifacts = [
      ...decision.changed_artifacts,
      buildChangedArtifactRecord(
        outsidePath,
        recoverySnapshotAt(tempRoot, baseSha, outsidePath),
        structuredClone(ABSENT_ARTIFACT_SNAPSHOT),
      ),
    ].sort((left, right) => left.path.localeCompare(right.path));
    writeJson(tempRoot, fixture.decisionPath, decision);
    runGit(tempRoot, ['add', '-A', '--', outsidePath, fixture.decisionPath]);
    runGit(tempRoot, ['commit', '--amend', '--no-edit']);
    const headSha = runGit(tempRoot, ['rev-parse', 'HEAD']);
    const changedPaths = [...fixture.changedPaths];
    const renameDiff = runGit(tempRoot, [
      'diff',
      '--name-status',
      '-M',
      '-C',
      '--find-copies-harder',
      '-l0',
      baseSha,
      headSha,
    ]);
    assert.match(
      renameDiff,
      new RegExp(`R[0-9]+\\t${outsidePath.replaceAll('/', '\\/')}\\t${fixture.decisionPath.replaceAll('/', '\\/')}`),
    );
    runGit(tempRoot, ['checkout', '--detach', baseSha]);
    const file = githubFiles(t, tempRoot, changedPaths, {
      [fixture.decisionPath]: {status: 'added'},
      [fixture.runRecordPath]: {status: 'added'},
      [fixture.payloadPath]: {status: 'added'},
    });
    await assert.rejects(
      validatePullRequest(
        validationOptions(
          tempRoot,
          baseSha,
          headSha,
          file,
          'governance_maintenance',
        ),
        {readCommitPullRequestAssociation: async () => bootstrapLanding},
      ),
      /recovery decision artifact must be an exact Git add, not a rename or copy/,
    );
  });

  await t.test('unlimited rename detection rejects an inexact decision copy among more than 1000 candidates', async (t) => {
    const {tempRoot, bootstrapSha, bootstrapLanding} =
      makeBootstrapInstalledRepository(t);
    const slug = 'rename-limit-decision-copy';
    const template = addBootstrapMaintenanceHead(tempRoot, bootstrapSha, {slug});
    const templateBytes = fs.readFileSync(
      path.join(tempRoot, template.decisionPath),
    );
    runGit(tempRoot, ['checkout', '-B', 'rename-limit-attack', bootstrapSha]);
    const candidateRoot =
      'scripts/fixtures/mobile-ux-batch1-foundation-activation-v1/rename-limit-candidates';
    for (let index = 0; index < 1001; index += 1) {
      const relativePath = `${candidateRoot}/source-${String(index).padStart(4, '0')}.json`;
      const target = path.join(tempRoot, relativePath);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.writeFileSync(target, templateBytes);
    }
    const baseSha = commitPaths(
      tempRoot,
      'add more than one thousand inexact copy candidates',
      [candidateRoot],
    );
    runGit(tempRoot, ['config', 'diff.renameLimit', '1']);
    const fixture = addBootstrapMaintenanceHead(tempRoot, baseSha, {slug});
    const unlimitedDiff = runGit(tempRoot, [
      'diff',
      '--name-status',
      '-M',
      '-C',
      '--find-copies-harder',
      '-l0',
      baseSha,
      fixture.headSha,
    ]);
    assert.match(
      unlimitedDiff,
      new RegExp(
        `C[0-9]+\\t${candidateRoot.replaceAll('/', '\\/')}\\/source-[0-9]{4}\\.json\\t${fixture.decisionPath.replaceAll('/', '\\/')}`,
      ),
    );
    const limitedDiff = spawnSync(
      'git',
      [
        'diff',
        '--name-status',
        '-M',
        '-C',
        '--find-copies-harder',
        baseSha,
        fixture.headSha,
      ],
      {cwd: tempRoot, encoding: 'utf8'},
    );
    assert.equal(limitedDiff.status, 0, limitedDiff.stderr);
    assert.match(
      limitedDiff.stdout,
      new RegExp(`A\\t${fixture.decisionPath.replaceAll('/', '\\/')}`),
    );
    runGit(tempRoot, ['checkout', '--detach', baseSha]);
    const file = githubFiles(t, tempRoot, fixture.changedPaths, {
      [fixture.decisionPath]: {status: 'added'},
      [fixture.runRecordPath]: {status: 'added'},
      [fixture.payloadPath]: {status: 'added'},
    });
    await assert.rejects(
      validatePullRequest(
        validationOptions(
          tempRoot,
          baseSha,
          fixture.headSha,
          file,
          'governance_maintenance',
        ),
        {readCommitPullRequestAssociation: async () => bootstrapLanding},
      ),
      /recovery decision artifact must be an exact Git add, not a rename or copy/,
    );
  });

  await t.test('existing recovery decision rewrite is rejected as non-add', async (t) => {
    const {tempRoot, bootstrapSha, bootstrapLanding} =
      makeBootstrapInstalledRepository(t);
    const slug = 'existing-decision-rewrite';
    const decisionPath =
      `docs/design/decisions/mobile-ux-batch1-governance-maintenance-v1/` +
      `pr-999-${slug}.json`;
    writeText(tempRoot, decisionPath, '{"prior":"immutable decision"}\n');
    const rewriteBaseSha = commitPaths(
      tempRoot,
      'materialize prior recovery decision',
      [decisionPath],
    );
    const fixture = addBootstrapMaintenanceHead(
      tempRoot,
      rewriteBaseSha,
      {slug},
    );
    runGit(tempRoot, ['checkout', '--detach', rewriteBaseSha]);
    const file = githubFiles(t, tempRoot, fixture.changedPaths, {
      [fixture.decisionPath]: {status: 'modified'},
      [fixture.runRecordPath]: {status: 'added'},
      [fixture.payloadPath]: {status: 'added'},
    });
    await assert.rejects(
      validatePullRequest(
        validationOptions(
          tempRoot,
          rewriteBaseSha,
          fixture.headSha,
          file,
          'governance_maintenance',
        ),
        {readCommitPullRequestAssociation: async () => bootstrapLanding},
      ),
      /recovery decision artifact must be absent from the trusted base/,
    );
    assert.notEqual(rewriteBaseSha, bootstrapSha);
  });
});

test('PR-B foundation activation accepts independently evolved vnext versions and the exact eight-path transition', async (t) => {
  const {tempRoot, bootstrapSha, bootstrapLanding} =
    makeBootstrapInstalledRepository(t);
  for (const [relativePath, version] of [
    ['spec/authority-map.json', 'vnext-80'],
    ['spec/agent-harness.json', 'vnext-91'],
    ['spec/doc-manifest.json', 'vnext-37'],
  ]) {
    const value = JSON.parse(
      fs.readFileSync(path.join(tempRoot, relativePath), 'utf8'),
    );
    value.version = version;
    writeJson(tempRoot, relativePath, value);
  }
  const baseSha = commitPaths(
    tempRoot,
    'independently evolve unrelated anchor document versions',
    ['spec/authority-map.json', 'spec/agent-harness.json', 'spec/doc-manifest.json'],
  );
  const activation = addFoundationActivationHead(tempRoot, baseSha);
  runGit(tempRoot, ['checkout', '--detach', baseSha]);
  const file = githubFiles(t, tempRoot, activation.changedPaths, {
    [activation.runRecordPath]: {status: 'added'},
    [activation.activationPath]: {status: 'added'},
    [activation.policyPath]: {status: 'added'},
    [activation.schemaPath]: {status: 'added'},
  });
  const result = await validatePullRequest(
    validationOptions(
      tempRoot,
      baseSha,
      activation.headSha,
      file,
      'governance_foundation',
    ),
    {readCommitPullRequestAssociation: async () => bootstrapLanding},
  );
  assert.equal(result.status, 'passed');
  assert.equal(result.governance_base_state, 'inactive_bootstrap_installed');
  assert.deepEqual(
    [
      JSON.parse(runGit(tempRoot, ['show', `${activation.headSha}:spec/authority-map.json`])).version,
      JSON.parse(runGit(tempRoot, ['show', `${activation.headSha}:spec/agent-harness.json`])).version,
      JSON.parse(runGit(tempRoot, ['show', `${activation.headSha}:spec/doc-manifest.json`])).version,
    ],
    ['vnext-81', 'vnext-92', 'vnext-38'],
  );
  assert.notEqual(bootstrapSha, baseSha);
});

test('complete-history scanner rejects outside-directory rename and hard-copy recovery artifacts', async (t) => {
  const cases = [
    {
      label: 'outside to canonical decision rename',
      canonicalPath:
        'docs/design/decisions/mobile-ux-batch1-governance-maintenance-v1/pr-1200-history-rename.json',
      operation: 'rename-in',
    },
    {
      label: 'unchanged outside source copied to canonical run record',
      canonicalPath:
        'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-maintenance-pr-1201-history-copy.md',
      operation: 'copy-in',
    },
    {
      label: 'canonical run record renamed outside',
      canonicalPath:
        'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-maintenance-pr-1202-history-rename-out.md',
      operation: 'rename-out',
    },
  ];
  for (const fixtureCase of cases) {
    await t.test(fixtureCase.label, async (t) => {
      const {tempRoot, bootstrapSha} = makeBootstrapInstalledRepository(t);
      const outsidePath = `outside-${fixtureCase.operation}.txt`;
      writeText(tempRoot, outsidePath, `unique ${fixtureCase.label}\n`);
      const sourceSha = commitPaths(
        tempRoot,
        `add outside source for ${fixtureCase.label}`,
        [outsidePath],
      );
      if (fixtureCase.operation === 'rename-in') {
        const target = path.join(tempRoot, fixtureCase.canonicalPath);
        fs.mkdirSync(path.dirname(target), {recursive: true});
        fs.renameSync(path.join(tempRoot, outsidePath), target);
        commitPaths(
          tempRoot,
          `rename outside source into ${fixtureCase.canonicalPath}`,
          [outsidePath, fixtureCase.canonicalPath],
        );
      } else if (fixtureCase.operation === 'copy-in') {
        const target = path.join(tempRoot, fixtureCase.canonicalPath);
        fs.mkdirSync(path.dirname(target), {recursive: true});
        fs.copyFileSync(path.join(tempRoot, outsidePath), target);
        commitPaths(
          tempRoot,
          `copy unchanged outside source into ${fixtureCase.canonicalPath}`,
          [fixtureCase.canonicalPath],
        );
      } else {
        const target = path.join(tempRoot, fixtureCase.canonicalPath);
        fs.mkdirSync(path.dirname(target), {recursive: true});
        fs.writeFileSync(target, 'canonical run record added directly\n');
        commitPaths(
          tempRoot,
          `add canonical recovery run record for rename-out probe`,
          [fixtureCase.canonicalPath],
        );
        const renamedOut = path.join(tempRoot, 'renamed-outside-again.txt');
        fs.renameSync(target, renamedOut);
        commitPaths(
          tempRoot,
          'rename canonical recovery run record outside',
          [fixtureCase.canonicalPath, 'renamed-outside-again.txt'],
        );
      }
      const tamperedBaseSha = runGit(tempRoot, ['rev-parse', 'HEAD']);
      writeText(
        tempRoot,
        'docs/release/mobile-ux-batch1-history-scan-probe.json',
        '{"gate_effect":"none"}\n',
      );
      const probePath = 'docs/release/mobile-ux-batch1-history-scan-probe.json';
      const headSha = commitPaths(tempRoot, 'history scan probe', [probePath]);
      runGit(tempRoot, ['checkout', '--detach', tamperedBaseSha]);
      const file = githubFiles(t, tempRoot, [probePath], {
        [probePath]: {status: 'added'},
      });
      await assert.rejects(
        validatePullRequest(
          validationOptions(
            tempRoot,
            tamperedBaseSha,
            headSha,
            file,
            'generic_sensitive',
            1203,
          ),
        ),
        /historical governance recovery decisions and run records are immutable add-only artifacts/,
      );
      assert.notEqual(sourceSha, bootstrapSha);
    });
  }
});

test('production lineage survives revoked unrelated evolution and reboots to a verified dynamic active state', async (t) => {
  const {tempRoot, bootstrapSha, bootstrapLanding} =
    makeBootstrapInstalledRepository(t);
  const activationBaseSha = bootstrapSha;
  const activation = addFoundationActivationHead(tempRoot, activationBaseSha);
  const associationByCommit = new Map([
    [bootstrapSha, bootstrapLanding],
    [
      activation.headSha,
      landingForCommit(tempRoot, activationBaseSha, activation.headSha, 999),
    ],
  ]);
  const readers = {
    readCommitPullRequestAssociation: async ({mergeCommitSha}) => {
      const landing = associationByCommit.get(mergeCommitSha);
      assert.ok(landing, `missing fixture landing ${mergeCommitSha}`);
      return landing;
    },
  };
  const policyRawSha256 = sha256Hex(
    fs.readFileSync(path.join(tempRoot, ARTIFACT_PATHS.governancePolicy)),
  );
  const fixedAgentsLines = fs
    .readFileSync(path.join(tempRoot, 'AGENTS.md'), 'utf8')
    .split(/\r?\n/);
  assert.equal(
    fixedAgentsLines.filter((line) => line === AGENTS_GOVERNANCE_HEADING).length,
    0,
  );
  for (const line of activeAgentsLines(ARTIFACT_PATHS.governancePolicy)) {
    assert.equal(fixedAgentsLines.filter((candidate) => candidate === line).length, 1);
  }

  const revocation = addRecoveryTransitionHead(
    tempRoot,
    activation.headSha,
    {
      decisionClass: 'governance_revocation',
      pullRequest: 1000,
      slug: 'planned-stop',
      activationRecordPath: activation.activationPath,
      revokedPolicyRawSha256: policyRawSha256,
    },
  );
  runGit(tempRoot, ['checkout', '--detach', activation.headSha]);
  const revocationFiles = githubFiles(t, tempRoot, revocation.changedPaths, {
    [revocation.decisionPath]: {status: 'added'},
    [revocation.runRecordPath]: {status: 'added'},
  });
  const revokedResult = await validatePullRequest(
    validationOptions(
      tempRoot,
      activation.headSha,
      revocation.headSha,
      revocationFiles,
      'governance_revocation',
      1000,
    ),
    readers,
  );
  assert.equal(revokedResult.target_state, 'revoked');
  const revocationLanding = landingForCommit(
    tempRoot,
    activation.headSha,
    revocation.headSha,
    1000,
  );
  associationByCommit.set(revocation.headSha, revocationLanding);
  const revocationContext = {
    decision_path: revocation.decisionPath,
    raw_sha256: recoverySnapshotAt(
      tempRoot,
      revocation.headSha,
      revocation.decisionPath,
    ).raw_sha256,
    materialization_pull_request: 1000,
    materialization_head_sha: revocation.headSha,
    materialization_head_tree_sha: revocationLanding.complete_tree_sha,
    merge_commit_sha: revocation.headSha,
    merge_tree_sha: revocationLanding.complete_tree_sha,
  };

  runGit(tempRoot, ['checkout', '--detach', revocation.headSha]);
  const unrelatedChanges = {
    'spec/authority-map.json'(value) {
      value.version = `vnext-${Number(value.version.slice(6)) + 1}`;
      value.domains.unrelated_after_revocation = {
        owner: 'spec/unrelated-after-revocation.json',
      };
    },
    'spec/agent-harness.json'(value) {
      value.version = `vnext-${Number(value.version.slice(6)) + 1}`;
      value.read_paths.unrelated_after_revocation = [
        'spec/unrelated-after-revocation.json',
      ];
      value.governance.unrelated_after_revocation = {
        owner: 'spec/unrelated-after-revocation.json',
      };
      value.compaction_keep.push('unrelated_after_revocation');
    },
    'spec/doc-manifest.json'(value) {
      value.version = `vnext-${Number(value.version.slice(6)) + 1}`;
      value.active_specs.push('spec/unrelated-after-revocation.json');
    },
  };
  for (const [relativePath, mutate] of Object.entries(unrelatedChanges)) {
    const value = JSON.parse(
      fs.readFileSync(path.join(tempRoot, relativePath), 'utf8'),
    );
    mutate(value);
    writeJson(tempRoot, relativePath, value);
  }
  fs.appendFileSync(
    path.join(tempRoot, 'AGENTS.md'),
    '\n- unrelated instruction after revocation\n',
  );
  const unrelatedPaths = [
    'AGENTS.md',
    'spec/agent-harness.json',
    'spec/authority-map.json',
    'spec/doc-manifest.json',
  ];
  const evolvedRevokedSha = commitPaths(
    tempRoot,
    'evolve unrelated anchor content while revoked',
    unrelatedPaths,
  );
  runGit(tempRoot, ['checkout', '--detach', revocation.headSha]);
  const unrelatedFiles = githubFiles(t, tempRoot, unrelatedPaths);
  const unrelatedResult = await validatePullRequest(
    validationOptions(
      tempRoot,
      revocation.headSha,
      evolvedRevokedSha,
      unrelatedFiles,
      'generic_sensitive',
      1001,
    ),
    readers,
  );
  assert.equal(unrelatedResult.governance_base_state, 'revoked');

  runGit(tempRoot, ['checkout', '--detach', evolvedRevokedSha]);
  const rebootstrap = addRecoveryTransitionHead(
    tempRoot,
    evolvedRevokedSha,
    {
      decisionClass: 'governance_rebootstrap',
      pullRequest: 1002,
      slug: 'restore-same-policy',
      activationRecordPath: revocation.decisionPath,
      revocationContext,
      revokedPolicyRawSha256: policyRawSha256,
    },
  );
  runGit(tempRoot, ['checkout', '--detach', evolvedRevokedSha]);
  const rebootstrapFiles = githubFiles(t, tempRoot, rebootstrap.changedPaths, {
    [rebootstrap.decisionPath]: {status: 'added'},
    [rebootstrap.runRecordPath]: {status: 'added'},
  });
  const rebootstrapResult = await validatePullRequest(
    validationOptions(
      tempRoot,
      evolvedRevokedSha,
      rebootstrap.headSha,
      rebootstrapFiles,
      'governance_rebootstrap',
      1002,
    ),
    readers,
  );
  assert.equal(rebootstrapResult.target_state, 'active');
  associationByCommit.set(
    rebootstrap.headSha,
    landingForCommit(tempRoot, evolvedRevokedSha, rebootstrap.headSha, 1002),
  );

  runGit(tempRoot, ['checkout', '--detach', rebootstrap.headSha]);
  writeText(
    tempRoot,
    'docs/release/mobile-ux-batch1-dynamic-active-probe.json',
    '{"gate_effect":"none"}\n',
  );
  const dynamicProbePath =
    'docs/release/mobile-ux-batch1-dynamic-active-probe.json';
  const dynamicProbeSha = commitPaths(
    tempRoot,
    'verify dynamic active lineage',
    [dynamicProbePath],
  );
  runGit(tempRoot, ['checkout', '--detach', rebootstrap.headSha]);
  const dynamicProbeFiles = githubFiles(t, tempRoot, [dynamicProbePath], {
    [dynamicProbePath]: {status: 'added'},
  });
  const dynamicResult = await validatePullRequest(
    validationOptions(
      tempRoot,
      rebootstrap.headSha,
      dynamicProbeSha,
      dynamicProbeFiles,
      'generic_sensitive',
      1003,
    ),
    readers,
  );
  assert.equal(dynamicResult.governance_base_state, 'active');

  async function rejectGenericActivationRecordRewrite({
    baseSha,
    activationRecordPath,
    headingMode,
    pullRequest,
    slug,
  }) {
    runGit(tempRoot, ['checkout', '--detach', baseSha]);
    const authorityPath = 'spec/authority-map.json';
    const authority = JSON.parse(
      fs.readFileSync(path.join(tempRoot, authorityPath), 'utf8'),
    );
    authority.domains.mobile_ux_batch1_governance =
      buildActiveGovernanceDomain(
        ARTIFACT_PATHS.governancePolicy,
        activationRecordPath,
      );
    writeJson(tempRoot, authorityPath, authority);
    const harnessPath = 'spec/agent-harness.json';
    const harness = JSON.parse(
      fs.readFileSync(path.join(tempRoot, harnessPath), 'utf8'),
    );
    harness.governance.mobile_ux_batch1_governance_policy =
      buildActiveHarnessPolicy(
        ARTIFACT_PATHS.governancePolicy,
        activationRecordPath,
      );
    writeJson(tempRoot, harnessPath, harness);
    const agentsPath = 'AGENTS.md';
    const agentsLines = fs
      .readFileSync(path.join(tempRoot, agentsPath), 'utf8')
      .split(/\r?\n/)
      .filter((line) => line !== AGENTS_GOVERNANCE_HEADING);
    if (headingMode === 'dynamic') {
      agentsLines.push(AGENTS_GOVERNANCE_HEADING);
    }
    writeText(tempRoot, agentsPath, agentsLines.join('\n'));
    const changedPaths = [authorityPath, harnessPath, agentsPath].sort();
    const headSha = commitPaths(
      tempRoot,
      `forge ${slug} activation projection`,
      changedPaths,
    );
    runGit(tempRoot, ['checkout', '--detach', baseSha]);
    const file = githubFiles(t, tempRoot, changedPaths);
    await assert.rejects(
      validatePullRequest(
        validationOptions(
          tempRoot,
          baseSha,
          headSha,
          file,
          'generic_sensitive',
          pullRequest,
        ),
        readers,
      ),
      /non-recovery pull request changed the Batch 1-owned active anchor projection/,
    );
    return headSha;
  }

  const forgedDynamicA =
    'docs/design/decisions/mobile-ux-batch1-governance-rebootstrap-v1/pr-1900-forged-a.json';
  await rejectGenericActivationRecordRewrite({
    baseSha: activation.headSha,
    activationRecordPath: forgedDynamicA,
    headingMode: 'dynamic',
    pullRequest: 1900,
    slug: 'fixed-to-dynamic-a',
  });
  const forgedFixedSha = await rejectGenericActivationRecordRewrite({
    baseSha: rebootstrap.headSha,
    activationRecordPath: activation.activationPath,
    headingMode: 'fixed',
    pullRequest: 1901,
    slug: 'dynamic-to-fixed',
  });
  await rejectGenericActivationRecordRewrite({
    baseSha: rebootstrap.headSha,
    activationRecordPath:
      'docs/design/decisions/mobile-ux-batch1-governance-rebootstrap-v1/pr-1902-forged-b.json',
    headingMode: 'dynamic',
    pullRequest: 1902,
    slug: 'dynamic-a-to-dynamic-b',
  });

  runGit(tempRoot, ['checkout', '--detach', forgedFixedSha]);
  const forgedHistoryProbePath =
    'docs/release/mobile-ux-batch1-forged-fixed-history-probe.json';
  writeText(tempRoot, forgedHistoryProbePath, '{"gate_effect":"none"}\n');
  const forgedHistoryProbeSha = commitPaths(
    tempRoot,
    'probe forged fixed state after later lineage events',
    [forgedHistoryProbePath],
  );
  runGit(tempRoot, ['checkout', '--detach', forgedFixedSha]);
  const forgedHistoryFiles = githubFiles(t, tempRoot, [forgedHistoryProbePath], {
    [forgedHistoryProbePath]: {status: 'added'},
  });
  await assert.rejects(
    validatePullRequest(
      validationOptions(
        tempRoot,
        forgedFixedSha,
        forgedHistoryProbeSha,
        forgedHistoryFiles,
        'generic_sensitive',
        1903,
      ),
      readers,
    ),
    /fixed foundation active state requires one exact verified foundation lineage event/,
  );
});

test('inactive governance rejects every partial activation surface on a generic-sensitive head', async (t) => {
  const cases = [
    {
      label: 'partial or forged authority owner',
      relativePath: 'spec/authority-map.json',
      mutate(tempRoot) {
        const value = JSON.parse(fs.readFileSync(path.join(tempRoot, this.relativePath), 'utf8'));
        value.domains.mobile_ux_batch1_governance = {owner: 'spec/forged-owner.json'};
        writeJson(tempRoot, this.relativePath, value);
      },
      pattern: /inactive Batch 1 authority-map/,
    },
    {
      label: 'partial harness mirror',
      relativePath: 'spec/agent-harness.json',
      mutate(tempRoot) {
        const value = JSON.parse(fs.readFileSync(path.join(tempRoot, this.relativePath), 'utf8'));
        value.read_paths.mobile_ux_batch1_governance = ['spec/authority-map.json'];
        writeJson(tempRoot, this.relativePath, value);
      },
      pattern: /inactive Batch 1 agent-harness/,
    },
    {
      label: 'partial doc-manifest activation',
      relativePath: 'spec/doc-manifest.json',
      mutate(tempRoot) {
        const value = JSON.parse(fs.readFileSync(path.join(tempRoot, this.relativePath), 'utf8'));
        value.active_specs.push(ARTIFACT_PATHS.governancePolicy);
        writeJson(tempRoot, this.relativePath, value);
      },
      pattern: /inactive Batch 1 doc-manifest/,
    },
    {
      label: 'partial AGENTS activation line',
      relativePath: 'AGENTS.md',
      mutate(tempRoot) {
        fs.appendFileSync(
          path.join(tempRoot, this.relativePath),
          '\n- Mobile UX Batch 1 治理 / 受保护决策：`authority-map -> mobile-ux-batch1-governance -> agent-harness -> repo-delivery-contract -> harness-architecture -> evals`\n',
        );
      },
      pattern: /inactive Batch 1 AGENTS\.md/,
    },
  ];

  for (const fixtureCase of cases) {
    await t.test(fixtureCase.label, async (t) => {
      const {tempRoot, baseSha} = makeRepository(t);
      fixtureCase.mutate(tempRoot);
      const headSha = commitPaths(
        tempRoot,
        `forge ${fixtureCase.label}`,
        [fixtureCase.relativePath],
      );
      runGit(tempRoot, ['checkout', '--detach', baseSha]);
      const file = githubFiles(t, tempRoot, [fixtureCase.relativePath]);
      await assert.rejects(
        validatePullRequest(
          validationOptions(tempRoot, baseSha, headSha, file, 'generic_sensitive'),
        ),
        fixtureCase.pattern,
      );
    });
  }
});

test('decision class mismatch and incomplete GitHub file enumeration fail closed', async (t) => {
  const {tempRoot, baseSha} = makeRepository(t);
  const headSha = commitBootstrapProbe(tempRoot);
  runGit(tempRoot, ['checkout', '--detach', baseSha]);
  const complete = githubFiles(t, tempRoot, BOOTSTRAP_PROBE_FILES);
  await assert.rejects(
    validatePullRequest(
      validationOptions(tempRoot, baseSha, headSha, complete, 'governance_foundation'),
    ),
    /decision class mismatch/,
  );

  const incomplete = githubFiles(t, tempRoot, BOOTSTRAP_PROBE_FILES.slice(0, 1));
  await assert.rejects(
    validatePullRequest(
      validationOptions(tempRoot, baseSha, headSha, incomplete, 'generic_sensitive'),
    ),
    /changed paths mismatch/,
  );
});

test('worktree validator bytes must equal the exact trusted base blobs', async (t) => {
  for (const relativePath of TRUSTED_CODE_CLOSURE) {
    await t.test(relativePath, async (t) => {
      const {tempRoot, baseSha} = makeRepository(t);
      const headSha = commitBootstrapProbe(tempRoot);
      runGit(tempRoot, ['checkout', '--detach', baseSha]);
      const file = githubFiles(t, tempRoot, BOOTSTRAP_PROBE_FILES);
      fs.appendFileSync(
        path.join(tempRoot, relativePath),
        '\n// untrusted worktree mutation\n',
      );
      await assert.rejects(
        validatePullRequest(
          validationOptions(tempRoot, baseSha, headSha, file, 'generic_sensitive'),
        ),
        new RegExp(`trusted code worktree bytes differ from base blob: ${relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      );
    });
  }
});

test('foundation and specialized stages reject reuse or rewrite of an existing agent run record', async (t) => {
  const specializedCases = [
    {
      label: 'D1 intent',
      decisionClass: 'cohort_designation_intent',
      runRecord: 'docs/agent-runs/2026-08-10-mobile-ux-batch1-d1-rewrite-probe.md',
      requiredPaths: [
        ARTIFACT_PATHS.cohortDesignationIntent,
        ARTIFACT_PATHS.cohortNonPiiAttestation,
      ],
    },
    {
      label: 'B2 subject',
      decisionClass: 'batch1_subject_change',
      runRecord: 'docs/agent-runs/2026-08-10-mobile-ux-batch1-b2-rewrite-probe.md',
      requiredPaths: [BATCH1_SUBJECT_PATHS[0]],
    },
    {
      label: 'F3 intent',
      decisionClass: 'manifest_freeze_intent',
      runRecord: 'docs/agent-runs/2026-08-10-mobile-ux-batch1-f3-rewrite-probe.md',
      requiredPaths: [ARTIFACT_PATHS.manifestFreezeIntent],
    },
    {
      label: 'receipt materialization',
      decisionClass: 'receipt_materialization',
      runRecord: 'docs/agent-runs/2026-08-10-mobile-ux-batch1-receipt-rewrite-probe.md',
      requiredPaths: [ARTIFACT_PATHS.manifestFreezeReceipt],
    },
  ];
  for (const fixtureCase of specializedCases) {
    await t.test(fixtureCase.label, async (t) => {
      const {tempRoot} = makeRepository(t);
      writeText(tempRoot, fixtureCase.runRecord, '# prior run record\n');
      const baseSha = commitPaths(tempRoot, 'add prior run record', [fixtureCase.runRecord]);
      for (const relativePath of fixtureCase.requiredPaths) {
        writeText(tempRoot, relativePath, '{"untrusted":"subject fixture"}\n');
      }
      writeText(tempRoot, fixtureCase.runRecord, '# rewritten prior run record\n');
      const headSha = commitPaths(
        tempRoot,
        `rewrite run record for ${fixtureCase.label}`,
        [...fixtureCase.requiredPaths, fixtureCase.runRecord],
      );
      runGit(tempRoot, ['checkout', '--detach', baseSha]);
      const changedPaths = [...fixtureCase.requiredPaths, fixtureCase.runRecord];
      const file = githubFiles(t, tempRoot, changedPaths, {
        [fixtureCase.runRecord]: {status: 'modified'},
      });
      await assert.rejects(
        validatePullRequest(
          validationOptions(
            tempRoot,
            baseSha,
            headSha,
            file,
            fixtureCase.decisionClass,
          ),
        ),
        /agent run record must be absent from the trusted base/,
      );
    });
  }

  await t.test('foundation fixed run record', async (t) => {
    const {tempRoot} = makeRepository(t);
    const runRecord =
      'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-foundation-v1.md';
    writeText(tempRoot, runRecord, '# prior foundation run record\n');
    const baseSha = commitPaths(tempRoot, 'add prior foundation run record', [runRecord]);
    for (const relativePath of INACTIVE_GOVERNANCE_ANCHOR_FILES) {
      fs.appendFileSync(path.join(tempRoot, relativePath), '\nfoundation activation probe\n');
    }
    writeText(
      tempRoot,
      'docs/design/decisions/mobile-ux-batch1-governance-foundation-v1.md',
      '# foundation decision probe\n',
    );
    writeText(tempRoot, ARTIFACT_PATHS.governancePolicy, '{}\n');
    writeText(tempRoot, 'spec/mobile-ux-batch1-resolved-requirement.schema.json', '{}\n');
    writeText(tempRoot, runRecord, '# rewritten foundation run record\n');
    const foundationPaths = [
      'AGENTS.md',
      runRecord,
      'docs/design/decisions/mobile-ux-batch1-governance-foundation-v1.md',
      'spec/agent-harness.json',
      'spec/authority-map.json',
      'spec/doc-manifest.json',
      ARTIFACT_PATHS.governancePolicy,
      'spec/mobile-ux-batch1-resolved-requirement.schema.json',
    ];
    const headSha = commitPaths(tempRoot, 'rewrite foundation run record', foundationPaths);
    runGit(tempRoot, ['checkout', '--detach', baseSha]);
    const file = githubFiles(t, tempRoot, foundationPaths, {
      [runRecord]: {status: 'modified'},
    });
    await assert.rejects(
      validatePullRequest(
        validationOptions(
          tempRoot,
          baseSha,
          headSha,
          file,
          'governance_foundation',
        ),
      ),
      /agent run record must be absent from the trusted base/,
    );
  });
});

test('specialized run record requires an exact Git add and a tracked 100644 blob', async (t) => {
  const runRecord = 'docs/agent-runs/2026-08-10-mobile-ux-batch1-d1-add-probe.md';
  const requiredPaths = [
    ARTIFACT_PATHS.cohortDesignationIntent,
    ARTIFACT_PATHS.cohortNonPiiAttestation,
  ];
  await t.test('symlink mode', async (t) => {
    const {tempRoot, baseSha} = makeRepository(t);
    for (const relativePath of requiredPaths) writeText(tempRoot, relativePath, '{}\n');
    const target = path.join(tempRoot, runRecord);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.symlinkSync('../../../README.md', target);
    const headSha = commitPaths(tempRoot, 'add symlink D1 run record', [...requiredPaths, runRecord]);
    runGit(tempRoot, ['checkout', '--detach', baseSha]);
    const file = githubFiles(t, tempRoot, [...requiredPaths, runRecord]);
    await assert.rejects(
      validatePullRequest(
        validationOptions(
          tempRoot,
          baseSha,
          headSha,
          file,
          'cohort_designation_intent',
        ),
      ),
      /must be one exact tracked 100644 non-symlink blob/,
    );
  });
});

test('a proposed workflow head is parsed as data and rejects an injected unnamed run step', async (t) => {
  const {tempRoot, baseSha} = makeRepository(t);
  const workflowPath = TRUSTED_IDENTITY.workflowPath;
  const workflow = fs.readFileSync(path.join(tempRoot, workflowPath), 'utf8');
  const boundary = workflow.indexOf('\n  result:');
  assert.notEqual(boundary, -1);
  fs.writeFileSync(
    path.join(tempRoot, workflowPath),
    `${workflow.slice(0, boundary)}\n      - run: echo "untrusted injected step"${workflow.slice(boundary)}`,
  );
  const headSha = commitPaths(tempRoot, 'inject unnamed workflow step', [workflowPath]);
  runGit(tempRoot, ['checkout', '--detach', baseSha]);
  const file = githubFiles(t, tempRoot, [workflowPath], {
    [workflowPath]: {status: 'modified'},
  });
  await assert.rejects(
    validatePullRequest(
      validationOptions(tempRoot, baseSha, headSha, file, 'generic_sensitive'),
    ),
    /product_owner step count drift/,
  );
});

test('a proposed pull-request gate workflow cannot preserve job names while making a required check a no-op', async (t) => {
  const {tempRoot, baseSha} = makeRepository(t);
  const workflowPath = '.github/workflows/pr-gates.yml';
  const workflow = fs.readFileSync(path.join(tempRoot, workflowPath), 'utf8');
  const noOp = workflow.replace(
    'run: npm run lint -- --quiet',
    'run: echo "skip lint"',
  );
  assert.notEqual(noOp, workflow);
  fs.writeFileSync(path.join(tempRoot, workflowPath), noOp);
  const headSha = commitPaths(tempRoot, 'make required pull-request gate a no-op', [workflowPath]);
  runGit(tempRoot, ['checkout', '--detach', baseSha]);
  const file = githubFiles(t, tempRoot, [workflowPath], {
    [workflowPath]: {status: 'modified'},
  });
  await assert.rejects(
    validatePullRequest(
      validationOptions(tempRoot, baseSha, headSha, file, 'generic_sensitive'),
    ),
    /pull-request gate workflow security-critical values must match the exact closed byte contract/,
  );
});

test('CLI interface matches the protected workflow contract', (t) => {
  const {tempRoot, baseSha} = makeRepository(t);
  const headSha = commitBootstrapProbe(tempRoot);
  runGit(tempRoot, ['checkout', '--detach', baseSha]);
  const file = githubFiles(t, tempRoot, BOOTSTRAP_PROBE_FILES);
  const result = spawnSync(
    process.execPath,
    [
      fs.realpathSync(path.join(tempRoot, 'scripts', 'validate_mobile_ux_batch1_governance.mjs')),
      'validate-pr',
      '--root', tempRoot,
      '--repository', 'LENKIN233/softbook_cet',
      '--repository-id', '1216764160',
      '--origin', 'https://github.com/LENKIN233/softbook_cet.git',
      '--pull-request', '999',
      '--base-ref', 'refs/heads/main',
      '--base-sha', baseSha,
      '--head-sha', headSha,
      '--decision-class', 'generic_sensitive',
      '--github-files', file,
      '--expected-count', String(BOOTSTRAP_PROBE_FILES.length),
    ],
    {cwd: tempRoot, encoding: 'utf8'},
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'passed');
});

test('current-run approval CLI parser and trusted reader injection bind the exact workflow run', async (t) => {
  const {tempRoot, baseSha} = makeRepository(t);
  const headSha = commitBootstrapProbe(tempRoot);
  runGit(tempRoot, ['checkout', '--detach', baseSha]);
  const parsed = parseCommandArgs([
    'verify-current-run-approval',
    '--root', tempRoot,
    '--repository', TRUSTED_IDENTITY.repository,
    '--repository-id', String(TRUSTED_IDENTITY.repositoryId),
    '--origin', 'https://github.com/LENKIN233/softbook_cet.git',
    '--pull-request', '999',
    '--base-ref', TRUSTED_IDENTITY.protectedBaseRef,
    '--base-sha', baseSha,
    '--head-sha', headSha,
    '--workflow-run-id', '31339999999',
    '--workflow-run-attempt', '1',
    '--decision-class', 'generic_sensitive',
  ]);
  assert.equal(parsed.command, 'verify-current-run-approval');
  assert.equal(parsed.options.workflowRunId, '31339999999');
  assert.equal(parsed.options.workflowRunAttempt, '1');
  assert.equal(parsed.options.decisionClass, 'generic_sensitive');

  let readerCalls = 0;
  const result = await verifyCurrentRunApproval(parsed.options, {
    readCurrentRunApproval: async (input) => {
      readerCalls += 1;
      assert.deepEqual(input, {
        repository: TRUSTED_IDENTITY.repository,
        pullRequestNumber: 999,
        pullRequestBaseSha: baseSha,
        approvalTargetHeadSha: headSha,
        workflowRunId: 31339999999,
        workflowRunAttempt: 1,
        decisionClass: 'generic_sensitive',
        origin: 'https://github.com/LENKIN233/softbook_cet.git',
      });
      return {
        schema_version: 'mobile-ux-batch1-current-run-approval-verification.v1',
        repository: TRUSTED_IDENTITY.repository,
        repository_id: TRUSTED_IDENTITY.repositoryId,
        pull_request: 999,
        pull_request_base_ref: TRUSTED_IDENTITY.protectedBaseRef,
        pull_request_base_sha: baseSha,
        approval_target_head_sha: headSha,
        workflow_path: TRUSTED_IDENTITY.workflowPath,
        workflow_id: TRUSTED_IDENTITY.workflowId,
        workflow_run_id: 31339999999,
        run_attempt: 1,
        decision_class: 'generic_sensitive',
        environment_id: TRUSTED_IDENTITY.environmentId,
        environment_name: TRUSTED_IDENTITY.environmentName,
        reviewer_immutable_id: TRUSTED_IDENTITY.reviewerImmutableId,
        approval_review_sha256: 'a'.repeat(64),
        provider_observed_at: '2026-08-10T01:02:03Z',
      };
    },
  });
  assert.equal(readerCalls, 1);
  assert.equal(result.status, 'passed');
  assert.equal(result.trusted_code_artifact_records.length, TRUSTED_CODE_CLOSURE.length);
  assert.match(result.non_claim, /no product, visual, implementation/);

  let unsupportedClassReaderCalls = 0;
  await assert.rejects(
    verifyCurrentRunApproval(
      {...parsed.options, decisionClass: 'schema_definition'},
      {
        readCurrentRunApproval: async () => {
          unsupportedClassReaderCalls += 1;
          return {};
        },
      },
    ),
    /decision class is unsupported/,
  );
  assert.equal(unsupportedClassReaderCalls, 0);

  let retriedReaderCalls = 0;
  await assert.rejects(
    verifyCurrentRunApproval(
      {...parsed.options, workflowRunAttempt: '2'},
      {
        readCurrentRunApproval: async () => {
          retriedReaderCalls += 1;
          return {};
        },
      },
    ),
    /supports only workflow run attempt 1/,
  );
  assert.equal(retriedReaderCalls, 0);
});

test('current-run approval verifier fails closed before or after a malformed reader projection', async (t) => {
  const {tempRoot, baseSha} = makeRepository(t);
  const headSha = commitBootstrapProbe(tempRoot);
  runGit(tempRoot, ['checkout', '--detach', baseSha]);
  const options = {
    root: tempRoot,
    repository: TRUSTED_IDENTITY.repository,
    repositoryId: String(TRUSTED_IDENTITY.repositoryId),
    origin: 'https://github.com/LENKIN233/softbook_cet.git',
    pullRequest: '999',
    baseRef: TRUSTED_IDENTITY.protectedBaseRef,
    baseSha,
    headSha,
    workflowRunId: '31339999999',
    workflowRunAttempt: '1',
    decisionClass: 'generic_sensitive',
  };
  await assert.rejects(
    verifyCurrentRunApproval(options, {unexpected: async () => ({})}),
    /unknown current-run approval reader dependency/,
  );
  await assert.rejects(
    verifyCurrentRunApproval(options, {
      readCurrentRunApproval: async () => ({
        schema_version: 'mobile-ux-batch1-current-run-approval-verification.v1',
        repository: TRUSTED_IDENTITY.repository,
        repository_id: TRUSTED_IDENTITY.repositoryId,
        pull_request: 999,
        pull_request_base_ref: TRUSTED_IDENTITY.protectedBaseRef,
        pull_request_base_sha: baseSha,
        approval_target_head_sha: headSha,
        workflow_path: TRUSTED_IDENTITY.workflowPath,
        workflow_id: TRUSTED_IDENTITY.workflowId,
        workflow_run_id: 31339999999,
        run_attempt: 1,
        decision_class: 'generic_sensitive',
        environment_id: TRUSTED_IDENTITY.environmentId,
        environment_name: TRUSTED_IDENTITY.environmentName,
        reviewer_immutable_id: TRUSTED_IDENTITY.reviewerImmutableId,
        approval_review_sha256: 'b'.repeat(64),
        provider_observed_at: '2026-99-99T99:99:99Z',
      }),
    }),
    /projection is incomplete or mismatched/,
  );
});

test('current-run approval CLI parser rejects cross-command and incomplete options', () => {
  assert.throws(
    () => parseCommandArgs(['unknown-command']),
    /validate-pr or verify-current-run-approval/,
  );
  assert.throws(
    () => parseCommandArgs(['verify-current-run-approval', '--repository', TRUSTED_IDENTITY.repository]),
    /missing required option repositoryId/,
  );
  assert.throws(
    () => parseCommandArgs([
      'validate-pr',
      '--workflow-run-attempt',
      '1',
    ]),
    /unknown argument: --workflow-run-attempt/,
  );
});

test('foundation doc-manifest activation inserts the policy only after the unique authority-map anchor', async (t) => {
  const policyPath = ARTIFACT_PATHS.governancePolicy;
  const base = {
    version: 'vnext-9',
    active_specs: [
      'spec/requirement-memory.json',
      'spec/authority-map.json',
      'spec/agent-harness.json',
    ],
  };
  const correct = {
    version: 'vnext-10',
    active_specs: [
      'spec/requirement-memory.json',
      'spec/authority-map.json',
      policyPath,
      'spec/agent-harness.json',
    ],
  };
  assert.deepEqual(
    validateFoundationDocManifestTransition(base, correct),
    correct,
  );
  const independentlyEvolvedBase = {...base, version: 'vnext-37'};
  const independentlyEvolvedHead = {...correct, version: 'vnext-38'};
  assert.deepEqual(
    validateFoundationDocManifestTransition(
      independentlyEvolvedBase,
      independentlyEvolvedHead,
    ),
    independentlyEvolvedHead,
  );

  await t.test('append is rejected', () => {
    const appended = {
      version: 'vnext-10',
      active_specs: [...base.active_specs, policyPath],
    };
    assert.throws(
      () => validateFoundationDocManifestTransition(base, appended),
      /foundation doc-manifest transition drift/,
    );
  });
  await t.test('duplicate policy is rejected', () => {
    const duplicated = structuredClone(correct);
    duplicated.active_specs.splice(3, 0, policyPath);
    assert.throws(
      () => validateFoundationDocManifestTransition(base, duplicated),
      /foundation doc-manifest transition drift/,
    );
  });
  for (const [label, activeSpecs] of [
    ['missing authority-map', ['spec/requirement-memory.json']],
    ['duplicate authority-map', ['spec/authority-map.json', 'spec/authority-map.json']],
  ]) {
    await t.test(label, () => {
      assert.throws(
        () => validateFoundationDocManifestTransition(
          {version: 'vnext-9', active_specs: activeSpecs},
          correct,
        ),
        /requires exactly one spec\/authority-map\.json anchor/,
      );
    });
  }
});

test('self-contained exact-byte fixtures fail closed on encoding, compression, length, and digest drift', async (t) => {
  for (const [relativePath, metadata] of Object.entries(EXACT_BYTE_FIXTURES)) {
    const bytes = exactFixtureBytes(relativePath);
    assert.equal(bytes.length, metadata.byte_length);
    assert.equal(sha256Hex(bytes), metadata.raw_sha256);
  }
  const bytes = Buffer.from('fixture payload\n');
  const encoded = gzipSync(bytes).toString('base64');
  const metadata = {
    byte_length: bytes.length,
    raw_sha256: sha256Hex(bytes),
  };
  assert.deepEqual(decodeExactFixturePayload(encoded, metadata), bytes);
  await t.test('invalid base64', () => {
    assert.throws(
      () => decodeExactFixturePayload('%%%=', metadata),
      /canonical base64/,
    );
  });
  await t.test('invalid gzip', () => {
    assert.throws(
      () => decodeExactFixturePayload(Buffer.from('not gzip').toString('base64'), metadata),
      /gzip payload is invalid/,
    );
  });
  await t.test('oversize decompression', () => {
    const oversized = gzipSync(Buffer.alloc(1024 * 1024 + 1, 0x61)).toString('base64');
    assert.throws(
      () => decodeExactFixturePayload(oversized, {
        byte_length: 1024 * 1024 + 1,
        raw_sha256: sha256Hex(Buffer.alloc(1024 * 1024 + 1, 0x61)),
      }),
      /gzip payload is invalid/,
    );
  });
  await t.test('declared length drift', () => {
    assert.throws(
      () => decodeExactFixturePayload(encoded, {...metadata, byte_length: bytes.length + 1}),
      /byte length drift/,
    );
  });
  await t.test('declared digest drift', () => {
    assert.throws(
      () => decodeExactFixturePayload(encoded, {...metadata, raw_sha256: '0'.repeat(64)}),
      /raw SHA-256 drift/,
    );
  });
});

test('legacy preparation materialization validates the remote historical blob and both live event chains', async (t) => {
  const fixture = buildLegacyPreparationChain(t);
  const result = await validatePreparationFixture(fixture);
  assert.equal(result.stage, 'receipt_materialization');
  assert.equal(result.approval_instance_digest, fixture.preparationReceipt.approval_instance_digest);
});

test('legacy preparation CLI wiring fails closed on truncated remote history or event drift', async (t) => {
  await t.test('remote historical bytes truncated', async (t) => {
    const fixture = buildLegacyPreparationChain(t);
    await assert.rejects(
      validatePreparationFixture(fixture, {
        readGitHubArtifact: async (args) => {
          const artifact = await fixture.readers.readGitHubArtifact(args);
          return {...artifact, bytes: artifact.bytes.subarray(0, artifact.bytes.length - 1)};
        },
      }),
      /remote Git artifact.*drift/,
    );
  });

  await t.test('historical authority event mismatch', async (t) => {
    const fixture = buildLegacyPreparationChain(t);
    await assert.rejects(
      validatePreparationFixture(fixture, {
        readApprovalEvent: async (args) => {
          const event = await fixture.readers.readApprovalEvent(args);
          if (args.pullRequestNumber === HISTORICAL_PREPARATION.pullRequest) {
            event.event.deployment_success_status_id += 1;
          }
          return event;
        },
      }),
      /historical preparation event\.deployment_success_status_id/,
    );
  });
});

test('legacy preparation rejects forged preparation bindings and non-root parents', async (t) => {
  await t.test('forged migration materialization commit', async (t) => {
    const fixture = buildLegacyPreparationChain(t, {
      mutatePreparation: (receipt, {landingCommitSha}) => {
        receipt.migration_receipt_materialization_commit_sha = landingCommitSha;
        receipt.approval_instance_digest = '0'.repeat(64);
        receipt.approval_instance_digest = computeLegacyPreparationReceiptDigest(receipt);
      },
    });
    await assert.rejects(
      validatePreparationFixture(fixture),
      /does not bind the actual migration receipt materialization commit/,
    );
  });

  await t.test('forged non-root parent', async (t) => {
    const fixture = buildLegacyPreparationChain(t, {
      mutatePreparation: (receipt) => {
        receipt.parent_approval_tuple = {};
      },
    });
    await assert.rejects(
      validatePreparationFixture(fixture),
      /root approval and parent tuple must be null/,
    );
  });
});

test('R0 subject wiring validates the exact schema baseline and live preparation chain', async (t) => {
  const fixture = buildR0SubjectChain(t);
  const result = await validateSubjectChange(
    fixture.tempRoot,
    fixture.schemaCommit,
    fixture.r0Commit,
    createEvidenceContext(
      'https://github.com/LENKIN233/softbook_cet.git',
      fixture.readers,
    ),
  );
  assert.equal(result.stage, 'R0');
  assert.equal(result.resolved_requirement_count, 136);
  assert.equal(result.pending_requirement_count, 9);

  const forgedReaders = {
    ...fixture.readers,
    readPullRequestMerge: async (args) => {
      const envelope = await fixture.readers.readPullRequestMerge(args);
      if (args.pullRequestNumber !== fixture.preparationReceipt.receipt_materialization_pull_request) {
        return envelope;
      }
      return {...envelope, pull_request_number: args.pullRequestNumber + 1};
    },
  };
  await assert.rejects(
    validateSubjectChange(
      fixture.tempRoot,
      fixture.schemaCommit,
      fixture.r0Commit,
      createEvidenceContext(
        'https://github.com/LENKIN233/softbook_cet.git',
        forgedReaders,
      ),
    ),
    /receipt materialization merge envelope is malformed or mismatched/,
  );
});

test('D1 intent wiring validates the live preparation parent and rejects subject touch-and-revert', async (t) => {
  const fixture = buildCohortIntentChain(t);
  const context = createEvidenceContext(
    'https://github.com/LENKIN233/softbook_cet.git',
    fixture.readers,
  );
  const result = await validateIntent(
    fixture.tempRoot,
    fixture.subjectCommit,
    fixture.intentApprovedHeadSha,
    'cohort_designation_intent',
    fixture.intentPullRequest,
    context,
  );
  assert.equal(result.stage, 'cohort_designation_intent');
  assert.equal(result.subject_digest, fixture.subjectDigest);

  const reverted = buildCohortIntentChain(t, {touchAndRevertSubject: true});
  await assert.rejects(
    validateIntent(
      reverted.tempRoot,
      reverted.subjectCommit,
      reverted.intentApprovedHeadSha,
      'cohort_designation_intent',
      reverted.intentPullRequest,
      createEvidenceContext(
        'https://github.com/LENKIN233/softbook_cet.git',
        reverted.readers,
      ),
    ),
    /must not touch protected subject paths in any pull-request commit/,
  );
});

test('D1 receipt wiring validates distinct source/materialization PRs and the reconstructed parent tuple', async (t) => {
  const fixture = buildCohortReceiptChain(t);
  const result = await validateReceiptMaterialization(
    fixture.tempRoot,
    fixture.designationLandingCommitSha,
    fixture.designationReceiptCommit,
    [ARTIFACT_PATHS.cohortDesignationReceipt, fixture.designationReceiptRunRecord],
    fixture.designationReceiptPullRequest,
    createEvidenceContext(
      'https://github.com/LENKIN233/softbook_cet.git',
      fixture.readers,
    ),
  );
  assert.equal(result.stage, 'receipt_materialization');
  assert.equal(
    result.approval_instance_digest,
    fixture.designationReceipt.approval_instance_digest,
  );

  await t.test('forged parent materialization PR fails before receipt acceptance', async (t) => {
    const forged = buildCohortReceiptChain(t, {
      mutateReceipt(receipt) {
        receipt.parent_approval_tuple.parent_receipt_materialization_pull_request += 100;
      },
    });
    await assert.rejects(
      validateReceiptMaterialization(
        forged.tempRoot,
        forged.designationLandingCommitSha,
        forged.designationReceiptCommit,
        [ARTIFACT_PATHS.cohortDesignationReceipt, forged.designationReceiptRunRecord],
        forged.designationReceiptPullRequest,
        createEvidenceContext(
          'https://github.com/LENKIN233/softbook_cet.git',
          forged.readers,
        ),
      ),
      /parent approval tuple|parent_receipt_materialization_pull_request|trusted parent projection/,
    );
  });

  await t.test('forged receipt materialization PR cannot impersonate the current PR', async (t) => {
    const forged = buildCohortReceiptChain(t, {
      mutateReceipt(receipt) {
        receipt.receipt_materialization_pull_request += 100;
      },
    });
    await assert.rejects(
      validateReceiptMaterialization(
        forged.tempRoot,
        forged.designationLandingCommitSha,
        forged.designationReceiptCommit,
        [ARTIFACT_PATHS.cohortDesignationReceipt, forged.designationReceiptRunRecord],
        forged.designationReceiptPullRequest,
        createEvidenceContext(
          'https://github.com/LENKIN233/softbook_cet.git',
          forged.readers,
        ),
      ),
      /receipt materialization pull request binding/,
    );
  });
});

test('B2 subject wiring validates the exact D1 receipt binding and nine-value DAG', async (t) => {
  const fixture = buildB2SubjectChain(t);
  const result = await validateSubjectChange(
    fixture.tempRoot,
    fixture.designationReceiptCommit,
    fixture.b2Commit,
    createEvidenceContext(
      'https://github.com/LENKIN233/softbook_cet.git',
      fixture.readers,
    ),
  );
  assert.equal(result.stage, 'B2');
  assert.equal(result.resolved_requirement_count, 145);
  assert.equal(result.pending_requirement_count, 0);
  assert.equal(result.build_verification_scope, 'descriptor_and_tracked_hash_binding_only');
  assert.equal(result.build_recipe_executed, false);
  assert.equal(result.build_output_rebuilt, false);
  assert.equal(result.build_reproducibility_proven, false);
  assert.equal(result.hermetic_replay_proven, false);
  assert.match(result.non_claim, /does not execute the recipe, rebuild the output, or prove reproducibility or hermetic replay/);

  const forgedReaders = {
    ...fixture.readers,
    readPullRequestMerge: async (args) => {
      const envelope = await fixture.readers.readPullRequestMerge(args);
      if (args.pullRequestNumber !== fixture.designationReceiptPullRequest) return envelope;
      return {...envelope, merge_commit_sha: fixture.designationLandingCommitSha};
    },
  };
  await assert.rejects(
    validateSubjectChange(
      fixture.tempRoot,
      fixture.designationReceiptCommit,
      fixture.b2Commit,
      createEvidenceContext(
        'https://github.com/LENKIN233/softbook_cet.git',
        forgedReaders,
      ),
    ),
    /does not resolve to the actual materialization commit/,
  );
});

test('F3 intent wiring validates an exact B2 subject and the live D1 parent', async (t) => {
  const fixture = buildManifestIntentChain(t);
  const result = await validateIntent(
    fixture.tempRoot,
    fixture.b2Commit,
    fixture.manifestIntentApprovedHeadSha,
    'manifest_freeze_intent',
    fixture.manifestIntentPullRequest,
    createEvidenceContext(
      'https://github.com/LENKIN233/softbook_cet.git',
      fixture.readers,
    ),
  );
  assert.equal(result.stage, 'manifest_freeze_intent');
  assert.equal(result.subject_digest, fixture.b2SubjectDigest);

  const forgedReaders = {
    ...fixture.readers,
    readPullRequestMerge: async (args) => {
      const envelope = await fixture.readers.readPullRequestMerge(args);
      if (args.pullRequestNumber !== fixture.designationReceiptPullRequest) return envelope;
      return {...envelope, pull_request_number: args.pullRequestNumber + 1};
    },
  };
  await assert.rejects(
    validateIntent(
      fixture.tempRoot,
      fixture.b2Commit,
      fixture.manifestIntentApprovedHeadSha,
      'manifest_freeze_intent',
      fixture.manifestIntentPullRequest,
      createEvidenceContext(
        'https://github.com/LENKIN233/softbook_cet.git',
        forgedReaders,
      ),
    ),
    /receipt materialization merge envelope is malformed or mismatched/,
  );
});

test('F3 receipt wiring revalidates B2 semantics, provenance expiry, and unstarted windows', async (t) => {
  const fixture = buildManifestReceiptChain(t);
  const result = await validateReceiptMaterialization(
    fixture.tempRoot,
    fixture.manifestLandingCommitSha,
    fixture.manifestReceiptCommit,
    [ARTIFACT_PATHS.manifestFreezeReceipt, fixture.manifestReceiptRunRecord],
    fixture.manifestReceiptPullRequest,
    createEvidenceContext(
      'https://github.com/LENKIN233/softbook_cet.git',
      fixture.readers,
    ),
  );
  assert.equal(result.stage, 'receipt_materialization');
  assert.equal(result.approval_instance_digest, fixture.manifestReceipt.approval_instance_digest);

  await t.test('expired B2 provenance fails the dedicated invalidation condition', async (t) => {
    const stale = buildManifestReceiptChain(t, {
      mutateB2(b2) {
        b2.current_requirement_registry.requirements_by_id[
          'build-cp-ba-browser-documents'
        ].resolution_provenance.expires_at = '2026-08-10T00:15:00Z';
      },
    });
    await assert.rejects(
      validateReceiptMaterialization(
        stale.tempRoot,
        stale.manifestLandingCommitSha,
        stale.manifestReceiptCommit,
        [ARTIFACT_PATHS.manifestFreezeReceipt, stale.manifestReceiptRunRecord],
        stale.manifestReceiptPullRequest,
        createEvidenceContext(
          'https://github.com/LENKIN233/softbook_cet.git',
          stale.readers,
        ),
      ),
      /final_subject_resolution_provenance_expired: build-cp-ba-browser-documents/,
    );
  });

  await t.test('latest provider time at a window start fails closed', async (t) => {
    const started = buildManifestReceiptChain(t);
    const readers = {
      ...started.readers,
      readPullRequestMerge: async (args) => {
        const envelope = await started.readers.readPullRequestMerge(args);
        if (args.pullRequestNumber !== started.manifestIntentPullRequest) return envelope;
        return {...envelope, provider_observed_at: '2026-08-11T01:00:00Z'};
      },
    };
    await assert.rejects(
      validateReceiptMaterialization(
        started.tempRoot,
        started.manifestLandingCommitSha,
        started.manifestReceiptCommit,
        [ARTIFACT_PATHS.manifestFreezeReceipt, started.manifestReceiptRunRecord],
        started.manifestReceiptPullRequest,
        createEvidenceContext(
          'https://github.com/LENKIN233/softbook_cet.git',
          readers,
        ),
      ),
      /final_subject_execution_window_started_or_expired: window-cp-ba/,
    );
  });
});

test('receipt replay rejects merge-before-approval timing even when squash trees match', async (t) => {
  const fixture = buildLegacyPreparationChain(t);
  await assert.rejects(
    validatePreparationFixture(fixture, {
      readPullRequestMerge: async (args) => ({
        ...(await fixture.readers.readPullRequestMerge(args)),
        merged_at: '2026-08-10T00:00:03Z',
      }),
    }),
    /approval success must be observed no later than.*merge/,
  );
});
