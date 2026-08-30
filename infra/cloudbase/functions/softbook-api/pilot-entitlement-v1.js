const {createHash} = require('node:crypto');

const PILOT_ENTITLEMENT_AUDIT_SCHEMA = 'pilot-entitlement-audit.v1';
const PILOT_ENTITLEMENT_STATE_SCHEMA = 'pilot-entitlement.v1';
const PILOT_ENTITLEMENT_HISTORY_LIMIT = 100;
const COMMAND_KEYS = [
  'action',
  'actor',
  'event_id',
  'expected_account_instance_id',
  'occurred_at',
  'phone_number',
  'pilot_id',
  'previous_stage',
  'reason',
  'resulting_stage',
  'schema_version',
];
const BASE_MEMBERSHIP_STAGES = new Set([
  'trial_available',
  'trial',
  'free',
  'premium',
]);

class PilotEntitlementError extends Error {}

function validatePilotEntitlementCommand(input) {
  assertPlainObject(input, 'pilot entitlement command');
  const actualKeys = Object.keys(input).sort();
  if (
    actualKeys.length !== COMMAND_KEYS.length ||
    actualKeys.some((key, index) => key !== COMMAND_KEYS[index])
  ) {
    throw new PilotEntitlementError('pilot entitlement command fields are invalid.');
  }
  if (
    input.schema_version !== 'pilot-entitlement-command.v1' ||
    !isIdentifier(input.event_id) ||
    !/^account_[A-Za-z0-9_-]{24,128}$/.test(
      input.expected_account_instance_id ?? '',
    ) ||
    !isIdentifier(input.pilot_id) ||
    !/^1\d{10}$/.test(input.phone_number) ||
    !['grant', 'revoke'].includes(input.action) ||
    !isPrivacySafePublicText(input.actor) ||
    !isTrimmedNonEmptyString(input.reason) ||
    !isCanonicalIsoTimestamp(input.occurred_at) ||
    !isMembershipStage(input.previous_stage) ||
    !isMembershipStage(input.resulting_stage) ||
    (input.action === 'grant' && input.resulting_stage !== 'pilot_premium') ||
    (input.action === 'revoke' && input.resulting_stage === 'pilot_premium')
  ) {
    throw new PilotEntitlementError('pilot entitlement command is invalid.');
  }
  return {
    ...structuredClone(input),
    occurred_at: new Date(input.occurred_at).toISOString(),
  };
}

