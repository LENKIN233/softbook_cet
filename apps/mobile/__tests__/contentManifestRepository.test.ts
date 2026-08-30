import { localLearningCardRecords } from '../src/learning/localCardRecords';
import { generateKeyPairSync, sign } from 'node:crypto';
import { normalizeLearningCardRecord } from '../src/learning/sourceContract';
import {
  assertContentManifestMatchesCards,
  loadRemoteContentManifest,
  parseContentManifestPayload,
  resolveCardAudioDownload,
  stableJsonStringify,
} from '../src/audio/contentManifestRepository';
import { createPinnedContentManifestSignatureVerifier } from '../src/audio/contentManifestSignature';

const CONTENT_VERSION = `sha256:${'c'.repeat(64)}`;
const ASSET_SHA256 = `sha256:${'a'.repeat(64)}`;
const NOW = new Date('2026-07-28T12:00:00.000Z');

function createPayload() {
  return {
    data: {
      access: {
        accessible_card_count: 1,
        mode: 'full',
        total_card_count: 1,
      },
      downloads: [
        {
          asset_id: 'cet4.002001.prompt',
          expires_at: '2026-07-28T12:15:00.000Z',
          url: 'https://private-content.example/audio.mp3?token=opaque',
        },
      ],
      manifest: {
        schema_version: 'content-manifest.v1',
        release_id: 'cet4-2026-07-28',
        track: 'cet4',
        content_version: CONTENT_VERSION,
        minimum_client_version: '1.0.0',
        parent_release_id: null,
        assets: [
          {
            asset_id: 'cet4.002001.prompt',
            duration_ms: 2100,
            media_type: 'audio/mpeg',
            sha256: ASSET_SHA256,
            size_bytes: 4096,
          },
        ],
      },
      signature: {
        algorithm: 'ed25519',
        key_id: 'content-key-2026-01',
        value: 'd'.repeat(128),
      },
    },
  };
}

function createControlledPilotPayload() {
  const payload: any = createPayload();
  payload.data.manifest = {
    assets: payload.data.manifest.assets,
    content_version: CONTENT_VERSION,
    expires_at: '2026-08-01T12:00:00.000Z',
    gate_eligible: false,
    minimum_client_versions: { android: '1.0.0', ios: '1.0.0' },
    pilot_id: 'cet4-controlled-pilot-2026',
    release_class: 'controlled_pilot',
    release_id: 'cet4-controlled-pilot-release',
    schema_version: 'content-manifest.v1',
    track: 'cet4',
  };
  return payload;
}

function createAudioCard() {
  return normalizeLearningCardRecord({
    ...localLearningCardRecords[0],
    audio: {
      asset_id: 'cet4.002001.prompt',
      duration_ms: 2100,
      sha256: ASSET_SHA256,
      transcript: 'A short listening transcript.',
    },
  });
}

test('remote content manifest requires auth, exact scope, and signature verification', async () => {
  const callOrder: string[] = [];
  const verifySignature = jest.fn(() => {
    callOrder.push('signature');
    return true;
  });
  const installedClientIdentityProvider = jest.fn(() => {
    callOrder.push('identity');
    return { platform: 'ios' as const, version: '1.0.0' };
  });
  const fetchImpl = jest.fn().mockResolvedValue({
    json: async () => createPayload(),
    ok: true,
    status: 200,
  });
  const result = await loadRemoteContentManifest({
    apiKey: 'runtime-key',
    authToken: 'access-token',
    baseUrl: 'https://api.softbook.example/',
    contentVersion: CONTENT_VERSION,
    fetchImpl,
    installedClientIdentityProvider,
    now: () => NOW,
    track: 'cet4',
    verifySignature,
  });

  expect(fetchImpl).toHaveBeenCalledWith(
    `https://api.softbook.example/v2/content/manifest?track=cet4&content_version=${encodeURIComponent(
      CONTENT_VERSION,
    )}`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer access-token',
        'x-api-key': 'runtime-key',
        'x-softbook-client': 'mobile',
      },
      method: 'GET',
    },
  );
  expect(verifySignature).toHaveBeenCalledWith({
    canonicalPayload: stableJsonStringify({
      access: result.access,
      manifest: result.manifest,
    }),
    keyId: 'content-key-2026-01',
    signature: 'd'.repeat(128),
  });
  expect(result.manifest.assets).toHaveLength(1);
  expect(callOrder).toEqual(['signature', 'identity']);

  const rejectedIdentityProvider = jest.fn(() => ({
    platform: 'ios' as const,
    version: '1.0.0',
  }));
  await expect(
    loadRemoteContentManifest({
      authToken: '',
      baseUrl: 'https://api.softbook.example',
      contentVersion: CONTENT_VERSION,
      fetchImpl,
      installedClientIdentityProvider: rejectedIdentityProvider,
      track: 'cet4',
      verifySignature,
    }),
  ).rejects.toThrow('Remote content manifest requires authToken');

  await expect(
    loadRemoteContentManifest({
      authToken: 'access-token',
      baseUrl: 'https://api.softbook.example',
      contentVersion: CONTENT_VERSION,
      fetchImpl,
      installedClientIdentityProvider: rejectedIdentityProvider,
      now: () => NOW,
      track: 'cet4',
      verifySignature: () => false,
    }),
  ).rejects.toThrow('Content manifest signature verification failed');
  expect(rejectedIdentityProvider).not.toHaveBeenCalled();
});

