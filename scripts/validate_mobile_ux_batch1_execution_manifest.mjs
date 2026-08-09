#!/usr/bin/env node

import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {parseStrictJson} from './lib/strict_json.mjs';
import {
  EXECUTION_MANIFEST_ROOT,
  MANIFEST_CATALOG_PATH,
  assertSafeRelativePath,
  readSemanticSource,
  resolveContainedNoSymlink,
} from './lib/mobile_ux_batch1_manifest_contract.mjs';
import {validateBatch1FreezeCandidate} from './validate_mobile_ux_batch1_freeze_candidate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export class ExecutionManifestBlockedError extends Error {
  constructor(result) {
    super(result.reason);
    this.name = 'ExecutionManifestBlockedError';
    this.result = result;
  }
}

export function validateBatch1ExecutionManifest({
  root = ROOT,
  manifestPath,
  requireTracked = true,
} = {}) {
  assertSafeRelativePath(manifestPath, 'execution manifest path');
  if (!manifestPath.startsWith(`${EXECUTION_MANIFEST_ROOT}/`)) {
    throw new Error(`execution manifest path must stay inside ${EXECUTION_MANIFEST_ROOT}`);
  }
  resolveContainedNoSymlink(root, manifestPath, 'execution manifest path', {mustExist: false});

  const candidate = validateBatch1FreezeCandidate({root, requireTracked});
  const catalog = parseStrictJson(
    readSemanticSource(root, MANIFEST_CATALOG_PATH, MANIFEST_CATALOG_PATH, {requireTracked}),
    MANIFEST_CATALOG_PATH,
  );
  const reservation = catalog.reservations.find((entry) => entry.planned_path === manifestPath);
  if (!reservation) throw new Error(`execution manifest path is not one of the 35 exact reservations`);

  throw new ExecutionManifestBlockedError({
    schema_version: 'mobile-ux-batch1-execution-manifest-validation.v1',
    artifact_valid: false,
    subject_class: 'execution_manifest',
    candidate_status: candidate.candidate_status,
    manifest_id: reservation.manifest_id,
    manifest_path: manifestPath,
    freeze_readiness: candidate.freeze_readiness,
    manifest_freeze_eligible: false,
    decision_status: 'not_evaluated',
    gate_effect: 'none',
    gate_eligible: false,
    evidence_eligible: false,
    freeze_authorized: false,
    provisioning_authorized: false,
    execution_authorized: false,
    collection_authorized: false,
    aggregation_authorized: false,
    promotion_authorized: false,
    visual_exploration_authorized: false,
    implementation_authorized: false,
    native_acceptance_authorized: false,
    release_authorized: false,
    reason: 'execution manifest validation is fail-closed until a future exact protected manifest-freeze decision exists',
    allowed_next_action: candidate.allowed_next_action,
  });
}

function parseArgs(argv) {
  const options = {root: ROOT, manifestPath: null, requireTracked: true, json: false};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const take = () => {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
      return value;
    };
    if (argument === '--root') options.root = path.resolve(take());
    else if (argument === '--manifest') options.manifestPath = take();
    else if (argument === '--require-tracked') options.requireTracked = true;
    else if (argument === '--json') options.json = true;
    else if (argument === '--approved' || argument === '--force') {
      throw new Error(`${argument} is forbidden: no CLI flag can manufacture a protected freeze decision`);
    } else throw new Error(`unknown argument: ${argument}`);
  }
  if (!options.manifestPath) throw new Error('--manifest is required');
  return options;
}

function main() {
  let json = process.argv.includes('--json');
  try {
    const options = parseArgs(process.argv.slice(2));
    json = options.json;
    validateBatch1ExecutionManifest(options);
  } catch (error) {
    if (json && error instanceof ExecutionManifestBlockedError) {
      console.error(JSON.stringify(error.result, null, 2));
    } else {
      console.error(
        `MOBILE UX BATCH1 EXECUTION MANIFEST BLOCKED: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
