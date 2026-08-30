#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
import {createHmac} from 'node:crypto';
import {chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {createCloudBaseCommandRunner} from './cloudbase-receiver-adapter.mjs';
import {applyBetaEntitlementToMembership} from './beta-entitlement-v1.mjs';
import {
  validateControlledPilotProfile,
  validatePilotEntitlementCommand,
} from './controlled-pilot-v1.mjs';
import {REQUIRED_DEPLOYMENT_NODE_VERSION, parseTcbJson, redactText} from './deployment-safety.mjs';
import {inspectReceiver, inspectWriteSafety} from './deliver-release.mjs';
import {readPrivateOperatorCommandBytes} from './operator-command-input.mjs';
import {
  PilotEntitlementError,
  pilotEntitlementInternals,
  planPilotEntitlementMutation,
  publicPilotEntitlementPlan,
} from './pilot-entitlement-v1.mjs';

const CLOUD_BASE_ROOT = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(CLOUD_BASE_ROOT, '../..');
const MEMBERSHIP_COLLECTION = 'softbook_memberships';
const BETA_ENTITLEMENT_COLLECTION = 'softbook_beta_entitlements';
const PILOT_ENTITLEMENT_COLLECTION = 'softbook_pilot_entitlements';
const FUNCTION_NAME = 'softbook-api';

export function parsePilotEntitlementArguments(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return {help: true};
  const options = {apply: false, commandPath: null, format: 'text', profilePath: null};
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
        throw new PilotEntitlementError(`unknown argument: ${argument}`);
    }
  }
  if (!options.profilePath) throw new PilotEntitlementError('--profile is required.');
  if (!options.commandPath) throw new PilotEntitlementError('--command is required.');
  if (!['json', 'text'].includes(options.format)) {
    throw new PilotEntitlementError('--format must be text or json.');
  }
  return options;
}

export async function executePilotEntitlementCommand(options, dependencies = {}) {
  const profile = validateControlledPilotProfile(readJson(options.profilePath));
  const commandBytes = options.apply
    ? readPrivateOperatorCommandBytes(options.commandPath, {
        beforeRead: dependencies.beforeOperatorCommandRead ?? null,
        createError: message => new PilotEntitlementError(message),
        repositoryRoot: REPOSITORY_ROOT,
      })
    : readFileSync(resolve(options.commandPath));
  const command = validatePilotEntitlementCommand(
    parseCommandBytes(commandBytes),
  );
  const now = dependencies.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new PilotEntitlementError('operator clock is invalid.');
  }
  if (command.pilot_id !== profile.pilot_id) {
    throw new PilotEntitlementError(
      'pilot entitlement command does not match the receiver profile pilot.',
    );
  }
  if (
    Date.parse(command.occurred_at) > now.getTime() ||
    now.getTime() >= Date.parse(profile.pilot_expires_at) ||
    Date.parse(command.occurred_at) >= Date.parse(profile.pilot_expires_at)
  ) {
    throw new PilotEntitlementError(
      'pilot entitlement command is outside the active pilot window.',
    );
  }
  const runner = dependencies.runner ?? createCloudBaseCommandRunner({cwd: REPOSITORY_ROOT});
  const repository = dependencies.repository ?? readRepositoryState();
  const nodeVersion = dependencies.nodeVersion ?? process.versions.node;
  const preflight = await inspectReceiver({profile, runner});
  const writeSafety = inspectWriteSafety({nodeVersion, repository});
  const base = {
    schema_version: 'pilot-entitlement-report.v2',
    applied: options.apply,
    environment_id: profile.environment_id,
    gate_eligible: false,
    pilot_id: profile.pilot_id,
    preflight: {
      errors: preflight.errors,
      required_collections_present: preflight.catalog.required_collections_present,
    },
    write_safety: writeSafety,
  };
  if (!preflight.ok || !preflight.catalog.required_collections_present) {
    return {...base, status: 'blocked', writes_performed: false};
  }

  if (options.apply) {
    if (!writeSafety.ok) {
      throw new PilotEntitlementError(writeSafety.errors.join('; '));
    }
    const operatorSecret =
      dependencies.operatorSecret ?? process.env.SOFTBOOK_PILOT_OPERATOR_SECRET;
    if (typeof operatorSecret !== 'string' || operatorSecret.length < 32) {
      throw new PilotEntitlementError(
        'SOFTBOOK_PILOT_OPERATOR_SECRET must be a strong receiver-only secret.',
      );
    }
    const applied = await invokePilotEntitlement({
      command,
      operatorSecret,
      profile,
      runner,
    });
    const stored = await readDocument({
      collection: PILOT_ENTITLEMENT_COLLECTION,
      label: 'verify pilot entitlement audit',
      phoneNumber: command.phone_number,
      profile,
      runner,
    });
    verifyInvokedPilotEntitlement(command, applied, stored);
    return {
      ...base,
      result: applied.result,
      status: 'passed',
      writes_performed: applied.writes_performed,
    };
  }

  const [current, membership, betaEntitlement] = await Promise.all([
    readDocument({
      collection: PILOT_ENTITLEMENT_COLLECTION,
      label: 'read pilot entitlement',
      phoneNumber: command.phone_number,
      profile,
      runner,
    }),
    readDocument({
      collection: MEMBERSHIP_COLLECTION,
      label: 'read base membership',
      phoneNumber: command.phone_number,
      profile,
      runner,
    }),
    readDocument({
      collection: BETA_ENTITLEMENT_COLLECTION,
      label: 'read beta entitlement',
      phoneNumber: command.phone_number,
      profile,
      runner,
    }),
  ]);
  const persistedBaseMembership =
    membership?.entitlement ?? membership ?? createInitialMembership();
  const betaOverlay = applyBetaEntitlementToMembership(
    persistedBaseMembership,
    betaEntitlement,
  );
  const baseMembership = {...persistedBaseMembership, ...betaOverlay};
  const plan = planPilotEntitlementMutation(
    command,
    current,
    baseMembership,
  );
  const publicPlan = publicPilotEntitlementPlan(plan);
  return {...base, plan: publicPlan, status: 'planned', writes_performed: false};
}

