#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {
  classifyFormalApprovalScope,
  parseExactGitNameStatusZ,
  readExactGitChangedRecords,
} from './classify_formal_approval_scope.mjs';
import {parseStrictJson} from './lib/strict_json.mjs';
import {
  ARTIFACT_PATHS,
  AUTHORITY_KEYS,
  BATCH1_SUBJECT_PATHS,
  HISTORICAL_PREPARATION,
  INVALIDATION_CONDITIONS_BY_KIND,
  TRUSTED_IDENTITY,
  assertExactKeys,
  buildLegacyPreparationParentTuple,
  canonicalJson,
  computeApprovalInstanceDigest,
  evaluateReceiptValidity,
  governancePolicyProjectionFromSpec,
  sha256Hex,
  validateApprovalReceipt,
  validateAuthorityMask,
  validateDecisionIntent,
  validateLegacyPreparationReceipt,
  validateParentTuple,
  validateRepositoryIdentity,
} from './lib/mobile_ux_batch1_governance_contract.mjs';
import {
  readVerifiedGitHubApprovalEvent,
  readVerifiedGitHubArtifact,
  readVerifiedGitHubCommitPullRequestAssociation,
  readVerifiedGitHubCurrentRunApproval,
  readVerifiedGitHubPullRequestMerge,
} from './lib/mobile_ux_batch1_github_event_reader.mjs';
import {
  ABSENT_ARTIFACT_SNAPSHOT,
  BOOTSTRAP_RUN_RECORD,
  BOOTSTRAP_TRUSTED_BASE_SHA,
  ESSENTIAL_RECOVERY_KERNEL_PATHS,
  FOUNDATION_ACTIVATION_DECISION as RECOVERY_FOUNDATION_ACTIVATION_DECISION,
  FOUNDATION_ACTIVATION_RUN_RECORD as RECOVERY_FOUNDATION_ACTIVATION_RUN_RECORD,
  GOVERNANCE_ANCHOR_PATHS,
  MAINTENANCE_EXACT_ALLOWLIST,
  MAINTENANCE_FIXTURE_PREFIX,
  ORIGINAL_GOVERNANCE_POLICY,
  RECOVERY_DECISION_CLASSES,
  artifactSnapshotFromBytes,
  buildChangedArtifactRecord,
  buildRebootstrapAnchorTransition,
  buildRevocationAnchorTransition,
  classifyGovernanceAnchorState,
  deriveGovernanceState,
  governanceAnchorProjection,
  parseRecoveryDecisionPath,
  parseRecoveryRunRecordPath,
  validateRecoveryDecision,
  validateVerifiedActiveLineageProof,
} from './lib/mobile_ux_batch1_governance_recovery_contract.mjs';
import {
  EXECUTION_MANIFEST_ROOT,
  POST_DESIGNATION_REQUIREMENT_IDS,
  RESOLVER_ROLES_BY_SOURCE_CLASS,
  SCHEMA_SUBJECT_DIGEST,
  SCHEMA_SUBJECT_RAW_SHA256,
  SCHEMA_TRANSITION_DIGEST,
} from './lib/mobile_ux_batch1_successor_contract.mjs';
import {validateSuccessorFromGit} from './validate_mobile_ux_batch1_successor.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHA1_RE = /^[0-9a-f]{40}$/;
const FOUNDATION_DECISION =
  'docs/design/decisions/mobile-ux-batch1-governance-foundation-v1.md';
const GOVERNANCE_POLICY = 'spec/mobile-ux-batch1-governance.json';
const RESOLVED_REQUIREMENT_SCHEMA =
  'spec/mobile-ux-batch1-resolved-requirement.schema.json';
const FOUNDATION_ACTIVATION_RUN_RECORD =
  'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-foundation-v1.md';
const FOUNDATION_ACTIVATION_PATHS = Object.freeze([
  'AGENTS.md',
  FOUNDATION_ACTIVATION_RUN_RECORD,
  FOUNDATION_DECISION,
  'spec/agent-harness.json',
  'spec/authority-map.json',
  'spec/doc-manifest.json',
  GOVERNANCE_POLICY,
  RESOLVED_REQUIREMENT_SCHEMA,
]);
const PROTECTED_APPROVAL_DECISION_CLASSES = Object.freeze([
  'generic_sensitive',
  'governance_foundation',
  'batch1_subject_change',
  'legacy_receipt_migration_intent',
  'cohort_designation_intent',
  'manifest_freeze_intent',
  'receipt_materialization',
  ...RECOVERY_DECISION_CLASSES,
]);
const FOUNDATION_IMMUTABLE_SUBJECT_PATHS = Object.freeze([
  GOVERNANCE_POLICY,
  RESOLVED_REQUIREMENT_SCHEMA,
  FOUNDATION_DECISION,
]);
const ACTIVE_GOVERNANCE_DOMAIN = Object.freeze({
  owner: GOVERNANCE_POLICY,
  protected_activation_record: FOUNDATION_DECISION,
  status: 'active_repo_governance_truth',
  mirrors: Object.freeze([
    'AGENTS.md',
    'spec/agent-harness.json',
    'spec/doc-manifest.json',
    'spec/repo-delivery-contract.json',
    'spec/harness-architecture.json',
    'spec/evals.json',
  ]),
  implementation_surfaces: Object.freeze([
    '.github/workflows/formal-approval.yml',
    'scripts/classify_formal_approval_scope.mjs',
    'scripts/validate_mobile_ux_batch1_governance.mjs',
  ]),
  notes:
    'Owns only the protected Mobile UX Batch 1 repository-governance mechanics and zero-authority staged decision chain; product, visual, implementation, native, release, and leadership-readiness truth remain with their existing owners.',
});
const ACTIVE_HARNESS_READ_PATHS = Object.freeze([
  'spec/authority-map.json',
  GOVERNANCE_POLICY,
  'spec/agent-harness.json',
  'spec/repo-delivery-contract.json',
  'spec/harness-architecture.json',
  'spec/evals.json',
]);
const ACTIVE_HARNESS_POLICY = Object.freeze({
  owner: GOVERNANCE_POLICY,
  activation_decision: FOUNDATION_DECISION,
  status_source: 'spec/authority-map.json#domains/mobile_ux_batch1_governance',
  scope_classifier: 'scripts/classify_formal_approval_scope.mjs',
  validator: 'scripts/validate_mobile_ux_batch1_governance.mjs',
  failure_policy: 'unknown_missing_mixed_expired_or_unverifiable_state_fails_closed',
  authority_boundary:
    'no_product_visual_implementation_native_release_or_leadership_readiness_authority',
});
const AGENTS_ACTIVE_SOURCE_LINE =
  '- `spec/mobile-ux-batch1-governance.json`（仅在 Mobile UX Batch 1 治理、受保护决策、R0 / D1 / B2 / F3 或对应回执任务中读取；只拥有仓库治理机制，全部产品、视觉、实现、原生、发布与领导验收权限仍为 false）';
const AGENTS_READ_ORDER_LINE =
  '- Mobile UX Batch 1 治理 / 受保护决策：`authority-map -> mobile-ux-batch1-governance -> agent-harness -> repo-delivery-contract -> harness-architecture -> evals`';
const AGENTS_HARD_BOUNDARY_LINES = Object.freeze([
  '- 不要把 Mobile UX Batch 1 governance foundation、R0 / D1 / B2 / F3 intent、receipt 或 successor validation 当作产品、视觉、实现、原生、发布或领导验收权限；严格以 `spec/mobile-ux-batch1-governance.json` 的 16 维 authority 与 distinct-PR stage separation 为准',
  '- 不要从待审批 PR head 加载或执行 formal-approval classifier、governance validator、GitHub evidence reader 或 successor validator；head 只能作为不受信 Git 数据读取，校验代码必须来自精确 verified base SHA',
  '- 不要在同一 PR 混合 governance foundation、Batch 1 subject、decision intent、approval receipt 或 execution manifest；没有专用授权 class 时 execution manifest 一律 fail closed',
]);

// Frozen only after the separate PR-B activation artifacts reached reviewed final bytes.
// The run record is replayed as a stable add-only artifact but is intentionally not one
// of the three immutable foundation subjects.
export const FOUNDATION_ACTIVATION_RAW_SHA256 = Object.freeze({
  'docs/design/decisions/mobile-ux-batch1-governance-foundation-v1.md':
    '4289f0881533a754418a5641678fcd1288eaa1d98353fd964344daef0bd85926',
  'spec/mobile-ux-batch1-governance.json':
    '176dd5bf4dec4fafd0ab171c6276f410e525a97d3b8b42185277994d6203be2c',
  'spec/mobile-ux-batch1-resolved-requirement.schema.json':
    '3f292ce02155ab511f4d76c49de3586fff0083b3e95ed94561eeb871ea65d50b',
});
export const TRUSTED_CODE_CLOSURE = Object.freeze([
  ...ESSENTIAL_RECOVERY_KERNEL_PATHS,
]);
const DECISION_CLASS_TO_PATH = Object.freeze({
  legacy_receipt_migration_intent: ARTIFACT_PATHS.legacyMigrationIntent,
  cohort_designation_intent: ARTIFACT_PATHS.cohortDesignationIntent,
  manifest_freeze_intent: ARTIFACT_PATHS.manifestFreezeIntent,
});
const INTENT_CLASS_TO_KIND = Object.freeze({
  legacy_receipt_migration_intent: 'legacy_receipt_migration',
  cohort_designation_intent: 'cohort_designation',
  manifest_freeze_intent: 'manifest_freeze',
});
const RECEIPT_PATHS = new Set([
  ARTIFACT_PATHS.legacyMigrationReceipt,
  ARTIFACT_PATHS.legacyPreparationReceipt,
  ARTIFACT_PATHS.cohortDesignationReceipt,
  ARTIFACT_PATHS.manifestFreezeReceipt,
]);

function fail(message) {
  throw new Error(message);
}

function asPositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) fail(`${label} must be a positive integer`);
  return parsed;
}

function assertCommit(value, label) {
  if (typeof value !== 'string' || !SHA1_RE.test(value)) {
    fail(`${label} must be a lowercase full Git SHA`);
  }
}

function git(root, args, {buffer = false, allowFailure = false} = {}) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: buffer ? undefined : 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    const stderr = buffer ? result.stderr.toString('utf8') : result.stderr;
    fail(`git ${args.join(' ')} failed: ${(stderr || '').trim() || `exit ${result.status}`}`);
  }
  return result;
}

function assertAvailableCommit(root, commit, label) {
  assertCommit(commit, label);
  if (git(root, ['cat-file', '-e', `${commit}^{commit}`], {allowFailure: true}).status !== 0) {
    fail(`${label} is not available as trusted Git data: ${commit}`);
  }
}

function assertAncestor(root, ancestor, descendant, label) {
  if (
    git(root, ['merge-base', '--is-ancestor', ancestor, descendant], {
      allowFailure: true,
    }).status !== 0
  ) {
    fail(`${label}: ${ancestor} is not an ancestor of ${descendant}`);
  }
}

function assertStrictAncestor(root, ancestor, descendant, label) {
  if (ancestor === descendant) fail(`${label}: ancestor and descendant must be distinct`);
  assertAncestor(root, ancestor, descendant, label);
}

function readArtifact(root, commit, relativePath, {required = true} = {}) {
  if (
    typeof relativePath !== 'string' ||
    relativePath.startsWith('/') ||
    relativePath.includes('\\') ||
    relativePath.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    fail(`invalid repository artifact path: ${relativePath}`);
  }
  const tree = git(root, ['ls-tree', commit, '--', relativePath], {allowFailure: true});
  if (tree.status !== 0) fail(`cannot inspect ${commit}:${relativePath}`);
  const line = tree.stdout.trim();
  if (!line) {
    if (!required) return null;
    fail(`required artifact is missing at ${commit}: ${relativePath}`);
  }
  const match = line.match(/^([0-7]{6}) blob ([0-9a-f]{40})\t(.+)$/);
  if (!match || match[1] !== '100644' || match[3] !== relativePath) {
    fail(`${commit}:${relativePath} must be one exact tracked 100644 non-symlink blob`);
  }
  const shown = git(root, ['show', `${commit}:${relativePath}`], {buffer: true});
  const bytes = Buffer.from(shown.stdout);
  return {
    path: relativePath,
    git_mode: match[1],
    byte_length: bytes.length,
    raw_sha256: sha256Hex(bytes),
    bytes,
  };
}

function artifactRecord(artifact) {
  return {
    path: artifact.path,
    git_mode: artifact.git_mode,
    byte_length: artifact.byte_length,
    raw_sha256: artifact.raw_sha256,
  };
}

function artifactSnapshotAt(root, commit, relativePath) {
  const artifact = readArtifact(root, commit, relativePath, {required: false});
  if (artifact === null) return structuredClone(ABSENT_ARTIFACT_SNAPSHOT);
  return artifactSnapshotFromBytes(artifact.bytes, artifact.git_mode);
}

function changedArtifactRecords(root, baseSha, headSha, changedPaths, decisionPath) {
  return changedPaths
    .filter((relativePath) => relativePath !== decisionPath)
    .sort()
    .map((relativePath) =>
      buildChangedArtifactRecord(
        relativePath,
        artifactSnapshotAt(root, baseSha, relativePath),
        artifactSnapshotAt(root, headSha, relativePath),
      ),
    );
}

function parseArtifactJson(artifact, label = artifact.path) {
  return parseStrictJson(artifact.bytes, label);
}

function readJson(root, commit, relativePath) {
  return parseArtifactJson(readArtifact(root, commit, relativePath), `${commit}:${relativePath}`);
}

function treeHasPath(root, commit, relativePath) {
  return git(root, ['ls-tree', '-r', '--name-only', commit, '--', relativePath]).stdout.trim().length > 0;
}

function readGitHubFiles(file, expectedCountValue) {
  const expectedCount = Number(expectedCountValue);
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 0 || expectedCount >= 3000) {
    fail('--expected-count must be between 0 and 2999');
  }
  const pages = parseStrictJson(
    fs.readFileSync(file),
    '--github-files',
  );
  if (!Array.isArray(pages) || !pages.every((page) => Array.isArray(page))) {
    fail('--github-files must contain a paginated array of arrays');
  }
  const files = pages.flat();
  if (files.length !== expectedCount) {
    fail(`GitHub changed-file list is incomplete: expected ${expectedCount}, received ${files.length}`);
  }
  const currentPaths = [];
  const seen = new Set();
  for (const [index, entry] of files.entries()) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      fail(`GitHub changed-file entry ${index} is malformed`);
    }
    if (typeof entry.filename !== 'string' || entry.filename.length === 0 || seen.has(entry.filename)) {
      fail(`GitHub changed-file entry ${index} has an invalid or duplicate filename`);
    }
    seen.add(entry.filename);
    if (
      typeof entry.status !== 'string' ||
      !['added', 'modified', 'removed', 'renamed', 'copied', 'changed', 'unchanged'].includes(entry.status)
    ) {
      fail(`GitHub changed-file entry ${index} has an invalid status`);
    }
    currentPaths.push(entry.filename);
    if (entry.previous_filename !== undefined) {
      if (typeof entry.previous_filename !== 'string' || entry.previous_filename.length === 0) {
        fail(`GitHub changed-file entry ${index} has a malformed previous filename`);
      }
    }
  }
  return Object.freeze({currentPaths: Object.freeze(currentPaths.sort())});
}

function exactGitChangedFileView(root, baseSha, headSha) {
  const records = readExactGitChangedRecords(root, baseSha, headSha);
  const currentPaths = records.map((record) => record.path).sort();
  if (new Set(currentPaths).size !== currentPaths.length) {
    fail('exact Git diff contains duplicate current filenames');
  }
  const classificationPaths = records
    .flatMap((record) =>
      record.oldPath === null ? [record.path] : [record.oldPath, record.path]
    )
    .sort();
  return Object.freeze({
    records,
    currentPaths: Object.freeze(currentPaths),
    classificationPaths: Object.freeze(classificationPaths),
  });
}

export function exactGitClassificationPaths(root, baseSha, headSha) {
  return exactGitChangedFileView(root, baseSha, headSha).classificationPaths;
}

function assertPathsUntouchedBetween(root, baseSha, headSha, relativePaths, label) {
  const touched = git(root, [
    'log',
    '--format=%H',
    `${baseSha}..${headSha}`,
    '--',
    ...relativePaths,
  ]).stdout.trim();
  if (touched) fail(`${label} must not touch protected subject paths in any pull-request commit`);
}

function assertSameStringSet(actual, expected, label) {
  const left = [...new Set(actual)].sort();
  const right = [...new Set(expected)].sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    fail(`${label} mismatch: git=${JSON.stringify(left)} api=${JSON.stringify(right)}`);
  }
}

function assertExactChangedScope(actualPaths, expectedPaths, label) {
  const actual = [...actualPaths].sort();
  const expected = [...expectedPaths].sort();
  if (
    actual.length !== new Set(actual).size ||
    JSON.stringify(actual) !== JSON.stringify(expected)
  ) {
    fail(`${label} must change exactly ${JSON.stringify(expected)}; received ${JSON.stringify(actual)}`);
  }
}

function isCanonicalAgentRunRecord(relativePath) {
  return /^docs\/agent-runs\/\d{4}-\d{2}-\d{2}-mobile-ux-batch1-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(
    relativePath,
  );
}

function assertScopeWithOneRunRecord(changedPaths, requiredPaths, label) {
  const runRecords = changedPaths.filter(isCanonicalAgentRunRecord);
  if (runRecords.length !== 1) {
    fail(`${label} requires exactly one canonical mobile UX Batch 1 agent run record`);
  }
  assertExactChangedScope(changedPaths, [...requiredPaths, runRecords[0]], label);
  return runRecords[0];
}

function assertDecisionChangedScope(decisionClass, changedPaths) {
  if (RECOVERY_DECISION_CLASSES.includes(decisionClass)) {
    const decisions = changedPaths
      .map((relativePath) => ({
        relativePath,
        parsed: parseRecoveryDecisionPath(relativePath),
      }))
      .filter((entry) => entry.parsed !== null);
    const runRecords = changedPaths
      .map((relativePath) => ({
        relativePath,
        parsed: parseRecoveryRunRecordPath(relativePath),
      }))
      .filter((entry) => entry.parsed !== null);
    if (decisions.length !== 1 || runRecords.length !== 1) {
      fail(`${decisionClass} requires exactly one canonical recovery decision and run record`);
    }
    const decision = decisions[0];
    const runRecord = runRecords[0];
    if (
      decision.parsed.decisionClass !== decisionClass ||
      runRecord.parsed.decisionClass !== decisionClass ||
      decision.parsed.pullRequest !== runRecord.parsed.pullRequest ||
      decision.parsed.slug !== runRecord.parsed.slug
    ) {
      fail(`${decisionClass} decision and run-record identity mismatch`);
    }
    return runRecord.relativePath;
  }
  if (decisionClass === 'governance_foundation') {
    assertExactChangedScope(
      changedPaths,
      FOUNDATION_ACTIVATION_PATHS,
      'governance foundation activation scope',
    );
    return FOUNDATION_ACTIVATION_RUN_RECORD;
  }
  if (decisionClass === 'legacy_receipt_migration_intent') {
    return assertScopeWithOneRunRecord(
      changedPaths,
      [ARTIFACT_PATHS.legacyMigrationIntent],
      'legacy migration intent scope',
    );
  }
  if (decisionClass === 'cohort_designation_intent') {
    return assertScopeWithOneRunRecord(
      changedPaths,
      [ARTIFACT_PATHS.cohortDesignationIntent, ARTIFACT_PATHS.cohortNonPiiAttestation],
      'cohort designation intent scope',
    );
  }
  if (decisionClass === 'manifest_freeze_intent') {
    return assertScopeWithOneRunRecord(
      changedPaths,
      [ARTIFACT_PATHS.manifestFreezeIntent],
      'manifest freeze intent scope',
    );
  }
  if (decisionClass === 'batch1_subject_change') {
    const changedSubjectPaths = changedPaths.filter((relativePath) =>
      BATCH1_SUBJECT_PATHS.includes(relativePath),
    );
    if (changedSubjectPaths.length === BATCH1_SUBJECT_PATHS.length) {
      return assertScopeWithOneRunRecord(
        changedPaths,
        BATCH1_SUBJECT_PATHS,
        'Batch 1 schema subject scope',
      );
    } else {
      return assertScopeWithOneRunRecord(
        changedPaths,
        [BATCH1_SUBJECT_PATHS[0]],
        'Batch 1 R0/B2 registry-only scope',
      );
    }
  }
  if (decisionClass !== 'receipt_materialization') return null;

  const receiptPaths = changedPaths.filter((relativePath) => RECEIPT_PATHS.has(relativePath));
  if (receiptPaths.length !== 1) {
    fail('receipt materialization scope must contain exactly one fixed receipt path');
  }
  return assertScopeWithOneRunRecord(
    changedPaths,
    receiptPaths,
    receiptPaths[0] === ARTIFACT_PATHS.legacyPreparationReceipt
      ? 'legacy preparation receipt scope'
      : 'receipt materialization scope',
  );
}

function assertCanonicalRunRecordConsumption(changedPaths, consumedRunRecord) {
  const canonicalRunRecords = changedPaths.filter(isCanonicalAgentRunRecord);
  if (consumedRunRecord === null) {
    if (canonicalRunRecords.length > 0) {
      fail('canonical Mobile UX Batch 1 run-record changes require one matching specialized decision class');
    }
    return;
  }
  if (
    canonicalRunRecords.length !== 1 ||
    canonicalRunRecords[0] !== consumedRunRecord
  ) {
    fail('the specialized decision class must consume exactly its one canonical Batch 1 run record');
  }
}

