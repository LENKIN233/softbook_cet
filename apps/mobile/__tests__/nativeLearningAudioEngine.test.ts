import {parseNativeLearningAudioEvent} from '../src/audio/nativeLearningAudioEngine';

test('preserves the native playback token on bounded audio events', () => {
  expect(
    parseNativeLearningAudioEvent({
      playbackToken: 'card-001:audio-a',
      type: 'ended',
    }),
  ).toEqual({playbackToken: 'card-001:audio-a', type: 'ended'});
  expect(
    parseNativeLearningAudioEvent({
      playbackToken: 'controller-001-playback-002',
      requiresPrepare: true,
      type: 'interruption',
    }),
  ).toEqual({
    playbackToken: 'controller-001-playback-002',
    requiresPrepare: true,
    type: 'interruption',
  });
});

test.each([
  {playbackToken: '', type: 'ended'},
  {type: 'ended'},
  {playbackToken: 'card-001:audio-a', type: 'progress'},
  {playbackToken: 'card-001:audio-a', requiresPrepare: false, type: 'interruption'},
  {playbackToken: 'card-001:audio-a', requiresPrepare: true, type: 'ended'},
  null,
])('rejects malformed native audio event %#', payload => {
  expect(parseNativeLearningAudioEvent(payload)).toBeNull();
});
