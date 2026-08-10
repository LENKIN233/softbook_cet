import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  ABSENT_ARTIFACT_SNAPSHOT,
  AUTHORITY_KEYS,
  BOOTSTRAP_INSTALLED_CLOSURE_PATHS,
  BOOTSTRAP_RUN_RECORD,
  BOOTSTRAP_TRUSTED_BASE_SHA,
  ESSENTIAL_RECOVERY_KERNEL_PATHS,
  FOUNDATION_ACTIVATION_DECISION,
  GOVERNANCE_ANCHOR_PATHS,
  MAINTENANCE_EXACT_ALLOWLIST,
  ORIGINAL_GOVERNANCE_POLICY,
  RECOVERY_NON_CLAIMS,
  RECOVERY_SCHEMA_VERSION,
  REQUIRED_CURRENT_RUN_GATE,
  TRUSTED_IDENTITY,
  ZERO_AUTHORITY,
  activeAgentsLines,
  artifactSnapshotFromBytes,
  buildActiveGovernanceDomain,
  buildChangedArtifactRecord,
  buildRebootstrapAnchorTransition,
  buildRevocationAnchorTransition,
  canonicalJson,
  classifyGovernanceAnchorState,
  deriveGovernanceState,
  governanceAnchorProjection,
  isMaintenancePayloadPath,
  parseRecoveryDecisionPath,
  parseRecoveryRunRecordPath,
  validateBootstrapInstalledProof,
  validateRecoveryDecision,
  validateVerifiedActiveLineageProof,
  validateVerifiedRevocationProof,
} from './lib/mobile_ux_batch1_governance_recovery_contract.mjs';

const BASE_SHA = 'a'.repeat(40);
const ACTIVE_POLICY_SHA256 = 'b'.repeat(64);
const PR_NUMBER = 731;
const SLUG = 'repair-api-reader';
const REVOCATION_CONTEXT = Object.freeze({
  decision_path:
    'docs/design/decisions/mobile-ux-batch1-governance-revocation-v1/pr-700-emergency-stop.json',
  raw_sha256: 'd'.repeat(64),
  materialization_pull_request: 700,
  materialization_head_sha: '1'.repeat(40),
  materialization_head_tree_sha: '2'.repeat(40),
  merge_commit_sha: '3'.repeat(40),
  merge_tree_sha: '2'.repeat(40),
});
const REBOOTSTRAP_CONTEXT = Object.freeze({
  decision_path:
    'docs/design/decisions/mobile-ux-batch1-governance-rebootstrap-v1/pr-731-restore-governance.json',
  raw_sha256: 'e'.repeat(64),
  materialization_pull_request: 731,
  materialization_head_sha: '4'.repeat(40),
  materialization_head_tree_sha: '5'.repeat(40),
  merge_commit_sha: '6'.repeat(40),
  merge_tree_sha: '5'.repeat(40),
});

function clone(value) {
  return structuredClone(value);
}

function snapshot(label) {
  return artifactSnapshotFromBytes(Buffer.from(label, 'utf8'));
}

function addRecord(relativePath, label = `head:${relativePath}`) {
  return buildChangedArtifactRecord(
    relativePath,
    ABSENT_ARTIFACT_SNAPSHOT,
    snapshot(label),
  );
}

function modifyRecord(relativePath) {
  return buildChangedArtifactRecord(
    relativePath,
    snapshot(`base:${relativePath}`),
    snapshot(`head:${relativePath}`),
  );
}

function deleteRecord(relativePath) {
  return buildChangedArtifactRecord(
    relativePath,
    snapshot(`base:${relativePath}`),
    ABSENT_ARTIFACT_SNAPSHOT,
  );
}

function trackedRecord(relativePath, label = relativePath) {
  const artifact = snapshot(label);
  return {
    path: relativePath,
    git_mode: artifact.git_mode,
    byte_length: artifact.byte_length,
    raw_sha256: artifact.raw_sha256,
  };
}

function bootstrapInstalledProof() {
  return {
    trusted_base_sha: BASE_SHA,
    bootstrap_materialization_pull_request: 730,
    bootstrap_materialization_pull_request_base_sha:
      BOOTSTRAP_TRUSTED_BASE_SHA,
    bootstrap_materialization_head_sha: '5'.repeat(40),
    bootstrap_materialization_head_tree_sha: '6'.repeat(40),
    bootstrap_merge_commit_sha: '4'.repeat(40),
    bootstrap_merge_tree_sha: '6'.repeat(40),
    bootstrap_run_record_introduction_commit_sha: '4'.repeat(40),
    bootstrap_run_record_unique_add_introduction_verified: true,
    bootstrap_commit_associated_pull_request_count: 1,
    remote_pull_request_merged: true,
    approved_head_tree_equals_merge_tree: true,
    bootstrap_merge_reachable_from_trusted_base: true,
    bootstrap_required_base_is_direct_first_parent_of_merge_and_strict_ancestor_of_trusted_base: true,
    inactive_anchors_verified: true,
    foundation_activation_decision_path: FOUNDATION_ACTIVATION_DECISION,
    foundation_activation_decision_present: false,
    bootstrap_run_record_artifact_at_merge: trackedRecord(
      BOOTSTRAP_RUN_RECORD,
      'bootstrap run record',
    ),
    bootstrap_run_record_artifact_at_trusted_base: trackedRecord(
      BOOTSTRAP_RUN_RECORD,
      'bootstrap run record',
    ),
    governance_transition_commits_after_bootstrap: [],
    closure_artifacts_at_bootstrap_merge: [...BOOTSTRAP_INSTALLED_CLOSURE_PATHS]
      .sort()
      .map((relativePath) => trackedRecord(relativePath, `bootstrap-merge:${relativePath}`)),
    closure_artifacts_at_trusted_base: [...BOOTSTRAP_INSTALLED_CLOSURE_PATHS]
      .sort()
      .map((relativePath) => trackedRecord(relativePath, `bootstrap:${relativePath}`)),
  };
}

