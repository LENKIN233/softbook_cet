#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseStrictJson } from '../../scripts/lib/strict_json.mjs';
import {
  buildBackendDeploymentId,
  inspectApiFunction,
  receiverDeliveryInternals,
} from './deliver-release.mjs';
import { createCloudBaseCommandRunner } from './cloudbase-receiver-adapter.mjs';
import { validateDeliveryProfile } from './release-delivery-v1.mjs';

const CLOUD_BASE_ROOT = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(CLOUD_BASE_ROOT, '../..');
const OPERATOR_PATTERN =
  /^(model|agent|service|oidc):[A-Za-z0-9][A-Za-z0-9_.@-]{2,127}$/;
const SHA1_PATTERN = /^[0-9a-f]{40}$/;
const ACCESS_A = 'SOFTBOOK_CET_SESSION_DRILL_ACCESS_A';
const REFRESH_A = 'SOFTBOOK_CET_SESSION_DRILL_REFRESH_A';
const ACCESS_B = 'SOFTBOOK_CET_SESSION_DRILL_ACCESS_B';
const REFRESH_B = 'SOFTBOOK_CET_SESSION_DRILL_REFRESH_B';
const REQUEST_TIMEOUT_MS = 10_000;

export class SessionRevocationDrillError extends Error {}

export function parseSessionRevocationDrillArguments(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };
  const options = { apply: false, operator: null, profilePath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--apply') options.apply = true;
    else if (argument === '--operator') {
      options.operator = requireValue(argv, ++index, argument);
    } else if (argument === '--profile') {
      options.profilePath = requireValue(argv, ++index, argument);
    } else
      throw new SessionRevocationDrillError(`unknown argument: ${argument}`);
  }
  if (!options.profilePath) {
    throw new SessionRevocationDrillError('--profile is required.');
  }
  if (options.apply && !options.operator) {
    throw new SessionRevocationDrillError('--apply requires --operator.');
  }
  if (options.operator && !OPERATOR_PATTERN.test(options.operator)) {
    throw new SessionRevocationDrillError(
      'operator must identify a model, agent, service, or OIDC operator.'
    );
  }
  return options;
}

