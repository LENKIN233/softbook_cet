import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {deriveCardMakeContentVersion} from './card_make_runtime_payload.mjs';
import {parseStrictJson} from './strict_json.mjs';
import {verifyTrustedMediaRunReceipt} from '../verify_trusted_media_run_receipt.mjs';

const SHA256_ID_RE = /^sha256:[0-9a-f]{64}$/;
const CARD_ID_RE = /^[0-9]{6}$/;

export const CET4_FORMAL_CONTENT_EVIDENCE_TYPES = Object.freeze([
  'cet4-approved-box-coverage-report',
  'cet4-approved-card-coverage-report',
  'cet4-audio-qc-coverage-report',
  'cet4-content-pack-integrity-report',
]);

export const CET4_FORMAL_CONTENT_REQUIRED_CHECKS = Object.freeze({
  'cet4-approved-box-coverage-report': Object.freeze([
    'all-108-boxes-covered',
    'full-track-authorization-bound',
    'zero-unapproved-boxes',
  ]),
  'cet4-approved-card-coverage-report': Object.freeze([
    'all-1180-cards-covered',
    'full-track-authorization-bound',
    'zero-unapproved-cards',
  ]),
  'cet4-audio-qc-coverage-report': Object.freeze([
    'all-301-assets-covered',
    'all-27-qc-records-formally-ready',
    'trusted-media-receipt-attested',
    'asset-hashes-match-content-release',
  ]),
  'cet4-content-pack-integrity-report': Object.freeze([
    'content-version-recomputed',
    'bundle-inputs-rehashed',
    'authorization-review-audit-bound',
    'private-assets-hash-bound',
  ]),
});

const REQUIRED_SINGLE_ROLES = Object.freeze([
  'release-bundle',
  'content-payload',
  'content-authorization',
  'full-track-review',
  'quality-audit',
  'runtime-manifest',
  'audio-manifest',
  'audio-qc-index',
  'trusted-media-receipt',
  'trusted-media-attestation-bundle',
  'trusted-media-audio-manifest',
  'trusted-media-reviewed-worklist',
]);

