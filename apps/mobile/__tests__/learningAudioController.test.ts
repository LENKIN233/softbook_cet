import type { ContentAssetCache } from '../src/audio/contentAssetCache';
import { getAudioPresentation } from '../src/audio/LearningAudioPlayer';
import {
  LearningAudioController,
  type LearningAudioEngine,
  type LearningAudioEngineEvent,
  type LearningAudioPlaybackState,
  type LearningAudioSelection,
} from '../src/audio/learningAudioController';

const selection: LearningAudioSelection = {
  asset: {
    asset_id: 'cet4.audio.001',
    duration_ms: 2100,
    media_type: 'audio/mpeg',
    sha256: `sha256:${'a'.repeat(64)}`,
    size_bytes: 4096,
  },
  authorityToken: 'sel_cet4_audio_attempt_0001',
  cardToken: 'cet4-card-001:audio-a',
  download: {
    asset_id: 'cet4.audio.001',
    expires_at: '2030-01-01T00:00:00.000Z',
    url: 'https://private-content.example/audio.mp3?token=opaque',
  },
};

function createEngine() {
  let listener: ((event: LearningAudioEngineEvent) => void) | null = null;
  const engine: LearningAudioEngine = {
    pause: jest.fn().mockResolvedValue(undefined),
    play: jest.fn().mockResolvedValue(undefined),
    prepare: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(nextListener => {
      listener = nextListener;
      return () => {
        listener = null;
      };
    }),
  };

  return {
    emit: (event: LearningAudioEngineEvent) => listener?.(event),
    engine,
  };
}

function readPreparedPlaybackToken(
  engine: LearningAudioEngine,
  callIndex = 0,
) {
  const prepare = engine.prepare as jest.MockedFunction<
    LearningAudioEngine['prepare']
  >;
  const token = prepare.mock.calls[callIndex]?.[1];

  if (typeof token !== 'string') {
    throw new Error('Expected a prepared playback token.');
  }

  return token;
}

function createCache(
  resolve: ContentAssetCache['resolve'] = jest
    .fn()
    .mockResolvedValue({
      path: '/verified/audio.mp3',
      uri: 'file:///verified/audio.mp3',
    }),
): ContentAssetCache {
  return { resolve };
}

test('selection never starts audio until the user presses the control', () => {
  const { engine } = createEngine();
  const cache = createCache();
  const controller = new LearningAudioController({ cache, engine });

  controller.select(selection);

  expect(controller.getState()).toEqual({ status: 'idle' });
  expect(cache.resolve).not.toHaveBeenCalled();
  expect(engine.prepare).not.toHaveBeenCalled();
  expect(engine.play).not.toHaveBeenCalled();
});

test('all five playback states map to bounded user-facing copy', () => {
  expect(getAudioPresentation({ status: 'idle' }).label).toBe('播放听力');
  expect(getAudioPresentation({ status: 'loading' }).label).toBe(
    '正在准备听力…',
  );
  expect(getAudioPresentation({ status: 'playing' }).label).toBe('暂停');
  expect(getAudioPresentation({ status: 'paused' }).label).toBe('继续播放');
  expect(
    getAudioPresentation({ reason: 'temporary', status: 'error' }).label,
  ).toBe('暂时无法播放 · 重试');
  expect(
    getAudioPresentation({ reason: 'offline', status: 'error' }).label,
  ).toBe('连接网络后可播放 · 重试');
});

test('explicit press resolves verified bytes before native playback', async () => {
  const { engine } = createEngine();
  const cache = createCache();
  const controller = new LearningAudioController({ cache, engine });
  const states: LearningAudioPlaybackState[] = [];
  controller.subscribe(state => states.push(state));
  controller.select(selection);

  await controller.press();

  expect(cache.resolve).toHaveBeenCalledWith({
    asset: selection.asset,
    download: selection.download,
  });
  expect(engine.prepare).toHaveBeenCalledWith(
    '/verified/audio.mp3',
    expect.stringMatching(/^learning-audio-/),
  );
  expect(readPreparedPlaybackToken(engine)).not.toBe(selection.cardToken);
  expect(engine.play).toHaveBeenCalledTimes(1);
  expect(states).toContainEqual({ status: 'loading' });
  expect(controller.getState()).toEqual({ status: 'playing' });
});

