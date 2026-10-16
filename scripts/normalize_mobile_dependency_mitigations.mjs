import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The reviewed fork is pinned by commit and archive integrity. Parser limits
// address the advisory; walker guards also reject caller-supplied deep ASTs.
export const BRACES_SOURCE = {
  resolved: 'https://codeload.github.com/Im-Fran/braces/tar.gz/11568474fd2d330d4a56a3aba63f8f90030ba15e',
  integrity: 'sha512-e7NbDnK5Y5WX8GY5blKl+cjBXFVWRh+AuG0DdA1eAjW+J4ChWNwAnEPqeKPvAtxnJKxh+zeW32mNxS4T+3N9KQ==',
  files: {
    'index.js': '332ea07c7b006361aad12aa994ca75dc1db8e8382b884909e2f38f10b85c88a4',
    'lib/parse.js': '978df9b5e7fa6067db13b0fa2e24d7d3d8d87fc3c03181ed9608f3b78dcd14b4',
    'lib/constants.js': 'c355cf54c07a89fd204eb08b747e27227e9a3522155885b45692455d9ac75f50',
    'lib/utils.js': 'b5a7596aa67730412b3c029ef09e84e6b67b8e445cffd35d1d295549c89066c7',
    'package.json': 'fd4c4709b1ef8cf043b298d74036c045f2183481aad8d856ae9c32dd73056598',
    LICENSE: '35bdd8a44339719441900fb50fbefc5e2dca1ca662cbaed7a687de842c8b70f2',
  },
};
export const MITIGATIONS = [
  {
    "package": "braces",
    "version": "3.0.4",
    "file": "lib/compile.js",
    "original_sha256": "dc98f22eee3d511785d92a00758d5f0d48efed5f5813bdecc2de430c529b5c9f",
    "patched_sha256": "4bf7fc383852f2340a05c8f5453db3557a03363ba2eb6a4924fe81ac73d21a2b",
    "changes": [
      [
        "const walk = (node, parent = {}) => {",
        "const walk = (node, parent = {}, depth = 0) => {\n    if (depth > 256) throw new SyntaxError('Softbook brace nesting exceeds 256');"
      ],
      [
        "walk(child, node)",
        "walk(child, node, depth + 1)"
      ]
    ]
  },
  {
    "package": "braces",
    "version": "3.0.4",
    "file": "lib/expand.js",
    "original_sha256": "41ccc196ebfa7b7781a634e721eb744e4e7bcb54cba427a7e3d6806a1b9e58f7",
    "patched_sha256": "6e3355d8aabed750695b8938acd62d72d736aafd871b7d44a591d89167548ad4",
    "changes": [
      [
        "const walk = (node, parent = {}) => {",
        "const walk = (node, parent = {}, depth = 0) => {\n    if (depth > 256) throw new SyntaxError('Softbook brace nesting exceeds 256');"
      ],
      [
        "walk(child, node)",
        "walk(child, node, depth + 1)"
      ]
    ]
  },
  {
    "package": "braces",
    "version": "3.0.4",
    "file": "lib/stringify.js",
    "original_sha256": "379f22d77bfa1478341ccd49c5e4267464aabcbba03558bab332aac23fc6f23a",
    "patched_sha256": "2b449cb7691a8e77c3f1f7bf091154298b26c278114e4ad1c6e78c8ce2ec4f99",
    "changes": [
      [
        "const stringify = (node, parent = {}) => {",
        "const stringify = (node, parent = {}, depth = 0) => {\n    if (depth > 256) throw new SyntaxError('Softbook brace nesting exceeds 256');"
      ],
      [
        "stringify(child)",
        "stringify(child, undefined, depth + 1)"
      ]
    ]
  }
];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export function normalizeMitigationSource(source, entry) {
  if (hash(source) === entry.patched_sha256) return source;
  if (hash(source) !== entry.original_sha256) throw new Error(`Unrecognized ${entry.package}/${entry.file}; review upstream source.`);
  let output = source;
  for (const [before, after] of entry.changes) {
    if (output.split(before).length !== 2) throw new Error('Ambiguous mitigation source anchor.');
    output = output.replace(before, after);
  }
  if (hash(output) !== entry.patched_sha256) throw new Error('Mitigation output hash mismatch.');
  return output;
}
export function normalizeMobileMitigations(root = ROOT, {verifyOnly = false} = {}) {
  const mobile = path.join(root, 'apps/mobile');
  const lock = JSON.parse(fs.readFileSync(path.join(mobile, 'package-lock.json'), 'utf8'));
  const verified = [];
  for (const entry of MITIGATIONS) {
    const matches = Object.entries(lock.packages).filter(([name]) => name.endsWith(`/node_modules/${entry.package}`) || name === `node_modules/${entry.package}`);
    if (!matches.length) throw new Error(`Missing ${entry.package}; retire its obsolete mitigation.`);
    for (const [directory, metadata] of matches) {
      if (metadata.resolved !== BRACES_SOURCE.resolved || metadata.integrity !== BRACES_SOURCE.integrity) throw new Error('Review changed braces source or archive integrity.');
      if (metadata.version !== entry.version) throw new Error(`Review changed ${entry.package} version.`);
      for (const [name, expected] of Object.entries(BRACES_SOURCE.files)) {
        if (hash(fs.readFileSync(path.join(mobile, directory, name))) !== expected) throw new Error(`Unrecognized braces source: ${name}`);
      }
      const file = path.join(mobile, directory, entry.file);
      const current = fs.readFileSync(file, 'utf8');
      if (verifyOnly && hash(current) !== entry.patched_sha256) throw new Error(`Required local mitigation missing: ${directory}/${entry.file}`);
      const patched = normalizeMitigationSource(current, entry);
      if (!verifyOnly && current !== patched) fs.writeFileSync(file, patched);
      verified.push({file: path.relative(root, file), sha256: hash(patched)});
    }
  }
  return verified;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  console.log(JSON.stringify({verified: normalizeMobileMitigations(ROOT, {verifyOnly: process.argv.includes('--verify')})}));
}
