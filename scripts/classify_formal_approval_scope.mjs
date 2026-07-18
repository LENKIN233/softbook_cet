#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const GITHUB_FILES_API_LIMIT = 3000;
const EXACT_SENSITIVE_PATHS = new Set([
  '.github/workflows/formal-approval.yml',
  'scripts/classify_formal_approval_scope.mjs',
  'scripts/test_classify_formal_approval_scope.mjs',
  'scripts/report_repo_health.mjs',
  'scripts/test_report_repo_health.mjs',
  'scripts/validate_launch_readiness.mjs',
  'scripts/test_validate_launch_readiness.mjs',
  'scripts/harness_validator/sections/governance_contracts.py',
  'scripts/harness_validator/sections/delivery_runtime.py',
  'spec/agent-harness.json',
  'spec/evals.json',
  'spec/harness-architecture.json',
  'spec/repo-delivery-contract.json',
]);
const SENSITIVE_PREFIXES = [
  '.github/workflows/',
  'docs/agent-runs/evidence/',
  'docs/release/',
  'security/reports/',
];

export function classifyFormalApprovalScope(rawPaths) {
  const invalid_paths = [];
  const normalized = new Set();

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
        SENSITIVE_PREFIXES.some(prefix => value.startsWith(prefix)),
    )
    .sort();
  const changed_paths = [...normalized].sort();
  return {
    schema_version: 'formal-approval-scope.v1',
    sensitive: invalid_paths.length > 0 || changed_paths.length === 0 || matched_paths.length > 0,
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
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  if (Boolean(options.files) === Boolean(options.githubFiles)) {
    throw new Error('exactly one of --files or --github-files is required');
  }
  if (options.githubFiles && options.expectedCount === null) {
    throw new Error('--expected-count is required with --github-files');
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
      : fs.readFileSync(options.files, 'utf8').split(/\r?\n/);
    const result = classifyFormalApprovalScope(paths);
    console.log(JSON.stringify(result, null, 2));
    if (options.githubOutput) {
      fs.appendFileSync(
        options.githubOutput,
        `sensitive=${result.sensitive ? 'true' : 'false'}\n`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
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
  for (const fileEntry of files) {
    if (
      !fileEntry ||
      typeof fileEntry !== 'object' ||
      typeof fileEntry.filename !== 'string' ||
      !fileEntry.filename
    ) {
      throw new Error('GitHub changed-file entry is malformed');
    }
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
  return paths;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
