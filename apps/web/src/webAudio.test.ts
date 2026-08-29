import type {VerifiedContentManifest} from '../../mobile/src/audio/contentManifestRepository';
import type {LearningCard} from '../../mobile/src/learning/model';
import {prepareVerifiedCardAudio} from './webAudio';

const SHA256_ABC =
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

const card = {
  analysis: {exam_tip: 'tip', summary: 'summary', title: 'title'},
  audio: {
    asset_id: 'cet4.000001.prompt',
    duration_ms: 1000,
    sha256: `sha256:${SHA256_ABC}`,
  },
  back_text: 'answer',
  card_id: '000001',
  front: {context: 'context', eyebrow: 'eyebrow', prompt: 'prompt', support: 'support'},
  interaction_id: 'flip',
  knowledge_ref: 'knowledge',
  space_metadata: {
    box: 'box',
    box_ref: 'box-ref',
    group: 'group',
    library: 'library',
  },
  track: 'cet4',
} satisfies LearningCard;

const manifest: VerifiedContentManifest = {
  access: {accessible_card_count: 1, mode: 'full', total_card_count: 1},
  downloads: [
    {
      asset_id: card.audio.asset_id,
      expires_at: '2027-01-01T00:00:00.000Z',
      url: 'https://private.example.cn/audio.mp3?token=transport',
    },
  ],
  manifest: {
    assets: [
      {
        asset_id: card.audio.asset_id,
        duration_ms: card.audio.duration_ms,
        media_type: 'audio/mpeg',
        sha256: card.audio.sha256,
        size_bytes: 3,
      },
    ],
    content_version: `sha256:${'12'.repeat(32)}`,
    minimum_client_version: '0.1.0',
    parent_release_id: null,
    release_id: 'release-2026',
    schema_version: 'content-manifest.v1',
    track: 'cet4',
  },
  signature: {algorithm: 'ed25519', key_id: 'release-2026', value: 'ab'.repeat(64)},
};

describe('Web private audio boundary', () => {
  it('plays only a verified Blob after full byte length and SHA-256 checks', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.credentials).toBe('omit');
      return new Response(new TextEncoder().encode('abc'), {status: 200});
    });
    const sources: string[] = [];
    const played: string[] = [];

    const playback = await prepareVerifiedCardAudio({
      card,
      contentManifest: manifest,
      dependencies: {
        createAudio(source) {
          sources.push(source);
          return {
            addEventListener: vi.fn(),
            pause: vi.fn(),
            async play() {
              played.push(source);
            },
          };
        },
        createObjectUrl(blob) {
          expect(blob.size).toBe(3);
          return 'blob:verified-audio';
        },
        digest: async () => hexBytes(SHA256_ABC).buffer,
        fetchImpl,
        now: () => new Date('2026-08-29T00:00:00.000Z'),
        revokeObjectUrl: vi.fn(),
      },
    });

    expect(played).toEqual([]);
    await playback.play();
    expect(fetchImpl).toHaveBeenCalledWith(
      manifest.downloads[0].url,
      expect.objectContaining({credentials: 'omit', redirect: 'follow'}),
    );
    expect(sources).toEqual(['blob:verified-audio']);
    expect(played).toEqual(['blob:verified-audio']);
    expect(sources).not.toContain(manifest.downloads[0].url);
  });

  it('rejects truncated bytes before creating a playable object URL', async () => {
    const createObjectUrl = vi.fn();

    await expect(
      prepareVerifiedCardAudio({
        card,
        contentManifest: manifest,
        dependencies: {
          createObjectUrl,
          fetchImpl: async () =>
            new Response(new TextEncoder().encode('ab'), {status: 200}),
          now: () => new Date('2026-08-29T00:00:00.000Z'),
        },
      }),
    ).rejects.toThrow('音频文件大小与已签名清单不一致。');
    expect(createObjectUrl).not.toHaveBeenCalled();
  });
});

function hexBytes(value: string) {
  return Uint8Array.from(value.match(/../g) ?? [], byte => parseInt(byte, 16));
}
