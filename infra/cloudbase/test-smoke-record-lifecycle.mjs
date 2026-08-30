import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import {join, resolve} from "node:path";
import test from "node:test";
import {
  CLEANUP_COLLECTIONS,
  buildExactDeleteCommands,
  cleanupSmokeLifecycle,
  createCleanupPlan,
  prepareSmokeLifecycle,
  validateResumablePlan,
} from "./smoke-record-lifecycle.mjs";
import {REQUIRED_COLLECTIONS} from "./deployment-safety.mjs";

const NOW = new Date("2026-07-28T10:05:00.000Z");
const STARTED_AT = "2026-07-28T10:00:00.000Z";
const PHONE = "19123456789";
const ACCOUNT_KEY = "a".repeat(64);

test("createCleanupPlan attributes every exact document to the lifecycle", () => {
  const inventory = createInventory();
  const plan = createCleanupPlan(
    createManifest(),
    inventory,
    createState(countInventory(inventory)),
    NOW
  );

  assert.equal(plan.total_documents, 8);
  assert.deepEqual(plan.documents.softbook_auth_sessions, ["session-1"]);
  assert.deepEqual(plan.documents.softbook_learning_events, ["event-1"]);
  assert.deepEqual(plan.account_keys, [ACCOUNT_KEY]);
});

test("createCleanupPlan rejects account documents without an owned session", () => {
  const inventory = createInventory();
  inventory.softbook_learning_events[0].account_key = "b".repeat(64);

  assert.throws(
    () =>
      createCleanupPlan(
        createManifest(),
        inventory,
        createState(countInventory(inventory)),
        NOW
      ),
    /unowned account document/
  );
});

test("createCleanupPlan rejects collection drift before any deletion", () => {
  const inventory = createInventory();
  const state = createState(countInventory(inventory));
  state.collection_counts.softbook_learning_events += 1;

  assert.throws(
    () => createCleanupPlan(createManifest(), inventory, state, NOW),
    /baseline plus exact smoke documents/
  );
});

test("createCleanupPlan rejects a shared IP rate-limit increment", () => {
  const inventory = createInventory();
  inventory.softbook_auth_rate_limits.find((item) =>
    item.key.startsWith("ip:")
  ).count = 2;

  assert.throws(
    () =>
      createCleanupPlan(
        createManifest(),
        inventory,
        createState(countInventory(inventory)),
        NOW
      ),
    /rate-limit ownership or cardinality/
  );
});

test("delete commands contain only persisted exact document IDs", () => {
  const commands = buildExactDeleteCommands({
    softbook_auth_sessions: ["session-2", "session-1"],
    softbook_learning_events: [],
  });

  assert.equal(commands.length, 1);
  assert.equal(commands[0].CommandType, "DELETE");
  assert.equal(commands[0].TableName, "softbook_auth_sessions");
  assert.deepEqual(JSON.parse(commands[0].Command), {
    delete: "softbook_auth_sessions",
    deletes: [
      {limit: 0, q: {_id: {$in: ["session-2", "session-1"]}}},
    ],
  });
});

test("validateResumablePlan accepts only the remaining exact IDs", () => {
  const original = createInventory();
  const manifest = createManifest();
  manifest.cleanup_plan = createCleanupPlan(
    manifest,
    original,
    createState(countInventory(original)),
    NOW
  );
  const remaining = structuredClone(original);
  remaining.softbook_auth_challenges = [];
  remaining.softbook_auth_rate_limits = [];

  const plan = validateResumablePlan(
    manifest,
    remaining,
    createState(countInventory(remaining)),
    NOW
  );

  assert.equal(plan.total_documents, 8);
});

