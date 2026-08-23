#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { smokeControlledPilotCandidateRuntime } from "../infra/cloudbase/smoke-controlled-pilot-candidate-runtime.mjs";

const EXPECTED_PAYLOAD_SHA256 =
  "sha256:5f75b4ddd2e3462854d9c5dbdf9543178993356d150e23910966375fbb9feea3";
const EXPECTED_CONTENT_VERSION =
  "sha256:dd2d397532556563a205351f04f98184afc09a4cd6a2580966556052ffc24f36";
const EXPECTED_INTERACTION_CARD_COUNTS = Object.freeze({
  elimination: 10,
  flip: 22,
  lock: 17,
  multiple_choice: 59,
  swipe: 12,
});
const EXPECTED_REPRESENTATIVE_CARD_IDS = Object.freeze([
  "001004",
  "000001",
  "020203",
  "011303",
  "011304",
]);
const EXPECTED_BACKEND_COMPLETED_CARD_IDS = Object.freeze([
  "000001",
  "001001",
  "011301",
  "012101",
  "020201",
]);
const EXPECTED_BACKEND_REVIEW_CARD_IDS = Object.freeze(["001001", "012101"]);
const SAFE_BACKEND_REPORT_KEYS = Object.freeze([
  "authorization_status",
  "audit_status",
  "audio_asset_count",
  "candidate_payload_sha256",
  "card_count",
  "checked_at",
  "completed_card_ids",
  "content_manifest_signature_verified",
  "content_version",
  "gate_eligible",
  "model_audio_qc_verified",
  "membership_v2_verified",
  "persistent_receiver_verified",
  "automated_real_device_evidence_verified",
  "resumed_card_id",
  "review_card_ids",
  "round_completion_verified",
  "round_continuation_verified",
  "schema_version",
]);
const SAFE_MOBILE_REPORT_KEYS = Object.freeze([
  "all_cards_parseable",
  "audio_asset_count",
  "auto_scored_card_count",
  "auto_scored_cards_canonical_answer_evaluable",
  "candidate_payload_sha256",
  "card_count",
  "checked_at",
  "content_version",
  "ephemeral_manifest_signature_verified_by_mobile",
  "flip_card_count",
  "flip_cards_self_assessment_completable",
  "gate_eligible",
  "model_audio_qc_verified",
  "installed_client_minimum_version_enforced",
  "interaction_card_counts",
  "persistent_receiver_verified",
  "pilot_bootstrap_content_exact_shape_verified",
  "pilot_manifest_exact_shape_verified",
  "automated_real_device_evidence_verified",
  "release_public_key_injection_verified",
  "representative_audio_controls_verified",
  "representative_card_ids",
  "representative_repository_sessions_verified",
  "representative_ui_completions_verified",
  "schema_version",
  "visible_runtime_metadata_leak_guard_verified",
]);
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = realpathSync(resolve(SCRIPT_DIRECTORY, ".."));
const MOBILE_ROOT = join(REPOSITORY_ROOT, "apps", "mobile");

export class ControlledPilotMobileAcceptanceError extends Error {}

