#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import {createHash, randomInt} from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import {dirname, resolve, sep} from "node:path";
import {fileURLToPath} from "node:url";
import {
  DEV_BASE_URL,
  DEV_ENV_ID,
  REQUIRED_COLLECTIONS,
  buildCountCommand,
  buildCountProbes,
  parseCountResults,
  parseTcbJson,
  summarizeCollectionState,
  validateTarget,
} from "./deployment-safety.mjs";

export const LIFECYCLE_SCHEMA = "cloudbase-smoke-lifecycle.v1";
export const LIFECYCLE_REPORT_SCHEMA =
  "cloudbase-smoke-lifecycle-report.v1";

const CLOUD_BASE_ROOT = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(CLOUD_BASE_ROOT, "../..");
const DEFAULT_TIMEOUT_MS = 10 * 60_000;
const AUTH_COLLECTIONS = Object.freeze([
  "softbook_auth_challenges",
  "softbook_auth_rate_limits",
  "softbook_auth_sessions",
]);
const ACCOUNT_COLLECTIONS = Object.freeze([
  "softbook_account_deletions",
  "softbook_daily_check_ins",
  "softbook_daily_progress",
  "softbook_learning_event_cursors",
  "softbook_learning_events",
  "softbook_learning_event_sequences",
  "softbook_learning_migration_revisions",
  "softbook_learning_sessions",
  "softbook_learning_states",
  "softbook_space_actions",
  "softbook_space_states",
]);
export const CLEANUP_COLLECTIONS = Object.freeze(
  [
    ...AUTH_COLLECTIONS,
    "softbook_beta_entitlements",
    "softbook_memberships",
    "softbook_pilot_entitlements",
    ...ACCOUNT_COLLECTIONS,
  ].sort()
);

export function createSmokePhone() {
  return `19${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`;
}

export function prepareSmokeLifecycle({
  manifestPath,
  phoneCount = 1,
  phones = [],
  repository = readRepositoryState(),
  runner = createCloudBaseRunner(),
  runId = `smoke-${new Date().toISOString().replaceAll(":", "")}`,
  now = new Date(),
} = {}) {
  assertSafeManifestPath(manifestPath);
  assertRepositoryForPrepare(repository);

  if (!Number.isInteger(phoneCount) || phoneCount < 1 || phoneCount > 2) {
    throw new Error("phoneCount must be 1 or 2.");
  }

  const assignedPhones = assignPhones(phoneCount, phones);
  const baseline = runner.readCollectionState();

  if (baseline.identity_document_count !== 0) {
    throw new Error(
      "CloudBase dev identity baseline must be empty before smoke preparation."
    );
  }

  const initialInventory = runner.discoverInventory(assignedPhones);

  if (countPlanDocuments(documentIdsByCollection(initialInventory)) !== 0) {
    throw new Error(
      "CloudBase dev contains pre-existing smoke-owned or account-owned records."
    );
  }

  const manifest = {
    schema_version: LIFECYCLE_SCHEMA,
    run_id: runId,
    status: "prepared",
    target: {base_url: DEV_BASE_URL, env_id: DEV_ENV_ID},
    repository: {head: repository.head},
    started_at: now.toISOString(),
    updated_at: now.toISOString(),
    phones: assignedPhones,
    phone_fingerprints: assignedPhones.map(fingerprint).sort(),
    baseline,
    cleanup_plan: null,
    last_error: null,
  };

  writePrivateJson(manifestPath, manifest);
  return {manifest, phones: assignedPhones};
}