export async function executeSessionRevocationDrill(
  options,
  dependencies = {}
) {
  const clock = dependencies.clock ?? (() => new Date());
  const startedAt = readTimestamp(clock, 'session drill start');
  const loadedProfile = dependencies.loadProfile
    ? dependencies.loadProfile(options.profilePath)
    : loadTrackedProfile(options.profilePath);
  const profileBytes = loadedProfile.bytes;
  const profile = validateDeliveryProfile(
    parseStrictJson(profileBytes, 'session drill delivery profile')
  );
  if (profile.runtime_mode !== 'closed_beta') {
    throw new SessionRevocationDrillError(
      'session revocation drill requires a closed_beta delivery profile.'
    );
  }
  const repository = dependencies.repository ?? readRepositoryState();
  const nodeVersion = dependencies.nodeVersion ?? process.versions.node;
  const writeSafety = {
    ...receiverDeliveryInternals.inspectWriteSafety({
      nodeVersion,
      repository,
    }),
    node_version: nodeVersion,
  };
  const expectedBackendDeploymentId = buildBackendDeploymentId({
    profile,
    repositoryCommit: repository.head,
  });
  const base = {
    applied: options.apply,
    expected_backend_deployment_id: expectedBackendDeploymentId,
    gate_eligible: false,
    profile: {
      environment_id: profile.environment_id,
      profile_id: profile.profile_id,
      profile_sha256: digestBytes(profileBytes),
      runtime_mode: profile.runtime_mode,
    },
    repository_commit: repository.head,
    write_safety: writeSafety,
  };
  if (!options.apply) {
    return {
      ...base,
      schema_version: 'session-revocation-drill-plan.v1',
      status: 'planned',
      remote_requests_performed: false,
      remote_writes_performed: false,
      execution: completeExecution(clock, options.operator, startedAt),
    };
  }
  requireApplyReady({ operator: options.operator, repository, writeSafety });
  const env = dependencies.env ?? process.env;
  const inspectDeployment = dependencies.inspectDeployment ?? inspectApiFunction;
  const deployment = await inspectDeployment({
    envId: profile.environment_id,
    expectedDeploymentId: expectedBackendDeploymentId,
    profile,
    runner:
      dependencies.runner ??
      createCloudBaseCommandRunner({
        cwd: REPOSITORY_ROOT,
        env: credentialFreePreflightEnvironment(env),
      }),
  });
  if (deployment?.ok !== true) {
    throw new SessionRevocationDrillError(
      `receiver deployment identity preflight failed: ${(deployment?.errors ?? [
        'unavailable deployment evidence',
      ]).join(', ')}`
    );
  }
  const credentials = {
    accessA: requireSecret(env[ACCESS_A], ACCESS_A, 'softbook_v2.'),
    refreshA: requireSecret(env[REFRESH_A], REFRESH_A, 'softbook_refresh.'),
    accessB: requireSecret(env[ACCESS_B], ACCESS_B, 'softbook_v2.'),
    refreshB: requireSecret(env[REFRESH_B], REFRESH_B, 'softbook_refresh.'),
  };
  requireDistinctSecrets(credentials);
  const identityA = decodeAccessIdentity(
    credentials.accessA,
    'client A access token'
  );
  const identityB = decodeAccessIdentity(
    credentials.accessB,
    'client B access token'
  );
  if (identityA.phoneNumber !== identityB.phoneNumber) {
    throw new SessionRevocationDrillError(
      'session drill access tokens must claim the same phone account.'
    );
  }
  if (identityA.sessionId === identityB.sessionId) {
    throw new SessionRevocationDrillError(
      'session drill requires two distinct server session IDs.'
    );
  }
  requirePrivateOperator(options.operator, {
    phoneNumber: identityA.phoneNumber,
    secrets: Object.values(credentials),
  });
  const refreshIdentityA = decodeRefreshIdentity(
    credentials.refreshA,
    'client A refresh token'
  );
  const refreshIdentityB = decodeRefreshIdentity(
    credentials.refreshB,
    'client B refresh token'
  );
  if (
    refreshIdentityA.sessionId !== identityA.sessionId ||
    refreshIdentityB.sessionId !== identityB.sessionId
  ) {
    throw new SessionRevocationDrillError(
      'access and refresh tokens must bind their matching session IDs.'
    );
  }
  const transport =
    dependencies.transport ??
    createRemoteSessionTransport({ baseUrl: profile.api_base_url });
  const observations = await runAppliedSequence({
    clock,
    credentials,
    identityA,
    identityB,
    transport,
  });
  return {
    ...base,
    schema_version: 'session-revocation-drill-report.v1',
    status: 'passed',
    remote_requests_performed: true,
    remote_writes_performed: true,
    sessions: {
      same_phone_claim: true,
      distinct_session_ids: true,
      client_a_session_sha256: digestString(identityA.sessionId),
      client_b_session_sha256: digestString(identityB.sessionId),
      token_values_reported: false,
      phone_value_reported: false,
    },
    observations,
    assertions: {
      receiver_deployment_identity_verified: true,
      both_sessions_initially_active: true,
      refresh_rotated_credentials: true,
      old_refresh_replay_revoked_only_client_a: true,
      rotated_refresh_rejected_after_replay: true,
      rotated_access_rejected_after_replay: true,
      client_b_refresh_rotated_after_client_a_replay: true,
      client_b_remained_active_until_logout: true,
      logout_and_replay_were_idempotent: true,
      client_b_access_and_refresh_rejected_after_logout: true,
    },
    execution: completeExecution(clock, options.operator, startedAt),
  };
}

