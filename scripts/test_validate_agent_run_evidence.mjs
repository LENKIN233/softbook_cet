#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REMOTE_ARCHIVE_MAX_SECONDS,
  resolveRemoteArchiveRequest,
} from './validate_agent_run_evidence.mjs';

const RELEASE_URL =
  'https://github.com/LENKIN233/softbook_cet/releases/download/history-cutover-2026-07-10/archive.tar.gz';
const TOKEN = 'github_test-token';
const SHA256 = 'a'.repeat(64);

test('fallback archive transfer stays below the parent gate timeout', () => {
  assert.equal(REMOTE_ARCHIVE_MAX_SECONDS, 150);
  assert.ok(REMOTE_ARCHIVE_MAX_SECONDS < 180);
});

test('an arbitrary HTTPS archive never receives the GitHub token', async () => {
  let fetched = false;
  const request = await resolveRemoteArchiveRequest(
    {url: 'https://evidence.example/archive.tar.gz'},
    {
      token: TOKEN,
      fetchImpl: async () => {
        fetched = true;
        throw new Error('unexpected fetch');
      },
    },
  );

  assert.equal(fetched, false);
  assert.deepEqual(request, {
    url: 'https://evidence.example/archive.tar.gz',
    headers: {},
  });
});

test('a GitHub release resolves to an authenticated GitHub asset API request', async () => {
  let metadataRequest = null;
  const request = await resolveRemoteArchiveRequest(
    {url: RELEASE_URL},
    {
      token: TOKEN,
      fetchImpl: async (url, options) => {
        metadataRequest = {url, options};
        return {
          ok: true,
          async json() {
            return {
              assets: [
                {
                  name: 'archive.tar.gz',
                  url: 'https://api.github.com/repos/LENKIN233/softbook_cet/releases/assets/123',
                  state: 'uploaded',
                  digest: `sha256:${SHA256}`,
                  size: 1024,
                },
              ],
            };
          },
        };
      },
    },
  );

  assert.equal(
    metadataRequest.url,
    'https://api.github.com/repos/LENKIN233/softbook_cet/releases/tags/history-cutover-2026-07-10',
  );
  assert.equal(metadataRequest.options.headers.Authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(request, {
    url: 'https://api.github.com/repos/LENKIN233/softbook_cet/releases/assets/123',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/octet-stream',
    },
    assetMetadata: {
      sha256: SHA256,
      sizeBytes: 1024,
      source: 'github_release_asset_digest',
    },
  });
});

test('a public GitHub release uses unauthenticated digest metadata', async () => {
  let metadataRequest = null;
  const request = await resolveRemoteArchiveRequest(
    {url: RELEASE_URL},
    {
      token: '',
      fetchImpl: async (url, options) => {
        metadataRequest = {url, options};
        return {
          ok: true,
          async json() {
            return {
              assets: [
                {
                  name: 'archive.tar.gz',
                  url: 'https://api.github.com/repos/LENKIN233/softbook_cet/releases/assets/123',
                  state: 'uploaded',
                  digest: `sha256:${SHA256}`,
                  size: 1024,
                },
              ],
            };
          },
        };
      },
    },
  );

  assert.equal(metadataRequest.options.headers.Authorization, undefined);
  assert.deepEqual(request, {
    url: 'https://api.github.com/repos/LENKIN233/softbook_cet/releases/assets/123',
    headers: {
      Accept: 'application/octet-stream',
    },
    assetMetadata: {
      sha256: SHA256,
      sizeBytes: 1024,
      source: 'github_release_asset_digest',
    },
  });
});

test('an untrusted asset URL from release metadata fails closed', async () => {
  await assert.rejects(
    resolveRemoteArchiveRequest(
      {url: RELEASE_URL},
      {
        token: TOKEN,
        fetchImpl: async () => ({
          ok: true,
          async json() {
            return {
              assets: [
                {
                  name: 'archive.tar.gz',
                  url: 'https://evidence.example/captured-token',
                  state: 'uploaded',
                },
              ],
            };
          },
        }),
      },
    ),
    /release asset API URL is untrusted/,
  );
});

test('a cross-repository GitHub asset URL fails closed', async () => {
  await assert.rejects(
    resolveRemoteArchiveRequest(
      {url: RELEASE_URL},
      {
        token: TOKEN,
        fetchImpl: async () => ({
          ok: true,
          async json() {
            return {
              assets: [
                {
                  name: 'archive.tar.gz',
                  url: 'https://api.github.com/repos/other/repository/releases/assets/123',
                  state: 'uploaded',
                },
              ],
            };
          },
        }),
      },
    ),
    /release asset API URL is untrusted/,
  );
});

test('malformed GitHub release digest fails closed', async () => {
  await assert.rejects(
    resolveRemoteArchiveRequest(
      {url: RELEASE_URL},
      {
        token: '',
        fetchImpl: async () => ({
          ok: true,
          async json() {
            return {
              assets: [
                {
                  name: 'archive.tar.gz',
                  url: 'https://api.github.com/repos/LENKIN233/softbook_cet/releases/assets/123',
                  state: 'uploaded',
                  digest: 'sha256:not-a-digest',
                  size: 1024,
                },
              ],
            };
          },
        }),
      },
    ),
    /release asset digest is not a valid SHA-256/,
  );
});

test('unsupported token characters fail before an authenticated request', async () => {
  let fetched = false;
  await assert.rejects(
    resolveRemoteArchiveRequest(
      {url: RELEASE_URL},
      {
        token: 'token\nInjected: value',
        fetchImpl: async () => {
          fetched = true;
          throw new Error('unexpected fetch');
        },
      },
    ),
    /GitHub token contains unsupported characters/,
  );
  assert.equal(fetched, false);
});
