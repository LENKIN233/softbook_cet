import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';

import {buildWebReleaseRuntimeConfig} from './build_web_release_runtime_config.mjs';
import {
  canonicalJsonBytes,
  createMobileReleaseRuntimeProfile,
} from './lib/mobile_release_runtime_profile.mjs';

const root = resolve(import.meta.dirname, '..');

test('Web runtime config derives only the public receiver binding', () => {
  const directory = mkdtempSync(join(tmpdir(), 'softbook-web-runtime-test-'));
  const profilePath = join(directory, 'profile.json');
  const outputPath = join(directory, 'runtime-config.js');
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
  writeFileSync(
    profilePath,
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
  const report = buildWebReleaseRuntimeConfig({
    outputPath,
    profilePath,
    repositoryCommit: commitSha,
  });
  const output = readFileSync(outputPath, 'utf8');

  assert.equal(report.contains_secrets, false);
  assert.match(output, /window\.__SOFTBOOK_WEB_RUNTIME__/);
  assert.match(output, /clientKind: 'web'/);
  assert.match(output, /mode: 'remote'/);
  assert.match(output, /softbook-cet-beta-2026-08/);
  assert.doesNotMatch(output, /private_key|token|secret|Bearer|apiKey/i);
  rmSync(directory, {force: true, recursive: true});
});

test('Web release build fails closed before bundling without a runtime profile', () => {
  const result = spawnSync(process.execPath, ['scripts/build_web_release.mjs'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      SOFTBOOK_WEB_ALLOW_REPOSITORY_FIXTURE: '',
      SOFTBOOK_WEB_RELEASE_RUNTIME_PROFILE: '',
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /runtime-profile is required/i);
});
