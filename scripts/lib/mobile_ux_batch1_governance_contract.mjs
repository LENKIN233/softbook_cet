import {createHash} from 'node:crypto';

export const GOVERNANCE_SCHEMA_VERSION = 'mobile-ux-batch1-governance-contract.v1';

export const TRUSTED_IDENTITY = Object.freeze({
  repository: 'LENKIN233/softbook_cet',
  repositoryId: 1216764160,
  canonicalOrigin: 'github.com/LENKIN233/softbook_cet',
  protectedBaseRef: 'refs/heads/main',
  workflowPath: '.github/workflows/formal-approval.yml',
  workflowId: 315520763,
  environmentId: 18348068326,
  environmentName: 'formal-product-owner-approval',
  reviewerLogin: 'LENKIN233',
  reviewerDatabaseId: 113219944,
  reviewerImmutableId: 'github:LENKIN233#113219944',
});

export const ARTIFACT_PATHS = Object.freeze({
  governancePolicy: 'spec/mobile-ux-batch1-governance.json',
  resolvedRequirementSchema: 'spec/mobile-ux-batch1-resolved-requirement.schema.json',
  legacyMigrationIntent:
    'docs/design/decisions/mobile-ux-batch1-legacy-preparation-receipt-migration-v1.json',
  legacyMigrationReceipt:
    'docs/design/decisions/mobile-ux-batch1-legacy-preparation-receipt-migration-v1.approval-receipt.json',
  legacyPreparationReceipt:
    'docs/design/decisions/mobile-ux-batch1-preparation-v1.approval-receipt.json',
  cohortDesignationIntent:
    'docs/design/decisions/mobile-ux-batch1-cohort-designation-v1.json',
  cohortDesignationReceipt:
    'docs/design/decisions/mobile-ux-batch1-cohort-designation-v1.approval-receipt.json',
  cohortNonPiiAttestation:
    'docs/design/decisions/mobile-ux-batch1-cohort-designation-v1.non-pii-attestation.json',
  manifestFreezeIntent:
    'docs/design/decisions/mobile-ux-batch1-manifest-freeze-v1.json',
  manifestFreezeReceipt:
    'docs/design/decisions/mobile-ux-batch1-manifest-freeze-v1.approval-receipt.json',
});

export const BATCH1_SUBJECT_PATHS = Object.freeze([
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/registry-set.v2.proposal.json',
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/cp-ba.registry.v2.proposal.json',
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/cp-cs.registry.v2.proposal.json',
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/cp-web.registry.v2.proposal.json',
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/manifest-schema-catalog.v1.json',
]);

export const LEGACY_SUBJECT_PATHS = Object.freeze([
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/registry-set.v1.json',
]);

export const HISTORICAL_PREPARATION = Object.freeze({
  decisionId: 'mobile-ux-batch1-preparation-v1',
  decisionClass: 'schema_definition',
  preapprovalIntentStatus: 'did_not_exist_at_approved_head',
  approvalTargetHeadSha: '8f4f82b35b660d9a775d6551e530fe6703c3ac54',
  pullRequest: 484,
  workflowRunId: 31326457854,
  deploymentId: 5821110397,
  deploymentWaitingStatusId: 16581160470,
  deploymentSuccessStatusId: 16581211785,
  approvalReviewSha256: '14f9a5b7fdd314e8349bdea1f518d104939b617ecf9499b34d99b58dd838e80d',
  authorityEventSha256: '702b86ed3c2d47e64b1fdf9336d54517ded237d30324a27594a3082dddc46c41',
  subjectPath: LEGACY_SUBJECT_PATHS[0],
  subjectByteLength: 25900,
  subjectRawSha256: 'f51f8fc849edacc9e22517266468caff1333d6d12c1a3265cf9a85eec381c982',
  subjectDigestDomain: 'softbook-cet/mobile-ux-batch1-legacy-preparation-subject/v1',
  subjectDigest: '015aa8075bcdaabc85f3b768b033175224483729d7a1b52a8ef361b5ae51eb78',
  gateEffect: 'none',
  allowedNextAction: 'prepare_R0_resolution_successor_only',
});

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

export const DECISION_KINDS = Object.freeze([
  'legacy_receipt_migration',
  'cohort_designation',
  'manifest_freeze',
  'receipt_materialization',
]);

export const PROVIDER_STATUS_RETENTION_SECONDS = 90 * 24 * 60 * 60;

export const DECISION_TTL_CEILINGS_SECONDS = Object.freeze({
  legacy_receipt_migration: 7 * 24 * 60 * 60,
  cohort_designation: 30 * 24 * 60 * 60,
  manifest_freeze: 14 * 24 * 60 * 60,
});

export const INVALIDATION_CONDITIONS_BY_KIND = Object.freeze({
  legacy_receipt_migration: Object.freeze([
    'historical_remote_event_chain_invalid',
    'historical_subject_blob_mode_length_or_raw_sha256_drift',
    'historical_preparation_scope_mismatch',
    'legacy_receipt_migration_contract_expired_or_invalidated',
  ]),
  cohort_designation: Object.freeze([
    'approval_event_chain_invalid',
    'decision_subject_bytes_or_digest_drift',
    'parent_approval_instance_invalid',
    'designated_cohort_identity_digest_mismatch',
    'protected_non_pii_attestation_invalid_or_expired',
    'protected_validity_policy_invalid_or_expired',
  ]),
  manifest_freeze: Object.freeze([
    'approval_event_chain_invalid',
    'decision_subject_bytes_or_digest_drift',
    'parent_approval_instance_invalid',
    'post_designation_binding_subject_drift',
    'final_subject_resolution_provenance_expired',
    'final_subject_execution_window_started_or_expired',
    'protected_validity_policy_invalid_or_expired',
  ]),
});

const KNOWN_INVALIDATION_CONDITIONS = new Set(
  Object.values(INVALIDATION_CONDITIONS_BY_KIND).flat(),
);

const DOMAIN = Object.freeze({
  approvalReview: 'softbook-cet/mobile-ux-batch1-approval-review/v1',
  authorityEvent: 'softbook-cet/mobile-ux-batch1-protected-approval-event/v1',
  subject: Object.freeze({
    legacy_receipt_migration:
      'softbook-cet/mobile-ux-batch1-legacy-preparation-subject/v1',
    cohort_designation: 'softbook-cet/mobile-ux-batch1-designation-subject/v1',
    manifest_freeze: 'softbook-cet/mobile-ux-batch1-final-freeze-subject/v1',
  }),
  cohort: 'softbook-cet/mobile-ux-batch1-designated-cohort/v1',
  approvalInstance: 'softbook-cet/mobile-ux-batch1-approval-instance/v1',
  historicalPreparationApprovalInstance:
    'softbook-cet/mobile-ux-batch1-historical-preparation-approval-instance/v1',
  legacyPreparationReceipt:
    'softbook-cet/mobile-ux-batch1-legacy-preparation-approval-receipt/v1',
});

const DECISION_ID = Object.freeze({
  legacy_receipt_migration:
    'mobile-ux-batch1-legacy-preparation-receipt-migration-v1',
  cohort_designation: 'mobile-ux-batch1-cohort-designation-v1',
  manifest_freeze: 'mobile-ux-batch1-manifest-freeze-v1',
  receipt_materialization: 'mobile-ux-batch1-receipt-materialization-v1',
});

const INTENT_PATH = Object.freeze({
  legacy_receipt_migration: ARTIFACT_PATHS.legacyMigrationIntent,
  cohort_designation: ARTIFACT_PATHS.cohortDesignationIntent,
  manifest_freeze: ARTIFACT_PATHS.manifestFreezeIntent,
});

const RECEIPT_PATH = Object.freeze({
  legacy_receipt_migration: ARTIFACT_PATHS.legacyMigrationReceipt,
  cohort_designation: ARTIFACT_PATHS.cohortDesignationReceipt,
  manifest_freeze: ARTIFACT_PATHS.manifestFreezeReceipt,
});

const NON_CLAIMS = Object.freeze({
  legacy_receipt_migration: Object.freeze([
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
  ]),
  cohort_designation: Object.freeze([
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
  ]),
  manifest_freeze: Object.freeze([
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
  ]),
  receipt_materialization: Object.freeze([
    'new_decision_authority',
    'subject_mutation',
    'manifest_creation',
    'provisioning',
    'execution',
    'evidence_collection',
    'release',
    'leadership_readiness',
  ]),
});

const GATE_EFFECT = Object.freeze({
  legacy_receipt_migration: 'none',
  cohort_designation: 'none',
  manifest_freeze: 'batch1_exact_manifest_freeze_and_reservation_activation_only',
  receipt_materialization: 'none',
});

const NEXT_ACTION = Object.freeze({
  legacy_receipt_migration: 'materialize_legacy_preparation_receipt_only',
  cohort_designation: 'produce_B2_designation_bound_binding_successor_only',
  manifest_freeze:
    'mark_exact_catalog_reservations_active_for_later_separate_authorization_without_manifest_creation_population_execution_or_evidence',
  receipt_materialization: 'create_exact_verified_receipt_bytes_in_descendant_commit_only',
});

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const COHORT_ID_PATTERN = /^cet(?:4|6)-[a-z2-7]{26}$/;

export function assertPlainObject(value, label = 'value') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} must have a plain JSON object prototype`);
  }
  return value;
}

export function assertExactKeys(value, expectedKeys, label = 'value') {
  assertPlainObject(value, label);
  const expected = new Set(expectedKeys);
  const actual = Object.keys(value);
  const missing = expectedKeys.filter((key) => !Object.hasOwn(value, key));
  const extra = actual.filter((key) => !expected.has(key));
  if (missing.length || extra.length) {
    throw new Error(
      `${label} must contain the exact key set; missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`,
    );
  }
  return value;
}

export function assertString(value, label, {nonEmpty = true} = {}) {
  if (typeof value !== 'string' || (nonEmpty && value.length === 0)) {
    throw new Error(`${label} must be ${nonEmpty ? 'a non-empty' : 'a'} string`);
  }
  assertUnicodeScalarString(value, label);
  return value;
}

export function assertSafeInteger(value, label, {minimum = 0} = {}) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} must be a safe integer >= ${minimum}`);
  }
  return value;
}

export function assertSha256(value, label) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 hex digest`);
  }
  return value;
}

export function assertCommitSha(value, label) {
  if (typeof value !== 'string' || !COMMIT_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase 40-character commit SHA`);
  }
  return value;
}

export function assertUtcTimestamp(value, label) {
  if (typeof value !== 'string' || !UTC_TIMESTAMP_PATTERN.test(value)) {
    throw new Error(`${label} must be an RFC3339 UTC timestamp at second precision`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().replace('.000Z', 'Z') !== value) {
    throw new Error(`${label} must be a real canonical UTC timestamp`);
  }
  return value;
}

export function assertSafeRepositoryPath(value, label = 'repository path') {
  assertString(value, label);
  if (
    value !== value.normalize('NFC') ||
    value.startsWith('/') ||
    value.endsWith('/') ||
    value.includes('\\') ||
    value.includes('\0') ||
    value.split('/').some((part) => part === '' || part === '.' || part === '..') ||
    !/^[A-Za-z0-9._/-]+$/.test(value)
  ) {
    throw new Error(`${label} must be a normalized repository-relative POSIX path`);
  }
  return value;
}

function assertUnicodeScalarString(value, label) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new Error(`${label} contains an unpaired UTF-16 surrogate`);
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error(`${label} contains an unpaired UTF-16 surrogate`);
    }
  }
}

