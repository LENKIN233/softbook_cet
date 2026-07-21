#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {validateCardSourceCatalogMapping} from './card-source-catalog.mjs';
import {
  CARD_SOURCE_COLLECTION,
  createQueryCurrentCardSourceCommand,
  parseQueryCurrentCardSourceResult,
} from './card-source-import-commands.mjs';

const require = createRequire(import.meta.url);
const {validateCardSourceForImport} = require('./functions/softbook-api');

const DEFAULT_ENV_ID = 'test-d2gzcyxr9f7e80972';
const DEFAULT_TRACKS = ['cet4', 'cet6'];
const QUERY_TIMEOUT_MILLISECONDS = 30_000;

function printUsage() {
  console.log(`Usage: node infra/cloudbase/audit-card-sources.mjs [--env <env-id>] [--track cet4|cet6]

Audits existing CloudBase card-source documents read-only. Repeat --track to narrow the check.`);
}

function parseArgs(argv) {
  const options = {
    envId: process.env.CLOUDBASE_ENV_ID || DEFAULT_ENV_ID,
    tracks: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--env':
        options.envId = requireNextValue(argv, index, arg);
        index += 1;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      case '--track':
        options.tracks.push(requireTrack(requireNextValue(argv, index, arg)));
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return {
    ...options,
    tracks: options.tracks.length > 0 ? options.tracks : DEFAULT_TRACKS,
  };
}

function requireNextValue(argv, index, optionName) {
  const value = argv[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`${optionName} requires a value.`);
  }

  return value;
}

function requireTrack(value) {
  if (value !== 'cet4' && value !== 'cet6') {
    throw new Error('track must be cet4 or cet6.');
  }

  return value;
}

function runQuery(options, track) {
  const result = spawnSync(
    'tcb',
    [
      'db',
      'nosql',
      'execute',
      '-e',
      options.envId,
      '--command',
      createQueryCurrentCardSourceCommand(track),
      '--json',
    ],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: QUERY_TIMEOUT_MILLISECONDS,
    },
  );

  if (result.error) {
    throw new Error(`Failed to run tcb: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(
      `tcb query failed for ${track}: ${result.stderr || result.stdout}`.trim(),
    );
  }

  const document = parseQueryCurrentCardSourceResult(result.stdout, track);

  if (!document) {
    throw new Error(`${CARD_SOURCE_COLLECTION}.${track} is missing.`);
  }

  return document;
}

function interactionSummary(cardRecords) {
  return [...new Set(cardRecords.map(card => card.interaction_id))].sort();
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));

    for (const track of options.tracks) {
      const document = runQuery(options, track);
      const cardSource = validateCardSourceCatalogMapping(
        validateCardSourceForImport(document, track),
      );
      const interactions = interactionSummary(cardSource.card_records);
      const updatedAt = document.updated_at ?? 'unknown';
      const releaseId = cardSource.release?.release_id ?? 'none';

      console.log(
        `[ok] ${track}: ${cardSource.card_records.length} cards from ${cardSource.source.id}; interactions=${interactions.join(',')}; version=${cardSource.content_version}; release_id=${releaseId}; updated_at=${updatedAt}`,
      );
    }

    console.log(`[ok] audited ${options.tracks.length} track(s) in ${options.envId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[card-source-audit] ${message}`);
    process.exit(1);
  }
}

main();