function assertNewProtectedArtifact(
  root,
  baseSha,
  headSha,
  exactGitView,
  relativePath,
  label,
) {
  if (readArtifact(root, baseSha, relativePath, {required: false}) !== null) {
    fail(`${label} must be absent from the trusted base: ${relativePath}`);
  }
  const artifact = readArtifact(root, headSha, relativePath);
  if (artifact.byte_length === 0) {
    fail(`${label} must be a nonempty tracked 100644 artifact: ${relativePath}`);
  }
  const touchingEntries = exactGitView.records.filter(
    (entry) => entry.path === relativePath || entry.oldPath === relativePath,
  );
  if (
    touchingEntries.length !== 1 ||
    touchingEntries[0].status !== 'A' ||
    touchingEntries[0].oldPath !== null ||
    touchingEntries[0].path !== relativePath
  ) {
    fail(
      `${label} must be an exact Git add, not a rename or copy, from base to head: ` +
      `${relativePath}; detected ${JSON.stringify(touchingEntries)}`,
    );
  }
}

function assertNewCanonicalRunRecord(root, baseSha, headSha, exactGitView, relativePath) {
  if (!isCanonicalAgentRunRecord(relativePath)) {
    fail(`specialized run record path is not canonical: ${relativePath}`);
  }
  assertNewProtectedArtifact(
    root,
    baseSha,
    headSha,
    exactGitView,
    relativePath,
    'specialized agent run record',
  );
}

function assertNewRecoveryDecision(root, baseSha, headSha, exactGitView, relativePath) {
  if (parseRecoveryDecisionPath(relativePath) === null) {
    fail(`recovery decision path is not canonical: ${relativePath}`);
  }
  assertNewProtectedArtifact(
    root,
    baseSha,
    headSha,
    exactGitView,
    relativePath,
    'recovery decision artifact',
  );
}

function assertCanonicalRemote(root, origin) {
  validateRepositoryIdentity({
    repository: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    origin,
  });
  const gitOrigin = git(root, ['remote', 'get-url', 'origin']).stdout.trim();
  validateRepositoryIdentity({
    repository: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    origin: gitOrigin,
  });
}

const FORMAL_APPROVAL_JOB_CONTRACT = Object.freeze({
  classify: Object.freeze({
    next: 'trusted_validation',
    jobKeys: Object.freeze(['name', 'runs-on', 'timeout-minutes', 'outputs', 'steps']),
    steps: Object.freeze([
      Object.freeze(['Checkout trusted base revision', 'name', 'uses', 'with']),
      Object.freeze(['Verify trusted base checkout', 'name', 'env', 'run']),
      Object.freeze(['Set up trusted Node.js runtime', 'name', 'uses', 'with']),
      Object.freeze(['Fetch exact event head as Git data', 'name', 'env', 'run']),
      Object.freeze(['Classify formal approval scope', 'name', 'id', 'env', 'run']),
      Object.freeze(['Fail closed on classification errors', 'name', 'env', 'run']),
    ]),
  }),
  trusted_validation: Object.freeze({
    next: 'automatic',
    jobKeys: Object.freeze(['name', 'needs', 'if', 'runs-on', 'timeout-minutes', 'steps']),
    steps: Object.freeze([
      Object.freeze(['Checkout trusted base revision', 'name', 'uses', 'with']),
      Object.freeze(['Verify trusted base checkout', 'name', 'env', 'run']),
      Object.freeze(['Set up trusted Node.js runtime', 'name', 'uses', 'with']),
      Object.freeze(['Read pull request data from GitHub', 'name', 'env', 'run']),
      Object.freeze(['Fetch untrusted head as data only', 'name', 'env', 'run']),
      Object.freeze(['Validate the pull request with trusted base code', 'name', 'env', 'run']),
    ]),
  }),
  automatic: Object.freeze({
    next: 'product_owner',
    jobKeys: Object.freeze(['name', 'needs', 'if', 'runs-on', 'timeout-minutes', 'steps']),
    steps: Object.freeze([
      Object.freeze([null, 'run']),
    ]),
  }),
  product_owner: Object.freeze({
    next: 'result',
    jobKeys: Object.freeze([
      'name',
      'needs',
      'if',
      'environment',
      'runs-on',
      'timeout-minutes',
      'steps',
    ]),
    steps: Object.freeze([
      Object.freeze(['Checkout trusted base revision', 'name', 'uses', 'with']),
      Object.freeze(['Verify trusted base checkout', 'name', 'env', 'run']),
      Object.freeze(['Set up trusted Node.js runtime', 'name', 'uses', 'with']),
      Object.freeze(['Fetch untrusted head as data only', 'name', 'env', 'run']),
      Object.freeze([
        'Verify the current protected approval from trusted base code',
        'name',
        'env',
        'run',
      ]),
    ]),
  }),
  result: Object.freeze({
    next: null,
    jobKeys: Object.freeze(['name', 'if', 'needs', 'runs-on', 'timeout-minutes', 'steps']),
    steps: Object.freeze([
      Object.freeze(['Require the applicable approval path', 'name', 'env', 'run']),
    ]),
  }),
});
export const FORMAL_APPROVAL_WORKFLOW_RAW_SHA256 =
  '13e67dede95f30de747155552e43b0ef758059bd375612d59eedbe24685d2de2';
export const PULL_REQUEST_GATE_WORKFLOW_PATH = '.github/workflows/pr-gates.yml';
export const PULL_REQUEST_GATE_WORKFLOW_RAW_SHA256 =
  '176669820888a9f4d109740a447175ab3ef99c1dc351642f3a665266867c81a0';

export function validatePullRequestGateWorkflowStructure(workflowText) {
  if (typeof workflowText !== 'string' || workflowText.length === 0) {
    fail('pull-request gate workflow must be non-empty UTF-8 text');
  }
  const usesLines = workflowText
    .split('\n')
    .filter((line) => /^\s+uses:/.test(line));
  if (usesLines.length === 0) {
    fail('pull-request gate workflow must contain pinned action uses');
  }
  const fullCommitActionUse =
    /^\s+uses:\s+[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}(?:\s+#.*)?$/;
  for (const line of usesLines) {
    if (!fullCommitActionUse.test(line)) {
      fail('pull-request gate workflow action uses must use lowercase full-commit SHA pins');
    }
  }
  if (
    sha256Hex(Buffer.from(workflowText, 'utf8')) !==
    PULL_REQUEST_GATE_WORKFLOW_RAW_SHA256
  ) {
    fail(
      'pull-request gate workflow security-critical values must match the exact closed byte contract',
    );
  }
  return true;
}

function workflowJobSection(jobsText, jobName, nextJob) {
  const marker = `  ${jobName}:\n`;
  const start = jobsText.indexOf(marker);
  if (start < 0 || jobsText.indexOf(marker, start + marker.length) >= 0) {
    fail(`formal approval workflow must define exactly one ${jobName} job`);
  }
  const contentStart = start + marker.length;
  if (nextJob === null) return jobsText.slice(contentStart);
  const endMarker = `\n  ${nextJob}:\n`;
  const end = jobsText.indexOf(endMarker, contentStart);
  if (end < 0) fail(`formal approval workflow job order is missing ${nextJob}`);
  return jobsText.slice(contentStart, end);
}

function workflowStepRecords(jobSection, jobName) {
  const stepsMarker = '    steps:\n';
  const stepsStart = jobSection.indexOf(stepsMarker);
  if (stepsStart < 0 || jobSection.indexOf(stepsMarker, stepsStart + stepsMarker.length) >= 0) {
    fail(`formal approval workflow ${jobName} must define exactly one steps block`);
  }
  const stepsText = jobSection.slice(stepsStart + stepsMarker.length);
  const starts = [...stepsText.matchAll(/^      - (.+)$/gm)];
  if (starts.length === 0) fail(`formal approval workflow ${jobName} steps must not be empty`);
  return starts.map((match, index) => {
    const end = index + 1 < starts.length ? starts[index + 1].index : stepsText.length;
    const block = stepsText.slice(match.index, end);
    const first = match[1];
    const firstMatch = first.match(/^([a-z][a-z0-9_-]*):(?:\s*(.*))?$/);
    if (!firstMatch) fail(`formal approval workflow ${jobName} has a malformed step header`);
    const keys = [firstMatch[1]];
    for (const line of block.split('\n')) {
      if (/^        \S/.test(line) && !/^        [a-z][a-z0-9_-]*:(?:\s|$)/.test(line)) {
        fail(`formal approval workflow ${jobName} has an unsupported step-level YAML entry`);
      }
    }
    for (const keyMatch of block.matchAll(/^        ([a-z][a-z0-9_-]*):(?:\s|$)/gm)) {
      keys.push(keyMatch[1]);
    }
    return {
      name: firstMatch[1] === 'name' ? firstMatch[2] : null,
      keys,
    };
  });
}

export function validateFormalApprovalWorkflowStructure(workflowText) {
  if (typeof workflowText !== 'string' || workflowText.length === 0) {
    fail('formal approval workflow must be non-empty UTF-8 text');
  }
  const jobsMarker = '\njobs:\n';
  const jobsStart = workflowText.indexOf(jobsMarker);
  if (jobsStart < 0 || workflowText.indexOf(jobsMarker, jobsStart + jobsMarker.length) >= 0) {
    fail('formal approval workflow must define exactly one jobs mapping');
  }
  const jobsText = workflowText.slice(jobsStart + 1);
  const topLevelKeys = [...workflowText.matchAll(/^([a-z][a-z0-9_-]*):(?:\s|$)/gm)].map(
    (match) => match[1],
  );
  if (JSON.stringify(topLevelKeys) !== JSON.stringify(['name', 'on', 'permissions', 'concurrency', 'jobs'])) {
    fail('formal approval workflow top-level keys or order drift');
  }
  const triggerBlock = workflowText
    .slice(workflowText.indexOf('on:'), workflowText.indexOf('\npermissions:'))
    .trim();
  if (
    triggerBlock !== [
      'on:',
      '  pull_request_target:',
      '    branches:',
      '      - main',
      '    types:',
      '      - opened',
      '      - synchronize',
      '      - reopened',
      '      - ready_for_review',
    ].join('\n')
  ) {
    fail('formal approval workflow trigger contract drift');
  }
  const concurrencyBlock = workflowText
    .slice(workflowText.indexOf('concurrency:'), workflowText.indexOf('\njobs:'))
    .trim();
  if (
    concurrencyBlock !== [
      'concurrency:',
      '  group: formal-approval-${{ github.event.pull_request.number }}',
      '  cancel-in-progress: true',
    ].join('\n')
  ) {
    fail('formal approval workflow concurrency contract drift');
  }
  for (const line of jobsText.split('\n').slice(1)) {
    if (/^  \S/.test(line) && !/^  [a-z][a-z0-9_]*:$/.test(line)) {
      fail('formal approval workflow has an unsupported jobs-level YAML entry');
    }
  }
  const jobNames = [...jobsText.matchAll(/^  ([a-z][a-z0-9_]*):$/gm)].map(
    (match) => match[1],
  );
  const expectedJobNames = Object.keys(FORMAL_APPROVAL_JOB_CONTRACT);
  if (JSON.stringify(jobNames) !== JSON.stringify(expectedJobNames)) {
    fail('formal approval workflow job set or order drift');
  }
  const permissionBlock = workflowText
    .slice(workflowText.indexOf('permissions:'), workflowText.indexOf('\nconcurrency:'))
    .trim();
  if (
    permissionBlock !== [
      'permissions:',
      '  actions: read',
      '  contents: read',
      '  deployments: read',
      '  pull-requests: read',
    ].join('\n')
  ) {
    fail('formal approval workflow permissions must be the exact read-only set');
  }
  for (const [jobName, contract] of Object.entries(FORMAL_APPROVAL_JOB_CONTRACT)) {
    const section = workflowJobSection(jobsText, jobName, contract.next);
    for (const line of section.split('\n')) {
      if (/^    \S/.test(line) && !/^    [a-z][a-z0-9_-]*:(?:\s|$)/.test(line)) {
        fail(`formal approval workflow ${jobName} has an unsupported job-level YAML entry`);
      }
    }
    const jobKeys = [...section.matchAll(/^    ([a-z][a-z0-9_-]*):(?:\s|$)/gm)].map(
      (match) => match[1],
    );
    if (JSON.stringify(jobKeys) !== JSON.stringify(contract.jobKeys)) {
      fail(`formal approval workflow ${jobName} job keys or order drift`);
    }
    const steps = workflowStepRecords(section, jobName);
    if (steps.length !== contract.steps.length) {
      fail(`formal approval workflow ${jobName} step count drift`);
    }
    for (const [index, expected] of contract.steps.entries()) {
      const [expectedName, ...expectedKeys] = expected;
      const actual = steps[index];
      if (
        actual.name !== expectedName ||
        JSON.stringify(actual.keys) !== JSON.stringify(expectedKeys)
      ) {
        fail(`formal approval workflow ${jobName} step ${index + 1} shape or order drift`);
      }
    }
  }
  const checkoutUse =
    'uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7';
  const setupNodeUse =
    'uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7';
  const useLines = workflowText
    .split('\n')
    .filter((line) => /^\s+uses:/.test(line))
    .map((line) => line.trim());
  if (
    JSON.stringify(useLines) !== JSON.stringify([
      checkoutUse,
      setupNodeUse,
      checkoutUse,
      setupNodeUse,
      checkoutUse,
      setupNodeUse,
    ])
  ) {
    fail('formal approval workflow action uses must match the full-commit pin contract');
  }
  const requiredCounts = new Map([
    ['ref: ${{ github.event.pull_request.base.sha }}', 3],
    ['fetch-depth: 0', 3],
    ['persist-credentials: false', 3],
    ['node-version: "22.13.0"', 3],
    ['git fetch --no-tags origin "refs/pull/$PR_NUMBER/head"', 3],
    ['git status --porcelain=v1 --untracked-files=all', 6],
    ['node scripts/classify_formal_approval_scope.mjs \\', 1],
    ['--root . \\', 1],
    ['--base-sha "$BASE_SHA" \\', 3],
    ['--head-sha "$HEAD_SHA" \\', 3],
    ['node scripts/validate_mobile_ux_batch1_governance.mjs validate-pr', 1],
    ['node scripts/validate_mobile_ux_batch1_governance.mjs verify-current-run-approval', 1],
    ['--workflow-run-id "$GITHUB_RUN_ID"', 1],
    ['--workflow-run-attempt "$GITHUB_RUN_ATTEMPT"', 1],
    ['--decision-class "$DECISION_CLASS"', 2],
    ['DECISION_CLASS: ${{ needs.classify.outputs.decision_class }}', 3],
  ]);
  for (const [needle, expectedCount] of requiredCounts) {
    const actualCount = workflowText.split(needle).length - 1;
    if (actualCount !== expectedCount) {
      fail(`formal approval workflow required token count drift: ${needle}`);
    }
  }
  if (
    /^\s+(?:git )?(?:checkout|switch|worktree)\b.*HEAD_SHA/m.test(workflowText) ||
    /^\s+ref:.*pull_request\.head\.sha/m.test(workflowText)
  ) {
    fail('formal approval workflow must never check out or execute the untrusted head');
  }
  if (
    sha256Hex(Buffer.from(workflowText, 'utf8')) !==
    FORMAL_APPROVAL_WORKFLOW_RAW_SHA256
  ) {
    fail(
      'formal approval workflow security-critical values must match the exact closed byte contract',
    );
  }
  return true;
}

export function validateTrustedCodeClosure(root, baseSha) {
  const records = [];
  for (const relativePath of TRUSTED_CODE_CLOSURE) {
    const baseArtifact = readArtifact(root, baseSha, relativePath);
    const workingPath = path.join(root, relativePath);
    const stat = fs.lstatSync(workingPath, {throwIfNoEntry: false});
    if (!stat || !stat.isFile() || stat.isSymbolicLink()) {
      fail(`trusted code worktree path must be a regular non-symlink file: ${relativePath}`);
    }
    const workingBytes = fs.readFileSync(workingPath);
    const workingDigest = sha256Hex(workingBytes);
    if (
      workingBytes.length !== baseArtifact.byte_length ||
      workingDigest !== baseArtifact.raw_sha256
    ) {
      fail(`trusted code worktree bytes differ from base blob: ${relativePath}`);
    }
    if (relativePath === TRUSTED_IDENTITY.workflowPath) {
      validateFormalApprovalWorkflowStructure(baseArtifact.bytes.toString('utf8'));
    }
    if (relativePath === PULL_REQUEST_GATE_WORKFLOW_PATH) {
      validatePullRequestGateWorkflowStructure(baseArtifact.bytes.toString('utf8'));
    }
    records.push(artifactRecord(baseArtifact));
  }
  return Object.freeze(records);
}

function validateResolvedRequirementSchema(schema) {
  if (schema?.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
    fail('resolved requirement schema must use JSON Schema draft 2020-12');
  }
  if (schema.type !== 'object' || schema.additionalProperties !== false) {
    fail('resolved requirement schema root must be an exact object');
  }
  const authority = schema?.$defs?.allFalseAuthority;
  if (authority?.additionalProperties !== false) fail('resolved requirement authority schema must be closed');
  if (JSON.stringify(authority?.required) !== JSON.stringify(AUTHORITY_KEYS)) {
    fail('resolved requirement authority schema must require the canonical 16-key order');
  }
  for (const key of AUTHORITY_KEYS) {
    if (authority?.properties?.[key]?.const !== false) {
      fail(`resolved requirement authority.${key} must be const false`);
    }
  }
  if (!Object.hasOwn(schema.properties ?? {}, 'owner_backed_not_applicable_ref')) {
    fail('resolved requirement schema must preserve owner_backed_not_applicable_ref');
  }
  const provenance = schema?.$defs?.resolutionProvenance;
  if (
    provenance?.type !== 'object' ||
    provenance?.additionalProperties !== false ||
    JSON.stringify(provenance?.properties?.source_class?.enum) !==
      JSON.stringify(Object.keys(RESOLVER_ROLES_BY_SOURCE_CLASS)) ||
    JSON.stringify(provenance?.properties?.resolver_role?.enum) !==
      JSON.stringify(Object.values(RESOLVER_ROLES_BY_SOURCE_CLASS).flat()) ||
    provenance?.properties?.gate_eligible?.const !== false
  ) {
    fail('resolved requirement provenance source classes, resolver roles, or authority boundary drift');
  }
  const expectedConditionalMappings = [
    {
      if: {properties: {source_class: {const: 'repository_artifact'}}, required: ['source_class']},
      then: {properties: {
        resolver_role: {const: 'repository_semantic_resolver'},
        source_event_sha256: {type: 'null'},
        source_artifact_records: {minItems: 1},
      }},
    },
    {
      if: {properties: {source_class: {const: 'protected_owner_decision'}}, required: ['source_class']},
      then: {properties: {
        resolver_role: {const: 'protected_product_owner'},
        source_event_sha256: {$ref: '#/$defs/sha256'},
      }},
    },
    {
      if: {properties: {source_class: {const: 'protected_human_confirmation'}}, required: ['source_class']},
      then: {properties: {
        resolver_role: {enum: ['confirmed_operator', 'confirmed_independent_verifier']},
        source_event_sha256: {$ref: '#/$defs/sha256'},
      }},
    },
    {
      if: {properties: {source_class: {const: 'verified_external_resource'}}, required: ['source_class']},
      then: {properties: {
        resolver_role: {const: 'external_resource_verifier'},
        source_event_sha256: {$ref: '#/$defs/sha256'},
      }},
    },
    {
      if: {properties: {source_class: {const: 'deterministic_derivation'}}, required: ['source_class']},
      then: {properties: {
        resolver_role: {const: 'deterministic_builder'},
        source_event_sha256: {type: 'null'},
        source_artifact_records: {minItems: 1},
      }},
    },
  ];
  if (canonicalJson(provenance?.allOf) !== canonicalJson(expectedConditionalMappings)) {
    fail('resolved requirement provenance conditional source-class mapping drift');
  }
}

function assertCanonicalDataEqual(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) fail(`${label} transition drift`);
}

function insertAfterExactLine(source, anchor, additions, label) {
  const finalNewline = source.endsWith('\n');
  const lines = source.split('\n');
  if (finalNewline) lines.pop();
  const matches = lines
    .map((line, index) => line === anchor ? index : -1)
    .filter((index) => index >= 0);
  if (matches.length !== 1) fail(`${label} activation anchor must occur exactly once`);
  lines.splice(matches[0] + 1, 0, ...additions);
  return `${lines.join('\n')}${finalNewline ? '\n' : ''}`;
}

function nextVnextVersion(value, label, minimum) {
  if (typeof value !== 'string') fail(`${label} version must be a string`);
  const match = value.match(/^vnext-([1-9][0-9]*)$/);
  if (!match) fail(`${label} version must use canonical vnext-N syntax`);
  const current = Number(match[1]);
  if (!Number.isSafeInteger(current) || current < minimum) {
    fail(`${label} version must be at least vnext-${minimum}`);
  }
  if (current >= Number.MAX_SAFE_INTEGER) {
    fail(`${label} version cannot be incremented safely`);
  }
  return `vnext-${current + 1}`;
}