export function credentialFreePreflightEnvironment(source = process.env) {
  const env = { ...source };
  for (const name of [ACCESS_A, REFRESH_A, ACCESS_B, REFRESH_B]) {
    delete env[name];
  }
  return env;
}

async function runAppliedSequence({
  clock,
  credentials,
  identityA,
  identityB,
  transport,
}) {
  const bootstrapPath = `/v2/bootstrap?track=cet4&day_key=${dayKey(clock)}`;
  const initialA = parseBootstrap(
    await transport.request(credentials.accessA, bootstrapPath),
    'client A initial bootstrap'
  );
  const initialB = parseBootstrap(
    await transport.request(credentials.accessB, bootstrapPath),
    'client B initial bootstrap'
  );
  if (
    initialA.contentVersion !== initialB.contentVersion ||
    initialA.releaseId !== initialB.releaseId
  ) {
    throw new SessionRevocationDrillError(
      'initial session content/release scopes do not match.'
    );
  }

  const rotatedAResponse = await transport.request(null, '/v2/auth/refresh', {
    body: { refresh_token: credentials.refreshA },
    method: 'POST',
  });
  const rotatedA = parseRotatedSession(
    rotatedAResponse,
    identityA.sessionId,
    'client A',
    decodeRefreshIdentity(credentials.refreshA, 'client A original refresh token').rotation
  );
  if (
    rotatedA.accessToken === credentials.accessA ||
    rotatedA.refreshToken === credentials.refreshA
  ) {
    throw new SessionRevocationDrillError(
      'client A refresh rotation must return new credential bytes.'
    );
  }

  expectError(
    await transport.request(null, '/v2/auth/refresh', {
      body: { refresh_token: credentials.refreshA },
      method: 'POST',
    }),
    401,
    'refresh_token_reused',
    'client A old refresh replay'
  );
  expectError(
    await transport.request(null, '/v2/auth/refresh', {
      body: { refresh_token: rotatedA.refreshToken },
      method: 'POST',
    }),
    401,
    'revoked_auth_session',
    'client A rotated refresh after replay'
  );
  expectError(
    await transport.request(rotatedA.accessToken, bootstrapPath),
    401,
    'revoked_auth_session',
    'client A rotated access after replay'
  );

  const rotatedBResponse = await transport.request(null, '/v2/auth/refresh', {
    body: { refresh_token: credentials.refreshB },
    method: 'POST',
  });
  const rotatedB = parseRotatedSession(
    rotatedBResponse,
    identityB.sessionId,
    'client B',
    decodeRefreshIdentity(credentials.refreshB, 'client B original refresh token').rotation
  );
  if (
    rotatedB.accessToken === credentials.accessB ||
    rotatedB.refreshToken === credentials.refreshB
  ) {
    throw new SessionRevocationDrillError(
      'client B refresh rotation must return new credential bytes.'
    );
  }

  const rotatedBState = parseBootstrap(
    await transport.request(rotatedB.accessToken, bootstrapPath),
    'client B after client A replay'
  );
  if (
    rotatedBState.contentVersion !== initialA.contentVersion ||
    rotatedBState.contentVersion !== initialB.contentVersion ||
    rotatedBState.releaseId !== initialA.releaseId ||
    rotatedBState.releaseId !== initialB.releaseId
  ) {
    throw new SessionRevocationDrillError(
      'client B refresh-rotated content/release scope does not match the initial sessions.'
    );
  }

  expectStatus(
    await transport.request(rotatedB.accessToken, '/v2/auth/logout', {
      method: 'POST',
    }),
    204,
    'client B logout'
  );
  expectStatus(
    await transport.request(rotatedB.accessToken, '/v2/auth/logout', {
      method: 'POST',
    }),
    204,
    'client B logout replay'
  );
  expectError(
    await transport.request(rotatedB.accessToken, bootstrapPath),
    401,
    'revoked_auth_session',
    'client B access after logout'
  );
  expectError(
    await transport.request(null, '/v2/auth/refresh', {
      body: { refresh_token: rotatedB.refreshToken },
      method: 'POST',
    }),
    401,
    'revoked_auth_session',
    'client B refresh after logout'
  );

  return {
    content_version: initialA.contentVersion,
    release_id: initialA.releaseId,
    client_a_session_sha256: digestString(identityA.sessionId),
    client_b_session_sha256: digestString(identityB.sessionId),
    rotated_client_a_session_sha256: digestString(rotatedA.sessionId),
    rotated_client_b_session_sha256: digestString(rotatedB.sessionId),
    initial_client_a_status: 'active',
    initial_client_b_status: 'active',
    refresh_rotation_status: 'rotated',
    old_refresh_replay_status: 'refresh_token_reused',
    rotated_refresh_status: 'revoked_auth_session',
    rotated_access_status: 'revoked_auth_session',
    client_b_refresh_rotation_status: 'rotated',
    sibling_after_replay_status: 'active',
    logout_status: 'logged_out',
    logout_replay_status: 'idempotent',
    logged_out_access_status: 'revoked_auth_session',
    logged_out_refresh_status: 'revoked_auth_session',
  };
}

