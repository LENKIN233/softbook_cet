#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {tmpdir} from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import {fileURLToPath} from "node:url";
import {
  DEV_BASE_URL,
  DEV_ENV_ID,
  DEV_FUNCTION_NAME,
  EXPECTED_FUNCTION_CONFIG,
  REQUIRED_DEPLOYMENT_NODE_VERSION,
  buildCountCommand,
  buildCountProbes,
  buildDescribeTablesArguments,
  compareSourceManifests,
  createSourceManifest,
  evaluateRepositoryState,
  extractFunctionState,
  identifyPublishedVersion,
  inspectCollectionCatalog,
  inspectEnvironment,
  inspectFunctionAndRuntime,
  nativeModulePaths,
  nodeVersionAtLeast,
  parseCountResults,
  parseTcbJson,
  planRuntimeConfiguration,
  redactText,
  summarizeCollectionState,
  validateTarget,
} from "./deployment-safety.mjs";

const CLOUD_BASE_ROOT = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(CLOUD_BASE_ROOT, "../..");
const FUNCTION_ROOT = join(CLOUD_BASE_ROOT, "functions", DEV_FUNCTION_NAME);
const EXPORT_ROOT = join(REPOSITORY_ROOT, "exports", "cloudbase-deployments");
const TCB = process.env.CLOUDBASE_CLI || "tcb";
const COMMAND_TIMEOUT_MS = 120_000;
const DEPLOY_TIMEOUT_MS = 10 * 60_000;
const REPORT_SCHEMA = "cloudbase-dev-deployment-report.v1";

export function parseArguments(argv) {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    return {command: "help"};
  }

  if (!["configure", "deploy", "preflight", "rollback"].includes(command)) {
    throw argumentError(`Unknown command: ${command}`);
  }

  const options = {
    apply: false,
    backup: null,
    command,
    format: "text",
    output: null,
    requireMain: false,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];

    switch (argument) {
      case "--apply":
        options.apply = true;
        break;
      case "--backup":
        options.backup = requireValue(rest, index, argument);
        index += 1;
        break;
      case "--format":
        options.format = requireValue(rest, index, argument);
        index += 1;
        break;
      case "--help":
      case "-h":
        return {command: "help"};
      case "--output":
        options.output = requireValue(rest, index, argument);
        index += 1;
        break;
      case "--require-main":
        options.requireMain = true;
        break;
      default:
        throw argumentError(`Unknown argument: ${argument}`);
    }
  }

  if (!["json", "text"].includes(options.format)) {
    throw argumentError("--format must be text or json.");
  }

  if (command === "rollback" && !options.backup) {
    throw argumentError("rollback requires --backup <directory>.");
  }

  if (command === "preflight" && options.apply) {
    throw argumentError("--apply is not valid for read-only preflight.");
  }

  if (command !== "rollback" && options.backup) {
    throw argumentError("--backup is valid only for rollback.");
  }

  if (command !== "preflight" && options.requireMain) {
    throw argumentError("--require-main is valid only for preflight.");
  }

  return options;
}

export function buildCloudBaseConfig(
  runtimeValues,
  functionConfig = EXPECTED_FUNCTION_CONFIG
) {
  return {
    $schema: "https://static.cloudbase.net/cli/cloudbaserc.schema.json",
    envId: DEV_ENV_ID,
    functions: [
      {
        description: functionConfig.description,
        envVariables: Object.fromEntries(
          [...runtimeValues.entries()].sort(([left], [right]) =>
            left.localeCompare(right)
          )
        ),
        handler: functionConfig.handler,
        installDependency: functionConfig.installDependency,
        memorySize: functionConfig.memorySize,
        name: DEV_FUNCTION_NAME,
        runtime: functionConfig.runtime,
        timeout: functionConfig.timeout,
      },
    ],
  };
}

export function makeRunId(operation, now = new Date(), head = "unknown") {
  const timestamp = now.toISOString().replaceAll(":", "").replaceAll(".", "");
  return `${operation}-${timestamp}-${head.slice(0, 12)}`;
}

export function inspectToolchain(
  version = process.versions.node,
  platform = process.platform,
  arch = process.arch
) {
  return {
    arch,
    matches_required_node: version === REQUIRED_DEPLOYMENT_NODE_VERSION,
    node: `v${String(version).replace(/^v/, "")}`,
    platform,
    required_node: `v${REQUIRED_DEPLOYMENT_NODE_VERSION}`,
  };
}

async function main() {
  let options;

  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`[cloudbase-dev] ${error.message}`);
    printUsage();
    process.exitCode = error.exitCode ?? 2;
    return;
  }

  if (options.command === "help") {
    printUsage();
    return;
  }

  let context;

  try {
    context = createContext(options);
    const report = await executeCommand(context);
    writeReport(context, report);
    printResult(options, context, report);

    if (
      report.status === "failed" ||
      report.status === "failed_rolled_back" ||
      report.status === "rollback_failed"
    ) {
      process.exitCode = 1;
    }
  } catch (error) {
    const report = failureReport(context, options, error);

    if (context) {
      writeReport(context, report);
      printResult(options, context, report);
    } else {
      console.error(`[cloudbase-dev] ${redactText(error.message)}`);
    }

    process.exitCode = error.exitCode ?? 1;
  }
}

export function buildFunctionConfigUpdateArguments() {
  // Without --yes, CloudBase CLI can exit 0 after an unanswered env-var mode prompt.
  return [
    "config",
    "update",
    "fn",
    DEV_FUNCTION_NAME,
    "--yes",
    "--json",
  ];
}

