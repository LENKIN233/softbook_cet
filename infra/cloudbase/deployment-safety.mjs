import {createHash, randomBytes as nodeRandomBytes} from "node:crypto";
import {
  existsSync,
  readlinkSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import {join, relative, resolve, sep} from "node:path";

export const DEV_ENV_ID = "test-d2gzcyxr9f7e80972";
export const DEV_FUNCTION_NAME = "softbook-api";
export const DEV_HTTP_PATH = "/softbook-api";
export const DEV_BASE_URL =
  "https://test-d2gzcyxr9f7e80972.service.tcloudbase.com/softbook-api";
export const CLOUDBASE_API_VERSION = "2018-06-08";
export const REQUIRED_DEPLOYMENT_NODE_VERSION = "22.13.0";

export const EXPECTED_FUNCTION_CONFIG = Object.freeze({
  description:
    "Softbook CET CloudBase dev v2 integration runtime (not production)",
  handler: "index.main",
  installDependency: false,
  memorySize: 256,
  runtime: "Nodejs20.19",
  timeout: 10,
});

export const REQUIRED_COLLECTIONS = Object.freeze([
  "softbook_account_deletions",
  "softbook_accounts",
  "softbook_auth_challenges",
  "softbook_auth_rate_limits",
  "softbook_auth_sessions",
  "softbook_beta_entitlements",
  "softbook_card_source_versions",
  "softbook_card_sources",
  "softbook_memberships",
  "softbook_membership_revisions",
  "softbook_daily_check_ins",
  "softbook_daily_progress",
  "softbook_learning_event_cursors",
  "softbook_learning_events",
  "softbook_learning_event_sequences",
  "softbook_learning_migration_revisions",
  "softbook_pilot_round_continuations",
  "softbook_pilot_entitlements",
  "softbook_learning_sessions",
  "softbook_learning_states",
  "softbook_space_action_lineages",
  "softbook_space_actions",
  "softbook_space_state_revisions",
  "softbook_space_states",
]);

export const MANAGED_RUNTIME_VALUES = Object.freeze({
  SOFTBOOK_LEARNING_EVENTS_BATCH_LIMIT: "9",
  SOFTBOOK_LEARNING_EVENTS_FUTURE_SKEW_SECONDS: "300",
  SOFTBOOK_LEARNING_EVENTS_RETENTION_DAYS: "90",
  SOFTBOOK_RUNTIME_MODE: "development",
  SOFTBOOK_SMS_DEV_CODE: "2468",
  SOFTBOOK_STORE_MODE: "cloudbase",
});

export const SECRET_RUNTIME_NAMES = Object.freeze([
  "SOFTBOOK_AUTH_INDEX_SECRET",
  "SOFTBOOK_AUTH_TOKEN_SECRET",
]);

const IDENTITY_PROBES = Object.freeze([
  {
    collection: "softbook_account_deletions",
    filter: {account_key: {$exists: true}},
    id: "account_deletions",
  },
  {
    collection: "softbook_accounts",
    filter: {account_key: {$exists: true}},
    id: "accounts",
  },
  {
    collection: "softbook_auth_challenges",
    filter: {_id: {$ne: "__provision__"}},
    id: "auth_challenges",
  },
  {
    collection: "softbook_auth_rate_limits",
    filter: {_id: {$ne: "__provision__"}},
    id: "auth_rate_limits",
  },
  {
    collection: "softbook_auth_sessions",
    filter: {_id: {$ne: "__provision__"}},
    id: "auth_sessions",
  },
  {
    collection: "softbook_beta_entitlements",
    filter: {phone_number: {$exists: true}},
    id: "beta_entitlements",
  },
  {
    collection: "softbook_membership_revisions",
    filter: {phone_number: {$exists: true}},
    id: "membership_revisions",
  },
  {
    collection: "softbook_learning_event_cursors",
    filter: {account_key: {$exists: true}},
    id: "learning_event_cursors",
  },
  {
    collection: "softbook_learning_events",
    filter: {account_key: {$exists: true}},
    id: "learning_events",
  },
  {
    collection: "softbook_learning_event_sequences",
    filter: {account_key: {$exists: true}},
    id: "learning_event_sequences",
  },
  {
    collection: "softbook_learning_migration_revisions",
    filter: {account_key: {$exists: true}},
    id: "learning_migration_revisions",
  },
  {
    collection: "softbook_pilot_round_continuations",
    filter: {account_key: {$exists: true}},
    id: "pilot_round_continuations",
  },
  {
    collection: "softbook_pilot_entitlements",
    filter: {phone_number: {$exists: true}},
    id: "pilot_entitlements",
  },
  {
    collection: "softbook_learning_sessions",
    filter: {account_key: {$exists: true}},
    id: "learning_sessions",
  },
  {
    collection: "softbook_learning_states",
    filter: {account_key: {$exists: true}},
    id: "learning_states_v2",
  },
  {
    collection: "softbook_space_action_lineages",
    filter: {account_key: {$exists: true}},
    id: "space_action_lineages",
  },
  {
    collection: "softbook_space_actions",
    filter: {account_key: {$exists: true}},
    id: "space_actions",
  },
  {
    collection: "softbook_space_state_revisions",
    filter: {account_key: {$exists: true}},
    id: "space_state_revisions",
  },
  {
    collection: "softbook_space_states",
    filter: {account_key: {$exists: true}},
    id: "space_states_v2",
  },
]);

const DEFAULT_MANIFEST_EXCLUDES = Object.freeze([".DS_Store", "result.json"]);

export function parseTcbJson(output) {
  const text = String(output ?? "").trim();
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "{" || text[index] === "[") {
      const parsed = parseJsonContainerAt(text, index);
      if (parsed !== undefined) return parsed;
    }
  }

  throw new Error("CloudBase CLI did not return a valid JSON payload.");
}

