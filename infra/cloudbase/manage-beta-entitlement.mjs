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
  buildBackendDeploymentId,
  inspectApiFunction,
  inspectReceiver,
  receiverDeliveryInternals,
} from './deliver-release.mjs';
import {
  ReleaseDeliveryError,
  validateDeliveryProfile,
} from './release-delivery-v1.mjs';
import {parseStrictJson} from '../../scripts/lib/strict_json.mjs';
import {readPrivateOperatorCommandBytes} from './operator-command-input.mjs';

const CLOUD_BASE_ROOT = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(CLOUD_BASE_ROOT, '../..');
const MEMBERSHIP_COLLECTION = 'softbook_memberships';
const ACCOUNT_COLLECTION = 'softbook_accounts';
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
  const commandRead = options.apply
    ? readPrivateOperatorCommandBytes(options.commandPath, {
        beforeRead: dependencies.beforeOperatorCommandRead ?? null,
        createError: message => new BetaEntitlementError(message),
        git: dependencies.operatorCommandGit ?? execFileSync,
        headMaterialProbe: dependencies.operatorHeadMaterialProbe ?? null,
        repositoryRoot: REPOSITORY_ROOT,
      })
    : {
        bytes: readFileSync(resolve(options.commandPath)),
        checkedHead: null,
      };
  const command = validateBetaEntitlementCommand(
    parseJsonBytes(commandRead.bytes, 'operator JSON input'),
  );
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
  const repositoryStateReader =
    dependencies.repositoryStateReader ??
    (() => dependencies.repository ?? readRepositoryState());
  const repository = repositoryStateReader();
  const nodeVersion = dependencies.nodeVersion ?? process.versions.node;
  if (options.apply) {
    assertCheckedRepositoryHead(repository, commandRead.checkedHead);
    requireApplyIdentity({command, repository});
  }
  const preflight = await inspectReceiver({profile, runner});
  const backendDeploymentId = buildBackendDeploymentId({
    profile,
    repositoryCommit: repository.head,
  });
  const backendInspection = options.apply
    ? await inspectApiFunction({
        envId: profile.environment_id,
        expectedDeploymentId: backendDeploymentId,
        profile,
        runner,
      })
    : null;
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
    backend_deployment_id: backendDeploymentId,
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
      command_hmac_sha256: null,
      event_id: command.event_id,
      grant_id: command.grant_id,
    },
    preflight: {
      backend_deployment: backendInspection?.public ?? null,
      backend_deployment_verified: backendInspection?.ok ?? false,
      errors: [
        ...preflight.errors,
        ...(backendInspection?.errors ?? []),
      ],
      required_collections_present:
        preflight.catalog.required_collections_present,
    },
    write_safety: writeSafety,
  };
  if (
    !preflight.ok ||
    !preflight.catalog.required_collections_present ||
    (options.apply && !backendInspection?.ok)
  ) {
    return completeReport({...base, status: 'blocked', writes_performed: false});
  }

  await requireCurrentAccountInstance({
    command,
    observedAt: startedAt,
    profile,
    runner,
  });

  if (options.apply) {
    if (!writeSafety.ok) {
      throw new BetaEntitlementError(writeSafety.errors.join('; '));
    }
    const operatorSecret =
      dependencies.operatorSecret ?? process.env.SOFTBOOK_BETA_OPERATOR_SECRET;
    if (!isStrongOperatorSecret(operatorSecret)) {
      throw new BetaEntitlementError(
        'SOFTBOOK_BETA_OPERATOR_SECRET must be a strong receiver-only secret.',
      );
    }
    const finalRepository = repositoryStateReader();
    assertCheckedRepositoryHead(finalRepository, commandRead.checkedHead);
    const finalWriteSafety = receiverDeliveryInternals.inspectWriteSafety({
      nodeVersion,
      repository: finalRepository,
    });
    if (!finalWriteSafety.ok) {
      throw new BetaEntitlementError(finalWriteSafety.errors.join('; '));
    }
    const applied = await invokeBetaEntitlement({
      backendDeploymentId,
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
      beta_state_before: applied.beta_state_before,
      beta_state: applied.beta_state,
      command: {
        ...base.command,
        command_hmac_sha256: applied.report_command_hmac_sha256,
      },
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
    beta_state_before: publicBetaEntitlementState(current),
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

function assertCheckedRepositoryHead(repository, checkedHead) {
  if (
    !/^[0-9a-f]{40}$/.test(checkedHead ?? '') ||
    repository?.head !== checkedHead ||
    repository?.originMain !== checkedHead
  ) {
    throw new BetaEntitlementError(
      'operator command checked HEAD must equal repository HEAD and origin/main.',
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

async function requireCurrentAccountInstance({
  command,
  observedAt,
  profile,
  runner,
}) {
  const output = await runner.run(
    [
      'db', 'nosql', 'execute', '-e', profile.environment_id, '--command',
      JSON.stringify([queryByFieldCommand(
        ACCOUNT_COLLECTION,
        'account_instance_id',
        command.expected_account_instance_id,
      )]),
      '--json',
    ],
    {label: 'verify current account instance'},
  );
  const results = parseTcbJson(output)?.data?.results?.[0];
  if (!Array.isArray(results) || results.length !== 1) {
    throw new BetaEntitlementError(
      'The expected account instance does not exist; the user must sign in first.',
    );
  }
  const account = assertCurrentAccountInstance(
    results[0],
    command.expected_account_instance_id,
  );
  const sessionOutput = await runner.run(
    [
      'db', 'nosql', 'execute', '-e', profile.environment_id, '--command',
      JSON.stringify([queryByFilterCommand('softbook_auth_sessions', {
        account_instance_id: command.expected_account_instance_id,
        account_key: account.account_key,
        phone_number: command.phone_number,
        status: 'active',
      })]),
      '--json',
    ],
    {label: 'verify account instance phone binding'},
  );
  const sessions = parseTcbJson(sessionOutput)?.data?.results?.[0];
  if (
    !Array.isArray(sessions) ||
    sessions.length === 0 ||
    sessions.some(session => !isExactActiveSession(
      session,
      account,
      command,
      observedAt,
    ))
  ) {
    throw new BetaEntitlementError(
      'The expected account instance is not bound to this signed-in user.',
    );
  }
}

function isExactActiveSession(document, account, command, observedAt) {
  const value = {...document};
  const documentId = value._id;
  delete value._id;
  const expectedKeys = [
    'access_expires_at', 'account_instance_id', 'account_key', 'created_at',
    'device_id', 'device_name', 'phone_number', 'refresh_expires_at',
    'refresh_rotation', 'refresh_token_hash', 'revoked_at', 'revoked_reason',
    'session_id', 'status', 'updated_at',
  ].sort();
  const keys = Object.keys(value).sort();
  return (
    keys.length === expectedKeys.length &&
    keys.every((key, index) => key === expectedKeys[index]) &&
    value.session_id === documentId &&
    /^[A-Za-z0-9_-]{24,128}$/.test(value.session_id ?? '') &&
    value.status === 'active' &&
    value.revoked_at === null &&
    value.revoked_reason === null &&
    value.account_key === account.account_key &&
    value.account_instance_id === command.expected_account_instance_id &&
    value.phone_number === command.phone_number &&
    Number.isSafeInteger(value.refresh_rotation) &&
    value.refresh_rotation >= 0 &&
    /^[a-f0-9]{64}$/.test(value.refresh_token_hash ?? '') &&
    [
      value.access_expires_at,
      value.created_at,
      value.refresh_expires_at,
      value.updated_at,
    ].every(isCanonicalIsoTimestamp) &&
    (value.device_id === null ||
      (typeof value.device_id === 'string' && value.device_id.length <= 128)) &&
    (value.device_name === null ||
      (typeof value.device_name === 'string' && value.device_name.length <= 128)) &&
    Date.parse(account.created_at) <= Date.parse(value.created_at) &&
    Date.parse(value.created_at) <= Date.parse(value.updated_at) &&
    Date.parse(value.updated_at) <= Date.parse(observedAt) &&
    Date.parse(value.access_expires_at) > Date.parse(value.created_at) &&
    Date.parse(value.refresh_expires_at) > Date.parse(observedAt)
  );
}

function assertCurrentAccountInstance(document, expectedId) {
  const value = {...document};
  const documentId = value._id;
  delete value._id;
  if (
    Object.keys(value).sort().join(',') !==
      'account_instance_id,account_key,created_at,schema_version' ||
    value.schema_version !== 'account-instance.v1' ||
    value.account_instance_id !== expectedId ||
    !/^[a-f0-9]{64}$/.test(value.account_key ?? '') ||
    value.account_key !== documentId ||
    !isCanonicalIsoTimestamp(value.created_at) ||
    Object.hasOwn(value, 'phone_number')
  ) {
    throw new BetaEntitlementError('The expected account instance is invalid.');
  }
  return value;
}

function isCanonicalIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

async function invokeBetaEntitlement({
  backendDeploymentId,
  command,
  operatorSecret,
  profile,
  runner,
}) {
  const canonicalCommand = validateBetaEntitlementCommand(command);
  const signature = `hmac-sha256:${createHmac('sha256', operatorSecret)
    .update(
      betaEntitlementInternals.stableStringify({
        schema_version: 'beta-entitlement-operator-signature.v1',
        backend_deployment_id: backendDeploymentId,
        command: canonicalCommand,
      }),
    )
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
        backend_deployment_id: backendDeploymentId,
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
    const parsed = parseBetaEntitlementInvocation(
      output,
      command,
      backendDeploymentId,
    );
    return {
      ...parsed,
      report_command_hmac_sha256: `hmac-sha256:${createHmac(
        'sha256',
        operatorSecret,
      )
        .update(
          betaEntitlementInternals.stableStringify({
            schema_version: 'beta-entitlement-report-command-binding.v1',
            backend_deployment_id: backendDeploymentId,
            command: canonicalCommand,
          }),
        )
        .digest('hex')}`,
    };
  } finally {
    rmSync(invocationDirectory, {force: true, recursive: true});
  }
}

function parseBetaEntitlementInvocation(
  output,
  command,
  expectedBackendDeploymentId,
) {
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
    'backend_deployment_id',
    'base_membership_sha256',
    'beta_state',
    'beta_state_before',
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
  const beforeStateKeys =
    result?.beta_state_before &&
    typeof result.beta_state_before === 'object' &&
    !Array.isArray(result.beta_state_before)
      ? Object.keys(result.beta_state_before).sort()
      : [];
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index]) ||
    resultKeys.length !== expectedResultKeys.length ||
    resultKeys.some((key, index) => key !== expectedResultKeys[index]) ||
    stateKeys.length !== expectedStateKeys.length ||
    stateKeys.some((key, index) => key !== expectedStateKeys[index]) ||
    beforeStateKeys.length !== expectedStateKeys.length ||
    beforeStateKeys.some(
      (key, index) => key !== expectedStateKeys[index],
    ) ||
    result.schema_version !== 'beta-entitlement-operator-result.v1' ||
    result.backend_deployment_id !== expectedBackendDeploymentId ||
    result.status !== 'passed' ||
    result.gate_eligible !== false ||
    typeof result.writes_performed !== 'boolean' ||
    result.writes_performed !== result.result?.changed ||
    !/^sha256:[a-f0-9]{64}$/.test(result.base_membership_sha256 ?? '') ||
    result.result?.schema_version !== 'beta-entitlement-plan.v2' ||
    result.result?.action !== command.action ||
    result.result?.event_id !== command.event_id ||
    result.result?.campaign_id !== command.campaign_id ||
    result.result?.grant_id !== command.grant_id ||
    result.result?.actor_id !== command.actor_id ||
    [
      result.result?.actor_id,
      result.result?.campaign_id,
      result.result?.event_id,
      result.result?.grant_id,
    ].some(betaEntitlementInternals.containsAccountInstanceMaterial) ||
    JSON.stringify(result).includes(command.phone_number)
  ) {
    throw new BetaEntitlementError(
      'beta entitlement invocation result is invalid.',
    );
  }
  validateBetaEntitlementInvocationSemantics(result, command);
  return result;
}

function validateBetaEntitlementInvocationSemantics(result, command) {
  const before = result.beta_state_before;
  const after = result.beta_state;
  const plan = result.result;
  const statesAreValid = [before, after].every(state => {
    const activeIdsAreValid = state.active
      ? /^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$/.test(
          state.active_campaign_id ?? '',
        ) &&
        /^[A-Za-z0-9][A-Za-z0-9._:-]{11,95}$/.test(
          state.active_grant_id ?? '',
        ) &&
        !betaEntitlementInternals.containsPhoneMaterial(
          state.active_campaign_id,
        ) &&
        !betaEntitlementInternals.containsPhoneMaterial(
          state.active_grant_id,
        ) &&
        !betaEntitlementInternals.containsAccountInstanceMaterial(
          state.active_campaign_id,
        ) &&
        !betaEntitlementInternals.containsAccountInstanceMaterial(
          state.active_grant_id,
        )
      : state.active_campaign_id === null && state.active_grant_id === null;
    return (
      typeof state.active === 'boolean' &&
      Number.isSafeInteger(state.audit_event_count) &&
      state.audit_event_count >= 0 &&
      Number.isSafeInteger(state.revision) &&
      state.revision >= 0 &&
      state.audit_event_count === state.revision &&
      /^sha256:[a-f0-9]{64}$/.test(state.state_sha256 ?? '') &&
      activeIdsAreValid
    );
  });
  const replayIsStable =
    plan.changed === false &&
    plan.idempotent === true &&
    betaEntitlementInternals.stableStringify(before) ===
      betaEntitlementInternals.stableStringify(after);
  const mutationAdvances =
    plan.changed === true &&
    plan.idempotent === false &&
    after.revision === before.revision + 1 &&
    after.audit_event_count === before.audit_event_count + 1;
  const actionTransitionIsValid =
    command.action === 'grant'
      ? before.active === false &&
        after.active === true &&
        after.active_campaign_id === command.campaign_id &&
        after.active_grant_id === command.grant_id &&
        plan.resulting_stage === 'premium'
      : before.active === true &&
        before.active_campaign_id === command.campaign_id &&
        before.active_grant_id === command.grant_id &&
        after.active === false &&
        plan.previous_stage === 'premium';
  if (
    !statesAreValid ||
    typeof plan.changed !== 'boolean' ||
    typeof plan.idempotent !== 'boolean' ||
    !(replayIsStable || (mutationAdvances && actionTransitionIsValid))
  ) {
    throw new BetaEntitlementError(
      'beta entitlement invocation result is semantically invalid.',
    );
  }
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
    applied.result.action !== command.action ||
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

function queryByFieldCommand(collection, field, value) {
  return queryByFilterCommand(collection, {[field]: value});
}

function queryByFilterCommand(collection, filter) {
  return {
    TableName: collection,
    CommandType: 'QUERY',
    Command: JSON.stringify({find: collection, filter, limit: 2}),
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
  for (const name of Object.keys(sanitized)) {
    if (name.startsWith('SOFTBOOK_')) delete sanitized[name];
  }
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
  operatorCredentialFreeEnvironment,
  parseBetaEntitlementInvocation,
  queryCommand,
  verifyInvokedBetaEntitlement,
};
