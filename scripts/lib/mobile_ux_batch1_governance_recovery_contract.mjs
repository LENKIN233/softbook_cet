import {createHash} from 'node:crypto';

export const RECOVERY_SCHEMA_VERSION =
  'mobile-ux-batch1-governance-recovery-decision.v1';

export const RECOVERY_DECISION_CLASSES = Object.freeze([
  'governance_maintenance',
  'governance_revocation',
  'governance_rebootstrap',
]);

export const GOVERNANCE_STATES = Object.freeze([
  'inactive_initial',
  'inactive_bootstrap_installed',
  'active',
  'revoked',
]);

export const AUTHORITY_KEYS = Object.freeze([
  'freeze',
  'reservation_activation',
  'manifest_creation',
  'provision',
  'execution',
  'evidence',
  'data_manifest_population',
  'aggregation',
  'promotion',
  'architecture_acceptance',
  'checkpoint_coverage',
  'visual',
  'implementation',
  'native',
  'release',
  'leadership_readiness',
]);

export const ZERO_AUTHORITY = Object.freeze(
  Object.fromEntries(AUTHORITY_KEYS.map((key) => [key, false])),
);

export const RECOVERY_NON_CLAIMS = Object.freeze([
  'no_product_authority',
  'no_visual_authority',
  'no_implementation_authority',
  'no_native_authority',
  'no_release_authority',
  'no_leadership_readiness_authority',
  'head_artifacts_are_untrusted_data_only',
  'trusted_base_validation_does_not_prove_head_code_semantics_safety_or_future_operability',
  'independent_agent_review_and_exact_head_protected_owner_approval_are_required',
  'candidate_code_becomes_a_trust_base_only_after_protected_merge',
]);

export const TRUSTED_IDENTITY = Object.freeze({
  repository: 'LENKIN233/softbook_cet',
  repositoryId: 1216764160,
  protectedBaseRef: 'refs/heads/main',
  environmentId: 18348068326,
  environmentName: 'formal-product-owner-approval',
  reviewerImmutableId: 'github:LENKIN233#113219944',
});

export const REQUIRED_CURRENT_RUN_GATE = Object.freeze({
  environment_id: TRUSTED_IDENTITY.environmentId,
  environment_name: TRUSTED_IDENTITY.environmentName,
  reviewer_immutable_id: TRUSTED_IDENTITY.reviewerImmutableId,
  non_empty_scope_comment_required: true,
  approval_without_merge_has_effect: false,
  merge_required: true,
  head_code_execution_forbidden: true,
});

export const GOVERNANCE_ANCHOR_PATHS = Object.freeze([
  'AGENTS.md',
  'spec/agent-harness.json',
  'spec/authority-map.json',
  'spec/doc-manifest.json',
]);

export const ORIGINAL_GOVERNANCE_POLICY =
  'spec/mobile-ux-batch1-governance.json';
export const FOUNDATION_ACTIVATION_DECISION =
  'docs/design/decisions/mobile-ux-batch1-governance-foundation-v1.md';
export const FOUNDATION_ACTIVATION_RUN_RECORD =
  'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-foundation-v1.md';
export const BOOTSTRAP_RUN_RECORD =
  'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-bootstrap.md';
export const BOOTSTRAP_TRUSTED_BASE_SHA =
  'b423d8ffb9271f0618229605797e708919eebdea';

export const MAINTENANCE_EXACT_ALLOWLIST = Object.freeze([
  'scripts/classify_formal_approval_scope.mjs',
  'scripts/lib/strict_json.mjs',
  'scripts/lib/mobile_ux_batch1_github_event_reader.mjs',
  'scripts/lib/mobile_ux_batch1_governance_contract.mjs',
  'scripts/lib/mobile_ux_batch1_governance_recovery_contract.mjs',
  'scripts/lib/mobile_ux_batch1_successor_contract.mjs',
  'scripts/validate_mobile_ux_batch1_governance.mjs',
  'scripts/validate_mobile_ux_batch1_successor.mjs',
  'scripts/test_classify_formal_approval_scope.mjs',
  'scripts/test_mobile_ux_batch1_github_event_reader.mjs',
  'scripts/test_mobile_ux_batch1_governance_contract.mjs',
  'scripts/test_mobile_ux_batch1_governance_recovery_contract.mjs',
  'scripts/test_mobile_ux_batch1_successor_contract.mjs',
  'scripts/test_validate_mobile_ux_batch1_governance.mjs',
  'scripts/harness_validator/sections/governance_contracts.py',
  'scripts/harness_validator/sections/delivery_runtime.py',
  'scripts/harness_validator/sections/harness_architecture.py',
  'spec/mobile-ux-batch1-governance-recovery-decision.schema.json',
  'spec/repo-delivery-contract.json',
  'spec/harness-architecture.json',
  'spec/evals.json',
]);

export const MAINTENANCE_FIXTURE_PREFIX =
  'scripts/fixtures/mobile-ux-batch1-foundation-activation-v1/';

export const ESSENTIAL_RECOVERY_KERNEL_PATHS = Object.freeze([
  '.github/workflows/formal-approval.yml',
  '.github/workflows/pr-gates.yml',
  'scripts/classify_formal_approval_scope.mjs',
  'scripts/lib/strict_json.mjs',
  'scripts/lib/mobile_ux_batch1_github_event_reader.mjs',
  'scripts/lib/mobile_ux_batch1_governance_contract.mjs',
  'scripts/lib/mobile_ux_batch1_governance_recovery_contract.mjs',
  'scripts/lib/mobile_ux_batch1_successor_contract.mjs',
  'scripts/validate_mobile_ux_batch1_governance.mjs',
  'scripts/validate_mobile_ux_batch1_successor.mjs',
  'spec/mobile-ux-batch1-governance-recovery-decision.schema.json',
]);

export const BOOTSTRAP_INSTALLED_CLOSURE_PATHS = ESSENTIAL_RECOVERY_KERNEL_PATHS;

