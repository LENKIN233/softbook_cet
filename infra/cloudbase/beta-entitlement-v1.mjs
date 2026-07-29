import {createHash} from 'node:crypto';

export const BETA_ENTITLEMENT_COMMAND_SCHEMA = 'beta-entitlement-command.v1';
export const BETA_ENTITLEMENT_AUDIT_SCHEMA = 'beta-entitlement-audit.v1';
export const BETA_ENTITLEMENT_STATE_SCHEMA = 'beta-entitlement.v1';
export const BETA_ENTITLEMENT_HISTORY_LIMIT = 100;

const ACTIONS = new Set(['grant', 'revoke']);
const MEMBERSHIP_STAGES = new Set(['trial_available', 'trial', 'free', 'premium']);

export class BetaEntitlementError extends Error {}

export function validateBetaEntitlementCommand(input) {
  assertPlainObject(input, 'command');
  assertExactKeys(
    input,
    [
      'schema_version',
      'event_id',
      'action',
      'phone_number',
      'grant_id',
      'actor_id',
      'reason',
      'occurred_at',
    ],
    'command',
  );
  if (input.schema_version !== BETA_ENTITLEMENT_COMMAND_SCHEMA) {
    throw new BetaEntitlementError('unsupported beta entitlement command schema.');
  }
  if (!isIdentifier(input.event_id, 12, 96)) {
    throw new BetaEntitlementError('event_id is invalid.');
  }
  if (!ACTIONS.has(input.action)) {
    throw new BetaEntitlementError('action must be grant or revoke.');
  }
  if (!/^1\d{10}$/.test(input.phone_number ?? '')) {
    throw new BetaEntitlementError('phone_number is invalid.');
  }
  if (!isIdentifier(input.grant_id, 12, 96)) {
    throw new BetaEntitlementError('grant_id is invalid.');
  }
  if (!isIdentifier(input.actor_id, 3, 96)) {
    throw new BetaEntitlementError('actor_id is invalid.');
  }
  if (!isIdentifier(input.reason, 3, 96)) {
    throw new BetaEntitlementError('reason is invalid.');
  }
  if (!isCanonicalIsoTimestamp(input.occurred_at)) {
    throw new BetaEntitlementError('occurred_at must be a canonical UTC timestamp.');
  }
  return structuredClone(input);
}

export function planBetaEntitlementMutation(
  commandInput,
  currentDocumentInput,
  baseEntitlementInput,
) {
  const command = validateBetaEntitlementCommand(commandInput);
  const current = normalizeBetaEntitlementDocument(currentDocumentInput);
  if (
    current.phone_number !== null &&
    current.phone_number !== command.phone_number
  ) {
    throw new BetaEntitlementError('beta entitlement account identity is invalid.');
  }
  const baseEntitlement = cloneEntitlement(baseEntitlementInput ?? createInitialMembership());
  const commandHash = hashCanonical(command);
  const duplicate = current.audit.find(event => event.event_id === command.event_id);

  if (duplicate) {
    if (duplicate.command_sha256 !== commandHash) {
      throw new BetaEntitlementError('event_id is already bound to another command.');
    }
    return createPlan({
      changed: false,
      command,
      commandHash,
      document: current,
      event: duplicate,
      idempotent: true,
    });
  }

  if (current.audit.length >= BETA_ENTITLEMENT_HISTORY_LIMIT) {
    throw new BetaEntitlementError('beta entitlement audit history limit reached.');
  }

  return command.action === 'grant'
    ? planGrant(command, commandHash, current, baseEntitlement)
    : planRevoke(command, commandHash, current, baseEntitlement);
}

export function publicBetaEntitlementPlan(plan) {
  return {
    schema_version: 'beta-entitlement-plan.v1',
    action: plan.command.action,
    account_fingerprint: accountFingerprint(plan.command.phone_number),
    actor_id: plan.command.actor_id,
    changed: plan.changed,
    event_id: plan.command.event_id,
    grant_id: plan.command.grant_id,
    idempotent: plan.idempotent,
    previous_stage: plan.previousStage,
    resulting_stage: plan.resultingStage,
  };
}

export function verifyAppliedBetaEntitlement(plan, storedDocument) {
  const stored = normalizeBetaEntitlementDocument(storedDocument);
  const event = stored.audit.find(candidate => candidate.event_id === plan.command.event_id);
  if (!event || event.command_sha256 !== plan.commandHash) {
    throw new BetaEntitlementError('beta entitlement write could not be verified.');
  }
  if (stableStringify(stored) !== stableStringify(plan.document)) {
    throw new BetaEntitlementError('stored beta entitlement differs from the planned document.');
  }
  return publicBetaEntitlementPlan(plan);
}

