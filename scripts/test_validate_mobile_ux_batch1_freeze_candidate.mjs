#!/usr/bin/env node

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {
  BATCH1_APPROVED_PREPARATION_HEAD,
  FREEZE_CANDIDATE_PATHS,
  MANIFEST_CATALOG_PATH,
} from './lib/mobile_ux_batch1_manifest_contract.mjs';
import {validateBatch1FreezeCandidate} from './validate_mobile_ux_batch1_freeze_candidate.mjs';
import {CONTRACT_RELATIVE_PATH, LEDGER_RELATIVE_PATH} from './validate_state_evidence_ledger.mjs';

const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BATCH1_DIRECTORY = path.posix.dirname(FREEZE_CANDIDATE_PATHS[0]);
const CP_BA_PATH = `${BATCH1_DIRECTORY}/cp-ba.registry.v2.proposal.json`;
const CP_CS_PATH = `${BATCH1_DIRECTORY}/cp-cs.registry.v2.proposal.json`;
const CP_WEB_PATH = `${BATCH1_DIRECTORY}/cp-web.registry.v2.proposal.json`;
const ROOT_PATH = `${BATCH1_DIRECTORY}/registry-set.v2.proposal.json`;
const SUPPORT_PATHS = [
  LEDGER_RELATIVE_PATH,
  CONTRACT_RELATIVE_PATH,
  `${BATCH1_DIRECTORY}/registry-set.v1.json`,
  `${BATCH1_DIRECTORY}/cp-ba.registry.v1.json`,
  `${BATCH1_DIRECTORY}/cp-cs.registry.v1.json`,
  `${BATCH1_DIRECTORY}/cp-web.registry.v1.json`,
  'docs/design/decisions/pc-web-core-surface-decision-v1.md',
  'spec/account-sync-contract.json',
  'spec/action-surface.json',
  'spec/interactions.json',
  'spec/membership.json',
  'spec/platform-contract.json',
  'spec/product-core.json',
  'spec/runtime-boundaries.json',
  'infra/cloudbase/auth-v2-runtime-contract.md',
  'infra/cloudbase/beta-entitlement-v1-runtime-contract.md',
  'infra/cloudbase/content-manifest-v1-runtime-contract.md',
  'infra/cloudbase/learning-events-v2-runtime-contract.md',
  'infra/cloudbase/learning-session-v1-runtime-contract.md',
  'infra/cloudbase/space-actions-v2-runtime-contract.md',
];

function run(root, args, label) {
  const result = spawnSync(args[0], args.slice(1), {cwd: root, encoding: 'utf8'});
  if (result.status !== 0) {
    throw new Error(`${label}: ${(result.stderr || result.stdout || 'command failed').trim()}`);
  }
}

function copyPath(root, relativePath) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.copyFileSync(path.join(SOURCE_ROOT, relativePath), target);
}

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function writeJson(root, relativePath, value) {
  fs.writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function recomputeCurrentRequirementInventory(value) {
  const registry = value.current_requirement_registry;
  registry.inventory_digest = createHash('sha256')
    .update(
      `${registry.inventory_digest_domain_separator}\0${JSON.stringify(registry.requirements_by_id)}`,
    )
    .digest('hex');
}

function recomputeEmbeddedPartitionDigest(value) {
  const subject = {
    lane_definitions: value.lane_definitions,
    profile_overlays: value.profile_overlays,
    obligation_records: value.obligation_records,
  };
  value.partition_summary.partition_digest = createHash('sha256')
    .update(`${value.partition_summary.partition_digest_domain_separator}\0${JSON.stringify(subject)}`)
    .digest('hex');
}

function fixture({mutate, tracked = false, mutateAfterCommit} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-batch1-v2-'));
  for (const relativePath of [...FREEZE_CANDIDATE_PATHS, ...SUPPORT_PATHS]) copyPath(root, relativePath);
  mutate?.(root);
  if (tracked) {
    run(root, ['git', 'init', '-q'], 'git init');
    run(root, ['git', 'config', 'user.name', 'Batch1 Fixture'], 'git config name');
    run(root, ['git', 'config', 'user.email', 'batch1-fixture@example.invalid'], 'git config email');
    run(
      root,
      ['git', 'remote', 'add', 'origin', 'https://github.com/LENKIN233/softbook_cet.git'],
      'git remote add origin',
    );
    run(
      root,
      ['git', 'fetch', '-q', SOURCE_ROOT, BATCH1_APPROVED_PREPARATION_HEAD],
      'git fetch approved preparation head',
    );
    run(root, ['git', 'symbolic-ref', 'HEAD', 'refs/heads/main'], 'git set fixture branch');
    run(
      root,
      ['git', 'update-ref', 'refs/heads/main', BATCH1_APPROVED_PREPARATION_HEAD],
      'git set approved parent',
    );
    run(root, ['git', 'add', '--', '.'], 'git add');
    run(root, ['git', 'commit', '-q', '-m', 'fixture'], 'git commit');
    mutateAfterCommit?.(root);
  }
  return root;
}

function withFixture(options, callback) {
  const root = fixture(options);
  try {
    return callback(root);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
}

function validateUnreviewedFixture(root) {
  return validateBatch1FreezeCandidate({
    root,
    requireTracked: false,
    enforceReviewedDigests: false,
  });
}

test('accepts the exact schema-definition-only proposal and reports no authority', () =>
  withFixture({tracked: true}, (root) => {
    const result = validateBatch1FreezeCandidate({root, requireTracked: true});
    assert.equal(result.artifact_valid, true);
    assert.equal(result.subject_class, 'schema_definition_only');
    assert.equal(result.candidate_status, 'candidate_incomplete');
    assert.deepEqual(result.checkpoint_obligation_counts, {'CP-BA': 173, 'CP-CS': 173, 'CP-WEB': 173});
    assert.equal(result.total_child_obligation_record_count, 519);
    assert.equal(result.planned_manifest_count, 35);
    assert.equal(result.manifest_type_definition_count, 12);
    assert.match(result.manifest_type_definitions_digest, /^[0-9a-f]{64}$/);
    assert.match(result.manifest_reservations_digest, /^[0-9a-f]{64}$/);
    assert.equal(result.cp_cs_domain_source_anchor_count, 28);
    assert.match(result.cp_cs_domain_contracts_digest, /^[0-9a-f]{64}$/);
    assert.equal(result.historical_v1_migrated_instance_count, 115);
    assert.equal(result.historical_v1_resolved_instance_count, 1);
    assert.equal(result.historical_v1_pending_instance_count, 114);
    assert.equal(result.current_v2_requirement_count, 145);
    assert.equal(result.current_v2_pending_requirement_count, 145);
    assert.equal(result.successor_transition_stage_count, 4);
    assert.equal(result.successor_transition_post_designation_requirement_count, 9);
    assert.match(result.successor_transition_contract_digest, /^[0-9a-f]{64}$/);
    assert.equal(result.decision_authority_bootstrap_status, 'not_implemented');
    assert.equal(result.decision_instance_count, 0);
    assert.equal(result.approval_receipt_count, 0);
    assert.equal(result.preparation_approval_receipt_status, 'missing');
    assert.equal(result.trusted_staged_same_pr_path_status, 'not_implemented');
    assert.equal(
      result.allowed_next_action,
      'implement_trusted_governance_and_R0_B2_materialization_validators_obtain_protected_validity_policy_and_legacy_receipt_migration_approval',
    );
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(result.pc_web_row_binding_digests).map(([rowId, row]) => [
          rowId,
          row.obligation_count,
        ]),
      ),
      {
        'PW-VIEWPORT-01': 1,
        'PW-VIEWPORT-02': 1,
        'PW-ZOOM-01': 1,
        'PW-KEYBOARD-01': 1,
        'PW-MOUSE-01': 1,
        'PW-FOCUS-01': 1,
        'PW-MOTION-01': 1,
        'PW-SCREENREADER-01': 1,
        'PW-SERVICE-01': 1,
        'PW-COMMERCE-01': 1,
        'PW-BETA-01': 1,
        'PW-AUDIO-01': 1,
      },
    );
    assert.equal(result.freeze_readiness, 'blocked_candidate_incomplete');
    assert.equal(result.manifest_freeze_eligible, false);
    assert.match(result.subject_digest, /^[0-9a-f]{64}$/);
    assert.deepEqual(
      {
        reservation_activation_authorized: result.reservation_activation_authorized,
        manifest_creation_authorized: result.manifest_creation_authorized,
        data_manifest_population_authorized: result.data_manifest_population_authorized,
        architecture_acceptance_authorized: result.architecture_acceptance_authorized,
        checkpoint_coverage_authorized: result.checkpoint_coverage_authorized,
        leadership_readiness_authorized: result.leadership_readiness_authorized,
      },
      {
        reservation_activation_authorized: false,
        manifest_creation_authorized: false,
        data_manifest_population_authorized: false,
        architecture_acceptance_authorized: false,
        checkpoint_coverage_authorized: false,
        leadership_readiness_authorized: false,
      },
      'validator result must surface every newly canonicalized authority dimension as false',
    );
    for (const [key, value] of Object.entries(result)) {
      if (/(?:authorized|eligible)$/.test(key)) assert.equal(value, false, key);
    }
    const cli = spawnSync(
      process.execPath,
      [path.join(SOURCE_ROOT, 'scripts/validate_mobile_ux_batch1_freeze_candidate.mjs'), '--root', root],
      {cwd: root, encoding: 'utf8'},
    );
    assert.equal(cli.status, 0, cli.stderr || cli.stdout);
    assert.ok(
      cli.stdout.includes(
        'NON-CLAIM: schema_definition_only authorizes none; all 16 canonical authority dimensions remain false: freeze, reservation_activation, manifest_creation, provision, execution, evidence, data_manifest_population, aggregation, promotion, architecture_acceptance, checkpoint_coverage, visual, implementation, native, release, leadership_readiness',
      ),
      cli.stdout,
    );
    assert.equal(
      fs.existsSync(path.join(root, BATCH1_DIRECTORY, 'execution-manifests')),
      false,
      'test fixture must not create the reserved execution-manifest subtree',
    );
  }));

