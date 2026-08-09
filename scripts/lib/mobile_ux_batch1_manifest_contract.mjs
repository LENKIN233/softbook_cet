import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {parseStrictJson} from './strict_json.mjs';

export const BATCH1_DIRECTORY =
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1';
export const EXECUTION_MANIFEST_ROOT = `${BATCH1_DIRECTORY}/execution-manifests`;
export const FREEZE_CANDIDATE_PATHS = Object.freeze([
  `${BATCH1_DIRECTORY}/registry-set.v2.proposal.json`,
  `${BATCH1_DIRECTORY}/cp-ba.registry.v2.proposal.json`,
  `${BATCH1_DIRECTORY}/cp-cs.registry.v2.proposal.json`,
  `${BATCH1_DIRECTORY}/cp-web.registry.v2.proposal.json`,
  `${BATCH1_DIRECTORY}/manifest-schema-catalog.v1.json`,
]);
export const MANIFEST_CATALOG_PATH = FREEZE_CANDIDATE_PATHS[4];
export const SUBJECT_DIGEST_DOMAIN =
  'softbook-cet/mobile-ux-batch1-freeze-candidate-subject/v1';
export const BATCH1_APPROVED_PREPARATION_HEAD =
  '8f4f82b35b660d9a775d6551e530fe6703c3ac54';

const EXPECTED_GITHUB_ORIGINS = new Set([
  'git@github.com:LENKIN233/softbook_cet.git',
  'https://github.com/LENKIN233/softbook_cet',
  'https://github.com/LENKIN233/softbook_cet.git',
]);

const V1_CHILD_PATHS = Object.freeze([
  `${BATCH1_DIRECTORY}/cp-ba.registry.v1.json`,
  `${BATCH1_DIRECTORY}/cp-cs.registry.v1.json`,
  `${BATCH1_DIRECTORY}/cp-web.registry.v1.json`,
]);

const NEW_CP_CS_RESERVATIONS = Object.freeze([
  Object.freeze({
    manifest_id: 'manifest-cs-statistics-canonical-read-v1',
    manifest_role: 'scenario_cohort',
    scenario_id: 'cs-statistics-canonical-read',
    planned_path: `${EXECUTION_MANIFEST_ROOT}/cp-cs/statistics-canonical-read.scenario.v1.json`,
    semantic_validator_id: 'future-cp-cs-scenario-v1',
    checkpoint_id: 'CP-CS',
    schema_status: 'reserved_schema_definition_only',
    instance_status: 'absent_required',
  }),
  Object.freeze({
    manifest_id: 'manifest-cs-account-lifecycle-v1',
    manifest_role: 'scenario_cohort',
    scenario_id: 'cs-account-lifecycle',
    planned_path: `${EXECUTION_MANIFEST_ROOT}/cp-cs/account-lifecycle.scenario.v1.json`,
    semantic_validator_id: 'future-cp-cs-scenario-v1',
    checkpoint_id: 'CP-CS',
    schema_status: 'reserved_schema_definition_only',
    instance_status: 'absent_required',
  }),
]);

const CHECKPOINT_BY_V1_PATH = Object.freeze({
  [V1_CHILD_PATHS[0]]: 'CP-BA',
  [V1_CHILD_PATHS[1]]: 'CP-CS',
  [V1_CHILD_PATHS[2]]: 'CP-WEB',
});

const MANIFEST_RESERVATION_KEYS = Object.freeze([
  'manifest_id',
  'checkpoint_id',
  'manifest_role',
  'planned_path',
  'semantic_validator_id',
  'schema_status',
  'instance_status',
  'exact_binding',
  'exact_binding_status',
  'reservation_ref',
]);

const SCENARIO_REQUIRED_COMMON_MANIFEST_FIELDS = Object.freeze([
  'schema_version',
  'manifest_id',
  'reservation_ref',
  'subject_commit',
  'source_hashes',
  'checkpoint_id',
  'scenario_id',
  'lane_id',
  'target_ids',
  'product_profile_subject',
  'membership_stage',
  'intended_origin',
  'provider_lane',
  'matrix_row_id',
  'exact_scope_requirement_ref',
  'service_subject_discriminator',
  'content_subject_discriminator',
  'system_subject_discriminator',
  'exact_obligation_binding_ids',
  'environment_refs',
  'privacy_safe_account_slots',
  'build_refs',
  'content_refs',
  'role_confirmation_refs',
  'execution_window_with_utc_clock_and_expiry',
  'compatibility_subject',
  'registry_subject_digest',
  'protected_freeze_decision_ref',
  'expected_and_observed_results',
  'raw_artifact_records',
  'exception_records',
  'cached_result_ignored_and_recomputed',
]);

const AGGREGATION_REQUIRED_COMMON_MANIFEST_FIELDS = Object.freeze([
  'schema_version',
  'manifest_id',
  'reservation_ref',
  'subject_commit',
  'source_hashes',
  'checkpoint_id',
  'aggregate_id',
  'target_ids',
  'product_profile_subjects',
  'membership_stage_partition',
  'intended_origin_partition',
  'provider_lanes',
  'matrix_row_ids',
  'exact_scope_requirement_refs',
  'service_subject_discriminators',
  'content_subject_discriminators',
  'system_subject_discriminators',
  'registry_subject_digest',
  'protected_freeze_decision_ref',
  'aggregation_execution_window_with_utc_clock_and_expiry',
  'independent_aggregation_verifier_ref',
  'child_manifest_records',
  'single_frozen_compatibility_map',
  'exception_records',
  'cached_result_ignored_and_recomputed',
]);

const SUBJECT_DISCRIMINATOR_FIELDS = Object.freeze([
  'target_ids',
  'product_profile_subject',
  'membership_stage',
  'intended_origin',
  'provider_lane',
  'matrix_row_id',
  'exact_scope_requirement_ref',
  'service_subject_discriminator',
  'content_subject_discriminator',
  'system_subject_discriminator',
]);

const AGGREGATION_SUBJECT_DISCRIMINATOR_FIELDS = Object.freeze([
  'target_ids',
  'product_profile_subjects',
  'membership_stage_partition',
  'intended_origin_partition',
  'provider_lanes',
  'matrix_row_ids',
  'exact_scope_requirement_refs',
  'service_subject_discriminators',
  'content_subject_discriminators',
  'system_subject_discriminators',
]);

const EXACT_BINDING_KEYS = Object.freeze([
  'checkpoint_id',
  'scenario_id',
  'aggregate_id',
  'lane_ids',
  'target_ids',
  'product_profile_subjects',
  'provider_lanes',
  'matrix_row_ids',
  'service_subject_discriminators',
  'content_subject_requirement_ids',
  'system_subject_requirement_ids',
  'membership_stage_requirement_ids',
  'intended_origin_requirement_ids',
  'exact_scope_requirement_ids',
  'matrix_row_binding',
]);