export function createRemoteSessionTransport({
  baseUrl,
  fetchImpl = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
}) {
  const normalized = String(baseUrl ?? '').replace(/\/+$/, '');
  if (!/^https:\/\//.test(normalized)) {
    throw new SessionRevocationDrillError(
      'session drill requires an HTTPS API base URL.'
    );
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30_000) {
    throw new SessionRevocationDrillError(
      'session drill request timeout must be between 1000 and 30000 milliseconds.'
    );
  }
  return {
    async request(
      accessToken,
      requestPath,
      { body = null, method = 'GET' } = {}
    ) {
      const target = `${normalized}${requestPath}`;
      const controller = new AbortController();
      let timeout;
      const deadline = new Promise((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new SessionRevocationDrillError(
            'session drill remote request timed out.'
          ));
        }, timeoutMs);
      });
      try {
        let response;
        try {
          response = await Promise.race([fetchImpl(target, {
            ...(body === null ? {} : { body: JSON.stringify(body) }),
            headers: {
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
              'content-type': 'application/json',
              'x-softbook-client': 'mobile',
            },
            method,
            redirect: 'error',
            signal: controller.signal,
          }), deadline]);
        } catch (error) {
          if (error instanceof SessionRevocationDrillError) throw error;
          throw new SessionRevocationDrillError(
            'session drill remote request failed.'
          );
        }
        if (response.redirected === true || (response.url && response.url !== target)) {
          throw new SessionRevocationDrillError(
            'session drill remote response changed the tracked receiver URL.'
          );
        }
        if (response.status === 204) {
          return { payload: null, status: 204 };
        }
        let payload;
        try {
          payload = await Promise.race([response.json(), deadline]);
        } catch (error) {
          if (error instanceof SessionRevocationDrillError) throw error;
          throw new SessionRevocationDrillError(
            'session drill remote response was not JSON.'
          );
        }
        return { payload, status: response.status };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function loadTrackedProfile(profilePath) {
  const absolute = resolve(profilePath);
  const relativePath = relative(REPOSITORY_ROOT, absolute).split(sep).join('/');
  if (
    relativePath.startsWith('../') ||
    relativePath.includes('\\') ||
    !relativePath.endsWith('.json')
  ) {
    throw new SessionRevocationDrillError(
      'session revocation drill profile must be a tracked JSON file inside the repository.'
    );
  }
  const stats = lstatSync(absolute);
  if (!stats.isFile() || (stats.mode & 0o111) !== 0) {
    throw new SessionRevocationDrillError(
      'session revocation drill profile must be a non-executable regular file.'
    );
  }
  const bytes = readFileSync(absolute);
  let treeEntry;
  let headBytes;
  try {
    treeEntry = execFileSync(
      'git',
      ['ls-tree', 'HEAD', '--', relativePath],
      { cwd: REPOSITORY_ROOT, encoding: 'utf8' }
    ).trim();
    headBytes = execFileSync(
      'git',
      ['show', `HEAD:${relativePath}`],
      { cwd: REPOSITORY_ROOT, encoding: null }
    );
  } catch {
    throw new SessionRevocationDrillError(
      'session revocation drill profile must be tracked at exact HEAD.'
    );
  }
  if (!treeEntry.startsWith('100644 blob ') || !bytes.equals(headBytes)) {
    throw new SessionRevocationDrillError(
      'session revocation drill profile bytes must equal a regular 100644 blob at exact HEAD.'
    );
  }
  return { bytes, relativePath };
}

function parseBootstrap(response, label) {
  expectStatus(response, 200, label);
  const data = requireObject(response.payload?.data, `${label} data`);
  if (
    data.schema_version !== 'bootstrap.v2' ||
    data.track !== 'cet4' ||
    !/^sha256:[0-9a-f]{64}$/.test(data.content?.version ?? '') ||
    typeof data.content?.release_id !== 'string' ||
    data.content.release_id.length < 3
  ) {
    throw new SessionRevocationDrillError(`${label} scope is invalid.`);
  }
  return {
    contentVersion: data.content.version,
    releaseId: data.content.release_id,
  };
}

function parseRotatedSession(
  response,
  expectedSessionId,
  clientLabel,
  previousRotation
) {
  const rotationLabel = `${clientLabel} refresh rotation`;
  expectStatus(response, 200, rotationLabel);
  const data = requireObject(response.payload?.data, `${rotationLabel} data`);
  for (const field of ['access_token', 'refresh_token', 'session_id']) {
    if (typeof data[field] !== 'string' || data[field].length < 8) {
      throw new SessionRevocationDrillError(
        `${rotationLabel} ${field} is invalid.`
      );
    }
  }
  if (data.session_id !== expectedSessionId) {
    throw new SessionRevocationDrillError(
      `${rotationLabel} changed the server session ID.`
    );
  }
  const accessIdentity = decodeAccessIdentity(
    data.access_token,
    'rotated access token'
  );
  const refreshIdentity = decodeRefreshIdentity(
    data.refresh_token,
    'rotated refresh token'
  );
  if (
    accessIdentity.sessionId !== expectedSessionId ||
    refreshIdentity.sessionId !== expectedSessionId ||
    refreshIdentity.rotation !== previousRotation + 1
  ) {
    throw new SessionRevocationDrillError(
      'rotated credentials do not retain the session or advance one refresh generation.'
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    sessionId: data.session_id,
  };
}

function decodeAccessIdentity(token, label) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3 || parts[0] !== 'softbook_v2') {
    throw new SessionRevocationDrillError(`${label} shape is invalid.`);
  }
  const payload = decodeJson(parts[1], label);
  if (
    payload.type !== 'access' ||
    payload.version !== 2 ||
    !/^1\d{10}$/.test(payload.phone_number ?? '') ||
    typeof payload.session_id !== 'string' ||
    payload.session_id.length < 8
  ) {
    throw new SessionRevocationDrillError(`${label} payload is invalid.`);
  }
  return { phoneNumber: payload.phone_number, sessionId: payload.session_id };
}

