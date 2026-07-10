#!/usr/bin/env node

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE_DIR = path.join(ROOT, 'docs', 'agent-runs', 'evidence');
const PRE_CUTOVER_INDEX = path.join(ROOT, 'docs', 'archive', 'pre-cutover-evidence-index.json');
const SHA256_RE = /^[0-9a-f]{64}$/;
const SHA40_RE = /^[0-9a-f]{40}$/;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireString(value, label, errors) {
  if (typeof value !== 'string' || value.trim() === '') errors.push(`${label} must be a non-empty string`);
}

function requireArchive(archive, label, errors) {
  if (!isObject(archive)) {
    errors.push(`${label} must be an object`);
    return;
  }
  requireString(archive.url, `${label}.url`, errors);
  if (!SHA256_RE.test(String(archive.sha256 || ''))) errors.push(`${label}.sha256 must be lowercase SHA-256`);
  if (!Number.isInteger(archive.size_bytes) || archive.size_bytes < 0) errors.push(`${label}.size_bytes must be non-negative`);
}

function validateManifest(file, payload) {
  const errors = [];
  if (payload.schema_version !== 'agent-run-evidence.v1') errors.push('schema_version must be agent-run-evidence.v1');
  requireString(payload.run_id, 'run_id', errors);
  requireString(payload.run_record, 'run_record', errors);
  if (!String(payload.run_record || '').startsWith('docs/agent-runs/') || !String(payload.run_record || '').endsWith('.md')) {
    errors.push('run_record must reference docs/agent-runs/*.md');
  }
  requireArchive(payload.archive, 'archive', errors);
  if (!Array.isArray(payload.files) || payload.files.length === 0) {
    errors.push('files must be a non-empty array');
  } else {
    payload.files.forEach((entry, index) => {
      if (!isObject(entry)) {
        errors.push(`files[${index}] must be an object`);
        return;
      }
      for (const field of ['path', 'role', 'media_type']) requireString(entry[field], `files[${index}].${field}`, errors);
      if (!SHA256_RE.test(String(entry.sha256 || ''))) errors.push(`files[${index}].sha256 must be lowercase SHA-256`);
      if (!Number.isInteger(entry.size_bytes) || entry.size_bytes < 0) errors.push(`files[${index}].size_bytes must be non-negative`);
    });
  }
  return errors.map(message => ({file, message}));
}

function validatePreCutoverIndex(file, payload) {
  const errors = [];
  if (payload.schema_version !== 'pre-cutover-evidence-index.v1') {
    errors.push('schema_version must be pre-cutover-evidence-index.v1');
  }
  requireString(payload.cutover_id, 'cutover_id', errors);
  if (!SHA40_RE.test(String(payload.source_commit || ''))) errors.push('source_commit must be a commit SHA');
  requireArchive(payload.archive, 'archive', errors);
  if (!Array.isArray(payload.files) || payload.files.length === 0) {
    errors.push('files must be a non-empty array');
  } else {
    const paths = new Set();
    payload.files.forEach((entry, index) => {
      const label = `files[${index}]`;
      for (const field of ['path', 'role', 'media_type']) requireString(entry?.[field], `${label}.${field}`, errors);
      if (!SHA256_RE.test(String(entry?.sha256 || ''))) errors.push(`${label}.sha256 must be lowercase SHA-256`);
      if (!Number.isInteger(entry?.size_bytes) || entry.size_bytes < 0) errors.push(`${label}.size_bytes must be non-negative`);
      if (paths.has(entry?.path)) errors.push(`${label}.path is duplicated`);
      paths.add(entry?.path);
      if (fs.existsSync(path.join(ROOT, String(entry?.path || '')))) errors.push(`${label}.path must not remain in ordinary Git`);
      if (!Array.isArray(entry?.references)) {
        errors.push(`${label}.references must be an array`);
      } else {
        for (const reference of entry.references) {
          if (typeof reference !== 'string' || !fs.existsSync(path.join(ROOT, reference))) {
            errors.push(`${label}.references contains a missing text record`);
          }
        }
      }
    });
    if (payload.file_count !== payload.files.length) errors.push('file_count must match files.length');
  }
  return errors.map(message => ({file, message}));
}

async function resolvePrivateReleaseAssetUrl(archive, headers) {
  if (!process.env.GITHUB_TOKEN) return archive.url;
  const match = archive.url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\/([^/]+)$/);
  if (!match) return archive.url;
  const [, owner, repo, tag, assetName] = match;
  const releaseResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`,
    {headers: {...headers, Accept: 'application/vnd.github+json'}},
  );
  if (!releaseResponse.ok) throw new Error(`release API HTTP ${releaseResponse.status}`);
  const release = await releaseResponse.json();
  const asset = (release.assets || []).find(entry => entry.name === decodeURIComponent(assetName));
  if (!asset?.url) throw new Error(`release asset ${assetName} is missing`);
  return asset.url;
}

const files = fs.existsSync(EVIDENCE_DIR)
  ? fs.readdirSync(EVIDENCE_DIR).filter(file => file.endsWith('.json')).sort()
  : [];
const errors = [];
const manifests = [];
const remoteArchives = [];

for (const file of files) {
  const relative = path.join('docs', 'agent-runs', 'evidence', file);
  try {
    const payload = JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, file), 'utf8'));
    errors.push(...validateManifest(relative, payload));
    manifests.push({file: relative, payload});
    remoteArchives.push({file: relative, archive: payload.archive});
  } catch (error) {
    errors.push({file: relative, message: `invalid JSON: ${error.message}`});
  }
}


let preCutoverIndex = null;
if (fs.existsSync(PRE_CUTOVER_INDEX)) {
  const relative = path.relative(ROOT, PRE_CUTOVER_INDEX);
  try {
    preCutoverIndex = JSON.parse(fs.readFileSync(PRE_CUTOVER_INDEX, 'utf8'));
    errors.push(...validatePreCutoverIndex(relative, preCutoverIndex));
    remoteArchives.push({file: relative, archive: preCutoverIndex.archive});
  } catch (error) {
    errors.push({file: relative, message: `invalid JSON: ${error.message}`});
  }
}

if (process.argv.includes('--verify-remote')) {
  for (const {file, archive} of remoteArchives) {
    if (!archive?.url || !SHA256_RE.test(String(archive?.sha256 || ''))) continue;
    try {
      const headers = process.env.GITHUB_TOKEN
        ? {Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/octet-stream'}
        : {};
      const downloadUrl = await resolvePrivateReleaseAssetUrl(archive, headers);
      const response = await fetch(downloadUrl, {headers, redirect: 'follow'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = Buffer.from(await response.arrayBuffer());
      const digest = crypto.createHash('sha256').update(data).digest('hex');
      if (digest !== archive.sha256) errors.push({file, message: 'remote archive SHA-256 mismatch'});
      if (data.byteLength !== archive.size_bytes) errors.push({file, message: 'remote archive byte size mismatch'});
    } catch (error) {
      errors.push({file, message: `remote archive unavailable: ${error.message}`});
    }
  }
}

const result = {
  schema_version: 'agent-run-evidence-validation.v1',
  ok: errors.length === 0,
  manifests: files.length,
  pre_cutover_index_files: preCutoverIndex?.file_count || 0,
  errors,
};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