const EXACT_BINDING_ARRAY_KEYS = Object.freeze(
  EXACT_BINDING_KEYS.filter(
    (key) => !['checkpoint_id', 'scenario_id', 'aggregate_id', 'matrix_row_binding'].includes(key),
  ),
);

const FORBIDDEN_MANIFEST_FIELDS = Object.freeze([
  'credential_or_token',
  'private_key',
  'temporary_private_download_url',
  'raw_phone_or_email',
  'device_serial_udid_android_id_mac_or_hostname',
  'hash_derived_directly_from_device_identifier',
]);

const AGGREGATION_FORBIDDEN_MANIFEST_FIELDS = Object.freeze([
  ...FORBIDDEN_MANIFEST_FIELDS,
  'raw_artifact_records',
  'raw_evidence',
  'measurements',
  'copied_observed_results',
  'multiple_compatibility_maps',
  'implicit_compatibility_map',
]);

const TYPE_DEFINITIONS = Object.freeze([
  Object.freeze({
    schemaId: 'future-cp-ba-platform-browser-scenario-v1',
    checkpointId: 'CP-BA',
    manifestRole: 'scenario_cohort',
    evidenceClass: 'platform_browser_presentation_only',
    typeFields: ['stress_matrix_ids', 'overflow_and_clipping_result', 'focus_replay_result', 'learner_leak_scan_result', 'platform_browser_slot_ref'],
  }),
  Object.freeze({
    schemaId: 'future-cp-ba-shared-access-scenario-v1',
    checkpointId: 'CP-BA',
    manifestRole: 'scenario_cohort',
    evidenceClass: 'shared_access_profile_browser_presentation_only',
    typeFields: ['access_subject_ref', 'shared_profile_replay_result', 'platform_credit_false', 'responsive_containment_result', 'learner_leak_scan_result'],
  }),
  Object.freeze({
    schemaId: 'future-cp-ba-aggregation-v1',
    checkpointId: 'CP-BA',
    manifestRole: 'checkpoint_aggregation',
    evidenceClass: 'browser_architecture_checkpoint_aggregation',
    typeFields: ['required_platform_and_shared_matrix', 'child_compatibility_keys', 'recomputed_browser_architecture_result', 'independent_aggregation_verifier_confirmation'],
  }),
  Object.freeze({
    schemaId: 'future-cp-cs-scenario-v1',
    checkpointId: 'CP-CS',
    manifestRole: 'scenario_cohort',
    evidenceClass: 'canonical_service_scenario',
    typeFields: ['scenario_domain', 'canonical_command_or_read', 'canonical_baseline_identity', 'canonical_acknowledgement', 'canonical_refresh_or_reconciliation', 'provider_result_when_applicable', 'operator_and_verifier_confirmations'],
    domainFields: ['scenario_domain', 'canonical_command_or_read', 'canonical_baseline_identity', 'canonical_acknowledgement', 'canonical_refresh_or_reconciliation', 'provider_result_when_applicable'],
  }),
  Object.freeze({
    schemaId: 'future-cp-cs-aggregation-v1',
    checkpointId: 'CP-CS',
    manifestRole: 'checkpoint_aggregation',
    evidenceClass: 'canonical_service_checkpoint_aggregation',
    typeFields: ['required_canonical_service_scenario_matrix', 'child_compatibility_keys', 'recomputed_canonical_service_result', 'independent_aggregation_verifier_confirmation'],
  }),
  Object.freeze({
    schemaId: 'future-cp-web-browser-scenario-v1',
    checkpointId: 'CP-WEB',
    manifestRole: 'scenario_cohort',
    evidenceClass: 'pc_web_browser_behavior',
    typeFields: ['matrix_row_id', 'browser_system_slot_ref', 'viewport_result', 'input_result', 'focus_replay_result'],
  }),
  Object.freeze({
    schemaId: 'future-cp-web-accessibility-scenario-v1',
    checkpointId: 'CP-WEB',
    manifestRole: 'scenario_cohort',
    evidenceClass: 'pc_web_manual_accessibility',
    typeFields: ['assistive_technology_ref', 'accessible_name_result', 'focus_order_and_return_result', 'zoom_reflow_result', 'reduced_motion_result'],
  }),
  Object.freeze({
    schemaId: 'future-cp-web-service-scenario-v1',
    checkpointId: 'CP-WEB',
    manifestRole: 'scenario_cohort',
    evidenceClass: 'pc_web_canonical_service',
    typeFields: ['cp_cs_dependency_manifest_ref', 'canonical_baseline_identity', 'canonical_acknowledgement', 'canonical_refresh_or_reconciliation', 'pc_web_projection_result'],
  }),
  Object.freeze({
    schemaId: 'future-cp-web-commerce-scenario-v1',
    checkpointId: 'CP-WEB',
    manifestRole: 'scenario_cohort',
    evidenceClass: 'pc_web_formal_commerce',
    typeFields: ['payment_provider_ref', 'provider_or_store_result', 'canonical_entitlement_refresh', 'origin_return_result'],
  }),
  Object.freeze({
    schemaId: 'future-cp-web-managed-access-scenario-v1',
    checkpointId: 'CP-WEB',
    manifestRole: 'scenario_cohort',
    evidenceClass: 'pc_web_receiver_managed_access',
    typeFields: ['base_membership_ref', 'managed_grant_or_revoke_result', 'receiver_managed_environment_ref', 'read_only_access_projection_result'],
  }),
  Object.freeze({
    schemaId: 'future-cp-web-audio-scenario-v1',
    checkpointId: 'CP-WEB',
    manifestRole: 'scenario_cohort',
    evidenceClass: 'pc_web_private_content_audio',
    typeFields: ['signed_private_manifest_ref', 'approved_content_release_ref', 'private_download_result', 'attached_playback_result'],
  }),
  Object.freeze({
    schemaId: 'future-cp-web-aggregation-v1',
    checkpointId: 'CP-WEB',
    manifestRole: 'checkpoint_aggregation',
    evidenceClass: 'pc_web_checkpoint_aggregation',
    typeFields: ['required_12_matrix_rows', 'cp_ba_dependency_ref', 'cp_cs_dependency_ref', 'child_compatibility_keys', 'recomputed_pc_web_result', 'independent_aggregation_verifier_confirmation'],
  }),
]);

