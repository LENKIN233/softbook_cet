#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {createHash, randomInt, randomUUID, timingSafeEqual} from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  ed25519PublicKeyFingerprint,
  requireEd25519PublicKey,
  validateSmsReceiverEvidence,
  verifySmsReceiverEvidence,
} from './sms-receiver-evidence-contract.mjs';
import {parseStrictJson} from '../../scripts/lib/strict_json.mjs';

const require = createRequire(import.meta.url);
const {createRuntimeSmsProvider} = require('./functions/softbook-api/sms-provider.js');

const CLOUD_BASE_ROOT = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(CLOUD_BASE_ROOT, '../..');
const STATE_SCHEMA = 'sms-provider-smoke-state.v1';
export const REPORT_SCHEMA = 'sms-provider-smoke.v2';
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
  const receiverTrust = requireReceiverTrustConfiguration(env);
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
      receiver_trust: receiverTrust,
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
    receiver_trust: receiverTrust,
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
  reportPath,
  receiverAdapterId = process.env.SOFTBOOK_SMS_RECEIVER_ADAPTER_ID,
  receiverEvidencePath,
  receiverKeyId = process.env.SOFTBOOK_SMS_RECEIVER_KEY_ID,
  receiverPrivateKey = process.env.SOFTBOOK_SMS_RECEIVER_PRIVATE_KEY,
  receiverPublicKey = process.env.SOFTBOOK_SMS_RECEIVER_PUBLIC_KEY,
  repository = readRepositoryState(),
  repositoryRoot = REPOSITORY_ROOT,
  statePath,
  verifier = process.env.SOFTBOOK_SMS_SMOKE_VERIFIER,
  verificationRunId = process.env.SOFTBOOK_SMS_SMOKE_VERIFIER_RUN_ID,
} = {}) {
  const absoluteStatePath = requireStatePath(statePath, repositoryRoot);
  const absoluteReportPath = requireReportPath(reportPath, repositoryRoot);
  const absoluteReceiverEvidencePath = requireReceiverEvidencePath(
    receiverEvidencePath,
    repositoryRoot,
  );
  if (absoluteReceiverEvidencePath === absoluteStatePath) {
    throw new Error('SMS receiver evidence must be separate from smoke private state.');
  }
  if (typeof receiverPrivateKey === 'string' && receiverPrivateKey.trim() !== '') {
    throw new Error(
      'SMS smoke confirmation must not have access to the receiver private key.',
    );
  }
  const state = readPrivateState(absoluteStatePath);
  if (apply) {
    assertExactMain(repository);
    if (repository.head !== state.repository_commit) {
      throw new Error('SMS smoke confirmation must use the preparation commit.');
    }
    if (existsSync(absoluteReportPath)) {
      throw new Error('SMS smoke report already exists and will not be overwritten.');
    }
  }
  const now = asDate(clock());
  const receiverEvidence = readVerifiedReceiverEvidence({
    adapterId: state.receiver_trust.adapter_id,
    evidencePath: absoluteReceiverEvidencePath,
    expectedRunId: state.run_id,
    expectedTarget: state.target_id,
    expectedKeyId: state.receiver_trust.key_id,
    expectedPublicKeyFingerprint:
      state.receiver_trust.public_key_fingerprint,
    now,
    publicKey: receiverPublicKey,
    sentAt: state.sent_at,
    expiresAt: state.expires_at,
  });
  if (
    receiverAdapterId !== state.receiver_trust.adapter_id ||
    receiverKeyId !== state.receiver_trust.key_id
  ) {
    throw new Error('SMS receiver trust configuration changed after prepare.');
  }

  if (!apply) {
    return {
      ...publicStateSummary(state, absoluteStatePath, repositoryRoot),
      action: 'confirm',
      status: 'ready_for_confirmation',
      report_path: relativeToRepository(absoluteReportPath, repositoryRoot),
      receiver_evidence: {
        ...receiverEvidence.public,
        artifact_removed: false,
      },
    };
  }

  if (now.getTime() > Date.parse(state.expires_at)) {
    rmSync(absoluteStatePath, {force: true});
    rmSync(absoluteReceiverEvidencePath, {force: true});
    throw new Error('SMS smoke confirmation expired; private state was removed.');
  }
  const machineVerifier = requireMachinePrincipal(verifier);
  const machineVerificationRunId = requireMachineRunId(verificationRunId);
  if (machineVerifier === receiverEvidence.adapterId) {
    throw new Error('SMS smoke verifier must be independent from the receiver adapter.');
  }
  const candidate = receiverEvidence.code;
  if (!safeCodeEqual(state.code, candidate)) {
    rmSync(absoluteReceiverEvidencePath, {force: true});
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
    confirmation_method: 'automated_receiver_code_match',
    receiver_evidence: {
      ...receiverEvidence.public,
      artifact_removed: true,
    },
    verifier: {
      kind: 'machine',
      id: machineVerifier,
      run_id: machineVerificationRunId,
    },
    private_state_removed: true,
    generated_at: now.toISOString(),
  };
  const errors = validateSmsProviderSmokeReport(report);
  if (errors.length > 0) {
    throw new Error(`SMS smoke report is invalid: ${errors.join('; ')}`);
  }
  publishReportAfterPrivateArtifactsRemoval(
    absoluteReportPath,
    [absoluteStatePath, absoluteReceiverEvidencePath],
    report,
  );
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
    'receiver_evidence',
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
  if (report?.confirmation_method !== 'automated_receiver_code_match') {
    errors.push('confirmation_method is invalid');
  }
  validateReceiverEvidence(
    report?.receiver_evidence,
    {
      confirmedAt,
      expiresAt,
      sentAt,
    },
    errors,
  );
  if (report?.private_state_removed !== true) errors.push('private_state_removed must be true');
  requireExactKeys(report?.verifier, ['kind', 'id', 'run_id'], 'verifier', errors);
  if (
    report?.verifier?.kind !== 'machine' ||
    !isMachinePrincipal(report?.verifier?.id) ||
    !isMachineRunId(report?.verifier?.run_id)
  ) {
    errors.push('verifier must identify a machine principal and run');
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

function requireReceiverTrustConfiguration(env) {
  if (
    typeof env.SOFTBOOK_SMS_RECEIVER_PRIVATE_KEY === 'string' &&
    env.SOFTBOOK_SMS_RECEIVER_PRIVATE_KEY.trim() !== ''
  ) {
    throw new Error('SMS sender preparation must not have the receiver private key.');
  }
  const adapterId = env.SOFTBOOK_SMS_RECEIVER_ADAPTER_ID;
  const keyId = env.SOFTBOOK_SMS_RECEIVER_KEY_ID;
  const publicKey = env.SOFTBOOK_SMS_RECEIVER_PUBLIC_KEY;
  if (!isMachinePrincipal(adapterId)) {
    throw new Error('SOFTBOOK_SMS_RECEIVER_ADAPTER_ID must identify a machine adapter.');
  }
  if (
    typeof keyId !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(keyId)
  ) {
    throw new Error('SOFTBOOK_SMS_RECEIVER_KEY_ID is required and invalid.');
  }
  if (typeof publicKey !== 'string' || publicKey.trim() === '') {
    throw new Error('SOFTBOOK_SMS_RECEIVER_PUBLIC_KEY is required.');
  }
  return {
    adapter_id: adapterId,
    key_id: keyId,
    public_key_fingerprint: ed25519PublicKeyFingerprint(
      requireEd25519PublicKey(publicKey),
    ),
  };
}

function validateReceiverTrust(value, errors) {
  requireExactKeys(
    value,
    ['adapter_id', 'key_id', 'public_key_fingerprint'],
    'state receiver_trust',
    errors,
  );
  if (!isMachinePrincipal(value?.adapter_id)) {
    errors.push('state receiver trust adapter is invalid');
  }
  if (
    typeof value?.key_id !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(value.key_id)
  ) {
    errors.push('state receiver trust key ID is invalid');
  }
  if (!SHA256_RE.test(String(value?.public_key_fingerprint || ''))) {
    errors.push('state receiver trust public key fingerprint is invalid');
  }
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
      'receiver_trust',
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
  validateReceiverTrust(state?.receiver_trust, errors);
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
    receiver_trust: state.receiver_trust,
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
    resolve(repositoryRoot, 'docs', 'release', 'evidence', 'raw'),
    'SMS smoke raw report',
  );
}

function requireReceiverEvidencePath(path, repositoryRoot) {
  return requirePathBelow(
    path,
    resolve(repositoryRoot, 'docs', 'agent-runs', 'artifacts'),
    'SMS receiver evidence',
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
  const temporary = `${path}.tmp-${randomUUID()}`;
  let published = false;
  try {
    mkdirSync(dirname(path), {recursive: true});
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode,
    });
    chmodSync(temporary, mode);
    renameSync(temporary, path);
    published = true;
  } finally {
    if (!published) rmSync(temporary, {force: true});
  }
}

