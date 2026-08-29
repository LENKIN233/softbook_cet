import {createHash} from 'node:crypto';

import {parseStrictJson} from './strict_json.mjs';

export const MOBILE_RELEASE_RUNTIME_PROFILE_SCHEMA =
  'mobile-release-runtime-profile.v1';
export const CONTENT_MANIFEST_PUBLIC_KEYRING_SCHEMA =
  'content-manifest-public-keyring.v1';

const RECEIVER_KEYS = [
  'schema_version',
  'configuration_class',
  'repository',
  'commit_sha',
  'target_release',
  'profile_id',
  'delivery_profile_sha256',
  'public_keyring_sha256',
  'environment_id',
  'api_base_url',
  'runtime_mode',
  'learning_track',
  'minimum_client_versions',
  'signing_key_id',
  'content_manifest_public_keys',
];
const FIXTURE_KEYS = [...RECEIVER_KEYS, 'gate_eligible'];
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const SHA_PATTERN = /^sha256:[0-9a-f]{64}$/;
const PUBLIC_KEY_PATTERN = /^[0-9a-f]{64}$/;
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const FORBIDDEN_ENVIRONMENT_PATTERN =
  /(^|[-_.:])(local|mock|simulation|simulator|personal|development|dev|fixture)([-_.:]|$)/i;

export function validateMobileReleaseRuntimeProfile(
  value,
  {allowRepositoryFixture = false, expectedCommit = null} = {},
) {
  requireRecord(value, 'mobile release runtime profile');
  const configurationClass = requireOneOf(
    value.configuration_class,
    ['receiver_release', 'repository_fixture'],
    'configuration_class',
  );
  requireExactKeys(
    value,
    configurationClass === 'repository_fixture' ? FIXTURE_KEYS : RECEIVER_KEYS,
    'mobile release runtime profile',
  );
  if (
    configurationClass === 'repository_fixture' &&
    (!allowRepositoryFixture || value.gate_eligible !== false)
  ) {
    throw new Error('Repository fixture runtime profile is not allowed.');
  }
  requireExact(
    value.schema_version,
    MOBILE_RELEASE_RUNTIME_PROFILE_SCHEMA,
    'schema_version',
  );
  requireExact(value.repository, 'LENKIN233/softbook_cet', 'repository');
  const commitSha = requirePattern(value.commit_sha, COMMIT_PATTERN, 'commit_sha');
  if (
    configurationClass === 'receiver_release' &&
    expectedCommit !== null &&
    commitSha !== expectedCommit
  ) {
    throw new Error('Mobile release runtime profile commit does not match the build commit.');
  }
  requireExact(value.target_release, 'cet4-closed-beta', 'target_release');
  const profileId = requirePattern(value.profile_id, ID_PATTERN, 'profile_id');
  const deliveryProfileSha256 = requirePattern(
    value.delivery_profile_sha256,
    SHA_PATTERN,
    'delivery_profile_sha256',
  );
  const publicKeyringSha256 = requirePattern(
    value.public_keyring_sha256,
    SHA_PATTERN,
    'public_keyring_sha256',
  );
  const environmentId = requirePattern(
    value.environment_id,
    ID_PATTERN,
    'environment_id',
  );
  const apiBaseUrl = requireApiBaseUrl(value.api_base_url);
  requireExact(value.runtime_mode, 'closed_beta', 'runtime_mode');
  requireExact(value.learning_track, 'cet4', 'learning_track');
  const minimumClientVersions = validateMinimumClientVersions(
    value.minimum_client_versions,
  );
  const signingKeyId = requirePattern(
    value.signing_key_id,
    ID_PATTERN,
    'signing_key_id',
  );
  const contentManifestPublicKeys = validatePublicKeyEntries(
    value.content_manifest_public_keys,
  );
  if (
    contentManifestPublicKeys.filter(item => item.key_id === signingKeyId)
      .length !== 1
  ) {
    throw new Error('signing_key_id must identify exactly one public key.');
  }
  if (
    configurationClass === 'receiver_release' &&
    (FORBIDDEN_ENVIRONMENT_PATTERN.test(environmentId) ||
      /^([0-9a-f])\1{39}$/.test(commitSha) ||
      /^sha256:([0-9a-f])\1{63}$/.test(deliveryProfileSha256) ||
      /^sha256:([0-9a-f])\1{63}$/.test(publicKeyringSha256) ||
      contentManifestPublicKeys.some(item =>
        /^([0-9a-f])\1{63}$/.test(item.public_key_hex),
      ))
  ) {
    throw new Error('Receiver release runtime profile contains placeholder identity.');
  }
  return {
    schema_version: MOBILE_RELEASE_RUNTIME_PROFILE_SCHEMA,
    configuration_class: configurationClass,
    ...(configurationClass === 'repository_fixture'
      ? {gate_eligible: false}
      : {}),
    repository: 'LENKIN233/softbook_cet',
    commit_sha: commitSha,
    target_release: 'cet4-closed-beta',
    profile_id: profileId,
    delivery_profile_sha256: deliveryProfileSha256,
    public_keyring_sha256: publicKeyringSha256,
    environment_id: environmentId,
    api_base_url: apiBaseUrl,
    runtime_mode: 'closed_beta',
    learning_track: 'cet4',
    minimum_client_versions: minimumClientVersions,
    signing_key_id: signingKeyId,
    content_manifest_public_keys: contentManifestPublicKeys,
  };
}

