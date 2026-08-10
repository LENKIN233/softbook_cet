#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  BOOTSTRAP_RUN_RECORD,
  FOUNDATION_ACTIVATION_RUN_RECORD,
  GOVERNANCE_ANCHOR_PATHS,
  MAINTENANCE_EXACT_ALLOWLIST,
  RECOVERY_DECISION_CLASSES,
  isMaintenancePayloadPath,
  parseRecoveryDecisionPath,
  parseRecoveryRunRecordPath,
} from './lib/mobile_ux_batch1_governance_recovery_contract.mjs';

const GITHUB_FILES_API_LIMIT = 3000;
const SHA1_RE = /^[0-9a-f]{40}$/;
const BATCH1_DECISION_PREFIX = 'docs/design/decisions/mobile-ux-batch1-';
const BATCH1_SUBJECT_PREFIX =
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/';
const BATCH1_EXECUTION_MANIFEST_PREFIX =
  `${BATCH1_SUBJECT_PREFIX}execution-manifests/`;
const BATCH1_FOUNDATION_FIXTURE_PREFIX =
  'scripts/fixtures/mobile-ux-batch1-foundation-activation-v1/';
const BATCH1_GOVERNANCE_FOUNDATION_DECISION =
  `${BATCH1_DECISION_PREFIX}governance-foundation-v1.md`;
