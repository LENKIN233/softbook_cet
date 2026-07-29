#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {createHash, randomInt, randomUUID, timingSafeEqual} from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const {createRuntimeSmsProvider} = require('./functions/softbook-api/sms-provider.js');

const CLOUD_BASE_ROOT = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(CLOUD_BASE_ROOT, '../..');
const STATE_SCHEMA = 'sms-provider-smoke-state.v1';
export const REPORT_SCHEMA = 'sms-provider-smoke.v1';
const OPERATION_SCHEMA = 'sms-provider-smoke-operation.v1';
const MAX_CONFIRMATION_ATTEMPTS = 3;
const CHALLENGE_TTL_MS = 5 * 60_000;
const SHA256_RE = /^[0-9a-f]{64}$/;
const COMMIT_RE = /^[0-9a-f]{40}$/;

export async function prepareSmsProviderSmoke({
  apply = false,
  clock = () => new Date(),
  codeGenerator = () => String(randomInt(100_000, 1_000_000)),
  env = process.env,
  providerFactory = createRuntimeSmsProvider,
  repository = readRepositoryState(),
  repositoryRoot = REPOSITORY_ROOT,
  runId = `sms-smoke-${randomUUID()}`,
  statePath,
} = {}) {
  const absoluteStatePath = requireStatePath(statePath, repositoryRoot);
  if (existsSync(absoluteStatePath)) {
    throw new Error('SMS smoke state already exists; confirm or discard it first.');
  }

  const phoneNumber = requirePhoneNumber(env.SOFTBOOK_SMS_SMOKE_PHONE);
  const targetId = requireTargetId(env.SOFTBOOK_SMS_SMOKE_TARGET_ID);
  const provider = providerFactory({env, runtimeMode: 'production'});
  const configurationFingerprint = fingerprint(
    runId,
    stableJson(providerConfiguration(provider.kind, env)),
  );

  if (!apply) {
    return {
      schema_version: OPERATION_SCHEMA,
      action: 'prepare',
      status: 'dry_run',
      provider: provider.kind,
      delivery: provider.delivery,
      target_id: targetId,
      repository_ready: repositoryIsExactMain(repository),
      state_path: relativeToRepository(absoluteStatePath, repositoryRoot),
    };
  }

  assertExactMain(repository);
  const now = asDate(clock());
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
  const code = requireSmsCode(codeGenerator());
  const state = {
    schema_version: STATE_SCHEMA,
    run_id: requireRunId(runId),
    status: 'sending',
    target_id: targetId,
    repository_commit: repository.head,
    provider: provider.kind,
    delivery: provider.delivery,
    provider_configuration_fingerprint: configurationFingerprint,
    phone_number: phoneNumber,
    code,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    sent_at: null,
    failed_confirmation_attempts: 0,
    provider_receipt: null,
  };
  writePrivateJson(absoluteStatePath, state);

  try {
    const receipt = validateProviderReceipt(
      await provider.sendCode({
        challengeId: runId,
        code,
        expiresAt: expiresAt.toISOString(),
        phoneNumber,
      }),
      provider.kind,
    );
    const sentAt = asDate(clock());
    if (sentAt.getTime() >= expiresAt.getTime()) {
      throw new Error('SMS provider send completed after the confirmation window expired.');
    }
    state.status = 'sent';
    state.sent_at = sentAt.toISOString();
    state.provider_receipt = {
      provider_request_fingerprint: receipt.providerRequestId
        ? fingerprint(runId, receipt.providerRequestId)
        : null,
      provider_status_code: receipt.providerStatusCode,
    };
    writePrivateJson(absoluteStatePath, state);
    return publicStateSummary(state, absoluteStatePath, repositoryRoot);
  } catch (error) {
    rmSync(absoluteStatePath, {force: true});
    throw new Error('SMS smoke provider send failed.', {cause: error});
  }
}