export function validateContentManifestPublicKeyring(value) {
  requireRecord(value, 'content manifest public keyring');
  requireExactKeys(
    value,
    ['schema_version', 'keys'],
    'content manifest public keyring',
  );
  requireExact(
    value.schema_version,
    CONTENT_MANIFEST_PUBLIC_KEYRING_SCHEMA,
    'keyring schema_version',
  );
  return {
    schema_version: CONTENT_MANIFEST_PUBLIC_KEYRING_SCHEMA,
    keys: validatePublicKeyEntries(value.keys),
  };
}

export function createMobileReleaseRuntimeProfile({
  commitSha,
  deliveryProfile,
  deliveryProfileBytes,
  publicKeyring,
  publicKeyringBytes,
}) {
  const parsedDeliveryProfile = parseStrictJson(
    deliveryProfileBytes,
    'delivery profile',
  );
  requireRecord(parsedDeliveryProfile, 'delivery profile');
  requireExactKeys(
    parsedDeliveryProfile,
    [
      'schema_version',
      'profile_id',
      'environment_id',
      'region',
      'api_base_url',
      'runtime_mode',
      'enabled_tracks',
      'minimum_client_versions',
      'signing_key_id',
    ],
    'delivery profile',
  );
  if (canonicalStringify(parsedDeliveryProfile) !== canonicalStringify(deliveryProfile)) {
    throw new Error('Delivery profile object does not match its exact bytes.');
  }
  requireExact(parsedDeliveryProfile.schema_version, 'delivery-profile.v1', 'delivery profile schema');
  requireExact(parsedDeliveryProfile.runtime_mode, 'closed_beta', 'delivery profile runtime_mode');
  if (JSON.stringify(parsedDeliveryProfile.enabled_tracks) !== JSON.stringify(['cet4'])) {
    throw new Error('Delivery profile enabled_tracks must be exactly CET4.');
  }
  requirePattern(parsedDeliveryProfile.region, /^[a-z]+-[a-z]+(?:-\d+)?$/, 'delivery profile region');
  const parsedKeyring = parseStrictJson(
    publicKeyringBytes,
    'content manifest public keyring',
  );
  if (canonicalStringify(parsedKeyring) !== canonicalStringify(publicKeyring)) {
    throw new Error('Public keyring object does not match its exact bytes.');
  }
  const keyring = validateContentManifestPublicKeyring(publicKeyring);
  const profile = {
    schema_version: MOBILE_RELEASE_RUNTIME_PROFILE_SCHEMA,
    configuration_class: 'receiver_release',
    repository: 'LENKIN233/softbook_cet',
    commit_sha: commitSha,
    target_release: 'cet4-closed-beta',
    profile_id: deliveryProfile.profile_id,
    delivery_profile_sha256: sha256(deliveryProfileBytes),
    public_keyring_sha256: sha256(publicKeyringBytes),
    environment_id: deliveryProfile.environment_id,
    api_base_url: deliveryProfile.api_base_url,
    runtime_mode: deliveryProfile.runtime_mode,
    learning_track: 'cet4',
    minimum_client_versions: deliveryProfile.minimum_client_versions,
    signing_key_id: deliveryProfile.signing_key_id,
    content_manifest_public_keys: keyring.keys,
  };
  return validateMobileReleaseRuntimeProfile(profile, {expectedCommit: commitSha});
}