export async function runControlledPilotMobileAcceptance(options) {
  const checkedAt = requireCanonicalTimestamp(
    options.checkedAt ?? new Date().toISOString(),
    "checkedAt"
  );
  const evidencePaths = {
    approvalPath: requireExternalRegularFile(options.approvalPath, "approval"),
    auditPath: requireExternalRegularFile(options.auditPath, "audit"),
    candidatePayloadPath: requireExternalRegularFile(
      options.candidatePayloadPath,
      "candidate payload"
    ),
    pilotReviewPath: requireExternalRegularFile(
      options.pilotReviewPath,
      "pilot review"
    ),
  };
  const initialStatus = readWorktreeStatus();
  const temporaryRoot = mkdtempSync(
    join(tmpdir(), "softbook-controlled-pilot-mobile-acceptance-")
  );
  chmodSync(temporaryRoot, 0o700);
  const fixturePath = join(temporaryRoot, "mobile-fixture.json");
  const reportPath = join(temporaryRoot, "mobile-report.json");

  try {
    const backendReport = await smokeControlledPilotCandidateRuntime({
      ...evidencePaths,
      checkedAt,
      captureMobileAcceptanceFixture: (fixture) => {
        writeFileSync(fixturePath, `${JSON.stringify(fixture)}\n`, {
          encoding: "utf8",
          mode: 0o600,
        });
      },
    });
    const safeBackendReport = normalizeSafeBackendReport(
      backendReport,
      checkedAt
    );

    const jestBinary = join(MOBILE_ROOT, "node_modules", ".bin", "jest");
    if (!isRegularFile(jestBinary)) {
      fail("Mobile dependencies are missing; run npm ci in apps/mobile first.");
    }
    const jest = spawnSync(
      jestBinary,
      [
        "--config",
        "jest.controlled-pilot-acceptance.config.js",
        "--runInBand",
        "--no-watchman",
      ],
      {
        cwd: MOBILE_ROOT,
        encoding: "utf8",
        env: {
          ...process.env,
          SOFTBOOK_CONTROLLED_PILOT_ACCEPTANCE_FIXTURE: fixturePath,
          SOFTBOOK_CONTROLLED_PILOT_ACCEPTANCE_REPORT: reportPath,
        },
      }
    );
    if (jest.error || jest.status !== 0) {
      fail(
        `Mobile acceptance Jest failed.${formatChildOutput(
          jest.stdout,
          jest.stderr
        )}`
      );
    }
    if (!isRegularFile(reportPath)) {
      fail("Mobile acceptance did not produce its safe report.");
    }
    const mobileReport = normalizeSafeMobileReport(
      JSON.parse(readFileSync(reportPath, "utf8")),
      checkedAt
    );

    return {
      schema_version: "controlled-pilot-product-learning-acceptance.v1",
      checked_at: checkedAt,
      candidate_payload_sha256: EXPECTED_PAYLOAD_SHA256,
      content_version: EXPECTED_CONTENT_VERSION,
      backend_runtime: safeBackendReport,
      mobile_acceptance: mobileReport,
      installed_client_minimum_version_enforced: false,
      model_audio_qc_verified: false,
      persistent_receiver_verified: false,
      automated_real_device_evidence_verified: false,
      release_public_key_injection_verified: false,
      gate_eligible: false,
    };
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
    const finalStatus = readWorktreeStatus();
    if (finalStatus !== initialStatus) {
      fail(
        "Controlled-pilot mobile acceptance changed the repository worktree."
      );
    }
  }
}

export function normalizeSafeBackendReport(report, checkedAt) {
  const valid =
    hasExactKeys(report, SAFE_BACKEND_REPORT_KEYS) &&
    report?.schema_version === "controlled-pilot-candidate-runtime-smoke.v1" &&
    report.checked_at === checkedAt &&
    report.candidate_payload_sha256 === EXPECTED_PAYLOAD_SHA256 &&
    report.content_version === EXPECTED_CONTENT_VERSION &&
    report.authorization_status === "authorized" &&
    report.audit_status === "passed_with_disclosed_synthetic_source_risk" &&
    report.card_count === 120 &&
    report.audio_asset_count === 24 &&
    hasExactOrderedValues(
      report.completed_card_ids,
      EXPECTED_BACKEND_COMPLETED_CARD_IDS
    ) &&
    hasExactOrderedValues(
      report.review_card_ids,
      EXPECTED_BACKEND_REVIEW_CARD_IDS
    ) &&
    report.round_completion_verified === true &&
    report.round_continuation_verified === true &&
    report.resumed_card_id === "022001" &&
    report.content_manifest_signature_verified === true &&
    report.membership_v2_verified === true &&
    report.model_audio_qc_verified === false &&
    report.persistent_receiver_verified === false &&
    report.automated_real_device_evidence_verified === false &&
    report.gate_eligible === false;
  if (!valid) fail("Backend smoke safe report is incomplete or invalid.");

  return {
    schema_version: report.schema_version,
    checked_at: report.checked_at,
    content_version: report.content_version,
    candidate_payload_sha256: report.candidate_payload_sha256,
    authorization_status: report.authorization_status,
    audit_status: report.audit_status,
    card_count: report.card_count,
    audio_asset_count: report.audio_asset_count,
    completed_card_ids: [...EXPECTED_BACKEND_COMPLETED_CARD_IDS],
    review_card_ids: [...EXPECTED_BACKEND_REVIEW_CARD_IDS],
    round_completion_verified: report.round_completion_verified,
    round_continuation_verified: report.round_continuation_verified,
    resumed_card_id: report.resumed_card_id,
    content_manifest_signature_verified:
      report.content_manifest_signature_verified,
    membership_v2_verified: report.membership_v2_verified,
    model_audio_qc_verified: report.model_audio_qc_verified,
    persistent_receiver_verified: report.persistent_receiver_verified,
    automated_real_device_evidence_verified:
      report.automated_real_device_evidence_verified,
    gate_eligible: report.gate_eligible,
  };
}