test('rejects an existing empty reserved execution-manifest root', () =>
  withFixture(
    {
      mutate(root) {
        fs.mkdirSync(path.join(root, BATCH1_DIRECTORY, 'execution-manifests'), {recursive: true});
      },
    },
    (root) =>
      assert.throws(
        () => validateUnreviewedFixture(root),
        /execution manifest root must be absent before a protected freeze decision/,
      ),
  ));

test('rejects successor-transition cycles, authority substitution, and recursive compatibility inputs', async (t) => {
  const cases = [
    [
      'R0 is not exact 136 resolved and 9 pending',
      (contract) => { contract.stages[0].resolved_requirement_count = 135; },
      /R0 resolved count/,
    ],
    [
      'D1 attempts to designate the current schema bytes',
      (contract) => { contract.stages[1].decision_subject = 'current_candidate_schema_approval'; },
      /D1 decision subject/,
    ],
    [
      'D1 drops manifest creation from its non-authorization list',
      (contract) => { contract.stages[1].does_not_authorize.shift(); },
      /D1 non-authorization/,
    ],
    [
      'D1 decision drops architecture acceptance from its non-claims',
      (contract) => {
        contract.stages[1].required_decision_non_claims =
          contract.stages[1].required_decision_non_claims.filter(
            (claim) => claim !== 'architecture_acceptance',
          );
      },
      /D1 decision non-claims/,
    ],
    [
      'D1 decision drops data-manifest population from its non-claims',
      (contract) => {
        contract.stages[1].required_decision_non_claims =
          contract.stages[1].required_decision_non_claims.filter(
            (claim) => claim !== 'data_manifest_population',
          );
      },
      /D1 decision non-claims/,
    ],
    [
      'D1 decision attempts to skip B2',
      (contract) => { contract.stages[1].required_decision_allowed_next_action = 'freeze_now'; },
      /D1 decision next action/,
    ],
    [
      'unimplemented authority bootstrap is falsely marked ready',
      (contract) => { contract.decision_authority_bootstrap.current_status = 'implemented'; },
      /authority bootstrap status/,
    ],
    [
      'current candidate skips governance bootstrap',
      (contract) => { contract.decision_authority_bootstrap.current_allowed_next_action = 'start_D1'; },
      /current governance bootstrap action/,
    ],
    [
      'decision head is allowed to supply its own trusted validator',
      (contract) => {
        contract.decision_authority_bootstrap.required_trusted_base_capabilities =
          contract.decision_authority_bootstrap.required_trusted_base_capabilities.filter(
            (value) => value !== 'trusted_base_validator_not_loaded_from_decision_head',
          );
      },
      /trusted authority bootstrap capabilities/,
    ],
    [
      'sensitive-only classifier is allowed to authorize designation',
      (contract) => {
        contract.decision_authority_bootstrap.current_workflow_or_classifier_may_authorize_designation = true;
      },
      /must remain false|current classifier designation authority/,
    ],
    [
      'mixed decision classes in one exact-head change set are permitted',
      (contract) => {
        contract.decision_separation_requirements
          .mixed_new_decision_classes_in_same_exact_head_change_set_forbidden = false;
      },
      /decision separation mixed_new_decision_classes/,
    ],
    [
      'schema hard-codes different PRs instead of trusted staged subject separation',
      (contract) => {
        contract.decision_separation_requirements.pull_request_separation_policy =
          'different_pull_requests_required';
      },
      /pull request separation policy/,
    ],
    [
      'D1 and F3 approval reuse is permitted',
      (contract) => {
        contract.decision_separation_requirements
          .designation_and_final_freeze_approval_ids_must_differ = false;
      },
      /decision separation designation_and_final_freeze_approval_ids/,
    ],
    [
      'D1 and F3 exact subject digest reuse is permitted',
      (contract) => {
        contract.decision_separation_requirements
          .designation_and_final_freeze_subject_digests_must_differ = false;
      },
      /decision separation designation_and_final_freeze_subject_digests/,
    ],
    [
      'future decision artifacts may be symlinks',
      (contract) => { contract.decision_instance_contract.intent_file_constraints.symlink_forbidden = false; },
      /decision symlink prohibition/,
    ],
    [
      'future decision artifact path traverses',
      (contract) => { contract.decision_instance_contract.instances[0].intent_artifact_path = '../decision.json'; },
      /decision instance\[0\] artifact path/,
    ],
    [
      'future decision artifact mode becomes executable',
      (contract) => { contract.decision_instance_contract.intent_file_constraints.git_mode = '100755'; },
      /decision file mode/,
    ],
    [
      'decision commit SHA type contract is weakened',
      (contract) => { contract.decision_instance_contract.field_type_contracts.commit_sha.regex_id = 'any_string'; },
      /decision field type commit_sha\.regex_id/,
    ],
    [
      'F3 decision-instance mask grants execution',
      (contract) => { contract.decision_instance_contract.instances[1].required_authority_mask.execution = true; },
      /decision instance\[1\] authority mask\.execution/,
    ],
    [
      'approval receipt algorithm drifts',
      (contract) => { contract.approval_receipt_contract.approval_instance_digest_contract.algorithm = 'sha512'; },
      /approval receipt algorithm/,
    ],
    [
      'approval receipt domain drifts',
      (contract) => { contract.approval_receipt_contract.approval_instance_digest_contract.domain_separator += '-changed'; },
      /approval receipt domain/,
    ],
    [
      'approval receipt canonical encoding drifts',
      (contract) => { contract.approval_receipt_contract.approval_instance_digest_contract.canonical_value_encoding = 'plain_json'; },
      /approval receipt canonical encoding/,
    ],
    [
      'approval receipt projection order drifts',
      (contract) => {
        const projection = contract.approval_receipt_contract.approval_instance_digest_contract
          .generic_ordered_projection_fields;
        [projection[0], projection[1]] = [projection[1], projection[0]];
      },
      /approval receipt generic projection/,
    ],
    [
      'D1 approval receipt omits designated cohort SHA',
      (contract) => {
        contract.approval_receipt_contract.approval_instance_digest_contract
          .class_specific_ordered_projection_fields.cohort_designation.pop();
      },
      /D1 receipt cohort projection/,
    ],
    [
      'approval receipt formula stops binding class-specific projection',
      (contract) => {
        contract.approval_receipt_contract.approval_instance_digest_contract.digest_formula =
          'lowercase_hex_sha256(generic_ordered_projection)';
      },
      /approval receipt formula/,
    ],
    [
      'approval receipt recomputation becomes optional',
      (contract) => {
        contract.approval_receipt_contract.approval_instance_digest_contract
          .recompute_and_compare_required = false;
      },
      /approval receipt recomputation/,
    ],
    [
      'staged parent omits immutable reviewer ID',
      (contract) => {
        contract.staged_parent_contract.tuple_fields =
          contract.staged_parent_contract.tuple_fields.filter(
            (field) => field !== 'parent_reviewer_immutable_id',
          );
      },
      /staged parent tuple/,
    ],
    [
      'staged parent no longer proves ancestry',
      (contract) => { contract.staged_parent_contract.validation_rules.shift(); },
      /staged parent validation rules/,
    ],
    [
      'opaque parent digest is accepted',
      (contract) => { contract.staged_parent_contract.opaque_parent_digest_without_exact_tuple_forbidden = false; },
      /opaque parent digest prohibition/,
    ],
    [
      'missing preparation receipt is falsely materialized',
      (contract) => { contract.staged_parent_contract.current_preparation_receipt.status = 'present'; },
      /preparation receipt status/,
    ],
    [
      'D1 parent chain mutates to F3',
      (contract) => { contract.staged_parent_contract.required_chains[0].parent_decision_class = 'manifest_freeze'; },
      /staged parent chain\[0\]\.parent_decision_class/,
    ],
    [
      'D1 omits its machine-readable decision class',
      (contract) => {
        contract.stages[1].required_decision_intent_fields =
          contract.stages[1].required_decision_intent_fields.filter((field) => field !== 'decision_class');
      },
      /D1 decision intent fields/,
    ],
    [
      'B2 permits drift in the 136 R0-resolved requirements',
      (contract) => { contract.stages[2].immutable_requirement_drift_rule = 'drift_allowed'; },
      /B2 immutable drift rule/,
    ],
    [
      'B2 expands the exact nine mutable requirements',
      (contract) => { contract.stages[2].mutable_requirement_count = 10; },
      /B2 mutable requirement count/,
    ],
    [
      'designation-bound build allows an arbitrary value class',
      (contract) => {
        contract.designation_bound_build_contract.allowed_value_class = 'receiver_supplied_build_key';
      },
      /build allowed value class/,
    ],
    [
      'designation-bound build omits the digest domain',
      (contract) => {
        contract.designation_bound_build_contract.required_value_fields =
          contract.designation_bound_build_contract.required_value_fields.filter(
            (field) => field !== 'designation_subject_digest_domain',
          );
      },
      /build required value fields/,
    ],
    [
      'compatibility derivation algorithm drifts',
      (contract) => { contract.compatibility_derivation_contract.hash_algorithm = 'sha512'; },
      /compatibility hash algorithm/,
    ],
    [
      'compatibility derivation version drifts',
      (contract) => { contract.compatibility_derivation_contract.schema_version += '.v2'; },
      /compatibility derivation schema/,
    ],
    [
      'binding bundle domain drifts',
      (contract) => { contract.compatibility_derivation_contract.binding_bundle.domain_separator += '-changed'; },
      /binding bundle domain/,
    ],
    [
      'binding bundle omits designation digest domain',
      (contract) => {
        contract.compatibility_derivation_contract.binding_bundle.ordered_subject_fields =
          contract.compatibility_derivation_contract.binding_bundle.ordered_subject_fields.filter(
            (field) => field !== 'designation_subject_digest_domain',
          );
      },
      /binding bundle ordered subject fields/,
    ],
    [
      'binding bundle omits designated cohort SHA',
      (contract) => {
        contract.compatibility_derivation_contract.binding_bundle.ordered_subject_fields =
          contract.compatibility_derivation_contract.binding_bundle.ordered_subject_fields.filter(
            (field) => field !== 'designated_cohort_sha256',
          );
      },
      /binding bundle ordered subject fields/,
    ],
    [
      'compatibility input order drifts',
      (contract) => {
        const fields = contract.compatibility_derivation_contract.per_output_derivations[0].ordered_input_fields;
        [fields[1], fields[2]] = [fields[2], fields[1]];
      },
      /compatibility output\[0\] inputs/,
    ],
    [
      'compatibility output omits designation digest domain',
      (contract) => {
        contract.compatibility_derivation_contract.per_output_derivations[0].ordered_input_fields =
          contract.compatibility_derivation_contract.per_output_derivations[0].ordered_input_fields.filter(
            (field) => field !== 'designation_subject_digest_domain',
          );
      },
      /compatibility output\[0\] inputs/,
    ],
    [
      'compatibility output consumes its own output',
      (contract) => {
        contract.compatibility_derivation_contract.per_output_derivations[0].ordered_input_fields[4] =
          'compatibility_key_output';
      },
      /compatibility output\[0\] inputs/,
    ],
    [
      'binding bundle permits self-hash input',
      (contract) => {
        contract.compatibility_derivation_contract.binding_bundle.forbidden_subject_fields.shift();
      },
      /binding bundle forbidden recursive inputs/,
    ],
    [
      'compatibility output domain drifts',
      (contract) => { contract.compatibility_derivation_contract.per_output_derivations[0].domain_separator += '-changed'; },
      /compatibility output\[0\] domain separator/,
    ],
    [
      'compatibility output ID drifts',
      (contract) => { contract.compatibility_derivation_contract.per_output_derivations[0].output_id += '-changed'; },
      /compatibility output\[0\] output ID/,
    ],
    [
      'one compatibility output is omitted',
      (contract) => { contract.compatibility_derivation_contract.per_output_derivations.pop(); },
      /exactly five outputs/,
    ],
    [
      'arbitrary compatibility values become allowed',
      (contract) => {
        contract.compatibility_derivation_contract.arbitrary_or_synthetic_compatibility_values_forbidden = false;
      },
      /arbitrary compatibility value policy/,
    ],
    [
      'cached compatibility values skip recomputation',
      (contract) => { contract.compatibility_derivation_contract.cached_value_without_recomputation_forbidden = false; },
      /cache recomputation policy/,
    ],
    [
      'three CP-BA components no longer compose one map',
      (contract) => { contract.compatibility_derivation_contract.cp_ba_single_map_derivation.output_map_cardinality = 3; },
      /CP-BA compatibility map cardinality/,
    ],
    [
      'CP-BA component order drifts',
      (contract) => {
        contract.compatibility_derivation_contract.cp_ba_single_map_derivation
          .ordered_component_requirement_ids.reverse();
      },
      /CP-BA compatibility map components/,
    ],
    [
      'B2 claims freeze eligibility before F3',
      (contract) => { contract.stages[2].manifest_freeze_eligible_after_stage = true; },
      /must remain false|B2 freeze eligibility/,
    ],
    [
      'F3 final decision is allowed to self-reference inside subject bytes',
      (contract) => { contract.stages[3].final_freeze_self_reference_forbidden = false; },
      /F3 self-reference prohibition/,
    ],
    [
      'F3 decision subject contains its own approval',
      (contract) => {
        contract.stages[3].decision_subject = 'complete_successor_bytes_including_F3_approval';
      },
      /F3 decision subject/,
    ],
    [
      'F3 omits the parent designation approval-instance digest',
      (contract) => {
        contract.stages[3].required_decision_intent_fields =
          contract.stages[3].required_decision_intent_fields.filter(
            (field) => field !== 'parent_designation_approval_instance_digest',
          );
      },
      /F3 decision intent fields/,
    ],
    [
      'F3 uses a generic authorization effect',
      (contract) => { contract.stages[3].required_decision_gate_effect = 'authorize_named_actions'; },
      /F3 decision gate effect/,
    ],
    [
      'F3 authority matrix grants execution',
      (contract) => { contract.stages[3].required_decision_authority_matrix.execution = true; },
      /F3 decision authority matrix\.execution/,
    ],
    [
      'F3 authority matrix grants manifest creation',
      (contract) => { contract.stages[3].required_decision_authority_matrix.manifest_creation = true; },
      /F3 decision authority matrix\.manifest_creation/,
    ],
    [
      'F3 drops data population from its non-claims',
      (contract) => {
        contract.stages[3].required_decision_non_claims =
          contract.stages[3].required_decision_non_claims.filter(
            (claim) => claim !== 'data_manifest_population',
          );
      },
      /F3 decision non-claims/,
    ],
    [
      'F3 drops manifest creation from its non-claims',
      (contract) => {
        contract.stages[3].required_decision_non_claims =
          contract.stages[3].required_decision_non_claims.filter(
            (claim) => claim !== 'manifest_creation',
          );
      },
      /F3 decision non-claims/,
    ],
    [
      'F3 reservation activation creates the manifest root',
      (contract) => { contract.stages[3].manifest_root_state_after_decision = 'present'; },
      /F3 post-decision manifest root/,
    ],
    [
      'F3 reservation activation mutates the frozen catalog',
      (contract) => { contract.stages[3].catalog_metadata_mutation_forbidden = false; },
      /F3 catalog mutation prohibition/,
    ],
    [
      'F3 permits frozen subject drift after approval',
      (contract) => { contract.stages[3].frozen_subject_artifacts_immutable_after_F3 = false; },
      /F3 frozen subject immutability/,
    ],
    [
      'F3 next action includes execution',
      (contract) => { contract.stages[3].required_decision_allowed_next_action = 'freeze_and_execute'; },
      /F3 decision next action/,
    ],
    [
      'F3 removes separate evidence authority',
      (contract) => { contract.stages[3].separate_authority_requirements.pop(); },
      /F3 separate authority requirements/,
    ],
    [
      'F3 falls back to generic explicit-action authorization',
      (contract) => { contract.stages[3].authorization_rule = 'authorize_whatever_decision_names'; },
      /F3 authorization rule/,
    ],
    [
      'current preparation approval substitutes for D1',
      (contract) => { contract.forbidden_decision_substitutions.shift(); },
      /forbidden_decision_substitutions/,
    ],
    [
      'schema-definition approval substitutes for F3',
      (contract) => {
        contract.forbidden_decision_substitutions =
          contract.forbidden_decision_substitutions.filter(
            (value) => value !== 'schema_definition_approval_for_final_manifest_freeze',
          );
      },
      /forbidden_decision_substitutions/,
    ],
  ];
  for (const [name, mutate, pattern] of cases) {
    await t.test(name, () =>
      withFixture(
        {
          mutate(root) {
            const value = readJson(root, ROOT_PATH);
            mutate(value.successor_transition_contract);
            writeJson(root, ROOT_PATH, value);
          },
        },
        (root) => assert.throws(() => validateUnreviewedFixture(root), pattern),
      ));
  }
});

