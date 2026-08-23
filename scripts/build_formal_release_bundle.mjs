#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  validateDeliveryProfile,
  verifyReleaseBundleDirectory,
} from '../infra/cloudbase/release-delivery-v1.mjs';
import {
  collectAudioQcBindings,
  normalizeEvidenceTimestamp,
} from './build_controlled_pilot_bundle.mjs';
import {parseStrictJson} from './lib/strict_json.mjs';

const CET4_CARD_COUNT = 1180;
const CET4_BOX_COUNT = 108;
const CET4_AUDIO_COUNT = 301;
const CONTENT_PATH = 'content/cet4.json';
const APPROVAL_PATH = 'approval/cet4-full-track-final.json';
const AUDIO_MANIFEST_PATH = 'audio/manifest.json';
const AUDIO_QC_INDEX_PATH = 'audio/qc-index.json';
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

export class FormalReleaseBundleBuildError extends Error {}

export function assembleFormalReleaseBundle(
  options,
  {verify = verifyReleaseBundleDirectory} = {},
) {
  const normalized = normalizeOptions(options);
  const profile = validateDeliveryProfile(
    readJson(normalized.profilePath, 'delivery profile'),
  );
  const content = readJson(normalized.contentPayloadPath, 'CET4 content payload');
  const approval = readJson(normalized.approvalPath, 'full-track approval');
  const auditBytes = readFileSync(normalized.auditPath);
  const audit = parseJsonBytes(auditBytes, 'quality audit');
  validateInputs({approval, audit, auditBytes, content, profile});
  const cards = content.card_records;
  const assets = content.assets;
  const {bindings, usedRecords} = collectAudioQcBindings({
    assets,
    cards,
    qcDirectory: normalized.audioQcDirectory,
  });
  if (bindings.length !== CET4_AUDIO_COUNT) {
    fail(`Formal audio QC must cover exactly ${CET4_AUDIO_COUNT} assets.`);
  }

  if (normalized.apply) mkdirSync(normalized.outputParent, {recursive: true});
  const stagingParent = normalized.apply ? normalized.outputParent : tmpdir();
  const staging = mkdtempSync(join(stagingParent, '.formal-release-bundle-'));
  try {
    const contentHash = copyBoundJson(
      normalized.contentPayloadPath,
      join(staging, CONTENT_PATH),
    );
    const approvalHash = copyBoundJson(
      normalized.approvalPath,
      join(staging, APPROVAL_PATH),
    );
    const auditPath = requireSafeRelativeJsonPath(
      approval.card_quality_audit.report,
      'approval audit report path',
    );
    const auditHash = copyBoundJson(
      normalized.auditPath,
      resolveInside(staging, auditPath, 'bundle audit report'),
    );

    for (const asset of assets) {
      const source = resolveInside(
        normalized.assetRoot,
        asset.asset_path,
        `source audio ${asset.asset_id}`,
      );
      const target = resolveInside(
        staging,
        asset.asset_path,
        `bundle audio ${asset.asset_id}`,
      );
      mkdirSync(dirname(target), {recursive: true});
      copyFileSync(source, target);
    }
    for (const [recordPath, source] of usedRecords) {
      const target = resolveInside(staging, recordPath, 'bundle audio QC record');
      mkdirSync(dirname(target), {recursive: true});
      writeFileSync(target, source.bytes);
    }

    const manifestHash = writeJson(join(staging, AUDIO_MANIFEST_PATH), {
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
    const qcIndexHash = writeJson(join(staging, AUDIO_QC_INDEX_PATH), {
      schema_version: 'audio-qc-index.v1',
      track: 'cet4',
      corpus_fingerprint: content.corpus_fingerprint,
      assets: bindings,
    });
    const bySeverity = approval.card_quality_audit.scope_summary.by_severity;
    const bundle = {
      schema_version: 'release-bundle.v1',
      bundle_id: normalized.bundleId,
      release_id: normalized.releaseId,
      track: 'cet4',
      created_at: normalized.createdAt,
      release_at: normalized.releaseAt,
      parent_release_id: normalized.parentReleaseId,
      content: {
        payload_path: CONTENT_PATH,
        payload_sha256: contentHash,
        content_version: content.content_version,
        corpus_fingerprint: content.corpus_fingerprint,
        card_count: cards.length,
      },
      approval: {
        record_path: APPROVAL_PATH,
        record_sha256: approvalHash,
        approval_id: approval.approval_id,
      },
      audit: {
        report_path: auditPath,
        report_sha256: auditHash,
        unresolved_blocker_count: bySeverity.hard_blocker,
        unexplained_risk_count:
          bySeverity.content_risk + bySeverity.review_gap,
        quality_metadata_coverage_percent: 100,
      },
      audio: {
        manifest_path: AUDIO_MANIFEST_PATH,
        manifest_sha256: manifestHash,
        qc_index_path: AUDIO_QC_INDEX_PATH,
        qc_index_sha256: qcIndexHash,
        asset_count: assets.length,
        qc_passed_count: bindings.length,
      },
      minimum_client_versions: profile.minimum_client_versions,
    };
    const bundlePath = join(staging, 'release-bundle.json');
    const bundleHash = writeJson(bundlePath, bundle);
    const verified = verify({
      bundlePath,
      profilePath: normalized.profilePath,
    });
    if (!verified) fail('Core formal release bundle verification returned no result.');

    if (normalized.apply) {
      if (pathExists(normalized.outputDirectory)) {
        fail(`Output directory already exists: ${normalized.outputDirectory}`);
      }
      renameSync(staging, normalized.outputDirectory);
    }
    return {
      schema_version: 'formal-release-bundle-build-report.v1',
      apply: normalized.apply,
      bundle_directory: normalized.apply ? normalized.outputDirectory : null,
      bundle_id: bundle.bundle_id,
      bundle_sha256: bundleHash,
      release_id: bundle.release_id,
      parent_release_id: bundle.parent_release_id,
      content_version: content.content_version,
      card_count: cards.length,
      box_count: uniqueBoxes(cards).length,
      audio_asset_count: assets.length,
      audio_qc_entry_count: bindings.length,
      unique_qc_record_count: usedRecords.size,
      approval_id: approval.approval_id,
      verified: true,
      cloudbase_writes_performed: false,
      gate_eligible: false,
    };
  } finally {
    if (pathExists(staging)) rmSync(staging, {recursive: true, force: true});
  }
}

function validateInputs({approval, audit, auditBytes, content, profile}) {
  if (
    profile.schema_version !== 'delivery-profile.v1' ||
    profile.runtime_mode !== 'closed_beta' ||
    JSON.stringify(profile.enabled_tracks) !== JSON.stringify(['cet4'])
  ) {
    fail('Formal CET4 builder requires a closed_beta CET4-only delivery profile.');
  }
  if (
    content.track !== 'cet4' ||
    !Array.isArray(content.card_records) ||
    content.card_records.length !== CET4_CARD_COUNT ||
    !Array.isArray(content.assets) ||
    content.assets.length !== CET4_AUDIO_COUNT ||
    !SHA256_PATTERN.test(content.content_version ?? '') ||
    !SHA256_PATTERN.test(content.corpus_fingerprint ?? '')
  ) {
    fail('Content payload must be exact formal CET4 1180/301 scope with hashes.');
  }
  const cardIds = content.card_records.map(card => String(card.card_id));
  const boxIds = uniqueBoxes(content.card_records);
  if (
    new Set(cardIds).size !== CET4_CARD_COUNT ||
    boxIds.length !== CET4_BOX_COUNT ||
    content.card_records.filter(card => card.audio).length !== CET4_AUDIO_COUNT
  ) {
    fail('Content payload card, box, or audio-reference scope is invalid.');
  }
  const assetIds = content.assets.map(asset => String(asset.asset_id));
  if (
    new Set(assetIds).size !== CET4_AUDIO_COUNT ||
    content.assets.some(
      asset =>
        !SHA256_PATTERN.test(asset.sha256 ?? '') ||
        !Number.isSafeInteger(asset.size_bytes) ||
        asset.size_bytes <= 0 ||
        !Number.isSafeInteger(asset.duration_ms) ||
        asset.duration_ms <= 0,
    )
  ) {
    fail('Content audio asset identity is invalid.');
  }
  if (
    approval.approval_mode !== 'full_track_final' ||
    approval.approved_by_user !== true ||
    approval.scope?.track !== 'cet4' ||
    !sameSet(approval.scope?.card_ids, cardIds) ||
    !sameSet(approval.scope?.box_prefixes, boxIds) ||
    approval.card_quality_audit?.corpus_fingerprint !==
      content.corpus_fingerprint.slice('sha256:'.length) ||
    approval.card_quality_audit?.scope_has_no_hard_blockers !== true
  ) {
    fail('Full-track approval is not bound to the exact CET4 content payload.');
  }
  const summary = approval.card_quality_audit?.scope_summary;
  if (
    summary?.card_count !== CET4_CARD_COUNT ||
    !sameSet(summary?.card_ids, cardIds) ||
    summary?.by_severity?.hard_blocker !== 0 ||
    summary?.by_severity?.content_risk !== 0 ||
    summary?.by_severity?.review_gap !== 0
  ) {
    fail('Full-track approval audit summary is not publisher-ready.');
  }
  const auditHash = sha256Bytes(auditBytes);
  if (
    approval.card_quality_audit?.report_sha256 !== auditHash ||
    audit.corpus_fingerprint?.digest !==
      content.corpus_fingerprint.slice('sha256:'.length) ||
    audit.scope_summary?.card_count !== CET4_CARD_COUNT ||
    !sameSet(audit.scope_summary?.card_ids, cardIds) ||
    audit.scope_summary?.by_severity?.hard_blocker !== 0 ||
    audit.scope_summary?.by_severity?.content_risk !== 0 ||
    audit.scope_summary?.by_severity?.review_gap !== 0 ||
    !Array.isArray(audit.scope?.missing_card_ids) ||
    audit.scope.missing_card_ids.length !== 0
  ) {
    fail('Quality audit bytes and complete zero-blocker scope are not bound.');
  }
  normalizeEvidenceTimestamp(approval.approved_at, 'approval approved_at');
}

function normalizeOptions(options) {
  for (const key of [
    'profilePath',
    'contentPayloadPath',
    'approvalPath',
    'auditPath',
    'audioQcDirectory',
    'outputDirectory',
  ]) {
    if (!options?.[key]) fail(`${key} is required.`);
  }
  const outputDirectory = resolve(options.outputDirectory);
  const parentReleaseId =
    options.parentReleaseId === null || options.parentReleaseId === undefined
      ? null
      : requireIdentifier(options.parentReleaseId, 'parentReleaseId');
  const releaseId = requireIdentifier(options.releaseId, 'releaseId');
  if (parentReleaseId === releaseId) {
    fail('parentReleaseId must differ from releaseId.');
  }
  return {
    ...options,
    profilePath: resolve(options.profilePath),
    contentPayloadPath: resolve(options.contentPayloadPath),
    approvalPath: resolve(options.approvalPath),
    auditPath: resolve(options.auditPath),
    audioQcDirectory: resolve(options.audioQcDirectory),
    assetRoot: resolve(options.assetRoot ?? dirname(options.contentPayloadPath)),
    outputDirectory,
    outputParent: dirname(outputDirectory),
    bundleId: requireIdentifier(options.bundleId, 'bundleId'),
    releaseId,
    parentReleaseId,
    createdAt: normalizeEvidenceTimestamp(options.createdAt, 'createdAt'),
    releaseAt: normalizeEvidenceTimestamp(options.releaseAt, 'releaseAt'),
    apply: options.apply === true,
  };
}

export function parseFormalReleaseBundleArguments(argv) {
  const options = {apply: false, parentReleaseId: null};
  const names = new Map([
    ['--profile', 'profilePath'],
    ['--content-payload', 'contentPayloadPath'],
    ['--approval', 'approvalPath'],
    ['--audit', 'auditPath'],
    ['--audio-qc-dir', 'audioQcDirectory'],
    ['--asset-root', 'assetRoot'],
    ['--output-dir', 'outputDirectory'],
    ['--bundle-id', 'bundleId'],
    ['--release-id', 'releaseId'],
    ['--parent-release-id', 'parentReleaseId'],
    ['--created-at', 'createdAt'],
    ['--release-at', 'releaseAt'],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--apply') options.apply = true;
    else if (argument === '--help' || argument === '-h') return {help: true};
    else if (names.has(argument)) {
      const value = argv[++index];
      if (!value || value.startsWith('--')) fail(`${argument} requires a value.`);
      options[names.get(argument)] = value;
    } else fail(`Unknown argument: ${argument}`);
  }
  return options;
}

function uniqueBoxes(cards) {
  return [...new Set(cards.map(card => String(card.knowledge_ref)))].sort();
}

function sameSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return (
    sortedLeft.length === sortedRight.length &&
    new Set(sortedLeft).size === sortedLeft.length &&
    new Set(sortedRight).size === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index])
  );
}

