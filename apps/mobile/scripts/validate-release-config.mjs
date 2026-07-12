#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {
  validateExternalAccountReadiness,
  validateLaunchReadiness,
} from '../../../scripts/validate_launch_readiness.mjs';

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

const SIGNING_VARIABLES = [
  'SOFTBOOK_ANDROID_KEYSTORE_FILE',
  'SOFTBOOK_ANDROID_KEYSTORE_PASSWORD',
  'SOFTBOOK_ANDROID_KEY_ALIAS',
  'SOFTBOOK_ANDROID_KEY_PASSWORD',
];

export function validateReleaseEnvironment(
  platform,
  env,
  {launchReady = true} = {},
) {
  if (platform !== 'ios' && platform !== 'android') {
    return {ok: false, errors: ['platform must be ios or android.']};
  }
  if (env.SOFTBOOK_ALLOW_INCOMPLETE_RELEASE === '1') {
    if (env.CI !== 'true') {
      return {
        ok: false,
        errors: [
          'SOFTBOOK_ALLOW_INCOMPLETE_RELEASE is restricted to CI structural verification.',
        ],
        incompleteArtifact: false,
      };
    }
    return {ok: true, errors: [], incompleteArtifact: true};
  }

  const errors = [];
  if (!launchReady) {
    errors.push(
      'Tracked launch readiness is not ready; distributable Release builds are blocked.',
    );
  }
  const baseUrl = env.SOFTBOOK_CET_REMOTE_BASE_URL?.trim();
  if (!baseUrl) {
    errors.push('SOFTBOOK_CET_REMOTE_BASE_URL is required for Release builds.');
  } else {
    try {
      const parsed = new URL(baseUrl);
      if (parsed.protocol !== 'https:') {
        errors.push('SOFTBOOK_CET_REMOTE_BASE_URL must use HTTPS.');
      }
      if (parsed.username || parsed.password) {
        errors.push('SOFTBOOK_CET_REMOTE_BASE_URL must not contain credentials.');
      }
    } catch {
      errors.push('SOFTBOOK_CET_REMOTE_BASE_URL must be a valid URL.');
    }
  }

  if (platform === 'android') {
    for (const variable of SIGNING_VARIABLES) {
      if (!env[variable]?.trim()) {
        errors.push(`${variable} is required for Android Release builds.`);
      }
    }
  }

  return {ok: errors.length === 0, errors, incompleteArtifact: false};
}

function main() {
  const platformIndex = process.argv.indexOf('--platform');
  const platform = platformIndex >= 0 ? process.argv[platformIndex + 1] : '';
  const result = validateReleaseEnvironment(platform, process.env, {
    launchReady: readTrackedLaunchReadiness(),
  });

  if (result.incompleteArtifact) {
    console.warn(
      'Release configuration bypassed for an explicitly incomplete, non-distributable artifact.',
    );
  }
  for (const error of result.errors) {
    console.error(`error: ${error}`);
  }
  if (!result.ok) {
    process.exitCode = 1;
  }
}

export function readTrackedLaunchReadiness() {
  const contract = JSON.parse(
    fs.readFileSync(
      path.join(
        REPOSITORY_ROOT,
        'docs',
        'release',
        'launch-readiness.v1.json',
      ),
      'utf8',
    ),
  );
  const accounts = JSON.parse(
    fs.readFileSync(
      path.join(
        REPOSITORY_ROOT,
        'docs',
        'release',
        'external-account-readiness.v1.json',
      ),
      'utf8',
    ),
  );
  const contractResult = validateLaunchReadiness(contract);
  const accountResult = validateExternalAccountReadiness(accounts, contract);
  return (
    contractResult.ok &&
    contractResult.ready &&
    accountResult.ok &&
    accountResult.ready
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