test('verified content manifest withholds content below the signed client minimum', async () => {
  const payload = createPayload();
  payload.data.manifest.minimum_client_version = '2.0.0';
  const verifySignature = jest.fn(() => true);
  const installedClientIdentityProvider = jest.fn(() => ({
    platform: 'ios' as const,
    version: '1.9.9',
  }));

  await expect(
    loadRemoteContentManifest({
      authToken: 'access-token',
      baseUrl: 'https://api.softbook.example',
      contentVersion: CONTENT_VERSION,
      fetchImpl: jest.fn().mockResolvedValue({
        json: async () => payload,
        ok: true,
        status: 200,
      }),
      installedClientIdentityProvider,
      now: () => NOW,
      track: 'cet4',
      verifySignature,
    }),
  ).rejects.toThrow('below required minimum 2.0.0');
  expect(verifySignature).toHaveBeenCalledTimes(1);
  expect(installedClientIdentityProvider).toHaveBeenCalledTimes(1);
});

test('verified controlled-pilot manifest keeps gate false and selects the installed platform minimum', async () => {
  const payload = createControlledPilotPayload();
  payload.data.manifest.minimum_client_versions = {
    android: '9.0.0',
    ios: '1.0.0',
  };

  const result = await loadRemoteContentManifest({
    authToken: 'access-token',
    baseUrl: 'https://api.softbook.example',
    contentVersion: CONTENT_VERSION,
    fetchImpl: jest.fn().mockResolvedValue({
      json: async () => payload,
      ok: true,
      status: 200,
    }),
    installedClientIdentityProvider: () => ({
      platform: 'ios',
      version: '1.0.0',
    }),
    now: () => NOW,
    track: 'cet4',
    verifySignature: () => true,
  });

  expect(result.manifest).toMatchObject({
    gate_eligible: false,
    minimum_client_versions: { android: '9.0.0', ios: '1.0.0' },
    release_class: 'controlled_pilot',
  });
});

test('controlled-pilot manifest rejects an explicit web build identity', async () => {
  const fetchImpl = jest.fn().mockResolvedValue({
    json: async () => createControlledPilotPayload(),
    ok: true,
    status: 200,
  });

  await expect(
    loadRemoteContentManifest({
      authToken: 'access-token',
      baseUrl: 'https://api.softbook.example',
      clientKind: 'web',
      contentVersion: CONTENT_VERSION,
      fetchImpl,
      installedClientIdentityProvider: () => ({
        platform: 'web',
        version: '9.0.0',
      }),
      now: () => NOW,
      track: 'cet4',
      verifySignature: () => true,
    }),
  ).rejects.toThrow(
    'Controlled-pilot native minimum client versions do not authorize web builds.',
  );
  expect(fetchImpl).toHaveBeenCalledWith(expect.any(String), {
    headers: expect.objectContaining({'x-softbook-client': 'web'}),
    method: 'GET',
  });
});

