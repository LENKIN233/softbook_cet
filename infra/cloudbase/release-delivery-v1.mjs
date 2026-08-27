import {createHash} from 'node:crypto';
import {readFileSync, statSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {
  buildModelAcceptanceInputSha256,
  requireIndependentModelAcceptances,
} from '../../scripts/lib/model_acceptance_contract.mjs';
import {validateCardSourceCatalogMapping} from './card-source-catalog.mjs';

const require = createRequire(import.meta.url);
const {
  validateCardSourceForImport,
  validateCardSourceForReleaseBundle,
} = require('./functions/softbook-api');

export const DELIVERY_PROFILE_SCHEMA = 'delivery-profile.v1';
export const RELEASE_BUNDLE_SCHEMA = 'release-bundle.v1';
export const RELEASE_AUDIO_MANIFEST_SCHEMA = 'release-audio-manifest.v1';
export const AUDIO_QC_INDEX_SCHEMA = 'audio-qc-index.v1';
export const CONTENT_RELEASE_SCHEMA = 'content-release.v1';
export const MODEL_CONTENT_AUTHORIZATION_SCHEMA = 'model-owned-content-authorization.v2';
export const MODEL_AUDIO_QC_SCHEMA = 'model-owned-audio-qc.v2';
export const CET4_BETA_CARD_COUNT = 1180;
export const CET4_BETA_BOX_COUNT = 108;
export const CET4_BETA_AUDIO_COUNT = 301;
export const CET6_PRODUCT_CARD_COUNT = 1234;
export const CET6_PRODUCT_BOX_COUNT = 110;
export const CET6_PRODUCT_AUDIO_COUNT = 328;
export const FORMAL_TRACK_POLICIES = Object.freeze({
  cet4: Object.freeze({
    card_count: CET4_BETA_CARD_COUNT,
    box_count: CET4_BETA_BOX_COUNT,
    audio_count: CET4_BETA_AUDIO_COUNT,
  }),
  cet6: Object.freeze({
    card_count: CET6_PRODUCT_CARD_COUNT,
    box_count: CET6_PRODUCT_BOX_COUNT,
    audio_count: CET6_PRODUCT_AUDIO_COUNT,
  }),
});
export const PERSONAL_DEVELOPMENT_ENVIRONMENT = 'test-d2gzcyxr9f7e80972';

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const RELEASE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const SECRET_KEY_PATTERN =
  /(?:secret|private[_-]?key|password|credential|access[_-]?token|refresh[_-]?token|sms[_-]?code|api[_-]?key)/i;
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

export class ReleaseDeliveryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReleaseDeliveryError';
  }
}

export function validateDeliveryProfile(value) {
  const profile = requireRecord(value, 'delivery profile');
  assertExactKeys(
    profile,
    [
      'schema_version',
      'profile_id',
      'environment_id',
      'region',
      'api_base_url',
      'runtime_mode',
      'enabled_tracks',
      'minimum_client_versions',
      'signing_key_id',
    ],
    'delivery profile',
  );
  assertNoSecretFields(profile, 'delivery profile');
  requireExact(
    profile.schema_version,
    DELIVERY_PROFILE_SCHEMA,
    'schema_version',
  );
  const profileId = requirePattern(
    profile.profile_id,
    RELEASE_ID_PATTERN,
    'profile_id',
  );
  const environmentId = requireString(profile.environment_id, 'environment_id');

  if (environmentId === PERSONAL_DEVELOPMENT_ENVIRONMENT) {
    throw new ReleaseDeliveryError(
      'delivery profile must target a receiver-owned environment, not the personal development environment.',
    );
  }

  const region = requirePattern(
    profile.region,
    /^[a-z]+-[a-z]+(?:-\d+)?$/,
    'region',
  );
  const apiBaseUrl = requireHttpsOrigin(profile.api_base_url, 'api_base_url');
  const runtimeMode = requireOneOf(
    profile.runtime_mode,
    ['closed_beta', 'production'],
    'runtime_mode',
  );
  const enabledTracks = requireStringArray(
    profile.enabled_tracks,
    'enabled_tracks',
  );

  const requiredTracks =
    runtimeMode === 'closed_beta' ? ['cet4'] : ['cet4', 'cet6'];
  if (JSON.stringify(enabledTracks) !== JSON.stringify(requiredTracks)) {
    throw new ReleaseDeliveryError(
      `enabled_tracks must be exactly ${JSON.stringify(
        requiredTracks,
      )} for ${runtimeMode}.`,
    );
  }

  const minimumClientVersions = validateMinimumClientVersions(
    profile.minimum_client_versions,
    'minimum_client_versions',
  );
  const signingKeyId = requirePattern(
    profile.signing_key_id,
    RELEASE_ID_PATTERN,
    'signing_key_id',
  );

  return {
    schema_version: DELIVERY_PROFILE_SCHEMA,
    profile_id: profileId,
    environment_id: environmentId,
    region,
    api_base_url: apiBaseUrl,
    runtime_mode: runtimeMode,
    enabled_tracks: enabledTracks,
    minimum_client_versions: minimumClientVersions,
    signing_key_id: signingKeyId,
  };
}

