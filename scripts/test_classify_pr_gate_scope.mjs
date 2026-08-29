#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {classifyChangedPaths} from './classify_pr_gate_scope.mjs';

const gateState = result => ({
  mobile: result.mobile,
  native: result.native,
  design: result.design,
  web: result.web,
  backend: result.backend,
  dependency: result.dependency,
  evidence: result.evidence,
  all: result.all,
});

assert.deepEqual(gateState(classifyChangedPaths(['README.md'])), {
  mobile: false,
  native: false,
  design: false,
  web: false,
  backend: false,
  dependency: false,
  evidence: false,
  all: false,
});

assert.deepEqual(
  gateState(classifyChangedPaths(['apps/mobile/src/learning/session.ts'])),
  {
    mobile: true,
    native: true,
    design: true,
    web: true,
    backend: false,
    dependency: false,
    evidence: false,
    all: false,
  },
);

assert.deepEqual(
  gateState(classifyChangedPaths(['apps/mobile/package-lock.json'])),
  {
    mobile: true,
    native: true,
    design: false,
    web: true,
    backend: false,
    dependency: true,
    evidence: false,
    all: false,
  },
);

assert.deepEqual(
  gateState(classifyChangedPaths([
    'infra/cloudbase/functions/softbook-api/package.json',
  ])),
  {
    mobile: false,
    native: false,
    design: false,
    web: false,
    backend: true,
    dependency: true,
    evidence: false,
    all: false,
  },
);

assert.deepEqual(
  gateState(classifyChangedPaths(['infra/cloudbase/deliver-release.mjs'])),
  {
    mobile: false,
    native: false,
    design: false,
    web: false,
    backend: true,
    dependency: false,
    evidence: false,
    all: false,
  },
);

assert.deepEqual(
  gateState(classifyChangedPaths(['spec/account-sync-contract.json'])),
  {
    mobile: true,
    native: false,
    design: false,
    web: true,
    backend: true,
    dependency: false,
    evidence: false,
    all: false,
  },
);

assert.deepEqual(
  gateState(classifyChangedPaths(['scripts/build_android_signed_release.mjs'])),
  {
    mobile: true,
    native: true,
    design: false,
    web: false,
    backend: false,
    dependency: false,
    evidence: false,
    all: false,
  },
);

for (const file of [
  'scripts/build_mobile_release_runtime_profile.mjs',
  'scripts/inspect_mobile_release_runtime_artifact.mjs',
  'scripts/lib/mobile_release_runtime_profile.mjs',
  'scripts/stage_mobile_release_runtime_profile.mjs',
  'scripts/test_mobile_release_runtime_profile.mjs',
]) {
  const classified = classifyChangedPaths([file]);
  assert.equal(classified.mobile, true, `${file} must route to mobile-quality`);
  assert.equal(classified.native, true, `${file} must route to native release builds`);
}

assert.deepEqual(
  gateState(classifyChangedPaths([
    'docs/agent-runs/evidence/release-smoke.json',
  ])),
  {
    mobile: false,
    native: false,
    design: false,
    web: false,
    backend: false,
    dependency: false,
    evidence: true,
    all: false,
  },
);

assert.deepEqual(
  gateState(classifyChangedPaths(['docs/design/mocks/learning-v1.md'])),
  {
    mobile: true,
    native: false,
    design: true,
    web: false,
    backend: false,
    dependency: false,
    evidence: false,
    all: false,
  },
);

assert.equal(
  classifyChangedPaths(['apps/mobile/App.tsx']).design,
  true,
);

for (const file of [
  'scripts/build_card_make_runtime_payload.mjs',
  'scripts/build_formal_release_bundle.mjs',
  'scripts/test_build_card_make_runtime_payload.mjs',
  'scripts/test_build_formal_release_bundle.mjs',
]) {
  assert.equal(
    classifyChangedPaths([file]).backend,
    true,
    `${file} must route to backend-contract`,
  );
}

for (const input of [
  ['.github/workflows/pr-gates.yml'],
  ['scripts/classify_pr_gate_scope.mjs'],
]) {
  assert.deepEqual(gateState(classifyChangedPaths(input)), {
    mobile: true,
    native: true,
    design: true,
    web: true,
    backend: true,
    dependency: true,
    evidence: true,
    all: true,
  });
}

assert.deepEqual(gateState(classifyChangedPaths([], {forceAll: true})), {
  mobile: true,
  native: true,
  design: true,
  web: true,
  backend: true,
  dependency: true,
  evidence: true,
  all: true,
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflow = fs.readFileSync(
  path.join(root, '.github/workflows/pr-gates.yml'),
  'utf8',
);
assert.match(
  workflow,
  /- name: Install pinned Android NDK\n\s+if: env\.RUN_GATE == 'true'/,
  'Android NDK installation must respect the native path gate',
);

console.log('PASS: PR gate scope classification is path-aware and fail-safe.');