function requireSafeRelativeJsonPath(value, label) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.includes('\\') ||
    value.startsWith('/') ||
    value.split('/').includes('..') ||
    !value.endsWith('.json')
  ) {
    fail(`${label} must be a safe relative JSON path.`);
  }
  return value;
}

function resolveInside(root, candidate, label) {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.includes('\\')) {
    fail(`${label} has an invalid path.`);
  }
  const absolute = resolve(root, candidate);
  const fromRoot = relative(resolve(root), absolute);
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) {
    fail(`${label} escapes its root.`);
  }
  return absolute;
}

function requireIdentifier(value, label) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,127}$/.test(value)) {
    fail(`${label} must be a lowercase release identifier.`);
  }
  return value;
}

function copyBoundJson(source, target) {
  const bytes = readFileSync(source);
  parseJsonBytes(bytes, source);
  mkdirSync(dirname(target), {recursive: true});
  writeFileSync(target, bytes);
  return sha256Bytes(bytes);
}

function writeJson(file, value) {
  mkdirSync(dirname(file), {recursive: true});
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return sha256Bytes(readFileSync(file));
}

function readJson(file, label) {
  try {
    return parseStrictJson(readFileSync(file), label);
  } catch (error) {
    fail(`Cannot read ${label}: ${error.message}`);
  }
}