function createContext(options) {
  if (!nodeVersionAtLeast(process.versions.node)) {
    throw new Error(
      `CloudBase deployment manager requires Node >=20.19.0; received ${process.version}.`
    );
  }

  const repository = readRepositoryState();
  const runId = makeRunId(options.command, new Date(), repository.head);
  const runDirectory = resolveOutputDirectory(options.output, runId);
  const toolchain = inspectToolchain();
  const versionMessage = `CloudBase deployment requires Node v${REQUIRED_DEPLOYMENT_NODE_VERSION}; received ${toolchain.node}.`;

  mkdirSync(runDirectory, {recursive: true});

  return {
    logs: [],
    options,
    processSequence: 0,
    repository,
    runDirectory,
    runId,
    steps: [],
    toolchain,
    toolchainErrors:
      options.apply && !toolchain.matches_required_node ? [versionMessage] : [],
    toolchainWarnings:
      !options.apply && !toolchain.matches_required_node
        ? [`${versionMessage} Dry-run evidence is advisory only.`]
        : [],
  };
}

async function executeCommand(context) {
  if (context.toolchainErrors.length > 0) {
    return baseReport(context, {
      errors: context.toolchainErrors,
      operation: context.options.command,
      status: "failed",
    });
  }

  switch (context.options.command) {
    case "configure":
      return commandConfigure(context);
    case "deploy":
      return commandDeploy(context);
    case "preflight":
      return commandPreflight(context);
    case "rollback":
      return commandRollback(context);
    default:
      throw new Error(`Unsupported command: ${context.options.command}`);
  }
}

function commandPreflight(context) {
  const remote = readRemoteState(context);
  const target = validateTarget();
  const manifest = createSourceManifest(FUNCTION_ROOT);
  const mainRequired = context.options.requireMain;
  const repositoryOk = !mainRequired || context.repository.ok;
  const errors = [
    ...target.errors,
    ...remote.environment.errors,
    ...remote.collectionCatalogErrors,
    ...remote.functionInspection.errors,
    ...(repositoryOk ? [] : context.repository.errors),
  ];

  return baseReport(context, {
    artifacts: {
      local_source_manifest: manifest,
    },
    errors,
    operation: "preflight",
    preflight: publicRemoteState(remote),
    status: errors.length === 0 ? "passed" : "failed",
    warnings: [
      ...remote.functionInspection.warnings,
      ...(mainRequired || context.repository.ok
        ? []
        : [
            "repository is valid for read-only preflight but not for deployment",
          ]),
    ],
  });
}

function commandConfigure(context) {
  const remoteBefore = readRemoteState(context);
  const target = validateTarget();
  let plan;

  try {
    plan = planRuntimeConfiguration(
      remoteBefore.functionState,
      remoteBefore.counts
    );
  } catch (error) {
    return baseReport(context, {
      errors: [redactText(error.message)],
      operation: "configure",
      preflight: publicRemoteState(remoteBefore),
      status: "failed",
    });
  }

  const metadataChanges = functionConfigDifferences(
    functionConfigFromState(remoteBefore.functionState),
    EXPECTED_FUNCTION_CONFIG
  );
  const publicPlan = {
    ...plan.public_summary,
    function_metadata_changes: metadataChanges,
  };
  const errors = [
    ...target.errors,
    ...remoteBefore.environment.errors,
    ...remoteBefore.collectionCatalogErrors,
    ...functionOperationalErrors(remoteBefore.functionState),
  ];

  if (context.options.apply) {
    errors.push(...context.repository.errors);
  }

  if (errors.length > 0) {
    return baseReport(context, {
      errors,
      operation: "configure",
      preflight: publicRemoteState(remoteBefore),
      runtime_configuration_plan: publicPlan,
      status: "failed",
    });
  }

  if (!context.options.apply) {
    return baseReport(context, {
      errors: [],
      operation: "configure",
      preflight: publicRemoteState(remoteBefore),
      runtime_configuration_plan: publicPlan,
      status:
        plan.changes.length === 0 && metadataChanges.length === 0
          ? "passed"
          : "planned",
      warnings: [
        "dry-run only; pass --apply from clean main after review to update dev configuration",
      ],
    });
  }

  const previousConfig = functionConfigFromState(remoteBefore.functionState);
  let restoredRemote = null;

  try {
    pushFunctionConfig(
      context,
      plan.nextValues,
      EXPECTED_FUNCTION_CONFIG,
      "configure-runtime"
    );
    const configuredState = waitForFunctionReady(
      context,
      "configured-function-ready"
    );
    const remoteAfter = {
      ...remoteBefore,
      functionInspection: inspectFunctionAndRuntime(
        configuredState,
        remoteBefore.counts
      ),
      functionState: configuredState,
    };

    if (!remoteAfter.functionInspection.ok) {
      throw new Error(
        `Runtime configuration verification failed: ${remoteAfter.functionInspection.errors.join(
          "; "
        )}`
      );
    }

    return baseReport(context, {
      errors: [],
      operation: "configure",
      preflight: publicRemoteState(remoteAfter),
      runtime_configuration_plan: publicPlan,
      status: "passed",
    });
  } catch (error) {
    let rollback;

    try {
      pushFunctionConfig(
        context,
        remoteBefore.functionState.runtimeValues,
        previousConfig,
        "configure-runtime-rollback"
      );
      const restoredState = waitForFunctionReady(
        context,
        "restored-function-ready"
      );
      restoredRemote = {
        ...remoteBefore,
        functionInspection: inspectFunctionAndRuntime(
          restoredState,
          remoteBefore.counts
        ),
        functionState: restoredState,
      };
      const rollbackErrors = compareExactFunctionConfiguration(
        restoredState,
        remoteBefore.functionState.runtimeValues,
        previousConfig
      );

      if (rollbackErrors.length > 0) {
        throw new Error(rollbackErrors.join("; "));
      }

      rollback = {
        ok: true,
        restored_variable_names: [
          ...remoteBefore.functionState.runtimeValues.keys(),
        ].sort(),
      };
    } catch (rollbackError) {
      rollback = {
        error: redactText(rollbackError.message),
        ok: false,
      };
    }

    return baseReport(context, {
      errors: [redactText(error.message)],
      operation: "configure",
      preflight: publicRemoteState(restoredRemote ?? remoteBefore),
      rollback,
      runtime_configuration_plan: publicPlan,
      status: rollback.ok ? "failed_rolled_back" : "rollback_failed",
    });
  }
}