test('rejects second-round authority, provenance, lifecycle, and canonical-binding drift', async (t) => {
  const cases = [
    ['post-approval workflow data leaks into a preapproval intent', (c) => c.stages[1].required_decision_intent_fields.push('workflow_run_id'), /D1 decision intent fields/],
    ['a receipt may become part of its own approval subject', (c) => { c.decision_instance_contract.decision_lifecycle_contract.receipt_cannot_be_subject_artifact_of_same_approval = false; }, /decision lifecycle receipt_cannot_be_subject_artifact_of_same_approval/],
    ['a receipt no longer binds the exact intent bytes', (c) => { c.decision_instance_contract.decision_lifecycle_contract.receipt_must_bind_intent_path_and_raw_sha256 = false; }, /decision lifecycle receipt_must_bind_intent_path_and_raw_sha256/],
    ['receipt materialization no longer requires external success', (c) => { c.decision_instance_contract.decision_lifecycle_contract.receipt_materialization_requires_verified_external_success_event = false; }, /decision lifecycle receipt_materialization_requires_verified_external_success_event/],
    ['legacy schema approval is assigned a non-null parent', (c) => { c.decision_instance_contract.legacy_preparation_bootstrap_contract.root_parent_approval_tuple = {}; }, /legacy root parent/],
    ['legacy receipt migration fabricates current authority', (c) => { c.decision_instance_contract.legacy_preparation_bootstrap_contract.materialization_authorized = true; }, /materialization_authorized must remain false/],
    ['legacy migration permits fabricated values', (c) => { c.decision_instance_contract.legacy_preparation_bootstrap_contract.fabricated_intent_or_receipt_values_forbidden = false; }, /legacy fabrication policy/],
    ['legacy migration collapses its two protected event chains', (c) => c.decision_instance_contract.legacy_preparation_bootstrap_contract.required_two_event_chains.pop(), /legacy two event chains/],
    ['legacy event chains may substitute for each other', (c) => { c.decision_instance_contract.legacy_preparation_bootstrap_contract.event_chains_must_not_share_or_substitute_head_run_deployment_approval_or_event_ref = false; }, /legacy event separation/],
    ['legacy receipt authority loses its explicit field binding', (c) => c.decision_instance_contract.legacy_preparation_bootstrap_contract.migrated_receipt_exact_field_bindings.splice(1, 1), /legacy migrated receipt field bindings/],
    ['decision subject artifact order drifts', (c) => c.decision_instance_contract.subject_digest_contract.exact_ordered_artifact_paths.reverse(), /decision subject exact artifact paths/],
    ['decision subject mode becomes executable', (c) => { c.decision_instance_contract.subject_digest_contract.required_git_mode = '100755'; }, /decision subject mode/],
    ['decision subject digest formula omits raw artifact records', (c) => { c.decision_instance_contract.subject_digest_contract.digest_formula = 'lowercase_hex_sha256(subject_commit)'; }, /decision subject digest formula/],
    ['decision subject need not precede approval head', (c) => { c.decision_instance_contract.subject_digest_contract.subject_commit_must_be_ancestor_of_approval_target_head = false; }, /decision subject subject_commit_must_be_ancestor/],
    ['decision subject bytes may drift at approval head', (c) => { c.decision_instance_contract.subject_digest_contract.all_subject_artifact_bytes_must_be_unchanged_at_approval_target_head = false; }, /decision subject all_subject_artifact_bytes/],
    ['decision subject record drops byte length', (c) => c.decision_instance_contract.subject_digest_contract.artifact_record_required_fields.splice(2, 1), /decision subject artifact record fields/],
    ['executable commit regex accepts arbitrary strings', (c) => { c.decision_instance_contract.regex_registry.entries.lowercase_hex_exact_40 = Buffer.from('^.+$').toString('base64'); }, /regex lowercase_hex_exact_40 source/],
    ['intent digest field is mapped to a generic string', (c) => { c.decision_instance_contract.intent_field_type_map.designation_subject_digest = 'non_empty_string'; }, /intent field type map\.designation_subject_digest/],
    ['canonical authority mask loses leadership readiness', (c) => c.decision_instance_contract.authority_mask_keys.pop(), /authority mask keys/],
    ['canonical authority mask omits manifest creation', (c) => { c.decision_instance_contract.authority_mask_keys = c.decision_instance_contract.authority_mask_keys.filter((key) => key !== 'manifest_creation'); }, /authority mask keys/],
    ['authority policy loses one canonical key', (c) => c.authority_key_policy.canonical_decision_authority_keys.pop(), /canonical decision authority keys/],
    ['legacy authority policy no longer defaults one key false', (c) => c.authority_key_policy.legacy_missing_keys_default_false.pop(), /legacy missing authority keys/],
    ['D1 authority grants reservation activation', (c) => { c.decision_instance_contract.instances[0].required_authority_mask.reservation_activation = true; }, /decision instance\[0\] authority mask\.reservation_activation/],
    ['D1 authority grants manifest creation', (c) => { c.decision_instance_contract.instances[0].required_authority_mask.manifest_creation = true; }, /decision instance\[0\] authority mask\.manifest_creation/],
    ['D1 authority grants data-manifest population', (c) => { c.decision_instance_contract.instances[0].required_authority_mask.data_manifest_population = true; }, /decision instance\[0\] authority mask\.data_manifest_population/],
    ['D1 authority grants architecture acceptance', (c) => { c.decision_instance_contract.instances[0].required_authority_mask.architecture_acceptance = true; }, /decision instance\[0\] authority mask\.architecture_acceptance/],
    ['D1 authority grants checkpoint coverage', (c) => { c.decision_instance_contract.instances[0].required_authority_mask.checkpoint_coverage = true; }, /decision instance\[0\] authority mask\.checkpoint_coverage/],
    ['D1 authority grants leadership readiness', (c) => { c.decision_instance_contract.instances[0].required_authority_mask.leadership_readiness = true; }, /decision instance\[0\] authority mask\.leadership_readiness/],
    ['successor global authority grants execution', (c) => { c.authority.execution = true; }, /authority\.execution must remain false/],
    ['staged parent tuple accepts an extra opaque field', (c) => c.staged_parent_contract.tuple_fields.push('parent_opaque'), /staged parent tuple/],
    ['staged parent source binding is swapped', (c) => { c.staged_parent_contract.ordered_value_source_bindings[0] = 'parent_approval_target_head_sha=child_head'; }, /staged parent value sources/],
    ['staged parent decision bytes may drift', (c) => { c.staged_parent_contract.validation_rules = c.staged_parent_contract.validation_rules.filter((v) => v !== 'parent_decision_artifact_raw_bytes_must_be_unchanged_at_child_head'); }, /staged parent validation rules/],
    ['root parent sentinel stops being JSON null', (c) => { c.staged_parent_contract.root_parent_rules.canonical_root_parent_sentinel = 'empty_object'; }, /root parent sentinel/],
    ['build value designation source can be caller supplied', (c) => { c.designation_bound_build_contract.ordered_value_source_bindings[0].source = 'caller'; }, /build value source\[0\]\.source/],
    ['build source-closure domain drifts', (c) => { c.designation_bound_build_contract.source_closure_digest_contract.domain_separator += '-changed'; }, /source closure domain/],
    ['build source-closure order becomes filesystem order', (c) => { c.designation_bound_build_contract.source_closure_digest_contract.record_order = 'filesystem_order'; }, /source closure record order rule/],
    ['build source closure may be empty', (c) => { c.designation_bound_build_contract.source_closure_digest_contract.minimum_record_count = 0; }, /source closure minimum count/],
    ['build source records permit extra keys', (c) => { c.designation_bound_build_contract.source_closure_record_exact_keys_required = false; }, /build exact source record keys/],
    ['build recipe enumeration need not equal resolved closure', (c) => { c.designation_bound_build_contract.build_recipe_contract.resolved_source_closure_records_must_exactly_equal_recipe_enumeration = false; }, /build closure equality/],
    ['build sandbox permits one ambient input', (c) => c.designation_bound_build_contract.build_recipe_contract.sandbox_forbidden_inputs.pop(), /build sandbox forbidden inputs/],
    ['build output path is caller selected', (c) => { c.designation_bound_build_contract.build_recipe_contract.exact_build_output_path = 'artifacts/other.tar'; }, /build output path/],
    ['clean build reproducibility is optional', (c) => { c.designation_bound_build_contract.build_recipe_contract.clean_rebuild_output_raw_sha256_must_match = false; }, /build clean reproducibility/],
    ['window persists a real immutable issuer ID', (c) => { c.execution_window_contract.exact_value_keys[5] = 'schedule_issuer_immutable_id'; }, /execution window keys/],
    ['window pseudonym accepts a reviewer identifier', (c) => { c.execution_window_contract.field_type_map.schedule_issuer_principal_pseudonym = 'reviewer_immutable_id'; }, /execution window field type schedule_issuer_principal_pseudonym/],
    ['window allows real identity persistence', (c) => { c.execution_window_contract.schedule_issuer_real_immutable_id_must_not_be_persisted = false; }, /real identity persistence prohibition/],
    ['window event digest drops canonical projection', (c) => { c.execution_window_contract.schedule_event_digest_contract.digest_formula = 'sha256(raw_json)'; }, /execution window event digest formula/],
    ['window temporal expiry rule is removed', (c) => c.execution_window_contract.temporal_rules.pop(), /execution window temporal rules/],
    ['window remote equality omits the event digest', (c) => c.execution_window_contract.trusted_schedule_event_exact_equality_fields.pop(), /execution window remote equality/],
    ['binding bundle designation source is caller supplied', (c) => { c.compatibility_derivation_contract.binding_bundle.value_source_bindings[0].source = 'caller'; }, /binding bundle value source\[0\]\.source/],
    ['compatibility requirement ID need not equal its output contract', (c) => { c.compatibility_derivation_contract.per_output_input_value_source_contract.compatibility_requirement_id_must_equal_per_output_requirement_id = false; }, /compatibility output value source compatibility_requirement_id/],
    ['CP-BA map input is not recomputed from D1', (c) => { c.compatibility_derivation_contract.cp_ba_single_map_derivation.ordered_input_value_source_bindings[0].source = 'caller'; }, /CP-BA map value source\[0\]\.source/],
    ['CP-BA map output field drifts', (c) => { c.compatibility_derivation_contract.cp_ba_single_map_derivation.output_field = 'map'; }, /CP-BA map output field/],
    ['B2 metadata permits extra keys', (c) => { c.stages[2].binding_metadata_exact_key_set_required = false; }, /B2 binding metadata exact keys/],
    ['B2 metadata omits the persisted CP-BA map', (c) => c.stages[2].required_binding_metadata_fields.pop(), /B2 binding metadata/],
    ['B2 metadata map source is caller supplied', (c) => { c.stages[2].required_binding_metadata_value_sources.at(-1); c.stages[2].required_binding_metadata_value_sources[c.stages[2].required_binding_metadata_value_sources.length - 1] = 'cp_ba_compatibility_map_digest=caller'; }, /B2 binding metadata value sources/],
    ['F3 no longer freezes exact B2 metadata', (c) => { c.stages[3].frozen_b2_binding_metadata_fields_ref = '#/other'; }, /F3 frozen B2 metadata ref/],
    ['remote repository is not bound to event chain', (c) => c.approval_receipt_contract.external_event_contract.exact_receipt_value_source_bindings.shift(), /external event receipt value sources/],
    ['canonical repository literal drifts to a fork', (c) => { c.approval_receipt_contract.external_event_contract.required_repository_full_name = 'fork/softbook_cet'; }, /external event canonical repository/],
    ['fork PR or event substitution is permitted', (c) => { c.approval_receipt_contract.external_event_contract.fork_pull_request_or_event_substitution_forbidden = false; }, /external repository fork_pull_request_or_event_substitution_forbidden/],
    ['remote approval may target another repository or PR', (c) => { c.approval_receipt_contract.external_event_contract.approval_target_head_must_belong_to_exact_repository_and_pull_request = false; }, /external event approval_target_head_must_belong/],
    ['workflow run head may differ from approval target', (c) => { c.approval_receipt_contract.external_event_contract.workflow_run_head_sha_must_equal_approval_target_head_sha = false; }, /external event workflow_run_head_sha_must_equal/],
    ['trusted base need not be an ancestor', (c) => { c.approval_receipt_contract.external_event_contract.trusted_base_sha_must_be_ancestor_of_approval_target_head_sha = false; }, /external event trusted_base_sha_must_be_ancestor/],
    ['protected PR base ref drifts from main', (c) => { c.approval_receipt_contract.external_event_contract.required_pull_request_base_ref = 'refs/heads/dev'; }, /external event protected base ref/],
    ['intent or receipt may self-supply the trust anchor', (c) => { c.approval_receipt_contract.external_event_contract.intent_or_receipt_supplied_trusted_base_forbidden = false; }, /external event intent_or_receipt_supplied_trusted_base_forbidden/],
    ['workflow classifier or validator bytes may come from decision head', (c) => { c.approval_receipt_contract.external_event_contract.trusted_workflow_classifier_and_validator_bytes_must_be_loaded_from_trusted_base_sha = false; }, /external event trusted_workflow_classifier_and_validator_bytes/],
    ['remote event digest hashes unstable raw JSON', (c) => { c.approval_receipt_contract.external_event_contract.event_chain_digest_contract.digest_formula = 'sha256(raw_json)'; }, /external event digest formula/],
    ['remote workflow may fail', (c) => { c.approval_receipt_contract.external_event_contract.required_workflow_conclusion = 'any'; }, /external event workflow conclusion/],
    ['protected environment name drifts', (c) => { c.approval_receipt_contract.external_event_contract.required_environment_name = 'staging'; }, /external event environment name/],
    ['immutable reviewer identity drifts', (c) => { c.approval_receipt_contract.external_event_contract.required_reviewer_immutable_id = 'github:other#1'; }, /external event reviewer/],
    ['receipt use skips one invalidation result', (c) => { c.approval_receipt_contract.use_time_validation_contract.every_invalidation_condition_must_evaluate_false = false; }, /receipt use-time every_invalidation_condition/],
    ['validity policy is falsely marked available', (c) => { c.decision_instance_contract.decision_validity_policy_contract.current_status = 'ready'; }, /validity policy status/],
    ['unknown invalidation IDs do not fail closed', (c) => { c.decision_instance_contract.decision_validity_policy_contract.unknown_condition_id_must_fail_closed = false; }, /validity unknown_condition_id/],
    ['schema invents an owner TTL', (c) => { c.decision_instance_contract.decision_validity_policy_contract.class_policy_slots.cohort_designation.max_validity_seconds = 31536000; }, /validity cohort_designation max duration/],
    ['cohort digest becomes an arbitrary nonce', (c) => { c.decision_instance_contract.designated_cohort_identity_contract.digest_formula = 'sha256(random_nonce)'; }, /cohort identity digest formula/],
    ['cohort identity domain drifts', (c) => { c.decision_instance_contract.designated_cohort_identity_contract.domain_separator += '-changed'; }, /cohort identity domain/],
    ['cohort ID syntax regex accepts arbitrary strings', (c) => { c.decision_instance_contract.regex_registry.entries.syntactic_opaque_designated_cohort_id_v1 = Buffer.from('^.+$').toString('base64'); }, /regex syntactic_opaque_designated_cohort_id_v1 source/],
    ['cohort privacy validator is falsely implemented', (c) => { c.decision_instance_contract.designated_cohort_identity_contract.protected_privacy_classification_validator_status = 'implemented'; }, /cohort privacy validator status/],
    ['cohort non-PII attestation gate is removed', (c) => { c.decision_instance_contract.designated_cohort_identity_contract.protected_non_pii_attestation_required_before_d1_use = false; }, /cohort non-PII attestation gate/],
    ['builder runtime identity is falsely implemented', (c) => { c.designation_bound_build_contract.build_recipe_contract.builder_runtime_identity_status = 'implemented'; }, /builder runtime identity status/],
    ['builder runtime identity omits archive normalization profile', (c) => c.designation_bound_build_contract.build_recipe_contract.builder_runtime_identity_required_fields.pop(), /builder runtime identity fields/],
    ['recipe and lock may fall outside the source closure', (c) => { c.designation_bound_build_contract.build_recipe_contract.recipe_and_toolchain_lock_must_be_members_of_source_closure = false; }, /recipe and lock source-closure membership/],
    ['preexisting output may enter the build source closure', (c) => { c.designation_bound_build_contract.build_recipe_contract.build_output_path_must_not_be_member_of_source_closure = false; }, /build output source-closure exclusion/],
    ['schema falsely claims current cross-environment reproducibility', (c) => { c.designation_bound_build_contract.build_recipe_contract.hermeticity_and_cross_environment_reproducibility_claim_currently_allowed = true; }, /hermeticity_and_cross_environment_reproducibility_claim_currently_allowed must remain false|current hermeticity claim/],
    ['builder identity materialization blocker is removed', (c) => { c.designation_bound_build_contract.build_recipe_contract.materialization_blocked_until_builder_identity_and_archive_normalization_implemented = false; }, /builder identity materialization blocker/],
    ['R0 B2 materialization validator is falsely implemented', (c) => { c.decision_authority_bootstrap.r0_b2_materialization_validator_status = 'implemented'; }, /R0\/B2 materialization validator status/],
    ['R0 proceeds without the materialization validator', (c) => { c.decision_authority_bootstrap.r0_must_not_proceed_before_materialization_validator = false; }, /R0 materialization validator gate/],
  ];
  for (const [name, mutate, pattern] of cases) {
    await t.test(name, () =>
      withFixture(
        {
          mutate(root) {
            const value = readJson(root, ROOT_PATH);
            mutate(value.successor_transition_contract);
            writeJson(root, ROOT_PATH, value);
          },
        },
        (root) => assert.throws(() => validateUnreviewedFixture(root), pattern),
      ));
  }
});