function lineageEvent({
  decisionClass,
  decisionPath,
  runRecordPath,
  pullRequest,
  mergeCommitSha,
  parentMergeCommitSha,
  decisionRawSha256,
  decisionByteLength = 256,
  runRecordLabel = `lineage:${runRecordPath}`,
  headSha,
  treeSha,
}) {
  const decisionAtMerge = {
    path: decisionPath,
    git_mode: '100644',
    byte_length: decisionByteLength,
    raw_sha256: decisionRawSha256,
  };
  const runAtMerge = trackedRecord(runRecordPath, runRecordLabel);
  return {
    decision_class: decisionClass,
    decision_path: decisionPath,
    decision_artifact_at_merge: decisionAtMerge,
    decision_artifact_at_trusted_base: clone(decisionAtMerge),
    decision_introduction_commit_sha: mergeCommitSha,
    decision_unique_add_introduction_verified: true,
    run_record_artifact_at_merge: runAtMerge,
    run_record_artifact_at_trusted_base: clone(runAtMerge),
    run_record_introduction_commit_sha: mergeCommitSha,
    run_record_unique_add_introduction_verified: true,
    materialization_pull_request: pullRequest,
    materialization_head_sha: headSha,
    materialization_head_tree_sha: treeSha,
    merge_commit_sha: mergeCommitSha,
    merge_tree_sha: treeSha,
    parent_merge_commit_sha: parentMergeCommitSha,
    remote_pull_request_merged: true,
    approved_head_tree_equals_merge_tree: true,
    merge_commit_reachable_from_trusted_base: true,
  };
}

function verifiedRevocationProof({projectionDrift = false, unrelatedEvolution = false} = {}) {
  const mergeInput = inactiveAnchorInput();
  const trustedBaseInput = inactiveAnchorInput();
  if (unrelatedEvolution) {
    trustedBaseInput.authorityMap.domains.unrelated_after_revocation = {
      owner: 'spec/unrelated-after-revocation.json',
    };
    trustedBaseInput.agentHarness.read_paths.unrelated_after_revocation = [
      'spec/unrelated-after-revocation.json',
    ];
    trustedBaseInput.agentHarness.governance.unrelated_after_revocation = {
      owner: 'spec/unrelated-after-revocation.json',
    };
    trustedBaseInput.agentHarness.compaction_keep.push('unrelated_after_revocation');
    trustedBaseInput.docManifest.active_specs.push(
      'spec/unrelated-after-revocation.json',
    );
    trustedBaseInput.agentsText += '- unrelated instruction added later\n';
  }
  const mergeProjection = clone(governanceAnchorProjection(mergeInput));
  const trustedBaseProjection = clone(governanceAnchorProjection(trustedBaseInput));
  if (projectionDrift) {
    trustedBaseProjection.doc_manifest_policy_count = 1;
  }
  return {
    trusted_base_sha: BASE_SHA,
    revocation_context: clone(REVOCATION_CONTEXT),
    decision_artifact_at_merge: {
      path: REVOCATION_CONTEXT.decision_path,
      git_mode: '100644',
      byte_length: 128,
      raw_sha256: REVOCATION_CONTEXT.raw_sha256,
    },
    decision_artifact_at_trusted_base: {
      path: REVOCATION_CONTEXT.decision_path,
      git_mode: '100644',
      byte_length: 128,
      raw_sha256: REVOCATION_CONTEXT.raw_sha256,
    },
    decision_introduction_commit_sha: REVOCATION_CONTEXT.merge_commit_sha,
    decision_unique_add_introduction_verified: true,
    run_record_artifact_at_merge: trackedRecord(
      'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-revocation-pr-700-emergency-stop.md',
      'revocation run record',
    ),
    run_record_artifact_at_trusted_base: trackedRecord(
      'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-revocation-pr-700-emergency-stop.md',
      'revocation run record',
    ),
    run_record_introduction_commit_sha: REVOCATION_CONTEXT.merge_commit_sha,
    run_record_unique_add_introduction_verified: true,
    anchor_policy_path: ORIGINAL_GOVERNANCE_POLICY,
    anchor_projection_at_merge: mergeProjection,
    anchor_projection_at_trusted_base: trustedBaseProjection,
    remote_pull_request_merged: true,
    approved_head_tree_equals_merge_tree: true,
    merge_commit_reachable_from_trusted_base: true,
    base_history_transition_enumeration_complete: true,
    lineage_events: [
      lineageEvent({
        decisionClass: 'governance_foundation',
        decisionPath: FOUNDATION_ACTIVATION_DECISION,
        runRecordPath:
          'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-foundation-v1.md',
        pullRequest: 699,
        mergeCommitSha: '8'.repeat(40),
        parentMergeCommitSha: null,
        decisionRawSha256: '7'.repeat(64),
        headSha: 'a'.repeat(40),
        treeSha: 'b'.repeat(40),
      }),
      lineageEvent({
        decisionClass: 'governance_revocation',
        decisionPath: REVOCATION_CONTEXT.decision_path,
        runRecordPath:
          'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-revocation-pr-700-emergency-stop.md',
        pullRequest: REVOCATION_CONTEXT.materialization_pull_request,
        mergeCommitSha: REVOCATION_CONTEXT.merge_commit_sha,
        parentMergeCommitSha: '8'.repeat(40),
        decisionRawSha256: REVOCATION_CONTEXT.raw_sha256,
        decisionByteLength: 128,
        runRecordLabel: 'revocation run record',
        headSha: REVOCATION_CONTEXT.materialization_head_sha,
        treeSha: REVOCATION_CONTEXT.merge_tree_sha,
      }),
    ],
    governance_transition_commits_after_revocation: [],
  };
}

