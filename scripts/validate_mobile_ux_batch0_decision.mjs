#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DECISION_PATH =
  'docs/design/decisions/mobile-ux-checkpoint-layering-decision-v1.md';
export const EXPECTED_REPOSITORY = 'LENKIN233/softbook_cet';
export const EXPECTED_PULL_REQUEST = 484;
export const EXPECTED_SUBJECT_DIGEST =
  '92507e6f4f8fe523c83ab21ddae42dc119c4ed172393705d3d671c431673755b';

export const BOUND_FILES = Object.freeze([
  Object.freeze({
    name: 'checkpoint_contract',
    pathField: 'bound_checkpoint_contract_path',
    shaField: 'bound_checkpoint_contract_sha256',
    path: 'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/checkpoint-contract.md',
  }),
  Object.freeze({
    name: 'decision_proposal',
    pathField: 'bound_decision_proposal_path',
    shaField: 'bound_decision_proposal_sha256',
    path: 'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/checkpoint-layering-decision-proposal.md',
  }),
  Object.freeze({
    name: 'browser_evidence',
    pathField: 'bound_browser_evidence_path',
    shaField: 'bound_browser_evidence_sha256',
    path: 'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/browser-evidence.md',
  }),
  Object.freeze({
    name: 'state_evidence_ledger',
    pathField: 'bound_state_evidence_ledger_path',
    shaField: 'bound_state_evidence_ledger_sha256',
    path: 'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/state-evidence-ledger.md',
  }),
  Object.freeze({
    name: 'pc_web_mapping',
    pathField: 'bound_pc_web_mapping_path',
    shaField: 'bound_pc_web_mapping_sha256',
    path: 'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/pc-web-v5-state-mapping.md',
  }),
]);

const REQUIRED_FRONTMATTER = Object.freeze({
  status: 'effective_iff_pr_484_exact_head_has_protected_product_owner_approval',
  classification: 'product_owner_governance_decision',
  decision_id: 'mobile-ux-checkpoint-layering-decision-v1',
  contract_version: 'mobile-ux-checkpoint-contract-v1',
  decision: 'accept_topology_with_fail_closed_batch_1_manifest_preparation_scope',
  decision_owner: 'github:LENKIN233',
  approval_subject_repository: EXPECTED_REPOSITORY,
  approval_subject_pull_request: String(EXPECTED_PULL_REQUEST),
  activation_authority: 'formal-product-owner-approval',
  gate_effect: 'batch_0_topology_and_batch_1_manifest_preparation_only',
});

const REQUIRED_FIELDS = new Set([
  ...Object.keys(REQUIRED_FRONTMATTER),
  'evidence_baseline_commit',
  ...BOUND_FILES.flatMap(binding => [binding.pathField, binding.shaField]),
]);

const SHA1_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function parseFrontmatter(bytes) {
  const text = bytes.toString('utf8');
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') {
    throw new Error(`${DECISION_PATH} must start with an exact YAML frontmatter delimiter`);
  }
  const closingIndex = lines.indexOf('---', 1);
  if (closingIndex < 0) {
    throw new Error(`${DECISION_PATH} is missing its closing frontmatter delimiter`);
  }

  const values = {};
  for (const [offset, rawLine] of lines.slice(1, closingIndex).entries()) {
    const lineNumber = offset + 2;
    if (!rawLine.trim()) continue;
    const match = rawLine.match(/^([a-z][a-z0-9_]*):[ \t]+([^\s].*)$/);
    if (!match) {
      throw new Error(`${DECISION_PATH}:${lineNumber} has unsupported frontmatter syntax`);
    }
    const [, key, rawValue] = match;
    const value = rawValue.trim();
    if (Object.hasOwn(values, key)) {
      throw new Error(`${DECISION_PATH}:${lineNumber} duplicates frontmatter field ${key}`);
    }
    values[key] = value;
  }
  return values;
}