function compareUtf16(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function canonicalJson(value) {
  const active = new Set();

  function serialize(current, label) {
    if (current === null) return 'null';
    if (typeof current === 'boolean') return current ? 'true' : 'false';
    if (typeof current === 'string') {
      assertUnicodeScalarString(current, label);
      return JSON.stringify(current);
    }
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw new Error(`${label} contains a non-finite number`);
      return JSON.stringify(current);
    }
    if (typeof current !== 'object') {
      throw new Error(`${label} contains a non-JSON value`);
    }
    if (active.has(current)) throw new Error(`${label} contains a cycle`);
    active.add(current);
    try {
      if (Array.isArray(current)) {
        for (let index = 0; index < current.length; index += 1) {
          if (!Object.hasOwn(current, index)) throw new Error(`${label} contains a sparse array`);
        }
        return `[${current.map((entry, index) => serialize(entry, `${label}[${index}]`)).join(',')}]`;
      }
      assertPlainObject(current, label);
      const keys = Object.keys(current).sort(compareUtf16);
      return `{${keys
        .map((key) => {
          assertUnicodeScalarString(key, `${label} key`);
          return `${JSON.stringify(key)}:${serialize(current[key], `${label}.${key}`)}`;
        })
        .join(',')}}`;
    } finally {
      active.delete(current);
    }
  }

  return serialize(value, 'canonical JSON value');
}

export function sha256Hex(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  return createHash('sha256').update(bytes).digest('hex');
}

export function domainSeparatedDigest(domain, canonicalValue) {
  assertString(domain, 'digest domain');
  if (domain.includes('\0')) throw new Error('digest domain must not contain NUL');
  return sha256Hex(Buffer.concat([
    Buffer.from(domain, 'utf8'),
    Buffer.from([0]),
    Buffer.from(canonicalJson(canonicalValue), 'utf8'),
  ]));
}

function assertLiteral(value, expected, label) {
  if (value !== expected) throw new Error(`${label} must equal ${JSON.stringify(expected)}`);
}

function assertBoolean(value, label) {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean`);
  return value;
}

function assertStringArray(value, label, {allowEmpty = false} = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array`);
  }
  const seen = new Set();
  for (let index = 0; index < value.length; index += 1) {
    assertString(value[index], `${label}[${index}]`);
    if (seen.has(value[index])) throw new Error(`${label} contains duplicate value ${value[index]}`);
    seen.add(value[index]);
  }
  return value;
}

function assertExactArray(value, expected, label) {
  if (!Array.isArray(value) || value.length !== expected.length) {
    throw new Error(`${label} must equal the exact ordered array`);
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (value[index] !== expected[index]) {
      throw new Error(`${label}[${index}] must equal ${JSON.stringify(expected[index])}`);
    }
  }
  return value;
}

function assertCanonicalEqual(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`${label} does not equal its trusted source projection`);
  }
}

export function normalizeGitHubOrigin(origin) {
  assertString(origin, 'repository origin');
  let owner;
  let repository;

  if (origin.startsWith('git@github.com:')) {
    const match = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/.exec(origin);
    if (!match) throw new Error('repository origin is not a supported canonical GitHub origin');
    [, owner, repository] = match;
  } else if (origin.startsWith('ssh://')) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('repository origin is not a valid SSH URL');
    }
    if (
      parsed.protocol !== 'ssh:' ||
      parsed.hostname !== 'github.com' ||
      parsed.username !== 'git' ||
      parsed.password ||
      parsed.port ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error('repository origin is not a supported canonical GitHub SSH origin');
    }
    const match = /^\/([^/]+)\/([^/]+?)(?:\.git)?$/.exec(parsed.pathname);
    if (!match) throw new Error('repository origin has an invalid GitHub path');
    [, owner, repository] = match;
  } else {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('repository origin is not a valid HTTPS URL');
    }
    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname !== 'github.com' ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error('repository origin is not a supported canonical GitHub HTTPS origin');
    }
    const match = /^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(parsed.pathname);
    if (!match) throw new Error('repository origin has an invalid GitHub path');
    [, owner, repository] = match;
  }

  const normalized = `github.com/${owner}/${repository}`;
  if (normalized !== TRUSTED_IDENTITY.canonicalOrigin) {
    throw new Error('repository origin does not match the canonical repository identity');
  }
  return normalized;
}

export function validateRepositoryIdentity(identity) {
  assertExactKeys(identity, ['repository', 'repository_id', 'origin'], 'repository identity');
  assertLiteral(identity.repository, TRUSTED_IDENTITY.repository, 'repository identity.repository');
  assertLiteral(
    identity.repository_id,
    TRUSTED_IDENTITY.repositoryId,
    'repository identity.repository_id',
  );
  normalizeGitHubOrigin(identity.origin);
  return Object.freeze({
    repository: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    origin: TRUSTED_IDENTITY.canonicalOrigin,
  });
}

export function authorityMaskFor(kind) {
  assertDecisionKind(kind);
  const mask = Object.fromEntries(AUTHORITY_KEYS.map((key) => [key, false]));
  if (kind === 'manifest_freeze') {
    mask.freeze = true;
    mask.reservation_activation = true;
  }
  return Object.freeze(mask);
}

export function validateAuthorityMask(mask, kind) {
  assertDecisionKind(kind);
  assertExactKeys(mask, AUTHORITY_KEYS, `${kind} authority`);
  const expected = authorityMaskFor(kind);
  for (const key of AUTHORITY_KEYS) {
    assertBoolean(mask[key], `${kind} authority.${key}`);
    if (mask[key] !== expected[key]) {
      throw new Error(`${kind} authority.${key} grants an unauthorized capability`);
    }
  }
  return expected;
}

function assertDecisionKind(kind, {allowMaterialization = true} = {}) {
  if (!DECISION_KINDS.includes(kind) || (!allowMaterialization && kind === 'receipt_materialization')) {
    throw new Error(`unknown decision kind ${JSON.stringify(kind)}`);
  }
  return kind;
}

function policyClassKey(kind) {
  return kind === 'legacy_receipt_migration'
    ? 'legacy_preparation_receipt_migration'
    : kind;
}

export function governancePolicyProjectionFromSpec(specPolicy) {
  assertExactKeys(
    specPolicy,
    [
      'schema_version',
      'policy_owner',
      'validity_anchor_field',
      'validity_anchor_source',
      'global_max_validity_seconds',
      'global_max_validity_days',
      'expires_at_required',
      'expires_at_must_be_after_success_observed_at',
      'expires_at_must_not_exceed_validity_anchor_plus_class_max_validity_seconds',
      'use_time_must_be_strictly_before_expires_at',
      'unknown_or_unimplemented_invalidation_condition_fails_closed',
      'class_policies',
      'all_class_maxima_must_be_at_most_global_maximum',
      'invalidation_conditions_must_exactly_equal_class_ordered_list',
      'later_inactive_deployment_status_alone_does_not_invalidate',
    ],
    'decision validity policy',
  );
  const projection = {
    schema_version: specPolicy.schema_version,
    source_path: ARTIFACT_PATHS.governancePolicy,
    policy_owner: specPolicy.policy_owner,
    global_max_validity_seconds: specPolicy.global_max_validity_seconds,
    class_policies: {
      legacy_receipt_migration:
        specPolicy.class_policies.legacy_preparation_receipt_migration,
      cohort_designation: specPolicy.class_policies.cohort_designation,
      manifest_freeze: specPolicy.class_policies.manifest_freeze,
    },
  };
  return validateGovernancePolicy(projection);
}

export function validateGovernancePolicy(policy) {
  assertExactKeys(
    policy,
    ['schema_version', 'source_path', 'policy_owner', 'global_max_validity_seconds', 'class_policies'],
    'governance policy projection',
  );
  assertLiteral(
    policy.schema_version,
    'mobile-ux-batch1-decision-validity-policy.v1',
    'governance policy projection.schema_version',
  );
  assertLiteral(policy.source_path, ARTIFACT_PATHS.governancePolicy, 'governance policy source');
  assertLiteral(
    policy.policy_owner,
    TRUSTED_IDENTITY.reviewerImmutableId,
    'governance policy owner',
  );
  assertLiteral(
    policy.global_max_validity_seconds,
    PROVIDER_STATUS_RETENTION_SECONDS,
    'governance global validity ceiling',
  );
  assertExactKeys(
    policy.class_policies,
    ['legacy_receipt_migration', 'cohort_designation', 'manifest_freeze'],
    'governance class policies',
  );

  for (const kind of ['legacy_receipt_migration', 'cohort_designation', 'manifest_freeze']) {
    const classPolicy = policy.class_policies[kind];
    assertExactKeys(
      classPolicy,
      ['max_validity_seconds', 'max_validity_days', 'ordered_invalidation_condition_ids'],
      `governance class policy ${kind}`,
    );
    assertLiteral(
      classPolicy.max_validity_seconds,
      DECISION_TTL_CEILINGS_SECONDS[kind],
      `governance class policy ${kind}.max_validity_seconds`,
    );
    assertLiteral(
      classPolicy.max_validity_days,
      DECISION_TTL_CEILINGS_SECONDS[kind] / 86400,
      `governance class policy ${kind}.max_validity_days`,
    );
    if (classPolicy.max_validity_seconds > policy.global_max_validity_seconds) {
      throw new Error(`${kind} validity exceeds the provider retention ceiling`);
    }
    assertExactArray(
      classPolicy.ordered_invalidation_condition_ids,
      INVALIDATION_CONDITIONS_BY_KIND[kind],
      `governance class policy ${kind}.ordered_invalidation_condition_ids`,
    );
    for (const conditionId of classPolicy.ordered_invalidation_condition_ids) {
      if (!KNOWN_INVALIDATION_CONDITIONS.has(conditionId)) {
        throw new Error(`unknown invalidation condition ${conditionId}`);
      }
    }
  }
  return policy;
}

export function validateSubjectArtifactRecords(
  records,
  {expectedPaths, observedRecords = records, label = 'subject artifact records'} = {},
) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error(`${label} must be a non-empty array`);
  }
  if (!Array.isArray(expectedPaths) || expectedPaths.length === 0) {
    throw new Error(`${label} expectedPaths must be a non-empty array`);
  }
  if (records.length !== expectedPaths.length) {
    throw new Error(`${label} must contain exactly ${expectedPaths.length} records`);
  }
  const paths = new Set();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    assertExactKeys(record, ['path', 'git_mode', 'byte_length', 'raw_sha256'], `${label}[${index}]`);
    assertSafeRepositoryPath(record.path, `${label}[${index}].path`);
    assertLiteral(record.path, expectedPaths[index], `${label}[${index}].path`);
    assertLiteral(record.git_mode, '100644', `${label}[${index}].git_mode`);
    assertSafeInteger(record.byte_length, `${label}[${index}].byte_length`, {minimum: 1});
    assertSha256(record.raw_sha256, `${label}[${index}].raw_sha256`);
    if (paths.has(record.path)) throw new Error(`${label} contains duplicate path ${record.path}`);
    paths.add(record.path);
  }
  if (!Array.isArray(observedRecords)) {
    throw new Error(`${label} observed records must be an array`);
  }
  assertCanonicalEqual(observedRecords, records, `${label} observed records`);
  return records;
}

function artifactRecordTuple(record) {
  return [
    ['path', record.path],
    ['git_mode', record.git_mode],
    ['byte_length', record.byte_length],
    ['raw_sha256', record.raw_sha256],
  ];
}

export function computeSubjectDigest(domain, artifactRecords) {
  assertString(domain, 'subject digest domain');
  if (!Array.isArray(artifactRecords) || artifactRecords.length === 0) {
    throw new Error('subject artifact records must be a non-empty array');
  }
  return domainSeparatedDigest(domain, artifactRecords.map(artifactRecordTuple));
}

export function validateSubjectBinding(
  subject,
  {
    kind,
    expectedPaths = kind === 'legacy_receipt_migration' ? LEGACY_SUBJECT_PATHS : BATCH1_SUBJECT_PATHS,
    observedArtifactRecords = subject?.artifact_records,
  } = {},
) {
  assertDecisionKind(kind, {allowMaterialization: false});
  assertExactKeys(
    subject,
    ['commit', 'digest_domain', 'digest', 'artifact_records'],
    `${kind} subject`,
  );
  assertCommitSha(subject.commit, `${kind} subject.commit`);
  assertLiteral(subject.digest_domain, DOMAIN.subject[kind], `${kind} subject.digest_domain`);
  validateSubjectArtifactRecords(subject.artifact_records, {
    expectedPaths,
    observedRecords: observedArtifactRecords,
    label: `${kind} subject.artifact_records`,
  });
  const digest = computeSubjectDigest(subject.digest_domain, subject.artifact_records);
  if (subject.digest !== digest) throw new Error(`${kind} subject digest drift`);
  return Object.freeze({...subject});
}

