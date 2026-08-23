#!/usr/bin/env node

import {createHash, createPrivateKey} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, dirname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  REQUIRED_COLLECTIONS,
  REQUIRED_DEPLOYMENT_NODE_VERSION,
  parseTcbJson,
} from './deployment-safety.mjs';
import {
  ReleaseDeliveryError,
  publishVerifiedRelease,
  rollbackToRetainedRelease,
  validateDeliveryProfile,
  verifyReleaseBundleDirectory,
} from './release-delivery-v1.mjs';
import {
  createCloudBaseCommandRunner,
  createCloudBaseReceiverAdapter,
} from './cloudbase-receiver-adapter.mjs';
import {validateControlledPilotProfile} from './controlled-pilot-v1.mjs';

const CLOUD_BASE_ROOT = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(CLOUD_BASE_ROOT, '../..');
const FUNCTION_NAME = 'softbook-api';
const ACCOUNT_DELETION_WORKER_NAME = 'softbook-account-deletion-worker';
const ACCOUNT_DELETION_TRIGGER_NAME = 'account-deletion-every-minute';
const ACCOUNT_DELETION_TRIGGER_CRON = '0 */1 * * * * *';
const FUNCTION_RUNTIME = 'Nodejs20.19';
const BACKEND_DEPLOYMENT_ID_PREFIX = 'backend-deployment:sha256:';
const DELIVERY_OPERATOR_PATTERN =
  /^(model|agent|service|oidc):[A-Za-z0-9][A-Za-z0-9_.@-]{2,127}$/;
const COMMANDS = new Set(['preflight', 'provision', 'deploy', 'publish', 'verify', 'rollback']);
const COMMON_SECRET_ENV_NAMES = Object.freeze([
  'SOFTBOOK_AUTH_INDEX_SECRET',
  'SOFTBOOK_AUTH_TOKEN_SECRET',
  'SOFTBOOK_CONTENT_MANIFEST_PRIVATE_KEY_PEM',
]);
const SMS_PROVIDER_ENV_NAMES = Object.freeze({
  tencentcloud: Object.freeze([
    'SOFTBOOK_SMS_TENCENT_REGION',
    'SOFTBOOK_SMS_TENCENT_SDK_APP_ID',
    'SOFTBOOK_SMS_TENCENT_SECRET_ID',
    'SOFTBOOK_SMS_TENCENT_SECRET_KEY',
    'SOFTBOOK_SMS_TENCENT_SIGN_NAME',
    'SOFTBOOK_SMS_TENCENT_TEMPLATE_ID',
    'SOFTBOOK_SMS_TENCENT_TEMPLATE_PARAMETERS',
  ]),
  webhook: Object.freeze([
    'SOFTBOOK_SMS_WEBHOOK_SECRET',
    'SOFTBOOK_SMS_WEBHOOK_URL',
  ]),
});
const USER_DATA_COLLECTIONS = Object.freeze(
  REQUIRED_COLLECTIONS.filter(
    name => name !== 'softbook_card_sources' && name !== 'softbook_card_source_versions',
  ),
);

