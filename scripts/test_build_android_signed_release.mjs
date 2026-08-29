#!/usr/bin/env node

import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildSignedAndroidRelease,
  finalizeSignedAndroidRelease,
  inspectSigningEnvironment,
  parseApkSignerOutput,
  parseArguments,
  validateAndroidSignedReleaseReport,
  verifySignedAndroidReleaseReport,
} from './build_android_signed_release.mjs';
import {canonicalJsonBytes} from './lib/mobile_release_runtime_profile.mjs';

const COMMIT = '1234567890abcdef1234567890abcdef12345678';
const CERTIFICATE_SHA = 'abcdef0123456789'.repeat(4);
const APK_CONTENT = Buffer.from('receiver-signed-softbook-apk');
const APK_SHA = createHash('sha256').update(APK_CONTENT).digest('hex');
const PROFILE_ID = 'receiver-profile-001';
const ENVIRONMENT_ID = 'receiver-prod-001';
const SIGNING_KEY_ID = 'receiver-content-key-001';
const DELIVERY_PROFILE_SHA = `sha256:${createHash('sha256')
  .update('receiver-delivery-profile')
  .digest('hex')}`;
const PUBLIC_KEYRING_SHA = `sha256:${createHash('sha256')
  .update('receiver-public-keyring')
  .digest('hex')}`;
const ARCHIVE_URL =
  'https://github.com/LENKIN233/softbook_cet/releases/download/android-beta-1/app-release.apk';
const MACHINE_VERIFIER_ENV = Object.freeze({
  SOFTBOOK_ANDROID_RELEASE_VERIFIER: 'service:softbook-release-verifier',
  SOFTBOOK_ANDROID_RELEASE_VERIFIER_RUN_ID: 'android-release-verify-001',
});

test('signing environment is all-or-nothing and never returns secrets', t => {
  const fixture = createFixture(t);
  assert.deepEqual(inspectSigningEnvironment({}), {
    complete: false,
    configured_names: [],
  });
  assert.throws(
    () =>
      inspectSigningEnvironment({
        SOFTBOOK_ANDROID_RELEASE_STORE_FILE: fixture.keystore,
      }),
    /partially configured/,
  );

  const result = inspectSigningEnvironment(fixture.signingEnv);
  assert.equal(result.complete, true);
  assert.deepEqual(result.configured_names, [
    'SOFTBOOK_ANDROID_RELEASE_STORE_FILE',
    'SOFTBOOK_ANDROID_RELEASE_STORE_PASSWORD',
    'SOFTBOOK_ANDROID_RELEASE_KEY_ALIAS',
    'SOFTBOOK_ANDROID_RELEASE_KEY_PASSWORD',
  ]);
  assert.doesNotMatch(
    JSON.stringify(result),
    /receiver-store-password|receiver-key-password/,
  );

  if (process.platform !== 'win32') {
    fs.chmodSync(fixture.keystore, 0o640);
    assert.throws(
      () => inspectSigningEnvironment(fixture.signingEnv),
      /must not be readable or writable by group or other users/,
    );
    fs.chmodSync(fixture.keystore, 0o600);
  }
});

test('receiver keystore must remain outside the repository', async t => {
  const fixture = createFixture(t);
  const repositoryKeystore = path.join(fixture.root, 'receiver-release.jks');
  fs.writeFileSync(repositoryKeystore, 'unsafe-repository-keystore', {
    mode: 0o600,
  });
  fs.chmodSync(repositoryKeystore, 0o600);

  await assert.rejects(
    buildSignedAndroidRelease({
      env: {
        ...fixture.signingEnv,
        SOFTBOOK_ANDROID_RELEASE_STORE_FILE: repositoryKeystore,
      },
      repository: exactMainRepository(),
      repositoryRoot: fixture.root,
      statePath: path.join(
        fixture.root,
        'docs/agent-runs/artifacts/state.json',
      ),
    }),
    /must be stored outside the repository/,
  );
});

