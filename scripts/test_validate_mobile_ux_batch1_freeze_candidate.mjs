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
    for (const [key, value] of Object.entries(result)) {
      if (/(?:authorized|eligible)$/.test(key)) assert.equal(value, false, key);
    }
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
            /reviewed current requirement inventory digest|subject_discriminator|allowed_value_class/,
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
