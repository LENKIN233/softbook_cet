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

test('learner surface rejects review language emitted by inline script', () => {
  withFixture(fixtureRoot => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'docs/design/mocks/dynamic-learner-leak.html'),
      '<!doctype html><template data-learner-surface><main>继续学习</main></template><script>status.textContent = "主动作已转为下一张";</script>\n',
    );

    const result = runScanner(['--root', fixtureRoot]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /QA or state-machine narration in learner surface/);
    assert.match(result.stderr, /learner dynamic copy/);
  });
});

test('learner surface rejects proof copy and raw numeric box references', () => {
  withFixture(fixtureRoot => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'docs/design/mocks/static-learner-leak.html'),
      '<!doctype html><template data-learner-surface><main><p>本证明不展示真实号码</p><span>第 3 盒</span></main></template>\n',
    );

    const result = runScanner(['--root', fixtureRoot]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /review, implementation, or data-model language in learner surface/);
    assert.match(result.stderr, /raw numeric box reference in learner surface/);
  });
});

test('reviewer-only notes stay allowed outside a marked learner surface', () => {
  withFixture(fixtureRoot => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'docs/design/mocks/reviewer-shell.html'),
      '<!doctype html><body data-audience="reviewer"><aside>主动作与第 3 盒的内部审查说明</aside><template data-learner-surface><main>确认后查看解析</main></template></body>\n',
    );

    const result = runScanner(['--root', fixtureRoot]);

    assert.equal(result.status, 0, result.stderr);
  });
});

test('reviewer-only CSS and JavaScript stay outside learner-copy scope', () => {
  withFixture(fixtureRoot => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'docs/design/mocks/reviewer-dynamic-shell.html'),
      '<!doctype html><body data-audience="reviewer"><style>.reviewer::before{content:"主动作"}</style><aside id="reviewer">审查说明</aside><template data-learner-surface><main>确认后查看解析</main></template><script>document.querySelector("#reviewer").textContent="主动作已转为复审";</script></body>\n',
    );

    const result = runScanner(['--root', fixtureRoot]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS: No metadata leaks detected/);
  });
});

test('an unmarked mixed shell fails closed across static and dynamic copy', () => {
  withFixture(fixtureRoot => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'docs/design/mocks/unmarked-mixed-shell.html'),
      '<!doctype html><aside>第 3 盒的内部审查说明</aside><template data-learner-surface><main>确认后查看解析</main></template><script>status.textContent="主动作已转为下一张";</script>\n',
    );

    const result = runScanner(['--root', fixtureRoot]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /raw numeric box reference in learner surface/);
    assert.match(result.stderr, /QA or state-machine narration in learner surface/);
  });
});

test('an explicit learner document fails when its learner-surface marker is missing', () => {
  withFixture(fixtureRoot => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'docs/design/mocks/unmarked-learner.html'),
      '<!doctype html><body data-audience="learner"><main>继续学习</main></body>\n',
    );

    const result = runScanner(['--root', fixtureRoot]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing the required data-learner-surface marker/);
    assert.match(result.stderr, /learner boundary/);
  });
});

test('a learner comment cannot impersonate a learner-surface marker', () => {
  withFixture(fixtureRoot => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'docs/design/mocks/comment-marker-learner.html'),
      '<!doctype html><body data-audience="learner"><!-- <template data-learner-surface>fake</template> --><main>继续学习</main></body>\n',
    );

    const result = runScanner(['--root', fixtureRoot]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing the required data-learner-surface marker/);
  });
});

test('a script string cannot impersonate a learner-surface marker', () => {
  withFixture(fixtureRoot => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'docs/design/mocks/script-marker-learner.html'),
      '<!doctype html><body data-audience="learner"><main>继续学习</main><script>const fake = "<template data-learner-surface>fake</template>";</script></body>\n',
    );

    const result = runScanner(['--root', fixtureRoot]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing the required data-learner-surface marker/);
  });
});

test('mvr-15 learner preview stays isolated and template-aligned with its reviewer harness', () => {
  const proofRoot = path.join(
    root,
    'docs/design/search-runs/2026-08-08-mobile-visual-rebuild-v3/candidate-proofs',
  );
  const preview = fs.readFileSync(path.join(proofRoot, 'mvr-15-soft-spine.html'), 'utf8');
  const reviewer = fs.readFileSync(path.join(proofRoot, 'mvr-15-review-harness.html'), 'utf8');
  const learnerTemplate = source =>
    source.match(
      /<template\b[^>]*\bdata-learner-surface(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?[^>]*>([\s\S]*?)<\/template>/i,
    )?.[1];

  assert.match(preview, /<body\b[^>]*\bdata-audience="learner"/i);
  assert.match(reviewer, /<body\b[^>]*\bdata-audience="reviewer"/i);
  assert.doesNotMatch(
    preview,
    /fetch\s*\(|\bFunction\s*\(|mvr-15-review-harness|control-deck|proof-section|contrast-ledger/,
  );
  assert.ok(learnerTemplate(preview), 'preview learner template is required');
  assert.equal(learnerTemplate(preview), learnerTemplate(reviewer));
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