test('mutating signed release operations require clean main at origin/main', async t => {
  const fixture = createFixture(t);
  const statePath = path.join(
    fixture.root,
    'docs/agent-runs/artifacts/android-signed-release-state.json',
  );
  const repository = {
    ...exactMainRepository(),
    branch: 'cross/android-signed-release',
  };
  const dryRun = await buildSignedAndroidRelease({
    env: fixture.signingEnv,
    repository,
    repositoryRoot: fixture.root,
    statePath,
  });
  assert.equal(dryRun.status, 'dry_run');
  assert.equal(dryRun.repository_ready, false);

  await assert.rejects(
    buildSignedAndroidRelease({
      apply: true,
      env: fixture.signingEnv,
      repository,
      repositoryRoot: fixture.root,
      runner: createRunner(fixture),
      statePath,
    }),
    /clean main exactly matching origin\/main/,
  );
  assert.equal(fs.existsSync(statePath), false);
});

test('Android release identity requires a three-part version name', async t => {
  const fixture = createFixture(t);
  const statePath = path.join(
    fixture.root,
    'docs/agent-runs/artifacts/android-signed-release-state.json',
  );

  const dryRun = await buildSignedAndroidRelease({
    env: fixture.signingEnv,
    repository: exactMainRepository(),
    repositoryRoot: fixture.root,
    statePath,
  });
  assert.equal(dryRun.version_name, '1.0.0');

  fs.writeFileSync(
    path.join(fixture.root, 'apps/mobile/android/app/build.gradle'),
    'applicationId "com.softbook.cet"\nversionCode 1\nversionName "1.0"\n',
  );
  await assert.rejects(
    buildSignedAndroidRelease({
      env: fixture.signingEnv,
      repository: exactMainRepository(),
      repositoryRoot: fixture.root,
      statePath,
    }),
    /Android application identity is invalid/,
  );

  fs.writeFileSync(
    path.join(fixture.root, 'apps/mobile/android/app/build.gradle'),
    'applicationId "com.softbook.cet"\nversionCode 1\nversionName "01.0.0"\n',
  );
  await assert.rejects(
    buildSignedAndroidRelease({
      env: fixture.signingEnv,
      repository: exactMainRepository(),
      repositoryRoot: fixture.root,
      statePath,
    }),
    /Android application identity is invalid/,
  );

  const report = validReport();
  report.version_name = '1.0';
  assert.match(
    validateAndroidSignedReleaseReport(report).join('\n'),
    /version_name is invalid/,
  );
});

test('signed build requires an exact receiver runtime profile bound to the build commit and APK bytes', async t => {
  const fixture = createFixture(t);
  const statePath = path.join(
    fixture.root,
    'docs/agent-runs/artifacts/android-signed-release-state.json',
  );
  const withoutProfile = {...fixture.signingEnv};
  delete withoutProfile.SOFTBOOK_MOBILE_RELEASE_RUNTIME_PROFILE;
  await assert.rejects(
    buildSignedAndroidRelease({
      env: withoutProfile,
      repository: exactMainRepository(),
      repositoryRoot: fixture.root,
      statePath,
    }),
    /requires SOFTBOOK_MOBILE_RELEASE_RUNTIME_PROFILE or --runtime-profile/,
  );

  const relativeProfile = path.relative(
    fixture.root,
    fixture.runtimeProfilePath,
  );
  const dryRun = await buildSignedAndroidRelease({
    env: {
      ...fixture.signingEnv,
      SOFTBOOK_MOBILE_RELEASE_RUNTIME_PROFILE: relativeProfile,
    },
    repository: exactMainRepository(),
    repositoryRoot: fixture.root,
    statePath,
  });
  assert.deepEqual(
    dryRun.mobile_runtime_profile,
    runtimeProfileBinding(fixture.runtimeProfileBytes),
  );

  fs.writeFileSync(
    fixture.runtimeProfilePath,
    canonicalJsonBytes({
      ...receiverRuntimeProfile(),
      commit_sha: '234567890abcdef1234567890abcdef123456789',
    }),
  );
  await assert.rejects(
    buildSignedAndroidRelease({
      env: fixture.signingEnv,
      repository: exactMainRepository(),
      repositoryRoot: fixture.root,
      statePath,
    }),
    /commit does not match the build commit/,
  );

  fs.writeFileSync(
    fixture.runtimeProfilePath,
    canonicalJsonBytes({
      ...receiverRuntimeProfile(),
      configuration_class: 'repository_fixture',
      gate_eligible: false,
    }),
  );
  await assert.rejects(
    buildSignedAndroidRelease({
      env: fixture.signingEnv,
      repository: exactMainRepository(),
      repositoryRoot: fixture.root,
      statePath,
    }),
    /Repository fixture runtime profile is not allowed/,
  );

  fs.writeFileSync(fixture.runtimeProfilePath, fixture.runtimeProfileBytes);
  const wrongEmbeddedProfile = canonicalJsonBytes({
    ...receiverRuntimeProfile(),
    profile_id: 'receiver-profile-002',
  });
  await assert.rejects(
    buildSignedAndroidRelease({
      apply: true,
      env: fixture.signingEnv,
      repository: exactMainRepository(),
      repositoryRoot: fixture.root,
      runner: createRunner(fixture, {
        embeddedProfileBytes: wrongEmbeddedProfile,
      }),
      statePath,
    }),
    /Embedded mobile release runtime profile bytes do not match/,
  );
  assert.equal(fs.existsSync(statePath), false);
});

