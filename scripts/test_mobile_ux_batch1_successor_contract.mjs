#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ALL_FALSE_AUTHORITY,
  POST_DESIGNATION_REQUIREMENT_IDS,
  SCHEMA_SUBJECT_DIGEST,
  RESOLVER_ROLES_BY_SOURCE_CLASS,
  canonicalJson,
  domainDigest,
  sha256,
  validateB2Transition,
  validateR0Transition,
  validateResolvedRequirement,
} from './lib/mobile_ux_batch1_successor_contract.mjs';

const LEGACY_AUTHORITY = Object.freeze({
  freeze: false,
  provision: false,
  execution: false,
  evidence: false,
  aggregation: false,
  promotion: false,
  visual: false,
  implementation: false,
  native: false,
  release: false,
});

const CURRENT_COMMIT = '1'.repeat(40);
const R0_COMMIT = '2'.repeat(40);
const D1_APPROVAL_HEAD = '4'.repeat(40);
const R0_SUBJECT_DIGEST = '3'.repeat(64);
const ARTIFACT_BYTES = new Map([
  ['docs/source.json', Buffer.from('{"source":true}\n')],
  ['scripts/build_mobile_ux_batch1_cp_ba_browser_documents.mjs', Buffer.from('build\n')],
  ['apps/mobile/package-lock.json', Buffer.from('{"lockfileVersion":3}\n')],
  ['artifacts/mobile-ux-batch1/cp-ba-browser-documents.tar', Buffer.from('deterministic-tar')],
]);

function artifactRecord(relativePath) {
  const bytes = ARTIFACT_BYTES.get(relativePath);
  assert(bytes, `fixture artifact missing: ${relativePath}`);
  return {
    path: relativePath,
    git_mode: '100644',
    byte_length: bytes.length,
    raw_sha256: sha256(bytes),
  };
}

function artifactReader(relativePath) {
  const bytes = ARTIFACT_BYTES.get(relativePath);
  if (!bytes) throw new Error(`fixture artifact missing: ${relativePath}`);
  return {gitMode: '100644', bytes};
}

function valueEnvelope(valueClass, value) {
  return {
    schema_version: 'mobile-ux-batch1-resolved-value.v1',
    value_class: valueClass,
    value,
    value_sha256: domainDigest('softbook-cet/mobile-ux-batch1-resolved-value/v1', value),
  };
}

function provenance(sourceClass, options = {}) {
  const local = ['repository_artifact', 'deterministic_derivation'].includes(sourceClass);
  const defaultRole = {
    repository_artifact: 'repository_semantic_resolver',
    protected_owner_decision: 'protected_product_owner',
    protected_human_confirmation: 'confirmed_operator',
    verified_external_resource: 'external_resource_verifier',
    deterministic_derivation: 'deterministic_builder',
  }[sourceClass];
  return {
    schema_version: 'mobile-ux-batch1-resolution-provenance.v1',
    source_class: sourceClass,
    source_ref: options.sourceRef ?? 'repo://docs/source.json',
    source_event_sha256: local ? null : options.sourceEventSha256 ?? '4'.repeat(64),
    source_artifact_records: options.records ?? (local ? [artifactRecord('docs/source.json')] : []),
    resolver_role: options.resolverRole ?? defaultRole,
    effective_at: '2026-08-10T00:00:00Z',
    expires_at: '2026-09-01T00:00:00Z',
    gate_eligible: false,
  };
}

function baselineRequirement(requirementId, overrides = {}) {
  return {
    requirement_id: requirementId,
    requirement_kind: overrides.requirementKind ?? 'target',
    subject_discriminator: {requirement_id: requirementId},
    source_binding: {
      path: 'docs/source.json',
      locator_kind: 'json_pointer',
      locator: '/source',
      raw_sha256: sha256(ARTIFACT_BYTES.get('docs/source.json')),
    },
    allowed_value_class: overrides.valueClass ?? 'repository_semantic_mapping_subject',
    pending_value_ref: null,
    pending_values: [],
    status: 'typed_value_pending',
    authority: LEGACY_AUTHORITY,
  };
}

function deferredRequirement(requirementId) {
  if (requirementId === 'build-cp-ba-browser-documents') {
    return baselineRequirement(requirementId, {
      requirementKind: 'build',
      valueClass: 'designation_bound_source_closure_build_value_v1',
    });
  }
  if (requirementId.startsWith('window-')) {
    return baselineRequirement(requirementId, {
      requirementKind: 'execution_window',
      valueClass: 'canonical_utc_execution_window_value_v1',
    });
  }
  return baselineRequirement(requirementId, {
    requirementKind: 'compatibility',
    valueClass: 'deterministic_compatibility_sha256_value_v1',
  });
}

