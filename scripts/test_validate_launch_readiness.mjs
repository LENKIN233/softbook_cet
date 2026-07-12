#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {
  validateExternalAccountReadiness,
  validateLaunchReadiness,
} from './validate_launch_readiness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'docs', 'release', 'launch-readiness.v1.json'),
    'utf8',
  ),
);
const externalAccounts = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'docs', 'release', 'external-account-readiness.v1.json'),
    'utf8',
  ),
);

test('tracked launch contract is valid and honestly not ready', () => {
  const result = validateLaunchReadiness(contract);

  assert.equal(result.ok, true);
  assert.equal(result.ready, false);
  assert.ok(result.summary.blocked > 0);
});

test('external account audit matches launch dependencies without claiming readiness', () => {
  const result = validateExternalAccountReadiness(externalAccounts, contract);

  assert.equal(result.ok, true);
  assert.equal(result.ready, false);
});

test('passed gates require evidence', () => {
  const invalid = structuredClone(contract);
  invalid.gates[0].status = 'passed';
  invalid.gates[0].evidence = [];

  const result = validateLaunchReadiness(invalid);

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /must include evidence/);
});

test('ready status cannot be asserted while a gate remains open', () => {
  const invalid = structuredClone(contract);
  invalid.status = 'ready';

  const result = validateLaunchReadiness(invalid);

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /status must be not_ready/);
});

test('required gates and subscription products cannot be deleted to fake readiness', () => {
  const invalid = structuredClone(contract);
  invalid.gates = invalid.gates.filter(gate => gate.id !== 'audio-runtime');
  invalid.product_scope.subscription_products = [
    'com.softbook.cet.premium.monthly',
  ];

  const result = validateLaunchReadiness(invalid);

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /gate ids must contain exactly/);
  assert.match(result.errors.join('\n'), /subscription_products must contain exactly/);
});
