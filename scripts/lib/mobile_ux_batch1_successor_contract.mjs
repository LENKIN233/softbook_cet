import {createHash} from 'node:crypto';

export const BATCH1_DIRECTORY =
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1';
export const BATCH1_SUBJECT_PATHS = Object.freeze([
  `${BATCH1_DIRECTORY}/registry-set.v2.proposal.json`,
  `${BATCH1_DIRECTORY}/cp-ba.registry.v2.proposal.json`,
  `${BATCH1_DIRECTORY}/cp-cs.registry.v2.proposal.json`,
  `${BATCH1_DIRECTORY}/cp-web.registry.v2.proposal.json`,
  `${BATCH1_DIRECTORY}/manifest-schema-catalog.v1.json`,
]);
export const EXECUTION_MANIFEST_ROOT = `${BATCH1_DIRECTORY}/execution-manifests`;

export const SCHEMA_SUBJECT_RAW_SHA256 = Object.freeze({
  [BATCH1_SUBJECT_PATHS[0]]:
    '58966c8df9e9f5a5a7f6711a048317b78a2300d3a003e1dd6bdd238c0e928c03',
  [BATCH1_SUBJECT_PATHS[1]]:
    '247ff9d3de23e31f3e37e35e9a53fd0fe1edc24bc2d93ca4468a5a2571338491',
  [BATCH1_SUBJECT_PATHS[2]]:
    '8819358f978a1c573067d468531744b2fd900864d3317542e741bffae2f2bdfa',
  [BATCH1_SUBJECT_PATHS[3]]:
    'cc0b4aa3f73b36318d00e28f1514115f10dec78fd21c8948f1c3030d2699da60',
  [BATCH1_SUBJECT_PATHS[4]]:
    '814088a2b709e0d31a5a1d96d3bc29e17dc47849fdcd44f1785162d452ac5b1b',
});

export const SCHEMA_SUBJECT_DIGEST =
  'df8d1bb25b4a38b1c23c84fe8ffddc7c4b9013ce4228b6c975dfb3bcb2256793';
export const SCHEMA_TRANSITION_DIGEST =
  'c8e697352ec66e58fd48c4f8432c87ba97c869a29a0c45bfa812e5e179c58504';
export const SUBJECT_DIGEST_DOMAINS = Object.freeze({
  schema: 'softbook-cet/mobile-ux-batch1-freeze-candidate-subject/v1',
  r0: 'softbook-cet/mobile-ux-batch1-designation-subject/v1',
  b2: 'softbook-cet/mobile-ux-batch1-final-freeze-subject/v1',
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

export const ALL_FALSE_AUTHORITY = Object.freeze(
  Object.fromEntries(AUTHORITY_KEYS.map((key) => [key, false])),
);

export const POST_DESIGNATION_REQUIREMENT_IDS = Object.freeze([
  'build-cp-ba-browser-documents',
  'window-cp-ba',
  'window-cp-cs',
  'window-cp-web',
  'compatibility-cp-ba-platform-browser',
  'compatibility-cp-ba-shared-formal',
  'compatibility-cp-ba-shared-managed',
  'compatibility-cp-cs-aggregate',
  'compatibility-cp-web-aggregate',
]);

const POST_DESIGNATION_SET = new Set(POST_DESIGNATION_REQUIREMENT_IDS);
const SHA256_RE = /^[0-9a-f]{64}$/;
const SHA1_RE = /^[0-9a-f]{40}$/;
const RFC3339_SECOND_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const REPOSITORY_PATH_RE = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/;
const VALUE_DIGEST_DOMAIN = 'softbook-cet/mobile-ux-batch1-resolved-value/v1';
const SOURCE_CLOSURE_DOMAIN = 'softbook-cet/mobile-ux-batch1-build-source-closure/v1';
const BINDING_BUNDLE_DOMAIN = 'softbook-cet/mobile-ux-batch1-binding-bundle/v1';
const WINDOW_EVENT_DOMAIN = 'softbook-cet/mobile-ux-batch1-protected-schedule-event/v1';
const CP_BA_MAP_DOMAIN = 'softbook-cet/mobile-ux-batch1-compatibility-map/cp-ba/v1';
const MAX_PROVENANCE_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

const COMPATIBILITY_DEFINITIONS = Object.freeze({
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
});

const R0_BLOCKERS = Object.freeze([
  'protected_cohort_designation_missing',
  'post_designation_build_windows_and_compatibility_bindings_missing',
  'future_manifest_freeze_decision_missing',
  'exact_compatibility_keys_missing',
  'execution_manifest_subtree_must_remain_absent',
]);

const B2_BLOCKERS = Object.freeze([
  'future_manifest_freeze_decision_missing',
  'execution_manifest_subtree_must_remain_absent',
]);

const SENSITIVE_VALUE_PATTERNS = Object.freeze([
  ['email address', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu],
  ['mainland phone number', /(?:^|\D)1[3-9]\d{9}(?:\D|$)/u],
  ['home-directory path', /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)/u],
  ['credential-like value', /(?:password|passwd|private[_-]?key|access[_-]?token|secret[_-]?key)\s*[:=]/iu],
  ['raw device identifier label', /(?:udid|android[_-]?id|device[_-]?serial|mac[_-]?address|raw[_-]?hostname)/iu],
]);

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('canonical JSON rejects non-finite numbers');
  }
  return JSON.stringify(value);
}

