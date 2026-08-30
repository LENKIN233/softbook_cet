import {readFileSync} from 'node:fs';
import path from 'node:path';

const privacyManifest = readFileSync(
  path.resolve(__dirname, '../ios/SoftbookCET/PrivacyInfo.xcprivacy'),
  'utf8',
);

test.each([
  'NSPrivacyCollectedDataTypePhoneNumber',
  'NSPrivacyCollectedDataTypeUserID',
  'NSPrivacyCollectedDataTypeDeviceID',
  'NSPrivacyCollectedDataTypeProductInteraction',
])('declares collected mobile data type %s', dataType => {
  expect(privacyManifest).toContain(`<string>${dataType}</string>`);
});

test('keeps collection non-tracking while linking account functionality data', () => {
  expect(privacyManifest).toContain(
    '<key>NSPrivacyTracking</key>\n\t<false/>',
  );
  expect(privacyManifest).not.toContain(
    '<key>NSPrivacyCollectedDataTypeTracking</key>\n\t\t\t<true/>',
  );
});
