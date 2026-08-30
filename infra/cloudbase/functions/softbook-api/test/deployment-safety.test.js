const assert = require("node:assert/strict");
const {spawnSync} = require("node:child_process");
const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} = require("node:fs");
const {tmpdir} = require("node:os");
const {join, resolve} = require("node:path");
const {pathToFileURL} = require("node:url");
const {after, before, test} = require("node:test");

let safety;
let manager;
const temporaryDirectories = [];
const indexSecret = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuv";
const tokenSecret = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL";

before(async () => {
  const safetyPath =
    process.env.SOFTBOOK_DEPLOYMENT_SAFETY_MODULE ||
    resolve(__dirname, "../../../deployment-safety.mjs");
  const managerPath =
    process.env.SOFTBOOK_CLOUDBASE_MANAGER_MODULE ||
    resolve(__dirname, "../../../manage-softbook-api.mjs");
  safety = await import(pathToFileURL(safetyPath));
  manager = await import(pathToFileURL(managerPath));
});

after(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, {force: true, recursive: true});
  }
});

test("CloudBase JSON parsing tolerates CLI progress lines", () => {
  const payload = safety.parseTcbJson(
    '- Loading data...\nTip: use --yes\n{\n  "data": {"status": "NORMAL"}\n}'
  );

  assert.deepEqual(payload, {data: {status: "NORMAL"}});
  assert.throws(
    () => safety.parseTcbJson("- Loading data...\nnot-json"),
    /valid JSON payload/
  );
});

test("deployment target is locked to the one development environment", () => {
  assert.equal(safety.validateTarget().ok, true);
  assert.equal(safety.validateTarget({envId: "prod-environment"}).ok, false);
  assert.equal(
    safety.validateTarget({
      baseUrl: "https://example.invalid/softbook-api",
    }).ok,
    false
  );
});

test("deployment manager enforces the CloudBase Node runtime floor", () => {
  assert.equal(safety.nodeVersionAtLeast("20.19.0"), true);
  assert.equal(safety.nodeVersionAtLeast("22.13.0"), true);
  assert.equal(safety.nodeVersionAtLeast("20.18.9"), false);
  assert.throws(() => safety.nodeVersionAtLeast("not-a-version"));
  assert.deepEqual(manager.inspectToolchain("22.13.0", "darwin", "arm64"), {
    arch: "arm64",
    matches_required_node: true,
    node: "v22.13.0",
    platform: "darwin",
    required_node: "v22.13.0",
  });
  assert.equal(
    manager.inspectToolchain("24.15.0").matches_required_node,
    false
  );
});

test("function inspection validates metadata without exposing secret values", () => {
  const functionState = safety.extractFunctionState(
    functionPayload({
      SOFTBOOK_AUTH_INDEX_SECRET: indexSecret,
      SOFTBOOK_AUTH_TOKEN_SECRET: tokenSecret,
      ...safety.MANAGED_RUNTIME_VALUES,
      UNRELATED_SETTING: "preserved",
    })
  );
  const inspection = safety.inspectFunctionAndRuntime(functionState, new Map());
  const serialized = JSON.stringify(inspection);

  assert.equal(inspection.ok, true);
  assert.deepEqual(inspection.runtime_configuration.unknown_variable_names, [
    "UNRELATED_SETTING",
  ]);
  assert.equal(serialized.includes(indexSecret), false);
  assert.equal(serialized.includes(tokenSecret), false);
  assert.equal(serialized.includes("preserved"), false);
});

test("function inspection fails closed on weak or missing runtime secrets", () => {
  const functionState = safety.extractFunctionState(
    functionPayload({
      ...safety.MANAGED_RUNTIME_VALUES,
      SOFTBOOK_AUTH_TOKEN_SECRET: "short",
    })
  );
  const inspection = safety.inspectFunctionAndRuntime(functionState, new Map());

  assert.equal(inspection.ok, false);
  assert.match(inspection.errors.join("\n"), /token secret/);
  assert.match(inspection.errors.join("\n"), /index secret/);
  assert.equal(safety.isStrongSecret("x".repeat(64)), false);
});

