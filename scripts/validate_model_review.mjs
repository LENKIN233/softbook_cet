#!/usr/bin/env node

import {parseStrictJson} from './lib/strict_json.mjs';
import {fileURLToPath} from 'node:url';

const SCHEMA_VERSION = 'single-task-dual-perturbation-review.v1';
const REQUIRED_PERTURBATIONS = new Set([
  'assumption_inversion',
  'failure_projection',
]);
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function validateModelReviewBody(body, expectedHead) {
  const errors = [];
  if (!SHA_PATTERN.test(expectedHead ?? '')) {
    return ['expected PR head must be a full lowercase SHA-1'];
  }
  const section = extractSection(body, 'Model review');
  if (section === null) {
    return ['PR body is missing the Model review section'];
  }
  const records = [...section.matchAll(/```json\s*([\s\S]*?)```/g)]
    .map(match => match[1])
    .filter(candidate => candidate.includes(SCHEMA_VERSION));
  if (records.length !== 1) {
    return [`Model review must contain exactly one ${SCHEMA_VERSION} JSON record`];
  }

  let record;
  try {
    record = parseStrictJson(records[0], 'Model review JSON');
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    return ['Model review must be an object'];
  }
  requireExactKeys(record, [
    'head_sha',
    'policy',
    'runs',
    'schema_version',
    'status',
    'summary',
  ], 'Model review', errors);
  if (record.schema_version !== SCHEMA_VERSION) errors.push('Model review schema_version is invalid');
  if (record.head_sha !== expectedHead) errors.push('Model review head_sha does not match the exact PR head');
  if (record.policy !== 'spec/machine-acceptance.json') errors.push('Model review policy is invalid');
  if (record.status !== 'passed') errors.push('Model review status must be passed');
  if (typeof record.summary !== 'string' || record.summary.trim() === '') {
    errors.push('Model review summary is required');
  }
  if (!Array.isArray(record.runs) || record.runs.length !== 2) {
    errors.push('Model review must contain exactly two perturbation runs');
    return errors;
  }

  const perturbations = new Set();
  const runIds = new Set();
  for (const [index, run] of record.runs.entries()) {
    const label = `Model review run ${index + 1}`;
    if (run === null || typeof run !== 'object' || Array.isArray(run)) {
      errors.push(`${label} must be an object`);
      continue;
    }
    requireExactKeys(run, [
      'blocking_findings',
      'capabilities',
      'decision',
      'model',
      'perturbation_id',
      'principal',
      'reviewed_at',
      'run_id',
    ], label, errors);
    if (typeof run.principal !== 'string' || !/^(?:agent|model|service):[A-Za-z0-9_.-]+$/.test(run.principal)) {
      errors.push(`${label} principal is invalid`);
    }
    if (typeof run.model !== 'string' || run.model.trim() === '') errors.push(`${label} model is required`);
    if (!UUID_PATTERN.test(run.run_id ?? '') || runIds.has(run.run_id)) errors.push(`${label} run_id must be a distinct UUID`);
    runIds.add(run.run_id);
    if (!REQUIRED_PERTURBATIONS.has(run.perturbation_id) || perturbations.has(run.perturbation_id)) {
      errors.push(`${label} perturbation_id is invalid or duplicated`);
    }
    perturbations.add(run.perturbation_id);
    if (!RFC3339_PATTERN.test(run.reviewed_at ?? '') || !Number.isFinite(Date.parse(run.reviewed_at))) {
      errors.push(`${label} reviewed_at must be RFC3339`);
    }
    if (!Array.isArray(run.capabilities) || !run.capabilities.includes('exact_diff_review')) {
      errors.push(`${label} must declare exact_diff_review capability`);
    }
    if (run.decision !== 'passed') errors.push(`${label} decision must be passed`);
    if (!Array.isArray(run.blocking_findings) || run.blocking_findings.length !== 0) {
      errors.push(`${label} blocking_findings must be an empty array`);
    }
  }
  if ([...REQUIRED_PERTURBATIONS].some(value => !perturbations.has(value))) {
    errors.push('Model review perturbation coverage is incomplete');
  }
  return errors;
}

function extractSection(body, heading) {
  const text = String(body ?? '');
  const marker = `## ${heading}`;
  const start = text.indexOf(marker);
  if (start < 0) return null;
  const rest = text.slice(start + marker.length);
  const nextHeading = rest.search(/^##\s+/m);
  return nextHeading < 0 ? rest : rest.slice(0, nextHeading);
}

function requireExactKeys(value, expected, label, errors) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${label} must be an object`);
    return;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    errors.push(`${label} keys are invalid`);
  }
}

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const bodyEnv = option('--body-env', 'PR_BODY');
  const expectedHead = option('--head', process.env.GITHUB_HEAD_SHA ?? '');
  const errors = validateModelReviewBody(process.env[bodyEnv] ?? '', expectedHead);
  if (errors.length) {
    process.stderr.write(`MODEL REVIEW GATE FAILED\n- ${errors.join('\n- ')}\n`);
    process.exit(1);
  }
  process.stdout.write('MODEL REVIEW GATE OK\n');
}
