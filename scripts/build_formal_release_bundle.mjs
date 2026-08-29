#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
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
import {basename, dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  validateDeliveryProfile,
  verifyReleaseBundleDirectory,
} from '../infra/cloudbase/release-delivery-v1.mjs';
import {
  collectAudioQcBindings,
  normalizeEvidenceTimestamp,
} from './build_controlled_pilot_bundle.mjs';
import {
  buildModelAcceptanceInputSha256,
  requireIndependentModelAcceptances,
} from './lib/model_acceptance_contract.mjs';
import {parseStrictJson} from './lib/strict_json.mjs';
import {REQUIRED_DEPLOYMENT_NODE_VERSION} from '../infra/cloudbase/deployment-safety.mjs';

const CET4_CARD_COUNT = 1180;
const CET4_BOX_COUNT = 108;
const CET4_AUDIO_COUNT = 301;
const CONTENT_PATH = 'content/cet4.json';
const AUTHORIZATION_PATH = 'approval/cet4-full-track-authorization.json';
const MODEL_REVIEW_PATH = 'approval/cet4-full-track-model-review.json';
const AUDIO_MANIFEST_PATH = 'audio/manifest.json';
const AUDIO_QC_INDEX_PATH = 'audio/qc-index.json';
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const OPERATOR_PATTERN = /^(model|agent|service|oidc):[A-Za-z0-9_.-]+$/;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export class FormalReleaseBundleBuildError extends Error {}

