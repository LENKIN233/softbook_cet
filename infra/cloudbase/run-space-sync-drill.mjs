#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseStrictJson } from '../../scripts/lib/strict_json.mjs';
import {
  buildBackendDeploymentId,
  receiverDeliveryInternals,
} from './deliver-release.mjs';
import { validateDeliveryProfile } from './release-delivery-v1.mjs';

const CLOUD_BASE_ROOT = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(CLOUD_BASE_ROOT, '../..');
const OPERATOR_PATTERN = /^(github|team|external):[A-Za-z0-9_.-]+$/;
const SHA1_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const TOKEN_A_NAME = 'SOFTBOOK_CET_SPACE_DRILL_TOKEN_A';
const TOKEN_B_NAME = 'SOFTBOOK_CET_SPACE_DRILL_TOKEN_B';

export class SpaceSyncDrillError extends Error {}

export function parseSpaceSyncDrillArguments(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };
  const options = {
    apply: false,
    cardId: null,
    operator: null,
    profilePath: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--apply') options.apply = true;
    else if (argument === '--card-id')
      options.cardId = requireValue(argv, ++index, argument);
    else if (argument === '--operator')
      options.operator = requireValue(argv, ++index, argument);
    else if (argument === '--profile')
      options.profilePath = requireValue(argv, ++index, argument);
    else throw new SpaceSyncDrillError(`unknown argument: ${argument}`);
  }
  if (!options.profilePath)
    throw new SpaceSyncDrillError('--profile is required.');
  if (options.apply && !options.operator) {
    throw new SpaceSyncDrillError('--apply requires --operator.');
  }
  if (options.operator && !OPERATOR_PATTERN.test(options.operator)) {
    throw new SpaceSyncDrillError(
      'operator must identify a github, team, or external operator.'
    );
  }
  return options;
}