test("function inspection treats the dev-only description as deployable metadata", () => {
  const payload = functionPayload({
    SOFTBOOK_AUTH_INDEX_SECRET: indexSecret,
    SOFTBOOK_AUTH_TOKEN_SECRET: tokenSecret,
    ...safety.MANAGED_RUNTIME_VALUES,
  });
  payload.data.Description = "ambiguous runtime";
  const inspection = safety.inspectFunctionAndRuntime(
    safety.extractFunctionState(payload),
    new Map()
  );

  assert.equal(inspection.ok, false);
  assert.match(inspection.errors.join("\n"), /description/);
});

test("function inspection requires bundled dependencies", () => {
  const payload = functionPayload({
    SOFTBOOK_AUTH_INDEX_SECRET: indexSecret,
    SOFTBOOK_AUTH_TOKEN_SECRET: tokenSecret,
    ...safety.MANAGED_RUNTIME_VALUES,
  });
  payload.data.InstallDependency = "TRUE";
  const inspection = safety.inspectFunctionAndRuntime(
    safety.extractFunctionState(payload),
    new Map()
  );

  assert.equal(safety.EXPECTED_FUNCTION_CONFIG.installDependency, false);
  assert.equal(inspection.ok, false);
  assert.match(inspection.errors.join("\n"), /dependency installation/);
});

test("runtime configuration plans stable strong secrets only before identity data exists", () => {
  const functionState = safety.extractFunctionState(
    functionPayload({
      SOFTBOOK_STORE_MODE: "memory",
      UNRELATED_SETTING: "preserved",
    })
  );
  let call = 0;
  const plan = safety.planRuntimeConfiguration(
    functionState,
    new Map([["identity:auth_sessions", 0]]),
    (size) => {
      call += 1;
      return Buffer.from(
        Array.from({length: size}, (_, index) => (index + call * 37) % 256)
      );
    }
  );

  assert.equal(plan.nextValues.get("UNRELATED_SETTING"), "preserved");
  assert.equal(
    plan.nextValues.get("SOFTBOOK_STORE_MODE"),
    safety.MANAGED_RUNTIME_VALUES.SOFTBOOK_STORE_MODE
  );
  assert.notEqual(
    plan.nextValues.get("SOFTBOOK_AUTH_INDEX_SECRET"),
    plan.nextValues.get("SOFTBOOK_AUTH_TOKEN_SECRET")
  );
  assert.deepEqual(plan.public_summary.generated_secret_names, [
    "SOFTBOOK_AUTH_INDEX_SECRET",
    "SOFTBOOK_AUTH_TOKEN_SECRET",
  ]);
  assert.equal(
    JSON.stringify(plan.public_summary).includes(':"preserved"'),
    false
  );

  assert.throws(
    () =>
      safety.planRuntimeConfiguration(
        functionState,
        new Map([["identity:auth_sessions", 1]])
      ),
    /identity-bound documents exist/
  );
  assert.throws(
    () =>
      safety.planRuntimeConfiguration(
        functionState,
        new Map([["identity:auth_sessions", 0]]),
        (size) => Buffer.alloc(size, 1)
      ),
    /random source/
  );
});

test("collection probes parse extended JSON counts and preserve probe identity", () => {
  const probes = safety.buildCountProbes().slice(0, 2);
  const command = JSON.parse(safety.buildCountCommand(probes));
  const counts = safety.parseCountResults(
    {
      data: {
        results: [
          [{n: {$numberInt: "3"}, ok: {$numberDouble: "1.0"}}],
          [{n: {$numberLong: "0"}, ok: {$numberDouble: "1.0"}}],
        ],
      },
    },
    probes
  );

  assert.equal(command.length, 2);
  assert.equal(counts.get(probes[0].id), 3);
  assert.equal(counts.get(probes[1].id), 0);
});