test('rejects omission of a newly disclosed fail-closed global blocker', () =>
  withFixture(
    {
      mutate(root) {
        const value = readJson(root, ROOT_PATH);
        value.global_blockers = value.global_blockers.filter(
          (blocker) => blocker !== 'protected_decision_validity_policy_and_evaluator_missing',
        );
        writeJson(root, ROOT_PATH, value);
      },
    },
    (root) => assert.throws(() => validateUnreviewedFixture(root), /global_blockers/),
  ));

test('rejects arbitrary compatibility value classes in the current typed registry', () =>
  withFixture(
    {
      mutate(root) {
        const value = readJson(root, ROOT_PATH);
        value.current_requirement_registry.requirements_by_id[
          'compatibility-cp-ba-platform-browser'
        ].allowed_value_class = 'receiver_or_owner_arbitrary_key';
        recomputeCurrentRequirementInventory(value);
        writeJson(root, ROOT_PATH, value);
      },
    },
    (root) =>
      assert.throws(
        () => validateUnreviewedFixture(root),
        /reviewed current requirement inventory digest|registry allowed value class/,
      ),
  ));

test('rejects current materialization of a reserved future decision artifact', () =>
  withFixture(
    {
      mutate(root) {
        const decisionPath = path.join(
          root,
          'docs/design/decisions/mobile-ux-batch1-cohort-designation-v1.json',
        );
        fs.mkdirSync(path.dirname(decisionPath), {recursive: true});
        fs.writeFileSync(decisionPath, '{}\n');
      },
    },
    (root) =>
      assert.throws(
        () => validateUnreviewedFixture(root),
        /future decision artifact must be absent before freeze/,
      ),
  ));

