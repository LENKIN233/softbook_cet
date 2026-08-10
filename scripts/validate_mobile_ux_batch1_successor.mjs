#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {parseStrictJson} from './lib/strict_json.mjs';
import {
  BATCH1_SUBJECT_PATHS,
  EXECUTION_MANIFEST_ROOT,
  SCHEMA_SUBJECT_DIGEST,
  SCHEMA_SUBJECT_RAW_SHA256,
  SUBJECT_DIGEST_DOMAINS,
  schemaSubjectDigestFromBytes,
  sha256,
  subjectDigestFromArtifacts,
  validateB2Transition,
  validateR0Transition,
} from './lib/mobile_ux_batch1_successor_contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHA1_RE = /^[0-9a-f]{40}$/;
const EXPECTED_ORIGINS = new Set([
  'https://github.com/LENKIN233/softbook_cet',
  'https://github.com/LENKIN233/softbook_cet.git',
  'git@github.com:LENKIN233/softbook_cet.git',
]);
const PREPARATION_RECEIPT =
  'docs/design/decisions/mobile-ux-batch1-preparation-v1.approval-receipt.json';
const D1_INTENT = 'docs/design/decisions/mobile-ux-batch1-cohort-designation-v1.json';
const D1_RECEIPT =
  'docs/design/decisions/mobile-ux-batch1-cohort-designation-v1.approval-receipt.json';
const D1_PRIVACY =
  'docs/design/decisions/mobile-ux-batch1-cohort-designation-v1.non-pii-attestation.json';
const F3_INTENT = 'docs/design/decisions/mobile-ux-batch1-manifest-freeze-v1.json';
const F3_RECEIPT =
  'docs/design/decisions/mobile-ux-batch1-manifest-freeze-v1.approval-receipt.json';

function fail(message) {
  throw new Error(message);
}

function git(root, args, {buffer = false, allowFailure = false} = {}) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: buffer ? undefined : 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    const stderr = buffer ? result.stderr.toString('utf8') : result.stderr;
    fail(`git ${args.join(' ')} failed: ${(stderr || '').trim() || `exit ${result.status}`}`);
  }
  return result;
}

function assertCommit(root, commit, label) {
  if (!SHA1_RE.test(commit)) fail(`${label} must be a lowercase full Git SHA`);
  const result = git(root, ['cat-file', '-e', `${commit}^{commit}`], {allowFailure: true});
  if (result.status !== 0) fail(`${label} is not an available commit: ${commit}`);
}

function assertAncestor(root, ancestor, descendant, label) {
  const result = git(root, ['merge-base', '--is-ancestor', ancestor, descendant], {
    allowFailure: true,
  });
  if (result.status !== 0) fail(`${label}: ${ancestor} is not an ancestor of ${descendant}`);
}

function readCommitArtifact(root, commit, relativePath, {required = true} = {}) {
  const tree = git(root, ['ls-tree', commit, '--', relativePath], {allowFailure: true});
  if (tree.status !== 0) fail(`cannot inspect ${commit}:${relativePath}`);
  const line = tree.stdout.trim();
  if (!line) {
    if (!required) return null;
    fail(`required artifact is missing at ${commit}: ${relativePath}`);
  }
  const match = line.match(/^([0-7]{6}) blob ([0-9a-f]{40})\t(.+)$/);
  if (!match || match[1] !== '100644' || match[3] !== relativePath) {
    fail(`${commit}:${relativePath} must be one exact 100644 non-symlink blob`);
  }
  const shown = git(root, ['show', `${commit}:${relativePath}`], {buffer: true});
  return {path: relativePath, gitMode: match[1], objectId: match[2], bytes: Buffer.from(shown.stdout)};
}

function assertAbsent(root, commit, relativePath, label) {
  if (readCommitArtifact(root, commit, relativePath, {required: false}) !== null) {
    fail(`${label} must be absent at ${commit}: ${relativePath}`);
  }
}

function assertPresent(root, commit, relativePath, label) {
  readCommitArtifact(root, commit, relativePath);
  return label;
}

