import {createHash} from 'node:crypto';

import {validateSmsProviderSmokeReport} from '../../infra/cloudbase/smoke-sms-provider.mjs';
import {REQUIRED_COLLECTIONS as RECEIVER_REQUIRED_COLLECTIONS} from '../../infra/cloudbase/deployment-safety.mjs';

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CONTENT_VERSION_PATTERN = /^sha256:[0-9a-f]{64}$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const STRICT_SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const VERIFIER_PATTERN = /^(github|team|external):[A-Za-z0-9_.-]+$/;
const FORBIDDEN_ENVIRONMENT_PATTERN =
  /(^|[-_.:])(local|mock|simulation|simulator|personal|development|dev)([-_.:]|$)/i;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const SMS_PROVIDER_SMOKE_RAW_PREFIX = 'repo://docs/release/evidence/raw/';
const RAW_REPOSITORY_EVIDENCE_PREFIXES = Object.freeze([
  'docs/agent-runs/evidence/',
  'docs/release/evidence/',
  'security/reports/',
]);

export const LEARNING_RUNTIME_EVIDENCE_TYPES = Object.freeze([
  'cross-device-bootstrap-test',
  'offline-replay-test',
  'canonical-state-test',
  'fsrs-version-lock',
  'scheduler-contract-test',
  'clock-boundary-test',
]);

export const RELEASE_OPERATIONAL_EVIDENCE_TYPES = Object.freeze([
  'load-test-report',
  'availability-observation',
  'backup-restore-drill',
  'penetration-test-report',
  'rollback-drill',
]);

export const CET4_FORMAL_CONTENT_EVIDENCE_TYPES = Object.freeze([
  'cet4-approved-box-coverage-report',
  'cet4-approved-card-coverage-report',
  'cet4-audio-qc-coverage-report',
  'cet4-content-pack-integrity-report',
]);
const CET4_FORMAL_CONTENT_EVIDENCE_SET = new Set(
  CET4_FORMAL_CONTENT_EVIDENCE_TYPES,
);

export const BETA_ENTITLEMENT_EVIDENCE_TYPES = Object.freeze([
  'beta-entitlement-drill',
]);
const BETA_ENTITLEMENT_EVIDENCE_SET = new Set(
  BETA_ENTITLEMENT_EVIDENCE_TYPES,
);

export const EXTERNAL_CAPABILITY_COMMON_CHECKS = Object.freeze([
  'provider-subject-bound',
  'owner-control-confirmed',
  'current-state-observed',
]);

export const EXTERNAL_CAPABILITY_OBSERVATION_MODES = Object.freeze([
  'provider_control_plane',
  'official_registry',
  'public_endpoint',
]);

export const EXTERNAL_CAPABILITY_REQUIRED_CHECKS = Object.freeze({
  'apple-developer': {
    'app-store-connect': [
      'team-access-confirmed',
      'app-record-active',
      'release-role-confirmed',
    ],
    'storekit-subscriptions': [
      'monthly-product-active',
      'yearly-product-active',
      'subscription-group-active',
    ],
    'app-store-server-notifications': [
      'v2-endpoint-registered',
      'production-url-configured',
      'provider-configuration-active',
    ],
    'distribution-signing': [
      'distribution-certificate-active',
      'provisioning-profile-active',
      'signing-assets-custody-confirmed',
    ],
  },
  'android-distribution': {
    huawei: [
      'publisher-account-active',
      'app-record-active',
      'release-channel-available',
    ],
    xiaomi: [
      'publisher-account-active',
      'app-record-active',
      'release-channel-available',
    ],
    oppo: [
      'publisher-account-active',
      'app-record-active',
      'release-channel-available',
    ],
    vivo: [
      'publisher-account-active',
      'app-record-active',
      'release-channel-available',
    ],
    'tencent-myapp': [
      'publisher-account-active',
      'app-record-active',
      'release-channel-available',
    ],
    'release-signing': [
      'keystore-custody-confirmed',
      'certificate-fingerprint-recorded',
      'backup-custody-confirmed',
    ],
  },
  'tencent-cloud-production': {
    'cloudbase-run': [
      'receiver-owned-environment-confirmed',
      'service-identity-configured',
      'deployment-permission-confirmed',
    ],
    'tencentdb-postgresql': [
      'instance-access-confirmed',
      'backup-policy-active',
      'network-policy-configured',
    ],
    'cos-private-bucket': [
      'private-bucket-confirmed',
      'access-policy-configured',
      'signed-url-capability-enabled',
    ],
    sms: [
      'sender-approved',
      'template-approved',
      'quota-and-region-configured',
    ],
    cls: [
      'logset-access-confirmed',
      'retention-policy-active',
      'alert-destination-configured',
    ],
    rum: [
      'application-registered',
      'data-source-configured',
      'alerting-path-configured',
    ],
  },
  payments: {
    'wechat-pay': [
      'merchant-account-active',
      'product-configuration-confirmed',
      'api-credential-configured',
      'webhook-endpoint-registered',
    ],
    alipay: [
      'merchant-account-active',
      'product-configuration-confirmed',
      'api-credential-configured',
      'webhook-endpoint-registered',
    ],
    'webhook-domain': [
      'dns-control-confirmed',
      'tls-certificate-configured',
      'public-endpoint-registered',
    ],
  },
  'china-compliance': {
    'domain-registration': [
      'registrant-current',
      'dns-control-confirmed',
    ],
    'icp-filing': [
      'filing-approved',
      'domain-binding-confirmed',
    ],
    'app-filing': [
      'filing-approved',
      'app-identity-binding-confirmed',
    ],
    'privacy-policy-public-url': [
      'public-reachability-confirmed',
      'published-content-current',
    ],
    'customer-support-contact': [
      'contact-channel-reachable',
      'response-owner-confirmed',
    ],
  },
});

const LEARNING_RUNTIME_EVIDENCE_SET = new Set(
  LEARNING_RUNTIME_EVIDENCE_TYPES,
);
const RELEASE_OPERATIONAL_EVIDENCE_SET = new Set(
  RELEASE_OPERATIONAL_EVIDENCE_TYPES,
);

export const REQUIRED_EVIDENCE_CHECKS = Object.freeze({
  'dev-environment-isolation': [
    'environment-identities-distinct',
    'credentials-scoped',
    'personal-environment-rejected',
  ],
  'staging-deployment': [
    'clean-deployment',
    'migration-verified',
    'health-check-passed',
  ],
  'production-deployment': [
    'release-commit-deployed',
    'health-check-passed',
    'rollback-target-retained',
  ],
  'secret-access-audit': [
    'no-tracked-secrets',
    'least-privilege-confirmed',
    'rotation-tested',
  ],
  'release-permission-audit': [
    'protected-approval-required',
    'operator-allowlist-confirmed',
    'administrator-bypass-disabled',
  ],
  'sms-provider-smoke': [
    'receiver-sms-provider-used',
    'code-delivery-confirmed',
    'expiry-and-single-use-confirmed',
  ],
  'auth-abuse-test': [
    'rate-limit-enforced',
    'challenge-replay-rejected',
    'account-enumeration-resistant',
  ],
  'session-revocation-test': [
    'refresh-rotation-enforced',
    'logout-revokes-session',
    'replacement-session-isolated',
  ],
  'account-deletion-drill': [
    'authenticated-deletion-completed',
    'account-data-removal-verified',
    'cross-surface-session-revocation-verified',
  ],
  'cross-device-bootstrap-test': [
    'same-account-distinct-clients',
    'single-canonical-event',
    'second-client-observed-event',
    'server-sequence-stable',
    'no-client-snapshot-import',
  ],
  'offline-replay-test': [
    'server-commit-before-ack-loss',
    'byte-equivalent-retry',
    'duplicate-returns-original-sequence',
    'queue-cleared-after-strict-ack',
    'post-ack-bootstrap-reconciled',
  ],
  'canonical-state-test': [
    'active-session-identity-only',
    'explicit-empty-state',
    'content-release-bound',
    'server-state-authoritative',
    'post-replay-state-reconciled',
  ],
  'fsrs-version-lock': [
    'exact-library-version',
    'exact-policy-version',
    'fuzz-disabled',
    'lockfile-bound',
  ],
  'scheduler-contract-test': [
    'due-before-new',
    'sleeping-cards-excluded',
    'membership-access-enforced',
    'selection-bound-completion',
    'duplicate-does-not-advance',
  ],
  'clock-boundary-test': [
    'server-acceptance-time-authoritative',
    'client-time-cannot-reorder',
    'future-skew-boundary-enforced',
    'retention-boundary-enforced',
    'china-product-day-enforced',
  ],
  'cross-platform-audio-test': [
    'ios-playback-passed',
    'android-playback-passed',
    'pc-web-playback-passed',
    'no-autoplay-confirmed',
    'interruption-recovery-passed',
  ],
  'audio-cache-integrity-test': [
    'sha256-before-playback',
    'corrupt-cache-rejected',
    'private-url-expiry-handled',
    'content-addressed-cache-confirmed',
  ],
  'audio-qc-coverage-report': [
    'all-referenced-assets-covered',
    'all-qc-records-formally-ready',
    'asset-hashes-match-content-release',
  ],
  'ios-parity-report': [
    'learning-space-statistics-mine-covered',
    'core-interactions-covered',
    'purchase-and-entitlement-covered',
  ],
  'android-parity-report': [
    'learning-space-statistics-mine-covered',
    'core-interactions-covered',
    'purchase-and-entitlement-covered',
  ],
  'pc-web-parity-report': [
    'learning-space-statistics-mine-covered',
    'equivalent-non-touch-input-covered',
    'purchase-and-entitlement-covered',
  ],
  'device-matrix-report': [
    'phone-layout-covered',
    'tablet-layout-covered',
    'pc-web-layout-covered',
    'cross-surface-continuity-covered',
  ],
  'storekit-sandbox-report': [
    'purchase-passed',
    'restore-passed',
    'server-notification-passed',
  ],
  'wechat-sandbox-report': [
    'purchase-passed',
    'signature-verification-passed',
    'entitlement-update-passed',
  ],
  'alipay-sandbox-report': [
    'purchase-passed',
    'signature-verification-passed',
    'entitlement-update-passed',
  ],
  'webhook-idempotency-report': [
    'signature-required',
    'duplicate-delivery-idempotent',
    'out-of-order-delivery-safe',
  ],
  'cross-channel-entitlement-report': [
    'one-server-entitlement',
    'cross-surface-refresh-passed',
    'concurrent-update-cannot-downgrade',
  ],
  'approved-box-coverage-report': [
    'all-218-boxes-covered',
    'whole-scope-approval-bound',
    'zero-unapproved-boxes',
  ],
  'cet4-approved-box-coverage-report': [
    'all-108-boxes-covered',
    'whole-scope-approval-bound',
    'zero-unapproved-boxes',
  ],
  'cet4-approved-card-coverage-report': [
    'all-1180-cards-covered',
    'whole-scope-approval-bound',
    'zero-unapproved-cards',
  ],
  'cet4-audio-qc-coverage-report': [
    'all-301-assets-covered',
    'all-qc-records-formally-ready',
    'asset-hashes-match-content-release',
  ],
  'cet4-content-pack-integrity-report': [
    'content-version-and-corpus-bound',
    'bundle-evidence-hashes-match',
    'private-assets-hash-bound',
    'source-integrity-complete',
  ],
  'beta-entitlement-drill': [
    'grant-applied-and-verified',
    'grant-replay-idempotent',
    'revoke-applied-and-verified',
    'revoke-replay-idempotent',
    'campaign-account-and-base-membership-bound',
  ],
  'approved-card-coverage-report': [
    'all-2414-cards-covered',
    'whole-scope-approval-bound',
    'zero-unapproved-cards',
  ],
  'content-pack-integrity-report': [
    'content-version-recomputed',
    'signature-verified',
    'private-assets-hash-bound',
    'source-integrity-complete',
  ],
  'apple-review-approval': [
    'exact-ios-build-approved',
    'review-status-approved',
    'no-pending-rejection',
  ],
  'app-filing-approval': [
    'filing-identifier-valid',
    'exact-application-owner',
    'approval-current',
  ],
  'icp-filing-approval': [
    'domain-bound-to-filing',
    'exact-entity-owner',
    'approval-current',
  ],
  'android-channel-approval-report': [
    'required-channels-covered',
    'exact-android-build-approved',
    'release-signing-verified',
  ],
  'privacy-legal-review': [
    'privacy-policy-reviewed',
    'account-deletion-reviewed',
    'data-processing-scope-reviewed',
  ],
  'load-test-report': [
    'required-scenarios-covered',
    'load-thresholds-met',
    'latency-thresholds-met',
    'error-budget-met',
    'data-integrity-preserved',
  ],
  'availability-observation': [
    'required-routes-covered',
    'observation-window-met',
    'missing-probes-counted-as-failure',
    'availability-threshold-met',
    'latency-and-outage-thresholds-met',
  ],
  'backup-restore-drill': [
    'required-datasets-covered',
    'isolated-restore-completed',
    'counts-and-hashes-match',
    'rpo-and-rto-met',
    'production-unchanged',
  ],
  'penetration-test-report': [
    'required-scope-covered',
    'zero-open-critical',
    'zero-open-high',
    'no-critical-or-high-waivers',
    'critical-and-high-retested',
  ],
  'rollback-drill': [
    'required-release-sequence-observed',
    'target-pointer-restored',
    'api-and-content-restored',
    'learning-data-preserved',
    'rollback-rto-met',
    'zero-delete-operations',
  ],
});

const LEARNING_EXECUTION_MODES = Object.freeze({
  'cross-device-bootstrap-test': 'receiver_deployed',
  'offline-replay-test': 'receiver_fault_injection',
  'canonical-state-test': 'receiver_deployed',
  'fsrs-version-lock': 'receiver_deployed',
  'scheduler-contract-test': 'receiver_deployed',
  'clock-boundary-test': 'receiver_fault_injection',
});

const GENERIC_EXECUTION_MODES = new Set([
  'receiver_deployed',
  'receiver_external_apply',
  'receiver_fault_injection',
  'external_assessment',
  'regulatory_approval',
]);

const RELEASE_POLICY_BASELINE = Object.freeze({
  availability: {
    maximum_p95_latency_ms: 1200,
    maximum_probe_interval_seconds: 60,
    maximum_single_outage_seconds: 300,
    minimum_availability_ratio: 0.999,
    minimum_window_seconds: 86400,
    required_routes: [
      '/v2/bootstrap',
      '/v2/learning/session',
      '/v2/content/manifest',
    ],
  },
  backup_restore: {
    maximum_rpo_seconds: 900,
    maximum_rto_seconds: 3600,
    required_datasets: [
      'account-session-membership',
      'learning-events-and-projections',
      'daily-progress',
      'space-actions-and-state',
      'content-releases',
    ],
  },
  load_test: {
    maximum_data_integrity_errors: 0,
    maximum_error_ratio: 0.01,
    maximum_p95_latency_ms: 1200,
    maximum_p99_latency_ms: 2500,
    minimum_concurrent_users: 200,
    minimum_duration_seconds: 1800,
    minimum_request_count: 10000,
    required_scenarios: [
      'auth-bootstrap',
      'learning-session',
      'learning-event',
      'content-manifest',
      'space-action',
    ],
  },
  penetration_test: {
    maximum_open_critical: 0,
    maximum_open_high: 0,
    required_scope: [
      'authentication-and-session',
      'learning-and-space-api',
      'private-content-storage',
      'ios-release',
      'android-release',
      'pc-web-release',
      'payments-and-webhooks',
    ],
  },
  rollback: {
    maximum_delete_operations: 0,
    maximum_rto_seconds: 900,
    required_sequence: [
      'publish-release-a',
      'verify-release-a',
      'publish-release-b',
      'verify-release-b',
      'rollback-release-a',
      'reverify-release-a',
    ],
  },
});

const LEARNING_ASSERTIONS = Object.freeze({
  'cross-device-bootstrap-test': [
    'same_account_distinct_clients',
    'one_new_event_committed',
    'second_client_observed_canonical_event',
    'server_sequence_stable',
    'no_client_snapshot_import',
  ],
  'offline-replay-test': [
    'server_committed_before_ack_loss',
    'byte_equivalent_retry',
    'duplicate_after_retry',
    'queue_cleared_only_after_strict_ack',
    'post_ack_bootstrap_reconciled',
  ],
  'canonical-state-test': [
    'active_session_identity_only',
    'explicit_empty_state_supported',
    'content_release_matches',
    'server_state_wins',
    'post_replay_state_matches',
  ],
  'fsrs-version-lock': [
    'exact_runtime_library',
    'exact_policy',
    'fuzz_disabled',
    'lockfile_matches_deployment',
  ],
  'scheduler-contract-test': [
    'due_precedes_new',
    'sleeping_excluded',
    'membership_access_enforced',
    'selection_binding_enforced',
    'duplicate_does_not_advance',
  ],
  'clock-boundary-test': [
    'server_acceptance_time_used',
    'client_time_does_not_reorder',
    'future_skew_limit_enforced',
    'retention_limit_enforced',
    'utc_plus_8_day_used',
  ],
});

export function validateReleaseOperationalPolicy(policy) {
  const errors = [];
  const label = 'release operational policy';
  if (!isRecord(policy)) {
    return {errors: [`${label} must be an object.`], ok: false};
  }
  assertExactKeys(
    policy,
    [
      'schema_version',
      'policy_id',
      'classification',
      'status',
      'target_release',
      'quality_policy',
      'evidence_validity_days',
      'environment',
      'common_binding',
      'external_capability',
      'load_test',
      'availability',
      'backup_restore',
      'penetration_test',
      'rollback',
      'simulation_boundary',
    ],
    label,
    errors,
  );
  assertEqual(
    policy.schema_version,
    'release-operational-policy.v1',
    `${label}.schema_version`,
    errors,
  );
  assertEqual(
    policy.policy_id,
    'softbook-release-operations.v1',
    `${label}.policy_id`,
    errors,
  );
  assertEqual(
    policy.classification,
    'implementation_hypothesis',
    `${label}.classification`,
    errors,
  );
  assertEqual(policy.status, 'active', `${label}.status`, errors);
  assertEqual(
    policy.target_release,
    '2027-Q2',
    `${label}.target_release`,
    errors,
  );
  assertEqual(
    policy.quality_policy,
    'move_release_date_before_reducing_gate',
    `${label}.quality_policy`,
    errors,
  );
  requireAtLeast(
    policy.evidence_validity_days,
    1,
    `${label}.evidence_validity_days`,
    errors,
  );
  requireAtMost(
    policy.evidence_validity_days,
    180,
    `${label}.evidence_validity_days`,
    errors,
  );
  validateReleasePolicyEnvironment(policy.environment, errors);
  validateReleasePolicyCommonBinding(policy.common_binding, errors);
  validateExternalCapabilityPolicy(policy.external_capability, errors);
  validateReleasePolicyThresholds(policy, errors);
  validateSimulationBoundary(policy.simulation_boundary, errors);
  return {errors, ok: errors.length === 0};
}

