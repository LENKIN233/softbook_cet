import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright-core';

// Real browser coverage: jsdom/Node accept stream proxies that Chrome converts
// to "[object ReadableStream]" when passed to Response.
const root = fileURLToPath(new URL('..', import.meta.url));
const repository = resolve(root, '../..');
const executablePath = [process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', chromium.executablePath()].find(path => path && existsSync(path));
if (!executablePath) throw new Error('Install Chromium with: npx playwright-core install chromium');
const server = await createServer({root, configFile: false, server: {
  host: '127.0.0.1', port: 0, fs: {allow: [repository]},
}});
server.middlewares.use('/__transport_test', (_request, response) => {
  response.setHeader('Content-Type', 'text/html');
  response.end('<!doctype html><title>Transport regression</title>');
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({executablePath, headless: true});
  const page = await browser.newPage();
  await page.goto(`${server.resolvedUrls.local[0]}__transport_test`);
  const result = await page.evaluate(async repositoryPath => {
    const {createAuthenticatedFetch} = await import(`/@fs/${repositoryPath}/apps/mobile/src/auth/authenticatedFetch.ts`);
    const {createAuthSessionCoordinator} = await import(`/@fs/${repositoryPath}/apps/mobile/src/auth/authSessionCoordinator.ts`);
    const session = {mode: 'remote', phoneNumber: '13800138000', accessToken: 'test-access',
      refreshToken: 'test-refresh', sessionId: 'test-session', tokenType: 'Bearer',
      accessTokenExpiresAt: '2099-01-01T00:00:00Z', refreshExpiresAt: '2099-02-01T00:00:00Z'};
    const coordinator = createAuthSessionCoordinator({
      authSessionStore: {load: async () => null, save: async () => {}, clear: async () => {}},
      authRepository: {refreshSession: async current => current, logout: async () => {}},
    });
    await coordinator.establish(session);
    const createResponse = () => createAuthenticatedFetch({authSessionCoordinator: coordinator,
      protectRawResponseBody: true, fetchImpl: async () => new Response('{"ok":true}',
        {headers: {'content-type': 'application/json'}}),
    })('https://test.invalid/bootstrap');
    const json = await (await createResponse()).json();
    const nativeResponse = await new Response((await createResponse()).body).json();
    const original = await createResponse();
    const clone = original.clone();
    const cloned = await Promise.all([original.json(), clone.json()]);
    let current = true;
    let cancel;
    const guarded = await createAuthenticatedFetch({authSessionCoordinator: coordinator,
      protectRawResponseBody: true, captureRequestAuthority: () => ({isCurrent: () => current,
        runBeforeDispatch: operation => operation(),
        subscribeCancellation: listener => {cancel = listener; return () => {};}}),
      fetchImpl: async () => new Response(new ReadableStream({start(controller) {
        controller.enqueue(new TextEncoder().encode('partial'));
      }})),
    })('https://test.invalid/stream');
    const reader = guarded.body.getReader();
    await reader.read();
    const waiting = reader.read();
    current = false;
    cancel();
    let cancellationReason;
    try {await waiting;} catch (error) {cancellationReason = error.reason;}
    return {json, nativeResponse, cloned, cancellationReason};
  }, repository);
  assert.deepEqual(result, {json: {ok: true}, nativeResponse: {ok: true},
    cloned: [{ok: true}, {ok: true}], cancellationReason: 'session_quarantined'});
  console.log(JSON.stringify({browser: browser.version(), ...result}));
} finally {
  await browser?.close();
  await server.close();
}