export function computeDesignatedCohortDigest({
  subject_commit,
  subject_digest_domain,
  subject_digest,
  designated_cohort_id,
}) {
  assertCommitSha(subject_commit, 'cohort digest subject_commit');
  assertString(subject_digest_domain, 'cohort digest subject_digest_domain');
  assertSha256(subject_digest, 'cohort digest subject_digest');
  assertDesignatedCohortId(designated_cohort_id);
  return domainSeparatedDigest(DOMAIN.cohort, [
    ['designation_subject_commit', subject_commit],
    ['designation_subject_digest_domain', subject_digest_domain],
    ['designation_subject_digest', subject_digest],
    ['designated_cohort_id', designated_cohort_id],
  ]);
}

function assertDesignatedCohortId(value) {
  if (typeof value !== 'string' || !COHORT_ID_PATTERN.test(value)) {
    throw new Error('designated_cohort_id must be a CET4/6 opaque 130-bit lowercase base32 identifier');
  }
  return value;
}

export function validatePrivacyAttestation(attestation, {
  subject,
  designatedCohortId,
  designatedCohortSha256,
} = {}) {
  assertExactKeys(
    attestation,
    [
      'schema_version',
      'designation_subject_commit',
      'designation_subject_digest_domain',
      'designation_subject_digest',
      'designated_cohort_id',
      'designated_cohort_sha256',
      'classification',
      'identifier_derivation',
      'minimum_entropy_bits',
      'participant_attributes_used',
      'repository_contains_participant_mapping',
      'participant_mapping_location',
      'embedded_direct_identifier_fields',
      'embedded_quasi_identifier_fields',
    ],
    'non-PII attestation',
  );
  assertLiteral(
    attestation.schema_version,
    'mobile-ux-batch1-non-pii-attestation.v1',
    'non-PII attestation.schema_version',
  );
  assertLiteral(
    attestation.classification,
    'opaque_campaign_identifier_non_pii',
    'non-PII attestation.classification',
  );
  assertLiteral(
    attestation.identifier_derivation,
    'cryptographically_random_at_least_128_bits_not_derived_from_participant_data',
    'non-PII attestation.identifier_derivation',
  );
  assertLiteral(attestation.minimum_entropy_bits, 128, 'non-PII attestation.minimum_entropy_bits');
  assertExactArray(
    attestation.participant_attributes_used,
    [],
    'non-PII attestation.participant_attributes_used',
  );
  assertLiteral(
    attestation.repository_contains_participant_mapping,
    false,
    'non-PII attestation.repository_contains_participant_mapping',
  );
  assertLiteral(
    attestation.participant_mapping_location,
    'off_repository_protected_control_plane',
    'non-PII attestation.participant_mapping_location',
  );
  assertExactArray(
    attestation.embedded_direct_identifier_fields,
    [],
    'non-PII attestation.embedded_direct_identifier_fields',
  );
  assertExactArray(
    attestation.embedded_quasi_identifier_fields,
    [],
    'non-PII attestation.embedded_quasi_identifier_fields',
  );
  assertDesignatedCohortId(attestation.designated_cohort_id);
  assertSha256(attestation.designated_cohort_sha256, 'non-PII attestation.designated_cohort_sha256');
  if (subject) {
    assertLiteral(attestation.designation_subject_commit, subject.commit, 'attestation subject commit');
    assertLiteral(
      attestation.designation_subject_digest_domain,
      subject.digest_domain,
      'attestation subject digest domain',
    );
    assertLiteral(attestation.designation_subject_digest, subject.digest, 'attestation subject digest');
  } else {
    assertCommitSha(attestation.designation_subject_commit, 'attestation subject commit');
    assertString(attestation.designation_subject_digest_domain, 'attestation subject digest domain');
    assertSha256(attestation.designation_subject_digest, 'attestation subject digest');
  }
  if (designatedCohortId !== undefined) {
    assertLiteral(attestation.designated_cohort_id, designatedCohortId, 'attestation cohort id');
  }
  if (designatedCohortSha256 !== undefined) {
    assertLiteral(
      attestation.designated_cohort_sha256,
      designatedCohortSha256,
      'attestation cohort digest',
    );
  }
  const recomputed = computeDesignatedCohortDigest({
    subject_commit: attestation.designation_subject_commit,
    subject_digest_domain: attestation.designation_subject_digest_domain,
    subject_digest: attestation.designation_subject_digest,
    designated_cohort_id: attestation.designated_cohort_id,
  });
  if (attestation.designated_cohort_sha256 !== recomputed) {
    throw new Error('non-PII attestation designated cohort digest drift');
  }
  return attestation;
}

function validateArtifactRecord(record, {path: expectedPath, observedRecord = record, label}) {
  return validateSubjectArtifactRecords([record], {
    expectedPaths: [expectedPath],
    observedRecords: [observedRecord],
    label,
  })[0];
}

const APPROVAL_REVIEW_FIELDS = Object.freeze([
  'state',
  'comment',
  'environment_id',
  'environment_name',
  'reviewer_login',
  'reviewer_database_id',
  'reviewer_immutable_id',
]);

export function computeApprovalReviewDigest(reviewProjection) {
  assertExactKeys(reviewProjection, APPROVAL_REVIEW_FIELDS, 'approval review projection');
  return domainSeparatedDigest(
    DOMAIN.approvalReview,
    APPROVAL_REVIEW_FIELDS.map((field) => [field, reviewProjection[field]]),
  );
}

const AUTHORITY_EVENT_FIELDS = Object.freeze([
  'repository_full_name',
  'repository_id',
  'pull_request_number',
  'pull_request_base_ref',
  'pull_request_base_sha',
  'approval_target_head_sha',
  'workflow_path',
  'workflow_id',
  'workflow_run_id',
  'run_attempt',
  'workflow_conclusion',
  'deployment_id',
  'deployment_waiting_status_id',
  'deployment_success_status_id',
  'environment_id',
  'environment_name',
  'reviewer_immutable_id',
  'approval_review_sha256',
  'validity_anchor_at',
  'success_observed_at',
]);

export function computeAuthorityEventDigest(eventProjection) {
  validateAuthorityEventProjection(eventProjection);
  return domainSeparatedDigest(
    DOMAIN.authorityEvent,
    AUTHORITY_EVENT_FIELDS.map((field) => [field, eventProjection[field]]),
  );
}

export function validateAuthorityEventProjection(eventProjection) {
  assertExactKeys(eventProjection, AUTHORITY_EVENT_FIELDS, 'authority event projection');
  assertLiteral(
    eventProjection.repository_full_name,
    TRUSTED_IDENTITY.repository,
    'authority event repository',
  );
  assertLiteral(
    eventProjection.repository_id,
    TRUSTED_IDENTITY.repositoryId,
    'authority event repository id',
  );
  assertSafeInteger(eventProjection.pull_request_number, 'authority event pull request', {minimum: 1});
  assertLiteral(
    eventProjection.pull_request_base_ref,
    TRUSTED_IDENTITY.protectedBaseRef,
    'authority event base ref',
  );
  assertCommitSha(eventProjection.pull_request_base_sha, 'authority event base SHA');
  assertCommitSha(eventProjection.approval_target_head_sha, 'authority event approval target head');
  assertLiteral(
    eventProjection.workflow_path,
    TRUSTED_IDENTITY.workflowPath,
    'authority event workflow path',
  );
  assertLiteral(
    eventProjection.workflow_id,
    TRUSTED_IDENTITY.workflowId,
    'authority event workflow id',
  );
  for (const field of [
    'workflow_run_id',
    'run_attempt',
    'deployment_id',
    'deployment_waiting_status_id',
    'deployment_success_status_id',
  ]) {
    assertSafeInteger(eventProjection[field], `authority event.${field}`, {minimum: 1});
  }
  assertLiteral(eventProjection.workflow_conclusion, 'success', 'authority event workflow conclusion');
  assertLiteral(
    eventProjection.environment_id,
    TRUSTED_IDENTITY.environmentId,
    'authority event environment id',
  );
  assertLiteral(
    eventProjection.environment_name,
    TRUSTED_IDENTITY.environmentName,
    'authority event environment name',
  );
  assertLiteral(
    eventProjection.reviewer_immutable_id,
    TRUSTED_IDENTITY.reviewerImmutableId,
    'authority event reviewer',
  );
  assertSha256(eventProjection.approval_review_sha256, 'authority event approval review digest');
  assertUtcTimestamp(eventProjection.validity_anchor_at, 'authority event validity anchor');
  assertUtcTimestamp(eventProjection.success_observed_at, 'authority event success observed time');
  if (Date.parse(eventProjection.validity_anchor_at) >= Date.parse(eventProjection.success_observed_at)) {
    throw new Error('authority event validity anchor must precede success observed time');
  }
  if (
    eventProjection.deployment_waiting_status_id ===
    eventProjection.deployment_success_status_id
  ) {
    throw new Error('authority event waiting and success status ids must differ');
  }
  return eventProjection;
}

function protectedAuthorityEventRef(eventProjection) {
  validateAuthorityEventProjection(eventProjection);
  return (
    `github-actions://repositories/${TRUSTED_IDENTITY.repositoryId}` +
    `/actions/runs/${eventProjection.workflow_run_id}/attempts/${eventProjection.run_attempt}` +
    `/deployments/${eventProjection.deployment_id}/approval-reviews/${eventProjection.approval_review_sha256}`
  );
}

