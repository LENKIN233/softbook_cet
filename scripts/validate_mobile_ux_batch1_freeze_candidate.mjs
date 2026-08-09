#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {parseStrictJson} from './lib/strict_json.mjs';
import {
  EXECUTION_MANIFEST_ROOT,
  FREEZE_CANDIDATE_PATHS,
  MANIFEST_CATALOG_PATH,
  assertAuthorityObjectFalse,
  assertEqual,
  assertExpectedRepositoryHead,
  assertExactArray,
  assertExactKeys,
  assertNonEmptyString,
  assertPathAbsent,
  assertRecord,
  assertTrackedRegularHeadArtifact,
  domainSeparatedSubjectDigest,
  readRegularFile,
  readSemanticSource,
  scanAuthorityClaims,
  scanNoWildcard,
  sha256,
  validateManifestSchemaCatalog,
} from './lib/mobile_ux_batch1_manifest_contract.mjs';
import {
  CONTRACT_IDENTITY_SHA256,
  CONTRACT_RELATIVE_PATH,
  LEDGER_RELATIVE_PATH,
  parseContract,
  parseLedger,
} from './validate_state_evidence_ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_SET_PATH = FREEZE_CANDIDATE_PATHS[0];
const CHILDREN = Object.freeze([
  Object.freeze({
    checkpointId: 'CP-BA',
    path: FREEZE_CANDIDATE_PATHS[1],
    schemaPattern: /^mobile-ux-batch1-cp-ba-registry\.v2(?:\.proposal)?$/,
  }),
  Object.freeze({
    checkpointId: 'CP-CS',
    path: FREEZE_CANDIDATE_PATHS[2],
    schemaPattern: /^mobile-ux-batch1-cp-cs-registry\.v2(?:\.proposal)?$/,
  }),
  Object.freeze({
    checkpointId: 'CP-WEB',
    path: FREEZE_CANDIDATE_PATHS[3],
    schemaPattern: /^mobile-ux-batch1-cp-web-registry\.v2(?:\.proposal)?$/,
  }),
]);

const COMMON_CLASSIFICATION = 'implementation_hypothesis';
const COMMON_SUBJECT_CLASS = 'schema_definition_only';
const COMMON_CANDIDATE_STATUS = 'candidate_incomplete';
const COMMON_COVERAGE_EFFECT = 'none_pre_execution';

const GLOBAL_BLOCKERS = Object.freeze([
  'owner_exact_tier2_id_set_missing',
  'external_and_human_bindings_unresolved',
  'trusted_decision_authority_bootstrap_not_implemented',
  'r0_b2_materialization_validator_not_implemented',
  'protected_decision_validity_policy_and_evaluator_missing',
  'legacy_preparation_receipt_migration_authorization_missing',
  'protected_cohort_designation_missing',
  'post_designation_build_windows_and_compatibility_bindings_missing',
  'future_manifest_freeze_decision_missing',
  'exact_compatibility_keys_missing',
  'execution_manifest_subtree_must_remain_absent',
]);

const SUCCESSOR_TRANSITION_DIGEST_DOMAIN =
  'softbook-cet/mobile-ux-batch1-successor-transition/v1';
const SUCCESSOR_STAGE_IDS = Object.freeze([
  'R0_resolution_successor',
  'D1_protected_cohort_designation',
  'B2_post_designation_binding_successor',
  'F3_final_manifest_freeze_decision',
]);
const POST_DESIGNATION_REQUIREMENT_IDS_BY_KIND = Object.freeze({
  build: Object.freeze(['build-cp-ba-browser-documents']),
  execution_window: Object.freeze(['window-cp-ba', 'window-cp-cs', 'window-cp-web']),
  compatibility: Object.freeze([
    'compatibility-cp-ba-platform-browser',
    'compatibility-cp-ba-shared-formal',
    'compatibility-cp-ba-shared-managed',
    'compatibility-cp-cs-aggregate',
    'compatibility-cp-web-aggregate',
  ]),
});
const DESIGNATION_DECISION_INTENT_FIELDS = Object.freeze([
  'decision_id',
  'decision_class',
  'contract_version',
  'repository',
  'pull_request',
  'designation_subject_commit',
  'designation_subject_digest_domain',
  'designation_subject_digest',
  'designation_subject_artifact_records',
  'designated_cohort_id',
  'designated_cohort_sha256',
  'parent_preparation_approval_instance_digest',
  'gate_effect',
  'authority',
  'allowed_next_action',
  'non_claims',
  'expires_at',
  'invalidation_conditions',
]);
const FINAL_FREEZE_DECISION_INTENT_FIELDS = Object.freeze([
  'decision_id',
  'decision_class',
  'contract_version',
  'repository',
  'pull_request',
  'final_freeze_subject_commit',
  'final_freeze_subject_digest_domain',
  'final_freeze_subject_digest',
  'final_freeze_subject_artifact_records',
  'parent_designation_approval_instance_digest',
  'gate_effect',
  'authority',
  'allowed_next_action',
  'non_claims',
  'expires_at',
  'invalidation_conditions',
]);
const D1_NON_CLAIMS = Object.freeze([
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
]);
const F3_NON_CLAIMS = Object.freeze([
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
]);
const DECISION_AUTHORITY_MASK_KEYS = Object.freeze([
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
const LEGACY_CURRENT_AUTHORITY_KEYS = Object.freeze([
  'freeze',
  'provision',
  'execution',
  'evidence',
  'aggregation',
  'promotion',
  'visual',
  'implementation',
  'native',
  'release',
]);
const LEGACY_MISSING_AUTHORITY_KEYS = Object.freeze([
  'reservation_activation',
  'manifest_creation',
  'data_manifest_population',
  'architecture_acceptance',
  'checkpoint_coverage',
  'leadership_readiness',
]);
const CLI_AUTHORITY_NON_CLAIM =
  `NON-CLAIM: schema_definition_only authorizes none; all ${DECISION_AUTHORITY_MASK_KEYS.length} ` +
  `canonical authority dimensions remain false: ${DECISION_AUTHORITY_MASK_KEYS.join(', ')}`;
const D1_AUTHORITY_MASK = Object.freeze(
  Object.fromEntries(DECISION_AUTHORITY_MASK_KEYS.map((key) => [key, false])),
);
const F3_AUTHORITY_MASK = Object.freeze({
  ...D1_AUTHORITY_MASK,
  freeze: true,
  reservation_activation: true,
});
const COMPATIBILITY_DERIVATION_INPUT_FIELDS = Object.freeze([
  'designation_subject_commit',
  'designation_subject_digest_domain',
  'designation_subject_digest',
  'binding_bundle_digest',
  'compatibility_requirement_id',
]);
const COMPATIBILITY_OUTPUT_DEFINITIONS = Object.freeze([
  Object.freeze({
    requirementId: 'compatibility-cp-ba-platform-browser',
    outputId: 'compat-key-cp-ba-platform-browser-v1',
    domainSeparator: 'softbook-cet/mobile-ux-batch1-compatibility/cp-ba-platform-browser/v1',
  }),
  Object.freeze({
    requirementId: 'compatibility-cp-ba-shared-formal',
    outputId: 'compat-key-cp-ba-shared-formal-v1',
    domainSeparator: 'softbook-cet/mobile-ux-batch1-compatibility/cp-ba-shared-formal/v1',
  }),
  Object.freeze({
    requirementId: 'compatibility-cp-ba-shared-managed',
    outputId: 'compat-key-cp-ba-shared-managed-v1',
    domainSeparator: 'softbook-cet/mobile-ux-batch1-compatibility/cp-ba-shared-managed/v1',
  }),
  Object.freeze({
    requirementId: 'compatibility-cp-cs-aggregate',
    outputId: 'compat-key-cp-cs-aggregate-v1',
    domainSeparator: 'softbook-cet/mobile-ux-batch1-compatibility/cp-cs-aggregate/v1',
  }),
  Object.freeze({
    requirementId: 'compatibility-cp-web-aggregate',
    outputId: 'compat-key-cp-web-aggregate-v1',
    domainSeparator: 'softbook-cet/mobile-ux-batch1-compatibility/cp-web-aggregate/v1',
  }),
]);
const DECISION_INSTANCE_PATHS = Object.freeze([
  'docs/design/decisions/mobile-ux-batch1-cohort-designation-v1.json',
  'docs/design/decisions/mobile-ux-batch1-cohort-designation-v1.approval-receipt.json',
  'docs/design/decisions/mobile-ux-batch1-manifest-freeze-v1.json',
  'docs/design/decisions/mobile-ux-batch1-manifest-freeze-v1.approval-receipt.json',
  'docs/design/decisions/mobile-ux-batch1-preparation-v1.approval-receipt.json',
]);
const EXPECTED_SUCCESSOR_TRANSITION_CONTRACT_DIGEST =
  'c8e697352ec66e58fd48c4f8432c87ba97c869a29a0c45bfa812e5e179c58504';

const PW_MATRIX_IDS = Object.freeze([
  'PW-VIEWPORT-01',
  'PW-VIEWPORT-02',
  'PW-ZOOM-01',
  'PW-KEYBOARD-01',
  'PW-MOUSE-01',
  'PW-FOCUS-01',
  'PW-MOTION-01',
  'PW-SCREENREADER-01',
  'PW-SERVICE-01',
  'PW-COMMERCE-01',
  'PW-BETA-01',
  'PW-AUDIO-01',
]);

const PW_ROW_DIGEST_DOMAIN = 'softbook-cet/mobile-ux-batch1-pw-row-obligations/v1';
const EXPECTED_PW_ROW_OBLIGATION_DIGESTS = Object.freeze({
  'PW-VIEWPORT-01': Object.freeze({
    obligationCount: 1,
    digest: 'a17c79d0088b9b67497248a7870776f34c36feb5d6dff70cf7df34e2ac68012b',
  }),
  'PW-VIEWPORT-02': Object.freeze({
    obligationCount: 1,
    digest: '37f3b91640677ee5f29c0aec06134d02c4f96c46b560cd385022c7b328fce408',
  }),
  'PW-ZOOM-01': Object.freeze({
    obligationCount: 1,
    digest: '11eae24e308033cca1ed2b2866255da780849f1336899bf2ebadb19087dc4e4b',
  }),
  'PW-KEYBOARD-01': Object.freeze({
    obligationCount: 1,
    digest: '370bca85be8213231cfcfe786fbb837540c033dc2ffd0001a35e87cd597c726f',
  }),
  'PW-MOUSE-01': Object.freeze({
    obligationCount: 1,
    digest: '08fdde61ab0730f23b00e6291cab8afec85a4b0a44a901097672470d85ba7aae',
  }),
  'PW-FOCUS-01': Object.freeze({
    obligationCount: 1,
    digest: '1abf5a713963254cc399ca35cacb0248c90d22305bd5c3cf23ca2e062c8b7bc8',
  }),
  'PW-MOTION-01': Object.freeze({
    obligationCount: 1,
    digest: 'e0b1f41174b12ed69485392373b870ab8fe6de97bcf8827cc51bb21c039006c2',
  }),
  'PW-SCREENREADER-01': Object.freeze({
    obligationCount: 1,
    digest: 'ff3e5782c6b6587e9b7911b7f3aea36833f6e536c75ce80b4395b1ac3e664bf7',
  }),
  'PW-SERVICE-01': Object.freeze({
    obligationCount: 1,
    digest: '433ca9d303a2201afc57b0e701f0eb7b8f0458762e5e6f95392c217f1d56199c',
  }),
  'PW-COMMERCE-01': Object.freeze({
    obligationCount: 1,
    digest: '410090a04d6bf584e019f157dee9ecdf51326d2f17db097bcfcd56561163a105',
  }),
  'PW-BETA-01': Object.freeze({
    obligationCount: 1,
    digest: '52c56c436fd4982a8dda647c834004a4286342617d5bdaded78902df02869545',
  }),
  'PW-AUDIO-01': Object.freeze({
    obligationCount: 1,
    digest: '09eda941b9d4031a4d688a0c6a67f8744d4fc623e09682d2947ae17cfd3f6167',
  }),
});

const CP_BA_PLATFORM_TARGETS = new Set([
  'ba-ios-phone-browser',
  'ba-android-phone-browser',
  'ba-ipados-browser',
  'ba-android-tablet-browser',
]);

const ALLOWED_LANE_KINDS = Object.freeze({
  'CP-BA': new Set([
    'owner_exact_tier2_pending',
    'platform_browser',
    'shared_formal_access',
    'shared_managed_access',
  ]),
  'CP-CS': new Set([
    'canonical_service',
    'native_ios',
    'native_android',
    'cross_device',
  ]),
  'CP-WEB': new Set(['semantic_region_mapping', 'pc_web']),
});

const CHILD_KEYS = Object.freeze([
  'schema_version',
  'registry_id',
  'classification',
  'subject_class',
  'candidate_status',
  'coverage_effect',
  'checkpoint_id',
  'source_universe_binding',
  'lane_definitions',
  'profile_overlays',
  'obligation_records',
  'partition_summary',
  'authority',
]);

const RECORD_BASE_KEYS = Object.freeze([
  'obligation_id',
  'title',
  'kind',
  'authority_codes',
  'disposition',
  'bindings',
]);

const BINDING_KEYS = Object.freeze([
  'binding_id',
  'lane_id',
  'target_id',
  'profile_id',
  'proof_dimension',
  'coverage_role',
  'claim_ceiling',
  'reason_code',
]);

const EXCLUSION_KEYS = Object.freeze([
  'owner_source_anchors',
  'obligation_specific_semantic_rationale',
  'effect',
  'cross_checkpoint_credit',
  'status',
]);
const OVERLAY_KEYS = Object.freeze([
  'profile_id',
  'exact_obligation_ids',
  'binding_policy',
  'platform_credit',
  'status',
  'reason_code',
]);
const LANE_KEYS = Object.freeze([
  'lane_id',
  'lane_kind',
  'target_ids',
  'profile_ids',
  'proof_dimension',
  'coverage_credit',
  'claim_ceiling',
  'status',
  'reason_code',
  'requirement_bindings',
  'cohort_binding_status',
]);
const SUMMARY_KEYS = Object.freeze([
  'expected_obligation_count',
  'actual_obligation_count',
  'semantic_state_count',
  'forced_combination_count',
  'primary_lane_record_count',
  'owner_backed_exclusion_count',
  'binding_count',
  'wildcard_count',
  'obligation_record_count',
  'receiver_managed_binding_record_count',
  'empty_binding_record_count',
  'setup_only_no_coverage_binding_count',
  'primary_or_matrix_required_binding_count',
  'partition_digest_algorithm',
  'partition_digest_domain_separator',
  'partition_digest_subject_fields',
  'partition_digest',
]);

const REQUIREMENT_BINDING_KEYS = Object.freeze([
  'target_requirement_refs',
  'product_profile_subject_requirement_refs',
  'provider_lane_requirement_refs',
  'environment_requirement_refs',
  'account_requirement_refs',
  'build_requirement_refs',
  'content_requirement_refs',
  'role_requirement_refs',
  'execution_window_requirement_refs',
  'compatibility_requirement_refs',
  'membership_stage_requirement_refs',
  'intended_origin_requirement_refs',
  'exact_scope_requirement_refs',
]);

const REQUIREMENT_KIND_BY_BINDING_KEY = Object.freeze({
  target_requirement_refs: 'target',
  product_profile_subject_requirement_refs: 'product_profile_subject',
  provider_lane_requirement_refs: 'provider_lane',
  environment_requirement_refs: 'environment',
  account_requirement_refs: 'account',
  build_requirement_refs: 'build',
  content_requirement_refs: 'content',
  role_requirement_refs: 'role',
  execution_window_requirement_refs: 'execution_window',
  compatibility_requirement_refs: 'compatibility',
  membership_stage_requirement_refs: 'membership_stage',
  intended_origin_requirement_refs: 'intended_origin',
  exact_scope_requirement_refs: 'owner_exact_scope',
});

const CP_CS_EXCLUSION_IDS = Object.freeze([
  'LEARN-13',
  'TOOL-01',
  'TOOL-02',
  'TOOL-03',
  'TOOL-04',
  'STATS-06',
  'STATS-07',
  'MINE-01',
  'MINE-02',
  'MINE-06',
  'MINE-07',
  'MINE-08',
  'MINE-11',
  'COV-04',
  'COV-05',
  'COV-13',
]);

function numbered(prefix, count) {
  return Array.from({length: count}, (_, index) => `${prefix}-${String(index + 1).padStart(2, '0')}`);
}

const MANAGED_OVERLAY_IDS = Object.freeze([
  ...numbered('LEARN', 14),
  ...numbered('FLIP', 6),
  ...numbered('CHOICE', 5),
  'CHOICE-A11Y-01',
  ...numbered('LOCK', 5),
  ...numbered('ELIM', 5),
  ...numbered('SWIPE', 8),
  ...numbered('TOOL', 11),
  ...numbered('SPACE', 16),
  ...numbered('MEM', 6),
  ...numbered('BETA', 7),
  'COV-01',
  'COV-02',
  'COV-03',
  'COV-06',
  'COV-09',
  'COV-10',
  'COV-12',
]);

const PARTITION_DIGEST_DOMAIN = 'softbook-cet/mobile-ux-batch1-partition/v1';
const EXPECTED_PARTITION_DIGESTS = Object.freeze({
  'CP-BA': '42fdc33b292e0d495d8fa020a2e2678342072d6e06b27e2e514c4e75682a20fc',
  'CP-CS': '8584126140ef551565b4c595589ff1c5a6ff337d0c36d379de81680c646bf876',
  'CP-WEB': 'be423c7983e5817cbce5cf33303283a764e10107212bee6041cd872da5ac7cc8',
});

const EXPECTED_ARTIFACT_SHA256 = Object.freeze({
  [FREEZE_CANDIDATE_PATHS[0]]:
    '58966c8df9e9f5a5a7f6711a048317b78a2300d3a003e1dd6bdd238c0e928c03',
  [FREEZE_CANDIDATE_PATHS[1]]:
    '247ff9d3de23e31f3e37e35e9a53fd0fe1edc24bc2d93ca4468a5a2571338491',
  [FREEZE_CANDIDATE_PATHS[2]]:
    '8819358f978a1c573067d468531744b2fd900864d3317542e741bffae2f2bdfa',
  [FREEZE_CANDIDATE_PATHS[3]]:
    'cc0b4aa3f73b36318d00e28f1514115f10dec78fd21c8948f1c3030d2699da60',
  [FREEZE_CANDIDATE_PATHS[4]]:
    '814088a2b709e0d31a5a1d96d3bc29e17dc47849fdcd44f1785162d452ac5b1b',
});
const EXPECTED_SUBJECT_DIGEST =
  'df8d1bb25b4a38b1c23c84fe8ffddc7c4b9013ce4228b6c975dfb3bcb2256793';
const EXPECTED_REFERENCE_CONTRACTS_DIGEST =
  '357e6aadaf6c474c4eb0fe89847d3b952604401a3bd95f58e12ef3ca6ee862cb';

const V1_UNRESOLVED_SOURCE_PATHS = Object.freeze([
  `${path.posix.dirname(REGISTRY_SET_PATH)}/registry-set.v1.json`,
  `${path.posix.dirname(REGISTRY_SET_PATH)}/cp-ba.registry.v1.json`,
  `${path.posix.dirname(REGISTRY_SET_PATH)}/cp-cs.registry.v1.json`,
  `${path.posix.dirname(REGISTRY_SET_PATH)}/cp-web.registry.v1.json`,
]);

const V1_UNRESOLVED_SOURCE_SHA256 = Object.freeze({
  [V1_UNRESOLVED_SOURCE_PATHS[0]]:
    'f51f8fc849edacc9e22517266468caff1333d6d12c1a3265cf9a85eec381c982',
  [V1_UNRESOLVED_SOURCE_PATHS[1]]:
    'ac4c4f33b63938ac8d92bf75e8b99866c9f12d662ffc3509cd3826765bf8cb84',
  [V1_UNRESOLVED_SOURCE_PATHS[2]]:
    'dcbc64c5ddeb23408c546819dd65c50d629931633fb859787c3605b2aa77add2',
  [V1_UNRESOLVED_SOURCE_PATHS[3]]:
    'cba6f75f9c7574a58c9ee2f744991ec2154385c6ca328b46be6522e652e09696',
});

const UNRESOLVED_CATEGORY_BY_REASON = Object.freeze({
  approved_content_release_identity_missing: 'external_account_environment',
  artifact_signing_and_distribution_identity_missing: 'external_account_environment',
  browser_environment_identity_missing: 'machine_local_privacy_safe',
  browser_system_identity_missing: 'machine_local_privacy_safe',
  build_deployment_and_reviewer_schedule_missing: 'human_role_confirmation',
  deployable_build_digest_missing: 'external_account_environment',
  deployment_identity_missing: 'external_account_environment',
  environment_and_account_schedule_missing: 'external_account_environment',
  exact_compatibility_key_missing: 'must_remain_unresolved',
  exact_intended_origin_partition_missing: 'repo_resolvable',
  exact_membership_stage_partition_missing: 'repo_resolvable',
  exact_state_to_lane_partition_missing: 'repo_resolvable',
  explicit_role_confirmation_missing: 'human_role_confirmation',
  formal_entitlement_configuration_missing: 'external_account_environment',
  future_manifest_decision_commit_missing: 'must_remain_unresolved',
  independent_human_confirmation_missing: 'human_role_confirmation',
  non_secret_test_account_reference_missing: 'external_account_environment',
  operator_and_verifier_schedule_missing: 'human_role_confirmation',
  physical_device_and_build_identity_missing: 'machine_local_privacy_safe',
  private_content_deployment_missing: 'external_account_environment',
  private_content_entitlement_configuration_missing: 'external_account_environment',
  provider_account_owner_missing: 'human_role_confirmation',
  provider_account_reference_missing: 'external_account_environment',
  provider_sandbox_missing: 'external_account_environment',
  receiver_account_owner_missing: 'human_role_confirmation',
  receiver_content_account_reference_missing: 'external_account_environment',
  receiver_content_owner_missing: 'human_role_confirmation',
  receiver_entitlement_configuration_missing: 'external_account_environment',
  receiver_operator_account_reference_missing: 'external_account_environment',
  receiver_operator_owner_missing: 'human_role_confirmation',
  receiver_owned_deployment_missing: 'external_account_environment',
  receiver_owned_managed_access_environment_missing: 'external_account_environment',
  receiver_service_harness_build_missing: 'external_account_environment',
  receiver_service_harness_identity_missing: 'external_account_environment',
  sensitive_classifier_drift_requires_new_exact_head_approval: 'must_remain_unresolved',
  signed_private_audio_manifest_missing: 'external_account_environment',
});

const CATEGORY_PHYSICAL_COUNTS = Object.freeze({
  must_remain_unresolved: 7,
  human_role_confirmation: 40,
  machine_local_privacy_safe: 13,
  external_account_environment: 28,
  repo_resolvable: 27,
});

const CATEGORY_UNIQUE_COUNTS = Object.freeze({
  repo_resolvable: 27,
  machine_local_privacy_safe: 3,
  external_account_environment: 20,
  human_role_confirmation: 35,
  must_remain_unresolved: 3,
});

const MIGRATION_DIGEST_DOMAIN = 'mobile-ux-batch1-v1-unresolved-migration.v1';
const EXPECTED_MIGRATION_DIGEST =
  'e35033e32eee9d6042e5a52b110529b430a1c90be35691909d2e5a9418612d94';

const REFERENCE_CONTRACT_IDENTITIES = Object.freeze([
  Object.freeze({
    contractId: 'machine-local-privacy-safe-slot-v1',
    category: 'machine_local_privacy_safe',
    requiredForbidden: [
      'serial',
      'udid',
      'android_id',
      'mac',
      'hostname',
      'home_path',
      'username',
      'device_identifier_plain_hash',
      'credential',
      'token',
      'private_key',
      'temporary_private_download_url',
    ],
  }),
  Object.freeze({
    contractId: 'external-account-environment-ref-v1',
    category: 'external_account_environment',
    requiredForbidden: [
      'credential',
      'token',
      'cookie',
      'private_key',
      'temporary_private_download_url',
      'raw_phone',
      'raw_email',
      'merchant_account_id',
    ],
  }),
  Object.freeze({
    contractId: 'human-role-confirmation-v1',
    category: 'human_role_confirmation',
    requiredForbidden: ['name', 'email', 'phone', 'repo_self_assertion', 'commit_author_as_confirmation'],
  }),
  Object.freeze({
    contractId: 'protected-decision-or-compatibility-ref-v1',
    category: 'must_remain_unresolved',
    requiredForbidden: [
      'repo_self_approval',
      'synthetic_compatibility_key',
      'receiver_supplied_arbitrary_compatibility_key',
      'owner_supplied_arbitrary_compatibility_key',
      'compatibility_output_as_derivation_input',
      'final_freeze_subject_as_compatibility_input',
      'credential',
      'token',
    ],
  }),
]);

function stripCode(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed.startsWith('`') && trimmed.endsWith('`') ? trimmed.slice(1, -1) : trimmed;
}

function assertStringArray(value, label, {allowEmpty = false} = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array`);
  }
  const seen = new Set();
  for (const [index, item] of value.entries()) {
    assertNonEmptyString(item, `${label}[${index}]`);
    if (seen.has(item)) throw new Error(`${label} contains duplicate value ${item}`);
    seen.add(item);
  }
  return seen;
}

function validateCommonHeader(value, label) {
  assertEqual(value.classification, COMMON_CLASSIFICATION, `${label}.classification`);
  assertEqual(value.subject_class, COMMON_SUBJECT_CLASS, `${label}.subject_class`);
  assertEqual(value.candidate_status, COMMON_CANDIDATE_STATUS, `${label}.candidate_status`);
  assertEqual(value.coverage_effect, COMMON_COVERAGE_EFFECT, `${label}.coverage_effect`);
  assertAuthorityObjectFalse(value.authority, `${label}.authority`);
}

function loadObligationTruth(root, {requireTracked}) {
  const ledger = parseLedger(
    readSemanticSource(root, LEDGER_RELATIVE_PATH, LEDGER_RELATIVE_PATH, {requireTracked}).toString(
      'utf8',
    ),
  );
  const contract = parseContract(
    readSemanticSource(root, CONTRACT_RELATIVE_PATH, CONTRACT_RELATIVE_PATH, {
      requireTracked,
    }).toString('utf8'),
  );
  if (ledger.rows.length !== 173 || contract.size !== 173) {
    throw new Error(`ledger and contract must each contain exactly 173 obligations`);
  }
  return ledger.rows.map((row, index) => {
    const contractState = contract.get(row.id);
    if (!contractState || contractState.name !== row.name) {
      throw new Error(`ledger obligation ${row.id} does not match the frozen contract at index ${index}`);
    }
    const ledgerOwner = stripCode(row.cells[11]);
    if (ledgerOwner !== contractState.owner) {
      throw new Error(`${row.id} ledger owner does not match the frozen contract owner`);
    }
    return Object.freeze({
      id: row.id,
      title: row.name,
      kind: row.id.startsWith('COV-') ? 'forced_combination' : 'semantic_state',
      authorityCodes: Object.freeze(contractState.owner.split('+')),
    });
  });
}

function validateSourceBinding(value, label) {
  assertExactKeys(
    value,
    [
      'scope_ref',
      'source_path',
      'source_id_title_owner_digest',
      'semantic_state_count',
      'forced_combination_count',
      'total_obligation_count',
      'binding_kind',
      'wildcard_allowed',
    ],
    label,
  );
  assertEqual(value.scope_ref, 'all_173_ledger_obligations', `${label}.scope_ref`);
  assertEqual(value.source_path, LEDGER_RELATIVE_PATH, `${label}.source_path`);
  assertEqual(value.source_id_title_owner_digest, CONTRACT_IDENTITY_SHA256, `${label}.source_id_title_owner_digest`);
  assertEqual(value.semantic_state_count, 160, `${label}.semantic_state_count`);
  assertEqual(value.forced_combination_count, 13, `${label}.forced_combination_count`);
  assertEqual(value.total_obligation_count, 173, `${label}.total_obligation_count`);
  assertEqual(value.binding_kind, 'explicit_per_obligation_schema_proposal', `${label}.binding_kind`);
  assertEqual(value.wildcard_allowed, false, `${label}.wildcard_allowed`);
}

function validateRequirementBindings(bindings, label, artifactValues, requirementUsage) {
  assertExactKeys(bindings, REQUIREMENT_BINDING_KEYS, label);
  const orderedRequirementIds = [];
  for (const key of REQUIREMENT_BINDING_KEYS) {
    const refs = bindings[key];
    if (!Array.isArray(refs)) throw new Error(`${label}.${key} must be an array`);
    const seen = new Set();
    refs.forEach((ref, index) => {
      const refLabel = `${label}.${key}[${index}]`;
      assertExactKeys(ref, ['requirement_id', 'registry_ref'], refLabel);
      assertNonEmptyString(ref.requirement_id, `${refLabel}.requirement_id`);
      if (seen.has(ref.requirement_id)) throw new Error(`${refLabel}.requirement_id must be unique within ${key}`);
      seen.add(ref.requirement_id);
      const expectedRef = `${REGISTRY_SET_PATH}#/current_requirement_registry/requirements_by_id/${escapePointerToken(ref.requirement_id)}`;
      assertEqual(ref.registry_ref, expectedRef, `${refLabel}.registry_ref`);
      const resolved = resolveArtifactReference(ref.registry_ref, artifactValues, `${refLabel}.registry_ref`);
      assertRecord(resolved.value, `${refLabel} resolved requirement`);
      assertEqual(resolved.value.requirement_id, ref.requirement_id, `${refLabel} resolved requirement_id`);
      assertEqual(
        resolved.value.requirement_kind,
        REQUIREMENT_KIND_BY_BINDING_KEY[key],
        `${refLabel} resolved requirement_kind`,
      );
      assertEqual(resolved.value.status, 'typed_value_pending', `${refLabel} resolved status`);
      assertAuthorityObjectFalse(resolved.value.authority, `${refLabel} resolved authority`);
      orderedRequirementIds.push(ref.requirement_id);
      requirementUsage?.add(ref.requirement_id);
    });
  }
  return orderedRequirementIds;
}

