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
const PERCEPTUAL_CHECKS = Object.freeze([
  'audio_matches_text',
  'target_signal_audible',
  'accurate_pronunciation',
  'suitable_speed',
  'natural_rhythm',
  'stress_and_pauses_do_not_mislead',
  'no_unwanted_noise_or_clipping',
]);

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

function loadBoundArtifact(directory, filename, identity, label, errors) {
  const root = path.resolve(directory ?? '');
  const target = path.resolve(root, filename);
  if (path.dirname(target) !== root) {
    errors.push(`${label} path escapes the artifact directory.`);
    return null;
  }
  const bytes = loadRegularFile(target, 16 * 1024 * 1024, label, errors);
  if (!bytes) return null;
  const observed = createHash('sha256').update(bytes).digest('hex');
  if (observed !== identity?.sha256 || bytes.length !== identity?.size_bytes) {
    errors.push(`${label} bytes do not match the attested receipt identity.`);
    return null;
  }
  return {bytes, path: target};
}

function parseArtifactJson(file, label, errors) {
  if (!file) return null;
  try {
    return parseStrictJson(file.bytes, label);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return null;
  }
}

function validateAudioCoverage(value, policy, label, errors) {
  if (!exactKeys(
    value,
    [
      'decoder',
      'decoded_sample_count',
      'model_input_sample_count',
      'model_max_sample_count',
      'sample_rate_hz',
      'truncated',
    ],
    label,
    errors,
  )) return;
  const expected = policy.receipt.required_audio_coverage;
  if (
    value.decoder !== expected.decoder ||
    !Number.isSafeInteger(value.decoded_sample_count) ||
    value.decoded_sample_count < 1 ||
    value.model_input_sample_count !== value.decoded_sample_count ||
    value.model_max_sample_count !== expected.model_max_sample_count ||
    value.decoded_sample_count > value.model_max_sample_count ||
    value.sample_rate_hz !== expected.sample_rate_hz ||
    value.truncated !== expected.truncated
  ) {
    errors.push(`${label} does not prove complete untruncated model input.`);
  }
}

