import {createHash, createPublicKey, verify} from 'node:crypto';

export const SMS_RECEIVER_EVIDENCE_SCHEMA = 'sms-receiver-evidence.v1';
export const SMS_RECEIVER_EVIDENCE_SOURCES = new Set([
  'device_sms_inbox',
  'carrier_inbox_api',
  'receiver_webhook',
]);
const RUN_ID_RE = /^sms-smoke-[0-9a-f-]{36}$/;
const TARGET_RE = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const MACHINE_PRINCIPAL_RE =
  /^(?:model|agent|service|oidc):[A-Za-z0-9][A-Za-z0-9._@-]{2,127}$/;

const SIGNED_FIELDS = Object.freeze([
  'schema_version',
  'adapter_id',
  'run_id',
  'target',
  'source',
  'received_at',
  'code',
  'receipt_id',
  'key_id',
]);

export function receiverEvidenceSigningPayload(evidence) {
  return Object.fromEntries(SIGNED_FIELDS.map(field => [field, evidence?.[field]]));
}

export function receiverEvidenceSigningBytes(evidence) {
  return Buffer.from(stableJson(receiverEvidenceSigningPayload(evidence)), 'utf8');
}

export function validateSmsReceiverEvidence(evidence) {
  const errors = [];
  requireExactKeys(evidence, [...SIGNED_FIELDS, 'signature'], 'receiver evidence', errors);
  if (evidence?.schema_version !== SMS_RECEIVER_EVIDENCE_SCHEMA) {
    errors.push('receiver evidence schema_version is invalid');
  }
  if (!MACHINE_PRINCIPAL_RE.test(String(evidence?.adapter_id || ''))) {
    errors.push('receiver evidence adapter_id must identify a machine adapter');
  }
  if (!RUN_ID_RE.test(String(evidence?.run_id || ''))) {
    errors.push('receiver evidence run_id is invalid');
  }
  if (!TARGET_RE.test(String(evidence?.target || ''))) {
    errors.push('receiver evidence target is invalid');
  }
  if (!SMS_RECEIVER_EVIDENCE_SOURCES.has(evidence?.source)) {
    errors.push('receiver evidence source is invalid');
  }
  if (!isExactIsoTimestamp(evidence?.received_at)) {
    errors.push('receiver evidence received_at is invalid');
  }
  if (!/^\d{6}$/.test(String(evidence?.code || ''))) {
    errors.push('receiver evidence code must contain exactly six digits');
  }
  if (!ID_RE.test(String(evidence?.receipt_id || ''))) {
    errors.push('receiver evidence receipt_id is invalid');
  }
  if (!ID_RE.test(String(evidence?.key_id || ''))) {
    errors.push('receiver evidence key_id is invalid');
  }
  if (!isEd25519Signature(evidence?.signature)) {
    errors.push('receiver evidence signature is invalid');
  }
  return errors;
}

export function requireEd25519PublicKey(value) {
  if (value?.type === 'public') {
    if (value.asymmetricKeyType !== 'ed25519') {
      throw new Error('SMS receiver public key must use Ed25519.');
    }
    return value;
  }
  let key;
  try {
    key = createPublicKey(value);
  } catch (error) {
    throw new Error('SMS receiver public key is invalid.', {cause: error});
  }
  if (key.asymmetricKeyType !== 'ed25519') {
    throw new Error('SMS receiver public key must use Ed25519.');
  }
  return key;
}

export function ed25519PublicKeyFingerprint(value) {
  const key = value?.type === 'public' ? value : requireEd25519PublicKey(value);
  return createHash('sha256')
    .update(key.export({format: 'der', type: 'spki'}))
    .digest('hex');
}

export function verifySmsReceiverEvidence(evidence, publicKey) {
  if (validateSmsReceiverEvidence(evidence).length > 0) return false;
  const signature = Buffer.from(evidence.signature, 'base64');
  return verify(
    null,
    receiverEvidenceSigningBytes(evidence),
    requireEd25519PublicKey(publicKey),
    signature,
  );
}

function isExactIsoTimestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isEd25519Signature(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return false;
  }
  const decoded = Buffer.from(value, 'base64');
  return decoded.length === 64 && decoded.toString('base64') === value;
}

function requireExactKeys(value, expected, label, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${label} must be an object`);
    return;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    errors.push(`${label} keys are not exact`);
  }
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
