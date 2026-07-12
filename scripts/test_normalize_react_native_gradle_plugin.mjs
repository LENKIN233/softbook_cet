#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {normalizeReactNativeGradlePlugin} from './normalize_react_native_gradle_plugin.mjs';

test('normalizer upgrades the Gradle 9-incompatible Foojay resolver', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-gradle-'));
  const settingsPath = path.join(directory, 'settings.gradle.kts');
  fs.writeFileSync(
    settingsPath,
    'plugins { id("org.gradle.toolchains.foojay-resolver-convention").version("0.5.0") }\n',
  );

  const result = normalizeReactNativeGradlePlugin(settingsPath);

  assert.equal(result.changed, true);
  assert.match(fs.readFileSync(settingsPath, 'utf8'), /version\("1\.0\.0"\)/);
});

test('normalizer is idempotent', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-gradle-'));
  const settingsPath = path.join(directory, 'settings.gradle.kts');
  fs.writeFileSync(
    settingsPath,
    'plugins { id("org.gradle.toolchains.foojay-resolver-convention").version("1.0.0") }\n',
  );

  const result = normalizeReactNativeGradlePlugin(settingsPath);

  assert.deepEqual(result, {changed: false, skipped: false});
});

test('normalizer fails visibly when the upstream declaration changes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-gradle-'));
  const settingsPath = path.join(directory, 'settings.gradle.kts');
  fs.writeFileSync(settingsPath, 'plugins {}\n');

  assert.throws(
    () => normalizeReactNativeGradlePlugin(settingsPath),
    /review the compatibility patch/,
  );
});
