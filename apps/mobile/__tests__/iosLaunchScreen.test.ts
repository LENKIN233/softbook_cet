import {readFileSync} from 'node:fs';
import path from 'node:path';

const source = readFileSync(
  path.resolve(__dirname, '../ios/SoftbookCET/LaunchScreen.storyboard'),
  'utf8',
);

test('iOS launch screen shows only product identity and no implementation branding', () => {
  expect(source).toContain('text="软书四六级"');
  expect(source).not.toMatch(/React Native|Powered by|Expo|harness|model/i);
});