test("real collection catalog prevents zero-count false positives", () => {
  const counts = new Map(
    safety.REQUIRED_COLLECTIONS.map((collection) => [
      `collection:${collection}`,
      0,
    ])
  );
  const catalog = safety.inspectCollectionCatalog({
    data: {
      Pager: {Limit: 100, Offset: 0, Total: 2},
      Tables: [
        {TableName: "softbook_card_sources"},
        {TableName: "softbook_memberships"},
      ],
    },
  });
  const summary = safety.summarizeCollectionState(
    counts,
    catalog.collection_names
  );

  assert.equal(catalog.required_collections_present, false);
  assert.equal(summary.required_collections_present, false);
  assert.equal(
    summary.missing_required_collections.includes("softbook_auth_sessions"),
    true
  );
  assert.deepEqual(
    safety.inspectCollectionCatalog({
      data: {
        Pager: {Limit: 100, Offset: 0, Total: 0},
        Tables: null,
      },
    }).collection_names,
    []
  );
  assert.throws(
    () =>
      safety.inspectCollectionCatalog({
        data: {
          Pager: {Limit: 1, Offset: 0, Total: 2},
          Tables: [{TableName: "softbook_card_sources"}],
        },
      }),
    /incomplete/
  );
});

test("collection management commands are environment and table allowlisted", () => {
  const listArguments =
    safety.buildDescribeTablesArguments("tnt-contract123");
  const createArguments = safety.buildCreateTableArguments(
    "tnt-contract123",
    "softbook_auth_sessions"
  );

  assert.deepEqual(listArguments.slice(0, 5), [
    "-e",
    safety.DEV_ENV_ID,
    "api",
    "tcb",
    "DescribeTables",
  ]);
  assert.equal(
    listArguments[listArguments.indexOf("--api-version") + 1],
    safety.CLOUDBASE_API_VERSION
  );
  assert.equal(JSON.parse(listArguments.at(-2)).Tag, "tnt-contract123");
  assert.equal(createArguments.includes("CreateTable"), true);
  assert.equal(
    createArguments[createArguments.indexOf("--api-version") + 1],
    safety.CLOUDBASE_API_VERSION
  );
  assert.deepEqual(JSON.parse(createArguments.at(-2)), {
    TableName: "softbook_auth_sessions",
    Tag: "tnt-contract123",
  });
  assert.throws(
    () =>
      safety.buildCreateTableArguments(
        "tnt-contract123",
        "unrelated_collection"
      ),
    /not allowlisted/
  );
  assert.throws(() => safety.buildDescribeTablesArguments("production"));
});

test("environment inspection exposes only the database instance identifier", () => {
  const inspection = safety.inspectEnvironment({
    data: {
      alias: "development",
      envId: safety.DEV_ENV_ID,
      envType: "BASIC",
      packageName: "BASIC",
      region: "ap-shanghai",
      resources: {
        databases: [{InstanceId: "tnt-contract123", Status: "RUNNING"}],
      },
      status: "NORMAL",
    },
  });

  assert.equal(inspection.ok, true);
  assert.equal(inspection.database_instance_id, "tnt-contract123");
});

test("repository deployment state requires clean main at exact origin main", () => {
  assert.equal(
    safety.evaluateRepositoryState({
      branch: "main",
      head: "abc",
      originMain: "abc",
      porcelain: "",
    }).ok,
    true
  );
  const invalid = safety.evaluateRepositoryState({
    branch: "infra/topic",
    head: "abc",
    originMain: "def",
    porcelain: "?? local.txt\n",
  });

  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors.length, 3);
});

test("source manifests ignore tests and dependencies but detect runtime drift", () => {
  const first = makeManifestFixture();
  const second = makeManifestFixture();
  writeFileSync(join(first, "index.js"), "module.exports = 1;\n");
  writeFileSync(join(second, "index.js"), "module.exports = 1;\n");
  writeFileSync(join(first, "test", "fixture.js"), "ignored one\n");
  writeFileSync(join(second, "test", "fixture.js"), "ignored two\n");
  writeFileSync(join(first, "node_modules", "dep.js"), "ignored one\n");
  writeFileSync(join(second, "node_modules", "dep.js"), "ignored two\n");

  const firstManifest = safety.createSourceManifest(first);
  const secondManifest = safety.createSourceManifest(second);
  assert.equal(
    safety.compareSourceManifests(firstManifest, secondManifest).ok,
    true
  );

  writeFileSync(join(second, "index.js"), "module.exports = 2;\n");
  const changed = safety.compareSourceManifests(
    firstManifest,
    safety.createSourceManifest(second)
  );
  assert.equal(changed.ok, false);
  assert.deepEqual(changed.changed, ["index.js"]);

  symlinkSync("dep.js", join(first, "node_modules", "dep-link.js"));
  symlinkSync("different.js", join(second, "node_modules", "dep-link.js"));
  const firstFull = safety.createSourceManifest(first, {
    excludeDirectories: [],
  });
  const secondFull = safety.createSourceManifest(second, {
    excludeDirectories: [],
  });
  const fullComparison = safety.compareSourceManifests(firstFull, secondFull);
  assert.equal(fullComparison.ok, false);
  assert.equal(
    fullComparison.changed.includes("node_modules/dep-link.js"),
    true
  );
  assert.deepEqual(
    safety.nativeModulePaths({
      files: [{path: "node_modules/native/addon.node"}, {path: "index.js"}],
    }),
    ["node_modules/native/addon.node"]
  );
});