function parseJsonContainerAt(text, start) {
  const stack = [];
  let escaped = false;
  let quoted = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') {
      quoted = true;
      continue;
    }
    if (character === "{") stack.push("}");
    else if (character === "[") stack.push("]");
    else if (character === "}" || character === "]") {
      if (stack.pop() !== character) return undefined;
      if (stack.length === 0) {
        try {
          return JSON.parse(text.slice(start, index + 1));
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

export function validateTarget({
  baseUrl = DEV_BASE_URL,
  envId = DEV_ENV_ID,
  functionName = DEV_FUNCTION_NAME,
} = {}) {
  const errors = [];

  if (envId !== DEV_ENV_ID) {
    errors.push(
      `env must be the allowlisted development environment ${DEV_ENV_ID}`
    );
  }

  if (functionName !== DEV_FUNCTION_NAME) {
    errors.push(`function must be ${DEV_FUNCTION_NAME}`);
  }

  if (baseUrl !== DEV_BASE_URL) {
    errors.push(`base URL must be ${DEV_BASE_URL}`);
  }

  return {
    base_url: baseUrl,
    env_id: envId,
    errors,
    function_name: functionName,
    http_path: DEV_HTTP_PATH,
    ok: errors.length === 0,
  };
}

export function inspectEnvironment(payload) {
  const data = payload?.data;

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Environment detail is missing data.");
  }

  const database = Array.isArray(data.resources?.databases)
    ? data.resources.databases[0]
    : null;
  const errors = [];

  if (data.envId !== DEV_ENV_ID) {
    errors.push(`environment id must be ${DEV_ENV_ID}`);
  }

  if (data.status !== "NORMAL") {
    errors.push(`environment status must be NORMAL, received ${data.status}`);
  }

  if (data.region !== "ap-shanghai") {
    errors.push(
      `environment region must be ap-shanghai, received ${data.region}`
    );
  }

  if (!database || database.Status !== "RUNNING") {
    errors.push("CloudBase NoSQL database must be RUNNING");
  }

  return {
    alias: data.alias ?? null,
    database_instance_id: database?.InstanceId ?? null,
    database_status: database?.Status ?? null,
    env_id: data.envId ?? null,
    env_type: data.envType ?? null,
    errors,
    ok: errors.length === 0,
    package_name: data.packageName ?? null,
    region: data.region ?? null,
    status: data.status ?? null,
  };
}

export function extractFunctionState(payload) {
  const data = requireObject(payload?.data, "function detail data");
  const variables = data.Environment?.Variables;

  if (!Array.isArray(variables)) {
    throw new Error("Function detail is missing Environment.Variables.");
  }

  const runtimeValues = new Map();

  for (const variable of variables) {
    if (
      !variable ||
      typeof variable.Key !== "string" ||
      typeof variable.Value !== "string"
    ) {
      throw new Error(
        "Function detail contains an invalid environment variable."
      );
    }

    if (runtimeValues.has(variable.Key)) {
      throw new Error(
        `Function detail contains duplicate variable ${variable.Key}.`
      );
    }

    runtimeValues.set(variable.Key, variable.Value);
  }

  return {
    public: {
      available_status: data.AvailableStatus ?? null,
      code_size: normalizeCloudBaseNumber(data.CodeSize),
      deploy_mode: data.DeployMode ?? null,
      description: data.Description ?? null,
      function_name: data.FunctionName ?? null,
      handler: data.Handler ?? null,
      install_dependency: data.InstallDependency ?? null,
      memory_size: normalizeCloudBaseNumber(data.MemorySize),
      modified_at: data.ModTime ?? null,
      qualifier: data.Qualifier ?? null,
      runtime: data.Runtime ?? null,
      status: data.Status ?? null,
      timeout: normalizeCloudBaseNumber(data.Timeout),
      trigger_count: Array.isArray(data.Triggers) ? data.Triggers.length : null,
      type: data.Type ?? null,
      variable_names: [...runtimeValues.keys()].sort(),
      version: data.FunctionVersion ?? null,
    },
    runtimeValues,
  };
}

export function inspectFunctionAndRuntime(functionState, counts = new Map()) {
  const errors = [];
  const metadata = functionState.public;
  const values = functionState.runtimeValues;

  compareExpected(
    errors,
    "function name",
    metadata.function_name,
    DEV_FUNCTION_NAME
  );
  compareExpected(
    errors,
    "function runtime",
    metadata.runtime,
    EXPECTED_FUNCTION_CONFIG.runtime
  );
  compareExpected(
    errors,
    "function handler",
    metadata.handler,
    EXPECTED_FUNCTION_CONFIG.handler
  );
  compareExpected(
    errors,
    "function memory",
    metadata.memory_size,
    EXPECTED_FUNCTION_CONFIG.memorySize
  );
  compareExpected(
    errors,
    "function timeout",
    metadata.timeout,
    EXPECTED_FUNCTION_CONFIG.timeout
  );
  compareExpected(errors, "function type", metadata.type, "Event");
  compareExpected(errors, "function deploy mode", metadata.deploy_mode, "code");
  compareExpected(
    errors,
    "function dependency installation",
    metadata.install_dependency,
    EXPECTED_FUNCTION_CONFIG.installDependency ? "TRUE" : "FALSE"
  );

  if (metadata.trigger_count !== 0) {
    errors.push(
      `function trigger count must be 0 for HTTP access-service routing, received ${metadata.trigger_count}`
    );
  }

  if (metadata.status !== "Active") {
    errors.push(`function status must be Active, received ${metadata.status}`);
  }

  if (metadata.available_status !== "Available") {
    errors.push(
      `function availability must be Available, received ${metadata.available_status}`
    );
  }

  for (const [name, expectedValue] of Object.entries(MANAGED_RUNTIME_VALUES)) {
    if (!values.has(name)) {
      errors.push(`runtime variable ${name} is missing`);
      continue;
    }

    if (values.get(name) !== expectedValue) {
      errors.push(`runtime variable ${name} does not match the dev contract`);
    }
  }

  const tokenSecret = values.get("SOFTBOOK_AUTH_TOKEN_SECRET");
  const indexSecret = values.get("SOFTBOOK_AUTH_INDEX_SECRET");

  if (!isStrongSecret(tokenSecret)) {
    errors.push(
      "runtime token secret is missing or fails the 32-character diversity policy"
    );
  }

  if (!isStrongSecret(indexSecret)) {
    errors.push(
      "runtime index secret is missing or fails the 32-character diversity policy"
    );
  }

  if (
    isStrongSecret(tokenSecret) &&
    isStrongSecret(indexSecret) &&
    tokenSecret === indexSecret
  ) {
    errors.push("runtime token and index secrets must be distinct");
  }

  if (metadata.description !== EXPECTED_FUNCTION_CONFIG.description) {
    errors.push("function description does not match the current dev boundary");
  }

  const unknownVariableNames = [...values.keys()]
    .filter(
      (name) =>
        !Object.hasOwn(MANAGED_RUNTIME_VALUES, name) &&
        !SECRET_RUNTIME_NAMES.includes(name)
    )
    .sort();
  const identityDocumentCount = sumIdentityDocuments(counts);

  return {
    errors,
    identity_document_count: identityDocumentCount,
    ok: errors.length === 0,
    runtime_configuration: {
      index_secret_configured: isStrongSecret(indexSecret),
      managed_values_match: Object.entries(MANAGED_RUNTIME_VALUES).every(
        ([name, expectedValue]) => values.get(name) === expectedValue
      ),
      secret_values_distinct:
        isStrongSecret(tokenSecret) &&
        isStrongSecret(indexSecret) &&
        tokenSecret !== indexSecret,
      token_secret_configured: isStrongSecret(tokenSecret),
      unknown_variable_names: unknownVariableNames,
      variable_names: [...values.keys()].sort(),
    },
    warnings: [],
  };
}

export function planRuntimeConfiguration(
  functionState,
  counts,
  randomBytes = nodeRandomBytes
) {
  const nextValues = new Map(functionState.runtimeValues);
  const changes = [];
  const identityDocumentCount = sumIdentityDocuments(counts);

  for (const [name, expectedValue] of Object.entries(MANAGED_RUNTIME_VALUES)) {
    if (nextValues.get(name) !== expectedValue) {
      const hadValue = nextValues.has(name);
      nextValues.set(name, expectedValue);
      changes.push({
        action: hadValue ? "set" : "add",
        name,
        secret: false,
      });
    }
  }

  for (const name of SECRET_RUNTIME_NAMES) {
    const currentValue = nextValues.get(name);

    if (isStrongSecret(currentValue)) {
      continue;
    }

    if (identityDocumentCount > 0) {
      throw new Error(
        `Cannot generate ${name} while ${identityDocumentCount} identity-bound documents exist.`
      );
    }

    nextValues.set(name, generateStrongSecret(randomBytes));
    changes.push({
      action: currentValue === undefined ? "generate" : "replace_weak",
      name,
      secret: true,
    });
  }

  if (
    nextValues.get("SOFTBOOK_AUTH_TOKEN_SECRET") ===
    nextValues.get("SOFTBOOK_AUTH_INDEX_SECRET")
  ) {
    if (identityDocumentCount > 0) {
      throw new Error(
        "Cannot separate matching auth secrets while identity-bound documents exist."
      );
    }

    nextValues.set(
      "SOFTBOOK_AUTH_INDEX_SECRET",
      generateStrongSecret(randomBytes)
    );
    changes.push({
      action: "replace_matching",
      name: "SOFTBOOK_AUTH_INDEX_SECRET",
      secret: true,
    });
  }

  return {
    changes,
    identity_document_count: identityDocumentCount,
    nextValues,
    public_summary: {
      changed_variable_names: [
        ...new Set(changes.map((change) => change.name)),
      ].sort(),
      generated_secret_names: changes
        .filter((change) => change.secret)
        .map((change) => change.name)
        .sort(),
      preserved_unknown_variable_names: [...nextValues.keys()]
        .filter(
          (name) =>
            !Object.hasOwn(MANAGED_RUNTIME_VALUES, name) &&
            !SECRET_RUNTIME_NAMES.includes(name)
        )
        .sort(),
      variable_names: [...nextValues.keys()].sort(),
    },
  };
}

export function buildCountProbes() {
  return [
    ...REQUIRED_COLLECTIONS.map((collection) => ({
      collection,
      filter: {},
      id: `collection:${collection}`,
      kind: "collection",
    })),
    ...IDENTITY_PROBES.map((probe) => ({
      ...probe,
      id: `identity:${probe.id}`,
      kind: "identity",
    })),
  ];
}

export function buildCountCommand(probes = buildCountProbes()) {
  return JSON.stringify(
    probes.map((probe) => ({
      Command: JSON.stringify({
        count: probe.collection,
        query: probe.filter,
      }),
      CommandType: "COMMAND",
      TableName: probe.collection,
    }))
  );
}

export function parseCountResults(payload, probes = buildCountProbes()) {
  const results = payload?.data?.results;

  if (!Array.isArray(results) || results.length !== probes.length) {
    throw new Error(
      "CloudBase count response does not match requested probes."
    );
  }

  const counts = new Map();

  probes.forEach((probe, index) => {
    const result = results[index];
    const value = Array.isArray(result) ? result[0] : null;
    const ok = normalizeCloudBaseNumber(value?.ok);
    const count = normalizeCloudBaseNumber(value?.n);

    if (ok !== 1 || !Number.isInteger(count) || count < 0) {
      throw new Error(`CloudBase count probe ${probe.id} failed.`);
    }

    counts.set(probe.id, count);
  });

  return counts;
}

export function summarizeCollectionState(counts, collectionNames) {
  const collectionCounts = {};
  const identityCounts = {};
  const actualCollectionNames = [...new Set(collectionNames)].sort();
  const actualCollectionNameSet = new Set(actualCollectionNames);

  for (const [id, count] of counts.entries()) {
    if (id.startsWith("collection:")) {
      collectionCounts[id.slice("collection:".length)] = count;
    } else if (id.startsWith("identity:")) {
      identityCounts[id.slice("identity:".length)] = count;
    }
  }

  return {
    collection_counts: collectionCounts,
    identity_counts: identityCounts,
    identity_document_count: Object.values(identityCounts).reduce(
      (sum, count) => sum + count,
      0
    ),
    actual_collection_names: actualCollectionNames,
    missing_required_collections: REQUIRED_COLLECTIONS.filter(
      (name) => !actualCollectionNameSet.has(name)
    ),
    required_collections_present: REQUIRED_COLLECTIONS.every((name) =>
      actualCollectionNameSet.has(name)
    ),
  };
}

export function inspectCollectionCatalog(payload) {
  const data = payload?.data;
  const tables = data?.Tables === null ? [] : data?.Tables;
  const pager = data?.Pager;

  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray(tables) ||
    !pager ||
    !Number.isInteger(pager.Total) ||
    pager.Total < 0
  ) {
    throw new Error("CloudBase collection catalog is invalid.");
  }

  const collectionNames = tables.map((table) => {
    if (!table || typeof table.TableName !== "string" || !table.TableName) {
      throw new Error(
        "CloudBase collection catalog contains an invalid table."
      );
    }

    return table.TableName;
  });
  const uniqueNames = [...new Set(collectionNames)].sort();

  if (uniqueNames.length !== collectionNames.length) {
    throw new Error("CloudBase collection catalog contains duplicate tables.");
  }

  if (pager.Total !== collectionNames.length) {
    throw new Error(
      `CloudBase collection catalog is incomplete: received ${collectionNames.length} of ${pager.Total}.`
    );
  }

  return {
    collection_names: uniqueNames,
    missing_required_collections: REQUIRED_COLLECTIONS.filter(
      (name) => !uniqueNames.includes(name)
    ),
    required_collections_present: REQUIRED_COLLECTIONS.every((name) =>
      uniqueNames.includes(name)
    ),
    total: pager.Total,
  };
}

export function buildDescribeTablesArguments(databaseInstanceId) {
  const tag = requireDatabaseInstanceId(databaseInstanceId);

  return [
    "-e",
    DEV_ENV_ID,
    "api",
    "tcb",
    "DescribeTables",
    "--api-version",
    CLOUDBASE_API_VERSION,
    "--body",
    JSON.stringify({MgoLimit: 100, MgoOffset: 0, Tag: tag}),
    "--json",
  ];
}

export function buildCreateTableArguments(databaseInstanceId, tableName) {
  const tag = requireDatabaseInstanceId(databaseInstanceId);

  if (!REQUIRED_COLLECTIONS.includes(tableName)) {
    throw new Error(
      `Collection is not allowlisted for provisioning: ${tableName}`
    );
  }

  return [
    "-e",
    DEV_ENV_ID,
    "api",
    "tcb",
    "CreateTable",
    "--api-version",
    CLOUDBASE_API_VERSION,
    "--body",
    JSON.stringify({TableName: tableName, Tag: tag}),
    "--json",
  ];
}

function requireDatabaseInstanceId(value) {
  if (typeof value !== "string" || !/^tnt-[a-z0-9]+$/.test(value)) {
    throw new Error("CloudBase database instance ID is missing or invalid.");
  }

  return value;
}

export function evaluateRepositoryState({branch, head, originMain, porcelain}) {
  const errors = [];

  if (branch !== "main") {
    errors.push(
      `deployment requires branch main, received ${branch || "detached"}`
    );
  }

  if (head !== originMain) {
    errors.push("deployment requires HEAD to equal origin/main");
  }

  if (String(porcelain ?? "").trim() !== "") {
    errors.push("deployment requires a clean tracked and untracked worktree");
  }

  return {
    branch,
    clean: String(porcelain ?? "").trim() === "",
    errors,
    head,
    ok: errors.length === 0,
    origin_main: originMain,
  };
}

export function createSourceManifest(
  rootDirectory,
  {
    excludeDirectories = ["node_modules", "test"],
    excludeFiles = DEFAULT_MANIFEST_EXCLUDES,
  } = {}
) {
  const root = resolve(rootDirectory);

  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`Manifest root is not a directory: ${root}`);
  }

  const files = [];
  walk(root, root, files, new Set(excludeDirectories), new Set(excludeFiles));
  files.sort((left, right) => left.path.localeCompare(right.path));
  const digest = createHash("sha256")
    .update(JSON.stringify(files))
    .digest("hex");

  return {
    files,
    sha256: digest,
  };
}

