import { NativeModules, Platform } from 'react-native';

import {
  assertInstalledClientVersionAtLeast,
  compareSemanticVersions,
  isStrictSemanticVersion,
  readInstalledClientIdentity,
} from '../src/runtime/installedClientVersion';

const originalAppInfo = NativeModules.SoftbookAppInfo;

afterEach(() => {
  if (originalAppInfo === undefined) {
    delete NativeModules.SoftbookAppInfo;
  } else {
    NativeModules.SoftbookAppInfo = originalAppInfo;
  }
});

test('reads one synchronous native identity bound to the React Native platform', () => {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new Error('The React Native Jest preset must expose ios or android.');
  }
  NativeModules.SoftbookAppInfo = {
    platform: Platform.OS,
    version: '1.2.3-rc.4+build.7',
  };

  expect(readInstalledClientIdentity()).toEqual({
    platform: Platform.OS,
    version: '1.2.3-rc.4+build.7',
  });
});

test('fails closed when native identity is missing, mismatched, or malformed', () => {
  delete NativeModules.SoftbookAppInfo;
  expect(() => readInstalledClientIdentity()).toThrow(
    'native module is unavailable',
  );

  const expectedPlatform = Platform.OS === 'android' ? 'android' : 'ios';
  NativeModules.SoftbookAppInfo = {
    platform: expectedPlatform === 'android' ? 'ios' : 'android',
    version: '1.0.0',
  };
  expect(() => readInstalledClientIdentity()).toThrow(
    'does not match React Native Platform.OS',
  );

  NativeModules.SoftbookAppInfo = {
    platform: expectedPlatform,
    version: '1.0',
  };
  expect(() => readInstalledClientIdentity()).toThrow(
    'must use strict semantic version form',
  );
});

test.each([
  '1.0',
  '01.0.0',
  '1.01.0',
  '1.0.01',
  '1.0.0-01',
  '1.0.0-alpha..1',
  '1.0.0+',
  '1.0.0+build..1',
  'v1.0.0',
  ' 1.0.0',
])('rejects non-strict semantic version %s', version => {
  expect(isStrictSemanticVersion(version)).toBe(false);
});

test('implements strict semantic-version precedence including prereleases', () => {
  const ordered = [
    '1.0.0-alpha',
    '1.0.0-alpha.1',
    '1.0.0-alpha.beta',
    '1.0.0-beta',
    '1.0.0-beta.2',
    '1.0.0-beta.11',
    '1.0.0-rc.1',
    '1.0.0',
    '2.0.0',
  ];

  ordered.slice(0, -1).forEach((version, index) => {
    expect(compareSemanticVersions(version, ordered[index + 1])).toBe(-1);
    expect(compareSemanticVersions(ordered[index + 1], version)).toBe(1);
  });
  expect(compareSemanticVersions('1.0.0+build.1', '1.0.0+build.2')).toBe(0);
  expect(
    compareSemanticVersions(
      '100000000000000000000.0.0',
      '99999999999999999999.999.999',
    ),
  ).toBe(1);
});

test('enforces the signed minimum for only the installed platform', () => {
  expect(() =>
    assertInstalledClientVersionAtLeast(
      { platform: 'android', version: '1.4.0' },
      { android: '1.4.0', ios: '9.0.0' },
    ),
  ).not.toThrow();
  expect(() =>
    assertInstalledClientVersionAtLeast(
      { platform: 'ios', version: '1.3.9' },
      { android: '1.0.0', ios: '1.4.0' },
    ),
  ).toThrow('below required minimum 1.4.0');
  expect(() =>
    assertInstalledClientVersionAtLeast(
      { platform: 'ios', version: '1.4.0-rc.1' },
      '1.4.0',
    ),
  ).toThrow('below required minimum 1.4.0');
});