const CANONICAL_BATCH1_RUN_RECORD_RE =
  /^docs\/agent-runs\/\d{4}-\d{2}-\d{2}-mobile-ux-batch1-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const GOVERNANCE_FOUNDATION_PATHS = new Set([
  '.github/workflows/formal-approval.yml',
  '.github/workflows/pr-gates.yml',
  BATCH1_GOVERNANCE_FOUNDATION_DECISION,
  'scripts/classify_formal_approval_scope.mjs',
  'scripts/lib/strict_json.mjs',
  'scripts/test_classify_formal_approval_scope.mjs',
  'scripts/lib/mobile_ux_batch1_github_event_reader.mjs',
  'scripts/lib/mobile_ux_batch1_governance_contract.mjs',
  'scripts/lib/mobile_ux_batch1_governance_recovery_contract.mjs',
  'scripts/lib/mobile_ux_batch1_successor_contract.mjs',
  'scripts/test_mobile_ux_batch1_governance_contract.mjs',
  'scripts/test_mobile_ux_batch1_governance_recovery_contract.mjs',
  'scripts/test_mobile_ux_batch1_github_event_reader.mjs',
  'scripts/test_mobile_ux_batch1_successor_contract.mjs',
  'scripts/test_validate_mobile_ux_batch1_governance.mjs',
  'scripts/validate_mobile_ux_batch1_governance.mjs',
  'scripts/validate_mobile_ux_batch1_successor.mjs',
  'spec/mobile-ux-batch1-governance.json',
  'spec/mobile-ux-batch1-governance-recovery-decision.schema.json',
  'spec/mobile-ux-batch1-resolved-requirement.schema.json',
  ...MAINTENANCE_EXACT_ALLOWLIST,
]);
const BATCH1_SUBJECT_PATHS = new Set([
  `${BATCH1_SUBJECT_PREFIX}registry-set.v2.proposal.json`,
  `${BATCH1_SUBJECT_PREFIX}cp-ba.registry.v2.proposal.json`,
  `${BATCH1_SUBJECT_PREFIX}cp-cs.registry.v2.proposal.json`,
  `${BATCH1_SUBJECT_PREFIX}cp-web.registry.v2.proposal.json`,
  `${BATCH1_SUBJECT_PREFIX}manifest-schema-catalog.v1.json`,
]);
const BATCH1_DECISION_PATHS = Object.freeze({
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
const BATCH1_INTENT_CLASSES_BY_PATH = new Map([
  [
    BATCH1_DECISION_PATHS.legacyMigrationIntent,
    'legacy_receipt_migration_intent',
  ],
  [
    BATCH1_DECISION_PATHS.cohortDesignationIntent,
    'cohort_designation_intent',
  ],
  [
    BATCH1_DECISION_PATHS.manifestFreezeIntent,
    'manifest_freeze_intent',
  ],
]);
const BATCH1_RECEIPT_PATHS = new Set([
  BATCH1_DECISION_PATHS.legacyMigrationReceipt,
  BATCH1_DECISION_PATHS.preparationReceipt,
  BATCH1_DECISION_PATHS.cohortDesignationReceipt,
  BATCH1_DECISION_PATHS.manifestFreezeReceipt,
]);
const KNOWN_BATCH1_DECISION_PATHS = new Set([
  BATCH1_GOVERNANCE_FOUNDATION_DECISION,
  ...BATCH1_INTENT_CLASSES_BY_PATH.keys(),
  ...BATCH1_RECEIPT_PATHS,
  BATCH1_DECISION_PATHS.cohortNonPiiAttestation,
]);
const EXACT_SENSITIVE_PATHS = new Set([
  'AGENTS.md',
  FOUNDATION_ACTIVATION_RUN_RECORD,
  '.github/workflows/formal-approval.yml',
  'scripts/classify_formal_approval_scope.mjs',
  'scripts/test_classify_formal_approval_scope.mjs',
  'scripts/validate_dependency_security.mjs',
  'scripts/test_validate_dependency_security.mjs',
  'scripts/report_repo_health.mjs',
  'scripts/test_report_repo_health.mjs',
  'scripts/harness_validator/sections/product_contract_mirrors.py',
  'scripts/harness_validator/sections/truth_mirrors.py',
  'scripts/lib/launch_evidence_contract.mjs',
  'scripts/lib/strict_json.mjs',
  'scripts/validate_launch_readiness.mjs',
  'scripts/test_validate_launch_readiness.mjs',
  'scripts/harness_validator/sections/governance_contracts.py',
  'scripts/harness_validator/sections/delivery_runtime.py',
  'security/dependency-audit-policy.json',
  'scripts/harness_validator/sections/harness_architecture.py',
  'spec/agent-harness.json',
  'spec/account-sync-contract.json',
  'spec/authority-map.json',
  'spec/doc-manifest.json',
  'spec/evals.json',
  'spec/harness-architecture.json',
  'spec/release-operational-policy.json',
  'spec/repo-delivery-contract.json',
  'spec/runtime-boundaries.json',
]);
const SENSITIVE_PREFIXES = [
  '.github/workflows/',
  'docs/agent-runs/evidence/',
  BATCH1_DECISION_PREFIX,
  BATCH1_SUBJECT_PREFIX,
  BATCH1_FOUNDATION_FIXTURE_PREFIX,
  'docs/release/',
  'security/reports/',
];

export function classifyFormalApprovalScope(rawPaths) {
  const invalid_paths = [];
  const normalized = new Set();
  const classificationErrors = [];

  if (!Array.isArray(rawPaths)) {
    classificationErrors.push('invalid_path_list');
    rawPaths = [];
  }

  for (const rawPath of rawPaths) {
    const value = String(rawPath).trim();
    if (!value) continue;
    if (
      value.includes('\\') ||
      value.startsWith('/') ||
      value.split('/').includes('..') ||
      path.posix.normalize(value) !== value
    ) {
      invalid_paths.push(value);
      continue;
    }
    normalized.add(value);
  }

  const matched_paths = [...normalized]
    .filter(
      value =>
        EXACT_SENSITIVE_PATHS.has(value) ||
        CANONICAL_BATCH1_RUN_RECORD_RE.test(value) ||
        SENSITIVE_PREFIXES.some(prefix => value.startsWith(prefix)),
    )
    .sort();
  const changed_paths = [...normalized].sort();
  const pathSet = new Set(changed_paths);

  if (invalid_paths.length > 0) {
    classificationErrors.push('invalid_paths');
  }
  if (changed_paths.length === 0) {
    classificationErrors.push('empty_changed_paths');
  }

  const unknownBatch1DecisionPaths = changed_paths.filter(
    value =>
      value.startsWith(BATCH1_DECISION_PREFIX) &&
      !KNOWN_BATCH1_DECISION_PATHS.has(value) &&
      parseRecoveryDecisionPath(value) === null,
  );
  if (unknownBatch1DecisionPaths.length > 0) {
    classificationErrors.push('unknown_batch1_decision_path');
  }
  if (changed_paths.some(value => value.startsWith(BATCH1_EXECUTION_MANIFEST_PREFIX))) {
    classificationErrors.push('execution_manifest_authorization_not_implemented');
  }

  const authorityClasses = new Set();
  for (const [intentPath, decisionClass] of BATCH1_INTENT_CLASSES_BY_PATH) {
    if (pathSet.has(intentPath)) authorityClasses.add(decisionClass);
  }
  const receiptPaths = [...BATCH1_RECEIPT_PATHS].filter(value => pathSet.has(value));
  const hasPrivacyAttestation = pathSet.has(
    BATCH1_DECISION_PATHS.cohortNonPiiAttestation,
  );
  const hasBatch1SubjectChange = changed_paths.some(value =>
    BATCH1_SUBJECT_PATHS.has(value),
  );
  const hasGovernanceFoundationChange = changed_paths.some(value =>
    GOVERNANCE_FOUNDATION_PATHS.has(value) ||
    value.startsWith(BATCH1_FOUNDATION_FIXTURE_PREFIX),
  );
  const hasAuthorityIntent = authorityClasses.size > 0;
  const recoveryDecisions = changed_paths
    .map(value => ({path: value, parsed: parseRecoveryDecisionPath(value)}))
    .filter(entry => entry.parsed !== null);
  const recoveryRunRecords = changed_paths
    .map(value => ({path: value, parsed: parseRecoveryRunRecordPath(value)}))
    .filter(entry => entry.parsed !== null);
  const canonicalBatch1RunRecords = changed_paths.filter(value =>
    CANONICAL_BATCH1_RUN_RECORD_RE.test(value),
  );
  const hasRecoveryArtifacts =
    recoveryDecisions.length > 0 || recoveryRunRecords.length > 0;
  if (
    !hasRecoveryArtifacts &&
    changed_paths.some((value) => isMaintenancePayloadPath(value))
  ) {
    classificationErrors.push(
      'governance_maintenance_payload_without_recovery_pair',
    );
  }
  let recoveryDecisionClass = null;

  if (recoveryDecisions.length > 1) {
    classificationErrors.push('multiple_governance_recovery_decisions');
  }
  if (recoveryRunRecords.length > 1) {
    classificationErrors.push('multiple_governance_recovery_run_records');
  }
  if (recoveryDecisions.length === 0 && recoveryRunRecords.length > 0) {
    classificationErrors.push('governance_recovery_run_record_without_decision');
  }
  if (recoveryDecisions.length > 0 && recoveryRunRecords.length === 0) {
    classificationErrors.push('governance_recovery_decision_without_run_record');
  }
  if (recoveryDecisions.length === 1 && recoveryRunRecords.length === 1) {
    const decision = recoveryDecisions[0].parsed;
    const runRecord = recoveryRunRecords[0].parsed;
    if (
      decision.decisionClass !== runRecord.decisionClass ||
      decision.pullRequest !== runRecord.pullRequest ||
      decision.slug !== runRecord.slug
    ) {
      classificationErrors.push('governance_recovery_decision_run_record_mismatch');
    } else if (!RECOVERY_DECISION_CLASSES.includes(decision.decisionClass)) {
      classificationErrors.push('unknown_governance_recovery_decision_class');
    } else {
      recoveryDecisionClass = decision.decisionClass;
      const recoveryPayloadPaths = changed_paths.filter(
        value =>
          value !== recoveryDecisions[0].path &&
          value !== recoveryRunRecords[0].path,
      );
      if (decision.decisionClass === 'governance_maintenance') {
        if (recoveryPayloadPaths.length === 0) {
          classificationErrors.push('governance_maintenance_payload_missing');
        } else if (!recoveryPayloadPaths.every(isMaintenancePayloadPath)) {
          classificationErrors.push('governance_maintenance_payload_outside_allowlist');
        }
      } else {
        const expectedAnchors = [...GOVERNANCE_ANCHOR_PATHS].sort();
        if (JSON.stringify(recoveryPayloadPaths) !== JSON.stringify(expectedAnchors)) {
          classificationErrors.push('governance_recovery_anchor_scope_mismatch');
        }
      }
    }
  }

  if (canonicalBatch1RunRecords.includes(BOOTSTRAP_RUN_RECORD)) {
    classificationErrors.push('immutable_governance_bootstrap_run_record_changed');
  }
  if (canonicalBatch1RunRecords.length > 1 && !hasRecoveryArtifacts) {
    classificationErrors.push('multiple_canonical_batch1_run_records');
  }

  if (
    hasPrivacyAttestation &&
    !authorityClasses.has('cohort_designation_intent')
  ) {
    classificationErrors.push(
      'privacy_attestation_without_cohort_designation_intent',
    );
  }
  if (authorityClasses.size > 1) {
    classificationErrors.push('mixed_authority_bearing_classes');
  }
  if (receiptPaths.length > 1) {
    classificationErrors.push('multiple_receipt_materializations');
  }
  if (hasAuthorityIntent && receiptPaths.length > 0) {
    classificationErrors.push('decision_intent_and_receipt_mixed');
  }
  if (
    hasBatch1SubjectChange &&
    (hasAuthorityIntent || receiptPaths.length > 0)
  ) {
    classificationErrors.push('batch1_subject_and_authority_change_mixed');
  }
  if (
    hasGovernanceFoundationChange &&
    !hasRecoveryArtifacts &&
    (hasAuthorityIntent || receiptPaths.length > 0)
  ) {
    classificationErrors.push('governance_foundation_and_authority_change_mixed');
  }
  if (
    hasGovernanceFoundationChange &&
    hasBatch1SubjectChange &&
    !hasRecoveryArtifacts
  ) {
    classificationErrors.push('governance_foundation_and_batch1_subject_mixed');
  }
  if (
    hasRecoveryArtifacts &&
    (hasAuthorityIntent || receiptPaths.length > 0 || hasBatch1SubjectChange)
  ) {
    classificationErrors.push('governance_recovery_and_batch1_authority_or_subject_mixed');
  }

  const hasNonRecoverySpecializedOwner =
    hasGovernanceFoundationChange ||
    hasBatch1SubjectChange ||
    authorityClasses.size === 1 ||
    receiptPaths.length === 1;
  if (
    canonicalBatch1RunRecords.length > 0 &&
    !hasRecoveryArtifacts &&
    !hasNonRecoverySpecializedOwner
  ) {
    classificationErrors.push('unbound_canonical_batch1_run_record');
  }
  if (
    pathSet.has(FOUNDATION_ACTIVATION_RUN_RECORD) &&
    !hasGovernanceFoundationChange
  ) {
    classificationErrors.push('foundation_run_record_without_foundation_scope');
  }

  let decision_class = 'ordinary';
  if (classificationErrors.length > 0) {
    decision_class = 'generic_sensitive';
  } else if (recoveryDecisionClass !== null) {
    decision_class = recoveryDecisionClass;
  } else if (receiptPaths.length === 1) {
    decision_class = 'receipt_materialization';
  } else if (authorityClasses.size === 1) {
    [decision_class] = authorityClasses;
  } else if (hasBatch1SubjectChange) {
    decision_class = 'batch1_subject_change';
  } else if (hasGovernanceFoundationChange) {
    decision_class = 'governance_foundation';
  } else if (matched_paths.length > 0) {
    decision_class = 'generic_sensitive';
  }

  const sensitive =
    classificationErrors.length > 0 || decision_class !== 'ordinary';
  return {
    schema_version: 'formal-approval-scope.v2',
    sensitive,
    decision_class,
    trusted_validation_required: sensitive,
    classification_error:
      classificationErrors.length > 0 ? classificationErrors.join(',') : null,
    changed_paths,
    matched_paths,
    invalid_paths: invalid_paths.sort(),
  };
}

function parseArgs(argv) {
  const options = {
    files: null,
    githubFiles: null,
    expectedCount: null,
    githubOutput: null,
    root: null,
    baseSha: null,
    headSha: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--files') {
      options.files = requireValue(argv, ++index, argument);
    } else if (argument === '--github-files') {
      options.githubFiles = requireValue(argv, ++index, argument);
    } else if (argument === '--expected-count') {
      options.expectedCount = requireValue(argv, ++index, argument);
    } else if (argument === '--github-output') {
      options.githubOutput = requireValue(argv, ++index, argument);
    } else if (argument === '--root') {
      options.root = requireValue(argv, ++index, argument);
    } else if (argument === '--base-sha') {
      options.baseSha = requireValue(argv, ++index, argument);
    } else if (argument === '--head-sha') {
      options.headSha = requireValue(argv, ++index, argument);
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  const gitMode = options.baseSha !== null || options.headSha !== null || options.root !== null;
  const sourceCount = Number(Boolean(options.files)) + Number(Boolean(options.githubFiles)) + Number(gitMode);
  if (sourceCount !== 1) {
    throw new Error('exactly one of --files, --github-files, or exact Git diff mode is required');
  }
  if (options.githubFiles && options.expectedCount === null) {
    throw new Error('--expected-count is required with --github-files');
  }
  if (gitMode && (!options.root || !options.baseSha || !options.headSha)) {
    throw new Error('exact Git diff mode requires --root, --base-sha, and --head-sha');
  }
  if (gitMode && options.expectedCount !== null) {
    throw new Error('--expected-count is forbidden with exact Git diff mode');
  }
  return options;
}

function requireValue(argv, index, option) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const paths = options.githubFiles
      ? readGitHubFiles(options.githubFiles, options.expectedCount)
      : options.files
        ? fs.readFileSync(options.files, 'utf8').split(/\r?\n/)
        : readExactGitChangedPaths(options.root, options.baseSha, options.headSha);
    const result = classifyFormalApprovalScope(paths);
    console.log(JSON.stringify(result, null, 2));
    if (options.githubOutput) {
      fs.appendFileSync(
        options.githubOutput,
        [
          `sensitive=${result.sensitive ? 'true' : 'false'}`,
          `decision_class=${result.decision_class}`,
          `trusted_validation_required=${result.trusted_validation_required ? 'true' : 'false'}`,
          `classification_error=${result.classification_error ?? ''}`,
          '',
        ].join('\n'),
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function runGit(root, args) {
  const result = spawnSync('git', args, {
    cwd: path.resolve(root),
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = Buffer.from(result.stderr ?? Buffer.alloc(0)).toString('utf8').trim();
    throw new Error(`exact Git diff command failed${stderr ? `: ${stderr}` : ''}`);
  }
  return Buffer.from(result.stdout ?? Buffer.alloc(0));
}

function decodeGitField(field, label) {
  try {
    return new TextDecoder('utf-8', {fatal: true}).decode(field);
  } catch {
    throw new Error(`${label} is not valid UTF-8`);
  }
}

export function readExactGitChangedRecords(root, baseSha, headSha) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new Error('exact Git diff root is required');
  }
  if (!SHA1_RE.test(baseSha ?? '') || !SHA1_RE.test(headSha ?? '')) {
    throw new Error('exact Git diff base and head must be lowercase full Git SHAs');
  }
  runGit(root, ['cat-file', '-e', `${baseSha}^{commit}`]);
  runGit(root, ['cat-file', '-e', `${headSha}^{commit}`]);
  const raw = runGit(root, [
    'diff',
    '--name-status',
    '-z',
    '-M',
    '-C',
    '--find-copies-harder',
    '-l0',
    baseSha,
    headSha,
  ]);
  return parseExactGitNameStatusZ(raw);
}

export function parseExactGitNameStatusZ(
  raw,
  label = 'exact Git diff',
) {
  if (!Buffer.isBuffer(raw)) {
    throw new Error(`${label} output must be a Buffer`);
  }
  if (raw.length === 0) return Object.freeze([]);
  const fields = [];
  let start = 0;
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index] !== 0) continue;
    fields.push(raw.subarray(start, index));
    start = index + 1;
  }
  if (start !== raw.length || fields.some((field) => field.length === 0)) {
    throw new Error(`${label} emitted malformed NUL-delimited output`);
  }
  const records = [];
  for (let index = 0; index < fields.length;) {
    const status = decodeGitField(fields[index++], `${label} status`);
    if (!/^(?:A|B|D|M|T|U|X|R(?:100|0[0-9]{2}|[1-9][0-9]?)|C(?:100|0[0-9]{2}|[1-9][0-9]?))$/.test(status)) {
      throw new Error(`${label} emitted unsupported status ${status}`);
    }
    const pathCount = /^[RC]/.test(status) ? 2 : 1;
    if (index + pathCount > fields.length) {
      throw new Error(`${label} emitted a truncated path record`);
    }
    const firstPath = decodeGitField(fields[index++], `${label} path`);
    const record = pathCount === 2
      ? Object.freeze({
        status,
        oldPath: firstPath,
        path: decodeGitField(fields[index++], `${label} path`),
      })
      : Object.freeze({status, oldPath: null, path: firstPath});
    records.push(record);
  }
  return Object.freeze(records);
}

export function readExactGitChangedPaths(root, baseSha, headSha) {
  return readExactGitChangedRecords(root, baseSha, headSha).flatMap((record) =>
    record.oldPath === null ? [record.path] : [record.oldPath, record.path]
  );
}

function readGitHubFiles(file, expectedCountValue) {
  const expectedCount = Number(expectedCountValue);
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 0) {
    throw new Error('--expected-count must be a non-negative integer');
  }
  if (expectedCount >= GITHUB_FILES_API_LIMIT) {
    throw new Error(
      `GitHub changed-file count reaches the ${GITHUB_FILES_API_LIMIT}-file API safety limit`,
    );
  }

  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(parsed) || !parsed.every(page => Array.isArray(page))) {
    throw new Error('--github-files must contain paginated GitHub API arrays');
  }
  const files = parsed.flat();
  if (files.length !== expectedCount) {
    throw new Error(
      `GitHub changed-file list is incomplete: expected ${expectedCount}, received ${files.length}`,
    );
  }

  const paths = [];
  const currentFilenames = new Set();
  for (const fileEntry of files) {
    if (
      !fileEntry ||
      typeof fileEntry !== 'object' ||
      typeof fileEntry.filename !== 'string' ||
      !fileEntry.filename
    ) {
      throw new Error('GitHub changed-file entry is malformed');
    }
    if (currentFilenames.has(fileEntry.filename)) {
      throw new Error(`GitHub changed-file list contains duplicate filename: ${fileEntry.filename}`);
    }
    currentFilenames.add(fileEntry.filename);
    paths.push(fileEntry.filename);
    if (fileEntry.previous_filename !== undefined) {
      if (
        typeof fileEntry.previous_filename !== 'string' ||
        !fileEntry.previous_filename
      ) {
        throw new Error('GitHub previous filename is malformed');
      }
      paths.push(fileEntry.previous_filename);
    }
  }
  if (currentFilenames.size !== expectedCount) {
    throw new Error(
      `GitHub changed-file unique count is incomplete: expected ${expectedCount}, received ${currentFilenames.size}`,
    );
  }
  return paths;
}

function isDirectExecution() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]);
  } catch {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  }
}

if (isDirectExecution()) {
  main();
}