export function parseArguments(argv) {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') {
    return {command: 'help'};
  }
  if (!COMMANDS.has(command)) {
    throw new ReleaseDeliveryError(`unknown delivery command: ${command}`);
  }

  const options = {
    apply: false,
    bundlePath: null,
    command,
    format: 'text',
    operator: null,
    profilePath: null,
    releaseId: null,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    switch (argument) {
      case '--apply':
        options.apply = true;
        break;
      case '--bundle':
        options.bundlePath = requireValue(rest, index, argument);
        index += 1;
        break;
      case '--format':
        options.format = requireValue(rest, index, argument);
        index += 1;
        break;
      case '--operator':
        options.operator = requireValue(rest, index, argument);
        index += 1;
        break;
      case '--profile':
        options.profilePath = requireValue(rest, index, argument);
        index += 1;
        break;
      case '--release':
        options.releaseId = requireValue(rest, index, argument);
        index += 1;
        break;
      case '--help':
      case '-h':
        return {command: 'help'};
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
  if (['publish', 'verify'].includes(command) && !options.bundlePath) {
    throw new ReleaseDeliveryError(`${command} requires --bundle.`);
  }
  if (command === 'rollback' && !options.releaseId) {
    throw new ReleaseDeliveryError('rollback requires --release.');
  }
  if (['preflight', 'verify'].includes(command) && options.apply) {
    throw new ReleaseDeliveryError(`${command} is read-only and rejects --apply.`);
  }
  if ((options.apply || command === 'verify') && !options.operator) {
    throw new ReleaseDeliveryError(`${command} requires --operator for an auditable report.`);
  }
  if (options.operator) requireDeliveryOperator(options.operator);
  return options;
}

export async function executeDeliveryCommand(options, dependencies = {}) {
  const clock = dependencies.clock ?? (() => new Date());
  const startedAt = readExecutionTimestamp(clock, 'delivery start');
  const operator =
    options.apply || options.command === 'verify'
      ? requireDeliveryOperator(options.operator)
      : options.operator
        ? requireDeliveryOperator(options.operator)
        : null;
  const completeReport = report => ({
    ...report,
    execution: {
      completed_at: readExecutionTimestamp(clock, 'delivery completion'),
      operator,
      started_at: startedAt,
    },
  });
  const env = dependencies.env ?? process.env;
  const profile = validateDeliveryProfile(readJson(options.profilePath));
  const runner = dependencies.runner ?? createCloudBaseCommandRunner({cwd: REPOSITORY_ROOT});
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
    schema_version: 'receiver-delivery-report.v2',
    operation: options.command,
    applied: options.apply,
    backend_deployment_id: backendDeploymentId,
    profile: publicProfile(profile),
    preflight,
    receiver_secrets: secretInspection.public,
    write_safety: writeSafety,
  };

  if (options.command === 'preflight') {
    return completeReport({
      ...base,
      status: preflight.ok && secretInspection.ok && writeSafety.ok ? 'passed' : 'blocked',
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
    const provisioned = await provisionCollections({
      profile,
      runner,
      preflight,
    });
    return completeReport({...base, provisioned, status: 'passed', writes_performed: true});
  }

  if (options.command === 'deploy') {
    if (!options.apply) {
      return completeReport({
        ...base,
        deployment_plan: {
          deletion_worker_trigger: ACCOUNT_DELETION_TRIGGER_NAME,
          function_name: FUNCTION_NAME,
          function_names: [FUNCTION_NAME, ACCOUNT_DELETION_WORKER_NAME],
          runtime: FUNCTION_RUNTIME,
          api_path: new URL(profile.api_base_url).pathname,
          fixed_sms_code_present: false,
        },
        status: 'planned',
        writes_performed: false,
      });
    }
    requireApplyReady({preflight, secretInspection, writeSafety});
    if (!preflight.catalog.required_collections_present) {
      throw new ReleaseDeliveryError('deploy requires the complete collection catalog.');
    }
    const deployed = await deployReceiverFunction({
      backendDeploymentId,
      env,
      processRunner,
      profile,
      runner,
    });
    return completeReport({...base, deployed, status: 'passed', writes_performed: true});
  }

  const adapter = createCloudBaseReceiverAdapter({profile, runner});

  if (options.command === 'publish') {
    const verified = verifyReleaseBundleDirectory({
      bundlePath: options.bundlePath,
      profilePath: options.profilePath,
    });
    if (!options.apply) {
      return completeReport({
        ...base,
        release: publicVerifiedBundle(verified),
        status: 'planned',
        writes_performed: false,
      });
    }
    requireApplyReady({preflight, secretInspection, writeSafety});
    if (!preflight.catalog.required_collections_present) {
      throw new ReleaseDeliveryError('publish requires the complete collection catalog.');
    }
    const published = await publishVerifiedRelease(verified, adapter);
    return completeReport({...base, published, status: 'passed', writes_performed: true});
  }

  if (options.command === 'verify') {
    const verified = verifyReleaseBundleDirectory({
      bundlePath: options.bundlePath,
      profilePath: options.profilePath,
    });
    const active = await adapter.verifyActiveRelease({
      contentVersion: verified.bundle.content.content_version,
      releaseId: verified.bundle.release_id,
      track: verified.bundle.track,
    });
    const dataCounts = await readUserDataCounts({profile, runner});
    const endpoint = await verifyApiRoute(
      profile.api_base_url,
      dependencies.fetchImpl ?? globalThis.fetch,
    );
    const backendDeployment = await inspectApiFunction({
      envId: profile.environment_id,
      expectedDeploymentId: backendDeploymentId,
      profile,
      runner,
    });
    const rollbackTarget = verified.bundle.parent_release_id
      ? await adapter.verifyRetainedRelease(verified.bundle.parent_release_id)
      : null;
    return completeReport({
      ...base,
      active_release: {
        content_version: active.content_version,
        release_id: active.release.release_id,
      },
      api_route: endpoint,
      backend_deployment: backendDeployment.public,
      release: publicVerifiedBundle(verified),
      rollback_target: publicRetainedRollbackTarget(rollbackTarget),
      status:
        preflight.catalog.required_collections_present &&
        backendDeployment.ok &&
        dataCounts.total === 0 &&
        endpoint.ok
          ? 'passed'
          : 'blocked',
      user_data_import_check: dataCounts,
      writes_performed: false,
    });
  }

  if (!options.apply) {
    return completeReport({
      ...base,
      rollback_plan: {release_id: options.releaseId},
      status: 'planned',
      writes_performed: false,
    });
  }
  requireApplyReady({preflight, secretInspection, writeSafety});
  const rollback = await rollbackToRetainedRelease(options.releaseId, adapter);
  return completeReport({...base, rollback, status: 'passed', writes_performed: true});
}

export async function inspectReceiver({profile, runner}) {
  const environmentPayload = parseTcbJson(
    await runner.run(['env', 'detail', '-e', profile.environment_id, '--json', '--yes'], {
      label: 'read receiver environment',
    }),
  );
  const data = environmentPayload?.data;
  const database = Array.isArray(data?.resources?.databases) ? data.resources.databases[0] : null;
  const errors = [];
  if (data?.envId !== profile.environment_id) errors.push('environment ID mismatch');
  if (data?.region !== profile.region) errors.push('environment region mismatch');
  if (data?.status !== 'NORMAL') errors.push('environment is not NORMAL');
  if (database?.Status !== 'RUNNING') errors.push('database is not RUNNING');
  if (!/^tnt-[a-z0-9]+$/.test(database?.InstanceId ?? '')) {
    errors.push('database instance ID is invalid');
  }
  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      environment: {
        env_id: data?.envId ?? null,
        region: data?.region ?? null,
        status: data?.status ?? null,
      },
      catalog: emptyCatalog(),
    };
  }
  const catalog = await readCatalog({
    databaseInstanceId: database.InstanceId,
    profile,
    runner,
  });
  return {
    ok: catalog.ok,
    errors: catalog.errors,
    environment: {
      database_status: database.Status,
      env_id: data.envId,
      region: data.region,
      status: data.status,
    },
    database_instance_id: database.InstanceId,
    catalog,
  };
}