export function normalizeSafeMobileReport(report, checkedAt) {
  const valid =
    hasExactKeys(report, SAFE_MOBILE_REPORT_KEYS) &&
    report?.schema_version === "controlled-pilot-mobile-acceptance-smoke.v1" &&
    report.checked_at === checkedAt &&
    report.candidate_payload_sha256 === EXPECTED_PAYLOAD_SHA256 &&
    report.content_version === EXPECTED_CONTENT_VERSION &&
    report.card_count === 120 &&
    report.audio_asset_count === 24 &&
    hasExactKeys(
      report.interaction_card_counts,
      Object.keys(EXPECTED_INTERACTION_CARD_COUNTS)
    ) &&
    Object.entries(EXPECTED_INTERACTION_CARD_COUNTS).every(
      ([interactionId, count]) =>
        report.interaction_card_counts[interactionId] === count
    ) &&
    report.all_cards_parseable === true &&
    report.auto_scored_card_count === 98 &&
    report.auto_scored_cards_canonical_answer_evaluable === true &&
    report.flip_card_count === 22 &&
    report.flip_cards_self_assessment_completable === true &&
    Array.isArray(report.representative_card_ids) &&
    report.representative_card_ids.length ===
      EXPECTED_REPRESENTATIVE_CARD_IDS.length &&
    report.representative_card_ids.every(
      (cardId, index) => cardId === EXPECTED_REPRESENTATIVE_CARD_IDS[index]
    ) &&
    report.representative_repository_sessions_verified === 5 &&
    report.representative_ui_completions_verified === 5 &&
    report.representative_audio_controls_verified === 2 &&
    report.pilot_manifest_exact_shape_verified === true &&
    report.ephemeral_manifest_signature_verified_by_mobile === true &&
    report.pilot_bootstrap_content_exact_shape_verified === true &&
    report.visible_runtime_metadata_leak_guard_verified === true &&
    report.model_audio_qc_verified === false &&
    report.persistent_receiver_verified === false &&
    report.automated_real_device_evidence_verified === false &&
    report.installed_client_minimum_version_enforced === false &&
    report.release_public_key_injection_verified === false &&
    report.gate_eligible === false;
  if (!valid) fail("Mobile acceptance safe report is incomplete or invalid.");

  return {
    schema_version: report.schema_version,
    checked_at: report.checked_at,
    candidate_payload_sha256: report.candidate_payload_sha256,
    content_version: report.content_version,
    card_count: report.card_count,
    audio_asset_count: report.audio_asset_count,
    interaction_card_counts: { ...EXPECTED_INTERACTION_CARD_COUNTS },
    all_cards_parseable: report.all_cards_parseable,
    auto_scored_card_count: report.auto_scored_card_count,
    auto_scored_cards_canonical_answer_evaluable:
      report.auto_scored_cards_canonical_answer_evaluable,
    flip_card_count: report.flip_card_count,
    flip_cards_self_assessment_completable:
      report.flip_cards_self_assessment_completable,
    representative_card_ids: [...EXPECTED_REPRESENTATIVE_CARD_IDS],
    representative_repository_sessions_verified:
      report.representative_repository_sessions_verified,
    representative_ui_completions_verified:
      report.representative_ui_completions_verified,
    representative_audio_controls_verified:
      report.representative_audio_controls_verified,
    pilot_manifest_exact_shape_verified:
      report.pilot_manifest_exact_shape_verified,
    ephemeral_manifest_signature_verified_by_mobile:
      report.ephemeral_manifest_signature_verified_by_mobile,
    pilot_bootstrap_content_exact_shape_verified:
      report.pilot_bootstrap_content_exact_shape_verified,
    visible_runtime_metadata_leak_guard_verified:
      report.visible_runtime_metadata_leak_guard_verified,
    model_audio_qc_verified: report.model_audio_qc_verified,
    persistent_receiver_verified: report.persistent_receiver_verified,
    automated_real_device_evidence_verified:
      report.automated_real_device_evidence_verified,
    installed_client_minimum_version_enforced:
      report.installed_client_minimum_version_enforced,
    release_public_key_injection_verified:
      report.release_public_key_injection_verified,
    gate_eligible: report.gate_eligible,
  };
}

