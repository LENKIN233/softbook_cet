import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {BRACES_SOURCE, MITIGATIONS, normalizeMitigationSource, normalizeMobileMitigations} from './normalize_mobile_dependency_mitigations.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'apps/mobile/package.json'));
const braces = require('braces');
test('calibration: original compile exhausts a constrained stack while installed walkers reject depth safely', () => {
  const ast = {nodes: []};
  let cursor = ast;
  for (let i = 0; i < 4500; i++) { const next = {nodes: []}; cursor.nodes.push(next); cursor = next; }
  cursor.nodes.push({type: 'text', value: 'x'});
  const entry = MITIGATIONS.find(item => item.file === 'lib/compile.js');
  const file = path.join(root, 'apps/mobile/node_modules', entry.package, entry.file);
  let source = fs.readFileSync(file, 'utf8');
  for (const [before, after] of [...entry.changes].reverse()) source = source.replace(after, before);
  const code = `const Module=require('node:module');const path=require('node:path');
    const m=new Module(${JSON.stringify(file)});m.filename=${JSON.stringify(file)};
    m.paths=Module._nodeModulePaths(path.dirname(m.filename));m._compile(${JSON.stringify(source)},m.filename);
    const ast={nodes:[]};let cursor=ast;for(let i=0;i<4500;i++){const next={nodes:[]};cursor.nodes.push(next);cursor=next;}cursor.nodes.push({type:'text',value:'x'});
    try {m.exports(ast);process.exit(2);}
    catch(e){if(!(e instanceof RangeError)||!/call stack/i.test(e.message))throw e;process.stdout.write('reproduced');}`;
  const before = spawnSync(process.execPath, ['--stack-size=256', '--max-old-space-size=64', '-e', code], {encoding: 'utf8', timeout: 3000});
  assert.equal(before.status, 0, before.stderr);
  assert.equal(before.stdout, 'reproduced');
  for (const method of ['compile', 'expand', 'stringify']) {
    assert.throws(() => braces[method](ast), error => error instanceof SyntaxError && /nesting exceeds 256/.test(error.message));
  }
});
test('normal brace alternation, ranges, escaping and nesting retain their behavior', () => {
  assert.deepEqual(braces.expand('src/{a,b}.{js,ts}'), ['src/a.js', 'src/a.ts', 'src/b.js', 'src/b.ts']);
  assert.deepEqual(braces.expand('part{1..3}'), ['part1', 'part2', 'part3']);
  assert.deepEqual(braces.expand('src/\\{literal\\}'), ['src/{literal}']);
  assert.deepEqual(braces.expand('{a,{b,c}}'), ['a', 'b', 'c']);
  assert.deepEqual(braces.expand("'{a,b}'"), ['{a,b}']);
  assert.deepEqual(braces.expand("'src/{a,b}"), ["'src/a", "'src/b"]);
  assert.deepEqual(braces.expand('{..,a}'), ['..', 'a']);
});
test('pinned fork rejects nested patterns before any recursive consumer and keeps depth-100 inputs', () => {
  for (const [open, close] of [['{', '}'], ['(', ')']]) {
    const pattern = open.repeat(4500) + 'x' + close.repeat(4500);
    for (const method of ['parse', 'compile', 'expand', 'stringify']) {
      assert.throws(() => braces[method](pattern), error => error instanceof SyntaxError && /max depth/.test(error.message));
    }
  }
  const within = '{a,'.repeat(100) + 'a' + '}'.repeat(100);
  assert.equal(braces.expand(within).length, 101);
});
test('argparse upgrade removes sprintf-js while preserving the existing YAML consumer and CLI', async () => {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'apps/mobile/package-lock.json')));
  assert.ok(!Object.keys(lock.packages).some(name => name.endsWith('/sprintf-js')));
  const yamlEntry = require.resolve('@istanbuljs/load-nyc-config/node_modules/js-yaml/package.json');
  const cli = path.join(path.dirname(yamlEntry), 'bin/js-yaml.js');
  const run = (args, input = '') => spawnSync(process.execPath, [cli, ...args], {input, encoding: 'utf8', timeout: 5000});
  for (const flag of ['--help', '--version']) assert.equal(run([flag]).status, 0);
  const parsed = run([], 'enabled: true\nitems: [one, two]\n');
  assert.equal(parsed.status, 0, parsed.stderr);
  assert.deepEqual(JSON.parse(parsed.stdout), {enabled: true, items: ['one', 'two']});
  const dumped = run([], '{"enabled":true}');
  assert.equal(dumped.status, 0, dumped.stderr);
  assert.deepEqual(require(path.dirname(yamlEntry)).safeLoad(dumped.stdout), {enabled: true});
  assert.equal(run(['--compact'], 'a: [').status, 1);
  assert.equal(run(['--definitely-unknown']).status, 2);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-nyc-'));
  try {
    fs.writeFileSync(path.join(temporary, '.nycrc.yml'), 'all: true\ninclude: ["src/**"]\n');
    const config = await require('@istanbuljs/load-nyc-config').loadNycConfig({cwd: temporary});
    assert.equal(config.all, true);
    assert.deepEqual(config.include, ['src/**']);
    assert.equal(run([path.join(temporary, '.nycrc.yml')]).status, 0);
    assert.equal(run([path.join(temporary, 'missing.yml')]).status, 2);
  } finally {fs.rmSync(temporary, {recursive: true, force: true});}
});
test('verified policy mitigation fails closed on missing or changed bytes and reapplies only exact upstream input', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-mitigation-'));
  try {
    const packages = {};
    for (const entry of MITIGATIONS) {
      const folder = `node_modules/${entry.package}`;
      packages[folder] = {version: entry.version, resolved: BRACES_SOURCE.resolved, integrity: BRACES_SOURCE.integrity};
      const file = path.join(temporary, 'apps/mobile', folder, entry.file);
      fs.mkdirSync(path.dirname(file), {recursive: true});
      const current = fs.readFileSync(path.join(root, 'apps/mobile', folder, entry.file), 'utf8');
      fs.writeFileSync(file, current);
      assert.throws(() => normalizeMitigationSource(current + '\n', entry), /Unrecognized/);
    }
    for (const name of Object.keys(BRACES_SOURCE.files)) {
      const file = path.join(temporary, 'apps/mobile/node_modules/braces', name);
      fs.mkdirSync(path.dirname(file), {recursive: true});
      fs.copyFileSync(path.join(root, 'apps/mobile/node_modules/braces', name), file);
    }
    const lockPath = path.join(temporary, 'apps/mobile/package-lock.json');
    fs.writeFileSync(lockPath, JSON.stringify({packages}));
    normalizeMobileMitigations(temporary, {verifyOnly: true});
    const entry = MITIGATIONS[0], file = path.join(temporary, 'apps/mobile/node_modules', entry.package, entry.file);
    let original = fs.readFileSync(file, 'utf8');
    for (const [before, after] of [...entry.changes].reverse()) original = original.replace(after, before);
    fs.writeFileSync(file, original);
    assert.throws(() => normalizeMobileMitigations(temporary, {verifyOnly: true}), /mitigation missing/);
    normalizeMobileMitigations(temporary);
    normalizeMobileMitigations(temporary, {verifyOnly: true});
    const parse = path.join(temporary, 'apps/mobile/node_modules/braces/lib/parse.js');
    fs.appendFileSync(parse, '\n');
    assert.throws(() => normalizeMobileMitigations(temporary, {verifyOnly: true}), /Unrecognized braces source/);
    fs.copyFileSync(path.join(root, 'apps/mobile/node_modules/braces/lib/parse.js'), parse);
    packages['node_modules/braces'].resolved = 'https://example.invalid/changed-source.tar.gz';
    fs.writeFileSync(lockPath, JSON.stringify({packages}));
    assert.throws(() => normalizeMobileMitigations(temporary, {verifyOnly: true}), /changed braces source/);
  } finally {fs.rmSync(temporary, {recursive: true, force: true});}
});