function verifiedActiveLineageProof() {
  const revoked = verifiedRevocationProof();
  const terminal = lineageEvent({
    decisionClass: 'governance_rebootstrap',
    decisionPath: REBOOTSTRAP_CONTEXT.decision_path,
    runRecordPath:
      'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-rebootstrap-pr-731-restore-governance.md',
    pullRequest: REBOOTSTRAP_CONTEXT.materialization_pull_request,
    mergeCommitSha: REBOOTSTRAP_CONTEXT.merge_commit_sha,
    parentMergeCommitSha: REVOCATION_CONTEXT.merge_commit_sha,
    decisionRawSha256: REBOOTSTRAP_CONTEXT.raw_sha256,
    decisionByteLength: 160,
    runRecordLabel: 'rebootstrap run record',
    headSha: REBOOTSTRAP_CONTEXT.materialization_head_sha,
    treeSha: REBOOTSTRAP_CONTEXT.merge_tree_sha,
  });
  return {
    trusted_base_sha: BASE_SHA,
    activation_context: clone(REBOOTSTRAP_CONTEXT),
    decision_artifact_at_merge: clone(terminal.decision_artifact_at_merge),
    decision_artifact_at_trusted_base: clone(
      terminal.decision_artifact_at_trusted_base,
    ),
    decision_introduction_commit_sha: terminal.decision_introduction_commit_sha,
    decision_unique_add_introduction_verified: true,
    run_record_artifact_at_merge: clone(terminal.run_record_artifact_at_merge),
    run_record_artifact_at_trusted_base: clone(
      terminal.run_record_artifact_at_trusted_base,
    ),
    run_record_introduction_commit_sha: terminal.run_record_introduction_commit_sha,
    run_record_unique_add_introduction_verified: true,
    remote_pull_request_merged: true,
    approved_head_tree_equals_merge_tree: true,
    merge_commit_reachable_from_trusted_base: true,
    base_history_transition_enumeration_complete: true,
    lineage_events: [...revoked.lineage_events, terminal],
    governance_transition_commits_after_activation: [],
  };
}

function decisionKind(decisionClass) {
  return decisionClass.replace(/^governance_/, '');
}

function makeDecision({
  decisionClass = 'governance_maintenance',
  operation = 'active_maintenance',
  from = 'active',
  to = 'active',
  payloadPaths = ['scripts/lib/mobile_ux_batch1_github_event_reader.mjs'],
  revocationContext = null,
  policySelection = null,
  pullRequest = PR_NUMBER,
  slug = SLUG,
} = {}) {
  const kind = decisionKind(decisionClass);
  const decisionPath =
    `docs/design/decisions/mobile-ux-batch1-governance-${kind}-v1/` +
    `pr-${pullRequest}-${slug}.json`;
  const runRecordPath =
    `docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-${kind}-` +
    `pr-${pullRequest}-${slug}.md`;
  const records = [addRecord(runRecordPath)];
  for (const relativePath of payloadPaths) {
    records.push(
      relativePath.startsWith('spec/mobile-ux-batch1-governance-epochs/')
        ? addRecord(relativePath, 'replacement policy bytes')
        : modifyRecord(relativePath),
    );
  }
  records.sort((left, right) => left.path.localeCompare(right.path));
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
    trusted_base_sha: BASE_SHA,
    decision_path: decisionPath,
    run_record_path: runRecordPath,
    state_transition: {from, to},
    revocation_context: revocationContext,
    policy_selection: policySelection,
    changed_artifacts: records,
    current_run_gate: clone(REQUIRED_CURRENT_RUN_GATE),
    authority: clone(ZERO_AUTHORITY),
    non_claims: [...RECOVERY_NON_CLAIMS],
  };
  const changedPaths = [decisionPath, ...records.map((record) => record.path)].sort();
  return {decision, changedPaths, records};
}

function validationContext(
  fixture,
  baseState,
  extra = {},
) {
  let anchorInput;
  let stateProof;
  if (baseState === 'active') {
    anchorInput = activeAnchorInput();
  } else {
    anchorInput = inactiveAnchorInput();
    if (baseState === 'inactive_bootstrap_installed') {
      stateProof = extra.bootstrapInstalledProof
        ? {kind: 'inactive_bootstrap_installed', proof: extra.bootstrapInstalledProof}
        : undefined;
    } else if (baseState === 'revoked') {
      stateProof = extra.verifiedRevocationProof
        ? {kind: 'revoked', proof: extra.verifiedRevocationProof}
        : undefined;
    } else if (baseState === 'inactive_initial') {
      stateProof = {kind: 'inactive_initial', proof: {}};
    }
  }
  return {
    decisionPath: fixture.decision.decision_path,
    pullRequest: fixture.decision.pull_request,
    trustedBaseSha: BASE_SHA,
    changedPaths: fixture.changedPaths,
    actualArtifactRecords: clone(fixture.records),
    anchorInput,
    stateProof,
    ...extra,
  };
}

function revokedPolicySelection() {
  return {
    mode: 'revoked_policy',
    path: ORIGINAL_GOVERNANCE_POLICY,
    raw_sha256: ACTIVE_POLICY_SHA256,
  };
}

function baseAgentsText() {
  return [
    '# AGENTS',
    '- `spec/doc-manifest.json`',
    '- 交付 / PR / CI：`authority-map -> agent-harness -> repo-delivery-contract -> evals`（涉及接收方环境、正式内容发布或回滚时追加 `runtime-boundaries -> infra/cloudbase/release-bundle-v1-runtime-contract.md`）',
    '- 不要把 `scripts/run_local_gates` 的本地报告当作 GitHub required checks、Agent review、正式内容批准或 launch readiness；`dev` / `pr` / `release` profile 与 `local-gate-report.v1` 以 `spec/harness-architecture.json#local_gate_runner_contract` 为准',
    'end',
    '',
  ].join('\n');
}

function inactiveAnchorInput({
  policyPath = ORIGINAL_GOVERNANCE_POLICY,
  activationRecordPath =
    'docs/design/decisions/mobile-ux-batch1-governance-foundation-v1.md',
} = {}) {
  return {
    authorityMap: {
      version: 'vnext-4',
      domains: {existing: {owner: 'spec/existing.json'}},
    },
    agentHarness: {
      version: 'vnext-23',
      read_paths: {existing: ['spec/existing.json']},
      governance: {existing: {owner: 'spec/existing.json'}},
      compaction_keep: ['existing_state'],
    },
    docManifest: {
      version: 'vnext-9',
      active_specs: ['spec/authority-map.json', 'spec/existing.json'],
    },
    agentsText: baseAgentsText(),
    policyPath,
    activationRecordPath,
  };
}

function activeAnchorInput({activationRecordPath = FOUNDATION_ACTIVATION_DECISION} = {}) {
  const active = buildRebootstrapAnchorTransition(
    inactiveAnchorInput({activationRecordPath}),
    {
      trustedBaseSha: BASE_SHA,
      verifiedRevocationProof: verifiedRevocationProof(),
    },
  );
  return {
    ...active,
    policyPath: ORIGINAL_GOVERNANCE_POLICY,
    activationRecordPath,
  };
}

