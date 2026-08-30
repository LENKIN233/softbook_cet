#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

import {
  buildModelAcceptanceInputSha256,
  requireIndependentModelAcceptances,
} from '../../scripts/lib/model_acceptance_contract.mjs';
import {validateCardSourceCatalogMapping} from './card-source-catalog.mjs';

const require = createRequire(import.meta.url);
const {
  createMemoryStore,
  createSoftbookApi,
  validateCardSourceForImport,
  validateCardSourceForReleaseBundle,
} = require('./functions/softbook-api');
const {
  stableJsonStringify,
} = require('./functions/softbook-api/content-manifest-v1');

const EXPECTED_CARD_COUNT = 120;
const EXPECTED_FREE_CARD_COUNT = 60;
const EXPECTED_AUDIO_ASSET_COUNT = 24;
const TRACK = 'cet4';
const PHONE = '13800138000';
const SMS_CODE = '2468';
const DEVICE_ID = 'candidate_runtime_smoke_device';

export class ControlledPilotCandidateRuntimeSmokeError extends Error {}

export async function smokeControlledPilotCandidateRuntime(options) {
  if (
    options.captureMobileAcceptanceFixture !== undefined &&
    typeof options.captureMobileAcceptanceFixture !== 'function'
  ) {
    fail('captureMobileAcceptanceFixture must be a function when provided.');
  }
  const checkedAt = requireTimestamp(options.checkedAt, 'checkedAt');
  const candidateRecord = readJsonWithBytes(
    options.candidatePayloadPath,
    'candidate payload',
  );
  const reviewRecord = readJsonWithBytes(
    options.pilotReviewPath,
    'controlled-pilot review',
  );
  const approvalRecord = readJsonWithBytes(
    options.approvalPath,
    'controlled-pilot approval',
  );
  const auditRecord = readJsonWithBytes(
    options.auditPath,
    'controlled-pilot audit',
  );
  const candidateHash = sha256(candidateRecord.bytes);
  const reviewHash = sha256(reviewRecord.bytes);
  const auditHash = sha256(auditRecord.bytes);
  assertEvidenceBindings({
    approval: approvalRecord.value,
    audit: auditRecord.value,
    auditHash,
    candidate: candidateRecord.value,
    candidateHash,
    review: reviewRecord.value,
    reviewHash,
  });

  const candidate = validateCardSourceCatalogMapping(
    validateCardSourceForReleaseBundle(candidateRecord.value, TRACK),
  );
  const release = {
    schema_version: 'pilot-content-release.v1',
    release_id: 'candidate-runtime-smoke-release',
    profile_id: 'candidate-runtime-smoke-profile',
    pilot_id: approvalRecord.value.pilot_id,
    release_class: 'controlled_pilot',
    runtime_mode: 'controlled_pilot',
    track: TRACK,
    content_version: candidate.content_version,
    card_count: EXPECTED_CARD_COUNT,
    free_card_count: EXPECTED_FREE_CARD_COUNT,
    activated_at: new Date(checkedAt.getTime() - 60_000).toISOString(),
    expires_at: new Date(checkedAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    minimum_client_versions: {android: '1.0.0', ios: '1.0.0'},
    gate_eligible: false,
  };
  const runtimeSource = validateCardSourceCatalogMapping(
    validateCardSourceForImport(
      {
        ...candidate,
        assets: candidate.assets.map(asset => ({
          asset_id: asset.asset_id,
          duration_ms: asset.duration_ms,
          media_type: asset.media_type,
          sha256: asset.sha256,
          size_bytes: asset.size_bytes,
          storage_file_id: `cloud://candidate-runtime-smoke/${asset.asset_id}.mp3`,
        })),
        release,
      },
      TRACK,
    ),
  );

  const store = createMemoryStore();
  store.kind = 'candidate_runtime_smoke_persistent_adapter';
  store.snapshot().cardSources.set(TRACK, runtimeSource);
  const {privateKey, publicKey} = crypto.generateKeyPairSync('ed25519');
  let selectionCounter = 0;
  const api = createSoftbookApi({
    authV2CodeGenerator: () => SMS_CODE,
    authV2IndexSecret: 'candidate-runtime-smoke-index-secret-00000001',
    contentAssetUrlResolver: async ({asset}) =>
      `https://private.example.invalid/${encodeURIComponent(asset.asset_id)}.mp3`,
    contentManifestSigner: {
      keyId: 'candidate-runtime-smoke-key',
      privateKey,
    },
    learningSchedulerRandomBytes: size => {
      selectionCounter += 1;
      return Buffer.alloc(size, selectionCounter);
    },
    now: () => new Date(checkedAt),
    runtimeMode: 'controlled_pilot',
    smsProvider: {
      delivery: 'candidate_runtime_smoke',
      kind: 'candidate_runtime_smoke',
      sendCode: async () => undefined,
    },
    store,
    tokenSecret: 'candidate-runtime-smoke-token-secret-00000001',
  });
  const auth = await authenticate(api);
  const headers = {authorization: `Bearer ${auth.access_token}`};
  let cardSource = await expectOk(
    api,
    {headers, method: 'GET', path: '/v2/learning/card-source', query: {track: TRACK}},
    'v2 card source',
  );
  const trialAvailableCardCount = Math.ceil(EXPECTED_CARD_COUNT * 0.5);
  assert.equal(cardSource.card_records.length, trialAvailableCardCount);
  assert.equal(cardSource.content_version, candidate.content_version);
  assert.deepEqual(
    cardSource.card_records.map(card => card.card_id),
    approvalRecord.value.card_ids.slice(0, trialAvailableCardCount),
  );
  const trialAvailableCardIds = new Set(
    cardSource.card_records.map(card => card.card_id),
  );
  const entitlement = await expectOk(
    api,
    {headers, method: 'GET', path: '/v2/membership/entitlement'},
    'membership entitlement',
  );
  assert.equal(entitlement.entitlement.stage, 'trial_available');

  const completedCardIds = [];
  const reviewCardIds = [];
  let firstScheduled = null;
  for (let index = 0; index < 5; index += 1) {
    const scheduled = await expectOk(
      api,
      {headers, method: 'GET', path: '/v2/learning/session', query: {track: TRACK}},
      `learning session ${index + 1}`,
    );
    if (firstScheduled === null) firstScheduled = scheduled;
    assert.notEqual(scheduled.selection, null);
    if (index === 0) {
      assert.equal(
        trialAvailableCardIds.has(scheduled.selection.card_id),
        true,
      );
      cardSource = await expectOk(
        api,
        {
          headers,
          method: 'GET',
          path: '/v2/learning/card-source',
          query: {track: TRACK},
        },
        'v2 card source after Trial activation',
      );
      assert.equal(cardSource.card_records.length, EXPECTED_CARD_COUNT);
      assert.equal(
        sameStringSet(
          cardSource.card_records.map(card => card.card_id),
          approvalRecord.value.card_ids,
        ),
        true,
      );
    }
    assert.equal(scheduled.membership_stage, 'trial');
    assert.equal(scheduled.trial_started_at, checkedAt.toISOString());
    assert.equal(
      scheduled.trial_expires_at,
      new Date(checkedAt.getTime() + 120 * 60 * 60 * 1000).toISOString(),
    );
    assert.equal(scheduled.trial_remaining_seconds, 432000);
    const card = runtimeSource.card_records.find(
      record => record.card_id === scheduled.selection.card_id,
    );
    assert(card, 'scheduler selected a card outside the approved payload');
    const needsReview = index === 1 || index === 3;
    const outcome = needsReview
      ? card.interaction_id === 'flip'
        ? 'review'
        : 'incorrect'
      : card.interaction_id === 'flip'
        ? 'confident'
        : 'correct';
    const event = {
      event_id: `candidate_runtime_event_${String(index + 1).padStart(2, '0')}`,
      selection_id: scheduled.selection.selection_id,
      card_id: card.card_id,
      interaction_id: card.interaction_id,
      phase: scheduled.selection.phase,
      outcome,
      answer_grade: needsReview ? 'review_needed' : 'passed',
      used_hint: false,
      used_peek: false,
      client_occurred_at: checkedAt.toISOString(),
      content_version: candidate.content_version,
      device_cursor: {device_id: DEVICE_ID, sequence: index + 1},
    };
    const acknowledgement = await expectOk(
      api,
      {
        body: {schema_version: 'learning-events.v2', track: TRACK, events: [event]},
        headers,
        method: 'POST',
        path: '/v2/learning/events',
      },
      `learning event ${index + 1}`,
    );
    assert.equal(acknowledgement.results[0].status, 'accepted');
    completedCardIds.push(card.card_id);
    if (needsReview) reviewCardIds.push(card.card_id);
  }

  const paused = await expectOk(
    api,
    {headers, method: 'GET', path: '/v2/learning/session', query: {track: TRACK}},
    'five-card round completion',
  );
  assert.equal(paused.selection, null);
  assert.equal(paused.next_due_at, null);
  assert.equal(paused.round_completion.completed_count, 5);
  assert.equal(paused.round_completion.space_card_id, completedCardIds[4]);
  assert.deepEqual(paused.round_completion.review_card_ids, reviewCardIds);

  const continuation = await expectOk(
    api,
    {
      body: {
        schema_version: 'pilot-round-continue.v1',
        track: TRACK,
        content_version: candidate.content_version,
        receipt_id: paused.round_completion.receipt_id,
        completed_count: 5,
      },
      headers,
      method: 'POST',
      path: '/v2/learning/round/continue',
    },
    'round continuation',
  );
  assert.equal(continuation.schema_version, 'pilot-round-continue-ack.v1');
  const resumed = await expectOk(
    api,
    {headers, method: 'GET', path: '/v2/learning/session', query: {track: TRACK}},
    'resumed learning session',
  );
  assert.equal(resumed.selection.card_id, runtimeSource.card_records[5].card_id);

  const manifest = await expectOk(
    api,
    {
      headers,
      method: 'GET',
      path: '/v2/content/manifest',
      query: {content_version: candidate.content_version, track: TRACK},
    },
    'content manifest',
  );
  assert.equal(manifest.manifest.assets.length, EXPECTED_AUDIO_ASSET_COUNT);
  assert.equal(manifest.downloads.length, EXPECTED_AUDIO_ASSET_COUNT);
  assert.equal(manifest.access.accessible_card_count, EXPECTED_CARD_COUNT);
  assert.equal(manifest.manifest.gate_eligible, false);
  const signatureValid = crypto.verify(
    null,
    Buffer.from(
      stableJsonStringify({access: manifest.access, manifest: manifest.manifest}),
    ),
    publicKey,
    Buffer.from(manifest.signature.value, 'hex'),
  );
  assert.equal(signatureValid, true);

  const bootstrap = await expectOk(
    api,
    {
      headers,
      method: 'GET',
      path: '/v2/bootstrap',
      query: {day_key: chinaDayKey(checkedAt), track: TRACK},
    },
    'bootstrap after five cards',
  );
  assert.equal(bootstrap.content.version, candidate.content_version);
  assert.equal(bootstrap.content.card_count, EXPECTED_CARD_COUNT);
  assert.equal(bootstrap.progress.total_completed_count, 5);
  assert.equal(bootstrap.progress.pending_review_count, reviewCardIds.length);

  if (options.captureMobileAcceptanceFixture) {
    const publicKeyHex = publicKey
      .export({format: 'der', type: 'spki'})
      .subarray(-32)
      .toString('hex');
    await options.captureMobileAcceptanceFixture({
      schema_version: 'controlled-pilot-mobile-acceptance-fixture.v1',
      checked_at: checkedAt.toISOString(),
      candidate_payload_sha256: candidateHash,
      content_version: candidate.content_version,
      public_key: {
        algorithm: 'ed25519',
        key_id: 'candidate-runtime-smoke-key',
        value: publicKeyHex,
      },
      card_source: {data: cardSource},
      learning_session: {data: firstScheduled},
      content_manifest: {data: manifest},
      bootstrap: {data: bootstrap},
    });
  }

  return {
    schema_version: 'controlled-pilot-candidate-runtime-smoke.v1',
    checked_at: checkedAt.toISOString(),
    content_version: candidate.content_version,
    candidate_payload_sha256: candidateHash,
    authorization_status: 'authorized',
    audit_status: 'passed_with_disclosed_synthetic_source_risk',
    card_count: runtimeSource.card_records.length,
    audio_asset_count: runtimeSource.assets.length,
    completed_card_ids: completedCardIds,
    review_card_ids: reviewCardIds,
    round_completion_verified: true,
    round_continuation_verified: true,
    resumed_card_id: resumed.selection.card_id,
    content_manifest_signature_verified: true,
    membership_v2_verified: true,
    model_audio_qc_verified: false,
    persistent_receiver_verified: false,
    automated_real_device_evidence_verified: false,
    gate_eligible: false,
  };
}

function assertEvidenceBindings({
  approval,
  audit,
  auditHash,
  candidate,
  candidateHash,
  review,
  reviewHash,
}) {
  const candidateCardIds = candidate.card_records?.map(card => card.card_id);
  const candidateBoxes = [
    ...new Set(candidate.card_records?.map(card =>
      String(card.knowledge_ref?.box_prefix ?? card.knowledge_ref ?? card.card_box_code))),
  ];
  const coveredCardIds = (review.coverage?.boxes ?? []).flatMap(box => box.card_ids ?? []);
  const coveredBoxes = (review.coverage?.boxes ?? []).map(box => box.box_prefix);
  const hasUnexpectedAuditFinding = Object.entries(
    audit.scope_summary?.by_rule ?? {},
  ).some(([rule, count]) => rule !== 'synthetic_source' && count !== 0);
  if (
    review.schema_version !== 'controlled-pilot-review.v2' ||
    review.status !== 'ready_for_model_authorization' ||
    review.pilot_id !== approval.pilot_id ||
    review.scope?.track !== TRACK ||
    review.scope?.purpose !== 'controlled_pilot' ||
    review.scope?.card_count !== EXPECTED_CARD_COUNT ||
    review.source_records?.runtime_payload_sha256 !== candidateHash ||
    review.source_records?.scoped_audit_sha256 !== auditHash ||
    !Array.isArray(review.source_records?.model_reviews) ||
    review.source_records.model_reviews.length === 0 ||
    review.coverage?.reviewed_cards !== EXPECTED_CARD_COUNT ||
    review.coverage?.boxes?.length !== 14 ||
    review.coverage.boxes.some(box => box?.status !== 'passed') ||
    review.quality?.corpus_fingerprint !==
      `sha256:${audit.corpus_fingerprint?.digest ?? ''}` ||
    review.quality?.hard_blockers !== 0 ||
    review.quality?.content_risks !== 0 ||
    review.quality?.review_gaps !== 0 ||
    review.quality?.source_risks !== EXPECTED_CARD_COUNT ||
    review.quality?.synthetic_source_cards !== EXPECTED_CARD_COUNT ||
    review.authorization?.model_acceptance !== null ||
    review.authorization?.authorized_at !== null ||
    review.authorization?.artifact_path !== null ||
    review.authorization_boundary?.audio_qc_required_separately !== true ||
    review.authorization_boundary?.pilot_publication_required_separately !== true ||
    review.authorization_boundary?.external_facts_must_not_be_inferred !== true ||
    review.authorization_boundary?.gate_eligible !== false ||
    approval.schema_version !== 'controlled-pilot-authorization.v2' ||
    approval.status !== 'authorized' ||
    approval.scope !== 'controlled_pilot_120' ||
    approval.review_sha256 !== reviewHash ||
    approval.runtime_payload_sha256 !== candidateHash ||
    approval.scoped_audit_sha256 !== auditHash ||
    audit.audit_version !== 'card-make-quality-audit-v1' ||
    audit.report_type !== 'scoped_card_quality_audit' ||
    candidate.track !== TRACK ||
    candidate.content_version !== review.content_version ||
    candidate.content_version !== approval.content_version ||
    !Array.isArray(candidateCardIds) ||
    candidateCardIds.length !== EXPECTED_CARD_COUNT ||
    !sameStringSet(candidateCardIds, approval.card_ids) ||
    !sameStringSet(candidateCardIds, review.scope?.card_ids) ||
    !sameStringSet(candidateCardIds, coveredCardIds) ||
    !sameStringSet(candidateBoxes, review.scope?.box_prefixes) ||
    !sameStringSet(candidateBoxes, coveredBoxes) ||
    !sameStringSet(candidateCardIds, audit.scope?.card_ids) ||
    audit.scope?.missing_card_ids?.length !== 0 ||
    audit.scope_summary?.card_count !== EXPECTED_CARD_COUNT ||
    audit.scope_summary?.by_severity?.hard_blocker !== 0 ||
    audit.scope_summary?.by_severity?.content_risk !== 0 ||
    audit.scope_summary?.by_severity?.review_gap !== 0 ||
    audit.scope_summary?.by_severity?.source_risk !== EXPECTED_CARD_COUNT ||
    audit.scope_summary?.by_rule?.synthetic_source !== EXPECTED_CARD_COUNT ||
    audit.scope_summary?.by_rule?.unverified_source !== 0 ||
    hasUnexpectedAuditFinding ||
    candidate.assets?.length !== EXPECTED_AUDIO_ASSET_COUNT
  ) {
    fail('Candidate payload, model authorization, review, audit, or exact pilot scope is not bound.');
  }
  const expectedInput = buildModelAcceptanceInputSha256({
    decisionType: 'controlled_pilot_authorization',
    scope: review.scope,
    corpusFingerprint: review.quality.corpus_fingerprint,
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
      label: 'controlled-pilot candidate authorization',
      requiredCapabilities: ['content_authorization'],
    });
  } catch (error) {
    fail(error.message);
  }
}