function validateOwnerValueRequirement(value, {requirementId, kind}, label) {
  assertExactKeys(
    value,
    [
      'requirement_id',
      'semantic_owner_refs',
      'allowed_value_class',
      'exact_vocabulary',
      'value_ref',
      'pending_values',
      'status',
      'owner_backed_not_applicable_ref',
    ],
    label,
  );
  assertEqual(value.requirement_id, requirementId, `${label}.requirement_id`);
  assertStringArray(value.semantic_owner_refs, `${label}.semantic_owner_refs`);
  assertNonEmptyString(value.allowed_value_class, `${label}.allowed_value_class`);
  if (kind === 'membership_stage') {
    assertEqual(
      value.allowed_value_class,
      'owner_selected_membership_stage_set_or_owner_backed_not_applicable',
      `${label}.allowed_value_class`,
    );
    assertExactArray(value.exact_vocabulary, ['trial', 'free', 'premium'], `${label}.exact_vocabulary`);
  } else {
    assertEqual(
      value.allowed_value_class,
      'owner_selected_safe_origin_descriptor_or_owner_backed_not_applicable',
      `${label}.allowed_value_class`,
    );
    assertExactKeys(
      value.exact_vocabulary,
      [
        'required_fields',
        'exact_top_level_route_vocabulary',
        'exact_object_ref_class_vocabulary',
        'exact_return_policy_vocabulary',
      ],
      `${label}.exact_vocabulary`,
    );
    assertExactArray(
      value.exact_vocabulary.required_fields,
      ['top_level_route', 'object_ref_or_none', 'return_policy'],
      `${label}.exact_vocabulary.required_fields`,
    );
    assertExactArray(
      value.exact_vocabulary.exact_top_level_route_vocabulary,
      ['learning', 'space', 'statistics', 'mine'],
      `${label}.exact_vocabulary.exact_top_level_route_vocabulary`,
    );
    assertExactArray(
      value.exact_vocabulary.exact_object_ref_class_vocabulary,
      ['stable_route_local_object_ref', 'none'],
      `${label}.exact_vocabulary.exact_object_ref_class_vocabulary`,
    );
    assertExactArray(
      value.exact_vocabulary.exact_return_policy_vocabulary,
      ['return_to_origin', 'return_to_safe_top_level', 'replace_with_authenticated_destination', 'none'],
      `${label}.exact_vocabulary.exact_return_policy_vocabulary`,
    );
  }
  assertEqual(value.value_ref, null, `${label}.value_ref`);
  assertExactArray(value.pending_values, [], `${label}.pending_values`);
  assertEqual(value.status, 'owner_value_pending', `${label}.status`);
  assertEqual(value.owner_backed_not_applicable_ref, null, `${label}.owner_backed_not_applicable_ref`);
}

function validatePwPendingScope(lane, label) {
  assertEqual(lane.exact_scope_status, 'owner_value_pending', `${label}.exact_scope_status`);
  assertStringArray(lane.scope_authority_refs, `${label}.scope_authority_refs`);
  assertExactKeys(
    lane.mechanically_certain_minimum,
    [
      'source_kind',
      'source_lane_ids',
      'obligation_ids',
      'obligation_count',
      'exact_scope_effect',
      'coverage_effect',
      'execution_binding_effect',
      'status',
    ],
    `${label}.mechanically_certain_minimum`,
  );
  const minimum = lane.mechanically_certain_minimum;
  assertEqual(minimum.source_kind, 'none_beyond_cross_matrix_cov_13', `${label}.minimum.source_kind`);
  assertExactArray(minimum.source_lane_ids, [], `${label}.minimum.source_lane_ids`);
  assertExactArray(minimum.obligation_ids, ['COV-13'], `${label}.minimum.obligation_ids`);
  assertEqual(minimum.obligation_count, 1, `${label}.minimum.obligation_count`);
  assertEqual(minimum.exact_scope_effect, 'none', `${label}.minimum.exact_scope_effect`);
  assertEqual(minimum.coverage_effect, 'none', `${label}.minimum.coverage_effect`);
  assertEqual(minimum.execution_binding_effect, 'none', `${label}.minimum.execution_binding_effect`);
  assertEqual(minimum.status, 'non_exact_non_coverage_anchor_only', `${label}.minimum.status`);
}

function validateLanes(child, label, artifactValues, requirementUsage) {
  if (!Array.isArray(child.lane_definitions) || child.lane_definitions.length === 0) {
    throw new Error(`${label}.lane_definitions must be a non-empty array`);
  }
  const lanes = new Map();
  child.lane_definitions.forEach((lane, index) => {
    const laneLabel = `${label}.lane_definitions[${index}]`;
    const laneKeys = [
      ...LANE_KEYS,
      ...(child.checkpoint_id === 'CP-CS'
        ? [
            'scenario_domain',
            'provider_lane',
            'membership_stage_requirement',
            'intended_origin_requirement',
          ]
        : []),
      ...(child.checkpoint_id === 'CP-WEB' && lane.lane_kind === 'pc_web'
        ? [
            'exact_scope_status',
            'scope_authority_refs',
            'mechanically_certain_minimum',
            'exact_scope_requirement_id',
            'matrix_row_id',
          ]
        : []),
      ...(child.checkpoint_id === 'CP-WEB' && lane.lane_kind === 'semantic_region_mapping'
        ? ['structural_owner_refs']
        : []),
    ];
    assertExactKeys(lane, laneKeys, laneLabel);
    assertNonEmptyString(lane.lane_id, `${laneLabel}.lane_id`);
    if (lanes.has(lane.lane_id)) throw new Error(`${laneLabel}.lane_id must be unique`);
    if (!ALLOWED_LANE_KINDS[child.checkpoint_id].has(lane.lane_kind)) {
      throw new Error(`${laneLabel}.lane_kind is invalid for ${child.checkpoint_id}`);
    }
    const targets = assertStringArray(lane.target_ids, `${laneLabel}.target_ids`);
    assertStringArray(lane.profile_ids, `${laneLabel}.profile_ids`);
    assertNonEmptyString(lane.proof_dimension, `${laneLabel}.proof_dimension`);
    assertNonEmptyString(lane.coverage_credit, `${laneLabel}.coverage_credit`);
    assertEqual(
      lane.claim_ceiling,
      lane.lane_kind === 'semantic_region_mapping'
        ? 'non_execution_mapping_no_coverage'
        : 'schema_proposal_no_execution_or_coverage',
      `${laneLabel}.claim_ceiling`,
    );
    assertNonEmptyString(lane.status, `${laneLabel}.status`);
    assertNonEmptyString(lane.reason_code, `${laneLabel}.reason_code`);
    assertEqual(
      lane.cohort_binding_status,
      lane.lane_kind === 'semantic_region_mapping'
        ? 'non_execution_mapping_no_cohort'
        : 'typed_requirements_resolvable_values_pending',
      `${laneLabel}.cohort_binding_status`,
    );
    validateRequirementBindings(
      lane.requirement_bindings,
      `${laneLabel}.requirement_bindings`,
      artifactValues,
      requirementUsage,
    );
    if (child.checkpoint_id === 'CP-CS') {
      assertNonEmptyString(lane.scenario_domain, `${laneLabel}.scenario_domain`);
      assertNonEmptyString(lane.provider_lane, `${laneLabel}.provider_lane`);
      validateOwnerValueRequirement(
        lane.membership_stage_requirement,
        {requirementId: `membership-stage-${lane.lane_id}`, kind: 'membership_stage'},
        `${laneLabel}.membership_stage_requirement`,
      );
      validateOwnerValueRequirement(
        lane.intended_origin_requirement,
        {requirementId: `intended-origin-${lane.lane_id}`, kind: 'intended_origin'},
        `${laneLabel}.intended_origin_requirement`,
      );
      assertExactArray(
        lane.requirement_bindings.membership_stage_requirement_refs.map((ref) => ref.requirement_id),
        [lane.membership_stage_requirement.requirement_id],
        `${laneLabel}.membership stage ref`,
      );
      assertExactArray(
        lane.requirement_bindings.intended_origin_requirement_refs.map((ref) => ref.requirement_id),
        [lane.intended_origin_requirement.requirement_id],
        `${laneLabel}.intended origin ref`,
      );
    } else {
      assertExactArray(
        lane.requirement_bindings.membership_stage_requirement_refs,
        [],
        `${laneLabel}.membership_stage_requirement_refs`,
      );
      assertExactArray(
        lane.requirement_bindings.intended_origin_requirement_refs,
        [],
        `${laneLabel}.intended_origin_requirement_refs`,
      );
    }
    if (child.checkpoint_id === 'CP-WEB' && lane.lane_kind === 'pc_web') {
      validatePwPendingScope(lane, laneLabel);
      assertEqual(
        lane.exact_scope_requirement_id,
        `exact-scope-${lane.matrix_row_id.toLowerCase()}`,
        `${laneLabel}.exact_scope_requirement_id`,
      );
      assertExactArray(
        lane.requirement_bindings.exact_scope_requirement_refs.map((ref) => ref.requirement_id),
        [lane.exact_scope_requirement_id],
        `${laneLabel}.exact_scope_requirement_refs`,
      );
    } else {
      assertExactArray(
        lane.requirement_bindings.exact_scope_requirement_refs,
        [],
        `${laneLabel}.exact_scope_requirement_refs`,
      );
      if (child.checkpoint_id === 'CP-WEB') {
        assertStringArray(lane.structural_owner_refs, `${laneLabel}.structural_owner_refs`);
        for (const key of [
          'environment_requirement_refs',
          'account_requirement_refs',
          'build_requirement_refs',
          'content_requirement_refs',
          'role_requirement_refs',
          'execution_window_requirement_refs',
          'compatibility_requirement_refs',
        ]) {
          assertExactArray(
            lane.requirement_bindings[key],
            [],
            `${laneLabel}.${key} must not create an execution cohort`,
          );
        }
      }
    }
    if (child.checkpoint_id === 'CP-BA' && lane.lane_kind.startsWith('shared_')) {
      for (const target of targets) {
        if (CP_BA_PLATFORM_TARGETS.has(target)) {
          throw new Error(`${laneLabel} shared-access lane must not fill a platform target`);
        }
      }
    }
    lanes.set(lane.lane_id, lane);
  });
  return lanes;
}

function validateOverlays(child, truthById, label) {
  if (!Array.isArray(child.profile_overlays)) throw new Error(`${label}.profile_overlays must be an array`);
  const overlays = new Map();
  child.profile_overlays.forEach((overlay, index) => {
    const overlayLabel = `${label}.profile_overlays[${index}]`;
    assertExactKeys(overlay, OVERLAY_KEYS, overlayLabel);
    assertNonEmptyString(overlay.profile_id, `${overlayLabel}.profile_id`);
    if (overlays.has(overlay.profile_id)) throw new Error(`${overlayLabel}.profile_id must be unique`);
    const ids = assertStringArray(overlay.exact_obligation_ids, `${overlayLabel}.exact_obligation_ids`, {
      allowEmpty: false,
    });
    for (const id of ids) {
      if (!truthById.has(id)) throw new Error(`${overlayLabel} names unknown obligation ${id}`);
    }
    assertNonEmptyString(overlay.binding_policy, `${overlayLabel}.binding_policy`);
    assertEqual(overlay.platform_credit, false, `${overlayLabel}.platform_credit`);
    assertNonEmptyString(overlay.status, `${overlayLabel}.status`);
    assertNonEmptyString(overlay.reason_code, `${overlayLabel}.reason_code`);
    overlays.set(overlay.profile_id, overlay);
  });
  return overlays;
}

function validateBinding(binding, {checkpointId, obligationId, lanes, bindingIds, label}) {
  const matrixBinding = binding.coverage_role === 'cp_web_matrix_and_required';
  assertExactKeys(binding, matrixBinding ? [...BINDING_KEYS, 'matrix_row_id'] : BINDING_KEYS, label);
  for (const key of BINDING_KEYS) assertNonEmptyString(binding[key], `${label}.${key}`);
  if (!binding.binding_id.startsWith(`${checkpointId}::${obligationId}::`)) {
    throw new Error(`${label}.binding_id must be scoped to ${checkpointId} and ${obligationId}`);
  }
  if (bindingIds.has(binding.binding_id)) throw new Error(`${label}.binding_id must be globally unique`);
  bindingIds.add(binding.binding_id);
  const lane = lanes.get(binding.lane_id);
  if (!lane) throw new Error(`${label}.lane_id does not name a declared lane`);
  if (!lane.target_ids.includes(binding.target_id)) throw new Error(`${label}.target_id is not declared by its lane`);
  if (!lane.profile_ids.includes(binding.profile_id)) throw new Error(`${label}.profile_id is not declared by its lane`);
  if (
    binding.proof_dimension !== lane.proof_dimension &&
    !(
      binding.profile_id === 'receiver_managed' &&
      binding.proof_dimension === `${lane.proof_dimension}_overlay`
    )
  ) {
    throw new Error(`${label}.proof_dimension does not match its declared lane`);
  }
  assertEqual(
    binding.claim_ceiling,
    matrixBinding ? 'future_exact_scope_and_execution_required' : lane.claim_ceiling,
    `${label}.claim_ceiling`,
  );
  if (matrixBinding) {
    assertEqual(checkpointId, 'CP-WEB', `${label} matrix checkpoint`);
    assertEqual(binding.matrix_row_id, lane.matrix_row_id, `${label}.matrix_row_id`);
  }
  if (
    ![
      'primary_required',
      'setup_only_no_coverage_credit',
      'cross_dimension_required',
      'cp_web_matrix_and_required',
    ].includes(binding.coverage_role)
  ) {
    throw new Error(`${label}.coverage_role is invalid`);
  }
}

