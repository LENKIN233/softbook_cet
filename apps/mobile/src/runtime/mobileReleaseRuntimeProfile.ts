import {NativeModules} from 'react-native';

import type {SoftbookRemoteRuntimeProfile} from './appRuntimeConfig';

export type MobileReleaseRuntimeProfile = {
  api_base_url: string;
  commit_sha: string;
  configuration_class: 'receiver_release' | 'repository_fixture';
  content_manifest_public_keys: Array<{
    algorithm: 'ed25519';
    key_id: string;
    public_key_hex: string;
  }>;
  delivery_profile_sha256: string;
  environment_id: string;
  gate_eligible?: false;
  learning_track: 'cet4';
  minimum_client_versions: {android: string; ios: string};
  profile_id: string;
  public_keyring_sha256: string;
  repository: 'LENKIN233/softbook_cet';
  runtime_mode: 'closed_beta';
  schema_version: 'mobile-release-runtime-profile.v1';
  signing_key_id: string;
  target_release: 'cet4-closed-beta';
};

const RECEIVER_KEYS = [
  'api_base_url',
  'commit_sha',
  'configuration_class',
  'content_manifest_public_keys',
  'delivery_profile_sha256',
  'environment_id',
  'learning_track',
  'minimum_client_versions',
  'profile_id',
  'public_keyring_sha256',
  'repository',
  'runtime_mode',
  'schema_version',
  'signing_key_id',
  'target_release',
] as const;
const PROFILE_LABEL = 'mobile release runtime profile';
const PROFILE_SCHEMA = 'mobile-release-runtime-profile.v1' as const;

export function parseMobileReleaseRuntimeProfile(
  raw: string,
  {allowRepositoryFixture = false} = {},
): MobileReleaseRuntimeProfile {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 64 * 1024) {
    throw new Error('Mobile release runtime profile must be bounded UTF-8 JSON.');
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Mobile release runtime profile must be valid JSON.');
  }
  const record = requireRecord(value, 'mobile release runtime profile');
  const configurationClass = requireOneOf(
    record.configuration_class,
    ['receiver_release', 'repository_fixture'] as const,
    'configuration_class',
  );
  requireExactKeys(
    record,
    configurationClass === 'repository_fixture'
      ? [...RECEIVER_KEYS, 'gate_eligible']
      : RECEIVER_KEYS,
    PROFILE_LABEL,
  );
  if (
    configurationClass === 'repository_fixture' &&
    (!allowRepositoryFixture || record.gate_eligible !== false)
  ) {
    throw new Error('Repository fixture runtime profile is not allowed.');
  }
  requireExact(
    record.schema_version,
    PROFILE_SCHEMA,
    'schema_version',
  );
  requireExact(record.repository, 'LENKIN233/softbook_cet', 'repository');
  requirePattern(record.commit_sha, /^[0-9a-f]{40}$/, 'commit_sha');
  requireExact(record.target_release, 'cet4-closed-beta', 'target_release');
  const profileId = requirePattern(record.profile_id, ID_PATTERN, 'profile_id');
  const deliveryProfileSha256 = requirePattern(
    record.delivery_profile_sha256,
    SHA_PATTERN,
    'delivery_profile_sha256',
  );
  const publicKeyringSha256 = requirePattern(
    record.public_keyring_sha256,
    SHA_PATTERN,
    'public_keyring_sha256',
  );
  const environmentId = requirePattern(
    record.environment_id,
    ID_PATTERN,
    'environment_id',
  );
  const apiBaseUrl = requireApiBaseUrl(record.api_base_url);
  requireExact(record.runtime_mode, 'closed_beta', 'runtime_mode');
  requireExact(record.learning_track, 'cet4', 'learning_track');
  const minimumClientVersions = requireRecord(
    record.minimum_client_versions,
    'minimum_client_versions',
  );
  requireExactKeys(
    minimumClientVersions,
    ['android', 'ios'],
    'minimum_client_versions',
  );
  const minimumVersions = {
    android: requirePattern(
      minimumClientVersions.android,
      SEMVER_PATTERN,
      'minimum_client_versions.android',
    ),
    ios: requirePattern(
      minimumClientVersions.ios,
      SEMVER_PATTERN,
      'minimum_client_versions.ios',
    ),
  };
  const signingKeyId = requirePattern(
    record.signing_key_id,
    ID_PATTERN,
    'signing_key_id',
  );
  if (
    !Array.isArray(record.content_manifest_public_keys) ||
    record.content_manifest_public_keys.length < 1 ||
    record.content_manifest_public_keys.length > 8
  ) {
    throw new Error('content_manifest_public_keys must contain 1 to 8 entries.');
  }
  const keys = record.content_manifest_public_keys.map((item, index) => {
    const key = requireRecord(item, `content_manifest_public_keys[${index}]`);
    requireExactKeys(
      key,
      ['algorithm', 'key_id', 'public_key_hex'],
      `content_manifest_public_keys[${index}]`,
    );
    requireExact(key.algorithm, 'ed25519', `content_manifest_public_keys[${index}].algorithm`);
    return {
      algorithm: 'ed25519' as const,
      key_id: requirePattern(
        key.key_id,
        ID_PATTERN,
        `content_manifest_public_keys[${index}].key_id`,
      ),
      public_key_hex: requirePattern(
        key.public_key_hex,
        /^[0-9a-f]{64}$/,
        `content_manifest_public_keys[${index}].public_key_hex`,
      ),
    };
  });
  const keyIds = keys.map(item => item.key_id);
  if (
    new Set(keyIds).size !== keyIds.length ||
    JSON.stringify(keyIds) !== JSON.stringify([...keyIds].sort()) ||
    keyIds.filter(keyId => keyId === signingKeyId).length !== 1
  ) {
    throw new Error('Content manifest keyring identity is invalid.');
  }
  if (
    configurationClass === 'receiver_release' &&
    (/(^|[-_.:])(local|mock|simulation|simulator|personal|development|dev|fixture)([-_.:]|$)/i.test(
      environmentId,
    ) ||
      /^([0-9a-f])\1{39}$/.test(record.commit_sha as string) ||
      /^sha256:([0-9a-f])\1{63}$/.test(deliveryProfileSha256) ||
      /^sha256:([0-9a-f])\1{63}$/.test(publicKeyringSha256) ||
      keys.some(item => /^([0-9a-f])\1{63}$/.test(item.public_key_hex)))
  ) {
    throw new Error('Receiver release runtime profile contains placeholder identity.');
  }
  return {
    api_base_url: apiBaseUrl,
    commit_sha: record.commit_sha as string,
    configuration_class: configurationClass,
    content_manifest_public_keys: keys,
    delivery_profile_sha256: deliveryProfileSha256,
    environment_id: environmentId,
    ...(configurationClass === 'repository_fixture'
      ? {gate_eligible: false as const}
      : {}),
    learning_track: 'cet4',
    minimum_client_versions: minimumVersions,
    profile_id: profileId,
    public_keyring_sha256: publicKeyringSha256,
    repository: 'LENKIN233/softbook_cet',
    runtime_mode: 'closed_beta',
    schema_version: 'mobile-release-runtime-profile.v1',
    signing_key_id: signingKeyId,
    target_release: 'cet4-closed-beta',
  };
}

