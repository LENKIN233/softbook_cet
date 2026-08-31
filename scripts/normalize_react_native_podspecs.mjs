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

const HERMESC_XCODE_SCRIPT = {
  name: 'Hermesc Xcode environment',
  path: path.join(
    ROOT,
    'apps/mobile/node_modules/react-native/sdks/hermes-engine/utils/build-hermesc-xcode.sh',
  ),
  normalize: normalizeHermescXcodeScript,
};

const HERMES_BUILD_XCODE_SCRIPT = {
  name: 'Hermes Xcode build cache',
  path: path.join(
    ROOT,
    'apps/mobile/node_modules/react-native/sdks/hermes-engine/utils/build-hermes-xcode.sh',
  ),
  normalize: normalizeHermesBuildXcodeScript,
};

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

export function normalizeHermescXcodeScript(content) {
  const original = 'env -i \\\n  PATH="$PATH" \\\n  SDKROOT="$SDKROOT" \\';
  const normalized = 'env -i \\\n  HOME="$HOME" \\\n  PATH="$PATH" \\\n  SDKROOT="$SDKROOT" \\';
  const normalizedCount = content.split(normalized).length - 1;
  if (normalizedCount === 2) {
    return {changed: [], content};
  }
  const originalCount = content.split(original).length - 1;
  if (normalizedCount !== 0 || originalCount !== 2) {
    throw new Error(
      'React Native Hermesc Xcode script drifted at isolated environment; review the upstream script before updating the normalizer.',
    );
  }
  return {
    changed: ['isolated_environment_home'],
    content: content.replaceAll(original, normalized),
  };
}

export function normalizeHermesBuildXcodeScript(content) {
  const anchor = 'architectures=$( echo "$ARCHS" | tr  " " ";" )\n';
  const guard = `
build_directory="\${PODS_ROOT}/hermes-engine/build/\${PLATFORM_NAME}"
cache_file="\${build_directory}/CMakeCache.txt"
if [[ -f "$cache_file" ]]; then
  cached_architectures=$(sed -n 's/^CMAKE_OSX_ARCHITECTURES:STRING=//p' "$cache_file")
  cached_sysroots=$(sed -n 's/^CMAKE_APPLE_ARCH_SYSROOTS:INTERNAL=//p' "$cache_file")
  architecture_count=$(awk -F';' '{print NF}' <<< "$architectures")
  sysroot_count=$(awk -F';' '{print NF}' <<< "$cached_sysroots")
  if [[ "$cached_architectures" != "$architectures" || -n "$cached_sysroots" && "$sysroot_count" != "$architecture_count" ]]; then
    rm -f "$cache_file"
  fi
fi
`;
  if (content.includes(guard)) {
    return {changed: [], content};
  }
  if ((content.split(anchor).length - 1) !== 1) {
    throw new Error(
      'React Native Hermes Xcode build script drifted at architecture resolution; review the upstream script before updating the normalizer.',
    );
  }
  return {
    changed: ['architecture_cache_guard'],
    content: content.replace(anchor, `${anchor}${guard}`),
  };
}

function main() {
  const changed = [];

  for (const podspec of [
    ...PODSPECS,
    HERMESC_XCODE_SCRIPT,
    HERMES_BUILD_XCODE_SCRIPT,
  ]) {
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
