#!/usr/bin/env node

import {execFileSync, spawnSync} from 'node:child_process';
import {
  chmodSync,
  closeSync,
  lstatSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  canonicalJsonBytes,
  validateMobileReleaseRuntimeProfile,
} from './lib/mobile_release_runtime_profile.mjs';
import {inspectMobileReleaseRuntimeArtifact} from './inspect_mobile_release_runtime_artifact.mjs';
import {parseStrictJson} from './lib/strict_json.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE_ROOT = join(ROOT, 'apps', 'mobile');
const SOURCE_PROFILE = join(
  MOBILE_ROOT,
  'ios',
  'SoftbookCET',
  'softbook-release-runtime-profile.json',
);
const FIXTURE_PROFILE = join(
  MOBILE_ROOT,
  'e2e',
  'fixtures',
  'mobile-release-runtime-profile.repository-fixture.json',
);
const REQUIRED_NODE_VERSION = '22.13.0';

export function buildIosRelease({
  archivePath = null,
  derivedDataPath,
  mode,
  nodeVersion = process.versions.node,
  runtimeProfilePath,
  repositoryCommit = readRepositoryCommit(),
  runXcode = runXcodeBuild,
} = {}) {
  if (!['archive', 'simulator'].includes(mode)) {
    throw new Error('iOS release mode must be archive or simulator.');
  }
  if (!derivedDataPath || !runtimeProfilePath) {
    throw new Error('iOS release requires --derived-data and --runtime-profile.');
  }
  if (mode === 'archive' && !archivePath) {
    throw new Error('iOS archive mode requires --archive-path.');
  }
  if (nodeVersion !== REQUIRED_NODE_VERSION) {
    throw new Error(`iOS release requires Node ${REQUIRED_NODE_VERSION}.`);
  }

  const fixtureBytes = readBoundedRegularBytes(FIXTURE_PROFILE, 'repository fixture');
  const sourceBytes = readBoundedRegularBytes(SOURCE_PROFILE, 'iOS staged profile');
  if (!sourceBytes.equals(fixtureBytes)) {
    throw new Error('iOS staged profile must equal the tracked repository fixture before build.');
  }
  const profileBytes = readBoundedRegularBytes(runtimeProfilePath, 'receiver runtime profile');
  const profile = validateMobileReleaseRuntimeProfile(
    parseStrictJson(profileBytes, 'receiver runtime profile'),
    {expectedCommit: repositoryCommit},
  );
  if (
    profile.configuration_class !== 'receiver_release' ||
    !profileBytes.equals(canonicalJsonBytes(profile))
  ) {
    throw new Error('iOS release requires canonical receiver_release profile bytes.');
  }

  const lockPath = join(tmpdir(), 'softbook-ios-release-build.lock');
  let lockDescriptor;
  try {
    lockDescriptor = openSync(lockPath, 'wx', 0o600);
  } catch {
    throw new Error('Another guarded iOS release build is already active.');
  }

  let result;
  try {
    writeFileSync(SOURCE_PROFILE, profileBytes, {flag: 'w', mode: 0o644});
    chmodSync(SOURCE_PROFILE, 0o644);
    const build = runXcode({
      archivePath,
      derivedDataPath: resolve(derivedDataPath),
      mode,
      sourceProfilePath: SOURCE_PROFILE,
    });
    if (build.status !== 0) throw new Error('xcodebuild did not complete successfully.');
    const artifactPath =
      mode === 'archive'
        ? resolve(archivePath)
        : join(
            resolve(derivedDataPath),
            'Build',
            'Products',
            'Release-iphonesimulator',
            'SoftbookCET.app',
          );
    const inspection = inspectMobileReleaseRuntimeArtifact({
      artifactPath,
      expectedProfilePath: resolve(runtimeProfilePath),
      format: mode === 'archive' ? 'xcarchive' : 'app',
    });
    result = {
      schema_version: 'ios-release-build-report.v1',
      mode,
      artifact_path: artifactPath,
      repository_commit: repositoryCommit,
      mobile_runtime_profile: inspection,
      signing_observation:
        mode === 'simulator'
          ? 'unsigned_simulator'
          : 'xcode_archive_signing_must_be_inspected_separately',
    };
  } finally {
    writeFileSync(SOURCE_PROFILE, fixtureBytes, {flag: 'w', mode: 0o644});
    chmodSync(SOURCE_PROFILE, 0o644);
    if (lockDescriptor !== undefined) closeSync(lockDescriptor);
    unlinkSync(lockPath);
  }
  if (!readFileSync(SOURCE_PROFILE).equals(fixtureBytes)) {
    throw new Error('iOS repository fixture restoration failed.');
  }
  return result;
}

function runXcodeBuild({archivePath, derivedDataPath, mode, sourceProfilePath}) {
  const args = [
    '-workspace',
    'ios/SoftbookCET.xcworkspace',
    '-scheme',
    'SoftbookCET',
    '-configuration',
    'Release',
    '-derivedDataPath',
    derivedDataPath,
  ];
  if (mode === 'simulator') {
    args.push(
      '-sdk',
      'iphonesimulator',
      '-destination',
      'generic/platform=iOS Simulator',
      'CODE_SIGNING_ALLOWED=NO',
      'CODE_SIGNING_REQUIRED=NO',
      `SOFTBOOK_MOBILE_RELEASE_RUNTIME_PROFILE=${sourceProfilePath}`,
      'build',
    );
  } else {
    args.push(
      '-destination',
      'generic/platform=iOS',
      '-archivePath',
      resolve(archivePath),
      `SOFTBOOK_MOBILE_RELEASE_RUNTIME_PROFILE=${sourceProfilePath}`,
      'archive',
    );
  }
  return spawnSync('xcodebuild', args, {
    cwd: MOBILE_ROOT,
    env: process.env,
    stdio: 'inherit',
  });
}

function readBoundedRegularBytes(path, label) {
  const stat = lstatSync(path, {throwIfNoEntry: false});
  if (!stat?.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 64 * 1024) {
    throw new Error(`${label} must be a bounded regular file.`);
  }
  return readFileSync(path);
}

function readRepositoryCommit() {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode] = process.argv.slice(2);
    if (!mode || ['--help', '-h'].includes(mode)) {
      process.stdout.write(
        'Usage: node scripts/build_ios_release.mjs <simulator|archive> --runtime-profile <file> --derived-data <dir> [--archive-path <path>]\n',
      );
    } else {
      const report = buildIosRelease({
        archivePath: option('--archive-path'),
        derivedDataPath: option('--derived-data'),
        mode,
        runtimeProfilePath: option('--runtime-profile'),
      });
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    }
  } catch (error) {
    process.stderr.write(`[ios-release-build] ${error.message}\n`);
    process.exitCode = 1;
  }
}