test('playing toggles to paused and requires another explicit press to resume', async () => {
  const { engine } = createEngine();
  const controller = new LearningAudioController({
    cache: createCache(),
    engine,
  });
  controller.select(selection);
  await controller.press();
  const playbackToken = readPreparedPlaybackToken(engine);

  await controller.press();
  expect(engine.pause).toHaveBeenCalledTimes(1);
  expect(controller.getState()).toEqual({ status: 'paused' });

  await controller.press();
  expect(engine.play).toHaveBeenCalledTimes(2);
  expect(engine.prepare).toHaveBeenCalledTimes(1);
  expect(readPreparedPlaybackToken(engine)).toBe(playbackToken);
  expect(controller.getState()).toEqual({ status: 'playing' });
});

test('preparation retries once before exposing a bounded error', async () => {
  const resolve = jest
    .fn()
    .mockRejectedValueOnce(new Error('corrupt bytes'))
    .mockRejectedValueOnce(new Error('download failed'));
  const { engine } = createEngine();
  const controller = new LearningAudioController({
    cache: createCache(resolve),
    engine,
    isOnline: () => true,
  });
  controller.select(selection);

  await controller.press();

  expect(resolve).toHaveBeenCalledTimes(2);
  expect(controller.getState()).toEqual({
    reason: 'temporary',
    status: 'error',
  });
});

test('offline playback succeeds when the verified asset is already cached', async () => {
  const { engine } = createEngine();
  const controller = new LearningAudioController({
    cache: createCache(),
    engine,
    isOnline: () => false,
  });
  controller.select(selection);

  await controller.press();

  expect(engine.play).toHaveBeenCalledTimes(1);
  expect(controller.getState()).toEqual({ status: 'playing' });
});

test('uncached offline failure exposes only the offline domain state', async () => {
  const { engine } = createEngine();
  const controller = new LearningAudioController({
    cache: createCache(jest.fn().mockRejectedValue(new Error('ENETDOWN'))),
    engine,
    isOnline: async () => false,
  });
  controller.select(selection);

  await controller.press();

  expect(controller.getState()).toEqual({
    reason: 'offline',
    status: 'error',
  });
});

test('network inspection failure remains a bounded temporary error', async () => {
  const { engine } = createEngine();
  const controller = new LearningAudioController({
    cache: createCache(
      jest.fn().mockRejectedValue(new Error('download failed')),
    ),
    engine,
    isOnline: async () => {
      throw new Error('native network state unavailable');
    },
  });
  controller.select(selection);

  await expect(controller.press()).resolves.toBeUndefined();
  expect(controller.getState()).toEqual({
    reason: 'temporary',
    status: 'error',
  });
});

test('stale preparation from a previous card cannot start playback', async () => {
  let resolveFile!: (value: { path: string; uri: string }) => void;
  const cache = createCache(
    jest.fn().mockImplementation(
      () =>
        new Promise(resolve => {
          resolveFile = resolve;
        }),
    ),
  );
  const { engine } = createEngine();
  const controller = new LearningAudioController({ cache, engine });
  controller.select(selection);
  const pending = controller.press();

  controller.select({
    ...selection,
    cardToken: 'cet4-card-002:audio-b',
  });
  resolveFile({
    path: '/verified/audio.mp3',
    uri: 'file:///verified/audio.mp3',
  });
  await pending;

  expect(engine.prepare).not.toHaveBeenCalled();
  expect(engine.play).not.toHaveBeenCalled();
  expect(controller.getState()).toEqual({ status: 'idle' });
});