export function projectGitHubApprovalEvent(evidence) {
  assertExactKeys(
    evidence,
    [
      'origin',
      'repository',
      'pull_request',
      'workflow_run',
      'deployment',
      'environment',
      'approval_reviews',
      'deployment_statuses',
    ],
    'GitHub event evidence',
  );
  validateRepositoryIdentity({
    repository: evidence.repository.full_name,
    repository_id: evidence.repository.id,
    origin: evidence.origin,
  });
  assertExactKeys(evidence.repository, ['id', 'full_name'], 'GitHub repository');
  assertExactKeys(
    evidence.pull_request,
    ['number', 'base_ref', 'base_sha', 'base_repository_id', 'head_repository_id'],
    'GitHub pull request',
  );
  assertSafeInteger(evidence.pull_request.number, 'GitHub pull request.number', {minimum: 1});
  assertLiteral(
    evidence.pull_request.base_ref,
    TRUSTED_IDENTITY.protectedBaseRef,
    'GitHub pull request.base_ref',
  );
  assertCommitSha(evidence.pull_request.base_sha, 'GitHub pull request.base_sha');
  assertLiteral(
    evidence.pull_request.base_repository_id,
    TRUSTED_IDENTITY.repositoryId,
    'GitHub pull request.base_repository_id',
  );
  assertLiteral(
    evidence.pull_request.head_repository_id,
    TRUSTED_IDENTITY.repositoryId,
    'GitHub pull request.head_repository_id',
  );

  assertExactKeys(
    evidence.workflow_run,
    ['id', 'run_attempt', 'workflow_id', 'event', 'path', 'head_sha', 'conclusion', 'repository_id'],
    'GitHub workflow run',
  );
  assertSafeInteger(evidence.workflow_run.id, 'GitHub workflow run.id', {minimum: 1});
  assertSafeInteger(evidence.workflow_run.run_attempt, 'GitHub workflow run.run_attempt', {minimum: 1});
  assertLiteral(
    evidence.workflow_run.workflow_id,
    TRUSTED_IDENTITY.workflowId,
    'GitHub workflow run.workflow_id',
  );
  assertLiteral(evidence.workflow_run.event, 'pull_request_target', 'GitHub workflow run.event');
  assertLiteral(evidence.workflow_run.path, TRUSTED_IDENTITY.workflowPath, 'GitHub workflow run.path');
  assertCommitSha(evidence.workflow_run.head_sha, 'GitHub workflow run.head_sha');
  assertLiteral(evidence.workflow_run.conclusion, 'success', 'GitHub workflow run.conclusion');
  assertLiteral(
    evidence.workflow_run.repository_id,
    TRUSTED_IDENTITY.repositoryId,
    'GitHub workflow run.repository_id',
  );

  assertExactKeys(
    evidence.deployment,
    ['id', 'sha', 'environment_id', 'environment_name'],
    'GitHub deployment',
  );
  assertSafeInteger(evidence.deployment.id, 'GitHub deployment.id', {minimum: 1});
  assertLiteral(evidence.deployment.sha, evidence.workflow_run.head_sha, 'deployment/head binding');
  assertLiteral(
    evidence.deployment.environment_id,
    TRUSTED_IDENTITY.environmentId,
    'GitHub deployment.environment_id',
  );
  assertLiteral(
    evidence.deployment.environment_name,
    TRUSTED_IDENTITY.environmentName,
    'GitHub deployment.environment_name',
  );

  assertExactKeys(
    evidence.environment,
    ['id', 'name', 'can_admins_bypass', 'required_reviewer_ids'],
    'GitHub environment',
  );
  assertLiteral(evidence.environment.id, TRUSTED_IDENTITY.environmentId, 'GitHub environment.id');
  assertLiteral(evidence.environment.name, TRUSTED_IDENTITY.environmentName, 'GitHub environment.name');
  assertLiteral(evidence.environment.can_admins_bypass, false, 'GitHub environment.can_admins_bypass');
  assertExactArray(
    evidence.environment.required_reviewer_ids,
    [TRUSTED_IDENTITY.reviewerDatabaseId],
    'GitHub environment.required_reviewer_ids',
  );

  if (!Array.isArray(evidence.approval_reviews) || evidence.approval_reviews.length === 0) {
    throw new Error('GitHub approval reviews must contain one matching review');
  }
  const matchingReviews = [];
  for (let index = 0; index < evidence.approval_reviews.length; index += 1) {
    const review = evidence.approval_reviews[index];
    assertExactKeys(review, ['state', 'comment', 'environments', 'user'], `GitHub approval review[${index}]`);
    if (!['approved', 'rejected'].includes(review.state)) {
      throw new Error(`GitHub approval review[${index}] has unknown state ${review.state}`);
    }
    assertString(review.comment, `GitHub approval review[${index}].comment`);
    if (review.comment.trim().length === 0) {
      throw new Error(`GitHub approval review[${index}].comment must contain non-whitespace scope text`);
    }
    if (!Array.isArray(review.environments) || review.environments.length !== 1) {
      throw new Error(`GitHub approval review[${index}] must bind exactly one environment`);
    }
    const environment = review.environments[0];
    assertExactKeys(environment, ['id', 'name'], `GitHub approval review[${index}].environment`);
    assertExactKeys(review.user, ['id', 'login'], `GitHub approval review[${index}].user`);
    const isRequiredEnvironment =
      environment.id === TRUSTED_IDENTITY.environmentId &&
      environment.name === TRUSTED_IDENTITY.environmentName;
    const isRequiredOwner =
      review.user.id === TRUSTED_IDENTITY.reviewerDatabaseId &&
      review.user.login === TRUSTED_IDENTITY.reviewerLogin;
    if (isRequiredEnvironment && isRequiredOwner) matchingReviews.push(review);
  }
  if (matchingReviews.some((review) => review.state === 'rejected')) {
    throw new Error('GitHub approval review is revoked or rejected');
  }
  const approvedReviews = matchingReviews.filter((review) => review.state === 'approved');
  if (approvedReviews.length !== 1 || matchingReviews.length !== 1) {
    throw new Error('GitHub approval review selection must resolve to exactly one approved review');
  }
  const selectedReview = approvedReviews[0];
  const reviewProjection = {
    state: selectedReview.state,
    comment: selectedReview.comment,
    environment_id: selectedReview.environments[0].id,
    environment_name: selectedReview.environments[0].name,
    reviewer_login: selectedReview.user.login,
    reviewer_database_id: selectedReview.user.id,
    reviewer_immutable_id: TRUSTED_IDENTITY.reviewerImmutableId,
  };
  const approvalReviewSha256 = computeApprovalReviewDigest(reviewProjection);

  if (!Array.isArray(evidence.deployment_statuses) || evidence.deployment_statuses.length === 0) {
    throw new Error('GitHub deployment statuses must be a non-empty array');
  }
  const statusIds = new Set();
  const waiting = [];
  const success = [];
  const inactive = [];
  for (let index = 0; index < evidence.deployment_statuses.length; index += 1) {
    const status = evidence.deployment_statuses[index];
    assertExactKeys(status, ['id', 'state', 'created_at', 'environment'], `deployment status[${index}]`);
    assertSafeInteger(status.id, `deployment status[${index}].id`, {minimum: 1});
    if (statusIds.has(status.id)) throw new Error(`deployment statuses contain duplicate id ${status.id}`);
    statusIds.add(status.id);
    if (!['waiting', 'queued', 'in_progress', 'success', 'inactive', 'failure', 'error'].includes(status.state)) {
      throw new Error(`deployment status[${index}] has unknown state ${status.state}`);
    }
    assertUtcTimestamp(status.created_at, `deployment status[${index}].created_at`);
    assertLiteral(status.environment, TRUSTED_IDENTITY.environmentName, `deployment status[${index}].environment`);
    if (status.state === 'failure' || status.state === 'error') {
      throw new Error('GitHub deployment event chain is revoked by failure or error status');
    }
    if (status.state === 'waiting') waiting.push(status);
    if (status.state === 'success') success.push(status);
    if (status.state === 'inactive') inactive.push(status);
  }
  if (waiting.length !== 1 || success.length !== 1) {
    throw new Error('deployment event chain requires exactly one waiting and one success status');
  }
  const waitingMs = Date.parse(waiting[0].created_at);
  const successMs = Date.parse(success[0].created_at);
  if (!(waitingMs < successMs)) {
    throw new Error('deployment waiting status must strictly precede success status');
  }
  for (const status of inactive) {
    if (Date.parse(status.created_at) < successMs) {
      throw new Error('inactive deployment status cannot precede the exact success status');
    }
  }
  for (const status of evidence.deployment_statuses) {
    if (Date.parse(status.created_at) > successMs && status.state !== 'inactive') {
      throw new Error(`post-success deployment status ${status.state} is not a permitted inactive observation`);
    }
  }

  const event = {
    repository_full_name: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    pull_request_number: evidence.pull_request.number,
    pull_request_base_ref: evidence.pull_request.base_ref,
    pull_request_base_sha: evidence.pull_request.base_sha,
    approval_target_head_sha: evidence.workflow_run.head_sha,
    workflow_path: evidence.workflow_run.path,
    workflow_id: evidence.workflow_run.workflow_id,
    workflow_run_id: evidence.workflow_run.id,
    run_attempt: evidence.workflow_run.run_attempt,
    workflow_conclusion: evidence.workflow_run.conclusion,
    deployment_id: evidence.deployment.id,
    deployment_waiting_status_id: waiting[0].id,
    deployment_success_status_id: success[0].id,
    environment_id: evidence.environment.id,
    environment_name: evidence.environment.name,
    reviewer_immutable_id: TRUSTED_IDENTITY.reviewerImmutableId,
    approval_review_sha256: approvalReviewSha256,
    validity_anchor_at: waiting[0].created_at,
    success_observed_at: success[0].created_at,
  };
  const authorityEventSha256 = computeAuthorityEventDigest(event);
  const eventRef = protectedAuthorityEventRef(event);
  return Object.freeze({
    event: Object.freeze(event),
    approval_review: Object.freeze(reviewProjection),
    authority_event_sha256: authorityEventSha256,
    protected_authority_event_ref: eventRef,
    observation: Object.freeze({
      later_inactive_status_ids: Object.freeze(
        inactive
          .filter((status) => Date.parse(status.created_at) >= successMs)
          .map((status) => status.id)
          .sort((left, right) => left - right),
      ),
    }),
  });
}

const HISTORICAL_PREPARATION_APPROVAL_INSTANCE_FIELDS = Object.freeze([
  'decision_id',
  'decision_class',
  'approval_target_head_sha',
  'subject_digest_domain',
  'subject_digest',
  'authority_event_sha256',
  'gate_effect',
  'authority',
  'allowed_next_action',
]);

export function computeHistoricalPreparationApprovalInstanceDigest(binding) {
  assertExactKeys(
    binding,
    HISTORICAL_PREPARATION_APPROVAL_INSTANCE_FIELDS,
    'historical preparation approval instance binding',
  );
  assertLiteral(
    binding.decision_id,
    HISTORICAL_PREPARATION.decisionId,
    'historical preparation decision_id',
  );
  assertLiteral(
    binding.decision_class,
    HISTORICAL_PREPARATION.decisionClass,
    'historical preparation decision_class',
  );
  assertLiteral(
    binding.approval_target_head_sha,
    HISTORICAL_PREPARATION.approvalTargetHeadSha,
    'historical preparation approval target head',
  );
  assertLiteral(
    binding.subject_digest_domain,
    HISTORICAL_PREPARATION.subjectDigestDomain,
    'historical preparation subject digest domain',
  );
  assertLiteral(
    binding.subject_digest,
    HISTORICAL_PREPARATION.subjectDigest,
    'historical preparation subject digest',
  );
  assertSha256(
    binding.authority_event_sha256,
    'historical preparation authority event digest',
  );
  assertLiteral(
    binding.authority_event_sha256,
    HISTORICAL_PREPARATION.authorityEventSha256,
    'historical preparation authority event digest',
  );
  assertLiteral(
    binding.gate_effect,
    HISTORICAL_PREPARATION.gateEffect,
    'historical preparation gate effect',
  );
  validateAuthorityMask(binding.authority, 'legacy_receipt_migration');
  assertLiteral(
    binding.allowed_next_action,
    HISTORICAL_PREPARATION.allowedNextAction,
    'historical preparation allowed next action',
  );
  return domainSeparatedDigest(
    DOMAIN.historicalPreparationApprovalInstance,
    HISTORICAL_PREPARATION_APPROVAL_INSTANCE_FIELDS.map((field) => [field, binding[field]]),
  );
}

function historicalPreparationApprovalBinding(subject, authorityEventSha256) {
  return {
    decision_id: HISTORICAL_PREPARATION.decisionId,
    decision_class: HISTORICAL_PREPARATION.decisionClass,
    approval_target_head_sha: HISTORICAL_PREPARATION.approvalTargetHeadSha,
    subject_digest_domain: subject.digest_domain,
    subject_digest: subject.digest,
    authority_event_sha256: authorityEventSha256,
    gate_effect: HISTORICAL_PREPARATION.gateEffect,
    authority: authorityMaskFor('legacy_receipt_migration'),
    allowed_next_action: HISTORICAL_PREPARATION.allowedNextAction,
  };
}

function validateHistoricalSubject(subject) {
  assertLiteral(
    subject.commit,
    HISTORICAL_PREPARATION.approvalTargetHeadSha,
    'historical preparation subject commit',
  );
  assertLiteral(
    subject.digest_domain,
    HISTORICAL_PREPARATION.subjectDigestDomain,
    'historical preparation subject digest domain',
  );
  assertLiteral(
    subject.digest,
    HISTORICAL_PREPARATION.subjectDigest,
    'historical preparation subject digest',
  );
  const record = subject.artifact_records[0];
  assertLiteral(
    record.path,
    HISTORICAL_PREPARATION.subjectPath,
    'historical preparation subject path',
  );
  assertLiteral(
    record.git_mode,
    '100644',
    'historical preparation subject git mode',
  );
  assertLiteral(
    record.byte_length,
    HISTORICAL_PREPARATION.subjectByteLength,
    'historical preparation subject byte length',
  );
  assertLiteral(
    record.raw_sha256,
    HISTORICAL_PREPARATION.subjectRawSha256,
    'historical preparation subject raw digest',
  );
  return subject;
}