function commandDeploy(context) {
  const remoteBefore = readRemoteState(context);
  const target = validateTarget();
  const errors = [
    ...target.errors,
    ...remoteBefore.environment.errors,
  ];
  const deployabilityErrors = [
    ...remoteBefore.collectionCatalogErrors,
    ...remoteBefore.functionInspection.errors,
    ...context.repository.errors,
  ];

  if (
    errors.length > 0 ||
    (context.options.apply && deployabilityErrors.length > 0)
  ) {
    return baseReport(context, {
      errors: [
        ...errors,
        ...(context.options.apply ? deployabilityErrors : []),
      ],
      operation: "deploy",
      preflight: publicRemoteState(remoteBefore),
      status: "failed",
    });
  }

  let build;

  try {
    build = buildValidatedArtifact(context);
  } catch (error) {
    return baseReport(context, {
      errors: [redactText(error.message)],
      operation: "deploy",
      preflight: publicRemoteState(remoteBefore),
      status: "failed",
      warnings: deployabilityErrors,
    });
  }

  if (!context.options.apply) {
    return baseReport(context, {
      artifacts: {
        deployment_artifact: relativeToRepository(build.artifactDirectory),
        deployment_package_manifest: summarizeManifest(build.packageManifest),
        deployment_package_manifest_file: relativeToRepository(
          build.packageManifestPath
        ),
        local_source_manifest: build.manifest,
      },
      errors: [],
      operation: "deploy",
      preflight: publicRemoteState(remoteBefore),
      status: "planned",
      warnings: [
        "dry-run only; deployment requires --apply from clean main after review",
        ...deployabilityErrors,
      ],
    });
  }

  const backupDirectory = join(context.runDirectory, "backup");
  const backupManifestPath = join(
    context.runDirectory,
    "backup-package-manifest.json"
  );
  let backupManifest = null;
  let codeUpdateAttempted = false;
  let deployedVerification = null;
  let preDeployVersion = null;
  let rollback = null;
  let verifiedVersion = null;

  try {
    mkdirSync(backupDirectory, {recursive: true});
    runTcb(
      context,
      ["fn", "code", "download", DEV_FUNCTION_NAME, backupDirectory, "--json"],
      {label: "backup-current-code", sensitiveOutput: true}
    );
    backupManifest = createFullPackageManifest(backupDirectory);
    writeJson(backupManifestPath, backupManifest, 0o600);
    preDeployVersion = publishVersion(
      context,
      `pre-deploy ${context.repository.head.slice(0, 12)}`,
      "publish-pre-deploy-version"
    );
    codeUpdateAttempted = true;
    runTcb(
      context,
      [
        "fn",
        "code",
        "update",
        DEV_FUNCTION_NAME,
        "--dir",
        build.artifactDirectory,
        "--json",
      ],
      {
        label: "update-function-code",
        timeout: DEPLOY_TIMEOUT_MS,
      }
    );
    waitForFunctionReady(context, "deployed-function-ready");
    deployedVerification = verifyRemoteManifest(
      context,
      build.packageManifest,
      "deployed-verification",
      {fullPackage: true}
    );
    runLiveSmoke(context, "cet4", true);
    runLiveSmoke(context, "cet6", false);
    verifiedVersion = publishVersion(
      context,
      `verified ${context.repository.head.slice(0, 12)}`,
      "publish-verified-version"
    );
    const remoteAfter = readRemoteState(context);

    return baseReport(context, {
      artifacts: {
        backup_directory: relativeToRepository(backupDirectory),
        backup_package_manifest: relativeToRepository(backupManifestPath),
        deployment_artifact: relativeToRepository(build.artifactDirectory),
        deployment_package_manifest: summarizeManifest(build.packageManifest),
        deployment_package_manifest_file: relativeToRepository(
          build.packageManifestPath
        ),
        deployed_package_comparison: deployedVerification.comparison,
        deployed_package_manifest: summarizeManifest(
          deployedVerification.manifest
        ),
        deployed_source_manifest: createSourceManifest(
          deployedVerification.directory
        ),
        local_source_manifest: build.manifest,
      },
      deployment_versions: {
        pre_deploy: preDeployVersion,
        verified: verifiedVersion,
      },
      errors: [],
      operation: "deploy",
      preflight: publicRemoteState(remoteAfter),
      rollback: null,
      status: "passed",
    });
  } catch (error) {
    if (codeUpdateAttempted && backupManifest) {
      rollback = rollbackCode(
        context,
        backupDirectory,
        backupManifest,
        "automatic-rollback"
      );
    }

    return baseReport(context, {
      artifacts: {
        ...(backupManifest
          ? {
              backup_directory: relativeToRepository(backupDirectory),
              backup_package_manifest: relativeToRepository(backupManifestPath),
            }
          : {}),
        deployment_artifact: relativeToRepository(build.artifactDirectory),
        deployment_package_manifest: summarizeManifest(build.packageManifest),
        deployment_package_manifest_file: relativeToRepository(
          build.packageManifestPath
        ),
        ...(deployedVerification
          ? {
              deployed_package_comparison: deployedVerification.comparison,
              deployed_package_manifest: summarizeManifest(
                deployedVerification.manifest
              ),
              deployed_source_manifest: createSourceManifest(
                deployedVerification.directory
              ),
            }
          : {}),
        local_source_manifest: build.manifest,
      },
      deployment_versions: {
        pre_deploy: preDeployVersion,
        verified: verifiedVersion,
      },
      errors: [redactText(error.message)],
      operation: "deploy",
      preflight: publicRemoteState(remoteBefore),
      rollback,
      status:
        codeUpdateAttempted && rollback?.ok
          ? "failed_rolled_back"
          : codeUpdateAttempted
          ? "rollback_failed"
          : "failed",
    });
  }
}

