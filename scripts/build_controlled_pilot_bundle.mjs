#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

import {verifyControlledPilotBundleDirectory} from '../infra/cloudbase/controlled-pilot-publisher-v1.mjs';

const LIBRARY_KEYS = new Map([
  ['听力', 'listening'],
  ['仔细阅读', 'careful_reading'],
  ['选词填空', 'cloze'],
  ['写作', 'writing'],
  ['翻译', 'translation'],
  ['词汇', 'vocabulary'],
  ['语法', 'grammar'],
]);
const REQUIRED_AUDIO_QC_CHECKS = Object.freeze([
  'audio_matches_text',
  'target_signal_audible',
  'accurate_pronunciation',
  'suitable_speed',
  'natural_rhythm',
  'stress_and_pauses_do_not_mislead',
  'no_unwanted_noise_or_clipping',
  'no_autoplay_assumption',
  'front_side_no_required_subtitles',
  'tts_audio_not_used_as_source_authenticity',
]);

export class ControlledPilotBundleBuildError extends Error {}

export function normalizeEvidenceTimestamp(value, label) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
    fail(`${label} must be a non-empty ISO-8601 timestamp.`);
  }
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) {
    fail(`${label} must be a valid ISO-8601 timestamp.`);
  }
  return timestamp.toISOString();
}

export function collectAudioQcBindings({assets, cards, qcDirectory}) {
  const records = readQcRecords(qcDirectory);
  const bindings = [];
  const usedRecords = new Map();
  const cardsByAsset = new Map();
  for (const card of cards) {
    if (!card.audio) continue;
    const list = cardsByAsset.get(card.audio.asset_id) ?? [];
    list.push(card.card_id);
    cardsByAsset.set(card.audio.asset_id, list);
  }

  for (const asset of assets) {
    const cardIds = cardsByAsset.get(asset.asset_id) ?? [];
    if (cardIds.length === 0) {
      fail(`Audio asset ${asset.asset_id} is not referenced by a card.`);
    }
    const matches = records.filter(({record}) =>
      cardIds.every(cardId => recordCoversAsset(record, cardId, asset)),
    );
    if (matches.length !== 1) {
      fail(
        `Audio asset ${asset.asset_id} requires exactly one formal human QC record; found ${matches.length}.`,
      );
    }
    const match = matches[0];
    validateQcRecord(match.record, cardIds, asset.asset_id);
    const hash = sha256Bytes(match.bytes);
    const recordPath = `audio/qc/${hash.slice('sha256:'.length)}.json`;
    usedRecords.set(recordPath, match);
    bindings.push({
      asset_id: asset.asset_id,
      card_ids: [...cardIds],
      record_path: recordPath,
      record_sha256: hash,
      reviewed_by: match.record.legacy_adoption.reviewer,
      reviewed_at: normalizeEvidenceTimestamp(
        match.record.legacy_adoption.reviewed_at,
        `audio QC ${asset.asset_id} reviewed_at`,
      ),
      formal_audio_ready: true,
    });
  }
  return {bindings, usedRecords};
}

