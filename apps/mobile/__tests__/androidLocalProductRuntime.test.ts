import fs from 'node:fs';
import path from 'node:path';

const mobileRoot = path.resolve(__dirname, '..');

test('Android debug injects only the public local-product receiver profile', () => {
  const gradle = fs.readFileSync(
    path.join(mobileRoot, 'android/app/build.gradle'),
    'utf8',
  );
  const activity = fs.readFileSync(
    path.join(
      mobileRoot,
      'android/app/src/main/java/com/softbook/cet/MainActivity.kt',
    ),
    'utf8',
  );

  for (const field of [
    'SOFTBOOK_LOCAL_PRODUCT_BASE_URL',
    'SOFTBOOK_LOCAL_PRODUCT_TRACK',
    'SOFTBOOK_LOCAL_PRODUCT_PUBLIC_KEYS',
  ]) {
    expect(gradle).toContain(field);
    expect(activity).toContain(field);
  }
  expect(activity).toContain('softbookRemoteRuntimeProfile');
  expect(activity).toContain('contentManifestPublicKeys');
  const localProductProjection = gradle
    .split('\n')
    .filter(line => line.includes('LOCAL_PRODUCT'))
    .join('\n');
  expect(localProductProjection).not.toMatch(
    /SOFTBOOK_(?:AUTH_TOKEN|SMS_DEV_CODE|ANDROID_RELEASE_STORE_PASSWORD)/,
  );
});
