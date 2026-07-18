#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { classifyFormalApprovalScope } from './classify_formal_approval_scope.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('ordinary implementation changes do not require formal approval', () => {
  const result = classifyFormalApprovalScope([
    'apps/mobile/src/learning/LearningSurface.tsx',
    'infra/cloudbase/functions/softbook-api/index.js',
  ]);

  assert.equal(result.sensitive, false);
  assert.deepEqual(result.matched_paths, []);
});

test('launch records, evidence, validators, and workflows require approval', () => {
  const changed = [
    'docs/release/launch-readiness.v1.json',
    'docs/agent-runs/evidence/run.json',
    'security/reports/penetration-test.json',
    'scripts/validate_launch_readiness.mjs',
    '.github/workflows/fake-formal-approval.yml',
  ];
  const result = classifyFormalApprovalScope(changed);

  assert.equal(result.sensitive, true);
  assert.deepEqual(result.matched_paths, [...changed].sort());
});

test('renamed sensitive paths remain sensitive through previous filenames', () => {
  const result = classifyFormalApprovalScope([
    'docs/archive/retired-readiness.json',
    'docs/release/launch-readiness.v1.json',
  ]);

  assert.equal(result.sensitive, true);
  assert.deepEqual(result.matched_paths, [
    'docs/release/launch-readiness.v1.json',
  ]);
});

test('empty and malformed changed-file input fails closed', () => {
  assert.equal(classifyFormalApprovalScope([]).sensitive, true);
  const malformed = classifyFormalApprovalScope(['../outside', '/absolute']);
  assert.equal(malformed.sensitive, true);
  assert.deepEqual(malformed.invalid_paths, ['../outside', '/absolute']);
});

test('duplicates and blank lines are normalized deterministically', () => {
  const result = classifyFormalApprovalScope([
    '',
    'apps/mobile/package.json',
    'apps/mobile/package.json',
  ]);

  assert.deepEqual(result.changed_paths, ['apps/mobile/package.json']);
  assert.equal(result.sensitive, false);
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
  assert.equal(fs.readFileSync(output, 'utf8'), 'sensitive=true\n');
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

test('approval workflow classifies with trusted base code before protected approval', () => {
  const workflow = fs.readFileSync(
    path.join(ROOT, '.github', 'workflows', 'formal-approval.yml'),
    'utf8',
  );
  const checkoutStart = workflow.indexOf('uses: actions/checkout@');
  const checkoutEnd = workflow.indexOf('\n      - name:', checkoutStart);
  const checkoutStep = workflow.slice(checkoutStart, checkoutEnd);

  assert.match(workflow, /^  pull_request_target:/m);
  assert.doesNotMatch(workflow, /^  pull_request:/m);
  assert.match(checkoutStep, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.doesNotMatch(checkoutStep, /head\.sha/);
  assert.match(checkoutStep, /persist-credentials: false/);
  assert.match(workflow, /\.changed_files/);
  assert.match(workflow, /--paginate --slurp/);
  assert.match(workflow, /--expected-count/);
  assert.match(workflow, /name: formal-product-owner-approval/);
  assert.match(workflow, /^    name: formal-approval$/m);
});