export function inspectSmsProviderSmoke({
  repositoryRoot = REPOSITORY_ROOT,
  statePath,
} = {}) {
  const absoluteStatePath = requireStatePath(statePath, repositoryRoot);
  const state = readPrivateState(absoluteStatePath);
  return publicStateSummary(state, absoluteStatePath, repositoryRoot);
}

export function confirmSmsProviderSmoke({
  apply = false,
  clock = () => new Date(),
  receivedCode,
  reportPath,
  repository = readRepositoryState(),
  repositoryRoot = REPOSITORY_ROOT,
  statePath,
  verifier = process.env.SOFTBOOK_SMS_SMOKE_VERIFIER,
} = {}) {
  const absoluteStatePath = requireStatePath(statePath, repositoryRoot);
  const absoluteReportPath = requireReportPath(reportPath, repositoryRoot);
  const state = readPrivateState(absoluteStatePath);

  if (!apply) {
    return {
      ...publicStateSummary(state, absoluteStatePath, repositoryRoot),
      action: 'confirm',
      status: 'ready_for_confirmation',
      report_path: relativeToRepository(absoluteReportPath, repositoryRoot),
    };
  }

  assertExactMain(repository);
  if (repository.head !== state.repository_commit) {
    throw new Error('SMS smoke confirmation must use the preparation commit.');
  }
  if (existsSync(absoluteReportPath)) {
    throw new Error('SMS smoke report already exists and will not be overwritten.');
  }
  const now = asDate(clock());
  if (now.getTime() > Date.parse(state.expires_at)) {
    rmSync(absoluteStatePath, {force: true});
    throw new Error('SMS smoke confirmation expired; private state was removed.');
  }
  const humanVerifier = requireHumanVerifier(verifier);
  const candidate = requireSmsCode(receivedCode);
  if (!safeCodeEqual(state.code, candidate)) {
    state.failed_confirmation_attempts += 1;
    if (state.failed_confirmation_attempts >= MAX_CONFIRMATION_ATTEMPTS) {
      rmSync(absoluteStatePath, {force: true});
      throw new Error('SMS smoke confirmation failed and private state was removed.');
    }
    writePrivateJson(absoluteStatePath, state);
    throw new Error('SMS smoke confirmation failed.');
  }

  const report = {
    schema_version: REPORT_SCHEMA,
    run_id: state.run_id,
    status: 'passed',
    target_id: state.target_id,
    repository_commit: state.repository_commit,
    provider: state.provider,
    delivery: state.delivery,
    provider_configuration_fingerprint: state.provider_configuration_fingerprint,
    provider_receipt: state.provider_receipt,
    phone_fingerprint: fingerprint(state.run_id, state.phone_number),
    sent_at: state.sent_at,
    confirmed_at: now.toISOString(),
    expires_at: state.expires_at,
    confirmation_method: 'human_received_code_match',
    verifier: {kind: 'human', id: humanVerifier},
    private_state_removed: true,
    generated_at: now.toISOString(),
  };
  const errors = validateSmsProviderSmokeReport(report);
  if (errors.length > 0) {
    throw new Error(`SMS smoke report is invalid: ${errors.join('; ')}`);
  }
  publishReportAfterPrivateStateRemoval(absoluteReportPath, absoluteStatePath, report);
  return report;
}

export function discardSmsProviderSmoke({
  apply = false,
  repositoryRoot = REPOSITORY_ROOT,
  statePath,
} = {}) {
  const absoluteStatePath = requireStatePath(statePath, repositoryRoot);
  const state = readPrivateState(absoluteStatePath, {allowSending: true});
  const summary = publicStateSummary(state, absoluteStatePath, repositoryRoot);
  if (apply) rmSync(absoluteStatePath);
  return {
    ...summary,
    action: 'discard',
    status: apply ? 'discarded' : 'dry_run',
    private_state_removed: apply,
  };
}