test('apksigner evidence requires one certificate and v2 or newer', () => {
  const result = parseApkSignerOutput(validApkSignerOutput());
  assert.equal(result.certificate_sha256, CERTIFICATE_SHA);
  assert.deepEqual(result.signature_schemes, {
    v1: true,
    v2: true,
    v3: false,
    v3_1: false,
    v4: false,
  });

  assert.throws(
    () =>
      parseApkSignerOutput(
        validApkSignerOutput().replace(
          'Verified using v2 scheme (APK Signature Scheme v2): true',
          'Verified using v2 scheme (APK Signature Scheme v2): false',
        ),
      ),
    /v2 or newer/,
  );
  assert.throws(
    () =>
      parseApkSignerOutput(
        `${validApkSignerOutput()}\nSigner #2 certificate SHA-256 digest: ${'0123456789abcdef'.repeat(
          4,
        )}`,
      ),
    /exactly one signing certificate/,
  );
  assert.throws(
    () =>
      parseApkSignerOutput(
        `${validApkSignerOutput()}\nSigner #2 certificate SHA-256 digest: ${CERTIFICATE_SHA}`,
      ),
    /exactly one signing certificate/,
  );
});

test('signed build and GitHub Release finalization create verifiable public evidence', async t => {
  const fixture = createFixture(t);
  const repository = exactMainRepository();
  const statePath = path.join(
    fixture.root,
    'docs/agent-runs/artifacts/android-signed-release-state.json',
  );
  const reportPath = path.join(
    fixture.root,
    'docs/release/evidence/android-signed-release.json',
  );
  const runner = createRunner(fixture);

  const built = await buildSignedAndroidRelease({
    apply: true,
    clock: () => new Date('2026-07-30T01:00:00.000Z'),
    env: fixture.signingEnv,
    repository,
    repositoryRoot: fixture.root,
    runner,
    statePath,
  });
  const builtArtifactBytes = fs.readFileSync(signedArtifactPath(fixture));
  const builtArtifactSha = createHash('sha256')
    .update(builtArtifactBytes)
    .digest('hex');

  assert.equal(built.status, 'built_and_verified');
  assert.equal(built.artifact_sha256, builtArtifactSha);
  assert.deepEqual(
    built.mobile_runtime_profile,
    runtimeProfileBinding(fixture.runtimeProfileBytes),
  );
  assert.equal(fs.statSync(statePath).mode & 0o777, 0o600);
  const stateText = fs.readFileSync(statePath, 'utf8');
  assert.doesNotMatch(
    stateText,
    /receiver-store-password|receiver-key-password/,
  );

  const report = await finalizeSignedAndroidRelease({
    apply: true,
    archiveUrl: ARCHIVE_URL,
    clock: () => new Date('2026-07-30T02:00:00.000Z'),
    env: MACHINE_VERIFIER_ENV,
    fetchImpl: githubReleaseFetch({fixture}),
    reportPath,
    repository,
    repositoryRoot: fixture.root,
    runtimeProfilePath: fixture.runtimeProfilePath,
    statePath,
  });

  assert.equal(report.status, 'passed');
  assert.equal(report.artifact.sha256, builtArtifactSha);
  assert.deepEqual(
    report.mobile_runtime_profile,
    runtimeProfileBinding(fixture.runtimeProfileBytes),
  );
  assert.equal(report.signing.certificate_sha256, CERTIFICATE_SHA);
  assert.equal(fs.existsSync(statePath), false);
  assert.equal(fs.existsSync(reportPath), true);
  assert.deepEqual(validateAndroidSignedReleaseReport(report), []);

  const verified = await verifySignedAndroidReleaseReport({
    fetchImpl: githubReleaseFetch({fixture}),
    reportPath,
    repositoryRoot: fixture.root,
    runtimeProfilePath: fixture.runtimeProfilePath,
  });
  assert.equal(verified.status, 'passed');
  assert.equal(verified.remote_digest_matches, true);
  assert.equal(verified.remote_runtime_profile_matches, true);
});

