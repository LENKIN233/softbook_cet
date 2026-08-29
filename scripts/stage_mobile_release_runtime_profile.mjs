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

export function stageMobileReleaseRuntimeProfile({
  allowRepositoryFixture = false,
  inputPath,
  outputPath,
  repositoryCommit = readRepositoryCommit(),
}) {
  const stat = lstatSync(inputPath, {throwIfNoEntry: false});
  if (!stat?.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 64 * 1024) {
    throw new Error('Mobile release runtime input must be a regular file up to 64 KiB.');
  }
  const bytes = readFileSync(inputPath);
  const profile = validateMobileReleaseRuntimeProfile(
    parseStrictJson(bytes, 'mobile release runtime profile'),
    {
      allowRepositoryFixture,
      expectedCommit: repositoryCommit,
    },
  );
  if (!bytes.equals(canonicalJsonBytes(profile))) {
    throw new Error('Mobile release runtime profile bytes are not canonical.');
  }
  const outputStat = lstatSync(outputPath, {throwIfNoEntry: false});
  if (outputStat && (!outputStat.isFile() || outputStat.isSymbolicLink())) {
    throw new Error('Mobile release runtime output must be a regular file path.');
  }
  writeFileSync(outputPath, bytes, {flag: 'w', mode: 0o644});
  return {
    schema_version: 'mobile-release-runtime-profile-stage-report.v1',
    configuration_class: profile.configuration_class,
    profile_id: profile.profile_id,
    environment_id: profile.environment_id,
    sha256: sha256(bytes),
    size_bytes: bytes.length,
  };
}

function readRepositoryCommit() {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
}

function option(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const inputPath = option(process.argv, '--input');
    const outputPath = option(process.argv, '--output');
    if (!inputPath || !outputPath) {
      throw new Error(
        'Usage: stage_mobile_release_runtime_profile.mjs --input <file> --output <file> [--allow-repository-fixture]',
      );
    }
    console.log(
      JSON.stringify(
        stageMobileReleaseRuntimeProfile({
          allowRepositoryFixture: process.argv.includes('--allow-repository-fixture'),
          inputPath: resolve(inputPath),
          outputPath: resolve(outputPath),
        }),
      ),
    );
  } catch (error) {
    console.error(`[mobile-release-runtime-stage] ${error.message}`);
    process.exitCode = 1;
  }
}