async function readCatalog({databaseInstanceId, profile, runner}) {
  const payload = parseTcbJson(
    await runner.run(buildDescribeTablesArguments(profile.environment_id, databaseInstanceId), {
      label: 'read receiver collection catalog',
    }),
  );
  const tables = payload?.data?.Tables === null ? [] : payload?.data?.Tables;
  const total = payload?.data?.Pager?.Total;
  if (!Array.isArray(tables) || total !== tables.length) {
    throw new ReleaseDeliveryError('receiver collection catalog is incomplete.');
  }
  const names = tables.map(table => table?.TableName);
  if (names.some(name => typeof name !== 'string') || new Set(names).size !== names.length) {
    throw new ReleaseDeliveryError('receiver collection catalog is invalid.');
  }
  const missing = REQUIRED_COLLECTIONS.filter(name => !names.includes(name));
  return {
    collection_names: [...names].sort(),
    errors: [],
    missing_required_collections: missing,
    ok: true,
    required_collections_present: missing.length === 0,
  };
}

export async function provisionCollections({profile, runner, preflight}) {
  const created = [];
  for (const collection of preflight.catalog.missing_required_collections) {
    if (!REQUIRED_COLLECTIONS.includes(collection)) {
      throw new ReleaseDeliveryError(`collection is not allowlisted: ${collection}`);
    }
    try {
      await runner.run(
        buildCreateTableArguments(
          profile.environment_id,
          preflight.database_instance_id,
          collection,
        ),
        {label: `create ${collection}`},
      );
    } catch (error) {
      const current = await readCatalog({
        databaseInstanceId: preflight.database_instance_id,
        profile,
        runner,
      });
      if (!current.collection_names.includes(collection)) throw error;
    }
    created.push(collection);
  }
  const catalog = await waitForCompleteCatalog({
    databaseInstanceId: preflight.database_instance_id,
    profile,
    runner,
  });
  if (!catalog.required_collections_present) {
    throw new ReleaseDeliveryError('receiver provisioning verification failed.');
  }
  return {created, required_collection_count: REQUIRED_COLLECTIONS.length};
}

async function waitForCompleteCatalog(input) {
  let catalog;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    catalog = await readCatalog(input);
    if (catalog.required_collections_present) return catalog;
    if (attempt < 14) {
      await new Promise(resolveDelay => setTimeout(resolveDelay, 1000));
    }
  }
  return catalog;
}

export async function deployReceiverFunction({
  backendDeploymentId,
  description = 'Softbook CET receiver-owned closed beta runtime',
  env,
  processRunner,
  profile,
  runner,
  runtimeMode = 'production',
}) {
  requireBackendDeploymentId(backendDeploymentId);
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'softbook-receiver-deploy-'));
  const artifactDirectory = join(temporaryDirectory, 'function');
  const configPath = join(temporaryDirectory, 'cloudbaserc.json');
  const validationWorkspace = join(temporaryDirectory, 'validation-workspace');
  const validationCloudBaseRoot = join(validationWorkspace, 'infra', 'cloudbase');
  const validationFunctionRoot = join(validationCloudBaseRoot, 'functions', FUNCTION_NAME);

  try {
    cpSync(CLOUD_BASE_ROOT, validationCloudBaseRoot, {
      filter: path => !path.split(sep).includes('node_modules'),
      recursive: true,
    });
    mkdirSync(join(validationWorkspace, 'spec'), {recursive: true});
    cpSync(
      join(REPOSITORY_ROOT, 'spec', 'box-catalog.json'),
      join(validationWorkspace, 'spec', 'box-catalog.json'),
    );
    await processRunner.run('npm', ['ci', '--ignore-scripts'], {
      cwd: validationFunctionRoot,
      label: 'install receiver function dependencies',
      timeoutMs: 10 * 60_000,
    });
    await processRunner.run('npm', ['test'], {
      cwd: validationFunctionRoot,
      label: 'test receiver function artifact',
      timeoutMs: 10 * 60_000,
    });
    cpSync(validationFunctionRoot, artifactDirectory, {
      filter: path => !path.split(sep).includes('test'),
      recursive: true,
    });
    const runtime = buildReceiverRuntimeEnvironment(profile, env, {
      backendDeploymentId,
      runtimeMode,
    });
    const functions = [
      {
        description,
        envVariables: runtime,
        handler: 'index.main',
        installDependency: false,
        memorySize: 256,
        name: FUNCTION_NAME,
        runtime: FUNCTION_RUNTIME,
        timeout: 10,
      },
      {
        description: 'Softbook CET account deletion worker',
        envVariables: {},
        handler: 'index.accountDeletionWorkerMain',
        installDependency: false,
        memorySize: 256,
        name: ACCOUNT_DELETION_WORKER_NAME,
        runtime: FUNCTION_RUNTIME,
        timeout: 60,
        triggers: [
          {
            config: ACCOUNT_DELETION_TRIGGER_CRON,
            name: ACCOUNT_DELETION_TRIGGER_NAME,
            type: 'timer',
          },
        ],
      },
    ];
    writeFileSync(
      configPath,
      `${JSON.stringify(
        {
          $schema: 'https://static.cloudbase.net/cli/cloudbaserc.schema.json',
          envId: profile.environment_id,
          functions,
        },
        null,
        2,
      )}\n`,
      {encoding: 'utf8', mode: 0o600},
    );
    chmodSync(configPath, 0o600);
    await runner.run(
      [
        '-e',
        profile.environment_id,
        'fn',
        'deploy',
        FUNCTION_NAME,
        '--force',
        '--dir',
        artifactDirectory,
        '--path',
        new URL(profile.api_base_url).pathname,
        '--runtime',
        FUNCTION_RUNTIME,
        '--json',
      ],
      {
        cwd: temporaryDirectory,
        label: 'deploy receiver function',
        timeoutMs: 10 * 60_000,
      },
    );
    await runner.run(
      [
        '-e',
        profile.environment_id,
        'fn',
        'deploy',
        ACCOUNT_DELETION_WORKER_NAME,
        '--force',
        '--dir',
        artifactDirectory,
        '--runtime',
        FUNCTION_RUNTIME,
        '--json',
      ],
      {
        cwd: temporaryDirectory,
        label: 'deploy account deletion worker',
        timeoutMs: 10 * 60_000,
      },
    );
    const deletionWorker = await ensureAccountDeletionWorker({
      cwd: temporaryDirectory,
      envId: profile.environment_id,
      runner,
    });
    const apiFunction = await inspectApiFunction({
      envId: profile.environment_id,
      expectedDeploymentId: backendDeploymentId,
      profile,
      runner,
    });
    if (!apiFunction.ok) {
      throw new ReleaseDeliveryError(
        `receiver API function verification failed: ${apiFunction.errors.join('; ')}`,
      );
    }
    return {
      api_function: apiFunction.public,
      backend_deployment_id: backendDeploymentId,
      deletion_worker: deletionWorker,
      deletion_worker_runtime_variable_names: [],
      deletion_worker_trigger: ACCOUNT_DELETION_TRIGGER_NAME,
      fixed_sms_code_present: false,
      function_name: FUNCTION_NAME,
      function_names: functions.map(item => item.name),
      runtime: FUNCTION_RUNTIME,
      runtime_variable_names: Object.keys(runtime).sort(),
    };
  } finally {
    rmSync(temporaryDirectory, {force: true, recursive: true});
  }
}

