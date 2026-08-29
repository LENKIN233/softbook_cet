#!/usr/bin/env node

import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {validateDeliveryProfile} from '../infra/cloudbase/release-delivery-v1.mjs';
import {
  canonicalJsonBytes,
  createMobileReleaseRuntimeProfile,
  sha256,
} from './lib/mobile_release_runtime_profile.mjs';
import {parseStrictJson} from './lib/strict_json.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function buildMobileReleaseRuntimeProfile({
  commitSha,
  deliveryProfilePath,
  outputPath,
  publicKeyringPath,
}) {
  const deliveryBytes = readFileSync(deliveryProfilePath);
  const keyringBytes = readFileSync(publicKeyringPath);
  const deliveryProfile = validateDeliveryProfile(
    parseStrictJson(deliveryBytes, 'delivery profile'),
  );
  if (
    deliveryProfile.runtime_mode !== 'closed_beta' ||
    JSON.stringify(deliveryProfile.enabled_tracks) !== JSON.stringify(['cet4'])
  ) {
    throw new Error('Mobile closed-beta runtime requires a CET4-only delivery profile.');
  }
  const profile = createMobileReleaseRuntimeProfile({
    commitSha,
    deliveryProfile,
    deliveryProfileBytes: deliveryBytes,
    publicKeyring: parseStrictJson(keyringBytes, 'content manifest public keyring'),
    publicKeyringBytes: keyringBytes,
  });
  const bytes = canonicalJsonBytes(profile);
  if (bytes.length > 64 * 1024) throw new Error('Mobile release runtime profile exceeds 64 KiB.');
  if (existsSync(outputPath)) throw new Error('Mobile release runtime output already exists.');
  writeFileSync(outputPath, bytes, {flag: 'wx', mode: 0o600});
  return {
    schema_version: 'mobile-release-runtime-profile-build-report.v1',
    output: outputPath,
    profile_id: profile.profile_id,
    environment_id: profile.environment_id,
    commit_sha: profile.commit_sha,
    sha256: sha256(bytes),
    size_bytes: bytes.length,
    contains_secrets: false,
  };
}

function option(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const deliveryProfilePath = option(process.argv, '--delivery-profile');
    const publicKeyringPath = option(process.argv, '--public-keyring');
    const commitSha = option(process.argv, '--commit');
    const outputPath = option(process.argv, '--output');
    if (!deliveryProfilePath || !publicKeyringPath || !commitSha || !outputPath) {
      throw new Error(
        'Usage: build_mobile_release_runtime_profile.mjs --delivery-profile <file> --public-keyring <file> --commit <sha> --output <file>',
      );
    }
    console.log(
      JSON.stringify(
        buildMobileReleaseRuntimeProfile({
          commitSha,
          deliveryProfilePath: resolve(ROOT, deliveryProfilePath),
          publicKeyringPath: resolve(ROOT, publicKeyringPath),
          outputPath: resolve(ROOT, outputPath),
        }),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(`[mobile-release-runtime] ${error.message}`);
    process.exitCode = 1;
  }
}
