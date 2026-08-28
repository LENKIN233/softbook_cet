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
import {tmpdir} from 'node:os';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

import {verifyControlledPilotBundleDirectory} from '../infra/cloudbase/controlled-pilot-publisher-v1.mjs';
import {
  buildModelAcceptanceInputSha256,
  requireIndependentModelAcceptances,
} from './lib/model_acceptance_contract.mjs';

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
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  ) {
    fail(`${label} must be a complete ISO-8601 timestamp with a timezone.`);
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
  const sourcePathsByAssetId = new Map();
  const validatedRecords = new Set();
  const cardsByAsset = new Map();
  const cardsById = new Map(cards.map(card => [card.card_id, card]));
  const assetsById = new Map(assets.map(asset => [asset.asset_id, asset]));
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
        `Audio asset ${asset.asset_id} requires exactly one formal model-harness QC record; found ${matches.length}.`,
      );
    }
    const match = matches[0];
    if (!validatedRecords.has(match.path)) {
      const scopeCardIds = requireUniqueStrings(
        match.record.scope?.card_ids,
        null,
        `audio QC ${asset.asset_id} scope card IDs`,
      );
      const assetByCardId = new Map();
      for (const scopeCardId of scopeCardIds) {
        const card = cardsById.get(scopeCardId);
        const scopeAsset = assetsById.get(card?.audio?.asset_id);
        if (!card || !scopeAsset) {
          fail(`Audio QC record ${match.path} names an unknown or non-audio card ${scopeCardId}.`);
        }
        assetByCardId.set(scopeCardId, scopeAsset);
      }
      validateQcRecord(match.record, scopeCardIds, assetByCardId, asset.asset_id);
      validatedRecords.add(match.path);
    }
    const sourcePaths = [...new Set(
      cardIds.map(cardId =>
        match.record.generated_assets?.find(item =>
          String(item?.card_id ?? '') === cardId)?.path),
    )];
    if (
      sourcePaths.length !== 1 ||
      typeof sourcePaths[0] !== 'string' ||
      !sourcePaths[0].trim()
    ) {
      fail(`Audio QC record for ${asset.asset_id} must bind one exact source asset path.`);
    }
    sourcePathsByAssetId.set(asset.asset_id, sourcePaths[0]);
    const hash = sha256Bytes(match.bytes);
    const recordPath = `audio/qc/${hash.slice('sha256:'.length)}.json`;
    usedRecords.set(recordPath, match);
    bindings.push({
      asset_id: asset.asset_id,
      card_ids: [...cardIds],
      record_path: recordPath,
      record_sha256: hash,
      reviewed_by: match.record.model_acceptances[0].actor.agent,
      reviewed_at: normalizeEvidenceTimestamp(
        match.record.model_acceptances[0].evidence.reviewed_at,
        `audio QC ${asset.asset_id} reviewed_at`,
      ),
      formal_audio_ready: true,
    });
  }
  return {bindings, sourcePathsByAssetId, usedRecords};
}