export function mobileReleaseProfileToRemoteRuntimeProfile(profile) {
  const validated = validateMobileReleaseRuntimeProfile(profile, {
    allowRepositoryFixture: true,
  });
  return {
    baseUrl: validated.api_base_url,
    contentManifestPublicKeys: Object.fromEntries(
      validated.content_manifest_public_keys.map(item => [
        item.key_id,
        item.public_key_hex,
      ]),
    ),
    learningTrack: validated.learning_track,
  };
}

export function canonicalJsonBytes(value) {
  return Buffer.from(`${canonicalStringify(value)}\n`, 'utf8');
}

export function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function validatePublicKeyEntries(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) {
    throw new Error('content manifest public keys must contain 1 to 8 entries.');
  }
  const result = value.map((item, index) => {
    requireRecord(item, `public key ${index}`);
    requireExactKeys(
      item,
      ['key_id', 'algorithm', 'public_key_hex'],
      `public key ${index}`,
    );
    const keyId = requirePattern(item.key_id, ID_PATTERN, `public key ${index} key_id`);
    requireExact(item.algorithm, 'ed25519', `public key ${index} algorithm`);
    const publicKeyHex = requirePattern(
      item.public_key_hex,
      PUBLIC_KEY_PATTERN,
      `public key ${index} public_key_hex`,
    );
    return {key_id: keyId, algorithm: 'ed25519', public_key_hex: publicKeyHex};
  });
  const ids = result.map(item => item.key_id);
  if (new Set(ids).size !== ids.length || JSON.stringify(ids) !== JSON.stringify([...ids].sort())) {
    throw new Error('content manifest public keys must be unique and sorted by key_id.');
  }
  return result;
}

function validateMinimumClientVersions(value) {
  requireRecord(value, 'minimum_client_versions');
  requireExactKeys(
    value,
    ['android', 'ios'],
    'minimum_client_versions',
  );
  return {
    android: requirePattern(
      value.android,
      SEMVER_PATTERN,
      'minimum_client_versions.android',
    ),
    ios: requirePattern(value.ios, SEMVER_PATTERN, 'minimum_client_versions.ios'),
  };
}

function requireApiBaseUrl(value) {
  const text = requireString(value, 'api_base_url');
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error('api_base_url must be a valid HTTPS URL.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname === '/' ||
    (url.hostname !== 'repository-fixture.invalid' &&
      /(^|\.)(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(url.hostname))
  ) {
    throw new Error('api_base_url must be credential-free HTTPS with a non-root path.');
  }
  return url.toString().replace(/\/$/, '');
}

function requireRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} keys are not exact.`);
  }
}

function requireExact(value, expected, label) {
  if (value !== expected) throw new Error(`${label} must equal ${expected}.`);
  return value;
}

function requireOneOf(value, expected, label) {
  if (!expected.includes(value)) throw new Error(`${label} is invalid.`);
  return value;
}

function requirePattern(value, pattern, label) {
  const text = requireString(value, label);
  if (!pattern.test(text)) throw new Error(`${label} is invalid.`);
  return text;
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw new Error(`${label} must be a non-empty canonical string.`);
  }
  return value;
}

function canonicalStringify(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