test("cleanup persists a plan before delete and resumes after partial failure", () => {
  mkdirSync(resolve("exports/cloudbase-smoke"), {recursive: true});
  const directory = mkdtempSync(
    resolve("exports/cloudbase-smoke/test-lifecycle-")
  );
  const manifestPath = join(directory, "manifest.json");
  const inventory = createInventory();
  let currentInventory = structuredClone(inventory);
  let firstDelete = true;
  const runner = createFakeRunner({
    deleteExact(documents) {
      if (firstDelete) {
        firstDelete = false;
        currentInventory.softbook_auth_challenges = [];
        throw new Error("simulated partial deletion");
      }
      removeDocuments(currentInventory, documents);
    },
    getInventory: () => structuredClone(currentInventory),
  });

  try {
    writePreparedManifest(manifestPath, runner);
    assert.throws(
      () => cleanupSmokeLifecycle({apply: true, manifestPath, runner, now: NOW}),
      /simulated partial deletion/
    );
    const failed = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(failed.cleanup_plan.total_documents, 8);

    const result = cleanupSmokeLifecycle({
      apply: true,
      manifestPath,
      runner,
      now: NOW,
    });
    const completed = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(result.status, "passed");
    assert.equal(completed.status, "cleaned");
    assert.equal(completed.phones, undefined);
    assert.equal(completed.cleanup_plan, undefined);
    assert.equal(statSync(manifestPath).mode & 0o777, 0o600);
    assert.doesNotMatch(readFileSync(manifestPath, "utf8"), new RegExp(PHONE));
    assert.doesNotMatch(
      readFileSync(`${manifestPath}.report.json`, "utf8"),
      new RegExp(PHONE)
    );
    assert.equal(
      cleanupSmokeLifecycle({apply: true, manifestPath, runner, now: NOW})
        .status,
      "already_cleaned"
    );
  } finally {
    rmSync(directory, {force: true, recursive: true});
  }
});

test("prepare requires an empty identity baseline and clean matching main", () => {
  mkdirSync(resolve("exports/cloudbase-smoke"), {recursive: true});
  const directory = mkdtempSync(
    resolve("exports/cloudbase-smoke/test-prepare-")
  );
  const manifestPath = join(directory, "manifest.json");
  const runner = createFakeRunner({
    baselineIdentityCount: 1,
    getInventory: () => createInventory(),
  });

  try {
    assert.throws(
      () =>
        prepareSmokeLifecycle({
          manifestPath,
          phoneCount: 1,
          phones: [PHONE],
          repository: {
            branch: "main",
            dirty: false,
            head: "abc",
            originMain: "abc",
          },
          runner,
          now: NOW,
        }),
      /identity baseline must be empty/
    );
  } finally {
    rmSync(directory, {force: true, recursive: true});
  }
});

test("prepare rejects pre-existing account records omitted by identity probes", () => {
  mkdirSync(resolve("exports/cloudbase-smoke"), {recursive: true});
  const directory = mkdtempSync(
    resolve("exports/cloudbase-smoke/test-account-baseline-")
  );
  const initialInventory = Object.fromEntries(
    CLEANUP_COLLECTIONS.map((collection) => [collection, []])
  );
  initialInventory.softbook_daily_progress = [
    {_id: "existing-progress", account_key: ACCOUNT_KEY},
  ];
  const runner = createFakeRunner({
    getInventory: () => createInventory(),
    initialInventory,
  });

  try {
    assert.throws(
      () =>
        prepareSmokeLifecycle({
          manifestPath: join(directory, "manifest.json"),
          phoneCount: 1,
          phones: [PHONE],
          repository: {
            branch: "main",
            dirty: false,
            head: "abc",
            originMain: "abc",
          },
          runner,
          now: NOW,
        }),
      /pre-existing smoke-owned or account-owned records/
    );
  } finally {
    rmSync(directory, {force: true, recursive: true});
  }
});