export function validateGateEvidenceArtifact(
  artifact,
  {
    evidenceType,
    expectedPolicy = null,
    expectedSubject = null,
    gateId,
    now = new Date(),
    outerEvidence = null,
    releaseOperationalPolicy = null,
    productionDeploymentEvidence = null,
    cet4FormalContentEvidence = null,
    betaEntitlementDrillEvidence = null,
    smsProviderSmokeReport = null,
    targetRelease = '2027-Q2',
  } = {},
) {
  const errors = [];
  const label = `gate ${String(gateId)} evidence ${String(evidenceType)}`;
  if (!isRecord(artifact)) {
    return {errors: [`${label} artifact must be a JSON object.`], ok: false};
  }
  const expectedSchema = LEARNING_RUNTIME_EVIDENCE_SET.has(evidenceType)
    ? 'learning-runtime-evidence.v1'
    : RELEASE_OPERATIONAL_EVIDENCE_SET.has(evidenceType)
      ? 'release-operational-evidence.v1'
      : 'launch-gate-evidence.v1';
  assertExactKeys(
    artifact,
    [
      'schema_version',
      'campaign_id',
      'execution_mode',
      'gate_eligible',
      'result',
      'subject',
      'execution',
      'verification',
      'raw_artifacts',
      'checks',
      'measurements',
    ],
    label,
    errors,
  );
  assertEqual(
    artifact.schema_version,
    expectedSchema,
    `${label} schema_version`,
    errors,
  );
  requirePattern(artifact.campaign_id, ID_PATTERN, `${label} campaign_id`, errors);
  if (artifact.gate_eligible !== true) {
    errors.push(`${label} gate_eligible must be true.`);
  }
  assertEqual(artifact.result, 'passed', `${label} result`, errors);

  validateSubject(
    artifact.subject,
    {
      evidenceType,
      expectedPolicy,
      expectedSubject,
      gateId,
      outerEvidence,
      targetRelease,
    },
    `${label} subject`,
    errors,
  );
  const executionTimes = validateExecution(
    artifact.execution,
    artifact.execution_mode,
    evidenceType,
    releaseOperationalPolicy,
    now,
    `${label} execution`,
    errors,
  );
  const artifactRoles = validateRawArtifacts(
    artifact.raw_artifacts,
    `${label} raw_artifacts`,
    errors,
  );
  validateChecks(
    artifact.checks,
    evidenceType,
    artifactRoles,
    `${label} checks`,
    errors,
  );
  validateVerification(
    artifact.verification,
    outerEvidence,
    executionTimes.completedAt,
    executionTimes.operator,
    RELEASE_OPERATIONAL_EVIDENCE_SET.has(evidenceType)
      ? releaseOperationalPolicy?.evidence_validity_days
      : 180,
    now,
    `${label} verification`,
    errors,
  );

  if (LEARNING_RUNTIME_EVIDENCE_SET.has(evidenceType)) {
    validateLearningMeasurements(
      artifact.measurements,
      evidenceType,
      artifact.subject,
      expectedPolicy,
      executionTimes,
      `${label} measurements`,
      errors,
    );
  } else if (RELEASE_OPERATIONAL_EVIDENCE_SET.has(evidenceType)) {
    validateReleaseMeasurements(
      artifact.measurements,
      evidenceType,
      artifact.subject,
      releaseOperationalPolicy,
      executionTimes,
      `${label} measurements`,
      errors,
    );
  } else if (evidenceType === 'sms-provider-smoke') {
    validateSmsProviderSmokeMeasurements(
      artifact.measurements,
      artifactRoles,
      smsProviderSmokeReport,
      artifact,
      `${label} measurements`,
      errors,
    );
  } else if (evidenceType === 'production-deployment') {
    validateProductionDeploymentMeasurements(
      artifact.measurements,
      artifactRoles,
      productionDeploymentEvidence,
      artifact,
      executionTimes,
      `${label} measurements`,
      errors,
    );
  } else if (CET4_FORMAL_CONTENT_EVIDENCE_SET.has(evidenceType)) {
    validateCet4FormalContentMeasurements(
      artifact.measurements,
      artifactRoles,
      cet4FormalContentEvidence,
      artifact,
      executionTimes,
      `${label} measurements`,
      errors,
    );
  } else if (BETA_ENTITLEMENT_EVIDENCE_SET.has(evidenceType)) {
    validateBetaEntitlementDrillMeasurements(
      artifact.measurements,
      artifactRoles,
      betaEntitlementDrillEvidence,
      artifact,
      expectedSubject,
      executionTimes,
      `${label} measurements`,
      errors,
    );
  } else {
    validateGenericMeasurements(
      artifact.measurements,
      evidenceType,
      `${label} measurements`,
      errors,
    );
  }
  return {errors, ok: errors.length === 0};
}

function validateProductionDeploymentMeasurements(
  value,
  artifactRoles,
  loaded,
  artifact,
  executionTimes,
  label,
  errors,
) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(
    value,
    [
      'deploy_report_role',
      'verify_report_role',
      'profile_role',
      'bundle_role',
      'backend_deployment_id',
      'bundle_id',
      'card_count',
      'audio_asset_count',
      'function_names',
      'assertions',
    ],
    label,
    errors,
  );
  const roleFields = [
    'deploy_report_role',
    'verify_report_role',
    'profile_role',
    'bundle_role',
  ];
  const roles = roleFields.map(field => value[field]);
  for (const field of roleFields) {
    requirePattern(value[field], ID_PATTERN, `${label}.${field}`, errors);
    if (!artifactRoles.has(value[field])) {
      errors.push(`${label}.${field} must reference a declared raw artifact role.`);
    }
  }
  if (new Set(roles).size !== roles.length) {
    errors.push(`${label} raw report, profile and bundle roles must be distinct.`);
  }
  requirePattern(
    value.backend_deployment_id,
    /^backend-deployment:sha256:[0-9a-f]{64}$/,
    `${label}.backend_deployment_id`,
    errors,
  );
  assertEqual(
    value.backend_deployment_id,
    artifact.subject?.release?.backend_deployment_id,
    `${label}.backend_deployment_id subject binding`,
    errors,
  );
  requirePattern(value.bundle_id, ID_PATTERN, `${label}.bundle_id`, errors);
  assertEqual(value.card_count, 1180, `${label}.card_count`, errors);
  assertEqual(value.audio_asset_count, 301, `${label}.audio_asset_count`, errors);
  requireExactArray(
    value.function_names,
    ['softbook-api', 'softbook-account-deletion-worker'],
    `${label}.function_names`,
    errors,
  );
  validateTrueAssertions(
    value.assertions,
    [
      'clean_main_deployed',
      'receiver_function_identity_reverified',
      'account_deletion_worker_reverified',
      'active_release_and_api_verified',
      'rollback_target_retained',
      'zero_imported_user_data',
    ],
    `${label}.assertions`,
    errors,
  );
  if (!isRecord(loaded)) {
    errors.push(`${label} raw roles must resolve to strict receiver delivery evidence.`);
    return;
  }
  const roleArtifacts = new Map(
    (Array.isArray(artifact.raw_artifacts) ? artifact.raw_artifacts : []).map(
      item => [item?.role, item],
    ),
  );
  const profileArtifact = roleArtifacts.get(value.profile_role);
  const bundleArtifact = roleArtifacts.get(value.bundle_role);
  assertEqual(
    profileArtifact?.sha256,
    artifact.subject?.environment?.profile_sha256,
    `${label}.profile_role SHA-256 subject binding`,
    errors,
  );
  assertEqual(
    bundleArtifact?.sha256,
    artifact.subject?.release?.bundle_sha256,
    `${label}.bundle_role SHA-256 subject binding`,
    errors,
  );
  validateDeploymentProfileEvidence(
    loaded.profile,
    artifact.subject,
    `${label} profile`,
    errors,
  );
  assertEqual(
    loaded.deployReport?.receiver_secrets?.signing_key_id,
    loaded.profile?.signing_key_id,
    `${label} deploy report signing_key_id profile binding`,
    errors,
  );
  assertEqual(
    loaded.verifyReport?.receiver_secrets?.signing_key_id,
    loaded.profile?.signing_key_id,
    `${label} verify report signing_key_id profile binding`,
    errors,
  );
  assertEqual(
    value.backend_deployment_id,
    recomputeBackendDeploymentId(
      loaded.profile,
      artifact.subject?.commit_sha,
    ),
    `${label}.backend_deployment_id recomputed binding`,
    errors,
  );
  validateDeploymentBundleEvidence(
    loaded.bundle,
    value,
    artifact.subject,
    `${label} bundle`,
    errors,
  );
  const deployTimes = validateReceiverDeliveryReport(
    loaded.deployReport,
    {
      artifact,
      executionTimes,
      operation: 'deploy',
    },
    `${label} deploy report`,
    errors,
  );
  const verifyTimes = validateReceiverDeliveryReport(
    loaded.verifyReport,
    {
      artifact,
      executionTimes,
      operation: 'verify',
    },
    `${label} verify report`,
    errors,
  );
  if (
    deployTimes.completedAt &&
    verifyTimes.startedAt &&
    verifyTimes.startedAt < deployTimes.completedAt
  ) {
    errors.push(`${label} verify report must start after deployment completes.`);
  }
  validateReceiverDeployResult(
    loaded.deployReport?.deployed,
    value,
    expectedReceiverRuntimeVariableNames(
      loaded.deployReport?.receiver_secrets?.configured_names,
    ),
    loaded.profile,
    expectedReceiverSmsProvider(
      loaded.deployReport?.receiver_secrets?.configured_names,
    ),
    `${label} deploy report.deployed`,
    errors,
  );
  validateReceiverVerifyResult(
    loaded.verifyReport,
    value,
    artifact.subject,
    expectedReceiverRuntimeVariableNames(
      loaded.verifyReport?.receiver_secrets?.configured_names,
    ),
    loaded.profile,
    expectedReceiverSmsProvider(
      loaded.verifyReport?.receiver_secrets?.configured_names,
    ),
    `${label} verify report`,
    errors,
  );
}

function validateCet4FormalContentMeasurements(
  value,
  artifactRoles,
  loaded,
  artifact,
  executionTimes,
  label,
  errors,
) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  const roleFields = [
    'build_report_role',
    'profile_role',
    'bundle_role',
    'content_role',
    'approval_role',
    'audit_role',
    'audio_manifest_role',
    'audio_qc_index_role',
  ];
  assertExactKeys(
    value,
    [
      ...roleFields,
      'content_version',
      'corpus_fingerprint',
      'bundle_id',
      'approval_id',
      'card_count',
      'box_count',
      'audio_asset_count',
      'assertions',
    ],
    label,
    errors,
  );
  const roles = roleFields.map(field => value[field]);
  for (const field of roleFields) {
    requirePattern(value[field], ID_PATTERN, `${label}.${field}`, errors);
    if (!artifactRoles.has(value[field])) {
      errors.push(`${label}.${field} must reference a declared raw artifact role.`);
    }
  }
  if (new Set(roles).size !== roles.length) {
    errors.push(`${label} raw artifact roles must be distinct.`);
  }
  requirePattern(
    value.content_version,
    CONTENT_VERSION_PATTERN,
    `${label}.content_version`,
    errors,
  );
  requirePattern(
    value.corpus_fingerprint,
    CONTENT_VERSION_PATTERN,
    `${label}.corpus_fingerprint`,
    errors,
  );
  requirePattern(value.approval_id, ID_PATTERN, `${label}.approval_id`, errors);
  requirePattern(value.bundle_id, ID_PATTERN, `${label}.bundle_id`, errors);
  assertEqual(value.card_count, 1180, `${label}.card_count`, errors);
  assertEqual(value.box_count, 108, `${label}.box_count`, errors);
  assertEqual(value.audio_asset_count, 301, `${label}.audio_asset_count`, errors);
  validateTrueAssertions(
    value.assertions,
    [
      'exact_cet4_scope',
      'full_track_final_approval_bound',
      'quality_audit_bound',
      'complete_formal_audio_qc',
      'bundle_hashes_match',
      'core_verification_passed',
    ],
    `${label}.assertions`,
    errors,
  );
  if (!isRecord(loaded)) {
    errors.push(`${label} roles must resolve to strict formal content artifacts.`);
    return;
  }
  const rawByRole = new Map(
    (Array.isArray(artifact.raw_artifacts) ? artifact.raw_artifacts : []).map(
      item => [item?.role, item],
    ),
  );
  const raw = field => rawByRole.get(value[field]);
  const reportTimes = validateFormalBundleBuildReport(
    loaded.buildReport,
    {
      artifact,
      executionTimes,
      profileRaw: raw('profile_role'),
      bundleRaw: raw('bundle_role'),
      approvalRaw: raw('approval_role'),
      auditRaw: raw('audit_role'),
      manifestRaw: raw('audio_manifest_role'),
      qcIndexRaw: raw('audio_qc_index_role'),
    },
    `${label} build report`,
    errors,
  );
  assertEqual(
    loaded.buildReport?.bundle_id,
    value.bundle_id,
    `${label} build report.bundle_id`,
    errors,
  );
  assertEqual(
    loaded.buildReport?.approval_id,
    value.approval_id,
    `${label} build report.approval_id`,
    errors,
  );
  validateFormalContentProfile(
    loaded.profile,
    artifact.subject,
    `${label} profile`,
    errors,
  );
  validateFormalContentBundle(
    loaded.bundle,
    value,
    artifact.subject,
    {
      contentRaw: raw('content_role'),
      approvalRaw: raw('approval_role'),
      auditRaw: raw('audit_role'),
      manifestRaw: raw('audio_manifest_role'),
      qcIndexRaw: raw('audio_qc_index_role'),
    },
    `${label} bundle`,
    errors,
  );
  const scope = validateFormalContentPayload(
    loaded.content,
    value,
    `${label} content`,
    errors,
  );
  validateFormalApproval(
    loaded.approval,
    loaded.bundle,
    scope,
    value,
    `${label} approval`,
    errors,
  );
  validateFormalAudit(
    loaded.audit,
    scope,
    value,
    `${label} audit`,
    errors,
  );
  const manifestAssets = validateFormalAudioManifestEvidence(
    loaded.audioManifest,
    loaded.content,
    value,
    `${label} audio manifest`,
    errors,
  );
  const qcScope = validateFormalAudioQcIndexEvidence(
    loaded.audioQcIndex,
    manifestAssets,
    scope,
    value,
    `${label} audio QC index`,
    errors,
  );
  assertEqual(
    loaded.buildReport?.unique_qc_record_count,
    qcScope.uniqueRecordCount,
    `${label} build report.unique_qc_record_count`,
    errors,
  );
  if (
    reportTimes.completedAt &&
    executionTimes.completedAt &&
    reportTimes.completedAt > executionTimes.completedAt
  ) {
    errors.push(`${label} build report must complete within evidence execution.`);
  }
}

function validateFormalBundleBuildReport(
  report,
  {
    artifact,
    executionTimes,
    profileRaw,
    bundleRaw,
    approvalRaw,
    auditRaw,
    manifestRaw,
    qcIndexRaw,
  },
  label,
  errors,
) {
  if (!isRecord(report)) {
    errors.push(`${label} must be an object.`);
    return {completedAt: null, startedAt: null};
  }
  assertExactKeys(
    report,
    [
      'schema_version',
      'apply',
      'bundle_directory',
      'repository_commit',
      'profile_id',
      'profile_sha256',
      'bundle_id',
      'bundle_sha256',
      'release_id',
      'parent_release_id',
      'content_version',
      'card_count',
      'box_count',
      'audio_asset_count',
      'audio_qc_entry_count',
      'unique_qc_record_count',
      'approval_id',
      'approval_sha256',
      'audit_sha256',
      'audio_manifest_sha256',
      'audio_qc_index_sha256',
      'verified',
      'execution',
      'write_safety',
      'cloudbase_writes_performed',
      'gate_eligible',
    ],
    label,
    errors,
  );
  assertEqual(report.schema_version, 'formal-release-bundle-build-report.v2', `${label}.schema_version`, errors);
  assertEqual(report.apply, true, `${label}.apply`, errors);
  if (
    typeof report.bundle_directory !== 'string' ||
    !/^[A-Za-z0-9._-]{3,128}$/.test(report.bundle_directory)
  ) {
    errors.push(`${label}.bundle_directory must be a basename only.`);
  }
  assertEqual(report.repository_commit, artifact.subject?.commit_sha, `${label}.repository_commit`, errors);
  assertEqual(report.profile_id, artifact.subject?.environment?.profile_id, `${label}.profile_id`, errors);
  assertEqual(stripSha(report.profile_sha256), profileRaw?.sha256, `${label}.profile_sha256`, errors);
  assertEqual(stripSha(report.bundle_sha256), bundleRaw?.sha256, `${label}.bundle_sha256`, errors);
  assertEqual(stripSha(report.approval_sha256), approvalRaw?.sha256, `${label}.approval_sha256`, errors);
  assertEqual(stripSha(report.audit_sha256), auditRaw?.sha256, `${label}.audit_sha256`, errors);
  assertEqual(stripSha(report.audio_manifest_sha256), manifestRaw?.sha256, `${label}.audio_manifest_sha256`, errors);
  assertEqual(stripSha(report.audio_qc_index_sha256), qcIndexRaw?.sha256, `${label}.audio_qc_index_sha256`, errors);
  assertEqual(report.bundle_sha256, `sha256:${artifact.subject?.release?.bundle_sha256}`, `${label}.bundle subject binding`, errors);
  assertEqual(report.release_id, artifact.subject?.release?.release_id, `${label}.release_id`, errors);
  assertEqual(report.parent_release_id, artifact.subject?.release?.parent_release_id, `${label}.parent_release_id`, errors);
  assertEqual(report.content_version, artifact.subject?.release?.content_version, `${label}.content_version`, errors);
  assertEqual(report.card_count, 1180, `${label}.card_count`, errors);
  assertEqual(report.box_count, 108, `${label}.box_count`, errors);
  assertEqual(report.audio_asset_count, 301, `${label}.audio_asset_count`, errors);
  assertEqual(report.audio_qc_entry_count, 301, `${label}.audio_qc_entry_count`, errors);
  requirePositiveInteger(report.unique_qc_record_count, `${label}.unique_qc_record_count`, errors);
  assertEqual(report.verified, true, `${label}.verified`, errors);
  assertEqual(report.cloudbase_writes_performed, false, `${label}.cloudbase_writes_performed`, errors);
  assertEqual(report.gate_eligible, false, `${label}.gate_eligible`, errors);
  validateFormalBuildWriteSafety(report.write_safety, artifact.subject, `${label}.write_safety`, errors);
  const times = validateRawExecution(
    report.execution,
    artifact.execution?.operator,
    executionTimes,
    `${label}.execution`,
    errors,
  );
  return times;
}

function validateFormalBuildWriteSafety(value, subject, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(value, ['errors', 'ok', 'branch', 'dirty', 'head', 'origin_main', 'node_version'], label, errors);
  requireExactArray(value.errors, [], `${label}.errors`, errors);
  assertEqual(value.ok, true, `${label}.ok`, errors);
  assertEqual(value.branch, 'main', `${label}.branch`, errors);
  assertEqual(value.dirty, false, `${label}.dirty`, errors);
  assertEqual(value.head, subject?.commit_sha, `${label}.head`, errors);
  assertEqual(value.origin_main, subject?.commit_sha, `${label}.origin_main`, errors);
  assertEqual(value.node_version, '22.13.0', `${label}.node_version`, errors);
}

function validateRawExecution(value, expectedOperator, outerTimes, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return {completedAt: null, startedAt: null};
  }
  assertExactKeys(value, ['started_at', 'completed_at', 'operator'], label, errors);
  assertEqual(value.operator, expectedOperator, `${label}.operator`, errors);
  const startedAt = parseTimestamp(value.started_at, `${label}.started_at`, null, errors);
  const completedAt = parseTimestamp(value.completed_at, `${label}.completed_at`, null, errors);
  if (startedAt && completedAt && completedAt < startedAt) {
    errors.push(`${label}.completed_at must not predate started_at.`);
  }
  requireTimestampWithinExecution(startedAt, outerTimes, `${label}.started_at`, errors);
  requireTimestampWithinExecution(completedAt, outerTimes, `${label}.completed_at`, errors);
  return {completedAt, startedAt};
}

function validateFormalContentProfile(value, subject, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertEqual(value.schema_version, 'delivery-profile.v1', `${label}.schema_version`, errors);
  assertEqual(value.profile_id, subject?.environment?.profile_id, `${label}.profile_id`, errors);
  assertEqual(value.environment_id, subject?.environment?.environment_id, `${label}.environment_id`, errors);
  assertEqual(value.runtime_mode, 'closed_beta', `${label}.runtime_mode`, errors);
  requireExactArray(value.enabled_tracks, ['cet4'], `${label}.enabled_tracks`, errors);
}