function planPilotEntitlementMutation(commandInput, currentDocumentInput, baseEntitlementInput) {
  const command = validatePilotEntitlementCommand(commandInput);
  const current = normalizePilotEntitlementDocument(currentDocumentInput);
  const baseEntitlement = resolveBaseEntitlementAt(baseEntitlementInput, command.occurred_at);
  const commandHash = hashCanonical(command);
  const duplicate = current.audit.find(event => event.event_id === command.event_id);

  if (duplicate) {
    if (duplicate.command_sha256 !== commandHash) {
      throw new PilotEntitlementError(
        'event_id is already bound to another pilot entitlement command.',
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
    throw new PilotEntitlementError('pilot entitlement audit history limit reached.');
  }
  if (current.active_grant !== null && current.pilot_id !== command.pilot_id) {
    throw new PilotEntitlementError('pilot entitlement history is bound to another pilot.');
  }
  if (current.phone_number !== null && current.phone_number !== command.phone_number) {
    throw new PilotEntitlementError('pilot entitlement account identity is invalid.');
  }

  return command.action === 'grant'
    ? planGrant(command, commandHash, current, baseEntitlement)
    : planRevoke(command, commandHash, current, baseEntitlement);
}

function publicPilotEntitlementPlan(plan) {
  const command = validatePilotEntitlementCommand(plan.command);
  return {
    schema_version: 'pilot-entitlement-plan.v2',
    action: command.action,
    actor: command.actor,
    changed: plan.changed,
    event_id: command.event_id,
    idempotent: plan.idempotent,
    pilot_id: command.pilot_id,
    previous_stage: plan.previousStage,
    resulting_stage: plan.resultingStage,
  };
}

function verifyAppliedPilotEntitlement(plan, storedDocument) {
  const stored = normalizePilotEntitlementDocument(storedDocument);
  const event = stored.audit.find(candidate => candidate.event_id === plan.command.event_id);
  if (!event || event.command_sha256 !== plan.commandHash) {
    throw new PilotEntitlementError('pilot entitlement write could not be verified.');
  }
  if (stableStringify(stored) !== stableStringify(plan.document)) {
    throw new PilotEntitlementError('stored pilot entitlement differs from the planned document.');
  }
  return publicPilotEntitlementPlan(plan);
}

function applyPilotEntitlementToMembership(baseEntitlementInput, pilotDocumentInput, expectedPilotId) {
  const base = cloneBaseEntitlement(baseEntitlementInput);
  if (pilotDocumentInput === null || pilotDocumentInput === undefined) return base;
  const pilot = normalizePilotEntitlementDocument(pilotDocumentInput);
  if (pilot.active_grant === null) return base;
  if (typeof expectedPilotId !== 'string' || pilot.pilot_id !== expectedPilotId) {
    throw new PilotEntitlementError('pilot entitlement does not match the active runtime pilot.');
  }
  return {...base, last_experience_ended_by: null, recovery_prompt_visible: false, stage: 'premium'};
}

function planGrant(command, commandHash, current, baseEntitlement) {
  if (current.active_grant !== null) {
    throw new PilotEntitlementError('an active pilot entitlement already exists.');
  }
  if (command.previous_stage !== baseEntitlement.stage || command.resulting_stage !== 'pilot_premium') {
    throw new PilotEntitlementError('grant stages do not match the canonical base membership.');
  }
  const event = createAuditEvent(command, commandHash);
  const document = {
    active_grant: {
      schema_version: PILOT_ENTITLEMENT_STATE_SCHEMA,
      actor: command.actor,
      command_sha256: commandHash,
      grant_event_id: command.event_id,
      granted_at: command.occurred_at,
      pilot_id: command.pilot_id,
      reason: command.reason,
    },
    audit: [...current.audit, event],
    phone_number: command.phone_number,
    pilot_id: command.pilot_id,
    revision: current.revision + 1,
    updated_at: command.occurred_at,
  };
  return createPlan({changed: true, command, commandHash, document, event});
}

function planRevoke(command, commandHash, current, baseEntitlement) {
  const active = current.active_grant;
  if (active === null || active.pilot_id !== command.pilot_id) {
    throw new PilotEntitlementError('revoke requires an active grant for the exact pilot.');
  }
  if (command.previous_stage !== 'pilot_premium' || command.resulting_stage !== baseEntitlement.stage) {
    throw new PilotEntitlementError('revoke stages do not restore the canonical base membership.');
  }
  const event = createAuditEvent(command, commandHash);
  const document = {
    ...current,
    active_grant: null,
    audit: [...current.audit, event],
    revision: current.revision + 1,
    updated_at: command.occurred_at,
  };
  return createPlan({changed: true, command, commandHash, document, event});
}

function createAuditEvent(command, commandHash) {
  return {
    schema_version: PILOT_ENTITLEMENT_AUDIT_SCHEMA,
    action: command.action,
    actor: command.actor,
    command_sha256: commandHash,
    event_id: command.event_id,
    expected_account_instance_id: command.expected_account_instance_id,
    occurred_at: command.occurred_at,
    pilot_id: command.pilot_id,
    previous_stage: command.previous_stage,
    reason: command.reason,
    resulting_stage: command.resulting_stage,
  };
}

function createPlan({changed, command, commandHash, document, event, idempotent = false}) {
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
    return {active_grant: null, audit: [], phone_number: null, pilot_id: null, revision: 0, updated_at: null};
  }
  assertPlainObject(input, 'pilot entitlement document');
  const document = structuredClone(input);
  delete document._id;
  const documentKeys = Object.keys(document).sort();
  const expectedDocumentKeys = [
    'active_grant',
    'audit',
    'phone_number',
    'pilot_id',
    'revision',
    'updated_at',
  ];
  const audit = document.audit ?? [];
  const revision = document.revision ?? 0;
  const active = document.active_grant ?? null;
  if (
    documentKeys.length !== expectedDocumentKeys.length ||
    documentKeys.some((key, index) => key !== expectedDocumentKeys[index]) ||
    !Array.isArray(audit) ||
    audit.some(event => !isStoredAuditEvent(event)) ||
    !Number.isSafeInteger(revision) ||
    revision <= 0 ||
    revision !== audit.length ||
    !isIdentifier(document.pilot_id) ||
    !/^1\d{10}$/.test(document.phone_number ?? '') ||
    document.updated_at !== audit.at(-1)?.occurred_at ||
    (active !== null && !isActivePilotEntitlement(active))
  ) {
    throw new PilotEntitlementError('pilot entitlement document is invalid.');
  }

  let activeGrantEventId = null;
  let activePilotId = null;
  let previousTimestamp = null;
  const eventIds = new Set();
  for (const event of audit) {
    const occurredAt = Date.parse(event.occurred_at);
    const reconstructedCommand = validatePilotEntitlementCommand({
      schema_version: 'pilot-entitlement-command.v1',
      event_id: event.event_id,
      expected_account_instance_id: event.expected_account_instance_id,
      pilot_id: event.pilot_id,
      phone_number: document.phone_number,
      action: event.action,
      actor: event.actor,
      reason: event.reason,
      occurred_at: event.occurred_at,
      previous_stage: event.previous_stage,
      resulting_stage: event.resulting_stage,
    });
    if (
      eventIds.has(event.event_id) ||
      event.command_sha256 !== hashCanonical(reconstructedCommand) ||
      (previousTimestamp !== null && occurredAt < previousTimestamp) ||
      (event.action === 'grant' &&
        (activeGrantEventId !== null || event.previous_stage === 'pilot_premium' || event.resulting_stage !== 'pilot_premium')) ||
      (event.action === 'revoke' &&
        (activeGrantEventId === null || activePilotId !== event.pilot_id || event.previous_stage !== 'pilot_premium' || event.resulting_stage === 'pilot_premium'))
    ) {
      throw new PilotEntitlementError('pilot entitlement audit sequence is invalid.');
    }
    eventIds.add(event.event_id);
    activeGrantEventId = event.action === 'grant' ? event.event_id : null;
    activePilotId = event.action === 'grant' ? event.pilot_id : null;
    previousTimestamp = occurredAt;
  }

  const latest = audit.at(-1);
  if (document.pilot_id !== latest.pilot_id) {
    throw new PilotEntitlementError('pilot entitlement latest pilot binding is invalid.');
  }
  if (
    (active === null && (activeGrantEventId !== null || latest.action !== 'revoke')) ||
    (active !== null &&
      (latest.action !== 'grant' || activeGrantEventId !== latest.event_id || active.actor !== latest.actor ||
        active.command_sha256 !== latest.command_sha256 || active.grant_event_id !== latest.event_id ||
        active.granted_at !== latest.occurred_at || active.pilot_id !== latest.pilot_id || active.reason !== latest.reason))
  ) {
    throw new PilotEntitlementError('active pilot grant does not match its audit sequence.');
  }

  return {active_grant: active, audit, phone_number: document.phone_number, pilot_id: document.pilot_id, revision, updated_at: document.updated_at};
}

function cloneBaseEntitlement(input) {
  assertPlainObject(input, 'membership entitlement');
  if (!BASE_MEMBERSHIP_STAGES.has(input.stage)) {
    throw new PilotEntitlementError('base membership stage is invalid.');
  }
  return structuredClone(input);
}

function resolveBaseEntitlementAt(input, occurredAt) {
  const base = cloneBaseEntitlement(input);
  if (base.stage === 'trial' && isCanonicalIsoTimestamp(base.trial_expires_at) && Date.parse(occurredAt) >= Date.parse(base.trial_expires_at)) {
    return {...base, last_experience_ended_by: 'trial', recovery_prompt_visible: true, stage: 'free'};
  }
  return base;
}

function isStoredAuditEvent(value) {
  const keys = value && typeof value === 'object' ? Object.keys(value).sort() : [];
  const expectedKeys = [
    'action', 'actor', 'command_sha256', 'event_id', 'expected_account_instance_id', 'occurred_at', 'pilot_id',
    'previous_stage', 'reason', 'resulting_stage', 'schema_version',
  ];
  return value && keys.length === expectedKeys.length &&
    keys.every((key, index) => key === expectedKeys[index]) &&
    value.schema_version === PILOT_ENTITLEMENT_AUDIT_SCHEMA &&
    ['grant', 'revoke'].includes(value.action) && isPrivacySafePublicText(value.actor) &&
    /^sha256:[a-f0-9]{64}$/.test(value.command_sha256 ?? '') && isIdentifier(value.event_id) &&
    /^account_[A-Za-z0-9_-]{24,128}$/.test(value.expected_account_instance_id ?? '') &&
    isCanonicalIsoTimestamp(value.occurred_at) && isIdentifier(value.pilot_id) &&
    isMembershipStage(value.previous_stage) && isTrimmedNonEmptyString(value.reason) &&
    isMembershipStage(value.resulting_stage);
}

function isActivePilotEntitlement(value) {
  const keys = value && typeof value === 'object' ? Object.keys(value).sort() : [];
  const expectedKeys = [
    'actor', 'command_sha256', 'grant_event_id', 'granted_at', 'pilot_id',
    'reason', 'schema_version',
  ];
  return value && keys.length === expectedKeys.length &&
    keys.every((key, index) => key === expectedKeys[index]) &&
    value.schema_version === PILOT_ENTITLEMENT_STATE_SCHEMA && isPrivacySafePublicText(value.actor) &&
    /^sha256:[a-f0-9]{64}$/.test(value.command_sha256 ?? '') &&
    isIdentifier(value.grant_event_id) && isCanonicalIsoTimestamp(value.granted_at) &&
    isIdentifier(value.pilot_id) && isTrimmedNonEmptyString(value.reason);
}

function hashCanonical(value) {
  return `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PilotEntitlementError(`${label} must be an object.`);
  }
}

function isIdentifier(value) {
  return typeof value === 'string' && value.length >= 3 && value.length <= 128 &&
    /^[a-z0-9][a-z0-9._-]+$/.test(value) &&
    !containsPhoneMaterial(value) &&
    !containsAccountInstanceMaterial(value);
}

function isCanonicalIsoTimestamp(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isMembershipStage(value) {
  return BASE_MEMBERSHIP_STAGES.has(value) || value === 'pilot_premium';
}

function isTrimmedNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function isPrivacySafePublicText(value) {
  return (
    isTrimmedNonEmptyString(value) &&
    !containsPhoneMaterial(value) &&
    !containsAccountInstanceMaterial(value)
  );
}

function containsPhoneMaterial(value) {
  return typeof value === 'string' &&
    /1\d{10}/.test(value.normalize('NFKC').replace(/\D/g, ''));
}

function containsAccountInstanceMaterial(value) {
  return (
    typeof value === 'string' &&
    /account_[A-Za-z0-9_-]{24,128}/.test(value)
  );
}

module.exports = {
  PILOT_ENTITLEMENT_AUDIT_SCHEMA,
  PILOT_ENTITLEMENT_HISTORY_LIMIT,
  PILOT_ENTITLEMENT_STATE_SCHEMA,
  PilotEntitlementError,
  applyPilotEntitlementToMembership,
  planPilotEntitlementMutation,
  publicPilotEntitlementPlan,
  validatePilotEntitlementCommand,
  verifyAppliedPilotEntitlement,
  pilotEntitlementInternals: {
    containsPhoneMaterial,
    containsAccountInstanceMaterial,
    hashCanonical,
    normalizePilotEntitlementDocument,
    stableStringify,
  },
};