test('rejects a missing, reordered, renamed, or re-owned ledger obligation', async (t) => {
  const cases = [
    ['missing', (value) => value.obligation_records.pop(), /exactly 173/],
    ['reordered', (value) => value.obligation_records.splice(0, 2, value.obligation_records[1], value.obligation_records[0]), /obligation_id/],
    ['renamed', (value) => { value.obligation_records[0].title += ' changed'; }, /title/],
    ['re-owned', (value) => { value.obligation_records[0].authority_codes = ['A-WEB']; }, /authority_codes/],
  ];
  for (const [name, mutate, pattern] of cases) {
    await t.test(name, () =>
      withFixture(
        {
          mutate(root) {
            const value = readJson(root, CP_BA_PATH);
            mutate(value);
            writeJson(root, CP_BA_PATH, value);
          },
        },
        (root) => assert.throws(() => validateUnreviewedFixture(root), pattern),
      ));
  }
});

test('rejects wildcard bindings and duplicate binding IDs', async (t) => {
  await t.test('wildcard', () =>
    withFixture(
      {
        mutate(root) {
          const value = readJson(root, CP_BA_PATH);
          value.obligation_records[0].bindings[0].reason_code = 'match-*';
          writeJson(root, CP_BA_PATH, value);
        },
      },
      (root) => assert.throws(() => validateUnreviewedFixture(root), /wildcard/),
    ));
  await t.test('duplicate binding id', () =>
    withFixture(
      {
        mutate(root) {
          const value = readJson(root, CP_BA_PATH);
          value.obligation_records[1].bindings[0].binding_id = value.obligation_records[0].bindings[0].binding_id;
          writeJson(root, CP_BA_PATH, value);
        },
      },
      (root) => assert.throws(() => validateUnreviewedFixture(root), /binding_id/),
    ));
});