test('content manifest parser fails closed on storage leakage, expiry, and asset drift', () => {
  const leakedStorage = createPayload();
  Object.assign(leakedStorage.data.manifest.assets[0], {
    storage_file_id: 'cloud://private/audio.mp3',
  });
  expect(() =>
    parseContentManifestPayload(leakedStorage, {
      contentVersion: CONTENT_VERSION,
      now: NOW,
      track: 'cet4',
    }),
  ).toThrow('unsupported or missing fields');

  const expired = createPayload();
  expired.data.downloads[0].expires_at = NOW.toISOString();
  expect(() =>
    parseContentManifestPayload(expired, {
      contentVersion: CONTENT_VERSION,
      now: NOW,
      track: 'cet4',
    }),
  ).toThrow('must be a future ISO timestamp');

  const missingDownload = createPayload();
  missingDownload.data.downloads = [];
  const parsedMissingDownload = parseContentManifestPayload(missingDownload, {
    contentVersion: CONTENT_VERSION,
    now: NOW,
    track: 'cet4',
  });
  expect(() =>
    assertContentManifestMatchesCards(parsedMissingDownload, [
      createAudioCard(),
    ]),
  ).toThrow('downloads do not match the server-authorized card prefix');

  const extraDownload = createPayload();
  extraDownload.data.downloads[0].asset_id = 'cet4.not-signed';
  expect(() =>
    parseContentManifestPayload(extraDownload, {
      contentVersion: CONTENT_VERSION,
      now: NOW,
      track: 'cet4',
    }),
  ).toThrow('download is not present in signed assets');

  const nonStrictMinimum = createPayload();
  nonStrictMinimum.data.manifest.minimum_client_version = '1.0.0-01';
  expect(() =>
    parseContentManifestPayload(nonStrictMinimum, {
      contentVersion: CONTENT_VERSION,
      now: NOW,
      track: 'cet4',
    }),
  ).toThrow('minimum_client_version is invalid');
});

test('parses the exact controlled-pilot manifest without erasing its signed gate boundary', () => {
  const payload = createControlledPilotPayload();
  const parsed = parseContentManifestPayload(payload, {
    contentVersion: CONTENT_VERSION,
    now: NOW,
    track: 'cet4',
  });

  expect(parsed.manifest).toMatchObject({
    expires_at: '2026-08-01T12:00:00.000Z',
    gate_eligible: false,
    minimum_client_versions: { android: '1.0.0', ios: '1.0.0' },
    pilot_id: 'cet4-controlled-pilot-2026',
    release_class: 'controlled_pilot',
  });
});

test.each([
  {
    label: 'gate eligibility drift',
    mutate: (payload: ReturnType<typeof createControlledPilotPayload>) => {
      payload.data.manifest.gate_eligible = true as never;
    },
  },
  {
    label: 'missing platform minimum version',
    mutate: (payload: ReturnType<typeof createControlledPilotPayload>) => {
      delete payload.data.manifest.minimum_client_versions.android;
    },
  },
  {
    label: 'minimum version whitespace',
    mutate: (payload: ReturnType<typeof createControlledPilotPayload>) => {
      payload.data.manifest.minimum_client_versions.android = ' 1.0.0';
    },
  },
  {
    label: 'release identifier whitespace',
    mutate: (payload: ReturnType<typeof createControlledPilotPayload>) => {
      payload.data.manifest.release_id = 'cet4-controlled-pilot-release ';
    },
  },
  {
    label: 'expired release',
    mutate: (payload: ReturnType<typeof createControlledPilotPayload>) => {
      payload.data.manifest.expires_at = NOW.toISOString();
    },
  },
  {
    label: 'formal and pilot field mixing',
    mutate: (payload: ReturnType<typeof createControlledPilotPayload>) => {
      (payload.data.manifest as any).parent_release_id = null;
    },
  },
  {
    label: 'expiry whitespace',
    mutate: (payload: ReturnType<typeof createControlledPilotPayload>) => {
      payload.data.manifest.expires_at = ' 2026-08-01T12:00:00.000Z';
    },
  },
  {
    label: 'download outlives release',
    mutate: (payload: ReturnType<typeof createControlledPilotPayload>) => {
      payload.data.downloads[0].expires_at = '2026-08-02T12:00:00.000Z';
    },
  },
])('rejects controlled-pilot $label', ({ mutate }) => {
  const payload = createControlledPilotPayload();
  mutate(payload);
  expect(() =>
    parseContentManifestPayload(payload, {
      contentVersion: CONTENT_VERSION,
      now: NOW,
      track: 'cet4',
    }),
  ).toThrow();
});

