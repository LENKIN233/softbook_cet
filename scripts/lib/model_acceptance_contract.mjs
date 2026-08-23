import {createHash} from 'node:crypto';

const ACCEPTANCE_SCHEMA = 'model-acceptance.v2';
const PRINCIPAL_RE = /^(?:agent|model|service):[A-Za-z0-9][A-Za-z0-9_.@/-]{1,127}$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9:._/@-]{2,255}$/;
const SHA256_RE = /^sha256:[a-f0-9]{64}$/;
const TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const CAPABILITIES = new Set([
  'card_semantic_review',
  'content_authorization',
  'audio_perceptual_review',
  'destructive_change_review',
  'merge_authorization',
  'source_provenance_review',
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function requireSha256(value, label) {
  const normalized = typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
    ? `sha256:${value}`
    : value;
  if (!SHA256_RE.test(String(normalized || ''))) {
    throw new Error(`${label} must be sha256:<64 lowercase hex characters>`);
  }
  return normalized;
}

function normalizedScope(scope) {
  if (!isRecord(scope)) throw new Error('model acceptance scope must be an object');
  const cardIds = [...(scope.card_ids || [])].map(String).sort();
  const boxPrefixes = [...(scope.box_prefixes || [])].map(String).sort();
  if (
    cardIds.length === 0 ||
    new Set(cardIds).size !== cardIds.length ||
    new Set(boxPrefixes).size !== boxPrefixes.length
  ) {
    throw new Error(
      'model acceptance scope must contain non-empty unique card_ids and unique box_prefixes',
    );
  }
  return {
    track: scope.track ?? null,
    purpose: scope.purpose ?? null,
    library: scope.library ?? null,
    group: scope.group ?? null,
    box: scope.box ?? null,
    box_prefixes: boxPrefixes,
    card_ids: cardIds,
  };
}

export function buildModelAcceptanceInputSha256({
  additionalBindings = {},
  auditSha256,
  corpusFingerprint,
  decisionType,
  linkedReviewIdentity = null,
  scope,
} = {}) {
  if (
    typeof decisionType !== 'string' ||
    !/^[a-z][a-z0-9_]{2,95}$/.test(decisionType)
  ) {
    throw new Error('model acceptance decisionType is invalid');
  }
  if (!isRecord(additionalBindings)) {
    throw new Error('model acceptance additionalBindings must be an object');
  }
  let linkedReview = null;
  if (linkedReviewIdentity !== null) {
    if (
      !isRecord(linkedReviewIdentity) ||
      typeof linkedReviewIdentity.path !== 'string' ||
      !linkedReviewIdentity.path.trim()
    ) {
      throw new Error('model acceptance linked review identity is invalid');
    }
    linkedReview = {
      path: linkedReviewIdentity.path,
      sha256: requireSha256(linkedReviewIdentity.sha256, 'linked review sha256'),
    };
  }
  const payload = canonicalize({
    schema_version: 'model-acceptance-input.v1',
    decision_type: decisionType,
    scope: normalizedScope(scope),
    corpus_fingerprint: requireSha256(corpusFingerprint, 'corpus fingerprint'),
    audit_sha256: requireSha256(auditSha256, 'audit sha256'),
    linked_review: linkedReview,
    additional_bindings: additionalBindings,
  });
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')}`;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, expected, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    errors.push(`${label} keys are not exact`);
    return false;
  }
  return true;
}

export function validateModelAcceptance(
  value,
  {expectedInputSha256, requiredCapabilities = []} = {},
) {
  const errors = [];
  if (!exactKeys(value, ['schema_version', 'actor', 'evidence', 'decision'], 'acceptance', errors)) {
    return errors;
  }
  if (value.schema_version !== ACCEPTANCE_SCHEMA) errors.push('acceptance schema is invalid');
  if (!exactKeys(value.actor, ['kind', 'agent', 'model', 'run_id'], 'acceptance.actor', errors)) {
    return errors;
  }
  if (value.actor.kind !== 'model_harness') errors.push('acceptance actor kind is invalid');
  if (!PRINCIPAL_RE.test(String(value.actor.agent || ''))) errors.push('acceptance agent principal is invalid');
  if (!ID_RE.test(String(value.actor.model || ''))) errors.push('acceptance model identity is invalid');
  if (!ID_RE.test(String(value.actor.run_id || ''))) errors.push('acceptance run ID is invalid');
  if (!exactKeys(
    value.evidence,
    ['reviewed_at', 'input_sha256', 'capabilities', 'summary', 'findings'],
    'acceptance.evidence',
    errors,
  )) return errors;
  if (
    !TIME_RE.test(String(value.evidence.reviewed_at || '')) ||
    Number.isNaN(Date.parse(value.evidence.reviewed_at))
  ) errors.push('acceptance review time is invalid');
  if (!SHA256_RE.test(String(value.evidence.input_sha256 || ''))) {
    errors.push('acceptance input SHA is invalid');
  }
  if (expectedInputSha256 && value.evidence.input_sha256 !== expectedInputSha256) {
    errors.push('acceptance input SHA does not match the exact expected input');
  }
  const capabilities = value.evidence.capabilities;
  if (
    !Array.isArray(capabilities) ||
    capabilities.length === 0 ||
    new Set(capabilities).size !== capabilities.length ||
    capabilities.some(capability => !CAPABILITIES.has(capability))
  ) errors.push('acceptance capabilities are invalid');
  for (const capability of requiredCapabilities) {
    if (!capabilities?.includes(capability)) errors.push(`acceptance capability is missing: ${capability}`);
  }
  if (typeof value.evidence.summary !== 'string' || !value.evidence.summary.trim()) {
    errors.push('acceptance summary is missing');
  }
  if (!Array.isArray(value.evidence.findings)) {
    errors.push('acceptance findings must be an array');
  } else {
    const codes = new Set();
    for (const finding of value.evidence.findings) {
      if (!exactKeys(finding, ['code', 'severity', 'message'], 'acceptance finding', errors)) continue;
      if (!/^[a-z][a-z0-9_]{2,95}$/.test(String(finding.code || ''))) {
        errors.push('acceptance finding code is invalid');
      } else if (codes.has(finding.code)) {
        errors.push('acceptance finding code is duplicated');
      } else codes.add(finding.code);
      if (!['blocking', 'warning', 'info'].includes(finding.severity)) {
        errors.push('acceptance finding severity is invalid');
      }
      if (typeof finding.message !== 'string' || !finding.message.trim()) {
        errors.push('acceptance finding message is missing');
      }
    }
    if (value.evidence.findings.some(finding => finding?.severity === 'blocking')) {
      errors.push('accepted evidence contains a blocking finding');
    }
  }
  if (value.decision !== 'accepted') errors.push('acceptance decision must be accepted');
  return errors;
}

export function requireIndependentModelAcceptances(
  values,
  {expectedInputSha256, label = 'model acceptance', requiredCapabilities = []} = {},
) {
  if (!Array.isArray(values) || values.length < 2) {
    throw new Error(`${label} requires two independent model runs.`);
  }
  const errors = values.flatMap((value, index) =>
    validateModelAcceptance(value, {expectedInputSha256, requiredCapabilities})
      .map(error => `run ${index}: ${error}`));
  const runIds = values.map(value => value?.actor?.run_id);
  if (new Set(runIds).size !== values.length) errors.push('run IDs must be distinct');
  if (errors.length > 0) throw new Error(`${label} is invalid: ${errors.join('; ')}`);
  return values;
}