export function compareSourceManifests(expected, actual) {
  const expectedByPath = new Map(
    expected.files.map((file) => [file.path, file.sha256])
  );
  const actualByPath = new Map(
    actual.files.map((file) => [file.path, file.sha256])
  );
  const missing = [];
  const unexpected = [];
  const changed = [];

  for (const [path, sha256] of expectedByPath.entries()) {
    if (!actualByPath.has(path)) {
      missing.push(path);
    } else if (actualByPath.get(path) !== sha256) {
      changed.push(path);
    }
  }

  for (const path of actualByPath.keys()) {
    if (!expectedByPath.has(path)) {
      unexpected.push(path);
    }
  }

  return {
    changed: changed.sort(),
    missing: missing.sort(),
    ok:
      missing.length === 0 &&
      unexpected.length === 0 &&
      changed.length === 0 &&
      expected.sha256 === actual.sha256,
    unexpected: unexpected.sort(),
  };
}

export function identifyPublishedVersion(
  beforeVersions,
  afterVersions,
  description
) {
  if (!Array.isArray(beforeVersions) || !Array.isArray(afterVersions)) {
    throw new Error("Function version snapshots must be arrays.");
  }

  const previousIds = new Set(
    beforeVersions
      .map((version) => version?.version)
      .filter((version) => version !== null && version !== undefined)
      .map(String)
  );
  const candidates = afterVersions.filter(
    (version) =>
      version?.description === description &&
      version?.version !== null &&
      version?.version !== undefined &&
      !previousIds.has(String(version.version))
  );

  if (candidates.length !== 1) {
    throw new Error(
      `Expected one newly published function version for "${description}", received ${candidates.length}.`
    );
  }

  return candidates[0];
}