function publishReportAfterPrivateArtifactsRemoval(
  reportPath,
  privateArtifactPaths,
  report,
) {
  const temporary = `${reportPath}.tmp-${randomUUID()}`;
  let published = false;
  try {
    mkdirSync(dirname(reportPath), {recursive: true});
    writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o644,
    });
    chmodSync(temporary, 0o644);
    for (const privateArtifactPath of privateArtifactPaths) {
      rmSync(privateArtifactPath);
    }
    renameSync(temporary, reportPath);
    published = true;
  } finally {
    if (!published) rmSync(temporary, {force: true});
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

function requireMachinePrincipal(value) {
  if (!isMachinePrincipal(value)) {
    throw new Error(
      'SOFTBOOK_SMS_SMOKE_VERIFIER must identify a model, agent, service, or oidc machine principal.',
    );
  }
  return value;
}

function isMachinePrincipal(value) {
  return (
    typeof value === 'string' &&
    /^(?:model|agent|service|oidc):[A-Za-z0-9][A-Za-z0-9._@-]{2,127}$/.test(value)
  );
}

function requireMachineRunId(value) {
  if (!isMachineRunId(value)) {
    throw new Error(
      'SOFTBOOK_SMS_SMOKE_VERIFIER_RUN_ID must identify the machine verification run.',
    );
  }
  return value;
}

function isMachineRunId(value) {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(value)
  );
}

