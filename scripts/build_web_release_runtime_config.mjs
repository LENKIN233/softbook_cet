#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
import {lstatSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  canonicalJsonBytes,
  sha256,
  validateMobileReleaseRuntimeProfile,
} from './lib/mobile_release_runtime_profile.mjs';
import {parseStrictJson} from './lib/strict_json.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function buildWebReleaseRuntimeConfig({
  allowRepositoryFixture = false,
  outputPath,
  profilePath,
  repositoryCommit = readRepositoryCommit(),
} = {}) {
  if (!outputPath || !profilePath) {
    throw new Error('Web release runtime config requires input and output paths.');
  }
  const stat = lstatSync(profilePath, {throwIfNoEntry: false});
  if (!stat?.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 64 * 1024) {
    throw new Error('Web release runtime input must be a bounded regular file.');
  }
  const profileBytes = readFileSync(profilePath);
  const profile = validateMobileReleaseRuntimeProfile(
    parseStrictJson(profileBytes, 'Web release runtime profile'),
    allowRepositoryFixture
      ? {allowRepositoryFixture: true}
      : {expectedCommit: repositoryCommit},
  );
  if (
    (profile.configuration_class !== 'receiver_release' &&
      !(
        allowRepositoryFixture &&
        profile.configuration_class === 'repository_fixture' &&
        profile.gate_eligible === false
      )) ||
    !profileBytes.equals(canonicalJsonBytes(profile))
  ) {
    throw new Error(
      'Web release requires canonical receiver_release profile bytes.',
    );
  }
  const publicKeys = Object.fromEntries(
    profile.content_manifest_public_keys.map(item => [
      item.key_id,
      item.public_key_hex,
    ]),
  );
  const bytes = Buffer.from(
    [
      'window.__SOFTBOOK_WEB_RUNTIME__ = Object.freeze({',
      `  baseUrl: ${JSON.stringify(profile.api_base_url)},`,
      "  clientKind: 'web',",
      `  contentManifestPublicKeys: Object.freeze(${JSON.stringify(publicKeys)}),`,
      "  mode: 'remote',",
      `  track: ${JSON.stringify(profile.learning_track)},`,
      '});',
      '',
    ].join('\n'),
  );
  const outputStat = lstatSync(outputPath, {throwIfNoEntry: false});
  if (outputStat && (!outputStat.isFile() || outputStat.isSymbolicLink())) {
    throw new Error('Web release runtime output must be a regular file path.');
  }
  writeFileSync(outputPath, bytes, {flag: 'w', mode: 0o644});
  return {
    schema_version: 'web-release-runtime-config-build-report.v1',
    output: resolve(outputPath),
    profile_id: profile.profile_id,
    environment_id: profile.environment_id,
    commit_sha: profile.commit_sha,
    key_ids: Object.keys(publicKeys),
    sha256: sha256(bytes),
    size_bytes: bytes.length,
    contains_secrets: false,
  };
}

function readRepositoryCommit() {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      process.stdout.write(
        'Usage: node scripts/build_web_release_runtime_config.mjs --profile <mobile-release-runtime-profile.json> --output <runtime-config.js>\n',
      );
    } else {
      const report = buildWebReleaseRuntimeConfig({
        allowRepositoryFixture: process.argv.includes(
          '--allow-repository-fixture',
        ),
        outputPath: resolve(option('--output') ?? ''),
        profilePath: resolve(option('--profile') ?? ''),
      });
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    }
  } catch (error) {
    process.stderr.write(`[web-release-runtime-config] ${error.message}\n`);
    process.exitCode = 1;
  }
}
