export type InstalledClientPlatform = 'android' | 'ios' | 'web';

export type NativeInstalledClientPlatform = Exclude<
  InstalledClientPlatform,
  'web'
>;

export type InstalledClientIdentity = {
  platform: InstalledClientPlatform;
  version: string;
};

export type WebBuildClientIdentity = InstalledClientIdentity & {
  platform: 'web';
};

export type InstalledClientIdentityProvider = () => InstalledClientIdentity;

export type NativeMinimumClientVersions = Readonly<
  Record<NativeInstalledClientPlatform, string>
>;

export class ClientUpdateRequiredError extends Error {
  readonly installedVersion: string;
  readonly platform: InstalledClientPlatform;
  readonly requiredVersion: string;

  constructor(
    platform: InstalledClientPlatform,
    installedVersion: string,
    requiredVersion: string,
  ) {
    super(
      `Installed ${platform} client version ${installedVersion} is below required minimum ${requiredVersion}.`,
    );
    this.name = 'ClientUpdateRequiredError';
    this.platform = platform;
    this.installedVersion = installedVersion;
    this.requiredVersion = requiredVersion;
  }
}

export function findClientUpdateRequiredError(
  error: unknown,
): ClientUpdateRequiredError | null {
  const pending: unknown[] = [error];
  const visited = new Set<unknown>();

  while (pending.length > 0 && visited.size < 12) {
    const current = pending.shift();
    if (current instanceof ClientUpdateRequiredError) {
      return current;
    }
    if (
      current === null ||
      (typeof current !== 'object' && typeof current !== 'function') ||
      visited.has(current)
    ) {
      continue;
    }
    visited.add(current);
    const nested = current as {cause?: unknown; integrityCause?: unknown};
    if (nested.cause !== undefined) pending.push(nested.cause);
    if (nested.integrityCause !== undefined) pending.push(nested.integrityCause);
  }
  return null;
}

type ParsedSemanticVersion = {
  major: string;
  minor: string;
  patch: string;
  prerelease: string[] | null;
};

const SEMANTIC_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function createWebBuildClientIdentity(
  version: string,
): WebBuildClientIdentity {
  return {
    platform: 'web',
    version: requireSemanticVersion(version, 'Web build version'),
  };
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
  minimumVersion: string | NativeMinimumClientVersions,
): void {
  if (
    !isRecord(identity) ||
    (identity.platform !== 'android' &&
      identity.platform !== 'ios' &&
      identity.platform !== 'web')
  ) {
    throw new Error('Installed client identity is invalid.');
  }

  const installedVersion = requireSemanticVersion(
    identity.version,
    'Installed client version',
  );

  if (typeof minimumVersion !== 'string' && identity.platform === 'web') {
    throw new Error(
      'Controlled-pilot native minimum client versions do not authorize web builds.',
    );
  }

  const requiredVersion = requireSemanticVersion(
    typeof minimumVersion === 'string'
      ? minimumVersion
      : minimumVersion[identity.platform as NativeInstalledClientPlatform],
    'Minimum client version',
  );

  if (compareSemanticVersions(installedVersion, requiredVersion) < 0) {
    throw new ClientUpdateRequiredError(
      identity.platform,
      installedVersion,
      requiredVersion,
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