export const VERSIONED_POLICY_PATH_RE =
  /^spec\/mobile-ux-batch1-governance-epochs\/epoch-([1-9][0-9]*)-([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/;

const DECISION_PATH_RE =
  /^docs\/design\/decisions\/mobile-ux-batch1-governance-(maintenance|revocation|rebootstrap)-v1\/pr-([1-9][0-9]*)-([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/;
const RUN_RECORD_PATH_RE =
  /^docs\/agent-runs\/(\d{4}-\d{2}-\d{2})-mobile-ux-batch1-governance-(maintenance|revocation|rebootstrap)-pr-([1-9][0-9]*)-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const SHA1_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const VNEXT_RE = /^vnext-([1-9][0-9]*)$/;

const CLASS_TO_PATH_KIND = Object.freeze({
  governance_maintenance: 'maintenance',
  governance_revocation: 'revocation',
  governance_rebootstrap: 'rebootstrap',
});

const AGENTS_READ_ORDER_LINE =
  '- Mobile UX Batch 1 治理 / 受保护决策：`authority-map -> mobile-ux-batch1-governance -> agent-harness -> repo-delivery-contract -> harness-architecture -> evals`';
const AGENTS_STATIC_HARD_BOUNDARY_LINES = Object.freeze([
  '- 不要从待审批 PR head 加载或执行 formal-approval classifier、governance validator、GitHub evidence reader 或 successor validator；head 只能作为不受信 Git 数据读取，校验代码必须来自精确 verified base SHA',
  '- 不要在同一 PR 混合 governance foundation、Batch 1 subject、decision intent、approval receipt 或 execution manifest；没有专用授权 class 时 execution manifest 一律 fail closed',
]);
export const AGENTS_GOVERNANCE_HEADING = '## Mobile UX Batch 1 治理';

const ACTIVE_GOVERNANCE_MIRRORS = Object.freeze([
  'AGENTS.md',
  'spec/agent-harness.json',
  'spec/doc-manifest.json',
  'spec/repo-delivery-contract.json',
  'spec/harness-architecture.json',
  'spec/evals.json',
]);

const ACTIVE_IMPLEMENTATION_SURFACES = Object.freeze([
  '.github/workflows/formal-approval.yml',
  'scripts/classify_formal_approval_scope.mjs',
  'scripts/validate_mobile_ux_batch1_governance.mjs',
]);

const ACTIVE_HARNESS_COMPACTION_ANCHOR =
  'mobile_ux_batch1_governance_state';

function fail(message) {
  throw new Error(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertPlainObject(value, label) {
  if (!isPlainObject(value)) fail(`${label} must be a plain object`);
}

function assertExactKeys(value, expectedKeys, label) {
  assertPlainObject(value, label);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} keys must equal ${JSON.stringify(expected)}`);
  }
}

function assertPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail(`${label} must be a positive safe integer`);
  }
  return value;
}

function assertSha1(value, label) {
  if (typeof value !== 'string' || !SHA1_RE.test(value)) {
    fail(`${label} must be a lowercase 40-character SHA-1`);
  }
  return value;
}

function assertSha256(value, label) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(`${label} must be a lowercase 64-character SHA-256`);
  }
  return value;
}

function assertCanonicalRepoPath(value, label) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.startsWith('/') ||
    value.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    value.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    fail(`${label} must be a canonical repository-relative path`);
  }
  return value;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

function isGovernancePolicyPath(value) {
  return (
    value === ORIGINAL_GOVERNANCE_POLICY ||
    (typeof value === 'string' && VERSIONED_POLICY_PATH_RE.test(value))
  );
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function assertCanonicalEqual(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail(`${label} does not match the canonical contract`);
  }
}

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function parseRecoveryDecisionPath(relativePath) {
  if (typeof relativePath !== 'string') return null;
  const match = relativePath.match(DECISION_PATH_RE);
  if (!match) return null;
  return Object.freeze({
    decisionClass: `governance_${match[1]}`,
    kind: match[1],
    pullRequest: Number(match[2]),
    slug: match[3],
  });
}

export function parseRecoveryRunRecordPath(relativePath) {
  if (typeof relativePath !== 'string') return null;
  const match = relativePath.match(RUN_RECORD_PATH_RE);
  if (!match) return null;
  return Object.freeze({
    date: match[1],
    decisionClass: `governance_${match[2]}`,
    kind: match[2],
    pullRequest: Number(match[3]),
    slug: match[4],
  });
}

export function isMaintenancePayloadPath(relativePath) {
  try {
    assertCanonicalRepoPath(relativePath, 'maintenance payload path');
  } catch {
    return false;
  }
  return (
    MAINTENANCE_EXACT_ALLOWLIST.includes(relativePath) ||
    (relativePath.startsWith(MAINTENANCE_FIXTURE_PREFIX) &&
      relativePath.length > MAINTENANCE_FIXTURE_PREFIX.length)
  );
}

export function artifactSnapshotFromBytes(bytes, gitMode = '100644') {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
    fail('artifact bytes must be a Buffer or Uint8Array');
  }
  if (gitMode !== '100644') fail('recovery artifacts must use git mode 100644');
  const buffer = Buffer.from(bytes);
  return Object.freeze({
    present: true,
    git_mode: gitMode,
    byte_length: buffer.length,
    raw_sha256: sha256Hex(buffer),
  });
}

export const ABSENT_ARTIFACT_SNAPSHOT = Object.freeze({
  present: false,
  git_mode: null,
  byte_length: null,
  raw_sha256: null,
});

function validateArtifactSnapshot(snapshot, label) {
  assertExactKeys(
    snapshot,
    ['present', 'git_mode', 'byte_length', 'raw_sha256'],
    label,
  );
  if (typeof snapshot.present !== 'boolean') {
    fail(`${label}.present must be boolean`);
  }
  if (!snapshot.present) {
    assertCanonicalEqual(snapshot, ABSENT_ARTIFACT_SNAPSHOT, label);
    return;
  }
  if (snapshot.git_mode !== '100644') {
    fail(`${label}.git_mode must be 100644`);
  }
  if (!Number.isSafeInteger(snapshot.byte_length) || snapshot.byte_length < 0) {
    fail(`${label}.byte_length must be a non-negative safe integer`);
  }
  assertSha256(snapshot.raw_sha256, `${label}.raw_sha256`);
}

function validateTrackedArtifactRecord(record, label, {nonempty = true} = {}) {
  assertExactKeys(
    record,
    ['path', 'git_mode', 'byte_length', 'raw_sha256'],
    label,
  );
  assertCanonicalRepoPath(record.path, `${label}.path`);
  if (record.git_mode !== '100644') fail(`${label}.git_mode must be 100644`);
  if (
    !Number.isSafeInteger(record.byte_length) ||
    record.byte_length < (nonempty ? 1 : 0)
  ) {
    fail(`${label}.byte_length must be ${nonempty ? 'positive' : 'non-negative'}`);
  }
  assertSha256(record.raw_sha256, `${label}.raw_sha256`);
}

function validateExactTrackedRecordSet(records, expectedPaths, label) {
  if (!Array.isArray(records)) fail(`${label} must be an array`);
  records.forEach((record, index) =>
    validateTrackedArtifactRecord(record, `${label}[${index}]`),
  );
  const paths = records.map((record) => record.path);
  const expected = [...expectedPaths].sort();
  if (
    paths.length !== new Set(paths).size ||
    JSON.stringify(paths) !== JSON.stringify([...paths].sort()) ||
    JSON.stringify(paths) !== JSON.stringify(expected)
  ) {
    fail(`${label} must bind exactly ${JSON.stringify(expected)} in sorted order`);
  }
}

export function validateBootstrapInstalledProof(proof, trustedBaseSha) {
  assertExactKeys(
    proof,
    [
      'trusted_base_sha',
      'bootstrap_materialization_pull_request',
      'bootstrap_materialization_pull_request_base_sha',
      'bootstrap_materialization_head_sha',
      'bootstrap_materialization_head_tree_sha',
      'bootstrap_merge_commit_sha',
      'bootstrap_merge_tree_sha',
      'bootstrap_run_record_introduction_commit_sha',
      'bootstrap_run_record_unique_add_introduction_verified',
      'bootstrap_commit_associated_pull_request_count',
      'remote_pull_request_merged',
      'approved_head_tree_equals_merge_tree',
      'bootstrap_merge_reachable_from_trusted_base',
      'bootstrap_required_base_is_direct_first_parent_of_merge_and_strict_ancestor_of_trusted_base',
      'inactive_anchors_verified',
      'foundation_activation_decision_path',
      'foundation_activation_decision_present',
      'bootstrap_run_record_artifact_at_merge',
      'bootstrap_run_record_artifact_at_trusted_base',
      'governance_transition_commits_after_bootstrap',
      'closure_artifacts_at_bootstrap_merge',
      'closure_artifacts_at_trusted_base',
    ],
    'bootstrap-installed proof',
  );
  assertSha1(proof.trusted_base_sha, 'bootstrap-installed trusted base SHA');
  if (proof.trusted_base_sha !== trustedBaseSha) {
    fail('bootstrap-installed proof trusted base SHA mismatch');
  }
  assertPositiveInteger(
    proof.bootstrap_materialization_pull_request,
    'bootstrap materialization pull request',
  );
  assertSha1(
    proof.bootstrap_materialization_pull_request_base_sha,
    'bootstrap materialization pull request base SHA',
  );
  if (
    proof.bootstrap_materialization_pull_request_base_sha !==
    BOOTSTRAP_TRUSTED_BASE_SHA
  ) {
    fail('bootstrap materialization pull request base SHA does not match the immutable bootstrap base');
  }
  assertSha1(
    proof.bootstrap_materialization_head_sha,
    'bootstrap materialization head SHA',
  );
  assertSha1(
    proof.bootstrap_materialization_head_tree_sha,
    'bootstrap materialization head tree SHA',
  );
  assertSha1(
    proof.bootstrap_merge_commit_sha,
    'bootstrap-installed merge commit SHA',
  );
  assertSha1(proof.bootstrap_merge_tree_sha, 'bootstrap merge tree SHA');
  assertSha1(
    proof.bootstrap_run_record_introduction_commit_sha,
    'bootstrap run-record introduction commit SHA',
  );
  if (
    proof.bootstrap_run_record_introduction_commit_sha !==
    proof.bootstrap_merge_commit_sha
  ) {
    fail('bootstrap merge commit must be derived from the run-record add introduction');
  }
  if (proof.bootstrap_run_record_unique_add_introduction_verified !== true) {
    fail('bootstrap run record requires one unique add-introduction commit');
  }
  if (proof.bootstrap_commit_associated_pull_request_count !== 1) {
    fail('bootstrap merge commit must map to exactly one associated pull request');
  }
  if (
    proof.bootstrap_materialization_head_tree_sha !==
    proof.bootstrap_merge_tree_sha
  ) {
    fail('bootstrap approved head tree must equal squash merge tree');
  }
  if (
    proof.remote_pull_request_merged !== true ||
    proof.approved_head_tree_equals_merge_tree !== true ||
    proof.bootstrap_merge_reachable_from_trusted_base !== true ||
    proof.bootstrap_required_base_is_direct_first_parent_of_merge_and_strict_ancestor_of_trusted_base !== true
  ) {
    fail('bootstrap remote merge, tree equality, and strict ancestry facts must all be true');
  }
  if (proof.inactive_anchors_verified !== true) {
    fail('bootstrap-installed proof requires exact inactive anchors');
  }
  if (
    proof.foundation_activation_decision_path !==
      FOUNDATION_ACTIVATION_DECISION ||
    proof.foundation_activation_decision_present !== false
  ) {
    fail('bootstrap-installed state requires the fixed activation decision to be absent');
  }
  validateTrackedArtifactRecord(
    proof.bootstrap_run_record_artifact_at_merge,
    'bootstrap merge run-record artifact',
  );
  validateTrackedArtifactRecord(
    proof.bootstrap_run_record_artifact_at_trusted_base,
    'bootstrap trusted-base run-record artifact',
  );
  if (
    proof.bootstrap_run_record_artifact_at_merge.path !== BOOTSTRAP_RUN_RECORD ||
    proof.bootstrap_run_record_artifact_at_trusted_base.path !== BOOTSTRAP_RUN_RECORD
  ) {
    fail('bootstrap-installed proof must bind the fixed bootstrap run record');
  }
  if (
    canonicalJson(proof.bootstrap_run_record_artifact_at_merge) !==
    canonicalJson(proof.bootstrap_run_record_artifact_at_trusted_base)
  ) {
    fail('bootstrap run-record bytes must remain equal to their materialization merge bytes');
  }
  if (
    !Array.isArray(proof.governance_transition_commits_after_bootstrap) ||
    proof.governance_transition_commits_after_bootstrap.length !== 0
  ) {
    fail('bootstrap-installed state requires no later activation or revocation lineage event');
  }
  validateExactTrackedRecordSet(
    proof.closure_artifacts_at_bootstrap_merge,
    BOOTSTRAP_INSTALLED_CLOSURE_PATHS,
    'bootstrap-merge closure artifacts',
  );
  validateExactTrackedRecordSet(
    proof.closure_artifacts_at_trusted_base,
    BOOTSTRAP_INSTALLED_CLOSURE_PATHS,
    'bootstrap trusted-base closure artifacts',
  );
  return Object.freeze({status: 'verified', state: 'inactive_bootstrap_installed'});
}

export function validateVerifiedRevocationProof(
  proof,
  revocationContext,
  trustedBaseSha,
) {
  assertExactKeys(
    proof,
    [
      'trusted_base_sha',
      'revocation_context',
      'decision_artifact_at_merge',
      'decision_artifact_at_trusted_base',
      'decision_introduction_commit_sha',
      'decision_unique_add_introduction_verified',
      'run_record_artifact_at_merge',
      'run_record_artifact_at_trusted_base',
      'run_record_introduction_commit_sha',
      'run_record_unique_add_introduction_verified',
      'anchor_policy_path',
      'anchor_projection_at_merge',
      'anchor_projection_at_trusted_base',
      'remote_pull_request_merged',
      'approved_head_tree_equals_merge_tree',
      'merge_commit_reachable_from_trusted_base',
      'base_history_transition_enumeration_complete',
      'lineage_events',
      'governance_transition_commits_after_revocation',
    ],
    'verified revocation proof',
  );
  assertSha1(proof.trusted_base_sha, 'verified revocation trusted base SHA');
  if (proof.trusted_base_sha !== trustedBaseSha) {
    fail('verified revocation proof trusted base SHA mismatch');
  }
  assertCanonicalEqual(
    proof.revocation_context,
    revocationContext,
    'verified revocation context',
  );
  validateTrackedArtifactRecord(
    proof.decision_artifact_at_merge,
    'revocation merge decision artifact',
  );
  validateTrackedArtifactRecord(
    proof.decision_artifact_at_trusted_base,
    'revocation trusted-base decision artifact',
  );
  if (
    proof.decision_artifact_at_merge.path !== revocationContext.decision_path ||
    proof.decision_artifact_at_merge.raw_sha256 !== revocationContext.raw_sha256 ||
    canonicalJson(proof.decision_artifact_at_merge) !==
      canonicalJson(proof.decision_artifact_at_trusted_base)
  ) {
    fail('verified revocation decision bytes must match their materialization merge bytes');
  }
  assertSha1(
    proof.decision_introduction_commit_sha,
    'revocation decision introduction commit',
  );
  if (
    proof.decision_introduction_commit_sha !== revocationContext.merge_commit_sha ||
    proof.decision_unique_add_introduction_verified !== true
  ) {
    fail('revocation decision requires one unique add at its materialization merge');
  }
  validateTrackedArtifactRecord(
    proof.run_record_artifact_at_merge,
    'revocation merge run-record artifact',
  );
  validateTrackedArtifactRecord(
    proof.run_record_artifact_at_trusted_base,
    'revocation trusted-base run-record artifact',
  );
  const decisionPath = parseRecoveryDecisionPath(revocationContext.decision_path);
  const runRecordPath = parseRecoveryRunRecordPath(
    proof.run_record_artifact_at_merge.path,
  );
  if (
    !decisionPath ||
    !runRecordPath ||
    runRecordPath.decisionClass !== 'governance_revocation' ||
    runRecordPath.pullRequest !== decisionPath.pullRequest ||
    runRecordPath.slug !== decisionPath.slug ||
    canonicalJson(proof.run_record_artifact_at_merge) !==
      canonicalJson(proof.run_record_artifact_at_trusted_base)
  ) {
    fail('revocation run-record bytes and identity must match their materialization merge');
  }
  assertSha1(
    proof.run_record_introduction_commit_sha,
    'revocation run-record introduction commit',
  );
  if (
    proof.run_record_introduction_commit_sha !== revocationContext.merge_commit_sha ||
    proof.run_record_unique_add_introduction_verified !== true
  ) {
    fail('revocation run record requires one unique add at its materialization merge');
  }
  if (!isGovernancePolicyPath(proof.anchor_policy_path)) {
    fail('verified revocation anchor policy path is not canonical');
  }
  validateGovernanceAnchorProjection(
    proof.anchor_projection_at_merge,
    proof.anchor_policy_path,
    'revocation merge anchor projection',
  );
  validateGovernanceAnchorProjection(
    proof.anchor_projection_at_trusted_base,
    proof.anchor_policy_path,
    'trusted-base revoked anchor projection',
  );
  assertRevokedGovernanceAnchorProjection(
    proof.anchor_projection_at_merge,
    proof.anchor_policy_path,
    'revocation merge anchor projection',
  );
  assertRevokedGovernanceAnchorProjection(
    proof.anchor_projection_at_trusted_base,
    proof.anchor_policy_path,
    'trusted-base revoked anchor projection',
  );
  if (
    proof.remote_pull_request_merged !== true ||
    proof.approved_head_tree_equals_merge_tree !== true ||
    proof.merge_commit_reachable_from_trusted_base !== true
  ) {
    fail('verified revocation remote merge and ancestry facts must all be true');
  }
  if (proof.base_history_transition_enumeration_complete !== true) {
    fail('revocation proof requires complete first-parent governance transition history enumeration');
  }
  const terminalLineageEvent = validateRecoveryLineage(
    proof.lineage_events,
    revocationContext,
    trustedBaseSha,
    'governance_revocation',
  );
  if (
    canonicalJson(terminalLineageEvent.decision_artifact_at_merge) !==
      canonicalJson(proof.decision_artifact_at_merge) ||
    canonicalJson(terminalLineageEvent.decision_artifact_at_trusted_base) !==
      canonicalJson(proof.decision_artifact_at_trusted_base) ||
    canonicalJson(terminalLineageEvent.run_record_artifact_at_merge) !==
      canonicalJson(proof.run_record_artifact_at_merge) ||
    canonicalJson(terminalLineageEvent.run_record_artifact_at_trusted_base) !==
      canonicalJson(proof.run_record_artifact_at_trusted_base)
  ) {
    fail('terminal lineage artifacts must equal the current revocation proof artifacts');
  }
  if (
    !Array.isArray(proof.governance_transition_commits_after_revocation) ||
    proof.governance_transition_commits_after_revocation.length !== 0
  ) {
    fail('verified revocation must be the latest governance lineage event');
  }
  return Object.freeze({status: 'verified', state: 'revoked'});
}

export function validateVerifiedActiveLineageProof(
  proof,
  activationContext,
  trustedBaseSha,
) {
  assertExactKeys(
    proof,
    [
      'trusted_base_sha',
      'activation_context',
      'decision_artifact_at_merge',
      'decision_artifact_at_trusted_base',
      'decision_introduction_commit_sha',
      'decision_unique_add_introduction_verified',
      'run_record_artifact_at_merge',
      'run_record_artifact_at_trusted_base',
      'run_record_introduction_commit_sha',
      'run_record_unique_add_introduction_verified',
      'remote_pull_request_merged',
      'approved_head_tree_equals_merge_tree',
      'merge_commit_reachable_from_trusted_base',
      'base_history_transition_enumeration_complete',
      'lineage_events',
      'governance_transition_commits_after_activation',
    ],
    'verified active lineage proof',
  );
  assertSha1(proof.trusted_base_sha, 'verified active lineage trusted base SHA');
  if (proof.trusted_base_sha !== trustedBaseSha) {
    fail('verified active lineage proof trusted base SHA mismatch');
  }
  validateMaterializationContext(
    activationContext,
    'verified rebootstrap activation context',
    'governance_rebootstrap',
  );
  assertCanonicalEqual(
    proof.activation_context,
    activationContext,
    'verified rebootstrap activation context',
  );
  validateTrackedArtifactRecord(
    proof.decision_artifact_at_merge,
    'rebootstrap merge decision artifact',
  );
  validateTrackedArtifactRecord(
    proof.decision_artifact_at_trusted_base,
    'rebootstrap trusted-base decision artifact',
  );
  if (
    proof.decision_artifact_at_merge.path !== activationContext.decision_path ||
    proof.decision_artifact_at_merge.raw_sha256 !== activationContext.raw_sha256 ||
    canonicalJson(proof.decision_artifact_at_merge) !==
      canonicalJson(proof.decision_artifact_at_trusted_base)
  ) {
    fail('verified rebootstrap decision bytes must match their materialization merge bytes');
  }
  assertSha1(
    proof.decision_introduction_commit_sha,
    'rebootstrap decision introduction commit',
  );
  if (
    proof.decision_introduction_commit_sha !== activationContext.merge_commit_sha ||
    proof.decision_unique_add_introduction_verified !== true
  ) {
    fail('rebootstrap decision requires one unique add at its materialization merge');
  }
  validateTrackedArtifactRecord(
    proof.run_record_artifact_at_merge,
    'rebootstrap merge run-record artifact',
  );
  validateTrackedArtifactRecord(
    proof.run_record_artifact_at_trusted_base,
    'rebootstrap trusted-base run-record artifact',
  );
  const decisionPath = parseRecoveryDecisionPath(activationContext.decision_path);
  const runRecordPath = parseRecoveryRunRecordPath(
    proof.run_record_artifact_at_merge.path,
  );
  if (
    !decisionPath ||
    !runRecordPath ||
    runRecordPath.decisionClass !== 'governance_rebootstrap' ||
    runRecordPath.pullRequest !== decisionPath.pullRequest ||
    runRecordPath.slug !== decisionPath.slug ||
    canonicalJson(proof.run_record_artifact_at_merge) !==
      canonicalJson(proof.run_record_artifact_at_trusted_base)
  ) {
    fail('rebootstrap run-record bytes and identity must match their materialization merge');
  }
  assertSha1(
    proof.run_record_introduction_commit_sha,
    'rebootstrap run-record introduction commit',
  );
  if (
    proof.run_record_introduction_commit_sha !== activationContext.merge_commit_sha ||
    proof.run_record_unique_add_introduction_verified !== true
  ) {
    fail('rebootstrap run record requires one unique add at its materialization merge');
  }
  if (
    proof.remote_pull_request_merged !== true ||
    proof.approved_head_tree_equals_merge_tree !== true ||
    proof.merge_commit_reachable_from_trusted_base !== true
  ) {
    fail('verified rebootstrap remote merge and ancestry facts must all be true');
  }
  if (proof.base_history_transition_enumeration_complete !== true) {
    fail('active lineage proof requires complete first-parent governance transition history enumeration');
  }
  const terminalLineageEvent = validateRecoveryLineage(
    proof.lineage_events,
    activationContext,
    trustedBaseSha,
    'governance_rebootstrap',
  );
  if (
    canonicalJson(terminalLineageEvent.decision_artifact_at_merge) !==
      canonicalJson(proof.decision_artifact_at_merge) ||
    canonicalJson(terminalLineageEvent.decision_artifact_at_trusted_base) !==
      canonicalJson(proof.decision_artifact_at_trusted_base) ||
    canonicalJson(terminalLineageEvent.run_record_artifact_at_merge) !==
      canonicalJson(proof.run_record_artifact_at_merge) ||
    canonicalJson(terminalLineageEvent.run_record_artifact_at_trusted_base) !==
      canonicalJson(proof.run_record_artifact_at_trusted_base)
  ) {
    fail('terminal lineage artifacts must equal the current rebootstrap proof artifacts');
  }
  if (
    !Array.isArray(proof.governance_transition_commits_after_activation) ||
    proof.governance_transition_commits_after_activation.length !== 0
  ) {
    fail('verified rebootstrap must be the latest governance lineage event');
  }
  return Object.freeze({status: 'verified', state: 'active'});
}

function validateRecoveryLineage(
  events,
  terminalContext,
  trustedBaseSha,
  expectedTerminalClass,
) {
  const validTerminalShape =
    expectedTerminalClass === 'governance_revocation'
      ? Array.isArray(events) && events.length >= 2 && events.length % 2 === 0
      : expectedTerminalClass === 'governance_rebootstrap'
        ? Array.isArray(events) && events.length >= 3 && events.length % 2 === 1
        : false;
  if (!validTerminalShape) {
    fail('recovery lineage must contain foundation followed by complete alternating revocation/rebootstrap events');
  }
  const mergeCommits = new Set();
  let previousMergeCommit = null;
  for (const [index, event] of events.entries()) {
    assertExactKeys(
      event,
      [
        'decision_class',
        'decision_path',
        'decision_artifact_at_merge',
        'decision_artifact_at_trusted_base',
        'decision_introduction_commit_sha',
        'decision_unique_add_introduction_verified',
        'run_record_artifact_at_merge',
        'run_record_artifact_at_trusted_base',
        'run_record_introduction_commit_sha',
        'run_record_unique_add_introduction_verified',
        'materialization_pull_request',
        'materialization_head_sha',
        'materialization_head_tree_sha',
        'merge_commit_sha',
        'merge_tree_sha',
        'parent_merge_commit_sha',
        'remote_pull_request_merged',
        'approved_head_tree_equals_merge_tree',
        'merge_commit_reachable_from_trusted_base',
      ],
      `recovery lineage event ${index}`,
    );
    assertCanonicalRepoPath(event.decision_path, `recovery lineage event ${index} path`);
    validateTrackedArtifactRecord(
      event.decision_artifact_at_merge,
      `recovery lineage event ${index} merge decision`,
    );
    validateTrackedArtifactRecord(
      event.decision_artifact_at_trusted_base,
      `recovery lineage event ${index} trusted-base decision`,
    );
    validateTrackedArtifactRecord(
      event.run_record_artifact_at_merge,
      `recovery lineage event ${index} merge run record`,
    );
    validateTrackedArtifactRecord(
      event.run_record_artifact_at_trusted_base,
      `recovery lineage event ${index} trusted-base run record`,
    );
    if (
      event.decision_artifact_at_merge.path !== event.decision_path ||
      canonicalJson(event.decision_artifact_at_merge) !==
        canonicalJson(event.decision_artifact_at_trusted_base) ||
      canonicalJson(event.run_record_artifact_at_merge) !==
        canonicalJson(event.run_record_artifact_at_trusted_base)
    ) {
      fail('recovery lineage decision and run-record bytes must remain equal to merge bytes');
    }
    assertPositiveInteger(
      event.materialization_pull_request,
      `recovery lineage event ${index} materialization pull request`,
    );
    assertSha1(
      event.materialization_head_sha,
      `recovery lineage event ${index} materialization head`,
    );
    assertSha1(
      event.materialization_head_tree_sha,
      `recovery lineage event ${index} materialization head tree`,
    );
    assertSha1(event.merge_commit_sha, `recovery lineage event ${index} merge commit`);
    assertSha1(event.merge_tree_sha, `recovery lineage event ${index} merge tree`);
    assertSha1(
      event.decision_introduction_commit_sha,
      `recovery lineage event ${index} decision introduction commit`,
    );
    assertSha1(
      event.run_record_introduction_commit_sha,
      `recovery lineage event ${index} run-record introduction commit`,
    );
    if (mergeCommits.has(event.merge_commit_sha)) {
      fail('recovery lineage merge commits must be unique');
    }
    mergeCommits.add(event.merge_commit_sha);
    if (
      event.decision_introduction_commit_sha !== event.merge_commit_sha ||
      event.run_record_introduction_commit_sha !== event.merge_commit_sha ||
      event.decision_unique_add_introduction_verified !== true ||
      event.run_record_unique_add_introduction_verified !== true ||
      event.remote_pull_request_merged !== true ||
      event.approved_head_tree_equals_merge_tree !== true ||
      event.merge_commit_reachable_from_trusted_base !== true ||
      event.materialization_head_tree_sha !== event.merge_tree_sha
    ) {
      fail('every recovery lineage event requires stable bytes and one verified merged materialization');
    }
    if (index === 0) {
      if (
        event.decision_class !== 'governance_foundation' ||
        event.decision_path !== FOUNDATION_ACTIVATION_DECISION ||
        event.run_record_artifact_at_merge.path !==
          FOUNDATION_ACTIVATION_RUN_RECORD ||
        event.parent_merge_commit_sha !== null
      ) {
        fail('recovery lineage must begin with the fixed foundation activation');
      }
    } else {
      const expectedClass =
        index % 2 === 1 ? 'governance_revocation' : 'governance_rebootstrap';
      if (event.decision_class !== expectedClass) {
        fail('recovery lineage must alternate revocation and rebootstrap decisions');
      }
      const parsed = parseRecoveryDecisionPath(event.decision_path);
      const runRecord = parseRecoveryRunRecordPath(
        event.run_record_artifact_at_merge.path,
      );
      if (
        !parsed ||
        parsed.decisionClass !== expectedClass ||
        parsed.pullRequest !== event.materialization_pull_request ||
        !runRecord ||
        runRecord.decisionClass !== expectedClass ||
        runRecord.pullRequest !== parsed.pullRequest ||
        runRecord.slug !== parsed.slug
      ) {
        fail('recovery lineage dynamic decision path does not match its class');
      }
      if (event.parent_merge_commit_sha !== previousMergeCommit) {
        fail('recovery lineage parent commit chain is broken');
      }
    }
    previousMergeCommit = event.merge_commit_sha;
  }
  const terminal = events.at(-1);
  if (
    terminal.decision_class !== expectedTerminalClass ||
    terminal.decision_path !== terminalContext.decision_path ||
    terminal.decision_artifact_at_merge.raw_sha256 !==
      terminalContext.raw_sha256 ||
    terminal.materialization_pull_request !==
      terminalContext.materialization_pull_request ||
    terminal.materialization_head_sha !==
      terminalContext.materialization_head_sha ||
    terminal.materialization_head_tree_sha !==
      terminalContext.materialization_head_tree_sha ||
    terminal.merge_commit_sha !== terminalContext.merge_commit_sha ||
    terminal.merge_tree_sha !== terminalContext.merge_tree_sha
  ) {
    fail(`recovery lineage terminal event must be the current verified ${expectedTerminalClass}`);
  }
  assertSha1(trustedBaseSha, 'recovery lineage trusted base SHA');
  return terminal;
}

export function buildChangedArtifactRecord(relativePath, baseSnapshot, headSnapshot) {
  assertCanonicalRepoPath(relativePath, 'changed artifact path');
  validateArtifactSnapshot(baseSnapshot, 'changed artifact base snapshot');
  validateArtifactSnapshot(headSnapshot, 'changed artifact head snapshot');
  let changeType;
  if (!baseSnapshot.present && headSnapshot.present) changeType = 'add';
  else if (baseSnapshot.present && !headSnapshot.present) changeType = 'delete';
  else if (baseSnapshot.present && headSnapshot.present) changeType = 'modify';
  else fail('changed artifact cannot be absent from both base and head');
  if (
    changeType === 'modify' &&
    canonicalJson(baseSnapshot) === canonicalJson(headSnapshot)
  ) {
    fail('modified artifact must have different base and head snapshots');
  }
  return Object.freeze({
    path: relativePath,
    change_type: changeType,
    base: structuredClone(baseSnapshot),
    head: structuredClone(headSnapshot),
  });
}

function validateChangedArtifactRecord(record, label) {
  assertExactKeys(record, ['path', 'change_type', 'base', 'head'], label);
  assertCanonicalRepoPath(record.path, `${label}.path`);
  if (!['add', 'modify', 'delete'].includes(record.change_type)) {
    fail(`${label}.change_type is unsupported`);
  }
  validateArtifactSnapshot(record.base, `${label}.base`);
  validateArtifactSnapshot(record.head, `${label}.head`);
  const rebuilt = buildChangedArtifactRecord(record.path, record.base, record.head);
  if (rebuilt.change_type !== record.change_type) {
    fail(`${label}.change_type does not match artifact presence`);
  }
}

function validateAuthority(authority) {
  assertExactKeys(authority, AUTHORITY_KEYS, 'recovery authority');
  for (const key of AUTHORITY_KEYS) {
    if (authority[key] !== false) {
      fail(`recovery authority.${key} must be false`);
    }
  }
}

function validateRepository(repository) {
  assertExactKeys(
    repository,
    ['full_name', 'repository_id', 'base_ref'],
    'recovery repository',
  );
  if (
    repository.full_name !== TRUSTED_IDENTITY.repository ||
    repository.repository_id !== TRUSTED_IDENTITY.repositoryId ||
    repository.base_ref !== TRUSTED_IDENTITY.protectedBaseRef
  ) {
    fail('recovery repository identity mismatch');
  }
}

function validateCurrentRunGate(gate) {
  assertCanonicalEqual(gate, REQUIRED_CURRENT_RUN_GATE, 'current-run gate');
}

function validateMaterializationContext(context, label, expectedDecisionClass) {
  assertExactKeys(
    context,
    [
      'decision_path',
      'raw_sha256',
      'materialization_pull_request',
      'materialization_head_sha',
      'materialization_head_tree_sha',
      'merge_commit_sha',
      'merge_tree_sha',
    ],
    label,
  );
  const parsed = parseRecoveryDecisionPath(context.decision_path);
  if (!parsed || parsed.decisionClass !== expectedDecisionClass) {
    fail(`${label}.decision_path must be a canonical ${expectedDecisionClass} decision path`);
  }
  assertSha256(context.raw_sha256, `${label}.raw_sha256`);
  assertPositiveInteger(
    context.materialization_pull_request,
    `${label}.materialization_pull_request`,
  );
  if (context.materialization_pull_request !== parsed.pullRequest) {
    fail(`${label} pull request must match its decision path`);
  }
  assertSha1(context.materialization_head_sha, `${label}.materialization_head_sha`);
  assertSha1(
    context.materialization_head_tree_sha,
    `${label}.materialization_head_tree_sha`,
  );
  assertSha1(context.merge_commit_sha, `${label}.merge_commit_sha`);
  assertSha1(context.merge_tree_sha, `${label}.merge_tree_sha`);
  if (context.materialization_head_tree_sha !== context.merge_tree_sha) {
    fail(`${label} approved head tree must equal squash merge tree`);
  }
}

function validateRevocationContext(context, label) {
  validateMaterializationContext(
    context,
    label,
    'governance_revocation',
  );
}

function validatePolicySelection(selection, decision, context) {
  if (decision.decision_class === 'governance_maintenance') {
    if (selection !== null) fail('maintenance policy_selection must be null');
    return;
  }
  assertExactKeys(selection, ['mode', 'path', 'raw_sha256'], 'policy selection');
  assertCanonicalRepoPath(selection.path, 'policy selection path');
  assertSha256(selection.raw_sha256, 'policy selection raw SHA-256');

  if (decision.decision_class === 'governance_revocation') {
    if (selection.mode !== 'revoked_policy') {
      fail('revocation must identify the revoked policy');
    }
    if (
      !context.activePolicyPath ||
      selection.path !== context.activePolicyPath
    ) {
      fail('revocation policy path must equal the verified active owner policy');
    }
    if (
      !context.activePolicyRawSha256 ||
      selection.raw_sha256 !== context.activePolicyRawSha256
    ) {
      fail('revocation policy digest must equal the verified active owner policy digest');
    }
    return;
  }

  if (selection.mode !== 'reuse_revoked_policy') {
    fail('rebootstrap policy mode must be reuse_revoked_policy');
  }
  if (
    !context.revokedPolicyPath ||
    selection.path !== context.revokedPolicyPath
  ) {
    fail('rebootstrap reused policy path must equal the verified revoked policy path');
  }
  if (
    !context.revokedPolicyRawSha256 ||
    selection.raw_sha256 !== context.revokedPolicyRawSha256
  ) {
    fail('rebootstrap reused policy digest must equal the verified revoked policy digest');
  }
}

function validateDecisionIdentity(decision, context) {
  const parsedDecisionPath = parseRecoveryDecisionPath(decision.decision_path);
  if (!parsedDecisionPath) fail('decision_path is not a recovery decision path');
  if (parsedDecisionPath.decisionClass !== decision.decision_class) {
    fail('decision class must match decision_path');
  }
  if (parsedDecisionPath.pullRequest !== decision.pull_request) {
    fail('decision pull request must match decision_path');
  }
  const expectedDecisionId =
    `mobile-ux-batch1-governance-${parsedDecisionPath.kind}-pr-` +
    `${decision.pull_request}-${parsedDecisionPath.slug}`;
  if (decision.decision_id !== expectedDecisionId) {
    fail(`decision_id must equal ${expectedDecisionId}`);
  }

  const run = parseRecoveryRunRecordPath(decision.run_record_path);
  if (!run) fail('run_record_path is not canonical');
  if (
    run.decisionClass !== decision.decision_class ||
    run.pullRequest !== decision.pull_request ||
    run.slug !== parsedDecisionPath.slug
  ) {
    fail('run record class, pull request, and slug must match the decision path');
  }

  if (context.decisionPath && context.decisionPath !== decision.decision_path) {
    fail('decision path does not match validation context');
  }
  if (context.pullRequest && context.pullRequest !== decision.pull_request) {
    fail('decision pull request does not match validation context');
  }
  if (context.trustedBaseSha && context.trustedBaseSha !== decision.trusted_base_sha) {
    fail('decision trusted base SHA does not match validation context');
  }
}

function validateStateTransition(decision, baseState) {
  if (!GOVERNANCE_STATES.includes(baseState)) {
    fail('derived base state is unsupported');
  }
  let expected;
  if (decision.decision_class === 'governance_maintenance') {
    if (decision.operation === 'bootstrap_maintenance') {
      expected = {
        from: 'inactive_bootstrap_installed',
        to: 'inactive_bootstrap_installed',
      };
    } else if (decision.operation === 'active_maintenance') {
      expected = {from: 'active', to: 'active'};
    } else if (decision.operation === 'revoked_recovery') {
      expected = {from: 'revoked', to: 'revoked'};
    } else {
      fail('maintenance operation is unsupported');
    }
  } else if (decision.decision_class === 'governance_revocation') {
    if (decision.operation !== 'revoke_active_governance') {
      fail('revocation operation is unsupported');
    }
    expected = {from: 'active', to: 'revoked'};
  } else if (decision.decision_class === 'governance_rebootstrap') {
    if (decision.operation !== 'rebootstrap_same_policy') {
      fail('rebootstrap operation is unsupported');
    }
    expected = {from: 'revoked', to: 'active'};
  } else {
    fail('recovery decision class is unsupported');
  }
  assertCanonicalEqual(decision.state_transition, expected, 'state transition');
  if (baseState !== expected.from) {
    fail(`${decision.decision_class} cannot run from ${baseState}`);
  }
  if (baseState === 'inactive_initial') {
    fail('initial inactive state cannot use a recovery decision');
  }
}

function validateDecisionScope(decision, changedPaths) {
  const uniqueChangedPaths = [...new Set(changedPaths)].sort();
  if (uniqueChangedPaths.length !== changedPaths.length) {
    fail('changed path list contains duplicates');
  }
  for (const relativePath of uniqueChangedPaths) {
    assertCanonicalRepoPath(relativePath, 'changed path');
  }
  if (!uniqueChangedPaths.includes(decision.decision_path)) {
    fail('changed paths must include the decision path');
  }
  if (!uniqueChangedPaths.includes(decision.run_record_path)) {
    fail('changed paths must include the run record path');
  }

  const payloadPaths = uniqueChangedPaths.filter(
    (relativePath) =>
      relativePath !== decision.decision_path &&
      relativePath !== decision.run_record_path,
  );

  if (decision.decision_class === 'governance_maintenance') {
    if (payloadPaths.length === 0) fail('maintenance requires at least one payload path');
    for (const relativePath of payloadPaths) {
      if (!isMaintenancePayloadPath(relativePath)) {
        fail(`maintenance payload path is not allowlisted: ${relativePath}`);
      }
    }
    return;
  }

  const expected = [...GOVERNANCE_ANCHOR_PATHS].sort();
  if (JSON.stringify(payloadPaths) !== JSON.stringify(expected)) {
    fail(
      `${decision.decision_class} payload must equal ${JSON.stringify(expected)}`,
    );
  }
}

function validateArtifactBindings(decision, context) {
  if (!Array.isArray(decision.changed_artifacts)) {
    fail('changed_artifacts must be an array');
  }
  const records = decision.changed_artifacts;
  records.forEach((record, index) =>
    validateChangedArtifactRecord(record, `changed_artifacts[${index}]`),
  );
  const recordedPaths = records.map((record) => record.path);
  const sortedRecordedPaths = [...recordedPaths].sort();
  if (
    recordedPaths.length !== new Set(recordedPaths).size ||
    JSON.stringify(recordedPaths) !== JSON.stringify(sortedRecordedPaths)
  ) {
    fail('changed_artifacts must be unique and sorted by path');
  }
  if (recordedPaths.includes(decision.decision_path)) {
    fail('decision artifact is bound by the current PR head and must not self-hash');
  }
  const expectedPaths = [...context.changedPaths]
    .filter((relativePath) => relativePath !== decision.decision_path)
    .sort();
  if (JSON.stringify(recordedPaths) !== JSON.stringify(expectedPaths)) {
    fail('changed_artifacts must bind every changed path except the decision itself');
  }

  const runRecord = records.find(
    (record) => record.path === decision.run_record_path,
  );
  if (!runRecord || runRecord.change_type !== 'add') {
    fail('run record must be an added artifact');
  }
  if (runRecord.head.byte_length === 0) {
    fail('run record must be nonempty');
  }

  if (decision.decision_class === 'governance_maintenance') {
    for (const record of records) {
      if (
        MAINTENANCE_EXACT_ALLOWLIST.includes(record.path) &&
        record.change_type === 'delete'
      ) {
        fail(`maintenance cannot delete protected allowlist path: ${record.path}`);
      }
      if (
        ESSENTIAL_RECOVERY_KERNEL_PATHS.includes(record.path) &&
        (!record.head.present || record.head.byte_length === 0)
      ) {
        fail(`maintenance must preserve a nonempty 100644 recovery kernel path: ${record.path}`);
      }
    }
  } else {
    for (const relativePath of GOVERNANCE_ANCHOR_PATHS) {
      const record = records.find((candidate) => candidate.path === relativePath);
      if (!record || record.change_type !== 'modify') {
        fail(`${decision.decision_class} must modify, not add or delete, anchor ${relativePath}`);
      }
      if (record.base.byte_length === 0 || record.head.byte_length === 0) {
        fail(`${decision.decision_class} anchor must remain nonempty: ${relativePath}`);
      }
    }
  }

  if (context.actualArtifactRecords !== undefined) {
    if (!Array.isArray(context.actualArtifactRecords)) {
      fail('actualArtifactRecords must be an array');
    }
    const actual = [...context.actualArtifactRecords].sort((left, right) =>
      left.path.localeCompare(right.path),
    );
    if (canonicalJson(records) !== canonicalJson(actual)) {
      fail('decision artifact records do not match recomputed Git artifacts');
    }
  }

}

export function validateRecoveryDecision(decision, context) {
  assertPlainObject(context, 'recovery validation context');
  if (!Array.isArray(context.changedPaths)) {
    fail('recovery validation context.changedPaths must be an array');
  }
  assertExactKeys(
    decision,
    [
      'schema_version',
      'decision_id',
      'decision_class',
      'operation',
      'repository',
      'pull_request',
      'trusted_base_sha',
      'decision_path',
      'run_record_path',
      'state_transition',
      'revocation_context',
      'policy_selection',
      'changed_artifacts',
      'current_run_gate',
      'authority',
      'non_claims',
    ],
    'recovery decision',
  );
  if (decision.schema_version !== RECOVERY_SCHEMA_VERSION) {
    fail('recovery decision schema version mismatch');
  }
  if (!RECOVERY_DECISION_CLASSES.includes(decision.decision_class)) {
    fail('recovery decision class is unsupported');
  }
  if (typeof decision.operation !== 'string' || decision.operation.length === 0) {
    fail('recovery operation must be a non-empty string');
  }
  validateRepository(decision.repository);
  assertPositiveInteger(decision.pull_request, 'recovery pull request');
  assertSha1(decision.trusted_base_sha, 'recovery trusted base SHA');
  assertCanonicalRepoPath(decision.decision_path, 'decision path');
  assertCanonicalRepoPath(decision.run_record_path, 'run record path');
  validateDecisionIdentity(decision, context);

  if (
    decision.decision_class === 'governance_maintenance' &&
    ['bootstrap_maintenance', 'active_maintenance'].includes(decision.operation)
  ) {
    if (decision.revocation_context !== null) {
      fail('active maintenance revocation_context must be null');
    }
  } else if (decision.decision_class === 'governance_revocation') {
    if (decision.revocation_context !== null) {
      fail('revocation decision cannot refer to its own future materialization');
    }
  } else {
    validateRevocationContext(
      decision.revocation_context,
      'recovery revocation_context',
    );
  }

  const baseState = deriveGovernanceState({
    anchorInput: context.anchorInput,
    trustedBaseSha: decision.trusted_base_sha,
    stateProof: context.stateProof,
  });
  if (
    baseState === 'revoked' &&
    canonicalJson(decision.revocation_context) !==
      canonicalJson(context.stateProof?.proof?.revocation_context)
  ) {
    fail('recovery revocation_context must equal the exact verified trusted-base revocation context');
  }
  validateStateTransition(decision, baseState);

  validatePolicySelection(decision.policy_selection, decision, context);
  validateCurrentRunGate(decision.current_run_gate);
  validateAuthority(decision.authority);
  assertCanonicalEqual(decision.non_claims, RECOVERY_NON_CLAIMS, 'recovery non-claims');
  validateDecisionScope(decision, [...context.changedPaths].sort());
  validateArtifactBindings(decision, context);
  return Object.freeze({
    status: 'valid',
    decision_class: decision.decision_class,
    operation: decision.operation,
    base_state: baseState,
    target_state: decision.state_transition.to,
    gate_effect: 'none_before_current_run_protected_owner_approval_and_merge',
  });
}

export function buildActiveGovernanceDomain(policyPath, activationRecordPath) {
  assertCanonicalRepoPath(policyPath, 'active policy path');
  assertCanonicalRepoPath(activationRecordPath, 'activation record path');
  return Object.freeze({
    owner: policyPath,
    protected_activation_record: activationRecordPath,
    status: 'active_repo_governance_truth',
    mirrors: ACTIVE_GOVERNANCE_MIRRORS,
    implementation_surfaces: ACTIVE_IMPLEMENTATION_SURFACES,
    notes:
      'Owns only the protected Mobile UX Batch 1 repository-governance mechanics and zero-authority staged decision chain; product, visual, implementation, native, release, and leadership-readiness truth remain with their existing owners.',
  });
}

export function buildActiveHarnessReadPaths(policyPath) {
  assertCanonicalRepoPath(policyPath, 'active policy path');
  return Object.freeze([
    'spec/authority-map.json',
    policyPath,
    'spec/agent-harness.json',
    'spec/repo-delivery-contract.json',
    'spec/harness-architecture.json',
    'spec/evals.json',
  ]);
}

export function buildActiveHarnessPolicy(policyPath, activationRecordPath) {
  assertCanonicalRepoPath(policyPath, 'active policy path');
  assertCanonicalRepoPath(activationRecordPath, 'activation record path');
  return Object.freeze({
    owner: policyPath,
    activation_decision: activationRecordPath,
    status_source: 'spec/authority-map.json#domains/mobile_ux_batch1_governance',
    scope_classifier: 'scripts/classify_formal_approval_scope.mjs',
    validator: 'scripts/validate_mobile_ux_batch1_governance.mjs',
    failure_policy: 'unknown_missing_mixed_expired_or_unverifiable_state_fails_closed',
    authority_boundary:
      'no_product_visual_implementation_native_release_or_leadership_readiness_authority',
  });
}

export function activeAgentsLines(policyPath) {
  assertCanonicalRepoPath(policyPath, 'active policy path');
  return Object.freeze([
    `- \`${policyPath}\`（仅在 Mobile UX Batch 1 治理、受保护决策、R0 / D1 / B2 / F3 或对应回执任务中读取；只拥有仓库治理机制，全部产品、视觉、实现、原生、发布与领导验收权限仍为 false）`,
    AGENTS_READ_ORDER_LINE,
    `- 不要把 Mobile UX Batch 1 governance foundation、R0 / D1 / B2 / F3 intent、receipt 或 successor validation 当作产品、视觉、实现、原生、发布或领导验收权限；严格以 \`${policyPath}\` 的 16 维 authority 与 distinct-PR stage separation 为准`,
    ...AGENTS_STATIC_HARD_BOUNDARY_LINES,
  ]);
}

function bumpVnextVersion(value, label) {
  if (typeof value !== 'string') fail(`${label} version must be a string`);
  const match = value.match(VNEXT_RE);
  if (!match) fail(`${label} version must use vnext-N`);
  const current = Number(match[1]);
  if (!Number.isSafeInteger(current) || current >= Number.MAX_SAFE_INTEGER) {
    fail(`${label} version cannot be incremented safely`);
  }
  return `vnext-${current + 1}`;
}

function buildActiveAgents(source, policyPath, activationRecordPath) {
  if (typeof source !== 'string') fail('AGENTS source must be text');
  const additions = activeAgentsLines(policyPath);
  const finalNewline = source.endsWith('\n');
  const lines = source.split('\n');
  if (finalNewline) lines.pop();
  for (const target of additions) {
    if (lines.includes(target)) {
      fail('inactive AGENTS source already contains a Batch 1 activation line');
    }
  }
  if (lines.includes(AGENTS_GOVERNANCE_HEADING)) {
    fail('inactive AGENTS source already contains the managed Batch 1 governance heading');
  }
  if (activationRecordPath === FOUNDATION_ACTIVATION_DECISION) {
    lines.push(...additions);
  } else {
    const parsed = parseRecoveryDecisionPath(activationRecordPath);
    if (!parsed || parsed.decisionClass !== 'governance_rebootstrap') {
      fail('active AGENTS dynamic section requires a canonical rebootstrap activation record');
    }
    if (lines.at(-1) !== '') lines.push('');
    lines.push(AGENTS_GOVERNANCE_HEADING, '', ...additions);
  }
  return `${lines.join('\n')}${finalNewline ? '\n' : ''}`;
}

function removeActiveAgents(source, policyPath) {
  if (typeof source !== 'string') fail('AGENTS source must be text');
  const finalNewline = source.endsWith('\n');
  const lines = source.split('\n');
  if (finalNewline) lines.pop();
  for (const target of activeAgentsLines(policyPath)) {
    const indexes = lines
      .map((line, index) => (line === target ? index : -1))
      .filter((index) => index >= 0);
    if (indexes.length !== 1) {
      fail('active AGENTS line must occur exactly once before revocation');
    }
    lines.splice(indexes[0], 1);
  }
  const headingIndexes = lines
    .map((line, index) => (line === AGENTS_GOVERNANCE_HEADING ? index : -1))
    .filter((index) => index >= 0);
  if (headingIndexes.length > 1) {
    fail('active AGENTS managed governance heading may occur at most once before revocation');
  }
  if (headingIndexes.length === 1) {
    let headingIndex = headingIndexes[0];
    if (headingIndex > 0 && lines[headingIndex - 1] === '') {
      lines.splice(headingIndex - 1, 1);
      headingIndex -= 1;
    }
    lines.splice(headingIndex, 1);
    if (lines[headingIndex] === '') lines.splice(headingIndex, 1);
  }
  return `${lines.join('\n')}${finalNewline ? '\n' : ''}`;
}

function assertAnchorInput(input) {
  assertExactKeys(
    input,
    [
      'authorityMap',
      'agentHarness',
      'docManifest',
      'agentsText',
      'policyPath',
      'activationRecordPath',
    ],
    'anchor transition input',
  );
  assertPlainObject(input.authorityMap, 'authority-map');
  assertPlainObject(input.agentHarness, 'agent-harness');
  assertPlainObject(input.docManifest, 'doc-manifest');
  if (typeof input.agentsText !== 'string') fail('agentsText must be text');
  assertCanonicalRepoPath(input.policyPath, 'anchor policy path');
  assertCanonicalRepoPath(input.activationRecordPath, 'anchor activation record path');
}

function optionalOwnedValue(value) {
  return value === undefined
    ? Object.freeze({present: false, value: null})
    : Object.freeze({present: true, value: structuredClone(value)});
}

function validateOptionalOwnedValue(entry, label) {
  assertExactKeys(entry, ['present', 'value'], label);
  if (typeof entry.present !== 'boolean') fail(`${label}.present must be boolean`);
  if (!entry.present && entry.value !== null) {
    fail(`${label}.value must be null when the owned field is absent`);
  }
  if (entry.present && entry.value === undefined) {
    fail(`${label}.value must be defined when the owned field is present`);
  }
}

export function governanceAnchorProjection(input) {
  assertAnchorInput(input);
  const domain = input.authorityMap?.domains?.mobile_ux_batch1_governance;
  const readPaths = input.agentHarness?.read_paths?.mobile_ux_batch1_governance;
  const harnessPolicy =
    input.agentHarness?.governance?.mobile_ux_batch1_governance_policy;
  const compactionCount = Array.isArray(input.agentHarness?.compaction_keep)
    ? input.agentHarness.compaction_keep.filter(
      (value) => value === ACTIVE_HARNESS_COMPACTION_ANCHOR,
    ).length
    : -1;
  const activeSpecCount = Array.isArray(input.docManifest?.active_specs)
    ? input.docManifest.active_specs.filter(
      (value) => value === input.policyPath,
    ).length
    : -1;
  const agentLines = input.agentsText.split(/\r?\n/);
  const governanceHeadingCount = agentLines.filter(
    (line) => line === AGENTS_GOVERNANCE_HEADING,
  ).length;
  const lineCounts = activeAgentsLines(input.policyPath).map(
    (line) => Object.freeze({
      line,
      count: agentLines.filter((candidate) => candidate === line).length,
    }),
  );
  return Object.freeze({
    authority_domain: optionalOwnedValue(domain),
    harness_read_path: optionalOwnedValue(readPaths),
    harness_governance_policy: optionalOwnedValue(harnessPolicy),
    harness_compaction_anchor_count: compactionCount,
    doc_manifest_policy_count: activeSpecCount,
    agents_governance_heading_count: governanceHeadingCount,
    agents_activation_line_counts: Object.freeze(lineCounts),
  });
}

function validateGovernanceAnchorProjection(projection, policyPath, label) {
  assertExactKeys(
    projection,
    [
      'authority_domain',
      'harness_read_path',
      'harness_governance_policy',
      'harness_compaction_anchor_count',
      'doc_manifest_policy_count',
      'agents_governance_heading_count',
      'agents_activation_line_counts',
    ],
    label,
  );
  validateOptionalOwnedValue(projection.authority_domain, `${label}.authority_domain`);
  validateOptionalOwnedValue(projection.harness_read_path, `${label}.harness_read_path`);
  validateOptionalOwnedValue(
    projection.harness_governance_policy,
    `${label}.harness_governance_policy`,
  );
  for (const [value, field] of [
    [projection.harness_compaction_anchor_count, 'harness_compaction_anchor_count'],
    [projection.doc_manifest_policy_count, 'doc_manifest_policy_count'],
    [projection.agents_governance_heading_count, 'agents_governance_heading_count'],
  ]) {
    if (!Number.isSafeInteger(value) || value < 0) {
      fail(`${label}.${field} must be a non-negative safe integer`);
    }
  }
  if (!Array.isArray(projection.agents_activation_line_counts)) {
    fail(`${label}.agents_activation_line_counts must be an array`);
  }
  const expectedLines = activeAgentsLines(policyPath);
  if (projection.agents_activation_line_counts.length !== expectedLines.length) {
    fail(`${label} must bind all five Batch 1 AGENTS activation lines`);
  }
  projection.agents_activation_line_counts.forEach((entry, index) => {
    assertExactKeys(entry, ['line', 'count'], `${label}.agents_activation_line_counts[${index}]`);
    if (
      entry.line !== expectedLines[index] ||
      !Number.isSafeInteger(entry.count) ||
      entry.count < 0
    ) {
      fail(`${label} AGENTS activation line projection drift`);
    }
  });
}

function assertRevokedGovernanceAnchorProjection(projection, policyPath, label) {
  const expected = governanceAnchorProjection({
    authorityMap: {domains: {}},
    agentHarness: {read_paths: {}, governance: {}, compaction_keep: []},
    docManifest: {active_specs: []},
    agentsText: '',
    policyPath,
    activationRecordPath: FOUNDATION_ACTIVATION_DECISION,
  });
  if (canonicalJson(projection) !== canonicalJson(expected)) {
    fail(`${label} must be the exact revoked Batch 1-owned projection`);
  }
}

export function classifyGovernanceAnchorState(input) {
  const projection = governanceAnchorProjection(input);
  const domain = projection.authority_domain.present
    ? projection.authority_domain.value
    : undefined;
  const readPaths = projection.harness_read_path.present
    ? projection.harness_read_path.value
    : undefined;
  const harnessPolicy = projection.harness_governance_policy.present
    ? projection.harness_governance_policy.value
    : undefined;
  const compactionCount = projection.harness_compaction_anchor_count;
  const activeSpecCount = projection.doc_manifest_policy_count;
  const governanceHeadingCount = projection.agents_governance_heading_count;
  const lineCounts = projection.agents_activation_line_counts.map(
    (entry) => entry.count,
  );
  const parsedActivationRecord = parseRecoveryDecisionPath(
    input.activationRecordPath,
  );
  const expectedActiveHeadingCount =
    input.activationRecordPath === FOUNDATION_ACTIVATION_DECISION
      ? 0
      : parsedActivationRecord?.decisionClass === 'governance_rebootstrap'
        ? 1
        : -1;

  const exactActive =
    canonicalJson(domain) ===
      canonicalJson(
        buildActiveGovernanceDomain(
          input.policyPath,
          input.activationRecordPath,
        ),
      ) &&
    canonicalJson(readPaths) ===
      canonicalJson(buildActiveHarnessReadPaths(input.policyPath)) &&
    canonicalJson(harnessPolicy) ===
      canonicalJson(
        buildActiveHarnessPolicy(
          input.policyPath,
          input.activationRecordPath,
        ),
    ) &&
    compactionCount === 1 &&
    activeSpecCount === 1 &&
    governanceHeadingCount === expectedActiveHeadingCount &&
    lineCounts.every((count) => count === 1);
  if (exactActive) return 'active';

  const exactInactive =
    domain === undefined &&
    readPaths === undefined &&
    harnessPolicy === undefined &&
    compactionCount === 0 &&
    activeSpecCount === 0 &&
    governanceHeadingCount === 0 &&
    lineCounts.every((count) => count === 0);
  if (exactInactive) return 'inactive_anchors';
  fail('governance anchors are in a partial or inconsistent state');
}

export function deriveGovernanceState({anchorInput, trustedBaseSha, stateProof}) {
  const anchorState = classifyGovernanceAnchorState(anchorInput);
  if (anchorState === 'active') {
    if (anchorInput.activationRecordPath === FOUNDATION_ACTIVATION_DECISION) {
      return 'active';
    }
    const activationPath = parseRecoveryDecisionPath(
      anchorInput.activationRecordPath,
    );
    if (
      !activationPath ||
      activationPath.decisionClass !== 'governance_rebootstrap'
    ) {
      fail('active dynamic activation record must be a canonical rebootstrap decision path');
    }
    assertPlainObject(stateProof, 'dynamic active governance state proof');
    assertExactKeys(
      stateProof,
      ['kind', 'proof'],
      'dynamic active governance state proof',
    );
    if (stateProof.kind !== 'verified_rebootstrap_active') {
      fail('dynamic active anchors require a verified rebootstrap lineage proof');
    }
    if (
      stateProof.proof?.activation_context?.decision_path !==
      anchorInput.activationRecordPath
    ) {
      fail('active activation record must equal the latest verified rebootstrap decision');
    }
    validateVerifiedActiveLineageProof(
      stateProof.proof,
      stateProof.proof.activation_context,
      trustedBaseSha,
    );
    return 'active';
  }
  assertPlainObject(stateProof, 'inactive governance state proof');
  assertExactKeys(
    stateProof,
    ['kind', 'proof'],
    'inactive governance state proof',
  );
  if (stateProof.kind === 'inactive_bootstrap_installed') {
    validateBootstrapInstalledProof(stateProof.proof, trustedBaseSha);
    return 'inactive_bootstrap_installed';
  }
  if (stateProof.kind === 'revoked') {
    validateVerifiedRevocationProof(
      stateProof.proof,
      stateProof.proof?.revocation_context,
      trustedBaseSha,
    );
    return 'revoked';
  }
  fail('inactive anchors require a trusted bootstrap-installed or revoked lineage proof');
}

export function buildRevocationAnchorTransition(input) {
  assertAnchorInput(input);
  if (classifyGovernanceAnchorState(input) !== 'active') {
    fail('revocation transition requires an exact active anchor state');
  }
  const authorityMap = structuredClone(input.authorityMap);
  const agentHarness = structuredClone(input.agentHarness);
  const docManifest = structuredClone(input.docManifest);
  authorityMap.version = bumpVnextVersion(authorityMap.version, 'authority-map');
  delete authorityMap.domains.mobile_ux_batch1_governance;
  agentHarness.version = bumpVnextVersion(agentHarness.version, 'agent-harness');
  delete agentHarness.read_paths.mobile_ux_batch1_governance;
  delete agentHarness.governance.mobile_ux_batch1_governance_policy;
  const compactionIndex = agentHarness.compaction_keep.indexOf(
    ACTIVE_HARNESS_COMPACTION_ANCHOR,
  );
  agentHarness.compaction_keep.splice(compactionIndex, 1);
  docManifest.version = bumpVnextVersion(docManifest.version, 'doc-manifest');
  const policyIndex = docManifest.active_specs.indexOf(input.policyPath);
  docManifest.active_specs.splice(policyIndex, 1);
  const agentsText = removeActiveAgents(input.agentsText, input.policyPath);
  const result = Object.freeze({authorityMap, agentHarness, docManifest, agentsText});
  const classified = classifyGovernanceAnchorState({
    ...result,
    policyPath: input.policyPath,
    activationRecordPath: input.activationRecordPath,
  });
  if (classified !== 'inactive_anchors') {
    fail('revocation transition did not produce exact inactive anchors');
  }
  return result;
}

export function buildRebootstrapAnchorTransition(
  input,
  {trustedBaseSha, verifiedRevocationProof} = {},
) {
  assertAnchorInput(input);
  if (
    deriveGovernanceState({
      anchorInput: input,
      trustedBaseSha,
      stateProof: {kind: 'revoked', proof: verifiedRevocationProof},
    }) !== 'revoked'
  ) {
    fail('rebootstrap transition requires an exact revoked anchor state');
  }
  const authorityMap = structuredClone(input.authorityMap);
  const agentHarness = structuredClone(input.agentHarness);
  const docManifest = structuredClone(input.docManifest);
  authorityMap.version = bumpVnextVersion(authorityMap.version, 'authority-map');
  authorityMap.domains.mobile_ux_batch1_governance =
    buildActiveGovernanceDomain(input.policyPath, input.activationRecordPath);
  agentHarness.version = bumpVnextVersion(agentHarness.version, 'agent-harness');
  agentHarness.read_paths.mobile_ux_batch1_governance =
    buildActiveHarnessReadPaths(input.policyPath);
  agentHarness.governance.mobile_ux_batch1_governance_policy =
    buildActiveHarnessPolicy(input.policyPath, input.activationRecordPath);
  agentHarness.compaction_keep.push(ACTIVE_HARNESS_COMPACTION_ANCHOR);
  docManifest.version = bumpVnextVersion(docManifest.version, 'doc-manifest');
  const authorityIndexes = docManifest.active_specs
    .map((value, index) => (value === 'spec/authority-map.json' ? index : -1))
    .filter((index) => index >= 0);
  if (authorityIndexes.length !== 1) {
    fail('doc-manifest must contain exactly one authority-map anchor');
  }
  docManifest.active_specs.splice(
    authorityIndexes[0] + 1,
    0,
    input.policyPath,
  );
  const agentsText = buildActiveAgents(
    input.agentsText,
    input.policyPath,
    input.activationRecordPath,
  );
  const result = Object.freeze({authorityMap, agentHarness, docManifest, agentsText});
  const classified = classifyGovernanceAnchorState({
    ...result,
    policyPath: input.policyPath,
    activationRecordPath: input.activationRecordPath,
  });
  if (classified !== 'active') fail('rebootstrap transition did not produce active state');
  return result;
}
