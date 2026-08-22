#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ARTIFACT_PATHS,
  AUTHORITY_KEYS,
  BATCH1_SUBJECT_PATHS,
  DECISION_TTL_CEILINGS_SECONDS,
  HISTORICAL_PREPARATION,
  INVALIDATION_CONDITIONS_BY_KIND,
  LEGACY_SUBJECT_PATHS,
  PROVIDER_STATUS_RETENTION_SECONDS,
  TRUSTED_IDENTITY,
  assertExactKeys,
  authorityMaskFor,
  buildLegacyPreparationParentTuple,
  canonicalJson,
  computeApprovalInstanceDigest,
  computeDesignatedCohortDigest,
  computeHistoricalPreparationApprovalInstanceDigest,
  computeLegacyPreparationApprovalInstanceDigest,
  computeLegacyPreparationReceiptDigest,
  computeSubjectDigest,
  domainSeparatedDigest,
  evaluateReceiptValidity,
  governancePolicyProjectionFromSpec,
  normalizeGitHubOrigin,
  projectGitHubApprovalEvent,
  sha256Hex,
  validateApprovalReceipt,
  validateAuthorityMask,
  validateDecisionIntent,
  validateGovernancePolicy,
  validateHistoricalPreparationEventProjection,
  validateLegacyPreparationReceipt,
  validateParentTuple,
  validatePrivacyAttestation,
  validateReceiptMaterializationDecision,
  validateRepositoryIdentity,
  validateSingleDecisionArtifact,
  validateSubjectBinding,
} from './lib/mobile_ux_batch1_governance_contract.mjs';

const BASE_SHA = '1'.repeat(40);
const HEAD_SHA = '2'.repeat(40);
const MATERIALIZATION_SHA = '4'.repeat(40);
const PARENT_HEAD_SHA = '5'.repeat(40);

function clone(value) {
  return structuredClone(value);
}

function hash(label) {
  return sha256Hex(label);
}

function artifactRecords(paths, prefix) {
  return paths.map((path, index) => ({
    path,
    git_mode: '100644',
    byte_length: 1000 + index,
    raw_sha256: hash(`${prefix}:${path}:${index}`),
  }));
}

function makePolicy() {
  return {
    schema_version: 'mobile-ux-batch1-decision-validity-policy.v1',
    source_path: ARTIFACT_PATHS.governancePolicy,
    policy_owner: TRUSTED_IDENTITY.reviewerImmutableId,
    global_max_validity_seconds: PROVIDER_STATUS_RETENTION_SECONDS,
    class_policies: {
      legacy_receipt_migration: {
        max_validity_seconds: DECISION_TTL_CEILINGS_SECONDS.legacy_receipt_migration,
        max_validity_days: 7,
        ordered_invalidation_condition_ids:
          [...INVALIDATION_CONDITIONS_BY_KIND.legacy_receipt_migration],
      },
      cohort_designation: {
        max_validity_seconds: DECISION_TTL_CEILINGS_SECONDS.cohort_designation,
        max_validity_days: 30,
        ordered_invalidation_condition_ids:
          [...INVALIDATION_CONDITIONS_BY_KIND.cohort_designation],
      },
      manifest_freeze: {
        max_validity_seconds: DECISION_TTL_CEILINGS_SECONDS.manifest_freeze,
        max_validity_days: 14,
        ordered_invalidation_condition_ids:
          [...INVALIDATION_CONDITIONS_BY_KIND.manifest_freeze],
      },
    },
  };
}

function makeSpecPolicy() {
  return {
    schema_version: 'mobile-ux-batch1-decision-validity-policy.v1',
    policy_owner: TRUSTED_IDENTITY.reviewerImmutableId,
    validity_anchor_field: 'validity_anchor_at',
    validity_anchor_source: 'verified_deployment_waiting_status.created_at',
    global_max_validity_seconds: PROVIDER_STATUS_RETENTION_SECONDS,
    global_max_validity_days: 90,
    expires_at_required: true,
    expires_at_must_be_after_success_observed_at: true,
    expires_at_must_not_exceed_validity_anchor_plus_class_max_validity_seconds: true,
    use_time_must_be_strictly_before_expires_at: true,
    unknown_or_unimplemented_invalidation_condition_fails_closed: true,
    class_policies: {
      legacy_preparation_receipt_migration: clone(
        makePolicy().class_policies.legacy_receipt_migration,
      ),
      cohort_designation: clone(makePolicy().class_policies.cohort_designation),
      manifest_freeze: clone(makePolicy().class_policies.manifest_freeze),
    },
    all_class_maxima_must_be_at_most_global_maximum: true,
    invalidation_conditions_must_exactly_equal_class_ordered_list: true,
    later_inactive_deployment_status_alone_does_not_invalidate: true,
  };
}

function makeEventEvidence({
  pullRequest = 484,
  headSha = HEAD_SHA,
  runId = 31337114199,
  deploymentId = 5823098843,
  waitingStatusId = 16590000001,
  successStatusId = 16590000004,
  waitingAt = '2026-08-10T00:00:00Z',
  successAt = '2026-08-10T00:00:04Z',
  includeInactive = false,
} = {}) {
  const deploymentStatuses = [
    {
      id: successStatusId,
      state: 'success',
      created_at: successAt,
      environment: TRUSTED_IDENTITY.environmentName,
    },
    {
      id: successStatusId - 1,
      state: 'in_progress',
      created_at: '2026-08-10T00:00:03Z',
      environment: TRUSTED_IDENTITY.environmentName,
    },
    {
      id: successStatusId - 2,
      state: 'queued',
      created_at: '2026-08-10T00:00:02Z',
      environment: TRUSTED_IDENTITY.environmentName,
    },
    {
      id: waitingStatusId,
      state: 'waiting',
      created_at: waitingAt,
      environment: TRUSTED_IDENTITY.environmentName,
    },
  ];
  if (includeInactive) {
    deploymentStatuses.unshift({
      id: successStatusId + 100,
      state: 'inactive',
      created_at: '2026-08-10T00:10:00Z',
      environment: TRUSTED_IDENTITY.environmentName,
    });
  }
  return {
    origin: 'git@github.com:LENKIN233/softbook_cet.git',
    repository: {
      id: TRUSTED_IDENTITY.repositoryId,
      full_name: TRUSTED_IDENTITY.repository,
    },
    pull_request: {
      number: pullRequest,
      base_ref: TRUSTED_IDENTITY.protectedBaseRef,
      base_sha: BASE_SHA,
      base_repository_id: TRUSTED_IDENTITY.repositoryId,
      head_repository_id: TRUSTED_IDENTITY.repositoryId,
    },
    workflow_run: {
      id: runId,
      run_attempt: 1,
      workflow_id: TRUSTED_IDENTITY.workflowId,
      event: 'pull_request_target',
      path: TRUSTED_IDENTITY.workflowPath,
      head_sha: headSha,
      conclusion: 'success',
      repository_id: TRUSTED_IDENTITY.repositoryId,
    },
    deployment: {
      id: deploymentId,
      sha: headSha,
      environment_id: TRUSTED_IDENTITY.environmentId,
      environment_name: TRUSTED_IDENTITY.environmentName,
    },
    environment: {
      id: TRUSTED_IDENTITY.environmentId,
      name: TRUSTED_IDENTITY.environmentName,
      can_admins_bypass: false,
      required_reviewer_ids: [TRUSTED_IDENTITY.reviewerDatabaseId],
    },
    approval_reviews: [
      {
        state: 'approved',
        comment: `Approve exact Batch 1 governance decision at ${headSha}`,
        environments: [
          {
            id: TRUSTED_IDENTITY.environmentId,
            name: TRUSTED_IDENTITY.environmentName,
          },
        ],
        user: {
          id: TRUSTED_IDENTITY.reviewerDatabaseId,
          login: TRUSTED_IDENTITY.reviewerLogin,
        },
      },
    ],
    deployment_statuses: deploymentStatuses,
  };
}