const CS_DOMAIN_CONTRACT_EXPECTATIONS = Object.freeze({
  'cs-auth-sms-session': Object.freeze({domain: 'authentication', targets: ['cs-receiver-service-harness'], profiles: ['pre_authentication'], providers: ['sms_provider']}),
  'cs-bootstrap-entitlement-origin': Object.freeze({domain: 'bootstrap_entitlement_origin', targets: ['cs-receiver-service-harness'], profiles: ['formal_account_access'], providers: ['receiver_runtime']}),
  'cs-learning-session-selection': Object.freeze({domain: 'learning_session_selection', targets: ['cs-receiver-service-harness'], profiles: ['formal_account_access'], providers: ['receiver_runtime']}),
  'cs-learning-completion-events': Object.freeze({domain: 'learning_completion_events', targets: ['cs-receiver-service-harness'], profiles: ['formal_account_access'], providers: ['receiver_runtime']}),
  'cs-daily-checkin': Object.freeze({domain: 'daily_checkin', targets: ['cs-receiver-service-harness'], profiles: ['formal_account_access'], providers: ['receiver_runtime']}),
  'cs-space-actions': Object.freeze({domain: 'space_actions', targets: ['cs-receiver-service-harness'], profiles: ['formal_account_access'], providers: ['receiver_runtime']}),
  'cs-formal-commerce-ios': Object.freeze({domain: 'formal_commerce', targets: ['cs-ios-phone-client'], profiles: ['formal_commerce_ios'], providers: ['ios_store']}),
  'cs-formal-commerce-android': Object.freeze({domain: 'formal_commerce', targets: ['cs-android-phone-client'], profiles: ['formal_commerce_android'], providers: ['android_store']}),
  'cs-formal-commerce-web': Object.freeze({domain: 'formal_commerce', targets: ['web-desktop-primary'], profiles: ['formal_commerce_web'], providers: ['web_payment_provider']}),
  'cs-receiver-managed-access': Object.freeze({domain: 'receiver_managed_access', targets: ['cs-receiver-service-harness'], profiles: ['receiver_managed'], providers: ['receiver_operator']}),
  'cs-private-content-audio': Object.freeze({domain: 'private_content_audio', targets: ['cs-receiver-service-harness'], profiles: ['entitled_private_content'], providers: ['receiver_private_content']}),
  'cs-cross-device-reconciliation': Object.freeze({domain: 'cross_device_reconciliation', targets: ['cs-ios-phone-client', 'cs-android-phone-client', 'web-desktop-primary'], profiles: ['formal_account_access'], providers: ['receiver_runtime']}),
  'cs-statistics-canonical-read': Object.freeze({domain: 'statistics_canonical_read', targets: ['cs-receiver-service-harness'], profiles: ['formal_account_access'], providers: ['receiver_runtime']}),
  'cs-account-lifecycle': Object.freeze({domain: 'account_lifecycle', targets: ['cs-receiver-service-harness'], profiles: ['formal_account_access'], providers: ['receiver_runtime']}),
});

const EXPECTED_CS_DOMAIN_CONTRACTS_DIGEST =
  '837fd738a0745669c49bba520ba3670472af70c41c15a05ed52f17169704be13';
const EXPECTED_MANIFEST_RESERVATIONS_DIGEST =
  'fda8c728ee4010631cf19b1f355bed226521ea1fbc375349db34b6cc55f52e1f';
const EXPECTED_MANIFEST_TYPE_DEFINITIONS_DIGEST =
  'a8baeb8ffa627558ad1b144be186ab76edbc42149875fd45f640b042211baaa6';

