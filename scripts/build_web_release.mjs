#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

import {buildWebReleaseRuntimeConfig} from './build_web_release_runtime_config.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const WEB_ROOT = resolve(ROOT, 'apps/web');

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

try {
  const profilePath = option('--runtime-profile') ??
    process.env.SOFTBOOK_WEB_RELEASE_RUNTIME_PROFILE;
  const allowRepositoryFixture =
    process.argv.includes('--allow-repository-fixture') ||
    process.env.SOFTBOOK_WEB_ALLOW_REPOSITORY_FIXTURE === '1';

  if (!profilePath) {
    throw new Error(
      'SOFTBOOK_WEB_RELEASE_RUNTIME_PROFILE or --runtime-profile is required.',
    );
  }

  execFileSync('npm', ['run', 'build:bundle'], {
    cwd: WEB_ROOT,
    env: process.env,
    stdio: 'inherit',
  });

  const report = buildWebReleaseRuntimeConfig({
    allowRepositoryFixture,
    outputPath: resolve(WEB_ROOT, 'dist/runtime-config.js'),
    profilePath: resolve(profilePath),
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`[web-release-build] ${error.message}\n`);
  process.exitCode = 1;
}
