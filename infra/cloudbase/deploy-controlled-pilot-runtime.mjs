#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {createCloudBaseCommandRunner} from './cloudbase-receiver-adapter.mjs';
import {
  ControlledPilotContractError,
  validateControlledPilotProfile,
} from './controlled-pilot-v1.mjs';
import {
  REQUIRED_DEPLOYMENT_NODE_VERSION,
  redactText,
} from './deployment-safety.mjs';
import {
  buildReceiverRuntimeEnvironment,
  createProcessRunner,
  deployReceiverFunction,
  inspectReceiver,
  inspectReceiverSecrets,
  receiverDeliveryInternals,
} from './deliver-release.mjs';
import {ReleaseDeliveryError} from './release-delivery-v1.mjs';

const REPOSITORY_ROOT = resolve(
  fileURLToPath(new URL('../..', import.meta.url)),
);

export function parseControlledPilotDeployArguments(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return {help: true};
  const options = {apply: false, format: 'text', profilePath: null};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case '--apply':
        options.apply = true;
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
        throw new ReleaseDeliveryError(`unknown argument: ${argument}`);
    }
  }
  if (!options.profilePath) {
    throw new ReleaseDeliveryError('--profile is required.');
  }
  if (!['json', 'text'].includes(options.format)) {
    throw new ReleaseDeliveryError('--format must be text or json.');
  }
  return options;
}

export async function executeControlledPilotRuntimeDeploy(
  options,
  dependencies = {},
) {
  const env = dependencies.env ?? process.env;
  const profile = validateControlledPilotProfile(
    readJson(options.profilePath),
  );
  const runner =
    dependencies.runner ??
    createCloudBaseCommandRunner({cwd: REPOSITORY_ROOT});
  const processRunner = dependencies.processRunner ?? createProcessRunner();
  const repository = dependencies.repository ?? readRepositoryState();
  const nodeVersion = dependencies.nodeVersion ?? process.versions.node;
  const preflight = await inspectReceiver({profile, runner});
  const secretInspection = inspectReceiverSecrets(profile, env);
  const writeSafety = receiverDeliveryInternals.inspectWriteSafety({
    nodeVersion,
    repository,
  });
  const base = {
    schema_version: 'controlled-pilot-runtime-deploy-report.v1',
    applied: options.apply,
    environment_id: profile.environment_id,
    gate_eligible: false,
    pilot_id: profile.pilot_id,
    preflight: {
      errors: preflight.errors,
      required_collections_present:
        preflight.catalog.required_collections_present,
    },
    receiver_secrets: secretInspection.public,
    write_safety: writeSafety,
  };
  const blockingErrors = [
    ...preflight.errors,
    ...secretInspection.errors,
    ...writeSafety.errors,
  ];
  if (!options.apply) {
    return {
      ...base,
      deployment_plan: {
        api_function: 'softbook-api',
        api_path: '/softbook-api',
        deletion_worker_function: 'softbook-account-deletion-worker',
        runtime_mode: 'controlled_pilot',
      },
      status:
        blockingErrors.length === 0 &&
        preflight.catalog.required_collections_present
          ? 'planned'
          : 'blocked',
      writes_performed: false,
    };
  }
  if (blockingErrors.length > 0) {
    throw new ReleaseDeliveryError(blockingErrors.join('; '));
  }
  if (!preflight.catalog.required_collections_present) {
    throw new ReleaseDeliveryError(
      'controlled pilot deploy requires the complete collection catalog.',
    );
  }
  const deployed = await deployReceiverFunction({
    apiPath: '/softbook-api',
    env,
    includeDeletionWorker: true,
    processRunner,
    profile,
    runner,
    runtimeMode: 'controlled_pilot',
  });
  return {
    ...base,
    deployed,
    status: 'passed',
    writes_performed: true,
  };
}

export function buildControlledPilotRuntimeEnvironment(profile, env) {
  return buildReceiverRuntimeEnvironment(
    profile,
    env,
    'controlled_pilot',
  );
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

function readJson(path) {
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
  } catch (error) {
    throw new ReleaseDeliveryError(`cannot read controlled pilot profile: ${error.message}`);
  }
}

function requireValue(argv, index, argument) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new ReleaseDeliveryError(`${argument} requires a value.`);
  }
  return value;
}

function printUsage() {
  console.log(`Usage:
  node infra/cloudbase/deploy-controlled-pilot-runtime.mjs \\
    --profile <controlled-pilot-profile.json> [--apply] [--format text|json]

Dry-run is the default. Apply deploys the controlled-pilot API and the non-HTTP account-deletion worker only after Node ${REQUIRED_DEPLOYMENT_NODE_VERSION}, clean-main, receiver secrets and collection gates pass.`);
}

async function main() {
  try {
    const options = parseControlledPilotDeployArguments(
      process.argv.slice(2),
    );
    if (options.help) {
      printUsage();
      return;
    }
    const report = await executeControlledPilotRuntimeDeploy(options);
    if (options.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(
        `[controlled-pilot-runtime] ${report.status}; pilot=${report.pilot_id}; writes=${report.writes_performed}; gate_eligible=false`,
      );
    }
    if (report.status === 'blocked') process.exitCode = 1;
  } catch (error) {
    const message =
      error instanceof ReleaseDeliveryError ||
      error instanceof ControlledPilotContractError
        ? error.message
        : 'unexpected controlled pilot runtime deployment failure';
    console.error(`[controlled-pilot-runtime] ${redactText(message)}`);
    process.exitCode = 1;
  }
}

const isDirectExecution =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) main();
