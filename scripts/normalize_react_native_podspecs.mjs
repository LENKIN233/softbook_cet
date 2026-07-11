#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PODSPECS = [
  {
    name: 'Hermes',
    path: path.join(
      ROOT,
      'apps/mobile/node_modules/react-native/sdks/hermes-engine/hermes-engine.podspec',
    ),
    normalize: normalizeHermesPodspec,
  },
  {
    name: 'Yoga',
    path: path.join(
      ROOT,
      'apps/mobile/node_modules/react-native/ReactCommon/yoga/Yoga.podspec',
    ),
    normalize: normalizeYogaPodspec,
  },
];

const HERMES_REPLACEMENTS = [
  {
    name: 'prepare_command',
    original: `    spec.prepare_command = ". '#{react_native_path}/sdks/hermes-engine/utils/create-dummy-hermes-xcframework.sh'"`,
    normalized: `    spec.prepare_command = '. "\${SOFTBOOK_REACT_NATIVE_PATH}/sdks/hermes-engine/utils/create-dummy-hermes-xcframework.sh"'`,
  },
  {
    name: 'cmake_path',
    original: `      CMAKE_BINARY = Pod::Executable::which!('cmake')`,
    normalized: `      Pod::Executable::which!('cmake')\n      CMAKE_BINARY = 'cmake'`,
  },
];

const YOGA_REPLACEMENTS = [
  {
    name: 'private_header_order',
    original:
      '  spec.private_header_files = Dir.glob(all_header_files) - Dir.glob(public_header_files)',
    normalized:
      '  spec.private_header_files = Dir.glob(all_header_files).sort - Dir.glob(public_header_files).sort',
  },
];

function applyReplacements(content, replacements, podspecName) {
  let normalizedContent = content;
  const changed = [];

  for (const replacement of replacements) {
    if (normalizedContent.includes(replacement.normalized)) {
      continue;
    }
    if (!normalizedContent.includes(replacement.original)) {
      throw new Error(
        `React Native ${podspecName} podspec drifted at ${replacement.name}; review the upstream podspec before updating the normalizer.`,
      );
    }
    normalizedContent = normalizedContent.replace(
      replacement.original,
      replacement.normalized,
    );
    changed.push(replacement.name);
  }

  return {changed, content: normalizedContent};
}

export function normalizeHermesPodspec(content) {
  return applyReplacements(content, HERMES_REPLACEMENTS, 'Hermes');
}

export function normalizeYogaPodspec(content) {
  return applyReplacements(content, YOGA_REPLACEMENTS, 'Yoga');
}

function main() {
  const changed = [];

  for (const podspec of PODSPECS) {
    if (!fs.existsSync(podspec.path)) {
      throw new Error(
        `${podspec.name} podspec is unavailable at ${podspec.path}; run npm ci first.`,
      );
    }

    const current = fs.readFileSync(podspec.path, 'utf8');
    const result = podspec.normalize(current);
    if (result.changed.length > 0) {
      fs.writeFileSync(podspec.path, result.content);
      changed.push(...result.changed.map(field => `${podspec.name}.${field}`));
    }
  }

  console.log(
    changed.length > 0
      ? `Normalized React Native podspec fields: ${changed.join(', ')}`
      : 'React Native podspecs are already normalized.',
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