export function validateHistoricalPreparationEventProjection(eventProjection) {
  const projected = eventProjection?.event ?? eventProjection;
  if (!projected) throw new Error('trusted historical event projection is required');
  validateAuthorityEventProjection(projected);
  const fixedFields = {
    pull_request_number: HISTORICAL_PREPARATION.pullRequest,
    approval_target_head_sha: HISTORICAL_PREPARATION.approvalTargetHeadSha,
    workflow_run_id: HISTORICAL_PREPARATION.workflowRunId,
    deployment_id: HISTORICAL_PREPARATION.deploymentId,
    deployment_waiting_status_id: HISTORICAL_PREPARATION.deploymentWaitingStatusId,
    deployment_success_status_id: HISTORICAL_PREPARATION.deploymentSuccessStatusId,
    approval_review_sha256: HISTORICAL_PREPARATION.approvalReviewSha256,
  };
  for (const [field, expected] of Object.entries(fixedFields)) {
    assertLiteral(projected[field], expected, `historical preparation event.${field}`);
  }
  const authorityEventSha256 = computeAuthorityEventDigest(projected);
  assertLiteral(
    authorityEventSha256,
    HISTORICAL_PREPARATION.authorityEventSha256,
    'historical preparation recomputed authority event digest',
  );
  if (eventProjection?.authority_event_sha256 !== undefined) {
    assertLiteral(
      eventProjection.authority_event_sha256,
      authorityEventSha256,
      'injected historical authority event digest',
    );
  }
  return Object.freeze({
    event: projected,
    authority_event_sha256: authorityEventSha256,
  });
}

const COMMON_INTENT_KEYS = Object.freeze([
  'schema_version',
  'decision_id',
  'decision_class',
  'contract_version',
  'repository',
  'repository_id',
  'pull_request',
  'intent_artifact_path',
  'validity_policy_artifact_record',
  'gate_effect',
  'authority',
  'allowed_next_action',
  'non_claims',
  'expires_at',
  'invalidation_conditions',
]);

const INTENT_KEYS = Object.freeze({
  legacy_receipt_migration: Object.freeze([
    ...COMMON_INTENT_KEYS,
    'decision_subclass',
    'historical_subject_commit',
    'historical_subject_digest_domain',
    'historical_subject_digest',
    'historical_subject_artifact_records',
    'historical_approval_instance_digest',
    'materialized_preparation_receipt_path',
  ]),
  cohort_designation: Object.freeze([
    ...COMMON_INTENT_KEYS,
    'designation_subject_commit',
    'designation_subject_digest_domain',
    'designation_subject_digest',
    'designation_subject_artifact_records',
    'designated_cohort_id',
    'designated_cohort_sha256',
    'privacy_attestation_artifact_record',
    'parent_preparation_approval_instance_digest',
  ]),
  manifest_freeze: Object.freeze([
    ...COMMON_INTENT_KEYS,
    'final_freeze_subject_commit',
    'final_freeze_subject_digest_domain',
    'final_freeze_subject_digest',
    'final_freeze_subject_artifact_records',
    'parent_designation_approval_instance_digest',
  ]),
});

export function validateSingleDecisionArtifact(decisions) {
  if (!Array.isArray(decisions) || decisions.length === 0) {
    throw new Error('an approval event must contain exactly one decision artifact');
  }
  const kinds = decisions.map((entry) => decisionKindOf(entry));
  if (new Set(kinds).size !== 1) {
    throw new Error('mixed decision classes are forbidden');
  }
  if (decisions.length !== 1) {
    throw new Error('an approval event must contain exactly one decision artifact');
  }
  return kinds[0];
}

function decisionKindOf(intent) {
  assertPlainObject(intent, 'decision artifact');
  if (
    intent.decision_class === 'schema_definition' &&
    intent.decision_subclass === 'legacy_preparation_receipt_migration'
  ) {
    return 'legacy_receipt_migration';
  }
  if (intent.decision_class === 'cohort_designation') return 'cohort_designation';
  if (intent.decision_class === 'manifest_freeze') return 'manifest_freeze';
  if (intent.decision_class === 'receipt_materialization') return 'receipt_materialization';
  throw new Error(`unknown or mixed decision class ${JSON.stringify(intent.decision_class)}`);
}

export function validateDecisionIntent(intent, {
  policy,
  observedSubjectArtifactRecords,
  observedPolicyArtifactRecord,
  historicalEventProjection,
  privacyAttestation,
  observedPrivacyAttestationArtifactRecord,
} = {}) {
  const kind = decisionKindOf(intent);
  if (kind === 'receipt_materialization') return validateReceiptMaterializationDecision(intent);
  const validatedPolicy = validateGovernancePolicy(policy);
  if (!observedPolicyArtifactRecord) {
    throw new Error('trusted observed validity policy artifact record is required');
  }
  if (!observedSubjectArtifactRecords) {
    throw new Error('trusted observed subject artifact records are required');
  }
  assertExactKeys(intent, INTENT_KEYS[kind], `${kind} intent`);
  assertLiteral(
    intent.schema_version,
    'mobile-ux-batch1-decision-intent.v1',
    `${kind} intent.schema_version`,
  );
  assertLiteral(intent.decision_id, DECISION_ID[kind], `${kind} intent.decision_id`);
  if (kind === 'legacy_receipt_migration') {
    assertLiteral(intent.decision_class, 'schema_definition', 'legacy intent.decision_class');
    assertLiteral(
      intent.decision_subclass,
      'legacy_preparation_receipt_migration',
      'legacy intent.decision_subclass',
    );
  } else {
    assertLiteral(intent.decision_class, kind, `${kind} intent.decision_class`);
  }
  assertLiteral(intent.contract_version, 'v1', `${kind} intent.contract_version`);
  assertLiteral(intent.repository, TRUSTED_IDENTITY.repository, `${kind} intent.repository`);
  assertLiteral(intent.repository_id, TRUSTED_IDENTITY.repositoryId, `${kind} intent.repository_id`);
  assertSafeInteger(intent.pull_request, `${kind} intent.pull_request`, {minimum: 1});
  assertLiteral(intent.intent_artifact_path, INTENT_PATH[kind], `${kind} intent.intent_artifact_path`);
  validateArtifactRecord(intent.validity_policy_artifact_record, {
    path: ARTIFACT_PATHS.governancePolicy,
    observedRecord: observedPolicyArtifactRecord ?? intent.validity_policy_artifact_record,
    label: `${kind} intent.validity_policy_artifact_record`,
  });
  assertLiteral(intent.gate_effect, GATE_EFFECT[kind], `${kind} intent.gate_effect`);
  validateAuthorityMask(intent.authority, kind);
  assertLiteral(intent.allowed_next_action, NEXT_ACTION[kind], `${kind} intent.allowed_next_action`);
  assertExactArray(intent.non_claims, NON_CLAIMS[kind], `${kind} intent.non_claims`);
  assertUtcTimestamp(intent.expires_at, `${kind} intent.expires_at`);
  assertExactArray(
    intent.invalidation_conditions,
    validatedPolicy.class_policies[kind].ordered_invalidation_condition_ids,
    `${kind} intent.invalidation_conditions`,
  );

  if (kind === 'legacy_receipt_migration') {
    const subject = validateHistoricalSubject(validateSubjectBinding(
      {
        commit: intent.historical_subject_commit,
        digest_domain: intent.historical_subject_digest_domain,
        digest: intent.historical_subject_digest,
        artifact_records: intent.historical_subject_artifact_records,
      },
      {kind, observedArtifactRecords: observedSubjectArtifactRecords},
    ));
    const historicalEvent = validateHistoricalPreparationEventProjection(
      historicalEventProjection,
    );
    const historicalApprovalInstanceDigest =
      computeHistoricalPreparationApprovalInstanceDigest(
        historicalPreparationApprovalBinding(
          subject,
          historicalEvent.authority_event_sha256,
        ),
      );
    assertLiteral(
      intent.historical_approval_instance_digest,
      historicalApprovalInstanceDigest,
      'legacy intent historical approval instance digest',
    );
    assertLiteral(
      intent.materialized_preparation_receipt_path,
      ARTIFACT_PATHS.legacyPreparationReceipt,
      'legacy intent.materialized_preparation_receipt_path',
    );
    return Object.freeze({
      kind,
      subject,
      historical_event: historicalEvent.event,
      historical_approval_instance_digest: historicalApprovalInstanceDigest,
      intent,
    });
  }

  const subject = validateSubjectBinding(
    kind === 'cohort_designation'
      ? {
          commit: intent.designation_subject_commit,
          digest_domain: intent.designation_subject_digest_domain,
          digest: intent.designation_subject_digest,
          artifact_records: intent.designation_subject_artifact_records,
        }
      : {
          commit: intent.final_freeze_subject_commit,
          digest_domain: intent.final_freeze_subject_digest_domain,
          digest: intent.final_freeze_subject_digest,
          artifact_records: intent.final_freeze_subject_artifact_records,
        },
    {kind, observedArtifactRecords: observedSubjectArtifactRecords},
  );

  if (kind === 'cohort_designation') {
    assertDesignatedCohortId(intent.designated_cohort_id);
    assertSha256(intent.designated_cohort_sha256, 'cohort intent.designated_cohort_sha256');
    const recomputed = computeDesignatedCohortDigest({
      subject_commit: subject.commit,
      subject_digest_domain: subject.digest_domain,
      subject_digest: subject.digest,
      designated_cohort_id: intent.designated_cohort_id,
    });
    if (intent.designated_cohort_sha256 !== recomputed) {
      throw new Error('cohort intent designated cohort digest drift');
    }
    validateArtifactRecord(intent.privacy_attestation_artifact_record, {
      path: ARTIFACT_PATHS.cohortNonPiiAttestation,
      observedRecord: (() => {
        if (!observedPrivacyAttestationArtifactRecord) {
          throw new Error('trusted observed non-PII attestation artifact record is required');
        }
        return observedPrivacyAttestationArtifactRecord;
      })(),
      label: 'cohort intent.privacy_attestation_artifact_record',
    });
    validatePrivacyAttestation(privacyAttestation, {
      subject,
      designatedCohortId: intent.designated_cohort_id,
      designatedCohortSha256: intent.designated_cohort_sha256,
    });
    assertSha256(
      intent.parent_preparation_approval_instance_digest,
      'cohort intent.parent_preparation_approval_instance_digest',
    );
  } else {
    assertSha256(
      intent.parent_designation_approval_instance_digest,
      'manifest intent.parent_designation_approval_instance_digest',
    );
  }
  return Object.freeze({kind, subject, intent});
}

export const PARENT_TUPLE_FIELDS = Object.freeze([
  'parent_decision_id',
  'parent_decision_class',
  'parent_approval_target_head_sha',
  'parent_receipt_materialization_commit_sha',
  'parent_receipt_materialization_pull_request',
  'parent_decision_artifact_path',
  'parent_decision_artifact_raw_sha256',
  'parent_receipt_path',
  'parent_receipt_raw_sha256',
  'parent_subject_commit',
  'parent_subject_digest_domain',
  'parent_subject_digest',
  'parent_repository_id',
  'parent_workflow_id',
  'parent_workflow_run_id',
  'parent_run_attempt',
  'parent_deployment_id',
  'parent_deployment_waiting_status_id',
  'parent_deployment_success_status_id',
  'parent_environment_id',
  'parent_environment_name',
  'parent_approval_review_sha256',
  'parent_reviewer_immutable_id',
  'parent_validity_anchor_at',
  'parent_success_observed_at',
  'parent_approval_instance_digest',
]);

