import {NativeModules} from 'react-native';

import {
  mobileReleaseRuntimeProfileToRemoteProfile,
  parseMobileReleaseRuntimeProfile,
  readNativeMobileReleaseRuntimeProfile,
} from '../src/runtime/mobileReleaseRuntimeProfile';

const originalAppInfo = NativeModules.SoftbookAppInfo;

function receiverProfile() {
  return {
    api_base_url: 'https://receiver.example.cn/softbook-api',
    commit_sha: 'ab'.repeat(20),
    configuration_class: 'receiver_release',
    content_manifest_public_keys: [
      {
        algorithm: 'ed25519',
        key_id: 'release-key-a',
        public_key_hex: '01'.repeat(32),
      },
    ],
    delivery_profile_sha256: `sha256:${'ab'.repeat(32)}`,
    environment_id: 'receiver-cet4-beta',
    learning_track: 'cet4',
    minimum_client_versions: {android: '1.0.0', ios: '1.0.0'},
    profile_id: 'receiver-cet4-beta',
    public_keyring_sha256: `sha256:${'cd'.repeat(32)}`,
    repository: 'LENKIN233/softbook_cet',
    runtime_mode: 'closed_beta',
    schema_version: 'mobile-release-runtime-profile.v1',
    signing_key_id: 'release-key-a',
    target_release: 'cet4-closed-beta',
  };
}

function canonicalRaw(value: unknown): string {
  const stringify = (candidate: unknown): string => {
    if (Array.isArray(candidate)) {
      return `[${candidate.map(stringify).join(',')}]`;
    }
    if (candidate && typeof candidate === 'object') {
      const record = candidate as Record<string, unknown>;
      return `{${Object.keys(record)
        .sort()
        .map(key => `${JSON.stringify(key)}:${stringify(record[key])}`)
        .join(',')}}`;
    }
    return JSON.stringify(candidate);
  };
  return `${stringify(value)}\n`;
}

afterEach(() => {
  NativeModules.SoftbookAppInfo = originalAppInfo;
});

test('receiver profile maps to one all-remote public runtime profile', () => {
  const parsed = parseMobileReleaseRuntimeProfile(
    canonicalRaw(receiverProfile()),
  );
  expect(mobileReleaseRuntimeProfileToRemoteProfile(parsed)).toEqual({
    baseUrl: 'https://receiver.example.cn/softbook-api',
    contentManifestPublicKeys: {'release-key-a': '01'.repeat(32)},
    learningTrack: 'cet4',
    purchaseMode: 'operator_entitlement_only',
  });
});

test('endpoint policy is configuration-class aware', () => {
  for (const api_base_url of [
    'https://repository-fixture.invalid/softbook-api',
    'https://receiver.invalid/softbook-api',
    'https://localhost/softbook-api',
    'https://127.0.0.2/softbook-api',
    'https://127.255.255.254/softbook-api',
    'https://0.0.0.0/softbook-api',
    'https://[::1]/softbook-api',
  ]) {
    expect(() =>
      parseMobileReleaseRuntimeProfile(
        canonicalRaw({...receiverProfile(), api_base_url}),
      ),
    ).toThrow('api_base_url');
  }

  const repositoryFixture = {
    ...receiverProfile(),
    api_base_url: 'https://repository-fixture.invalid/softbook-api',
    configuration_class: 'repository_fixture',
    gate_eligible: false,
  };
  expect(
    parseMobileReleaseRuntimeProfile(canonicalRaw(repositoryFixture), {
      allowRepositoryFixture: true,
    }).api_base_url,
  ).toBe('https://repository-fixture.invalid/softbook-api');
  expect(() =>
    parseMobileReleaseRuntimeProfile(
      canonicalRaw({
        ...repositoryFixture,
        api_base_url: 'https://other.invalid/softbook-api',
      }),
      {allowRepositoryFixture: true},
    ),
  ).toThrow('api_base_url');
});

test('release fails before registration when native profile is missing', () => {
  NativeModules.SoftbookAppInfo = {platform: 'ios', version: '1.0.0'};
  expect(() =>
    readNativeMobileReleaseRuntimeProfile({isDevelopment: false}),
  ).toThrow('missing its embedded remote runtime profile');
  expect(
    readNativeMobileReleaseRuntimeProfile({isDevelopment: true}),
  ).toBeNull();
});

test('native receiver profile is accepted while fixture and secret drift fail', () => {
  NativeModules.SoftbookAppInfo = {
    platform: 'android',
    releaseRuntimeProfileJson: canonicalRaw(receiverProfile()),
    version: '1.0.0',
  };
  expect(
    readNativeMobileReleaseRuntimeProfile({isDevelopment: false}),
  ).toEqual({
    baseUrl: 'https://receiver.example.cn/softbook-api',
    contentManifestPublicKeys: {'release-key-a': '01'.repeat(32)},
    learningTrack: 'cet4',
    purchaseMode: 'operator_entitlement_only',
  });

  const fixture = {
    ...receiverProfile(),
    configuration_class: 'repository_fixture',
    gate_eligible: false,
  };
  expect(() => parseMobileReleaseRuntimeProfile(canonicalRaw(fixture))).toThrow(
    'not allowed',
  );
  expect(
    parseMobileReleaseRuntimeProfile(canonicalRaw(fixture), {
      allowRepositoryFixture: true,
    }).gate_eligible,
  ).toBe(false);

  expect(() =>
    parseMobileReleaseRuntimeProfile(
      canonicalRaw({...receiverProfile(), apiKey: 'forbidden'}),
    ),
  ).toThrow('keys are not exact');
});

test('runtime parser rejects noncanonical and duplicate-key source bytes', () => {
  const profile = receiverProfile();
  expect(() =>
    parseMobileReleaseRuntimeProfile(JSON.stringify(profile)),
  ).toThrow('bytes must be canonical');
  const canonical = canonicalRaw(profile);
  expect(() =>
    parseMobileReleaseRuntimeProfile(
      canonical.replace(
        '"profile_id":"receiver-cet4-beta"',
        '"profile_id":"receiver-cet4-beta","profile_id":"receiver-cet4-beta"',
      ),
    ),
  ).toThrow('bytes must be canonical');
});