test('rejects owner-backed exclusion combined with a primary lane binding', () =>
  withFixture(
    {
      mutate(root) {
        const value = readJson(root, CP_CS_PATH);
        const record = value.obligation_records.find(
          (entry) => entry.owner_backed_exclusion && entry.bindings.length > 0,
        );
        assert.ok(record, 'fixture must contain an excluded record with the managed overlay');
        record.bindings[0].coverage_role = 'primary_required';
        writeJson(root, CP_CS_PATH, value);
      },
    },
    (root) => assert.throws(() => validateUnreviewedFixture(root), /cannot combine/),
  ));

test('rejects managed overlay drift from the exact 91 obligations', () =>
  withFixture(
    {
      mutate(root) {
        const value = readJson(root, CP_CS_PATH);
        const overlay = value.profile_overlays.find((entry) => entry.profile_id === 'receiver_managed');
        assert.ok(overlay);
        overlay.exact_obligation_ids.pop();
        writeJson(root, CP_CS_PATH, value);
      },
    },
    (root) => assert.throws(() => validateUnreviewedFixture(root), /91-obligation/),
  ));

test('rejects count-preserving exclusion and managed-overlay swaps', async (t) => {
  await t.test('exact exclusion swap', () =>
    withFixture(
      {
        mutate(root) {
          const value = readJson(root, CP_CS_PATH);
          const excluded = value.obligation_records.find((entry) => entry.obligation_id === 'STATS-06');
          const included = value.obligation_records.find((entry) => entry.obligation_id === 'STATS-05');
          assert.equal(excluded.bindings.length, 0);
          assert.ok(excluded.owner_backed_exclusion);
          const primaryBindings = included.bindings.map((binding) => ({
            ...binding,
            binding_id: binding.binding_id.replace('::STATS-05::', '::STATS-06::'),
          }));
          const exclusion = excluded.owner_backed_exclusion;
          const disposition = excluded.disposition;
          delete excluded.owner_backed_exclusion;
          excluded.bindings = primaryBindings;
          excluded.disposition = included.disposition;
          included.bindings = [];
          included.owner_backed_exclusion = exclusion;
          included.disposition = disposition;
          writeJson(root, CP_CS_PATH, value);
        },
      },
      (root) =>
        assert.throws(
          () => validateUnreviewedFixture(root),
          /exact owner-backed exclusion IDs|not allowed for non-excluded|partition semantic digest/,
        ),
    ));

  await t.test('exact managed overlay swap', () =>
    withFixture(
      {
        mutate(root) {
          const value = readJson(root, CP_CS_PATH);
          const overlay = value.profile_overlays.find((entry) => entry.profile_id === 'receiver_managed');
          const inside = value.obligation_records.find((entry) => entry.obligation_id === 'LEARN-01');
          const outside = value.obligation_records.find((entry) => entry.obligation_id === 'SHELL-01');
          const managedIndex = inside.bindings.findIndex(
            (binding) =>
              binding.profile_id === 'receiver_managed' &&
              binding.coverage_role === 'cross_dimension_required',
          );
          const [managedBinding] = inside.bindings.splice(managedIndex, 1);
          outside.bindings.push({
            ...managedBinding,
            binding_id: managedBinding.binding_id.replace('::LEARN-01::', '::SHELL-01::'),
          });
          overlay.exact_obligation_ids[0] = 'SHELL-01';
          writeJson(root, CP_CS_PATH, value);
        },
      },
      (root) =>
        assert.throws(
          () => validateUnreviewedFixture(root),
          /receiver_managed exact IDs|partition semantic digest/,
        ),
    ));
});

test('rejects count-preserving binding reason and cross-device target drift', async (t) => {
  await t.test('binding reason', () =>
    withFixture(
      {
        mutate(root) {
          const value = readJson(root, CP_WEB_PATH);
          value.obligation_records[0].bindings[0].reason_code = 'plausible_but_unreviewed_reason';
          writeJson(root, CP_WEB_PATH, value);
        },
      },
      (root) =>
        assert.throws(
          () => validateUnreviewedFixture(root),
          /partition semantic digest|partition_summary\.partition_digest/,
        ),
    ));
  await t.test('cross-device target order', () =>
    withFixture(
      {
        mutate(root) {
          const value = readJson(root, CP_CS_PATH);
          const record = value.obligation_records.find((entry) =>
            entry.bindings.some((binding) => binding.lane_id === 'cs-cross-device-reconciliation'),
          );
          const indexes = record.bindings
            .map((binding, index) => ({binding, index}))
            .filter(({binding}) => binding.lane_id === 'cs-cross-device-reconciliation')
            .map(({index}) => index);
          [record.bindings[indexes[1]], record.bindings[indexes[2]]] = [
            record.bindings[indexes[2]],
            record.bindings[indexes[1]],
          ];
          writeJson(root, CP_CS_PATH, value);
        },
      },
      (root) => assert.throws(() => validateUnreviewedFixture(root), /cross-device AND targets/),
    ));
});

test('rejects a CP-BA shared lane that claims a platform target', () =>
  withFixture(
    {
      mutate(root) {
        const value = readJson(root, CP_BA_PATH);
        const lane = value.lane_definitions.find((entry) => entry.lane_kind.startsWith('shared_'));
        assert.ok(lane, 'fixture must contain a shared CP-BA lane');
        lane.target_ids.push('ba-ios-phone-browser');
        writeJson(root, CP_BA_PATH, value);
      },
    },
    (root) => assert.throws(() => validateUnreviewedFixture(root), /must not fill a platform target/),
  ));

