#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  normalizeHermesBuildXcodeScript,
  normalizeHermesPodspec,
  normalizeHermescXcodeScript,
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

const hermescFixture = `before
env -i \\
  PATH="$PATH" \\
  SDKROOT="$SDKROOT" \\
  cmake configure
env -i \\
  PATH="$PATH" \\
  SDKROOT="$SDKROOT" \\
  cmake build
after
`;
const firstHermesc = normalizeHermescXcodeScript(hermescFixture);

assert.deepEqual(firstHermesc.changed, ['isolated_environment_home']);
assert.equal((firstHermesc.content.match(/HOME="\$HOME"/g) ?? []).length, 2);
const secondHermesc = normalizeHermescXcodeScript(firstHermesc.content);
assert.deepEqual(secondHermesc.changed, []);
assert.equal(secondHermesc.content, firstHermesc.content);
assert.throws(
  () => normalizeHermescXcodeScript('upstream changed'),
  /Hermesc Xcode script drifted/,
);

const hermesBuildFixture = `before
architectures=$( echo "$ARCHS" | tr  " " ";" )
after
`;
const firstHermesBuild = normalizeHermesBuildXcodeScript(hermesBuildFixture);

assert.deepEqual(firstHermesBuild.changed, ['architecture_cache_guard']);
assert.match(firstHermesBuild.content, /CMAKE_APPLE_ARCH_SYSROOTS/);
assert.match(firstHermesBuild.content, /rm -f "\$cache_file"/);
const secondHermesBuild = normalizeHermesBuildXcodeScript(
  firstHermesBuild.content,
);
assert.deepEqual(secondHermesBuild.changed, []);
assert.equal(secondHermesBuild.content, firstHermesBuild.content);
assert.throws(
  () => normalizeHermesBuildXcodeScript('upstream changed'),
  /Hermes Xcode build script drifted/,
);

console.log(
  'PASS: React Native native-build normalization is deterministic and fails on upstream drift.',
);