export function cleanupSmokeLifecycle({
  apply = false,
  manifestPath,
  runner = createCloudBaseRunner(),
  now = new Date(),
} = {}) {
  assertSafeManifestPath(manifestPath);
  const manifest = readManifest(manifestPath);

  if (manifest.status === "cleaned") {
    return createPublicResult(manifest, "already_cleaned");
  }

  try {
    const inventory = runner.discoverInventory(manifest.phones);
    const current = runner.readCollectionState();
    const plan = manifest.cleanup_plan
      ? validateResumablePlan(manifest, inventory, current, now)
      : createCleanupPlan(manifest, inventory, current, now);

    manifest.cleanup_plan = plan;
    manifest.status = apply ? "cleaning" : "planned";
    manifest.updated_at = now.toISOString();
    manifest.last_error = null;
    writePrivateJson(manifestPath, manifest);

    if (!apply) {
      const result = createPublicResult(manifest, "ready");
      writeLifecycleReport(manifestPath, result);
      return result;
    }

    const remaining = remainingPlanDocuments(plan, inventory);
    runner.deleteExact(remaining);
    const afterInventory = runner.discoverInventory(manifest.phones);
    const after = runner.readCollectionState();
    assertNoPlannedDocuments(plan, afterInventory);
    assertBaselineCounts(manifest.baseline.collection_counts, after);

    const result = createPublicResult(manifest, "passed", {
      after,
      deleted_document_count: countPlanDocuments(remaining),
    });
    redactCompletedManifest(manifest, result);
    manifest.status = "cleaned";
    manifest.cleaned_at = now.toISOString();
    manifest.updated_at = now.toISOString();
    writePrivateJson(manifestPath, manifest);
    writeLifecycleReport(manifestPath, result);
    return result;
  } catch (error) {
    manifest.last_error = sanitizeError(error);
    manifest.updated_at = now.toISOString();
    writePrivateJson(manifestPath, manifest);
    const result = createPublicResult(manifest, "failed", {
      errors: [manifest.last_error],
    });
    writeLifecycleReport(manifestPath, result);
    throw new Error(manifest.last_error.message, {cause: error});
  }
}

export function createCleanupPlan(manifest, inventory, current, now = new Date()) {
  assertLifecycleWindow(manifest, inventory, now);
  const ownership = validateInventoryOwnership(manifest, inventory);
  const documents = documentIdsByCollection(inventory);
  assertCurrentCounts(manifest.baseline.collection_counts, current, documents);

  return {
    created_at: now.toISOString(),
    account_keys: ownership.accountKeys,
    account_fingerprints: ownership.accountKeys.map(fingerprint).sort(),
    documents,
    document_fingerprints: fingerprintDocuments(documents),
    total_documents: countPlanDocuments(documents),
  };
}

export function validateResumablePlan(
  manifest,
  inventory,
  current,
  now = new Date()
) {
  const plan = manifest.cleanup_plan;

  if (!plan || !plan.documents || !Array.isArray(plan.account_keys)) {
    throw new Error("Persisted cleanup plan is incomplete.");
  }

  assertLifecycleWindow(manifest, inventory, now);
  validateInventoryOwnership(manifest, inventory, plan.account_keys, {
    allowPartialRateLimits: true,
  });
  const remaining = remainingPlanDocuments(plan, inventory);
  assertInventoryIsPlanned(plan, inventory);
  assertCurrentCounts(manifest.baseline.collection_counts, current, remaining);
  return plan;
}

