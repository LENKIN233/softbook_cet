import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire, Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import {MITIGATIONS, normalizeMitigationSource, normalizeMobileMitigations} from './normalize_mobile_dependency_mitigations.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'apps/mobile/package.json'));
const braces = require('braces');
const {sprintf, vsprintf} = require('sprintf-js');
function originalModule(entry) {
  const file = path.join(root, 'apps/mobile/node_modules', entry.package, entry.file);
  let source = fs.readFileSync(file, 'utf8');
  for (const [before, after] of [...entry.changes].reverse()) source = source.replace(after, before);
  const module = new Module(file);
  module.filename = file;
  module.paths = Module._nodeModulePaths(path.dirname(file));
  module._compile(source, file);
  return module.exports;
}
test('calibration: original compile exhausts a constrained stack while installed walkers reject depth safely', () => {
  const pattern = '{'.repeat(4500) + 'x' + '}'.repeat(4500);
  const entry = MITIGATIONS.find(item => item.file === 'lib/compile.js');
  const file = path.join(root, 'apps/mobile/node_modules', entry.package, entry.file);
  let source = fs.readFileSync(file, 'utf8');
  for (const [before, after] of [...entry.changes].reverse()) source = source.replace(after, before);
  const code = `const Module=require('node:module');const path=require('node:path');
    const m=new Module(${JSON.stringify(file)});m.filename=${JSON.stringify(file)};
    m.paths=Module._nodeModulePaths(path.dirname(m.filename));m._compile(${JSON.stringify(source)},m.filename);
    const braces=require(${JSON.stringify(require.resolve('braces'))});
    try {m.exports(braces.parse('{'.repeat(4500)+'x'+'}'.repeat(4500)));process.exit(2);}
    catch(e){if(!(e instanceof RangeError)||!/call stack/i.test(e.message))throw e;process.stdout.write('reproduced');}`;
  const before = spawnSync(process.execPath, ['--stack-size=256', '--max-old-space-size=64', '-e', code], {encoding: 'utf8', timeout: 3000});
  assert.equal(before.status, 0, before.stderr);
  assert.equal(before.stdout, 'reproduced');
  for (const method of ['compile', 'expand', 'stringify']) {
    assert.throws(() => braces[method](pattern), error => error instanceof SyntaxError && /nesting exceeds 256/.test(error.message));
  }
});
test('normal brace alternation, ranges, escaping and nesting retain their behavior', () => {
  assert.deepEqual(braces.expand('src/{a,b}.{js,ts}'), ['src/a.js', 'src/a.ts', 'src/b.js', 'src/b.ts']);
  assert.deepEqual(braces.expand('part{1..3}'), ['part1', 'part2', 'part3']);
  assert.deepEqual(braces.expand('src/\\{literal\\}'), ['src/{literal}']);
  assert.deepEqual(braces.expand('{a,{b,c}}'), ['a', 'b', 'c']);
});
test('calibration: excessive numeric precision no longer produces the original native RangeError', () => {
  const original = originalModule(MITIGATIONS.find(entry => entry.package === 'sprintf-js')).sprintf;
  assert.throws(() => original('%.100000f', 1.25), RangeError);
  for (const type of ['f', 'e', 'g']) assert.ok(sprintf(`%.100000${type}`, 1.25).length <= 120);
  assert.equal(sprintf('%.0g', 1.25), '1');
  assert.equal(vsprintf('%04d / %.2f', [7, 1.25]), '0007 / 1.25');
  assert.equal(sprintf('%(label)s', {label: '可用'}), '可用');
});
test('verified policy mitigation fails closed on missing or changed bytes and reapplies only exact upstream input', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-mitigation-'));
  try {
    const packages = {};
    for (const entry of MITIGATIONS) {
      const folder = `node_modules/${entry.package}`;
      packages[folder] = {version: entry.version};
      const file = path.join(temporary, 'apps/mobile', folder, entry.file);
      fs.mkdirSync(path.dirname(file), {recursive: true});
      const current = fs.readFileSync(path.join(root, 'apps/mobile', folder, entry.file), 'utf8');
      fs.writeFileSync(file, current);
      assert.throws(() => normalizeMitigationSource(current + '\n', entry), /Unrecognized/);
    }
    fs.writeFileSync(path.join(temporary, 'apps/mobile/package-lock.json'), JSON.stringify({packages}));
    normalizeMobileMitigations(temporary, {verifyOnly: true});
    const entry = MITIGATIONS[0], file = path.join(temporary, 'apps/mobile/node_modules', entry.package, entry.file);
    let original = fs.readFileSync(file, 'utf8');
    for (const [before, after] of [...entry.changes].reverse()) original = original.replace(after, before);
    fs.writeFileSync(file, original);
    assert.throws(() => normalizeMobileMitigations(temporary, {verifyOnly: true}), /mitigation missing/);
    normalizeMobileMitigations(temporary);
    normalizeMobileMitigations(temporary, {verifyOnly: true});
  } finally {fs.rmSync(temporary, {recursive: true, force: true});}
});