function makeHistoricalEventProjection() {
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
      deployment_waiting_status_id:
        HISTORICAL_PREPARATION.deploymentWaitingStatusId,
      deployment_success_status_id:
        HISTORICAL_PREPARATION.deploymentSuccessStatusId,
      environment_id: TRUSTED_IDENTITY.environmentId,
      environment_name: TRUSTED_IDENTITY.environmentName,
      reviewer_immutable_id: TRUSTED_IDENTITY.reviewerImmutableId,
      approval_review_sha256: HISTORICAL_PREPARATION.approvalReviewSha256,
      validity_anchor_at: '2026-08-09T17:28:06Z',
      success_observed_at: '2026-08-09T17:30:24Z',
    },
    authority_event_sha256: HISTORICAL_PREPARATION.authorityEventSha256,
  };
}

function makeSubject(kind) {
  const paths = kind === 'legacy_receipt_migration' ? LEGACY_SUBJECT_PATHS : BATCH1_SUBJECT_PATHS;
  const records = kind === 'legacy_receipt_migration'
    ? [{
        path: HISTORICAL_PREPARATION.subjectPath,
        git_mode: '100644',
        byte_length: HISTORICAL_PREPARATION.subjectByteLength,
        raw_sha256: HISTORICAL_PREPARATION.subjectRawSha256,
      }]
    : artifactRecords(paths, kind);
  const domain = {
    legacy_receipt_migration:
      'softbook-cet/mobile-ux-batch1-legacy-preparation-subject/v1',
    cohort_designation: 'softbook-cet/mobile-ux-batch1-designation-subject/v1',
    manifest_freeze: 'softbook-cet/mobile-ux-batch1-final-freeze-subject/v1',
  }[kind];
  return {
    commit: kind === 'legacy_receipt_migration'
      ? HISTORICAL_PREPARATION.approvalTargetHeadSha
      : HEAD_SHA,
    digest_domain: domain,
    digest: computeSubjectDigest(domain, records),
    artifact_records: records,
  };
}

function makePolicyArtifactRecord() {
  return artifactRecords([ARTIFACT_PATHS.governancePolicy], 'policy')[0];
}