function validateFormalContentBundle(value, measurements, subject, raw, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertEqual(value.schema_version, 'release-bundle.v1', `${label}.schema_version`, errors);
  assertEqual(value.track, 'cet4', `${label}.track`, errors);
  assertEqual(value.bundle_id, measurements.bundle_id, `${label}.bundle_id`, errors);
  assertEqual(value.release_id, subject?.release?.release_id, `${label}.release_id`, errors);
  assertEqual(value.parent_release_id, subject?.release?.parent_release_id, `${label}.parent_release_id`, errors);
  assertEqual(value.content?.content_version, measurements.content_version, `${label}.content_version`, errors);
  assertEqual(value.content?.corpus_fingerprint, measurements.corpus_fingerprint, `${label}.corpus_fingerprint`, errors);
  assertEqual(value.content?.card_count, 1180, `${label}.card_count`, errors);
  assertEqual(stripSha(value.content?.payload_sha256), raw.contentRaw?.sha256, `${label}.payload_sha256`, errors);
  assertEqual(stripSha(value.approval?.record_sha256), raw.approvalRaw?.sha256, `${label}.approval_sha256`, errors);
  assertEqual(stripSha(value.audit?.report_sha256), raw.auditRaw?.sha256, `${label}.audit_sha256`, errors);
  assertEqual(stripSha(value.audio?.manifest_sha256), raw.manifestRaw?.sha256, `${label}.manifest_sha256`, errors);
  assertEqual(stripSha(value.audio?.qc_index_sha256), raw.qcIndexRaw?.sha256, `${label}.qc_index_sha256`, errors);
  assertEqual(value.audio?.asset_count, 301, `${label}.audio.asset_count`, errors);
  assertEqual(value.audio?.qc_passed_count, 301, `${label}.audio.qc_passed_count`, errors);
  assertEqual(value.approval?.approval_id, measurements.approval_id, `${label}.approval_id`, errors);
}

function validateFormalContentPayload(value, measurements, label, errors) {
  const scope = {
    cardIds: [],
    boxIds: [],
    audioCardIds: [],
    assetIds: [],
    audioCardIdsByAsset: new Map(),
  };
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return scope;
  }
  assertEqual(value.track, 'cet4', `${label}.track`, errors);
  assertEqual(value.content_version, measurements.content_version, `${label}.content_version`, errors);
  assertEqual(value.corpus_fingerprint, measurements.corpus_fingerprint, `${label}.corpus_fingerprint`, errors);
  const cards = Array.isArray(value.card_records) ? value.card_records : [];
  const assets = Array.isArray(value.assets) ? value.assets : [];
  assertEqual(cards.length, 1180, `${label}.card_count`, errors);
  assertEqual(assets.length, 301, `${label}.asset_count`, errors);
  scope.cardIds = cards.map(card => String(card?.card_id));
  scope.boxIds = [...new Set(cards.map(card => String(card?.knowledge_ref)))];
  scope.audioCardIds = cards.filter(card => card?.audio).map(card => String(card.card_id));
  scope.assetIds = assets.map(asset => String(asset?.asset_id));
  assertUniqueCount(scope.cardIds, 1180, `${label}.card_ids`, errors);
  assertUniqueCount(scope.boxIds, 108, `${label}.box_ids`, errors);
  assertUniqueCount(scope.audioCardIds, 301, `${label}.audio_card_ids`, errors);
  assertUniqueCount(scope.assetIds, 301, `${label}.asset_ids`, errors);
  const assetIdSet = new Set(scope.assetIds);
  for (const card of cards.filter(item => item?.audio)) {
    const cardId = String(card?.card_id);
    const assetId = String(card?.audio?.asset_id);
    if (!assetIdSet.has(assetId)) {
      errors.push(`${label}.${cardId}.audio.asset_id must reference a bound asset.`);
      continue;
    }
    const cardIds = scope.audioCardIdsByAsset.get(assetId) ?? [];
    cardIds.push(cardId);
    scope.audioCardIdsByAsset.set(assetId, cardIds);
  }
  assertSameStringSet(
    [...scope.audioCardIdsByAsset.keys()],
    scope.assetIds,
    `${label}.audio asset references`,
    errors,
  );
  return scope;
}

function validateFormalApproval(value, bundle, scope, measurements, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertEqual(value.approval_id, measurements.approval_id, `${label}.approval_id`, errors);
  assertEqual(value.approval_mode, 'full_track_final', `${label}.approval_mode`, errors);
  assertEqual(value.approved_by_user, true, `${label}.approved_by_user`, errors);
  parseTimestamp(value.approved_at, `${label}.approved_at`, null, errors);
  assertEqual(value.scope?.track, 'cet4', `${label}.track`, errors);
  assertSameStringSet(value.scope?.card_ids, scope.cardIds, `${label}.card_ids`, errors);
  assertSameStringSet(value.scope?.box_prefixes, scope.boxIds, `${label}.box_prefixes`, errors);
  assertEqual(value.card_quality_audit?.corpus_fingerprint, measurements.corpus_fingerprint.slice('sha256:'.length), `${label}.corpus_fingerprint`, errors);
  assertEqual(value.card_quality_audit?.report, bundle?.audit?.report_path, `${label}.audit_path`, errors);
  assertEqual(value.card_quality_audit?.report_sha256, bundle?.audit?.report_sha256, `${label}.audit_sha256`, errors);
  assertEqual(value.card_quality_audit?.scope_has_no_hard_blockers, true, `${label}.scope_has_no_hard_blockers`, errors);
  const summary = value.card_quality_audit?.scope_summary;
  assertEqual(summary?.card_count, 1180, `${label}.scope_summary.card_count`, errors);
  assertSameStringSet(summary?.card_ids, scope.cardIds, `${label}.scope_summary.card_ids`, errors);
  for (const field of ['hard_blocker', 'content_risk', 'review_gap']) {
    assertEqual(summary?.by_severity?.[field], 0, `${label}.scope_summary.${field}`, errors);
  }
}

function validateFormalAudit(value, scope, measurements, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertEqual(value.corpus_fingerprint?.digest, measurements.corpus_fingerprint.slice('sha256:'.length), `${label}.corpus_fingerprint`, errors);
  assertEqual(value.scope_summary?.card_count, 1180, `${label}.card_count`, errors);
  assertSameStringSet(value.scope_summary?.card_ids, scope.cardIds, `${label}.card_ids`, errors);
  for (const field of ['hard_blocker', 'content_risk', 'review_gap']) {
    assertEqual(value.scope_summary?.by_severity?.[field], 0, `${label}.${field}`, errors);
  }
  requireExactArray(value.scope?.missing_card_ids, [], `${label}.missing_card_ids`, errors);
}

function validateFormalAudioManifestEvidence(value, content, measurements, label, errors) {
  const assets = Array.isArray(value?.assets) ? value.assets : [];
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return assets;
  }
  assertEqual(value.schema_version, 'release-audio-manifest.v1', `${label}.schema_version`, errors);
  assertEqual(value.track, 'cet4', `${label}.track`, errors);
  assertEqual(assets.length, 301, `${label}.asset_count`, errors);
  const contentById = new Map((Array.isArray(content?.assets) ? content.assets : []).map(asset => [asset.asset_id, asset]));
  assertUniqueCount(assets.map(asset => asset?.asset_id), 301, `${label}.asset_ids`, errors);
  for (const asset of assets) {
    const expected = contentById.get(asset.asset_id);
    for (const field of ['asset_path', 'sha256', 'size_bytes', 'duration_ms']) {
      assertEqual(asset?.[field], expected?.[field], `${label}.${asset?.asset_id}.${field}`, errors);
    }
  }
  assertEqual(measurements.audio_asset_count, assets.length, `${label}.measurement_count`, errors);
  return assets;
}

function validateFormalAudioQcIndexEvidence(value, manifestAssets, scope, measurements, label, errors) {
  const assets = Array.isArray(value?.assets) ? value.assets : [];
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return {uniqueRecordCount: 0};
  }
  assertExactKeys(value, ['schema_version', 'track', 'corpus_fingerprint', 'assets'], label, errors);
  assertEqual(value.schema_version, 'audio-qc-index.v1', `${label}.schema_version`, errors);
  assertEqual(value.track, 'cet4', `${label}.track`, errors);
  assertEqual(value.corpus_fingerprint, measurements.corpus_fingerprint, `${label}.corpus_fingerprint`, errors);
  assertEqual(assets.length, 301, `${label}.asset_count`, errors);
  assertSameStringSet(assets.map(asset => asset?.asset_id), manifestAssets.map(asset => asset?.asset_id), `${label}.asset_ids`, errors);
  const audioCards = new Set(scope.audioCardIds);
  const coveredCards = new Set();
  for (const asset of assets) {
    const assetLabel = `${label}.${asset?.asset_id}`;
    if (!isRecord(asset)) {
      errors.push(`${assetLabel} must be an object.`);
      continue;
    }
    assertExactKeys(
      asset,
      [
        'asset_id',
        'card_ids',
        'record_path',
        'record_sha256',
        'reviewed_by',
        'reviewed_at',
        'formal_audio_ready',
      ],
      assetLabel,
      errors,
    );
    requirePattern(asset.asset_id, ID_PATTERN, `${assetLabel}.asset_id`, errors);
    assertEqual(asset?.formal_audio_ready, true, `${label}.${asset?.asset_id}.formal_audio_ready`, errors);
    requireSha256(asset?.record_sha256?.replace(/^sha256:/, ''), `${label}.${asset?.asset_id}.record_sha256`, errors);
    const recordHash = stripSha(asset.record_sha256);
    assertEqual(asset.record_path, `audio/qc/${recordHash}.json`, `${assetLabel}.record_path`, errors);
    requirePattern(asset?.reviewed_by, VERIFIER_PATTERN, `${label}.${asset?.asset_id}.reviewed_by`, errors);
    if (/\b(?:agent|codex|bot|automation)\b/i.test(asset.reviewed_by ?? '')) {
      errors.push(`${assetLabel}.reviewed_by must identify a human reviewer.`);
    }
    parseTimestamp(asset?.reviewed_at, `${label}.${asset?.asset_id}.reviewed_at`, null, errors);
    if (!Array.isArray(asset?.card_ids) || asset.card_ids.some(cardId => !audioCards.has(String(cardId)))) {
      errors.push(`${label}.${asset?.asset_id}.card_ids must cover only bound audio cards.`);
    } else {
      assertSameStringSet(
        asset.card_ids,
        scope.audioCardIdsByAsset.get(String(asset.asset_id)) ?? [],
        `${assetLabel}.card_ids`,
        errors,
      );
      for (const cardId of asset.card_ids) coveredCards.add(String(cardId));
    }
  }
  assertSameStringSet(
    [...coveredCards],
    scope.audioCardIds,
    `${label}.card coverage`,
    errors,
  );
  return {
    uniqueRecordCount: new Set(assets.map(asset => stripSha(asset?.record_sha256))).size,
  };
}

function stripSha(value) {
  return typeof value === 'string' ? value.replace(/^sha256:/, '') : value;
}

function assertUniqueCount(values, count, label, errors) {
  if (!Array.isArray(values) || values.length !== count || new Set(values).size !== count) {
    errors.push(`${label} must contain exactly ${count} unique values.`);
  }
}

function assertSameStringSet(left, right, label, errors) {
  if (!Array.isArray(left) || !Array.isArray(right)) {
    errors.push(`${label} must be arrays.`);
    return;
  }
  const a = [...left].map(String).sort();
  const b = [...right].map(String).sort();
  if (a.length !== b.length || new Set(a).size !== a.length || a.some((value, index) => value !== b[index])) {
    errors.push(`${label} sets do not match.`);
  }
}

function validateBetaEntitlementDrillMeasurements(
  value,
  artifactRoles,
  loaded,
  artifact,
  expectedSubject,
  executionTimes,
  label,
  errors,
) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  const roleFields = [
    'profile_role',
    'grant_report_role',
    'grant_replay_report_role',
    'revoke_report_role',
    'revoke_replay_report_role',
  ];
  assertExactKeys(
    value,
    [
      ...roleFields,
      'campaign_id',
      'account_fingerprint',
      'grant_id',
      'assertions',
    ],
    label,
    errors,
  );
  const roles = roleFields.map(field => value[field]);
  for (const field of roleFields) {
    requirePattern(value[field], ID_PATTERN, `${label}.${field}`, errors);
    if (!artifactRoles.has(value[field])) {
      errors.push(`${label}.${field} must reference a declared raw artifact role.`);
    }
  }
  if (new Set(roles).size !== roles.length) {
    errors.push(`${label} raw artifact roles must be distinct.`);
  }
  requirePattern(value.campaign_id, ID_PATTERN, `${label}.campaign_id`, errors);
  requirePattern(
    value.account_fingerprint,
    /^sha256:[0-9a-f]{16}$/,
    `${label}.account_fingerprint`,
    errors,
  );
  requirePattern(value.grant_id, ID_PATTERN, `${label}.grant_id`, errors);
  assertEqual(
    value.campaign_id,
    expectedSubject?.entitlement?.campaign_id,
    `${label}.campaign_id candidate binding`,
    errors,
  );
  validateTrueAssertions(
    value.assertions,
    [
      'grant_applied_and_verified',
      'grant_replay_idempotent',
      'revoke_applied_and_verified',
      'revoke_replay_idempotent',
      'base_membership_unchanged',
      'same_campaign_account_and_candidate',
    ],
    `${label}.assertions`,
    errors,
  );
  if (!isRecord(loaded)) {
    errors.push(`${label} roles must resolve to strict beta drill artifacts.`);
    return;
  }
  const rawByRole = new Map(
    (Array.isArray(artifact.raw_artifacts) ? artifact.raw_artifacts : []).map(
      item => [item?.role, item],
    ),
  );
  const profileRaw = rawByRole.get(value.profile_role);
  validateBetaEntitlementDrillProfile(
    loaded.profile,
    artifact.subject,
    `${label} profile`,
    errors,
  );
  const phases = [
    validateBetaEntitlementPhaseReport(
      loaded.grantReport,
      {
        action: 'grant',
        active: true,
        artifact,
        changed: true,
        executionTimes,
        idempotent: false,
        profileRaw,
        writesPerformed: true,
      },
      `${label} grant report`,
      errors,
    ),
    validateBetaEntitlementPhaseReport(
      loaded.grantReplayReport,
      {
        action: 'grant',
        active: true,
        artifact,
        changed: false,
        executionTimes,
        idempotent: true,
        profileRaw,
        writesPerformed: false,
      },
      `${label} grant replay report`,
      errors,
    ),
    validateBetaEntitlementPhaseReport(
      loaded.revokeReport,
      {
        action: 'revoke',
        active: false,
        artifact,
        changed: true,
        executionTimes,
        idempotent: false,
        profileRaw,
        writesPerformed: true,
      },
      `${label} revoke report`,
      errors,
    ),
    validateBetaEntitlementPhaseReport(
      loaded.revokeReplayReport,
      {
        action: 'revoke',
        active: false,
        artifact,
        changed: false,
        executionTimes,
        idempotent: true,
        profileRaw,
        writesPerformed: false,
      },
      `${label} revoke replay report`,
      errors,
    ),
  ];
  validateBetaEntitlementPhaseRelationships(
    phases,
    value,
    `${label} phase sequence`,
    errors,
  );
}

function validateBetaEntitlementDrillProfile(value, subject, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertEqual(value.schema_version, 'delivery-profile.v1', `${label}.schema_version`, errors);
  assertEqual(value.profile_id, subject?.environment?.profile_id, `${label}.profile_id`, errors);
  assertEqual(value.environment_id, subject?.environment?.environment_id, `${label}.environment_id`, errors);
  assertEqual(value.runtime_mode, 'closed_beta', `${label}.runtime_mode`, errors);
  requireExactArray(value.enabled_tracks, ['cet4'], `${label}.enabled_tracks`, errors);
}

function validateBetaEntitlementPhaseReport(
  report,
  {
    action,
    active,
    artifact,
    changed,
    executionTimes,
    idempotent,
    profileRaw,
    writesPerformed,
  },
  label,
  errors,
) {
  const phase = {
    baseHash: null,
    command: null,
    completedAt: null,
    result: null,
    startedAt: null,
    state: null,
  };
  if (!isRecord(report)) {
    errors.push(`${label} must be an object.`);
    return phase;
  }
  assertExactKeys(
    report,
    [
      'schema_version',
      'applied',
      'gate_eligible',
      'repository_commit',
      'profile',
      'command',
      'preflight',
      'write_safety',
      'base_membership',
      'beta_state',
      'result',
      'status',
      'writes_performed',
      'execution',
    ],
    label,
    errors,
  );
  assertEqual(report.schema_version, 'beta-entitlement-report.v2', `${label}.schema_version`, errors);
  assertEqual(report.applied, true, `${label}.applied`, errors);
  assertEqual(report.gate_eligible, false, `${label}.gate_eligible`, errors);
  assertEqual(report.repository_commit, artifact.subject?.commit_sha, `${label}.repository_commit`, errors);
  validateBetaEntitlementReportProfile(
    report.profile,
    artifact.subject,
    profileRaw,
    `${label}.profile`,
    errors,
  );
  phase.command = validateBetaEntitlementReportCommand(
    report.command,
    action,
    `${label}.command`,
    errors,
  );
  validateBetaEntitlementPreflight(report.preflight, `${label}.preflight`, errors);
  validateBetaEntitlementWriteSafety(
    report.write_safety,
    artifact.subject,
    `${label}.write_safety`,
    errors,
  );
  phase.baseHash = validateBetaEntitlementBaseMembership(
    report.base_membership,
    `${label}.base_membership`,
    errors,
  );
  phase.state = validateBetaEntitlementState(
    report.beta_state,
    active,
    `${label}.beta_state`,
    errors,
  );
  phase.result = validateBetaEntitlementResult(
    report.result,
    phase.command,
    {action, changed, idempotent},
    `${label}.result`,
    errors,
  );
  assertEqual(report.status, 'passed', `${label}.status`, errors);
  assertEqual(report.writes_performed, writesPerformed, `${label}.writes_performed`, errors);
  const times = validateRawExecution(
    report.execution,
    artifact.execution?.operator,
    executionTimes,
    `${label}.execution`,
    errors,
  );
  phase.startedAt = times.startedAt;
  phase.completedAt = times.completedAt;
  return phase;
}

function validateBetaEntitlementReportProfile(value, subject, raw, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(
    value,
    ['environment_id', 'profile_id', 'profile_sha256', 'runtime_mode'],
    label,
    errors,
  );
  assertEqual(value.environment_id, subject?.environment?.environment_id, `${label}.environment_id`, errors);
  assertEqual(value.profile_id, subject?.environment?.profile_id, `${label}.profile_id`, errors);
  assertEqual(stripSha(value.profile_sha256), raw?.sha256, `${label}.profile_sha256`, errors);
  assertEqual(value.runtime_mode, 'closed_beta', `${label}.runtime_mode`, errors);
}

function validateBetaEntitlementReportCommand(value, action, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return {};
  }
  assertExactKeys(
    value,
    [
      'account_fingerprint',
      'action',
      'actor_id',
      'campaign_id',
      'command_sha256',
      'event_id',
      'grant_id',
    ],
    label,
    errors,
  );
  requirePattern(value.account_fingerprint, /^sha256:[0-9a-f]{16}$/, `${label}.account_fingerprint`, errors);
  assertEqual(value.action, action, `${label}.action`, errors);
  requirePattern(value.actor_id, VERIFIER_PATTERN, `${label}.actor_id`, errors);
  requirePattern(value.campaign_id, ID_PATTERN, `${label}.campaign_id`, errors);
  requireSha256(stripSha(value.command_sha256), `${label}.command_sha256`, errors);
  requirePattern(value.event_id, ID_PATTERN, `${label}.event_id`, errors);
  requirePattern(value.grant_id, ID_PATTERN, `${label}.grant_id`, errors);
  return value;
}

function validateBetaEntitlementPreflight(value, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(value, ['errors', 'required_collections_present'], label, errors);
  requireExactArray(value.errors, [], `${label}.errors`, errors);
  assertEqual(value.required_collections_present, true, `${label}.required_collections_present`, errors);
}

function validateBetaEntitlementWriteSafety(value, subject, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(
    value,
    ['errors', 'ok', 'branch', 'dirty', 'head', 'originMain', 'node_version'],
    label,
    errors,
  );
  requireExactArray(value.errors, [], `${label}.errors`, errors);
  assertEqual(value.ok, true, `${label}.ok`, errors);
  assertEqual(value.branch, 'main', `${label}.branch`, errors);
  assertEqual(value.dirty, false, `${label}.dirty`, errors);
  assertEqual(value.head, subject?.commit_sha, `${label}.head`, errors);
  assertEqual(value.originMain, subject?.commit_sha, `${label}.originMain`, errors);
  assertEqual(value.node_version, '22.13.0', `${label}.node_version`, errors);
}

