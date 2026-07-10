#!/usr/bin/env node

import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BINARY_EXTENSIONS = new Set(['.gif', '.jpeg', '.jpg', '.mov', '.mp4', '.pdf', '.png', '.webp']);
const TEXT_EXTENSIONS = new Set(['.html', '.json', '.md', '.txt']);

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function trackedFiles(sourceRoot) {
  return execFileSync('git', ['-C', sourceRoot, 'ls-files', '-z'])
    .toString()
    .split('\0')
    .filter(Boolean)
    .sort();
}

function sourceCommit(sourceRoot) {
  return execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
}

function roleFor(file) {
  if (file.startsWith('docs/agent-runs/artifacts/')) return 'agent_run_visual_evidence';
  if (file.startsWith('docs/design/app-screenshots/')) return 'design_runtime_capture';
  if (file.includes('/search-runs/') && file.includes('/screenshots/')) return 'design_search_evidence';
  return 'design_handoff_capture';
}

function mediaTypeFor(file) {
  const extension = path.extname(file).toLowerCase();
  const types = {
    '.gif': 'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.mov': 'video/quicktime',
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  return types[extension] || 'application/octet-stream';
}

const sourceRoot = path.resolve(option('--source-root', ROOT));
const archivePath = option('--archive-path');
const archiveUrl = option('--archive-url');
const outputPath = path.resolve(ROOT, option('--output', 'docs/archive/pre-cutover-evidence-index.json'));
const expectedCount = Number(option('--expected-count', '0'));

if (!archivePath || !archiveUrl) {
  throw new Error('--archive-path and --archive-url are required');
}

const files = trackedFiles(sourceRoot);
const evidenceFiles = files.filter(file => {
  const binary = BINARY_EXTENSIONS.has(path.extname(file).toLowerCase());
  return binary && (file.startsWith('docs/agent-runs/artifacts/') || file.startsWith('docs/design/'));
});
if (expectedCount > 0 && evidenceFiles.length !== expectedCount) {
  throw new Error(`expected ${expectedCount} evidence files, found ${evidenceFiles.length}`);
}

const searchableText = files
  .filter(file => file.startsWith('docs/') && TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()))
  .map(file => ({file, content: fs.readFileSync(path.join(sourceRoot, file), 'utf8')}));
const archiveData = fs.readFileSync(archivePath);
const entries = evidenceFiles.map(file => {
  const data = fs.readFileSync(path.join(sourceRoot, file));
  return {
    path: file,
    role: roleFor(file),
    media_type: mediaTypeFor(file),
    size_bytes: data.byteLength,
    sha256: sha256(data),
    references: searchableText.filter(entry => entry.content.includes(file)).map(entry => entry.file),
  };
});

const payload = {
  schema_version: 'pre-cutover-evidence-index.v1',
  cutover_id: 'history-cutover-2026-07-10',
  source_commit: sourceCommit(sourceRoot),
  archive: {
    url: archiveUrl,
    asset_name: path.basename(new URL(archiveUrl).pathname),
    sha256: sha256(archiveData),
    size_bytes: archiveData.byteLength,
  },
  file_count: entries.length,
  files: entries,
};

fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({output: path.relative(ROOT, outputPath), file_count: entries.length, archive_sha256: payload.archive.sha256}, null, 2));