export function assembleControlledPilotBundle(
  options,
  {verify = verifyControlledPilotBundleDirectory} = {},
) {
  const normalized = normalizeOptions(options);
  const profile = readJson(normalized.profilePath, 'controlled pilot profile');
  const pilotReview = readJson(normalized.pilotReviewPath, 'controlled pilot review');
  const approval = readJson(normalized.approvalPath, 'controlled pilot approval');
  const audit = readJson(normalized.auditPath, 'controlled pilot audit');
  const candidateBytes = readFileSync(normalized.candidatePayloadPath);
  const expectedCandidateHash = pilotReview.source_records?.runtime_payload_sha256;
  if (sha256Bytes(candidateBytes) !== expectedCandidateHash) {
    fail('Candidate payload SHA-256 does not match the approved controlled-pilot review.');
  }
  const candidate = JSON.parse(candidateBytes.toString('utf8'));
  if (
    pilotReview.status !== 'user_approved' ||
    pilotReview.approval?.approved_by_user !== true ||
    pilotReview.content_version !== candidate.content_version ||
    approval.content_version !== candidate.content_version ||
    approval.pilot_id !== profile.pilot_id
  ) {
    fail('Candidate payload, user approval, pilot review, and receiver profile are not bound.');
  }
  const corpusFingerprint = `sha256:${audit.corpus_fingerprint?.digest ?? ''}`;
  if (!/^sha256:[a-f0-9]{64}$/.test(corpusFingerprint)) {
    fail('Controlled-pilot audit does not contain a valid corpus fingerprint.');
  }
  const content = {...candidate, corpus_fingerprint: corpusFingerprint};
  const cards = requireArray(content.card_records, 'candidate card_records');
  const assets = requireArray(content.assets, 'candidate assets');
  const {bindings, usedRecords} = collectAudioQcBindings({
    assets,
    cards,
    qcDirectory: normalized.audioQcDirectory,
  });

  mkdirSync(normalized.outputParent, {recursive: true});
  const staging = mkdtempSync(join(normalized.outputParent, '.controlled-pilot-bundle-'));
  try {
    const contentPath = 'content/cet4-controlled-pilot.json';
    const approvalPath = 'approval/controlled-pilot-approval.json';
    const auditPath = 'audit/controlled-pilot-audit.json';
    const manifestPath = 'audio/manifest.json';
    const qcIndexPath = 'audio/qc-index.json';
    const contentHash = writeJson(join(staging, contentPath), content);
    const approvalHash = copyBoundJson(normalized.approvalPath, join(staging, approvalPath));
    const auditHash = copyBoundJson(normalized.auditPath, join(staging, auditPath));

    const candidateRoot = dirname(normalized.candidatePayloadPath);
    for (const asset of assets) {
      const source = resolveInside(candidateRoot, asset.asset_path, 'candidate audio asset');
      const target = resolveInside(staging, asset.asset_path, 'bundle audio asset');
      mkdirSync(dirname(target), {recursive: true});
      copyFileSync(source, target);
    }
    for (const [recordPath, source] of usedRecords) {
      const target = resolveInside(staging, recordPath, 'bundle audio QC record');
      mkdirSync(dirname(target), {recursive: true});
      writeFileSync(target, source.bytes);
    }

    const manifestHash = writeJson(join(staging, manifestPath), {
      schema_version: 'release-audio-manifest.v1',
      track: 'cet4',
      assets: assets.map(asset => ({
        asset_id: asset.asset_id,
        asset_path: asset.asset_path,
        sha256: asset.sha256,
        size_bytes: asset.size_bytes,
        duration_ms: asset.duration_ms,
      })),
    });
    const qcIndexHash = writeJson(join(staging, qcIndexPath), {
      schema_version: 'audio-qc-index.v1',
      track: 'cet4',
      corpus_fingerprint: corpusFingerprint,
      assets: bindings,
    });

    const cardIds = cards.map(card => card.card_id).sort((a, b) => a.localeCompare(b));
    const bundle = {
      schema_version: 'controlled-pilot-bundle.v1',
      bundle_id: normalized.bundleId,
      profile_id: profile.profile_id,
      pilot_id: profile.pilot_id,
      release_id: normalized.releaseId,
      track: 'cet4',
      runtime_mode: 'controlled_pilot',
      created_at: normalized.createdAt,
      release_at: normalized.releaseAt,
      pilot_expires_at: profile.pilot_expires_at,
      content: buildContentEvidence({content, contentHash, contentPath}),
      approval: {
        record_path: approvalPath,
        record_sha256: approvalHash,
        scope: 'controlled_pilot_120',
        status: 'approved',
        approved_at: normalizeEvidenceTimestamp(approval.approved_at, 'approval approved_at'),
      },
      audit: {
        report_path: auditPath,
        report_sha256: auditHash,
        audit_version: audit.audit_version,
        report_type: audit.report_type,
        scope_card_count: cardIds.length,
        scope_card_ids_sha256: digestJson(cardIds),
        corpus_sha256: corpusFingerprint,
        unresolved_blockers: audit.scope_summary?.by_severity?.hard_blocker ?? -1,
        unexplained_risks:
          (audit.scope_summary?.by_severity?.content_risk ?? 0) +
          (audit.scope_summary?.by_severity?.review_gap ?? 0),
        metadata_coverage: audit.scope?.missing_card_ids?.length === 0 ? 1 : 0,
        explained_risks: [
          {
            rule_id: 'synthetic_source',
            severity: 'source_risk',
            card_count: audit.scope_summary?.by_rule?.synthetic_source,
            disclosure: 'synthetic_training_content_not_true_exam',
          },
        ],
      },
      audio: {
        manifest_path: manifestPath,
        manifest_sha256: manifestHash,
        qc_index_path: qcIndexPath,
        qc_index_sha256: qcIndexHash,
        referenced_asset_count: assets.length,
        qc_asset_count: bindings.length,
      },
      minimum_client_versions: profile.minimum_client_versions,
      gate_eligible: false,
    };
    const bundlePath = join(staging, 'controlled-pilot-bundle.json');
    writeJson(bundlePath, bundle);
    const verified = verify({bundlePath, profilePath: normalized.profilePath});

    if (normalized.apply) {
      if (pathExists(normalized.outputDirectory)) {
        fail(`Output directory already exists: ${normalized.outputDirectory}`);
      }
      renameSync(staging, normalized.outputDirectory);
    }
    return {
      schema_version: 'controlled-pilot-bundle-build-report.v1',
      apply: normalized.apply,
      bundle_directory: normalized.apply ? normalized.outputDirectory : null,
      bundle_id: bundle.bundle_id,
      release_id: bundle.release_id,
      content_version: content.content_version,
      card_count: cards.length,
      audio_asset_count: assets.length,
      qc_record_count: usedRecords.size,
      verified: Boolean(verified),
      gate_eligible: false,
    };
  } finally {
    if (pathExists(staging)) rmSync(staging, {recursive: true, force: true});
  }
}