function makeBaseline() {
  const requirements = {};
  for (let index = 0; index < 136; index += 1) {
    const id = `r0-${String(index).padStart(3, '0')}`;
    requirements[id] = baselineRequirement(id);
  }
  for (const requirementId of POST_DESIGNATION_REQUIREMENT_IDS) {
    requirements[requirementId] = deferredRequirement(requirementId);
  }
  const inventoryDomain = 'mobile-ux-batch1-current-requirement-registry.v1';
  return {
    schema_version: 'mobile-ux-batch1-registry-set.v2.proposal',
    candidate_status: 'candidate_incomplete',
    global_blockers: ['fixture-current-blocker'],
    blocker_accounting: {
      historical_v1_migration: {
        physical_instance_count: 115,
        resolved_instance_count: 1,
        remaining_historical_instance_count: 114,
        not_current_registry_count: true,
      },
      current_v2_typed_requirements: {
        pending_requirement_count: 145,
        source_ref: '#/current_requirement_registry',
        separate_from_historical_migration: true,
      },
    },
    current_requirement_registry: {
      registry_id: 'mobile-ux-batch1-current-typed-requirements-v1',
      status: 'typed_requirements_defined_values_pending',
      requirements_by_id: requirements,
      requirement_count: 145,
      pending_requirement_count: 145,
      lane_binding_count: 1,
      aggregate_binding_count: 1,
      lane_binding_index: [{lane_id: 'fixture'}],
      aggregate_bindings: [{aggregate_id: 'fixture'}],
      inventory_digest_domain_separator: inventoryDomain,
      inventory_digest: sha256(Buffer.from(`${inventoryDomain}\0${JSON.stringify(requirements)}`)),
      authority: LEGACY_AUTHORITY,
    },
    successor_transition_contract: {digest: 'immutable-fixture'},
    authority: LEGACY_AUTHORITY,
  };
}

function resolveRepositoryRecord(record) {
  const result = structuredClone(record);
  result.status = 'typed_value_resolved';
  result.authority = ALL_FALSE_AUTHORITY;
  const value = {mapping_id: record.requirement_id};
  result.resolved_value = valueEnvelope(record.allowed_value_class, value);
  result.resolution_provenance = provenance('repository_artifact');
  return result;
}

function recalculateInventory(registry) {
  registry.inventory_digest = sha256(
    Buffer.from(
      `${registry.inventory_digest_domain_separator}\0${JSON.stringify(registry.requirements_by_id)}`,
    ),
  );
}

function makeR0(baseline) {
  const r0 = structuredClone(baseline);
  r0.candidate_status = 'resolution_successor_candidate_incomplete';
  r0.global_blockers = [
    'protected_cohort_designation_missing',
    'post_designation_build_windows_and_compatibility_bindings_missing',
    'future_manifest_freeze_decision_missing',
    'exact_compatibility_keys_missing',
    'execution_manifest_subtree_must_remain_absent',
  ];
  r0.blocker_accounting.current_v2_typed_requirements = {
    pending_requirement_count: 9,
    resolved_requirement_count: 136,
    source_ref: '#/current_requirement_registry',
    separate_from_historical_migration: true,
  };
  r0.authority = ALL_FALSE_AUTHORITY;
  r0.materialization = {
    schema_version: 'mobile-ux-batch1-materialization.v1',
    stage_id: 'R0_resolution_successor',
    baseline_commit: CURRENT_COMMIT,
    baseline_subject_digest: SCHEMA_SUBJECT_DIGEST,
    resolved_requirement_count: 136,
    pending_requirement_count: 9,
    gate_effect: 'none',
    authority: ALL_FALSE_AUTHORITY,
  };
  const registry = r0.current_requirement_registry;
  registry.status = 'typed_requirements_partially_resolved_pre_designation';
  registry.pending_requirement_count = 9;
  registry.authority = ALL_FALSE_AUTHORITY;
  for (const [requirementId, requirement] of Object.entries(registry.requirements_by_id)) {
    if (POST_DESIGNATION_REQUIREMENT_IDS.includes(requirementId)) {
      requirement.authority = ALL_FALSE_AUTHORITY;
    } else {
      registry.requirements_by_id[requirementId] = resolveRepositoryRecord(requirement);
    }
  }
  recalculateInventory(registry);
  return r0;
}