function commandRollback(context) {
  const remoteBefore = readRemoteState(context);
  const target = validateTarget();
  const errors = [
    ...target.errors,
    ...remoteBefore.environment.errors,
    ...(context.options.apply ? context.repository.errors : []),
  ];
  const backupDirectory = resolveBackupDirectory(context.options.backup);
  const manifestPath = join(
    dirname(backupDirectory),
    "backup-package-manifest.json"
  );

  if (!existsSync(backupDirectory)) {
    errors.push(`backup directory does not exist: ${backupDirectory}`);
  }

  if (!existsSync(manifestPath)) {
    errors.push(`backup manifest does not exist: ${manifestPath}`);
  }

  if (errors.length > 0) {
    return baseReport(context, {
      errors,
      operation: "rollback",
      preflight: publicRemoteState(remoteBefore),
      status: "failed",
    });
  }

  const expectedManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const currentManifest = createFullPackageManifest(backupDirectory);
  const backupComparison = compareSourceManifests(
    expectedManifest,
    currentManifest
  );

  if (!backupComparison.ok) {
    return baseReport(context, {
      errors: ["backup source manifest does not match the recorded manifest"],
      operation: "rollback",
      preflight: publicRemoteState(remoteBefore),
      status: "failed",
    });
  }

  if (!context.options.apply) {
    return baseReport(context, {
      artifacts: {
        backup_directory: relativeToRepository(backupDirectory),
        backup_package_manifest: relativeToRepository(manifestPath),
      },
      errors: [],
      operation: "rollback",
      preflight: publicRemoteState(remoteBefore),
      status: "planned",
      warnings: [
        "dry-run only; pass --apply to restore the verified backup",
        ...context.repository.errors,
      ],
    });
  }

  const rollback = rollbackCode(
    context,
    backupDirectory,
    expectedManifest,
    "manual-rollback"
  );

  return baseReport(context, {
    artifacts: {
      backup_directory: relativeToRepository(backupDirectory),
      backup_package_manifest: relativeToRepository(manifestPath),
    },
    errors: rollback.ok ? [] : [rollback.error],
    operation: "rollback",
    preflight: publicRemoteState(remoteBefore),
    rollback,
    status: rollback.ok ? "passed" : "rollback_failed",
  });
}

function pushFunctionConfig(context, runtimeValues, functionConfig, label) {
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), "softbook-cloudbase-config-")
  );
  const configPath = join(temporaryDirectory, "cloudbaserc.json");

  try {
    writeFileSync(
      configPath,
      `${JSON.stringify(
        buildCloudBaseConfig(runtimeValues, functionConfig),
        null,
        2
      )}\n`,
      {encoding: "utf8", mode: 0o600}
    );
    chmodSync(configPath, 0o600);
    runTcb(context, buildFunctionConfigUpdateArguments(), {
      cwd: temporaryDirectory,
      label,
      sensitiveOutput: true,
    });
  } finally {
    rmSync(temporaryDirectory, {force: true, recursive: true});
  }
}

function functionConfigFromState(functionState) {
  return {
    description: functionState.public.description,
    handler: functionState.public.handler,
    installDependency: parseInstallDependency(
      functionState.public.install_dependency
    ),
    memorySize: functionState.public.memory_size,
    runtime: functionState.public.runtime,
    timeout: functionState.public.timeout,
  };
}

function parseInstallDependency(value) {
  if (value === "TRUE") {
    return true;
  }

  if (value === "FALSE") {
    return false;
  }

  return null;
}

function functionConfigDifferences(actualConfig, expectedConfig) {
  return [
    ["description", actualConfig.description, expectedConfig.description],
    ["handler", actualConfig.handler, expectedConfig.handler],
    [
      "install_dependency",
      actualConfig.installDependency,
      expectedConfig.installDependency,
    ],
    ["memory_size", actualConfig.memorySize, expectedConfig.memorySize],
    ["runtime", actualConfig.runtime, expectedConfig.runtime],
    ["timeout", actualConfig.timeout, expectedConfig.timeout],
  ]
    .filter(([, actual, expected]) => actual !== expected)
    .map(([field]) => field);
}

function functionOperationalErrors(functionState) {
  const errors = [];

  if (functionState.public.function_name !== DEV_FUNCTION_NAME) {
    errors.push(`remote function must be ${DEV_FUNCTION_NAME}`);
  }

  if (functionState.public.status !== "Active") {
    errors.push("remote function must be Active before configuration");
  }

  if (functionState.public.available_status !== "Available") {
    errors.push("remote function must be Available before configuration");
  }

  return errors;
}

