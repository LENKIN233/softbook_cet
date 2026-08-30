import {resolveWebRuntime} from './runtime';

describe('Web runtime boundary', () => {
  afterEach(() => {
    delete window.__SOFTBOOK_WEB_RUNTIME__;
  });

  it('accepts an HTTPS remote base without browser-shipped secrets', () => {
    window.__SOFTBOOK_WEB_RUNTIME__ = {
      baseUrl: 'https://runtime.example.cn/',
      clientKind: 'web',
      contentManifestPublicKeys: {
        'release-2026': 'ab'.repeat(32),
      },
      mode: 'remote',
      track: 'cet6',
    };

    expect(resolveWebRuntime()).toEqual({
      baseUrl: 'https://runtime.example.cn/',
      clientIdentity: {platform: 'web', version: '1.0.0'},
      clientKind: 'web',
      contentManifestPublicKeys: {
        'release-2026': 'ab'.repeat(32),
      },
      mode: 'remote',
      track: 'cet6',
    });
    expect(window.__SOFTBOOK_WEB_RUNTIME__).not.toHaveProperty('apiKey');
  });

  it('fails closed instead of mixing partial remote and development modes', () => {
    window.__SOFTBOOK_WEB_RUNTIME__ = {
      baseUrl: 'https://runtime.example.cn/',
      clientKind: 'web',
      mode: 'remote',
      track: 'cet4',
    };

    expect(resolveWebRuntime()).toEqual({
      clientKind: 'web',
      mode: 'unavailable',
      reason: '服务配置尚未完整，请稍后再试。',
      track: 'cet4',
    });
  });

  it('rejects repository fixture and loopback endpoints in remote mode', () => {
    for (const baseUrl of [
      'https://repository-fixture.invalid',
      'https://127.0.0.1',
      'https://[::1]',
      'https://runtime.example.cn?credential=transport',
      'https://runtime.example.cn#fragment',
    ]) {
      window.__SOFTBOOK_WEB_RUNTIME__ = {
        baseUrl,
        clientKind: 'web',
        contentManifestPublicKeys: {'release-2026': 'ab'.repeat(32)},
        mode: 'remote',
        track: 'cet4',
      };
      expect(resolveWebRuntime().mode).toBe('unavailable');
    }
  });

  it('uses development cards only in the development or test build mode', () => {
    expect(resolveWebRuntime()).toEqual({
      clientKind: 'web',
      mode: 'development',
      track: 'cet4',
    });
  });
});
