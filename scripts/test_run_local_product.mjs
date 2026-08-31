#!/usr/bin/env node

import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import {
  createLocalProductEnvironment,
  createLocalProductProfile,
  createTargetPlan,
  parseArguments,
} from './run_local_product.mjs';

const COMMIT = '0123456789abcdef0123456789abcdef01234567';

test('local product profile is public receiver configuration only', () => {
  const directory = mkdtempSync(join(tmpdir(), 'softbook-local-product-test-'));
  const outputPath = join(directory, 'profile.json');
  const profile = createLocalProductProfile({commitSha: COMMIT, outputPath});
  const bytes = readFileSync(outputPath, 'utf8');
  const environment = createLocalProductEnvironment(profile, outputPath);

  assert.equal(profile.configuration_class, 'receiver_release');
  assert.equal(profile.commit_sha, COMMIT);
  assert.match(environment.SOFTBOOK_CET_REMOTE_BASE_URL, /^https:\/\//);
  assert.doesNotMatch(bytes, /private_key|token|secret|Bearer|apiKey/i);
  assert.equal(
    JSON.parse(environment.SOFTBOOK_CET_CONTENT_MANIFEST_PUBLIC_KEYS)[
      profile.signing_key_id
    ],
    profile.content_manifest_public_keys[0].public_key_hex,
  );
  rmSync(directory, {force: true, recursive: true});
});

test('target plans keep formal receiver semantics on all three clients', () => {
  const env = {SOFTBOOK_CET_REMOTE_BASE_URL: 'https://api.example.test'};
  assert.deepEqual(parseArguments(['--target', 'web', '--check']), {
    check: true,
    device: null,
    target: 'web',
  });
  assert.equal(createTargetPlan({env, target: 'web'}).length, 2);
  assert.equal(createTargetPlan({env, target: 'android'}).length, 2);
  assert.equal(
    createTargetPlan({device: 'simulator-id', env, target: 'ios'}).length,
    4,
  );
  assert.throws(
    () => createTargetPlan({env, target: 'ios'}),
    /--device is required/,
  );
});

test('local product arguments reject demo or ambiguous targets', () => {
  assert.throws(() => parseArguments([]), /--target/);
  assert.throws(() => parseArguments(['--target', 'demo']), /--target/);
  assert.throws(
    () => parseArguments(['--target', 'web', '--unknown']),
    /Unknown argument/,
  );
});
