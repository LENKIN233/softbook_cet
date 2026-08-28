import {createHash} from 'node:crypto';
import {readFileSync, statSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';

import {
  buildModelAcceptanceInputSha256,
  requireIndependentModelAcceptances,
} from '../../scripts/lib/model_acceptance_contract.mjs';
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
const CARD_MAKE_QUALITY_RULES = Object.freeze([
  'analysis_missing_or_too_short',
  'exact_repeated_analysis',
  'exact_repeated_front',
  'front_leaks_analysis_conclusion',
  'front_leaks_correct_answer',
  'front_missing_or_too_short',
  'generic_front_pattern',
  'missing_quality_metadata',
  'multiple_choice_answer_not_in_options',
  'multiple_choice_no_options',
  'synthetic_source',
  'template_analysis_pattern',
  'unverified_source',
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
  const review = verifyBoundJson(
    bundleDirectory,
    bundle.approval.review_path,
    bundle.approval.review_sha256,
    'controlled pilot review record',
  );
  const audit = verifyBoundJson(
    bundleDirectory,
    bundle.audit.report_path,
    bundle.audit.report_sha256,
    'controlled pilot audit report',
  );
  assertApprovalArtifact(approval, review, bundle, content, audit);
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
    active.release.pilot_id !== verified.bundle.pilot_id ||
    active.release.profile_id !== verified.bundle.profile_id ||
    active.release.release_id !== verified.bundle.release_id ||
    active.release.content_version !== runtimeCardSource.content_version ||
    active.release.card_count !== 120 ||
    active.release.free_card_count !== 60 ||
    active.release.expires_at !== verified.bundle.pilot_expires_at ||
    active.release.gate_eligible !== false ||
    JSON.stringify(active) !== JSON.stringify(runtimeCardSource)
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
  const manifestByPath = new Map(
    manifestAssets.map(asset => [asset.asset_path, asset]),
  );
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
    verifyModelAudioQcRecord(record, item, manifestByPath);
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

function verifyModelAudioQcRecord(record, indexedAsset, manifestByPath) {
  if (
    record.schema_version !== 'model-owned-audio-qc.v2' ||
    record.verdict?.formal_audio_ready !== true ||
    record.verdict?.requires_regeneration !== false ||
    record.approval_boundary?.current_model_owned_content_authorization_required !== true ||
    record.approval_boundary?.external_facts_must_not_be_inferred !== true
  ) {
    fail(`audio QC record ${indexedAsset.asset_id} is not current model-owned evidence.`);
  }
  for (const check of REQUIRED_AUDIO_QC_CHECKS) {
    if (record.qa_checks?.[check] !== true) {
      fail(`audio QC record ${indexedAsset.asset_id} failed ${check}.`);
    }
  }
  const scopeIds = requireStringArray(
    record.scope?.card_ids,
    `${indexedAsset.asset_id} audio QC scope`,
  );
  const transcripts = uniqueByCardId(
    record.text_gate?.transcripts,
    `${indexedAsset.asset_id} transcripts`,
  );
  const generated = uniqueByCardId(
    record.generated_assets,
    `${indexedAsset.asset_id} generated assets`,
  );
  const perCard = uniqueByCardId(
    record.per_card_qc,
    `${indexedAsset.asset_id} per-card QC`,
  );
  if (
    !sameSet(scopeIds, indexedAsset.card_ids) ||
    !sameSet([...transcripts.keys()], indexedAsset.card_ids) ||
    !sameSet([...generated.keys()], indexedAsset.card_ids) ||
    !sameSet([...perCard.keys()], indexedAsset.card_ids)
  ) {
    fail(`audio QC record ${indexedAsset.asset_id} has incomplete or extra card evidence.`);
  }
  const identities = [];
  for (const cardId of indexedAsset.card_ids) {
    const transcript = transcripts.get(cardId);
    const asset = generated.get(cardId);
    const result = perCard.get(cardId);
    const transcriptSha256 = createHash('sha256')
      .update(String(transcript?.transcript ?? ''), 'utf8')
      .digest('hex');
    const manifestAsset = manifestByPath.get(asset?.path);
    if (
      !String(transcript?.transcript ?? '').trim() ||
      asset?.transcript_sha256 !== transcriptSha256 ||
      !manifestAsset ||
      asset.file_sha256 !== manifestAsset.sha256.slice('sha256:'.length) ||
      manifestAsset.asset_id !== indexedAsset.asset_id ||
      result?.asset_path !== asset.path
    ) {
      fail(`audio QC record ${indexedAsset.asset_id} has unbound bytes or transcript for ${cardId}.`);
    }
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
      if (result?.[check] !== true) {
        fail(`audio QC record ${indexedAsset.asset_id} failed ${check} for ${cardId}.`);
      }
    }
    identities.push({
      card_id: cardId,
      path: asset.path,
      file_sha256: asset.file_sha256,
      transcript_sha256: transcriptSha256,
      per_card_qc: {
        complete_asset_consumed: result.complete_asset_consumed,
        matches_text: result.matches_text,
        target_signal: result.target_signal,
        pronunciation: result.pronunciation,
        speed: result.speed,
        rhythm: result.rhythm,
        stress_pauses: result.stress_pauses,
        no_noise: result.no_noise,
      },
    });
  }
  identities.sort((left, right) =>
    left.card_id.localeCompare(right.card_id) || left.path.localeCompare(right.path));
  const trustedMedia = {
    receipt_path: record.source_records?.trusted_media_receipt,
    receipt_sha256: record.source_records?.trusted_media_receipt_sha256,
    attestation_bundle_path:
      record.source_records?.trusted_media_attestation_bundle,
    attestation_bundle_sha256:
      record.source_records?.trusted_media_attestation_bundle_sha256,
    source_commit: record.source_records?.trusted_media_source_commit,
    model_id: record.source_records?.trusted_media_model_id,
    model_revision: record.source_records?.trusted_media_model_revision,
  };
  if (
    typeof trustedMedia.receipt_path !== 'string' ||
    !trustedMedia.receipt_path.startsWith('reviews/trusted_media_receipts/') ||
    !/^[a-f0-9]{64}$/.test(trustedMedia.receipt_sha256 || '') ||
    typeof trustedMedia.attestation_bundle_path !== 'string' ||
    !trustedMedia.attestation_bundle_path.startsWith('reviews/trusted_media_receipts/') ||
    !/^[a-f0-9]{64}$/.test(trustedMedia.attestation_bundle_sha256 || '') ||
    !/^[a-f0-9]{40}$/.test(trustedMedia.source_commit || '') ||
    typeof trustedMedia.model_id !== 'string' ||
    trustedMedia.model_id.length < 3 ||
    !/^[a-f0-9]{40}$/.test(trustedMedia.model_revision || '')
  ) {
    fail(`audio QC record ${indexedAsset.asset_id} has no valid trusted media receipt binding.`);
  }
  const expectedInput = digestJson({
    assets: identities,
    trusted_media: trustedMedia,
  });
  try {
    requireIndependentModelAcceptances(record.model_acceptances, {
      expectedInputSha256: expectedInput,
      label: `audio QC ${indexedAsset.asset_id}`,
      requiredCapabilities: ['audio_perceptual_review'],
    });
  } catch (error) {
    fail(error.message);
  }
  if (
    !record.model_acceptances.some(
      acceptance => acceptance.actor?.agent === indexedAsset.reviewed_by,
    ) ||
    !record.model_acceptances.some(
      acceptance =>
        new Date(acceptance.evidence?.reviewed_at).toISOString() ===
        indexedAsset.reviewed_at,
    )
  ) {
    fail(`audio QC record ${indexedAsset.asset_id} reviewer identity is unbound.`);
  }
}

function assertApprovalArtifact(approval, review, bundle, content, audit) {
  assertExactObjectKeys(
    approval,
    [
      'schema_version',
      'pilot_id',
      'content_version',
      'scope',
      'status',
      'authorized_at',
      'model_acceptances',
      'review',
      'review_sha256',
      'runtime_payload_sha256',
      'scoped_audit_sha256',
      'card_ids',
    ],
    'controlled pilot model authorization',
  );
  assertExactObjectKeys(
    review,
    [
      'schema_version',
      'review_id',
      'created_at',
      'pilot_id',
      'content_version',
      'scope',
      'source_records',
      'coverage',
      'quality',
      'authorization',
      'authorization_boundary',
      'status',
    ],
    'controlled pilot model review',
  );
  assertExactObjectKeys(
    review.scope,
    ['track', 'purpose', 'card_count', 'box_prefixes', 'card_ids'],
    'controlled pilot review scope',
  );
  assertExactObjectKeys(
    review.source_records,
    [
      'runtime_payload',
      'runtime_payload_sha256',
      'model_reviews',
      'scoped_audit',
      'scoped_audit_sha256',
    ],
    'controlled pilot review source records',
  );
  assertExactObjectKeys(
    review.coverage,
    ['reviewed_cards', 'boxes'],
    'controlled pilot review coverage',
  );
  assertExactObjectKeys(
    review.quality,
    [
      'corpus_fingerprint',
      'hard_blockers',
      'content_risks',
      'review_gaps',
      'source_risks',
      'synthetic_source_cards',
      'source_disclosure',
    ],
    'controlled pilot review quality',
  );
  assertExactObjectKeys(
    review.authorization,
    ['model_acceptance', 'authorized_at', 'artifact_path'],
    'controlled pilot review authorization',
  );
  assertExactObjectKeys(
    review.authorization_boundary,
    [
      'audio_qc_required_separately',
      'pilot_publication_required_separately',
      'external_facts_must_not_be_inferred',
      'gate_eligible',
    ],
    'controlled pilot review authorization boundary',
  );
  const contentCardIds = content.card_records.map(card => card.card_id);
  const contentBoxes = [
    ...new Set(content.card_records.map(card => card.knowledge_ref)),
  ];
  const coveredIds = [];
  const coveredBoxes = [];
  for (const box of requireArray(review.coverage?.boxes, 'review coverage boxes')) {
    assertExactObjectKeys(
      box,
      ['box_prefix', 'card_ids', 'status'],
      'review coverage box',
    );
    if (box.status !== 'passed') fail(`controlled pilot box ${box.box_prefix} is not passed.`);
    coveredBoxes.push(box.box_prefix);
    coveredIds.push(...requireStringArray(box.card_ids, `box ${box.box_prefix} card IDs`));
  }
  const modelReviewPaths = requireStringArray(
    review.source_records?.model_reviews,
    'controlled pilot model review paths',
  );
  if (
    approval.schema_version !== 'controlled-pilot-authorization.v2' ||
    approval.pilot_id !== bundle.pilot_id ||
    approval.content_version !== content.content_version ||
    approval.scope !== 'controlled_pilot_120' ||
    approval.status !== 'authorized' ||
    !isCanonicalIsoTimestamp(approval.authorized_at) ||
    approval.review_sha256 !== bundle.approval.review_sha256 ||
    approval.runtime_payload_sha256 !== review.source_records?.runtime_payload_sha256 ||
    approval.scoped_audit_sha256 !== bundle.audit.report_sha256 ||
    approval.scoped_audit_sha256 !== review.source_records?.scoped_audit_sha256 ||
    typeof approval.review !== 'string' ||
    !approval.review.trim() ||
    review.schema_version !== 'controlled-pilot-review.v2' ||
    review.status !== 'ready_for_model_authorization' ||
    review.pilot_id !== bundle.pilot_id ||
    review.content_version !== content.content_version ||
    review.scope?.track !== 'cet4' ||
    review.scope?.purpose !== 'controlled_pilot' ||
    review.scope?.card_count !== 120 ||
    review.coverage?.reviewed_cards !== 120 ||
    modelReviewPaths.length === 0 ||
    review.quality?.corpus_fingerprint !== bundle.content.corpus_fingerprint ||
    review.quality?.hard_blockers !== 0 ||
    review.quality?.content_risks !== 0 ||
    review.quality?.review_gaps !== 0 ||
    review.quality?.source_risks !== 120 ||
    review.quality?.synthetic_source_cards !== 120 ||
    review.quality?.source_disclosure !== 'synthetic_training_content_not_true_exam' ||
    review.authorization?.model_acceptance !== null ||
    review.authorization?.authorized_at !== null ||
    review.authorization?.artifact_path !== null ||
    review.authorization_boundary?.audio_qc_required_separately !== true ||
    review.authorization_boundary?.pilot_publication_required_separately !== true ||
    review.authorization_boundary?.external_facts_must_not_be_inferred !== true ||
    review.authorization_boundary?.gate_eligible !== false ||
    !sameSet(approval.card_ids, contentCardIds) ||
    !sameSet(review.scope?.card_ids, contentCardIds) ||
    !sameSet(review.scope?.box_prefixes, contentBoxes) ||
    !sameSet(coveredIds, contentCardIds) ||
    !sameSet(coveredBoxes, contentBoxes) ||
    `sha256:${audit.corpus_fingerprint?.digest ?? ''}` !==
      bundle.content.corpus_fingerprint
  ) {
    fail('controlled pilot model authorization or review artifact is invalid or unbound.');
  }
  const expectedInput = buildModelAcceptanceInputSha256({
    decisionType: 'controlled_pilot_authorization',
    scope: review.scope,
    corpusFingerprint: bundle.content.corpus_fingerprint,
    auditSha256: bundle.audit.report_sha256,
    linkedReviewIdentity: {
      path: approval.review,
      sha256: bundle.approval.review_sha256,
    },
    additionalBindings: {
      pilot_id: approval.pilot_id,
      content_version: approval.content_version,
      runtime_payload_sha256: approval.runtime_payload_sha256,
    },
  });
  try {
    requireIndependentModelAcceptances(approval.model_acceptances, {
      expectedInputSha256: expectedInput,
      label: 'controlled-pilot authorization',
      requiredCapabilities: ['content_authorization'],
    });
  } catch (error) {
    fail(error.message);
  }
}

function assertAuditArtifact(audit, bundle, content) {
  assertExactObjectKeys(
    audit,
    [
      'audit_version',
      'corpus_fingerprint',
      'mode',
      'ok',
      'report_type',
      'scope',
      'scope_summary',
      'scoped_card_issue_index',
      'scoped_hard_blocker_issues',
    ],
    'controlled pilot audit',
  );
  const contentCardIds = content.card_records
    .map(card => card.card_id)
    .sort((left, right) => left.localeCompare(right));
  if (
    audit.audit_version !== bundle.audit.audit_version ||
    audit.report_type !== bundle.audit.report_type ||
    audit.mode !== 'read_only_non_blocking_for_legacy_corpus' ||
    audit.ok !== true ||
    bundle.audit.scope_card_ids_sha256 !== digestJson(contentCardIds)
  ) {
    fail('controlled pilot audit artifact is invalid or unbound.');
  }

  assertAuditCorpusFingerprint(audit.corpus_fingerprint, bundle);
  assertAuditScope(audit.scope, contentCardIds);
  assertAuditScopeSummary(audit.scope_summary, contentCardIds);
  assertAuditCardIndex(audit.scoped_card_issue_index, content);
  if (
    !Array.isArray(audit.scoped_hard_blocker_issues) ||
    audit.scoped_hard_blocker_issues.length !== 0
  ) {
    fail('controlled pilot audit contains scoped hard blockers.');
  }
}

function assertAuditCorpusFingerprint(value, bundle) {
  assertExactObjectKeys(
    value,
    ['algorithm', 'card_dir', 'file_count', 'card_count', 'digest'],
    'controlled pilot audit corpus fingerprint',
  );
  if (
    value.algorithm !== 'sha256' ||
    value.card_dir !== 'card_boxes_json' ||
    !Number.isInteger(value.file_count) ||
    value.file_count <= 0 ||
    !Number.isInteger(value.card_count) ||
    value.card_count < 120 ||
    !/^[a-f0-9]{64}$/.test(value.digest) ||
    `sha256:${value.digest}` !== bundle.audit.corpus_sha256
  ) {
    fail('controlled pilot audit corpus fingerprint is invalid or unbound.');
  }
}

function assertAuditScope(value, contentCardIds) {
  assertExactObjectKeys(
    value,
    ['card_dir', 'card_ids', 'missing_card_ids'],
    'controlled pilot audit scope',
  );
  if (
    value.card_dir !== 'card_boxes_json' ||
    !sameOrderedStrings(value.card_ids, contentCardIds) ||
    !Array.isArray(value.missing_card_ids) ||
    value.missing_card_ids.length !== 0
  ) {
    fail('controlled pilot audit scope does not match the content payload.');
  }
}

function assertAuditScopeSummary(value, contentCardIds) {
  assertExactObjectKeys(
    value,
    ['card_ids', 'card_count', 'issue_count', 'by_severity', 'by_rule'],
    'controlled pilot audit scope summary',
  );
  if (
    !sameOrderedStrings(value.card_ids, contentCardIds) ||
    value.card_count !== 120 ||
    value.issue_count !== 120
  ) {
    fail('controlled pilot audit summary does not match the 120-card scope.');
  }
  assertExactObjectKeys(
    value.by_severity,
    ['hard_blocker', 'content_risk', 'review_gap', 'source_risk'],
    'controlled pilot audit severity summary',
  );
  if (
    value.by_severity.hard_blocker !== 0 ||
    value.by_severity.content_risk !== 0 ||
    value.by_severity.review_gap !== 0 ||
    value.by_severity.source_risk !== 120
  ) {
    fail('controlled pilot audit contains unresolved or undisclosed findings.');
  }
  assertExactObjectKeys(
    value.by_rule,
    CARD_MAKE_QUALITY_RULES,
    'controlled pilot audit rule summary',
  );
  for (const rule of CARD_MAKE_QUALITY_RULES) {
    const expected = rule === 'synthetic_source' ? 120 : 0;
    if (value.by_rule[rule] !== expected) {
      fail(`controlled pilot audit rule ${rule} is not allowed.`);
    }
  }
}

function assertAuditCardIndex(value, content) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('controlled pilot audit card index must be an object.');
  }
  const cardsById = new Map(content.card_records.map(card => [card.card_id, card]));
  const canonicalCardIds = [...cardsById.keys()].sort((left, right) =>
    left.localeCompare(right),
  );
  if (!sameOrderedStrings(Object.keys(value), canonicalCardIds)) {
    fail('controlled pilot audit card index does not match the content payload.');
  }
  for (const cardId of canonicalCardIds) {
    const card = cardsById.get(cardId);
    const item = value[cardId];
    assertExactObjectKeys(
      item,
      [
        'file',
        'card_id',
        'track',
        'library',
        'group',
        'box',
        'box_prefix',
        'interaction_id',
        'issue_count',
        'by_severity',
        'by_rule',
      ],
      `controlled pilot audit card ${cardId}`,
    );
    assertExactObjectKeys(
      item.by_severity,
      ['hard_blocker', 'content_risk', 'review_gap', 'source_risk'],
      `controlled pilot audit card ${cardId} severity`,
    );
    assertExactObjectKeys(
      item.by_rule,
      ['synthetic_source'],
      `controlled pilot audit card ${cardId} rule`,
    );
    if (
      typeof item.file !== 'string' ||
      item.file.length === 0 ||
      item.card_id !== cardId ||
      item.track !== 'cet4' ||
      item.library !== card.space_metadata.library ||
      item.group !== card.space_metadata.group ||
      item.box !== card.space_metadata.box ||
      item.box_prefix !== card.knowledge_ref ||
      item.interaction_id !== card.interaction_id ||
      item.issue_count !== 1 ||
      item.by_severity.hard_blocker !== 0 ||
      item.by_severity.content_risk !== 0 ||
      item.by_severity.review_gap !== 0 ||
      item.by_severity.source_risk !== 1 ||
      item.by_rule.synthetic_source !== 1
    ) {
      fail(`controlled pilot audit card ${cardId} is invalid or unbound.`);
    }
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

function requireStringArray(value, label) {
  const values = requireArray(value, label);
  if (
    values.some(item => typeof item !== 'string' || item.trim().length === 0) ||
    new Set(values).size !== values.length
  ) {
    fail(`${label} must contain unique non-empty strings.`);
  }
  return values;
}

function uniqueByCardId(value, label) {
  const records = requireArray(value, label);
  const result = new Map();
  for (const item of records) {
    const cardId = item?.card_id;
    if (typeof cardId !== 'string' || !cardId.trim() || result.has(cardId)) {
      fail(`${label} must contain one uniquely identified record per card.`);
    }
    result.set(cardId, item);
  }
  return result;
}

function sameSet(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    new Set(left).size === left.length &&
    new Set(right).size === right.length &&
    left.every(value => right.includes(value))
  );
}

function sameOrderedStrings(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function digestJson(value) {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')}`;
}

function isCanonicalIsoTimestamp(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  ) {
    return false;
  }
  return Number.isFinite(Date.parse(value));
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
