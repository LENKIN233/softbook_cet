import {NativeModules, Platform} from 'react-native';

import {
  isStrictSemanticVersion,
  type InstalledClientIdentity,
} from './clientVersion';

export {
  assertInstalledClientVersionAtLeast,
  compareSemanticVersions,
  createWebBuildClientIdentity,
  isStrictSemanticVersion,
} from './clientVersion';
export type {
  InstalledClientIdentity,
  InstalledClientIdentityProvider,
  InstalledClientPlatform,
  NativeInstalledClientPlatform,
  NativeMinimumClientVersions,
  WebBuildClientIdentity,
} from './clientVersion';

export function readInstalledClientIdentity(): InstalledClientIdentity {
  const runtimePlatform = Platform.OS;
  if (runtimePlatform !== 'android' && runtimePlatform !== 'ios') {
    throw new Error('Installed client platform is unsupported.');
  }

  const appInfo = NativeModules.SoftbookAppInfo as unknown;
  if (!isRecord(appInfo)) {
    throw new Error('Installed client identity native module is unavailable.');
  }

  if (appInfo.platform !== runtimePlatform) {
    throw new Error(
      'Installed client identity platform does not match React Native Platform.OS.',
    );
  }

  if (!isStrictSemanticVersion(appInfo.version)) {
    throw new Error(
      'Installed client version must use strict semantic version form.',
    );
  }

  return {platform: runtimePlatform, version: appInfo.version};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
