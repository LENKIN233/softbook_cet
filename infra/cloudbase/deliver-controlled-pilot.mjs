#!/usr/bin/env node

import {readFileSync} from 'node:fs';
import {basename, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  createCloudBaseCommandRunner,
  createCloudBaseReceiverAdapter,
} from './cloudbase-receiver-adapter.mjs';
import {
  buildBackendDeploymentId,
  buildReceiverRuntimeEnvironment,
  createProcessRunner,
  deployReceiverFunction,
  inspectReceiver,
  inspectApiFunction,
  inspectReceiverSecrets,
  inspectWriteSafety,
  provisionCollections,
  readRepositoryState,
  readUserDataCounts,
  requireDeliveryOperator,
  requireApplyReady,
  verifyApiRoute,
} from './deliver-release.mjs';
import {REQUIRED_DEPLOYMENT_NODE_VERSION} from './deployment-safety.mjs';
import {
  ControlledPilotPublisherError,
  publishVerifiedControlledPilot,
  verifyControlledPilotBundleDirectory,
} from './controlled-pilot-publisher-v1.mjs';
import {
  ControlledPilotContractError,
  validateControlledPilotProfile,
} from './controlled-pilot-v1.mjs';
import {ReleaseDeliveryError} from './release-delivery-v1.mjs';

const CLOUD_BASE_ROOT = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(CLOUD_BASE_ROOT, '../..');
const COMMANDS = new Set(['preflight', 'provision', 'deploy', 'publish', 'verify']);

export function parseControlledPilotArguments(argv) {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') {
    return {command: 'help'};
  }
  if (!COMMANDS.has(command)) {
    fail(`unknown controlled-pilot delivery command: ${command}`);
  }
  const options = {
    apply: false,
    bundlePath: null,
    command,
    format: 'text',
    operator: null,
    profilePath: null,
  };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === '--apply') {
      options.apply = true;
    } else if (argument === '--bundle') {
      options.bundlePath = requireValue(rest, ++index, argument);
    } else if (argument === '--format') {
      options.format = requireValue(rest, ++index, argument);
    } else if (argument === '--operator') {
      options.operator = requireValue(rest, ++index, argument);
    } else if (argument === '--profile') {
      options.profilePath = requireValue(rest, ++index, argument);
    } else if (argument === '--help' || argument === '-h') {
      return {command: 'help'};
    } else {
      fail(`unknown argument: ${argument}`);
    }
  }
  if (!options.profilePath) fail('--profile is required.');
  if (!['json', 'text'].includes(options.format)) {
    fail('--format must be text or json.');
  }
  if (['publish', 'verify'].includes(command) && !options.bundlePath) {
    fail(`${command} requires --bundle.`);
  }
  if (['preflight', 'verify'].includes(command) && options.apply) {
    fail(`${command} is read-only and rejects --apply.`);
  }
  if ((options.apply || command === 'verify') && !options.operator) {
    fail(`${command} requires --operator for an auditable report.`);
  }
  if (options.operator) requireDeliveryOperator(options.operator);
  return options;
}