function designationBinding() {
  const value = {
    decision_artifact_path:
      'docs/design/decisions/mobile-ux-batch1-cohort-designation-v1.json',
    receipt_path:
      'docs/design/decisions/mobile-ux-batch1-cohort-designation-v1.approval-receipt.json',
    approval_target_head_sha: D1_APPROVAL_HEAD,
    receipt_materialization_commit_sha: '5'.repeat(40),
    receipt_materialization_pull_request: 486,
    subject_commit: R0_COMMIT,
    subject_digest_domain: 'softbook-cet/mobile-ux-batch1-designation-subject/v1',
    subject_digest: R0_SUBJECT_DIGEST,
    designated_cohort_id: 'cet4-abcdefghijklmnopqrstuvwxyz',
    designated_cohort_sha256: '',
    approval_instance_digest: '6'.repeat(64),
  };
  value.designated_cohort_sha256 = domainDigest(
    'softbook-cet/mobile-ux-batch1-designated-cohort/v1',
    [
      ['designation_subject_commit', value.subject_commit],
      ['designation_subject_digest_domain', value.subject_digest_domain],
      ['designation_subject_digest', value.subject_digest],
      ['designated_cohort_id', value.designated_cohort_id],
    ],
  );
  return value;
}

function buildValue(designation) {
  const sourceRecords = [
    artifactRecord('apps/mobile/package-lock.json'),
    artifactRecord('scripts/build_mobile_ux_batch1_cp_ba_browser_documents.mjs'),
  ].sort((a, b) => a.path.localeCompare(b.path));
  const closureDigest = domainDigest(
    'softbook-cet/mobile-ux-batch1-build-source-closure/v1',
    sourceRecords.map((record) => [
      ['path', record.path],
      ['git_mode', record.git_mode],
      ['byte_length', record.byte_length],
      ['raw_sha256', record.raw_sha256],
    ]),
  );
  return {
    designation_subject_commit: designation.subject_commit,
    designation_subject_digest_domain: designation.subject_digest_domain,
    designation_subject_digest: designation.subject_digest,
    designated_cohort_id: designation.designated_cohort_id,
    designated_cohort_sha256: designation.designated_cohort_sha256,
    designation_approval_instance_digest: designation.approval_instance_digest,
    build_recipe_id: 'cp-ba-browser-documents-hermetic-build-v1',
    build_recipe_raw_sha256: artifactRecord(
      'scripts/build_mobile_ux_batch1_cp_ba_browser_documents.mjs',
    ).raw_sha256,
    toolchain_lock_raw_sha256: artifactRecord('apps/mobile/package-lock.json').raw_sha256,
    build_output_role: 'cp-ba-browser-documents',
    source_closure_records: sourceRecords,
    source_closure_digest: closureDigest,
    builder_runtime_identity: {
      builder_image_digest: `sha256:${'7'.repeat(64)}`,
      runtime_version: 'node-v22.13.0',
      operating_system: 'linux',
      architecture: 'x86_64',
      locale: 'C.UTF-8',
      timezone: 'UTC',
    },
    archive_metadata_normalization_profile: {
      profile_id: 'ustar-portable-zero-metadata-v1',
      entry_order: 'normalized_path_utf8_ascending',
      mtime_epoch_seconds: 0,
      uid: 0,
      gid: 0,
      uname: '',
      gname: '',
      file_mode: '0644',
      directory_mode: '0755',
    },
    build_output_artifact: artifactRecord(
      'artifacts/mobile-ux-batch1/cp-ba-browser-documents.tar',
    ),
  };
}

function windowValue(requirementId, offsetHours) {
  const value = {
    window_requirement_id: requirementId,
    start_at_utc: `2026-08-1${1 + offsetHours}T01:00:00Z`,
    end_at_utc: `2026-08-1${1 + offsetHours}T02:00:00Z`,
    expires_at_utc: `2026-08-1${1 + offsetHours}T03:00:00Z`,
    schedule_issuer_authority_ref: 'github://LENKIN233/softbook_cet/owner-schedule',
    schedule_issuer_principal_pseudonym: `hmac-sha256:${String(offsetHours + 8).repeat(64).slice(0, 64)}`,
    schedule_issued_at_utc: '2026-08-10T00:00:00Z',
    schedule_event_ref: `github://LENKIN233/softbook_cet/schedule/${requirementId}`,
    schedule_event_sha256: '',
  };
  value.schedule_event_sha256 = domainDigest(
    'softbook-cet/mobile-ux-batch1-protected-schedule-event/v1',
    [
      ['window_requirement_id', value.window_requirement_id],
      ['start_at_utc', value.start_at_utc],
      ['end_at_utc', value.end_at_utc],
      ['expires_at_utc', value.expires_at_utc],
      ['schedule_issuer_authority_ref', value.schedule_issuer_authority_ref],
      ['schedule_issuer_principal_pseudonym', value.schedule_issuer_principal_pseudonym],
      ['schedule_issued_at_utc', value.schedule_issued_at_utc],
      ['schedule_event_ref', value.schedule_event_ref],
    ],
  );
  return value;
}

