import {readFileSync} from 'node:fs';
import path from 'node:path';

const source = readFileSync(
  path.resolve(__dirname, '../ios/SoftbookCET/SoftbookAudioPlayer.m'),
  'utf8',
);

function sourceBetween(start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Native audio source boundary is missing: ${start}`);
  }

  return source.slice(startIndex, endIndex);
}

test('manual native resume reactivates AVAudioSession before playback and rejects activation failure', () => {
  const method = sourceBetween(
    'RCT_EXPORT_METHOD(play:',
    'RCT_EXPORT_METHOD(pause:',
  );
  const activationIndex = method.indexOf('setActive:YES');
  const playbackIndex = method.indexOf('[self.player play]');

  expect(activationIndex).toBeGreaterThan(0);
  expect(playbackIndex).toBeGreaterThan(activationIndex);
  expect(method).toContain('reject(@"audio_session_failed"');
});

test.each([
  [
    'system interruption',
    '- (void)handleAudioSessionInterruption:',
    '- (void)handleApplicationBackground:',
  ],
  [
    'application background',
    '- (void)handleApplicationBackground:',
    '- (void)emitType:',
  ],
])('%s pauses and deactivates without automatic resume', (_label, start, end) => {
  const method = sourceBetween(start, end);

  expect(method).toContain('[self.player pause]');
  expect(method).toContain('[self deactivateAudioSession]');
  expect(method).not.toContain('[self.player play]');
});