export const AUTHORITY_KEYS = Object.freeze([
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

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function assertRecord(value, label) {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
}

export function assertExactKeys(value, expected, label) {
  assertRecord(value, label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(
      `${label} keys mismatch: expected ${wanted.join(', ')}, received ${actual.join(', ')}`,
    );
  }
}

export function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} must be ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

export function assertExactArray(actual, expected, label) {
  if (!Array.isArray(actual) || JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} does not match the required exact ordered values`);
  }
}

export function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
    throw new Error(`${label} must be a non-empty trimmed string`);
  }
}

function assertGitSuccess(result, label) {
  if (result.status !== 0) {
    const output = result.stderr || result.stdout || 'git command failed';
    throw new Error(`${label}: ${Buffer.isBuffer(output) ? output.toString('utf8').trim() : String(output).trim()}`);
  }
  return result;
}

export function assertGitRepositoryRoot(root) {
  const resolvedRoot = path.resolve(root);
  const result = assertGitSuccess(
    spawnSync('git', ['-C', resolvedRoot, 'rev-parse', '--show-toplevel'], {encoding: 'utf8'}),
    'repository root verification failed',
  );
  if (fs.realpathSync(path.resolve(result.stdout.trim())) !== fs.realpathSync(resolvedRoot)) {
    throw new Error(`validation root must be the Git worktree root: ${resolvedRoot}`);
  }
}

export function assertExpectedRepositoryHead(root) {
  const resolvedRoot = path.resolve(root);
  assertGitRepositoryRoot(resolvedRoot);
  const head = assertGitSuccess(
    spawnSync('git', ['-C', resolvedRoot, 'rev-parse', '--verify', 'HEAD^{commit}'], {
      encoding: 'utf8',
    }),
    'tracked mode requires a committed HEAD',
  ).stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(head)) throw new Error('tracked mode HEAD must be a full Git SHA-1');
  const origin = assertGitSuccess(
    spawnSync('git', ['-C', resolvedRoot, 'remote', 'get-url', 'origin'], {encoding: 'utf8'}),
    'tracked mode requires the expected GitHub origin',
  ).stdout.trim();
  if (!EXPECTED_GITHUB_ORIGINS.has(origin)) {
    throw new Error('tracked mode requires the LENKIN233/softbook_cet GitHub origin');
  }
  const ancestry = spawnSync(
    'git',
    ['-C', resolvedRoot, 'merge-base', '--is-ancestor', BATCH1_APPROVED_PREPARATION_HEAD, head],
    {encoding: 'utf8'},
  );
  if (ancestry.status !== 0) {
    throw new Error('Batch 1 approved preparation head must be reachable from tracked-mode HEAD');
  }
  return {head, origin};
}

export function assertSafeRelativePath(relativePath, label) {
  assertNonEmptyString(relativePath, label);
  if (relativePath.includes('\0') || path.isAbsolute(relativePath) || relativePath.includes('\\')) {
    throw new Error(`${label} must be a portable repository-relative POSIX path`);
  }
  const parts = relativePath.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) {
    throw new Error(`${label} contains an empty, dot, or traversal component`);
  }
  if (path.posix.normalize(relativePath) !== relativePath) {
    throw new Error(`${label} is not normalized`);
  }
  return relativePath;
}

export function resolveContainedNoSymlink(
  root,
  relativePath,
  label,
  {mustExist = true, requireRegular = false} = {},
) {
  assertSafeRelativePath(relativePath, label);
  const resolvedRoot = path.resolve(root);
  const rootStat = fs.lstatSync(resolvedRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error(`${label} validation root must be a real directory`);
  }
  const rootReal = fs.realpathSync(resolvedRoot);
  let cursor = resolvedRoot;
  const parts = relativePath.split('/');
  for (let index = 0; index < parts.length; index += 1) {
    cursor = path.join(cursor, parts[index]);
    let stat;
    try {
      stat = fs.lstatSync(cursor);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        if (mustExist) throw new Error(`${label} does not exist: ${relativePath}`);
        break;
      }
      if (error?.code === 'ENOTDIR') {
        throw new Error(`${label} has a non-directory ancestor: ${relativePath}`);
      }
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`${label} must not traverse a symlink: ${relativePath}`);
    if (index < parts.length - 1 && !stat.isDirectory()) {
      throw new Error(`${label} has a non-directory ancestor: ${relativePath}`);
    }
    if (index === parts.length - 1 && requireRegular && !stat.isFile()) {
      throw new Error(`${label} must be a regular file: ${relativePath}`);
    }
  }
  const absolute = path.resolve(resolvedRoot, relativePath);
  const lexicalPrefix = `${resolvedRoot}${path.sep}`;
  if (!absolute.startsWith(lexicalPrefix)) throw new Error(`${label} escapes the repository root`);
  if (fs.existsSync(absolute)) {
    const real = fs.realpathSync(absolute);
    if (real !== rootReal && !real.startsWith(`${rootReal}${path.sep}`)) {
      throw new Error(`${label} resolves outside the repository root`);
    }
  }
  return absolute;
}

export function readRegularFile(root, relativePath, label = relativePath) {
  const absolute = resolveContainedNoSymlink(root, relativePath, label, {
    mustExist: true,
    requireRegular: true,
  });
  return fs.readFileSync(absolute);
}

export function readSemanticSource(
  root,
  relativePath,
  label = relativePath,
  {requireTracked = false} = {},
) {
  const bytes = readRegularFile(root, relativePath, label);
  if (requireTracked) assertTrackedRegularHeadArtifact(root, relativePath, bytes, label);
  return bytes;
}

export function assertTrackedRegularHeadArtifact(root, relativePath, bytes, label = relativePath) {
  assertGitRepositoryRoot(root);
  assertSafeRelativePath(relativePath, label);
  assertGitSuccess(
    spawnSync('git', ['-C', path.resolve(root), 'ls-files', '--error-unmatch', '--', relativePath], {
      encoding: 'utf8',
    }),
    `${label} must be tracked`,
  );
  const tree = assertGitSuccess(
    spawnSync('git', ['-C', path.resolve(root), 'ls-tree', 'HEAD', '--', relativePath], {
      encoding: 'utf8',
    }),
    `${label} HEAD tree lookup failed`,
  ).stdout.trim();
  const match = tree.match(/^(\d{6}) blob ([0-9a-f]{40})\t(.+)$/);
  if (!match || match[1] !== '100644' || match[3] !== relativePath) {
    throw new Error(`${label} must be a tracked regular non-executable HEAD blob with mode 100644`);
  }
  const headBytes = assertGitSuccess(
    spawnSync('git', ['-C', path.resolve(root), 'show', `HEAD:${relativePath}`], {
      encoding: null,
      maxBuffer: 64 * 1024 * 1024,
    }),
    `${label} HEAD blob read failed`,
  ).stdout;
  if (!Buffer.isBuffer(headBytes) || !headBytes.equals(bytes)) {
    throw new Error(`${label} worktree bytes must exactly match the tracked HEAD blob`);
  }
  return {mode: match[1], sha256: sha256(bytes)};
}

export function assertExecutionManifestSubtreeAbsent(root, {requireTracked = false} = {}) {
  const absolute = resolveContainedNoSymlink(
    root,
    EXECUTION_MANIFEST_ROOT,
    'execution manifest root',
    {mustExist: false},
  );
  if (fs.existsSync(absolute)) {
    throw new Error('execution manifest root must be absent before a protected freeze decision');
  }
  if (requireTracked) {
    const result = assertGitSuccess(
      spawnSync('git', ['-C', path.resolve(root), 'ls-tree', '-r', '--name-only', 'HEAD', '--', EXECUTION_MANIFEST_ROOT], {
        encoding: 'utf8',
      }),
      'execution manifest HEAD absence check failed',
    );
    if (result.stdout.trim() !== '') {
      throw new Error('execution manifest subtree must have no tracked HEAD entries before freeze');
    }
  }
}

export function assertPathAbsent(root, relativePath, label, {requireTracked = false} = {}) {
  const absolute = resolveContainedNoSymlink(root, relativePath, label, {mustExist: false});
  if (fs.existsSync(absolute)) throw new Error(`${label} must be absent before freeze: ${relativePath}`);
  if (requireTracked) {
    const result = spawnSync('git', ['-C', path.resolve(root), 'cat-file', '-e', `HEAD:${relativePath}`], {
      encoding: 'utf8',
    });
    if (result.status === 0) throw new Error(`${label} must be absent from HEAD before freeze`);
    if (![1, 128].includes(result.status)) {
      throw new Error(`${label} HEAD absence check failed: ${(result.stderr || '').trim()}`);
    }
  }
}

export function domainSeparatedSubjectDigest(artifactBytes) {
  const chunks = [Buffer.from(`${SUBJECT_DIGEST_DOMAIN}\0`, 'utf8')];
  for (const relativePath of FREEZE_CANDIDATE_PATHS) {
    const bytes = artifactBytes.get(relativePath);
    if (!Buffer.isBuffer(bytes)) throw new Error(`subject digest is missing ${relativePath}`);
    chunks.push(Buffer.from(`${Buffer.byteLength(relativePath)}:${relativePath}\0${bytes.length}:`, 'utf8'));
    chunks.push(bytes, Buffer.from('\0', 'utf8'));
  }
  return sha256(Buffer.concat(chunks));
}

export function scanNoWildcard(value, label = 'artifact') {
  if (typeof value === 'string') {
    if (/[*?\[]/.test(value)) throw new Error(`${label} contains a forbidden wildcard expression`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanNoWildcard(entry, `${label}[${index}]`));
    return;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) scanNoWildcard(child, `${label}.${key}`);
  }
}

export function assertAuthorityObjectFalse(authority, label) {
  assertExactKeys(authority, AUTHORITY_KEYS, label);
  for (const [key, value] of Object.entries(authority)) {
    if (value !== false) throw new Error(`${label}.${key} must remain false`);
  }
}

export function scanAuthorityClaims(value, label = 'artifact') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanAuthorityClaims(entry, `${label}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childLabel = `${label}.${key}`;
    if (key === 'authority') assertAuthorityObjectFalse(child, childLabel);
    if (/(?:authorized|eligible)$/.test(key) && child !== false) {
      throw new Error(`${childLabel} must remain false`);
    }
    scanAuthorityClaims(child, childLabel);
  }
}

function reservationWithStatus(entry, checkpointId) {
  return {
    manifest_id: entry.manifest_id,
    manifest_role: entry.manifest_role,
    ...(entry.manifest_role === 'checkpoint_aggregation'
      ? {aggregate_id: entry.scenario_id}
      : {scenario_id: entry.scenario_id}),
    planned_path: entry.planned_path,
    semantic_validator_id: entry.semantic_validator_id,
    checkpoint_id: checkpointId,
    schema_status: 'reserved_schema_definition_only',
    instance_status: 'absent_required',
  };
}