function resolveDeferred(record, value, sourceClass = 'deterministic_derivation') {
  const result = structuredClone(record);
  result.status = 'typed_value_resolved';
  result.authority = ALL_FALSE_AUTHORITY;
  result.resolved_value = valueEnvelope(result.allowed_value_class, value);
  const records = sourceClass === 'deterministic_derivation'
    ? [
        artifactRecord('apps/mobile/package-lock.json'),
        artifactRecord('scripts/build_mobile_ux_batch1_cp_ba_browser_documents.mjs'),
        artifactRecord('artifacts/mobile-ux-batch1/cp-ba-browser-documents.tar'),
      ]
    : [];
  result.resolution_provenance = provenance(sourceClass, {
    sourceRef: sourceClass === 'protected_owner_decision' ? 'github://schedule/verified' : 'repo://deterministic-build',
    records,
    resolverRole: sourceClass === 'protected_owner_decision' ? 'protected_product_owner' : 'deterministic_builder',
  });
  return result;
}

function makeB2(r0) {
  const b2 = structuredClone(r0);
  b2.candidate_status = 'complete_candidate_pending_final_manifest_freeze';
  b2.global_blockers = [
    'future_manifest_freeze_decision_missing',
    'execution_manifest_subtree_must_remain_absent',
  ];
  b2.blocker_accounting.current_v2_typed_requirements = {
    pending_requirement_count: 0,
    resolved_requirement_count: 145,
    source_ref: '#/current_requirement_registry',
    separate_from_historical_migration: true,
  };
  b2.materialization = {
    schema_version: 'mobile-ux-batch1-materialization.v1',
    stage_id: 'B2_post_designation_binding_successor',
    baseline_commit: R0_COMMIT,
    baseline_subject_digest: R0_SUBJECT_DIGEST,
    resolved_requirement_count: 145,
    pending_requirement_count: 0,
    gate_effect: 'none',
    authority: ALL_FALSE_AUTHORITY,
  };
  const designation = designationBinding();
  b2.designation_decision_binding = designation;
  const registry = b2.current_requirement_registry;
  registry.status = 'typed_requirements_resolved_pending_manifest_freeze';
  registry.pending_requirement_count = 0;
  const build = buildValue(designation);
  registry.requirements_by_id['build-cp-ba-browser-documents'] = resolveDeferred(
    registry.requirements_by_id['build-cp-ba-browser-documents'],
    build,
  );
  const windows = {};
  for (const [index, id] of ['window-cp-ba', 'window-cp-cs', 'window-cp-web'].entries()) {
    windows[id] = windowValue(id, index);
    registry.requirements_by_id[id] = resolveDeferred(
      registry.requirements_by_id[id],
      windows[id],
      'protected_owner_decision',
    );
  }
  const bundleDigest = domainDigest(
    'softbook-cet/mobile-ux-batch1-binding-bundle/v1',
    [
      ['designation_subject_commit', designation.subject_commit],
      ['designation_subject_digest_domain', designation.subject_digest_domain],
      ['designation_subject_digest', designation.subject_digest],
      ['designated_cohort_id', designation.designated_cohort_id],
      ['designated_cohort_sha256', designation.designated_cohort_sha256],
      ['designation_approval_instance_digest', designation.approval_instance_digest],
      ['build-cp-ba-browser-documents', build],
      ['window-cp-ba', windows['window-cp-ba']],
      ['window-cp-cs', windows['window-cp-cs']],
      ['window-cp-web', windows['window-cp-web']],
    ],
  );
  const domains = {
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
  };
  const outputs = {};
  for (const [id, domain] of Object.entries(domains)) {
    outputs[id] = domainDigest(domain, [
      ['designation_subject_commit', designation.subject_commit],
      ['designation_subject_digest_domain', designation.subject_digest_domain],
      ['designation_subject_digest', designation.subject_digest],
      ['binding_bundle_digest', bundleDigest],
      ['compatibility_requirement_id', id],
    ]);
    registry.requirements_by_id[id] = resolveDeferred(
      registry.requirements_by_id[id],
      outputs[id],
    );
  }
  const cpBaMap = domainDigest('softbook-cet/mobile-ux-batch1-compatibility-map/cp-ba/v1', [
    ['compatibility-cp-ba-platform-browser', outputs['compatibility-cp-ba-platform-browser']],
    ['compatibility-cp-ba-shared-formal', outputs['compatibility-cp-ba-shared-formal']],
    ['compatibility-cp-ba-shared-managed', outputs['compatibility-cp-ba-shared-managed']],
  ]);
  b2.binding_metadata = {
    designation_subject_commit: designation.subject_commit,
    designation_subject_digest_domain: designation.subject_digest_domain,
    designation_subject_digest: designation.subject_digest,
    designated_cohort_id: designation.designated_cohort_id,
    designated_cohort_sha256: designation.designated_cohort_sha256,
    designation_approval_instance_digest: designation.approval_instance_digest,
    build_source_closure_digest: build.source_closure_digest,
    binding_bundle_digest: bundleDigest,
    cp_ba_compatibility_map_digest: cpBaMap,
  };
  recalculateInventory(registry);
  return b2;
}