function readSubject(root, commit) {
  const artifacts = BATCH1_SUBJECT_PATHS.map((relativePath) =>
    readCommitArtifact(root, commit, relativePath),
  );
  const byPath = new Map(artifacts.map((artifact) => [artifact.path, artifact.bytes]));
  const records = artifacts.map((artifact) => ({
    path: artifact.path,
    git_mode: artifact.gitMode,
    byte_length: artifact.bytes.length,
    raw_sha256: sha256(artifact.bytes),
  }));
  return {artifacts, byPath, records};
}

function assertSchemaSubject(subject) {
  for (const artifact of subject.artifacts) {
    const actual = sha256(artifact.bytes);
    const expected = SCHEMA_SUBJECT_RAW_SHA256[artifact.path];
    if (actual !== expected) {
      fail(`schema subject raw digest drift for ${artifact.path}: expected ${expected}, received ${actual}`);
    }
  }
  const digest = schemaSubjectDigestFromBytes(subject.byPath);
  if (digest !== SCHEMA_SUBJECT_DIGEST) {
    fail(`schema subject digest drift: expected ${SCHEMA_SUBJECT_DIGEST}, received ${digest}`);
  }
  return digest;
}

function assertFrozenNonRegistryArtifacts(schemaSubject, successorSubject, label) {
  for (let index = 1; index < BATCH1_SUBJECT_PATHS.length; index += 1) {
    const relativePath = BATCH1_SUBJECT_PATHS[index];
    const baseline = schemaSubject.byPath.get(relativePath);
    const successor = successorSubject.byPath.get(relativePath);
    if (!baseline.equals(successor)) {
      fail(`${label} must not change non-registry subject bytes: ${relativePath}`);
    }
  }
}

function parseRegistry(subject, label) {
  return parseStrictJson(subject.byPath.get(BATCH1_SUBJECT_PATHS[0]), label);
}

function assertManifestRootAbsent(root, commit) {
  const tree = git(root, ['ls-tree', '-r', '--name-only', commit, '--', EXECUTION_MANIFEST_ROOT]);
  if (tree.stdout.trim()) fail(`execution manifest root must remain absent at ${commit}`);
}

function assertCanonicalOrigin(root) {
  const result = git(root, ['remote', 'get-url', 'origin']);
  const origin = result.stdout.trim();
  if (!EXPECTED_ORIGINS.has(origin)) {
    fail(`origin must identify github.com/LENKIN233/softbook_cet; received ${origin}`);
  }
}

function artifactReader(root, commit) {
  return (relativePath) => {
    const artifact = readCommitArtifact(root, commit, relativePath);
    return {gitMode: artifact.gitMode, bytes: artifact.bytes};
  };
}

function findUniqueMaterializationCommit(root, descendantCommit, relativePath) {
  const commits = [...new Set(
    git(root, [
      'log', '--first-parent', '-m', '--format=%H', '--diff-filter=A',
      descendantCommit, '--', relativePath,
    ]).stdout.split(/\r?\n/).filter(Boolean),
  )];
  if (commits.length !== 1) {
    fail(`${relativePath} must have exactly one first-parent materialization commit`);
  }
  return commits[0];
}

function designationBindingFromReceipt(root, descendantCommit) {
  const receipt = parseStrictJson(
    readCommitArtifact(root, descendantCommit, D1_RECEIPT).bytes,
    `${descendantCommit}:${D1_RECEIPT}`,
  );
  return {
    decision_artifact_path: receipt.decision_artifact_path,
    receipt_path: D1_RECEIPT,
    approval_target_head_sha: receipt.approval_target_head_sha,
    receipt_materialization_commit_sha:
      findUniqueMaterializationCommit(root, descendantCommit, D1_RECEIPT),
    receipt_materialization_pull_request:
      receipt.receipt_materialization_pull_request,
    subject_commit: receipt.subject_commit,
    subject_digest_domain: receipt.subject_digest_domain,
    subject_digest: receipt.subject_digest,
    designated_cohort_id: receipt.designated_cohort_id,
    designated_cohort_sha256: receipt.designated_cohort_sha256,
    approval_instance_digest: receipt.approval_instance_digest,
  };
}