export function domainDigest(domain, value) {
  assertNonEmptyString(domain, 'digest domain');
  return sha256(Buffer.from(`${domain}\0${canonicalJson(value)}`, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNonEmptyString(value, label) {
  assert(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
}

function assertSha256(value, label) {
  assert(typeof value === 'string' && SHA256_RE.test(value), `${label} must be a lowercase SHA-256`);
}

function assertCommit(value, label) {
  assert(typeof value === 'string' && SHA1_RE.test(value), `${label} must be a lowercase full Git SHA`);
}

function assertExactKeys(value, expected, label) {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  assert(
    JSON.stringify(actual) === JSON.stringify(wanted),
    `${label} keys must equal ${wanted.join(', ')}; received ${actual.join(', ')}`,
  );
}

function assertDeepEqual(actual, expected, label) {
  assert(
    canonicalJson(actual) === canonicalJson(expected),
    `${label} must remain byte-semantically unchanged`,
  );
}

function assertExactArray(actual, expected, label) {
  assert(Array.isArray(actual), `${label} must be an array`);
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} must equal ${JSON.stringify(expected)}; received ${JSON.stringify(actual)}`,
  );
}

export function assertAllFalseAuthority(value, label = 'authority') {
  assertExactKeys(value, AUTHORITY_KEYS, label);
  for (const key of AUTHORITY_KEYS) {
    assert(value[key] === false, `${label}.${key} must be false`);
  }
}

function normalizeAuthorityForComparison(record) {
  const copy = structuredClone(record);
  copy.authority = ALL_FALSE_AUTHORITY;
  return copy;
}

function cloneWithout(value, keys) {
  const copy = structuredClone(value);
  for (const key of keys) delete copy[key];
  return copy;
}

function scanSensitiveValue(value, label) {
  const visit = (node, path) => {
    if (typeof node === 'string') {
      for (const [name, pattern] of SENSITIVE_VALUE_PATTERNS) {
        if (pattern.test(node)) throw new Error(`${path} contains forbidden ${name}`);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (node !== null && typeof node === 'object') {
      for (const [key, item] of Object.entries(node)) {
        visit(key, `${path}.[key]`);
        visit(item, `${path}.${key}`);
      }
    }
  };
  visit(value, label);
}

function parseUtc(value, label) {
  assert(typeof value === 'string' && RFC3339_SECOND_RE.test(value), `${label} must be UTC second precision`);
  const timestamp = Date.parse(value);
  assert(Number.isFinite(timestamp), `${label} must be a real timestamp`);
  assert(
    new Date(timestamp).toISOString().replace('.000Z', 'Z') === value,
    `${label} must be a canonical real UTC timestamp`,
  );
  return timestamp;
}

function assertArtifactRecord(record, label, artifactReader = null) {
  assertExactKeys(record, ['path', 'git_mode', 'byte_length', 'raw_sha256'], label);
  assertNonEmptyString(record.path, `${label}.path`);
  assert(REPOSITORY_PATH_RE.test(record.path), `${label}.path must be normalized and repository relative`);
  scanSensitiveValue(record.path, `${label}.path`);
  assert(record.git_mode === '100644', `${label}.git_mode must be 100644`);
  assert(Number.isSafeInteger(record.byte_length) && record.byte_length > 0, `${label}.byte_length must be positive`);
  assertSha256(record.raw_sha256, `${label}.raw_sha256`);
  if (artifactReader) {
    const artifact = artifactReader(record.path);
    assert(artifact && artifact.gitMode === '100644', `${label}.path must resolve to a tracked 100644 blob`);
    const bytes = Buffer.from(artifact.bytes);
    assert(bytes.length === record.byte_length, `${label}.byte_length does not match tracked bytes`);
    assert(sha256(bytes) === record.raw_sha256, `${label}.raw_sha256 does not match tracked bytes`);
  }
}

function assertResolvedValueShape(requirement, label) {
  const resolved = requirement.resolved_value;
  assertExactKeys(resolved, ['schema_version', 'value_class', 'value', 'value_sha256'], `${label}.resolved_value`);
  assert(
    resolved.schema_version === 'mobile-ux-batch1-resolved-value.v1',
    `${label}.resolved_value.schema_version is unsupported`,
  );
  assert(
    resolved.value_class === requirement.allowed_value_class,
    `${label}.resolved_value.value_class must equal allowed_value_class`,
  );
  assert(
    ['string', 'object'].includes(typeof resolved.value) && resolved.value !== null,
    `${label}.resolved_value.value must be a string, array, or object`,
  );
  assert(
    typeof resolved.value !== 'string' || resolved.value.length > 0,
    `${label}.resolved_value.value must not be empty`,
  );
  if (Array.isArray(resolved.value)) {
    assert(resolved.value.length > 0, `${label}.resolved_value.value array must not be empty`);
  } else if (typeof resolved.value === 'object') {
    assert(Object.keys(resolved.value).length > 0, `${label}.resolved_value.value object must not be empty`);
  }
  const expectedDigest = domainDigest(VALUE_DIGEST_DOMAIN, resolved.value);
  assert(resolved.value_sha256 === expectedDigest, `${label}.resolved_value.value_sha256 must be recomputed`);

  const valueClass = requirement.allowed_value_class;
  if (['owner_exact_obligation_id_set', 'owner_exact_tier2_obligation_id_set'].includes(valueClass)) {
    assert(Array.isArray(resolved.value), `${label} exact obligation value must be an array`);
    assert(resolved.value.every((item) => typeof item === 'string' && item.length > 0), `${label} exact obligation IDs must be strings`);
    assert(new Set(resolved.value).size === resolved.value.length, `${label} exact obligation IDs must be unique`);
    assertExactArray(resolved.value, [...resolved.value].sort(), `${label} exact obligation ID order`);
  } else if (valueClass === 'deterministic_compatibility_sha256_value_v1') {
    assertSha256(resolved.value, `${label}.resolved_value.value`);
  } else if (valueClass === 'human_role_confirmation_contract') {
    assertExactKeys(
      resolved.value,
      [
        'role_requirement_id',
        'campaign_scoped_principal_pseudonym',
        'confirmation_event_sha256',
        'real_identity_persisted',
      ],
      `${label}.resolved_value.value`,
    );
    assert(resolved.value.role_requirement_id === requirement.requirement_id, `${label} role requirement binding`);
    assert(
      /^hmac-sha256:[0-9a-f]{64}$/.test(resolved.value.campaign_scoped_principal_pseudonym),
      `${label} role pseudonym must be campaign-scoped HMAC-SHA256`,
    );
    assertSha256(resolved.value.confirmation_event_sha256, `${label} confirmation event digest`);
    assert(resolved.value.real_identity_persisted === false, `${label} must not persist real identity`);
    scanSensitiveValue(
      resolved.value.role_requirement_id,
      `${label}.resolved_value.value.role_requirement_id`,
    );
  } else if (valueClass === 'owner_selected_membership_stage_set_or_owner_backed_not_applicable') {
    if (Array.isArray(resolved.value)) {
      const allowed = new Set(['trial_available', 'trial', 'free', 'premium']);
      assert(resolved.value.length > 0 && resolved.value.every((item) => allowed.has(item)), `${label} membership stages are invalid`);
      assert(new Set(resolved.value).size === resolved.value.length, `${label} membership stages must be unique`);
    } else {
      assertExactKeys(resolved.value, ['not_applicable', 'owner_decision_ref'], `${label} membership not-applicable value`);
      assert(resolved.value.not_applicable === true, `${label} membership not-applicable marker`);
      assertNonEmptyString(resolved.value.owner_decision_ref, `${label} owner decision ref`);
    }
  } else if (valueClass === 'owner_selected_safe_origin_descriptor_or_owner_backed_not_applicable') {
    assert(typeof resolved.value === 'object' && !Array.isArray(resolved.value), `${label} origin value must be an object`);
    if (resolved.value.not_applicable === true) {
      assertExactKeys(resolved.value, ['not_applicable', 'owner_decision_ref'], `${label} origin not-applicable value`);
    } else {
      assertExactKeys(resolved.value, ['origin_kind', 'route_id', 'parameter_schema'], `${label} safe origin descriptor`);
      assertNonEmptyString(resolved.value.origin_kind, `${label} origin_kind`);
      assertNonEmptyString(resolved.value.route_id, `${label} route_id`);
      assert(typeof resolved.value.parameter_schema === 'object' && resolved.value.parameter_schema !== null, `${label} parameter_schema`);
      assert(!/https?:\/\//iu.test(canonicalJson(resolved.value)), `${label} must not persist a raw URL`);
    }
  }
  if (
    ![
      'deterministic_compatibility_sha256_value_v1',
      'designation_bound_source_closure_build_value_v1',
      'canonical_utc_execution_window_value_v1',
      'human_role_confirmation_contract',
    ].includes(valueClass)
  ) {
    scanSensitiveValue(resolved.value, `${label}.resolved_value.value`);
  }
}

function allowedSourceClasses(requirement) {
  const valueClass = requirement.allowed_value_class;
  if (valueClass === 'repository_semantic_mapping_subject') return new Set(['repository_artifact']);
  if (valueClass === 'human_role_confirmation_contract') return new Set(['protected_human_confirmation']);
  if (valueClass === 'deterministic_compatibility_sha256_value_v1') return new Set(['deterministic_derivation']);
  if (valueClass === 'designation_bound_source_closure_build_value_v1') return new Set(['deterministic_derivation']);
  if (valueClass === 'canonical_utc_execution_window_value_v1') return new Set(['protected_owner_decision']);
  if (['account', 'content', 'environment'].includes(requirement.requirement_kind)) {
    return new Set(['verified_external_resource']);
  }
  if (requirement.requirement_kind === 'build') {
    return new Set(['repository_artifact', 'verified_external_resource']);
  }
  return new Set(['repository_artifact', 'protected_owner_decision']);
}

export const RESOLVER_ROLES_BY_SOURCE_CLASS = Object.freeze({
  repository_artifact: Object.freeze(['repository_semantic_resolver']),
  protected_owner_decision: Object.freeze(['protected_product_owner']),
  protected_human_confirmation: Object.freeze([
    'confirmed_operator',
    'confirmed_independent_verifier',
  ]),
  verified_external_resource: Object.freeze(['external_resource_verifier']),
  deterministic_derivation: Object.freeze(['deterministic_builder']),
});

function assertResolutionProvenance(requirement, label, artifactReader) {
  const provenance = requirement.resolution_provenance;
  assertExactKeys(
    provenance,
    [
      'schema_version',
      'source_class',
      'source_ref',
      'source_event_sha256',
      'source_artifact_records',
      'resolver_role',
      'effective_at',
      'expires_at',
      'gate_eligible',
    ],
    `${label}.resolution_provenance`,
  );
  assert(
    provenance.schema_version === 'mobile-ux-batch1-resolution-provenance.v1',
    `${label}.resolution_provenance.schema_version is unsupported`,
  );
  assertNonEmptyString(provenance.source_ref, `${label}.resolution_provenance.source_ref`);
  assertNonEmptyString(provenance.resolver_role, `${label}.resolver_role`);
  scanSensitiveValue(provenance.source_ref, `${label}.resolution_provenance.source_ref`);
  scanSensitiveValue(provenance.resolver_role, `${label}.resolution_provenance.resolver_role`);
  assert(
    allowedSourceClasses(requirement).has(provenance.source_class),
    `${label}.resolution_provenance.source_class is not allowed for ${requirement.allowed_value_class}`,
  );
  assert(Array.isArray(provenance.source_artifact_records), `${label}.source_artifact_records must be an array`);
  provenance.source_artifact_records.forEach((record, index) =>
    assertArtifactRecord(record, `${label}.source_artifact_records[${index}]`, artifactReader),
  );
  if (['repository_artifact', 'deterministic_derivation'].includes(provenance.source_class)) {
    assert(provenance.source_event_sha256 === null, `${label} local deterministic source must not invent an event digest`);
    assert(provenance.source_artifact_records.length > 0, `${label} local deterministic source needs artifact records`);
  } else {
    assertSha256(provenance.source_event_sha256, `${label}.source_event_sha256`);
  }
  const allowedResolverRoles = RESOLVER_ROLES_BY_SOURCE_CLASS[provenance.source_class];
  assert(
    Array.isArray(allowedResolverRoles) &&
      allowedResolverRoles.includes(provenance.resolver_role),
    `${label}.resolution_provenance.resolver_role is not allowed for source_class ${provenance.source_class}`,
  );
  const effectiveAt = parseUtc(provenance.effective_at, `${label}.effective_at`);
  const expiresAt = parseUtc(provenance.expires_at, `${label}.expires_at`);
  assert(expiresAt > effectiveAt, `${label}.expires_at must be after effective_at`);
  assert(expiresAt - effectiveAt <= MAX_PROVENANCE_LIFETIME_MS, `${label} provenance exceeds 90-day remote-verification ceiling`);
  assert(provenance.gate_eligible === false, `${label}.gate_eligible must remain false`);
}

export function validateResolvedRequirement(requirement, baselineRequirement, options = {}) {
  const label = options.label ?? `requirement ${baselineRequirement?.requirement_id ?? '<unknown>'}`;
  assert(baselineRequirement && typeof baselineRequirement === 'object', `${label} baseline is required`);
  const allowedKeys = new Set([...Object.keys(baselineRequirement), 'resolved_value', 'resolution_provenance']);
  assertExactKeys(requirement, [...allowedKeys], label);
  const immutableBaseline = cloneWithout(baselineRequirement, ['status', 'authority']);
  const immutableSuccessor = cloneWithout(requirement, [
    'status',
    'authority',
    'resolved_value',
    'resolution_provenance',
  ]);
  assertDeepEqual(immutableSuccessor, immutableBaseline, `${label} immutable fields`);
  assert(requirement.status === 'typed_value_resolved', `${label}.status must be typed_value_resolved`);
  assertAllFalseAuthority(requirement.authority, `${label}.authority`);
  assertResolvedValueShape(requirement, label);
  assertResolutionProvenance(requirement, label, options.artifactReader ?? null);
  return {
    requirementId: requirement.requirement_id,
    valueDigest: requirement.resolved_value.value_sha256,
  };
}

function assertRegistryCommon(registry, label) {
  assert(registry && typeof registry === 'object' && !Array.isArray(registry), `${label} must be an object`);
  assert(registry.requirement_count === 145, `${label}.requirement_count must remain 145`);
  assert(Object.keys(registry.requirements_by_id ?? {}).length === 145, `${label} must contain exactly 145 requirements`);
  assertAllFalseAuthority(registry.authority, `${label}.authority`);
  const expectedInventory = sha256(
    Buffer.from(
      `${registry.inventory_digest_domain_separator}\0${JSON.stringify(registry.requirements_by_id)}`,
      'utf8',
    ),
  );
  assert(registry.inventory_digest === expectedInventory, `${label}.inventory_digest must be recomputed`);
  return expectedInventory;
}

function assertMaterialization(value, expected, label) {
  assertExactKeys(
    value,
    [
      'schema_version',
      'stage_id',
      'baseline_commit',
      'baseline_subject_digest',
      'resolved_requirement_count',
      'pending_requirement_count',
      'gate_effect',
      'authority',
    ],
    label,
  );
  assert(value.schema_version === 'mobile-ux-batch1-materialization.v1', `${label}.schema_version`);
  assert(value.stage_id === expected.stageId, `${label}.stage_id`);
  assert(value.baseline_commit === expected.baselineCommit, `${label}.baseline_commit`);
  assert(value.baseline_subject_digest === expected.baselineSubjectDigest, `${label}.baseline_subject_digest`);
  assert(value.resolved_requirement_count === expected.resolvedCount, `${label}.resolved_requirement_count`);
  assert(value.pending_requirement_count === expected.pendingCount, `${label}.pending_requirement_count`);
  assert(value.gate_effect === 'none', `${label}.gate_effect must be none`);
  assertAllFalseAuthority(value.authority, `${label}.authority`);
}

function assertBlockerAccounting(value, baselineHistorical, pending, resolved, label) {
  assertExactKeys(value, ['historical_v1_migration', 'current_v2_typed_requirements'], label);
  assertDeepEqual(value.historical_v1_migration, baselineHistorical, `${label}.historical_v1_migration`);
  assertExactKeys(
    value.current_v2_typed_requirements,
    [
      'pending_requirement_count',
      'resolved_requirement_count',
      'source_ref',
      'separate_from_historical_migration',
    ],
    `${label}.current_v2_typed_requirements`,
  );
  assert(value.current_v2_typed_requirements.pending_requirement_count === pending, `${label} pending count`);
  assert(value.current_v2_typed_requirements.resolved_requirement_count === resolved, `${label} resolved count`);
  assert(value.current_v2_typed_requirements.source_ref === '#/current_requirement_registry', `${label} source ref`);
  assert(value.current_v2_typed_requirements.separate_from_historical_migration === true, `${label} separation`);
}

function validateTopLevelTransition(baseline, successor, stage) {
  const mutable = [
    'candidate_status',
    'global_blockers',
    'blocker_accounting',
    'current_requirement_registry',
    'authority',
    'materialization',
    'designation_decision_binding',
    'binding_metadata',
  ];
  assertDeepEqual(
    cloneWithout(successor, mutable),
    cloneWithout(baseline, mutable),
    `${stage} non-materialization top-level content`,
  );
  assertAllFalseAuthority(successor.authority, `${stage}.authority`);
}

export function validateR0Transition({
  baseline,
  successor,
  baselineCommit,
  baselineSubjectDigest = SCHEMA_SUBJECT_DIGEST,
  artifactReader = null,
}) {
  assertCommit(baselineCommit, 'R0 baseline commit');
  validateTopLevelTransition(baseline, successor, 'R0');
  assert(successor.candidate_status === 'resolution_successor_candidate_incomplete', 'R0 candidate_status');
  assertExactArray(successor.global_blockers, R0_BLOCKERS, 'R0 global_blockers');
  assertBlockerAccounting(
    successor.blocker_accounting,
    baseline.blocker_accounting.historical_v1_migration,
    9,
    136,
    'R0 blocker_accounting',
  );
  assertMaterialization(
    successor.materialization,
    {
      stageId: 'R0_resolution_successor',
      baselineCommit,
      baselineSubjectDigest,
      resolvedCount: 136,
      pendingCount: 9,
    },
    'R0 materialization',
  );
  assert(!Object.hasOwn(successor, 'designation_decision_binding'), 'R0 must not bind a D1 decision');
  assert(!Object.hasOwn(successor, 'binding_metadata'), 'R0 must not contain B2 binding metadata');

  const baselineRegistry = baseline.current_requirement_registry;
  const registry = successor.current_requirement_registry;
  assertDeepEqual(
    cloneWithout(registry, ['status', 'requirements_by_id', 'pending_requirement_count', 'inventory_digest', 'authority']),
    cloneWithout(baselineRegistry, ['status', 'requirements_by_id', 'pending_requirement_count', 'inventory_digest', 'authority']),
    'R0 current registry immutable structure',
  );
  assert(registry.status === 'typed_requirements_partially_resolved_pre_designation', 'R0 registry status');
  assert(registry.pending_requirement_count === 9, 'R0 registry pending count');
  const baselineIds = Object.keys(baselineRegistry.requirements_by_id);
  assertExactArray(Object.keys(registry.requirements_by_id), baselineIds, 'R0 requirement ID order');
  const resolved = [];
  const pending = [];
  for (const requirementId of baselineIds) {
    const baselineRequirement = baselineRegistry.requirements_by_id[requirementId];
    const requirement = registry.requirements_by_id[requirementId];
    if (POST_DESIGNATION_SET.has(requirementId)) {
      assertDeepEqual(
        normalizeAuthorityForComparison(requirement),
        normalizeAuthorityForComparison(baselineRequirement),
        `R0 deferred requirement ${requirementId}`,
      );
      assertAllFalseAuthority(requirement.authority, `R0 deferred ${requirementId}.authority`);
      assert(requirement.status === 'typed_value_pending', `R0 deferred ${requirementId}.status`);
      pending.push(requirementId);
    } else {
      validateResolvedRequirement(requirement, baselineRequirement, {
        label: `R0 requirement ${requirementId}`,
        artifactReader,
      });
      resolved.push(requirementId);
    }
  }
  assertExactArray(
    [...pending].sort(),
    [...POST_DESIGNATION_REQUIREMENT_IDS].sort(),
    'R0 deferred requirement set',
  );
  assert(resolved.length === 136, 'R0 must resolve exactly 136 requirements');
  const inventoryDigest = assertRegistryCommon(registry, 'R0 current requirement registry');
  return {
    schema_version: 'mobile-ux-batch1-successor-validation.v1',
    status: 'passed',
    stage: 'R0',
    resolved_requirement_count: 136,
    pending_requirement_count: 9,
    pending_requirement_ids: POST_DESIGNATION_REQUIREMENT_IDS,
    inventory_digest: inventoryDigest,
    gate_effect: 'none',
    authority: ALL_FALSE_AUTHORITY,
    manifest_root_required_state: 'absent',
  };
}

function assertDesignationBinding(value, r0Commit, label) {
  assertExactKeys(
    value,
    [
      'decision_artifact_path',
      'receipt_path',
      'approval_target_head_sha',
      'receipt_materialization_commit_sha',
      'receipt_materialization_pull_request',
      'subject_commit',
      'subject_digest_domain',
      'subject_digest',
      'designated_cohort_id',
      'designated_cohort_sha256',
      'approval_instance_digest',
    ],
    label,
  );
  assert(
    value.decision_artifact_path ===
      'docs/design/decisions/mobile-ux-batch1-cohort-designation-v1.json',
    `${label}.decision_artifact_path`,
  );
  assert(
    value.receipt_path ===
      'docs/design/decisions/mobile-ux-batch1-cohort-designation-v1.approval-receipt.json',
    `${label}.receipt_path`,
  );
  assertCommit(value.approval_target_head_sha, `${label}.approval_target_head_sha`);
  assertCommit(value.receipt_materialization_commit_sha, `${label}.receipt_materialization_commit_sha`);
  assert(
    Number.isSafeInteger(value.receipt_materialization_pull_request) &&
      value.receipt_materialization_pull_request > 0,
    `${label}.receipt_materialization_pull_request`,
  );
  assert(value.subject_commit === r0Commit, `${label}.subject_commit must equal R0 commit`);
  assert(value.subject_digest_domain === SUBJECT_DIGEST_DOMAINS.r0, `${label}.subject_digest_domain`);
  assertSha256(value.subject_digest, `${label}.subject_digest`);
  assert(
    /^cet(?:4|6)-[a-z2-7]{26}$/.test(value.designated_cohort_id),
    `${label}.designated_cohort_id must be an opaque 130-bit lowercase base32 identifier`,
  );
  const cohortDigest = domainDigest('softbook-cet/mobile-ux-batch1-designated-cohort/v1', [
    ['designation_subject_commit', value.subject_commit],
    ['designation_subject_digest_domain', value.subject_digest_domain],
    ['designation_subject_digest', value.subject_digest],
    ['designated_cohort_id', value.designated_cohort_id],
  ]);
  assert(value.designated_cohort_sha256 === cohortDigest, `${label}.designated_cohort_sha256`);
  assertSha256(value.approval_instance_digest, `${label}.approval_instance_digest`);
}

function assertWindowValue(value, requirementId, label) {
  assertExactKeys(
    value,
    [
      'window_requirement_id',
      'start_at_utc',
      'end_at_utc',
      'expires_at_utc',
      'schedule_issuer_authority_ref',
      'schedule_issuer_principal_pseudonym',
      'schedule_issued_at_utc',
      'schedule_event_ref',
      'schedule_event_sha256',
    ],
    label,
  );
  assert(value.window_requirement_id === requirementId, `${label}.window_requirement_id`);
  const issued = parseUtc(value.schedule_issued_at_utc, `${label}.schedule_issued_at_utc`);
  const start = parseUtc(value.start_at_utc, `${label}.start_at_utc`);
  const end = parseUtc(value.end_at_utc, `${label}.end_at_utc`);
  const expires = parseUtc(value.expires_at_utc, `${label}.expires_at_utc`);
  assert(issued < start && start < end && end <= expires, `${label} temporal order is invalid`);
  assert(/^hmac-sha256:[0-9a-f]{64}$/.test(value.schedule_issuer_principal_pseudonym), `${label} issuer pseudonym`);
  const expectedDigest = domainDigest(WINDOW_EVENT_DOMAIN, [
    ['window_requirement_id', value.window_requirement_id],
    ['start_at_utc', value.start_at_utc],
    ['end_at_utc', value.end_at_utc],
    ['expires_at_utc', value.expires_at_utc],
    ['schedule_issuer_authority_ref', value.schedule_issuer_authority_ref],
    ['schedule_issuer_principal_pseudonym', value.schedule_issuer_principal_pseudonym],
    ['schedule_issued_at_utc', value.schedule_issued_at_utc],
    ['schedule_event_ref', value.schedule_event_ref],
  ]);
  assert(value.schedule_event_sha256 === expectedDigest, `${label}.schedule_event_sha256`);
  scanSensitiveValue(
    {
      window_requirement_id: value.window_requirement_id,
      schedule_issuer_authority_ref: value.schedule_issuer_authority_ref,
      schedule_event_ref: value.schedule_event_ref,
    },
    label,
  );
}

function assertBuildValue(value, designation, label, artifactReader) {
  assertExactKeys(
    value,
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
      'builder_runtime_identity',
      'archive_metadata_normalization_profile',
      'build_output_artifact',
    ],
    label,
  );
  const bindings = {
    designation_subject_commit: designation.subject_commit,
    designation_subject_digest_domain: designation.subject_digest_domain,
    designation_subject_digest: designation.subject_digest,
    designated_cohort_id: designation.designated_cohort_id,
    designated_cohort_sha256: designation.designated_cohort_sha256,
    designation_approval_instance_digest: designation.approval_instance_digest,
  };
  for (const [key, expected] of Object.entries(bindings)) {
    assert(value[key] === expected, `${label}.${key} must bind exact D1`);
  }
  assert(value.build_recipe_id === 'cp-ba-browser-documents-hermetic-build-v1', `${label}.build_recipe_id`);
  assertSha256(value.build_recipe_raw_sha256, `${label}.build_recipe_raw_sha256`);
  assertSha256(value.toolchain_lock_raw_sha256, `${label}.toolchain_lock_raw_sha256`);
  assert(value.build_output_role === 'cp-ba-browser-documents', `${label}.build_output_role`);
  assert(Array.isArray(value.source_closure_records) && value.source_closure_records.length > 1, `${label}.source_closure_records`);
  const sourcePaths = value.source_closure_records.map((record, index) => {
    assertArtifactRecord(record, `${label}.source_closure_records[${index}]`, artifactReader);
    return record.path;
  });
  assertExactArray(sourcePaths, [...sourcePaths].sort(), `${label} source closure order`);
  assert(new Set(sourcePaths).size === sourcePaths.length, `${label} source closure paths must be unique`);
  assert(sourcePaths.includes('scripts/build_mobile_ux_batch1_cp_ba_browser_documents.mjs'), `${label} source closure must contain recipe`);
  assert(
    sourcePaths.includes('apps/mobile/package-lock.json'),
    `${label} source closure must contain the tracked mobile toolchain lock`,
  );
  const recipeRecord = value.source_closure_records.find(
    (record) => record.path === 'scripts/build_mobile_ux_batch1_cp_ba_browser_documents.mjs',
  );
  const lockRecord = value.source_closure_records.find(
    (record) => record.path === 'apps/mobile/package-lock.json',
  );
  assert(
    recipeRecord.raw_sha256 === value.build_recipe_raw_sha256,
    `${label}.build_recipe_raw_sha256 must equal the source-closure recipe record`,
  );
  assert(
    lockRecord.raw_sha256 === value.toolchain_lock_raw_sha256,
    `${label}.toolchain_lock_raw_sha256 must equal the source-closure lock record`,
  );
  const expectedClosure = domainDigest(
    SOURCE_CLOSURE_DOMAIN,
    value.source_closure_records.map((record) => [
      ['path', record.path],
      ['git_mode', record.git_mode],
      ['byte_length', record.byte_length],
      ['raw_sha256', record.raw_sha256],
    ]),
  );
  assert(value.source_closure_digest === expectedClosure, `${label}.source_closure_digest`);
  assertExactKeys(
    value.builder_runtime_identity,
    ['builder_image_digest', 'runtime_version', 'operating_system', 'architecture', 'locale', 'timezone'],
    `${label}.builder_runtime_identity`,
  );
  assert(/^sha256:[0-9a-f]{64}$/.test(value.builder_runtime_identity.builder_image_digest), `${label} builder image digest`);
  for (const key of ['runtime_version', 'operating_system', 'architecture', 'locale', 'timezone']) {
    assertNonEmptyString(value.builder_runtime_identity[key], `${label}.builder_runtime_identity.${key}`);
  }
  assertExactKeys(
    value.archive_metadata_normalization_profile,
    ['profile_id', 'entry_order', 'mtime_epoch_seconds', 'uid', 'gid', 'uname', 'gname', 'file_mode', 'directory_mode'],
    `${label}.archive_metadata_normalization_profile`,
  );
  assert(value.archive_metadata_normalization_profile.profile_id === 'ustar-portable-zero-metadata-v1', `${label} archive profile`);
  assert(value.archive_metadata_normalization_profile.entry_order === 'normalized_path_utf8_ascending', `${label} archive order`);
  assert(value.archive_metadata_normalization_profile.mtime_epoch_seconds === 0, `${label} archive mtime`);
  assert(value.archive_metadata_normalization_profile.uid === 0 && value.archive_metadata_normalization_profile.gid === 0, `${label} archive ids`);
  assert(value.archive_metadata_normalization_profile.uname === '' && value.archive_metadata_normalization_profile.gname === '', `${label} archive names`);
  assert(value.archive_metadata_normalization_profile.file_mode === '0644', `${label} archive file mode`);
  assert(value.archive_metadata_normalization_profile.directory_mode === '0755', `${label} archive directory mode`);
  assertArtifactRecord(value.build_output_artifact, `${label}.build_output_artifact`, artifactReader);
  assert(value.build_output_artifact.path === 'artifacts/mobile-ux-batch1/cp-ba-browser-documents.tar', `${label} output path`);
  assert(!sourcePaths.includes(value.build_output_artifact.path), `${label} output must not be in source closure`);
  scanSensitiveValue(
    {
      designated_cohort_id: value.designated_cohort_id,
      build_recipe_id: value.build_recipe_id,
      build_output_role: value.build_output_role,
      source_closure_paths: sourcePaths,
      runtime_version: value.builder_runtime_identity.runtime_version,
      operating_system: value.builder_runtime_identity.operating_system,
      architecture: value.builder_runtime_identity.architecture,
      locale: value.builder_runtime_identity.locale,
      timezone: value.builder_runtime_identity.timezone,
      archive_profile_id: value.archive_metadata_normalization_profile.profile_id,
      build_output_path: value.build_output_artifact.path,
    },
    label,
  );
}

function compatibilityDigest(requirementId, designation, bindingBundleDigest) {
  return domainDigest(COMPATIBILITY_DEFINITIONS[requirementId], [
    ['designation_subject_commit', designation.subject_commit],
    ['designation_subject_digest_domain', designation.subject_digest_domain],
    ['designation_subject_digest', designation.subject_digest],
    ['binding_bundle_digest', bindingBundleDigest],
    ['compatibility_requirement_id', requirementId],
  ]);
}

export function validateB2Transition({
  baselineR0,
  successor,
  r0Commit,
  r0SubjectDigest,
  artifactReader = null,
  expectedDesignationBinding,
}) {
  assertCommit(r0Commit, 'B2 R0 commit');
  assertSha256(r0SubjectDigest, 'B2 R0 subject digest');
  validateTopLevelTransition(baselineR0, successor, 'B2');
  assert(successor.candidate_status === 'complete_candidate_pending_final_manifest_freeze', 'B2 candidate_status');
  assertExactArray(successor.global_blockers, B2_BLOCKERS, 'B2 global_blockers');
  assertBlockerAccounting(
    successor.blocker_accounting,
    baselineR0.blocker_accounting.historical_v1_migration,
    0,
    145,
    'B2 blocker_accounting',
  );
  assertMaterialization(
    successor.materialization,
    {
      stageId: 'B2_post_designation_binding_successor',
      baselineCommit: r0Commit,
      baselineSubjectDigest: r0SubjectDigest,
      resolvedCount: 145,
      pendingCount: 0,
    },
    'B2 materialization',
  );
  assertDesignationBinding(successor.designation_decision_binding, r0Commit, 'B2 designation_decision_binding');
  assert(expectedDesignationBinding, 'B2 requires a live-validated expected D1 designation binding');
  assertDeepEqual(
    successor.designation_decision_binding,
    expectedDesignationBinding,
    'B2 designation_decision_binding live receipt equality',
  );

  const baselineRegistry = baselineR0.current_requirement_registry;
  const registry = successor.current_requirement_registry;
  assertDeepEqual(
    cloneWithout(registry, ['status', 'requirements_by_id', 'pending_requirement_count', 'inventory_digest', 'authority']),
    cloneWithout(baselineRegistry, ['status', 'requirements_by_id', 'pending_requirement_count', 'inventory_digest', 'authority']),
    'B2 current registry immutable structure',
  );
  assert(registry.status === 'typed_requirements_resolved_pending_manifest_freeze', 'B2 registry status');
  assert(registry.pending_requirement_count === 0, 'B2 registry pending count');
  const ids = Object.keys(baselineRegistry.requirements_by_id);
  assertExactArray(Object.keys(registry.requirements_by_id), ids, 'B2 requirement ID order');
  for (const requirementId of ids) {
    const baselineRequirement = baselineRegistry.requirements_by_id[requirementId];
    const requirement = registry.requirements_by_id[requirementId];
    if (POST_DESIGNATION_SET.has(requirementId)) {
      validateResolvedRequirement(requirement, baselineRequirement, {
        label: `B2 requirement ${requirementId}`,
        artifactReader,
      });
    } else {
      assertDeepEqual(requirement, baselineRequirement, `B2 immutable R0 requirement ${requirementId}`);
    }
  }

  const designation = successor.designation_decision_binding;
  const build = registry.requirements_by_id['build-cp-ba-browser-documents'].resolved_value.value;
  assertBuildValue(build, designation, 'B2 build value', artifactReader);
  const windows = ['window-cp-ba', 'window-cp-cs', 'window-cp-web'].map((requirementId) => {
    const value = registry.requirements_by_id[requirementId].resolved_value.value;
    assertWindowValue(value, requirementId, `B2 ${requirementId}`);
    return [requirementId, value];
  });
  const bundleSubject = [
    ['designation_subject_commit', designation.subject_commit],
    ['designation_subject_digest_domain', designation.subject_digest_domain],
    ['designation_subject_digest', designation.subject_digest],
    ['designated_cohort_id', designation.designated_cohort_id],
    ['designated_cohort_sha256', designation.designated_cohort_sha256],
    ['designation_approval_instance_digest', designation.approval_instance_digest],
    ['build-cp-ba-browser-documents', build],
    ...windows,
  ];
  const bindingBundleDigest = domainDigest(BINDING_BUNDLE_DOMAIN, bundleSubject);
  const compatibility = {};
  for (const requirementId of Object.keys(COMPATIBILITY_DEFINITIONS)) {
    const actual = registry.requirements_by_id[requirementId].resolved_value.value;
    const expected = compatibilityDigest(requirementId, designation, bindingBundleDigest);
    assert(actual === expected, `B2 ${requirementId} must be recomputed from the typed DAG`);
    compatibility[requirementId] = actual;
  }
  const cpBaMapDigest = domainDigest(CP_BA_MAP_DOMAIN, [
    ['compatibility-cp-ba-platform-browser', compatibility['compatibility-cp-ba-platform-browser']],
    ['compatibility-cp-ba-shared-formal', compatibility['compatibility-cp-ba-shared-formal']],
    ['compatibility-cp-ba-shared-managed', compatibility['compatibility-cp-ba-shared-managed']],
  ]);
  assertExactKeys(
    successor.binding_metadata,
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
    'B2 binding_metadata',
  );
  const expectedMetadata = {
    designation_subject_commit: designation.subject_commit,
    designation_subject_digest_domain: designation.subject_digest_domain,
    designation_subject_digest: designation.subject_digest,
    designated_cohort_id: designation.designated_cohort_id,
    designated_cohort_sha256: designation.designated_cohort_sha256,
    designation_approval_instance_digest: designation.approval_instance_digest,
    build_source_closure_digest: build.source_closure_digest,
    binding_bundle_digest: bindingBundleDigest,
    cp_ba_compatibility_map_digest: cpBaMapDigest,
  };
  assertDeepEqual(successor.binding_metadata, expectedMetadata, 'B2 binding_metadata source equality');
  const inventoryDigest = assertRegistryCommon(registry, 'B2 current requirement registry');
  return {
    schema_version: 'mobile-ux-batch1-successor-validation.v1',
    status: 'passed',
    stage: 'B2',
    resolved_requirement_count: 145,
    pending_requirement_count: 0,
    pending_requirement_ids: [],
    inventory_digest: inventoryDigest,
    binding_bundle_digest: bindingBundleDigest,
    cp_ba_compatibility_map_digest: cpBaMapDigest,
    build_verification_scope: 'descriptor_and_tracked_hash_binding_only',
    build_recipe_executed: false,
    build_output_rebuilt: false,
    build_reproducibility_proven: false,
    hermetic_replay_proven: false,
    gate_effect: 'none',
    authority: ALL_FALSE_AUTHORITY,
    manifest_root_required_state: 'absent',
  };
}

export function subjectDigestFromArtifacts(domain, records) {
  assertNonEmptyString(domain, 'subject digest domain');
  assert(Array.isArray(records) && records.length === BATCH1_SUBJECT_PATHS.length, 'subject needs five records');
  const paths = records.map((record, index) => {
    assertArtifactRecord(record, `subject artifact record[${index}]`);
    return record.path;
  });
  assertExactArray(paths, BATCH1_SUBJECT_PATHS, 'subject artifact path order');
  const tuples = records.map((record) => [
    ['path', record.path],
    ['git_mode', record.git_mode],
    ['byte_length', record.byte_length],
    ['raw_sha256', record.raw_sha256],
  ]);
  return domainDigest(domain, tuples);
}

export function schemaSubjectDigestFromBytes(artifactBytesByPath) {
  const chunks = [Buffer.from(`${SUBJECT_DIGEST_DOMAINS.schema}\0`, 'utf8')];
  for (const relativePath of BATCH1_SUBJECT_PATHS) {
    const bytes = artifactBytesByPath.get(relativePath);
    assert(Buffer.isBuffer(bytes), `schema subject is missing ${relativePath}`);
    chunks.push(
      Buffer.from(
        `${Buffer.byteLength(relativePath)}:${relativePath}\0${bytes.length}:`,
        'utf8',
      ),
    );
    chunks.push(bytes, Buffer.from('\0', 'utf8'));
  }
  return sha256(Buffer.concat(chunks));
}
