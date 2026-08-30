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
  authorityToken: string;
  cardToken: string;
  download: ContentAssetDownload;
};

type StateListener = (state: LearningAudioPlaybackState) => void;

let learningAudioControllerSequence = 0;

function createControllerInstanceToken() {
  learningAudioControllerSequence += 1;
  return `learning-audio-${Date.now().toString(36)}-${learningAudioControllerSequence.toString(36)}`;
}

export class LearningAudioController {
  private readonly controllerInstanceToken = createControllerInstanceToken();
  private generation = 0;
  private playbackSequence = 0;
  private playbackRevision = 0;
  private activePlaybackToken: string | null = null;
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
        this.activePlaybackToken === null ||
        event.playbackToken !== this.activePlaybackToken
      ) {
        return;
      }

      if (event.type === 'interruption' && this.state.status === 'loading') {
        this.cancelPendingPlayback().catch(() => undefined);
        return;
      }

      this.playbackRevision += 1;

      if (event.type === 'ended') {
        this.activePlaybackToken = null;
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
        this.activePlaybackToken = null;
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
      selection.authorityToken === this.selection.authorityToken &&
      selection.cardToken === this.selection.cardToken &&
      selection.asset.sha256 === this.selection.asset.sha256;

    if (isSameSelection) {
      this.selection = selection;
      return;
    }

    this.generation += 1;
    this.playbackRevision += 1;
    this.activePlaybackToken = null;
    this.selection = selection;
    this.setState({ status: 'idle' });
    this.dependencies.engine.stop().catch(() => undefined);
  }

  async press() {
    if (this.state.status === 'loading' || this.selection === null) {
      return;
    }

    if (this.state.status === 'playing') {
      const authorityToken = this.selection.authorityToken;
      const generation = this.generation;
      const playbackToken = this.activePlaybackToken;
      const playbackRevision = this.playbackRevision;

      if (playbackToken === null) {
        this.setState({ reason: 'temporary', status: 'error' });
        return;
      }

      try {
        await this.dependencies.engine.pause();
        if (
          this.isCurrentPlayback(
            generation,
            authorityToken,
            playbackToken,
          ) && this.playbackRevision === playbackRevision
        ) {
          this.setState({ status: 'paused' });
        }
      } catch {
        if (
          this.isCurrentPlayback(
            generation,
            authorityToken,
            playbackToken,
          ) && this.playbackRevision === playbackRevision
        ) {
          this.setState({ reason: 'temporary', status: 'error' });
        }
      }
      return;
    }

    if (this.state.status === 'paused') {
      const authorityToken = this.selection.authorityToken;
      const generation = this.generation;
      const playbackToken = this.activePlaybackToken;
      const playbackRevision = this.playbackRevision;

      if (playbackToken === null) {
        this.setState({ reason: 'temporary', status: 'error' });
        return;
      }

      try {
        await this.dependencies.engine.play();
        if (
          this.isCurrentPlayback(
            generation,
            authorityToken,
            playbackToken,
          ) && this.playbackRevision === playbackRevision
        ) {
          this.setState({ status: 'playing' });
        }
      } catch {
        if (
          this.isCurrentPlayback(
            generation,
            authorityToken,
            playbackToken,
          ) && this.playbackRevision === playbackRevision
        ) {
          this.setState({ reason: 'temporary', status: 'error' });
        }
      }
      return;
    }

    await this.prepareAndPlay();
  }

  async pauseForInterruption() {
    if (this.state.status === 'loading') {
      await this.cancelPendingPlayback();
      return;
    }

    const selection = this.selection;
    const generation = this.generation;
    const playbackToken = this.activePlaybackToken;
    const playbackRevision = this.playbackRevision;

    if (
      this.state.status !== 'playing' ||
      selection === null ||
      playbackToken === null
    ) {
      return;
    }

    try {
      await this.dependencies.engine.pause();
    } finally {
      if (
        this.isCurrentPlayback(
          generation,
          selection.authorityToken,
          playbackToken,
        ) && this.playbackRevision === playbackRevision
      ) {
        this.setState({ status: 'paused' });
      }
    }
  }

  dispose() {
    this.generation += 1;
    this.playbackRevision += 1;
    this.activePlaybackToken = null;
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

        if (!this.isCurrentSelection(generation, selection.authorityToken)) {
          return;
        }

        const playbackToken = this.createPlaybackToken();
        this.playbackRevision += 1;
        this.activePlaybackToken = playbackToken;
        await this.dependencies.engine.prepare(file.path, playbackToken);

        if (
          !this.isCurrentPlayback(
            generation,
            selection.authorityToken,
            playbackToken,
          )
        ) {
          return;
        }

        const playbackRevision = this.playbackRevision;
        await this.dependencies.engine.play();

        if (
          !this.isCurrentPlayback(
            generation,
            selection.authorityToken,
            playbackToken,
          ) || this.playbackRevision !== playbackRevision
        ) {
          return;
        }

        this.setState({ status: 'playing' });
        return;
      } catch {
        if (!this.isCurrentSelection(generation, selection.authorityToken)) {
          return;
        }

        this.playbackRevision += 1;
        this.activePlaybackToken = null;
        await this.dependencies.engine.stop().catch(() => undefined);
      }
    }

    const isOnline = await this.readOnlineState();
    if (this.isCurrentSelection(generation, selection.authorityToken)) {
      this.setState({
        reason: isOnline === false ? 'offline' : 'temporary',
        status: 'error',
      });
    }
  }

  private createPlaybackToken() {
    this.playbackSequence += 1;
    return `${this.controllerInstanceToken}-${this.playbackSequence.toString(36)}`;
  }

  private async cancelPendingPlayback() {
    this.generation += 1;
    this.playbackRevision += 1;
    this.activePlaybackToken = null;
    this.setState({ status: 'idle' });

    try {
      await this.dependencies.engine.stop();
    } catch {
      // The cancelled generation remains invalid even if native cleanup fails.
    }
  }

  private isCurrentSelection(generation: number, authorityToken: string) {
    return (
      generation === this.generation &&
      this.selection?.authorityToken === authorityToken
    );
  }

  private isCurrentPlayback(
    generation: number,
    authorityToken: string,
    playbackToken: string,
  ) {
    return (
      this.isCurrentSelection(generation, authorityToken) &&
      this.activePlaybackToken === playbackToken
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