export function validateSuccessorFromGit({
  root = ROOT,
  stage,
  currentCommit,
  r0Commit = null,
  successorCommit,
  requireCanonicalOrigin = true,
  expectedDesignationBinding = null,
}) {
  if (!['schema', 'R0', 'B2'].includes(stage)) fail('--stage must be schema, R0, or B2');
  if (requireCanonicalOrigin) assertCanonicalOrigin(root);
  assertCommit(root, successorCommit, 'successor commit');
  if (stage === 'schema') {
    const schemaSubject = readSubject(root, successorCommit);
    const subjectDigest = assertSchemaSubject(schemaSubject);
    assertManifestRootAbsent(root, successorCommit);
    for (const relativePath of [
      PREPARATION_RECEIPT,
      D1_INTENT,
      D1_RECEIPT,
      D1_PRIVACY,
      F3_INTENT,
      F3_RECEIPT,
    ]) {
      assertAbsent(root, successorCommit, relativePath, 'schema-definition decision artifact');
    }
    return {
      schema_version: 'mobile-ux-batch1-successor-validation.v1',
      status: 'passed',
      stage: 'schema',
      successor_commit: successorCommit,
      subject_digest_domain: SUBJECT_DIGEST_DOMAINS.schema,
      subject_digest: subjectDigest,
      subject_artifact_records: schemaSubject.records,
      resolved_requirement_count: 0,
      pending_requirement_count: 145,
      gate_effect: 'none',
      authority: Object.fromEntries([
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
      ].map((key) => [key, false])),
      manifest_root_required_state: 'absent',
      non_claim:
        'schema validation grants no decision, manifest, execution, evidence, visual, implementation, native, release, merge, or leadership authority',
    };
  }
  if (!currentCommit) fail('--current-commit is required for R0 and B2');
  assertCommit(root, currentCommit, 'current schema commit');
  assertAncestor(root, currentCommit, successorCommit, 'successor ancestry');
  const schemaSubject = readSubject(root, currentCommit);
  assertSchemaSubject(schemaSubject);
  const currentRegistry = parseRegistry(schemaSubject, `${currentCommit}:${BATCH1_SUBJECT_PATHS[0]}`);
  assertManifestRootAbsent(root, currentCommit);

  if (stage === 'R0') {
    const successorSubject = readSubject(root, successorCommit);
    assertFrozenNonRegistryArtifacts(schemaSubject, successorSubject, 'R0');
    if (schemaSubject.byPath.get(BATCH1_SUBJECT_PATHS[0]).equals(successorSubject.byPath.get(BATCH1_SUBJECT_PATHS[0]))) {
      fail('R0 registry bytes must differ from the schema-definition candidate');
    }
    assertPresent(root, successorCommit, PREPARATION_RECEIPT, 'R0 preparation receipt');
    for (const relativePath of [D1_INTENT, D1_RECEIPT, D1_PRIVACY, F3_INTENT, F3_RECEIPT]) {
      assertAbsent(root, successorCommit, relativePath, 'R0 future decision artifact');
    }
    assertManifestRootAbsent(root, successorCommit);
    const result = validateR0Transition({
      baseline: currentRegistry,
      successor: parseRegistry(successorSubject, `${successorCommit}:${BATCH1_SUBJECT_PATHS[0]}`),
      baselineCommit: currentCommit,
      baselineSubjectDigest: SCHEMA_SUBJECT_DIGEST,
      artifactReader: artifactReader(root, successorCommit),
    });
    const subjectDigest = subjectDigestFromArtifacts(SUBJECT_DIGEST_DOMAINS.r0, successorSubject.records);
    return {
      ...result,
      current_commit: currentCommit,
      successor_commit: successorCommit,
      subject_digest_domain: SUBJECT_DIGEST_DOMAINS.r0,
      subject_digest: subjectDigest,
      subject_artifact_records: successorSubject.records,
      non_claim:
        'R0 validation grants no decision, manifest, execution, evidence, visual, implementation, native, release, or leadership authority',
    };
  }

  if (!r0Commit) fail('--r0-commit is required for B2');
  assertCommit(root, r0Commit, 'R0 commit');
  assertAncestor(root, currentCommit, r0Commit, 'R0 ancestry from schema candidate');
  assertAncestor(root, r0Commit, successorCommit, 'B2 ancestry from R0');
  const r0Subject = readSubject(root, r0Commit);
  const b2Subject = readSubject(root, successorCommit);
  assertFrozenNonRegistryArtifacts(schemaSubject, r0Subject, 'R0');
  assertFrozenNonRegistryArtifacts(schemaSubject, b2Subject, 'B2');
  const r0SubjectDigest = subjectDigestFromArtifacts(SUBJECT_DIGEST_DOMAINS.r0, r0Subject.records);
  validateR0Transition({
    baseline: currentRegistry,
    successor: parseRegistry(r0Subject, `${r0Commit}:${BATCH1_SUBJECT_PATHS[0]}`),
    baselineCommit: currentCommit,
    baselineSubjectDigest: SCHEMA_SUBJECT_DIGEST,
    artifactReader: artifactReader(root, r0Commit),
  });
  assertPresent(root, successorCommit, D1_INTENT, 'B2 D1 intent');
  assertPresent(root, successorCommit, D1_RECEIPT, 'B2 D1 receipt');
  assertPresent(root, successorCommit, D1_PRIVACY, 'B2 D1 privacy attestation');
  for (const relativePath of [F3_INTENT, F3_RECEIPT]) {
    assertAbsent(root, successorCommit, relativePath, 'B2 future F3 artifact');
  }
  assertManifestRootAbsent(root, r0Commit);
  assertManifestRootAbsent(root, successorCommit);
  const result = validateB2Transition({
    baselineR0: parseRegistry(r0Subject, `${r0Commit}:${BATCH1_SUBJECT_PATHS[0]}`),
    successor: parseRegistry(b2Subject, `${successorCommit}:${BATCH1_SUBJECT_PATHS[0]}`),
    r0Commit,
    r0SubjectDigest,
    artifactReader: artifactReader(root, successorCommit),
    expectedDesignationBinding:
      expectedDesignationBinding ?? designationBindingFromReceipt(root, successorCommit),
  });
  const subjectDigest = subjectDigestFromArtifacts(SUBJECT_DIGEST_DOMAINS.b2, b2Subject.records);
  return {
    ...result,
    current_commit: currentCommit,
    r0_commit: r0Commit,
    successor_commit: successorCommit,
    subject_digest_domain: SUBJECT_DIGEST_DOMAINS.b2,
    subject_digest: subjectDigest,
    subject_artifact_records: b2Subject.records,
    non_claim:
      'B2 validation proves descriptor and tracked-hash binding only; it does not execute the recipe, rebuild the output, or prove reproducibility or hermetic replay, and grants no freeze, manifest, execution, evidence, visual, implementation, native, release, or leadership authority',
  };
}