function readVerifiedReceiverEvidence({
  adapterId,
  evidencePath,
  expectedKeyId,
  expectedPublicKeyFingerprint,
  expectedRunId,
  expectedTarget,
  expiresAt,
  now,
  publicKey,
  sentAt,
}) {
  if (!isMachinePrincipal(adapterId)) {
    throw new Error(
      'SOFTBOOK_SMS_RECEIVER_ADAPTER_ID must identify the independent receiver adapter.',
    );
  }
  if (typeof expectedKeyId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(expectedKeyId)) {
    throw new Error('SOFTBOOK_SMS_RECEIVER_KEY_ID is required and invalid.');
  }
  if (publicKey == null || publicKey === '') {
    throw new Error('SOFTBOOK_SMS_RECEIVER_PUBLIC_KEY is required.');
  }
  if (!existsSync(evidencePath)) {
    throw new Error('SMS receiver evidence artifact is required and missing.');
  }
  const bytes = readExactPrivateArtifact(evidencePath);
  let evidence;
  try {
    evidence = parseStrictJson(bytes, 'SMS receiver evidence artifact');
  } catch (error) {
    throw new Error(`SMS receiver evidence is not strict JSON: ${error.message}`, {
      cause: error,
    });
  }
  const validationErrors = validateSmsReceiverEvidence(evidence);
  if (validationErrors.length > 0) {
    throw new Error(
      `SMS receiver evidence is invalid: ${validationErrors.join('; ')}`,
    );
  }
  if (evidence.adapter_id !== adapterId) {
    throw new Error('SMS receiver evidence adapter identity does not match.');
  }
  if (evidence.key_id !== expectedKeyId) {
    throw new Error('SMS receiver evidence key_id does not match configured key.');
  }
  if (evidence.run_id !== expectedRunId) {
    throw new Error('SMS receiver evidence run_id does not match smoke state.');
  }
  if (evidence.target !== expectedTarget) {
    throw new Error('SMS receiver evidence target does not match smoke state.');
  }
  const receivedAt = Date.parse(evidence.received_at);
  if (
    receivedAt < Date.parse(sentAt) ||
    receivedAt > Date.parse(expiresAt) ||
    receivedAt > now.getTime()
  ) {
    throw new Error('SMS receiver evidence received_at is outside the confirmation window.');
  }
  const key = requireEd25519PublicKey(publicKey);
  const keyFingerprint = ed25519PublicKeyFingerprint(key);
  if (keyFingerprint !== expectedPublicKeyFingerprint) {
    throw new Error('SMS receiver public key fingerprint changed after prepare.');
  }
  if (!verifySmsReceiverEvidence(evidence, key)) {
    throw new Error('SMS receiver evidence Ed25519 signature verification failed.');
  }
  return {
    adapterId: evidence.adapter_id,
    code: evidence.code,
    public: {
      artifact_sha256: createHash('sha256').update(bytes).digest('hex'),
      key_fingerprint: keyFingerprint,
      key_id: evidence.key_id,
      received_at: evidence.received_at,
      signature_verified: true,
    },
  };
}