export function loadCet4FormalContentEvidence(
  artifact,
  {
    root,
    trackedFiles,
    trustedMediaVerifier = verifyTrustedMediaIdentity,
  } = {},
) {
  const errors = [];
  const measurements = artifact?.measurements;
  if (!isObject(measurements)) {
    return {errors: ['CET4 formal content measurements must be an object.'], ok: false, evidence: null};
  }
  const rawArtifacts = Array.isArray(artifact?.raw_artifacts)
    ? artifact.raw_artifacts
    : [];
  const byRole = new Map(rawArtifacts.map(item => [item?.role, item]));
  const roleNames = {
    'release-bundle': measurements.release_bundle_role,
    'content-payload': measurements.content_payload_role,
    'content-authorization': measurements.authorization_role,
    'full-track-review': measurements.model_review_role,
    'quality-audit': measurements.quality_audit_role,
    'runtime-manifest': measurements.runtime_manifest_role,
    'audio-manifest': measurements.audio_manifest_role,
    'audio-qc-index': measurements.audio_qc_index_role,
    'trusted-media-receipt': measurements.trusted_media_receipt_role,
    'trusted-media-attestation-bundle': measurements.trusted_media_attestation_bundle_role,
    'trusted-media-audio-manifest': measurements.trusted_media_audio_manifest_role,
    'trusted-media-reviewed-worklist': measurements.trusted_media_reviewed_worklist_role,
  };
  for (const name of REQUIRED_SINGLE_ROLES) {
    if (typeof roleNames[name] !== 'string' || !byRole.has(roleNames[name])) {
      errors.push(`CET4 formal content ${name} role must resolve to one raw artifact.`);
    }
  }
  const runtimeShardRoles = requireRoleList(
    measurements.runtime_shard_roles,
    byRole,
    'runtime_shard_roles',
    3,
    errors,
  );
  const audioQcRecordRoles = requireRoleList(
    measurements.audio_qc_record_roles,
    byRole,
    'audio_qc_record_roles',
    27,
    errors,
  );
  if (errors.length > 0) return {errors, ok: false, evidence: null};

  const loadRole = (logicalName, {json = true} = {}) =>
    loadRawArtifact(byRole.get(roleNames[logicalName]), {
      json,
      label: `CET4 formal content ${logicalName}`,
      root,
      trackedFiles,
      errors,
    });
  const bundle = loadRole('release-bundle');
  const content = loadRole('content-payload');
  const authorization = loadRole('content-authorization');
  const review = loadRole('full-track-review');
  const audit = loadRole('quality-audit');
  const runtimeManifest = loadRole('runtime-manifest');
  const audioManifest = loadRole('audio-manifest');
  const audioQcIndex = loadRole('audio-qc-index');
  const receiptFile = loadRole('trusted-media-receipt');
  const attestationFile = loadRole('trusted-media-attestation-bundle', {json: false});
  const trustedAudioManifest = loadRole('trusted-media-audio-manifest');
  const trustedReviewedWorklist = loadRole('trusted-media-reviewed-worklist');
  const runtimeShards = runtimeShardRoles.map(role =>
    loadRawArtifact(byRole.get(role), {
      json: true,
      label: `CET4 formal content runtime shard ${role}`,
      root,
      trackedFiles,
      errors,
    }),
  );
  const audioQcRecords = audioQcRecordRoles.map(role =>
    loadRawArtifact(byRole.get(role), {
      json: true,
      label: `CET4 formal content audio QC ${role}`,
      root,
      trackedFiles,
      errors,
    }),
  );
  if (
    [
      bundle,
      content,
      authorization,
      review,
      audit,
      runtimeManifest,
      audioManifest,
      audioQcIndex,
      receiptFile,
      attestationFile,
      trustedAudioManifest,
      trustedReviewedWorklist,
      ...runtimeShards,
      ...audioQcRecords,
    ].some(value => value === null)
  ) {
    return {errors, ok: false, evidence: null};
  }

  validateCounts(measurements, errors);
  const runtime = validateRuntime(runtimeManifest, runtimeShards, errors);
  validateContent(content.json, runtime, errors);
  validateAuthorization(authorization, review, audit, runtime, errors);
  validateBundle(
    bundle,
    {authorization, review, audit, content, audioManifest, audioQcIndex, runtime},
    artifact?.subject,
    errors,
  );
  const audio = validateAudio(
    audioManifest.json,
    audioQcIndex.json,
    audioQcRecords,
    content.json,
    errors,
  );
  validateReceiptBindings(
    receiptFile,
    attestationFile,
    {
      audio,
      content: content.json,
      trustedAudioManifest,
      trustedReviewedWorklist,
    },
    measurements,
    trustedMediaVerifier,
    errors,
  );

  return {
    errors,
    ok: errors.length === 0,
    evidence: errors.length === 0
      ? {
          audio_asset_count: audio.assetIds.size,
          audio_qc_record_count: audioQcRecords.length,
          box_count: runtime.boxIds.size,
          card_count: runtime.cardIds.size,
          content_version: runtime.contentVersion,
          source_commit_sha: measurements.source_commit_sha,
        }
      : null,
  };
}

function verifyTrustedMediaIdentity({attestationPath, receiptPath}) {
  return verifyTrustedMediaRunReceipt({
    bundlePath: attestationPath,
    receiptPath,
    requireArtifactEvidence: false,
    verifyAttestation: true,
  });
}

function validateCounts(value, errors) {
  for (const [field, expected] of [
    ['card_count', 1180],
    ['box_count', 108],
    ['audio_asset_count', 301],
    ['audio_qc_record_count', 27],
  ]) {
    if (value[field] !== expected) errors.push(`CET4 formal content ${field} must be ${expected}.`);
  }
  if (value.source_repository !== 'LENKIN233/card-make') {
    errors.push('CET4 formal content source_repository must be LENKIN233/card-make.');
  }
  if (!/^[0-9a-f]{40}$/.test(value.source_commit_sha ?? '')) {
    errors.push('CET4 formal content source_commit_sha must be a full commit SHA.');
  }
}