function verifyInvokedPilotEntitlement(command, applied, storedDocument) {
  const stored = pilotEntitlementInternals.normalizePilotEntitlementDocument(
    storedDocument,
  );
  const canonicalCommand = validatePilotEntitlementCommand(command);
  canonicalCommand.occurred_at = new Date(canonicalCommand.occurred_at).toISOString();
  const commandHash = pilotEntitlementInternals.hashCanonical(canonicalCommand);
  const event = stored.audit.find(candidate => candidate.event_id === command.event_id);
  if (
    event?.command_sha256 !== commandHash ||
    event.action !== applied.result.action ||
    event.pilot_id !== applied.result.pilot_id ||
    event.previous_stage !== applied.result.previous_stage ||
    event.resulting_stage !== applied.result.resulting_stage
  ) {
    throw new PilotEntitlementError(
      'pilot entitlement transaction could not be independently verified.',
    );
  }
}

async function readDocument({collection, label, phoneNumber, profile, runner}) {
  const output = await runner.run(
    [
      'db',
      'nosql',
      'execute',
      '-e',
      profile.environment_id,
      '--command',
      JSON.stringify([queryCommand(collection, phoneNumber)]),
      '--json',
    ],
    {label},
  );
  const payload = parseTcbJson(output);
  const results = payload?.data?.results?.[0];
  if (!Array.isArray(results) || results.length > 1) {
    throw new PilotEntitlementError(`${label} query returned an invalid result.`);
  }
  return results[0] ?? null;
}

async function invokePilotEntitlement({command, operatorSecret, profile, runner}) {
  const canonicalCommand = validatePilotEntitlementCommand(command);
  canonicalCommand.occurred_at = new Date(canonicalCommand.occurred_at).toISOString();
  const signature = `hmac-sha256:${createHmac('sha256', operatorSecret)
    .update(pilotEntitlementInternals.stableStringify(canonicalCommand))
    .digest('hex')}`;
  const invocationDirectory = mkdtempSync(join(tmpdir(), 'softbook-pilot-entitlement-'));
  const invocationPath = join(invocationDirectory, 'invocation.json');
  try {
    writeFileSync(
      invocationPath,
      JSON.stringify({
        schema_version: 'pilot-entitlement-operator-invoke.v1',
        command: canonicalCommand,
        signature,
      }),
    );
    chmodSync(invocationPath, 0o600);
    const output = await runner.run(
      [
        'fn',
        'invoke',
        FUNCTION_NAME,
        '-e',
        profile.environment_id,
        '-d',
        `@${invocationPath}`,
        '--json',
      ],
      {label: 'invoke pilot entitlement transaction'},
    );
    return parsePilotEntitlementInvocation(output, command);
  } finally {
    rmSync(invocationDirectory, {force: true, recursive: true});
  }
}

