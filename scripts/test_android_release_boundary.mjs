import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('Android Release never falls back to the repository debug keystore', () => {
  const gradle = read('apps/mobile/android/app/build.gradle');
  const buildTypesStart = gradle.indexOf('    buildTypes {');
  assert.notEqual(buildTypesStart, -1);
  const releaseStart = gradle.indexOf('        release {', buildTypesStart);
  const releaseBlock = gradle.slice(
    releaseStart,
    gradle.indexOf('\n        }', releaseStart) + 10,
  );

  assert.doesNotMatch(releaseBlock, /signingConfig\s+signingConfigs\.debug/);
  assert.match(releaseBlock, /signingConfig\s+signingConfigs\.release/);
  assert.match(gradle, /verifyReleaseSigningBoundary/);
  assert.match(gradle, /softbookRequireSignedRelease/);
  assert.match(gradle, /softbookRequireUnsignedRelease/);
  assert.match(gradle, /cannot require signed and unsigned modes together/);
  for (const name of [
    'SOFTBOOK_ANDROID_RELEASE_STORE_FILE',
    'SOFTBOOK_ANDROID_RELEASE_STORE_PASSWORD',
    'SOFTBOOK_ANDROID_RELEASE_KEY_ALIAS',
    'SOFTBOOK_ANDROID_RELEASE_KEY_PASSWORD',
  ]) {
    assert.match(gradle, new RegExp(name));
  }
});

test('Android ReactHost follows the application build type for dev support', () => {
  const application = read(
    'apps/mobile/android/app/src/main/java/com/softbook/cet/MainApplication.kt',
  );

  assert.match(application, /useDevSupport\s*=\s*BuildConfig\.DEBUG/);
});

test('Android internal preview is standalone, isolated, and rejects cleartext traffic', () => {
  const gradle = read('apps/mobile/android/app/build.gradle');
  const buildTypesStart = gradle.indexOf('    buildTypes {');
  const internalStart = gradle.indexOf('        internal {', buildTypesStart);
  const internalBlock = gradle.slice(
    internalStart,
    gradle.indexOf('\n        }', internalStart) + 10,
  );
  const packageJson = JSON.parse(read('apps/mobile/package.json'));

  assert.notEqual(internalStart, -1);
  assert.match(internalBlock, /initWith release/);
  assert.match(internalBlock, /applicationIdSuffix "\.internal"/);
  assert.match(internalBlock, /versionNameSuffix "-internal"/);
  assert.match(internalBlock, /usesCleartextTraffic: "false"/);
  assert.match(internalBlock, /signingConfig signingConfigs\.debug/);
  assert.equal(
    packageJson.scripts['android:internal'],
    'cd android && ./gradlew :app:assembleInternal --no-daemon',
  );
});

test('Android Release CI uses JDK 17 and verifies an unsigned artifact', () => {
  const workflow = read('.github/workflows/pr-gates.yml');
  const job = workflow.slice(workflow.indexOf('  android-release:'), workflow.indexOf('\n  repo-health:'));

  assert.match(job, /actions\/setup-java@v5/);
  assert.match(job, /java-version: "17"/);
  assert.match(job, /npm run android:release:unsigned/);
  assert.match(job, /app-release-unsigned\.apk/);
  const packageJson = JSON.parse(read('apps/mobile/package.json'));
  assert.match(
    packageJson.scripts['android:release:unsigned'],
    /softbookRequireUnsignedRelease=true/,
  );
  assert.equal(
    packageJson.scripts['android:release:signed'],
    'node ../../scripts/build_android_signed_release.mjs',
  );
});

test('Android remote smoke reuses the complete stable-selector flow', () => {
  const packageJson = JSON.parse(read('apps/mobile/package.json'));
  const flow = read('apps/mobile/e2e/maestro/android-remote-smoke.yaml');
  const sharedRemoteFlow = read('apps/mobile/e2e/maestro/ios-remote-smoke.yaml');

  assert.equal(
    packageJson.scripts['e2e:android:maestro'],
    'maestro test e2e/maestro/android-remote-smoke.yaml',
  );
  assert.match(flow, /name: android-remote-auth-learning-space-statistics-smoke/);
  assert.match(flow, /file: ios-remote-smoke\.yaml/);
  assert.match(
    sharedRemoteFlow,
    /id: "auth-dismiss-keyboard-button"\n\s+optional: true\n- hideKeyboard/,
  );
});