function validateBetaEntitlementBaseMembership(value, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return null;
  }
  assertExactKeys(value, ['after_sha256', 'before_sha256', 'unchanged'], label, errors);
  requireSha256(stripSha(value.before_sha256), `${label}.before_sha256`, errors);
  requireSha256(stripSha(value.after_sha256), `${label}.after_sha256`, errors);
  assertEqual(value.after_sha256, value.before_sha256, `${label} digest parity`, errors);
  assertEqual(value.unchanged, true, `${label}.unchanged`, errors);
  return value.before_sha256;
}

function validateBetaEntitlementState(value, active, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return {};
  }
  assertExactKeys(
    value,
    [
      'active',
      'active_campaign_id',
      'active_grant_id',
      'audit_event_count',
      'revision',
      'state_sha256',
    ],
    label,
    errors,
  );
  assertEqual(value.active, active, `${label}.active`, errors);
  if (!Number.isSafeInteger(value.revision) || value.revision <= 0) {
    errors.push(`${label}.revision must be a positive integer.`);
  }
  assertEqual(value.audit_event_count, value.revision, `${label}.audit_event_count`, errors);
  requireSha256(stripSha(value.state_sha256), `${label}.state_sha256`, errors);
  if (active) {
    requirePattern(value.active_campaign_id, ID_PATTERN, `${label}.active_campaign_id`, errors);
    requirePattern(value.active_grant_id, ID_PATTERN, `${label}.active_grant_id`, errors);
  } else {
    assertEqual(value.active_campaign_id, null, `${label}.active_campaign_id`, errors);
    assertEqual(value.active_grant_id, null, `${label}.active_grant_id`, errors);
  }
  return value;
}

function validateBetaEntitlementResult(
  value,
  command,
  {action, changed, idempotent},
  label,
  errors,
) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return {};
  }
  assertExactKeys(
    value,
    [
      'schema_version',
      'action',
      'account_fingerprint',
      'actor_id',
      'campaign_id',
      'changed',
      'event_id',
      'grant_id',
      'idempotent',
      'previous_stage',
      'resulting_stage',
    ],
    label,
    errors,
  );
  assertEqual(value.schema_version, 'beta-entitlement-plan.v1', `${label}.schema_version`, errors);
  for (const field of [
    'action',
    'account_fingerprint',
    'actor_id',
    'campaign_id',
    'event_id',
    'grant_id',
  ]) {
    assertEqual(value[field], command?.[field], `${label}.${field}`, errors);
  }
  assertEqual(value.action, action, `${label}.action phase`, errors);
  assertEqual(value.changed, changed, `${label}.changed`, errors);
  assertEqual(value.idempotent, idempotent, `${label}.idempotent`, errors);
  if (!['trial_available', 'trial', 'free', 'premium'].includes(value.previous_stage)) {
    errors.push(`${label}.previous_stage is invalid.`);
  }
  if (!['trial_available', 'trial', 'free', 'premium'].includes(value.resulting_stage)) {
    errors.push(`${label}.resulting_stage is invalid.`);
  }
  return value;
}

function validateBetaEntitlementPhaseRelationships(phases, measurements, label, errors) {
  const [grant, grantReplay, revoke, revokeReplay] = phases;
  const commands = phases.map(phase => phase.command ?? {});
  for (const [field, expected] of [
    ['campaign_id', measurements.campaign_id],
    ['account_fingerprint', measurements.account_fingerprint],
    ['grant_id', measurements.grant_id],
  ]) {
    for (const [index, command] of commands.entries()) {
      assertEqual(command[field], expected, `${label}.phase_${index + 1}.${field}`, errors);
    }
  }
  for (const field of ['actor_id', 'campaign_id', 'account_fingerprint', 'grant_id']) {
    for (const command of commands.slice(1)) {
      assertEqual(command[field], commands[0]?.[field], `${label}.${field} parity`, errors);
    }
  }
  for (const field of ['event_id', 'command_sha256']) {
    assertEqual(grantReplay.command?.[field], grant.command?.[field], `${label}.grant ${field} replay`, errors);
    assertEqual(revokeReplay.command?.[field], revoke.command?.[field], `${label}.revoke ${field} replay`, errors);
    if (grant.command?.[field] === revoke.command?.[field]) {
      errors.push(`${label} grant and revoke ${field} must be distinct.`);
    }
  }
  for (const phase of phases.slice(1)) {
    assertEqual(phase.baseHash, phases[0].baseHash, `${label}.base membership campaign parity`, errors);
  }
  if (!['trial_available', 'trial', 'free'].includes(grant.result?.previous_stage)) {
    errors.push(`${label} grant must begin from a non-premium base stage.`);
  }
  assertEqual(grant.result?.resulting_stage, 'premium', `${label}.grant resulting_stage`, errors);
  assertEqual(grantReplay.result?.previous_stage, grant.result?.previous_stage, `${label}.grant replay previous_stage`, errors);
  assertEqual(grantReplay.result?.resulting_stage, 'premium', `${label}.grant replay resulting_stage`, errors);
  assertEqual(revoke.result?.previous_stage, 'premium', `${label}.revoke previous_stage`, errors);
  assertEqual(revoke.result?.resulting_stage, grant.result?.previous_stage, `${label}.revoke base restoration`, errors);
  assertEqual(revokeReplay.result?.previous_stage, 'premium', `${label}.revoke replay previous_stage`, errors);
  assertEqual(revokeReplay.result?.resulting_stage, grant.result?.previous_stage, `${label}.revoke replay base restoration`, errors);
  for (const field of [
    'active',
    'active_campaign_id',
    'active_grant_id',
    'audit_event_count',
    'revision',
    'state_sha256',
  ]) {
    assertEqual(grantReplay.state?.[field], grant.state?.[field], `${label}.grant state ${field}`, errors);
    assertEqual(revokeReplay.state?.[field], revoke.state?.[field], `${label}.revoke state ${field}`, errors);
  }
  assertEqual(grant.state?.active_campaign_id, measurements.campaign_id, `${label}.active campaign`, errors);
  assertEqual(grant.state?.active_grant_id, measurements.grant_id, `${label}.active grant`, errors);
  assertEqual(revoke.state?.revision, (grant.state?.revision ?? 0) + 1, `${label}.revoke revision`, errors);
  assertEqual(revoke.state?.audit_event_count, (grant.state?.audit_event_count ?? 0) + 1, `${label}.revoke audit count`, errors);
  if (grant.state?.state_sha256 === revoke.state?.state_sha256) {
    errors.push(`${label} grant and revoke state digests must differ.`);
  }
  for (let index = 1; index < phases.length; index += 1) {
    const previous = phases[index - 1];
    const current = phases[index];
    if (
      previous.completedAt &&
      current.startedAt &&
      current.startedAt < previous.completedAt
    ) {
      errors.push(`${label} phases must execute in grant/replay/revoke/replay order.`);
    }
  }
}

function validateReceiverDeliveryReport(
  report,
  {artifact, executionTimes, operation},
  label,
  errors,
) {
  const expectedKeys =
    operation === 'deploy'
      ? [
          'schema_version',
          'operation',
          'applied',
          'backend_deployment_id',
          'profile',
          'preflight',
          'receiver_secrets',
          'write_safety',
          'deployed',
          'status',
          'writes_performed',
          'execution',
        ]
      : [
          'schema_version',
          'operation',
          'applied',
          'backend_deployment_id',
          'profile',
          'preflight',
          'receiver_secrets',
          'write_safety',
          'active_release',
          'api_route',
          'backend_deployment',
          'release',
          'rollback_target',
          'status',
          'user_data_import_check',
          'writes_performed',
          'execution',
        ];
  if (!isRecord(report)) {
    errors.push(`${label} must be an object.`);
    return {completedAt: null, startedAt: null};
  }
  assertExactKeys(report, expectedKeys, label, errors);
  assertEqual(report.schema_version, 'receiver-delivery-report.v2', `${label}.schema_version`, errors);
  assertEqual(report.operation, operation, `${label}.operation`, errors);
  assertEqual(report.applied, operation === 'deploy', `${label}.applied`, errors);
  assertEqual(report.status, 'passed', `${label}.status`, errors);
  assertEqual(
    report.writes_performed,
    operation === 'deploy',
    `${label}.writes_performed`,
    errors,
  );
  assertEqual(
    report.backend_deployment_id,
    artifact.subject?.release?.backend_deployment_id,
    `${label}.backend_deployment_id`,
    errors,
  );
  validateReceiverReportProfile(report.profile, artifact.subject, `${label}.profile`, errors);
  validateReceiverPreflight(report.preflight, artifact.subject, `${label}.preflight`, errors);
  validateReceiverSecretSummary(report.receiver_secrets, `${label}.receiver_secrets`, errors);
  validateReceiverWriteSafety(report.write_safety, artifact.subject, `${label}.write_safety`, errors);
  const times = validateReceiverReportExecution(
    report.execution,
    artifact.execution?.operator,
    executionTimes,
    `${label}.execution`,
    errors,
  );
  return times;
}

function validateReceiverReportProfile(value, subject, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(value, ['environment_id', 'profile_id', 'region'], label, errors);
  assertEqual(value.environment_id, subject?.environment?.environment_id, `${label}.environment_id`, errors);
  assertEqual(value.profile_id, subject?.environment?.profile_id, `${label}.profile_id`, errors);
  requirePattern(value.region, /^[a-z]+-[a-z]+(?:-\d+)?$/, `${label}.region`, errors);
}

function validateReceiverPreflight(value, subject, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(
    value,
    ['ok', 'errors', 'environment', 'database_instance_id', 'catalog'],
    label,
    errors,
  );
  assertEqual(value.ok, true, `${label}.ok`, errors);
  requireExactArray(value.errors, [], `${label}.errors`, errors);
  if (!isRecord(value.environment)) {
    errors.push(`${label}.environment must be an object.`);
  } else {
    assertExactKeys(
      value.environment,
      ['database_status', 'env_id', 'region', 'status'],
      `${label}.environment`,
      errors,
    );
    assertEqual(
      value.environment.env_id,
      subject?.environment?.environment_id,
      `${label}.environment.env_id`,
      errors,
    );
    assertEqual(value.environment.status, 'NORMAL', `${label}.environment.status`, errors);
    assertEqual(
      value.environment.database_status,
      'RUNNING',
      `${label}.environment.database_status`,
      errors,
    );
  }
  requirePattern(
    value.database_instance_id,
    /^tnt-[a-z0-9]+$/,
    `${label}.database_instance_id`,
    errors,
  );
  if (!isRecord(value.catalog)) {
    errors.push(`${label}.catalog must be an object.`);
  } else {
    assertExactKeys(
      value.catalog,
      [
        'collection_names',
        'errors',
        'missing_required_collections',
        'ok',
        'required_collections_present',
      ],
      `${label}.catalog`,
      errors,
    );
    requireExactArray(
      value.catalog.collection_names,
      [...RECEIVER_REQUIRED_COLLECTIONS].sort(),
      `${label}.catalog.collection_names`,
      errors,
    );
    requireExactArray(value.catalog.errors, [], `${label}.catalog.errors`, errors);
    requireExactArray(
      value.catalog.missing_required_collections,
      [],
      `${label}.catalog.missing_required_collections`,
      errors,
    );
    assertEqual(value.catalog.ok, true, `${label}.catalog.ok`, errors);
    assertEqual(
      value.catalog.required_collections_present,
      true,
      `${label}.catalog.required_collections_present`,
      errors,
    );
  }
}

function validateReceiverSecretSummary(value, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(value, ['configured_names', 'errors', 'ok', 'signing_key_id'], label, errors);
  assertEqual(value.ok, true, `${label}.ok`, errors);
  requireExactArray(value.errors, [], `${label}.errors`, errors);
  const common = [
    'SOFTBOOK_AUTH_INDEX_SECRET',
    'SOFTBOOK_AUTH_TOKEN_SECRET',
    'SOFTBOOK_CONTENT_MANIFEST_PRIVATE_KEY_PEM',
    'SOFTBOOK_SMS_PROVIDER',
  ];
  const allowedSets = [
    [
      ...common,
      'SOFTBOOK_SMS_WEBHOOK_SECRET',
      'SOFTBOOK_SMS_WEBHOOK_URL',
    ].sort(),
    [
      ...common,
      'SOFTBOOK_SMS_TENCENT_REGION',
      'SOFTBOOK_SMS_TENCENT_SDK_APP_ID',
      'SOFTBOOK_SMS_TENCENT_SECRET_ID',
      'SOFTBOOK_SMS_TENCENT_SECRET_KEY',
      'SOFTBOOK_SMS_TENCENT_SIGN_NAME',
      'SOFTBOOK_SMS_TENCENT_TEMPLATE_ID',
      'SOFTBOOK_SMS_TENCENT_TEMPLATE_PARAMETERS',
    ].sort(),
  ];
  const actual = Array.isArray(value.configured_names)
    ? [...value.configured_names].sort()
    : null;
  if (!actual || !allowedSets.some(expected => stableJson(expected) === stableJson(actual))) {
    errors.push(`${label}.configured_names must match one exact production SMS provider set.`);
  }
  requirePattern(value.signing_key_id, ID_PATTERN, `${label}.signing_key_id`, errors);
}

function validateReceiverWriteSafety(value, subject, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(value, ['errors', 'ok', 'branch', 'dirty', 'head', 'originMain'], label, errors);
  requireExactArray(value.errors, [], `${label}.errors`, errors);
  assertEqual(value.ok, true, `${label}.ok`, errors);
  assertEqual(value.branch, 'main', `${label}.branch`, errors);
  assertEqual(value.dirty, false, `${label}.dirty`, errors);
  assertEqual(value.head, subject?.commit_sha, `${label}.head`, errors);
  assertEqual(value.originMain, subject?.commit_sha, `${label}.originMain`, errors);
}

function validateReceiverReportExecution(
  value,
  expectedOperator,
  executionTimes,
  label,
  errors,
) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return {completedAt: null, startedAt: null};
  }
  assertExactKeys(value, ['completed_at', 'operator', 'started_at'], label, errors);
  assertEqual(value.operator, expectedOperator, `${label}.operator`, errors);
  const startedAt = parseTimestamp(value.started_at, `${label}.started_at`, null, errors);
  const completedAt = parseTimestamp(value.completed_at, `${label}.completed_at`, null, errors);
  if (startedAt && completedAt && completedAt < startedAt) {
    errors.push(`${label}.completed_at must not predate started_at.`);
  }
  requireTimestampWithinExecution(startedAt, executionTimes, `${label}.started_at`, errors);
  requireTimestampWithinExecution(completedAt, executionTimes, `${label}.completed_at`, errors);
  return {completedAt, startedAt};
}

function validateDeploymentProfileEvidence(value, subject, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(
    value,
    [
      'schema_version',
      'profile_id',
      'environment_id',
      'region',
      'api_base_url',
      'runtime_mode',
      'enabled_tracks',
      'minimum_client_versions',
      'signing_key_id',
    ],
    label,
    errors,
  );
  assertEqual(value.schema_version, 'delivery-profile.v1', `${label}.schema_version`, errors);
  assertEqual(value.profile_id, subject?.environment?.profile_id, `${label}.profile_id`, errors);
  assertEqual(
    value.environment_id,
    subject?.environment?.environment_id,
    `${label}.environment_id`,
    errors,
  );
  requirePattern(value.region, /^[a-z]+-[a-z]+(?:-\d+)?$/, `${label}.region`, errors);
  if (typeof value.api_base_url !== 'string') {
    errors.push(`${label}.api_base_url must be HTTPS.`);
  } else {
    try {
      const url = new URL(value.api_base_url);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname === '/'
      ) {
        throw new Error('unsafe');
      }
    } catch {
      errors.push(`${label}.api_base_url must be credential-free HTTPS with a path.`);
    }
  }
  assertEqual(value.runtime_mode, 'closed_beta', `${label}.runtime_mode`, errors);
  requireExactArray(value.enabled_tracks, ['cet4'], `${label}.enabled_tracks`, errors);
  if (!isRecord(value.minimum_client_versions)) {
    errors.push(`${label}.minimum_client_versions must be an object.`);
  } else {
    assertExactKeys(
      value.minimum_client_versions,
      ['ios', 'android'],
      `${label}.minimum_client_versions`,
      errors,
    );
    for (const platform of ['ios', 'android']) {
      requirePattern(
        value.minimum_client_versions[platform],
        STRICT_SEMVER_PATTERN,
        `${label}.minimum_client_versions.${platform}`,
        errors,
      );
    }
  }
  requirePattern(value.signing_key_id, ID_PATTERN, `${label}.signing_key_id`, errors);
}

function recomputeBackendDeploymentId(profile, repositoryCommit) {
  if (!isRecord(profile) || !COMMIT_PATTERN.test(repositoryCommit ?? '')) {
    return null;
  }
  const normalizedProfile = {
    schema_version: profile.schema_version,
    profile_id: profile.profile_id,
    environment_id: profile.environment_id,
    region: profile.region,
    api_base_url: profile.api_base_url,
    runtime_mode: profile.runtime_mode,
    enabled_tracks: profile.enabled_tracks,
    minimum_client_versions: {
      ios: profile.minimum_client_versions?.ios,
      android: profile.minimum_client_versions?.android,
    },
    signing_key_id: profile.signing_key_id,
  };
  const identity = JSON.stringify({
    functions: [
      {
        handler: 'index.main',
        name: 'softbook-api',
        runtime: 'Nodejs20.19',
        timeout: 10,
      },
      {
        handler: 'index.accountDeletionWorkerMain',
        name: 'softbook-account-deletion-worker',
        runtime: 'Nodejs20.19',
        timeout: 60,
        trigger: '0 */1 * * * * *',
      },
    ],
    profile: normalizedProfile,
    repository_commit: repositoryCommit,
    runtime: 'Nodejs20.19',
    schema_version: 'backend-deployment-identity.v1',
  });
  return `backend-deployment:sha256:${createHash('sha256')
    .update(identity)
    .digest('hex')}`;
}

function validateDeploymentBundleEvidence(value, measurements, subject, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(
    value,
    [
      'schema_version',
      'bundle_id',
      'release_id',
      'track',
      'created_at',
      'release_at',
      'parent_release_id',
      'content',
      'approval',
      'audit',
      'audio',
      'minimum_client_versions',
    ],
    label,
    errors,
  );
  assertEqual(value.schema_version, 'release-bundle.v1', `${label}.schema_version`, errors);
  assertEqual(value.bundle_id, measurements.bundle_id, `${label}.bundle_id`, errors);
  assertEqual(value.release_id, subject?.release?.release_id, `${label}.release_id`, errors);
  assertEqual(
    value.parent_release_id,
    subject?.release?.parent_release_id,
    `${label}.parent_release_id`,
    errors,
  );
  if (value.parent_release_id === null) {
    errors.push(`${label}.parent_release_id must name a retained rollback target.`);
  }
  assertEqual(value.track, 'cet4', `${label}.track`, errors);
  if (!isRecord(value.content)) {
    errors.push(`${label}.content must be an object.`);
  } else {
    assertExactKeys(
      value.content,
      [
        'payload_path',
        'payload_sha256',
        'content_version',
        'corpus_fingerprint',
        'card_count',
      ],
      `${label}.content`,
      errors,
    );
    assertEqual(
      value.content.content_version,
      subject?.release?.content_version,
      `${label}.content.content_version`,
      errors,
    );
    assertEqual(value.content.card_count, 1180, `${label}.content.card_count`, errors);
  }
  if (!isRecord(value.audio)) {
    errors.push(`${label}.audio must be an object.`);
  } else {
    assertExactKeys(
      value.audio,
      [
        'manifest_path',
        'manifest_sha256',
        'qc_index_path',
        'qc_index_sha256',
        'asset_count',
        'qc_passed_count',
      ],
      `${label}.audio`,
      errors,
    );
    assertEqual(value.audio.asset_count, 301, `${label}.audio.asset_count`, errors);
    assertEqual(value.audio.qc_passed_count, 301, `${label}.audio.qc_passed_count`, errors);
  }
}