export function validateSmsProviderSmokeReport(report) {
  const errors = [];
  const expectedKeys = [
    'schema_version',
    'run_id',
    'status',
    'target_id',
    'repository_commit',
    'provider',
    'delivery',
    'provider_configuration_fingerprint',
    'provider_receipt',
    'phone_fingerprint',
    'sent_at',
    'confirmed_at',
    'expires_at',
    'confirmation_method',
    'verifier',
    'private_state_removed',
    'generated_at',
  ];
  requireExactKeys(report, expectedKeys, 'report', errors);
  if (report?.schema_version !== REPORT_SCHEMA) errors.push('schema_version is invalid');
  if (!/^sms-smoke-[0-9a-f-]{36}$/.test(String(report?.run_id || ''))) {
    errors.push('run_id is invalid');
  }
  if (report?.status !== 'passed') errors.push('status must be passed');
  if (!isTargetId(report?.target_id)) errors.push('target_id is invalid');
  if (!COMMIT_RE.test(String(report?.repository_commit || ''))) {
    errors.push('repository_commit is invalid');
  }
  if (!['webhook', 'tencentcloud'].includes(report?.provider)) {
    errors.push('provider is invalid');
  }
  const expectedDelivery =
    report?.provider === 'webhook' ? 'sms_webhook' : 'sms_tencentcloud';
  if (report?.delivery !== expectedDelivery) errors.push('delivery does not match provider');
  if (!isEvidenceSha(report?.provider_configuration_fingerprint)) {
    errors.push('provider_configuration_fingerprint is invalid');
  }
  if (!isEvidenceSha(report?.phone_fingerprint)) {
    errors.push('phone_fingerprint is invalid');
  }
  validatePublicReceipt(report?.provider_receipt, report?.provider, errors);
  const sentAt = Date.parse(report?.sent_at);
  const confirmedAt = Date.parse(report?.confirmed_at);
  const expiresAt = Date.parse(report?.expires_at);
  const generatedAt = Date.parse(report?.generated_at);
  if (![sentAt, confirmedAt, expiresAt, generatedAt].every(Number.isFinite)) {
    errors.push('report timestamps are invalid');
  } else {
    if (confirmedAt < sentAt || confirmedAt > expiresAt) {
      errors.push('confirmation is outside the send/expiry window');
    }
    if (generatedAt !== confirmedAt) errors.push('generated_at must equal confirmed_at');
    if (expiresAt - sentAt > CHALLENGE_TTL_MS) errors.push('expiry window exceeds five minutes');
  }
  if (report?.confirmation_method !== 'human_received_code_match') {
    errors.push('confirmation_method is invalid');
  }
  if (report?.private_state_removed !== true) errors.push('private_state_removed must be true');
  if (report?.verifier?.kind !== 'human' || !isHumanVerifier(report?.verifier?.id)) {
    errors.push('verifier must identify a human reviewer');
  }
  return errors;
}

function validatePublicReceipt(receipt, provider, errors) {
  requireExactKeys(
    receipt,
    ['provider_request_fingerprint', 'provider_status_code'],
    'provider_receipt',
    errors,
  );
  if (provider === 'tencentcloud') {
    if (!isEvidenceSha(receipt?.provider_request_fingerprint)) {
      errors.push('Tencent Cloud receipt requires a request fingerprint');
    }
    if (receipt?.provider_status_code !== null) {
      errors.push('Tencent Cloud receipt status code must be null');
    }
  } else if (provider === 'webhook') {
    if (receipt?.provider_request_fingerprint !== null) {
      errors.push('webhook receipt request fingerprint must be null');
    }
    if (!Number.isInteger(receipt?.provider_status_code) || receipt.provider_status_code < 200 || receipt.provider_status_code > 299) {
      errors.push('webhook receipt requires a 2xx status code');
    }
  }
}