export function mobileReleaseRuntimeProfileToRemoteProfile(
  profile: MobileReleaseRuntimeProfile,
): SoftbookRemoteRuntimeProfile {
  const keyEntries = profile.content_manifest_public_keys;
  return {
    baseUrl: profile.api_base_url,
    contentManifestPublicKeys: Object.fromEntries(
      keyEntries.map(item => [
        item.key_id,
        item.public_key_hex,
      ]),
    ),
    learningTrack: 'cet4',
  };
}

export function readNativeMobileReleaseRuntimeProfile({
  isDevelopment,
}: {
  isDevelopment: boolean;
}): SoftbookRemoteRuntimeProfile | null {
  const module = NativeModules.SoftbookAppInfo as
    | {releaseRuntimeProfileJson?: unknown}
    | undefined;
  const raw = module?.releaseRuntimeProfileJson;
  if (typeof raw !== 'string' || raw.length === 0) {
    if (isDevelopment) return null;
    throw new Error('Release app is missing its embedded remote runtime profile.');
  }
  const profile = parseMobileReleaseRuntimeProfile(raw, {
    allowRepositoryFixture: isDevelopment,
  });
  return mobileReleaseRuntimeProfileToRemoteProfile(profile);
}

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const SHA_PATTERN = /^sha256:[0-9a-f]{64}$/;
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} keys are not exact.`);
  }
}

function requireExact<T>(value: unknown, expected: T, label: string): T {
  if (value !== expected) throw new Error(`${label} is invalid.`);
  return expected;
}

function requireOneOf<const T extends readonly string[]>(
  value: unknown,
  expected: T,
  label: string,
): T[number] {
  if (typeof value !== 'string' || !expected.includes(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value as T[number];
}

function requirePattern(value: unknown, pattern: RegExp, label: string) {
  if (typeof value !== 'string' || value !== value.trim() || !pattern.test(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

function requireApiBaseUrl(value: unknown) {
  if (typeof value !== 'string' || value !== value.trim()) {
    throw new Error('api_base_url is invalid.');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('api_base_url is invalid.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname === '/' ||
    /(^|\.)(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(url.hostname)
  ) {
    throw new Error('api_base_url must be credential-free HTTPS with a path.');
  }
  return url.toString().replace(/\/$/, '');
}
