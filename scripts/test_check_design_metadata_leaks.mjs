#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scanner = path.join(root, 'scripts/check_design_metadata_leaks.mjs');

function runScanner(args = []) {
  return spawnSync(process.execPath, [scanner, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

function withFixture(callback) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-design-scan-'));
  try {
    fs.mkdirSync(path.join(fixtureRoot, 'docs/design/mocks'), {recursive: true});
    return callback(fixtureRoot);
  } finally {
    fs.rmSync(fixtureRoot, {recursive: true, force: true});
  }
}

test('explicit root scans an isolated valid design tree', () => {
  withFixture(fixtureRoot => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'docs/design/mocks/valid.html'),
      '<!doctype html><main>专注完成当前学习任务</main>\n',
    );

    const result = runScanner(['--root', fixtureRoot]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS: No metadata leaks detected/);
  });
});

test('explicit root reports a fixture leak relative to that root', () => {
  withFixture(fixtureRoot => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'docs/design/mocks/leak.html'),
      '<!doctype html><main>runtime debug payload</main>\n',
    );

    const result = runScanner(['--root', fixtureRoot]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /docs\/design\/mocks\/leak\.html/);
    assert.match(result.stderr, /internal process or implementation term/);
  });
});

test('invalid arguments fail closed with exit code two', () => {
  for (const args of [['--root'], ['--unknown']]) {
    const result = runScanner(args);
    assert.equal(result.status, 2, `${args.join(' ')}\n${result.stderr}`);
    assert.match(result.stderr, /FAIL:/);
  }
});