test('rejects COV-13 unless it binds the exact ordered 12 PW rows', () =>
  withFixture(
    {
      mutate(root) {
        const value = readJson(root, CP_WEB_PATH);
        const record = value.obligation_records.find((entry) => entry.obligation_id === 'COV-13');
        const matrixIndexes = record.bindings
          .map((binding, index) => ({binding, index}))
          .filter(({binding}) => binding.coverage_role === 'cp_web_matrix_and_required')
          .map(({index}) => index);
        assert.equal(matrixIndexes.length, 12);
        [record.bindings[matrixIndexes[0]], record.bindings[matrixIndexes[1]]] = [
          record.bindings[matrixIndexes[1]],
          record.bindings[matrixIndexes[0]],
        ];
        writeJson(root, CP_WEB_PATH, value);
      },
    },
    (root) => assert.throws(() => validateUnreviewedFixture(root), /COV-13 target rows/),
  ));

test('rejects manifest traversal, positive authority, and summary laundering', async (t) => {
  const cases = [
    [
      'manifest traversal',
      MANIFEST_CATALOG_PATH,
      (value) => { value.reservations[0].planned_path = '../escape.json'; },
      /planned_path|traversal|exact ordered/,
    ],
    [
      'positive authority',
      CP_WEB_PATH,
      (value) => { value.authority.execution = true; },
      /authority\.execution must remain false/,
    ],
    [
      'summary laundering',
      CP_WEB_PATH,
      (value) => { value.partition_summary.binding_count += 1; },
      /partition_summary\.binding_count/,
    ],
  ];
  for (const [name, relativePath, mutate, pattern] of cases) {
    await t.test(name, () =>
      withFixture(
        {
          mutate(root) {
            const value = readJson(root, relativePath);
            mutate(value);
            writeJson(root, relativePath, value);
          },
        },
        (root) => assert.throws(() => validateUnreviewedFixture(root), pattern),
      ));
  }
});

test('rejects unresolved-instance omission, category laundering, and split-ref collapse', async (t) => {
  const cases = [
    [
      'omitted physical instance',
      (value) => value.v1_unresolved_instance_migration.instances.pop(),
      /exactly 115|115 rows/,
    ],
    [
      'category laundering with unchanged total',
      (value) => {
        const instances = value.v1_unresolved_instance_migration.instances;
        const machine = instances.find((entry) => entry.category === 'machine_local_privacy_safe');
        const external = instances.find((entry) => entry.category === 'external_account_environment');
        [machine.category, external.category] = [external.category, machine.category];
        [machine.v2_binding_ref, external.v2_binding_ref] = [
          external.v2_binding_ref,
          machine.v2_binding_ref,
        ];
      },
      /\.category/,
    ],
    [
      'physical device/build split collapsed',
      (value) => {
        const instance = value.v1_unresolved_instance_migration.instances.find(
          (entry) => entry.reason_code === 'physical_device_and_build_identity_missing',
        );
        instance.future_required_refs = ['system_slot_ref'];
      },
      /future_required_refs/,
    ],
    [
      'reference contract denylist weakened',
      (value) => {
        value.v1_unresolved_instance_migration.reference_contracts[0].forbidden_fields.pop();
      },
      /forbidden_fields|reference_contracts exact semantic digest/,
    ],
  ];
  for (const [name, mutate, pattern] of cases) {
    await t.test(name, () =>
      withFixture(
        {
          mutate(root) {
            const value = readJson(root, ROOT_PATH);
            mutate(value);
            writeJson(root, ROOT_PATH, value);
          },
        },
        (root) => assert.throws(() => validateUnreviewedFixture(root), pattern),
      ));
  }
});

test('rejects current-requirement semantic laundering even when its self digest is recomputed', async (t) => {
  const cases = [
    [
      'generic discriminator',
      (registry) => {
        const requirement = Object.values(registry.requirements_by_id).find(
          (entry) => entry.requirement_kind === 'target',
        );
        requirement.subject_discriminator = {plausible_subject: 'generic-target'};
      },
    ],
    [
      'allowed value class drift',
      (registry) => {
        const requirement = Object.values(registry.requirements_by_id).find(
          (entry) => entry.requirement_kind === 'provider_lane',
        );
        requirement.allowed_value_class = 'plausible_but_unreviewed_provider_class';
      },
    ],
    [
      'valid but wrong source pointer',
      (registry) => {
        const requirement = Object.values(registry.requirements_by_id).find(
          (entry) => entry.source_binding.path === CP_BA_PATH,
        );
        requirement.source_binding.locator = '/lane_definitions/1';
      },
    ],
    [
      'meaningful content drift',
      (registry) => {
        const requirement = Object.values(registry.requirements_by_id).find(
          (entry) => entry.requirement_kind === 'compatibility',
        );
        requirement.subject_discriminator.reviewed_compatibility_cohort = 'self_recomputed_laundering';
      },
    ],
    [
      'CP-BA build reintroduces the final-freeze dependency cycle',
      (registry) => {
        registry.requirements_by_id['build-cp-ba-browser-documents']
          .subject_discriminator.candidate.reason_code = 'future_manifest_decision_commit_missing';
      },
    ],
    [
      'one current requirement is prematurely marked resolved',
      (registry) => {
        registry.requirements_by_id['window-cp-ba'].status = 'typed_value_resolved';
      },
    ],
    [
      'one current requirement gains freeze authority',
      (registry) => {
        registry.requirements_by_id['window-cp-ba'].authority.freeze = true;
      },
    ],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, () =>
      withFixture(
        {
          mutate(root) {
            const value = readJson(root, ROOT_PATH);
            mutate(value.current_requirement_registry);
            recomputeCurrentRequirementInventory(value);
            writeJson(root, ROOT_PATH, value);
          },
        },
        (root) =>
          assert.throws(
            () => validateUnreviewedFixture(root),
            /reviewed current requirement inventory digest|subject_discriminator|allowed_value_class|status|must remain false/,
          ),
      ));
  }
});

test('rejects aggregate bindings that are not the exact ordered execution-lane union', async (t) => {
  const cases = [
    [
      'missing execution requirement',
      (value) => value.current_requirement_registry.aggregate_bindings[0]
        .requirement_bindings.target_requirement_refs.pop(),
    ],
    [
      'reordered execution requirements',
      (value) => {
        const refs = value.current_requirement_registry.aggregate_bindings[1]
          .requirement_bindings.product_profile_subject_requirement_refs;
        [refs[0], refs[1]] = [refs[1], refs[0]];
      },
    ],
    [
      'foreign placeholder-lane requirement',
      (value) => {
        const foreign = readJson(SOURCE_ROOT, CP_BA_PATH).lane_definitions[0]
          .requirement_bindings.target_requirement_refs[0];
        value.current_requirement_registry.aggregate_bindings[0]
          .requirement_bindings.target_requirement_refs.push(foreign);
      },
    ],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, () =>
      withFixture(
        {
          mutate(root) {
            const value = readJson(root, ROOT_PATH);
            mutate(value);
            writeJson(root, ROOT_PATH, value);
          },
        },
        (root) =>
          assert.throws(
            () => validateUnreviewedFixture(root),
            /exact ordered scenario-lane union/,
          ),
      ));
  }
});

test('rejects every attempted expansion of the pending PW specialist scope', async (t) => {
  const cases = [
    [
      'ordinary obligation receives a matrix execution binding',
      (value) => {
        const source = value.obligation_records
          .find((entry) => entry.obligation_id === 'COV-13')
          .bindings.find((binding) => binding.coverage_role === 'cp_web_matrix_and_required');
        const ordinary = value.obligation_records.find((entry) => entry.obligation_id === 'SHELL-01');
        ordinary.bindings.push({
          ...structuredClone(source),
          binding_id: source.binding_id.replace('::COV-13::', '::SHELL-01::'),
        });
      },
      /cannot bind a pending PW execution row/,
    ],
    [
      'COV-13 loses one required row',
      (value) => {
        const record = value.obligation_records.find((entry) => entry.obligation_id === 'COV-13');
        const index = record.bindings.findIndex(
          (binding) => binding.coverage_role === 'cp_web_matrix_and_required',
        );
        record.bindings.splice(index, 1);
      },
      /COV-13 target rows/,
    ],
    [
      'mechanical minimum is expanded',
      (value) => {
        const lane = value.lane_definitions.find((entry) => entry.lane_kind === 'pc_web');
        lane.mechanically_certain_minimum.obligation_ids.push('SHELL-01');
        lane.mechanically_certain_minimum.obligation_count = 2;
      },
      /minimum\.obligation_ids|minimum\.obligation_count/,
    ],
    [
      'pending exact scope is falsely marked resolved',
      (value) => {
        value.lane_definitions.find((entry) => entry.lane_kind === 'pc_web').exact_scope_status =
          'owner_value_resolved';
      },
      /exact_scope_status/,
    ],
    [
      'semantic mapping lane gains an execution cohort ref',
      (value) => {
        const mapping = value.lane_definitions.find(
          (entry) => entry.lane_kind === 'semantic_region_mapping',
        );
        const specialist = value.lane_definitions.find((entry) => entry.lane_kind === 'pc_web');
        mapping.requirement_bindings.environment_requirement_refs = structuredClone(
          specialist.requirement_bindings.environment_requirement_refs,
        );
      },
      /must not create an execution cohort/,
    ],
  ];
  for (const [name, mutate, pattern] of cases) {
    await t.test(name, () =>
      withFixture(
        {
          mutate(root) {
            const value = readJson(root, CP_WEB_PATH);
            mutate(value);
            writeJson(root, CP_WEB_PATH, value);
          },
        },
        (root) => assert.throws(() => validateUnreviewedFixture(root), pattern),
      ));
  }
});