export function validateReleaseBundle(value) {
  const bundle = requireRecord(value, 'release bundle');
  assertExactKeys(
    bundle,
    [
      'schema_version',
      'bundle_id',
      'release_id',
      'track',
      'created_at',
      'release_at',
      'parent_release_id',
      'content',
      'approval',
      'audit',
      'audio',
      'minimum_client_versions',
    ],
    'release bundle',
  );
  requireExact(bundle.schema_version, RELEASE_BUNDLE_SCHEMA, 'schema_version');
  const bundleId = requirePattern(
    bundle.bundle_id,
    RELEASE_ID_PATTERN,
    'bundle_id',
  );
  const releaseId = requirePattern(
    bundle.release_id,
    RELEASE_ID_PATTERN,
    'release_id',
  );
  const track = requireFormalTrack(bundle.track, 'track');
  const createdAt = requireIsoTimestamp(bundle.created_at, 'created_at');
  const releaseAt = requireIsoTimestamp(bundle.release_at, 'release_at');
  const parentReleaseId =
    bundle.parent_release_id === null
      ? null
      : requirePattern(
          bundle.parent_release_id,
          RELEASE_ID_PATTERN,
          'parent_release_id',
        );

  if (parentReleaseId === releaseId) {
    throw new ReleaseDeliveryError(
      'parent_release_id must differ from release_id.',
    );
  }

  const content = validateContentEvidence(bundle.content);
  const approval = validateApprovalEvidence(bundle.approval);
  const audit = validateAuditEvidence(bundle.audit);
  const audio = validateAudioEvidence(bundle.audio);
  const minimumClientVersions = validateMinimumClientVersions(
    bundle.minimum_client_versions,
    'minimum_client_versions',
  );

  return {
    schema_version: RELEASE_BUNDLE_SCHEMA,
    bundle_id: bundleId,
    release_id: releaseId,
    track,
    created_at: createdAt,
    release_at: releaseAt,
    parent_release_id: parentReleaseId,
    content,
    approval,
    audit,
    audio,
    minimum_client_versions: minimumClientVersions,
  };
}

export function verifyReleaseBundleDirectory({bundlePath, profilePath}) {
  const absoluteBundlePath = resolve(bundlePath);
  const bundleSha256 = createHash('sha256')
    .update(readFileSync(absoluteBundlePath))
    .digest('hex');
  const bundleDirectory = dirname(absoluteBundlePath);
  const profile = validateDeliveryProfile(
    readJson(profilePath, 'delivery profile'),
  );
  const bundle = validateReleaseBundle(
    readJson(absoluteBundlePath, 'release bundle'),
  );

  if (!profile.enabled_tracks.includes(bundle.track)) {
    throw new ReleaseDeliveryError(
      `release bundle track ${bundle.track} is not enabled by the delivery profile.`,
    );
  }

  if (
    bundle.minimum_client_versions.ios !==
      profile.minimum_client_versions.ios ||
    bundle.minimum_client_versions.android !==
      profile.minimum_client_versions.android
  ) {
    throw new ReleaseDeliveryError(
      'release bundle minimum client versions must match the delivery profile.',
    );
  }

  const contentPath = resolveBundlePath(
    bundleDirectory,
    bundle.content.payload_path,
  );
  assertFileHash(contentPath, bundle.content.payload_sha256, 'content payload');
  const rawContent = readJson(contentPath, 'content payload');
  requireExact(
    rawContent.corpus_fingerprint,
    bundle.content.corpus_fingerprint,
    'content payload corpus fingerprint',
  );
  const {corpus_fingerprint: _corpusFingerprint, ...cardSourcePayload} =
    rawContent;
  const content = validateCardSourceCatalogMapping(
    validateCardSourceForReleaseBundle(cardSourcePayload, bundle.track),
  );
  assertEqual(
    content.content_version,
    bundle.content.content_version,
    'content version',
  );
  assertEqual(
    content.card_records.length,
    bundle.content.card_count,
    'content card count',
  );
  const trackPolicy = FORMAL_TRACK_POLICIES[bundle.track];
  assertEqual(
    content.card_records.length,
    trackPolicy.card_count,
    `${bundle.track} formal card count`,
  );
  assertEqual(
    new Set(content.card_records.map(card => card.knowledge_ref)).size,
    trackPolicy.box_count,
    `${bundle.track} formal box count`,
  );
  assertEqual(
    content.card_records.filter(card => card.audio).length,
    trackPolicy.audio_count,
    `${bundle.track} audio card-reference count`,
  );

  const approvalPath = resolveBundlePath(
    bundleDirectory,
    bundle.approval.record_path,
  );
  assertFileHash(
    approvalPath,
    bundle.approval.record_sha256,
    'approval record',
  );
  const approval = readJson(approvalPath, 'approval record');
  const modelReviewPath = resolveBundlePath(
    bundleDirectory,
    bundle.approval.model_review_path,
  );
  assertFileHash(
    modelReviewPath,
    bundle.approval.model_review_sha256,
    'model review record',
  );
  const modelReview = readJson(modelReviewPath, 'model review record');

  const auditPath = resolveBundlePath(
    bundleDirectory,
    bundle.audit.report_path,
  );
  assertFileHash(auditPath, bundle.audit.report_sha256, 'quality audit report');
  verifyApprovalRecord(approval, modelReview, bundle, content);
  verifyAuditBinding(approval, bundle);

  const audioManifestPath = resolveBundlePath(
    bundleDirectory,
    bundle.audio.manifest_path,
  );
  assertFileHash(
    audioManifestPath,
    bundle.audio.manifest_sha256,
    'audio manifest',
  );
  const audioManifest = validateAudioManifest(
    readJson(audioManifestPath, 'audio manifest'),
    bundle.track,
  );
  verifyAudioManifest(audioManifest, content, bundle, bundleDirectory);

  const qcIndexPath = resolveBundlePath(
    bundleDirectory,
    bundle.audio.qc_index_path,
  );
  assertFileHash(qcIndexPath, bundle.audio.qc_index_sha256, 'audio QC index');
  const qcIndex = validateAudioQcIndex(
    readJson(qcIndexPath, 'audio QC index'),
    bundle.track,
  );
  verifyAudioQcIndex(qcIndex, audioManifest, bundle, bundleDirectory);

  return {
    profile,
    bundle,
    bundle_sha256: bundleSha256,
    content,
    approval,
    audio_manifest: audioManifest,
    audio_qc_index: qcIndex,
    bundle_directory: bundleDirectory,
  };
}

