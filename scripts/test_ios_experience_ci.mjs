import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const runner = resolve(dirname(fileURLToPath(import.meta.url)), 'run_ios_experience_ci.sh');
function exercise(phase, flags = {}) {
  const temp = mkdtempSync(join(tmpdir(), 'experience-ci-test-'));
  const bin = join(temp, 'bin');
  mkdirSync(bin);
  const commands = {
    npm: 'exec sleep 60',
    xcodebuild: 'echo compiler >> "$TRACE"; exit "${COMPILER_EXIT:-0}"',
    xcrun: 'echo "xcrun $*" >> "$TRACE"',
    curl: 'case "$*" in *index.bundle*) echo warm >> "$TRACE"; exit "${WARM_EXIT:-0}" ;; *) echo packager-status:running ;; esac',
    node: 'echo journey >> "$TRACE"; exit "${JOURNEY_EXIT:-0}"',
  };
  for (const [name, body] of Object.entries(commands)) {
    writeFileSync(join(bin, name), '#!/bin/sh\n' + body + '\n', {mode: 0o755});
  }
  try {
    const trace = join(temp, 'trace');
    writeFileSync(trace, '');
    const result = spawnSync('bash', [runner, phase], {
      env: {...process.env, ...flags, CI: 'true', RUNNER_TEMP: temp,
        SOFTBOOK_EXPERIENCE_DEVICE_ID: 'disposable-test', TRACE: trace,
        PATH: `${bin}:${process.env.PATH}`},
      encoding: 'utf8', timeout: 10000,
    });
    assert.equal(result.error, undefined);
    return {status: result.status, trace: readFileSync(trace, 'utf8').trim().split('\n')};
  } finally {
    rmSync(temp, {recursive: true, force: true});
  }
}

test('compiler failure is not masked by tee and never installs an app', () => {
  const result = exercise('build', {COMPILER_EXIT: '17'});
  assert.equal(result.status, 17);
  assert.deepEqual(result.trace, ['compiler']);
});

test('cold bundle failure prevents the UI journey and cleans up', () => {
  const result = exercise('run', {WARM_EXIT: '22'});
  assert.equal(result.status, 22);
  assert.ok(result.trace.includes('warm'));
  assert.ok(!result.trace.includes('journey'));
  assert.ok(result.trace.includes('xcrun simctl shutdown disposable-test'));
});

test('the app bundle is ready before the journey is dispatched', () => {
  const result = exercise('run');
  assert.equal(result.status, 0);
  assert.ok(result.trace.indexOf('warm') < result.trace.indexOf('journey'));
  assert.ok(result.trace.includes('xcrun simctl shutdown disposable-test'));
});

test('failed experience acceptance stays failed after cleanup', () => {
  const result = exercise('run', {JOURNEY_EXIT: '9'});
  assert.equal(result.status, 9);
  assert.ok(result.trace.includes('journey'));
  assert.ok(result.trace.includes('xcrun simctl shutdown disposable-test'));
});
