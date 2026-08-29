#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
import {lstatSync, readFileSync, readdirSync} from 'node:fs';
import {basename, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  canonicalJsonBytes,
  sha256,
  validateMobileReleaseRuntimeProfile,
} from './lib/mobile_release_runtime_profile.mjs';
import {parseStrictJson} from './lib/strict_json.mjs';

const RESOURCE = 'softbook-release-runtime-profile.json';

export function inspectMobileReleaseRuntimeArtifact({
  allowRepositoryFixture = false,
  artifactPath,
  expectedProfilePath,
  format,
}) {
  const expectedStat = lstatSync(expectedProfilePath, {throwIfNoEntry: false});
  if (
    !expectedStat?.isFile() ||
    expectedStat.isSymbolicLink() ||
    expectedStat.size < 1 ||
    expectedStat.size > 64 * 1024
  ) {
    throw new Error('Expected mobile release runtime profile must be a bounded regular file.');
  }
  const expectedBytes = readFileSync(expectedProfilePath);
  const expectedProfile = validateCanonicalProfile(expectedBytes, {
    allowRepositoryFixture,
  });
  const embeddedBytes = readEmbeddedProfile({artifactPath, format});
  if (!embeddedBytes.equals(expectedBytes)) {
    throw new Error('Embedded mobile release runtime profile bytes do not match.');
  }
  const embeddedProfile = validateCanonicalProfile(embeddedBytes, {
    allowRepositoryFixture,
  });
  return {
    schema_version: 'mobile-release-runtime-artifact-inspection.v1',
    ok: true,
    format,
    artifact: basename(artifactPath),
    profile_sha256: sha256(embeddedBytes),
    profile_id: embeddedProfile.profile_id,
    environment_id: embeddedProfile.environment_id,
    commit_sha: embeddedProfile.commit_sha,
    signing_key_id: embeddedProfile.signing_key_id,
    key_ids: embeddedProfile.content_manifest_public_keys.map(item => item.key_id),
    configuration_class: expectedProfile.configuration_class,
  };
}

function validateCanonicalProfile(bytes, {allowRepositoryFixture}) {
  const profile = validateMobileReleaseRuntimeProfile(
    parseStrictJson(bytes, 'mobile release runtime profile'),
    {allowRepositoryFixture},
  );
  if (!bytes.equals(canonicalJsonBytes(profile))) {
    throw new Error('Mobile release runtime profile bytes are not canonical.');
  }
  return profile;
}

function readEmbeddedProfile({artifactPath, format}) {
  if (format === 'apk' || format === 'ipa') {
    const stat = lstatSync(artifactPath, {throwIfNoEntry: false});
    if (!stat?.isFile() || stat.isSymbolicLink()) {
      throw new Error('Mobile release archive must be a regular file.');
    }
    const entries = execFileSync('unzip', ['-Z1', artifactPath], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    })
      .split(/\r?\n/)
      .filter(Boolean);
    const matches =
      format === 'apk'
        ? entries.filter(entry => entry === `assets/${RESOURCE}`)
        : entries.filter(entry => /^Payload\/[^/]+\.app\/softbook-release-runtime-profile\.json$/.test(entry));
    if (matches.length !== 1) {
      throw new Error('Mobile release archive must contain exactly one runtime profile.');
    }
    return execFileSync('unzip', ['-p', artifactPath, matches[0]], {
      encoding: null,
      maxBuffer: 128 * 1024,
    });
  }
  let appDirectory;
  if (format === 'app') {
    appDirectory = artifactPath;
  } else if (format === 'xcarchive') {
    const applications = join(artifactPath, 'Products', 'Applications');
    const apps = readdirSync(applications, {withFileTypes: true}).filter(
      entry => entry.isDirectory() && entry.name.endsWith('.app'),
    );
    if (apps.length !== 1) {
      throw new Error('xcarchive must contain exactly one application bundle.');
    }
    appDirectory = join(applications, apps[0].name);
  } else {
    throw new Error('Artifact format must be apk, ipa, app, or xcarchive.');
  }
  const resourcePath = join(appDirectory, RESOURCE);
  const stat = lstatSync(resourcePath, {throwIfNoEntry: false});
  if (!stat?.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) {
    throw new Error('Application bundle must contain one bounded regular runtime profile.');
  }
  return readFileSync(resourcePath);
}

function option(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const artifactPath = option(process.argv, '--artifact');
    const expectedProfilePath = option(process.argv, '--profile');
    const format = option(process.argv, '--format');
    if (!artifactPath || !expectedProfilePath || !format) {
      throw new Error(
        'Usage: inspect_mobile_release_runtime_artifact.mjs --artifact <path> --profile <path> --format <apk|ipa|app|xcarchive> [--allow-repository-fixture]',
      );
    }
    console.log(
      JSON.stringify(
        inspectMobileReleaseRuntimeArtifact({
          allowRepositoryFixture: process.argv.includes('--allow-repository-fixture'),
          artifactPath: resolve(artifactPath),
          expectedProfilePath: resolve(expectedProfilePath),
          format,
        }),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(`[mobile-release-runtime-inspector] ${error.message}`);
    process.exitCode = 1;
  }
}
