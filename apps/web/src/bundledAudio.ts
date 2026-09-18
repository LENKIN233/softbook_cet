import type {LearningCard} from '../../mobile/src/learning/model';
import {bundledAudioSelection, requireBundledAudioAsset} from '../../mobile/src/audio/bundledAudio';
import {LearningAudioController, type LearningAudioEngineEvent} from '../../mobile/src/audio/learningAudioController';

const urls = import.meta.glob('../../mobile/assets/card-audio/**/*.mp3', {eager: true, query: '?url', import: 'default'}) as Record<string, string>;

export function createBundledAudioController() {
  let player: HTMLAudioElement | null = null;
  let token: string | null = null;
  let disposed = false;
  const listeners = new Set<(event: LearningAudioEngineEvent) => void>();
  const objectUrls = new Map<string, string>();
  const controller = new LearningAudioController({
    cache: {resolve: async () => { throw new Error('Remote audio cannot use the local library.'); }},
    resolveBundledAsset: async asset => {
      const descriptor = requireBundledAudioAsset(asset);
      let url = objectUrls.get(asset.sha256);
      if (!url) {
        const source = urls[`../../mobile/assets/card-audio/${descriptor.asset_path.slice(6)}`];
        if (!source) throw new Error('Bundled audio file is missing.');
        const response = await fetch(source);
        if (!response.ok) throw new Error('Bundled audio could not be loaded.');
        const bytes = await response.arrayBuffer();
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
        if (bytes.byteLength !== descriptor.size_bytes || `sha256:${digest}` !== descriptor.sha256 || disposed) {
          throw new Error('Bundled audio integrity check failed.');
        }
        url = URL.createObjectURL(new Blob([bytes], {type: 'audio/mpeg'}));
        objectUrls.set(asset.sha256, url);
      }
      return {path: url, uri: url};
    },
    engine: {
      prepare: async (path, playbackToken) => {
        player?.pause();
        player = new Audio(path);
        token = playbackToken;
        for (const [event, type] of [['ended', 'ended'], ['error', 'error']] as const) {
          player.addEventListener(event, () => {
            listeners.forEach(listener => listener({type, playbackToken}));
          });
        }
      },
      play: async playbackToken => { if (playbackToken === token && player) await player.play(); },
      pause: async playbackToken => { if (playbackToken === token) player?.pause(); },
      stop: async () => { player?.pause(); player = null; token = null; },
      subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    },
  });
  const pause = () => { if (document.hidden) void controller.pauseForInterruption(); };
  document.addEventListener('visibilitychange', pause);
  return {
    play: async (card: LearningCard, attempt: string) => {
      controller.select(bundledAudioSelection(card, attempt));
      await controller.press();
      return controller.getState();
    },
    stop: () => controller.select(null),
    subscribe: controller.subscribe.bind(controller),
    dispose: () => {
      disposed = true;
      document.removeEventListener('visibilitychange', pause);
      controller.dispose();
      for (const url of objectUrls.values()) URL.revokeObjectURL(url);
      objectUrls.clear();
    },
  };
}
