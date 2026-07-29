#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_BETA_RELEASE_RECORD = path.join(
  ROOT,
  "docs",
  "release",
  "beta-release-readiness.v1.json"
);
const STATUSES = new Set(["pending", "in_progress", "blocked", "passed"]);
const MAX_EVIDENCE_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const MAX_EVIDENCE_BYTES = 1024 * 1024;
const ALLOWED_EVIDENCE_PREFIXES = [
  "docs/release/evidence/",
  "docs/agent-runs/evidence/",
  "security/reports/",
];

export const BETA_DOMAIN_DEFINITIONS = Object.freeze({
  content: {
    required: [
      "content-audit-1180",
      "quality-metadata-coverage-1180",
      "human-cet-review-1180",
      "full-track-user-approval",
      "release-payload-integrity-1180",
    ],
  },
  audio: {
    required: [
      "audio-technical-integrity-301",
      "audio-perceptual-qc-301",
      "audio-ios-device-smoke",
      "audio-android-device-smoke",
    ],
    conditional: {
      condition: "audio_regeneration_required",
      type: "audio-vendor-blind-selection",
    },
  },
  clients: {
    required: [
      "ios-release-build",
      "android-release-build",
      "ios-real-device-main-flow",
      "android-real-device-main-flow",
      "cross-platform-accessibility-and-state-matrix",
    ],
  },
  backend: {
    required: [
      "backend-contract-suite",
      "receiver-cloudbase-contract-smoke",
      "beta-entitlement-audit",
      "production-sms-adapter-smoke",
      "lifecycle-data-cleanup",
    ],
  },
  delivery: {
    required: [
      "blank-environment-preflight",
      "blank-environment-provision",
      "blank-environment-deploy",
      "approved-bundle-publish",
      "remote-verify",
      "rollback-drill",
      "zero-user-data-import",
    ],
  },
});

const HUMAN_VERIFIERS = Object.freeze({
  "human-cet-review-1180": "human:",
  "full-track-user-approval": "github:LENKIN233",
  "audio-perceptual-qc-301": "human_audio:",
  "audio-vendor-blind-selection": "human_audio:",
  "audio-ios-device-smoke": "human_device:",
  "audio-android-device-smoke": "human_device:",
  "ios-real-device-main-flow": "human_device:",
  "android-real-device-main-flow": "human_device:",
});