export async function publishVerifiedRelease(verified, adapter) {
  requirePublisherAdapter(adapter);
  const storageByAssetId = new Map();

  for (const asset of verified.audio_manifest.assets) {
    const absolutePath = resolveBundlePath(
      verified.bundle_directory,
      asset.asset_path,
    );
    const storageFileId = await adapter.uploadAsset({
      absolutePath,
      asset,
      releaseId: verified.bundle.release_id,
      track: verified.bundle.track,
    });
    storageByAssetId.set(
      asset.asset_id,
      requireCloudBaseFileId(storageFileId, `uploaded ${asset.asset_id}`),
    );
  }

  const runtimeCardSource = {
    ...verified.content,
    assets: verified.content.assets.map(asset => ({
      asset_id: asset.asset_id,
      duration_ms: asset.duration_ms,
      media_type: asset.media_type,
      sha256: asset.sha256,
      size_bytes: asset.size_bytes,
      storage_file_id: storageByAssetId.get(asset.asset_id),
    })),
    release: createContentRelease(verified.bundle),
  };
  const normalizedRuntimeSource = validateCardSourceCatalogMapping(
    validateCardSourceForImport(runtimeCardSource, verified.bundle.track),
  );
  assertEqual(
    normalizedRuntimeSource.content_version,
    verified.bundle.content.content_version,
    'hydrated runtime content version',
  );

  await adapter.stageContent({
    bundle: verified.bundle,
    cardSource: normalizedRuntimeSource,
  });
  await adapter.verifyStaged({
    bundle: verified.bundle,
    cardSource: normalizedRuntimeSource,
  });
  await adapter.activateRelease({
    bundle: verified.bundle,
    cardSource: normalizedRuntimeSource,
  });

  return {
    release_id: verified.bundle.release_id,
    content_version: normalizedRuntimeSource.content_version,
    uploaded_asset_count: storageByAssetId.size,
    activated: true,
  };
}

export async function rollbackToRetainedRelease(targetReleaseId, adapter) {
  const releaseId = requirePattern(
    targetReleaseId,
    RELEASE_ID_PATTERN,
    'target release ID',
  );

  if (
    !adapter ||
    typeof adapter.verifyRetainedRelease !== 'function' ||
    typeof adapter.activateRetainedRelease !== 'function'
  ) {
    throw new ReleaseDeliveryError('rollback adapter is incomplete.');
  }

  const retained = await adapter.verifyRetainedRelease(releaseId);

  if (
    !retained ||
    retained.release_id !== releaseId ||
    retained.verified !== true
  ) {
    throw new ReleaseDeliveryError(
      'rollback target is not a verified retained release.',
    );
  }

  await adapter.activateRetainedRelease(retained);
  return {
    release_id: releaseId,
    activated: true,
    deleted_learning_data: false,
  };
}

function validateContentEvidence(value) {
  const content = requireRecord(value, 'content evidence');
  assertExactKeys(
    content,
    [
      'payload_path',
      'payload_sha256',
      'content_version',
      'corpus_fingerprint',
      'card_count',
    ],
    'content evidence',
  );
  return {
    payload_path: requireRelativePath(
      content.payload_path,
      'content.payload_path',
      '.json',
    ),
    payload_sha256: requireSha256(
      content.payload_sha256,
      'content.payload_sha256',
    ),
    content_version: requireSha256(
      content.content_version,
      'content.content_version',
    ),
    corpus_fingerprint: requireSha256(
      content.corpus_fingerprint,
      'content.corpus_fingerprint',
    ),
    card_count: requirePositiveInteger(
      content.card_count,
      'content.card_count',
    ),
  };
}

function validateApprovalEvidence(value) {
  const approval = requireRecord(value, 'approval evidence');
  assertExactKeys(
    approval,
    [
      'record_path',
      'record_sha256',
      'approval_id',
      'model_review_path',
      'model_review_sha256',
    ],
    'approval evidence',
  );
  return {
    record_path: requireRelativePath(
      approval.record_path,
      'approval.record_path',
      '.json',
    ),
    record_sha256: requireSha256(
      approval.record_sha256,
      'approval.record_sha256',
    ),
    approval_id: requirePattern(
      approval.approval_id,
      RELEASE_ID_PATTERN,
      'approval.approval_id',
    ),
    model_review_path: requireRelativePath(
      approval.model_review_path,
      'approval.model_review_path',
      '.json',
    ),
    model_review_sha256: requireSha256(
      approval.model_review_sha256,
      'approval.model_review_sha256',
    ),
  };
}

function validateAuditEvidence(value) {
  const audit = requireRecord(value, 'audit evidence');
  assertExactKeys(
    audit,
    [
      'report_path',
      'report_sha256',
      'unresolved_blocker_count',
      'unexplained_risk_count',
      'quality_metadata_coverage_percent',
    ],
    'audit evidence',
  );
  requireExact(
    audit.unresolved_blocker_count,
    0,
    'audit.unresolved_blocker_count',
  );
  requireExact(audit.unexplained_risk_count, 0, 'audit.unexplained_risk_count');
  requireExact(
    audit.quality_metadata_coverage_percent,
    100,
    'audit.quality_metadata_coverage_percent',
  );
  return {
    report_path: requireRelativePath(
      audit.report_path,
      'audit.report_path',
      '.json',
    ),
    report_sha256: requireSha256(audit.report_sha256, 'audit.report_sha256'),
    unresolved_blocker_count: 0,
    unexplained_risk_count: 0,
    quality_metadata_coverage_percent: 100,
  };
}

