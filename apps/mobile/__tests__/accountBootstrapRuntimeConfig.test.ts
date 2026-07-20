import { resolveAccountBootstrapRepositoryConfig } from '../src/bootstrap/accountBootstrapRuntimeConfig';

test('keeps account bootstrap local by default', () => {
  expect(resolveAccountBootstrapRepositoryConfig(undefined)).toEqual({
    mode: 'local',
  });
});

test('resolves one authenticated remote bootstrap endpoint', () => {
  expect(
    resolveAccountBootstrapRepositoryConfig({
      accountBootstrap: {
        mode: 'remote',
        remote: {
          apiKey: 'runtime-key',
          baseUrl: 'https://api.softbook.example/',
        },
      },
      auth: {
        mode: 'remote',
        remote: { baseUrl: 'https://api.softbook.example/' },
      },
      learningSource: {
        mode: 'remote',
        remote: { baseUrl: 'https://api.softbook.example/' },
      },
    }),
  ).toEqual({
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://api.softbook.example/v2/bootstrap',
      headers: {
        'x-api-key': 'runtime-key',
        'x-softbook-client': 'mobile',
      },
    },
  });
});

test('rejects remote bootstrap with local auth', () => {
  expect(() =>
    resolveAccountBootstrapRepositoryConfig({
      accountBootstrap: {
        mode: 'remote',
        remote: { baseUrl: 'https://api.softbook.example' },
      },
      auth: { mode: 'local' },
    }),
  ).toThrow('Remote account bootstrap mode requires auth.mode');
});

test('rejects remote bootstrap without a versioned remote card source', () => {
  expect(() =>
    resolveAccountBootstrapRepositoryConfig({
      accountBootstrap: {
        mode: 'remote',
        remote: { baseUrl: 'https://api.softbook.example' },
      },
      auth: {
        mode: 'remote',
        remote: { baseUrl: 'https://api.softbook.example' },
      },
      learningSource: { mode: 'local' },
    }),
  ).toThrow(
    'Remote account bootstrap requires learningSource to also be remote.',
  );
});

test('rejects whitespace-only remote bootstrap configuration', () => {
  expect(() =>
    resolveAccountBootstrapRepositoryConfig({
      accountBootstrap: {
        mode: 'remote',
        remote: { baseUrl: '   ' },
      },
      auth: {
        mode: 'remote',
        remote: { baseUrl: 'https://api.softbook.example' },
      },
      learningSource: {
        mode: 'remote',
        remote: { baseUrl: 'https://api.softbook.example' },
      },
    }),
  ).toThrow(
    'Remote account bootstrap mode requires accountBootstrap.remote.baseUrl.',
  );
});
