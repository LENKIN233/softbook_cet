#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MUTABLE_POLICY_FILES = new Set([
  'docs/agent-runs/README.md',
  'docs/agent-runs/TEMPLATE.md',
]);

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

export function historicalRunRecordChanges(paths) {
  return [...new Set(paths)]
    .filter(file =>
      file.startsWith('docs/agent-runs/') &&
      file.endsWith('.md') &&
      !file.slice('docs/agent-runs/'.length).includes('/') &&
      !MUTABLE_POLICY_FILES.has(file))
    .sort();
}

function changedPaths(base, head) {
  const result = spawnSync(
    'git',
    ['diff', '--name-only', '--no-renames', '--diff-filter=ACMRD', `${base}...${head}`],
    {cwd: ROOT, encoding: 'utf8'},
  );
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'unable to inspect agent-run archive diff');
  }
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function main() {
  const base = option('--base');
  const head = option('--head') || 'HEAD';
  if (!base) throw new Error('--base is required');
  const changed = historicalRunRecordChanges(changedPaths(base, head));
  const report = {
    schema_version: 'agent-run-archive-guard.v1',
    ok: changed.length === 0,
    base,
    head,
    changed_historical_records: changed,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