function validateProviderReceipt(receipt, provider) {
  if (!receipt || receipt.accepted !== true) {
    throw new Error('SMS provider did not return an acceptance receipt.');
  }
  if (
    receipt.providerRequestId !== null &&
    (typeof receipt.providerRequestId !== 'string' || receipt.providerRequestId.trim() === '')
  ) {
    throw new Error('SMS provider request ID is invalid.');
  }
  if (
    receipt.providerStatusCode !== null &&
    (!Number.isInteger(receipt.providerStatusCode) ||
      receipt.providerStatusCode < 200 ||
      receipt.providerStatusCode > 299)
  ) {
    throw new Error('SMS provider status code is invalid.');
  }
  if (provider === 'tencentcloud' && !receipt.providerRequestId) {
    throw new Error('Tencent Cloud SMS receipt requires a provider request ID.');
  }
  if (provider === 'webhook' && receipt.providerStatusCode === null) {
    throw new Error('SMS webhook receipt requires an HTTP status code.');
  }
  return receipt;
}

function providerConfiguration(provider, env) {
  if (provider === 'webhook') {
    return {
      provider,
      endpoint: env.SOFTBOOK_SMS_WEBHOOK_URL,
    };
  }
  return {
    provider,
    region: env.SOFTBOOK_SMS_TENCENT_REGION,
    sdk_app_id: env.SOFTBOOK_SMS_TENCENT_SDK_APP_ID,
    sign_name: env.SOFTBOOK_SMS_TENCENT_SIGN_NAME,
    template_id: env.SOFTBOOK_SMS_TENCENT_TEMPLATE_ID,
    template_parameters: env.SOFTBOOK_SMS_TENCENT_TEMPLATE_PARAMETERS,
  };
}

function readPrivateState(path, {allowSending = false} = {}) {
  const stats = lstatSync(path);
  if (!stats.isFile() || (stats.mode & 0o077) !== 0) {
    throw new Error('SMS smoke private state must be a mode-0600 regular file.');
  }
  const state = JSON.parse(readFileSync(path, 'utf8'));
  const errors = [];
  requireExactKeys(
    state,
    [
      'schema_version',
      'run_id',
      'status',
      'target_id',
      'repository_commit',
      'provider',
      'delivery',
      'provider_configuration_fingerprint',
      'phone_number',
      'code',
      'created_at',
      'expires_at',
      'sent_at',
      'failed_confirmation_attempts',
      'provider_receipt',
    ],
    'state',
    errors,
  );
  if (state?.schema_version !== STATE_SCHEMA) errors.push('state schema is invalid');
  const allowedStatuses = allowSending ? ['sending', 'sent'] : ['sent'];
  if (!allowedStatuses.includes(state?.status)) errors.push('state is not ready for this operation');
  if (!/^sms-smoke-[0-9a-f-]{36}$/.test(String(state?.run_id || ''))) {
    errors.push('state run ID is invalid');
  }
  if (!COMMIT_RE.test(String(state?.repository_commit || ''))) errors.push('state commit is invalid');
  if (!isTargetId(state?.target_id)) errors.push('state target is invalid');
  if (!['webhook', 'tencentcloud'].includes(state?.provider)) errors.push('state provider is invalid');
  const expectedDelivery = state?.provider === 'webhook' ? 'sms_webhook' : 'sms_tencentcloud';
  if (state?.delivery !== expectedDelivery) errors.push('state delivery does not match provider');
  if (!isEvidenceSha(state?.provider_configuration_fingerprint)) {
    errors.push('state configuration fingerprint is invalid');
  }
  try {
    requirePhoneNumber(state?.phone_number);
    requireSmsCode(state?.code);
  } catch (error) {
    errors.push(error.message);
  }
  if (!Number.isInteger(state?.failed_confirmation_attempts) || state.failed_confirmation_attempts < 0 || state.failed_confirmation_attempts >= MAX_CONFIRMATION_ATTEMPTS) {
    errors.push('state confirmation attempt count is invalid');
  }
  for (const [field, value] of [
    ['created_at', state?.created_at],
    ['expires_at', state?.expires_at],
  ]) {
    if (!Number.isFinite(Date.parse(value))) errors.push(`state ${field} is invalid`);
  }
  if (state?.status === 'sent') {
    if (!Number.isFinite(Date.parse(state?.sent_at))) errors.push('state sent_at is invalid');
    validatePublicReceipt(state?.provider_receipt, state?.provider, errors);
  } else if (state?.sent_at !== null || state?.provider_receipt !== null) {
    errors.push('sending state must not contain a receipt');
  }
  if (errors.length > 0) throw new Error(`SMS smoke private state is invalid: ${errors.join('; ')}`);
  return state;
}