export async function executeControlledPilotDelivery(options, dependencies = {}) {
  try {
    const clock = dependencies.clock ?? (() => new Date());
    const startedAt = readExecutionTimestamp(clock, 'controlled-pilot delivery start');
    const operator =
      options.apply || options.command === 'verify'
        ? requireDeliveryOperator(options.operator)
        : options.operator
          ? requireDeliveryOperator(options.operator)
          : null;
    const completeReport = report => ({
      ...report,
      execution: {
        completed_at: readExecutionTimestamp(
          clock,
          'controlled-pilot delivery completion',
        ),
        operator,
        started_at: startedAt,
      },
    });
    const env = dependencies.env ?? process.env;
    const profile = validateControlledPilotProfile(readJson(options.profilePath));
    const runner =
      dependencies.runner ?? createCloudBaseCommandRunner({cwd: REPOSITORY_ROOT});
    const processRunner = dependencies.processRunner ?? createProcessRunner();
    const nodeVersion = dependencies.nodeVersion ?? process.versions.node;
    const repository = dependencies.repository ?? readRepositoryState();
    const backendDeploymentId = buildBackendDeploymentId({
      profile,
      repositoryCommit: repository.head,
    });
    const preflight = await inspectReceiver({profile, runner});
    const secretInspection = inspectReceiverSecrets(profile, env);
    const writeSafety = inspectWriteSafety({nodeVersion, repository});
    const base = {
      schema_version: 'controlled-pilot-receiver-delivery-report.v2',
      operation: options.command,
      applied: options.apply,
      backend_deployment_id: backendDeploymentId,
      gate_eligible: false,
      pilot_id: profile.pilot_id,
      profile: {
        environment_id: profile.environment_id,
        profile_id: profile.profile_id,
        region: profile.region,
        runtime_mode: profile.runtime_mode,
      },
      preflight,
      receiver_secrets: secretInspection.public,
      write_safety: writeSafety,
    };

    if (options.command === 'preflight') {
      return completeReport({
        ...base,
        status:
          preflight.ok && secretInspection.ok && writeSafety.ok ? 'passed' : 'blocked',
        writes_performed: false,
      });
    }

    if (options.command === 'provision') {
      if (!options.apply) {
        return completeReport({
          ...base,
          collection_plan: preflight.catalog.missing_required_collections,
          status: 'planned',
          writes_performed: false,
        });
      }
      requireApplyReady({preflight, secretInspection, writeSafety});
      const provisioned = await provisionCollections({profile, runner, preflight});
      return completeReport({
        ...base,
        provisioned,
        status: 'passed',
        writes_performed: true,
      });
    }

    if (options.command === 'deploy') {
      if (!options.apply) {
        return completeReport({
          ...base,
          deployment_plan: {
            api_path: new URL(profile.api_base_url).pathname,
            deletion_worker_trigger: 'account-deletion-every-minute',
            fixed_sms_code_present: false,
            function_name: 'softbook-api',
            function_names: [
              'softbook-api',
              'softbook-account-deletion-worker',
            ],
            runtime: 'Nodejs20.19',
            runtime_mode: 'controlled_pilot',
          },
          status: 'planned',
          writes_performed: false,
        });
      }
      requireApplyReady({preflight, secretInspection, writeSafety});
      if (!preflight.catalog.required_collections_present) {
        fail('deploy requires the complete collection catalog.');
      }
      const deployed = await deployReceiverFunction({
        backendDeploymentId,
        description: 'Softbook CET receiver-owned controlled pilot runtime',
        env,
        processRunner,
        profile,
        runner,
        runtimeMode: 'controlled_pilot',
      });
      return completeReport({...base, deployed, status: 'passed', writes_performed: true});
    }

    const verified = verifyControlledPilotBundleDirectory({
      bundlePath: options.bundlePath,
      profilePath: options.profilePath,
    });
    const adapter = createCloudBaseReceiverAdapter({profile, runner});

    if (options.command === 'publish') {
      if (!options.apply) {
        return completeReport({
          ...base,
          release: publicVerifiedPilot(verified),
          status: 'planned',
          writes_performed: false,
        });
      }
      requireApplyReady({preflight, secretInspection, writeSafety});
      if (!preflight.catalog.required_collections_present) {
        fail('publish requires the complete collection catalog.');
      }
      const published = await publishVerifiedControlledPilot(verified, adapter);
      return completeReport({...base, published, status: 'passed', writes_performed: true});
    }

    const active = await adapter.verifyActiveRelease({
      contentVersion: verified.bundle.content.content_version,
      pilotId: verified.bundle.pilot_id,
      releaseId: verified.bundle.release_id,
      track: verified.bundle.track,
    });
    if (
      active.release?.schema_version !== 'pilot-content-release.v1' ||
      active.release?.pilot_id !== profile.pilot_id ||
      active.release?.gate_eligible !== false
    ) {
      fail('active controlled-pilot release could not be reverified.');
    }
    const endpoint = await verifyApiRoute(
      profile.api_base_url,
      dependencies.fetchImpl ?? globalThis.fetch,
    );
    const backendDeployment = await inspectApiFunction({
      envId: profile.environment_id,
      expectedDeploymentId: backendDeploymentId,
      runner,
    });
    const dataCounts = await readUserDataCounts({profile, runner});
    return completeReport({
      ...base,
      active_release: {
        content_version: active.content_version,
        pilot_id: active.release.pilot_id,
        release_id: active.release.release_id,
      },
      api_route: endpoint,
      backend_deployment: backendDeployment.public,
      release: publicVerifiedPilot(verified),
      status:
        preflight.catalog.required_collections_present &&
        backendDeployment.ok &&
        endpoint.ok
          ? 'passed'
          : 'blocked',
      user_data_observation: dataCounts,
      writes_performed: false,
    });
  } catch (error) {
    if (
      error instanceof ControlledPilotContractError ||
      error instanceof ControlledPilotPublisherError ||
      error instanceof ReleaseDeliveryError
    ) {
      throw error;
    }
    fail(error instanceof Error ? error.message : 'unknown controlled-pilot failure');
  }
}

