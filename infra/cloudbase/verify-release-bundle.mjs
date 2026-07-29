#!/usr/bin/env node

import {fileURLToPath} from 'node:url';
import {verifyReleaseBundleDirectory} from './release-delivery-v1.mjs';

export function parseArguments(argv) {
  const options = {bundlePath: null, profilePath: null, format: 'text'};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case '--bundle':
        options.bundlePath = requireValue(argv, index, argument);
        index += 1;
        break;
      case '--profile':
        options.profilePath = requireValue(argv, index, argument);
        index += 1;
        break;
      case '--format':
        options.format = requireValue(argv, index, argument);
        index += 1;
        break;
      case '--help':
      case '-h':
        return {help: true};
      default:
        throw argumentError(`Unknown argument: ${argument}`);
    }
  }

  if (!options.bundlePath || !options.profilePath) {
    throw argumentError('--bundle and --profile are required.');
  }
  if (!['json', 'text'].includes(options.format)) {
    throw argumentError('--format must be text or json.');
  }
  return options;
}

export function verifyFromArguments(options) {
  const verified = verifyReleaseBundleDirectory({
    bundlePath: options.bundlePath,
    profilePath: options.profilePath,
  });
  return {
    schema_version: 'release-bundle-verification.v1',
    ok: true,
    profile_id: verified.profile.profile_id,
    environment_id: verified.profile.environment_id,
    release_id: verified.bundle.release_id,
    track: verified.bundle.track,
    content_version: verified.bundle.content.content_version,
    card_count: verified.content.card_records.length,
    box_count: new Set(
      verified.content.card_records.map(card => card.knowledge_ref),
    ).size,
    audio_asset_count: verified.audio_manifest.assets.length,
    audio_qc_count: verified.audio_qc_index.assets.length,
    approval_id: verified.bundle.approval.approval_id,
    ready_for_publisher: true,
    cloudbase_writes_performed: false,
  };
}

export function printResult(result, format) {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(
    [
      `[release-bundle] verified ${result.release_id} for ${result.environment_id}`,
      `[release-bundle] ${result.card_count} cards / ${result.box_count} boxes / ${result.audio_asset_count} audio / ${result.audio_qc_count} QC`,
      `[release-bundle] approval=${result.approval_id}; content_version=${result.content_version}`,
      '[release-bundle] no CloudBase write was performed.',
    ].join('\n'),
  );
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      printUsage();
      return;
    }
    printResult(verifyFromArguments(options), options.format);
  } catch (error) {
    console.error(`[release-bundle] ${safeMessage(error)}`);
    process.exitCode = error?.exitCode ?? 1;
  }
}

function requireValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw argumentError(`${option} requires a value.`);
  }
  return value;
}

function argumentError(message) {
  const error = new Error(message);
  error.exitCode = 2;
  return error;
}

function safeMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function printUsage() {
  console.log(`Usage:
  node infra/cloudbase/verify-release-bundle.mjs --profile <delivery-profile.json> --bundle <release-bundle.json> [--format text|json]

This command is read-only. It verifies every local release artifact and performs no CloudBase write.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