async function ensureAccountDeletionWorker({cwd, envId, runner}) {
  let inspection = await inspectAccountDeletionWorker({envId, runner});
  if (inspection.trigger_status === 'missing') {
    if (inspection.errors.length > 0) {
      throw new ReleaseDeliveryError(
        `account deletion worker verification failed before trigger creation: ${inspection.errors.join('; ')}`,
      );
    }
    await runner.run(
      [
        '-e',
        envId,
        'fn',
        'trigger',
        'create',
        ACCOUNT_DELETION_WORKER_NAME,
        '--trigger-name',
        ACCOUNT_DELETION_TRIGGER_NAME,
        '--cron',
        ACCOUNT_DELETION_TRIGGER_CRON,
        '--json',
      ],
      {
        cwd,
        label: 'create account deletion timer trigger',
        timeoutMs: 120_000,
      },
    );
    inspection = await inspectAccountDeletionWorker({envId, runner});
  }
  if (!inspection.ok) {
    throw new ReleaseDeliveryError(
      `account deletion worker verification failed: ${inspection.errors.join('; ')}`,
    );
  }
  return inspection.public;
}

export async function inspectAccountDeletionWorker({envId, runner}) {
  const payload = parseTcbJson(
    await runner.run(
      [
        '-e',
        envId,
        'fn',
        'detail',
        ACCOUNT_DELETION_WORKER_NAME,
        '--json',
      ],
      {label: 'inspect account deletion worker'},
    ),
  );
  const data = payload?.data ?? payload;
  const errors = [];
  if (data?.FunctionName !== ACCOUNT_DELETION_WORKER_NAME) {
    errors.push('function name mismatch');
  }
  if (data?.Handler !== 'index.accountDeletionWorkerMain') {
    errors.push('handler mismatch');
  }
  if (data?.Runtime !== FUNCTION_RUNTIME) {
    errors.push('runtime mismatch');
  }
  if (Number(data?.Timeout) !== 60) {
    errors.push('timeout mismatch');
  }
  const variables = data?.Environment?.Variables;
  if (!Array.isArray(variables)) {
    errors.push('environment variables are unavailable');
  }
  const variableNames = Array.isArray(variables)
    ? variables
        .map(variable => variable?.Key)
        .filter(name => typeof name === 'string')
        .sort()
    : [];
  if (variableNames.length > 0) {
    errors.push('worker must not receive API runtime secrets or variables');
  }
  const triggers = Array.isArray(data?.Triggers) ? data.Triggers : [];
  const normalizedTriggers = triggers.map(trigger => ({
    config: normalizeAccountDeletionTriggerConfig(
      trigger?.TriggerDesc ??
      trigger?.TriggerConfig ??
      trigger?.config ??
      trigger?.cron ??
      null,
    ),
    name:
      trigger?.TriggerName ??
      trigger?.triggerName ??
      trigger?.name ??
      null,
    type: String(trigger?.Type ?? trigger?.type ?? '').toLowerCase(),
  }));
  const exactTrigger = normalizedTriggers.find(
    trigger => trigger.name === ACCOUNT_DELETION_TRIGGER_NAME,
  );
  if (triggers.length === 0) {
    return {
      errors,
      ok: false,
      public: {
        function_name: data?.FunctionName ?? null,
        handler: data?.Handler ?? null,
        runtime: data?.Runtime ?? null,
        timeout: Number.isFinite(Number(data?.Timeout))
          ? Number(data.Timeout)
          : null,
        trigger: null,
        variable_names: variableNames,
      },
      trigger_status: 'missing',
    };
  }
  if (
    triggers.length !== 1 ||
    !exactTrigger ||
    !['timer', 'timetrigger'].includes(exactTrigger.type) ||
    exactTrigger.config !== ACCOUNT_DELETION_TRIGGER_CRON
  ) {
    errors.push('timer trigger mismatch');
  }
  return {
    errors,
    ok: errors.length === 0,
    public: {
      function_name: data?.FunctionName ?? null,
      handler: data?.Handler ?? null,
      runtime: data?.Runtime ?? null,
      timeout: Number.isFinite(Number(data?.Timeout))
        ? Number(data.Timeout)
        : null,
      trigger: exactTrigger ?? null,
      variable_names: variableNames,
    },
    trigger_status: exactTrigger ? 'present' : 'invalid',
  };
}

function normalizeAccountDeletionTriggerConfig(value) {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed?.cron === 'string' ? parsed.cron : value;
  } catch {
    return value;
  }
}

