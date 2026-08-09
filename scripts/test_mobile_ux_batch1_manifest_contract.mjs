#!/usr/bin/env node

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {parseStrictJson} from './lib/strict_json.mjs';
import {
  FREEZE_CANDIDATE_PATHS,
  MANIFEST_CATALOG_PATH,
  SUBJECT_DIGEST_DOMAIN,
  assertSafeRelativePath,
  domainSeparatedSubjectDigest,
  expectedManifestReservations,
  readRegularFile,
  resolveContainedNoSymlink,
  validateManifestSchemaCatalog,
} from './lib/mobile_ux_batch1_manifest_contract.mjs';
import {
  ExecutionManifestBlockedError,
  validateBatch1ExecutionManifest,
} from './validate_mobile_ux_batch1_execution_manifest.mjs';

const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('derives the exact 35 reservations from the reviewed v1 set plus two explicit CP-CS gaps', () => {
  const reservations = expectedManifestReservations(SOURCE_ROOT);
  assert.equal(reservations.length, 35);
  assert.equal(new Set(reservations.map((entry) => entry.manifest_id)).size, 35);
  assert.equal(new Set(reservations.map((entry) => entry.planned_path)).size, 35);
  assert.ok(
    reservations.some((entry) => entry.manifest_id === 'manifest-cs-statistics-canonical-read-v1'),
  );
  assert.ok(reservations.some((entry) => entry.manifest_id === 'manifest-cs-account-lifecycle-v1'));
});

test('computes a domain-separated digest over exact ordered paths, lengths, and raw bytes', () => {
  const artifactBytes = new Map(
    FREEZE_CANDIDATE_PATHS.map((relativePath, index) => [relativePath, Buffer.from(`fixture-${index}\n`)]),
  );
  const chunks = [Buffer.from(`${SUBJECT_DIGEST_DOMAIN}\0`, 'utf8')];
  for (const relativePath of FREEZE_CANDIDATE_PATHS) {
    const bytes = artifactBytes.get(relativePath);
    chunks.push(Buffer.from(`${Buffer.byteLength(relativePath)}:${relativePath}\0${bytes.length}:`, 'utf8'));
    chunks.push(bytes, Buffer.from('\0', 'utf8'));
  }
  const expected = createHash('sha256').update(Buffer.concat(chunks)).digest('hex');
  assert.equal(domainSeparatedSubjectDigest(artifactBytes), expected);
  artifactBytes.set(FREEZE_CANDIDATE_PATHS[2], Buffer.from('fixture-mutated\n'));
  assert.notEqual(domainSeparatedSubjectDigest(artifactBytes), expected);
});

