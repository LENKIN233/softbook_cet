import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  canonicalJsonBytes,
  createMobileReleaseRuntimeProfile,
  mobileReleaseProfileToRemoteRuntimeProfile,
  validateMobileReleaseRuntimeProfile,
} from './lib/mobile_release_runtime_profile.mjs';
import {inspectMobileReleaseRuntimeArtifact} from './inspect_mobile_release_runtime_artifact.mjs';
import {stageMobileReleaseRuntimeProfile} from './stage_mobile_release_runtime_profile.mjs';

const COMMIT = 'ab'.repeat(20);

function fixture() {
  const deliveryProfile = {
    schema_version: 'delivery-profile.v1',
    profile_id: 'receiver-cet4-beta',
    environment_id: 'receiver-cet4-beta',
    region: 'ap-shanghai',
    api_base_url: 'https://receiver.example.cn/softbook-api',
    runtime_mode: 'closed_beta',
    enabled_tracks: ['cet4'],
    minimum_client_versions: {android: '1.0.0', ios: '1.0.0'},
    signing_key_id: 'release-key-a',
  };
  const publicKeyring = {
    schema_version: 'content-manifest-public-keyring.v1',
    keys: [
      {
        key_id: 'release-key-a',
        algorithm: 'ed25519',
        public_key_hex: '01'.repeat(32),
      },
    ],
  };
  const deliveryBytes = Buffer.from(`${JSON.stringify(deliveryProfile)}\n`);
  const keyringBytes = Buffer.from(`${JSON.stringify(publicKeyring)}\n`);
  const profile = createMobileReleaseRuntimeProfile({
    commitSha: COMMIT,
    deliveryProfile,
    deliveryProfileBytes: deliveryBytes,
    publicKeyring,
    publicKeyringBytes: keyringBytes,
  });
  return {profile, bytes: canonicalJsonBytes(profile)};
}

test('receiver profile is deterministic, public-only, and maps every runtime surface remote', () => {
  const {profile, bytes} = fixture();
  assert.deepEqual(
    validateMobileReleaseRuntimeProfile(JSON.parse(bytes), {
      expectedCommit: COMMIT,
    }),
    profile,
  );
  assert.equal(bytes.equals(canonicalJsonBytes(profile)), true);
  assert.deepEqual(mobileReleaseProfileToRemoteRuntimeProfile(profile), {
    baseUrl: 'https://receiver.example.cn/softbook-api',
    contentManifestPublicKeys: {'release-key-a': '01'.repeat(32)},
    learningTrack: 'cet4',
  });
  assert.doesNotMatch(bytes.toString('utf8'), /apiKey|featureModes|private|secret|password|token/i);
});

test('receiver profile rejects local, secret-shaped, stale, and drifted keyring inputs', () => {
  const {profile} = fixture();
  for (const mutate of [
    value => { value.api_base_url = 'http://receiver.example.cn/softbook-api'; },
    value => { value.api_base_url = 'https://repository-fixture.invalid/softbook-api'; },
    value => { value.api_base_url = 'https://receiver.invalid/softbook-api'; },
    value => { value.api_base_url = 'https://localhost/softbook-api'; },
    value => { value.api_base_url = 'https://127.0.0.2/softbook-api'; },
    value => { value.api_base_url = 'https://127.255.255.254/softbook-api'; },
    value => { value.api_base_url = 'https://0.0.0.0/softbook-api'; },
    value => { value.api_base_url = 'https://[::1]/softbook-api'; },
    value => { value.environment_id = 'personal-dev'; },
    value => { value.commit_sha = '0'.repeat(40); },
    value => { value.content_manifest_public_keys[0].public_key_hex = '0'.repeat(64); },
    value => { value.signing_key_id = 'missing-key'; },
    value => { value.apiKey = 'forbidden'; },
  ]) {
    const changed = structuredClone(profile);
    mutate(changed);
    assert.throws(() => validateMobileReleaseRuntimeProfile(changed, {expectedCommit: COMMIT}));
  }
  assert.throws(() =>
    validateMobileReleaseRuntimeProfile(profile, {expectedCommit: 'cd'.repeat(20)}),
  );
});

