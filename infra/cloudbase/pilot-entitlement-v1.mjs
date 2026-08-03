import {createHash} from 'node:crypto';

import {validatePilotEntitlementCommand} from './controlled-pilot-v1.mjs';

export const PILOT_ENTITLEMENT_AUDIT_SCHEMA = 'pilot-entitlement-audit.v1';
export const PILOT_ENTITLEMENT_STATE_SCHEMA = 'pilot-entitlement.v1';
export const PILOT_ENTITLEMENT_HISTORY_LIMIT = 100;

const ACTIONS = new Set(['grant', 'revoke']);
const BASE_MEMBERSHIP_STAGES = new Set([
  'trial_available',
  'trial',
  'free',
  'premium',
]);
const EFFECTIVE_MEMBERSHIP_STAGES = new Set([
  ...BASE_MEMBERSHIP_STAGES,
  'pilot_premium',
]);

export class PilotEntitlementError extends Error {}

export function planPilotEntitlementMutation(
  commandInput,
  currentDocumentInput,
  baseEntitlementInput,
) {
  let command;
  try {
    command = validatePilotEntitlementCommand(commandInput);
  } catch (error) {
    throw new PilotEntitlementError(error.message);
  }
  const current = normalizePilotEntitlementDocument(currentDocumentInput);
  if (
    current.phone_number !== null &&
    current.phone_number !== command.phone_number
  ) {
    throw new PilotEntitlementError(
      'pilot entitlement account identity is invalid.',
    );
  }
  const baseEntitlement = cloneBaseEntitlement(
    baseEntitlementInput ?? createInitialMembership(),
  );
  const commandHash = hashCanonical(command);
  const duplicate = current.audit.find(
    event => event.event_id === command.event_id,
  );

  if (duplicate) {
    if (duplicate.command_sha256 !== commandHash) {
      throw new PilotEntitlementError(
        'event_id is already bound to another command.',
      );
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
  if (current.audit.length >= PILOT_ENTITLEMENT_HISTORY_LIMIT) {
    throw new PilotEntitlementError(
      'pilot entitlement audit history limit reached.',
    );
  }

  return command.action === 'grant'
    ? planGrant(command, commandHash, current, baseEntitlement)
    : planRevoke(command, commandHash, current, baseEntitlement);
}

export function publicPilotEntitlementPlan(plan) {
  return {
    schema_version: 'pilot-entitlement-plan.v1',
    account_fingerprint: accountFingerprint(plan.command.phone_number),
    action: plan.command.action,
    actor: plan.command.actor,
    changed: plan.changed,
    event_id: plan.command.event_id,
    idempotent: plan.idempotent,
    pilot_id: plan.command.pilot_id,
    previous_stage: plan.previousStage,
    resulting_stage: plan.resultingStage,
  };
}

export function verifyAppliedPilotEntitlement(plan, storedDocument) {
  const stored = normalizePilotEntitlementDocument(storedDocument);
  const event = stored.audit.find(
    candidate => candidate.event_id === plan.command.event_id,
  );
  if (!event || event.command_sha256 !== plan.commandHash) {
    throw new PilotEntitlementError(
      'pilot entitlement write could not be verified.',
    );
  }
  if (stableStringify(stored) !== stableStringify(plan.document)) {
    throw new PilotEntitlementError(
      'stored pilot entitlement differs from the planned document.',
    );
  }
  return publicPilotEntitlementPlan(plan);
}

export function applyPilotEntitlementToMembership(
  baseEntitlementInput,
  pilotDocumentInput,
) {
  const base = cloneBaseEntitlement(
    baseEntitlementInput ?? createInitialMembership(),
  );
  const pilot = normalizePilotEntitlementDocument(pilotDocumentInput);
  if (pilot.active_grant === null) return base;
  return {
    ...base,
    last_experience_ended_by: null,
    recovery_prompt_visible: false,
    stage: 'pilot_premium',
  };
}

function planGrant(command, commandHash, current, baseEntitlement) {
  if (current.active_grant !== null) {
    throw new PilotEntitlementError(
      'an active pilot entitlement already exists.',
    );
  }
  assertCommandStages(command, baseEntitlement.stage, 'pilot_premium');
  const event = createAuditEvent(command, commandHash);
  const document = {
    ...current,
    active_grant: {
      schema_version: PILOT_ENTITLEMENT_STATE_SCHEMA,
      actor_id: command.actor,
      command_sha256: commandHash,
      grant_event_id: command.event_id,
      granted_at: command.occurred_at,
      pilot_id: command.pilot_id,
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
  if (active === null || active.pilot_id !== command.pilot_id) {
    throw new PilotEntitlementError(
      'revoke requires the matching active pilot grant.',
    );
  }
  assertCommandStages(command, 'pilot_premium', baseEntitlement.stage);
  const event = createAuditEvent(command, commandHash);
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

function assertCommandStages(command, previousStage, resultingStage) {
  if (
    command.previous_stage !== previousStage ||
    command.resulting_stage !== resultingStage
  ) {
    throw new PilotEntitlementError(
      `command stages do not match server state (${previousStage} -> ${resultingStage}).`,
    );
  }
}

function createAuditEvent(command, commandHash) {
  return {
    schema_version: PILOT_ENTITLEMENT_AUDIT_SCHEMA,
    action: command.action,
    actor_id: command.actor,
    command_sha256: commandHash,
    event_id: command.event_id,
    occurred_at: command.occurred_at,
    pilot_id: command.pilot_id,
    previous_stage: command.previous_stage,
    reason: command.reason,
    resulting_stage: command.resulting_stage,
  };
}

function createPlan({
  changed,
  command,
  commandHash,
  document,
  event,
  idempotent = false,
}) {
  return {
    changed,
    command,
    commandHash,
    document: changed ? normalizePilotEntitlementDocument(document) : document,
    idempotent,
    previousStage: event.previous_stage,
    resultingStage: event.resulting_stage,
  };
}

function normalizePilotEntitlementDocument(input) {
  if (input === null || input === undefined) {
    return {
      active_grant: null,
      audit: [],
      phone_number: null,
      revision: 0,
      updated_at: null,
    };
  }
  assertPlainObject(input, 'pilot entitlement document');
  const document = structuredClone(input);
  delete document._id;
  const audit = document.audit ?? [];
  const revision = document.revision ?? 0;
  const active = document.active_grant ?? null;
  if (!Array.isArray(audit) || audit.some(event => !isStoredAuditEvent(event))) {
    throw new PilotEntitlementError('pilot entitlement audit is invalid.');
  }
  if (!Number.isSafeInteger(revision) || revision < 1 || revision !== audit.length) {
    throw new PilotEntitlementError('pilot entitlement revision is invalid.');
  }
  if (active !== null && !isActivePilotEntitlement(active)) {
    throw new PilotEntitlementError('active pilot grant is invalid.');
  }
  if (
    !/^1\d{10}$/.test(document.phone_number ?? '') ||
    document.updated_at !== audit.at(-1)?.occurred_at
  ) {
    throw new PilotEntitlementError('pilot entitlement document is invalid.');
  }
  let openPilotId = null;
  let previousTimestamp = null;
  for (const event of audit) {
    if (
      (previousTimestamp !== null && event.occurred_at < previousTimestamp) ||
      (event.action === 'grant' &&
        (openPilotId !== null ||
          event.resulting_stage !== 'pilot_premium')) ||
      (event.action === 'revoke' &&
        (openPilotId !== event.pilot_id ||
          event.previous_stage !== 'pilot_premium' ||
          event.resulting_stage === 'pilot_premium'))
    ) {
      throw new PilotEntitlementError(
        'pilot entitlement audit sequence is invalid.',
      );
    }
    openPilotId = event.action === 'grant' ? event.pilot_id : null;
    previousTimestamp = event.occurred_at;
  }
  const latest = audit.at(-1);
  if (
    (active === null && (openPilotId !== null || latest.action !== 'revoke')) ||
    (active !== null &&
      (latest.action !== 'grant' ||
        openPilotId !== latest.pilot_id ||
        active.actor_id !== latest.actor_id ||
        active.command_sha256 !== latest.command_sha256 ||
        active.grant_event_id !== latest.event_id ||
        active.granted_at !== latest.occurred_at ||
        active.pilot_id !== latest.pilot_id ||
        active.reason !== latest.reason))
  ) {
    throw new PilotEntitlementError(
      'active pilot grant does not match its audit sequence.',
    );
  }
  return {
    ...document,
    active_grant: active,
    audit,
    phone_number: document.phone_number,
    revision,
    updated_at: document.updated_at,
  };
}

function cloneBaseEntitlement(input) {
  assertPlainObject(input, 'membership entitlement');
  const value = {
    counted_entry_count: input.counted_entry_count,
    last_experience_ended_by: input.last_experience_ended_by,
    recovery_prompt_visible: input.recovery_prompt_visible,
    stage: input.stage,
    trial_duration_days: input.trial_duration_days,
    trial_expires_at: input.trial_expires_at ?? null,
    trial_started_at: input.trial_started_at ?? null,
    trial_started_at_entry_count: input.trial_started_at_entry_count,
  };
  if (
    !Number.isSafeInteger(value.counted_entry_count) ||
    value.counted_entry_count < 0 ||
    !BASE_MEMBERSHIP_STAGES.has(value.stage) ||
    !Number.isSafeInteger(value.trial_duration_days) ||
    value.trial_duration_days < 3 ||
    value.trial_duration_days > 7 ||
    typeof value.recovery_prompt_visible !== 'boolean' ||
    ![null, 'trial', 'premium'].includes(value.last_experience_ended_by) ||
    !(
      value.trial_started_at_entry_count === null ||
      (Number.isSafeInteger(value.trial_started_at_entry_count) &&
        value.trial_started_at_entry_count > 0)
    ) ||
    !isOptionalCanonicalIsoTimestamp(value.trial_started_at) ||
    !isOptionalCanonicalIsoTimestamp(value.trial_expires_at) ||
    (value.trial_started_at === null) !== (value.trial_expires_at === null)
  ) {
    throw new PilotEntitlementError('membership entitlement is invalid.');
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
    trial_expires_at: null,
    trial_started_at: null,
    trial_started_at_entry_count: null,
  };
}

function isStoredAuditEvent(value) {
  return (
    value &&
    value.schema_version === PILOT_ENTITLEMENT_AUDIT_SCHEMA &&
    ACTIONS.has(value.action) &&
    isIdentifier(value.actor_id, 1, 128) &&
    /^sha256:[a-f0-9]{64}$/.test(value.command_sha256 ?? '') &&
    isIdentifier(value.event_id, 1, 128) &&
    isCanonicalIsoTimestamp(value.occurred_at) &&
    isIdentifier(value.pilot_id, 1, 128) &&
    EFFECTIVE_MEMBERSHIP_STAGES.has(value.previous_stage) &&
    typeof value.reason === 'string' &&
    value.reason.length > 0 &&
    EFFECTIVE_MEMBERSHIP_STAGES.has(value.resulting_stage)
  );
}

function isActivePilotEntitlement(value) {
  return (
    value &&
    value.schema_version === PILOT_ENTITLEMENT_STATE_SCHEMA &&
    isIdentifier(value.actor_id, 1, 128) &&
    /^sha256:[a-f0-9]{64}$/.test(value.command_sha256 ?? '') &&
    isIdentifier(value.grant_event_id, 1, 128) &&
    isCanonicalIsoTimestamp(value.granted_at) &&
    isIdentifier(value.pilot_id, 1, 128) &&
    typeof value.reason === 'string' &&
    value.reason.length > 0
  );
}

function accountFingerprint(phoneNumber) {
  return `sha256:${createHash('sha256')
    .update(phoneNumber)
    .digest('hex')
    .slice(0, 16)}`;
}

function hashCanonical(value) {
  return `sha256:${createHash('sha256')
    .update(stableStringify(value))
    .digest('hex')}`;
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
    throw new PilotEntitlementError(`${label} must be an object.`);
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

function isOptionalCanonicalIsoTimestamp(value) {
  return value === null || isCanonicalIsoTimestamp(value);
}

export const pilotEntitlementInternals = {
  accountFingerprint,
  hashCanonical,
  normalizePilotEntitlementDocument,
  stableStringify,
};
