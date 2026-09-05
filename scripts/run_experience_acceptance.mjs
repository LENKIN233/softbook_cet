#!/usr/bin/env node
// Two bounded reading journeys, not an aesthetic score or release certification.
import {createHash} from 'node:crypto';
import {readFileSync, mkdirSync, existsSync, readdirSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const options = {device: null, output: null, calibrateOnly: false};
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (key === '--calibrate-only') options.calibrateOnly = true;
  else if (key === '--device' || key === '--output') {
    const value = process.argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`${key} needs a value`);
    options[key.slice(2)] = value;
  } else throw new Error(`Unknown argument: ${key}`);
}
if (!options.output || (!options.device && !options.calibrateOnly)) {
  throw new Error('Use --output <new-directory> --device <disposable-simulator-id>, or --calibrate-only. This clears the test app state.');
}
const output = resolve(options.output);
if (existsSync(output) && readdirSync(output).length) throw new Error('Output must be empty; stale screenshots cannot satisfy a run.');
mkdirSync(output, {recursive: true});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function run(command, args, log = null) {
  const result = spawnSync(command, args, {cwd: root, encoding: 'utf8', timeout: 240000, maxBuffer: 8 * 1024 * 1024});
  if (log) writeFileSync(join(output, log), `${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  if (result.error || result.status !== 0) throw new Error(`${command} failed (${result.status}); see ${log ?? 'command output'}: ${result.error?.message ?? result.stdout?.slice(-1000)}`);
  return result.stdout;
}
const report = {
  scope: 'native-development-reading-journeys', status: 'failed',
  device: options.device, started_at: new Date().toISOString(),
  head: run('git', ['rev-parse', 'HEAD']).trim(),
  diff_sha256: hash(run('git', ['diff', '--binary', 'HEAD'])),
  calibration: [], journeys: [],
  limitations: ['OCR checks required text only, not layout quality or comprehension.',
    'No real SMS, formal content, private audio, payment, deployment or cross-device evidence.',
    'A model must inspect the captured states separately before claiming UX acceptance.'],
};
try {
  const require = createRequire(join(root, 'apps/mobile/package.json'));
  const ts = require('typescript');
  const recordsPath = 'apps/mobile/src/learning/localCardRecords.ts';
  const source = readFileSync(join(root, recordsPath), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext}}).outputText;
  const {localLearningCardRecords: records} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  const elimination = records.find(card => card.card_id === '013001');
  const choice = records.find(card => card.interaction_id === 'multiple_choice' && card.options.some(option => option.id === 'unclear'));
  if (!elimination || !choice) throw new Error('The journey sample changed; update the flow and its calibration together.');
  const correct = choice.options.find(option => option.id === choice.answer_key.correct_option);
  const expected = {
    'material': elimination.front.support.replace(/^目标句[：:]\s*/, ''),
    'answer': `${correct.label} ${correct.text}`,
  };
  report.inputs = Object.fromEntries([recordsPath, 'apps/mobile/src/learning/LearningSurface.tsx',
    'apps/mobile/e2e/experience/reading.yaml', 'scripts/experience_ocr.swift',
    'scripts/run_experience_acceptance.mjs'].map(path => [path, hash(readFileSync(join(root, path)))]));
  const fixtureRoot = join(root, 'apps/mobile/e2e/experience/known-failures');
  const fixtures = ['material', 'answer'].map(kind => ({kind, path: join(fixtureRoot, `${kind}.png`)}));
  const normalize = text => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  function readable(observation, text) {
    return normalize(observation.lines.map(line => line.text).join(' ')).includes(normalize(text));
  }
  const failedPixels = JSON.parse(run('xcrun', ['swift', 'scripts/experience_ocr.swift', ...fixtures.map(item => item.path)], 'calibration-ocr.log'));
  report.calibration = fixtures.map(({kind, path}, index) => ({kind, image_sha256: hash(readFileSync(path)),
    rejected: !readable(failedPixels[index], expected[kind])}));
  if (report.calibration.some(item => !item.rejected)) throw new Error('Known bad screenshot was accepted; the evaluator is not calibrated.');
  if (!options.calibrateOnly) {
    run('maestro', ['--device', options.device, 'test', '--test-output-dir', join(output, 'capture'),
      'apps/mobile/e2e/experience/reading.yaml'], 'maestro.log');
    const samples = [['material', 'material'], ['material-with-hint', 'material'], ['answer', 'answer']];
    function capturedFiles(directory) {
      return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? capturedFiles(path) : [path];
      });
    }
    const files = capturedFiles(join(output, 'capture'));
    const paths = samples.map(([name]) => {
      const matches = files.filter(path => path.endsWith(`/takeScreenshot/${name}.png`));
      if (matches.length !== 1) throw new Error(`Expected one fresh ${name} screenshot, found ${matches.length}`);
      return matches[0];
    });
    const observations = JSON.parse(run('xcrun', ['swift', 'scripts/experience_ocr.swift', ...paths], 'journey-ocr.log'));
    report.journeys = samples.map(([name, kind], index) => ({name, expected: expected[kind],
      screenshot: paths[index], image_sha256: hash(readFileSync(paths[index])),
      readable: readable(observations[index], expected[kind])}));
    if (report.journeys.some(item => !item.readable)) throw new Error('Required reading material or correct answer is not readable in the actual screenshot.');
  }
  if (run('git', ['rev-parse', 'HEAD']).trim() !== report.head ||
      hash(run('git', ['diff', '--binary', 'HEAD'])) !== report.diff_sha256 ||
      Object.entries(report.inputs).some(([path, digest]) => hash(readFileSync(join(root, path))) !== digest)) {
    throw new Error('Source changed during capture; rerun against one stable revision.');
  }
  report.status = options.calibrateOnly ? 'calibration_passed' : 'passed';
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
} finally {
  report.finished_at = new Date().toISOString();
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
