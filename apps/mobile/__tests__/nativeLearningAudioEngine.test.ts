import {parseNativeLearningAudioEvent} from '../src/audio/nativeLearningAudioEngine';

test('preserves the native playback token on bounded audio events', () => {
  expect(
    parseNativeLearningAudioEvent({
      playbackToken: 'card-001:audio-a',
      type: 'ended',
    }),
  ).toEqual({playbackToken: 'card-001:audio-a', type: 'ended'});
});

test.each([
  {playbackToken: '', type: 'ended'},
  {type: 'ended'},
  {playbackToken: 'card-001:audio-a', type: 'progress'},
  null,
])('rejects malformed native audio event %#', payload => {
  expect(parseNativeLearningAudioEvent(payload)).toBeNull();
});
