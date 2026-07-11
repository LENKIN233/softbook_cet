#!/usr/bin/env node

import assert from 'node:assert/strict';
import {normalizeHermesPodspec} from './normalize_hermes_podspec.mjs';

const upstreamFixture = `before
    spec.prepare_command = ". '#{react_native_path}/sdks/hermes-engine/utils/create-dummy-hermes-xcframework.sh'"
      CMAKE_BINARY = Pod::Executable::which!('cmake')
after
`;
const first = normalizeHermesPodspec(upstreamFixture);

assert.deepEqual(first.changed, ['prepare_command', 'cmake_path']);
assert.match(first.content, /\$\{SOFTBOOK_REACT_NATIVE_PATH\}/);
assert.match(first.content, /CMAKE_BINARY = 'cmake'/);
assert.doesNotMatch(first.content, /#\{react_native_path\}\/sdks\/hermes-engine\/utils/);

const second = normalizeHermesPodspec(first.content);
assert.deepEqual(second.changed, []);
assert.equal(second.content, first.content);
assert.throws(
  () => normalizeHermesPodspec('upstream changed'),
  /Hermes podspec drifted/,
);

console.log('PASS: Hermes podspec normalization is deterministic and fails on upstream drift.');
