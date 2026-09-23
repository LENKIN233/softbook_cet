// Local transport is opt-in; it never enables cleartext Internet media.
describe('local backend audio transport', () => {
  beforeEach(() => jest.resetModules());
  test('rejects all HTTP until configured, then accepts only same-origin local assets', () => {
    const {installLocalBackendTransport, isLocalBackendAssetUrl} = require('../src/runtime/localBackendTransport');
    const accepted = new URL('http://127.0.0.1:4173/local-assets/audio?signature=example');
    expect(isLocalBackendAssetUrl(accepted)).toBe(false);
    installLocalBackendTransport('http://127.0.0.1:4173/api');
    expect(isLocalBackendAssetUrl(accepted)).toBe(true);
    for (const url of ['http://127.0.0.1:4174/local-assets/a', 'http://127.0.0.1:4173/api/accounts', 'http://example.com/local-assets/a', 'http://u:p@127.0.0.1:4173/local-assets/a', 'http://127.0.0.1:4173/local-assets/a#hidden']) {
      expect(isLocalBackendAssetUrl(new URL(url))).toBe(false);
    }
  });
  test('rejects non-loopback and ambiguous backend configuration', () => {
    const {installLocalBackendTransport} = require('../src/runtime/localBackendTransport');
    for (const url of ['http://example.com:4173/api', 'http://192.168.1.1:4173/api', 'http://127.0.0.1/api', 'http://127.0.0.1:4173/api?token=secret', 'http://user@127.0.0.1:4173/api']) {
      expect(() => installLocalBackendTransport(url)).toThrow();
    }
  });
});