function readExecutionTimestamp(clock, label) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) fail(`${label} clock is invalid.`);
  return date.toISOString();
}

function publicVerifiedPilot(verified) {
  return {
    audio_asset_count: verified.content.assets.length,
    bundle_id: verified.bundle.bundle_id,
    card_count: verified.content.card_records.length,
    content_version: verified.content.content_version,
    free_card_count: verified.bundle.content.free_card_count,
    gate_eligible: false,
    pilot_id: verified.bundle.pilot_id,
    release_id: verified.bundle.release_id,
  };
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
  } catch {
    fail(`cannot read JSON: ${basename(path)}`);
  }
}

function requireValue(argv, index, option) {
  const value = argv[index];
  if (!value || value.startsWith('--')) fail(`${option} requires a value.`);
  return value;
}

function fail(message) {
  throw new ReleaseDeliveryError(message);
}

function printUsage() {
  console.log(`Usage:
  node infra/cloudbase/deliver-controlled-pilot.mjs preflight --profile <controlled-pilot-profile.json>
  node infra/cloudbase/deliver-controlled-pilot.mjs provision --profile <profile> [--apply --operator <id>]
  node infra/cloudbase/deliver-controlled-pilot.mjs deploy --profile <profile> [--apply --operator <id>]
  node infra/cloudbase/deliver-controlled-pilot.mjs publish --profile <profile> --bundle <bundle> [--apply --operator <id>]
  node infra/cloudbase/deliver-controlled-pilot.mjs verify --profile <profile> --bundle <bundle> --operator <id>

All artifacts remain gate_eligible=false. Mutating commands are dry-run unless --apply is explicit. Apply requires clean exact main, Node ${REQUIRED_DEPLOYMENT_NODE_VERSION}, receiver secrets, and successful remote preflight.`);
}

async function main() {
  try {
    const options = parseControlledPilotArguments(process.argv.slice(2));
    if (options.command === 'help') {
      printUsage();
      return;
    }
    const report = await executeControlledPilotDelivery(options);
    if (options.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(
        `[controlled-pilot-delivery] ${report.operation}: ${report.status}; writes=${
          report.writes_performed ?? false
        }; gate_eligible=false`,
      );
    }
    if (report.status === 'blocked') process.exitCode = 1;
  } catch (error) {
    console.error(
      `[controlled-pilot-delivery] ${
        error instanceof Error ? error.message : 'unknown failure'
      }`,
    );
    process.exitCode = 1;
  }
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) main();
