#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  BetaEntitlementError,
  planBetaEntitlementMutation,
  publicBetaEntitlementPlan,
  validateBetaEntitlementCommand,
  verifyAppliedBetaEntitlement,
} from './beta-entitlement-v1.mjs';
import {createCloudBaseCommandRunner} from './cloudbase-receiver-adapter.mjs';
import {REQUIRED_DEPLOYMENT_NODE_VERSION, parseTcbJson, redactText} from './deployment-safety.mjs';
import {inspectReceiver, receiverDeliveryInternals} from './deliver-release.mjs';
import {ReleaseDeliveryError, validateDeliveryProfile} from './release-delivery-v1.mjs';

const CLOUD_BASE_ROOT = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(CLOUD_BASE_ROOT, '../..');
const MEMBERSHIP_COLLECTION = 'softbook_memberships';
const BETA_ENTITLEMENT_COLLECTION = 'softbook_beta_entitlements';

export function parseBetaEntitlementArguments(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return {help: true};
  const options = {
    apply: false,
    commandPath: null,
    format: 'text',
    profilePath: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case '--apply':
        options.apply = true;
        break;
      case '--command':
        options.commandPath = requireValue(argv, index, argument);
        index += 1;
        break;
      case '--format':
        options.format = requireValue(argv, index, argument);
        index += 1;
        break;
      case '--profile':
        options.profilePath = requireValue(argv, index, argument);
        index += 1;
        break;
      default:
        throw new BetaEntitlementError(`unknown argument: ${argument}`);
    }
  }
  if (!options.profilePath) throw new BetaEntitlementError('--profile is required.');
  if (!options.commandPath) throw new BetaEntitlementError('--command is required.');
  if (!['json', 'text'].includes(options.format)) {
    throw new BetaEntitlementError('--format must be text or json.');
  }
  return options;
}

export async function executeBetaEntitlementCommand(options, dependencies = {}) {
  const profile = validateDeliveryProfile(readJson(options.profilePath));
  const command = validateBetaEntitlementCommand(readJson(options.commandPath));
  const runner = dependencies.runner ?? createCloudBaseCommandRunner({cwd: REPOSITORY_ROOT});
  const repository = dependencies.repository ?? readRepositoryState();
  const nodeVersion = dependencies.nodeVersion ?? process.versions.node;
  const preflight = await inspectReceiver({profile, runner});
  const writeSafety = receiverDeliveryInternals.inspectWriteSafety({nodeVersion, repository});
  const base = {
    schema_version: 'beta-entitlement-report.v1',
    applied: options.apply,
    environment_id: profile.environment_id,
    preflight: {
      errors: preflight.errors,
      required_collections_present: preflight.catalog.required_collections_present,
    },
    write_safety: writeSafety,
  };
  if (!preflight.ok || !preflight.catalog.required_collections_present) {
    return {...base, status: 'blocked', writes_performed: false};
  }

  const [current, membership] = await Promise.all([
    readDocument({
      collection: BETA_ENTITLEMENT_COLLECTION,
      command,
      label: 'read beta entitlement',
      profile,
      runner,
    }),
    readDocument({
      collection: MEMBERSHIP_COLLECTION,
      command,
      label: 'read base membership',
      profile,
      runner,
    }),
  ]);
  const plan = planBetaEntitlementMutation(
    command,
    current,
    membership?.entitlement ?? membership,
  );
  const publicPlan = publicBetaEntitlementPlan(plan);
  if (!options.apply) {
    return {
      ...base,
      plan: publicPlan,
      status: 'planned',
      writes_performed: false,
    };
  }
  if (!writeSafety.ok) {
    throw new BetaEntitlementError(writeSafety.errors.join('; '));
  }
  if (plan.changed) {
    await writeBetaEntitlement({current, plan, profile, runner});
  }
  const stored = await readDocument({
    collection: BETA_ENTITLEMENT_COLLECTION,
    command,
    label: 'verify beta entitlement',
    profile,
    runner,
  });
  const verified = verifyAppliedBetaEntitlement(plan, stored);
  return {
    ...base,
    result: verified,
    status: 'passed',
    writes_performed: plan.changed,
  };
}