export function assembleControlledPilotBundle(
  options,
  {verify = verifyControlledPilotBundleDirectory} = {},
) {
  const normalized = normalizeOptions(options);
  const profile = readJson(normalized.profilePath, 'controlled pilot profile');
  const pilotReviewBytes = readFileSync(normalized.pilotReviewPath);
  const pilotReview = JSON.parse(pilotReviewBytes.toString('utf8'));
  const approvalBytes = readFileSync(normalized.approvalPath);
  const approval = JSON.parse(approvalBytes.toString('utf8'));
  const auditBytes = readFileSync(normalized.auditPath);
  const audit = JSON.parse(auditBytes.toString('utf8'));
  const candidateBytes = readFileSync(normalized.candidatePayloadPath);
  const candidateHash = sha256Bytes(candidateBytes);
  const reviewHash = sha256Bytes(pilotReviewBytes);
  const auditHash = sha256Bytes(auditBytes);
  const expectedCandidateHash = pilotReview.source_records?.runtime_payload_sha256;
  if (candidateHash !== expectedCandidateHash) {
    fail('Candidate payload SHA-256 does not match the model-owned controlled-pilot review.');
  }
  const candidate = JSON.parse(candidateBytes.toString('utf8'));
  const corpusFingerprint = `sha256:${audit.corpus_fingerprint?.digest ?? ''}`;
  if (!/^sha256:[a-f0-9]{64}$/.test(corpusFingerprint)) {
    fail('Controlled-pilot audit does not contain a valid corpus fingerprint.');
  }
  const content = {...candidate, corpus_fingerprint: corpusFingerprint};
  const cards = requireArray(content.card_records, 'candidate card_records');
  const assets = requireArray(content.assets, 'candidate assets');
  validateModelOwnedPilotEvidence({
    approval,
    audit,
    auditHash,
    candidate,
    candidateHash,
    corpusFingerprint,
    pilotReview,
    profile,
    reviewHash,
  });
  const {bindings, sourcePathsByAssetId, usedRecords} = collectAudioQcBindings({
    assets,
    cards,
    qcDirectory: normalized.audioQcDirectory,
  });

  if (normalized.apply) mkdirSync(normalized.outputParent, {recursive: true});
  const stagingParent = normalized.apply ? normalized.outputParent : tmpdir();
  const staging = mkdtempSync(join(stagingParent, '.controlled-pilot-bundle-'));
  try {
    const contentPath = 'content/cet4-controlled-pilot.json';
    const approvalPath = 'approval/controlled-pilot-authorization.json';
    const reviewPath = 'approval/controlled-pilot-review.json';
    const auditPath = 'audit/controlled-pilot-audit.json';
    const manifestPath = 'audio/manifest.json';
    const qcIndexPath = 'audio/qc-index.json';
    const contentHash = writeJson(join(staging, contentPath), content);
    const approvalHash = copyBoundJson(normalized.approvalPath, join(staging, approvalPath));
    const copiedReviewHash = copyBoundJson(
      normalized.pilotReviewPath,
      join(staging, reviewPath),
    );
    const auditHash = copyBoundJson(normalized.auditPath, join(staging, auditPath));
    if (copiedReviewHash !== reviewHash) {
      fail('Controlled-pilot review changed while the bundle was assembled.');
    }

    const candidateRoot = dirname(normalized.candidatePayloadPath);
    for (const asset of assets) {
      const source = resolveInside(
        candidateRoot,
        sourcePathsByAssetId.get(asset.asset_id),
        'candidate audio asset',
      );
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
        review_path: reviewPath,
        review_sha256: copiedReviewHash,
        scope: 'controlled_pilot_120',
        status: 'approved',
        approved_at: normalizeEvidenceTimestamp(
          approval.authorized_at,
          'authorization authorized_at',
        ),
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

function validateModelOwnedPilotEvidence({
  approval,
  audit,
  auditHash,
  candidate,
  candidateHash,
  corpusFingerprint,
  pilotReview,
  profile,
  reviewHash,
}) {
  assertExactObjectKeys(
    pilotReview,
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
    'controlled-pilot model review',
  );
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
    'controlled-pilot model authorization',
  );
  assertExactObjectKeys(
    pilotReview.scope,
    ['track', 'purpose', 'card_count', 'box_prefixes', 'card_ids'],
    'controlled-pilot review scope',
  );
  assertExactObjectKeys(
    pilotReview.source_records,
    [
      'runtime_payload',
      'runtime_payload_sha256',
      'model_reviews',
      'scoped_audit',
      'scoped_audit_sha256',
    ],
    'controlled-pilot review source records',
  );
  assertExactObjectKeys(
    pilotReview.coverage,
    ['reviewed_cards', 'boxes'],
    'controlled-pilot review coverage',
  );
  assertExactObjectKeys(
    pilotReview.quality,
    [
      'corpus_fingerprint',
      'hard_blockers',
      'content_risks',
      'review_gaps',
      'source_risks',
      'synthetic_source_cards',
      'source_disclosure',
    ],
    'controlled-pilot review quality',
  );
  assertExactObjectKeys(
    pilotReview.authorization,
    ['model_acceptance', 'authorized_at', 'artifact_path'],
    'controlled-pilot review authorization',
  );
  assertExactObjectKeys(
    pilotReview.authorization_boundary,
    [
      'audio_qc_required_separately',
      'pilot_publication_required_separately',
      'external_facts_must_not_be_inferred',
      'gate_eligible',
    ],
    'controlled-pilot review authorization boundary',
  );
  const candidateCardIds = requireUniqueStrings(
    candidate.card_records?.map(card => card.card_id),
    120,
    'candidate card IDs',
  );
  const candidateBoxes = requireUniqueStrings(
    [...new Set(candidate.card_records?.map(card => cardBoxPrefix(card)))],
    14,
    'candidate box prefixes',
  );
  const reviewCardIds = requireUniqueStrings(
    pilotReview.scope?.card_ids,
    120,
    'controlled-pilot review card IDs',
  );
  const reviewBoxes = requireUniqueStrings(
    pilotReview.scope?.box_prefixes,
    14,
    'controlled-pilot review box prefixes',
  );
  const modelReviews = requireUniqueStrings(
    pilotReview.source_records?.model_reviews,
    null,
    'controlled-pilot model review records',
  );
  if (modelReviews.length === 0) {
    fail('Controlled-pilot review must identify at least one current model review.');
  }
  const coverageBoxes = requireArray(
    pilotReview.coverage?.boxes,
    'controlled-pilot review coverage boxes',
  );
  const coveredIds = [];
  const coveredPrefixes = [];
  for (const box of coverageBoxes) {
    assertExactObjectKeys(
      box,
      ['box_prefix', 'card_ids', 'status'],
      'controlled-pilot review coverage box',
    );
    if (box.status !== 'passed') {
      fail(`Controlled-pilot box ${box.box_prefix} is not passed.`);
    }
    coveredPrefixes.push(box.box_prefix);
    coveredIds.push(...requireUniqueStrings(
      box.card_ids,
      null,
      `controlled-pilot box ${box.box_prefix} card IDs`,
    ));
  }
  const quality = pilotReview.quality ?? {};
  const authorization = pilotReview.authorization ?? {};
  const boundary = pilotReview.authorization_boundary ?? {};
  if (
    pilotReview.schema_version !== 'controlled-pilot-review.v2' ||
    pilotReview.status !== 'ready_for_model_authorization' ||
    pilotReview.pilot_id !== profile.pilot_id ||
    pilotReview.content_version !== candidate.content_version ||
    pilotReview.scope?.track !== 'cet4' ||
    pilotReview.scope?.purpose !== 'controlled_pilot' ||
    pilotReview.scope?.card_count !== 120 ||
    pilotReview.source_records?.runtime_payload_sha256 !== candidateHash ||
    pilotReview.source_records?.scoped_audit_sha256 !== auditHash ||
    pilotReview.coverage?.reviewed_cards !== 120 ||
    quality.corpus_fingerprint !== corpusFingerprint ||
    quality.hard_blockers !== 0 ||
    quality.content_risks !== 0 ||
    quality.review_gaps !== 0 ||
    quality.source_risks !== 120 ||
    quality.synthetic_source_cards !== 120 ||
    quality.source_disclosure !== 'synthetic_training_content_not_true_exam' ||
    authorization.model_acceptance !== null ||
    authorization.authorized_at !== null ||
    authorization.artifact_path !== null ||
    boundary.audio_qc_required_separately !== true ||
    boundary.pilot_publication_required_separately !== true ||
    boundary.external_facts_must_not_be_inferred !== true ||
    boundary.gate_eligible !== false ||
    approval.schema_version !== 'controlled-pilot-authorization.v2' ||
    approval.pilot_id !== profile.pilot_id ||
    approval.content_version !== candidate.content_version ||
    approval.scope !== 'controlled_pilot_120' ||
    approval.status !== 'authorized' ||
    approval.review_sha256 !== reviewHash ||
    approval.runtime_payload_sha256 !== candidateHash ||
    approval.scoped_audit_sha256 !== auditHash ||
    typeof approval.review !== 'string' ||
    !isSafeRelativePath(approval.review)
  ) {
    fail('Candidate payload, model authorization, pilot review, audit, and receiver profile are not bound.');
  }
  normalizeEvidenceTimestamp(approval.authorized_at, 'authorization authorized_at');
  for (const [left, right, label] of [
    [candidateCardIds, reviewCardIds, 'candidate and review card scope'],
    [candidateCardIds, approval.card_ids, 'candidate and authorization card scope'],
    [candidateCardIds, audit.scope?.card_ids, 'candidate and audit card scope'],
    [candidateCardIds, coveredIds, 'candidate and coverage card scope'],
    [candidateBoxes, reviewBoxes, 'candidate and review box scope'],
    [candidateBoxes, coveredPrefixes, 'candidate and coverage box scope'],
  ]) {
    if (!sameSet(left, right)) fail(`${label} does not match exactly.`);
  }
  const expectedInput = buildModelAcceptanceInputSha256({
    decisionType: 'controlled_pilot_authorization',
    scope: pilotReview.scope,
    corpusFingerprint,
    auditSha256: auditHash,
    linkedReviewIdentity: {path: approval.review, sha256: reviewHash},
    additionalBindings: {
      pilot_id: approval.pilot_id,
      content_version: approval.content_version,
      runtime_payload_sha256: candidateHash,
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

function validateQcRecord(record, cardIds, assetByCardId, assetId) {
  if (
    record.schema_version !== 'model-owned-audio-qc.v2' ||
    record.verdict?.formal_audio_ready !== true ||
    record.verdict?.requires_regeneration !== false ||
    record.approval_boundary?.current_model_owned_content_authorization_required !== true ||
    record.approval_boundary?.external_facts_must_not_be_inferred !== true
  ) {
    fail(`Audio QC record for ${assetId} is not current model-owned evidence.`);
  }
  for (const check of REQUIRED_AUDIO_QC_CHECKS) {
    if (record.qa_checks?.[check] !== true) {
      fail(`Audio QC record for ${assetId} failed ${check}.`);
    }
  }
  const scopeIds = requireUniqueStrings(
    record.scope?.card_ids,
    cardIds.length,
    `audio QC ${assetId} scope card IDs`,
  );
  const transcripts = new Map(
    requireArray(record.text_gate?.transcripts, `audio QC ${assetId} transcripts`)
      .map(item => [String(item?.card_id ?? ''), item]),
  );
  const generated = new Map(
    requireArray(record.generated_assets, `audio QC ${assetId} generated assets`)
      .map(item => [String(item?.card_id ?? ''), item]),
  );
  const perCard = new Map(
    requireArray(record.per_card_qc, `audio QC ${assetId} per-card records`)
      .map(item => [String(item?.card_id ?? ''), item]),
  );
  if (
    !sameSet(scopeIds, cardIds) ||
    !sameSet([...transcripts.keys()], cardIds) ||
    !sameSet([...generated.keys()], cardIds) ||
    !sameSet([...perCard.keys()], cardIds)
  ) {
    fail(`Audio QC record for ${assetId} does not have exact card coverage.`);
  }
  const identities = [];
  for (const cardId of cardIds) {
    const asset = assetByCardId.get(cardId);
    const transcript = transcripts.get(cardId);
    const generatedAsset = generated.get(cardId);
    const result = perCard.get(cardId);
    const transcriptSha256 = createHash('sha256')
      .update(String(transcript?.transcript ?? ''), 'utf8')
      .digest('hex');
    if (
      !String(transcript?.transcript ?? '').trim() ||
      generatedAsset?.transcript_sha256 !== transcriptSha256 ||
      !asset ||
      generatedAsset?.file_sha256 !== asset.sha256.replace(/^sha256:/, '') ||
      result?.asset_path !== generatedAsset?.path
    ) {
      fail(`Audio QC record for ${assetId} has unbound bytes or transcript for ${cardId}.`);
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
        fail(`Audio QC record for ${assetId} failed per-card ${check} for ${cardId}.`);
      }
    }
    identities.push({
      card_id: cardId,
      path: generatedAsset.path,
      file_sha256: generatedAsset.file_sha256,
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
    fail(`Audio QC record for ${assetId} has no valid trusted media receipt binding.`);
  }
  const expectedInput = sha256Bytes(Buffer.from(JSON.stringify({
    assets: identities,
    trusted_media: trustedMedia,
  })));
  try {
    requireIndependentModelAcceptances(record.model_acceptances, {
      expectedInputSha256: expectedInput,
      label: `audio QC ${assetId}`,
      requiredCapabilities: ['audio_perceptual_review'],
    });
  } catch (error) {
    fail(error.message);
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

function requireUniqueStrings(value, expectedLength, label) {
  const values = requireArray(value, label);
  if (
    (expectedLength !== null && values.length !== expectedLength) ||
    values.some(item => typeof item !== 'string' || item.trim().length === 0) ||
    new Set(values).size !== values.length
  ) {
    fail(`${label} must contain the exact unique non-empty strings.`);
  }
  return [...values];
}

function assertExactObjectKeys(value, expected, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    fail(`${label} keys are not exact.`);
  }
}

function cardBoxPrefix(card) {
  const value = card?.knowledge_ref?.box_prefix ?? card?.knowledge_ref ?? card?.card_box_code;
  if (typeof value !== 'string' || !value.trim()) {
    fail(`Card ${card?.card_id ?? '<unknown>'} has no box prefix.`);
  }
  return value;
}

function sameSet(left, right) {
  return Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    new Set(left).size === left.length &&
    new Set(right).size === right.length &&
    left.every(value => right.includes(value));
}

function isSafeRelativePath(value) {
  return typeof value === 'string' &&
    value.length > 0 &&
    !value.startsWith('/') &&
    !value.includes('\\') &&
    !value.split('/').includes('..');
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