export function validateBetaReleaseReadiness(
  record,
  { now = new Date() } = {}
) {
  const errors = [];
  if (!isRecord(record))
    return invalid("beta release record must be an object.");
  rejectSecretShapedKeys(record, "beta release record", errors);
  assertExactKeys(
    record,
    [
      "schema_version",
      "release_id",
      "updated_at",
      "status",
      "scope",
      "conditions",
      "evidence_policy",
      "domains",
      "decision",
    ],
    "beta release record",
    errors
  );
  equal(
    record.schema_version,
    "beta-release-readiness.v1",
    "schema_version",
    errors
  );
  equal(record.release_id, "cet4-closed-beta", "release_id", errors);
  validDate(record.updated_at, "updated_at", now, errors);
  if (!["not_ready", "ready"].includes(record.status))
    errors.push("status must be not_ready or ready.");
  validateScope(record.scope, errors);
  validateConditions(record.conditions, errors);
  validatePolicy(record.evidence_policy, errors);

  const domains = mapById(record.domains, "domains", errors);
  exactSet(
    domains.keys(),
    Object.keys(BETA_DOMAIN_DEFINITIONS),
    "domain ids",
    errors
  );
  const usedUris = new Map();
  const usedHashes = new Map();
  let passedDomainCount = 0;
  let blockerCount = 0;

  for (const [id, definition] of Object.entries(BETA_DOMAIN_DEFINITIONS)) {
    const domain = domains.get(id);
    if (!domain) continue;
    assertExactKeys(
      domain,
      ["id", "status", "evidence", "blockers", "observations"],
      `domain ${id}`,
      errors
    );
    if (!STATUSES.has(domain.status))
      errors.push(`domain ${id} has invalid status.`);
    const blockers = stringArray(
      domain.blockers,
      `domain ${id} blockers`,
      errors
    );
    blockerCount += blockers.length;
    const evidence = Array.isArray(domain.evidence) ? domain.evidence : [];
    if (!Array.isArray(domain.evidence))
      errors.push(`domain ${id} evidence must be an array.`);
    const requiredTypes = [...definition.required];
    if (
      definition.conditional &&
      record.conditions?.[definition.conditional.condition] === true
    )
      requiredTypes.push(definition.conditional.type);
    if (
      definition.conditional &&
      record.conditions?.[definition.conditional.condition] === null &&
      domain.status === "passed"
    ) {
      errors.push(
        `domain ${id} cannot pass while ${definition.conditional.condition} is unresolved.`
      );
    }
    const evidenceTypes = [];
    for (const [index, item] of evidence.entries()) {
      validateEvidence(
        item,
        { domainId: id, index, now, releaseId: record.release_id },
        errors
      );
      if (!isRecord(item)) continue;
      evidenceTypes.push(item.type);
      const knownTypes = new Set([
        ...definition.required,
        ...(definition.conditional ? [definition.conditional.type] : []),
      ]);
      if (!knownTypes.has(item.type))
        errors.push(`domain ${id} evidence has unknown type ${item.type}.`);
      trackReuse(
        item.artifact_uri,
        `${id}:${item.type}`,
        usedUris,
        "artifact_uri",
        errors
      );
      trackReuse(
        item.artifact_sha256,
        `${id}:${item.type}`,
        usedHashes,
        "artifact_sha256",
        errors
      );
    }
    if (new Set(evidenceTypes).size !== evidenceTypes.length)
      errors.push(`domain ${id} evidence types must be unique.`);
    validateObservations(domain.observations, id, now, errors);

    const complete = requiredTypes.every((type) =>
      evidenceTypes.includes(type)
    );
    const unresolvedCondition =
      definition.conditional &&
      record.conditions?.[definition.conditional.condition] === null;
    const expectedStatus =
      blockers.length > 0 || unresolvedCondition
        ? "blocked"
        : evidence.length === 0
        ? "pending"
        : complete
        ? "passed"
        : "in_progress";
    if (domain.status !== expectedStatus)
      errors.push(`domain ${id} status must be ${expectedStatus}.`);
    if (domain.status === "passed") passedDomainCount += 1;
    for (const type of requiredTypes) {
      if (domain.status === "passed" && !evidenceTypes.includes(type))
        errors.push(`domain ${id} passed without required evidence ${type}.`);
    }
  }

  const ready =
    passedDomainCount === Object.keys(BETA_DOMAIN_DEFINITIONS).length &&
    blockerCount === 0;
  const expectedOverall = ready ? "ready" : "not_ready";
  if (record.status !== expectedOverall)
    errors.push(`status must be ${expectedOverall} for the domain states.`);
  validateDecision(
    record.decision,
    { ready, passedDomainCount, blockerCount },
    errors
  );
  return {
    ok: errors.length === 0,
    ready: errors.length === 0 && ready,
    errors,
    summary: {
      passed_domains: passedDomainCount,
      unresolved_blockers: blockerCount,
    },
  };
}

