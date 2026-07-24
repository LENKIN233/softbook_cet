import { resolveSpaceStateRepositoryConfig } from '../src/space/spaceStateRuntimeConfig';

describe('spaceStateRuntimeConfig', () => {
  it('defaults to local mode', () => {
    const config = resolveSpaceStateRepositoryConfig({});

    expect(config.mode).toBe('local');
    expect(config.remoteConfig).toBeUndefined();
  });

  it('requires remote auth when spaceState mode is remote', () => {
    expect(() => {
      resolveSpaceStateRepositoryConfig({
        spaceState: {
          mode: 'remote',
          remote: { baseUrl: 'https://api.example.com' },
        },
      });
    }).toThrow(/requires auth.mode to also be remote/);
  });

  it('requires remote canonical bootstrap when spaceState mode is remote', () => {
    expect(() => {
      resolveSpaceStateRepositoryConfig({
        accountBootstrap: {
          mode: 'local',
        },
        auth: {
          mode: 'remote',
          remote: { baseUrl: 'https://api.example.com' },
        },
        spaceState: {
          mode: 'remote',
          remote: { baseUrl: 'https://api.example.com' },
        },
      });
    }).toThrow(/requires accountBootstrap.mode to also be remote/);
  });

  it('builds remote config with baseUrl and apiKey', () => {
    const config = resolveSpaceStateRepositoryConfig({
      accountBootstrap: {
        mode: 'remote',
        remote: { baseUrl: 'https://api.example.com' },
      },
      auth: {
        mode: 'remote',
        remote: { baseUrl: 'https://api.example.com' },
      },
      spaceState: {
        mode: 'remote',
        remote: {
          baseUrl: 'https://api.example.com',
          apiKey: 'test-key',
        },
      },
    });

    expect(config.mode).toBe('remote');
    expect(config.remoteConfig?.endpoint).toBe(
      'https://api.example.com/v2/space/actions',
    );
    expect(config.remoteConfig?.headers?.['x-api-key']).toBe('test-key');
  });
});