export async function executeSpaceSyncDrill(options, dependencies = {}) {
  const clock = dependencies.clock ?? (() => new Date());
  const startedAt = readTimestamp(clock, 'space drill start');
  const profileBytes = readFileSync(resolve(options.profilePath));
  const profile = validateDeliveryProfile(
    parseStrictJson(profileBytes, 'space drill delivery profile')
  );
  if (profile.runtime_mode !== 'closed_beta') {
    throw new SpaceSyncDrillError(
      'space sync drill requires a closed_beta delivery profile.'
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
  const base = {
    applied: options.apply,
    expected_backend_deployment_id: buildBackendDeploymentId({
      profile,
      repositoryCommit: repository.head,
    }),
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
      schema_version: 'space-sync-drill-plan.v1',
      status: 'planned',
      remote_requests_performed: false,
      remote_writes_performed: false,
      execution: completeExecution(clock, options.operator, startedAt),
    };
  }
  requireApplyReady({ operator: options.operator, repository, writeSafety });
  const env = dependencies.env ?? process.env;
  const tokenA = requireSecret(env[TOKEN_A_NAME], TOKEN_A_NAME);
  const tokenB = requireSecret(env[TOKEN_B_NAME], TOKEN_B_NAME);
  if (tokenA === tokenB) {
    throw new SpaceSyncDrillError(
      'space drill requires two distinct client sessions.'
    );
  }
  const transport =
    dependencies.transport ??
    createRemoteSpaceTransport({ baseUrl: profile.api_base_url });
  const idFactory = dependencies.idFactory ?? (() => randomUUID());
  const report = await runAppliedSpaceSyncSequence({
    cardId: options.cardId,
    clock,
    idFactory,
    tokenA,
    tokenB,
    transport,
  });
  return {
    ...base,
    ...report,
    schema_version: 'space-sync-drill-report.v1',
    status: 'passed',
    remote_requests_performed: true,
    remote_writes_performed: true,
    execution: completeExecution(clock, options.operator, startedAt),
  };
}

async function runAppliedSpaceSyncSequence({
  cardId,
  clock,
  idFactory,
  tokenA,
  tokenB,
  transport,
}) {
  const source = parseCardSource(
    await transport.request(tokenA, '/v2/learning/card-source?track=cet4')
  );
  const selectedCardId = selectCardId(source.cardIds, cardId);
  const bootstrapPath = `/v2/bootstrap?track=cet4&day_key=${dayKey(clock)}`;
  const initialA = parseBootstrap(
    await transport.request(tokenA, bootstrapPath),
    selectedCardId,
    'initial client A bootstrap'
  );
  const initialB = parseBootstrap(
    await transport.request(tokenB, bootstrapPath),
    selectedCardId,
    'initial client B bootstrap'
  );
  assertBootstrapParity(initialA, initialB, source.contentVersion);

  try {
    const favoriteAction = createAction({
      actionId: `space_drill_favorite_${idFactory()}`,
      cardId: selectedCardId,
      clock,
      dimension: 'favorite',
      value: !initialA.favorite,
    });
    const favoriteAck = parseSpaceAck(
      await transport.request(tokenA, '/v2/space/actions', {
        body: actionBody(source.contentVersion, favoriteAction),
        method: 'POST',
      }),
      favoriteAction,
      'applied',
      source.contentVersion
    );
    assertState(
      favoriteAck,
      {
        favorite: favoriteAction.value,
        sleep: initialA.sleep,
      },
      'favorite apply acknowledgement'
    );
    const afterFavorite = await bootstrap(
      transport,
      tokenB,
      bootstrapPath,
      selectedCardId,
      'client B after favorite',
      source.contentVersion
    );
    assertRevision(
      afterFavorite.revision,
      initialA.revision + 1,
      'favorite apply'
    );
    assertState(
      afterFavorite,
      {
        favorite: favoriteAction.value,
        sleep: initialA.sleep,
      },
      'client B favorite projection'
    );

    const favoriteReplayAck = parseSpaceAck(
      await transport.request(tokenA, '/v2/space/actions', {
        body: actionBody(source.contentVersion, favoriteAction),
        method: 'POST',
      }),
      favoriteAction,
      'duplicate',
      source.contentVersion
    );
    assertState(
      favoriteReplayAck,
      afterFavorite,
      'favorite duplicate acknowledgement'
    );
    const afterReplay = await bootstrap(
      transport,
      tokenB,
      bootstrapPath,
      selectedCardId,
      'client B after duplicate',
      source.contentVersion
    );
    assertRevision(
      afterReplay.revision,
      afterFavorite.revision,
      'favorite duplicate'
    );

    const conflictResponse = await transport.request(
      tokenB,
      '/v2/space/actions',
      {
        body: actionBody(source.contentVersion, {
          ...favoriteAction,
          value: initialA.favorite,
        }),
        method: 'POST',
      }
    );
    parseConflict(conflictResponse);
    const afterConflict = await bootstrap(
      transport,
      tokenA,
      bootstrapPath,
      selectedCardId,
      'client A after conflict',
      source.contentVersion
    );
    assertRevision(
      afterConflict.revision,
      afterReplay.revision,
      'conflict rejection'
    );
    assertState(afterConflict, afterFavorite, 'conflict projection');

    const sleepAction = createAction({
      actionId: `space_drill_sleep_${idFactory()}`,
      cardId: selectedCardId,
      clock,
      dimension: 'sleep',
      value: !initialA.sleep,
    });
    parseSpaceAck(
      await transport.request(tokenB, '/v2/space/actions', {
        body: actionBody(source.contentVersion, sleepAction),
        method: 'POST',
      }),
      sleepAction,
      'applied',
      source.contentVersion
    );
    const afterSleep = await bootstrap(
      transport,
      tokenA,
      bootstrapPath,
      selectedCardId,
      'client A after sleep',
      source.contentVersion
    );
    assertRevision(
      afterSleep.revision,
      afterConflict.revision + 1,
      'sleep apply'
    );
    assertState(
      afterSleep,
      {
        favorite: favoriteAction.value,
        sleep: sleepAction.value,
      },
      'independent dimension projection'
    );

    const favoriteRestore = createAction({
      actionId: `space_drill_favorite_restore_${idFactory()}`,
      cardId: selectedCardId,
      clock,
      dimension: 'favorite',
      value: initialA.favorite,
    });
    parseSpaceAck(
      await transport.request(tokenB, '/v2/space/actions', {
        body: actionBody(source.contentVersion, favoriteRestore),
        method: 'POST',
      }),
      favoriteRestore,
      'applied',
      source.contentVersion
    );
    const afterFavoriteRestore = await bootstrap(
      transport,
      tokenA,
      bootstrapPath,
      selectedCardId,
      'client A after favorite restore',
      source.contentVersion
    );
    assertRevision(
      afterFavoriteRestore.revision,
      afterSleep.revision + 1,
      'favorite restore'
    );
    assertState(
      afterFavoriteRestore,
      {
        favorite: initialA.favorite,
        sleep: sleepAction.value,
      },
      'favorite restore projection'
    );

    const sleepRestore = createAction({
      actionId: `space_drill_sleep_restore_${idFactory()}`,
      cardId: selectedCardId,
      clock,
      dimension: 'sleep',
      value: initialA.sleep,
    });
    parseSpaceAck(
      await transport.request(tokenA, '/v2/space/actions', {
        body: actionBody(source.contentVersion, sleepRestore),
        method: 'POST',
      }),
      sleepRestore,
      'applied',
      source.contentVersion
    );
    const finalB = await bootstrap(
      transport,
      tokenB,
      bootstrapPath,
      selectedCardId,
      'client B final bootstrap',
      source.contentVersion
    );
    assertRevision(
      finalB.revision,
      afterFavoriteRestore.revision + 1,
      'sleep restore'
    );
    assertState(finalB, initialA, 'final restored projection');

    return {
      scope: {
        card_id_sha256: digestString(selectedCardId),
        content_version: source.contentVersion,
        track: 'cet4',
      },
      clients: {
        distinct_sessions: true,
        secret_values_reported: false,
      },
      observations: {
        initial_revision: initialA.revision,
        favorite_applied_revision: afterFavorite.revision,
        favorite_replay_revision: afterReplay.revision,
        conflict_rejected_revision: afterConflict.revision,
        sleep_applied_revision: afterSleep.revision,
        favorite_restored_revision: afterFavoriteRestore.revision,
        final_restored_revision: finalB.revision,
        initial_state: stateSummary(initialA),
        toggled_state: stateSummary(afterSleep),
        final_state: stateSummary(finalB),
        favorite_action_sha256: digestCanonical(favoriteAction),
        sleep_action_sha256: digestCanonical(sleepAction),
        favorite_restore_action_sha256: digestCanonical(favoriteRestore),
        sleep_restore_action_sha256: digestCanonical(sleepRestore),
        favorite_apply_status: 'applied',
        favorite_replay_status: 'duplicate',
        conflict_status: 'space_action_id_conflict',
        sleep_apply_status: 'applied',
        favorite_restore_status: 'applied',
        sleep_restore_status: 'applied',
      },
      assertions: {
        same_account_distinct_clients: true,
        canonical_revision_incremented_once_per_new_action: true,
        duplicate_did_not_increment_revision: true,
        conflicting_replay_committed_nothing: true,
        favorite_and_sleep_merged_independently: true,
        both_clients_observed_canonical_state: true,
        initial_state_restored: true,
      },
    };
  } catch (error) {
    const cleanupRestored = await bestEffortRestore({
      bootstrapPath,
      cardId: selectedCardId,
      clock,
      contentVersion: source.contentVersion,
      idFactory,
      initial: initialA,
      token: tokenA,
      transport,
    });
    const message =
      error instanceof SpaceSyncDrillError
        ? error.message
        : 'unexpected space sync sequence failure';
    throw new SpaceSyncDrillError(
      `${message}; cleanup_restored=${cleanupRestored}`
    );
  }
}

async function bestEffortRestore({
  bootstrapPath,
  cardId,
  clock,
  contentVersion,
  idFactory,
  initial,
  token,
  transport,
}) {
  try {
    for (const [dimension, value] of [
      ['favorite', initial.favorite],
      ['sleep', initial.sleep],
    ]) {
      const action = createAction({
        actionId: `space_drill_recovery_${dimension}_${idFactory()}`,
        cardId,
        clock,
        dimension,
        value,
      });
      const response = await transport.request(token, '/v2/space/actions', {
        body: actionBody(contentVersion, action),
        method: 'POST',
      });
      parseSpaceAck(response, action, 'applied', contentVersion);
    }
    const restored = await bootstrap(
      transport,
      token,
      bootstrapPath,
      cardId,
      'cleanup bootstrap',
      contentVersion
    );
    return (
      restored.favorite === initial.favorite && restored.sleep === initial.sleep
    );
  } catch {
    return false;
  }
}

export function createRemoteSpaceTransport({ baseUrl, fetchImpl = fetch }) {
  const normalized = String(baseUrl ?? '').replace(/\/+$/, '');
  if (!/^https:\/\//.test(normalized)) {
    throw new SpaceSyncDrillError(
      'space drill requires an HTTPS API base URL.'
    );
  }
  return {
    async request(token, requestPath, { body = null, method = 'GET' } = {}) {
      let response;
      try {
        response = await fetchImpl(`${normalized}${requestPath}`, {
          ...(body === null ? {} : { body: JSON.stringify(body) }),
          headers: {
            Authorization: `Bearer ${token}`,
            'content-type': 'application/json',
            'x-softbook-client': 'mobile',
          },
          method,
        });
      } catch {
        throw new SpaceSyncDrillError('space drill remote request failed.');
      }
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new SpaceSyncDrillError(
          'space drill remote response was not JSON.'
        );
      }
      return { payload, status: response.status };
    },
  };
}