export function assembleFormalReleaseBundle(
  options,
  {
    clock = () => new Date(),
    nodeVersion = process.versions.node,
    repository = readRepositoryState(),
    verify = verifyReleaseBundleDirectory,
  } = {},
) {
  const startedAt = readTimestamp(clock, 'builder start');
  const normalized = normalizeOptions(options);
  const writeSafety = inspectBuildSafety({nodeVersion, repository});
  if (normalized.apply && !writeSafety.ok) {
    fail(writeSafety.errors.join('; '));
  }
  const profileBytes = readFileSync(normalized.profilePath);
  const profile = validateDeliveryProfile(
    parseJsonBytes(profileBytes, 'delivery profile'),
  );
  const contentPayloadBytes = readFileSync(normalized.contentPayloadPath);
  const rawContent = parseJsonBytes(contentPayloadBytes, 'CET4 content payload');
  const authorization = readJson(
    normalized.authorizationPath,
    'full-track model authorization',
  );
  const modelReviewBytes = readFileSync(normalized.modelReviewPath);
  const modelReview = parseJsonBytes(modelReviewBytes, 'full-track model review');
  const auditBytes = readFileSync(normalized.auditPath);
  const audit = parseJsonBytes(auditBytes, 'quality audit');
  const auditCorpusFingerprint = `sha256:${audit.corpus_fingerprint?.digest ?? ''}`;
  if (!SHA256_PATTERN.test(auditCorpusFingerprint)) {
    fail('Quality audit must contain a valid corpus fingerprint.');
  }
  if (
    rawContent.corpus_fingerprint !== undefined &&
    rawContent.corpus_fingerprint !== auditCorpusFingerprint
  ) {
    fail('Content payload corpus fingerprint does not match the quality audit.');
  }
  const content = {
    ...rawContent,
    corpus_fingerprint: auditCorpusFingerprint,
  };
  validateInputs({
    authorization,
    audit,
    auditBytes,
    content,
    contentHash: sha256Bytes(contentPayloadBytes),
    modelReview,
    modelReviewBytes,
    profile,
  });
  const cards = content.card_records;
  const assets = content.assets;
  const {bindings, sourcePathsByAssetId, usedRecords} = collectAudioQcBindings({
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
    const contentHash = writeJson(join(staging, CONTENT_PATH), content);
    const authorizationHash = copyBoundJson(
      normalized.authorizationPath,
      join(staging, AUTHORIZATION_PATH),
    );
    const authorizedRuntimePayloadPath = requireSafeRelativeJsonPath(
      authorization.validation?.runtime_payload,
      'authorization runtime payload path',
    );
    if ([CONTENT_PATH, AUTHORIZATION_PATH, MODEL_REVIEW_PATH].includes(
      authorizedRuntimePayloadPath,
    )) {
      fail('Authorization runtime payload path collides with a reserved bundle artifact.');
    }
    const authorizedRuntimePayloadHash = copyBoundJson(
      normalized.contentPayloadPath,
      resolveInside(
        staging,
        authorizedRuntimePayloadPath,
        'authorized runtime payload',
      ),
    );
    if (
      normalizeSha256(authorization.validation.runtime_payload_sha256) !==
      authorizedRuntimePayloadHash
    ) {
      fail('Copied authorization runtime payload does not match its declared hash.');
    }
    const modelReviewHash = copyBoundJson(
      normalized.modelReviewPath,
      join(staging, MODEL_REVIEW_PATH),
    );
    const auditPath = requireSafeRelativeJsonPath(
      authorization.card_quality_audit.report,
      'authorization audit report path',
    );
    const auditHash = copyBoundJson(
      normalized.auditPath,
      resolveInside(staging, auditPath, 'bundle audit report'),
    );

    for (const asset of assets) {
      const source = resolveInside(
        normalized.assetRoot,
        sourcePathsByAssetId.get(asset.asset_id),
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
    const bySeverity = authorization.card_quality_audit.scope_summary.by_severity;
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
        record_path: AUTHORIZATION_PATH,
        record_sha256: authorizationHash,
        approval_id: authorization.authorization_id,
        model_review_path: MODEL_REVIEW_PATH,
        model_review_sha256: modelReviewHash,
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
      schema_version: 'formal-release-bundle-build-report.v2',
      apply: normalized.apply,
      bundle_directory: normalized.apply
        ? basename(normalized.outputDirectory)
        : null,
      repository_commit: repository.head,
      profile_id: profile.profile_id,
      profile_sha256: sha256Bytes(profileBytes),
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
      authorization_id: authorization.authorization_id,
      authorization_sha256: authorizationHash,
      model_review_sha256: modelReviewHash,
      audit_sha256: auditHash,
      audio_manifest_sha256: manifestHash,
      audio_qc_index_sha256: qcIndexHash,
      verified: true,
      execution: {
        started_at: startedAt,
        completed_at: readTimestamp(clock, 'builder completion'),
        operator: normalized.operator,
      },
      write_safety: writeSafety,
      cloudbase_writes_performed: false,
      gate_eligible: false,
    };
  } finally {
    if (pathExists(staging)) rmSync(staging, {recursive: true, force: true});
  }
}

function validateInputs({
  authorization,
  audit,
  auditBytes,
  content,
  contentHash,
  modelReview,
  modelReviewBytes,
  profile,
}) {
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
    authorization.schema_version !== 'model-owned-content-authorization.v2' ||
    authorization.authorization_mode !== 'full_track' ||
    authorization.content_version !== content.content_version ||
    authorization.scope?.track !== 'cet4' ||
    authorization.scope?.purpose !== 'formal_content' ||
    !sameSet(authorization.scope?.card_ids, cardIds) ||
    !sameSet(authorization.scope?.box_prefixes, boxIds) ||
    authorization.card_quality_audit?.corpus_fingerprint !==
      content.corpus_fingerprint.slice('sha256:'.length) ||
    authorization.card_quality_audit?.scope_has_no_hard_blockers !== true
  ) {
    fail('Full-track model authorization is not bound to the exact CET4 content payload.');
  }
  const summary = authorization.card_quality_audit?.scope_summary;
  if (
    summary?.card_count !== CET4_CARD_COUNT ||
    !sameSet(summary?.card_ids, cardIds) ||
    summary?.by_severity?.hard_blocker !== 0 ||
    summary?.by_severity?.content_risk !== 0 ||
    summary?.by_severity?.review_gap !== 0
  ) {
    fail('Full-track model authorization audit summary is not publisher-ready.');
  }
  const auditHash = sha256Bytes(auditBytes);
  const modelReviewHash = sha256Bytes(modelReviewBytes);
  if (
    authorization.card_quality_audit?.report_sha256 !== auditHash ||
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
  if (
    modelReview.schema_version !== 'model-owned-full-track-review.v2' ||
    modelReview.scope?.track !== 'cet4' ||
    !sameSet(modelReview.scope?.card_ids, cardIds) ||
    !sameSet(modelReview.scope?.box_prefixes, boxIds) ||
    modelReview.quality_audit?.report_sha256 !== auditHash ||
    normalizeSha256(modelReview.quality_audit?.corpus_fingerprint) !==
      content.corpus_fingerprint ||
    modelReview.quality_audit?.scope_has_no_hard_blockers !== true ||
    modelReview.batch_review?.status !== 'ready_for_model_authorization' ||
    authorization.validation?.model_review_sha256 !== modelReviewHash ||
    typeof authorization.validation?.model_review !== 'string' ||
    !authorization.validation.model_review.trim()
  ) {
    fail('Full-track model review is not bound to authorization and audit bytes.');
  }
  const linkedReviewPath = requireSafeRelativeJsonPath(
    authorization.validation.model_review,
    'authorization linked model review path',
  );
  const expectedReviewInput = buildModelAcceptanceInputSha256({
    decisionType: 'full_track_review',
    scope: modelReview.scope,
    corpusFingerprint: content.corpus_fingerprint,
    auditSha256: auditHash,
  });
  const expectedAuthorizationInput = buildModelAcceptanceInputSha256({
    decisionType: 'full_track_content_authorization',
    scope: authorization.scope,
    corpusFingerprint: content.corpus_fingerprint,
    auditSha256: auditHash,
    linkedReviewIdentity: {
      path: linkedReviewPath,
      sha256: modelReviewHash,
    },
    additionalBindings: {
      content_version: content.content_version,
      runtime_payload_sha256: authorization.validation.runtime_payload_sha256,
    },
  });
  if (
    normalizeSha256(authorization.validation.runtime_payload_sha256) !==
    normalizeSha256(contentHash)
  ) {
    fail('Full-track authorization runtime payload hash does not match content bytes.');
  }
  try {
    requireIndependentModelAcceptances(modelReview.model_acceptances, {
      expectedInputSha256: expectedReviewInput,
      label: 'full-track model review',
      requiredCapabilities: [
        'card_semantic_review',
        'source_provenance_review',
      ],
    });
    requireIndependentModelAcceptances(authorization.model_acceptances, {
      expectedInputSha256: expectedAuthorizationInput,
      label: 'full-track model authorization',
      requiredCapabilities: ['content_authorization'],
    });
  } catch (error) {
    fail(error.message);
  }
  normalizeEvidenceTimestamp(
    authorization.authorized_at,
    'authorization authorized_at',
  );
}

function normalizeOptions(options) {
  for (const key of [
    'profilePath',
    'contentPayloadPath',
    'authorizationPath',
    'modelReviewPath',
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
  const operator = options.operator ?? null;
  if (options.apply === true && !OPERATOR_PATTERN.test(operator ?? '')) {
    fail('apply requires an identified model, agent, service, or OIDC operator.');
  }
  if (operator !== null && !OPERATOR_PATTERN.test(operator)) {
    fail('operator must identify a model, agent, service, or OIDC operator.');
  }
  return {
    ...options,
    profilePath: resolve(options.profilePath),
    contentPayloadPath: resolve(options.contentPayloadPath),
    authorizationPath: resolve(options.authorizationPath),
    modelReviewPath: resolve(options.modelReviewPath),
    auditPath: resolve(options.auditPath),
    audioQcDirectory: resolve(options.audioQcDirectory),
    assetRoot: resolve(options.assetRoot ?? dirname(options.contentPayloadPath)),
    outputDirectory,
    outputParent: dirname(outputDirectory),
    bundleId: requireIdentifier(options.bundleId, 'bundleId'),
    releaseId,
    parentReleaseId,
    operator,
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
    ['--authorization', 'authorizationPath'],
    ['--model-review', 'modelReviewPath'],
    ['--audit', 'auditPath'],
    ['--audio-qc-dir', 'audioQcDirectory'],
    ['--asset-root', 'assetRoot'],
    ['--output-dir', 'outputDirectory'],
    ['--bundle-id', 'bundleId'],
    ['--release-id', 'releaseId'],
    ['--parent-release-id', 'parentReleaseId'],
    ['--operator', 'operator'],
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

function inspectBuildSafety({nodeVersion, repository}) {
  const errors = [];
  if (nodeVersion !== REQUIRED_DEPLOYMENT_NODE_VERSION) {
    errors.push(
      `Node must be ${REQUIRED_DEPLOYMENT_NODE_VERSION}; received ${nodeVersion}`,
    );
  }
  if (repository?.branch !== 'main') errors.push('apply requires branch main');
  if (repository?.dirty !== false) errors.push('apply requires a clean worktree');
  if (repository?.head !== repository?.originMain) {
    errors.push('apply requires HEAD exactly equal to origin/main');
  }
  return {
    errors,
    ok: errors.length === 0,
    branch: repository?.branch ?? null,
    dirty: repository?.dirty ?? null,
    head: repository?.head ?? null,
    origin_main: repository?.originMain ?? null,
    node_version: nodeVersion,
  };
}

function readRepositoryState() {
  const git = args => {
    try {
      return execFileSync('git', args, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      return null;
    }
  };
  const status = git(['status', '--porcelain=v1', '--untracked-files=all']);
  return {
    branch: git(['branch', '--show-current']),
    dirty: status === null ? null : status !== '',
    head: git(['rev-parse', 'HEAD']),
    originMain: git(['rev-parse', 'origin/main']),
  };
}

function readTimestamp(clock, label) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) fail(`${label} clock is invalid.`);
  return date.toISOString();
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

function normalizeSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
    ? `sha256:${value}`
    : value;
}

function printUsage() {
  console.log(`Usage:
  node scripts/build_formal_release_bundle.mjs --profile <delivery-profile.json> --content-payload <cet4.json> --authorization <full-track-authorization.json> --model-review <full-track-model-review.json> --audit <quality-audit.json> --audio-qc-dir <dir> --output-dir <dir> --bundle-id <id> --release-id <id> [--parent-release-id <id>] --created-at <ISO> --release-at <ISO> [--asset-root <dir>] [--apply --operator <id>]

The builder is dry-run by default: it assembles and fully verifies a temporary formal bundle, then removes it. --apply keeps the verified output directory. It never creates authorization, QC, deployment or launch evidence.`);
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
