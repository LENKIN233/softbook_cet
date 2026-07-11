#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  normalizeHermesPodspec,
  normalizeYogaPodspec,
} from './normalize_react_native_podspecs.mjs';

const hermesFixture = `before
    spec.prepare_command = ". '#{react_native_path}/sdks/hermes-engine/utils/create-dummy-hermes-xcframework.sh'"
      CMAKE_BINARY = Pod::Executable::which!('cmake')
after
`;
const firstHermes = normalizeHermesPodspec(hermesFixture);

assert.deepEqual(firstHermes.changed, ['prepare_command', 'cmake_path']);
assert.match(firstHermes.content, /\$\{SOFTBOOK_REACT_NATIVE_PATH\}/);
assert.match(firstHermes.content, /CMAKE_BINARY = 'cmake'/);
assert.doesNotMatch(
  firstHermes.content,
  /#\{react_native_path\}\/sdks\/hermes-engine\/utils/,
);

const secondHermes = normalizeHermesPodspec(firstHermes.content);
assert.deepEqual(secondHermes.changed, []);
assert.equal(secondHermes.content, firstHermes.content);
assert.throws(
  () => normalizeHermesPodspec('upstream changed'),
  /Hermes podspec drifted/,
);

const yogaFixture = `before
  spec.private_header_files = Dir.glob(all_header_files) - Dir.glob(public_header_files)
after
`;
const firstYoga = normalizeYogaPodspec(yogaFixture);

assert.deepEqual(firstYoga.changed, ['private_header_order']);
assert.match(firstYoga.content, /Dir\.glob\(all_header_files\)\.sort/);
assert.match(firstYoga.content, /Dir\.glob\(public_header_files\)\.sort/);

const secondYoga = normalizeYogaPodspec(firstYoga.content);
assert.deepEqual(secondYoga.changed, []);
assert.equal(secondYoga.content, firstYoga.content);
assert.throws(
  () => normalizeYogaPodspec('upstream changed'),
  /Yoga podspec drifted/,
);

console.log(
  'PASS: React Native podspec normalization is deterministic and fails on upstream drift.',
);