test("published versions require one new immutable ID with the exact description", () => {
  const before = [
    {description: "older", version: "1"},
    {description: "", version: "$LATEST"},
  ];
  const published = {
    created_at: "2026-07-26 12:00:00",
    description: "verified run-123",
    modified_at: "2026-07-26 12:00:00",
    status: "Active",
    version: "2",
  };

  assert.deepEqual(
    safety.identifyPublishedVersion(
      before,
      [published, ...before],
      published.description
    ),
    published
  );
  assert.throws(
    () =>
      safety.identifyPublishedVersion(before, before, published.description),
    /received 0/
  );
  assert.throws(
    () =>
      safety.identifyPublishedVersion(
        before,
        [published, {...published, version: "3"}, ...before],
        published.description
      ),
    /received 2/
  );
});

test("log redaction removes phone, bearer token, and secret assignments", () => {
  const pem =
    "-----BEGIN PRIVATE KEY-----\nVERY-SECRET-PEM-BYTES\n-----END PRIVATE KEY-----";
  const redacted = safety.redactText(
    `phone=19012345678 account_${'a'.repeat(24)} Authorization: Bearer abcdefghijklmnopqrstuvwxyz token=very-secret-value "refresh_token":"json-secret-value" SOFTBOOK_AUTH_TOKEN_SECRET=env-secret-value {"Key":"SOFTBOOK_AUTH_INDEX_SECRET","Value":"cloudbase-json-secret"} ${pem}`
  );

  assert.equal(redacted.includes("19012345678"), false);
  assert.equal(redacted.includes(`account_${'a'.repeat(24)}`), false);
  assert.equal(redacted.includes("abcdefghijklmnopqrstuvwxyz"), false);
  assert.equal(redacted.includes("very-secret-value"), false);
  assert.equal(redacted.includes("json-secret-value"), false);
  assert.equal(redacted.includes("env-secret-value"), false);
  assert.equal(redacted.includes("cloudbase-json-secret"), false);
  assert.equal(redacted.includes("VERY-SECRET-PEM-BYTES"), false);
});

test("manager arguments default every cloud write to dry-run", () => {
  assert.deepEqual(manager.parseArguments(["deploy"]), {
    apply: false,
    backup: null,
    command: "deploy",
    format: "text",
    output: null,
    requireMain: false,
  });
  assert.equal(manager.parseArguments(["configure", "--apply"]).apply, true);
  assert.throws(
    () => manager.parseArguments(["deploy", "--unknown"]),
    (error) => error.exitCode === 2
  );
  assert.throws(
    () => manager.parseArguments(["preflight", "--apply"]),
    (error) => error.exitCode === 2
  );
  assert.throws(
    () => manager.parseArguments(["rollback"]),
    /requires --backup/
  );
});

test("managed CloudBase config contains complete values only in memory", () => {
  const runtimeValues = new Map([
    ["SOFTBOOK_AUTH_INDEX_SECRET", indexSecret],
    ["SOFTBOOK_AUTH_TOKEN_SECRET", tokenSecret],
    ...Object.entries(safety.MANAGED_RUNTIME_VALUES),
  ]);
  const config = manager.buildCloudBaseConfig(runtimeValues);

  assert.equal(config.envId, safety.DEV_ENV_ID);
  assert.equal(config.functions[0].handler, "index.main");
  assert.equal(config.functions[0].installDependency, false);
  assert.equal(
    config.functions[0].description,
    safety.EXPECTED_FUNCTION_CONFIG.description
  );
  assert.deepEqual(
    Object.keys(config.functions[0].envVariables).sort(),
    [...runtimeValues.keys()].sort()
  );
});