function validateReceiverApiFunction(
  value,
  expectedDeploymentId,
  expectedProfile,
  expectedSmsProvider,
  label,
  errors,
) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(
    value,
    [
      'backend_deployment_id',
      'function_name',
      'handler',
      'runtime',
      'runtime_mode',
      'signing_key_id',
      'sms_provider',
      'store_mode',
      'timeout',
      'variable_names',
    ],
    label,
    errors,
  );
  assertEqual(
    value.backend_deployment_id,
    expectedDeploymentId,
    `${label}.backend_deployment_id`,
    errors,
  );
  assertEqual(value.function_name, 'softbook-api', `${label}.function_name`, errors);
  assertEqual(value.handler, 'index.main', `${label}.handler`, errors);
  assertEqual(value.runtime, 'Nodejs20.19', `${label}.runtime`, errors);
  assertEqual(value.runtime_mode, 'production', `${label}.runtime_mode`, errors);
  assertEqual(
    value.signing_key_id,
    expectedProfile?.signing_key_id,
    `${label}.signing_key_id`,
    errors,
  );
  assertEqual(value.sms_provider, expectedSmsProvider, `${label}.sms_provider`, errors);
  assertEqual(value.store_mode, 'cloudbase', `${label}.store_mode`, errors);
  assertEqual(value.timeout, 10, `${label}.timeout`, errors);
  if (
    !Array.isArray(value.variable_names) ||
    !value.variable_names.includes('SOFTBOOK_BACKEND_DEPLOYMENT_ID') ||
    value.variable_names.includes('SOFTBOOK_SMS_DEV_CODE')
  ) {
    errors.push(`${label}.variable_names must bind deployment ID and exclude fixed SMS code.`);
  }
}

function expectedReceiverRuntimeVariableNames(configuredNames) {
  if (!Array.isArray(configuredNames)) return null;
  const names = new Set(configuredNames);
  for (const name of [
    'SOFTBOOK_BACKEND_DEPLOYMENT_ID',
    'SOFTBOOK_CONTENT_MANIFEST_KEY_ID',
    'SOFTBOOK_LEARNING_EVENTS_BATCH_LIMIT',
    'SOFTBOOK_LEARNING_EVENTS_FUTURE_SKEW_SECONDS',
    'SOFTBOOK_LEARNING_EVENTS_RETENTION_DAYS',
    'SOFTBOOK_RUNTIME_MODE',
    'SOFTBOOK_STORE_MODE',
  ]) {
    names.add(name);
  }
  if (names.has('SOFTBOOK_SMS_WEBHOOK_URL')) {
    names.add('SOFTBOOK_SMS_WEBHOOK_TIMEOUT_MS');
  }
  if (names.has('SOFTBOOK_SMS_TENCENT_REGION')) {
    names.add('SOFTBOOK_SMS_TENCENT_TIMEOUT_MS');
  }
  return [...names].sort();
}

function expectedReceiverSmsProvider(configuredNames) {
  if (!Array.isArray(configuredNames)) return null;
  if (configuredNames.includes('SOFTBOOK_SMS_WEBHOOK_URL')) return 'webhook';
  if (configuredNames.includes('SOFTBOOK_SMS_TENCENT_REGION')) return 'tencentcloud';
  return null;
}

function validateReceiverDeployResult(
  value,
  measurements,
  expectedRuntimeVariableNames,
  expectedProfile,
  expectedSmsProvider,
  label,
  errors,
) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(
    value,
    [
      'api_function',
      'backend_deployment_id',
      'deletion_worker',
      'deletion_worker_runtime_variable_names',
      'deletion_worker_trigger',
      'fixed_sms_code_present',
      'function_name',
      'function_names',
      'runtime',
      'runtime_variable_names',
    ],
    label,
    errors,
  );
  assertEqual(
    value.backend_deployment_id,
    measurements.backend_deployment_id,
    `${label}.backend_deployment_id`,
    errors,
  );
  validateReceiverApiFunction(
    value.api_function,
    measurements.backend_deployment_id,
    expectedProfile,
    expectedSmsProvider,
    `${label}.api_function`,
    errors,
  );
  requireExactArray(
    value.api_function?.variable_names,
    expectedRuntimeVariableNames,
    `${label}.api_function.variable_names`,
    errors,
  );
  assertEqual(value.function_name, 'softbook-api', `${label}.function_name`, errors);
  requireExactArray(value.function_names, measurements.function_names, `${label}.function_names`, errors);
  assertEqual(value.runtime, 'Nodejs20.19', `${label}.runtime`, errors);
  assertEqual(value.fixed_sms_code_present, false, `${label}.fixed_sms_code_present`, errors);
  assertEqual(
    stableJson(value.runtime_variable_names),
    stableJson(value.api_function?.variable_names),
    `${label}.runtime_variable_names`,
    errors,
  );
  requireExactArray(
    value.deletion_worker_runtime_variable_names,
    [],
    `${label}.deletion_worker_runtime_variable_names`,
    errors,
  );
  assertEqual(
    value.deletion_worker_trigger,
    'account-deletion-every-minute',
    `${label}.deletion_worker_trigger`,
    errors,
  );
  if (!isRecord(value.deletion_worker)) {
    errors.push(`${label}.deletion_worker must be an object.`);
  } else {
    assertExactKeys(
      value.deletion_worker,
      ['function_name', 'handler', 'runtime', 'timeout', 'trigger', 'variable_names'],
      `${label}.deletion_worker`,
      errors,
    );
    assertEqual(
      value.deletion_worker.function_name,
      'softbook-account-deletion-worker',
      `${label}.deletion_worker.function_name`,
      errors,
    );
    assertEqual(
      value.deletion_worker.handler,
      'index.accountDeletionWorkerMain',
      `${label}.deletion_worker.handler`,
      errors,
    );
    assertEqual(value.deletion_worker.runtime, 'Nodejs20.19', `${label}.deletion_worker.runtime`, errors);
    assertEqual(value.deletion_worker.timeout, 60, `${label}.deletion_worker.timeout`, errors);
    requireExactArray(
      value.deletion_worker.variable_names,
      [],
      `${label}.deletion_worker.variable_names`,
      errors,
    );
    if (!isRecord(value.deletion_worker.trigger)) {
      errors.push(`${label}.deletion_worker.trigger must be an object.`);
    } else {
      assertExactKeys(
        value.deletion_worker.trigger,
        ['config', 'name', 'type'],
        `${label}.deletion_worker.trigger`,
        errors,
      );
      assertEqual(
        value.deletion_worker.trigger.config,
        '0 */1 * * * * *',
        `${label}.deletion_worker.trigger.config`,
        errors,
      );
      assertEqual(
        value.deletion_worker.trigger.name,
        'account-deletion-every-minute',
        `${label}.deletion_worker.trigger.name`,
        errors,
      );
      if (!['timer', 'timetrigger'].includes(value.deletion_worker.trigger.type)) {
        errors.push(`${label}.deletion_worker.trigger.type is invalid.`);
      }
    }
  }
}

function validateReceiverVerifyResult(
  report,
  measurements,
  subject,
  expectedRuntimeVariableNames,
  expectedProfile,
  expectedSmsProvider,
  label,
  errors,
) {
  if (!isRecord(report)) return;
  validateReceiverApiFunction(
    report.backend_deployment,
    measurements.backend_deployment_id,
    expectedProfile,
    expectedSmsProvider,
    `${label}.backend_deployment`,
    errors,
  );
  requireExactArray(
    report.backend_deployment?.variable_names,
    expectedRuntimeVariableNames,
    `${label}.backend_deployment.variable_names`,
    errors,
  );
  if (!isRecord(report.api_route)) {
    errors.push(`${label}.api_route must be an object.`);
  } else {
    assertExactKeys(report.api_route, ['ok', 'status'], `${label}.api_route`, errors);
    assertEqual(report.api_route.ok, true, `${label}.api_route.ok`, errors);
    assertEqual(report.api_route.status, 404, `${label}.api_route.status`, errors);
  }
  if (!isRecord(report.active_release)) {
    errors.push(`${label}.active_release must be an object.`);
  } else {
    assertExactKeys(
      report.active_release,
      ['content_version', 'release_id'],
      `${label}.active_release`,
      errors,
    );
    assertEqual(
      report.active_release.release_id,
      subject?.release?.release_id,
      `${label}.active_release.release_id`,
      errors,
    );
    assertEqual(
      report.active_release.content_version,
      subject?.release?.content_version,
      `${label}.active_release.content_version`,
      errors,
    );
  }
  if (!isRecord(report.release)) {
    errors.push(`${label}.release must be an object.`);
  } else {
    assertExactKeys(
      report.release,
      [
        'audio_asset_count',
        'bundle_id',
        'bundle_sha256',
        'card_count',
        'content_version',
        'release_id',
      ],
      `${label}.release`,
      errors,
    );
    assertEqual(report.release.bundle_id, measurements.bundle_id, `${label}.release.bundle_id`, errors);
    assertEqual(
      report.release.bundle_sha256,
      subject?.release?.bundle_sha256,
      `${label}.release.bundle_sha256`,
      errors,
    );
    assertEqual(report.release.card_count, measurements.card_count, `${label}.release.card_count`, errors);
    assertEqual(
      report.release.audio_asset_count,
      measurements.audio_asset_count,
      `${label}.release.audio_asset_count`,
      errors,
    );
    assertEqual(report.release.release_id, subject?.release?.release_id, `${label}.release.release_id`, errors);
    assertEqual(
      report.release.content_version,
      subject?.release?.content_version,
      `${label}.release.content_version`,
      errors,
    );
  }
  if (!isRecord(report.rollback_target)) {
    errors.push(`${label}.rollback_target must prove a retained parent release.`);
  } else {
    assertExactKeys(
      report.rollback_target,
      ['content_version', 'release_id', 'retention_status', 'verified'],
      `${label}.rollback_target`,
      errors,
    );
    assertEqual(
      report.rollback_target.release_id,
      subject?.release?.parent_release_id,
      `${label}.rollback_target.release_id`,
      errors,
    );
    requirePattern(
      report.rollback_target.content_version,
      CONTENT_VERSION_PATTERN,
      `${label}.rollback_target.content_version`,
      errors,
    );
    assertEqual(
      report.rollback_target.retention_status,
      'retained',
      `${label}.rollback_target.retention_status`,
      errors,
    );
    assertEqual(report.rollback_target.verified, true, `${label}.rollback_target.verified`, errors);
  }
  if (!isRecord(report.user_data_import_check)) {
    errors.push(`${label}.user_data_import_check must be an object.`);
  } else {
    assertExactKeys(
      report.user_data_import_check,
      ['counts', 'imported_user_data_detected', 'total'],
      `${label}.user_data_import_check`,
      errors,
    );
    assertEqual(
      report.user_data_import_check.imported_user_data_detected,
      false,
      `${label}.user_data_import_check.imported_user_data_detected`,
      errors,
    );
    assertEqual(report.user_data_import_check.total, 0, `${label}.user_data_import_check.total`, errors);
    if (
      !isRecord(report.user_data_import_check.counts) ||
      Object.keys(report.user_data_import_check.counts).length === 0 ||
      Object.values(report.user_data_import_check.counts).some(count => count !== 0)
    ) {
      errors.push(`${label}.user_data_import_check.counts must contain only zero counts.`);
    }
  }
}

function validateSmsProviderSmokeMeasurements(
  value,
  artifactRoles,
  report,
  artifact,
  label,
  errors,
) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(value, ['report_role'], label, errors);
  requirePattern(value.report_role, ID_PATTERN, `${label}.report_role`, errors);
  if (
    typeof value.report_role === 'string' &&
    !artifactRoles.has(value.report_role)
  ) {
    errors.push(`${label}.report_role must reference a declared raw artifact role.`);
  }
  const reportArtifacts = Array.isArray(artifact.raw_artifacts)
    ? artifact.raw_artifacts.filter(
        candidate => candidate?.role === value.report_role,
      )
    : [];
  if (
    reportArtifacts.length === 1 &&
    !reportArtifacts[0]?.artifact_uri?.startsWith(
      SMS_PROVIDER_SMOKE_RAW_PREFIX,
    )
  ) {
    errors.push(
      `${label}.report_role artifact must be below docs/release/evidence/raw/.`,
    );
  }
  if (!isRecord(report)) {
    errors.push(`${label}.report_role must resolve to a parsed SMS provider smoke report.`);
    return;
  }
  for (const message of validateSmsProviderSmokeReport(report)) {
    errors.push(`${label} raw report: ${message}.`);
  }
  const bindings = [
    ['campaign_id', report.run_id, artifact.campaign_id],
    ['repository commit', report.repository_commit, artifact.subject?.commit_sha],
    [
      'receiver environment',
      report.target_id,
      artifact.subject?.environment?.environment_id,
    ],
    ['send start', report.sent_at, artifact.execution?.started_at],
    [
      'confirmation completion',
      report.confirmed_at,
      artifact.execution?.completed_at,
    ],
    [
      'human verifier',
      report.verifier?.id,
      artifact.verification?.verified_by,
    ],
    [
      'verification timestamp',
      report.confirmed_at,
      artifact.verification?.verified_at,
    ],
  ];
  for (const [binding, actual, expected] of bindings) {
    if (actual !== expected) {
      errors.push(`${label} raw report ${binding} binding does not match.`);
    }
  }
}

function validateReleasePolicyEnvironment(value, errors) {
  const label = 'release operational policy.environment';
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(
    value,
    [
      'allowed_classes',
      'receiver_owned_required',
      'personal_development_environment_forbidden',
      'required_execution_modes',
    ],
    label,
    errors,
  );
  requireExactSet(
    value.allowed_classes,
    ['production_like_staging', 'production'],
    `${label}.allowed_classes`,
    errors,
  );
  assertEqual(
    value.receiver_owned_required,
    true,
    `${label}.receiver_owned_required`,
    errors,
  );
  assertEqual(
    value.personal_development_environment_forbidden,
    true,
    `${label}.personal_development_environment_forbidden`,
    errors,
  );
  if (!isRecord(value.required_execution_modes)) {
    errors.push(`${label}.required_execution_modes must be an object.`);
  } else {
    assertExactKeys(
      value.required_execution_modes,
      RELEASE_OPERATIONAL_EVIDENCE_TYPES,
      `${label}.required_execution_modes`,
      errors,
    );
    for (const evidenceType of RELEASE_OPERATIONAL_EVIDENCE_TYPES) {
      const expected = [
        'backup-restore-drill',
        'rollback-drill',
      ].includes(evidenceType)
        ? 'receiver_external_apply'
        : 'receiver_deployed';
      assertEqual(
        value.required_execution_modes[evidenceType],
        expected,
        `${label}.required_execution_modes.${evidenceType}`,
        errors,
      );
    }
  }
}

function validateReleasePolicyCommonBinding(value, errors) {
  const label = 'release operational policy.common_binding';
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(
    value,
    [
      'repository',
      'require_one_campaign',
      'require_same_commit',
      'require_same_profile',
      'require_same_environment',
      'require_same_bundle',
      'require_same_release',
      'require_parent_release',
      'require_reachable_commit',
      'require_launch_release_candidate_cohort',
      'require_raw_artifact_hashes',
      'require_repository_raw_artifact_verification',
      'require_repository_raw_artifacts_only',
      'require_independent_verification',
      'require_distinct_operator_and_verifier',
      'require_execution_window_binding',
    ],
    label,
    errors,
  );
  assertEqual(
    value.repository,
    'LENKIN233/softbook_cet',
    `${label}.repository`,
    errors,
  );
  for (const field of [
    'require_one_campaign',
    'require_same_commit',
    'require_same_profile',
    'require_same_environment',
    'require_same_bundle',
    'require_same_release',
    'require_parent_release',
    'require_reachable_commit',
    'require_launch_release_candidate_cohort',
    'require_raw_artifact_hashes',
    'require_repository_raw_artifact_verification',
    'require_repository_raw_artifacts_only',
    'require_independent_verification',
    'require_distinct_operator_and_verifier',
    'require_execution_window_binding',
  ]) {
    assertEqual(value[field], true, `${label}.${field}`, errors);
  }
}

function validateExternalCapabilityPolicy(value, errors) {
  const label = 'release operational policy.external_capability';
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(
    value,
    [
      'schema_version',
      'product_owner',
      'protected_approval_environment',
      'target_release_binding_required',
      'repository_report_and_raw_artifacts_must_be_rehashed',
      'capability_evidence_cannot_replace_launch_gate',
      'allowed_observation_modes',
      'common_required_checks',
      'required_checks',
    ],
    label,
    errors,
  );
  assertEqual(
    value.schema_version,
    'external-capability-evidence.v1',
    `${label}.schema_version`,
    errors,
  );
  assertEqual(
    value.product_owner,
    'github:LENKIN233',
    `${label}.product_owner`,
    errors,
  );
  assertEqual(
    value.protected_approval_environment,
    'formal-product-owner-approval',
    `${label}.protected_approval_environment`,
    errors,
  );
  assertEqual(
    value.target_release_binding_required,
    true,
    `${label}.target_release_binding_required`,
    errors,
  );
  assertEqual(
    value.repository_report_and_raw_artifacts_must_be_rehashed,
    true,
    `${label}.repository_report_and_raw_artifacts_must_be_rehashed`,
    errors,
  );
  assertEqual(
    value.capability_evidence_cannot_replace_launch_gate,
    true,
    `${label}.capability_evidence_cannot_replace_launch_gate`,
    errors,
  );
  requireExactSet(
    value.allowed_observation_modes,
    EXTERNAL_CAPABILITY_OBSERVATION_MODES,
    `${label}.allowed_observation_modes`,
    errors,
  );
  requireExactSet(
    value.common_required_checks,
    EXTERNAL_CAPABILITY_COMMON_CHECKS,
    `${label}.common_required_checks`,
    errors,
  );
  if (!isRecord(value.required_checks)) {
    errors.push(`${label}.required_checks must be an object.`);
    return;
  }
  requireExactSet(
    Object.keys(value.required_checks),
    Object.keys(EXTERNAL_CAPABILITY_REQUIRED_CHECKS),
    `${label}.required_checks account ids`,
    errors,
  );
  for (const [accountId, expectedCapabilities] of Object.entries(
    EXTERNAL_CAPABILITY_REQUIRED_CHECKS,
  )) {
    const accountChecks = value.required_checks[accountId];
    const accountLabel = `${label}.required_checks.${accountId}`;
    if (!isRecord(accountChecks)) {
      errors.push(`${accountLabel} must be an object.`);
      continue;
    }
    requireExactSet(
      Object.keys(accountChecks),
      Object.keys(expectedCapabilities),
      `${accountLabel} capability ids`,
      errors,
    );
    for (const [capabilityId, expectedChecks] of Object.entries(
      expectedCapabilities,
    )) {
      requireExactSet(
        accountChecks[capabilityId],
        expectedChecks,
        `${accountLabel}.${capabilityId}`,
        errors,
      );
    }
  }
}

