import type { ContentAssetCache } from './contentAssetCache';
import type {
  ContentAssetDownload,
  ContentManifestAsset,
} from './contentManifestRepository';

export type LearningAudioPlaybackState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'playing' }
  | { status: 'paused' }
  | { reason: 'offline' | 'temporary'; status: 'error' };

export type LearningAudioEngineEvent = {
  playbackToken: string;
  type: 'ended' | 'error' | 'interruption';
};

export type LearningAudioEngine = {
  pause: () => Promise<void>;
  play: () => Promise<void>;
  prepare: (filePath: string, playbackToken: string) => Promise<void>;
  stop: () => Promise<void>;
  subscribe: (
    listener: (event: LearningAudioEngineEvent) => void,
  ) => () => void;
};

export type LearningAudioSelection = {
  asset: ContentManifestAsset;
  cardToken: string;
  download: ContentAssetDownload;
};

type StateListener = (state: LearningAudioPlaybackState) => void;

export class LearningAudioController {
  private generation = 0;
  private selection: LearningAudioSelection | null = null;
  private state: LearningAudioPlaybackState = { status: 'idle' };
  private readonly listeners = new Set<StateListener>();
  private readonly unsubscribeEngine: () => void;

  constructor(
    private readonly dependencies: {
      cache: ContentAssetCache;
      engine: LearningAudioEngine;
      isOnline?: () => boolean | Promise<boolean>;
    },
  ) {
    this.unsubscribeEngine = dependencies.engine.subscribe(event => {
      if (
        this.selection === null ||
        event.playbackToken !== this.selection.cardToken
      ) {
        return;
      }

      if (event.type === 'ended') {
        this.setState({ status: 'idle' });
        return;
      }

      if (event.type === 'interruption') {
        if (this.state.status === 'playing') {
          this.setState({ status: 'paused' });
        }
        return;
      }

      if (this.state.status !== 'idle') {
        this.setState({ reason: 'temporary', status: 'error' });
      }
    });
  }

  getState() {
    return this.state;
  }

  subscribe(listener: StateListener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  select(selection: LearningAudioSelection | null) {
    const isSameSelection =
      selection !== null &&
      this.selection !== null &&
      selection.cardToken === this.selection.cardToken &&
      selection.asset.sha256 === this.selection.asset.sha256;

    if (isSameSelection) {
      this.selection = selection;
      return;
    }

    this.generation += 1;
    this.selection = selection;
    this.setState({ status: 'idle' });
    this.dependencies.engine.stop().catch(() => undefined);
  }

  async press() {
    if (this.state.status === 'loading' || this.selection === null) {
      return;
    }

    if (this.state.status === 'playing') {
      try {
        await this.dependencies.engine.pause();
        this.setState({ status: 'paused' });
      } catch {
        this.setState({ reason: 'temporary', status: 'error' });
      }
      return;
    }

    if (this.state.status === 'paused') {
      try {
        await this.dependencies.engine.play();
        this.setState({ status: 'playing' });
      } catch {
        this.setState({ reason: 'temporary', status: 'error' });
      }
      return;
    }

    await this.prepareAndPlay();
  }

  async pauseForInterruption() {
    if (this.state.status !== 'playing') {
      return;
    }

    try {
      await this.dependencies.engine.pause();
    } finally {
      this.setState({ status: 'paused' });
    }
  }

  dispose() {
    this.generation += 1;
    this.selection = null;
    this.unsubscribeEngine();
    this.listeners.clear();
    this.dependencies.engine.stop().catch(() => undefined);
  }

  private async prepareAndPlay() {
    const selection = this.selection;

    if (selection === null) {
      return;
    }

    const generation = ++this.generation;
    this.setState({ status: 'loading' });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const file = await this.dependencies.cache.resolve({
          asset: selection.asset,
          download: selection.download,
        });

        if (!this.isCurrent(generation, selection.cardToken)) {
          return;
        }

        await this.dependencies.engine.prepare(file.path, selection.cardToken);

        if (!this.isCurrent(generation, selection.cardToken)) {
          return;
        }

        await this.dependencies.engine.play();

        if (!this.isCurrent(generation, selection.cardToken)) {
          return;
        }

        this.setState({ status: 'playing' });
        return;
      } catch {
        if (!this.isCurrent(generation, selection.cardToken)) {
          return;
        }

        await this.dependencies.engine.stop().catch(() => undefined);
      }
    }

    const isOnline = await this.readOnlineState();
    if (this.isCurrent(generation, selection.cardToken)) {
      this.setState({
        reason: isOnline === false ? 'offline' : 'temporary',
        status: 'error',
      });
    }
  }

  private isCurrent(generation: number, cardToken: string) {
    return (
      generation === this.generation && this.selection?.cardToken === cardToken
    );
  }

  private async readOnlineState() {
    try {
      return await this.dependencies.isOnline?.();
    } catch {
      return undefined;
    }
  }

  private setState(state: LearningAudioPlaybackState) {
    this.state = state;
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
