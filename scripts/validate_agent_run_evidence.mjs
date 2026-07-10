#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE_DIR = path.join(ROOT, 'docs', 'agent-runs', 'evidence');
const SHA256_RE = /^[0-9a-f]{64}$/;

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

const files = fs.existsSync(EVIDENCE_DIR)
  ? fs.readdirSync(EVIDENCE_DIR).filter(file => file.endsWith('.json')).sort()
  : [];
const errors = [];

for (const file of files) {
  const relative = path.join('docs', 'agent-runs', 'evidence', file);
  try {
    const payload = JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, file), 'utf8'));
    errors.push(...validateManifest(relative, payload));
  } catch (error) {
    errors.push({file: relative, message: `invalid JSON: ${error.message}`});
  }
}

const result = {schema_version: 'agent-run-evidence-validation.v1', ok: errors.length === 0, manifests: files.length, errors};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
