#!/usr/bin/env node

import {parseStrictJson} from './lib/strict_json.mjs';
import {fileURLToPath} from 'node:url';

const SCHEMA_VERSION = 'exact-diff-review.v1';
const LEGACY_SCHEMA_VERSION = 'single-task-dual-perturbation-review.v1';
const SHA_PATTERN = /^[0-9a-f]{40}$/;

// This gate checks a review declaration and its exact PR-head binding. It cannot
// verify that a review happened, establish product quality, or prove provenance.
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
    .map(match => match[1]);
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
  const legacy = record.schema_version === LEGACY_SCHEMA_VERSION;
  if (record.schema_version !== SCHEMA_VERSION && !legacy) {
    return ['Model review schema_version is invalid'];
  }
  requireExactKeys(record, legacy
    ? ['head_sha', 'policy', 'runs', 'schema_version', 'status', 'summary']
    : ['blocking_findings', 'head_sha', 'schema_version', 'status', 'summary'],
  'Model review', errors);
  if (record.head_sha !== expectedHead) errors.push('Model review head_sha does not match the exact PR head');
  if (record.status !== 'passed') errors.push('Model review status must be passed');
  if (typeof record.summary !== 'string' || record.summary.trim() === '') {
    errors.push('Model review summary is required');
  }
  if (legacy) {
    // Existing PRs may retain their old record. Check every declared decision,
    // but do not require or treat old pass/model/time metadata as provenance.
    if (record.policy !== 'spec/machine-acceptance.json') errors.push('Model review policy is invalid');
    if (!Array.isArray(record.runs)) {
      errors.push('Legacy Model review runs must be an array');
    } else {
      for (const [index, run] of record.runs.entries()) {
        const label = `Legacy Model review run ${index + 1}`;
        if (run === null || typeof run !== 'object' || Array.isArray(run)) {
          errors.push(`${label} must be an object`);
          continue;
        }
        if (run.decision !== 'passed') errors.push(`${label} decision must be passed`);
        requireNoBlockingFindings(run.blocking_findings, label, errors);
      }
    }
  } else {
    requireNoBlockingFindings(record.blocking_findings, 'Model review', errors);
  }
  return errors;
}

function requireNoBlockingFindings(findings, label, errors) {
  if (!Array.isArray(findings) || findings.length !== 0) {
    errors.push(`${label} blocking_findings must be an empty array before merge`);
  }
}

function extractSection(body, heading) {
  const text = String(body ?? '');
  const match = new RegExp(`^## ${heading}\\s*$`, 'm').exec(text);
  if (!match) return null;
  const rest = text.slice(match.index + match[0].length);
  const nextHeading = rest.search(/^##\s+/m);
  return nextHeading < 0 ? rest : rest.slice(0, nextHeading);
}

function requireExactKeys(value, expected, label, errors) {
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
    process.stderr.write(`MODEL REVIEW DECLARATION FAILED\n- ${errors.join('\n- ')}\n`);
    process.exit(1);
  }
  process.stdout.write('MODEL REVIEW DECLARATION OK (structure and head binding only)\n');
}
