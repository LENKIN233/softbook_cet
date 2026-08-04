#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE_ROOT = path.join(ROOT, 'apps', 'mobile');
const LOCK_PATH = path.join(MOBILE_ROOT, 'package-lock.json');
const ORIGINAL_IMPORT = "var expand = require('brace-expansion')";
const NORMALIZED_IMPORT = `var braceExpansion = require('brace-expansion')
var expand = typeof braceExpansion === 'function'
  ? braceExpansion
  : braceExpansion.expand`;

export function normalizeMinimatchSource(content) {
  const normalizedCount = content.split(NORMALIZED_IMPORT).length - 1;
  const originalCount = content.split(ORIGINAL_IMPORT).length - 1;

  if (normalizedCount === 1 && originalCount === 0) {
    return {changed: false, content};
  }
  if (normalizedCount > 0) {
    throw new Error(
      'minimatch@3 contains an ambiguous normalized import; review upstream.',
    );
  }
  if (originalCount === 0) {
    throw new Error(
      'minimatch@3 import shape drifted; review upstream before updating the normalizer.',
    );
  }
  if (originalCount !== 1) {
    throw new Error(
      'minimatch@3 contains multiple brace-expansion imports; review upstream.',
    );
  }
  return {
    changed: true,
    content: content.replace(ORIGINAL_IMPORT, NORMALIZED_IMPORT),
  };
}

export function legacyMinimatchPackages(lock) {
  return Object.entries(lock.packages ?? {})
    .filter(
      ([packagePath, metadata]) =>
        packagePath.endsWith('/minimatch') &&
        typeof metadata?.version === 'string' &&
        metadata.version.startsWith('3.'),
    )
    .map(([packagePath, metadata]) => ({
      packagePath,
      version: metadata.version,
    }))
    .sort((left, right) => left.packagePath.localeCompare(right.packagePath));
}

function validatePatchedDependency(packageDirectory) {
  const requireFromMinimatch = createRequire(
    path.join(packageDirectory, 'minimatch.js'),
  );
  const bracePackagePath = requireFromMinimatch.resolve(
    'brace-expansion/package.json',
  );
  const bracePackage = JSON.parse(fs.readFileSync(bracePackagePath, 'utf8'));
  const braceExpansion = requireFromMinimatch('brace-expansion');

  if (bracePackage.version !== '5.0.9') {
    throw new Error(
      `Expected brace-expansion@5.0.9 for ${packageDirectory}; found ${bracePackage.version}.`,
    );
  }
  if (typeof braceExpansion.expand !== 'function') {
    throw new Error(
      `brace-expansion@5.0.9 does not expose expand for ${packageDirectory}.`,
    );
  }
}

function main() {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
  const packages = legacyMinimatchPackages(lock);

  if (packages.length === 0) {
    throw new Error(
      'No minimatch@3 packages were found; remove the compatibility normalizer with its override.',
    );
  }

  const changed = [];
  for (const entry of packages) {
    const packageDirectory = path.join(MOBILE_ROOT, entry.packagePath);
    const packageJsonPath = path.join(packageDirectory, 'package.json');
    const sourcePath = path.join(packageDirectory, 'minimatch.js');

    if (!fs.existsSync(packageJsonPath) || !fs.existsSync(sourcePath)) {
      throw new Error(
        `minimatch@${entry.version} is unavailable at ${packageDirectory}; run npm ci first.`,
      );
    }

    const installedPackage = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf8'),
    );
    if (installedPackage.version !== entry.version) {
      throw new Error(
        `Lockfile expects minimatch@${entry.version} at ${packageDirectory}; found ${installedPackage.version}.`,
      );
    }

    validatePatchedDependency(packageDirectory);
    const current = fs.readFileSync(sourcePath, 'utf8');
    const result = normalizeMinimatchSource(current);
    if (result.changed) {
      fs.writeFileSync(sourcePath, result.content);
      changed.push(entry.packagePath);
    }
  }

  console.log(
    changed.length > 0
      ? `Normalized minimatch@3 brace-expansion imports: ${changed.join(', ')}`
      : 'minimatch@3 brace-expansion imports are already normalized.',
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
