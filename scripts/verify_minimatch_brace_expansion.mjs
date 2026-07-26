#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {legacyMinimatchPackages} from './normalize_minimatch_brace_expansion.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE_ROOT = path.join(ROOT, 'apps', 'mobile');
const lock = JSON.parse(
  fs.readFileSync(path.join(MOBILE_ROOT, 'package-lock.json'), 'utf8'),
);
const expansionFixtures = [
  ['file-{a,b,c}.jpg', ['file-a.jpg', 'file-b.jpg', 'file-c.jpg']],
  ['file{00..10..5}.jpg', ['file00.jpg', 'file05.jpg', 'file10.jpg']],
  ['{{A..C},{a..c}}', ['A', 'B', 'C', 'a', 'b', 'c']],
  ['ppp{,config,oe{,conf}}', ['ppp', 'pppconfig', 'pppoe', 'pppoeconf']],
  ['${a,b}', ['${a,b}']],
];

for (const entry of legacyMinimatchPackages(lock)) {
  const packageDirectory = path.join(MOBILE_ROOT, entry.packagePath);
  const requireFromMinimatch = createRequire(
    path.join(packageDirectory, 'minimatch.js'),
  );
  const legacyMinimatch = requireFromMinimatch('./minimatch.js');
  const braceExpansion = requireFromMinimatch('brace-expansion');
  const bracePackage = requireFromMinimatch('brace-expansion/package.json');

  assert.equal(bracePackage.version, '5.0.8');
  assert.equal(typeof braceExpansion.expand, 'function');
  for (const [pattern, expected] of expansionFixtures) {
    assert.deepEqual(
      braceExpansion.expand(pattern),
      expected,
      `${entry.packagePath} must preserve ${pattern}`,
    );
  }
  assert.equal(
    legacyMinimatch('src/App.tsx', 'src/{App,Other}.tsx'),
    true,
    `${entry.packagePath} must preserve legacy brace matching`,
  );

  const bounded = braceExpansion.expand('{a,b}'.repeat(50), {maxLength: 100});
  assert.ok(
    bounded.reduce((length, value) => length + value.length, 0) <= 100,
    `${entry.packagePath} must use the patched maxLength guard`,
  );
}

const mobileRequire = createRequire(path.join(MOBILE_ROOT, 'package.json'));
const modernMinimatchPath = mobileRequire.resolve('minimatch');
const modernMinimatch = await import(pathToFileURL(modernMinimatchPath));
assert.equal(
  modernMinimatch.minimatch('src/App.tsx', 'src/{App,Other}.tsx'),
  true,
);

console.log(
  'PASS: brace-expansion@5.0.8 supports every legacy and modern minimatch path.',
);
