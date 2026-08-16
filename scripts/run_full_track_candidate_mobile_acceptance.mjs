#!/usr/bin/env node

import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  AudioBundleCandidateMobileAcceptanceError,
  runFullTrackCandidateMobileAcceptance,
} from './run_audio_bundle_candidate_mobile_acceptance.mjs';

function parseArgs(argv) {
  const options = {};
  const names = new Map([
    ['--candidate-payload', 'candidatePayloadPath'],
    ['--checked-at', 'checkedAt'],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const key = names.get(argv[index]);
    const value = argv[index + 1];
    if (!key || !value || value.startsWith('--')) {
      throw new AudioBundleCandidateMobileAcceptanceError(
        `Unknown or incomplete argument: ${argv[index]}`,
      );
    }
    options[key] = value;
    index += 1;
  }
  if (!options.candidatePayloadPath) {
    throw new AudioBundleCandidateMobileAcceptanceError(
      'Missing required option for candidatePayloadPath.',
    );
  }
  return options;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    console.log(
      JSON.stringify(
        runFullTrackCandidateMobileAcceptance(parseArgs(process.argv.slice(2))),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(`[full-track-mobile-acceptance] ${error.message}`);
    process.exitCode = 1;
  }
}