function parseArgs(argv) {
  const options = {
    root: ROOT,
    stage: null,
    currentCommit: null,
    r0Commit: null,
    successorCommit: null,
    requireCanonicalOrigin: true,
    json: false,
  };
  const take = (argument, index) => {
    const value = argv[index];
    if (!value || value.startsWith('--')) fail(`${argument} requires a value`);
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--root') options.root = path.resolve(take(argument, ++index));
    else if (argument === '--stage') options.stage = take(argument, ++index);
    else if (argument === '--current-commit') options.currentCommit = take(argument, ++index);
    else if (argument === '--r0-commit') options.r0Commit = take(argument, ++index);
    else if (argument === '--successor-commit') options.successorCommit = take(argument, ++index);
    else if (argument === '--allow-fixture-origin') options.requireCanonicalOrigin = false;
    else if (argument === '--json') options.json = true;
    else fail(`unknown argument: ${argument}`);
  }
  for (const [key, label] of [
    ['stage', '--stage'],
    ['successorCommit', '--successor-commit'],
  ]) {
    if (!options[key]) fail(`${label} is required`);
  }
  return options;
}

function main() {
  try {
    const result = validateSuccessorFromGit(parseArgs(process.argv.slice(2)));
    if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(
        `MOBILE UX BATCH1 SUCCESSOR OK: stage=${result.stage} subject=${result.subject_digest}`,
      );
      console.log(`NON-CLAIM: ${result.non_claim}`);
    }
  } catch (error) {
    console.error(
      `MOBILE UX BATCH1 SUCCESSOR FAILED: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
