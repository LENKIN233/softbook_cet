#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';

import {resolveRemoteArchiveRequest} from './validate_agent_run_evidence.mjs';

const RELEASE_URL =
  'https://github.com/LENKIN233/softbook_cet/releases/download/history-cutover-2026-07-10/archive.tar.gz';
const TOKEN = 'github_test-token';

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