function validateRuntime(manifestFile, shards, errors) {
  const manifest = manifestFile.json;
  const cardRecords = [];
  if (
    manifest?.schema_version !== 'card-make-runtime-payload-manifest.v1' ||
    manifest.track !== 'cet4' ||
    !Array.isArray(manifest.card_record_shards) ||
    manifest.card_record_shards.length !== 3 ||
    !Array.isArray(manifest.assets) ||
    manifest.assets.length !== 301
  ) {
    errors.push('CET4 runtime manifest must contain the exact three-shard 301-asset scope.');
    return emptyRuntime();
  }
  for (const [index, descriptor] of manifest.card_record_shards.entries()) {
    const shard = shards[index];
    if (
      shard?.json?.schema_version !== 'card-make-runtime-card-shard.v1' ||
      shard.json.track !== 'cet4' ||
      shard.sha256 !== stripSha(descriptor.sha256) ||
      !Array.isArray(shard.json.card_records) ||
      shard.json.card_records.length !== descriptor.card_count ||
      shard.json.card_records[0]?.card_id !== descriptor.first_card_id ||
      shard.json.card_records.at(-1)?.card_id !== descriptor.last_card_id
    ) {
      errors.push(`CET4 runtime shard ${index + 1} does not match its manifest descriptor.`);
      continue;
    }
    cardRecords.push(...shard.json.card_records);
  }
  const payload = {
    source: manifest.source,
    track: manifest.track,
    card_records: cardRecords,
    assets: manifest.assets,
    release: manifest.release,
    content_version: manifest.content_version,
  };
  const contentVersion = deriveCardMakeContentVersion(payload);
  if (contentVersion !== manifest.content_version) {
    errors.push('CET4 runtime content_version does not match reconstructed shard bytes.');
  }
  const cardIds = uniqueIds(cardRecords.map(card => card?.card_id), CARD_ID_RE, 'runtime card', errors);
  const boxIds = uniqueIds(
    cardRecords.map(card =>
      typeof card?.knowledge_ref === 'string'
        ? card.knowledge_ref
        : card?.knowledge_ref?.box_prefix,
    ),
    /^[0-9]{4}$/,
    'runtime box',
    errors,
    {allowDuplicates: true},
  );
  const assetIds = uniqueIds(
    manifest.assets.map(asset => asset?.asset_id),
    /^cet4-[0-9]{6}-audio$/,
    'runtime audio asset',
    errors,
  );
  if (cardIds.size !== 1180 || boxIds.size !== 108 || assetIds.size !== 301) {
    errors.push('CET4 runtime must reconstruct exactly 1180 cards, 108 boxes and 301 audio assets.');
  }
  return {
    assetIds,
    boxIds,
    cardIds,
    contentVersion,
    manifestSha256: manifestFile.sha256,
    payload,
  };
}

function validateContent(content, runtime, errors) {
  if (
    content?.track !== 'cet4' ||
    content.content_version !== runtime.contentVersion ||
    !Array.isArray(content.card_records) ||
    content.card_records.length !== 1180 ||
    !Array.isArray(content.assets) ||
    content.assets.length !== 301
  ) {
    errors.push('CET4 content payload must match the reconstructed 1180-card/301-asset runtime version.');
    return;
  }
  if (stableJson(content.card_records) !== stableJson(runtime.payload.card_records)) {
    errors.push('CET4 content payload card bytes do not match the reconstructed runtime shards.');
  }
  if (stableJson(content.assets) !== stableJson(runtime.payload.assets)) {
    errors.push('CET4 content payload assets do not match the reconstructed runtime manifest.');
  }
}