function sourceClassRequirementFixture(sourceClass) {
  const configurations = {
    repository_artifact: {
      requirementKind: 'target',
      valueClass: 'repository_semantic_mapping_subject',
      value: {mapping_id: 'fixture'},
    },
    protected_owner_decision: {
      requirementKind: 'target',
      valueClass: 'exact_product_profile_subject',
      value: {profile_id: 'fixture'},
    },
    protected_human_confirmation: {
      requirementKind: 'target',
      valueClass: 'human_role_confirmation_contract',
      value: {
        role_requirement_id: `source-${sourceClass}`,
        campaign_scoped_principal_pseudonym: `hmac-sha256:${'8'.repeat(64)}`,
        confirmation_event_sha256: '9'.repeat(64),
        real_identity_persisted: false,
      },
    },
    verified_external_resource: {
      requirementKind: 'account',
      valueClass: 'receiver_or_owner_supplied_typed_value',
      value: {resource_id: 'fixture'},
    },
    deterministic_derivation: {
      requirementKind: 'compatibility',
      valueClass: 'deterministic_compatibility_sha256_value_v1',
      value: 'b'.repeat(64),
    },
  };
  const configuration = configurations[sourceClass];
  const requirementId = `source-${sourceClass}`;
  const baseline = baselineRequirement(requirementId, configuration);
  const successor = structuredClone(baseline);
  successor.status = 'typed_value_resolved';
  successor.authority = ALL_FALSE_AUTHORITY;
  successor.resolved_value = valueEnvelope(configuration.valueClass, configuration.value);
  successor.resolution_provenance = provenance(sourceClass);
  return {baseline, successor};
}

test('canonical JSON and domain digests ignore object property order', () => {
  assert.equal(canonicalJson({b: 2, a: 1}), canonicalJson({a: 1, b: 2}));
  assert.equal(domainDigest('fixture/v1', {b: 2, a: 1}), domainDigest('fixture/v1', {a: 1, b: 2}));
});

test('every provenance source class enforces its schema resolver-role mapping', async (t) => {
  const knownWrongRole = {
    repository_artifact: 'deterministic_builder',
    protected_owner_decision: 'external_resource_verifier',
    protected_human_confirmation: 'protected_product_owner',
    verified_external_resource: 'confirmed_operator',
    deterministic_derivation: 'repository_semantic_resolver',
  };
  for (const [sourceClass, allowedRoles] of Object.entries(RESOLVER_ROLES_BY_SOURCE_CLASS)) {
    await t.test(sourceClass, () => {
      const fixture = sourceClassRequirementFixture(sourceClass);
      assert.doesNotThrow(() => validateResolvedRequirement(
        fixture.successor,
        fixture.baseline,
        {artifactReader},
      ));
      for (const invalidRole of [knownWrongRole[sourceClass], 'unknown_resolver_role']) {
        const forged = structuredClone(fixture.successor);
        forged.resolution_provenance.resolver_role = invalidRole;
        assert.equal(allowedRoles.includes(invalidRole), false);
        assert.throws(
          () => validateResolvedRequirement(forged, fixture.baseline, {artifactReader}),
          /resolver_role is not allowed for source_class/,
        );
      }
    });
  }
});