function validateAudioEvidence(value) {
  const audio = requireRecord(value, 'audio evidence');
  assertExactKeys(
    audio,
    [
      'manifest_path',
      'manifest_sha256',
      'qc_index_path',
      'qc_index_sha256',
      'asset_count',
      'qc_passed_count',
    ],
    'audio evidence',
  );
  return {
    manifest_path: requireRelativePath(
      audio.manifest_path,
      'audio.manifest_path',
      '.json',
    ),
    manifest_sha256: requireSha256(
      audio.manifest_sha256,
      'audio.manifest_sha256',
    ),
    qc_index_path: requireRelativePath(
      audio.qc_index_path,
      'audio.qc_index_path',
      '.json',
    ),
    qc_index_sha256: requireSha256(
      audio.qc_index_sha256,
      'audio.qc_index_sha256',
    ),
    asset_count: requirePositiveInteger(audio.asset_count, 'audio.asset_count'),
    qc_passed_count: requirePositiveInteger(
      audio.qc_passed_count,
      'audio.qc_passed_count',
    ),
  };
}

function validateAudioManifest(value, expectedTrack) {
  const manifest = requireRecord(value, 'audio manifest');
  assertExactKeys(
    manifest,
    ['schema_version', 'track', 'assets'],
    'audio manifest',
  );
  requireExact(
    manifest.schema_version,
    RELEASE_AUDIO_MANIFEST_SCHEMA,
    'audio manifest schema',
  );
  requireExact(manifest.track, expectedTrack, 'audio manifest track');
  const assets = requireArray(manifest.assets, 'audio manifest assets').map(
    (value, index) => {
      const asset = requireRecord(value, `audio manifest assets[${index}]`);
      assertExactKeys(
        asset,
        ['asset_id', 'asset_path', 'sha256', 'size_bytes', 'duration_ms'],
        `audio manifest assets[${index}]`,
      );
      return {
        asset_id: requirePattern(
          asset.asset_id,
          RELEASE_ID_PATTERN,
          `audio asset ${index} ID`,
        ),
        asset_path: requireRelativePath(
          asset.asset_path,
          `audio asset ${index} path`,
          '.mp3',
        ),
        sha256: requireSha256(asset.sha256, `audio asset ${index} hash`),
        size_bytes: requirePositiveInteger(
          asset.size_bytes,
          `audio asset ${index} size`,
        ),
        duration_ms: requirePositiveInteger(
          asset.duration_ms,
          `audio asset ${index} duration`,
        ),
      };
    },
  );
  assertUnique(
    assets.map(asset => asset.asset_id),
    'audio manifest asset IDs',
  );
  return {
    schema_version: RELEASE_AUDIO_MANIFEST_SCHEMA,
    track: expectedTrack,
    assets,
  };
}

function validateAudioQcIndex(value, expectedTrack) {
  const index = requireRecord(value, 'audio QC index');
  assertExactKeys(
    index,
    ['schema_version', 'track', 'corpus_fingerprint', 'assets'],
    'audio QC index',
  );
  requireExact(
    index.schema_version,
    AUDIO_QC_INDEX_SCHEMA,
    'audio QC index schema',
  );
  requireExact(index.track, expectedTrack, 'audio QC index track');
  const assets = requireArray(index.assets, 'audio QC assets').map(
    (value, itemIndex) => {
      const asset = requireRecord(value, `audio QC assets[${itemIndex}]`);
      assertExactKeys(
        asset,
        [
          'asset_id',
          'card_ids',
          'record_path',
          'record_sha256',
          'reviewed_by',
          'reviewed_at',
          'formal_audio_ready',
        ],
        `audio QC assets[${itemIndex}]`,
      );
      requireExact(
        asset.formal_audio_ready,
        true,
        `audio QC assets[${itemIndex}].formal_audio_ready`,
      );
      return {
        asset_id: requirePattern(
          asset.asset_id,
          RELEASE_ID_PATTERN,
          `audio QC asset ${itemIndex} ID`,
        ),
        card_ids: requireStringArray(
          asset.card_ids,
          `audio QC asset ${itemIndex} card_ids`,
        ),
        record_path: requireRelativePath(
          asset.record_path,
          `audio QC asset ${itemIndex} record`,
          '.json',
        ),
        record_sha256: requireSha256(
          asset.record_sha256,
          `audio QC asset ${itemIndex} record hash`,
        ),
        reviewed_by: requireString(
          asset.reviewed_by,
          `audio QC asset ${itemIndex} reviewer`,
        ),
        reviewed_at: requireIsoTimestamp(
          asset.reviewed_at,
          `audio QC asset ${itemIndex} reviewed_at`,
        ),
        formal_audio_ready: true,
      };
    },
  );
  assertUnique(
    assets.map(asset => asset.asset_id),
    'audio QC asset IDs',
  );
  return {
    schema_version: AUDIO_QC_INDEX_SCHEMA,
    track: expectedTrack,
    corpus_fingerprint: requireSha256(
      index.corpus_fingerprint,
      'audio QC corpus fingerprint',
    ),
    assets,
  };
}

