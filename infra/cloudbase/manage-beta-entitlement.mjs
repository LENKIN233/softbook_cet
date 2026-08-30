#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
import {createHash, createHmac} from 'node:crypto';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  BetaEntitlementError,
  betaEntitlementInternals,
  planBetaEntitlementMutation,
  publicBetaEntitlementPlan,
  publicBetaEntitlementState,
  validateBetaEntitlementCommand,
} from './beta-entitlement-v1.mjs';
import {createCloudBaseCommandRunner} from './cloudbase-receiver-adapter.mjs';
import {
  REQUIRED_DEPLOYMENT_NODE_VERSION,
  parseTcbJson,
  redactText,
} from './deployment-safety.mjs';
import {
  inspectReceiver,
  receiverDeliveryInternals,
} from './deliver-release.mjs';
import {
  ReleaseDeliveryError,
  validateDeliveryProfile,
} from './release-delivery-v1.mjs';
import {parseStrictJson} from '../../scripts/lib/strict_json.mjs';

const CLOUD_BASE_ROOT = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(CLOUD_BASE_ROOT, '../..');
const MEMBERSHIP_COLLECTION = 'softbook_memberships';
const BETA_ENTITLEMENT_COLLECTION = 'softbook_beta_entitlements';
const FUNCTION_NAME = 'softbook-api';
const OPERATOR_PATTERN = /^(model|agent|service|oidc):[A-Za-z0-9_.-]+$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;

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
  if (!options.profilePath)
    throw new BetaEntitlementError('--profile is required.');
  if (!options.commandPath)
    throw new BetaEntitlementError('--command is required.');
  if (!['json', 'text'].includes(options.format)) {
    throw new BetaEntitlementError('--format must be text or json.');
  }
  return options;
}

export async function executeBetaEntitlementCommand(
  options,
  dependencies = {},
) {
  const clock = dependencies.clock ?? (() => new Date());
  const startedAt = readExecutionTimestamp(clock, 'beta entitlement start');
  const profileBytes = readFileSync(resolve(options.profilePath));
  const profile = validateDeliveryProfile(
    parseJsonBytes(profileBytes, 'delivery profile'),
  );
  if (profile.runtime_mode !== 'closed_beta') {
    throw new BetaEntitlementError(
      'beta entitlement commands require a closed_beta delivery profile.',
    );
  }
  const command = validateBetaEntitlementCommand(readJson(options.commandPath));
  const completeReport = report => ({
    ...report,
    execution: {
      completed_at: readExecutionTimestamp(clock, 'beta entitlement completion'),
      operator: command.actor_id,
      started_at: startedAt,
    },
  });
  const runner =
    dependencies.runner ??
    createCloudBaseCommandRunner({
      cwd: REPOSITORY_ROOT,
      env: operatorCredentialFreeEnvironment(process.env),
    });
  const repository = dependencies.repository ?? readRepositoryState();
  const nodeVersion = dependencies.nodeVersion ?? process.versions.node;
  const preflight = await inspectReceiver({profile, runner});
  const writeSafety = {
    ...receiverDeliveryInternals.inspectWriteSafety({
      nodeVersion,
      repository,
    }),
    node_version: nodeVersion,
  };
  const base = {
    schema_version: 'beta-entitlement-report.v3',
    applied: options.apply,
    gate_eligible: false,
    repository_commit: repository.head,
    profile: {
      environment_id: profile.environment_id,
      profile_id: profile.profile_id,
      profile_sha256: sha256Bytes(profileBytes),
      runtime_mode: profile.runtime_mode,
    },
    command: {
      action: command.action,
      actor_id: command.actor_id,
      campaign_id: command.campaign_id,
      command_sha256: betaEntitlementInternals.hashCanonical(command),
      event_id: command.event_id,
      grant_id: command.grant_id,
    },
    preflight: {
      errors: preflight.errors,
      required_collections_present:
        preflight.catalog.required_collections_present,
    },
    write_safety: writeSafety,
  };
  if (!preflight.ok || !preflight.catalog.required_collections_present) {
    return completeReport({...base, status: 'blocked', writes_performed: false});
  }

  if (options.apply) {
    if (!writeSafety.ok) {
      throw new BetaEntitlementError(writeSafety.errors.join('; '));
    }
    requireApplyIdentity({command, repository});
    const operatorSecret =
      dependencies.operatorSecret ?? process.env.SOFTBOOK_BETA_OPERATOR_SECRET;
    if (!isStrongOperatorSecret(operatorSecret)) {
      throw new BetaEntitlementError(
        'SOFTBOOK_BETA_OPERATOR_SECRET must be a strong receiver-only secret.',
      );
    }
    const applied = await invokeBetaEntitlement({
      command,
      operatorSecret,
      profile,
      runner,
    });
    const stored = await readDocument({
      collection: BETA_ENTITLEMENT_COLLECTION,
      command,
      label: 'verify beta entitlement audit',
      profile,
      runner,
    });
    verifyInvokedBetaEntitlement(command, applied, stored);
    return completeReport({
      ...base,
      base_membership: {
        after_sha256: applied.base_membership_sha256,
        before_sha256: applied.base_membership_sha256,
        unchanged: true,
      },
      beta_state: applied.beta_state,
      result: applied.result,
      status: 'passed',
      writes_performed: applied.writes_performed,
    });
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
  const baseBeforeHash = privacySafeBaseMembershipDigest(membership);
  return completeReport({
    ...base,
    base_membership: {
      after_sha256: baseBeforeHash,
      before_sha256: baseBeforeHash,
      unchanged: true,
    },
    beta_state: publicBetaEntitlementState(plan.document),
    plan: publicPlan,
    status: 'planned',
    writes_performed: false,
  });
}

function requireApplyIdentity({command, repository}) {
  if (!OPERATOR_PATTERN.test(command.actor_id)) {
    throw new BetaEntitlementError(
      'apply requires an identified model, agent, service, or OIDC actor_id.',
    );
  }
  if (!COMMIT_PATTERN.test(repository.head ?? '')) {
    throw new BetaEntitlementError(
      'apply requires a full lowercase repository commit SHA-1.',
    );
  }
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
    throw new BetaEntitlementError(
      `${label} query returned an invalid result.`,
    );
  }
  return results[0] ?? null;
}