export function applyBetaEntitlementToMembership(baseEntitlementInput, betaDocumentInput) {
  const base = cloneEntitlement(baseEntitlementInput ?? createInitialMembership());
  const beta = normalizeBetaEntitlementDocument(betaDocumentInput);
  if (beta.active_grant === null) return base;
  return {
    ...base,
    last_experience_ended_by: null,
    recovery_prompt_visible: false,
    stage: 'premium',
  };
}

function planGrant(command, commandHash, current, baseEntitlement) {
  if (current.active_grant !== null) {
    throw new BetaEntitlementError('an active beta entitlement already exists.');
  }
  const event = createAuditEvent({
    command,
    commandHash,
    previousStage: baseEntitlement.stage,
    resultingStage: 'premium',
  });
  const document = {
    ...current,
    active_grant: {
      schema_version: BETA_ENTITLEMENT_STATE_SCHEMA,
      actor_id: command.actor_id,
      command_sha256: commandHash,
      grant_event_id: command.event_id,
      grant_id: command.grant_id,
      granted_at: command.occurred_at,
      reason: command.reason,
    },
    audit: [...current.audit, event],
    phone_number: command.phone_number,
    revision: current.revision + 1,
    updated_at: command.occurred_at,
  };
  return createPlan({changed: true, command, commandHash, document, event});
}

function planRevoke(command, commandHash, current, baseEntitlement) {
  const active = current.active_grant;
  if (active === null || active.grant_id !== command.grant_id) {
    throw new BetaEntitlementError('revoke requires the matching active beta grant.');
  }
  const event = createAuditEvent({
    command,
    commandHash,
    previousStage: 'premium',
    resultingStage: baseEntitlement.stage,
  });
  const document = {
    ...current,
    active_grant: null,
    audit: [...current.audit, event],
    phone_number: command.phone_number,
    revision: current.revision + 1,
    updated_at: command.occurred_at,
  };
  return createPlan({changed: true, command, commandHash, document, event});
}

function createAuditEvent({command, commandHash, previousStage, resultingStage}) {
  return {
    schema_version: BETA_ENTITLEMENT_AUDIT_SCHEMA,
    action: command.action,
    actor_id: command.actor_id,
    command_sha256: commandHash,
    event_id: command.event_id,
    grant_id: command.grant_id,
    occurred_at: command.occurred_at,
    previous_stage: previousStage,
    reason: command.reason,
    resulting_stage: resultingStage,
  };
}

function createPlan({changed, command, commandHash, document, event, idempotent = false}) {
  const normalizedDocument = changed
    ? normalizeBetaEntitlementDocument(document)
    : document;
  return {
    changed,
    command,
    commandHash,
    document: normalizedDocument,
    idempotent,
    previousStage: event.previous_stage,
    resultingStage: event.resulting_stage,
  };
}

function normalizeBetaEntitlementDocument(input) {
  if (input === null || input === undefined) {
    return {
      active_grant: null,
      audit: [],
      phone_number: null,
      revision: 0,
      updated_at: null,
    };
  }
  assertPlainObject(input, 'beta entitlement document');
  const document = structuredClone(input);
  delete document._id;
  const audit = document.audit ?? [];
  if (!Array.isArray(audit) || audit.some(event => !isStoredAuditEvent(event))) {
    throw new BetaEntitlementError('beta entitlement audit is invalid.');
  }
  const revision = document.revision ?? 0;
  if (!Number.isSafeInteger(revision) || revision < 0 || revision !== audit.length) {
    throw new BetaEntitlementError('beta entitlement revision is invalid.');
  }
  const active = document.active_grant ?? null;
  if (active !== null && !isActiveBetaEntitlement(active)) {
    throw new BetaEntitlementError('active beta grant is invalid.');
  }
  if (
    !/^1\d{10}$/.test(document.phone_number ?? '') ||
    revision === 0 ||
    document.updated_at !== audit.at(-1)?.occurred_at
  ) {
    throw new BetaEntitlementError('beta entitlement document is invalid.');
  }
  let openGrantId = null;
  let previousTimestamp = null;
  for (const event of audit) {
    if (
      (previousTimestamp !== null && event.occurred_at < previousTimestamp) ||
      (event.action === 'grant' &&
        (openGrantId !== null || event.resulting_stage !== 'premium')) ||
      (event.action === 'revoke' &&
        (openGrantId !== event.grant_id || event.previous_stage !== 'premium'))
    ) {
      throw new BetaEntitlementError('beta entitlement audit sequence is invalid.');
    }
    openGrantId = event.action === 'grant' ? event.grant_id : null;
    previousTimestamp = event.occurred_at;
  }
  const latest = audit.at(-1);
  if (
    (active === null && (openGrantId !== null || latest.action !== 'revoke')) ||
    (active !== null &&
      (latest.action !== 'grant' ||
        openGrantId !== latest.grant_id ||
        active.actor_id !== latest.actor_id ||
        active.command_sha256 !== latest.command_sha256 ||
        active.grant_event_id !== latest.event_id ||
        active.grant_id !== latest.grant_id ||
        active.granted_at !== latest.occurred_at ||
        active.reason !== latest.reason))
  ) {
    throw new BetaEntitlementError('active beta grant does not match its audit sequence.');
  }
  return {
    ...document,
    active_grant: active,
    audit,
    phone_number: document.phone_number ?? null,
    revision,
    updated_at: document.updated_at ?? null,
  };
}

