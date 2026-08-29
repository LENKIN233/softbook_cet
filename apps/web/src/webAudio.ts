import {
  resolveCardAudioDownload,
  type VerifiedContentManifest,
} from '../../mobile/src/audio/contentManifestRepository';
import type {LearningCard} from '../../mobile/src/learning/model';

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
  revokeObjectUrl?: (source: string) => void;
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
  const response = await (dependencies.fetchImpl ?? fetch)(
    selection.download.url,
    {
      credentials: 'omit',
      headers: {Accept: 'audio/mpeg'},
      method: 'GET',
      redirect: 'follow',
    },
  );
  if (!response.ok) {
    throw new Error('音频暂时无法下载，请稍后再试。');
  }
  assertCredentialFreeHttpsUrl(response.url || selection.download.url);

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== selection.asset.size_bytes) {
    throw new Error('音频文件大小与已签名清单不一致。');
  }

  const digest = await (
    dependencies.digest ??
    (value => globalThis.crypto.subtle.digest('SHA-256', value))
  )(bytes);
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
  const revoke = () => {
    if (!revoked) {
      revoked = true;
      revokeObjectUrl(source);
    }
  };
  audio.addEventListener('ended', revoke, {once: true});
  audio.addEventListener('error', revoke, {once: true});

  return {
    pause() {
      try {
        audio.pause();
      } catch {
        // A pause adapter failure must not expose native browser details.
      }
    },
    play: () => audio.play(),
    stop() {
      try {
        audio.pause();
      } catch {
        // Playback cleanup must not block logout or the next selected card.
      } finally {
        revoke();
      }
    },
  };
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