function verifyApprovalRecord(approval, modelReview, bundle, content) {
  assertExactKeys(
    approval,
    [
      'schema_version',
      'authorization_id',
      'authorization_mode',
      'content_version',
      'authorized_at',
      'model_acceptances',
      'scope',
      'summary',
      'representative_cards',
      'card_quality_audit',
      'validation',
      'authorization_limits',
    ],
    'model content authorization',
  );
  requireExact(
    approval.schema_version,
    MODEL_CONTENT_AUTHORIZATION_SCHEMA,
    'authorization schema',
  );
  requireExact(
    approval.authorization_id,
    bundle.approval.approval_id,
    'authorization ID',
  );
  requireExact(approval.authorization_mode, 'full_track', 'authorization mode');
  requireExact(
    approval.content_version,
    bundle.content.content_version,
    'authorization content version',
  );
  requireIsoTimestamp(approval.authorized_at, 'authorization authorized_at');
  requireString(approval.summary, 'authorization summary');
  assertExactKeys(
    approval.scope,
    ['track', 'purpose', 'box_prefixes', 'card_ids'],
    'authorization scope',
  );
  requireExact(approval.scope?.track, bundle.track, 'authorization track');
  requireExact(approval.scope?.purpose, 'formal_content', 'authorization purpose');
  const approvedCardIds = requireStringArray(
    approval.scope?.card_ids,
    'authorization card_ids',
  );
  const contentCardIds = content.card_records.map(card => card.card_id);
  assertSameSet(approvedCardIds, contentCardIds, 'authorization card scope');
  const approvedBoxes = requireStringArray(
    approval.scope?.box_prefixes,
    'authorization box_prefixes',
  );
  const contentBoxes = [
    ...new Set(content.card_records.map(card => card.knowledge_ref)),
  ];
  assertSameSet(approvedBoxes, contentBoxes, 'authorization box scope');
  requireExact(
    approval.card_quality_audit?.corpus_fingerprint,
    bundle.content.corpus_fingerprint.slice('sha256:'.length),
    'approval corpus fingerprint',
  );
  requireExact(
    approval.card_quality_audit?.scope_has_no_hard_blockers,
    true,
    'approval hard-blocker result',
  );
  requireExact(
    approval.card_quality_audit?.scope_summary?.card_count,
    content.card_records.length,
    'approval audit card count',
  );
  assertSameSet(
    requireStringArray(
      approval.card_quality_audit?.scope_summary?.card_ids,
      'approval audit card_ids',
    ),
    contentCardIds,
    'approval audit card scope',
  );
  requireExact(
    approval.card_quality_audit?.scope_summary?.by_severity?.hard_blocker,
    0,
    'approval hard blocker count',
  );
  requireExact(
    approval.validation?.model_review_sha256,
    bundle.approval.model_review_sha256,
    'authorization linked model review hash',
  );
  requireExact(
    modelReview.schema_version,
    'model-owned-full-track-review.v2',
    'model review schema',
  );
  requireExact(modelReview.scope?.track, bundle.track, 'model review track');
  assertSameSet(
    requireStringArray(modelReview.scope?.card_ids, 'model review card_ids'),
    contentCardIds,
    'model review card scope',
  );
  assertSameSet(
    requireStringArray(modelReview.scope?.box_prefixes, 'model review box_prefixes'),
    contentBoxes,
    'model review box scope',
  );
  requireExact(
    modelReview.quality_audit?.report_sha256,
    bundle.audit.report_sha256,
    'model review audit hash',
  );
  requireExact(
    normalizeSha256(modelReview.quality_audit?.corpus_fingerprint),
    bundle.content.corpus_fingerprint,
    'model review corpus fingerprint',
  );
  requireExact(
    modelReview.quality_audit?.scope_has_no_hard_blockers,
    true,
    'model review hard-blocker result',
  );
  requireExact(
    modelReview.batch_review?.status,
    'ready_for_model_authorization',
    'model review authorization status',
  );
  const expectedReviewInput = buildModelAcceptanceInputSha256({
    decisionType: 'full_track_review',
    scope: modelReview.scope,
    corpusFingerprint: bundle.content.corpus_fingerprint,
    auditSha256: bundle.audit.report_sha256,
  });
  requireIndependentModelAcceptances(modelReview.model_acceptances, {
    expectedInputSha256: expectedReviewInput,
    label: 'formal full-track model review',
    requiredCapabilities: [
      'card_semantic_review',
      'source_provenance_review',
    ],
  });
  const expectedInput = buildModelAcceptanceInputSha256({
    decisionType: 'full_track_content_authorization',
    scope: approval.scope,
    corpusFingerprint: bundle.content.corpus_fingerprint,
    auditSha256: bundle.audit.report_sha256,
    linkedReviewIdentity: {
      path: requireString(
        approval.validation?.model_review,
        'authorization linked model review path',
      ),
      sha256: bundle.approval.model_review_sha256,
    },
    additionalBindings: {
      content_version: bundle.content.content_version,
    },
  });
  requireIndependentModelAcceptances(approval.model_acceptances, {
    expectedInputSha256: expectedInput,
    label: 'formal content authorization',
    requiredCapabilities: ['content_authorization'],
  });
}

function verifyAuditBinding(approval, bundle) {
  requireExact(
    approval.card_quality_audit?.report,
    bundle.audit.report_path,
    'approval audit report path',
  );
  requireExact(
    approval.card_quality_audit?.report_sha256,
    bundle.audit.report_sha256,
    'approval audit report hash',
  );
}

