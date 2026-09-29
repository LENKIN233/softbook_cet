import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {validateModelReviewBody} from './validate_model_review.mjs';

const HEAD = 'a'.repeat(40);
const record = () => ({
  schema_version: 'exact-diff-review.v1',
  head_sha: HEAD,
  status: 'passed',
  blocking_findings: [],
  summary: 'Reviewed keyboard visibility and delayed login failures against the diff. Android, iOS and Web observations are in 验证; physical devices remain unverified.',
});
const body = value => `## Model review\n\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\`\n`;
const legacyRecord = () => ({
  schema_version: 'single-task-dual-perturbation-review.v1',
  head_sha: HEAD,
  policy: 'spec/machine-acceptance.json',
  runs: [{decision: 'passed', blocking_findings: []}],
  status: 'passed',
  summary: 'Reviewed the affected runtime behavior and remaining limitations.',
});

test('a concise exact-diff review needs no fabricated model identity or fixed passes', () => {
  assert.deepEqual(validateModelReviewBody(body(record()), HEAD), []);
});

test('the repository PR template produces a compatible review declaration', () => {
  const template = readFileSync(new URL('../.github/pull_request_template.md', import.meta.url), 'utf8');
  assert.deepEqual(validateModelReviewBody(template.replace('<exact-40-character-pr-head-sha>', HEAD), HEAD), []);
});

test('task-specific review language is accepted without prescribing a reasoning method', () => {
  const review = record();
  review.summary = 'Checked the renamed label in the three affected screens; the task and action remain clear.';
  assert.deepEqual(validateModelReviewBody(body(review), HEAD), []);
});

test('missing section, invalid expected head and stale reviewed head fail closed', () => {
  assert.match(validateModelReviewBody('', HEAD).join(';'), /missing/);
  assert.match(validateModelReviewBody(body(record()), 'abc').join(';'), /full lowercase SHA-1/);
  assert.match(validateModelReviewBody(body({...record(), head_sha: 'b'.repeat(40)}), HEAD).join(';'), /head_sha/);
  assert.match(validateModelReviewBody(body(record()).replace('## Model review', '## Model review notes'), HEAD).join(';'), /missing/);
});

test('blocking findings and unfinished decisions cannot be represented as merge-ready', () => {
  for (const status of ['revise', 'blocked', '', null]) {
    assert.match(validateModelReviewBody(body({...record(), status}), HEAD).join(';'), /status/);
  }
  for (const blocking_findings of [['P1: login button remains covered'], null, 'none']) {
    assert.match(validateModelReviewBody(body({...record(), blocking_findings}), HEAD).join(';'), /blocking_findings/);
  }
});

test('empty summaries and records with missing or retired fields are rejected', () => {
  for (const summary of ['', '   ', null]) {
    assert.match(validateModelReviewBody(body({...record(), summary}), HEAD).join(';'), /summary/);
  }
  const missingFindings = record();
  delete missingFindings.blocking_findings;
  assert.match(validateModelReviewBody(body(missingFindings), HEAD).join(';'), /keys/);
  assert.match(validateModelReviewBody(body({...record(), runs: []}), HEAD).join(';'), /keys/);
  assert.match(validateModelReviewBody(body({...record(), schema_version: 'unknown-review.v1'}), HEAD).join(';'), /schema_version/);
});

test('existing legacy declarations remain accepted without forcing pass count or metadata', () => {
  const legacy = legacyRecord();
  assert.deepEqual(validateModelReviewBody(body(legacy), HEAD), []);
  legacy.runs = Array.from({length: 3}, () => ({
    principal: 'agent:codex', model: 'historical-model', run_id: 'retained-value',
    perturbation_id: 'task-specific', reviewed_at: 'retained-value',
    capabilities: ['exact_diff_review'], decision: 'passed', blocking_findings: [],
  }));
  assert.deepEqual(validateModelReviewBody(body(legacy), HEAD), []);
});

test('legacy compatibility preserves exact head and every declared decision', () => {
  assert.match(validateModelReviewBody(body({...legacyRecord(), head_sha: 'b'.repeat(40)}), HEAD).join(';'), /head_sha/);
  assert.match(validateModelReviewBody(body({...legacyRecord(), status: 'blocked'}), HEAD).join(';'), /status/);
  assert.match(validateModelReviewBody(body({...legacyRecord(), summary: ' '}), HEAD).join(';'), /summary/);
  for (const run of [
    {decision: 'blocked', blocking_findings: []},
    {decision: 'passed', blocking_findings: ['P1: a remaining runtime failure']},
    {decision: 'passed'}, null,
  ]) {
    const legacy = legacyRecord();
    legacy.runs.push(run);
    assert.notDeepEqual(validateModelReviewBody(body(legacy), HEAD), []);
  }
  assert.match(validateModelReviewBody(body({...legacyRecord(), runs: 'passed'}), HEAD).join(';'), /runs/);
});

test('ambiguous, duplicate-key and malformed review records fail closed', () => {
  const duplicateRecord = `${body(record())}\n\`\`\`json\n${JSON.stringify(record())}\n\`\`\``;
  assert.match(validateModelReviewBody(duplicateRecord, HEAD).join(';'), /exactly one/);
  assert.match(validateModelReviewBody(body(record()).replace('"status":"passed"', '"status":"blocked","status":"passed"'), HEAD).join(';'), /duplicate/i);
  assert.match(validateModelReviewBody('## Model review\n```json\n{\n```', HEAD).join(';'), /JSON/);
  assert.match(validateModelReviewBody(body(null), HEAD).join(';'), /object/);
});

test('review in another section cannot satisfy the gate', () => {
  const misplaced = `## Model review\nNo record.\n## 验证\n\`\`\`json\n${JSON.stringify(record())}\n\`\`\``;
  assert.match(validateModelReviewBody(misplaced, HEAD).join(';'), /exactly one/);
});
