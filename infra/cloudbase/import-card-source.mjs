#!/usr/bin/env node

import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {validateCardSourceCatalogMapping} from './card-source-catalog.mjs';
import {assertDevelopmentCardSourceImport} from './card-source-import-policy.mjs';
import {
  CARD_SOURCE_COLLECTION,
  CARD_SOURCE_VERSION_COLLECTION,
  createCardSourceImportCommand,
  createQueryCurrentCardSourceCommand,
  parseQueryCurrentCardSourceResult,
} from './card-source-import-commands.mjs';

const require = createRequire(import.meta.url);
const {validateCardSourceForImport} = require('./functions/softbook-api');

const DEFAULT_ENV_ID = 'test-d2gzcyxr9f7e80972';
const APPLY_TIMEOUT_MILLISECONDS = 60_000;
const QUERY_TIMEOUT_MILLISECONDS = 30_000;

function printUsage() {
  console.log(`Usage: node infra/cloudbase/import-card-source.mjs --file <card-source.json> [--track cet4|cet6] [--env <env-id>] [--apply]

Dry-run is the default. Pass --apply only after the validated summary matches the intended import.`);
}

function parseArgs(argv) {
  const options = {
    apply: false,
    envId: process.env.CLOUDBASE_ENV_ID || DEFAULT_ENV_ID,
    file: null,
    track: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--apply':
        options.apply = true;
        break;
      case '--env':
        options.envId = requireNextValue(argv, index, arg);
        index += 1;
        break;
      case '--file':
        options.file = requireNextValue(argv, index, arg);
        index += 1;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      case '--track':
        options.track = requireNextValue(argv, index, arg);
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function requireNextValue(argv, index, optionName) {
  const value = argv[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`${optionName} requires a value.`);
  }

  return value;
}

function readJsonFile(filePath) {
  const absolutePath = resolve(filePath);

  try {
    return JSON.parse(readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read JSON from ${absolutePath}: ${message}`);
  }
}

function interactionSummary(cardRecords) {
  return [...new Set(cardRecords.map(card => card.interaction_id))].sort();
}

function readCurrentCardSource(options, track) {
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
    throw new Error(
      `Failed to query the current card source: ${result.error.message}`,
    );
  }

  if (result.status !== 0) {
    throw new Error(
      `tcb query failed for ${track}: ${result.stderr || result.stdout}`.trim(),
    );
  }

  const document = parseQueryCurrentCardSourceResult(result.stdout, track);

  if (!document) {
    return null;
  }

  return validateCardSourceCatalogMapping(
    validateCardSourceForImport(document, track),
  );
}

function applyImport(options, cardSource) {
  const updatedAt = new Date().toISOString();
  const previousCardSource = readCurrentCardSource(options, cardSource.track);
  const command = createCardSourceImportCommand({
    cardSource,
    previousCardSource,
    updatedAt,
  });
  const result = spawnSync(
    'tcb',
    [
      'db',
      'nosql',
      'execute',
      '-e',
      options.envId,
      '--command',
      command,
      '--json',
    ],
    {
      stdio: 'inherit',
      timeout: APPLY_TIMEOUT_MILLISECONDS,
    },
  );

  if (result.error) {
    throw new Error(`Failed to run tcb: ${result.error.message}`);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log(
    `[applied] ${CARD_SOURCE_COLLECTION}.${cardSource.track} and ${CARD_SOURCE_VERSION_COLLECTION} in ${options.envId} at ${updatedAt}`,
  );
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (!options.file) {
      printUsage();
      process.exit(1);
    }

    const payload = readJsonFile(options.file);
    const track = options.track ?? payload.track;

    if (track !== 'cet4' && track !== 'cet6') {
      throw new Error('track must be cet4 or cet6.');
    }

    const cardSource = validateCardSourceCatalogMapping(
      validateCardSourceForImport(payload, track),
    );
    assertDevelopmentCardSourceImport(cardSource);
    const interactions = interactionSummary(cardSource.card_records);

    console.log(
      `[validated] ${cardSource.track}: ${cardSource.card_records.length} cards from ${cardSource.source.id}`,
    );
    console.log(
      `[validated] content_version=${cardSource.content_version}; release_id=${cardSource.release?.release_id ?? 'none'}`,
    );
    console.log(`[validated] interactions: ${interactions.join(', ')}`);

    if (!options.apply) {
      console.log(
        `[dry-run] no CloudBase write. Re-run with --apply to archive the current version and upsert ${CARD_SOURCE_COLLECTION}.${cardSource.track} in ${options.envId}.`,
      );
      return;
    }

    applyImport(options, cardSource);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[card-source-import] ${message}`);
    process.exit(1);
  }
}

main();
