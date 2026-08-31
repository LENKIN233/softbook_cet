import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';

import {buildIosRelease} from './build_ios_release.mjs';
import {
  canonicalJsonBytes,
  createMobileReleaseRuntimeProfile,
} from './lib/mobile_release_runtime_profile.mjs';

const root = resolve(import.meta.dirname, '..');
const sourceProfilePath = join(
  root,
  'apps/mobile/ios/SoftbookCET/softbook-release-runtime-profile.json',
);
const fixturePath = join(
  root,
  'apps/mobile/e2e/fixtures/mobile-release-runtime-profile.repository-fixture.json',
);

test('guarded iOS release embeds receiver bytes and restores the tracked fixture', () => {
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), 'softbook-ios-release-builder-test-'),
  );
  const runtime = writeReceiverProfile(temporaryDirectory);
  const derivedDataPath = join(temporaryDirectory, 'derived');
  const fixtureBytes = readFileSync(fixturePath);
  const report = buildIosRelease({
    derivedDataPath,
    mode: 'simulator',
    nodeVersion: '22.13.0',
    repositoryCommit: runtime.commitSha,
    runtimeProfilePath: runtime.path,
    runXcode: ({sourceProfilePath: stagedPath}) => {
      const appPath = join(
        derivedDataPath,
        'Build/Products/Release-iphonesimulator/SoftbookCET.app',
      );
      mkdirSync(appPath, {recursive: true});
      writeFileSync(
        join(appPath, 'softbook-release-runtime-profile.json'),
        readFileSync(stagedPath),
      );
      return {status: 0};
    },
  });

  assert.equal(report.mobile_runtime_profile.ok, true);
  assert.equal(
    report.mobile_runtime_profile.configuration_class,
    'receiver_release',
  );
  assert.equal(readFileSync(sourceProfilePath).equals(fixtureBytes), true);
  rmSync(temporaryDirectory, {force: true, recursive: true});
});

test('guarded iOS release restores the fixture after xcodebuild failure', () => {
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), 'softbook-ios-release-builder-failure-'),
  );
  const runtime = writeReceiverProfile(temporaryDirectory);
  const fixtureBytes = readFileSync(fixturePath);
  assert.throws(() =>
    buildIosRelease({
      derivedDataPath: join(temporaryDirectory, 'derived'),
      mode: 'simulator',
      nodeVersion: '22.13.0',
      repositoryCommit: runtime.commitSha,
      runtimeProfilePath: runtime.path,
      runXcode: () => ({status: 1}),
    }),
  );
  assert.equal(readFileSync(sourceProfilePath).equals(fixtureBytes), true);
  rmSync(temporaryDirectory, {force: true, recursive: true});
});

function writeReceiverProfile(directory) {
  const commitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const deliveryProfileBytes = readFileSync(
    join(root, 'infra/cloudbase/receiver/cet4-closed-beta.delivery-profile.json'),
  );
  const publicKeyringBytes = readFileSync(
    join(root, 'infra/cloudbase/receiver/content-manifest-public-keyring.json'),
  );
  const path = join(directory, 'runtime-profile.json');
  writeFileSync(
    path,
    canonicalJsonBytes(
      createMobileReleaseRuntimeProfile({
        commitSha,
        deliveryProfile: JSON.parse(deliveryProfileBytes.toString('utf8')),
        deliveryProfileBytes,
        publicKeyring: JSON.parse(publicKeyringBytes.toString('utf8')),
        publicKeyringBytes,
      }),
    ),
  );
  return {commitSha, path};
}
