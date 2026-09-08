import assert from 'node:assert/strict';
import test from 'node:test';
import {captureExperience} from './lib/experience_capture.mjs';

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