function buildContentEvidence({content, contentHash, contentPath}) {
  const libraryCardCounts = countBy(content.card_records, card => libraryKey(card));
  const freeLibraryCardCounts = countBy(content.card_records.slice(0, 60), card => libraryKey(card));
  const interactionCardCounts = countBy(content.card_records, card => card.interaction_id);
  const libraryBoxCounts = {};
  for (const library of LIBRARY_KEYS.values()) {
    libraryBoxCounts[library] = new Set(
      content.card_records
        .filter(card => libraryKey(card) === library)
        .map(card => card.knowledge_ref),
    ).size;
  }
  return {
    payload_path: contentPath,
    payload_sha256: contentHash,
    content_version: content.content_version,
    corpus_fingerprint: content.corpus_fingerprint,
    card_count: content.card_records.length,
    free_card_count: 60,
    library_card_counts: libraryCardCounts,
    free_library_card_counts: freeLibraryCardCounts,
    library_box_counts: libraryBoxCounts,
    interaction_card_counts: interactionCardCounts,
    mapped_card_count: content.card_records.length,
    unmapped_card_count: 0,
    duplicate_card_id_count:
      content.card_records.length - new Set(content.card_records.map(card => card.card_id)).size,
  };
}

function validateQcRecord(record, cardIds, assetId) {
  if (record.verdict?.formal_audio_ready !== true) {
    fail(`Audio QC record for ${assetId} is not formally ready.`);
  }
  if (
    typeof record.legacy_adoption?.reviewer !== 'string' ||
    record.legacy_adoption.reviewer.trim().length === 0 ||
    /\b(?:agent|codex|bot|automation)\b/i.test(record.legacy_adoption.reviewer)
  ) {
    fail(`Audio QC record for ${assetId} requires an identified human reviewer.`);
  }
  for (const check of REQUIRED_AUDIO_QC_CHECKS) {
    if (record.qa_checks?.[check] !== true) {
      fail(`Audio QC record for ${assetId} failed ${check}.`);
    }
  }
  const perCard = new Set((record.per_card_qc ?? []).map(item => String(item?.card_id ?? '')));
  if (cardIds.some(cardId => !perCard.has(cardId))) {
    fail(`Audio QC record for ${assetId} does not cover all bound cards.`);
  }
}

function recordCoversAsset(record, cardId, asset) {
  const expectedHash = asset.sha256.replace(/^sha256:/, '');
  return (record.generated_assets ?? []).some(item =>
    String(item?.card_id ?? '') === cardId &&
    item?.file_sha256 === expectedHash,
  );
}

function readQcRecords(directory) {
  if (!pathExists(directory)) fail(`Audio QC directory does not exist: ${directory}`);
  const files = walkJson(directory).filter(path => !/template\.json$/i.test(path));
  return files.map(path => {
    const bytes = readFileSync(path);
    return {bytes, path, record: JSON.parse(bytes.toString('utf8'))};
  });
}

