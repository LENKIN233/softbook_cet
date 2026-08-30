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
  const playbackIndex = method.indexOf('[player play]');

  expect(activationIndex).toBeGreaterThan(0);
  expect(playbackIndex).toBeGreaterThan(activationIndex);
  expect(method).toContain('[self.playbackToken isEqualToString:playbackToken]');
  expect(method).toContain('generation != self.playbackGeneration');
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
])('%s delegates pending and prepared authority to the same main-queue cancellation', (_label, start, end) => {
  const method = sourceBetween(start, end);

  expect(method).toContain('RCTExecuteOnMainQueue');
  expect(method).toContain(
    '[self cancelCurrentPlaybackForSystemInterruption]',
  );
  expect(method).not.toContain('self.player != nil');
  expect(method).not.toContain('isPlaying');
  expect(method).not.toContain('[self.player play]');
});

test('prepare binds a pending token and generation before audio-session activation', () => {
  const method = sourceBetween(
    'RCT_EXPORT_METHOD(prepare:',
    'RCT_EXPORT_METHOD(play:',
  );
  const bindIndex = method.indexOf(
    '[self beginPendingPreparationWithPlaybackToken:playbackToken]',
  );
  const activationIndex = method.indexOf('setActive:YES');
  const installIndex = method.indexOf('[self installPreparedPlayer:player');

  expect(bindIndex).toBeGreaterThan(0);
  expect(activationIndex).toBeGreaterThan(bindIndex);
  expect(installIndex).toBeGreaterThan(activationIndex);
  expect(method).toContain(
    '[self isPendingPlaybackToken:playbackToken generation:generation]',
  );
  expect(method).toContain('audio_prepare_interrupted');
});

test('system interruption cancels pending, ready, or playing authority without an isPlaying gate', () => {
  const handler = sourceBetween(
    '- (void)handleAudioSessionInterruption:',
    '- (void)handleApplicationBackground:',
  );
  const cancellation = sourceBetween(
    '- (void)cancelCurrentPlaybackForSystemInterruption\n{',
    '- (void)stopPlayer',
  );

  expect(handler).toContain(
    '[self cancelCurrentPlaybackForSystemInterruption]',
  );
  expect(handler).not.toContain('self.player != nil');
  expect(handler).not.toContain('isPlaying');
  expect(cancellation).toContain('self.pendingPlaybackToken.length > 0');
  expect(cancellation).toContain('self.pendingPlaybackGeneration != 0');
  expect(cancellation).toContain(
    'self.interruptedPlaybackGeneration == interruptedGeneration',
  );
  expect(cancellation).toContain('self.playbackGeneration += 1');
  expect(cancellation).toContain('[interruptedPlayer stop]');
  expect(cancellation).toContain('playbackToken:interruptedToken');
  expect(cancellation).toContain('requiresPrepare:YES');
});

test('old prepare and play calls cannot install or start a replacement token generation', () => {
  const pendingCheck = sourceBetween(
    '- (BOOL)isPendingPlaybackToken:(NSString *)playbackToken\n                    generation:(NSUInteger)generation\n{',
    '- (BOOL)installPreparedPlayer:(AVAudioPlayer *)player\n                playbackToken:(NSString *)playbackToken\n                   generation:(NSUInteger)generation\n{',
  );
  const install = sourceBetween(
    '- (BOOL)installPreparedPlayer:(AVAudioPlayer *)player\n                playbackToken:(NSString *)playbackToken\n                   generation:(NSUInteger)generation\n{',
    '- (void)clearPendingPreparationForGeneration:',
  );
  const play = sourceBetween('RCT_EXPORT_METHOD(play:', 'RCT_EXPORT_METHOD(pause:');

  expect(pendingCheck).toContain('self.playbackGeneration == generation');
  expect(pendingCheck).toContain('self.pendingPlaybackGeneration == generation');
  expect(pendingCheck).toContain(
    '[self.pendingPlaybackToken isEqualToString:playbackToken]',
  );
  expect(install).toContain(
    '[self isPendingPlaybackToken:playbackToken generation:generation]',
  );
  expect(play).toContain('[self.playbackToken isEqualToString:playbackToken]');
  expect(play).toContain('generation != self.playbackGeneration');
});
