import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readableExperienceText} from './lib/experience_text_match.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
test('actual OCR preserves enclosed glyphs and never supplies missing or wrong glyphs', {skip: process.platform !== 'darwin'}, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-ocr-'));
  const expected = '学生使用校园咨询服务的原因';
  const variants = [
    ['good', '学生使用校园\n咨询服务的原\n因', true],
    ['wrong-tian', '学生使用校园\n咨询服务的原\n天', false],
    ['wrong-da', '学生使用校园\n咨询服务的原\n大', false],
    ['missing-glyph', '学生使用校园\n咨询服务的原', false],
    ['missing-de', '学生使用校园\n咨询服务原\n因', false],
    ['blank', '', false],
  ];
  const englishVariants = [
    ['nearby', 'with many traveling\nfrom nearby towns', true, 'with many traveling from nearby towns'],
    ['nearpy', 'with many traveling\nfrom nearpy towns', false, 'with many traveling from nearby towns'],
    ['missing-nearby', 'with many traveling\nfrom towns', false, 'with many traveling from nearby towns'],
    ['few', 'and only a few cycling\nin warm weather', true, 'and only a few cycling in warm weather'],
    ['tew', 'and only a tew cycling\nin warm weather', false, 'and only a few cycling in warm weather'],
    ['missing-few', 'and only a cycling\nin warm weather', false, 'and only a few cycling in warm weather'],
  ];
  const fixtures = [32, 40].flatMap(fontSize => [...variants, ...englishVariants].map(([name, text, readable, match = expected]) =>
    ({name: `${name}-${fontSize}`, text, fontSize, readable, expected: match})));
  const run = args => {
    const result = spawnSync('xcrun', ['swift', ...args], {cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024});
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  try {
    const manifest = path.join(directory, 'fixtures.json');
    fs.writeFileSync(manifest, JSON.stringify(fixtures));
    run(['scripts/lib/experience_ocr_fixture.swift', manifest, directory]);
    // Only image paths cross the OCR boundary; it never receives expected text.
    const results = JSON.parse(run(['scripts/experience_ocr.swift', ...fixtures.map(item => path.join(directory, `${item.name}.png`))]));
    for (const [index, item] of fixtures.entries()) {
      assert.equal(readableExperienceText(results[index], item.expected), item.readable,
        `${item.name}: ${results[index].lines.map(line => line.text).join(' / ')}`);
    }
  } finally { fs.rmSync(directory, {recursive: true, force: true}); }
});