export function buildReceiverRuntimeEnvironment(
  profile,
  env,
  {backendDeploymentId, runtimeMode = 'production'} = {},
) {
  if (runtimeMode !== 'production' && runtimeMode !== 'controlled_pilot') {
    throw new ReleaseDeliveryError('receiver runtime mode is invalid.');
  }
  requireBackendDeploymentId(backendDeploymentId);
  const inspection = inspectReceiverSecrets(profile, env);
  if (!inspection.ok) {
    throw new ReleaseDeliveryError(inspection.errors.join('; '));
  }
  const runtime = {
    SOFTBOOK_BACKEND_DEPLOYMENT_ID: backendDeploymentId,
    SOFTBOOK_AUTH_INDEX_SECRET: env.SOFTBOOK_AUTH_INDEX_SECRET,
    SOFTBOOK_AUTH_TOKEN_SECRET: env.SOFTBOOK_AUTH_TOKEN_SECRET,
    SOFTBOOK_CONTENT_MANIFEST_KEY_ID: profile.signing_key_id,
    SOFTBOOK_CONTENT_MANIFEST_PRIVATE_KEY_PEM: env.SOFTBOOK_CONTENT_MANIFEST_PRIVATE_KEY_PEM,
    SOFTBOOK_LEARNING_EVENTS_BATCH_LIMIT: '9',
    SOFTBOOK_LEARNING_EVENTS_FUTURE_SKEW_SECONDS: '300',
    SOFTBOOK_LEARNING_EVENTS_RETENTION_DAYS: '90',
    SOFTBOOK_RUNTIME_MODE: runtimeMode,
    SOFTBOOK_SMS_PROVIDER: inspection.provider,
    SOFTBOOK_STORE_MODE: 'cloudbase',
  };
  if (runtimeMode === 'controlled_pilot') {
    runtime.SOFTBOOK_PILOT_ID = profile.pilot_id;
    runtime.SOFTBOOK_PILOT_EXPIRES_AT = new Date(
      profile.pilot_expires_at,
    ).toISOString();
    runtime.SOFTBOOK_PILOT_OPERATOR_SECRET = env.SOFTBOOK_PILOT_OPERATOR_SECRET;
  }
  if (inspection.provider === 'webhook') {
    return {
      ...runtime,
      SOFTBOOK_SMS_WEBHOOK_SECRET: env.SOFTBOOK_SMS_WEBHOOK_SECRET,
      SOFTBOOK_SMS_WEBHOOK_TIMEOUT_MS: env.SOFTBOOK_SMS_WEBHOOK_TIMEOUT_MS || '5000',
      SOFTBOOK_SMS_WEBHOOK_URL: env.SOFTBOOK_SMS_WEBHOOK_URL,
    };
  }
  return {
    ...runtime,
    SOFTBOOK_SMS_TENCENT_REGION: env.SOFTBOOK_SMS_TENCENT_REGION,
    SOFTBOOK_SMS_TENCENT_SDK_APP_ID: env.SOFTBOOK_SMS_TENCENT_SDK_APP_ID,
    SOFTBOOK_SMS_TENCENT_SECRET_ID: env.SOFTBOOK_SMS_TENCENT_SECRET_ID,
    SOFTBOOK_SMS_TENCENT_SECRET_KEY: env.SOFTBOOK_SMS_TENCENT_SECRET_KEY,
    SOFTBOOK_SMS_TENCENT_SIGN_NAME: env.SOFTBOOK_SMS_TENCENT_SIGN_NAME,
    SOFTBOOK_SMS_TENCENT_TEMPLATE_ID: env.SOFTBOOK_SMS_TENCENT_TEMPLATE_ID,
    SOFTBOOK_SMS_TENCENT_TEMPLATE_PARAMETERS:
      env.SOFTBOOK_SMS_TENCENT_TEMPLATE_PARAMETERS,
    SOFTBOOK_SMS_TENCENT_TIMEOUT_MS: env.SOFTBOOK_SMS_TENCENT_TIMEOUT_MS || '5000',
  };
}

export function buildBackendDeploymentId({profile, repositoryCommit} = {}) {
  if (!/^[0-9a-f]{40}$/.test(repositoryCommit ?? '')) {
    throw new ReleaseDeliveryError('repository commit must be a full lowercase SHA-1.');
  }
  const normalizedProfile =
    profile?.schema_version === 'controlled-pilot-profile.v1'
      ? validateControlledPilotProfile(profile)
      : validateDeliveryProfile(profile);
  const identity = JSON.stringify({
    functions: [
      {
        handler: 'index.main',
        name: FUNCTION_NAME,
        runtime: FUNCTION_RUNTIME,
        timeout: 10,
      },
      {
        handler: 'index.accountDeletionWorkerMain',
        name: ACCOUNT_DELETION_WORKER_NAME,
        runtime: FUNCTION_RUNTIME,
        timeout: 60,
        trigger: ACCOUNT_DELETION_TRIGGER_CRON,
      },
    ],
    profile: normalizedProfile,
    repository_commit: repositoryCommit,
    runtime: FUNCTION_RUNTIME,
    schema_version: 'backend-deployment-identity.v1',
  });
  return `${BACKEND_DEPLOYMENT_ID_PREFIX}${createHash('sha256')
    .update(identity)
    .digest('hex')}`;
}

