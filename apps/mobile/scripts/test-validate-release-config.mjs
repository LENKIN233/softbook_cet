#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readTrackedLaunchReadiness,
  validateReleaseEnvironment,
} from './validate-release-config.mjs';

test('iOS Release requires an HTTPS remote runtime URL', () => {
  assert.equal(validateReleaseEnvironment('ios', {}).ok, false);
  assert.match(
    validateReleaseEnvironment('ios', {
      SOFTBOOK_CET_REMOTE_BASE_URL: 'http://api.softbook.example',
    }).errors.join('\n'),
    /must use HTTPS/,
  );
  assert.equal(
    validateReleaseEnvironment('ios', {
      SOFTBOOK_CET_REMOTE_BASE_URL: 'https://api.softbook.example',
    }).ok,
    true,
  );
});

test('Android Release requires production signing inputs', () => {
  const result = validateReleaseEnvironment('android', {
    SOFTBOOK_CET_REMOTE_BASE_URL: 'https://api.softbook.example',
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /SOFTBOOK_ANDROID_KEYSTORE_FILE/);
  assert.match(result.errors.join('\n'), /SOFTBOOK_ANDROID_KEY_ALIAS/);
});

test('incomplete artifact bypass is restricted to CI structural verification', () => {
  const localResult = validateReleaseEnvironment('ios', {
    SOFTBOOK_ALLOW_INCOMPLETE_RELEASE: '1',
  });
  const ciResult = validateReleaseEnvironment('ios', {
    CI: 'true',
    SOFTBOOK_ALLOW_INCOMPLETE_RELEASE: '1',
  });

  assert.equal(localResult.ok, false);
  assert.match(localResult.errors.join('\n'), /restricted to CI/);
  assert.equal(ciResult.ok, true);
  assert.equal(ciResult.incompleteArtifact, true);
});

test('tracked not-ready launch state blocks distributable Release builds', () => {
  const result = validateReleaseEnvironment(
    'ios',
    {SOFTBOOK_CET_REMOTE_BASE_URL: 'https://api.softbook.example'},
    {launchReady: false},
  );

  assert.equal(readTrackedLaunchReadiness(), false);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /launch readiness is not ready/);
});