function validateAuthorization(authorization, review, audit, runtime, errors) {
  const value = authorization.json;
  const acceptances = value?.model_acceptances;
  if (
    value?.schema_version !== 'model-owned-content-authorization.v2' ||
    value.authorization_mode !== 'full_track' ||
    value.content_version !== runtime.contentVersion ||
    value.scope?.track !== 'cet4' ||
    !Array.isArray(value.scope?.card_ids) ||
    !Array.isArray(value.scope?.box_prefixes) ||
    value.scope.card_ids.length !== 1180 ||
    value.scope.box_prefixes.length !== 108 ||
    !twoAcceptedPerturbations(acceptances, ['content_authorization'])
  ) {
    errors.push('CET4 content authorization must be exact-scope full-track dual-perturbation model acceptance.');
  }
  if (!sameSet(value?.scope?.card_ids, runtime.cardIds) || !sameSet(value?.scope?.box_prefixes, runtime.boxIds)) {
    errors.push('CET4 content authorization scope does not match reconstructed runtime cards and boxes.');
  }
  if (
    stripSha(value?.card_quality_audit?.report_sha256) !== audit.sha256 ||
    value?.card_quality_audit?.scope_has_no_hard_blockers !== true ||
    stripSha(value?.validation?.model_review_sha256) !== review.sha256 ||
    stripSha(value?.validation?.runtime_payload_sha256) !== runtime.manifestSha256
  ) {
    errors.push('CET4 authorization does not bind the imported review and zero-blocker audit bytes.');
  }
  if (
    review.json?.schema_version !== 'model-owned-full-track-review.v2' ||
    review.json?.scope?.track !== 'cet4' ||
    review.json?.coverage?.expected_card_count !== 1180 ||
    !Array.isArray(review.json?.coverage?.reviewed_card_ids) ||
    review.json.coverage.reviewed_card_ids.length !== 1180 ||
    !twoAcceptedPerturbations(review.json?.model_acceptances, [
      'card_semantic_review',
      'source_provenance_review',
    ]) ||
    review.json?.batch_review?.status !== 'ready_for_model_authorization'
  ) {
    errors.push('CET4 full-track review is not an exact 1180-card dual-perturbation acceptance.');
  }
  if (
    audit.json?.audit_version !== 'card-make-quality-audit-v1' ||
    audit.json?.report_type !== 'scoped_card_quality_audit' ||
    audit.json?.ok !== true ||
    audit.json?.scope_summary?.card_count !== 1180 ||
    !Array.isArray(audit.json?.scoped_hard_blocker_issues) ||
    audit.json.scoped_hard_blocker_issues.length !== 0
  ) {
    errors.push('CET4 quality audit must cover 1180 cards with zero hard blockers.');
  }
}

function validateBundle(bundleFile, files, subject, errors) {
  const bundle = bundleFile.json;
  if (
    bundle?.schema_version !== 'release-bundle.v1' ||
    bundle.track !== 'cet4' ||
    bundle.content?.card_count !== 1180 ||
    bundle.audio?.asset_count !== 301 ||
    bundle.audio?.qc_passed_count !== 301 ||
    bundle.content?.content_version !== files.runtime.contentVersion
  ) {
    errors.push('CET4 release bundle does not bind the exact formal content scope.');
  }
  for (const [actual, expected, label] of [
    [files.content.sha256, stripSha(bundle?.content?.payload_sha256), 'content payload'],
    [files.authorization.sha256, stripSha(bundle?.approval?.record_sha256), 'authorization'],
    [files.review.sha256, stripSha(bundle?.approval?.model_review_sha256), 'model review'],
    [files.audit.sha256, stripSha(bundle?.audit?.report_sha256), 'quality audit'],
    [files.audioManifest.sha256, stripSha(bundle?.audio?.manifest_sha256), 'audio manifest'],
    [files.audioQcIndex.sha256, stripSha(bundle?.audio?.qc_index_sha256), 'audio QC index'],
  ]) {
    if (actual !== expected) errors.push(`CET4 release bundle ${label} SHA-256 does not match imported bytes.`);
  }
  if (
    subject?.release?.content_version !== bundle?.content?.content_version ||
    subject?.release?.bundle_sha256 !== bundleFile.sha256
  ) {
    errors.push('CET4 release bundle does not match the closed-beta candidate release binding.');
  }
}