function expectedActivatedAgents(baseText) {
  let expected = insertAfterExactLine(
    baseText,
    '- `spec/doc-manifest.json`',
    [AGENTS_ACTIVE_SOURCE_LINE],
    'AGENTS active-source',
  );
  expected = insertAfterExactLine(
    expected,
    '- 交付 / PR / CI：`authority-map -> agent-harness -> repo-delivery-contract -> evals`（涉及接收方环境、正式内容发布或回滚时追加 `runtime-boundaries -> infra/cloudbase/release-bundle-v1-runtime-contract.md`）',
    [AGENTS_READ_ORDER_LINE],
    'AGENTS read-order',
  );
  expected = insertAfterExactLine(
    expected,
    '- 不要把 `scripts/run_local_gates` 的本地报告当作 GitHub required checks、Agent review、正式内容批准或 launch readiness；`dev` / `pr` / `release` profile 与 `local-gate-report.v1` 以 `spec/harness-architecture.json#local_gate_runner_contract` 为准',
    AGENTS_HARD_BOUNDARY_LINES,
    'AGENTS hard-boundary',
  );
  return expected;
}

export function validateFoundationDocManifestTransition(baseManifest, headManifest) {
  if (
    baseManifest === null ||
    typeof baseManifest !== 'object' ||
    Array.isArray(baseManifest) ||
    !Array.isArray(baseManifest.active_specs) ||
    baseManifest.active_specs.includes(GOVERNANCE_POLICY)
  ) {
    fail('foundation activation doc-manifest base is not an exact inactive state');
  }
  const authorityIndexes = baseManifest.active_specs
    .map((entry, index) => entry === 'spec/authority-map.json' ? index : -1)
    .filter((index) => index >= 0);
  if (authorityIndexes.length !== 1) {
    fail('foundation activation doc-manifest requires exactly one spec/authority-map.json anchor');
  }
  const expectedManifest = structuredClone(baseManifest);
  expectedManifest.version = nextVnextVersion(
    baseManifest.version,
    'foundation doc-manifest',
    9,
  );
  expectedManifest.active_specs.splice(
    authorityIndexes[0] + 1,
    0,
    GOVERNANCE_POLICY,
  );
  assertCanonicalDataEqual(
    headManifest,
    expectedManifest,
    'foundation doc-manifest',
  );
  return Object.freeze(expectedManifest);
}

function validateFoundationAnchorTransition(root, baseSha, headSha) {
  const baseAuthority = readJson(root, baseSha, 'spec/authority-map.json');
  const expectedAuthority = structuredClone(baseAuthority);
  if (Object.hasOwn(baseAuthority.domains, 'mobile_ux_batch1_governance')) {
    fail('foundation activation authority-map base is not an exact inactive state');
  }
  expectedAuthority.version = nextVnextVersion(
    baseAuthority.version,
    'foundation authority-map',
    4,
  );
  expectedAuthority.domains.mobile_ux_batch1_governance = ACTIVE_GOVERNANCE_DOMAIN;
  assertCanonicalDataEqual(
    readJson(root, headSha, 'spec/authority-map.json'),
    expectedAuthority,
    'foundation authority-map',
  );

  const baseHarness = readJson(root, baseSha, 'spec/agent-harness.json');
  const expectedHarness = structuredClone(baseHarness);
  if (
    Object.hasOwn(baseHarness.read_paths, 'mobile_ux_batch1_governance') ||
    Object.hasOwn(baseHarness.governance, 'mobile_ux_batch1_governance_policy') ||
    baseHarness.compaction_keep.includes('mobile_ux_batch1_governance_state')
  ) {
    fail('foundation activation agent-harness base is not an exact inactive state');
  }
  expectedHarness.version = nextVnextVersion(
    baseHarness.version,
    'foundation agent-harness',
    23,
  );
  expectedHarness.read_paths.mobile_ux_batch1_governance = ACTIVE_HARNESS_READ_PATHS;
  expectedHarness.governance.mobile_ux_batch1_governance_policy = ACTIVE_HARNESS_POLICY;
  expectedHarness.compaction_keep.push('mobile_ux_batch1_governance_state');
  assertCanonicalDataEqual(
    readJson(root, headSha, 'spec/agent-harness.json'),
    expectedHarness,
    'foundation agent-harness',
  );

  validateFoundationDocManifestTransition(
    readJson(root, baseSha, 'spec/doc-manifest.json'),
    readJson(root, headSha, 'spec/doc-manifest.json'),
  );

  const baseAgents = readArtifact(root, baseSha, 'AGENTS.md').bytes.toString('utf8');
  const headAgents = readArtifact(root, headSha, 'AGENTS.md').bytes.toString('utf8');
  if (headAgents !== expectedActivatedAgents(baseAgents)) {
    fail('foundation AGENTS.md must contain only the five reviewed activation lines at three fixed anchors');
  }
}

export function validateInactiveGovernanceState(root, commit) {
  const authority = readJson(root, commit, 'spec/authority-map.json');
  if (
    authority === null ||
    typeof authority !== 'object' ||
    Array.isArray(authority) ||
    authority.domains === null ||
    typeof authority.domains !== 'object' ||
    Array.isArray(authority.domains) ||
    Object.hasOwn(authority.domains, 'mobile_ux_batch1_governance')
  ) {
    fail('inactive Batch 1 authority-map must not contain any mobile_ux_batch1_governance owner');
  }

  const harness = readJson(root, commit, 'spec/agent-harness.json');
  if (
    harness === null ||
    typeof harness !== 'object' ||
    Array.isArray(harness) ||
    harness.read_paths === null ||
    typeof harness.read_paths !== 'object' ||
    Array.isArray(harness.read_paths) ||
    harness.governance === null ||
    typeof harness.governance !== 'object' ||
    Array.isArray(harness.governance) ||
    !Array.isArray(harness.compaction_keep) ||
    Object.hasOwn(harness.read_paths, 'mobile_ux_batch1_governance') ||
    Object.hasOwn(harness.governance, 'mobile_ux_batch1_governance_policy') ||
    harness.compaction_keep.includes('mobile_ux_batch1_governance_state')
  ) {
    fail('inactive Batch 1 agent-harness must not contain any active governance mirror');
  }

  const manifest = readJson(root, commit, 'spec/doc-manifest.json');
  if (
    manifest === null ||
    typeof manifest !== 'object' ||
    Array.isArray(manifest) ||
    !Array.isArray(manifest.active_specs) ||
    manifest.active_specs.includes(GOVERNANCE_POLICY)
  ) {
    fail('inactive Batch 1 doc-manifest must not list the governance policy as active');
  }

  const agents = readArtifact(root, commit, 'AGENTS.md').bytes.toString('utf8').split(/\r?\n/);
  for (const line of [
    AGENTS_ACTIVE_SOURCE_LINE,
    AGENTS_READ_ORDER_LINE,
    ...AGENTS_HARD_BOUNDARY_LINES,
  ]) {
    if (agents.includes(line)) {
      fail('inactive Batch 1 AGENTS.md must not contain any activation line');
    }
  }
  return Object.freeze({status: 'inactive', commit});
}

function activeGovernanceDomainAt(root, commit) {
  const artifact = readArtifact(root, commit, 'spec/authority-map.json', {required: false});
  if (!artifact) return null;
  const authority = parseArtifactJson(artifact);
  return authority?.domains?.mobile_ux_batch1_governance ?? null;
}

function validateActiveGovernanceBase(root, baseSha) {
  const authority = readJson(root, baseSha, 'spec/authority-map.json');
  const domain = authority?.domains?.mobile_ux_batch1_governance;
  if (
    domain === null ||
    typeof domain !== 'object' ||
    Array.isArray(domain) ||
    domain.owner !== ORIGINAL_GOVERNANCE_POLICY ||
    typeof domain.protected_activation_record !== 'string'
  ) {
    fail('active Batch 1 authority owner or activation record is malformed');
  }
  const anchorInput = governanceAnchorInputAt(
    root,
    baseSha,
    domain.owner,
    domain.protected_activation_record,
  );
  if (classifyGovernanceAnchorState(anchorInput) !== 'active') {
    fail('active Batch 1 governance anchors do not form one exact active state');
  }
  validateFoundation(root, baseSha, FOUNDATION_ACTIVATION_PATHS, {activationTransition: false});
  return Object.freeze({
    state: 'active',
    anchorInput,
    policyPath: domain.owner,
    activationRecordPath: domain.protected_activation_record,
    activePolicyRecord: artifactRecord(readArtifact(root, baseSha, domain.owner)),
  });
}

function governanceAnchorInputAt(
  root,
  commit,
  policyPath = ORIGINAL_GOVERNANCE_POLICY,
  activationRecordPath = RECOVERY_FOUNDATION_ACTIVATION_DECISION,
) {
  return {
    authorityMap: readJson(root, commit, 'spec/authority-map.json'),
    agentHarness: readJson(root, commit, 'spec/agent-harness.json'),
    docManifest: readJson(root, commit, 'spec/doc-manifest.json'),
    agentsText: readArtifact(root, commit, 'AGENTS.md').bytes.toString('utf8'),
    policyPath,
    activationRecordPath,
  };
}

function treePathsUnder(root, commit, relativePrefix) {
  const result = git(
    root,
    ['ls-tree', '-r', '-z', '--name-only', commit, '--', relativePrefix],
    {buffer: true},
  );
  return result.stdout
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .sort();
}

function isGovernanceTransitionDecisionPath(relativePath) {
  if (relativePath === RECOVERY_FOUNDATION_ACTIVATION_DECISION) return true;
  const parsed = parseRecoveryDecisionPath(relativePath);
  return (
    parsed !== null &&
    ['governance_revocation', 'governance_rebootstrap'].includes(
      parsed.decisionClass,
    )
  );
}

function isImmutableGovernanceRecoveryArtifactPath(relativePath) {
  return (
    relativePath === RECOVERY_FOUNDATION_ACTIVATION_DECISION ||
    relativePath === RECOVERY_FOUNDATION_ACTIVATION_RUN_RECORD ||
    relativePath === BOOTSTRAP_RUN_RECORD ||
    parseRecoveryDecisionPath(relativePath) !== null ||
    parseRecoveryRunRecordPath(relativePath) !== null
  );
}

function firstParentSha(root, commit, label) {
  const fields = git(root, ['rev-list', '--parents', '-n', '1', commit]).stdout
    .trim()
    .split(/\s+/);
  if (fields[0] !== commit || fields.length !== 2) {
    fail(`${label} must be a one-parent squash-style commit`);
  }
  return fields[1];
}

function transitionDecisionHistoryAt(root, commit) {
  const commits = git(root, [
    'rev-list',
    '--first-parent',
    '--reverse',
    commit,
  ]).stdout.split(/\r?\n/).filter(Boolean);
  const additions = [];
  const seen = new Set();
  for (const candidate of commits) {
    const parentLine = git(root, [
      'rev-list',
      '--parents',
      '-n',
      '1',
      candidate,
    ]).stdout.trim().split(/\s+/);
    const diffArgs = parentLine.length === 1
      ? [
          'diff-tree',
          '--root',
          '--no-commit-id',
          '--name-status',
          '-z',
          '-r',
          '-M',
          '-C',
          '--find-copies-harder',
          '-l0',
          candidate,
        ]
      : [
          'diff',
          '--name-status',
          '-z',
          '-M',
          '-C',
          '--find-copies-harder',
          '-l0',
          parentLine[1],
          candidate,
        ];
    const entries = parseExactGitNameStatusZ(
      git(root, diffArgs, {buffer: true}).stdout,
      `governance transition history ${candidate}`,
    );
    for (const entry of entries) {
      const immutableRecoveryPaths = [entry.oldPath, entry.path]
        .filter((value) => value !== null)
        .filter(isImmutableGovernanceRecoveryArtifactPath);
      if (immutableRecoveryPaths.length === 0) continue;
      if (entry.status !== 'A' || entry.oldPath !== null) {
        fail(
          `historical governance recovery decisions and run records are immutable add-only artifacts: ${immutableRecoveryPaths.join(', ')}`,
        );
      }
      if (seen.has(entry.path)) {
        fail(`governance recovery artifact has multiple add introductions: ${entry.path}`);
      }
      seen.add(entry.path);
      if (isGovernanceTransitionDecisionPath(entry.path)) {
        additions.push(Object.freeze({path: entry.path, commit: candidate}));
      }
    }
  }
  for (const addition of additions) {
    if (!treeHasPath(root, commit, addition.path)) {
      fail(`historical governance transition decision is missing from trusted base: ${addition.path}`);
    }
  }
  return Object.freeze(additions);
}

function transitionDecisionPathsAt(root, commit) {
  return transitionDecisionHistoryAt(root, commit).map((entry) => entry.path);
}

function matchingRecoveryRunRecordAt(root, commit, decisionPath) {
  if (decisionPath === RECOVERY_FOUNDATION_ACTIVATION_DECISION) {
    return RECOVERY_FOUNDATION_ACTIVATION_RUN_RECORD;
  }
  const decision = parseRecoveryDecisionPath(decisionPath);
  if (!decision) fail(`cannot resolve recovery run record for ${decisionPath}`);
  const matches = treePathsUnder(root, commit, 'docs/agent-runs').filter(
    (relativePath) => {
      const runRecord = parseRecoveryRunRecordPath(relativePath);
      return (
        runRecord !== null &&
        runRecord.decisionClass === decision.decisionClass &&
        runRecord.pullRequest === decision.pullRequest &&
        runRecord.slug === decision.slug
      );
    },
  );
  if (matches.length !== 1) {
    fail(`${decisionPath} must have exactly one matching canonical recovery run record`);
  }
  return matches[0];
}

function assertVerifiedLandingInHistory(root, descendantCommit, landing, label) {
  if (landing === null || typeof landing !== 'object' || Array.isArray(landing)) {
    fail(`${label} remote landing is malformed`);
  }
  if (
    landing.repository_full_name !== TRUSTED_IDENTITY.repository ||
    landing.repository_id !== TRUSTED_IDENTITY.repositoryId ||
    landing.associated_pull_request_count !== 1
  ) {
    fail(`${label} remote landing repository or association count mismatch`);
  }
  for (const [value, field] of [
    [landing.pull_request_base_sha, 'base SHA'],
    [landing.approval_target_head_sha, 'head SHA'],
    [landing.merge_commit_sha, 'merge commit SHA'],
    [landing.complete_tree_sha, 'complete tree SHA'],
  ]) {
    assertCommit(value, `${label} ${field}`);
  }
  assertAvailableCommit(root, landing.merge_commit_sha, `${label} merge commit`);
  assertAncestor(root, landing.merge_commit_sha, descendantCommit, `${label} merge ancestry`);
  const localTree = git(
    root,
    ['rev-parse', `${landing.merge_commit_sha}^{tree}`],
  ).stdout.trim();
  if (localTree !== landing.complete_tree_sha) {
    fail(`${label} local merge tree differs from the complete remote tree`);
  }
  latestObservedAt(landing.provider_observed_at);
}