export function expectedManifestReservations(root, {requireTracked = false} = {}) {
  const grouped = new Map();
  for (const v1Path of V1_CHILD_PATHS) {
    const value = parseStrictJson(
      readSemanticSource(root, v1Path, v1Path, {requireTracked}),
      v1Path,
    );
    if (!Array.isArray(value.planned_manifest_registry)) {
      throw new Error(`${v1Path}.planned_manifest_registry must be an array`);
    }
    grouped.set(
      CHECKPOINT_BY_V1_PATH[v1Path],
      value.planned_manifest_registry.map((entry) =>
        reservationWithStatus(entry, CHECKPOINT_BY_V1_PATH[v1Path]),
      ),
    );
  }
  const cpCs = grouped.get('CP-CS');
  const aggregateIndex = cpCs.findIndex((entry) => entry.manifest_role === 'checkpoint_aggregation');
  if (aggregateIndex !== cpCs.length - 1) {
    throw new Error('v1 CP-CS aggregate reservation must remain the final CP-CS reservation');
  }
  cpCs.splice(aggregateIndex, 0, ...NEW_CP_CS_RESERVATIONS.map((entry) => ({...entry})));
  return [...grouped.get('CP-BA'), ...cpCs, ...grouped.get('CP-WEB')];
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function reviewedSemanticDigest(domain, value) {
  return sha256(Buffer.from(`${domain}\0${canonicalJson(value)}`, 'utf8'));
}

function assertUniqueStringArray(value, label, {allowEmpty = true} = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array`);
  }
  const seen = new Set();
  value.forEach((entry, index) => {
    assertNonEmptyString(entry, `${label}[${index}]`);
    if (seen.has(entry)) throw new Error(`${label} must not contain duplicate values`);
    seen.add(entry);
  });
  return value;
}

function unescapeJsonPointerToken(token) {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

function resolveJsonPointer(value, pointer, label) {
  if (pointer === '') return value;
  if (!pointer.startsWith('/')) throw new Error(`${label} must be an RFC 6901 JSON pointer`);
  let cursor = value;
  for (const encodedToken of pointer.slice(1).split('/')) {
    const token = unescapeJsonPointerToken(encodedToken);
    if (
      cursor === null ||
      typeof cursor !== 'object' ||
      (Array.isArray(cursor) && !/^\d+$/.test(token)) ||
      !Object.hasOwn(cursor, token)
    ) {
      throw new Error(`${label} does not resolve at ${JSON.stringify(token)}`);
    }
    cursor = cursor[token];
  }
  return cursor;
}

function resolveSemanticOwnerOrRuntimeRef(root, anchor, label, {requireTracked}) {
  assertExactKeys(anchor, ['path', 'locator_kind', 'locator', 'raw_sha256'], label);
  assertNonEmptyString(anchor.path, `${label}.path`);
  assertNonEmptyString(anchor.locator, `${label}.locator`);
  if (!['json_pointer', 'heading'].includes(anchor.locator_kind)) {
    throw new Error(`${label}.locator_kind must be json_pointer or heading`);
  }
  if (!/^[0-9a-f]{64}$/.test(anchor.raw_sha256)) {
    throw new Error(`${label}.raw_sha256 must be a lowercase SHA-256 digest`);
  }
  const bytes = readSemanticSource(root, anchor.path, `${label}.path`, {requireTracked});
  assertEqual(sha256(bytes), anchor.raw_sha256, `${label}.raw_sha256`);
  if (anchor.locator_kind === 'json_pointer') {
    if (!anchor.path.endsWith('.json')) {
      throw new Error(`${label}.json_pointer anchor must name a JSON source`);
    }
    resolveJsonPointer(parseStrictJson(bytes, anchor.path), anchor.locator, `${label}.locator`);
    return `${anchor.path}#${anchor.locator_kind}#${anchor.locator}`;
  }
  if (!anchor.path.endsWith('.md')) {
    throw new Error(`${label}.heading anchor must name a Markdown source`);
  }
  const escaped = anchor.locator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`^#{1,6}\\s+${escaped}\\s*$`, 'm').test(bytes.toString('utf8'))) {
    throw new Error(`${label} Markdown heading does not resolve exactly`);
  }
  return `${anchor.path}#${anchor.locator_kind}#${anchor.locator}`;
}

function validateCsDomainContracts(root, contracts, {requireTracked}) {
  if (!Array.isArray(contracts) || contracts.length !== 14) {
    throw new Error('CP-CS scenario schema must define exactly 14 domain contracts');
  }
  const expectedIds = Object.keys(CS_DOMAIN_CONTRACT_EXPECTATIONS);
  const seen = new Set();
  contracts.forEach((contract, index) => {
    const label = `manifest schema catalog CP-CS domain contracts[${index}]`;
    assertExactKeys(
      contract,
      [
        'scenario_id',
        'scenario_domain',
        'required_domain_fields',
        'semantic_owner_and_runtime_refs',
        'allowed_exact_target_ids',
        'allowed_exact_product_profile_subjects',
        'allowed_exact_provider_lanes',
        'wildcard_allowed',
        'status',
      ],
      label,
    );
    const expectedId = expectedIds[index];
    const expected = CS_DOMAIN_CONTRACT_EXPECTATIONS[expectedId];
    assertEqual(contract.scenario_id, expectedId, `${label}.scenario_id`);
    assertEqual(contract.scenario_domain, expected.domain, `${label}.scenario_domain`);
    assertUniqueStringArray(contract.required_domain_fields, `${label}.required_domain_fields`, {
      allowEmpty: false,
    });
    if (
      !Array.isArray(contract.semantic_owner_and_runtime_refs) ||
      contract.semantic_owner_and_runtime_refs.length !== 2
    ) {
      throw new Error(`${label}.semantic_owner_and_runtime_refs must contain exactly two exact anchors`);
    }
    const anchorIdentities = contract.semantic_owner_and_runtime_refs.map((anchor, refIndex) =>
      resolveSemanticOwnerOrRuntimeRef(
        root,
        anchor,
        `${label}.semantic_owner_and_runtime_refs[${refIndex}]`,
        {requireTracked},
      ),
    );
    if (new Set(anchorIdentities).size !== anchorIdentities.length) {
      throw new Error(`${label}.semantic_owner_and_runtime_refs must not duplicate an exact anchor`);
    }
    assertExactArray(contract.allowed_exact_target_ids, expected.targets, `${label}.allowed_exact_target_ids`);
    assertExactArray(
      contract.allowed_exact_product_profile_subjects,
      expected.profiles,
      `${label}.allowed_exact_product_profile_subjects`,
    );
    assertExactArray(
      contract.allowed_exact_provider_lanes,
      expected.providers,
      `${label}.allowed_exact_provider_lanes`,
    );
    assertEqual(contract.wildcard_allowed, false, `${label}.wildcard_allowed`);
    assertEqual(
      contract.status,
      'exact_domain_contract_defined_values_pending',
      `${label}.status`,
    );
    if (seen.has(contract.scenario_id)) throw new Error(`${label}.scenario_id must be unique`);
    seen.add(contract.scenario_id);
  });
  const digest = reviewedSemanticDigest(
    'softbook-cet/mobile-ux-batch1-cs-domain-contracts/v1',
    contracts,
  );
  assertEqual(digest, EXPECTED_CS_DOMAIN_CONTRACTS_DIGEST, 'CP-CS domain contracts reviewed semantic digest');
  return {
    byScenarioId: new Map(contracts.map((entry) => [entry.scenario_id, entry])),
    anchorCount: contracts.reduce(
      (count, contract) => count + contract.semantic_owner_and_runtime_refs.length,
      0,
    ),
    digest,
  };
}

