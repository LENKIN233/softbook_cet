import assert from 'node:assert/strict';
import test from 'node:test';
import {captureExperience} from './lib/experience_capture.mjs';
import {readableExperienceText} from './lib/experience_text_match.mjs';

test('wrapped answers tolerate only standalone answer-column labels', () => {
  const observation = {lines: [
    {text: 'A 电动公交与柴油车队的运营成本和排'},
    {text: '正确答案'},
    {text: '放对比'},
  ]};
  const expected = 'A 电动公交与柴油车队的运营成本和排放对比';
  assert.equal(readableExperienceText(observation, expected, {answer: true}), true);
  assert.equal(readableExperienceText(observation, expected), false);
  assert.equal(readableExperienceText({lines: observation.lines.slice(0, 2)}, expected, {answer: true}), false);
  assert.equal(readableExperienceText({lines: [{text: '正确答案'}]}, expected, {answer: true}), false);
  assert.equal(readableExperienceText({lines: [{text: '原天'}]}, '原因', {answer: true}), false);
  assert.equal(readableExperienceText({lines: observation.lines.map(line =>
    line.text === '正确答案' ? {text: '遗漏的正文'} : line)}, expected, {answer: true}), false);
});

test('result labels merged into a wrapped deletion answer do not hide actual words', () => {
  const observation = {lines: [
    {text: 'with many traveling from nearby'},
    {text: '应删除的部分towns · only a few cycling in warm'},
    {text: 'weather'},
  ]};
  const expected = [
    'with many traveling from nearby towns',
    'only a few cycling in warm weather',
  ];
  assert.equal(readableExperienceText(observation, expected, {answer: true}), true);
  assert.equal(readableExperienceText(observation, expected), false);
  assert.equal(readableExperienceText({lines: observation.lines.map(line =>
    line.text.includes('towns') ? {text: '应删除的部分 · only a few cycling in warm'} : line)},
  expected, {answer: true}), false);
});

function exercise(durations, failure = null) {
  const calls = [];
  let elapsed = 0;
  const run = (command, args, log, timeout) => {
    const index = calls.length;
    calls.push({command, args, log, timeout});
    elapsed += durations[index];
    if (durations[index] > timeout) throw new Error(`timeout: ${log}`);
    if (failure === index) throw new Error(`assertion: ${log}`);
  };
  let error;
  try { captureExperience({device: 'disposable', output: '/fresh', run}); }
  catch (caught) { error = caught; }
  return {calls, elapsed, error};
}

test('slow observed preparation leaves a full reading budget', () => {
  // Incident: driver startup + clearState + first keyboard input consumed the reading budget.
  const result = exercise([310000, 150000]);
  assert.ok(result.elapsed > 240000);
  assert.equal(result.error, undefined);
  assert.equal(result.calls.length, 2);
  const [prepare, reading] = result.calls;
  assert.ok(prepare.args.includes('apps/mobile/e2e/experience/prepare.yaml'));
  assert.ok(reading.args.includes('--no-reinstall-driver'));
  assert.ok(prepare.args.includes('/fresh/preparation'));
  assert.ok(reading.args.includes('/fresh/capture'));
});

test('preparation timeout never starts a journey', () => {
  const result = exercise([420001, 1]);
  assert.match(result.error.message, /timeout: preparation.log/);
  assert.equal(result.calls.length, 1);
});

test('preparation failure cannot reuse old app state', () => {
  const result = exercise([1, 1], 0);
  assert.match(result.error.message, /assertion: preparation.log/);
  assert.equal(result.calls.length, 1);
});

test('reading retains its 240 second cap and is never retried', () => {
  const result = exercise([1, 240001]);
  assert.match(result.error.message, /timeout: maestro.log/);
  assert.equal(result.calls.length, 2);
});

test('UI assertion failure propagates without a retry', () => {
  const result = exercise([1, 1], 1);
  assert.match(result.error.message, /assertion: maestro.log/);
  assert.equal(result.calls.length, 2);
});