test('tampered private state cannot redirect finalization to another file', async t => {
  const fixture = createFixture(t);
  const repository = exactMainRepository();
  const statePath = path.join(
    fixture.root,
    'docs/agent-runs/artifacts/android-signed-release-state.json',
  );
  const reportPath = path.join(
    fixture.root,
    'docs/release/evidence/android-signed-release.json',
  );
  await buildSignedAndroidRelease({
    apply: true,
    env: fixture.signingEnv,
    repository,
    repositoryRoot: fixture.root,
    runner: createRunner(fixture),
    statePath,
  });
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.artifact_path = fixture.keystore;
  fs.writeFileSync(statePath, `${JSON.stringify(state)}\n`, { mode: 0o600 });
  fs.chmodSync(statePath, 0o600);

  await assert.rejects(
    finalizeSignedAndroidRelease({
      archiveUrl: ARCHIVE_URL,
      env: MACHINE_VERIFIER_ENV,
      fetchImpl: githubReleaseFetch({fixture}),
      reportPath,
      repository,
      repositoryRoot: fixture.root,
      runtimeProfilePath: fixture.runtimeProfilePath,
      statePath,
    }),
    /artifact_path is invalid/,
  );
});

test('private state and public reports reject duplicate JSON keys', async t => {
  const fixture = createFixture(t);
  const repository = exactMainRepository();
  const statePath = path.join(
    fixture.root,
    'docs/agent-runs/artifacts/android-signed-release-state.json',
  );
  const reportPath = path.join(
    fixture.root,
    'docs/release/evidence/android-signed-release.json',
  );
  await buildSignedAndroidRelease({
    apply: true,
    env: fixture.signingEnv,
    repository,
    repositoryRoot: fixture.root,
    runner: createRunner(fixture),
    statePath,
  });
  const privateState = fs.readFileSync(statePath, 'utf8').replace(
    '"status": "built_and_verified",',
    '"status": "built_and_verified",\n  "status": "built_and_verified",',
  );
  fs.writeFileSync(statePath, privateState, {mode: 0o600});
  fs.chmodSync(statePath, 0o600);
  await assert.rejects(
    finalizeSignedAndroidRelease({
      archiveUrl: ARCHIVE_URL,
      env: MACHINE_VERIFIER_ENV,
      fetchImpl: githubReleaseFetch({fixture}),
      reportPath,
      repository,
      repositoryRoot: fixture.root,
      runtimeProfilePath: fixture.runtimeProfilePath,
      statePath,
    }),
    /duplicate object key.*status/i,
  );

  fs.mkdirSync(path.dirname(reportPath), {recursive: true});
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(validReport()).replace(
      '"status":"passed",',
      '"status":"passed","status":"passed",',
    )}\n`,
  );
  await assert.rejects(
    verifySignedAndroidReleaseReport({
      fetchImpl: githubReleaseFetch(),
      reportPath,
      repositoryRoot: fixture.root,
      runtimeProfilePath: fixture.runtimeProfilePath,
    }),
    /duplicate object key.*status/i,
  );
});

test('state and report paths reject symbolic-link traversal', async t => {
  const fixture = createFixture(t);
  const outside = fs.mkdtempSync(
    path.join(os.tmpdir(), 'softbook-android-signing-outside-'),
  );
  t.after(() => fs.rmSync(outside, {force: true, recursive: true}));
  const stateRoot = path.join(fixture.root, 'docs/agent-runs/artifacts');
  fs.mkdirSync(path.dirname(stateRoot), {recursive: true});
  fs.symlinkSync(outside, stateRoot);
  const statePath = path.join(stateRoot, 'state.json');

  await assert.rejects(
    buildSignedAndroidRelease({
      env: fixture.signingEnv,
      repository: exactMainRepository(),
      repositoryRoot: fixture.root,
      statePath,
    }),
    /must not contain symbolic links/,
  );
  assert.deepEqual(fs.readdirSync(outside), []);

  fs.rmSync(stateRoot);
  const reportRoot = path.join(fixture.root, 'docs/release/evidence');
  fs.mkdirSync(path.dirname(reportRoot), {recursive: true});
  fs.symlinkSync(outside, reportRoot);
  await assert.rejects(
    verifySignedAndroidReleaseReport({
      fetchImpl: githubReleaseFetch(),
      reportPath: path.join(reportRoot, 'report.json'),
      repositoryRoot: fixture.root,
      runtimeProfilePath: fixture.runtimeProfilePath,
    }),
    /must not contain symbolic links/,
  );
  assert.deepEqual(fs.readdirSync(outside), []);
});

test('finalization requires machine principal and run evidence and rejects changed, digest-less, and mismatched evidence', async t => {
  const fixture = createFixture(t);
  const repository = exactMainRepository();
  const statePath = path.join(
    fixture.root,
    'docs/agent-runs/artifacts/android-signed-release-state.json',
  );
  const reportPath = path.join(
    fixture.root,
    'docs/release/evidence/android-signed-release.json',
  );
  await buildSignedAndroidRelease({
    apply: true,
    env: fixture.signingEnv,
    repository,
    repositoryRoot: fixture.root,
    runner: createRunner(fixture),
    statePath,
  });
  const archivedFetch = githubReleaseFetch({fixture});
  const finalize = overrides =>
    finalizeSignedAndroidRelease({
      archiveUrl: ARCHIVE_URL,
      env: MACHINE_VERIFIER_ENV,
      fetchImpl: archivedFetch,
      reportPath,
      repository,
      repositoryRoot: fixture.root,
      runtimeProfilePath: fixture.runtimeProfilePath,
      statePath,
      ...overrides,
    });

  await assert.rejects(
    finalize({
      env: {
        SOFTBOOK_ANDROID_RELEASE_VERIFIER: 'github:human-reviewer',
        SOFTBOOK_ANDROID_RELEASE_VERIFIER_RUN_ID: 'android-release-verify-001',
      },
    }),
    /machine principal/,
  );
  await assert.rejects(
    finalize({
      fetchImpl: githubReleaseFetch({fixture, includeDigest: false}),
    }),
    /authenticated SHA-256 digest/,
  );
  await assert.rejects(
    finalize({
      fetchImpl: githubReleaseFetch({
        fixture,
        sha256: 'fedcba9876543210'.repeat(4),
      }),
    }),
    /does not match/,
  );

  const artifactPath = path.join(
    fixture.root,
    'apps/mobile/android/app/build/outputs/apk/release/app-release.apk',
  );
  fs.appendFileSync(artifactPath, '-changed');
  await assert.rejects(finalize(), /changed after verification/);
  assert.equal(fs.existsSync(statePath), true);
  assert.equal(fs.existsSync(reportPath), false);
});

test('finalization rejects a receiver runtime profile changed after the signed build', async t => {
  const fixture = createFixture(t);
  const repository = exactMainRepository();
  const statePath = path.join(
    fixture.root,
    'docs/agent-runs/artifacts/android-signed-release-state.json',
  );
  const reportPath = path.join(
    fixture.root,
    'docs/release/evidence/android-signed-release.json',
  );
  await buildSignedAndroidRelease({
    apply: true,
    env: fixture.signingEnv,
    repository,
    repositoryRoot: fixture.root,
    runner: createRunner(fixture),
    statePath,
  });
  const archivedFetch = githubReleaseFetch({fixture});
  fs.writeFileSync(
    fixture.runtimeProfilePath,
    canonicalJsonBytes({
      ...receiverRuntimeProfile(),
      profile_id: 'receiver-profile-002',
    }),
  );
  await assert.rejects(
    finalizeSignedAndroidRelease({
      archiveUrl: ARCHIVE_URL,
      env: MACHINE_VERIFIER_ENV,
      fetchImpl: archivedFetch,
      reportPath,
      repository,
      repositoryRoot: fixture.root,
      runtimeProfilePath: fixture.runtimeProfilePath,
      statePath,
    }),
    /Current receiver runtime profile does not match the signed build state/,
  );
  assert.equal(fs.existsSync(statePath), true);
  assert.equal(fs.existsSync(reportPath), false);
});

test('report validation and CLI parsing fail closed', () => {
  const report = validReport();
  assert.deepEqual(validateAndroidSignedReleaseReport(report), []);
  report.signing.signature_schemes.v2 = false;
  assert.match(
    validateAndroidSignedReleaseReport(report).join('\n'),
    /v2 or newer/,
  );

  const extraRuntimeKey = validReport();
  extraRuntimeKey.mobile_runtime_profile.unbound = true;
  assert.match(
    validateAndroidSignedReleaseReport(extraRuntimeKey).join('\n'),
    /mobile_runtime_profile keys are not exact/,
  );
  const wrongSigningKey = validReport();
  wrongSigningKey.mobile_runtime_profile.key_ids = ['receiver-content-key-002'];
  assert.match(
    validateAndroidSignedReleaseReport(wrongSigningKey).join('\n'),
    /signing_key_id must identify exactly one key_id/,
  );

  assert.deepEqual(
    parseArguments([
      'finalize',
      '--state',
      'docs/agent-runs/artifacts/state.json',
      '--report',
      'docs/release/evidence/report.json',
      '--archive-url',
      ARCHIVE_URL,
      '--apply',
      '--format',
      'json',
    ]),
    {
      apply: true,
      archiveUrl: ARCHIVE_URL,
      command: 'finalize',
      format: 'json',
      reportPath: 'docs/release/evidence/report.json',
      runtimeProfilePath: null,
      statePath: 'docs/agent-runs/artifacts/state.json',
    },
  );
  assert.throws(
    () => parseArguments(['verify', '--apply', '--report', 'x']),
    /read-only/,
  );
  assert.equal(
    parseArguments([
      'build',
      '--state',
      'docs/agent-runs/artifacts/state.json',
      '--runtime-profile',
      'receiver/mobile-runtime-profile.json',
    ]).runtimeProfilePath,
    'receiver/mobile-runtime-profile.json',
  );
  assert.throws(
    () =>
      parseArguments([
        'discard',
        '--state',
        'docs/agent-runs/artifacts/state.json',
        '--runtime-profile',
        'receiver/mobile-runtime-profile.json',
      ]),
    /not valid for discard/,
  );
});

function createFixture(t) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'softbook-android-signing-'),
  );
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const gradle = path.join(root, 'apps/mobile/android/app/build.gradle');
  const gradlew = path.join(root, 'apps/mobile/android/gradlew');
  const privateRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'softbook-android-keystore-'),
  );
  t.after(() => fs.rmSync(privateRoot, {force: true, recursive: true}));
  const keystore = path.join(privateRoot, 'receiver-release.jks');
  const apksigner = path.join(root, 'android-sdk/apksigner');
  const runtimeProfilePath = path.join(
    root,
    'receiver/mobile-release-runtime-profile.json',
  );
  const runtimeProfileBytes = canonicalJsonBytes(receiverRuntimeProfile());
  fs.mkdirSync(path.dirname(gradle), { recursive: true });
  fs.mkdirSync(path.dirname(apksigner), { recursive: true });
  fs.mkdirSync(path.dirname(runtimeProfilePath), {recursive: true});
  fs.writeFileSync(
    gradle,
    'applicationId "com.softbook.cet"\nversionCode 1\nversionName "1.0.0"\n',
  );
  fs.writeFileSync(gradlew, '#!/bin/sh\n');
  fs.writeFileSync(keystore, 'test-keystore', {mode: 0o600});
  fs.chmodSync(keystore, 0o600);
  fs.writeFileSync(apksigner, '#!/bin/sh\n');
  fs.writeFileSync(runtimeProfilePath, runtimeProfileBytes);
  return {
    apksigner,
    gradle,
    keystore,
    root,
    runtimeProfileBytes,
    runtimeProfilePath,
    signingEnv: {
      SOFTBOOK_ANDROID_APKSIGNER: apksigner,
      SOFTBOOK_ANDROID_RELEASE_KEY_ALIAS: 'softbook-release',
      SOFTBOOK_ANDROID_RELEASE_KEY_PASSWORD: 'receiver-key-password',
      SOFTBOOK_ANDROID_RELEASE_STORE_FILE: keystore,
      SOFTBOOK_ANDROID_RELEASE_STORE_PASSWORD: 'receiver-store-password',
      SOFTBOOK_ANDROID_RELEASE_TARGET_ID: 'receiver-beta',
      SOFTBOOK_MOBILE_RELEASE_RUNTIME_PROFILE: runtimeProfilePath,
    },
  };
}

function createRunner(
  fixture,
  {embeddedProfileBytes = fixture.runtimeProfileBytes} = {},
) {
  return {
    run(command, args) {
      if (command.endsWith('gradlew')) {
        assert.ok(args.includes('-PsoftbookRequireSignedRelease=true'));
        assert.ok(
          args.includes(
            `-PsoftbookReleaseRuntimeProfile=${fixture.runtimeProfilePath}`,
          ),
        );
        const artifact = path.join(
          fixture.root,
          'apps/mobile/android/app/build/outputs/apk/release/app-release.apk',
        );
        fs.mkdirSync(path.dirname(artifact), { recursive: true });
        const archiveRoot = path.join(fixture.root, 'apk-fixture');
        const assetPath = path.join(
          archiveRoot,
          'assets/softbook-release-runtime-profile.json',
        );
        fs.mkdirSync(path.dirname(assetPath), {recursive: true});
        fs.writeFileSync(assetPath, embeddedProfileBytes);
        fs.rmSync(artifact, {force: true});
        execFileSync('zip', ['-q', '-r', artifact, 'assets'], {
          cwd: archiveRoot,
        });
        return { stdout: '', stderr: '' };
      }
      if (args[0] === 'version') return { stdout: '35.0.0\n', stderr: '' };
      if (args[0] === 'verify')
        return { stdout: validApkSignerOutput(), stderr: '' };
      throw new Error(`Unexpected runner call: ${command} ${args.join(' ')}`);
    },
  };
}

function receiverRuntimeProfile() {
  return {
    api_base_url: 'https://receiver.example.com/softbook-api',
    commit_sha: COMMIT,
    configuration_class: 'receiver_release',
    content_manifest_public_keys: [
      {
        algorithm: 'ed25519',
        key_id: SIGNING_KEY_ID,
        public_key_hex: createHash('sha256')
          .update('receiver-content-public-key')
          .digest('hex'),
      },
    ],
    delivery_profile_sha256: DELIVERY_PROFILE_SHA,
    environment_id: ENVIRONMENT_ID,
    learning_track: 'cet4',
    minimum_client_versions: {android: '1.0.0', ios: '1.0.0'},
    profile_id: PROFILE_ID,
    public_keyring_sha256: PUBLIC_KEYRING_SHA,
    repository: 'LENKIN233/softbook_cet',
    runtime_mode: 'closed_beta',
    schema_version: 'mobile-release-runtime-profile.v1',
    signing_key_id: SIGNING_KEY_ID,
    target_release: 'cet4-closed-beta',
  };
}

function runtimeProfileBinding(profileBytes = canonicalJsonBytes(receiverRuntimeProfile())) {
  return {
    profile_sha256: `sha256:${createHash('sha256')
      .update(profileBytes)
      .digest('hex')}`,
    delivery_profile_sha256: DELIVERY_PROFILE_SHA,
    public_keyring_sha256: PUBLIC_KEYRING_SHA,
    profile_id: PROFILE_ID,
    environment_id: ENVIRONMENT_ID,
    signing_key_id: SIGNING_KEY_ID,
    key_ids: [SIGNING_KEY_ID],
  };
}

function githubReleaseFetch({
  fixture = null,
  includeDigest = true,
  sha256: configuredSha256 = null,
} = {}) {
  const bytes = fixture
    ? fs.readFileSync(signedArtifactPath(fixture))
    : APK_CONTENT;
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  const sha256 = configuredSha256 ?? actualSha256;
  return async url => {
    if (
      /api\.github\.com\/repos\/LENKIN233\/softbook_cet\/releases\/assets\/12345/.test(
        String(url),
      )
    ) {
      return {
        ok: true,
        status: 200,
        async arrayBuffer() {
          return bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          );
        },
      };
    }
    assert.match(
      String(url),
      /api\.github\.com\/repos\/LENKIN233\/softbook_cet\/releases\/tags\/android-beta-1/,
    );
    return {
      ok: true,
      status: 200,
      async json() {
        const asset = {
          name: 'app-release.apk',
          size: bytes.length,
          state: 'uploaded',
          url: 'https://api.github.com/repos/LENKIN233/softbook_cet/releases/assets/12345',
        };
        if (includeDigest) asset.digest = `sha256:${sha256}`;
        return { assets: [asset] };
      },
    };
  };
}

function signedArtifactPath(fixture) {
  return path.join(
    fixture.root,
    'apps/mobile/android/app/build/outputs/apk/release/app-release.apk',
  );
}

function exactMainRepository() {
  return { branch: 'main', dirty: false, head: COMMIT, originMain: COMMIT };
}

function validApkSignerOutput() {
  return [
    'Verifies',
    'Verified using v1 scheme (JAR signing): true',
    'Verified using v2 scheme (APK Signature Scheme v2): true',
    'Verified using v3 scheme (APK Signature Scheme v3): false',
    `Signer #1 certificate SHA-256 digest: ${CERTIFICATE_SHA}`,
  ].join('\n');
}

function validReport() {
  return {
    schema_version: 'android-signed-release.v1',
    status: 'passed',
    platform: 'android',
    target_id: 'receiver-beta',
    repository_commit: COMMIT,
    application_id: 'com.softbook.cet',
    version_code: 1,
    version_name: '1.0.0',
    artifact: {
      filename: 'app-release.apk',
      sha256: APK_SHA,
      size_bytes: APK_CONTENT.length,
      archive_url: ARCHIVE_URL,
    },
    signing: {
      certificate_sha256: CERTIFICATE_SHA,
      signature_schemes: {
        v1: true,
        v2: true,
        v3: false,
        v3_1: false,
        v4: false,
      },
      verifier: 'android-sdk-apksigner',
      verifier_version: '35.0.0',
    },
    mobile_runtime_profile: runtimeProfileBinding(),
    built_at: '2026-07-30T01:00:00.000Z',
    archived_verified_at: '2026-07-30T02:00:00.000Z',
    verified_by: 'service:softbook-release-verifier',
    verification_run_id: 'android-release-verify-001',
    private_state_removed: true,
    generated_at: '2026-07-30T02:00:00.000Z',
  };
}