test('PII scanning rejects semantic identifiers before role mapping without treating validated digests as phone numbers', async (t) => {
  await t.test('validated compatibility digest containing an 11-digit run is opaque', () => {
    const fixture = sourceClassRequirementFixture('deterministic_derivation');
    const digestWithPhoneLikeRun = `a13812345678b${'c'.repeat(51)}`;
    assert.equal(digestWithPhoneLikeRun.length, 64);
    fixture.successor.resolved_value.value = digestWithPhoneLikeRun;
    fixture.successor.resolved_value.value_sha256 = domainDigest(
      'softbook-cet/mobile-ux-batch1-resolved-value/v1',
      digestWithPhoneLikeRun,
    );
    assert.doesNotThrow(() => validateResolvedRequirement(
      fixture.successor,
      fixture.baseline,
      {artifactReader},
    ));
  });

  await t.test('raw phone in a semantic value is still rejected', () => {
    const fixture = sourceClassRequirementFixture('repository_artifact');
    fixture.successor.resolved_value.value = {mapping_id: '13812345678'};
    fixture.successor.resolved_value.value_sha256 = domainDigest(
      'softbook-cet/mobile-ux-batch1-resolved-value/v1',
      fixture.successor.resolved_value.value,
    );
    assert.throws(
      () => validateResolvedRequirement(fixture.successor, fixture.baseline, {artifactReader}),
      /forbidden mainland phone number/,
    );
  });

  await t.test('email resolver role is rejected as PII before enum mapping', () => {
    const fixture = sourceClassRequirementFixture('repository_artifact');
    fixture.successor.resolution_provenance.resolver_role = 'learner@example.com';
    assert.throws(
      () => validateResolvedRequirement(fixture.successor, fixture.baseline, {artifactReader}),
      /forbidden email address/,
    );
  });
});

test('valid R0 resolves exactly 136 and leaves the fixed nine pending', () => {
  const baseline = makeBaseline();
  const result = validateR0Transition({
    baseline,
    successor: makeR0(baseline),
    baselineCommit: CURRENT_COMMIT,
    artifactReader,
  });
  assert.equal(result.stage, 'R0');
  assert.equal(result.resolved_requirement_count, 136);
  assert.equal(result.pending_requirement_count, 9);
  assert.deepEqual(result.pending_requirement_ids, POST_DESIGNATION_REQUIREMENT_IDS);
  assert.deepEqual(result.authority, ALL_FALSE_AUTHORITY);
});

test('R0 fails closed on deferred resolution, missing resolution, authority, and immutable drift', async t => {
  const cases = [
    {
      name: 'deferred requirement resolved early',
      mutate: (r0) => {
        const id = POST_DESIGNATION_REQUIREMENT_IDS[0];
        r0.current_requirement_registry.requirements_by_id[id] = resolveRepositoryRecord(
          r0.current_requirement_registry.requirements_by_id[id],
        );
      },
      error: /deferred requirement/,
    },
    {
      name: 'pre-designation requirement remains pending',
      mutate: (r0, baseline) => {
        r0.current_requirement_registry.requirements_by_id['r0-000'] = structuredClone(
          baseline.current_requirement_registry.requirements_by_id['r0-000'],
        );
        r0.current_requirement_registry.requirements_by_id['r0-000'].authority = ALL_FALSE_AUTHORITY;
      },
      error: /resolved_value|keys must equal/,
    },
    {
      name: 'positive authority',
      mutate: (r0) => {
        r0.authority = {...ALL_FALSE_AUTHORITY, visual: true};
      },
      error: /visual must be false/,
    },
    {
      name: 'immutable transition contract drift',
      mutate: (r0) => {
        r0.successor_transition_contract.digest = 'changed';
      },
      error: /non-materialization top-level content/,
    },
  ];
  for (const item of cases) {
    await t.test(item.name, () => {
      const baseline = makeBaseline();
      const r0 = makeR0(baseline);
      item.mutate(r0, baseline);
      recalculateInventory(r0.current_requirement_registry);
      assert.throws(
        () =>
          validateR0Transition({
            baseline,
            successor: r0,
            baselineCommit: CURRENT_COMMIT,
            artifactReader,
          }),
        item.error,
      );
    });
  }
});

