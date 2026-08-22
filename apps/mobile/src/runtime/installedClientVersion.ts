import { NativeModules, Platform } from 'react-native';

export type InstalledClientPlatform = 'android' | 'ios';

export type InstalledClientIdentity = {
  platform: InstalledClientPlatform;
  version: string;
};

export type InstalledClientIdentityProvider = () => InstalledClientIdentity;

type ParsedSemanticVersion = {
  major: string;
  minor: string;
  patch: string;
  prerelease: string[] | null;
};

const SEMANTIC_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

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

  const version = requireSemanticVersion(
    appInfo.version,
    'Installed client version',
  );
  return { platform: runtimePlatform, version };
}

export function isStrictSemanticVersion(value: unknown): value is string {
  try {
    parseSemanticVersion(value, 'Semantic version');
    return true;
  } catch {
    return false;
  }
}

export function compareSemanticVersions(
  left: string,
  right: string,
): -1 | 0 | 1 {
  const leftVersion = parseSemanticVersion(left, 'Left semantic version');
  const rightVersion = parseSemanticVersion(right, 'Right semantic version');

  for (const field of ['major', 'minor', 'patch'] as const) {
    const comparison = compareNumericIdentifiers(
      leftVersion[field],
      rightVersion[field],
    );
    if (comparison !== 0) {
      return comparison;
    }
  }

  return comparePrereleaseIdentifiers(
    leftVersion.prerelease,
    rightVersion.prerelease,
  );
}

export function assertInstalledClientVersionAtLeast(
  identity: InstalledClientIdentity,
  minimumVersion: string | Readonly<Record<InstalledClientPlatform, string>>,
): void {
  if (
    !isRecord(identity) ||
    (identity.platform !== 'android' && identity.platform !== 'ios')
  ) {
    throw new Error('Installed client identity is invalid.');
  }

  const installedVersion = requireSemanticVersion(
    identity.version,
    'Installed client version',
  );
  const requiredVersion = requireSemanticVersion(
    typeof minimumVersion === 'string'
      ? minimumVersion
      : minimumVersion[identity.platform],
    'Minimum client version',
  );

  if (compareSemanticVersions(installedVersion, requiredVersion) < 0) {
    throw new Error(
      `Installed ${identity.platform} client version ${installedVersion} is below required minimum ${requiredVersion}.`,
    );
  }
}

function parseSemanticVersion(
  value: unknown,
  label: string,
): ParsedSemanticVersion {
  if (typeof value !== 'string') {
    throw new Error(`${label} must use strict semantic version form.`);
  }

  const match = SEMANTIC_VERSION_PATTERN.exec(value);
  if (!match) {
    throw new Error(`${label} must use strict semantic version form.`);
  }

  const prerelease = match[4]?.split('.') ?? null;
  if (
    prerelease?.some(
      identifier =>
        /^\d+$/.test(identifier) &&
        identifier.length > 1 &&
        identifier[0] === '0',
    )
  ) {
    throw new Error(`${label} must use strict semantic version form.`);
  }

  return {
    major: match[1],
    minor: match[2],
    patch: match[3],
    prerelease,
  };
}

function requireSemanticVersion(value: unknown, label: string): string {
  parseSemanticVersion(value, label);
  return value as string;
}

function compareNumericIdentifiers(left: string, right: string): -1 | 0 | 1 {
  if (left.length !== right.length) {
    return left.length < right.length ? -1 : 1;
  }
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function comparePrereleaseIdentifiers(
  left: string[] | null,
  right: string[] | null,
): -1 | 0 | 1 {
  if (left === null || right === null) {
    if (left === right) {
      return 0;
    }
    return left === null ? 1 : -1;
  }

  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = left[index];
    const rightIdentifier = right[index];
    if (leftIdentifier === undefined || rightIdentifier === undefined) {
      if (leftIdentifier === rightIdentifier) {
        return 0;
      }
      return leftIdentifier === undefined ? -1 : 1;
    }
    if (leftIdentifier === rightIdentifier) {
      continue;
    }

    const leftIsNumeric = /^\d+$/.test(leftIdentifier);
    const rightIsNumeric = /^\d+$/.test(rightIdentifier);
    if (leftIsNumeric && rightIsNumeric) {
      return compareNumericIdentifiers(leftIdentifier, rightIdentifier);
    }
    if (leftIsNumeric !== rightIsNumeric) {
      return leftIsNumeric ? -1 : 1;
    }
    return leftIdentifier < rightIdentifier ? -1 : 1;
  }

  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