function publicStateSummary(state, statePath, repositoryRoot) {
  return {
    schema_version: OPERATION_SCHEMA,
    action: 'prepare',
    status: state.status,
    run_id: state.run_id,
    provider: state.provider,
    delivery: state.delivery,
    target_id: state.target_id,
    repository_commit: state.repository_commit,
    expires_at: state.expires_at,
    phone_fingerprint: fingerprint(state.run_id, state.phone_number),
    state_path: relativeToRepository(statePath, repositoryRoot),
  };
}

function readRepositoryState(repositoryRoot = REPOSITORY_ROOT) {
  const runGit = args => {
    const result = spawnSync('git', args, {
      cwd: repositoryRoot,
      encoding: 'utf8',
      timeout: 30_000,
    });
    if (result.error || result.status !== 0) {
      throw result.error ?? new Error(`git ${args[0]} exited ${result.status}.`);
    }
    return result.stdout.trim();
  };
  return {
    branch: runGit(['branch', '--show-current']),
    dirty: runGit(['status', '--porcelain']) !== '',
    head: runGit(['rev-parse', 'HEAD']),
    originMain: runGit(['rev-parse', 'origin/main']),
  };
}

function repositoryIsExactMain(repository) {
  return (
    repository?.branch === 'main' &&
    repository.dirty === false &&
    COMMIT_RE.test(String(repository.head || '')) &&
    repository.head === repository.originMain
  );
}

function assertExactMain(repository) {
  if (!repositoryIsExactMain(repository)) {
    throw new Error('SMS provider smoke apply requires clean main exactly matching origin/main.');
  }
}

function requireStatePath(path, repositoryRoot) {
  return requirePathBelow(
    path,
    resolve(repositoryRoot, 'docs', 'agent-runs', 'artifacts'),
    'SMS smoke private state',
  );
}

function requireReportPath(path, repositoryRoot) {
  return requirePathBelow(
    path,
    resolve(repositoryRoot, 'docs', 'release', 'evidence'),
    'SMS smoke report',
  );
}

function requirePathBelow(path, root, label) {
  if (typeof path !== 'string' || path.trim() === '') {
    throw new Error(`${label} path is required.`);
  }
  const absolute = resolve(path);
  if (absolute === root || !absolute.startsWith(`${root}${sep}`) || !absolute.endsWith('.json')) {
    throw new Error(`${label} must be a JSON file below ${root}.`);
  }
  return absolute;
}

function relativeToRepository(path, repositoryRoot) {
  const prefix = `${resolve(repositoryRoot)}${sep}`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function writePrivateJson(path, value) {
  writeAtomicJson(path, value, 0o600);
}

function writeAtomicJson(path, value, mode) {
  const temporary = `${path}.tmp-${process.pid}`;
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    mode,
  });
  chmodSync(temporary, mode);
  renameSync(temporary, path);
}

function publishReportAfterPrivateStateRemoval(reportPath, statePath, report) {
  const temporary = `${reportPath}.tmp-${process.pid}`;
  mkdirSync(dirname(reportPath), {recursive: true});
  writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o644,
  });
  chmodSync(temporary, 0o644);
  try {
    rmSync(statePath);
    renameSync(temporary, reportPath);
  } catch (error) {
    rmSync(temporary, {force: true});
    throw error;
  }
}