async function authenticate(api) {
  const challenge = await expectOk(
    api,
    {
      body: {phone_number: PHONE},
      clientIp: '127.0.0.1',
      method: 'POST',
      path: '/v2/auth/request-code',
    },
    'request code',
  );
  return expectOk(
    api,
    {
      body: {challenge_id: challenge.challenge_id, phone_number: PHONE, sms_code: SMS_CODE},
      clientIp: '127.0.0.1',
      method: 'POST',
      path: '/v2/auth/verify-code',
    },
    'verify code',
  );
}

async function expectOk(api, input, label) {
  const response = await api.handleHttpRequest({
    body: input.body,
    clientIp: input.clientIp,
    headers: input.headers ?? {},
    method: input.method,
    path: input.path,
    query: input.query ?? {},
  });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    fail(`${label} failed: ${response.statusCode} ${JSON.stringify(response.body)}`);
  }
  return response.body?.data;
}

function readJsonWithBytes(path, label) {
  try {
    const bytes = readFileSync(resolve(path));
    return {bytes, value: JSON.parse(bytes.toString('utf8'))};
  } catch (error) {
    fail(`${label} is not valid readable JSON: ${error.message}`);
  }
}

function requireTimestamp(value, label) {
  const date = new Date(value);
  if (typeof value !== 'string' || !Number.isFinite(date.getTime())) {
    fail(`${label} must be a valid ISO timestamp.`);
  }
  return date;
}

function sha256(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function sameStringSet(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
    new Set(left).size === left.length && left.every(value => right.includes(value));
}

function chinaDayKey(date) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const parsed = {};
  const names = new Map([
    ['--candidate-payload', 'candidatePayloadPath'],
    ['--pilot-review', 'pilotReviewPath'],
    ['--approval', 'approvalPath'],
    ['--audit', 'auditPath'],
    ['--checked-at', 'checkedAt'],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const key = names.get(argv[index]);
    const value = argv[index + 1];
    if (!key || !value || value.startsWith('--')) fail(`Unknown or incomplete argument: ${argv[index]}`);
    parsed[key] = value;
    index += 1;
  }
  for (const key of names.values()) {
    if (!parsed[key]) fail(`Missing required option for ${key}.`);
  }
  return parsed;
}

function fail(message) {
  throw new ControlledPilotCandidateRuntimeSmokeError(message);
}

const isDirect = process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirect) {
  smokeControlledPilotCandidateRuntime(parseArgs(process.argv.slice(2)))
    .then(report => console.log(JSON.stringify(report, null, 2)))
    .catch(error => {
      console.error(`[controlled-pilot-candidate-runtime-smoke] ${error.message}`);
      process.exitCode = 1;
    });
}