function compareExactFunctionConfiguration(
  actualState,
  expectedValues,
  expectedConfig
) {
  const errors = [];
  const actualValues = actualState.runtimeValues;
  const actualNames = [...actualValues.keys()].sort();
  const expectedNames = [...expectedValues.keys()].sort();

  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    errors.push("restored runtime variable names do not match");
  }

  for (const [name, expectedValue] of expectedValues.entries()) {
    if (actualValues.get(name) !== expectedValue) {
      errors.push(`restored runtime variable ${name} does not match`);
    }
  }

  const metadataChecks = [
    ["description", actualState.public.description, expectedConfig.description],
    ["handler", actualState.public.handler, expectedConfig.handler],
    [
      "install dependency",
      actualState.public.install_dependency,
      expectedConfig.installDependency ? "TRUE" : "FALSE",
    ],
    ["memory", actualState.public.memory_size, expectedConfig.memorySize],
    ["runtime", actualState.public.runtime, expectedConfig.runtime],
    ["timeout", actualState.public.timeout, expectedConfig.timeout],
  ];

  for (const [label, actual, expected] of metadataChecks) {
    if (actual !== expected) {
      errors.push(`restored function ${label} does not match`);
    }
  }

  return errors;
}

function readRemoteState(context) {
  const environmentPayload = parseTcbJson(
    runTcb(context, ["env", "detail", "-e", DEV_ENV_ID, "--json", "--yes"], {
      label: "read-environment",
    })
  );
  const environment = inspectEnvironment(environmentPayload);
  const collectionCatalog = inspectCollectionCatalog(
    parseTcbJson(
      runTcb(
        context,
        buildDescribeTablesArguments(environment.database_instance_id),
        {label: "read-collection-catalog"}
      )
    )
  );
  const functionPayload = parseTcbJson(
    runTcb(context, ["fn", "detail", DEV_FUNCTION_NAME, "--json"], {
      label: "read-function",
      sensitiveOutput: true,
    })
  );
  const versionPayload = parseTcbJson(
    runTcb(
      context,
      ["fn", "list-function-versions", DEV_FUNCTION_NAME, "--json"],
      {label: "read-versions"}
    )
  );
  const routePayload = parseTcbJson(
    runTcb(context, ["fn", "get-route", DEV_FUNCTION_NAME, "--json"], {
      label: "read-route",
    })
  );
  const collectionNameSet = new Set(collectionCatalog.collection_names);
  const probes = buildCountProbes().filter((probe) =>
    collectionNameSet.has(probe.collection)
  );
  const countPayload =
    probes.length === 0
      ? {data: {results: []}}
      : parseTcbJson(
          runTcb(
            context,
            [
              "db",
              "nosql",
              "execute",
              "-e",
              DEV_ENV_ID,
              "--command",
              buildCountCommand(probes),
              "--json",
            ],
            {label: "read-collection-counts"}
          )
        );
  const auditOutput = runProcess(
    context,
    process.execPath,
    [join(CLOUD_BASE_ROOT, "audit-card-sources.mjs")],
    {
      cwd: REPOSITORY_ROOT,
      env: {CLOUDBASE_ENV_ID: DEV_ENV_ID},
      label: "audit-card-sources",
      timeout: COMMAND_TIMEOUT_MS,
    }
  );
  const functionState = extractFunctionState(functionPayload);
  const counts = parseCountResults(countPayload, probes);

  return {
    cardSourceAudit: {
      ok: true,
      summary: redactText(auditOutput)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    },
    collectionCatalog,
    collectionCatalogErrors: collectionCatalog.missing_required_collections.map(
      (name) => `required CloudBase collection is missing: ${name}`
    ),
    counts,
    countSummary: summarizeCollectionState(
      counts,
      collectionCatalog.collection_names
    ),
    environment,
    functionInspection: inspectFunctionAndRuntime(functionState, counts),
    functionState,
    routes: sanitizeRoutes(routePayload?.data),
    versions: sanitizeVersions(versionPayload?.data),
  };
}

function publicRemoteState(remote) {
  return {
    card_source_audit: remote.cardSourceAudit,
    collections: remote.countSummary,
    environment: remote.environment,
    function: remote.functionState.public,
    function_validation: remote.functionInspection,
    routes: remote.routes,
    versions: remote.versions,
  };
}

function buildValidatedArtifact(context) {
  const validationWorkspace = join(
    context.runDirectory,
    "validation-workspace"
  );
  const validationCloudBaseRoot = join(
    validationWorkspace,
    "infra",
    "cloudbase"
  );
  const validationDirectory = join(
    validationCloudBaseRoot,
    "functions",
    DEV_FUNCTION_NAME
  );
  const artifactDirectory = join(context.runDirectory, "artifact");
  cpSync(CLOUD_BASE_ROOT, validationCloudBaseRoot, {
    filter: (currentPath) => {
      const pathFromSource = relative(CLOUD_BASE_ROOT, currentPath);

      if (pathFromSource === "") {
        return true;
      }

      return (
        !pathFromSource.split(sep).includes("node_modules") &&
        basename(currentPath) !== ".DS_Store"
      );
    },
    recursive: true,
  });
  mkdirSync(join(validationWorkspace, "spec"), {recursive: true});
  cpSync(
    join(REPOSITORY_ROOT, "spec", "box-catalog.json"),
    join(validationWorkspace, "spec", "box-catalog.json")
  );
  runProcess(context, "npm", ["ci", "--ignore-scripts"], {
    cwd: validationDirectory,
    label: "clean-install",
    timeout: DEPLOY_TIMEOUT_MS,
  });
  runProcess(context, "npm", ["test"], {
    cwd: validationDirectory,
    label: "backend-tests",
    timeout: DEPLOY_TIMEOUT_MS,
  });
  copyFunctionSource(validationDirectory, artifactDirectory, {
    includeNodeModules: true,
    includeTests: false,
  });
  runProcess(context, process.execPath, ["-e", "require('./index.js')"], {
    cwd: artifactDirectory,
    label: "artifact-load-smoke",
  });
  const packageManifest = createFullPackageManifest(artifactDirectory);
  const packageManifestPath = join(
    context.runDirectory,
    "deployment-package-manifest.json"
  );
  const platformNativeModules = nativeModulePaths(packageManifest);
  writeJson(packageManifestPath, packageManifest, 0o600);

  if (platformNativeModules.length > 0) {
    throw new Error(
      `Deployment artifact contains platform-native modules: ${platformNativeModules.join(
        ", "
      )}`
    );
  }

  return {
    artifactDirectory,
    manifest: createSourceManifest(artifactDirectory),
    packageManifest,
    packageManifestPath,
  };
}