function validateFoundation(
  root,
  headSha,
  changedPaths,
  {activationTransition = true, baseSha} = {},
) {
  assertExactChangedScope(
    changedPaths,
    FOUNDATION_ACTIVATION_PATHS,
    'governance foundation activation scope',
  );
  assertExactChangedScope(
    Object.keys(FOUNDATION_ACTIVATION_RAW_SHA256),
    FOUNDATION_IMMUTABLE_SUBJECT_PATHS,
    'governance foundation pinned artifact digest map',
  );
  for (const relativePath of FOUNDATION_IMMUTABLE_SUBJECT_PATHS) {
    const artifact = readArtifact(root, headSha, relativePath);
    if (artifact.raw_sha256 !== FOUNDATION_ACTIVATION_RAW_SHA256[relativePath]) {
      fail(`governance foundation exact artifact digest drift: ${relativePath}`);
    }
  }
  if (activationTransition) {
    if (!baseSha) fail('governance foundation activation requires the exact inactive base SHA');
    validateFoundationAnchorTransition(root, baseSha, headSha);
    readArtifact(root, headSha, FOUNDATION_ACTIVATION_RUN_RECORD);
  }
  for (const forbidden of [
    ...BATCH1_SUBJECT_PATHS,
    ARTIFACT_PATHS.legacyMigrationIntent,
    ARTIFACT_PATHS.legacyMigrationReceipt,
    ARTIFACT_PATHS.legacyPreparationReceipt,
    ARTIFACT_PATHS.cohortDesignationIntent,
    ARTIFACT_PATHS.cohortDesignationReceipt,
    ARTIFACT_PATHS.cohortNonPiiAttestation,
    ARTIFACT_PATHS.manifestFreezeIntent,
    ARTIFACT_PATHS.manifestFreezeReceipt,
  ]) {
    if (changedPaths.includes(forbidden)) fail(`governance foundation cannot change ${forbidden}`);
  }
  if (changedPaths.some((entry) => entry === EXECUTION_MANIFEST_ROOT || entry.startsWith(`${EXECUTION_MANIFEST_ROOT}/`))) {
    fail('governance foundation cannot create or change execution manifests');
  }
  const policy = readJson(root, headSha, GOVERNANCE_POLICY);
  assertExactKeys(policy, [
    'schema_version',
    'governance_id',
    'layer',
    'classification',
    'status',
    'purpose',
    'authority_note',
    'activation_contract',
    'canonical_authority',
    'trusted_code_policy',
    'bootstrap_trust_transition',
    'governance_recovery_contract',
    'protected_approval_event_contract',
    'artifact_paths',
    'decision_validity_policy',
    'invalidation_condition_registry',
    'cohort_privacy_policy',
    'legacy_preparation_receipt_migration_contract',
    'resolved_requirement_schema_contract',
    'canonical_authority_keys',
    'foundation_authority',
    'foundation_non_claims',
    'reference_batch1_schema_subject',
    'stage_separation_policy',
    'fail_closed_rules',
  ], 'governance foundation policy');
  if (
    policy.schema_version !== 'mobile-ux-batch1-governance-foundation.v1' ||
    policy.governance_id !== 'mobile-ux-batch1-governance-foundation-v1' ||
    policy.layer !== 'repo_governance_truth' ||
    policy.classification !== 'implementation_hypothesis' ||
    policy.status !== 'foundation_requires_protected_approval_and_merge'
  ) {
    fail('governance foundation identity, layer, classification, or pre-activation status drift');
  }
  governancePolicyProjectionFromSpec(policy.decision_validity_policy);
  validateAuthorityMask(policy.foundation_authority, 'receipt_materialization');
  if (
    policy.canonical_authority?.repository?.repository_id !== TRUSTED_IDENTITY.repositoryId ||
    policy.canonical_authority?.workflow?.workflow_id !== TRUSTED_IDENTITY.workflowId ||
    policy.canonical_authority?.environment?.id !== TRUSTED_IDENTITY.environmentId ||
    policy.canonical_authority?.decision_owner?.immutable_id !== TRUSTED_IDENTITY.reviewerImmutableId
  ) {
    fail('governance foundation canonical immutable identities drift');
  }
  if (
    policy.canonical_authority?.repository?.full_name !== TRUSTED_IDENTITY.repository ||
    policy.canonical_authority?.repository?.protected_base_ref !== TRUSTED_IDENTITY.protectedBaseRef ||
    policy.canonical_authority?.workflow?.path !== TRUSTED_IDENTITY.workflowPath ||
    policy.canonical_authority?.workflow?.required_conclusion !== 'success' ||
    policy.canonical_authority?.environment?.name !== TRUSTED_IDENTITY.environmentName ||
    policy.canonical_authority?.environment?.administrator_bypass_allowed !== false ||
    policy.canonical_authority?.decision_owner?.login !== TRUSTED_IDENTITY.reviewerLogin ||
    policy.canonical_authority?.decision_owner?.database_id !== TRUSTED_IDENTITY.reviewerDatabaseId
  ) {
    fail('governance foundation canonical human-readable authority fields drift');
  }
  assertExactKeys(policy.trusted_code_policy, [
    'trusted_code_closure_paths',
    'pull_request_target_base_checkout_required',
    'workflow_classifier_and_validator_must_be_loaded_from_verified_base_sha',
    'workflow_classifier_and_validator_base_blob_modes_and_raw_sha256_must_be_recomputed',
    'decision_head_artifacts_may_be_read_as_untrusted_data_only',
    'decision_head_code_execution_forbidden',
    'intent_or_receipt_supplied_trusted_base_forbidden',
    'trusted_base_must_be_ancestor_of_approval_target_head',
    'missing_or_unverifiable_trusted_base_blob_fails_closed',
    'pull_request_target_action_uses_must_be_full_commit_pinned',
    'pull_request_target_permissions_must_be_exact_read_only',
    'pull_request_target_job_and_step_structure_must_match_trusted_contract',
    'pull_request_target_workflow_raw_sha256',
    'pull_request_target_workflow_all_values_and_nested_mappings_must_match_exact_closed_bytes',
    'proposed_head_workflow_must_equal_trusted_base_mode_length_and_sha256',
    'pull_request_gate_workflow_raw_sha256',
    'pull_request_gate_workflow_all_values_and_nested_mappings_must_match_exact_closed_bytes',
    'proposed_head_pull_request_gate_workflow_must_equal_trusted_base_mode_length_and_sha256',
    'pull_request_gate_action_uses_must_be_full_commit_pinned',
    'classification_and_validation_scope_source',
    'classification_and_validation_rename_copy_detection',
    'live_pull_request_files_as_classification_or_scope_truth_forbidden',
    'live_pull_request_file_status_or_previous_filename_semantics_forbidden',
    'event_head_sha_must_equal_fetched_commit',
    'live_pull_request_files_usage',
  ], 'governance foundation trusted code policy');
  if (
    JSON.stringify(policy.trusted_code_policy?.trusted_code_closure_paths) !==
      JSON.stringify(TRUSTED_CODE_CLOSURE) ||
    policy.trusted_code_policy?.pull_request_target_base_checkout_required !== true ||
    policy.trusted_code_policy?.workflow_classifier_and_validator_must_be_loaded_from_verified_base_sha !== true ||
    policy.trusted_code_policy?.workflow_classifier_and_validator_base_blob_modes_and_raw_sha256_must_be_recomputed !== true ||
    policy.trusted_code_policy?.decision_head_artifacts_may_be_read_as_untrusted_data_only !== true ||
    policy.trusted_code_policy?.decision_head_code_execution_forbidden !== true ||
    policy.trusted_code_policy?.intent_or_receipt_supplied_trusted_base_forbidden !== true ||
    policy.trusted_code_policy?.trusted_base_must_be_ancestor_of_approval_target_head !== true ||
    policy.trusted_code_policy?.missing_or_unverifiable_trusted_base_blob_fails_closed !== true ||
    policy.trusted_code_policy?.pull_request_target_action_uses_must_be_full_commit_pinned !== true ||
    policy.trusted_code_policy?.pull_request_target_permissions_must_be_exact_read_only !== true ||
    policy.trusted_code_policy?.pull_request_target_job_and_step_structure_must_match_trusted_contract !== true ||
    policy.trusted_code_policy?.pull_request_target_workflow_raw_sha256 !==
      FORMAL_APPROVAL_WORKFLOW_RAW_SHA256 ||
    policy.trusted_code_policy?.pull_request_target_workflow_all_values_and_nested_mappings_must_match_exact_closed_bytes !== true ||
    policy.trusted_code_policy?.proposed_head_workflow_must_equal_trusted_base_mode_length_and_sha256 !== true ||
    policy.trusted_code_policy?.pull_request_gate_action_uses_must_be_full_commit_pinned !== true ||
    policy.trusted_code_policy?.pull_request_gate_workflow_raw_sha256 !==
      PULL_REQUEST_GATE_WORKFLOW_RAW_SHA256 ||
    policy.trusted_code_policy?.pull_request_gate_workflow_all_values_and_nested_mappings_must_match_exact_closed_bytes !== true ||
    policy.trusted_code_policy?.proposed_head_pull_request_gate_workflow_must_equal_trusted_base_mode_length_and_sha256 !== true ||
    policy.trusted_code_policy?.classification_and_validation_scope_source !==
      'verified_base_to_exact_event_head_git_full_tree_diff' ||
    policy.trusted_code_policy?.classification_and_validation_rename_copy_detection !==
      'name_status_z_M_C_find_copies_harder_l0' ||
    policy.trusted_code_policy?.live_pull_request_files_as_classification_or_scope_truth_forbidden !== true ||
    policy.trusted_code_policy?.live_pull_request_file_status_or_previous_filename_semantics_forbidden !== true ||
    policy.trusted_code_policy?.event_head_sha_must_equal_fetched_commit !== true ||
    policy.trusted_code_policy?.live_pull_request_files_usage !==
      'current_filename_set_completeness_cross_check_only_against_exact_git_records'
  ) {
    fail('governance foundation trusted code closure or base-only policy drift');
  }
  assertExactKeys(policy.activation_contract, [
    'decision_artifact_path',
    'required_decision_class',
    'required_workflow_decision_class',
    'required_pull_request_base_ref',
    'required_trusted_base_contains_merged_bootstrap',
    'trusted_code_closure_changes_in_activation_pull_request_forbidden',
    'protected_approval_required',
    'formal_status_requires_trusted_current_run_approval_revalidation',
    'current_run_approval_revalidation_source',
    'current_run_approval_revalidation_failure_policy',
    'activation_approval_evidence_mode',
    'post_merge_active_state_revalidation',
    'post_merge_remote_activation_event_replay_claimed',
    'merge_to_protected_main_required',
    'approval_without_merge_has_gate_effect',
    'merge_without_exact_protected_approval_has_gate_effect',
    'activation_requires_exact_decision_and_spec_bytes_in_approved_head',
    'activation_requires_merged_bytes_to_equal_approved_bytes',
    'activation_requires_merge_commit_reachable_from_protected_main',
    'status_after_all_activation_requirements',
    'gate_effect_after_activation',
    'does_not_activate_any_successor_stage',
  ], 'governance activation contract');
  if (
    policy.activation_contract.decision_artifact_path !== FOUNDATION_DECISION ||
    policy.activation_contract.required_decision_class !== 'schema_definition' ||
    policy.activation_contract.required_workflow_decision_class !== 'governance_foundation' ||
    policy.activation_contract.required_pull_request_base_ref !== TRUSTED_IDENTITY.protectedBaseRef ||
    policy.activation_contract.required_trusted_base_contains_merged_bootstrap !== true ||
    policy.activation_contract.trusted_code_closure_changes_in_activation_pull_request_forbidden !== true ||
    policy.activation_contract.protected_approval_required !== true ||
    policy.activation_contract.formal_status_requires_trusted_current_run_approval_revalidation !== true ||
    policy.activation_contract.current_run_approval_revalidation_source !== 'verified_pull_request_base_sha' ||
    policy.activation_contract.current_run_approval_revalidation_failure_policy !== 'missing_mixed_wrong_attempt_noncanonical_comment_or_unverifiable_fails_closed' ||
    policy.activation_contract.activation_approval_evidence_mode !== 'trusted_current_run_gate_not_repository_receipt' ||
    policy.activation_contract.post_merge_active_state_revalidation !== 'exact_activation_bytes_on_protected_main_without_remote_approval_event_replay' ||
    policy.activation_contract.post_merge_remote_activation_event_replay_claimed !== false ||
    policy.activation_contract.merge_to_protected_main_required !== true ||
    policy.activation_contract.approval_without_merge_has_gate_effect !== 'none' ||
    policy.activation_contract.merge_without_exact_protected_approval_has_gate_effect !== 'none' ||
    policy.activation_contract.activation_requires_exact_decision_and_spec_bytes_in_approved_head !== true ||
    policy.activation_contract.activation_requires_merged_bytes_to_equal_approved_bytes !== true ||
    policy.activation_contract.activation_requires_merge_commit_reachable_from_protected_main !== true ||
    policy.activation_contract.status_after_all_activation_requirements !== 'active_repo_governance_truth' ||
    policy.activation_contract.gate_effect_after_activation !== 'mobile_ux_batch1_governance_foundation_only' ||
    policy.activation_contract.does_not_activate_any_successor_stage !== true
  ) {
    fail('governance foundation activation contract drift');
  }
  assertExactKeys(policy.bootstrap_trust_transition, [
    'trusted_validator_bootstrap_pull_request_base_sha',
    'trusted_validator_absent_from_bootstrap_base',
    'pr_a_trusted_validator_merge_required',
    'pr_a_is_governed_by_existing_base_formal_approval_workflow_only',
    'pr_a_self_validation_or_retroactive_base_validation_claim_forbidden',
    'pr_a_grants_no_activation_authority',
    'pr_b_activation_base_must_contain_pr_a_trusted_validator',
    'pr_b_activation_base_state_must_be',
    'pr_b_activation_requires_live_bootstrap_materialization_proof',
    'bootstrap_materialization_commit_must_be_derived_from_fixed_run_record_unique_add_introduction',
    'bootstrap_materialization_pull_request_must_be_uniquely_resolved_from_commit',
    'bootstrap_head_tree_must_equal_merge_tree',
    'bootstrap_run_record_merge_and_current_base_bytes_must_match',
    'pr_b_must_execute_classifier_and_validator_from_verified_base',
    'pr_b_exact_activation_scope_required',
    'pr_b_requires_exact_protected_environment_approval_independent_agent_review_green_required_gates_and_merge',
    'activated_validator_applies_only_to_later_pull_requests_whose_verified_base_contains_both_merged_stages',
    'two_stage_transition_grants_no_successor_or_product_authority',
  ], 'governance two-stage bootstrap transition');
  if (
    policy.bootstrap_trust_transition.trusted_validator_bootstrap_pull_request_base_sha !==
      BOOTSTRAP_TRUSTED_BASE_SHA ||
    policy.bootstrap_trust_transition.trusted_validator_absent_from_bootstrap_base !== true ||
    policy.bootstrap_trust_transition.pr_a_trusted_validator_merge_required !== true ||
    policy.bootstrap_trust_transition.pr_a_is_governed_by_existing_base_formal_approval_workflow_only !== true ||
    policy.bootstrap_trust_transition.pr_a_self_validation_or_retroactive_base_validation_claim_forbidden !== true ||
    policy.bootstrap_trust_transition.pr_a_grants_no_activation_authority !== true ||
    policy.bootstrap_trust_transition.pr_b_activation_base_must_contain_pr_a_trusted_validator !== true ||
    policy.bootstrap_trust_transition.pr_b_activation_base_state_must_be !== 'inactive_bootstrap_installed' ||
    policy.bootstrap_trust_transition.pr_b_activation_requires_live_bootstrap_materialization_proof !== true ||
    policy.bootstrap_trust_transition.bootstrap_materialization_commit_must_be_derived_from_fixed_run_record_unique_add_introduction !== true ||
    policy.bootstrap_trust_transition.bootstrap_materialization_pull_request_must_be_uniquely_resolved_from_commit !== true ||
    policy.bootstrap_trust_transition.bootstrap_head_tree_must_equal_merge_tree !== true ||
    policy.bootstrap_trust_transition.bootstrap_run_record_merge_and_current_base_bytes_must_match !== true ||
    policy.bootstrap_trust_transition.pr_b_must_execute_classifier_and_validator_from_verified_base !== true ||
    policy.bootstrap_trust_transition.pr_b_exact_activation_scope_required !== true ||
    policy.bootstrap_trust_transition.pr_b_requires_exact_protected_environment_approval_independent_agent_review_green_required_gates_and_merge !== true ||
    policy.bootstrap_trust_transition.activated_validator_applies_only_to_later_pull_requests_whose_verified_base_contains_both_merged_stages !== true ||
    policy.bootstrap_trust_transition.two_stage_transition_grants_no_successor_or_product_authority !== true
  ) {
    fail('governance foundation two-stage bootstrap transition drift');
  }
  const recovery = policy.governance_recovery_contract;
  assertExactKeys(recovery, [
    'schema_version',
    'decision_schema_path',
    'decision_schema_status',
    'states',
    'state_derivation_source',
    'caller_boolean_or_head_supplied_state_forbidden',
    'bootstrap_materialization_required_pull_request_base_sha',
    'bootstrap_remote_landing_base_must_equal_required_base_sha',
    'bootstrap_required_base_must_be_direct_first_parent_of_materialization_merge',
    'operations',
    'decision_classes',
    'dynamic_decision_path_contract',
    'dynamic_run_record_path_contract',
    'decision_and_matching_run_record_must_be_new_tracked_regular_100644_nonempty_files',
    'all_mobile_ux_batch1_run_records_are_permanently_sensitive_and_add_only',
    'standalone_historical_decision_or_run_record_modify_delete_copy_or_rename_fails_closed',
    'changed_artifacts_bind_every_changed_path_except_decision_itself',
    'decision_artifact_binding_source',
    'maintenance_requires_at_least_one_explicitly_allowlisted_payload',
    'maintenance_allowlist_payload_without_exact_recovery_pair_forbidden',
    'maintenance_exact_allowlist_paths',
    'maintenance_fixture_prefix',
    'recovery_maintenance_may_not_change_mobile_ux_batch1_anchor_projection_policy_product_ui_subject_intent_receipt_or_execution_manifest',
    'essential_recovery_kernel_paths',
    'bootstrap_installed_proof_kernel_snapshots',
    'essential_kernel_head_requirement',
    'formal_approval_workflow_head_structure_must_match_trusted_contract',
    'formal_approval_workflow_maintenance_in_v1_forbidden',
    'pull_request_gate_workflow_maintenance_in_v1_forbidden',
    'foundation_activation_and_every_recovery_lineage_event_require_unique_add_introduction',
    'every_lineage_event_requires_unique_associated_merged_same_repository_main_pull_request',
    'every_lineage_event_requires_approved_head_tree_equal_merge_tree_and_merge_reachable_from_trusted_base',
    'every_lineage_decision_and_run_record_merge_bytes_must_equal_current_trusted_base_mode_length_and_sha256',
    'lineage_enumeration_source',
    'historical_recovery_decision_or_run_record_delete_copy_or_rename_invalidates_state',
    'transition_commits_after_terminal_event_must_be_recomputed_and_empty',
    'foundation_lineage_event_must_replay_exact_eight_path_scope_three_immutable_hashes_dynamic_anchor_transition_and_stable_run_record',
    'anchor_integrity_scope',
    'anchor_document_version_transition',
    'cross_document_version_parity_or_fixed_activation_version_required',
    'anchor_owned_projection',
    'full_anchor_file_byte_freeze_after_revocation_forbidden',
    'unrelated_anchor_file_fields_and_lines_may_evolve_via_generic_sensitive_protected_change_when_owned_projection_is_preserved',
    'lineage_order',
    'terminal_lineage_event_must_match_derived_anchor_state',
    'revoked_state_rejects_mobile_ux_batch1_successor_receipt_execution_and_authority_decision_use',
    'revoked_state_allows_unrelated_generic_sensitive_protected_changes_when_owned_projection_remains_revoked',
    'rebootstrap_policy_mode',
    'versioned_replacement_policy_in_v1_forbidden',
    'current_run_protected_owner_approval_revalidation_required',
    'current_run_nonempty_scope_comment_required',
    'all_sixteen_authority_dimensions_false',
    'trusted_base_envelope_validation_proves',
    'trusted_base_envelope_validation_does_not_prove',
    'independent_agent_review_exact_head_protected_owner_approval_and_protected_merge_required',
    'candidate_code_becomes_future_trusted_base_only_after_protected_merge',
    'external_audited_break_glass_when_kernel_cannot_execute',
  ], 'governance recovery contract');
  const recoveryTrueKeys = [
    'caller_boolean_or_head_supplied_state_forbidden',
    'bootstrap_remote_landing_base_must_equal_required_base_sha',
    'bootstrap_required_base_must_be_direct_first_parent_of_materialization_merge',
    'decision_and_matching_run_record_must_be_new_tracked_regular_100644_nonempty_files',
    'all_mobile_ux_batch1_run_records_are_permanently_sensitive_and_add_only',
    'standalone_historical_decision_or_run_record_modify_delete_copy_or_rename_fails_closed',
    'changed_artifacts_bind_every_changed_path_except_decision_itself',
    'maintenance_requires_at_least_one_explicitly_allowlisted_payload',
    'maintenance_allowlist_payload_without_exact_recovery_pair_forbidden',
    'recovery_maintenance_may_not_change_mobile_ux_batch1_anchor_projection_policy_product_ui_subject_intent_receipt_or_execution_manifest',
    'formal_approval_workflow_head_structure_must_match_trusted_contract',
    'formal_approval_workflow_maintenance_in_v1_forbidden',
    'pull_request_gate_workflow_maintenance_in_v1_forbidden',
    'foundation_activation_and_every_recovery_lineage_event_require_unique_add_introduction',
    'every_lineage_event_requires_unique_associated_merged_same_repository_main_pull_request',
    'every_lineage_event_requires_approved_head_tree_equal_merge_tree_and_merge_reachable_from_trusted_base',
    'every_lineage_decision_and_run_record_merge_bytes_must_equal_current_trusted_base_mode_length_and_sha256',
    'historical_recovery_decision_or_run_record_delete_copy_or_rename_invalidates_state',
    'transition_commits_after_terminal_event_must_be_recomputed_and_empty',
    'foundation_lineage_event_must_replay_exact_eight_path_scope_three_immutable_hashes_dynamic_anchor_transition_and_stable_run_record',
    'full_anchor_file_byte_freeze_after_revocation_forbidden',
    'unrelated_anchor_file_fields_and_lines_may_evolve_via_generic_sensitive_protected_change_when_owned_projection_is_preserved',
    'terminal_lineage_event_must_match_derived_anchor_state',
    'revoked_state_rejects_mobile_ux_batch1_successor_receipt_execution_and_authority_decision_use',
    'revoked_state_allows_unrelated_generic_sensitive_protected_changes_when_owned_projection_remains_revoked',
    'versioned_replacement_policy_in_v1_forbidden',
    'current_run_protected_owner_approval_revalidation_required',
    'current_run_nonempty_scope_comment_required',
    'all_sixteen_authority_dimensions_false',
    'independent_agent_review_exact_head_protected_owner_approval_and_protected_merge_required',
    'candidate_code_becomes_future_trusted_base_only_after_protected_merge',
  ];
  if (
    recovery.schema_version !== 'mobile-ux-batch1-governance-recovery.v1' ||
    recovery.decision_schema_path !==
      'spec/mobile-ux-batch1-governance-recovery-decision.schema.json' ||
    recovery.bootstrap_materialization_required_pull_request_base_sha !==
      BOOTSTRAP_TRUSTED_BASE_SHA ||
    canonicalJson(recovery.states) !==
      canonicalJson(['inactive_initial', 'inactive_bootstrap_installed', 'active', 'revoked']) ||
    canonicalJson(recovery.operations) !== canonicalJson({
      bootstrap_maintenance: 'inactive_bootstrap_installed_to_inactive_bootstrap_installed',
      active_maintenance: 'active_to_active',
      revoked_recovery: 'revoked_to_revoked',
      revoke_active_governance: 'active_to_revoked',
      rebootstrap_same_policy: 'revoked_to_active',
    }) ||
    canonicalJson(recovery.decision_classes) !==
      canonicalJson(RECOVERY_DECISION_CLASSES) ||
    canonicalJson(recovery.maintenance_exact_allowlist_paths) !==
      canonicalJson(MAINTENANCE_EXACT_ALLOWLIST) ||
    recovery.maintenance_fixture_prefix !== MAINTENANCE_FIXTURE_PREFIX ||
    canonicalJson(recovery.essential_recovery_kernel_paths) !==
      canonicalJson(ESSENTIAL_RECOVERY_KERNEL_PATHS) ||
    canonicalJson(recovery.bootstrap_installed_proof_kernel_snapshots) !==
      canonicalJson({
        closure_artifacts_at_bootstrap_merge:
          'exact_essential_recovery_kernel_paths_tracked_regular_100644_nonempty',
        closure_artifacts_at_trusted_base:
          'exact_essential_recovery_kernel_paths_tracked_regular_100644_nonempty',
        byte_equality_between_snapshots_required: false,
        later_addition_after_bootstrap_merge_cannot_satisfy_bootstrap_installation:
          true,
      }) ||
    recovery.anchor_integrity_scope !== 'mobile_ux_batch1_owned_projection_only' ||
    recovery.lineage_enumeration_source !==
      'complete_trusted_base_git_history_not_current_tree_only' ||
    recovery.anchor_document_version_transition !==
      'each_base_vnext_N_to_head_vnext_N_plus_1_independently' ||
    recovery.cross_document_version_parity_or_fixed_activation_version_required !== false ||
    canonicalJson(recovery.anchor_owned_projection) !== canonicalJson([
      'authority_map_mobile_ux_batch1_governance_domain',
      'agent_harness_mobile_ux_batch1_read_path',
      'agent_harness_mobile_ux_batch1_governance_policy',
      'agent_harness_mobile_ux_batch1_compaction_anchor_count',
      'doc_manifest_mobile_ux_batch1_policy_count',
      'agents_mobile_ux_batch1_governance_heading_count',
      'agents_mobile_ux_batch1_activation_line_counts',
    ]) ||
    recovery.lineage_order !==
      'foundation_then_zero_or_more_revocation_rebootstrap_pairs' ||
    recovery.rebootstrap_policy_mode !==
      'reuse_exact_verified_revoked_policy_only' ||
    recoveryTrueKeys.some((key) => recovery[key] !== true)
  ) {
    fail('governance recovery contract drift');
  }
  const selection = policy.protected_approval_event_contract?.approval_review_selection;
  if (
    policy.protected_approval_event_contract?.current_run_approval_only_first_attempt_supported !== true ||
    policy.protected_approval_event_contract?.current_run_approval_comment_contract !==
      'approve <decision_class> PR #<number> head <40sha>' ||
    policy.protected_approval_event_contract?.current_run_approval_comment_comparison !==
      'exact_utf8_string_no_trim_case_fold_or_space_normalization' ||
    policy.protected_approval_event_contract?.current_run_failure_reapproval_policy !==
      'new_pull_request_event_run_and_new_environment_approval_required_rerun_cannot_reuse_attempt_1_approval' ||
    selection?.required_environment_id !== TRUSTED_IDENTITY.environmentId ||
    selection?.required_environment_name !== TRUSTED_IDENTITY.environmentName ||
    selection?.required_reviewer_immutable_id !== TRUSTED_IDENTITY.reviewerImmutableId ||
    selection?.non_empty_scope_comment_required !== true ||
    selection?.whitespace_only_scope_comment_forbidden !== true ||
    selection?.zero_or_multiple_matching_reviews_fail_closed !== true
  ) {
    fail('governance foundation approval review selection policy drift');
  }
  if (
    policy.protected_approval_event_contract?.deployment_status_contract?.validity_anchor_at_source !==
      'exact_remote_waiting_status.created_at' ||
    policy.protected_approval_event_contract?.deployment_status_contract?.later_inactive_status_is_not_revocation !== true ||
    policy.protected_approval_event_contract?.remote_revalidation_policy?.required_at_every_receipt_use !== true
  ) {
    fail('governance foundation remote approval event semantics drift');
  }
  if (policy.reference_batch1_schema_subject?.subject_digest !== SCHEMA_SUBJECT_DIGEST) {
    fail('governance foundation schema subject digest drift');
  }
  if (
    policy.reference_batch1_schema_subject?.reviewed_reference_head_sha !==
      '641d33c7ccb320f2e410718129e895993ce425ad' ||
    policy.reference_batch1_schema_subject?.successor_transition_digest !==
      SCHEMA_TRANSITION_DIGEST
  ) {
    fail('governance foundation reference head or transition digest drift');
  }
  const pinned = Object.fromEntries(
    (policy.reference_batch1_schema_subject?.artifact_records ?? []).map((record) => [
      record.path,
      record.raw_sha256,
    ]),
  );
  if (JSON.stringify(pinned) !== JSON.stringify(SCHEMA_SUBJECT_RAW_SHA256)) {
    fail('governance foundation schema artifact pins drift');
  }
  if (policy.resolved_requirement_schema_contract?.B2_tracked_toolchain_lock_path !== 'apps/mobile/package-lock.json') {
    fail('governance foundation must bind the tracked mobile toolchain lock');
  }
  if (
    policy.resolved_requirement_schema_contract?.R0_resolved_requirement_count !== 136 ||
    policy.resolved_requirement_schema_contract?.R0_pending_requirement_count !== 9 ||
    JSON.stringify(policy.resolved_requirement_schema_contract?.R0_exact_pending_requirement_ids) !==
      JSON.stringify(POST_DESIGNATION_REQUIREMENT_IDS) ||
    policy.resolved_requirement_schema_contract?.B2_mutable_requirement_count !== 9 ||
    policy.resolved_requirement_schema_contract?.B2_immutable_R0_requirement_count !== 136 ||
    policy.resolved_requirement_schema_contract?.remote_or_human_source_event_truth_proven_at_R0_B2_or_F3 !== false ||
    policy.resolved_requirement_schema_contract?.remote_or_human_provenance_gate_eligible !== false ||
    policy.resolved_requirement_schema_contract?.F3_receipt_materialization_and_every_later_use_revalidate_all_provenance_expiry_against_latest_provider_observation !== true ||
    policy.resolved_requirement_schema_contract?.F3_receipt_materialization_and_every_later_use_require_execution_windows_not_started_or_expired !== true ||
    policy.resolved_requirement_schema_contract?.future_provision_execution_and_evidence_require_independent_remote_source_event_revalidation !== true
  ) {
    fail('governance foundation R0/B2 exact successor counts or IDs drift');
  }
  if (
    policy.cohort_privacy_policy?.attestation_artifact_path !== ARTIFACT_PATHS.cohortNonPiiAttestation ||
    policy.cohort_privacy_policy?.classification !== 'opaque_campaign_identifier_non_pii' ||
    policy.cohort_privacy_policy?.attestation_must_be_bound_by_same_D1_protected_authority_event !== true ||
    policy.cohort_privacy_policy?.regex_match_or_repository_self_attestation_cannot_prove_non_pii !== true
  ) {
    fail('governance foundation cohort privacy policy drift');
  }
  if (
    policy.legacy_preparation_receipt_migration_contract?.historical_approval_target_head_sha !==
      '8f4f82b35b660d9a775d6551e530fe6703c3ac54' ||
    policy.legacy_preparation_receipt_migration_contract?.historical_workflow_run_id !== 31326457854 ||
    policy.legacy_preparation_receipt_migration_contract?.historical_deployment_id !== 5821110397 ||
    policy.legacy_preparation_receipt_migration_contract?.historical_subject_raw_sha256 !==
      'f51f8fc849edacc9e22517266468caff1333d6d12c1a3265cf9a85eec381c982' ||
    policy.legacy_preparation_receipt_migration_contract?.historical_intent_fabrication_forbidden !== true ||
    policy.legacy_preparation_receipt_migration_contract?.migration_intent_migration_receipt_and_preparation_receipt_pull_requests_must_all_differ !== true
  ) {
    fail('governance foundation historical migration pins drift');
  }
  if (
    policy.stage_separation_policy?.mode !== 'distinct_pr_only' ||
    policy.stage_separation_policy?.receipt_must_record_approval_target_and_materialization_pull_requests !== true ||
    policy.stage_separation_policy?.receipt_materialization_pull_request_must_equal_current_pull_request !== true ||
    policy.stage_separation_policy?.receipt_materialization_pull_request_must_differ_from_approval_target_pull_request !== true ||
    policy.stage_separation_policy?.parent_tuple_must_record_parent_receipt_materialization_pull_request !== true ||
    policy.stage_separation_policy?.parent_receipt_materialization_pull_request_must_resolve_to_remote_merge_and_unique_local_introduction_commit !== true ||
    policy.stage_separation_policy?.verified_squash_merge_commit_must_have_exactly_one_parent_equal_to_pull_request_base_sha !== true ||
    canonicalJson(policy.stage_separation_policy?.activation_pull_request_exact_changed_paths) !==
      canonicalJson(FOUNDATION_ACTIVATION_PATHS)
  ) {
    fail('governance foundation must keep distinct-PR staging and the exact activation scope');
  }
  validateResolvedRequirementSchema(readJson(root, headSha, RESOLVED_REQUIREMENT_SCHEMA));
  readArtifact(root, headSha, FOUNDATION_DECISION);
  if (activationTransition && treeHasPath(root, headSha, EXECUTION_MANIFEST_ROOT)) {
    fail('execution manifest root must remain absent in the foundation head');
  }
  return {
    stage: 'governance_foundation',
    gate_effect: 'governance_foundation_only_after_protected_approval_and_merge',
  };
}

