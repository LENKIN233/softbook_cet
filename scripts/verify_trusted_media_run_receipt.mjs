#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {parseStrictJson} from './lib/strict_json.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_POLICY_PATH = path.join(
  ROOT,
  'spec',
  'trusted-media-run-receipt.json',
);
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const CONTENT_VERSION_PATTERN = /^sha256:[0-9a-f]{64}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,255}$/;

function exactKeys(value, keys, label, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${label} must be an object.`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(`${label} keys must be exactly ${expected.join(', ')}.`);
    return false;
  }
  return true;
}

function nonPlaceholderSha(value, label, errors) {
  if (
    typeof value !== 'string' ||
    !SHA256_PATTERN.test(value) ||
    /^([0-9a-f])\1{63}$/.test(value)
  ) {
    errors.push(`${label} must be a non-placeholder SHA-256.`);
  }
}

function parseTimestamp(value, label, errors) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    errors.push(`${label} must be an ISO timestamp.`);
    return null;
  }
  return Date.parse(value);
}

function loadRegularFile(filePath, maximumBytes, label, errors) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    errors.push(`${label} does not exist.`);
    return null;
  }
  const stats = fs.lstatSync(resolved);
  if (!stats.isFile() || stats.size <= 0 || stats.size > maximumBytes) {
    errors.push(
      `${label} must be a non-empty regular file no larger than ${maximumBytes} bytes.`,
    );
    return null;
  }
  return fs.readFileSync(resolved);
}

function validateArtifactIdentity(value, label, errors) {
  if (!exactKeys(value, ['sha256', 'size_bytes'], label, errors)) return;
  nonPlaceholderSha(value.sha256, `${label}.sha256`, errors);
  if (!Number.isInteger(value.size_bytes) || value.size_bytes <= 0) {
    errors.push(`${label}.size_bytes must be a positive integer.`);
  }
}

function validateReceipt(receipt, policy, errors) {
  if (!exactKeys(
    receipt,
    [
      'schema_version',
      'receipt_id',
      'created_at',
      'source',
      'execution',
      'candidate',
      'artifacts',
      'review_runs',
      'result',
    ],
    'receipt',
    errors,
  )) return;
  if (receipt.schema_version !== policy.receipt.schema_version) {
    errors.push('receipt.schema_version does not match policy.');
  }
  if (typeof receipt.receipt_id !== 'string' || !ID_PATTERN.test(receipt.receipt_id)) {
    errors.push('receipt.receipt_id has an invalid value.');
  }
  parseTimestamp(receipt.created_at, 'receipt.created_at', errors);

  const source = receipt.source;
  if (exactKeys(
    source,
    ['repository', 'ref', 'commit_sha', 'workflow_path', 'workflow_sha256'],
    'receipt.source',
    errors,
  )) {
    if (source.repository !== policy.producer.repository) {
      errors.push('receipt.source.repository does not match the trusted producer.');
    }
    if (source.ref !== policy.producer.source_ref) {
      errors.push('receipt.source.ref does not match the trusted source ref.');
    }
    if (!COMMIT_PATTERN.test(source.commit_sha ?? '')) {
      errors.push('receipt.source.commit_sha must be a 40-character commit SHA.');
    }
    if (source.workflow_path !== policy.producer.workflow_path) {
      errors.push('receipt.source.workflow_path does not match the trusted workflow.');
    }
    nonPlaceholderSha(source.workflow_sha256, 'receipt.source.workflow_sha256', errors);
  }

  const execution = receipt.execution;
  if (exactKeys(
    execution,
    [
      'workflow_run_id',
      'workflow_run_attempt',
      'runner_class',
      'started_at',
      'completed_at',
      'model',
      'harness',
    ],
    'receipt.execution',
    errors,
  )) {
    if (!/^[1-9][0-9]{5,19}$/.test(execution.workflow_run_id ?? '')) {
      errors.push('receipt.execution.workflow_run_id has an invalid value.');
    }
    if (!Number.isInteger(execution.workflow_run_attempt) || execution.workflow_run_attempt < 1) {
      errors.push('receipt.execution.workflow_run_attempt must be a positive integer.');
    }
    if (execution.runner_class !== policy.producer.required_runner_class) {
      errors.push('receipt.execution.runner_class does not match policy.');
    }
    const startedAt = parseTimestamp(
      execution.started_at,
      'receipt.execution.started_at',
      errors,
    );
    const completedAt = parseTimestamp(
      execution.completed_at,
      'receipt.execution.completed_at',
      errors,
    );
    if (startedAt !== null && completedAt !== null && completedAt <= startedAt) {
      errors.push('receipt.execution.completed_at must be after started_at.');
    }
    if (exactKeys(
      execution.model,
      ['id', 'revision', 'weights_manifest_sha256'],
      'receipt.execution.model',
      errors,
    )) {
      if (
        typeof execution.model.id !== 'string' ||
        !MODEL_ID_PATTERN.test(execution.model.id)
      ) {
        errors.push('receipt.execution.model.id has an invalid value.');
      }
      if (
        typeof execution.model.revision !== 'string' ||
        !/^[0-9a-f]{40}$/.test(execution.model.revision)
      ) {
        errors.push('receipt.execution.model.revision must be a 40-character revision.');
      }
      nonPlaceholderSha(
        execution.model.weights_manifest_sha256,
        'receipt.execution.model.weights_manifest_sha256',
        errors,
      );
    }
    if (exactKeys(
      execution.harness,
      ['driver_bundle_sha256', 'dependency_lock_sha256'],
      'receipt.execution.harness',
      errors,
    )) {
      nonPlaceholderSha(
        execution.harness.driver_bundle_sha256,
        'receipt.execution.harness.driver_bundle_sha256',
        errors,
      );
      nonPlaceholderSha(
        execution.harness.dependency_lock_sha256,
        'receipt.execution.harness.dependency_lock_sha256',
        errors,
      );
    }
  }

  const candidate = receipt.candidate;
  const expectedScope = policy.receipt.exact_cet4_scope;
  if (exactKeys(
    candidate,
    [
      'track',
      'card_count',
      'box_count',
      'audio_asset_count',
      'content_version',
      'content_authorization_sha256',
      'full_track_review_sha256',
      'quality_audit_sha256',
    ],
    'receipt.candidate',
    errors,
  )) {
    for (const field of ['track', 'card_count', 'box_count', 'audio_asset_count']) {
      if (candidate[field] !== expectedScope[field]) {
        errors.push(`receipt.candidate.${field} does not match exact CET4 scope.`);
      }
    }
    if (!CONTENT_VERSION_PATTERN.test(candidate.content_version ?? '')) {
      errors.push('receipt.candidate.content_version has an invalid value.');
    }
    for (const field of [
      'content_authorization_sha256',
      'full_track_review_sha256',
      'quality_audit_sha256',
    ]) {
      nonPlaceholderSha(candidate[field], `receipt.candidate.${field}`, errors);
    }
  }

  const artifacts = receipt.artifacts;
  if (exactKeys(
    artifacts,
    ['audio_manifest', 'review_worklist', 'raw_run_manifest'],
    'receipt.artifacts',
    errors,
  )) {
    for (const field of ['audio_manifest', 'review_worklist', 'raw_run_manifest']) {
      validateArtifactIdentity(artifacts[field], `receipt.artifacts.${field}`, errors);
    }
  }

  if (!Array.isArray(receipt.review_runs) || receipt.review_runs.length < 2) {
    errors.push('receipt.review_runs must contain at least two runs.');
  } else {
    const runIds = new Set();
    const rawOutputHashes = new Set();
    let fullRunCount = 0;
    let completeConsumptionCount = 0;
    for (const [index, run] of receipt.review_runs.entries()) {
      const label = `receipt.review_runs[${index}]`;
      if (!exactKeys(
        run,
        [
          'run_id',
          'purpose',
          'model_id',
          'model_revision',
          'card_count',
          'complete_asset_count',
          'raw_output_sha256',
        ],
        label,
        errors,
      )) continue;
      if (typeof run.run_id !== 'string' || !ID_PATTERN.test(run.run_id)) {
        errors.push(`${label}.run_id has an invalid value.`);
      } else if (runIds.has(run.run_id)) {
        errors.push(`${label}.run_id is duplicated.`);
      } else {
        runIds.add(run.run_id);
      }
      if (!['full_perceptual', 'adjudication', 'pronunciation', 'blind_transcript'].includes(run.purpose)) {
        errors.push(`${label}.purpose is invalid.`);
      }
      if (run.model_id !== execution?.model?.id) {
        errors.push(`${label}.model_id does not match execution.model.id.`);
      }
      if (run.model_revision !== execution?.model?.revision) {
        errors.push(`${label}.model_revision does not match execution.model.revision.`);
      }
      if (!Number.isInteger(run.card_count) || run.card_count < 1 || run.card_count > 301) {
        errors.push(`${label}.card_count must be between 1 and 301.`);
      }
      if (run.complete_asset_count !== run.card_count) {
        errors.push(`${label}.complete_asset_count must equal card_count.`);
      }
      nonPlaceholderSha(run.raw_output_sha256, `${label}.raw_output_sha256`, errors);
      if (rawOutputHashes.has(run.raw_output_sha256)) {
        errors.push(`${label}.raw_output_sha256 is duplicated.`);
      } else {
        rawOutputHashes.add(run.raw_output_sha256);
      }
      completeConsumptionCount += Number.isInteger(run.complete_asset_count)
        ? run.complete_asset_count
        : 0;
      if (run.purpose === 'full_perceptual') {
        fullRunCount += 1;
        if (run.card_count !== 301) {
          errors.push(`${label} full_perceptual run must cover all 301 assets.`);
        }
      }
    }
    if (fullRunCount < policy.receipt.minimum_full_perceptual_runs) {
      errors.push('receipt does not contain two complete full_perceptual runs.');
    }
    if (completeConsumptionCount < policy.receipt.minimum_complete_asset_consumptions) {
      errors.push('receipt complete asset consumption count is below policy.');
    }
  }

  const result = receipt.result;
  if (exactKeys(
    result,
    [
      'reviewed_card_count',
      'passed_card_count',
      'failed_card_count',
      'every_card_has_two_independent_acceptances',
      'all_assets_complete_consumed',
      'all_required_checks_passed',
    ],
    'receipt.result',
    errors,
  )) {
    for (const [field, expected] of Object.entries(policy.receipt.required_result)) {
      if (result[field] !== expected) {
        errors.push(`receipt.result.${field} does not match policy.`);
      }
    }
  }
}

function findVerifiedSubjectDigest(verification, receiptSha256) {
  if (!Array.isArray(verification)) return false;
  return verification.some(entry => {
    const subjects = entry?.verificationResult?.statement?.subject;
    const timestamps = entry?.verificationResult?.verifiedTimestamps;
    return (
      Array.isArray(timestamps) &&
      timestamps.length > 0 &&
      Array.isArray(subjects) &&
      subjects.some(subject => subject?.digest?.sha256 === receiptSha256)
    );
  });
}

export function verifyTrustedMediaRunReceipt({
  receiptPath,
  bundlePath = null,
  verifyAttestation = false,
  execFile = execFileSync,
} = {}) {
  const errors = [];
  const policyBytes = loadRegularFile(
    DEFAULT_POLICY_PATH,
    1024 * 1024,
    'trusted media receipt policy',
    errors,
  );
  let policy = null;
  if (policyBytes) {
    try {
      policy = parseStrictJson(policyBytes, 'trusted media receipt policy');
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (!policy) {
    return {ok: false, formal_ready: false, attestation_verified: false, errors};
  }
  const receiptBytes = loadRegularFile(
    receiptPath,
    policy.receipt?.maximum_bytes ?? 0,
    'trusted media receipt',
    errors,
  );
  let receipt = null;
  if (receiptBytes) {
    try {
      receipt = parseStrictJson(receiptBytes, 'trusted media receipt');
      validateReceipt(receipt, policy, errors);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  const receiptSha256 = receiptBytes
    ? createHash('sha256').update(receiptBytes).digest('hex')
    : null;
  let attestationVerified = false;
  if (verifyAttestation && receipt && errors.length === 0) {
    const bundleBytes = loadRegularFile(
      bundlePath,
      8 * 1024 * 1024,
      'trusted media attestation bundle',
      errors,
    );
    if (bundleBytes) {
      const args = [
        'attestation',
        'verify',
        path.resolve(receiptPath),
        '--repo',
        policy.producer.repository,
        '--bundle',
        path.resolve(bundlePath),
        '--signer-workflow',
        policy.producer.signer_workflow,
        '--signer-digest',
        receipt.source.commit_sha,
        '--source-digest',
        receipt.source.commit_sha,
        '--source-ref',
        policy.producer.source_ref,
        '--cert-oidc-issuer',
        policy.producer.oidc_issuer,
        '--predicate-type',
        policy.producer.predicate_type,
        '--format',
        'json',
      ];
      try {
        const output = execFile('gh', args, {
          encoding: 'utf8',
          maxBuffer: 16 * 1024 * 1024,
        });
        const verification = parseStrictJson(
          Buffer.from(output),
          'gh attestation verification output',
        );
        if (!findVerifiedSubjectDigest(verification, receiptSha256)) {
          errors.push(
            'verified attestation does not bind the local receipt SHA-256 and a trusted timestamp.',
          );
        } else {
          attestationVerified = true;
        }
      } catch (error) {
        errors.push(
          `GitHub Artifact Attestation verification failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
  return {
    ok: errors.length === 0,
    formal_ready: errors.length === 0 && attestationVerified,
    attestation_verified: attestationVerified,
    receipt_sha256: receiptSha256,
    source_commit_sha: receipt?.source?.commit_sha ?? null,
    errors,
  };
}

function parseArgs(argv) {
  const result = {verifyAttestation: false};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--verify-attestation') {
      result.verifyAttestation = true;
    } else if (token === '--receipt' || token === '--bundle') {
      const value = argv[index + 1];
      if (!value) throw new Error(`${token} requires a value.`);
      index += 1;
      if (token === '--receipt') result.receiptPath = value;
      if (token === '--bundle') result.bundlePath = value;
    } else {
      throw new Error(`unknown argument: ${token}`);
    }
  }
  if (!result.receiptPath) throw new Error('--receipt is required.');
  if (result.verifyAttestation && !result.bundlePath) {
    throw new Error('--bundle is required with --verify-attestation.');
  }
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = verifyTrustedMediaRunReceipt(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