test("deployment and iOS acceptance keep lifecycle ownership around remote writes", () => {
  const manager = readFileSync(
    "infra/cloudbase/manage-softbook-api.mjs",
    "utf8"
  );
  const ios = readFileSync("infra/cloudbase/smoke-ios-runtime.sh", "utf8");
  const maestro = readFileSync(
    "infra/cloudbase/smoke-ios-maestro-runtime.sh",
    "utf8"
  );
  const smoke = readFileSync("infra/cloudbase/smoke-softbook-api.mjs", "utf8");
  const deploymentStart = manager.indexOf("const preparedSmoke = prepareSmokeLifecycle");
  const deploymentWrite = manager.indexOf(
    'runLiveSmoke(context, "cet4", true, preparedSmoke.phones[0])'
  );
  const deploymentCleanup = manager.indexOf("cleanupSmokeLifecycle({", deploymentWrite);

  assert.ok(deploymentStart > 0);
  assert.ok(deploymentWrite > deploymentStart);
  assert.ok(deploymentCleanup > deploymentWrite);
  assert.match(ios, /prepare_smoke_lifecycle\n\necho "==> Verifying CloudBase REST contract/);
  assert.match(
    ios,
    /export SOFTBOOK_CET_SMOKE_LIFECYCLE_MANIFEST="\$\{SMOKE_LIFECYCLE_MANIFEST\}"/,
  );
  assert.match(maestro, /SOFTBOOK_CET_SMOKE_LIFECYCLE_OWNER=external/);
  assert.match(maestro, /SOFTBOOK_CET_MAESTRO_PHONE/);
  assert.doesNotMatch(maestro, /SOFTBOOK_CET_MANUAL_TEST_PHONE/);
  assert.match(maestro, /trap on_exit EXIT/);
  assert.match(smoke, /SOFTBOOK_CET_TEST_PHONE \|\| createIsolatedPhoneNumber/);
  assert.doesNotMatch(smoke, /using isolated generated phone/);
  assert.match(
    smoke,
    /expectedInitialCardCount = initialCardSourceIsLimited[\s\S]*Math\.ceil\(initialBootstrap\.content\.card_count \* 0\.5\)/,
  );
  assert.match(
    smoke,
    /learningSelection\.membership_stage === 'trial'[\s\S]*requireCoreInteractions: true/,
  );
  assert.match(
    smoke,
    /activated Trial did not expose the complete canonical card source/,
  );
  assert.match(
    smoke,
    /const CLOUDBASE_READ_RETRY_DELAYS_MS = \[250, 750, 1500\]/,
  );
  assert.match(
    smoke,
    /allowedCodes\.includes\(payload\.error\.code\)/,
  );
  assert.match(
    smoke,
    /headers: remoteHeaders,[\s\S]*method: 'GET'/,
  );
  assert.match(
    smoke,
    /postJsonWithExactReplay\([\s\S]*'\/v2\/learning\/events'[\s\S]*learning_events_unavailable/,
  );
  assert.match(
    smoke,
    /postJsonWithExactReplay\([\s\S]*'\/v2\/space\/actions'[\s\S]*DATABASE_TRANSACTION_FAIL/,
  );
});

test("CloudBase dev smoke fails before network access without lifecycle ownership", () => {
  const result = spawnSync(
    process.execPath,
    ["infra/cloudbase/smoke-softbook-api.mjs"],
    {
      cwd: resolve("."),
      encoding: "utf8",
      env: {
        ...process.env,
        SOFTBOOK_CET_REMOTE_BASE_URL:
          "https://test-d2gzcyxr9f7e80972.service.tcloudbase.com/softbook-api",
        SOFTBOOK_CET_SMOKE_ISOLATED_PHONE: "1",
        SOFTBOOK_CET_TEST_CODE: "2468",
      },
    }
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires an explicit lifecycle-owned isolated phone/);
});

function createManifest() {
  return {
    schema_version: "cloudbase-smoke-lifecycle.v1",
    run_id: "test-smoke",
    status: "prepared",
    target: {
      base_url:
        "https://test-d2gzcyxr9f7e80972.service.tcloudbase.com/softbook-api",
      env_id: "test-d2gzcyxr9f7e80972",
    },
    repository: {head: "abc"},
    started_at: STARTED_AT,
    updated_at: STARTED_AT,
    phones: [PHONE],
    phone_fingerprints: ["fingerprint"],
    baseline: createState({}),
    cleanup_plan: null,
    last_error: null,
  };
}

function createInventory() {
  const inventory = Object.fromEntries(
    CLEANUP_COLLECTIONS.map((collection) => [collection, []])
  );
  inventory.softbook_auth_challenges = [
    {
      _id: "challenge-1",
      challenge_id: "challenge-1",
      phone_number: PHONE,
      created_at: "2026-07-28T10:01:00.000Z",
    },
  ];
  inventory.softbook_auth_rate_limits = [
    {
      _id: "phone-rate",
      count: 1,
      key: `phone:${"c".repeat(64)}`,
      updated_at: "2026-07-28T10:01:00.000Z",
    },
    {
      _id: "ip-rate",
      count: 1,
      key: `ip:${"d".repeat(64)}`,
      updated_at: "2026-07-28T10:01:00.000Z",
    },
  ];
  inventory.softbook_auth_sessions = [
    {
      _id: "session-1",
      account_key: ACCOUNT_KEY,
      phone_number: PHONE,
      created_at: "2026-07-28T10:02:00.000Z",
    },
  ];
  inventory.softbook_beta_entitlements = [
    {
      _id: PHONE,
      phone_number: PHONE,
      updated_at: "2026-07-28T10:03:00.000Z",
    },
  ];
  inventory.softbook_pilot_entitlements = [
    {
      _id: PHONE,
      phone_number: PHONE,
      pilot_id: "cet4-pilot-2026",
      updated_at: "2026-07-28T10:03:00.000Z",
    },
  ];
  inventory.softbook_memberships = [
    {
      _id: PHONE,
      updated_at: "2026-07-28T10:03:00.000Z",
    },
  ];
  inventory.softbook_learning_events = [
    {
      _id: "event-1",
      account_key: ACCOUNT_KEY,
      created_at: "2026-07-28T10:03:00.000Z",
    },
  ];
  return inventory;
}

function countInventory(inventory) {
  return Object.fromEntries(
    Object.entries(inventory).map(([collection, documents]) => [
      collection,
      documents.length,
    ])
  );
}

function createState(deltas, identityDocumentCount = null) {
  const collectionCounts = Object.fromEntries(
    REQUIRED_COLLECTIONS.map((collection) => [collection, deltas[collection] ?? 0])
  );
  const inferredIdentityCount = [
    "softbook_auth_challenges",
    "softbook_auth_rate_limits",
    "softbook_auth_sessions",
    "softbook_learning_events",
  ].reduce((sum, collection) => sum + (deltas[collection] ?? 0), 0);
  return {
    collection_counts: collectionCounts,
    identity_counts: {},
    identity_document_count: identityDocumentCount ?? inferredIdentityCount,
    actual_collection_names: [...REQUIRED_COLLECTIONS],
    missing_required_collections: [],
    required_collections_present: true,
  };
}

function createFakeRunner({
  baselineIdentityCount = 0,
  deleteExact = () => {},
  getInventory,
  initialInventory = Object.fromEntries(
    CLEANUP_COLLECTIONS.map((collection) => [collection, []])
  ),
}) {
  let prepared = true;
  let preparingInventory = true;
  return {
    deleteExact,
    discoverInventory: () => {
      if (preparingInventory) {
        preparingInventory = false;
        return structuredClone(initialInventory);
      }
      return getInventory();
    },
    readCollectionState() {
      if (prepared) {
        prepared = false;
        return createState({}, baselineIdentityCount);
      }
      const inventory = getInventory();
      return createState(countInventory(inventory));
    },
    readDocuments() {
      throw new Error("prepare should inspect the complete cleanup inventory");
    },
  };
}

function writePreparedManifest(manifestPath, runner) {
  prepareSmokeLifecycle({
    manifestPath,
    phoneCount: 1,
    phones: [PHONE],
    repository: {
      branch: "main",
      dirty: false,
      head: "abc",
      originMain: "abc",
    },
    runner,
    runId: "test-smoke",
    now: new Date(STARTED_AT),
  });
}

function removeDocuments(inventory, documents) {
  for (const [collection, ids] of Object.entries(documents)) {
    const deleted = new Set(ids);
    inventory[collection] = inventory[collection].filter(
      (document) => !deleted.has(document._id)
    );
  }
}
