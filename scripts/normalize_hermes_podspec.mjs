#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PODSPEC_PATH = path.join(
  ROOT,
  'apps/mobile/node_modules/react-native/sdks/hermes-engine/hermes-engine.podspec',
);

const REPLACEMENTS = [
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

export function normalizeHermesPodspec(content) {
  let normalizedContent = content;
  const changed = [];

  for (const replacement of REPLACEMENTS) {
    if (normalizedContent.includes(replacement.normalized)) {
      continue;
    }
    if (!normalizedContent.includes(replacement.original)) {
      throw new Error(
        `React Native Hermes podspec drifted at ${replacement.name}; review the upstream podspec before updating the normalizer.`,
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

function main() {
  if (!fs.existsSync(PODSPEC_PATH)) {
    throw new Error(`Hermes podspec is unavailable at ${PODSPEC_PATH}; run npm ci first.`);
  }

  const current = fs.readFileSync(PODSPEC_PATH, 'utf8');
  const result = normalizeHermesPodspec(current);
  if (result.changed.length > 0) {
    fs.writeFileSync(PODSPEC_PATH, result.content);
  }
  console.log(
    result.changed.length > 0
      ? `Normalized Hermes podspec fields: ${result.changed.join(', ')}`
      : 'Hermes podspec is already normalized.',
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