test('repository fixture requires an explicit non-formal allowance', () => {
  const file = path.resolve(
    'apps/mobile/e2e/fixtures/mobile-release-runtime-profile.repository-fixture.json',
  );
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.throws(() => validateMobileReleaseRuntimeProfile(value));
  assert.equal(
    validateMobileReleaseRuntimeProfile(value, {allowRepositoryFixture: true})
      .gate_eligible,
    false,
  );
  const otherInvalidHost = structuredClone(value);
  otherInvalidHost.api_base_url = 'https://other.invalid/softbook-api';
  assert.throws(() =>
    validateMobileReleaseRuntimeProfile(otherInvalidHost, {
      allowRepositoryFixture: true,
    }),
  );
});

test('native Release wiring embeds one profile and keeps environment override debug-only', () => {
  const appDelegate = fs.readFileSync(
    'apps/mobile/ios/SoftbookCET/AppDelegate.swift',
    'utf8',
  );
  const project = fs.readFileSync(
    'apps/mobile/ios/SoftbookCET.xcodeproj/project.pbxproj',
    'utf8',
  );
  const iosInfo = fs.readFileSync(
    'apps/mobile/ios/SoftbookCET/SoftbookAppInfo.m',
    'utf8',
  );
  const androidInfo = fs.readFileSync(
    'apps/mobile/android/app/src/main/java/com/softbook/cet/runtime/SoftbookAppInfoModule.kt',
    'utf8',
  );
  assert.match(appDelegate, /#if DEBUG[\s\S]*ProcessInfo\.processInfo\.environment[\s\S]*#else\s+return nil/);
  assert.match(project, /\[Softbook\] Embed Release Runtime Profile/);
  assert.match(project, /stage_mobile_release_runtime_profile\.mjs/);
  assert.match(project, /CODE_SIGNING_ALLOWED:-YES/);
  assert.match(iosInfo, /releaseRuntimeProfileJson/);
  assert.match(androidInfo, /softbook-release-runtime-profile\.json/);
});

test('stager and APK/IPA inspectors retain byte-identical profile resources', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mobile-release-runtime-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const {bytes} = fixture();
  const profilePath = path.join(root, 'profile.json');
  const stagedPath = path.join(root, 'staged.json');
  fs.writeFileSync(profilePath, bytes);
  const staged = stageMobileReleaseRuntimeProfile({
    inputPath: profilePath,
    outputPath: stagedPath,
    repositoryCommit: COMMIT,
  });
  assert.match(staged.sha256, /^sha256:[0-9a-f]{64}$/);

  const apkRoot = path.join(root, 'apk');
  fs.mkdirSync(path.join(apkRoot, 'assets'), {recursive: true});
  fs.copyFileSync(stagedPath, path.join(apkRoot, 'assets', 'softbook-release-runtime-profile.json'));
  const apk = path.join(root, 'app.apk');
  execFileSync('zip', ['-q', '-r', apk, '.'], {cwd: apkRoot});
  assert.equal(
    inspectMobileReleaseRuntimeArtifact({
      artifactPath: apk,
      expectedProfilePath: profilePath,
      format: 'apk',
    }).ok,
    true,
  );

  const ipaRoot = path.join(root, 'ipa');
  const appRoot = path.join(ipaRoot, 'Payload', 'SoftbookCET.app');
  fs.mkdirSync(appRoot, {recursive: true});
  fs.copyFileSync(stagedPath, path.join(appRoot, 'softbook-release-runtime-profile.json'));
  const ipa = path.join(root, 'app.ipa');
  execFileSync('zip', ['-q', '-r', ipa, '.'], {cwd: ipaRoot});
  assert.equal(
    inspectMobileReleaseRuntimeArtifact({
      artifactPath: ipa,
      expectedProfilePath: profilePath,
      format: 'ipa',
    }).ok,
    true,
  );

  fs.appendFileSync(path.join(appRoot, 'softbook-release-runtime-profile.json'), ' ');
  const tampered = path.join(root, 'tampered.ipa');
  execFileSync('zip', ['-q', '-r', tampered, '.'], {cwd: ipaRoot});
  assert.throws(
    () =>
      inspectMobileReleaseRuntimeArtifact({
        artifactPath: tampered,
        expectedProfilePath: profilePath,
        format: 'ipa',
      }),
    /bytes do not match/,
  );
});