export function nativeModulePaths(manifest) {
  if (!manifest || !Array.isArray(manifest.files)) {
    throw new Error("Package manifest must contain files.");
  }

  return manifest.files
    .map((file) => file.path)
    .filter((path) => typeof path === "string" && path.endsWith(".node"))
    .sort();
}

export function nodeVersionAtLeast(version, minimumVersion = "20.19.0") {
  const actual = parseVersion(version);
  const minimum = parseVersion(minimumVersion);

  for (let index = 0; index < minimum.length; index += 1) {
    if (actual[index] > minimum[index]) {
      return true;
    }

    if (actual[index] < minimum[index]) {
      return false;
    }
  }

  return true;
}

export function redactText(value) {
  return String(value ?? "")
    .replace(
      /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
      "<redacted-private-key>"
    )
    .replace(
      /("Key"\s*:\s*"[^"]*(?:secret|token|authorization|api[_-]?key|private[_-]?key)[^"]*"\s*,\s*"Value"\s*:\s*")[^"]*(")/gi,
      "$1<redacted>$2"
    )
    .replace(/\b1\d{10}\b/g, "<redacted-phone>")
    .replace(
      /(?<![A-Za-z0-9_])account_[A-Za-z0-9_-]{24,128}(?![A-Za-z0-9_-])/g,
      "<redacted-account-instance>"
    )
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{12,}\b/gi, "$1<redacted-token>")
    .replace(
      /((?:[A-Za-z0-9_-]*(?:secret|token|authorization|api[_-]?key)[A-Za-z0-9_-]*)["']?\s*[=:]\s*["']?)[^"'\s,;}]+/gi,
      "$1<redacted>"
    );
}