function readExactPrivateArtifact(path) {
  let descriptor;
  try {
    descriptor = openSync(
      path,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
    );
  } catch (error) {
    throw new Error(
      'SMS receiver evidence must be a mode-0600 exact regular private artifact.',
      {cause: error},
    );
  }
  try {
    const stats = fstatSync(descriptor);
    if (!stats.isFile() || (stats.mode & 0o077) !== 0) {
      throw new Error(
        'SMS receiver evidence must be a mode-0600 exact regular private artifact.',
      );
    }
    return readFileSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function validateReceiverEvidence(value, times, errors) {
  requireExactKeys(
    value,
    [
      'artifact_sha256',
      'key_fingerprint',
      'key_id',
      'received_at',
      'signature_verified',
      'artifact_removed',
    ],
    'receiver_evidence',
    errors,
  );
  if (!isEvidenceSha(value?.artifact_sha256)) {
    errors.push('receiver_evidence artifact_sha256 is invalid');
  }
  if (!isEvidenceSha(value?.key_fingerprint)) {
    errors.push('receiver_evidence key_fingerprint is invalid');
  }
  if (typeof value?.key_id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(value.key_id)) {
    errors.push('receiver_evidence key_id is invalid');
  }
  const receivedAt = Date.parse(value?.received_at);
  if (!Number.isFinite(receivedAt)) {
    errors.push('receiver_evidence received_at is invalid');
  } else if (
    Number.isFinite(times.sentAt) &&
    Number.isFinite(times.confirmedAt) &&
    Number.isFinite(times.expiresAt) &&
    (receivedAt < times.sentAt ||
      receivedAt > times.confirmedAt ||
      receivedAt > times.expiresAt)
  ) {
    errors.push('receiver_evidence received_at is outside the confirmation window');
  }
  if (value?.signature_verified !== true) {
    errors.push('receiver_evidence signature_verified must be true');
  }
  if (value?.artifact_removed !== true) {
    errors.push('receiver_evidence artifact_removed must be true');
  }
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
  const options = {
    apply: false,
    command,
    format: 'text',
    receiverEvidencePath: null,
    reportPath: null,
    statePath: null,
  };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === '--apply') {
      options.apply = true;
      continue;
    }
    if (
      ['--format', '--receiver-evidence', '--report', '--state'].includes(
        argument,
      )
    ) {
      const value = rest[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value.`);
      index += 1;
      if (argument === '--format') options.format = value;
      if (argument === '--receiver-evidence') {
        options.receiverEvidencePath = value;
      }
      if (argument === '--report') options.reportPath = value;
      if (argument === '--state') options.statePath = value;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.statePath) throw new Error('--state is required.');
  if (command === 'confirm' && !options.reportPath) throw new Error('confirm requires --report.');
  if (command === 'confirm' && !options.receiverEvidencePath) {
    throw new Error('confirm requires --receiver-evidence.');
  }
  if (command !== 'confirm' && options.reportPath) throw new Error('--report is valid only for confirm.');
  if (command !== 'confirm' && options.receiverEvidencePath) {
    throw new Error('--receiver-evidence is valid only for confirm.');
  }
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
      result = confirmSmsProviderSmoke({
        apply: options.apply,
        receiverEvidencePath: options.receiverEvidencePath,
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