export async function inspectApiFunction({
  envId,
  expectedDeploymentId,
  profile,
  runner,
}) {
  requireBackendDeploymentId(expectedDeploymentId);
  const payload = parseTcbJson(
    await runner.run(
      ['-e', envId, 'fn', 'detail', FUNCTION_NAME, '--json'],
      {label: 'inspect receiver API function'},
    ),
  );
  const data = payload?.data ?? payload;
  const errors = [];
  if (data?.FunctionName !== FUNCTION_NAME) errors.push('function name mismatch');
  if (data?.Handler !== 'index.main') errors.push('handler mismatch');
  if (data?.Runtime !== FUNCTION_RUNTIME) errors.push('runtime mismatch');
  if (Number(data?.Timeout) !== 10) errors.push('timeout mismatch');
  const variables = data?.Environment?.Variables;
  if (!Array.isArray(variables)) errors.push('environment variables are unavailable');
  const entries = Array.isArray(variables)
    ? variables.filter(
        variable =>
          typeof variable?.Key === 'string' && typeof variable?.Value === 'string',
      )
    : [];
  const variableNames = entries.map(variable => variable.Key).sort();
  if (new Set(variableNames).size !== variableNames.length) {
    errors.push('environment variables contain duplicate names');
  }
  const values = new Map(entries.map(variable => [variable.Key, variable.Value]));
  const deploymentValues = entries
    .filter(variable => variable.Key === 'SOFTBOOK_BACKEND_DEPLOYMENT_ID')
    .map(variable => variable.Value);
  if (
    deploymentValues.length !== 1 ||
    deploymentValues[0] !== expectedDeploymentId
  ) {
    errors.push('backend deployment ID mismatch');
  }
  if (variableNames.includes('SOFTBOOK_SMS_DEV_CODE')) {
    errors.push('fixed SMS code must not be deployed');
  }
  const expectedRuntimeMode =
    profile?.schema_version === 'controlled-pilot-profile.v1'
      ? 'controlled_pilot'
      : 'production';
  if (values.get('SOFTBOOK_CONTENT_MANIFEST_KEY_ID') !== profile?.signing_key_id) {
    errors.push('content manifest signing key ID mismatch');
  }
  if (values.get('SOFTBOOK_RUNTIME_MODE') !== expectedRuntimeMode) {
    errors.push('runtime mode mismatch');
  }
  if (values.get('SOFTBOOK_STORE_MODE') !== 'cloudbase') {
    errors.push('store mode mismatch');
  }
  if (!['webhook', 'tencentcloud'].includes(values.get('SOFTBOOK_SMS_PROVIDER'))) {
    errors.push('SMS provider mismatch');
  }
  return {
    errors,
    ok: errors.length === 0,
    public: {
      backend_deployment_id:
        deploymentValues.length === 1 ? deploymentValues[0] : null,
      function_name: data?.FunctionName ?? null,
      handler: data?.Handler ?? null,
      runtime: data?.Runtime ?? null,
      runtime_mode: values.get('SOFTBOOK_RUNTIME_MODE') ?? null,
      signing_key_id:
        values.get('SOFTBOOK_CONTENT_MANIFEST_KEY_ID') ?? null,
      sms_provider: values.get('SOFTBOOK_SMS_PROVIDER') ?? null,
      store_mode: values.get('SOFTBOOK_STORE_MODE') ?? null,
      timeout: Number.isFinite(Number(data?.Timeout))
        ? Number(data.Timeout)
        : null,
      variable_names: variableNames,
    },
  };
}

function requireBackendDeploymentId(value) {
  if (!/^backend-deployment:sha256:[0-9a-f]{64}$/.test(value ?? '')) {
    throw new ReleaseDeliveryError('backend deployment ID is invalid.');
  }
  return value;
}

export function inspectReceiverSecrets(profile, env) {
  const errors = [];
  const provider = env.SOFTBOOK_SMS_PROVIDER;
  if (!Object.hasOwn(SMS_PROVIDER_ENV_NAMES, provider)) {
    errors.push('SOFTBOOK_SMS_PROVIDER must be webhook or tencentcloud');
  }
  const requiredNames = [
    ...COMMON_SECRET_ENV_NAMES,
    'SOFTBOOK_SMS_PROVIDER',
    ...(SMS_PROVIDER_ENV_NAMES[provider] ?? []),
  ];
  if (profile.schema_version === 'controlled-pilot-profile.v1') {
    requiredNames.push('SOFTBOOK_PILOT_OPERATOR_SECRET');
  }
  for (const name of requiredNames) {
    if (typeof env[name] !== 'string' || env[name].length === 0) {
      errors.push(`${name} is missing`);
    }
  }
  const strongSecretNames = ['SOFTBOOK_AUTH_INDEX_SECRET', 'SOFTBOOK_AUTH_TOKEN_SECRET'];
  if (profile.schema_version === 'controlled-pilot-profile.v1') {
    strongSecretNames.push('SOFTBOOK_PILOT_OPERATOR_SECRET');
  }
  if (provider === 'webhook') strongSecretNames.push('SOFTBOOK_SMS_WEBHOOK_SECRET');
  if (provider === 'tencentcloud') strongSecretNames.push('SOFTBOOK_SMS_TENCENT_SECRET_KEY');
  for (const name of strongSecretNames) {
    if (env[name] && !isStrongSecret(env[name])) {
      errors.push(`${name} fails the 32-character diversity policy`);
    }
  }
  if (
    env.SOFTBOOK_AUTH_INDEX_SECRET &&
    env.SOFTBOOK_AUTH_INDEX_SECRET === env.SOFTBOOK_AUTH_TOKEN_SECRET
  ) {
    errors.push('auth index and token secrets must be distinct');
  }
  if (
    profile.schema_version === 'controlled-pilot-profile.v1' &&
    [env.SOFTBOOK_AUTH_INDEX_SECRET, env.SOFTBOOK_AUTH_TOKEN_SECRET].includes(
      env.SOFTBOOK_PILOT_OPERATOR_SECRET,
    )
  ) {
    errors.push('pilot operator secret must be distinct from auth secrets');
  }
  if (provider === 'webhook' && env.SOFTBOOK_SMS_WEBHOOK_URL) {
    try {
      const url = new URL(env.SOFTBOOK_SMS_WEBHOOK_URL);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname === '/'
      ) {
        throw new Error('unsafe');
      }
    } catch {
      errors.push('SOFTBOOK_SMS_WEBHOOK_URL must be credential-free HTTPS with a path');
    }
  }
  if (
    provider === 'webhook' &&
    env.SOFTBOOK_SMS_WEBHOOK_TIMEOUT_MS &&
    !isTimeoutMilliseconds(env.SOFTBOOK_SMS_WEBHOOK_TIMEOUT_MS)
  ) {
    errors.push('SOFTBOOK_SMS_WEBHOOK_TIMEOUT_MS must be an integer from 1 to 15000');
  }
  if (provider === 'tencentcloud') {
    if (!/^AKID[A-Za-z0-9]{12,124}$/.test(env.SOFTBOOK_SMS_TENCENT_SECRET_ID || '')) {
      errors.push('SOFTBOOK_SMS_TENCENT_SECRET_ID is invalid');
    }
    if (!/^ap-[a-z]+(?:-[0-9]+)?$/.test(env.SOFTBOOK_SMS_TENCENT_REGION || '')) {
      errors.push('SOFTBOOK_SMS_TENCENT_REGION is invalid');
    }
    if (!/^\d{10,20}$/.test(env.SOFTBOOK_SMS_TENCENT_SDK_APP_ID || '')) {
      errors.push('SOFTBOOK_SMS_TENCENT_SDK_APP_ID is invalid');
    }
    if (!/^\d{1,20}$/.test(env.SOFTBOOK_SMS_TENCENT_TEMPLATE_ID || '')) {
      errors.push('SOFTBOOK_SMS_TENCENT_TEMPLATE_ID is invalid');
    }
    if (!isVisibleText(env.SOFTBOOK_SMS_TENCENT_SIGN_NAME, 64)) {
      errors.push('SOFTBOOK_SMS_TENCENT_SIGN_NAME is invalid');
    }
    if (!isTencentTemplateParameterList(env.SOFTBOOK_SMS_TENCENT_TEMPLATE_PARAMETERS)) {
      errors.push('SOFTBOOK_SMS_TENCENT_TEMPLATE_PARAMETERS is invalid');
    }
    if (
      env.SOFTBOOK_SMS_TENCENT_TIMEOUT_MS &&
      !isTimeoutMilliseconds(env.SOFTBOOK_SMS_TENCENT_TIMEOUT_MS)
    ) {
      errors.push('SOFTBOOK_SMS_TENCENT_TIMEOUT_MS must be an integer from 1 to 15000');
    }
  }
  if (env.SOFTBOOK_CONTENT_MANIFEST_PRIVATE_KEY_PEM) {
    try {
      const key = createPrivateKey(env.SOFTBOOK_CONTENT_MANIFEST_PRIVATE_KEY_PEM);
      if (key.asymmetricKeyType !== 'ed25519') throw new Error('wrong key type');
    } catch {
      errors.push('content manifest private key must be valid Ed25519');
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    provider,
    public: {
      configured_names: requiredNames.filter(
        name => typeof env[name] === 'string' && env[name].length > 0,
      ),
      errors,
      ok: errors.length === 0,
      signing_key_id: profile.signing_key_id,
    },
  };
}