test('same-card new selection authority cancels the old preparation', async () => {
  let resolveFirst!: (value: { path: string; uri: string }) => void;
  const resolve = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise(nextResolve => {
          resolveFirst = nextResolve;
        }),
    )
    .mockResolvedValue({
      path: '/verified/audio.mp3',
      uri: 'file:///verified/audio.mp3',
    });
  const { engine } = createEngine();
  const controller = new LearningAudioController({
    cache: createCache(resolve),
    engine,
  });
  controller.select(selection);
  const stalePreparation = controller.press();

  controller.select({
    ...selection,
    authorityToken: 'sel_cet4_audio_attempt_0002',
  });
  const currentPreparation = controller.press();
  resolveFirst({
    path: '/verified/audio.mp3',
    uri: 'file:///verified/audio.mp3',
  });
  await Promise.all([stalePreparation, currentPreparation]);

  expect(engine.prepare).toHaveBeenCalledTimes(1);
  expect(engine.play).toHaveBeenCalledTimes(1);
  expect(controller.getState()).toEqual({ status: 'playing' });
});

test('card changes, backgrounding, interruption, completion, and errors stay bounded', async () => {
  const { emit, engine } = createEngine();
  const controller = new LearningAudioController({
    cache: createCache(),
    engine,
  });
  controller.select(selection);
  await controller.press();
  const firstPlaybackToken = readPreparedPlaybackToken(engine);

  await controller.pauseForInterruption();
  expect(controller.getState()).toEqual({ status: 'paused' });
  await controller.press();
  emit({ playbackToken: firstPlaybackToken, type: 'interruption' });
  expect(controller.getState()).toEqual({ status: 'paused' });

  await controller.press();
  emit({ playbackToken: firstPlaybackToken, type: 'ended' });
  expect(controller.getState()).toEqual({ status: 'idle' });

  await controller.press();
  const secondPlaybackToken = readPreparedPlaybackToken(engine, 1);
  expect(secondPlaybackToken).not.toBe(firstPlaybackToken);
  emit({ playbackToken: secondPlaybackToken, type: 'error' });
  expect(controller.getState()).toEqual({
    reason: 'temporary',
    status: 'error',
  });

  controller.select(null);
  expect(controller.getState()).toEqual({ status: 'idle' });
  expect(engine.stop).toHaveBeenCalled();
});

test('same-card new selection rejects stale ended, error, and interruption events', async () => {
  const { emit, engine } = createEngine();
  const controller = new LearningAudioController({
    cache: createCache(),
    engine,
  });
  controller.select(selection);
  await controller.press();
  const stalePlaybackToken = readPreparedPlaybackToken(engine);

  const nextSelection = {
    ...selection,
    authorityToken: 'sel_cet4_audio_attempt_0002',
  };
  controller.select(nextSelection);
  await controller.press();
  const currentPlaybackToken = readPreparedPlaybackToken(engine, 1);
  expect(currentPlaybackToken).not.toBe(stalePlaybackToken);
  expect(controller.getState()).toEqual({ status: 'playing' });

  emit({ playbackToken: stalePlaybackToken, type: 'ended' });
  emit({ playbackToken: stalePlaybackToken, type: 'error' });
  emit({ playbackToken: stalePlaybackToken, type: 'interruption' });
  expect(controller.getState()).toEqual({ status: 'playing' });

  emit({ playbackToken: currentPlaybackToken, type: 'ended' });
  expect(controller.getState()).toEqual({ status: 'idle' });
});

test('controller instances never reuse a playback nonce', async () => {
  const first = createEngine();
  const second = createEngine();
  const firstController = new LearningAudioController({
    cache: createCache(),
    engine: first.engine,
  });
  const secondController = new LearningAudioController({
    cache: createCache(),
    engine: second.engine,
  });

  firstController.select(selection);
  secondController.select(selection);
  await Promise.all([firstController.press(), secondController.press()]);

  expect(readPreparedPlaybackToken(first.engine)).not.toBe(
    readPreparedPlaybackToken(second.engine),
  );
});