function decodeRefreshIdentity(token, label) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3 || parts[0] !== 'softbook_refresh') {
    throw new SessionRevocationDrillError(`${label} shape is invalid.`);
  }
  const payload = decodeJson(parts[1], label);
  if (
    typeof payload.session_id !== 'string' ||
    payload.session_id.length < 8 ||
    !Number.isSafeInteger(payload.rotation) ||
    payload.rotation < 0
  ) {
    throw new SessionRevocationDrillError(`${label} payload is invalid.`);
  }
  return { rotation: payload.rotation, sessionId: payload.session_id };
}

function decodeJson(value, label) {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new SessionRevocationDrillError(`${label} payload is not JSON.`);
  }
}

function expectError(response, status, code, label) {
  if (response?.status !== status || response?.payload?.error?.code !== code) {
    throw new SessionRevocationDrillError(
      `${label} must return ${status} ${code}.`
    );
  }
}

function expectStatus(response, expected, label) {
  if (response?.status !== expected) {
    throw new SessionRevocationDrillError(
      `${label} returned an unexpected status.`
    );
  }
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SessionRevocationDrillError(`${label} must be an object.`);
  }
  return value;
}

function requireApplyReady({ operator, repository, writeSafety }) {
  if (!writeSafety.ok) {
    throw new SessionRevocationDrillError(writeSafety.errors.join('; '));
  }
  if (!SHA1_PATTERN.test(repository.head ?? '')) {
    throw new SessionRevocationDrillError(
      'apply requires a full repository commit SHA-1.'
    );
  }
  if (!OPERATOR_PATTERN.test(operator ?? '')) {
    throw new SessionRevocationDrillError(
      'apply requires an identified operator.'
    );
  }
}