function isVisibleText(value, maximumLength) {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= maximumLength &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function isTencentTemplateParameterList(value) {
  return value === 'code' || value === 'code,expiry_minutes';
}

function isTimeoutMilliseconds(value) {
  return /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 15000;
}

export function inspectWriteSafety({nodeVersion, repository}) {
  const errors = [];
  if (nodeVersion !== REQUIRED_DEPLOYMENT_NODE_VERSION) {
    errors.push(`Node must be ${REQUIRED_DEPLOYMENT_NODE_VERSION}; received ${nodeVersion}`);
  }
  if (repository.branch !== 'main') errors.push('writes require branch main');
  if (repository.dirty) errors.push('writes require a clean worktree');
  if (repository.head !== repository.originMain) {
    errors.push('writes require HEAD exactly equal to origin/main');
  }
  return {errors, ok: errors.length === 0, ...repository};
}

export function publicRetainedRollbackTarget(retained) {
  if (retained === null) return null;
  if (
    !retained ||
    retained.verified !== true ||
    typeof retained.release_id !== 'string' ||
    retained.card_source?.release?.release_id !== retained.release_id ||
    !/^sha256:[0-9a-f]{64}$/.test(retained.card_source?.content_version ?? '')
  ) {
    throw new ReleaseDeliveryError('retained rollback target is invalid.');
  }
  return {
    content_version: retained.card_source.content_version,
    release_id: retained.release_id,
    retention_status: 'retained',
    verified: true,
  };
}

export function requireDeliveryOperator(value) {
  if (!DELIVERY_OPERATOR_PATTERN.test(value ?? '')) {
    throw new ReleaseDeliveryError(
      'delivery operator must identify a model, agent, service, or oidc machine principal.',
    );
  }
  return value;
}

function readExecutionTimestamp(clock, label) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new ReleaseDeliveryError(`${label} clock is invalid.`);
  }
  return date.toISOString();
}

export function requireApplyReady({preflight, secretInspection, writeSafety}) {
  const errors = [...preflight.errors, ...secretInspection.errors, ...writeSafety.errors];
  if (errors.length > 0) throw new ReleaseDeliveryError(errors.join('; '));
}

export async function readUserDataCounts({profile, runner}) {
  const commands = USER_DATA_COLLECTIONS.map(collection => ({
    TableName: collection,
    CommandType: 'COMMAND',
    Command: JSON.stringify({count: collection, query: {}}),
  }));
  const payload = parseTcbJson(
    await runner.run(
      [
        'db',
        'nosql',
        'execute',
        '-e',
        profile.environment_id,
        '--command',
        JSON.stringify(commands),
        '--json',
      ],
      {label: 'verify receiver user-data baseline'},
    ),
  );
  const results = payload?.data?.results;
  if (!Array.isArray(results) || results.length !== commands.length) {
    throw new ReleaseDeliveryError('receiver user-data counts are invalid.');
  }
  const counts = {};
  results.forEach((result, index) => {
    const value = Array.isArray(result) ? result[0] : null;
    const count = Number(value?.n);
    if (Number(value?.ok) !== 1 || !Number.isSafeInteger(count) || count < 0) {
      throw new ReleaseDeliveryError(`receiver count failed for ${USER_DATA_COLLECTIONS[index]}.`);
    }
    counts[USER_DATA_COLLECTIONS[index]] = count;
  });
  return {
    counts,
    imported_user_data_detected: Object.values(counts).some(count => count > 0),
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
  };
}