test('R0 rejects stale value digests, PII, unbound provenance, and overlong validity', async t => {
  const cases = [
    {
      name: 'stale value digest',
      mutate: (record) => {
        record.resolved_value.value_sha256 = '0'.repeat(64);
      },
      error: /value_sha256 must be recomputed/,
    },
    {
      name: 'email leak',
      mutate: (record) => {
        record.resolved_value.value = {mapping_id: 'learner@example.com'};
        record.resolved_value.value_sha256 = domainDigest(
          'softbook-cet/mobile-ux-batch1-resolved-value/v1',
          record.resolved_value.value,
        );
      },
      error: /forbidden email address/,
    },
    {
      name: 'email leak in a resolved-value object key',
      mutate: (record) => {
        record.resolved_value.value = {'learner@example.com': 'ok'};
        record.resolved_value.value_sha256 = domainDigest(
          'softbook-cet/mobile-ux-batch1-resolved-value/v1',
          record.resolved_value.value,
        );
      },
      error: /forbidden email address/,
    },
    {
      name: 'email leak in provenance resolver role',
      mutate: (record) => {
        record.resolution_provenance.resolver_role = 'learner@example.com';
      },
      error: /forbidden email address/,
    },
    {
      name: 'self-asserted event source',
      mutate: (record) => {
        record.resolution_provenance.source_class = 'protected_owner_decision';
      },
      error: /source_class is not allowed/,
    },
    {
      name: 'provenance past provider retention',
      mutate: (record) => {
        record.resolution_provenance.expires_at = '2027-08-10T00:00:00Z';
      },
      error: /90-day remote-verification ceiling/,
    },
    {
      name: 'invalid calendar date normalized by Date.parse',
      mutate: (record) => {
        record.resolution_provenance.effective_at = '2026-02-30T00:00:00Z';
      },
      error: /canonical real UTC timestamp/,
    },
  ];
  for (const item of cases) {
    await t.test(item.name, () => {
      const baseline = makeBaseline();
      const r0 = makeR0(baseline);
      item.mutate(r0.current_requirement_registry.requirements_by_id['r0-000']);
      recalculateInventory(r0.current_requirement_registry);
      assert.throws(
        () =>
          validateR0Transition({
            baseline,
            successor: r0,
            baselineCommit: CURRENT_COMMIT,
            artifactReader,
          }),
        item.error,
      );
    });
  }
});

test('valid B2 preserves all 136 R0 records and derives the nine-value DAG', () => {
  const baseline = makeBaseline();
  const r0 = makeR0(baseline);
  const b2 = makeB2(r0);
  const result = validateB2Transition({
    baselineR0: r0,
    successor: b2,
    r0Commit: R0_COMMIT,
    r0SubjectDigest: R0_SUBJECT_DIGEST,
    artifactReader,
    expectedDesignationBinding: designationBinding(),
  });
  assert.equal(result.stage, 'B2');
  assert.equal(result.resolved_requirement_count, 145);
  assert.equal(result.pending_requirement_count, 0);
  assert.equal(result.build_verification_scope, 'descriptor_and_tracked_hash_binding_only');
  assert.equal(result.build_recipe_executed, false);
  assert.equal(result.build_output_rebuilt, false);
  assert.equal(result.build_reproducibility_proven, false);
  assert.equal(result.hermetic_replay_proven, false);
  assert.match(result.binding_bundle_digest, /^[0-9a-f]{64}$/);
  assert.match(result.cp_ba_compatibility_map_digest, /^[0-9a-f]{64}$/);
});