function requireSecret(value, name, prefix) {
  if (
    typeof value !== 'string' ||
    value.length < 32 ||
    !value.startsWith(prefix) ||
    /\s/.test(value)
  ) {
    throw new SessionRevocationDrillError(`${name} is required and invalid.`);
  }
  return value;
}

function requireDistinctSecrets(value) {
  if (new Set(Object.values(value)).size !== Object.keys(value).length) {
    throw new SessionRevocationDrillError(
      'session drill credentials must be distinct.'
    );
  }
}

function requirePrivateOperator(operator, { phoneNumber, secrets }) {
  const value = String(operator ?? '');
  const normalizedDigits = value.replace(/\D/g, '');
  if (
    value.includes(phoneNumber) ||
    normalizedDigits.includes(phoneNumber) ||
    /softbook_(?:v2|refresh)\./.test(value) ||
    secrets.some((secret) => value.includes(secret))
  ) {
    throw new SessionRevocationDrillError(
      'operator must not contain phone or credential material.'
    );
  }
}

function dayKey(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new SessionRevocationDrillError('day-key clock is invalid.');
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  })
    .formatToParts(date)
    .reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function completeExecution(clock, operator, startedAt) {
  return {
    completed_at: readTimestamp(clock, 'session drill completion'),
    operator: operator ?? null,
    started_at: startedAt,
  };
}

function readTimestamp(clock, label) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new SessionRevocationDrillError(`${label} clock is invalid.`);
  }
  return date.toISOString();
}

function digestString(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function digestBytes(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function readRepositoryState() {
  return {
    branch: git(['branch', '--show-current']),
    dirty: git(['status', '--porcelain=v1', '--untracked-files=all']) !== '',
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

function requireValue(argv, index, option) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new SessionRevocationDrillError(`${option} requires a value.`);
  }
  return value;
}

function printUsage() {
  console.log(`Usage:
  node infra/cloudbase/run-session-revocation-drill.mjs --profile <delivery-profile.json> [--apply --operator <id>]

Dry-run performs no remote request. Apply requires fresh same-account A/B access+refresh token pairs in ${ACCESS_A}, ${REFRESH_A}, ${ACCESS_B}, and ${REFRESH_B}, plus Node 22.13.0, clean exact main and a receiver closed-beta profile. Apply intentionally revokes both supplied test sessions. The report includes no token or phone value and remains gate_eligible=false.`);
}

async function main() {
  try {
    const options = parseSessionRevocationDrillArguments(process.argv.slice(2));
    if (options.help) printUsage();
    else {
      console.log(
        JSON.stringify(await executeSessionRevocationDrill(options), null, 2)
      );
    }
  } catch (error) {
    const message =
      error instanceof SessionRevocationDrillError
        ? error.message
        : 'unexpected session revocation drill failure';
    console.error(`[session-revocation-drill] ${message}`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