function makePrivacyAttestation(subject, cohortId, cohortSha256) {
  return {
    schema_version: 'mobile-ux-batch1-non-pii-attestation.v1',
    designation_subject_commit: subject.commit,
    designation_subject_digest_domain: subject.digest_domain,
    designation_subject_digest: subject.digest,
    designated_cohort_id: cohortId,
    designated_cohort_sha256: cohortSha256,
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

function makeParentTuple({
  parentClass = 'schema_definition',
  parentDecisionId = 'mobile-ux-batch1-preparation-v1',
  approvalInstanceDigest = hash('parent-approval-instance'),
} = {}) {
  return {
    parent_decision_id: parentDecisionId,
    parent_decision_class: parentClass,
    parent_approval_target_head_sha: PARENT_HEAD_SHA,
    parent_receipt_materialization_commit_sha: MATERIALIZATION_SHA,
    parent_receipt_materialization_pull_request: 583,
    parent_decision_artifact_path: ARTIFACT_PATHS.legacyMigrationIntent,
    parent_decision_artifact_raw_sha256: hash('parent-decision-artifact'),
    parent_receipt_path: ARTIFACT_PATHS.legacyPreparationReceipt,
    parent_receipt_raw_sha256: hash('parent-receipt'),
    parent_subject_commit: PARENT_HEAD_SHA,
    parent_subject_digest_domain: 'softbook-cet/mobile-ux-batch1-parent-subject/v1',
    parent_subject_digest: hash('parent-subject'),
    parent_repository_id: TRUSTED_IDENTITY.repositoryId,
    parent_workflow_id: TRUSTED_IDENTITY.workflowId,
    parent_workflow_run_id: 31300000000,
    parent_run_attempt: 1,
    parent_deployment_id: 5820000000,
    parent_deployment_waiting_status_id: 16570000001,
    parent_deployment_success_status_id: 16570000002,
    parent_environment_id: TRUSTED_IDENTITY.environmentId,
    parent_environment_name: TRUSTED_IDENTITY.environmentName,
    parent_approval_review_sha256: hash('parent-approval-review'),
    parent_reviewer_immutable_id: TRUSTED_IDENTITY.reviewerImmutableId,
    parent_validity_anchor_at: '2026-08-08T00:00:00Z',
    parent_success_observed_at: '2026-08-08T00:00:04Z',
    parent_approval_instance_digest: approvalInstanceDigest,
  };
}

function makeLegacyIntent() {
  const subject = makeSubject('legacy_receipt_migration');
  const historicalApprovalInstanceDigest =
    computeHistoricalPreparationApprovalInstanceDigest({
      decision_id: HISTORICAL_PREPARATION.decisionId,
      decision_class: HISTORICAL_PREPARATION.decisionClass,
      approval_target_head_sha: HISTORICAL_PREPARATION.approvalTargetHeadSha,
      subject_digest_domain: subject.digest_domain,
      subject_digest: subject.digest,
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
    validity_policy_artifact_record: makePolicyArtifactRecord(),
    gate_effect: 'none',
    authority: authorityMaskFor('legacy_receipt_migration'),
    allowed_next_action: 'materialize_legacy_preparation_receipt_only',
    non_claims: [
      'cohort_designation',
      'manifest_freeze',
      'manifest_creation',
      'reservation_activation',
      'provisioning',
      'execution',
      'evidence_collection',
      'data_manifest_population',
      'aggregation',
      'promotion',
      'architecture_acceptance',
      'checkpoint_coverage_or_pass',
      'visual_authority',
      'implementation',
      'native_acceptance',
      'release',
      'leadership_readiness',
    ],
    expires_at: '2026-08-16T00:00:00Z',
    invalidation_conditions:
      [...INVALIDATION_CONDITIONS_BY_KIND.legacy_receipt_migration],
    decision_subclass: 'legacy_preparation_receipt_migration',
    historical_subject_commit: subject.commit,
    historical_subject_digest_domain: subject.digest_domain,
    historical_subject_digest: subject.digest,
    historical_subject_artifact_records: subject.artifact_records,
    historical_approval_instance_digest: historicalApprovalInstanceDigest,
    materialized_preparation_receipt_path: ARTIFACT_PATHS.legacyPreparationReceipt,
  };
}

function makeCohortFixture() {
  const subject = makeSubject('cohort_designation');
  const designatedCohortId = `cet4-${'a'.repeat(26)}`;
  const designatedCohortSha256 = computeDesignatedCohortDigest({
    subject_commit: subject.commit,
    subject_digest_domain: subject.digest_domain,
    subject_digest: subject.digest,
    designated_cohort_id: designatedCohortId,
  });
  const privacyAttestation = makePrivacyAttestation(
    subject,
    designatedCohortId,
    designatedCohortSha256,
  );
  const parentTuple = makeParentTuple();
  const intent = {
    schema_version: 'mobile-ux-batch1-decision-intent.v1',
    decision_id: 'mobile-ux-batch1-cohort-designation-v1',
    decision_class: 'cohort_designation',
    contract_version: 'v1',
    repository: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    pull_request: 484,
    intent_artifact_path: ARTIFACT_PATHS.cohortDesignationIntent,
    validity_policy_artifact_record: makePolicyArtifactRecord(),
    gate_effect: 'none',
    authority: authorityMaskFor('cohort_designation'),
    allowed_next_action: 'produce_B2_designation_bound_binding_successor_only',
    non_claims: [
      'manifest_creation',
      'reservation_activation',
      'provisioning',
      'execution',
      'evidence_collection',
      'data_manifest_population',
      'aggregation',
      'promotion',
      'architecture_acceptance',
      'checkpoint_coverage_or_pass',
      'visual_authority',
      'implementation',
      'native_acceptance',
      'release',
      'leadership_readiness',
      'final_manifest_freeze',
    ],
    expires_at: '2026-09-01T00:00:00Z',
    invalidation_conditions: [...INVALIDATION_CONDITIONS_BY_KIND.cohort_designation],
    designation_subject_commit: subject.commit,
    designation_subject_digest_domain: subject.digest_domain,
    designation_subject_digest: subject.digest,
    designation_subject_artifact_records: subject.artifact_records,
    designated_cohort_id: designatedCohortId,
    designated_cohort_sha256: designatedCohortSha256,
    privacy_attestation_artifact_record:
      artifactRecords([ARTIFACT_PATHS.cohortNonPiiAttestation], 'privacy')[0],
    parent_preparation_approval_instance_digest: parentTuple.parent_approval_instance_digest,
  };
  return {intent, subject, privacyAttestation, parentTuple};
}

function makeManifestIntent(parentTuple) {
  const subject = makeSubject('manifest_freeze');
  return {
    schema_version: 'mobile-ux-batch1-decision-intent.v1',
    decision_id: 'mobile-ux-batch1-manifest-freeze-v1',
    decision_class: 'manifest_freeze',
    contract_version: 'v1',
    repository: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    pull_request: 484,
    intent_artifact_path: ARTIFACT_PATHS.manifestFreezeIntent,
    validity_policy_artifact_record: makePolicyArtifactRecord(),
    gate_effect: 'batch1_exact_manifest_freeze_and_reservation_activation_only',
    authority: authorityMaskFor('manifest_freeze'),
    allowed_next_action:
      'mark_exact_catalog_reservations_active_for_later_separate_authorization_without_manifest_creation_population_execution_or_evidence',
    non_claims: [
      'manifest_creation',
      'provisioning',
      'execution',
      'evidence_collection',
      'data_manifest_population',
      'aggregation',
      'promotion',
      'architecture_acceptance',
      'checkpoint_coverage_or_pass',
      'visual_authority',
      'implementation',
      'native_acceptance',
      'release',
      'leadership_readiness',
    ],
    expires_at: '2026-08-20T00:00:00Z',
    invalidation_conditions: [...INVALIDATION_CONDITIONS_BY_KIND.manifest_freeze],
    final_freeze_subject_commit: subject.commit,
    final_freeze_subject_digest_domain: subject.digest_domain,
    final_freeze_subject_digest: subject.digest,
    final_freeze_subject_artifact_records: subject.artifact_records,
    parent_designation_approval_instance_digest: parentTuple.parent_approval_instance_digest,
  };
}

function subjectFromIntent(intent, kind) {
  if (kind === 'legacy_receipt_migration') {
    return {
      commit: intent.historical_subject_commit,
      digest_domain: intent.historical_subject_digest_domain,
      digest: intent.historical_subject_digest,
    };
  }
  if (kind === 'cohort_designation') {
    return {
      commit: intent.designation_subject_commit,
      digest_domain: intent.designation_subject_digest_domain,
      digest: intent.designation_subject_digest,
    };
  }
  return {
    commit: intent.final_freeze_subject_commit,
    digest_domain: intent.final_freeze_subject_digest_domain,
    digest: intent.final_freeze_subject_digest,
  };
}

function intentValidationOptions(intent, {
  policy = makePolicy(),
  privacyAttestation,
} = {}) {
  const common = {
    policy,
    observedPolicyArtifactRecord: clone(intent.validity_policy_artifact_record),
  };
  if (
    intent.decision_class === 'schema_definition' &&
    intent.decision_subclass === 'legacy_preparation_receipt_migration'
  ) {
    return {
      ...common,
      observedSubjectArtifactRecords: clone(intent.historical_subject_artifact_records),
      historicalEventProjection: makeHistoricalEventProjection(),
    };
  }
  if (intent.decision_class === 'cohort_designation') {
    return {
      ...common,
      observedSubjectArtifactRecords: clone(intent.designation_subject_artifact_records),
      privacyAttestation,
      observedPrivacyAttestationArtifactRecord:
        clone(intent.privacy_attestation_artifact_record),
    };
  }
  return {
    ...common,
    observedSubjectArtifactRecords: clone(intent.final_freeze_subject_artifact_records),
  };
}

function makeReceipt({kind, intent, eventProjection, parentTuple = null}) {
  const subject = subjectFromIntent(intent, kind);
  const receipt = {
    schema_version: 'mobile-ux-batch1-approval-receipt.v2',
    decision_id: intent.decision_id,
    decision_class: intent.decision_class,
    contract_version: intent.contract_version,
    repository: intent.repository,
    repository_id: intent.repository_id,
    pull_request: intent.pull_request,
    receipt_materialization_pull_request: intent.pull_request + 1000,
    approval_target_head_sha: eventProjection.event.approval_target_head_sha,
    decision_artifact_path: intent.intent_artifact_path,
    decision_artifact_raw_sha256: hash(`${kind}-intent-bytes`),
    subject_commit: subject.commit,
    subject_digest_domain: subject.digest_domain,
    subject_digest: subject.digest,
    validity_policy_artifact_record: intent.validity_policy_artifact_record,
    workflow_path: eventProjection.event.workflow_path,
    workflow_id: eventProjection.event.workflow_id,
    trusted_base_sha: eventProjection.event.pull_request_base_sha,
    workflow_run_id: eventProjection.event.workflow_run_id,
    run_attempt: eventProjection.event.run_attempt,
    workflow_conclusion: eventProjection.event.workflow_conclusion,
    deployment_id: eventProjection.event.deployment_id,
    deployment_waiting_status_id: eventProjection.event.deployment_waiting_status_id,
    deployment_success_status_id: eventProjection.event.deployment_success_status_id,
    environment_id: eventProjection.event.environment_id,
    environment_name: eventProjection.event.environment_name,
    approval_review_sha256: eventProjection.event.approval_review_sha256,
    reviewer_immutable_id: eventProjection.event.reviewer_immutable_id,
    validity_anchor_at: eventProjection.event.validity_anchor_at,
    success_observed_at: eventProjection.event.success_observed_at,
    protected_authority_event_ref: eventProjection.protected_authority_event_ref,
    authority_event_sha256: eventProjection.authority_event_sha256,
    parent_approval_tuple: parentTuple,
    gate_effect: intent.gate_effect,
    authority: intent.authority,
    allowed_next_action: intent.allowed_next_action,
    non_claims: intent.non_claims,
    expires_at: intent.expires_at,
    invalidation_conditions: intent.invalidation_conditions,
  };
  if (kind === 'legacy_receipt_migration') {
    Object.assign(receipt, {
      decision_subclass: intent.decision_subclass,
      historical_approval_instance_digest: intent.historical_approval_instance_digest,
      materialized_preparation_receipt_path: intent.materialized_preparation_receipt_path,
    });
  } else if (kind === 'cohort_designation') {
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
  receipt.approval_instance_digest = hash('placeholder');
  receipt.approval_instance_digest = computeApprovalInstanceDigest(receipt);
  return receipt;
}

function makeLegacyPreparationFixture() {
  const policy = makePolicy();
  const historicalEventProjection = makeHistoricalEventProjection();
  const migrationIntent = makeLegacyIntent();
  const migrationApprovalEventProjection = projectGitHubApprovalEvent(
    makeEventEvidence({pullRequest: migrationIntent.pull_request}),
  );
  const migrationApprovalReceipt = makeReceipt({
    kind: 'legacy_receipt_migration',
    intent: migrationIntent,
    eventProjection: migrationApprovalEventProjection,
  });
  const migrationApprovalReceiptArtifactRecord = artifactRecords(
    [ARTIFACT_PATHS.legacyMigrationReceipt],
    'legacy-migration-receipt',
  )[0];
  const receipt = {
    schema_version: 'mobile-ux-batch1-legacy-preparation-approval-receipt.v1',
    decision_id: HISTORICAL_PREPARATION.decisionId,
    decision_class: HISTORICAL_PREPARATION.decisionClass,
    contract_version: 'v1',
    repository: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    receipt_materialization_pull_request: 2585,
    receipt_path: ARTIFACT_PATHS.legacyPreparationReceipt,
    historical_preapproval_intent_status:
      HISTORICAL_PREPARATION.preapprovalIntentStatus,
    historical_approval_target_head_sha:
      HISTORICAL_PREPARATION.approvalTargetHeadSha,
    subject_commit: migrationIntent.historical_subject_commit,
    subject_digest_domain: migrationIntent.historical_subject_digest_domain,
    subject_digest: migrationIntent.historical_subject_digest,
    historical_authority_event_sha256:
      HISTORICAL_PREPARATION.authorityEventSha256,
    historical_approval_instance_digest:
      migrationIntent.historical_approval_instance_digest,
    migration_approval_receipt_artifact_record:
      migrationApprovalReceiptArtifactRecord,
    migration_receipt_materialization_commit_sha: MATERIALIZATION_SHA,
    migration_approval_instance_digest:
      migrationApprovalReceipt.approval_instance_digest,
    parent_approval_tuple: null,
    gate_effect: HISTORICAL_PREPARATION.gateEffect,
    authority: authorityMaskFor('legacy_receipt_migration'),
    allowed_next_action: HISTORICAL_PREPARATION.allowedNextAction,
    expires_at: migrationApprovalReceipt.expires_at,
    approval_instance_digest: hash('legacy-preparation-placeholder'),
  };
  receipt.approval_instance_digest = computeLegacyPreparationReceiptDigest(receipt);
  return {
    policy,
    receipt,
    migrationIntent,
    migrationApprovalReceipt,
    migrationApprovalReceiptArtifactRecord,
    migrationApprovalEventProjection,
    historicalEventProjection,
  };
}

function legacyPreparationValidationOptions(fixture, overrides = {}) {
  return {
    migrationIntent: fixture.migrationIntent,
    migrationApprovalReceipt: fixture.migrationApprovalReceipt,
    migrationApprovalEventProjection: fixture.migrationApprovalEventProjection,
    refreshedMigrationEventProjection: fixture.migrationApprovalEventProjection,
    historicalEventProjection: fixture.historicalEventProjection,
    refreshedHistoricalEventProjection: fixture.historicalEventProjection,
    migrationDecisionArtifactRawSha256:
      hash('legacy_receipt_migration-intent-bytes'),
    migrationReceiptMaterializationCommitSha: MATERIALIZATION_SHA,
    observedPolicyArtifactRecord:
      fixture.migrationIntent.validity_policy_artifact_record,
    observedHistoricalSubjectArtifactRecords:
      fixture.migrationIntent.historical_subject_artifact_records,
    observedMigrationApprovalReceiptArtifactRecord:
      fixture.migrationApprovalReceiptArtifactRecord,
    policy: fixture.policy,
    now: '2026-08-11T00:00:00Z',
    migrationConditionResults:
      falseConditionResults('legacy_receipt_migration'),
    ...overrides,
  };
}

function falseConditionResults(kind) {
  return Object.fromEntries(
    INVALIDATION_CONDITIONS_BY_KIND[kind].map((conditionId) => [conditionId, false]),
  );
}

test('canonical JSON and domain-separated digest are deterministic JCS projections', () => {
  assert.equal(canonicalJson({z: -0, b: [true, null], a: '软书'}), '{"a":"软书","b":[true,null],"z":0}');
  assert.equal(
    domainSeparatedDigest('example/v1', {b: 2, a: 1}),
    domainSeparatedDigest('example/v1', {a: 1, b: 2}),
  );
  assert.notEqual(
    domainSeparatedDigest('example/v1', {a: 1}),
    domainSeparatedDigest('example/v2', {a: 1}),
  );
  assert.throws(() => canonicalJson({bad: Number.NaN}), /non-finite/);
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalJson(cyclic), /cycle/);
});

test('strict exact-key helper rejects missing and extra keys', () => {
  assert.doesNotThrow(() => assertExactKeys({a: 1, b: 2}, ['a', 'b'], 'fixture'));
  assert.throws(() => assertExactKeys({a: 1}, ['a', 'b'], 'fixture'), /missing=.*b/);
  assert.throws(() => assertExactKeys({a: 1, b: 2, c: 3}, ['a', 'b'], 'fixture'), /extra=.*c/);
});

test('canonical repository identity accepts only the exact repository id and origin', () => {
  for (const origin of [
    'https://github.com/LENKIN233/softbook_cet.git',
    'git@github.com:LENKIN233/softbook_cet.git',
    'ssh://git@github.com/LENKIN233/softbook_cet.git',
  ]) {
    assert.equal(normalizeGitHubOrigin(origin), TRUSTED_IDENTITY.canonicalOrigin);
  }
  assert.doesNotThrow(() => validateRepositoryIdentity({
    repository: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    origin: 'https://github.com/LENKIN233/softbook_cet',
  }));
  assert.throws(
    () => validateRepositoryIdentity({
      repository: TRUSTED_IDENTITY.repository,
      repository_id: TRUSTED_IDENTITY.repositoryId + 1,
      origin: 'https://github.com/LENKIN233/softbook_cet',
    }),
    /repository_id/,
  );
  assert.throws(
    () => normalizeGitHubOrigin('https://github.com/attacker/softbook_cet.git'),
    /canonical repository identity/,
  );
});

test('16-key authority masks are exact and class-specific', () => {
  const zero = authorityMaskFor('cohort_designation');
  assert.deepEqual(Object.keys(zero), AUTHORITY_KEYS);
  assert.ok(Object.values(zero).every((value) => value === false));
  const freeze = authorityMaskFor('manifest_freeze');
  assert.equal(freeze.freeze, true);
  assert.equal(freeze.reservation_activation, true);
  assert.ok(
    AUTHORITY_KEYS
      .filter((key) => !['freeze', 'reservation_activation'].includes(key))
      .every((key) => freeze[key] === false),
  );
  assert.doesNotThrow(() => validateAuthorityMask(freeze, 'manifest_freeze'));
  const escalated = {...zero, release: true};
  assert.throws(() => validateAuthorityMask(escalated, 'cohort_designation'), /unauthorized/);
  const missing = {...zero};
  delete missing.visual;
  assert.throws(() => validateAuthorityMask(missing, 'cohort_designation'), /exact key set/);
});

test('governance policy fixes 7/30/14 day ceilings below provider retention', () => {
  assert.doesNotThrow(() => validateGovernancePolicy(makePolicy()));
  assert.deepEqual(governancePolicyProjectionFromSpec(makeSpecPolicy()), makePolicy());
  const tooLong = makePolicy();
  tooLong.class_policies.cohort_designation.max_validity_seconds += 1;
  assert.throws(() => validateGovernancePolicy(tooLong), /max_validity_seconds/);
  const unknown = makePolicy();
  unknown.class_policies.manifest_freeze.ordered_invalidation_condition_ids[0] = 'invented_condition';
  assert.throws(() => validateGovernancePolicy(unknown), /ordered_invalidation_condition_ids/);
  const extra = makePolicy();
  extra.untrusted_override = true;
  assert.throws(() => validateGovernancePolicy(extra), /exact key set/);
});

test('subject artifact records and digest bind exact ordered paths and observed bytes', () => {
  const subject = makeSubject('cohort_designation');
  assert.doesNotThrow(() => validateSubjectBinding(subject, {kind: 'cohort_designation'}));
  const drift = clone(subject);
  drift.artifact_records[0].raw_sha256 = hash('drift');
  assert.throws(() => validateSubjectBinding(drift, {kind: 'cohort_designation'}), /digest drift/);
  const reordered = clone(subject);
  [reordered.artifact_records[0], reordered.artifact_records[1]] =
    [reordered.artifact_records[1], reordered.artifact_records[0]];
  assert.throws(() => validateSubjectBinding(reordered, {kind: 'cohort_designation'}), /\.path/);
  const observedDrift = clone(subject.artifact_records);
  observedDrift[2].byte_length += 1;
  assert.throws(
    () => validateSubjectBinding(subject, {
      kind: 'cohort_designation',
      observedArtifactRecords: observedDrift,
    }),
    /observed records/,
  );
});

test('GitHub event projection binds exact immutable ids and timestamps', () => {
  const projected = projectGitHubApprovalEvent(makeEventEvidence());
  assert.equal(projected.event.repository_id, 1216764160);
  assert.equal(projected.event.workflow_id, 315520763);
  assert.equal(projected.event.validity_anchor_at, '2026-08-10T00:00:00Z');
  assert.equal(projected.event.success_observed_at, '2026-08-10T00:00:04Z');
  assert.match(projected.event.approval_review_sha256, /^[0-9a-f]{64}$/);
  assert.match(projected.authority_event_sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(projected.observation.later_inactive_status_ids, []);
});

test('approval target is the historical workflow head, not a mutable current PR head', () => {
  const historicalApprovalHead = '7'.repeat(40);
  const evidence = makeEventEvidence({headSha: historicalApprovalHead});
  assert.equal(Object.hasOwn(evidence.pull_request, 'head_sha'), false);
  const projected = projectGitHubApprovalEvent(evidence);
  assert.equal(projected.event.approval_target_head_sha, historicalApprovalHead);
  assert.equal(projected.event.pull_request_number, 484);
  assert.equal(projected.event.pull_request_base_ref, 'refs/heads/main');
});

test('a later inactive deployment status does not revoke historical success', () => {
  const withoutInactive = projectGitHubApprovalEvent(makeEventEvidence());
  const withInactive = projectGitHubApprovalEvent(makeEventEvidence({includeInactive: true}));
  assert.equal(withInactive.authority_event_sha256, withoutInactive.authority_event_sha256);
  assert.deepEqual(withInactive.observation.later_inactive_status_ids, [16590000104]);
});

test('GitHub event projection rejects wrong identity, duplicate approval, and revoked chains', async (t) => {
  await t.test('wrong repository id', () => {
    const evidence = makeEventEvidence();
    evidence.repository.id += 1;
    assert.throws(() => projectGitHubApprovalEvent(evidence), /repository_id/);
  });
  await t.test('wrong workflow id', () => {
    const evidence = makeEventEvidence();
    evidence.workflow_run.workflow_id += 1;
    assert.throws(() => projectGitHubApprovalEvent(evidence), /workflow_id/);
  });
  await t.test('duplicate matching approval', () => {
    const evidence = makeEventEvidence();
    evidence.approval_reviews.push(clone(evidence.approval_reviews[0]));
    assert.throws(() => projectGitHubApprovalEvent(evidence), /exactly one approved review/);
  });
  await t.test('rejected approval', () => {
    const evidence = makeEventEvidence();
    evidence.approval_reviews[0].state = 'rejected';
    assert.throws(() => projectGitHubApprovalEvent(evidence), /revoked or rejected/);
  });
  await t.test('post-success failure', () => {
    const evidence = makeEventEvidence();
    evidence.deployment_statuses.unshift({
      id: 16599999999,
      state: 'failure',
      created_at: '2026-08-10T00:11:00Z',
      environment: TRUSTED_IDENTITY.environmentName,
    });
    assert.throws(() => projectGitHubApprovalEvent(evidence), /revoked by failure/);
  });
  await t.test('duplicate status id', () => {
    const evidence = makeEventEvidence();
    evidence.deployment_statuses[1].id = evidence.deployment_statuses[0].id;
    assert.throws(() => projectGitHubApprovalEvent(evidence), /duplicate id/);
  });
  await t.test('waiting after success', () => {
    const evidence = makeEventEvidence();
    const waiting = evidence.deployment_statuses.find((entry) => entry.state === 'waiting');
    waiting.created_at = '2026-08-10T00:00:05Z';
    assert.throws(() => projectGitHubApprovalEvent(evidence), /strictly precede/);
  });
});

test('privacy attestation is exact, non-PII, and bound to cohort digest', () => {
  const {subject, privacyAttestation, intent} = makeCohortFixture();
  assert.doesNotThrow(() => validatePrivacyAttestation(privacyAttestation, {
    subject,
    designatedCohortId: intent.designated_cohort_id,
    designatedCohortSha256: intent.designated_cohort_sha256,
  }));
  const pii = clone(privacyAttestation);
  pii.embedded_direct_identifier_fields = ['email'];
  assert.throws(() => validatePrivacyAttestation(pii, {subject}), /embedded_direct_identifier_fields/);
  const lowEntropy = clone(privacyAttestation);
  lowEntropy.designated_cohort_id = 'cet4-alice';
  assert.throws(() => validatePrivacyAttestation(lowEntropy, {subject}), /opaque 130-bit/);
  const drift = clone(privacyAttestation);
  drift.designated_cohort_sha256 = hash('invented-cohort');
  assert.throws(() => validatePrivacyAttestation(drift, {subject}), /digest drift/);
});

test('historical preparation approval is recomputed from the pinned remote event without an intent', () => {
  const historical = makeHistoricalEventProjection();
  assert.equal(
    validateHistoricalPreparationEventProjection(historical).authority_event_sha256,
    HISTORICAL_PREPARATION.authorityEventSha256,
  );
  const intent = makeLegacyIntent();
  assert.equal(
    validateDecisionIntent(intent, intentValidationOptions(intent))
      .historical_approval_instance_digest,
    intent.historical_approval_instance_digest,
  );
  const missingHistoricalEvent = intentValidationOptions(intent);
  delete missingHistoricalEvent.historicalEventProjection;
  assert.throws(
    () => validateDecisionIntent(intent, missingHistoricalEvent),
    /trusted historical event projection is required/,
  );

  const tamperedEvent = clone(historical);
  tamperedEvent.event.deployment_waiting_status_id += 1;
  assert.throws(
    () => validateHistoricalPreparationEventProjection(tamperedEvent),
    /deployment_waiting_status_id|authority event digest/,
  );
  const forgedDigest = clone(intent);
  forgedDigest.historical_approval_instance_digest = hash('forged historical approval');
  assert.throws(
    () => validateDecisionIntent(forgedDigest, intentValidationOptions(forgedDigest)),
    /historical approval instance digest/,
  );
  const fabricatedHistoricalIntent = clone(intent);
  fabricatedHistoricalIntent.historical_intent_artifact_path =
    'docs/design/decisions/fabricated-historical-intent.json';
  assert.throws(
    () => validateDecisionIntent(
      fabricatedHistoricalIntent,
      intentValidationOptions(fabricatedHistoricalIntent),
    ),
    /exact key set/,
  );
});

test('all decision intent schemas validate and mixed decisions fail closed', () => {
  const policy = makePolicy();
  const legacy = makeLegacyIntent();
  assert.equal(
    validateDecisionIntent(legacy, intentValidationOptions(legacy, {policy})).kind,
    'legacy_receipt_migration',
  );

  const cohort = makeCohortFixture();
  assert.equal(
    validateDecisionIntent(cohort.intent, intentValidationOptions(cohort.intent, {
      policy,
      privacyAttestation: cohort.privacyAttestation,
    })).kind,
    'cohort_designation',
  );

  const manifestParent = makeParentTuple({
    parentClass: 'cohort_designation',
    parentDecisionId: 'mobile-ux-batch1-cohort-designation-v1',
  });
  const manifest = makeManifestIntent(manifestParent);
  assert.equal(
    validateDecisionIntent(manifest, intentValidationOptions(manifest, {policy})).kind,
    'manifest_freeze',
  );

  assert.throws(
    () => validateSingleDecisionArtifact([legacy, cohort.intent]),
    /mixed decision classes/,
  );
  assert.throws(
    () => validateSingleDecisionArtifact([cohort.intent, clone(cohort.intent)]),
    /exactly one decision artifact/,
  );
  const extra = clone(cohort.intent);
  extra.owner_override = true;
  assert.throws(
    () => validateDecisionIntent(extra, intentValidationOptions(extra, {
      policy,
      privacyAttestation: cohort.privacyAttestation,
    })),
    /exact key set/,
  );
});

test('decision intent validation requires trusted observed HEAD artifact records', () => {
  const fixture = makeCohortFixture();
  const complete = intentValidationOptions(fixture.intent, {
    privacyAttestation: fixture.privacyAttestation,
  });
  for (const requiredKey of [
    'observedPolicyArtifactRecord',
    'observedSubjectArtifactRecords',
    'observedPrivacyAttestationArtifactRecord',
  ]) {
    const missing = {...complete};
    delete missing[requiredKey];
    assert.throws(
      () => validateDecisionIntent(fixture.intent, missing),
      /trusted observed/,
    );
  }
  const drift = clone(complete);
  drift.observedPrivacyAttestationArtifactRecord.raw_sha256 = hash('different-attestation-bytes');
  assert.throws(
    () => validateDecisionIntent(fixture.intent, drift),
    /does not equal its trusted source projection/,
  );
});

test('cohort intent cannot contain its future event and rejects subject/cohort drift', () => {
  const fixture = makeCohortFixture();
  const causalCycle = clone(fixture.intent);
  causalCycle.privacy_attestation_event = projectGitHubApprovalEvent(makeEventEvidence()).event;
  assert.throws(
    () => validateDecisionIntent(causalCycle, intentValidationOptions(causalCycle, {
      policy: makePolicy(),
      privacyAttestation: fixture.privacyAttestation,
    })),
    /exact key set/,
  );
  const drift = clone(fixture.intent);
  drift.designated_cohort_sha256 = hash('owner-supplied-digest');
  assert.throws(
    () => validateDecisionIntent(drift, intentValidationOptions(drift, {
      policy: makePolicy(),
      privacyAttestation: fixture.privacyAttestation,
    })),
    /cohort digest drift/,
  );
});

test('full parent tuple is exact and cannot be replaced by an opaque digest', () => {
  const parent = makeParentTuple();
  assert.doesNotThrow(() => validateParentTuple(parent, {expectedTuple: clone(parent)}));
  const missing = clone(parent);
  delete missing.parent_receipt_raw_sha256;
  assert.throws(() => validateParentTuple(missing), /exact key set/);
  const wrongEnvironment = clone(parent);
  wrongEnvironment.parent_environment_id += 1;
  assert.throws(() => validateParentTuple(wrongEnvironment), /environment id/);
  const truncated = {parent_approval_instance_digest: parent.parent_approval_instance_digest};
  assert.throws(() => validateParentTuple(truncated), /exact key set/);
});

test('legacy preparation receipt validates both event chains and builds the exact D1 parent tuple', () => {
  const fixture = makeLegacyPreparationFixture();
  const result = validateLegacyPreparationReceipt(
    fixture.receipt,
    legacyPreparationValidationOptions(fixture),
  );
  assert.equal(result.valid, true);
  assert.equal(result.approval_instance_digest, fixture.receipt.approval_instance_digest);
  assert.equal(
    computeLegacyPreparationApprovalInstanceDigest(fixture.receipt),
    computeLegacyPreparationReceiptDigest(fixture.receipt),
  );
  assert.notEqual(
    result.historical_authority_event_sha256,
    result.migration_authority_event_sha256,
  );

  const preparationReceiptArtifactRecord = artifactRecords(
    [ARTIFACT_PATHS.legacyPreparationReceipt],
    'legacy-preparation-receipt',
  )[0];
  const tuple = buildLegacyPreparationParentTuple({
    receipt: fixture.receipt,
    migrationApprovalReceipt: fixture.migrationApprovalReceipt,
    historicalEventProjection: fixture.historicalEventProjection,
    preparationReceiptArtifactRecord,
    observedPreparationReceiptArtifactRecord:
      clone(preparationReceiptArtifactRecord),
    preparationReceiptMaterializationCommitSha: '6'.repeat(40),
  });
  assert.equal(tuple.parent_decision_id, HISTORICAL_PREPARATION.decisionId);
  assert.equal(tuple.parent_decision_class, 'schema_definition');
  assert.equal(
    tuple.parent_decision_artifact_path,
    ARTIFACT_PATHS.legacyMigrationIntent,
  );
  assert.equal(tuple.parent_receipt_path, ARTIFACT_PATHS.legacyPreparationReceipt);
  assert.equal(
    tuple.parent_approval_instance_digest,
    fixture.receipt.approval_instance_digest,
  );
  assert.doesNotThrow(() => validateParentTuple(tuple));
});

test('legacy preparation receipt fails closed on tampering, expiry, or mixed chains', async (t) => {
  await t.test('migration approval instance tampering', () => {
    const fixture = makeLegacyPreparationFixture();
    const receipt = clone(fixture.receipt);
    receipt.migration_approval_instance_digest = hash('different migration approval');
    receipt.approval_instance_digest = computeLegacyPreparationReceiptDigest(receipt);
    assert.throws(
      () => validateLegacyPreparationReceipt(
        receipt,
        legacyPreparationValidationOptions(fixture),
      ),
      /migration approval instance binding/,
    );
  });

  await t.test('expiry beyond migration receipt', () => {
    const fixture = makeLegacyPreparationFixture();
    const receipt = clone(fixture.receipt);
    receipt.expires_at = '2026-08-16T00:00:01Z';
    receipt.approval_instance_digest = computeLegacyPreparationReceiptDigest(receipt);
    assert.throws(
      () => validateLegacyPreparationReceipt(
        receipt,
        legacyPreparationValidationOptions(fixture),
      ),
      /expiry exceeds migration receipt expiry/,
    );
  });

  await t.test('expired migration chain at use time', () => {
    const fixture = makeLegacyPreparationFixture();
    assert.throws(
      () => validateLegacyPreparationReceipt(
        fixture.receipt,
        legacyPreparationValidationOptions(fixture, {
          now: fixture.migrationApprovalReceipt.expires_at,
        }),
      ),
      /expired at use time/,
    );
  });

  await t.test('mixed historical and migration event chains', () => {
    const fixture = makeLegacyPreparationFixture();
    assert.throws(
      () => validateLegacyPreparationReceipt(
        fixture.receipt,
        legacyPreparationValidationOptions(fixture, {
          migrationApprovalEventProjection: fixture.historicalEventProjection,
          refreshedMigrationEventProjection: fixture.historicalEventProjection,
        }),
      ),
      /must have distinct pull_request_number/,
    );
  });

  await t.test('observed migration receipt byte drift', () => {
    const fixture = makeLegacyPreparationFixture();
    const observed = clone(fixture.migrationApprovalReceiptArtifactRecord);
    observed.raw_sha256 = hash('different migration receipt bytes');
    assert.throws(
      () => validateLegacyPreparationReceipt(
        fixture.receipt,
        legacyPreparationValidationOptions(fixture, {
          observedMigrationApprovalReceiptArtifactRecord: observed,
        }),
      ),
      /trusted source projection/,
    );
  });

  await t.test('fabricated historical intent field', () => {
    const fixture = makeLegacyPreparationFixture();
    const receipt = clone(fixture.receipt);
    receipt.historical_intent_artifact_path =
      'docs/design/decisions/fabricated-historical-intent.json';
    assert.throws(
      () => validateLegacyPreparationReceipt(
        receipt,
        legacyPreparationValidationOptions(fixture),
      ),
      /exact key set/,
    );
  });

  await t.test('root parent or authority escalation', () => {
    const fixture = makeLegacyPreparationFixture();
    const parented = clone(fixture.receipt);
    parented.parent_approval_tuple = makeParentTuple();
    assert.throws(
      () => validateLegacyPreparationReceipt(
        parented,
        legacyPreparationValidationOptions(fixture),
      ),
      /root approval and parent tuple must be null/,
    );
    const escalated = clone(fixture.receipt);
    escalated.authority.release = true;
    assert.throws(
      () => validateLegacyPreparationReceipt(
        escalated,
        legacyPreparationValidationOptions(fixture),
      ),
      /unauthorized capability/,
    );
  });
});

test('approval receipt binds intent, event, parent, authority, TTL, and instance digest', () => {
  const fixture = makeCohortFixture();
  const event = projectGitHubApprovalEvent(makeEventEvidence());
  const receipt = makeReceipt({
    kind: 'cohort_designation',
    intent: fixture.intent,
    eventProjection: event,
    parentTuple: fixture.parentTuple,
  });
  const result = validateApprovalReceipt(receipt, {
    intent: fixture.intent,
    eventProjection: event,
    decisionArtifactRawSha256: hash('cohort_designation-intent-bytes'),
    parentApprovalTuple: fixture.parentTuple,
    policy: makePolicy(),
    now: '2026-08-11T00:00:00Z',
  });
  assert.equal(result.kind, 'cohort_designation');
  assert.equal(result.approval_instance_digest, receipt.approval_instance_digest);
});

test('legacy root receipt has null parent and manifest receipt grants only freeze markers', () => {
  const legacyIntent = makeLegacyIntent();
  const legacyEvent = projectGitHubApprovalEvent(
    makeEventEvidence({pullRequest: legacyIntent.pull_request}),
  );
  const legacyReceipt = makeReceipt({
    kind: 'legacy_receipt_migration',
    intent: legacyIntent,
    eventProjection: legacyEvent,
  });
  assert.doesNotThrow(() => validateApprovalReceipt(legacyReceipt, {
    intent: legacyIntent,
    eventProjection: legacyEvent,
    decisionArtifactRawSha256: hash('legacy_receipt_migration-intent-bytes'),
    policy: makePolicy(),
    now: '2026-08-11T00:00:00Z',
  }));
  const illegalParent = clone(legacyReceipt);
  illegalParent.parent_approval_tuple = makeParentTuple();
  illegalParent.approval_instance_digest = computeApprovalInstanceDigest(illegalParent);
  assert.throws(
    () => validateApprovalReceipt(illegalParent, {
      intent: legacyIntent,
      eventProjection: legacyEvent,
      decisionArtifactRawSha256: hash('legacy_receipt_migration-intent-bytes'),
      parentApprovalTuple: makeParentTuple(),
      policy: makePolicy(),
    }),
    /root decision/,
  );

  const parent = makeParentTuple({
    parentClass: 'cohort_designation',
    parentDecisionId: 'mobile-ux-batch1-cohort-designation-v1',
  });
  const event = projectGitHubApprovalEvent(makeEventEvidence());
  const manifestIntent = makeManifestIntent(parent);
  const manifestReceipt = makeReceipt({
    kind: 'manifest_freeze',
    intent: manifestIntent,
    eventProjection: event,
    parentTuple: parent,
  });
  assert.doesNotThrow(() => validateApprovalReceipt(manifestReceipt, {
    intent: manifestIntent,
    eventProjection: event,
    decisionArtifactRawSha256: hash('manifest_freeze-intent-bytes'),
    parentApprovalTuple: parent,
    policy: makePolicy(),
  }));
  assert.equal(manifestReceipt.authority.freeze, true);
  assert.equal(manifestReceipt.authority.reservation_activation, true);
  assert.equal(manifestReceipt.authority.manifest_creation, false);
  assert.equal(manifestReceipt.authority.execution, false);
});

test('receipt validation rejects digest drift, authority escalation, missing parent, and extra keys', async (t) => {
  const fixture = makeCohortFixture();
  const event = projectGitHubApprovalEvent(makeEventEvidence());
  const base = makeReceipt({
    kind: 'cohort_designation',
    intent: fixture.intent,
    eventProjection: event,
    parentTuple: fixture.parentTuple,
  });
  const options = {
    intent: fixture.intent,
    eventProjection: event,
    decisionArtifactRawSha256: hash('cohort_designation-intent-bytes'),
    parentApprovalTuple: fixture.parentTuple,
    policy: makePolicy(),
  };
  await t.test('approval instance digest drift', () => {
    const receipt = clone(base);
    receipt.approval_instance_digest = hash('forged');
    assert.throws(() => validateApprovalReceipt(receipt, options), /approval instance digest/);
  });
  await t.test('authority escalation', () => {
    const receipt = clone(base);
    receipt.authority.release = true;
    receipt.approval_instance_digest = computeApprovalInstanceDigest(receipt);
    assert.throws(() => validateApprovalReceipt(receipt, options), /does not equal|unauthorized/);
  });
  await t.test('missing verified parent', () => {
    assert.throws(
      () => validateApprovalReceipt(base, {...options, parentApprovalTuple: null}),
      /requires a verified full parent/,
    );
  });
  await t.test('extra receipt field', () => {
    const receipt = clone(base);
    receipt.approval_id = 123;
    assert.throws(() => validateApprovalReceipt(receipt, options), /exact key set/);
  });
  await t.test('authority event digest drift', () => {
    const receipt = clone(base);
    receipt.authority_event_sha256 = hash('invented-event');
    receipt.approval_instance_digest = computeApprovalInstanceDigest(receipt);
    assert.throws(() => validateApprovalReceipt(receipt, options), /authority event digest/);
  });
  await t.test('privacy attestation bound to a different event', () => {
    const receipt = clone(base);
    receipt.privacy_attestation_authority_event_sha256 = hash('different-protected-event');
    receipt.approval_instance_digest = computeApprovalInstanceDigest(receipt);
    assert.throws(
      () => validateApprovalReceipt(receipt, options),
      /privacy attestation authority event binding/,
    );
  });
});

test('receipt TTL and use-time checks fail closed on expiry and unknown conditions', () => {
  const fixture = makeCohortFixture();
  const event = projectGitHubApprovalEvent(makeEventEvidence());
  const receipt = makeReceipt({
    kind: 'cohort_designation',
    intent: fixture.intent,
    eventProjection: event,
    parentTuple: fixture.parentTuple,
  });
  assert.deepEqual(
    evaluateReceiptValidity(receipt, {
      policy: makePolicy(),
      now: '2026-08-12T00:00:00Z',
      conditionResults: falseConditionResults('cohort_designation'),
      refreshedEventProjection: projectGitHubApprovalEvent(
        makeEventEvidence({includeInactive: true}),
      ),
    }),
    {
      valid: true,
      kind: 'cohort_designation',
      evaluated_at: '2026-08-12T00:00:00Z',
    },
  );
  assert.throws(
    () => evaluateReceiptValidity(receipt, {
      policy: makePolicy(),
      now: '2026-09-01T00:00:00Z',
      conditionResults: falseConditionResults('cohort_designation'),
      refreshedEventProjection: event,
    }),
    /expired/,
  );
  const invalidated = falseConditionResults('cohort_designation');
  invalidated.parent_approval_instance_invalid = true;
  assert.throws(
    () => evaluateReceiptValidity(receipt, {
      policy: makePolicy(),
      now: '2026-08-12T00:00:00Z',
      conditionResults: invalidated,
      refreshedEventProjection: event,
    }),
    /parent_approval_instance_invalid/,
  );
  const unknown = {...falseConditionResults('cohort_designation'), invented_condition: false};
  assert.throws(
    () => evaluateReceiptValidity(receipt, {
      policy: makePolicy(),
      now: '2026-08-12T00:00:00Z',
      conditionResults: unknown,
      refreshedEventProjection: event,
    }),
    /exact key set/,
  );
  assert.throws(
    () => evaluateReceiptValidity(receipt, {
      policy: makePolicy(),
      conditionResults: falseConditionResults('cohort_designation'),
      refreshedEventProjection: event,
    }),
    /use time is required/,
  );
});

test('receipt expiration cannot exceed class ceiling or success time', () => {
  const fixture = makeCohortFixture();
  const event = projectGitHubApprovalEvent(makeEventEvidence());
  const intent = clone(fixture.intent);
  intent.expires_at = '2026-09-10T00:00:01Z';
  const receipt = makeReceipt({
    kind: 'cohort_designation',
    intent,
    eventProjection: event,
    parentTuple: fixture.parentTuple,
  });
  assert.throws(
    () => validateApprovalReceipt(receipt, {
      intent,
      eventProjection: event,
      decisionArtifactRawSha256: hash('cohort_designation-intent-bytes'),
      parentApprovalTuple: fixture.parentTuple,
      policy: makePolicy(),
    }),
    /TTL ceiling/,
  );

  const beforeSuccessIntent = clone(fixture.intent);
  beforeSuccessIntent.expires_at = '2026-08-10T00:00:03Z';
  const beforeSuccessReceipt = makeReceipt({
    kind: 'cohort_designation',
    intent: beforeSuccessIntent,
    eventProjection: event,
    parentTuple: fixture.parentTuple,
  });
  assert.throws(
    () => validateApprovalReceipt(beforeSuccessReceipt, {
      intent: beforeSuccessIntent,
      eventProjection: event,
      decisionArtifactRawSha256: hash('cohort_designation-intent-bytes'),
      parentApprovalTuple: fixture.parentTuple,
      policy: makePolicy(),
    }),
    /expire after success/,
  );
});

test('receipt materialization schema is authority-free and path-bound', () => {
  const decision = {
    schema_version: 'mobile-ux-batch1-receipt-materialization.v1',
    decision_id: 'mobile-ux-batch1-receipt-materialization-v1',
    decision_class: 'receipt_materialization',
    contract_version: 'v1',
    source_decision_kind: 'cohort_designation',
    source_decision_id: 'mobile-ux-batch1-cohort-designation-v1',
    source_approval_target_head_sha: HEAD_SHA,
    source_authority_event_sha256: hash('source-event'),
    source_approval_instance_digest: hash('source-instance'),
    target_receipt_path: ARTIFACT_PATHS.cohortDesignationReceipt,
    gate_effect: 'none',
    authority: authorityMaskFor('receipt_materialization'),
    allowed_next_action: 'create_exact_verified_receipt_bytes_in_descendant_commit_only',
    non_claims: [
      'new_decision_authority',
      'subject_mutation',
      'manifest_creation',
      'provisioning',
      'execution',
      'evidence_collection',
      'release',
      'leadership_readiness',
    ],
  };
  assert.equal(validateReceiptMaterializationDecision(decision).kind, 'receipt_materialization');
  const wrongPath = clone(decision);
  wrongPath.target_receipt_path = ARTIFACT_PATHS.manifestFreezeReceipt;
  assert.throws(() => validateReceiptMaterializationDecision(wrongPath), /target_receipt_path/);
  const authority = clone(decision);
  authority.authority.manifest_creation = true;
  assert.throws(() => validateReceiptMaterializationDecision(authority), /unauthorized/);
});