export function validateParentTuple(tuple, {expectedTuple} = {}) {
  assertExactKeys(tuple, PARENT_TUPLE_FIELDS, 'parent approval tuple');
  assertString(tuple.parent_decision_id, 'parent tuple.parent_decision_id');
  if (!['schema_definition', 'cohort_designation', 'manifest_freeze'].includes(tuple.parent_decision_class)) {
    throw new Error('parent tuple.parent_decision_class is unknown');
  }
  assertCommitSha(tuple.parent_approval_target_head_sha, 'parent tuple approval target head');
  assertCommitSha(
    tuple.parent_receipt_materialization_commit_sha,
    'parent tuple receipt materialization commit',
  );
  assertSafeInteger(
    tuple.parent_receipt_materialization_pull_request,
    'parent tuple receipt materialization pull request',
    {minimum: 1},
  );
  assertSafeRepositoryPath(tuple.parent_decision_artifact_path, 'parent tuple decision artifact path');
  assertSha256(tuple.parent_decision_artifact_raw_sha256, 'parent tuple decision artifact digest');
  assertSafeRepositoryPath(tuple.parent_receipt_path, 'parent tuple receipt path');
  assertSha256(tuple.parent_receipt_raw_sha256, 'parent tuple receipt digest');
  assertCommitSha(tuple.parent_subject_commit, 'parent tuple subject commit');
  assertString(tuple.parent_subject_digest_domain, 'parent tuple subject digest domain');
  assertSha256(tuple.parent_subject_digest, 'parent tuple subject digest');
  assertLiteral(tuple.parent_repository_id, TRUSTED_IDENTITY.repositoryId, 'parent tuple repository id');
  assertLiteral(tuple.parent_workflow_id, TRUSTED_IDENTITY.workflowId, 'parent tuple workflow id');
  for (const field of [
    'parent_workflow_run_id',
    'parent_run_attempt',
    'parent_deployment_id',
    'parent_deployment_waiting_status_id',
    'parent_deployment_success_status_id',
  ]) {
    assertSafeInteger(tuple[field], `parent tuple.${field}`, {minimum: 1});
  }
  assertLiteral(tuple.parent_environment_id, TRUSTED_IDENTITY.environmentId, 'parent tuple environment id');
  assertLiteral(
    tuple.parent_environment_name,
    TRUSTED_IDENTITY.environmentName,
    'parent tuple environment name',
  );
  assertSha256(tuple.parent_approval_review_sha256, 'parent tuple approval review digest');
  assertLiteral(
    tuple.parent_reviewer_immutable_id,
    TRUSTED_IDENTITY.reviewerImmutableId,
    'parent tuple reviewer',
  );
  assertUtcTimestamp(tuple.parent_validity_anchor_at, 'parent tuple validity anchor');
  assertUtcTimestamp(tuple.parent_success_observed_at, 'parent tuple success observed time');
  if (Date.parse(tuple.parent_validity_anchor_at) >= Date.parse(tuple.parent_success_observed_at)) {
    throw new Error('parent tuple validity anchor must precede success observed time');
  }
  assertSha256(tuple.parent_approval_instance_digest, 'parent tuple approval instance digest');
  if (expectedTuple) assertCanonicalEqual(tuple, expectedTuple, 'parent approval tuple');
  return tuple;
}

const RECEIPT_COMMON_FIELDS = Object.freeze([
  'schema_version',
  'decision_id',
  'decision_class',
  'contract_version',
  'repository',
  'repository_id',
  'pull_request',
  'receipt_materialization_pull_request',
  'approval_target_head_sha',
  'decision_artifact_path',
  'decision_artifact_raw_sha256',
  'subject_commit',
  'subject_digest_domain',
  'subject_digest',
  'validity_policy_artifact_record',
  'workflow_path',
  'workflow_id',
  'trusted_base_sha',
  'workflow_run_id',
  'run_attempt',
  'workflow_conclusion',
  'deployment_id',
  'deployment_waiting_status_id',
  'deployment_success_status_id',
  'environment_id',
  'environment_name',
  'approval_review_sha256',
  'reviewer_immutable_id',
  'validity_anchor_at',
  'success_observed_at',
  'protected_authority_event_ref',
  'authority_event_sha256',
  'parent_approval_tuple',
  'gate_effect',
  'authority',
  'allowed_next_action',
  'non_claims',
  'expires_at',
  'invalidation_conditions',
]);

const RECEIPT_FIELDS = Object.freeze({
  legacy_receipt_migration: Object.freeze([
    ...RECEIPT_COMMON_FIELDS,
    'decision_subclass',
    'historical_approval_instance_digest',
    'materialized_preparation_receipt_path',
    'approval_instance_digest',
  ]),
  cohort_designation: Object.freeze([
    ...RECEIPT_COMMON_FIELDS,
    'designated_cohort_id',
    'designated_cohort_sha256',
    'privacy_attestation_artifact_record',
    'privacy_attestation_authority_event_sha256',
    'parent_preparation_approval_instance_digest',
    'approval_instance_digest',
  ]),
  manifest_freeze: Object.freeze([
    ...RECEIPT_COMMON_FIELDS,
    'parent_designation_approval_instance_digest',
    'approval_instance_digest',
  ]),
});