function validateExclusion(exclusion, label, {root, obligationId, requireTracked}) {
  assertExactKeys(exclusion, EXCLUSION_KEYS, label);
  if (!Array.isArray(exclusion.owner_source_anchors) || exclusion.owner_source_anchors.length === 0) {
    throw new Error(`${label}.owner_source_anchors must be a non-empty array`);
  }
  exclusion.owner_source_anchors.forEach((anchor, index) => {
    const anchorLabel = `${label}.owner_source_anchors[${index}]`;
    assertExactKeys(anchor, ['path', 'locator_kind', 'locator', 'raw_sha256'], anchorLabel);
    assertNonEmptyString(anchor.path, `${anchorLabel}.path`);
    if (!['json_pointer', 'heading'].includes(anchor.locator_kind)) {
      throw new Error(`${anchorLabel}.locator_kind must be json_pointer or heading`);
    }
    assertNonEmptyString(anchor.locator, `${anchorLabel}.locator`);
    const bytes = readSemanticSource(root, anchor.path, `${anchorLabel}.path`, {requireTracked});
    assertEqual(sha256(bytes), anchor.raw_sha256, `${anchorLabel}.raw_sha256`);
    if (anchor.locator_kind === 'json_pointer') {
      const source = parseStrictJson(bytes, anchor.path);
      resolveJsonPointer(source, anchor.locator, `${anchorLabel}.locator`);
    } else {
      const heading = anchor.locator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!new RegExp(`^#{1,6}\\s+${heading}\\s*$`, 'm').test(bytes.toString('utf8'))) {
        throw new Error(`${anchorLabel}.locator does not resolve to an exact Markdown heading`);
      }
    }
  });
  assertNonEmptyString(
    exclusion.obligation_specific_semantic_rationale,
    `${label}.obligation_specific_semantic_rationale`,
  );
  if (exclusion.obligation_specific_semantic_rationale.length < 80) {
    throw new Error(
      `${label}.obligation_specific_semantic_rationale must explain the obligation-specific owner boundary`,
    );
  }
  assertEqual(
    exclusion.effect,
    'CP-CS_partition_exclusion_no_cross_checkpoint_NA',
    `${label}.effect`,
  );
  assertEqual(exclusion.cross_checkpoint_credit, false, `${label}.cross_checkpoint_credit`);
  assertEqual(exclusion.status, 'owner_anchor_bound_exclusion_candidate', `${label}.status`);
  if (!CP_CS_EXCLUSION_IDS.includes(obligationId)) {
    throw new Error(`${label} is not allowed for non-excluded obligation ${obligationId}`);
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function semanticPartitionDigest(child) {
  const subject = {
    lane_definitions: child.lane_definitions,
    profile_overlays: child.profile_overlays,
    obligation_records: child.obligation_records,
  };
  return sha256(
    Buffer.from(
      `${PARTITION_DIGEST_DOMAIN}/${child.checkpoint_id}\0${canonicalJson(subject)}`,
      'utf8',
    ),
  );
}

function embeddedPartitionDigest(child) {
  const domain = `mobile-ux-batch1-${child.checkpoint_id.toLowerCase()}-partition.v1`;
  const subject = {
    lane_definitions: child.lane_definitions,
    profile_overlays: child.profile_overlays,
    obligation_records: child.obligation_records,
  };
  return {
    domain,
    digest: sha256(Buffer.from(`${domain}\0${JSON.stringify(subject)}`, 'utf8')),
  };
}

function pwRowObligationDigest(rowId, orderedObligationIds) {
  return sha256(
    Buffer.from(
      `${PW_ROW_DIGEST_DOMAIN}/${rowId}\0${JSON.stringify(orderedObligationIds)}`,
      'utf8',
    ),
  );
}

function validatePwRowPartitions(child, label) {
  const rowOrder = new Map(PW_MATRIX_IDS.map((rowId, index) => [rowId, index]));
  const obligationsByRow = new Map(PW_MATRIX_IDS.map((rowId) => [rowId, []]));
  const mappingLane = child.lane_definitions.find(
    (lane) => lane.lane_id === 'cp-web-semantic-region-mapping',
  );
  if (!mappingLane || mappingLane.lane_kind !== 'semantic_region_mapping') {
    throw new Error(`${label} must define the all-173 non-coverage semantic-region mapping lane`);
  }
  assertExactArray(mappingLane.target_ids, ['web-semantic-region-map'], `${label} mapping target`);
  assertExactArray(
    mappingLane.profile_ids,
    ['semantic_region_mapping_setup'],
    `${label} mapping profile`,
  );

  child.obligation_records.forEach((record) => {
    const mappingBindings = record.bindings.filter(
      (binding) => binding.lane_id === mappingLane.lane_id,
    );
    if (mappingBindings.length !== 1) {
      throw new Error(`${label}.${record.obligation_id} must have exactly one semantic-region mapping binding`);
    }
    const mapping = mappingBindings[0];
    assertEqual(
      mapping.coverage_role,
      'setup_only_no_coverage_credit',
      `${label}.${record.obligation_id} mapping coverage_role`,
    );
    assertEqual(
      mapping.claim_ceiling,
      'non_execution_mapping_no_coverage',
      `${label}.${record.obligation_id} mapping claim_ceiling`,
    );

    const rowBindings = record.bindings.filter(
      (binding) => binding.coverage_role === 'cp_web_matrix_and_required',
    );
    const rowTargets = rowBindings.map((binding) => binding.matrix_row_id);
    if (rowTargets.some((rowId) => !rowOrder.has(rowId))) {
      throw new Error(`${label}.${record.obligation_id} contains an unknown PW matrix_row_id`);
    }
    if (new Set(rowTargets).size !== rowTargets.length) {
      throw new Error(`${label}.${record.obligation_id} must not duplicate a PW execution row`);
    }
    const sortedTargets = [...rowTargets].sort((left, right) => rowOrder.get(left) - rowOrder.get(right));
    assertExactArray(rowTargets, sortedTargets, `${label}.${record.obligation_id} PW target binding order`);
    if (record.obligation_id !== 'COV-13' && rowBindings.length !== 0) {
      throw new Error(
        `${label}.${record.obligation_id} cannot bind a pending PW execution row before owner exact scope`,
      );
    }
    rowBindings.forEach((binding) => {
      assertEqual(
        binding.coverage_role,
        'cp_web_matrix_and_required',
        `${label}.${record.obligation_id}.${binding.target_id}.coverage_role`,
      );
      obligationsByRow.get(binding.matrix_row_id).push(record.obligation_id);
    });
  });

  const result = {};
  for (const rowId of PW_MATRIX_IDS) {
    const orderedObligationIds = obligationsByRow.get(rowId);
    const expected = EXPECTED_PW_ROW_OBLIGATION_DIGESTS[rowId];
    assertEqual(
      orderedObligationIds.length,
      expected.obligationCount,
      `${label}.${rowId} exact pending-row anchor count`,
    );
    const digest = pwRowObligationDigest(rowId, orderedObligationIds);
    assertEqual(digest, expected.digest, `${label}.${rowId} exact ordered obligation digest`);
    result[rowId] = {
      exact_scope_status: 'owner_value_pending',
      obligation_count: orderedObligationIds.length,
      digest,
    };
  }
  return result;
}

function escapePointerToken(value) {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

function unescapePointerToken(value) {
  return value.replace(/~1/g, '/').replace(/~0/g, '~');
}

function resolveJsonPointer(value, pointer, label) {
  if (pointer === '') return value;
  if (!pointer.startsWith('/')) throw new Error(`${label} must be an RFC 6901 JSON pointer`);
  let cursor = value;
  for (const encodedToken of pointer.slice(1).split('/')) {
    const token = unescapePointerToken(encodedToken);
    if (
      (Array.isArray(cursor) && !/^\d+$/.test(token)) ||
      (cursor === null || typeof cursor !== 'object') ||
      !Object.hasOwn(cursor, token)
    ) {
      throw new Error(`${label} does not resolve at token ${JSON.stringify(token)}`);
    }
    cursor = cursor[token];
  }
  return cursor;
}

function collectV1Unresolved(value, sourceArtifact, tokens = [], output = []) {
  if (Array.isArray(value)) {
    value.forEach((child, index) =>
      collectV1Unresolved(child, sourceArtifact, [...tokens, String(index)], output),
    );
    return output;
  }
  if (value !== null && typeof value === 'object') {
    if (value.kind === 'unresolved') {
      output.push({
        sourceArtifact,
        jsonPointer: `/${tokens.map(escapePointerToken).join('/')}`,
        value,
      });
    }
    for (const [key, child] of Object.entries(value)) {
      collectV1Unresolved(child, sourceArtifact, [...tokens, key], output);
    }
  }
  return output;
}

function expectedDisposition(reasonCode) {
  if (reasonCode === 'sensitive_classifier_drift_requires_new_exact_head_approval') {
    return 'resolved_by_exact_preparation_authority_ref_non_freeze';
  }
  if (reasonCode === 'exact_state_to_lane_partition_missing') {
    return 'schema_proposal_defined_pending_owner_acceptance';
  }
  if (
    reasonCode === 'exact_membership_stage_partition_missing' ||
    reasonCode === 'exact_intended_origin_partition_missing'
  ) {
    return 'schema_contract_defined_owner_value_pending';
  }
  return 'typed_pending';
}

function resolveArtifactReference(reference, artifactValues, label) {
  assertNonEmptyString(reference, label);
  const separator = reference.indexOf('#');
  if (separator < 1) throw new Error(`${label} must contain a repository artifact path and JSON pointer`);
  const artifactPath = reference.slice(0, separator);
  const pointer = reference.slice(separator + 1);
  const artifact = artifactValues.get(artifactPath);
  if (!artifact) throw new Error(`${label} names an artifact outside the five-file candidate set`);
  return {
    artifactPath,
    pointer,
    value: resolveJsonPointer(artifact, pointer, label),
  };
}

function validateReferenceContracts(contracts, label) {
  if (!Array.isArray(contracts) || contracts.length !== REFERENCE_CONTRACT_IDENTITIES.length) {
    throw new Error(`${label} must contain exactly four typed pending reference contracts`);
  }
  contracts.forEach((contract, index) => {
    const contractLabel = `${label}[${index}]`;
    assertExactKeys(
      contract,
      [
        'contract_id',
        'category',
        'required_fields',
        'forbidden_fields',
        'privacy_rules',
        'status',
        'authority',
        ...(contract.category === 'external_account_environment'
          ? ['resource_kind_definitions']
          : []),
      ],
      contractLabel,
    );
    const expected = REFERENCE_CONTRACT_IDENTITIES[index];
    assertEqual(contract.contract_id, expected.contractId, `${contractLabel}.contract_id`);
    assertEqual(contract.category, expected.category, `${contractLabel}.category`);
    assertStringArray(contract.required_fields, `${contractLabel}.required_fields`);
    assertExactArray(contract.forbidden_fields, expected.requiredForbidden, `${contractLabel}.forbidden_fields`);
    assertStringArray(contract.privacy_rules, `${contractLabel}.privacy_rules`);
    assertEqual(contract.status, 'typed_pending', `${contractLabel}.status`);
    assertAuthorityObjectFalse(contract.authority, `${contractLabel}.authority`);
    if (contract.category === 'external_account_environment') {
      if (!Array.isArray(contract.resource_kind_definitions) || contract.resource_kind_definitions.length !== 20) {
        throw new Error(`${contractLabel}.resource_kind_definitions must contain exactly 20 typed subcontracts`);
      }
      const resourceKinds = new Set();
      const classificationTokens = new Set();
      contract.resource_kind_definitions.forEach((definition, definitionIndex) => {
        const definitionLabel = `${contractLabel}.resource_kind_definitions[${definitionIndex}]`;
        assertExactKeys(
          definition,
          ['resource_kind', 'classification_token', 'required_fields', 'status'],
          definitionLabel,
        );
        assertNonEmptyString(definition.resource_kind, `${definitionLabel}.resource_kind`);
        assertNonEmptyString(definition.classification_token, `${definitionLabel}.classification_token`);
        if (resourceKinds.has(definition.resource_kind)) {
          throw new Error(`${definitionLabel}.resource_kind must be unique`);
        }
        if (classificationTokens.has(definition.classification_token)) {
          throw new Error(`${definitionLabel}.classification_token must be unique`);
        }
        resourceKinds.add(definition.resource_kind);
        classificationTokens.add(definition.classification_token);
        assertStringArray(definition.required_fields, `${definitionLabel}.required_fields`);
        if (!definition.required_fields.includes('resource_kind')) {
          throw new Error(`${definitionLabel}.required_fields must retain resource_kind discriminator`);
        }
        assertEqual(definition.status, 'typed_pending', `${definitionLabel}.status`);
      });
    }
  });
  return sha256(
    Buffer.from(
      `softbook-cet/mobile-ux-batch1-reference-contracts/v1\0${canonicalJson(contracts)}`,
      'utf8',
    ),
  );
}

function validateUnresolvedMigration(root, migration, artifactValues, {requireTracked}) {
  const label = `${REGISTRY_SET_PATH}.v1_unresolved_instance_migration`;
  assertExactKeys(
    migration,
    ['schema_version', 'source_artifacts', 'summary', 'instances', 'reference_contracts'],
    label,
  );
  assertEqual(
    migration.schema_version,
    'mobile-ux-batch1-v1-unresolved-migration.v1',
    `${label}.schema_version`,
  );
  assertExactArray(migration.source_artifacts, V1_UNRESOLVED_SOURCE_PATHS, `${label}.source_artifacts`);
  const derived = [];
  const v1SourceValues = new Map();
  for (const sourceArtifact of V1_UNRESOLVED_SOURCE_PATHS) {
    const bytes = readSemanticSource(root, sourceArtifact, sourceArtifact, {requireTracked});
    assertEqual(sha256(bytes), V1_UNRESOLVED_SOURCE_SHA256[sourceArtifact], `${sourceArtifact} raw SHA-256`);
    const value = parseStrictJson(bytes, sourceArtifact);
    v1SourceValues.set(sourceArtifact, value);
    collectV1Unresolved(value, sourceArtifact, [], derived);
  }
  if (derived.length !== 115) throw new Error(`${label} must derive exactly 115 physical v1 unresolved instances`);
  if (!Array.isArray(migration.instances) || migration.instances.length !== derived.length) {
    throw new Error(`${label}.instances must contain exactly 115 rows`);
  }
  const seenSourcePointers = new Set();
  const categoryPhysical = Object.fromEntries(Object.keys(CATEGORY_PHYSICAL_COUNTS).map((key) => [key, 0]));
  const categoryTokens = Object.fromEntries(Object.keys(CATEGORY_UNIQUE_COUNTS).map((key) => [key, new Set()]));
  const dispositionCounts = {
    resolved_by_exact_preparation_authority_ref_non_freeze: 0,
    schema_proposal_defined_pending_owner_acceptance: 0,
    schema_contract_defined_owner_value_pending: 0,
    typed_pending: 0,
  };

  migration.instances.forEach((instance, index) => {
    const instanceLabel = `${label}.instances[${index}]`;
    const expected = derived[index];
    const hasRequirement = Object.hasOwn(expected.value, 'requirement_id');
    const requiresSplitRefs = expected.value.reason_code === 'physical_device_and_build_identity_missing';
    const resolvedPreparation = index === 0;
    const keys = [
      'migration_id',
      'source_artifact',
      'json_pointer',
      ...(hasRequirement ? ['requirement_id'] : []),
      'reason_code',
      'classification_token',
      'category',
      'disposition',
      'v2_binding_ref',
      ...(requiresSplitRefs ? ['future_required_refs'] : []),
      ...(resolvedPreparation ? ['resolution_effect'] : []),
    ];
    assertExactKeys(instance, keys, instanceLabel);
    assertEqual(
      instance.migration_id,
      `v1-unresolved-${String(index + 1).padStart(3, '0')}`,
      `${instanceLabel}.migration_id`,
    );
    assertEqual(instance.source_artifact, expected.sourceArtifact, `${instanceLabel}.source_artifact`);
    assertEqual(instance.json_pointer, expected.jsonPointer, `${instanceLabel}.json_pointer`);
    if (hasRequirement) {
      assertEqual(instance.requirement_id, expected.value.requirement_id, `${instanceLabel}.requirement_id`);
    }
    assertEqual(instance.reason_code, expected.value.reason_code, `${instanceLabel}.reason_code`);
    const classificationToken = expected.value.requirement_id ?? expected.value.reason_code;
    assertEqual(instance.classification_token, classificationToken, `${instanceLabel}.classification_token`);
    const expectedCategory = UNRESOLVED_CATEGORY_BY_REASON[expected.value.reason_code];
    if (!expectedCategory) throw new Error(`${instanceLabel} has an unclassified v1 reason code`);
    assertEqual(instance.category, expectedCategory, `${instanceLabel}.category`);
    assertEqual(instance.disposition, expectedDisposition(instance.reason_code), `${instanceLabel}.disposition`);
    if (requiresSplitRefs) {
      if (!Array.isArray(instance.future_required_refs) || instance.future_required_refs.length !== 2) {
        throw new Error(`${instanceLabel}.future_required_refs must contain exact system and build refs`);
      }
      const expectedIds = [
        ['cs-ios-phone-client', 'build-cp-cs-ios'],
        ['cs-android-phone-client', 'build-cp-cs-android'],
        ['cs-ipados-client', 'build-cp-cs-ios'],
        ['cs-android-tablet-client', 'build-cp-cs-android'],
      ][index - 14];
      instance.future_required_refs.forEach((ref, refIndex) => {
        const refLabel = `${instanceLabel}.future_required_refs[${refIndex}]`;
        assertExactKeys(ref, ['requirement_kind', 'requirement_id', 'contract_ref', 'status'], refLabel);
        assertEqual(
          ref.requirement_kind,
          refIndex === 0 ? 'system_slot_ref' : 'build_ref',
          `${refLabel}.requirement_kind`,
        );
        assertEqual(ref.requirement_id, expectedIds[refIndex], `${refLabel}.requirement_id`);
        assertEqual(ref.status, 'typed_pending', `${refLabel}.status`);
        const contract = resolveArtifactReference(ref.contract_ref, artifactValues, `${refLabel}.contract_ref`);
        assertRecord(contract.value, `${refLabel} resolved contract`);
        if (refIndex === 0) {
          assertEqual(contract.value.category, 'machine_local_privacy_safe', `${refLabel} category`);
        } else {
          assertEqual(
            contract.value.resource_kind,
            'artifact_signing_and_distribution_identity',
            `${refLabel} resource_kind`,
          );
          assertEqual(contract.value.status, 'typed_pending', `${refLabel} status`);
        }
      });
    }
    if (resolvedPreparation) {
      assertEqual(
        instance.resolution_effect,
        'schema_preparation_authority_only_no_freeze_or_execution_authority',
        `${instanceLabel}.resolution_effect`,
      );
    }
    const sourcePointerKey = `${instance.source_artifact}#${instance.json_pointer}`;
    if (seenSourcePointers.has(sourcePointerKey)) {
      throw new Error(`${instanceLabel} duplicates v1 unresolved source pointer ${sourcePointerKey}`);
    }
    seenSourcePointers.add(sourcePointerKey);
    const sourceValue = resolveJsonPointer(
      v1SourceValues.get(instance.source_artifact),
      instance.json_pointer,
      `${instanceLabel}.json_pointer`,
    );
    if (sourceValue.kind !== 'unresolved' || sourceValue.reason_code !== instance.reason_code) {
      throw new Error(`${instanceLabel} does not re-resolve to its exact v1 unresolved object`);
    }
    const binding = resolveArtifactReference(instance.v2_binding_ref, artifactValues, `${instanceLabel}.v2_binding_ref`);
    if (resolvedPreparation) {
      assertRecord(binding.value, `${instanceLabel}.v2_binding_ref resolved preparation authority`);
      assertEqual(binding.value.scope, 'successor_schema_definition_only', `${instanceLabel} scope`);
      assertEqual(binding.value.decision_status, 'accepted_preparation_only', `${instanceLabel} decision_status`);
      assertExactArray(
        binding.value.does_not_authorize,
        ['cohort_designation', 'manifest_creation', 'reservation_activation', 'freeze', 'final_manifest_freeze', 'provision', 'execution', 'evidence', 'data_manifest_population', 'aggregation', 'promotion', 'architecture_acceptance', 'checkpoint_coverage_or_pass', 'visual', 'implementation', 'native', 'release', 'leadership_readiness'],
        `${instanceLabel}.does_not_authorize`,
      );
    } else if (instance.category === 'repo_resolvable') {
      if (instance.requirement_id?.startsWith('membership-stage-') || instance.requirement_id?.startsWith('intended-origin-')) {
        assertEqual(binding.value, instance.requirement_id, `${instanceLabel}.v2_binding_ref resolved value`);
      } else if (!Array.isArray(binding.value) || binding.value.length !== 173) {
        throw new Error(`${instanceLabel}.v2_binding_ref must resolve to an exact 173-record partition`);
      }
    } else if (instance.category === 'external_account_environment') {
      assertRecord(binding.value, `${instanceLabel}.v2_binding_ref resolved resource-kind contract`);
      if (
        binding.artifactPath !== REGISTRY_SET_PATH ||
        !/^\/v1_unresolved_instance_migration\/reference_contracts\/1\/resource_kind_definitions\/\d+$/.test(
          binding.pointer,
        )
      ) {
        throw new Error(
          `${instanceLabel}.v2_binding_ref must resolve inside the external-account resource-kind definitions`,
        );
      }
      assertNonEmptyString(binding.value.resource_kind, `${instanceLabel}.v2_binding_ref resource_kind`);
      assertEqual(
        binding.value.classification_token,
        instance.classification_token,
        `${instanceLabel}.v2_binding_ref classification_token`,
      );
      assertEqual(binding.value.status, 'typed_pending', `${instanceLabel}.v2_binding_ref status`);
      const externalParent = resolveArtifactReference(
        `${REGISTRY_SET_PATH}#/v1_unresolved_instance_migration/reference_contracts/1`,
        artifactValues,
        `${instanceLabel}.external parent contract`,
      );
      assertEqual(
        externalParent.value.category,
        'external_account_environment',
        `${instanceLabel}.external parent category`,
      );
      assertAuthorityObjectFalse(
        externalParent.value.authority,
        `${instanceLabel}.external parent authority`,
      );
    } else {
      assertRecord(binding.value, `${instanceLabel}.v2_binding_ref resolved contract`);
      assertEqual(binding.value.category, instance.category, `${instanceLabel}.v2_binding_ref category`);
      assertEqual(binding.value.status, 'typed_pending', `${instanceLabel}.v2_binding_ref status`);
      assertAuthorityObjectFalse(binding.value.authority, `${instanceLabel}.v2_binding_ref authority`);
    }
    categoryPhysical[instance.category] += 1;
    categoryTokens[instance.category].add(instance.classification_token);
    dispositionCounts[instance.disposition] += 1;
  });

  for (const [category, count] of Object.entries(CATEGORY_PHYSICAL_COUNTS)) {
    assertEqual(categoryPhysical[category], count, `${label} physical count for ${category}`);
  }
  for (const [category, count] of Object.entries(CATEGORY_UNIQUE_COUNTS)) {
    assertEqual(categoryTokens[category].size, count, `${label} unique token count for ${category}`);
  }
  const referenceContractsDigest = validateReferenceContracts(
    migration.reference_contracts,
    `${label}.reference_contracts`,
  );
  assertEqual(
    referenceContractsDigest,
    EXPECTED_REFERENCE_CONTRACTS_DIGEST,
    `${label}.reference_contracts exact semantic digest`,
  );
  const migrationDigest = sha256(
    Buffer.from(`${MIGRATION_DIGEST_DOMAIN}\0${JSON.stringify(migration.instances)}`, 'utf8'),
  );
  assertEqual(migrationDigest, EXPECTED_MIGRATION_DIGEST, `${label} exact inventory digest`);
  assertExactKeys(
    migration.summary,
    [
      'physical_instance_count',
      'unique_classification_token_count',
      'category_physical_counts',
      'category_unique_token_counts',
      'inventory_digest_algorithm',
      'inventory_digest',
      'disposition_counts',
      'inventory_digest_domain_separator',
      'inventory_digest_subject_fields',
      'historical_inventory_status',
      'resolved_instance_count',
    ],
    `${label}.summary`,
  );
  assertEqual(migration.summary.physical_instance_count, 115, `${label}.summary.physical_instance_count`);
  assertEqual(migration.summary.unique_classification_token_count, 88, `${label}.summary.unique_classification_token_count`);
  assertEqual(migration.summary.resolved_instance_count, 1, `${label}.summary.resolved_instance_count`);
  assertEqual(
    migration.summary.historical_inventory_status,
    '115_v1_instances_migrated_one_structurally_resolved_114_remain_pending_or_owner_proposed',
    `${label}.summary.historical_inventory_status`,
  );
  assertExactKeys(
    migration.summary.category_physical_counts,
    Object.keys(CATEGORY_PHYSICAL_COUNTS),
    `${label}.summary.category_physical_counts`,
  );
  for (const [category, count] of Object.entries(CATEGORY_PHYSICAL_COUNTS)) {
    assertEqual(migration.summary.category_physical_counts[category], count, `${label}.summary.category_physical_counts.${category}`);
  }
  for (const [category, count] of Object.entries(CATEGORY_UNIQUE_COUNTS)) {
    assertEqual(migration.summary.category_unique_token_counts[category], count, `${label}.summary.category_unique_token_counts.${category}`);
  }
  assertExactKeys(
    migration.summary.category_unique_token_counts,
    Object.keys(CATEGORY_UNIQUE_COUNTS),
    `${label}.summary.category_unique_token_counts`,
  );
  assertEqual(
    migration.summary.inventory_digest_algorithm,
    'sha256(domain_separator_nul_json_stringify_ordered_instances)',
    `${label}.summary.inventory_digest_algorithm`,
  );
  assertEqual(migration.summary.inventory_digest, migrationDigest, `${label}.summary.inventory_digest`);
  assertEqual(
    migration.summary.inventory_digest_domain_separator,
    MIGRATION_DIGEST_DOMAIN,
    `${label}.summary.inventory_digest_domain_separator`,
  );
  assertExactArray(
    migration.summary.inventory_digest_subject_fields,
    [
      'migration_id',
      'source_artifact',
      'json_pointer',
      'requirement_id',
      'reason_code',
      'classification_token',
      'category',
      'disposition',
      'v2_binding_ref',
      'future_required_refs_when_present',
    ],
    `${label}.summary.inventory_digest_subject_fields`,
  );
  assertExactKeys(
    migration.summary.disposition_counts,
    Object.keys(dispositionCounts),
    `${label}.summary.disposition_counts`,
  );
  for (const [disposition, count] of Object.entries(dispositionCounts)) {
    assertEqual(migration.summary.disposition_counts[disposition], count, `${label}.summary.disposition_counts.${disposition}`);
  }
  return {
    migratedInstanceCount: migration.instances.length,
    uniqueRequirementCount: new Set(migration.instances.map((item) => item.classification_token)).size,
    pendingInstanceCount: migration.instances.length - 1,
    migrationDigest,
    referenceContractsDigest,
  };
}

function scanSensitiveMaterial(value, label = 'candidate', {schemaDenylist = false} = {}) {
  if (typeof value === 'string') {
    if (schemaDenylist) return;
    const forbidden = [
      /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)/,
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
      /(?:^|\D)1[3-9]\d{9}(?:$|\D)/,
      /\b(?:serial|udid|android[_ -]?id|mac|hostname|credential|token|private[_ -]?key|temporary[_ -]?private[_ -]?download[_ -]?url)\b/i,
    ];
    if (forbidden.some((pattern) => pattern.test(value))) {
      throw new Error(`${label} contains forbidden sensitive material`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => scanSensitiveMaterial(child, `${label}[${index}]`, {schemaDenylist}));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      scanSensitiveMaterial(child, `${label}.${key}`, {schemaDenylist: key === 'forbidden_fields'});
    }
  }
}

function validateChild(
  child,
  expected,
  truth,
  bindingIds,
  {root, artifactValues, requirementUsage, requireTracked},
) {
  const label = expected.path;
  assertExactKeys(child, CHILD_KEYS, label);
  validateCommonHeader(child, label);
  if (!expected.schemaPattern.test(child.schema_version)) {
    throw new Error(`${label}.schema_version is invalid`);
  }
  assertNonEmptyString(child.registry_id, `${label}.registry_id`);
  assertEqual(child.checkpoint_id, expected.checkpointId, `${label}.checkpoint_id`);
  validateSourceBinding(child.source_universe_binding, `${label}.source_universe_binding`);
  const lanes = validateLanes(child, label, artifactValues, requirementUsage);
  const truthById = new Map(truth.map((item) => [item.id, item]));
  const overlays = validateOverlays(child, truthById, label);
  if (!Array.isArray(child.obligation_records) || child.obligation_records.length !== 173) {
    throw new Error(`${label}.obligation_records must contain exactly 173 records`);
  }

  let primaryLaneRecordCount = 0;
  let exclusionCount = 0;
  let managedOverlayRecordCount = 0;
  let bindingCount = 0;
  let emptyBindingCount = 0;
  let setupOnlyBindingCount = 0;
  let primaryOrMatrixBindingCount = 0;
  const seenObligations = new Set();
  const recordsById = new Map();

  child.obligation_records.forEach((record, index) => {
    const recordLabel = `${label}.obligation_records[${index}]`;
    const hasExclusion = Object.hasOwn(record, 'owner_backed_exclusion');
    assertExactKeys(
      record,
      hasExclusion ? [...RECORD_BASE_KEYS, 'owner_backed_exclusion'] : RECORD_BASE_KEYS,
      recordLabel,
    );
    const expectedTruth = truth[index];
    assertEqual(record.obligation_id, expectedTruth.id, `${recordLabel}.obligation_id`);
    assertEqual(record.title, expectedTruth.title, `${recordLabel}.title`);
    assertEqual(record.kind, expectedTruth.kind, `${recordLabel}.kind`);
    assertExactArray(record.authority_codes, expectedTruth.authorityCodes, `${recordLabel}.authority_codes`);
    if (seenObligations.has(record.obligation_id)) throw new Error(`${recordLabel}.obligation_id must be unique`);
    seenObligations.add(record.obligation_id);
    assertNonEmptyString(record.disposition, `${recordLabel}.disposition`);
    if (!Array.isArray(record.bindings)) throw new Error(`${recordLabel}.bindings must be an array`);
    if (record.bindings.length === 0) emptyBindingCount += 1;
    let hasPrimary = false;
    let hasMatrix = false;
    let hasSetup = false;
    let hasManaged = false;
    record.bindings.forEach((binding, bindingIndex) => {
      validateBinding(binding, {
        checkpointId: child.checkpoint_id,
        obligationId: record.obligation_id,
        lanes,
        bindingIds,
        label: `${recordLabel}.bindings[${bindingIndex}]`,
      });
      bindingCount += 1;
      if (binding.coverage_role === 'primary_required') hasPrimary = true;
      if (binding.coverage_role === 'cp_web_matrix_and_required') hasMatrix = true;
      if (binding.coverage_role === 'setup_only_no_coverage_credit') hasSetup = true;
      if (binding.coverage_role === 'setup_only_no_coverage_credit') setupOnlyBindingCount += 1;
      if (['primary_required', 'cp_web_matrix_and_required'].includes(binding.coverage_role)) {
        primaryOrMatrixBindingCount += 1;
      }
      if (
        binding.profile_id === 'receiver_managed' &&
        binding.coverage_role === 'cross_dimension_required'
      ) {
        hasManaged = true;
      }
    });
    if (hasPrimary) primaryLaneRecordCount += 1;
    if (hasManaged) managedOverlayRecordCount += 1;
    if (hasExclusion) {
      exclusionCount += 1;
      validateExclusion(record.owner_backed_exclusion, `${recordLabel}.owner_backed_exclusion`, {
        root,
        obligationId: record.obligation_id,
        requireTracked,
      });
      if (hasPrimary) {
        throw new Error(`${recordLabel} cannot combine a primary partition binding with an owner-backed exclusion`);
      }
    } else if (!hasPrimary && !hasMatrix && !hasSetup) {
      throw new Error(`${recordLabel} must have a primary/setup binding or an owner-backed exclusion`);
    }
    recordsById.set(record.obligation_id, record);
  });

  for (const overlay of overlays.values()) {
    for (const obligationId of overlay.exact_obligation_ids) {
      const record = recordsById.get(obligationId);
      const matches = record.bindings.filter(
        (binding) =>
          binding.profile_id === overlay.profile_id && binding.coverage_role === 'cross_dimension_required',
      );
      if (matches.length !== 1) {
        throw new Error(`${label} ${overlay.profile_id} overlay must have one matching cross-dimension binding for ${obligationId}`);
      }
    }
  }

  if (child.checkpoint_id === 'CP-BA') {
    if (exclusionCount !== 0) throw new Error(`${label} must not use owner-backed exclusions`);
    for (const record of child.obligation_records) {
      assertEqual(record.disposition, 'blocked_pending_owner_exact_tier2_set', `${label}.${record.obligation_id}.disposition`);
    }
    const managed = overlays.get('receiver_managed');
    if (!managed) throw new Error(`${label} must retain the receiver_managed overlay`);
    assertExactArray(managed.exact_obligation_ids, MANAGED_OVERLAY_IDS, `${label}.receiver_managed exact IDs`);
    if (managedOverlayRecordCount !== 91) {
      throw new Error(`${label} must bind the receiver_managed overlay to exactly 91 records`);
    }
  }
  if (child.checkpoint_id === 'CP-CS') {
    if (exclusionCount !== 16) throw new Error(`${label} must contain exactly 16 owner-backed exclusions`);
    const managed = overlays.get('receiver_managed');
    if (!managed || managed.exact_obligation_ids.length !== 91) {
      throw new Error(`${label} must define the exact 91-obligation receiver_managed overlay`);
    }
    if (managedOverlayRecordCount !== 91) {
      throw new Error(`${label} must bind the receiver_managed overlay to exactly 91 records`);
    }
    const exclusionIds = child.obligation_records
      .filter((record) => Object.hasOwn(record, 'owner_backed_exclusion'))
      .map((record) => record.obligation_id);
    assertExactArray(exclusionIds, CP_CS_EXCLUSION_IDS, `${label} exact owner-backed exclusion IDs`);
    assertExactArray(managed.exact_obligation_ids, MANAGED_OVERLAY_IDS, `${label}.receiver_managed exact IDs`);
    for (const record of child.obligation_records) {
      const crossDeviceTargets = record.bindings
        .filter((binding) => binding.lane_id === 'cs-cross-device-reconciliation')
        .map((binding) => binding.target_id);
      if (crossDeviceTargets.length > 0) {
        assertExactArray(
          crossDeviceTargets,
          ['cs-ios-phone-client', 'cs-android-phone-client', 'web-desktop-primary'],
          `${label}.${record.obligation_id} cross-device AND targets`,
        );
      }
    }
  }
  let pwRowBindingDigests = null;
  if (child.checkpoint_id === 'CP-WEB') {
    if (exclusionCount !== 0) throw new Error(`${label} must not use owner-backed exclusions`);
    const cov13 = recordsById.get('COV-13');
    const targetIds = cov13.bindings
      .filter((binding) => binding.coverage_role === 'cp_web_matrix_and_required')
      .map((binding) => binding.matrix_row_id);
    assertExactArray(targetIds, PW_MATRIX_IDS, `${label}.COV-13 target rows`);
    pwRowBindingDigests = validatePwRowPartitions(child, label);
  }

  const embeddedDigest = embeddedPartitionDigest(child);
  const summary = {
    expected_obligation_count: 173,
    actual_obligation_count: child.obligation_records.length,
    semantic_state_count: 160,
    forced_combination_count: 13,
    primary_lane_record_count: primaryLaneRecordCount,
    owner_backed_exclusion_count: exclusionCount,
    binding_count: bindingCount,
    wildcard_count: 0,
    obligation_record_count: child.obligation_records.length,
    receiver_managed_binding_record_count: managedOverlayRecordCount,
    empty_binding_record_count: emptyBindingCount,
    setup_only_no_coverage_binding_count: setupOnlyBindingCount,
    primary_or_matrix_required_binding_count: primaryOrMatrixBindingCount,
    partition_digest_algorithm: 'sha256(domain_separator_nul_json_stringify_partition_subject)',
    partition_digest_domain_separator: embeddedDigest.domain,
    partition_digest_subject_fields: ['lane_definitions', 'profile_overlays', 'obligation_records'],
    partition_digest: embeddedDigest.digest,
  };
  assertExactKeys(child.partition_summary, SUMMARY_KEYS, `${label}.partition_summary`);
  for (const key of SUMMARY_KEYS) {
    if (Array.isArray(summary[key])) {
      assertExactArray(child.partition_summary[key], summary[key], `${label}.partition_summary.${key}`);
    } else {
      assertEqual(child.partition_summary[key], summary[key], `${label}.partition_summary.${key}`);
    }
  }
  const partitionDigest = semanticPartitionDigest(child);
  const expectedDigest = EXPECTED_PARTITION_DIGESTS[child.checkpoint_id];
  if (expectedDigest && partitionDigest !== expectedDigest) {
    throw new Error(
      `${label} partition semantic digest mismatch: expected ${expectedDigest}, received ${partitionDigest}`,
    );
  }
  return {
    checkpointId: child.checkpoint_id,
    schemaVersion: child.schema_version,
    obligationCount: child.obligation_records.length,
    bindingCount,
    exclusionCount,
    partitionDigest,
    pwRowBindingDigests,
  };
}

const CURRENT_REQUIREMENT_KIND_COUNTS = Object.freeze({
  account: 8,
  build: 5,
  compatibility: 5,
  content: 5,
  environment: 8,
  execution_window: 3,
  intended_origin: 14,
  membership_stage: 14,
  owner_exact_scope: 12,
  product_profile_subject: 14,
  provider_lane: 11,
  role: 33,
  target: 13,
});
const EXPECTED_CURRENT_REQUIREMENT_INVENTORY_DIGEST =
  'c73e4fa89967298bc01dbdb4476028e462f5d57ab64705c1fcc88d99c4a96dac';
const AGGREGATE_EXECUTION_LANE_KINDS = Object.freeze({
  'CP-BA': new Set(['platform_browser', 'shared_formal_access', 'shared_managed_access']),
  'CP-CS': new Set(['canonical_service', 'native_ios', 'native_android', 'cross_device']),
  'CP-WEB': new Set(['pc_web']),
});

function validateCurrentRequirementRegistry({
  root,
  registrySet,
  artifactBytes,
  artifactValues,
  children,
  requirementUsage,
  requireTracked,
}) {
  const registry = registrySet.current_requirement_registry;
  const label = `${REGISTRY_SET_PATH}.current_requirement_registry`;
  assertExactKeys(
    registry,
    [
      'registry_id',
      'status',
      'requirements_by_id',
      'requirement_count',
      'pending_requirement_count',
      'lane_binding_count',
      'aggregate_binding_count',
      'lane_binding_index',
      'aggregate_bindings',
      'inventory_digest_domain_separator',
      'inventory_digest',
      'authority',
    ],
    label,
  );
  assertEqual(registry.registry_id, 'mobile-ux-batch1-current-typed-requirements-v1', `${label}.registry_id`);
  assertEqual(registry.status, 'typed_requirements_defined_values_pending', `${label}.status`);
  assertAuthorityObjectFalse(registry.authority, `${label}.authority`);
  assertRecord(registry.requirements_by_id, `${label}.requirements_by_id`);
  const entries = Object.entries(registry.requirements_by_id);
  assertEqual(entries.length, 145, `${label}.requirements_by_id count`);
  const kindCounts = Object.fromEntries(Object.keys(CURRENT_REQUIREMENT_KIND_COUNTS).map((key) => [key, 0]));
  for (const [requirementId, requirement] of entries) {
    const requirementLabel = `${label}.requirements_by_id.${requirementId}`;
    assertExactKeys(
      requirement,
      [
        'requirement_id',
        'requirement_kind',
        'subject_discriminator',
        'source_binding',
        ...(requirement.requirement_kind === 'owner_exact_scope' ? ['semantic_owner_refs'] : []),
        'allowed_value_class',
        'pending_value_ref',
        'pending_values',
        'status',
        'authority',
        ...(['membership_stage', 'intended_origin'].includes(requirement.requirement_kind)
          ? ['owner_backed_not_applicable_ref']
          : []),
      ],
      requirementLabel,
    );
    assertEqual(requirement.requirement_id, requirementId, `${requirementLabel}.requirement_id`);
    if (!Object.hasOwn(kindCounts, requirement.requirement_kind)) {
      throw new Error(`${requirementLabel}.requirement_kind is not allowlisted`);
    }
    kindCounts[requirement.requirement_kind] += 1;
    assertRecord(requirement.subject_discriminator, `${requirementLabel}.subject_discriminator`);
    if (Object.keys(requirement.subject_discriminator).length === 0) {
      throw new Error(`${requirementLabel}.subject_discriminator must not be generic or empty`);
    }
    assertExactKeys(
      requirement.source_binding,
      ['path', 'locator_kind', 'locator', 'raw_sha256'],
      `${requirementLabel}.source_binding`,
    );
    assertEqual(
      requirement.source_binding.locator_kind,
      'json_pointer',
      `${requirementLabel}.source_binding.locator_kind`,
    );
    const sourceBytes = artifactBytes.has(requirement.source_binding.path)
      ? artifactBytes.get(requirement.source_binding.path)
      : readSemanticSource(
          root,
          requirement.source_binding.path,
          `${requirementLabel}.source_binding.path`,
          {requireTracked},
        );
    if (!Buffer.isBuffer(sourceBytes)) {
      throw new Error(`${requirementLabel}.source_binding cannot read exact source bytes`);
    }
    assertEqual(
      sha256(sourceBytes),
      requirement.source_binding.raw_sha256,
      `${requirementLabel}.source_binding.raw_sha256`,
    );
    resolveJsonPointer(
      parseStrictJson(sourceBytes, requirement.source_binding.path),
      requirement.source_binding.locator,
      `${requirementLabel}.source_binding.locator`,
    );
    if (requirement.requirement_kind === 'owner_exact_scope') {
      assertStringArray(requirement.semantic_owner_refs, `${requirementLabel}.semantic_owner_refs`);
      assertEqual(
        requirement.allowed_value_class,
        'owner_exact_obligation_id_set',
        `${requirementLabel}.allowed_value_class`,
      );
      assertExactArray(
        requirement.subject_discriminator.minimum_anchor_obligation_ids,
        ['COV-13'],
        `${requirementLabel}.minimum_anchor_obligation_ids`,
      );
      assertEqual(
        requirement.subject_discriminator.minimum_anchor_exact_scope_effect,
        'none',
        `${requirementLabel}.minimum_anchor_exact_scope_effect`,
      );
    } else if (requirement.requirement_kind === 'membership_stage') {
      assertEqual(
        requirement.allowed_value_class,
        'owner_selected_membership_stage_set_or_owner_backed_not_applicable',
        `${requirementLabel}.allowed_value_class`,
      );
      assertEqual(
        requirement.owner_backed_not_applicable_ref,
        null,
        `${requirementLabel}.owner_backed_not_applicable_ref`,
      );
    } else if (requirement.requirement_kind === 'intended_origin') {
      assertEqual(
        requirement.allowed_value_class,
        'owner_selected_safe_origin_descriptor_or_owner_backed_not_applicable',
        `${requirementLabel}.allowed_value_class`,
      );
      assertEqual(
        requirement.owner_backed_not_applicable_ref,
        null,
        `${requirementLabel}.owner_backed_not_applicable_ref`,
      );
    } else {
      assertNonEmptyString(requirement.allowed_value_class, `${requirementLabel}.allowed_value_class`);
    }
    assertEqual(requirement.pending_value_ref, null, `${requirementLabel}.pending_value_ref`);
    assertExactArray(requirement.pending_values, [], `${requirementLabel}.pending_values`);
    assertEqual(requirement.status, 'typed_value_pending', `${requirementLabel}.status`);
    assertAuthorityObjectFalse(requirement.authority, `${requirementLabel}.authority`);
  }
  for (const [kind, expectedCount] of Object.entries(CURRENT_REQUIREMENT_KIND_COUNTS)) {
    assertEqual(kindCounts[kind], expectedCount, `${label} ${kind} count`);
  }
  assertEqual(registry.requirement_count, 145, `${label}.requirement_count`);
  assertEqual(registry.pending_requirement_count, 145, `${label}.pending_requirement_count`);
  assertEqual(
    registry.inventory_digest_domain_separator,
    'mobile-ux-batch1-current-requirement-registry.v1',
    `${label}.inventory_digest_domain_separator`,
  );
  const inventoryDigest = sha256(
    Buffer.from(
      `${registry.inventory_digest_domain_separator}\0${JSON.stringify(registry.requirements_by_id)}`,
      'utf8',
    ),
  );
  assertEqual(registry.inventory_digest, inventoryDigest, `${label}.inventory_digest`);
  assertEqual(
    inventoryDigest,
    EXPECTED_CURRENT_REQUIREMENT_INVENTORY_DIGEST,
    `${label} reviewed current requirement inventory digest`,
  );

  const orderedLanes = children.flatMap(({value}, childIndex) =>
    value.lane_definitions.map((lane, laneIndex) => ({
      checkpointId: CHILDREN[childIndex].checkpointId,
      path: CHILDREN[childIndex].path,
      lane,
      laneIndex,
    })),
  );
  assertEqual(registry.lane_binding_count, orderedLanes.length, `${label}.lane_binding_count`);
  if (!Array.isArray(registry.lane_binding_index) || registry.lane_binding_index.length !== orderedLanes.length) {
    throw new Error(`${label}.lane_binding_index must contain exactly ${orderedLanes.length} lanes`);
  }
  registry.lane_binding_index.forEach((entry, index) => {
    const entryLabel = `${label}.lane_binding_index[${index}]`;
    const expected = orderedLanes[index];
    assertExactKeys(entry, ['checkpoint_id', 'lane_id', 'registry_path', 'lane_pointer', 'requirement_ids'], entryLabel);
    assertEqual(entry.checkpoint_id, expected.checkpointId, `${entryLabel}.checkpoint_id`);
    assertEqual(entry.lane_id, expected.lane.lane_id, `${entryLabel}.lane_id`);
    assertEqual(entry.registry_path, expected.path, `${entryLabel}.registry_path`);
    assertEqual(entry.lane_pointer, `/lane_definitions/${expected.laneIndex}`, `${entryLabel}.lane_pointer`);
    const requirementIds = REQUIREMENT_BINDING_KEYS.flatMap((key) =>
      expected.lane.requirement_bindings[key].map((ref) => ref.requirement_id),
    );
    assertExactArray(entry.requirement_ids, requirementIds, `${entryLabel}.requirement_ids`);
  });

  if (!Array.isArray(registry.aggregate_bindings) || registry.aggregate_bindings.length !== 3) {
    throw new Error(`${label}.aggregate_bindings must contain exactly three checkpoint aggregates`);
  }
  assertEqual(registry.aggregate_binding_count, 3, `${label}.aggregate_binding_count`);
  registry.aggregate_bindings.forEach((aggregate, index) => {
    const aggregateLabel = `${label}.aggregate_bindings[${index}]`;
    const checkpointId = CHILDREN[index].checkpointId;
    assertExactKeys(aggregate, ['checkpoint_id', 'aggregate_id', 'requirement_bindings'], aggregateLabel);
    assertEqual(aggregate.checkpoint_id, checkpointId, `${aggregateLabel}.checkpoint_id`);
    assertEqual(aggregate.aggregate_id, `${checkpointId.toLowerCase()}-aggregate`, `${aggregateLabel}.aggregate_id`);
    validateRequirementBindings(
      aggregate.requirement_bindings,
      `${aggregateLabel}.requirement_bindings`,
      artifactValues,
      requirementUsage,
    );
    const checkpointLanes = orderedLanes
      .filter(
        (entry) =>
          entry.checkpointId === checkpointId &&
          AGGREGATE_EXECUTION_LANE_KINDS[checkpointId].has(entry.lane.lane_kind),
      )
      .map((entry) => entry.lane);
    for (const key of REQUIREMENT_BINDING_KEYS) {
      const exactOrderedUnion = [];
      const seen = new Set();
      for (const lane of checkpointLanes) {
        for (const ref of lane.requirement_bindings[key]) {
          if (!seen.has(ref.requirement_id)) {
            seen.add(ref.requirement_id);
            exactOrderedUnion.push(ref.requirement_id);
          }
        }
      }
      assertExactArray(
        aggregate.requirement_bindings[key].map((ref) => ref.requirement_id),
        exactOrderedUnion,
        `${aggregateLabel}.${key} exact ordered scenario-lane union`,
      );
    }
  });
  const registryIds = Object.keys(registry.requirements_by_id);
  assertExactArray(
    [...requirementUsage].sort(),
    [...registryIds].sort(),
    `${label} no orphan current requirement IDs`,
  );
  return {requirementCount: registry.requirement_count, pendingRequirementCount: registry.pending_requirement_count, inventoryDigest};
}

function assertExactBooleanMask(actual, expected, label) {
  assertExactKeys(actual, Object.keys(expected), label);
  for (const [key, expectedValue] of Object.entries(expected)) {
    assertEqual(actual[key], expectedValue, `${label}.${key}`);
  }
}

function validateSuccessorTransitionContract(registrySet, root, {requireTracked}) {
  const contract = registrySet.successor_transition_contract;
  const label = `${REGISTRY_SET_PATH}.successor_transition_contract`;
  assertExactKeys(
    contract,
    [
      'schema_version',
      'contract_status',
      'current_candidate_invariants',
      'ordered_stage_ids',
      'post_designation_requirement_ids_by_kind',
      'designation_bound_build_contract',
      'execution_window_contract',
      'compatibility_derivation_contract',
      'decision_authority_bootstrap',
      'decision_instance_contract',
      'approval_receipt_contract',
      'staged_parent_contract',
      'decision_separation_requirements',
      'stages',
      'forbidden_decision_substitutions',
      'final_freeze_decision_ref_forbidden_in_subject_requirement_values',
      'authority_key_policy',
      'authority',
    ],
    label,
  );
  assertEqual(
    contract.schema_version,
    'mobile-ux-batch1-successor-transition.v1',
    `${label}.schema_version`,
  );
  assertEqual(
    contract.contract_status,
    'future_sequence_defined_current_candidate_unchanged',
    `${label}.contract_status`,
  );
  assertAuthorityObjectFalse(contract.authority, `${label}.authority`);

  const current = contract.current_candidate_invariants;
  assertExactKeys(
    current,
    [
      'requirement_registry_ref',
      'requirement_count',
      'pending_requirement_count',
      'required_requirement_status',
      'authority_state',
      'execution_manifest_root',
      'execution_manifest_root_required_state',
    ],
    `${label}.current_candidate_invariants`,
  );
  assertEqual(current.requirement_registry_ref, '#/current_requirement_registry', `${label} current registry ref`);
  assertEqual(current.requirement_count, 145, `${label} current requirement count`);
  assertEqual(current.pending_requirement_count, 145, `${label} current pending count`);
  assertEqual(current.required_requirement_status, 'typed_value_pending', `${label} current requirement status`);
  assertEqual(current.authority_state, 'all_false', `${label} current authority state`);
  assertEqual(current.execution_manifest_root, EXECUTION_MANIFEST_ROOT, `${label} execution manifest root`);
  assertEqual(current.execution_manifest_root_required_state, 'absent', `${label} execution manifest root state`);
  assertEqual(
    registrySet.current_requirement_registry.requirement_count,
    current.requirement_count,
    `${label} current requirement count binding`,
  );
  assertEqual(
    registrySet.current_requirement_registry.pending_requirement_count,
    current.pending_requirement_count,
    `${label} current pending count binding`,
  );

  assertExactArray(contract.ordered_stage_ids, SUCCESSOR_STAGE_IDS, `${label}.ordered_stage_ids`);
  const deferredByKind = contract.post_designation_requirement_ids_by_kind;
  assertExactKeys(
    deferredByKind,
    ['build', 'execution_window', 'compatibility'],
    `${label}.post_designation_requirement_ids_by_kind`,
  );
  const deferredIds = [];
  for (const [kind, expectedIds] of Object.entries(POST_DESIGNATION_REQUIREMENT_IDS_BY_KIND)) {
    assertExactArray(
      deferredByKind[kind],
      expectedIds,
      `${label}.post_designation_requirement_ids_by_kind.${kind}`,
    );
    for (const requirementId of expectedIds) {
      const requirement = registrySet.current_requirement_registry.requirements_by_id[requirementId];
      if (!requirement) throw new Error(`${label} deferred requirement is missing: ${requirementId}`);
      assertEqual(requirement.requirement_kind, kind, `${label} deferred ${requirementId} kind`);
      assertEqual(requirement.status, 'typed_value_pending', `${label} deferred ${requirementId} status`);
      assertAuthorityObjectFalse(requirement.authority, `${label} deferred ${requirementId} authority`);
      deferredIds.push(requirementId);
    }
  }
  assertEqual(new Set(deferredIds).size, 9, `${label} exact post-designation requirement count`);
  assertEqual(
    Object.keys(registrySet.current_requirement_registry.requirements_by_id)
      .filter((requirementId) => !deferredIds.includes(requirementId)).length,
    136,
    `${label} exact R0 resolution requirement count`,
  );
  assertEqual(
    registrySet.current_requirement_registry.requirements_by_id['build-cp-ba-browser-documents']
      .subject_discriminator.candidate.reason_code,
    'protected_cohort_designation_missing',
    `${label} CP-BA build designation prerequisite`,
  );

  const build = contract.designation_bound_build_contract;
  assertExactKeys(
    build,
    [
      'schema_version',
      'requirement_id',
      'allowed_value_class',
      'required_value_fields',
      'ordered_value_source_bindings',
      'all_value_fields_must_equal_exact_sources',
      'exact_value_keys_required',
      'source_closure_record_required_fields',
      'source_closure_record_exact_keys_required',
      'required_git_mode',
      'source_closure_must_match_designated_subject',
      'untracked_or_dirty_source_forbidden',
      'recompute_build_output_on_any_source_drift',
      'source_closure_digest_contract',
      'build_output_digest_contract',
      'build_recipe_contract',
    ],
    `${label}.designation_bound_build_contract`,
  );
  assertEqual(build.schema_version, 'mobile-ux-batch1-designation-bound-build.v1', `${label} build schema`);
  assertEqual(build.requirement_id, 'build-cp-ba-browser-documents', `${label} build requirement ID`);
  assertEqual(
    build.allowed_value_class,
    'designation_bound_source_closure_build_value_v1',
    `${label} build allowed value class`,
  );
  assertExactArray(
    build.required_value_fields,
    [
      'designation_subject_commit',
      'designation_subject_digest_domain',
      'designation_subject_digest',
      'designated_cohort_id',
      'designated_cohort_sha256',
      'designation_approval_instance_digest',
      'build_recipe_id',
      'build_recipe_raw_sha256',
      'toolchain_lock_raw_sha256',
      'build_output_role',
      'source_closure_records',
      'source_closure_digest',
      'build_output_artifact',
    ],
    `${label} build required value fields`,
  );
  const expectedBuildValueSources = [
    ['designation_subject_commit', 'exact_D1_decision_intent.designation_subject_commit'],
    ['designation_subject_digest_domain', 'exact_D1_decision_intent.designation_subject_digest_domain'],
    ['designation_subject_digest', 'exact_D1_decision_intent.designation_subject_digest'],
    ['designated_cohort_id', 'exact_D1_decision_intent.designated_cohort_id'],
    ['designated_cohort_sha256', 'exact_D1_decision_intent.designated_cohort_sha256'],
    ['designation_approval_instance_digest', 'recomputed_D1_approval_receipt.approval_instance_digest'],
    ['build_recipe_id', 'designation_bound_build_contract.build_recipe_contract.build_recipe_id'],
    ['build_recipe_raw_sha256', 'recomputed_raw_sha256_of_recipe_path_blob_at_designation_subject_commit'],
    ['toolchain_lock_raw_sha256', 'recomputed_raw_sha256_of_toolchain_lock_path_blob_at_designation_subject_commit'],
    ['build_output_role', 'designation_bound_build_contract.build_recipe_contract.build_output_role'],
    ['source_closure_records', 'recomputed_exact_build_recipe_source_closure_records_at_designation_subject_commit'],
    ['source_closure_digest', 'recomputed_source_closure_digest_from_exact_ordered_source_closure_records'],
    ['build_output_artifact', 'recomputed_clean_hermetic_build_output_artifact_at_exact_build_output_path'],
  ];
  if (!Array.isArray(build.ordered_value_source_bindings) || build.ordered_value_source_bindings.length !== expectedBuildValueSources.length) {
    throw new Error(`${label} build value sources must contain exactly thirteen ordered bindings`);
  }
  build.ordered_value_source_bindings.forEach((entry, index) => {
    assertExactKeys(entry, ['field_id', 'source'], `${label} build value source[${index}]`);
    assertEqual(entry.field_id, expectedBuildValueSources[index][0], `${label} build value source[${index}].field_id`);
    assertEqual(entry.source, expectedBuildValueSources[index][1], `${label} build value source[${index}].source`);
  });
  assertEqual(build.all_value_fields_must_equal_exact_sources, true, `${label} build value-source equality`);
  assertEqual(build.exact_value_keys_required, true, `${label} build exact value keys`);
  assertExactArray(
    build.source_closure_record_required_fields,
    ['path', 'git_mode', 'byte_length', 'raw_sha256'],
    `${label} build source closure record fields`,
  );
  assertEqual(build.source_closure_record_exact_keys_required, true, `${label} build exact source record keys`);
  assertEqual(build.required_git_mode, '100644', `${label} build source closure git mode`);
  assertEqual(build.source_closure_must_match_designated_subject, true, `${label} build designation binding`);
  assertEqual(build.untracked_or_dirty_source_forbidden, true, `${label} build tracked clean source policy`);
  assertEqual(build.recompute_build_output_on_any_source_drift, true, `${label} build drift recomputation`);
  const sourceClosure = build.source_closure_digest_contract;
  assertExactKeys(
    sourceClosure,
    [
      'algorithm',
      'version',
      'domain_separator',
      'canonical_value_encoding',
      'projection_container',
      'ordered_record_fields',
      'path_normalization',
      'record_order',
      'minimum_record_count',
      'normalized_paths_must_be_unique',
      'tracked_regular_blob_required',
      'symlink_forbidden',
      'record_bytes_source',
      'digest_formula',
      'output_field',
      'output_format',
      'recompute_and_compare_required',
    ],
    `${label} build source closure digest contract`,
  );
  assertEqual(sourceClosure.algorithm, 'sha256', `${label} source closure algorithm`);
  assertEqual(sourceClosure.version, 'v1', `${label} source closure version`);
  assertEqual(sourceClosure.domain_separator, 'softbook-cet/mobile-ux-batch1-build-source-closure/v1', `${label} source closure domain`);
  assertEqual(sourceClosure.canonical_value_encoding, 'RFC8785_JCS', `${label} source closure canonical encoding`);
  assertEqual(sourceClosure.projection_container, 'array_of_two_element_field_id_and_canonical_value_tuples', `${label} source closure projection container`);
  assertExactArray(sourceClosure.ordered_record_fields, ['path', 'git_mode', 'byte_length', 'raw_sha256'], `${label} source closure record order`);
  assertEqual(sourceClosure.path_normalization, 'repository_relative_posix_nfc_no_dot_segments', `${label} source closure path normalization`);
  assertEqual(sourceClosure.record_order, 'normalized_path_utf8_ascending', `${label} source closure record order rule`);
  assertEqual(sourceClosure.minimum_record_count, 1, `${label} source closure minimum count`);
  for (const key of ['normalized_paths_must_be_unique', 'tracked_regular_blob_required', 'symlink_forbidden', 'recompute_and_compare_required']) {
    assertEqual(sourceClosure[key], true, `${label} source closure ${key}`);
  }
  assertEqual(sourceClosure.record_bytes_source, 'exact_designation_subject_commit', `${label} source closure bytes source`);
  assertEqual(sourceClosure.digest_formula, 'lowercase_hex_sha256(utf8(domain_separator)+NUL+utf8(RFC8785_JCS(ordered_record_tuple_arrays)))', `${label} source closure digest formula`);
  assertEqual(sourceClosure.output_field, 'source_closure_digest', `${label} source closure output field`);
  assertEqual(sourceClosure.output_format, 'lowercase_hex_sha256_64', `${label} source closure output format`);

  const buildOutput = build.build_output_digest_contract;
  assertExactKeys(
    buildOutput,
    [
      'algorithm',
      'version',
      'artifact_record_required_fields',
      'artifact_record_exact_keys_required',
      'path_normalization',
      'required_git_mode',
      'regular_file_required',
      'symlink_forbidden',
      'digest_formula',
      'output_field',
      'output_format',
      'recompute_length_and_digest_from_raw_bytes_required',
    ],
    `${label} build output digest contract`,
  );
  assertEqual(buildOutput.algorithm, 'sha256', `${label} build output algorithm`);
  assertEqual(buildOutput.version, 'v1', `${label} build output version`);
  assertExactArray(buildOutput.artifact_record_required_fields, ['path', 'git_mode', 'byte_length', 'raw_sha256'], `${label} build output artifact fields`);
  assertEqual(buildOutput.artifact_record_exact_keys_required, true, `${label} build output exact artifact keys`);
  assertEqual(buildOutput.path_normalization, 'repository_relative_posix_nfc_no_dot_segments', `${label} build output path normalization`);
  assertEqual(buildOutput.required_git_mode, '100644', `${label} build output mode`);
  assertEqual(buildOutput.regular_file_required, true, `${label} build output regular file`);
  assertEqual(buildOutput.symlink_forbidden, true, `${label} build output symlink policy`);
  assertEqual(buildOutput.digest_formula, 'lowercase_hex_sha256(raw_file_bytes)', `${label} build output digest formula`);
  assertEqual(buildOutput.output_field, 'build_output_artifact.raw_sha256', `${label} build output field`);
  assertEqual(buildOutput.output_format, 'lowercase_hex_sha256_64', `${label} build output format`);
  assertEqual(buildOutput.recompute_length_and_digest_from_raw_bytes_required, true, `${label} build output recomputation`);
  const recipe = build.build_recipe_contract;
  assertExactKeys(
    recipe,
    [
      'build_recipe_id',
      'future_recipe_path',
      'recipe_path_must_be_tracked_regular_100644_at_designation_subject',
      'recipe_raw_sha256_must_be_recomputed',
      'toolchain_lock_path',
      'toolchain_lock_must_be_tracked_regular_100644_at_designation_subject',
      'toolchain_lock_raw_sha256_must_be_recomputed',
      'build_output_role',
      'exact_build_output_path',
      'source_closure_enumeration_rule',
      'resolved_source_closure_records_must_exactly_equal_recipe_enumeration',
      'hermetic_invocation_inputs',
      'sandbox_forbidden_inputs',
      'builder_runtime_identity_status',
      'builder_runtime_identity_required_fields',
      'archive_metadata_normalization_status',
      'recipe_and_toolchain_lock_must_be_members_of_source_closure',
      'build_output_path_must_not_be_member_of_source_closure',
      'clean_build_output_path_must_be_absent_before_invocation',
      'output_must_be_derived_only_from_hermetic_invocation_inputs',
      'clean_rebuild_output_raw_sha256_must_match',
      'hermeticity_and_cross_environment_reproducibility_claim_currently_allowed',
      'materialization_blocked_until_builder_identity_and_archive_normalization_implemented',
      'recipe_status',
      'arbitrary_tracked_file_cannot_substitute_for_build_output',
    ],
    `${label} build recipe contract`,
  );
  assertEqual(recipe.build_recipe_id, 'cp-ba-browser-documents-hermetic-build-v1', `${label} build recipe ID`);
  assertEqual(recipe.future_recipe_path, 'scripts/build_mobile_ux_batch1_cp_ba_browser_documents.mjs', `${label} build recipe path`);
  assertEqual(recipe.recipe_path_must_be_tracked_regular_100644_at_designation_subject, true, `${label} build recipe tracked policy`);
  assertEqual(recipe.recipe_raw_sha256_must_be_recomputed, true, `${label} build recipe digest recomputation`);
  assertEqual(recipe.toolchain_lock_path, 'package-lock.json', `${label} build toolchain lock path`);
  assertEqual(recipe.toolchain_lock_must_be_tracked_regular_100644_at_designation_subject, true, `${label} build toolchain tracked policy`);
  assertEqual(recipe.toolchain_lock_raw_sha256_must_be_recomputed, true, `${label} build toolchain digest recomputation`);
  assertEqual(recipe.build_output_role, 'cp-ba-browser-documents', `${label} build output role`);
  assertEqual(recipe.exact_build_output_path, 'artifacts/mobile-ux-batch1/cp-ba-browser-documents.tar', `${label} build output path`);
  assertEqual(recipe.source_closure_enumeration_rule, 'recipe_deterministically_enumerates_complete_input_path_set_at_designation_subject', `${label} build source enumeration`);
  assertEqual(recipe.resolved_source_closure_records_must_exactly_equal_recipe_enumeration, true, `${label} build closure equality`);
  assertExactArray(recipe.hermetic_invocation_inputs, ['source_closure_records_and_exact_raw_bytes', 'source_closure_digest', 'build_recipe_raw_sha256', 'toolchain_lock_raw_sha256'], `${label} build hermetic inputs`);
  assertExactArray(recipe.sandbox_forbidden_inputs, ['undeclared_file_reads', 'network_access', 'ambient_environment_variables', 'wall_clock_time', 'unseeded_randomness'], `${label} build sandbox forbidden inputs`);
  assertEqual(recipe.builder_runtime_identity_status, 'not_implemented', `${label} builder runtime identity status`);
  assertExactArray(recipe.builder_runtime_identity_required_fields, ['builder_image_digest', 'runtime_version', 'operating_system', 'architecture', 'locale', 'timezone', 'archive_metadata_normalization_profile'], `${label} builder runtime identity fields`);
  assertEqual(recipe.archive_metadata_normalization_status, 'not_implemented', `${label} archive metadata normalization status`);
  assertEqual(recipe.recipe_and_toolchain_lock_must_be_members_of_source_closure, true, `${label} recipe and lock source-closure membership`);
  assertEqual(recipe.build_output_path_must_not_be_member_of_source_closure, true, `${label} build output source-closure exclusion`);
  assertEqual(recipe.clean_build_output_path_must_be_absent_before_invocation, true, `${label} clean build output absence`);
  assertEqual(recipe.output_must_be_derived_only_from_hermetic_invocation_inputs, true, `${label} build output derivation`);
  assertEqual(recipe.clean_rebuild_output_raw_sha256_must_match, true, `${label} build clean reproducibility`);
  assertEqual(recipe.hermeticity_and_cross_environment_reproducibility_claim_currently_allowed, false, `${label} current hermeticity claim`);
  assertEqual(recipe.materialization_blocked_until_builder_identity_and_archive_normalization_implemented, true, `${label} builder identity materialization blocker`);
  assertEqual(recipe.recipe_status, 'future_not_implemented', `${label} build recipe status`);
  assertEqual(recipe.arbitrary_tracked_file_cannot_substitute_for_build_output, true, `${label} build arbitrary file prohibition`);
  assertEqual(
    registrySet.current_requirement_registry.requirements_by_id[build.requirement_id].allowed_value_class,
    build.allowed_value_class,
    `${label} build registry allowed value class`,
  );

  const executionWindow = contract.execution_window_contract;
  assertExactKeys(
    executionWindow,
    [
      'schema_version',
      'requirement_ids',
      'allowed_value_class',
      'exact_value_keys',
      'exact_value_keys_required',
      'canonical_projection_container',
      'ordered_projection_fields',
      'timestamp_normalization',
      'field_type_map',
      'value_semantics',
      'schedule_source_authority',
      'schedule_issuer_pseudonym_source',
      'schedule_issuer_real_immutable_id_must_not_be_persisted',
      'pseudonym_mapping_must_remain_off_repository',
      'trusted_remote_event_may_verify_real_identity_without_persisting_it',
      'trusted_schedule_event_lookup_required',
      'trusted_schedule_event_exact_equality_fields',
      'schedule_event_digest_contract',
      'schedule_event_must_be_unrevoked_and_unexpired_at_binding_and_F3_use',
      'window_requirement_id_must_equal_registry_requirement_id',
      'temporal_rules',
      'f3_binding_rule',
      'compatibility_digest_effect',
      'recompute_canonical_projection_on_any_value_drift',
    ],
    `${label}.execution_window_contract`,
  );
  assertEqual(executionWindow.schema_version, 'mobile-ux-batch1-canonical-execution-window.v1', `${label} execution window schema`);
  assertExactArray(executionWindow.requirement_ids, POST_DESIGNATION_REQUIREMENT_IDS_BY_KIND.execution_window, `${label} execution window requirement IDs`);
  assertEqual(executionWindow.allowed_value_class, 'canonical_utc_execution_window_value_v1', `${label} execution window value class`);
  const windowFields = [
    'window_requirement_id',
    'start_at_utc',
    'end_at_utc',
    'expires_at_utc',
    'schedule_issuer_authority_ref',
    'schedule_issuer_principal_pseudonym',
    'schedule_issued_at_utc',
    'schedule_event_ref',
    'schedule_event_sha256',
  ];
  assertExactArray(executionWindow.exact_value_keys, windowFields, `${label} execution window keys`);
  assertEqual(executionWindow.exact_value_keys_required, true, `${label} execution window exact keys`);
  assertEqual(executionWindow.canonical_projection_container, 'array_of_two_element_field_id_and_canonical_value_tuples', `${label} execution window projection container`);
  assertExactArray(executionWindow.ordered_projection_fields, windowFields, `${label} execution window field order`);
  assertEqual(executionWindow.timestamp_normalization, 'rfc3339_utc_second_precision_Z', `${label} execution window timestamp normalization`);
  const expectedWindowFieldTypes = {
    window_requirement_id: 'non_empty_string', start_at_utc: 'rfc3339_timestamp', end_at_utc: 'rfc3339_timestamp',
    expires_at_utc: 'rfc3339_timestamp', schedule_issuer_authority_ref: 'non_empty_string',
    schedule_issuer_principal_pseudonym: 'campaign_scoped_hmac_principal_pseudonym', schedule_issued_at_utc: 'rfc3339_timestamp',
    schedule_event_ref: 'non_empty_string', schedule_event_sha256: 'sha256',
  };
  assertExactKeys(executionWindow.field_type_map, Object.keys(expectedWindowFieldTypes), `${label} execution window field types`);
  for (const [field, typeId] of Object.entries(expectedWindowFieldTypes)) assertEqual(executionWindow.field_type_map[field], typeId, `${label} execution window field type ${field}`);
  assertEqual(executionWindow.value_semantics, 'protected_owner_operator_proposed_not_derived', `${label} execution window semantics`);
  assertEqual(executionWindow.schedule_source_authority, 'protected_owner_operator_schedule_event', `${label} execution window source authority`);
  assertEqual(executionWindow.schedule_issuer_pseudonym_source, 'verified_human_role_confirmation_v1.campaign_scoped_principal_pseudonym', `${label} execution window pseudonym source`);
  assertEqual(executionWindow.schedule_issuer_real_immutable_id_must_not_be_persisted, true, `${label} execution window real identity persistence prohibition`);
  assertEqual(executionWindow.pseudonym_mapping_must_remain_off_repository, true, `${label} execution window pseudonym mapping boundary`);
  assertEqual(executionWindow.trusted_remote_event_may_verify_real_identity_without_persisting_it, true, `${label} execution window remote identity verification boundary`);
  assertEqual(executionWindow.trusted_schedule_event_lookup_required, true, `${label} execution window trusted lookup`);
  assertExactArray(executionWindow.trusted_schedule_event_exact_equality_fields, windowFields, `${label} execution window remote equality`);
  const scheduleDigest = executionWindow.schedule_event_digest_contract;
  assertExactKeys(scheduleDigest, ['algorithm', 'version', 'domain_separator', 'canonical_value_encoding', 'projection_container', 'ordered_projection_fields', 'projection_values_must_equal_verified_schedule_event', 'digest_formula', 'output_field', 'output_format', 'recompute_and_compare_required'], `${label} execution window event digest`);
  assertEqual(scheduleDigest.algorithm, 'sha256', `${label} execution window event digest algorithm`);
  assertEqual(scheduleDigest.version, 'v1', `${label} execution window event digest version`);
  assertEqual(scheduleDigest.domain_separator, 'softbook-cet/mobile-ux-batch1-protected-schedule-event/v1', `${label} execution window event digest domain`);
  assertEqual(scheduleDigest.canonical_value_encoding, 'RFC8785_JCS', `${label} execution window event digest encoding`);
  assertEqual(scheduleDigest.projection_container, 'array_of_two_element_field_id_and_canonical_value_tuples', `${label} execution window event digest container`);
  assertExactArray(scheduleDigest.ordered_projection_fields, windowFields.slice(0, -1), `${label} execution window event digest fields`);
  assertEqual(scheduleDigest.projection_values_must_equal_verified_schedule_event, true, `${label} execution window event digest source`);
  assertEqual(scheduleDigest.digest_formula, 'lowercase_hex_sha256(utf8(domain_separator)+NUL+utf8(RFC8785_JCS(ordered_projection_tuple_array)))', `${label} execution window event digest formula`);
  assertEqual(scheduleDigest.output_field, 'schedule_event_sha256', `${label} execution window event digest output field`);
  assertEqual(scheduleDigest.output_format, 'lowercase_hex_sha256_64', `${label} execution window event digest output format`);
  assertEqual(scheduleDigest.recompute_and_compare_required, true, `${label} execution window event digest recomputation`);
  assertEqual(executionWindow.schedule_event_must_be_unrevoked_and_unexpired_at_binding_and_F3_use, true, `${label} execution window event validity`);
  assertEqual(executionWindow.window_requirement_id_must_equal_registry_requirement_id, true, `${label} execution window ID equality`);
  assertExactArray(executionWindow.temporal_rules, ['schedule_issued_at_utc_not_after_F3_decided_at', 'F3_decided_at_strictly_before_start_at_utc', 'start_at_utc_strictly_before_end_at_utc', 'end_at_utc_not_after_expires_at_utc', 'not_expired_at_binding_use_time'], `${label} execution window temporal rules`);
  assertEqual(executionWindow.f3_binding_rule, 'exact_window_values_are_part_of_B2_subject_reviewed_by_F3_without_execution_authority', `${label} execution window F3 binding rule`);
  assertEqual(executionWindow.compatibility_digest_effect, 'representational_identity_only_not_schedule_authority', `${label} execution window compatibility effect`);
  assertEqual(executionWindow.recompute_canonical_projection_on_any_value_drift, true, `${label} execution window recomputation`);
  for (const requirementId of executionWindow.requirement_ids) {
    assertEqual(registrySet.current_requirement_registry.requirements_by_id[requirementId].allowed_value_class, executionWindow.allowed_value_class, `${label} ${requirementId} registry value class`);
  }

  const compatibility = contract.compatibility_derivation_contract;
  assertExactKeys(
    compatibility,
    [
      'schema_version',
      'hash_algorithm',
      'canonical_value_encoding',
      'ordered_input_container',
      'ordered_input_tuple_fields',
      'digest_formula',
      'output_format',
      'binding_bundle',
      'per_output_derivations',
      'per_output_input_value_source_contract',
      'cp_ba_single_map_derivation',
      'arbitrary_or_synthetic_compatibility_values_forbidden',
      'cached_value_without_recomputation_forbidden',
    ],
    `${label}.compatibility_derivation_contract`,
  );
  assertEqual(
    compatibility.schema_version,
    'mobile-ux-batch1-deterministic-compatibility.v1',
    `${label} compatibility derivation schema`,
  );
  assertEqual(compatibility.hash_algorithm, 'sha256', `${label} compatibility hash algorithm`);
  assertEqual(compatibility.canonical_value_encoding, 'RFC8785_JCS', `${label} compatibility canonical encoding`);
  assertEqual(
    compatibility.ordered_input_container,
    'array_of_two_element_field_id_and_canonical_value_tuples',
    `${label} compatibility ordered input container`,
  );
  assertExactArray(
    compatibility.ordered_input_tuple_fields,
    ['field_id', 'canonical_value'],
    `${label} compatibility ordered tuple fields`,
  );
  const digestFormula =
    'lowercase_hex_sha256(utf8(domain_separator)+NUL+utf8(RFC8785_JCS(ordered_input_tuples)))';
  assertEqual(compatibility.digest_formula, digestFormula, `${label} compatibility digest formula`);
  assertEqual(compatibility.output_format, 'lowercase_hex_sha256_64', `${label} compatibility output format`);

  const bundle = compatibility.binding_bundle;
  assertExactKeys(
    bundle,
    [
      'bundle_id',
      'domain_separator',
      'ordered_subject_fields',
      'source_requirement_ids',
      'source_closure_rule',
      'forbidden_subject_fields',
      'value_source_bindings',
      'derivation_formula_ref',
      'output_field',
      'output_format',
      'recompute_and_compare_required',
      'recompute_on_any_subject_drift',
    ],
    `${label} compatibility binding bundle`,
  );
  assertEqual(bundle.bundle_id, 'batch1-post-designation-binding-bundle-v1', `${label} binding bundle ID`);
  assertEqual(
    bundle.domain_separator,
    'softbook-cet/mobile-ux-batch1-binding-bundle/v1',
    `${label} binding bundle domain`,
  );
  assertExactArray(
    bundle.ordered_subject_fields,
    [
      'designation_subject_commit',
      'designation_subject_digest_domain',
      'designation_subject_digest',
      'designated_cohort_id',
      'designated_cohort_sha256',
      'designation_approval_instance_digest',
      'build-cp-ba-browser-documents',
      'window-cp-ba',
      'window-cp-cs',
      'window-cp-web',
    ],
    `${label} binding bundle ordered subject fields`,
  );
  assertExactArray(
    bundle.source_requirement_ids,
    [
      'build-cp-ba-browser-documents',
      'window-cp-ba',
      'window-cp-cs',
      'window-cp-web',
    ],
    `${label} binding bundle exact source requirements`,
  );
  assertEqual(
    bundle.source_closure_rule,
    'exact_D1_subject_plus_designation_bound_build_and_three_exact_windows_only',
    `${label} binding bundle source closure rule`,
  );
  assertExactArray(
    bundle.forbidden_subject_fields,
    [
      'binding_bundle_digest',
      'compatibility_key_output',
      'compatibility_map_output',
      'final_freeze_subject_commit',
      'final_freeze_subject_digest',
      'final_manifest_freeze_decision_ref',
    ],
    `${label} binding bundle forbidden recursive inputs`,
  );
  const expectedBundleSources = [
    ['designation_subject_commit', 'exact_D1_intent.designation_subject_commit'],
    ['designation_subject_digest_domain', 'exact_D1_intent.designation_subject_digest_domain'],
    ['designation_subject_digest', 'exact_D1_intent.designation_subject_digest'],
    ['designated_cohort_id', 'exact_D1_intent.designated_cohort_id'],
    ['designated_cohort_sha256', 'exact_D1_intent.designated_cohort_sha256'],
    ['designation_approval_instance_digest', 'recomputed_D1_receipt.approval_instance_digest'],
    ['build-cp-ba-browser-documents', 'exact_resolved_requirement_value.build-cp-ba-browser-documents'],
    ['window-cp-ba', 'exact_canonical_window_requirement_value.window-cp-ba'],
    ['window-cp-cs', 'exact_canonical_window_requirement_value.window-cp-cs'],
    ['window-cp-web', 'exact_canonical_window_requirement_value.window-cp-web'],
  ];
  if (!Array.isArray(bundle.value_source_bindings) || bundle.value_source_bindings.length !== expectedBundleSources.length) {
    throw new Error(`${label} binding bundle value-source bindings must contain exactly ten entries`);
  }
  bundle.value_source_bindings.forEach((entry, index) => {
    assertExactKeys(entry, ['field_id', 'source'], `${label} binding bundle value source[${index}]`);
    assertEqual(entry.field_id, expectedBundleSources[index][0], `${label} binding bundle value source[${index}].field_id`);
    assertEqual(entry.source, expectedBundleSources[index][1], `${label} binding bundle value source[${index}].source`);
  });
  assertEqual(bundle.derivation_formula_ref, '#/successor_transition_contract/compatibility_derivation_contract/digest_formula', `${label} binding bundle formula ref`);
  assertEqual(bundle.output_field, 'binding_bundle_digest', `${label} binding bundle output field`);
  assertEqual(bundle.output_format, 'lowercase_hex_sha256_64', `${label} binding bundle output format`);
  assertEqual(bundle.recompute_and_compare_required, true, `${label} binding bundle recompute equality`);
  assertEqual(bundle.recompute_on_any_subject_drift, true, `${label} binding bundle drift recomputation`);

  if (!Array.isArray(compatibility.per_output_derivations) ||
      compatibility.per_output_derivations.length !== COMPATIBILITY_OUTPUT_DEFINITIONS.length) {
    throw new Error(`${label} compatibility per-output derivations must contain exactly five outputs`);
  }
  const outputIds = new Set();
  const domains = new Set([bundle.domain_separator]);
  compatibility.per_output_derivations.forEach((derivation, index) => {
    const outputLabel = `${label} compatibility output[${index}]`;
    const expected = COMPATIBILITY_OUTPUT_DEFINITIONS[index];
    assertExactKeys(
      derivation,
      [
        'requirement_id',
        'output_id',
        'domain_separator',
        'ordered_input_fields',
        'derivation_formula_ref',
        'output_value_class',
        'compatibility_requirement_id_must_equal_requirement_id',
        'recompute_on_any_input_drift',
      ],
      outputLabel,
    );
    assertEqual(derivation.requirement_id, expected.requirementId, `${outputLabel} requirement ID`);
    assertEqual(derivation.output_id, expected.outputId, `${outputLabel} output ID`);
    assertEqual(derivation.domain_separator, expected.domainSeparator, `${outputLabel} domain separator`);
    assertExactArray(derivation.ordered_input_fields, COMPATIBILITY_DERIVATION_INPUT_FIELDS, `${outputLabel} inputs`);
    assertEqual(
      derivation.derivation_formula_ref,
      '#/successor_transition_contract/compatibility_derivation_contract/digest_formula',
      `${outputLabel} formula ref`,
    );
    assertEqual(
      derivation.output_value_class,
      'deterministic_compatibility_sha256_value_v1',
      `${outputLabel} output value class`,
    );
    assertEqual(derivation.compatibility_requirement_id_must_equal_requirement_id, true, `${outputLabel} requirement literal equality`);
    assertEqual(derivation.recompute_on_any_input_drift, true, `${outputLabel} drift recomputation`);
    if (outputIds.has(derivation.output_id)) throw new Error(`${outputLabel} output ID must be unique`);
    if (domains.has(derivation.domain_separator)) throw new Error(`${outputLabel} domain separator must be unique`);
    outputIds.add(derivation.output_id);
    domains.add(derivation.domain_separator);
    const requirement = registrySet.current_requirement_registry.requirements_by_id[derivation.requirement_id];
    assertEqual(
      requirement.allowed_value_class,
      derivation.output_value_class,
      `${outputLabel} registry allowed value class`,
    );
  });

  const outputSources = compatibility.per_output_input_value_source_contract;
  assertExactKeys(
    outputSources,
    [
      'ordered_bindings',
      'designation_fields_must_equal_exact_D1_intent',
      'binding_bundle_digest_must_equal_recomputed_bundle',
      'compatibility_requirement_id_must_equal_per_output_requirement_id',
    ],
    `${label} compatibility per-output value sources`,
  );
  const expectedOutputSources = [
    ['designation_subject_commit', 'exact_D1_intent.designation_subject_commit'],
    ['designation_subject_digest_domain', 'exact_D1_intent.designation_subject_digest_domain'],
    ['designation_subject_digest', 'exact_D1_intent.designation_subject_digest'],
    ['binding_bundle_digest', 'recomputed_binding_bundle.binding_bundle_digest'],
    ['compatibility_requirement_id', 'exact_literal_equal_to_current_derivation.requirement_id'],
  ];
  if (!Array.isArray(outputSources.ordered_bindings) || outputSources.ordered_bindings.length !== expectedOutputSources.length) {
    throw new Error(`${label} compatibility per-output value sources must contain exactly five bindings`);
  }
  outputSources.ordered_bindings.forEach((entry, index) => {
    assertExactKeys(entry, ['field_id', 'source'], `${label} compatibility output value source[${index}]`);
    assertEqual(entry.field_id, expectedOutputSources[index][0], `${label} compatibility output value source[${index}].field_id`);
    assertEqual(entry.source, expectedOutputSources[index][1], `${label} compatibility output value source[${index}].source`);
  });
  for (const key of [
    'designation_fields_must_equal_exact_D1_intent',
    'binding_bundle_digest_must_equal_recomputed_bundle',
    'compatibility_requirement_id_must_equal_per_output_requirement_id',
  ]) assertEqual(outputSources[key], true, `${label} compatibility output value source ${key}`);

  const cpBaMap = compatibility.cp_ba_single_map_derivation;
  assertExactKeys(
    cpBaMap,
    [
      'output_map_id',
      'domain_separator',
      'ordered_component_requirement_ids',
      'ordered_input_fields',
      'derivation_formula_ref',
      'ordered_input_value_source_bindings',
      'all_ordered_input_values_must_equal_exact_sources',
      'binding_bundle_digest_must_equal_recomputed_bundle',
      'component_values_must_equal_recomputed_per_output_values',
      'output_field',
      'output_value_class',
      'persistence_location',
      'recompute_and_compare_required',
      'single_persisted_output_required',
      'f3_subject_must_include_exact_persisted_output',
      'output_map_cardinality',
      'recompute_on_any_component_or_bundle_drift',
    ],
    `${label} CP-BA compatibility map derivation`,
  );
  assertEqual(cpBaMap.output_map_id, 'compatibility-map-cp-ba-v1', `${label} CP-BA compatibility map ID`);
  assertEqual(
    cpBaMap.domain_separator,
    'softbook-cet/mobile-ux-batch1-compatibility-map/cp-ba/v1',
    `${label} CP-BA compatibility map domain`,
  );
  if (domains.has(cpBaMap.domain_separator)) throw new Error(`${label} CP-BA compatibility map domain must be unique`);
  assertExactArray(
    cpBaMap.ordered_component_requirement_ids,
    POST_DESIGNATION_REQUIREMENT_IDS_BY_KIND.compatibility.slice(0, 3),
    `${label} CP-BA compatibility map components`,
  );
  assertExactArray(
    cpBaMap.ordered_input_fields,
    [
      'designation_subject_commit',
      'designation_subject_digest_domain',
      'designation_subject_digest',
      'binding_bundle_digest',
      ...POST_DESIGNATION_REQUIREMENT_IDS_BY_KIND.compatibility.slice(0, 3),
    ],
    `${label} CP-BA compatibility map inputs`,
  );
  assertEqual(
    cpBaMap.derivation_formula_ref,
    '#/successor_transition_contract/compatibility_derivation_contract/digest_formula',
    `${label} CP-BA compatibility map formula ref`,
  );
  const expectedMapSources = [
    ['designation_subject_commit', 'exact_D1_decision_intent.designation_subject_commit'],
    ['designation_subject_digest_domain', 'exact_D1_decision_intent.designation_subject_digest_domain'],
    ['designation_subject_digest', 'exact_D1_decision_intent.designation_subject_digest'],
    ['binding_bundle_digest', 'recomputed_binding_bundle.binding_bundle_digest'],
    ...COMPATIBILITY_OUTPUT_DEFINITIONS.slice(0, 3).map((entry) => [
      entry.requirementId,
      `derived_output.${entry.outputId}`,
    ]),
  ];
  if (!Array.isArray(cpBaMap.ordered_input_value_source_bindings) || cpBaMap.ordered_input_value_source_bindings.length !== expectedMapSources.length) {
    throw new Error(`${label} CP-BA compatibility map value sources must contain exactly seven ordered inputs`);
  }
  cpBaMap.ordered_input_value_source_bindings.forEach((entry, index) => {
    assertExactKeys(entry, ['field_id', 'source'], `${label} CP-BA map value source[${index}]`);
    assertEqual(entry.field_id, expectedMapSources[index][0], `${label} CP-BA map value source[${index}].field_id`);
    assertEqual(entry.source, expectedMapSources[index][1], `${label} CP-BA map value source[${index}].source`);
  });
  assertEqual(cpBaMap.all_ordered_input_values_must_equal_exact_sources, true, `${label} CP-BA map all-input equality`);
  assertEqual(cpBaMap.binding_bundle_digest_must_equal_recomputed_bundle, true, `${label} CP-BA map bundle equality`);
  assertEqual(cpBaMap.component_values_must_equal_recomputed_per_output_values, true, `${label} CP-BA map component equality`);
  assertEqual(cpBaMap.output_field, 'cp_ba_compatibility_map_digest', `${label} CP-BA map output field`);
  assertEqual(cpBaMap.output_value_class, 'lowercase_hex_sha256_64', `${label} CP-BA map output value class`);
  assertEqual(cpBaMap.persistence_location, 'B2_required_binding_metadata', `${label} CP-BA map persistence location`);
  assertEqual(cpBaMap.recompute_and_compare_required, true, `${label} CP-BA map output recomputation`);
  assertEqual(cpBaMap.single_persisted_output_required, true, `${label} CP-BA map single persisted output`);
  assertEqual(cpBaMap.f3_subject_must_include_exact_persisted_output, true, `${label} CP-BA map F3 subject binding`);
  assertEqual(cpBaMap.output_map_cardinality, 1, `${label} CP-BA compatibility map cardinality`);
  assertEqual(
    cpBaMap.recompute_on_any_component_or_bundle_drift,
    true,
    `${label} CP-BA compatibility map drift recomputation`,
  );
  assertEqual(
    compatibility.arbitrary_or_synthetic_compatibility_values_forbidden,
    true,
    `${label} arbitrary compatibility value policy`,
  );
  assertEqual(
    compatibility.cached_value_without_recomputation_forbidden,
    true,
    `${label} compatibility cache recomputation policy`,
  );

  const bootstrap = contract.decision_authority_bootstrap;
  assertExactKeys(
    bootstrap,
    [
      'current_status',
      'current_classifier_capability',
      'required_trusted_base_capabilities',
      'r0_b2_materialization_validator_status',
      'required_resolved_record_schema_status',
      'r0_must_not_proceed_before_materialization_validator',
      'current_allowed_next_action',
      'designation_must_not_proceed_before_bootstrap',
      'current_workflow_or_classifier_may_authorize_designation',
      'current_workflow_or_classifier_may_authorize_final_manifest_freeze',
    ],
    `${label}.decision_authority_bootstrap`,
  );
  assertEqual(bootstrap.current_status, 'not_implemented', `${label} authority bootstrap status`);
  assertEqual(
    bootstrap.current_classifier_capability,
    'sensitive_boolean_only',
    `${label} current classifier capability`,
  );
  assertExactArray(
    bootstrap.required_trusted_base_capabilities,
    [
      'decision_class_validation_for_schema_definition_cohort_designation_and_manifest_freeze',
      'exact_decision_subject_validation',
      'single_decision_class_per_event_validation',
      'mixed_decision_class_same_exact_head_change_set_fail_closed',
      'distinct_workflow_deployment_and_approval_event_validation',
      'approval_instance_digest_and_parent_chain_validation',
      'preapproval_intent_and_postapproval_receipt_lifecycle_validation',
      'decision_subject_artifact_record_digest_recomputation',
      'designated_cohort_identity_digest_recomputation',
      'protected_cohort_id_privacy_classification_attestation_validation',
      'decision_validity_policy_enforcement',
      'r0_b2_resolved_record_materialization_validation',
      'trusted_remote_github_event_chain_validation',
      'decision_expiry_and_invalidation_recomputation_at_use_time',
      'trusted_base_validator_not_loaded_from_decision_head',
      'trusted_staged_same_pull_request_subject_separation_validation',
    ],
    `${label} trusted authority bootstrap capabilities`,
  );
  assertEqual(bootstrap.r0_b2_materialization_validator_status, 'not_implemented', `${label} R0/B2 materialization validator status`);
  assertEqual(bootstrap.required_resolved_record_schema_status, 'not_implemented', `${label} resolved record schema status`);
  assertEqual(bootstrap.r0_must_not_proceed_before_materialization_validator, true, `${label} R0 materialization validator gate`);
  assertEqual(
    bootstrap.current_allowed_next_action,
    'implement_trusted_governance_and_R0_B2_materialization_validators_obtain_protected_validity_policy_and_legacy_receipt_migration_approval',
    `${label} current governance bootstrap action`,
  );
  assertEqual(bootstrap.designation_must_not_proceed_before_bootstrap, true, `${label} designation bootstrap gate`);
  assertEqual(
    bootstrap.current_workflow_or_classifier_may_authorize_designation,
    false,
    `${label} current classifier designation authority`,
  );
  assertEqual(
    bootstrap.current_workflow_or_classifier_may_authorize_final_manifest_freeze,
    false,
    `${label} current classifier final freeze authority`,
  );

  const decisionInstances = contract.decision_instance_contract;
  assertExactKeys(
    decisionInstances,
    [
      'schema_version',
      'current_instance_count',
      'current_status',
      'intent_exact_key_set_required',
      'intent_file_constraints',
      'receipt_file_constraints',
      'field_type_contracts',
      'regex_registry',
      'authority_mask_keys',
      'field_type_map_key_encoding',
      'intent_field_type_map',
      'receipt_field_type_map',
      'subject_digest_contract',
      'designated_cohort_identity_contract',
      'decision_validity_policy_contract',
      'decision_lifecycle_contract',
      'legacy_preparation_bootstrap_contract',
      'instances',
    ],
    `${label}.decision_instance_contract`,
  );
  assertEqual(decisionInstances.schema_version, 'mobile-ux-batch1-decision-instance.v1', `${label} decision instance schema`);
  assertEqual(decisionInstances.current_instance_count, 0, `${label} current decision instance count`);
  assertEqual(decisionInstances.current_status, 'absent_required', `${label} current decision instance status`);
  assertEqual(decisionInstances.intent_exact_key_set_required, true, `${label} intent exact key set`);
  const fileConstraints = decisionInstances.intent_file_constraints;
  assertExactKeys(
    fileConstraints,
    ['regular_file_required', 'git_mode', 'tracked_required', 'symlink_forbidden', 'head_and_worktree_bytes_must_match'],
    `${label} decision file constraints`,
  );
  assertEqual(fileConstraints.regular_file_required, true, `${label} decision regular file requirement`);
  assertEqual(fileConstraints.git_mode, '100644', `${label} decision file mode`);
  assertEqual(fileConstraints.tracked_required, true, `${label} decision tracked requirement`);
  assertEqual(fileConstraints.symlink_forbidden, true, `${label} decision symlink prohibition`);
  assertEqual(fileConstraints.head_and_worktree_bytes_must_match, true, `${label} decision HEAD/worktree binding`);
  const receiptFileConstraints = decisionInstances.receipt_file_constraints;
  assertExactKeys(
    receiptFileConstraints,
    [
      'regular_file_required',
      'git_mode',
      'tracked_required_after_materialization',
      'symlink_forbidden',
      'must_be_absent_from_approval_target_head',
      'materialization_commit_must_descend_from_approval_target_head',
    ],
    `${label} receipt file constraints`,
  );
  assertEqual(receiptFileConstraints.regular_file_required, true, `${label} receipt regular file`);
  assertEqual(receiptFileConstraints.git_mode, '100644', `${label} receipt file mode`);
  assertEqual(receiptFileConstraints.tracked_required_after_materialization, true, `${label} receipt tracked after materialization`);
  assertEqual(receiptFileConstraints.symlink_forbidden, true, `${label} receipt symlink prohibition`);
  assertEqual(receiptFileConstraints.must_be_absent_from_approval_target_head, true, `${label} receipt absent from approval head`);
  assertEqual(receiptFileConstraints.materialization_commit_must_descend_from_approval_target_head, true, `${label} receipt descendant materialization`);

  const fieldTypes = decisionInstances.field_type_contracts;
  assertExactKeys(
    fieldTypes,
    [
      'decision_id',
      'decision_class',
      'contract_version',
      'repository',
      'pull_request',
      'commit_sha',
      'sha256',
      'positive_integer',
      'rfc3339_timestamp',
      'non_empty_string_array',
      'non_empty_string',
      'designated_cohort_id',
      'campaign_scoped_hmac_principal_pseudonym',
      'repository_path',
      'reviewer_immutable_id',
      'nullable_sha256',
      'authority_mask',
      'subject_artifact_records',
      'object_or_null',
    ],
    `${label} decision field type contracts`,
  );
  const expectedFieldTypes = {
    decision_id: {type: 'string', regex_id: 'batch1_exact_decision_id_v1'},
    decision_class: {type: 'string', regex_id: 'schema_definition_or_cohort_designation_or_manifest_freeze'},
    contract_version: {type: 'string', regex_id: 'literal_v1'},
    repository: {type: 'string', regex_id: 'github_owner_and_repository'},
    pull_request: {type: 'integer', minimum: 1},
    commit_sha: {type: 'string', regex_id: 'lowercase_hex_exact_40'},
    sha256: {type: 'string', regex_id: 'lowercase_hex_exact_64'},
    positive_integer: {type: 'integer', minimum: 1},
    rfc3339_timestamp: {type: 'string', regex_id: 'rfc3339_utc_timestamp'},
    non_empty_string_array: {type: 'array', minimum_items: 1, unique_items: true, item_type: 'string'},
    non_empty_string: {type: 'string', minimum_length: 1},
    designated_cohort_id: {type: 'string', regex_id: 'syntactic_opaque_designated_cohort_id_v1', maximum_length: 64},
    campaign_scoped_hmac_principal_pseudonym: {type: 'string', regex_id: 'campaign_scoped_hmac_principal_pseudonym_v1'},
    repository_path: {type: 'string', regex_id: 'repository_relative_posix_path'},
    reviewer_immutable_id: {type: 'string', regex_id: 'github_immutable_reviewer_id'},
    nullable_sha256: {type: 'string_or_null', non_null_regex_id: 'lowercase_hex_exact_64'},
    authority_mask: {
      type: 'object',
      exact_boolean_keys_ref: '#/successor_transition_contract/decision_instance_contract/authority_mask_keys',
    },
    subject_artifact_records: {
      type: 'array',
      exact_item_keys_ref: '#/successor_transition_contract/decision_instance_contract/subject_digest_contract/artifact_record_required_fields',
      minimum_items: 1,
    },
    object_or_null: {type: 'object_or_null'},
  };
  for (const [fieldTypeId, expected] of Object.entries(expectedFieldTypes)) {
    const fieldLabel = `${label} decision field type ${fieldTypeId}`;
    assertExactKeys(fieldTypes[fieldTypeId], Object.keys(expected), fieldLabel);
    for (const [key, value] of Object.entries(expected)) assertEqual(fieldTypes[fieldTypeId][key], value, `${fieldLabel}.${key}`);
  }

  const regexRegistry = decisionInstances.regex_registry;
  assertExactKeys(regexRegistry, ['validator_id', 'source_encoding', 'entries'], `${label} regex registry`);
  assertEqual(regexRegistry.validator_id, 'javascript_regexp_full_match_v1', `${label} regex validator ID`);
  assertEqual(regexRegistry.source_encoding, 'base64_utf8_regex_source', `${label} regex source encoding`);
  const expectedRegexSources = {
    batch1_exact_decision_id_v1: '^(mobile-ux-batch1-(preparation|cohort-designation|manifest-freeze)-v1)$',
    schema_definition_or_cohort_designation_or_manifest_freeze: '^(schema_definition|cohort_designation|manifest_freeze)$',
    literal_v1: '^v1$',
    github_owner_and_repository: '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$',
    lowercase_hex_exact_40: '^[0-9a-f]{40}$',
    lowercase_hex_exact_64: '^[0-9a-f]{64}$',
    rfc3339_utc_timestamp: '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$',
    repository_relative_posix_path: '^(?!/)(?!.*(?:^|/)\\.\\.?(?:/|$))[A-Za-z0-9._/-]+$',
    github_immutable_reviewer_id: '^github:[A-Za-z0-9_.-]+#[0-9]+$',
    syntactic_opaque_designated_cohort_id_v1: '^cet(4|6)-[a-z0-9]{1,16}(?:-[a-z0-9]{1,16}){0,3}$',
    campaign_scoped_hmac_principal_pseudonym_v1: '^hmac-sha256:[0-9a-f]{64}$',
  };
  assertExactKeys(regexRegistry.entries, Object.keys(expectedRegexSources), `${label} regex registry entries`);
  const regexSamples = {
    batch1_exact_decision_id_v1: ['mobile-ux-batch1-cohort-designation-v1', 'wrong-decision'],
    schema_definition_or_cohort_designation_or_manifest_freeze: ['manifest_freeze', 'release'],
    literal_v1: ['v1', 'v2'],
    github_owner_and_repository: ['LENKIN233/softbook_cet', '/invalid'],
    lowercase_hex_exact_40: ['a'.repeat(40), 'a'.repeat(39)],
    lowercase_hex_exact_64: ['b'.repeat(64), 'B'.repeat(64)],
    rfc3339_utc_timestamp: ['2026-08-10T04:00:00Z', '2026-08-10'],
    repository_relative_posix_path: ['docs/design/example.json', '../escape.json'],
    github_immutable_reviewer_id: ['github:LENKIN233#113219944', 'LENKIN233'],
    syntactic_opaque_designated_cohort_id_v1: ['cet4-pilot-a', 'student-113219944'],
    campaign_scoped_hmac_principal_pseudonym_v1: [`hmac-sha256:${'a'.repeat(64)}`, 'github:LENKIN233#113219944'],
  };
  for (const [regexId, source] of Object.entries(expectedRegexSources)) {
    const encoded = regexRegistry.entries[regexId];
    assertEqual(Buffer.from(encoded, 'base64').toString('utf8'), source, `${label} regex ${regexId} source`);
    let compiled;
    try {
      compiled = new RegExp(source);
    } catch (error) {
      throw new Error(`${label} regex ${regexId} must compile: ${error.message}`);
    }
    assertEqual(compiled.test(regexSamples[regexId][0]), true, `${label} regex ${regexId} positive sample`);
    assertEqual(compiled.test(regexSamples[regexId][1]), false, `${label} regex ${regexId} negative sample`);
  }
  for (const [typeId, definition] of Object.entries(fieldTypes)) {
    for (const key of ['regex_id', 'non_null_regex_id']) {
      if (Object.hasOwn(definition, key) && !Object.hasOwn(regexRegistry.entries, definition[key])) {
        throw new Error(`${label} decision field type ${typeId}.${key} must resolve in executable regex registry`);
      }
    }
  }
  assertExactArray(decisionInstances.authority_mask_keys, DECISION_AUTHORITY_MASK_KEYS, `${label} authority mask keys`);
  assertEqual(decisionInstances.field_type_map_key_encoding, 'literal_field_name_except_authority_encoded_as_field__authority', `${label} field type map key encoding`);

  const expectedIntentFieldMap = {
    decision_id: 'decision_id',
    decision_class: 'decision_class',
    contract_version: 'contract_version',
    repository: 'repository',
    pull_request: 'pull_request',
    preparation_subject_commit: 'commit_sha',
    preparation_subject_digest_domain: 'non_empty_string',
    preparation_subject_digest: 'sha256',
    preparation_subject_artifact_records: 'subject_artifact_records',
    designation_subject_commit: 'commit_sha',
    designation_subject_digest_domain: 'non_empty_string',
    designation_subject_digest: 'sha256',
    designation_subject_artifact_records: 'subject_artifact_records',
    designated_cohort_id: 'designated_cohort_id',
    designated_cohort_sha256: 'sha256',
    final_freeze_subject_commit: 'commit_sha',
    final_freeze_subject_digest_domain: 'non_empty_string',
    final_freeze_subject_digest: 'sha256',
    final_freeze_subject_artifact_records: 'subject_artifact_records',
    parent_preparation_approval_instance_digest: 'nullable_sha256',
    parent_designation_approval_instance_digest: 'nullable_sha256',
    gate_effect: 'non_empty_string',
    authority: 'authority_mask',
    allowed_next_action: 'non_empty_string',
    non_claims: 'non_empty_string_array',
    expires_at: 'rfc3339_timestamp',
    invalidation_conditions: 'non_empty_string_array',
  };
  const expectedReceiptFieldMap = {
    decision_id: 'decision_id', decision_class: 'decision_class', contract_version: 'contract_version',
    repository: 'repository', pull_request: 'pull_request', approval_target_head_sha: 'commit_sha',
    decision_artifact_path: 'repository_path', decision_artifact_raw_sha256: 'sha256', subject_commit: 'commit_sha',
    subject_digest_domain: 'non_empty_string', subject_digest: 'sha256', designated_cohort_id: 'designated_cohort_id',
    designated_cohort_sha256: 'sha256', workflow_path: 'repository_path', trusted_base_sha: 'commit_sha',
    workflow_run_id: 'positive_integer', run_attempt: 'positive_integer', workflow_conclusion: 'non_empty_string',
    deployment_id: 'positive_integer', deployment_state: 'non_empty_string', environment_id: 'positive_integer',
    environment_name: 'non_empty_string', approval_id: 'positive_integer', approval_state: 'non_empty_string',
    protected_authority_event_ref: 'non_empty_string', authority_event_sha256: 'sha256',
    reviewer_immutable_id: 'reviewer_immutable_id', decided_at: 'rfc3339_timestamp', gate_effect: 'non_empty_string',
    authority: 'authority_mask', allowed_next_action: 'non_empty_string', non_claims: 'non_empty_string_array',
    expires_at: 'rfc3339_timestamp', invalidation_conditions: 'non_empty_string_array',
    parent_approval_tuple: 'object_or_null', approval_instance_digest: 'sha256',
  };
  for (const [mapId, actual, expected] of [
    ['intent', decisionInstances.intent_field_type_map, expectedIntentFieldMap],
    ['receipt', decisionInstances.receipt_field_type_map, expectedReceiptFieldMap],
  ]) {
    const encodedExpected = Object.fromEntries(
      Object.entries(expected).map(([field, typeId]) => [field === 'authority' ? 'field__authority' : field, typeId]),
    );
    assertExactKeys(actual, Object.keys(encodedExpected), `${label} ${mapId} field type map`);
    for (const [field, typeId] of Object.entries(expected)) {
      const encodedField = field === 'authority' ? 'field__authority' : field;
      assertEqual(actual[encodedField], typeId, `${label} ${mapId} field type map.${field}`);
      if (!Object.hasOwn(fieldTypes, typeId)) throw new Error(`${label} ${mapId} field ${field} type must resolve`);
    }
  }

  const subjectDigestContract = decisionInstances.subject_digest_contract;
  assertExactKeys(
    subjectDigestContract,
    [
      'schema_version',
      'algorithm',
      'version',
      'canonical_value_encoding',
      'projection_container',
      'artifact_record_required_fields',
      'exact_ordered_artifact_paths',
      'path_normalization',
      'required_git_mode',
      'tracked_regular_blob_at_subject_commit_required',
      'symlink_forbidden',
      'byte_length_and_raw_sha256_recomputed_from_subject_commit_bytes',
      'artifact_record_order_must_equal_exact_path_order',
      'subject_commit_must_be_ancestor_of_approval_target_head',
      'all_subject_artifact_bytes_must_be_unchanged_at_approval_target_head',
      'digest_formula',
      'output_format',
      'recompute_and_compare_required',
    ],
    `${label} decision subject digest contract`,
  );
  assertEqual(subjectDigestContract.schema_version, 'mobile-ux-batch1-decision-subject-digest.v1', `${label} decision subject schema`);
  assertEqual(subjectDigestContract.algorithm, 'sha256', `${label} decision subject algorithm`);
  assertEqual(subjectDigestContract.version, 'v1', `${label} decision subject version`);
  assertEqual(subjectDigestContract.canonical_value_encoding, 'RFC8785_JCS', `${label} decision subject canonical encoding`);
  assertEqual(subjectDigestContract.projection_container, 'array_of_two_element_field_id_and_canonical_value_tuples', `${label} decision subject projection container`);
  assertExactArray(subjectDigestContract.artifact_record_required_fields, ['path', 'git_mode', 'byte_length', 'raw_sha256'], `${label} decision subject artifact record fields`);
  assertExactArray(subjectDigestContract.exact_ordered_artifact_paths, FREEZE_CANDIDATE_PATHS, `${label} decision subject exact artifact paths`);
  assertEqual(subjectDigestContract.path_normalization, 'repository_relative_posix_nfc_no_dot_segments', `${label} decision subject path normalization`);
  assertEqual(subjectDigestContract.required_git_mode, '100644', `${label} decision subject mode`);
  for (const key of [
    'tracked_regular_blob_at_subject_commit_required',
    'symlink_forbidden',
    'byte_length_and_raw_sha256_recomputed_from_subject_commit_bytes',
    'artifact_record_order_must_equal_exact_path_order',
    'subject_commit_must_be_ancestor_of_approval_target_head',
    'all_subject_artifact_bytes_must_be_unchanged_at_approval_target_head',
    'recompute_and_compare_required',
  ]) assertEqual(subjectDigestContract[key], true, `${label} decision subject ${key}`);
  assertEqual(subjectDigestContract.digest_formula, 'lowercase_hex_sha256(utf8(subject_digest_domain)+NUL+utf8(RFC8785_JCS(ordered_artifact_record_tuple_arrays)))', `${label} decision subject digest formula`);
  assertEqual(subjectDigestContract.output_format, 'lowercase_hex_sha256_64', `${label} decision subject output format`);

  const cohortIdentity = decisionInstances.designated_cohort_identity_contract;
  assertExactKeys(
    cohortIdentity,
    [
      'schema_version', 'applies_to_decision_class', 'algorithm', 'version', 'domain_separator',
      'canonical_value_encoding', 'projection_container', 'ordered_projection_fields',
      'ordered_projection_value_sources', 'subject_fields_must_pass_subject_digest_contract',
      'designated_cohort_id_type_ref', 'cohort_id_regex_semantics',
      'protected_privacy_classification_validator_status',
      'protected_non_pii_attestation_required_before_d1_use',
      'digest_formula', 'output_field', 'output_format',
      'recompute_and_compare_required', 'arbitrary_or_owner_supplied_digest_forbidden',
    ],
    `${label} designated cohort identity contract`,
  );
  assertEqual(cohortIdentity.schema_version, 'mobile-ux-batch1-designated-cohort-identity.v1', `${label} cohort identity schema`);
  assertEqual(cohortIdentity.applies_to_decision_class, 'cohort_designation', `${label} cohort identity decision class`);
  assertEqual(cohortIdentity.algorithm, 'sha256', `${label} cohort identity algorithm`);
  assertEqual(cohortIdentity.version, 'v1', `${label} cohort identity version`);
  assertEqual(cohortIdentity.domain_separator, 'softbook-cet/mobile-ux-batch1-designated-cohort/v1', `${label} cohort identity domain`);
  assertEqual(cohortIdentity.canonical_value_encoding, 'RFC8785_JCS', `${label} cohort identity canonical encoding`);
  assertEqual(cohortIdentity.projection_container, 'array_of_two_element_field_id_and_canonical_value_tuples', `${label} cohort identity projection container`);
  assertExactArray(
    cohortIdentity.ordered_projection_fields,
    ['designation_subject_commit', 'designation_subject_digest_domain', 'designation_subject_digest', 'designated_cohort_id'],
    `${label} cohort identity projection fields`,
  );
  assertExactArray(
    cohortIdentity.ordered_projection_value_sources,
    [
      'designation_subject_commit=exact_D1_intent.designation_subject_commit',
      'designation_subject_digest_domain=exact_D1_intent.designation_subject_digest_domain',
      'designation_subject_digest=exact_D1_intent.designation_subject_digest',
      'designated_cohort_id=exact_D1_intent.designated_cohort_id',
    ],
    `${label} cohort identity projection value sources`,
  );
  assertEqual(cohortIdentity.subject_fields_must_pass_subject_digest_contract, true, `${label} cohort identity subject validation`);
  assertEqual(cohortIdentity.designated_cohort_id_type_ref, '#/successor_transition_contract/decision_instance_contract/field_type_contracts/designated_cohort_id', `${label} cohort ID type ref`);
  assertEqual(cohortIdentity.cohort_id_regex_semantics, 'syntax_only_not_privacy_proof', `${label} cohort ID regex semantics`);
  assertEqual(cohortIdentity.protected_privacy_classification_validator_status, 'not_implemented', `${label} cohort privacy validator status`);
  assertEqual(cohortIdentity.protected_non_pii_attestation_required_before_d1_use, true, `${label} cohort non-PII attestation gate`);
  assertEqual(cohortIdentity.digest_formula, 'lowercase_hex_sha256(utf8(domain_separator)+NUL+utf8(RFC8785_JCS(ordered_projection_tuple_array)))', `${label} cohort identity digest formula`);
  assertEqual(cohortIdentity.output_field, 'designated_cohort_sha256', `${label} cohort identity output field`);
  assertEqual(cohortIdentity.output_format, 'lowercase_hex_sha256_64', `${label} cohort identity output format`);
  assertEqual(cohortIdentity.recompute_and_compare_required, true, `${label} cohort identity recomputation`);
  assertEqual(cohortIdentity.arbitrary_or_owner_supplied_digest_forbidden, true, `${label} arbitrary cohort digest prohibition`);

  const validity = decisionInstances.decision_validity_policy_contract;
  assertExactKeys(
    validity,
    [
      'schema_version', 'current_status', 'protected_policy_artifact_ref',
      'protected_policy_artifact_raw_sha256', 'condition_evaluator_registry_status',
      'condition_evaluator_registry_ref', 'condition_evaluator_registry_raw_sha256',
      'required_decision_classes', 'required_class_policy_fields', 'class_policy_slots',
      'minimum_required_condition_ids_by_class',
      'expires_at_must_not_exceed_decided_at_plus_class_max_validity_seconds',
      'invalidation_conditions_must_exactly_equal_class_ordered_condition_ids',
      'unknown_condition_id_must_fail_closed',
      'unimplemented_condition_evaluator_must_fail_closed',
      'd1_receipt_use_currently_allowed', 'f3_receipt_use_currently_allowed',
      'protected_owner_policy_and_evaluator_required_before_d1_or_f3_use',
    ],
    `${label} decision validity policy contract`,
  );
  assertEqual(validity.schema_version, 'mobile-ux-batch1-decision-validity-policy.v1', `${label} validity policy schema`);
  assertEqual(validity.current_status, 'owner_policy_missing', `${label} validity policy status`);
  assertEqual(validity.protected_policy_artifact_ref, null, `${label} validity policy ref`);
  assertEqual(validity.protected_policy_artifact_raw_sha256, null, `${label} validity policy digest`);
  assertEqual(validity.condition_evaluator_registry_status, 'not_implemented', `${label} condition evaluator status`);
  assertEqual(validity.condition_evaluator_registry_ref, null, `${label} condition evaluator ref`);
  assertEqual(validity.condition_evaluator_registry_raw_sha256, null, `${label} condition evaluator digest`);
  const decisionClasses = ['cohort_designation', 'manifest_freeze'];
  assertExactArray(validity.required_decision_classes, decisionClasses, `${label} validity decision classes`);
  assertExactArray(validity.required_class_policy_fields, ['max_validity_seconds', 'ordered_invalidation_condition_ids'], `${label} validity class policy fields`);
  assertExactKeys(validity.class_policy_slots, decisionClasses, `${label} validity class policy slots`);
  for (const decisionClass of decisionClasses) {
    const slot = validity.class_policy_slots[decisionClass];
    assertExactKeys(slot, ['status', 'max_validity_seconds', 'ordered_invalidation_condition_ids'], `${label} validity ${decisionClass} policy slot`);
    assertEqual(slot.status, 'unavailable_owner_policy_required', `${label} validity ${decisionClass} status`);
    assertEqual(slot.max_validity_seconds, null, `${label} validity ${decisionClass} max duration`);
    assertEqual(slot.ordered_invalidation_condition_ids, null, `${label} validity ${decisionClass} condition IDs`);
  }
  assertExactKeys(validity.minimum_required_condition_ids_by_class, decisionClasses, `${label} minimum validity conditions`);
  assertExactArray(
    validity.minimum_required_condition_ids_by_class.cohort_designation,
    ['approval_event_chain_invalid', 'decision_subject_bytes_or_digest_drift', 'parent_approval_instance_invalid', 'designated_cohort_identity_digest_mismatch', 'protected_validity_policy_invalid_or_expired'],
    `${label} D1 minimum validity conditions`,
  );
  assertExactArray(
    validity.minimum_required_condition_ids_by_class.manifest_freeze,
    ['approval_event_chain_invalid', 'decision_subject_bytes_or_digest_drift', 'parent_approval_instance_invalid', 'post_designation_binding_subject_drift', 'protected_validity_policy_invalid_or_expired'],
    `${label} F3 minimum validity conditions`,
  );
  for (const key of [
    'expires_at_must_not_exceed_decided_at_plus_class_max_validity_seconds',
    'invalidation_conditions_must_exactly_equal_class_ordered_condition_ids',
    'unknown_condition_id_must_fail_closed',
    'unimplemented_condition_evaluator_must_fail_closed',
    'protected_owner_policy_and_evaluator_required_before_d1_or_f3_use',
  ]) assertEqual(validity[key], true, `${label} validity ${key}`);
  assertEqual(validity.d1_receipt_use_currently_allowed, false, `${label} current D1 receipt use`);
  assertEqual(validity.f3_receipt_use_currently_allowed, false, `${label} current F3 receipt use`);

  const lifecycle = decisionInstances.decision_lifecycle_contract;
  assertExactKeys(
    lifecycle,
    [
      'intent_must_preexist_external_approval_event',
      'intent_must_be_tracked_in_approval_target_head',
      'intent_must_not_contain_post_approval_event_fields',
      'post_approval_event_fields',
      'receipt_must_bind_intent_path_and_raw_sha256',
      'receipt_must_be_absent_from_approval_target_head',
      'receipt_cannot_be_subject_artifact_of_same_approval',
      'receipt_materialization_requires_verified_external_success_event',
      'receipt_commit_must_descend_from_approval_target_head',
    ],
    `${label} decision lifecycle contract`,
  );
  const postApprovalFields = [
    'workflow_run_id', 'run_attempt', 'workflow_conclusion', 'deployment_id', 'deployment_state',
    'approval_id', 'approval_state', 'protected_authority_event_ref', 'authority_event_sha256',
    'reviewer_immutable_id', 'decided_at', 'approval_instance_digest',
  ];
  assertExactArray(lifecycle.post_approval_event_fields, postApprovalFields, `${label} post-approval fields`);
  for (const [key, value] of Object.entries(lifecycle)) {
    if (key !== 'post_approval_event_fields') assertEqual(value, true, `${label} decision lifecycle ${key}`);
  }
  for (const field of postApprovalFields) {
    if (DESIGNATION_DECISION_INTENT_FIELDS.includes(field) || FINAL_FREEZE_DECISION_INTENT_FIELDS.includes(field)) {
      throw new Error(`${label} post-approval field ${field} must not appear in a preapproval intent`);
    }
  }

  const legacy = decisionInstances.legacy_preparation_bootstrap_contract;
  assertExactKeys(
    legacy,
    [
      'decision_class',
      'decision_id',
      'historical_preapproval_intent_status',
      'historical_decision_artifact_path',
      'historical_decision_artifact_raw_sha256',
      'historical_approval_target_head_sha',
      'historical_authority_source_ref',
      'legacy_receipt_subject',
      'migrated_receipt_fixed_values',
      'migrated_receipt_values_must_equal_fixed_values_and_protected_migration_contract',
      'migrated_receipt_exact_field_bindings',
      'future_receipt_path',
      'root_parent_approval_tuple',
      'one_time_migration_contract_status',
      'separate_migration_authorization_record_required',
      'required_two_event_chains',
      'event_chains_must_not_share_or_substitute_head_run_deployment_approval_or_event_ref',
      'trusted_remote_event_reverification_required',
      'materialization_authorized',
      'fabricated_intent_or_receipt_values_forbidden',
      'allowed_next_action',
    ],
    `${label} legacy preparation bootstrap`,
  );
  assertEqual(legacy.decision_class, 'schema_definition', `${label} legacy decision class`);
  assertEqual(legacy.decision_id, 'mobile-ux-batch1-preparation-v1', `${label} legacy decision ID`);
  assertEqual(legacy.historical_preapproval_intent_status, 'did_not_exist_at_approved_head', `${label} legacy intent status`);
  const legacyPath = `${path.posix.dirname(REGISTRY_SET_PATH)}/registry-set.v1.json`;
  const legacyHead = '8f4f82b35b660d9a775d6551e530fe6703c3ac54';
  const legacyRawSha = 'f51f8fc849edacc9e22517266468caff1333d6d12c1a3265cf9a85eec381c982';
  assertEqual(legacy.historical_decision_artifact_path, legacyPath, `${label} legacy artifact path`);
  assertEqual(legacy.historical_decision_artifact_raw_sha256, legacyRawSha, `${label} legacy artifact raw digest`);
  assertEqual(legacy.historical_approval_target_head_sha, legacyHead, `${label} legacy approval head`);
  assertEqual(legacy.historical_authority_source_ref, '#/preparation_authority_ref', `${label} legacy authority source`);
  const legacyCurrentBytes = readRegularFile(root, legacyPath, `${label} legacy preparation artifact`);
  assertEqual(legacyCurrentBytes.length, 25900, `${label} legacy artifact byte length`);
  assertEqual(sha256(legacyCurrentBytes), legacyRawSha, `${label} legacy artifact current raw digest`);
  if (requireTracked) {
    const tree = spawnSync('git', ['-C', path.resolve(root), 'ls-tree', legacyHead, '--', legacyPath], {encoding: 'utf8'});
    if (tree.status !== 0 || !tree.stdout.startsWith('100644 blob ')) {
      throw new Error(`${label} legacy artifact must be a 100644 blob at approved head`);
    }
    const historical = spawnSync('git', ['-C', path.resolve(root), 'show', `${legacyHead}:${legacyPath}`]);
    if (historical.status !== 0) throw new Error(`${label} legacy artifact historical blob must be readable`);
    assertEqual(historical.stdout.length, 25900, `${label} legacy historical byte length`);
    assertEqual(sha256(historical.stdout), legacyRawSha, `${label} legacy historical raw digest`);
  }
  const legacySubject = legacy.legacy_receipt_subject;
  assertExactKeys(
    legacySubject,
    ['subject_commit', 'subject_digest_domain', 'subject_digest', 'artifact_records', 'digest_contract', 'recompute_from_historical_commit_blob_required'],
    `${label} legacy receipt subject`,
  );
  assertEqual(legacySubject.subject_commit, legacyHead, `${label} legacy subject commit`);
  assertEqual(legacySubject.subject_digest_domain, 'softbook-cet/mobile-ux-batch1-legacy-preparation-subject/v1', `${label} legacy subject domain`);
  if (!Array.isArray(legacySubject.artifact_records) || legacySubject.artifact_records.length !== 1) {
    throw new Error(`${label} legacy subject must contain exactly one artifact record`);
  }
  const legacyRecord = legacySubject.artifact_records[0];
  assertExactKeys(legacyRecord, ['path', 'git_mode', 'byte_length', 'raw_sha256'], `${label} legacy subject artifact record`);
  assertEqual(legacyRecord.path, legacyPath, `${label} legacy subject artifact path`);
  assertEqual(legacyRecord.git_mode, '100644', `${label} legacy subject artifact mode`);
  assertEqual(legacyRecord.byte_length, 25900, `${label} legacy subject artifact length`);
  assertEqual(legacyRecord.raw_sha256, legacyRawSha, `${label} legacy subject artifact digest`);
  const legacyDigestContract = legacySubject.digest_contract;
  assertExactKeys(
    legacyDigestContract,
    ['algorithm', 'version', 'canonical_value_encoding', 'projection_container', 'artifact_record_ordered_fields', 'exact_ordered_artifact_paths', 'digest_formula', 'output_format'],
    `${label} legacy subject digest contract`,
  );
  assertEqual(legacyDigestContract.algorithm, 'sha256', `${label} legacy subject algorithm`);
  assertEqual(legacyDigestContract.version, 'v1', `${label} legacy subject version`);
  assertEqual(legacyDigestContract.canonical_value_encoding, 'RFC8785_JCS', `${label} legacy subject canonical encoding`);
  assertEqual(legacyDigestContract.projection_container, 'array_of_two_element_field_id_and_canonical_value_tuples', `${label} legacy subject projection container`);
  const legacyRecordFields = ['path', 'git_mode', 'byte_length', 'raw_sha256'];
  assertExactArray(legacyDigestContract.artifact_record_ordered_fields, legacyRecordFields, `${label} legacy subject record fields`);
  assertExactArray(legacyDigestContract.exact_ordered_artifact_paths, [legacyPath], `${label} legacy subject artifact paths`);
  assertEqual(legacyDigestContract.digest_formula, 'lowercase_hex_sha256(utf8(subject_digest_domain)+NUL+utf8(RFC8785_JCS(ordered_artifact_record_tuple_arrays)))', `${label} legacy subject formula`);
  assertEqual(legacyDigestContract.output_format, 'lowercase_hex_sha256_64', `${label} legacy subject output format`);
  const legacyTuples = legacySubject.artifact_records.map((record) => legacyRecordFields.map((field) => [field, record[field]]));
  const recomputedLegacySubjectDigest = sha256(Buffer.from(`${legacySubject.subject_digest_domain}\0${JSON.stringify(legacyTuples)}`, 'utf8'));
  assertEqual(legacySubject.subject_digest, recomputedLegacySubjectDigest, `${label} legacy subject recomputed digest`);
  assertEqual(legacySubject.recompute_from_historical_commit_blob_required, true, `${label} legacy subject recomputation`);

  const migrated = legacy.migrated_receipt_fixed_values;
  assertExactKeys(migrated, ['gate_effect', 'required_authority_mask', 'allowed_next_action', 'non_claims', 'expires_at_value_source', 'invalidation_conditions'], `${label} legacy migrated receipt values`);
  assertEqual(migrated.gate_effect, 'none', `${label} legacy migrated gate effect`);
  assertExactBooleanMask(migrated.required_authority_mask, D1_AUTHORITY_MASK, `${label} legacy migrated authority`);
  assertEqual(migrated.allowed_next_action, 'implement_R0_B2_materialization_validator_and_prepare_R0_resolution_proposal_only', `${label} legacy migrated next action`);
  assertExactArray(migrated.non_claims, ['cohort_designation', 'manifest_freeze', 'manifest_creation', 'reservation_activation', 'provisioning', 'execution', 'evidence_collection', 'data_manifest_population', 'aggregation', 'promotion', 'architecture_acceptance', 'checkpoint_coverage_or_pass', 'visual_authority', 'implementation', 'native_acceptance', 'release', 'leadership_readiness'], `${label} legacy migrated non-claims`);
  assertEqual(migrated.expires_at_value_source, 'protected_legacy_receipt_migration_contract.expires_at', `${label} legacy migrated expiry source`);
  assertExactArray(migrated.invalidation_conditions, ['historical_remote_event_chain_invalid', 'historical_subject_blob_mode_length_or_raw_sha256_drift', 'historical_preparation_scope_mismatch', 'legacy_receipt_migration_contract_expired_or_invalidated'], `${label} legacy migrated invalidation conditions`);
  assertEqual(legacy.migrated_receipt_values_must_equal_fixed_values_and_protected_migration_contract, true, `${label} legacy migrated value equality`);
  assertExactArray(
    legacy.migrated_receipt_exact_field_bindings,
    [
      'receipt.gate_effect=migrated_receipt_fixed_values.gate_effect',
      'receipt.authority=migrated_receipt_fixed_values.required_authority_mask',
      'receipt.allowed_next_action=migrated_receipt_fixed_values.allowed_next_action',
      'receipt.non_claims=migrated_receipt_fixed_values.non_claims',
      'receipt.expires_at=protected_legacy_receipt_migration_contract.expires_at',
      'receipt.invalidation_conditions=migrated_receipt_fixed_values.invalidation_conditions',
    ],
    `${label} legacy migrated receipt field bindings`,
  );
  assertEqual(legacy.future_receipt_path, DECISION_INSTANCE_PATHS[4], `${label} legacy future receipt path`);
  assertEqual(legacy.root_parent_approval_tuple, null, `${label} legacy root parent`);
  assertEqual(legacy.one_time_migration_contract_status, 'not_implemented', `${label} legacy migration status`);
  assertEqual(legacy.separate_migration_authorization_record_required, true, `${label} legacy separate migration authorization`);
  assertExactArray(legacy.required_two_event_chains, ['historical_8f4_schema_definition_approval_event_chain', 'future_protected_legacy_receipt_migration_authorization_event_chain'], `${label} legacy two event chains`);
  assertEqual(legacy.event_chains_must_not_share_or_substitute_head_run_deployment_approval_or_event_ref, true, `${label} legacy event separation`);
  assertEqual(legacy.trusted_remote_event_reverification_required, true, `${label} legacy remote reverification`);
  assertEqual(legacy.materialization_authorized, false, `${label} legacy materialization authority`);
  assertEqual(legacy.fabricated_intent_or_receipt_values_forbidden, true, `${label} legacy fabrication policy`);
  assertEqual(legacy.allowed_next_action, bootstrap.current_allowed_next_action, `${label} legacy next action binding`);

  if (!Array.isArray(decisionInstances.instances) || decisionInstances.instances.length !== 2) {
    throw new Error(`${label} decision instances must contain exactly D1 and F3`);
  }
  const expectedInstances = [
    {
      stageId: SUCCESSOR_STAGE_IDS[1],
      artifactPath: DECISION_INSTANCE_PATHS[0],
      receiptPath: DECISION_INSTANCE_PATHS[1],
      decisionId: 'mobile-ux-batch1-cohort-designation-v1',
      decisionClass: 'cohort_designation',
      requiredFieldsRef: '#/successor_transition_contract/stages/1/required_decision_intent_fields',
      subjectCommitField: 'designation_subject_commit',
      subjectDigestDomainField: 'designation_subject_digest_domain',
      subjectDigestField: 'designation_subject_digest',
      subjectArtifactRecordsField: 'designation_subject_artifact_records',
      parentDigestField: 'parent_preparation_approval_instance_digest',
      subjectStageOutputId: 'R0_resolution_successor',
      subjectDomain: 'softbook-cet/mobile-ux-batch1-designation-subject/v1',
      gateEffect: 'none',
      authorityMask: D1_AUTHORITY_MASK,
      nonClaimsRef: '#/successor_transition_contract/stages/1/required_decision_non_claims',
      nextAction: 'produce_B2_designation_bound_binding_successor_only',
    },
    {
      stageId: SUCCESSOR_STAGE_IDS[3],
      artifactPath: DECISION_INSTANCE_PATHS[2],
      receiptPath: DECISION_INSTANCE_PATHS[3],
      decisionId: 'mobile-ux-batch1-manifest-freeze-v1',
      decisionClass: 'manifest_freeze',
      requiredFieldsRef: '#/successor_transition_contract/stages/3/required_decision_intent_fields',
      subjectCommitField: 'final_freeze_subject_commit',
      subjectDigestDomainField: 'final_freeze_subject_digest_domain',
      subjectDigestField: 'final_freeze_subject_digest',
      subjectArtifactRecordsField: 'final_freeze_subject_artifact_records',
      parentDigestField: 'parent_designation_approval_instance_digest',
      subjectStageOutputId: 'B2_post_designation_binding_successor',
      subjectDomain: 'softbook-cet/mobile-ux-batch1-final-freeze-subject/v1',
      gateEffect: 'batch1_exact_manifest_freeze_and_reservation_activation_only',
      authorityMask: F3_AUTHORITY_MASK,
      nonClaimsRef: '#/successor_transition_contract/stages/3/required_decision_non_claims',
      nextAction: 'mark_exact_catalog_reservations_active_for_later_separate_authorization_without_manifest_creation_population_execution_or_evidence',
    },
  ];
  decisionInstances.instances.forEach((instance, index) => {
    const instanceLabel = `${label} decision instance[${index}]`;
    const expected = expectedInstances[index];
    assertExactKeys(
      instance,
      [
        'stage_id',
        'intent_artifact_path',
        'approval_receipt_path',
        'decision_id',
        'decision_class',
        'contract_version',
        'required_intent_fields_ref',
        'subject_commit_field',
        'subject_digest_domain_field',
        'subject_digest_field',
        'subject_artifact_records_field',
        'parent_approval_instance_digest_field',
        'required_subject_stage_output_id',
        'required_subject_digest_domain',
        'required_gate_effect',
        'required_authority_mask',
        'required_non_claims_ref',
        'required_allowed_next_action',
        'expiry_required',
        'current_intent_status',
        'current_receipt_status',
      ],
      instanceLabel,
    );
    assertEqual(instance.stage_id, expected.stageId, `${instanceLabel} stage ID`);
    assertEqual(instance.intent_artifact_path, expected.artifactPath, `${instanceLabel} artifact path`);
    assertEqual(instance.approval_receipt_path, expected.receiptPath, `${instanceLabel} receipt path`);
    assertEqual(instance.decision_id, expected.decisionId, `${instanceLabel} decision ID`);
    assertEqual(instance.decision_class, expected.decisionClass, `${instanceLabel} decision class`);
    assertEqual(instance.contract_version, 'v1', `${instanceLabel} contract version`);
    assertEqual(instance.required_intent_fields_ref, expected.requiredFieldsRef, `${instanceLabel} required fields ref`);
    assertEqual(instance.subject_commit_field, expected.subjectCommitField, `${instanceLabel} subject commit field`);
    assertEqual(instance.subject_digest_domain_field, expected.subjectDigestDomainField, `${instanceLabel} subject digest domain field`);
    assertEqual(instance.subject_digest_field, expected.subjectDigestField, `${instanceLabel} subject digest field`);
    assertEqual(instance.subject_artifact_records_field, expected.subjectArtifactRecordsField, `${instanceLabel} subject artifact records field`);
    assertEqual(instance.parent_approval_instance_digest_field, expected.parentDigestField, `${instanceLabel} parent digest field`);
    assertEqual(instance.required_subject_stage_output_id, expected.subjectStageOutputId, `${instanceLabel} subject stage output ID`);
    assertEqual(instance.required_subject_digest_domain, expected.subjectDomain, `${instanceLabel} subject digest domain`);
    assertEqual(instance.required_gate_effect, expected.gateEffect, `${instanceLabel} gate effect`);
    assertExactBooleanMask(instance.required_authority_mask, expected.authorityMask, `${instanceLabel} authority mask`);
    assertEqual(instance.required_non_claims_ref, expected.nonClaimsRef, `${instanceLabel} non-claims ref`);
    assertEqual(instance.required_allowed_next_action, expected.nextAction, `${instanceLabel} next action`);
    assertEqual(instance.expiry_required, true, `${instanceLabel} expiry requirement`);
    assertEqual(instance.current_intent_status, 'absent', `${instanceLabel} current intent status`);
    assertEqual(instance.current_receipt_status, 'absent', `${instanceLabel} current receipt status`);
  });

  const receipt = contract.approval_receipt_contract;
  assertExactKeys(
    receipt,
    [
      'schema_version',
      'current_receipt_count',
      'current_status',
      'receipt_exact_key_set_required',
      'required_common_fields',
      'decision_class_specific_required_fields',
      'intent_receipt_exact_equality_contract',
      'external_event_contract',
      'use_time_validation_contract',
      'approval_instance_digest_contract',
    ],
    `${label}.approval_receipt_contract`,
  );
  assertEqual(receipt.schema_version, 'mobile-ux-batch1-approval-receipt.v1', `${label} approval receipt schema`);
  assertEqual(receipt.current_receipt_count, 0, `${label} current receipt count`);
  assertEqual(receipt.current_status, 'absent_required', `${label} current receipt status`);
  assertEqual(receipt.receipt_exact_key_set_required, true, `${label} receipt exact key set`);
  const receiptCommonFields = [
    'decision_id',
    'decision_class',
    'contract_version',
    'repository',
    'pull_request',
    'approval_target_head_sha',
    'decision_artifact_path',
    'decision_artifact_raw_sha256',
    'subject_commit',
    'subject_digest_domain',
    'subject_digest',
    'workflow_path',
    'trusted_base_sha',
    'workflow_run_id',
    'run_attempt',
    'workflow_conclusion',
    'deployment_id',
    'deployment_state',
    'environment_id',
    'environment_name',
    'approval_id',
    'approval_state',
    'protected_authority_event_ref',
    'authority_event_sha256',
    'reviewer_immutable_id',
    'decided_at',
    'parent_approval_tuple',
    'approval_instance_digest',
  ];
  assertExactArray(receipt.required_common_fields, receiptCommonFields, `${label} receipt common fields`);
  const criticalReceiptFields = ['gate_effect', 'authority', 'allowed_next_action', 'non_claims', 'expires_at', 'invalidation_conditions'];
  const classSpecificReceiptFields = receipt.decision_class_specific_required_fields;
  assertExactKeys(classSpecificReceiptFields, ['schema_definition', 'cohort_designation', 'manifest_freeze'], `${label} class-specific receipt fields`);
  assertExactArray(classSpecificReceiptFields.schema_definition, criticalReceiptFields, `${label} preparation receipt fields`);
  assertExactArray(
    classSpecificReceiptFields.cohort_designation,
    ['designated_cohort_id', 'designated_cohort_sha256', ...criticalReceiptFields],
    `${label} D1 receipt cohort fields`,
  );
  assertExactArray(classSpecificReceiptFields.manifest_freeze, criticalReceiptFields, `${label} F3 receipt class-specific fields`);

  const equality = receipt.intent_receipt_exact_equality_contract;
  assertExactKeys(
    equality,
    [
      'common_equal_fields',
      'class_specific_subject_field_pairs',
      'decision_artifact_path_must_equal_instance_or_legacy_contract_path',
      'decision_artifact_raw_sha256_must_equal_recomputed_intent_or_legacy_artifact_bytes',
      'non_root_intent_parent_digest_must_equal_receipt_parent_tuple_digest',
    ],
    `${label} intent receipt equality contract`,
  );
  assertExactArray(equality.common_equal_fields, ['decision_id', 'decision_class', 'contract_version', 'repository', 'pull_request', ...criticalReceiptFields], `${label} intent receipt common equality`);
  assertExactKeys(equality.class_specific_subject_field_pairs, ['schema_definition', 'cohort_designation', 'manifest_freeze'], `${label} intent receipt class pairs`);
  assertExactArray(equality.class_specific_subject_field_pairs.schema_definition, ['legacy_receipt_subject.subject_commit=subject_commit', 'legacy_receipt_subject.subject_digest_domain=subject_digest_domain', 'legacy_receipt_subject.subject_digest=subject_digest'], `${label} preparation receipt subject equality`);
  assertExactArray(equality.class_specific_subject_field_pairs.cohort_designation, ['designation_subject_commit=subject_commit', 'designation_subject_digest_domain=subject_digest_domain', 'designation_subject_digest=subject_digest', 'designated_cohort_id=designated_cohort_id', 'designated_cohort_sha256=designated_cohort_sha256'], `${label} D1 receipt subject equality`);
  assertExactArray(equality.class_specific_subject_field_pairs.manifest_freeze, ['final_freeze_subject_commit=subject_commit', 'final_freeze_subject_digest_domain=subject_digest_domain', 'final_freeze_subject_digest=subject_digest'], `${label} F3 receipt subject equality`);
  for (const key of ['decision_artifact_path_must_equal_instance_or_legacy_contract_path', 'decision_artifact_raw_sha256_must_equal_recomputed_intent_or_legacy_artifact_bytes', 'non_root_intent_parent_digest_must_equal_receipt_parent_tuple_digest']) {
    assertEqual(equality[key], true, `${label} intent receipt equality ${key}`);
  }

  const externalEvent = receipt.external_event_contract;
  assertExactKeys(
    externalEvent,
    [
      'provider', 'trusted_remote_lookup_required', 'required_repository_full_name',
      'trusted_origin_repository_identity',
      'github_https_or_ssh_origin_must_normalize_to_trusted_repository_identity',
      'repository_must_equal_required_literal_and_trusted_root_origin',
      'fork_pull_request_or_event_substitution_forbidden', 'trusted_workflow_path',
      'required_workflow_conclusion', 'required_deployment_state', 'required_approval_state',
      'required_environment_id', 'required_environment_name', 'required_reviewer_immutable_id',
      'required_pull_request_base_ref',
      'exact_receipt_value_source_bindings', 'all_exact_receipt_values_must_equal_sources',
      'approval_target_head_must_belong_to_exact_repository_and_pull_request',
      'workflow_run_head_sha_must_equal_approval_target_head_sha',
      'trusted_base_sha_must_equal_verified_pull_request_base_sha',
      'pull_request_base_ref_must_equal_required_protected_ref',
      'remote_must_confirm_base_was_protected_main_base_for_same_event_chain',
      'trusted_base_sha_must_be_ancestor_of_approval_target_head_sha',
      'approval_target_head_must_descend_from_trusted_base_sha',
      'trusted_workflow_classifier_and_validator_bytes_must_be_loaded_from_trusted_base_sha',
      'trusted_workflow_classifier_and_validator_raw_sha256_must_match_exact_base_blobs',
      'intent_or_receipt_supplied_trusted_base_forbidden',
      'event_chain_digest_contract', 'event_ref_and_canonical_digest_must_match_verified_remote_chain',
      'event_chain_digest_repository_field_must_equal_required_literal',
      'workflow_run_attempt_deployment_environment_approval_must_be_same_verified_event_chain',
    ],
    `${label} receipt external event`,
  );
  assertEqual(externalEvent.provider, 'github', `${label} external event provider`);
  assertEqual(externalEvent.trusted_remote_lookup_required, true, `${label} external event trusted lookup`);
  assertEqual(externalEvent.required_repository_full_name, 'LENKIN233/softbook_cet', `${label} external event canonical repository`);
  assertEqual(externalEvent.trusted_origin_repository_identity, 'github.com/LENKIN233/softbook_cet', `${label} external event trusted origin identity`);
  for (const key of [
    'github_https_or_ssh_origin_must_normalize_to_trusted_repository_identity',
    'repository_must_equal_required_literal_and_trusted_root_origin',
    'fork_pull_request_or_event_substitution_forbidden',
  ]) assertEqual(externalEvent[key], true, `${label} external repository ${key}`);
  assertEqual(externalEvent.trusted_workflow_path, '.github/workflows/formal-approval.yml', `${label} external event workflow path`);
  assertEqual(externalEvent.required_workflow_conclusion, 'success', `${label} external event workflow conclusion`);
  assertEqual(externalEvent.required_deployment_state, 'success', `${label} external event deployment state`);
  assertEqual(externalEvent.required_approval_state, 'approved', `${label} external event approval state`);
  assertEqual(externalEvent.required_environment_id, 18348068326, `${label} external event environment ID`);
  assertEqual(externalEvent.required_environment_name, 'formal-product-owner-approval', `${label} external event environment name`);
  assertEqual(externalEvent.required_reviewer_immutable_id, 'github:LENKIN233#113219944', `${label} external event reviewer`);
  assertEqual(externalEvent.required_pull_request_base_ref, 'refs/heads/main', `${label} external event protected base ref`);
  const remoteSourceBindings = [
    'repository=verified_remote_event_chain.repository_full_name',
    'pull_request=verified_remote_event_chain.pull_request_number',
    'approval_target_head_sha=verified_remote_event_chain.workflow_head_sha',
    'workflow_path=verified_remote_event_chain.workflow_path',
    'trusted_base_sha=verified_remote_event_chain.pull_request_base_sha',
    'workflow_run_id=verified_remote_event_chain.workflow_run_id',
    'run_attempt=verified_remote_event_chain.run_attempt',
    'workflow_conclusion=verified_remote_event_chain.workflow_conclusion',
    'deployment_id=verified_remote_event_chain.deployment_id',
    'deployment_state=verified_remote_event_chain.deployment_state',
    'environment_id=verified_remote_event_chain.environment_id',
    'environment_name=verified_remote_event_chain.environment_name',
    'approval_id=verified_remote_event_chain.approval_id',
    'approval_state=verified_remote_event_chain.approval_state',
    'protected_authority_event_ref=verified_remote_event_chain.protected_authority_event_ref',
    'authority_event_sha256=recomputed_event_chain_digest',
    'reviewer_immutable_id=verified_remote_event_chain.reviewer_immutable_id',
    'decided_at=verified_remote_event_chain.decided_at',
  ];
  assertExactArray(externalEvent.exact_receipt_value_source_bindings, remoteSourceBindings, `${label} external event receipt value sources`);
  for (const key of [
    'all_exact_receipt_values_must_equal_sources',
    'approval_target_head_must_belong_to_exact_repository_and_pull_request',
    'workflow_run_head_sha_must_equal_approval_target_head_sha',
    'trusted_base_sha_must_equal_verified_pull_request_base_sha',
    'pull_request_base_ref_must_equal_required_protected_ref',
    'remote_must_confirm_base_was_protected_main_base_for_same_event_chain',
    'trusted_base_sha_must_be_ancestor_of_approval_target_head_sha',
    'approval_target_head_must_descend_from_trusted_base_sha',
    'trusted_workflow_classifier_and_validator_bytes_must_be_loaded_from_trusted_base_sha',
    'trusted_workflow_classifier_and_validator_raw_sha256_must_match_exact_base_blobs',
    'intent_or_receipt_supplied_trusted_base_forbidden',
    'event_ref_and_canonical_digest_must_match_verified_remote_chain',
    'event_chain_digest_repository_field_must_equal_required_literal',
  ]) assertEqual(externalEvent[key], true, `${label} external event ${key}`);
  const eventDigest = externalEvent.event_chain_digest_contract;
  assertExactKeys(
    eventDigest,
    ['algorithm', 'version', 'domain_separator', 'canonical_value_encoding', 'projection_container', 'ordered_projection_fields', 'projection_values_must_come_from_same_verified_remote_event_chain', 'digest_formula', 'output_field', 'output_format', 'recompute_and_compare_required'],
    `${label} external event chain digest`,
  );
  assertEqual(eventDigest.algorithm, 'sha256', `${label} external event digest algorithm`);
  assertEqual(eventDigest.version, 'v1', `${label} external event digest version`);
  assertEqual(eventDigest.domain_separator, 'softbook-cet/mobile-ux-batch1-protected-approval-event-chain/v1', `${label} external event digest domain`);
  assertEqual(eventDigest.canonical_value_encoding, 'RFC8785_JCS', `${label} external event digest encoding`);
  assertEqual(eventDigest.projection_container, 'array_of_two_element_field_id_and_canonical_value_tuples', `${label} external event digest container`);
  assertExactArray(eventDigest.ordered_projection_fields, remoteSourceBindings.filter((entry) => !entry.startsWith('authority_event_sha256=')).map((entry) => entry.split('=')[0]), `${label} external event digest fields`);
  assertEqual(eventDigest.projection_values_must_come_from_same_verified_remote_event_chain, true, `${label} external event digest source`);
  assertEqual(eventDigest.digest_formula, 'lowercase_hex_sha256(utf8(domain_separator)+NUL+utf8(RFC8785_JCS(ordered_projection_tuple_array)))', `${label} external event digest formula`);
  assertEqual(eventDigest.output_field, 'authority_event_sha256', `${label} external event digest output field`);
  assertEqual(eventDigest.output_format, 'lowercase_hex_sha256_64', `${label} external event digest output format`);
  assertEqual(eventDigest.recompute_and_compare_required, true, `${label} external event digest recomputation`);
  assertEqual(externalEvent.workflow_run_attempt_deployment_environment_approval_must_be_same_verified_event_chain, true, `${label} external event chain binding`);

  const useTime = receipt.use_time_validation_contract;
  assertExactKeys(useTime, ['expires_at_must_be_after_decided_at', 'use_or_child_decision_time_must_be_before_expires_at', 'invalidation_conditions_must_be_recomputed_at_use_time', 'every_invalidation_condition_must_evaluate_false', 'cached_validity_result_forbidden', 'remote_event_chain_must_still_be_valid'], `${label} receipt use-time validation`);
  for (const [key, value] of Object.entries(useTime)) assertEqual(value, true, `${label} receipt use-time ${key}`);

  const receiptDigest = receipt.approval_instance_digest_contract;
  assertExactKeys(
    receiptDigest,
    [
      'algorithm',
      'version',
      'domain_separator',
      'canonical_value_encoding',
      'projection_container',
      'projection_tuple_fields',
      'generic_ordered_projection_fields',
      'class_specific_ordered_projection_fields',
      'projection_construction_rule',
      'object_property_order_must_not_define_projection_order',
      'digest_formula',
      'output_format',
      'recompute_and_compare_required',
    ],
    `${label} approval receipt digest contract`,
  );
  assertEqual(receiptDigest.algorithm, 'sha256', `${label} approval receipt algorithm`);
  assertEqual(receiptDigest.version, 'v1', `${label} approval receipt version`);
  assertEqual(
    receiptDigest.domain_separator,
    'softbook-cet/mobile-ux-batch1-approval-instance/v1',
    `${label} approval receipt domain`,
  );
  assertEqual(receiptDigest.canonical_value_encoding, 'RFC8785_JCS', `${label} approval receipt canonical encoding`);
  assertEqual(receiptDigest.projection_container, 'array_of_two_element_field_id_and_canonical_value_tuples', `${label} approval receipt projection container`);
  assertExactArray(receiptDigest.projection_tuple_fields, ['field_id', 'canonical_value'], `${label} approval receipt tuple fields`);
  assertExactArray(receiptDigest.generic_ordered_projection_fields, receiptCommonFields.slice(0, -1), `${label} approval receipt generic projection`);
  const classSpecificProjection = receiptDigest.class_specific_ordered_projection_fields;
  assertExactKeys(classSpecificProjection, ['schema_definition', 'cohort_designation', 'manifest_freeze'], `${label} class-specific receipt projection`);
  assertExactArray(classSpecificProjection.schema_definition, criticalReceiptFields, `${label} preparation receipt projection`);
  assertExactArray(
    classSpecificProjection.cohort_designation,
    ['designated_cohort_id', 'designated_cohort_sha256', ...criticalReceiptFields],
    `${label} D1 receipt cohort projection`,
  );
  assertExactArray(classSpecificProjection.manifest_freeze, criticalReceiptFields, `${label} F3 receipt class-specific projection`);
  assertEqual(receiptDigest.projection_construction_rule, 'append_generic_field_tuples_in_declared_order_then_exact_decision_class_specific_field_tuples_in_declared_order', `${label} approval receipt projection construction`);
  assertEqual(receiptDigest.object_property_order_must_not_define_projection_order, true, `${label} approval receipt object order policy`);
  assertEqual(
    receiptDigest.digest_formula,
    'lowercase_hex_sha256(utf8(domain_separator)+NUL+utf8(RFC8785_JCS(concatenated_ordered_projection_tuple_array)))',
    `${label} approval receipt formula`,
  );
  assertEqual(receiptDigest.output_format, 'lowercase_hex_sha256_64', `${label} approval receipt output format`);
  assertEqual(receiptDigest.recompute_and_compare_required, true, `${label} approval receipt recomputation`);

  const stagedParent = contract.staged_parent_contract;
  assertExactKeys(
    stagedParent,
    [
      'schema_version',
      'tuple_fields',
      'tuple_exact_key_set_required',
      'ordered_value_source_bindings',
      'all_parent_tuple_values_must_equal_exact_sources',
      'validation_rules',
      'opaque_parent_digest_without_exact_tuple_forbidden',
      'root_parent_rules',
      'current_preparation_receipt',
      'required_chains',
    ],
    `${label}.staged_parent_contract`,
  );
  assertEqual(stagedParent.schema_version, 'mobile-ux-batch1-staged-parent.v1', `${label} staged parent schema`);
  assertExactArray(
    stagedParent.tuple_fields,
    [
      'parent_approval_target_head_sha',
      'parent_receipt_materialization_commit_sha',
      'parent_decision_artifact_path',
      'parent_decision_artifact_raw_sha256',
      'parent_receipt_path',
      'parent_receipt_raw_sha256',
      'parent_subject_digest_domain',
      'parent_subject_digest',
      'parent_workflow_run_id',
      'parent_run_attempt',
      'parent_deployment_id',
      'parent_environment_id',
      'parent_environment_name',
      'parent_reviewer_immutable_id',
      'parent_decided_at',
      'parent_approval_instance_digest',
    ],
    `${label} staged parent tuple`,
  );
  assertEqual(stagedParent.tuple_exact_key_set_required, true, `${label} staged parent exact tuple keys`);
  const expectedParentSources = [
    'parent_approval_target_head_sha=verified_parent_receipt.approval_target_head_sha',
    'parent_receipt_materialization_commit_sha=verified_commit_containing_exact_parent_receipt_bytes',
    'parent_decision_artifact_path=verified_parent_receipt.decision_artifact_path',
    'parent_decision_artifact_raw_sha256=verified_parent_receipt.decision_artifact_raw_sha256',
    'parent_receipt_path=required_chain.parent_receipt_path',
    'parent_receipt_raw_sha256=sha256(raw_parent_receipt_bytes_at_materialization_commit)',
    'parent_subject_digest_domain=verified_parent_receipt.subject_digest_domain',
    'parent_subject_digest=verified_parent_receipt.subject_digest',
    'parent_workflow_run_id=verified_parent_receipt.workflow_run_id',
    'parent_run_attempt=verified_parent_receipt.run_attempt',
    'parent_deployment_id=verified_parent_receipt.deployment_id',
    'parent_environment_id=verified_parent_receipt.environment_id',
    'parent_environment_name=verified_parent_receipt.environment_name',
    'parent_reviewer_immutable_id=verified_parent_receipt.reviewer_immutable_id',
    'parent_decided_at=verified_parent_receipt.decided_at',
    'parent_approval_instance_digest=recomputed_parent_receipt.approval_instance_digest',
  ];
  assertExactArray(stagedParent.ordered_value_source_bindings, expectedParentSources, `${label} staged parent value sources`);
  assertEqual(stagedParent.all_parent_tuple_values_must_equal_exact_sources, true, `${label} staged parent source equality`);
  assertExactArray(
    stagedParent.validation_rules,
    [
      'parent_approval_target_head_must_be_ancestor_of_child_approval_target_head',
      'parent_receipt_materialization_commit_must_be_ancestor_of_child_approval_target_head',
      'parent_subject_bytes_and_digest_must_be_unchanged_at_child_head',
      'parent_decision_artifact_raw_bytes_must_be_unchanged_at_child_head',
      'parent_receipt_raw_bytes_must_be_unchanged_at_child_head',
      'parent_receipt_fields_and_digest_must_recompute_exactly',
      'parent_decision_class_must_match_required_chain_stage',
      'child_must_bind_full_parent_tuple_not_only_parent_digest',
      'child_intent_parent_approval_instance_digest_must_equal_parent_tuple_digest',
    ],
    `${label} staged parent validation rules`,
  );
  assertEqual(
    stagedParent.opaque_parent_digest_without_exact_tuple_forbidden,
    true,
    `${label} opaque parent digest prohibition`,
  );
  const rootParent = stagedParent.root_parent_rules;
  assertExactKeys(rootParent, ['root_decision_class', 'required_parent_approval_tuple_value', 'canonical_root_parent_sentinel', 'root_parent_allowed_only_for_schema_definition', 'non_root_parent_tuple_must_be_non_null'], `${label} root parent rules`);
  assertEqual(rootParent.root_decision_class, 'schema_definition', `${label} root parent decision class`);
  assertEqual(rootParent.required_parent_approval_tuple_value, null, `${label} root parent tuple value`);
  assertEqual(rootParent.canonical_root_parent_sentinel, 'json_null', `${label} root parent sentinel`);
  assertEqual(rootParent.root_parent_allowed_only_for_schema_definition, true, `${label} root parent class restriction`);
  assertEqual(rootParent.non_root_parent_tuple_must_be_non_null, true, `${label} non-root parent tuple requirement`);
  const currentPreparation = stagedParent.current_preparation_receipt;
  assertExactKeys(
    currentPreparation,
    ['artifact_path', 'status', 'materialization_status', 'blocker', 'historical_intent_status', 'materialization_authorized', 'fabricated_values_forbidden'],
    `${label} current preparation receipt`,
  );
  assertEqual(currentPreparation.artifact_path, DECISION_INSTANCE_PATHS[4], `${label} preparation receipt path`);
  assertEqual(currentPreparation.status, 'missing', `${label} preparation receipt status`);
  assertEqual(currentPreparation.materialization_status, 'not_implemented', `${label} preparation receipt materialization`);
  assertEqual(currentPreparation.blocker, 'trusted_governance_bootstrap_and_legacy_receipt_migration_contract_approval_required', `${label} preparation receipt blocker`);
  assertEqual(currentPreparation.historical_intent_status, 'did_not_exist_at_approved_head', `${label} preparation historical intent status`);
  assertEqual(currentPreparation.materialization_authorized, false, `${label} preparation materialization authority`);
  assertEqual(currentPreparation.fabricated_values_forbidden, true, `${label} preparation receipt fabrication policy`);
  const expectedChains = [
    {
      child_decision_class: 'cohort_designation',
      parent_decision_class: 'schema_definition',
      parent_receipt_path: DECISION_INSTANCE_PATHS[4],
    },
    {
      child_decision_class: 'manifest_freeze',
      parent_decision_class: 'cohort_designation',
      parent_receipt_path: DECISION_INSTANCE_PATHS[1],
    },
  ];
  if (!Array.isArray(stagedParent.required_chains) || stagedParent.required_chains.length !== expectedChains.length) {
    throw new Error(`${label} staged parent chains must contain exactly D1 and F3 chains`);
  }
  stagedParent.required_chains.forEach((chain, index) => {
    const chainLabel = `${label} staged parent chain[${index}]`;
    assertExactKeys(chain, Object.keys(expectedChains[index]), chainLabel);
    for (const [key, value] of Object.entries(expectedChains[index])) assertEqual(chain[key], value, `${chainLabel}.${key}`);
  });
  for (const decisionPath of DECISION_INSTANCE_PATHS) {
    assertPathAbsent(root, decisionPath, `${label} future decision artifact`, {requireTracked});
  }

  const separation = contract.decision_separation_requirements;
  assertExactKeys(
    separation,
    [
      'designation_and_final_freeze_exact_heads_must_differ',
      'designation_and_final_freeze_subject_digests_must_differ',
      'designation_and_final_freeze_workflow_run_ids_must_differ',
      'designation_and_final_freeze_deployment_ids_must_differ',
      'designation_and_final_freeze_approval_ids_must_differ',
      'designation_and_final_freeze_authority_event_refs_must_differ',
      'designation_and_final_freeze_authority_event_sha256_must_differ',
      'each_approval_event_exact_decision_class_count',
      'mixed_new_decision_classes_in_same_exact_head_change_set_forbidden',
      'final_freeze_must_bind_designation_approval_instance_digest',
      'trusted_same_pr_prior_approved_head_must_be_ancestor',
      'trusted_same_pr_parent_subject_must_be_unchanged',
      'pull_request_separation_policy',
      'trusted_staged_same_pr_path_status',
    ],
    `${label}.decision_separation_requirements`,
  );
  for (const key of [
    'designation_and_final_freeze_exact_heads_must_differ',
    'designation_and_final_freeze_subject_digests_must_differ',
    'designation_and_final_freeze_workflow_run_ids_must_differ',
    'designation_and_final_freeze_deployment_ids_must_differ',
    'designation_and_final_freeze_approval_ids_must_differ',
    'designation_and_final_freeze_authority_event_refs_must_differ',
    'designation_and_final_freeze_authority_event_sha256_must_differ',
    'mixed_new_decision_classes_in_same_exact_head_change_set_forbidden',
    'final_freeze_must_bind_designation_approval_instance_digest',
    'trusted_same_pr_prior_approved_head_must_be_ancestor',
    'trusted_same_pr_parent_subject_must_be_unchanged',
  ]) {
    assertEqual(separation[key], true, `${label} decision separation ${key}`);
  }
  assertEqual(
    separation.each_approval_event_exact_decision_class_count,
    1,
    `${label} one decision class per approval event`,
  );
  assertEqual(
    separation.pull_request_separation_policy,
    'distinct_pr_or_trusted_staged_same_pr_subject',
    `${label} pull request separation policy`,
  );
  assertEqual(
    separation.trusted_staged_same_pr_path_status,
    'not_implemented',
    `${label} staged same-PR authority path status`,
  );

  if (!Array.isArray(contract.stages) || contract.stages.length !== 4) {
    throw new Error(`${label}.stages must contain exactly R0, D1, B2, and F3`);
  }
  contract.stages.forEach((stage, index) => {
    assertEqual(stage.stage_id, SUCCESSOR_STAGE_IDS[index], `${label}.stages[${index}].stage_id`);
    assertEqual(stage.ordinal, index + 1, `${label}.stages[${index}].ordinal`);
    assertAuthorityObjectFalse(stage.authority, `${label}.stages[${index}].authority`);
  });

  const [resolution, designation, binding, finalFreeze] = contract.stages;
  assertExactKeys(
    resolution,
    [
      'stage_id',
      'ordinal',
      'input_subject',
      'required_resolution_set',
      'resolved_requirement_count',
      'pending_requirement_count',
      'output_subject',
      'must_be_distinct_from',
      'gate_effect',
      'manifest_root_state',
      'authority',
    ],
    `${label}.stages[0]`,
  );
  assertEqual(resolution.input_subject, 'current_candidate_exact_bytes', `${label} R0 input`);
  assertEqual(
    resolution.required_resolution_set,
    'all_current_requirement_ids_except_post_designation_requirement_ids',
    `${label} R0 exact resolution set`,
  );
  assertEqual(resolution.resolved_requirement_count, 136, `${label} R0 resolved count`);
  assertEqual(resolution.pending_requirement_count, deferredIds.length, `${label} R0 pending count`);
  assertEqual(resolution.output_subject, 'resolution_successor_distinct_exact_bytes', `${label} R0 output`);
  assertExactArray(resolution.must_be_distinct_from, ['current_candidate_exact_bytes'], `${label} R0 byte distinction`);
  assertEqual(resolution.gate_effect, 'none', `${label} R0 gate effect`);
  assertEqual(resolution.manifest_root_state, 'absent', `${label} R0 manifest root state`);

  assertExactKeys(
    designation,
    [
      'stage_id',
      'ordinal',
      'input_subject',
      'required_decision_type',
      'decision_subject',
      'required_decision_intent_fields',
      'decision_intent_contract_ref',
      'designated_cohort_identity_contract_ref',
      'approval_receipt_contract_ref',
      'current_intent_status',
      'current_receipt_status',
      'decision_event_must_be_external_to_subject_bytes',
      'receipt_must_not_be_in_same_approval_subject',
      'decision_event_must_be_distinct_from_final_manifest_freeze',
      'gate_effect',
      'does_not_authorize',
      'required_decision_non_claims',
      'required_decision_allowed_next_action',
      'manifest_root_state',
      'authority',
    ],
    `${label}.stages[1]`,
  );
  assertEqual(designation.input_subject, 'resolution_successor_exact_bytes', `${label} D1 input`);
  assertEqual(designation.required_decision_type, 'protected_cohort_designation', `${label} D1 decision type`);
  assertEqual(
    designation.decision_subject,
    'preexisting_resolution_successor_exact_commit_and_digest',
    `${label} D1 decision subject`,
  );
  assertExactArray(designation.required_decision_intent_fields, DESIGNATION_DECISION_INTENT_FIELDS, `${label} D1 decision intent fields`);
  assertEqual(designation.decision_intent_contract_ref, '#/successor_transition_contract/decision_instance_contract/instances/0', `${label} D1 intent contract ref`);
  assertEqual(designation.designated_cohort_identity_contract_ref, '#/successor_transition_contract/decision_instance_contract/designated_cohort_identity_contract', `${label} D1 cohort identity contract ref`);
  assertEqual(designation.approval_receipt_contract_ref, '#/successor_transition_contract/approval_receipt_contract', `${label} D1 receipt contract ref`);
  assertEqual(designation.current_intent_status, 'missing', `${label} D1 current intent status`);
  assertEqual(designation.current_receipt_status, 'missing', `${label} D1 current receipt status`);
  assertEqual(designation.decision_event_must_be_external_to_subject_bytes, true, `${label} D1 external event`);
  assertEqual(designation.receipt_must_not_be_in_same_approval_subject, true, `${label} D1 receipt circularity prohibition`);
  assertEqual(
    designation.decision_event_must_be_distinct_from_final_manifest_freeze,
    true,
    `${label} D1/F3 decision separation`,
  );
  assertEqual(designation.gate_effect, 'none', `${label} D1 gate effect`);
  assertExactArray(
    designation.does_not_authorize,
    D1_NON_CLAIMS,
    `${label} D1 non-authorization`,
  );
  assertExactArray(designation.required_decision_non_claims, D1_NON_CLAIMS, `${label} D1 decision non-claims`);
  assertEqual(
    designation.required_decision_allowed_next_action,
    'produce_B2_designation_bound_binding_successor_only',
    `${label} D1 decision next action`,
  );
  assertEqual(designation.manifest_root_state, 'absent', `${label} D1 manifest root state`);

  assertExactKeys(
    binding,
    [
      'stage_id',
      'ordinal',
      'input_subject',
      'required_prior_decision_type',
      'required_bindings_source',
      'exact_requirement_ids_ref',
      'mutable_requirement_count',
      'immutable_requirement_count',
      'immutable_requirement_set',
      'immutable_requirement_drift_rule',
      'allowed_non_requirement_changes',
      'required_binding_metadata_fields',
      'binding_metadata_exact_key_set_required',
      'required_binding_metadata_value_sources',
      'all_binding_metadata_values_must_equal_exact_sources',
      'resolved_requirement_count',
      'pending_requirement_count',
      'build_contract_ref',
      'build_recipe_must_be_implemented_before_B2',
      'compatibility_derivation_contract_ref',
      'compatibility_key_policy',
      'synthetic_compatibility_key_forbidden',
      'output_subject',
      'must_be_distinct_from',
      'candidate_status_after_stage',
      'manifest_freeze_eligible_after_stage',
      'manifest_instance_count_after_stage',
      'gate_effect',
      'manifest_root_state',
      'authority',
    ],
    `${label}.stages[2]`,
  );
  assertEqual(
    binding.input_subject,
    'resolution_successor_exact_bytes_plus_external_cohort_designation',
    `${label} B2 input`,
  );
  assertEqual(binding.required_prior_decision_type, 'protected_cohort_designation', `${label} B2 prior decision`);
  assertEqual(binding.required_bindings_source, 'exact_protected_designated_cohort', `${label} B2 binding source`);
  assertEqual(
    binding.exact_requirement_ids_ref,
    '#/successor_transition_contract/post_designation_requirement_ids_by_kind',
    `${label} B2 exact mutable requirements ref`,
  );
  assertEqual(binding.mutable_requirement_count, 9, `${label} B2 mutable requirement count`);
  assertEqual(binding.immutable_requirement_count, 136, `${label} B2 immutable requirement count`);
  assertEqual(
    binding.immutable_requirement_set,
    'all_current_requirement_ids_except_post_designation_requirement_ids',
    `${label} B2 immutable requirement set`,
  );
  assertEqual(
    binding.immutable_requirement_drift_rule,
    'requires_new_D1_protected_cohort_designation',
    `${label} B2 immutable drift rule`,
  );
  assertExactArray(
    binding.allowed_non_requirement_changes,
    [
      'designation_decision_binding',
      'derived_requirement_inventory_digest',
      'derived_pending_and_resolved_counts',
      'derived_blocker_accounting',
      'derived_candidate_status',
    ],
    `${label} B2 derived changes`,
  );
  assertExactArray(
    binding.required_binding_metadata_fields,
    [
      'designation_subject_commit',
      'designation_subject_digest_domain',
      'designation_subject_digest',
      'designated_cohort_id',
      'designated_cohort_sha256',
      'designation_approval_instance_digest',
      'build_source_closure_digest',
      'binding_bundle_digest',
      'cp_ba_compatibility_map_digest',
    ],
    `${label} B2 binding metadata`,
  );
  assertEqual(binding.binding_metadata_exact_key_set_required, true, `${label} B2 binding metadata exact keys`);
  assertExactArray(
    binding.required_binding_metadata_value_sources,
    [
      'designation_subject_commit=exact_D1_intent.designation_subject_commit',
      'designation_subject_digest_domain=exact_D1_intent.designation_subject_digest_domain',
      'designation_subject_digest=exact_D1_intent.designation_subject_digest',
      'designated_cohort_id=exact_D1_intent.designated_cohort_id',
      'designated_cohort_sha256=exact_D1_intent.designated_cohort_sha256',
      'designation_approval_instance_digest=recomputed_D1_receipt.approval_instance_digest',
      'build_source_closure_digest=resolved_build_value.source_closure_digest',
      'binding_bundle_digest=recomputed_binding_bundle.binding_bundle_digest',
      'cp_ba_compatibility_map_digest=recomputed_compatibility_map_cp_ba_v1_output',
    ],
    `${label} B2 binding metadata value sources`,
  );
  assertEqual(binding.all_binding_metadata_values_must_equal_exact_sources, true, `${label} B2 binding metadata equality`);
  assertEqual(binding.resolved_requirement_count, 145, `${label} B2 resolved count`);
  assertEqual(binding.pending_requirement_count, 0, `${label} B2 pending count`);
  assertEqual(
    binding.build_contract_ref,
    '#/successor_transition_contract/designation_bound_build_contract',
    `${label} B2 build contract ref`,
  );
  assertEqual(binding.build_recipe_must_be_implemented_before_B2, true, `${label} B2 build recipe blocker`);
  assertEqual(
    binding.compatibility_derivation_contract_ref,
    '#/successor_transition_contract/compatibility_derivation_contract',
    `${label} B2 compatibility derivation ref`,
  );
  assertEqual(
    binding.compatibility_key_policy,
    'deterministic_sha256_recomputed_from_designation_bound_source_closure',
    `${label} B2 compatibility policy`,
  );
  assertEqual(binding.synthetic_compatibility_key_forbidden, true, `${label} B2 synthetic key prohibition`);
  assertEqual(binding.output_subject, 'complete_successor_distinct_exact_bytes', `${label} B2 output`);
  assertExactArray(
    binding.must_be_distinct_from,
    ['current_candidate_exact_bytes', 'resolution_successor_exact_bytes'],
    `${label} B2 byte distinction`,
  );
  assertEqual(
    binding.candidate_status_after_stage,
    'complete_candidate_pending_final_manifest_freeze',
    `${label} B2 candidate status`,
  );
  assertEqual(binding.manifest_freeze_eligible_after_stage, false, `${label} B2 freeze eligibility`);
  assertEqual(binding.manifest_instance_count_after_stage, 0, `${label} B2 manifest instance count`);
  assertEqual(binding.gate_effect, 'none', `${label} B2 gate effect`);
  assertEqual(binding.manifest_root_state, 'absent', `${label} B2 manifest root state`);

  assertExactKeys(
    finalFreeze,
    [
      'stage_id',
      'ordinal',
      'input_subject',
      'required_decision_type',
      'decision_subject',
      'required_decision_intent_fields',
      'decision_intent_contract_ref',
      'approval_receipt_contract_ref',
      'frozen_b2_binding_metadata_fields_ref',
      'current_intent_status',
      'current_receipt_status',
      'decision_event_must_be_external_to_subject_bytes',
      'receipt_must_not_be_in_same_approval_subject',
      'decision_event_must_be_distinct_from_cohort_designation',
      'final_freeze_self_reference_forbidden',
      'gate_effect_before_decision',
      'manifest_root_state_before_decision',
      'reservation_activation_semantics',
      'reservation_activation_record',
      'frozen_subject_artifacts_immutable_after_F3',
      'catalog_metadata_mutation_forbidden',
      'any_frozen_subject_artifact_drift_invalidates_F3',
      'manifest_root_state_after_decision',
      'manifest_instance_count_after_decision',
      'required_decision_gate_effect',
      'required_decision_authority_matrix',
      'required_decision_non_claims',
      'required_decision_allowed_next_action',
      'separate_authority_requirements',
      'authorization_rule',
      'authority',
    ],
    `${label}.stages[3]`,
  );
  assertEqual(finalFreeze.input_subject, 'complete_successor_exact_bytes', `${label} F3 input`);
  assertEqual(finalFreeze.required_decision_type, 'protected_manifest_freeze', `${label} F3 decision type`);
  assertEqual(
    finalFreeze.decision_subject,
    'preexisting_complete_successor_exact_commit_and_digest',
    `${label} F3 decision subject`,
  );
  assertExactArray(finalFreeze.required_decision_intent_fields, FINAL_FREEZE_DECISION_INTENT_FIELDS, `${label} F3 decision intent fields`);
  assertEqual(finalFreeze.decision_intent_contract_ref, '#/successor_transition_contract/decision_instance_contract/instances/1', `${label} F3 intent contract ref`);
  assertEqual(finalFreeze.approval_receipt_contract_ref, '#/successor_transition_contract/approval_receipt_contract', `${label} F3 receipt contract ref`);
  assertEqual(finalFreeze.frozen_b2_binding_metadata_fields_ref, '#/successor_transition_contract/stages/2/required_binding_metadata_fields', `${label} F3 frozen B2 metadata ref`);
  assertEqual(finalFreeze.current_intent_status, 'missing', `${label} F3 current intent status`);
  assertEqual(finalFreeze.current_receipt_status, 'missing', `${label} F3 current receipt status`);
  assertEqual(finalFreeze.decision_event_must_be_external_to_subject_bytes, true, `${label} F3 external event`);
  assertEqual(finalFreeze.receipt_must_not_be_in_same_approval_subject, true, `${label} F3 receipt circularity prohibition`);
  assertEqual(
    finalFreeze.decision_event_must_be_distinct_from_cohort_designation,
    true,
    `${label} F3/D1 decision separation`,
  );
  assertEqual(finalFreeze.final_freeze_self_reference_forbidden, true, `${label} F3 self-reference prohibition`);
  assertEqual(finalFreeze.gate_effect_before_decision, 'none', `${label} F3 pre-decision gate effect`);
  assertEqual(finalFreeze.manifest_root_state_before_decision, 'absent', `${label} F3 pre-decision manifest root`);
  assertEqual(finalFreeze.reservation_activation_semantics, 'post_event_receipt_gate_effect_eligibility_marker_only_no_frozen_subject_mutation', `${label} F3 reservation activation semantics`);
  assertEqual(finalFreeze.reservation_activation_record, 'verified_F3_approval_receipt_gate_effect', `${label} F3 reservation activation record`);
  assertEqual(finalFreeze.frozen_subject_artifacts_immutable_after_F3, true, `${label} F3 frozen subject immutability`);
  assertEqual(finalFreeze.catalog_metadata_mutation_forbidden, true, `${label} F3 catalog mutation prohibition`);
  assertEqual(finalFreeze.any_frozen_subject_artifact_drift_invalidates_F3, true, `${label} F3 subject drift invalidation`);
  assertEqual(finalFreeze.manifest_root_state_after_decision, 'absent', `${label} F3 post-decision manifest root`);
  assertEqual(finalFreeze.manifest_instance_count_after_decision, 0, `${label} F3 post-decision manifest count`);
  assertEqual(
    finalFreeze.required_decision_gate_effect,
    'batch1_exact_manifest_freeze_and_reservation_activation_only',
    `${label} F3 decision gate effect`,
  );
  assertExactBooleanMask(
    finalFreeze.required_decision_authority_matrix,
    F3_AUTHORITY_MASK,
    `${label} F3 decision authority matrix`,
  );
  assertExactArray(finalFreeze.required_decision_non_claims, F3_NON_CLAIMS, `${label} F3 decision non-claims`);
  assertEqual(
    finalFreeze.required_decision_allowed_next_action,
    'mark_exact_catalog_reservations_active_for_later_separate_authorization_without_manifest_creation_population_execution_or_evidence',
    `${label} F3 decision next action`,
  );
  assertExactArray(
    finalFreeze.separate_authority_requirements,
    [
      'manifest_creation_requires_separate_execution_authority',
      'data_manifest_population_requires_separate_execution_authority',
      'checkpoint_evidence_collection_requires_separate_evidence_authority',
    ],
    `${label} F3 separate authority requirements`,
  );
  assertEqual(
    finalFreeze.authorization_rule,
    'freeze_and_reservation_marking_only_no_manifest_creation_provision_execution_or_evidence_authority',
    `${label} F3 authorization rule`,
  );

  assertExactArray(
    contract.forbidden_decision_substitutions,
    [
      'current_preparation_authority_for_cohort_designation',
      'current_preparation_authority_for_final_manifest_freeze',
      'schema_definition_approval_for_cohort_designation',
      'schema_definition_approval_for_final_manifest_freeze',
      'cohort_designation_for_final_manifest_freeze',
    ],
    `${label}.forbidden_decision_substitutions`,
  );
  assertEqual(
    contract.final_freeze_decision_ref_forbidden_in_subject_requirement_values,
    true,
    `${label} final freeze self-reference invariant`,
  );
  const authorityPolicy = contract.authority_key_policy;
  assertExactKeys(
    authorityPolicy,
    [
      'canonical_decision_authority_keys',
      'legacy_current_authority_object_keys',
      'legacy_missing_keys_default_false',
      'successor_contract_global_and_stage_authority_must_resolve_all_canonical_keys_false',
    ],
    `${label}.authority_key_policy`,
  );
  assertExactArray(
    authorityPolicy.canonical_decision_authority_keys,
    DECISION_AUTHORITY_MASK_KEYS,
    `${label} canonical decision authority keys`,
  );
  assertExactArray(
    authorityPolicy.legacy_current_authority_object_keys,
    LEGACY_CURRENT_AUTHORITY_KEYS,
    `${label} legacy current authority keys`,
  );
  assertExactArray(
    authorityPolicy.legacy_missing_keys_default_false,
    LEGACY_MISSING_AUTHORITY_KEYS,
    `${label} legacy missing authority keys`,
  );
  assertEqual(
    authorityPolicy.successor_contract_global_and_stage_authority_must_resolve_all_canonical_keys_false,
    true,
    `${label} canonical successor authority resolution rule`,
  );
  const legacyAuthorityObjects = [contract.authority, ...contract.stages.map((stage) => stage.authority)];
  legacyAuthorityObjects.forEach((authority, index) => {
    assertExactArray(
      Object.keys(authority),
      LEGACY_CURRENT_AUTHORITY_KEYS,
      `${label} legacy authority object[${index}] keys`,
    );
    const resolved = Object.fromEntries(
      DECISION_AUTHORITY_MASK_KEYS.map((key) => [key, authority[key] ?? false]),
    );
    assertExactBooleanMask(resolved, D1_AUTHORITY_MASK, `${label} resolved canonical authority[${index}]`);
  });
  const digest = sha256(
    Buffer.from(`${SUCCESSOR_TRANSITION_DIGEST_DOMAIN}\0${JSON.stringify(contract)}`, 'utf8'),
  );
  assertEqual(
    digest,
    EXPECTED_SUCCESSOR_TRANSITION_CONTRACT_DIGEST,
    `${label} reviewed semantic digest`,
  );
  return {
    stageCount: contract.stages.length,
    deferredRequirementCount: deferredIds.length,
    digest,
    bootstrapStatus: bootstrap.current_status,
    decisionInstanceCount: decisionInstances.current_instance_count,
    approvalReceiptCount: receipt.current_receipt_count,
    preparationApprovalReceiptStatus: currentPreparation.status,
    trustedStagedSamePullRequestPathStatus: separation.trusted_staged_same_pr_path_status,
    allowedNextAction: bootstrap.current_allowed_next_action,
  };
}

function validateRegistrySet(
  registrySet,
  children,
  catalog,
  artifactBytes,
  artifactValues,
  root,
  currentRequirementResult,
  requireTracked,
) {
  const label = REGISTRY_SET_PATH;
  assertExactKeys(
    registrySet,
    [
      'schema_version',
      'registry_id',
      'classification',
      'subject_class',
      'candidate_status',
      'coverage_effect',
      'semantic_scope',
      'preparation_authority_ref',
      'child_registries',
      'manifest_schema_catalog',
      'global_blockers',
      'successor_transition_contract',
      'blocker_accounting',
      'current_requirement_registry',
      'v1_unresolved_instance_migration',
      'authority',
    ],
    label,
  );
  validateCommonHeader(registrySet, label);
  if (!/^mobile-ux-batch1-registry-set\.v2(?:\.proposal)?$/.test(registrySet.schema_version)) {
    throw new Error(`${label}.schema_version is invalid`);
  }
  assertNonEmptyString(registrySet.registry_id, `${label}.registry_id`);
  assertExactKeys(
    registrySet.semantic_scope,
    [
      'scope_id',
      'source_path',
      'semantic_state_count',
      'forced_combination_count',
      'obligation_count_per_child',
      'total_child_obligation_records',
      'contract_id_title_owner_digest',
    ],
    `${label}.semantic_scope`,
  );
  const expectedScope = {
    scope_id: 'all_173_ledger_obligations',
    source_path: LEDGER_RELATIVE_PATH,
    semantic_state_count: 160,
    forced_combination_count: 13,
    obligation_count_per_child: 173,
    total_child_obligation_records: 519,
    contract_id_title_owner_digest: CONTRACT_IDENTITY_SHA256,
  };
  for (const [key, value] of Object.entries(expectedScope)) {
    assertEqual(registrySet.semantic_scope[key], value, `${label}.semantic_scope.${key}`);
  }
  assertExactKeys(
    registrySet.preparation_authority_ref,
    [
      'scope',
      'approved_head',
      'workflow_run_id',
      'deployment_id',
      'environment_id',
      'decision_status',
      'pull_request',
      'decision_owner',
      'success_at',
      'registry_subject_digest',
      'registry_set_sha256',
      'child_sha256',
      'does_not_authorize',
    ],
    `${label}.preparation_authority_ref`,
  );
  const expectedPreparation = {
    scope: 'successor_schema_definition_only',
    approved_head: '8f4f82b35b660d9a775d6551e530fe6703c3ac54',
    pull_request: 484,
    workflow_run_id: 31326457854,
    deployment_id: 5821110397,
    environment_id: 18348068326,
    decision_owner: 'github:LENKIN233#113219944',
    success_at: '2026-08-09T17:30:24Z',
    decision_status: 'accepted_preparation_only',
    registry_subject_digest: 'e53e55fe097c823d192c23219895abdc1092a60304d10150e7fdeadeff3a94ea',
    registry_set_sha256: 'f51f8fc849edacc9e22517266468caff1333d6d12c1a3265cf9a85eec381c982',
  };
  for (const [key, value] of Object.entries(expectedPreparation)) {
    assertEqual(registrySet.preparation_authority_ref[key], value, `${label}.preparation_authority_ref.${key}`);
  }
  assertExactKeys(
    registrySet.preparation_authority_ref.child_sha256,
    ['CP-BA', 'CP-CS', 'CP-WEB'],
    `${label}.preparation_authority_ref.child_sha256`,
  );
  const expectedV1ChildHashes = {
    'CP-BA': 'ac4c4f33b63938ac8d92bf75e8b99866c9f12d662ffc3509cd3826765bf8cb84',
    'CP-CS': 'dcbc64c5ddeb23408c546819dd65c50d629931633fb859787c3605b2aa77add2',
    'CP-WEB': 'cba6f75f9c7574a58c9ee2f744991ec2154385c6ca328b46be6522e652e09696',
  };
  for (const [checkpointId, digest] of Object.entries(expectedV1ChildHashes)) {
    assertEqual(
      registrySet.preparation_authority_ref.child_sha256[checkpointId],
      digest,
      `${label}.preparation_authority_ref.child_sha256.${checkpointId}`,
    );
  }
  assertExactArray(
    registrySet.preparation_authority_ref.does_not_authorize,
    ['cohort_designation', 'manifest_creation', 'reservation_activation', 'freeze', 'final_manifest_freeze', 'provision', 'execution', 'evidence', 'data_manifest_population', 'aggregation', 'promotion', 'architecture_acceptance', 'checkpoint_coverage_or_pass', 'visual', 'implementation', 'native', 'release', 'leadership_readiness'],
    `${label}.preparation_authority_ref.does_not_authorize`,
  );
  if (!Array.isArray(registrySet.child_registries) || registrySet.child_registries.length !== 3) {
    throw new Error(`${label}.child_registries must contain exactly three bindings`);
  }
  registrySet.child_registries.forEach((binding, index) => {
    const bindingLabel = `${label}.child_registries[${index}]`;
    assertExactKeys(
      binding,
      ['checkpoint_id', 'path', 'sha256', 'schema_version', 'expected_obligation_count', 'candidate_status'],
      bindingLabel,
    );
    const expected = CHILDREN[index];
    const child = children[index].value;
    assertEqual(binding.checkpoint_id, expected.checkpointId, `${bindingLabel}.checkpoint_id`);
    assertEqual(binding.path, expected.path, `${bindingLabel}.path`);
    assertEqual(binding.sha256, sha256(artifactBytes.get(expected.path)), `${bindingLabel}.sha256`);
    assertEqual(binding.schema_version, child.schema_version, `${bindingLabel}.schema_version`);
    assertEqual(binding.expected_obligation_count, 173, `${bindingLabel}.expected_obligation_count`);
    assertEqual(binding.candidate_status, COMMON_CANDIDATE_STATUS, `${bindingLabel}.candidate_status`);
  });
  assertExactKeys(
    registrySet.manifest_schema_catalog,
    ['path', 'sha256', 'schema_version', 'expected_reservation_count', 'instance_count', 'candidate_status'],
    `${label}.manifest_schema_catalog`,
  );
  assertEqual(registrySet.manifest_schema_catalog.path, MANIFEST_CATALOG_PATH, `${label}.manifest_schema_catalog.path`);
  assertEqual(
    registrySet.manifest_schema_catalog.sha256,
    sha256(artifactBytes.get(MANIFEST_CATALOG_PATH)),
    `${label}.manifest_schema_catalog.sha256`,
  );
  assertEqual(registrySet.manifest_schema_catalog.schema_version, catalog.schema_version, `${label}.manifest_schema_catalog.schema_version`);
  assertEqual(registrySet.manifest_schema_catalog.expected_reservation_count, 35, `${label}.manifest_schema_catalog.expected_reservation_count`);
  assertEqual(registrySet.manifest_schema_catalog.instance_count, 0, `${label}.manifest_schema_catalog.instance_count`);
  assertEqual(registrySet.manifest_schema_catalog.candidate_status, COMMON_CANDIDATE_STATUS, `${label}.manifest_schema_catalog.candidate_status`);
  assertExactArray(registrySet.global_blockers, GLOBAL_BLOCKERS, `${label}.global_blockers`);
  const successorTransitionResult = validateSuccessorTransitionContract(registrySet, root, {requireTracked});
  const migrationResult = validateUnresolvedMigration(
    root,
    registrySet.v1_unresolved_instance_migration,
    artifactValues,
    {requireTracked},
  );
  assertExactKeys(
    registrySet.blocker_accounting,
    ['historical_v1_migration', 'current_v2_typed_requirements'],
    `${label}.blocker_accounting`,
  );
  assertExactKeys(
    registrySet.blocker_accounting.historical_v1_migration,
    [
      'physical_instance_count',
      'resolved_instance_count',
      'remaining_historical_instance_count',
      'not_current_registry_count',
    ],
    `${label}.blocker_accounting.historical_v1_migration`,
  );
  const historical = registrySet.blocker_accounting.historical_v1_migration;
  assertEqual(historical.physical_instance_count, 115, `${label} historical physical count`);
  assertEqual(historical.resolved_instance_count, 1, `${label} historical resolved count`);
  assertEqual(historical.remaining_historical_instance_count, 114, `${label} historical remaining count`);
  assertEqual(historical.not_current_registry_count, true, `${label} historical/current separation`);
  assertExactKeys(
    registrySet.blocker_accounting.current_v2_typed_requirements,
    ['pending_requirement_count', 'source_ref', 'separate_from_historical_migration'],
    `${label}.blocker_accounting.current_v2_typed_requirements`,
  );
  const current = registrySet.blocker_accounting.current_v2_typed_requirements;
  assertEqual(current.pending_requirement_count, currentRequirementResult.pendingRequirementCount, `${label} current pending count`);
  assertEqual(current.source_ref, '#/current_requirement_registry', `${label} current source_ref`);
  assertEqual(current.separate_from_historical_migration, true, `${label} current/historical separation`);
  return {...migrationResult, successorTransitionResult};
}

function readCandidateArtifacts(root, {requireTracked, enforceReviewedDigests}) {
  if (requireTracked) assertExpectedRepositoryHead(root);
  const bytes = new Map();
  const values = new Map();
  const metadata = [];
  for (const relativePath of FREEZE_CANDIDATE_PATHS) {
    const raw = readRegularFile(root, relativePath, relativePath);
    bytes.set(relativePath, raw);
    values.set(relativePath, parseStrictJson(raw, relativePath));
    const tracked = requireTracked
      ? assertTrackedRegularHeadArtifact(root, relativePath, raw, relativePath)
      : {mode: 'fixture', sha256: sha256(raw)};
    if (enforceReviewedDigests) {
      assertEqual(tracked.sha256, EXPECTED_ARTIFACT_SHA256[relativePath], `${relativePath} reviewed raw SHA-256`);
    }
    metadata.push({path: relativePath, mode: tracked.mode, sha256: tracked.sha256});
  }
  return {bytes, values, metadata};
}

export function validateBatch1FreezeCandidate({
  root = ROOT,
  requireTracked = true,
  enforceReviewedDigests = true,
} = {}) {
  const artifacts = readCandidateArtifacts(path.resolve(root), {
    requireTracked,
    enforceReviewedDigests,
  });
  for (const relativePath of FREEZE_CANDIDATE_PATHS) {
    const value = artifacts.values.get(relativePath);
    scanNoWildcard(value, relativePath);
    scanAuthorityClaims(value, relativePath);
    scanSensitiveMaterial(value, relativePath);
  }
  const truth = loadObligationTruth(root, {requireTracked});
  const bindingIds = new Set();
  const requirementUsage = new Set();
  const childResults = CHILDREN.map((expected) => {
    const value = artifacts.values.get(expected.path);
    return {
      value,
      result: validateChild(value, expected, truth, bindingIds, {
        root,
        artifactValues: artifacts.values,
        requirementUsage,
        requireTracked,
      }),
    };
  });
  const catalog = artifacts.values.get(MANIFEST_CATALOG_PATH);
  const catalogResult = validateManifestSchemaCatalog(root, catalog, {requireTracked});
  const registrySet = artifacts.values.get(REGISTRY_SET_PATH);
  const currentRequirementResult = validateCurrentRequirementRegistry({
    root,
    registrySet,
    artifactBytes: artifacts.bytes,
    artifactValues: artifacts.values,
    children: childResults,
    requirementUsage,
    requireTracked,
  });
  const migrationResult = validateRegistrySet(
    registrySet,
    childResults,
    catalog,
    artifacts.bytes,
    artifacts.values,
    root,
    currentRequirementResult,
    requireTracked,
  );
  const subjectDigest = domainSeparatedSubjectDigest(artifacts.bytes);
  if (enforceReviewedDigests) {
    assertEqual(subjectDigest, EXPECTED_SUBJECT_DIGEST, 'five-artifact domain-separated subject digest');
  }
  return {
    schema_version: 'mobile-ux-batch1-freeze-candidate-validation.v1',
    artifact_valid: true,
    subject_class: 'schema_definition_only',
    candidate_status: 'candidate_incomplete',
    subject_digest_domain: 'softbook-cet/mobile-ux-batch1-freeze-candidate-subject/v1',
    subject_digest: subjectDigest,
    artifacts: artifacts.metadata,
    checkpoint_results: childResults.map(({result}) => result),
    partition_semantic_digests: Object.fromEntries(
      childResults.map(({result}) => [result.checkpointId, result.partitionDigest]),
    ),
    semantic_obligation_count_per_checkpoint: 173,
    checkpoint_obligation_counts: {'CP-BA': 173, 'CP-CS': 173, 'CP-WEB': 173},
    total_child_obligation_record_count: 519,
    planned_manifest_count: catalogResult.reservationCount,
    manifest_type_definition_count: catalogResult.definitionCount,
    manifest_type_definitions_digest: catalogResult.manifestTypeDefinitionsDigest,
    manifest_reservations_digest: catalogResult.reservationDigest,
    cp_cs_domain_source_anchor_count: catalogResult.csDomainSourceAnchorCount,
    cp_cs_domain_contracts_digest: catalogResult.csDomainContractDigest,
    binding_id_count: bindingIds.size,
    migrated_instance_count: migrationResult.migratedInstanceCount,
    unique_requirement_count: migrationResult.uniqueRequirementCount,
    pending_instance_count: migrationResult.pendingInstanceCount,
    historical_v1_migrated_instance_count: migrationResult.migratedInstanceCount,
    historical_v1_resolved_instance_count: 1,
    historical_v1_pending_instance_count: migrationResult.pendingInstanceCount,
    current_v2_requirement_count: currentRequirementResult.requirementCount,
    current_v2_pending_requirement_count: currentRequirementResult.pendingRequirementCount,
    current_v2_requirement_inventory_digest: currentRequirementResult.inventoryDigest,
    successor_transition_stage_count: migrationResult.successorTransitionResult.stageCount,
    successor_transition_post_designation_requirement_count:
      migrationResult.successorTransitionResult.deferredRequirementCount,
    successor_transition_contract_digest: migrationResult.successorTransitionResult.digest,
    decision_authority_bootstrap_status: migrationResult.successorTransitionResult.bootstrapStatus,
    decision_instance_count: migrationResult.successorTransitionResult.decisionInstanceCount,
    approval_receipt_count: migrationResult.successorTransitionResult.approvalReceiptCount,
    preparation_approval_receipt_status:
      migrationResult.successorTransitionResult.preparationApprovalReceiptStatus,
    trusted_staged_same_pr_path_status:
      migrationResult.successorTransitionResult.trustedStagedSamePullRequestPathStatus,
    pc_web_row_binding_digest_domain: PW_ROW_DIGEST_DOMAIN,
    pc_web_row_binding_digests: childResults.find(({result}) => result.checkpointId === 'CP-WEB').result.pwRowBindingDigests,
    unresolved_migration_digest: migrationResult.migrationDigest,
    reference_contracts_digest: migrationResult.referenceContractsDigest,
    freeze_readiness: 'blocked_candidate_incomplete',
    manifest_freeze_eligible: false,
    decision_status: 'not_evaluated',
    gate_effect: 'none',
    gate_eligible: false,
    evidence_eligible: false,
    freeze_authorized: false,
    reservation_activation_authorized: false,
    manifest_creation_authorized: false,
    provisioning_authorized: false,
    execution_authorized: false,
    collection_authorized: false,
    data_manifest_population_authorized: false,
    aggregation_authorized: false,
    promotion_authorized: false,
    architecture_acceptance_authorized: false,
    checkpoint_coverage_authorized: false,
    visual_exploration_authorized: false,
    implementation_authorized: false,
    native_acceptance_authorized: false,
    release_authorized: false,
    leadership_readiness_authorized: false,
    allowed_next_action: migrationResult.successorTransitionResult.allowedNextAction,
  };
}

function parseArgs(argv) {
  const options = {root: ROOT, requireTracked: true, json: false};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const take = () => {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
      return value;
    };
    if (argument === '--root') options.root = path.resolve(take());
    else if (argument === '--require-tracked') options.requireTracked = true;
    else if (argument === '--json') options.json = true;
    else if (argument === '--approved' || argument === '--force') {
      throw new Error(`${argument} is forbidden: schema proposals cannot self-authorize freeze or execution`);
    } else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

function main() {
  try {
    const result = validateBatch1FreezeCandidate(parseArgs(process.argv.slice(2)));
    if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(
        `MOBILE UX BATCH1 FREEZE CANDIDATE SCHEMA OK: status=${result.candidate_status} subject=${result.subject_digest}`,
      );
      console.log(CLI_AUTHORITY_NON_CLAIM);
    }
  } catch (error) {
    console.error(
      `MOBILE UX BATCH1 FREEZE CANDIDATE FAILED: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