function parseJsonLines(bytes, label, errors) {
  const records = [];
  for (const [index, line] of bytes.toString('utf8').split('\n').entries()) {
    if (!line) continue;
    try {
      records.push(parseStrictJson(Buffer.from(line), `${label} line ${index + 1}`));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return records;
}

function validateArtifactEvidence(receipt, policy, artifactDirectory, errors) {
  if (!artifactDirectory) {
    errors.push('formal media verification requires --artifact-dir with the exact run artifacts.');
    return false;
  }
  const filenames = policy.receipt.artifact_files;
  const audioManifestFile = loadBoundArtifact(
    artifactDirectory,
    filenames.audio_manifest,
    receipt.artifacts.audio_manifest,
    'trusted media audio manifest',
    errors,
  );
  const worklistFile = loadBoundArtifact(
    artifactDirectory,
    filenames.review_worklist,
    receipt.artifacts.review_worklist,
    'trusted media reviewed worklist',
    errors,
  );
  const rawManifestFile = loadBoundArtifact(
    artifactDirectory,
    filenames.raw_run_manifest,
    receipt.artifacts.raw_run_manifest,
    'trusted media raw run manifest',
    errors,
  );
  const audioManifest = parseArtifactJson(audioManifestFile, 'trusted media audio manifest', errors);
  const worklist = parseArtifactJson(worklistFile, 'trusted media reviewed worklist', errors);
  const rawManifest = parseArtifactJson(rawManifestFile, 'trusted media raw run manifest', errors);
  if (!audioManifest || !worklist || !rawManifest) return false;

  if (
    audioManifest.schema_version !== 'trusted-media-audio-manifest.v1' ||
    audioManifest.track !== 'cet4' ||
    audioManifest.asset_count !== 301 ||
    !Array.isArray(audioManifest.assets) ||
    audioManifest.assets.length !== 301
  ) {
    errors.push('trusted media audio manifest does not contain the exact CET4 301-asset scope.');
    return false;
  }
  const assetsByCard = new Map();
  for (const [index, asset] of audioManifest.assets.entries()) {
    const label = `audio manifest assets[${index}]`;
    if (!exactKeys(
      asset,
      ['card_id', 'asset_path', 'file_sha256', 'size_bytes', 'transcript_sha256'],
      label,
      errors,
    )) continue;
    if (
      typeof asset.card_id !== 'string' ||
      assetsByCard.has(asset.card_id) ||
      typeof asset.asset_path !== 'string' ||
      !asset.asset_path.startsWith('ai_tts/cet4/') ||
      !asset.asset_path.endsWith('.mp3') ||
      !SHA256_PATTERN.test(asset.file_sha256 ?? '') ||
      !SHA256_PATTERN.test(asset.transcript_sha256 ?? '') ||
      !Number.isSafeInteger(asset.size_bytes) ||
      asset.size_bytes < 1
    ) {
      errors.push(`${label} has an invalid or duplicate media identity.`);
      continue;
    }
    assetsByCard.set(asset.card_id, asset);
  }
  if (assetsByCard.size !== 301) {
    errors.push('trusted media audio manifest card identities are incomplete.');
  }

  if (
    worklist.schema_version !== 'audio-perceptual-worklist.v3' ||
    worklist.track !== 'cet4' ||
    !Array.isArray(worklist.entries) ||
    worklist.entries.length !== 301 ||
    worklist.progress?.passed !== 301 ||
    worklist.progress?.failed !== 0 ||
    worklist.progress?.pending !== 0
  ) {
    errors.push('trusted media reviewed worklist is not an exact complete CET4 pass.');
    return false;
  }
  const entriesByCard = new Map();
  for (const [index, entry] of worklist.entries.entries()) {
    const label = `reviewed worklist entries[${index}]`;
    const asset = assetsByCard.get(entry?.card_id);
    if (
      !asset ||
      entriesByCard.has(entry.card_id) ||
      !SHA256_PATTERN.test(entry?.entry_identity_sha256 ?? '') ||
      entry.audio?.asset_path !== asset.asset_path ||
      entry.audio?.file_sha256 !== asset.file_sha256 ||
      entry.audio?.size_bytes !== asset.size_bytes ||
      entry.audio?.transcript_sha256 !== asset.transcript_sha256 ||
      entry.review?.status !== 'passed' ||
      entry.review?.complete_asset_consumed !== true ||
      !Array.isArray(entry.review?.model_acceptances) ||
      entry.review.model_acceptances.length !== 2 ||
      PERCEPTUAL_CHECKS.some(check => entry.checks?.[check] !== 'pass')
    ) {
      errors.push(`${label} does not bind an exact passed media decision.`);
      continue;
    }
    const agents = entry.review.model_acceptances.map(item => item?.actor?.agent).sort();
    const runIds = entry.review.model_acceptances.map(item => item?.actor?.run_id);
    if (
      JSON.stringify(agents) !== JSON.stringify(['agent:trusted-media-af', 'agent:trusted-media-bg']) ||
      new Set(runIds).size !== 2 ||
      entry.review.model_acceptances.some(item =>
        item?.schema_version !== 'model-acceptance.v2' ||
        item?.actor?.model !== receipt.execution.model.id ||
        item?.decision !== 'accepted' ||
        !item?.evidence?.capabilities?.includes('audio_perceptual_review'))
    ) {
      errors.push(`${label} lacks the two independent trusted media acceptances.`);
    }
    entriesByCard.set(entry.card_id, entry);
  }

  if (
    rawManifest.schema_version !== 'trusted-media-raw-run-manifest.v1' ||
    JSON.stringify(rawManifest.model) !== JSON.stringify(receipt.execution.model) ||
    !Array.isArray(rawManifest.runs)
  ) {
    errors.push('trusted media raw run manifest identity is invalid.');
    return false;
  }
  const receiptRuns = new Map(receipt.review_runs.map(run => [run.run_id, run]));
  const mandatoryCoverage = new Map([
    ['full_perceptual', 0],
    ['blind_transcript', 0],
  ]);
  for (const [index, run] of rawManifest.runs.entries()) {
    const label = `raw run manifest runs[${index}]`;
    const receiptRun = receiptRuns.get(run?.run_id);
    if (
      !receiptRun ||
      run.purpose !== receiptRun.purpose ||
      run.sha256 !== receiptRun.raw_output_sha256 ||
      run.card_count !== receiptRun.card_count ||
      run.complete_asset_count !== receiptRun.complete_asset_count ||
      typeof run.path !== 'string' ||
      path.basename(run.path) !== run.path
    ) {
      errors.push(`${label} does not match the attested receipt run identity.`);
      continue;
    }
    const runFile = loadBoundArtifact(
      artifactDirectory,
      run.path,
      {sha256: run.sha256, size_bytes: run.size_bytes},
      `trusted media raw run ${run.run_id}`,
      errors,
    );
    if (!runFile) continue;
    const records = parseJsonLines(runFile.bytes, `trusted media raw run ${run.run_id}`, errors);
    if (records.length !== run.card_count || records.length !== run.complete_asset_count) {
      errors.push(`${label} record counts do not match complete consumption claims.`);
    }
    const seen = new Set();
    for (const [recordIndex, record] of records.entries()) {
      const recordLabel = `${label} records[${recordIndex}]`;
      const entry = entriesByCard.get(record?.card_id);
      if (
        !entry ||
        seen.has(record.card_id) ||
        record.run_id !== run.run_id ||
        record.purpose !== run.purpose ||
        record.entry_identity_sha256 !== entry.entry_identity_sha256 ||
        record.asset_path !== entry.audio.asset_path ||
        record.asset_sha256 !== entry.audio.file_sha256 ||
        record.complete_asset_consumed !== true ||
        record.status !== 'ok'
      ) {
        errors.push(`${recordLabel} does not bind the exact reviewed asset and run.`);
        continue;
      }
      validateAudioCoverage(record.audio_coverage, policy, `${recordLabel}.audio_coverage`, errors);
      if (!Array.isArray(record.raw_outputs) || record.raw_outputs.length < 1) {
        errors.push(`${recordLabel} does not retain a raw model output.`);
      }
      if (!record.result || typeof record.result !== 'object' || Array.isArray(record.result)) {
        errors.push(`${recordLabel} result is not an object.`);
      } else if (['full_perceptual', 'adjudication'].includes(run.purpose)) {
        if (
          typeof record.result.transcript_heard !== 'string' ||
          typeof record.result.notes !== 'string' ||
          [
            'matches_text',
            'target_signal_audible',
            'accurate_pronunciation',
            'suitable_speed',
            'natural_rhythm',
            'stress_pauses_do_not_mislead',
            'no_unwanted_noise_or_clipping',
          ].some(field => typeof record.result[field] !== 'boolean')
        ) {
          errors.push(`${recordLabel} full perceptual result shape is invalid.`);
        }
      } else if (
        run.purpose === 'blind_transcript' &&
        typeof record.result.transcript_heard !== 'string'
      ) {
        errors.push(`${recordLabel} blind transcript result is invalid.`);
      }
      if (
        run.purpose === 'blind_transcript' &&
        (!Number.isFinite(record.transcript_similarity) || record.transcript_similarity < 0.85)
      ) {
        errors.push(`${recordLabel} blind transcript did not pass deterministic similarity.`);
      }
      seen.add(record.card_id);
    }
    if (['full_perceptual', 'blind_transcript'].includes(run.purpose)) {
      if (seen.size !== 301) {
        errors.push(`${label} must cover all 301 exact card assets.`);
      }
      mandatoryCoverage.set(run.purpose, mandatoryCoverage.get(run.purpose) + 1);
    }
  }
  if (receiptRuns.size !== rawManifest.runs.length) {
    errors.push('raw run manifest does not cover every receipt review run exactly once.');
  }
  if (mandatoryCoverage.get('full_perceptual') < policy.receipt.minimum_full_perceptual_runs) {
    errors.push('raw artifacts lack two complete full_perceptual runs.');
  }
  if (mandatoryCoverage.get('blind_transcript') < policy.receipt.minimum_blind_transcript_runs) {
    errors.push('raw artifacts lack two complete blind_transcript runs.');
  }
  return errors.length === 0;
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
  artifactDirectory = null,
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
  let artifactsVerified = false;
  if (receipt && errors.length === 0 && artifactDirectory) {
    artifactsVerified = validateArtifactEvidence(
      receipt,
      policy,
      artifactDirectory,
      errors,
    );
  } else if (verifyAttestation && receipt && !artifactDirectory) {
    errors.push('formal media verification requires --artifact-dir.');
  }
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
    formal_ready: errors.length === 0 && attestationVerified && artifactsVerified,
    attestation_verified: attestationVerified,
    artifacts_verified: artifactsVerified,
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
    } else if (token === '--receipt' || token === '--bundle' || token === '--artifact-dir') {
      const value = argv[index + 1];
      if (!value) throw new Error(`${token} requires a value.`);
      index += 1;
      if (token === '--receipt') result.receiptPath = value;
      if (token === '--bundle') result.bundlePath = value;
      if (token === '--artifact-dir') result.artifactDirectory = value;
    } else {
      throw new Error(`unknown argument: ${token}`);
    }
  }
  if (!result.receiptPath) throw new Error('--receipt is required.');
  if (result.verifyAttestation && !result.bundlePath) {
    throw new Error('--bundle is required with --verify-attestation.');
  }
  if (result.verifyAttestation && !result.artifactDirectory) {
    throw new Error('--artifact-dir is required with --verify-attestation.');
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
