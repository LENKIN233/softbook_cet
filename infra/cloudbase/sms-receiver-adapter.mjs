#!/usr/bin/env node

import {createPrivateKey, randomUUID, sign} from 'node:crypto';
import {
  chmodSync,
  existsSync,
  linkSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {dirname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  SMS_RECEIVER_EVIDENCE_SCHEMA,
  receiverEvidenceSigningBytes,
  validateSmsReceiverEvidence,
} from './sms-receiver-evidence-contract.mjs';

const CLOUD_BASE_ROOT = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(CLOUD_BASE_ROOT, '../..');

export function createSmsReceiverEvidence({
  adapterId,
  code,
  keyId,
  privateKey,
  receiptId,
  receivedAt,
  runId,
  source,
  target,
}) {
  let signingKey;
  try {
    signingKey = createPrivateKey(privateKey);
  } catch (error) {
    throw new Error('SMS receiver private key is invalid.', {cause: error});
  }
  if (signingKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('SMS receiver private key must use Ed25519.');
  }
  const evidence = {
    schema_version: SMS_RECEIVER_EVIDENCE_SCHEMA,
    adapter_id: adapterId,
    run_id: runId,
    target,
    source,
    received_at: receivedAt,
    code,
    receipt_id: receiptId,
    key_id: keyId,
    signature: '',
  };
  evidence.signature = sign(
    null,
    receiverEvidenceSigningBytes(evidence),
    signingKey,
  ).toString('base64');
  const errors = validateSmsReceiverEvidence(evidence);
  if (errors.length > 0) {
    throw new Error(`SMS receiver evidence is invalid: ${errors.join('; ')}`);
  }
  return evidence;
}

export function writeSmsReceiverEvidence({
  artifactPath,
  repositoryRoot = REPOSITORY_ROOT,
  ...input
}) {
  const absolutePath = requireArtifactPath(artifactPath, repositoryRoot);
  if (existsSync(absolutePath)) {
    throw new Error('SMS receiver evidence artifact already exists.');
  }
  const evidence = createSmsReceiverEvidence(input);
  writeAtomicPrivateJson(absolutePath, evidence);
  return {
    schema_version: evidence.schema_version,
    adapter_id: evidence.adapter_id,
    run_id: evidence.run_id,
    target: evidence.target,
    source: evidence.source,
    received_at: evidence.received_at,
    key_id: evidence.key_id,
    artifact_path: relativeToRepository(absolutePath, repositoryRoot),
  };
}

function requireArtifactPath(value, repositoryRoot) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('SMS receiver evidence --output path is required.');
  }
  const root = resolve(repositoryRoot, 'docs', 'agent-runs', 'artifacts');
  const absolute = resolve(value);
  if (
    absolute === root ||
    !absolute.startsWith(`${root}${sep}`) ||
    !absolute.endsWith('.json')
  ) {
    throw new Error(`SMS receiver evidence must be a JSON file below ${root}.`);
  }
  return absolute;
}

function writeAtomicPrivateJson(path, value) {
  const temporary = `${path}.tmp-${randomUUID()}`;
  let published = false;
  try {
    mkdirSync(dirname(path), {recursive: true});
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    chmodSync(temporary, 0o600);
    linkSync(temporary, path);
    rmSync(temporary);
    published = true;
  } finally {
    if (!published) rmSync(temporary, {force: true});
  }
}

function relativeToRepository(path, repositoryRoot) {
  const prefix = `${resolve(repositoryRoot)}${sep}`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function parseArguments(argv) {
  const options = {format: 'text', output: null};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!['--format', '--output'].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${argument} requires a value.`);
    }
    index += 1;
    if (argument === '--format') options.format = value;
    if (argument === '--output') options.output = value;
  }
  if (!options.output) throw new Error('--output is required.');
  if (!['json', 'text'].includes(options.format)) {
    throw new Error('--format must be text or json.');
  }
  return options;
}

function requireEnvironment(env, name) {
  const value = env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = writeSmsReceiverEvidence({
      adapterId: requireEnvironment(process.env, 'SOFTBOOK_SMS_RECEIVER_ADAPTER_ID'),
      artifactPath: options.output,
      code: requireEnvironment(process.env, 'SOFTBOOK_SMS_RECEIVER_CODE'),
      keyId: requireEnvironment(process.env, 'SOFTBOOK_SMS_RECEIVER_KEY_ID'),
      privateKey: requireEnvironment(process.env, 'SOFTBOOK_SMS_RECEIVER_PRIVATE_KEY'),
      receiptId: requireEnvironment(process.env, 'SOFTBOOK_SMS_RECEIVER_RECEIPT_ID'),
      receivedAt: requireEnvironment(process.env, 'SOFTBOOK_SMS_RECEIVER_RECEIVED_AT'),
      runId: requireEnvironment(process.env, 'SOFTBOOK_SMS_RECEIVER_RUN_ID'),
      source: requireEnvironment(process.env, 'SOFTBOOK_SMS_RECEIVER_SOURCE'),
      target: requireEnvironment(process.env, 'SOFTBOOK_SMS_RECEIVER_TARGET'),
    });
    if (options.format === 'json') console.log(JSON.stringify(result));
    else console.log(`[written] run=${result.run_id}; target=${result.target}`);
  } catch (error) {
    console.error(`[sms-receiver-adapter] ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