async function readDocument({collection, command, label, profile, runner}) {
  const output = await runner.run(
    [
      'db',
      'nosql',
      'execute',
      '-e',
      profile.environment_id,
      '--command',
      JSON.stringify([queryCommand(collection, command.phone_number)]),
      '--json',
    ],
    {label},
  );
  const payload = parseTcbJson(output);
  const results = payload?.data?.results?.[0];
  if (!Array.isArray(results) || results.length > 1) {
    throw new BetaEntitlementError(`${label} query returned an invalid result.`);
  }
  return results[0] ?? null;
}

async function writeBetaEntitlement({current, plan, profile, runner}) {
  const currentRevision = plan.document.revision - 1;
  const filter = current
    ? {_id: plan.command.phone_number, revision: currentRevision}
    : {_id: plan.command.phone_number, revision: {$exists: false}};
  const output = await runner.run(
    [
      'db',
      'nosql',
      'execute',
      '-e',
      profile.environment_id,
      '--command',
      JSON.stringify([
        updateCommand(BETA_ENTITLEMENT_COLLECTION, filter, plan.document, current === null),
      ]),
      '--json',
    ],
    {label: 'write beta entitlement membership'},
  );
  const payload = parseTcbJson(output);
  if (!Array.isArray(payload?.data?.results) || payload.data.results.length !== 1) {
    throw new BetaEntitlementError('membership update returned an invalid result.');
  }
}

function queryCommand(collection, phoneNumber) {
  return {
    TableName: collection,
    CommandType: 'QUERY',
    Command: JSON.stringify({
      find: collection,
      filter: {_id: phoneNumber},
      limit: 1,
    }),
  };
}

function updateCommand(collection, filter, document, upsert) {
  return {
    TableName: collection,
    CommandType: 'UPDATE',
    Command: JSON.stringify({
      update: collection,
      updates: [{q: filter, u: {$set: document}, upsert}],
    }),
  };
}

function readRepositoryState() {
  return {
    branch: git(['branch', '--show-current']),
    dirty: git(['status', '--porcelain']).length > 0,
    head: git(['rev-parse', 'HEAD']),
    originMain: git(['rev-parse', 'origin/main']),
  };
}

function git(args) {
  return execFileSync('git', args, {cwd: REPOSITORY_ROOT, encoding: 'utf8'}).trim();
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
  } catch (error) {
    throw new BetaEntitlementError(`unable to read JSON input: ${error.message}`);
  }
}

function requireValue(argv, index, argument) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new BetaEntitlementError(`${argument} requires a value.`);
  }
  return value;
}

function printUsage() {
  console.log(`Usage:
  node infra/cloudbase/manage-beta-entitlement.mjs \\
    --profile <delivery-profile.json> \\
    --command <beta-entitlement-command.json> [--apply] [--format text|json]

The command is dry-run by default. Apply requires Node ${REQUIRED_DEPLOYMENT_NODE_VERSION}, a clean main exactly equal to origin/main, and a healthy receiver-owned CloudBase environment. Command files contain personal data and must not be committed or included in a release bundle.`);
}

async function main() {
  try {
    const options = parseBetaEntitlementArguments(process.argv.slice(2));
    if (options.help) {
      printUsage();
      return;
    }
    const report = await executeBetaEntitlementCommand(options);
    if (options.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else {
      const plan = report.result ?? report.plan;
      console.log(
        `[beta-entitlement] ${report.status}; action=${plan?.action ?? 'none'}; account=${
          plan?.account_fingerprint ?? 'none'
        }; writes=${report.writes_performed}`,
      );
    }
    if (report.status === 'blocked') process.exitCode = 1;
  } catch (error) {
    const message =
      error instanceof BetaEntitlementError || error instanceof ReleaseDeliveryError
        ? error.message
        : 'unexpected beta entitlement failure';
    console.error(`[beta-entitlement] ${redactText(message)}`);
    process.exitCode = 1;
  }
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) main();

export const betaEntitlementCliInternals = {
  queryCommand,
  updateCommand,
};