function validateAudio(manifest, index, records, content, errors) {
  if (
    manifest?.schema_version !== 'release-audio-manifest.v1' ||
    manifest.track !== 'cet4' ||
    !Array.isArray(manifest.assets) ||
    manifest.assets.length !== 301 ||
    index?.schema_version !== 'audio-qc-index.v1' ||
    index.track !== 'cet4' ||
    !Array.isArray(index.assets) ||
    index.assets.length !== 301
  ) {
    errors.push('CET4 audio manifest and QC index must each cover exactly 301 assets.');
    return {assetIds: new Set()};
  }
  const assets = new Map(manifest.assets.map(asset => [asset.asset_id, asset]));
  const contentAssets = new Map((content.assets ?? []).map(asset => [asset.asset_id, asset]));
  const recordBySha = new Map(records.map(record => [record.sha256, record.json]));
  for (const record of records) {
    validateFormalAudioQcRecord(record.json, assets, errors);
  }
  const coveredCards = new Set();
  const usedRecordHashes = new Set();
  for (const entry of index.assets) {
    const asset = assets.get(entry?.asset_id);
    const contentAsset = contentAssets.get(entry?.asset_id);
    const record = recordBySha.get(stripSha(entry?.record_sha256));
    if (
      !asset ||
      !contentAsset ||
      entry.formal_audio_ready !== true ||
      !record ||
      record.schema_version !== 'model-owned-audio-qc.v2' ||
      record.verdict?.formal_audio_ready !== true ||
      record.verdict?.requires_regeneration !== false ||
      record.source_records?.trusted_media_receipt_sha256 == null ||
      asset.sha256 !== contentAsset.sha256 ||
      asset.size_bytes !== contentAsset.size_bytes ||
      asset.duration_ms !== contentAsset.duration_ms
    ) {
      errors.push(`CET4 audio asset ${String(entry?.asset_id)} lacks a matching formal QC/content binding.`);
      continue;
    }
    usedRecordHashes.add(stripSha(entry.record_sha256));
    for (const cardId of entry.card_ids ?? []) coveredCards.add(cardId);
  }
  if (
    assets.size !== 301 ||
    contentAssets.size !== 301 ||
    coveredCards.size !== 301 ||
    recordBySha.size !== 27 ||
    usedRecordHashes.size !== 27
  ) {
    errors.push('CET4 audio evidence must cover 301 unique cards with 27 distinct formal QC records.');
  }
  return {assetIds: new Set(assets.keys()), assets: manifest.assets, records};
}

function validateFormalAudioQcRecord(record, releaseAssets, errors) {
  const cardIds = uniqueIds(
    record?.scope?.card_ids ?? [],
    CARD_ID_RE,
    'audio QC card',
    errors,
  );
  const generatedByCard = new Map(
    (record?.generated_assets ?? []).map(asset => [String(asset?.card_id), asset]),
  );
  const qcByCard = new Map(
    (record?.per_card_qc ?? []).map(entry => [String(entry?.card_id), entry]),
  );
  const qaChecks = record?.qa_checks;
  if (
    record?.schema_version !== 'model-owned-audio-qc.v2' ||
    record.verdict?.formal_audio_ready !== true ||
    record.verdict?.requires_regeneration !== false ||
    !twoAcceptedPerturbations(record.model_acceptances, ['audio_perceptual_review']) ||
    cardIds.size === 0 ||
    generatedByCard.size !== cardIds.size ||
    qcByCard.size !== cardIds.size ||
    !isObject(qaChecks) ||
    Object.values(qaChecks).some(value => value !== true)
  ) {
    errors.push(`CET4 audio QC record ${String(record?.audio_qc_id)} is not formally ready.`);
    return;
  }
  for (const cardId of cardIds) {
    const generated = generatedByCard.get(cardId);
    const qc = qcByCard.get(cardId);
    const releaseAsset = releaseAssets.get(`cet4-${cardId}-audio`);
    if (
      generated?.path !== `ai_tts/cet4/${cardId.slice(0, 4)}/${cardId}.mp3` ||
      generated?.file_sha256 !== stripSha(releaseAsset?.sha256) ||
      qc?.asset_path !== generated.path ||
      qc?.complete_asset_consumed !== true ||
      [
        'matches_text',
        'target_signal',
        'pronunciation',
        'speed',
        'rhythm',
        'stress_pauses',
        'no_noise',
      ].some(field => qc?.[field] !== true)
    ) {
      errors.push(`CET4 audio QC record does not bind the current asset for card ${cardId}.`);
    }
  }
}

