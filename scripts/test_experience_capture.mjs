import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {captureExperience} from './lib/experience_capture.mjs';
import {readableBilingualExperienceText, readableExperienceText} from './lib/experience_text_match.mjs';

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

test('two language priorities must find the same actual material without inventing missing English', () => {
  const expected = '模拟句子：Most customers choose private cars, with many traveling from nearby towns and only a few cycling in warm weather.';
  const primary = {lines: [
    {text: '模拟句子：Most customers choose'},
    {text: 'private cars,'},
    {text: 'with many traveling from nearby towns'},
    {text: 'and only a few cycing in warm weather.'},
  ]};
  const englishFirst = {lines: [
    {text: 'Most customers choose private cars,'},
    {text: 'with many traveling from nearby towns'},
    {text: 'and only a few cycling in warm weather.'},
  ]};
  assert.equal(readableExperienceText(primary, expected), false);
  assert.equal(readableBilingualExperienceText(primary, englishFirst, expected), true);
  assert.equal(readableBilingualExperienceText({lines: primary.lines.slice(1)}, englishFirst, expected), false);
  assert.equal(readableBilingualExperienceText(primary,
    {lines: englishFirst.lines.filter(line => !line.text.includes('nearby towns'))}, expected), false);
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

test('cold preparation and reading use one iOS driver session', () => {
  // Hosted iOS passed preparation, then the second Maestro process could not
  // restart XCTest; keep both stages inside the same bounded flow.
  const result = exercise([400000]);
  assert.equal(result.error, undefined);
  assert.equal(result.calls.length, 1);
  const [reading] = result.calls;
  assert.ok(reading.args.includes('apps/mobile/e2e/experience/reading.yaml'));
  assert.ok(reading.args.includes('/fresh/capture'));
  assert.equal(reading.timeout, 660000);
  assert.match(readFileSync(new URL('../apps/mobile/e2e/experience/reading.yaml', import.meta.url), 'utf8'),
    /- runFlow: prepare\.yaml/);
});

test('cold setup and reading remain bounded together', () => {
  const result = exercise([660001]);
  assert.match(result.error.message, /timeout: maestro.log/);
  assert.equal(result.calls.length, 1);
});

test('preparation or reading assertion failure cannot retry stale app state', () => {
  const result = exercise([1], 0);
  assert.match(result.error.message, /assertion: maestro.log/);
  assert.equal(result.calls.length, 1);
});