function subjectRecords(root, commit, paths) {
  assertAvailableCommit(root, commit, 'subject commit');
  return paths.map((relativePath) => artifactRecord(readArtifact(root, commit, relativePath)));
}

function latestObservedAt(...values) {
  const timestamps = values.flat().filter(Boolean);
  if (timestamps.length === 0) fail('at least one trusted provider observation time is required');
  for (const value of timestamps) {
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) ||
      !Number.isFinite(Date.parse(value))
    ) {
      fail(`trusted provider observation time is malformed: ${value}`);
    }
  }
  return [...timestamps].sort().at(-1);
}

function assertArtifactRecordEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} artifact record drift`);
  }
}

function assertArtifactRecordsEqual(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail(`${label} artifact records drift`);
  }
}

function validateRemoteArtifactEnvelope(remoteArtifact, {commit, relativePath}) {
  if (
    remoteArtifact === null ||
    typeof remoteArtifact !== 'object' ||
    remoteArtifact.commit !== commit ||
    typeof remoteArtifact.object_id !== 'string' ||
    !SHA1_RE.test(remoteArtifact.object_id) ||
    !Buffer.isBuffer(remoteArtifact.bytes) ||
    remoteArtifact.record === null ||
    typeof remoteArtifact.record !== 'object'
  ) {
    fail(`remote Git artifact envelope mismatch for ${commit}:${relativePath}`);
  }
  const record = remoteArtifact.record;
  const recomputed = {
    path: relativePath,
    git_mode: '100644',
    byte_length: remoteArtifact.bytes.length,
    raw_sha256: sha256Hex(remoteArtifact.bytes),
  };
  assertArtifactRecordEqual(record, recomputed, `remote Git artifact ${relativePath}`);
  latestObservedAt(remoteArtifact.provider_observed_at);
  return remoteArtifact;
}

async function readHistoricalEvidence(origin, readers) {
  const [subjectArtifact, event] = await Promise.all([
    readers.readGitHubArtifact({
      repository: TRUSTED_IDENTITY.repository,
      commitSha: HISTORICAL_PREPARATION.approvalTargetHeadSha,
      artifactPath: HISTORICAL_PREPARATION.subjectPath,
    }),
    readers.readApprovalEvent({
      repository: TRUSTED_IDENTITY.repository,
      pullRequestNumber: HISTORICAL_PREPARATION.pullRequest,
      approvalTargetHeadSha: HISTORICAL_PREPARATION.approvalTargetHeadSha,
      workflowRunId: HISTORICAL_PREPARATION.workflowRunId,
      deploymentId: HISTORICAL_PREPARATION.deploymentId,
      origin,
    }),
  ]);
  validateRemoteArtifactEnvelope(subjectArtifact, {
    commit: HISTORICAL_PREPARATION.approvalTargetHeadSha,
    relativePath: HISTORICAL_PREPARATION.subjectPath,
  });
  return Object.freeze({
    subjectArtifact,
    event,
    providerObservedAt: latestObservedAt(
      subjectArtifact.provider_observed_at,
      event?.provider_observed_at,
    ),
  });
}

function falseConditionResults(kind) {
  return Object.fromEntries(
    INVALIDATION_CONDITIONS_BY_KIND[kind].map((conditionId) => [conditionId, false]),
  );
}

function receiptIntentPath(receiptPath) {
  if (receiptPath === ARTIFACT_PATHS.legacyMigrationReceipt) return ARTIFACT_PATHS.legacyMigrationIntent;
  if (receiptPath === ARTIFACT_PATHS.cohortDesignationReceipt) return ARTIFACT_PATHS.cohortDesignationIntent;
  if (receiptPath === ARTIFACT_PATHS.manifestFreezeReceipt) return ARTIFACT_PATHS.manifestFreezeIntent;
  return null;
}

function receiptKind(receiptPath) {
  if (receiptPath === ARTIFACT_PATHS.legacyMigrationReceipt) return 'legacy_receipt_migration';
  if (receiptPath === ARTIFACT_PATHS.cohortDesignationReceipt) return 'cohort_designation';
  if (receiptPath === ARTIFACT_PATHS.manifestFreezeReceipt) return 'manifest_freeze';
  return null;
}

export function createEvidenceContext(origin, readers) {
  return {
    origin,
    readers,
    historicalPromise: null,
    approvalEventPromises: new Map(),
    pullRequestMergePromises: new Map(),
    commitAssociationPromises: new Map(),
  };
}

async function contextCommitPullRequestAssociation(
  context,
  mergeCommitSha,
) {
  if (!context.commitAssociationPromises.has(mergeCommitSha)) {
    context.commitAssociationPromises.set(
      mergeCommitSha,
      context.readers.readCommitPullRequestAssociation({
        repository: TRUSTED_IDENTITY.repository,
        mergeCommitSha,
        origin: context.origin,
      }),
    );
  }
  return context.commitAssociationPromises.get(mergeCommitSha);
}

async function contextPullRequestMerge(context, receipt) {
  const key = `${receipt.pull_request}:${receipt.approval_target_head_sha}`;
  if (!context.pullRequestMergePromises.has(key)) {
    context.pullRequestMergePromises.set(
      key,
      context.readers.readPullRequestMerge({
        repository: TRUSTED_IDENTITY.repository,
        pullRequestNumber: receipt.pull_request,
        approvalTargetHeadSha: receipt.approval_target_head_sha,
        origin: context.origin,
      }),
    );
  }
  const landing = await context.pullRequestMergePromises.get(key);
  if (landing === null || typeof landing !== 'object') {
    fail('verified GitHub pull-request merge envelope is malformed');
  }
  const exactBindings = {
    repository_full_name: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    pull_request_number: receipt.pull_request,
    approval_target_head_sha: receipt.approval_target_head_sha,
  };
  for (const [field, expected] of Object.entries(exactBindings)) {
    if (landing[field] !== expected) fail(`verified pull-request merge ${field} mismatch`);
  }
  assertCommit(landing.pull_request_base_sha, 'verified pull-request merge base SHA');
  assertCommit(landing.merge_commit_sha, 'verified pull-request merge commit SHA');
  assertCommit(landing.complete_tree_sha, 'verified pull-request merge complete tree SHA');
  if (
    typeof landing.merged_at !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(landing.merged_at) ||
    !Number.isFinite(Date.parse(landing.merged_at)) ||
    new Date(landing.merged_at).toISOString().replace('.000Z', 'Z') !== landing.merged_at
  ) {
    fail('verified pull-request merge time is malformed');
  }
  latestObservedAt(landing.provider_observed_at);
  return landing;
}

async function contextReceiptMaterializationMerge(context, receipt) {
  const pullRequestNumber = receipt.receipt_materialization_pull_request;
  const key = `materialization:${pullRequestNumber}`;
  if (!context.pullRequestMergePromises.has(key)) {
    context.pullRequestMergePromises.set(
      key,
      context.readers.readPullRequestMerge({
        repository: TRUSTED_IDENTITY.repository,
        pullRequestNumber,
        origin: context.origin,
      }),
    );
  }
  const landing = await context.pullRequestMergePromises.get(key);
  if (
    landing === null ||
    typeof landing !== 'object' ||
    landing.repository_full_name !== TRUSTED_IDENTITY.repository ||
    landing.repository_id !== TRUSTED_IDENTITY.repositoryId ||
    landing.pull_request_number !== pullRequestNumber
  ) {
    fail('verified receipt materialization merge envelope is malformed or mismatched');
  }
  for (const [value, label] of [
    [landing.pull_request_base_sha, 'receipt materialization merge base SHA'],
    [landing.approval_target_head_sha, 'receipt materialization final head SHA'],
    [landing.merge_commit_sha, 'receipt materialization merge commit SHA'],
    [landing.complete_tree_sha, 'receipt materialization complete tree SHA'],
  ]) {
    assertCommit(value, label);
  }
  if (
    typeof landing.merged_at !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(landing.merged_at) ||
    new Date(landing.merged_at).toISOString().replace('.000Z', 'Z') !== landing.merged_at
  ) {
    fail('receipt materialization merge time is malformed');
  }
  latestObservedAt(landing.provider_observed_at);
  return landing;
}

async function contextHistoricalEvidence(context) {
  context.historicalPromise ??= readHistoricalEvidence(context.origin, context.readers);
  return context.historicalPromise;
}

export function approvalEventCacheKey(receipt) {
  if (receipt === null || typeof receipt !== 'object' || Array.isArray(receipt)) {
    fail('approval event cache receipt must be an object');
  }
  const pullRequest = asPositiveInteger(receipt.pull_request, 'approval event cache pull request');
  const workflowRunId = asPositiveInteger(receipt.workflow_run_id, 'approval event cache workflow run');
  const deploymentId = asPositiveInteger(receipt.deployment_id, 'approval event cache deployment');
  assertCommit(receipt.trusted_base_sha, 'approval event cache trusted base SHA');
  assertCommit(receipt.approval_target_head_sha, 'approval event cache target head SHA');
  return JSON.stringify([
    pullRequest,
    receipt.trusted_base_sha,
    receipt.approval_target_head_sha,
    workflowRunId,
    deploymentId,
  ]);
}

export async function contextApprovalEvent(context, receipt) {
  const key = approvalEventCacheKey(receipt);
  if (!context.approvalEventPromises.has(key)) {
    context.approvalEventPromises.set(
      key,
      context.readers.readApprovalEvent({
        repository: TRUSTED_IDENTITY.repository,
        pullRequestNumber: receipt.pull_request,
        pullRequestBaseSha: receipt.trusted_base_sha,
        approvalTargetHeadSha: receipt.approval_target_head_sha,
        workflowRunId: receipt.workflow_run_id,
        deploymentId: receipt.deployment_id,
        origin: context.origin,
      }),
    );
  }
  const event = await context.approvalEventPromises.get(key);
  if (event === null || typeof event !== 'object' || event.event === null || typeof event.event !== 'object') {
    fail('verified GitHub approval event envelope is malformed');
  }
  const exactBindings = {
    repository_full_name: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    pull_request_number: receipt.pull_request,
    pull_request_base_sha: receipt.trusted_base_sha,
    approval_target_head_sha: receipt.approval_target_head_sha,
    workflow_run_id: receipt.workflow_run_id,
    deployment_id: receipt.deployment_id,
  };
  for (const [field, expected] of Object.entries(exactBindings)) {
    if (event.event[field] !== expected) {
      fail(`verified GitHub approval event ${field} mismatch`);
    }
  }
  latestObservedAt(event.provider_observed_at);
  return event;
}

async function resolveApprovedLanding(root, receipt, descendantCommit, context) {
  const [event, landing] = await Promise.all([
    contextApprovalEvent(context, receipt),
    contextPullRequestMerge(context, receipt),
  ]);
  if (event.event.pull_request_base_sha !== landing.pull_request_base_sha) {
    fail('approval event and merged pull request base SHA drift');
  }
  if (Date.parse(event.event.success_observed_at) > Date.parse(landing.merged_at)) {
    fail('protected approval success must be observed no later than the pull-request merge');
  }
  assertAvailableCommit(root, landing.merge_commit_sha, 'verified pull-request merge commit');
  assertAncestor(
    root,
    landing.merge_commit_sha,
    descendantCommit,
    'verified pull-request merge ancestry',
  );
  const localTreeSha = git(root, ['rev-parse', `${landing.merge_commit_sha}^{tree}`]).stdout.trim();
  if (localTreeSha !== landing.complete_tree_sha) {
    fail('local trusted merge tree differs from the complete remote merged tree');
  }
  assertEventBaseAncestry(root, event, landing.merge_commit_sha, 'merged approval');
  return Object.freeze({
    event,
    landing,
    landingCommitSha: landing.merge_commit_sha,
    providerObservedAt: latestObservedAt(
      event.provider_observed_at,
      landing.provider_observed_at,
    ),
  });
}

async function validateReceiptMaterializationLanding(
  root,
  receipt,
  materializationCommitSha,
  context,
) {
  const landing = await contextReceiptMaterializationMerge(context, receipt);
  if (landing.merge_commit_sha !== materializationCommitSha) {
    fail('stored receipt materialization pull request does not resolve to the actual materialization commit');
  }
  assertAvailableCommit(root, materializationCommitSha, 'receipt materialization merge commit');
  const localTreeSha = git(root, ['rev-parse', `${materializationCommitSha}^{tree}`]).stdout.trim();
  if (localTreeSha !== landing.complete_tree_sha) {
    fail('local receipt materialization tree differs from the complete remote merged tree');
  }
  return landing;
}

function findUniqueArtifactIntroduction(root, descendantCommit, relativePath) {
  assertAvailableCommit(root, descendantCommit, 'artifact history descendant');
  const output = git(root, [
    'log',
    '--first-parent',
    '-m',
    '--format=%H',
    '--diff-filter=A',
    descendantCommit,
    '--',
    relativePath,
  ]).stdout;
  const commits = [...new Set(output.split(/\r?\n/).filter(Boolean))];
  if (commits.length !== 1) {
    fail(
      `${relativePath} must have exactly one first-parent materialization in trusted history; found ${commits.length}`,
    );
  }
  const materializationCommitSha = commits[0];
  const artifact = readArtifact(root, materializationCommitSha, relativePath);
  const parent = git(root, ['rev-parse', `${materializationCommitSha}^1`], {
    allowFailure: true,
  });
  if (
    parent.status === 0 &&
    readArtifact(root, parent.stdout.trim(), relativePath, {required: false}) !== null
  ) {
    fail(`${relativePath} was not introduced by its claimed materialization commit`);
  }
  const descendantArtifact = readArtifact(root, descendantCommit, relativePath);
  assertArtifactRecordEqual(
    artifactRecord(descendantArtifact),
    artifactRecord(artifact),
    `${relativePath} materialization-to-use`,
  );
  return Object.freeze({materializationCommitSha, artifact: descendantArtifact});
}

function firstParentCommitOrder(root, descendantCommit) {
  const commits = git(root, [
    'rev-list',
    '--first-parent',
    '--reverse',
    descendantCommit,
  ]).stdout.split(/\r?\n/).filter(Boolean);
  return new Map(commits.map((commit, index) => [commit, index]));
}

function assertHistoricalRecoveryDecisionIdentity(
  root,
  trustedBaseSha,
  decisionPath,
  runRecordPath,
  landing,
) {
  if (decisionPath === RECOVERY_FOUNDATION_ACTIVATION_DECISION) return;
  const parsedPath = parseRecoveryDecisionPath(decisionPath);
  const parsedRun = parseRecoveryRunRecordPath(runRecordPath);
  const decision = parseArtifactJson(
    readArtifact(root, trustedBaseSha, decisionPath),
    `${trustedBaseSha}:${decisionPath}`,
  );
  if (
    !parsedPath ||
    !parsedRun ||
    decision.schema_version !== 'mobile-ux-batch1-governance-recovery-decision.v1' ||
    decision.decision_class !== parsedPath.decisionClass ||
    decision.pull_request !== parsedPath.pullRequest ||
    decision.decision_path !== decisionPath ||
    decision.run_record_path !== runRecordPath ||
    decision.trusted_base_sha !== landing.pull_request_base_sha ||
    landing.pull_request_number !== parsedPath.pullRequest ||
    parsedRun.decisionClass !== parsedPath.decisionClass ||
    parsedRun.pullRequest !== parsedPath.pullRequest ||
    parsedRun.slug !== parsedPath.slug
  ) {
    fail(`historical recovery decision identity drift: ${decisionPath}`);
  }
  const changedPaths = exactGitClassificationPaths(
    root,
    landing.pull_request_base_sha,
    landing.merge_commit_sha,
  );
  const expectedPaths = [
    decisionPath,
    ...decision.changed_artifacts.map((record) => record.path),
  ].sort();
  assertSameStringSet(
    changedPaths,
    expectedPaths,
    `historical recovery decision scope ${decisionPath}`,
  );
  if (
    canonicalJson(decision.changed_artifacts) !==
    canonicalJson(
      changedArtifactRecords(
        root,
        landing.pull_request_base_sha,
        landing.merge_commit_sha,
        changedPaths,
        decisionPath,
      ),
    )
  ) {
    fail(`historical recovery decision artifact bindings drift: ${decisionPath}`);
  }
  const expectedPayload = [decisionPath, runRecordPath];
  if (parsedPath.decisionClass !== 'governance_maintenance') {
    expectedPayload.push(...GOVERNANCE_ANCHOR_PATHS);
  }
  assertSameStringSet(
    changedPaths,
    expectedPayload,
    `historical recovery transition exact scope ${decisionPath}`,
  );
}

async function buildGovernanceTransitionLineage(
  root,
  trustedBaseSha,
  context,
) {
  const decisionPaths = transitionDecisionPathsAt(root, trustedBaseSha);
  if (
    decisionPaths.length === 0 ||
    !decisionPaths.includes(RECOVERY_FOUNDATION_ACTIVATION_DECISION)
  ) {
    fail('governance transition lineage requires the fixed foundation activation');
  }
  const order = firstParentCommitOrder(root, trustedBaseSha);
  const materialized = [];
  for (const decisionPath of decisionPaths) {
    const decisionIntroduction = findUniqueArtifactIntroduction(
      root,
      trustedBaseSha,
      decisionPath,
    );
    const runRecordPath = matchingRecoveryRunRecordAt(
      root,
      trustedBaseSha,
      decisionPath,
    );
    const runIntroduction = findUniqueArtifactIntroduction(
      root,
      trustedBaseSha,
      runRecordPath,
    );
    if (
      decisionIntroduction.materializationCommitSha !==
      runIntroduction.materializationCommitSha
    ) {
      fail(`${decisionPath} and ${runRecordPath} must share one add-introduction merge`);
    }
    const mergeCommitSha = decisionIntroduction.materializationCommitSha;
    const landing = await contextCommitPullRequestAssociation(
      context,
      mergeCommitSha,
    );
    assertVerifiedLandingInHistory(
      root,
      trustedBaseSha,
      landing,
      `governance transition ${decisionPath}`,
    );
    if (landing.merge_commit_sha !== mergeCommitSha) {
      fail(`${decisionPath} remote merge does not equal its unique add introduction`);
    }
    const localParentSha = firstParentSha(
      root,
      mergeCommitSha,
      `governance transition ${decisionPath}`,
    );
    if (localParentSha !== landing.pull_request_base_sha) {
      fail(`${decisionPath} local merge parent does not equal the remotely verified pull-request base`);
    }
    if (decisionPath === RECOVERY_FOUNDATION_ACTIVATION_DECISION) {
      validateFoundation(
        root,
        mergeCommitSha,
        exactGitClassificationPaths(root, localParentSha, mergeCommitSha),
        {baseSha: localParentSha},
      );
    }
    assertHistoricalRecoveryDecisionIdentity(
      root,
      trustedBaseSha,
      decisionPath,
      runRecordPath,
      landing,
    );
    const parsed = parseRecoveryDecisionPath(decisionPath);
    materialized.push({
      decisionClass:
        decisionPath === RECOVERY_FOUNDATION_ACTIVATION_DECISION
          ? 'governance_foundation'
          : parsed.decisionClass,
      decisionPath,
      runRecordPath,
      mergeCommitSha,
      landing,
      order: order.get(mergeCommitSha),
      decisionArtifactAtMerge: artifactRecord(
        readArtifact(root, mergeCommitSha, decisionPath),
      ),
      decisionArtifactAtTrustedBase: artifactRecord(
        decisionIntroduction.artifact,
      ),
      runRecordArtifactAtMerge: artifactRecord(
        readArtifact(root, mergeCommitSha, runRecordPath),
      ),
      runRecordArtifactAtTrustedBase: artifactRecord(
        runIntroduction.artifact,
      ),
    });
  }
  if (materialized.some((entry) => entry.order === undefined)) {
    fail('governance transition is outside the trusted base first-parent history');
  }
  materialized.sort((left, right) => left.order - right.order);
  return Object.freeze(
    materialized.map((entry, index) => Object.freeze({
      decision_class: entry.decisionClass,
      decision_path: entry.decisionPath,
      decision_artifact_at_merge: entry.decisionArtifactAtMerge,
      decision_artifact_at_trusted_base: entry.decisionArtifactAtTrustedBase,
      decision_introduction_commit_sha: entry.mergeCommitSha,
      decision_unique_add_introduction_verified: true,
      run_record_artifact_at_merge: entry.runRecordArtifactAtMerge,
      run_record_artifact_at_trusted_base: entry.runRecordArtifactAtTrustedBase,
      run_record_introduction_commit_sha: entry.mergeCommitSha,
      run_record_unique_add_introduction_verified: true,
      materialization_pull_request: entry.landing.pull_request_number,
      materialization_head_sha: entry.landing.approval_target_head_sha,
      materialization_head_tree_sha: entry.landing.complete_tree_sha,
      merge_commit_sha: entry.mergeCommitSha,
      merge_tree_sha: entry.landing.complete_tree_sha,
      parent_merge_commit_sha:
        index === 0 ? null : materialized[index - 1].mergeCommitSha,
      remote_pull_request_merged: true,
      approved_head_tree_equals_merge_tree: true,
      merge_commit_reachable_from_trusted_base: true,
    })),
  );
}

async function buildBootstrapInstalledProof(
  root,
  trustedBaseSha,
  anchorInput,
  context,
) {
  if (
    treeHasPath(root, trustedBaseSha, RECOVERY_FOUNDATION_ACTIVATION_DECISION)
  ) {
    fail('bootstrap-installed state cannot contain the foundation activation decision');
  }
  const transitionPaths = transitionDecisionPathsAt(root, trustedBaseSha);
  const introduction = findUniqueArtifactIntroduction(
    root,
    trustedBaseSha,
    BOOTSTRAP_RUN_RECORD,
  );
  const landing = await contextCommitPullRequestAssociation(
    context,
    introduction.materializationCommitSha,
  );
  assertVerifiedLandingInHistory(
    root,
    trustedBaseSha,
    landing,
    'governance bootstrap',
  );
  if (landing.merge_commit_sha !== introduction.materializationCommitSha) {
    fail('bootstrap remote merge does not equal the run-record add introduction');
  }
  if (
    landing.pull_request_base_sha !== BOOTSTRAP_TRUSTED_BASE_SHA ||
    firstParentSha(root, landing.merge_commit_sha, 'governance bootstrap merge') !==
      BOOTSTRAP_TRUSTED_BASE_SHA
  ) {
    fail('bootstrap materialization must land directly on the immutable planned bootstrap base');
  }
  assertStrictAncestor(
    root,
    BOOTSTRAP_TRUSTED_BASE_SHA,
    landing.merge_commit_sha,
    'bootstrap planned base to merge ancestry',
  );
  assertStrictAncestor(
    root,
    BOOTSTRAP_TRUSTED_BASE_SHA,
    trustedBaseSha,
    'bootstrap planned base to trusted base ancestry',
  );
  const proof = {
    trusted_base_sha: trustedBaseSha,
    bootstrap_materialization_pull_request: landing.pull_request_number,
    bootstrap_materialization_pull_request_base_sha:
      landing.pull_request_base_sha,
    bootstrap_materialization_head_sha: landing.approval_target_head_sha,
    bootstrap_materialization_head_tree_sha: landing.complete_tree_sha,
    bootstrap_merge_commit_sha: landing.merge_commit_sha,
    bootstrap_merge_tree_sha: landing.complete_tree_sha,
    bootstrap_run_record_introduction_commit_sha:
      introduction.materializationCommitSha,
    bootstrap_run_record_unique_add_introduction_verified: true,
    bootstrap_commit_associated_pull_request_count:
      landing.associated_pull_request_count,
    remote_pull_request_merged: true,
    approved_head_tree_equals_merge_tree: true,
    bootstrap_merge_reachable_from_trusted_base: true,
    bootstrap_required_base_is_direct_first_parent_of_merge_and_strict_ancestor_of_trusted_base: true,
    inactive_anchors_verified:
      classifyGovernanceAnchorState(anchorInput) === 'inactive_anchors',
    foundation_activation_decision_path:
      RECOVERY_FOUNDATION_ACTIVATION_DECISION,
    foundation_activation_decision_present: false,
    bootstrap_run_record_artifact_at_merge: artifactRecord(
      readArtifact(
        root,
        introduction.materializationCommitSha,
        BOOTSTRAP_RUN_RECORD,
      ),
    ),
    bootstrap_run_record_artifact_at_trusted_base: artifactRecord(
      introduction.artifact,
    ),
    governance_transition_commits_after_bootstrap: transitionPaths.map(
      (relativePath) =>
        findUniqueArtifactIntroduction(root, trustedBaseSha, relativePath)
          .materializationCommitSha,
    ),
    closure_artifacts_at_bootstrap_merge: [...TRUSTED_CODE_CLOSURE]
      .sort()
      .map((relativePath) =>
        artifactRecord(
          readArtifact(
            root,
            introduction.materializationCommitSha,
            relativePath,
          ),
        ),
      ),
    closure_artifacts_at_trusted_base: [...TRUSTED_CODE_CLOSURE]
      .sort()
      .map((relativePath) =>
        artifactRecord(readArtifact(root, trustedBaseSha, relativePath)),
      ),
  };
  deriveGovernanceState({
    anchorInput,
    trustedBaseSha,
    stateProof: {kind: 'inactive_bootstrap_installed', proof},
  });
  return Object.freeze(proof);
}

function validateHistoricalRevokedPolicy(
  root,
  trustedBaseSha,
  terminalEvent,
) {
  const decision = parseArtifactJson(
    readArtifact(root, trustedBaseSha, terminalEvent.decision_path),
    `${trustedBaseSha}:${terminalEvent.decision_path}`,
  );
  const selection = decision.policy_selection;
  if (
    decision.decision_class !== 'governance_revocation' ||
    decision.operation !== 'revoke_active_governance' ||
    decision.revocation_context !== null ||
    selection === null ||
    typeof selection !== 'object' ||
    Array.isArray(selection) ||
    selection.mode !== 'revoked_policy' ||
    selection.path !== ORIGINAL_GOVERNANCE_POLICY
  ) {
    fail('terminal revocation decision does not identify the exact original active policy');
  }
  assertAvailableCommit(
    root,
    decision.trusted_base_sha,
    'terminal revocation trusted base SHA',
  );
  assertAncestor(
    root,
    decision.trusted_base_sha,
    terminalEvent.merge_commit_sha,
    'terminal revocation trusted base ancestry',
  );
  const policyAtDecisionBase = artifactRecord(
    readArtifact(
      root,
      decision.trusted_base_sha,
      selection.path,
    ),
  );
  const policyAtTrustedBase = artifactRecord(
    readArtifact(root, trustedBaseSha, selection.path),
  );
  if (
    selection.raw_sha256 !== policyAtDecisionBase.raw_sha256 ||
    canonicalJson(policyAtDecisionBase) !== canonicalJson(policyAtTrustedBase)
  ) {
    fail('revoked policy bytes drifted from the revocation trusted base');
  }
  return Object.freeze({
    path: selection.path,
    rawSha256: selection.raw_sha256,
  });
}

async function buildVerifiedRevocationState(
  root,
  trustedBaseSha,
  anchorInput,
  context,
) {
  const lineage = await buildGovernanceTransitionLineage(
    root,
    trustedBaseSha,
    context,
  );
  const terminal = lineage.at(-1);
  if (terminal.decision_class !== 'governance_revocation') {
    fail('inactive governance anchors with transition history require a terminal revocation');
  }
  const revocationContext = Object.freeze({
    decision_path: terminal.decision_path,
    raw_sha256: terminal.decision_artifact_at_merge.raw_sha256,
    materialization_pull_request: terminal.materialization_pull_request,
    materialization_head_sha: terminal.materialization_head_sha,
    materialization_head_tree_sha: terminal.materialization_head_tree_sha,
    merge_commit_sha: terminal.merge_commit_sha,
    merge_tree_sha: terminal.merge_tree_sha,
  });
  const proof = {
    trusted_base_sha: trustedBaseSha,
    revocation_context: revocationContext,
    decision_artifact_at_merge: terminal.decision_artifact_at_merge,
    decision_artifact_at_trusted_base:
      terminal.decision_artifact_at_trusted_base,
    decision_introduction_commit_sha:
      terminal.decision_introduction_commit_sha,
    decision_unique_add_introduction_verified: true,
    run_record_artifact_at_merge: terminal.run_record_artifact_at_merge,
    run_record_artifact_at_trusted_base:
      terminal.run_record_artifact_at_trusted_base,
    run_record_introduction_commit_sha:
      terminal.run_record_introduction_commit_sha,
    run_record_unique_add_introduction_verified: true,
    anchor_policy_path: ORIGINAL_GOVERNANCE_POLICY,
    anchor_projection_at_merge: governanceAnchorProjection(
      governanceAnchorInputAt(
        root,
        terminal.merge_commit_sha,
        ORIGINAL_GOVERNANCE_POLICY,
        terminal.decision_path,
      ),
    ),
    anchor_projection_at_trusted_base: governanceAnchorProjection(
      anchorInput,
    ),
    remote_pull_request_merged: true,
    approved_head_tree_equals_merge_tree: true,
    merge_commit_reachable_from_trusted_base: true,
    base_history_transition_enumeration_complete: true,
    lineage_events: lineage,
    governance_transition_commits_after_revocation: lineage
      .slice(lineage.indexOf(terminal) + 1)
      .map((event) => event.merge_commit_sha),
  };
  const revokedPolicy = validateHistoricalRevokedPolicy(
    root,
    trustedBaseSha,
    terminal,
  );
  deriveGovernanceState({
    anchorInput,
    trustedBaseSha,
    stateProof: {kind: 'revoked', proof},
  });
  return Object.freeze({
    state: 'revoked',
    anchorInput,
    policyPath: revokedPolicy.path,
    revokedPolicyRawSha256: revokedPolicy.rawSha256,
    revocationContext,
    verifiedRevocationProof: Object.freeze(proof),
  });
}

async function buildVerifiedDynamicActiveState(
  root,
  trustedBaseSha,
  activeState,
  context,
) {
  const activationPath = parseRecoveryDecisionPath(
    activeState.activationRecordPath,
  );
  if (
    !activationPath ||
    activationPath.decisionClass !== 'governance_rebootstrap'
  ) {
    fail('dynamic active governance requires a canonical rebootstrap activation record');
  }
  const lineage = await buildGovernanceTransitionLineage(
    root,
    trustedBaseSha,
    context,
  );
  const terminal = lineage.at(-1);
  if (
    terminal.decision_class !== 'governance_rebootstrap' ||
    terminal.decision_path !== activeState.activationRecordPath
  ) {
    fail('active governance activation record is not the latest verified rebootstrap lineage event');
  }
  const activationContext = Object.freeze({
    decision_path: terminal.decision_path,
    raw_sha256: terminal.decision_artifact_at_merge.raw_sha256,
    materialization_pull_request: terminal.materialization_pull_request,
    materialization_head_sha: terminal.materialization_head_sha,
    materialization_head_tree_sha: terminal.materialization_head_tree_sha,
    merge_commit_sha: terminal.merge_commit_sha,
    merge_tree_sha: terminal.merge_tree_sha,
  });
  const proof = Object.freeze({
    trusted_base_sha: trustedBaseSha,
    activation_context: activationContext,
    decision_artifact_at_merge: terminal.decision_artifact_at_merge,
    decision_artifact_at_trusted_base:
      terminal.decision_artifact_at_trusted_base,
    decision_introduction_commit_sha:
      terminal.decision_introduction_commit_sha,
    decision_unique_add_introduction_verified: true,
    run_record_artifact_at_merge: terminal.run_record_artifact_at_merge,
    run_record_artifact_at_trusted_base:
      terminal.run_record_artifact_at_trusted_base,
    run_record_introduction_commit_sha:
      terminal.run_record_introduction_commit_sha,
    run_record_unique_add_introduction_verified: true,
    remote_pull_request_merged: true,
    approved_head_tree_equals_merge_tree: true,
    merge_commit_reachable_from_trusted_base: true,
    base_history_transition_enumeration_complete: true,
    lineage_events: lineage,
    governance_transition_commits_after_activation: lineage
      .slice(lineage.indexOf(terminal) + 1)
      .map((event) => event.merge_commit_sha),
  });
  validateVerifiedActiveLineageProof(
    proof,
    activationContext,
    trustedBaseSha,
  );
  deriveGovernanceState({
    anchorInput: activeState.anchorInput,
    trustedBaseSha,
    stateProof: {kind: 'verified_rebootstrap_active', proof},
  });
  return Object.freeze({
    ...activeState,
    activationContext,
    verifiedActiveLineageProof: proof,
  });
}

async function deriveTrustedGovernanceState(root, trustedBaseSha, context) {
  const activeDomain = activeGovernanceDomainAt(root, trustedBaseSha);
  if (activeDomain !== null) {
    const activeState = validateActiveGovernanceBase(root, trustedBaseSha);
    if (
      activeState.activationRecordPath ===
      RECOVERY_FOUNDATION_ACTIVATION_DECISION
    ) {
      const lineage = await buildGovernanceTransitionLineage(
        root,
        trustedBaseSha,
        context,
      );
      if (
        lineage.length !== 1 ||
        lineage[0].decision_class !== 'governance_foundation' ||
        lineage[0].decision_path !== RECOVERY_FOUNDATION_ACTIVATION_DECISION
      ) {
        fail('fixed foundation active state requires one exact verified foundation lineage event');
      }
      return Object.freeze({...activeState, verifiedFoundationLineage: lineage});
    }
    return buildVerifiedDynamicActiveState(
      root,
      trustedBaseSha,
      activeState,
      context,
    );
  }
  validateInactiveGovernanceState(root, trustedBaseSha);
  const anchorInput = governanceAnchorInputAt(root, trustedBaseSha);
  if (classifyGovernanceAnchorState(anchorInput) !== 'inactive_anchors') {
    fail('inactive governance anchors are partial or inconsistent');
  }
  const transitions = transitionDecisionPathsAt(root, trustedBaseSha);
  if (transitions.length > 0) {
    return buildVerifiedRevocationState(
      root,
      trustedBaseSha,
      anchorInput,
      context,
    );
  }
  if (treeHasPath(root, trustedBaseSha, BOOTSTRAP_RUN_RECORD)) {
    const bootstrapInstalledProof = await buildBootstrapInstalledProof(
      root,
      trustedBaseSha,
      anchorInput,
      context,
    );
    return Object.freeze({
      state: 'inactive_bootstrap_installed',
      anchorInput,
      policyPath: ORIGINAL_GOVERNANCE_POLICY,
      activationRecordPath: RECOVERY_FOUNDATION_ACTIVATION_DECISION,
      bootstrapInstalledProof,
    });
  }
  return Object.freeze({
    state: 'inactive_initial',
    anchorInput,
    policyPath: ORIGINAL_GOVERNANCE_POLICY,
    activationRecordPath: RECOVERY_FOUNDATION_ACTIVATION_DECISION,
  });
}

function assertEventBaseAncestry(root, eventProjection, approvalTargetHeadSha, label) {
  const event = eventProjection.event;
  assertAvailableCommit(root, event.pull_request_base_sha, `${label} event base SHA`);
  assertAncestor(
    root,
    event.pull_request_base_sha,
    approvalTargetHeadSha,
    `${label} event base ancestry`,
  );
}

function validateR0DesignationSubject(root, subjectCommit) {
  const registry = readJson(root, subjectCommit, BATCH1_SUBJECT_PATHS[0]);
  if (registry.materialization?.stage_id !== 'R0_resolution_successor') {
    fail('cohort designation subject must be an exact validated R0 successor');
  }
  return validateSuccessorFromGit({
    root,
    stage: 'R0',
    currentCommit: registry.materialization.baseline_commit,
    successorCommit: subjectCommit,
    requireCanonicalOrigin: false,
  });
}

function designationBindingFromValidatedReceipt(designation) {
  return {
    decision_artifact_path: designation.receipt.decision_artifact_path,
    receipt_path: ARTIFACT_PATHS.cohortDesignationReceipt,
    approval_target_head_sha: designation.receipt.approval_target_head_sha,
    receipt_materialization_commit_sha: designation.materializationCommitSha,
    receipt_materialization_pull_request:
      designation.receipt.receipt_materialization_pull_request,
    subject_commit: designation.receipt.subject_commit,
    subject_digest_domain: designation.receipt.subject_digest_domain,
    subject_digest: designation.receipt.subject_digest,
    designated_cohort_id: designation.receipt.designated_cohort_id,
    designated_cohort_sha256: designation.receipt.designated_cohort_sha256,
    approval_instance_digest: designation.receipt.approval_instance_digest,
  };
}

function validateB2FinalFreezeSubject(root, subjectCommit, designation) {
  const registry = readJson(root, subjectCommit, BATCH1_SUBJECT_PATHS[0]);
  if (registry.materialization?.stage_id !== 'B2_post_designation_binding_successor') {
    fail('manifest freeze subject must be an exact validated B2 successor');
  }
  const r0Commit = registry.materialization.baseline_commit;
  const r0Registry = readJson(root, r0Commit, BATCH1_SUBJECT_PATHS[0]);
  return validateSuccessorFromGit({
    root,
    stage: 'B2',
    currentCommit: r0Registry.materialization?.baseline_commit,
    r0Commit,
    successorCommit: subjectCommit,
    requireCanonicalOrigin: false,
    expectedDesignationBinding: designationBindingFromValidatedReceipt(designation),
  });
}

function validateFinalSubjectFreshness(root, subjectCommit, now) {
  const trustedNow = latestObservedAt(now);
  const registrySet = readJson(root, subjectCommit, BATCH1_SUBJECT_PATHS[0]);
  const requirements = registrySet.current_requirement_registry?.requirements_by_id;
  if (requirements === null || typeof requirements !== 'object' || Array.isArray(requirements)) {
    fail('final subject requirement registry is malformed');
  }
  for (const [requirementId, requirement] of Object.entries(requirements)) {
    const expiresAt = requirement?.resolution_provenance?.expires_at;
    if (
      typeof expiresAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(expiresAt) ||
      !Number.isFinite(Date.parse(expiresAt)) ||
      new Date(expiresAt).toISOString().replace('.000Z', 'Z') !== expiresAt ||
      Date.parse(trustedNow) >= Date.parse(expiresAt)
    ) {
      fail(`final_subject_resolution_provenance_expired: ${requirementId}`);
    }
  }
  for (const requirementId of ['window-cp-ba', 'window-cp-cs', 'window-cp-web']) {
    const value = requirements[requirementId]?.resolved_value?.value;
    const startAt = value?.start_at_utc;
    const expiresAt = value?.expires_at_utc;
    if (
      typeof startAt !== 'string' ||
      typeof expiresAt !== 'string' ||
      !Number.isFinite(Date.parse(startAt)) ||
      !Number.isFinite(Date.parse(expiresAt)) ||
      new Date(startAt).toISOString().replace('.000Z', 'Z') !== startAt ||
      new Date(expiresAt).toISOString().replace('.000Z', 'Z') !== expiresAt ||
      Date.parse(trustedNow) >= Date.parse(startAt) ||
      Date.parse(trustedNow) >= Date.parse(expiresAt)
    ) {
      fail(`final_subject_execution_window_started_or_expired: ${requirementId}`);
    }
  }
  return Object.freeze({valid: true, evaluatedAt: trustedNow});
}

async function validateIntentAtCommit(
  root,
  approvalTargetCommitSha,
  kind,
  context,
  {trustedBaseSha} = {},
) {
  const decisionClass = Object.entries(INTENT_CLASS_TO_KIND)
    .find(([, mappedKind]) => mappedKind === kind)?.[0];
  if (!decisionClass) fail(`unsupported decision intent kind ${kind}`);
  assertAvailableCommit(root, approvalTargetCommitSha, `${kind} approval target commit`);
  const intentPath = DECISION_CLASS_TO_PATH[decisionClass];
  const intentArtifact = readArtifact(root, approvalTargetCommitSha, intentPath);
  const intent = parseArtifactJson(intentArtifact);
  const policyArtifact = readArtifact(root, approvalTargetCommitSha, GOVERNANCE_POLICY);
  const policySpec = parseArtifactJson(policyArtifact);
  const policy = governancePolicyProjectionFromSpec(policySpec.decision_validity_policy);
  const options = {
    policy,
    observedPolicyArtifactRecord: artifactRecord(policyArtifact),
  };
  let historical = null;
  let subjectCommit;
  if (kind === 'legacy_receipt_migration') {
    subjectCommit = intent.historical_subject_commit;
    historical = await contextHistoricalEvidence(context);
    options.observedSubjectArtifactRecords = [historical.subjectArtifact.record];
    options.historicalEventProjection = historical.event;
  } else if (kind === 'cohort_designation') {
    subjectCommit = intent.designation_subject_commit;
    options.observedSubjectArtifactRecords = subjectRecords(root, subjectCommit, BATCH1_SUBJECT_PATHS);
    const attestationArtifact = readArtifact(
      root,
      approvalTargetCommitSha,
      ARTIFACT_PATHS.cohortNonPiiAttestation,
    );
    options.privacyAttestation = parseArtifactJson(attestationArtifact);
    options.observedPrivacyAttestationArtifactRecord = artifactRecord(attestationArtifact);
  } else {
    subjectCommit = intent.final_freeze_subject_commit;
    options.observedSubjectArtifactRecords = subjectRecords(root, subjectCommit, BATCH1_SUBJECT_PATHS);
  }
  if (kind !== 'legacy_receipt_migration') {
    assertStrictAncestor(
      root,
      subjectCommit,
      approvalTargetCommitSha,
      `${kind} subject ancestry`,
    );
    const approvalTargetSubjectRecords = subjectRecords(
      root,
      approvalTargetCommitSha,
      BATCH1_SUBJECT_PATHS,
    );
    assertArtifactRecordsEqual(
      approvalTargetSubjectRecords,
      options.observedSubjectArtifactRecords,
      `${kind} subject-to-approval-target`,
    );
    if (trustedBaseSha !== undefined) {
      assertAvailableCommit(root, trustedBaseSha, `${kind} trusted subject base`);
      assertAncestor(
        root,
        subjectCommit,
        trustedBaseSha,
        `${kind} subject commit must already be in the trusted base`,
      );
      assertArtifactRecordsEqual(
        subjectRecords(root, trustedBaseSha, BATCH1_SUBJECT_PATHS),
        options.observedSubjectArtifactRecords,
        `${kind} subject-to-trusted-base`,
      );
    }
    if (kind === 'cohort_designation') {
      validateR0DesignationSubject(root, subjectCommit);
    } else {
      const registry = readJson(root, subjectCommit, BATCH1_SUBJECT_PATHS[0]);
      if (registry.materialization?.stage_id !== 'B2_post_designation_binding_successor') {
        fail('manifest freeze subject must be a B2 successor');
      }
    }
  }
  const validated = validateDecisionIntent(intent, options);
  const ownReceiptPath = {
    legacy_receipt_migration: ARTIFACT_PATHS.legacyMigrationReceipt,
    cohort_designation: ARTIFACT_PATHS.cohortDesignationReceipt,
    manifest_freeze: ARTIFACT_PATHS.manifestFreezeReceipt,
  }[kind];
  if (readArtifact(root, approvalTargetCommitSha, ownReceiptPath, {required: false}) !== null) {
    fail(`${kind} receipt must be absent from its approval target head`);
  }
  if (treeHasPath(root, approvalTargetCommitSha, EXECUTION_MANIFEST_ROOT)) {
    fail(`${kind} approval target cannot contain execution manifests`);
  }
  return Object.freeze({
    decisionClass,
    kind,
    intentPath,
    intentArtifact,
    intent,
    policyArtifact,
    policy,
    historical,
    validated,
  });
}

function buildStandardParentTuple({receipt, receiptPath, receiptArtifact, event, materializationCommitSha}) {
  const digest = computeApprovalInstanceDigest(receipt);
  if (receipt.approval_instance_digest !== digest) {
    fail('parent approval receipt digest drift');
  }
  const projected = event.event;
  const tuple = {
    parent_decision_id: receipt.decision_id,
    parent_decision_class: receipt.decision_class,
    parent_approval_target_head_sha: receipt.approval_target_head_sha,
    parent_receipt_materialization_commit_sha: materializationCommitSha,
    parent_receipt_materialization_pull_request:
      receipt.receipt_materialization_pull_request,
    parent_decision_artifact_path: receipt.decision_artifact_path,
    parent_decision_artifact_raw_sha256: receipt.decision_artifact_raw_sha256,
    parent_receipt_path: receiptPath,
    parent_receipt_raw_sha256: receiptArtifact.raw_sha256,
    parent_subject_commit: receipt.subject_commit,
    parent_subject_digest_domain: receipt.subject_digest_domain,
    parent_subject_digest: receipt.subject_digest,
    parent_repository_id: projected.repository_id,
    parent_workflow_id: projected.workflow_id,
    parent_workflow_run_id: projected.workflow_run_id,
    parent_run_attempt: projected.run_attempt,
    parent_deployment_id: projected.deployment_id,
    parent_deployment_waiting_status_id: projected.deployment_waiting_status_id,
    parent_deployment_success_status_id: projected.deployment_success_status_id,
    parent_environment_id: projected.environment_id,
    parent_environment_name: projected.environment_name,
    parent_approval_review_sha256: projected.approval_review_sha256,
    parent_reviewer_immutable_id: projected.reviewer_immutable_id,
    parent_validity_anchor_at: projected.validity_anchor_at,
    parent_success_observed_at: projected.success_observed_at,
    parent_approval_instance_digest: receipt.approval_instance_digest,
  };
  validateParentTuple(tuple);
  return Object.freeze(tuple);
}

async function validateLegacyPreparationCore(root, {
  receiptArtifact,
  preparationMaterializationCommitSha,
  visibleAtCommit,
  context,
  useTimeFloor,
  currentPullRequest,
}) {
  const receipt = parseArtifactJson(receiptArtifact);
  const migrationMaterialization = findUniqueArtifactIntroduction(
    root,
    visibleAtCommit,
    ARTIFACT_PATHS.legacyMigrationReceipt,
  );
  if (
    receipt.migration_receipt_materialization_commit_sha !==
    migrationMaterialization.materializationCommitSha
  ) {
    fail('legacy preparation receipt does not bind the actual migration receipt materialization commit');
  }
  assertStrictAncestor(
    root,
    migrationMaterialization.materializationCommitSha,
    preparationMaterializationCommitSha,
    'migration-to-preparation materialization ancestry',
  );
  const migrationAtPreparation = readArtifact(
    root,
    preparationMaterializationCommitSha,
    ARTIFACT_PATHS.legacyMigrationReceipt,
  );
  assertArtifactRecordEqual(
    artifactRecord(migrationAtPreparation),
    artifactRecord(migrationMaterialization.artifact),
    'migration receipt at preparation materialization',
  );
  const migrationApprovalReceipt = parseArtifactJson(migrationMaterialization.artifact);
  const migrationReceiptLanding = await validateReceiptMaterializationLanding(
    root,
    migrationApprovalReceipt,
    migrationMaterialization.materializationCommitSha,
    context,
  );
  const migrationLanding = await resolveApprovedLanding(
    root,
    migrationApprovalReceipt,
    migrationMaterialization.materializationCommitSha,
    context,
  );
  assertStrictAncestor(
    root,
    migrationLanding.landingCommitSha,
    migrationMaterialization.materializationCommitSha,
    'migration receipt materialization ancestry',
  );
  const intentBundle = await validateIntentAtCommit(
    root,
    migrationLanding.landingCommitSha,
    'legacy_receipt_migration',
    context,
  );
  if (currentPullRequest !== undefined && currentPullRequest === intentBundle.intent.pull_request) {
    fail('legacy preparation receipt pull request must be distinct from the migration intent pull request');
  }
  const migrationEvent = migrationLanding.event;
  const historical = intentBundle.historical ?? await contextHistoricalEvidence(context);
  const now = latestObservedAt(
    useTimeFloor,
    historical.providerObservedAt,
    migrationEvent.provider_observed_at,
    migrationLanding.landing.provider_observed_at,
    migrationReceiptLanding.provider_observed_at,
  );
  const result = validateLegacyPreparationReceipt(receipt, {
    migrationIntent: intentBundle.intent,
    migrationApprovalReceipt,
    migrationApprovalEventProjection: migrationEvent,
    refreshedMigrationEventProjection: migrationEvent,
    historicalEventProjection: historical.event,
    refreshedHistoricalEventProjection: historical.event,
    migrationDecisionArtifactRawSha256: intentBundle.intentArtifact.raw_sha256,
    migrationReceiptMaterializationCommitSha:
      migrationMaterialization.materializationCommitSha,
    observedPolicyArtifactRecord: artifactRecord(intentBundle.policyArtifact),
    observedHistoricalSubjectArtifactRecords: [historical.subjectArtifact.record],
    observedMigrationApprovalReceiptArtifactRecord:
      artifactRecord(migrationMaterialization.artifact),
    policy: intentBundle.policy,
    now,
    migrationConditionResults: falseConditionResults('legacy_receipt_migration'),
    receiptMaterializationPullRequest:
      currentPullRequest ?? receipt.receipt_materialization_pull_request,
  });
  return Object.freeze({
    receipt,
    receiptArtifact,
    preparationMaterializationCommitSha,
    migrationApprovalReceipt,
    migrationEvent,
    historical,
    policy: intentBundle.policy,
    evaluatedAt: now,
    result,
  });
}

async function validateLegacyPreparationFromHistory(
  root,
  descendantCommit,
  context,
  {useTimeFloor} = {},
) {
  const preparation = findUniqueArtifactIntroduction(
    root,
    descendantCommit,
    ARTIFACT_PATHS.legacyPreparationReceipt,
  );
  const preparationReceipt = parseArtifactJson(preparation.artifact);
  const preparationLanding = await validateReceiptMaterializationLanding(
    root,
    preparationReceipt,
    preparation.materializationCommitSha,
    context,
  );
  const validated = await validateLegacyPreparationCore(root, {
    receiptArtifact: preparation.artifact,
    preparationMaterializationCommitSha: preparation.materializationCommitSha,
    visibleAtCommit: descendantCommit,
    context,
    useTimeFloor: latestObservedAt(useTimeFloor, preparationLanding.provider_observed_at),
  });
  const parentTuple = buildLegacyPreparationParentTuple({
    receipt: validated.receipt,
    migrationApprovalReceipt: validated.migrationApprovalReceipt,
    historicalEventProjection: validated.historical.event,
    preparationReceiptArtifactRecord: artifactRecord(preparation.artifact),
    observedPreparationReceiptArtifactRecord: artifactRecord(preparation.artifact),
    preparationReceiptMaterializationCommitSha: preparation.materializationCommitSha,
  });
  return Object.freeze({...validated, parentTuple});
}

async function validateStandardReceiptCore(root, {
  receiptPath,
  receiptArtifact,
  materializationCommitSha,
  context,
  useTimeFloor,
  currentPullRequest,
  landingDescendantCommit = materializationCommitSha,
  trustedSubjectBaseSha,
}) {
  const kind = receiptKind(receiptPath);
  if (!kind) fail(`unsupported standard receipt path ${receiptPath}`);
  const receipt = parseArtifactJson(receiptArtifact);
  const landing = await resolveApprovedLanding(
    root,
    receipt,
    landingDescendantCommit,
    context,
  );
  assertStrictAncestor(
    root,
    landing.landingCommitSha,
    materializationCommitSha,
    `${kind} receipt materialization ancestry`,
  );
  const intentBundle = await validateIntentAtCommit(
    root,
    landing.landingCommitSha,
    kind,
    context,
    {trustedBaseSha: trustedSubjectBaseSha},
  );
  if (currentPullRequest !== undefined && currentPullRequest === receipt.pull_request) {
    fail('receipt materialization pull request must be distinct from its intent pull request');
  }
  const event = landing.event;
  let now = latestObservedAt(useTimeFloor, landing.providerObservedAt);
  let parentApprovalTuple = null;
  if (kind === 'cohort_designation') {
    const preparation = await validateLegacyPreparationFromHistory(
      root,
      landing.landingCommitSha,
      context,
      {useTimeFloor: now},
    );
    parentApprovalTuple = preparation.parentTuple;
    now = latestObservedAt(now, preparation.evaluatedAt);
  } else if (kind === 'manifest_freeze') {
    const designation = await validateStandardReceiptFromHistory(
      root,
      landing.landingCommitSha,
      ARTIFACT_PATHS.cohortDesignationReceipt,
      context,
      {useTimeFloor: now},
    );
    parentApprovalTuple = designation.parentTuple;
    now = latestObservedAt(now, designation.evaluatedAt);
    validateB2FinalFreezeSubject(
      root,
      intentBundle.intent.final_freeze_subject_commit,
      designation,
    );
    validateFinalSubjectFreshness(
      root,
      intentBundle.intent.final_freeze_subject_commit,
      now,
    );
  }
  const result = validateApprovalReceipt(receipt, {
    intent: intentBundle.intent,
    eventProjection: event,
    decisionArtifactRawSha256: intentBundle.intentArtifact.raw_sha256,
    parentApprovalTuple,
    policy: intentBundle.policy,
    now,
    receiptMaterializationPullRequest:
      currentPullRequest ?? receipt.receipt_materialization_pull_request,
  });
  evaluateReceiptValidity(receipt, {
    policy: intentBundle.policy,
    now,
    conditionResults: falseConditionResults(kind),
    refreshedEventProjection: event,
  });
  const parentTuple = buildStandardParentTuple({
    receipt,
    receiptPath,
    receiptArtifact,
    event,
    materializationCommitSha,
  });
  return Object.freeze({
    kind,
    receipt,
    receiptArtifact,
    materializationCommitSha,
    event,
    evaluatedAt: now,
    result,
    parentTuple,
  });
}

async function validateStandardReceiptFromHistory(
  root,
  descendantCommit,
  receiptPath,
  context,
  {useTimeFloor} = {},
) {
  const materialized = findUniqueArtifactIntroduction(root, descendantCommit, receiptPath);
  const receiptLanding = await validateReceiptMaterializationLanding(
    root,
    parseArtifactJson(materialized.artifact),
    materialized.materializationCommitSha,
    context,
  );
  return validateStandardReceiptCore(root, {
    receiptPath,
    receiptArtifact: materialized.artifact,
    materializationCommitSha: materialized.materializationCommitSha,
    context,
    useTimeFloor: latestObservedAt(useTimeFloor, receiptLanding.provider_observed_at),
  });
}

export async function validateIntent(root, baseSha, headSha, decisionClass, pullRequest, context) {
  const kind = INTENT_CLASS_TO_KIND[decisionClass];
  if (kind !== 'legacy_receipt_migration') {
    assertPathsUntouchedBetween(
      root,
      baseSha,
      headSha,
      BATCH1_SUBJECT_PATHS,
      `${kind} intent`,
    );
  }
  const bundle = await validateIntentAtCommit(root, headSha, kind, context, {
    trustedBaseSha: baseSha,
  });
  if (bundle.intent.pull_request !== pullRequest) {
    fail('decision intent pull_request does not match this pull request');
  }
  if (kind === 'cohort_designation') {
    const preparation = await validateLegacyPreparationFromHistory(root, baseSha, context);
    if (
      bundle.intent.parent_preparation_approval_instance_digest !==
      preparation.receipt.approval_instance_digest
    ) {
      fail('cohort designation intent parent preparation approval digest drift');
    }
  } else if (kind === 'manifest_freeze') {
    const designation = await validateStandardReceiptFromHistory(
      root,
      baseSha,
      ARTIFACT_PATHS.cohortDesignationReceipt,
      context,
    );
    if (
      bundle.intent.parent_designation_approval_instance_digest !==
      designation.receipt.approval_instance_digest
    ) {
      fail('manifest freeze intent parent designation approval digest drift');
    }
    validateB2FinalFreezeSubject(
      root,
      bundle.intent.final_freeze_subject_commit,
      designation,
    );
  }
  return {
    stage: decisionClass,
    subject_digest: bundle.validated.subject.digest,
    gate_effect: bundle.intent.gate_effect,
  };
}

export async function validateReceiptMaterialization(
  root,
  baseSha,
  headSha,
  changedPaths,
  pullRequest,
  context,
) {
  const receipts = changedPaths.filter((relativePath) => RECEIPT_PATHS.has(relativePath));
  if (receipts.length !== 1) fail('receipt materialization must change exactly one fixed receipt path');
  const receiptPath = receipts[0];
  if (readArtifact(root, baseSha, receiptPath, {required: false}) !== null) {
    fail('receipt materialization must add a receipt that is absent from the pull request base');
  }
  const materialized = findUniqueArtifactIntroduction(root, headSha, receiptPath);
  assertStrictAncestor(
    root,
    baseSha,
    materialized.materializationCommitSha,
    'receipt pull request materialization ancestry',
  );
  if (receiptPath === ARTIFACT_PATHS.legacyPreparationReceipt) {
    const receipt = parseArtifactJson(materialized.artifact);
    assertStrictAncestor(
      root,
      receipt.migration_receipt_materialization_commit_sha,
      baseSha,
      'migration receipt must be materialized in a strict ancestor of the preparation base',
    );
    const validated = await validateLegacyPreparationCore(root, {
      receiptArtifact: materialized.artifact,
      preparationMaterializationCommitSha: materialized.materializationCommitSha,
      visibleAtCommit: headSha,
      context,
      currentPullRequest: pullRequest,
    });
    return {
      stage: 'receipt_materialization',
      approval_instance_digest: validated.result.approval_instance_digest,
      gate_effect: validated.receipt.gate_effect,
    };
  }
  const validated = await validateStandardReceiptCore(root, {
    receiptPath,
    receiptArtifact: materialized.artifact,
    materializationCommitSha: materialized.materializationCommitSha,
    context,
    currentPullRequest: pullRequest,
    landingDescendantCommit: baseSha,
    trustedSubjectBaseSha: baseSha,
  });
  return {
    stage: 'receipt_materialization',
    approval_instance_digest: validated.result.approval_instance_digest,
    gate_effect: validated.receipt.gate_effect,
  };
}

export async function validateSubjectChange(root, baseSha, headSha, context) {
  const registry = readJson(root, headSha, BATCH1_SUBJECT_PATHS[0]);
  const exactSchema = BATCH1_SUBJECT_PATHS.every(
    (relativePath) => readArtifact(root, headSha, relativePath).raw_sha256 === SCHEMA_SUBJECT_RAW_SHA256[relativePath],
  );
  if (exactSchema) {
    for (const receiptPath of RECEIPT_PATHS) {
      if (readArtifact(root, headSha, receiptPath, {required: false}) !== null) {
        fail('exact schema import must precede every Batch 1 approval receipt');
      }
    }
    return validateSuccessorFromGit({
      root,
      stage: 'schema',
      successorCommit: headSha,
      requireCanonicalOrigin: false,
    });
  }
  const stageId = registry.materialization?.stage_id;
  if (stageId === 'R0_resolution_successor') {
    const schemaBaselineCommit = registry.materialization.baseline_commit;
    assertAvailableCommit(root, schemaBaselineCommit, 'R0 schema baseline commit');
    assertAncestor(
      root,
      schemaBaselineCommit,
      baseSha,
      'R0 schema baseline must already be in the trusted base',
    );
    assertArtifactRecordsEqual(
      subjectRecords(root, baseSha, BATCH1_SUBJECT_PATHS),
      subjectRecords(root, schemaBaselineCommit, BATCH1_SUBJECT_PATHS),
      'R0 trusted-base schema state',
    );
    await validateLegacyPreparationFromHistory(root, baseSha, context);
    return validateSuccessorFromGit({
      root,
      stage: 'R0',
      currentCommit: registry.materialization.baseline_commit,
      successorCommit: headSha,
      requireCanonicalOrigin: false,
    });
  }
  if (stageId === 'B2_post_designation_binding_successor') {
    const designation = await validateStandardReceiptFromHistory(
      root,
      baseSha,
      ARTIFACT_PATHS.cohortDesignationReceipt,
      context,
    );
    const r0Commit = registry.materialization.baseline_commit;
    assertAvailableCommit(root, r0Commit, 'B2 R0 baseline commit');
    assertAncestor(
      root,
      r0Commit,
      baseSha,
      'B2 R0 baseline must already be in the trusted base',
    );
    assertArtifactRecordsEqual(
      subjectRecords(root, baseSha, BATCH1_SUBJECT_PATHS),
      subjectRecords(root, r0Commit, BATCH1_SUBJECT_PATHS),
      'B2 trusted-base R0 state',
    );
    const r0Registry = readJson(root, r0Commit, BATCH1_SUBJECT_PATHS[0]);
    const expectedDesignationBinding = {
      decision_artifact_path: designation.receipt.decision_artifact_path,
      receipt_path: ARTIFACT_PATHS.cohortDesignationReceipt,
      approval_target_head_sha: designation.receipt.approval_target_head_sha,
      receipt_materialization_commit_sha: designation.materializationCommitSha,
      receipt_materialization_pull_request:
        designation.receipt.receipt_materialization_pull_request,
      subject_commit: designation.receipt.subject_commit,
      subject_digest_domain: designation.receipt.subject_digest_domain,
      subject_digest: designation.receipt.subject_digest,
      designated_cohort_id: designation.receipt.designated_cohort_id,
      designated_cohort_sha256: designation.receipt.designated_cohort_sha256,
      approval_instance_digest: designation.receipt.approval_instance_digest,
    };
    return validateSuccessorFromGit({
      root,
      stage: 'B2',
      currentCommit: r0Registry.materialization?.baseline_commit,
      r0Commit,
      successorCommit: headSha,
      requireCanonicalOrigin: false,
      expectedDesignationBinding,
    });
  }
  fail('Batch 1 subject change is neither exact schema import nor a valid R0/B2 successor');
}

function assertRecoveryAnchorHead(root, headSha, expected, label) {
  assertCanonicalDataEqual(
    readJson(root, headSha, 'spec/authority-map.json'),
    expected.authorityMap,
    `${label} authority-map`,
  );
  assertCanonicalDataEqual(
    readJson(root, headSha, 'spec/agent-harness.json'),
    expected.agentHarness,
    `${label} agent-harness`,
  );
  assertCanonicalDataEqual(
    readJson(root, headSha, 'spec/doc-manifest.json'),
    expected.docManifest,
    `${label} doc-manifest`,
  );
  const agentsText = readArtifact(root, headSha, 'AGENTS.md').bytes.toString('utf8');
  if (agentsText !== expected.agentsText) {
    fail(`${label} AGENTS.md transition drift`);
  }
}

async function validateRecoveryPullRequest(
  root,
  baseSha,
  headSha,
  decisionClass,
  changedPaths,
  pullRequest,
  baseState,
) {
  const decisionPaths = changedPaths.filter(
    (relativePath) => parseRecoveryDecisionPath(relativePath) !== null,
  );
  if (decisionPaths.length !== 1) {
    fail(`${decisionClass} requires exactly one recovery decision artifact`);
  }
  const decisionPath = decisionPaths[0];
  const decision = parseArtifactJson(
    readArtifact(root, headSha, decisionPath),
    `${headSha}:${decisionPath}`,
  );
  const anchorInput = {
    ...baseState.anchorInput,
    policyPath: baseState.policyPath,
    activationRecordPath:
      decisionClass === 'governance_rebootstrap'
        ? decisionPath
        : baseState.anchorInput.activationRecordPath,
  };
  const recoveryContext = {
    decisionPath,
    pullRequest,
    trustedBaseSha: baseSha,
    changedPaths: [...changedPaths].sort(),
    actualArtifactRecords: changedArtifactRecords(
      root,
      baseSha,
      headSha,
      changedPaths,
      decisionPath,
    ),
    anchorInput,
    stateProof:
      baseState.state === 'inactive_bootstrap_installed'
        ? {
            kind: 'inactive_bootstrap_installed',
            proof: baseState.bootstrapInstalledProof,
          }
        : baseState.state === 'revoked'
          ? {kind: 'revoked', proof: baseState.verifiedRevocationProof}
          : baseState.state === 'active' &&
              baseState.verifiedActiveLineageProof
            ? {
                kind: 'verified_rebootstrap_active',
                proof: baseState.verifiedActiveLineageProof,
              }
          : undefined,
    activePolicyPath:
      baseState.state === 'active' ? baseState.policyPath : undefined,
    activePolicyRawSha256:
      baseState.state === 'active'
        ? baseState.activePolicyRecord.raw_sha256
        : undefined,
    revokedPolicyPath:
      baseState.state === 'revoked' ? baseState.policyPath : undefined,
    revokedPolicyRawSha256:
      baseState.state === 'revoked'
        ? baseState.revokedPolicyRawSha256
        : undefined,
  };
  const result = validateRecoveryDecision(decision, recoveryContext);

  if (decisionClass === 'governance_revocation') {
    const expected = buildRevocationAnchorTransition(anchorInput);
    assertRecoveryAnchorHead(root, headSha, expected, 'governance revocation');
  } else if (decisionClass === 'governance_rebootstrap') {
    const expected = buildRebootstrapAnchorTransition(anchorInput, {
      trustedBaseSha: baseSha,
      verifiedRevocationProof: baseState.verifiedRevocationProof,
    });
    assertRecoveryAnchorHead(root, headSha, expected, 'governance rebootstrap');
  }
  return Object.freeze({
    stage: result.decision_class,
    operation: result.operation,
    base_state: result.base_state,
    target_state: result.target_state,
    gate_effect: result.gate_effect,
    recovery_decision_path: decisionPath,
  });
}

export async function validatePullRequest(options, dependencies = {}) {
  const root = path.resolve(options.root ?? ROOT);
  if (dependencies === null || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
    fail('trusted validation reader dependencies must be a plain object');
  }
  const readers = {
    readApprovalEvent:
      dependencies.readApprovalEvent ?? readVerifiedGitHubApprovalEvent,
    readGitHubArtifact:
      dependencies.readGitHubArtifact ?? readVerifiedGitHubArtifact,
    readPullRequestMerge:
      dependencies.readPullRequestMerge ?? readVerifiedGitHubPullRequestMerge,
    readCommitPullRequestAssociation:
      dependencies.readCommitPullRequestAssociation ??
      readVerifiedGitHubCommitPullRequestAssociation,
  };
  if (
    typeof readers.readApprovalEvent !== 'function' ||
    typeof readers.readGitHubArtifact !== 'function' ||
    typeof readers.readPullRequestMerge !== 'function' ||
    typeof readers.readCommitPullRequestAssociation !== 'function'
  ) {
    fail('trusted validation readers must be functions');
  }
  for (const key of Object.keys(dependencies)) {
    if (![
      'readApprovalEvent',
      'readGitHubArtifact',
      'readPullRequestMerge',
      'readCommitPullRequestAssociation',
    ].includes(key)) {
      fail(`unknown trusted validation reader dependency ${key}`);
    }
  }
  if (options.repository !== TRUSTED_IDENTITY.repository) fail('repository full name mismatch');
  if (Number(options.repositoryId) !== TRUSTED_IDENTITY.repositoryId) fail('repository immutable id mismatch');
  if (options.baseRef !== TRUSTED_IDENTITY.protectedBaseRef) fail('pull request base ref must be protected main');
  const pullRequest = asPositiveInteger(options.pullRequest, 'pull request');
  assertAvailableCommit(root, options.baseSha, 'base SHA');
  assertAvailableCommit(root, options.headSha, 'head SHA');
  if (git(root, ['rev-parse', 'HEAD']).stdout.trim() !== options.baseSha) {
    fail('trusted validator must execute from the exact checked-out base SHA');
  }
  const trustedCodeRecords = validateTrustedCodeClosure(root, options.baseSha);
  assertAncestor(root, options.baseSha, options.headSha, 'trusted base ancestry');
  assertCanonicalRemote(root, options.origin);

  const files = readGitHubFiles(options.githubFiles, options.expectedCount);
  const exactGitView = exactGitChangedFileView(
    root,
    options.baseSha,
    options.headSha,
  );
  assertSameStringSet(
    exactGitView.currentPaths,
    files.currentPaths,
    'GitHub completeness versus exact event-head Git changed paths',
  );
  if (exactGitView.currentPaths.includes(TRUSTED_IDENTITY.workflowPath)) {
    const baseWorkflow = readArtifact(
      root,
      options.baseSha,
      TRUSTED_IDENTITY.workflowPath,
    );
    const headWorkflow = readArtifact(
      root,
      options.headSha,
      TRUSTED_IDENTITY.workflowPath,
    );
    validateFormalApprovalWorkflowStructure(headWorkflow.bytes.toString('utf8'));
    assertArtifactRecordEqual(
      artifactRecord(headWorkflow),
      artifactRecord(baseWorkflow),
      'proposed formal approval workflow versus trusted base',
    );
  }
  if (exactGitView.currentPaths.includes(PULL_REQUEST_GATE_WORKFLOW_PATH)) {
    const baseWorkflow = readArtifact(
      root,
      options.baseSha,
      PULL_REQUEST_GATE_WORKFLOW_PATH,
    );
    const headWorkflow = readArtifact(
      root,
      options.headSha,
      PULL_REQUEST_GATE_WORKFLOW_PATH,
    );
    validatePullRequestGateWorkflowStructure(headWorkflow.bytes.toString('utf8'));
    assertArtifactRecordEqual(
      artifactRecord(headWorkflow),
      artifactRecord(baseWorkflow),
      'proposed pull-request gate workflow versus trusted base',
    );
  }
  if (
    exactGitView.classificationPaths.some(
      (entry) => entry === EXECUTION_MANIFEST_ROOT || entry.startsWith(`${EXECUTION_MANIFEST_ROOT}/`),
    )
  ) {
    fail('execution manifests require a dedicated future authorization class and are globally forbidden');
  }
  const classification = classifyFormalApprovalScope(
    exactGitView.classificationPaths,
  );
  if (classification.classification_error !== null) {
    fail(`classification failed closed: ${classification.classification_error}`);
  }
  if (classification.decision_class !== options.decisionClass) {
    fail(`decision class mismatch: recomputed=${classification.decision_class} supplied=${options.decisionClass}`);
  }
  if (!classification.trusted_validation_required) {
    fail('validate-pr may only be invoked for a trusted-validation-required class');
  }
  const canonicalRunRecord = assertDecisionChangedScope(
    options.decisionClass,
    exactGitView.classificationPaths,
  );
  assertCanonicalRunRecordConsumption(
    exactGitView.classificationPaths,
    canonicalRunRecord,
  );
  if (canonicalRunRecord !== null) {
    assertNewCanonicalRunRecord(
      root,
      options.baseSha,
      options.headSha,
      exactGitView,
      canonicalRunRecord,
    );
  }
  if (RECOVERY_DECISION_CLASSES.includes(options.decisionClass)) {
    const recoveryDecisionPaths = exactGitView.currentPaths.filter(
      (relativePath) => parseRecoveryDecisionPath(relativePath) !== null,
    );
    if (recoveryDecisionPaths.length !== 1) {
      fail(`${options.decisionClass} requires one current canonical recovery decision artifact`);
    }
    assertNewRecoveryDecision(
      root,
      options.baseSha,
      options.headSha,
      exactGitView,
      recoveryDecisionPaths[0],
    );
  }
  const context = createEvidenceContext(options.origin, readers);
  const baseState = await deriveTrustedGovernanceState(
    root,
    options.baseSha,
    context,
  );
  const isRecoveryDecision = RECOVERY_DECISION_CLASSES.includes(
    options.decisionClass,
  );
  const isSpecializedBatch1Decision =
    options.decisionClass === 'batch1_subject_change' ||
    options.decisionClass === 'receipt_materialization' ||
    Object.hasOwn(DECISION_CLASS_TO_PATH, options.decisionClass);

  if (options.decisionClass === 'governance_foundation') {
    if (baseState.state !== 'inactive_bootstrap_installed') {
      fail(
        'governance foundation activation requires an exact verified inactive_bootstrap_installed trusted base',
      );
    }
  } else if (!isRecoveryDecision) {
    if (isSpecializedBatch1Decision && baseState.state !== 'active') {
      fail('specialized Batch 1 validation requires an active governance owner in the trusted base');
    }
    if (baseState.state === 'active') {
      const headState = validateActiveGovernanceBase(root, options.headSha);
      if (
        canonicalJson(governanceAnchorProjection(headState.anchorInput)) !==
        canonicalJson(governanceAnchorProjection(baseState.anchorInput))
      ) {
        fail('non-recovery pull request changed the Batch 1-owned active anchor projection');
      }
    } else {
      validateInactiveGovernanceState(root, options.headSha);
      const headAnchorInput = governanceAnchorInputAt(
        root,
        options.headSha,
        baseState.policyPath,
        baseState.activationRecordPath,
      );
      if (
        canonicalJson(governanceAnchorProjection(headAnchorInput)) !==
        canonicalJson(governanceAnchorProjection(baseState.anchorInput))
      ) {
        fail('non-recovery pull request changed the Batch 1-owned inactive anchor projection');
      }
    }
  }

  let detail;
  if (options.decisionClass === 'generic_sensitive') {
    detail = {stage: 'generic_sensitive', gate_effect: 'protected_approval_only'};
  } else if (options.decisionClass === 'governance_foundation') {
    detail = validateFoundation(root, options.headSha, exactGitView.classificationPaths, {
      baseSha: options.baseSha,
    });
  } else if (isRecoveryDecision) {
    detail = await validateRecoveryPullRequest(
      root,
      options.baseSha,
      options.headSha,
      options.decisionClass,
      exactGitView.classificationPaths,
      pullRequest,
      baseState,
    );
  } else if (options.decisionClass === 'batch1_subject_change') {
    detail = await validateSubjectChange(root, options.baseSha, options.headSha, context);
  } else if (Object.hasOwn(DECISION_CLASS_TO_PATH, options.decisionClass)) {
    detail = await validateIntent(
      root,
      options.baseSha,
      options.headSha,
      options.decisionClass,
      pullRequest,
      context,
    );
  } else if (options.decisionClass === 'receipt_materialization') {
    detail = await validateReceiptMaterialization(
      root,
      options.baseSha,
      options.headSha,
      exactGitView.classificationPaths,
      pullRequest,
      context,
    );
  } else {
    fail(`unsupported trusted decision class ${options.decisionClass}`);
  }
  return {
    schema_version: 'mobile-ux-batch1-trusted-pr-validation.v1',
    status: 'passed',
    repository: TRUSTED_IDENTITY.repository,
    pull_request: pullRequest,
    base_sha: options.baseSha,
    head_sha: options.headSha,
    decision_class: options.decisionClass,
    governance_base_state: baseState.state,
    trusted_code_artifact_records: trustedCodeRecords,
    ...detail,
    non_claim:
      'trusted PR validation grants no product, visual, implementation, native, release, or leadership-readiness authority',
  };
}

export async function verifyCurrentRunApproval(options, dependencies = {}) {
  const root = path.resolve(options.root ?? ROOT);
  if (dependencies === null || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
    fail('current-run approval reader dependencies must be a plain object');
  }
  for (const key of Object.keys(dependencies)) {
    if (key !== 'readCurrentRunApproval') {
      fail(`unknown current-run approval reader dependency ${key}`);
    }
  }
  const readCurrentRunApproval =
    dependencies.readCurrentRunApproval ?? readVerifiedGitHubCurrentRunApproval;
  if (typeof readCurrentRunApproval !== 'function') {
    fail('trusted current-run approval reader must be a function');
  }
  if (options.repository !== TRUSTED_IDENTITY.repository) fail('repository full name mismatch');
  if (Number(options.repositoryId) !== TRUSTED_IDENTITY.repositoryId) {
    fail('repository immutable id mismatch');
  }
  if (options.baseRef !== TRUSTED_IDENTITY.protectedBaseRef) {
    fail('pull request base ref must be protected main');
  }
  const pullRequest = asPositiveInteger(options.pullRequest, 'pull request');
  const workflowRunId = asPositiveInteger(options.workflowRunId, 'workflow run id');
  const workflowRunAttempt = asPositiveInteger(
    options.workflowRunAttempt,
    'workflow run attempt',
  );
  if (workflowRunAttempt !== 1) {
    fail('current-run approval v1 supports only workflow run attempt 1');
  }
  if (!PROTECTED_APPROVAL_DECISION_CLASSES.includes(options.decisionClass)) {
    fail('current-run approval decision class is unsupported');
  }
  assertAvailableCommit(root, options.baseSha, 'base SHA');
  assertAvailableCommit(root, options.headSha, 'head SHA');
  if (git(root, ['rev-parse', 'HEAD']).stdout.trim() !== options.baseSha) {
    fail('current-run approval verifier must execute from the exact checked-out base SHA');
  }
  const trustedCodeRecords = validateTrustedCodeClosure(root, options.baseSha);
  assertAncestor(root, options.baseSha, options.headSha, 'trusted base ancestry');
  assertCanonicalRemote(root, options.origin);

  const approval = await readCurrentRunApproval({
    repository: options.repository,
    pullRequestNumber: pullRequest,
    pullRequestBaseSha: options.baseSha,
    approvalTargetHeadSha: options.headSha,
    workflowRunId,
    workflowRunAttempt,
    decisionClass: options.decisionClass,
    origin: options.origin,
  });
  if (
    approval?.schema_version !== 'mobile-ux-batch1-current-run-approval-verification.v1' ||
    approval?.repository !== TRUSTED_IDENTITY.repository ||
    approval?.repository_id !== TRUSTED_IDENTITY.repositoryId ||
    approval?.pull_request !== pullRequest ||
    approval?.pull_request_base_ref !== TRUSTED_IDENTITY.protectedBaseRef ||
    approval?.pull_request_base_sha !== options.baseSha ||
    approval?.approval_target_head_sha !== options.headSha ||
    approval?.workflow_path !== TRUSTED_IDENTITY.workflowPath ||
    approval?.workflow_id !== TRUSTED_IDENTITY.workflowId ||
    approval?.workflow_run_id !== workflowRunId ||
    approval?.run_attempt !== 1 ||
    approval?.run_attempt !== workflowRunAttempt ||
    approval?.decision_class !== options.decisionClass ||
    approval?.environment_id !== TRUSTED_IDENTITY.environmentId ||
    approval?.environment_name !== TRUSTED_IDENTITY.environmentName ||
    approval?.reviewer_immutable_id !== TRUSTED_IDENTITY.reviewerImmutableId ||
    typeof approval?.approval_review_sha256 !== 'string' ||
    !/^[0-9a-f]{64}$/.test(approval.approval_review_sha256) ||
    typeof approval?.provider_observed_at !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(approval.provider_observed_at) ||
    !Number.isFinite(Date.parse(approval.provider_observed_at)) ||
    new Date(approval.provider_observed_at).toISOString().replace('.000Z', 'Z') !==
      approval.provider_observed_at
  ) {
    fail('trusted current-run approval projection is incomplete or mismatched');
  }
  return {
    ...approval,
    status: 'passed',
    trusted_code_artifact_records: trustedCodeRecords,
    non_claim:
      'current-run approval verification grants only this exact protected governance gate and no product, visual, implementation, native, release, or leadership-readiness authority',
  };
}

const COMMAND_ARGUMENTS = Object.freeze({
  'validate-pr': Object.freeze({
    '--repository': 'repository',
    '--repository-id': 'repositoryId',
    '--origin': 'origin',
    '--pull-request': 'pullRequest',
    '--base-ref': 'baseRef',
    '--base-sha': 'baseSha',
    '--head-sha': 'headSha',
    '--decision-class': 'decisionClass',
    '--github-files': 'githubFiles',
    '--expected-count': 'expectedCount',
  }),
  'verify-current-run-approval': Object.freeze({
    '--repository': 'repository',
    '--repository-id': 'repositoryId',
    '--origin': 'origin',
    '--pull-request': 'pullRequest',
    '--base-ref': 'baseRef',
    '--base-sha': 'baseSha',
    '--head-sha': 'headSha',
    '--workflow-run-id': 'workflowRunId',
    '--workflow-run-attempt': 'workflowRunAttempt',
    '--decision-class': 'decisionClass',
  }),
});

export function parseCommandArgs(argv) {
  const command = argv[0];
  const commandMapping = COMMAND_ARGUMENTS[command];
  if (!commandMapping) {
    fail('first argument must be validate-pr or verify-current-run-approval');
  }
  const options = {root: ROOT};
  const mapping = {
    '--root': 'root',
    ...commandMapping,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    const key = mapping[argument];
    if (!key) fail(`unknown argument: ${argument}`);
    const value = argv[++index];
    if (!value || value.startsWith('--')) fail(`${argument} requires a value`);
    options[key] = key === 'root' ? path.resolve(value) : value;
  }
  for (const key of Object.values(mapping).filter((key) => key !== 'root')) {
    if (options[key] === undefined) fail(`missing required option ${key}`);
  }
  return {command, options};
}

async function main() {
  try {
    const {command, options} = parseCommandArgs(process.argv.slice(2));
    const result = command === 'validate-pr'
      ? await validatePullRequest(options)
      : await verifyCurrentRunApproval(options);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(
      `MOBILE UX BATCH1 TRUSTED VALIDATION FAILED: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

function isDirectExecution() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]);
  } catch {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  }
}

if (isDirectExecution()) {
  await main();
}