function validateReleasePolicyThresholds(policy, errors) {
  const load = policy.load_test;
  const loadLabel = 'release operational policy.load_test';
  if (!isRecord(load)) {
    errors.push(`${loadLabel} must be an object.`);
  } else {
    assertExactKeys(
      load,
      [
        'required_scenarios',
        'minimum_concurrent_users',
        'minimum_duration_seconds',
        'minimum_request_count',
        'maximum_error_ratio',
        'maximum_p95_latency_ms',
        'maximum_p99_latency_ms',
        'maximum_data_integrity_errors',
        'measurement_duration_within_execution_window_required',
      ],
      loadLabel,
      errors,
    );
    requireExactSet(
      load.required_scenarios,
      RELEASE_POLICY_BASELINE.load_test.required_scenarios,
      `${loadLabel}.required_scenarios`,
      errors,
    );
    for (const field of [
      'minimum_concurrent_users',
      'minimum_duration_seconds',
      'minimum_request_count',
    ]) {
      requireAtLeast(
        load[field],
        RELEASE_POLICY_BASELINE.load_test[field],
        `${loadLabel}.${field}`,
        errors,
      );
    }
    assertEqual(
      load.measurement_duration_within_execution_window_required,
      true,
      `${loadLabel}.measurement_duration_within_execution_window_required`,
      errors,
    );
    for (const field of [
      'maximum_error_ratio',
      'maximum_p95_latency_ms',
      'maximum_p99_latency_ms',
      'maximum_data_integrity_errors',
    ]) {
      requireAtMost(
        load[field],
        RELEASE_POLICY_BASELINE.load_test[field],
        `${loadLabel}.${field}`,
        errors,
      );
    }
  }

  const availability = policy.availability;
  const availabilityLabel = 'release operational policy.availability';
  if (!isRecord(availability)) {
    errors.push(`${availabilityLabel} must be an object.`);
  } else {
    assertExactKeys(
      availability,
      [
        'required_routes',
        'minimum_window_seconds',
        'maximum_probe_interval_seconds',
        'minimum_availability_ratio',
        'maximum_p95_latency_ms',
        'maximum_single_outage_seconds',
        'missing_probe_counts_as_failure',
        'per_route_probe_coverage_required',
      ],
      availabilityLabel,
      errors,
    );
    requireExactSet(
      availability.required_routes,
      RELEASE_POLICY_BASELINE.availability.required_routes,
      `${availabilityLabel}.required_routes`,
      errors,
    );
    requireAtLeast(
      availability.minimum_window_seconds,
      RELEASE_POLICY_BASELINE.availability.minimum_window_seconds,
      `${availabilityLabel}.minimum_window_seconds`,
      errors,
    );
    requireAtLeast(
      availability.minimum_availability_ratio,
      RELEASE_POLICY_BASELINE.availability.minimum_availability_ratio,
      `${availabilityLabel}.minimum_availability_ratio`,
      errors,
    );
    for (const field of [
      'maximum_probe_interval_seconds',
      'maximum_p95_latency_ms',
      'maximum_single_outage_seconds',
    ]) {
      requireAtMost(
        availability[field],
        RELEASE_POLICY_BASELINE.availability[field],
        `${availabilityLabel}.${field}`,
        errors,
      );
    }
    assertEqual(
      availability.missing_probe_counts_as_failure,
      true,
      `${availabilityLabel}.missing_probe_counts_as_failure`,
      errors,
    );
    assertEqual(
      availability.per_route_probe_coverage_required,
      true,
      `${availabilityLabel}.per_route_probe_coverage_required`,
      errors,
    );
  }

  const backup = policy.backup_restore;
  const backupLabel = 'release operational policy.backup_restore';
  if (!isRecord(backup)) {
    errors.push(`${backupLabel} must be an object.`);
  } else {
    assertExactKeys(
      backup,
      [
        'required_datasets',
        'maximum_rpo_seconds',
        'maximum_rto_seconds',
        'isolated_restore_target_required',
        'source_and_restore_counts_must_match',
        'source_and_restore_hashes_must_match',
        'production_must_remain_unchanged',
        'rpo_recomputed_from_snapshot_and_recovery_reference',
        'all_required_source_datasets_must_be_nonempty',
      ],
      backupLabel,
      errors,
    );
    requireExactSet(
      backup.required_datasets,
      RELEASE_POLICY_BASELINE.backup_restore.required_datasets,
      `${backupLabel}.required_datasets`,
      errors,
    );
    requireAtMost(
      backup.maximum_rpo_seconds,
      RELEASE_POLICY_BASELINE.backup_restore.maximum_rpo_seconds,
      `${backupLabel}.maximum_rpo_seconds`,
      errors,
    );
    requireAtMost(
      backup.maximum_rto_seconds,
      RELEASE_POLICY_BASELINE.backup_restore.maximum_rto_seconds,
      `${backupLabel}.maximum_rto_seconds`,
      errors,
    );
    for (const field of [
      'isolated_restore_target_required',
      'source_and_restore_counts_must_match',
      'source_and_restore_hashes_must_match',
      'production_must_remain_unchanged',
      'rpo_recomputed_from_snapshot_and_recovery_reference',
      'all_required_source_datasets_must_be_nonempty',
    ]) {
      assertEqual(backup[field], true, `${backupLabel}.${field}`, errors);
    }
  }

  const penetration = policy.penetration_test;
  const penetrationLabel = 'release operational policy.penetration_test';
  if (!isRecord(penetration)) {
    errors.push(`${penetrationLabel} must be an object.`);
  } else {
    assertExactKeys(
      penetration,
      [
        'required_scope',
        'maximum_open_critical',
        'maximum_open_high',
        'critical_and_high_waivers_forbidden',
        'retest_required_for_resolved_critical_and_high',
      ],
      penetrationLabel,
      errors,
    );
    requireExactSet(
      penetration.required_scope,
      RELEASE_POLICY_BASELINE.penetration_test.required_scope,
      `${penetrationLabel}.required_scope`,
      errors,
    );
    requireAtMost(
      penetration.maximum_open_critical,
      RELEASE_POLICY_BASELINE.penetration_test.maximum_open_critical,
      `${penetrationLabel}.maximum_open_critical`,
      errors,
    );
    requireAtMost(
      penetration.maximum_open_high,
      RELEASE_POLICY_BASELINE.penetration_test.maximum_open_high,
      `${penetrationLabel}.maximum_open_high`,
      errors,
    );
    assertEqual(
      penetration.critical_and_high_waivers_forbidden,
      true,
      `${penetrationLabel}.critical_and_high_waivers_forbidden`,
      errors,
    );
    assertEqual(
      penetration.retest_required_for_resolved_critical_and_high,
      true,
      `${penetrationLabel}.retest_required_for_resolved_critical_and_high`,
      errors,
    );
  }

  const rollback = policy.rollback;
  const rollbackLabel = 'release operational policy.rollback';
  if (!isRecord(rollback)) {
    errors.push(`${rollbackLabel} must be an object.`);
  } else {
    assertExactKeys(
      rollback,
      [
        'required_sequence',
        'maximum_rto_seconds',
        'active_pointer_must_match_target',
        'api_and_content_must_match_target',
        'learning_data_count_and_hash_must_match',
        'maximum_delete_operations',
        'nonempty_learning_dataset_required',
        'retained_and_verified_target_required',
      ],
      rollbackLabel,
      errors,
    );
    requireExactArray(
      rollback.required_sequence,
      RELEASE_POLICY_BASELINE.rollback.required_sequence,
      `${rollbackLabel}.required_sequence`,
      errors,
    );
    requireAtMost(
      rollback.maximum_rto_seconds,
      RELEASE_POLICY_BASELINE.rollback.maximum_rto_seconds,
      `${rollbackLabel}.maximum_rto_seconds`,
      errors,
    );
    assertEqual(
      rollback.maximum_delete_operations,
      RELEASE_POLICY_BASELINE.rollback.maximum_delete_operations,
      `${rollbackLabel}.maximum_delete_operations`,
      errors,
    );
    for (const field of [
      'active_pointer_must_match_target',
      'api_and_content_must_match_target',
      'learning_data_count_and_hash_must_match',
      'nonempty_learning_dataset_required',
      'retained_and_verified_target_required',
    ]) {
      assertEqual(rollback[field], true, `${rollbackLabel}.${field}`, errors);
    }
  }
}

function validateSimulationBoundary(value, errors) {
  const label = 'release operational policy.simulation_boundary';
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(
    value,
    [
      'schema_version',
      'execution_mode',
      'simulation',
      'gate_eligible',
      'may_satisfy_formal_gate',
    ],
    label,
    errors,
  );
  assertEqual(
    value.schema_version,
    'release-blank-environment-simulation.v1',
    `${label}.schema_version`,
    errors,
  );
  assertEqual(
    value.execution_mode,
    'repository_in_memory',
    `${label}.execution_mode`,
    errors,
  );
  assertEqual(value.simulation, true, `${label}.simulation`, errors);
  assertEqual(value.gate_eligible, false, `${label}.gate_eligible`, errors);
  assertEqual(
    value.may_satisfy_formal_gate,
    false,
    `${label}.may_satisfy_formal_gate`,
    errors,
  );
}

export function validateGateEvidenceCoherence(
  reports,
  {gateId, requiredEvidenceTypes = []} = {},
) {
  const errors = [];
  const validReports = reports.filter(report => isRecord(report));
  if (validReports.length <= 1) {
    return {errors, ok: true};
  }
  const first = validReports[0];
  const bindings = [
    ['campaign_id', report => report.campaign_id],
    ['commit_sha', report => report.subject?.commit_sha],
    ['policy_id', report => report.subject?.policy_id],
    ['policy_sha256', report => report.subject?.policy_sha256],
    ['profile_id', report => report.subject?.environment?.profile_id],
    ['profile_sha256', report => report.subject?.environment?.profile_sha256],
    ['environment_id', report => report.subject?.environment?.environment_id],
    ['environment class', report => report.subject?.environment?.class],
    ['release_id', report => report.subject?.release?.release_id],
    ['parent_release_id', report => report.subject?.release?.parent_release_id],
    ['content_version', report => report.subject?.release?.content_version],
    ['bundle_sha256', report => report.subject?.release?.bundle_sha256],
    [
      'backend_deployment_id',
      report => report.subject?.release?.backend_deployment_id,
    ],
    ['client_builds', report => stableJson(report.subject?.client_builds)],
  ];
  for (const [name, getter] of bindings) {
    const expected = getter(first);
    for (const report of validReports.slice(1)) {
      if (getter(report) !== expected) {
        errors.push(
          `gate ${String(gateId)} evidence reports must share ${name}.`,
        );
        break;
      }
    }
  }
  if (gateId === 'release-slo-and-recovery-drill') {
    const expected = new Set(requiredEvidenceTypes);
    const actual = new Set(
      validReports.map(report => report.subject?.evidence_type),
    );
    if (
      expected.size !== actual.size ||
      [...expected].some(type => !actual.has(type))
    ) {
      errors.push(
        'release operational evidence campaign must contain all five report types.',
      );
    }
  }
  return {errors, ok: errors.length === 0};
}

function validateSubject(
  subject,
  {
    evidenceType,
    expectedPolicy,
    expectedSubject,
    gateId,
    outerEvidence,
    targetRelease,
  },
  label,
  errors,
) {
  if (!isRecord(subject)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(
    subject,
    [
      'repository',
      'commit_sha',
      'target_release',
      'gate_id',
      'evidence_type',
      'policy_id',
      'policy_sha256',
      'environment',
      'release',
      'client_builds',
    ],
    label,
    errors,
  );
  assertEqual(
    subject.repository,
    'LENKIN233/softbook_cet',
    `${label}.repository`,
    errors,
  );
  requirePattern(subject.commit_sha, COMMIT_PATTERN, `${label}.commit_sha`, errors);
  if (outerEvidence) {
    assertEqual(
      subject.commit_sha,
      outerEvidence.subject_commit_sha,
      `${label}.commit_sha outer binding`,
      errors,
    );
  }
  assertEqual(
    subject.target_release,
    targetRelease,
    `${label}.target_release`,
    errors,
  );
  assertEqual(subject.gate_id, gateId, `${label}.gate_id`, errors);
  assertEqual(
    subject.evidence_type,
    evidenceType,
    `${label}.evidence_type`,
    errors,
  );
  requirePattern(subject.policy_id, ID_PATTERN, `${label}.policy_id`, errors);
  requireSha256(subject.policy_sha256, `${label}.policy_sha256`, errors);
  if (expectedPolicy) {
    assertEqual(
      subject.policy_id,
      expectedPolicy.id,
      `${label}.policy_id`,
      errors,
    );
    if (expectedPolicy.sha256) {
      assertEqual(
        subject.policy_sha256,
        expectedPolicy.sha256,
        `${label}.policy_sha256`,
        errors,
      );
    }
  }
  validateEnvironment(subject.environment, `${label}.environment`, errors);
  validateReleaseBinding(subject.release, `${label}.release`, errors);
  validateClientBuilds(subject.client_builds, `${label}.client_builds`, errors);
  if (expectedSubject) {
    const actualCohort = {
      repository: subject.repository,
      commit_sha: subject.commit_sha,
      target_release: subject.target_release,
      environment: subject.environment,
      release: subject.release,
      client_builds: subject.client_builds,
    };
    const expectedCohort = {
      repository: expectedSubject.repository,
      commit_sha: expectedSubject.commit_sha,
      target_release: expectedSubject.target_release,
      environment: expectedSubject.environment,
      release: expectedSubject.release,
      client_builds: expectedSubject.client_builds,
    };
    if (stableJson(actualCohort) !== stableJson(expectedCohort)) {
      errors.push(
        `${label} must match the launch-level release_candidate cohort.`,
      );
    }
  }
}

function validateEnvironment(value, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(
    value,
    [
      'profile_id',
      'profile_sha256',
      'environment_id',
      'class',
      'receiver_owned',
    ],
    label,
    errors,
  );
  requirePattern(value.profile_id, ID_PATTERN, `${label}.profile_id`, errors);
  requireSha256(value.profile_sha256, `${label}.profile_sha256`, errors);
  requirePattern(
    value.environment_id,
    ID_PATTERN,
    `${label}.environment_id`,
    errors,
  );
  if (
    typeof value.environment_id === 'string' &&
    FORBIDDEN_ENVIRONMENT_PATTERN.test(value.environment_id)
  ) {
    errors.push(`${label}.environment_id must not name a local or development target.`);
  }
  if (!['production_like_staging', 'production'].includes(value.class)) {
    errors.push(
      `${label}.class must be production_like_staging or production.`,
    );
  }
  if (value.receiver_owned !== true) {
    errors.push(`${label}.receiver_owned must be true.`);
  }
}

function validateReleaseBinding(value, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(
    value,
    [
      'release_id',
      'parent_release_id',
      'content_version',
      'bundle_sha256',
      'backend_deployment_id',
    ],
    label,
    errors,
  );
  requirePattern(value.release_id, ID_PATTERN, `${label}.release_id`, errors);
  if (value.parent_release_id !== null) {
    requirePattern(
      value.parent_release_id,
      ID_PATTERN,
      `${label}.parent_release_id`,
      errors,
    );
  }
  if (value.release_id === value.parent_release_id) {
    errors.push(`${label}.parent_release_id must differ from release_id.`);
  }
  requirePattern(
    value.content_version,
    CONTENT_VERSION_PATTERN,
    `${label}.content_version`,
    errors,
  );
  requireSha256(value.bundle_sha256, `${label}.bundle_sha256`, errors);
  requirePattern(
    value.backend_deployment_id,
    ID_PATTERN,
    `${label}.backend_deployment_id`,
    errors,
  );
}

function validateClientBuilds(value, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(value, ['ios', 'android', 'pc_web'], label, errors);
  for (const platform of ['ios', 'android', 'pc_web']) {
    requirePattern(value[platform], ID_PATTERN, `${label}.${platform}`, errors);
  }
}

function validateExecution(
  value,
  executionMode,
  evidenceType,
  policy,
  now,
  label,
  errors,
) {
  let startedAt = null;
  let completedAt = null;
  let operator = null;
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return {completedAt, operator, startedAt};
  }
  assertExactKeys(
    value,
    ['started_at', 'completed_at', 'operator', 'tool'],
    label,
    errors,
  );
  if (RELEASE_OPERATIONAL_EVIDENCE_SET.has(evidenceType)) {
    const expectedMode =
      policy?.environment?.required_execution_modes?.[evidenceType];
    if (!expectedMode) {
      errors.push(`${label} is missing a trusted execution-mode policy.`);
    } else {
      assertEqual(executionMode, expectedMode, `${label} mode`, errors);
    }
  } else if (LEARNING_RUNTIME_EVIDENCE_SET.has(evidenceType)) {
    assertEqual(
      executionMode,
      LEARNING_EXECUTION_MODES[evidenceType],
      `${label} mode`,
      errors,
    );
  } else if (!GENERIC_EXECUTION_MODES.has(executionMode)) {
    errors.push(`${label} mode is not eligible for a formal launch gate.`);
  }
  startedAt = parseTimestamp(value.started_at, `${label}.started_at`, now, errors);
  completedAt = parseTimestamp(
    value.completed_at,
    `${label}.completed_at`,
    now,
    errors,
  );
  if (startedAt && completedAt && completedAt < startedAt) {
    errors.push(`${label}.completed_at must not predate started_at.`);
  }
  if (!VERIFIER_PATTERN.test(value.operator ?? '')) {
    errors.push(`${label}.operator must identify a github, team, or external operator.`);
  } else {
    operator = value.operator;
  }
  if (!isRecord(value.tool)) {
    errors.push(`${label}.tool must be an object.`);
  } else {
    assertExactKeys(
      value.tool,
      ['name', 'version', 'config_sha256'],
      `${label}.tool`,
      errors,
    );
    requirePattern(value.tool.name, ID_PATTERN, `${label}.tool.name`, errors);
    requirePattern(value.tool.version, ID_PATTERN, `${label}.tool.version`, errors);
    requireSha256(
      value.tool.config_sha256,
      `${label}.tool.config_sha256`,
      errors,
    );
  }
  return {completedAt, operator, startedAt};
}

function validateRawArtifacts(value, label, errors) {
  const roles = new Set();
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${label} must be a non-empty array.`);
    return roles;
  }
  const hashes = new Set();
  for (const [index, artifact] of value.entries()) {
    const itemLabel = `${label}[${index}]`;
    if (!isRecord(artifact)) {
      errors.push(`${itemLabel} must be an object.`);
      continue;
    }
    assertExactKeys(
      artifact,
      ['role', 'artifact_uri', 'sha256', 'size_bytes'],
      itemLabel,
      errors,
    );
    requirePattern(artifact.role, ID_PATTERN, `${itemLabel}.role`, errors);
    if (roles.has(artifact.role)) {
      errors.push(`${label} contains duplicate role ${String(artifact.role)}.`);
    }
    roles.add(artifact.role);
    validateRawArtifactUri(
      artifact.artifact_uri,
      `${itemLabel}.artifact_uri`,
      errors,
    );
    requireSha256(artifact.sha256, `${itemLabel}.sha256`, errors);
    if (hashes.has(artifact.sha256)) {
      errors.push(`${label} reuses raw artifact SHA-256 ${artifact.sha256}.`);
    }
    hashes.add(artifact.sha256);
    requirePositiveInteger(
      artifact.size_bytes,
      `${itemLabel}.size_bytes`,
      errors,
    );
  }
  return roles;
}

function validateRawArtifactUri(value, label, errors) {
  if (typeof value !== 'string' || !value.startsWith('repo://')) {
    errors.push(
      `${label} must use repo://; remote evidence requires a verified repository manifest.`,
    );
    return;
  }
  const relativePath = value.slice('repo://'.length);
  const segments = relativePath.split('/');
  if (
    relativePath.length === 0 ||
    relativePath.includes('\\') ||
    relativePath.startsWith('/') ||
    segments.includes('..') ||
    !RAW_REPOSITORY_EVIDENCE_PREFIXES.some(prefix =>
      relativePath.startsWith(prefix),
    )
  ) {
    errors.push(`${label} is not an allowed repository evidence path.`);
  }
}