function validateManifestTypeDefinitions(root, definitions, {requireTracked}) {
  if (!Array.isArray(definitions) || definitions.length !== TYPE_DEFINITIONS.length) {
    throw new Error('manifest schema catalog must define exactly 12 type-specific schema contracts');
  }
  const byId = new Map();
  definitions.forEach((definition, index) => {
    const label = `manifest schema catalog.manifest_type_definitions[${index}]`;
    const expected = TYPE_DEFINITIONS[index];
    assertExactKeys(
      definition,
      [
        'schema_id',
        'semantic_validator_id',
        'checkpoint_id',
        'manifest_role',
        'evidence_class',
        'required_common_fields',
        'required_type_fields',
        'result_policy',
        'definition_status',
        'forbidden_fields',
        'authority_effect',
        ...(expected.domainFields ? ['domain_required_fields', 'scenario_domain_contracts'] : []),
        'subject_discriminator_contract',
        'binding_policy',
      ],
      label,
    );
    assertEqual(definition.schema_id, expected.schemaId, `${label}.schema_id`);
    assertEqual(
      definition.semantic_validator_id,
      expected.schemaId,
      `${label}.semantic_validator_id`,
    );
    assertEqual(definition.checkpoint_id, expected.checkpointId, `${label}.checkpoint_id`);
    assertEqual(definition.manifest_role, expected.manifestRole, `${label}.manifest_role`);
    assertEqual(definition.evidence_class, expected.evidenceClass, `${label}.evidence_class`);
    assertExactArray(
      definition.required_common_fields,
      expected.manifestRole === 'scenario_cohort'
        ? SCENARIO_REQUIRED_COMMON_MANIFEST_FIELDS
        : AGGREGATION_REQUIRED_COMMON_MANIFEST_FIELDS,
      `${label}.required_common_fields`,
    );
    assertExactArray(definition.required_type_fields, expected.typeFields, `${label}.required_type_fields`);
    if (expected.domainFields) {
      assertExactArray(
        definition.domain_required_fields,
        expected.domainFields,
        `${label}.domain_required_fields`,
      );
    }
    assertExactKeys(
      definition.subject_discriminator_contract,
      ['required'],
      `${label}.subject_discriminator_contract`,
    );
    assertExactArray(
      definition.subject_discriminator_contract.required,
      expected.manifestRole === 'scenario_cohort'
        ? SUBJECT_DISCRIMINATOR_FIELDS
        : AGGREGATION_SUBJECT_DISCRIMINATOR_FIELDS,
      `${label}.subject_discriminator_contract.required`,
    );
    assertEqual(
      definition.binding_policy,
      expected.manifestRole === 'scenario_cohort'
        ? 'manifest_id_must_resolve_one_reservation_with_exact_checkpoint_scenario_target_profile_provider_and_matrix_row_binding'
        : 'manifest_id_must_resolve_one_reservation_and_revalidate_every_child_record_against_one_frozen_compatibility_map',
      `${label}.binding_policy`,
    );
    assertEqual(
      definition.result_policy,
      'fail_closed_no_pass_before_future_validator_execution_and_independent_verification',
      `${label}.result_policy`,
    );
    assertEqual(
      definition.definition_status,
      'future_schema_contract_reserved_not_implemented',
      `${label}.definition_status`,
    );
    assertExactArray(
      definition.forbidden_fields,
      expected.manifestRole === 'scenario_cohort'
        ? FORBIDDEN_MANIFEST_FIELDS
        : AGGREGATION_FORBIDDEN_MANIFEST_FIELDS,
      `${label}.forbidden_fields`,
    );
    assertEqual(
      definition.authority_effect,
      'none_until_implemented_reviewed_frozen_and_instantiated',
      `${label}.authority_effect`,
    );
    if (byId.has(definition.schema_id)) throw new Error(`${label}.schema_id must be unique`);
    byId.set(definition.schema_id, definition);
  });
  const csDefinition = byId.get('future-cp-cs-scenario-v1');
  const csDomainResult = validateCsDomainContracts(root, csDefinition.scenario_domain_contracts, {
    requireTracked,
  });
  const digest = reviewedSemanticDigest(
    'softbook-cet/mobile-ux-batch1-manifest-type-definitions/v1',
    definitions,
  );
  assertEqual(digest, EXPECTED_MANIFEST_TYPE_DEFINITIONS_DIGEST, 'manifest type definitions reviewed semantic digest');
  return {byId, csDomainResult, digest};
}

function validateRegistrySources(root, sources, {requireTracked}) {
  if (!Array.isArray(sources) || sources.length !== 3) {
    throw new Error('manifest schema catalog.registry_sources must contain exactly three child registries');
  }
  const sourceValues = new Map();
  sources.forEach((source, index) => {
    const label = `manifest schema catalog.registry_sources[${index}]`;
    assertExactKeys(source, ['checkpoint_id', 'path', 'raw_sha256'], label);
    const checkpointId = ['CP-BA', 'CP-CS', 'CP-WEB'][index];
    const expectedPath = FREEZE_CANDIDATE_PATHS[index + 1];
    assertEqual(source.checkpoint_id, checkpointId, `${label}.checkpoint_id`);
    assertEqual(source.path, expectedPath, `${label}.path`);
    const bytes = readSemanticSource(root, source.path, `${label}.path`, {requireTracked});
    assertEqual(source.raw_sha256, sha256(bytes), `${label}.raw_sha256`);
    sourceValues.set(checkpointId, parseStrictJson(bytes, source.path));
  });
  return sourceValues;
}