async function invokeBetaEntitlement({command, operatorSecret, profile, runner}) {
  const canonicalCommand = validateBetaEntitlementCommand(command);
  const signature = `hmac-sha256:${createHmac('sha256', operatorSecret)
    .update(betaEntitlementInternals.stableStringify(canonicalCommand))
    .digest('hex')}`;
  const invocationDirectory = mkdtempSync(
    join(tmpdir(), 'softbook-beta-entitlement-'),
  );
  const invocationPath = join(invocationDirectory, 'invocation.json');
  try {
    writeFileSync(
      invocationPath,
      JSON.stringify({
        schema_version: 'beta-entitlement-operator-invoke.v1',
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
      {label: 'invoke beta entitlement transaction'},
    );
    return parseBetaEntitlementInvocation(output, command);
  } finally {
    rmSync(invocationDirectory, {force: true, recursive: true});
  }
}

function parseBetaEntitlementInvocation(output, command) {
  const payload = parseTcbJson(output);
  if (payload?.InvokeResult !== 0 || typeof payload.RetMsg !== 'string') {
    throw new BetaEntitlementError('beta entitlement invocation failed.');
  }
  let result;
  try {
    result = JSON.parse(payload.RetMsg);
  } catch {
    throw new BetaEntitlementError(
      'beta entitlement invocation returned invalid JSON.',
    );
  }
  const expectedKeys = [
    'base_membership_sha256',
    'beta_state',
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
    'actor_id',
    'campaign_id',
    'changed',
    'event_id',
    'grant_id',
    'idempotent',
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
  const expectedStateKeys = [
    'active',
    'active_campaign_id',
    'active_grant_id',
    'audit_event_count',
    'revision',
    'state_sha256',
  ];
  const stateKeys =
    result?.beta_state &&
    typeof result.beta_state === 'object' &&
    !Array.isArray(result.beta_state)
      ? Object.keys(result.beta_state).sort()
      : [];
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index]) ||
    resultKeys.length !== expectedResultKeys.length ||
    resultKeys.some((key, index) => key !== expectedResultKeys[index]) ||
    stateKeys.length !== expectedStateKeys.length ||
    stateKeys.some((key, index) => key !== expectedStateKeys[index]) ||
    result.schema_version !== 'beta-entitlement-operator-result.v1' ||
    result.status !== 'passed' ||
    result.gate_eligible !== false ||
    typeof result.writes_performed !== 'boolean' ||
    result.writes_performed !== result.result?.changed ||
    !/^sha256:[a-f0-9]{64}$/.test(result.base_membership_sha256 ?? '') ||
    result.result?.schema_version !== 'beta-entitlement-plan.v2' ||
    result.result?.event_id !== command.event_id ||
    result.result?.campaign_id !== command.campaign_id ||
    result.result?.grant_id !== command.grant_id ||
    result.result?.actor_id !== command.actor_id ||
    JSON.stringify(result).includes(command.phone_number)
  ) {
    throw new BetaEntitlementError(
      'beta entitlement invocation result is invalid.',
    );
  }
  return result;
}