export function computeApprovalInstanceDigest(receipt) {
  const kind = decisionKindOf(receipt);
  if (kind === 'receipt_materialization') {
    throw new Error('receipt materialization is not an approval receipt');
  }
  assertExactKeys(receipt, RECEIPT_FIELDS[kind], `${kind} approval receipt`);
  const fields = RECEIPT_FIELDS[kind].filter((field) => field !== 'approval_instance_digest');
  return domainSeparatedDigest(
    DOMAIN.approvalInstance,
    fields.map((field) => [field, receipt[field]]),
  );
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

export function validateApprovalReceipt(receipt, {
  intent,
  eventProjection,
  decisionArtifactRawSha256,
  parentApprovalTuple = null,
  policy,
  now,
  receiptMaterializationPullRequest,
} = {}) {
  const intentKind = decisionKindOf(intent);
  if (intentKind === 'receipt_materialization') throw new Error('materialization request cannot have an approval receipt');
  const kind = decisionKindOf(receipt);
  if (kind !== intentKind) throw new Error('approval receipt decision class does not match intent');
  validateGovernancePolicy(policy);
  assertExactKeys(receipt, RECEIPT_FIELDS[kind], `${kind} approval receipt`);
  assertLiteral(
    receipt.schema_version,
    'mobile-ux-batch1-approval-receipt.v2',
    `${kind} receipt.schema_version`,
  );
  assertLiteral(receipt.decision_id, intent.decision_id, `${kind} receipt.decision_id`);
  assertLiteral(receipt.decision_class, intent.decision_class, `${kind} receipt.decision_class`);
  if (kind === 'legacy_receipt_migration') {
    assertLiteral(receipt.decision_subclass, intent.decision_subclass, 'legacy receipt decision_subclass');
  }
  assertLiteral(receipt.contract_version, intent.contract_version, `${kind} receipt.contract_version`);
  assertLiteral(receipt.repository, intent.repository, `${kind} receipt.repository`);
  assertLiteral(receipt.repository_id, intent.repository_id, `${kind} receipt.repository_id`);
  assertLiteral(receipt.pull_request, intent.pull_request, `${kind} receipt.pull_request`);
  assertSafeInteger(
    receipt.receipt_materialization_pull_request,
    `${kind} receipt.receipt_materialization_pull_request`,
    {minimum: 1},
  );
  if (receipt.receipt_materialization_pull_request === intent.pull_request) {
    throw new Error(`${kind} receipt materialization pull request must differ from its intent pull request`);
  }
  if (receiptMaterializationPullRequest !== undefined) {
    assertSafeInteger(
      receiptMaterializationPullRequest,
      `${kind} trusted receipt materialization pull request`,
      {minimum: 1},
    );
    assertLiteral(
      receipt.receipt_materialization_pull_request,
      receiptMaterializationPullRequest,
      `${kind} receipt materialization pull request binding`,
    );
  }
  assertLiteral(receipt.decision_artifact_path, INTENT_PATH[kind], `${kind} receipt decision path`);
  assertSha256(decisionArtifactRawSha256, `${kind} decision artifact raw digest`);
  assertLiteral(
    receipt.decision_artifact_raw_sha256,
    decisionArtifactRawSha256,
    `${kind} receipt decision artifact raw digest`,
  );
  const subject = subjectFromIntent(intent, kind);
  assertLiteral(receipt.subject_commit, subject.commit, `${kind} receipt.subject_commit`);
  assertLiteral(
    receipt.subject_digest_domain,
    subject.digest_domain,
    `${kind} receipt.subject_digest_domain`,
  );
  assertLiteral(receipt.subject_digest, subject.digest, `${kind} receipt.subject_digest`);
  assertCanonicalEqual(
    receipt.validity_policy_artifact_record,
    intent.validity_policy_artifact_record,
    `${kind} receipt validity policy binding`,
  );

  const projected = eventProjection?.event ?? eventProjection;
  if (!projected) throw new Error('verified GitHub event projection is required');
  validateAuthorityEventProjection(projected);
  const eventBindings = {
    approval_target_head_sha: 'approval_target_head_sha',
    workflow_path: 'workflow_path',
    workflow_id: 'workflow_id',
    trusted_base_sha: 'pull_request_base_sha',
    workflow_run_id: 'workflow_run_id',
    run_attempt: 'run_attempt',
    workflow_conclusion: 'workflow_conclusion',
    deployment_id: 'deployment_id',
    deployment_waiting_status_id: 'deployment_waiting_status_id',
    deployment_success_status_id: 'deployment_success_status_id',
    environment_id: 'environment_id',
    environment_name: 'environment_name',
    approval_review_sha256: 'approval_review_sha256',
    reviewer_immutable_id: 'reviewer_immutable_id',
    validity_anchor_at: 'validity_anchor_at',
    success_observed_at: 'success_observed_at',
  };
  assertLiteral(projected.repository_full_name, receipt.repository, 'event repository binding');
  assertLiteral(projected.repository_id, receipt.repository_id, 'event repository id binding');
  assertLiteral(projected.pull_request_number, receipt.pull_request, 'event pull request binding');
  for (const [receiptField, eventField] of Object.entries(eventBindings)) {
    assertLiteral(receipt[receiptField], projected[eventField], `${kind} receipt.${receiptField}`);
  }
  assertLiteral(
    receipt.protected_authority_event_ref,
    protectedAuthorityEventRef(projected),
    `${kind} receipt protected event ref`,
  );
  const authorityEventSha256 = computeAuthorityEventDigest(projected);
  assertLiteral(
    receipt.authority_event_sha256,
    authorityEventSha256,
    `${kind} receipt authority event digest`,
  );
  if (eventProjection?.protected_authority_event_ref) {
    assertLiteral(
      eventProjection.protected_authority_event_ref,
      protectedAuthorityEventRef(projected),
      `${kind} injected protected event ref`,
    );
  }

  assertLiteral(receipt.gate_effect, intent.gate_effect, `${kind} receipt.gate_effect`);
  assertCanonicalEqual(receipt.authority, intent.authority, `${kind} receipt.authority`);
  validateAuthorityMask(receipt.authority, kind);
  assertLiteral(
    receipt.allowed_next_action,
    intent.allowed_next_action,
    `${kind} receipt.allowed_next_action`,
  );
  assertCanonicalEqual(receipt.non_claims, intent.non_claims, `${kind} receipt.non_claims`);
  assertLiteral(receipt.expires_at, intent.expires_at, `${kind} receipt.expires_at`);
  assertCanonicalEqual(
    receipt.invalidation_conditions,
    intent.invalidation_conditions,
    `${kind} receipt.invalidation_conditions`,
  );

  if (kind === 'legacy_receipt_migration') {
    assertLiteral(
      receipt.historical_approval_instance_digest,
      intent.historical_approval_instance_digest,
      'legacy receipt historical approval digest',
    );
    assertLiteral(
      receipt.materialized_preparation_receipt_path,
      intent.materialized_preparation_receipt_path,
      'legacy receipt materialized preparation path',
    );
    if (receipt.parent_approval_tuple !== null || parentApprovalTuple !== null) {
      throw new Error('legacy receipt migration is a root decision and parent tuple must be null');
    }
  } else {
    if (parentApprovalTuple === null) {
      throw new Error(`${kind} receipt requires a verified full parent approval tuple`);
    }
    validateParentTuple(receipt.parent_approval_tuple, {expectedTuple: parentApprovalTuple});
    if (kind === 'cohort_designation') {
      for (const field of [
        'designated_cohort_id',
        'designated_cohort_sha256',
        'privacy_attestation_artifact_record',
        'parent_preparation_approval_instance_digest',
      ]) {
        assertCanonicalEqual(receipt[field], intent[field], `cohort receipt.${field}`);
      }
      assertLiteral(
        receipt.privacy_attestation_authority_event_sha256,
        receipt.authority_event_sha256,
        'cohort receipt privacy attestation authority event binding',
      );
      assertLiteral(
        receipt.parent_preparation_approval_instance_digest,
        receipt.parent_approval_tuple.parent_approval_instance_digest,
        'cohort receipt parent digest binding',
      );
    } else {
      assertLiteral(
        receipt.parent_designation_approval_instance_digest,
        intent.parent_designation_approval_instance_digest,
        'manifest receipt parent digest',
      );
      assertLiteral(
        receipt.parent_designation_approval_instance_digest,
        receipt.parent_approval_tuple.parent_approval_instance_digest,
        'manifest receipt parent tuple binding',
      );
    }
  }

  validateReceiptTimeBounds(receipt, kind, policy, now);
  const digest = computeApprovalInstanceDigest(receipt);
  assertLiteral(receipt.approval_instance_digest, digest, `${kind} receipt approval instance digest`);
  return Object.freeze({kind, approval_instance_digest: digest, receipt});
}

function validateReceiptTimeBounds(receipt, kind, policy, now) {
  assertUtcTimestamp(receipt.validity_anchor_at, `${kind} receipt.validity_anchor_at`);
  assertUtcTimestamp(receipt.success_observed_at, `${kind} receipt.success_observed_at`);
  assertUtcTimestamp(receipt.expires_at, `${kind} receipt.expires_at`);
  const anchorMs = Date.parse(receipt.validity_anchor_at);
  const successMs = Date.parse(receipt.success_observed_at);
  const expiresMs = Date.parse(receipt.expires_at);
  if (!(anchorMs < successMs)) throw new Error(`${kind} validity anchor must precede success`);
  if (!(successMs < expiresMs)) throw new Error(`${kind} receipt must expire after success was observed`);
  const ceilingMs = policy.class_policies[kind].max_validity_seconds * 1000;
  if (expiresMs - anchorMs > ceilingMs) throw new Error(`${kind} receipt exceeds its TTL ceiling`);
  if (expiresMs - anchorMs > PROVIDER_STATUS_RETENTION_SECONDS * 1000) {
    throw new Error(`${kind} receipt exceeds GitHub status retention`);
  }
  if (now !== undefined) {
    assertUtcTimestamp(now, 'use time');
    if (Date.parse(now) >= expiresMs) throw new Error(`${kind} receipt is expired at use time`);
  }
}

export function evaluateReceiptValidity(receipt, {
  policy,
  now,
  conditionResults,
  refreshedEventProjection,
} = {}) {
  const kind = decisionKindOf(receipt);
  if (kind === 'receipt_materialization') throw new Error('materialization request has no receipt validity');
  validateGovernancePolicy(policy);
  if (now === undefined) throw new Error('use time is required for receipt validity evaluation');
  validateReceiptTimeBounds(receipt, kind, policy, now);
  assertExactArray(
    receipt.invalidation_conditions,
    policy.class_policies[kind].ordered_invalidation_condition_ids,
    `${kind} receipt invalidation conditions`,
  );
  assertExactKeys(
    conditionResults,
    receipt.invalidation_conditions,
    `${kind} invalidation condition results`,
  );
  for (const conditionId of receipt.invalidation_conditions) {
    if (!KNOWN_INVALIDATION_CONDITIONS.has(conditionId)) {
      throw new Error(`unknown invalidation condition ${conditionId}`);
    }
    assertBoolean(conditionResults[conditionId], `invalidation condition ${conditionId}`);
    if (conditionResults[conditionId]) throw new Error(`receipt invalidated by ${conditionId}`);
  }
  const refreshed = refreshedEventProjection?.event ?? refreshedEventProjection;
  if (!refreshed) throw new Error('refreshed remote event projection is required at every use');
  validateAuthorityEventProjection(refreshed);
  const refreshedDigest = computeAuthorityEventDigest(refreshed);
  if (refreshedDigest !== receipt.authority_event_sha256) {
    throw new Error('refreshed authority event digest drift');
  }
  return Object.freeze({valid: true, kind, evaluated_at: now});
}

export const LEGACY_PREPARATION_RECEIPT_FIELDS = Object.freeze([
  'schema_version',
  'decision_id',
  'decision_class',
  'contract_version',
  'repository',
  'repository_id',
  'receipt_materialization_pull_request',
  'receipt_path',
  'historical_preapproval_intent_status',
  'historical_approval_target_head_sha',
  'subject_commit',
  'subject_digest_domain',
  'subject_digest',
  'historical_authority_event_sha256',
  'historical_approval_instance_digest',
  'migration_approval_receipt_artifact_record',
  'migration_receipt_materialization_commit_sha',
  'migration_approval_instance_digest',
  'parent_approval_tuple',
  'gate_effect',
  'authority',
  'allowed_next_action',
  'expires_at',
  'approval_instance_digest',
]);

function validateLegacyPreparationReceiptShape(receipt) {
  assertExactKeys(
    receipt,
    LEGACY_PREPARATION_RECEIPT_FIELDS,
    'legacy preparation approval receipt',
  );
  assertLiteral(
    receipt.schema_version,
    'mobile-ux-batch1-legacy-preparation-approval-receipt.v1',
    'legacy preparation receipt.schema_version',
  );
  assertLiteral(
    receipt.decision_id,
    HISTORICAL_PREPARATION.decisionId,
    'legacy preparation receipt.decision_id',
  );
  assertLiteral(
    receipt.decision_class,
    HISTORICAL_PREPARATION.decisionClass,
    'legacy preparation receipt.decision_class',
  );
  assertLiteral(receipt.contract_version, 'v1', 'legacy preparation receipt.contract_version');
  assertLiteral(
    receipt.repository,
    TRUSTED_IDENTITY.repository,
    'legacy preparation receipt.repository',
  );
  assertLiteral(
    receipt.repository_id,
    TRUSTED_IDENTITY.repositoryId,
    'legacy preparation receipt.repository_id',
  );
  assertSafeInteger(
    receipt.receipt_materialization_pull_request,
    'legacy preparation receipt.receipt_materialization_pull_request',
    {minimum: 1},
  );
  assertLiteral(
    receipt.receipt_path,
    ARTIFACT_PATHS.legacyPreparationReceipt,
    'legacy preparation receipt.receipt_path',
  );
  assertLiteral(
    receipt.historical_preapproval_intent_status,
    HISTORICAL_PREPARATION.preapprovalIntentStatus,
    'legacy preparation receipt historical intent status',
  );
  assertLiteral(
    receipt.historical_approval_target_head_sha,
    HISTORICAL_PREPARATION.approvalTargetHeadSha,
    'legacy preparation receipt historical approval target head',
  );
  assertLiteral(
    receipt.subject_commit,
    HISTORICAL_PREPARATION.approvalTargetHeadSha,
    'legacy preparation receipt subject commit',
  );
  assertLiteral(
    receipt.subject_digest_domain,
    HISTORICAL_PREPARATION.subjectDigestDomain,
    'legacy preparation receipt subject digest domain',
  );
  assertLiteral(
    receipt.subject_digest,
    HISTORICAL_PREPARATION.subjectDigest,
    'legacy preparation receipt subject digest',
  );
  assertLiteral(
    receipt.historical_authority_event_sha256,
    HISTORICAL_PREPARATION.authorityEventSha256,
    'legacy preparation receipt historical authority event digest',
  );
  const historicalApprovalInstanceDigest =
    computeHistoricalPreparationApprovalInstanceDigest(
      historicalPreparationApprovalBinding(
        {
          digest_domain: receipt.subject_digest_domain,
          digest: receipt.subject_digest,
        },
        receipt.historical_authority_event_sha256,
      ),
    );
  assertLiteral(
    receipt.historical_approval_instance_digest,
    historicalApprovalInstanceDigest,
    'legacy preparation receipt historical approval instance digest',
  );
  validateArtifactRecord(receipt.migration_approval_receipt_artifact_record, {
    path: ARTIFACT_PATHS.legacyMigrationReceipt,
    label: 'legacy preparation receipt migration approval receipt artifact record',
  });
  assertCommitSha(
    receipt.migration_receipt_materialization_commit_sha,
    'legacy preparation receipt migration receipt materialization commit',
  );
  assertSha256(
    receipt.migration_approval_instance_digest,
    'legacy preparation receipt migration approval instance digest',
  );
  if (receipt.parent_approval_tuple !== null) {
    throw new Error('legacy preparation receipt is a root approval and parent tuple must be null');
  }
  assertLiteral(
    receipt.gate_effect,
    HISTORICAL_PREPARATION.gateEffect,
    'legacy preparation receipt gate effect',
  );
  validateAuthorityMask(receipt.authority, 'legacy_receipt_migration');
  assertLiteral(
    receipt.allowed_next_action,
    HISTORICAL_PREPARATION.allowedNextAction,
    'legacy preparation receipt allowed next action',
  );
  assertUtcTimestamp(receipt.expires_at, 'legacy preparation receipt.expires_at');
  assertSha256(
    receipt.approval_instance_digest,
    'legacy preparation receipt approval instance digest',
  );
  return Object.freeze({historicalApprovalInstanceDigest, receipt});
}

export function computeLegacyPreparationReceiptDigest(receipt) {
  validateLegacyPreparationReceiptShape(receipt);
  return domainSeparatedDigest(
    DOMAIN.legacyPreparationReceipt,
    LEGACY_PREPARATION_RECEIPT_FIELDS
      .filter((field) => field !== 'approval_instance_digest')
      .map((field) => [field, receipt[field]]),
  );
}

export const computeLegacyPreparationApprovalInstanceDigest =
  computeLegacyPreparationReceiptDigest;

function authorityEventFromProjection(eventProjection, label) {
  const event = eventProjection?.event ?? eventProjection;
  if (!event) throw new Error(`${label} is required`);
  validateAuthorityEventProjection(event);
  const digest = computeAuthorityEventDigest(event);
  if (eventProjection?.authority_event_sha256 !== undefined) {
    assertLiteral(
      eventProjection.authority_event_sha256,
      digest,
      `${label} injected authority event digest`,
    );
  }
  return Object.freeze({event, authority_event_sha256: digest});
}

const DISTINCT_LEGACY_EVENT_CHAIN_FIELDS = Object.freeze([
  'pull_request_number',
  'approval_target_head_sha',
  'workflow_run_id',
  'deployment_id',
  'deployment_waiting_status_id',
  'deployment_success_status_id',
  'approval_review_sha256',
]);

function assertDistinctLegacyEventChains(historicalEvent, migrationEvent) {
  for (const field of DISTINCT_LEGACY_EVENT_CHAIN_FIELDS) {
    if (historicalEvent[field] === migrationEvent[field]) {
      throw new Error(`historical and migration event chains must have distinct ${field}`);
    }
  }
  if (computeAuthorityEventDigest(historicalEvent) === computeAuthorityEventDigest(migrationEvent)) {
    throw new Error('historical and migration authority event digests must differ');
  }
}

export function validateLegacyPreparationReceipt(receipt, {
  migrationIntent,
  migrationApprovalReceipt,
  migrationApprovalEventProjection,
  refreshedMigrationEventProjection,
  historicalEventProjection,
  refreshedHistoricalEventProjection,
  migrationDecisionArtifactRawSha256,
  migrationReceiptMaterializationCommitSha,
  observedPolicyArtifactRecord,
  observedHistoricalSubjectArtifactRecords,
  observedMigrationApprovalReceiptArtifactRecord,
  policy,
  now,
  migrationConditionResults,
  receiptMaterializationPullRequest,
} = {}) {
  validateGovernancePolicy(policy);
  if (now === undefined) throw new Error('use time is required for legacy preparation receipt');
  assertUtcTimestamp(now, 'legacy preparation receipt use time');

  const historical = validateHistoricalPreparationEventProjection(historicalEventProjection);
  const refreshedHistorical = validateHistoricalPreparationEventProjection(
    refreshedHistoricalEventProjection,
  );
  assertLiteral(
    refreshedHistorical.authority_event_sha256,
    historical.authority_event_sha256,
    'refreshed historical authority event digest',
  );

  const validatedIntent = validateDecisionIntent(migrationIntent, {
    policy,
    observedPolicyArtifactRecord,
    observedSubjectArtifactRecords: observedHistoricalSubjectArtifactRecords,
    historicalEventProjection: historical,
  });
  if (validatedIntent.kind !== 'legacy_receipt_migration') {
    throw new Error('legacy preparation receipt requires the migration decision intent');
  }
  const migration = authorityEventFromProjection(
    migrationApprovalEventProjection,
    'migration approval event projection',
  );
  assertDistinctLegacyEventChains(historical.event, migration.event);
  const validatedMigrationReceipt = validateApprovalReceipt(migrationApprovalReceipt, {
    intent: migrationIntent,
    eventProjection: migration,
    decisionArtifactRawSha256: migrationDecisionArtifactRawSha256,
    parentApprovalTuple: null,
    policy,
    now,
  });
  evaluateReceiptValidity(migrationApprovalReceipt, {
    policy,
    now,
    conditionResults: migrationConditionResults,
    refreshedEventProjection: refreshedMigrationEventProjection,
  });
  const refreshedMigration = authorityEventFromProjection(
    refreshedMigrationEventProjection,
    'refreshed migration event projection',
  );
  assertLiteral(
    refreshedMigration.authority_event_sha256,
    migration.authority_event_sha256,
    'refreshed migration authority event digest',
  );
  assertDistinctLegacyEventChains(refreshedHistorical.event, refreshedMigration.event);

  const historicalRetentionExpiresAt =
    Date.parse(historical.event.validity_anchor_at) + PROVIDER_STATUS_RETENTION_SECONDS * 1000;
  if (Date.parse(now) >= historicalRetentionExpiresAt) {
    throw new Error('historical preparation event chain is outside provider retention at use time');
  }

  const shaped = validateLegacyPreparationReceiptShape(receipt);
  if (receipt.receipt_materialization_pull_request === migrationIntent.pull_request) {
    throw new Error('legacy preparation receipt materialization pull request must differ from migration intent pull request');
  }
  if (
    receipt.receipt_materialization_pull_request ===
    migrationApprovalReceipt.receipt_materialization_pull_request
  ) {
    throw new Error('legacy preparation and migration receipt materialization pull requests must differ');
  }
  if (receiptMaterializationPullRequest !== undefined) {
    assertSafeInteger(
      receiptMaterializationPullRequest,
      'trusted legacy preparation receipt materialization pull request',
      {minimum: 1},
    );
    assertLiteral(
      receipt.receipt_materialization_pull_request,
      receiptMaterializationPullRequest,
      'legacy preparation receipt materialization pull request binding',
    );
  }
  assertLiteral(
    receipt.historical_authority_event_sha256,
    historical.authority_event_sha256,
    'legacy preparation receipt historical event binding',
  );
  assertLiteral(
    receipt.historical_approval_instance_digest,
    validatedIntent.historical_approval_instance_digest,
    'legacy preparation receipt historical approval binding',
  );
  if (!observedMigrationApprovalReceiptArtifactRecord) {
    throw new Error('trusted observed migration approval receipt artifact record is required');
  }
  validateArtifactRecord(receipt.migration_approval_receipt_artifact_record, {
    path: ARTIFACT_PATHS.legacyMigrationReceipt,
    observedRecord: observedMigrationApprovalReceiptArtifactRecord,
    label: 'legacy preparation receipt migration approval receipt artifact record',
  });
  assertCommitSha(
    migrationReceiptMaterializationCommitSha,
    'trusted migration receipt materialization commit',
  );
  assertLiteral(
    receipt.migration_receipt_materialization_commit_sha,
    migrationReceiptMaterializationCommitSha,
    'legacy preparation receipt migration materialization commit binding',
  );
  if (
    migrationReceiptMaterializationCommitSha === migration.event.approval_target_head_sha ||
    migrationReceiptMaterializationCommitSha === historical.event.approval_target_head_sha
  ) {
    throw new Error('migration receipt materialization commit must be distinct from both approval heads');
  }
  assertLiteral(
    receipt.migration_approval_instance_digest,
    validatedMigrationReceipt.approval_instance_digest,
    'legacy preparation receipt migration approval instance binding',
  );

  const expiresMs = Date.parse(receipt.expires_at);
  const migrationExpiresMs = Date.parse(migrationApprovalReceipt.expires_at);
  if (expiresMs > migrationExpiresMs) {
    throw new Error('legacy preparation receipt expiry exceeds migration receipt expiry');
  }
  if (expiresMs > historicalRetentionExpiresAt) {
    throw new Error('legacy preparation receipt expiry exceeds historical provider retention');
  }
  if (Date.parse(now) >= expiresMs) {
    throw new Error('legacy preparation receipt is expired at use time');
  }
  if (
    expiresMs <= Date.parse(historical.event.success_observed_at) ||
    expiresMs <= Date.parse(migration.event.success_observed_at)
  ) {
    throw new Error('legacy preparation receipt must expire after both approval successes');
  }

  const digest = computeLegacyPreparationReceiptDigest(receipt);
  assertLiteral(
    receipt.approval_instance_digest,
    digest,
    'legacy preparation receipt approval instance digest',
  );
  return Object.freeze({
    valid: true,
    approval_instance_digest: digest,
    historical_authority_event_sha256: historical.authority_event_sha256,
    migration_authority_event_sha256: migration.authority_event_sha256,
    evaluated_at: now,
    receipt: shaped.receipt,
  });
}

export function buildLegacyPreparationParentTuple({
  receipt,
  migrationApprovalReceipt,
  historicalEventProjection,
  preparationReceiptArtifactRecord,
  observedPreparationReceiptArtifactRecord,
  preparationReceiptMaterializationCommitSha,
} = {}) {
  validateLegacyPreparationReceiptShape(receipt);
  const receiptDigest = computeLegacyPreparationReceiptDigest(receipt);
  assertLiteral(
    receipt.approval_instance_digest,
    receiptDigest,
    'legacy preparation parent receipt approval instance digest',
  );
  const historical = validateHistoricalPreparationEventProjection(historicalEventProjection);
  assertLiteral(
    receipt.historical_authority_event_sha256,
    historical.authority_event_sha256,
    'legacy preparation parent historical event binding',
  );
  if (!observedPreparationReceiptArtifactRecord) {
    throw new Error('trusted observed preparation receipt artifact record is required');
  }
  validateArtifactRecord(preparationReceiptArtifactRecord, {
    path: ARTIFACT_PATHS.legacyPreparationReceipt,
    observedRecord: observedPreparationReceiptArtifactRecord,
    label: 'legacy preparation parent receipt artifact record',
  });
  assertCommitSha(
    preparationReceiptMaterializationCommitSha,
    'legacy preparation receipt materialization commit',
  );
  if (
    preparationReceiptMaterializationCommitSha ===
    HISTORICAL_PREPARATION.approvalTargetHeadSha
  ) {
    throw new Error('preparation receipt materialization commit must descend from a later commit');
  }

  if (decisionKindOf(migrationApprovalReceipt) !== 'legacy_receipt_migration') {
    throw new Error('legacy preparation parent requires the legacy migration approval receipt');
  }
  const migrationApprovalInstanceDigest = computeApprovalInstanceDigest(migrationApprovalReceipt);
  assertLiteral(
    migrationApprovalReceipt.approval_instance_digest,
    migrationApprovalInstanceDigest,
    'legacy preparation parent migration receipt digest',
  );
  assertLiteral(
    receipt.migration_approval_instance_digest,
    migrationApprovalInstanceDigest,
    'legacy preparation parent migration approval binding',
  );
  assertLiteral(
    migrationApprovalReceipt.decision_artifact_path,
    ARTIFACT_PATHS.legacyMigrationIntent,
    'legacy preparation parent migration decision artifact path',
  );

  const event = historical.event;
  const tuple = {
    parent_decision_id: HISTORICAL_PREPARATION.decisionId,
    parent_decision_class: HISTORICAL_PREPARATION.decisionClass,
    parent_approval_target_head_sha: event.approval_target_head_sha,
    parent_receipt_materialization_commit_sha: preparationReceiptMaterializationCommitSha,
    parent_receipt_materialization_pull_request:
      receipt.receipt_materialization_pull_request,
    parent_decision_artifact_path: ARTIFACT_PATHS.legacyMigrationIntent,
    parent_decision_artifact_raw_sha256:
      migrationApprovalReceipt.decision_artifact_raw_sha256,
    parent_receipt_path: ARTIFACT_PATHS.legacyPreparationReceipt,
    parent_receipt_raw_sha256: preparationReceiptArtifactRecord.raw_sha256,
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
  validateParentTuple(tuple);
  return Object.freeze(tuple);
}

const MATERIALIZATION_KEYS = Object.freeze([
  'schema_version',
  'decision_id',
  'decision_class',
  'contract_version',
  'source_decision_kind',
  'source_decision_id',
  'source_approval_target_head_sha',
  'source_authority_event_sha256',
  'source_approval_instance_digest',
  'target_receipt_path',
  'gate_effect',
  'authority',
  'allowed_next_action',
  'non_claims',
]);

export function validateReceiptMaterializationDecision(decision) {
  assertExactKeys(decision, MATERIALIZATION_KEYS, 'receipt materialization decision');
  assertLiteral(
    decision.schema_version,
    'mobile-ux-batch1-receipt-materialization.v1',
    'receipt materialization.schema_version',
  );
  assertLiteral(
    decision.decision_id,
    DECISION_ID.receipt_materialization,
    'receipt materialization.decision_id',
  );
  assertLiteral(
    decision.decision_class,
    'receipt_materialization',
    'receipt materialization.decision_class',
  );
  assertLiteral(decision.contract_version, 'v1', 'receipt materialization.contract_version');
  assertDecisionKind(decision.source_decision_kind, {allowMaterialization: false});
  assertLiteral(
    decision.source_decision_id,
    DECISION_ID[decision.source_decision_kind],
    'receipt materialization.source_decision_id',
  );
  assertCommitSha(
    decision.source_approval_target_head_sha,
    'receipt materialization.source_approval_target_head_sha',
  );
  assertSha256(
    decision.source_authority_event_sha256,
    'receipt materialization.source_authority_event_sha256',
  );
  assertSha256(
    decision.source_approval_instance_digest,
    'receipt materialization.source_approval_instance_digest',
  );
  assertLiteral(
    decision.target_receipt_path,
    RECEIPT_PATH[decision.source_decision_kind],
    'receipt materialization.target_receipt_path',
  );
  assertLiteral(decision.gate_effect, GATE_EFFECT.receipt_materialization, 'materialization gate effect');
  validateAuthorityMask(decision.authority, 'receipt_materialization');
  assertLiteral(
    decision.allowed_next_action,
    NEXT_ACTION.receipt_materialization,
    'materialization allowed_next_action',
  );
  assertExactArray(
    decision.non_claims,
    NON_CLAIMS.receipt_materialization,
    'materialization non_claims',
  );
  return Object.freeze({kind: 'receipt_materialization', decision});
}

export const GOVERNANCE_CONTRACT = Object.freeze({
  schema_version: GOVERNANCE_SCHEMA_VERSION,
  trusted_identity: TRUSTED_IDENTITY,
  historical_preparation: HISTORICAL_PREPARATION,
  artifact_paths: ARTIFACT_PATHS,
  authority_keys: AUTHORITY_KEYS,
  decision_kinds: DECISION_KINDS,
  decision_ttl_ceilings_seconds: DECISION_TTL_CEILINGS_SECONDS,
  provider_status_retention_seconds: PROVIDER_STATUS_RETENTION_SECONDS,
  invalidation_conditions_by_kind: INVALIDATION_CONDITIONS_BY_KIND,
});
