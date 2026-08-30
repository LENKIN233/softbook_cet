import {
  NativeEventEmitter,
  NativeModules,
  type EmitterSubscription,
} from 'react-native';

import type {
  LearningAudioEngine,
  LearningAudioEngineEvent,
} from './learningAudioController';

type NativeLearningAudioPlayerModule = {
  addListener: (eventName: string) => void;
  pause: (playbackToken: string) => Promise<void>;
  play: (playbackToken: string) => Promise<void>;
  prepare: (filePath: string, playbackToken: string) => Promise<void>;
  removeListeners: (count: number) => void;
  stop: () => Promise<void>;
};

const MODULE_NAME = 'SoftbookAudioPlayer';
const EVENT_NAME = 'SoftbookAudioPlayerEvent';

function requireNativeModule() {
  const nativeModule = NativeModules[
    MODULE_NAME
  ] as NativeLearningAudioPlayerModule | null;

  if (!nativeModule) {
    throw new Error('Learning audio playback is unavailable.');
  }

  return nativeModule;
}

export const nativeLearningAudioEngine: LearningAudioEngine = {
  pause: async playbackToken => requireNativeModule().pause(playbackToken),
  play: async playbackToken => requireNativeModule().play(playbackToken),
  prepare: async (filePath, playbackToken) =>
    requireNativeModule().prepare(filePath, playbackToken),
  stop: async () => requireNativeModule().stop(),
  subscribe: listener => {
    const nativeModule = NativeModules[
      MODULE_NAME
    ] as NativeLearningAudioPlayerModule | null;

    if (!nativeModule) {
      return () => undefined;
    }

    const emitter = new NativeEventEmitter(nativeModule);
    const subscription: EmitterSubscription = emitter.addListener(
      EVENT_NAME,
      (payload: unknown) => {
        const event = parseNativeLearningAudioEvent(payload);
        if (event) {
          listener(event);
        }
      },
    );

    return () => subscription.remove();
  },
};

export function parseNativeLearningAudioEvent(
  payload: unknown,
): LearningAudioEngineEvent | null {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return null;
  }

  const type = (payload as { type?: unknown }).type;
  const playbackToken = (payload as { playbackToken?: unknown }).playbackToken;
  const requiresPrepare = (payload as { requiresPrepare?: unknown })
    .requiresPrepare;

  if (
    (type !== 'ended' && type !== 'error' && type !== 'interruption') ||
    typeof playbackToken !== 'string' ||
    playbackToken.length === 0 ||
    (requiresPrepare !== undefined && requiresPrepare !== true) ||
    (requiresPrepare === true && type !== 'interruption')
  ) {
    return null;
  }

  return requiresPrepare === true
    ? { playbackToken, requiresPrepare, type }
    : { playbackToken, type };
}