export function shouldIncludeArtifactPath(
  pathFromSource,
  {includeNodeModules = false, includeTests = false} = {}
) {
  const segments = pathFromSource.split(sep);
  const [firstSegment, secondSegment] = segments;

  if (basename(pathFromSource) === ".DS_Store") {
    return false;
  }

  if (firstSegment === "node_modules") {
    return includeNodeModules && secondSegment !== ".bin";
  }

  if (firstSegment === "test") {
    return includeTests;
  }

  return true;
}

function copyFunctionSource(
  source,
  destination,
  {includeNodeModules = false, includeTests = false} = {}
) {
  cpSync(source, destination, {
    filter: (currentPath) => {
      const pathFromSource = relative(source, currentPath);

      if (pathFromSource === "") {
        return true;
      }

      return shouldIncludeArtifactPath(pathFromSource, {
        includeNodeModules,
        includeTests,
      });
    },
    recursive: true,
  });
}

function verifyRemoteManifest(
  context,
  expectedManifest,
  label,
  {fullPackage = false} = {}
) {
  const verificationDirectory = join(context.runDirectory, label);
  mkdirSync(verificationDirectory, {recursive: true});
  runTcb(
    context,
    [
      "fn",
      "code",
      "download",
      DEV_FUNCTION_NAME,
      verificationDirectory,
      "--json",
    ],
    {label, sensitiveOutput: true}
  );
  const manifest = fullPackage
    ? createFullPackageManifest(verificationDirectory)
    : createSourceManifest(verificationDirectory);
  const comparison = compareSourceManifests(expectedManifest, manifest);

  if (!comparison.ok) {
    throw new Error(
      `Remote ${fullPackage ? "package" : "source"} verification failed: ${JSON.stringify(
        comparison
      )}`
    );
  }

  return {comparison, directory: verificationDirectory, manifest};
}

function rollbackCode(context, backupDirectory, expectedManifest, label) {
  try {
    runTcb(
      context,
      [
        "fn",
        "code",
        "update",
        DEV_FUNCTION_NAME,
        "--dir",
        backupDirectory,
        "--json",
      ],
      {
        label: `${label}-update`,
        sensitiveOutput: true,
        timeout: DEPLOY_TIMEOUT_MS,
      }
    );
    waitForFunctionReady(context, `${label}-function-ready`);
    const verification = verifyRemoteManifest(
      context,
      expectedManifest,
      `${label}-verification`,
      {fullPackage: true}
    );
    let version = null;
    let versionWarning = null;

    try {
      version = publishVersion(
        context,
        `${label} ${context.repository.head.slice(0, 12)}`,
        `${label}-publish-version`
      );
    } catch (error) {
      versionWarning = redactText(error.message);
    }

    return {
      comparison: verification.comparison,
      ok: true,
      package_manifest: summarizeManifest(verification.manifest),
      version,
      version_published: version !== null,
      version_warning: versionWarning,
    };
  } catch (error) {
    return {
      error: redactText(error.message),
      ok: false,
    };
  }
}

function runLiveSmoke(context, track, enableWrites) {
  const environment = {
    SOFTBOOK_CET_LEARNING_TRACK: track,
    SOFTBOOK_CET_REMOTE_BASE_URL: DEV_BASE_URL,
    SOFTBOOK_CET_SMOKE_ISOLATED_PHONE: "1",
    SOFTBOOK_CET_TEST_CODE: "2468",
  };

  if (enableWrites) {
    environment.SOFTBOOK_CET_SMOKE_MEMBERSHIP_MUTATIONS = "1";
    environment.SOFTBOOK_CET_SMOKE_WRITE = "1";
  }

  runProcess(
    context,
    process.execPath,
    [join(CLOUD_BASE_ROOT, "smoke-softbook-api.mjs")],
    {
      cwd: REPOSITORY_ROOT,
      env: environment,
      label: `live-smoke-${track}`,
      timeout: DEPLOY_TIMEOUT_MS,
    }
  );
}

function publishVersion(context, description, label) {
  const uniqueDescription = `${description} ${context.runId}`.slice(0, 120);
  const beforeVersions = readFunctionVersions(
    context,
    `${label}-versions-before`,
    {recordStep: true}
  );

  runTcb(
    context,
    ["fn", "publish-version", DEV_FUNCTION_NAME, uniqueDescription, "--json"],
    {label, timeout: DEPLOY_TIMEOUT_MS}
  );

  let lastError = null;
  const confirmationStartedAt = Date.now();

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      const afterVersions = readFunctionVersions(
        context,
        `${label}-versions-after-${attempt}`,
        {recordStep: false, sensitiveOutput: true}
      );
      const version = identifyPublishedVersion(
        beforeVersions,
        afterVersions,
        uniqueDescription
      );
      recordVersionConfirmationStep(
        context,
        label,
        confirmationStartedAt,
        "passed"
      );
      return version;
    } catch (error) {
      lastError = error;
    }

    if (attempt < 10) {
      sleep(500);
    }
  }

  recordVersionConfirmationStep(
    context,
    label,
    confirmationStartedAt,
    "failed"
  );
  throw new Error(
    `${label} succeeded but its immutable version could not be identified: ${lastError?.message}`
  );
}