function validateReceiptBindings(
  receiptFile,
  attestationFile,
  files,
  measurements,
  verifier,
  errors,
) {
  const receipt = receiptFile.json;
  if (
    receipt?.schema_version !== 'trusted-media-run-receipt.v2' ||
    receipt.candidate?.track !== 'cet4' ||
    receipt.candidate?.card_count !== 1180 ||
    receipt.candidate?.box_count !== 108 ||
    receipt.candidate?.audio_asset_count !== 301 ||
    receipt.finalization?.repository !== measurements.source_repository ||
    receipt.finalization?.commit_sha !== measurements.source_commit_sha
  ) {
    errors.push('CET4 trusted media receipt does not bind the exact media scope and producer commit.');
  }
  if (
    receipt.artifacts?.audio_manifest?.sha256 !== files.trustedAudioManifest.sha256 ||
    receipt.artifacts?.audio_manifest?.size_bytes !== files.trustedAudioManifest.bytes.length ||
    receipt.artifacts?.review_worklist?.sha256 !== files.trustedReviewedWorklist.sha256 ||
    receipt.artifacts?.review_worklist?.size_bytes !== files.trustedReviewedWorklist.bytes.length
  ) {
    errors.push('CET4 trusted media receipt does not bind the imported audio manifest and reviewed worklist bytes.');
  }
  validateTrustedAudioParity(
    files.trustedAudioManifest.json,
    files.trustedReviewedWorklist.json,
    files.audio,
    files.content,
    errors,
  );
  const receiptHashes = new Set(
    files.audio.records.map(record => record.json?.source_records?.trusted_media_receipt_sha256),
  );
  const attestationHashes = new Set(
    files.audio.records.map(record => record.json?.source_records?.trusted_media_attestation_bundle_sha256),
  );
  const sourceCommits = new Set(
    files.audio.records.map(record => record.json?.source_records?.trusted_media_source_commit),
  );
  if (
    receiptHashes.size !== 1 ||
    !receiptHashes.has(receiptFile.sha256) ||
    attestationHashes.size !== 1 ||
    !attestationHashes.has(attestationFile.sha256) ||
    sourceCommits.size !== 1 ||
    !sourceCommits.has(measurements.source_commit_sha)
  ) {
    errors.push('CET4 audio QC records do not share the imported trusted receipt and attestation bytes.');
  }
  const verification = verifier({
    attestationPath: attestationFile.path,
    receiptPath: receiptFile.path,
  });
  if (
    verification?.ok !== true ||
    verification?.identity_ready !== true ||
    (verification.source_commit_sha != null &&
      verification.source_commit_sha !== measurements.source_commit_sha)
  ) {
    errors.push(
      `CET4 trusted media receipt attestation is not verified: ${(
        verification?.errors ?? []
      ).join('; ')}`,
    );
  }
}

function validateTrustedAudioParity(
  trustedManifest,
  trustedWorklist,
  releaseAudio,
  content,
  errors,
) {
  if (
    trustedManifest?.schema_version !== 'trusted-media-audio-manifest.v1' ||
    trustedManifest.track !== 'cet4' ||
    trustedManifest.asset_count !== 301 ||
    !Array.isArray(trustedManifest.assets) ||
    trustedManifest.assets.length !== 301 ||
    trustedWorklist?.schema_version !== 'audio-perceptual-worklist.v3' ||
    trustedWorklist.track !== 'cet4' ||
    trustedWorklist.progress?.complete !== true ||
    trustedWorklist.progress?.passed !== 301 ||
    !Array.isArray(trustedWorklist.entries) ||
    trustedWorklist.entries.length !== 301
  ) {
    errors.push('CET4 trusted media inputs must contain the complete 301-asset manifest and reviewed worklist.');
    return;
  }
  const releaseById = new Map(
    (releaseAudio?.assets ?? []).map(asset => [asset.asset_id, asset]),
  );
  const contentByCard = new Map(
    (content?.card_records ?? []).map(card => [String(card?.card_id), card]),
  );
  const worklistByCard = new Map(
    trustedWorklist.entries.map(entry => [String(entry?.card_id), entry]),
  );
  const seenCards = new Set();
  for (const trustedAsset of trustedManifest.assets) {
    const cardId = String(trustedAsset?.card_id ?? '');
    const assetId = `cet4-${cardId}-audio`;
    const releaseAsset = releaseById.get(assetId);
    const card = contentByCard.get(cardId);
    const worklist = worklistByCard.get(cardId);
    const transcript = String(card?.audio?.transcript ?? '');
    const transcriptSha256 = createHash('sha256').update(transcript).digest('hex');
    if (
      !CARD_ID_RE.test(cardId) ||
      seenCards.has(cardId) ||
      trustedAsset.asset_path !== `ai_tts/cet4/${cardId.slice(0, 4)}/${cardId}.mp3` ||
      releaseAsset?.asset_path !== `audio/cet4/${cardId.slice(0, 4)}/${cardId}.mp3` ||
      releaseAsset?.sha256 !== `sha256:${trustedAsset.file_sha256}` ||
      releaseAsset?.size_bytes !== trustedAsset.size_bytes ||
      worklist?.audio?.file_sha256 !== trustedAsset.file_sha256 ||
      worklist?.audio?.size_bytes !== trustedAsset.size_bytes ||
      worklist?.audio?.asset_path !== trustedAsset.asset_path ||
      worklist?.audio?.transcript !== transcript ||
      worklist?.audio?.transcript_sha256 !== trustedAsset.transcript_sha256 ||
      createHash('sha256').update(String(worklist?.audio?.transcript ?? '')).digest('hex') !==
        trustedAsset.transcript_sha256 ||
      worklist?.audio?.declared_duration_ms !== releaseAsset?.duration_ms ||
      transcriptSha256 !== trustedAsset.transcript_sha256 ||
      card?.knowledge_ref !== worklist?.knowledge_ref?.box_prefix ||
      card?.front?.support !== worklist?.training_context?.main_training_goal ||
      worklist?.review?.status !== 'passed' ||
      worklist?.review?.complete_asset_consumed !== true
    ) {
      errors.push(`CET4 trusted media identity for card ${cardId} does not match the current content release.`);
      continue;
    }
    seenCards.add(cardId);
  }
  if (
    seenCards.size !== 301 ||
    releaseById.size !== 301 ||
    worklistByCard.size !== 301
  ) {
    errors.push('CET4 trusted media parity must cover 301 unique current release assets.');
  }
}

