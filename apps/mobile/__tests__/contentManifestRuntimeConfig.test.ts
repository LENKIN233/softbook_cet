import { generateKeyPairSync, sign } from 'node:crypto';

import { resolveContentManifestRuntimeConfig } from '../src/audio/contentManifestRuntimeConfig';
import { stableJsonStringify } from '../src/audio/contentManifestRepository';
import {
  createSoftbookRemoteRuntimeConfig,
  readRemoteRuntimeProfileFromEnv,
} from '../src/runtime/appRuntimeConfig';

test('local runtime does not invent a content manifest keyring', () => {
  expect(resolveContentManifestRuntimeConfig(undefined)).toEqual({
    mode: 'local',
  });
});

test('remote runtime requires remote auth and a non-empty pinned keyring', () => {
  expect(() =>
    resolveContentManifestRuntimeConfig({
      auth: { mode: 'local' },
      contentManifest: {
        mode: 'remote',
        remote: {
          baseUrl: 'https://api.softbook.example',
          publicKeys: { 'content-key-1': 'a'.repeat(64) },
        },
      },
    }),
  ).toThrow('requires auth.mode to also be remote');

  expect(() =>
    resolveContentManifestRuntimeConfig(
      createSoftbookRemoteRuntimeConfig({
        baseUrl: 'https://api.softbook.example',
      }),
    ),
  ).toThrow('At least one pinned content manifest public key is required');
});

test('remote runtime builds a verifier from the release-owned public key map', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const rawPublicKey = publicKey
    .export({ format: 'der', type: 'spki' })
    .subarray(-32)
    .toString('hex');
  const runtime = resolveContentManifestRuntimeConfig(
    createSoftbookRemoteRuntimeConfig({
      apiKey: 'runtime-key',
      baseUrl: 'https://api.softbook.example/',
      contentManifestPublicKeys: { 'content-key-1': rawPublicKey },
    }),
  );

  expect(runtime.mode).toBe('remote');
  if (runtime.mode !== 'remote') {
    throw new Error('Expected remote content manifest runtime.');
  }
  expect(runtime.remote).toMatchObject({
    apiKey: 'runtime-key',
    baseUrl: 'https://api.softbook.example',
    installedClientIdentityProvider: expect.any(Function),
  });
  const canonicalPayload = stableJsonStringify({ release_id: 'release-1' });
  const signature = sign(
    null,
    Buffer.from(canonicalPayload),
    privateKey,
  ).toString('hex');
  expect(
    await runtime.remote.verifySignature({
      canonicalPayload,
      keyId: 'content-key-1',
      signature,
    }),
  ).toBe(true);
});

test('environment keyring parsing is strict and preserves public keys only', () => {
  const profile = readRemoteRuntimeProfileFromEnv({
    SOFTBOOK_CET_CONTENT_MANIFEST_PUBLIC_KEYS: JSON.stringify({
      'content-key-1': 'a'.repeat(64),
    }),
    SOFTBOOK_CET_REMOTE_BASE_URL: 'https://api.softbook.example',
  });

  expect(profile?.contentManifestPublicKeys).toEqual({
    'content-key-1': 'a'.repeat(64),
  });
  expect(() =>
    readRemoteRuntimeProfileFromEnv({
      SOFTBOOK_CET_CONTENT_MANIFEST_PUBLIC_KEYS: '[]',
      SOFTBOOK_CET_REMOTE_BASE_URL: 'https://api.softbook.example',
    }),
  ).toThrow('must be a non-empty string map');
  expect(() =>
    readRemoteRuntimeProfileFromEnv({
      SOFTBOOK_CET_CONTENT_MANIFEST_PUBLIC_KEYS: '{bad-json',
      SOFTBOOK_CET_REMOTE_BASE_URL: 'https://api.softbook.example',
    }),
  ).toThrow('must be a JSON object');
});