function readFunctionVersions(
  context,
  label,
  {recordStep = true, sensitiveOutput = false} = {}
) {
  const payload = parseTcbJson(
    runTcb(
      context,
      ["fn", "list-function-versions", DEV_FUNCTION_NAME, "--json"],
      {label, recordStep, sensitiveOutput}
    )
  );

  return sanitizeVersions(payload?.data);
}

function recordVersionConfirmationStep(context, label, startedAt, status) {
  context.steps.push({
    command: `tcb fn list-function-versions ${DEV_FUNCTION_NAME} --json`,
    duration_ms: Date.now() - startedAt,
    label: `${label}-confirm-version`,
    log: null,
    status,
  });
}

function waitForFunctionReady(context, label) {
  const deadline = Date.now() + DEPLOY_TIMEOUT_MS;
  const startedAt = Date.now();
  let lastError = null;
  let lastState = null;

  while (Date.now() < deadline) {
    try {
      const payload = parseTcbJson(
        runTcb(context, ["fn", "detail", DEV_FUNCTION_NAME, "--json"], {
          label: `${label}-poll`,
          recordStep: false,
          sensitiveOutput: true,
        })
      );
      const state = extractFunctionState(payload);
      lastState = state.public;

      if (
        state.public.status === "Active" &&
        state.public.available_status === "Available"
      ) {
        recordFunctionReadyStep(context, label, startedAt, "passed");
        return state;
      }

      if (["CreateFailed", "UpdateFailed"].includes(state.public.status)) {
        lastError = `terminal function status ${state.public.status}`;
        break;
      }
    } catch (error) {
      lastError = redactText(error.message);
    }

    sleep(3_000);
  }

  recordFunctionReadyStep(context, label, startedAt, "failed");
  throw new Error(
    `Function did not become ready: ${JSON.stringify(lastState)}; last_error=${
      lastError ?? "none"
    }`
  );
}

function recordFunctionReadyStep(context, label, startedAt, status) {
  context.steps.push({
    command: `tcb fn detail ${DEV_FUNCTION_NAME} --json`,
    duration_ms: Date.now() - startedAt,
    label,
    log: null,
    status,
  });
}

function readRepositoryState() {
  const branch = runGit(["branch", "--show-current"]).trim();
  const head = runGit(["rev-parse", "HEAD"]).trim();
  const originMain = runGit(["rev-parse", "origin/main"]).trim();
  const porcelain = runGit([
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);

  return evaluateRepositoryState({
    branch,
    head,
    originMain,
    porcelain,
  });
}

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    timeout: COMMAND_TIMEOUT_MS,
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      `git ${args[0]} failed: ${redactText(
        result.stderr || result.error?.message
      )}`
    );
  }

  return result.stdout;
}

function runTcb(context, args, options = {}) {
  return runProcess(context, TCB, args, {
    cwd: options.cwd ?? CLOUD_BASE_ROOT,
    env: {CLOUDBASE_ENV_ID: DEV_ENV_ID},
    label: options.label ?? `tcb-${args.slice(0, 2).join("-")}`,
    recordStep: options.recordStep,
    sensitiveOutput: options.sensitiveOutput,
    timeout: options.timeout ?? COMMAND_TIMEOUT_MS,
  });
}

