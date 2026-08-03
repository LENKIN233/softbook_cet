#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {createCloudBaseCommandRunner} from './cloudbase-receiver-adapter.mjs';
import {createCloudBasePilotReceiverAdapter} from './cloudbase-pilot-receiver-adapter.mjs';
import {
  ControlledPilotPublisherError,
  publishVerifiedControlledPilot,
  verifyControlledPilotBundleDirectory,
} from './controlled-pilot-publisher-v1.mjs';
import {
  REQUIRED_DEPLOYMENT_NODE_VERSION,
  redactText,
} from './deployment-safety.mjs';
import {
  inspectReceiver,
  receiverDeliveryInternals,
} from './deliver-release.mjs';

const REPOSITORY_ROOT = resolve(
  fileURLToPath(new URL('../..', import.meta.url)),
);

export function parseControlledPilotArguments(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return {help: true};
  const options = {
    apply: false,
    bundlePath: null,
    format: 'text',
    profilePath: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case '--apply':
        options.apply = true;
        break;
      case '--bundle':
        options.bundlePath = requireValue(argv, index, argument);
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
        fail(`unknown argument: ${argument}`);
    }
  }
  if (!options.profilePath) fail('--profile is required.');
  if (!options.bundlePath) fail('--bundle is required.');
  if (!['json', 'text'].includes(options.format)) {
    fail('--format must be text or json.');
  }
  return options;
}

export async function executeControlledPilotPublication(
  options,
  dependencies = {},
) {
  const verified = verifyControlledPilotBundleDirectory({
    bundlePath: options.bundlePath,
    profilePath: options.profilePath,
  });
  const runner =
    dependencies.runner ??
    createCloudBaseCommandRunner({cwd: REPOSITORY_ROOT});
  const repository = dependencies.repository ?? readRepositoryState();
  const nodeVersion = dependencies.nodeVersion ?? process.versions.node;
  const now = dependencies.now ?? (() => new Date());
  const preflight = await inspectReceiver({profile: verified.profile, runner});
  const writeSafety = receiverDeliveryInternals.inspectWriteSafety({
    nodeVersion,
    repository,
  });
  const base = {
    schema_version: 'controlled-pilot-delivery-report.v1',
    applied: options.apply,
    bundle_id: verified.bundle.bundle_id,
    content_version: verified.content.content_version,
    environment_id: verified.profile.environment_id,
    gate_eligible: false,
    pilot_id: verified.bundle.pilot_id,
    preflight: {
      errors: preflight.errors,
      required_collections_present:
        preflight.catalog.required_collections_present,
    },
    release_id: verified.bundle.release_id,
    write_safety: writeSafety,
  };
  if (!preflight.ok || !preflight.catalog.required_collections_present) {
    return {...base, status: 'blocked', writes_performed: false};
  }
  if (!options.apply) {
    return {...base, status: 'planned', writes_performed: false};
  }
  if (!writeSafety.ok) fail(writeSafety.errors.join('; '));
  const adapter =
    dependencies.adapter ??
    createCloudBasePilotReceiverAdapter({
      now,
      profile: verified.profile,
      runner,
    });
  const publication = await publishVerifiedControlledPilot(
    verified,
    adapter,
    {now},
  );
  return {
    ...base,
    publication,
    status: 'passed',
    writes_performed: true,
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
  return execFileSync('git', args, {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
  }).trim();
}

function requireValue(argv, index, argument) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    fail(`${argument} requires a value.`);
  }
  return value;
}

function printUsage() {
  console.log(`Usage:
  node infra/cloudbase/manage-controlled-pilot.mjs \\
    --profile <controlled-pilot-profile.json> \\
    --bundle <controlled-pilot-bundle.json> [--apply] [--format text|json]

The command verifies local evidence and receiver state but is dry-run by default. Apply requires Node ${REQUIRED_DEPLOYMENT_NODE_VERSION}, a clean main exactly equal to origin/main, and the exact independent controlled-pilot environment.`);
}

async function main() {
  try {
    const options = parseControlledPilotArguments(process.argv.slice(2));
    if (options.help) {
      printUsage();
      return;
    }
    const report = await executeControlledPilotPublication(options);
    if (options.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(
        `[controlled-pilot] ${report.status}; pilot=${report.pilot_id}; release=${report.release_id}; writes=${report.writes_performed}; gate_eligible=false`,
      );
    }
    if (report.status === 'blocked') process.exitCode = 1;
  } catch (error) {
    const message =
      error instanceof ControlledPilotPublisherError
        ? error.message
        : 'unexpected controlled pilot delivery failure';
    console.error(`[controlled-pilot] ${redactText(message)}`);
    process.exitCode = 1;
  }
}

function fail(message) {
  throw new ControlledPilotPublisherError(message);
}

const isDirectExecution =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) main();