function verifyInvokedBetaEntitlement(command, applied, storedDocument) {
  const stored = betaEntitlementInternals.normalizeBetaEntitlementDocument(
    storedDocument,
  );
  const commandHash = betaEntitlementInternals.hashCanonical(
    validateBetaEntitlementCommand(command),
  );
  const event = stored.audit.find(
    candidate => candidate.event_id === command.event_id,
  );
  const storedState = publicBetaEntitlementState(stored);
  if (
    stored.phone_number !== command.phone_number ||
    event?.command_sha256 !== commandHash ||
    event.action !== applied.result.action ||
    event.actor_id !== applied.result.actor_id ||
    event.campaign_id !== applied.result.campaign_id ||
    event.grant_id !== applied.result.grant_id ||
    event.previous_stage !== applied.result.previous_stage ||
    event.resulting_stage !== applied.result.resulting_stage ||
    betaEntitlementInternals.stableStringify(storedState) !==
      betaEntitlementInternals.stableStringify(applied.beta_state)
  ) {
    throw new BetaEntitlementError(
      'beta entitlement transaction could not be independently verified.',
    );
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

function isStrongOperatorSecret(value) {
  return (
    typeof value === 'string' &&
    value.length >= 32 &&
    new Set(value).size >= 12
  );
}

function operatorCredentialFreeEnvironment(environment) {
  const sanitized = {...environment};
  delete sanitized.SOFTBOOK_BETA_OPERATOR_SECRET;
  return sanitized;
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
    return parseJsonBytes(readFileSync(resolve(path)), 'operator JSON input');
  } catch (error) {
    throw new BetaEntitlementError(
      `unable to read JSON input: ${error.message}`,
    );
  }
}

function parseJsonBytes(bytes, label) {
  return parseStrictJson(bytes, label);
}

function sha256Bytes(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function privacySafeBaseMembershipDigest(documentInput) {
  if (documentInput === null || documentInput === undefined) {
    return betaEntitlementInternals.hashCanonical(null);
  }
  const document = structuredClone(documentInput);
  delete document._id;
  delete document.phone_number;
  const entitlement = structuredClone(document.entitlement ?? document);
  delete entitlement._id;
  delete entitlement.phone_number;
  return betaEntitlementInternals.hashCanonical({
    entitlement,
    updated_at: document.updated_at ?? null,
  });
}

function readExecutionTimestamp(clock, label) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new BetaEntitlementError(`${label} clock is invalid.`);
  }
  return date.toISOString();
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
        `[beta-entitlement] ${report.status}; action=${
          plan?.action ?? 'none'
        }; campaign=${plan?.campaign_id ?? 'none'}; grant=${
          plan?.grant_id ?? 'none'
        }; writes=${report.writes_performed}`,
      );
    }
    if (report.status === 'blocked') process.exitCode = 1;
  } catch (error) {
    const message =
      error instanceof BetaEntitlementError ||
      error instanceof ReleaseDeliveryError
        ? error.message
        : 'unexpected beta entitlement failure';
    console.error(`[beta-entitlement] ${redactText(message)}`);
    process.exitCode = 1;
  }
}

const isDirectExecution =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) main();

export const betaEntitlementCliInternals = {
  invokeBetaEntitlement,
  parseBetaEntitlementInvocation,
  queryCommand,
  verifyInvokedBetaEntitlement,
};
