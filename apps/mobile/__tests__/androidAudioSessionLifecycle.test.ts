import {readFileSync} from 'node:fs';
import path from 'node:path';

const source = readFileSync(
  path.resolve(
    __dirname,
    '../android/app/src/main/java/com/softbook/cet/audio/SoftbookAudioPlayerModule.kt',
  ),
  'utf8',
);

function sourceBetween(start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Native Android audio source boundary is missing: ${start}`);
  }

  return source.slice(startIndex, endIndex);
}

test('play and pause require the exact prepared playback token', () => {
  const play = sourceBetween(
    'fun play(token: String, promise: Promise)',
    'fun pause(token: String, promise: Promise)',
  );
  const pause = sourceBetween(
    'fun pause(token: String, promise: Promise)',
    'fun stop(promise: Promise)',
  );

  expect(play).toContain('playbackToken != token');
  expect(play).toContain('hasRequestedPlayback = true');
  expect(pause).toContain('playbackToken != token');
});

test('host pause pauses every play-requested token including buffering or focus-waiting playback', () => {
  const hostPause = sourceBetween(
    'override fun onHostPause()',
    'override fun onHostDestroy()',
  );

  expect(hostPause).toContain('playbackToken != null');
  expect(hostPause).toContain('hasRequestedPlayback');
  expect(hostPause).toContain('player?.pause()');
  expect(hostPause).toContain('sendEvent("interruption")');
  expect(hostPause).not.toContain('isPlaying');
});

test('host pause cancels pending or ready-before-play authority', () => {
  const hostPause = sourceBetween(
    'override fun onHostPause()',
    'override fun onHostDestroy()',
  );

  expect(hostPause).toContain('preparePromise != null');
  expect(hostPause).toContain('playbackToken != null && !hasRequestedPlayback');
  expect(hostPause).toContain('cancelPendingOrReadyPlaybackForInterruption()');
});

test('pending or ready cancellation emits the exact stop-required token before rejecting prepare', () => {
  const cancellation = sourceBetween(
    'private fun cancelPendingOrReadyPlaybackForInterruption()',
    'companion object',
  );
  const emitIndex = cancellation.indexOf(
    'sendEvent("interruption", interruptedToken, true)',
  );
  const rejectIndex = cancellation.indexOf(
    'interruptedPreparePromise?.reject(',
  );

  expect(cancellation).toContain('val interruptedToken = playbackToken ?: return');
  expect(cancellation).toContain('preparePromise = null');
  expect(cancellation).toContain('player = null');
  expect(cancellation).toContain('playbackToken = null');
  expect(cancellation).toContain('hasRequestedPlayback = false');
  expect(cancellation).toContain('interruptedPlayer?.release()');
  expect(emitIndex).toBeGreaterThan(0);
  expect(rejectIndex).toBeGreaterThan(emitIndex);
});
