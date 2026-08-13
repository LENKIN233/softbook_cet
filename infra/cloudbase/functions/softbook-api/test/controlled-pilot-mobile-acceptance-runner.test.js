const assert = require("node:assert/strict");
const test = require("node:test");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");

const CHECKED_AT = "2026-08-13T03:30:00.000Z";
let runner;

test.before(async () => {
  runner = await import(
    pathToFileURL(
      resolve(
        __dirname,
        "../../../../../scripts/run_controlled_pilot_mobile_acceptance.mjs"
      )
    )
  );
});

test("product acceptance runner accepts and reconstructs exact safe reports", () => {
  const backend = backendReport();
  const mobile = mobileReport();
  const normalizedBackend = runner.normalizeSafeBackendReport(
    clone(backend),
    CHECKED_AT
  );
  const normalizedMobile = runner.normalizeSafeMobileReport(
    clone(mobile),
    CHECKED_AT
  );

  assert.deepEqual(normalizedBackend, backend);
  assert.deepEqual(normalizedMobile, mobile);
  assert.notEqual(normalizedBackend, backend);
  assert.notEqual(
    normalizedBackend.completed_card_ids,
    backend.completed_card_ids
  );
  assert.notEqual(normalizedMobile, mobile);
  assert.notEqual(
    normalizedMobile.interaction_card_counts,
    mobile.interaction_card_counts
  );
  assert.notEqual(
    normalizedMobile.representative_card_ids,
    mobile.representative_card_ids
  );
});

test("product acceptance runner rejects unknown or drifted report data", () => {
  const backend = backendReport();
  const mobile = mobileReport();
  for (const invalidReport of [
    { ...clone(backend), leaked_card_body: "must never be forwarded" },
    { ...clone(backend), resumed_card_id: "000001" },
    {
      ...clone(backend),
      completed_card_ids: [...backend.completed_card_ids].reverse(),
    },
  ]) {
    assert.throws(
      () => runner.normalizeSafeBackendReport(invalidReport, CHECKED_AT),
      runner.ControlledPilotMobileAcceptanceError
    );
  }
  for (const invalidReport of [
    { ...clone(mobile), leaked_card_body: "must never be forwarded" },
    {
      ...clone(mobile),
      interaction_card_counts: { ...mobile.interaction_card_counts, flip: 21 },
    },
    {
      ...clone(mobile),
      interaction_card_counts: {
        ...mobile.interaction_card_counts,
        unexpected: 1,
      },
    },
    {
      ...clone(mobile),
      representative_card_ids: [...mobile.representative_card_ids].reverse(),
    },
    { ...clone(mobile), flip_card_count: 21 },
  ]) {
    assert.throws(
      () => runner.normalizeSafeMobileReport(invalidReport, CHECKED_AT),
      runner.ControlledPilotMobileAcceptanceError
    );
  }
});

function clone(value) {
  return structuredClone(value);
}

function backendReport() {
  return {
    schema_version: "controlled-pilot-candidate-runtime-smoke.v1",
    checked_at: CHECKED_AT,
    content_version:
      "sha256:dd2d397532556563a205351f04f98184afc09a4cd6a2580966556052ffc24f36",
    candidate_payload_sha256:
      "sha256:5f75b4ddd2e3462854d9c5dbdf9543178993356d150e23910966375fbb9feea3",
    approval_status: "approved",
    audit_status: "passed_with_disclosed_synthetic_source_risk",
    card_count: 120,
    audio_asset_count: 24,
    completed_card_ids: ["000001", "001001", "011301", "012101", "020201"],
    review_card_ids: ["001001", "012101"],
    round_completion_verified: true,
    round_continuation_verified: true,
    resumed_card_id: "022001",
    content_manifest_signature_verified: true,
    membership_v2_verified: true,
    human_audio_qc_verified: false,
    persistent_receiver_verified: false,
    real_device_verified: false,
    gate_eligible: false,
  };
}

function mobileReport() {
  return {
    schema_version: "controlled-pilot-mobile-acceptance-smoke.v1",
    checked_at: CHECKED_AT,
    candidate_payload_sha256:
      "sha256:5f75b4ddd2e3462854d9c5dbdf9543178993356d150e23910966375fbb9feea3",
    content_version:
      "sha256:dd2d397532556563a205351f04f98184afc09a4cd6a2580966556052ffc24f36",
    card_count: 120,
    audio_asset_count: 24,
    interaction_card_counts: {
      elimination: 10,
      flip: 22,
      lock: 17,
      multiple_choice: 59,
      swipe: 12,
    },
    all_cards_parseable: true,
    auto_scored_card_count: 98,
    auto_scored_cards_canonical_answer_evaluable: true,
    flip_card_count: 22,
    flip_cards_self_assessment_completable: true,
    representative_card_ids: ["001004", "000001", "020203", "011303", "011304"],
    representative_repository_sessions_verified: 5,
    representative_ui_completions_verified: 5,
    representative_audio_controls_verified: 2,
    pilot_manifest_exact_shape_verified: true,
    ephemeral_manifest_signature_verified_by_mobile: true,
    pilot_bootstrap_content_exact_shape_verified: true,
    visible_runtime_metadata_leak_guard_verified: true,
    human_audio_qc_verified: false,
    persistent_receiver_verified: false,
    real_device_verified: false,
    installed_client_minimum_version_enforced: false,
    release_public_key_injection_verified: false,
    gate_eligible: false,
  };
}
