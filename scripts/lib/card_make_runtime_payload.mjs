import {createHash} from 'node:crypto';
import {lstatSync, readFileSync} from 'node:fs';
import {relative, resolve, sep} from 'node:path';

import {parseStrictJson} from './strict_json.mjs';

const MANIFEST_SCHEMA = 'card-make-runtime-payload-manifest.v1';
const SHARD_SCHEMA = 'card-make-runtime-card-shard.v1';
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const CARD_ID_PATTERN = /^[0-9]{6}$/;
const MAX_SHARD_BYTES = 1024 * 1024;

export function resolveCardMakeRuntimePayload(document, {rootDirectory} = {}) {
  if (document?.schema_version !== MANIFEST_SCHEMA) {
    return {payload: document, referencedArtifacts: []};
  }
  requireExactKeys(
    document,
    ['schema_version', 'source', 'track', 'content_version', 'card_record_shards', 'assets', 'release'],
    'runtime payload manifest',
  );
  if (!rootDirectory) throw new Error('Runtime payload manifest requires its repository root.');
  if (!Array.isArray(document.card_record_shards) || document.card_record_shards.length === 0) {
    throw new Error('Runtime payload manifest must contain card shards.');
  }

  const cardRecords = [];
  const referencedArtifacts = [];
  const observedPaths = new Set();
  let previousCardId = null;
  for (const [index, descriptor] of document.card_record_shards.entries()) {
    const label = `runtime payload shard descriptor ${index}`;
    requireExactKeys(
      descriptor,
      ['path', 'sha256', 'card_count', 'first_card_id', 'last_card_id'],
      label,
    );
    const artifactPath = requireSafeJsonPath(descriptor.path, `${label} path`);
    if (observedPaths.has(artifactPath)) throw new Error('Runtime payload manifest repeats a shard path.');
    observedPaths.add(artifactPath);
    if (
      !SHA256_PATTERN.test(descriptor.sha256) ||
      !Number.isSafeInteger(descriptor.card_count) ||
      descriptor.card_count < 1 ||
      !CARD_ID_PATTERN.test(descriptor.first_card_id) ||
      !CARD_ID_PATTERN.test(descriptor.last_card_id)
    ) {
      throw new Error(`${label} identity is invalid.`);
    }
    const sourcePath = resolveInside(rootDirectory, artifactPath, label);
    const bytes = readRegularBytes(sourcePath, label);
    const observedSha256 = sha256(bytes);
    if (observedSha256 !== descriptor.sha256) throw new Error(`${label} SHA-256 does not match.`);
    const shard = parseStrictJson(bytes, label);
    requireExactKeys(shard, ['schema_version', 'track', 'card_records'], label);
    if (
      shard.schema_version !== SHARD_SCHEMA ||
      shard.track !== document.track ||
      !Array.isArray(shard.card_records) ||
      shard.card_records.length !== descriptor.card_count
    ) {
      throw new Error(`${label} content is invalid.`);
    }
    const firstCardId = String(shard.card_records[0]?.card_id ?? '');
    const lastCardId = String(shard.card_records.at(-1)?.card_id ?? '');
    if (firstCardId !== descriptor.first_card_id || lastCardId !== descriptor.last_card_id) {
      throw new Error(`${label} card range does not match.`);
    }
    for (const card of shard.card_records) {
      const cardId = String(card?.card_id ?? '');
      if (!CARD_ID_PATTERN.test(cardId) || (previousCardId !== null && cardId <= previousCardId)) {
        throw new Error('Runtime payload manifest card order is invalid.');
      }
      previousCardId = cardId;
      cardRecords.push(card);
    }
    referencedArtifacts.push({path: artifactPath, sourcePath, bytes, sha256: observedSha256});
  }

  const payload = {
    source: document.source,
    track: document.track,
    card_records: cardRecords,
    assets: document.assets,
    release: document.release,
    content_version: document.content_version,
  };
  if (deriveCardMakeContentVersion(payload) !== document.content_version) {
    throw new Error('Runtime payload manifest content version does not match reconstructed content.');
  }
  return {payload, referencedArtifacts};
}

export function deriveCardMakeContentVersion(payload) {
  const versioned = {
    card_records: payload.card_records,
    source: {id: payload.source?.id, label: payload.source?.label},
    track: payload.track,
  };
  if (Array.isArray(payload.assets) && payload.assets.length > 0) {
    versioned.assets = payload.assets
      .map(asset => ({
        asset_id: asset.asset_id,
        duration_ms: asset.duration_ms,
        media_type: asset.media_type,
        sha256: asset.sha256,
        size_bytes: asset.size_bytes,
      }))
      .sort((left, right) => String(left.asset_id).localeCompare(String(right.asset_id)));
  }
  return `sha256:${createHash('sha256').update(canonicalStringify(versioned)).digest('hex')}`;
}

function readRegularBytes(file, label) {
  const stat = lstatSync(file, {throwIfNoEntry: false});
  if (!stat?.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > MAX_SHARD_BYTES) {
    throw new Error(`${label} must be a bounded regular file.`);
  }
  return readFileSync(file);
}

function resolveInside(root, candidate, label) {
  const rootPath = resolve(root);
  const target = resolve(rootPath, candidate);
  const fromRoot = relative(rootPath, target);
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) throw new Error(`${label} escapes its root.`);
  return target;
}

function requireSafeJsonPath(value, label) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.includes('\\') ||
    value.startsWith('/') ||
    value.split('/').some(part => part === '' || part === '.' || part === '..') ||
    !value.endsWith('.json')
  ) {
    throw new Error(`${label} must be a safe relative JSON path.`);
  }
  return value;
}

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} keys are invalid.`);
  }
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function canonicalStringify(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