export function normalizeCloudBaseNumber(value) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (value && typeof value === "object") {
    for (const key of ["$numberInt", "$numberLong", "$numberDouble"]) {
      if (Object.hasOwn(value, key)) {
        return normalizeCloudBaseNumber(value[key]);
      }
    }
  }

  return null;
}

export function isStrongSecret(value) {
  return (
    typeof value === "string" &&
    value.length >= 32 &&
    new Set(value).size >= 12 &&
    value !== "softbook-cloudbase-dev-secret"
  );
}

function generateStrongSecret(randomBytes) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = randomBytes(48).toString("base64url");

    if (isStrongSecret(candidate)) {
      return candidate;
    }
  }

  throw new Error("Secure random source did not produce a strong auth secret.");
}

function sumIdentityDocuments(counts) {
  let total = 0;

  for (const [id, count] of counts.entries()) {
    if (id.startsWith("identity:")) {
      total += count;
    }
  }

  return total;
}

function compareExpected(errors, label, actual, expected) {
  if (actual !== expected) {
    errors.push(`${label} must be ${expected}, received ${String(actual)}`);
  }
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value;
}

function parseVersion(value) {
  const match = String(value ?? "")
    .replace(/^v/, "")
    .match(/^(\d+)\.(\d+)\.(\d+)/);

  if (!match) {
    throw new Error(`Invalid Node version: ${String(value)}`);
  }

  return match.slice(1).map(Number);
}

function walk(root, directory, files, excludedDirectories, excludedFiles) {
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) {
      continue;
    }

    if (entry.isFile() && excludedFiles.has(entry.name)) {
      continue;
    }

    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(root, absolutePath, files, excludedDirectories, excludedFiles);
      continue;
    }

    if (entry.isSymbolicLink()) {
      const target = readlinkSync(absolutePath);
      files.push({
        path: relative(root, absolutePath).split(sep).join("/"),
        sha256: createHash("sha256").update(`symlink:${target}`).digest("hex"),
        size_bytes: Buffer.byteLength(target),
        type: "symlink",
      });
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const content = readFileSync(absolutePath);
    files.push({
      path: relative(root, absolutePath).split(sep).join("/"),
      sha256: createHash("sha256").update(content).digest("hex"),
      size_bytes: content.byteLength,
    });
  }
}