function requirePhoneNumber(value) {
  if (typeof value !== 'string' || !/^1[3-9]\d{9}$/.test(value)) {
    throw new Error('SOFTBOOK_SMS_SMOKE_PHONE must be a mainland China mobile number.');
  }
  return value;
}

function requireSmsCode(value) {
  if (typeof value !== 'string' || !/^\d{6}$/.test(value)) {
    throw new Error('SMS smoke code must contain exactly six digits.');
  }
  return value;
}

function requireTargetId(value) {
  if (!isTargetId(value)) {
    throw new Error('SOFTBOOK_SMS_SMOKE_TARGET_ID must be a stable receiver target ID.');
  }
  return value;
}

function isTargetId(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{2,63}$/.test(value);
}

function requireHumanVerifier(value) {
  if (!isHumanVerifier(value)) {
    throw new Error('SOFTBOOK_SMS_SMOKE_VERIFIER must identify a human and not an agent.');
  }
  return value;
}

function isHumanVerifier(value) {
  return (
    typeof value === 'string' &&
    /^(?:github|team|external):[A-Za-z0-9][A-Za-z0-9._@-]{2,63}$/.test(value) &&
    !/(?:agent|bot|codex|automation|ci)/i.test(value)
  );
}

function requireRunId(value) {
  if (!/^sms-smoke-[0-9a-f-]{36}$/.test(String(value || ''))) {
    throw new Error('SMS smoke run ID is invalid.');
  }
  return value;
}

function safeCodeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function fingerprint(runId, value) {
  return createHash('sha256').update(`${runId}\0${String(value)}`).digest('hex');
}

function isEvidenceSha(value) {
  return SHA256_RE.test(String(value || '')) && !/^([0-9a-f])\1{63}$/.test(value);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('SMS smoke clock is invalid.');
  return date;
}

function requireExactKeys(value, expected, label, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${label} must be an object`);
    return;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    errors.push(`${label} keys are not exact`);
  }
}

export function parseArguments(argv) {
  const [command, ...rest] = argv;
  if (!['prepare', 'confirm', 'discard'].includes(command)) {
    throw new Error('Command must be prepare, confirm, or discard.');
  }
  const options = {apply: false, command, format: 'text', reportPath: null, statePath: null};
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === '--apply') {
      options.apply = true;
      continue;
    }
    if (['--format', '--report', '--state'].includes(argument)) {
      const value = rest[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value.`);
      index += 1;
      if (argument === '--format') options.format = value;
      if (argument === '--report') options.reportPath = value;
      if (argument === '--state') options.statePath = value;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.statePath) throw new Error('--state is required.');
  if (command === 'confirm' && !options.reportPath) throw new Error('confirm requires --report.');
  if (command !== 'confirm' && options.reportPath) throw new Error('--report is valid only for confirm.');
  if (!['json', 'text'].includes(options.format)) throw new Error('--format must be text or json.');
  return options;
}

function sanitizeText(value) {
  return String(value)
    .replace(/\b1\d{10}\b/g, '<redacted-phone>')
    .replace(/\b\d{6}\b/g, '<redacted-code>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    let result;
    if (options.command === 'prepare') {
      result = await prepareSmsProviderSmoke({
        apply: options.apply,
        statePath: options.statePath,
      });
    } else if (options.command === 'confirm') {
      const receivedCode = options.apply ? readFileSync(0, 'utf8').trim() : undefined;
      result = confirmSmsProviderSmoke({
        apply: options.apply,
        receivedCode,
        reportPath: options.reportPath,
        statePath: options.statePath,
      });
    } else {
      result = discardSmsProviderSmoke({
        apply: options.apply,
        statePath: options.statePath,
      });
    }
    if (options.format === 'json') {
      console.log(JSON.stringify(result));
    } else {
      console.log(`[${result.status}] provider=${result.provider}; target=${result.target_id}`);
    }
  } catch (error) {
    console.error(`[sms-provider-smoke] ${sanitizeText(error.message)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