function verifyAudioManifest(manifest, content, bundle, bundleDirectory) {
  const trackPolicy = FORMAL_TRACK_POLICIES[bundle.track];
  assertEqual(
    manifest.assets.length,
    trackPolicy.audio_count,
    `${bundle.track} audio manifest count`,
  );
  assertEqual(
    manifest.assets.length,
    content.assets.length,
    'content audio asset count',
  );
  const contentById = new Map(
    content.assets.map(asset => [asset.asset_id, asset]),
  );

  for (const asset of manifest.assets) {
    const contentAsset = contentById.get(asset.asset_id);
    if (!contentAsset) {
      throw new ReleaseDeliveryError(
        `audio manifest asset ${asset.asset_id} is not in content.`,
      );
    }
    assertEqual(
      asset.asset_path,
      contentAsset.asset_path,
      `${asset.asset_id} path`,
    );
    assertEqual(asset.sha256, contentAsset.sha256, `${asset.asset_id} hash`);
    assertEqual(
      asset.size_bytes,
      contentAsset.size_bytes,
      `${asset.asset_id} size`,
    );
    assertEqual(
      asset.duration_ms,
      contentAsset.duration_ms,
      `${asset.asset_id} duration`,
    );
    const assetPath = resolveBundlePath(bundleDirectory, asset.asset_path);
    assertFileHash(assetPath, asset.sha256, `audio asset ${asset.asset_id}`);
    assertEqual(
      statSync(assetPath).size,
      asset.size_bytes,
      `${asset.asset_id} byte size`,
    );
  }
}

function modelAudioQcInput(record) {
  const transcriptByCard = indexUniqueAudioRecords(
    record.text_gate?.transcripts,
    'model audio QC transcripts',
  );
  const perCardById = indexUniqueAudioRecords(
    record.per_card_qc,
    'model audio QC per_card_qc',
  );
  const generatedById = indexUniqueAudioRecords(
    record.generated_assets,
    'model audio QC generated_assets',
  );
  const scopeCardIds = requireStringArray(
    record.scope?.card_ids,
    'model audio QC scope.card_ids',
  );
  for (const values of [
    [...transcriptByCard.keys()],
    [...perCardById.keys()],
    [...generatedById.keys()],
  ]) {
    assertSameSet(values, scopeCardIds, 'model audio QC exact card scope');
  }
  const identities = requireArray(
    record.generated_assets,
    'model audio QC generated_assets',
  ).map((asset, index) => {
    const cardId = requireString(asset?.card_id, `model audio asset ${index} card_id`);
    const transcript = transcriptByCard.get(cardId);
    if (!transcript) {
      throw new ReleaseDeliveryError(`model audio asset ${cardId} has no bound transcript.`);
    }
    const transcriptSha256 = createHash('sha256')
      .update(String(transcript.transcript || ''), 'utf8')
      .digest('hex');
    requireExact(
      asset.transcript_sha256,
      transcriptSha256,
      `${cardId} transcript hash`,
    );
    if (!/^[a-f0-9]{64}$/.test(String(asset.file_sha256 || ''))) {
      throw new ReleaseDeliveryError(`${cardId} model audio file hash is invalid.`);
    }
    const result = perCardById.get(cardId);
    return {
      card_id: cardId,
      path: requireRelativePath(asset.path, `${cardId} model audio path`, '.mp3'),
      file_sha256: asset.file_sha256,
      transcript_sha256: transcriptSha256,
      per_card_qc: canonicalPerCardAudioQc(result, cardId),
    };
  });
  identities.sort((left, right) =>
    left.card_id.localeCompare(right.card_id) || left.path.localeCompare(right.path));
  return `sha256:${createHash('sha256').update(JSON.stringify(identities)).digest('hex')}`;
}

function canonicalPerCardAudioQc(value, cardId) {
  const result = requireRecord(value, `${cardId} per-card audio QC`);
  return {
    complete_asset_consumed: result.complete_asset_consumed,
    matches_text: result.matches_text,
    target_signal: result.target_signal,
    pronunciation: result.pronunciation,
    speed: result.speed,
    rhythm: result.rhythm,
    stress_pauses: result.stress_pauses,
    no_noise: result.no_noise,
  };
}

function indexUniqueAudioRecords(value, label) {
  const records = requireArray(value, label);
  const result = new Map();
  for (const [index, record] of records.entries()) {
    const cardId = requireString(record?.card_id, `${label}[${index}].card_id`);
    if (result.has(cardId)) {
      throw new ReleaseDeliveryError(`${label} contains duplicate card ${cardId}.`);
    }
    result.set(cardId, record);
  }
  return result;
}

function verifyModelAudioQcRecord(record, indexedAsset, manifestById) {
  requireExact(record.schema_version, MODEL_AUDIO_QC_SCHEMA, 'model audio QC schema');
  const expectedInput = modelAudioQcInput(record);
  requireIndependentModelAcceptances(record.model_acceptances, {
    expectedInputSha256: expectedInput,
    label: `audio QC ${indexedAsset.asset_id}`,
    requiredCapabilities: ['audio_perceptual_review'],
  });
  if (!record.model_acceptances.some(
    acceptance => acceptance.actor?.agent === indexedAsset.reviewed_by,
  )) {
    throw new ReleaseDeliveryError(
      `${indexedAsset.asset_id} reviewed_by is not a model acceptance principal.`,
    );
  }
  const generatedByCard = new Map(
    requireArray(record.generated_assets, `${indexedAsset.asset_id} generated_assets`)
      .map(asset => [String(asset?.card_id || ''), asset]),
  );
  const perCard = new Map(
    requireArray(record.per_card_qc, `${indexedAsset.asset_id} per_card_qc`)
      .map(item => [String(item?.card_id || ''), item]),
  );
  for (const cardId of indexedAsset.card_ids) {
    const generated = generatedByCard.get(cardId);
    const result = perCard.get(cardId);
    if (!generated || !result) {
      throw new ReleaseDeliveryError(`${indexedAsset.asset_id} lacks model evidence for ${cardId}.`);
    }
    const manifestAsset = manifestById.get(indexedAsset.asset_id);
    if (!manifestAsset) {
      throw new ReleaseDeliveryError(`${cardId} model audio asset is absent from the manifest.`);
    }
    requireExact(
      generated.file_sha256,
      manifestAsset.sha256.slice('sha256:'.length),
      `${cardId} model audio byte hash`,
    );
    for (const check of [
      'complete_asset_consumed',
      'matches_text',
      'target_signal',
      'pronunciation',
      'speed',
      'rhythm',
      'stress_pauses',
      'no_noise',
    ]) {
      requireExact(result[check], true, `${cardId} ${check}`);
    }
  }
}