test('rejects traversal, absolute paths, backslashes, and symlink ancestors', () => {
  for (const invalid of ['../escape.json', '/tmp/escape.json', 'a\\b.json', 'a/./b.json', 'a//b.json']) {
    assert.throws(() => assertSafeRelativePath(invalid, 'fixture path'), /relative|component|normalized/);
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-batch1-path-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-batch1-outside-'));
  try {
    fs.symlinkSync(outside, path.join(root, 'linked'));
    assert.throws(
      () => resolveContainedNoSymlink(root, 'linked/manifest.json', 'fixture symlink', {mustExist: false}),
      /symlink/,
    );
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
    fs.rmSync(outside, {recursive: true, force: true});
  }
});

test('validates the catalog as schema-only and rejects generic or missing type contracts', () => {
  const catalog = parseStrictJson(
    readRegularFile(SOURCE_ROOT, MANIFEST_CATALOG_PATH, MANIFEST_CATALOG_PATH),
    MANIFEST_CATALOG_PATH,
  );
  const result = validateManifestSchemaCatalog(SOURCE_ROOT, catalog, {requireTracked: false});
  assert.equal(result.reservationCount, 35);
  const missing = structuredClone(catalog);
  missing.manifest_type_definitions.pop();
  assert.throws(
    () => validateManifestSchemaCatalog(SOURCE_ROOT, missing, {requireTracked: false}),
    /12|definition|semantic_validator/,
  );
  const generic = structuredClone(catalog);
  const csScenario = generic.manifest_type_definitions.find(
    (definition) => definition.schema_id === 'future-cp-cs-scenario-v1',
  );
  assert.ok(csScenario, 'catalog must define the CP-CS scenario contract');
  csScenario.required_type_fields = [];
  assert.throws(
    () => validateManifestSchemaCatalog(SOURCE_ROOT, generic, {requireTracked: false}),
    /required_type_fields|definition/,
  );
});

test('rejects catalog source, field-role, domain, and exact-reservation laundering', async (t) => {
  const original = parseStrictJson(
    readRegularFile(SOURCE_ROOT, MANIFEST_CATALOG_PATH, MANIFEST_CATALOG_PATH),
    MANIFEST_CATALOG_PATH,
  );
  const cases = [
    [
      'registry source hash drift',
      (catalog) => { catalog.registry_sources[0].raw_sha256 = '0'.repeat(64); },
      /registry_sources\[0\]\.raw_sha256/,
    ],
    [
      'registry source path drift',
      (catalog) => { catalog.registry_sources[0].path = catalog.registry_sources[1].path; },
      /registry_sources\[0\]\.path/,
    ],
    [
      'scenario raw-artifact field removed',
      (catalog) => {
        catalog.scenario_required_common_fields = catalog.scenario_required_common_fields.filter(
          (field) => field !== 'raw_artifact_records',
        );
      },
      /scenario_required_common_fields/,
    ],
    [
      'aggregation illegally gains raw artifacts',
      (catalog) => { catalog.aggregation_required_common_fields.push('raw_artifact_records'); },
      /aggregation_required_common_fields/,
    ],
    [
      'aggregation child record loses expiry',
      (catalog) => {
        catalog.aggregation_child_manifest_record_contract.required_fields.pop();
      },
      /aggregation_child_manifest_record_contract\.required_fields/,
    ],
    [
      'compatibility map is no longer singular',
      (catalog) => { catalog.compatibility_map_contract.cardinality = 'one_or_more'; },
      /compatibility map cardinality/,
    ],
    [
      'CP-CS domain field removed',
      (catalog) => {
        const definition = catalog.manifest_type_definitions.find(
          (entry) => entry.schema_id === 'future-cp-cs-scenario-v1',
        );
        delete definition.scenario_domain_contracts[0].required_domain_fields;
      },
      /domain contracts\[0\] keys mismatch/,
    ],
    [
      'one of 14 CP-CS domains is omitted',
      (catalog) => {
        catalog.manifest_type_definitions.find(
          (entry) => entry.schema_id === 'future-cp-cs-scenario-v1',
        ).scenario_domain_contracts.pop();
      },
      /exactly 14 domain contracts/,
    ],
    [
      'CP-CS domain provider swapped',
      (catalog) => {
        const contracts = catalog.manifest_type_definitions.find(
          (entry) => entry.schema_id === 'future-cp-cs-scenario-v1',
        ).scenario_domain_contracts;
        [contracts[0].allowed_exact_provider_lanes, contracts[1].allowed_exact_provider_lanes] = [
          contracts[1].allowed_exact_provider_lanes,
          contracts[0].allowed_exact_provider_lanes,
        ];
      },
      /allowed_exact_provider_lanes/,
    ],
    [
      'CP-CS owner heading dangles',
      (catalog) => {
        const contract = catalog.manifest_type_definitions.find(
          (entry) => entry.schema_id === 'future-cp-cs-scenario-v1',
        ).scenario_domain_contracts[0];
        contract.semantic_owner_and_runtime_refs[1].locator = 'Definitely Missing Heading';
      },
      /Markdown heading does not resolve/,
    ],
    [
      'CP-CS exact anchor hash omitted',
      (catalog) => {
        const anchor = catalog.manifest_type_definitions.find(
          (entry) => entry.schema_id === 'future-cp-cs-scenario-v1',
        ).scenario_domain_contracts[0].semantic_owner_and_runtime_refs[0];
        delete anchor.raw_sha256;
      },
      /semantic_owner_and_runtime_refs\[0\] keys mismatch/,
    ],
    [
      'CP-CS exact anchor hash is wrong',
      (catalog) => {
        const anchor = catalog.manifest_type_definitions.find(
          (entry) => entry.schema_id === 'future-cp-cs-scenario-v1',
        ).scenario_domain_contracts[0].semantic_owner_and_runtime_refs[0];
        anchor.raw_sha256 = '0'.repeat(64);
      },
      /semantic_owner_and_runtime_refs\[0\]\.raw_sha256/,
    ],
    [
      'legacy string source injection',
      (catalog) => {
        const contract = catalog.manifest_type_definitions.find(
          (entry) => entry.schema_id === 'future-cp-cs-scenario-v1',
        ).scenario_domain_contracts[0];
        contract.semantic_owner_and_runtime_refs[0] =
          'spec/account-sync-contract.json#/authentication';
      },
      /semantic_owner_and_runtime_refs\[0\] must be an object/,
    ],
    [
      'locator kind and source type disagree',
      (catalog) => {
        const anchor = catalog.manifest_type_definitions.find(
          (entry) => entry.schema_id === 'future-cp-cs-scenario-v1',
        ).scenario_domain_contracts[0].semantic_owner_and_runtime_refs[0];
        anchor.locator_kind = 'heading';
      },
      /heading anchor must name a Markdown source/,
    ],
    [
      'reservation provider discriminator mismatch',
      (catalog) => { catalog.reservations[0].exact_binding.provider_lanes[0] = 'receiver_runtime'; },
      /provider\/domain discriminator pairing|provider_lanes/,
    ],
    [
      'reservation target is not its cohort target',
      (catalog) => {
        const reservation = catalog.reservations.find(
          (entry) => entry.scenario_id === 'cs-auth-sms-session',
        );
        reservation.exact_binding.target_ids = ['cs-ios-phone-client'];
        reservation.exact_binding.system_subject_requirement_ids = ['cs-ios-phone-client'];
      },
      /target_ids is not lane-backed|CP-CS exact targets/,
    ],
    [
      'reservation product profile is not its cohort profile',
      (catalog) => {
        const reservation = catalog.reservations.find(
          (entry) => entry.scenario_id === 'cs-auth-sms-session',
        );
        reservation.exact_binding.product_profile_subjects = ['formal_account_access'];
      },
      /product_profile_subjects is not lane-backed|CP-CS exact product/,
    ],
    [
      'PW reservation matrix row mismatch',
      (catalog) => {
        const reservation = catalog.reservations.find(
          (entry) => entry.scenario_id === 'PW-VIEWPORT-01',
        );
        reservation.exact_binding.matrix_row_ids = ['PW-VIEWPORT-02'];
      },
      /matrix_row_ids/,
    ],
    [
      'reservation cohort points to setup lane',
      (catalog) => {
        const reservation = catalog.reservations.find(
          (entry) => entry.scenario_id === 'PW-VIEWPORT-01',
        );
        reservation.exact_binding.lane_ids = ['cp-web-semantic-region-mapping'];
      },
      /lane-backed|unresolved lane requirement/,
    ],
    [
      'reservation exact discriminator removed',
      (catalog) => { delete catalog.reservations[0].exact_binding.system_subject_requirement_ids; },
      /exact_binding keys mismatch/,
    ],
    [
      'aggregate omits a child cohort subject',
      (catalog) => {
        const aggregate = catalog.reservations.find(
          (entry) => entry.manifest_id === 'manifest-cp-cs-aggregate-v1',
        );
        aggregate.exact_binding.target_ids.pop();
        aggregate.exact_binding.system_subject_requirement_ids.pop();
      },
      /exact ordered scenario union|reviewed semantic digest/,
    ],
  ];
  for (const [name, mutate, pattern] of cases) {
    await t.test(name, () => {
      const catalog = structuredClone(original);
      mutate(catalog);
      assert.throws(
        () => validateManifestSchemaCatalog(SOURCE_ROOT, catalog, {requireTracked: false}),
        pattern,
      );
    });
  }
});

test('execution-manifest validation remains fail-closed before freeze', () => {
  const catalog = parseStrictJson(
    readRegularFile(SOURCE_ROOT, MANIFEST_CATALOG_PATH, MANIFEST_CATALOG_PATH),
    MANIFEST_CATALOG_PATH,
  );
  const manifestPath = catalog.reservations[0].planned_path;
  assert.throws(
    () =>
      validateBatch1ExecutionManifest({
        root: SOURCE_ROOT,
        manifestPath,
        requireTracked: false,
      }),
    (error) => {
      assert.ok(error instanceof ExecutionManifestBlockedError);
      assert.equal(error.result.execution_authorized, false);
      assert.equal(error.result.manifest_freeze_eligible, false);
      return true;
    },
  );
  assert.equal(
    fs.existsSync(
      path.join(
        SOURCE_ROOT,
        'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/execution-manifests',
      ),
    ),
    false,
  );
});

test('no --approved or --force CLI bypass exists', () => {
  const scripts = [
    {
      path: path.join(SOURCE_ROOT, 'scripts/validate_mobile_ux_batch1_freeze_candidate.mjs'),
      prefix: [],
    },
    {
      path: path.join(SOURCE_ROOT, 'scripts/validate_mobile_ux_batch1_execution_manifest.mjs'),
      prefix: ['--manifest', 'placeholder.json'],
    },
  ];
  for (const script of scripts) {
    for (const bypass of ['--approved', '--force']) {
      const result = spawnSync(process.execPath, [script.path, ...script.prefix, bypass], {
        cwd: SOURCE_ROOT,
        encoding: 'utf8',
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /forbidden/);
    }
  }
});