test("runtime configuration update is explicitly non-interactive", () => {
  assert.deepEqual(manager.buildFunctionConfigUpdateArguments(), [
    "config",
    "update",
    "fn",
    safety.DEV_FUNCTION_NAME,
    "--yes",
    "--json",
  ]);
});

test("deployment artifacts include runtime dependencies without npm command shims", () => {
  assert.equal(
    manager.shouldIncludeArtifactPath(
      join("node_modules", "semver", "index.js"),
      {includeNodeModules: true}
    ),
    true
  );
  assert.equal(
    manager.shouldIncludeArtifactPath(join("node_modules", ".bin", "semver"), {
      includeNodeModules: true,
    }),
    false
  );
  assert.equal(
    manager.shouldIncludeArtifactPath(join("test", "runtime.test.js")),
    false
  );
});

test("tracked function config and deployment verification preserve the exact package", () => {
  const config = JSON.parse(
    readFileSync(resolve(__dirname, "../../../cloudbaserc.json"), "utf8")
  );
  const managerSource = readFileSync(
    resolve(__dirname, "../../../manage-softbook-api.mjs"),
    "utf8"
  );

  assert.equal(config.functions[0].installDependency, false);
  assert.match(
    managerSource,
    /verifyRemoteManifest\(\s*context,\s*build\.packageManifest,\s*"deployed-verification",\s*\{fullPackage: true\}/
  );
  assert.doesNotMatch(
    managerSource,
    /verifyRemoteManifest\(\s*context,\s*build\.manifest,\s*"deployed-verification"/
  );
});

test("legacy shell deploy entry delegates to the guarded manager", () => {
  const scriptPath = resolve(__dirname, "../../../deploy-softbook-api.sh");
  const script = readFileSync(scriptPath, "utf8");

  assert.match(script, /manage-softbook-api\.mjs" deploy/);
  assert.doesNotMatch(script, /tcb fn deploy/);
  assert.doesNotMatch(script, /--force/);
});

test("NoSQL provisioning is dry-run unless apply is explicit", () => {
  const scriptPath = resolve(
    __dirname,
    "../../../provision-softbook-nosql.mjs"
  );
  const dryRun = spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
  });
  const invalid = spawnSync(process.execPath, [scriptPath, "--unknown"], {
    encoding: "utf8",
  });
  const wrongEnvironment = spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env: {...process.env, CLOUDBASE_ENV_ID: "production"},
  });

  assert.equal(dryRun.status, 0);
  assert.match(dryRun.stdout, /dry-run/);
  assert.match(dryRun.stdout, /no CloudBase write/);
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /Unknown argument/);
  assert.equal(wrongEnvironment.status, 2);
  assert.match(wrongEnvironment.stderr, /Environment must be/);
});

function functionPayload(runtimeVariables) {
  return {
    data: {
      AvailableStatus: "Available",
      CodeSize: 1024,
      DeployMode: "code",
      Description: safety.EXPECTED_FUNCTION_CONFIG.description,
      Environment: {
        Variables: Object.entries(runtimeVariables).map(([Key, Value]) => ({
          Key,
          Value,
        })),
      },
      FunctionName: safety.DEV_FUNCTION_NAME,
      FunctionVersion: "$LATEST",
      Handler: safety.EXPECTED_FUNCTION_CONFIG.handler,
      InstallDependency: "FALSE",
      MemorySize: safety.EXPECTED_FUNCTION_CONFIG.memorySize,
      ModTime: "2026-07-26 00:00:00",
      Qualifier: "$LATEST",
      Runtime: safety.EXPECTED_FUNCTION_CONFIG.runtime,
      Status: "Active",
      Timeout: safety.EXPECTED_FUNCTION_CONFIG.timeout,
      Triggers: [],
      Type: "Event",
    },
  };
}

function makeManifestFixture() {
  const directory = mkdtempSync(join(tmpdir(), "softbook-deploy-test-"));
  temporaryDirectories.push(directory);
  mkdirSync(join(directory, "node_modules"), {recursive: true});
  mkdirSync(join(directory, "test"), {recursive: true});
  return directory;
}