function parseJsonBytes(bytes, label) {
  try {
    return parseStrictJson(bytes, label);
  } catch (error) {
    fail(`Cannot read ${label}: ${error.message}`);
  }
}

function sha256Bytes(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function pathExists(file) {
  try {
    return statSync(file).isDirectory() || statSync(file).isFile();
  } catch {
    return false;
  }
}

function fail(message) {
  throw new FormalReleaseBundleBuildError(message);
}

function printUsage() {
  console.log(`Usage:
  node scripts/build_formal_release_bundle.mjs --profile <delivery-profile.json> --content-payload <cet4.json> --approval <full-track-final.json> --audit <quality-audit.json> --audio-qc-dir <dir> --output-dir <dir> --bundle-id <id> --release-id <id> [--parent-release-id <id>] --created-at <ISO> --release-at <ISO> [--asset-root <dir>] [--apply]

The builder is dry-run by default: it assembles and fully verifies a temporary formal bundle, then removes it. --apply keeps the verified output directory. It never creates approval, QC, deployment or launch evidence.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseFormalReleaseBundleArguments(process.argv.slice(2));
    if (options.help) printUsage();
    else console.log(JSON.stringify(assembleFormalReleaseBundle(options), null, 2));
  } catch (error) {
    console.error(`Formal release bundle build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