function safeRead(root, relativePath) {
  const rootPath = path.resolve(root);
  const absolutePath = path.resolve(rootPath, relativePath);
  if (!absolutePath.startsWith(`${rootPath}${path.sep}`)) {
    throw new Error(`repository path escapes root: ${relativePath}`);
  }
  let stat;
  try {
    stat = fs.lstatSync(absolutePath);
  } catch {
    throw new Error(`required Batch 0 subject file is missing: ${relativePath}`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Batch 0 subject path must be a regular non-symlink file: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath);
}

function git(root, args, { buffer = false, allowFailure = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: buffer ? undefined : 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    const stderr = buffer ? result.stderr.toString('utf8') : result.stderr;
    throw new Error(`git ${args.join(' ')} failed: ${stderr.trim() || `exit ${result.status}`}`);
  }
  return result;
}

function gitRead(root, commit, relativePath) {
  const result = git(root, ['show', `${commit}:${relativePath}`], { buffer: true });
  return Buffer.from(result.stdout);
}

function assertGitCommit(root, commit, label) {
  const result = git(root, ['cat-file', '-e', `${commit}^{commit}`], { allowFailure: true });
  if (result.status !== 0) {
    throw new Error(`${label} is not an available Git commit: ${commit}`);
  }
}

function assertAncestor(root, ancestor, descendant) {
  const result = git(root, ['merge-base', '--is-ancestor', ancestor, descendant], {
    allowFailure: true,
  });
  if (result.status !== 0) {
    throw new Error(
      `evidence_baseline_commit ${ancestor} is not an ancestor of exact approval head ${descendant}`,
    );
  }
}

function validateFields(frontmatter) {
  const present = new Set(Object.keys(frontmatter));
  const missing = [...REQUIRED_FIELDS].filter(field => !present.has(field));
  const unknown = [...present].filter(field => !REQUIRED_FIELDS.has(field));
  if (missing.length) throw new Error(`Batch 0 decision is missing frontmatter fields: ${missing.join(', ')}`);
  if (unknown.length) throw new Error(`Batch 0 decision has unsupported frontmatter fields: ${unknown.join(', ')}`);

  for (const [field, expected] of Object.entries(REQUIRED_FRONTMATTER)) {
    if (frontmatter[field] !== expected) {
      throw new Error(`${field} must equal ${expected}; received ${frontmatter[field]}`);
    }
  }
  if (!SHA1_RE.test(frontmatter.evidence_baseline_commit)) {
    throw new Error('evidence_baseline_commit must be a lowercase full Git SHA-1');
  }
  if (Object.hasOwn(frontmatter, 'repository_subject_commit')) {
    throw new Error('repository_subject_commit is forbidden; use evidence_baseline_commit');
  }

  for (const binding of BOUND_FILES) {
    if (frontmatter[binding.pathField] !== binding.path) {
      throw new Error(`${binding.pathField} must equal ${binding.path}`);
    }
    if (!SHA256_RE.test(frontmatter[binding.shaField])) {
      throw new Error(`${binding.shaField} must be a lowercase SHA-256`);
    }
  }
}

function canonicalSubject({ decisionBytes, frontmatter, boundFiles }) {
  return {
    schema_version: 'mobile-ux-batch0-approval-subject.v1',
    decision: {
      path: DECISION_PATH,
      sha256: sha256(decisionBytes),
      decision_id: frontmatter.decision_id,
      contract_version: frontmatter.contract_version,
      gate_effect: frontmatter.gate_effect,
    },
    approval: {
      repository: frontmatter.approval_subject_repository,
      pull_request: Number(frontmatter.approval_subject_pull_request),
      authority: frontmatter.activation_authority,
    },
    evidence_baseline_commit: frontmatter.evidence_baseline_commit,
    bound_files: boundFiles.map(item => ({
      name: item.name,
      path: item.path,
      sha256: item.sha256,
    })),
  };
}

export function validateBatch0Decision({
  root = ROOT,
  gitRoot = root,
  repository = null,
  pullRequest = null,
  headSha = null,
  inheritSubjectDigest = null,
  requiredSubjectDigest = EXPECTED_SUBJECT_DIGEST,
} = {}) {
  const runtimeValues = [repository, pullRequest, headSha];
  const runtimeCount = runtimeValues.filter(value => value !== null && value !== undefined).length;
  if (runtimeCount !== 0 && runtimeCount !== runtimeValues.length) {
    throw new Error('--repository, --pull-request, and --head-sha must be supplied together');
  }
  const exactHeadMode = runtimeCount === runtimeValues.length;
  if (exactHeadMode && !SHA1_RE.test(String(headSha))) {
    throw new Error('--head-sha must be a lowercase full Git SHA-1');
  }

  const readSubjectFile = exactHeadMode
    ? relativePath => gitRead(gitRoot, String(headSha), relativePath)
    : relativePath => safeRead(root, relativePath);
  const decisionBytes = readSubjectFile(DECISION_PATH);
  const frontmatter = parseFrontmatter(decisionBytes);
  validateFields(frontmatter);

  assertGitCommit(gitRoot, frontmatter.evidence_baseline_commit, 'evidence_baseline_commit');
  if (exactHeadMode) {
    assertGitCommit(gitRoot, String(headSha), 'approval head');
    assertAncestor(gitRoot, frontmatter.evidence_baseline_commit, String(headSha));
    if (repository !== EXPECTED_REPOSITORY || repository !== frontmatter.approval_subject_repository) {
      throw new Error(
        `approval repository must be ${frontmatter.approval_subject_repository}; received ${repository}`,
      );
    }
    if (
      String(pullRequest) !== String(EXPECTED_PULL_REQUEST) ||
      String(pullRequest) !== frontmatter.approval_subject_pull_request
    ) {
      throw new Error(
        `ordinary or unrelated approval cannot activate Batch 0; expected pull request ${frontmatter.approval_subject_pull_request}, received ${pullRequest}`,
      );
    }
  }

  const boundFiles = BOUND_FILES.map(binding => {
    const bytes = readSubjectFile(binding.path);
    const actualSha256 = sha256(bytes);
    const expectedSha256 = frontmatter[binding.shaField];
    if (actualSha256 !== expectedSha256) {
      throw new Error(
        `${binding.path} SHA-256 drift: expected ${expectedSha256}, received ${actualSha256}`,
      );
    }
    return { name: binding.name, path: binding.path, sha256: actualSha256 };
  });

  const subject = canonicalSubject({ decisionBytes, frontmatter, boundFiles });
  const subjectJson = `${JSON.stringify(subject)}\n`;
  const subjectDigest = sha256(Buffer.from(subjectJson));
  if (requiredSubjectDigest !== null && requiredSubjectDigest !== undefined) {
    if (!SHA256_RE.test(String(requiredSubjectDigest))) {
      throw new Error('required Batch 0 subject digest must be a lowercase SHA-256');
    }
    if (requiredSubjectDigest !== subjectDigest) {
      throw new Error(
        `pinned Batch 0 subject drift: expected ${requiredSubjectDigest}, received ${subjectDigest}`,
      );
    }
  }
  if (inheritSubjectDigest !== null && inheritSubjectDigest !== undefined) {
    if (!SHA256_RE.test(String(inheritSubjectDigest))) {
      throw new Error('--inherit-subject-digest must be a lowercase SHA-256');
    }
    if (inheritSubjectDigest !== subjectDigest) {
      throw new Error(
        `Batch 0 inheritance subject drift: expected ${inheritSubjectDigest}, received ${subjectDigest}`,
      );
    }
  }

  const approvalInstanceDigest = exactHeadMode
    ? sha256(
        Buffer.from(
          `${subjectDigest}\n${repository}\n${pullRequest}\n${headSha}\n`,
        ),
      )
    : null;

  return {
    schema_version: 'mobile-ux-batch0-decision-validation.v1',
    status: 'passed',
    validation_mode: exactHeadMode ? 'exact_pr_head_subject' : 'static_worktree_subject',
    activation_eligible: exactHeadMode,
    repository: frontmatter.approval_subject_repository,
    pull_request: Number(frontmatter.approval_subject_pull_request),
    head_sha: exactHeadMode ? String(headSha) : null,
    evidence_baseline_commit: frontmatter.evidence_baseline_commit,
    subject_digest: subjectDigest,
    pinned_subject_digest: requiredSubjectDigest ?? null,
    approval_instance_digest: approvalInstanceDigest,
    decision_sha256: subject.decision.sha256,
    bound_files: subject.bound_files,
    non_claim:
      exactHeadMode
        ? 'technical subject validation does not replace protected environment approval'
        : 'static validation is not Batch 0 approval and cannot activate the decision',
  };
}

function parseArgs(argv) {
  const options = {
    root: ROOT,
    gitRoot: null,
    repository: null,
    pullRequest: null,
    headSha: null,
    inheritSubjectDigest: null,
    githubOutput: null,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const take = () => {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
      return value;
    };
    if (argument === '--root') options.root = path.resolve(take());
    else if (argument === '--git-root') options.gitRoot = path.resolve(take());
    else if (argument === '--repository') options.repository = take();
    else if (argument === '--pull-request') options.pullRequest = take();
    else if (argument === '--head-sha') options.headSha = take();
    else if (argument === '--inherit-subject-digest') options.inheritSubjectDigest = take();
    else if (argument === '--github-output') options.githubOutput = take();
    else if (argument === '--json') options.json = true;
    else throw new Error(`unknown argument: ${argument}`);
  }
  options.gitRoot ??= options.root;
  return options;
}

function writeGitHubOutput(outputPath, result) {
  const lines = [
    `subject_digest=${result.subject_digest}`,
    `approval_instance_digest=${result.approval_instance_digest ?? ''}`,
    `evidence_baseline_commit=${result.evidence_baseline_commit}`,
    `activation_eligible=${result.activation_eligible ? 'true' : 'false'}`,
  ];
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`);
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = validateBatch0Decision(options);
    if (options.githubOutput) writeGitHubOutput(options.githubOutput, result);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(
        `MOBILE UX BATCH0 DECISION OK: mode=${result.validation_mode} subject=${result.subject_digest}`,
      );
      console.log(`NON-CLAIM: ${result.non_claim}`);
    }
  } catch (error) {
    console.error(`MOBILE UX BATCH0 DECISION FAILED: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