test('common schema is closed and requires the canonical all-false authority keys', () => {
  const schema = JSON.parse(
    fs.readFileSync(
      new URL(
        '../spec/mobile-ux-batch1-governance-recovery-decision.schema.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(
    schema.$defs.allFalseAuthority.required,
    AUTHORITY_KEYS,
  );
  for (const key of AUTHORITY_KEYS) {
    assert.equal(schema.$defs.allFalseAuthority.properties[key].const, false);
  }
  assert.deepEqual(
    schema.properties.non_claims.prefixItems.map((entry) => entry.const),
    RECOVERY_NON_CLAIMS,
  );
  assert.equal(
    schema.properties.operation.enum.includes('rebootstrap_versioned_policy'),
    false,
  );
  assert.equal(
    schema.$defs.policySelection.properties.mode.enum.includes(
      'versioned_replacement_policy',
    ),
    false,
  );
  assert.match(schema.description, /current PR approval binds the decision artifact itself/);
});

test('dynamic decision and run-record paths bind class, PR, and slug', () => {
  assert.deepEqual(
    parseRecoveryDecisionPath(
      'docs/design/decisions/mobile-ux-batch1-governance-maintenance-v1/pr-731-repair-api-reader.json',
    ),
    {
      decisionClass: 'governance_maintenance',
      kind: 'maintenance',
      pullRequest: 731,
      slug: 'repair-api-reader',
    },
  );
  assert.deepEqual(
    parseRecoveryRunRecordPath(
      'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-maintenance-pr-731-repair-api-reader.md',
    ),
    {
      date: '2026-08-10',
      decisionClass: 'governance_maintenance',
      kind: 'maintenance',
      pullRequest: 731,
      slug: 'repair-api-reader',
    },
  );
  assert.equal(parseRecoveryDecisionPath('../escape.json'), null);
  assert.equal(parseRecoveryRunRecordPath('docs/agent-runs/not-canonical.md'), null);
});

test('maintenance allowlist excludes both immutable workflow roots and otherwise admits mirrors, schema, and fixture prefix only', () => {
  for (const relativePath of MAINTENANCE_EXACT_ALLOWLIST) {
    assert.equal(isMaintenancePayloadPath(relativePath), true, relativePath);
  }
  assert.equal(
    isMaintenancePayloadPath('.github/workflows/formal-approval.yml'),
    false,
  );
  assert.equal(
    isMaintenancePayloadPath('.github/workflows/pr-gates.yml'),
    false,
  );
  assert.equal(
    isMaintenancePayloadPath(
      'scripts/fixtures/mobile-ux-batch1-foundation-activation-v1/new-data.fixture',
    ),
    true,
  );
  assert.equal(
    isMaintenancePayloadPath(
      'scripts/fixtures/mobile-ux-batch1-foundation-activation-v1/bad\nname',
    ),
    false,
  );
  for (const forbidden of [
    '.github/workflows/formal-approval.yml',
    '.github/workflows/pr-gates.yml',
    'AGENTS.md',
    'spec/authority-map.json',
    'spec/agent-harness.json',
    'spec/doc-manifest.json',
    ORIGINAL_GOVERNANCE_POLICY,
    'apps/mobile/src/App.tsx',
    'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/registry-set.v2.proposal.json',
    'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/execution-manifests/run.json',
  ]) {
    assert.equal(isMaintenancePayloadPath(forbidden), false, forbidden);
  }
});

test('artifact records bind mode, length, digest, and presence transition', () => {
  const record = modifyRecord('scripts/classify_formal_approval_scope.mjs');
  assert.equal(record.change_type, 'modify');
  assert.equal(record.base.git_mode, '100644');
  assert.notEqual(record.base.raw_sha256, record.head.raw_sha256);
  assert.throws(
    () => buildChangedArtifactRecord('x', snapshot('same'), snapshot('same')),
    /different base and head/,
  );
  assert.throws(
    () => artifactSnapshotFromBytes(Buffer.from('x'), '120000'),
    /git mode 100644/,
  );
});

test('bootstrap-installed proof binds every nonempty essential base artifact and ancestry fact', () => {
  const proof = bootstrapInstalledProof();
  assert.equal(
    validateBootstrapInstalledProof(proof, BASE_SHA).state,
    'inactive_bootstrap_installed',
  );
  const missing = clone(proof);
  missing.closure_artifacts_at_bootstrap_merge.pop();
  assert.throws(
    () => validateBootstrapInstalledProof(missing, BASE_SHA),
    /must bind exactly/,
  );
  const empty = clone(proof);
  empty.closure_artifacts_at_trusted_base[0].byte_length = 0;
  assert.throws(
    () => validateBootstrapInstalledProof(empty, BASE_SHA),
    /byte_length must be positive/,
  );
  const maintained = clone(proof);
  maintained.closure_artifacts_at_trusted_base[0].raw_sha256 = '8'.repeat(64);
  assert.equal(
    validateBootstrapInstalledProof(maintained, BASE_SHA).state,
    'inactive_bootstrap_installed',
  );
  const unreachable = clone(proof);
  unreachable.bootstrap_merge_reachable_from_trusted_base = false;
  assert.throws(
    () => validateBootstrapInstalledProof(unreachable, BASE_SHA),
    /remote merge, tree equality, and strict ancestry facts/,
  );
  const activated = clone(proof);
  activated.foundation_activation_decision_present = true;
  assert.throws(
    () => validateBootstrapInstalledProof(activated, BASE_SHA),
    /fixed activation decision to be absent/,
  );
  const laterRevocation = clone(proof);
  laterRevocation.governance_transition_commits_after_bootstrap = [
    REVOCATION_CONTEXT.merge_commit_sha,
  ];
  assert.throws(
    () => validateBootstrapInstalledProof(laterRevocation, BASE_SHA),
    /no later activation or revocation lineage event/,
  );
  const runRecordDrift = clone(proof);
  runRecordDrift.bootstrap_run_record_artifact_at_trusted_base.raw_sha256 =
    '9'.repeat(64);
  assert.throws(
    () => validateBootstrapInstalledProof(runRecordDrift, BASE_SHA),
    /run-record bytes must remain equal/,
  );
  const ambiguousPullRequest = clone(proof);
  ambiguousPullRequest.bootstrap_commit_associated_pull_request_count = 2;
  assert.throws(
    () => validateBootstrapInstalledProof(ambiguousPullRequest, BASE_SHA),
    /exactly one associated pull request/,
  );
  const wrongBootstrapBase = clone(proof);
  wrongBootstrapBase.bootstrap_materialization_pull_request_base_sha =
    '0'.repeat(40);
  assert.throws(
    () => validateBootstrapInstalledProof(wrongBootstrapBase, BASE_SHA),
    /immutable bootstrap base/,
  );
});

test('verified revocation proof binds exact decision bytes, remote merge, ancestry, and Batch 1-owned revoked projections', () => {
  const proof = verifiedRevocationProof();
  assert.equal(
    validateVerifiedRevocationProof(proof, REVOCATION_CONTEXT, BASE_SHA).state,
    'revoked',
  );
  const decisionDrift = clone(proof);
  decisionDrift.decision_artifact_at_trusted_base.raw_sha256 = '9'.repeat(64);
  assert.throws(
    () =>
      validateVerifiedRevocationProof(
        decisionDrift,
        REVOCATION_CONTEXT,
        BASE_SHA,
      ),
    /decision bytes must match their materialization merge bytes/,
  );
  assert.throws(
    () =>
      validateVerifiedRevocationProof(
        verifiedRevocationProof({projectionDrift: true}),
        REVOCATION_CONTEXT,
        BASE_SHA,
      ),
    /exact revoked Batch 1-owned projection/,
  );
  assert.equal(
    validateVerifiedRevocationProof(
      verifiedRevocationProof({unrelatedEvolution: true}),
      REVOCATION_CONTEXT,
      BASE_SHA,
    ).state,
    'revoked',
  );
  const unreachable = clone(proof);
  unreachable.merge_commit_reachable_from_trusted_base = false;
  assert.throws(
    () =>
      validateVerifiedRevocationProof(
        unreachable,
        REVOCATION_CONTEXT,
        BASE_SHA,
      ),
    /remote merge and ancestry facts/,
  );
  const runRecordDrift = clone(proof);
  runRecordDrift.run_record_artifact_at_trusted_base.raw_sha256 = '6'.repeat(64);
  assert.throws(
    () =>
      validateVerifiedRevocationProof(
        runRecordDrift,
        REVOCATION_CONTEXT,
        BASE_SHA,
      ),
    /run-record bytes and identity must match/,
  );
  const historicalRunRecordDrift = clone(proof);
  historicalRunRecordDrift.lineage_events[0].run_record_artifact_at_trusted_base.raw_sha256 =
    '5'.repeat(64);
  assert.throws(
    () =>
      validateVerifiedRevocationProof(
        historicalRunRecordDrift,
        REVOCATION_CONTEXT,
        BASE_SHA,
      ),
    /decision and run-record bytes must remain equal/,
  );
});

test('foundation and latest verified dynamic rebootstrap are the only active activation records', () => {
  assert.equal(
    deriveGovernanceState({
      anchorInput: activeAnchorInput(),
      trustedBaseSha: BASE_SHA,
    }),
    'active',
  );
  const dynamicAnchorInput = activeAnchorInput({
    activationRecordPath: REBOOTSTRAP_CONTEXT.decision_path,
  });
  const proof = verifiedActiveLineageProof();
  assert.equal(
    validateVerifiedActiveLineageProof(
      proof,
      REBOOTSTRAP_CONTEXT,
      BASE_SHA,
    ).state,
    'active',
  );
  assert.equal(
    deriveGovernanceState({
      anchorInput: dynamicAnchorInput,
      trustedBaseSha: BASE_SHA,
      stateProof: {kind: 'verified_rebootstrap_active', proof},
    }),
    'active',
  );
  assert.throws(
    () =>
      deriveGovernanceState({
        anchorInput: dynamicAnchorInput,
        trustedBaseSha: BASE_SHA,
      }),
    /dynamic active governance state proof|verified rebootstrap lineage proof/,
  );

  const crossFieldMismatch = clone(dynamicAnchorInput);
  crossFieldMismatch.agentHarness.governance.mobile_ux_batch1_governance_policy.activation_decision =
    'docs/design/decisions/mobile-ux-batch1-governance-rebootstrap-v1/pr-732-stale.json';
  assert.throws(
    () => classifyGovernanceAnchorState(crossFieldMismatch),
    /partial or inconsistent/,
  );

  const staleDynamicPath = activeAnchorInput({
    activationRecordPath:
      'docs/design/decisions/mobile-ux-batch1-governance-rebootstrap-v1/pr-732-stale.json',
  });
  assert.throws(
    () =>
      deriveGovernanceState({
        anchorInput: staleDynamicPath,
        trustedBaseSha: BASE_SHA,
        stateProof: {kind: 'verified_rebootstrap_active', proof},
      }),
    /latest verified rebootstrap decision/,
  );
});

test('bootstrap-installed maintenance is a protected positive transition', () => {
  const fixture = makeDecision({
    operation: 'bootstrap_maintenance',
    from: 'inactive_bootstrap_installed',
    to: 'inactive_bootstrap_installed',
    payloadPaths: ['scripts/classify_formal_approval_scope.mjs'],
  });
  const result = validateRecoveryDecision(
    fixture.decision,
    validationContext(fixture, 'inactive_bootstrap_installed', {
      bootstrapInstalledProof: bootstrapInstalledProof(),
    }),
  );
  assert.equal(result.status, 'valid');
  assert.equal(result.target_state, 'inactive_bootstrap_installed');
});

test('active maintenance accepts trusted API-reader and fixture repairs', () => {
  const fixture = makeDecision({
    payloadPaths: [
      'scripts/lib/mobile_ux_batch1_github_event_reader.mjs',
      'scripts/fixtures/mobile-ux-batch1-foundation-activation-v1/new-api.fixture',
    ],
  });
  const result = validateRecoveryDecision(
    fixture.decision,
    validationContext(fixture, 'active'),
  );
  assert.equal(result.operation, 'active_maintenance');
  assert.equal(
    result.gate_effect,
    'none_before_current_run_protected_owner_approval_and_merge',
  );
});

test('revoked recovery requires a verified merged revocation context', () => {
  const fixture = makeDecision({
    operation: 'revoked_recovery',
    from: 'revoked',
    to: 'revoked',
    revocationContext: clone(REVOCATION_CONTEXT),
    payloadPaths: ['scripts/validate_mobile_ux_batch1_governance.mjs'],
  });
  assert.equal(
    validateRecoveryDecision(
      fixture.decision,
      validationContext(fixture, 'revoked', {
        verifiedRevocationProof: verifiedRevocationProof(),
      }),
    ).status,
    'valid',
  );
  assert.throws(
    () =>
      validateRecoveryDecision(
        fixture.decision,
        validationContext(fixture, 'revoked'),
      ),
    /inactive governance state proof must be a plain object/,
  );
});

test('revocation changes exactly four anchors plus the run record and records the active policy', () => {
  const fixture = makeDecision({
    decisionClass: 'governance_revocation',
    operation: 'revoke_active_governance',
    from: 'active',
    to: 'revoked',
    payloadPaths: [...GOVERNANCE_ANCHOR_PATHS],
    policySelection: revokedPolicySelection(),
    slug: 'emergency-stop',
  });
  const result = validateRecoveryDecision(
    fixture.decision,
    validationContext(fixture, 'active', {
      activePolicyPath: ORIGINAL_GOVERNANCE_POLICY,
      activePolicyRawSha256: ACTIVE_POLICY_SHA256,
    }),
  );
  assert.equal(result.target_state, 'revoked');
});

test('same-policy rebootstrap changes only anchors plus run record', () => {
  const fixture = makeDecision({
    decisionClass: 'governance_rebootstrap',
    operation: 'rebootstrap_same_policy',
    from: 'revoked',
    to: 'active',
    payloadPaths: [...GOVERNANCE_ANCHOR_PATHS],
    revocationContext: clone(REVOCATION_CONTEXT),
    policySelection: {
      mode: 'reuse_revoked_policy',
      path: ORIGINAL_GOVERNANCE_POLICY,
      raw_sha256: ACTIVE_POLICY_SHA256,
    },
    slug: 'restore-governance',
  });
  assert.equal(
    validateRecoveryDecision(
      fixture.decision,
      validationContext(fixture, 'revoked', {
        verifiedRevocationProof: verifiedRevocationProof(),
        revokedPolicyPath: ORIGINAL_GOVERNANCE_POLICY,
        revokedPolicyRawSha256: ACTIVE_POLICY_SHA256,
      }),
    ).target_state,
    'active',
  );
});

test('v1 rebootstrap rejects a new policy rather than activating unvalidated JSON', () => {
  const replacementPath =
    'spec/mobile-ux-batch1-governance-epochs/epoch-2-policy-repair.json';
  const fixture = makeDecision({
    decisionClass: 'governance_rebootstrap',
    operation: 'rebootstrap_versioned_policy',
    from: 'revoked',
    to: 'active',
    payloadPaths: [...GOVERNANCE_ANCHOR_PATHS, replacementPath],
    revocationContext: clone(REVOCATION_CONTEXT),
    policySelection: {
      mode: 'versioned_replacement_policy',
      path: replacementPath,
      raw_sha256: 'c'.repeat(64),
    },
    slug: 'replace-policy',
  });
  const policyRecord = fixture.decision.changed_artifacts.find(
    (record) => record.path === replacementPath,
  );
  fixture.decision.policy_selection.raw_sha256 = policyRecord.head.raw_sha256;
  assert.throws(
    () =>
      validateRecoveryDecision(
        fixture.decision,
        validationContext(fixture, 'revoked', {
          verifiedRevocationProof: verifiedRevocationProof(),
          revokedPolicyPath: ORIGINAL_GOVERNANCE_POLICY,
          revokedPolicyRawSha256: ACTIVE_POLICY_SHA256,
        }),
      ),
    /rebootstrap operation is unsupported/,
  );
});

test('decision self is excluded while every other changed path including run record is bound', () => {
  const fixture = makeDecision();
  assert.equal(
    fixture.records.some((record) => record.path === fixture.decision.decision_path),
    false,
  );
  assert.equal(
    fixture.records.some((record) => record.path === fixture.decision.run_record_path),
    true,
  );
  const missing = clone(fixture);
  missing.decision.changed_artifacts.pop();
  assert.throws(
    () =>
      validateRecoveryDecision(
        missing.decision,
        validationContext(missing, 'active'),
      ),
    /bind every changed path except the decision/,
  );
});

test('artifact digest or mode drift fails closed', () => {
  const fixture = makeDecision();
  const context = validationContext(fixture, 'active');
  context.actualArtifactRecords[0].head.raw_sha256 = 'e'.repeat(64);
  assert.throws(
    () => validateRecoveryDecision(fixture.decision, context),
    /do not match recomputed Git artifacts/,
  );
  const badMode = clone(fixture);
  badMode.decision.changed_artifacts[0].head.git_mode = '120000';
  assert.throws(
    () =>
      validateRecoveryDecision(
        badMode.decision,
        validationContext(badMode, 'active'),
      ),
    /git_mode must be 100644/,
  );
});

test('maintenance cannot change immutable workflows, active anchors, product UI, subjects, receipts, or execution manifests', () => {
  for (const forbidden of [
    '.github/workflows/formal-approval.yml',
    '.github/workflows/pr-gates.yml',
    'AGENTS.md',
    'apps/mobile/src/App.tsx',
    'docs/design/decisions/mobile-ux-batch1-preparation-v1.approval-receipt.json',
    'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/registry-set.v2.proposal.json',
    'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/execution-manifests/run.json',
  ]) {
    const fixture = makeDecision({payloadPaths: [forbidden]});
    assert.throws(
      () =>
        validateRecoveryDecision(
          fixture.decision,
          validationContext(fixture, 'active'),
        ),
      /not allowlisted/,
      forbidden,
    );
  }
});

test('maintenance cannot delete or empty an essential recovery kernel artifact', () => {
  for (const relativePath of ESSENTIAL_RECOVERY_KERNEL_PATHS) {
    assert.equal(
      MAINTENANCE_EXACT_ALLOWLIST.includes(relativePath),
      ![
        '.github/workflows/formal-approval.yml',
        '.github/workflows/pr-gates.yml',
      ].includes(relativePath),
    );
  }
  const deleted = makeDecision({
    payloadPaths: ['scripts/lib/strict_json.mjs'],
  });
  const deletedIndex = deleted.records.findIndex(
    (record) => record.path === 'scripts/lib/strict_json.mjs',
  );
  deleted.records[deletedIndex] = deleteRecord(
    'scripts/lib/strict_json.mjs',
  );
  assert.throws(
    () =>
      validateRecoveryDecision(
        deleted.decision,
        validationContext(deleted, 'active'),
      ),
    /cannot delete protected allowlist path/,
  );

  const emptied = makeDecision({
    payloadPaths: ['scripts/classify_formal_approval_scope.mjs'],
  });
  const emptyIndex = emptied.records.findIndex(
    (record) => record.path === 'scripts/classify_formal_approval_scope.mjs',
  );
  emptied.records[emptyIndex] = buildChangedArtifactRecord(
    'scripts/classify_formal_approval_scope.mjs',
    snapshot('base classifier'),
    artifactSnapshotFromBytes(Buffer.alloc(0)),
  );
  assert.throws(
    () =>
      validateRecoveryDecision(
        emptied.decision,
        validationContext(emptied, 'active'),
      ),
    /preserve a nonempty 100644 recovery kernel path/,
  );
});

test('non-authoritative fixture deletion remains scoped and does not remove the recovery kernel', () => {
  const fixturePath =
    'scripts/fixtures/mobile-ux-batch1-foundation-activation-v1/obsolete.fixture';
  const fixture = makeDecision({payloadPaths: [fixturePath]});
  const index = fixture.records.findIndex((record) => record.path === fixturePath);
  fixture.records[index] = deleteRecord(fixturePath);
  assert.equal(
    validateRecoveryDecision(
      fixture.decision,
      validationContext(fixture, 'active'),
    ).status,
    'valid',
  );
});

test('initial inactive, unverified bootstrap, and wrong-state transitions fail closed', () => {
  const bootstrap = makeDecision({
    operation: 'bootstrap_maintenance',
    from: 'inactive_bootstrap_installed',
    to: 'inactive_bootstrap_installed',
  });
  assert.throws(
    () =>
      validateRecoveryDecision(
        bootstrap.decision,
        validationContext(bootstrap, 'inactive_bootstrap_installed'),
      ),
    /inactive governance state proof must be a plain object/,
  );
  const active = makeDecision();
  assert.throws(
    () =>
      validateRecoveryDecision(
        active.decision,
        validationContext(active, 'inactive_initial'),
      ),
    /trusted bootstrap-installed or revoked lineage proof/,
  );
  assert.throws(
    () =>
      validateRecoveryDecision(
        active.decision,
        validationContext(active, 'revoked', {
          verifiedRevocationProof: verifiedRevocationProof(),
        }),
      ),
    /exact verified trusted-base revocation context|cannot run from revoked/,
  );
});

test('all sixteen authority values and the current-run gate are immutable', () => {
  const authorityDrift = makeDecision();
  authorityDrift.decision.authority.visual = true;
  assert.throws(
    () =>
      validateRecoveryDecision(
        authorityDrift.decision,
        validationContext(authorityDrift, 'active'),
      ),
    /authority.visual must be false/,
  );
  const gateDrift = makeDecision();
  gateDrift.decision.current_run_gate.merge_required = false;
  assert.throws(
    () =>
      validateRecoveryDecision(
        gateDrift.decision,
        validationContext(gateDrift, 'active'),
      ),
    /current-run gate does not match/,
  );
});

test('PR, slug, base SHA, and revocation merge-tree binding drift fails closed', () => {
  const pathDrift = makeDecision();
  pathDrift.decision.pull_request += 1;
  assert.throws(
    () =>
      validateRecoveryDecision(
        pathDrift.decision,
        validationContext(pathDrift, 'active'),
      ),
    /pull request must match decision_path/,
  );
  const baseDrift = makeDecision();
  baseDrift.decision.trusted_base_sha = 'f'.repeat(40);
  assert.throws(
    () =>
      validateRecoveryDecision(
        baseDrift.decision,
        validationContext(baseDrift, 'active'),
      ),
    /trusted base SHA does not match/,
  );
  const revoked = makeDecision({
    operation: 'revoked_recovery',
    from: 'revoked',
    to: 'revoked',
    revocationContext: {
      ...REVOCATION_CONTEXT,
      merge_tree_sha: '9'.repeat(40),
    },
  });
  assert.throws(
    () =>
      validateRecoveryDecision(
        revoked.decision,
        validationContext(revoked, 'revoked', {
          verifiedRevocationProof: verifiedRevocationProof(),
        }),
      ),
    /head tree must equal squash merge tree/,
  );
  const otherValidRevocationContext = {
    ...REVOCATION_CONTEXT,
    materialization_head_sha: '7'.repeat(40),
    materialization_head_tree_sha: '8'.repeat(40),
    merge_commit_sha: '9'.repeat(40),
    merge_tree_sha: '8'.repeat(40),
  };
  const crossProofMismatch = makeDecision({
    operation: 'revoked_recovery',
    from: 'revoked',
    to: 'revoked',
    revocationContext: otherValidRevocationContext,
  });
  assert.throws(
    () =>
      validateRecoveryDecision(
        crossProofMismatch.decision,
        validationContext(crossProofMismatch, 'revoked', {
          verifiedRevocationProof: verifiedRevocationProof(),
        }),
      ),
    /exact verified trusted-base revocation context/,
  );
});

test('inactive anchors require trusted lineage proof and cannot be selected by a boolean', () => {
  const inactive = inactiveAnchorInput();
  assert.equal(classifyGovernanceAnchorState(inactive), 'inactive_anchors');
  assert.equal(
    deriveGovernanceState({
      anchorInput: inactive,
      trustedBaseSha: BASE_SHA,
      stateProof: {
        kind: 'inactive_bootstrap_installed',
        proof: bootstrapInstalledProof(),
      },
    }),
    'inactive_bootstrap_installed',
  );
  assert.equal(
    deriveGovernanceState({
      anchorInput: inactive,
      trustedBaseSha: BASE_SHA,
      stateProof: {kind: 'revoked', proof: verifiedRevocationProof()},
    }),
    'revoked',
  );
  const revokedAsBootstrap = bootstrapInstalledProof();
  revokedAsBootstrap.foundation_activation_decision_present = true;
  revokedAsBootstrap.governance_transition_commits_after_bootstrap = [
    REVOCATION_CONTEXT.merge_commit_sha,
  ];
  assert.throws(
    () =>
      deriveGovernanceState({
        anchorInput: inactive,
        trustedBaseSha: BASE_SHA,
        stateProof: {
          kind: 'inactive_bootstrap_installed',
          proof: revokedAsBootstrap,
        },
      }),
    /fixed activation decision to be absent/,
  );
});

test('rebootstrap forward and revocation inverse helpers change only canonical anchors', () => {
  const activationRecordPath =
    'docs/design/decisions/mobile-ux-batch1-governance-rebootstrap-v1/pr-731-restore-governance.json';
  const inactive = inactiveAnchorInput({activationRecordPath});
  const active = buildRebootstrapAnchorTransition(inactive, {
    trustedBaseSha: BASE_SHA,
    verifiedRevocationProof: verifiedRevocationProof(),
  });
  assert.equal(
    classifyGovernanceAnchorState({
      ...active,
      policyPath: ORIGINAL_GOVERNANCE_POLICY,
      activationRecordPath,
    }),
    'active',
  );
  assert.equal(active.authorityMap.version, 'vnext-5');
  assert.deepEqual(
    active.authorityMap.domains.mobile_ux_batch1_governance,
    buildActiveGovernanceDomain(ORIGINAL_GOVERNANCE_POLICY, activationRecordPath),
  );
  for (const line of activeAgentsLines(ORIGINAL_GOVERNANCE_POLICY)) {
    assert.equal(active.agentsText.split('\n').filter((candidate) => candidate === line).length, 1);
  }

  const revoked = buildRevocationAnchorTransition({
    ...active,
    policyPath: ORIGINAL_GOVERNANCE_POLICY,
    activationRecordPath,
  });
  const revokedAnchorInput = {
    ...revoked,
    policyPath: ORIGINAL_GOVERNANCE_POLICY,
    activationRecordPath,
  };
  assert.equal(classifyGovernanceAnchorState(revokedAnchorInput), 'inactive_anchors');
  assert.equal(
    deriveGovernanceState({
      anchorInput: revokedAnchorInput,
      trustedBaseSha: BASE_SHA,
      stateProof: {kind: 'revoked', proof: verifiedRevocationProof()},
    }),
    'revoked',
  );
  assert.equal(revoked.authorityMap.version, 'vnext-6');
  assert.equal(revoked.agentHarness.version, 'vnext-25');
  assert.equal(revoked.docManifest.version, 'vnext-11');
  assert.equal(revoked.agentsText, inactive.agentsText);
  assert.deepEqual(revoked.authorityMap.domains, inactive.authorityMap.domains);
  assert.deepEqual(revoked.agentHarness.read_paths, inactive.agentHarness.read_paths);
  assert.deepEqual(revoked.agentHarness.governance, inactive.agentHarness.governance);
  assert.deepEqual(revoked.agentHarness.compaction_keep, inactive.agentHarness.compaction_keep);
  assert.deepEqual(revoked.docManifest.active_specs, inactive.docManifest.active_specs);
});

test('AGENTS unrelated evolution and active-line movement cannot lock revocation or rebootstrap', () => {
  const activationRecordPath = REBOOTSTRAP_CONTEXT.decision_path;
  const inactive = inactiveAnchorInput({activationRecordPath});
  inactive.agentsText = [
    '# independently evolved AGENTS',
    '- renamed source-list guidance',
    '- rewritten delivery guidance',
    '- rewritten gate guidance',
    'end',
    '',
  ].join('\n');
  const active = buildRebootstrapAnchorTransition(inactive, {
    trustedBaseSha: BASE_SHA,
    verifiedRevocationProof: verifiedRevocationProof({unrelatedEvolution: true}),
  });
  const activationLines = activeAgentsLines(ORIGINAL_GOVERNANCE_POLICY);
  const nonOwnedLines = active.agentsText
    .split('\n')
    .filter((line) => !activationLines.includes(line));
  const movedLines = [...nonOwnedLines];
  movedLines.splice(1, 0, activationLines[3], activationLines[0]);
  movedLines.splice(4, 0, activationLines[4], activationLines[2], activationLines[1]);
  const activeInput = {
    ...active,
    agentsText: movedLines.join('\n'),
    policyPath: ORIGINAL_GOVERNANCE_POLICY,
    activationRecordPath,
  };
  assert.equal(classifyGovernanceAnchorState(activeInput), 'active');
  const revoked = buildRevocationAnchorTransition(activeInput);
  assert.equal(
    classifyGovernanceAnchorState({
      ...revoked,
      policyPath: ORIGINAL_GOVERNANCE_POLICY,
      activationRecordPath,
    }),
    'inactive_anchors',
  );
  for (const line of activationLines) {
    assert.equal(revoked.agentsText.split('\n').includes(line), false);
  }
});

test('partial active anchors fail closed instead of being treated as inactive', () => {
  const activationRecordPath =
    'docs/design/decisions/mobile-ux-batch1-governance-foundation-v1.md';
  const active = buildRebootstrapAnchorTransition(
    inactiveAnchorInput({activationRecordPath}),
    {
      trustedBaseSha: BASE_SHA,
      verifiedRevocationProof: verifiedRevocationProof(),
    },
  );
  delete active.authorityMap.domains.mobile_ux_batch1_governance;
  assert.throws(
    () =>
      classifyGovernanceAnchorState({
        ...active,
        policyPath: ORIGINAL_GOVERNANCE_POLICY,
        activationRecordPath,
      }),
    /partial or inconsistent/,
  );
});

test('canonical JSON comparison is key-order independent but array-order sensitive', () => {
  assert.equal(canonicalJson({b: 2, a: 1}), canonicalJson({a: 1, b: 2}));
  assert.notEqual(canonicalJson([2, 1]), canonicalJson([1, 2]));
});
