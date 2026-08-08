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

test('canonical public library labels pass as learner-facing names', () => {
  withFixture(fixtureRoot => {
    const publicLabels = [
      '听力馆',
      '仔细阅读馆',
      '选词填空馆',
      '写作馆',
      '翻译馆',
      '词汇馆',
      '语法馆',
    ];
    fs.writeFileSync(
      path.join(fixtureRoot, 'docs/design/mocks/public-library-labels.html'),
      `<!doctype html><main>${publicLabels.join(' · ')}</main>\n`,
    );

    const result = runScanner(['--root', fixtureRoot]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS: No metadata leaks detected/);
  });
});

test('standalone library name remains quarantined', () => {
  withFixture(fixtureRoot => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'docs/design/mocks/raw-library.html'),
      '<!doctype html><main>听力</main>\n',
    );

    const result = runScanner(['--root', fixtureRoot]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /standalone raw Chinese library label/);
  });
});

test('ordinary prose containing the word grammar is not a library-label leak', () => {
  withFixture(fixtureRoot => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'docs/design/mocks/prose-grammar.html'),
      '<!doctype html><main>四个界面共享同一套物件语法。</main>\n',
    );

    const result = runScanner(['--root', fixtureRoot]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS: No metadata leaks detected/);
  });
});

test('a non-canonical hall label does not inherit the public-label exception', () => {
  withFixture(fixtureRoot => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'docs/design/mocks/non-canonical-hall.html'),
      '<!doctype html><main>阅读馆</main>\n',
    );

    const result = runScanner(['--root', fixtureRoot]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /non-canonical library label/);
  });
});

test('real group label remains quarantined', () => {
  withFixture(fixtureRoot => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'docs/design/mocks/raw-group.html'),
      '<!doctype html><main>逻辑关系</main>\n',
    );

    const result = runScanner(['--root', fixtureRoot]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /standalone raw Chinese group\/box label/);
  });
});

test('standalone high-frequency group label remains quarantined', () => {
  withFixture(fixtureRoot => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'docs/design/mocks/raw-high-frequency-group.html'),
      '<!doctype html><main><span>高频词</span></main>\n',
    );

    const result = runScanner(['--root', fixtureRoot]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /standalone raw Chinese group\/box label/);
  });
});

test('natural sentences containing canonical group terms are not label leaks', () => {
  withFixture(fixtureRoot => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'docs/design/mocks/group-terms-in-prose.html'),
      '<!doctype html><main><p>高频词要连着搭配一起记。</p><p>先判断逻辑关系是否闭合。</p></main>\n',
    );

    const result = runScanner(['--root', fixtureRoot]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS: No metadata leaks detected/);
  });
});

test('real card reference remains quarantined', () => {
  withFixture(fixtureRoot => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'docs/design/mocks/raw-card-reference.html'),
      '<!doctype html><main>当前卡 002001</main>\n',
    );

    const result = runScanner(['--root', fixtureRoot]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /raw box\/card reference/);
  });
});

test('invalid arguments fail closed with exit code two', () => {
  for (const args of [['--root'], ['--unknown']]) {
    const result = runScanner(args);
    assert.equal(result.status, 2, `${args.join(' ')}\n${result.stderr}`);
    assert.match(result.stderr, /FAIL:/);
  }
});