export async function verifyApiRoute(baseUrl, fetchImpl) {
  if (typeof fetchImpl !== 'function') {
    return {ok: false, reason: 'fetch unavailable'};
  }
  try {
    const response = await fetchImpl(`${baseUrl}/v2/unknown`, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json();
    return {
      ok: response.status === 404 && body?.error?.code === 'not_found',
      status: response.status,
    };
  } catch {
    return {ok: false, reason: 'route unavailable'};
  }
}

function buildDescribeTablesArguments(envId, databaseInstanceId) {
  requireDatabaseInstanceId(databaseInstanceId);
  return [
    '-e',
    envId,
    'api',
    'tcb',
    'DescribeTables',
    '--api-version',
    '2018-06-08',
    '--body',
    JSON.stringify({MgoLimit: 100, MgoOffset: 0, Tag: databaseInstanceId}),
    '--json',
  ];
}

function buildCreateTableArguments(envId, databaseInstanceId, tableName) {
  requireDatabaseInstanceId(databaseInstanceId);
  if (!REQUIRED_COLLECTIONS.includes(tableName)) {
    throw new ReleaseDeliveryError(`collection is not allowlisted: ${tableName}`);
  }
  return [
    '-e',
    envId,
    'api',
    'tcb',
    'CreateTable',
    '--api-version',
    '2018-06-08',
    '--body',
    JSON.stringify({TableName: tableName, Tag: databaseInstanceId}),
    '--json',
  ];
}

function requireDatabaseInstanceId(value) {
  if (!/^tnt-[a-z0-9]+$/.test(value ?? '')) {
    throw new ReleaseDeliveryError('receiver database instance ID is invalid.');
  }
}

export function createProcessRunner({spawn = spawnSync} = {}) {
  return {
    async run(command, args, options = {}) {
      const result = spawn(command, args, {
        cwd: options.cwd ?? REPOSITORY_ROOT,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        timeout: options.timeoutMs ?? 120_000,
      });
      if (result.error || result.status !== 0) {
        throw new ReleaseDeliveryError(
          `${options.label ?? command} failed without exposing command output.`,
        );
      }
      return result.stdout;
    },
  };
}

export function readRepositoryState() {
  const run = args => {
    const result = spawnSync('git', args, {
      cwd: REPOSITORY_ROOT,
      encoding: 'utf8',
    });
    if (result.error || result.status !== 0) {
      throw new ReleaseDeliveryError(`git ${args[0]} failed.`);
    }
    return result.stdout.trim();
  };
  return {
    branch: run(['branch', '--show-current']),
    dirty: run(['status', '--porcelain=v1', '--untracked-files=all']) !== '',
    head: run(['rev-parse', 'HEAD']),
    originMain: run(['rev-parse', 'origin/main']),
  };
}

function publicProfile(profile) {
  return {
    environment_id: profile.environment_id,
    profile_id: profile.profile_id,
    region: profile.region,
  };
}

function publicVerifiedBundle(verified) {
  return {
    audio_asset_count: verified.audio_manifest.assets.length,
    bundle_id: verified.bundle.bundle_id,
    bundle_sha256: verified.bundle_sha256,
    card_count: verified.content.card_records.length,
    content_version: verified.content.content_version,
    release_id: verified.bundle.release_id,
  };
}

function emptyCatalog() {
  return {
    collection_names: [],
    errors: ['environment inspection failed'],
    missing_required_collections: [...REQUIRED_COLLECTIONS],
    ok: false,
    required_collections_present: false,
  };
}

function isStrongSecret(value) {
  return typeof value === 'string' && value.length >= 32 && new Set(value).size >= 12;
}

function requireValue(argv, index, name) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new ReleaseDeliveryError(`${name} requires a value.`);
  }
  return value;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
  } catch {
    throw new ReleaseDeliveryError(`cannot read JSON: ${basename(path)}`);
  }
}

function printUsage() {
  console.log(`Usage:
  node infra/cloudbase/deliver-release.mjs preflight --profile <delivery-profile.json>
  node infra/cloudbase/deliver-release.mjs provision --profile <profile> [--apply --operator <id>]
  node infra/cloudbase/deliver-release.mjs deploy --profile <profile> [--apply --operator <id>]
  node infra/cloudbase/deliver-release.mjs publish --profile <profile> --bundle <bundle> [--apply --operator <id>]
  node infra/cloudbase/deliver-release.mjs verify --profile <profile> --bundle <bundle> --operator <id>
  node infra/cloudbase/deliver-release.mjs rollback --profile <profile> --release <release-id> [--apply --operator <id>]

All mutating commands are dry-run unless --apply is explicit. Apply requires clean exact main, Node ${REQUIRED_DEPLOYMENT_NODE_VERSION}, receiver secrets, and successful remote preflight.`);
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.command === 'help') {
      printUsage();
      return;
    }
    const report = await executeDeliveryCommand(options);
    if (options.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(
        `[receiver-delivery] ${report.operation}: ${report.status}; writes=${
          report.writes_performed ?? false
        }`,
      );
    }
    if (report.status === 'blocked') process.exitCode = 1;
  } catch (error) {
    console.error(
      `[receiver-delivery] ${error instanceof Error ? error.message : 'unknown failure'}`,
    );
    process.exitCode = 1;
  }
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  main();
}

export const receiverDeliveryInternals = {
  buildCreateTableArguments,
  buildDescribeTablesArguments,
  inspectWriteSafety,
  readUserDataCounts,
  verifyApiRoute,
};
