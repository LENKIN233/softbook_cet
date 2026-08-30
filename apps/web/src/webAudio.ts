import {
  resolveCardAudioDownload,
  type VerifiedContentManifest,
} from '../../mobile/src/audio/contentManifestRepository';
import type {LearningCard} from '../../mobile/src/learning/model';
import {
  DEFAULT_REMOTE_REQUEST_TIMEOUT_MS,
  runBoundedRemoteRequest,
} from '../../mobile/src/runtime/remoteRequest';

type AudioElement = {
  addEventListener: (
    type: 'ended' | 'error',
    listener: () => void,
    options?: {once?: boolean},
  ) => void;
  pause: () => void;
  play: () => Promise<void>;
};

export type VerifiedWebAudioPlayback = {
  pause: () => void;
  play: () => Promise<void>;
  stop: () => void;
};

type WebAudioDependencies = {
  createAudio?: (source: string) => AudioElement;
  createObjectUrl?: (blob: Blob) => string;
  digest?: (bytes: ArrayBuffer) => Promise<ArrayBuffer>;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  onPlaybackTerminated?: (reason: 'ended' | 'error' | 'stopped') => void;
  revokeObjectUrl?: (source: string) => void;
  timeoutMs?: number;
};

export async function prepareVerifiedCardAudio(options: {
  card: LearningCard;
  contentManifest: VerifiedContentManifest;
  dependencies?: WebAudioDependencies;
}): Promise<VerifiedWebAudioPlayback> {
  const selection = resolveCardAudioDownload(
    options.contentManifest,
    options.card,
  );
  if (selection === null) {
    throw new Error('这张卡没有可播放的音频。');
  }

  const dependencies = options.dependencies ?? {};
  const now = dependencies.now?.() ?? new Date();
  if (Date.parse(selection.download.expires_at) <= now.getTime()) {
    throw new Error('音频授权已过期，请重新读取当前学习卡。');
  }

  assertCredentialFreeHttpsUrl(selection.download.url);
  const {bytes, digest} = await runBoundedRemoteRequest({
    timeoutMs: dependencies.timeoutMs ?? DEFAULT_REMOTE_REQUEST_TIMEOUT_MS,
    operation: async signal => {
      const response = await (dependencies.fetchImpl ?? fetch)(
        selection.download.url,
        {
          credentials: 'omit',
          headers: {Accept: 'audio/mpeg'},
          method: 'GET',
          redirect: 'follow',
          signal,
        },
      );
      if (!response.ok) {
        throw new Error('音频暂时无法下载，请稍后再试。');
      }
      assertCredentialFreeHttpsUrl(response.url || selection.download.url);

      const verifiedBytes = await readAudioBytesWithExactLimit(
        response,
        selection.asset.size_bytes,
        signal,
      );
      const verifiedDigest = await (
        dependencies.digest ??
        (value => globalThis.crypto.subtle.digest('SHA-256', value))
      )(verifiedBytes);
      return {bytes: verifiedBytes, digest: verifiedDigest};
    },
  });
  const actualSha256 = `sha256:${bytesToHex(new Uint8Array(digest))}`;
  if (actualSha256 !== selection.asset.sha256) {
    throw new Error('音频文件校验失败。');
  }

  const createObjectUrl =
    dependencies.createObjectUrl ?? (blob => URL.createObjectURL(blob));
  const revokeObjectUrl =
    dependencies.revokeObjectUrl ?? (source => URL.revokeObjectURL(source));
  const source = createObjectUrl(
    new Blob([bytes], {type: selection.asset.media_type}),
  );
  const audio = (dependencies.createAudio ?? (value => new Audio(value)))(
    source,
  );
  let revoked = false;
  let terminated = false;
  const revoke = () => {
    if (!revoked) {
      revoked = true;
      revokeObjectUrl(source);
    }
  };
  const terminate = (reason: 'ended' | 'error' | 'stopped') => {
    if (terminated) {
      return;
    }
    terminated = true;
    revoke();
    try {
      dependencies.onPlaybackTerminated?.(reason);
    } catch {
      // A presentation callback cannot replace verified playback cleanup.
    }
  };
  audio.addEventListener('ended', () => terminate('ended'), {once: true});
  audio.addEventListener('error', () => terminate('error'), {once: true});

  return {
    pause() {
      try {
        audio.pause();
      } catch {
        // A pause adapter failure must not expose native browser details.
      }
    },
    play() {
      if (terminated) {
        throw new Error('音频已结束，请重新准备后播放。');
      }
      return audio.play();
    },
    stop() {
      try {
        audio.pause();
      } catch {
        // Playback cleanup must not block logout or the next selected card.
      } finally {
        terminate('stopped');
      }
    },
  };
}

async function readAudioBytesWithExactLimit(
  response: Response,
  expectedSize: number,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (
      Number.isFinite(parsedLength) &&
      parsedLength > expectedSize
    ) {
      void response.body?.cancel();
      throw new Error('音频文件大小与已签名清单不一致。');
    }
  }

  const reader = response.body?.getReader();
  if (reader === undefined) {
    throw new Error('音频暂时无法完整下载，请稍后再试。');
  }

  const bytes = new Uint8Array(expectedSize);
  let receivedSize = 0;
  const cancelReader = () => {
    void reader.cancel();
  };
  signal.addEventListener('abort', cancelReader, {once: true});
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) {
        break;
      }
      const nextSize = receivedSize + value.byteLength;
      if (nextSize > expectedSize) {
        await reader.cancel();
        throw new Error('音频文件大小与已签名清单不一致。');
      }
      bytes.set(value, receivedSize);
      receivedSize = nextSize;
    }
  } finally {
    signal.removeEventListener('abort', cancelReader);
    reader.releaseLock();
  }

  if (receivedSize !== expectedSize) {
    throw new Error('音频文件大小与已签名清单不一致。');
  }

  return bytes.buffer;
}

function assertCredentialFreeHttpsUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('音频下载地址无效。');
  }
  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    throw new Error('音频下载地址必须是无凭证 HTTPS 地址。');
  }
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
}