function hasExactKeys(value, expectedKeys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  );
}

function hasExactOrderedValues(value, expectedValues) {
  return (
    Array.isArray(value) &&
    value.length === expectedValues.length &&
    value.every((item, index) => item === expectedValues[index])
  );
}

function requireExternalRegularFile(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${label} path is required.`);
  }
  const absolutePath = realpathSync(resolve(value));
  if (!isRegularFile(absolutePath)) {
    fail(`${label} must be a regular file.`);
  }
  const pathFromRepository = relative(REPOSITORY_ROOT, absolutePath);
  if (
    pathFromRepository === "" ||
    (!pathFromRepository.startsWith(`..${sep}`) &&
      pathFromRepository !== ".." &&
      !isAbsolute(pathFromRepository))
  ) {
    fail(`${label} must remain outside the product repository.`);
  }
  return absolutePath;
}

function isRegularFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function readWorktreeStatus() {
  const status = spawnSync(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { cwd: REPOSITORY_ROOT, encoding: "utf8" }
  );
  if (status.error || status.status !== 0) {
    fail("Unable to read repository worktree status.");
  }
  return status.stdout;
}

function requireCanonicalTimestamp(value, label) {
  const parsed = new Date(value);
  if (
    typeof value !== "string" ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString() !== value
  ) {
    fail(`${label} must be a canonical UTC ISO timestamp.`);
  }
  return value;
}

function formatChildOutput(stdout, stderr) {
  const combined = [stdout, stderr]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .trim();
  return combined ? `\n${combined}` : "";
}

function parseArgs(argv) {
  const parsed = {};
  const names = new Map([
    ["--candidate-payload", "candidatePayloadPath"],
    ["--pilot-review", "pilotReviewPath"],
    ["--approval", "approvalPath"],
    ["--audit", "auditPath"],
    ["--checked-at", "checkedAt"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const key = names.get(argv[index]);
    const value = argv[index + 1];
    if (!key || !value || value.startsWith("--")) {
      fail(`Unknown or incomplete argument: ${argv[index]}`);
    }
    parsed[key] = value;
    index += 1;
  }
  for (const required of [
    "candidatePayloadPath",
    "pilotReviewPath",
    "approvalPath",
    "auditPath",
  ]) {
    if (!parsed[required]) fail(`Missing required option for ${required}.`);
  }
  return parsed;
}

function fail(message) {
  throw new ControlledPilotMobileAcceptanceError(message);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runControlledPilotMobileAcceptance(parseArgs(process.argv.slice(2)))
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(`[controlled-pilot-mobile-acceptance] ${error.message}`);
      process.exitCode = 1;
    });
}
