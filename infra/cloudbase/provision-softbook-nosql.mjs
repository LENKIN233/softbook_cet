#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {
  DEV_ENV_ID,
  REQUIRED_COLLECTIONS,
  REQUIRED_DEPLOYMENT_NODE_VERSION,
  buildCreateTableArguments,
  buildDescribeTablesArguments,
  evaluateRepositoryState,
  inspectCollectionCatalog,
  inspectEnvironment,
  parseTcbJson,
  redactText,
} from "./deployment-safety.mjs";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const requestedEnvId = process.env.CLOUDBASE_ENV_ID || DEV_ENV_ID;
const tcb = process.env.CLOUDBASE_CLI || "tcb";
// Contract mirrors intentionally audit these literal entries.
// prettier-ignore
const collections = [
  'softbook_account_deletions',
  'softbook_accounts',
  'softbook_auth_challenges',
  'softbook_auth_rate_limits',
  'softbook_auth_sessions',
  'softbook_beta_entitlements',
  'softbook_card_source_versions',
  'softbook_card_sources',
  'softbook_memberships',
  'softbook_membership_revisions',
  'softbook_daily_check_ins',
  'softbook_daily_progress',
  'softbook_learning_event_cursors',
  'softbook_learning_events',
  'softbook_learning_event_sequences',
  'softbook_learning_migration_revisions',
  'softbook_pilot_round_continuations',
  'softbook_pilot_entitlements',
  'softbook_learning_sessions',
  'softbook_learning_states',
  'softbook_space_action_lineages',
  'softbook_space_actions',
  'softbook_space_state_revisions',
  'softbook_space_states',
];

const args = process.argv.slice(2);
const unknownArgs = args.filter((argument) => argument !== "--apply");

if (unknownArgs.length > 0) {
  console.error(
    `[cloudbase-provision] Unknown argument: ${unknownArgs.join(", ")}`
  );
  process.exit(2);
}

if (requestedEnvId !== DEV_ENV_ID) {
  console.error(
    `[cloudbase-provision] Environment must be ${DEV_ENV_ID}; received ${requestedEnvId}.`
  );
  process.exit(2);
}

if (JSON.stringify(collections) !== JSON.stringify([...REQUIRED_COLLECTIONS])) {
  console.error(
    "[cloudbase-provision] Collection plan does not match deployment safety contract."
  );
  process.exit(1);
}

if (!args.includes("--apply")) {
  console.log(
    `[cloudbase-provision] dry-run: require ${collections.length} collections in ${DEV_ENV_ID}`
  );
  for (const collection of collections) {
    console.log(`[cloudbase-provision] required: ${collection}`);
  }
  console.log(
    "[cloudbase-provision] no CloudBase write and no remote read; apply lists the real catalog and creates only missing allowlisted collections."
  );
  process.exit(0);
}

if (process.versions.node !== REQUIRED_DEPLOYMENT_NODE_VERSION) {
  console.error(
    `[cloudbase-provision] Apply requires Node v${REQUIRED_DEPLOYMENT_NODE_VERSION}; received ${process.version}.`
  );
  process.exit(1);
}

const repository = evaluateRepositoryState({
  branch: runGit(["branch", "--show-current"]).trim(),
  head: runGit(["rev-parse", "HEAD"]).trim(),
  originMain: runGit(["rev-parse", "origin/main"]).trim(),
  porcelain: runGit(["status", "--porcelain=v1", "--untracked-files=all"]),
});

if (!repository.ok) {
  for (const error of repository.errors) {
    console.error(`[cloudbase-provision] ${error}`);
  }
  process.exit(1);
}

try {
  const environment = inspectEnvironment(
    parseTcbJson(
      runTcb(
        ["env", "detail", "-e", DEV_ENV_ID, "--json", "--yes"],
        "read environment"
      )
    )
  );

  if (!environment.ok) {
    throw new Error(environment.errors.join("; "));
  }

  let catalog = readCatalog(environment.database_instance_id);
  const initiallyMissing = [...catalog.missing_required_collections];

  for (const collection of initiallyMissing) {
    const result = spawnTcb(
      buildCreateTableArguments(environment.database_instance_id, collection)
    );

    if (result.status !== 0 || result.error) {
      catalog = readCatalog(environment.database_instance_id);

      if (!catalog.collection_names.includes(collection)) {
        throw processError(`create ${collection}`, result);
      }
    }

    console.log(`[cloudbase-provision] created: ${collection}`);
  }

  catalog = waitForRequiredCatalog(environment.database_instance_id);

  console.log(
    `[cloudbase-provision] verified: ${collections.length}/${collections.length} required collections; created ${initiallyMissing.length}.`
  );
} catch (error) {
  console.error(`[cloudbase-provision] ${redactText(error.message)}`);
  process.exit(1);
}

function readCatalog(databaseInstanceId) {
  return inspectCollectionCatalog(
    parseTcbJson(
      runTcb(
        buildDescribeTablesArguments(databaseInstanceId),
        "read collection catalog"
      )
    )
  );
}

function waitForRequiredCatalog(databaseInstanceId) {
  let catalog;

  for (let attempt = 0; attempt < 15; attempt += 1) {
    catalog = readCatalog(databaseInstanceId);

    if (catalog.required_collections_present) {
      return catalog;
    }

    sleep(1000);
  }

  throw new Error(
    `Required collections are still missing: ${catalog.missing_required_collections.join(
      ", "
    )}`
  );
}

function runTcb(commandArgs, label) {
  const result = spawnTcb(commandArgs);

  if (result.status !== 0 || result.error) {
    throw processError(label, result);
  }

  return result.stdout;
}

function spawnTcb(commandArgs) {
  return spawnSync(tcb, commandArgs, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
  });
}

function processError(label, result) {
  const diagnostic =
    result.stderr || result.stdout || result.error?.message || "unknown error";
  return new Error(`${label} failed: ${redactText(diagnostic).slice(-2000)}`);
}

function sleep(milliseconds) {
  const shared = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(shared), 0, 0, milliseconds);
}

function runGit(commandArgs) {
  const result = spawnSync("git", commandArgs, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });

  if (result.error || result.status !== 0) {
    console.error(
      `[cloudbase-provision] git ${commandArgs[0]} failed: ${
        result.stderr || result.error?.message || "unknown error"
      }`
    );
    process.exit(1);
  }

  return result.stdout;
}
