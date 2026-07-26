#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {
  DEV_ENV_ID,
  REQUIRED_COLLECTIONS,
  REQUIRED_DEPLOYMENT_NODE_VERSION,
  evaluateRepositoryState,
  redactText,
} from "./deployment-safety.mjs";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const requestedEnvId = process.env.CLOUDBASE_ENV_ID || DEV_ENV_ID;
// Contract mirrors intentionally audit these literal entries.
// prettier-ignore
const collections = [
  'softbook_account_deletions',
  'softbook_auth_challenges',
  'softbook_auth_rate_limits',
  'softbook_auth_sessions',
  'softbook_card_source_versions',
  'softbook_card_sources',
  'softbook_memberships',
  'softbook_daily_check_ins',
  'softbook_daily_progress',
  'softbook_learning_event_cursors',
  'softbook_learning_events',
  'softbook_learning_event_sequences',
  'softbook_learning_migration_revisions',
  'softbook_learning_sessions',
  'softbook_learning_states',
  'softbook_space_actions',
  'softbook_space_states',
];

const args = process.argv.slice(2);
const unknownArgs = args.filter((arg) => arg !== "--apply");

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
    `[cloudbase-provision] dry-run: ${collections.length} collections in ${DEV_ENV_ID}`
  );
  for (const collection of collections) {
    console.log(`[cloudbase-provision] planned: ${collection}`);
  }
  console.log(
    "[cloudbase-provision] no CloudBase write; re-run with --apply after review."
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

const now = new Date().toISOString();
const command = JSON.stringify(
  collections.map((collectionName) => ({
    TableName: collectionName,
    CommandType: "UPDATE",
    Command: JSON.stringify({
      update: collectionName,
      updates: [
        {
          q: {_id: "__provision__"},
          u: {
            $set: {
              kind: "provision",
              updated_at: now,
            },
          },
          upsert: true,
        },
      ],
    }),
  }))
);
const result = spawnSync(
  "tcb",
  ["db", "nosql", "execute", "-e", DEV_ENV_ID, "--command", command, "--json"],
  {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }
);

if (result.stdout?.trim()) {
  console.log(redactText(result.stdout).trim());
}

if (result.stderr?.trim()) {
  console.error(redactText(result.stderr).trim());
}

if (result.error) {
  console.error(`[cloudbase-provision] ${redactText(result.error.message)}`);
}

process.exit(result.status ?? 1);

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });

  if (result.error || result.status !== 0) {
    console.error(
      `[cloudbase-provision] git ${args[0]} failed: ${
        result.stderr || result.error?.message || "unknown error"
      }`
    );
    process.exit(1);
  }

  return result.stdout;
}
