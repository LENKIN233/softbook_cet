import {resolveWebRuntime} from './runtime';

describe('Web runtime boundary', () => {
  afterEach(() => {
    delete window.__SOFTBOOK_WEB_RUNTIME__;
  });

  it('accepts an HTTPS remote base without browser-shipped secrets', () => {
    window.__SOFTBOOK_WEB_RUNTIME__ = {
      baseUrl: 'https://runtime.example.cn/',
      mode: 'remote',
      track: 'cet6',
    };

    expect(resolveWebRuntime()).toEqual({
      baseUrl: 'https://runtime.example.cn/',
      clientIdentity: {platform: 'web', version: '0.1.0'},
      clientKind: 'web',
      mode: 'remote',
      track: 'cet6',
    });
    expect(window.__SOFTBOOK_WEB_RUNTIME__).not.toHaveProperty('apiKey');
  });

  it('uses development cards only in the development or test build mode', () => {
    expect(resolveWebRuntime()).toEqual({
      clientKind: 'web',
      mode: 'development',
      track: 'cet4',
    });
  });
});