function cloneEntitlement(input) {
  assertPlainObject(input, 'membership entitlement');
  const value = {
    counted_entry_count: input.counted_entry_count,
    last_experience_ended_by: input.last_experience_ended_by,
    recovery_prompt_visible: input.recovery_prompt_visible,
    stage: input.stage,
    trial_duration_days: input.trial_duration_days,
    trial_started_at_entry_count: input.trial_started_at_entry_count,
  };
  if (
    !Number.isSafeInteger(value.counted_entry_count) ||
    value.counted_entry_count < 0 ||
    !MEMBERSHIP_STAGES.has(value.stage) ||
    !Number.isSafeInteger(value.trial_duration_days) ||
    value.trial_duration_days < 3 ||
    value.trial_duration_days > 7 ||
    typeof value.recovery_prompt_visible !== 'boolean' ||
    ![null, 'trial', 'premium'].includes(value.last_experience_ended_by) ||
    !(
      value.trial_started_at_entry_count === null ||
      (Number.isSafeInteger(value.trial_started_at_entry_count) &&
        value.trial_started_at_entry_count > 0)
    )
  ) {
    throw new BetaEntitlementError('membership entitlement is invalid.');
  }
  return value;
}

function createInitialMembership() {
  return {
    counted_entry_count: 0,
    last_experience_ended_by: null,
    recovery_prompt_visible: false,
    stage: 'trial_available',
    trial_duration_days: 5,
    trial_started_at_entry_count: null,
  };
}

function isStoredAuditEvent(value) {
  return (
    value &&
    value.schema_version === BETA_ENTITLEMENT_AUDIT_SCHEMA &&
    ACTIONS.has(value.action) &&
    isIdentifier(value.actor_id, 3, 96) &&
    /^sha256:[a-f0-9]{64}$/.test(value.command_sha256 ?? '') &&
    isIdentifier(value.event_id, 12, 96) &&
    isIdentifier(value.grant_id, 12, 96) &&
    isCanonicalIsoTimestamp(value.occurred_at) &&
    MEMBERSHIP_STAGES.has(value.previous_stage) &&
    isIdentifier(value.reason, 3, 96) &&
    MEMBERSHIP_STAGES.has(value.resulting_stage)
  );
}

function isActiveBetaEntitlement(value) {
  return (
    value &&
    value.schema_version === BETA_ENTITLEMENT_STATE_SCHEMA &&
    isIdentifier(value.actor_id, 3, 96) &&
    /^sha256:[a-f0-9]{64}$/.test(value.command_sha256 ?? '') &&
    isIdentifier(value.grant_event_id, 12, 96) &&
    isIdentifier(value.grant_id, 12, 96) &&
    isCanonicalIsoTimestamp(value.granted_at) &&
    isIdentifier(value.reason, 3, 96)
  );
}

function accountFingerprint(phoneNumber) {
  return `sha256:${createHash('sha256').update(phoneNumber).digest('hex').slice(0, 16)}`;
}

function hashCanonical(value) {
  return `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BetaEntitlementError(`${label} must be an object.`);
  }
}

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    throw new BetaEntitlementError(`${label} fields are invalid.`);
  }
}

function isIdentifier(value, minimumLength, maximumLength) {
  return (
    typeof value === 'string' &&
    value.length >= minimumLength &&
    value.length <= maximumLength &&
    /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(value)
  );
}

function isCanonicalIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

export const betaEntitlementInternals = {
  accountFingerprint,
  hashCanonical,
  normalizeBetaEntitlementDocument,
  stableStringify,
};
