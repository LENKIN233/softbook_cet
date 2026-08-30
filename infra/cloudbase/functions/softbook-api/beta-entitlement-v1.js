const {createHash} = require('node:crypto');

const BETA_ENTITLEMENT_COMMAND_SCHEMA = 'beta-entitlement-command.v1';
const BETA_ENTITLEMENT_AUDIT_SCHEMA = 'beta-entitlement-audit.v1';
const BETA_ENTITLEMENT_STATE_SCHEMA = 'beta-entitlement.v1';
const BETA_ENTITLEMENT_HISTORY_LIMIT = 100;

const ACTIONS = new Set(['grant', 'revoke']);
const MEMBERSHIP_STAGES = new Set(['trial_available', 'trial', 'free', 'premium']);

class BetaEntitlementError extends Error {}

function validateBetaEntitlementCommand(input) {
  assertPlainObject(input, 'command');
  assertExactKeys(
    input,
    [
      'schema_version',
      'event_id',
      'action',
      'phone_number',
      'campaign_id',
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
  if (!isIdentifier(input.campaign_id, 3, 96)) {
    throw new BetaEntitlementError('campaign_id is invalid.');
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

function planBetaEntitlementMutation(
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
  const baseEntitlement = resolveBaseEntitlementAt(
    baseEntitlementInput ?? createInitialMembership(),
    command.occurred_at,
  );
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

function publicBetaEntitlementPlan(plan) {
  const command = validateBetaEntitlementCommand(plan.command);
  return {
    schema_version: 'beta-entitlement-plan.v2',
    action: command.action,
    actor_id: command.actor_id,
    campaign_id: command.campaign_id,
    changed: plan.changed,
    event_id: command.event_id,
    grant_id: command.grant_id,
    idempotent: plan.idempotent,
    previous_stage: plan.previousStage,
    resulting_stage: plan.resultingStage,
  };
}

function publicBetaEntitlementState(documentInput) {
  const document = normalizeBetaEntitlementDocument(documentInput);
  const privacySafeDocument = structuredClone(document);
  delete privacySafeDocument.phone_number;
  return {
    active: document.active_grant !== null,
    active_campaign_id: document.active_grant?.campaign_id ?? null,
    active_grant_id: document.active_grant?.grant_id ?? null,
    audit_event_count: document.audit.length,
    revision: document.revision,
    state_sha256: hashCanonical(privacySafeDocument),
  };
}

function verifyAppliedBetaEntitlement(plan, storedDocument) {
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

function applyBetaEntitlementToMembership(baseEntitlementInput, betaDocumentInput) {
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
      campaign_id: command.campaign_id,
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
  if (
    active === null ||
    active.campaign_id !== command.campaign_id ||
    active.grant_id !== command.grant_id
  ) {
    throw new BetaEntitlementError(
      'revoke requires the matching active beta campaign and grant.',
    );
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
    campaign_id: command.campaign_id,
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
  assertExactKeys(
    document,
    ['active_grant', 'audit', 'phone_number', 'revision', 'updated_at'],
    'beta entitlement document',
  );
  const audit = document.audit ?? [];
  if (
    !Array.isArray(audit) ||
    audit.length > BETA_ENTITLEMENT_HISTORY_LIMIT ||
    audit.some(event => !isStoredAuditEvent(event))
  ) {
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
  let openCampaignId = null;
  let openGrantId = null;
  let previousTimestamp = null;
  const eventIds = new Set();
  for (const event of audit) {
    const reconstructedCommand = validateBetaEntitlementCommand({
      schema_version: BETA_ENTITLEMENT_COMMAND_SCHEMA,
      event_id: event.event_id,
      action: event.action,
      phone_number: document.phone_number,
      campaign_id: event.campaign_id,
      grant_id: event.grant_id,
      actor_id: event.actor_id,
      reason: event.reason,
      occurred_at: event.occurred_at,
    });
    if (
      eventIds.has(event.event_id) ||
      event.command_sha256 !== hashCanonical(reconstructedCommand) ||
      (previousTimestamp !== null && event.occurred_at < previousTimestamp) ||
      (event.action === 'grant' &&
        (openGrantId !== null || event.resulting_stage !== 'premium')) ||
      (event.action === 'revoke' &&
        (openCampaignId !== event.campaign_id ||
          openGrantId !== event.grant_id ||
          event.previous_stage !== 'premium'))
    ) {
      throw new BetaEntitlementError('beta entitlement audit sequence is invalid.');
    }
    eventIds.add(event.event_id);
    openCampaignId = event.action === 'grant' ? event.campaign_id : null;
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
        active.campaign_id !== latest.campaign_id ||
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
    trial_expires_at: input.trial_expires_at ?? null,
    trial_started_at: input.trial_started_at ?? null,
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
    ) ||
    ((value.trial_started_at === null) !==
      (value.trial_expires_at === null)) ||
    (value.trial_started_at !== null &&
      (!isCanonicalIsoTimestamp(value.trial_started_at) ||
        !isCanonicalIsoTimestamp(value.trial_expires_at) ||
        Date.parse(value.trial_expires_at) -
          Date.parse(value.trial_started_at) !==
          value.trial_duration_days * 24 * 60 * 60 * 1000)) ||
    (value.stage === 'trial' && value.trial_started_at === null)
  ) {
    throw new BetaEntitlementError('membership entitlement is invalid.');
  }
  return value;
}

function resolveBaseEntitlementAt(input, occurredAt) {
  const base = cloneEntitlement(input);
  if (
    base.stage === 'trial' &&
    Date.parse(occurredAt) >= Date.parse(base.trial_expires_at)
  ) {
    return {
      ...base,
      last_experience_ended_by: 'trial',
      recovery_prompt_visible: true,
      stage: 'free',
    };
  }
  return base;
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
  const keys = value && typeof value === 'object' ? Object.keys(value).sort() : [];
  const expectedKeys = [
    'action',
    'actor_id',
    'campaign_id',
    'command_sha256',
    'event_id',
    'grant_id',
    'occurred_at',
    'previous_stage',
    'reason',
    'resulting_stage',
    'schema_version',
  ].sort();
  return (
    value &&
    keys.length === expectedKeys.length &&
    keys.every((key, index) => key === expectedKeys[index]) &&
    value.schema_version === BETA_ENTITLEMENT_AUDIT_SCHEMA &&
    ACTIONS.has(value.action) &&
    isIdentifier(value.actor_id, 3, 96) &&
    isIdentifier(value.campaign_id, 3, 96) &&
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
  const keys = value && typeof value === 'object' ? Object.keys(value).sort() : [];
  const expectedKeys = [
    'actor_id',
    'campaign_id',
    'command_sha256',
    'grant_event_id',
    'grant_id',
    'granted_at',
    'reason',
    'schema_version',
  ].sort();
  return (
    value &&
    keys.length === expectedKeys.length &&
    keys.every((key, index) => key === expectedKeys[index]) &&
    value.schema_version === BETA_ENTITLEMENT_STATE_SCHEMA &&
    isIdentifier(value.actor_id, 3, 96) &&
    isIdentifier(value.campaign_id, 3, 96) &&
    /^sha256:[a-f0-9]{64}$/.test(value.command_sha256 ?? '') &&
    isIdentifier(value.grant_event_id, 12, 96) &&
    isIdentifier(value.grant_id, 12, 96) &&
    isCanonicalIsoTimestamp(value.granted_at) &&
    isIdentifier(value.reason, 3, 96)
  );
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
    /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(value) &&
    !containsPhoneMaterial(value)
  );
}

function containsPhoneMaterial(value) {
  return (
    typeof value === 'string' &&
    /1\d{10}/.test(value.replace(/[^A-Za-z0-9]/g, ''))
  );
}

function isCanonicalIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

const betaEntitlementInternals = {
  containsPhoneMaterial,
  hashCanonical,
  normalizeBetaEntitlementDocument,
  stableStringify,
};

module.exports = {
  BETA_ENTITLEMENT_AUDIT_SCHEMA,
  BETA_ENTITLEMENT_COMMAND_SCHEMA,
  BETA_ENTITLEMENT_HISTORY_LIMIT,
  BETA_ENTITLEMENT_STATE_SCHEMA,
  BetaEntitlementError,
  applyBetaEntitlementToMembership,
  betaEntitlementInternals,
  planBetaEntitlementMutation,
  publicBetaEntitlementPlan,
  publicBetaEntitlementState,
  validateBetaEntitlementCommand,
  verifyAppliedBetaEntitlement,
};
