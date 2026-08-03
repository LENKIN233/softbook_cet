import {createHash} from 'node:crypto';
import {readFileSync, statSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';

import {validateCardSourceCatalogMapping} from './card-source-catalog.mjs';
import {
  validateControlledPilotBundle,
  validateControlledPilotProfile,
  validatePilotContentRelease,
} from './controlled-pilot-v1.mjs';

const require = createRequire(import.meta.url);
const {
  validateCardSourceForImport,
  validateCardSourceForReleaseBundle,
} = require('./functions/softbook-api');

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

export class ControlledPilotPublisherError extends Error {}

export function verifyControlledPilotBundleDirectory({
  bundlePath,
  profilePath,
}) {
  const absoluteBundlePath = resolve(bundlePath);
  const bundleDirectory = dirname(absoluteBundlePath);
  const profile = validateControlledPilotProfile(
    readJson(profilePath, 'controlled pilot profile'),
  );
  const bundle = validateControlledPilotBundle(
    readJson(absoluteBundlePath, 'controlled pilot bundle'),
  );
  assertBundleProfileBinding(bundle, profile);

  const contentPath = resolveBundlePath(
    bundleDirectory,
    bundle.content.payload_path,
  );
  assertFileHash(
    contentPath,
    bundle.content.payload_sha256,
    'controlled pilot content payload',
  );
  const rawContent = readJson(contentPath, 'controlled pilot content payload');
  if (rawContent.corpus_fingerprint !== bundle.content.corpus_fingerprint) {
    fail('content payload corpus fingerprint does not match the bundle.');
  }
  const {corpus_fingerprint: _corpusFingerprint, ...cardSourcePayload} =
    rawContent;
  const content = validateCardSourceCatalogMapping(
    validateCardSourceForReleaseBundle(cardSourcePayload, 'cet4'),
  );
  assertContentEvidence(content, bundle);

  const approval = verifyBoundJson(
    bundleDirectory,
    bundle.approval.record_path,
    bundle.approval.record_sha256,
    'controlled pilot approval record',
  );
  const audit = verifyBoundJson(
    bundleDirectory,
    bundle.audit.report_path,
    bundle.audit.report_sha256,
    'controlled pilot audit report',
  );
  assertApprovalArtifact(approval, bundle, content);
  assertAuditArtifact(audit, bundle, content);
  const audioManifest = verifyBoundJson(
    bundleDirectory,
    bundle.audio.manifest_path,
    bundle.audio.manifest_sha256,
    'controlled pilot audio manifest',
  );
  const audioQcIndex = verifyBoundJson(
    bundleDirectory,
    bundle.audio.qc_index_path,
    bundle.audio.qc_index_sha256,
    'controlled pilot audio QC index',
  );
  verifyContentAssetBytes(content, bundleDirectory);
  assertAudioEvidence(
    content,
    bundle,
    audioManifest,
    audioQcIndex,
    bundleDirectory,
  );

  return {
    schema_version: 'controlled-pilot-verification.v1',
    audio_manifest: audioManifest,
    audio_qc_index: audioQcIndex,
    bundle,
    bundle_directory: bundleDirectory,
    content,
    profile,
    gate_eligible: false,
  };
}

export async function publishVerifiedControlledPilot(
  verified,
  adapter,
  {now = () => new Date()} = {},
) {
  requirePublisherAdapter(adapter);
  const publishTime = now();
  if (
    !(publishTime instanceof Date) ||
    !Number.isFinite(publishTime.getTime()) ||
    publishTime.toISOString() < verified.bundle.release_at ||
    publishTime.toISOString() >= verified.bundle.pilot_expires_at
  ) {
    fail('controlled pilot publication is outside its approved window.');
  }

  const storageByAssetId = new Map();
  for (const asset of verified.content.assets) {
    const absolutePath = resolveBundlePath(
      verified.bundle_directory,
      asset.asset_path,
    );
    const storageFileId = await adapter.uploadAsset({
      absolutePath,
      asset,
      pilotId: verified.bundle.pilot_id,
      releaseId: verified.bundle.release_id,
      track: 'cet4',
    });
    if (!/^cloud:\/\/[^\s?#]+$/.test(storageFileId ?? '')) {
      fail(`uploaded ${asset.asset_id} did not return a private CloudBase file ID.`);
    }
    storageByAssetId.set(asset.asset_id, storageFileId);
  }

  const release = validatePilotContentRelease({
    schema_version: 'pilot-content-release.v1',
    pilot_id: verified.bundle.pilot_id,
    profile_id: verified.bundle.profile_id,
    release_id: verified.bundle.release_id,
    release_class: 'controlled_pilot',
    runtime_mode: 'controlled_pilot',
    track: 'cet4',
    content_version: verified.content.content_version,
    card_count: 120,
    free_card_count: 60,
    activated_at: verified.bundle.release_at,
    expires_at: verified.bundle.pilot_expires_at,
    minimum_client_versions: verified.bundle.minimum_client_versions,
    gate_eligible: false,
  });
  const runtimeCardSource = validateCardSourceCatalogMapping(
    validateCardSourceForImport(
      {
        ...verified.content,
        assets: verified.content.assets.map(asset => ({
          asset_id: asset.asset_id,
          duration_ms: asset.duration_ms,
          media_type: asset.media_type,
          sha256: asset.sha256,
          size_bytes: asset.size_bytes,
          storage_file_id: storageByAssetId.get(asset.asset_id),
        })),
        release,
      },
      'cet4',
    ),
  );
  if (runtimeCardSource.content_version !== verified.content.content_version) {
    fail('hydrated pilot runtime content version changed after asset upload.');
  }

  await adapter.stageContent({
    bundle: verified.bundle,
    cardSource: runtimeCardSource,
  });
  await adapter.verifyStaged({
    bundle: verified.bundle,
    cardSource: runtimeCardSource,
  });
  await adapter.activateRelease({
    bundle: verified.bundle,
    cardSource: runtimeCardSource,
  });
  const active = await adapter.verifyActiveRelease({
    contentVersion: runtimeCardSource.content_version,
    pilotId: verified.bundle.pilot_id,
    releaseId: verified.bundle.release_id,
    track: 'cet4',
  });
  if (
    active?.release?.schema_version !== 'pilot-content-release.v1' ||
    active.release.gate_eligible !== false
  ) {
    fail('active controlled pilot release could not be reverified.');
  }

  return {
    schema_version: 'controlled-pilot-publication-report.v1',
    activated: true,
    content_version: runtimeCardSource.content_version,
    gate_eligible: false,
    pilot_id: verified.bundle.pilot_id,
    release_id: verified.bundle.release_id,
    uploaded_asset_count: storageByAssetId.size,
  };
}

function assertBundleProfileBinding(bundle, profile) {
  if (
    bundle.profile_id !== profile.profile_id ||
    bundle.pilot_id !== profile.pilot_id ||
    bundle.pilot_expires_at !== profile.pilot_expires_at ||
    bundle.minimum_client_versions.ios !==
      profile.minimum_client_versions.ios ||
    bundle.minimum_client_versions.android !==
      profile.minimum_client_versions.android
  ) {
    fail('controlled pilot bundle does not match its receiver profile.');
  }
}

function assertContentEvidence(content, bundle) {
  if (
    content.content_version !== bundle.content.content_version ||
    content.card_records.length !== 120
  ) {
    fail('controlled pilot content identity or card count is invalid.');
  }
  const libraryCounts = countBy(content.card_records, card =>
    libraryKey(card.space_metadata.library),
  );
  const interactionCounts = countBy(
    content.card_records,
    card => card.interaction_id,
  );
  const freeLibraryCounts = countBy(
    content.card_records.slice(0, 60),
    card => libraryKey(card.space_metadata.library),
  );
  for (const [library, expected] of Object.entries(
    bundle.content.library_card_counts,
  )) {
    if (libraryCounts[library] !== expected) {
      fail(`controlled pilot ${library} card count does not match content.`);
    }
    if ((freeLibraryCounts[library] ?? 0) < 1) {
      fail(`controlled pilot free prefix does not cover ${library}.`);
    }
    if (
      freeLibraryCounts[library] !==
      bundle.content.free_library_card_counts[library]
    ) {
      fail(
        `controlled pilot free-prefix ${library} count does not match content.`,
      );
    }
    const boxCount = new Set(
      content.card_records
        .filter(card => libraryKey(card.space_metadata.library) === library)
        .map(card => card.knowledge_ref),
    ).size;
    if (boxCount !== bundle.content.library_box_counts[library]) {
      fail(`controlled pilot ${library} box count does not match content.`);
    }
  }
  for (const [interaction, expected] of Object.entries(
    bundle.content.interaction_card_counts,
  )) {
    if (interactionCounts[interaction] !== expected) {
      fail(
        `controlled pilot ${interaction} interaction count does not match content.`,
      );
    }
  }
}

function assertAudioEvidence(
  content,
  bundle,
  manifest,
  qcIndex,
  bundleDirectory,
) {
  const referencedAssetIds = new Set(
    content.card_records.filter(card => card.audio).map(card => card.audio.asset_id),
  );
  if (
    referencedAssetIds.size !== bundle.audio.referenced_asset_count ||
    content.assets.length !== referencedAssetIds.size
  ) {
    fail('controlled pilot audio references do not match the bundle.');
  }
  assertExactObjectKeys(manifest, ['schema_version', 'track', 'assets'], 'audio manifest');
  if (manifest.schema_version !== 'release-audio-manifest.v1' || manifest.track !== 'cet4') {
    fail('controlled pilot audio manifest schema or track is invalid.');
  }
  const manifestAssets = requireArray(manifest.assets, 'audio manifest assets');
  const manifestIds = new Set();
  const contentByAssetId = new Map(
    content.assets.map(asset => [asset.asset_id, asset]),
  );
  for (const item of manifestAssets) {
    assertExactObjectKeys(
      item,
      ['asset_id', 'asset_path', 'sha256', 'size_bytes', 'duration_ms'],
      'audio manifest asset',
    );
    const contentAsset = contentByAssetId.get(item.asset_id);
    if (
      !contentAsset ||
      manifestIds.has(item.asset_id) ||
      item.asset_path !== contentAsset.asset_path ||
      item.sha256 !== contentAsset.sha256 ||
      item.size_bytes !== contentAsset.size_bytes ||
      item.duration_ms !== contentAsset.duration_ms
    ) {
      fail('controlled pilot audio manifest does not match content assets.');
    }
    manifestIds.add(item.asset_id);
  }
  assertExactObjectKeys(
    qcIndex,
    ['schema_version', 'track', 'corpus_fingerprint', 'assets'],
    'audio QC index',
  );
  if (
    qcIndex.schema_version !== 'audio-qc-index.v1' ||
    qcIndex.track !== 'cet4' ||
    qcIndex.corpus_fingerprint !== bundle.content.corpus_fingerprint
  ) {
    fail('controlled pilot audio QC index binding is invalid.');
  }
  const qcItems = requireArray(qcIndex.assets, 'audio QC assets');
  const qcIds = new Set();
  for (const item of qcItems) {
    assertExactObjectKeys(
      item,
      [
        'asset_id',
        'card_ids',
        'record_path',
        'record_sha256',
        'reviewed_by',
        'reviewed_at',
        'formal_audio_ready',
      ],
      'audio QC item',
    );
    if (
      qcIds.has(item.asset_id) ||
      !manifestIds.has(item.asset_id) ||
      item.formal_audio_ready !== true ||
      typeof item.reviewed_by !== 'string' ||
      item.reviewed_by.trim().length === 0 ||
      !isCanonicalIsoTimestamp(item.reviewed_at) ||
      !Array.isArray(item.card_ids) ||
      item.card_ids.length === 0
    ) {
      fail('controlled pilot audio QC item is invalid.');
    }
    const recordPath = resolveBundlePath(bundleDirectory, item.record_path);
    assertFileHash(
      recordPath,
      item.record_sha256,
      `audio QC record ${item.asset_id}`,
    );
    const record = readJson(recordPath, `audio QC record ${item.asset_id}`);
    if (record.verdict?.formal_audio_ready !== true) {
      fail(`audio QC record ${item.asset_id} is not ready.`);
    }
    for (const check of REQUIRED_AUDIO_QC_CHECKS) {
      if (record.qa_checks?.[check] !== true) {
        fail(`audio QC record ${item.asset_id} failed ${check}.`);
      }
    }
    const coveredCards = new Set(
      requireArray(record.per_card_qc, 'audio QC per-card records').map(
        value => value?.card_id,
      ),
    );
    if (item.card_ids.some(cardId => !coveredCards.has(cardId))) {
      fail(`audio QC record ${item.asset_id} misses a bound card.`);
    }
    qcIds.add(item.asset_id);
  }
  if (
    manifestIds.size !== referencedAssetIds.size ||
    qcIds.size !== bundle.audio.qc_asset_count ||
    [...referencedAssetIds].some(
      assetId => !manifestIds.has(assetId) || !qcIds.has(assetId),
    )
  ) {
    fail('controlled pilot audio manifest or QC coverage is incomplete.');
  }
}

function assertApprovalArtifact(approval, bundle, content) {
  assertExactObjectKeys(
    approval,
    [
      'schema_version',
      'pilot_id',
      'content_version',
      'scope',
      'status',
      'approved_by_user',
      'approved_at',
      'card_ids',
    ],
    'controlled pilot approval',
  );
  if (
    approval.schema_version !== 'controlled-pilot-approval.v1' ||
    approval.pilot_id !== bundle.pilot_id ||
    approval.content_version !== content.content_version ||
    approval.scope !== 'controlled_pilot_120' ||
    approval.status !== 'approved' ||
    approval.approved_by_user !== true ||
    !isCanonicalIsoTimestamp(approval.approved_at) ||
    !sameSet(
      approval.card_ids,
      content.card_records.map(card => card.card_id),
    )
  ) {
    fail('controlled pilot approval artifact is invalid or unbound.');
  }
}

function assertAuditArtifact(audit, bundle, content) {
  assertExactObjectKeys(
    audit,
    [
      'schema_version',
      'pilot_id',
      'content_version',
      'card_count',
      'unresolved_blockers',
      'unexplained_risks',
      'metadata_coverage',
    ],
    'controlled pilot audit',
  );
  if (
    audit.schema_version !== 'controlled-pilot-audit.v1' ||
    audit.pilot_id !== bundle.pilot_id ||
    audit.content_version !== content.content_version ||
    audit.card_count !== 120 ||
    audit.unresolved_blockers !== 0 ||
    audit.unexplained_risks !== 0 ||
    audit.metadata_coverage !== 1
  ) {
    fail('controlled pilot audit artifact is invalid or unbound.');
  }
}

function verifyContentAssetBytes(content, bundleDirectory) {
  for (const asset of content.assets) {
    const path = resolveBundlePath(bundleDirectory, asset.asset_path);
    assertFileHash(path, asset.sha256, `audio asset ${asset.asset_id}`);
    if (statSync(path).size !== asset.size_bytes) {
      fail(`audio asset ${asset.asset_id} size does not match content.`);
    }
  }
}

function countBy(values, selector) {
  const counts = {};
  for (const value of values) {
    const key = selector(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function assertExactObjectKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail(`${label} fields are invalid.`);
  }
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array.`);
  return value;
}

function sameSet(left, right) {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every(value => right.includes(value))
  );
}

function isCanonicalIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function libraryKey(value) {
  const key = LIBRARY_KEYS.get(value);
  if (!key) fail(`unsupported controlled pilot library: ${value}`);
  return key;
}

function verifyBoundJson(bundleDirectory, relativePath, hash, label) {
  const path = resolveBundlePath(bundleDirectory, relativePath);
  assertFileHash(path, hash, label);
  return readJson(path, label);
}

function requirePublisherAdapter(adapter) {
  for (const method of [
    'uploadAsset',
    'stageContent',
    'verifyStaged',
    'activateRelease',
    'verifyActiveRelease',
  ]) {
    if (typeof adapter?.[method] !== 'function') {
      fail(`controlled pilot publisher adapter requires ${method}().`);
    }
  }
}

function resolveBundlePath(bundleDirectory, candidate) {
  if (
    typeof candidate !== 'string' ||
    candidate.length === 0 ||
    isAbsolute(candidate) ||
    candidate.includes('\\')
  ) {
    fail('controlled pilot bundle path is invalid.');
  }
  const absolutePath = resolve(bundleDirectory, candidate);
  const fromBundle = relative(bundleDirectory, absolutePath);
  if (
    fromBundle === '..' ||
    fromBundle.startsWith(`..${sep}`) ||
    isAbsolute(fromBundle)
  ) {
    fail(`controlled pilot bundle path escapes its directory: ${candidate}`);
  }
  return absolutePath;
}

function assertFileHash(path, expected, label) {
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch (error) {
    fail(`${label} cannot be read: ${error.message}`);
  }
  const actual = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  if (actual !== expected) fail(`${label} SHA-256 does not match.`);
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
  } catch (error) {
    fail(`${label} is not valid readable JSON: ${error.message}`);
  }
}

function fail(message) {
  throw new ControlledPilotPublisherError(message);
}