export function verifyBetaEvidenceFiles(
  record,
  { root = ROOT, trackedFiles } = {}
) {
  const errors = [];
  const tracked = trackedFiles ?? readTrackedFiles(root);
  for (const domain of Array.isArray(record?.domains) ? record.domains : []) {
    for (const evidence of Array.isArray(domain?.evidence)
      ? domain.evidence
      : []) {
      if (
        !isRecord(evidence) ||
        !String(evidence.artifact_uri || "").startsWith("repo://")
      )
        continue;
      const relative = evidence.artifact_uri.slice("repo://".length);
      if (
        !ALLOWED_EVIDENCE_PREFIXES.some((prefix) => relative.startsWith(prefix))
      ) {
        errors.push(
          `evidence ${evidence.type} path is outside an allowed evidence directory.`
        );
        continue;
      }
      const absolute = path.resolve(root, relative);
      if (!absolute.startsWith(`${path.resolve(root)}${path.sep}`)) {
        errors.push(`evidence ${evidence.type} escapes the repository root.`);
        continue;
      }
      if (!tracked.has(relative))
        errors.push(`evidence ${evidence.type} must be tracked by Git.`);
      let stat;
      try {
        stat = fs.lstatSync(absolute);
      } catch {
        errors.push(`evidence ${evidence.type} artifact is missing.`);
        continue;
      }
      if (!stat.isFile() || stat.isSymbolicLink()) {
        errors.push(`evidence ${evidence.type} must be a regular file.`);
        continue;
      }
      const bytes = fs.readFileSync(absolute);
      if (bytes.length !== evidence.artifact_size_bytes)
        errors.push(`evidence ${evidence.type} byte size does not match.`);
      if (
        createHash("sha256").update(bytes).digest("hex") !==
        evidence.artifact_sha256
      )
        errors.push(`evidence ${evidence.type} SHA-256 does not match.`);
    }
  }
  return { ok: errors.length === 0, errors };
}

function validateScope(scope, errors) {
  if (!isRecord(scope)) {
    errors.push("scope must be an object.");
    return;
  }
  assertExactKeys(
    scope,
    [
      "track",
      "box_count",
      "card_count",
      "audio_asset_count",
      "release_targets",
      "runtime_mode",
      "delivery_environment",
    ],
    "scope",
    errors
  );
  equal(scope.track, "cet4", "scope.track", errors);
  equal(scope.box_count, 108, "scope.box_count", errors);
  equal(scope.card_count, 1180, "scope.card_count", errors);
  equal(scope.audio_asset_count, 301, "scope.audio_asset_count", errors);
  exactSet(
    scope.release_targets || [],
    ["ios", "android"],
    "scope.release_targets",
    errors
  );
  equal(scope.runtime_mode, "closed_beta", "scope.runtime_mode", errors);
  equal(
    scope.delivery_environment,
    "receiver_owned_cloudbase",
    "scope.delivery_environment",
    errors
  );
}

function validateConditions(conditions, errors) {
  if (!isRecord(conditions)) {
    errors.push("conditions must be an object.");
    return;
  }
  assertExactKeys(
    conditions,
    ["audio_regeneration_required"],
    "conditions",
    errors
  );
  if (![true, false, null].includes(conditions.audio_regeneration_required))
    errors.push(
      "conditions.audio_regeneration_required must be true, false, or null."
    );
}

function validatePolicy(policy, errors) {
  if (!isRecord(policy)) {
    errors.push("evidence_policy must be an object.");
    return;
  }
  assertExactKeys(
    policy,
    [
      "required_domains",
      "evidence_must_be_hash_bound",
      "human_or_external_evidence_not_created_by_automation",
      "personal_development_database_is_not_delivery_evidence",
      "single_domain_or_test_cannot_replace_overall_readiness",
    ],
    "evidence_policy",
    errors
  );
  exactSet(
    policy.required_domains || [],
    Object.keys(BETA_DOMAIN_DEFINITIONS),
    "evidence_policy.required_domains",
    errors
  );
  for (const key of [
    "evidence_must_be_hash_bound",
    "human_or_external_evidence_not_created_by_automation",
    "personal_development_database_is_not_delivery_evidence",
    "single_domain_or_test_cannot_replace_overall_readiness",
  ])
    if (policy[key] !== true)
      errors.push(`evidence_policy.${key} must be true.`);
}