function verifyAudioQcIndex(index, manifest, bundle, bundleDirectory) {
  assertEqual(
    index.corpus_fingerprint,
    bundle.content.corpus_fingerprint,
    'audio QC corpus fingerprint',
  );
  assertEqual(
    index.assets.length,
    bundle.audio.asset_count,
    'audio QC asset count',
  );
  assertEqual(
    index.assets.length,
    bundle.audio.qc_passed_count,
    'audio QC passed count',
  );
  assertEqual(
    index.assets.length,
    FORMAL_TRACK_POLICIES[bundle.track].audio_count,
    `${bundle.track} audio QC count`,
  );
  assertSameSet(
    index.assets.map(asset => asset.asset_id),
    manifest.assets.map(asset => asset.asset_id),
    'audio QC asset coverage',
  );
  const manifestById = new Map(
    manifest.assets.map(asset => [asset.asset_id, asset]),
  );

  for (const asset of index.assets) {
    const recordPath = resolveBundlePath(bundleDirectory, asset.record_path);
    assertFileHash(
      recordPath,
      asset.record_sha256,
      `audio QC record ${asset.asset_id}`,
    );
    const record = readJson(recordPath, `audio QC record ${asset.asset_id}`);
    verifyModelAudioQcRecord(record, asset, manifestById);
    requireExact(
      record.verdict?.formal_audio_ready,
      true,
      `${asset.asset_id} formal_audio_ready`,
    );
    for (const check of REQUIRED_AUDIO_QC_CHECKS) {
      requireExact(
        record.qa_checks?.[check],
        true,
        `${asset.asset_id} ${check}`,
      );
    }
    const coveredCards = new Set(
      requireArray(record.per_card_qc, `${asset.asset_id} per_card_qc`).map(
        item => item?.card_id,
      ),
    );
    if (!asset.card_ids.every(cardId => coveredCards.has(cardId))) {
      throw new ReleaseDeliveryError(
        `${asset.asset_id} QC record does not cover every bound card.`,
      );
    }
  }
}

function createContentRelease(bundle) {
  return {
    schema_version: CONTENT_RELEASE_SCHEMA,
    release_id: bundle.release_id,
    track: bundle.track,
    content_version: bundle.content.content_version,
    minimum_client_version: maxSemver(
      bundle.minimum_client_versions.ios,
      bundle.minimum_client_versions.android,
    ),
    parent_release_id: bundle.parent_release_id,
    published_at: bundle.release_at,
  };
}

function maxSemver(left, right) {
  return compareSemanticVersions(left, right) >= 0 ? left : right;
}

export function compareSemanticVersions(left, right) {
  const leftVersion = parseSemver(left);
  const rightVersion = parseSemver(right);

  for (const field of ['major', 'minor', 'patch']) {
    const comparison = compareNumericIdentifier(
      leftVersion[field],
      rightVersion[field],
    );
    if (comparison !== 0) return comparison;
  }

  return comparePrerelease(
    leftVersion.prerelease,
    rightVersion.prerelease,
  );
}

function parseSemver(value) {
  const match = SEMVER_PATTERN.exec(value);
  if (!match) {
    throw new ReleaseDeliveryError('semantic version is invalid.');
  }
  const prerelease = match[4]?.split('.') ?? null;
  if (
    prerelease?.some(
      identifier =>
        /^\d+$/.test(identifier) &&
        identifier.length > 1 &&
        identifier.startsWith('0'),
    )
  ) {
    throw new ReleaseDeliveryError('semantic version is invalid.');
  }
  return {
    major: match[1],
    minor: match[2],
    patch: match[3],
    prerelease,
  };
}

function compareNumericIdentifier(left, right) {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function comparePrerelease(left, right) {
  if (left === null || right === null) {
    if (left === right) return 0;
    return left === null ? 1 : -1;
  }

  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = left[index];
    const rightIdentifier = right[index];
    if (leftIdentifier === undefined || rightIdentifier === undefined) {
      if (leftIdentifier === rightIdentifier) return 0;
      return leftIdentifier === undefined ? -1 : 1;
    }
    if (leftIdentifier === rightIdentifier) continue;

    const leftNumeric = /^\d+$/.test(leftIdentifier);
    const rightNumeric = /^\d+$/.test(rightIdentifier);
    if (leftNumeric && rightNumeric) {
      return compareNumericIdentifier(leftIdentifier, rightIdentifier);
    }
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftIdentifier < rightIdentifier ? -1 : 1;
  }
  return 0;
}

function requirePublisherAdapter(adapter) {
  for (const method of [
    'uploadAsset',
    'stageContent',
    'verifyStaged',
    'activateRelease',
  ]) {
    if (typeof adapter?.[method] !== 'function') {
      throw new ReleaseDeliveryError(`publisher adapter requires ${method}.`);
    }
  }
}