function walkJson(directory) {
  const files = [];
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkJson(path));
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(path);
  }
  return files.sort();
}

function normalizeOptions(options) {
  const requiredPaths = [
    'profilePath',
    'pilotReviewPath',
    'approvalPath',
    'auditPath',
    'candidatePayloadPath',
    'audioQcDirectory',
    'outputDirectory',
  ];
  for (const key of requiredPaths) {
    if (!options?.[key]) fail(`${key} is required.`);
  }
  const outputDirectory = resolve(options.outputDirectory);
  return {
    ...options,
    profilePath: resolve(options.profilePath),
    pilotReviewPath: resolve(options.pilotReviewPath),
    approvalPath: resolve(options.approvalPath),
    auditPath: resolve(options.auditPath),
    candidatePayloadPath: resolve(options.candidatePayloadPath),
    audioQcDirectory: resolve(options.audioQcDirectory),
    outputDirectory,
    outputParent: dirname(outputDirectory),
    bundleId: requireIdentifier(options.bundleId, 'bundleId'),
    releaseId: requireIdentifier(options.releaseId, 'releaseId'),
    createdAt: normalizeEvidenceTimestamp(options.createdAt, 'createdAt'),
    releaseAt: normalizeEvidenceTimestamp(options.releaseAt, 'releaseAt'),
    apply: options.apply === true,
  };
}

function parseArgs(argv) {
  const options = {apply: false};
  const names = new Map([
    ['--profile', 'profilePath'],
    ['--pilot-review', 'pilotReviewPath'],
    ['--approval', 'approvalPath'],
    ['--audit', 'auditPath'],
    ['--candidate-payload', 'candidatePayloadPath'],
    ['--audio-qc-dir', 'audioQcDirectory'],
    ['--output-dir', 'outputDirectory'],
    ['--bundle-id', 'bundleId'],
    ['--release-id', 'releaseId'],
    ['--created-at', 'createdAt'],
    ['--release-at', 'releaseAt'],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--help' || arg === '-h') {
      printUsage();
      return null;
    } else if (names.has(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) fail(`${arg} requires a value.`);
      options[names.get(arg)] = value;
      index += 1;
    } else fail(`Unknown argument: ${arg}`);
  }
  return options;
}

function printUsage() {
  console.log(`Usage: node scripts/build_controlled_pilot_bundle.mjs [options]\n\nRequired: --profile --pilot-review --approval --audit --candidate-payload --audio-qc-dir --output-dir --bundle-id --release-id --created-at --release-at\n\nThe command verifies a complete bundle in temporary storage. It is dry-run by default; pass --apply to keep the verified output directory.`);
}

function libraryKey(card) {
  const key = LIBRARY_KEYS.get(card.space_metadata?.library);
  if (!key) fail(`Unsupported card library: ${card.space_metadata?.library}`);
  return key;
}

function countBy(values, selector) {
  const counts = {};
  for (const value of values) {
    const key = selector(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function requireIdentifier(value, label) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,127}$/.test(value)) {
    fail(`${label} must be a lowercase release identifier.`);
  }
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array.`);
  return value;
}

function copyBoundJson(source, target) {
  const bytes = readFileSync(source);
  JSON.parse(bytes.toString('utf8'));
  mkdirSync(dirname(target), {recursive: true});
  writeFileSync(target, bytes);
  return sha256Bytes(bytes);
}

function writeJson(path, value) {
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return sha256Bytes(readFileSync(path));
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`Cannot read ${label}: ${error.message}`);
  }
}

function resolveInside(root, candidate, label) {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.includes('\\')) {
    fail(`${label} has an invalid path.`);
  }
  const absolute = resolve(root, candidate);
  const fromRoot = relative(resolve(root), absolute);
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) fail(`${label} escapes its root.`);
  return absolute;
}

function digestJson(value) {
  return sha256Bytes(Buffer.from(JSON.stringify(value)));
}

function sha256Bytes(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function pathExists(path) {
  try {
    return statSync(path).isDirectory() || statSync(path).isFile();
  } catch {
    return false;
  }
}

function fail(message) {
  throw new ControlledPilotBundleBuildError(message);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options) console.log(JSON.stringify(assembleControlledPilotBundle(options), null, 2));
  } catch (error) {
    console.error(`Controlled pilot bundle build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