function validateEvidence(evidence, context, errors) {
  const label = `domain ${context.domainId} evidence[${context.index}]`;
  if (!isRecord(evidence)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(
    evidence,
    [
      "type",
      "release_id",
      "artifact_uri",
      "artifact_sha256",
      "artifact_size_bytes",
      "verified_at",
      "verified_by",
    ],
    label,
    errors
  );
  if (!text(evidence.type)) errors.push(`${label}.type must be non-empty.`);
  equal(evidence.release_id, context.releaseId, `${label}.release_id`, errors);
  if (!String(evidence.artifact_uri || "").startsWith("repo://"))
    errors.push(`${label}.artifact_uri must use repo://.`);
  const hash = String(evidence.artifact_sha256 || "");
  if (!/^[a-f0-9]{64}$/.test(hash) || /^([a-f0-9])\1{63}$/.test(hash))
    errors.push(`${label}.artifact_sha256 must be a non-placeholder SHA-256.`);
  if (
    !Number.isSafeInteger(evidence.artifact_size_bytes) ||
    evidence.artifact_size_bytes <= 0 ||
    evidence.artifact_size_bytes > MAX_EVIDENCE_BYTES
  )
    errors.push(
      `${label}.artifact_size_bytes must be between 1 byte and 1 MiB.`
    );
  validDate(
    evidence.verified_at,
    `${label}.verified_at`,
    context.now,
    errors,
    true
  );
  if (!text(evidence.verified_by))
    errors.push(`${label}.verified_by must be non-empty.`);
  const expectedVerifier = HUMAN_VERIFIERS[evidence.type];
  if (
    expectedVerifier === "github:LENKIN233" &&
    evidence.verified_by !== expectedVerifier
  )
    errors.push(`${label} must be verified by github:LENKIN233.`);
  if (expectedVerifier && expectedVerifier.endsWith(":")) {
    const verifier = String(evidence.verified_by || "");
    if (
      !verifier.startsWith(expectedVerifier) ||
      verifier.length === expectedVerifier.length
    )
      errors.push(`${label} must use a named ${expectedVerifier} verifier.`);
  }
}

function validateObservations(observations, domainId, now, errors) {
  if (!Array.isArray(observations)) {
    errors.push(`domain ${domainId} observations must be an array.`);
    return;
  }
  for (const [index, observation] of observations.entries()) {
    const label = `domain ${domainId} observation[${index}]`;
    if (!isRecord(observation)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    for (const field of [
      "source_kind",
      "locator",
      "source_commit",
      "artifact_sha256",
      "observed_at",
      "release_evidence",
      "summary",
    ])
      if (!(field in observation)) errors.push(`${label} missing ${field}.`);
    if (observation.source_kind !== "external_workspace_report")
      errors.push(`${label}.source_kind is invalid.`);
    if (
      !String(observation.locator || "").startsWith(
        "external-workspace://card-make/"
      )
    )
      errors.push(
        `${label}.locator must use the card-make external workspace alias.`
      );
    if (!/^[a-f0-9]{40}$/.test(String(observation.source_commit || "")))
      errors.push(`${label}.source_commit must be a full commit SHA.`);
    if (!/^[a-f0-9]{64}$/.test(String(observation.artifact_sha256 || "")))
      errors.push(`${label}.artifact_sha256 must be SHA-256.`);
    validDate(observation.observed_at, `${label}.observed_at`, now, errors);
    if (observation.release_evidence !== false)
      errors.push(
        `${label} must remain diagnostic and cannot be release evidence.`
      );
    if (!isRecord(observation.summary))
      errors.push(`${label}.summary must be an object.`);
  }
}

function validateDecision(decision, expected, errors) {
  if (!isRecord(decision)) {
    errors.push("decision must be an object.");
    return;
  }
  assertExactKeys(
    decision,
    [
      "ready",
      "passed_domain_count",
      "unresolved_blocker_count",
      "final_user_approval_required",
      "personal_development_database_excluded",
      "single_gate_cannot_replace_overall_readiness",
      "release_bundle_activation_allowed",
    ],
    "decision",
    errors
  );
  equal(decision.ready, expected.ready, "decision.ready", errors);
  equal(
    decision.passed_domain_count,
    expected.passedDomainCount,
    "decision.passed_domain_count",
    errors
  );
  equal(
    decision.unresolved_blocker_count,
    expected.blockerCount,
    "decision.unresolved_blocker_count",
    errors
  );
  equal(
    decision.release_bundle_activation_allowed,
    expected.ready,
    "decision.release_bundle_activation_allowed",
    errors
  );
  for (const key of [
    "final_user_approval_required",
    "personal_development_database_excluded",
    "single_gate_cannot_replace_overall_readiness",
  ])
    if (decision[key] !== true) errors.push(`decision.${key} must be true.`);
}

function mapById(values, label, errors) {
  const map = new Map();
  if (!Array.isArray(values)) {
    errors.push(`${label} must be an array.`);
    return map;
  }
  for (const value of values) {
    if (!isRecord(value) || !text(value.id)) {
      errors.push(`${label} entries must have an id.`);
      continue;
    }
    if (map.has(value.id))
      errors.push(`${label} contains duplicate id ${value.id}.`);
    map.set(value.id, value);
  }
  return map;
}
function stringArray(value, label, errors) {
  if (!Array.isArray(value) || value.some((item) => !text(item))) {
    errors.push(`${label} must contain only non-empty strings.`);
    return [];
  }
  if (new Set(value).size !== value.length)
    errors.push(`${label} must not contain duplicates.`);
  return value;
}
function exactSet(actual, expected, label, errors) {
  const a = [...actual].sort();
  const e = [...expected].sort();
  if (JSON.stringify(a) !== JSON.stringify(e))
    errors.push(`${label} must contain exactly ${e.join(", ")}.`);
}
function assertExactKeys(value, expected, label, errors) {
  if (!isRecord(value)) return;
  exactSet(Object.keys(value), expected, `${label} keys`, errors);
}
function equal(actual, expected, label, errors) {
  if (actual !== expected)
    errors.push(`${label} must be ${JSON.stringify(expected)}.`);
}
function validDate(value, label, now, errors, checkAge = false) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    errors.push(`${label} must be an ISO timestamp.`);
    return;
  }
  if (time > now.getTime()) errors.push(`${label} must not be in the future.`);
  if (checkAge && now.getTime() - time > MAX_EVIDENCE_AGE_MS)
    errors.push(`${label} must be within the last 180 days.`);
}
function trackReuse(value, owner, seen, label, errors) {
  if (!text(value)) return;
  if (seen.has(value))
    errors.push(
      `${label} ${value} is reused by ${owner} and ${seen.get(value)}.`
    );
  else seen.set(value, owner);
}
function rejectSecretShapedKeys(value, label, errors) {
  const forbidden =
    /(^|_)(secret|password|token|credential|private_key|sms_code|access_key|api_key)($|_)/i;
  const stack = [[value, label]];
  while (stack.length > 0) {
    const [current, currentLabel] = stack.pop();
    if (!current || typeof current !== "object") continue;
    for (const [key, child] of Object.entries(current)) {
      const childLabel = `${currentLabel}.${key}`;
      if (forbidden.test(key))
        errors.push(`${childLabel} is a forbidden secret-shaped field.`);
      stack.push([child, childLabel]);
    }
  }
}
function readTrackedFiles(root) {
  return new Set(
    execFileSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf8" })
      .split("\0")
      .filter(Boolean)
  );
}
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function invalid(message) {
  return { ok: false, ready: false, errors: [message], summary: {} };
}

function parseArgs(argv) {
  const result = { record: DEFAULT_BETA_RELEASE_RECORD, requireReady: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--record") result.record = path.resolve(argv[++i]);
    else if (argv[i] === "--require-ready") result.requireReady = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return result;
}
function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const record = JSON.parse(fs.readFileSync(options.record, "utf8"));
    const validation = validateBetaReleaseReadiness(record);
    const files = verifyBetaEvidenceFiles(record);
    const report = {
      schema_version: "beta-release-readiness-report.v1",
      ok: validation.ok && files.ok,
      ready: validation.ready && files.ok,
      validation,
      repository_evidence: files,
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok || (options.requireReady && !report.ready))
      process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