function validateMinimumClientVersions(value, label) {
  const versions = requireRecord(value, label);
  assertExactKeys(versions, ['ios', 'android'], label);
  const normalized = {
    ios: requirePattern(versions.ios, SEMVER_PATTERN, `${label}.ios`),
    android: requirePattern(
      versions.android,
      SEMVER_PATTERN,
      `${label}.android`,
    ),
  };
  for (const [platform, version] of Object.entries(normalized)) {
    try {
      parseSemver(version);
    } catch {
      throw new ReleaseDeliveryError(
        `${label}.${platform} must be a strict semantic version.`,
      );
    }
  }
  return normalized;
}

function resolveBundlePath(bundleDirectory, candidate) {
  const relativePath = requireRelativePath(candidate, 'bundle path');
  const absolutePath = resolve(bundleDirectory, relativePath);
  const fromBundle = relative(bundleDirectory, absolutePath);

  if (
    fromBundle === '..' ||
    fromBundle.startsWith(`..${sep}`) ||
    isAbsolute(fromBundle)
  ) {
    throw new ReleaseDeliveryError(
      `bundle path escapes its directory: ${candidate}`,
    );
  }
  return absolutePath;
}

function assertFileHash(path, expected, label) {
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch (error) {
    throw new ReleaseDeliveryError(
      `${label} cannot be read: ${safeMessage(error)}`,
    );
  }
  const actual = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  assertEqual(actual, expected, `${label} SHA-256`);
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
  } catch (error) {
    throw new ReleaseDeliveryError(
      `${label} is not valid readable JSON: ${safeMessage(error)}`,
    );
  }
}

function assertNoSecretFields(value, label) {
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key) && key !== 'signing_key_id') {
      throw new ReleaseDeliveryError(
        `${label} must not contain secret field ${key}.`,
      );
    }
    if (child && typeof child === 'object') {
      assertNoSecretFields(child, label);
    }
  }
}

function requireHttpsOrigin(value, label) {
  const text = requireString(value, label);
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new ReleaseDeliveryError(`${label} must be a valid HTTPS URL.`);
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname === '/'
  ) {
    throw new ReleaseDeliveryError(
      `${label} must be a credential-free HTTPS API base URL with a path.`,
    );
  }
  return url.toString().replace(/\/$/, '');
}

function requireRelativePath(value, label, suffix = null) {
  const text = requireString(value, label);
  if (
    isAbsolute(text) ||
    text.includes('\\') ||
    text
      .split('/')
      .some(segment => segment === '' || segment === '.' || segment === '..') ||
    (suffix && !text.toLowerCase().endsWith(suffix))
  ) {
    throw new ReleaseDeliveryError(
      `${label} must be a safe relative${suffix ?? ''} path.`,
    );
  }
  return text;
}

function requireCloudBaseFileId(value, label) {
  const text = requireString(value, label);
  if (!/^cloud:\/\/[^\s?#]+$/.test(text)) {
    throw new ReleaseDeliveryError(`${label} must return a CloudBase file ID.`);
  }
  return text;
}

function requireSha256(value, label) {
  return requirePattern(value, SHA256_PATTERN, label);
}

function normalizeSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
    ? `sha256:${value}`
    : value;
}

function requireIsoTimestamp(value, label) {
  const text = requireString(value, label);
  const time = Date.parse(text);
  if (Number.isNaN(time)) {
    throw new ReleaseDeliveryError(`${label} must be an ISO timestamp.`);
  }
  return new Date(time).toISOString();
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ReleaseDeliveryError(`${label} must be a positive integer.`);
  }
  return value;
}

function requireStringArray(value, label) {
  const array = requireArray(value, label).map((item, index) =>
    requireString(item, `${label}[${index}]`),
  );
  assertUnique(array, label);
  return array;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new ReleaseDeliveryError(`${label} must be an array.`);
  }
  return value;
}

function requireRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReleaseDeliveryError(`${label} must be an object.`);
  }
  return value;
}

function requireString(value, label) {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value !== value.trim()
  ) {
    throw new ReleaseDeliveryError(
      `${label} must be a trimmed non-empty string.`,
    );
  }
  return value;
}

function requirePattern(value, pattern, label) {
  const text = requireString(value, label);
  if (!pattern.test(text)) {
    throw new ReleaseDeliveryError(`${label} has invalid format.`);
  }
  return text;
}

function requireExact(actual, expected, label) {
  if (actual !== expected) {
    throw new ReleaseDeliveryError(
      `${label} must equal ${JSON.stringify(expected)}.`,
    );
  }
  return actual;
}

function requireOneOf(value, allowed, label) {
  const text = requireString(value, label);
  if (!allowed.includes(text)) {
    throw new ReleaseDeliveryError(
      `${label} must be one of ${JSON.stringify(allowed)}.`,
    );
  }
  return text;
}

function requireFormalTrack(value, label) {
  const track = requireString(value, label);
  if (!Object.hasOwn(FORMAL_TRACK_POLICIES, track)) {
    throw new ReleaseDeliveryError(`${label} must be cet4 or cet6.`);
  }
  return track;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new ReleaseDeliveryError(`${label} mismatch.`);
  }
}

function assertExactKeys(value, expectedKeys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new ReleaseDeliveryError(
      `${label} has unsupported or missing fields.`,
    );
  }
}

function assertUnique(values, label) {
  if (new Set(values).size !== values.length) {
    throw new ReleaseDeliveryError(`${label} must be unique.`);
  }
}

function assertSameSet(left, right, label) {
  assertUnique(left, label);
  assertUnique(right, label);
  if (
    left.length !== right.length ||
    [...left].sort().some((value, index) => value !== [...right].sort()[index])
  ) {
    throw new ReleaseDeliveryError(`${label} must match exactly.`);
  }
}

function safeMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