function validateAggregationContracts(catalog) {
  assertExactKeys(
    catalog.aggregation_child_manifest_record_contract,
    ['required_fields', 'revalidation_required', 'raw_evidence_copy_forbidden', 'compatibility_rule'],
    'manifest schema catalog.aggregation_child_manifest_record_contract',
  );
  assertExactArray(
    catalog.aggregation_child_manifest_record_contract.required_fields,
    ['child_manifest_path', 'byte_size', 'sha256', 'schema_version', 'evidence_class', 'recomputed_result', 'expires_at'],
    'manifest schema catalog.aggregation_child_manifest_record_contract.required_fields',
  );
  assertEqual(
    catalog.aggregation_child_manifest_record_contract.revalidation_required,
    true,
    'manifest schema catalog aggregation child revalidation',
  );
  assertEqual(
    catalog.aggregation_child_manifest_record_contract.raw_evidence_copy_forbidden,
    true,
    'manifest schema catalog aggregation raw evidence copy policy',
  );
  assertEqual(
    catalog.aggregation_child_manifest_record_contract.compatibility_rule,
    'every_child_must_resolve_through_the_single_frozen_compatibility_map',
    'manifest schema catalog aggregation compatibility rule',
  );
  assertExactKeys(
    catalog.compatibility_map_contract,
    ['cardinality', 'frozen', 'required_fields', 'multiple_or_implicit_maps_forbidden'],
    'manifest schema catalog.compatibility_map_contract',
  );
  assertEqual(
    catalog.compatibility_map_contract.cardinality,
    'exactly_one_per_aggregation_manifest',
    'manifest schema catalog compatibility map cardinality',
  );
  assertEqual(catalog.compatibility_map_contract.frozen, true, 'manifest schema catalog compatibility map frozen');
  assertExactArray(
    catalog.compatibility_map_contract.required_fields,
    ['compatibility_map_id', 'subject_commit', 'target_profile_provider_matrix', 'child_manifest_ids', 'frozen_at', 'expires_at', 'sha256'],
    'manifest schema catalog.compatibility_map_contract.required_fields',
  );
  assertEqual(
    catalog.compatibility_map_contract.multiple_or_implicit_maps_forbidden,
    true,
    'manifest schema catalog multiple compatibility map policy',
  );
}

function orderedUnion(reservations, key) {
  const result = [];
  const seen = new Set();
  for (const reservation of reservations) {
    for (const value of reservation.exact_binding[key]) {
      if (!seen.has(value)) {
        seen.add(value);
        result.push(value);
      }
    }
  }
  return result;
}

function validateReservationBinding(reservation, index, sourceValues, csDomains) {
  const label = `manifest schema catalog.reservations[${index}]`;
  const binding = reservation.exact_binding;
  assertExactKeys(binding, EXACT_BINDING_KEYS, `${label}.exact_binding`);
  assertEqual(binding.checkpoint_id, reservation.checkpoint_id, `${label}.exact_binding.checkpoint_id`);
  assertEqual(
    binding.scenario_id,
    reservation.manifest_role === 'scenario_cohort' ? reservation.scenario_id : null,
    `${label}.exact_binding.scenario_id`,
  );
  assertEqual(
    binding.aggregate_id,
    reservation.manifest_role === 'checkpoint_aggregation' ? reservation.aggregate_id : null,
    `${label}.exact_binding.aggregate_id`,
  );
  for (const key of EXACT_BINDING_ARRAY_KEYS) {
    assertUniqueStringArray(binding[key], `${label}.exact_binding.${key}`, {
      allowEmpty: key !== 'lane_ids' && key !== 'target_ids' && key !== 'product_profile_subjects',
    });
  }
  assertExactKeys(
    binding.matrix_row_binding,
    ['applicability', 'matrix_row_id'],
    `${label}.exact_binding.matrix_row_binding`,
  );
  const isWebScenario =
    reservation.checkpoint_id === 'CP-WEB' && reservation.manifest_role === 'scenario_cohort';
  assertEqual(
    binding.matrix_row_binding.applicability,
    isWebScenario ? 'required' : 'not_applicable_non_cp_web_scenario_or_checkpoint_aggregate',
    `${label}.exact_binding.matrix_row_binding.applicability`,
  );
  assertEqual(
    binding.matrix_row_binding.matrix_row_id,
    isWebScenario ? reservation.scenario_id : null,
    `${label}.exact_binding.matrix_row_binding.matrix_row_id`,
  );
  assertExactArray(
    binding.matrix_row_ids,
    isWebScenario ? [reservation.scenario_id] : reservation.manifest_role === 'scenario_cohort' ? [] : binding.matrix_row_ids,
    `${label}.exact_binding.matrix_row_ids`,
  );

  const child = sourceValues.get(reservation.checkpoint_id);
  const lanes = new Map(child.lane_definitions.map((lane) => [lane.lane_id, lane]));
  const selectedLanes = binding.lane_ids.map((laneId) => {
    const lane = lanes.get(laneId);
    if (!lane) throw new Error(`${label}.exact_binding.lane_ids names an unresolved registry lane`);
    return lane;
  });
  const allowedTargets = new Set(selectedLanes.flatMap((lane) => lane.target_ids));
  const allowedProfiles = new Set(selectedLanes.flatMap((lane) => lane.profile_ids));
  for (const targetId of binding.target_ids) {
    if (!allowedTargets.has(targetId)) throw new Error(`${label}.exact_binding.target_ids is not lane-backed`);
  }
  for (const profile of binding.product_profile_subjects) {
    if (!allowedProfiles.has(profile)) {
      throw new Error(`${label}.exact_binding.product_profile_subjects is not lane-backed`);
    }
  }
  const requirementIds = (key) =>
    new Set(
      selectedLanes.flatMap((lane) =>
        lane.requirement_bindings[key].map((reference) => reference.requirement_id),
      ),
    );
  const requiredIdChecks = [
    ['service_subject_discriminators', 'provider_lane_requirement_refs'],
    ['content_subject_requirement_ids', 'content_requirement_refs'],
    ['system_subject_requirement_ids', 'target_requirement_refs'],
    ['membership_stage_requirement_ids', 'membership_stage_requirement_refs'],
    ['intended_origin_requirement_ids', 'intended_origin_requirement_refs'],
    ['exact_scope_requirement_ids', 'exact_scope_requirement_refs'],
  ];
  for (const [bindingKey, requirementKey] of requiredIdChecks) {
    const allowed = requirementIds(requirementKey);
    for (const requirementId of binding[bindingKey]) {
      if (!allowed.has(requirementId)) {
        throw new Error(`${label}.exact_binding.${bindingKey} contains an unresolved lane requirement`);
      }
    }
  }
  assertExactArray(
    binding.service_subject_discriminators,
    binding.provider_lanes.map((provider) => `provider-lane-${provider.replaceAll('_', '-')}`),
    `${label}.exact_binding provider/domain discriminator pairing`,
  );
  assertExactArray(
    binding.system_subject_requirement_ids,
    binding.target_ids,
    `${label}.exact_binding system/target pairing`,
  );

  if (reservation.checkpoint_id === 'CP-CS' && reservation.manifest_role === 'scenario_cohort') {
    const domain = csDomains.get(reservation.scenario_id);
    if (!domain) throw new Error(`${label} has no exact CP-CS scenario domain contract`);
    assertExactArray(binding.target_ids, domain.allowed_exact_target_ids, `${label} CP-CS exact targets`);
    assertExactArray(
      binding.product_profile_subjects,
      domain.allowed_exact_product_profile_subjects,
      `${label} CP-CS exact product/profile subjects`,
    );
    assertExactArray(binding.provider_lanes, domain.allowed_exact_provider_lanes, `${label} CP-CS exact providers`);
  }
}

