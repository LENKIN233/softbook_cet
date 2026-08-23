const assert = require('node:assert/strict');
const test = require('node:test');
const {resolve} = require('node:path');
const {pathToFileURL} = require('node:url');

const CHECKED_AT = '2026-08-14T08:30:00.000Z';
const PAYLOAD_SHA = `sha256:${'a'.repeat(64)}`;
const CONTENT_VERSION = `sha256:${'b'.repeat(64)}`;
let runner;

test.before(async () => {
  runner = await import(
    pathToFileURL(
      resolve(
        __dirname,
        '../../../../../scripts/run_audio_bundle_candidate_mobile_acceptance.mjs',
      ),
    )
  );
});

test('audio-bundle acceptance runner derives and reconstructs a safe report', () => {
  const expected = runner.summarizeCandidate(
    {
      assets: [{asset_id: 'audio-1'}, {asset_id: 'audio-2'}],
      card_records: [
        {card_id: '001201', interaction_id: 'multiple_choice'},
        {card_id: '001202', interaction_id: 'flip'},
      ],
      content_version: CONTENT_VERSION,
      track: 'cet4',
    },
    PAYLOAD_SHA,
    CHECKED_AT,
  );
  const report = safeReport();
  const normalized = runner.normalizeSafeMobileReport(
    structuredClone(report),
    expected,
  );

  assert.deepEqual(normalized, report);
  assert.notEqual(normalized, report);
  assert.notEqual(
    normalized.interaction_card_counts,
    report.interaction_card_counts,
  );
  assert.notEqual(
    normalized.representative_card_ids,
    report.representative_card_ids,
  );
});

test('audio-bundle acceptance runner rejects drifted or expanded reports', () => {
  const expected = {
    checkedAt: CHECKED_AT,
    candidatePayloadSha256: PAYLOAD_SHA,
    contentVersion: CONTENT_VERSION,
    track: 'cet4',
    cardCount: 2,
    audioAssetCount: 2,
    interactionCardCounts: {flip: 1, multiple_choice: 1},
    representativeCardIds: ['001202', '001201'],
  };
  const report = safeReport();

  for (const invalid of [
    {...structuredClone(report), leaked_card_body: 'must not pass'},
    {...structuredClone(report), card_count: 3},
    {
      ...structuredClone(report),
      interaction_card_counts: {flip: 1, multiple_choice: 1, swipe: 0},
    },
    {
      ...structuredClone(report),
      representative_card_ids: [...report.representative_card_ids].reverse(),
    },
    {...structuredClone(report), signed_manifest_verified: true},
    {...structuredClone(report), model_audio_qc_verified: true},
    replaceField(
      report,
      'model_audio_qc_verified',
      'human_audio_qc_verified',
      false,
    ),
    replaceField(
      report,
      'automated_real_device_evidence_verified',
      'real_device_verified',
      false,
    ),
  ]) {
    assert.throws(
      () => runner.normalizeSafeMobileReport(invalid, expected),
      runner.AudioBundleCandidateMobileAcceptanceError,
    );
  }
});

test('full-track acceptance runner derives and validates a safe report', () => {
  const expected = {
    checkedAt: CHECKED_AT,
    candidatePayloadSha256: PAYLOAD_SHA,
    contentVersion: CONTENT_VERSION,
    track: 'cet6',
    cardCount: 1234,
    audioAssetCount: 328,
    interactionCardCounts: {
      flip: 400,
      multiple_choice: 500,
      lock: 200,
      elimination: 80,
      swipe: 54,
    },
    representativeCardIds: ['100001', '100002', '100003', '100004', '100005'],
    representativeAudioCount: 2,
  };
  const report = fullTrackSafeReport();
  assert.deepEqual(
    runner.normalizeSafeFullTrackMobileReport(
      structuredClone(report),
      expected,
    ),
    report,
  );

  for (const invalid of [
    {...structuredClone(report), audio_card_count: 327},
    {...structuredClone(report), non_audio_card_count: 905},
    {...structuredClone(report), all_audio_cards_bound: false},
    {...structuredClone(report), representative_audio_controls_verified: 1},
    {...structuredClone(report), model_audio_qc_verified: true},
    replaceField(
      report,
      'model_audio_qc_verified',
      'human_audio_qc_verified',
      false,
    ),
    replaceField(
      report,
      'automated_real_device_evidence_verified',
      'real_device_verified',
      false,
    ),
  ]) {
    assert.throws(
      () => runner.normalizeSafeFullTrackMobileReport(invalid, expected),
      runner.AudioBundleCandidateMobileAcceptanceError,
    );
  }
});

function safeReport() {
  return {
    schema_version: 'audio-bundle-candidate-mobile-learning-smoke.v1',
    checked_at: CHECKED_AT,
    candidate_payload_sha256: PAYLOAD_SHA,
    content_version: CONTENT_VERSION,
    track: 'cet4',
    card_count: 2,
    audio_asset_count: 2,
    interaction_card_counts: {flip: 1, multiple_choice: 1},
    all_cards_parseable: true,
    all_cards_audio_bound: true,
    all_cards_learning_completable: true,
    representative_card_ids: ['001202', '001201'],
    representative_ui_completions_verified: 2,
    representative_audio_controls_verified: 2,
    simulated_manifest_binding_verified: true,
    visible_runtime_metadata_leak_guard_verified: true,
    signed_manifest_verified: false,
    model_audio_qc_verified: false,
    persistent_receiver_verified: false,
    automated_real_device_evidence_verified: false,
    gate_eligible: false,
  };
}

function fullTrackSafeReport() {
  return {
    schema_version: 'full-track-candidate-mobile-learning-smoke.v1',
    checked_at: CHECKED_AT,
    candidate_payload_sha256: PAYLOAD_SHA,
    content_version: CONTENT_VERSION,
    track: 'cet6',
    card_count: 1234,
    audio_card_count: 328,
    audio_asset_count: 328,
    non_audio_card_count: 906,
    interaction_card_counts: {
      flip: 400,
      multiple_choice: 500,
      lock: 200,
      elimination: 80,
      swipe: 54,
    },
    all_cards_parseable: true,
    all_audio_cards_bound: true,
    all_cards_learning_completable: true,
    representative_card_ids: ['100001', '100002', '100003', '100004', '100005'],
    representative_ui_completions_verified: 5,
    representative_audio_controls_verified: 2,
    simulated_manifest_binding_verified: true,
    visible_runtime_metadata_leak_guard_verified: true,
    signed_manifest_verified: false,
    model_audio_qc_verified: false,
    persistent_receiver_verified: false,
    automated_real_device_evidence_verified: false,
    gate_eligible: false,
  };
}

function replaceField(value, currentKey, legacyKey, replacement) {
  const copy = structuredClone(value);
  delete copy[currentKey];
  copy[legacyKey] = replacement;
  return copy;
}