function parseCardSource(response) {
  requireStatus(response, 200, 'card source');
  const data = requireObject(response.payload?.data, 'card source data');
  if (
    data.track !== 'cet4' ||
    !SHA256_PATTERN.test(data.content_version ?? '')
  ) {
    throw new SpaceSyncDrillError('card source scope is invalid.');
  }
  if (!Array.isArray(data.card_records) || data.card_records.length !== 1180) {
    throw new SpaceSyncDrillError('card source must contain exact CET4 scope.');
  }
  const cardIds = data.card_records.map((card) => String(card?.card_id ?? ''));
  if (
    new Set(cardIds).size !== cardIds.length ||
    cardIds.some((id) => id.length === 0)
  ) {
    throw new SpaceSyncDrillError('card source card identities are invalid.');
  }
  return { cardIds, contentVersion: data.content_version };
}

async function bootstrap(
  transport,
  token,
  requestPath,
  cardId,
  label,
  expectedContentVersion
) {
  const result = parseBootstrap(
    await transport.request(token, requestPath),
    cardId,
    label
  );
  if (result.contentVersion !== expectedContentVersion) {
    throw new SpaceSyncDrillError(`${label} content version drifted.`);
  }
  return result;
}

function parseBootstrap(response, cardId, label) {
  requireStatus(response, 200, label);
  const data = requireObject(response.payload?.data, `${label} data`);
  if (data.schema_version !== 'bootstrap.v2' || data.track !== 'cet4') {
    throw new SpaceSyncDrillError(`${label} scope is invalid.`);
  }
  const contentVersion = data.content?.version;
  if (!SHA256_PATTERN.test(contentVersion ?? '')) {
    throw new SpaceSyncDrillError(`${label} content version is invalid.`);
  }
  const revision = data.component_revisions?.space?.state_revision;
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new SpaceSyncDrillError(`${label} space revision is invalid.`);
  }
  if (
    data.component_revisions?.learning?.space_revision !== revision ||
    data.component_revisions?.progress?.space_revision !== revision
  ) {
    throw new SpaceSyncDrillError(
      `${label} space revision dependencies drifted.`
    );
  }
  const states = data.space?.states;
  if (!Array.isArray(states)) {
    throw new SpaceSyncDrillError(`${label} space states are invalid.`);
  }
  const matching = states.filter((state) => state?.card_id === cardId);
  if (matching.length > 1) {
    throw new SpaceSyncDrillError(`${label} card state is duplicated.`);
  }
  const state = matching[0];
  if (
    state &&
    (typeof state.is_favorited !== 'boolean' ||
      typeof state.is_sleeping !== 'boolean')
  ) {
    throw new SpaceSyncDrillError(`${label} card state booleans are invalid.`);
  }
  return {
    contentVersion,
    favorite: state?.is_favorited === true,
    revision,
    sleep: state?.is_sleeping === true,
  };
}