function validateChecks(value, evidenceType, artifactRoles, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array.`);
    return;
  }
  const required = REQUIRED_EVIDENCE_CHECKS[evidenceType];
  if (!required) {
    errors.push(`${label} has no registered semantic check contract.`);
    return;
  }
  const byId = new Map();
  for (const [index, check] of value.entries()) {
    const itemLabel = `${label}[${index}]`;
    if (!isRecord(check)) {
      errors.push(`${itemLabel} must be an object.`);
      continue;
    }
    assertExactKeys(check, ['id', 'status', 'artifact_roles'], itemLabel, errors);
    if (!required.includes(check.id)) {
      errors.push(`${itemLabel}.id is not required for ${evidenceType}.`);
    } else if (byId.has(check.id)) {
      errors.push(`${label} contains duplicate check ${check.id}.`);
    }
    byId.set(check.id, check);
    assertEqual(check.status, 'passed', `${itemLabel}.status`, errors);
    if (!Array.isArray(check.artifact_roles) || check.artifact_roles.length === 0) {
      errors.push(`${itemLabel}.artifact_roles must be a non-empty array.`);
    } else {
      const seen = new Set();
      for (const role of check.artifact_roles) {
        if (!artifactRoles.has(role)) {
          errors.push(`${itemLabel} references unknown raw artifact role ${String(role)}.`);
        }
        if (seen.has(role)) {
          errors.push(`${itemLabel} repeats raw artifact role ${String(role)}.`);
        }
        seen.add(role);
      }
    }
  }
  if (
    byId.size !== required.length ||
    required.some(checkId => !byId.has(checkId))
  ) {
    errors.push(`${label} must contain exactly: ${required.join(', ')}.`);
  }
}

function validateVerification(
  value,
  outerEvidence,
  completedAt,
  operator,
  evidenceValidityDays,
  now,
  label,
  errors,
) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(
    value,
    ['verified_at', 'verified_by', 'independent', 'attestation'],
    label,
    errors,
  );
  const verifiedAt = parseTimestamp(
    value.verified_at,
    `${label}.verified_at`,
    now,
    errors,
  );
  if (completedAt && verifiedAt && verifiedAt < completedAt) {
    errors.push(`${label}.verified_at must not predate completed_at.`);
  }
  if (
    verifiedAt &&
    now instanceof Date &&
    Number.isFinite(evidenceValidityDays) &&
    verifiedAt <
      new Date(
        now.getTime() -
          evidenceValidityDays * 24 * 60 * 60 * 1000,
      )
  ) {
    errors.push(
      `${label}.verified_at exceeds the ${String(
        evidenceValidityDays,
      )}-day evidence validity policy.`,
    );
  }
  if (!VERIFIER_PATTERN.test(value.verified_by ?? '')) {
    errors.push(`${label}.verified_by must identify a github, team, or external verifier.`);
  }
  if (value.independent !== true) {
    errors.push(`${label}.independent must be true.`);
  }
  if (
    typeof operator === 'string' &&
    typeof value.verified_by === 'string' &&
    value.verified_by === operator
  ) {
    errors.push(`${label}.verified_by must differ from the execution operator.`);
  }
  if (outerEvidence) {
    assertEqual(
      value.verified_at,
      outerEvidence.verified_at,
      `${label}.verified_at outer binding`,
      errors,
    );
    assertEqual(
      value.verified_by,
      outerEvidence.verified_by,
      `${label}.verified_by outer binding`,
      errors,
    );
  }
  if (!isRecord(value.attestation)) {
    errors.push(`${label}.attestation must be an object.`);
  } else {
    assertExactKeys(
      value.attestation,
      ['provider', 'id', 'sha256'],
      `${label}.attestation`,
      errors,
    );
    if (
      ![
        'github_actions_oidc',
        'protected_environment',
        'external_signature',
        'regulatory_record',
      ].includes(value.attestation.provider)
    ) {
      errors.push(`${label}.attestation.provider is not trusted by the contract.`);
    }
    requirePattern(
      value.attestation.id,
      ID_PATTERN,
      `${label}.attestation.id`,
      errors,
    );
    requireSha256(
      value.attestation.sha256,
      `${label}.attestation.sha256`,
      errors,
    );
  }
}

function validateGenericMeasurements(value, evidenceType, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(value, ['scope', 'summary'], label, errors);
  requireNonEmptyString(value.scope, `${label}.scope`, errors);
  requireNonEmptyString(value.summary, `${label}.summary`, errors);
  errors.push(
    `${label} has no type-specific semantic contract for ${String(
      evidenceType,
    )}; this gate evidence remains ineligible.`,
  );
}

function validateLearningMeasurements(
  value,
  evidenceType,
  subject,
  expectedPolicy,
  executionTimes,
  label,
  errors,
) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (evidenceType === 'cross-device-bootstrap-test') {
    assertExactKeys(
      value,
      [
        'account_subject_sha256',
        'client_a',
        'client_b',
        'event_payload_sha256',
        'accepted_server_sequence',
        'observed_server_sequence',
        'assertions',
      ],
      label,
      errors,
    );
    requireSha256(value.account_subject_sha256, `${label}.account_subject_sha256`, errors);
    validateLearningClient(value.client_a, subject, `${label}.client_a`, errors);
    validateLearningClient(value.client_b, subject, `${label}.client_b`, errors);
    if (
      value.client_a?.installation_sha256 &&
      value.client_a.installation_sha256 === value.client_b?.installation_sha256
    ) {
      errors.push(`${label} clients must have distinct installation hashes.`);
    }
    requireSha256(value.event_payload_sha256, `${label}.event_payload_sha256`, errors);
    requirePositiveInteger(
      value.accepted_server_sequence,
      `${label}.accepted_server_sequence`,
      errors,
    );
    requirePositiveInteger(
      value.observed_server_sequence,
      `${label}.observed_server_sequence`,
      errors,
    );
    assertEqual(
      value.observed_server_sequence,
      value.accepted_server_sequence,
      `${label}.observed_server_sequence`,
      errors,
    );
  } else if (evidenceType === 'offline-replay-test') {
    assertExactKeys(
      value,
      [
        'event_id_sha256',
        'event_payload_sha256',
        'retry_payload_sha256',
        'device_cursor_sha256',
        'accepted_server_sequence',
        'duplicate_server_sequence',
        'assertions',
      ],
      label,
      errors,
    );
    for (const field of [
      'event_id_sha256',
      'event_payload_sha256',
      'retry_payload_sha256',
      'device_cursor_sha256',
    ]) {
      requireSha256(value[field], `${label}.${field}`, errors);
    }
    assertEqual(
      value.retry_payload_sha256,
      value.event_payload_sha256,
      `${label}.retry_payload_sha256`,
      errors,
    );
    requirePositiveInteger(
      value.accepted_server_sequence,
      `${label}.accepted_server_sequence`,
      errors,
    );
    requirePositiveInteger(
      value.duplicate_server_sequence,
      `${label}.duplicate_server_sequence`,
      errors,
    );
    assertEqual(
      value.duplicate_server_sequence,
      value.accepted_server_sequence,
      `${label}.duplicate_server_sequence`,
      errors,
    );
  } else if (evidenceType === 'canonical-state-test') {
    assertExactKeys(
      value,
      [
        'bootstrap_schema_version',
        'account_subject_sha256',
        'content_version',
        'canonical_state_sha256',
        'observed_server_sequence',
        'assertions',
      ],
      label,
      errors,
    );
    assertEqual(
      value.bootstrap_schema_version,
      'bootstrap.v2',
      `${label}.bootstrap_schema_version`,
      errors,
    );
    requireSha256(value.account_subject_sha256, `${label}.account_subject_sha256`, errors);
    requirePattern(
      value.content_version,
      CONTENT_VERSION_PATTERN,
      `${label}.content_version`,
      errors,
    );
    assertEqual(
      value.content_version,
      subject?.release?.content_version,
      `${label}.content_version release binding`,
      errors,
    );
    requireSha256(value.canonical_state_sha256, `${label}.canonical_state_sha256`, errors);
    requirePositiveInteger(
      value.observed_server_sequence,
      `${label}.observed_server_sequence`,
      errors,
    );
  } else if (evidenceType === 'fsrs-version-lock') {
    assertExactKeys(
      value,
      [
        'algorithm_id',
        'library',
        'library_version',
        'policy_version',
        'fuzz_enabled',
        'lockfile_sha256',
        'assertions',
      ],
      label,
      errors,
    );
    assertEqual(value.algorithm_id, 'FSRS-6', `${label}.algorithm_id`, errors);
    assertEqual(value.library, 'ts-fsrs', `${label}.library`, errors);
    assertEqual(value.library_version, '5.4.1', `${label}.library_version`, errors);
    assertEqual(
      value.policy_version,
      'softbook-fsrs.v1',
      `${label}.policy_version`,
      errors,
    );
    assertEqual(value.fuzz_enabled, false, `${label}.fuzz_enabled`, errors);
    requireSha256(value.lockfile_sha256, `${label}.lockfile_sha256`, errors);
    if (expectedPolicy?.lockfile_sha256) {
      assertEqual(
        value.lockfile_sha256,
        expectedPolicy.lockfile_sha256,
        `${label}.lockfile_sha256 repository binding`,
        errors,
      );
    } else {
      errors.push(`${label}.lockfile_sha256 is missing a trusted repository binding.`);
    }
  } else if (evidenceType === 'scheduler-contract-test') {
    assertExactKeys(
      value,
      [
        'selection_id_sha256',
        'selected_card_id',
        'phase',
        'membership_stage',
        'access_mode',
        'assertions',
      ],
      label,
      errors,
    );
    requireSha256(value.selection_id_sha256, `${label}.selection_id_sha256`, errors);
    requirePattern(value.selected_card_id, ID_PATTERN, `${label}.selected_card_id`, errors);
    requireOneOf(value.phase, ['learning', 'review'], `${label}.phase`, errors);
    requireOneOf(
      value.membership_stage,
      ['trial', 'free', 'premium'],
      `${label}.membership_stage`,
      errors,
    );
    requireOneOf(
      value.access_mode,
      ['full', 'free_subset'],
      `${label}.access_mode`,
      errors,
    );
    if (['trial', 'free', 'premium'].includes(value.membership_stage)) {
      assertEqual(
        value.access_mode,
        value.membership_stage === 'free' ? 'free_subset' : 'full',
        `${label}.access_mode membership binding`,
        errors,
      );
    }
  } else if (evidenceType === 'clock-boundary-test') {
    assertExactKeys(
      value,
      [
        'server_acceptance_at',
        'earliest_client_time_at',
        'latest_client_time_at',
        'maximum_future_skew_seconds',
        'maximum_past_age_days',
        'assertions',
      ],
      label,
      errors,
    );
    const serverAcceptance = parseTimestamp(
      value.server_acceptance_at,
      `${label}.server_acceptance_at`,
      null,
      errors,
    );
    const earliestClientTime = parseTimestamp(
      value.earliest_client_time_at,
      `${label}.earliest_client_time_at`,
      null,
      errors,
    );
    const latestClientTime = parseTimestamp(
      value.latest_client_time_at,
      `${label}.latest_client_time_at`,
      null,
      errors,
    );
    assertEqual(
      value.maximum_future_skew_seconds,
      300,
      `${label}.maximum_future_skew_seconds`,
      errors,
    );
    assertEqual(
      value.maximum_past_age_days,
      90,
      `${label}.maximum_past_age_days`,
      errors,
    );
    if (
      serverAcceptance &&
      earliestClientTime &&
      earliestClientTime.getTime() >=
        serverAcceptance.getTime() -
          value.maximum_past_age_days * 24 * 60 * 60 * 1000
    ) {
      errors.push(
        `${label}.earliest_client_time_at must exercise a rejected time older than the retention boundary.`,
      );
    }
    requireTimestampWithinExecution(
      serverAcceptance,
      executionTimes,
      `${label}.server_acceptance_at`,
      errors,
    );
    if (
      serverAcceptance &&
      latestClientTime &&
      latestClientTime.getTime() <=
        serverAcceptance.getTime() +
          value.maximum_future_skew_seconds * 1000
    ) {
      errors.push(
        `${label}.latest_client_time_at must exercise a rejected time beyond the future-skew boundary.`,
      );
    }
  }
  validateTrueAssertions(
    value.assertions,
    LEARNING_ASSERTIONS[evidenceType],
    `${label}.assertions`,
    errors,
  );
}

function validateLearningClient(value, subject, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(value, ['platform', 'build_id', 'installation_sha256'], label, errors);
  requireOneOf(value.platform, ['ios', 'android', 'pc_web'], `${label}.platform`, errors);
  requirePattern(value.build_id, ID_PATTERN, `${label}.build_id`, errors);
  if (value.platform && subject?.client_builds) {
    assertEqual(
      value.build_id,
      subject.client_builds[value.platform],
      `${label}.build_id release binding`,
      errors,
    );
  }
  requireSha256(value.installation_sha256, `${label}.installation_sha256`, errors);
}

function validateReleaseMeasurements(
  value,
  evidenceType,
  subject,
  policy,
  executionTimes,
  label,
  errors,
) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (!isRecord(policy)) {
    errors.push(`${label} requires release-operational-policy.v1.`);
    return;
  }
  if (evidenceType === 'load-test-report') {
    validateLoadMeasurements(
      value,
      policy.load_test,
      executionTimes,
      label,
      errors,
    );
  } else if (evidenceType === 'availability-observation') {
    validateAvailabilityMeasurements(
      value,
      policy.availability,
      executionTimes,
      label,
      errors,
    );
  } else if (evidenceType === 'backup-restore-drill') {
    validateBackupRestoreMeasurements(
      value,
      subject,
      policy.backup_restore,
      executionTimes,
      label,
      errors,
    );
  } else if (evidenceType === 'penetration-test-report') {
    validatePenetrationMeasurements(value, policy.penetration_test, label, errors);
  } else if (evidenceType === 'rollback-drill') {
    validateRollbackMeasurements(
      value,
      subject,
      policy.rollback,
      executionTimes,
      label,
      errors,
    );
  }
}

function validateLoadMeasurements(value, policy, executionTimes, label, errors) {
  assertExactKeys(
    value,
    [
      'scenarios',
      'duration_seconds',
      'concurrent_users',
      'request_count',
      'success_count',
      'error_count',
      'error_ratio',
      'p95_latency_ms',
      'p99_latency_ms',
      'data_integrity_errors',
    ],
    label,
    errors,
  );
  requireExactSet(value.scenarios, policy?.required_scenarios, `${label}.scenarios`, errors);
  for (const field of [
    'duration_seconds',
    'concurrent_users',
    'request_count',
    'success_count',
    'error_count',
    'p95_latency_ms',
    'p99_latency_ms',
  ]) {
    requireNonNegativeInteger(value[field], `${label}.${field}`, errors);
  }
  requireNonNegativeInteger(
    value.data_integrity_errors,
    `${label}.data_integrity_errors`,
    errors,
  );
  if (value.success_count + value.error_count !== value.request_count) {
    errors.push(`${label} success_count + error_count must equal request_count.`);
  }
  if (
    Number.isSafeInteger(value.p95_latency_ms) &&
    Number.isSafeInteger(value.p99_latency_ms) &&
    value.p99_latency_ms < value.p95_latency_ms
  ) {
    errors.push(`${label}.p99_latency_ms must not be lower than p95_latency_ms.`);
  }
  requireRatio(value.error_ratio, `${label}.error_ratio`, errors);
  if (
    Number.isInteger(value.request_count) &&
    value.request_count > 0 &&
    !nearlyEqual(value.error_ratio, value.error_count / value.request_count)
  ) {
    errors.push(`${label}.error_ratio must equal error_count / request_count.`);
  }
  requireAtLeast(value.duration_seconds, policy?.minimum_duration_seconds, `${label}.duration_seconds`, errors);
  requireAtLeast(value.concurrent_users, policy?.minimum_concurrent_users, `${label}.concurrent_users`, errors);
  requireAtLeast(value.request_count, policy?.minimum_request_count, `${label}.request_count`, errors);
  requireAtMost(value.error_ratio, policy?.maximum_error_ratio, `${label}.error_ratio`, errors);
  requireAtMost(value.p95_latency_ms, policy?.maximum_p95_latency_ms, `${label}.p95_latency_ms`, errors);
  requireAtMost(value.p99_latency_ms, policy?.maximum_p99_latency_ms, `${label}.p99_latency_ms`, errors);
  requireAtMost(
    value.data_integrity_errors,
    policy?.maximum_data_integrity_errors,
    `${label}.data_integrity_errors`,
    errors,
  );
  if (executionTimes?.startedAt && executionTimes?.completedAt) {
    const executionSeconds =
      (executionTimes.completedAt - executionTimes.startedAt) / 1000;
    if (
      Number.isSafeInteger(value.duration_seconds) &&
      executionSeconds < value.duration_seconds
    ) {
      errors.push(
        `${label}.duration_seconds must fit within the recorded execution window.`,
      );
    }
  }
}

function validateAvailabilityMeasurements(
  value,
  policy,
  executionTimes,
  label,
  errors,
) {
  assertExactKeys(
    value,
    [
      'routes',
      'window_started_at',
      'window_completed_at',
      'probe_interval_seconds',
      'route_probes',
      'expected_probe_count',
      'success_probe_count',
      'failed_probe_count',
      'missing_probe_count',
      'availability_ratio',
      'p95_latency_ms',
      'maximum_single_outage_seconds',
    ],
    label,
    errors,
  );
  requireExactSet(value.routes, policy?.required_routes, `${label}.routes`, errors);
  const started = parseTimestamp(value.window_started_at, `${label}.window_started_at`, null, errors);
  const completed = parseTimestamp(
    value.window_completed_at,
    `${label}.window_completed_at`,
    null,
    errors,
  );
  for (const field of [
    'success_probe_count',
    'failed_probe_count',
    'missing_probe_count',
    'p95_latency_ms',
    'maximum_single_outage_seconds',
  ]) {
    requireNonNegativeInteger(value[field], `${label}.${field}`, errors);
  }
  requirePositiveInteger(
    value.probe_interval_seconds,
    `${label}.probe_interval_seconds`,
    errors,
  );
  requirePositiveInteger(
    value.expected_probe_count,
    `${label}.expected_probe_count`,
    errors,
  );
  const windowSeconds =
    started && completed ? (completed - started) / 1000 : null;
  const routeSummary = validateAvailabilityRouteProbes(
    value.route_probes,
    policy,
    windowSeconds,
    value.probe_interval_seconds,
    `${label}.route_probes`,
    errors,
  );
  if (routeSummary) {
    for (const field of [
      'expected_probe_count',
      'success_probe_count',
      'failed_probe_count',
      'missing_probe_count',
    ]) {
      assertEqual(
        value[field],
        routeSummary[field],
        `${label}.${field} route aggregate`,
        errors,
      );
    }
    assertEqual(
      value.p95_latency_ms,
      routeSummary.maximum_p95_latency_ms,
      `${label}.p95_latency_ms route maximum`,
      errors,
    );
    assertEqual(
      value.maximum_single_outage_seconds,
      routeSummary.maximum_single_outage_seconds,
      `${label}.maximum_single_outage_seconds route maximum`,
      errors,
    );
  }
  if (
    value.success_probe_count +
      value.failed_probe_count +
      value.missing_probe_count !==
    value.expected_probe_count
  ) {
    errors.push(
      `${label} success + failed + missing probes must equal expected probes.`,
    );
  }
  requireRatio(value.availability_ratio, `${label}.availability_ratio`, errors);
  if (
    Number.isInteger(value.expected_probe_count) &&
    value.expected_probe_count > 0 &&
    !nearlyEqual(
      value.availability_ratio,
      value.success_probe_count / value.expected_probe_count,
    )
  ) {
    errors.push(
      `${label}.availability_ratio must equal successful / expected probes.`,
    );
  }
  if (windowSeconds !== null) {
    requireAtLeast(
      windowSeconds,
      policy?.minimum_window_seconds,
      `${label} observation window`,
      errors,
    );
    if (
      Number.isInteger(value.probe_interval_seconds) &&
      value.probe_interval_seconds > 0 &&
      value.expected_probe_count <
        Math.floor(windowSeconds / value.probe_interval_seconds) *
          (Array.isArray(value.routes) ? value.routes.length : 0)
    ) {
      errors.push(
        `${label}.expected_probe_count is too small for every required route over the window.`,
      );
    }
  }
  requireTimestampWithinExecution(
    started,
    executionTimes,
    `${label}.window_started_at`,
    errors,
  );
  requireTimestampWithinExecution(
    completed,
    executionTimes,
    `${label}.window_completed_at`,
    errors,
  );
  requireAtMost(
    value.probe_interval_seconds,
    policy?.maximum_probe_interval_seconds,
    `${label}.probe_interval_seconds`,
    errors,
  );
  requireAtLeast(
    value.availability_ratio,
    policy?.minimum_availability_ratio,
    `${label}.availability_ratio`,
    errors,
  );
  requireAtMost(
    value.p95_latency_ms,
    policy?.maximum_p95_latency_ms,
    `${label}.p95_latency_ms`,
    errors,
  );
  requireAtMost(
    value.maximum_single_outage_seconds,
    policy?.maximum_single_outage_seconds,
    `${label}.maximum_single_outage_seconds`,
    errors,
  );
}

function validateAvailabilityRouteProbes(
  value,
  policy,
  windowSeconds,
  probeIntervalSeconds,
  label,
  errors,
) {
  if (!isRecord(value) || !Array.isArray(policy?.required_routes)) {
    errors.push(`${label} must be an object bound to required routes.`);
    return null;
  }
  assertExactKeys(value, policy.required_routes, label, errors);
  const summary = {
    expected_probe_count: 0,
    success_probe_count: 0,
    failed_probe_count: 0,
    missing_probe_count: 0,
    maximum_p95_latency_ms: 0,
    maximum_single_outage_seconds: 0,
  };
  for (const route of policy.required_routes) {
    const routeProbe = value[route];
    const routeLabel = `${label}.${route}`;
    if (!isRecord(routeProbe)) {
      errors.push(`${routeLabel} must be an object.`);
      continue;
    }
    assertExactKeys(
      routeProbe,
      [
        'expected_probe_count',
        'success_probe_count',
        'failed_probe_count',
        'missing_probe_count',
        'availability_ratio',
        'p95_latency_ms',
        'maximum_single_outage_seconds',
      ],
      routeLabel,
      errors,
    );
    requirePositiveInteger(
      routeProbe.expected_probe_count,
      `${routeLabel}.expected_probe_count`,
      errors,
    );
    for (const field of [
      'success_probe_count',
      'failed_probe_count',
      'missing_probe_count',
      'p95_latency_ms',
      'maximum_single_outage_seconds',
    ]) {
      requireNonNegativeInteger(
        routeProbe[field],
        `${routeLabel}.${field}`,
        errors,
      );
    }
    if (
      routeProbe.success_probe_count +
        routeProbe.failed_probe_count +
        routeProbe.missing_probe_count !==
      routeProbe.expected_probe_count
    ) {
      errors.push(
        `${routeLabel} success + failed + missing probes must equal expected probes.`,
      );
    }
    requireRatio(
      routeProbe.availability_ratio,
      `${routeLabel}.availability_ratio`,
      errors,
    );
    if (
      Number.isInteger(routeProbe.expected_probe_count) &&
      routeProbe.expected_probe_count > 0 &&
      !nearlyEqual(
        routeProbe.availability_ratio,
        routeProbe.success_probe_count / routeProbe.expected_probe_count,
      )
    ) {
      errors.push(
        `${routeLabel}.availability_ratio must equal successful / expected probes.`,
      );
    }
    if (
      typeof windowSeconds === 'number' &&
      Number.isInteger(probeIntervalSeconds) &&
      probeIntervalSeconds > 0 &&
      routeProbe.expected_probe_count <
        Math.floor(windowSeconds / probeIntervalSeconds)
    ) {
      errors.push(
        `${routeLabel}.expected_probe_count is too small for the observation window.`,
      );
    }
    requireAtLeast(
      routeProbe.availability_ratio,
      policy.minimum_availability_ratio,
      `${routeLabel}.availability_ratio`,
      errors,
    );
    requireAtMost(
      routeProbe.p95_latency_ms,
      policy.maximum_p95_latency_ms,
      `${routeLabel}.p95_latency_ms`,
      errors,
    );
    requireAtMost(
      routeProbe.maximum_single_outage_seconds,
      policy.maximum_single_outage_seconds,
      `${routeLabel}.maximum_single_outage_seconds`,
      errors,
    );
    for (const field of [
      'expected_probe_count',
      'success_probe_count',
      'failed_probe_count',
      'missing_probe_count',
    ]) {
      if (Number.isInteger(routeProbe[field])) {
        summary[field] += routeProbe[field];
      }
    }
    if (Number.isInteger(routeProbe.p95_latency_ms)) {
      summary.maximum_p95_latency_ms = Math.max(
        summary.maximum_p95_latency_ms,
        routeProbe.p95_latency_ms,
      );
    }
    if (Number.isInteger(routeProbe.maximum_single_outage_seconds)) {
      summary.maximum_single_outage_seconds = Math.max(
        summary.maximum_single_outage_seconds,
        routeProbe.maximum_single_outage_seconds,
      );
    }
  }
  return summary;
}

function validateBackupRestoreMeasurements(
  value,
  subject,
  policy,
  executionTimes,
  label,
  errors,
) {
  assertExactKeys(
    value,
    [
      'datasets',
      'backup_id',
      'source_environment_id',
      'restore_environment_id',
      'source_snapshot_at',
      'recovery_reference_at',
      'restore_started_at',
      'restore_completed_at',
      'source_counts',
      'restored_counts',
      'source_hashes',
      'restored_hashes',
      'rpo_seconds',
      'rto_seconds',
      'production_unchanged',
    ],
    label,
    errors,
  );
  requireExactSet(value.datasets, policy?.required_datasets, `${label}.datasets`, errors);
  requirePattern(value.backup_id, ID_PATTERN, `${label}.backup_id`, errors);
  requirePattern(
    value.source_environment_id,
    ID_PATTERN,
    `${label}.source_environment_id`,
    errors,
  );
  requirePattern(
    value.restore_environment_id,
    ID_PATTERN,
    `${label}.restore_environment_id`,
    errors,
  );
  if (value.source_environment_id === value.restore_environment_id) {
    errors.push(`${label} restore target must be isolated from the source.`);
  }
  assertEqual(
    value.source_environment_id,
    subject?.environment?.environment_id,
    `${label}.source_environment_id subject binding`,
    errors,
  );
  if (
    typeof value.restore_environment_id === 'string' &&
    FORBIDDEN_ENVIRONMENT_PATTERN.test(value.restore_environment_id)
  ) {
    errors.push(
      `${label}.restore_environment_id must not name a local or development target.`,
    );
  }
  const sourceSnapshot = parseTimestamp(
    value.source_snapshot_at,
    `${label}.source_snapshot_at`,
    null,
    errors,
  );
  const recoveryReference = parseTimestamp(
    value.recovery_reference_at,
    `${label}.recovery_reference_at`,
    null,
    errors,
  );
  const restoreStarted = parseTimestamp(
    value.restore_started_at,
    `${label}.restore_started_at`,
    null,
    errors,
  );
  const restoreCompleted = parseTimestamp(
    value.restore_completed_at,
    `${label}.restore_completed_at`,
    null,
    errors,
  );
  validateDatasetMap(value.source_counts, value.datasets, 'count', `${label}.source_counts`, errors);
  validateDatasetMap(value.restored_counts, value.datasets, 'count', `${label}.restored_counts`, errors);
  validateDatasetMap(value.source_hashes, value.datasets, 'hash', `${label}.source_hashes`, errors);
  validateDatasetMap(value.restored_hashes, value.datasets, 'hash', `${label}.restored_hashes`, errors);
  if (
    policy?.all_required_source_datasets_must_be_nonempty === true &&
    Array.isArray(value.datasets) &&
    isRecord(value.source_counts)
  ) {
    for (const dataset of value.datasets) {
      requirePositiveInteger(
        value.source_counts[dataset],
        `${label}.source_counts.${dataset}`,
        errors,
      );
    }
  }
  if (stableJson(value.source_counts) !== stableJson(value.restored_counts)) {
    errors.push(`${label} restored counts must exactly match source counts.`);
  }
  if (stableJson(value.source_hashes) !== stableJson(value.restored_hashes)) {
    errors.push(`${label} restored hashes must exactly match source hashes.`);
  }
  requireNonNegativeInteger(value.rpo_seconds, `${label}.rpo_seconds`, errors);
  requireNonNegativeInteger(value.rto_seconds, `${label}.rto_seconds`, errors);
  if (
    sourceSnapshot &&
    recoveryReference &&
    !nearlyEqual(
      value.rpo_seconds,
      (recoveryReference - sourceSnapshot) / 1000,
    )
  ) {
    errors.push(
      `${label}.rpo_seconds must match the recovery reference minus source snapshot interval.`,
    );
  }
  if (
    recoveryReference &&
    restoreStarted &&
    recoveryReference > restoreStarted
  ) {
    errors.push(
      `${label}.recovery_reference_at must not postdate restore_started_at.`,
    );
  }
  for (const [timestamp, timestampLabel] of [
    [sourceSnapshot, `${label}.source_snapshot_at`],
    [recoveryReference, `${label}.recovery_reference_at`],
    [restoreStarted, `${label}.restore_started_at`],
    [restoreCompleted, `${label}.restore_completed_at`],
  ]) {
    requireTimestampWithinExecution(
      timestamp,
      executionTimes,
      timestampLabel,
      errors,
    );
  }
  if (
    restoreStarted &&
    restoreCompleted &&
    !nearlyEqual(value.rto_seconds, (restoreCompleted - restoreStarted) / 1000)
  ) {
    errors.push(`${label}.rto_seconds must match the recorded restore interval.`);
  }
  requireAtMost(value.rpo_seconds, policy?.maximum_rpo_seconds, `${label}.rpo_seconds`, errors);
  requireAtMost(value.rto_seconds, policy?.maximum_rto_seconds, `${label}.rto_seconds`, errors);
  if (value.production_unchanged !== true) {
    errors.push(`${label}.production_unchanged must be true.`);
  }
}

function validatePenetrationMeasurements(value, policy, label, errors) {
  assertExactKeys(
    value,
    ['scope', 'methodology', 'tester', 'findings', 'retested_critical_and_high'],
    label,
    errors,
  );
  requireExactSet(value.scope, policy?.required_scope, `${label}.scope`, errors);
  requireNonEmptyString(value.methodology, `${label}.methodology`, errors);
  if (!VERIFIER_PATTERN.test(value.tester ?? '')) {
    errors.push(`${label}.tester must identify a team or external tester.`);
  }
  if (!isRecord(value.findings)) {
    errors.push(`${label}.findings must be an object.`);
    return;
  }
  const severities = ['critical', 'high', 'medium', 'low', 'informational'];
  assertExactKeys(value.findings, severities, `${label}.findings`, errors);
  for (const severity of severities) {
    const finding = value.findings[severity];
    const findingLabel = `${label}.findings.${severity}`;
    if (!isRecord(finding)) {
      errors.push(`${findingLabel} must be an object.`);
      continue;
    }
    assertExactKeys(finding, ['total', 'open', 'resolved', 'waived'], findingLabel, errors);
    for (const field of ['total', 'open', 'resolved', 'waived']) {
      requireNonNegativeInteger(finding[field], `${findingLabel}.${field}`, errors);
    }
    if (finding.open + finding.resolved + finding.waived !== finding.total) {
      errors.push(`${findingLabel} open + resolved + waived must equal total.`);
    }
  }
  requireNonNegativeInteger(
    value.retested_critical_and_high,
    `${label}.retested_critical_and_high`,
    errors,
  );
  requireAtMost(
    value.findings.critical?.open,
    policy?.maximum_open_critical,
    `${label}.findings.critical.open`,
    errors,
  );
  requireAtMost(
    value.findings.high?.open,
    policy?.maximum_open_high,
    `${label}.findings.high.open`,
    errors,
  );
  assertEqual(
    value.findings.critical?.waived,
    0,
    `${label}.findings.critical.waived`,
    errors,
  );
  assertEqual(
    value.findings.high?.waived,
    0,
    `${label}.findings.high.waived`,
    errors,
  );
  const requiredRetests =
    (value.findings.critical?.resolved ?? 0) +
    (value.findings.high?.resolved ?? 0);
  assertEqual(
    value.retested_critical_and_high,
    requiredRetests,
    `${label}.retested_critical_and_high`,
    errors,
  );
}

function validateRollbackMeasurements(
  value,
  subject,
  policy,
  executionTimes,
  label,
  errors,
) {
  assertExactKeys(
    value,
    [
      'sequence',
      'release_a',
      'release_b',
      'release_b_parent',
      'final_active_release',
      'release_a_verified_before_upgrade',
      'release_a_retained_before_rollback',
      'release_b_verified_before_rollback',
      'release_b_retained_after_rollback',
      'rollback_started_at',
      'rollback_completed_at',
      'rto_seconds',
      'active_pointer_target_sha256',
      'active_pointer_observed_sha256',
      'api_content_target_sha256',
      'api_content_observed_sha256',
      'learning_data_count_before',
      'learning_data_count_after',
      'learning_data_sha256_before',
      'learning_data_sha256_after',
      'delete_operation_count',
    ],
    label,
    errors,
  );
  requireExactArray(value.sequence, policy?.required_sequence, `${label}.sequence`, errors);
  for (const field of [
    'release_a',
    'release_b',
    'release_b_parent',
    'final_active_release',
  ]) {
    requirePattern(value[field], ID_PATTERN, `${label}.${field}`, errors);
  }
  assertEqual(value.release_b, subject?.release?.release_id, `${label}.release_b`, errors);
  assertEqual(
    value.release_a,
    subject?.release?.parent_release_id,
    `${label}.release_a`,
    errors,
  );
  assertEqual(value.release_b_parent, value.release_a, `${label}.release_b_parent`, errors);
  assertEqual(value.final_active_release, value.release_a, `${label}.final_active_release`, errors);
  if (value.release_a === value.release_b) {
    errors.push(`${label}.release_a and release_b must be distinct.`);
  }
  for (const field of [
    'release_a_verified_before_upgrade',
    'release_a_retained_before_rollback',
    'release_b_verified_before_rollback',
    'release_b_retained_after_rollback',
  ]) {
    assertEqual(value[field], true, `${label}.${field}`, errors);
  }
  const started = parseTimestamp(
    value.rollback_started_at,
    `${label}.rollback_started_at`,
    null,
    errors,
  );
  const completed = parseTimestamp(
    value.rollback_completed_at,
    `${label}.rollback_completed_at`,
    null,
    errors,
  );
  requireTimestampWithinExecution(
    started,
    executionTimes,
    `${label}.rollback_started_at`,
    errors,
  );
  requireTimestampWithinExecution(
    completed,
    executionTimes,
    `${label}.rollback_completed_at`,
    errors,
  );
  requireNonNegativeInteger(value.rto_seconds, `${label}.rto_seconds`, errors);
  if (started && completed && !nearlyEqual(value.rto_seconds, (completed - started) / 1000)) {
    errors.push(`${label}.rto_seconds must match the rollback interval.`);
  }
  for (const field of [
    'active_pointer_target_sha256',
    'active_pointer_observed_sha256',
    'api_content_target_sha256',
    'api_content_observed_sha256',
    'learning_data_sha256_before',
    'learning_data_sha256_after',
  ]) {
    requireSha256(value[field], `${label}.${field}`, errors);
  }
  assertEqual(
    value.active_pointer_observed_sha256,
    value.active_pointer_target_sha256,
    `${label}.active pointer`,
    errors,
  );
  assertEqual(
    value.api_content_observed_sha256,
    value.api_content_target_sha256,
    `${label}.api content`,
    errors,
  );
  requirePositiveInteger(
    value.learning_data_count_before,
    `${label}.learning_data_count_before`,
    errors,
  );
  requirePositiveInteger(
    value.learning_data_count_after,
    `${label}.learning_data_count_after`,
    errors,
  );
  assertEqual(
    value.learning_data_count_after,
    value.learning_data_count_before,
    `${label}.learning data count`,
    errors,
  );
  assertEqual(
    value.learning_data_sha256_after,
    value.learning_data_sha256_before,
    `${label}.learning data hash`,
    errors,
  );
  requireNonNegativeInteger(
    value.delete_operation_count,
    `${label}.delete_operation_count`,
    errors,
  );
  assertEqual(
    value.delete_operation_count,
    policy?.maximum_delete_operations,
    `${label}.delete_operation_count`,
    errors,
  );
  requireAtMost(value.rto_seconds, policy?.maximum_rto_seconds, `${label}.rto_seconds`, errors);
}

function validateDatasetMap(value, datasets, kind, label, errors) {
  if (!isRecord(value) || !Array.isArray(datasets)) {
    errors.push(`${label} must be an object bound to datasets.`);
    return;
  }
  assertExactKeys(value, datasets, label, errors);
  for (const dataset of datasets) {
    if (kind === 'count') {
      requireNonNegativeInteger(value[dataset], `${label}.${dataset}`, errors);
    } else {
      requireSha256(value[dataset], `${label}.${dataset}`, errors);
    }
  }
}

function validateTrueAssertions(value, expected, label, errors) {
  if (!isRecord(value) || !Array.isArray(expected)) {
    errors.push(`${label} must be an object with registered assertions.`);
    return;
  }
  assertExactKeys(value, expected, label, errors);
  for (const assertion of expected) {
    if (value[assertion] !== true) {
      errors.push(`${label}.${assertion} must be true.`);
    }
  }
}

function parseTimestamp(value, label, now, errors) {
  if (typeof value !== 'string') {
    errors.push(`${label} must be a canonical ISO timestamp.`);
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    errors.push(`${label} must be a canonical ISO timestamp.`);
    return null;
  }
  if (now instanceof Date && parsed > new Date(now.getTime() + MAX_CLOCK_SKEW_MS)) {
    errors.push(`${label} must not be in the future.`);
  }
  return parsed;
}

function requireTimestampWithinExecution(
  timestamp,
  executionTimes,
  label,
  errors,
) {
  if (
    !(timestamp instanceof Date) ||
    !(executionTimes?.startedAt instanceof Date) ||
    !(executionTimes?.completedAt instanceof Date)
  ) {
    return;
  }
  if (
    timestamp < executionTimes.startedAt ||
    timestamp > executionTimes.completedAt
  ) {
    errors.push(`${label} must fall within the recorded execution window.`);
  }
}

function requireExactSet(value, expected, label, errors) {
  if (!Array.isArray(value) || !Array.isArray(expected)) {
    errors.push(`${label} must be an array with a trusted policy set.`);
    return;
  }
  const actual = [...value].sort();
  const required = [...expected].sort();
  if (
    actual.length !== required.length ||
    actual.some((entry, index) => entry !== required[index])
  ) {
    errors.push(`${label} must contain exactly: ${expected.join(', ')}.`);
  }
}

function requireExactArray(value, expected, label, errors) {
  if (
    !Array.isArray(value) ||
    !Array.isArray(expected) ||
    value.length !== expected.length ||
    value.some((entry, index) => entry !== expected[index])
  ) {
    errors.push(`${label} must preserve the exact required order.`);
  }
}

function requireAtLeast(actual, expected, label, errors) {
  if (
    typeof actual !== 'number' ||
    !Number.isFinite(actual) ||
    typeof expected !== 'number' ||
    !Number.isFinite(expected) ||
    actual < expected
  ) {
    errors.push(`${label} must be at least ${String(expected)}.`);
  }
}

function requireAtMost(actual, expected, label, errors) {
  if (
    typeof actual !== 'number' ||
    !Number.isFinite(actual) ||
    typeof expected !== 'number' ||
    !Number.isFinite(expected) ||
    actual > expected
  ) {
    errors.push(`${label} must be at most ${String(expected)}.`);
  }
}

function requireRatio(value, label, errors) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    errors.push(`${label} must be a finite ratio from 0 through 1.`);
  }
}

function requirePositiveInteger(value, label, errors) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    errors.push(`${label} must be a positive safe integer.`);
  }
}

function requireNonNegativeInteger(value, label, errors) {
  if (!Number.isSafeInteger(value) || value < 0) {
    errors.push(`${label} must be a nonnegative safe integer.`);
  }
}

function requirePattern(value, pattern, label, errors) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    errors.push(`${label} has an invalid value.`);
  }
}

function requireSha256(value, label, errors) {
  if (
    typeof value !== 'string' ||
    !SHA256_PATTERN.test(value) ||
    /^([0-9a-f])\1{63}$/.test(value)
  ) {
    errors.push(`${label} must be a non-placeholder SHA-256.`);
  }
}

function requireOneOf(value, expected, label, errors) {
  if (!expected.includes(value)) {
    errors.push(`${label} must be one of: ${expected.join(', ')}.`);
  }
}

function requireNonEmptyString(value, label, errors) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${label} must be a non-empty string.`);
  }
}

function assertExactKeys(value, expected, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (
    actual.length !== required.length ||
    actual.some((entry, index) => entry !== required[index])
  ) {
    errors.push(`${label} must contain exactly: ${expected.join(', ')}.`);
  }
}

function assertEqual(actual, expected, label, errors) {
  if (actual !== expected) {
    errors.push(`${label} must be ${String(expected)}.`);
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nearlyEqual(left, right) {
  return (
    typeof left === 'number' &&
    typeof right === 'number' &&
    Number.isFinite(left) &&
    Number.isFinite(right) &&
    Math.abs(left - right) <= 1e-9
  );
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
