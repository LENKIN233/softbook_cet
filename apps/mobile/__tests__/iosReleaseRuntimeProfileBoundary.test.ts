import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const project = readFileSync(
  path.resolve(__dirname, '../ios/SoftbookCET.xcodeproj/project.pbxproj'),
  'utf8',
);
const iosFixture = readFileSync(
  path.resolve(__dirname, '../ios/SoftbookCET/softbook-release-runtime-profile.json'),
);
const canonicalFixture = readFileSync(
  path.resolve(
    __dirname,
    '../e2e/fixtures/mobile-release-runtime-profile.repository-fixture.json',
  ),
);

test('iOS overwrites the tracked fixture after every resource-writing build phase', () => {
  const appTarget = project.match(
    /13B07F861A680F5B00A75B9A \/\* SoftbookCET \*\/ = \{[\s\S]*?buildPhases = \(([\s\S]*?)\);/,
  )?.[1];

  expect(appTarget).toBeDefined();
  expect(appTarget?.indexOf('[Softbook] Embed Release Runtime Profile')).toBeGreaterThan(
    appTarget?.indexOf('[CP] Copy Pods Resources') ?? Number.MAX_SAFE_INTEGER,
  );
});

test('iOS runtime-profile phase transforms the exact app resource in place', () => {
  const phase = project.match(
    /B7A0020136C44F12A7510B02 \/\* \[Softbook\] Embed Release Runtime Profile \*\/ = \{([\s\S]*?)\n\t\t\};/,
  )?.[1];

  expect(phase).toContain('alwaysOutOfDate = 1;');
  expect(phase).toContain(
    '$(TARGET_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/softbook-release-runtime-profile.json',
  );
  expect(phase).toContain('stage_mobile_release_runtime_profile.mjs');
  expect(phase).toContain('/usr/bin/cmp -s');
  expect(phase).toContain('guarded build_ios_release.mjs workflow');
  expect(project).toContain(
    'softbook-release-runtime-profile.json in Resources',
  );
  expect(iosFixture.equals(canonicalFixture)).toBe(true);
  expect(project).toContain(
    'EXCLUDED_SOURCE_FILE_NAMES = "softbook-release-runtime-profile.json";',
  );
});

test('guarded iOS release builder restores its tracked staging fixture', () => {
  expect(() =>
    execFileSync(
      process.execPath,
      ['--test', path.join(root, 'scripts/test_build_ios_release.mjs')],
      {cwd: root, stdio: 'pipe'},
    ),
  ).not.toThrow();
});