function parseSpaceAck(
  response,
  action,
  expectedStatus,
  expectedContentVersion
) {
  requireStatus(response, 200, 'space action');
  const data = requireObject(response.payload?.data, 'space action data');
  if (
    data.schema_version !== 'space-actions-ack.v2' ||
    data.track !== 'cet4' ||
    data.content_version !== expectedContentVersion ||
    !Array.isArray(data.results) ||
    data.results.length !== 1 ||
    data.results[0]?.action_id !== action.action_id ||
    data.results[0]?.status !== expectedStatus
  ) {
    throw new SpaceSyncDrillError('space action acknowledgement is invalid.');
  }
  const states = data.space_state?.states;
  if (!Array.isArray(states)) {
    throw new SpaceSyncDrillError('space action projection is invalid.');
  }
  const matching = states.filter((state) => state?.card_id === action.card_id);
  if (matching.length !== 1) {
    throw new SpaceSyncDrillError('space action card projection is invalid.');
  }
  if (
    typeof matching[0].is_favorited !== 'boolean' ||
    typeof matching[0].is_sleeping !== 'boolean'
  ) {
    throw new SpaceSyncDrillError(
      'space action projection booleans are invalid.'
    );
  }
  return {
    favorite: matching[0].is_favorited === true,
    sleep: matching[0].is_sleeping === true,
  };
}