test('rejects generic, whole-file, and byte-drifted CP-CS exclusion sources', async (t) => {
  const cases = [
    [
      'generic rationale',
      (root, value) => {
        value.obligation_records.find((entry) => entry.owner_backed_exclusion)
          .owner_backed_exclusion.obligation_specific_semantic_rationale =
          'This item is not applicable for a generic reason repeated without any obligation-specific semantic owner boundary.';
        recomputeEmbeddedPartitionDigest(value);
      },
      /partition semantic digest/,
    ],
    [
      'whole-file locator',
      (root, value) => {
        value.obligation_records.find((entry) => entry.owner_backed_exclusion)
          .owner_backed_exclusion.owner_source_anchors[0].locator = '';
      },
      /locator must be a non-empty/,
    ],
    [
      'owner source byte drift',
      (root) => fs.appendFileSync(path.join(root, 'spec/product-core.json'), ' '),
      /raw_sha256/,
    ],
  ];
  for (const [name, mutate, pattern] of cases) {
    await t.test(name, () =>
      withFixture(
        {
          mutate(root) {
            const value = readJson(root, CP_CS_PATH);
            mutate(root, value);
            writeJson(root, CP_CS_PATH, value);
          },
        },
        (root) => assert.throws(() => validateUnreviewedFixture(root), pattern),
      ));
  }
});

test('rejects historical migration authority escalation and typed-contract drift', async (t) => {
  const cases = [
    [
      'preparation resolution points at generic authority',
      (migration) => {
        migration.instances[0].v2_binding_ref = `${ROOT_PATH}#/authority`;
      },
      /scope|preparation authority/,
    ],
    [
      'non-freeze effect is escalated',
      (migration) => {
        migration.instances[0].resolution_effect = 'schema_preparation_and_freeze_authority';
      },
      /resolution_effect/,
    ],
    [
      'external resource subtype is omitted',
      (migration) => {
        migration.reference_contracts[1].resource_kind_definitions.pop();
      },
      /resource_kind_definitions|does not resolve/,
    ],
    [
      'external subtype classification is swapped',
      (migration) => {
        const definitions = migration.reference_contracts[1].resource_kind_definitions;
        [definitions[0].classification_token, definitions[1].classification_token] = [
          definitions[1].classification_token,
          definitions[0].classification_token,
        ];
      },
      /classification_token/,
    ],
    [
      'physical build ref names the wrong typed requirement',
      (migration) => {
        const instance = migration.instances.find(
          (entry) => entry.reason_code === 'physical_device_and_build_identity_missing',
        );
        instance.future_required_refs[1].requirement_id = 'build-cp-web-production-like';
      },
      /requirement_id/,
    ],
  ];
  for (const [name, mutate, pattern] of cases) {
    await t.test(name, () =>
      withFixture(
        {
          mutate(root) {
            const value = readJson(root, ROOT_PATH);
            mutate(value.v1_unresolved_instance_migration);
            writeJson(root, ROOT_PATH, value);
          },
        },
        (root) => assert.throws(() => validateUnreviewedFixture(root), pattern),
      ));
  }
});

test('tracked mode rejects executable mode and post-commit raw-byte drift', async (t) => {
  await t.test('executable JSON mode', () =>
    withFixture(
      {
        mutate(root) {
          fs.chmodSync(path.join(root, CP_BA_PATH), 0o755);
        },
        tracked: true,
      },
      (root) => assert.throws(() => validateBatch1FreezeCandidate({root, requireTracked: true}), /mode 100644/),
    ));
  await t.test('raw worktree drift', () =>
    withFixture(
      {
        tracked: true,
        mutateAfterCommit(root) {
          fs.appendFileSync(path.join(root, CP_BA_PATH), ' ');
        },
      },
      (root) => assert.throws(() => validateBatch1FreezeCandidate({root, requireTracked: true}), /worktree bytes/),
    ));
  await t.test('foreign origin', () =>
    withFixture(
      {
        tracked: true,
        mutateAfterCommit(root) {
          run(
            root,
            ['git', 'remote', 'set-url', 'origin', 'https://github.com/example/foreign.git'],
            'git set foreign origin',
          );
        },
      },
      (root) =>
        assert.throws(
          () => validateBatch1FreezeCandidate({root, requireTracked: true}),
          /LENKIN233\/softbook_cet GitHub origin/,
        ),
    ));
  await t.test('fresh root commit without approved ancestry', () =>
    withFixture({}, (root) => {
      run(root, ['git', 'init', '-q'], 'git init');
      run(root, ['git', 'config', 'user.name', 'Foreign Fixture'], 'git config name');
      run(root, ['git', 'config', 'user.email', 'foreign-fixture@example.invalid'], 'git config email');
      run(
        root,
        ['git', 'remote', 'add', 'origin', 'https://github.com/LENKIN233/softbook_cet.git'],
        'git remote add expected origin',
      );
      run(root, ['git', 'add', '--', '.'], 'git add');
      run(root, ['git', 'commit', '-q', '-m', 'foreign root fixture'], 'git commit');
      assert.throws(
        () => validateBatch1FreezeCandidate({root, requireTracked: true}),
        /Batch 1 approved preparation head must be reachable/,
      );
    }));
});

test('tracked mode rejects semantic-source provenance drift and untracked exact-byte injection', async (t) => {
  const domainSource = 'infra/cloudbase/auth-v2-runtime-contract.md';
  await t.test('domain source heading retained but worktree bytes dirty', () =>
    withFixture(
      {
        tracked: true,
        mutateAfterCommit(root) {
          fs.appendFileSync(path.join(root, domainSource), '\n<!-- post-commit dirty -->\n');
        },
      },
      (root) =>
        assert.throws(
          () => validateBatch1FreezeCandidate({root, requireTracked: true}),
          /worktree bytes must exactly match the tracked HEAD blob/,
        ),
    ));

  await t.test('domain source index-only mutation cannot replace HEAD bytes', () =>
    withFixture(
      {
        tracked: true,
        mutateAfterCommit(root) {
          fs.appendFileSync(path.join(root, domainSource), '\n<!-- staged but not committed -->\n');
          run(root, ['git', 'add', '--', domainSource], 'stage domain source drift');
        },
      },
      (root) =>
        assert.throws(
          () => validateBatch1FreezeCandidate({root, requireTracked: true}),
          /worktree bytes must exactly match the tracked HEAD blob/,
        ),
    ));

  await t.test('domain source executable HEAD mode is rejected', () =>
    withFixture(
      {
        mutate(root) {
          fs.chmodSync(path.join(root, domainSource), 0o755);
        },
        tracked: true,
      },
      (root) =>
        assert.throws(
          () => validateBatch1FreezeCandidate({root, requireTracked: true}),
          /mode 100644/,
        ),
    ));

  await t.test('domain source symlink is rejected before use', () =>
    withFixture(
      {
        tracked: true,
        mutateAfterCommit(root) {
          fs.unlinkSync(path.join(root, domainSource));
          fs.symlinkSync(path.join(root, 'spec/product-core.json'), path.join(root, domainSource));
        },
      },
      (root) =>
        assert.throws(
          () => validateBatch1FreezeCandidate({root, requireTracked: true}),
          /must not traverse a symlink/,
        ),
    ));

  const untrackedInjectionCases = [
    ['v1 registry', `${BATCH1_DIRECTORY}/cp-cs.registry.v1.json`],
    ['CP-CS exclusion owner source', 'spec/product-core.json'],
    ['CP-CS domain source', domainSource],
    ['ledger source', LEDGER_RELATIVE_PATH],
  ];
  for (const [name, sourcePath] of untrackedInjectionCases) {
    await t.test(`${name} exact bytes cannot be re-injected as untracked`, () =>
      withFixture(
        {
          tracked: true,
          mutateAfterCommit(root) {
            run(root, ['git', 'rm', '--cached', '--', sourcePath], `untrack ${name}`);
            run(root, ['git', 'commit', '-q', '-m', `remove tracked ${name}`], `commit ${name} removal`);
          },
        },
        (root) =>
          assert.throws(
            () => validateBatch1FreezeCandidate({root, requireTracked: true}),
            /must be tracked/,
          ),
      ));
  }
});