export function createCloudBaseRunner({
  envId = DEV_ENV_ID,
  repositoryRoot = REPOSITORY_ROOT,
  tcb = process.env.CLOUDBASE_CLI || "tcb",
} = {}) {
  const target = validateTarget({envId});

  if (!target.ok) {
    throw new Error(target.errors.join("; "));
  }

  function run(args, label) {
    const finalArgs =
      args[0] === "db" && args[1] === "nosql" && args[2] === "execute"
        ? [...args.slice(0, 3), "-e", envId, ...args.slice(3)]
        : [...args, "-e", envId];
    const result = spawnSync(tcb, finalArgs, {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
      timeout: DEFAULT_TIMEOUT_MS,
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      const detail = sanitizeText(
        [result.stderr, result.stdout].filter(Boolean).join("\n")
      );
      throw new Error(
        `CloudBase CLI ${label} exited ${result.status}${
          detail ? `: ${detail.slice(0, 600)}` : "."
        }`
      );
    }

    return parseTcbJson(result.stdout);
  }

  function readDocuments(collection, filter) {
    const payload = run(
      [
        "db",
        "nosql",
        "execute",
        "--command",
        JSON.stringify([
          {
            Command: JSON.stringify({find: collection, filter, limit: 100}),
            CommandType: "FIND",
            TableName: collection,
          },
        ]),
        "--json",
      ],
      `find ${collection}`
    );
    const documents = payload?.data?.results?.[0];

    if (!Array.isArray(documents)) {
      throw new Error(`CloudBase FIND failed for ${collection}.`);
    }

    return documents;
  }

  return {
    deleteExact(documents) {
      const commands = buildExactDeleteCommands(documents);

      if (commands.length === 0) {
        return;
      }

      const payload = run(
        [
          "db",
          "nosql",
          "execute",
          "--command",
          JSON.stringify(commands),
          "--json",
        ],
        "delete exact smoke documents"
      );

      const results = payload?.data?.results;
      if (!Array.isArray(results) || results.length !== commands.length) {
        throw new Error(
          "CloudBase did not confirm every exact deletion command."
        );
      }

      for (const result of results) {
        const value = Array.isArray(result) ? result[0] : result;
        if (normalizeCloudBaseNumber(value?.ok) !== 1) {
          throw new Error("A CloudBase exact deletion command failed.");
        }
      }
    },
    discoverInventory(phones) {
      const inventory = {
        softbook_auth_challenges: readDocuments("softbook_auth_challenges", {
          _id: {$ne: "__provision__"},
        }),
        softbook_auth_rate_limits: readDocuments("softbook_auth_rate_limits", {
          _id: {$ne: "__provision__"},
        }),
        softbook_auth_sessions: readDocuments("softbook_auth_sessions", {
          _id: {$ne: "__provision__"},
        }),
        softbook_beta_entitlements: readDocuments("softbook_beta_entitlements", {
          _id: {$in: phones},
        }),
        softbook_memberships: readDocuments("softbook_memberships", {
          _id: {$in: phones},
        }),
        softbook_pilot_entitlements: readDocuments(
          "softbook_pilot_entitlements",
          {_id: {$in: phones}}
        ),
      };

      for (const collection of ACCOUNT_COLLECTIONS) {
        inventory[collection] = readDocuments(collection, {
          account_key: {$exists: true},
        });
      }

      return inventory;
    },
    readCollectionState() {
      const probes = buildCountProbes();
      const payload = run(
        [
          "db",
          "nosql",
          "execute",
          "--command",
          buildCountCommand(probes),
          "--json",
        ],
        "read collection counts"
      );
      return summarizeCollectionState(
        parseCountResults(payload, probes),
        REQUIRED_COLLECTIONS
      );
    },
    readDocuments,
  };
}

export function buildExactDeleteCommands(documents) {
  return Object.entries(documents)
    .filter(([, ids]) => ids.length > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([collection, ids]) => ({
      Command: JSON.stringify({
        delete: collection,
        deletes: [{limit: 0, q: {_id: {$in: ids}}}],
      }),
      CommandType: "DELETE",
      TableName: collection,
    }));
}

function validateInventoryOwnership(
  manifest,
  inventory,
  plannedAccountKeys = null,
  {allowPartialRateLimits = false} = {}
) {
  const allowedPhones = new Set(manifest.phones);
  const sessions = inventory.softbook_auth_sessions ?? [];
  const challenges = inventory.softbook_auth_challenges ?? [];
  const rateLimits = inventory.softbook_auth_rate_limits ?? [];
  const betaEntitlements = inventory.softbook_beta_entitlements ?? [];
  const memberships = inventory.softbook_memberships ?? [];
  const pilotEntitlements = inventory.softbook_pilot_entitlements ?? [];

  for (const document of [...sessions, ...challenges]) {
    assertDocument(document, "auth document");
    if (!allowedPhones.has(document.phone_number)) {
      throw new Error(
        "An auth document is not owned by an assigned smoke phone."
      );
    }
  }

  for (const document of [
    ...betaEntitlements,
    ...memberships,
    ...pilotEntitlements,
  ]) {
    assertDocument(document, "membership document");
    if (!allowedPhones.has(document._id)) {
      throw new Error("A membership document is not owned by an assigned smoke phone.");
    }
  }

  const sessionAccountKeys = unique(
    sessions.map((document) => document.account_key).filter(Boolean)
  );
  const accountKeys = plannedAccountKeys ?? sessionAccountKeys;
  const allowedAccountKeys = new Set(accountKeys);

  if (
    accountKeys.some((value) => !/^[a-f0-9]{64}$/.test(value)) ||
    sessionAccountKeys.some((value) => !allowedAccountKeys.has(value))
  ) {
    throw new Error("Smoke account ownership is invalid.");
  }

  for (const collection of ACCOUNT_COLLECTIONS) {
    for (const document of inventory[collection] ?? []) {
      assertDocument(document, collection);
      if (!allowedAccountKeys.has(document.account_key)) {
        throw new Error(`${collection} contains an unowned account document.`);
      }
    }
  }

  const challengedPhones = unique(
    challenges.map((document) => document.phone_number)
  );
  const phoneRateLimits = rateLimits.filter((document) =>
    String(document.key).startsWith("phone:")
  );
  const ipRateLimits = rateLimits.filter((document) =>
    String(document.key).startsWith("ip:")
  );
  const expectedIpRecords = challenges.length > 0 ? 1 : 0;
  const rateCountsMatch =
    phoneRateLimits.every(
      (document) => normalizeCloudBaseNumber(document.count) === 1
    ) &&
    ipRateLimits.every(
      (document) =>
        normalizeCloudBaseNumber(document.count) === challengedPhones.length
    );

  if (
    (!allowPartialRateLimits &&
      (challenges.length !== challengedPhones.length ||
        phoneRateLimits.length !== challengedPhones.length ||
        ipRateLimits.length !== expectedIpRecords ||
        !rateCountsMatch)) ||
    rateLimits.length !== phoneRateLimits.length + ipRateLimits.length ||
    rateLimits.some(
      (document) => !/^(phone|ip):[a-f0-9]{64}$/.test(document.key)
    )
  ) {
    throw new Error("Auth rate-limit ownership or cardinality is unexpected.");
  }

  return {accountKeys};
}

function assertLifecycleWindow(manifest, inventory, now) {
  const start = Date.parse(manifest.started_at) - 30_000;
  const end = now.getTime() + 5 * 60_000;

  if (!Number.isFinite(start)) {
    throw new Error("Lifecycle start timestamp is invalid.");
  }

  for (const documents of Object.values(inventory)) {
    for (const document of documents) {
      for (const field of [
        "created_at",
        "updated_at",
        "consumed_at",
        "revoked_at",
      ]) {
        if (document[field] == null) {
          continue;
        }

        const timestamp = Date.parse(document[field]);
        if (
          !Number.isFinite(timestamp) ||
          timestamp < start ||
          timestamp > end
        ) {
          throw new Error(
            `A smoke document ${field} falls outside the lifecycle window.`
          );
        }
      }
    }
  }
}

function assertCurrentCounts(baselineCounts, current, documents) {
  for (const collection of REQUIRED_COLLECTIONS) {
    const expected =
      baselineCounts[collection] + (documents[collection]?.length ?? 0);
    if (current.collection_counts[collection] !== expected) {
      throw new Error(
        `${collection} count does not equal the baseline plus exact smoke documents.`
      );
    }
  }
}

function assertBaselineCounts(baselineCounts, current) {
  for (const collection of REQUIRED_COLLECTIONS) {
    if (current.collection_counts[collection] !== baselineCounts[collection]) {
      throw new Error(`${collection} did not return to its smoke baseline.`);
    }
  }

  if (current.identity_document_count !== 0) {
    throw new Error("Identity documents remain after smoke cleanup.");
  }
}

function assertInventoryIsPlanned(plan, inventory) {
  for (const [collection, documents] of Object.entries(inventory)) {
    const planned = new Set(plan.documents[collection] ?? []);
    if (documents.some((document) => !planned.has(document._id))) {
      throw new Error(`${collection} contains an unplanned document.`);
    }
  }
}

function assertNoPlannedDocuments(plan, inventory) {
  for (const [collection, documents] of Object.entries(inventory)) {
    const planned = new Set(plan.documents[collection] ?? []);
    if (documents.some((document) => planned.has(document._id))) {
      throw new Error(`${collection} still contains a planned smoke document.`);
    }
  }
}

function remainingPlanDocuments(plan, inventory) {
  const currentIds = new Map(
    Object.entries(inventory).map(([collection, documents]) => [
      collection,
      new Set(documents.map((document) => document._id)),
    ])
  );

  return Object.fromEntries(
    Object.entries(plan.documents).map(([collection, ids]) => [
      collection,
      ids.filter((id) => currentIds.get(collection)?.has(id)),
    ])
  );
}

function documentIdsByCollection(inventory) {
  return Object.fromEntries(
    CLEANUP_COLLECTIONS.map((collection) => [
      collection,
      (inventory[collection] ?? []).map((document) => document._id).sort(),
    ])
  );
}

function fingerprintDocuments(documents) {
  return Object.fromEntries(
    Object.entries(documents).map(([collection, ids]) => [
      collection,
      ids.map((id) => fingerprint(`${collection}\0${id}`)).sort(),
    ])
  );
}

function countPlanDocuments(documents) {
  return Object.values(documents).reduce((sum, ids) => sum + ids.length, 0);
}

function assignPhones(phoneCount, provided) {
  const phones = Array.from({length: phoneCount}, (_, index) =>
    provided[index] ? provided[index] : createSmokePhone()
  );

  if (
    phones.length !== phoneCount ||
    phones.some((phone) => !/^19\d{9}$/.test(phone)) ||
    new Set(phones).size !== phones.length
  ) {
    throw new Error("Smoke phones must be unique and match 19xxxxxxxxx.");
  }

  return phones;
}

function assertDocument(document, label) {
  if (!document || typeof document._id !== "string" || document._id === "") {
    throw new Error(`${label} is missing a document ID.`);
  }
}

function assertRepositoryForPrepare(repository) {
  if (
    repository.branch !== "main" ||
    repository.dirty ||
    !repository.head ||
    repository.head !== repository.originMain
  ) {
    throw new Error(
      "Smoke preparation requires clean main exactly matching origin/main."
    );
  }
}

function readRepositoryState() {
  const runGit = (args) => {
    const result = spawnSync("git", args, {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
      timeout: 30_000,
    });
    if (result.error || result.status !== 0) {
      throw result.error ?? new Error(`git ${args[0]} exited ${result.status}.`);
    }
    return result.stdout.trim();
  };

  return {
    branch: runGit(["branch", "--show-current"]),
    dirty: runGit(["status", "--porcelain"]) !== "",
    head: runGit(["rev-parse", "HEAD"]),
    originMain: runGit(["rev-parse", "origin/main"]),
  };
}

function assertSafeManifestPath(path) {
  if (!path) {
    throw new Error("A lifecycle manifest path is required.");
  }

  const absolute = resolve(path);
  const exportRoot = resolve(REPOSITORY_ROOT, "exports");
  if (absolute !== exportRoot && !absolute.startsWith(`${exportRoot}${sep}`)) {
    throw new Error("Lifecycle manifests must be written below exports/.");
  }
}

function readManifest(path) {
  const manifest = JSON.parse(readFileSync(resolve(path), "utf8"));
  if (
    manifest.schema_version !== LIFECYCLE_SCHEMA ||
    manifest.target?.env_id !== DEV_ENV_ID ||
    manifest.target?.base_url !== DEV_BASE_URL ||
    (manifest.status !== "cleaned" && !Array.isArray(manifest.phones))
  ) {
    throw new Error(
      "Lifecycle manifest is invalid or targets a non-dev environment."
    );
  }
  return manifest;
}

function writePrivateJson(path, value) {
  const absolute = resolve(path);
  const temporary = `${absolute}.tmp-${process.pid}`;
  mkdirSync(dirname(absolute), {recursive: true});
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  chmodSync(temporary, 0o600);
  renameSync(temporary, absolute);
}

function writeLifecycleReport(manifestPath, report) {
  writePrivateJson(`${manifestPath}.report.json`, report);
}

function redactCompletedManifest(manifest, result) {
  manifest.phone_fingerprints = manifest.phones.map(fingerprint).sort();
  delete manifest.phones;
  manifest.cleanup_summary = {
    account_fingerprints: manifest.cleanup_plan.account_fingerprints,
    document_fingerprints: manifest.cleanup_plan.document_fingerprints,
    total_documents: manifest.cleanup_plan.total_documents,
    verification_status: result.status,
  };
  delete manifest.cleanup_plan;
  manifest.last_error = null;
}

function createPublicResult(manifest, status, extra = {}) {
  return {
    schema_version: LIFECYCLE_REPORT_SCHEMA,
    run_id: manifest.run_id,
    status,
    target: manifest.target,
    repository_head: manifest.repository?.head ?? null,
    phone_fingerprints: manifest.phone_fingerprints,
    planned_document_count:
      manifest.cleanup_plan?.total_documents ??
      manifest.cleanup_summary?.total_documents ??
      0,
    generated_at: new Date().toISOString(),
    ...extra,
  };
}

function sanitizeText(value) {
  return String(value)
    .replace(/\b1\d{10}\b/g, "<redacted-phone>")
    .replace(/\b[a-f0-9]{64}\b/g, "<redacted-digest>")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeError(error) {
  return {
    message: sanitizeText(error instanceof Error ? error.message : error),
    type: error instanceof Error ? error.constructor.name : "Error",
  };
}

function fingerprint(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function normalizeCloudBaseNumber(value) {
  if (Number.isFinite(value)) {
    return Number(value);
  }
  for (const key of ["$numberInt", "$numberLong", "$numberDouble"]) {
    if (value && typeof value === "object" && key in value) {
      return Number(value[key]);
    }
  }
  return Number.NaN;
}

function unique(values) {
  return [...new Set(values)];
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const options = {
    apply: false,
    command,
    format: "text",
    manifest: null,
    phoneCount: 1,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === "--apply") {
      options.apply = true;
    } else if (
      ["--format", "--manifest", "--phone-count"].includes(argument)
    ) {
      const value = rest[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }
      index += 1;
      if (argument === "--format") options.format = value;
      if (argument === "--manifest") options.manifest = value;
      if (argument === "--phone-count") options.phoneCount = Number(value);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!["prepare", "cleanup"].includes(command)) {
    throw new Error("Command must be prepare or cleanup.");
  }
  if (!["text", "json", "tsv"].includes(options.format)) {
    throw new Error("--format must be text, json, or tsv.");
  }
  if (!options.manifest) {
    throw new Error("--manifest is required.");
  }
  if (command === "prepare" && options.apply) {
    throw new Error("--apply is valid only for cleanup.");
  }
  return options;
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.command === "prepare") {
      const provided = [
        process.env.SOFTBOOK_CET_TEST_PHONE,
        process.env.SOFTBOOK_CET_MANUAL_TEST_PHONE,
      ];
      const result = prepareSmokeLifecycle({
        manifestPath: options.manifest,
        phoneCount: options.phoneCount,
        phones: provided,
      });
      if (options.format === "tsv") {
        console.log(result.phones.join("\t"));
      } else if (options.format === "json") {
        console.log(
          JSON.stringify(createPublicResult(result.manifest, "prepared"))
        );
      } else {
        console.log(
          `[prepared] ${result.manifest.run_id}; phones=${result.phones.length}`
        );
      }
      return;
    }

    const result = cleanupSmokeLifecycle({
      apply: options.apply,
      manifestPath: options.manifest,
    });
    if (options.format === "json") {
      console.log(JSON.stringify(result));
    } else {
      console.log(
        `[${result.status}] documents=${result.planned_document_count}`
      );
    }
  } catch (error) {
    console.error(`[cloudbase-smoke-lifecycle] ${sanitizeText(error.message)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
