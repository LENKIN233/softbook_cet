#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SETTINGS_PATH = path.join(
  ROOT,
  'apps',
  'mobile',
  'node_modules',
  '@react-native',
  'gradle-plugin',
  'settings.gradle.kts',
);
const LEGACY_PLUGIN =
  'id("org.gradle.toolchains.foojay-resolver-convention").version("0.5.0")';
const GRADLE_NINE_PLUGIN =
  'id("org.gradle.toolchains.foojay-resolver-convention").version("1.0.0")';

export function normalizeReactNativeGradlePlugin(settingsPath) {
  if (!fs.existsSync(settingsPath)) {
    return {changed: false, skipped: true};
  }

  const source = fs.readFileSync(settingsPath, 'utf8');
  if (source.includes(GRADLE_NINE_PLUGIN)) {
    return {changed: false, skipped: false};
  }
  if (!source.includes(LEGACY_PLUGIN)) {
    throw new Error(
      'React Native Gradle plugin changed its Foojay declaration; review the compatibility patch.',
    );
  }

  fs.writeFileSync(
    settingsPath,
    source.replace(LEGACY_PLUGIN, GRADLE_NINE_PLUGIN),
    'utf8',
  );
  return {changed: true, skipped: false};
}

function main() {
  const result = normalizeReactNativeGradlePlugin(DEFAULT_SETTINGS_PATH);
  if (result.changed) {
    console.log('Normalized React Native Foojay resolver for Gradle 9.');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