function parsePilotEntitlementInvocation(output, command) {
  const payload = parseTcbJson(output);
  if (payload?.InvokeResult !== 0 || typeof payload.RetMsg !== 'string') {
    throw new PilotEntitlementError('pilot entitlement invocation failed.');
  }
  let result;
  try {
    result = JSON.parse(payload.RetMsg);
  } catch {
    throw new PilotEntitlementError('pilot entitlement invocation returned invalid JSON.');
  }
  const expectedKeys = [
    'gate_eligible',
    'result',
    'schema_version',
    'status',
    'writes_performed',
  ];
  const actualKeys =
    result && typeof result === 'object' && !Array.isArray(result)
      ? Object.keys(result).sort()
      : [];
  const expectedResultKeys = [
    'action',
    'actor',
    'changed',
    'event_id',
    'idempotent',
    'pilot_id',
    'previous_stage',
    'resulting_stage',
    'schema_version',
  ];
  const resultKeys =
    result?.result &&
    typeof result.result === 'object' &&
    !Array.isArray(result.result)
      ? Object.keys(result.result).sort()
      : [];
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index]) ||
    resultKeys.length !== expectedResultKeys.length ||
    resultKeys.some((key, index) => key !== expectedResultKeys[index]) ||
    result?.schema_version !== 'pilot-entitlement-operator-result.v1' ||
    result.status !== 'passed' ||
    result.gate_eligible !== false ||
    typeof result.writes_performed !== 'boolean' ||
    result.writes_performed !== result.result?.changed ||
    result.result?.schema_version !== 'pilot-entitlement-plan.v2' ||
    result.result?.action !== command.action ||
    result.result?.actor !== command.actor ||
    result.result?.event_id !== command.event_id ||
    result.result?.pilot_id !== command.pilot_id ||
    result.result?.previous_stage !== command.previous_stage ||
    result.result?.resulting_stage !== command.resulting_stage ||
    typeof result.result?.idempotent !== 'boolean' ||
    pilotEntitlementInternals.containsPhoneMaterial(result.result?.actor) ||
    pilotEntitlementInternals.containsPhoneMaterial(result.result?.event_id) ||
    pilotEntitlementInternals.containsPhoneMaterial(result.result?.pilot_id)
  ) {
    throw new PilotEntitlementError('pilot entitlement invocation result is invalid.');
  }
  return result;
}

function queryCommand(collection, phoneNumber) {
  return {
    TableName: collection,
    CommandType: 'QUERY',
    Command: JSON.stringify({find: collection, filter: {_id: phoneNumber}, limit: 1}),
  };
}

function createInitialMembership() {
  return {
    counted_entry_count: 0,
    last_experience_ended_by: null,
    recovery_prompt_visible: false,
    stage: 'trial_available',
    trial_duration_days: 5,
    trial_expires_at: null,
    trial_started_at: null,
    trial_started_at_entry_count: null,
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
    throw new PilotEntitlementError(`unable to read JSON input: ${error.message}`);
  }
}

function parseCommandBytes(bytes) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new PilotEntitlementError(
      `unable to read JSON input: ${error.message}`,
    );
  }
}

function requireValue(argv, index, argument) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new PilotEntitlementError(`${argument} requires a value.`);
  }
  return value;
}

function printUsage() {
  console.log(`Usage:
  node infra/cloudbase/manage-pilot-entitlement.mjs \\
    --profile <controlled-pilot-profile.json> \\
    --command <pilot-entitlement-command.json> [--apply] [--format text|json]

The command is dry-run by default. Apply requires Node ${REQUIRED_DEPLOYMENT_NODE_VERSION}, a clean main exactly equal to origin/main, and a healthy matching receiver-owned controlled-pilot environment. Command files contain personal data and must not be committed or bundled.`);
}

async function main() {
  try {
    const options = parsePilotEntitlementArguments(process.argv.slice(2));
    if (options.help) return printUsage();
    const report = await executePilotEntitlementCommand(options);
    if (options.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else {
      const plan = report.result ?? report.plan;
      console.log(
        `[pilot-entitlement] ${report.status}; action=${plan?.action ?? 'none'}; pilot=${
          report.pilot_id
        }; event=${plan?.event_id ?? 'none'}; writes=${report.writes_performed}`,
      );
    }
    if (report.status === 'blocked') process.exitCode = 1;
  } catch (error) {
    const message =
      error instanceof PilotEntitlementError || error?.name === 'ControlledPilotContractError'
        ? error.message
        : 'unexpected pilot entitlement failure';
    console.error(`[pilot-entitlement] ${redactText(message)}`);
    process.exitCode = 1;
  }
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) main();

export const pilotEntitlementCliInternals = {
  invokePilotEntitlement,
  parsePilotEntitlementInvocation,
  queryCommand,
  verifyInvokedPilotEntitlement,
};