test('signed manifest resolves only audio that matches the loaded card catalog', () => {
  const result = parseContentManifestPayload(createPayload(), {
    contentVersion: CONTENT_VERSION,
    now: NOW,
    track: 'cet4',
  });
  const card = createAudioCard();

  expect(() => assertContentManifestMatchesCards(result, [card])).not.toThrow();
  expect(resolveCardAudioDownload(result, card)).toEqual({
    asset: result.manifest.assets[0],
    download: result.downloads[0],
  });

  const drifted = normalizeLearningCardRecord({
    ...localLearningCardRecords[0],
    audio: {
      ...card.audio!,
      duration_ms: 2200,
    },
  });
  expect(() => assertContentManifestMatchesCards(result, [drifted])).toThrow(
    'does not match its signed manifest asset',
  );

  expect(() =>
    assertContentManifestMatchesCards(result, [localLearningCardRecords[0]]),
  ).toThrow('is not referenced by the loaded cards');

  const overGrantedPayload = createPayload();
  overGrantedPayload.data.access = {
    accessible_card_count: 0,
    mode: 'trial_not_started',
    total_card_count: 1,
  };
  const overGranted = parseContentManifestPayload(overGrantedPayload, {
    contentVersion: CONTENT_VERSION,
    now: NOW,
    track: 'cet4',
  });
  expect(() => assertContentManifestMatchesCards(overGranted, [card])).toThrow(
    'downloads do not match the server-authorized card prefix',
  );
});

test('shared audio assets require one authorized download across multiple cards', () => {
  const payload = createPayload();
  payload.data.access = {
    accessible_card_count: 2,
    mode: 'full',
    total_card_count: 2,
  };
  const result = parseContentManifestPayload(payload, {
    contentVersion: CONTENT_VERSION,
    now: NOW,
    track: 'cet4',
  });
  const firstCard = createAudioCard();
  const secondCard = normalizeLearningCardRecord({
    ...localLearningCardRecords[1],
    audio: { ...firstCard.audio! },
  });

  expect(() =>
    assertContentManifestMatchesCards(result, [firstCard, secondCard]),
  ).not.toThrow();
});

test('authorized card prefixes bind manifest access to the full server catalog count', () => {
  const payload = createPayload();
  payload.data.access = {
    accessible_card_count: 1,
    mode: 'free_subset',
    total_card_count: 2,
  };
  const result = parseContentManifestPayload(payload, {
    contentVersion: CONTENT_VERSION,
    now: NOW,
    track: 'cet4',
  });
  const card = createAudioCard();

  expect(() =>
    assertContentManifestMatchesCards(result, [card], {
      cardsAreAccessiblePrefix: true,
      totalCardCount: 2,
    }),
  ).not.toThrow();
  expect(() => assertContentManifestMatchesCards(result, [card])).toThrow(
    'Content manifest access does not match the loaded catalog.',
  );
});

test('pinned verifier checks a real Node Ed25519 signature with strict semantics', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const rawPublicKey = publicKey
    .export({ format: 'der', type: 'spki' })
    .subarray(-32)
    .toString('hex');
  const payload = createPayload().data;
  const canonicalPayload = stableJsonStringify({
    access: payload.access,
    manifest: payload.manifest,
  });
  const signature = sign(
    null,
    Buffer.from(canonicalPayload),
    privateKey,
  ).toString('hex');
  const verifier = createPinnedContentManifestSignatureVerifier({
    'content-key-2026-01': rawPublicKey,
  });

  expect(
    await verifier({
      canonicalPayload,
      keyId: 'content-key-2026-01',
      signature,
    }),
  ).toBe(true);
  expect(
    await verifier({
      canonicalPayload: `${canonicalPayload} `,
      keyId: 'content-key-2026-01',
      signature,
    }),
  ).toBe(false);
  expect(
    await verifier({
      canonicalPayload,
      keyId: 'unknown-key',
      signature,
    }),
  ).toBe(false);
  expect(() =>
    createPinnedContentManifestSignatureVerifier({
      'content-key-2026-01': 'not-a-public-key',
    }),
  ).toThrow('must be 32-byte lowercase hex');
});