function parseConflict(response) {
  if (
    response?.status !== 409 ||
    response?.payload?.error?.code !== 'space_action_id_conflict'
  ) {
    throw new SpaceSyncDrillError(
      'conflicting replay must return space_action_id_conflict.'
    );
  }
}

function actionBody(contentVersion, action) {
  return {
    actions: [action],
    content_version: contentVersion,
    schema_version: 'space-actions.v2',
    track: 'cet4',
  };
}

function createAction({ actionId, cardId, clock, dimension, value }) {
  return {
    action_id: actionId,
    card_id: cardId,
    client_occurred_at: readTimestamp(clock, `${dimension} action`),
    dimension,
    value,
  };
}

function selectCardId(cardIds, requested) {
  const selected = requested ?? cardIds[0];
  if (!cardIds.includes(selected)) {
    throw new SpaceSyncDrillError(
      'requested drill card is not in CET4 content.'
    );
  }
  return selected;
}

function assertBootstrapParity(left, right, contentVersion) {
  if (
    left.contentVersion !== contentVersion ||
    right.contentVersion !== contentVersion ||
    left.revision !== right.revision ||
    left.favorite !== right.favorite ||
    left.sleep !== right.sleep
  ) {
    throw new SpaceSyncDrillError('initial client projections do not match.');
  }
}

function assertRevision(actual, expected, label) {
  if (actual !== expected) {
    throw new SpaceSyncDrillError(`${label} revision must equal ${expected}.`);
  }
}

function assertState(actual, expected, label) {
  if (
    actual?.favorite !== expected?.favorite ||
    actual?.sleep !== expected?.sleep
  ) {
    throw new SpaceSyncDrillError(`${label} state does not match.`);
  }
}

function stateSummary(value) {
  return { favorite: value.favorite, sleep: value.sleep };
}

function requireApplyReady({ operator, repository, writeSafety }) {
  if (!writeSafety.ok) {
    throw new SpaceSyncDrillError(writeSafety.errors.join('; '));
  }
  if (!SHA1_PATTERN.test(repository.head ?? '')) {
    throw new SpaceSyncDrillError(
      'apply requires a full repository commit SHA-1.'
    );
  }
  if (!OPERATOR_PATTERN.test(operator ?? '')) {
    throw new SpaceSyncDrillError('apply requires an identified operator.');
  }
}

function requireSecret(value, name) {
  if (typeof value !== 'string' || value.length < 16 || /\s/.test(value)) {
    throw new SpaceSyncDrillError(`${name} is required and invalid.`);
  }
  return value;
}

function requireStatus(response, expected, label) {
  if (response?.status !== expected) {
    throw new SpaceSyncDrillError(`${label} returned an unexpected status.`);
  }
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SpaceSyncDrillError(`${label} must be an object.`);
  }
  return value;
}

function dayKey(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new SpaceSyncDrillError('day-key clock is invalid.');
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
    completed_at: readTimestamp(clock, 'space drill completion'),
    operator: operator ?? null,
    started_at: startedAt,
  };
}

function readTimestamp(clock, label) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new SpaceSyncDrillError(`${label} clock is invalid.`);
  }
  return date.toISOString();
}

function digestCanonical(value) {
  return digestString(stableStringify(value));
}

function digestString(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function digestBytes(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
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
    throw new SpaceSyncDrillError(`${option} requires a value.`);
  }
  return value;
}

function printUsage() {
  console.log(`Usage:
  node infra/cloudbase/run-space-sync-drill.mjs --profile <delivery-profile.json> [--card-id <id>] [--apply --operator <id>]

Dry-run prints a write-safety plan. Apply requires two distinct session tokens in ${TOKEN_A_NAME} and ${TOKEN_B_NAME}, Node 22.13.0, clean exact main and a receiver closed-beta profile. The JSON report never includes tokens or phone numbers and remains gate_eligible=false.`);
}

async function main() {
  try {
    const options = parseSpaceSyncDrillArguments(process.argv.slice(2));
    if (options.help) printUsage();
    else
      console.log(
        JSON.stringify(await executeSpaceSyncDrill(options), null, 2)
      );
  } catch (error) {
    const message =
      error instanceof SpaceSyncDrillError
        ? error.message
        : 'unexpected space sync drill failure';
    console.error(`[space-sync-drill] ${message}`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
