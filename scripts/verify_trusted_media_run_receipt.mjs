#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {parseStrictJson} from './lib/strict_json.mjs';
import {validateModelAcceptance} from './lib/model_acceptance_contract.mjs';

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

function loadBoundMedia(directory, filename, identity, label, errors) {
  const root = path.resolve(directory ?? '');
  const target = path.resolve(root, String(filename ?? ''));
  if (!target.startsWith(`${root}${path.sep}`)) {
    errors.push(`${label} path escapes the artifact directory.`);
    return null;
  }
  const bytes = loadRegularFile(target, 64 * 1024 * 1024, label, errors);
  if (!bytes) return null;
  const observed = createHash('sha256').update(bytes).digest('hex');
  if (observed !== identity?.sha256 || bytes.length !== identity?.size_bytes) {
    errors.push(`${label} bytes do not match the attested media identity.`);
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

function canonicalStringify(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function decisionInputSha256(entry) {
  const payload = {
    schema_version: 'audio-perceptual-decision-input.v1',
    entry_identity_sha256: entry.entry_identity_sha256,
    complete_asset_consumed: true,
    checks: Object.fromEntries(
      PERCEPTUAL_CHECKS.map(check => [check, entry.checks?.[check] ?? null]),
    ),
  };
  return `sha256:${createHash('sha256')
    .update(canonicalStringify(payload))
    .digest('hex')}`;
}

function recomputedEntryIdentitySha256(entry) {
  const identity = {
    card_id: entry.card_id,
    card_source_file: entry.card_source_file,
    knowledge_ref: entry.knowledge_ref,
    training_context: entry.training_context,
    audio: {
      asset_path: entry.audio?.asset_path,
      file_sha256: entry.audio?.file_sha256,
      size_bytes: entry.audio?.size_bytes,
      declared_duration_ms: entry.audio?.declared_duration_ms,
      probed_duration_ms: entry.audio?.probed_duration_ms,
      transcript: entry.audio?.transcript,
      transcript_sha256: entry.audio?.transcript_sha256,
    },
  };
  return createHash('sha256').update(canonicalStringify(identity)).digest('hex');
}

function isSafeRelativeMediaPath(value) {
  return (
    typeof value === 'string' &&
    value.startsWith('ai_tts/cet4/') &&
    value.endsWith('.mp3') &&
    !value.includes('\\') &&
    !/[\u0000-\u001f\u007f\u2028\u2029]/u.test(value) &&
    !value.split('/').some(segment => segment === '' || segment === '.' || segment === '..') &&
    path.posix.normalize(value) === value
  );
}

function validateCompleteWorklistEntry(entry, index, errors) {
  const label = `reviewed worklist entries[${index}]`;
  let valid = exactKeys(
    entry,
    [
      'sequence',
      'card_id',
      'card_source_file',
      'knowledge_ref',
      'training_context',
      'audio',
      'entry_identity_sha256',
      'checks',
      'review',
    ],
    label,
    errors,
  );
  valid = exactKeys(
    entry?.knowledge_ref,
    ['library_id', 'library_name', 'group_id', 'group_name', 'box_id', 'box_name', 'box_prefix'],
    `${label}.knowledge_ref`,
    errors,
  ) && valid;
  valid = exactKeys(
    entry?.training_context,
    ['main_training_goal', 'box_progression_role'],
    `${label}.training_context`,
    errors,
  ) && valid;
  valid = exactKeys(
    entry?.audio,
    [
      'asset_path',
      'file_sha256',
      'size_bytes',
      'declared_duration_ms',
      'probed_duration_ms',
      'transcript',
      'transcript_sha256',
    ],
    `${label}.audio`,
    errors,
  ) && valid;
  if (
    entry?.sequence !== index + 1 ||
    !/^[0-9]{6}$/.test(entry?.card_id ?? '') ||
    typeof entry?.card_source_file !== 'string' ||
    !entry.card_source_file.startsWith('card_boxes_json/') ||
    !entry.card_source_file.endsWith('.json') ||
    entry.card_source_file.includes('\\') ||
    entry.card_source_file.split('/').some(segment => segment === '' || segment === '.' || segment === '..') ||
    !Object.values(entry?.knowledge_ref ?? {}).every(value =>
      typeof value === 'string' && value.trim().length > 0) ||
    !Object.values(entry?.training_context ?? {}).every(value =>
      typeof value === 'string' && value.trim().length > 0) ||
    !isSafeRelativeMediaPath(entry?.audio?.asset_path) ||
    !Number.isSafeInteger(entry?.audio?.size_bytes) ||
    entry.audio.size_bytes < 1 ||
    !Number.isSafeInteger(entry?.audio?.declared_duration_ms) ||
    entry.audio.declared_duration_ms < 1 ||
    !Number.isSafeInteger(entry?.audio?.probed_duration_ms) ||
    entry.audio.probed_duration_ms < 1 ||
    normalizedWords(entry?.audio?.transcript).length === 0
  ) {
    errors.push(`${label} has an incomplete or invalid bound identity.`);
    valid = false;
  }
  return valid;
}

function normalizedWords(value) {
  return String(value ?? '').toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function sequenceMatcherRatio(left, right) {
  const a = normalizedWords(left);
  const b = normalizedWords(right);
  if (a.length === 0 || b.length === 0) return 0;
  const b2j = new Map();
  for (const [index, token] of b.entries()) {
    if (!b2j.has(token)) b2j.set(token, []);
    b2j.get(token).push(index);
  }
  const queue = [[0, a.length, 0, b.length]];
  let matches = 0;
  while (queue.length > 0) {
    const [alo, ahi, blo, bhi] = queue.pop();
    let bestI = alo;
    let bestJ = blo;
    let bestSize = 0;
    let previous = new Map();
    for (let i = alo; i < ahi; i += 1) {
      const current = new Map();
      for (const j of b2j.get(a[i]) ?? []) {
        if (j < blo) continue;
        if (j >= bhi) break;
        const size = (previous.get(j - 1) ?? 0) + 1;
        current.set(j, size);
        if (size > bestSize) {
          bestI = i - size + 1;
          bestJ = j - size + 1;
          bestSize = size;
        }
      }
      previous = current;
    }
    if (bestSize === 0) continue;
    matches += bestSize;
    if (alo < bestI && blo < bestJ) queue.push([alo, bestI, blo, bestJ]);
    const afterI = bestI + bestSize;
    const afterJ = bestJ + bestSize;
    if (afterI < ahi && afterJ < bhi) queue.push([afterI, ahi, afterJ, bhi]);
  }
  return (2 * matches) / (a.length + b.length);
}

export function validateAudioCoverage(value, policy, label, errors, durationMs) {
  if (!exactKeys(
    value,
    [
      'decoder',
      'decoded_sample_count',
      'model_input_sample_count',
      'model_max_sample_count',
      'model_feature_frame_count',
      'model_audio_token_count',
      'sample_rate_hz',
      'truncated',
    ],
    label,
    errors,
  )) return;
  const expected = policy.receipt.required_audio_coverage;
  const decodedDurationMs =
    Number.isSafeInteger(value?.decoded_sample_count) &&
    Number.isSafeInteger(value?.sample_rate_hz) &&
    value.sample_rate_hz > 0
      ? (value.decoded_sample_count * 1000) / value.sample_rate_hz
      : NaN;
  if (
    value.decoder !== expected.decoder ||
    !Number.isSafeInteger(value.decoded_sample_count) ||
    value.decoded_sample_count < 1 ||
    value.model_input_sample_count !== value.decoded_sample_count ||
    value.model_max_sample_count !== expected.model_max_sample_count ||
    value.model_feature_frame_count !== expected.model_feature_frame_count ||
    value.model_audio_token_count !== expected.model_audio_token_count ||
    value.decoded_sample_count > value.model_max_sample_count ||
    value.sample_rate_hz !== expected.sample_rate_hz ||
    value.truncated !== expected.truncated ||
    !Number.isSafeInteger(durationMs) ||
    Math.abs(decodedDurationMs - durationMs) > 50
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

function validateArtifactEvidence(
  receipt,
  policy,
  artifactDirectory,
  audioRoot,
  errors,
) {
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
  const runPackageFile = loadBoundArtifact(
    artifactDirectory,
    filenames.run_package,
    receipt.artifacts.run_package,
    'trusted media run package',
    errors,
  );
  const modelWeightsManifestFile = loadBoundArtifact(
    artifactDirectory,
    filenames.model_weights_manifest,
    receipt.artifacts.model_weights_manifest,
    'trusted media model weights manifest',
    errors,
  );
  const mlxAudioPackageManifestFile = loadBoundArtifact(
    artifactDirectory,
    filenames.mlx_audio_package_manifest,
    receipt.artifacts.mlx_audio_package_manifest,
    'trusted media mlx_audio package manifest',
    errors,
  );
  const pythonEnvironmentManifestFile = loadBoundArtifact(
    artifactDirectory,
    filenames.python_environment_manifest,
    receipt.artifacts.python_environment_manifest,
    'trusted media Python environment manifest',
    errors,
  );
  const audioManifest = parseArtifactJson(audioManifestFile, 'trusted media audio manifest', errors);
  const worklist = parseArtifactJson(worklistFile, 'trusted media reviewed worklist', errors);
  const rawManifest = parseArtifactJson(rawManifestFile, 'trusted media raw run manifest', errors);
  const runPackage = parseArtifactJson(runPackageFile, 'trusted media run package', errors);
  const modelWeightsManifest = parseArtifactJson(
    modelWeightsManifestFile,
    'trusted media model weights manifest',
    errors,
  );
  const mlxAudioPackageManifest = parseArtifactJson(
    mlxAudioPackageManifestFile,
    'trusted media mlx_audio package manifest',
    errors,
  );
  const pythonEnvironmentManifest = parseArtifactJson(
    pythonEnvironmentManifestFile,
    'trusted media Python environment manifest',
    errors,
  );
  if (
    !audioManifest ||
    !worklist ||
    !rawManifest ||
    !runPackage ||
    !modelWeightsManifest ||
    !mlxAudioPackageManifest ||
    !pythonEnvironmentManifest
  ) {
    return false;
  }
  let rawReplay;
  try {
    rawReplay = parseStrictJson(
      Buffer.from(execFileSync(
        'python3',
        [
          '-B',
          path.join(ROOT, 'scripts/replay_trusted_media_raw_outputs.py'),
          '--artifact-dir',
          path.resolve(artifactDirectory),
          '--run-package',
          filenames.run_package,
          '--worklist',
          filenames.review_worklist,
        ],
        {cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']},
      )),
      'trusted media retained raw-output replay',
    );
  } catch {
    errors.push('trusted media retained raw model outputs do not replay packaged results.');
    return false;
  }
  if (rawReplay?.ok !== true || !Number.isSafeInteger(rawReplay.records)) {
    errors.push('trusted media retained raw-output replay returned an invalid result.');
    return false;
  }
  const modelManifestFiles = validateRuntimeManifestFiles(
    modelWeightsManifest.files,
    'model weights',
    errors,
  );
  const modelManifestDigest = modelManifestFiles
    ? createHash('sha256')
      .update(canonicalStringify(modelManifestFiles))
      .digest('hex')
    : null;
  if (
    modelWeightsManifest.sha256 !== receipt.execution.model.weights_manifest_sha256 ||
    modelManifestDigest !== modelWeightsManifest.sha256
  ) {
    errors.push('trusted media model weights manifest does not match the receipt model identity.');
  }
  for (const [label, manifest, expected] of [
    [
      'mlx_audio package',
      mlxAudioPackageManifest,
      receipt.execution.harness.mlx_audio_package_manifest_sha256,
    ],
    [
      'Python environment',
      pythonEnvironmentManifest,
      receipt.execution.harness.python_environment_manifest_sha256,
    ],
  ]) {
    const files = validateRuntimeManifestFiles(manifest.files, label, errors);
    const digest = files
      ? createHash('sha256').update(canonicalStringify(files)).digest('hex')
      : null;
    if (
      !files ||
      manifest.sha256 !== expected ||
      digest !== manifest.sha256
    ) {
      errors.push(`trusted media ${label} manifest does not match execution.harness.`);
    }
  }

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
  const assetPaths = new Set();
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
      !isSafeRelativeMediaPath(asset.asset_path) ||
      assetPaths.has(asset.asset_path) ||
      !SHA256_PATTERN.test(asset.file_sha256 ?? '') ||
      !SHA256_PATTERN.test(asset.transcript_sha256 ?? '') ||
      !Number.isSafeInteger(asset.size_bytes) ||
      asset.size_bytes < 1
    ) {
      errors.push(`${label} has an invalid or duplicate media identity.`);
      continue;
    }
    assetPaths.add(asset.asset_path);
    loadBoundMedia(
      audioRoot,
      asset.asset_path,
      {sha256: asset.file_sha256, size_bytes: asset.size_bytes},
      `${label} media`,
      errors,
    );
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
    const completeIdentity = validateCompleteWorklistEntry(entry, index, errors);
    const asset = assetsByCard.get(entry?.card_id);
    if (
      !completeIdentity ||
      !asset ||
      entriesByCard.has(entry.card_id) ||
      !SHA256_PATTERN.test(entry?.entry_identity_sha256 ?? '') ||
      entry.entry_identity_sha256 !== recomputedEntryIdentitySha256(entry) ||
      entry.audio?.asset_path !== asset.asset_path ||
      entry.audio?.file_sha256 !== asset.file_sha256 ||
      entry.audio?.size_bytes !== asset.size_bytes ||
      entry.audio?.transcript_sha256 !== asset.transcript_sha256 ||
      typeof entry.audio?.transcript !== 'string' ||
      !entry.audio.transcript.trim() ||
      createHash('sha256').update(entry.audio.transcript).digest('hex') !==
        entry.audio.transcript_sha256 ||
      entry.review?.status !== 'passed' ||
      entry.review?.complete_asset_consumed !== true ||
      !Array.isArray(entry.review?.model_acceptances) ||
      entry.review.model_acceptances.length !== 2 ||
      PERCEPTUAL_CHECKS.some(check => entry.checks?.[check] !== 'pass')
    ) {
      errors.push(`${label} does not bind an exact passed media decision.`);
      continue;
    }
    const runIds = entry.review.model_acceptances.map(item => item?.actor?.run_id);
    if (
      new Set(runIds).size !== 2 ||
      entry.review.model_acceptances.some(item =>
        item?.schema_version !== 'model-acceptance.v2' ||
        item?.actor?.kind !== 'model_harness' ||
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
  if (
    runPackage.schema_version !== 'trusted-media-model-run-package.v1' ||
    JSON.stringify(runPackage.model) !== JSON.stringify(receipt.execution.model) ||
    runPackage.execution?.workflow_run_id !== receipt.execution.workflow_run_id ||
    runPackage.execution?.workflow_run_attempt !== receipt.execution.workflow_run_attempt ||
    runPackage.execution?.runner_class !== receipt.execution.runner_class ||
    !Array.isArray(runPackage.runs) ||
    JSON.stringify(runPackage.runs) !== JSON.stringify(rawManifest.runs) ||
    runPackage.result?.reviewed_card_count !== 301 ||
    runPackage.result?.passed_card_count !== 301 ||
    runPackage.result?.failed_card_count !== 0
  ) {
    errors.push('trusted media run package does not match the receipt and raw run manifest.');
  }
  const receiptRuns = new Map(receipt.review_runs.map(run => [run.run_id, run]));
  const rawRunIds = new Set();
  const rawRunNames = new Set();
  const rawRunPaths = new Set();
  const rawRunHashes = new Set();
  const rawRunsByName = new Map();
  const mandatoryCoverage = new Map([
    ['full_perceptual', 0],
    ['blind_transcript', 0],
  ]);
  for (const [index, run] of rawManifest.runs.entries()) {
    const label = `raw run manifest runs[${index}]`;
    if (
      rawRunIds.has(run?.run_id) ||
      rawRunNames.has(run?.name) ||
      rawRunPaths.has(run?.path) ||
      rawRunHashes.has(run?.sha256)
    ) {
      errors.push(`${label} duplicates a run ID, name, path, or SHA-256.`);
      continue;
    }
    rawRunIds.add(run.run_id);
    rawRunNames.add(run.name);
    rawRunPaths.add(run.path);
    rawRunHashes.add(run.sha256);
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
      validateAudioCoverage(
        record.audio_coverage,
        policy,
        `${recordLabel}.audio_coverage`,
        errors,
        entry.audio.probed_duration_ms,
      );
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
        (
          !Number.isFinite(record.transcript_similarity) ||
          record.transcript_similarity !== Number(
            sequenceMatcherRatio(
              entry.audio.transcript,
              record.result?.transcript_heard,
            ).toFixed(6),
          ) ||
          record.transcript_similarity < 0.85
        )
      ) {
        errors.push(`${recordLabel} blind transcript did not pass deterministic similarity.`);
      }
      seen.add(record.card_id);
    }
    rawRunsByName.set(run.name, {
      ...run,
      records: new Map(records.map(record => [record.card_id, record])),
    });
    if (['full_perceptual', 'blind_transcript'].includes(run.purpose)) {
      if (
        seen.size !== 301 ||
        [...entriesByCard.keys()].some(cardId => !seen.has(cardId))
      ) {
        errors.push(`${label} must cover all 301 exact card assets.`);
      }
      mandatoryCoverage.set(run.purpose, mandatoryCoverage.get(run.purpose) + 1);
    }
  }
  if (
    receiptRuns.size !== rawManifest.runs.length ||
    [...receiptRuns.keys()].some(runId => !rawRunIds.has(runId))
  ) {
    errors.push('raw run manifest does not cover every receipt review run exactly once.');
  }
  if (mandatoryCoverage.get('full_perceptual') < policy.receipt.minimum_full_perceptual_runs) {
    errors.push('raw artifacts lack two complete full_perceptual runs.');
  }
  if (mandatoryCoverage.get('blind_transcript') < policy.receipt.minimum_blind_transcript_runs) {
    errors.push('raw artifacts lack two complete blind_transcript runs.');
  }
  validateRunDecisions({
    entriesByCard,
    receipt,
    rawRunsByName,
    runPackage,
    errors,
  });
  return errors.length === 0;
}

function validateRunDecisions({
  entriesByCard,
  errors,
  rawRunsByName,
  receipt,
  runPackage,
}) {
  if (!Array.isArray(runPackage.decisions) || runPackage.decisions.length !== 301) {
    errors.push('trusted media run package does not contain exactly 301 decisions.');
    return;
  }
  const decisions = new Map();
  for (const [index, decision] of runPackage.decisions.entries()) {
    const label = `run package decisions[${index}]`;
    if (
      !exactKeys(decision, ['card_id', 'checks', 'acceptance_sources'], label, errors) ||
      decisions.has(decision?.card_id) ||
      !entriesByCard.has(decision?.card_id) ||
      !exactKeys(decision.checks, PERCEPTUAL_CHECKS, `${label}.checks`, errors) ||
      PERCEPTUAL_CHECKS.some(check => decision.checks?.[check] !== true) ||
      !Array.isArray(decision.acceptance_sources) ||
      decision.acceptance_sources.length !== 2
    ) {
      errors.push(`${label} is not an exact passed two-lane decision.`);
      continue;
    }
    decisions.set(decision.card_id, decision);
  }
  for (const [cardId, entry] of entriesByCard) {
    const decision = decisions.get(cardId);
    if (!decision) {
      errors.push(`run package omits decision for ${cardId}.`);
      continue;
    }
    const laneIdentities = [];
    for (const [lane, group] of decision.acceptance_sources.entries()) {
      const label = `decision ${cardId} lane ${lane + 1}`;
      if (
        !Array.isArray(group) ||
        group.length < 2 ||
        group.length > 3 ||
        new Set(group).size !== group.length
      ) {
        errors.push(`${label} has an invalid bounded source group.`);
        continue;
      }
      const runs = group.map(name => rawRunsByName.get(name));
      if (runs.some(run => !run || !run.records.has(cardId))) {
        errors.push(`${label} references a missing exact-card raw run.`);
        continue;
      }
      const general = runs.filter(run =>
        ['full_perceptual', 'adjudication'].includes(run.purpose));
      const blind = runs.filter(run => run.purpose === 'blind_transcript');
      const pronunciation = runs.filter(run => run.purpose === 'pronunciation');
      if (general.length !== 1 || blind.length !== 1 || pronunciation.length > 1) {
        errors.push(`${label} must contain one general, one blind, and at most one pronunciation run.`);
        continue;
      }
      const generalResult = general[0].records.get(cardId).result;
      const blindRecord = blind[0].records.get(cardId);
      const pronunciationRecord = pronunciation[0]?.records.get(cardId) ?? null;
      const expectedChecks = {
        audio_matches_text: blindRecord.transcript_similarity >= 0.85,
        target_signal_audible: generalResult?.target_signal_audible === true,
        accurate_pronunciation: pronunciationRecord
          ? pronunciationRecord.result?.accurate_pronunciation === true
          : generalResult?.accurate_pronunciation === true,
        suitable_speed: generalResult?.suitable_speed === true,
        natural_rhythm: generalResult?.natural_rhythm === true,
        stress_and_pauses_do_not_mislead:
          generalResult?.stress_pauses_do_not_mislead === true,
        no_unwanted_noise_or_clipping:
          generalResult?.no_unwanted_noise_or_clipping === true,
      };
      if (PERCEPTUAL_CHECKS.some(check =>
        decision.checks[check] !== expectedChecks[check])) {
        errors.push(`${label} decision checks do not replay raw model results.`);
      }
      laneIdentities.push({
        agent: `agent:trusted-media-${group.join('')}`,
        blindName: blind[0].name,
        generalName: general[0].name,
        pronunciationName: pronunciation[0]?.name ?? null,
        runId: `${receipt.execution.workflow_run_id}:${cardId}:${group.join('')}`,
      });
      const acceptance = entry.review.model_acceptances[lane];
      const acceptanceErrors = validateModelAcceptance(acceptance, {
        expectedInputSha256: decisionInputSha256(entry),
        requiredCapabilities: ['audio_perceptual_review'],
      });
      if (
        acceptanceErrors.length > 0 ||
        acceptance?.actor?.agent !== laneIdentities.at(-1).agent ||
        acceptance?.actor?.model !== receipt.execution.model.id ||
        acceptance?.actor?.run_id !== laneIdentities.at(-1).runId
      ) {
        errors.push(`${label} model acceptance is not bound to the replayed media decision.`);
      }
    }
    if (
      laneIdentities.length === 2 &&
      (
        laneIdentities[0].generalName === laneIdentities[1].generalName ||
        laneIdentities[0].blindName === laneIdentities[1].blindName ||
        (
          laneIdentities[0].pronunciationName !== null &&
          laneIdentities[0].pronunciationName === laneIdentities[1].pronunciationName
        )
      )
    ) {
      errors.push(`decision ${cardId} reuses a general, blind, or pronunciation run across lanes.`);
    }
  }
}

function validateRuntimeManifestFiles(value, label, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`trusted media ${label} manifest must identify at least one file.`);
    return null;
  }
  const paths = new Set();
  for (const [index, entry] of value.entries()) {
    const entryLabel = `trusted media ${label} manifest files[${index}]`;
    if (!exactKeys(entry, ['path', 'sha256', 'size_bytes'], entryLabel, errors)) {
      continue;
    }
    if (
      typeof entry.path !== 'string' ||
      !entry.path ||
      entry.path.startsWith('/') ||
      entry.path.includes('\\') ||
      entry.path.split('/').includes('..') ||
      paths.has(entry.path) ||
      !/^[a-f0-9]{64}$/.test(entry.sha256 ?? '') ||
      !Number.isSafeInteger(entry.size_bytes) ||
      entry.size_bytes < 0
    ) {
      errors.push(`${entryLabel} has an invalid or duplicate file identity.`);
    }
    paths.add(entry.path);
  }
  return paths.size === value.length ? value : null;
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
      [
        'driver_bundle_sha256',
        'dependency_lock_sha256',
        'mlx_audio_package_manifest_sha256',
        'python_environment_manifest_sha256',
      ],
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
      nonPlaceholderSha(
        execution.harness.mlx_audio_package_manifest_sha256,
        'receipt.execution.harness.mlx_audio_package_manifest_sha256',
        errors,
      );
      nonPlaceholderSha(
        execution.harness.python_environment_manifest_sha256,
        'receipt.execution.harness.python_environment_manifest_sha256',
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
    [
      'audio_manifest',
      'review_worklist',
      'raw_run_manifest',
      'run_package',
      'model_weights_manifest',
      'mlx_audio_package_manifest',
      'python_environment_manifest',
    ],
    'receipt.artifacts',
    errors,
  )) {
    for (const field of [
      'audio_manifest',
      'review_worklist',
      'raw_run_manifest',
      'run_package',
      'model_weights_manifest',
      'mlx_audio_package_manifest',
      'python_environment_manifest',
    ]) {
      validateArtifactIdentity(artifacts[field], `receipt.artifacts.${field}`, errors);
    }
  }

  if (!Array.isArray(receipt.review_runs) || receipt.review_runs.length < 2) {
    errors.push('receipt.review_runs must contain at least two runs.');
  } else {
    const runIds = new Set();
    const rawOutputHashes = new Set();
    let fullRunCount = 0;
    let blindRunCount = 0;
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
      if (run.purpose === 'blind_transcript') {
        blindRunCount += 1;
        if (run.card_count !== 301) {
          errors.push(`${label} blind_transcript run must cover all 301 assets.`);
        }
      }
    }
    if (fullRunCount < policy.receipt.minimum_full_perceptual_runs) {
      errors.push('receipt does not contain two complete full_perceptual runs.');
    }
    if (blindRunCount < policy.receipt.minimum_blind_transcript_runs) {
      errors.push('receipt does not contain two complete blind_transcript runs.');
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
  audioRoot = null,
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
      audioRoot ?? artifactDirectory,
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
        '--deny-self-hosted-runners',
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
  const result = {verifyAttestation: false, audioRoot: null};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--verify-attestation') {
      result.verifyAttestation = true;
    } else if (
      token === '--receipt' ||
      token === '--bundle' ||
      token === '--artifact-dir' ||
      token === '--audio-root'
    ) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${token} requires a value.`);
      index += 1;
      if (token === '--receipt') result.receiptPath = value;
      if (token === '--bundle') result.bundlePath = value;
      if (token === '--artifact-dir') result.artifactDirectory = value;
      if (token === '--audio-root') result.audioRoot = value;
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
