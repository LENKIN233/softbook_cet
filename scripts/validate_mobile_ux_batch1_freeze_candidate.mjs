#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {parseStrictJson} from './lib/strict_json.mjs';
import {
  FREEZE_CANDIDATE_PATHS,
  MANIFEST_CATALOG_PATH,
  assertAuthorityObjectFalse,
  assertEqual,
  assertExpectedRepositoryHead,
  assertExactArray,
  assertExactKeys,
  assertNonEmptyString,
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
  'future_manifest_freeze_decision_missing',
  'exact_compatibility_keys_missing',
  'execution_manifest_subtree_must_remain_absent',
]);

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
    'f26d54a04a7931a348f041726b6246e5a17898725f2306a245e3214b7dfe6ed3',
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
  'f08c84f879700f143f550557f0eb445f1b7a6eb06cc4708e5edeffd53b15b9f1';
const EXPECTED_REFERENCE_CONTRACTS_DIGEST =
  '32e8bbf1a371b02d4c138480b63bf3a40398651092922f357b07d6d093bbcc4e';

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
    requiredForbidden: ['repo_self_approval', 'synthetic_compatibility_key', 'credential', 'token'],
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
        ['freeze', 'provision', 'execution', 'evidence', 'aggregation', 'promotion', 'visual', 'implementation', 'native', 'release'],
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
  'fdf9cd8b0477fd4ef7fa24c109ff85f1adcd9e5d0164647a8687503ec3237fce';
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
    ['freeze', 'provision', 'execution', 'evidence', 'aggregation', 'promotion', 'visual', 'implementation', 'native', 'release'],
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
  return migrationResult;
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
    provisioning_authorized: false,
    execution_authorized: false,
    collection_authorized: false,
    aggregation_authorized: false,
    promotion_authorized: false,
    visual_exploration_authorized: false,
    implementation_authorized: false,
    native_acceptance_authorized: false,
    release_authorized: false,
    allowed_next_action: 'resolve_blockers_then_exact_review_before_future_protected_manifest_freeze_decision',
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
      console.log(
        'NON-CLAIM: schema_definition_only does not authorize freeze, provisioning, execution, evidence, aggregation, promotion, visual work, implementation, native acceptance, or release',
      );
    }
  } catch (error) {
    console.error(
      `MOBILE UX BATCH1 FREEZE CANDIDATE FAILED: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
