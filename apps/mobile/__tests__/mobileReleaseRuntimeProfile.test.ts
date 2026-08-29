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

afterEach(() => {
  NativeModules.SoftbookAppInfo = originalAppInfo;
});

test('receiver profile maps to one all-remote public runtime profile', () => {
  const parsed = parseMobileReleaseRuntimeProfile(
    JSON.stringify(receiverProfile()),
  );
  expect(mobileReleaseRuntimeProfileToRemoteProfile(parsed)).toEqual({
    baseUrl: 'https://receiver.example.cn/softbook-api',
    contentManifestPublicKeys: {'release-key-a': '01'.repeat(32)},
    learningTrack: 'cet4',
  });
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
    releaseRuntimeProfileJson: JSON.stringify(receiverProfile()),
    version: '1.0.0',
  };
  expect(
    readNativeMobileReleaseRuntimeProfile({isDevelopment: false}),
  ).toEqual({
    baseUrl: 'https://receiver.example.cn/softbook-api',
    contentManifestPublicKeys: {'release-key-a': '01'.repeat(32)},
    learningTrack: 'cet4',
  });

  const fixture = {...receiverProfile(), configuration_class: 'repository_fixture', gate_eligible: false};
  expect(() => parseMobileReleaseRuntimeProfile(JSON.stringify(fixture))).toThrow(
    'not allowed',
  );
  expect(
    parseMobileReleaseRuntimeProfile(JSON.stringify(fixture), {
      allowRepositoryFixture: true,
    }).gate_eligible,
  ).toBe(false);

  expect(() =>
    parseMobileReleaseRuntimeProfile(
      JSON.stringify({...receiverProfile(), apiKey: 'forbidden'}),
    ),
  ).toThrow('keys are not exact');
});