function loadRawArtifact(artifact, {json, label, root, trackedFiles, errors}) {
  const relative = String(artifact?.artifact_uri ?? '').slice('repo://'.length);
  if (!trackedFiles?.has(relative)) {
    errors.push(`${label} must be tracked by Git.`);
    return null;
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relative);
  const rootPrefix = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : `${resolvedRoot}${path.sep}`;
  if (!resolved.startsWith(rootPrefix)) {
    errors.push(`${label} escapes the repository root.`);
    return null;
  }
  const stat = fs.lstatSync(resolved, {throwIfNoEntry: false});
  if (!stat?.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 16 * 1024 * 1024) {
    errors.push(`${label} must be a bounded regular file.`);
    return null;
  }
  const bytes = fs.readFileSync(resolved);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== artifact.sha256 || bytes.length !== artifact.size_bytes) {
    errors.push(`${label} byte identity does not match its raw artifact record.`);
    return null;
  }
  try {
    return {
      bytes,
      json: json ? parseStrictJson(bytes, label) : null,
      path: resolved,
      sha256: digest,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return null;
  }
}

function requireRoleList(value, byRole, label, count, errors) {
  if (
    !Array.isArray(value) ||
    value.length !== count ||
    new Set(value).size !== count ||
    value.some(role => typeof role !== 'string' || !byRole.has(role))
  ) {
    errors.push(`CET4 formal content ${label} must name ${count} distinct raw artifact roles.`);
    return [];
  }
  return value;
}

function uniqueIds(values, pattern, label, errors, {allowDuplicates = false} = {}) {
  const result = new Set();
  for (const value of values) {
    if (
      typeof value !== 'string' ||
      !pattern.test(value) ||
      (!allowDuplicates && result.has(value))
    ) {
      errors.push(`${label} identity is invalid or duplicated.`);
      continue;
    }
    result.add(value);
  }
  return result;
}

function twoAcceptedPerturbations(value, requiredCapabilities) {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const inputs = new Set();
  const runs = new Set();
  for (const acceptance of value) {
    if (
      acceptance?.schema_version !== 'model-acceptance.v2' ||
      acceptance?.actor?.kind !== 'model_harness' ||
      acceptance.decision !== 'accepted' ||
      !Array.isArray(acceptance?.evidence?.capabilities) ||
      requiredCapabilities.some(
        capability => !acceptance.evidence.capabilities.includes(capability),
      ) ||
      !SHA256_ID_RE.test(acceptance.evidence.input_sha256 ?? '')
    ) return false;
    inputs.add(acceptance.evidence.input_sha256);
    runs.add(acceptance.actor.run_id);
  }
  return inputs.size === 1 && runs.size === 2;
}

function sameSet(values, expected) {
  return Array.isArray(values) && values.length === expected.size && values.every(value => expected.has(value));
}

function stripSha(value) {
  return typeof value === 'string' && value.startsWith('sha256:') ? value.slice(7) : value;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function emptyRuntime() {
  return {
    assetIds: new Set(),
    boxIds: new Set(),
    cardIds: new Set(),
    contentVersion: null,
    manifestSha256: null,
    payload: {assets: [], card_records: []},
  };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