export function validateManifestSchemaCatalog(root, catalog, {requireTracked = false} = {}) {
  assertExactKeys(
    catalog,
    [
      'schema_version',
      'catalog_id',
      'classification',
      'subject_class',
      'candidate_status',
      'coverage_effect',
      'instance_subtree_status',
      'scenario_required_common_fields',
      'aggregation_required_common_fields',
      'aggregation_child_manifest_record_contract',
      'compatibility_map_contract',
      'registry_sources',
      'manifest_type_definitions',
      'reservations',
      'authority',
    ],
    'manifest schema catalog',
  );
  assertEqual(catalog.schema_version, 'mobile-ux-batch1-manifest-schema-catalog.v1', 'manifest schema catalog.schema_version');
  assertEqual(
    catalog.catalog_id,
    'mobile-ux-architecture-v5-batch1-future-manifest-schema-catalog',
    'manifest schema catalog.catalog_id',
  );
  assertEqual(catalog.classification, 'implementation_hypothesis', 'manifest schema catalog.classification');
  assertEqual(catalog.subject_class, 'schema_definition_only', 'manifest schema catalog.subject_class');
  assertEqual(catalog.candidate_status, 'candidate_incomplete', 'manifest schema catalog.candidate_status');
  assertEqual(catalog.coverage_effect, 'none_pre_execution', 'manifest schema catalog.coverage_effect');
  assertExactArray(
    catalog.scenario_required_common_fields,
    SCENARIO_REQUIRED_COMMON_MANIFEST_FIELDS,
    'manifest schema catalog.scenario_required_common_fields',
  );
  assertExactArray(
    catalog.aggregation_required_common_fields,
    AGGREGATION_REQUIRED_COMMON_MANIFEST_FIELDS,
    'manifest schema catalog.aggregation_required_common_fields',
  );
  validateAggregationContracts(catalog);
  assertExactKeys(
    catalog.instance_subtree_status,
    ['path', 'required_state', 'observed_state', 'instance_count'],
    'manifest schema catalog.instance_subtree_status',
  );
  assertEqual(
    catalog.instance_subtree_status.path,
    EXECUTION_MANIFEST_ROOT,
    'manifest schema catalog.instance_subtree_status.path',
  );
  assertEqual(
    catalog.instance_subtree_status.required_state,
    'absent_until_future_protected_manifest_freeze_decision',
    'manifest schema catalog.instance_subtree_status.required_state',
  );
  assertEqual(catalog.instance_subtree_status.observed_state, 'absent', 'manifest schema catalog.instance_subtree_status.observed_state');
  assertEqual(catalog.instance_subtree_status.instance_count, 0, 'manifest schema catalog.instance_subtree_status.instance_count');
  assertAuthorityObjectFalse(catalog.authority, 'manifest schema catalog.authority');
  const sourceValues = validateRegistrySources(root, catalog.registry_sources, {requireTracked});
  const definitionResult = validateManifestTypeDefinitions(root, catalog.manifest_type_definitions, {
    requireTracked,
  });
  const definitions = definitionResult.byId;
  const expected = expectedManifestReservations(root, {requireTracked});
  if (!Array.isArray(catalog.reservations) || catalog.reservations.length !== 35) {
    throw new Error(`manifest schema catalog must contain exactly 35 reservations`);
  }
  const ids = new Set();
  const paths = new Set();
  catalog.reservations.forEach((reservation, index) => {
    const label = `manifest schema catalog.reservations[${index}]`;
    const wanted = expected[index];
    const identityKey = wanted.manifest_role === 'checkpoint_aggregation' ? 'aggregate_id' : 'scenario_id';
    assertExactKeys(reservation, [...MANIFEST_RESERVATION_KEYS, identityKey], label);
    for (const [key, value] of Object.entries(wanted)) {
      assertEqual(reservation[key], value, `${label}.${key}`);
    }
    const definition = definitions.get(reservation.semantic_validator_id);
    if (!definition) throw new Error(`${label}.semantic_validator_id has no type-specific schema definition`);
    assertEqual(definition.checkpoint_id, reservation.checkpoint_id, `${label} definition checkpoint`);
    assertEqual(definition.manifest_role, reservation.manifest_role, `${label} definition manifest role`);
    if (ids.has(reservation.manifest_id)) throw new Error(`${label}.manifest_id must be globally unique`);
    if (paths.has(reservation.planned_path)) throw new Error(`${label}.planned_path must be globally unique`);
    ids.add(reservation.manifest_id);
    paths.add(reservation.planned_path);
    if (!reservation.planned_path.startsWith(`${EXECUTION_MANIFEST_ROOT}/`)) {
      throw new Error(`${label}.planned_path must stay inside the reserved manifest subtree`);
    }
    assertSafeRelativePath(reservation.planned_path, `${label}.planned_path`);
    assertPathAbsent(root, reservation.planned_path, `${label}.planned_path`, {requireTracked});
    assertEqual(
      reservation.exact_binding_status,
      'schema_bound_values_pending_instance_absent',
      `${label}.exact_binding_status`,
    );
    assertEqual(
      reservation.reservation_ref,
      `${MANIFEST_CATALOG_PATH}#/reservations/${index}`,
      `${label}.reservation_ref`,
    );
    validateReservationBinding(
      reservation,
      index,
      sourceValues,
      definitionResult.csDomainResult.byScenarioId,
    );
  });
  for (const checkpointId of ['CP-BA', 'CP-CS', 'CP-WEB']) {
    const scenarios = catalog.reservations.filter(
      (reservation) =>
        reservation.checkpoint_id === checkpointId && reservation.manifest_role === 'scenario_cohort',
    );
    const aggregate = catalog.reservations.find(
      (reservation) =>
        reservation.checkpoint_id === checkpointId &&
        reservation.manifest_role === 'checkpoint_aggregation',
    );
    if (!aggregate) throw new Error(`${checkpointId} must have one checkpoint aggregation reservation`);
    for (const key of EXACT_BINDING_ARRAY_KEYS) {
      assertExactArray(
        aggregate.exact_binding[key],
        orderedUnion(scenarios, key),
        `${checkpointId} aggregate exact_binding.${key} exact ordered scenario union`,
      );
    }
  }
  assertExecutionManifestSubtreeAbsent(root, {requireTracked});
  if (new Set(catalog.reservations.map((entry) => entry.semantic_validator_id)).size !== definitions.size) {
    throw new Error('every type-specific schema definition must be referenced by at least one reservation');
  }
  const reservationDigest = reviewedSemanticDigest(
    'softbook-cet/mobile-ux-batch1-manifest-reservations/v1',
    catalog.reservations,
  );
  assertEqual(
    reservationDigest,
    EXPECTED_MANIFEST_RESERVATIONS_DIGEST,
    'manifest reservations reviewed semantic digest',
  );
  return {
    reservationCount: catalog.reservations.length,
    manifestIds: ids,
    definitionCount: definitions.size,
    manifestTypeDefinitionsDigest: definitionResult.digest,
    reservationDigest,
    csDomainSourceAnchorCount: definitionResult.csDomainResult.anchorCount,
    csDomainContractDigest: definitionResult.csDomainResult.digest,
  };
}