test('B2 rejects R0 drift, cached compatibility, source-closure drift, and recursive metadata', async t => {
  const cases = [
    {
      name: 'one of 136 immutable values drifts',
      mutate: (b2) => {
        b2.current_requirement_registry.requirements_by_id['r0-000'].resolved_value.value = {
          mapping_id: 'changed',
        };
      },
      error: /immutable R0 requirement/,
    },
    {
      name: 'compatibility is caller supplied',
      mutate: (b2) => {
        const record = b2.current_requirement_registry.requirements_by_id[
          'compatibility-cp-web-aggregate'
        ];
        record.resolved_value.value = 'f'.repeat(64);
        record.resolved_value.value_sha256 = domainDigest(
          'softbook-cet/mobile-ux-batch1-resolved-value/v1',
          record.resolved_value.value,
        );
      },
      error: /typed DAG/,
    },
    {
      name: 'source closure digest is stale',
      mutate: (b2) => {
        const build = b2.current_requirement_registry.requirements_by_id[
          'build-cp-ba-browser-documents'
        ].resolved_value.value;
        build.source_closure_digest = 'e'.repeat(64);
        const record = b2.current_requirement_registry.requirements_by_id[
          'build-cp-ba-browser-documents'
        ];
        record.resolved_value.value_sha256 = domainDigest(
          'softbook-cet/mobile-ux-batch1-resolved-value/v1',
          build,
        );
      },
      error: /source_closure_digest/,
    },
    {
      name: 'descriptor cannot self-assert build reproducibility',
      mutate: (b2) => {
        const record = b2.current_requirement_registry.requirements_by_id[
          'build-cp-ba-browser-documents'
        ];
        record.resolved_value.value.build_reproducibility_proven = true;
        record.resolved_value.value_sha256 = domainDigest(
          'softbook-cet/mobile-ux-batch1-resolved-value/v1',
          record.resolved_value.value,
        );
      },
      error: /keys must equal/,
    },
    {
      name: 'binding metadata self-input is not accepted',
      mutate: (b2) => {
        b2.binding_metadata.binding_bundle_digest = b2.binding_metadata.cp_ba_compatibility_map_digest;
      },
      error: /binding_metadata source equality/,
    },
  ];
  for (const item of cases) {
    await t.test(item.name, () => {
      const baseline = makeBaseline();
      const r0 = makeR0(baseline);
      const b2 = makeB2(r0);
      item.mutate(b2);
      recalculateInventory(b2.current_requirement_registry);
      assert.throws(
        () =>
          validateB2Transition({
            baselineR0: r0,
            successor: b2,
            r0Commit: R0_COMMIT,
            r0SubjectDigest: R0_SUBJECT_DIGEST,
            artifactReader,
            expectedDesignationBinding: designationBinding(),
          }),
        item.error,
      );
    });
  }
});

test('B2 rejects malformed windows, non-private pseudonyms, and output-in-source recursion', async t => {
  const cases = [
    {
      name: 'window ordering',
      mutate: (b2) => {
        const value = b2.current_requirement_registry.requirements_by_id['window-cp-ba'].resolved_value.value;
        value.end_at_utc = value.start_at_utc;
        const record = b2.current_requirement_registry.requirements_by_id['window-cp-ba'];
        record.resolved_value.value_sha256 = domainDigest(
          'softbook-cet/mobile-ux-batch1-resolved-value/v1',
          value,
        );
      },
      error: /temporal order/,
    },
    {
      name: 'raw issuer identity',
      mutate: (b2) => {
        const value = b2.current_requirement_registry.requirements_by_id['window-cp-cs'].resolved_value.value;
        value.schedule_issuer_principal_pseudonym = 'learner@example.com';
        const record = b2.current_requirement_registry.requirements_by_id['window-cp-cs'];
        record.resolved_value.value_sha256 = domainDigest(
          'softbook-cet/mobile-ux-batch1-resolved-value/v1',
          value,
        );
      },
      error: /issuer pseudonym|forbidden email/,
    },
    {
      name: 'build output enters its own source closure',
      mutate: (b2) => {
        const record = b2.current_requirement_registry.requirements_by_id[
          'build-cp-ba-browser-documents'
        ];
        const value = record.resolved_value.value;
        value.source_closure_records.push(value.build_output_artifact);
        value.source_closure_records.sort((a, b) => a.path.localeCompare(b.path));
        value.source_closure_digest = domainDigest(
          'softbook-cet/mobile-ux-batch1-build-source-closure/v1',
          value.source_closure_records.map((item) => [
            ['path', item.path],
            ['git_mode', item.git_mode],
            ['byte_length', item.byte_length],
            ['raw_sha256', item.raw_sha256],
          ]),
        );
        record.resolved_value.value_sha256 = domainDigest(
          'softbook-cet/mobile-ux-batch1-resolved-value/v1',
          value,
        );
      },
      error: /output must not be in source closure/,
    },
  ];
  for (const item of cases) {
    await t.test(item.name, () => {
      const baseline = makeBaseline();
      const r0 = makeR0(baseline);
      const b2 = makeB2(r0);
      item.mutate(b2);
      recalculateInventory(b2.current_requirement_registry);
      assert.throws(
        () =>
          validateB2Transition({
            baselineR0: r0,
            successor: b2,
            r0Commit: R0_COMMIT,
            r0SubjectDigest: R0_SUBJECT_DIGEST,
            artifactReader,
            expectedDesignationBinding: designationBinding(),
          }),
        item.error,
      );
    });
  }
});