function runProcess(
  context,
  command,
  args,
  {
    cwd = REPOSITORY_ROOT,
    env = {},
    label,
    recordStep = true,
    sensitiveOutput = false,
    timeout = COMMAND_TIMEOUT_MS,
  }
) {
  const startedAt = Date.now();
  context.processSequence += 1;
  const processSequence = context.processSequence;
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {...process.env, ...env},
    maxBuffer: 64 * 1024 * 1024,
    timeout,
  });
  const durationMs = Date.now() - startedAt;
  const safeOutput = sensitiveOutput
    ? ""
    : redactText([result.stdout, result.stderr].filter(Boolean).join("\n"));
  let logPath = null;

  if (safeOutput.trim() !== "") {
    logPath = join(
      context.runDirectory,
      `${String(processSequence).padStart(3, "0")}-${label}.log`
    );
    writeFileSync(logPath, `${safeOutput.trim()}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    chmodSync(logPath, 0o600);
    context.logs.push(relativeToRepository(logPath));
  }

  if (recordStep) {
    context.steps.push({
      command: `${basename(command)} ${args
        .map((argument) => safeArgument(argument))
        .join(" ")}`.trim(),
      duration_ms: durationMs,
      label,
      log: logPath ? relativeToRepository(logPath) : null,
      status: result.status === 0 && !result.error ? "passed" : "failed",
    });
  }

  if (result.error) {
    throw new Error(`${label} failed: ${redactText(result.error.message)}`);
  }

  if (result.status !== 0) {
    const diagnostic = sensitiveOutput
      ? "sensitive command output withheld"
      : safeOutput.trim().slice(-2_000);
    throw new Error(
      `${label} exited ${result.status}: ${
        diagnostic.trim() || "no diagnostic"
      }`
    );
  }

  return result.stdout;
}

function baseReport(
  context,
  {
    artifacts = {},
    deployment_versions = null,
    errors = [],
    operation,
    preflight = null,
    rollback = null,
    runtime_configuration_plan = null,
    status,
    warnings = [],
  }
) {
  return {
    artifacts,
    deployment_versions,
    errors,
    generated_at: new Date().toISOString(),
    logs: context.logs,
    non_claims: [
      "development_deployment_is_not_production_readiness",
      "green_smoke_is_not_formal_content_approval",
      "local_or_remote_dev_evidence_does_not_replace_github_required_checks",
    ],
    operation,
    preflight,
    repository: context.repository,
    rollback,
    run_id: context.runId,
    runtime_configuration_plan,
    schema_version: REPORT_SCHEMA,
    status,
    steps: context.steps,
    target: validateTarget(),
    toolchain: context.toolchain,
    warnings: [...context.toolchainWarnings, ...warnings],
  };
}

function failureReport(context, options, error) {
  return {
    artifacts: {},
    deployment_versions: null,
    errors: [redactText(error?.message ?? String(error))],
    generated_at: new Date().toISOString(),
    logs: context?.logs ?? [],
    non_claims: [
      "development_deployment_is_not_production_readiness",
      "failure_reports_do_not_prove_rollback_without_manifest_verification",
    ],
    operation: options?.command ?? "unknown",
    preflight: null,
    repository: context?.repository ?? null,
    rollback: null,
    run_id: context?.runId ?? null,
    runtime_configuration_plan: null,
    schema_version: REPORT_SCHEMA,
    status: "failed",
    steps: context?.steps ?? [],
    target: validateTarget(),
    toolchain: context?.toolchain ?? inspectToolchain(),
    warnings: context?.toolchainWarnings ?? [],
  };
}

function writeReport(context, report) {
  writeJson(join(context.runDirectory, "report.json"), report, 0o600);
}

function writeJson(path, value, mode = 0o600) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode,
  });
  chmodSync(path, mode);
}

function printResult(options, context, report) {
  if (options.format === "json") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(
    `[cloudbase-dev] ${report.operation}: ${
      report.status
    }; report=${relativeToRepository(
      join(context.runDirectory, "report.json")
    )}`
  );

  for (const error of report.errors) {
    console.error(`[cloudbase-dev] error: ${error}`);
  }

  for (const warning of report.warnings) {
    console.warn(`[cloudbase-dev] warning: ${warning}`);
  }
}

function resolveOutputDirectory(output, runId) {
  const candidate = output
    ? resolve(REPOSITORY_ROOT, output)
    : join(EXPORT_ROOT, runId);
  const relativePath = relative(EXPORT_ROOT, candidate);

  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`--output must remain inside ${EXPORT_ROOT}.`);
  }

  return candidate;
}

function resolveBackupDirectory(value) {
  const candidate = resolve(REPOSITORY_ROOT, value);
  const relativePath = relative(EXPORT_ROOT, candidate);

  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`--backup must remain inside ${EXPORT_ROOT}.`);
  }

  return basename(candidate) === "backup"
    ? candidate
    : join(candidate, "backup");
}

function relativeToRepository(path) {
  return relative(REPOSITORY_ROOT, path).split(sep).join("/");
}

function createFullPackageManifest(directory) {
  return createSourceManifest(directory, {
    excludeDirectories: [],
    excludeFiles: [".DS_Store", "result.json"],
  });
}

function summarizeManifest(manifest) {
  return {
    file_count: manifest.files.length,
    sha256: manifest.sha256,
    size_bytes: manifest.files.reduce((sum, file) => sum + file.size_bytes, 0),
  };
}

function sanitizeVersions(value) {
  if (!Array.isArray(value)) {
    throw new Error("Function version list must be an array.");
  }

  return value.map((version) => ({
    created_at: version.createTime ?? null,
    description: version.description ?? null,
    modified_at: version.modifyTime ?? null,
    status: version.status ?? null,
    version: version.version ?? null,
  }));
}

function sanitizeRoutes(value) {
  if (!Array.isArray(value)) {
    throw new Error("Function route list must be an array.");
  }

  return value.map((route) => ({
    traffic: route.traffic ?? route.Traffic ?? null,
    version: route.version ?? route.Version ?? null,
  }));
}

function safeArgument(argument) {
  const value = String(argument);

  if (
    value.includes("SOFTBOOK_AUTH_") ||
    value.length > 512 ||
    /\b1\d{10}\b/.test(value)
  ) {
    return "<redacted>";
  }

  return redactText(value);
}

function requireValue(argv, index, option) {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw argumentError(`${option} requires a value.`);
  }

  return value;
}

function argumentError(message) {
  const error = new Error(message);
  error.exitCode = 2;
  return error;
}

function printUsage() {
  console.log(`Usage:
  node infra/cloudbase/manage-softbook-api.mjs preflight [--require-main] [--format text|json] [--output exports/cloudbase-deployments/<dir>]
  node infra/cloudbase/manage-softbook-api.mjs configure [--apply] [--format text|json] [--output exports/cloudbase-deployments/<dir>]
  node infra/cloudbase/manage-softbook-api.mjs deploy [--apply] [--format text|json] [--output exports/cloudbase-deployments/<dir>]
  node infra/cloudbase/manage-softbook-api.mjs rollback --backup exports/cloudbase-deployments/<deploy-run> [--apply] [--format text|json]

All commands are restricted to the allowlisted CloudBase dev environment.
configure, deploy, and rollback are dry-run unless --apply is explicit.`);
}

function sleep(milliseconds) {
  const shared = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(shared), 0, 0, milliseconds);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
